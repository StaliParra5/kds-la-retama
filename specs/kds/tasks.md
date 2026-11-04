# Plan de Tareas - Sprint 1: Fundación y Comandero

**Proyecto:** Sistema KDS (Kitchen Display System)  
**Metodología:** Scrum / Spec-Driven Development (SDD)  
**Capacidad Comprometida:** 12.5 días-persona  
**Versión:** 1.0.0  

---

## Estructura de Tareas por Rol y Fase

```
┌────────────────────────────────────────────────────────────────────────┐
│               FASE 0: BOOTSTRAP Y ARQUITECTURA BASE (QA)               │
│      Monorepo + Docker Compose + Flyway + Biome + Vite + Maven         │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
           ┌────────────────────────┴────────────────────────┐
           ▼                                                 ▼
┌──────────────────────────────────────┐  ┌──────────────────────────────────────┐
│  FASE 1: BACKEND CORE (B1 & B2)      │  │  FASE 2: FRONTEND CORE (F1 & F2)     │
│  - B1: Seguridad, JWT & PIN          │  │  - F2: Theme MUI, Layout, Catálogo   │
│  - B2: Estaciones, Mesas, Canales    │  │  - F1: Comandero, Búsqueda, Carrito  │
└──────────────────┬───────────────────┘  └──────────────────┬───────────────────┘
                   │                                         │
                   └────────────────────┬────────────────────┘
                                        ▼
┌────────────────────────────────────────────────────────────────────────┐
│             FASE 3: INTEGRACIÓN, VALIDACIÓN E-2-E Y DEMO               │
│      Empaquetado LAN, verificación DoD, pruebas y puesta en marcha     │
└────────────────────────────────────────────────────────────────────────┘
```

---

## Fase 0: Setup de Infraestructura, Calidad y Monorepo [QA]

- [x] **TASK-001 [IAC] [QA] Inicialización del Monorepo y Estructura de Carpetas**
  - Crear directorios `backend/` y `frontend/`.
  - Configurar `.dockerignore` y `.gitignore` en la raíz y en cada subdirectorio.
  - Configurar `compose.local.yml` con servicio PostgreSQL 16 y red interna.
  - Criterio de Aceptación: `docker compose -f compose.local.yml up -d db` levanta Postgres en puerto 5432 saludable.

- [x] **TASK-002 [QA] Configuración de Calidad Frontend (Biome & TypeScript)**
  - Inicializar proyecto React + Vite + TypeScript en `frontend/` usando `pnpm`.
  - Configurar `biome.json` con linter y formatter (indentación 2 espacios, comillas simples/dobles estandarizadas).
  - Agregar scripts en `package.json`: `"lint": "biome check ."` y `"format": "biome format --write ."`.
  - Criterio de Aceptación: `pnpm lint` ejecuta limpiamente sobre el código base sin errores.

- [x] **TASK-003 [IAC] [QA] Configuración de Maven Multi-etapa y Empaquetado Híbrido**
  - Configurar `pom.xml` en `backend/` con Java 21, Spring Boot 3.3.x y dependencias oficiales.
  - Configurar `frontend-maven-plugin` para compilar el frontend (`pnpm build`) e insertar los estáticos en `src/main/resources/static`.
  - Configurar Dockerfile multi-stage para producción on-premise en mini PC.
  - Criterio de Aceptación: La compilación genera un `.jar` que sirve la API en `/api/**` y el index HTML en `/`.

- [x] **TASK-004 [QA] Configuración de Migraciones Flyway y Sembrado de La Retama**
  - Crear script `V1__init_schema.sql` con DDL completo de todas las tablas de Sprint 1 y 2.
  - Crear script `V2__seed_retama_data.sql` con datos reales de La Retama:
    - 4 roles (`ADMIN`, `MOZO`, `COCINERO`, `EXPEDIDOR`).
    - 4 usuarios demo con passwords y PINs hasheados.
    - 4 estaciones activas (`PLANCHA`, `FRIOS`, `CALIENTES`, `BEBIDAS`).
    - 3 zonas y 15 mesas.
    - 3 canales de venta (`SALON`, `PARA_LLEVAR`, `DELIVERY`) con SLAs (15 min, 15 min, 30 min).
    - 4 categorías y 20+ platos tradicionales con precios y tiempos estándar.
  - Criterio de Aceptación: Al levantar el backend, Flyway ejecuta ambas migraciones sin errores en PostgreSQL.

