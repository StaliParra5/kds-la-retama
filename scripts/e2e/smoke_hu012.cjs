// Smoke E2E HU012: pantalla de estación en tiempo real y seguridad del WebSocket
const path = require('path');
const FRONT = path.resolve(__dirname, '../../frontend');
const puppeteer = require(path.join(FRONT, 'node_modules/puppeteer-core'));
const { sleep, http, login, loginCompleto, stompSuscriptor, vaciarCola } = require('./lib.cjs');

const BASE = 'http://localhost:5173';
const OUT = process.env.E2E_OUT || require('os').tmpdir();

// Espera hasta que la condición evaluada en la página sea verdadera (o vence el plazo)
async function esperar(page, fn, arg, ms = 3000) {
  try {
    await page.waitForFunction(fn, { timeout: ms, polling: 100 }, arg);
    return true;
  } catch {
    return false;
  }
}

const rechaza = async (promesa) => {
  try {
    const { ws } = await promesa;
    ws.close();
    return false;
  } catch {
    return true;
  }
};

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

    // --- Seguridad del canal en tiempo real
    check('WS: CONNECT sin token es rechazado', await rechaza(stompSuscriptor(['/topic/pedidos'], null)));
    check('WS Esc.1: el cocinero de Fríos no puede escuchar el tópico de Plancha', await rechaza(stompSuscriptor([`/topic/estacion/${id('PLANCHA')}`], cocFrios)));
    check('WS: el mozo no puede escuchar el tópico general de ítems', await rechaza(stompSuscriptor(['/topic/items'], mozo)));
    const propio = await stompSuscriptor([`/topic/estacion/${id('FRIOS')}`], cocFrios).then((s) => { s.ws.close(); return true; }).catch(() => false);
    check('WS: el cocinero de Fríos sí escucha su estación', propio);

    // --- PIN distinto por rol (V9) y PIN compartido rechazado
    const pinMozo = await http('POST', '/auth/login-pin', null, { pin: '1234' });
    const pinCocinero = await http('POST', '/auth/login-pin', null, { pin: '5678', estacionId: id('FRIOS') });
    check('PIN 1234 identifica a la moza y 5678 al cocinero', pinMozo.data?.rol === 'MOZO' && pinCocinero.data?.rol === 'COCINERO' && pinCocinero.data?.estacionId === id('FRIOS'));

    // --- La terminal está vinculada a Fríos (HU004) y el cocinero entra con su PIN
    await vaciarCola(id('FRIOS'), cocFrios);
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(`${BASE}/login`, { waitUntil: 'networkidle0' });
    await page.evaluate((idFrios) => {
      localStorage.clear();
      localStorage.setItem('kds_terminal_station_id', String(idFrios));
      localStorage.setItem('kds_terminal_station_name', 'Fríos');
    }, id('FRIOS'));
    await page.reload({ waitUntil: 'networkidle0' });
    for (const d of '5678') {
      await page.evaluate((digito) => {
        const b = Array.from(document.querySelectorAll('button')).find((x) => x.textContent.trim() === digito);
        b?.click();
      }, d);
    }
    await page.waitForFunction(() => location.pathname === '/cocina', { timeout: 5000 }).catch(() => {});
    check('Login por PIN del cocinero redirige a /cocina', page.url().endsWith('/cocina'), page.url());
    const enVivo = await esperar(page, () => document.body.innerText.toUpperCase().includes('EN VIVO'), null, 5000);
    check('D7 la pantalla se conecta en tiempo real (En vivo)', enVivo);
    const titulo = await page.$eval('h2', (h) => h.textContent).catch(() => '');
    check('D6 la pantalla muestra la estación de la terminal', titulo.includes('Fríos'), titulo);
    check('Esc.6 estación sin pendientes muestra "Sin pedidos"', await esperar(page, () => document.body.innerText.includes('Sin pedidos')));

    // --- Pedido mixto: 2 platos de Plancha y 1 de Fríos llega a la pantalla sin recargar
    const lomo = platoDe('PLANCHA');
    const tallarin = platoDe('PLANCHA', 1);
    const causa = platoDe('FRIOS');
    const t0 = Date.now();
    const pedido = await http('POST', '/pedidos', mozo, { canalId: 3, items: [
      { platoId: lomo.id, cantidad: 1 }, { platoId: tallarin.id, cantidad: 2 }, { platoId: causa.id, cantidad: 1, modificadores: 'Sin ají' },
    ] });
    const codigo = pedido.data.codigoCorrelativo;
    const llego = await esperar(page, (c) => !!document.querySelector(`article[data-pedido="${c}"]`), codigo);
    check('HU011/D7 el pedido aparece en Fríos sin recargar (< 3 s)', llego, `${Date.now() - t0} ms`);
    const tarjetaFrios = await page.$eval(`article[data-pedido="${codigo}"]`, (a) => ({ texto: a.innerText, items: a.querySelectorAll('li').length })).catch(() => ({ texto: '', items: 0 }));
    check('Esc.1 Fríos no muestra los platos de Plancha', tarjetaFrios.items === 1 && !tarjetaFrios.texto.includes(lomo.nombre) && !tarjetaFrios.texto.includes(tallarin.nombre));
    check('Esc.2 el ítem muestra el código de su pedido', tarjetaFrios.texto.includes(codigo) && tarjetaFrios.texto.includes(causa.nombre));
    check('Esc.4 indica los ítems del pedido en otras estaciones', tarjetaFrios.texto.includes('+2 ítems en otras estaciones'), tarjetaFrios.texto.replace(/\n/g, ' | '));
    await page.screenshot({ path: path.join(OUT, 'hu012_frios.png') });

    // --- Esc.3 en Plancha: el admin abre la pantalla y elige la estación
    const admin = await loginCompleto('login-admin', { username: 'admin', password: 'admin123' });
    // Contexto aparte: localStorage es por origen y la sesión del admin pisaría la del cocinero
    const ctxAdmin = await browser.createBrowserContext();
    const pAdmin = await ctxAdmin.newPage();
    await pAdmin.setViewport({ width: 1440, height: 900 });
    await pAdmin.goto(`${BASE}/login`, { waitUntil: 'networkidle0' });
    await pAdmin.evaluate((t, u) => { localStorage.clear(); localStorage.setItem('kds_token', t); localStorage.setItem('kds_user', JSON.stringify(u)); }, admin.token, admin.user);
    await pAdmin.goto(`${BASE}/cocina`, { waitUntil: 'networkidle0' });
    await pAdmin.waitForSelector('select[aria-label="Estación"]', { timeout: 5000 });
    await pAdmin.select('select[aria-label="Estación"]', String(id('PLANCHA')));
    await esperar(pAdmin, (c) => !!document.querySelector(`article[data-pedido="${c}"]`), codigo);
    const tarjetaPlancha = await pAdmin.$eval(`article[data-pedido="${codigo}"]`, (a) => ({ texto: a.innerText, items: a.querySelectorAll('li').length })).catch(() => ({ texto: '', items: 0 }));
    check('Esc.3 los dos platos de Plancha se agrupan bajo el mismo código', tarjetaPlancha.items === 2 && tarjetaPlancha.texto.includes(lomo.nombre) && tarjetaPlancha.texto.includes(tallarin.nombre));
    check('Esc.4 en Plancha: +1 ítem en otras estaciones', tarjetaPlancha.texto.includes('+1 ítem en otras estaciones'));
    await pAdmin.screenshot({ path: path.join(OUT, 'hu012_plancha.png') });

    // --- Esc.5: el ítem de Fríos pasa a Listo y sale de la cola en tiempo real
    const itemFrios = pedido.data.items.find((i) => i.platoId === causa.id);
    await http('PATCH', `/items/${itemFrios.id}/estado`, cocFrios, { estadoActual: 'RECIBIDO', estadoDestino: 'EN_PREPARACION' });
    const enPrep = await esperar(page, (itemId) => document.querySelector(`li[data-item="${itemId}"]`)?.innerText.toUpperCase().includes('EN PREPARACIÓN'), itemFrios.id);
    check('El cambio de estado se refleja en la pantalla en tiempo real', enPrep);
    await http('PATCH', `/items/${itemFrios.id}/estado`, cocFrios, { estadoActual: 'EN_PREPARACION', estadoDestino: 'LISTO' });
    check('Esc.5 el ítem Listo deja la cola activa', await esperar(page, (c) => !document.querySelector(`article[data-pedido="${c}"]`), codigo));
    check('Esc.6 la estación vuelve a "Sin pedidos"', await esperar(page, () => document.body.innerText.includes('Sin pedidos')));

    // --- RBAC: el cocinero no entra a administración; vuelve a su pantalla
    await page.goto(`${BASE}/admin/platos`, { waitUntil: 'networkidle0' });
    // La redirección es del enrutador del cliente: ocurre después de cargar la página
    await esperar(page, () => location.pathname === '/cocina');
    check('HU002 el cocinero que abre /admin vuelve a /cocina', page.url().endsWith('/cocina'), page.url());
    check('Sin errores de JavaScript en las páginas', errors.length === 0, errors.join(' | '));

    // Limpieza: deja Plancha sin los ítems de esta prueba
    const cocPlancha = await login('login-pin', { username: 'cocinero1', pin: '5678', estacionId: id('PLANCHA') });
    await vaciarCola(id('PLANCHA'), cocPlancha);
  } catch (e) {
    check('Ejecución sin excepciones', false, e.message);
  } finally {
    await browser.close();
    for (const r of results) console.log(`${r.ok ? 'OK  ' : 'FAIL'} ${r.name}${r.detail ? ` (${r.detail})` : ''}`);
    process.exit(results.every((r) => r.ok) ? 0 : 1);
  }
})();
