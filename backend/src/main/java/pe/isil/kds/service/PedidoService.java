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
import java.util.List;
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
 * - Normaliza los modificadores de cada ítem: sin espacios sobrantes y nulos si vienen vacíos (HU008).
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
        // HU009 Escenarios 2 y 5: lo primero es resolver la clave, antes de cualquier validación,
        // para que un reintento siempre devuelva el pedido ya registrado
        if (request.getClaveIdempotencia() != null) {
            var existente = pedidoRepository.findByClaveIdempotencia(request.getClaveIdempotencia());
            if (existente.isPresent()) {
                validarMismoEnvio(existente.get(), request, usernameMozo);
                return new ResultadoEnvio(convertirADto(existente.get()), false);
            }
        }
        return new ResultadoEnvio(crearComandaNueva(request, usernameMozo), true);
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

    private boolean mismoContenido(Pedido existente, CrearPedidoRequest request) {
        Long mesaExistente = existente.getMesa() != null ? existente.getMesa().getId() : null;
        boolean mesaIgual = !"SALON".equalsIgnoreCase(existente.getCanal().getCodigo())
                || java.util.Objects.equals(mesaExistente, request.getMesaId());
        if (!existente.getCanal().getId().equals(request.getCanalId()) || !mesaIgual) {
            return false;
        }
        List<String> guardados = existente.getItems().stream()
                .map(i -> i.getPlato().getId() + "|" + i.getCantidad() + "|" + java.util.Objects.toString(i.getModificadores(), ""))
                .sorted().toList();
        List<String> recibidos = request.getItems() == null ? List.of() : request.getItems().stream()
                .map(i -> i.getPlatoId() + "|" + i.getCantidad() + "|" + java.util.Objects.toString(normalizarModificadores(i.getModificadores()), ""))
                .sorted().toList();
        return guardados.equals(recibidos);
    }

    private PedidoResponse crearComandaNueva(CrearPedidoRequest request, String usernameMozo) {
        CanalVenta canal = canalRepository.findById(request.getCanalId())
                .orElseThrow(() -> new IllegalArgumentException("Canal de venta no encontrado con ID: " + request.getCanalId()));

        // HU010 Escenario 4: un canal desactivado por el administrador no admite pedidos nuevos
        if (!Boolean.TRUE.equals(canal.getActivo())) {
            throw new IllegalArgumentException("El canal de venta '" + canal.getNombre() + "' no está activo.");
        }

        // HU006 Escenario 2: Validación de mesa obligatoria en consumo de Salón
        Mesa mesa = null;
        if ("SALON".equalsIgnoreCase(canal.getCodigo())) {
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
        if ("SALON".equalsIgnoreCase(canal.getCodigo())) {
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

        Pedido pedido = new Pedido();
        pedido.setCodigoCorrelativo(generarCodigoCorrelativo());
        pedido.setClaveIdempotencia(request.getClaveIdempotencia());
        pedido.setCanal(canal);
        pedido.setMesa(mesa);
        pedido.setAtencion(atencion);
        pedido.setUsuario(mozo);
        pedido.setClienteNombre(request.getClienteNombre());
        pedido.setClienteTelefono(request.getClienteTelefono());
        pedido.setClienteDireccion(request.getClienteDireccion());
        pedido.setObservaciones(request.getObservaciones());
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
            detalle.setModificadores(normalizarModificadores(itemReq.getModificadores()));
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
        trazabilidadService.registrarPedido(pedidoGuardado, null, EstadoPedido.ENVIADO.name(), mozo, "Apertura de comanda");
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

    private Usuario mozoPorUsername(String username) {
        return usuarioRepository.findByUsername(username)
                .orElseThrow(() -> new IllegalArgumentException("Usuario mozo no encontrado: " + username));
    }

    private static boolean visibleParaMozo(Pedido pedido, Usuario mozo) {
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

    private String normalizarModificadores(String modificadores) {
        if (modificadores == null || modificadores.isBlank()) {
            return null;
        }
        return modificadores.trim();
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
        dto.setUsuarioNombre(pedido.getUsuario().getNombre() + " " + pedido.getUsuario().getApellido());
        dto.setClienteNombre(pedido.getClienteNombre());
        dto.setClienteTelefono(pedido.getClienteTelefono());
        dto.setEstado(pedido.getEstado().name());
        dto.setTotal(pedido.getTotal());
        dto.setObservaciones(pedido.getObservaciones());
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