---

## Fase 1: Backend - Autenticación, Seguridad y Maestros [B1 & B2]

- [x] **TASK-010 [BE] [B1] Implementación de Seguridad Spring Security y JWT (HU001)**
  - Configurar `SecurityFilterChain`, `JwtTokenProvider`, filtro `JwtAuthenticationFilter` y `BCryptPasswordEncoder`.
  - Implementar DTOs y servicio de autenticación para login administrativo (`POST /api/v1/auth/login-admin`).
  - Implementar login rápido por PIN de 4 dígitos para cocina y estaciones (`POST /api/v1/auth/login-pin`).
  - Criterio de Aceptación: Credenciales correctas retornan JWT con claim de rol; credenciales incorrectas retornan 401 Unauthorized.

- [x] **TASK-011 [BE] [B1] Control de Roles y Accesos RBAC (HU002)**
  - Anotar endpoints con `@PreAuthorize("hasRole('ADMIN')")`, `@PreAuthorize("hasAnyRole('MOZO', 'ADMIN')")`, etc.
  - Bloquear acceso a configuración y reportes para usuarios con rol `COCINERO`.
  - Implementar endpoint para listado y gestión de usuarios/roles (`GET /api/v1/usuarios`, `PUT /api/v1/usuarios/{id}/rol`).
  - Criterio de Aceptación: Usuario con rol `COCINERO` recibe 403 Forbidden al consultar `/api/v1/admin/**`.

- [x] **TASK-012 [BE] [B2] Configuración de Estaciones de Cocina (HU004)**
  - Crear entidad `Estacion`, repositorio Spring Data JPA y `EstacionService`.
  - Implementar endpoints REST: `GET /api/v1/estaciones`, `POST /api/v1/estaciones`, `PUT /api/v1/estaciones/{id}`.
  - Validar unicidad del código de estación y obligatoriedad de nombre.
  - Criterio de Aceptación: CRUD completo operativo con pruebas unitarias en `EstacionServiceTest`.

- [x] **TASK-013 [BE] [B2] Configuración de Canales de Venta y SLA (RF-CFG-04)**
  - Crear entidad `CanalVenta`, repositorio y endpoints: `GET /api/v1/canales`, `PUT /api/v1/canales/{id}/sla`.
  - Validar que el SLA sea un número entero estrictamente mayor a 0.
  - Criterio de Aceptación: Actualización exitosa del SLA de canal y persistencia verificable.

- [x] **TASK-014 [BE] [B2] Gestión de Zonas y Mesas de Salón (HU005)**
  - Crear entidades `Zona` y `Mesa` con relación `@ManyToOne`.
  - Implementar endpoints: `GET /api/v1/zonas`, `GET /api/v1/zonas/{id}/mesas`, `POST /api/v1/mesas`.
  - Implementar validación de unicidad de `numero_mesa` por zona.
  - Criterio de Aceptación: Intento de registrar dos mesas con el mismo número en la misma zona retorna 409 Conflict.

- [x] **TASK-015 [BE] [B2] Catálogo de Platos y Tiempo Estándar (HU003 & HU023)**
  - Crear entidades `CategoriaPlato` y `Plato` con relaciones a categoría y estación.
  - Implementar endpoints: `GET /api/v1/platos` (con filtros `categoriaId`, `search`, `disponible`), `POST /api/v1/platos`, `PUT /api/v1/platos/{id}`.
  - Validar que `tiempoEstandarMinutos > 0`, `precio >= 0` y `estacionId != null`.
  - Criterio de Aceptación: Registro de plato sin estación o con tiempo 0 es rechazado con 400 Bad Request.

