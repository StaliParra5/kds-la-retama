package pe.isil.kds.repository;

import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import pe.isil.kds.model.CanalVenta;
import java.util.List;
import java.util.Optional;

@Repository
public interface CanalVentaRepository extends JpaRepository<CanalVenta, Long> {
    Optional<CanalVenta> findByCodigo(String codigo);
    List<CanalVenta> findByActivoTrueOrderByIdAsc();
    List<CanalVenta> findAllByOrderByIdAsc();

    // HU034: bloquea la fila del canal hasta el fin de la transacción. Dos reenvíos simultáneos del mismo pedido
    // externo se atienden uno tras otro, así el segundo ya ve al primero y no se duplica. Solo se usa cuando el
    // pedido trae número de orden, de modo que los pedidos del comandero nunca esperan por este bloqueo.
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT c FROM CanalVenta c WHERE c.id = :id")
    Optional<CanalVenta> bloquearPorId(@Param("id") Long id);
}
