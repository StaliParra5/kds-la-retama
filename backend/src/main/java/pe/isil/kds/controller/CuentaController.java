package pe.isil.kds.controller;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import pe.isil.kds.dto.ClaveAutorizacionEstadoDto;
import pe.isil.kds.dto.ClaveAutorizacionRequest;
import pe.isil.kds.service.CuentaService;

/**
 * Datos de la propia cuenta (HU049). La identidad sale siempre de la sesión: un administrador solo puede
 * configurar su propia clave, nunca la de otro.
 */
@Tag(name = "Mi cuenta", description = "Clave de autorización del administrador")
@RestController
@RequestMapping("/api/v1/cuenta")
@PreAuthorize("hasRole('ADMIN')")
public class CuentaController {

    private final CuentaService cuentaService;

    public CuentaController(CuentaService cuentaService) {
        this.cuentaService = cuentaService;
    }

    @Operation(summary = "Saber si el administrador ya configuró su clave de autorización (HU049)")
    @GetMapping("/clave-autorizacion")
    public ResponseEntity<ClaveAutorizacionEstadoDto> estadoClave(Authentication authentication) {
        return ResponseEntity.ok(cuentaService.estadoClaveAutorizacion(authentication.getName()));
    }

    @Operation(summary = "Crear o cambiar la clave de autorización (6 dígitos), confirmando con la contraseña de la cuenta (HU049)")
    @PutMapping("/clave-autorizacion")
    public ResponseEntity<ClaveAutorizacionEstadoDto> configurarClave(
            @Valid @RequestBody ClaveAutorizacionRequest request,
            Authentication authentication) {
        return ResponseEntity.ok(cuentaService.configurarClaveAutorizacion(
                authentication.getName(), request.getPasswordActual(), request.getClave()));
    }
}
