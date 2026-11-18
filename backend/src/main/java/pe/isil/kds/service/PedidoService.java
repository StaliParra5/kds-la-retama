package pe.isil.kds.service;

import org.springframework.security.access.AccessDeniedException;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import pe.isil.kds.exception.OperacionNoPermitidaException;
import pe.isil.kds.exception.RecursoNoEncontradoException;
import pe.isil.kds.dto.CrearPedidoRequest;
import pe.isil.kds.dto.ItemCocinaDto;
import pe.isil.kds.dto.ItemPedidoRequest;
import pe.isil.kds.dto.PedidoResponse;
import pe.isil.kds.model.*;
import pe.isil.kds.repository.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Locale;
import java.util.stream.Collectors;

/**
 * Servicio de Pedidos y Comandas (HU006 & HU007).
 * 
 * Reglas de Negocio Implementadas:
 * - Si el canal es 'SALON', la selección de mesa es obligatoria (HU006 Escenario 2).
 * - Todo pedido registra un canal de origen existente y activo (HU010 Escenarios 1 y 4).
 * - Registrar la comanda equivale a enviarla a cocina: queda ENVIADO con hora de envío (HU009, D5).
 * - Una clave de idempotencia repetida devuelve el pedido ya registrado sin duplicarlo (HU009 Esc. 2 y 5),
 *   siempre que la use el mismo mozo con el mismo contenido; si no, se rechaza (409).
 * - Se rechazan platos agotados o dados de baja indicando cuál (HU009 Esc. 6).
 * - Cada ítem se enruta a la estación del plato vigente al pedirlo; si esa estación está
 *   desactivada el envío se rechaza (HU011 Esc. 5 y 6). Las estaciones reciben sus ítems por
 *   WebSocket solo después del commit (HU011 Esc. 1 a 3).
 * - Cada comanda recibe un código correlativo único diario secuencial (HU006 Escenario 1).
 * - Calcula subtotales y totales preservando precios unitarios y tiempos estándar en cada detalle.
 * - Los modificadores de cada ítem deben pertenecer al catálogo del plato; un plato sin catálogo solo admite
 *   cantidad. Se guardan con el nombre del catálogo, sin repetidos y unidos por coma (HU008 Esc. 1, 2 y 4).
 * - Pedidos externos (HU019/HU020): entran por la misma ruta que los del comandero, pero Salón no los admite;
 *   los canales de agregadores (Rappi) exigen el número de orden, no guardan celular ni dirección y no se toman
 *   desde el comandero; WhatsApp y teléfono (Delivery propio) exigen nombre, celular y dirección de entrega.
 *   Para llevar es recojo en el local: nunca guarda dirección.
 * - Registra la transición inicial de estado en la tabla inmutable para trazabilidad.
 */
@Service
public class PedidoService {

    private final PedidoRepository pedidoRepository;
    private final CanalVentaRepository canalRepository;
    private final MesaRepository mesaRepository;
    private final PlatoRepository platoRepository;
    private final UsuarioRepository usuarioRepository;
    private final TrazabilidadService trazabilidadService;
    private final ApplicationEventPublisher eventPublisher;
    private final AtencionMesaRepository atencionRepository;

    public PedidoService(
            PedidoRepository pedidoRepository,
            CanalVentaRepository canalRepository,
            MesaRepository mesaRepository,
            PlatoRepository platoRepository,
            UsuarioRepository usuarioRepository,
            TrazabilidadService trazabilidadService,
            ApplicationEventPublisher eventPublisher,
            AtencionMesaRepository atencionRepository) {
        this.pedidoRepository = pedidoRepository;
        this.canalRepository = canalRepository;
        this.mesaRepository = mesaRepository;
        this.platoRepository = platoRepository;
        this.usuarioRepository = usuarioRepository;
        this.trazabilidadService = trazabilidadService;
        this.eventPublisher = eventPublisher;
        this.atencionRepository = atencionRepository;
    }

