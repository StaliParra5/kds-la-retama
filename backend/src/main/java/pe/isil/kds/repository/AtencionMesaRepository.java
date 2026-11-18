package pe.isil.kds.repository;

import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import pe.isil.kds.model.AtencionMesa;

import java.util.List;
import java.util.Optional;

@Repository
public interface AtencionMesaRepository extends JpaRepository<AtencionMesa, Long> {

    Optional<AtencionMesa> findByMesaIdAndLiberadaEnIsNull(Long mesaId);

    boolean existsByMesaIdAndLiberadaEnIsNull(Long mesaId);

    // Vista de salón (HU048): atenciones abiertas con su mesa y el mozo que la abrió
    @EntityGraph(attributePaths = {"mesa", "mozo"})
    List<AtencionMesa> findByLiberadaEnIsNull();

    // Mesas con atención abierta: marcan las mesas ocupadas (HU040, HU041, HU044); solo los IDs
    @Query("SELECT a.mesa.id FROM AtencionMesa a WHERE a.liberadaEn IS NULL")
    List<Long> idsMesasAbiertas();

    // HU042: un mozo con una mesa abierta no se elimina
    List<AtencionMesa> findByMozoIdAndLiberadaEnIsNull(Long mozoId);

    // HU042: al eliminar un mozo sin historial se borran las mesas que abrió y ya liberó (todas sin pedidos).
    // Una abierta en paralelo no se toca: su FK impide borrar al mozo.
    @Modifying
    @Query(value = "DELETE FROM atenciones_mesa WHERE mozo_id = :mozoId AND liberada_en IS NOT NULL", nativeQuery = true)
    void eliminarLiberadasDelMozo(@Param("mozoId") Long mozoId);

    // HU042: las mesas de otro mozo que él liberó se conservan; solo se olvida quién las liberó
    @Modifying
    @Query(value = "UPDATE atenciones_mesa SET liberada_por = NULL WHERE liberada_por = :mozoId AND mozo_id <> :mozoId", nativeQuery = true)
    void olvidarLiberacionesDelMozo(@Param("mozoId") Long mozoId);
}
