package pe.isil.kds.service;

import org.springframework.context.ApplicationEventPublisher;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import pe.isil.kds.dto.AnularItemRequest;
import pe.isil.kds.dto.ItemCocinaDto;
import pe.isil.kds.dto.MotivoAnulacionDto;
import pe.isil.kds.exception.AutorizacionAdminException;
import pe.isil.kds.exception.EstadoDesactualizadoException;
import pe.isil.kds.exception.OperacionNoPermitidaException;
import pe.isil.kds.exception.RecursoNoEncontradoException;
import pe.isil.kds.model.DetallePedido;
import pe.isil.kds.model.EstadoItem;
import pe.isil.kds.model.Merma;
import pe.isil.kds.model.MotivoAnulacion;
import pe.isil.kds.model.Pedido;
import pe.isil.kds.model.Usuario;
import pe.isil.kds.repository.DetallePedidoRepository;
import pe.isil.kds.repository.MermaRepository;
import pe.isil.kds.repository.PedidoRepository;
import pe.isil.kds.repository.UsuarioRepository;
import pe.isil.kds.security.SesionKds;

import java.math.BigDecimal;
import java.time.Duration;
import java.time.Instant;
import java.util.Arrays;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Anulación de ítems enviados con motivo (HU032, decisiones D8, D10 y D12).
 *
 * Reglas implementadas:
 * - Anulan el mozo (sus pedidos y los de sus zonas, HU043), el administrador (D8) y el expedidor, este último
 *   solo en los pedidos que él o la integración registraron como externos (D32); los del comandero no los ve.
 * - El motivo es obligatorio y sale de una lista fija (Esc. 3).
 * - Un ítem despachado o ya anulado no se anula (Esc. 4). Anular es posible desde Recibido, En espera,
 *   En preparación y Listo.
 * - Si el ítem ya estaba En preparación o Listo se registra una merma consultable; si aún no se iniciaba,
 *   solo se retira de la estación (Esc. 1 y 2).
 * - El cliente envía el estado que ve: si cambió (por ejemplo, cocina lo inició mientras el mozo decidía)
 *   se responde 409, porque de ese estado depende si hay merma.
 * - El pedido se bloquea (FOR UPDATE) igual que en el ciclo de vida, para que anulaciones o cambios de
 *   estado simultáneos no deriven el estado del pedido de una lectura vieja. Al anular el último ítem
 *   vigente el pedido queda ANULADO y sale de las colas (Esc. 6); su total deja de contar lo anulado.
 * - Cada anulación queda en el historial con su motivo y avisa por WebSocket a la estación (Esc. 5).
 * - D36: el motivo debe corresponder al estado (pendiente o iniciado). Un ítem pendiente lo anula el mozo o el
 *   expedidor por su cuenta; uno ya iniciado (En preparación o Listo) exige el usuario y la clave de autorización
 *   (PIN de 6 dígitos, distinto de su contraseña) de un administrador activo, salvo que quien anula ya sea
 *   administrador. Tras 5 intentos fallidos en 5 minutos se
 *   bloquea la autorización de ese usuario durante 5 minutos, para frenar el adivinado de la contraseña.
 */
@Service
public class AnulacionItemService {

    private final DetallePedidoRepository detalleRepository;
    private final PedidoRepository pedidoRepository;
    private final UsuarioRepository usuarioRepository;
    private final MermaRepository mermaRepository;
    private final TrazabilidadService trazabilidadService;
    private final CicloVidaItemService cicloVidaItemService;
    private final ApplicationEventPublisher eventPublisher;
    private final PasswordEncoder passwordEncoder;

    // D36: intentos fallidos de autorización por usuario que anula. En memoria: el KDS corre en un único servidor
    // local y reiniciarlo solo vuelve a dar los intentos disponibles
    static final int INTENTOS_MAXIMOS = 5;
    static final Duration VENTANA_INTENTOS = Duration.ofMinutes(5);
    private final ConcurrentHashMap<String, IntentosFallidos> intentosFallidos = new ConcurrentHashMap<>();

    private record IntentosFallidos(int cantidad, Instant desde) {}

    public AnulacionItemService(
            DetallePedidoRepository detalleRepository,
            PedidoRepository pedidoRepository,
            UsuarioRepository usuarioRepository,
            MermaRepository mermaRepository,
            TrazabilidadService trazabilidadService,
            CicloVidaItemService cicloVidaItemService,
            ApplicationEventPublisher eventPublisher,
            PasswordEncoder passwordEncoder) {
        this.detalleRepository = detalleRepository;
        this.pedidoRepository = pedidoRepository;
        this.usuarioRepository = usuarioRepository;
        this.mermaRepository = mermaRepository;
        this.trazabilidadService = trazabilidadService;
        this.cicloVidaItemService = cicloVidaItemService;
        this.eventPublisher = eventPublisher;
        this.passwordEncoder = passwordEncoder;
    }

