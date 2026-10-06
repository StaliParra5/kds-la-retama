package pe.isil.kds.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import pe.isil.kds.model.CategoriaPlato;
import java.util.List;
import java.util.Optional;

@Repository
public interface CategoriaPlatoRepository extends JpaRepository<CategoriaPlato, Long> {
    Optional<CategoriaPlato> findByNombre(String nombre);
    List<CategoriaPlato> findByActivoTrueOrderByOrdenVisualAsc();
}
