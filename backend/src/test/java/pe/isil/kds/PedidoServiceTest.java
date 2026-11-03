package pe.isil.kds;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import pe.isil.kds.dto.CrearPedidoRequest;
import pe.isil.kds.dto.ItemPedidoRequest;
import pe.isil.kds.dto.PedidoResponse;
import pe.isil.kds.exception.OperacionNoPermitidaException;
import pe.isil.kds.model.*;
import pe.isil.kds.repository.*;
import pe.isil.kds.service.PedidoService;
import pe.isil.kds.service.TrazabilidadService;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class PedidoServiceTest {

    @Mock
    private PedidoRepository pedidoRepository;

    @Mock
    private CanalVentaRepository canalRepository;

    @Mock
    private MesaRepository mesaRepository;

    @Mock
    private PlatoRepository platoRepository;

    @Mock
    private UsuarioRepository usuarioRepository;

    @Mock
    private TrazabilidadService trazabilidadService;

    @Mock
    private SimpMessagingTemplate messagingTemplate;

    @InjectMocks
    private PedidoService pedidoService;

    private CanalVenta canalSalon;
    private CanalVenta canalDelivery;
    private Mesa mesa08;
    private Usuario mozo;
    private Plato plato;

    @BeforeEach
    void setUp() {
        canalSalon = new CanalVenta();
        canalSalon.setId(1L);
        canalSalon.setCodigo("SALON");
        canalSalon.setNombre("Salón");

        canalDelivery = new CanalVenta();
        canalDelivery.setId(2L);
        canalDelivery.setCodigo("DELIVERY");
        canalDelivery.setNombre("Delivery");

        mesa08 = new Mesa();
        mesa08.setId(8L);
        mesa08.setNumeroMesa("08");

        mozo = new Usuario();
        mozo.setId(10L);
        mozo.setUsername("angie");
        mozo.setNombre("Angie");
        mozo.setApellido("Valencia");

        Estacion estacion = new Estacion();
        estacion.setId(1L);
        estacion.setNombre("Plancha");

        plato = new Plato();
        plato.setId(50L);
        plato.setNombre("Lomo Saltado");
        plato.setPrecio(new BigDecimal("32.00"));
        plato.setTiempoEstandarMinutos(12);
        plato.setEstacion(estacion);
    }

    @Test
    @DisplayName("HU006 Escenario 2: Comanda de salón sin mesa asignada es rechazada")
    void crearComanda_SalonSinMesa_EsRechazada() {
        CrearPedidoRequest req = new CrearPedidoRequest();
        req.setCanalId(1L);
        req.setMesaId(null);
        req.setItems(List.of(new ItemPedidoRequest(50L, 2, "Sin cebolla")));

        when(canalRepository.findById(1L)).thenReturn(Optional.of(canalSalon));

        assertThrows(IllegalArgumentException.class, () ->
                pedidoService.crearComanda(req, "angie"));

        verify(pedidoRepository, never()).save(any());
    }

    @Test
    @DisplayName("HU006 Escenario 1: Apertura de comanda exitosa con correlativo y cálculo de total")
    void crearComanda_SalonValida_Exitoso() {
        CrearPedidoRequest req = new CrearPedidoRequest();
        req.setCanalId(1L);
        req.setMesaId(8L);
        req.setItems(List.of(new ItemPedidoRequest(50L, 2, "Sin cebolla")));

        when(canalRepository.findById(1L)).thenReturn(Optional.of(canalSalon));
        when(mesaRepository.findById(8L)).thenReturn(Optional.of(mesa08));
        when(usuarioRepository.findByUsername("angie")).thenReturn(Optional.of(mozo));
        when(platoRepository.findById(50L)).thenReturn(Optional.of(plato));
        when(pedidoRepository.obtenerSiguienteValorSecuencia()).thenReturn(5L);

        when(pedidoRepository.save(any(Pedido.class))).thenAnswer(invocation -> {
            Pedido p = invocation.getArgument(0);
            p.setId(99L);
            return p;
        });

        PedidoResponse response = pedidoService.crearComanda(req, "angie");

        assertNotNull(response);
        assertEquals(99L, response.getId());
        assertTrue(response.getCodigoCorrelativo().startsWith("CMD-"));
        assertTrue(response.getCodigoCorrelativo().endsWith("-0005"));
        assertEquals("08", response.getMesaNumero());
        assertEquals("SALON", response.getCanalCodigo());
        assertEquals(new BigDecimal("64.00"), response.getTotal());
        assertEquals(1, response.getItems().size());
        assertEquals("Lomo Saltado", response.getItems().get(0).getPlatoNombre());

        verify(trazabilidadService, times(1)).registrarPedido(any(Pedido.class), isNull(), eq("ENVIADO"), eq(mozo), anyString());
        // HU013 Escenario 3: cada ítem se registra en estado RECIBIDO
        verify(trazabilidadService, times(1)).registrarItem(any(DetallePedido.class), isNull(), eq("RECIBIDO"), eq(mozo), isNull());
        assertEquals("ENVIADO", response.getEstado());
        assertNotNull(response.getCreatedAt());
        assertEquals("RECIBIDO", response.getItems().get(0).getEstadoItem());
    }

    @Test
    @DisplayName("HU006: Fallback de correlativo al conteo del día si la secuencia nativa no está disponible")
    void crearComanda_FallbackSecuencia_Exitoso() {
        CrearPedidoRequest req = new CrearPedidoRequest();
        req.setCanalId(1L);
        req.setMesaId(8L);
        req.setItems(List.of(new ItemPedidoRequest(50L, 1, null)));

        when(canalRepository.findById(1L)).thenReturn(Optional.of(canalSalon));
        when(mesaRepository.findById(8L)).thenReturn(Optional.of(mesa08));
        when(usuarioRepository.findByUsername("angie")).thenReturn(Optional.of(mozo));
        when(platoRepository.findById(50L)).thenReturn(Optional.of(plato));
        when(pedidoRepository.obtenerSiguienteValorSecuencia()).thenThrow(new RuntimeException("DB sequence unreachable"));
        when(pedidoRepository.countPedidosDesde(any(LocalDateTime.class))).thenReturn(7L);

        when(pedidoRepository.save(any(Pedido.class))).thenAnswer(invocation -> invocation.getArgument(0));

        PedidoResponse response = pedidoService.crearComanda(req, "angie");

        assertNotNull(response);
        assertTrue(response.getCodigoCorrelativo().endsWith("-0008"));
    }

    @Test
    @DisplayName("HU008 Escenario 3: Mismo plato con modificadores distintos se registra en detalles independientes")
    void crearComanda_MismoPlatoModificadoresDistintos_DetallesSeparados() {
        CrearPedidoRequest req = new CrearPedidoRequest();
        req.setCanalId(1L);
        req.setMesaId(8L);
        req.setItems(List.of(
                new ItemPedidoRequest(50L, 1, "Término medio"),
                new ItemPedidoRequest(50L, 2, "Bien cocido")));

        prepararAperturaValida();

        PedidoResponse response = pedidoService.crearComanda(req, "angie");

        assertEquals(2, response.getItems().size());
        assertEquals("Término medio", response.getItems().get(0).getModificadores());
        assertEquals(1, response.getItems().get(0).getCantidad());
        assertEquals("Bien cocido", response.getItems().get(1).getModificadores());
        assertEquals(2, response.getItems().get(1).getCantidad());
        assertEquals(new BigDecimal("96.00"), response.getTotal());
    }

    @Test
    @DisplayName("HU008 Escenario 4: Modificadores se guardan sin espacios sobrantes y vacíos como nulos")
    void crearComanda_ModificadoresNormalizados() {
        CrearPedidoRequest req = new CrearPedidoRequest();
        req.setCanalId(1L);
        req.setMesaId(8L);
        req.setItems(List.of(
                new ItemPedidoRequest(50L, 1, "  Sin cebolla  "),
                new ItemPedidoRequest(50L, 1, "   ")));

        prepararAperturaValida();

        PedidoResponse response = pedidoService.crearComanda(req, "angie");

        assertEquals("Sin cebolla", response.getItems().get(0).getModificadores());
        assertNull(response.getItems().get(1).getModificadores());
    }

    @Test
    @DisplayName("HU010 Escenario 4: Pedido con canal desactivado es rechazado indicando que no está activo")
    void crearComanda_CanalInactivo_EsRechazado() {
        canalDelivery.setActivo(false);
        CrearPedidoRequest req = new CrearPedidoRequest();
        req.setCanalId(2L);
        req.setItems(List.of(new ItemPedidoRequest(50L, 1, null)));

        when(canalRepository.findById(2L)).thenReturn(Optional.of(canalDelivery));

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class, () ->
                pedidoService.crearComanda(req, "angie"));

        assertTrue(ex.getMessage().contains("no está activo"));
        verify(pedidoRepository, never()).save(any());
    }

    @Test
    @DisplayName("HU010 Escenarios 3 y 6: El pedido queda con el canal de origen y su SLA visibles en el detalle")
    void crearComanda_CanalVisibleEnDetalle() {
        canalSalon.setSlaObjetivoMinutos(15);
        CrearPedidoRequest req = new CrearPedidoRequest();
        req.setCanalId(1L);
        req.setMesaId(8L);
        req.setItems(List.of(new ItemPedidoRequest(50L, 1, null)));

        prepararAperturaValida();

        PedidoResponse response = pedidoService.crearComanda(req, "angie");

        assertEquals(1L, response.getCanalId());
        assertEquals("SALON", response.getCanalCodigo());
        assertEquals("Salón", response.getCanalNombre());
        assertEquals(15, response.getCanalSlaMinutos());
    }

    @Test
    @DisplayName("HU010 Escenario 5: El canal de un pedido ya registrado no puede modificarse")
    void pedidoRegistrado_CambioDeCanal_NoPermitido() {
        Pedido pedido = new Pedido();
        pedido.setCanal(canalSalon);
        pedido.setId(99L);

        assertThrows(OperacionNoPermitidaException.class, () -> pedido.setCanal(canalDelivery));
        assertEquals("SALON", pedido.getCanal().getCodigo());
        // Reasignar el mismo canal no es un cambio y se permite
        assertDoesNotThrow(() -> pedido.setCanal(canalSalon));
    }

    private void prepararAperturaValida() {
        when(canalRepository.findById(1L)).thenReturn(Optional.of(canalSalon));
        when(mesaRepository.findById(8L)).thenReturn(Optional.of(mesa08));
        when(usuarioRepository.findByUsername("angie")).thenReturn(Optional.of(mozo));
        when(platoRepository.findById(anyLong())).thenReturn(Optional.of(plato));
        when(pedidoRepository.obtenerSiguienteValorSecuencia()).thenReturn(1L);
        when(pedidoRepository.save(any(Pedido.class))).thenAnswer(invocation -> invocation.getArgument(0));
    }
}
