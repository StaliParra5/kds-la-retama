package pe.isil.kds.service;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import pe.isil.kds.dto.MermaDto;
import pe.isil.kds.dto.MermasConsultaDto;
import pe.isil.kds.model.Merma;
import pe.isil.kds.repository.MermaRepository;

import java.math.BigDecimal;
import java.time.DateTimeException;
import java.time.LocalDate;
import java.util.List;

/**
 * Consulta de mermas por rango de fechas (HU032 Esc. 2, decisión D10: por ahora solo endpoint, sin pantalla).
 *
 * Reglas:
 * - Sin fechas se consulta el día de hoy; con solo una de ellas, ese único día.
 * - Las fechas son inclusivas y el rango máximo es de un año, para no cargar de golpe todo el historial.
 */
@Service
public class MermaService {

    static final int DIAS_MAXIMOS = 366;

    private final MermaRepository mermaRepository;

    public MermaService(MermaRepository mermaRepository) {
        this.mermaRepository = mermaRepository;
    }

    @Transactional(readOnly = true)
    public MermasConsultaDto consultar(String desdeTexto, String hastaTexto) {
        LocalDate desde = parsear(desdeTexto, "desde");
        LocalDate hasta = parsear(hastaTexto, "hasta");
        if (desde == null && hasta == null) {
            desde = LocalDate.now();
            hasta = desde;
        } else if (desde == null) {
            desde = hasta;
        } else if (hasta == null) {
            hasta = desde;
        }
        if (desde.isAfter(hasta)) {
            throw new IllegalArgumentException("La fecha 'desde' no puede ser posterior a la fecha 'hasta'.");
        }
        if (desde.plusDays(DIAS_MAXIMOS).isBefore(hasta)) {
            throw new IllegalArgumentException("El rango de fechas no puede superar " + DIAS_MAXIMOS + " días.");
        }

        List<Merma> mermas = mermaRepository.findByCreatedAtGreaterThanEqualAndCreatedAtLessThanOrderByCreatedAtDescIdDesc(
                desde.atStartOfDay(), hasta.plusDays(1).atStartOfDay());
        List<MermaDto> dtos = mermas.stream().map(MermaService::aDto).toList();
        return new MermasConsultaDto(
                desde, hasta, dtos.size(),
                mermas.stream().mapToInt(Merma::getCantidad).sum(),
                mermas.stream().map(Merma::getMonto).reduce(BigDecimal.ZERO, BigDecimal::add),
                dtos);
    }

    // Una fecha mal escrita es un error del cliente (400), no un fallo del servidor
    private static LocalDate parsear(String texto, String campo) {
        if (texto == null || texto.isBlank()) {
            return null;
        }
        try {
            return LocalDate.parse(texto.trim());
        } catch (DateTimeException e) {
            throw new IllegalArgumentException("La fecha '" + campo + "' debe tener el formato AAAA-MM-DD.");
        }
    }

    static MermaDto aDto(Merma m) {
        return new MermaDto(
                m.getId(), m.getCreatedAt(), m.getPedidoId(), m.getCodigoPedido(), m.getDetallePedidoId(),
                m.getPlatoNombre(), m.getEstacionId(), m.getEstacionNombre(), m.getCantidad(), m.getMonto(),
                m.getEstadoAlAnular().name(), m.getMotivo().name(), m.getMotivo().etiqueta(), m.getResponsableNombre(),
                m.getAutorizadoPorNombre());
    }
}
