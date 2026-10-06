package pe.isil.kds.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;
import pe.isil.kds.model.Pedido;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface PedidoRepository extends JpaRepository<Pedido, Long> {
    Optional<Pedido> findByCodigoCorrelativo(String codigoCorrelativo);
    List<Pedido> findByEstado(String estado);
    List<Pedido> findByEstadoInOrderByCreatedAtAsc(List<String> estados);

    @Query("SELECT COUNT(p) FROM Pedido p WHERE p.createdAt >= :desde")
    long countPedidosDesde(LocalDateTime desde);

    // Consulta nativa atómica contra la secuencia PostgreSQL para evitar race-conditions en concurrencia alta
    @Query(value = "SELECT nextval('seq_pedido_correlativo')", nativeQuery = true)
    Long obtenerSiguienteValorSecuencia();
}
