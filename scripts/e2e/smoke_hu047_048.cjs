// Smoke E2E HU047 + HU048: semáforo configurable y vista de salón del administrador
const path = require('path');
const { execFileSync } = require('child_process');
const FRONT = path.resolve(__dirname, '../../frontend');
const puppeteer = require(path.join(FRONT, 'node_modules/puppeteer-core'));
const { http, login, loginCompleto, crearMozo, cerrarMesa } = require('./lib.cjs');

const BASE = 'http://localhost:5173';

async function esperar(page, fn, arg, ms = 6000) {
  try {
    await page.waitForFunction(fn, { timeout: ms, polling: 100 }, arg);
    return true;
  } catch {
    return false;
  }
}

// Simula el paso del tiempo: el pedido figura enviado a cocina hace N minutos
const enviadoHace = (pedidoId, minutos) => execFileSync('docker', ['exec', 'kds-postgres', 'psql', '-U', 'kds_user', '-d', 'kds_db', '-qtAc',
  `UPDATE pedidos SET fecha_envio_cocina = now() - interval '${minutos} minutes' WHERE id = ${Number(pedidoId)}`]);

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
  const abiertas = [];
  let A;
  let T;
  let mozoId;

  try {
    const admin = await loginCompleto('login-admin', { username: 'admin', password: 'admin123' });
    A = admin.token;
    const expedidor = await login('login-pin', { username: 'expedidor1', pin: '9012' });
    const sufijo = String(Date.now()).slice(-6);
    const terraza = (await http('GET', '/zonas/todas', A)).data.find((z) => z.nombre === 'Terraza' && z.activo);
    const mozo = await crearMozo(A, { username: `salon${sufijo}`, nombre: 'Sara', apellido: 'Lino' });
    mozoId = mozo.id;
    await http('PUT', `/mozos/${mozo.id}/zonas`, A, { zonaIds: [terraza.id] });
    const sesionMozo = await loginCompleto('login-pin', { username: mozo.username, pin: mozo.pin });
    T = sesionMozo.token;
    const salonId = (await http('GET', '/canales', T)).data.find((c) => c.codigo === 'SALON').id;
    const plato = (await http('GET', '/platos', T)).data.find((p) => p.disponible);
    const [mesaA, mesaB] = (await http('GET', '/mesas', T)).data.filter((m) => !m.enAtencion);
    const salon = async () => (await http('GET', '/salon', A)).data;
    const mesaEnSalon = async (id) => (await salon()).zonas.flatMap((z) => z.mesas).find((m) => m.id === id);

    // --- HU047: semáforo
    const base = await http('PUT', '/salon/semaforo', A, { minutosAmarillo: 20, minutosRojo: 30 });
    check('HU047 Esc.1/2 el semáforo queda en 20 y 30 minutos', base.status === 200 && (await http('GET', '/salon/semaforo', A)).data.minutosRojo === 30);
    const cero = await http('PUT', '/salon/semaforo', A, { minutosAmarillo: 0, minutosRojo: 10 });
    const igual = await http('PUT', '/salon/semaforo', A, { minutosAmarillo: 20, minutosRojo: 20 });
    check('HU047 Esc.3 amarillo no mayor que cero se rechaza (400)', cero.status === 400 && cero.data.mensaje.includes('amarillo'), `${cero.status} ${cero.data?.mensaje}`);
    check('HU047 Esc.3 rojo no mayor que amarillo se rechaza (400)', igual.status === 400 && igual.data.mensaje.includes('rojo'), `${igual.status} ${igual.data?.mensaje}`);
    check('HU047 Esc.4 un no administrador no cambia el semáforo (403)', (await http('PUT', '/salon/semaforo', T, { minutosAmarillo: 5, minutosRojo: 9 })).status === 403);
    check('HU048 Esc.6 un no administrador no consulta la vista de salón (403)', (await http('GET', '/salon', T)).status === 403);

    // --- HU048 Escenario 2: colores
    check('HU048 Esc.2 una mesa sin atención está libre (gris)', (await mesaEnSalon(mesaA.id)).estado === 'LIBRE');
    await http('POST', `/mesas/${mesaA.id}/atencion`, T, { personas: 4 });
    abiertas.push(mesaA.id);
    check('HU048 Esc.2 mesa abierta sin pedidos pendientes: Atendida (azul)', (await mesaEnSalon(mesaA.id)).estado === 'ATENDIDA');
    const pedido = (await http('POST', '/pedidos', T, { canalId: salonId, mesaId: mesaA.id, items: [{ platoId: plato.id, cantidad: 1 }] })).data;
    check('HU048 Esc.2 con un pedido recién enviado: verde', (await mesaEnSalon(mesaA.id)).estado === 'VERDE');
    enviadoHace(pedido.id, 25);
    const amarilla = await mesaEnSalon(mesaA.id);
    check('HU048 Esc.2 con 25 min de espera: amarillo', amarilla.estado === 'AMARILLO' && amarilla.minutosEspera === 25, `${amarilla.estado} ${amarilla.minutosEspera}`);
    enviadoHace(pedido.id, 35);
    check('HU048 Esc.2 con 35 min de espera: rojo', (await mesaEnSalon(mesaA.id)).estado === 'ROJO');
    await http('PUT', '/salon/semaforo', A, { minutosAmarillo: 40, minutosRojo: 50 });
    check('HU047 Esc.2 con nuevos umbrales (40/50) la misma mesa vuelve a verde sin reiniciar', (await mesaEnSalon(mesaA.id)).estado === 'VERDE');
    await http('PUT', '/salon/semaforo', A, { minutosAmarillo: 20, minutosRojo: 30 });

    // --- HU048 Escenario 4: datos de la mesa y de la zona
    const detalleA = await mesaEnSalon(mesaA.id);
    const zonaT = (await salon()).zonas.find((z) => z.id === terraza.id);
    check('HU048 Esc.4 la mesa trae el mozo que la abrió y las personas', detalleA.mozoNombre === 'Sara Lino' && detalleA.personas === 4);
    check('HU048 Esc.4 la zona trae sus mozos asignados', zonaT.mozos.includes('Sara Lino'));

    // --- Pantalla del administrador
    const ctx = await browser.createBrowserContext();
    const page = await ctx.newPage();
    await page.setViewport({ width: 1366, height: 900 });
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(`${BASE}/login`, { waitUntil: 'networkidle0' });
    await page.evaluate((t, u) => { localStorage.setItem('kds_token', t); localStorage.setItem('kds_user', JSON.stringify(u)); }, admin.token, admin.user);
    await page.goto(`${BASE}/admin/salon`, { waitUntil: 'networkidle0' });
    check('UI el menú del admin muestra "Salón"', await page.evaluate(() => Array.from(document.querySelectorAll('nav a')).some((a) => a.getAttribute('href') === '/admin/salon')));
    check('UI HU048 Esc.1 las mesas se agrupan por zona', await esperar(page, (id) => !!document.querySelector(`[data-zona-salon="${id}"]`), terraza.id));
    check('UI HU048 Esc.2 la mesa con 35 min de espera se ve en rojo', await esperar(page, (id) => document.querySelector(`[data-mesa-salon="${id}"]`)?.dataset.estado === 'ROJO', mesaA.id));

    // Escenario 3: un pedido nuevo en otra mesa aparece sin recargar en menos de 5 s
    await http('POST', `/mesas/${mesaB.id}/atencion`, T, { personas: 2 });
    abiertas.push(mesaB.id);
    const pedidoB = (await http('POST', '/pedidos', T, { canalId: salonId, mesaId: mesaB.id, items: [{ platoId: plato.id, cantidad: 1 }] })).data;
    check('UI HU048 Esc.3 la otra mesa pasa a verde en menos de 5 s sin recargar', await esperar(page, (id) => document.querySelector(`[data-mesa-salon="${id}"]`)?.dataset.estado === 'VERDE', mesaB.id, 5000));

    await page.$eval(`[data-mesa-salon="${mesaA.id}"]`, (b) => b.click());
    check('UI HU048 Esc.4 el detalle muestra mozo, personas y mozos de la zona', await esperar(page, () => {
      const t = (document.querySelector('[data-detalle-mesa]')?.innerText ?? '').toUpperCase();
      return t.includes('SARA LINO') && t.includes('4 DE') && t.includes('MOZOS DE LA ZONA');
    }));
    check('UI HU048 Esc.4 el detalle lista los pedidos con el estado de cada ítem', await esperar(page, (c) => document.querySelector('[data-pedidos-detalle]')?.innerText.includes(c), pedido.codigoCorrelativo));
    const botones = await page.$$eval('[data-detalle-mesa] button', (bs) => bs.map((b) => b.getAttribute('aria-label') || b.textContent.trim()));
    check('UI HU048 Esc.5 el detalle es de solo lectura (solo el botón de cerrar)', botones.length === 1 && botones[0] === 'Cerrar detalle', botones.join(', '));
    await page.$eval('[data-detalle-mesa] button', (b) => b.click());

    await page.$eval('[data-config-semaforo]', (b) => b.click());
    await page.$eval('#semaforo-amarillo', (i) => { i.value = ''; });
    await page.click('#semaforo-amarillo', { clickCount: 3 });
    await page.keyboard.press('Backspace');
    await page.type('#semaforo-amarillo', '0');
    await page.evaluate(() => Array.from(document.querySelectorAll('[role="dialog"] button')).find((b) => b.textContent.includes('GUARDAR')).click());
    check('UI HU047 Esc.3 el formulario rechaza amarillo 0 indicando la regla', await esperar(page, () => document.querySelector('[role="alert"]')?.innerText.includes('amarillo')));
    await page.click('#semaforo-amarillo', { clickCount: 3 });
    await page.keyboard.press('Backspace');
    await page.type('#semaforo-amarillo', '25');
    await page.click('#semaforo-rojo', { clickCount: 3 });
    await page.keyboard.press('Backspace');
    await page.type('#semaforo-rojo', '40');
    await page.evaluate(() => Array.from(document.querySelectorAll('[role="dialog"] button')).find((b) => b.textContent.includes('GUARDAR')).click());
    check('UI HU047 Esc.2 la leyenda aplica los nuevos minutos', await esperar(page, () => document.querySelector('[data-leyenda]')?.innerText.includes('40 min')),
      await page.$eval('[data-leyenda]', (l) => l.innerText.replace(/\s+/g, ' ')).catch(() => 'sin leyenda'));
    check('UI HU047 Esc.2 la mesa de 35 min pasa a amarillo con 25/40', await esperar(page, (id) => document.querySelector(`[data-mesa-salon="${id}"]`)?.dataset.estado === 'AMARILLO', mesaA.id));

    // Escenario 6: el mozo que abre la vista de salón vuelve a su inicio
    const ctxMozo = await browser.createBrowserContext();
    const pMozo = await ctxMozo.newPage();
    await pMozo.goto(`${BASE}/login`, { waitUntil: 'networkidle0' });
    await pMozo.evaluate((t, u) => { localStorage.setItem('kds_token', t); localStorage.setItem('kds_user', JSON.stringify(u)); }, sesionMozo.token, sesionMozo.user);
    await pMozo.goto(`${BASE}/admin/salon`, { waitUntil: 'networkidle0' });
    check('UI HU048 Esc.6 el mozo que abre /admin/salon vuelve al comandero', await esperar(pMozo, () => location.pathname === '/comandero'));
    check('Sin errores de JavaScript', errors.length === 0, errors.join(' | '));

    // Limpieza: todo despachado → la mesa queda Atendida; al liberarla, Libre
    await despachar(pedido.items[0], expedidor);
    check('HU048 Esc.2 con todo despachado y sin liberar: Atendida', (await mesaEnSalon(mesaA.id)).estado === 'ATENDIDA');
    await despachar(pedidoB.items[0], expedidor);
  } catch (e) {
    check('Ejecución sin excepciones', false, e.message);
  } finally {
    if (T) for (const mesaId of abiertas) await cerrarMesa(mesaId, T, A);
    if (mozoId) await http('PATCH', `/mozos/${mozoId}/estado`, A, { activo: false });
    if (A) await http('PUT', '/salon/semaforo', A, { minutosAmarillo: 20, minutosRojo: 30 });
    await browser.close();
    for (const r of results) console.log(`${r.ok ? 'OK  ' : 'FAIL'} ${r.name}${r.detail ? ` (${r.detail})` : ''}`);
    process.exit(results.every((r) => r.ok) ? 0 : 1);
  }
})();
