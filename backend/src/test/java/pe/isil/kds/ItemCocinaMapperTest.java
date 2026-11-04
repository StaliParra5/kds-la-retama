package pe.isil.kds;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import pe.isil.kds.dto.ItemCocinaDto;
import pe.isil.kds.model.CanalVenta;
import pe.isil.kds.model.DetallePedido;
import pe.isil.kds.model.Estacion;
import pe.isil.kds.model.EstadoItem;
import pe.isil.kds.model.Pedido;
import pe.isil.kds.model.Plato;
import pe.isil.kds.service.ItemCocinaMapper;

import java.math.BigDecimal;

import static org.junit.jupiter.api.Assertions.*;

class ItemCocinaMapperTest {

    private final Estacion plancha = estacion(1L, "Plancha");
    private final Estacion frios = estacion(2L, "Fríos");
    private Pedido pedido;

    @BeforeEach
    void setUp() {
        CanalVenta salon = new CanalVenta();
        salon.setCodigo("SALON");
        salon.setNombre("Salón");
        salon.setSlaObjetivoMinutos(15);
        pedido = new Pedido();
        pedido.setId(7L);
        pedido.setCodigoCorrelativo("CMD-261103-0007");
        pedido.setCanal(salon);
    }

    @Test
    @DisplayName("HU012 Escenario 2: Cada ítem lleva el código del pedido al que pertenece")
    void item_LlevaCodigoDelPedido() {
        DetallePedido lomo = item(1L, "Lomo Saltado", plancha);
        pedido.addItem(lomo);

        ItemCocinaDto dto = ItemCocinaMapper.aDto(lomo);

        assertEquals("CMD-261103-0007", dto.getCodigoPedido());
        assertEquals(7L, dto.getPedidoId());
        assertEquals("Salón", dto.getCanalNombre());
    }

    @Test
    @DisplayName("HU012 Escenario 3: Dos platos de Plancha del mismo pedido comparten la clave de agrupación")
    void dosItemsMismaEstacion_MismoPedido() {
        DetallePedido lomo = item(1L, "Lomo Saltado", plancha);
        DetallePedido tallarin = item(2L, "Tallarín Saltado", plancha);
        pedido.addItem(lomo);
        pedido.addItem(tallarin);

        ItemCocinaDto a = ItemCocinaMapper.aDto(lomo);
        ItemCocinaDto b = ItemCocinaMapper.aDto(tallarin);

        assertEquals(a.getPedidoId(), b.getPedidoId());
        assertEquals(a.getCodigoPedido(), b.getCodigoPedido());
        assertEquals(0, a.getItemsEnOtrasEstaciones());
    }

    @Test
    @DisplayName("HU012 Escenario 4: El ítem informa cuántos ítems vigentes tiene el pedido en otras estaciones")
    void itemsEnOtrasEstaciones_SinContarAnulados() {
        DetallePedido lomo = item(1L, "Lomo Saltado", plancha);
        DetallePedido causa = item(2L, "Causa Limeña", frios);
        DetallePedido ceviche = item(3L, "Ceviche", frios);
        DetallePedido anulado = item(4L, "Leche de Tigre", frios);
        anulado.setEstadoItem(EstadoItem.ANULADO);
        pedido.addItem(lomo);
        pedido.addItem(causa);
        pedido.addItem(ceviche);
        pedido.addItem(anulado);

        assertEquals(2, ItemCocinaMapper.aDto(lomo).getItemsEnOtrasEstaciones());
        assertEquals(1, ItemCocinaMapper.aDto(causa).getItemsEnOtrasEstaciones());
    }

    private static Estacion estacion(Long id, String nombre) {
        Estacion e = new Estacion();
        e.setId(id);
        e.setNombre(nombre);
        return e;
    }

    private static DetallePedido item(Long id, String nombre, Estacion estacion) {
        Plato plato = new Plato();
        plato.setNombre(nombre);
        DetallePedido d = new DetallePedido();
        d.setId(id);
        d.setPlato(plato);
        d.setEstacion(estacion);
        d.setCantidad(1);
        d.setPrecioUnitario(BigDecimal.TEN);
        d.setSubtotal(BigDecimal.TEN);
        d.setTiempoEstandarMinutos(10);
        return d;
    }
}
