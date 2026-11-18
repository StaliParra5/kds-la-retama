// Smoke E2E HU034: descartar pedidos externos duplicados (API real + WebSocket, sin navegador)
// Cubre: reenvío igual con un único registro y el mismo identificador, mismo número en otro canal, reenvío con
// otros ítems rechazado sin tocar el original, registro manual duplicado advertido, sin tarjeta nueva en la
// estación y reenvíos simultáneos que no duplican. La clave sale de KDS_INTEGRACION_API_KEY.
const { API, sleep, http, login, loginCompleto, activarCanal, stompSuscriptor, vaciarCola, despacharItems } = require('./lib.cjs');

const CLAVE = process.env.KDS_INTEGRACION_API_KEY || 'kds-integracion-local-2026';

setTimeout(() => {
  console.log('FAIL La prueba superó los 60 s y se canceló: revise la última línea OK impresa');
  process.exit(2);
}, 60000).unref();

async function integrar(cuerpo) {
  const res = await fetch(`${API}/integracion/pedidos`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Api-Key': CLAVE },
    body: JSON.stringify(cuerpo),
  });
  const texto = await res.text();
  return { status: res.status, data: texto ? JSON.parse(texto) : null };
}

const codigoDe = (plato) => `PLT-${String(plato.id).padStart(3, '0')}`;

