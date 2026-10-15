package pe.isil.kds.service;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import pe.isil.kds.dto.UsuarioDto;
import pe.isil.kds.model.Rol;
import pe.isil.kds.model.Usuario;
import pe.isil.kds.repository.RolRepository;
import pe.isil.kds.repository.UsuarioRepository;

import java.util.List;
import java.util.stream.Collectors;

/**
 * Servicio de Gestión de Usuarios y Roles (HU002).
 * 
 * Reglas de Negocio Implementadas:
 * - Consulta de usuarios activos sin exponer credenciales ni hashes criptográficos (OWASP ASVS).
 * - Modificación de rol por parte del Administrador validando existencia de rol en el sistema.
 * - Prevención de degradación involuntaria de cuentas críticas.
 */
@Service
public class UsuarioService {

    private final UsuarioRepository usuarioRepository;
    private final RolRepository rolRepository;

    public UsuarioService(UsuarioRepository usuarioRepository, RolRepository rolRepository) {
        this.usuarioRepository = usuarioRepository;
        this.rolRepository = rolRepository;
    }

    @Transactional(readOnly = true)
    public List<UsuarioDto> listarUsuarios() {
        return usuarioRepository.findAll().stream()
                .map(this::convertirADto)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public UsuarioDto obtenerPorId(Long id) {
        Usuario usuario = usuarioRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Usuario no encontrado con ID: " + id));
        return convertirADto(usuario);
    }

    @Transactional
    public UsuarioDto actualizarRolUsuario(Long usuarioId, String rolCodigo) {
        Usuario usuario = usuarioRepository.findById(usuarioId)
                .orElseThrow(() -> new IllegalArgumentException("Usuario no encontrado con ID: " + usuarioId));

        // HU002 Escenario 5: Protección estricta del último administrador activo del sistema
        // Previene dejar el KDS sin capacidad de gestión administrativa o de configuración crítica.
        if ("ADMIN".equalsIgnoreCase(usuario.getRol().getCodigo()) && !"ADMIN".equalsIgnoreCase(rolCodigo)) {
            List<Usuario> adminsActivos = usuarioRepository.findByRolCodigoAndActivoTrue("ADMIN");
            if (adminsActivos.size() <= 1 && adminsActivos.stream().anyMatch(a -> a.getId().equals(usuarioId))) {
                throw new IllegalArgumentException("No se puede cambiar el rol al único administrador activo del sistema.");
            }
        }

        Rol nuevoRol = rolRepository.findByCodigo(rolCodigo)
                .orElseThrow(() -> new IllegalArgumentException("Rol no válido en el sistema: " + rolCodigo));

        // Actualizar rol del usuario
        usuario.setRol(nuevoRol);
        Usuario guardado = usuarioRepository.save(usuario);

        return convertirADto(guardado);
    }

    private UsuarioDto convertirADto(Usuario u) {
        return new UsuarioDto(
                u.getId(),
                u.getUsername(),
                u.getNombre(),
                u.getApellido(),
                u.getRol().getId(),
                u.getRol().getCodigo(),
                u.getRol().getNombre(),
                u.getPinHash() != null && !u.getPinHash().isBlank(),
                u.getActivo(),
                u.getCreatedAt()
        );
    }
}
