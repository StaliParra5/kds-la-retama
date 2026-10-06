# Documento de Arquitectura Técnica - Sistema KDS

**Proyecto:** Sistema KDS (Kitchen Display System)  
**Entorno de Operación:** Red Local (On-Premise LAN) sin dependencia de Internet  
**Sprint Actual:** Sprint 1 · Fundación y Comandero  
**Versión:** 1.0.0  

---

## 1. Visión General de la Arquitectura

El sistema KDS sigue el patrón arquitectónico de **Monolito Modular Cliente-Servidor Desplegado en Red Local**. Un único servidor on-premise (mini PC o servidor local) aloja la base de datos PostgreSQL 16 y la aplicación Spring Boot 3 con Java 21, sirviendo las APIs REST, el hub de WebSockets (STOMP) y los recursos web estáticos compilados de React. Las estaciones cliente (terminales de sala, cocina y pase) acceden mediante navegadores web configurados en modo kiosco apuntando a la dirección IP local del servidor.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       RED LOCAL DEL RESTAURANTE (LAN)                       │
│                                                                             │
│   ┌────────────────────┐   ┌────────────────────┐   ┌───────────────────┐   │
│   │  PC Sala (Mozo)    │   │  PC Cocina/Estación│   │  PC Admin / Pase  │   │
│   │  (Comandero KDS)   │   │  (Plancha, Fríos)  │   │  (Config & SLA)   │   │
│   └─────────┬──────────┘   └─────────┬──────────┘   └─────────┬─────────┘   │
│             │ HTTP / WS              │ HTTP / WS              │ HTTP / WS   │
│             └────────────────┬───────┴────────┬───────────────┘             │
│                              │                │                             │
│                              ▼                ▼                             │
│       ┌─────────────────────────────────────────────────────────────┐       │
│       │             SERVIDOR KDS (Spring Boot 3 + Java 21)          │       │
│       │                                                             │       │
│       │  ┌────────────────────┐            ┌─────────────────────┐  │       │
│       │  │  Recursos Estáticos│            │   Spring Security   │  │       │
│       │  │  (React Vite Build)│            │   (JWT + PIN Auth)  │  │       │
│       │  └────────────────────┘            └─────────────────────┘  │       │
│       │  ┌────────────────────┐            ┌─────────────────────┐  │       │
│       │  │   Controladores    │            │   Hub WebSocket     │  │       │
│       │  │   REST (API v1)    │            │   (STOMP Broker)    │  │       │
│       │  └──────────┬─────────┘            └─────────────────────┘  │       │
│       │             │ Capa de Negocio                               │       │
│       │             ▼                                               │       │
│       │  ┌───────────────────────────────────────────────────────┐  │       │
│       │  │        Servicios de Dominio & Validaciones            │  │       │
│       │  │   (Catálogos, Comandas, Mesas, Canales, Tiempos)      │  │       │
│       │  └──────────────────────────┬────────────────────────────┘  │       │
│       │                             │ Spring Data JPA               │       │
│       │                             ▼                               │       │
│       │  ┌───────────────────────────────────────────────────────┐  │       │
│       │  │             Migraciones Flyway (V1 / V2)              │  │       │
│       │  └──────────────────────────┬────────────────────────────┘  │       │
│       └─────────────────────────────┼───────────────────────────────┘       │
│                                     ▼                                       │
│       ┌─────────────────────────────────────────────────────────────┐       │
│       │                PostgreSQL 16 (Docker / Local)               │       │
│       └─────────────────────────────────────────────────────────────┘       │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Stack Tecnológico Enterprise

### 2.1 Backend (Servidor KDS)
- **Lenguaje:** Java 21 (LTS).
- **Framework:** Spring Boot 3.3.x.
- **Módulos Spring:**
  - `spring-boot-starter-web`: Exposición de endpoints RESTful con manejo centralizado de excepciones (`@ControllerAdvice`).
  - `spring-boot-starter-data-jpa` + `Hibernate 6`: Mapeo objeto-relacional optimizado, soporte para consultas tipadas.
  - `spring-boot-starter-security`: Filtros JWT, autenticación dual por credenciales y PIN con `BCryptPasswordEncoder`.
  - `spring-boot-starter-validation`: Bean Validation (JSR-380) para contratos de entrada.
  - `spring-boot-starter-websocket`: Broker de mensajes en memoria con protocolo STOMP (base para Sprints 2-4).
- **Gestión de Base de Datos:** `Flyway Core 10.x` para migraciones versionadas y sembrado inicial.
- **Documentación API:** `springdoc-openapi-starter-webmvc-ui` (Swagger UI en `/swagger-ui.html`).
- **Build Tool:** Apache Maven 3.9+ con `frontend-maven-plugin` para compilar y empaquetar React en el JAR.

### 2.2 Base de Datos
- **Motor:** PostgreSQL 16 Alpine.
- **Conexión:** Pool de conexiones HikariCP optimizado para concurrencia LAN (mínimo 10 conexiones, máximo 30).

### 2.3 Frontend (Cliente Web KDS)
- **Lenguaje & Entorno:** TypeScript 5.x + Node.js 26.x.
- **Package Manager:** `pnpm` (Regla mandatoria del workspace).
- **Framework UI:** React 18.3+ con Vite 6.x.
- **Librería de Componentes:** Material UI (MUI v5/v6) + `@emotion/react` + `@emotion/styled`.
- **Iconografía:** Material Icons / Lucide-react / FontAwesome Icons.
- **Gestión de Estado & Red:** TanStack React Query (v5) + Axios / Fetch + React Context para sesión y estación.
- **Linter & Formatter:** Biome (`biome.json`).

