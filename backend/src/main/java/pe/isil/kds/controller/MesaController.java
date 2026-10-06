package pe.isil.kds.controller;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import pe.isil.kds.dto.MesaDto;
import pe.isil.kds.dto.ZonaDto;
import pe.isil.kds.service.MesaService;

import java.util.List;
import java.util.Map;

/**
 * Controlador de Zonas y Mesas de Salón (HU005).
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

    @Operation(summary = "Listar todas las mesas activas del restaurante")
    @GetMapping("/mesas")
    public ResponseEntity<List<MesaDto>> listarMesas() {
        return ResponseEntity.ok(mesaService.listarMesas());
    }

    @Operation(summary = "Registrar nueva mesa en una zona (Admin)")
    @PreAuthorize("hasRole('ADMIN')")
    @PostMapping("/mesas")
    public ResponseEntity<MesaDto> crearMesa(@jakarta.validation.Valid @RequestBody pe.isil.kds.dto.CrearMesaRequest request) {
        MesaDto creada = mesaService.crearMesa(request.getZonaId(), request.getNumeroMesa(), request.getCapacidad());
        return ResponseEntity.status(HttpStatus.CREATED).body(creada);
    }
}
