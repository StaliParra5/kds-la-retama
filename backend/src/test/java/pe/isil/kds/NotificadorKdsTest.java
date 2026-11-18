package pe.isil.kds;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import pe.isil.kds.dto.ItemCocinaDto;
import pe.isil.kds.service.NotificadorKds;

import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

/**
 * HU017: lo que el servidor publica por WebSocket es lo que decide qué pantalla se entera de cada cambio.
 */
@ExtendWith(MockitoExtension.class)
class NotificadorKdsTest {

    @Mock
    private SimpMessagingTemplate messagingTemplate;

    @InjectMocks
    private NotificadorKds notificador;

    private static ItemCocinaDto item(Long id, Long estacionId, String estado) {
        ItemCocinaDto dto = new ItemCocinaDto();
        dto.setId(id);
        dto.setEstacionId(estacionId);
        dto.setEstado(estado);
        dto.setCodigoPedido("CMD-261111-0001");
        return dto;
    }

    /** Todos los envíos hechos al broker, como pares destino → cuerpo. */
    private List<String> destinosPublicados() {
        ArgumentCaptor<String> destinos = ArgumentCaptor.forClass(String.class);
        ArgumentCaptor<Object> cuerpos = ArgumentCaptor.forClass(Object.class);
        verify(messagingTemplate, atLeast(0)).convertAndSend(destinos.capture(), cuerpos.capture());
        return new ArrayList<>(destinos.getAllValues());
    }

    @Test
    @DisplayName("HU017 Escenario 5: Un ítem solo viaja al tópico de su estación y al general; otra estación no se entera")
    void itemNuevo_SoloLlegaASuEstacion() {
        notificador.alConfirmarse(new NotificadorKds.ItemsKdsEvent(
                NotificadorKds.TipoEvento.ITEM_NUEVO, List.of(item(1L, 2L, "RECIBIDO"))));

        List<String> destinos = destinosPublicados();

        assertEquals(List.of("/topic/estacion/2", "/topic/items"), destinos);
        assertFalse(destinos.contains("/topic/estacion/1"));
    }

    @Test
    @DisplayName("HU017 Escenario 1: Un pedido de varias estaciones reparte cada ítem al tópico de la suya")
    void pedidoMultiestacion_CadaItemASuEstacion() {
        notificador.alConfirmarse(new NotificadorKds.ItemsKdsEvent(NotificadorKds.TipoEvento.ITEM_NUEVO,
                List.of(item(1L, 1L, "RECIBIDO"), item(2L, 3L, "RECIBIDO"), item(3L, 1L, "RECIBIDO"))));

        List<String> destinos = destinosPublicados();

        assertEquals(2, destinos.stream().filter("/topic/estacion/1"::equals).count());
        assertEquals(1, destinos.stream().filter("/topic/estacion/3"::equals).count());
        assertEquals(3, destinos.stream().filter("/topic/items"::equals).count());
        assertFalse(destinos.contains("/topic/estacion/2"));
    }

    @Test
    @DisplayName("HU017 Escenarios 2, 3 y 4: Un cambio de estado (también despacho o anulación) llega a su estación con el estado nuevo")
    void cambioDeEstado_LlegaConElEstadoVigente() {
        for (String estado : List.of("EN_PREPARACION", "LISTO", "DESPACHADO", "ANULADO")) {
            reset(messagingTemplate);
            notificador.alConfirmarse(new NotificadorKds.ItemsKdsEvent(
                    NotificadorKds.TipoEvento.ITEM_ACTUALIZADO, List.of(item(7L, 2L, estado))));

            ArgumentCaptor<Object> cuerpos = ArgumentCaptor.forClass(Object.class);
            verify(messagingTemplate).convertAndSend(eq("/topic/estacion/2"), cuerpos.capture());
            NotificadorKds.MensajeKds mensaje = (NotificadorKds.MensajeKds) cuerpos.getValue();
            assertEquals(NotificadorKds.TipoEvento.ITEM_ACTUALIZADO, mensaje.tipo(), estado);
            assertEquals(estado, mensaje.item().getEstado());
        }
    }

