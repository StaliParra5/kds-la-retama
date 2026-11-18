// Smoke E2E HU042: gestionar mozos (crear, editar, PIN, desactivar, eliminar) contra la API y la pantalla
const path = require('path');
const FRONT = path.resolve(__dirname, '../../frontend');
const puppeteer = require(path.join(FRONT, 'node_modules/puppeteer-core'));
const { http, loginCompleto } = require('./lib.cjs');

const BASE = 'http://localhost:5173';

async function esperar(page, fn, arg, ms = 4000) {
  try {
    await page.waitForFunction(fn, { timeout: ms, polling: 100 }, arg);
    return true;
  } catch {
    return false;
  }
}

const loginPin = (body) => http('POST', '/auth/login-pin', null, body);

// Las corridas anteriores dejan PIN ocupados: se prueba al azar hasta dar con uno libre
async function crearMozo(token, base) {
  for (let intento = 0; intento < 30; intento++) {
    const pin = String(Math.floor(1000 + Math.random() * 9000));
    const r = await http('POST', '/mozos', token, { ...base, pin });
    if (r.status === 201) return { ...r.data, pin };
    if (!(r.status === 400 && r.data?.mensaje?.includes('PIN'))) throw new Error(`alta de mozo: ${r.status} ${r.data?.mensaje}`);
  }
  throw new Error('no se encontró un PIN libre');
}

