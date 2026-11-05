package pe.isil.kds;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.context.ApplicationEventPublisher;
import pe.isil.kds.dto.GuardarPlatoRequest;
import pe.isil.kds.dto.PlatoDto;
import pe.isil.kds.model.CategoriaPlato;
import pe.isil.kds.model.Estacion;
import pe.isil.kds.model.Plato;
import pe.isil.kds.repository.CategoriaPlatoRepository;
import pe.isil.kds.repository.EstacionRepository;
import pe.isil.kds.repository.PlatoRepository;
import pe.isil.kds.service.NotificadorKds;
import pe.isil.kds.service.PlatoService;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class PlatoServiceTest {

    @Mock
    private PlatoRepository platoRepository;

    @Mock
    private CategoriaPlatoRepository categoriaRepository;

    @Mock
    private EstacionRepository estacionRepository;

    @Mock
    private ApplicationEventPublisher eventPublisher;

    @InjectMocks
    private PlatoService platoService;

    private CategoriaPlato categoria;
    private Estacion estacion;

    @BeforeEach
    void setUp() {
        categoria = new CategoriaPlato();
        categoria.setId(1L);
        categoria.setNombre("Fondos");

        estacion = new Estacion();
        estacion.setId(2L);
        estacion.setNombre("Plancha");
    }

    @Test
    @DisplayName("HU003 Escenario 1 & HU023: Registro de plato válido con tiempo estándar y estación")
    void crearPlato_Valido_Exitoso() {
        GuardarPlatoRequest req = new GuardarPlatoRequest();
        req.setNombre("Lomo Saltado");
        req.setDescripcion("Clásico");
        req.setCategoriaId(1L);
        req.setEstacionId(2L);
        req.setPrecio(new BigDecimal("32.00"));
        req.setTiempoEstandarMinutos(12);

        when(categoriaRepository.findById(1L)).thenReturn(Optional.of(categoria));
        when(estacionRepository.findById(2L)).thenReturn(Optional.of(estacion));

        Plato guardado = new Plato();
        guardado.setId(100L);
        guardado.setNombre("Lomo Saltado");
        guardado.setCategoria(categoria);
        guardado.setEstacion(estacion);
        guardado.setPrecio(new BigDecimal("32.00"));
        guardado.setTiempoEstandarMinutos(12);
        guardado.setDisponible(true);
        guardado.setActivo(true);

        when(platoRepository.save(any(Plato.class))).thenReturn(guardado);

        PlatoDto resultado = platoService.crearPlato(req);

        assertNotNull(resultado);
        assertEquals(100L, resultado.getId());
        assertEquals("Lomo Saltado", resultado.getNombre());
        assertEquals(12, resultado.getTiempoEstandarMinutos());
        assertEquals("Plancha", resultado.getEstacionNombre());
        // HU030: un plato nuevo aparece en los comanderos sin recargar
        verify(eventPublisher).publishEvent(new NotificadorKds.PlatoKdsEvent(100L, "Lomo Saltado", true));
    }

    @Test
    @DisplayName("HU003 Escenario 2: Intento de guardar plato sin estación es rechazado")
    void crearPlato_SinEstacion_EsRechazado() {
        GuardarPlatoRequest req = new GuardarPlatoRequest();
        req.setNombre("Ceviche");
        req.setCategoriaId(1L);
        req.setEstacionId(null);
        req.setPrecio(new BigDecimal("28.00"));
        req.setTiempoEstandarMinutos(8);

        assertThrows(IllegalArgumentException.class, () -> platoService.crearPlato(req));
        verify(platoRepository, never()).save(any());
    }

    @Test
    @DisplayName("HU023 Escenario 2: Tiempo estándar <= 0 es rechazado")
    void crearPlato_TiempoInvalido_EsRechazado() {
        GuardarPlatoRequest req = new GuardarPlatoRequest();
        req.setNombre("Chicha Morada");
        req.setCategoriaId(1L);
        req.setEstacionId(2L);
        req.setPrecio(new BigDecimal("5.00"));
        req.setTiempoEstandarMinutos(0);

        assertThrows(IllegalArgumentException.class, () -> platoService.crearPlato(req));
        verify(platoRepository, never()).save(any());
    }

    private Plato lomo(boolean disponible) {
        Plato p = new Plato();
        p.setId(100L);
        p.setNombre("Lomo Saltado");
        p.setCategoria(categoria);
        p.setEstacion(estacion);
        p.setPrecio(new BigDecimal("32.00"));
        p.setTiempoEstandarMinutos(12);
        p.setDisponible(disponible);
        p.setActivo(true);
        return p;
    }

    @Test
    @DisplayName("HU030 Escenario 1: Agotar un plato avisa a los comanderos por /topic/platos")
    void cambiarDisponibilidad_Agotar_Avisa() {
        Plato plato = lomo(true);
        when(platoRepository.findById(100L)).thenReturn(Optional.of(plato));
        when(platoRepository.save(any(Plato.class))).thenAnswer(i -> i.getArgument(0));

        PlatoDto dto = platoService.cambiarDisponibilidad(100L, false);

        assertFalse(dto.getDisponible());
        verify(eventPublisher).publishEvent(new NotificadorKds.PlatoKdsEvent(100L, "Lomo Saltado", false));
    }

    @Test
    @DisplayName("HU030 Escenario 2: Reactivar un plato agotado también se avisa")
    void cambiarDisponibilidad_Reactivar_Avisa() {
        Plato plato = lomo(false);
        when(platoRepository.findById(100L)).thenReturn(Optional.of(plato));
        when(platoRepository.save(any(Plato.class))).thenAnswer(i -> i.getArgument(0));

        assertTrue(platoService.cambiarDisponibilidad(100L, true).getDisponible());
        verify(eventPublisher).publishEvent(new NotificadorKds.PlatoKdsEvent(100L, "Lomo Saltado", true));
    }

    @Test
    @DisplayName("HU030 Escenario 5: Un plato agotado sigue en el catálogo identificado como agotado")
    void listar_IncluyeAgotados() {
        when(platoRepository.findByActivoTrue()).thenReturn(List.of(lomo(false)));

        List<PlatoDto> platos = platoService.listarPlatos(null, null);

        assertEquals(1, platos.size());
        assertFalse(platos.get(0).getDisponible());
    }

    @Test
    @DisplayName("HU030: Agotar un plato desde el formulario de edición también se avisa")
    void actualizarPlato_Avisa() {
        Plato plato = lomo(true);
        GuardarPlatoRequest req = new GuardarPlatoRequest();
        req.setNombre("Lomo Saltado");
        req.setCategoriaId(1L);
        req.setEstacionId(2L);
        req.setPrecio(new BigDecimal("32.00"));
        req.setTiempoEstandarMinutos(12);
        req.setDisponible(false);
        when(platoRepository.findById(100L)).thenReturn(Optional.of(plato));
        when(categoriaRepository.findById(1L)).thenReturn(Optional.of(categoria));
        when(estacionRepository.findById(2L)).thenReturn(Optional.of(estacion));
        when(platoRepository.save(any(Plato.class))).thenAnswer(i -> i.getArgument(0));

        platoService.actualizarPlato(100L, req);

        verify(eventPublisher).publishEvent(new NotificadorKds.PlatoKdsEvent(100L, "Lomo Saltado", false));
    }
}
