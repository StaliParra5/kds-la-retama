// Smoke E2E HU018: operar sin internet (API real + Chrome + Docker)
// Chrome bloquea todo pedido que no vaya a localhost, como si el router no tuviera salida a internet.
// Cubre: interfaz completa sin recursos externos (fuentes e íconos locales) en todas las vistas, ciclo
// comanda–cocina–despacho sin internet, estado de internet del servidor, y reinicio del servidor durante el
// servicio sin perder pedidos ni estados (las pantallas se reconectan solas).
// La caída y el retorno reales de internet (Esc. 2, 4 y 6) se prueban a mano apagando el Wi-Fi.
const path = require('path');
const { execSync } = require('child_process');
const FRONT = path.resolve(__dirname, '../../frontend');
const RAIZ = path.resolve(__dirname, '../..');
const puppeteer = require(path.join(FRONT, 'node_modules/puppeteer-core'));
const { sleep, http, login, loginCompleto, vaciarCola, despacharItems } = require('./lib.cjs');

const BASE = 'http://localhost:5173';
const OUT = process.env.E2E_OUT || require('os').tmpdir();
const LOCALES = new Set(['localhost', '127.0.0.1', '[::1]']);

setTimeout(() => {
  console.log('FAIL La prueba superó los 240 s y se canceló: revise la última línea OK impresa');
  process.exit(2);
}, 240000).unref();

