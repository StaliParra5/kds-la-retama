package pe.isil.kds;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import pe.isil.kds.exception.AutorizacionAdminException;
import pe.isil.kds.dto.AnularItemRequest;
import pe.isil.kds.dto.ItemCocinaDto;
import pe.isil.kds.dto.MotivoAnulacionDto;
import pe.isil.kds.exception.EstadoDesactualizadoException;
import pe.isil.kds.exception.OperacionNoPermitidaException;
import pe.isil.kds.exception.RecursoNoEncontradoException;
import pe.isil.kds.model.*;
import pe.isil.kds.repository.DetallePedidoRepository;
import pe.isil.kds.repository.MermaRepository;
import pe.isil.kds.repository.PedidoRepository;
import pe.isil.kds.repository.UsuarioRepository;
import pe.isil.kds.security.SesionKds;
import pe.isil.kds.service.AnulacionItemService;
import pe.isil.kds.service.CicloVidaItemService;
import pe.isil.kds.service.NotificadorKds;
import pe.isil.kds.service.TrazabilidadService;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.*;

/**
 * HU032: anulación de ítems con motivo, merma y aviso a la estación.
 */
@ExtendWith(MockitoExtension.class)
class AnulacionItemServiceTest {

    @Mock
    private DetallePedidoRepository detalleRepository;
    @Mock
    private PedidoRepository pedidoRepository;
    @Mock
    private UsuarioRepository usuarioRepository;
    @Mock
    private MermaRepository mermaRepository;
    @Mock
    private TrazabilidadService trazabilidadService;
    @Mock
    private ApplicationEventPublisher eventPublisher;

    private AnulacionItemService service;

    // Costo mínimo de BCrypt solo para que las pruebas sean rápidas; producción usa costo 12
    private static final BCryptPasswordEncoder ENCODER = new BCryptPasswordEncoder(4);
    // D36: clave de autorización (PIN de 6 dígitos) distinta de la contraseña de la cuenta
    private static final String HASH_ADMIN = ENCODER.encode("246810");
    private static final AnularItemRequest.Autorizacion CLAVE_ADMIN = new AnularItemRequest.Autorizacion("admin", "246810");

    private final SesionKds sesionMozo = new SesionKds("angie", "MOZO", null);
    private final SesionKds sesionAdmin = new SesionKds("admin", "ADMIN", null);

    private Usuario mozo;
    private Usuario admin;
    private Pedido pedido;
    private DetallePedido lomo;
    private DetallePedido causa;

    @BeforeEach
    void setUp() {
        // Se usa el servicio de ciclo de vida real: el estado del pedido se deriva con su misma lógica
        CicloVidaItemService cicloVida = new CicloVidaItemService(
                detalleRepository, pedidoRepository, usuarioRepository, trazabilidadService, eventPublisher);
        service = new AnulacionItemService(detalleRepository, pedidoRepository, usuarioRepository,
                mermaRepository, trazabilidadService, cicloVida, eventPublisher, ENCODER);

        mozo = usuario(10L, "angie", "Angie", "Valencia");
        admin = usuario(1L, "admin", "Admin", "General");
        // D36: administrador activo con contraseña, para autorizar la anulación de ítems iniciados
        admin.setRol(new Rol(1L, "ADMIN", "Administrador", null));
        admin.setActivo(true);
        admin.setPasswordHash(ENCODER.encode("admin123"));
        admin.setClaveAutorizacionHash(HASH_ADMIN);

        CanalVenta delivery = new CanalVenta();
        delivery.setId(3L);
        delivery.setCodigo("DELIVERY");
        delivery.setNombre("Delivery propio");
        delivery.setSlaObjetivoMinutos(30);

        pedido = new Pedido();
        pedido.setId(99L);
        pedido.setCodigoCorrelativo("CMD-261112-0001");
        pedido.setCanal(delivery);
        pedido.setUsuario(mozo);
        pedido.setTotal(new BigDecimal("50.00"));

        lomo = item(10L, "Lomo Saltado", estacion(1L, "Plancha"), new BigDecimal("32.00"));
        causa = item(11L, "Causa Limeña", estacion(2L, "Fríos"), new BigDecimal("18.00"));
        pedido.addItem(lomo);
        pedido.addItem(causa);

        lenient().when(detalleRepository.findPedidoIdById(anyLong())).thenReturn(Optional.of(99L));
        lenient().when(pedidoRepository.bloquearPorId(99L)).thenReturn(Optional.of(pedido));
        lenient().when(detalleRepository.findById(10L)).thenReturn(Optional.of(lomo));
        lenient().when(detalleRepository.findById(11L)).thenReturn(Optional.of(causa));
        lenient().when(usuarioRepository.findByUsername("angie")).thenReturn(Optional.of(mozo));
        lenient().when(usuarioRepository.findByUsername("admin")).thenReturn(Optional.of(admin));
    }

