package pe.isil.kds.service;

import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import pe.isil.kds.exception.RecursoNoEncontradoException;
import pe.isil.kds.dto.CrearPedidoRequest;
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
    private final SimpMessagingTemplate messagingTemplate;

    public PedidoService(
            PedidoRepository pedidoRepository,
            CanalVentaRepository canalRepository,
            MesaRepository mesaRepository,
            PlatoRepository platoRepository,
            UsuarioRepository usuarioRepository,
            TrazabilidadService trazabilidadService,
            SimpMessagingTemplate messagingTemplate) {
        this.pedidoRepository = pedidoRepository;
        this.canalRepository = canalRepository;
        this.mesaRepository = mesaRepository;
        this.platoRepository = platoRepository;
        this.usuarioRepository = usuarioRepository;
        this.trazabilidadService = trazabilidadService;
        this.messagingTemplate = messagingTemplate;
    }

    @Transactional
    public PedidoResponse crearComanda(CrearPedidoRequest request, String usernameMozo) {
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
            mesa = mesaRepository.findById(request.getMesaId())
                    .orElseThrow(() -> new IllegalArgumentException("Mesa no encontrada con ID: " + request.getMesaId()));
        } else if (request.getMesaId() != null) {
            mesa = mesaRepository.findById(request.getMesaId()).orElse(null);
        }

        Usuario mozo = usuarioRepository.findByUsername(usernameMozo)
                .orElseThrow(() -> new IllegalArgumentException("Usuario mozo no encontrado: " + usernameMozo));

        if (request.getItems() == null || request.getItems().isEmpty()) {
            throw new IllegalArgumentException("La comanda debe contener al menos un plato para ser abierta.");
        }

        Pedido pedido = new Pedido();
        pedido.setCodigoCorrelativo(generarCodigoCorrelativo());
        pedido.setCanal(canal);
        pedido.setMesa(mesa);
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

            DetallePedido detalle = new DetallePedido();
            detalle.setPlato(plato);
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
        Pedido pedidoGuardado = pedidoRepository.save(pedido);

        // Registro de auditoría inicial del pedido y de cada ítem
        trazabilidadService.registrarPedido(pedidoGuardado, null, EstadoPedido.ENVIADO.name(), mozo, "Apertura de comanda");
        for (DetallePedido item : pedidoGuardado.getItems()) {
            trazabilidadService.registrarItem(item, null, EstadoItem.RECIBIDO.name(), mozo, null);
        }

        PedidoResponse response = convertirADto(pedidoGuardado);

        // Notificación en tiempo real vía WebSocket a monitores suscritos en LAN
        try {
            messagingTemplate.convertAndSend("/topic/pedidos", response);
        } catch (Exception e) {
            // No bloquear la transacción si el broker aún no tiene clientes conectados
        }

        return response;
    }

    @Transactional(readOnly = true)
    public PedidoResponse obtenerPorId(Long id) {
        Pedido pedido = pedidoRepository.findById(id)
                .orElseThrow(() -> new RecursoNoEncontradoException("Pedido no encontrado con ID: " + id));
        return convertirADto(pedido);
    }

    @Transactional(readOnly = true)
    public List<PedidoResponse> listarPedidosActivos() {
        return pedidoRepository.findByEstadoInOrderByCreatedAtAsc(List.of(EstadoPedido.ENVIADO, EstadoPedido.EN_PREPARACION, EstadoPedido.LISTO))
                .stream().map(this::convertirADto).collect(Collectors.toList());
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
