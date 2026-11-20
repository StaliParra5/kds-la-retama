// Smoke E2E HU025: semáforo por SLA en la estación y en el pase (API real + Chrome)
// Cubre: verde, ámbar y rojo según el umbral ámbar y el SLA del canal; dos canales con SLA distinto y el mismo
// tiempo muestran colores distintos; cambio de SLA recalculado al instante; cambio de color sin recargar;
// semáforo en el pase; pedido despachado que deja de mostrarse; umbral fuera de rango rechazado.
// Tarda poco más de 1 minuto: espera a que un pedido cruce un SLA de 1 minuto para verlo en rojo.
// El cálculo con la hora del servidor (Esc. 3) lo prueba smoke_hu021.cjs con un reloj adelantado.
// D39: Salón toma sus tiempos de la pestaña Salón; su tarjeta y su mesa cambian de color en el mismo minuto.
const path = require('path');
const FRONT = path.resolve(__dirname, '../../frontend');
const puppeteer = require(path.join(FRONT, 'node_modules/puppeteer-core'));
const { sleep, http, login, loginCompleto, activarCanal, vaciarCola, despacharItems, cerrarMesa } = require('./lib.cjs');

const BASE = 'http://localhost:5173';
const OUT = process.env.E2E_OUT || require('os').tmpdir();

setTimeout(() => {
  console.log('FAIL La prueba superó los 180 s y se canceló: revise la última línea OK impresa');
  process.exit(2);
}, 180000).unref();

async function esperar(page, fn, arg, ms = 4000) {
  try {
    await page.waitForFunction(fn, { timeout: ms, polling: 100 }, arg);
    return true;
  } catch {
    return false;
  }
}

