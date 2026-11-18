package pe.isil.kds.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import pe.isil.kds.model.Merma;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface MermaRepository extends JpaRepository<Merma, Long> {

    // Rango semiabierto [desde, hasta): el límite superior es el inicio del día siguiente al último pedido
    List<Merma> findByCreatedAtGreaterThanEqualAndCreatedAtLessThanOrderByCreatedAtDescIdDesc(
            LocalDateTime desde, LocalDateTime hasta);
}
