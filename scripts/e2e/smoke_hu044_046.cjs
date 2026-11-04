// Smoke E2E HU044 + HU046: abrir la mesa antes del comandero y liberarla, contra la API y la pantalla
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

async function abrirComo(browser, sesion, ruta) {
  const ctx = await browser.createBrowserContext();
  const page = await ctx.newPage();
  await page.setViewport({ width: 1366, height: 900 });
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle0' });
  await page.evaluate((t, u) => { localStorage.setItem('kds_token', t); localStorage.setItem('kds_user', JSON.stringify(u)); }, sesion.token, sesion.user);
  await page.goto(`${BASE}${ruta}`, { waitUntil: 'networkidle0' });
  return page;
}

async function despachar(item, expedidor) {
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
  const abiertas = []; // mesas abiertas por la prueba, para cerrarlas al final
  let A;
  let tokenMozo;

  try {
    const admin = await loginCompleto('login-admin', { username: 'admin', password: 'admin123' });
    A = admin.token;
    const expedidor = await login('login-pin', { username: 'expedidor1', pin: '9012' });
    const angie = await login('login-pin', { username: 'angie', pin: '1234' });
    const sufijo = String(Date.now()).slice(-6);
    const zonas = (await http('GET', '/zonas/todas', A)).data;
    const terraza = zonas.find((z) => z.nombre === 'Terraza' && z.activo);
    const barra = zonas.find((z) => z.nombre === 'Barra' && z.activo);

    const mozo = await crearMozo(A, { username: `mesa${sufijo}`, nombre: 'Marco', apellido: 'Salas' });
    await http('PUT', `/mozos/${mozo.id}/zonas`, A, { zonaIds: [terraza.id] });
    const sesion = await loginCompleto('login-pin', { username: mozo.username, pin: mozo.pin });
    tokenMozo = sesion.token;
    const T = tokenMozo;
    const otro = await crearMozo(A, { username: `barra${sufijo}`, nombre: 'Bruno', apellido: 'Barra' });
    await http('PUT', `/mozos/${otro.id}/zonas`, A, { zonaIds: [barra.id] });
    const tokenOtro = (await loginCompleto('login-pin', { username: otro.username, pin: otro.pin })).token;

    const canalSalon = (await http('GET', '/canales', T)).data.find((c) => c.codigo === 'SALON');
    const plato = (await http('GET', '/platos', T)).data.find((p) => p.disponible);
    const libres = () => http('GET', '/mesas', T).then((r) => r.data.filter((m) => !m.enAtencion));

    // --- HU044 Escenario 2: cada mesa indica si está libre o en atención
    const mesasT = (await http('GET', '/zonas', T)).data[0].mesas;
    check('HU044 Esc.2 las mesas traen su estado (libre / en atención)', mesasT.length > 0 && mesasT.every((m) => typeof m.enAtencion === 'boolean'));
    const [mesaA, mesaB, mesaC] = await libres();

    // --- HU044 Escenario 3: abrir una mesa libre
    const sinPersonas = await http('POST', `/mesas/${mesaA.id}/atencion`, T, {});
    check('HU044 Esc.3 una mesa libre no se abre sin personas (400)', sinPersonas.status === 400, `${sinPersonas.status} ${sinPersonas.data?.mensaje}`);
    check('HU044 Esc.3 personas debe ser mayor que cero (400)', (await http('POST', `/mesas/${mesaA.id}/atencion`, T, { personas: 0 })).status === 400);
    const abierta = await http('POST', `/mesas/${mesaA.id}/atencion`, T, { personas: 3 });
    abiertas.push(mesaA.id);
    check('HU044 Esc.3 se abre la mesa con 3 personas', abierta.status === 200 && abierta.data.personas === 3 && abierta.data.mozoNombre === 'Marco Salas', `${abierta.status}`);
    check('HU044 Esc.3 la mesa pasa a figurar en atención', (await http('GET', '/mesas', T)).data.find((m) => m.id === mesaA.id).enAtencion === true);

    const sinAbrir = await http('POST', '/pedidos', T, { canalId: canalSalon.id, mesaId: mesaB.id, items: [{ platoId: plato.id, cantidad: 1 }] });
    check('HU044 / D19 pedido de salón en mesa sin abrir (409 MESA_SIN_ATENCION)', sinAbrir.status === 409 && sinAbrir.data.codigo === 'MESA_SIN_ATENCION', `${sinAbrir.status} ${sinAbrir.data?.codigo}`);

    // --- HU044 Escenario 4: entrar a una mesa en atención
    const pedido = await http('POST', '/pedidos', T, { canalId: canalSalon.id, mesaId: mesaA.id, items: [{ platoId: plato.id, cantidad: 1 }] });
    check('Pedido en la mesa abierta (201)', pedido.status === 201, String(pedido.status));
    const reentrada = await http('POST', `/mesas/${mesaA.id}/atencion`, T, { personas: 9 });
    check('HU044 Esc.4 entrar de nuevo devuelve la misma atención sin cambiar personas', reentrada.data.id === abierta.data.id && reentrada.data.personas === 3);
    check('HU044 Esc.4 se ven los pedidos ya realizados en la mesa', reentrada.data.pedidos.length === 1 && reentrada.data.pedidos[0].id === pedido.data.id);
    check('HU044 el admin consulta la atención de la mesa', (await http('GET', `/mesas/${mesaA.id}/atencion`, A)).data.id === abierta.data.id);

    // --- HU044 Escenario 5: dos mozos abren la misma mesa a la vez
    const [r1, r2] = await Promise.all([
      http('POST', `/mesas/${mesaC.id}/atencion`, T, { personas: 2 }),
      http('POST', `/mesas/${mesaC.id}/atencion`, angie, { personas: 4 }),
    ]);
    abiertas.push(mesaC.id);
    check('HU044 Esc.5 apertura simultánea deja una sola atención', r1.status === 200 && r2.status === 200 && r1.data.id === r2.data.id, `${r1.status}/${r2.status} ${r1.data?.id}/${r2.data?.id}`);

    // --- HU046
    const conPendientes = await http('POST', `/mesas/${mesaA.id}/atencion/liberar`, T);
    check('HU046 Esc.2 con ítems por despachar no se libera (409) e indica cuántos', conPendientes.status === 409 && conPendientes.data.mensaje.includes('faltan 1'), `${conPendientes.status} ${conPendientes.data?.mensaje}`);
    check('HU046 Esc.4 un mozo sin la zona no libera la mesa (403)', (await http('POST', `/mesas/${mesaA.id}/atencion/liberar`, tokenOtro)).status === 403);
    await despachar(pedido.data.items[0], expedidor);
    const liberada = await http('POST', `/mesas/${mesaA.id}/atencion/liberar`, T);
    check('HU046 Esc.1 con todo despachado la mesa se libera', liberada.status === 200, `${liberada.status} ${liberada.data?.mensaje}`);
    check('HU046 Esc.5 queda registrada apertura, liberación y quién liberó', !!liberada.data.abiertaEn && !!liberada.data.liberadaEn && liberada.data.liberadaPorNombre === 'Marco Salas');
    check('HU046 Esc.1 la mesa vuelve a estar libre', (await http('GET', '/mesas', T)).data.find((m) => m.id === mesaA.id).enAtencion === false);
    check('HU046 Esc.1 su siguiente apertura vuelve a pedir personas (400 sin personas)', (await http('POST', `/mesas/${mesaA.id}/atencion`, T, {})).status === 400);
    abiertas.splice(abiertas.indexOf(mesaA.id), 1);
    check('HU046 liberar una mesa ya libre se rechaza (409)', (await http('POST', `/mesas/${mesaA.id}/atencion/liberar`, T)).status === 409);

    // --- Pantalla del mozo
    const page = await abrirComo(browser, sesion, '/comandero');
    page.on('pageerror', (e) => errors.push(e.message));
    check('UI HU044 Esc.1 el comandero empieza por elegir el destino (sin carta)', await esperar(page, () => !!document.querySelector('[data-canal="SALON"]') && !document.querySelector('button[title="Agregar a la comanda"]')));
    await page.$eval('[data-canal="SALON"]', (b) => b.click());
    check('UI HU044 Esc.1 en Salón se elige la zona (solo las del mozo)', await esperar(page, (id) => document.querySelectorAll('[data-zona-sel]').length === 1 && !!document.querySelector(`[data-zona-sel="${id}"]`), terraza.id));
    check('UI HU044 Esc.2 la mesa abierta por la prueba figura en atención', await esperar(page, (id) => document.querySelector(`[data-mesa-sel="${id}"]`)?.dataset.estado === 'en-atencion', mesaC.id));
    await page.$eval(`[data-mesa-sel="${mesaA.id}"]`, (b) => b.click());
    check('UI HU044 Esc.3 una mesa libre pide la cantidad de personas', await esperar(page, () => !!document.querySelector('#personas-input')));
    await page.type('#personas-input', '2');
    await page.evaluate(() => Array.from(document.querySelectorAll('[role="dialog"] button')).find((b) => b.textContent.includes('ABRIR MESA')).click());
    abiertas.push(mesaA.id);
    check('UI HU044 Esc.3 entra al comandero con la mesa en el encabezado', await esperar(page, (n) => document.querySelector('[data-destino]')?.innerText.includes(`Mesa ${n}`) && document.querySelector('[data-destino]')?.innerText.includes('2 personas'), mesaA.numeroMesa));

    await page.$eval('button[title="Agregar a la comanda"]', (b) => b.click());
    await page.$eval('[data-cambiar-destino]', (b) => b.click());
    check('UI HU044 Esc.6 cambiar de mesa con platos sin enviar pide confirmar', await esperar(page, () => document.querySelector('[role="dialog"]')?.innerText.includes('Descartar')));
    await page.evaluate(() => Array.from(document.querySelectorAll('[role="dialog"] button')).find((b) => b.textContent.includes('Cancelar')).click());

    await page.evaluate(() => Array.from(document.querySelectorAll('button')).find((b) => b.textContent.includes('ENVIAR A COCINA')).click());
    check('UI HU044 Esc.4 la comanda enviada aparece entre los pedidos de la mesa', await esperar(page, () => document.querySelector('[data-pedidos-mesa]')?.innerText.includes('Pedidos en esta mesa (1)')));

    await page.$eval('[data-liberar-mesa]', (b) => b.click());
    await page.evaluate(() => Array.from(document.querySelectorAll('[role="dialog"] button')).find((b) => b.textContent.includes('LIBERAR MESA')).click());
    check('UI HU046 Esc.2 liberar con ítems pendientes muestra cuántos faltan', await esperar(page, () => document.body.innerText.includes('faltan 1')));

    const atencionUi = (await http('GET', `/mesas/${mesaA.id}/atencion`, T)).data;
    await despachar(atencionUi.pedidos[0].items[0], expedidor);
    await page.$eval('[data-liberar-mesa]', (b) => b.click());
    await page.evaluate(() => Array.from(document.querySelectorAll('[role="dialog"] button')).find((b) => b.textContent.includes('LIBERAR MESA')).click());
    check('UI HU046 Esc.1 al liberar vuelve a la elección de destino', await esperar(page, () => !!document.querySelector('[data-canal="SALON"]')));
    abiertas.splice(abiertas.indexOf(mesaA.id), 1);
    check('Sin errores de JavaScript', errors.length === 0, errors.join(' | '));

    await http('PATCH', `/mozos/${mozo.id}/estado`, A, { activo: false });
    await http('DELETE', `/mozos/${otro.id}`, A);
  } catch (e) {
    check('Ejecución sin excepciones', false, e.message);
  } finally {
    // Cierra las mesas que la prueba dejó abiertas (sin pedidos pendientes)
    for (const mesaId of abiertas) {
      if (tokenMozo) await http('POST', `/mesas/${mesaId}/atencion/liberar`, tokenMozo);
    }
    await browser.close();
    for (const r of results) console.log(`${r.ok ? 'OK  ' : 'FAIL'} ${r.name}${r.detail ? ` (${r.detail})` : ''}`);
    process.exit(results.every((r) => r.ok) ? 0 : 1);
  }
})();
