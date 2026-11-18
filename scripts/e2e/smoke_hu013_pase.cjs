// Smoke E2E D9 (HU013): pantalla de pase con los ítems listos y despacho en tiempo real
const path = require('path');
const FRONT = path.resolve(__dirname, '../../frontend');
const puppeteer = require(path.join(FRONT, 'node_modules/puppeteer-core'));
const { sleep, http, login, loginCompleto, vaciarCola } = require('./lib.cjs');

const BASE = 'http://localhost:5173';
const OUT = process.env.E2E_OUT || require('os').tmpdir();

async function esperar(page, fn, arg, ms = 3000) {
  try {
    await page.waitForFunction(fn, { timeout: ms, polling: 100 }, arg);
    return true;
  } catch {
    return false;
  }
}

const listo = (token, itemId) => http('PATCH', `/items/${itemId}/estado`, token, { estadoActual: 'RECIBIDO', estadoDestino: 'EN_PREPARACION' })
  .then(() => http('PATCH', `/items/${itemId}/estado`, token, { estadoActual: 'EN_PREPARACION', estadoDestino: 'LISTO' }));

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
    const id = (codigo) => estaciones.find((e) => e.codigo === codigo).id;
    const platos = (await http('GET', '/platos', mozo)).data.filter((p) => p.disponible);
    const platoDe = (codigo, n = 0) => platos.filter((p) => p.estacionId === id(codigo))[n];
    const cocFrios = await login('login-pin', { username: 'cocinero1', pin: '5678', estacionId: id('FRIOS') });
    const cocPlancha = await login('login-pin', { username: 'cocinero1', pin: '5678', estacionId: id('PLANCHA') });
    const expedidor = await login('login-pin', { username: 'expedidor1', pin: '9012' });

    // Punto de partida limpio: sin pendientes en Fríos/Plancha y nada listo en el pase
    await vaciarCola(id('FRIOS'), cocFrios);
    await vaciarCola(id('PLANCHA'), cocPlancha);
    for (const item of (await http('GET', '/items/listos', expedidor)).data) {
      await http('PATCH', `/items/${item.id}/estado`, expedidor, { estadoActual: 'LISTO', estadoDestino: 'DESPACHADO' });
    }
    check('D9 solo expedidor y admin consultan el pase (cocinero 403)', (await http('GET', '/items/listos', cocFrios)).status === 403);

    // --- El expedidor entra con su PIN y llega al pase
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 860 });
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(`${BASE}/login`, { waitUntil: 'networkidle0' });
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: 'networkidle0' });
    for (const d of '9012') {
      await page.evaluate((digito) => Array.from(document.querySelectorAll('button')).find((x) => x.textContent.trim() === digito)?.click(), d);
    }
    check('Login por PIN del expedidor redirige a /pase', await esperar(page, () => location.pathname === '/pase', null, 5000), page.url());
    check('D7 el pase se conecta en tiempo real', await esperar(page, () => document.body.innerText.toUpperCase().includes('EN VIVO'), null, 5000));
    check('Sin listos muestra "Sin platos por despachar"', await esperar(page, () => document.body.innerText.includes('Sin platos por despachar')));

    // --- Pedido de dos estaciones: el ítem de Fríos queda listo primero
    const pedido = await http('POST', '/pedidos', mozo, { canalId: 3, items: [{ platoId: platoDe('FRIOS').id, cantidad: 1 }, { platoId: platoDe('PLANCHA').id, cantidad: 2 }] });
    const codigo = pedido.data.codigoCorrelativo;
    const itFrios = pedido.data.items.find((i) => i.estacionId === id('FRIOS'));
    const itPlancha = pedido.data.items.find((i) => i.estacionId === id('PLANCHA'));
    await listo(cocFrios, itFrios.id);
    const aparece = await esperar(page, (c) => !!document.querySelector(`article[data-pedido="${c}"]`), codigo);
    check('D9 el ítem Listo aparece en el pase sin recargar', aparece);
    const pendientes = await page.$eval(`article[data-pedido="${codigo}"] [data-pendientes]`, (p) => p.innerText).catch(() => '');
    check('D9 indica que al pedido le falta un ítem en cocina', pendientes.includes('Faltan 1 en cocina'), pendientes);
    await listo(cocPlancha, itPlancha.id);
    check('D9 al quedar todo listo el pedido figura completo', await esperar(page, (c) => document.querySelector(`article[data-pedido="${c}"] [data-pendientes]`)?.innerText.includes('Pedido completo') && document.querySelectorAll(`article[data-pedido="${c}"] li`).length === 2, codigo));
    await page.screenshot({ path: path.join(OUT, 'pase.png') });

    // --- Despachar ítem por ítem
    await page.$eval(`li[data-item="${itFrios.id}"] button`, (b) => b.click());
    check('Despachar saca el ítem del pase', await esperar(page, (itemId) => !document.querySelector(`li[data-item="${itemId}"]`), itFrios.id));
    await page.$eval(`li[data-item="${itPlancha.id}"] button`, (b) => b.click());
    check('Al despachar el último ítem el pedido sale del pase', await esperar(page, (c) => !document.querySelector(`article[data-pedido="${c}"]`), codigo));
    await sleep(300);
    const estadoPedido = (await http('GET', `/pedidos/${pedido.data.id}`, mozo)).data.estado;
    check('HU013 el pedido queda Despachado', estadoPedido === 'DESPACHADO', estadoPedido);

    // --- "Despachar listos" saca todo el pedido de una vez
    const otro = await http('POST', '/pedidos', mozo, { canalId: 3, items: [{ platoId: platoDe('FRIOS').id, cantidad: 1 }, { platoId: platoDe('FRIOS', 1).id, cantidad: 1 }] });
    for (const item of otro.data.items) await listo(cocFrios, item.id);
    await esperar(page, (c) => document.querySelectorAll(`article[data-pedido="${c}"] li`).length === 2, otro.data.codigoCorrelativo);
    await page.evaluate((c) => Array.from(document.querySelectorAll(`article[data-pedido="${c}"] button`)).find((b) => b.textContent.includes('Despachar listos')).click(), otro.data.codigoCorrelativo);
    check('"Despachar listos" despacha todo el pedido', await esperar(page, (c) => !document.querySelector(`article[data-pedido="${c}"]`), otro.data.codigoCorrelativo));
    await sleep(300);
    check('El servidor registra ambos ítems despachados', (await http('GET', `/pedidos/${otro.data.id}`, mozo)).data.items.every((i) => i.estadoItem === 'DESPACHADO'));

    // --- RBAC: el cocinero que abre /pase vuelve a su pantalla
    const coc = await loginCompleto('login-pin', { username: 'cocinero1', pin: '5678', estacionId: id('FRIOS') });
    const ctx = await browser.createBrowserContext();
    const pCoc = await ctx.newPage();
    await pCoc.goto(`${BASE}/login`, { waitUntil: 'networkidle0' });
    await pCoc.evaluate((t, u) => { localStorage.setItem('kds_token', t); localStorage.setItem('kds_user', JSON.stringify(u)); }, coc.token, coc.user);
    await pCoc.goto(`${BASE}/pase`, { waitUntil: 'networkidle0' });
    check('HU002 el cocinero que abre /pase vuelve a /cocina', await esperar(pCoc, () => location.pathname === '/cocina'), pCoc.url());
    check('Sin errores de JavaScript', errors.length === 0, errors.join(' | '));
  } catch (e) {
    check('Ejecución sin excepciones', false, e.message);
  } finally {
    await browser.close();
    for (const r of results) console.log(`${r.ok ? 'OK  ' : 'FAIL'} ${r.name}${r.detail ? ` (${r.detail})` : ''}`);
    process.exit(results.every((r) => r.ok) ? 0 : 1);
  }
})();
