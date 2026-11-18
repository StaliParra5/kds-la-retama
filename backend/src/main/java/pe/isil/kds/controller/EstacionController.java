package pe.isil.kds.controller;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import pe.isil.kds.dto.EstacionDto;
import pe.isil.kds.dto.ItemCocinaDto;
import pe.isil.kds.model.Estacion;
import pe.isil.kds.security.SesionKds;
import pe.isil.kds.service.CocinaService;
import pe.isil.kds.service.EstacionService;

import java.util.List;

/**
 * Controlador de Estaciones de Cocina (HU004).
 */
@Tag(name = "Estaciones de Cocina", description = "Endpoints de configuración de estaciones de trabajo operativas")
@RestController
@RequestMapping("/api/v1/estaciones")
public class EstacionController {

    private final EstacionService estacionService;
    private final CocinaService cocinaService;

    public EstacionController(EstacionService estacionService, CocinaService cocinaService) {
        this.estacionService = estacionService;
        this.cocinaService = cocinaService;
    }

    @Operation(summary = "Cola activa de ítems enrutados a una estación de cocina (HU011, HU012)")
    @PreAuthorize("hasAnyRole('COCINERO', 'EXPEDIDOR', 'ADMIN')")
    @GetMapping("/{id}/cola")
    public ResponseEntity<List<ItemCocinaDto>> colaDeEstacion(@PathVariable Long id, Authentication authentication) {
        return ResponseEntity.ok(cocinaService.colaDeEstacion(id, SesionKds.de(authentication)));
    }

    @Operation(summary = "Listar estaciones activas con cantidad de platos asignados")
    @GetMapping
    public ResponseEntity<List<EstacionDto>> listarEstaciones() {
        return ResponseEntity.ok(estacionService.listarEstaciones());
    }

    @Operation(summary = "Crear nueva estación de cocina (Admin)")
    @PreAuthorize("hasRole('ADMIN')")
    @PostMapping
    public ResponseEntity<Estacion> crearEstacion(@jakarta.validation.Valid @RequestBody pe.isil.kds.dto.CrearEstacionRequest request) {
        Estacion creada = estacionService.crearEstacion(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(creada);
    }

    @Operation(summary = "Actualizar estación de cocina (Admin)")
    @PreAuthorize("hasRole('ADMIN')")
    @PutMapping("/{id}")
    public ResponseEntity<Estacion> actualizarEstacion(
            @PathVariable Long id,
            @jakarta.validation.Valid @RequestBody pe.isil.kds.dto.ActualizarEstacionRequest request) {
        Estacion actualizada = estacionService.actualizarEstacion(id, request);
        return ResponseEntity.ok(actualizada);
    }
}
