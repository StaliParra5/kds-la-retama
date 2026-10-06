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
