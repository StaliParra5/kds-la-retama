package pe.isil.kds.controller;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import pe.isil.kds.dto.GuardarPlatoRequest;
import pe.isil.kds.dto.PlatoDto;
import pe.isil.kds.model.CategoriaPlato;
import pe.isil.kds.service.PlatoService;

import java.util.List;
import java.util.Map;

/**
 * Controlador de Catálogo de Platos y Carta Digital (HU003, HU007, HU023).
 */
@Tag(name = "Catálogo de Platos", description = "Endpoints de administración de carta digital y tiempos estándar")
@RestController
@RequestMapping("/api/v1")
public class PlatoController {

    private final PlatoService platoService;

    public PlatoController(PlatoService platoService) {
        this.platoService = platoService;
    }

    @Operation(summary = "Listar platos con filtro por categoría y búsqueda textual (HU007)")
    @GetMapping("/platos")
    public ResponseEntity<List<PlatoDto>> listarPlatos(
            @RequestParam(required = false) Long categoriaId,
            @RequestParam(required = false) String busqueda) {
        List<PlatoDto> platos = platoService.listarPlatos(categoriaId, busqueda);
        return ResponseEntity.ok(platos);
    }

    @Operation(summary = "Obtener detalle de un plato por ID")
    @GetMapping("/platos/{id}")
    public ResponseEntity<PlatoDto> obtenerPlato(@PathVariable Long id) {
        return ResponseEntity.ok(platoService.obtenerPorId(id));
    }

    @Operation(summary = "Listar categorías disponibles de la carta")
    @GetMapping("/categorias")
    public ResponseEntity<List<CategoriaPlato>> listarCategorias() {
        return ResponseEntity.ok(platoService.listarCategorias());
    }

    @Operation(summary = "Crear nuevo plato con estación y tiempo estándar (HU003 Escenario 1 - Admin)")
    @PreAuthorize("hasRole('ADMIN')")
    @PostMapping("/platos")
    public ResponseEntity<PlatoDto> crearPlato(@Valid @RequestBody GuardarPlatoRequest request) {
        PlatoDto creado = platoService.crearPlato(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(creado);
    }

    @Operation(summary = "Editar plato existente (HU003 - Admin)")
    @PreAuthorize("hasRole('ADMIN')")
    @PutMapping("/platos/{id}")
    public ResponseEntity<PlatoDto> actualizarPlato(
            @PathVariable Long id,
            @Valid @RequestBody GuardarPlatoRequest request) {
        PlatoDto actualizado = platoService.actualizarPlato(id, request);
        return ResponseEntity.ok(actualizado);
    }

    @Operation(summary = "Cambiar disponibilidad de un plato (Agotado / Disponible)")
    @PreAuthorize("hasAnyRole('ADMIN', 'MOZO')")
    @PatchMapping("/platos/{id}/disponibilidad")
    public ResponseEntity<PlatoDto> cambiarDisponibilidad(
            @PathVariable Long id,
            @RequestBody Map<String, Boolean> body) {
        boolean disponible = body.getOrDefault("disponible", true);
        PlatoDto actualizado = platoService.cambiarDisponibilidad(id, disponible);
        return ResponseEntity.ok(actualizado);
    }
}
