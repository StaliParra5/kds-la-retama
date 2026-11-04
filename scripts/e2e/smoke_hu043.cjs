// Smoke E2E HU043: asignar mozos a zonas (restrictivo) contra la API y las pantallas
const path = require('path');
const FRONT = path.resolve(__dirname, '../../frontend');
const puppeteer = require(path.join(FRONT, 'node_modules/puppeteer-core'));
const { http, login, loginCompleto, crearMozo } = require('./lib.cjs');

const BASE = 'http://localhost:5173';

async function esperar(page, fn, arg, ms = 4000) {
  try {
    await page.waitForFunction(fn, { timeout: ms, polling: 100 }, arg);
    return true;
  } catch {
    return false;
  }
}

async function abrirComo(browser, sesion, ruta) {
  const ctx = await browser.createBrowserContext();
  const page = await ctx.newPage();
  await page.setViewport({ width: 1366, height: 900 });
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle0' });
  await page.evaluate((t, u) => { localStorage.setItem('kds_token', t); localStorage.setItem('kds_user', JSON.stringify(u)); }, sesion.token, sesion.user);
  await page.goto(`${BASE}${ruta}`, { waitUntil: 'networkidle0' });
  return page;
}

// Deja la mesa sin atención en curso para no afectar otras pruebas
async function despacharItem(item, expedidor) {
  const cocinero = await login('login-pin', { username: 'cocinero1', pin: '5678', estacionId: item.estacionId });
  const pasos = [['RECIBIDO', 'EN_PREPARACION', cocinero], ['EN_PREPARACION', 'LISTO', cocinero], ['LISTO', 'DESPACHADO', expedidor]];
  for (const [actual, destino, token] of pasos) {
    await http('PATCH', `/items/${item.id}/estado`, token, { estadoActual: actual, estadoDestino: destino, inicioAnticipado: true });
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
    const admin = await loginCompleto('login-admin', { username: 'admin', password: 'admin123' });
    const A = admin.token;
    const expedidor = await login('login-pin', { username: 'expedidor1', pin: '9012' });
    const sufijo = String(Date.now()).slice(-6);
    const zonas = (await http('GET', '/zonas/todas', A)).data;
    const terraza = zonas.find((z) => z.nombre === 'Terraza' && z.activo);
    const salon = zonas.find((z) => z.nombre === 'Salón Principal' && z.activo);
    const barra = zonas.find((z) => z.nombre === 'Barra' && z.activo);

    // --- Escenario 1: asignar zonas
    const mozo = await crearMozo(A, { username: `zona${sufijo}`, nombre: 'Zoila', apellido: 'Mesa' });
    check('HU043 un mozo nuevo empieza sin zonas', mozo.zonas.length === 0);
    const asig = await http('PUT', `/mozos/${mozo.id}/zonas`, A, { zonaIds: [terraza.id] });
    check('HU043 Esc.1 se asigna la zona Terraza', asig.status === 200 && asig.data.zonas.map((z) => z.nombre).join() === 'Terraza', `${asig.status}`);
    check('HU043 Esc.1 la asignación se ve en la gestión de mozos', (await http('GET', '/mozos', A)).data.find((m) => m.id === mozo.id).zonas.length === 1);

    // --- Escenario 2: el mozo ve solo sus zonas
    const sesionMozo = await loginCompleto('login-pin', { username: mozo.username, pin: mozo.pin });
    const T = sesionMozo.token;
    const susZonas = (await http('GET', '/zonas', T)).data;
    const susMesas = (await http('GET', '/mesas', T)).data;
    check('HU043 Esc.2 el mozo solo recibe la zona Terraza', susZonas.length === 1 && susZonas[0].id === terraza.id, susZonas.map((z) => z.nombre).join());
    check('HU043 Esc.2 todas sus mesas son de Terraza', susMesas.length > 0 && susMesas.every((m) => m.zonaId === terraza.id));

    // --- Escenario 3: mesa fuera de sus zonas
    const canalSalon = (await http('GET', '/canales', T)).data.find((c) => c.codigo === 'SALON');
    const plato = (await http('GET', '/platos', T)).data.find((p) => p.disponible);
    const mesaAjena = salon.mesas.find((m) => m.activo);
    const ajena = await http('POST', '/pedidos', T, { canalId: canalSalon.id, mesaId: mesaAjena.id, items: [{ platoId: plato.id, cantidad: 1 }] });
    check('HU043 Esc.3 pedido en mesa de otra zona rechazado (403)', ajena.status === 403, `${ajena.status} ${ajena.data?.mensaje}`);
    // HU044: se abre una mesa libre de su zona antes de tomar el pedido
    const mesaPropia = susMesas.find((m) => !m.enAtencion) ?? susMesas[0];
    await http('POST', `/mesas/${mesaPropia.id}/atencion`, T, { personas: 2 });
    const propia = await http('POST', '/pedidos', T, { canalId: canalSalon.id, mesaId: mesaPropia.id, items: [{ platoId: plato.id, cantidad: 1 }] });
    check('HU043 Esc.3 pedido en una mesa de su zona (201)', propia.status === 201, `${propia.status} ${propia.data?.mensaje}`);

    // --- Escenario 5: quitar la zona
    await http('PUT', `/mozos/${mozo.id}/zonas`, A, { zonaIds: [] });
    check('HU043 Esc.5 al quitarle la zona deja de verla', (await http('GET', '/zonas', T)).data.length === 0 && (await http('GET', '/mesas', T)).data.length === 0);
    const pedidoDespues = (await http('GET', `/pedidos/${propia.data.id}`, A)).data;
    check('HU043 Esc.5 el pedido ya enviado no se altera', pedidoDespues.estado === 'ENVIADO' && pedidoDespues.mesaId === mesaPropia.id, pedidoDespues.estado);

    // --- Escenario 4: sin zonas toma pedidos para llevar o delivery, no de salón
    const delivery = await http('POST', '/pedidos', T, { canalId: 3, items: [{ platoId: plato.id, cantidad: 1 }] });
    check('HU043 Esc.4 sin zonas registra un pedido sin mesa (201)', delivery.status === 201, String(delivery.status));
    const salonSinZonas = await http('POST', '/pedidos', T, { canalId: canalSalon.id, mesaId: mesaPropia.id, items: [{ platoId: plato.id, cantidad: 1 }] });
    check('HU043 Esc.4 sin zonas no registra pedidos de salón (403)', salonSinZonas.status === 403, String(salonSinZonas.status));

    check('HU043 no se asignan zonas inactivas (400)', await (async () => {
      const inactiva = zonas.find((z) => !z.activo);
      return !inactiva || (await http('PUT', `/mozos/${mozo.id}/zonas`, A, { zonaIds: [inactiva.id] })).status === 400;
    })());
    check('Solo el administrador asigna zonas (mozo 403)', (await http('PUT', `/mozos/${mozo.id}/zonas`, T, { zonaIds: [terraza.id] })).status === 403);

    // --- Pantallas
    const pMozo = await abrirComo(browser, sesionMozo, '/comandero');
    pMozo.on('pageerror', (e) => errors.push(`mozo: ${e.message}`));
    check('UI HU043 Esc.4 el comandero avisa que no tiene zonas', await esperar(pMozo, () => !!document.querySelector('[data-sin-zonas]')));

    const pAdmin = await abrirComo(browser, admin, '/admin/mozos');
    pAdmin.on('pageerror', (e) => errors.push(`admin: ${e.message}`));
    await pAdmin.waitForSelector(`[data-mozo="${mozo.username}"]`);
    await pAdmin.evaluate((u) => Array.from(document.querySelector(`[data-mozo="${u}"]`).querySelectorAll('button')).find((b) => b.textContent.includes('Zonas')).click(), mozo.username);
    await pAdmin.waitForSelector(`[data-zona-check="${barra.id}"]`);
    await pAdmin.$eval(`[data-zona-check="${barra.id}"]`, (c) => c.click());
    await pAdmin.evaluate(() => Array.from(document.querySelectorAll('[role="dialog"] button')).find((b) => b.textContent.includes('GUARDAR ZONAS')).click());
    check('UI HU043 Esc.1 la tarjeta muestra la zona asignada', await esperar(pAdmin, (u) => document.querySelector(`[data-mozo="${u}"] [data-zonas]`)?.innerText.includes('Barra'), mozo.username));
    const mesasTrasUi = (await http('GET', '/mesas', T)).data;
    check('UI HU043 la asignación desde la pantalla llega al mozo', mesasTrasUi.length > 0 && mesasTrasUi.every((m) => m.zonaId === barra.id));
    check('Sin errores de JavaScript', errors.length === 0, errors.join(' | '));

    // Limpieza: libera la mesa usada y deja al mozo de prueba inactivo (tiene historial)
    await despacharItem(propia.data.items[0], expedidor);
    // Liberar exige tener la zona de la mesa (HU046): se le devuelve Terraza para cerrar la atención
    await http('PUT', `/mozos/${mozo.id}/zonas`, A, { zonaIds: [terraza.id] });
    await http('POST', `/mesas/${mesaPropia.id}/atencion/liberar`, T);
    await http('PATCH', `/mozos/${mozo.id}/estado`, A, { activo: false });
  } catch (e) {
    check('Ejecución sin excepciones', false, e.message);
  } finally {
    await browser.close();
    for (const r of results) console.log(`${r.ok ? 'OK  ' : 'FAIL'} ${r.name}${r.detail ? ` (${r.detail})` : ''}`);
    process.exit(results.every((r) => r.ok) ? 0 : 1);
  }
})();
