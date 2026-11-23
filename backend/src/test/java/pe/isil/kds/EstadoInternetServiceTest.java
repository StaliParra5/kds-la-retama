package pe.isil.kds;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import pe.isil.kds.dto.EstadoSistemaDto;
import pe.isil.kds.service.EstadoInternetService;

import java.util.ArrayDeque;
import java.util.Deque;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

/**
 * HU018 Esc. 4 y 6 (D43): estado de la salida a internet del servidor.
 */
@ExtendWith(MockitoExtension.class)
class EstadoInternetServiceTest {

    @Mock
    private SimpMessagingTemplate messagingTemplate;

    private EstadoInternetService servicio(Boolean... respuestas) {
        Deque<Boolean> cola = new ArrayDeque<>(List.of(respuestas));
        return new EstadoInternetService(messagingTemplate, cola::poll, true);
    }

    @Test
    @DisplayName("Antes de la primera comprobación el estado es desconocido")
    void inicial_Desconocido() {
        assertNull(servicio().estado().internet());
    }

    @Test
    @DisplayName("Con internet se avisa una sola vez; las comprobaciones siguientes sin cambio no avisan")
    void conInternet_AvisaUnaVez() {
        EstadoInternetService s = servicio(true, true, true);
        s.verificar();
        s.verificar();
        s.verificar();

        assertTrue(s.estado().internet());
        verify(messagingTemplate, times(1)).convertAndSend(eq("/topic/sistema"), any(EstadoSistemaDto.class));
    }

    @Test
    @DisplayName("Esc. 4: una falla aislada no avisa; dos seguidas marcan sin internet y se avisa a las pantallas")
    void dosFallas_SinInternet() {
        EstadoInternetService s = servicio(true, false, true, false, false);
        s.verificar();
        s.verificar();
        assertTrue(s.estado().internet(), "una falla aislada no cuenta");
        s.verificar();
        s.verificar();
        assertTrue(s.estado().internet());
        s.verificar();

        assertFalse(s.estado().internet());
        verify(messagingTemplate, times(2)).convertAndSend(eq("/topic/sistema"), any(EstadoSistemaDto.class));
    }

    @Test
    @DisplayName("Esc. 6: al volver internet basta una respuesta correcta y se avisa sin reiniciar nada")
    void retornoDeInternet() {
        EstadoInternetService s = servicio(false, false, true);
        s.verificar();
        s.verificar();
        assertFalse(s.estado().internet());

        s.verificar();

        assertTrue(s.estado().internet());
        assertNotNull(s.estado().verificadoEn());
    }

    @Test
    @DisplayName("Un error al consultar cuenta como falla y no detiene las comprobaciones")
    void errorDeConsulta_CuentaComoFalla() {
        EstadoInternetService s = new EstadoInternetService(messagingTemplate, () -> {
            throw new IllegalStateException("sin red");
        }, true);

        s.verificar();

        assertFalse(s.estado().internet());
    }

    @Test
    @DisplayName("Desactivado por configuración no consulta ni avisa")
    void desactivado() {
        EstadoInternetService s = new EstadoInternetService(messagingTemplate, () -> {
            throw new AssertionError("no debe consultar");
        }, false);

        s.verificar();

        assertNull(s.estado().internet());
        verifyNoInteractions(messagingTemplate);
    }
}
