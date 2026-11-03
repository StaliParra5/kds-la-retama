package pe.isil.kds.repository;

import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import pe.isil.kds.model.DetallePedido;
import pe.isil.kds.model.EstadoItem;
import java.util.List;
import java.util.Optional;

@Repository
public interface DetallePedidoRepository extends JpaRepository<DetallePedido, Long> {
    List<DetallePedido> findByPedidoId(Long pedidoId);

    @Query("SELECT d.pedido.id FROM DetallePedido d WHERE d.id = :id")
    Optional<Long> findPedidoIdById(@Param("id") Long id);
    // Cola activa de una estación, en orden de llegada a cocina
    // Los ítems hermanos del pedido (para contar los de otras estaciones) se cargan por lotes
    // gracias a hibernate.default_batch_fetch_size, sin multiplicar las filas de la cola
    @EntityGraph(attributePaths = {"pedido", "plato", "estacion"})
    List<DetallePedido> findByEstacionIdAndEstadoItemInOrderByPedidoFechaEnvioCocinaAscIdAsc(Long estacionId, List<EstadoItem> estados);
}