    @Test
    @DisplayName("HU032 Escenario 1: Un ítem aún no iniciado se retira de la estación sin registrar merma")
    void itemNoIniciado_SeAnulaSinMerma() {
        for (EstadoItem noIniciado : List.of(EstadoItem.RECIBIDO, EstadoItem.EN_ESPERA)) {
            lomo.setEstadoItem(noIniciado);

            ItemCocinaDto dto = service.anular(10L, req(noIniciado, MotivoAnulacion.CLIENTE_CAMBIO_OPINION), sesionMozo);

            assertEquals("ANULADO", dto.getEstado(), noIniciado.name());
            assertEquals(EstadoItem.ANULADO, lomo.getEstadoItem());
            verify(trazabilidadService).registrarItem(eq(lomo), eq(noIniciado.name()), eq("ANULADO"), eq(mozo),
                    eq("Motivo: Cliente cambió de opinión"));
            lomo.setEstadoItem(noIniciado);
            reset(trazabilidadService);
        }
        verify(mermaRepository, never()).save(any());
    }

    @Test
    @DisplayName("HU032 Escenario 2: Un ítem en preparación o listo se anula registrando una merma consultable")
    void itemIniciado_RegistraMerma() {
        for (EstadoItem iniciado : List.of(EstadoItem.EN_PREPARACION, EstadoItem.LISTO)) {
            lomo.setEstadoItem(iniciado);
            lomo.setCantidad(2);
            lomo.setSubtotal(new BigDecimal("64.00"));

            service.anular(10L, new AnularItemRequest(iniciado, MotivoAnulacion.PLATO_CON_DEFECTO, CLAVE_ADMIN), sesionMozo);

            ArgumentCaptor<Merma> captor = ArgumentCaptor.forClass(Merma.class);
            verify(mermaRepository).save(captor.capture());
            Merma merma = captor.getValue();
            assertEquals(10L, merma.getDetallePedidoId());
            assertEquals(99L, merma.getPedidoId());
            assertEquals("CMD-261112-0001", merma.getCodigoPedido());
            assertEquals("Lomo Saltado", merma.getPlatoNombre());
            assertEquals("Plancha", merma.getEstacionNombre());
            assertEquals(2, merma.getCantidad());
            assertEquals(0, new BigDecimal("64.00").compareTo(merma.getMonto()));
            assertEquals(iniciado, merma.getEstadoAlAnular());
            assertEquals(MotivoAnulacion.PLATO_CON_DEFECTO, merma.getMotivo());
            assertEquals(10L, merma.getResponsableId());
            assertEquals("Angie Valencia", merma.getResponsableNombre());
            assertEquals(1L, merma.getAutorizadoPorId());
            assertEquals("Admin General", merma.getAutorizadoPorNombre());
            verify(trazabilidadService).registrarItem(eq(lomo), eq(iniciado.name()), eq("ANULADO"), eq(mozo),
                    eq("Motivo: Plato con defecto (merma) · Autorizó: Admin General"));
            reset(mermaRepository, trazabilidadService);
        }
    }

    @Test
    @DisplayName("HU032 Escenario 4: Un ítem despachado no se puede anular y nada cambia")
    void itemDespachado_NoSePuedeAnular() {
        lomo.setEstadoItem(EstadoItem.DESPACHADO);

        OperacionNoPermitidaException ex = assertThrows(OperacionNoPermitidaException.class, () ->
                service.anular(10L, req(EstadoItem.DESPACHADO, MotivoAnulacion.OTRO), sesionMozo));

        assertTrue(ex.getMessage().contains("despachado"));
        assertSinCambios();
    }

