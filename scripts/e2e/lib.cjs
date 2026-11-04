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

module.exports = { API, WS, sleep, http, login, loginCompleto, stompSuscriptor, vaciarCola };