    public static final String CODIGO_MESA_SIN_ATENCION = "MESA_SIN_ATENCION";
    private static final String CANAL_SALON = "SALON";
    private static final String CANAL_PARA_LLEVAR = "PARA_LLEVAR";
    private static final String CELULAR_PERU = "9[0-9]{8}";
    // HU034: códigos para que el cliente distinga un pedido externo repetido de otros 409
    public static final String CODIGO_PEDIDO_EXTERNO_DUPLICADO = "PEDIDO_EXTERNO_DUPLICADO";
    public static final String CODIGO_PEDIDO_EXTERNO_CONFLICTO = "PEDIDO_EXTERNO_CONFLICTO";
    // Ventana de la lista de pedidos externos recientes (D32)
    private static final long HORAS_EXTERNOS_RECIENTES = 24;
    // La mesa se desactivó o su zona quedó inactiva: el comandero vuelve a la elección de mesa
    public static final String CODIGO_MESA_NO_DISPONIBLE = "MESA_NO_DISPONIBLE";

    /** Resultado de un envío: el pedido y si se creó ahora (201) o ya existía para esa clave (200). */
    public record ResultadoEnvio(PedidoResponse pedido, boolean creado) {}

    @Transactional
    public PedidoResponse crearComanda(CrearPedidoRequest request, String usernameMozo) {
        return registrarComanda(request, usernameMozo).pedido();
    }

    @Transactional
    public ResultadoEnvio registrarComanda(CrearPedidoRequest request, String usernameMozo) {
        return registrarComanda(request, usernameMozo, false);
    }

    /**
     * Registra y envía a cocina un pedido. Con externo = true lo registra el expedidor o la integración (HU019/HU020):
     * misma ruta y mismos avisos que el comandero, con las reglas de un pedido que no nace en una mesa.
     */
    @Transactional
    public ResultadoEnvio registrarComanda(CrearPedidoRequest request, String usernameMozo, boolean externo) {
        // HU009 Escenarios 2 y 5: lo primero es resolver la clave, antes de cualquier validación,
        // para que un reintento siempre devuelva el pedido ya registrado
        if (request.getClaveIdempotencia() != null) {
            var existente = pedidoRepository.findByClaveIdempotencia(request.getClaveIdempotencia());
            if (existente.isPresent()) {
                validarMismoEnvio(existente.get(), request, usernameMozo);
                return new ResultadoEnvio(convertirADto(existente.get()), false);
            }
        }
        return new ResultadoEnvio(crearComandaNueva(request, usernameMozo, externo), true);
    }

    /** Resuelve una clave tras perder una carrera de inserción (otra transacción ya la registró). */
    @Transactional(readOnly = true)
    public java.util.Optional<PedidoResponse> resolverClaveExistente(CrearPedidoRequest request, String usernameMozo) {
        return pedidoRepository.findByClaveIdempotencia(request.getClaveIdempotencia()).map(p -> {
            validarMismoEnvio(p, request, usernameMozo);
            return convertirADto(p);
        });
    }

    /** HU009 Esc. 2: el comandero consulta si un envío sin confirmación llegó al servidor (solo su autor). */
    @Transactional(readOnly = true)
    public PedidoResponse consultarEnvio(String clave, String usernameMozo) {
        return pedidoRepository.findByClaveIdempotencia(clave)
                .filter(p -> p.getUsuario().getUsername().equals(usernameMozo))
                .map(this::convertirADto)
                .orElseThrow(() -> new RecursoNoEncontradoException("No hay ningún envío registrado con esa clave."));
    }

    private void validarMismoEnvio(Pedido existente, CrearPedidoRequest request, String usernameMozo) {
        boolean mismoAutor = existente.getUsuario().getUsername().equals(usernameMozo);
        if (!mismoAutor || !mismoContenido(existente, request)) {
            throw new OperacionNoPermitidaException("La clave de envío ya fue utilizada para otra comanda.");
        }
    }

