package pe.isil.kds.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import pe.isil.kds.model.ConfiguracionSemaforo;

@Repository
public interface ConfiguracionSemaforoRepository extends JpaRepository<ConfiguracionSemaforo, Short> {
}
