// Smoke E2E HU016: cola unificada multicanal en la pantalla de estación
// Cubre: vista única de varios canales, orden por ingreso, pedido nuevo sin reordenar, filtro por canal
// (con recuerdo tras recargar), pedido despachado fuera de la cola y desplazamiento con total visible.
const path = require('path');
const FRONT = path.resolve(__dirname, '../../frontend');
const puppeteer = require(path.join(FRONT, 'node_modules/puppeteer-core'));
const { sleep, http, login, loginCompleto, vaciarCola, cerrarMesa, despacharItems } = require('./lib.cjs');

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

(async () => {
  const results = [];
  const check = (name, ok, detail = '') => results.push({ name, ok, detail });
  const browser = await puppeteer.launch({
    executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new',
  });
  const errors = [];
  const creados = [];
  let mesaAbierta = null;
  let mozo;
  let admin;

  try {
    mozo = await login('login-pin', { username: 'angie', pin: '1234' });
    admin = await loginCompleto('login-admin', { username: 'admin', password: 'admin123' });
    const canales = (await http('GET', '/canales', mozo)).data;
    const canal = (codigo) => canales.find((c) => c.codigo === codigo);
    const estaciones = (await http('GET', '/estaciones', mozo)).data;
    const plancha = estaciones.find((e) => e.codigo === 'PLANCHA').id;
    const platos = (await http('GET', '/platos', mozo)).data.filter((p) => p.disponible && p.estacionId === plancha);
    const cocPlancha = await login('login-pin', { username: 'cocinero1', pin: '5678', estacionId: plancha });
    await vaciarCola(plancha, cocPlancha);

    const crear = async (codigoCanal, extra = {}) => {
      const r = await http('POST', '/pedidos', mozo, { canalId: canal(codigoCanal).id, items: [{ platoId: platos[0].id, cantidad: 1 }], ...extra });
      if (r.status !== 201 && r.status !== 200) throw new Error(`pedido ${codigoCanal}: ${r.status} ${r.data?.mensaje}`);
      creados.push(r.data);
      return r.data;
    };

    // --- Pantalla de Plancha abierta como administrador (contexto aparte: su sesión no pisa a otras)
    const ctx = await browser.createBrowserContext();
    const page = await ctx.newPage();
    await page.setViewport({ width: 1440, height: 700 });
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(`${BASE}/login`, { waitUntil: 'networkidle0' });
    await page.evaluate((t, u) => { localStorage.clear(); localStorage.setItem('kds_token', t); localStorage.setItem('kds_user', JSON.stringify(u)); }, admin.token, admin.user);
    const abrirPlancha = async () => {
      await page.goto(`${BASE}/cocina`, { waitUntil: 'networkidle0' });
      await page.waitForSelector('select[aria-label="Estación"]', { timeout: 5000 });
      await page.select('select[aria-label="Estación"]', String(plancha));
    };
    await abrirPlancha();
    check('Estación sin pedidos al empezar', await esperar(page, () => document.body.innerText.includes('Sin pedidos')));

    const codigos = () => page.$$eval('article[data-pedido]', (as) => as.map((a) => a.dataset.pedido));
    const textoTotal = () => page.$eval('[data-total-pedidos]', (s) => s.innerText.replace(/\s+/g, ' ')).catch(() => '');

    // --- Esc.1 y 2: salón, para llevar y delivery propio conviven en una sola cola, por hora de ingreso
    const mesas = (await http('GET', '/mesas', mozo)).data;
    const mesa = mesas.find((m) => !m.enAtencion);
    const abierta = await http('POST', `/mesas/${mesa.id}/atencion`, mozo, { personas: 2 });
    check('Prepara una mesa de salón', abierta.status === 200 || abierta.status === 201, String(abierta.status));
    mesaAbierta = mesa.id;
    const pSalon = await crear('SALON', { mesaId: mesa.id });
    const pDelivery = await crear('DELIVERY');
    const pLlevar = await crear('PARA_LLEVAR', { clienteNombre: 'Cliente Prueba', clienteTelefono: '987654321' });
    const esperados = [pSalon, pDelivery, pLlevar].map((p) => p.codigoCorrelativo);
    const llegaron = await esperar(page, (cs) => cs.every((c) => document.querySelector(`article[data-pedido="${c}"]`)), esperados, 4000);
    check('Esc.1 pedidos de salón, delivery y para llevar aparecen en una única vista', llegaron);
    check('Esc.2 la cola está ordenada por hora de ingreso', JSON.stringify(await codigos()) === JSON.stringify(esperados), (await codigos()).join(','));
    check('Esc.6 el total de pedidos activos es visible', (await textoTotal()).includes('3 pedidos activos'), await textoTotal());

    // --- Esc.3: un pedido nuevo cae en su lugar sin reordenar los demás
    const pNuevo = await crear('DELIVERY');
    await esperar(page, (c) => !!document.querySelector(`article[data-pedido="${c}"]`), pNuevo.codigoCorrelativo, 4000);
    const trasNuevo = await codigos();
    check('Esc.3 el pedido nuevo queda al final y los demás conservan su orden', JSON.stringify(trasNuevo) === JSON.stringify([...esperados, pNuevo.codigoCorrelativo]), trasNuevo.join(','));

    // --- Esc.5: filtro por canal
    check('Esc.5 hay un botón de filtro por cada canal con pedidos', await page.$$eval('[data-filtro-canal]', (bs) => bs.map((b) => b.dataset.filtroCanal).sort().join(',')) === 'DELIVERY,PARA_LLEVAR,SALON,TODOS');
    await page.click('[data-filtro-canal="DELIVERY"]');
    await esperar(page, () => document.querySelectorAll('article[data-pedido]').length === 2);
    const filtrado = await codigos();
    check('Esc.5 al filtrar por Delivery solo se ven sus pedidos', JSON.stringify(filtrado) === JSON.stringify([pDelivery.codigoCorrelativo, pNuevo.codigoCorrelativo]), filtrado.join(','));
    check('Esc.5/6 el total muestra "2 de 4 pedidos activos"', (await textoTotal()).includes('2 de 4 pedidos activos'), await textoTotal());
    await page.screenshot({ path: path.join(OUT, 'hu016_filtro_delivery.png') });
    await page.click('[data-filtro-canal="TODOS"]');
    await esperar(page, () => document.querySelectorAll('article[data-pedido]').length === 4);
    check('Esc.5 al quitar el filtro vuelve la cola completa', (await codigos()).length === 4);

    // El filtro sobrevive a un reinicio de la pantalla
    await page.click('[data-filtro-canal="PARA_LLEVAR"]');
    await abrirPlancha();
    await esperar(page, () => document.querySelectorAll('article[data-pedido]').length === 1);
    check('El filtro elegido se recuerda tras recargar la pantalla', JSON.stringify(await codigos()) === JSON.stringify([pLlevar.codigoCorrelativo]), (await codigos()).join(','));

    // --- Esc.4: el pedido despachado deja de mostrarse; con el filtro puesto aparece el aviso para quitarlo
    await despacharItems(pLlevar.items);
    const sinPedidos = await esperar(page, () => !!document.querySelector('[data-filtro-sin-pedidos]'), null, 4000);
    check('Esc.4 el pedido despachado sale de la cola', sinPedidos);
    check('Esc.5 sin pedidos del canal se ofrece "Quitar filtro"', await page.$eval('[data-filtro-sin-pedidos]', (d) => d.innerText.includes('Quitar filtro')).catch(() => false));
    await page.screenshot({ path: path.join(OUT, 'hu016_filtro_vacio.png') });
    await page.evaluate(() => Array.from(document.querySelectorAll('button')).find((b) => b.textContent.trim() === 'Quitar filtro')?.click());
    await esperar(page, () => document.querySelectorAll('article[data-pedido]').length === 3);
    check('Quitar filtro devuelve los pedidos restantes', (await codigos()).length === 3);

    // --- Esc.6: más pedidos de los que caben en pantalla; se puede desplazar y el total sigue a la vista
    for (let i = 0; i < 8; i++) await crear('DELIVERY');
    await esperar(page, () => document.querySelectorAll('article[data-pedido]').length === 11, null, 5000);
    const desborda = await page.evaluate(() => document.documentElement.scrollHeight > window.innerHeight);
    check('Esc.6 la cola desborda la pantalla y permite desplazarse', desborda);
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await sleep(300);
    const totalVisible = await page.$eval('[data-total-pedidos]', (s) => {
      const r = s.getBoundingClientRect();
      return r.top >= 0 && r.bottom <= window.innerHeight;
    });
    check('Esc.6 al desplazarse el total de pedidos activos sigue visible', totalVisible);
    check('Esc.6 el total indica 11 pedidos activos', (await textoTotal()).includes('11 pedidos activos'), await textoTotal());
    await page.screenshot({ path: path.join(OUT, 'hu016_desplazamiento.png') });

    check('Sin errores de JavaScript en la página', errors.length === 0, errors.join(' | '));
  } catch (e) {
    check('Ejecución sin excepciones', false, e.message);
  } finally {
    // Limpieza: deja la estación sin los pedidos de esta prueba y libera la mesa
    try {
      for (const p of creados) await despacharItems(p.items);
      if (mesaAbierta) await cerrarMesa(mesaAbierta, mozo, admin.token);
    } catch (e) {
      console.warn(`Limpieza incompleta: ${e.message}`);
    }
    await browser.close();
    for (const r of results) console.log(`${r.ok ? 'OK  ' : 'FAIL'} ${r.name}${r.detail ? ` (${r.detail})` : ''}`);
    process.exit(results.every((r) => r.ok) ? 0 : 1);
  }
})();
