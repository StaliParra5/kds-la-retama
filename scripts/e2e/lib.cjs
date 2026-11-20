// Utilidades compartidas de las pruebas de humo en Node: API REST, login y cliente STOMP mínimo
const API = 'http://localhost:8080/api/v1';
const WS = 'ws://localhost:8080/ws';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function http(method, path, token, body) {
  const res = await fetch(`${API}${path}`, {
    method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  return { status: res.status, data: text ? JSON.parse(text) : null };
}

async function loginCompleto(ep, body) {
  const d = (await http('POST', `/auth/${ep}`, null, body)).data;
  return { token: d.token, user: { id: d.usuarioId, username: d.username, nombreCompleto: d.nombreCompleto, rol: d.rol, estacionId: d.estacionId, estacionNombre: d.estacionNombre } };
}
const login = async (ep, body) => (await loginCompleto(ep, body)).token;

// CONNECT (con token opcional) + SUBSCRIBE; acumula los mensajes por destino.
// Rechaza la promesa si el servidor responde con un frame ERROR.
function stompSuscriptor(destinos, token) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(WS);
    const recibidos = Object.fromEntries(destinos.map((d) => [d, []]));
    const auth = token ? `Authorization:Bearer ${token}\n` : '';
    ws.onerror = (e) => reject(new Error(`WebSocket: ${e.message || 'error'}`));
    ws.onclose = () => reject(new Error('conexión cerrada por el servidor'));
    ws.onopen = () => ws.send(`CONNECT\naccept-version:1.2\nheart-beat:0,0\n${auth}\n\0`);
    ws.onmessage = (ev) => {
      for (const frame of String(ev.data).split('\0').filter((f) => f.trim())) {
        const [cabecera, ...cuerpo] = frame.split('\n\n');
        const lineas = cabecera.trim().split('\n');
        if (lineas[0] === 'CONNECTED') {
          destinos.forEach((d, i) => ws.send(`SUBSCRIBE\nid:sub-${i}\ndestination:${d}\n\n\0`));
          setTimeout(() => resolve({ ws, recibidos }), 300);
        } else if (lineas[0] === 'MESSAGE') {
          const dest = lineas.find((l) => l.startsWith('destination:')).slice(12);
          recibidos[dest]?.push(JSON.parse(cuerpo.join('\n\n')));
        } else if (lineas[0] === 'ERROR') {
          const msg = lineas.find((l) => l.startsWith('message:'));
          reject(new Error(msg ? msg.slice(8) : frame));
        }
      }
    };
  });
}

// Lleva a Listo todos los ítems pendientes de una estación (deja la pantalla en "Sin pedidos").
// Confirma el inicio anticipado para no quedar trabado en ítems retenidos de una prueba anterior.
async function vaciarCola(estacionId, tokenCocinero) {
  const cola = (await http('GET', `/estaciones/${estacionId}/cola`, tokenCocinero)).data;
  for (const item of cola) {
    let estado = item.estado;
    for (const destino of ['EN_PREPARACION', 'LISTO']) {
      const r = await http('PATCH', `/items/${item.id}/estado`, tokenCocinero, { estadoActual: estado, estadoDestino: destino, inicioAnticipado: true });
      if (r.status === 200) estado = destino;
    }
  }
}

// Crea un mozo con un PIN libre: las corridas anteriores dejan PIN ocupados, así que se prueba al azar (HU042)
async function crearMozo(tokenAdmin, datos) {
  for (let intento = 0; intento < 30; intento++) {
    const pin = String(Math.floor(1000 + Math.random() * 9000));
    const r = await http('POST', '/mozos', tokenAdmin, { ...datos, pin });
    if (r.status === 201) return { ...r.data, pin };
    if (!(r.status === 400 && r.data?.mensaje?.includes('PIN'))) throw new Error(`alta de mozo: ${r.status} ${r.data?.mensaje}`);
  }
  throw new Error('no se encontró un PIN libre');
}

// Cierra una mesa abierta por una prueba (HU046): despacha lo que quede en cocina y la libera.
// Debe llamarse antes de desactivar al mozo, porque desactivarlo revoca su sesión.
async function cerrarMesa(mesaId, tokenMozo, tokenAdmin) {
  const atencion = await http('GET', `/mesas/${mesaId}/atencion`, tokenAdmin);
  if (atencion.status !== 200) return;
  await despacharItems(atencion.data.pedidos.flatMap((p) => p.items));
  const liberada = await http('POST', `/mesas/${mesaId}/atencion/liberar`, tokenMozo);
  if (liberada.status !== 200) console.warn(`No se pudo liberar la mesa ${mesaId}: ${liberada.status} ${liberada.data?.mensaje}`);
}

// Lleva a Despachado los ítems de prueba que sigan en cocina, para no dejarlos en las colas
async function despacharItems(items) {
  const expedidor = await login('login-pin', { username: 'expedidor1', pin: '9012' });
  const cocineros = new Map();
  for (const item of items) {
    let estado = item.estadoItem;
    if (estado === 'DESPACHADO' || estado === 'ANULADO') continue;
    if (!cocineros.has(item.estacionId)) {
      cocineros.set(item.estacionId, await login('login-pin', { username: 'cocinero1', pin: '5678', estacionId: item.estacionId }));
    }
    const cocinero = cocineros.get(item.estacionId);
    for (const [destino, token] of [['EN_PREPARACION', cocinero], ['LISTO', cocinero], ['DESPACHADO', expedidor]]) {
      const r = await http('PATCH', `/items/${item.id}/estado`, token, { estadoActual: estado, estadoDestino: destino, inicioAnticipado: true });
      if (r.status === 200) estado = destino;
    }
  }
}

// Activa un canal de venta para la prueba y devuelve la función que lo deja como estaba:
// si ya estaba activo no hace nada; si estaba inactivo, lo vuelve a desactivar al terminar.
async function activarCanal(codigo) {
  const admin = await loginCompleto('login-admin', { username: 'admin', password: 'admin123' });
  const canal = (await http('GET', '/canales/todos', admin.token)).data.find((c) => c.codigo === codigo);
  if (!canal) throw new Error(`El canal ${codigo} no existe`);
  if (canal.activo) return async () => {};
  const r = await http('PATCH', `/canales/${canal.id}/estado`, admin.token, { activo: true });
  if (r.status !== 200) throw new Error(`No se pudo activar el canal ${codigo} (${r.status})`);
  return async () => {
    await http('PATCH', `/canales/${canal.id}/estado`, admin.token, { activo: false });
  };
}

// HU049 (D36): deja configurada la clave de autorización del administrador de prueba (PIN de 6 dígitos, distinto
// de su contraseña). Ojo: reemplaza la clave que el administrador tuviera en esta base local.
const CLAVE_AUTORIZACION_PRUEBA = '246810';
async function asegurarClaveAdmin(adminToken) {
  const r = await http('PUT', '/cuenta/clave-autorizacion', adminToken, { passwordActual: 'admin123', clave: CLAVE_AUTORIZACION_PRUEBA });
  if (r.status !== 200) throw new Error(`No se pudo configurar la clave de autorización: ${r.status} ${r.data?.mensaje ?? ''}`);
  return { usuario: 'admin', clave: CLAVE_AUTORIZACION_PRUEBA };
}

module.exports = { API, WS, sleep, http, login, loginCompleto, activarCanal, stompSuscriptor, vaciarCola, crearMozo, cerrarMesa, despacharItems, asegurarClaveAdmin, CLAVE_AUTORIZACION_PRUEBA };
