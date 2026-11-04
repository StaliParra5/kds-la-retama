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

### 3.2 Historias de Usuario Incluidas (Sprint 2 - Jira KDSG5 Sprint 2)
- **HU008 - Indicar cantidades y modificadores** (KDSG5-8)
- **HU009 - Enviar comanda a cocina** (KDSG5-9)
- **HU010 - Registrar el canal de origen** (KDSG5-10)
- **HU011 - Enrutar ítems por estación** (KDSG5-11)
- **HU012 - Ver solo los ítems de mi estación** (KDSG5-12)
- **HU013 - Ciclo de vida del ítem** (KDSG5-13)
- **HU014 - Cambiar estado con un toque** (KDSG5-14)
- **HU022 - Trazabilidad de transiciones** (KDSG5-22)
- **HU030 - Marcar platos agotados** (KDSG5-30)
- **HU031 - Agregar ítems a comanda enviada** (KDSG5-31)
- **HU032 - Anular ítem con motivo** (KDSG5-32)

Solicitud del PO del 2026-11-03 (Bloque 3; HU008, HU030, HU031 y HU032 pasan al Bloque 4):
- **HU039 - Comandero exclusivo del mozo** (KDSG5-316)
- **HU040 - Administrar zonas del salón** (KDSG5-317)
- **HU041 - Editar mesas** (KDSG5-318)
- **HU042 - Gestionar mozos** (KDSG5-319)
- **HU043 - Asignar mozos a zonas** (KDSG5-320)
- **HU044 - Abrir la mesa antes del comandero** (KDSG5-321)
- **HU045 - Datos del cliente para llevar** (KDSG5-322)
- **HU046 - Liberar mesa** (KDSG5-323)
- **HU047 - Configurar semáforo de mesas** (KDSG5-324)
- **HU048 - Vista de salón para el administrador** (KDSG5-325)

### 3.3 Decisiones de Producto del Sprint 2 (aprobadas el 2026-11-03)
Decisiones que completan los criterios de Jira donde eran ambiguos o dependían de HU fuera del sprint.

| ID | Tema | Decisión |
|---|---|---|
| D1 | Estados del ítem (HU013) | `RECIBIDO → EN_PREPARACION → LISTO → DESPACHADO`; `RECIBIDO → EN_ESPERA → EN_PREPARACION`; `ANULADO` desde cualquier estado salvo `DESPACHADO`. El *recall* (`LISTO → EN_PREPARACION`) no tiene HU en el sprint y se rechaza siempre. |
| D2 | Motor de secuenciación | Fuera del sprint. Existen el estado `EN_ESPERA` y la columna `hora_disparo` (nula); todos los ítems entran en `RECIBIDO`. Una transición sin usuario se muestra como "Sistema". |
| D3 | Cambios simultáneos (HU013 Esc. 6) | Bloqueo optimista (`@Version`); el cliente envía el estado que ve y, si cambió, recibe 409 con el estado actual. |
| D4 | Historial inalterable (HU022 Esc. 5) | Sin endpoints de edición y trigger en PostgreSQL que bloquea `UPDATE`/`DELETE` en `transiciones_estado`. |
| D5 | Envío en una acción (HU009) | Crear la comanda es enviarla: pedido `ENVIADO`, ítems `RECIBIDO`, `fecha_envio_cocina` registrada; desaparece `BORRADOR`. Clave de idempotencia generada por el comandero para reintentos y doble pulsación. |
| D6 | Pantalla de estación | Ruta `/cocina`: estación vinculada a la PC (guardada en el navegador, HU004) o la del cocinero que inició sesión; el admin elige cualquiera. La estación viaja en el JWT del login por PIN. |
| D7 | Tiempo real | STOMP sobre WebSocket (`@stomp/stompjs`), un tópico por estación, reconexión automática y recarga de la cola al reconectar. |
| D8 | Roles por transición | Cocinero: `EN_ESPERA`, `EN_PREPARACION`, `LISTO` solo en su estación. Expedidor y admin: `DESPACHADO`. Mozo y admin: anular. |
| D9 | Pase | Pantalla mínima `/pase` con ítems listos y botón "Despachar". |
| D10 | Historial y mermas | Solo endpoints en el sprint (consultables por Swagger); pantallas de reporte en el siguiente. |
| D11 | Adiciones (HU031) | Al elegir una mesa con comanda activa se ofrece "Agregar a CMD-xxx"; cada ítem guarda número de adición y hora; si el pedido ya fue despachado se crea uno nuevo. |
| D12 | Motivos de anulación (HU032) | Lista fija: Error de digitación, Cliente cambió de opinión, Cliente se retiró, Demora excesiva, Plato con defecto, Otro. Anular en `EN_PREPARACION` o `LISTO` registra merma. |
| D13 | Modificadores (HU008) | Tabla `plato_modificadores` editable en el formulario del plato; el comandero muestra solo los del plato y se elimina el texto libre por ítem (se mantiene la observación general). |
| D14 | Agotados (HU030) | Aviso en menos de 5 s por WebSocket; los pedidos externos quedan cubiertos por la misma validación del servidor. |
| D15 | Jira | El inicio del sprint en el tablero queda a cargo del equipo. |

