package pe.isil.kds.controller;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import pe.isil.kds.dto.ActualizarRolRequest;
import pe.isil.kds.dto.UsuarioDto;
import pe.isil.kds.service.UsuarioService;

import java.util.List;

/**
 * Controlador de Usuarios y Control de Acceso RBAC (HU002).
 * Protegido estrictamente a nivel de clase para que únicamente usuarios con rol ADMIN
 * puedan listar personal o reasignar roles de seguridad.
 */
@Tag(name = "Usuarios y Roles", description = "Endpoints de gestión de personal y control de roles RBAC (HU002)")
@RestController
@RequestMapping("/api/v1/usuarios")
@PreAuthorize("hasRole('ADMIN')")
public class UsuarioController {

    private final UsuarioService usuarioService;

    public UsuarioController(UsuarioService usuarioService) {
        this.usuarioService = usuarioService;
    }

    @Operation(summary = "Listar todos los usuarios del restaurante (Admin)")
    @GetMapping
    public ResponseEntity<List<UsuarioDto>> listarUsuarios() {
        return ResponseEntity.ok(usuarioService.listarUsuarios());
    }

    @Operation(summary = "Obtener detalle de un usuario por ID (Admin)")
    @GetMapping("/{id}")
    public ResponseEntity<UsuarioDto> obtenerPorId(@PathVariable Long id) {
        return ResponseEntity.ok(usuarioService.obtenerPorId(id));
    }

    @Operation(summary = "Actualizar el rol de un usuario (Admin)")
    @PutMapping("/{id}/rol")
    public ResponseEntity<UsuarioDto> actualizarRol(
            @PathVariable Long id,
            @Valid @RequestBody ActualizarRolRequest request) {
        UsuarioDto actualizado = usuarioService.actualizarRolUsuario(id, request.getRolCodigo());
        return ResponseEntity.ok(actualizado);
    }
}