- [x] **TASK-016 [BE] [B1] Apertura y Registro de Comandas en Sala (HU006)**
  - Crear entidad `Pedido` y `DetallePedido`.
  - Implementar generador de código correlativo correlativo (ej: `CMD-101`).
  - Implementar endpoint `POST /api/v1/pedidos` para apertura de comanda borrador.
  - Validar que si `canal = SALON`, el campo `mesaId` es mandatorio.
  - Criterio de Aceptación: Comanda de salón sin mesa es rechazada; con mesa se guarda en estado `BORRADOR`.

---

## Fase 2: Frontend - UI/UX, Componentes y Flujos de Sala [F1 & F2]

- [x] **TASK-020 [FE] [F2] Configuración del Tema MUI con Design Tokens de KDS Previsualización**
  - Instalar Material UI (`@mui/material`, `@emotion/react`, `@emotion/styled`) y FontAwesome/Lucide.
  - Configurar tema personalizado (`kdsTheme.ts`) con tipografía Inter, paleta Slate/Amber y estilos globales idénticos a los HTML de `KDS_PREVISUALIZACION`.
  - Criterio de Aceptación: Componentes de MUI adoptan automáticamente los colores Slate/Amber y bordes del prototipo.

- [x] **TASK-021 [FE] [F2] Layout Base, Topbar y Navegación por Rol**
  - Implementar componente `KdsHeader` con logo KDS, indicador de estado online, marca de agua de La Retama y selector/badge de usuario activo.
  - Configurar enrutador React Router con rutas protegidas (`/login`, `/comandero`, `/cocina`, `/admin`).
  - Criterio de Aceptación: Redirección automática a la vista correspondiente según el rol del usuario autenticado.

- [x] **TASK-022 [FE] [F2] Pantalla de Login Dual (HU001)**
  - Replicar fielmente el diseño de `01_login_kds.html` con dos pestañas:
    - Pestaña 1: Ingreso Rápido con PIN táctil (teclado numérico 0-9 para cocineros).
    - Pestaña 2: Acceso Administrativo (Usuario y Contraseña con botón mostrar/ocultar).
  - Manejo de estados de carga, credenciales inválidas y guardado del token JWT en `localStorage`.
  - Criterio de Aceptación: Cocinero ingresa con "1234" a cocina; administrador ingresa con credenciales a administración.

- [x] **TASK-023 [FE] [F2] Módulo de Administración: Gestión de Catálogo de Platos (HU003 & HU023)**
  - Replicar la interfaz de `08_admin_productos_kds.html`:
    - Barra superior con breadcrumb "Administración / Productos".
    - Filtros por categoría y estado disponible.
    - Tabla/grilla de platos con categoría, estación y tiempo estándar.
    - Modal/formulario reactivo "+ Nuevo Producto" y edición con validación de campos obligatorios.
  - Criterio de Aceptación: El usuario puede crear un nuevo plato, editar su tiempo estándar y desactivarlo.

- [x] **TASK-024 [FE] [F2] Módulo de Administración: Gestión de Estaciones y Parámetros (HU004 & RF-CFG-04)**
  - Replicar `09_admin_estaciones_kds.html` y `11_configuracion_kds.html`:
    - Tarjetas de estaciones con conteo de platos y estado activo.
    - Modal de edición de estación y configuración de SLA por canal de venta.
    - Selector persistente de estación de trabajo en el almacenamiento local del navegador.
  - Criterio de Aceptación: Cambios en estaciones o SLAs quedan persistidos y reflejados en la UI.

