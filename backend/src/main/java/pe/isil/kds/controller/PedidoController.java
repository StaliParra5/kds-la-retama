package pe.isil.kds.controller;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import pe.isil.kds.dto.CrearPedidoRequest;
import pe.isil.kds.dto.PedidoResponse;
import pe.isil.kds.dto.TransicionDto;
import pe.isil.kds.service.PedidoService;
import pe.isil.kds.service.TrazabilidadService;

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
    private final TrazabilidadService trazabilidadService;

    public PedidoController(PedidoService pedidoService, TrazabilidadService trazabilidadService) {
        this.pedidoService = pedidoService;
        this.trazabilidadService = trazabilidadService;
    }

    @Operation(summary = "Registrar y enviar la comanda a cocina en una sola acción (HU006, HU009)")
    @PostMapping
    public ResponseEntity<PedidoResponse> abrirComanda(
            @Valid @RequestBody CrearPedidoRequest request,
            Authentication authentication) {
        if (authentication == null || !authentication.isAuthenticated()) {
            throw new org.springframework.security.authentication.BadCredentialsException("Debe contar con una sesión activa para abrir una comanda.");
        }
        String username = authentication.getName();
        try {
            // HU009 Esc. 2 y 5: una clave ya registrada devuelve el mismo pedido (200); uno nuevo responde 201
            PedidoService.ResultadoEnvio resultado = pedidoService.registrarComanda(request, username);
            return ResponseEntity.status(resultado.creado() ? HttpStatus.CREATED : HttpStatus.OK).body(resultado.pedido());
        } catch (DataIntegrityViolationException e) {
            // Envíos simultáneos con la misma clave: el que perdió la carrera devuelve el pedido del ganador
            if (request.getClaveIdempotencia() != null) {
                var ganador = pedidoService.resolverClaveExistente(request, username);
                if (ganador.isPresent()) {
                    return ResponseEntity.ok(ganador.get());
                }
            }
            throw e;
        }
    }

    @Operation(summary = "Consultar si un envío sin confirmación llegó al servidor, por su clave (HU009)")
    @GetMapping("/envio/{clave}")
    public ResponseEntity<PedidoResponse> consultarEnvio(@PathVariable String clave, Authentication authentication) {
        return ResponseEntity.ok(pedidoService.consultarEnvio(clave, authentication.getName()));
    }

    @Operation(summary = "Obtener el detalle de una comanda por ID")
    @GetMapping("/{id}")
    public ResponseEntity<PedidoResponse> obtenerComanda(@PathVariable Long id) {
        return ResponseEntity.ok(pedidoService.obtenerPorId(id));
    }

    @Operation(summary = "Historial de transiciones de un pedido y sus ítems en orden cronológico (HU022, Admin)")
    @PreAuthorize("hasRole('ADMIN')")
    @GetMapping("/{id}/historial")
    public ResponseEntity<List<TransicionDto>> historial(@PathVariable Long id) {
        return ResponseEntity.ok(trazabilidadService.historialPedido(id));
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
