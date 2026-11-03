// Smoke E2E HU008 + HU010: comandero (canales, líneas por modificador) y administración de canales
const path = require('path');
const FRONT = path.resolve(__dirname, '../../frontend');
const puppeteer = require(path.join(FRONT, 'node_modules/puppeteer-core'));

const BASE = 'http://localhost:5173';
const API = 'http://localhost:8080/api/v1';
const OUT = process.env.E2E_OUT || require('os').tmpdir();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function login(endpoint, body) {
  const res = await fetch(`${API}/auth/${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const d = await res.json();
  return {
    token: d.token,
    user: {
      id: d.usuarioId, username: d.username, nombreCompleto: d.nombreCompleto,
      rol: d.rol, estacionId: d.estacionId, estacionNombre: d.estacionNombre,
    },
  };
}

async function setSession(page, s) {
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle0' });
  await page.evaluate((t, u) => {
    localStorage.setItem('kds_token', t);
    localStorage.setItem('kds_user', JSON.stringify(u));
  }, s.token, s.user);
}

const clickByText = (page, text) =>
  page.evaluate((t) => {
    const b = Array.from(document.querySelectorAll('button')).find((x) => x.textContent.includes(t));
    if (b) b.click();
    return !!b;
  }, text);

(async () => {
  const results = [];
  const check = (name, ok, detail = '') => { results.push({ name, ok, detail }); };
  const browser = await puppeteer.launch({
    executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: 'new',
    args: ['--window-size=1600,1000'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1600, height: 1000 });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));

  try {
    // --- Comandero como mozo ---
    const mozo = await login('login-pin', { pin: '1234' });
    await setSession(page, mozo);
    await page.goto(`${BASE}/comandero`, { waitUntil: 'networkidle0' });
    await sleep(800);
    const canales = await page.evaluate(() => document.body.innerText);
    check('Comandero muestra "Delivery propio"', canales.includes('Delivery propio'));
    check('Salón seleccionado por defecto (selector de mesa visible)', canales.toUpperCase().includes('MESA:'));

    // Agregar el primer plato dos veces y ponerle modificador a la línea -> nueva línea
    const addButtons = await page.$$('button[title="Agregar a la comanda"]');
    await addButtons[0].click();
    await sleep(200);
    await clickByText(page, 'Sin cebolla');
    await sleep(200);
    await addButtons[0].click();
    await sleep(300);
    const lineas = await page.$$('input[placeholder^="Nota de cocina"]');
    check('HU008: mismo plato con modificador distinto genera 2 líneas', lineas.length === 2, `líneas=${lineas.length}`);
    await page.screenshot({ path: path.join(OUT, 'hu010_01_comandero.png') });

    // Cambiar a Delivery propio: el selector de mesa debe ocultarse
    await clickByText(page, 'Delivery propio');
    await sleep(300);
    const sinMesa = await page.evaluate(() => !document.body.innerText.toUpperCase().includes('MESA:'));
    check('HU010: en Delivery propio no se muestra selector de mesa', sinMesa);

    // Enviar comanda -> toast con canal
    await clickByText(page, 'ENVIAR A COCINA');
    await sleep(1200);
    const toast = await page.evaluate(() => document.body.innerText);
    check('HU010: aviso de éxito incluye el canal', /CMD-\d{6}-\d{4} \(Delivery propio\)/.test(toast));
    await page.screenshot({ path: path.join(OUT, 'hu010_02_enviada.png') });

    // --- Administración de canales ---
    const admin = await login('login-admin', { username: 'admin', password: 'admin123' });
    await setSession(page, admin);
    await page.goto(`${BASE}/admin/canales`, { waitUntil: 'networkidle0' });
    await sleep(800);
    const switches = await page.$$('button[role="switch"]');
    check('Admin ve interruptor por canal', switches.length === 3, `switches=${switches.length}`);
    await page.click('button[aria-label="Desactivar canal Para Llevar"]');
    await sleep(1000);
    const txt = await page.evaluate(() => document.body.innerText);
    check('Admin: canal desactivado muestra "Inactivo"', txt.toUpperCase().includes('INACTIVO'));
    await page.screenshot({ path: path.join(OUT, 'hu010_03_admin_inactivo.png') });

    // Comandero ya no ofrece el canal desactivado
    await setSession(page, mozo);
    await page.goto(`${BASE}/comandero`, { waitUntil: 'networkidle0' });
    await sleep(800);
    const sinParaLlevar = await page.evaluate(() =>
      !Array.from(document.querySelectorAll('button')).some((b) => b.textContent.includes('Para Llevar')));
    check('HU010: comandero no ofrece el canal inactivo', sinParaLlevar);

    // Reactivar para dejar el entorno como estaba
    await setSession(page, admin);
    await page.goto(`${BASE}/admin/canales`, { waitUntil: 'networkidle0' });
    await sleep(600);
    await page.click('button[aria-label="Activar canal Para Llevar"]');
    await sleep(800);
    const reactivado = await page.evaluate(() => !document.body.innerText.toUpperCase().includes('INACTIVO'));
    check('Admin: canal reactivado', reactivado);
  } catch (e) {
    check('Ejecución sin excepciones', false, e.message);
  } finally {
    check('Sin errores de JavaScript en la página', errors.length === 0, errors.join(' | '));
    await browser.close();
    for (const r of results) console.log(`${r.ok ? 'OK  ' : 'FAIL'} ${r.name}${r.detail ? ` (${r.detail})` : ''}`);
    process.exit(results.every((r) => r.ok) ? 0 : 1);
  }
})();