### 3.4 Decisiones del Bloque 3 (solicitud del PO, aprobadas el 2026-11-04)
Los escenarios completos de HU039 a HU048 están en Jira (KDSG5-316 a KDSG5-325).

| ID | Tema | Decisión |
|---|---|---|
| D16 | Comandero (HU039) | Solo el rol Mozo: Cocinero, Expedidor y Administrador no lo ven ni pueden registrar pedidos (403 en `POST /pedidos`). |
| D17 | Zonas (HU040) | Se reutiliza la entidad `Zona`. Se crean, editan, desactivan y reactivan; por ahora no se eliminan. No se desactiva una zona con mesas en atención. |
| D18 | Asignación de zonas (HU043) | Restrictiva: el mozo solo ve y opera las mesas de sus zonas, validado también en el servidor. Un mozo sin zonas solo registra pedidos para llevar. |
| D19 | Atención de mesa (HU044, HU046) | Abrir una mesa crea una atención (mozo, personas, hora). Los pedidos de salón cuelgan de la atención abierta. La mesa vuelve a libre cuando un mozo de su zona la libera, solo si no quedan ítems pendientes. |
| D20 | Para llevar (HU045) | Nombre y celular obligatorios (9 dígitos, empieza en 9). Delivery no cambia por ahora. |
| D21 | Semáforo de mesas (HU047, HU048) | Gris libre; verde, amarillo (≥ 20 min) y rojo (≥ 30 min) según la espera del pedido pendiente más antiguo desde su envío a cocina; azul "Atendida" si todo fue despachado y la mesa no se libera. Umbrales configurables por el admin. |
| D22 | Vista de salón (HU048) | Solo lectura y solo administrador. El detalle muestra el mozo que abrió y los mozos de la zona, personas, tiempo y pedidos con el estado de cada ítem. |

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

### RF-CAP-03 / HU008: Indicar cantidades y modificadores (Sprint 2 - KDSG5-8)
*Como mozo, quiero indicar la cantidad y los modificadores predefinidos de cada ítem, para que cocina prepare exactamente lo que pidió el cliente.*

- **Escenario 1 (Modificador destacado):**
  - **Given** un plato con modificadores
  - **When** el mozo pide 3 unidades con "sin cebolla"
  - **Then** la cocina ve la cantidad y el modificador resaltado.

- **Escenario 2 (Plato sin modificadores):**
  - **Given** un plato sin modificadores configurados
  - **When** el mozo lo agrega
  - **Then** solo puede indicar la cantidad.

- **Escenario 3 (Cantidad válida):**
  - **Given** un ítem en la comanda
  - **When** el mozo indica cantidad 0 o un valor negativo
  - **Then** el sistema no lo acepta.

