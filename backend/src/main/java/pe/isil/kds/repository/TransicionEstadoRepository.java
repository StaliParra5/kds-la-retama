package pe.isil.kds.repository;

import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import pe.isil.kds.model.TransicionEstado;
import java.util.List;

@Repository
public interface TransicionEstadoRepository extends JpaRepository<TransicionEstado, Long> {
    @EntityGraph(attributePaths = {"detallePedido.plato", "usuario.rol"})
    List<TransicionEstado> findByPedidoIdOrderByFechaHoraAscIdAsc(Long pedidoId);

    @EntityGraph(attributePaths = {"detallePedido.plato", "usuario.rol"})
    List<TransicionEstado> findByDetallePedidoIdOrderByFechaHoraAscIdAsc(Long detallePedidoId);
}
