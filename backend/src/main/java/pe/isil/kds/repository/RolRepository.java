package pe.isil.kds.repository;

import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import pe.isil.kds.model.Rol;
import java.util.Optional;

@Repository
public interface RolRepository extends JpaRepository<Rol, Long> {
    Optional<Rol> findByCodigo(String codigo);

    // SELECT ... FOR UPDATE sobre el rol: serializa las asignaciones de PIN para que dos altas simultáneas
    // no registren el mismo PIN (HU042 Escenario 3)
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT r FROM Rol r WHERE r.codigo = :codigo")
    Optional<Rol> bloquearPorCodigo(@Param("codigo") String codigo);
}
