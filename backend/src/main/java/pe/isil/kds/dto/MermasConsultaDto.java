package pe.isil.kds.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

/**
 * Resultado de consultar las mermas de un rango de fechas, con sus totales (HU032, D10).
 */
public record MermasConsultaDto(
        LocalDate desde,
        LocalDate hasta,
        int totalRegistros,
        int totalPorciones,
        BigDecimal montoTotal,
        List<MermaDto> mermas) {}