    @Test
    @DisplayName("HU032: Un ítem ya anulado no se anula dos veces ni duplica la merma")
    void itemYaAnulado_NoSeAnulaDeNuevo() {
        lomo.setEstadoItem(EstadoItem.ANULADO);

        OperacionNoPermitidaException ex = assertThrows(OperacionNoPermitidaException.class, () ->
                service.anular(10L, req(EstadoItem.ANULADO, MotivoAnulacion.OTRO), sesionMozo));

        assertTrue(ex.getMessage().contains("ya está anulado"));
        assertSinCambios();
    }

    @Test
    @DisplayName("HU032: Si cocina ya inició el ítem mientras el mozo decidía, se responde con el estado vigente y no se anula")
    void estadoDesactualizado_DevuelveElVigente() {
        lomo.setEstadoItem(EstadoItem.EN_PREPARACION);

        EstadoDesactualizadoException ex = assertThrows(EstadoDesactualizadoException.class, () ->
                service.anular(10L, req(EstadoItem.RECIBIDO, MotivoAnulacion.ERROR_DIGITACION), sesionMozo));

        assertEquals("EN_PREPARACION", ex.getItemActual().getEstado());
        assertSinCambios();
    }

    @Test
    @DisplayName("HU032 Escenario 5: La estación recibe el aviso del ítem anulado con su motivo")
    void anulacion_AvisaALaEstacion() {
        lomo.setEstadoItem(EstadoItem.EN_PREPARACION);

        service.anular(10L, new AnularItemRequest(EstadoItem.EN_PREPARACION, MotivoAnulacion.DEMORA_EXCESIVA, CLAVE_ADMIN), sesionMozo);

        ArgumentCaptor<Object> eventos = ArgumentCaptor.forClass(Object.class);
        verify(eventPublisher, atLeastOnce()).publishEvent(eventos.capture());
        NotificadorKds.ItemsKdsEvent aviso = eventos.getAllValues().stream()
                .filter(NotificadorKds.ItemsKdsEvent.class::isInstance)
                .map(NotificadorKds.ItemsKdsEvent.class::cast)
                .findFirst().orElseThrow();
        assertEquals(NotificadorKds.TipoEvento.ITEM_ACTUALIZADO, aviso.tipo());
        ItemCocinaDto item = aviso.items().get(0);
        assertEquals("ANULADO", item.getEstado());
        assertEquals(1L, item.getEstacionId());
        assertEquals("Demora excesiva", item.getMotivoAnulacion());
        assertEquals("Lomo Saltado", item.getPlatoNombre());
    }

    @Test
    @DisplayName("HU032 Escenario 6: Al anular el último ítem vigente el pedido queda anulado y se avisa; antes sigue activo")
    void anularTodosLosItems_PedidoQuedaAnulado() {
        service.anular(10L, req(EstadoItem.RECIBIDO, MotivoAnulacion.CLIENTE_SE_RETIRO), sesionMozo);

        // Con un ítem vigente el pedido sigue activo y su total ya no cuenta lo anulado
        assertEquals(EstadoPedido.ENVIADO, pedido.getEstado());
        assertEquals(0, new BigDecimal("18.00").compareTo(pedido.getTotal()));
        verify(trazabilidadService, never()).registrarPedido(any(), any(), eq("ANULADO"), any(), any());

        service.anular(11L, req(EstadoItem.RECIBIDO, MotivoAnulacion.CLIENTE_SE_RETIRO), sesionMozo);

        assertEquals(EstadoPedido.ANULADO, pedido.getEstado());
        assertEquals(0, BigDecimal.ZERO.compareTo(pedido.getTotal()));
        verify(trazabilidadService).registrarPedido(eq(pedido), eq("ENVIADO"), eq("ANULADO"), eq(mozo), isNull());
        ArgumentCaptor<Object> eventos = ArgumentCaptor.forClass(Object.class);
        verify(eventPublisher, atLeastOnce()).publishEvent(eventos.capture());
        assertTrue(eventos.getAllValues().stream()
                .filter(NotificadorKds.PedidoKdsEvent.class::isInstance)
                .map(NotificadorKds.PedidoKdsEvent.class::cast)
                .anyMatch(e -> "ANULADO".equals(e.estado()) && e.pedidoId().equals(99L)));
    }