    /**
     * HU034: reenvío de un pedido externo ya recibido (mismo canal y número de orden). Bloquea el canal para que
     * reenvíos simultáneos se atiendan de a uno. Si los ítems coinciden devuelve el pedido existente sin crear nada
     * (Esc. 1, 2 y 6); si difieren lo rechaza sin tocar el original (Esc. 4); vacío si es un pedido nuevo.
     */
    @Transactional
    public java.util.Optional<ResultadoEnvio> resolverReenvioExterno(CrearPedidoRequest request) {
        String numero = limpio(request.getNumeroOrdenExterno());
        if (numero == null || request.getCanalId() == null) {
            return java.util.Optional.empty();
        }
        canalRepository.bloquearPorId(request.getCanalId());
        return pedidoRepository.findFirstByCanalIdAndNumeroOrdenExternoOrderByIdAsc(request.getCanalId(), numero)
                .map(existente -> {
                    if (!mismosItems(existente, request)) {
                        throw new OperacionNoPermitidaException("El pedido " + numero + " de " + existente.getCanal().getNombre()
                                + " ya fue recibido como " + existente.getCodigoCorrelativo()
                                + " con otros ítems; el pedido original no se modificó.", CODIGO_PEDIDO_EXTERNO_CONFLICTO);
                    }
                    return new ResultadoEnvio(convertirADto(existente), false);
                });
    }

    private boolean mismoContenido(Pedido existente, CrearPedidoRequest request) {
        Long mesaExistente = existente.getMesa() != null ? existente.getMesa().getId() : null;
        boolean mesaIgual = !CANAL_SALON.equalsIgnoreCase(existente.getCanal().getCodigo())
                || java.util.Objects.equals(mesaExistente, request.getMesaId());
        if (!existente.getCanal().getId().equals(request.getCanalId()) || !mesaIgual) {
            return false;
        }
        boolean esSalon = CANAL_SALON.equalsIgnoreCase(existente.getCanal().getCodigo());
        if (!esSalon && (!java.util.Objects.equals(existente.getClienteNombre(), limpio(request.getClienteNombre()))
                || !java.util.Objects.equals(existente.getClienteTelefono(), limpio(request.getClienteTelefono())))) {
            return false;
        }
        return mismosItems(existente, request);
    }

    // Mismos platos, cantidades y modificadores sin importar el orden de las líneas (idempotencia y HU034)
    private static boolean mismosItems(Pedido existente, CrearPedidoRequest request) {
        List<String> guardados = existente.getItems().stream()
                .map(i -> i.getPlato().getId() + "|" + i.getCantidad() + "|" + claveModificadores(i.getModificadores()))
                .sorted().toList();
        List<String> recibidos = request.getItems() == null ? List.of() : request.getItems().stream()
                .map(i -> i.getPlatoId() + "|" + i.getCantidad() + "|" + claveModificadores(i.getModificadores()))
                .sorted().toList();
        return guardados.equals(recibidos);
    }

    // La idempotencia compara modificadores sin importar mayúsculas, espacios ni orden: lo guardado ya viene
    // con el nombre del catálogo y el reintento llega tal como lo envió el comandero
    private static String claveModificadores(String texto) {
        return separarModificadores(texto).stream()
                .map(m -> m.toLowerCase(Locale.ROOT))
                .distinct().sorted()
                .collect(Collectors.joining(","));
    }

    private static List<String> separarModificadores(String texto) {
        if (texto == null) {
            return List.of();
        }
        return Arrays.stream(texto.split(",")).map(String::trim).filter(s -> !s.isEmpty()).toList();
    }

    // HU008: un plato sin catálogo solo admite cantidad (Esc. 2); los modificadores pedidos deben existir en el
    // catálogo del plato (Esc. 1 y 4). Se devuelven con el nombre canónico del catálogo, sin repetidos, o null si no hay.
    private static String validarModificadores(Plato plato, String solicitados) {
        List<String> pedidos = separarModificadores(solicitados);
        if (pedidos.isEmpty()) {
            return null;
        }
        List<String> catalogo = plato.getModificadores();
        if (catalogo.isEmpty()) {
            throw new IllegalArgumentException("El plato '" + plato.getNombre()
                    + "' no admite modificadores: solo se puede indicar la cantidad.");
        }
        List<String> canonicos = new ArrayList<>();
        for (String pedido : pedidos) {
            String canonico = catalogo.stream().filter(c -> c.equalsIgnoreCase(pedido)).findFirst()
                    .orElseThrow(() -> new IllegalArgumentException("El modificador '" + pedido
                            + "' no está disponible para '" + plato.getNombre() + "'."));
            if (!canonicos.contains(canonico)) {
                canonicos.add(canonico);
            }
        }
        return String.join(", ", canonicos);
    }