- [x] **TASK-025 [FE] [F1] Pantalla del Comandero: Selección de Canal, Zona y Mesa (HU006)**
  - Replicar la cabecera operativa de `02_comandero_kds.html`:
    - Selector desplegable de Canal de Pedido (Salón, Para Llevar, Delivery).
    - Modal/selector táctil de Mesas por Zona con estado de ocupación.
    - Generación y visualización del código correlativo de comanda.
  - Criterio de Aceptación: Mozo selecciona canal y mesa antes de armar la comanda; advertencia visual si falta mesa en canal salón.

- [x] **TASK-026 [FE] [F1] Pantalla del Comandero: Carta Digital, Búsqueda y Filtros (HU007)**
  - Barra de búsqueda con respuesta en tiempo real (< 500 ms) sobre catálogo completo.
  - Botones de categorías ("Entradas", "Fondos", "Bebidas", "Postres") para filtrado rápido.
  - Tarjetas de platos con nombre, precio (S/ xx), estación e icono de agregar "+".
  - Criterio de Aceptación: Búsqueda instantánea y filtrado fluido sin latencia perceptible.

- [x] **TASK-027 [FE] [F1] Pantalla del Comandero: Carrito de Comanda y Resumen Lateral**
  - Panel lateral de pedido con lista de platos seleccionados, cantidades (+/-), subtotal acumulado.
  - Campo de observaciones/modificadores preliminares.
  - Botón "Cancelar" y botón principal "Abrir / Guardar Comanda".
  - Criterio de Aceptación: El resumen calcula subtotales en tiempo real y permite guardar la comanda borrador.

---

## Fase 3: Integración, Pruebas y Cierre de Sprint 1

- [x] **TASK-030 [FULL] [QA] Integración Extremo a Extremo en Red Local (DoD)**
  - Validar flujo completo: Login -> Selección de Mesa -> Búsqueda de Platos -> Armado de Comanda -> Persistencia en PostgreSQL.
  - Validar empaquetado final: Spring Boot sirviendo el bundle compilado de React en el puerto 8080.
  - Demostración de funcionamiento desconectado de internet (simulación LAN pura).
  - Criterio de Aceptación: Cumplimiento íntegro de la Definition of Done del Sprint 1 ante el Product Owner.

---

## Fase 4: Modernización y Reemplazo UI/UX con Google Stitch (La Retama KDS Prototype)

- [x] **TASK-040 [FE] [UI] Setup de Tailwind CSS con Tokens de Stitch y Desinstalación de MUI**
  - Desinstalar paquetes de MUI (`@mui/material`, `@emotion/*`, etc.) con `pnpm`.
  - Configurar `tailwind.config.js` con la paleta de colores semánticos (`surface`, `surface-container-*`, `primary`, `secondary`, `error`), espaciados `space-*`, radios `rounded-*`, y tipografías `Plus Jakarta Sans` e `Inter`.
  - Importar fuentes oficiales y `Material Symbols Outlined` en `frontend/index.html`.
  - Configurar directivas `@tailwind` y utilidades en `frontend/src/index.css`.
  - Criterio de Aceptación: `pnpm build` compila con Tailwind CSS sin dependencias de MUI.

- [x] **TASK-041 [FE] [UI] Reemplazo de Pantalla de Login (Stitch Screen 01)**
  - Implementar Bento card con efectos sutiles de fondo (glows de ambiente).
  - Pestaña de Ingreso Rápido con PIN táctil (teclado de 12 botones grandes, indicador de dots y feedback táctil).
  - Pestaña de Acceso Administrativo (Usuario y Contraseña con iconos y validación).
  - Indicador de estado de terminal KDS con pulso verde y reloj en vivo.
  - Conexión con endpoints `/api/v1/auth/login-pin` y `/api/v1/auth/login-admin`.
  - Criterio de Aceptación: Login rápido con PIN 1234 y login admin con credenciales redirigen correctamente según rol.

