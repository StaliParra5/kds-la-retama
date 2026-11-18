// Smoke E2E HU017: el tablero se actualiza solo (WebSocket real, dos PCs en la misma estación y otra estación)
// Cubre: pedido nuevo <= 2 s, cambio de estado en varias pantallas, despacho reflejado sin esperar,
// la estación ajena no se entera (ni siquiera recarga) y varias pantallas de una misma estación.
// Esc. 4 (anulación) usa el endpoint de HU032: el mozo anula un ítem en preparación y desaparece de las dos PCs.
const path = require('path');
const FRONT = path.resolve(__dirname, '../../frontend');
const puppeteer = require(path.join(FRONT, 'node_modules/puppeteer-core'));
const { sleep, http, login, loginCompleto, activarCanal, vaciarCola, despacharItems } = require('./lib.cjs');

const BASE = 'http://localhost:5173';
const OUT = process.env.E2E_OUT || require('os').tmpdir();
const LIMITE_MS = 2000;

// Una pantalla en segundo plano no dibuja: page.click() (que espera a que el elemento sea visible) y
// page.screenshot() se quedan esperando para siempre. Por eso el clic se hace desde el propio DOM y la
// captura trae la pestaña al frente con un plazo, para que la prueba nunca se cuelgue.
const clic = (page, selector) => page.evaluate((s) => document.querySelector(s)?.click(), selector);
async function foto(page, nombre) {
  try {
    await page.bringToFront();
    await Promise.race([page.screenshot({ path: path.join(OUT, nombre) }), sleep(5000)]);
  } catch {
    // la captura es solo evidencia: no debe fallar la prueba
  }
}

// Plazo máximo de toda la prueba: si algo se cuelga, termina e indica dónde quedó (ver las líneas impresas)
setTimeout(() => {
  console.log('FAIL La prueba superó los 150 s y se canceló: revise la última línea OK impresa');
  process.exit(2);
}, 150000).unref();

async function esperar(page, fn, arg, ms = 3000) {
  try {
    await page.waitForFunction(fn, { timeout: ms, polling: 50 }, arg);
    return true;
  } catch {
    return false;
  }
}

// Milisegundos hasta que la condición se cumple en la página (o null si vence el plazo)
async function tardanza(page, fn, arg, ms = 4000) {
  const t0 = Date.now();
  return (await esperar(page, fn, arg, ms)) ? Date.now() - t0 : null;
}