    @Test
    @DisplayName("HU032: Anular el único ítem pendiente de un pedido ya despachado lo deja despachado")
    void anularUltimoPendiente_PedidoQuedaDespachado() {
        causa.setEstadoItem(EstadoItem.DESPACHADO);
        pedido.setEstado(EstadoPedido.LISTO);

        service.anular(10L, req(EstadoItem.RECIBIDO, MotivoAnulacion.ERROR_DIGITACION), sesionMozo);

        assertEquals(EstadoPedido.DESPACHADO, pedido.getEstado());
    }

    @Test
    @DisplayName("HU043 / D8: Un mozo no anula ítems de pedidos ajenos y se informa como inexistente")
    void mozoAjeno_NoPuedeAnular() {
        Usuario otro = usuario(20L, "otro", "Otro", "Mozo");
        when(usuarioRepository.findByUsername("otro")).thenReturn(Optional.of(otro));

        assertThrows(RecursoNoEncontradoException.class, () ->
                service.anular(10L, req(EstadoItem.RECIBIDO, MotivoAnulacion.OTRO), new SesionKds("otro", "MOZO", null)));
        assertSinCambios();
    }

    @Test
    @DisplayName("HU043: Un mozo sí anula ítems de una mesa de sus zonas aunque el pedido lo haya registrado otro")
    void mozoDeLaZona_PuedeAnular() {
        Zona zona = new Zona();
        zona.setId(5L);
        Mesa mesa = new Mesa();
        mesa.setId(8L);
        mesa.setNumeroMesa("08");
        mesa.setZona(zona);
        pedido.setMesa(mesa);
        Usuario companero = usuario(30L, "compa", "Compañero", "De Zona");
        companero.getZonas().add(zona);
        when(usuarioRepository.findByUsername("compa")).thenReturn(Optional.of(companero));

        ItemCocinaDto dto = service.anular(10L, req(EstadoItem.RECIBIDO, MotivoAnulacion.OTRO), new SesionKds("compa", "MOZO", null));

        assertEquals("ANULADO", dto.getEstado());
    }

    @Test
    @DisplayName("D8: El administrador puede anular cualquier ítem; el cocinero no")
    void roles_AdminSiCocinaNo() {
        ItemCocinaDto dto = service.anular(10L, req(EstadoItem.RECIBIDO, MotivoAnulacion.OTRO), sesionAdmin);
        assertEquals("ANULADO", dto.getEstado());
        verify(trazabilidadService).registrarItem(eq(lomo), eq("RECIBIDO"), eq("ANULADO"), eq(admin), any());

        assertThrows(AccessDeniedException.class, () ->
                service.anular(11L, req(EstadoItem.RECIBIDO, MotivoAnulacion.OTRO), new SesionKds("cocinero1", "COCINERO", 1L)));
        assertEquals(EstadoItem.RECIBIDO, causa.getEstadoItem());
    }

    @Test
    @DisplayName("D32: El expedidor anula ítems de los pedidos externos que registró él o la integración")
    void expedidor_AnulaItemsDePedidosExternos() {
        pedido.setRegistroExterno(true);
        Usuario expedidor = usuario(40L, "expedidor1", "Jorge", "Guerra");
        when(usuarioRepository.findByUsername("expedidor1")).thenReturn(Optional.of(expedidor));

        ItemCocinaDto dto = service.anular(10L, req(EstadoItem.RECIBIDO, MotivoAnulacion.CLIENTE_SE_RETIRO),
                new SesionKds("expedidor1", "EXPEDIDOR", null));

        assertEquals("ANULADO", dto.getEstado());
        verify(trazabilidadService).registrarItem(eq(lomo), eq("RECIBIDO"), eq("ANULADO"), eq(expedidor),
                eq("Motivo: Cliente se retiró"));
    }

