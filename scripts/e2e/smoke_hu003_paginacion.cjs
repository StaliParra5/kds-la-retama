// Smoke E2E HU003: el catálogo de platos del administrador se muestra paginado de 10 en 10
const path = require('path');
const FRONT = path.resolve(__dirname, '../../frontend');
const puppeteer = require(path.join(FRONT, 'node_modules/puppeteer-core'));
const { http, loginCompleto } = require('./lib.cjs');

const BASE = 'http://localhost:5173';
const POR_PAGINA = 10;

async function esperar(page, fn, arg, ms = 4000) {
  try {
    await page.waitForFunction(fn, { timeout: ms, polling: 100 }, arg);
    return true;
  } catch {
    return false;
  }
}

const filas = () => document.querySelectorAll('tbody tr').length;
const resumen = () => document.querySelector('[data-paginacion-resumen]')?.textContent.replace(/\s+/g, ' ').trim() ?? '';
const primerCodigo = () => document.querySelector('tbody tr td')?.textContent.trim() ?? '';

(async () => {
  const results = [];
  const check = (name, ok, detail = '') => results.push({ name, ok, detail });
  const browser = await puppeteer.launch({
    executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new',
  });
  const errors = [];

  try {
    const admin = await loginCompleto('login-admin', { username: 'admin', password: 'admin123' });
    const total = (await http('GET', '/platos', admin.token)).data.length;
    check(`Hay más de ${POR_PAGINA} platos para paginar`, total > POR_PAGINA, String(total));
    const paginas = Math.ceil(total / POR_PAGINA);

    const page = await (await browser.createBrowserContext()).newPage();
    page.on('pageerror', (e) => errors.push(e.message));
    await page.setViewport({ width: 1280, height: 900 });
    await page.goto(`${BASE}/login`, { waitUntil: 'networkidle0' });
    await page.evaluate((t, u) => {
      localStorage.setItem('kds_token', t);
      localStorage.setItem('kds_user', JSON.stringify(u));
    }, admin.token, admin.user);
    await page.goto(`${BASE}/admin/platos`, { waitUntil: 'networkidle0' });

    check('La primera página muestra 10 platos', await esperar(page, (n) => document.querySelectorAll('tbody tr').length === n, POR_PAGINA), String(await page.evaluate(filas)));
    check('El resumen indica el rango y el total', (await page.evaluate(resumen)) === `Mostrando 1–${POR_PAGINA} de ${total} platos`, await page.evaluate(resumen));
    const botones = await page.$$eval('button[data-pagina]', (bs) => bs.map((b) => Number(b.dataset.pagina)));
    check('El paginador ofrece la primera y la última página', botones[0] === 1 && botones[botones.length - 1] === paginas, botones.join(','));
    check('"Anterior" está deshabilitado en la primera página', await page.$eval('button[aria-label="Página anterior"]', (b) => b.disabled));

    const primeroP1 = await page.evaluate(primerCodigo);
    await page.$eval('button[aria-label="Página siguiente"]', (b) => b.click());
    check('"Siguiente" muestra otros platos', await esperar(page, (c) => document.querySelector('tbody tr td')?.textContent.trim() !== c, primeroP1));
    check('El resumen avanza a la segunda página', (await page.evaluate(resumen)).startsWith(`Mostrando ${POR_PAGINA + 1}–`), await page.evaluate(resumen));

    await page.$eval(`button[data-pagina="${paginas}"]`, (b) => b.click());
    const enUltima = total - (paginas - 1) * POR_PAGINA;
    check('La última página muestra el resto', await esperar(page, (n) => document.querySelectorAll('tbody tr').length === n, enUltima), String(await page.evaluate(filas)));
    check('"Siguiente" está deshabilitado en la última página', await page.$eval('button[aria-label="Página siguiente"]', (b) => b.disabled));

    // Un filtro nuevo vuelve a la primera página
    await page.type('input[placeholder="Buscar por nombre o código..."]', 'a');
    check('Al filtrar se vuelve a la primera página', await esperar(page, () => /^Mostrando 1–/.test(document.querySelector('[data-paginacion-resumen]')?.textContent.replace(/\s+/g, ' ').trim() ?? '')), await page.evaluate(resumen));
    check('Sin errores de JavaScript', errors.length === 0, errors.join(' | '));
  } catch (e) {
    check('Ejecución sin excepciones', false, e.message);
  } finally {
    await browser.close();
    for (const r of results) console.log(`${r.ok ? 'OK  ' : 'FAIL'} ${r.name}${r.detail ? ` (${r.detail})` : ''}`);
    process.exit(results.every((r) => r.ok) ? 0 : 1);
  }
})();
