// Smoke E2E HU032: anular ítem con motivo (API real + pantalla de estación con Chrome)
// Cubre: ítem no iniciado sin merma, merma al anular en preparación o listo (consultable), motivo
// obligatorio, ítem despachado o ya anulado, estado desactualizado, roles, aviso fijo en la estación y
// pedido anulado al anular todos sus ítems (con historial).
const path = require('path');
const FRONT = path.resolve(__dirname, '../../frontend');
const puppeteer = require(path.join(FRONT, 'node_modules/puppeteer-core'));
const { sleep, http, login, loginCompleto, activarCanal, vaciarCola, despacharItems } = require('./lib.cjs');

const BASE = 'http://localhost:5173';
const OUT = process.env.E2E_OUT || require('os').tmpdir();

// Plazo máximo de toda la prueba: si algo se cuelga, termina e indica dónde quedó (ver las líneas impresas)
setTimeout(() => {
  console.log('FAIL La prueba superó los 120 s y se canceló: revise la última línea OK impresa');
  process.exit(2);
}, 120000).unref();

async function esperar(page, fn, arg, ms = 3000) {
  try {
    await page.waitForFunction(fn, { timeout: ms, polling: 50 }, arg);
    return true;
  } catch {
    return false;
  }
}

(async () => {
  const results = [];
  // Cada resultado se imprime al momento para ver hasta dónde llegó la prueba
  const check = (name, ok, detail = '') => {
    results.push({ name, ok, detail });
    console.log(`${ok ? 'OK  ' : 'FAIL'} ${name}${detail ? ` (${detail})` : ''}`);
  };
  const browser = await puppeteer.launch({
    executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new',
  });
  const errors = [];
  const creados = [];

  let restaurarDelivery = async () => {};
  try {
    // El canal Delivery puede estar inactivo en el entorno: la prueba lo activa y al final lo deja como estaba
    restaurarDelivery = await activarCanal('DELIVERY');
    const mozo = await login('login-pin', { username: 'angie', pin: '1234' });
    const admin = await loginCompleto('login-admin', { username: 'admin', password: 'admin123' });
    const expedidor = await login('login-pin', { username: 'expedidor1', pin: '9012' });
    const canales = (await http('GET', '/canales', mozo)).data;
    const delivery = canales.find((c) => c.codigo === 'DELIVERY').id;
    const estaciones = (await http('GET', '/estaciones', mozo)).data;
    const plancha = estaciones.find((e) => e.codigo === 'PLANCHA').id;
    const frios = estaciones.find((e) => e.codigo === 'FRIOS').id;
    const platos = (await http('GET', '/platos', mozo)).data.filter((p) => p.disponible);
    const platoPlancha = platos.find((p) => p.estacionId === plancha);
    const platoFrios = platos.find((p) => p.estacionId === frios);
    const cocPlancha = await login('login-pin', { username: 'cocinero1', pin: '5678', estacionId: plancha });
    const cocFrios = await login('login-pin', { username: 'cocinero1', pin: '5678', estacionId: frios });
    await vaciarCola(plancha, cocPlancha);
    await vaciarCola(frios, cocFrios);

    const crear = async (items) => {
      const r = await http('POST', '/pedidos', mozo, { canalId: delivery, items });
      if (r.status !== 201) throw new Error(`pedido: ${r.status} ${r.data?.mensaje}`);
      creados.push(r.data);
      return r.data;
    };
    const unItem = async (plato, cantidad = 1) => (await crear([{ platoId: plato.id, cantidad }]));
    // D36: un ítem ya iniciado (En preparación o Listo) solo se anula con usuario y contraseña de un administrador
    const CLAVE_ADMIN = { usuario: 'admin', password: 'admin123' };
    const anular = (itemId, estadoActual, motivo, token = mozo, autorizacion = undefined) =>
      http('POST', `/items/${itemId}/anulacion`, token, motivo === undefined ? { estadoActual } : { estadoActual, motivo, autorizacion });
    const mover = (itemId, token, de, a) => http('PATCH', `/items/${itemId}/estado`, token, { estadoActual: de, estadoDestino: a });
    const colaIds = async (estacionId, token) => (await http('GET', `/estaciones/${estacionId}/cola`, token)).data.map((i) => i.id);
    const mermas = async () => (await http('GET', '/mermas', admin.token)).data;

    // --- Esc.1: ítem no iniciado se retira de la estación sin merma
    const antes = (await mermas()).totalRegistros;
    const p1 = await crear([{ platoId: platoPlancha.id, cantidad: 1 }, { platoId: platoFrios.id, cantidad: 1 }]);
    const itPlancha = p1.items.find((i) => i.estacionId === plancha);
    const itFrios = p1.items.find((i) => i.estacionId === frios);
    const r1 = await anular(itPlancha.id, 'RECIBIDO', 'CLIENTE_CAMBIO_OPINION');
    check('Esc.1 el mozo anula un ítem no iniciado', r1.status === 200 && r1.data.estado === 'ANULADO', `${r1.status} ${r1.data?.estado}`);
    check('Esc.1 el ítem se retira de su estación', !(await colaIds(plancha, cocPlancha)).includes(itPlancha.id));
    check('Esc.1 el otro ítem del pedido sigue en su estación', (await colaIds(frios, cocFrios)).includes(itFrios.id));
    check('Esc.1 no se registra merma', (await mermas()).totalRegistros === antes);

    // --- Esc.2: ítem en preparación o listo se registra como merma consultable
    const p2 = await unItem(platoPlancha, 2);
    const it2 = p2.items[0];
    await mover(it2.id, cocPlancha, 'RECIBIDO', 'EN_PREPARACION');
    // D36: sin autorización, con una clave incorrecta o con un motivo de pendiente, el mozo no puede anularlo
    const sinClave = await anular(it2.id, 'EN_PREPARACION', 'PLATO_CON_DEFECTO');
    check('D36 un ítem en preparación sin clave de administrador se rechaza (403)', sinClave.status === 403 && sinClave.data?.codigo === 'AUTORIZACION_ADMIN_REQUERIDA', `${sinClave.status} ${sinClave.data?.codigo}`);
    const claveMala = await anular(it2.id, 'EN_PREPARACION', 'PLATO_CON_DEFECTO', mozo, { usuario: 'admin', password: 'incorrecta' });
    check('D36 una clave de administrador incorrecta se rechaza sin cerrar la sesión (403, no 401)', claveMala.status === 403 && claveMala.data?.codigo === 'AUTORIZACION_ADMIN_INVALIDA', `${claveMala.status} ${claveMala.data?.codigo}`);
    const motivoPendiente = await anular(it2.id, 'EN_PREPARACION', 'ERROR_DIGITACION', mozo, CLAVE_ADMIN);
    check('D36 un motivo de pendiente no aplica a un ítem iniciado', motivoPendiente.status === 400, `${motivoPendiente.status} ${motivoPendiente.data?.mensaje}`);
    const r2 = await anular(it2.id, 'EN_PREPARACION', 'PLATO_CON_DEFECTO', mozo, CLAVE_ADMIN);
    check('Esc.2 el mozo anula un ítem en preparación', r2.status === 200, String(r2.status));
    const m2 = await mermas();
    const fila2 = m2.mermas.find((m) => m.itemId === it2.id);
    check('Esc.2 la merma queda registrada con sus datos', !!fila2 && fila2.motivoCodigo === 'PLATO_CON_DEFECTO' && fila2.estadoAlAnular === 'EN_PREPARACION' && fila2.cantidad === 2 && !!fila2.responsable, JSON.stringify(fila2 ?? null));
    check('D36 la merma registra al administrador que autorizó', !!fila2?.autorizadoPor, String(fila2?.autorizadoPor));
    check('Esc.2 la consulta suma los registros y el monto', m2.totalRegistros === antes + 1 && Number(m2.montoTotal) >= Number(fila2?.monto ?? 0));

    const p3 = await unItem(platoPlancha);
    const it3 = p3.items[0];
    await mover(it3.id, cocPlancha, 'RECIBIDO', 'EN_PREPARACION');
    await mover(it3.id, cocPlancha, 'EN_PREPARACION', 'LISTO');
    const r3 = await anular(it3.id, 'LISTO', 'PLATO_CON_DEFECTO', mozo, CLAVE_ADMIN);
    const fila3 = (await mermas()).mermas.find((m) => m.itemId === it3.id);
    check('Esc.2 un ítem listo anulado también es merma', r3.status === 200 && fila3?.estadoAlAnular === 'LISTO', `${r3.status} ${fila3?.estadoAlAnular}`);
    check('Esc.2 el ítem anulado sale del pase', !(await http('GET', '/items/listos', expedidor)).data.some((i) => i.id === it3.id));
    const hist3 = (await http('GET', `/items/${it3.id}/historial`, admin.token)).data;
    check('El historial del ítem guarda quién y el motivo', hist3.some((t) => t.estadoDestino === 'ANULADO' && t.motivo?.includes('Plato con defecto') && t.motivo?.includes('Autorizó') && t.rolResponsable === 'MOZO'));

    // --- Esc.3: motivo obligatorio
    const p4 = await unItem(platoPlancha);
    const it4 = p4.items[0];
    const sinMotivo = await anular(it4.id, 'RECIBIDO', undefined);
    check('Esc.3 sin motivo la anulación se rechaza con un mensaje claro', sinMotivo.status === 400 && /motivo/i.test(sinMotivo.data?.mensaje ?? ''), `${sinMotivo.status} ${sinMotivo.data?.mensaje}`);
    const motivoInvalido = await anular(it4.id, 'RECIBIDO', 'NO_EXISTE');
    check('Esc.3 un motivo fuera de la lista se rechaza', motivoInvalido.status === 400, String(motivoInvalido.status));
    check('Esc.3 el ítem sigue vigente', (await colaIds(plancha, cocPlancha)).includes(it4.id));
    const motivos = (await http('GET', '/items/motivos-anulacion', mozo)).data;
    check('La lista de motivos es la aprobada (6, de Error de digitación a Otro)', motivos.length === 6 && motivos[0].etiqueta === 'Error de digitación' && motivos[5].etiqueta === 'Otro');
    const motivosPendiente = (await http('GET', '/items/motivos-anulacion?estado=RECIBIDO', mozo)).data.map((m) => m.etiqueta);
    const motivosIniciado = (await http('GET', '/items/motivos-anulacion?estado=EN_PREPARACION', mozo)).data.map((m) => m.etiqueta);
    check('D36 un ítem pendiente ofrece 4 motivos y no "Plato con defecto"', motivosPendiente.length === 4 && !motivosPendiente.includes('Plato con defecto'), motivosPendiente.join(', '));
    check('D36 un ítem iniciado ofrece 4 motivos y no "Error de digitación"', motivosIniciado.length === 4 && !motivosIniciado.includes('Error de digitación'), motivosIniciado.join(', '));

    // --- Esc.4: despachado o ya anulado no se anula
    await mover(it4.id, cocPlancha, 'RECIBIDO', 'EN_PREPARACION');
    await mover(it4.id, cocPlancha, 'EN_PREPARACION', 'LISTO');
    await mover(it4.id, expedidor, 'LISTO', 'DESPACHADO');
    const r4 = await anular(it4.id, 'DESPACHADO', 'OTRO');
    check('Esc.4 un ítem despachado no se puede anular', r4.status === 409 && /despachado/i.test(r4.data?.mensaje ?? ''), `${r4.status} ${r4.data?.mensaje}`);
    check('Esc.4 no se registra merma del ítem despachado', (await mermas()).mermas.every((m) => m.itemId !== it4.id));
    const r4b = await anular(itPlancha.id, 'ANULADO', 'OTRO');
    check('Un ítem ya anulado no se anula otra vez', r4b.status === 409, String(r4b.status));

    // Cocina cambió el ítem mientras el mozo decidía: se responde con el estado vigente y no se anula
    const p5 = await unItem(platoPlancha);
    const it5 = p5.items[0];
    await mover(it5.id, cocPlancha, 'RECIBIDO', 'EN_PREPARACION');
    const r5 = await anular(it5.id, 'RECIBIDO', 'OTRO');
    check('Estado desactualizado: 409 con el estado vigente del ítem', r5.status === 409 && r5.data?.item?.estado === 'EN_PREPARACION', `${r5.status} ${r5.data?.item?.estado}`);
    check('Estado desactualizado: el ítem no se anuló ni generó merma', (await colaIds(plancha, cocPlancha)).includes(it5.id) && (await mermas()).mermas.every((m) => m.itemId !== it5.id));

    // --- Roles: cocina no anula; solo el administrador consulta mermas; el administrador sí anula
    const rCocina = await anular(it5.id, 'EN_PREPARACION', 'OTRO', cocPlancha);
    check('Un cocinero no puede anular ítems', rCocina.status === 403, String(rCocina.status));
    const rMermasMozo = await http('GET', '/mermas', mozo);
    check('Un mozo no puede consultar las mermas', rMermasMozo.status === 403, String(rMermasMozo.status));
    const rAdmin = await anular(it5.id, 'EN_PREPARACION', 'DEMORA_EXCESIVA', admin.token);
    check('El administrador sí puede anular', rAdmin.status === 200, String(rAdmin.status));
    const rFecha = await http('GET', '/mermas?desde=12/11/2026', admin.token);
    check('Una fecha mal escrita en la consulta de mermas es un 400', rFecha.status === 400, String(rFecha.status));

    // --- Esc.6: al anular todos los ítems el pedido queda anulado y sale de la cola
    const p6 = await crear([{ platoId: platoPlancha.id, cantidad: 1 }, { platoId: platoFrios.id, cantidad: 1 }]);
    const [a6, b6] = p6.items;
    await anular(a6.id, 'RECIBIDO', 'CLIENTE_SE_RETIRO');
    const parcial = (await http('GET', `/pedidos/${p6.id}`, mozo)).data;
    check('Esc.6 con un ítem vigente el pedido sigue activo y su total descuenta lo anulado', parcial.estado !== 'ANULADO' && Number(parcial.total) === Number(b6.subtotal), `${parcial.estado} ${parcial.total}`);
    await anular(b6.id, 'RECIBIDO', 'CLIENTE_SE_RETIRO');
    const total6 = (await http('GET', `/pedidos/${p6.id}`, mozo)).data;
    check('Esc.6 al anular el último ítem el pedido queda anulado con total 0', total6.estado === 'ANULADO' && Number(total6.total) === 0, `${total6.estado} ${total6.total}`);
    const enColas = [...(await colaIds(plancha, cocPlancha)), ...(await colaIds(frios, cocFrios))];
    check('Esc.6 el pedido anulado sale de las colas', ![a6.id, b6.id].some((i) => enColas.includes(i)));
    const histPedido = (await http('GET', `/pedidos/${p6.id}/historial`, admin.token)).data;
    check('Esc.6 el historial del pedido registra el paso a Anulado', histPedido.some((t) => t.itemId == null && t.estadoDestino === 'ANULADO'));

    // --- Esc.5: la estación recibe un aviso visible (pantalla real)
    const ctx = await browser.createBrowserContext();
    const page = await ctx.newPage();
    await page.setViewport({ width: 1440, height: 800 });
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(`${BASE}/login`, { waitUntil: 'networkidle0' });
    await page.evaluate((t, u) => { localStorage.clear(); localStorage.setItem('kds_token', t); localStorage.setItem('kds_user', JSON.stringify(u)); }, admin.token, admin.user);
    await page.goto(`${BASE}/cocina`, { waitUntil: 'networkidle0' });
    await page.waitForSelector('select[aria-label="Estación"]', { timeout: 5000 });
    await page.select('select[aria-label="Estación"]', String(plancha));
    await esperar(page, () => document.body.innerText.toUpperCase().includes('EN VIVO'), null, 5000);

    const p7 = await unItem(platoPlancha);
    const it7 = p7.items[0];
    await esperar(page, (c) => !!document.querySelector(`article[data-pedido="${c}"]`), p7.codigoCorrelativo, 4000);
    await mover(it7.id, cocPlancha, 'RECIBIDO', 'EN_PREPARACION');
    await esperar(page, (i) => document.querySelector(`li[data-item="${i}"]`)?.dataset.estado === 'EN_PREPARACION', it7.id);
    const t0 = Date.now();
    const r7 = await anular(it7.id, 'EN_PREPARACION', 'PLATO_CON_DEFECTO', mozo, CLAVE_ADMIN);
    check('El mozo anula el ítem que cocina está preparando', r7.status === 200, String(r7.status));
    const hayAviso = await esperar(page, (i) => !!document.querySelector(`[data-aviso-anulacion="${i}"]`), it7.id, 3000);
    const ms = Date.now() - t0;
    check('Esc.5 la estación muestra el aviso de anulación en 2 s o menos', hayAviso && ms <= 2000, `${ms} ms`);
    const textoAviso = await page.$eval(`[data-aviso-anulacion="${it7.id}"]`, (d) => d.innerText).catch(() => '');
    check('Esc.5 el aviso indica plato, pedido y motivo', textoAviso.includes(platoPlancha.nombre) && textoAviso.includes(p7.codigoCorrelativo) && textoAviso.includes('Plato con defecto'), textoAviso.replace(/\s+/g, ' '));
    check('Esc.5 el ítem anulado sale de la cola', await page.evaluate((c) => !document.querySelector(`article[data-pedido="${c}"]`), p7.codigoCorrelativo));
    await page.screenshot({ path: path.join(OUT, 'hu032_aviso_cocina.png') });
    await page.evaluate(() => Array.from(document.querySelectorAll('[data-aviso-anulacion] button')).find((b) => b.textContent.trim() === 'Entendido')?.click());
    check('El cocinero confirma y el aviso desaparece', await esperar(page, (i) => !document.querySelector(`[data-aviso-anulacion="${i}"]`), it7.id, 2000));

    // Un ítem que aún no se iniciaba no deja un aviso fijo (basta el aviso breve)
    const p8 = await unItem(platoPlancha);
    const it8 = p8.items[0];
    await esperar(page, (c) => !!document.querySelector(`article[data-pedido="${c}"]`), p8.codigoCorrelativo, 4000);
    await anular(it8.id, 'RECIBIDO', 'ERROR_DIGITACION');
    await esperar(page, (c) => !document.querySelector(`article[data-pedido="${c}"]`), p8.codigoCorrelativo, 3000);
    check('Un ítem no iniciado se retira sin aviso fijo', await page.evaluate((i) => !document.querySelector(`[data-aviso-anulacion="${i}"]`), it8.id));

    check('Sin errores de JavaScript en la página', errors.length === 0, errors.join(' | '));
  } catch (e) {
    check('Ejecución sin excepciones', false, e.message);
  } finally {
    try {
      await despacharItems(creados.flatMap((p) => p.items));
    } catch (e) {
      console.warn(`Limpieza incompleta: ${e.message}`);
    }
    try {
      await restaurarDelivery();
    } catch (e) {
      console.warn(`No se pudo restaurar el canal Delivery: ${e.message}`);
    }
    await Promise.race([browser.close(), sleep(5000)]);
    const fallidas = results.filter((r) => !r.ok).length;
    console.log(`==== ${results.length - fallidas}/${results.length} comprobaciones OK`);
    process.exit(fallidas === 0 ? 0 : 1);
  }
})();
