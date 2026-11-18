// Smoke E2E HU014: cambiar el estado de un ítem con un toque desde la pantalla de cocina
const path = require('path');
const { execSync } = require('child_process');
const FRONT = path.resolve(__dirname, '../../frontend');
const puppeteer = require(path.join(FRONT, 'node_modules/puppeteer-core'));
const { sleep, http, login, loginCompleto, vaciarCola } = require('./lib.cjs');

const BASE = 'http://localhost:5173';
const OUT = process.env.E2E_OUT || require('os').tmpdir();
const sql = (q) => execSync(`docker exec kds-postgres psql -U kds_user -d kds_db -tAc "${q}"`).toString().trim();

async function esperar(page, fn, arg, ms = 3000) {
  try {
    await page.waitForFunction(fn, { timeout: ms, polling: 50 }, arg);
    return true;
  } catch {
    return false;
  }
}

const estadoEnPantalla = (page, itemId) => page.$eval(`li[data-item="${itemId}"]`, (li) => li.dataset.estado).catch(() => null);
const tocar = (page, itemId) => page.$eval(`li[data-item="${itemId}"] button`, (b) => b.click());
const textoVisible = (page, texto) => esperar(page, (t) => document.body.innerText.toUpperCase().includes(t.toUpperCase()), texto);

