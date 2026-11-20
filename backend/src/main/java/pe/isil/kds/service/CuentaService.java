package pe.isil.kds.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import pe.isil.kds.dto.ClaveAutorizacionEstadoDto;
import pe.isil.kds.exception.AutorizacionAdminException;
import pe.isil.kds.model.Usuario;
import pe.isil.kds.repository.UsuarioRepository;

/**
 * Datos de la propia cuenta del usuario con sesión (HU049, decisión D36).
 *
 * Reglas de la clave de autorización:
 * - Solo los administradores la tienen; es un PIN de 6 dígitos distinto de su contraseña.
 * - Para crearla o cambiarla se confirma la contraseña de la cuenta. Si se olvida, se vuelve a crear igual.
 * - No puede ser igual a la contraseña de la cuenta.
 * - Se guarda solo su hash BCrypt (mismo codificador que las contraseñas, costo 12).
 */
@Service
public class CuentaService {

    private static final Logger log = LoggerFactory.getLogger(CuentaService.class);

    private final UsuarioRepository usuarioRepository;
    private final PasswordEncoder passwordEncoder;

    public CuentaService(UsuarioRepository usuarioRepository, PasswordEncoder passwordEncoder) {
        this.usuarioRepository = usuarioRepository;
        this.passwordEncoder = passwordEncoder;
    }

    @Transactional(readOnly = true)
    public ClaveAutorizacionEstadoDto estadoClaveAutorizacion(String username) {
        return new ClaveAutorizacionEstadoDto(administrador(username).getClaveAutorizacionHash() != null);
    }

    @Transactional
    public ClaveAutorizacionEstadoDto configurarClaveAutorizacion(String username, String passwordActual, String clave) {
        Usuario admin = administrador(username);
        if (admin.getPasswordHash() == null || passwordActual == null
                || !passwordEncoder.matches(passwordActual, admin.getPasswordHash())) {
            // 403 con código (no 401): una contraseña mal escrita no debe cerrar la sesión del administrador
            throw new AutorizacionAdminException("La contraseña de su cuenta no es correcta.", AutorizacionAdminException.INVALIDA);
        }
        if (clave == null || !clave.matches("^\\d{6}$")) {
            throw new IllegalArgumentException("La clave de autorización debe tener 6 dígitos.");
        }
        if (clave.equals(passwordActual)) {
            throw new IllegalArgumentException("La clave de autorización debe ser distinta de la contraseña de su cuenta.");
        }
        admin.setClaveAutorizacionHash(passwordEncoder.encode(clave));
        usuarioRepository.save(admin);
        log.info("Clave de autorización configurada por el administrador {}", admin.getUsername());
        return new ClaveAutorizacionEstadoDto(true);
    }

    private Usuario administrador(String username) {
        Usuario usuario = usuarioRepository.findByUsername(username)
                .orElseThrow(() -> new IllegalArgumentException("Usuario no encontrado: " + username));
        if (usuario.getRol() == null || !"ADMIN".equalsIgnoreCase(usuario.getRol().getCodigo())) {
            throw new IllegalArgumentException("Solo los administradores tienen clave de autorización.");
        }
        return usuario;
    }
}
