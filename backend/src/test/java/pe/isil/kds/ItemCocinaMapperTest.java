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
import java.time.LocalDateTime;
import java.time.ZoneId;

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
    @DisplayName("HU021 Escenario 3: Un pedido de salón lleva zona y mesa para el destino de la tarjeta")
    void salon_LlevaZonaYMesa() {
        pe.isil.kds.model.Zona zona = new pe.isil.kds.model.Zona();
        zona.setNombre("Terraza");
        pe.isil.kds.model.Mesa mesa = new pe.isil.kds.model.Mesa();
        mesa.setNumeroMesa("03");
        mesa.setZona(zona);
        pedido.setMesa(mesa);
        DetallePedido lomo = item(1L, "Lomo Saltado", plancha);
        pedido.addItem(lomo);

        ItemCocinaDto dto = ItemCocinaMapper.aDto(lomo);

        assertEquals("Terraza", dto.getZonaNombre());
        assertEquals("03", dto.getMesaNumero());
    }

    @Test
    @DisplayName("HU021 Escenario 4: El ítem informa si su pedido es una adición (0 = comanda original)")
    void adicion_SeInforma() {
        DetallePedido lomo = item(1L, "Lomo Saltado", plancha);
        pedido.addItem(lomo);
        assertEquals(0, ItemCocinaMapper.aDto(lomo).getNumeroAdicion());

        pedido.setNumeroAdicion(2);
        assertEquals(2, ItemCocinaMapper.aDto(lomo).getNumeroAdicion());
    }

    @Test
    @DisplayName("HU021 Escenario 6: El envío a cocina viaja como instante absoluto, igual para cualquier PC")
    void envioCocina_ComoInstanteAbsoluto() {
        LocalDateTime envio = LocalDateTime.of(2026, 11, 16, 12, 30, 15);
        pedido.setFechaEnvioCocina(envio);
        DetallePedido lomo = item(1L, "Lomo Saltado", plancha);
        pedido.addItem(lomo);

        ItemCocinaDto dto = ItemCocinaMapper.aDto(lomo);

        assertEquals(envio.atZone(ZoneId.systemDefault()).toInstant().toEpochMilli(), dto.getEnvioCocinaEpochMs());
        pedido.setFechaEnvioCocina(null);
        assertNull(ItemCocinaMapper.aDto(lomo).getEnvioCocinaEpochMs());
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

    @Test
    @DisplayName("D9: El ítem informa cuántos ítems del pedido siguen en cocina en cualquier estación")
    void itemsPendientesPedido_CuentaLosQueSiguenEnCocina() {
        DetallePedido lomo = item(1L, "Lomo Saltado", plancha);
        lomo.setEstadoItem(EstadoItem.LISTO);
        DetallePedido causa = item(2L, "Causa Limeña", frios);
        DetallePedido ceviche = item(3L, "Ceviche", frios);
        ceviche.setEstadoItem(EstadoItem.EN_PREPARACION);
        DetallePedido despachado = item(4L, "Chicha", frios);
        despachado.setEstadoItem(EstadoItem.DESPACHADO);
        pedido.addItem(lomo);
        pedido.addItem(causa);
        pedido.addItem(ceviche);
        pedido.addItem(despachado);

        assertEquals(2, ItemCocinaMapper.aDto(lomo).getItemsPendientesPedido());
    }
}
