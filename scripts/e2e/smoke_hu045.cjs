// Smoke E2E HU045: datos del cliente para llevar (nombre y celular) antes del comandero
const path = require('path');
const FRONT = path.resolve(__dirname, '../../frontend');
const puppeteer = require(path.join(FRONT, 'node_modules/puppeteer-core'));
const { http, login, loginCompleto, crearMozo } = require('./lib.cjs');

const BASE = 'http://localhost:5173';

async function esperar(page, fn, arg, ms = 5000) {
  try {
    await page.waitForFunction(fn, { timeout: ms, polling: 100 }, arg);
    return true;
  } catch {
    return false;
  }
}

(async () => {
  const results = [];
  const check = (name, ok, detail = '') => results.push({ name, ok, detail });
  const browser = await puppeteer.launch({
    executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new',
  });
  const errors = [];

  try {
    const A = (await loginCompleto('login-admin', { username: 'admin', password: 'admin123' })).token;
    const sufijo = String(Date.now()).slice(-6);
    // HU045 Escenario 5: un mozo sin zonas asignadas
    const mozo = await crearMozo(A, { username: `llevar${sufijo}`, nombre: 'Lía', apellido: 'Vega' });
    const sesion = await loginCompleto('login-pin', { username: mozo.username, pin: mozo.pin });
    const T = sesion.token;
    const canales = (await http('GET', '/canales', T)).data;
    const llevar = canales.find((c) => c.codigo === 'PARA_LLEVAR');
    const delivery = canales.find((c) => c.codigo === 'DELIVERY');
    const plato = (await http('GET', '/platos', T)).data.find((p) => p.disponible);
    const pedir = (extra) => http('POST', '/pedidos', T, { canalId: llevar.id, items: [{ platoId: plato.id, cantidad: 1 }], ...extra });

    // --- Escenario 4: validación en el servidor
    const sinNombre = await pedir({ clienteTelefono: '987654321' });
    check('HU045 Esc.4 sin nombre se rechaza indicando el dato (400)', sinNombre.status === 400 && sinNombre.data.mensaje.includes('nombre'), `${sinNombre.status} ${sinNombre.data?.mensaje}`);
    for (const celular of ['98765432', '887654321', '9876543210']) {
      const r = await pedir({ clienteNombre: 'Ana', clienteTelefono: celular });
      check(`HU045 Esc.2/4 celular ${celular} no válido (400)`, r.status === 400 && r.data.mensaje.includes('celular'), `${r.status}`);
    }

    // --- Escenarios 3 y 5: datos válidos, mozo sin zonas
    const ok = await pedir({ clienteNombre: ' Ana Ruiz ', clienteTelefono: '987654321' });
    check('HU045 Esc.5 un mozo sin zonas registra el pedido para llevar (201)', ok.status === 201, `${ok.status} ${ok.data?.mensaje}`);
    check('HU045 Esc.3 el pedido guarda nombre y celular', ok.data.clienteNombre === 'Ana Ruiz' && ok.data.clienteTelefono === '987654321');
    const estacionId = ok.data.items[0].estacionId;
    const cocinero = await login('login-pin', { username: 'cocinero1', pin: '5678', estacionId });
    const cola = (await http('GET', `/estaciones/${estacionId}/cola`, cocinero)).data;
    check('HU045 Esc.3 cocina ve el nombre del cliente junto al pedido', cola.some((i) => i.pedidoId === ok.data.id && i.clienteNombre === 'Ana Ruiz'));
    check('HU045 / D20 delivery no exige datos del cliente (201)', (await http('POST', '/pedidos', T, { canalId: delivery.id, items: [{ platoId: plato.id, cantidad: 1 }] })).status === 201);

    // --- Pantalla
    const ctx = await browser.createBrowserContext();
    const page = await ctx.newPage();
    await page.setViewport({ width: 1366, height: 900 });
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(`${BASE}/login`, { waitUntil: 'networkidle0' });
    await page.evaluate((t, u) => { localStorage.setItem('kds_token', t); localStorage.setItem('kds_user', JSON.stringify(u)); }, sesion.token, sesion.user);
    await page.goto(`${BASE}/comandero`, { waitUntil: 'networkidle0' });
    await page.waitForSelector('[data-canal="PARA_LLEVAR"]');
    await page.$eval('[data-canal="PARA_LLEVAR"]', (b) => b.click());
    check('UI HU045 Esc.1 para llevar pide los datos del cliente y aún no muestra la carta', await esperar(page, () => !!document.querySelector('#cliente-nombre') && !document.querySelector('button[title="Agregar a la comanda"]')));

    const continuar = () => page.evaluate(() => Array.from(document.querySelectorAll('button')).find((b) => b.textContent.includes('Continuar a la carta')).click());
    await continuar();
    check('UI HU045 Esc.1 sin nombre no avanza', await esperar(page, () => document.querySelector('[role="alert"]')?.innerText.includes('nombre')));
    await page.type('#cliente-nombre', 'Rosa Paz');
    await page.type('#cliente-celular', '812345678');
    await continuar();
    check('UI HU045 Esc.2 celular inválido muestra el aviso', await esperar(page, () => document.querySelector('[role="alert"]')?.innerText.includes('celular no es válido')));
    await page.$eval('#cliente-celular', (i) => { i.value = ''; });
    await page.click('#cliente-celular', { clickCount: 3 });
    await page.keyboard.press('Backspace');
    await page.type('#cliente-celular', '912345678');
    await continuar();
    check('UI HU045 Esc.3 el comandero muestra al cliente en el encabezado', await esperar(page, () => document.querySelector('[data-destino]')?.innerText.includes('Rosa Paz')));
    await page.$eval('button[title="Agregar a la comanda"]', (b) => b.click());
    await page.evaluate(() => Array.from(document.querySelectorAll('button')).find((b) => b.textContent.includes('ENVIAR A COCINA')).click());
    check('UI HU045 Esc.3 el acuse muestra el nombre junto al código del pedido', await esperar(page, () => /CMD-\d{6}-\d{4} · Rosa Paz/.test(document.body.innerText)));
    check('UI HU045 tras enviar se vuelve a elegir destino: el siguiente pedido no hereda el cliente', await esperar(page, () => !!document.querySelector('[data-canal="PARA_LLEVAR"]')));
    check('Sin errores de JavaScript', errors.length === 0, errors.join(' | '));

    await http('PATCH', `/mozos/${mozo.id}/estado`, A, { activo: false });
  } catch (e) {
    check('Ejecución sin excepciones', false, e.message);
  } finally {
    await browser.close();
    for (const r of results) console.log(`${r.ok ? 'OK  ' : 'FAIL'} ${r.name}${r.detail ? ` (${r.detail})` : ''}`);
    process.exit(results.every((r) => r.ok) ? 0 : 1);
  }
})();
