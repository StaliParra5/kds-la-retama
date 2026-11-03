// Smoke E2E HU009: acuse de recibo y reintento sin duplicar cuando se pierde la respuesta del servidor
const path = require('path');
const FRONT = path.resolve(__dirname, '../../frontend');
const puppeteer = require(path.join(FRONT, 'node_modules/puppeteer-core'));

const BASE = 'http://localhost:5173';
const API = 'http://localhost:8080/api/v1';
const OUT = process.env.E2E_OUT || require('os').tmpdir();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function login(endpoint, body) {
  const res = await fetch(`${API}/auth/${endpoint}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  const d = await res.json();
  return { token: d.token, user: { id: d.usuarioId, username: d.username, nombreCompleto: d.nombreCompleto, rol: d.rol, estacionId: d.estacionId, estacionNombre: d.estacionNombre } };
}

const clickByText = (page, text) => page.evaluate((t) => {
  const b = Array.from(document.querySelectorAll('button')).find((x) => x.textContent.includes(t));
  if (b) b.click();
  return !!b;
}, text);

(async () => {
  const results = [];
  const check = (name, ok, detail = '') => results.push({ name, ok, detail });
  const browser = await puppeteer.launch({
    executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new', args: ['--window-size=1600,1000'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1600, height: 1000 });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));

  try {
    const mozo = await login('login-pin', { username: 'angie', pin: '1234' });
    await page.goto(`${BASE}/login`, { waitUntil: 'networkidle0' });
    await page.evaluate((t, u) => { localStorage.setItem('kds_token', t); localStorage.setItem('kds_user', JSON.stringify(u)); }, mozo.token, mozo.user);
    await page.goto(`${BASE}/comandero`, { waitUntil: 'networkidle0' });
    await sleep(800);
    await clickByText(page, 'Delivery propio');

    // --- Esc. 2: el servidor registra el pedido pero la respuesta se pierde en la red
    const clavesEnviadas = [];
    let perderRespuesta = true;
    let modo502 = false;
    await page.setRequestInterception(true);
    page.on('request', async (req) => {
      if (req.url().endsWith('/api/v1/pedidos') && req.method() === 'POST') {
        const body = JSON.parse(req.postData());
        clavesEnviadas.push(body.claveIdempotencia);
        if (perderRespuesta) {
          perderRespuesta = false;
          // El pedido llega al servidor (se reenvía desde Node), pero el navegador nunca recibe la respuesta
          await fetch(`${API}/pedidos`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: req.headers().authorization }, body: req.postData() });
          if (modo502) {
            modo502 = false;
            return req.respond({ status: 502, contentType: 'text/plain', body: 'Bad Gateway' });
          }
          return req.abort('connectionreset');
        }
      }
      return req.continue();
    });

    const add = await page.$$('button[title="Agregar a la comanda"]');
    await add[0].click();
    await sleep(200);
    await clickByText(page, 'ENVIAR A COCINA');
    await sleep(1500);
    let txt = await page.evaluate(() => document.body.innerText);
    check('Esc.2 sin respuesta: se indica que no hubo confirmación', txt.includes('Sin confirmación del servidor'));
    const bloqueado = await page.evaluate(() => document.querySelector('fieldset')?.disabled === true);
    check('Esc.2 la comanda queda bloqueada para edición', bloqueado);
    await page.screenshot({ path: path.join(OUT, 'hu009_01_sin_confirmacion.png') });

    await clickByText(page, 'Reintentar envío');
    await sleep(1500);
    txt = await page.evaluate(() => document.body.innerText);
    check('Esc.1 tras reintentar aparece el acuse de recibo', /Recibido por cocina · CMD-\d{6}-\d{4}/.test(txt));
    check('Esc.1 el acuse muestra la hora confirmada', /confirmado a las \d{2}:\d{2}:\d{2}/.test(txt));
    check('Esc.2 el reintento usó la misma clave', clavesEnviadas.length === 2 && clavesEnviadas[0] === clavesEnviadas[1], clavesEnviadas.join(' / '));
    await page.screenshot({ path: path.join(OUT, 'hu009_02_acuse.png') });

    // Verificación en la API: un solo pedido con esa clave
    const admin = await login('login-admin', { username: 'admin', password: 'admin123' });
    const activos = await (await fetch(`${API}/pedidos/activos`, { headers: { Authorization: `Bearer ${admin.token}` } })).json();
    const codigo = (txt.match(/Recibido por cocina · (CMD-\d{6}-\d{4})/) || [])[1];
    check('Esc.2 no se duplicó el pedido', activos.filter((p) => p.codigoCorrelativo === codigo).length === 1, codigo);


    // --- Revisión: un 502 del proxy (el pedido pudo registrarse) no descarta la clave, y
    //     "Editar comanda" consulta al servidor: si el envío llegó, muestra el acuse en vez de duplicar
    perderRespuesta = true;
    modo502 = true;
    const add2 = await page.$$('button[title="Agregar a la comanda"]');
    await add2[1].click();
    await sleep(200);
    await clickByText(page, 'ENVIAR A COCINA');
    await sleep(1500);
    txt = await page.evaluate(() => document.body.innerText);
    check('Revisión: un 502 deja el envío como sin confirmar', txt.includes('Sin confirmación del servidor'));
    check('Revisión: "Limpiar" queda deshabilitado sin confirmación', await page.evaluate(() =>
      Array.from(document.querySelectorAll('button')).find((b) => b.title === 'Limpiar todo el pedido')?.disabled === true));
    await clickByText(page, 'Editar comanda');
    await sleep(1500);
    txt = await page.evaluate(() => document.body.innerText);
    check('Revisión: "Editar comanda" detecta que el envío sí llegó y muestra el acuse', /Recibido por cocina · CMD-\d{6}-\d{4}/.test(txt) && txt.includes('Comanda vacía'));
    await page.screenshot({ path: path.join(OUT, 'hu009_03_editar_resuelto.png') });

    // Esc.3: comanda vacía -> botón deshabilitado y mensaje
    const vacio = await page.evaluate(() => {
      const b = Array.from(document.querySelectorAll('button')).find((x) => x.textContent.includes('ENVIAR A COCINA'));
      return b.disabled && document.body.innerText.includes('Comanda vacía');
    });
    check('Esc.3 comanda vacía no se puede enviar e indica agregar platos', vacio);
  } catch (e) {
    check('Ejecución sin excepciones', false, e.message);
  } finally {
    check('Sin errores de JavaScript en la página', errors.length === 0, errors.join(' | '));
    await browser.close();
    for (const r of results) console.log(`${r.ok ? 'OK  ' : 'FAIL'} ${r.name}${r.detail ? ` (${r.detail})` : ''}`);
    process.exit(results.every((r) => r.ok) ? 0 : 1);
  }
})();