async function pinLibre(token, mozoId) {
  for (let intento = 0; intento < 30; intento++) {
    const pin = String(Math.floor(1000 + Math.random() * 9000));
    const r = await http('PUT', `/mozos/${mozoId}/pin`, token, { pin });
    if (r.status === 200) return pin;
  }
  throw new Error('no se encontró un PIN libre');
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
    const sufijo = String(Date.now()).slice(-6);

    // --- Escenario 1: alta y login con el PIN
    const lucia = await crearMozo(A, { username: `lucia${sufijo}`, nombre: 'Lucía', apellido: 'Torres' });
    check('HU042 Esc.1 se registra el mozo (201)', !!lucia.id);
    const l1 = await loginPin({ username: lucia.username, pin: lucia.pin });
    check('HU042 Esc.1 el mozo ingresa con su PIN', l1.status === 200 && l1.data.rol === 'MOZO', String(l1.status));
    const l1b = await loginPin({ pin: lucia.pin });
    check('HU042 Esc.1 el PIN solo (teclado táctil) lo identifica', l1b.status === 200 && l1b.data.username === lucia.username, `${l1b.status} ${l1b.data?.username}`);

    // --- Escenarios 2 y 3: usuario y PIN repetidos
    const dup = await http('POST', '/mozos', A, { username: `LUCIA${sufijo}`, nombre: 'Otra', apellido: 'Persona', pin: '0001' });
    check('HU042 Esc.2 usuario repetido sin importar mayúsculas (400)', dup.status === 400 && dup.data.mensaje.includes('ya existe'), `${dup.status} ${dup.data?.mensaje}`);
    const pinUsado = await http('POST', '/mozos', A, { username: `otro${sufijo}`, nombre: 'Otro', apellido: 'Mozo', pin: '1234' });
    check('HU042 Esc.3 PIN en uso se rechaza (400)', pinUsado.status === 400 && pinUsado.data.mensaje.includes('en uso'), `${pinUsado.status} ${pinUsado.data?.mensaje}`);
    check('HU042 Esc.3 el mensaje no revela a quién pertenece', !/angie/i.test(pinUsado.data?.mensaje ?? ''));
    check('HU042 PIN que no es de 4 dígitos (400)', (await http('POST', '/mozos', A, { username: `x${sufijo}`, nombre: 'X', apellido: 'Y', pin: '12a4' })).status === 400);

    // --- Escenario 4: editar datos
    const ed = await http('PUT', `/mozos/${lucia.id}`, A, { nombre: 'Lucía Belén', apellido: 'Torres' });
    const l4 = await loginPin({ username: lucia.username, pin: lucia.pin });
    check('HU042 Esc.4 los nuevos datos se ven en su siguiente sesión', ed.status === 200 && l4.data.nombreCompleto === 'Lucía Belén Torres', l4.data?.nombreCompleto);

    // --- Escenario 5: cambiar PIN
    const sesionAbierta = l4.data.token;
    check('La sesión del mozo opera antes del cambio', (await http('GET', '/platos', sesionAbierta)).status === 200);
    const pinNuevo = await pinLibre(A, lucia.id);
    const viejo = await loginPin({ username: lucia.username, pin: lucia.pin });
    const nuevo = await loginPin({ username: lucia.username, pin: pinNuevo });
    check('HU042 Esc.5 el PIN anterior deja de funcionar (401)', viejo.status === 401, String(viejo.status));
    check('HU042 Esc.5 el mozo ingresa con el PIN nuevo', nuevo.status === 200, String(nuevo.status));
    const conSesionVieja = (await http('GET', '/platos', sesionAbierta)).status;
    check('HU042 Esc.5 la sesión abierta con el PIN anterior deja de valer', conSesionVieja === 401 || conSesionVieja === 403, String(conSesionVieja));
    check('HU042 Esc.5 la sesión con el PIN nuevo sí opera', (await http('GET', '/platos', nuevo.data.token)).status === 200);
    check('HU042 Esc.1 el login acepta el usuario sin distinguir mayúsculas', (await loginPin({ username: lucia.username.toUpperCase(), pin: pinNuevo })).status === 200);

    // --- Escenario 6: desactivar y reactivar
    await http('PATCH', `/mozos/${lucia.id}/estado`, A, { activo: false });
    check('HU042 Esc.6 el mozo desactivado no puede ingresar (401)', (await loginPin({ username: lucia.username, pin: pinNuevo })).status === 401);
    const sesionDesactivado = (await http('GET', '/platos', nuevo.data.token)).status;
    check('HU042 Esc.6 su sesión abierta deja de valer al desactivarlo', sesionDesactivado === 401 || sesionDesactivado === 403, String(sesionDesactivado));
    await http('PATCH', `/mozos/${lucia.id}/estado`, A, { activo: true });
    check('HU042 Esc.6 al reactivarlo vuelve a ingresar', (await loginPin({ username: lucia.username, pin: pinNuevo })).status === 200);

    // --- Escenario 7: eliminar sin historial
    const del = await http('DELETE', `/mozos/${lucia.id}`, A);
    const lista = (await http('GET', '/mozos', A)).data;
    check('HU042 Esc.7 el mozo sin pedidos se elimina (204)', del.status === 204 && !lista.some((m) => m.id === lucia.id), String(del.status));

    // --- Escenario 7: abrir una mesa sin registrar pedidos no impide eliminarlo (antes daba 409)
    const marta = await crearMozo(A, { username: `marta${sufijo}`, nombre: 'Marta', apellido: 'Quispe' });
    const mesaLibre = (await http('GET', '/mesas', A)).data.find((m) => m.activo && !m.enAtencion);
    await http('PUT', `/mozos/${marta.id}/zonas`, A, { zonaIds: [mesaLibre.zonaId] });
    const tokenMarta = (await loginPin({ username: marta.username, pin: marta.pin })).data.token;
    const abre = await http('POST', `/mesas/${mesaLibre.id}/atencion`, tokenMarta, { personas: 1 });
    check('El mozo nuevo abre una mesa sin enviar pedidos', abre.status === 200, String(abre.status));
    const delAbierta = await http('DELETE', `/mozos/${marta.id}`, A);
    check('HU042 con una mesa abierta no se elimina e indica cuál (409)', delAbierta.status === 409 && delAbierta.data.mensaje.includes(`mesa ${mesaLibre.numeroMesa}`), `${delAbierta.status} ${delAbierta.data?.mensaje}`);
    const libera = await http('POST', `/mesas/${mesaLibre.id}/atencion/liberar`, tokenMarta);
    check('El mozo libera la mesa vacía', libera.status === 200, String(libera.status));
    const delMarta = await http('DELETE', `/mozos/${marta.id}`, A);
    check('HU042 Esc.7 el mozo que solo abrió y liberó una mesa sin pedidos se elimina (204)', delMarta.status === 204, `${delMarta.status} ${delMarta.data?.mensaje}`);

    // --- Escenario 8: con pedidos no se elimina
    const pedro = await crearMozo(A, { username: `pedro${sufijo}`, nombre: 'Pedro', apellido: 'Ríos' });
    const tokenPedro = (await loginPin({ username: pedro.username, pin: pedro.pin })).data.token;
    const plato = (await http('GET', '/platos', tokenPedro)).data.find((p) => p.disponible);
    const pedido = await http('POST', '/pedidos', tokenPedro, { canalId: 3, items: [{ platoId: plato.id, cantidad: 1 }] });
    check('El mozo nuevo registra un pedido (201)', pedido.status === 201, String(pedido.status));
    const del8 = await http('DELETE', `/mozos/${pedro.id}`, A);
    check('HU042 Esc.8 con pedidos no se elimina (409 MOZO_CON_HISTORIAL)', del8.status === 409 && del8.data.codigo === 'MOZO_CON_HISTORIAL', `${del8.status} ${del8.data?.codigo}`);
    check('HU042 Esc.8 el mensaje ofrece desactivarlo', /desactivarlo/.test(del8.data?.mensaje ?? ''));

    const mozo = (await loginPin({ username: 'angie', pin: '1234' })).data.token;
    check('Solo el administrador gestiona mozos (mozo 403)', (await http('GET', '/mozos', mozo)).status === 403);

    // --- Pantalla
    const ctx = await browser.createBrowserContext();
    const page = await ctx.newPage();
    await page.setViewport({ width: 1366, height: 900 });
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(`${BASE}/login`, { waitUntil: 'networkidle0' });
    await page.evaluate((t, u) => { localStorage.setItem('kds_token', t); localStorage.setItem('kds_user', JSON.stringify(u)); }, admin.token, admin.user);
    await page.goto(`${BASE}/admin/mozos`, { waitUntil: 'networkidle0' });
    const clickTexto = (texto, raiz = 'body') => page.evaluate((t, r) => Array.from(document.querySelector(r).querySelectorAll('button')).find((b) => b.textContent.trim().includes(t))?.click(), texto, raiz);

    check('UI el menú del admin muestra "Mozos"', await page.evaluate(() => Array.from(document.querySelectorAll('nav a')).some((a) => a.getAttribute('href') === '/admin/mozos')));
    await clickTexto('NUEVO MOZO');
    await page.type('#mozo-usuario', `ui${sufijo}`);
    await page.type('#mozo-nombre', 'Rosa');
    await page.type('#mozo-apellido', 'Quispe');
    await page.type('#mozo-pin', '1234');
    await clickTexto('REGISTRAR MOZO');
    check('UI HU042 Esc.3 el formulario muestra el PIN en uso', await esperar(page, () => document.querySelector('[role="alert"]')?.innerText.includes('en uso')));
    await page.$eval('#mozo-pin', (i) => { i.value = ''; });
    const pinUi = await (async () => {
      // Un PIN libre: se crea por API y se borra, para que la pantalla lo use sin colisión
      const tmp = await crearMozo(A, { username: `tmp${sufijo}`, nombre: 'Tmp', apellido: 'Tmp' });
      await http('DELETE', `/mozos/${tmp.id}`, A);
      return tmp.pin;
    })();
    await page.type('#mozo-pin', pinUi);
    await clickTexto('REGISTRAR MOZO');
    check('UI HU042 Esc.1 el mozo creado aparece en la lista', await esperar(page, (u) => !!document.querySelector(`[data-mozo="${u}"]`), `ui${sufijo}`));

    await clickTexto('Eliminar', `[data-mozo="${pedro.username}"]`);
    await esperar(page, () => Array.from(document.querySelectorAll('[role="dialog"]')).some((d) => d.innerText.includes('Eliminar mozo')));
    await clickTexto('ELIMINAR', '[role="dialog"]');
    check('UI HU042 Esc.8 se explica que no puede eliminarse', await esperar(page, () => document.querySelector('[role="dialog"]')?.innerText.includes('No se puede eliminar')));
    await clickTexto('DESACTIVAR', '[role="dialog"]');
    check('UI HU042 Esc.8 el mozo queda desactivado', await esperar(page, (u) => document.querySelector(`[data-mozo="${u}"]`)?.innerText.toUpperCase().includes('INACTIVO'), pedro.username));
    check('Sin errores de JavaScript', errors.length === 0, errors.join(' | '));

    // Limpieza: el mozo creado en pantalla no tiene pedidos y se elimina
    const deUi = (await http('GET', '/mozos', A)).data.find((m) => m.username === `ui${sufijo}`);
    if (deUi) await http('DELETE', `/mozos/${deUi.id}`, A);
  } catch (e) {
    check('Ejecución sin excepciones', false, e.message);
  } finally {
    await browser.close();
    for (const r of results) console.log(`${r.ok ? 'OK  ' : 'FAIL'} ${r.name}${r.detail ? ` (${r.detail})` : ''}`);
    process.exit(results.every((r) => r.ok) ? 0 : 1);
  }
})();
