package pe.isil.kds;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.security.access.AccessDeniedException;
import pe.isil.kds.dto.CambiarEstadoItemRequest;
import pe.isil.kds.dto.ItemCocinaDto;
import pe.isil.kds.exception.EstadoDesactualizadoException;
import pe.isil.kds.exception.OperacionNoPermitidaException;
import pe.isil.kds.model.*;
import pe.isil.kds.repository.DetallePedidoRepository;
import pe.isil.kds.repository.PedidoRepository;
import pe.isil.kds.repository.UsuarioRepository;
import pe.isil.kds.security.SesionKds;
import pe.isil.kds.service.CicloVidaItemService;
import pe.isil.kds.service.NotificadorKds;
import pe.isil.kds.service.TrazabilidadService;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class CicloVidaItemServiceTest {

    @Mock
    private DetallePedidoRepository detalleRepository;

    @Mock
    private PedidoRepository pedidoRepository;

    @Mock
    private UsuarioRepository usuarioRepository;

    @Mock
    private TrazabilidadService trazabilidadService;

    @Mock
    private ApplicationEventPublisher eventPublisher;

    @InjectMocks
    private CicloVidaItemService service;

    private final SesionKds cocineroPlancha = new SesionKds("cocinero1", "COCINERO", 1L);
    private final SesionKds expedidor = new SesionKds("expedidor1", "EXPEDIDOR", null);
    private final SesionKds admin = new SesionKds("admin", "ADMIN", null);

    private Pedido pedido;
    private DetallePedido lomo;
    private DetallePedido causa;

    @BeforeEach
    void setUp() {
        Estacion plancha = estacion(1L, "Plancha");
        Estacion frios = estacion(2L, "Fríos");

        CanalVenta salon = new CanalVenta();
        salon.setId(1L);
        salon.setCodigo("SALON");
        salon.setNombre("Salón");
        salon.setSlaObjetivoMinutos(15);

        pedido = new Pedido();
        pedido.setCanal(salon);
        pedido.setId(99L);
        pedido.setCodigoCorrelativo("CMD-261103-0001");

        lomo = item(10L, "Lomo Saltado", plancha);
        causa = item(11L, "Causa Limeña", frios);
        pedido.addItem(lomo);
        pedido.addItem(causa);

        lenient().when(detalleRepository.findPedidoIdById(anyLong())).thenReturn(Optional.of(99L));
        lenient().when(pedidoRepository.bloquearPorId(99L)).thenReturn(Optional.of(pedido));
    }

    @Test
    @DisplayName("HU013: El pedido se bloquea antes de cambiar el estado de uno de sus ítems")
    void cambiarEstado_BloqueaPedido() {
        when(detalleRepository.findById(10L)).thenReturn(Optional.of(lomo));

        service.cambiarEstado(10L, req(EstadoItem.RECIBIDO, EstadoItem.EN_PREPARACION), cocineroPlancha);

        verify(pedidoRepository).bloquearPorId(99L);
    }

    @Test
    @DisplayName("D6/D8: Un cocinero sin estación vinculada no puede cambiar estados")
    void cocineroSinEstacion_Denegado() {
        when(detalleRepository.findById(10L)).thenReturn(Optional.of(lomo));

        assertThrows(AccessDeniedException.class, () -> service.cambiarEstado(10L,
                req(EstadoItem.RECIBIDO, EstadoItem.EN_PREPARACION), new SesionKds("cocinero1", "COCINERO", null)));
        assertSinCambios();
    }

    @Test
    @DisplayName("HU013 Escenario 1: Recibido avanza a En preparación, se registra la transición y se notifica")
    void iniciarPreparacion_Exitoso() {
        when(detalleRepository.findById(10L)).thenReturn(Optional.of(lomo));

        ItemCocinaDto dto = service.cambiarEstado(10L, req(EstadoItem.RECIBIDO, EstadoItem.EN_PREPARACION), cocineroPlancha);

        assertEquals("EN_PREPARACION", dto.getEstado());
        assertEquals(EstadoPedido.EN_PREPARACION, pedido.getEstado());
        verify(detalleRepository).saveAndFlush(lomo);
        verify(trazabilidadService).registrarItem(eq(lomo), eq("RECIBIDO"), eq("EN_PREPARACION"), any(), isNull());
        verify(trazabilidadService).registrarPedido(eq(pedido), eq("ENVIADO"), eq("EN_PREPARACION"), any(), isNull());
        verify(eventPublisher).publishEvent(any(NotificadorKds.ItemsKdsEvent.class));
        // HU012: el ítem informa cuántos ítems tiene el pedido en otras estaciones
        assertEquals(1, dto.getItemsEnOtrasEstaciones());
    }

    @Test
    @DisplayName("HU013 Escenario 2: Recibido → Despachado es rechazado")
    void saltoADespachado_Rechazado() {
        when(detalleRepository.findById(10L)).thenReturn(Optional.of(lomo));

        assertThrows(OperacionNoPermitidaException.class, () ->
                service.cambiarEstado(10L, req(EstadoItem.RECIBIDO, EstadoItem.DESPACHADO), expedidor));
        assertSinCambios();
    }

    @Test
    @DisplayName("HU013 Escenario 4: Listo → En preparación es rechazado")
    void retroceso_Rechazado() {
        lomo.setEstadoItem(EstadoItem.LISTO);
        when(detalleRepository.findById(10L)).thenReturn(Optional.of(lomo));

        assertThrows(OperacionNoPermitidaException.class, () ->
                service.cambiarEstado(10L, req(EstadoItem.LISTO, EstadoItem.EN_PREPARACION), cocineroPlancha));
        assertSinCambios();
    }

    @Test
    @DisplayName("HU013 Escenario 5: Un ítem Despachado no admite cambios")
    void estadoFinal_Rechazado() {
        lomo.setEstadoItem(EstadoItem.DESPACHADO);
        when(detalleRepository.findById(10L)).thenReturn(Optional.of(lomo));

        assertThrows(OperacionNoPermitidaException.class, () ->
                service.cambiarEstado(10L, req(EstadoItem.DESPACHADO, EstadoItem.LISTO), admin));
        assertSinCambios();
    }

    @Test
    @DisplayName("HU013 Escenario 6: Si otro usuario ya cambió el ítem, la segunda solicitud recibe el estado vigente")
    void cambioSimultaneo_SegundaRecibeEstadoActual() {
        lomo.setEstadoItem(EstadoItem.EN_PREPARACION); // la primera solicitud ya se aplicó
        when(detalleRepository.findById(10L)).thenReturn(Optional.of(lomo));

        EstadoDesactualizadoException ex = assertThrows(EstadoDesactualizadoException.class, () ->
                service.cambiarEstado(10L, req(EstadoItem.RECIBIDO, EstadoItem.EN_PREPARACION), cocineroPlancha));

        assertEquals("EN_PREPARACION", ex.getItemActual().getEstado());
        assertSinCambios();
    }

    @Test
    @DisplayName("HU013: La anulación no se hace por esta vía (requiere motivo, HU032)")
    void anular_RequiereFlujoPropio() {
        when(detalleRepository.findById(10L)).thenReturn(Optional.of(lomo));

        assertThrows(OperacionNoPermitidaException.class, () ->
                service.cambiarEstado(10L, req(EstadoItem.RECIBIDO, EstadoItem.ANULADO), cocineroPlancha));
    }

    @Test
    @DisplayName("D8: Un cocinero no puede cambiar ítems de otra estación")
    void cocineroOtraEstacion_Denegado() {
        when(detalleRepository.findById(11L)).thenReturn(Optional.of(causa));

        assertThrows(AccessDeniedException.class, () ->
                service.cambiarEstado(11L, req(EstadoItem.RECIBIDO, EstadoItem.EN_PREPARACION), cocineroPlancha));
        assertSinCambios();
    }

    @Test
    @DisplayName("D8: Solo expedidor o admin despachan; el cocinero no")
    void cocineroNoDespacha() {
        lomo.setEstadoItem(EstadoItem.LISTO);
        when(detalleRepository.findById(10L)).thenReturn(Optional.of(lomo));

        assertThrows(AccessDeniedException.class, () ->
                service.cambiarEstado(10L, req(EstadoItem.LISTO, EstadoItem.DESPACHADO), cocineroPlancha));
    }

    @Test
    @DisplayName("HU013: Al despachar el último ítem vigente el pedido queda Despachado")
    void despacharUltimoItem_PedidoDespachado() {
        lomo.setEstadoItem(EstadoItem.LISTO);
        causa.setEstadoItem(EstadoItem.DESPACHADO);
        pedido.setEstado(EstadoPedido.LISTO);
        when(detalleRepository.findById(10L)).thenReturn(Optional.of(lomo));

        service.cambiarEstado(10L, req(EstadoItem.LISTO, EstadoItem.DESPACHADO), expedidor);

        assertEquals(EstadoPedido.DESPACHADO, pedido.getEstado());
        assertNotNull(pedido.getFechaDespacho());
    }

    @Test
    @DisplayName("HU014 Escenarios 1 y 2: Un toque inicia el ítem y otro lo marca Listo, sin pasos intermedios")
    void unToque_IniciaYLuegoListo() {
        when(detalleRepository.findById(10L)).thenReturn(Optional.of(lomo));

        assertEquals("EN_PREPARACION", service.cambiarEstado(10L, req(EstadoItem.RECIBIDO, EstadoItem.EN_PREPARACION), cocineroPlancha).getEstado());
        assertEquals("LISTO", service.cambiarEstado(10L, req(EstadoItem.EN_PREPARACION, EstadoItem.LISTO), cocineroPlancha).getEstado());
        verify(detalleRepository, times(2)).saveAndFlush(lomo);
    }

    @Test
    @DisplayName("HU014 Escenario 3: Un ítem En espera antes de su hora de disparo exige confirmar el inicio anticipado")
    void enEspera_AntesDeLaHora_PideConfirmacion() {
        lomo.setEstadoItem(EstadoItem.EN_ESPERA);
        lomo.setHoraDisparo(LocalDateTime.now().plusMinutes(10));
        when(detalleRepository.findById(10L)).thenReturn(Optional.of(lomo));

        OperacionNoPermitidaException ex = assertThrows(OperacionNoPermitidaException.class, () ->
                service.cambiarEstado(10L, req(EstadoItem.EN_ESPERA, EstadoItem.EN_PREPARACION), cocineroPlancha));
        assertTrue(ex.getMessage().contains("inicio anticipado"));
        assertEquals(OperacionNoPermitidaException.INICIO_ANTICIPADO_REQUERIDO, ex.getCodigo());
        assertSinCambios();

        CambiarEstadoItemRequest confirmado = req(EstadoItem.EN_ESPERA, EstadoItem.EN_PREPARACION);
        confirmado.setInicioAnticipado(true);
        assertEquals("EN_PREPARACION", service.cambiarEstado(10L, confirmado, cocineroPlancha).getEstado());
        // El adelanto queda registrado como tal en el historial (HU022)
        verify(trazabilidadService).registrarItem(eq(lomo), eq("EN_ESPERA"), eq("EN_PREPARACION"), any(),
                startsWith("Inicio anticipado"));
    }

    @Test
    @DisplayName("HU014 Escenario 3: Llegada la hora de disparo, el ítem En espera se inicia sin confirmación")
    void enEspera_HoraCumplida_SinConfirmacion() {
        lomo.setEstadoItem(EstadoItem.EN_ESPERA);
        lomo.setHoraDisparo(LocalDateTime.now().minusMinutes(1));
        when(detalleRepository.findById(10L)).thenReturn(Optional.of(lomo));

        assertEquals("EN_PREPARACION", service.cambiarEstado(10L, req(EstadoItem.EN_ESPERA, EstadoItem.EN_PREPARACION), cocineroPlancha).getEstado());
    }

    @Test
    @DisplayName("HU014 Escenario 4: El cocinero no cambia un ítem Listo; el despacho se confirma desde el pase")
    void listo_CocineroNoLoCambia() {
        lomo.setEstadoItem(EstadoItem.LISTO);
        when(detalleRepository.findById(10L)).thenReturn(Optional.of(lomo));

        assertThrows(AccessDeniedException.class, () ->
                service.cambiarEstado(10L, req(EstadoItem.LISTO, EstadoItem.DESPACHADO), cocineroPlancha));
        assertThrows(OperacionNoPermitidaException.class, () ->
                service.cambiarEstado(10L, req(EstadoItem.LISTO, EstadoItem.EN_PREPARACION), cocineroPlancha));
        assertEquals(EstadoItem.LISTO, lomo.getEstadoItem());
        assertSinCambios();
    }

    @Test
    @DisplayName("HU014 Escenario 6: Tocar un ítem que fue anulado informa la anulación y no cambia su estado")
    void anuladoEnPantalla_InformaYNoCambia() {
        lomo.setEstadoItem(EstadoItem.ANULADO); // anulado mientras la pantalla mostraba En preparación
        when(detalleRepository.findById(10L)).thenReturn(Optional.of(lomo));

        EstadoDesactualizadoException ex = assertThrows(EstadoDesactualizadoException.class, () ->
                service.cambiarEstado(10L, req(EstadoItem.EN_PREPARACION, EstadoItem.LISTO), cocineroPlancha));

        assertEquals("ANULADO", ex.getItemActual().getEstado());
        assertSinCambios();
    }

    private void assertSinCambios() {
        verify(detalleRepository, never()).saveAndFlush(any());
        verifyNoInteractions(trazabilidadService, eventPublisher);
    }

    private static CambiarEstadoItemRequest req(EstadoItem actual, EstadoItem destino) {
        return new CambiarEstadoItemRequest(actual, destino);
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
