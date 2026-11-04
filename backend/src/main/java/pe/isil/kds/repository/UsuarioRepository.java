package pe.isil.kds.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import pe.isil.kds.model.Usuario;
import java.util.List;
import java.util.Optional;

@Repository
public interface UsuarioRepository extends JpaRepository<Usuario, Long> {
    Optional<Usuario> findByUsername(String username);
    List<Usuario> findByActivoTrue();
    List<Usuario> findByRolCodigoAndActivoTrue(String rolCodigo);
    Optional<Usuario> findByUsernameIgnoreCase(String username);
    List<Usuario> findByRolCodigoOrderByApellidoAscNombreAsc(String rolCodigo);

    // Usuarios con PIN distintos del indicado: contra ellos se valida que un PIN nuevo no se repita (HU042)
    @Query("SELECT u FROM Usuario u WHERE u.pinHash IS NOT NULL AND (:excluirId IS NULL OR u.id <> :excluirId)")
    List<Usuario> conPinSalvo(@Param("excluirId") Long excluirId);
}