- [x] **TASK-042 [FE] [UI] Barra Superior KDS y Sistema de Notificaciones Toast**
  - Implementar componente `TopAppBar` idéntico a Stitch: Branding "La Retama KDS", estado online, reloj en tiempo real, badge del operador con rol y pestañas contextuales (`/comandero`, `/admin/catalogo`, `/admin`).
  - Implementar `ToastContainer` y `ToastContext` para alertas flotantes no intrusivas en la esquina superior derecha con autocierre.
  - Criterio de Aceptación: Notificaciones visuales inmediatas y navegación fluida entre módulos según rol.

- [x] **TASK-043 [FE] [UI] Reemplazo de Comandero y Toma de Pedidos (Stitch Screen 02)**
  - Sub-header con barra de búsqueda rápida (< 500 ms) y selector de Zonas (Salón Principal, Terraza, Barra) y Canales.
  - Cinta de indicadores en vivo (Mesas Activas, SLA Promedio, Comandas en Preparación).
  - Vista dividida (Split 65% / 35%):
    - Izquierda: Grilla interactiva de mesas con indicadores de estado y selector de platos con fotos, categoría, precio y tiempo.
    - Derecha: Comanda activa con código correlativo único diario sugerido, contador `+`/`-`, modificadores y botón "ENVIAR A COCINA".
  - Criterio de Aceptación: Apertura y envío de comanda persistido exitosamente en PostgreSQL mediante `/api/v1/pedidos`.

- [x] **TASK-044 [FE] [UI] Reemplazo de Catálogo y Rutas de Menú (Stitch Screen 08)**
  - Métricas de catálogo en cabecera: Total de platos, tiempo promedio y cobertura de estaciones.
  - Filtros rápidos por Estación de Cocina (`Parrilla`, `Calientes`, `Fríos`, `Bebidas`) y Categoría.
  - Tabla de datos con elevación Level 1 (Código, Nombre, Categoría, Estación destino con badge, Tiempo SLA, Precio y Estado).
  - Modal / Slide-over drawer para crear/editar plato validando estación obligatoria y tiempoEstándar > 0 (HU003 & HU023).
  - Criterio de Aceptación: Creación y edición de platos conectada con `/api/v1/platos` y `/api/v1/estaciones`.

- [x] **TASK-045 [FE] [UI] Reemplazo de Configuración de Estaciones, Mesas y Canales (HU004, HU005 & HU037)**
  - Gestión interactiva de Canales de Venta con actualización en vivo de SLA en minutos (HU037).
  - Matriz de Estaciones de Cocina activas (HU004) con modal para crear/editar estaciones y vincular PC.
  - Gestión de Zonas y Mesas de Salón (HU005) con validación de unicidad de mesa por zona.
  - Criterio de Aceptación: Todas las entidades administrativas actualizables y persistidas en base de datos.

- [x] **TASK-046 [FULL] [QA] Validación E-2-E, Verificación Biome y Build Maven Híbrido**
  - Ejecución de `pnpm lint` y `pnpm build` sin advertencias ni errores de tipos.
  - Verificación del empaquetado multi-etapa con Maven (`./mvnw clean package -DskipTests=false`).
  - Validación en vivo en navegador de todas las pantallas reemplazadas.

---

## Fase 5: Sprint 2 - Flujo de Comanda hacia Cocina

- [ ] **TASK-050 [FULL] [F1] Cantidades y Modificadores por Ítem (HU008)** — parcial
  - [x] Backend: límites de cantidad (1 a 50) y modificadores (máx. 255 caracteres) en `ItemPedidoRequest`; normalización de modificadores en `PedidoService` (Esc. 3).
  - [x] Backend: respuesta 400 de validación con campo `mensaje` legible por el frontend.
  - [x] Frontend: carrito por línea (mismo plato con modificadores distintos en líneas separadas) y actualizaciones inmutables del estado (Esc. 5 y 6).
  - [ ] Modificadores predefinidos por plato: catálogo administrable; un plato sin modificadores configurados solo admite cantidad (Esc. 1, 2 y 4). Hoy los chips son una lista genérica fija.
  - [ ] Resaltado del modificador en la pantalla de cocina (depende de HU012).

