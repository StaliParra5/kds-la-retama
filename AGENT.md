# Guía de Ingeniería y Estándares para Agentes (AGENT.md)

Este documento es el **manual canónico y estricto** que todo agente de Inteligencia Artificial debe acatar al trabajar en el proyecto **KDS (Kitchen Display System - La Retama Restaurante)**.

---

## 🧠 1. Mentalidad de Ingeniería Senior (Senior Philosophy)

1. **Cero Cabos Sueltos y Cero Suposiciones:** No des por sentado que una funcionalidad "debería funcionar". Cada cambio debe ser probado, verificado contra la base de datos y validado en llamadas reales.
2. **Pensamiento Multiescenario y Edge Cases:** Al diseñar o implementar cualquier tarea, imagínate los escenarios límite más exigentes:
   - ¿Qué pasa si 10 mozos abren una comanda en el mismo milisegundo durante hora punta? (Concurrencia atómica).
   - ¿Qué ocurre si la red local pierde paquetes o SockJS se desconecta momentáneamente? (Reconexión y resiliencia).
   - ¿Qué sucede si una pantalla táctil de cocina se reinicia de imprevisto? (Persistencia en `localStorage` de la estación).
   - ¿Qué ocurre si un usuario envía campos truncados, nulos o caracteres inesperados? (Validación JSR-380 estricta).
3. **Auditoría Continua de Ciberseguridad y Calidad:** Al finalizar cada tarea o sprint, lanza agentes o rutinas de verificación para auditar OWASP, fugas de excepciones, consultas N+1 y cobertura de tests.

---

## 🏗️ 2. Stack Tecnológico y Reglas de Plataforma

- **Backend:** Java 21 LTS + Spring Boot 3.3.5 (Spring Security 6, Spring Data JPA, WebSockets STOMP, JJWT 0.12.6, Flyway).
- **Frontend:** React 19 + TypeScript + Material UI (MUI v6) + TanStack Query v5 + React Router v7.
- **Herramienta de Calidad Frontend:** Biome 2.5.15 (`pnpm lint`, `pnpm format`).
- **Gestor de Paquetes:** **USAR SIEMPRE `pnpm`**, NUNCA `npm`.
- **Base de Datos:** PostgreSQL 16 Alpine (migraciones estructuradas con Flyway).
- **Despliegue Híbrido:** El frontend compilado (`frontend/dist/`) se incrusta en `backend/src/main/resources/static/` para que Spring Boot sirva la aplicación completa de forma autónoma en la red local (LAN) en el puerto `8080`.

---

## 📝 3. Reglas de Código y Buenas Prácticas Obligatorias

### 3.1 Comentarios Estratégicos e Inteligentes al Editar Código
Al realizar **cualquier modificación en el código (por mínima que sea)**, debes incluir **SIEMPRE comentarios estratégicos e inteligentes** directamente en el archivo. Estos comentarios deben explicar de forma concisa el *porqué* del cambio, la intención del diseño, o consideraciones no obvias (ej. prevención de condiciones de carrera, optimización N+1, reglas OWASP).
> ❌ *Evitar comentarios redundantes que solo digan lo que el código ya expresa de forma evidente (ej: `// suma 1 al contador`).*  
> ✔️ *Usar comentarios que aporten valor arquitectónico (ej: `// Concurrencia atómica: se consulta la secuencia nativa para evitar colisiones en hora punta`).*

### 3.2 Separación Estricta de Entidades y DTOs (JSR-380)
- **NUNCA** recibas ni expongas entidades JPA (`@Entity`) directamente en los controladores REST.
- Crea siempre DTOs dedicados de solicitud (`Request`) y respuesta (`Response` / `Dto`).
- Anota cada DTO de entrada con `@Valid` y validaciones Bean Validation (`@NotBlank`, `@NotNull`, `@Min`, `@Positive`, `@Pattern`, `@Size`).
- Protege la base de datos contra payloads corruptos o no tipados (evitar `Map<String, Object>`).

