package pe.isil.kds.controller;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import pe.isil.kds.dto.CambiarActivoRequest;
import pe.isil.kds.dto.CrearMesaRequest;
import pe.isil.kds.dto.GuardarZonaRequest;
import pe.isil.kds.dto.MesaDto;
import pe.isil.kds.dto.ZonaDto;
import pe.isil.kds.service.MesaService;

import java.util.List;

/**
 * Controlador de Zonas y Mesas de Salón (HU005, HU040, HU041).
 */
@Tag(name = "Zonas y Mesas", description = "Endpoints de distribución física de mesas para el mozo en sala")
@RestController
@RequestMapping("/api/v1")
public class MesaController {

    private final MesaService mesaService;

    public MesaController(MesaService mesaService) {
        this.mesaService = mesaService;
    }

    @Operation(summary = "Listar zonas con sus mesas agrupadas para el comandero")
    @GetMapping("/zonas")
    public ResponseEntity<List<ZonaDto>> listarZonasConMesas() {
        return ResponseEntity.ok(mesaService.listarZonasConMesas());
    }

    @Operation(summary = "Listar todas las zonas y mesas, incluidas las inactivas (Admin, HU040)")
    @PreAuthorize("hasRole('ADMIN')")
    @GetMapping("/zonas/todas")
    public ResponseEntity<List<ZonaDto>> listarZonasAdmin() {
        return ResponseEntity.ok(mesaService.listarZonasAdmin());
    }

    @Operation(summary = "Registrar una zona del salón (Admin, HU040)")
    @PreAuthorize("hasRole('ADMIN')")
    @PostMapping("/zonas")
    public ResponseEntity<ZonaDto> crearZona(@Valid @RequestBody GuardarZonaRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(mesaService.crearZona(request.getNombre(), request.getDescripcion()));
    }

    @Operation(summary = "Editar el nombre y la descripción de una zona (Admin, HU040)")
    @PreAuthorize("hasRole('ADMIN')")
    @PutMapping("/zonas/{id}")
    public ResponseEntity<ZonaDto> editarZona(@PathVariable Long id, @Valid @RequestBody GuardarZonaRequest request) {
        return ResponseEntity.ok(mesaService.editarZona(id, request.getNombre(), request.getDescripcion()));
    }

    @Operation(summary = "Desactivar o reactivar una zona (Admin, HU040)")
    @PreAuthorize("hasRole('ADMIN')")
    @PatchMapping("/zonas/{id}/estado")
    public ResponseEntity<ZonaDto> cambiarEstadoZona(@PathVariable Long id, @Valid @RequestBody CambiarActivoRequest request) {
        return ResponseEntity.ok(mesaService.cambiarEstadoZona(id, request.getActivo()));
    }

    @Operation(summary = "Listar todas las mesas activas del restaurante")
    @GetMapping("/mesas")
    public ResponseEntity<List<MesaDto>> listarMesas() {
        return ResponseEntity.ok(mesaService.listarMesas());
    }

    @Operation(summary = "Registrar nueva mesa en una zona (Admin)")
    @PreAuthorize("hasRole('ADMIN')")
    @PostMapping("/mesas")
    public ResponseEntity<MesaDto> crearMesa(@Valid @RequestBody CrearMesaRequest request) {
        MesaDto creada = mesaService.crearMesa(request.getZonaId(), request.getNumeroMesa(), request.getCapacidad());
        return ResponseEntity.status(HttpStatus.CREATED).body(creada);
    }

    // Los datos editables de una mesa son los mismos que al crearla: zona, número y capacidad
    @Operation(summary = "Editar el número, la capacidad o la zona de una mesa (Admin, HU041)")
    @PreAuthorize("hasRole('ADMIN')")
    @PutMapping("/mesas/{id}")
    public ResponseEntity<MesaDto> editarMesa(@PathVariable Long id, @Valid @RequestBody CrearMesaRequest request) {
        return ResponseEntity.ok(mesaService.editarMesa(id, request.getZonaId(), request.getNumeroMesa(), request.getCapacidad()));
    }

    @Operation(summary = "Desactivar o reactivar una mesa (Admin, HU041)")
    @PreAuthorize("hasRole('ADMIN')")
    @PatchMapping("/mesas/{id}/estado")
    public ResponseEntity<MesaDto> cambiarEstadoMesa(@PathVariable Long id, @Valid @RequestBody CambiarActivoRequest request) {
        return ResponseEntity.ok(mesaService.cambiarEstadoMesa(id, request.getActivo()));
    }
}