    private PedidoResponse crearComandaNueva(CrearPedidoRequest request, String usernameMozo, boolean externo) {
        CanalVenta canal = canalRepository.findById(request.getCanalId())
                .orElseThrow(() -> new IllegalArgumentException("Canal de venta no encontrado con ID: " + request.getCanalId()));

        // HU010 Escenario 4: un canal desactivado por el administrador no admite pedidos nuevos
        if (!Boolean.TRUE.equals(canal.getActivo())) {
            throw new IllegalArgumentException("El canal de venta '" + canal.getNombre() + "' no está activo.");
        }

        // HU019/HU020: un agregador solo recibe pedidos por integración o por el registro manual del expedidor, y
        // Salón nunca es externo porque exige mesa y atención abierta
        if (!externo && Boolean.TRUE.equals(canal.getExterno())) {
            throw new IllegalArgumentException("El canal '" + canal.getNombre()
                    + "' recibe sus pedidos por integración o por el registro manual del expedidor; no se toman desde el comandero.");
        }
        if (externo && CANAL_SALON.equalsIgnoreCase(canal.getCodigo())) {
            throw new IllegalArgumentException("El canal Salón no admite pedidos externos: requiere mesa y atención abierta.");
        }

        // HU006 Escenario 2: Validación de mesa obligatoria en consumo de Salón
        Mesa mesa = null;
        if (CANAL_SALON.equalsIgnoreCase(canal.getCodigo())) {
            if (request.getMesaId() == null) {
                throw new IllegalArgumentException("Para pedidos de Salón es obligatorio seleccionar una mesa.");
            }
            // Bloquea la mesa: si el admin la desactiva al mismo tiempo, uno de los dos espera al otro (HU040/HU041)
            mesa = mesaRepository.bloquearPorId(request.getMesaId())
                    .orElseThrow(() -> new IllegalArgumentException("Mesa no encontrada con ID: " + request.getMesaId()));
            if (!Boolean.TRUE.equals(mesa.getActivo()) || !Boolean.TRUE.equals(mesa.getZona().getActivo())) {
                throw new OperacionNoPermitidaException("La mesa " + mesa.getNumeroMesa() + " no está disponible: fue desactivada o su zona está inactiva.",
                        PedidoService.CODIGO_MESA_NO_DISPONIBLE);
            }
        } else if (request.getMesaId() != null) {
            mesa = mesaRepository.findById(request.getMesaId()).orElse(null);
        }

        Usuario mozo = usuarioRepository.findByUsername(usernameMozo)
                .orElseThrow(() -> new IllegalArgumentException("Usuario mozo no encontrado: " + usernameMozo));

        // HU043 Escenario 3: el mozo solo registra pedidos de salón en mesas de sus zonas asignadas
        AtencionMesa atencion = null;
        if (CANAL_SALON.equalsIgnoreCase(canal.getCodigo())) {
            Long zonaMesa = mesa.getZona().getId();
            boolean asignada = mozo.getZonas().stream().anyMatch(z -> z.getId().equals(zonaMesa));
            if (!asignada) {
                throw new AccessDeniedException("La mesa " + mesa.getNumeroMesa() + " pertenece a la zona '"
                        + mesa.getZona().getNombre() + "', que no tiene asignada.");
            }
            // HU044 / D19: el pedido de salón cuelga de la atención abierta; la mesa ya está bloqueada,
            // así que no puede liberarse mientras se registra
            Mesa mesaPedido = mesa;
            atencion = atencionRepository.findByMesaIdAndLiberadaEnIsNull(mesa.getId())
                    .orElseThrow(() -> new OperacionNoPermitidaException("La mesa " + mesaPedido.getNumeroMesa()
                            + " no está abierta: entre a la mesa e indique las personas antes de tomar el pedido.",
                            CODIGO_MESA_SIN_ATENCION));
        }

        if (request.getItems() == null || request.getItems().isEmpty()) {
            throw new IllegalArgumentException("La comanda debe contener al menos un plato para ser abierta.");
        }

        // HU045 Escenario 4 (D20): para llevar exige nombre y celular peruano (9 dígitos, empieza en 9)
        boolean esSalon = CANAL_SALON.equalsIgnoreCase(canal.getCodigo());
        boolean esParaLlevar = CANAL_PARA_LLEVAR.equalsIgnoreCase(canal.getCodigo());
        boolean esAgregador = Boolean.TRUE.equals(canal.getExterno());
        String clienteNombre = esSalon ? null : limpio(request.getClienteNombre());
        // Un agregador (Rappi) no maneja celular ni dirección del cliente, y Para llevar es recojo en el local, sin
        // dirección: esos datos se descartan aunque lleguen, para no guardar lo que el canal no usa
        String clienteTelefono = esSalon || esAgregador ? null : limpio(request.getClienteTelefono());
        String clienteDireccion = esSalon || esAgregador || esParaLlevar ? null : limpio(request.getClienteDireccion());
        if (esParaLlevar) {
            if (clienteNombre == null) {
                throw new IllegalArgumentException("Para llevar: falta el nombre del cliente.");
            }
            if (clienteTelefono == null || !clienteTelefono.matches(CELULAR_PERU)) {
                throw new IllegalArgumentException("Para llevar: el celular del cliente no es válido (9 dígitos y empieza con 9).");
            }
        }

        // HU020 Esc. 3 y 4: el agregador se identifica por su número de orden; un pedido de WhatsApp o teléfono
        // (Delivery propio) necesita nombre, celular y dirección de entrega. Para llevar ya validó nombre y celular
        String numeroOrdenExterno = null;
        if (externo) {
            numeroOrdenExterno = limpio(request.getNumeroOrdenExterno());
            // HU034 Esc. 5: el mismo número de orden en el mismo canal ya existe (por integración o a mano): se advierte
            // con el código del pedido existente. El canal queda bloqueado para que dos registros simultáneos no pasen ambos
            if (numeroOrdenExterno != null) {
                canalRepository.bloquearPorId(canal.getId());
                String numero = numeroOrdenExterno;
                pedidoRepository.findFirstByCanalIdAndNumeroOrdenExternoOrderByIdAsc(canal.getId(), numero)
                        .ifPresent(existente -> {
                            throw new OperacionNoPermitidaException("El pedido " + numero + " de " + canal.getNombre()
                                    + " ya existe como " + existente.getCodigoCorrelativo() + ".", CODIGO_PEDIDO_EXTERNO_DUPLICADO);
                        });
            }
            if (esAgregador) {
                if (numeroOrdenExterno == null) {
                    throw new IllegalArgumentException("Falta el número de orden de " + canal.getNombre() + ".");
                }
            } else if (!esParaLlevar) {
                if (clienteNombre == null) {
                    throw new IllegalArgumentException("Falta el nombre del cliente.");
                }
                if (clienteTelefono == null || !clienteTelefono.matches(CELULAR_PERU)) {
                    throw new IllegalArgumentException("El celular del cliente no es válido (9 dígitos y empieza con 9).");
                }
                if (clienteDireccion == null) {
                    throw new IllegalArgumentException("Falta la dirección de entrega del cliente.");
                }
            }
        }

        Pedido pedido = new Pedido();
        pedido.setCodigoCorrelativo(generarCodigoCorrelativo());
        pedido.setClaveIdempotencia(request.getClaveIdempotencia());
        pedido.setCanal(canal);
        pedido.setMesa(mesa);
        pedido.setAtencion(atencion);
        pedido.setUsuario(mozo);
        pedido.setClienteNombre(clienteNombre);
        pedido.setClienteTelefono(clienteTelefono);
        pedido.setClienteDireccion(clienteDireccion);
        pedido.setObservaciones(request.getObservaciones());
        pedido.setNumeroOrdenExterno(numeroOrdenExterno);
        pedido.setRegistroExterno(externo);
        // HU021 Esc. 4: una comanda posterior en la misma atención es una adición. La mesa está bloqueada, así que
        // dos envíos simultáneos a la misma mesa no pueden tomar el mismo número
        pedido.setNumeroAdicion(atencion != null ? (int) pedidoRepository.countByAtencionId(atencion.getId()) : 0);
        pedido.setEstado(EstadoPedido.ENVIADO);
        pedido.setFechaEnvioCocina(LocalDateTime.now());

        BigDecimal totalAcumulado = BigDecimal.ZERO;

        for (ItemPedidoRequest itemReq : request.getItems()) {
            Plato plato = platoRepository.findById(itemReq.getPlatoId())
                    .orElseThrow(() -> new IllegalArgumentException("Plato no encontrado con ID: " + itemReq.getPlatoId()));
            // HU009 Escenario 6: un plato agotado después de agregarse a la comanda impide el envío
            if (!Boolean.TRUE.equals(plato.getActivo())) {
                throw new IllegalArgumentException("El plato '" + plato.getNombre() + "' ya no está en la carta. Retírelo de la comanda.");
            }
            if (!Boolean.TRUE.equals(plato.getDisponible())) {
                throw new IllegalArgumentException("El plato '" + plato.getNombre() + "' está agotado. Retírelo de la comanda.");
            }

            // HU011 Escenario 6: un plato sin estación activa no puede enrutarse
            if (plato.getEstacion() == null || !Boolean.TRUE.equals(plato.getEstacion().getActivo())) {
                throw new IllegalArgumentException("El plato '" + plato.getNombre() + "' no tiene una estación de cocina activa.");
            }

            DetallePedido detalle = new DetallePedido();
            detalle.setPlato(plato);
            // HU011 Escenario 5: la estación se fija al pedir; reasignar el plato después no mueve este ítem
            detalle.setEstacion(plato.getEstacion());
            detalle.setCantidad(itemReq.getCantidad());
            detalle.setPrecioUnitario(plato.getPrecio());
            BigDecimal subtotal = plato.getPrecio().multiply(BigDecimal.valueOf(itemReq.getCantidad()));
            detalle.setSubtotal(subtotal);
            detalle.setModificadores(validarModificadores(plato, itemReq.getModificadores()));
            detalle.setTiempoEstandarMinutos(plato.getTiempoEstandarMinutos());
            // HU013 Escenario 3: todo ítem de un pedido recién registrado queda en RECIBIDO
            detalle.setEstadoItem(EstadoItem.RECIBIDO);

            pedido.addItem(detalle);
            totalAcumulado = totalAcumulado.add(subtotal);
        }

        pedido.setTotal(totalAcumulado);
        // saveAndFlush: una clave de idempotencia duplicada en paralelo falla aquí (restricción UNIQUE)
        Pedido pedidoGuardado = pedidoRepository.saveAndFlush(pedido);

        // Registro de auditoría inicial del pedido y de cada ítem
        trazabilidadService.registrarPedido(pedidoGuardado, null, EstadoPedido.ENVIADO.name(), mozo,
                externo ? "Pedido externo registrado (" + canal.getNombre() + ")" : "Apertura de comanda");
        for (DetallePedido item : pedidoGuardado.getItems()) {
            trazabilidadService.registrarItem(item, null, EstadoItem.RECIBIDO.name(), mozo, null);
        }

        PedidoResponse response = convertirADto(pedidoGuardado);

        // HU011: cada ítem viaja solo al tópico de su estación; se publica tras el commit
        List<ItemCocinaDto> itemsCocina = pedidoGuardado.getItems().stream().map(ItemCocinaMapper::aDto).toList();
        eventPublisher.publishEvent(new NotificadorKds.ItemsKdsEvent(NotificadorKds.TipoEvento.ITEM_NUEVO, itemsCocina));
        eventPublisher.publishEvent(new NotificadorKds.PedidoKdsEvent(NotificadorKds.TipoEventoPedido.PEDIDO_NUEVO,
                pedidoGuardado.getId(), pedidoGuardado.getCodigoCorrelativo(), pedidoGuardado.getEstado().name()));

        return response;
    }

