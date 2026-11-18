// Smoke HU017 (mozo): el mozo recibe por WebSocket cada avance de cocina sobre sus ítems, sin recargar.
// Escucha /topic/pedidos con el token del mozo (el único tópico de pedidos que su rol puede escuchar) y
// comprueba que cada cambio de un ítem llega en <= 2 s, también cuando el estado del pedido no cambia.
const { sleep, http, login, stompSuscriptor, vaciarCola, despacharItems } = require('./lib.cjs');

const LIMITE_MS = 2000;

// Milisegundos hasta que llega un mensaje que cumpla la condición (o null si vence el plazo)
async function esperarMensaje(sub, destino, condicion, desde = 0, ms = 4000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    if (sub.recibidos[destino].slice(desde).some(condicion)) return Date.now() - t0;
    await sleep(25);
  }
  return null;
}

setTimeout(() => {
  console.log('FAIL La prueba superó los 60 s y se canceló: revise la última línea OK impresa');
  process.exit(2);
}, 60000).unref();

(async () => {
  const results = [];
  const check = (name, ok, detail = '') => {
    results.push({ name, ok, detail });
    console.log(`${ok ? 'OK  ' : 'FAIL'} ${name}${detail ? ` (${detail})` : ''}`);
  };
  const creados = [];
  let sub;
  try {
    const mozo = await login('login-pin', { username: 'angie', pin: '1234' });
    const canales = (await http('GET', '/canales', mozo)).data;
    const delivery = canales.find((c) => c.codigo === 'DELIVERY').id;
    const estaciones = (await http('GET', '/estaciones', mozo)).data;
    const plancha = estaciones.find((e) => e.codigo === 'PLANCHA').id;
    const frios = estaciones.find((e) => e.codigo === 'FRIOS').id;
    const platos = (await http('GET', '/platos', mozo)).data.filter((p) => p.disponible);
    const platoPlancha = platos.find((p) => p.estacionId === plancha);
    const platoFrios = platos.find((p) => p.estacionId === frios);
    const cocPlancha = await login('login-pin', { username: 'cocinero1', pin: '5678', estacionId: plancha });
    const cocFrios = await login('login-pin', { username: 'cocinero1', pin: '5678', estacionId: frios });
    await vaciarCola(plancha, cocPlancha);
    await vaciarCola(frios, cocFrios);

    sub = await stompSuscriptor(['/topic/pedidos'], mozo);
    check('El mozo puede escuchar /topic/pedidos', true);
    const mover = (itemId, token, de, a) => http('PATCH', `/items/${itemId}/estado`, token, { estadoActual: de, estadoDestino: a });

    // Un pedido de dos ítems (Plancha y Fríos): el estado del pedido solo cambia con el primer avance
    const r = await http('POST', '/pedidos', mozo, {
      canalId: delivery,
      items: [{ platoId: platoPlancha.id, cantidad: 1 }, { platoId: platoFrios.id, cantidad: 1 }],
    });
    if (r.status !== 201) throw new Error(`pedido: ${r.status} ${r.data?.mensaje}`);
    creados.push(r.data);
    const pedido = r.data;
    const itPlancha = pedido.items.find((i) => i.estacionId === plancha);
    const itFrios = pedido.items.find((i) => i.estacionId === frios);
    const deEstePedido = (m) => m.pedidoId === pedido.id;

    // Avance 1: Plancha inicia su ítem; el pedido pasa a En preparación
    let desde = sub.recibidos['/topic/pedidos'].length;
    await mover(itPlancha.id, cocPlancha, 'RECIBIDO', 'EN_PREPARACION');
    const ms1 = await esperarMensaje(sub, '/topic/pedidos', (m) => deEstePedido(m) && m.estado === 'EN_PREPARACION', desde);
    check('El mozo se entera de que cocina inició un ítem en 2 s o menos', ms1 !== null && ms1 <= LIMITE_MS, `${ms1} ms`);

    // Avance 2: Fríos inicia el suyo; el estado del pedido NO cambia, pero el mozo igual debe enterarse
    desde = sub.recibidos['/topic/pedidos'].length;
    await mover(itFrios.id, cocFrios, 'RECIBIDO', 'EN_PREPARACION');
    const ms2 = await esperarMensaje(sub, '/topic/pedidos', deEstePedido, desde);
    check('También se entera cuando cambia un ítem y el pedido sigue En preparación', ms2 !== null && ms2 <= LIMITE_MS, `${ms2} ms`);

    // Avance 3: un ítem queda Listo
    desde = sub.recibidos['/topic/pedidos'].length;
    await mover(itPlancha.id, cocPlancha, 'EN_PREPARACION', 'LISTO');
    const ms3 = await esperarMensaje(sub, '/topic/pedidos', deEstePedido, desde);
    check('Se entera de que un ítem quedó listo en 2 s o menos', ms3 !== null && ms3 <= LIMITE_MS, `${ms3} ms`);

    // Avance 4: el expedidor despacha el ítem listo
    const expedidor = await login('login-pin', { username: 'expedidor1', pin: '9012' });
    desde = sub.recibidos['/topic/pedidos'].length;
    await mover(itPlancha.id, expedidor, 'LISTO', 'DESPACHADO');
    const ms4 = await esperarMensaje(sub, '/topic/pedidos', deEstePedido, desde);
    check('Se entera del despacho de un ítem en 2 s o menos', ms4 !== null && ms4 <= LIMITE_MS, `${ms4} ms`);

    // El aviso lleva lo necesario para que la pantalla recargue el pedido correcto
    const ultimo = sub.recibidos['/topic/pedidos'].filter(deEstePedido).at(-1);
    check('El aviso identifica el pedido y su estado', ultimo?.codigoPedido === pedido.codigoCorrelativo && !!ultimo?.estado, JSON.stringify(ultimo));
  } catch (e) {
    check('Ejecución sin excepciones', false, e.message);
  } finally {
    try {
      sub?.ws.close();
      for (const p of creados) await despacharItems(p.items);
    } catch (e) {
      console.warn(`Limpieza incompleta: ${e.message}`);
    }
    const fallidas = results.filter((x) => !x.ok).length;
    console.log(`==== ${results.length - fallidas}/${results.length} comprobaciones OK`);
    process.exit(fallidas === 0 ? 0 : 1);
  }
})();
