# Especificación de Requerimientos del Sistema KDS (Kitchen Display System)

**Proyecto:** Sistema KDS para Restaurantes Medianos (Caso: La Retama Restaurante)  
**Institución:** ISIL - Proyecto Tecnológico  
**Sprint Actual:** Sprint 1 · Fundación y Comandero  
**Versión:** 1.0.0  

---

## 1. Resumen Ejecutivo y Contexto de Negocio

El sistema KDS (Kitchen Display System) es una solución modular cliente-servidor on-premise diseñada para operar en la red de área local (LAN) de restaurantes de tamaño mediano (40 a 120 cubiertos). El proyecto piloto está contextualizado en **La Retama Restaurante** (Jesús María, Lima).

### 1.1 Problemática Identificada
1. **Pedidos dispersos por canal:** Comandas físicas de salón, pedidos por WhatsApp/teléfono y agregadores sin cola unificada.
2. **Reparto manual entre estaciones:** Descoordinación de cocina (plancha, fríos, frituras, bebidas) por comunicación verbal.
3. **Platos desfasados:** Pérdida de temperatura y sincronización al servir la mesa.
4. **Ausencia de métricas:** Falta de trazabilidad en tiempos reales de preparación y despacho por canal.
5. **Conectividad inestable:** Riesgo de parálisis operativa ante caídas de internet en la nube.

### 1.2 Objetivos del Sistema
- **General:** Implementar un MVP de KDS en 12 semanas de desarrollo estructurado en 4 sprints que centralice comandas, enrute por estación, secuencie tiempos y opere 100% en LAN sin internet obligatoria.
- **Sprint 1 (Fundación y Comandero):** Implementar la infraestructura base, control de acceso por rol y PIN, catálogos maestros administrables (platos, estaciones, mesas, canales) y la apertura y armado de comandas desde la PC de sala (Comandero).

---

## 2. Stakeholders y Perfiles de Usuario

| Rol | Perfil Técnico | Responsabilidades en el Sistema | Método de Acceso |
|---|---|---|---|
| **Administrador** | Gestión de Negocio | Configurar catálogo de platos, estaciones, zonas, mesas, canales de venta, SLA y usuarios. | Usuario + Contraseña |
| **Mozo / Sala** | Atención al Cliente | Apertura de comandas, selección de mesa/destino, búsqueda de platos y armado de comandas. | Usuario + Contraseña / PIN |
| **Cocinero** | Personal Operativo | Visualizar pedidos asignados a su estación de cocina y marcar cambios de estado táctiles. | PIN de 4 dígitos |
| **Expedidor** | Control de Pase | Supervisar la consolidación de todos los ítems de un pedido antes del despacho a sala o delivery. | Usuario + Contraseña |

---

## 3. Alcance de Sprint 1

### 3.1 Historias de Usuario Incluidas (Sprint 1)
- **HU001 - Iniciar sesión según perfil (RF-INF-01)** [Peso: 800 | B1]
- **HU002 - Gestionar roles y accesos (RF-INF-02)** [Peso: 780 | B1]
- **HU003 - Gestionar catálogo de platos (RF-CFG-01)** [Peso: 820 | F2]
- **HU004 - Configurar estaciones de cocina (RF-CFG-02)** [Peso: 850 | B2]
- **HU005 - Gestionar zonas y mesas (RF-CFG-03)** [Peso: 600 | B2]
- **RF-CFG-04 - Configurar canales de venta y SLA por canal** [Peso: 850 | B2]
- **HU023 - Tiempo estándar por plato (RF-SEC-01)** [Peso: 940 | B2]
- **HU006 - Abrir comanda (RF-CAP-01)** [Peso: 750 | F1]
- **HU007 - Agregar ítems desde la carta digital (RF-CAP-02)** [Peso: 720 | F1]
- **Setup QA / DevOps:** Setup Maven Spring Boot + Vite React MUI + Docker Compose PostgreSQL 16 + Flyway + Empaquetado embebido.

---

