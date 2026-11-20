// Smoke E2E HU015: identificar el canal visualmente (API real + Chrome)
// Cubre: color e ícono propios por canal, color e ícono configurados usados en la tarjeta, color repetido o
// parecido al semáforo rechazado, mismo color e ícono de un pedido de Rappi en estación y pase, y franja del
// canal visible mientras el semáforo cambia de color. La lectura a 1,5 m (Esc. 2) se verifica a mano.
const path = require('path');
const FRONT = path.resolve(__dirname, '../../frontend');
const puppeteer = require(path.join(FRONT, 'node_modules/puppeteer-core'));
const { sleep, http, login, loginCompleto, activarCanal, vaciarCola, despacharItems } = require('./lib.cjs');

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
  let rappiOriginal;
  let restaurarRappi = async () => {};

  try {
    admin = await loginCompleto('login-admin', { username: 'admin', password: 'admin123' });
    const exp = await loginCompleto('login-pin', { username: 'expedidor1', pin: '9012' });
    restaurarRappi = await activarCanal('RAPPI');
    const canales = (await http('GET', '/canales/todos', admin.token)).data;
    const rappi = canales.find((c) => c.codigo === 'RAPPI');
    const salon = canales.find((c) => c.codigo === 'SALON');
    rappiOriginal = { id: rappi.id, color: rappi.color, icono: rappi.icono, sla: rappi.slaObjetivoMinutos, umbral: rappi.umbralAmbarPorcentaje };

    // --- Esc.1: cada canal tiene color e ícono propios
    const activos = canales.filter((c) => c.activo);
    const colores = new Set(activos.map((c) => c.color));
    check('Esc.1 cada canal activo tiene color e ícono configurados', activos.every((c) => /^#[0-9a-f]{6}$/.test(c.color ?? '') && c.icono), activos.map((c) => `${c.codigo}:${c.color}/${c.icono}`).join(' '));
    check('Esc.1 no hay dos canales activos con el mismo color', colores.size === activos.length);

    // --- Esc.4: color repetido o parecido al semáforo
    const apariencia = (color, icono = rappi.icono) => http('PUT', `/canales/${rappi.id}/apariencia`, admin.token, { color, icono });
    const repetido = await apariencia(salon.color);
    check('Esc.4 un color ya usado por otro canal activo se rechaza indicando cuál', repetido.status === 400 && (repetido.data?.mensaje ?? '').includes(salon.nombre), `${repetido.status} ${repetido.data?.mensaje}`);
    const parecidoRojo = await apariencia('#c2410c');
    check('Un color parecido al rojo del semáforo se rechaza', parecidoRojo.status === 400 && /semáforo/.test(parecidoRojo.data?.mensaje ?? ''), `${parecidoRojo.status} ${parecidoRojo.data?.mensaje}`);
    const claro = await apariencia('#fbcfe8');
    check('Un color demasiado claro para el texto blanco se rechaza', claro.status === 400 && /claro/.test(claro.data?.mensaje ?? ''), `${claro.status} ${claro.data?.mensaje}`);
    const mozoIntenta = await http('PUT', `/canales/${rappi.id}/apariencia`, await login('login-pin', { username: 'angie', pin: '1234' }), { color: '#be185d', icono: 'delivery_dining' });
    check('Solo el administrador cambia la apariencia de un canal', mozoIntenta.status === 403, String(mozoIntenta.status));

    // Pedido de Rappi en la estación de Plancha
    const estaciones = (await http('GET', '/estaciones', admin.token)).data;
    const plancha = estaciones.find((e) => e.codigo === 'PLANCHA').id;
    const platos = (await http('GET', '/platos', admin.token)).data.filter((p) => p.disponible && p.activo && p.estacionId === plancha);
    const cocPlancha = await login('login-pin', { username: 'cocinero1', pin: '5678', estacionId: plancha });
    await vaciarCola(plancha, cocPlancha);
    const r = await http('POST', '/pedidos/externo', exp.token, { canalId: rappi.id, numeroOrdenExterno: `RP-HU015-${Date.now()}`, items: [{ platoId: platos[0].id, cantidad: 1 }, { platoId: platos[0].id, cantidad: 2 }] });
    if (r.status !== 201) throw new Error(`pedido Rappi: ${r.status} ${r.data?.mensaje}`);
    creados.push(r.data);
    const codigo = r.data.codigoCorrelativo;

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
    const franja = (page) => page.$eval(`article[data-pedido="${codigo}"] [data-canal-franja]`, (f) => ({
      color: f.dataset.canalColor,
      fondo: getComputedStyle(f).backgroundColor,
      icono: f.querySelector('.material-symbols-outlined')?.textContent.trim(),
      nombre: f.querySelector('[data-canal]')?.textContent.trim(),
    })).catch(() => null);

    // --- Esc.3: la tarjeta usa el color e ícono configurados
    const cocina = await abrir('/cocina', admin, plancha);
    await esperar(cocina, (c) => !!document.querySelector(`article[data-pedido="${c}"] [data-canal-franja]`), codigo, 6000);
    const enCocina = await franja(cocina);
    check('Esc.3 la tarjeta de cocina usa el color e ícono configurados para Rappi', enCocina?.color === rappi.color && enCocina?.icono === rappi.icono, JSON.stringify(enCocina));

    // Esc.3: si el administrador cambia el color, la tarjeta abierta lo toma sin recargar
    const nuevo = await apariencia('#be185d');
    check('Un color válido se guarda', nuevo.status === 200 && nuevo.data.color === '#be185d', `${nuevo.status} ${nuevo.data?.mensaje ?? ''}`);
    const cambio = await esperar(cocina, (c) => document.querySelector(`article[data-pedido="${c}"] [data-canal-franja]`)?.dataset.canalColor === '#be185d', codigo, 4000);
    check('Esc.3 la tarjeta abierta toma el nuevo color sin recargar', cambio);

    // --- Esc.5: mismo color e ícono en la estación y en el pase
    for (const item of r.data.items) {
      await http('PATCH', `/items/${item.id}/estado`, cocPlancha, { estadoActual: 'RECIBIDO', estadoDestino: 'EN_PREPARACION' });
      await http('PATCH', `/items/${item.id}/estado`, cocPlancha, { estadoActual: 'EN_PREPARACION', estadoDestino: 'LISTO' });
    }
    const pase = await abrir('/pase', exp);
    await esperar(pase, (c) => !!document.querySelector(`article[data-pedido="${c}"] [data-canal-franja]`), codigo, 6000);
    const enPase = await franja(pase);
    // La tarjeta de cocina se ve hasta que el ítem sale; se compara con la apariencia guardada
    check('Esc.5 el pase muestra el mismo color e ícono del canal que la estación', enPase?.color === '#be185d' && enPase?.icono === rappi.icono && enPase?.nombre === rappi.nombre, JSON.stringify(enPase));
    await pase.screenshot({ path: path.join(OUT, 'hu015_pase_rappi.png') });

    // --- Esc.6: con el semáforo cambiando, la franja del canal sigue igual y visible
    const semAntes = await pase.$eval(`article[data-pedido="${codigo}"]`, (a) => a.dataset.semaforo);
    await http('PUT', `/canales/${rappi.id}/sla`, admin.token, { slaObjetivoMinutos: 1, umbralAmbarPorcentaje: 1 }); // ámbar a los 0,6 s de vida del pedido: no depende de cuánto lleve abierta la prueba
    const cambioSemaforo = await esperar(pase, (c) => document.querySelector(`article[data-pedido="${c}"]`)?.dataset.semaforo === 'ambar', codigo, 4000);
    const despues = await franja(pase);
    // D40: el semáforo se ve solo en el cronómetro (se revisa cada segundo, se le da un margen)
    await esperar(pase, (c) => /tertiary/.test(document.querySelector(`article[data-pedido="${c}"] [data-cronometro]`)?.className ?? ''), codigo, 3000);
    const crono = await pase.$eval(`article[data-pedido="${codigo}"] [data-cronometro]`, (s) => ({ clase: s.className, color: getComputedStyle(s).color })).catch(() => null);
    check('Esc.6 el semáforo cambia de color en el cronómetro sin recargar', semAntes === 'verde' && cambioSemaforo && /tertiary/.test(crono?.clase ?? ''), `${semAntes} -> ámbar`);
    check('Esc.6 la franja del canal se mantiene con su color y es distinta del color del cronómetro', despues?.color === '#be185d' && despues?.fondo !== crono?.color, `${despues?.fondo} / reloj ${crono?.color}`);
    await pase.screenshot({ path: path.join(OUT, 'hu015_semaforo_ambar.png') });

    check('Sin errores de JavaScript en las páginas', errors.length === 0, errors.join(' | '));
  } catch (e) {
    check('Ejecución sin excepciones', false, e.message);
  } finally {
    try {
      if (rappiOriginal && admin) {
        await http('PUT', `/canales/${rappiOriginal.id}/apariencia`, admin.token, { color: rappiOriginal.color, icono: rappiOriginal.icono });
        await http('PUT', `/canales/${rappiOriginal.id}/sla`, admin.token, { slaObjetivoMinutos: rappiOriginal.sla, umbralAmbarPorcentaje: rappiOriginal.umbral });
      }
      // Se relee el pedido: sus ítems ya avanzaron en la prueba y despacharItems parte del estado actual
      for (const p of creados) {
        const vigente = (await http('GET', `/pedidos/${p.id}`, admin.token)).data;
        await despacharItems(vigente?.items ?? p.items);
      }
      await restaurarRappi();
    } catch (e) {
      console.warn(`Limpieza incompleta: ${e.message}`);
    }
    await Promise.race([browser.close(), sleep(5000)]);
    const fallidas = results.filter((x) => !x.ok).length;
    console.log(`==== ${results.length - fallidas}/${results.length} comprobaciones OK`);
    process.exit(fallidas === 0 ? 0 : 1);
  }
})();