    @Transactional(readOnly = true)
    public PedidoResponse obtenerPorId(Long id) {
        Pedido pedido = pedidoRepository.findById(id)
                .orElseThrow(() -> new RecursoNoEncontradoException("Pedido no encontrado con ID: " + id));
        return convertirADto(pedido);
    }

    /**
     * HU043: un mozo solo consulta sus propios pedidos y los de mesas de sus zonas; uno ajeno se informa
     * como inexistente para no revelarlo. El resto del personal consulta cualquiera.
     */
    @Transactional(readOnly = true)
    public PedidoResponse obtenerPorId(Long id, String username, boolean esMozo) {
        Pedido pedido = pedidoRepository.findById(id)
                .filter(p -> !esMozo || visibleParaMozo(p, mozoPorUsername(username)))
                .orElseThrow(() -> new RecursoNoEncontradoException("Pedido no encontrado con ID: " + id));
        return convertirADto(pedido);
    }

    @Transactional(readOnly = true)
    public List<PedidoResponse> listarPedidosActivos() {
        return listarPedidosActivos(null, false);
    }

    @Transactional(readOnly = true)
    public List<PedidoResponse> listarPedidosActivos(String username, boolean esMozo) {
        Usuario mozo = esMozo ? mozoPorUsername(username) : null;
        return pedidoRepository.findByEstadoInOrderByCreatedAtAsc(List.of(EstadoPedido.ENVIADO, EstadoPedido.EN_PREPARACION, EstadoPedido.LISTO))
                .stream()
                .filter(p -> mozo == null || visibleParaMozo(p, mozo))
                .map(this::convertirADto).collect(Collectors.toList());
    }