    @Test
    @DisplayName("HU017: Cada cambio de un ítem avisa al mozo por el tópico de pedidos, una sola vez por pedido y aunque el pedido siga igual")
    void cambioDeItem_AvisaPorElTopicoDePedidos() {
        ItemCocinaDto a = item(1L, 1L, "EN_PREPARACION");
        ItemCocinaDto b = item(2L, 3L, "EN_PREPARACION");
        ItemCocinaDto otroPedido = item(3L, 1L, "LISTO");
        for (ItemCocinaDto dto : List.of(a, b, otroPedido)) {
            dto.setEstadoPedido("EN_PREPARACION");
        }
        a.setPedidoId(100L);
        a.setCodigoPedido("CMD-261112-0100");
        b.setPedidoId(100L);
        b.setCodigoPedido("CMD-261112-0100");
        otroPedido.setPedidoId(101L);
        otroPedido.setCodigoPedido("CMD-261112-0101");

        notificador.alConfirmarse(new NotificadorKds.ItemsKdsEvent(
                NotificadorKds.TipoEvento.ITEM_ACTUALIZADO, List.of(a, b, otroPedido)));

        ArgumentCaptor<String> destinos = ArgumentCaptor.forClass(String.class);
        ArgumentCaptor<Object> cuerpos = ArgumentCaptor.forClass(Object.class);
        verify(messagingTemplate, atLeast(0)).convertAndSend(destinos.capture(), cuerpos.capture());
        List<NotificadorKds.PedidoKdsEvent> avisosDePedido = new ArrayList<>();
        for (int i = 0; i < destinos.getAllValues().size(); i++) {
            if ("/topic/pedidos".equals(destinos.getAllValues().get(i))) {
                avisosDePedido.add((NotificadorKds.PedidoKdsEvent) cuerpos.getAllValues().get(i));
            }
        }

        assertEquals(2, avisosDePedido.size());
        assertEquals(List.of(100L, 101L), avisosDePedido.stream().map(NotificadorKds.PedidoKdsEvent::pedidoId).toList());
        assertEquals("CMD-261112-0100", avisosDePedido.get(0).codigoPedido());
        assertEquals("EN_PREPARACION", avisosDePedido.get(0).estado());
        assertEquals(NotificadorKds.TipoEventoPedido.PEDIDO_ACTUALIZADO, avisosDePedido.get(0).tipo());
    }

    @Test
    @DisplayName("HU017: Un ítem nuevo no duplica el aviso de pedido nuevo: solo los cambios de ítems usan el aviso por ítem")
    void itemNuevo_NoAvisaPorElTopicoDePedidos() {
        ItemCocinaDto nuevo = item(1L, 2L, "RECIBIDO");
        nuevo.setPedidoId(100L);

        notificador.alConfirmarse(new NotificadorKds.ItemsKdsEvent(NotificadorKds.TipoEvento.ITEM_NUEVO, List.of(nuevo)));

        assertFalse(destinosPublicados().contains("/topic/pedidos"));
    }

    @Test
    @DisplayName("HU017: Los avisos de pedido van solo al tópico de pedidos, no a las estaciones")
    void eventoDePedido_SoloAlTopicoDePedidos() {
        notificador.alConfirmarse(new NotificadorKds.PedidoKdsEvent(
                NotificadorKds.TipoEventoPedido.PEDIDO_NUEVO, 5L, "CMD-261111-0005", "ENVIADO"));

        assertEquals(List.of("/topic/pedidos"), destinosPublicados());
    }

    @Test
    @DisplayName("HU017: Si falla el envío al tópico de la estación, igual se notifica al general y no se propaga el error")
    void falloEnUnTopico_NoImpideLosDemas() {
        doThrow(new IllegalStateException("broker caído")).doNothing()
                .when(messagingTemplate).convertAndSend(anyString(), any(Object.class));

        assertDoesNotThrow(() -> notificador.alConfirmarse(new NotificadorKds.ItemsKdsEvent(
                NotificadorKds.TipoEvento.ITEM_NUEVO, List.of(item(1L, 2L, "RECIBIDO")))));

        assertEquals(List.of("/topic/estacion/2", "/topic/items"), destinosPublicados());
    }
}
