package pe.isil.kds.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionalEventListener;
import pe.isil.kds.dto.ItemCocinaDto;

import java.util.List;

/**
 * Publica por WebSocket los cambios de ítems solo después del commit, de modo que
 * las pantallas nunca reciban datos de una transacción revertida.
 *
 * Tópicos:
 * - /topic/estacion/{id}: ítems de una estación de cocina (HU011, HU012). Cada estación
 *   recibe únicamente sus ítems, ya con cantidad y modificadores.
 * - /topic/items: todos los ítems, para el pase y monitores generales.
 * - /topic/pedidos: altas y cambios de estado de pedidos (comandero y monitores).
 */
@Component
public class NotificadorKds {

    private static final Logger log = LoggerFactory.getLogger(NotificadorKds.class);

    public enum TipoEvento { ITEM_NUEVO, ITEM_ACTUALIZADO }

    public enum TipoEventoPedido { PEDIDO_NUEVO, PEDIDO_ACTUALIZADO }

    public record ItemsKdsEvent(TipoEvento tipo, List<ItemCocinaDto> items) {}

    public record MensajeKds(TipoEvento tipo, ItemCocinaDto item) {}

    public record PedidoKdsEvent(TipoEventoPedido tipo, Long pedidoId, String codigoPedido, String estado) {}

    private final SimpMessagingTemplate messagingTemplate;

    public NotificadorKds(SimpMessagingTemplate messagingTemplate) {
        this.messagingTemplate = messagingTemplate;
    }

    @TransactionalEventListener
    public void alConfirmarse(ItemsKdsEvent evento) {
        for (ItemCocinaDto item : evento.items()) {
            MensajeKds mensaje = new MensajeKds(evento.tipo(), item);
            enviar("/topic/estacion/" + item.getEstacionId(), mensaje);
            enviar("/topic/items", mensaje);
        }
    }

    @TransactionalEventListener
    public void alConfirmarse(PedidoKdsEvent evento) {
        enviar("/topic/pedidos", evento);
    }

    // Cada envío es independiente: un fallo en un tópico no impide notificar los demás.
    // Las pantallas recargan su cola al reconectarse, así que un fallo no debe romper el flujo.
    private void enviar(String destino, Object mensaje) {
        try {
            messagingTemplate.convertAndSend(destino, mensaje);
        } catch (Exception e) {
            log.warn("No se pudo notificar por WebSocket a {}: {}", destino, e.getMessage());
        }
    }
}
