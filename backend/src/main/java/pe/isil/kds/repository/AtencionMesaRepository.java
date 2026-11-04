package pe.isil.kds.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;
import pe.isil.kds.model.AtencionMesa;

import java.util.List;
import java.util.Optional;

@Repository
public interface AtencionMesaRepository extends JpaRepository<AtencionMesa, Long> {

    Optional<AtencionMesa> findByMesaIdAndLiberadaEnIsNull(Long mesaId);

    boolean existsByMesaIdAndLiberadaEnIsNull(Long mesaId);

    // Mesas con atención abierta: marcan las mesas ocupadas (HU040, HU041, HU044); solo los IDs
    @Query("SELECT a.mesa.id FROM AtencionMesa a WHERE a.liberadaEn IS NULL")
    List<Long> idsMesasAbiertas();
}
