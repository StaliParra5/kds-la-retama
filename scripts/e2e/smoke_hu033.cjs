// Smoke E2E HU033: deshacer el último cambio de estado (recall) dentro de una ventana configurable
// Cubre: deshacer dentro de la ventana y su registro, solo el último cambio, ventana vencida y configurable,
// despachado no reversible, permisos, y reflejo en la estación y el pase sin recargar (botón con el tiempo abajo).
const path = require('path');
const FRONT = path.resolve(__dirname, '../../frontend');
const puppeteer = require(path.join(FRONT, 'node_modules/puppeteer-core'));
const { sleep, http, login, loginCompleto, vaciarCola, despacharItems } = require('./lib.cjs');

const BASE = 'http://localhost:5173';
const OUT = process.env.E2E_OUT || require('os').tmpdir();

setTimeout(() => {
  console.log('FAIL La prueba superó los 120 s y se canceló: revise la última línea OK impresa');
  process.exit(2);
}, 120000).unref();

async function esperar(page, fn, arg, ms = 4000) {
  try {
    await page.waitForFunction(fn, { timeout: ms, polling: 100 }, arg);
    return true;
  } catch {
    return false;
  }
}

(async () => {
  const results = [];
  const check = (name, ok, detail = '') => {
    results.push({ name, ok, detail });
    console.log(`${ok ? 'OK  ' : 'FAIL'} ${name}${detail ? ` (${detail})` : ''}`);
  };
  const browser = await puppeteer.launch({
    executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new',
    args: ['--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows'],
  });
  const errors = [];
  const creados = [];
  let admin;
  let ventanaOriginal = null;

  try {
    admin = await loginCompleto('login-admin', { username: 'admin', password: 'admin123' });
    const exp = await loginCompleto('login-pin', { username: 'expedidor1', pin: '9012' });
    const mozo = await login('login-pin', { username: 'angie', pin: '1234' });
    const canales = (await http('GET', '/canales', mozo)).data;
    const llevar = canales.find((c) => c.codigo === 'PARA_LLEVAR').id;
    const estaciones = (await http('GET', '/estaciones', admin.token)).data;
    const plancha = estaciones.find((e) => e.codigo === 'PLANCHA').id;
    const frios = estaciones.find((e) => e.codigo === 'FRIOS').id;
    const plato = (await http('GET', '/platos', mozo)).data.find((p) => p.disponible && p.activo && p.estacionId === plancha);
    const cocPlancha = await login('login-pin', { username: 'cocinero1', pin: '5678', estacionId: plancha });
    const cocFrios = await login('login-pin', { username: 'cocinero1', pin: '5678', estacionId: frios });
    await vaciarCola(plancha, cocPlancha);

    // Ventana configurable (Esc. 4): rango y solo administrador
    ventanaOriginal = (await http('GET', '/configuracion/cocina', cocPlancha)).data?.ventanaRecallSegundos;
    check('La cocina puede consultar la ventana para deshacer', Number.isInteger(ventanaOriginal), String(ventanaOriginal));
    const fuera = await http('PUT', '/configuracion/cocina', admin.token, { ventanaRecallSegundos: 200 });
    check('Una ventana fuera de 5 a 120 s se rechaza', fuera.status === 400, String(fuera.status));
    const noAdmin = await http('PUT', '/configuracion/cocina', cocPlancha, { ventanaRecallSegundos: 30 });
    check('Solo el administrador cambia la ventana', noAdmin.status === 403, String(noAdmin.status));
    await http('PUT', '/configuracion/cocina', admin.token, { ventanaRecallSegundos: 30 });

    const crear = async () => {
      const r = await http('POST', '/pedidos', mozo, { canalId: llevar, clienteNombre: 'Prueba Recall', clienteTelefono: '955555555', items: [{ platoId: plato.id, cantidad: 1 }] });
      if (r.status !== 201) throw new Error(`pedido: ${r.status} ${r.data?.mensaje}`);
      creados.push(r.data);
      return r.data.items[0].id;
    };
    const mover = (id, token, de, a) => http('PATCH', `/items/${id}/estado`, token, { estadoActual: de, estadoDestino: a });
    const recall = (id, token, estadoActual) => http('POST', `/items/${id}/recall`, token, { estadoActual });

    // --- Esc.1: dentro de la ventana vuelve al estado anterior y queda registrado
    const i1 = await crear();
    await mover(i1, cocPlancha, 'RECIBIDO', 'EN_PREPARACION');
    const enCola = (await http('GET', `/estaciones/${plancha}/cola`, cocPlancha)).data.find((i) => i.id === i1);
    check('El ítem informa que su último cambio se puede deshacer', enCola?.estadoPrevio === 'RECIBIDO' && Number.isFinite(enCola?.ultimoCambioEpochMs), JSON.stringify({ p: enCola?.estadoPrevio, t: enCola?.ultimoCambioEpochMs }));
    const r1 = await recall(i1, cocPlancha, 'EN_PREPARACION');
    check('Esc.1 deshacer dentro de la ventana devuelve el ítem a Recibido', r1.status === 200 && r1.data.estado === 'RECIBIDO', `${r1.status} ${r1.data?.estado ?? r1.data?.mensaje}`);
    const hist = (await http('GET', `/items/${i1}/historial`, admin.token)).data;
    check('Esc.1 el recall queda en el historial sin borrar el cambio anterior', hist.some((t) => t.estadoOrigen === 'RECIBIDO' && t.estadoDestino === 'EN_PREPARACION') && hist.some((t) => t.estadoOrigen === 'EN_PREPARACION' && t.estadoDestino === 'RECIBIDO' && /Recall/.test(t.motivo ?? '')));

    // --- Esc.3: solo el último cambio
    await mover(i1, cocPlancha, 'RECIBIDO', 'EN_PREPARACION');
    await mover(i1, cocPlancha, 'EN_PREPARACION', 'LISTO');
    const r3 = await recall(i1, cocPlancha, 'LISTO');
    const r3b = await recall(i1, cocPlancha, 'EN_PREPARACION');
    check('Esc.3 se revierte solo el último cambio (Listo vuelve a En preparación)', r3.status === 200 && r3.data.estado === 'EN_PREPARACION', `${r3.status} ${r3.data?.estado}`);
    check('Esc.3 no se puede deshacer dos veces seguidas', r3b.status === 409 && r3b.data?.codigo === 'RECALL_NO_DISPONIBLE', `${r3b.status} ${r3b.data?.codigo}`);

    // --- Permisos: el expedidor y otra estación no deshacen
    const rExp = await recall(i1, exp.token, 'EN_PREPARACION');
    check('El expedidor no puede deshacer cambios de cocina', rExp.status === 403, String(rExp.status));

    // --- Esc.5: un ítem despachado no se deshace
    await mover(i1, cocPlancha, 'EN_PREPARACION', 'LISTO');
    await mover(i1, exp.token, 'LISTO', 'DESPACHADO');
    const r5 = await recall(i1, cocPlancha, 'DESPACHADO');
    check('Esc.5 un ítem despachado no se puede deshacer', r5.status === 409 && r5.data?.codigo === 'RECALL_NO_DISPONIBLE', `${r5.status} ${r5.data?.codigo}`);

    // --- Esc.2 y 4: con la ventana en 5 s, a los 7 s ya no se puede
    await http('PUT', '/configuracion/cocina', admin.token, { ventanaRecallSegundos: 5 });
    const i2 = await crear();
    await mover(i2, cocPlancha, 'RECIBIDO', 'EN_PREPARACION');
    const rFrios = await recall(i2, cocFrios, 'EN_PREPARACION');
    check('Un cocinero de otra estación no puede deshacer', rFrios.status === 403, String(rFrios.status));
    await sleep(7000);
    const r2 = await recall(i2, cocPlancha, 'EN_PREPARACION');
    check('Esc.2/4 fuera de la ventana configurada no se puede deshacer', r2.status === 409 && r2.data?.codigo === 'RECALL_VENCIDO', `${r2.status} ${r2.data?.mensaje}`);
    await http('PUT', '/configuracion/cocina', admin.token, { ventanaRecallSegundos: 30 });

    // --- Esc.6 (pantalla): marcar Listo en la estación, deshacer y verlo en la estación y en el pase
    const i3 = await crear();
    const abrir = async (ruta, sesion, estacionId) => {
      const ctx = await browser.createBrowserContext();
      const page = await ctx.newPage();
      await page.setViewport({ width: 1440, height: 900 });
      page.on('pageerror', (e) => errors.push(e.message));
      await page.goto(`${BASE}/login`, { waitUntil: 'networkidle0' });
      await page.evaluate((t, u) => { localStorage.clear(); localStorage.setItem('kds_token', t); localStorage.setItem('kds_user', JSON.stringify(u)); }, sesion.token, sesion.user);
      await page.goto(`${BASE}${ruta}`, { waitUntil: 'networkidle0' });
      if (estacionId) {
        await page.waitForSelector('select[aria-label="Estación"]', { timeout: 5000 });
        await page.select('select[aria-label="Estación"]', String(estacionId));
      }
      return page;
    };
    const cocina = await abrir('/cocina', admin, plancha);
    const pase = await abrir('/pase', exp);
    const fila = `li[data-item="${i3}"]`;
    await esperar(cocina, (s) => !!document.querySelector(s), fila, 6000);
    const tocar = (estado) => cocina.evaluate((s) => document.querySelector(`${s} > button`)?.click(), fila).then(() => esperar(cocina, ([s, e]) => document.querySelector(s)?.dataset.estado === e, [fila, estado], 4000));
    await tocar('EN_PREPARACION');
    const boton = await esperar(cocina, (s) => !!document.querySelector(`${s} [data-deshacer]`), fila, 3000);
    const tiempo = await cocina.$eval(`${fila} [data-deshacer-segundos]`, (e) => e.innerText).catch(() => '');
    const abajo = await cocina.evaluate((s) => {
      const b = document.querySelector(`${s} [data-deshacer]`)?.getBoundingClientRect();
      const t = document.querySelector(`${s} [data-deshacer-segundos]`)?.getBoundingClientRect();
      return !!b && !!t && t.top >= b.bottom - 1;
    }, fila);
    check('El botón Deshacer aparece con el tiempo restante debajo', boton && /^\d+ s$/.test(tiempo) && abajo, `${tiempo} abajo=${abajo}`);
    await tocar('LISTO');
    const enPase = await esperar(pase, (id) => !!document.querySelector(`[data-item="${id}"], li[data-item="${id}"]`) || document.body.innerText.includes('Prueba Recall'), i3, 5000);
    check('El ítem listo aparece en el pase', enPase);
    check('El ítem listo sigue visible en la estación para poder deshacerlo', !!(await cocina.$(`${fila} [data-deshacer]`)));
    await cocina.evaluate((s) => document.querySelector(`${s} [data-deshacer]`)?.click(), fila);
    const vuelve = await esperar(cocina, (s) => document.querySelector(s)?.dataset.estado === 'EN_PREPARACION', fila, 4000);
    check('Esc.6 la estación muestra el estado anterior sin recargar', vuelve);
    const salePase = await esperar(pase, () => !document.body.innerText.includes('Prueba Recall'), null, 4000);
    check('Esc.6 el pase deja de mostrarlo sin recargar', salePase);
    await cocina.screenshot({ path: path.join(OUT, 'hu033_deshacer.png') });

    // Configuración visible en Administración > Estaciones (sin pestaña nueva)
    const admEst = await abrir('/admin/estaciones', admin);
    check('La ventana se configura en Administración > Estaciones', await esperar(admEst, () => !!document.querySelector('[data-ventana-recall] #ventana-recall'), null, 5000));

    check('Sin errores de JavaScript en las páginas', errors.length === 0, errors.join(' | '));
  } catch (e) {
    check('Ejecución sin excepciones', false, e.message);
  } finally {
    try {
      if (ventanaOriginal) await http('PUT', '/configuracion/cocina', admin.token, { ventanaRecallSegundos: ventanaOriginal });
      for (const p of creados) {
        const vigente = (await http('GET', `/pedidos/${p.id}`, admin.token)).data;
        await despacharItems(vigente?.items ?? p.items);
      }
    } catch (e) {
      console.warn(`Limpieza incompleta: ${e.message}`);
    }
    await Promise.race([browser.close(), sleep(5000)]);
    const fallidas = results.filter((x) => !x.ok).length;
    console.log(`==== ${results.length - fallidas}/${results.length} comprobaciones OK`);
    process.exit(fallidas === 0 ? 0 : 1);
  }
})();