    /**
     * Pedidos registrados por el expedidor o la integración en las últimas 24 horas, del más nuevo al más antiguo.
     * Sirven para consultarlos y anular un ítem desde "Registrar pedido externo" (D32).
     */
    @Transactional(readOnly = true)
    public List<PedidoResponse> listarExternosRecientes() {
        return pedidoRepository
                .findByRegistroExternoTrueAndCreatedAtGreaterThanEqualOrderByCreatedAtDesc(
                        LocalDateTime.now().minusHours(HORAS_EXTERNOS_RECIENTES))
                .stream().map(this::convertirADto).collect(Collectors.toList());
    }

    private Usuario mozoPorUsername(String username) {
        return usuarioRepository.findByUsername(username)
                .orElseThrow(() -> new IllegalArgumentException("Usuario mozo no encontrado: " + username));
    }

    // Compartido con la anulación de ítems (HU032): el mozo solo opera sus pedidos y los de sus zonas
    static boolean visibleParaMozo(Pedido pedido, Usuario mozo) {
        if (pedido.getUsuario() != null && pedido.getUsuario().getId().equals(mozo.getId())) {
            return true;
        }
        return pedido.getMesa() != null && mozo.getZonas().stream()
                .anyMatch(z -> z.getId().equals(pedido.getMesa().getZona().getId()));
    }