- [x] **TASK-051 [FULL] [B2] Registro del Canal de Origen (HU010)**
  - Backend: rechazo de pedidos con canal inactivo en `PedidoService` (Esc. 4); canal obligatorio ya validado por `@NotNull` y `NOT NULL` (Esc. 1).
  - Backend: canal inmutable en `Pedido` (`updatable = false` + guarda en `setCanal`) con `OperacionNoPermitidaException` mapeada a 409 (Esc. 5).
  - Backend: `PATCH /api/v1/canales/{id}/estado` y `GET /api/v1/canales/todos` (solo Admin); listado de canales activos ordenado; `canalSlaMinutos` en `PedidoResponse` (Esc. 6).
  - Migración `V5__canal_delivery_propio.sql`: el canal `DELIVERY` pasa a llamarse "Delivery propio" (Esc. 3).
  - Frontend: comandero elige Salón por código (no por ID fijo), no envía mesa fuera de Salón y, si el canal elegido se desactiva, avisa y exige elegir otro en vez de cambiarlo en silencio (Esc. 2 a 4).
  - Frontend: interruptor Activo/Inactivo por canal en administración y corrección del SLA mostrado en el aviso de guardado.
  - Criterio de Aceptación: Escenarios 1 a 6 de HU010; pruebas en `PedidoServiceTest` y `CanalServiceTest`.


- [x] **TASK-052 [BE] [B1] Ciclo de Vida del Ítem (HU013)**
  - Enums `EstadoItem` (flujo y transiciones válidas, estados finales) y `EstadoPedido` (derivado del estado de los ítems).
  - `PATCH /api/v1/items/{id}/estado` con `estadoActual` + `estadoDestino`; 409 con el ítem vigente si el estado cambió (Esc. 6), también ante carreras reales detectadas por `@Version`.
  - Roles (D8): cocinero inicia/marca listo solo en la estación vinculada (claim `estacionId` en el JWT del login por PIN; sin estación vinculada no opera); expedidor y admin despachan. El permiso se valida antes que el estado.
  - El pedido se bloquea (`SELECT … FOR UPDATE`) al cambiar un ítem, para que cambios simultáneos en ítems distintos no dejen su estado agregado desactualizado; `fecha_envio_cocina` se registra al crear la comanda.
  - Migración `V6__ciclo_vida_item.sql`: `CHECK` de estados, columna `version`, `hora_disparo`; `BORRADOR` migrado a `ENVIADO`.
  - Notificación por WebSocket tras el commit (`/topic/estacion/{id}`, `/topic/items`) con `NotificadorKds`.
  - Errores: cuerpo ilegible → 400 y ruta inexistente → 404 (antes 500).
  - Criterio de Aceptación: Escenarios 1 a 6 de HU013; `EstadoItemTest`, `CicloVidaItemServiceTest`; smoke de API 17/17 con carreras simultáneas reales (mismo ítem y dos ítems del mismo pedido).

- [x] **TASK-053 [BE] [B1] Trazabilidad de Transiciones (HU022)**
  - `TrazabilidadService` centraliza el registro (pedido e ítems) con usuario responsable (Esc. 1).
  - `GET /api/v1/items/{id}/historial` y `GET /api/v1/pedidos/{id}/historial` (solo Admin, D10) en orden cronológico (Esc. 2).
  - Transiciones sin usuario figuran como "Sistema" (Esc. 3; el motor de secuenciación queda fuera del sprint, D2).
  - Historial de solo inserción: entidad `@Immutable` y triggers (migración V7) que bloquean `UPDATE`, `DELETE` y `TRUNCATE` también por SQL directo; un pedido con historial no se elimina, se anula (Esc. 4 y 5).
  - Hora asignada por el servidor al insertar (`@CreationTimestamp`, no `CURRENT_TIMESTAMP`, que es la hora de inicio de la transacción) y servidor/BD fijados en `America/Lima` (`KDS_ZONA_HORARIA`, `TZ`) para que todas las PCs usen la hora del servidor (Esc. 6).
  - Historial cargado en una consulta (`@EntityGraph`); ítem o pedido inexistente → 404.
  - Criterio de Aceptación: Escenarios 1 a 6 de HU022; `TrazabilidadServiceTest`; smoke de API/BD 11/11.