    @Test
    @DisplayName("D32: El expedidor no ve ni anula los pedidos del comandero y se informan como inexistentes")
    void expedidor_NoAnulaPedidosDelComandero() {
        pedido.setRegistroExterno(false);
        when(usuarioRepository.findByUsername("expedidor1"))
                .thenReturn(Optional.of(usuario(40L, "expedidor1", "Jorge", "Guerra")));

        assertThrows(RecursoNoEncontradoException.class, () ->
                service.anular(10L, req(EstadoItem.RECIBIDO, MotivoAnulacion.OTRO), new SesionKds("expedidor1", "EXPEDIDOR", null)));
        assertSinCambios();
    }

    @Test
    @DisplayName("HU032: Un ítem inexistente se informa como no encontrado")
    void itemInexistente_NoEncontrado() {
        when(detalleRepository.findPedidoIdById(404L)).thenReturn(Optional.empty());

        assertThrows(RecursoNoEncontradoException.class, () ->
                service.anular(404L, req(EstadoItem.RECIBIDO, MotivoAnulacion.OTRO), sesionMozo));
    }

    @Test
    @DisplayName("HU032: El pedido se bloquea antes de anular uno de sus ítems")
    void anular_BloqueaElPedido() {
        service.anular(10L, req(EstadoItem.RECIBIDO, MotivoAnulacion.OTRO), sesionMozo);

        verify(pedidoRepository).bloquearPorId(99L);
    }

    @Test
    @DisplayName("D36: Sin autorización el mozo no puede anular un ítem que cocina ya inició")
    void itemIniciado_SinAutorizacion_SeRechaza() {
        for (EstadoItem iniciado : List.of(EstadoItem.EN_PREPARACION, EstadoItem.LISTO)) {
            lomo.setEstadoItem(iniciado);

            AutorizacionAdminException ex = assertThrows(AutorizacionAdminException.class, () ->
                    service.anular(10L, req(iniciado, MotivoAnulacion.PLATO_CON_DEFECTO), sesionMozo));

            assertEquals(AutorizacionAdminException.REQUERIDA, ex.getCodigo());
        }
        assertSinCambios();
    }

    @Test
    @DisplayName("D36: Una clave incorrecta, la contraseña de la cuenta, un usuario que no es administrador o uno inactivo no autorizan")
    void autorizacionInvalida_SeRechaza() {
        lomo.setEstadoItem(EstadoItem.EN_PREPARACION);
        Usuario cocinero = usuario(50L, "cocinero1", "Cocinero", "Uno");
        cocinero.setRol(new Rol(3L, "COCINERO", "Cocinero", null));
        cocinero.setActivo(true);
        cocinero.setClaveAutorizacionHash(HASH_ADMIN);
        when(usuarioRepository.findByUsername("cocinero1")).thenReturn(Optional.of(cocinero));
        when(usuarioRepository.findByUsername("nadie")).thenReturn(Optional.empty());

        for (AnularItemRequest.Autorizacion clave : List.of(
                new AnularItemRequest.Autorizacion("admin", "135790"),
                // La contraseña de la cuenta no sirve como clave de autorización
                new AnularItemRequest.Autorizacion("admin", "admin123"),
                new AnularItemRequest.Autorizacion("cocinero1", "246810"),
                new AnularItemRequest.Autorizacion("nadie", "246810"))) {
            AutorizacionAdminException ex = assertThrows(AutorizacionAdminException.class, () -> service.anular(10L,
                    new AnularItemRequest(EstadoItem.EN_PREPARACION, MotivoAnulacion.PLATO_CON_DEFECTO, clave), sesionMozo));
            // Mismo mensaje en los tres casos: no revela si el usuario existe
            assertEquals(AutorizacionAdminException.INVALIDA, ex.getCodigo(), clave.toString());
            assertTrue(ex.getMessage().startsWith("Usuario o clave de autorización incorrectos."), ex.getMessage());
        }

        admin.setActivo(false);
        assertThrows(AutorizacionAdminException.class, () -> service.anular(10L,
                new AnularItemRequest(EstadoItem.EN_PREPARACION, MotivoAnulacion.PLATO_CON_DEFECTO, CLAVE_ADMIN), sesionMozo));
        assertSinCambios();
    }

