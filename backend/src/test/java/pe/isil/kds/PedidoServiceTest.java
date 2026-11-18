package pe.isil.kds;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.context.ApplicationEventPublisher;
import pe.isil.kds.dto.CrearPedidoRequest;
import pe.isil.kds.dto.ItemPedidoRequest;
import pe.isil.kds.dto.PedidoResponse;
import pe.isil.kds.exception.OperacionNoPermitidaException;
import pe.isil.kds.model.*;
import pe.isil.kds.repository.*;
import pe.isil.kds.service.NotificadorKds;
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
    private AtencionMesaRepository atencionRepository;

    @Mock
    private TrazabilidadService trazabilidadService;

    @Mock
    private ApplicationEventPublisher eventPublisher;

    @InjectMocks
    private PedidoService pedidoService;

    private CanalVenta canalSalon;
    private CanalVenta canalDelivery;
    private Mesa mesa08;
    private Usuario mozo;
    private Plato plato;
    private Estacion estacion;

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

        Zona salonPrincipal = new Zona();
        salonPrincipal.setId(1L);
        salonPrincipal.setNombre("Salón Principal");

        mesa08 = new Mesa();
        mesa08.setId(8L);
        mesa08.setNumeroMesa("08");
        mesa08.setZona(salonPrincipal);

        mozo = new Usuario();
        mozo.setId(10L);
        mozo.setUsername("angie");
        mozo.setNombre("Angie");
        mozo.setApellido("Valencia");
        // HU043: la mesa 08 está en una zona que el mozo atiende
        mozo.getZonas().add(mesa08.getZona());
        // HU044: la mesa 08 está abierta; lenient porque los casos rechazados antes no llegan a consultarla
        AtencionMesa atencion08 = new AtencionMesa();
        atencion08.setId(80L);
        atencion08.setMesa(mesa08);
        atencion08.setPersonas(2);
        lenient().when(atencionRepository.findByMesaIdAndLiberadaEnIsNull(8L)).thenReturn(Optional.of(atencion08));

        estacion = new Estacion();
        estacion.setId(1L);
        estacion.setNombre("Plancha");

        plato = new Plato();
        plato.setId(50L);
        plato.setNombre("Lomo Saltado");
        plato.setPrecio(new BigDecimal("32.00"));
        plato.setTiempoEstandarMinutos(12);
        plato.setEstacion(estacion);
        // HU008: catálogo de modificadores del plato; fuera de él (o sin catálogo) solo se admite la cantidad
        plato.setModificadores(new java.util.ArrayList<>(List.of("Sin cebolla", "Sin ají", "Término medio", "Bien cocido")));
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

        verify(pedidoRepository, never()).saveAndFlush(any());
    }

    @Test
    @DisplayName("HU006 Escenario 1: Apertura de comanda exitosa con correlativo y cálculo de total")
    void crearComanda_SalonValida_Exitoso() {
        CrearPedidoRequest req = new CrearPedidoRequest();
        req.setCanalId(1L);
        req.setMesaId(8L);
        req.setItems(List.of(new ItemPedidoRequest(50L, 2, "Sin cebolla")));

        when(canalRepository.findById(1L)).thenReturn(Optional.of(canalSalon));
        when(mesaRepository.bloquearPorId(8L)).thenReturn(Optional.of(mesa08));
        when(usuarioRepository.findByUsername("angie")).thenReturn(Optional.of(mozo));
        when(platoRepository.findById(50L)).thenReturn(Optional.of(plato));
        when(pedidoRepository.obtenerSiguienteValorSecuencia()).thenReturn(5L);

        when(pedidoRepository.saveAndFlush(any(Pedido.class))).thenAnswer(invocation -> {
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
    @DisplayName("HU040 Escenario 4 / HU041 Escenario 4: No se registran pedidos en una mesa inactiva o de una zona inactiva")
    void crearComanda_MesaOZonaInactiva_EsRechazada() {
        CrearPedidoRequest req = new CrearPedidoRequest();
        req.setCanalId(1L);
        req.setMesaId(8L);
        req.setItems(List.of(new ItemPedidoRequest(50L, 1, null)));
        when(canalRepository.findById(1L)).thenReturn(Optional.of(canalSalon));
        when(mesaRepository.bloquearPorId(8L)).thenReturn(Optional.of(mesa08));

        mesa08.setActivo(false);
        OperacionNoPermitidaException porMesa = assertThrows(OperacionNoPermitidaException.class, () -> pedidoService.crearComanda(req, "angie"));
        assertTrue(porMesa.getMessage().contains("no está disponible"));
        assertEquals(PedidoService.CODIGO_MESA_NO_DISPONIBLE, porMesa.getCodigo());

        mesa08.setActivo(true);
        mesa08.getZona().setActivo(false);
        assertThrows(OperacionNoPermitidaException.class, () -> pedidoService.crearComanda(req, "angie"));
        verify(pedidoRepository, never()).saveAndFlush(any());
    }

    @Test
    @DisplayName("HU043 Escenario 3: Un pedido de salón en una mesa de otra zona se rechaza por falta de permisos")
    void crearComanda_MesaFueraDeSusZonas_EsRechazada() {
        CrearPedidoRequest req = new CrearPedidoRequest();
        req.setCanalId(1L);
        req.setMesaId(8L);
        req.setItems(List.of(new ItemPedidoRequest(50L, 1, null)));
        mozo.getZonas().clear();
        when(canalRepository.findById(1L)).thenReturn(Optional.of(canalSalon));
        when(mesaRepository.bloquearPorId(8L)).thenReturn(Optional.of(mesa08));
        when(usuarioRepository.findByUsername("angie")).thenReturn(Optional.of(mozo));

        org.springframework.security.access.AccessDeniedException ex = assertThrows(
                org.springframework.security.access.AccessDeniedException.class, () -> pedidoService.crearComanda(req, "angie"));
        assertTrue(ex.getMessage().contains("no tiene asignada"));
        verify(pedidoRepository, never()).saveAndFlush(any());
    }

    @Test
    @DisplayName("HU043 Escenario 2: El mozo consulta sus pedidos y los de sus zonas; uno ajeno se informa como inexistente")
    void obtenerPorId_VisibilidadDelMozo() {
        Usuario otroMozo = new Usuario();
        otroMozo.setId(11L);
        Pedido deSuZona = new Pedido();
        deSuZona.setId(1L);
        deSuZona.setUsuario(otroMozo);
        deSuZona.setMesa(mesa08);
        deSuZona.setCanal(canalSalon);
        deSuZona.setEstado(EstadoPedido.ENVIADO);
        Pedido ajeno = new Pedido();
        ajeno.setId(2L);
        ajeno.setUsuario(otroMozo);
        ajeno.setCanal(canalDelivery);
        ajeno.setEstado(EstadoPedido.ENVIADO);
        when(usuarioRepository.findByUsername("angie")).thenReturn(Optional.of(mozo));
        when(pedidoRepository.findById(1L)).thenReturn(Optional.of(deSuZona));
        when(pedidoRepository.findById(2L)).thenReturn(Optional.of(ajeno));

        assertEquals(1L, pedidoService.obtenerPorId(1L, "angie", true).getId());
        assertThrows(pe.isil.kds.exception.RecursoNoEncontradoException.class, () -> pedidoService.obtenerPorId(2L, "angie", true));
        assertEquals(2L, pedidoService.obtenerPorId(2L, "admin", false).getId());
    }

    @Test
    @DisplayName("HU044 / D19: Un pedido de salón en una mesa que no fue abierta se rechaza (409 MESA_SIN_ATENCION)")
    void crearComanda_MesaSinAtencion_EsRechazada() {
        CrearPedidoRequest req = new CrearPedidoRequest();
        req.setCanalId(1L);
        req.setMesaId(8L);
        req.setItems(List.of(new ItemPedidoRequest(50L, 1, null)));
        when(canalRepository.findById(1L)).thenReturn(Optional.of(canalSalon));
        when(mesaRepository.bloquearPorId(8L)).thenReturn(Optional.of(mesa08));
        when(usuarioRepository.findByUsername("angie")).thenReturn(Optional.of(mozo));
        when(atencionRepository.findByMesaIdAndLiberadaEnIsNull(8L)).thenReturn(Optional.empty());

        OperacionNoPermitidaException ex = assertThrows(OperacionNoPermitidaException.class,
                () -> pedidoService.crearComanda(req, "angie"));
        assertEquals(PedidoService.CODIGO_MESA_SIN_ATENCION, ex.getCodigo());
        verify(pedidoRepository, never()).saveAndFlush(any());
    }

    private CrearPedidoRequest paraLlevar(String nombre, String celular) {
        CanalVenta canalLlevar = new CanalVenta();
        canalLlevar.setId(4L);
        canalLlevar.setCodigo("PARA_LLEVAR");
        canalLlevar.setNombre("Para Llevar");
        canalLlevar.setActivo(true);
        when(canalRepository.findById(4L)).thenReturn(Optional.of(canalLlevar));
        when(usuarioRepository.findByUsername("angie")).thenReturn(Optional.of(mozo));
        CrearPedidoRequest req = new CrearPedidoRequest();
        req.setCanalId(4L);
        req.setClienteNombre(nombre);
        req.setClienteTelefono(celular);
        req.setItems(List.of(new ItemPedidoRequest(50L, 1, null)));
        return req;
    }

    @Test
    @DisplayName("HU045 Escenario 4: Para llevar sin nombre del cliente se rechaza indicando el dato faltante")
    void paraLlevar_SinNombre() {
        CrearPedidoRequest req = paraLlevar("  ", "987654321");

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class, () -> pedidoService.crearComanda(req, "angie"));
        assertTrue(ex.getMessage().contains("nombre"));
        verify(pedidoRepository, never()).saveAndFlush(any());
    }

    @Test
    @DisplayName("HU045 Escenarios 2 y 4: Para llevar con celular inválido (no 9 dígitos o no empieza en 9) se rechaza")
    void paraLlevar_CelularInvalido() {
        for (String celular : new String[] {null, "98765432", "887654321", "9876543210", "98765432a"}) {
            CrearPedidoRequest req = paraLlevar("Ana", celular);
            IllegalArgumentException ex = assertThrows(IllegalArgumentException.class, () -> pedidoService.crearComanda(req, "angie"), celular);
            assertTrue(ex.getMessage().contains("celular"), celular);
        }
        verify(pedidoRepository, never()).saveAndFlush(any());
    }

    @Test
    @DisplayName("HU045 Escenarios 3 y 5: Con datos válidos el pedido guarda nombre y celular (sin exigir zonas)")
    void paraLlevar_DatosValidos() {
        mozo.getZonas().clear();
        CrearPedidoRequest req = paraLlevar(" Ana Ruiz ", " 987654321 ");
        when(platoRepository.findById(50L)).thenReturn(Optional.of(plato));
        when(pedidoRepository.obtenerSiguienteValorSecuencia()).thenReturn(7L);
        when(pedidoRepository.saveAndFlush(any(Pedido.class))).thenAnswer(i -> {
            Pedido p = i.getArgument(0);
            p.setId(101L);
            return p;
        });

        PedidoResponse r = pedidoService.crearComanda(req, "angie");

        assertEquals("Ana Ruiz", r.getClienteNombre());
        assertEquals("987654321", r.getClienteTelefono());
        assertNull(r.getMesaNumero());
    }

    @Test
    @DisplayName("HU045 / D20: Delivery no exige los datos del cliente por ahora")
    void delivery_SinDatosCliente() {
        CrearPedidoRequest req = new CrearPedidoRequest();
        req.setCanalId(2L);
        req.setItems(List.of(new ItemPedidoRequest(50L, 1, null)));
        canalDelivery.setActivo(true);
        when(canalRepository.findById(2L)).thenReturn(Optional.of(canalDelivery));
        when(usuarioRepository.findByUsername("angie")).thenReturn(Optional.of(mozo));
        when(platoRepository.findById(50L)).thenReturn(Optional.of(plato));
        when(pedidoRepository.obtenerSiguienteValorSecuencia()).thenReturn(8L);
        when(pedidoRepository.saveAndFlush(any(Pedido.class))).thenAnswer(i -> i.getArgument(0));

        assertNotNull(pedidoService.crearComanda(req, "angie"));
    }

    @Test
    @DisplayName("HU006: Fallback de correlativo al conteo del día si la secuencia nativa no está disponible")
    void crearComanda_FallbackSecuencia_Exitoso() {
        CrearPedidoRequest req = new CrearPedidoRequest();
        req.setCanalId(1L);
        req.setMesaId(8L);
        req.setItems(List.of(new ItemPedidoRequest(50L, 1, null)));

        when(canalRepository.findById(1L)).thenReturn(Optional.of(canalSalon));
        when(mesaRepository.bloquearPorId(8L)).thenReturn(Optional.of(mesa08));
        when(usuarioRepository.findByUsername("angie")).thenReturn(Optional.of(mozo));
        when(platoRepository.findById(50L)).thenReturn(Optional.of(plato));
        when(pedidoRepository.obtenerSiguienteValorSecuencia()).thenThrow(new RuntimeException("DB sequence unreachable"));
        when(pedidoRepository.countPedidosDesde(any(LocalDateTime.class))).thenReturn(7L);

        when(pedidoRepository.saveAndFlush(any(Pedido.class))).thenAnswer(invocation -> invocation.getArgument(0));

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
    @DisplayName("HU008 Escenario 4: Varios modificadores se guardan con el nombre del catálogo, sin repetidos y juntos en el ítem")
    void crearComanda_VariosModificadores_SeGuardanJuntos() {
        CrearPedidoRequest req = new CrearPedidoRequest();
        req.setCanalId(1L);
        req.setMesaId(8L);
        req.setItems(List.of(new ItemPedidoRequest(50L, 3, " sin cebolla , término MEDIO, Sin cebolla")));

        prepararAperturaValida();

        PedidoResponse response = pedidoService.crearComanda(req, "angie");

        assertEquals(1, response.getItems().size());
        assertEquals(3, response.getItems().get(0).getCantidad());
        assertEquals("Sin cebolla, Término medio", response.getItems().get(0).getModificadores());
    }

    @Test
    @DisplayName("HU008 Escenario 2: Un plato sin modificadores configurados rechaza cualquier modificador y solo admite cantidad")
    void crearComanda_PlatoSinModificadores_SoloCantidad() {
        plato.getModificadores().clear();
        CrearPedidoRequest req = new CrearPedidoRequest();
        req.setCanalId(1L);
        req.setMesaId(8L);
        req.setItems(List.of(new ItemPedidoRequest(50L, 2, "Sin cebolla")));

        prepararAperturaValida();

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class, () -> pedidoService.crearComanda(req, "angie"));
        assertTrue(ex.getMessage().contains("Lomo Saltado"));
        assertTrue(ex.getMessage().contains("solo se puede indicar la cantidad"));
        verify(pedidoRepository, never()).saveAndFlush(any());

        // Solo con cantidad el mismo plato sí se registra
        CrearPedidoRequest soloCantidad = new CrearPedidoRequest();
        soloCantidad.setCanalId(1L);
        soloCantidad.setMesaId(8L);
        soloCantidad.setItems(List.of(new ItemPedidoRequest(50L, 2, null)));
        assertNull(pedidoService.crearComanda(soloCantidad, "angie").getItems().get(0).getModificadores());
    }

    @Test
    @DisplayName("HU008 Escenario 1: Un modificador que no pertenece al catálogo del plato se rechaza indicando cuál")
    void crearComanda_ModificadorFueraDelCatalogo_EsRechazado() {
        CrearPedidoRequest req = new CrearPedidoRequest();
        req.setCanalId(1L);
        req.setMesaId(8L);
        req.setItems(List.of(new ItemPedidoRequest(50L, 1, "Sin cebolla, Con helado")));

        prepararAperturaValida();

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class, () -> pedidoService.crearComanda(req, "angie"));
        assertTrue(ex.getMessage().contains("Con helado"));
        assertTrue(ex.getMessage().contains("no está disponible"));
        verify(pedidoRepository, never()).saveAndFlush(any());
    }

    @Test
    @DisplayName("HU009 / HU008: Reintentar con los mismos modificadores en otro orden o mayúsculas devuelve el pedido existente")
    void crearComanda_ClaveRepetida_ModificadoresEquivalentes() {
        Pedido existente = pedidoExistente();
        existente.getItems().get(0).setModificadores("Sin cebolla, Término medio");
        when(pedidoRepository.findByClaveIdempotencia("cmd-aaaa1111")).thenReturn(Optional.of(existente));

        CrearPedidoRequest req = new CrearPedidoRequest();
        req.setCanalId(1L);
        req.setMesaId(8L);
        req.setClaveIdempotencia("cmd-aaaa1111");
        req.setItems(List.of(new ItemPedidoRequest(50L, 1, "término medio,SIN CEBOLLA")));

        PedidoService.ResultadoEnvio resultado = pedidoService.registrarComanda(req, "angie");

        assertFalse(resultado.creado());
        assertEquals(77L, resultado.pedido().getId());
        verify(pedidoRepository, never()).saveAndFlush(any());
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
        verify(pedidoRepository, never()).saveAndFlush(any());
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

    @Test
    @DisplayName("HU009 Escenario 6: Un plato agotado después de agregarse impide el envío e indica cuál")
    void crearComanda_PlatoAgotado_EsRechazado() {
        plato.setDisponible(false);
        CrearPedidoRequest req = new CrearPedidoRequest();
        req.setCanalId(1L);
        req.setMesaId(8L);
        req.setItems(List.of(new ItemPedidoRequest(50L, 1, null)));

        when(canalRepository.findById(1L)).thenReturn(Optional.of(canalSalon));
        when(mesaRepository.bloquearPorId(8L)).thenReturn(Optional.of(mesa08));
        when(usuarioRepository.findByUsername("angie")).thenReturn(Optional.of(mozo));
        when(platoRepository.findById(50L)).thenReturn(Optional.of(plato));

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class, () ->
                pedidoService.crearComanda(req, "angie"));

        assertTrue(ex.getMessage().contains("Lomo Saltado"));
        assertTrue(ex.getMessage().contains("agotado"));
        verify(pedidoRepository, never()).saveAndFlush(any());
    }

    @Test
    @DisplayName("HU009 Escenarios 2 y 5: Reenviar con la misma clave devuelve el pedido existente sin duplicarlo")
    void crearComanda_ClaveRepetida_DevuelveExistente() {
        CrearPedidoRequest req = new CrearPedidoRequest();
        req.setCanalId(1L);
        req.setMesaId(8L);
        req.setClaveIdempotencia("cmd-0f3a9b2c4d5e");
        req.setItems(List.of(new ItemPedidoRequest(50L, 1, null)));

        Pedido existente = pedidoExistente();
        when(pedidoRepository.findByClaveIdempotencia("cmd-0f3a9b2c4d5e")).thenReturn(Optional.of(existente));

        PedidoService.ResultadoEnvio resultado = pedidoService.registrarComanda(req, "angie");

        assertFalse(resultado.creado());
        assertEquals(77L, resultado.pedido().getId());
        verify(pedidoRepository, never()).saveAndFlush(any());
        verifyNoInteractions(trazabilidadService, canalRepository);
    }

    @Test
    @DisplayName("HU009: Reutilizar una clave con otro contenido u otro mozo es rechazado (409)")
    void crearComanda_ClaveReutilizadaDistinta_EsRechazada() {
        when(pedidoRepository.findByClaveIdempotencia("cmd-0f3a9b2c4d5e")).thenReturn(Optional.of(pedidoExistente()));

        CrearPedidoRequest otroContenido = new CrearPedidoRequest();
        otroContenido.setCanalId(1L);
        otroContenido.setMesaId(8L);
        otroContenido.setClaveIdempotencia("cmd-0f3a9b2c4d5e");
        otroContenido.setItems(List.of(new ItemPedidoRequest(50L, 3, null)));
        assertThrows(OperacionNoPermitidaException.class, () -> pedidoService.registrarComanda(otroContenido, "angie"));

        CrearPedidoRequest mismoContenido = new CrearPedidoRequest();
        mismoContenido.setCanalId(1L);
        mismoContenido.setMesaId(8L);
        mismoContenido.setClaveIdempotencia("cmd-0f3a9b2c4d5e");
        mismoContenido.setItems(List.of(new ItemPedidoRequest(50L, 1, null)));
        assertThrows(OperacionNoPermitidaException.class, () -> pedidoService.registrarComanda(mismoContenido, "otro_mozo"));
        verify(pedidoRepository, never()).saveAndFlush(any());
    }

    private Pedido pedidoExistente() {
        Pedido existente = new Pedido();
        existente.setCanal(canalSalon);
        existente.setId(77L);
        existente.setCodigoCorrelativo("CMD-261103-0009");
        existente.setUsuario(mozo);
        existente.setMesa(mesa08);
        DetallePedido d = new DetallePedido();
        d.setPlato(plato);
        d.setEstacion(plato.getEstacion());
        d.setCantidad(1);
        d.setPrecioUnitario(plato.getPrecio());
        d.setSubtotal(plato.getPrecio());
        d.setTiempoEstandarMinutos(12);
        existente.addItem(d);
        return existente;
    }

    @Test
    @DisplayName("HU009 Escenario 1: El pedido registrado queda ENVIADO con la hora de envío como acuse")
    void crearComanda_AcuseConHoraDeEnvio() {
        CrearPedidoRequest req = new CrearPedidoRequest();
        req.setCanalId(1L);
        req.setMesaId(8L);
        req.setClaveIdempotencia("cmd-11112222");
        req.setItems(List.of(new ItemPedidoRequest(50L, 1, null)));

        prepararAperturaValida();

        PedidoResponse response = pedidoService.crearComanda(req, "angie");

        assertEquals("ENVIADO", response.getEstado());
        assertNotNull(response.getFechaEnvioCocina());
    }

    @Test
    @DisplayName("HU011 Escenario 6: Un plato cuya estación fue desactivada impide el envío e indica cuál")
    void crearComanda_EstacionInactiva_EsRechazado() {
        estacion.setActivo(false);
        CrearPedidoRequest req = new CrearPedidoRequest();
        req.setCanalId(1L);
        req.setMesaId(8L);
        req.setItems(List.of(new ItemPedidoRequest(50L, 1, null)));

        when(canalRepository.findById(1L)).thenReturn(Optional.of(canalSalon));
        when(mesaRepository.bloquearPorId(8L)).thenReturn(Optional.of(mesa08));
        when(usuarioRepository.findByUsername("angie")).thenReturn(Optional.of(mozo));
        when(platoRepository.findById(50L)).thenReturn(Optional.of(plato));

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class, () ->
                pedidoService.crearComanda(req, "angie"));
        assertTrue(ex.getMessage().contains("Lomo Saltado"));
        assertTrue(ex.getMessage().contains("estación"));
        verify(pedidoRepository, never()).saveAndFlush(any());
    }

    @Test
    @DisplayName("HU011 Escenarios 1 a 3: Cada ítem se enruta a su estación con cantidad y modificador, notificado tras el commit")
    void crearComanda_EnrutaItemsPorEstacion() {
        Estacion frios = new Estacion();
        frios.setId(2L);
        frios.setNombre("Fríos");
        Plato causa = new Plato();
        causa.setId(60L);
        causa.setNombre("Causa Limeña");
        causa.setPrecio(new BigDecimal("16.00"));
        causa.setTiempoEstandarMinutos(6);
        causa.setEstacion(frios);

        CrearPedidoRequest req = new CrearPedidoRequest();
        req.setCanalId(1L);
        req.setMesaId(8L);
        req.setItems(List.of(new ItemPedidoRequest(50L, 3, "Sin cebolla"), new ItemPedidoRequest(60L, 1, null)));

        prepararAperturaValida();
        when(platoRepository.findById(60L)).thenReturn(Optional.of(causa));

        PedidoResponse response = pedidoService.crearComanda(req, "angie");

        assertEquals(List.of("Plancha", "Fríos"), response.getItems().stream().map(i -> i.getEstacionNombre()).toList());
        org.mockito.ArgumentCaptor<Object> captor = org.mockito.ArgumentCaptor.forClass(Object.class);
        verify(eventPublisher, times(2)).publishEvent(captor.capture());
        NotificadorKds.ItemsKdsEvent evento = captor.getAllValues().stream()
                .filter(NotificadorKds.ItemsKdsEvent.class::isInstance)
                .map(NotificadorKds.ItemsKdsEvent.class::cast)
                .findFirst().orElseThrow();
        assertTrue(captor.getAllValues().stream().anyMatch(NotificadorKds.PedidoKdsEvent.class::isInstance));
        assertEquals(NotificadorKds.TipoEvento.ITEM_NUEVO, evento.tipo());
        assertEquals(2, evento.items().size());
        var lomo = evento.items().get(0);
        assertEquals(1L, lomo.getEstacionId());
        assertEquals(3, lomo.getCantidad());
        assertEquals("Sin cebolla", lomo.getModificadores());
        assertEquals(2L, evento.items().get(1).getEstacionId());
        // HU012 Escenario 4: cada ítem sabe cuántos ítems tiene el pedido en otras estaciones
        assertEquals(1, lomo.getItemsEnOtrasEstaciones());
    }

    @Test
    @DisplayName("HU011 Escenario 5: Reasignar el plato de estación no mueve los ítems ya enviados")
    void crearComanda_EstacionFijadaAlPedir() {
        CrearPedidoRequest req = new CrearPedidoRequest();
        req.setCanalId(1L);
        req.setMesaId(8L);
        req.setItems(List.of(new ItemPedidoRequest(50L, 1, null)));
        prepararAperturaValida();
        java.util.List<Pedido> guardados = new java.util.ArrayList<>();
        when(pedidoRepository.saveAndFlush(any(Pedido.class))).thenAnswer(invocation -> {
            Pedido p = invocation.getArgument(0);
            guardados.add(p);
            return p;
        });

        pedidoService.crearComanda(req, "angie");

        Estacion frituras = new Estacion();
        frituras.setId(9L);
        frituras.setNombre("Frituras");
        plato.setEstacion(frituras); // el administrador mueve el plato después del envío

        // El ítem persistido conserva su estación aunque el plato ahora apunte a otra
        DetallePedido itemEnviado = guardados.get(0).getItems().get(0);
        assertEquals("Plancha", itemEnviado.getEstacion().getNombre());
        assertEquals("Frituras", itemEnviado.getPlato().getEstacion().getNombre());

        PedidoResponse nuevo = pedidoService.crearComanda(req, "angie");
        assertEquals("Frituras", nuevo.getItems().get(0).getEstacionNombre());
    }

    // HU019/HU020: canal y expedidor para los pedidos externos (todo lenient: cada caso se rechaza en un punto distinto)
    private Usuario prepararExterno(Long canalId, String codigo, String nombre, boolean agregador) {
        CanalVenta canal = new CanalVenta();
        canal.setId(canalId);
        canal.setCodigo(codigo);
        canal.setNombre(nombre);
        canal.setActivo(true);
        canal.setExterno(agregador);
        Usuario expedidor = new Usuario();
        expedidor.setId(20L);
        expedidor.setUsername("expedidor1");
        expedidor.setNombre("Jorge");
        expedidor.setApellido("Guerra");
        lenient().when(canalRepository.findById(canalId)).thenReturn(Optional.of(canal));
        lenient().when(usuarioRepository.findByUsername("expedidor1")).thenReturn(Optional.of(expedidor));
        lenient().when(platoRepository.findById(50L)).thenReturn(Optional.of(plato));
        lenient().when(pedidoRepository.obtenerSiguienteValorSecuencia()).thenReturn(1L);
        lenient().when(pedidoRepository.saveAndFlush(any(Pedido.class))).thenAnswer(invocation -> invocation.getArgument(0));
        return expedidor;
    }

    private CrearPedidoRequest externo(Long canalId, String numeroOrden, String nombre, String celular) {
        CrearPedidoRequest req = new CrearPedidoRequest();
        req.setCanalId(canalId);
        req.setNumeroOrdenExterno(numeroOrden);
        req.setClienteNombre(nombre);
        req.setClienteTelefono(celular);
        req.setClienteDireccion("Av. Brasil 123");
        req.setItems(List.of(new ItemPedidoRequest(50L, 2, "Sin cebolla")));
        return req;
    }

    @Test
    @DisplayName("HU020 Escenario 3: Un pedido de Rappi exige el número de orden del agregador y lo guarda y devuelve para la tarjeta")
    void externo_Rappi_GuardaElNumeroDeOrden() {
        Usuario expedidor = prepararExterno(5L, "RAPPI", "Rappi", true);

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class,
                () -> pedidoService.registrarComanda(externo(5L, "  ", null, null), "expedidor1", true));
        assertTrue(ex.getMessage().contains("número de orden de Rappi"));
        verify(pedidoRepository, never()).saveAndFlush(any());

        PedidoResponse respuesta = pedidoService.registrarComanda(externo(5L, " RP-48213 ", null, null), "expedidor1", true).pedido();

        assertEquals("RP-48213", respuesta.getNumeroOrdenExterno());
        assertEquals("Rappi", respuesta.getCanalNombre());
        assertEquals("ENVIADO", respuesta.getEstado());
        assertEquals("Sin cebolla", respuesta.getItems().get(0).getModificadores());
        verify(trazabilidadService).registrarPedido(any(), isNull(), eq("ENVIADO"), eq(expedidor), eq("Pedido externo registrado (Rappi)"));
        // D32: queda marcado como registro externo, que es lo que permite al expedidor listarlo y anular sus ítems
        assertTrue(pedidoGuardado().getRegistroExterno());
    }

    @Test
    @DisplayName("HU021 Escenario 4: La primera comanda de una mesa es la original y las siguientes de la misma atención son adiciones")
    void comanda_NumeraLasAdicionesDeLaAtencion() {
        CrearPedidoRequest req = new CrearPedidoRequest();
        req.setCanalId(1L);
        req.setMesaId(8L);
        req.setItems(List.of(new ItemPedidoRequest(50L, 1, null)));
        prepararAperturaValida();
        when(pedidoRepository.countByAtencionId(any())).thenReturn(0L, 2L);

        pedidoService.crearComanda(req, "angie");
        pedidoService.crearComanda(req, "angie");

        org.mockito.ArgumentCaptor<Pedido> captor = org.mockito.ArgumentCaptor.forClass(Pedido.class);
        verify(pedidoRepository, times(2)).saveAndFlush(captor.capture());
        assertEquals(0, captor.getAllValues().get(0).getNumeroAdicion());
        assertEquals(2, captor.getAllValues().get(1).getNumeroAdicion());
    }

    @Test
    @DisplayName("HU021 Escenario 4: Un pedido sin mesa (para llevar, delivery o externo) nunca es una adición")
    void pedidoSinMesa_NoEsAdicion() {
        prepararExterno(5L, "RAPPI", "Rappi", true);

        pedidoService.registrarComanda(externo(5L, "RP-7", null, null), "expedidor1", true);

        assertEquals(0, pedidoGuardado().getNumeroAdicion());
        verify(pedidoRepository, never()).countByAtencionId(any());
    }

    @Test
    @DisplayName("HU034 Escenario 5: Registrar a mano un número de orden que ya existe en el canal advierte con el pedido existente")
    void externo_NumeroDeOrdenRepetido_Advierte() {
        prepararExterno(5L, "RAPPI", "Rappi", true);
        when(pedidoRepository.findFirstByCanalIdAndNumeroOrdenExternoOrderByIdAsc(5L, "RP-48213"))
                .thenReturn(Optional.of(pedidoExistente()));

        pe.isil.kds.exception.OperacionNoPermitidaException ex = assertThrows(pe.isil.kds.exception.OperacionNoPermitidaException.class,
                () -> pedidoService.registrarComanda(externo(5L, " RP-48213 ", null, null), "expedidor1", true));

        assertTrue(ex.getMessage().contains("RP-48213") && ex.getMessage().contains("ya existe como CMD-261103-0009"), ex.getMessage());
        assertEquals(PedidoService.CODIGO_PEDIDO_EXTERNO_DUPLICADO, ex.getCodigo());
        verify(canalRepository).bloquearPorId(5L);
        verify(pedidoRepository, never()).saveAndFlush(any());
        verify(eventPublisher, never()).publishEvent(any(Object.class));
    }

    @Test
    @DisplayName("HU034 Escenario 3: El mismo número de orden en otro canal es otro pedido y se registra")
    void externo_MismoNumeroEnOtroCanal_SeRegistra() {
        prepararExterno(5L, "RAPPI", "Rappi", true);
        // Solo el canal 9 tiene ya ese número: en Rappi (5) no existe
        lenient().when(pedidoRepository.findFirstByCanalIdAndNumeroOrdenExternoOrderByIdAsc(9L, "RP-48213"))
                .thenReturn(Optional.of(pedidoExistente()));

        PedidoService.ResultadoEnvio resultado = pedidoService.registrarComanda(externo(5L, "RP-48213", null, null), "expedidor1", true);

        assertTrue(resultado.creado());
        assertEquals("RP-48213", resultado.pedido().getNumeroOrdenExterno());
    }

    @Test
    @DisplayName("HU034 Escenarios 1, 2 y 6: Un reenvío con los mismos ítems devuelve el pedido existente sin crear nada")
    void reenvioExterno_MismosItems_DevuelveElExistente() {
        Pedido existente = pedidoExistente();
        existente.getItems().get(0).setModificadores("Sin cebolla");
        existente.getItems().get(0).setCantidad(2);
        when(pedidoRepository.findFirstByCanalIdAndNumeroOrdenExternoOrderByIdAsc(5L, "RP-48213")).thenReturn(Optional.of(existente));

        var resultado = pedidoService.resolverReenvioExterno(externo(5L, " RP-48213 ", null, null));

        assertTrue(resultado.isPresent());
        assertFalse(resultado.get().creado());
        assertEquals(77L, resultado.get().pedido().getId());
        verify(canalRepository).bloquearPorId(5L);
        verify(pedidoRepository, never()).saveAndFlush(any());
        verify(eventPublisher, never()).publishEvent(any(Object.class));
    }

    @Test
    @DisplayName("HU034 Escenario 4: Un reenvío con otros ítems se rechaza informando el conflicto y el original no cambia")
    void reenvioExterno_OtrosItems_Conflicto() {
        Pedido existente = pedidoExistente();
        when(pedidoRepository.findFirstByCanalIdAndNumeroOrdenExternoOrderByIdAsc(5L, "RP-48213")).thenReturn(Optional.of(existente));

        pe.isil.kds.exception.OperacionNoPermitidaException ex = assertThrows(pe.isil.kds.exception.OperacionNoPermitidaException.class,
                () -> pedidoService.resolverReenvioExterno(externo(5L, "RP-48213", null, null)));

        assertEquals(PedidoService.CODIGO_PEDIDO_EXTERNO_CONFLICTO, ex.getCodigo());
        assertTrue(ex.getMessage().contains("CMD-261103-0009") && ex.getMessage().contains("otros ítems"), ex.getMessage());
        assertEquals(1, existente.getItems().get(0).getCantidad());
        verify(pedidoRepository, never()).saveAndFlush(any());
    }

    @Test
    @DisplayName("HU034: Un pedido sin número de orden (WhatsApp o teléfono) no se trata como reenvío")
    void reenvioExterno_SinNumero_NoAplica() {
        assertTrue(pedidoService.resolverReenvioExterno(externo(3L, null, "Ana", "987654321")).isEmpty());
        verify(canalRepository, never()).bloquearPorId(any());
    }

    @Test
    @DisplayName("D32: Un pedido del comandero no se marca como registro externo")
    void comandero_NoSeMarcaComoRegistroExterno() {
        CrearPedidoRequest req = new CrearPedidoRequest();
        req.setCanalId(1L);
        req.setMesaId(8L);
        req.setItems(List.of(new ItemPedidoRequest(50L, 1, null)));
        prepararAperturaValida();

        pedidoService.crearComanda(req, "angie");

        assertFalse(pedidoGuardado().getRegistroExterno());
    }

    @Test
    @DisplayName("D32: La lista de pedidos externos recientes consulta las últimas 24 horas y devuelve su detalle")
    void listarExternosRecientes_ConsultaLaVentanaDe24Horas() {
        when(pedidoRepository.findByRegistroExternoTrueAndCreatedAtGreaterThanEqualOrderByCreatedAtDesc(any(java.time.LocalDateTime.class)))
                .thenReturn(List.of(pedidoExistente()));
        java.time.LocalDateTime antes = java.time.LocalDateTime.now();

        List<PedidoResponse> lista = pedidoService.listarExternosRecientes();

        assertEquals(1, lista.size());
        assertEquals(77L, lista.get(0).getId());
        org.mockito.ArgumentCaptor<java.time.LocalDateTime> desde = org.mockito.ArgumentCaptor.forClass(java.time.LocalDateTime.class);
        verify(pedidoRepository).findByRegistroExternoTrueAndCreatedAtGreaterThanEqualOrderByCreatedAtDesc(desde.capture());
        assertTrue(desde.getValue().isAfter(antes.minusHours(24).minusMinutes(1)) && desde.getValue().isBefore(antes.minusHours(24).plusMinutes(1)),
                desde.getValue().toString());
    }

    @Test
    @DisplayName("HU020 Escenario 4: Un pedido de WhatsApp o teléfono (Delivery propio) sin nombre o celular válido se rechaza indicando el dato")
    void externo_DeliveryPropio_ExigeNombreYCelular() {
        prepararExterno(3L, "DELIVERY", "Delivery propio", false);

        IllegalArgumentException sinNombre = assertThrows(IllegalArgumentException.class,
                () -> pedidoService.registrarComanda(externo(3L, null, " ", "987654321"), "expedidor1", true));
        assertTrue(sinNombre.getMessage().contains("nombre"));
        for (String celular : new String[] {null, "98765432", "887654321", "98765432a"}) {
            IllegalArgumentException invalido = assertThrows(IllegalArgumentException.class,
                    () -> pedidoService.registrarComanda(externo(3L, null, "Ana", celular), "expedidor1", true), String.valueOf(celular));
            assertTrue(invalido.getMessage().contains("celular"), String.valueOf(celular));
        }
        verify(pedidoRepository, never()).saveAndFlush(any());

        // Delivery propio entrega a domicilio: sin dirección no se registra
        CrearPedidoRequest sinDireccion = externo(3L, null, "Ana", "987654321");
        sinDireccion.setClienteDireccion("  ");
        IllegalArgumentException faltaDireccion = assertThrows(IllegalArgumentException.class,
                () -> pedidoService.registrarComanda(sinDireccion, "expedidor1", true));
        assertTrue(faltaDireccion.getMessage().contains("dirección"));
        verify(pedidoRepository, never()).saveAndFlush(any());

        PedidoResponse respuesta = pedidoService.registrarComanda(externo(3L, null, " Ana Ruiz ", "987654321"), "expedidor1", true).pedido();

        assertEquals("Ana Ruiz", respuesta.getClienteNombre());
        assertEquals("987654321", respuesta.getClienteTelefono());
        assertNull(respuesta.getNumeroOrdenExterno());
        assertEquals("Av. Brasil 123", pedidoGuardado().getClienteDireccion());
    }

    @Test
    @DisplayName("HU020: Rappi no guarda celular ni dirección del cliente aunque lleguen; el nombre sí es opcional")
    void externo_Rappi_DescartaCelularYDireccion() {
        prepararExterno(5L, "RAPPI", "Rappi", true);

        PedidoResponse respuesta = pedidoService.registrarComanda(externo(5L, "RP-9", "Ana", "12345"), "expedidor1", true).pedido();

        assertEquals("Ana", respuesta.getClienteNombre());
        assertNull(respuesta.getClienteTelefono());
        assertNull(pedidoGuardado().getClienteDireccion());
    }

    @Test
    @DisplayName("HU020: Para llevar es recojo en el local: guarda nombre y celular pero nunca la dirección")
    void externo_ParaLlevar_NoGuardaDireccion() {
        prepararExterno(4L, "PARA_LLEVAR", "Para Llevar", false);

        PedidoResponse respuesta = pedidoService.registrarComanda(externo(4L, null, "Ana", "987654321"), "expedidor1", true).pedido();

        assertEquals("Ana", respuesta.getClienteNombre());
        assertEquals("987654321", respuesta.getClienteTelefono());
        assertNull(pedidoGuardado().getClienteDireccion());
    }

    // Pedido que llegó a guardarse en el único envío exitoso del caso
    private Pedido pedidoGuardado() {
        org.mockito.ArgumentCaptor<Pedido> captor = org.mockito.ArgumentCaptor.forClass(Pedido.class);
        verify(pedidoRepository).saveAndFlush(captor.capture());
        return captor.getValue();
    }

    @Test
    @DisplayName("HU020 Escenario 5: El pedido externo se enruta a la estación del plato y avisa a cocina igual que el del comandero")
    void externo_SeEnrutaComoElDelComandero() {
        prepararExterno(5L, "RAPPI", "Rappi", true);

        PedidoResponse respuesta = pedidoService.registrarComanda(externo(5L, "RP-1", null, null), "expedidor1", true).pedido();

        assertEquals("Plancha", respuesta.getItems().get(0).getEstacionNombre());
        assertEquals("RECIBIDO", respuesta.getItems().get(0).getEstadoItem());
        verify(eventPublisher).publishEvent(any(NotificadorKds.ItemsKdsEvent.class));
        verify(eventPublisher).publishEvent(any(NotificadorKds.PedidoKdsEvent.class));
    }

    @Test
    @DisplayName("HU019 Escenario 3: Salón no es un canal externo: exige mesa y atención abierta")
    void externo_Salon_NoSeAdmite() {
        prepararExterno(1L, "SALON", "Salón", false);

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class,
                () -> pedidoService.registrarComanda(externo(1L, "X-1", "Ana", "987654321"), "expedidor1", true));

        assertTrue(ex.getMessage().contains("Salón no admite pedidos externos"));
        verify(pedidoRepository, never()).saveAndFlush(any());
    }

    @Test
    @DisplayName("HU019/HU020: Un canal de agregador no se puede usar desde el comandero del mozo")
    void comandero_NoAdmiteCanalDeAgregador() {
        prepararExterno(5L, "RAPPI", "Rappi", true);
        lenient().when(usuarioRepository.findByUsername("angie")).thenReturn(Optional.of(mozo));

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class,
                () -> pedidoService.crearComanda(externo(5L, "RP-1", null, null), "angie"));

        assertTrue(ex.getMessage().contains("no se toman desde el comandero"));
        verify(pedidoRepository, never()).saveAndFlush(any());
    }

    private void prepararAperturaValida() {
        when(canalRepository.findById(1L)).thenReturn(Optional.of(canalSalon));
        when(mesaRepository.bloquearPorId(8L)).thenReturn(Optional.of(mesa08));
        when(usuarioRepository.findByUsername("angie")).thenReturn(Optional.of(mozo));
        when(platoRepository.findById(anyLong())).thenReturn(Optional.of(plato));
        when(pedidoRepository.obtenerSiguienteValorSecuencia()).thenReturn(1L);
        // lenient: algunos tests sustituyen este stub para capturar el pedido guardado
        lenient().when(pedidoRepository.saveAndFlush(any(Pedido.class))).thenAnswer(invocation -> invocation.getArgument(0));
    }
}
