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

Las suites crean pedidos de prueba en la base local y restauran los cambios de configuración que hacen
(canales, disponibilidad de platos, estaciones).
