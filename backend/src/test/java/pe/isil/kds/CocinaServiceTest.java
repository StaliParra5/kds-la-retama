package pe.isil.kds;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.access.AccessDeniedException;
import pe.isil.kds.exception.RecursoNoEncontradoException;
import pe.isil.kds.model.EstadoItem;
import pe.isil.kds.repository.DetallePedidoRepository;
import pe.isil.kds.repository.EstacionRepository;
import pe.isil.kds.security.SesionKds;
import pe.isil.kds.service.CocinaService;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class CocinaServiceTest {

    @Mock
    private DetallePedidoRepository detalleRepository;

    @Mock
    private EstacionRepository estacionRepository;

    @InjectMocks
    private CocinaService service;

    @Test
    @DisplayName("HU011 Escenario 4: La pantalla que se conecta recupera de la BD los ítems pendientes de su estación")
    void cola_SoloEstadosPendientesDeLaEstacion() {
        when(estacionRepository.existsById(2L)).thenReturn(true);
        when(detalleRepository.findByEstacionIdAndEstadoItemInOrderByPedidoFechaEnvioCocinaAscIdAsc(eq(2L), anyList()))
                .thenReturn(List.of());

        service.colaDeEstacion(2L, new SesionKds("cocinero1", "COCINERO", 2L));

        verify(detalleRepository).findByEstacionIdAndEstadoItemInOrderByPedidoFechaEnvioCocinaAscIdAsc(2L,
                List.of(EstadoItem.RECIBIDO, EstadoItem.EN_ESPERA, EstadoItem.EN_PREPARACION));
    }

    @Test
    @DisplayName("HU011 Escenario 2 / D6: Un cocinero no consulta la cola de otra estación")
    void cola_OtraEstacion_Denegada() {
        when(estacionRepository.existsById(1L)).thenReturn(true);

        assertThrows(AccessDeniedException.class, () ->
                service.colaDeEstacion(1L, new SesionKds("cocinero1", "COCINERO", 2L)));
        verifyNoInteractions(detalleRepository);
    }

    @Test
    @DisplayName("HU011: El administrador consulta cualquier estación; una estación inexistente da 404")
    void cola_AdminYEstacionInexistente() {
        when(estacionRepository.existsById(1L)).thenReturn(true);
        when(estacionRepository.existsById(99L)).thenReturn(false);

        assertDoesNotThrow(() -> service.colaDeEstacion(1L, new SesionKds("admin", "ADMIN", null)));
        assertThrows(RecursoNoEncontradoException.class, () ->
                service.colaDeEstacion(99L, new SesionKds("admin", "ADMIN", null)));
    }
}