- **Escenario 4 (Varios modificadores):**
  - **Given** un plato con modificadores
  - **When** el mozo selecciona "sin cebolla" y "término medio"
  - **Then** ambos se muestran en cocina junto al ítem.

- **Escenario 5 (Mismo plato con modificadores distintos):**
  - **Given** dos lomos saltados, uno normal y otro "sin cebolla"
  - **When** el mozo los agrega
  - **Then** se registran como dos ítems separados.

- **Escenario 6 (Editar antes de enviar):**
  - **Given** una comanda aún no enviada
  - **When** el mozo cambia la cantidad o quita un modificador
  - **Then** el cambio se refleja en el resumen de la comanda.

---

### RF-ING-01 / HU010: Registrar el canal de origen (Sprint 2 - KDSG5-10)
*Como administrador, quiero que todo pedido registre obligatoriamente su canal de origen, para medir tiempos y cumplimiento del SLA por canal.*

- **Escenario 1 (Validación en servidor):**
  - **Given** un pedido sin canal
  - **When** se intenta persistir
  - **Then** el servidor lo rechaza.

- **Escenario 2 (Asignación automática):**
  - **Given** una comanda creada en el comandero
  - **When** se envía
  - **Then** el canal se asigna según el tipo de comanda.

- **Escenario 3 (Canal según tipo de comanda):**
  - **Given** comandas de salón, para llevar y delivery propio
  - **When** se envían
  - **Then** quedan con el canal Salón, Para llevar y Delivery propio respectivamente.

- **Escenario 4 (Canal inactivo):**
  - **Given** un canal desactivado por el administrador
  - **When** llega un pedido con ese canal
  - **Then** el servidor lo rechaza e indica que el canal no está activo.

- **Escenario 5 (Canal inmutable):**
  - **Given** un pedido ya registrado
  - **When** se intenta cambiar su canal
  - **Then** el sistema no lo permite.

- **Escenario 6 (Canal visible en el detalle):**
  - **Given** un pedido registrado
  - **When** se consulta su detalle
  - **Then** muestra su canal de origen.

---

### RF-CAP-04 / HU009: Enviar comanda a cocina (Sprint 2 - KDSG5-9)
*Como mozo, quiero enviar la comanda en una sola acción y recibir confirmación de recepción, para tener certeza de que cocina recibió el pedido.*

- **Escenario 1 (Acuse de recibo):**
  - **Given** una comanda completa
  - **When** el mozo pulsa Enviar
  - **Then** aparece un acuse de recibo confirmado por el servidor.

- **Escenario 2 (Envío no confirmado):**
  - **Given** que el servidor no responde
  - **When** el mozo pulsa Enviar
  - **Then** el sistema indica que no hubo confirmación y permite reintentar sin duplicar el pedido.

- **Escenario 3 (Comanda vacía):**
  - **Given** una comanda sin ítems
  - **When** el mozo pulsa Enviar
  - **Then** el sistema no la envía e indica que debe agregar al menos un plato.

- **Escenario 4 (Comanda enviada no editable):**
  - **Given** una comanda ya enviada
  - **When** el mozo intenta modificar sus ítems
  - **Then** el sistema no permite editarlos directamente; los cambios se hacen como adición o anulación.

- **Escenario 5 (Doble pulsación):**
  - **Given** un mozo que pulsa Enviar dos veces seguidas
  - **When** el servidor procesa las solicitudes
  - **Then** se registra un solo pedido.

- **Escenario 6 (Plato agotado al enviar):**
  - **Given** un plato marcado como agotado después de agregarse a la comanda
  - **When** el mozo pulsa Enviar
  - **Then** el sistema rechaza el envío e indica el plato agotado.

---

### RF-KDS-01 / HU011: Enrutar ítems por estación (Sprint 2 - KDSG5-11)
*Como cocinero, quiero que cada ítem del pedido llegue automáticamente a la estación que lo prepara, para no depender de que alguien reparta las comandas en papel.*