    @Test
    @DisplayName("D36: Un administrador que aún no configuró su clave de autorización no puede autorizar")
    void adminSinClave_NoAutoriza() {
        lomo.setEstadoItem(EstadoItem.EN_PREPARACION);
        admin.setClaveAutorizacionHash(null);

        AutorizacionAdminException ex = assertThrows(AutorizacionAdminException.class, () -> service.anular(10L,
                new AnularItemRequest(EstadoItem.EN_PREPARACION, MotivoAnulacion.PLATO_CON_DEFECTO, CLAVE_ADMIN), sesionMozo));

        assertEquals(AutorizacionAdminException.INVALIDA, ex.getCodigo());
        assertTrue(ex.getMessage().contains("Mi clave"));
        assertSinCambios();
    }

    @Test
    @DisplayName("D36: Tras 5 intentos fallidos la autorización se bloquea, aunque luego se dé la clave correcta")
    void autorizacion_SeBloqueaTrasCincoFallos() {
        lomo.setEstadoItem(EstadoItem.EN_PREPARACION);
        AnularItemRequest incorrecta = new AnularItemRequest(EstadoItem.EN_PREPARACION, MotivoAnulacion.PLATO_CON_DEFECTO,
                new AnularItemRequest.Autorizacion("admin", "mala"));
        for (int i = 0; i < 5; i++) {
            assertThrows(AutorizacionAdminException.class, () -> service.anular(10L, incorrecta, sesionMozo));
        }

        AutorizacionAdminException ex = assertThrows(AutorizacionAdminException.class, () -> service.anular(10L,
                new AnularItemRequest(EstadoItem.EN_PREPARACION, MotivoAnulacion.PLATO_CON_DEFECTO, CLAVE_ADMIN), sesionMozo));

        assertEquals(AutorizacionAdminException.BLOQUEADA, ex.getCodigo());
        assertSinCambios();
    }

    @Test
    @DisplayName("D36: El expedidor también necesita la autorización del administrador para un ítem iniciado")
    void expedidor_ItemIniciado_RequiereAutorizacion() {
        pedido.setRegistroExterno(true);
        lomo.setEstadoItem(EstadoItem.LISTO);
        when(usuarioRepository.findByUsername("expedidor1"))
                .thenReturn(Optional.of(usuario(40L, "expedidor1", "Jorge", "Guerra")));
        SesionKds sesionExpedidor = new SesionKds("expedidor1", "EXPEDIDOR", null);

        assertThrows(AutorizacionAdminException.class, () ->
                service.anular(10L, req(EstadoItem.LISTO, MotivoAnulacion.PLATO_CON_DEFECTO), sesionExpedidor));
        ItemCocinaDto dto = service.anular(10L,
                new AnularItemRequest(EstadoItem.LISTO, MotivoAnulacion.PLATO_CON_DEFECTO, CLAVE_ADMIN), sesionExpedidor);

        assertEquals("ANULADO", dto.getEstado());
    }

    @Test
    @DisplayName("D36: El administrador anula un ítem iniciado sin ingresar otra clave y figura como quien autorizó")
    void admin_ItemIniciado_SinClave() {
        lomo.setEstadoItem(EstadoItem.EN_PREPARACION);

        service.anular(10L, req(EstadoItem.EN_PREPARACION, MotivoAnulacion.DEMORA_EXCESIVA), sesionAdmin);

        ArgumentCaptor<Merma> captor = ArgumentCaptor.forClass(Merma.class);
        verify(mermaRepository).save(captor.capture());
        assertEquals(1L, captor.getValue().getAutorizadoPorId());
        verify(trazabilidadService).registrarItem(eq(lomo), eq("EN_PREPARACION"), eq("ANULADO"), eq(admin),
                eq("Motivo: Demora excesiva (merma)"));
    }