### 3.3 Erradicación de Consultas N+1 y Rendimiento
- **NUNCA** cargues listas completas a memoria (`.findAll()` o `.findBy...().size()`) únicamente para contar elementos.
- Usa métodos de agregación directos en Spring Data JPA: `countByEstacionIdAndActivoTrue(Long id)`.
- Diseña índices estratégicos en PostgreSQL para cualquier campo filtrado con frecuencia (`estado`, `canal_id`, `created_at`).

### 3.4 Migraciones Flyway Inmutables
- **NUNCA** modifiques scripts de migración existentes que ya hayan sido ejecutados (`V1`, `V2`, etc.).
- Todo cambio en el esquema relacional o secuencia debe añadirse como una nueva migración incremental: `V{N}__{descripcion}.sql`.

---

## 🔒 4. Protocolo de Ciberseguridad (OWASP ASVS)

1. **Hashes Seguros:** Contraseñas y PINs siempre con `BCryptPasswordEncoder` (costo 12).
2. **Protección de Datos Sensibles:**
   - En entidades JPA, anota `passwordHash` y `pinHash` con `@JsonIgnore`.
   - En DTOs como `UsuarioDto`, **NUNCA** incluyas campos de hash; solo expón flags booleanos de estado (ej: `tienePin: boolean`).
3. **Manejo Centralizado y Sanitizado de Excepciones:**
   - En `GlobalExceptionHandler.java`, captura `Exception.class` (HTTP 500) registrando la traza completa con `log.error(...)` en el servidor, pero devolviendo un mensaje genérico y seguro al cliente. **NUNCA devuelvas `ex.getMessage()` crudo en errores 500** para no filtrar nombres de tablas, columnas o sintaxis SQL.
4. **Control de Acceso Basado en Roles (RBAC):**
   - Todos los endpoints administrativos deben estar protegidos con `@PreAuthorize("hasRole('ADMIN')")`.
   - Verifica que los roles operativos (`MOZO`, `COCINERO`, `EXPEDIDOR`) reciban `403 Forbidden` al intentar mutar recursos maestros.
5. **Autenticación e Identidad Confiable:**
   - Extrae la identidad del usuario del `Authentication` / `SecurityContextHolder`. **NUNCA uses nombres de usuario mock hardcodeados** en controladores de producción.

---

## 🚀 5. Protocolo de Despliegue y Verificación en Vivo

### 5.1 Monitoreo de Despliegue Obligatorio en Vivo
Cada vez que realices una reconstrucción o despliegue en Docker (`docker compose up -d --build`):
1. **Debes monitorear el progreso y los logs en tiempo real** (`docker compose logs --tail 50 backend`).
2. Verifica explícitamente:
   - Que las migraciones Flyway se aplicaron exitosamente (`Successfully applied X migration(s)`).
   - Que Tomcat inició en el puerto `8080`.
   - Que los WebSockets (`SimpleBrokerMessageHandler`) inicializaron correctamente.
   - Que no existen excepciones no controladas en el arranque.

### 5.2 Suite de Pruebas Automatizadas
- Antes de dar por finalizada una tarea, ejecuta la suite de tests unitarios:
  ```bash
  mvn clean package -B # En backend
  pnpm lint && pnpm build # En frontend
  ```
- Cada nuevo servicio debe contar con su correspondiente clase de prueba en `backend/src/test/java/pe/isil/kds/` con Mockito y JUnit 5.

---

## 🛑 6. Restricción Estricta de Git

> [!CAUTION]
> **Git Push Behavioral Constraint:**  
> **NUNCA ejecutes `git push` ni envíes commits a un repositorio remoto de forma automática.**  
> Debes esperar SIEMPRE la instrucción explícita y directa del usuario antes de ejecutar cualquier comando de push remoto.

---

## 👥 7. Uso Inteligente de Subagentes

Al abordar refactorizaciones grandes, auditorías de seguridad o migraciones de base de datos:
- Lanza subagentes especializados (`research` o configurados ad-hoc) para auditar vulnerabilidades, casos de borde y cumplimiento de criterios de aceptación BDD.
- Evalúa los reportes del subagente e integra las soluciones antes de reportar el trabajo como completado.