    @Transactional(readOnly = true)
    public String obtenerSiguienteCorrelativoSugerido() {
        // En transacciones de solo lectura no se consume la secuencia nativa para evitar avances espurios
        LocalDateTime inicioDia = LocalDate.now().atStartOfDay();
        long sugerido = pedidoRepository.countPedidosDesde(inicioDia) + 1;
        String fechaStr = LocalDate.now().format(DateTimeFormatter.ofPattern("yyMMdd"));
        String candidato = String.format("CMD-%s-%04d", fechaStr, sugerido);
        while (pedidoRepository.findByCodigoCorrelativo(candidato).isPresent()) {
            sugerido++;
            candidato = String.format("CMD-%s-%04d", fechaStr, sugerido);
        }
        return candidato;
    }

    private synchronized String generarCodigoCorrelativo() {
        // Concurrencia atómica: se consulta la secuencia nativa de PostgreSQL para evitar colisiones
        // bajo ráfagas concurrentes de pedidos en hora punta. Si la secuencia no responde (ej. en mocks unitarios),
        // se recurre al conteo de pedidos del día como fallback resiliente.
        Long seqVal = null;
        try {
            seqVal = pedidoRepository.obtenerSiguienteValorSecuencia();
        } catch (Exception e) {
            // Ignorar para activar fallback
        }
        if (seqVal == null || seqVal <= 0L) {
            LocalDateTime inicioDia = LocalDate.now().atStartOfDay();
            seqVal = pedidoRepository.countPedidosDesde(inicioDia) + 1;
        }
        String fechaStr = LocalDate.now().format(DateTimeFormatter.ofPattern("yyMMdd"));
        String candidato = String.format("CMD-%s-%04d", fechaStr, seqVal);
        // Garantizar unicidad absoluta ante cualquier colisión histórica
        while (pedidoRepository.findByCodigoCorrelativo(candidato).isPresent()) {
            seqVal++;
            candidato = String.format("CMD-%s-%04d", fechaStr, seqVal);
        }
        return candidato;
    }

