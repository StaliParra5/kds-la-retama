// Smoke E2E HU030: marcar platos agotados y reactivarlos, en la API, por WebSocket y en el comandero
const path = require('path');
const FRONT = path.resolve(__dirname, '../../frontend');
const puppeteer = require(path.join(FRONT, 'node_modules/puppeteer-core'));
const { http, loginCompleto, sleep, stompSuscriptor, despacharItems } = require('./lib.cjs');

const BASE = 'http://localhost:5173';
const LIMITE_MS = 5000; // HU030 Escenario 1: el comandero se entera en menos de 5 segundos

async function esperar(page, fn, arg, ms = LIMITE_MS) {
  try {
    await page.waitForFunction(fn, { timeout: ms, polling: 100 }, arg);
    return true;
  } catch {
    return false;
  }
}

// Espera un mensaje de /topic/platos sobre el plato con la disponibilidad indicada
async function esperarAviso(recibidos, platoId, disponible, ms = LIMITE_MS) {
  const inicio = Date.now();
  while (Date.now() - inicio < ms) {
    if (recibidos['/topic/platos'].some((m) => m.platoId === platoId && m.disponible === disponible)) return Date.now() - inicio;
    await sleep(50);
  }
  return null;
}

(async () => {
  const results = [];
  const check = (name, ok, detail = '') => results.push({ name, ok, detail });
  const browser = await puppeteer.launch({
    executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new',
  });
  const errors = [];
  let A;
  let plato;
  let ws;
  const pedidosDePrueba = []; // se despachan al terminar para no dejarlos en las colas de cocina

  try {
    A = (await loginCompleto('login-admin', { username: 'admin', password: 'admin123' })).token;
    const mozo = await loginCompleto('login-pin', { username: 'angie', pin: '1234' });
    const M = mozo.token;
    const canalDelivery = (await http('GET', '/canales', M)).data.find((c) => c.codigo === 'DELIVERY');
    plato = (await http('GET', '/platos', M)).data.find((p) => p.disponible);

    // Escenario 4: un pedido enviado antes de agotar el plato no cambia
    const previo = await http('POST', '/pedidos', M, { canalId: canalDelivery.id, items: [{ platoId: plato.id, cantidad: 1 }] });
    check('Pedido con el plato antes de agotarlo (201)', previo.status === 201, String(previo.status));
    pedidosDePrueba.push(previo.data);

    const suscripcion = await stompSuscriptor(['/topic/platos'], M);
    ws = suscripcion.ws;

    // --- Escenario 1: agotar
    const agotar = await http('PATCH', `/platos/${plato.id}/disponibilidad`, A, { disponible: false });
    check('HU030 Esc.1 el admin marca el plato como agotado', agotar.status === 200 && agotar.data.disponible === false, String(agotar.status));
    const msAgotado = await esperarAviso(suscripcion.recibidos, plato.id, false);
    check('HU030 Esc.1 el comandero recibe el aviso en menos de 5 s (/topic/platos)', msAgotado !== null, `${msAgotado} ms`);

    // --- Escenario 5: agotado no es dado de baja
    const catalogo = (await http('GET', '/platos', A)).data.find((p) => p.id === plato.id);
    check('HU030 Esc.5 el plato sigue en el catálogo identificado como agotado', !!catalogo && catalogo.disponible === false);

    // --- Escenario 6: un pedido que lo incluye se rechaza indicando cuál
    const conAgotado = await http('POST', '/pedidos', M, { canalId: canalDelivery.id, items: [{ platoId: plato.id, cantidad: 1 }] });
    check('HU030 Esc.6 un pedido con el plato agotado se rechaza e indica cuál (400)',
      conAgotado.status === 400 && conAgotado.data.mensaje.includes(plato.nombre) && conAgotado.data.mensaje.includes('agotado'),
      `${conAgotado.status} ${conAgotado.data?.mensaje}`);

    // --- Escenario 4
    const previoTras = (await http('GET', `/pedidos/${previo.data.id}`, M)).data;
    check('HU030 Esc.4 los ítems ya enviados siguen sin cambios',
      previoTras.items.length === 1 && previoTras.items.every((i) => i.estadoItem !== 'ANULADO'), previoTras.items.map((i) => i.estadoItem).join(','));

    // --- Escenario 2: reactivar
    await http('PATCH', `/platos/${plato.id}/disponibilidad`, A, { disponible: true });
    const msReactivado = await esperarAviso(suscripcion.recibidos, plato.id, true);
    check('HU030 Esc.2 la reactivación también se avisa en menos de 5 s', msReactivado !== null, `${msReactivado} ms`);
    const tras = await http('POST', '/pedidos', M, { canalId: canalDelivery.id, items: [{ platoId: plato.id, cantidad: 1 }] });
    check('HU030 Esc.2 el plato vuelve a poder pedirse (201)', tras.status === 201, String(tras.status));
    if (tras.status === 201) pedidosDePrueba.push(tras.data);
    check('Un usuario sin sesión no se suscribe a /topic/platos',
      await stompSuscriptor(['/topic/platos']).then((s) => { s.ws.close(); return false; }, () => true));

    // --- Pantalla del comandero
    const page = await (await browser.createBrowserContext()).newPage();
    page.on('pageerror', (e) => errors.push(e.message));
    await page.setViewport({ width: 1600, height: 1000 });
    await page.goto(`${BASE}/login`, { waitUntil: 'networkidle0' });
    await page.evaluate((t, u) => {
      localStorage.setItem('kds_token', t);
      localStorage.setItem('kds_user', JSON.stringify(u));
    }, M, mozo.user);
    await page.goto(`${BASE}/comandero`, { waitUntil: 'networkidle0' });
    await page.$eval('[data-canal="DELIVERY"]', (b) => b.click());
    await page.waitForSelector(`[data-plato="${plato.id}"]`);
    await sleep(500); // la suscripción a /topic/platos queda activa
    await page.$eval(`[data-plato="${plato.id}"] button[title="Agregar a la comanda"]`, (b) => b.click());
    check('El plato se agrega a la comanda', await esperar(page, () => document.querySelectorAll('input[placeholder^="Nota de cocina"]').length === 1));

    // Escenarios 1 y 3: desaparece de la carta y la comanda en curso avisa
    await http('PATCH', `/platos/${plato.id}/disponibilidad`, A, { disponible: false });
    check('UI HU030 Esc.1 el plato desaparece de la carta en menos de 5 s', await esperar(page, (id) => !document.querySelector(`[data-plato="${id}"]`), plato.id));
    check('UI HU030 Esc.3 la línea de la comanda se marca como agotada', await esperar(page, () => !!document.querySelector('[data-linea-agotada]')));
    check('UI HU030 Esc.3 se avisa al mozo que debe retirarlo', await esperar(page, (n) => document.body.innerText.includes(`${n} se agotó`), plato.nombre));
    check('UI HU030 Esc.3 el envío queda bloqueado hasta retirarlo', await esperar(page, () =>
      !!document.querySelector('[data-aviso-agotados]')
      && Array.from(document.querySelectorAll('button')).find((b) => b.textContent.includes('ENVIAR A COCINA'))?.disabled === true));

    // Escenario 2: al reactivarlo vuelve a la carta y se puede enviar
    await http('PATCH', `/platos/${plato.id}/disponibilidad`, A, { disponible: true });
    check('UI HU030 Esc.2 el plato vuelve a la carta en menos de 5 s', await esperar(page, (id) => !!document.querySelector(`[data-plato="${id}"]`), plato.id));
    check('UI HU030 Esc.2 la línea deja de estar marcada y se puede enviar', await esperar(page, () =>
      !document.querySelector('[data-linea-agotada]')
      && Array.from(document.querySelectorAll('button')).find((b) => b.textContent.includes('ENVIAR A COCINA'))?.disabled === false));
    check('Sin errores de JavaScript', errors.length === 0, errors.join(' | '));
  } catch (e) {
    check('Ejecución sin excepciones', false, e.message);
  } finally {
    // El plato queda disponible aunque la prueba falle a mitad
    if (A && plato) await http('PATCH', `/platos/${plato.id}/disponibilidad`, A, { disponible: true });
    await despacharItems(pedidosDePrueba.flatMap((p) => p.items)).catch((e) => console.warn(`limpieza: ${e.message}`));
    ws?.close();
    await browser.close();
    for (const r of results) console.log(`${r.ok ? 'OK  ' : 'FAIL'} ${r.name}${r.detail ? ` (${r.detail})` : ''}`);
    process.exit(results.every((r) => r.ok) ? 0 : 1);
  }
})();
