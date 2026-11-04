package pe.isil.kds.service;

import org.springframework.context.ApplicationEventPublisher;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import pe.isil.kds.exception.RecursoNoEncontradoException;
import pe.isil.kds.dto.CambiarEstadoItemRequest;
import pe.isil.kds.dto.ItemCocinaDto;
import pe.isil.kds.exception.EstadoDesactualizadoException;
import pe.isil.kds.exception.OperacionNoPermitidaException;
import pe.isil.kds.model.DetallePedido;
import pe.isil.kds.model.EstadoItem;
import pe.isil.kds.model.EstadoPedido;
import pe.isil.kds.model.Pedido;
import pe.isil.kds.model.Usuario;
import pe.isil.kds.repository.DetallePedidoRepository;
import pe.isil.kds.repository.PedidoRepository;
import pe.isil.kds.repository.UsuarioRepository;
import pe.isil.kds.security.SesionKds;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Objects;
import java.util.Optional;

/**
 * Servicio del ciclo de vida de los ítems (HU013).
 *
 * Reglas implementadas:
 * - Solo se aplican las transiciones del flujo definido en EstadoItem (Esc. 1, 2, 4 y 5).
 * - El cliente envía el estado que ve; si el servidor ya tiene otro, responde 409 con el
 *   estado vigente (Esc. 6). @Version cubre la carrera entre dos transacciones simultáneas.
 * - Roles (decisión D8): cocinero inicia y marca listo solo en su estación; expedidor y
 *   admin despachan. La anulación tiene su propio flujo con motivo (HU032).
 * - Un ítem En espera cuya hora de disparo no llegó solo se inicia con confirmación (HU014 Esc. 3).
 * - El estado del pedido se recalcula a partir de sus ítems y cada cambio queda registrado.
 *   El pedido se bloquea (FOR UPDATE) para que cambios simultáneos en ítems distintos
 *   no deriven su estado a partir de una lectura desactualizada.
 */
@Service
public class CicloVidaItemService {

    private static final DateTimeFormatter HORA = DateTimeFormatter.ofPattern("HH:mm");

    private final DetallePedidoRepository detalleRepository;
    private final PedidoRepository pedidoRepository;
    private final UsuarioRepository usuarioRepository;
    private final TrazabilidadService trazabilidadService;
    private final ApplicationEventPublisher eventPublisher;

    public CicloVidaItemService(
            DetallePedidoRepository detalleRepository,
            PedidoRepository pedidoRepository,
            UsuarioRepository usuarioRepository,
            TrazabilidadService trazabilidadService,
            ApplicationEventPublisher eventPublisher) {
        this.detalleRepository = detalleRepository;
        this.pedidoRepository = pedidoRepository;
        this.usuarioRepository = usuarioRepository;
        this.trazabilidadService = trazabilidadService;
        this.eventPublisher = eventPublisher;
    }

