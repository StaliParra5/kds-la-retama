// Smoke HU011: enrutamiento por estación verificado con suscriptores STOMP reales (WebSocket nativo de Node)
const { sleep, http, login, stompSuscriptor } = require('./lib.cjs');

(async () => {
  const results = [];
  const check = (name, ok, detail = '') => results.push({ name, ok, detail });
  let ws;
  try {
    const mozo = await login('login-pin', { username: 'angie', pin: '1234' });
    const admin = await login('login-admin', { username: 'admin', password: 'admin123' });
    const estaciones = (await http('GET', '/estaciones', mozo)).data;
    const id = (codigo) => estaciones.find((e) => e.codigo === codigo).id;
    const platos = (await http('GET', '/platos', mozo)).data.filter((p) => p.disponible);
    const platoDe = (codigo, n = 0) => platos.filter((p) => p.estacionId === id(codigo))[n];

    const tops = ['PLANCHA', 'FRIOS', 'CALIENTES', 'BEBIDAS'].map((c) => `/topic/estacion/${id(c)}`);
    // Monitor general: solo admin/expedidor escuchan todas las estaciones (HU012)
    const sub = await stompSuscriptor([...tops, '/topic/pedidos'], admin);
    ws = sub.ws;
    const rec = sub.recibidos;
    const [tPlancha, tFrios, tCalientes, tBebidas] = tops;

    // Esc. 1: 4 platos de 3 estaciones
    const multi = await http('POST', '/pedidos', mozo, { canalId: 3, items: [
      { platoId: platoDe('PLANCHA').id, cantidad: 3, modificadores: 'Sin cebolla' },
      { platoId: platoDe('PLANCHA', 1).id, cantidad: 1 },
      { platoId: platoDe('FRIOS').id, cantidad: 1 },
      { platoId: platoDe('CALIENTES').id, cantidad: 2 },
    ] });
    await sleep(800);
    const codigo = multi.data.codigoCorrelativo;
    const de = (t) => rec[t].filter((m) => m.item.codigoPedido === codigo);
    check('Esc.1 pedido multiestación registrado', multi.status === 201);
    check('Esc.1 Plancha recibe sus 2 ítems', de(tPlancha).length === 2, `${de(tPlancha).length}`);
    check('Esc.1 Fríos recibe su ítem', de(tFrios).length === 1);
    check('Esc.1 Calientes recibe su ítem', de(tCalientes).length === 1);
    check('Esc.2 Bebidas no recibe nada de este pedido', de(tBebidas).length === 0);
    const lomo = de(tPlancha).find((m) => m.item.cantidad === 3);
    check('Esc.3 llega como un solo ítem con cantidad 3 y el modificador', !!lomo && lomo.item.modificadores === 'Sin cebolla' && lomo.tipo === 'ITEM_NUEVO');
    check('HU012 Esc.4 el ítem informa ítems del pedido en otras estaciones', lomo?.item.itemsEnOtrasEstaciones === 2, `${lomo?.item.itemsEnOtrasEstaciones}`);
    check('Monitores reciben el alta en /topic/pedidos', rec['/topic/pedidos'].some((m) => m.codigoPedido === codigo && m.tipo === 'PEDIDO_NUEVO'));

    // Esc. 2: pedido de una sola estación
    const solo = await http('POST', '/pedidos', mozo, { canalId: 3, items: [{ platoId: platoDe('BEBIDAS').id, cantidad: 2 }] });
    await sleep(800);
    const deSolo = (t) => rec[t].filter((m) => m.item.codigoPedido === solo.data.codigoCorrelativo).length;
    check('Esc.2 solo Bebidas recibe el pedido de una estación', deSolo(tBebidas) === 1 && deSolo(tPlancha) + deSolo(tFrios) + deSolo(tCalientes) === 0);

    // Esc. 4: la pantalla de Fríos "estaba apagada": consulta su cola al conectarse
    const cocFrios = await login('login-pin', { username: 'cocinero1', pin: '5678', estacionId: id('FRIOS') });
    const cola = await http('GET', `/estaciones/${id('FRIOS')}/cola`, cocFrios);
    check('Esc.4 la cola de Fríos contiene el ítem enrutado sin pantalla conectada', cola.status === 200 && cola.data.some((i) => i.codigoPedido === codigo));
    check('Esc.4 la cola de Fríos no contiene ítems de otras estaciones', cola.data.every((i) => i.estacionId === id('FRIOS')));
    check('D6 un cocinero de Fríos no lee la cola de Plancha (403)', (await http('GET', `/estaciones/${id('PLANCHA')}/cola`, cocFrios)).status === 403);

    // Esc. 5: plato reasignado de estación
    const platoMover = platoDe('PLANCHA', 1);
    const original = (await http('GET', `/platos/${platoMover.id}`, admin)).data;
    const guardar = (estacionId) => http('PUT', `/platos/${platoMover.id}`, admin, {
      nombre: original.nombre, descripcion: original.descripcion, precio: original.precio,
      tiempoEstandarMinutos: original.tiempoEstandarMinutos, categoriaId: original.categoriaId, estacionId, disponible: original.disponible,
    });
    const mov = await guardar(id('CALIENTES'));
    const nuevo = await http('POST', '/pedidos', mozo, { canalId: 3, items: [{ platoId: platoMover.id, cantidad: 1 }] });
    await guardar(original.estacionId);
    const previo = (await http('GET', `/pedidos/${multi.data.id}`, mozo)).data.items.find((i) => i.platoId === platoMover.id);
    check('Esc.5 reasignación de plato aplicada por el admin', mov.status === 200, `${mov.status}`);
    check('Esc.5 el pedido nuevo llega a la nueva estación', nuevo.data.items[0].estacionId === id('CALIENTES'));
    check('Esc.5 el pedido anterior permanece en la estación original', previo.estacionId === id('PLANCHA'));

    // Esc. 6: estación desactivada. HU004 impide desactivar desde administración una estación con
    // platos asignados, así que se simula desde la BD para verificar la defensa del backend.
    const { execSync } = require('child_process');
    const sql = (q) => execSync(`docker exec kds-postgres psql -U kds_user -d kds_db -tAc "${q}"`).toString().trim();
    const bloqueo = await http('PUT', `/estaciones/${id('BEBIDAS')}`, admin, { nombre: 'Bebidas', descripcion: 'x', activo: false });
    check('HU004 impide desactivar desde admin una estación con platos (400)', bloqueo.status === 400);
    sql(`UPDATE estaciones SET activo = FALSE WHERE id = ${id('BEBIDAS')}`);
    const r6 = await http('POST', '/pedidos', mozo, { canalId: 3, items: [{ platoId: platoDe('BEBIDAS').id, cantidad: 1 }] });
    sql(`UPDATE estaciones SET activo = TRUE WHERE id = ${id('BEBIDAS')}`);
    check('Esc.6 el envío se rechaza indicando el plato sin estación activa', r6.status === 400 && r6.data.mensaje.includes('estación de cocina activa') && r6.data.mensaje.includes(platoDe('BEBIDAS').nombre), r6.data?.mensaje);
  } catch (e) {
    check('Ejecución sin excepciones', false, e.message);
  } finally {
    ws?.close();
    for (const r of results) console.log(`${r.ok ? 'OK  ' : 'FAIL'} ${r.name}${r.detail ? ` (${r.detail})` : ''}`);
    process.exit(results.every((r) => r.ok) ? 0 : 1);
  }
})();
