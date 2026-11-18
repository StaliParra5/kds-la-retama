package pe.isil.kds.controller;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import pe.isil.kds.dto.SalonDto;
import pe.isil.kds.dto.SemaforoDto;
import pe.isil.kds.service.SalonService;

/**
 * Controlador de la Vista de Salón y del semáforo de mesas (HU047, HU048). Exclusivo del administrador.
 */
@Tag(name = "Salón", description = "Vista de salón por zonas y configuración del semáforo de mesas (HU047, HU048)")
@RestController
@RequestMapping("/api/v1/salon")
@PreAuthorize("hasRole('ADMIN')")
public class SalonController {

    private final SalonService salonService;

    public SalonController(SalonService salonService) {
        this.salonService = salonService;
    }

    @Operation(summary = "Mesas activas por zona con su color de semáforo, mozos de la zona y datos de la atención (HU048)")
    @GetMapping
    public ResponseEntity<SalonDto> vistaSalon() {
        return ResponseEntity.ok(salonService.vistaSalon());
    }

    @Operation(summary = "Umbrales vigentes del semáforo de mesas (HU047)")
    @GetMapping("/semaforo")
    public ResponseEntity<SemaforoDto> semaforo() {
        return ResponseEntity.ok(salonService.semaforo());
    }

    @Operation(summary = "Cambiar los minutos para amarillo y rojo (HU047)")
    @PutMapping("/semaforo")
    public ResponseEntity<SemaforoDto> actualizarSemaforo(@Valid @RequestBody SemaforoDto request) {
        return ResponseEntity.ok(salonService.actualizarSemaforo(request.getMinutosAmarillo(), request.getMinutosRojo()));
    }
}