(async () => {
  const results = [];
  // Cada resultado se imprime al momento para ver hasta dónde llegó la prueba
  const check = (name, ok, detail = '') => {
    results.push({ name, ok, detail });
    console.log(`${ok ? 'OK  ' : 'FAIL'} ${name}${detail ? ` (${detail})` : ''}`);
  };
  const browser = await puppeteer.launch({
    executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new',
    // Varias pantallas abiertas a la vez: sin esto Chrome frena los temporizadores de las que quedan atrás
    args: ['--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows'],
  });
  const errors = [];
  const creados = [];

  let restaurarDelivery = async () => {};
  try {
    // El canal Delivery puede estar inactivo en el entorno: la prueba lo activa y al final lo deja como estaba
    restaurarDelivery = await activarCanal('DELIVERY');
    const mozo = await login('login-pin', { username: 'angie', pin: '1234' });
    const admin = await loginCompleto('login-admin', { username: 'admin', password: 'admin123' });
    const expedidor = await login('login-pin', { username: 'expedidor1', pin: '9012' });
    const canales = (await http('GET', '/canales', mozo)).data;
    const delivery = canales.find((c) => c.codigo === 'DELIVERY').id;
    const estaciones = (await http('GET', '/estaciones', mozo)).data;
    const id = (codigo) => estaciones.find((e) => e.codigo === codigo).id;
    const platos = (await http('GET', '/platos', mozo)).data.filter((p) => p.disponible);
    const platoPlancha = platos.find((p) => p.estacionId === id('PLANCHA'));
    const platoFrios = platos.find((p) => p.estacionId === id('FRIOS'));
    const cocPlancha = await login('login-pin', { username: 'cocinero1', pin: '5678', estacionId: id('PLANCHA') });
    const cocFrios = await login('login-pin', { username: 'cocinero1', pin: '5678', estacionId: id('FRIOS') });
    await vaciarCola(id('PLANCHA'), cocPlancha);
    await vaciarCola(id('FRIOS'), cocFrios);

    const crear = async (items) => {
      const r = await http('POST', '/pedidos', mozo, { canalId: delivery, items });
      if (r.status !== 201) throw new Error(`pedido: ${r.status} ${r.data?.mensaje}`);
      creados.push(r.data);
      return r.data;
    };

    // Tres pantallas: dos PCs de Plancha (A y B) y una de Fríos (C), todas como administrador
    const ctx = await browser.createBrowserContext();
    const abrir = async (estacionId) => {
      const page = await ctx.newPage();
      await page.setViewport({ width: 1440, height: 800 });
      page.on('pageerror', (e) => errors.push(e.message));
      page.cuentaCola = 0;
      page.on('request', (r) => { if (r.url().includes(`/estaciones/${estacionId}/cola`)) page.cuentaCola++; });
      await page.goto(`${BASE}/login`, { waitUntil: 'networkidle0' });
      await page.evaluate((t, u) => { localStorage.clear(); localStorage.setItem('kds_token', t); localStorage.setItem('kds_user', JSON.stringify(u)); }, admin.token, admin.user);
      await page.goto(`${BASE}/cocina`, { waitUntil: 'networkidle0' });
      await page.waitForSelector('select[aria-label="Estación"]', { timeout: 5000 });
      await page.select('select[aria-label="Estación"]', String(estacionId));
      await esperar(page, () => document.body.innerText.toUpperCase().includes('EN VIVO'), null, 5000);
      return page;
    };
    const A = await abrir(id('PLANCHA'));
    const B = await abrir(id('PLANCHA'));
    const C = await abrir(id('FRIOS'));
    check('Las tres pantallas se conectan en vivo', await esperar(A, () => document.body.innerText.toUpperCase().includes('EN VIVO'), null, 2000)
      && await esperar(B, () => document.body.innerText.toUpperCase().includes('EN VIVO'), null, 2000)
      && await esperar(C, () => document.body.innerText.toUpperCase().includes('EN VIVO'), null, 2000));
    const hay = (codigo) => (c) => !!document.querySelector(`article[data-pedido="${c}"]`);

    // --- Esc.1 y 6: pedido nuevo en <= 2 s, en las dos PCs de Plancha
    const p1 = await crear([{ platoId: platoPlancha.id, cantidad: 1 }]);
    const c1 = p1.codigoCorrelativo;
    const [msA, msB] = await Promise.all([tardanza(A, hay(), c1), tardanza(B, hay(), c1)]);
    check('Esc.1 el pedido nuevo aparece en pantalla en 2 s o menos', msA !== null && msA <= LIMITE_MS, `${msA} ms`);
    check('Esc.6 la segunda PC de Plancha también lo muestra en 2 s o menos', msB !== null && msB <= LIMITE_MS, `${msB} ms`);

    // --- Esc.5: un pedido solo de Fríos no toca a Plancha (ni siquiera la hace recargar su cola)
    const antesA = A.cuentaCola;
    const antesB = B.cuentaCola;
    const p2 = await crear([{ platoId: platoFrios.id, cantidad: 1 }]);
    const llegoAFrios = await tardanza(C, hay(), p2.codigoCorrelativo);
    check('Esc.5 la estación de Fríos recibe su pedido en 2 s o menos', llegoAFrios !== null && llegoAFrios <= LIMITE_MS, `${llegoAFrios} ms`);
    await sleep(1500);
    check('Esc.5 la pantalla de Plancha no se modifica', await A.evaluate((c) => !document.querySelector(`article[data-pedido="${c}"]`), p2.codigoCorrelativo));
    check('Esc.5 la pantalla de Plancha ni siquiera recarga su cola', A.cuentaCola === antesA && B.cuentaCola === antesB, `${A.cuentaCola - antesA}/${B.cuentaCola - antesB} recargas`);

    // --- Esc.2 y 6: un cocinero toca el ítem en la PC A y la PC B lo ve cambiar en <= 2 s
    const item1 = p1.items[0].id;
    await clic(A, `li[data-item="${item1}"] button`);
    const msEstado = await tardanza(B, (i) => document.querySelector(`li[data-item="${i}"]`)?.dataset.estado === 'EN_PREPARACION', item1);
    check('Esc.6 el ítem iniciado en una PC cambia en la otra en 2 s o menos', msEstado !== null && msEstado <= LIMITE_MS, `${msEstado} ms`);

    // Esc.2: cambio hecho por la API (otro usuario) se refleja en todas las pantallas sin intervención
    const r = await http('PATCH', `/items/${item1}/estado`, cocPlancha, { estadoActual: 'EN_PREPARACION', estadoDestino: 'LISTO' });
    check('El cambio por API se acepta', r.status === 200, String(r.status));
    const [listoA, listoB] = await Promise.all([
      tardanza(A, (i) => ['LISTO', undefined].includes(document.querySelector(`li[data-item="${i}"]`)?.dataset.estado), item1),
      tardanza(B, (i) => !document.querySelector(`li[data-item="${i}"]`), item1),
    ]);
    check('Esc.2 el ítem Listo se refleja en las dos pantallas en 2 s o menos', listoA !== null && listoA <= LIMITE_MS && listoB !== null && listoB <= LIMITE_MS, `${listoA}/${listoB} ms`);

    // --- Esc.3: el despacho del expedidor saca el pedido de la pantalla sin esperar los segundos de "recién listo"
    const p3 = await crear([{ platoId: platoPlancha.id, cantidad: 1 }]);
    const item3 = p3.items[0].id;
    await esperar(A, hay(), p3.codigoCorrelativo);
    await clic(A, `li[data-item="${item3}"] button`); // En preparación
    await esperar(A, (i) => document.querySelector(`li[data-item="${i}"]`)?.dataset.estado === 'EN_PREPARACION', item3);
    await sleep(400);
    await clic(A, `li[data-item="${item3}"] button`); // Listo (queda visible unos segundos en esta PC)
    for (let i = 0; i < 20; i++) {
      const listos = (await http('GET', '/items/listos', expedidor)).data;
      if (listos.some((x) => x.id === item3)) break;
      await sleep(100);
    }
    const despacho = await http('PATCH', `/items/${item3}/estado`, expedidor, { estadoActual: 'LISTO', estadoDestino: 'DESPACHADO' });
    check('El expedidor despacha el ítem', despacho.status === 200, String(despacho.status));
    const msDespacho = await tardanza(A, (c) => !document.querySelector(`article[data-pedido="${c}"]`), p3.codigoCorrelativo);
    check('Esc.3 el pedido despachado desaparece de la estación en 2 s o menos', msDespacho !== null && msDespacho <= LIMITE_MS, `${msDespacho} ms`);
    await foto(A, 'hu017_plancha.png');
    await foto(C, 'hu017_frios.png');

    // --- Esc.4: el mozo anula un ítem en preparación y se retira de las dos PCs de la estación en <= 2 s
    const p4 = await crear([{ platoId: platoPlancha.id, cantidad: 1 }]);
    const item4 = p4.items[0].id;
    await Promise.all([esperar(A, hay(), p4.codigoCorrelativo), esperar(B, hay(), p4.codigoCorrelativo)]);
    const inicio4 = await http('PATCH', `/items/${item4}/estado`, cocPlancha, { estadoActual: 'RECIBIDO', estadoDestino: 'EN_PREPARACION' });
    check('El cocinero inicia el ítem que luego se anulará', inicio4.status === 200, String(inicio4.status));
    await esperar(A, (i) => document.querySelector(`li[data-item="${i}"]`)?.dataset.estado === 'EN_PREPARACION', item4);
    // D36: el ítem ya está en preparación, así que la anulación lleva la autorización del administrador
    const anulacion = await http('POST', `/items/${item4}/anulacion`, mozo, { estadoActual: 'EN_PREPARACION', motivo: 'DEMORA_EXCESIVA', autorizacion: { usuario: 'admin', password: 'admin123' } });
    check('El mozo anula el ítem en preparación', anulacion.status === 200, String(anulacion.status));
    const [msAnulA, msAnulB] = await Promise.all([
      tardanza(A, (c) => !document.querySelector(`article[data-pedido="${c}"]`), p4.codigoCorrelativo),
      tardanza(B, (c) => !document.querySelector(`article[data-pedido="${c}"]`), p4.codigoCorrelativo),
    ]);
    check('Esc.4 el ítem anulado se retira de las dos pantallas de la estación en 2 s o menos', msAnulA !== null && msAnulA <= LIMITE_MS && msAnulB !== null && msAnulB <= LIMITE_MS, `${msAnulA}/${msAnulB} ms`);

    check('Sin errores de JavaScript en las páginas', errors.length === 0, errors.join(' | '));
  } catch (e) {
    check('Ejecución sin excepciones', false, e.message);
  } finally {
    try {
      for (const p of creados) await despacharItems(p.items);
    } catch (e) {
      console.warn(`Limpieza incompleta: ${e.message}`);
    }
    try {
      await restaurarDelivery();
    } catch (e) {
      console.warn(`No se pudo restaurar el canal Delivery: ${e.message}`);
    }
    await Promise.race([browser.close(), sleep(5000)]);
    const fallidas = results.filter((r) => !r.ok).length;
    console.log(`==== ${results.length - fallidas}/${results.length} comprobaciones OK`);
    process.exit(fallidas === 0 ? 0 : 1);
  }
})();
