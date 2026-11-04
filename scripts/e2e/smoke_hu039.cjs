// Smoke E2E HU039: el comandero es exclusivo del mozo (menú, ruta y API)
const path = require('path');
const FRONT = path.resolve(__dirname, '../../frontend');
const puppeteer = require(path.join(FRONT, 'node_modules/puppeteer-core'));
const { http, login, loginCompleto } = require('./lib.cjs');

const BASE = 'http://localhost:5173';

async function esperar(page, fn, arg, ms = 4000) {
  try {
    await page.waitForFunction(fn, { timeout: ms, polling: 100 }, arg);
    return true;
  } catch {
    return false;
  }
}

// Abre la app con la sesión del usuario ya guardada, como si acabara de iniciar sesión
async function abrirComo(browser, sesion, ruta) {
  const ctx = await browser.createBrowserContext();
  const page = await ctx.newPage();
  await page.setViewport({ width: 1280, height: 860 });
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle0' });
  await page.evaluate((t, u) => {
    localStorage.setItem('kds_token', t);
    localStorage.setItem('kds_user', JSON.stringify(u));
  }, sesion.token, sesion.user);
  await page.goto(`${BASE}${ruta}`, { waitUntil: 'networkidle0' });
  return page;
}

const enlaceComandero = () => Array.from(document.querySelectorAll('nav a')).some((a) => a.getAttribute('href') === '/comandero');

(async () => {
  const results = [];
  const check = (name, ok, detail = '') => results.push({ name, ok, detail });
  const browser = await puppeteer.launch({
    executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new',
  });
  const errors = [];

  try {
    const mozo = await loginCompleto('login-pin', { username: 'angie', pin: '1234' });
    const estaciones = (await http('GET', '/estaciones', mozo.token)).data;
    const platos = (await http('GET', '/platos', mozo.token)).data.filter((p) => p.disponible);
    const cocinero = await loginCompleto('login-pin', { username: 'cocinero1', pin: '5678', estacionId: estaciones[0].id });
    const expedidor = await loginCompleto('login-pin', { username: 'expedidor1', pin: '9012' });
    const admin = await loginCompleto('login-admin', { username: 'admin', password: 'admin123' });
    // Clave única: si algún intento rechazado hubiera creado el pedido, el envío del mozo devolvería 200 (reintento)
    const cuerpo = { claveIdempotencia: `cmd-hu039${Date.now()}`, canalId: 3, items: [{ platoId: platos[0].id, cantidad: 1 }] };

    // --- Escenario 3: la API rechaza a quien no es mozo y no crea el pedido
    for (const [rol, sesion] of [['cocinero', cocinero], ['expedidor', expedidor], ['admin', admin]]) {
      const r = await http('POST', '/pedidos', sesion.token, cuerpo);
      check(`HU039 Esc.3 el ${rol} no registra pedidos (403)`, r.status === 403, String(r.status));
    }

    // --- Escenario 4: el mozo sigue registrando pedidos
    const r = await http('POST', '/pedidos', mozo.token, cuerpo);
    check('HU039 Esc.3 y 4 los intentos rechazados no crearon el pedido y el mozo lo registra (201)', r.status === 201, String(r.status));

    // --- Escenarios 1 y 2: sin enlace en el menú y la ruta devuelve a su inicio
    for (const [rol, sesion, inicio] of [['cocinero', cocinero, '/cocina'], ['expedidor', expedidor, '/pase'], ['admin', admin, '/admin/platos']]) {
      const page = await abrirComo(browser, sesion, inicio);
      page.on('pageerror', (e) => errors.push(`${rol}: ${e.message}`));
      check(`HU039 Esc.1 el ${rol} no ve "Comandero" en el menú`, !(await page.evaluate(enlaceComandero)));
      await page.goto(`${BASE}/comandero`, { waitUntil: 'networkidle0' });
      check(`HU039 Esc.2 el ${rol} que abre /comandero vuelve a ${inicio}`, await esperar(page, (ruta) => location.pathname === ruta, inicio), page.url());
    }

    const pMozo = await abrirComo(browser, mozo, '/comandero');
    pMozo.on('pageerror', (e) => errors.push(`mozo: ${e.message}`));
    check('HU039 Esc.4 el mozo abre el comandero', await esperar(pMozo, () => location.pathname === '/comandero'), pMozo.url());
    check('HU039 Esc.4 el mozo ve "Comandero" en el menú', await esperar(pMozo, enlaceComandero));
    check('Sin errores de JavaScript', errors.length === 0, errors.join(' | '));
  } catch (e) {
    check('Ejecución sin excepciones', false, e.message);
  } finally {
    await browser.close();
    for (const r of results) console.log(`${r.ok ? 'OK  ' : 'FAIL'} ${r.name}${r.detail ? ` (${r.detail})` : ''}`);
    process.exit(results.every((r) => r.ok) ? 0 : 1);
  }
})();
