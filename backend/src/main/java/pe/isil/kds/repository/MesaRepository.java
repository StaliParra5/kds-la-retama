package pe.isil.kds.repository;

import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import pe.isil.kds.model.Mesa;
import java.util.List;
import java.util.Optional;

@Repository
public interface MesaRepository extends JpaRepository<Mesa, Long> {
    List<Mesa> findByZonaIdAndActivoTrue(Long zonaId);
    // Disponibles para el mozo: mesa activa dentro de una zona activa (HU040 Escenario 4)
    List<Mesa> findByActivoTrueAndZonaActivoTrue();
    Optional<Mesa> findByZonaIdAndNumeroMesaIgnoreCase(Long zonaId, String numeroMesa);

    // SELECT ... FOR UPDATE: registrar un pedido y desactivar o mover su mesa se serializan sobre la fila de la mesa
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT m FROM Mesa m WHERE m.id = :id")
    Optional<Mesa> bloquearPorId(@Param("id") Long id);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT m FROM Mesa m WHERE m.zona.id = :zonaId ORDER BY m.id")
    List<Mesa> bloquearPorZona(@Param("zonaId") Long zonaId);
}
