package pe.isil.kds;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import pe.isil.kds.dto.MesaDto;
import pe.isil.kds.dto.ZonaDto;
import pe.isil.kds.exception.OperacionNoPermitidaException;
import pe.isil.kds.model.Mesa;
import pe.isil.kds.model.Zona;
import pe.isil.kds.repository.MesaRepository;
import pe.isil.kds.repository.PedidoRepository;
import pe.isil.kds.repository.ZonaRepository;
import pe.isil.kds.service.MesaService;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class MesaServiceTest {

    @Mock
    private ZonaRepository zonaRepository;

    @Mock
    private MesaRepository mesaRepository;

    @Mock
    private PedidoRepository pedidoRepository;

    @InjectMocks
    private MesaService mesaService;

    private Zona salon;
    private Zona terraza;
    private Mesa mesa05;

    @BeforeEach
    void setUp() {
        salon = zona(1L, "Salón Principal", true);
        terraza = zona(2L, "Terraza", true);
        mesa05 = mesa(10L, salon, "05");
    }

    // --- HU040: zonas

    @Test
    @DisplayName("HU040 Escenario 1: Se registra una zona con un nombre no usado")
    void crearZona_NombreLibre() {
        when(zonaRepository.findByNombreIgnoreCase("Rooftop")).thenReturn(Optional.empty());
        when(zonaRepository.save(any(Zona.class))).thenAnswer(i -> {
            Zona z = i.getArgument(0);
            z.setId(5L);
            return z;
        });

        ZonaDto creada = mesaService.crearZona("  Rooftop ", "Azotea");

        assertEquals(5L, creada.getId());
        assertEquals("Rooftop", creada.getNombre());
        assertTrue(creada.getActivo());
    }

    @Test
    @DisplayName("HU040 Escenario 2: Una zona con nombre existente (sin distinguir mayúsculas) es rechazada")
    void crearZona_NombreDuplicado() {
        when(zonaRepository.findByNombreIgnoreCase("terraza")).thenReturn(Optional.of(terraza));

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class,
                () -> mesaService.crearZona("terraza", null));
        assertTrue(ex.getMessage().contains("Ya existe una zona"));
        verify(zonaRepository, never()).save(any());
    }

    @Test
    @DisplayName("HU040 Escenario 3: El administrador edita el nombre y la descripción de una zona")
    void editarZona_CambiaDatos() {
        when(zonaRepository.findById(2L)).thenReturn(Optional.of(terraza));
        when(zonaRepository.findByNombreIgnoreCase("Terraza Norte")).thenReturn(Optional.empty());
        when(zonaRepository.save(any(Zona.class))).thenAnswer(i -> i.getArgument(0));

        ZonaDto editada = mesaService.editarZona(2L, "Terraza Norte", "Con toldo");

        assertEquals("Terraza Norte", editada.getNombre());
        assertEquals("Con toldo", editada.getDescripcion());
    }

    @Test
    @DisplayName("HU040 Escenario 3: Editar una zona conservando su propio nombre no es un duplicado")
    void editarZona_MismoNombre() {
        when(zonaRepository.findById(2L)).thenReturn(Optional.of(terraza));
        when(zonaRepository.findByNombreIgnoreCase("TERRAZA")).thenReturn(Optional.of(terraza));
        when(zonaRepository.save(any(Zona.class))).thenAnswer(i -> i.getArgument(0));

        assertEquals("TERRAZA", mesaService.editarZona(2L, "TERRAZA", null).getNombre());
    }

    @Test
    @DisplayName("HU040 Escenario 4: Una zona sin mesas en atención se desactiva")
    void desactivarZona_SinAtencion() {
        when(zonaRepository.findById(1L)).thenReturn(Optional.of(salon));
        when(pedidoRepository.idsMesasConPedidoEn(anyList())).thenReturn(List.of());
        when(mesaRepository.bloquearPorZona(1L)).thenReturn(List.of(mesa05));
        when(zonaRepository.save(any(Zona.class))).thenAnswer(i -> i.getArgument(0));

        assertFalse(mesaService.cambiarEstadoZona(1L, false).getActivo());
        assertFalse(salon.getActivo());
    }

    @Test
    @DisplayName("HU040 Escenario 5: Una zona con mesas en atención no se desactiva e indica cuáles")
    void desactivarZona_ConMesasEnAtencion() {
        when(zonaRepository.findById(1L)).thenReturn(Optional.of(salon));
        when(pedidoRepository.idsMesasConPedidoEn(anyList())).thenReturn(List.of(10L));
        when(mesaRepository.bloquearPorZona(1L)).thenReturn(List.of(mesa05, mesa(11L, salon, "06")));

        OperacionNoPermitidaException ex = assertThrows(OperacionNoPermitidaException.class,
                () -> mesaService.cambiarEstadoZona(1L, false));
        assertTrue(ex.getMessage().contains("05"));
        assertFalse(ex.getMessage().contains("06"));
        assertTrue(salon.getActivo());
        verify(zonaRepository, never()).save(any());
    }

    @Test
    @DisplayName("HU040 Escenario 6: Una zona inactiva se reactiva")
    void reactivarZona() {
        salon.setActivo(false);
        when(zonaRepository.findById(1L)).thenReturn(Optional.of(salon));
        when(zonaRepository.save(any(Zona.class))).thenAnswer(i -> i.getArgument(0));

        assertTrue(mesaService.cambiarEstadoZona(1L, true).getActivo());
        verify(pedidoRepository, never()).idsMesasConPedidoEn(anyList());
    }

    @Test
    @DisplayName("HU040 Escenario 4: Administración ve también zonas y mesas inactivas, con la marca de atención")
    void listarZonasAdmin_IncluyeInactivas() {
        Zona barra = zona(3L, "Barra", false);
        Mesa b1 = mesa(20L, barra, "B1");
        b1.setActivo(false);
        when(zonaRepository.findAllByOrderByIdAsc()).thenReturn(List.of(salon, barra));
        when(mesaRepository.findAll()).thenReturn(List.of(b1, mesa05));
        when(pedidoRepository.idsMesasConPedidoEn(anyList())).thenReturn(List.of(10L));

        List<ZonaDto> zonas = mesaService.listarZonasAdmin();

        assertEquals(2, zonas.size());
        assertFalse(zonas.get(1).getActivo());
        assertFalse(zonas.get(1).getMesas().get(0).getActivo());
        assertTrue(zonas.get(0).getMesas().get(0).isEnAtencion());
    }

    // --- HU041: mesas

    @Test
    @DisplayName("HU041 Escenario 1: Se edita el número y la capacidad de una mesa")
    void editarMesa_NumeroYCapacidad() {
        when(mesaRepository.bloquearPorId(10L)).thenReturn(Optional.of(mesa05));
        when(zonaRepository.findById(1L)).thenReturn(Optional.of(salon));
        when(pedidoRepository.existsByMesaIdAndEstadoIn(anyLong(), anyList())).thenReturn(false);
        when(mesaRepository.findByZonaIdAndNumeroMesaIgnoreCase(1L, "5A")).thenReturn(Optional.empty());
        when(mesaRepository.save(any(Mesa.class))).thenAnswer(i -> i.getArgument(0));

        MesaDto editada = mesaService.editarMesa(10L, 1L, " 5A ", 6);

        assertEquals("5A", editada.getNumeroMesa());
        assertEquals(6, editada.getCapacidad());
    }

    @Test
    @DisplayName("HU041 Escenario 2: Un número ya usado en la zona es rechazado")
    void editarMesa_NumeroDuplicado() {
        Mesa mesa06 = mesa(11L, salon, "06");
        when(mesaRepository.bloquearPorId(11L)).thenReturn(Optional.of(mesa06));
        when(zonaRepository.findById(1L)).thenReturn(Optional.of(salon));
        when(pedidoRepository.existsByMesaIdAndEstadoIn(anyLong(), anyList())).thenReturn(false);
        when(mesaRepository.findByZonaIdAndNumeroMesaIgnoreCase(1L, "05")).thenReturn(Optional.of(mesa05));

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class,
                () -> mesaService.editarMesa(11L, 1L, "05", 4));
        assertTrue(ex.getMessage().contains("Ya existe una mesa"));
        verify(mesaRepository, never()).save(any());
    }

    @Test
    @DisplayName("HU041 Escenario 3: Una mesa sin atención se mueve a otra zona")
    void editarMesa_MoverZona() {
        when(mesaRepository.bloquearPorId(10L)).thenReturn(Optional.of(mesa05));
        when(zonaRepository.findById(2L)).thenReturn(Optional.of(terraza));
        when(pedidoRepository.existsByMesaIdAndEstadoIn(anyLong(), anyList())).thenReturn(false);
        when(mesaRepository.findByZonaIdAndNumeroMesaIgnoreCase(2L, "05")).thenReturn(Optional.empty());
        when(mesaRepository.save(any(Mesa.class))).thenAnswer(i -> i.getArgument(0));

        MesaDto movida = mesaService.editarMesa(10L, 2L, "05", 4);

        assertEquals(2L, movida.getZonaId());
        assertEquals("Terraza", movida.getZonaNombre());
    }

    @Test
    @DisplayName("HU041 Escenario 3: No se mueve a una zona donde su número ya existe")
    void editarMesa_MoverZona_NumeroOcupado() {
        when(mesaRepository.bloquearPorId(10L)).thenReturn(Optional.of(mesa05));
        when(zonaRepository.findById(2L)).thenReturn(Optional.of(terraza));
        when(pedidoRepository.existsByMesaIdAndEstadoIn(anyLong(), anyList())).thenReturn(false);
        when(mesaRepository.findByZonaIdAndNumeroMesaIgnoreCase(2L, "05")).thenReturn(Optional.of(mesa(30L, terraza, "05")));

        assertThrows(IllegalArgumentException.class, () -> mesaService.editarMesa(10L, 2L, "05", 4));
        assertEquals(salon, mesa05.getZona());
    }

    @Test
    @DisplayName("HU041 Escenario 4: Una mesa sin atención se desactiva")
    void desactivarMesa_SinAtencion() {
        when(mesaRepository.bloquearPorId(10L)).thenReturn(Optional.of(mesa05));
        when(pedidoRepository.existsByMesaIdAndEstadoIn(anyLong(), anyList())).thenReturn(false);
        when(mesaRepository.save(any(Mesa.class))).thenAnswer(i -> i.getArgument(0));

        assertFalse(mesaService.cambiarEstadoMesa(10L, false).getActivo());
    }

    @Test
    @DisplayName("HU041 Escenario 5: Una mesa en atención no se desactiva ni se mueve")
    void mesaEnAtencion_NoSeDesactivaNiMueve() {
        when(mesaRepository.bloquearPorId(10L)).thenReturn(Optional.of(mesa05));
        when(zonaRepository.findById(2L)).thenReturn(Optional.of(terraza));
        when(pedidoRepository.existsByMesaIdAndEstadoIn(eq(10L), anyList())).thenReturn(true);

        assertThrows(OperacionNoPermitidaException.class, () -> mesaService.cambiarEstadoMesa(10L, false));
        assertThrows(OperacionNoPermitidaException.class, () -> mesaService.editarMesa(10L, 2L, "05", 4));
        assertTrue(mesa05.getActivo());
        assertEquals(salon, mesa05.getZona());
        verify(mesaRepository, never()).save(any());
    }

    @Test
    @DisplayName("HU041 Escenario 1: Una mesa en atención sí puede cambiar de número o capacidad en su zona")
    void mesaEnAtencion_EditaEnSuZona() {
        when(mesaRepository.bloquearPorId(10L)).thenReturn(Optional.of(mesa05));
        when(zonaRepository.findById(1L)).thenReturn(Optional.of(salon));
        when(pedidoRepository.existsByMesaIdAndEstadoIn(eq(10L), anyList())).thenReturn(true);
        when(mesaRepository.findByZonaIdAndNumeroMesaIgnoreCase(1L, "05")).thenReturn(Optional.of(mesa05));
        when(mesaRepository.save(any(Mesa.class))).thenAnswer(i -> i.getArgument(0));

        MesaDto editada = mesaService.editarMesa(10L, 1L, "05", 8);

        assertEquals(8, editada.getCapacidad());
        assertTrue(editada.isEnAtencion());
    }

    @Test
    @DisplayName("HU041 Escenario 6: Una mesa inactiva se reactiva")
    void reactivarMesa() {
        mesa05.setActivo(false);
        when(mesaRepository.bloquearPorId(10L)).thenReturn(Optional.of(mesa05));
        when(pedidoRepository.existsByMesaIdAndEstadoIn(anyLong(), anyList())).thenReturn(false);
        when(mesaRepository.save(any(Mesa.class))).thenAnswer(i -> i.getArgument(0));

        assertTrue(mesaService.cambiarEstadoMesa(10L, true).getActivo());
    }

    @Test
    @DisplayName("HU041 Escenario 3: No se mueve una mesa a una zona inactiva")
    void editarMesa_MoverAZonaInactiva() {
        terraza.setActivo(false);
        when(mesaRepository.bloquearPorId(10L)).thenReturn(Optional.of(mesa05));
        when(zonaRepository.findById(2L)).thenReturn(Optional.of(terraza));
        when(pedidoRepository.existsByMesaIdAndEstadoIn(anyLong(), anyList())).thenReturn(false);

        assertThrows(IllegalArgumentException.class, () -> mesaService.editarMesa(10L, 2L, "05", 4));
        assertEquals(salon, mesa05.getZona());
        verify(mesaRepository, never()).save(any());
    }

    @Test
    @DisplayName("HU040 Escenario 4: No se registran mesas en una zona inactiva")
    void crearMesa_EnZonaInactiva() {
        terraza.setActivo(false);
        when(zonaRepository.findById(2L)).thenReturn(Optional.of(terraza));

        assertThrows(IllegalArgumentException.class, () -> mesaService.crearMesa(2L, "T9", 4));
        verify(mesaRepository, never()).save(any());
    }

    @Test
    @DisplayName("HU040 Escenario 4: El comandero no recibe mesas de zonas inactivas")
    void listarMesas_SoloZonasActivas() {
        when(mesaRepository.findByActivoTrueAndZonaActivoTrue()).thenReturn(List.of(mesa05));

        assertEquals(1, mesaService.listarMesas().size());
        verify(mesaRepository, never()).findAll();
    }

    private static Zona zona(Long id, String nombre, boolean activo) {
        Zona z = new Zona();
        z.setId(id);
        z.setNombre(nombre);
        z.setActivo(activo);
        return z;
    }

    private static Mesa mesa(Long id, Zona zona, String numero) {
        Mesa m = new Mesa();
        m.setId(id);
        m.setZona(zona);
        m.setNumeroMesa(numero);
        m.setCapacidad(4);
        m.setActivo(true);
        return m;
    }
}
