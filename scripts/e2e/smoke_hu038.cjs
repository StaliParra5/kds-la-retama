// Smoke E2E HU038: indicador de conexión y reconexión automática (API real + Chrome)
// Simula el corte de red de cada pantalla con el modo sin conexión de Chrome. Cubre: aviso "Sin conexión" en
// menos de 5 s, reintentos y reconexión sola con el estado completo (incluye un pedido enviado durante el corte),
// cocina sin poder cambiar estados durante el corte, mismo aviso en comandero, estación y pase, y "Conectado"
// al volver.
const path = require('path');
const FRONT = path.resolve(__dirname, '../../frontend');
const puppeteer = require(path.join(FRONT, 'node_modules/puppeteer-core'));
const { sleep, http, login, loginCompleto, vaciarCola, despacharItems } = require('./lib.cjs');

const BASE = 'http://localhost:5173';
const OUT = process.env.E2E_OUT || require('os').tmpdir();

setTimeout(() => {
  console.log('FAIL La prueba superó los 120 s y se canceló: revise la última línea OK impresa');
  process.exit(2);
}, 120000).unref();

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
  let admin;

  try {
    admin = await loginCompleto('login-admin', { username: 'admin', password: 'admin123' });
    const exp = await loginCompleto('login-pin', { username: 'expedidor1', pin: '9012' });
    const mozoSesion = await loginCompleto('login-pin', { username: 'angie', pin: '1234' });
    const mozo = mozoSesion.token;
    const canales = (await http('GET', '/canales', mozo)).data;
    const llevar = canales.find((c) => c.codigo === 'PARA_LLEVAR').id;
    const estaciones = (await http('GET', '/estaciones', admin.token)).data;
    const plancha = estaciones.find((e) => e.codigo === 'PLANCHA').id;
    const plato = (await http('GET', '/platos', mozo)).data.find((p) => p.disponible && p.activo && p.estacionId === plancha);
    const cocPlancha = await login('login-pin', { username: 'cocinero1', pin: '5678', estacionId: plancha });
    await vaciarCola(plancha, cocPlancha);
    const crear = async (nombre) => {
      const r = await http('POST', '/pedidos', mozo, { canalId: llevar, clienteNombre: nombre, clienteTelefono: '955555555', items: [{ platoId: plato.id, cantidad: 1 }] });
      if (r.status !== 201) throw new Error(`pedido: ${r.status} ${r.data?.mensaje}`);
      creados.push(r.data);
      return r.data;
    };
    const p1 = await crear('Antes del corte');

    const abrir = async (ruta, sesion, estacionId) => {
      const ctx = await browser.createBrowserContext();
      const page = await ctx.newPage();
      await page.setViewport({ width: 1440, height: 900 });
      page.on('pageerror', (e) => errors.push(e.message));
      await page.goto(`${BASE}/login`, { waitUntil: 'networkidle0' });
      await page.evaluate((t, u) => { localStorage.clear(); localStorage.setItem('kds_token', t); localStorage.setItem('kds_user', JSON.stringify(u)); }, sesion.token, sesion.user);
      await page.goto(`${BASE}${ruta}`, { waitUntil: 'networkidle0' });
      if (estacionId) {
        await page.waitForSelector('select[aria-label="Estación"]', { timeout: 5000 });
        await page.select('select[aria-label="Estación"]', String(estacionId));
      }
      return page;
    };
    const cocina = await abrir('/cocina', admin, plancha);
    const pase = await abrir('/pase', exp);
    const comandero = await abrir('/comandero', mozoSesion);
    const fila1 = `li[data-item="${p1.items[0].id}"]`;
    await esperar(cocina, (s) => !!document.querySelector(s), fila1, 6000);
    // Deja pasar la gracia inicial del aviso
    await sleep(4500);
    check('Conectadas, las tres vistas muestran "En vivo"', !!(await cocina.$('[data-conexion="en-vivo"]')) && !!(await pase.$('[data-conexion="en-vivo"]')) && !!(await comandero.$('[data-conexion="en-vivo"]')));

    // --- Esc.1 y 5: corte de red en las tres vistas
    const t0 = Date.now();
    await Promise.all([cocina.setOfflineMode(true), pase.setOfflineMode(true), comandero.setOfflineMode(true)]);
    const avisoCocina = await esperar(cocina, () => !!document.querySelector('[data-conexion="sin-conexion"]'), null, 6000);
    const msAviso = Date.now() - t0;
    check('Esc.1 la estación muestra "Sin conexión" en menos de 5 s', avisoCocina && msAviso < 5000, `${msAviso} ms`);
    const textoCocina = await cocina.$eval('[data-conexion="sin-conexion"]', (e) => e.innerText).catch(() => '');
    const avisoPase = await esperar(pase, () => !!document.querySelector('[data-conexion="sin-conexion"]'), null, 6000);
    const avisoComandero = await esperar(comandero, () => !!document.querySelector('[data-conexion="sin-conexion"]'), null, 6000);
    const textoPase = await pase.$eval('[data-conexion="sin-conexion"]', (e) => e.innerText).catch(() => '');
    const textoComandero = await comandero.$eval('[data-conexion="sin-conexion"]', (e) => e.innerText).catch(() => '');
    check('Esc.5 el pase y el comandero muestran el mismo aviso', avisoPase && avisoComandero && textoPase === textoCocina && textoComandero === textoCocina, textoCocina);
    await cocina.screenshot({ path: path.join(OUT, 'hu038_sin_conexion.png') });

    // --- Esc.4: en la estación, tocar un ítem no cambia su estado
    await cocina.evaluate((s) => document.querySelector(`${s} > button`)?.click(), fila1);
    await sleep(800);
    const estadoServidor = (await http('GET', `/estaciones/${plancha}/cola`, cocPlancha)).data.find((i) => i.id === p1.items[0].id)?.estado;
    const estadoPantalla = await cocina.$eval(fila1, (li) => li.dataset.estado);
    check('Esc.4 sin conexión el cocinero no cambia el estado (servidor y pantalla siguen en Recibido)', estadoServidor === 'RECIBIDO' && estadoPantalla === 'RECIBIDO', `${estadoServidor}/${estadoPantalla}`);

    // Un pedido llega mientras la estación está desconectada
    const p2 = await crear('Durante el corte');
    await sleep(2000);

    // --- Esc.2, 3 y 6: vuelve la red; se reconecta sola, recarga y muestra "Conectado"
    await Promise.all([cocina.setOfflineMode(false), pase.setOfflineMode(false), comandero.setOfflineMode(false)]);
    const t1 = Date.now();
    const conectado = await esperar(cocina, () => !!document.querySelector('[data-conexion="conectado"]'), null, 12000);
    check('Esc.3/6 se reconecta sola y muestra "Conectado"', conectado, `${Date.now() - t1} ms`);
    const llegaPedido = await esperar(cocina, (id) => !!document.querySelector(`li[data-item="${id}"]`), p2.items[0].id, 5000);
    check('Esc.2 al reconectar muestra el pedido recibido durante el corte', llegaPedido);
    const avisoSale = await esperar(cocina, () => !!document.querySelector('[data-conexion="en-vivo"]'), null, 6000);
    check('Esc.6 el aviso "Conectado" pasa solo a "En vivo"', avisoSale);
    await cocina.evaluate((s) => document.querySelector(`${s} > button`)?.click(), fila1);
    const cambia = await esperar(cocina, (s) => document.querySelector(s)?.dataset.estado === 'EN_PREPARACION', fila1, 4000);
    check('Con la conexión de vuelta el cocinero vuelve a cambiar estados', cambia);

    check('Sin errores de JavaScript en las páginas', errors.length === 0, errors.join(' | '));
  } catch (e) {
    check('Ejecución sin excepciones', false, e.message);
  } finally {
    try {
      for (const p of creados) {
        const vigente = (await http('GET', `/pedidos/${p.id}`, admin.token)).data;
        await despacharItems(vigente?.items ?? p.items);
      }
    } catch (e) {
      console.warn(`Limpieza incompleta: ${e.message}`);
    }
    await Promise.race([browser.close(), sleep(5000)]);
    const fallidas = results.filter((x) => !x.ok).length;
    console.log(`==== ${results.length - fallidas}/${results.length} comprobaciones OK`);
    process.exit(fallidas === 0 ? 0 : 1);
  }
})();
