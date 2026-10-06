package pe.isil.kds.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import pe.isil.kds.model.CanalVenta;
import java.util.List;
import java.util.Optional;

@Repository
public interface CanalVentaRepository extends JpaRepository<CanalVenta, Long> {
    Optional<CanalVenta> findByCodigo(String codigo);
    List<CanalVenta> findByActivoTrue();
}