- [x] **TASK-054 [FULL] [F1] Envío de Comanda a Cocina (HU009)**
  - Registrar la comanda es enviarla (D5): pedido `ENVIADO` con `fecha_envio_cocina`, que el comandero muestra como acuse de recibo con código y hora del servidor (Esc. 1).
  - Idempotencia: `claveIdempotencia` generada por el comandero y restricción `UNIQUE` (migración V8). Un reintento o envíos simultáneos con la misma clave devuelven el mismo pedido (200) sin duplicarlo (Esc. 2 y 5).
  - La clave solo vale para su autor y su mismo contenido; reutilizarla para otra comanda → 409. `GET /api/v1/pedidos/envio/{clave}` permite al autor verificar si un envío llegó.
  - Comandero: sin respuesta o con 5xx/502/504 avisa "Sin confirmación del servidor", bloquea la edición (incluido "Limpiar") y ofrece "Reintentar envío" (misma clave) o "Editar comanda", que primero consulta al servidor y, si el envío llegó, muestra el acuse en vez de duplicarlo (Esc. 2). Clave y envío en curso en `useRef` contra doble pulsación (Esc. 5).
  - Rechazo de platos agotados o dados de baja indicando cuál; el comandero refresca la carta (Esc. 6). Comanda vacía rechazada (Esc. 3). Sin endpoints de edición directa (Esc. 4).
  - Método HTTP no soportado → 405 y conflicto de integridad → 409 (antes 500).
  - Criterio de Aceptación: Escenarios 1 a 6 de HU009; `PedidoServiceTest`; `PedidoControllerTest`; smoke API 19/19 y E2E 11/11 (respuesta perdida y 502 tras registrar el pedido).

- [x] **TASK-055 [BE] [B1] Enrutamiento de Ítems por Estación (HU011)**
  - Al registrar la comanda, cada ítem se publica tras el commit solo en `/topic/estacion/{id}` de su estación, como un único ítem con cantidad y modificadores (Esc. 1 a 3); altas y cambios de estado de pedidos en `/topic/pedidos` con el contrato `{tipo, pedidoId, codigoPedido, estado}` (`NotificadorKds`, ya sin envíos dentro de la transacción; primero el ítem y luego el pedido).
  - `GET /api/v1/estaciones/{id}/cola`: cola activa (Recibido, En espera, En preparación) desde la BD para la pantalla que se conecta tarde; un cocinero solo lee la de su estación (Esc. 4).
  - La estación se fija al pedir: reasignar el plato no mueve ítems ya enviados (Esc. 5).
  - Plato sin estación activa → 400 indicando el plato (Esc. 6). Nota: HU004 impide desactivar desde administración una estación con platos asignados, por lo que el caso solo se da por cambios directos en BD; la validación queda como defensa.
  - Criterio de Aceptación: Escenarios 1 a 6 de HU011; `PedidoServiceTest`, `CocinaServiceTest`; smoke con suscriptores STOMP reales 17/17.

