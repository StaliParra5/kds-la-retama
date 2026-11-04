package pe.isil.kds.repository;

import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import pe.isil.kds.model.EstadoPedido;
import pe.isil.kds.model.Pedido;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface PedidoRepository extends JpaRepository<Pedido, Long> {
    Optional<Pedido> findByCodigoCorrelativo(String codigoCorrelativo);

    Optional<Pedido> findByClaveIdempotencia(String claveIdempotencia);

    // SELECT ... FOR UPDATE: serializa los cambios de estado de los ítems de un mismo pedido
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT p FROM Pedido p WHERE p.id = :id")
    Optional<Pedido> bloquearPorId(@Param("id") Long id);
    List<Pedido> findByEstado(EstadoPedido estado);
    List<Pedido> findByEstadoInOrderByCreatedAtAsc(List<EstadoPedido> estados);

    boolean existsByUsuarioId(Long usuarioId);

    List<Pedido> findByAtencionIdOrderByCreatedAtAsc(Long atencionId);

    // Vista de salón (HU048): pedidos de varias atenciones con sus ítems en una sola consulta
    @org.springframework.data.jpa.repository.EntityGraph(attributePaths = {"items", "atencion"})
    List<Pedido> findByAtencionIdIn(java.util.Collection<Long> atencionIds);

    @Query("SELECT DISTINCT p.usuario.id FROM Pedido p WHERE p.usuario.id IN :ids")
    List<Long> idsUsuariosConPedidos(@Param("ids") List<Long> ids);

    @Query("SELECT COUNT(p) FROM Pedido p WHERE p.createdAt >= :desde")
    long countPedidosDesde(LocalDateTime desde);

    // Consulta nativa atómica contra la secuencia PostgreSQL para evitar race-conditions en concurrencia alta
    @Query(value = "SELECT nextval('seq_pedido_correlativo')", nativeQuery = true)
    Long obtenerSiguienteValorSecuencia();
}
