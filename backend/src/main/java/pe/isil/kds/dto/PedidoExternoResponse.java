package pe.isil.kds.dto;

/**
 * Respuesta del punto de integración al aceptar un pedido externo (HU019 Esc. 1): el identificador interno
 * para que el sistema de origen pueda consultarlo o correlacionarlo.
 */
public record PedidoExternoResponse(
        Long pedidoId,
        String codigoPedido,
        String canal,
        String numeroOrden,
        String estado) {}