### 2.4 Infraestructura y Despliegue Local
- **Contenedores:** Docker Compose con `postgres:16-alpine` y contenedor de Backend (`eclipse-temurin:21-jdk`).
- **Modo Kiosco:** Navegadores basados en Chromium (Chrome / Edge) en pantalla completa en terminales de sala y cocina.

---

## 3. Architecture Decision Records (ADRs)

### ADR-01: Monorepo Modular con Frontend Servido desde Spring Boot
- **Contexto:** En un restaurante local, el personal no debe gestionar múltiples servicios ni servidores Node.js.
- **Decisión:** Monorepo con carpetas `backend/` y `frontend/`. Durante el desarrollo, Vite corre con hot reload apuntando al proxy `localhost:8080`. En empaquetado final (`mvn clean package`), `frontend-maven-plugin` ejecuta `pnpm run build` y copia los estáticos a `backend/src/main/resources/static/`.
- **Consecuencia:** Se genera un único archivo ejecutable JAR o contenedor Docker autocontenido que sirve frontend y backend en el puerto `8080`.

### ADR-02: Autenticación Dual (PIN de Estación vs Usuario/Contraseña Admin)
- **Contexto:** HU001 exige acceso en menos de 2 segundos para cocineros con PIN de 4 dígitos en estaciones, pero alta seguridad para administradores.
- **Decisión:** Implementar dos flujos de autenticación bajo Spring Security:
  1. `/api/v1/auth/login-admin`: Requiere `username` y `password`, emite JWT con rol `ROLE_ADMIN` o `ROLE_EXPEDIDOR`.
  2. `/api/v1/auth/login-pin`: Requiere `pin` (4 dígitos) y opcionalmente `stationId`, busca usuario asignado y emite JWT con rol `ROLE_COCINERO` o `ROLE_MOZO`.
- **Consecuencia:** Se desacopla la ergonomía táctil rápida del personal de cocina de la seguridad requerida para parametrización.

### ADR-03: Material UI (MUI) con Design Tokens Semánticos Basados en KDS Previsualización
- **Contexto:** El usuario confirmó el uso de MUI para alinearse al informe de Sprint 0, pero requiere estricta paridad con los prototipos HTML entregados (`KDS_PREVISUALIZACION`).
- **Decisión:** Crear un tema personalizado de MUI (`createTheme`) configurando la paleta exacta de Slate-50/Slate-900, acentos Amber (`#d97706` / `#b45309`), bordes sutiles (`border: 1px solid #e2e8f0`), tipografía Inter y botones táctiles con altura mínima de 44px.
- **Consecuencia:** Se aprovecha la robustez de componentes de MUI manteniendo la identidad visual gastronómica moderna y limpia de los bocetos.

### ADR-04: Migraciones Flyway con Datos de 'La Retama'
- **Contexto:** El proyecto debe ser demostrable de inmediato con platos típicos peruanos, tiempos y estaciones reales.
- **Decisión:** Separar migraciones en:
  - `V1__init_schema.sql`: Creación de tablas, claves foráneas, restricciones de unicidad e índices.
  - `V2__seed_retama_data.sql`: Carga de usuarios de prueba, estaciones (Plancha, Fríos, Frituras, Bebidas), canales (Salón, Para Llevar, Delivery con SLA) y más de 20 platos iniciales con tiempos estándar.
- **Consecuencia:** Base de datos reproducible al 100% en cualquier máquina sin pasos manuales.

---

## 4. Design System y Especificación UI/UX

### 4.1 Paleta Cromática Semántica
- **Fondo General:** Slate 50 (`#f8fafc`).
- **Superficie de Tarjetas:** White (`#ffffff`) con bordes Slate 200 (`#e2e8f0`).
- **Texto Principal:** Slate 900 (`#0f172a`).
- **Texto Secundario:** Slate 500 (`#64748b`).
- **Color de Acento Primario:** Amber 600 (`#d97706`), hover Amber 700 (`#b45309`).
- **Éxito / Listo:** Emerald 600 (`#059669`), fondo Emerald 50 (`#ecfdf5`).
- **Peligro / Cancelado:** Rose 600 (`#e11d48`), fondo Rose 50 (`#fff1f2`).
- **Alerta / En Espera:** Amber 500 (`#f59e0b`), fondo Amber 50 (`#fffbeb`).

### 4.2 Matriz de los 5 Estados de UI
1. **Loaded (Estado Nominal):** Renderizado completo de la grilla de platos, tarjetas con badges y precios.
2. **Skeleton (Carga Inicial):** Marcadores de posición de pulso suave en tarjetas de platos y categorías durante la obtención de datos.
3. **Empty (Sin Datos):** Mensaje visual ilustrado cuando no hay platos en una categoría seleccionada o el carrito está vacío.
4. **Error:** Banner amigable con botón de reintento ante fallos de conexión o validaciones de backend.
5. **Interactive:** Respuestas táctiles inmediatas (ripple effect, elevación sutil de tarjeta y conteo numérico instantáneo).

---

## 5. Estrategia de Calidad, Testing y Pre-commits

- **Frontend:** Configuración de `biome.json` con reglas estrictas de linting y formateo para TypeScript/React.
- **Backend:** Compilación con flags estrictos en Maven (`-Werror` opcional en CI), pruebas unitarias con JUnit 5 + Mockito en capa de servicio y pruebas de integración con `@SpringBootTest` para endpoints clave.
- **Pipeline CI (GitHub Actions):** Flujo de verificación automática en cada pull request:
  1. `frontend-check`: Verificación de sintaxis y tipos (`tsc --noEmit`, `biome check`).
  2. `backend-check`: Compilación con Maven y ejecución de tests unitarios de Spring Boot.
