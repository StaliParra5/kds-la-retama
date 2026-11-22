package pe.isil.kds.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import pe.isil.kds.model.ConfiguracionCocina;

@Repository
public interface ConfiguracionCocinaRepository extends JpaRepository<ConfiguracionCocina, Short> {
}