(async () => {
  const results = [];
  const check = (name, ok, detail = '') => results.push({ name, ok, detail });
  const browser = await puppeteer.launch({
    executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new',
  });
  const errors = [];

  try {
    const mozo = await login('login-pin', { username: 'angie', pin: '1234' });
    const estaciones = (await http('GET', '/estaciones', mozo)).data;
    const idFrios = estaciones.find((e) => e.codigo === 'FRIOS').id;
    const platosFrios = (await http('GET', '/platos', mozo)).data.filter((p) => p.disponible && p.estacionId === idFrios);
    const coc = await loginCompleto('login-pin', { username: 'cocinero1', pin: '5678', estacionId: idFrios });
    const estadoServidor = async (pedidoId, itemId) =>
      (await http('GET', `/pedidos/${pedidoId}`, mozo)).data.items.find((i) => i.id === itemId)?.estadoItem;

    await vaciarCola(idFrios, coc.token);
    const pedido = await http('POST', '/pedidos', mozo, { canalId: 3, items: [
      { platoId: platosFrios[0].id, cantidad: 1 }, { platoId: platosFrios[1].id, cantidad: 1 },
    ] });
    const [a, b] = pedido.data.items;
    const pedidoId = pedido.data.id;

    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 860 });
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(`${BASE}/login`, { waitUntil: 'networkidle0' });
    await page.evaluate((t, u) => { localStorage.clear(); localStorage.setItem('kds_token', t); localStorage.setItem('kds_user', JSON.stringify(u)); }, coc.token, coc.user);
    await page.goto(`${BASE}/cocina`, { waitUntil: 'networkidle0' });
    await page.waitForSelector(`li[data-item="${a.id}"]`, { timeout: 5000 });

    // --- Esc. 1 y 5: un toque inicia la preparación y la tarjeta cambia al instante
    const t0 = Date.now();
    await tocar(page, a.id);
    const instantaneo = await esperar(page, (id) => document.querySelector(`li[data-item="${id}"]`)?.dataset.estado === 'EN_PREPARACION', a.id, 200);
    check('Esc.5 la tarjeta cambia de color y etiqueta al instante (< 200 ms)', instantaneo, `${Date.now() - t0} ms`);
    await sleep(500);
    check('Esc.1 un toque deja el ítem En preparación en el servidor', (await estadoServidor(pedidoId, a.id)) === 'EN_PREPARACION');
    const etiqueta = await page.$eval(`li[data-item="${a.id}"]`, (li) => li.innerText.toUpperCase()).catch(() => '');
    check('Esc.5 la etiqueta muestra "En preparación"', etiqueta.includes('EN PREPARACIÓN'));
    check('Esc.1 sin menús intermedios (no se abre ningún diálogo)', !(await page.$('[role="dialog"]')));

    // --- Esc. 2: otro toque lo marca Listo
    await tocar(page, a.id);
    check('Esc.2 el segundo toque muestra Listo', await esperar(page, (id) => document.querySelector(`li[data-item="${id}"]`)?.dataset.estado === 'LISTO', a.id, 300));
    await sleep(400);
    check('Esc.2 el servidor registra Listo', (await estadoServidor(pedidoId, a.id)) === 'LISTO');
    await page.screenshot({ path: path.join(OUT, 'hu014_listo.png') });

    // --- Esc. 4: tocar un ítem Listo no cambia su estado; el despacho es del pase
    await tocar(page, a.id);
    check('Esc.4 tocar un ítem Listo avisa que el despacho se confirma en el pase', await textoVisible(page, 'el despacho se confirma desde el pase'));
    await sleep(300);
    check('Esc.4 el ítem sigue Listo', (await estadoServidor(pedidoId, a.id)) === 'LISTO');
    check('HU012 Esc.5 el ítem Listo sale de la cola tras unos segundos', await esperar(page, (id) => !document.querySelector(`li[data-item="${id}"]`), a.id, 7000));

    // --- Esc. 3: ítem En espera con hora de disparo futura pide confirmación
    await http('PATCH', `/items/${b.id}/estado`, coc.token, { estadoActual: 'RECIBIDO', estadoDestino: 'EN_ESPERA' });
    sql(`UPDATE detalles_pedido SET hora_disparo = NOW() + INTERVAL '20 minutes' WHERE id = ${b.id}`);
    const sinConfirmar = await http('PATCH', `/items/${b.id}/estado`, coc.token, { estadoActual: 'EN_ESPERA', estadoDestino: 'EN_PREPARACION' });
    check('Esc.3 el servidor exige confirmar el inicio anticipado (409 con código)', sinConfirmar.status === 409 && sinConfirmar.data.codigo === 'INICIO_ANTICIPADO_REQUERIDO', sinConfirmar.data?.mensaje);
    await page.reload({ waitUntil: 'networkidle0' });
    await page.waitForSelector(`li[data-item="${b.id}"]`, { timeout: 5000 });
    check('Esc.3 la tarjeta muestra En espera y la hora de disparo', (await estadoEnPantalla(page, b.id)) === 'EN_ESPERA' && (await textoVisible(page, 'Disparo a las')));
    await tocar(page, b.id);
    check('Esc.3 tocarlo abre la confirmación de inicio anticipado', await esperar(page, () => !!document.querySelector('[role="dialog"]')));
    await page.screenshot({ path: path.join(OUT, 'hu014_confirmacion.png') });
    await page.evaluate(() => Array.from(document.querySelectorAll('[role="dialog"] button')).find((x) => x.textContent.includes('Esperar')).click());
    await sleep(400);
    check('Esc.3 "Esperar" no cambia el estado', (await estadoServidor(pedidoId, b.id)) === 'EN_ESPERA' && !(await page.$('[role="dialog"]')));
    await tocar(page, b.id);
    await esperar(page, () => !!document.querySelector('[role="dialog"]'));
    await page.evaluate(() => Array.from(document.querySelectorAll('[role="dialog"] button')).find((x) => x.textContent.includes('Iniciar ahora')).click());
    await sleep(600);
    check('Esc.3 "Iniciar ahora" lo pasa a En preparación', (await estadoServidor(pedidoId, b.id)) === 'EN_PREPARACION' && (await estadoEnPantalla(page, b.id)) === 'EN_PREPARACION');

    // --- Esc. 6: el ítem se anula mientras la pantalla lo muestra (anulación simulada en BD, HU032 pendiente)
    sql(`UPDATE detalles_pedido SET estado_item = 'ANULADO' WHERE id = ${b.id}`);
    check('Esc.6 precondición: la pantalla aún muestra el ítem En preparación', (await estadoEnPantalla(page, b.id)) === 'EN_PREPARACION');
    await tocar(page, b.id);
    check('Esc.6 tocarlo indica que fue anulado', await textoVisible(page, 'fue anulado'));
    await sleep(500);
    check('Esc.6 el ítem no cambia de estado (sigue Anulado)', (await estadoServidor(pedidoId, b.id)) === 'ANULADO');
    check('Esc.6 el ítem anulado sale de la pantalla', await esperar(page, (id) => !document.querySelector(`li[data-item="${id}"]`), b.id));

    const historial = (await http('GET', `/items/${b.id}/historial`, (await login('login-admin', { username: 'admin', password: 'admin123' })))).data;
    check('HU022 el historial registra el inicio anticipado como tal', historial.some((t) => t.estadoDestino === 'EN_PREPARACION' && (t.motivo || '').startsWith('Inicio anticipado')), JSON.stringify(historial.map((t) => t.motivo)));
    check('Sin errores de JavaScript', errors.length === 0, errors.join(' | '));

    // Limpieza: el pase despacha el ítem Listo de esta prueba para no dejarlo pendiente
    const expedidor = await login('login-admin', { username: 'expedidor1', password: '1234' });
    await http('PATCH', `/items/${a.id}/estado`, expedidor, { estadoActual: 'LISTO', estadoDestino: 'DESPACHADO' });
  } catch (e) {
    check('Ejecución sin excepciones', false, e.message);
  } finally {
    await browser.close();
    for (const r of results) console.log(`${r.ok ? 'OK  ' : 'FAIL'} ${r.name}${r.detail ? ` (${r.detail})` : ''}`);
    process.exit(results.every((r) => r.ok) ? 0 : 1);
  }
})();
