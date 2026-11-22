# Pruebas de humo del Sprint 2

Pruebas de extremo a extremo contra el stack real (backend en Docker, PostgreSQL y frontend en Vite).
Complementan los tests unitarios del backend: verifican la API, la base de datos, los WebSockets y las pantallas.

## Requisitos
- Stack levantado: `docker compose -f compose.local.yml --profile full up -d --build`
- Frontend en desarrollo para las pruebas con navegador: `cd frontend && pnpm dev` (puerto 5173)
- Google Chrome instalado (o la variable `CHROME_PATH` apuntando al ejecutable)
- Node 22 o superior (usa `fetch` y `WebSocket` nativos) y Bash (Git Bash en Windows)

## Ejecución
```bash
bash scripts/e2e/run_all.sh        # todas las suites
bash scripts/e2e/smoke_hu013.sh    # una suite de API
node scripts/e2e/smoke_hu011.cjs   # una suite con WebSocket/navegador
```
Las capturas de pantalla se guardan en el directorio temporal del sistema (o en `E2E_OUT`).

| Suite | Cubre |
|---|---|
| `smoke_hu009.sh` / `.cjs` | Envío idempotente, acuse, respuesta perdida y 502, plato agotado |
| `smoke_hu010.cjs` | Canales: asignación, inactivo, comandero y administración |
| `smoke_hu011.cjs` | Enrutamiento por estación con suscriptores STOMP reales, cola, reasignación |
| `smoke_hu013.sh` | Ciclo de vida del ítem, roles y carreras simultáneas reales |
| `smoke_hu022.sh` | Historial, responsable "Sistema", inalterabilidad en BD, hora del servidor |
| `smoke_hu016.cjs` | Cola unificada multicanal: orden, pedido nuevo, filtro por canal (y recuerdo al recargar), despacho, desplazamiento |
| `smoke_hu017.cjs` | Tiempo real con Chrome y STOMP reales: pedido nuevo, cambios entre dos PCs, despacho, estación ajena sin cambios (todo en ≤ 2 s) |
| `smoke_hu017_mozo.cjs` | El mozo recibe por WebSocket cada avance de cocina sobre sus ítems (≤ 2 s), también cuando el estado del pedido no cambia |
| `smoke_hu032.cjs` | Anular ítem con motivo: sin merma / con merma consultable, motivo obligatorio, despachado, roles, aviso fijo en la estación y pedido anulado |
| `smoke_hu008.cjs` | Modificadores por plato: catálogo editable, solo los del plato, plato sin modificadores, varios por ítem, cantidad inválida, líneas separadas, reintento equivalente y resaltado en cocina |
| `smoke_hu019.cjs` | Punto de integración de pedidos externos: payload válido e inválido, canal y plato desconocidos, enrutamiento a la estación y acceso sin clave (usa `KDS_INTEGRACION_API_KEY`) |
| `smoke_hu020.cjs` | Registro manual de pedidos externos: canal, ítems, contacto, número de orden de Rappi en la tarjeta, solo expedidor y registro desde la pantalla en menos de 60 s |
| `smoke_hu021.cjs` | Tarjeta completa: 6 elementos, cronómetro en vivo, destino según canal, adiciones marcadas, pedido extenso y cronómetro igual con otra PC de reloj adelantado |
| `smoke_hu034.cjs` | Duplicados externos: reenvío igual (200, sin tarjeta nueva), otro canal, reenvío con cambios (409), registro manual repetido y reenvíos simultáneos |
| `smoke_hu038.cjs` | Conexión: aviso en menos de 5 s, mismo aviso en comandero, estación y pase, cocina sin cambios durante el corte, reconexión sola con el pedido llegado en el corte y "Conectado" |
| `smoke_hu033.cjs` | Deshacer: dentro de la ventana, solo el último cambio, ventana vencida y configurable, despachado no reversible, permisos y reflejo en estación y pase |
| `smoke_hu015.cjs` | Canal visual: color e ícono por canal, color repetido o parecido al semáforo rechazado, cambio de color en vivo, mismo color en estación y pase, franja visible con el semáforo cambiando |
| `smoke_hu025.cjs` | Semáforo: umbral fuera de rango, verde/ámbar/rojo, SLA distinto por canal, cambio de SLA en vivo, pase y pedido despachado (dura ~1 min) |

Las suites crean pedidos de prueba en la base local y restauran los cambios de configuración que hacen
(canales, disponibilidad de platos, estaciones).
