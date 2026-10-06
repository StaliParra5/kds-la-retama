package pe.isil.kds.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import pe.isil.kds.model.Estacion;
import java.util.List;
import java.util.Optional;

@Repository
public interface EstacionRepository extends JpaRepository<Estacion, Long> {
    Optional<Estacion> findByCodigo(String codigo);
    List<Estacion> findByActivoTrue();
}