async function esperar(page, fn, arg, ms = 4000) {
  try {
    await page.waitForFunction(fn, { timeout: ms, polling: 200 }, arg);
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
  const externos = [];
  const creados = [];
  let admin;

  // Abre una vista con todo lo externo bloqueado y anota cualquier intento de salir a internet
  const abrir = async (ruta, sesion, estacionId) => {
    const ctx = await browser.createBrowserContext();
    const page = await ctx.newPage();
    await page.setViewport({ width: 1440, height: 900 });
    page.on('pageerror', (e) => errors.push(e.message));
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      const url = new URL(req.url());
      if (url.protocol.startsWith('http') && !LOCALES.has(url.hostname)) {
        externos.push(`${ruta}: ${url.hostname}${url.pathname}`);
        req.abort();
      } else {
        req.continue();
      }
    });
    await page.goto(`${BASE}/login`, { waitUntil: 'networkidle0' });
    await page.evaluate((t, u) => { localStorage.clear(); localStorage.setItem('kds_token', t); localStorage.setItem('kds_user', JSON.stringify(u)); }, sesion.token, sesion.user);
    await page.goto(`${BASE}${ruta}`, { waitUntil: 'networkidle0' });
    if (estacionId) {
      await page.waitForSelector('select[aria-label="Estación"]', { timeout: 5000 });
      await page.select('select[aria-label="Estación"]', String(estacionId));
    }
    return page;
  };
  // Fuentes cargadas desde el propio servidor y los íconos dibujados como íconos (no como texto)
  const recursos = (page) => page.evaluate(async () => {
    await document.fonts.ready;
    const cargada = (familia) => Array.from(document.fonts).some((f) => f.family.replace(/"/g, '') === familia && f.status === 'loaded');
    const icono = document.querySelector('.material-symbols-outlined');
    return {
      iconos: cargada('Material Symbols Outlined'),
      inter: cargada('Inter'),
      jakarta: cargada('Plus Jakarta Sans'),
      anchoIcono: icono ? Math.round(icono.getBoundingClientRect().width) : null,
    };
  });

  try {
    admin = await loginCompleto('login-admin', { username: 'admin', password: 'admin123' });
    const exp = await loginCompleto('login-pin', { username: 'expedidor1', pin: '9012' });
    const mozoSesion = await loginCompleto('login-pin', { username: 'angie', pin: '1234' });
    const mozo = mozoSesion.token;
    const estaciones = (await http('GET', '/estaciones', admin.token)).data;
    const plancha = estaciones.find((e) => e.codigo === 'PLANCHA').id;
    const plato = (await http('GET', '/platos', mozo)).data.find((p) => p.disponible && p.activo && p.estacionId === plancha);
    const llevar = (await http('GET', '/canales', mozo)).data.find((c) => c.codigo === 'PARA_LLEVAR').id;
    const cocPlancha = await login('login-pin', { username: 'cocinero1', pin: '5678', estacionId: plancha });
    await vaciarCola(plancha, cocPlancha);

    // --- Esc.3: cada vista abre completa sin internet
    const cocina = await abrir('/cocina', admin, plancha);
    const pase = await abrir('/pase', exp);
    const comandero = await abrir('/comandero', mozoSesion);
    const externo = await abrir('/pase/externo', exp);
    const canalesAdm = await abrir('/admin/canales', admin);
    for (const [nombre, page] of [['estación', cocina], ['pase', pase], ['comandero', comandero], ['pedido externo', externo], ['canales', canalesAdm]]) {
      const r = await recursos(page);
      check(`Esc.3 ${nombre}: fuentes e íconos cargados desde el servidor local`, r.iconos && r.inter && r.jakarta && r.anchoIcono !== null && r.anchoIcono <= 40, JSON.stringify(r));
    }
    check('Esc.3 ninguna vista intentó cargar recursos de internet', externos.length === 0, externos.slice(0, 5).join(' | '));
    await cocina.screenshot({ path: path.join(OUT, 'hu018_sin_internet.png') });

    // --- Esc.1: ciclo comanda–cocina–despacho con internet bloqueado en las pantallas
    const r = await http('POST', '/pedidos', mozo, { canalId: llevar, clienteNombre: 'Sin Internet', clienteTelefono: '955555555', items: [{ platoId: plato.id, cantidad: 1 }] });
    creados.push(r.data);
    const itemId = r.data.items[0].id;
    const fila = `li[data-item="${itemId}"]`;
    const llega = await esperar(cocina, (s) => !!document.querySelector(s), fila, 4000);
    await cocina.evaluate((s) => document.querySelector(`${s} > button`)?.click(), fila);
    const enPrep = await esperar(cocina, (s) => document.querySelector(s)?.dataset.estado === 'EN_PREPARACION', fila, 4000);
    check('Esc.1 el pedido llega a cocina y el cocinero lo inicia sin internet', llega && enPrep);

    // --- Esc.4: el servidor informa su salida a internet (null mientras no comprueba)
    const sistema = (await http('GET', '/sistema/estado', mozo)).data;
    check('Esc.4 el servidor informa si tiene internet', sistema && (sistema.internet === true || sistema.internet === false || sistema.internet === null), JSON.stringify(sistema));
    const insignia = !!(await cocina.$('[data-internet="sin-internet"]'));
    check('Esc.4 el aviso "Sin internet" coincide con el estado del servidor', insignia === (sistema.internet === false), `servidor ${sistema.internet} / aviso ${insignia}`);

    // --- Esc.5: el servidor se reinicia durante el servicio
    console.log('INFO reiniciando el contenedor del servidor (docker compose restart backend)...');
    execSync('docker compose -f compose.local.yml restart backend', { cwd: RAIZ, stdio: 'ignore' });
    let vuelve = false;
    const t0 = Date.now();
    while (Date.now() - t0 < 120000) {
      try {
        const ping = await http('GET', '/canales', mozo);
        if (ping.status === 200) { vuelve = true; break; }
      } catch { /* aún arrancando */ }
      await sleep(2000);
    }
    check('El servidor vuelve a responder después del reinicio', vuelve, `${Math.round((Date.now() - t0) / 1000)} s`);
    const pedido = (await http('GET', `/pedidos/${r.data.id}`, admin.token)).data;
    check('Esc.5 el pedido y su estado se conservan tras el reinicio', pedido?.items?.[0]?.estadoItem === 'EN_PREPARACION', pedido?.items?.[0]?.estadoItem);
    const reconecta = await esperar(cocina, () => !!document.querySelector('[data-conexion="en-vivo"]'), null, 30000);
    const sigue = await esperar(cocina, (s) => document.querySelector(s)?.dataset.estado === 'EN_PREPARACION', fila, 5000);
    check('Esc.5 la estación se reconecta sola y sigue mostrando el ítem en preparación', reconecta && sigue);

    // Termina el ciclo después del reinicio: listo y despacho
    await cocina.evaluate((s) => document.querySelector(`${s} > button`)?.click(), fila);
    const listo = await esperar(cocina, (s) => document.querySelector(s)?.dataset.estado === 'LISTO', fila, 5000);
    const despacho = await http('PATCH', `/items/${itemId}/estado`, exp.token, { estadoActual: 'LISTO', estadoDestino: 'DESPACHADO' });
    check('Esc.1/5 el ciclo termina (listo y despachado) después del reinicio', listo && despacho.status === 200, `${listo} ${despacho.status}`);

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
