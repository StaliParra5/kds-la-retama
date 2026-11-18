package pe.isil.kds.model;

import java.util.Arrays;
import java.util.List;

/**
 * Motivos de anulación de un ítem (HU032, decisiones D12 y D36). Lista fija: el mozo elige uno, no escribe texto.
 *
 * Cada motivo indica a qué ítems aplica según si cocina ya los empezó:
 * - Pendiente (Recibido o En espera): errores de toma del pedido o cambios del cliente antes de cocinar.
 * - Iniciado (En preparación o Listo): problemas con un plato que ya se está cocinando o ya salió.
 * "Cliente se retiró" y "Otro" sirven en ambos casos.
 */
public enum MotivoAnulacion {
    ERROR_DIGITACION("Error de digitación", true, false),
    CLIENTE_CAMBIO_OPINION("Cliente cambió de opinión", true, false),
    CLIENTE_SE_RETIRO("Cliente se retiró", true, true),
    DEMORA_EXCESIVA("Demora excesiva", false, true),
    PLATO_CON_DEFECTO("Plato con defecto", false, true),
    OTRO("Otro", true, true);

    private final String etiqueta;
    private final boolean paraPendiente;
    private final boolean paraIniciado;

    MotivoAnulacion(String etiqueta, boolean paraPendiente, boolean paraIniciado) {
        this.etiqueta = etiqueta;
        this.paraPendiente = paraPendiente;
        this.paraIniciado = paraIniciado;
    }

    public String etiqueta() {
        return etiqueta;
    }

    /** Si el motivo tiene sentido para un ítem en ese estado (los estados finales no se anulan). */
    public boolean aplicaA(EstadoItem estado) {
        return esIniciado(estado) ? paraIniciado : paraPendiente;
    }

    /** Motivos que se ofrecen para un ítem en ese estado, en el orden de la lista. */
    public static List<MotivoAnulacion> para(EstadoItem estado) {
        return Arrays.stream(values()).filter(m -> m.aplicaA(estado)).toList();
    }

    /** Cocina ya empezó el ítem: anularlo es merma y exige autorización del administrador (D36). */
    public static boolean esIniciado(EstadoItem estado) {
        return estado == EstadoItem.EN_PREPARACION || estado == EstadoItem.LISTO;
    }
}