- **Escenario 1 (Pedido multiestación):**
  - **Given** un pedido con 4 platos de 3 estaciones
  - **When** se envía
  - **Then** los ítems aparecen repartidos en las 3 pantallas correspondientes.

- **Escenario 2 (Pedido de una estación):**
  - **Given** un pedido cuyos platos pertenecen a una sola estación
  - **When** se envía
  - **Then** solo esa estación lo recibe.

- **Escenario 3 (Cantidad y modificadores):**
  - **Given** un ítem pedido con cantidad 3 y el modificador "sin cebolla"
  - **When** se enruta
  - **Then** llega a su estación como un solo ítem con cantidad 3 y el modificador visible.

- **Escenario 4 (Pantalla de estación apagada):**
  - **Given** que la PC de Fríos está apagada
  - **When** se envía un pedido con un plato de Fríos
  - **Then** el ítem queda asignado a esa estación y aparece en cuanto la pantalla se conecta.

- **Escenario 5 (Plato reasignado de estación):**
  - **Given** un plato que el administrador movió de Plancha a Frituras
  - **When** se envía un pedido nuevo
  - **Then** el ítem llega a Frituras, y los pedidos enviados antes del cambio permanecen en Plancha.

- **Escenario 6 (Estación desactivada):**
  - **Given** un plato cuya estación fue desactivada
  - **When** el mozo intenta enviar el pedido
  - **Then** el sistema lo impide e indica qué plato no tiene estación activa.

---

### RF-KDS-02 / HU012: Ver solo los ítems de mi estación (Sprint 2 - KDSG5-12)
*Como cocinero, quiero ver únicamente los ítems de mi estación con la referencia de su pedido, para concentrarme en lo que me toca sin perder el contexto del pedido.*

- **Escenario 1 (Filtrado por estación):**
  - **Given** la pantalla de Fríos
  - **When** llegan pedidos mixtos
  - **Then** no se muestran ítems de Plancha.

- **Escenario 2 (Referencia al pedido):**
  - **Given** cualquier ítem en pantalla
  - **When** se visualiza
  - **Then** muestra el código del pedido al que pertenece.

- **Escenario 3 (Varios ítems de la misma estación):**
  - **Given** un pedido con dos platos de Plancha
  - **When** se visualiza en Plancha
  - **Then** ambos aparecen agrupados bajo el mismo código de pedido.

- **Escenario 4 (Ítems del pedido en otras estaciones):**
  - **Given** un ítem de Plancha cuyo pedido incluye platos de Fríos
  - **When** el cocinero lo consulta
  - **Then** ve cuántos ítems tiene el pedido en otras estaciones sin poder modificarlos.

- **Escenario 5 (Ítem listo fuera de la cola):**
  - **Given** un ítem marcado como Listo
  - **When** se actualiza la pantalla
  - **Then** deja de mostrarse en la cola activa de la estación.

- **Escenario 6 (Estación sin pedidos):**
  - **Given** una estación sin ítems pendientes
  - **When** se visualiza
  - **Then** muestra el mensaje "Sin pedidos" en lugar de una pantalla vacía.

---

### RF-CIC-01 / HU013: Ciclo de vida del ítem (Sprint 2 - KDSG5-13)
*Como expedidor, quiero que cada ítem siga los estados Recibido, En espera, En preparación, Listo y Despachado, para saber en qué punto está cada preparación.*

- **Escenario 1 (Flujo válido):**
  - **Given** un ítem en Recibido
  - **When** avanza en su preparación
  - **Then** recorre los estados en el orden definido.

- **Escenario 2 (Transición inválida):**
  - **Given** un ítem en Recibido
  - **When** se intenta marcarlo como Despachado
  - **Then** el sistema rechaza la transición.

