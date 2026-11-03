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
 * - /topic/estacion/{id}: ítems de una estación de cocina (HU011, HU012).
 * - /topic/items: todos los ítems, para el pase y monitores generales.
 */
@Component
public class NotificadorKds {

    private static final Logger log = LoggerFactory.getLogger(NotificadorKds.class);

    public enum TipoEvento { ITEM_NUEVO, ITEM_ACTUALIZADO }

    public record ItemsKdsEvent(TipoEvento tipo, List<ItemCocinaDto> items) {}

    public record MensajeKds(TipoEvento tipo, ItemCocinaDto item) {}

    private final SimpMessagingTemplate messagingTemplate;

    public NotificadorKds(SimpMessagingTemplate messagingTemplate) {
        this.messagingTemplate = messagingTemplate;
    }

    @TransactionalEventListener
    public void alConfirmarse(ItemsKdsEvent evento) {
        for (ItemCocinaDto item : evento.items()) {
            MensajeKds mensaje = new MensajeKds(evento.tipo(), item);
            try {
                messagingTemplate.convertAndSend("/topic/estacion/" + item.getEstacionId(), mensaje);
                messagingTemplate.convertAndSend("/topic/items", mensaje);
            } catch (Exception e) {
                // Las pantallas recargan su cola al reconectarse; un fallo de envío no debe romper el flujo
                log.warn("No se pudo notificar el ítem {} por WebSocket: {}", item.getId(), e.getMessage());
            }
        }
    }
}