(async () => {
  const results = [];
  const check = (name, ok, detail = '') => {
    results.push({ name, ok, detail });
    console.log(`${ok ? 'OK  ' : 'FAIL'} ${name}${detail ? ` (${detail})` : ''}`);
  };
  const creados = new Set();
  let sub;
  let admin;

  let restaurarDelivery = async () => {};
  try {
    // El canal Delivery puede estar inactivo en el entorno: la prueba lo activa y al final lo deja como estaba
    restaurarDelivery = await activarCanal('DELIVERY');
    const mozo = await login('login-pin', { username: 'angie', pin: '1234' });
    admin = await loginCompleto('login-admin', { username: 'admin', password: 'admin123' });
    const exp = await login('login-pin', { username: 'expedidor1', pin: '9012' });
    const canales = (await http('GET', '/canales', mozo)).data;
    const rappi = canales.find((c) => c.codigo === 'RAPPI');
    const estaciones = (await http('GET', '/estaciones', mozo)).data;
    const plancha = estaciones.find((e) => e.codigo === 'PLANCHA').id;
    const platos = (await http('GET', '/platos', mozo)).data.filter((p) => p.disponible && p.activo && p.estacionId === plancha);
    const plato = platos[0];
    const cocPlancha = await login('login-pin', { username: 'cocinero1', pin: '5678', estacionId: plancha });
    await vaciarCola(plancha, cocPlancha);

    const numero = `DUP-${Date.now()}`;
    const pedido = (extra = {}) => ({ canal: 'RAPPI', numeroOrden: numero, items: [{ codigoPlato: codigoDe(plato), cantidad: 2 }], ...extra });
    // Cuenta los pedidos con ese número en un canal: el Esc.3 crea a propósito el mismo número en Delivery propio
    const conNumero = async (n, canalCodigo = 'RAPPI') => (await http('GET', '/pedidos/externos/recientes', admin.token)).data
      .filter((p) => p.numeroOrdenExterno === n && p.canalCodigo === canalCodigo);
    const itemsEnCola = async (codigo) => (await http('GET', `/estaciones/${plancha}/cola`, cocPlancha)).data.filter((i) => i.codigoPedido === codigo).length;

    // Pedido original
    const r1 = await integrar(pedido());
    check('El pedido original se registra (201)', r1.status === 201, `${r1.status} ${r1.data?.mensaje ?? ''}`);
    creados.add(r1.data?.pedidoId);
    await sleep(500);

    // --- Esc.1, 2 y 6: reenvío igual
    sub = await stompSuscriptor([`/topic/estacion/${plancha}`], cocPlancha);
    const antesCola = await itemsEnCola(r1.data.codigoPedido);
    const r2 = await integrar(pedido());
    check('Esc.2 el reenvío igual responde 200 con el mismo identificador interno', r2.status === 200 && r2.data?.pedidoId === r1.data.pedidoId && r2.data?.codigoPedido === r1.data.codigoPedido, `${r2.status} ${r2.data?.pedidoId}/${r1.data.pedidoId}`);
    const r2b = await integrar(pedido({ numeroOrden: ` ${numero} ` }));
    check('El reenvío con espacios alrededor del número también se reconoce', r2b.status === 200 && r2b.data?.pedidoId === r1.data.pedidoId, String(r2b.status));
    check('Esc.1 existe un único registro con ese número de orden', (await conNumero(numero)).length === 1);
    await sleep(1500);
    check('Esc.6 el reenvío no envía ninguna tarjeta nueva a la estación', sub.recibidos[`/topic/estacion/${plancha}`].length === 0, `${sub.recibidos[`/topic/estacion/${plancha}`].length} mensajes`);
    check('Esc.6 la cola de la estación no cambia', (await itemsEnCola(r1.data.codigoPedido)) === antesCola, `${antesCola}`);

    // --- Esc.3: mismo número en otro canal
    const r3 = await integrar(pedido({ canal: 'DELIVERY', cliente: { nombre: 'Ana Ruiz', telefono: '987654321', direccion: 'Jr. Lima 456' } }));
    check('Esc.3 el mismo número en otro canal es otro pedido', r3.status === 201 && r3.data?.pedidoId !== r1.data.pedidoId && r3.data?.canal === 'DELIVERY', `${r3.status} ${r3.data?.mensaje ?? ''}`);
    creados.add(r3.data?.pedidoId);

    // --- Esc.4: reenvío con otros ítems
    const r4 = await integrar(pedido({ items: [{ codigoPlato: codigoDe(plato), cantidad: 5 }] }));
    check('Esc.4 un reenvío con otros ítems se rechaza informando el conflicto', r4.status === 409 && r4.data?.codigo === 'PEDIDO_EXTERNO_CONFLICTO' && (r4.data?.mensaje ?? '').includes(r1.data.codigoPedido), `${r4.status} ${r4.data?.mensaje}`);
    const original = (await http('GET', `/pedidos/${r1.data.pedidoId}`, admin.token)).data;
    check('Esc.4 el pedido original no se modifica', original.items.length === 1 && original.items[0].cantidad === 2, JSON.stringify(original.items.map((i) => i.cantidad)));

    // --- Esc.5: el expedidor intenta registrarlo a mano
    const r5 = await http('POST', '/pedidos/externo', exp, { canalId: rappi.id, numeroOrdenExterno: numero, items: [{ platoId: plato.id, cantidad: 2 }] });
    check('Esc.5 el registro manual con el mismo número advierte que ya existe', r5.status === 409 && r5.data?.codigo === 'PEDIDO_EXTERNO_DUPLICADO' && (r5.data?.mensaje ?? '').includes(r1.data.codigoPedido), `${r5.status} ${r5.data?.mensaje}`);
    check('Esc.5 sigue habiendo un único pedido con ese número', (await conNumero(numero)).length === 1);

    // Reenvíos simultáneos de un pedido nuevo: uno solo se crea, el resto recibe el mismo identificador
    const numeroCarrera = `${numero}-C`;
    const respuestas = await Promise.all(Array.from({ length: 5 }, () => integrar(pedido({ numeroOrden: numeroCarrera }))));
    const creadosCarrera = respuestas.filter((r) => r.status === 201);
    const ids = new Set(respuestas.map((r) => r.data?.pedidoId));
    respuestas.forEach((r) => creados.add(r.data?.pedidoId));
    check('Cinco reenvíos simultáneos crean un solo pedido', creadosCarrera.length === 1 && respuestas.every((r) => r.status === 201 || r.status === 200) && ids.size === 1, respuestas.map((r) => r.status).join(','));
    check('Tras la carrera existe un único registro', (await conNumero(numeroCarrera)).length === 1);
  } catch (e) {
    check('Ejecución sin excepciones', false, e.message);
  } finally {
    try {
      sub?.ws.close();
      for (const id of creados) {
        if (!id) continue;
        const p = (await http('GET', `/pedidos/${id}`, admin.token)).data;
        if (p?.items) await despacharItems(p.items);
      }
    } catch (e) {
      console.warn(`Limpieza incompleta: ${e.message}`);
    }
    try {
      await restaurarDelivery();
    } catch (e) {
      console.warn(`No se pudo restaurar el canal Delivery: ${e.message}`);
    }
    const fallidas = results.filter((r) => !r.ok).length;
    console.log(`==== ${results.length - fallidas}/${results.length} comprobaciones OK`);
    process.exit(fallidas === 0 ? 0 : 1);
  }
})();
