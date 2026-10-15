// Script automatizado para la toma exhaustiva de capturas de pantalla de La Retama KDS (Sprint 1)
// Cubre cada pantalla, vista, micro-vista, selector, modal, estado de carga, validación y respuesta táctil.
const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

const OUTPUT_DIR = '/home/stan/Imágenes/capturas KDS';
const CHROME_PATH = '/home/stan/.local/bin/google-chrome';
const BASE_URL = 'http://localhost:5173';

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Token JWT y datos de sesión para admin
const ADMIN_TOKEN = "eyJhbGciOiJIUzM4NCJ9.eyJzdWIiOiJhZG1pbiIsInVzdWFyaW9JZCI6MSwicm9sZSI6IkFETUlOIiwiaWF0IjoxNzkyMDM2NDA5LCJleHAiOjE3OTIwNjUyMDl9.pLGA1HnlxVOYo-E0tMiH7s7A3Ejekhlyo9rFCDU6omNiHj8f73Cu6XwjQMNB-qP4";
const ADMIN_USER = {
  id: 1,
  username: "admin",
  nombreCompleto: "Administrador Sistema",
  rol: "ADMIN",
  estacionId: null,
  estacionNombre: null
};

async function setAdminSession(page) {
  await page.evaluate((token, user) => {
    localStorage.setItem('kds_token', token);
    localStorage.setItem('kds_user', JSON.stringify(user));
  }, ADMIN_TOKEN, ADMIN_USER);
}

async function clearSession(page) {
  await page.evaluate(() => {
    localStorage.removeItem('kds_token');
    localStorage.removeItem('kds_user');
  });
}