    public List<MotivoAnulacionDto> motivos() {
        return Arrays.stream(MotivoAnulacion.values())
                .map(m -> new MotivoAnulacionDto(m.name(), m.etiqueta()))
                .toList();
    }

    /** D36: motivos que tienen sentido para un ítem en ese estado (pendiente o ya iniciado). */
    public List<MotivoAnulacionDto> motivos(EstadoItem estado) {
        return MotivoAnulacion.para(estado).stream()
                .map(m -> new MotivoAnulacionDto(m.name(), m.etiqueta()))
                .toList();
    }

    @Transactional
    public ItemCocinaDto anular(Long itemId, AnularItemRequest request, SesionKds sesion) {
        if (!sesion.tieneRol("MOZO", "EXPEDIDOR", "ADMIN")) {
            throw new AccessDeniedException("Solo el mozo, el expedidor o el administrador pueden anular ítems.");
        }
        Long pedidoId = detalleRepository.findPedidoIdById(itemId)
                .orElseThrow(() -> new RecursoNoEncontradoException("Ítem no encontrado con ID: " + itemId));
        // Bloquear el pedido antes de leer sus ítems: la lectura posterior ya es la vigente
        pedidoRepository.bloquearPorId(pedidoId);
        DetallePedido item = detalleRepository.findById(itemId)
                .orElseThrow(() -> new RecursoNoEncontradoException("Ítem no encontrado con ID: " + itemId));
        Pedido pedido = item.getPedido();

        Usuario usuario = usuarioRepository.findByUsername(sesion.username())
                .orElseThrow(() -> new IllegalArgumentException("Usuario no encontrado: " + sesion.username()));
        // Un ítem ajeno al mozo se informa como inexistente para no revelarlo
        if (sesion.tieneRol("MOZO") && !PedidoService.visibleParaMozo(pedido, usuario)) {
            throw new RecursoNoEncontradoException("Ítem no encontrado con ID: " + itemId);
        }
        // El expedidor solo opera los pedidos externos; un pedido del comandero se informa como inexistente
        if (sesion.tieneRol("EXPEDIDOR") && !Boolean.TRUE.equals(pedido.getRegistroExterno())) {
            throw new RecursoNoEncontradoException("Ítem no encontrado con ID: " + itemId);
        }

        EstadoItem origen = item.getEstadoItem();
        if (origen != request.getEstadoActual()) {
            throw new EstadoDesactualizadoException(ItemCocinaMapper.aDto(item));
        }
        if (origen == EstadoItem.DESPACHADO) {
            throw new OperacionNoPermitidaException("El ítem ya fue despachado y no se puede anular.");
        }
        if (origen == EstadoItem.ANULADO) {
            throw new OperacionNoPermitidaException("El ítem ya está anulado.");
        }

        MotivoAnulacion motivo = request.getMotivo();
        boolean generaMerma = MotivoAnulacion.esIniciado(origen);
        // D36: el motivo debe tener sentido para el estado (por ejemplo, "Plato con defecto" no aplica a un pendiente)
        if (!motivo.aplicaA(origen)) {
            throw new IllegalArgumentException("El motivo '" + motivo.etiqueta() + "' no aplica a un ítem "
                    + (generaMerma ? "que cocina ya inició." : "que cocina aún no inicia."));
        }
        // D36: si cocina ya lo empezó, la decisión no es del mozo ni del expedidor: autoriza un administrador
        Usuario autorizador = generaMerma ? autorizar(sesion, usuario, request.getAutorizacion()) : null;

        item.setEstadoItem(EstadoItem.ANULADO);
        detalleRepository.saveAndFlush(item);
        trazabilidadService.registrarItem(item, origen.name(), EstadoItem.ANULADO.name(), usuario,
                "Motivo: " + motivo.etiqueta() + (generaMerma ? " (merma)" : "")
                        + (autorizador != null && autorizador != usuario ? " · Autorizó: " + autorizador.getNombreCompleto() : ""));
        if (generaMerma) {
            mermaRepository.save(nuevaMerma(item, origen, motivo, usuario, autorizador));
        }

        // Lo anulado no se cobra: el total del pedido cuenta solo los ítems vigentes
        pedido.setTotal(pedido.getItems().stream()
                .filter(i -> i.getEstadoItem() != EstadoItem.ANULADO)
                .map(DetallePedido::getSubtotal)
                .reduce(BigDecimal.ZERO, BigDecimal::add));
        Optional<NotificadorKds.PedidoKdsEvent> cambioPedido = cicloVidaItemService.actualizarEstadoPedido(pedido, usuario);

        // Orden fijo de notificación: primero el ítem anulado (con su motivo para el aviso de cocina) y luego el pedido
        ItemCocinaDto dto = ItemCocinaMapper.aDto(item);
        dto.setMotivoAnulacion(motivo.etiqueta());
        eventPublisher.publishEvent(new NotificadorKds.ItemsKdsEvent(NotificadorKds.TipoEvento.ITEM_ACTUALIZADO, List.of(dto)));
        cambioPedido.ifPresent(eventPublisher::publishEvent);
        return dto;
    }

