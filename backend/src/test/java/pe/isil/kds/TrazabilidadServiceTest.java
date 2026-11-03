package pe.isil.kds;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import pe.isil.kds.dto.TransicionDto;
import pe.isil.kds.exception.RecursoNoEncontradoException;
import pe.isil.kds.model.*;
import pe.isil.kds.repository.DetallePedidoRepository;
import pe.isil.kds.repository.PedidoRepository;
import pe.isil.kds.repository.TransicionEstadoRepository;
import pe.isil.kds.service.TrazabilidadService;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class TrazabilidadServiceTest {

    @Mock
    private TransicionEstadoRepository transicionRepository;

    @Mock
    private DetallePedidoRepository detalleRepository;

    @Mock
    private PedidoRepository pedidoRepository;

    @InjectMocks
    private TrazabilidadService service;

    private Usuario cocinero;
    private DetallePedido item;

    @BeforeEach
    void setUp() {
        Rol rol = new Rol();
        rol.setCodigo("COCINERO");
        cocinero = new Usuario();
        cocinero.setNombre("Carlos");
        cocinero.setApellido("Castilla");
        cocinero.setRol(rol);

        Plato plato = new Plato();
        plato.setNombre("Lomo Saltado");
        Pedido pedido = new Pedido();
        item = new DetallePedido();
        item.setId(10L);
        item.setPlato(plato);
        pedido.addItem(item);
    }

    @Test
    @DisplayName("HU022 Escenario 1: Cada cambio de estado persiste usuario responsable; la hora no la fija el cliente")
    void registrarItem_PersisteUsuarioYEstados() {
        service.registrarItem(item, "RECIBIDO", "EN_PREPARACION", cocinero, null);

        ArgumentCaptor<TransicionEstado> captor = ArgumentCaptor.forClass(TransicionEstado.class);
        verify(transicionRepository).save(captor.capture());
        TransicionEstado t = captor.getValue();
        assertSame(item, t.getDetallePedido());
        assertSame(item.getPedido(), t.getPedido());
        assertEquals("RECIBIDO", t.getEstadoOrigen());
        assertEquals("EN_PREPARACION", t.getEstadoDestino());
        assertSame(cocinero, t.getUsuario());
        // HU022 Escenario 6: la hora no la fija quien llama; la asigna el servidor al insertar (@CreationTimestamp)
        assertNull(t.getFechaHora());
    }

    @Test
    @DisplayName("HU022 Escenarios 2 y 3: El historial se devuelve en orden y sin usuario figura como Sistema")
    void historialItem_EnOrdenYConSistema() {
        when(detalleRepository.existsById(10L)).thenReturn(true);
        when(transicionRepository.findByDetallePedidoIdOrderByFechaHoraAscIdAsc(10L)).thenReturn(List.of(
                transicion(null, "RECIBIDO", cocinero),
                transicion("RECIBIDO", "EN_ESPERA", null),
                transicion("EN_ESPERA", "EN_PREPARACION", cocinero)));

        List<TransicionDto> historial = service.historialItem(10L);

        assertEquals(List.of("RECIBIDO", "EN_ESPERA", "EN_PREPARACION"),
                historial.stream().map(TransicionDto::getEstadoDestino).toList());
        assertEquals("Carlos Castilla", historial.get(0).getResponsable());
        assertEquals("COCINERO", historial.get(0).getRolResponsable());
        assertEquals(TrazabilidadService.RESPONSABLE_SISTEMA, historial.get(1).getResponsable());
        assertNull(historial.get(1).getRolResponsable());
        assertEquals("Lomo Saltado", historial.get(2).getPlatoNombre());
    }

    @Test
    @DisplayName("HU022: Consultar el historial de un ítem inexistente es rechazado")
    void historialItem_Inexistente() {
        when(detalleRepository.existsById(99L)).thenReturn(false);

        assertThrows(RecursoNoEncontradoException.class, () -> service.historialItem(99L));
        verifyNoInteractions(transicionRepository);
    }

    @Test
    @DisplayName("HU022 Escenario 5: El servicio no expone operaciones de edición ni borrado del historial")
    void historialSoloInsercion() {
        assertTrue(java.util.Arrays.stream(TrazabilidadService.class.getDeclaredMethods())
                .filter(m -> java.lang.reflect.Modifier.isPublic(m.getModifiers()))
                .noneMatch(m -> m.getName().matches("(?i).*(editar|actualizar|eliminar|borrar|delete|update).*")));
        assertTrue(TransicionEstado.class.isAnnotationPresent(org.hibernate.annotations.Immutable.class));
    }

    private TransicionEstado transicion(String origen, String destino, Usuario usuario) {
        TransicionEstado t = new TransicionEstado();
        t.setDetallePedido(item);
        t.setPedido(item.getPedido());
        t.setEstadoOrigen(origen);
        t.setEstadoDestino(destino);
        t.setUsuario(usuario);
        return t;
    }
}