async function run() {
  console.log('🚀 Iniciando suite de capturas automáticas para KDS...');
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1920,1080'],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });

  let captureIndex = 1;
  async function capture(fileName, description) {
    const fullPath = path.join(OUTPUT_DIR, fileName);
    await page.screenshot({ path: fullPath, fullPage: false });
    console.log(`[${captureIndex++}/51] 📸 Guardado: ${fileName} - ${description}`);
  }

  try {
    // =========================================================================
    // SECCIÓN 1: LOGIN Y CONTROL DE ACCESO (HU001 & HU002)
    // =========================================================================
    console.log('\n--- 1. Capturando Módulo de Autenticación ---');
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle0' });
    await clearSession(page);
    await page.reload({ waitUntil: 'networkidle0' });
    await sleep(600);

    // 01: Login PIN Inicial
    await capture('01_Login_PIN_Pantalla_Inicial.png', 'Pantalla de acceso por PIN numérico de 4 dígitos para cocina y sala');

    // 02: Login PIN Ingresando dígitos (1, 2, 3)
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const b1 = buttons.find(b => b.textContent.trim() === '1');
      if (b1) b1.click();
    });
    await sleep(150);
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const b2 = buttons.find(b => b.textContent.trim() === '2');
      if (b2) b2.click();
    });
    await sleep(150);
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const b3 = buttons.find(b => b.textContent.trim() === '3');
      if (b3) b3.click();
    });
    await sleep(300);
    await capture('02_Login_PIN_Ingresando_Digitos.png', 'PIN con 3 dígitos ingresados (indicadores esféricos activos)');

    // 03: PIN con dígito 9 (inválido 1239) para disparar error
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const b9 = buttons.find(b => b.textContent.trim() === '9');
      if (b9) b9.click();
    });
    await sleep(900);
    await capture('03_Login_PIN_Error_Credenciales.png', 'Banner de error de PIN incorrecto o usuario inactivo');

    // 04: Pestaña Administración Limpio
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const adminTab = buttons.find(b => b.textContent.includes('Administración'));
      if (adminTab) adminTab.click();
      const inputs = document.querySelectorAll('input');
      inputs.forEach(i => {
        i.value = '';
        i.dispatchEvent(new Event('input', { bubbles: true }));
      });
    });
    await sleep(500);
    await capture('04_Login_Admin_Formulario_Limpio.png', 'Formulario de acceso administrativo con credenciales vacías');

    // 05: Llenar credenciales válidas
    await page.evaluate(() => {
      const inputs = document.querySelectorAll('input');
      if (inputs[0]) {
        inputs[0].value = 'admin';
        inputs[0].dispatchEvent(new Event('input', { bubbles: true }));
      }
      if (inputs[1]) {
        inputs[1].value = 'admin123';
        inputs[1].dispatchEvent(new Event('input', { bubbles: true }));
      }
    });
    await sleep(300);
    await capture('05_Login_Admin_Credenciales_Llenas.png', 'Credenciales administrativas válidas ingresadas');

    // 06: Provocar error con contraseña inválida
    await page.evaluate(() => {
      const inputs = document.querySelectorAll('input');
      if (inputs[1]) {
        inputs[1].value = 'password_incorrecta';
        inputs[1].dispatchEvent(new Event('input', { bubbles: true }));
      }
      const submit = document.querySelector('button[type="submit"]');
      if (submit) submit.click();
    });
    await sleep(900);
    await capture('06_Login_Admin_Error_Credenciales.png', 'Alerta de error ante credenciales de administrador inválidas');

    // =========================================================================
    // INICIAR SESIÓN COMO ADMIN PARA TENER ACCESO COMPLETO
    // =========================================================================
    console.log('\n--- Estableciendo sesión administrativa ---');
    await setAdminSession(page);

    // =========================================================================
    // SECCIÓN 2: COMANDERO DE SALA (HU006, HU007 & HU023)
    // =========================================================================
    console.log('\n--- 2. Capturando Módulo Comandero de Sala ---');
    await page.goto(`${BASE_URL}/comandero`, { waitUntil: 'networkidle0' });
    await sleep(1000);

    // 07: Comandero inicial en Salón
    await capture('07_Comandero_Vista_General_Salon.png', 'Vista inicial del comandero en canal Salón con catálogo y comanda');

    // 08: Selector de Canal: Para Llevar
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const paraLlevar = buttons.find(b => b.textContent.includes('Para Llevar'));
      if (paraLlevar) paraLlevar.click();
    });
    await sleep(500);
    await capture('08_Comandero_Canal_ParaLlevar.png', 'Comandero configurado en canal Para Llevar (SLA 15m sin mesa)');

    // 09: Selector de Canal: Delivery
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const delivery = buttons.find(b => b.textContent.includes('Delivery'));
      if (delivery) delivery.click();
    });
    await sleep(500);
    await capture('09_Comandero_Canal_Delivery.png', 'Comandero configurado en canal Delivery (SLA 30m)');

    // Volver a Salón
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const salon = buttons.find(b => b.textContent.includes('Salón'));
      if (salon) salon.click();
    });
    await sleep(500);

    // 10: Filtro de Zona Salón Principal
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const b = buttons.find(btn => btn.textContent.trim() === 'Salón Principal');
      if (b) b.click();
    });
    await sleep(300);
    await capture('10_Comandero_Filtro_Zona_SalonPrincipal.png', 'Filtro por zona física Salón Principal');

    // 11: Filtro de Zona Terraza
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const b = buttons.find(btn => btn.textContent.trim() === 'Terraza');
      if (b) b.click();
    });
    await sleep(300);
    await capture('11_Comandero_Filtro_Zona_Terraza.png', 'Filtro por zona física Terraza con sus mesas correspondientes');

    // 12: Filtro de Zona Barra
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const b = buttons.find(btn => btn.textContent.trim() === 'Barra');
      if (b) b.click();
    });
    await sleep(300);
    await capture('12_Comandero_Filtro_Zona_Barra.png', 'Filtro por zona física Barra con mesas de bar');

    // Restablecer a Todas las zonas
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const b = buttons.find(btn => btn.textContent.trim() === 'Todas');
      if (b) b.click();
    });
    await sleep(300);

    // 13: Desplegable de Mesas Detalle
    await capture('13_Comandero_Selector_Mesas_Detalle.png', 'Selector táctil de mesas y capacidades de comensales');

    // 14: Categoría Todos los Platos
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const b = buttons.find(btn => btn.textContent.trim() === 'Todos los Platos');
      if (b) b.click();
    });
    await sleep(300);
    await capture('14_Comandero_Categoria_Todos.png', 'Catálogo con todos los platos de la carta');

    // 15: Categoría Entradas
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const b = buttons.find(btn => btn.textContent.trim() === 'Entradas');
      if (b) b.click();
    });
    await sleep(300);
    await capture('15_Comandero_Categoria_Entradas.png', 'Catálogo filtrado por la categoría Entradas');

    // 16: Categoría Fondos
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const b = buttons.find(btn => btn.textContent.trim() === 'Fondos');
      if (b) b.click();
    });
    await sleep(300);
    await capture('16_Comandero_Categoria_Fondos.png', 'Catálogo filtrado por la categoría Fondos');

    // 17: Categoría Bebidas
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const b = buttons.find(btn => btn.textContent.trim() === 'Bebidas');
      if (b) b.click();
    });
    await sleep(300);
    await capture('17_Comandero_Categoria_Bebidas.png', 'Catálogo filtrado por la categoría Bebidas');

    // 18: Categoría Postres
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const b = buttons.find(btn => btn.textContent.trim() === 'Postres');
      if (b) b.click();
    });
    await sleep(300);
    await capture('18_Comandero_Categoria_Postres.png', 'Catálogo filtrado por la categoría Postres');

    // Restablecer categorías
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const b = buttons.find(btn => btn.textContent.trim() === 'Todos los Platos');
      if (b) b.click();
    });
    await sleep(300);

    // 19: Búsqueda reactiva con texto 'Lomo'
    await page.evaluate(() => {
      const input = document.querySelector('input[placeholder*="Buscar plato"]');
      if (input) {
        input.value = 'Lomo';
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }
    });
    await sleep(400);
    await capture('19_Comandero_Busqueda_Reactiva_Lomo.png', 'Búsqueda instantánea con coincidencia reactiva para Lomo');

    // 20: Búsqueda reactiva con texto 'Ceviche'
    await page.evaluate(() => {
      const input = document.querySelector('input[placeholder*="Buscar plato"]');
      if (input) {
        input.value = 'Ceviche';
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }
    });
    await sleep(400);
    await capture('20_Comandero_Busqueda_Reactiva_Ceviche.png', 'Búsqueda instantánea con coincidencia reactiva para Ceviche');

    // 21: Búsqueda sin resultados
    await page.evaluate(() => {
      const input = document.querySelector('input[placeholder*="Buscar plato"]');
      if (input) {
        input.value = 'PlatoInexistente123';
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }
    });
    await sleep(400);
    await capture('21_Comandero_Busqueda_Sin_Resultados.png', 'Estado vacío cuando la búsqueda no produce coincidencias');

    // Limpiar búsqueda
    await page.evaluate(() => {
      const input = document.querySelector('input[placeholder*="Buscar plato"]');
      if (input) {
        input.value = '';
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }
    });
    await sleep(400);

    // =========================================================================
    // SECCIÓN 3: GESTIÓN DE COMANDA Y AUTOREGULACIÓN (HU006 & HU007)
    // =========================================================================
    console.log('\n--- 3. Capturando Inspector de Comanda y Modificadores ---');

    // 22: Comanda Vacía
    await capture('22_Comandero_Comanda_Vacia.png', 'Inspector de comanda vacío con llamada a la acción');

    // Agregar 1 plato a la comanda
    await page.evaluate(() => {
      const addBtns = Array.from(document.querySelectorAll('button[title="Agregar a la comanda"]'));
      if (addBtns[0]) addBtns[0].click();
    });
    await sleep(400);

    // 23: Comanda con 1 ítem (Autorregulable compacta)
    await capture('23_Comandero_Comanda_1_Item_Compacta.png', 'Comanda con 1 plato demostrando ajuste compacto de altura sin scroll');

    // 24: Modificador de preparación
    await page.evaluate(() => {
      const modInput = document.querySelector('input[placeholder*="Modificadores"]');
      if (modInput) {
        modInput.value = 'Término 3/4, sin papas fritas (ensalada extra)';
        modInput.dispatchEvent(new Event('input', { bubbles: true }));
      }
    });
    await sleep(300);
    await capture('24_Comandero_Comanda_Item_Con_Modificador.png', 'Detalle de comanda con modificador de cocción especificado');

    // Agregar múltiples platos para demostrar scroll autónomo y footer sticky
    await page.evaluate(() => {
      const addBtns = Array.from(document.querySelectorAll('button[title="Agregar a la comanda"]'));
      for (let i = 1; i < Math.min(addBtns.length, 7); i++) {
        addBtns[i].click();
      }
    });
    await sleep(500);

    // 25: Comanda con múltiples ítems y scroll
    await capture('25_Comandero_Comanda_Multiple_Items_Scroll.png', 'Comanda con 6 ítems demostrando scroll interno y total fijo');

    // 26: Observaciones generales
    await page.evaluate(() => {
      const obsInput = document.querySelector('input[placeholder*="Observaciones generales"]');
      if (obsInput) {
        obsInput.value = 'Mesa de cumpleaños: servir entradas primero por favor.';
        obsInput.dispatchEvent(new Event('input', { bubbles: true }));
      }
    });
    await sleep(300);
    await capture('26_Comandero_Comanda_Observaciones_Generales.png', 'Campo de observaciones del ticket completado');

    // 27: Enviar a Cocina con Toast
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const btn = buttons.find(b => b.textContent.includes('ENVIAR A COCINA'));
      if (btn) btn.click();
    });
    await sleep(700);
    await capture('27_Comandero_Envio_Cocina_Toast_Exitoso.png', 'Notificación Toast de confirmación de comanda creada y correlativo asignado');

    // =========================================================================
    // SECCIÓN 4: CATÁLOGO DE PLATOS Y SLA (HU003 & HU023)
    // =========================================================================
    console.log('\n--- 4. Capturando Módulo Catálogo de Platos (Admin) ---');
    await page.goto(`${BASE_URL}/admin/platos`, { waitUntil: 'networkidle0' });
    await sleep(1000);

    // 28: Catálogo General
    await capture('28_Admin_Platos_Listado_General.png', 'Vista de catálogo con KPIs, tiempos SLA y tabla de platos');

    // 29: Filtro por Estación Plancha
    await page.evaluate(() => {
      const selects = document.querySelectorAll('select');
      if (selects[0]) {
        for (let i = 0; i < selects[0].options.length; i++) {
          if (selects[0].options[i].text.includes('PLANCHA')) {
            selects[0].selectedIndex = i;
            selects[0].dispatchEvent(new Event('change', { bubbles: true }));
            break;
          }
        }
      }
    });
    await sleep(400);
    await capture('29_Admin_Platos_Filtro_Estacion_Plancha.png', 'Catálogo de platos filtrado por la estación PLANCHA');

    // 30: Filtro por Estación Fríos
    await page.evaluate(() => {
      const selects = document.querySelectorAll('select');
      if (selects[0]) {
        for (let i = 0; i < selects[0].options.length; i++) {
          if (selects[0].options[i].text.includes('FRIOS')) {
            selects[0].selectedIndex = i;
            selects[0].dispatchEvent(new Event('change', { bubbles: true }));
            break;
          }
        }
      }
    });
    await sleep(400);
    await capture('30_Admin_Platos_Filtro_Estacion_Frios.png', 'Catálogo de platos filtrado por la estación FRIOS');

    // Restablecer filtro de estación
    await page.evaluate(() => {
      const selects = document.querySelectorAll('select');
      if (selects[0]) {
        selects[0].selectedIndex = 0;
        selects[0].dispatchEvent(new Event('change', { bubbles: true }));
      }
    });
    await sleep(300);

    // 31: Filtro por Categoría Fondos
    await page.evaluate(() => {
      const selects = document.querySelectorAll('select');
      if (selects[1]) {
        for (let i = 0; i < selects[1].options.length; i++) {
          if (selects[1].options[i].text.includes('Fondos')) {
            selects[1].selectedIndex = i;
            selects[1].dispatchEvent(new Event('change', { bubbles: true }));
            break;
          }
        }
      }
    });
    await sleep(400);
    await capture('31_Admin_Platos_Filtro_Categoria_Fondos.png', 'Catálogo de platos filtrado por la categoría Fondos');

    // Restablecer filtro categoría
    await page.evaluate(() => {
      const selects = document.querySelectorAll('select');
      if (selects[1]) {
        selects[1].selectedIndex = 0;
        selects[1].dispatchEvent(new Event('change', { bubbles: true }));
      }
    });
    await sleep(300);

    // 32: Búsqueda en tabla
    await page.evaluate(() => {
      const input = document.querySelector('input[placeholder*="Buscar por nombre o código"]');
      if (input) {
        input.value = 'Arroz';
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }
    });
    await sleep(400);
    await capture('32_Admin_Platos_Busqueda_En_Tabla.png', 'Búsqueda reactiva de platos en tabla por término Arroz');

    // Limpiar búsqueda
    await page.evaluate(() => {
      const input = document.querySelector('input[placeholder*="Buscar por nombre o código"]');
      if (input) {
        input.value = '';
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }
    });
    await sleep(300);

    // 33: Modal Nuevo Plato Vacío
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const btn = buttons.find(b => b.textContent.includes('NUEVO PLATO'));
      if (btn) btn.click();
    });
    await sleep(500);
    await capture('33_Admin_Platos_Modal_Nuevo_Vacio.png', 'Modal para crear un nuevo plato en el catálogo');

    // 34: Modal Nuevo Plato con Datos Completados
    await page.evaluate(() => {
      const inputs = document.querySelectorAll('div.fixed input');
      if (inputs[0]) {
        inputs[0].value = 'Parrilla Mixta Marina La Retama';
        inputs[0].dispatchEvent(new Event('input', { bubbles: true }));
      }
      const textareas = document.querySelectorAll('textarea');
      if (textareas[0]) {
        textareas[0].value = 'Pulpo, calamar y langostinos marinados al carbón con salsa anticuchera.';
        textareas[0].dispatchEvent(new Event('input', { bubbles: true }));
      }
      const selects = document.querySelectorAll('div.fixed select');
      if (selects[0] && selects[0].options.length > 1) {
        selects[0].selectedIndex = 1;
        selects[0].dispatchEvent(new Event('change', { bubbles: true }));
      }
      if (selects[1] && selects[1].options.length > 1) {
        selects[1].selectedIndex = 1;
        selects[1].dispatchEvent(new Event('change', { bubbles: true }));
      }
      if (inputs[1]) {
        inputs[1].value = '48.50';
        inputs[1].dispatchEvent(new Event('input', { bubbles: true }));
      }
      if (inputs[2]) {
        inputs[2].value = '14';
        inputs[2].dispatchEvent(new Event('input', { bubbles: true }));
      }
    });
    await sleep(400);
    await capture('34_Admin_Platos_Modal_Nuevo_Lleno.png', 'Formulario de nuevo plato con estación y SLA configurados');

    // 35: Error de validación al poner SLA en 0
    await page.evaluate(() => {
      const inputs = document.querySelectorAll('div.fixed input');
      if (inputs[2]) {
        inputs[2].value = '0';
        inputs[2].dispatchEvent(new Event('input', { bubbles: true }));
      }
      const saveBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('GUARDAR'));
      if (saveBtn) saveBtn.click();
    });
    await sleep(500);
    await capture('35_Admin_Platos_Modal_Nuevo_Validacion_SLA.png', 'Validación obligatoria de tiempo estándar SLA mayor a 0 minutos');

    // Cerrar modal
    await page.evaluate(() => {
      const cancelBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Cancelar'));
      if (cancelBtn) cancelBtn.click();
    });
    await sleep(400);

    // 36: Modal Editar Plato
    await page.evaluate(() => {
      const editBtns = Array.from(document.querySelectorAll('button[title="Editar plato"]'));
      if (editBtns[0]) editBtns[0].click();
    });
    await sleep(500);
    await capture('36_Admin_Platos_Modal_Editar_Plato.png', 'Modal de edición de plato existente con datos cargados');

    // Cerrar modal
    await page.evaluate(() => {
      const cancelBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Cancelar'));
      if (cancelBtn) cancelBtn.click();
    });
    await sleep(400);

    // =========================================================================
    // SECCIÓN 5: ESTACIONES DE COCINA (HU004)
    // =========================================================================
    console.log('\n--- 5. Capturando Módulo Estaciones de Cocina ---');
    await page.goto(`${BASE_URL}/admin/estaciones`, { waitUntil: 'networkidle0' });
    await sleep(1000);

    // 37: Listado de Estaciones
    await capture('37_Admin_Estaciones_Listado_Tarjetas.png', 'Tarjetas de estaciones de cocina operativas y vinculación');

    // 38: Vincular Terminal a una estación
    await page.evaluate(() => {
      const linkBtns = Array.from(document.querySelectorAll('button')).filter(b => b.textContent.includes('Vincular a esta terminal'));
      if (linkBtns[0]) linkBtns[0].click();
    });
    await sleep(600);
    await capture('38_Admin_Estaciones_Terminal_Vinculada.png', 'Estación de cocina vinculada activamente a la terminal local');

    // 39: Modal Nueva Estación Vacío
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const btn = buttons.find(b => b.textContent.includes('NUEVA ESTACIÓN'));
      if (btn) btn.click();
    });
    await sleep(500);
    await capture('39_Admin_Estaciones_Modal_Nueva_Vacio.png', 'Modal para crear una nueva estación de cocina');

    // 40: Modal Nueva Estación Lleno
    await page.evaluate(() => {
      const inputs = document.querySelectorAll('div.fixed input');
      if (inputs[0]) {
        inputs[0].value = 'PARRILLA';
        inputs[0].dispatchEvent(new Event('input', { bubbles: true }));
      }
      if (inputs[1]) {
        inputs[1].value = 'Estación de Parrillas al Carbón';
        inputs[1].dispatchEvent(new Event('input', { bubbles: true }));
      }
    });
    await sleep(400);
    await capture('40_Admin_Estaciones_Modal_Nueva_Lleno.png', 'Modal de nueva estación con código y nombre completados');

    // Cerrar modal
    await page.evaluate(() => {
      const cancelBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Cancelar'));
      if (cancelBtn) cancelBtn.click();
    });
    await sleep(400);

    // 41: Modal Editar Estación
    await page.evaluate(() => {
      const editBtns = Array.from(document.querySelectorAll('button')).filter(b => b.textContent.includes('Editar'));
      if (editBtns[0]) editBtns[0].click();
    });
    await sleep(500);
    await capture('41_Admin_Estaciones_Modal_Editar.png', 'Modal de edición de estación de cocina existente');

    // Cerrar modal
    await page.evaluate(() => {
      const cancelBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Cancelar'));
      if (cancelBtn) cancelBtn.click();
    });
    await sleep(400);

    // =========================================================================
    // SECCIÓN 6: ZONAS Y MESAS DE SALÓN (HU005)
    // =========================================================================
    console.log('\n--- 6. Capturando Módulo Zonas y Mesas ---');
    await page.goto(`${BASE_URL}/admin/mesas`, { waitUntil: 'networkidle0' });
    await sleep(1000);

    // 42: Gestión de Mesas - Salón Principal
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const btn = buttons.find(b => b.textContent.includes('Salón Principal'));
      if (btn) btn.click();
    });
    await sleep(400);
    await capture('42_Admin_Mesas_Zona_SalonPrincipal.png', 'Gestión de mesas en la zona Salón Principal (12 mesas)');

    // 43: Gestión de Mesas - Terraza
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const btn = buttons.find(b => b.textContent.includes('Terraza'));
      if (btn) btn.click();
    });
    await sleep(400);
    await capture('43_Admin_Mesas_Zona_Terraza.png', 'Gestión de mesas en la zona Terraza (8 mesas)');

    // 44: Gestión de Mesas - Barra
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const btn = buttons.find(b => b.textContent.includes('Barra'));
      if (btn) btn.click();
    });
    await sleep(400);
    await capture('44_Admin_Mesas_Zona_Barra.png', 'Gestión de mesas en la zona Barra (4 mesas)');

    // 45: Modal Nueva Mesa Vacío
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const btn = buttons.find(b => b.textContent.includes('NUEVA MESA'));
      if (btn) btn.click();
    });
    await sleep(500);
    await capture('45_Admin_Mesas_Modal_Nueva_Mesa_Vacio.png', 'Modal para crear una nueva mesa');

    // 46: Modal Nueva Mesa Lleno
    await page.evaluate(() => {
      const inputs = document.querySelectorAll('div.fixed input');
      if (inputs[0]) {
        inputs[0].value = '15';
        inputs[0].dispatchEvent(new Event('input', { bubbles: true }));
      }
      if (inputs[1]) {
        inputs[1].value = '6';
        inputs[1].dispatchEvent(new Event('input', { bubbles: true }));
      }
    });
    await sleep(400);
    await capture('46_Admin_Mesas_Modal_Nueva_Mesa_Lleno.png', 'Modal de nueva mesa con número y capacidad configurados');

    // Cerrar modal
    await page.evaluate(() => {
      const cancelBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Cancelar'));
      if (cancelBtn) cancelBtn.click();
    });
    await sleep(400);

    // =========================================================================
    // SECCIÓN 7: CANALES DE VENTA Y SLA (HU037)
    // =========================================================================
    console.log('\n--- 7. Capturando Módulo Canales de Venta y SLA ---');
    await page.goto(`${BASE_URL}/admin/canales`, { waitUntil: 'networkidle0' });
    await sleep(1000);

    // 47: Listado de Canales
    await capture('47_Admin_Canales_Listado_SLA.png', 'Canales de venta (Salón, Para Llevar, Delivery) y parametrización de SLA');

    // 48: Edición interactiva de SLA
    await page.evaluate(() => {
      const inputs = document.querySelectorAll('input[type="number"]');
      if (inputs[0]) {
        inputs[0].value = '18';
        inputs[0].dispatchEvent(new Event('input', { bubbles: true }));
      }
    });
    await sleep(400);
    await capture('48_Admin_Canales_Edicion_SLA.png', 'Ajuste del tiempo SLA objetivo de un canal de venta');

    // =========================================================================
    // SECCIÓN 8: VISTAS ERGONÓMICAS TABLET TÁCTIL (1024x768)
    // =========================================================================
    console.log('\n--- 8. Capturando Vistas Responsivas / Tablet (1024x768) ---');
    await page.setViewport({ width: 1024, height: 768 });

    // 49: Tablet Login PIN
    await clearSession(page);
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle0' });
    await sleep(600);
    await capture('49_Tablet_Login_PIN.png', 'Pantalla de Login PIN en resolución de Tablet táctil (1024x768)');

    // Iniciar sesión admin para tablet
    await setAdminSession(page);

    // 50: Tablet Comandero
    await page.goto(`${BASE_URL}/comandero`, { waitUntil: 'networkidle0' });
    await sleep(1000);
    await page.evaluate(() => {
      const addBtns = Array.from(document.querySelectorAll('button[title="Agregar a la comanda"]'));
      if (addBtns[0]) addBtns[0].click();
      if (addBtns[1]) addBtns[1].click();
    });
    await sleep(500);
    await capture('50_Tablet_Comandero_Salon.png', 'Comandero de sala con comanda activa en resolución de Tablet táctil');

    // 51: Tablet Catálogo de Platos
    await page.goto(`${BASE_URL}/admin/platos`, { waitUntil: 'networkidle0' });
    await sleep(1000);
    await capture('51_Tablet_Admin_Platos.png', 'Gestión de catálogo en resolución de Tablet táctil');

    console.log('\n✅ ¡Todas las 51 capturas han sido generadas y guardadas exitosamente!');
  } catch (err) {
    console.error('❌ Error capturando pantallas:', err);
  } finally {
    await browser.close();
  }
}

run();