- [x] **TASK-056 [FULL] [F1] Pantalla de Estación de Cocina (HU012)**
  - Ruta `/cocina` (`CocinaPage`): ítems pendientes de la estación agrupados por pedido, con código, canal, mesa, minutos desde el envío y semáforo contra el SLA del canal (Esc. 1 a 3); "+N ítems en otras estaciones" de solo lectura (Esc. 4); los Listos salen de la cola (Esc. 5); "Sin pedidos" cuando no hay pendientes (Esc. 6).
  - Estación (D6): la del JWT del cocinero, que el servidor toma de la PC vinculada en HU004; el admin elige cualquiera. El cliente ya no completa la estación con la de la terminal si el servidor no la confirmó.
  - Tiempo real (D7): `@stomp/stompjs` en `src/api/tiempoReal.ts` con reconexión, recarga de la cola al conectar y recargas agrupadas ante ráfagas; si el servidor rechaza el CONNECT vuelve al login y si rechaza la suscripción deja de reintentar y lo informa.
  - Seguridad del WebSocket: JWT en el frame CONNECT/STOMP (`AutenticacionStompInterceptor`) y permisos por tópico (`PermisosSuscripcion`): el cocinero solo su estación, `/topic/items` para expedidor y admin, `/topic/pedidos` para todos; los clientes no envían mensajes. Se elimina el registro duplicado de `/ws` con SockJS.
  - Ingreso por PIN: PIN propio por usuario de prueba (V9: mozo 1234, cocinero 5678, expedidor 9012); un PIN que comparten varios usuarios operativos se rechaza. Cada rol entra a su pantalla (`rutaInicio`) y una ruta sin permiso lo devuelve a ella.
  - Criterio de Aceptación: Escenarios 1 a 6 de HU012; `PermisosSuscripcionTest`, `AutenticacionStompInterceptorTest`, `ItemCocinaMapperTest`, `CocinaServiceTest`, `AuthServiceTest`; smoke `smoke_hu012.cjs` 20/20 con Chrome y STOMP reales.

- [x] **TASK-057 [FULL] [F1] Cambio de Estado con un Toque (HU014)**
  - En `/cocina` cada ítem es un botón: Pendiente → En preparación → Listo, un toque por paso y sin menús (Esc. 1 y 2). El color de la fila y la etiqueta cambian al instante mientras el servidor confirma (Esc. 5); un ítem recién Listo sigue visible unos segundos y luego sale de la cola.
  - Ítem En espera con hora de disparo futura: diálogo "¿Iniciar antes de tiempo?" (Esc. 3). El servidor exige `inicioAnticipado: true` y responde 409 con `codigo: INICIO_ANTICIPADO_REQUERIDO`, que la pantalla convierte en el mismo diálogo aunque el reloj de la tablet difiera; el historial registra el motivo "Inicio anticipado (disparo HH:mm)". Sin hora de disparo (retención manual, D2) no hay confirmación.
  - Tocar un ítem Listo solo informa que el despacho se confirma en el pase (Esc. 4); tocar uno anulado mientras estaba en pantalla recibe 409 con el estado vigente e informa la anulación sin cambiarlo (Esc. 6). Otros conflictos avisan que el ítem cambió en otra pantalla.
  - Criterio de Aceptación: Escenarios 1 a 6 de HU014; `CicloVidaItemServiceTest`; smoke `smoke_hu014.cjs` 20/20 (la anulación se simula en BD hasta HU032).

- [x] **TASK-058 [FULL] [F1] Pantalla de Pase (D9, despacho de HU013)**
  - `GET /api/v1/items/listos` (Expedidor/Admin): ítems Listos de todas las estaciones en orden de llegada, con `itemsPendientesPedido` (ítems del pedido que siguen en cocina).
  - Ruta `/pase` (`PasePage`): Listos agrupados por pedido con semáforo de SLA, aviso "Faltan N en cocina" o "Pedido completo", botón "Despachar" por ítem y "Despachar listos" por pedido (con un único resumen si algo falla). Se actualiza con `/topic/items`.
  - El expedidor entra con su PIN directo al pase; la ruta `/pase` queda permitida en Spring Security como las demás rutas de la SPA.
  - Utilidades comunes de cocina y pase en `src/utils/cocina.ts` y recarga agrupada ante ráfagas en `useRecargaAgrupada`.
  - Criterio de Aceptación: `CocinaServiceTest`, `ItemCocinaMapperTest`; smoke `smoke_hu013_pase.cjs` 14/14.
