package pe.isil.kds.service;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import pe.isil.kds.exception.RecursoNoEncontradoException;
import pe.isil.kds.dto.TransicionDto;
import pe.isil.kds.model.DetallePedido;
import pe.isil.kds.model.Pedido;
import pe.isil.kds.model.TransicionEstado;
import pe.isil.kds.model.Usuario;
import pe.isil.kds.repository.DetallePedidoRepository;
import pe.isil.kds.repository.PedidoRepository;
import pe.isil.kds.repository.TransicionEstadoRepository;

import java.util.List;

/**
 * Registro de transiciones de estado de pedidos e ítems (HU013 / HU022).
 * Cada cambio de estado deja una fila con origen, destino, usuario responsable y hora del servidor.
 * El historial es de solo inserción: no hay operaciones de edición ni borrado.
 */
@Service
public class TrazabilidadService {

    public static final String RESPONSABLE_SISTEMA = "Sistema";

    private final TransicionEstadoRepository transicionRepository;
    private final DetallePedidoRepository detalleRepository;
    private final PedidoRepository pedidoRepository;

    public TrazabilidadService(
            TransicionEstadoRepository transicionRepository,
            DetallePedidoRepository detalleRepository,
            PedidoRepository pedidoRepository) {
        this.transicionRepository = transicionRepository;
        this.detalleRepository = detalleRepository;
        this.pedidoRepository = pedidoRepository;
    }

    @Transactional(readOnly = true)
    public List<TransicionDto> historialItem(Long itemId) {
        if (!detalleRepository.existsById(itemId)) {
            throw new RecursoNoEncontradoException("Ítem no encontrado con ID: " + itemId);
        }
        return transicionRepository.findByDetallePedidoIdOrderByFechaHoraAscIdAsc(itemId)
                .stream().map(TrazabilidadService::aDto).toList();
    }

    @Transactional(readOnly = true)
    public List<TransicionDto> historialPedido(Long pedidoId) {
        if (!pedidoRepository.existsById(pedidoId)) {
            throw new RecursoNoEncontradoException("Pedido no encontrado con ID: " + pedidoId);
        }
        return transicionRepository.findByPedidoIdOrderByFechaHoraAscIdAsc(pedidoId)
                .stream().map(TrazabilidadService::aDto).toList();
    }

    static TransicionDto aDto(TransicionEstado t) {
        TransicionDto dto = new TransicionDto();
        dto.setId(t.getId());
        if (t.getDetallePedido() != null) {
            dto.setItemId(t.getDetallePedido().getId());
            dto.setPlatoNombre(t.getDetallePedido().getPlato().getNombre());
        }
        dto.setEstadoOrigen(t.getEstadoOrigen());
        dto.setEstadoDestino(t.getEstadoDestino());
        Usuario usuario = t.getUsuario();
        // HU022 Esc. 3: las transiciones automáticas (sin usuario) figuran a nombre del "Sistema"
        dto.setResponsable(usuario != null ? usuario.getNombre() + " " + usuario.getApellido() : RESPONSABLE_SISTEMA);
        dto.setRolResponsable(usuario != null ? usuario.getRol().getCodigo() : null);
        dto.setFechaHora(t.getFechaHora());
        dto.setMotivo(t.getMotivo());
        return dto;
    }

    public void registrarItem(DetallePedido item, String origen, String destino, Usuario usuario, String motivo) {
        registrar(item.getPedido(), item, origen, destino, usuario, motivo);
    }

    public void registrarPedido(Pedido pedido, String origen, String destino, Usuario usuario, String motivo) {
        registrar(pedido, null, origen, destino, usuario, motivo);
    }

    private void registrar(Pedido pedido, DetallePedido item, String origen, String destino, Usuario usuario, String motivo) {
        TransicionEstado transicion = new TransicionEstado();
        transicion.setPedido(pedido);
        transicion.setDetallePedido(item);
        transicion.setEstadoOrigen(origen);
        transicion.setEstadoDestino(destino);
        transicion.setUsuario(usuario);
        transicion.setMotivo(motivo);
        transicionRepository.save(transicion);
    }
}
