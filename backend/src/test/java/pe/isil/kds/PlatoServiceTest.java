package pe.isil.kds;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import pe.isil.kds.dto.GuardarPlatoRequest;
import pe.isil.kds.dto.PlatoDto;
import pe.isil.kds.model.CategoriaPlato;
import pe.isil.kds.model.Estacion;
import pe.isil.kds.model.Plato;
import pe.isil.kds.repository.CategoriaPlatoRepository;
import pe.isil.kds.repository.EstacionRepository;
import pe.isil.kds.repository.PlatoRepository;
import pe.isil.kds.service.PlatoService;

import java.math.BigDecimal;
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
}
