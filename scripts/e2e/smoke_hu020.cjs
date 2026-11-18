// Smoke E2E HU020: registro manual de pedidos externos por el expedidor (API real + pantalla con Chrome)
// Cubre: canal obligatorio, pedido sin ítems, nombre, celular y dirección en WhatsApp/teléfono (Delivery propio),
// Rappi sin celular ni dirección y con su número de orden visible en la tarjeta, Para llevar sin dirección,
// mismo flujo que el comandero, expedidor y administrador (no el mozo), reintento sin duplicar y registro
// rápido desde la pantalla en menos de 60 s.
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

const clic = (page, selector) => page.evaluate((s) => document.querySelector(s)?.click(), selector);

(async () => {
  const results = [];
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
    const exp = await loginCompleto('login-pin', { username: 'expedidor1', pin: '9012' });
    const canales = (await http('GET', '/canales', mozo)).data;
    const delivery = canales.find((c) => c.codigo === 'DELIVERY');
    const rappi = canales.find((c) => c.codigo === 'RAPPI');
    const salon = canales.find((c) => c.codigo === 'SALON');
    const estaciones = (await http('GET', '/estaciones', mozo)).data;
    const plancha = estaciones.find((e) => e.codigo === 'PLANCHA').id;
    const platos = (await http('GET', '/platos', mozo)).data.filter((p) => p.disponible && p.activo && p.estacionId === plancha);
    const plato = platos[0];
    const cocPlancha = await login('login-pin', { username: 'cocinero1', pin: '5678', estacionId: plancha });
    await vaciarCola(plancha, cocPlancha);

    check('Rappi llega marcado como agregador para que el comandero del mozo no lo ofrezca', rappi?.externo === true && delivery?.externo === false, `${rappi?.externo}/${delivery?.externo}`);
    const manual = (cuerpo, token = exp.token) => http('POST', '/pedidos/externo', token, cuerpo);
    const items = [{ platoId: plato.id, cantidad: 1 }];
    const guardar = (r) => { if (r.status === 201) creados.push(r.data); return r; };

    // --- Esc.2 y 6
    const sinCanal = await manual({ items });
    check('Esc.2 sin canal no se registra', sinCanal.status === 400 && /canal/i.test(sinCanal.data?.mensaje ?? ''), `${sinCanal.status} ${sinCanal.data?.mensaje}`);
    const sinItems = await manual({ canalId: delivery.id, clienteNombre: 'Ana', clienteTelefono: '987654321', items: [] });
    check('Esc.6 sin platos no se registra', sinItems.status === 400 && /al menos un plato/.test(sinItems.data?.mensaje ?? ''), `${sinItems.status} ${sinItems.data?.mensaje}`);
    const enSalon = await manual({ canalId: salon.id, items });
    check('Salón no se registra como pedido externo', enSalon.status === 400 && /Salón/.test(enSalon.data?.mensaje ?? ''), `${enSalon.status} ${enSalon.data?.mensaje}`);

    // --- Esc.4: WhatsApp o teléfono (Delivery propio) piden nombre y celular
    const sinNombre = await manual({ canalId: delivery.id, clienteTelefono: '987654321', items });
    check('Esc.4 sin nombre del cliente se solicita', sinNombre.status === 400 && /nombre/.test(sinNombre.data?.mensaje ?? ''), `${sinNombre.status} ${sinNombre.data?.mensaje}`);
    const sinCelular = await manual({ canalId: delivery.id, clienteNombre: 'Ana Ruiz', items });
    check('Esc.4 sin celular válido se solicita', sinCelular.status === 400 && /celular/.test(sinCelular.data?.mensaje ?? ''), `${sinCelular.status} ${sinCelular.data?.mensaje}`);
    const sinDireccion = await manual({ canalId: delivery.id, clienteNombre: 'Ana Ruiz', clienteTelefono: '987654321', items });
    check('Esc.4 Delivery propio sin dirección de entrega se rechaza', sinDireccion.status === 400 && /dirección/.test(sinDireccion.data?.mensaje ?? ''), `${sinDireccion.status} ${sinDireccion.data?.mensaje}`);
    const whatsapp = guardar(await manual({ canalId: delivery.id, clienteNombre: 'Ana Ruiz', clienteTelefono: '987654321', clienteDireccion: 'Jr. Lima 456', items }));
    check('Esc.1/4 con nombre, celular y dirección el pedido de WhatsApp se registra con su canal', whatsapp.status === 201 && whatsapp.data.canalCodigo === 'DELIVERY' && whatsapp.data.clienteNombre === 'Ana Ruiz', `${whatsapp.status} ${whatsapp.data?.canalCodigo}`);
    const paraLlevar = canales.find((c) => c.codigo === 'PARA_LLEVAR');
    const pLlevar = guardar(await manual({ canalId: paraLlevar.id, clienteNombre: 'Rosa Gil', clienteTelefono: '955555555', clienteDireccion: 'Calle que no se guarda', items }));
    check('Para llevar es recojo en el local: se registra con nombre y celular', pLlevar.status === 201 && pLlevar.data.clienteNombre === 'Rosa Gil' && pLlevar.data.clienteTelefono === '955555555', `${pLlevar.status}`);

    // --- Esc.3: Rappi pide y guarda el número de orden
    const sinNumero = await manual({ canalId: rappi.id, items });
    check('Esc.3 un pedido de Rappi sin número de orden se rechaza', sinNumero.status === 400 && /número de orden de Rappi/.test(sinNumero.data?.mensaje ?? ''), `${sinNumero.status} ${sinNumero.data?.mensaje}`);
    // Número de orden único por corrida: con HU034 un número repetido en el mismo canal se rechaza
    const orden = `RP-${Date.now()}`;
    const pRappi = guardar(await manual({ canalId: rappi.id, numeroOrdenExterno: orden, clienteNombre: 'Pedro Rappi', clienteTelefono: '911111111', clienteDireccion: 'Calle X', items }));
    check('Esc.3 el número de orden de Rappi queda guardado', pRappi.status === 201 && pRappi.data.numeroOrdenExterno === orden && pRappi.data.canalCodigo === 'RAPPI', `${pRappi.status} ${pRappi.data?.numeroOrdenExterno}`);
    check('Rappi no guarda celular ni dirección del cliente, aunque lleguen; el nombre sí', pRappi.data?.clienteTelefono == null && pRappi.data?.clienteNombre === 'Pedro Rappi', `${pRappi.data?.clienteTelefono} / ${pRappi.data?.clienteNombre}`);

    // --- Esc.5: misma cola y mismo enrutamiento que el comandero
    const cola = (await http('GET', `/estaciones/${plancha}/cola`, cocPlancha)).data;
    const itemRappi = cola.find((i) => i.codigoPedido === pRappi.data?.codigoCorrelativo);
    check('Esc.5 el pedido externo aparece en la cola de su estación con su canal y número de orden', !!itemRappi && itemRappi.canalCodigo === 'RAPPI' && itemRappi.numeroOrdenExterno === orden && itemRappi.estado === 'RECIBIDO');
    const itemWhatsapp = cola.find((i) => i.codigoPedido === whatsapp.data?.codigoCorrelativo);
    check('Esc.5 el pedido de WhatsApp aparece en la misma cola con el cliente', !!itemWhatsapp && itemWhatsapp.canalCodigo === 'DELIVERY' && itemWhatsapp.clienteNombre === 'Ana Ruiz');

    // --- Solo el expedidor; reintento sin duplicar
    const rMozo = await manual({ canalId: delivery.id, clienteNombre: 'Ana', clienteTelefono: '987654321', items }, mozo);
    check('El mozo no puede registrar pedidos externos', rMozo.status === 403, String(rMozo.status));
    const rAdmin = guardar(await manual({ canalId: delivery.id, clienteNombre: 'Ana', clienteTelefono: '987654321', clienteDireccion: 'Av. Test 1', items }, admin.token));
    check('El administrador también puede registrar (provisional)', rAdmin.status === 201, String(rAdmin.status));
    const clave = `smoke020-${Date.now()}`;
    const a = guardar(await manual({ canalId: rappi.id, numeroOrdenExterno: `${orden}-B`, claveIdempotencia: clave, items }));
    const b = await manual({ canalId: rappi.id, numeroOrdenExterno: `${orden}-B`, claveIdempotencia: clave, items });
    check('Un reintento con la misma clave devuelve el mismo pedido sin duplicarlo', a.status === 201 && b.status === 200 && b.data.id === a.data.id, `${a.status}/${b.status}`);

    // --- D32: lista de pedidos externos recientes y anulación por el expedidor (solo en pedidos externos)
    const recientesApi = (await http('GET', '/pedidos/externos/recientes', exp.token)).data;
    check('D32 el expedidor lista los pedidos externos recientes (WhatsApp, Para llevar y Rappi)', Array.isArray(recientesApi) && [whatsapp, pLlevar, pRappi].every((p) => recientesApi.some((r) => r.id === p.data.id)), `${recientesApi.length} pedidos`);
    const pMozo = await http('POST', '/pedidos', mozo, { canalId: delivery.id, items });
    if (pMozo.status === 201) creados.push(pMozo.data);
    check('D32 un pedido del comandero no figura entre los externos', pMozo.status === 201 && !(await http('GET', '/pedidos/externos/recientes', exp.token)).data.some((r) => r.id === pMozo.data.id), String(pMozo.status));
    const anularItem = (itemId, token, estadoActual = 'RECIBIDO') => http('POST', `/items/${itemId}/anulacion`, token, { estadoActual, motivo: 'CLIENTE_SE_RETIRO' });
    const rExpAjeno = await anularItem(pMozo.data?.items?.[0]?.id, exp.token);
    check('D32 el expedidor no anula ítems de pedidos del comandero', rExpAjeno.status === 404, String(rExpAjeno.status));
    const rMozoAjeno = await anularItem(pRappi.data.items[0].id, mozo);
    check('D32 el mozo no anula ítems de pedidos externos', rMozoAjeno.status === 404, String(rMozoAjeno.status));
    const rMozoLista = await http('GET', '/pedidos/externos/recientes', mozo);
    check('D32 el mozo no consulta la lista de pedidos externos', rMozoLista.status === 403, String(rMozoLista.status));
    const rExpAnula = await anularItem(whatsapp.data.items[0].id, exp.token);
    check('D32 el expedidor anula un ítem de un pedido externo', rExpAnula.status === 200 && rExpAnula.data.estado === 'ANULADO', `${rExpAnula.status} ${rExpAnula.data?.estado}`);

    // --- Esc.1 (pantalla): registro rápido de un pedido de WhatsApp en menos de 60 s
    const ctx = await browser.createBrowserContext();
    const page = await ctx.newPage();
    await page.setViewport({ width: 1440, height: 900 });
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(`${BASE}/login`, { waitUntil: 'networkidle0' });
    await page.evaluate((t, u) => { localStorage.clear(); localStorage.setItem('kds_token', t); localStorage.setItem('kds_user', JSON.stringify(u)); }, exp.token, exp.user);
    await page.goto(`${BASE}/pase`, { waitUntil: 'networkidle0' });
    check('El pase ofrece "Registrar pedido externo"', await esperar(page, () => !!document.querySelector('[data-registrar-externo]'), null, 5000));
    const inicio = Date.now();
    await clic(page, '[data-registrar-externo]');
    await page.waitForSelector('[data-canal-externo]', { timeout: 5000 });
    const botones = await page.$$eval('[data-canal-externo]', (bs) => bs.map((b) => b.dataset.canalExterno).sort().join(','));
    check('La pantalla ofrece los canales no Salón (Delivery propio, Para llevar y Rappi)', botones === 'DELIVERY,PARA_LLEVAR,RAPPI', botones);
    const erroresSinCanal = await page.$eval('[data-errores-externo]', (u) => u.innerText).catch(() => '');
    check('Esc.2 sin canal la pantalla lo pide y no deja enviar', /Seleccione el canal/.test(erroresSinCanal) && await page.$eval('[data-enviar-externo]', (b) => b.disabled));

    await clic(page, '[data-canal-externo="DELIVERY"]');
    await page.waitForSelector('#externo-nombre', { timeout: 3000 });
    const erroresContacto = await page.$eval('[data-errores-externo]', (u) => u.innerText);
    check('Esc.4/6 la pantalla pide nombre, dirección y platos (sin aviso aparte del celular)', /nombre/.test(erroresContacto) && /dirección/.test(erroresContacto) && /plato/.test(erroresContacto) && !/celular/.test(erroresContacto), erroresContacto.replace(/\s+/g, ' '));
    check('Las etiquetas no dicen "obligatorio"', !(await page.evaluate(() => document.body.innerText.toLowerCase().includes('obligatorio'))));
    await page.type('#externo-nombre', 'Luis Prueba');
    // Con el celular incompleto aparece, en rojo bajo el campo, que falta completar los 9 dígitos
    await page.type('#externo-telefono', '9123');
    const avisoCelular = await page.$eval('[data-aviso-celular]', (p) => {
      const [r, g, b] = getComputedStyle(p).color.match(/\d+/g).map(Number);
      return { texto: p.innerText, color: getComputedStyle(p).color, rojo: r > g + 80 && r > b + 80 };
    }).catch(() => null);
    check('Celular incompleto: aviso rojo "Complete los 9 dígitos" bajo el campo', !!avisoCelular && /Complete los 9 dígitos/.test(avisoCelular.texto) && avisoCelular.rojo, JSON.stringify(avisoCelular));
    check('Con el celular incompleto el envío sigue bloqueado', await page.$eval('[data-enviar-externo]', (b) => b.disabled));
    // El celular solo admite dígitos y hasta 9: lo que sobra no entra
    await page.type('#externo-telefono', '4567899ab');
    check('El celular se limita a 9 dígitos', (await page.$eval('#externo-telefono', (i) => i.value)) === '912345678');
    check('Con los 9 dígitos el aviso del celular desaparece', !(await page.$('[data-aviso-celular]')));
    await page.type('#externo-direccion', 'Jr. Lima 456');
    await page.type('#externo-buscar', plato.nombre.slice(0, 4));
    await page.waitForSelector(`[data-plato-agregar="${plato.id}"]`, { timeout: 3000 });
    await clic(page, `[data-plato-agregar="${plato.id}"]`);
    check('Agregar un plato lo suma al pedido y deja enviar', await esperar(page, () => !document.querySelector('[data-enviar-externo]').disabled, null, 2000));
    await clic(page, '[data-enviar-externo]');
    const enviado = await esperar(page, () => !!document.querySelector('[data-ultimo-externo]'), null, 5000);
    const segundos = (Date.now() - inicio) / 1000;
    check('Esc.1 el pedido de WhatsApp se registra desde la pantalla en menos de 60 s', enviado && segundos < 60, `${segundos.toFixed(1)} s`);
    const codigoUi = await page.$eval('[data-ultimo-externo]', (p) => p.dataset.ultimoExterno).catch(() => null);
    const colaUi = (await http('GET', `/estaciones/${plancha}/cola`, cocPlancha)).data;
    const itemUi = colaUi.find((i) => i.codigoPedido === codigoUi);
    check('Esc.1/5 entra a la cola con su canal y el cliente', !!itemUi && itemUi.canalCodigo === 'DELIVERY' && itemUi.clienteNombre === 'Luis Prueba', JSON.stringify(itemUi ?? null));
    if (codigoUi) creados.push({ codigoCorrelativo: codigoUi, items: [] });
    check('Tras enviar el formulario queda limpio y conserva el canal', await page.$eval('#externo-nombre', (i) => i.value === '').catch(() => false));

    // Para llevar es recojo en el local: celular sí, dirección no
    await clic(page, '[data-canal-externo="PARA_LLEVAR"]');
    await page.waitForSelector('#externo-telefono', { timeout: 3000 });
    check('Para llevar pide celular y no muestra dirección', !!(await page.$('#externo-telefono')) && !(await page.$('#externo-direccion')));

    // --- Esc.3 (pantalla): Rappi pide el número de orden, sin celular ni dirección
    await clic(page, '[data-canal-externo="RAPPI"]');
    await page.waitForSelector('#externo-numero-orden', { timeout: 3000 });
    const erroresRappi = await page.$eval('[data-errores-externo]', (u) => u.innerText);
    check('Esc.3 en Rappi la pantalla pide el número de orden y no el celular', /número de orden de Rappi/.test(erroresRappi) && !/celular/.test(erroresRappi), erroresRappi.replace(/\s+/g, ' '));
    check('Rappi no muestra campos de celular ni dirección', !(await page.$('#externo-telefono')) && !(await page.$('#externo-direccion')));
    const ordenUi = `RP-UI-${Date.now()}`;
    await page.type('#externo-numero-orden', ordenUi);
    await page.type('#externo-buscar', plato.nombre.slice(0, 4));
    await page.waitForSelector(`[data-plato-agregar="${plato.id}"]`, { timeout: 3000 });
    await clic(page, `[data-plato-agregar="${plato.id}"]`);
    await clic(page, '[data-enviar-externo]');
    await esperar(page, () => document.querySelector('[data-ultimo-externo]')?.innerText.includes('Orden'), null, 5000);
    const codigoRappiUi = await page.$eval('[data-ultimo-externo]', (p) => p.dataset.ultimoExterno).catch(() => null);
    if (codigoRappiUi) creados.push({ codigoCorrelativo: codigoRappiUi, items: [] });
    await page.screenshot({ path: path.join(OUT, 'hu020_registro_externo.png') });

    // --- Esc.3: el número de orden se ve en la tarjeta de cocina y del pase (otra pantalla)
    const ctxCocina = await browser.createBrowserContext();
    const cocina = await ctxCocina.newPage();
    await cocina.setViewport({ width: 1440, height: 900 });
    cocina.on('pageerror', (e) => errors.push(e.message));
    await cocina.goto(`${BASE}/login`, { waitUntil: 'networkidle0' });
    await cocina.evaluate((t, u) => { localStorage.clear(); localStorage.setItem('kds_token', t); localStorage.setItem('kds_user', JSON.stringify(u)); }, admin.token, admin.user);
    await cocina.goto(`${BASE}/cocina`, { waitUntil: 'networkidle0' });
    await cocina.waitForSelector('select[aria-label="Estación"]', { timeout: 5000 });
    await cocina.select('select[aria-label="Estación"]', String(plancha));
    const tarjeta = await esperar(cocina, (c) => !!document.querySelector(`article[data-pedido="${c}"] [data-orden-externo]`), codigoRappiUi, 5000);
    const textoTarjeta = await cocina.$eval(`article[data-pedido="${codigoRappiUi}"] [data-orden-externo]`, (p) => p.innerText).catch(() => '');
    check('Esc.3 la tarjeta de cocina muestra el número de orden de Rappi', tarjeta && textoTarjeta.includes(ordenUi), textoTarjeta);
    await cocina.screenshot({ path: path.join(OUT, 'hu020_tarjeta_rappi.png') });

    // --- D32 (pantalla): pestaña Recientes, con el pedido de Rappi recién registrado, y anulación por el expedidor
    await page.bringToFront();
    const textoPestana = await page.$eval('[data-pestana="recientes"]', (b) => b.innerText);
    check('La pestaña Recientes muestra la cantidad de pedidos externos', /Recientes \(\d+\)/.test(textoPestana), textoPestana);
    await clic(page, '[data-pestana="recientes"]');
    const hayLista = await esperar(page, (c) => !!document.querySelector(`[data-recientes] [data-pedido-enviado="${c}"]`), codigoRappiUi, 5000);
    const textoPedido = await page.$eval(`[data-pedido-enviado="${codigoRappiUi}"]`, (e) => e.innerText).catch(() => '');
    check('Recientes lista el pedido de Rappi con su canal y número de orden', hayLista && textoPedido.includes('Rappi') && textoPedido.includes(ordenUi), textoPedido.replace(/\s+/g, ' '));
    const idItem = await page.$eval(`[data-pedido-enviado="${codigoRappiUi}"] [data-anular-item]`, (b) => b.dataset.anularItem).catch(() => null);
    // Cocina inicia el ítem: Recientes debe mostrarlo En preparación sola, sin recargar ni intentar anular
    const tInicio = Date.now();
    await http('PATCH', `/items/${idItem}/estado`, cocPlancha, { estadoActual: 'RECIBIDO', estadoDestino: 'EN_PREPARACION' });
    const cambio = await esperar(page, (i) => document.querySelector(`[data-item-enviado="${i}"]`)?.dataset.estado === 'EN_PREPARACION', idItem, 4000);
    const msCambio = Date.now() - tInicio;
    check('Recientes refleja el avance de cocina en 2 s o menos, sin recargar', cambio && msCambio <= 2000, `${msCambio} ms`);
    await clic(page, `[data-anular-item="${idItem}"]`);
    check('Anular abre el diálogo de motivo', await esperar(page, () => !!document.querySelector('[data-dialogo-anular] input[name="motivo-anulacion"]'), null, 4000));
    check('Sin motivo no se puede confirmar la anulación', await page.$eval('[data-confirmar-anulacion]', (b) => b.disabled));
    await page.evaluate(() => document.querySelector('input[name="motivo-anulacion"]')?.click());
    // D36: el ítem ya está en preparación; el expedidor necesita la clave del administrador
    check('D36 el diálogo pide la autorización del administrador', !!(await page.$('[data-autorizacion-admin]')));
    check('D36 sin la clave del administrador no se puede confirmar', await page.$eval('[data-confirmar-anulacion]', (b) => b.disabled));
    await page.type('#anulacion-admin-usuario', 'admin');
    await page.type('#anulacion-admin-password', 'admin123');
    await clic(page, '[data-confirmar-anulacion]');
    const anuladoUi = await esperar(page, (i) => document.querySelector(`[data-item-enviado="${i}"]`)?.dataset.estado === 'ANULADO', idItem, 5000);
    check('El expedidor anula el ítem desde Recientes y queda como Anulado', anuladoUi);
    await page.screenshot({ path: path.join(OUT, 'hu020_recientes_anulado.png') });

    check('Sin errores de JavaScript en las páginas', errors.length === 0, errors.join(' | '));
  } catch (e) {
    check('Ejecución sin excepciones', false, e.message);
  } finally {
    try {
      const admin = await loginCompleto('login-admin', { username: 'admin', password: 'admin123' });
      for (const c of creados) {
        let items = c.items;
        if (!items.length) {
          // Los pedidos creados desde la pantalla solo se conocen por su código: se buscan entre los activos
          const activos = (await http('GET', '/pedidos/activos', admin.token)).data;
          items = activos.find((p) => p.codigoCorrelativo === c.codigoCorrelativo)?.items ?? [];
        }
        await despacharItems(items);
      }
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
