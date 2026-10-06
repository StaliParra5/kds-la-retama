package pe.isil.kds.controller;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import pe.isil.kds.dto.CrearPedidoRequest;
import pe.isil.kds.dto.PedidoResponse;
import pe.isil.kds.service.PedidoService;

import java.util.List;
import java.util.Map;

/**
 * Controlador de Comandas y Pedidos en Sala (HU006 & HU007).
 */
@Tag(name = "Comandas y Pedidos", description = "Endpoints de apertura y gestión de pedidos desde el comandero")
@RestController
@RequestMapping("/api/v1/pedidos")
public class PedidoController {

    private final PedidoService pedidoService;

    public PedidoController(PedidoService pedidoService) {
        this.pedidoService = pedidoService;
    }

    @Operation(summary = "Abrir nueva comanda desde el comandero de sala (HU006)")
    @PostMapping
    public ResponseEntity<PedidoResponse> abrirComanda(
            @Valid @RequestBody CrearPedidoRequest request,
            Authentication authentication) {
        if (authentication == null || !authentication.isAuthenticated()) {
            throw new org.springframework.security.authentication.BadCredentialsException("Debe contar con una sesión activa para abrir una comanda.");
        }
        String username = authentication.getName();
        PedidoResponse creada = pedidoService.crearComanda(request, username);
        return ResponseEntity.status(HttpStatus.CREATED).body(creada);
    }

    @Operation(summary = "Obtener el detalle de una comanda por ID")
    @GetMapping("/{id}")
    public ResponseEntity<PedidoResponse> obtenerComanda(@PathVariable Long id) {
        return ResponseEntity.ok(pedidoService.obtenerPorId(id));
    }

    @Operation(summary = "Listar todas las comandas activas del restaurante")
    @GetMapping("/activos")
    public ResponseEntity<List<PedidoResponse>> listarPedidosActivos() {
        return ResponseEntity.ok(pedidoService.listarPedidosActivos());
    }

    @Operation(summary = "Obtener sugerencia del siguiente correlativo diario único (HU006)")
    @GetMapping("/correlativo-siguiente")
    public ResponseEntity<Map<String, String>> obtenerSiguienteCorrelativo() {
        String correlativo = pedidoService.obtenerSiguienteCorrelativoSugerido();
        return ResponseEntity.ok(Map.of("codigoCorrelativo", correlativo));
    }
}