    @Transactional
    public ItemCocinaDto cambiarEstado(Long itemId, CambiarEstadoItemRequest request, SesionKds sesion) {
        Long pedidoId = detalleRepository.findPedidoIdById(itemId)
                .orElseThrow(() -> new RecursoNoEncontradoException("Ítem no encontrado con ID: " + itemId));
        // Bloquear el pedido antes de leer sus ítems: la lectura posterior ya es la vigente
        pedidoRepository.bloquearPorId(pedidoId);
        DetallePedido item = detalleRepository.findById(itemId)
                .orElseThrow(() -> new RecursoNoEncontradoException("Ítem no encontrado con ID: " + itemId));

        EstadoItem origen = item.getEstadoItem();
        EstadoItem destino = request.getEstadoDestino();

        // El permiso se valida primero para no revelar el estado a quien no puede operar el ítem
        validarPermiso(item, destino, sesion);
        if (origen != request.getEstadoActual()) {
            throw new EstadoDesactualizadoException(ItemCocinaMapper.aDto(item));
        }
        if (destino == EstadoItem.ANULADO) {
            throw new OperacionNoPermitidaException("La anulación de un ítem requiere un motivo y se realiza desde la opción Anular.");
        }
        if (origen.esFinal()) {
            throw new OperacionNoPermitidaException("El ítem está " + origen + " y ya no admite cambios de estado.");
        }
        if (!origen.puedeTransicionarA(destino)) {
            throw new OperacionNoPermitidaException("Transición no permitida: " + origen + " → " + destino + ".");
        }
        // HU014 Esc. 3: adelantar un ítem retenido exige confirmación explícita del cocinero.
        // Sin hora de disparo (retención manual) no hay nada que adelantar.
        boolean anticipado = origen == EstadoItem.EN_ESPERA && item.getHoraDisparo() != null
                && item.getHoraDisparo().isAfter(LocalDateTime.now());
        if (anticipado && !request.isInicioAnticipado()) {
            throw new OperacionNoPermitidaException("El ítem está en espera hasta las "
                    + item.getHoraDisparo().format(HORA) + ". Confirme el inicio anticipado.",
                    OperacionNoPermitidaException.INICIO_ANTICIPADO_REQUERIDO);
        }
        // El historial distingue el adelanto confirmado de un inicio normal
        String motivo = anticipado ? "Inicio anticipado (disparo " + item.getHoraDisparo().format(HORA) + ")" : null;

        Usuario usuario = usuarioRepository.findByUsername(sesion.username()).orElse(null);

        item.setEstadoItem(destino);
        detalleRepository.saveAndFlush(item);
        trazabilidadService.registrarItem(item, origen.name(), destino.name(), usuario, motivo);
        Optional<NotificadorKds.PedidoKdsEvent> cambioPedido = actualizarEstadoPedido(item.getPedido(), usuario);

        // Orden fijo de notificación: primero el ítem que cambió y luego el pedido que derivó de él
        ItemCocinaDto dto = ItemCocinaMapper.aDto(item);
        eventPublisher.publishEvent(new NotificadorKds.ItemsKdsEvent(NotificadorKds.TipoEvento.ITEM_ACTUALIZADO, List.of(dto)));
        cambioPedido.ifPresent(eventPublisher::publishEvent);
        return dto;
    }

    @Transactional(readOnly = true)
    public ItemCocinaDto obtenerItem(Long itemId) {
        return detalleRepository.findById(itemId)
                .map(ItemCocinaMapper::aDto)
                .orElseThrow(() -> new RecursoNoEncontradoException("Ítem no encontrado con ID: " + itemId));
    }

    private void validarPermiso(DetallePedido item, EstadoItem destino, SesionKds sesion) {
        if (sesion.tieneRol("ADMIN")) {
            return;
        }
        if (destino == EstadoItem.DESPACHADO) {
            if (!sesion.tieneRol("EXPEDIDOR")) {
                throw new AccessDeniedException("Solo el expedidor puede despachar ítems.");
            }
            return;
        }
        if (!sesion.tieneRol("COCINERO")) {
            throw new AccessDeniedException("Solo el personal de cocina puede cambiar el estado de preparación.");
        }
        if (sesion.estacionId() == null) {
            throw new AccessDeniedException("Esta terminal no está vinculada a una estación de cocina.");
        }
        if (!Objects.equals(sesion.estacionId(), item.getEstacion().getId())) {
            throw new AccessDeniedException("El ítem pertenece a la estación " + item.getEstacion().getNombre() + ".");
        }
    }

    /** Recalcula el estado agregado del pedido; si cambia, registra la transición y devuelve el evento a notificar. */
    Optional<NotificadorKds.PedidoKdsEvent> actualizarEstadoPedido(Pedido pedido, Usuario usuario) {
        EstadoPedido anterior = pedido.getEstado();
        EstadoPedido nuevo = EstadoPedido.derivar(pedido.getItems().stream().map(DetallePedido::getEstadoItem).toList());
        if (nuevo == anterior) {
            return Optional.empty();
        }
        pedido.setEstado(nuevo);
        if (nuevo == EstadoPedido.DESPACHADO) {
            pedido.setFechaDespacho(LocalDateTime.now());
        }
        trazabilidadService.registrarPedido(pedido, anterior != null ? anterior.name() : null, nuevo.name(), usuario, null);
        return Optional.of(new NotificadorKds.PedidoKdsEvent(NotificadorKds.TipoEventoPedido.PEDIDO_ACTUALIZADO,
                pedido.getId(), pedido.getCodigoCorrelativo(), nuevo.name()));
    }
}