## 4. Requerimientos Funcionales y Criterios de Aceptación (BDD)

### RF-INF-01 / HU001: Iniciar sesión según perfil
*Como usuario (cocinero o administrador), quiero ingresar al sistema con el método adecuado a mi puesto para agilizar la operación sin vulnerar la seguridad.*

- **Escenario 1 (Ingreso con PIN en cocina):**
  - **Given** un cocinero registrado con PIN de 4 dígitos asignado a una estación
  - **When** ingresa su PIN numérico en la pestaña de Ingreso Rápido de la pantalla de login
  - **Then** el sistema autentica al usuario, emite un token JWT y lo redirige directamente a la vista de su estación sin pasos adicionales.

- **Escenario 2 (Ingreso administrativo con credenciales completas):**
  - **Given** un usuario con rol de Administrador
  - **When** ingresa su nombre de usuario y contraseña en la pestaña de Acceso Administrativo
  - **Then** el sistema valida el hash BCrypt, genera el token JWT y lo redirige al panel de administración.
  - **And** si intenta ingresar únicamente con PIN a funciones de administración, el sistema bloquea la acción.

---

### RF-INF-02 / HU002: Gestionar roles y accesos
*Como administrador, quiero asignar roles a los usuarios para que cada rol visualice exclusivamente las pantallas autorizadas.*

- **Escenario 1 (Restricción de vistas y endpoints):**
  - **Given** un usuario autenticado con rol `COCINERO`
  - **When** intenta acceder por URL o API a endpoints de configuración o reportes (`/admin/**`)
  - **Then** el sistema responde con error 403 Forbidden y la interfaz muestra un aviso de permiso insuficiente.

- **Escenario 2 (Actualización de rol):**
  - **Given** un usuario existente
  - **When** el administrador actualiza su rol de `MOZO` a `ADMINISTRADOR`
  - **Then** en la siguiente sesión del usuario sus permisos y menú de navegación reflejan el nuevo rol.

---

### RF-CFG-01 / HU003: Gestionar catálogo de platos
*Como administrador, quiero dar de alta, editar y desactivar platos con categoría, estación y tiempo estándar para permitir el enrutamiento correcto.*

- **Escenario 1 (Alta de plato con validación de obligatoriedad):**
  - **Given** el formulario de nuevo plato en el módulo de administración
  - **When** el administrador envía el formulario con nombre, categoría, estación asignada, precio y tiempo estándar > 0
  - **Then** el plato queda registrado en la base de datos y disponible en el comandero.

- **Escenario 2 (Rechazo de plato incompleto):**
  - **Given** el formulario de nuevo plato
  - **When** se intenta guardar sin asignar estación de cocina o con tiempo estándar <= 0
  - **Then** el sistema impide el guardado y resalta los campos faltantes requeridos.

---

### RF-CFG-02 / HU004: Configurar estaciones de cocina
*Como administrador, quiero registrar las estaciones de cocina y vincular terminales PC para enrutar los ítems.*

- **Escenario 1 (Alta y activación de estaciones):**
  - **Given** el módulo de estaciones
  - **When** se registran las estaciones (ej: Plancha, Fríos, Calientes, Bebidas)
  - **Then** quedan listadas con su estado activo y listas para asignación en platos.

- **Escenario 2 (Vinculación persistente de terminal de cocina):**
  - **Given** una PC de cocina vinculada a la estación "Plancha"
  - **When** el terminal se reinicia o se recarga la página
  - **Then** mantiene en almacenamiento local la estación predeterminada seleccionada.

---

### RF-CFG-03 / HU005: Gestionar zonas y mesas
*Como administrador, quiero registrar las zonas del salón y sus mesas para asociar el destino de las comandas.*

- **Escenario 1 (Creación de zonas y mesas):**
  - **Given** una zona configurada (ej: "Salón Principal")
  - **When** se registran mesas (ej: 01 a 12)
  - **Then** aparecen ordenadas en la grilla del comandero para selección del mozo.