    @Test
    @DisplayName("D36: Un ítem pendiente no pide autorización aunque llegue una clave incorrecta")
    void itemPendiente_NoUsaLaAutorizacion() {
        ItemCocinaDto dto = service.anular(10L, new AnularItemRequest(EstadoItem.RECIBIDO, MotivoAnulacion.ERROR_DIGITACION,
                new AnularItemRequest.Autorizacion("admin", "mala")), sesionMozo);

        assertEquals("ANULADO", dto.getEstado());
        verify(mermaRepository, never()).save(any());
    }

    @Test
    @DisplayName("D36: Un motivo que no corresponde al estado del ítem se rechaza")
    void motivoQueNoAplica_SeRechaza() {
        IllegalArgumentException pendiente = assertThrows(IllegalArgumentException.class, () ->
                service.anular(10L, req(EstadoItem.RECIBIDO, MotivoAnulacion.PLATO_CON_DEFECTO), sesionMozo));
        assertTrue(pendiente.getMessage().contains("Plato con defecto"));

        lomo.setEstadoItem(EstadoItem.EN_PREPARACION);
        assertThrows(IllegalArgumentException.class, () -> service.anular(10L,
                new AnularItemRequest(EstadoItem.EN_PREPARACION, MotivoAnulacion.ERROR_DIGITACION, CLAVE_ADMIN), sesionMozo));
        assertSinCambios();
    }

    @Test
    @DisplayName("D36: Los motivos ofrecidos dependen de si cocina ya inició el ítem")
    void motivos_SegunEstado() {
        List<String> pendiente = List.of("Error de digitación", "Cliente cambió de opinión", "Cliente se retiró", "Otro");
        List<String> iniciado = List.of("Cliente se retiró", "Demora excesiva", "Plato con defecto", "Otro");
        for (EstadoItem estado : List.of(EstadoItem.RECIBIDO, EstadoItem.EN_ESPERA)) {
            assertEquals(pendiente, service.motivos(estado).stream().map(MotivoAnulacionDto::etiqueta).toList(), estado.name());
        }
        for (EstadoItem estado : List.of(EstadoItem.EN_PREPARACION, EstadoItem.LISTO)) {
            assertEquals(iniciado, service.motivos(estado).stream().map(MotivoAnulacionDto::etiqueta).toList(), estado.name());
        }
    }

    @Test
    @DisplayName("D12: La lista de motivos es la aprobada, en su orden")
    void motivos_ListaFija() {
        List<MotivoAnulacionDto> motivos = service.motivos();

        assertEquals(List.of("Error de digitación", "Cliente cambió de opinión", "Cliente se retiró",
                "Demora excesiva", "Plato con defecto", "Otro"),
                motivos.stream().map(MotivoAnulacionDto::etiqueta).toList());
        assertEquals("ERROR_DIGITACION", motivos.get(0).codigo());
        assertEquals("OTRO", motivos.get(5).codigo());
    }

    private void assertSinCambios() {
        verify(detalleRepository, never()).saveAndFlush(any());
        verify(mermaRepository, never()).save(any());
        verify(trazabilidadService, never()).registrarItem(any(), any(), any(), any(), any());
        verify(eventPublisher, never()).publishEvent(any(Object.class));
    }

    private static AnularItemRequest req(EstadoItem estadoActual, MotivoAnulacion motivo) {
        return new AnularItemRequest(estadoActual, motivo);
    }

    private static Usuario usuario(Long id, String username, String nombre, String apellido) {
        Usuario u = new Usuario();
        u.setId(id);
        u.setUsername(username);
        u.setNombre(nombre);
        u.setApellido(apellido);
        return u;
    }

    private static Estacion estacion(Long id, String nombre) {
        Estacion e = new Estacion();
        e.setId(id);
        e.setNombre(nombre);
        return e;
    }

    private static DetallePedido item(Long id, String platoNombre, Estacion estacion, BigDecimal subtotal) {
        Plato plato = new Plato();
        plato.setNombre(platoNombre);
        DetallePedido d = new DetallePedido();
        d.setId(id);
        d.setPlato(plato);
        d.setEstacion(estacion);
        d.setCantidad(1);
        d.setSubtotal(subtotal);
        d.setEstadoItem(EstadoItem.RECIBIDO);
        return d;
    }
}
