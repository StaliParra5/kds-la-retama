package pe.isil.kds.controller;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import pe.isil.kds.dto.PedidoExternoRequest;
import pe.isil.kds.dto.PedidoExternoResponse;
import pe.isil.kds.service.PedidoExternoService;

/**
 * Punto de integración REST para pedidos de canales externos (HU019).
 *
 * No usa sesión de usuario: cada solicitud debe traer la clave de integración en el encabezado X-Api-Key,
 * que valida IntegracionApiKeyFilter antes de llegar al controlador.
 */
@Tag(name = "Integración de pedidos externos", description = "Recepción de pedidos de agregadores y otros canales (requiere X-Api-Key)")
@RestController
@RequestMapping("/api/v1/integracion")
@PreAuthorize("hasRole('INTEGRACION')")
public class IntegracionController {

    private final PedidoExternoService pedidoExternoService;

    public IntegracionController(PedidoExternoService pedidoExternoService) {
        this.pedidoExternoService = pedidoExternoService;
    }

    @Operation(summary = "Recibir un pedido de un canal externo y enviarlo a cocina (HU019); 201 si es nuevo, 200 con el "
            + "identificador existente si es un reenvío igual y 409 si es un reenvío con otros ítems (HU034)")
    @PostMapping("/pedidos")
    public ResponseEntity<PedidoExternoResponse> recibirPedido(@RequestBody PedidoExternoRequest request) {
        // La validación del payload la hace el servicio para informar todos los errores juntos
        PedidoExternoService.Resultado resultado = pedidoExternoService.registrar(request);
        return ResponseEntity.status(resultado.creado() ? HttpStatus.CREATED : HttpStatus.OK).body(resultado.respuesta());
    }
}
