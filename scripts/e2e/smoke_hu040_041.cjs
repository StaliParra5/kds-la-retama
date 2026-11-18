// Smoke E2E HU040 + HU041: administrar zonas (crear, editar, desactivar, reactivar) y editar mesas
const path = require('path');
const FRONT = path.resolve(__dirname, '../../frontend');
const puppeteer = require(path.join(FRONT, 'node_modules/puppeteer-core'));
const { http, login, loginCompleto } = require('./lib.cjs');

const BASE = 'http://localhost:5173';

async function esperar(page, fn, arg, ms = 4000) {
  try {
    await page.waitForFunction(fn, { timeout: ms, polling: 100 }, arg);
    return true;
  } catch {
    return false;
  }
}

// Lleva un ítem de RECIBIDO a DESPACHADO para dejar la mesa sin atención en curso
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
  let zonasOriginalesAngie = null;
  const sufijo = String(Date.now()).slice(-6);

  try {
    const admin = await loginCompleto('login-admin', { username: 'admin', password: 'admin123' });
    const mozo = await login('login-pin', { username: 'angie', pin: '1234' });
    const expedidor = await login('login-pin', { username: 'expedidor1', pin: '9012' });
    const A = admin.token;
    const zonasMozo = async () => (await http('GET', '/zonas', mozo)).data;

    // --- HU040: zonas
    const creada = await http('POST', '/zonas', A, { nombre: `Rooftop ${sufijo}`, descripcion: 'Azotea' });
    check('HU040 Esc.1 se registra una zona nueva (201)', creada.status === 201, String(creada.status));
    const zonaId = creada.data.id;
    // HU043: el mozo solo ve las zonas asignadas; se le agrega la nueva y al final se restaura su asignación
    const angie = (await http('GET', '/mozos', A)).data.find((m) => m.username === 'angie');
    // Zonas de pruebas anteriores (terminan en 6 dígitos) no se restauran
    zonasOriginalesAngie = { id: angie.id, zonaIds: angie.zonas.filter((z) => z.activo && !/ \d{6}$/.test(z.nombre)).map((z) => z.id) };
    await http('PUT', `/mozos/${angie.id}/zonas`, A, { zonaIds: [...zonasOriginalesAngie.zonaIds, zonaId] });
    check('HU040 Esc.1 la zona queda disponible para los mozos que la atienden', (await zonasMozo()).some((z) => z.id === zonaId));

    const dup = await http('POST', '/zonas', A, { nombre: `rooftop ${sufijo}` });
    check('HU040 Esc.2 nombre repetido sin importar mayúsculas (400)', dup.status === 400 && dup.data.mensaje.includes('Ya existe'), `${dup.status} ${dup.data?.mensaje}`);

    const editada = await http('PUT', `/zonas/${zonaId}`, A, { nombre: `Piso 2 ${sufijo}`, descripcion: 'Segundo piso' });
    check('HU040 Esc.3 se edita el nombre de la zona', editada.status === 200 && editada.data.nombre === `Piso 2 ${sufijo}`, String(editada.status));
    check('HU040 Esc.3 el comandero ve el nuevo nombre', (await zonasMozo()).some((z) => z.id === zonaId && z.nombre === `Piso 2 ${sufijo}`));

    check('Solo el administrador gestiona zonas (mozo 403)', (await http('POST', '/zonas', mozo, { nombre: `X ${sufijo}` })).status === 403);
    check('Solo el administrador ve las zonas inactivas (mozo 403)', (await http('GET', '/zonas/todas', mozo)).status === 403);

    // --- HU041: mesas
    const m1 = (await http('POST', '/mesas', A, { zonaId, numeroMesa: 'P1', capacidad: 4 })).data;
    const m2 = (await http('POST', '/mesas', A, { zonaId, numeroMesa: 'P2', capacidad: 4 })).data;
    const e1 = await http('PUT', `/mesas/${m2.id}`, A, { zonaId, numeroMesa: 'P2B', capacidad: 6 });
    check('HU041 Esc.1 se editan número y capacidad', e1.status === 200 && e1.data.numeroMesa === 'P2B' && e1.data.capacidad === 6, String(e1.status));
    const e2 = await http('PUT', `/mesas/${m2.id}`, A, { zonaId, numeroMesa: 'p1', capacidad: 6 });
    check('HU041 Esc.2 número repetido en la zona (400)', e2.status === 400 && e2.data.mensaje.includes('Ya existe'), `${e2.status} ${e2.data?.mensaje}`);

    const otraZona = (await http('POST', '/zonas', A, { nombre: `Patio ${sufijo}` })).data;
    const e3 = await http('PUT', `/mesas/${m2.id}`, A, { zonaId: otraZona.id, numeroMesa: 'P2B', capacidad: 6 });
    check('HU041 Esc.3 una mesa sin atención se mueve de zona', e3.status === 200 && e3.data.zonaId === otraZona.id, String(e3.status));
    await http('PUT', `/mesas/${m2.id}`, A, { zonaId, numeroMesa: 'P2B', capacidad: 6 });

    const salon = (await http('GET', '/canales', mozo)).data.find((c) => c.codigo === 'SALON');
    const plato = (await http('GET', '/platos', mozo)).data.find((p) => p.disponible);

    const d4 = await http('PATCH', `/mesas/${m2.id}/estado`, A, { activo: false });
    const mesasZona = async () => (await zonasMozo()).find((z) => z.id === zonaId)?.mesas ?? [];
    check('HU041 Esc.4 la mesa desactivada no aparece a los mozos', d4.status === 200 && !(await mesasZona()).some((m) => m.id === m2.id), String(d4.status));
    const enInactiva = await http('POST', '/pedidos', mozo, { canalId: salon.id, mesaId: m2.id, items: [{ platoId: plato.id, cantidad: 1 }] });
    check('HU041 Esc.4 el servidor rechaza pedidos en la mesa desactivada (409 MESA_NO_DISPONIBLE)', enInactiva.status === 409 && enInactiva.data.codigo === 'MESA_NO_DISPONIBLE', `${enInactiva.status} ${enInactiva.data?.mensaje}`);
    await http('PATCH', `/mesas/${m2.id}/estado`, A, { activo: true });
    check('HU041 Esc.6 la mesa reactivada vuelve a aparecer', (await mesasZona()).some((m) => m.id === m2.id));

    // --- Mesa en atención: pedido de salón activo en P1
    // HU044: el pedido de salón exige abrir antes la mesa (atención)
    await http('POST', `/mesas/${m1.id}/atencion`, mozo, { personas: 2 });
    const pedido = await http('POST', '/pedidos', mozo, { canalId: salon.id, mesaId: m1.id, items: [{ platoId: plato.id, cantidad: 1 }] });
    check('Pedido de salón en la mesa P1 (201)', pedido.status === 201, String(pedido.status));

    const z5 = await http('PATCH', `/zonas/${zonaId}/estado`, A, { activo: false });
    check('HU040 Esc.5 zona con mesas en atención no se desactiva (409)', z5.status === 409 && z5.data.mensaje.includes('P1'), `${z5.status} ${z5.data?.mensaje}`);
    const todas = (await http('GET', '/zonas/todas', A)).data;
    check('HU040/HU041 administración ve la mesa marcada en atención', todas.find((z) => z.id === zonaId).mesas.find((m) => m.id === m1.id).enAtencion === true);
    const mover = await http('PUT', `/mesas/${m1.id}`, A, { zonaId: otraZona.id, numeroMesa: 'P1', capacidad: 4 });
    const desact = await http('PATCH', `/mesas/${m1.id}/estado`, A, { activo: false });
    check('HU041 Esc.5 mesa en atención no se mueve ni desactiva (409)', mover.status === 409 && desact.status === 409, `${mover.status}/${desact.status}`);

    await despacharItem(pedido.data.items[0], expedidor);
    // HU046: con todo despachado el mozo libera la mesa y deja de estar en atención
    await http('POST', `/mesas/${m1.id}/atencion/liberar`, mozo);
    const z4 = await http('PATCH', `/zonas/${zonaId}/estado`, A, { activo: false });
    check('HU040 Esc.4 la zona sin atención se desactiva', z4.status === 200 && z4.data.activo === false, String(z4.status));
    check('HU040 Esc.4 los mozos dejan de ver la zona', !(await zonasMozo()).some((z) => z.id === zonaId));
    check('HU040 Esc.4 administración sigue viendo la zona inactiva', (await http('GET', '/zonas/todas', A)).data.some((z) => z.id === zonaId && !z.activo));
    await http('PATCH', `/zonas/${zonaId}/estado`, A, { activo: true });
    check('HU040 Esc.6 la zona reactivada vuelve con sus mesas', (await mesasZona()).length === 2);

    // --- Pantalla de administración
    const ctx = await browser.createBrowserContext();
    const page = await ctx.newPage();
    await page.setViewport({ width: 1366, height: 900 });
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(`${BASE}/login`, { waitUntil: 'networkidle0' });
    await page.evaluate((t, u) => { localStorage.setItem('kds_token', t); localStorage.setItem('kds_user', JSON.stringify(u)); }, admin.token, admin.user);
    await page.goto(`${BASE}/admin/mesas`, { waitUntil: 'networkidle0' });

    const clickTexto = (texto) => page.evaluate((t) => Array.from(document.querySelectorAll('button')).find((b) => b.textContent.trim().includes(t))?.click(), texto);
    await clickTexto('NUEVA ZONA');
    await page.type('#zona-nombre', `Terraza UI ${sufijo}`);
    await clickTexto('REGISTRAR ZONA');
    const conUi = await esperar(page, (n) => Array.from(document.querySelectorAll('[data-zona]')).some((b) => b.textContent.includes(n)), `Terraza UI ${sufijo}`);
    check('UI HU040 Esc.1 la zona creada aparece en la lista', conUi);
    check('UI HU040 la zona creada queda seleccionada con su ficha', await esperar(page, () => !!document.querySelector('[data-zona-panel]')));

    await clickTexto('Desactivar zona');
    check('UI HU040 Esc.4 la ficha marca la zona como inactiva', await esperar(page, () => document.querySelector('[data-zona-panel]')?.innerText.toUpperCase().includes('INACTIVA')));
    await clickTexto('Reactivar zona');
    check('UI HU040 Esc.6 la zona vuelve a estar activa', await esperar(page, () => document.querySelector('[data-zona-panel]')?.innerText.toUpperCase().includes('ACTIVA') && !document.querySelector('[data-zona-panel]')?.innerText.toUpperCase().includes('INACTIVA')));

    await page.$eval(`[data-zona="${zonaId}"]`, (b) => b.click());
    await page.waitForSelector(`[data-mesa="${m2.id}"]`);
    await page.$eval(`[data-mesa="${m2.id}"]`, (b) => b.click());
    await page.waitForSelector('#modal-capacidad');
    await page.$eval('#modal-capacidad', (i) => { i.value = ''; });
    await page.type('#modal-capacidad', '8');
    await clickTexto('GUARDAR CAMBIOS');
    check('UI HU041 Esc.1 la capacidad editada se muestra en la mesa', await esperar(page, (id) => document.querySelector(`[data-mesa="${id}"]`)?.innerText.includes('8 pers.'), m2.id));

    await page.$eval(`[data-mesa="${m1.id}"]`, (b) => b.click());
    await page.waitForSelector('#modal-numero-mesa');
    await page.$eval('#modal-numero-mesa', (i) => { i.value = ''; });
    await page.type('#modal-numero-mesa', 'p2b');
    await clickTexto('GUARDAR CAMBIOS');
    check('UI HU041 Esc.2 el formulario muestra el número repetido', await esperar(page, () => document.querySelector('[role="alert"]')?.innerText.includes('Ya existe')));
    check('Sin errores de JavaScript', errors.length === 0, errors.join(' | '));
  } catch (e) {
    check('Ejecución sin excepciones', false, e.message);
  } finally {
    // Limpieza, también si la prueba falló: angie recupera sus zonas y las zonas de prueba quedan
    // inactivas para no mostrarse a los mozos ni en la vista de salón
    const admin = await login('login-admin', { username: 'admin', password: 'admin123' });
    if (zonasOriginalesAngie) {
      await http('PUT', `/mozos/${zonasOriginalesAngie.id}/zonas`, admin, { zonaIds: zonasOriginalesAngie.zonaIds });
    }
    const deLaPrueba = (await http('GET', '/zonas/todas', admin)).data.filter((z) => z.nombre.endsWith(sufijo) && z.activo);
    for (const z of deLaPrueba) await http('PATCH', `/zonas/${z.id}/estado`, admin, { activo: false });
    await browser.close();
    for (const r of results) console.log(`${r.ok ? 'OK  ' : 'FAIL'} ${r.name}${r.detail ? ` (${r.detail})` : ''}`);
    process.exit(results.every((r) => r.ok) ? 0 : 1);
  }
})();
