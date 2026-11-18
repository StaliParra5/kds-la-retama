package pe.isil.kds;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import pe.isil.kds.dto.SalonDto;
import pe.isil.kds.dto.SemaforoDto;
import pe.isil.kds.model.*;
import pe.isil.kds.repository.*;
import pe.isil.kds.service.SalonService;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class SalonServiceTest {

    @Mock
    private ConfiguracionSemaforoRepository semaforoRepository;

    @Mock
    private ZonaRepository zonaRepository;

    @Mock
    private MesaRepository mesaRepository;

    @Mock
    private AtencionMesaRepository atencionRepository;

    @Mock
    private PedidoRepository pedidoRepository;

    @Mock
    private UsuarioRepository usuarioRepository;

    @InjectMocks
    private SalonService salonService;

    private static final LocalDateTime AHORA = LocalDateTime.of(2026, 11, 4, 20, 0);
    private Zona terraza;
    private Usuario angie;
    private long secuencia = 100;

    @BeforeEach
    void setUp() {
        terraza = new Zona();
        terraza.setId(2L);
        terraza.setNombre("Terraza");
        angie = new Usuario();
        angie.setId(10L);
        angie.setNombre("Angie");
        angie.setApellido("Valencia");
        angie.setActivo(true);
        angie.getZonas().add(terraza);
    }

    private Mesa mesa(long id, String numero) {
        Mesa m = new Mesa();
        m.setId(id);
        m.setNumeroMesa(numero);
        m.setZona(terraza);
        return m;
    }

    private AtencionMesa atencion(Mesa mesa) {
        AtencionMesa a = new AtencionMesa();
        a.setId(secuencia++);
        a.setMesa(mesa);
        a.setMozo(angie);
        a.setPersonas(3);
        a.setAbiertaEn(AHORA.minusMinutes(60));
        return a;
    }

    private Pedido pedido(AtencionMesa atencion, int minutosDesdeEnvio, EstadoItem... estados) {
        Pedido p = new Pedido();
        p.setId(secuencia++);
        p.setAtencion(atencion);
        p.setFechaEnvioCocina(AHORA.minusMinutes(minutosDesdeEnvio));
        for (EstadoItem e : estados) {
            DetallePedido d = new DetallePedido();
            d.setEstadoItem(e);
            p.getItems().add(d);
        }
        return p;
    }

    private SalonDto.Mesa estadoDe(List<Mesa> mesas, List<AtencionMesa> atenciones, List<Pedido> pedidos, long mesaId) {
        when(semaforoRepository.findById(ConfiguracionSemaforo.ID_UNICO)).thenReturn(Optional.empty());
        when(zonaRepository.findByActivoTrue()).thenReturn(List.of(terraza));
        when(mesaRepository.findByActivoTrueAndZonaActivoTrue()).thenReturn(mesas);
        when(atencionRepository.findByLiberadaEnIsNull()).thenReturn(atenciones);
        lenient().when(pedidoRepository.findByAtencionIdIn(anyCollection())).thenReturn(pedidos);
        when(usuarioRepository.findByRolCodigoOrderByApellidoAscNombreAsc("MOZO")).thenReturn(List.of(angie));
        SalonDto salon = salonService.vistaSalon(AHORA);
        return salon.zonas().get(0).mesas().stream().filter(m -> m.id() == mesaId).findFirst().orElseThrow();
    }

    // --- HU047

    @Test
    @DisplayName("HU047 Escenario 1: Sin configuración previa amarillo inicia a los 20 y rojo a los 30 minutos")
    void semaforo_PorDefecto() {
        when(semaforoRepository.findById(ConfiguracionSemaforo.ID_UNICO)).thenReturn(Optional.empty());

        SemaforoDto s = salonService.semaforo();

        assertEquals(20, s.getMinutosAmarillo());
        assertEquals(30, s.getMinutosRojo());
    }

    @Test
    @DisplayName("HU047 Escenario 2: El administrador guarda nuevos umbrales")
    void semaforo_Actualiza() {
        when(semaforoRepository.findById(ConfiguracionSemaforo.ID_UNICO)).thenReturn(Optional.of(new ConfiguracionSemaforo()));
        when(semaforoRepository.save(any(ConfiguracionSemaforo.class))).thenAnswer(i -> i.getArgument(0));

        SemaforoDto s = salonService.actualizarSemaforo(10, 15);

        assertEquals(10, s.getMinutosAmarillo());
        assertEquals(15, s.getMinutosRojo());
    }

    @Test
    @DisplayName("HU047 Escenario 3: Amarillo no mayor que cero o rojo no mayor que amarillo se rechaza indicando la regla")
    void semaforo_Invalido() {
        IllegalArgumentException cero = assertThrows(IllegalArgumentException.class, () -> salonService.actualizarSemaforo(0, 10));
        assertTrue(cero.getMessage().contains("amarillo"));
        IllegalArgumentException rojo = assertThrows(IllegalArgumentException.class, () -> salonService.actualizarSemaforo(20, 20));
        assertTrue(rojo.getMessage().contains("rojo"));
        verify(semaforoRepository, never()).save(any());
    }

    // --- HU048 Escenario 2: colores

    @Test
    @DisplayName("HU048 Escenario 2: Una mesa sin atención está libre (gris)")
    void mesaLibre() {
        Mesa m = mesa(1, "13");
        SalonDto.Mesa r = estadoDe(List.of(m), List.of(), List.of(), 1);

        assertEquals(SalonDto.EstadoMesa.LIBRE, r.estado());
        assertNull(r.personas());
        verify(pedidoRepository, never()).findByAtencionIdIn(anyCollection());
    }

    @Test
    @DisplayName("HU048 Escenario 2: Verde antes del umbral amarillo, amarillo desde 20 y rojo desde 30 minutos")
    void coloresPorEspera() {
        Mesa verde = mesa(1, "13");
        Mesa amarilla = mesa(2, "14");
        Mesa roja = mesa(3, "15");
        AtencionMesa aV = atencion(verde);
        AtencionMesa aA = atencion(amarilla);
        AtencionMesa aR = atencion(roja);
        List<Pedido> pedidos = List.of(
                pedido(aV, 19, EstadoItem.RECIBIDO),
                pedido(aA, 20, EstadoItem.EN_PREPARACION),
                pedido(aR, 30, EstadoItem.LISTO));
        List<Mesa> mesas = List.of(verde, amarilla, roja);
        List<AtencionMesa> atenciones = List.of(aV, aA, aR);

        assertEquals(SalonDto.EstadoMesa.VERDE, estadoDe(mesas, atenciones, pedidos, 1).estado());
        assertEquals(SalonDto.EstadoMesa.AMARILLO, estadoDe(mesas, atenciones, pedidos, 2).estado());
        SalonDto.Mesa r = estadoDe(mesas, atenciones, pedidos, 3);
        assertEquals(SalonDto.EstadoMesa.ROJO, r.estado());
        assertEquals(30, r.minutosEspera());
    }

    @Test
    @DisplayName("HU048 Escenario 2: La espera se mide desde el pedido pendiente más antiguo; uno ya despachado no cuenta")
    void esperaDelPendienteMasAntiguo() {
        Mesa m = mesa(1, "13");
        AtencionMesa a = atencion(m);
        List<Pedido> pedidos = List.of(
                pedido(a, 45, EstadoItem.DESPACHADO),
                pedido(a, 25, EstadoItem.RECIBIDO, EstadoItem.DESPACHADO),
                pedido(a, 5, EstadoItem.RECIBIDO));

        SalonDto.Mesa r = estadoDe(List.of(m), List.of(a), pedidos, 1);

        assertEquals(25, r.minutosEspera());
        assertEquals(SalonDto.EstadoMesa.AMARILLO, r.estado());
        assertEquals(2, r.itemsPendientes());
    }

    @Test
    @DisplayName("HU048 Escenario 2: Todo despachado o anulado y sin liberar es Atendida (azul)")
    void mesaAtendida() {
        Mesa m = mesa(1, "13");
        AtencionMesa a = atencion(m);
        List<Pedido> pedidos = List.of(pedido(a, 50, EstadoItem.DESPACHADO, EstadoItem.ANULADO));

        SalonDto.Mesa r = estadoDe(List.of(m), List.of(a), pedidos, 1);

        assertEquals(SalonDto.EstadoMesa.ATENDIDA, r.estado());
        assertNull(r.minutosEspera());
    }

    @Test
    @DisplayName("HU048 Escenario 2: Una mesa recién abierta sin pedidos también figura como Atendida (no espera cocina)")
    void mesaAbiertaSinPedidos() {
        Mesa m = mesa(1, "13");
        AtencionMesa a = atencion(m);

        assertEquals(SalonDto.EstadoMesa.ATENDIDA, estadoDe(List.of(m), List.of(a), List.of(), 1).estado());
    }

    @Test
    @DisplayName("HU047 Escenario 2: La vista aplica los umbrales guardados")
    void aplicaUmbralesGuardados() {
        ConfiguracionSemaforo c = new ConfiguracionSemaforo();
        c.setMinutosAmarillo(5);
        c.setMinutosRojo(10);
        Mesa m = mesa(1, "13");
        AtencionMesa a = atencion(m);
        when(semaforoRepository.findById(ConfiguracionSemaforo.ID_UNICO)).thenReturn(Optional.of(c));
        when(zonaRepository.findByActivoTrue()).thenReturn(List.of(terraza));
        when(mesaRepository.findByActivoTrueAndZonaActivoTrue()).thenReturn(List.of(m));
        when(atencionRepository.findByLiberadaEnIsNull()).thenReturn(List.of(a));
        when(pedidoRepository.findByAtencionIdIn(anyCollection())).thenReturn(List.of(pedido(a, 12, EstadoItem.RECIBIDO)));
        when(usuarioRepository.findByRolCodigoOrderByApellidoAscNombreAsc("MOZO")).thenReturn(List.of());

        SalonDto salon = salonService.vistaSalon(AHORA);

        assertEquals(SalonDto.EstadoMesa.ROJO, salon.zonas().get(0).mesas().get(0).estado());
        assertEquals(5, salon.semaforo().getMinutosAmarillo());
    }

    // --- HU048 Escenario 4: detalle

    @Test
    @DisplayName("HU048 Escenario 4: La mesa trae mozo que la abrió y personas; la zona trae sus mozos activos")
    void detalleDeMesaYZona() {
        Usuario inactivo = new Usuario();
        inactivo.setNombre("Ex");
        inactivo.setApellido("Mozo");
        inactivo.setActivo(false);
        inactivo.getZonas().add(terraza);
        Mesa m = mesa(1, "13");
        AtencionMesa a = atencion(m);
        when(semaforoRepository.findById(ConfiguracionSemaforo.ID_UNICO)).thenReturn(Optional.empty());
        when(zonaRepository.findByActivoTrue()).thenReturn(List.of(terraza));
        when(mesaRepository.findByActivoTrueAndZonaActivoTrue()).thenReturn(List.of(m));
        when(atencionRepository.findByLiberadaEnIsNull()).thenReturn(List.of(a));
        when(pedidoRepository.findByAtencionIdIn(anyCollection())).thenReturn(List.of());
        when(usuarioRepository.findByRolCodigoOrderByApellidoAscNombreAsc("MOZO")).thenReturn(List.of(angie, inactivo));

        SalonDto.Zona zona = salonService.vistaSalon(AHORA).zonas().get(0);

        assertEquals(List.of("Angie Valencia"), zona.mozos());
        assertEquals("Angie Valencia", zona.mesas().get(0).mozoNombre());
        assertEquals(3, zona.mesas().get(0).personas());
    }
}
