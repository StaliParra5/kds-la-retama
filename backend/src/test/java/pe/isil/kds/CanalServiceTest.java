package pe.isil.kds;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.context.ApplicationEventPublisher;
import pe.isil.kds.dto.CanalDto;
import pe.isil.kds.model.CanalVenta;
import pe.isil.kds.repository.CanalVentaRepository;
import pe.isil.kds.service.CanalService;
import pe.isil.kds.service.NotificadorKds;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class CanalServiceTest {

    @Mock
    private CanalVentaRepository canalRepository;

    @Mock
    private ApplicationEventPublisher eventPublisher;

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

    // HU015: canales activos con la apariencia aprobada (D37)
    private CanalVenta canal(Long id, String codigo, String nombre, String color) {
        CanalVenta c = new CanalVenta();
        c.setId(id);
        c.setCodigo(codigo);
        c.setNombre(nombre);
        c.setSlaObjetivoMinutos(20);
        c.setActivo(true);
        c.setColor(color);
        return c;
    }

    @Test
    @DisplayName("HU015 Esc. 3: El administrador define color e ícono del canal y se avisa a las pantallas")
    void actualizarApariencia_GuardaColorEIcono() {
        delivery.setColor("#7e22ce");
        when(canalRepository.findById(3L)).thenReturn(Optional.of(delivery));
        when(canalRepository.findByActivoTrueOrderByIdAsc()).thenReturn(List.of(
                canal(1L, "SALON", "Salón", "#1d4ed8"), delivery));
        when(canalRepository.save(any(CanalVenta.class))).thenAnswer(i -> i.getArgument(0));

        CanalDto dto = canalService.actualizarApariencia(3L, "#9333EA", "two_wheeler");

        assertEquals("#9333ea", dto.getColor());
        assertEquals("two_wheeler", dto.getIcono());
        verify(eventPublisher).publishEvent(new NotificadorKds.CanalKdsEvent(3L, "DELIVERY"));
    }

    @Test
    @DisplayName("HU015 Esc. 4: Un color igual o parecido al de otro canal activo se rechaza y no se guarda")
    void actualizarApariencia_ColorDeOtroCanal_Rechaza() {
        when(canalRepository.findById(3L)).thenReturn(Optional.of(delivery));
        when(canalRepository.findByActivoTrueOrderByIdAsc()).thenReturn(List.of(
                canal(1L, "SALON", "Salón", "#1d4ed8"), delivery));

        IllegalArgumentException igual = assertThrows(IllegalArgumentException.class,
                () -> canalService.actualizarApariencia(3L, "#1D4ED8", "two_wheeler"));
        assertTrue(igual.getMessage().contains("Salón"), igual.getMessage());
        IllegalArgumentException parecido = assertThrows(IllegalArgumentException.class,
                () -> canalService.actualizarApariencia(3L, "#1e40af", "two_wheeler"));
        assertTrue(parecido.getMessage().contains("Salón"), parecido.getMessage());
        verify(canalRepository, never()).save(any());
        verify(eventPublisher, never()).publishEvent(any(Object.class));
    }

    @Test
    @DisplayName("HU015: Un color parecido al semáforo o demasiado claro para el texto blanco se rechaza")
    void actualizarApariencia_ColorDelSemaforoOClaro_Rechaza() {
        when(canalRepository.findById(3L)).thenReturn(Optional.of(delivery));
        lenient().when(canalRepository.findByActivoTrueOrderByIdAsc()).thenReturn(List.of(delivery));

        IllegalArgumentException rojo = assertThrows(IllegalArgumentException.class,
                () -> canalService.actualizarApariencia(3L, "#c2410c", "two_wheeler"));
        assertTrue(rojo.getMessage().contains("rojo del semáforo"), rojo.getMessage());
        IllegalArgumentException verde = assertThrows(IllegalArgumentException.class,
                () -> canalService.actualizarApariencia(3L, "#047857", "two_wheeler"));
        assertTrue(verde.getMessage().contains("verde del semáforo"), verde.getMessage());
        IllegalArgumentException claro = assertThrows(IllegalArgumentException.class,
                () -> canalService.actualizarApariencia(3L, "#f9a8d4", "two_wheeler"));
        assertTrue(claro.getMessage().contains("demasiado claro"), claro.getMessage());
        assertThrows(IllegalArgumentException.class, () -> canalService.actualizarApariencia(3L, "azul", "two_wheeler"));
        assertThrows(IllegalArgumentException.class, () -> canalService.actualizarApariencia(3L, "#7e22ce", "<script>"));
        verify(canalRepository, never()).save(any());
    }

    @Test
    @DisplayName("HU025 (HU037 Esc. 3): El umbral ámbar se guarda entre 1 % y 99 %; fuera de rango se rechaza")
    void actualizarSla_ConUmbralAmbar() {
        when(canalRepository.findById(3L)).thenReturn(Optional.of(delivery));
        when(canalRepository.save(any(CanalVenta.class))).thenAnswer(i -> i.getArgument(0));

        CanalDto dto = canalService.actualizarSla(3L, 25, 80);
        assertEquals(25, dto.getSlaObjetivoMinutos());
        assertEquals(80, dto.getUmbralAmbarPorcentaje());

        // null conserva el umbral actual
        assertEquals(80, canalService.actualizarSla(3L, 30, null).getUmbralAmbarPorcentaje());

        for (int fuera : new int[] {0, 100, 120}) {
            assertThrows(IllegalArgumentException.class, () -> canalService.actualizarSla(3L, 25, fuera), String.valueOf(fuera));
        }
    }

    @Test
    @DisplayName("HU025 Esc. 4: Cambiar el SLA avisa a las pantallas para recalcular los colores de los pedidos activos")
    void actualizarSla_AvisaALasPantallas() {
        when(canalRepository.findById(3L)).thenReturn(Optional.of(delivery));
        when(canalRepository.save(any(CanalVenta.class))).thenAnswer(i -> i.getArgument(0));

        canalService.actualizarSla(3L, 15, null);

        verify(eventPublisher).publishEvent(new NotificadorKds.CanalKdsEvent(3L, "DELIVERY"));
    }

    @Test
    @DisplayName("HU015: No se reactiva un canal cuyo color se parece al de otro canal activo")
    void cambiarEstado_ReactivarConColorRepetido_Rechaza() {
        delivery.setActivo(false);
        delivery.setColor("#1d4ed8");
        when(canalRepository.findById(3L)).thenReturn(Optional.of(delivery));
        when(canalRepository.findByActivoTrueOrderByIdAsc()).thenReturn(List.of(canal(1L, "SALON", "Salón", "#1d4ed8")));

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class, () -> canalService.cambiarEstado(3L, true));

        assertTrue(ex.getMessage().contains("Cambie su color"), ex.getMessage());
        assertFalse(delivery.getActivo());
    }

    @Test
    @DisplayName("D39: Los tiempos de Salón no se cambian desde Canales: se configuran en la pestaña Salón")
    void actualizarSla_Salon_Rechaza() {
        CanalVenta salon = canal(1L, "SALON", "Salón", "#1d4ed8");
        when(canalRepository.findById(1L)).thenReturn(Optional.of(salon));

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class, () -> canalService.actualizarSla(1L, 25, 80));

        assertTrue(ex.getMessage().contains("pestaña Salón"), ex.getMessage());
        assertEquals(20, salon.getSlaObjetivoMinutos());
        verify(canalRepository, never()).save(any());
    }

    @Test
    @DisplayName("D39: Color e ícono de Salón sí se cambian desde Canales")
    void actualizarApariencia_Salon_Permitido() {
        CanalVenta salon = canal(1L, "SALON", "Salón", "#1d4ed8");
        when(canalRepository.findById(1L)).thenReturn(Optional.of(salon));
        when(canalRepository.findByActivoTrueOrderByIdAsc()).thenReturn(List.of(salon));
        when(canalRepository.save(any(CanalVenta.class))).thenAnswer(i -> i.getArgument(0));

        assertEquals("#2563eb", canalService.actualizarApariencia(1L, "#2563eb", "table_restaurant").getColor());
    }
}
