package pe.isil.kds;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.access.AccessDeniedException;
import pe.isil.kds.dto.AtencionMesaDto;
import pe.isil.kds.dto.PedidoResponse;
import pe.isil.kds.exception.OperacionNoPermitidaException;
import pe.isil.kds.exception.RecursoNoEncontradoException;
import pe.isil.kds.model.AtencionMesa;
import pe.isil.kds.model.Mesa;
import pe.isil.kds.model.Usuario;
import pe.isil.kds.model.Zona;
import pe.isil.kds.repository.AtencionMesaRepository;
import pe.isil.kds.repository.MesaRepository;
import pe.isil.kds.repository.UsuarioRepository;
import pe.isil.kds.security.SesionKds;
import pe.isil.kds.service.AtencionService;
import pe.isil.kds.service.PedidoService;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AtencionServiceTest {

    @Mock
    private AtencionMesaRepository atencionRepository;

    @Mock
    private MesaRepository mesaRepository;

    @Mock
    private UsuarioRepository usuarioRepository;

    @Mock
    private PedidoService pedidoService;

    @InjectMocks
    private AtencionService atencionService;

    private Zona terraza;
    private Mesa mesa13;
    private Usuario mozo;

    @BeforeEach
    void setUp() {
        terraza = new Zona();
        terraza.setId(2L);
        terraza.setNombre("Terraza");
        mesa13 = new Mesa();
        mesa13.setId(13L);
        mesa13.setNumeroMesa("13");
        mesa13.setZona(terraza);
        mesa13.setCapacidad(4);
        mozo = new Usuario();
        mozo.setId(10L);
        mozo.setUsername("angie");
        mozo.setNombre("Angie");
        mozo.setApellido("Valencia");
        mozo.getZonas().add(terraza);
    }

    private AtencionMesa abierta() {
        AtencionMesa a = new AtencionMesa();
        a.setId(70L);
        a.setMesa(mesa13);
        a.setMozo(mozo);
        a.setPersonas(3);
        return a;
    }

    private static PedidoResponse pedidoConItems(String... estados) {
        PedidoResponse p = new PedidoResponse();
        p.setItems(java.util.Arrays.stream(estados).map(e -> {
            PedidoResponse.DetalleItemResponse i = new PedidoResponse.DetalleItemResponse();
            i.setEstadoItem(e);
            return i;
        }).toList());
        return p;
    }

    private void mesaYMozo() {
        when(mesaRepository.bloquearPorId(13L)).thenReturn(Optional.of(mesa13));
        when(usuarioRepository.findByUsername("angie")).thenReturn(Optional.of(mozo));
    }

    // --- HU044

    @Test
    @DisplayName("HU044 Escenario 3: Entrar a una mesa libre con las personas abre su atención")
    void entrar_MesaLibre_AbreAtencion() {
        mesaYMozo();
        when(atencionRepository.findByMesaIdAndLiberadaEnIsNull(13L)).thenReturn(Optional.empty());
        when(atencionRepository.save(any(AtencionMesa.class))).thenAnswer(i -> {
            AtencionMesa a = i.getArgument(0);
            a.setId(71L);
            return a;
        });

        AtencionMesaDto dto = atencionService.entrar(13L, 4, "angie");

        assertEquals(71L, dto.getId());
        assertEquals(4, dto.getPersonas());
        assertEquals("Angie Valencia", dto.getMozoNombre());
        assertEquals("13", dto.getMesaNumero());
    }

    @Test
    @DisplayName("HU044 Escenario 3: Una mesa libre no se abre sin indicar las personas")
    void entrar_MesaLibre_SinPersonas() {
        mesaYMozo();
        when(atencionRepository.findByMesaIdAndLiberadaEnIsNull(13L)).thenReturn(Optional.empty());

        assertThrows(IllegalArgumentException.class, () -> atencionService.entrar(13L, null, "angie"));
        verify(atencionRepository, never()).save(any());
    }

    @Test
    @DisplayName("HU044 Escenario 3: Las personas no pueden superar la capacidad de la mesa")
    void entrar_MesaLibre_SuperaCapacidad() {
        mesaYMozo();
        when(atencionRepository.findByMesaIdAndLiberadaEnIsNull(13L)).thenReturn(Optional.empty());

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class, () -> atencionService.entrar(13L, 5, "angie"));
        assertTrue(ex.getMessage().contains("capacidad para 4"));
        verify(atencionRepository, never()).save(any());
    }

    @Test
    @DisplayName("HU044 Escenarios 4 y 5: Entrar a una mesa en atención devuelve la existente sin crear otra")
    void entrar_MesaEnAtencion_DevuelveExistente() {
        mesaYMozo();
        when(atencionRepository.findByMesaIdAndLiberadaEnIsNull(13L)).thenReturn(Optional.of(abierta()));
        when(pedidoService.pedidosDeAtencion(70L)).thenReturn(List.of(pedidoConItems("RECIBIDO")));

        AtencionMesaDto dto = atencionService.entrar(13L, 8, "angie");

        assertEquals(70L, dto.getId());
        assertEquals(3, dto.getPersonas(), "no se vuelven a pedir ni a cambiar las personas");
        assertEquals(1, dto.getPedidos().size());
        verify(atencionRepository, never()).save(any());
        verify(mesaRepository).bloquearPorId(13L);
    }

    @Test
    @DisplayName("HU043 / HU044: No se entra a una mesa de una zona no asignada")
    void entrar_ZonaNoAsignada() {
        mozo.getZonas().clear();
        mesaYMozo();

        assertThrows(AccessDeniedException.class, () -> atencionService.entrar(13L, 2, "angie"));
        verify(atencionRepository, never()).save(any());
    }

    @Test
    @DisplayName("HU041: No se entra a una mesa desactivada")
    void entrar_MesaInactiva() {
        mesa13.setActivo(false);
        when(mesaRepository.bloquearPorId(13L)).thenReturn(Optional.of(mesa13));

        assertThrows(OperacionNoPermitidaException.class, () -> atencionService.entrar(13L, 2, "angie"));
    }

    @Test
    @DisplayName("HU044: El admin consulta la atención de cualquier mesa; una mesa libre responde que está libre")
    void consultar() {
        when(mesaRepository.findById(13L)).thenReturn(Optional.of(mesa13));
        when(atencionRepository.findByMesaIdAndLiberadaEnIsNull(13L)).thenReturn(Optional.of(abierta()), Optional.empty());

        assertEquals(70L, atencionService.consultar(13L, new SesionKds("admin", "ADMIN", null)).getId());
        assertThrows(RecursoNoEncontradoException.class, () -> atencionService.consultar(13L, new SesionKds("admin", "ADMIN", null)));
    }

    // --- HU046

    @Test
    @DisplayName("HU046 Escenarios 1 y 5: Con todo despachado la mesa se libera y queda registrado quién y cuándo")
    void liberar_TodoDespachado() {
        mesaYMozo();
        AtencionMesa atencion = abierta();
        when(atencionRepository.findByMesaIdAndLiberadaEnIsNull(13L)).thenReturn(Optional.of(atencion));
        when(pedidoService.pedidosDeAtencion(70L)).thenReturn(List.of(pedidoConItems("DESPACHADO", "DESPACHADO")));
        when(atencionRepository.save(any(AtencionMesa.class))).thenAnswer(i -> i.getArgument(0));

        AtencionMesaDto dto = atencionService.liberar(13L, "angie");

        assertNotNull(dto.getLiberadaEn());
        assertEquals("Angie Valencia", dto.getLiberadaPorNombre());
        assertNotNull(dto.getAbiertaEn());
        assertFalse(atencion.estaAbierta());
    }

    @Test
    @DisplayName("HU046 Escenario 2: Con ítems por despachar no se libera e indica cuántos faltan")
    void liberar_ConPendientes() {
        mesaYMozo();
        when(atencionRepository.findByMesaIdAndLiberadaEnIsNull(13L)).thenReturn(Optional.of(abierta()));
        when(pedidoService.pedidosDeAtencion(70L)).thenReturn(List.of(pedidoConItems("DESPACHADO", "LISTO", "RECIBIDO")));

        OperacionNoPermitidaException ex = assertThrows(OperacionNoPermitidaException.class, () -> atencionService.liberar(13L, "angie"));
        assertTrue(ex.getMessage().contains("faltan 2 ítems"));
        verify(atencionRepository, never()).save(any());
    }

    @Test
    @DisplayName("HU046 Escenario 3: Los ítems anulados no impiden liberar")
    void liberar_AnuladosNoCuentan() {
        mesaYMozo();
        when(atencionRepository.findByMesaIdAndLiberadaEnIsNull(13L)).thenReturn(Optional.of(abierta()));
        when(pedidoService.pedidosDeAtencion(70L)).thenReturn(List.of(pedidoConItems("ANULADO", "DESPACHADO")));
        when(atencionRepository.save(any(AtencionMesa.class))).thenAnswer(i -> i.getArgument(0));

        assertNotNull(atencionService.liberar(13L, "angie").getLiberadaEn());
    }

    @Test
    @DisplayName("HU046 Escenario 4: Un mozo sin la zona de la mesa no la libera")
    void liberar_ZonaNoAsignada() {
        mozo.getZonas().clear();
        mesaYMozo();

        assertThrows(AccessDeniedException.class, () -> atencionService.liberar(13L, "angie"));
    }

    @Test
    @DisplayName("HU046: Liberar una mesa que ya está libre se rechaza")
    void liberar_YaLibre() {
        mesaYMozo();
        when(atencionRepository.findByMesaIdAndLiberadaEnIsNull(13L)).thenReturn(Optional.empty());

        assertThrows(OperacionNoPermitidaException.class, () -> atencionService.liberar(13L, "angie"));
    }
}
