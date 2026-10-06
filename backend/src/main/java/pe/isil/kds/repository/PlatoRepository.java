package pe.isil.kds.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import pe.isil.kds.model.Plato;
import java.util.List;

@Repository
public interface PlatoRepository extends JpaRepository<Plato, Long> {
    List<Plato> findByActivoTrue();
    List<Plato> findByCategoriaIdAndActivoTrue(Long categoriaId);
    List<Plato> findByEstacionIdAndActivoTrue(Long estacionId);
    // Optimización N+1: Cuenta eficiente a nivel de base de datos sin cargar entidades en memoria
    long countByEstacionIdAndActivoTrue(Long estacionId);
    List<Plato> findByNombreContainingIgnoreCaseAndActivoTrue(String query);
    List<Plato> findByCategoriaIdAndNombreContainingIgnoreCaseAndActivoTrue(Long categoriaId, String query);
}
