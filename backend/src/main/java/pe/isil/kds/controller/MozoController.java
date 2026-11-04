package pe.isil.kds.controller;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import pe.isil.kds.dto.CambiarActivoRequest;
import pe.isil.kds.dto.CambiarPinRequest;
import pe.isil.kds.dto.CrearMozoRequest;
import pe.isil.kds.dto.EditarMozoRequest;
import pe.isil.kds.dto.MozoDto;
import pe.isil.kds.service.MozoService;

import java.util.List;

/**
 * Controlador de Gestión de Mozos (HU042). Exclusivo del administrador.
 */
@Tag(name = "Mozos", description = "Alta, edición, PIN, desactivación y baja de mozos (HU042)")
@RestController
@RequestMapping("/api/v1/mozos")
@PreAuthorize("hasRole('ADMIN')")
public class MozoController {

    private final MozoService mozoService;

    public MozoController(MozoService mozoService) {
        this.mozoService = mozoService;
    }

    @Operation(summary = "Listar los mozos, activos e inactivos")
    @GetMapping
    public ResponseEntity<List<MozoDto>> listar() {
        return ResponseEntity.ok(mozoService.listar());
    }

    @Operation(summary = "Registrar un mozo con su PIN (HU042 Esc. 1 a 3)")
    @PostMapping
    public ResponseEntity<MozoDto> crear(@Valid @RequestBody CrearMozoRequest request) {
        MozoDto creado = mozoService.crear(request.getUsername(), request.getNombre(), request.getApellido(), request.getPin());
        return ResponseEntity.status(HttpStatus.CREATED).body(creado);
    }

    @Operation(summary = "Editar nombre y apellido (HU042 Esc. 4)")
    @PutMapping("/{id}")
    public ResponseEntity<MozoDto> editar(@PathVariable Long id, @Valid @RequestBody EditarMozoRequest request) {
        return ResponseEntity.ok(mozoService.editar(id, request.getNombre(), request.getApellido()));
    }

    @Operation(summary = "Asignar un PIN nuevo (HU042 Esc. 5)")
    @PutMapping("/{id}/pin")
    public ResponseEntity<MozoDto> cambiarPin(@PathVariable Long id, @Valid @RequestBody CambiarPinRequest request) {
        return ResponseEntity.ok(mozoService.cambiarPin(id, request.getPin()));
    }

    @Operation(summary = "Desactivar o reactivar (HU042 Esc. 6)")
    @PatchMapping("/{id}/estado")
    public ResponseEntity<MozoDto> cambiarEstado(@PathVariable Long id, @Valid @RequestBody CambiarActivoRequest request) {
        return ResponseEntity.ok(mozoService.cambiarEstado(id, request.getActivo()));
    }

    @Operation(summary = "Eliminar un mozo sin historial; con pedidos responde 409 MOZO_CON_HISTORIAL (HU042 Esc. 7 y 8)")
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> eliminar(@PathVariable Long id) {
        mozoService.eliminar(id);
        return ResponseEntity.noContent().build();
    }
}
