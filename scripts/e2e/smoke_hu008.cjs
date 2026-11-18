// Smoke E2E HU008: cantidades y modificadores por ítem (API real + pantalla de estación con Chrome)
// Cubre: catálogo de modificadores editable por plato (admin), solo los del plato, plato sin modificadores
// que solo admite cantidad, varios modificadores en un ítem, cantidad inválida, líneas separadas por
// modificador, reintento equivalente (idempotencia) y modificadores resaltados en cocina.
const path = require('path');
const FRONT = path.resolve(__dirname, '../../frontend');
const puppeteer = require(path.join(FRONT, 'node_modules/puppeteer-core'));
const { sleep, http, login, loginCompleto, vaciarCola, despacharItems } = require('./lib.cjs');

const BASE = 'http://localhost:5173';
const OUT = process.env.E2E_OUT || require('os').tmpdir();

// Plazo máximo de toda la prueba: si algo se cuelga, termina e indica dónde quedó (ver las líneas impresas)
setTimeout(() => {
  console.log('FAIL La prueba superó los 90 s y se canceló: revise la última línea OK impresa');
  process.exit(2);
}, 90000).unref();

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
  const check = (name, ok, detail = '') => {
    results.push({ name, ok, detail });
    console.log(`${ok ? 'OK  ' : 'FAIL'} ${name}${detail ? ` (${detail})` : ''}`);
  };
  const browser = await puppeteer.launch({
    executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new',
  });
  const creados = [];
  let admin;
  let platoEditado = null;
  let listaOriginal = null;

  try {
    const mozo = await login('login-pin', { username: 'angie', pin: '1234' });
    admin = await loginCompleto('login-admin', { username: 'admin', password: 'admin123' });
    const canales = (await http('GET', '/canales', mozo)).data;
    const delivery = canales.find((c) => c.codigo === 'DELIVERY').id;
    const platos = (await http('GET', '/platos', mozo)).data.filter((p) => p.disponible && p.activo);
    const conMods = platos.find((p) => p.modificadores.length >= 2 && p.modificadores.some((m) => m.toLowerCase() === 'sin cebolla'));
    const sinMods = platos.find((p) => p.modificadores.length === 0);
    check('Hay un plato con modificadores y otro sin ellos para probar', !!conMods && !!sinMods, `${conMods?.nombre} / ${sinMods?.nombre}`);
    const cocina = await login('login-pin', { username: 'cocinero1', pin: '5678', estacionId: conMods.estacionId });
    await vaciarCola(conMods.estacionId, cocina);

    const enviar = async (items, extra = {}) => {
      const r = await http('POST', '/pedidos', mozo, { canalId: delivery, items, ...extra });
      if (r.status === 201) creados.push(r.data);
      return r;
    };
    const mods = conMods.modificadores;
    const termino = mods.find((m) => m.toLowerCase() === 'término medio') ?? mods[1];

    // --- Esc.1: el catálogo del plato es editable por el administrador y llega al comandero
    listaOriginal = [...mods];
    platoEditado = conMods;
    const guardar = (lista) => http('PUT', `/platos/${conMods.id}`, admin.token, {
      nombre: conMods.nombre, descripcion: conMods.descripcion, categoriaId: conMods.categoriaId, estacionId: conMods.estacionId,
      precio: conMods.precio, tiempoEstandarMinutos: conMods.tiempoEstandarMinutos, disponible: true, modificadores: lista,
    });
    const rEdit = await guardar([...mods, 'Prueba sin sal']);
    const tras = (await http('GET', `/platos/${conMods.id}`, mozo)).data;
    check('Esc.1 el administrador agrega un modificador al plato y el mozo lo recibe', rEdit.status === 200 && tras.modificadores.includes('Prueba sin sal'), `${rEdit.status}`);
    await guardar(listaOriginal);
    platoEditado = null;
    const rDup = await guardar(['Sin cebolla', 'sin CEBOLLA']);
    check('El catálogo rechaza modificadores repetidos', rDup.status === 400, `${rDup.status} ${rDup.data?.mensaje}`);

    // --- Esc.4: varios modificadores en un ítem, con el nombre del catálogo y sin repetidos
    const r4 = await enviar([{ platoId: conMods.id, cantidad: 2, modificadores: ` sin cebolla , ${termino.toUpperCase()}, Sin cebolla` }]);
    const guardado = r4.data?.items?.[0]?.modificadores;
    check('Esc.4 un ítem admite varios modificadores, guardados con el nombre del catálogo', r4.status === 201 && guardado === `Sin cebolla, ${termino}`, `${r4.status} ${guardado}`);
    check('El ítem conserva su cantidad', r4.data?.items?.[0]?.cantidad === 2);

    // --- Esc.1: un modificador que no es del plato se rechaza
    const rFuera = await enviar([{ platoId: conMods.id, cantidad: 1, modificadores: 'Con helado de vainilla' }]);
    check('Esc.1 un modificador ajeno al plato se rechaza indicando cuál', rFuera.status === 400 && /Con helado de vainilla/.test(rFuera.data?.mensaje ?? ''), `${rFuera.status} ${rFuera.data?.mensaje}`);

    // --- Esc.2: un plato sin modificadores solo admite cantidad
    const rSin = await enviar([{ platoId: sinMods.id, cantidad: 1, modificadores: 'Sin cebolla' }]);
    check('Esc.2 un plato sin modificadores no admite ninguno', rSin.status === 400 && /solo se puede indicar la cantidad/.test(rSin.data?.mensaje ?? ''), `${rSin.status} ${rSin.data?.mensaje}`);
    const rSoloCantidad = await enviar([{ platoId: sinMods.id, cantidad: 3 }]);
    check('Esc.2 con solo cantidad el mismo plato sí se registra', rSoloCantidad.status === 201 && rSoloCantidad.data.items[0].cantidad === 3, String(rSoloCantidad.status));

    // --- Esc.3: la cantidad válida va de 1 a 50
    for (const cantidad of [0, -1, 51]) {
      const r = await enviar([{ platoId: sinMods.id, cantidad }]);
      check(`Esc.3 la cantidad ${cantidad} se rechaza`, r.status === 400, `${r.status} ${r.data?.mensaje}`);
    }

    // --- Esc.5: el mismo plato con modificadores distintos queda en líneas separadas
    const r5 = await enviar([
      { platoId: conMods.id, cantidad: 1, modificadores: 'Sin cebolla' },
      { platoId: conMods.id, cantidad: 1, modificadores: termino },
    ]);
    const lineas = r5.data?.items ?? [];
    check('Esc.5 el mismo plato con modificadores distintos son líneas separadas', r5.status === 201 && lineas.length === 2 && lineas[0].modificadores !== lineas[1].modificadores, lineas.map((l) => l.modificadores).join(' | '));

    // --- Idempotencia: el reintento con los mismos modificadores en otro orden devuelve el mismo pedido
    const clave = `smoke008-${Date.now()}`;
    const a = await enviar([{ platoId: conMods.id, cantidad: 1, modificadores: `Sin cebolla, ${termino}` }], { claveIdempotencia: clave });
    const b = await http('POST', '/pedidos', mozo, { canalId: delivery, claveIdempotencia: clave, items: [{ platoId: conMods.id, cantidad: 1, modificadores: `${termino.toLowerCase()},sin cebolla` }] });
    check('Un reintento equivalente (otro orden o mayúsculas) devuelve el mismo pedido', a.status === 201 && b.status === 200 && b.data.id === a.data.id, `${a.status}/${b.status}`);

    // --- Cocina: cada modificador sale resaltado junto a su ítem
    const ctx = await browser.createBrowserContext();
    const page = await ctx.newPage();
    await page.setViewport({ width: 1440, height: 800 });
    await page.goto(`${BASE}/login`, { waitUntil: 'networkidle0' });
    await page.evaluate((t, u) => { localStorage.clear(); localStorage.setItem('kds_token', t); localStorage.setItem('kds_user', JSON.stringify(u)); }, admin.token, admin.user);
    await page.goto(`${BASE}/cocina`, { waitUntil: 'networkidle0' });
    await page.waitForSelector('select[aria-label="Estación"]', { timeout: 5000 });
    await page.select('select[aria-label="Estación"]', String(conMods.estacionId));
    const codigo = r4.data.codigoCorrelativo;
    const visible = await esperar(page, (c) => !!document.querySelector(`article[data-pedido="${c}"] [data-modificadores] span`), codigo, 5000);
    const textos = await page.$$eval(`article[data-pedido="${codigo}"] [data-modificadores] span`, (ss) => ss.map((s) => s.textContent.trim())).catch(() => []);
    check('Cocina muestra cada modificador resaltado', visible && textos.join('|') === ['Sin cebolla', termino].join('|'), textos.join(' | '));
    await page.screenshot({ path: path.join(OUT, 'hu008_cocina_modificadores.png') });
  } catch (e) {
    check('Ejecución sin excepciones', false, e.message);
  } finally {
    try {
      // Deja el catálogo como estaba aunque la prueba haya fallado a medias
      if (platoEditado && listaOriginal) {
        await http('PUT', `/platos/${platoEditado.id}`, admin.token, {
          nombre: platoEditado.nombre, descripcion: platoEditado.descripcion, categoriaId: platoEditado.categoriaId,
          estacionId: platoEditado.estacionId, precio: platoEditado.precio, tiempoEstandarMinutos: platoEditado.tiempoEstandarMinutos,
          disponible: true, modificadores: listaOriginal,
        });
      }
      await despacharItems(creados.flatMap((p) => p.items));
    } catch (e) {
      console.warn(`Limpieza incompleta: ${e.message}`);
    }
    await Promise.race([browser.close(), sleep(5000)]);
    const fallidas = results.filter((r) => !r.ok).length;
    console.log(`==== ${results.length - fallidas}/${results.length} comprobaciones OK`);
    process.exit(fallidas === 0 ? 0 : 1);
  }
})();
