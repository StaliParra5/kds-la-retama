package pe.isil.kds.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import pe.isil.kds.model.Mesa;
import java.util.List;
import java.util.Optional;

@Repository
public interface MesaRepository extends JpaRepository<Mesa, Long> {
    List<Mesa> findByZonaIdAndActivoTrue(Long zonaId);
    List<Mesa> findByActivoTrue();
    Optional<Mesa> findByZonaIdAndNumeroMesa(Long zonaId, String numeroMesa);
}
