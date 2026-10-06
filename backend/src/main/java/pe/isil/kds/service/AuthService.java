package pe.isil.kds.service;

import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import pe.isil.kds.dto.AuthRequest;
import pe.isil.kds.dto.AuthResponse;
import pe.isil.kds.dto.PinAuthRequest;
import pe.isil.kds.model.Estacion;
import pe.isil.kds.model.Usuario;
import pe.isil.kds.repository.EstacionRepository;
import pe.isil.kds.repository.UsuarioRepository;
import pe.isil.kds.security.JwtTokenProvider;

import java.util.List;

/**
 * Servicio de Autenticación y Autorización por Perfil (HU001).
 * 
 * Reglas de Negocio Implementadas:
 * - Escenario 1 (Cocina con PIN): Autentica a cocineros mediante PIN de 4 dígitos.
 *   Si se proporciona estacionId, vincula la sesión a esa estación de trabajo.
 * - Escenario 2 (Administración): Exige usuario y contraseña completos; rechaza intentos de acceso
 *   administrativo mediante PIN numérico para prevenir elevación de privilegios en terminales abiertas.
 */
@Service
public class AuthService {

    private final UsuarioRepository usuarioRepository;
    private final EstacionRepository estacionRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtTokenProvider tokenProvider;

    public AuthService(
            UsuarioRepository usuarioRepository,
            EstacionRepository estacionRepository,
            PasswordEncoder passwordEncoder,
            JwtTokenProvider tokenProvider) {
        this.usuarioRepository = usuarioRepository;
        this.estacionRepository = estacionRepository;
        this.passwordEncoder = passwordEncoder;
        this.tokenProvider = tokenProvider;
    }

    @Transactional(readOnly = true)
    public AuthResponse loginAdmin(AuthRequest request) {
        Usuario usuario = usuarioRepository.findByUsername(request.getUsername())
                .orElseThrow(() -> new BadCredentialsException("Credenciales inválidas"));

        if (!usuario.getActivo()) {
            throw new BadCredentialsException("El usuario se encuentra inactivo");
        }

        if (usuario.getPasswordHash() == null || !passwordEncoder.matches(request.getPassword(), usuario.getPasswordHash())) {
            throw new BadCredentialsException("Credenciales inválidas");
        }

        String rolCodigo = usuario.getRol().getCodigo();
        String token = tokenProvider.generateToken(usuario.getId(), usuario.getUsername(), rolCodigo);

        return new AuthResponse(
                token,
                usuario.getId(),
                usuario.getUsername(),
                usuario.getNombre() + " " + usuario.getApellido(),
                rolCodigo,
                null,
                null
        );
    }

    @Transactional(readOnly = true)
    public AuthResponse loginPin(PinAuthRequest request) {
        Usuario usuarioEncontrado = null;

        // Optimización de rendimiento: Si el cliente envía username/código, lookup directo O(1)
        if (request.getUsername() != null && !request.getUsername().isBlank()) {
            Usuario u = usuarioRepository.findByUsername(request.getUsername().trim())
                    .orElseThrow(() -> new BadCredentialsException("PIN no reconocido o usuario inactivo"));
            if (Boolean.TRUE.equals(u.getActivo()) && u.getPinHash() != null && passwordEncoder.matches(request.getPin(), u.getPinHash())) {
                usuarioEncontrado = u;
            }
        } else {
            // Escaneo táctil ágil: Buscar coincidencia entre usuarios operativos activos
            List<Usuario> usuarios = usuarioRepository.findByActivoTrue();
            for (Usuario u : usuarios) {
                if (u.getPinHash() != null && passwordEncoder.matches(request.getPin(), u.getPinHash())) {
                    usuarioEncontrado = u;
                    break;
                }
            }
        }

        if (usuarioEncontrado == null) {
            throw new BadCredentialsException("PIN no reconocido o usuario inactivo");
        }

        // HU001 Escenario 2: Funciones administrativas no pueden autenticarse solo con PIN
        String rolCodigo = usuarioEncontrado.getRol().getCodigo();
        if ("ADMIN".equalsIgnoreCase(rolCodigo)) {
            throw new BadCredentialsException("El rol Administrador exige usuario y contraseña completos.");
        }

        Long estacionId = request.getEstacionId();
        String estacionNombre = null;
        if (estacionId != null) {
            Estacion estacion = estacionRepository.findById(estacionId).orElse(null);
            if (estacion != null) {
                estacionNombre = estacion.getNombre();
            }
        }

        String token = tokenProvider.generateToken(usuarioEncontrado.getId(), usuarioEncontrado.getUsername(), rolCodigo);

        return new AuthResponse(
                token,
                usuarioEncontrado.getId(),
                usuarioEncontrado.getUsername(),
                usuarioEncontrado.getNombre() + " " + usuarioEncontrado.getApellido(),
                rolCodigo,
                estacionId,
                estacionNombre
        );
    }

    @Transactional(readOnly = true)
    public AuthResponse obtenerUsuarioPorUsername(String username) {
        Usuario usuario = usuarioRepository.findByUsername(username)
                .orElseThrow(() -> new BadCredentialsException("Usuario no encontrado"));

        return new AuthResponse(
                null,
                usuario.getId(),
                usuario.getUsername(),
                usuario.getNombre() + " " + usuario.getApellido(),
                usuario.getRol().getCodigo(),
                null,
                null
        );
    }
}