- **Escenario 3 (Estado inicial):**
  - **Given** un pedido recién enviado
  - **When** se registra
  - **Then** todos sus ítems quedan en estado Recibido.

- **Escenario 4 (Retroceso no permitido):**
  - **Given** un ítem en estado Listo
  - **When** se intenta devolverlo a En preparación sin usar recall
  - **Then** el sistema rechaza la transición.

- **Escenario 5 (Estado final):**
  - **Given** un ítem Despachado
  - **When** se intenta cualquier cambio de estado
  - **Then** el sistema lo rechaza.

- **Escenario 6 (Cambios simultáneos):**
  - **Given** un ítem que dos usuarios intentan cambiar de estado al mismo tiempo
  - **When** el servidor procesa ambas solicitudes
  - **Then** aplica solo la primera y la segunda recibe el estado actualizado.

---

### RF-CIC-02 / HU014: Cambiar estado con un toque (Sprint 2 - KDSG5-14)
*Como cocinero, quiero iniciar y marcar como listo un ítem con un solo toque, para no perder tiempo en la pantalla durante el servicio.*

- **Escenario 1 (Iniciar preparación):**
  - **Given** un ítem pendiente
  - **When** el cocinero lo toca
  - **Then** pasa a En preparación sin menús intermedios.

- **Escenario 2 (Marcar listo):**
  - **Given** un ítem en preparación
  - **When** el cocinero lo toca
  - **Then** pasa a Listo.

- **Escenario 3 (Ítem en espera):**
  - **Given** un ítem En espera cuya hora de disparo no ha llegado
  - **When** el cocinero lo toca
  - **Then** el sistema pide confirmación antes de iniciarlo anticipadamente.

- **Escenario 4 (Ítem listo):**
  - **Given** un ítem en estado Listo
  - **When** el cocinero lo toca
  - **Then** no cambia de estado, porque el despacho se confirma desde el pase.

- **Escenario 5 (Confirmación visual):**
  - **Given** un ítem que cambia de estado
  - **When** el cocinero lo toca
  - **Then** la tarjeta cambia de color y etiqueta al instante.

- **Escenario 6 (Ítem anulado):**
  - **Given** un ítem anulado mientras estaba en pantalla
  - **When** el cocinero intenta tocarlo
  - **Then** el sistema indica que fue anulado y no cambia su estado.

---

### RF-CIC-05 / HU022: Trazabilidad de transiciones (Sprint 2 - KDSG5-22)
*Como administrador, quiero que cada cambio de estado registre usuario, fecha y hora, para medir tiempos reales y saber quién hizo cada acción.*

- **Escenario 1 (Registro de transición):**
  - **Given** un ítem
  - **When** cambia de estado
  - **Then** se persisten fecha, hora y usuario responsable.

- **Escenario 2 (Consulta de historial):**
  - **Given** un ítem despachado
  - **When** el administrador consulta su historial
  - **Then** ve todas sus transiciones en orden.

- **Escenario 3 (Transiciones automáticas):**
  - **Given** un ítem que pasa a Disparar ahora por el motor de secuenciación
  - **When** se registra la transición
  - **Then** el responsable figura como "Sistema".

- **Escenario 4 (Recall registrado):**
  - **Given** un recall dentro de la ventana permitida
  - **When** se ejecuta
  - **Then** queda registrado como una transición más, sin borrar la anterior.

- **Escenario 5 (Historial inalterable):**
  - **Given** un historial de transiciones
  - **When** cualquier usuario intenta editarlo o eliminarlo
  - **Then** el sistema no lo permite.

- **Escenario 6 (Hora del servidor):**
  - **Given** PCs con relojes distintos
  - **When** registran transiciones
  - **Then** todas usan la hora del servidor.

---

### RF-CFG-05 / HU030: Marcar platos agotados (Sprint 2 - KDSG5-30)
*Como administrador, quiero marcar platos como agotados y reactivarlos, para que los mozos no tomen pedidos que no se pueden preparar.*

