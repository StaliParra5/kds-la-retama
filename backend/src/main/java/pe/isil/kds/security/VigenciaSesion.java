package pe.isil.kds.security;

import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import pe.isil.kds.repository.UsuarioRepository;

/**
 * Comprueba que un token siga vigente para su usuario (HU042 Escenarios 5 y 6):
 * el usuario existe, está activo y el token lleva su versión de sesión actual, que cambia al
 * desactivarlo o al cambiarle el PIN o el rol. Lo usan las peticiones HTTP y la conexión STOMP.
 */
@Component
public class VigenciaSesion {

    private final UsuarioRepository usuarioRepository;

    public VigenciaSesion(UsuarioRepository usuarioRepository) {
        this.usuarioRepository = usuarioRepository;
    }

    @Transactional(readOnly = true)
    public boolean vigente(Long usuarioId, int versionToken) {
        if (usuarioId == null) {
            return false;
        }
        return usuarioRepository.findById(usuarioId)
                .filter(u -> Boolean.TRUE.equals(u.getActivo()))
                .map(u -> u.getVersionSesion() != null && u.getVersionSesion() == versionToken)
                .orElse(false);
    }
}
