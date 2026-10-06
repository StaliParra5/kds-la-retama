package pe.isil.kds.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import pe.isil.kds.model.TransicionEstado;
import java.util.List;

@Repository
public interface TransicionEstadoRepository extends JpaRepository<TransicionEstado, Long> {
    List<TransicionEstado> findByPedidoIdOrderByFechaHoraAsc(Long pedidoId);
}
