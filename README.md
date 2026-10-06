# Kitchen Display System (KDS) - La Retama Restaurante

Sistema integral de gestión de cocina (Kitchen Display System - KDS) y comandero para restaurantes de mediana escala (40 a 120 cubiertos). Proyecto tecnológico desarrollado para **La Retama Restaurante** (Jesús María, Lima) bajo metodología **Spec-Driven Development (SDD)**.

---

## 🚀 Arquitectura y Stack Tecnológico

El sistema fue diseñado bajo una arquitectura cliente-servidor orientada a operar con **alta resiliencia en red local (LAN)**, garantizando una disponibilidad operativa del 100% incluso ante caídas de internet externa.

```
┌────────────────────────────────────────────────────────────────────────┐
│                        ARQUITECTURA DEL SISTEMA                        │
│                                                                        │
│   [ Dispositivos de Sala & Cocina ]                                    │
│   • Tablets de Mozo / Sala (Comandero)                                 │
│   • Terminales Táctiles de Cocina (KDS por estación)                   │
│   • PC Administrativa (Gestión y Catálogos)                            │
│                        │                                               │
│                        ▼ (HTTP REST / STOMP WebSockets)                │
│   ┌──────────────────────────────────────────────────────────────┐     │
│   │                 Backend Core (Spring Boot 3.3.5)             │     │
│   │  • Java 21 LTS                                               │     │
│   │  • Spring Security 6 (Stateless JWT + RBAC)                  │     │
│   │  • Spring Data JPA + Hibernate                               │     │
│   │  • WebSocket / STOMP Broker                                  │     │
│   │  • Flyway Database Migrations (V1 a V4)                      │     │
│   │  • SPA Embebida (Servicio híbrido de React en LAN)           │     │
│   └──────────────────────────────┬───────────────────────────────┘     │
│                                  │                                     │
│                                  ▼ (JDBC Connection Pool Hikari)       │
│   ┌──────────────────────────────────────────────────────────────┐     │
│   │               PostgreSQL 16 (Relacional Transaccional)       │     │
│   │  • 11 Tablas Normalizadas                                    │     │
│   │  • Secuencia Atómica seq_pedido_correlativo                  │     │
│   │  • Índices de Rendimiento en Memoria                         │     │
│   └──────────────────────────────────────────────────────────────┘     │
└────────────────────────────────────────────────────────────────────────┘
```

### Componentes Técnicos
- **Backend:** Java 21, Spring Boot 3.3.5, Spring Security 6, Spring Data JPA, JJWT 0.12.6, Flyway, Springdoc OpenAPI (Swagger).
- **Frontend:** React 19, TypeScript, Material UI (MUI v6) con tokens semánticos Slate/Amber, TanStack Query v5, React Router v7, Lucide Icons.
- **Calidad y Linter:** Biome 2.5.15 (`pnpm lint`).
- **Base de Datos:** PostgreSQL 16 Alpine en contenedor Docker.
- **Contenedores:** Docker Compose multi-stage con perfiles de desarrollo local y producción híbrida.

---

## 📋 Resumen de Sprints

### ✅ Sprint 1: Fundación y Comandero (Completado)
- **HU001 - Iniciar sesión por perfil:** Dual login táctil con PIN de 4 dígitos para cocina/sala y credenciales completas para Administración.
- **HU002 - Roles y Accesos RBAC:** Perfiles `ADMIN`, `MOZO`, `COCINERO`, `EXPEDIDOR` protegidos con `@PreAuthorize`.
- **HU003 & HU023 - Catálogo de Platos y Tiempo Estándar:** Formulario maestro con validación de estación obligatoria y tiempo estándar > 0.
- **HU004 - Estaciones de Cocina:** Líneas de trabajo (Plancha, Fríos, Calientes, Bebidas, Horno) con vinculación persistente de terminal PC.
- **HU005 - Zonas y Mesas:** Distribución física con restricción relacional `UNIQUE(zona_id, numero_mesa)`.
- **RF-CFG-04 - Canales de Venta y SLAs:** Configuración de Salón, Para Llevar y Delivery con SLA objetivo.
- **HU006 - Apertura de Comanda:** Código correlativo diario atómico (`CMD-YYMMDD-XXXX`) mediante secuencia nativa de PostgreSQL.
- **HU007 - Carta Digital y Búsqueda Reactiva:** Búsqueda textual y filtrado por categoría en menos de 5 ms en cliente y < 30 ms en servidor.

---

## 🛠️ Puesta en Marcha Rápida (Local)

### Requisitos Previos
- Docker y Docker Compose v2+.
- Node.js 20+ y `pnpm` (no usar `npm`).
- Java 21 LTS (opcional si se ejecuta con Docker).

### 1. Iniciar la Base de Datos y Backend con Docker
```bash
# Levantar PostgreSQL 16 y el contenedor de Spring Boot
docker compose -f compose.local.yml up -d --build
```
- **Backend y SPA de Producción:** [http://localhost:8080/](http://localhost:8080/)
- **Documentación Swagger / OpenAPI:** [http://localhost:8080/swagger-ui.html](http://localhost:8080/swagger-ui.html)
- **PostgreSQL:** `localhost:5433` (Usuario: `kds_user`, Password: `kds_secret_pass`, BD: `kds_db`).

### 2. Iniciar el Frontend en Modo Desarrollo (Hot-Reload)
```bash
cd frontend
pnpm install
pnpm dev
```
- **Vite Dev Server:** [http://localhost:5173/](http://localhost:5173/) (disponible también en la IP LAN de la máquina para tablets táctiles).

---

## 🔑 Credenciales de Prueba

| Rol | Método de Acceso | Identificador / PIN | Contraseña | Destino Inicial |
|---|---|---|---|---|
| **Administrador** | Credenciales | `admin` | `admin123` | `/admin/productos` |
| **Mozo (Sala)** | PIN Táctil | PIN: `1234` | - | `/comandero` |
| **Cocinero** | PIN Táctil | PIN: `1234` | - | `/admin/estaciones` |
| **Expedidor** | Credenciales | `expedidor1` | `1234` | `/admin/estaciones` |

---

## 🛡️ Ciberseguridad y Buenas Prácticas
- **Criptografía:** `BCryptPasswordEncoder` (fuerza 12) para contraseñas y PINs numéricos.
- **Protección de Datos Sensibles (OWASP):** Las entidades y DTOs (`UsuarioDto`) omiten sistemáticamente cualquier hash criptográfico.
- **Sanitización de Errores:** `GlobalExceptionHandler` captura excepciones internas sin exponer nombres de tablas, columnas o trazas SQL a clientes HTTP.
- **Concurrencia Atómica:** Correlativos generados mediante secuencia PostgreSQL con bucle de verificación de colisiones para evitar inconsistencias en hora punta.
