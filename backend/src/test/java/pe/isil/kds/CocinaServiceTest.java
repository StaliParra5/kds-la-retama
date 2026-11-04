package pe.isil.kds;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.access.AccessDeniedException;
import pe.isil.kds.dto.ItemCocinaDto;
import pe.isil.kds.exception.RecursoNoEncontradoException;
import pe.isil.kds.model.CanalVenta;
import pe.isil.kds.model.DetallePedido;
import pe.isil.kds.model.Estacion;
import pe.isil.kds.model.EstadoItem;
import pe.isil.kds.model.Pedido;
import pe.isil.kds.model.Plato;
import pe.isil.kds.repository.DetallePedidoRepository;
import pe.isil.kds.repository.EstacionRepository;
import pe.isil.kds.security.SesionKds;
import pe.isil.kds.service.CocinaService;

import java.math.BigDecimal;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class CocinaServiceTest {

    @Mock
    private DetallePedidoRepository detalleRepository;

    @Mock
    private EstacionRepository estacionRepository;

    @InjectMocks
    private CocinaService service;

    @Test
    @DisplayName("HU011 Escenario 4: La pantalla que se conecta recupera de la BD los ítems pendientes de su estación")
    void cola_SoloEstadosPendientesDeLaEstacion() {
        when(estacionRepository.existsById(2L)).thenReturn(true);
        when(detalleRepository.findByEstacionIdAndEstadoItemInOrderByPedidoFechaEnvioCocinaAscIdAsc(eq(2L), anyList()))
                .thenReturn(List.of());

        service.colaDeEstacion(2L, new SesionKds("cocinero1", "COCINERO", 2L));

        verify(detalleRepository).findByEstacionIdAndEstadoItemInOrderByPedidoFechaEnvioCocinaAscIdAsc(2L,
                List.of(EstadoItem.RECIBIDO, EstadoItem.EN_ESPERA, EstadoItem.EN_PREPARACION));
    }

    @Test
    @DisplayName("HU011 Escenario 2 / D6: Un cocinero no consulta la cola de otra estación")
    void cola_OtraEstacion_Denegada() {
        when(estacionRepository.existsById(1L)).thenReturn(true);

        assertThrows(AccessDeniedException.class, () ->
                service.colaDeEstacion(1L, new SesionKds("cocinero1", "COCINERO", 2L)));
        verifyNoInteractions(detalleRepository);
    }

    @Test
    @DisplayName("HU011: El administrador consulta cualquier estación; una estación inexistente da 404")
    void cola_AdminYEstacionInexistente() {
        when(estacionRepository.existsById(1L)).thenReturn(true);
        when(estacionRepository.existsById(99L)).thenReturn(false);

        assertDoesNotThrow(() -> service.colaDeEstacion(1L, new SesionKds("admin", "ADMIN", null)));
        assertThrows(RecursoNoEncontradoException.class, () ->
                service.colaDeEstacion(99L, new SesionKds("admin", "ADMIN", null)));
    }

    @Test
    @DisplayName("HU012 Escenario 5: Un ítem Listo (o despachado/anulado) ya no forma parte de la cola activa")
    void cola_ExcluyeListoYFinales() {
        when(estacionRepository.existsById(2L)).thenReturn(true);

        service.colaDeEstacion(2L, new SesionKds("cocinero1", "COCINERO", 2L));

        verify(detalleRepository).findByEstacionIdAndEstadoItemInOrderByPedidoFechaEnvioCocinaAscIdAsc(eq(2L),
                argThat(estados -> !estados.contains(EstadoItem.LISTO)
                        && !estados.contains(EstadoItem.DESPACHADO)
                        && !estados.contains(EstadoItem.ANULADO)));
    }

    @Test
    @DisplayName("D9: El pase lista los ítems Listos de todas las estaciones, en orden y con lo que falta en cocina")
    void pase_ListaListosConPendientes() {
        CanalVenta salon = new CanalVenta();
        salon.setCodigo("SALON");
        salon.setNombre("Salón");
        Pedido pedido = new Pedido();
        pedido.setId(5L);
        pedido.setCodigoCorrelativo("CMD-261103-0005");
        pedido.setCanal(salon);
        DetallePedido causa = item(1L, "Causa", 2L, EstadoItem.LISTO);
        DetallePedido lomo = item(2L, "Lomo", 1L, EstadoItem.LISTO);
        DetallePedido arroz = item(3L, "Arroz", 3L, EstadoItem.EN_PREPARACION);
        pedido.addItem(causa);
        pedido.addItem(lomo);
        pedido.addItem(arroz);
        when(detalleRepository.findByEstadoItemOrderByPedidoFechaEnvioCocinaAscIdAsc(EstadoItem.LISTO))
                .thenReturn(List.of(causa, lomo));

        List<ItemCocinaDto> pase = service.listosParaPase();

        assertEquals(List.of(1L, 2L), pase.stream().map(ItemCocinaDto::getId).toList());
        assertTrue(pase.stream().allMatch(i -> "LISTO".equals(i.getEstado())));
        assertEquals(1, pase.get(0).getItemsPendientesPedido());
        assertEquals("CMD-261103-0005", pase.get(1).getCodigoPedido());
    }

    private static DetallePedido item(Long id, String nombre, Long estacionId, EstadoItem estado) {
        Estacion estacion = new Estacion();
        estacion.setId(estacionId);
        estacion.setNombre("E" + estacionId);
        Plato plato = new Plato();
        plato.setNombre(nombre);
        DetallePedido d = new DetallePedido();
        d.setId(id);
        d.setPlato(plato);
        d.setEstacion(estacion);
        d.setCantidad(1);
        d.setPrecioUnitario(BigDecimal.TEN);
        d.setSubtotal(BigDecimal.TEN);
        d.setEstadoItem(estado);
        return d;
    }
}
