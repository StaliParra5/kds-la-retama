package pe.isil.kds.controller;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import pe.isil.kds.dto.EstadoSistemaDto;
import pe.isil.kds.service.EstadoInternetService;

/**
 * Estado del sistema para las pantallas (HU018): por ahora, si el servidor tiene salida a internet.
 * Requiere sesión iniciada (cualquier rol).
 */
@Tag(name = "Sistema", description = "Salida a internet del servidor")
@RestController
@RequestMapping("/api/v1/sistema")
public class SistemaController {

    private final EstadoInternetService estadoInternet;

    public SistemaController(EstadoInternetService estadoInternet) {
        this.estadoInternet = estadoInternet;
    }

    @Operation(summary = "Saber si el servidor tiene salida a internet (HU018); null mientras no se comprobó")
    @GetMapping("/estado")
    public ResponseEntity<EstadoSistemaDto> estado() {
        return ResponseEntity.ok(estadoInternet.estado());
    }
}