    /**
     * D36: devuelve el administrador que autoriza anular un ítem iniciado. Si quien anula ya es administrador, él
     * mismo autoriza. Si no, valida el usuario y la clave de autorización de un administrador activo; cualquier
     * falla (incluido un administrador sin clave configurada) responde lo mismo, sin revelar si el usuario existe,
     * y suma un intento fallido.
     */
    private Usuario autorizar(SesionKds sesion, Usuario solicitante, AnularItemRequest.Autorizacion autorizacion) {
        if (sesion.tieneRol("ADMIN")) {
            return solicitante;
        }
        String clave = sesion.username();
        IntentosFallidos previos = intentosVigentes(clave);
        if (previos != null && previos.cantidad() >= INTENTOS_MAXIMOS) {
            throw new AutorizacionAdminException("Demasiados intentos fallidos de autorización. Espere unos minutos o pida al "
                    + "administrador que anule el ítem.", AutorizacionAdminException.BLOQUEADA);
        }
        if (autorizacion == null || autorizacion.getUsuario() == null || autorizacion.getUsuario().isBlank()
                || autorizacion.getClave() == null || autorizacion.getClave().isEmpty()) {
            throw new AutorizacionAdminException("Cocina ya inició este ítem: para anularlo se requiere el usuario y la "
                    + "clave de autorización de un administrador.", AutorizacionAdminException.REQUERIDA);
        }
        Optional<Usuario> admin = usuarioRepository.findByUsername(autorizacion.getUsuario().trim())
                .filter(u -> Boolean.TRUE.equals(u.getActivo()))
                .filter(u -> u.getRol() != null && "ADMIN".equalsIgnoreCase(u.getRol().getCodigo()))
                .filter(u -> u.getClaveAutorizacionHash() != null
                        && passwordEncoder.matches(autorizacion.getClave(), u.getClaveAutorizacionHash()));
        if (admin.isEmpty()) {
            intentosFallidos.merge(clave, new IntentosFallidos(1, Instant.now()),
                    (anterior, nuevo) -> vencido(anterior) ? nuevo : new IntentosFallidos(anterior.cantidad() + 1, anterior.desde()));
            throw new AutorizacionAdminException("Usuario o clave de autorización incorrectos. Si el administrador aún no "
                    + "tiene clave, debe crearla en Administración > Mi clave.", AutorizacionAdminException.INVALIDA);
        }
        intentosFallidos.remove(clave);
        return admin.get();
    }

    private IntentosFallidos intentosVigentes(String clave) {
        IntentosFallidos intentos = intentosFallidos.get(clave);
        if (intentos != null && vencido(intentos)) {
            intentosFallidos.remove(clave, intentos);
            return null;
        }
        return intentos;
    }

    private static boolean vencido(IntentosFallidos intentos) {
        return intentos.desde().plus(VENTANA_INTENTOS).isBefore(Instant.now());
    }

    // La merma guarda una foto del ítem: el reporte no cambia si luego se edita el catálogo
    private static Merma nuevaMerma(DetallePedido item, EstadoItem origen, MotivoAnulacion motivo, Usuario usuario,
                                    Usuario autorizador) {
        Merma merma = new Merma();
        merma.setDetallePedidoId(item.getId());
        merma.setPedidoId(item.getPedido().getId());
        merma.setCodigoPedido(item.getPedido().getCodigoCorrelativo());
        merma.setPlatoNombre(item.getPlato().getNombre());
        merma.setEstacionId(item.getEstacion().getId());
        merma.setEstacionNombre(item.getEstacion().getNombre());
        merma.setCantidad(item.getCantidad());
        merma.setMonto(item.getSubtotal());
        merma.setEstadoAlAnular(origen);
        merma.setMotivo(motivo);
        merma.setResponsableId(usuario.getId());
        merma.setResponsableNombre(usuario.getNombreCompleto());
        if (autorizador != null) {
            merma.setAutorizadoPorId(autorizador.getId());
            merma.setAutorizadoPorNombre(autorizador.getNombreCompleto());
        }
        return merma;
    }
}