(async () => {
  const results = [];
  const check = (name, ok, detail = '') => {
    results.push({ name, ok, detail });
    console.log(`${ok ? 'OK  ' : 'FAIL'} ${name}${detail ? ` (${detail})` : ''}`);
  };
  const browser = await puppeteer.launch({
    executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new',
    args: ['--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows'],
  });
  const errors = [];
  const creados = [];
  const originales = [];
  let admin;
  let restaurarDelivery = async () => {};
  let mozo;
  let semaforoSalonOriginal = null;
  let mesaAbierta = null;

  try {
    // El canal Delivery puede estar inactivo en el entorno: la prueba lo activa y al final lo deja como estaba
    restaurarDelivery = await activarCanal('DELIVERY');
    admin = await loginCompleto('login-admin', { username: 'admin', password: 'admin123' });
    const exp = await loginCompleto('login-pin', { username: 'expedidor1', pin: '9012' });
    mozo = await login('login-pin', { username: 'angie', pin: '1234' });
    const canales = (await http('GET', '/canales/todos', admin.token)).data;
    const delivery = canales.find((c) => c.codigo === 'DELIVERY');
    const llevar = canales.find((c) => c.codigo === 'PARA_LLEVAR');
    for (const c of [delivery, llevar]) originales.push({ id: c.id, sla: c.slaObjetivoMinutos, umbral: c.umbralAmbarPorcentaje });
    const sla = (canal, minutos, umbral) => http('PUT', `/canales/${canal.id}/sla`, admin.token, { slaObjetivoMinutos: minutos, umbralAmbarPorcentaje: umbral });

    // Umbral fuera de rango (HU037 Esc. 3)
    for (const umbral of [0, 100]) {
      const r = await sla(delivery, delivery.slaObjetivoMinutos, umbral);
      check(`El umbral ámbar ${umbral} % se rechaza`, r.status === 400, `${r.status} ${r.data?.mensaje}`);
    }
    // SLA holgados para empezar en verde
    await sla(delivery, 30, 75);
    await sla(llevar, 30, 75);

    // --- D39: los tiempos de Salón se configuran solo en la pestaña Salón y se copian al canal
    const salonCanal = canales.find((c) => c.codigo === 'SALON');
    const rSlaSalon = await sla(salonCanal, 25, 80);
    check('D39 el SLA de Salón no se cambia desde Canales', rSlaSalon.status === 400 && /pestaña Salón/.test(rSlaSalon.data?.mensaje ?? ''), `${rSlaSalon.status} ${rSlaSalon.data?.mensaje}`);
    semaforoSalonOriginal = (await http('GET', '/salon/semaforo', admin.token)).data;
    // Amarillo al minuto para verlo dentro de la prueba; rojo lejos
    const rSem = await http('PUT', '/salon/semaforo', admin.token, { minutosAmarillo: 1, minutosRojo: 30 });
    const salonActualizado = (await http('GET', '/canales/todos', admin.token)).data.find((c) => c.codigo === 'SALON');
    check('D39 guardar el semáforo de Salón copia los tiempos al canal (SLA = rojo, ámbar = amarillo)', rSem.status === 200 && salonActualizado.slaObjetivoMinutos === 30 && salonActualizado.umbralAmbarMinutos === 1, `${rSem.status} ${salonActualizado.slaObjetivoMinutos}/${salonActualizado.umbralAmbarMinutos}`);

    const estaciones = (await http('GET', '/estaciones', admin.token)).data;
    const plancha = estaciones.find((e) => e.codigo === 'PLANCHA').id;
    const plato = (await http('GET', '/platos', admin.token)).data.find((p) => p.disponible && p.activo && p.estacionId === plancha);
    const cocPlancha = await login('login-pin', { username: 'cocinero1', pin: '5678', estacionId: plancha });
    await vaciarCola(plancha, cocPlancha);
    const crear = async (canalId, extra) => {
      const r = await http('POST', '/pedidos', mozo, { canalId, items: [{ platoId: plato.id, cantidad: 1 }], ...extra });
      if (r.status !== 201) throw new Error(`pedido: ${r.status} ${r.data?.mensaje}`);
      creados.push(r.data);
      return r.data;
    };
    // Mesa de salón para el pedido C (D39)
    const mesa = (await http('GET', '/mesas', mozo)).data.find((m) => !m.enAtencion);
    const abierta = await http('POST', `/mesas/${mesa.id}/atencion`, mozo, { personas: 2 });
    if (abierta.status !== 200 && abierta.status !== 201) throw new Error(`mesa: ${abierta.status} ${abierta.data?.mensaje}`);
    mesaAbierta = mesa.id;
    // Mismo momento de ingreso para los tres pedidos
    const [pA, pB, pC] = await Promise.all([
      crear(delivery.id, { clienteNombre: 'Ana Ruiz', clienteTelefono: '987654321', clienteDireccion: 'Jr. Lima 456' }),
      crear(llevar.id, { clienteNombre: 'Rosa Gil', clienteTelefono: '955555555' }),
      crear(salonCanal.id, { mesaId: mesa.id }),
    ]);

    const ctx = await browser.createBrowserContext();
    const cocina = await ctx.newPage();
    await cocina.setViewport({ width: 1440, height: 900 });
    cocina.on('pageerror', (e) => errors.push(e.message));
    await cocina.goto(`${BASE}/login`, { waitUntil: 'networkidle0' });
    await cocina.evaluate((t, u) => { localStorage.clear(); localStorage.setItem('kds_token', t); localStorage.setItem('kds_user', JSON.stringify(u)); }, admin.token, admin.user);
    await cocina.goto(`${BASE}/cocina`, { waitUntil: 'networkidle0' });
    await cocina.waitForSelector('select[aria-label="Estación"]', { timeout: 5000 });
    await cocina.select('select[aria-label="Estación"]', String(plancha));
    const semaforo = (page, codigo) => page.$eval(`article[data-pedido="${codigo}"]`, (a) => a.dataset.semaforo).catch(() => null);
    await esperar(cocina, (cs) => cs.every((c) => document.querySelector(`article[data-pedido="${c}"]`)), [pA.codigoCorrelativo, pB.codigoCorrelativo], 6000);
    check('Al ingresar, los dos pedidos están en verde', (await semaforo(cocina, pA.codigoCorrelativo)) === 'verde' && (await semaforo(cocina, pB.codigoCorrelativo)) === 'verde');

    // --- Esc.4 y 6: el administrador baja el SLA de Delivery a 1 min con ámbar desde el 1 %:
    // el pedido A pasa a ámbar solo, sin recargar, y el B (otro canal) sigue en verde (Esc. 2)
    const t0 = Date.now();
    await sla(delivery, 1, 1);
    const ambar = await esperar(cocina, (c) => document.querySelector(`article[data-pedido="${c}"]`)?.dataset.semaforo === 'ambar', pA.codigoCorrelativo, 4000);
    check('Esc.4/6 al cambiar el SLA el pedido pasa a ámbar sin recargar, en 2 s o menos', ambar && Date.now() - t0 <= 2500, `${Date.now() - t0} ms`);
    check('Esc.2 con el mismo tiempo, el pedido del otro canal sigue en verde', (await semaforo(cocina, pB.codigoCorrelativo)) === 'verde');
    const cronoA = await cocina.$eval(`article[data-pedido="${pA.codigoCorrelativo}"] [data-cronometro]`, (s) => s.className).catch(() => '');
    check('El cronómetro también toma el color ámbar', /tertiary/.test(cronoA), cronoA);
    await cocina.screenshot({ path: path.join(OUT, 'hu025_ambar_verde.png') });

    // --- Esc.1: al cruzar el SLA (1 min desde el ingreso) pasa a rojo por sí solo
    const restante = Math.max(0, 61000 - (Date.now() - new Date(pA.fechaEnvioCocina).getTime()));
    console.log(`INFO esperando ~${Math.ceil(restante / 1000)} s a que el pedido cruce el SLA de 1 minuto...`);
    const rojo = await esperar(cocina, (c) => document.querySelector(`article[data-pedido="${c}"]`)?.dataset.semaforo === 'rojo', pA.codigoCorrelativo, restante + 8000);
    check('Esc.1 al cruzar el SLA el pedido pasa de ámbar a rojo sin recargar', rojo);

    // --- D39: pasado 1 minuto, la tarjeta de salón y su mesa están en ámbar a la vez
    const tarjetaSalon = await esperar(cocina, (c) => document.querySelector(`article[data-pedido="${c}"]`)?.dataset.semaforo === 'ambar', pC.codigoCorrelativo, 4000);
    const vista = (await http('GET', '/salon', admin.token)).data;
    const mesaVista = vista.zonas.flatMap((z) => z.mesas).find((m) => m.id === mesa.id);
    check('D39 la tarjeta de salón y su mesa muestran el mismo color (ámbar / amarillo)', tarjetaSalon && mesaVista?.estado === 'AMARILLO', `tarjeta ${await semaforo(cocina, pC.codigoCorrelativo)} / mesa ${mesaVista?.estado}`);
    await cocina.screenshot({ path: path.join(OUT, 'hu025_rojo.png') });

    // --- Pase: los pedidos por entregar también muestran el semáforo
    await http('PATCH', `/items/${pA.items[0].id}/estado`, cocPlancha, { estadoActual: 'RECIBIDO', estadoDestino: 'EN_PREPARACION' });
    await http('PATCH', `/items/${pA.items[0].id}/estado`, cocPlancha, { estadoActual: 'EN_PREPARACION', estadoDestino: 'LISTO' });
    const pase = await ctx.newPage();
    await pase.setViewport({ width: 1440, height: 900 });
    pase.on('pageerror', (e) => errors.push(e.message));
    await pase.evaluateOnNewDocument((t, u) => { localStorage.setItem('kds_token', t); localStorage.setItem('kds_user', JSON.stringify(u)); }, exp.token, exp.user);
    await pase.goto(`${BASE}/pase`, { waitUntil: 'networkidle0' });
    await esperar(pase, (c) => !!document.querySelector(`article[data-pedido="${c}"]`), pA.codigoCorrelativo, 6000);
    check('El pase muestra el pedido por entregar en rojo', (await semaforo(pase, pA.codigoCorrelativo)) === 'rojo');

    // --- Esc.5: al despacharlo el pedido sale de la vista y su semáforo deja de correr
    const despacho = await http('PATCH', `/items/${pA.items[0].id}/estado`, exp.token, { estadoActual: 'LISTO', estadoDestino: 'DESPACHADO' });
    const salio = await esperar(pase, (c) => !document.querySelector(`article[data-pedido="${c}"]`), pA.codigoCorrelativo, 4000);
    const estadoFinal = (await http('GET', `/pedidos/${pA.id}`, admin.token)).data?.estado;
    check('Esc.5 el pedido despachado sale del pase y queda Despachado', despacho.status === 200 && salio && estadoFinal === 'DESPACHADO', `${despacho.status} ${estadoFinal}`);

    check('Sin errores de JavaScript en las páginas', errors.length === 0, errors.join(' | '));
  } catch (e) {
    check('Ejecución sin excepciones', false, e.message);
  } finally {
    try {
      for (const o of originales) {
        await http('PUT', `/canales/${o.id}/sla`, admin.token, { slaObjetivoMinutos: o.sla, umbralAmbarPorcentaje: o.umbral });
      }
      // D39: deja el semáforo de Salón como estaba (y con él, los tiempos del canal Salón)
      if (semaforoSalonOriginal) await http('PUT', '/salon/semaforo', admin.token, semaforoSalonOriginal);
      for (const p of creados) {
        const vigente = (await http('GET', `/pedidos/${p.id}`, admin.token)).data;
        await despacharItems(vigente?.items ?? p.items);
      }
      if (mesaAbierta) await cerrarMesa(mesaAbierta, mozo, admin.token);
    } catch (e) {
      console.warn(`Limpieza incompleta: ${e.message}`);
    }
    try {
      await restaurarDelivery();
    } catch (e) {
      console.warn(`No se pudo restaurar el canal Delivery: ${e.message}`);
    }
    await Promise.race([browser.close(), sleep(5000)]);
    const fallidas = results.filter((x) => !x.ok).length;
    console.log(`==== ${results.length - fallidas}/${results.length} comprobaciones OK`);
    process.exit(fallidas === 0 ? 0 : 1);
  }
})();
