package pe.isil.kds;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import pe.isil.kds.dto.CanalDto;
import pe.isil.kds.model.CanalVenta;
import pe.isil.kds.repository.CanalVentaRepository;
import pe.isil.kds.service.CanalService;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class CanalServiceTest {

    @Mock
    private CanalVentaRepository canalRepository;

    @InjectMocks
    private CanalService canalService;

    private CanalVenta delivery;

    @BeforeEach
    void setUp() {
        delivery = new CanalVenta();
        delivery.setId(3L);
        delivery.setCodigo("DELIVERY");
        delivery.setNombre("Delivery propio");
        delivery.setSlaObjetivoMinutos(30);
        delivery.setActivo(true);
    }

    @Test
    @DisplayName("HU010 Escenario 4: El administrador desactiva un canal de venta")
    void cambiarEstado_DesactivaCanal() {
        when(canalRepository.findById(3L)).thenReturn(Optional.of(delivery));
        when(canalRepository.save(any(CanalVenta.class))).thenAnswer(invocation -> invocation.getArgument(0));

        CanalDto dto = canalService.cambiarEstado(3L, false);

        assertFalse(dto.getActivo());
        assertFalse(delivery.getActivo());
    }

    @Test
    @DisplayName("HU010: El comandero solo recibe canales activos; administración puede ver también los inactivos")
    void listarCanales_FiltraSegunParametro() {
        when(canalRepository.findByActivoTrueOrderByIdAsc()).thenReturn(List.of());
        when(canalRepository.findAllByOrderByIdAsc()).thenReturn(List.of(delivery));

        assertTrue(canalService.listarCanales(false).isEmpty());
        assertEquals(1, canalService.listarCanales(true).size());
    }

    @Test
    @DisplayName("HU010: Cambiar estado de un canal inexistente es rechazado")
    void cambiarEstado_CanalInexistente_EsRechazado() {
        when(canalRepository.findById(9L)).thenReturn(Optional.empty());

        assertThrows(IllegalArgumentException.class, () -> canalService.cambiarEstado(9L, false));
        verify(canalRepository, never()).save(any());
    }
}
