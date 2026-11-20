package pe.isil.kds.controller;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import pe.isil.kds.dto.ActualizarAparienciaCanalRequest;
import pe.isil.kds.dto.ActualizarSlaRequest;
import pe.isil.kds.dto.CambiarEstadoCanalRequest;
import pe.isil.kds.dto.CanalDto;
import pe.isil.kds.service.CanalService;

import java.util.List;

/**
 * Controlador de Canales de Venta y SLAs (RF-CFG-04).
 */
@Tag(name = "Canales de Venta", description = "Endpoints de configuración de orígenes de pedidos y SLAs")
@RestController
@RequestMapping("/api/v1/canales")
public class CanalController {

    private final CanalService canalService;

    public CanalController(CanalService canalService) {
        this.canalService = canalService;
    }

    @Operation(summary = "Listar canales de venta activos y sus SLAs")
    @GetMapping
    public ResponseEntity<List<CanalDto>> listarCanales() {
        return ResponseEntity.ok(canalService.listarCanales(false));
    }

    @Operation(summary = "Listar todos los canales de venta, incluidos los inactivos (Admin)")
    @PreAuthorize("hasRole('ADMIN')")
    @GetMapping("/todos")
    public ResponseEntity<List<CanalDto>> listarTodosLosCanales() {
        return ResponseEntity.ok(canalService.listarCanales(true));
    }

    @Operation(summary = "Activar o desactivar un canal de venta (Admin)")
    @PreAuthorize("hasRole('ADMIN')")
    @PatchMapping("/{id}/estado")
    public ResponseEntity<CanalDto> cambiarEstado(
            @PathVariable Long id,
            @Valid @RequestBody CambiarEstadoCanalRequest request) {
        return ResponseEntity.ok(canalService.cambiarEstado(id, request.getActivo()));
    }

    @Operation(summary = "Actualizar el SLA de un canal y, opcionalmente, su umbral ámbar en % del SLA (HU037, HU025, Admin)")
    @PreAuthorize("hasRole('ADMIN')")
    @PutMapping("/{id}/sla")
    public ResponseEntity<CanalDto> actualizarSla(
            @PathVariable Long id,
            @Valid @RequestBody ActualizarSlaRequest request) {
        CanalDto actualizado = canalService.actualizarSla(id, request.getSlaObjetivoMinutos(), request.getUmbralAmbarPorcentaje());
        return ResponseEntity.ok(actualizado);
    }

    @Operation(summary = "Cambiar el color y el ícono de un canal; el color no puede parecerse al semáforo ni a otro canal activo (HU015, Admin)")
    @PreAuthorize("hasRole('ADMIN')")
    @PutMapping("/{id}/apariencia")
    public ResponseEntity<CanalDto> actualizarApariencia(
            @PathVariable Long id,
            @Valid @RequestBody ActualizarAparienciaCanalRequest request) {
        return ResponseEntity.ok(canalService.actualizarApariencia(id, request.getColor(), request.getIcono()));
    }
}
