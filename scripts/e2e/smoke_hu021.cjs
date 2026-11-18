// Smoke E2E HU021: tarjeta de pedido completa en la pantalla de estación (API real + Chrome)
// Cubre: los 6 elementos de la tarjeta, cronómetro que avanza cada segundo, destino según canal (zona y mesa o
// cliente), adiciones marcadas, pedido extenso sin cortes y cronómetro igual en dos PCs con relojes distintos.
const path = require('path');
const FRONT = path.resolve(__dirname, '../../frontend');
const puppeteer = require(path.join(FRONT, 'node_modules/puppeteer-core'));
const { sleep, http, login, loginCompleto, vaciarCola, cerrarMesa, despacharItems } = require('./lib.cjs');

const BASE = 'http://localhost:5173';
const OUT = process.env.E2E_OUT || require('os').tmpdir();
// Reloj de la "segunda PC": 7 minutos adelantado respecto de la primera
const DESFASE_PC_MS = 7 * 60 * 1000;

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
    const platos = (await http('GET', '/platos', mozo)).data.filter((p) => p.disponible && p.activo && p.estacionId === plancha);
    const conMods = platos.find((p) => p.modificadores.length > 0) ?? platos[0];
    const cocPlancha = await login('login-pin', { username: 'cocinero1', pin: '5678', estacionId: plancha });
    await vaciarCola(plancha, cocPlancha);

    const enviar = async (cuerpo) => {
      const r = await http('POST', '/pedidos', mozo, cuerpo);
      if (r.status !== 201) throw new Error(`pedido: ${r.status} ${r.data?.mensaje}`);
      creados.push(r.data);
      return r.data;
    };

    // Mesa de salón con su zona
    const mesas = (await http('GET', '/mesas', mozo)).data;
    const mesa = mesas.find((m) => !m.enAtencion);
    const abierta = await http('POST', `/mesas/${mesa.id}/atencion`, mozo, { personas: 2 });
    check('Prepara una mesa de salón', abierta.status === 200 || abierta.status === 201, String(abierta.status));
    mesaAbierta = mesa.id;
    const zonaNombre = mesa.zonaNombre ?? mesa.zona?.nombre;

    const modificador = conMods.modificadores[0];
    const pSalon = await enviar({ canalId: canal('SALON').id, mesaId: mesa.id, items: [{ platoId: conMods.id, cantidad: 2, modificadores: modificador }] });
    const pAdicion = await enviar({ canalId: canal('SALON').id, mesaId: mesa.id, items: [{ platoId: platos[0].id, cantidad: 1 }] });
    const pLlevar = await enviar({ canalId: canal('PARA_LLEVAR').id, clienteNombre: 'Rosa Gil', clienteTelefono: '955555555', items: [{ platoId: platos[0].id, cantidad: 1 }] });
    // Pedido extenso: 14 líneas en la misma estación
    const lineas = Array.from({ length: 14 }, (_, i) => ({ platoId: platos[i % platos.length].id, cantidad: i + 1 }));
    const pExtenso = await enviar({ canalId: canal('PARA_LLEVAR').id, clienteNombre: 'Pedido Extenso', clienteTelefono: '944444444', items: lineas });

    // --- Pantalla de Plancha (PC 1, reloj correcto)
    const abrirPlancha = async (adelantoMs) => {
      const ctx = await browser.createBrowserContext();
      const page = await ctx.newPage();
      await page.setViewport({ width: 1440, height: 900 });
      page.on('pageerror', (e) => errors.push(e.message));
      if (adelantoMs) {
        // Simula una PC con el reloj adelantado: Date.now y new Date() sin argumentos devuelven otra hora
        await page.evaluateOnNewDocument((ms) => {
          const ahoraReal = Date.now.bind(Date);
          const DateReal = Date;
          Date.now = () => ahoraReal() + ms;
          // eslint-disable-next-line no-global-assign
          Date = class extends DateReal {
            constructor(...args) { super(...(args.length ? args : [ahoraReal() + ms])); }
            static now() { return ahoraReal() + ms; }
          };
        }, adelantoMs);
      }
      await page.goto(`${BASE}/login`, { waitUntil: 'networkidle0' });
      await page.evaluate((t, u) => { localStorage.clear(); localStorage.setItem('kds_token', t); localStorage.setItem('kds_user', JSON.stringify(u)); }, admin.token, admin.user);
      await page.goto(`${BASE}/cocina`, { waitUntil: 'networkidle0' });
      await page.waitForSelector('select[aria-label="Estación"]', { timeout: 5000 });
      await page.select('select[aria-label="Estación"]', String(plancha));
      return page;
    };
    const page = await abrirPlancha(0);
    const tarjeta = (codigo) => `article[data-pedido="${codigo}"]`;
    check('Las tarjetas de la prueba aparecen en la estación', await esperar(page, (cs) => cs.every((c) => document.querySelector(`article[data-pedido="${c}"]`)), [pSalon, pAdicion, pLlevar, pExtenso].map((p) => p.codigoCorrelativo), 6000));

    // --- Esc.1: los 6 elementos
    const elementos = await page.$eval(tarjeta(pSalon.codigoCorrelativo), (a) => ({
      codigo: a.querySelector('.font-mono')?.innerText ?? '',
      canal: a.querySelector('[data-canal]')?.innerText ?? '',
      destino: a.querySelector('[data-destino]')?.innerText ?? '',
      items: a.querySelectorAll('li[data-item]').length,
      modificadores: [...a.querySelectorAll('[data-modificadores] span')].map((s) => s.innerText.toLowerCase()),
      cronometro: a.querySelector('[data-cronometro]')?.innerText ?? '',
    }));
    check('Esc.1 la tarjeta tiene código, canal, destino, ítems, modificadores y cronómetro',
      elementos.codigo.includes(pSalon.codigoCorrelativo) && /sal[oó]n/i.test(elementos.canal) && elementos.destino.length > 0
        && elementos.items === 1 && elementos.modificadores.includes(modificador.toLowerCase()) && /\d{2}:\d{2}/.test(elementos.cronometro),
      JSON.stringify(elementos));

    // --- Esc.2: el cronómetro avanza en vivo
    const segundos = (p, codigo) => p.$eval(`article[data-pedido="${codigo}"] [data-cronometro]`, (s) => Number(s.dataset.segundos)).catch(() => -1);
    const s0 = await segundos(page, pSalon.codigoCorrelativo);
    await sleep(2500);
    const s1 = await segundos(page, pSalon.codigoCorrelativo);
    check('Esc.2 el cronómetro avanza cada segundo sin recargar', s0 >= 0 && s1 - s0 >= 2 && s1 - s0 <= 4, `${s0} -> ${s1}`);

    // --- Esc.3: destino según canal
    check('Esc.3 en salón el destino indica zona y mesa', elementos.destino.includes(`Mesa ${mesa.numeroMesa}`) && (!zonaNombre || elementos.destino.includes(zonaNombre)), elementos.destino);
    const destinoLlevar = await page.$eval(`${tarjeta(pLlevar.codigoCorrelativo)} [data-destino]`, (p) => p.innerText).catch(() => '');
    check('Esc.3 en para llevar el destino indica el nombre del cliente', destinoLlevar === 'Rosa Gil', destinoLlevar);

    // --- Esc.4: adiciones marcadas
    const adicion = await page.$eval(tarjeta(pAdicion.codigoCorrelativo), (a) => ({
      cabecera: a.querySelector('[data-adicion]')?.innerText ?? '',
      items: a.querySelectorAll('li[data-item]').length,
      marcados: a.querySelectorAll('li[data-item] [data-item-adicion]').length,
    }));
    check('Esc.4 la comanda agregada a la mesa se marca como Adición 1 y cada ítem como adición', /Adición 1/i.test(adicion.cabecera) && adicion.items > 0 && adicion.marcados === adicion.items, JSON.stringify(adicion));
    check('Esc.4 la comanda original de la mesa no se marca como adición', await page.$eval(tarjeta(pSalon.codigoCorrelativo), (a) => !a.querySelector('[data-adicion]')));

    // --- Esc.5: pedido extenso sin cortes
    const extenso = await page.$eval(tarjeta(pExtenso.codigoCorrelativo), (a) => {
      const caja = a.getBoundingClientRect();
      const filas = [...a.querySelectorAll('li[data-item]')];
      return {
        filas: filas.length,
        dentro: filas.every((li) => { const r = li.getBoundingClientRect(); return r.top >= caja.top - 1 && r.bottom <= caja.bottom + 1; }),
        sinRecorte: a.scrollHeight <= a.clientHeight + 1,
      };
    });
    check('Esc.5 el pedido extenso muestra sus 14 ítems sin cortar información', extenso.filas === 14 && extenso.dentro && extenso.sinRecorte, JSON.stringify(extenso));
    await page.screenshot({ path: path.join(OUT, 'hu021_tarjetas.png'), fullPage: true });

    // --- Esc.6: otra PC con el reloj 7 minutos adelantado muestra el mismo tiempo transcurrido
    const otraPc = await abrirPlancha(DESFASE_PC_MS);
    await esperar(otraPc, (c) => !!document.querySelector(`article[data-pedido="${c}"] [data-cronometro]`), pSalon.codigoCorrelativo, 6000);
    // El desfase se mide con la primera respuesta de /reloj; se da un margen para que llegue
    let diferencia = Number.POSITIVE_INFINITY;
    for (let i = 0; i < 10 && diferencia > 2; i++) {
      await sleep(500);
      const [a, b] = await Promise.all([segundos(page, pSalon.codigoCorrelativo), segundos(otraPc, pSalon.codigoCorrelativo)]);
      diferencia = Math.abs(a - b);
    }
    check('Esc.6 dos PCs con relojes distintos muestran el mismo tiempo (±2 s)', diferencia <= 2, `diferencia ${diferencia} s con ${DESFASE_PC_MS / 60000} min de desfase`);

    check('Sin errores de JavaScript en las páginas', errors.length === 0, errors.join(' | '));
  } catch (e) {
    check('Ejecución sin excepciones', false, e.message);
  } finally {
    try {
      for (const p of creados) await despacharItems(p.items);
      if (mesaAbierta) await cerrarMesa(mesaAbierta, mozo, admin.token);
    } catch (e) {
      console.warn(`Limpieza incompleta: ${e.message}`);
    }
    await Promise.race([browser.close(), sleep(5000)]);
    const fallidas = results.filter((r) => !r.ok).length;
    console.log(`==== ${results.length - fallidas}/${results.length} comprobaciones OK`);
    process.exit(fallidas === 0 ? 0 : 1);
  }
})();
