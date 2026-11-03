package pe.isil.kds.service;

import org.springframework.stereotype.Service;
import pe.isil.kds.model.DetallePedido;
import pe.isil.kds.model.Pedido;
import pe.isil.kds.model.TransicionEstado;
import pe.isil.kds.model.Usuario;
import pe.isil.kds.repository.TransicionEstadoRepository;

/**
 * Registro de transiciones de estado de pedidos e ítems (HU013 / HU022).
 * Cada cambio de estado deja una fila con origen, destino, usuario responsable y hora del servidor.
 */
@Service
public class TrazabilidadService {

    private final TransicionEstadoRepository transicionRepository;

    public TrazabilidadService(TransicionEstadoRepository transicionRepository) {
        this.transicionRepository = transicionRepository;
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
