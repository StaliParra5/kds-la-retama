package pe.isil.kds;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import pe.isil.kds.dto.MermasConsultaDto;
import pe.isil.kds.model.EstadoItem;
import pe.isil.kds.model.Merma;
import pe.isil.kds.model.MotivoAnulacion;
import pe.isil.kds.repository.MermaRepository;
import pe.isil.kds.service.MermaService;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/**
 * HU032 Escenario 2 (D10): las mermas se consultan por rango de fechas con sus totales.
 */
@ExtendWith(MockitoExtension.class)
class MermaServiceTest {

    @Mock
    private MermaRepository mermaRepository;

    @InjectMocks
    private MermaService service;

    @Test
    @DisplayName("HU032 Escenario 2: Sin fechas se consultan las mermas de hoy, de las 00:00 a las 00:00 de mañana")
    void sinFechas_ConsultaHoy() {
        MermasConsultaDto resultado = service.consultar(null, null);

        assertEquals(LocalDate.now(), resultado.desde());
        assertEquals(LocalDate.now(), resultado.hasta());
        assertRango(LocalDate.now().atStartOfDay(), LocalDate.now().plusDays(1).atStartOfDay());
        assertEquals(0, resultado.totalRegistros());
        assertEquals(0, BigDecimal.ZERO.compareTo(resultado.montoTotal()));
    }

    @Test
    @DisplayName("HU032 Escenario 2: El rango es inclusivo en ambas fechas y trae el detalle con totales")
    void rangoInclusivo_ConTotales() {
        when(mermaRepository.findByCreatedAtGreaterThanEqualAndCreatedAtLessThanOrderByCreatedAtDescIdDesc(any(), any()))
                .thenReturn(List.of(
                        merma(2L, "Lomo Saltado", 2, "64.00", EstadoItem.EN_PREPARACION, MotivoAnulacion.PLATO_CON_DEFECTO),
                        merma(1L, "Causa Limeña", 1, "18.50", EstadoItem.LISTO, MotivoAnulacion.CLIENTE_SE_RETIRO)));

        MermasConsultaDto resultado = service.consultar("2026-11-10", "2026-11-12");

        assertRango(LocalDate.of(2026, 11, 10).atStartOfDay(), LocalDate.of(2026, 11, 13).atStartOfDay());
        assertEquals(2, resultado.totalRegistros());
        assertEquals(3, resultado.totalPorciones());
        assertEquals(0, new BigDecimal("82.50").compareTo(resultado.montoTotal()));
        var primera = resultado.mermas().get(0);
        assertEquals("Lomo Saltado", primera.platoNombre());
        assertEquals("Plancha", primera.estacionNombre());
        assertEquals("EN_PREPARACION", primera.estadoAlAnular());
        assertEquals("PLATO_CON_DEFECTO", primera.motivoCodigo());
        assertEquals("Plato con defecto", primera.motivo());
        assertEquals("Angie Valencia", primera.responsable());
        assertEquals("CMD-261112-0001", primera.codigoPedido());
    }

    @Test
    @DisplayName("HU032: Con una sola fecha se consulta ese único día")
    void unaSolaFecha_ConsultaEseDia() {
        assertEquals(LocalDate.of(2026, 11, 5), service.consultar("2026-11-05", null).hasta());
        assertEquals(LocalDate.of(2026, 11, 6), service.consultar(null, "2026-11-06").desde());
    }

    @Test
    @DisplayName("HU032: Un rango invertido, demasiado largo o con fechas mal escritas es un error del cliente")
    void rangosInvalidos_SonRechazados() {
        assertThrows(IllegalArgumentException.class, () -> service.consultar("2026-11-12", "2026-11-10"));
        assertThrows(IllegalArgumentException.class, () -> service.consultar("2024-01-01", "2026-01-01"));
        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class, () -> service.consultar("12/11/2026", null));
        assertTrue(ex.getMessage().contains("AAAA-MM-DD"));
        assertThrows(IllegalArgumentException.class, () -> service.consultar("2026-02-30", null));
        verifyNoInteractions(mermaRepository);
    }

    private void assertRango(LocalDateTime desde, LocalDateTime hasta) {
        ArgumentCaptor<LocalDateTime> desdeCaptor = ArgumentCaptor.forClass(LocalDateTime.class);
        ArgumentCaptor<LocalDateTime> hastaCaptor = ArgumentCaptor.forClass(LocalDateTime.class);
        verify(mermaRepository, atLeastOnce())
                .findByCreatedAtGreaterThanEqualAndCreatedAtLessThanOrderByCreatedAtDescIdDesc(
                        desdeCaptor.capture(), hastaCaptor.capture());
        assertEquals(desde, desdeCaptor.getValue());
        assertEquals(hasta, hastaCaptor.getValue());
    }

    private static Merma merma(Long itemId, String plato, int cantidad, String monto, EstadoItem estado, MotivoAnulacion motivo) {
        Merma m = new Merma();
        m.setDetallePedidoId(itemId);
        m.setPedidoId(99L);
        m.setCodigoPedido("CMD-261112-0001");
        m.setPlatoNombre(plato);
        m.setEstacionId(1L);
        m.setEstacionNombre("Plancha");
        m.setCantidad(cantidad);
        m.setMonto(new BigDecimal(monto));
        m.setEstadoAlAnular(estado);
        m.setMotivo(motivo);
        m.setResponsableId(10L);
        m.setResponsableNombre("Angie Valencia");
        return m;
    }
}
