package pe.isil.kds.controller;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import pe.isil.kds.dto.ConfiguracionCocinaDto;
import pe.isil.kds.service.ConfiguracionCocinaService;

/**
 * Configuración de cocina (HU033). La consulta es para cualquier usuario con sesión (la pantalla de estación la
 * necesita para mostrar la cuenta regresiva de "Deshacer"); el cambio, solo para el administrador.
 */
@Tag(name = "Configuración de cocina", description = "Ventana para deshacer cambios de estado")
@RestController
@RequestMapping("/api/v1/configuracion/cocina")
public class ConfiguracionCocinaController {

    private final ConfiguracionCocinaService service;

    public ConfiguracionCocinaController(ConfiguracionCocinaService service) {
        this.service = service;
    }

    @Operation(summary = "Ventana en segundos para deshacer el último cambio de estado (HU033)")
    @GetMapping
    public ResponseEntity<ConfiguracionCocinaDto> obtener() {
        return ResponseEntity.ok(service.obtener());
    }

    @Operation(summary = "Cambiar la ventana para deshacer, entre 5 y 120 segundos (HU033, Admin)")
    @PreAuthorize("hasRole('ADMIN')")
    @PutMapping
    public ResponseEntity<ConfiguracionCocinaDto> actualizar(@Valid @RequestBody ConfiguracionCocinaDto request) {
        return ResponseEntity.ok(service.actualizar(request.getVentanaRecallSegundos()));
    }
}
