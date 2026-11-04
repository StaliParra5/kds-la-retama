package pe.isil.kds.security;

import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import pe.isil.kds.repository.UsuarioRepository;

import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.Date;

/**
 * Comprueba que un token siga vigente para su usuario (HU042 Escenarios 5 y 6):
 * el usuario existe, está activo y el token se emitió después de la última revocación
 * (desactivación, cambio de PIN o de rol). Lo usan las peticiones HTTP y la conexión STOMP.
 */
@Component
public class VigenciaSesion {

    private final UsuarioRepository usuarioRepository;

    public VigenciaSesion(UsuarioRepository usuarioRepository) {
        this.usuarioRepository = usuarioRepository;
    }

    @Transactional(readOnly = true)
    public boolean vigente(Long usuarioId, Date emitidoEn) {
        if (usuarioId == null || emitidoEn == null) {
            return false;
        }
        return usuarioRepository.findById(usuarioId)
                .filter(u -> Boolean.TRUE.equals(u.getActivo()))
                .map(u -> u.getSesionesValidasDesde() == null
                        || !LocalDateTime.ofInstant(emitidoEn.toInstant(), ZoneId.systemDefault()).isBefore(u.getSesionesValidasDesde()))
                .orElse(false);
    }
}
