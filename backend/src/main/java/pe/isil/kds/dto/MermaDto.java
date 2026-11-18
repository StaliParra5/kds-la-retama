package pe.isil.kds.dto;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * Una merma registrada al anular un ítem que ya estaba En preparación o Listo (HU032).
 */
public record MermaDto(
        Long id,
        LocalDateTime fechaHora,
        Long pedidoId,
        String codigoPedido,
        Long itemId,
        String platoNombre,
        Long estacionId,
        String estacionNombre,
        Integer cantidad,
        BigDecimal monto,
        String estadoAlAnular,
        String motivoCodigo,
        String motivo,
        String responsable,
        // D36: administrador que autorizó la anulación (null en mermas previas a la regla)
        String autorizadoPor) {}
