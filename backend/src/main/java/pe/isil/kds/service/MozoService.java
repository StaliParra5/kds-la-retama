package pe.isil.kds.service;

import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import pe.isil.kds.dto.MozoDto;
import pe.isil.kds.exception.OperacionNoPermitidaException;
import pe.isil.kds.exception.RecursoNoEncontradoException;
import pe.isil.kds.model.Rol;
import pe.isil.kds.model.Usuario;
import pe.isil.kds.repository.PedidoRepository;
import pe.isil.kds.repository.RolRepository;
import pe.isil.kds.repository.TransicionEstadoRepository;
import pe.isil.kds.repository.UsuarioRepository;

import java.util.HashSet;
import java.util.List;
import java.util.Set;

/**
 * Servicio de Gestión de Mozos (HU042).
 *
 * Reglas de Negocio:
 * - Solo opera sobre usuarios con rol MOZO; el resto del personal se gestiona aparte (HU002).
 * - El usuario es único sin distinguir mayúsculas (Escenario 2).
 * - El PIN es de 4 dígitos y no puede coincidir con el de ningún otro usuario, activo o no (Escenario 3):
 *   el login por PIN rechaza los PIN compartidos, así que repetirlo dejaría a ambos sin poder entrar.
 *   El mensaje no revela a quién pertenece.
 * - Un mozo con pedidos o transiciones registradas no se elimina, se desactiva (Escenario 8, HU022).
 */
@Service
public class MozoService {

    public static final String CODIGO_CON_HISTORIAL = "MOZO_CON_HISTORIAL";
    private static final String ROL_MOZO = "MOZO";
    private static final String MENSAJE_PIN_EN_USO = "Ese PIN ya está en uso por otro usuario. Asigne un PIN diferente.";

    private final UsuarioRepository usuarioRepository;
    private final RolRepository rolRepository;
    private final PedidoRepository pedidoRepository;
    private final TransicionEstadoRepository transicionRepository;
    private final PasswordEncoder passwordEncoder;

    public MozoService(UsuarioRepository usuarioRepository, RolRepository rolRepository,
                       PedidoRepository pedidoRepository, TransicionEstadoRepository transicionRepository,
                       PasswordEncoder passwordEncoder) {
        this.usuarioRepository = usuarioRepository;
        this.rolRepository = rolRepository;
        this.pedidoRepository = pedidoRepository;
        this.transicionRepository = transicionRepository;
        this.passwordEncoder = passwordEncoder;
    }

    @Transactional(readOnly = true)
    public List<MozoDto> listar() {
        List<Usuario> mozos = usuarioRepository.findByRolCodigoOrderByApellidoAscNombreAsc(ROL_MOZO);
        if (mozos.isEmpty()) {
            return List.of();
        }
        // Dos consultas para todo el listado en lugar de dos por mozo
        List<Long> ids = mozos.stream().map(Usuario::getId).toList();
        Set<Long> conHistorial = new HashSet<>(pedidoRepository.idsUsuariosConPedidos(ids));
        conHistorial.addAll(transicionRepository.idsUsuariosConTransiciones(ids));
        return mozos.stream()
                .map(u -> aDto(u, conHistorial.contains(u.getId())))
                .toList();
    }

    @Transactional
    public MozoDto crear(String username, String nombre, String apellido, String pin) {
        String usuarioLimpio = username.trim();
        if (usuarioRepository.findByUsernameIgnoreCase(usuarioLimpio).isPresent()) {
            throw new IllegalArgumentException("El usuario '" + usuarioLimpio + "' ya existe.");
        }
        Rol rolMozo = bloquearAsignacionDePin();
        validarPinLibre(pin, null);

        Usuario mozo = new Usuario();
        mozo.setUsername(usuarioLimpio);
        mozo.setNombre(nombre.trim());
        mozo.setApellido(apellido.trim());
        mozo.setPinHash(passwordEncoder.encode(pin));
        mozo.setRol(rolMozo);
        mozo.setActivo(true);
        return aDto(usuarioRepository.save(mozo), false);
    }

    @Transactional
    public MozoDto editar(Long id, String nombre, String apellido) {
        Usuario mozo = buscarMozo(id);
        mozo.setNombre(nombre.trim());
        mozo.setApellido(apellido.trim());
        return aDto(usuarioRepository.save(mozo));
    }

    @Transactional
    public MozoDto cambiarPin(Long id, String pin) {
        Usuario mozo = buscarMozo(id);
        bloquearAsignacionDePin();
        validarPinLibre(pin, id);
        mozo.setPinHash(passwordEncoder.encode(pin));
        // Escenario 5: el PIN anterior deja de funcionar, también en la sesión ya abierta
        mozo.revocarSesiones();
        return aDto(usuarioRepository.save(mozo));
    }

    @Transactional
    public MozoDto cambiarEstado(Long id, boolean activo) {
        Usuario mozo = buscarMozo(id);
        mozo.setActivo(activo);
        if (!activo) {
            // Escenario 6: desactivado no opera, ni siquiera con un token emitido antes
            mozo.revocarSesiones();
        }
        return aDto(usuarioRepository.save(mozo));
    }

    @Transactional
    public void eliminar(Long id) {
        Usuario mozo = buscarMozo(id);
        if (tieneHistorial(id)) {
            throw new OperacionNoPermitidaException("El mozo " + mozo.getNombre() + " " + mozo.getApellido()
                    + " tiene pedidos registrados: no se puede eliminar para conservar la trazabilidad. Puede desactivarlo.",
                    CODIGO_CON_HISTORIAL);
        }
        try {
            usuarioRepository.delete(mozo);
            usuarioRepository.flush();
        } catch (DataIntegrityViolationException e) {
            // Un pedido registrado entre la comprobación y el borrado: mismo trato que el Escenario 8
            throw new OperacionNoPermitidaException("El mozo " + mozo.getNombre() + " " + mozo.getApellido()
                    + " acaba de registrar pedidos: no se puede eliminar. Puede desactivarlo.", CODIGO_CON_HISTORIAL);
        }
    }

    private Rol bloquearAsignacionDePin() {
        return rolRepository.bloquearPorCodigo(ROL_MOZO)
                .orElseThrow(() -> new IllegalStateException("No existe el rol MOZO en el sistema."));
    }

    // Se compara contra todo usuario con PIN, activo o no y de cualquier rol: así ni reactivar a alguien
    // ni cambiarle el rol (HU002) deja un PIN compartido
    private void validarPinLibre(String pin, Long mozoActualId) {
        boolean enUso = usuarioRepository.conPinSalvo(mozoActualId).stream()
                .anyMatch(u -> passwordEncoder.matches(pin, u.getPinHash()));
        if (enUso) {
            throw new IllegalArgumentException(MENSAJE_PIN_EN_USO);
        }
    }

    private boolean tieneHistorial(Long usuarioId) {
        return pedidoRepository.existsByUsuarioId(usuarioId) || transicionRepository.existsByUsuarioId(usuarioId);
    }

    private Usuario buscarMozo(Long id) {
        return usuarioRepository.findById(id)
                .filter(u -> ROL_MOZO.equalsIgnoreCase(u.getRol().getCodigo()))
                .orElseThrow(() -> new RecursoNoEncontradoException("Mozo no encontrado con ID: " + id));
    }

    private MozoDto aDto(Usuario u) {
        return aDto(u, tieneHistorial(u.getId()));
    }

    private static MozoDto aDto(Usuario u, boolean tieneHistorial) {
        return new MozoDto(u.getId(), u.getUsername(), u.getNombre(), u.getApellido(), u.getActivo(), tieneHistorial);
    }
}