- **Escenario 1 (Agotar):**
  - **Given** un plato activo
  - **When** se marca como agotado
  - **Then** desaparece del comandero en menos de 5 segundos.

- **Escenario 2 (Reactivar):**
  - **Given** un plato agotado
  - **When** se reactiva
  - **Then** vuelve a estar disponible en el comandero.

- **Escenario 3 (Comanda en curso):**
  - **Given** un plato agregado a una comanda aún no enviada
  - **When** se marca como agotado
  - **Then** el comandero avisa al mozo que debe retirarlo antes de enviar.

- **Escenario 4 (Pedidos ya enviados):**
  - **Given** un plato con ítems ya enviados a cocina
  - **When** se marca como agotado
  - **Then** esos ítems siguen en preparación sin cambios.

- **Escenario 5 (Agotado no es desactivado):**
  - **Given** un plato agotado
  - **When** el administrador consulta el catálogo
  - **Then** el plato sigue registrado e identificado como agotado.

- **Escenario 6 (Pedidos externos):**
  - **Given** un plato agotado
  - **When** llega un pedido externo que lo incluye
  - **Then** el sistema rechaza el ítem e indica que está agotado.

---

### RF-CAP-05 / HU031: Agregar ítems a comanda enviada (Sprint 2 - KDSG5-31)
*Como mozo, quiero agregar ítems a una comanda ya enviada, para atender pedidos adicionales de la misma mesa.*

- **Escenario 1 (Adición identificable):**
  - **Given** una comanda enviada
  - **When** el mozo agrega ítems
  - **Then** llegan a cocina marcados como adición.

- **Escenario 2 (Pedido padre):**
  - **Given** una adición
  - **When** se visualiza en cocina
  - **Then** conserva el código del pedido original sin confundirse con él.

- **Escenario 3 (Enrutamiento de la adición):**
  - **Given** una adición con platos de dos estaciones
  - **When** se envía
  - **Then** cada ítem llega solo a su estación.

- **Escenario 4 (Pedido ya despachado):**
  - **Given** un pedido despachado
  - **When** el mozo agrega ítems para esa mesa
  - **Then** el sistema los registra como un pedido nuevo de la misma mesa.

- **Escenario 5 (Varias adiciones):**
  - **Given** un pedido con dos adiciones
  - **When** se visualiza en cocina
  - **Then** cada adición se distingue con su hora de envío.

- **Escenario 6 (Secuenciación de la adición):**
  - **Given** una adición
  - **When** se registra
  - **Then** la hora de disparo de sus ítems se calcula de forma independiente sin alterar los ítems ya iniciados.

---

### RF-CAP-06 / HU032: Anular ítem con motivo (Sprint 2 - KDSG5-32)
*Como mozo, quiero anular un ítem enviado indicando el motivo, para corregir errores y registrar mermas.*

- **Escenario 1 (Ítem no iniciado):**
  - **Given** un ítem aún no iniciado
  - **When** se anula
  - **Then** se retira de la estación sin registrar merma.

- **Escenario 2 (Ítem en preparación):**
  - **Given** un ítem en preparación
  - **When** se anula
  - **Then** se registra como merma consultable.

- **Escenario 3 (Motivo obligatorio):**
  - **Given** un ítem a anular
  - **When** el mozo no selecciona un motivo
  - **Then** el sistema no permite confirmar la anulación.

- **Escenario 4 (Ítem despachado):**
  - **Given** un ítem despachado
  - **When** se intenta anular
  - **Then** el sistema no lo permite.

- **Escenario 5 (Aviso en cocina):**
  - **Given** un ítem en preparación que se anula
  - **When** se confirma
  - **Then** la estación recibe un aviso visible de la anulación.

- **Escenario 6 (Anulación de todos los ítems):**
  - **Given** un pedido cuyos ítems se anulan todos
  - **When** se anula el último
  - **Then** el pedido queda como anulado y sale de la cola.

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