    // Texto opcional: vacío o en blanco se guarda como nulo; si no, sin espacios al borde
    private static String limpio(String texto) {
        return texto == null || texto.isBlank() ? null : texto.trim();
    }

    // Pedidos de una atención de mesa en orden de envío (HU044 Escenario 4)
    @Transactional(readOnly = true)
    public List<PedidoResponse> pedidosDeAtencion(Long atencionId) {
        return pedidoRepository.findByAtencionIdOrderByCreatedAtAsc(atencionId).stream()
                .map(this::convertirADto)
                .collect(Collectors.toList());
    }

    private PedidoResponse convertirADto(Pedido pedido) {
        PedidoResponse dto = new PedidoResponse();
        dto.setId(pedido.getId());
        dto.setCodigoCorrelativo(pedido.getCodigoCorrelativo());
        dto.setCanalId(pedido.getCanal().getId());
        dto.setCanalCodigo(pedido.getCanal().getCodigo());
        dto.setCanalNombre(pedido.getCanal().getNombre());
        dto.setCanalSlaMinutos(pedido.getCanal().getSlaObjetivoMinutos());
        if (pedido.getMesa() != null) {
            dto.setMesaId(pedido.getMesa().getId());
            dto.setMesaNumero(pedido.getMesa().getNumeroMesa());
        }
        dto.setUsuarioNombre(pedido.getUsuario().getNombreCompleto());
        dto.setClienteNombre(pedido.getClienteNombre());
        dto.setClienteTelefono(pedido.getClienteTelefono());
        dto.setEstado(pedido.getEstado().name());
        dto.setTotal(pedido.getTotal());
        dto.setObservaciones(pedido.getObservaciones());
        dto.setNumeroOrdenExterno(pedido.getNumeroOrdenExterno());
        dto.setCreatedAt(pedido.getCreatedAt());
        dto.setFechaEnvioCocina(pedido.getFechaEnvioCocina());

        if (pedido.getItems() != null) {
            dto.setItems(pedido.getItems().stream().map(item -> {
                PedidoResponse.DetalleItemResponse itemDto = new PedidoResponse.DetalleItemResponse();
                itemDto.setId(item.getId());
                itemDto.setPlatoId(item.getPlato().getId());
                itemDto.setPlatoNombre(item.getPlato().getNombre());
                itemDto.setEstacionId(item.getEstacion().getId());
                itemDto.setEstacionNombre(item.getEstacion().getNombre());
                itemDto.setCantidad(item.getCantidad());
                itemDto.setPrecioUnitario(item.getPrecioUnitario());
                itemDto.setSubtotal(item.getSubtotal());
                itemDto.setModificadores(item.getModificadores());
                itemDto.setTiempoEstandarMinutos(item.getTiempoEstandarMinutos());
                itemDto.setEstadoItem(item.getEstadoItem().name());
                return itemDto;
            }).collect(Collectors.toList()));
        }

        return dto;
    }
}
