package pe.isil.kds.controller;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import pe.isil.kds.dto.AuthRequest;
import pe.isil.kds.dto.AuthResponse;
import pe.isil.kds.dto.PinAuthRequest;
import pe.isil.kds.service.AuthService;

/**
 * Controlador de Autenticación y Sesiones (HU001).
 * Soporta ingreso administrativo (usuario/contraseña) e ingreso táctil con PIN en cocina y sala.
 */
@Tag(name = "Autenticación", description = "Endpoints de acceso y login por rol según HU001")
@RestController
@RequestMapping("/api/v1/auth")
public class AuthController {

    private final AuthService authService;

    public AuthController(AuthService authService) {
        this.authService = authService;
    }

    @Operation(summary = "Ingreso administrativo con usuario y contraseña (HU001 Escenario 2)")
    @PostMapping("/login-admin")
    public ResponseEntity<AuthResponse> loginAdmin(@Valid @RequestBody AuthRequest request) {
        AuthResponse response = authService.loginAdmin(request);
        return ResponseEntity.ok(response);
    }

    @Operation(summary = "Ingreso rápido en estación/cocina con PIN de 4 dígitos (HU001 Escenario 1)")
    @PostMapping("/login-pin")
    public ResponseEntity<AuthResponse> loginPin(@Valid @RequestBody PinAuthRequest request) {
        AuthResponse response = authService.loginPin(request);
        return ResponseEntity.ok(response);
    }

    @Operation(summary = "Obtener datos del usuario actualmente autenticado")
    @GetMapping("/me")
    public ResponseEntity<AuthResponse> obtenerUsuarioActual(Authentication authentication) {
        if (authentication == null || authentication.getName() == null) {
            return ResponseEntity.status(401).build();
        }
        AuthResponse response = authService.obtenerUsuarioPorUsername(authentication.getName());
        return ResponseEntity.ok(response);
    }
}