- **Escenario 2 (Unicidad de número de mesa):**
  - **Given** una mesa con número "05" existente en la zona "Salón Principal"
  - **When** se intenta registrar otra mesa con número "05" en la misma zona
  - **Then** el sistema rechaza la operación informando duplicidad.

---

### RF-CFG-04 & RF-SEC-01 / HU023: Canales de venta, SLA y Tiempo estándar
*Como administrador, quiero definir canales de venta (Salón, Para Llevar, Delivery), su SLA objetivo y el tiempo estándar de cada plato.*

- **Escenario 1 (Configuración de Canales y SLA):**
  - **Given** la configuración de canales
  - **When** se asignan tiempos SLA objetivo (Salón: 15 min, Para Llevar: 15 min, Delivery: 30 min)
  - **Then** quedan almacenados para calcular el semáforo de pedidos.

- **Escenario 2 (Tiempo estándar por plato):**
  - **Given** un plato específico (ej: "Lomo Saltado")
  - **When** se configura su tiempo estándar en 14 minutos
  - **Then** el valor queda persistido para su posterior utilización en el motor de secuenciación.

---

### RF-CAP-01 / HU006: Abrir comanda
*Como mozo, quiero abrir una nueva comanda seleccionando el tipo de pedido (Mesa salón, Para llevar, Delivery) para iniciar la toma de orden.*

- **Escenario 1 (Apertura de comanda con código correlativo único):**
  - **Given** el mozo en la pantalla del Comandero
  - **When** selecciona el canal "Salón" y la "Mesa 08"
  - **Then** se inicializa una comanda con código correlativo (ej: `#CMD-00101`) y estado preliminar `BORRADOR/ABIERTA`.

- **Escenario 2 (Obligatoriedad de mesa en canal Salón):**
  - **Given** el canal "Salón" seleccionado
  - **When** el mozo intenta armar la comanda sin indicar número de mesa
  - **Then** el sistema exige la selección de mesa antes de habilitar el envío o confirmación.

---

### RF-CAP-02 / HU007: Carta digital y agregado de ítems
*Como mozo, quiero buscar platos por nombre y filtrar por categorías para armar el pedido en segundos.*

- **Escenario 1 (Búsqueda en tiempo inferior a 3 segundos):**
  - **Given** una carta con más de 150 ítems cargados
  - **When** el mozo escribe "lomo" en la barra de búsqueda
  - **Then** los resultados filtrados aparecen en menos de 500 ms (cumpliendo el umbral < 3 s).

- **Escenario 2 (Filtro por categorías y agregado al carrito):**
  - **Given** las categorías "Entradas", "Fondos", "Bebidas", "Postres"
  - **When** el mozo selecciona "Fondos" y presiona "+" en "Lomo Saltado"
  - **Then** el ítem se suma al panel lateral de resumen con su cantidad y subtotal actualizados.

---

## 5. Requerimientos No Funcionales (NFR)

1. **Rendimiento y Latencia Local:**
   - Búsqueda de platos en catálogo: < 500 ms en cliente, < 100 ms en backend.
   - Tiempo de respuesta de endpoints CRUD maestros: < 200 ms en red local.
2. **Disponibilidad On-Premise (LAN):**
   - El 100% de la funcionalidad de Sprint 1 debe operar sin conexión a Internet externa.
3. **Seguridad y Criptografía:**
   - Almacenamiento de contraseñas con `BCryptPasswordEncoder` (fuerza 12).
   - PIN de cocina hasheado con sal o BCrypt.
   - Tokens JWT firmados con algoritmo HMAC-SHA256 y expiración configurable (ej. 8 horas de turno).
4. **Diseño y Usabilidad:**
   - Interfaz React con Material UI adaptada al diseño visual aprobado (`KDS_PREVISUALIZACION`), con soporte para modo kiosco y controles táctiles generosos (botones mínimo 44x44px).
5. **Calidad de Código y Estándares:**
   - Linter/Formatter Biome en Frontend.
   - Pruebas unitarias de controladores, servicios y repositorios en Spring Boot con JUnit 5 y Mockito.
