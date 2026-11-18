// Smoke E2E HU019: punto de integración REST para pedidos externos (API real, sin navegador)
// Cubre: payload válido con identificador interno, payload inválido, canal no registrado o inactivo,
// plato desconocido, enrutamiento automático (cola y WebSocket de la estación) y acceso sin clave válida.
// La clave se toma de KDS_INTEGRACION_API_KEY (por defecto, la de compose.local.yml).
const { API, sleep, http, login, loginCompleto, stompSuscriptor, vaciarCola, despacharItems } = require('./lib.cjs');

const CLAVE = process.env.KDS_INTEGRACION_API_KEY || 'kds-integracion-local-2026';

// Plazo máximo de toda la prueba: si algo se cuelga, termina e indica dónde quedó (ver las líneas impresas)
setTimeout(() => {
  console.log('FAIL La prueba superó los 60 s y se canceló: revise la última línea OK impresa');
  process.exit(2);
}, 60000).unref();

// El punto de integración usa X-Api-Key en lugar de sesión: se llama directo, sin el helper de JWT
async function integrar(cuerpo, clave = CLAVE, token = null) {
  const res = await fetch(`${API}/integracion/pedidos`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(clave !== null ? { 'X-Api-Key': clave } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
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
  const creados = [];
  let sub;
  let admin;
  let rappi;

  try {
    const mozo = await login('login-pin', { username: 'angie', pin: '1234' });
    admin = await loginCompleto('login-admin', { username: 'admin', password: 'admin123' });
    const canales = (await http('GET', '/canales/todos', admin.token)).data;
    rappi = canales.find((c) => c.codigo === 'RAPPI');
    check('El canal Rappi existe, está activo y es un agregador', !!rappi && rappi.activo && rappi.externo === true, JSON.stringify(rappi));
    const estaciones = (await http('GET', '/estaciones', mozo)).data;
    const plancha = estaciones.find((e) => e.codigo === 'PLANCHA').id;
    const platos = (await http('GET', '/platos', mozo)).data.filter((p) => p.disponible && p.activo);
    const plato = platos.find((p) => p.estacionId === plancha && p.modificadores.length > 0);
    const modificador = plato.modificadores[0];
    const cocPlancha = await login('login-pin', { username: 'cocinero1', pin: '5678', estacionId: plancha });
    await vaciarCola(plancha, cocPlancha);
    const pedidosActivos = async () => (await http('GET', '/pedidos/activos', admin.token)).data.length;

    const numero = `SMK-${Date.now()}`;
    const valido = () => ({
      canal: 'RAPPI',
      numeroOrden: numero,
      cliente: { nombre: 'Ana Torres', telefono: '987654321', direccion: 'Av. Brasil 123' },
      observaciones: 'Tocar el timbre',
      items: [{ codigoPlato: codigoDe(plato), cantidad: 2, modificadores: [modificador] }],
    });

    // --- Esc.1 y 5: payload válido -> identificador interno, y los ítems llegan a su estación
    sub = await stompSuscriptor([`/topic/estacion/${plancha}`], cocPlancha);
    const t0 = Date.now();
    const r1 = await integrar(valido());
    check('Esc.1 un payload válido se acepta (201) y devuelve el identificador interno', r1.status === 201 && Number.isInteger(r1.data?.pedidoId) && /^CMD-\d{6}-\d{4}$/.test(r1.data?.codigoPedido ?? ''), `${r1.status} ${JSON.stringify(r1.data)}`);
    check('La respuesta indica canal, número de orden y estado', r1.data?.canal === 'RAPPI' && r1.data?.numeroOrden === numero && r1.data?.estado === 'ENVIADO');
    creados.push(r1.data);

    const pedido = (await http('GET', `/pedidos/${r1.data.pedidoId}`, admin.token)).data;
    check('El pedido queda en el canal Rappi con su número de orden y el nombre; el celular no se guarda', pedido.canalCodigo === 'RAPPI' && pedido.numeroOrdenExterno === numero && pedido.clienteNombre === 'Ana Torres' && pedido.clienteTelefono == null, `${pedido.clienteNombre} / ${pedido.clienteTelefono}`);
    check('El pedido queda a nombre de la cuenta de integración', pedido.usuarioNombre === 'Integración Externa', pedido.usuarioNombre);
    check('El ítem conserva cantidad y modificador del catálogo', pedido.items[0].cantidad === 2 && pedido.items[0].modificadores === modificador, `${pedido.items[0].cantidad} ${pedido.items[0].modificadores}`);

    const cola = (await http('GET', `/estaciones/${plancha}/cola`, cocPlancha)).data;
    const enCola = cola.find((i) => i.codigoPedido === r1.data.codigoPedido);
    check('Esc.5 el ítem está en la cola de su estación con su canal y número de orden', !!enCola && enCola.canalCodigo === 'RAPPI' && enCola.numeroOrdenExterno === numero, JSON.stringify(enCola ?? null));
    let ms = null;
    while (Date.now() - t0 < 4000) {
      if (sub.recibidos[`/topic/estacion/${plancha}`].some((m) => m.item?.codigoPedido === r1.data.codigoPedido)) { ms = Date.now() - t0; break; }
      await sleep(25);
    }
    check('Esc.5 la estación recibe el ítem por WebSocket en 2 s o menos', ms !== null && ms <= 2000, `${ms} ms`);

    // --- Esc.2: payload inválido
    const antes = await pedidosActivos();
    const vacio = await integrar({});
    check('Esc.2 un payload vacío se rechaza nombrando los campos faltantes', vacio.status === 400 && ['canal', 'numeroOrden', 'items'].every((c) => (vacio.data?.mensaje ?? '').includes(`'${c}'`)), `${vacio.status} ${vacio.data?.mensaje}`);
    const itemMalo = valido();
    itemMalo.items = [{ codigoPlato: '', cantidad: 0 }];
    const rItem = await integrar(itemMalo);
    check('Esc.2 un ítem sin código y con cantidad inválida se rechaza', rItem.status === 400 && /codigoPlato/.test(rItem.data?.mensaje ?? '') && /cantidad/.test(rItem.data?.mensaje ?? ''), `${rItem.status} ${rItem.data?.mensaje}`);
    const sinNumero = valido();
    delete sinNumero.numeroOrden;
    const rNumero = await integrar(sinNumero);
    check('Esc.2 sin número de orden se rechaza', rNumero.status === 400 && /numeroOrden/.test(rNumero.data?.mensaje ?? ''), `${rNumero.status} ${rNumero.data?.mensaje}`);

    // --- Esc.3: canal no registrado, Salón o inactivo
    const noExiste = valido();
    noExiste.canal = 'NOEXISTE';
    const rCanal = await integrar(noExiste);
    check('Esc.3 un canal inexistente se rechaza indicando el canal', rCanal.status === 400 && (rCanal.data?.mensaje ?? '').includes('NOEXISTE'), `${rCanal.status} ${rCanal.data?.mensaje}`);
    const salon = valido();
    salon.canal = 'SALON';
    const rSalon = await integrar(salon);
    check('Esc.3 Salón no admite pedidos externos', rSalon.status === 400 && /SALON/.test(rSalon.data?.mensaje ?? ''), `${rSalon.status} ${rSalon.data?.mensaje}`);
    await http('PATCH', `/canales/${rappi.id}/estado`, admin.token, { activo: false });
    const rInactivo = await integrar(valido());
    await http('PATCH', `/canales/${rappi.id}/estado`, admin.token, { activo: true });
    check('Esc.3 un canal inactivo se rechaza', rInactivo.status === 400 && /no existe o no está activo/.test(rInactivo.data?.mensaje ?? ''), `${rInactivo.status} ${rInactivo.data?.mensaje}`);

    // --- Esc.4: plato desconocido, con el ítem que no se reconoce
    const desconocido = valido();
    desconocido.items.push({ codigoPlato: 'PLT-9999', cantidad: 1 });
    const rPlato = await integrar(desconocido);
    check('Esc.4 un código de plato inexistente se rechaza indicando el ítem y el código', rPlato.status === 400 && /Ítem 2/.test(rPlato.data?.mensaje ?? '') && /PLT-9999/.test(rPlato.data?.mensaje ?? ''), `${rPlato.status} ${rPlato.data?.mensaje}`);
    const modMalo = valido();
    modMalo.items[0].modificadores = ['Con helado de vainilla'];
    const rMod = await integrar(modMalo);
    check('Un modificador que no es del plato se rechaza (HU008)', rMod.status === 400 && /Con helado de vainilla/.test(rMod.data?.mensaje ?? ''), `${rMod.status} ${rMod.data?.mensaje}`);

    // --- Esc.6: sin la clave de integración válida nada se registra
    const sinClave = await integrar(valido(), null);
    check('Esc.6 sin clave se responde 401', sinClave.status === 401, String(sinClave.status));
    const claveMala = await integrar(valido(), 'clave-incorrecta');
    check('Esc.6 con una clave incorrecta se responde 401', claveMala.status === 401, String(claveMala.status));
    const soloJwt = await integrar(valido(), null, admin.token);
    check('Esc.6 ni siquiera un administrador con sesión entra sin la clave', soloJwt.status === 401, String(soloJwt.status));
    check('Esc.6 sin clave no se registra ningún pedido', (await pedidosActivos()) === antes, `${antes} -> ${await pedidosActivos()}`);

    // --- Delivery propio por la integración: nombre, celular y dirección de entrega
    const delivery = () => ({
      canal: 'DELIVERY',
      numeroOrden: `${numero}-D`,
      cliente: { nombre: 'Luis Prueba', telefono: '912345678', direccion: 'Jr. Lima 456' },
      items: [{ codigoPlato: codigoDe(plato), cantidad: 1 }],
    });
    const sinDireccion = delivery();
    delete sinDireccion.cliente.direccion;
    const rSinDireccion = await integrar(sinDireccion);
    check('Delivery propio sin dirección de entrega se rechaza', rSinDireccion.status === 400 && /dirección/.test(rSinDireccion.data?.mensaje ?? ''), `${rSinDireccion.status} ${rSinDireccion.data?.mensaje}`);
    const rDelivery = await integrar(delivery());
    check('Delivery propio con nombre, celular y dirección se acepta', rDelivery.status === 201 && rDelivery.data?.canal === 'DELIVERY', `${rDelivery.status} ${JSON.stringify(rDelivery.data)}`);
    if (rDelivery.status === 201) creados.push(rDelivery.data);

    // El comandero del mozo tampoco puede usar el canal de un agregador
    const mozoRappi = await http('POST', '/pedidos', mozo, { canalId: rappi.id, items: [{ platoId: plato.id, cantidad: 1 }] });
    check('El mozo no puede registrar pedidos de Rappi desde el comandero', mozoRappi.status === 400 && /comandero/.test(mozoRappi.data?.mensaje ?? ''), `${mozoRappi.status} ${mozoRappi.data?.mensaje}`);
  } catch (e) {
    check('Ejecución sin excepciones', false, e.message);
  } finally {
    try {
      sub?.ws.close();
      // Deja el canal activo aunque la prueba haya fallado a medias
      if (rappi && admin) await http('PATCH', `/canales/${rappi.id}/estado`, admin.token, { activo: true });
      for (const c of creados) {
        const p = (await http('GET', `/pedidos/${c.pedidoId}`, admin.token)).data;
        if (p) await despacharItems(p.items);
      }
    } catch (e) {
      console.warn(`Limpieza incompleta: ${e.message}`);
    }
    const fallidas = results.filter((r) => !r.ok).length;
    console.log(`==== ${results.length - fallidas}/${results.length} comprobaciones OK`);
    process.exit(fallidas === 0 ? 0 : 1);
  }
})();
