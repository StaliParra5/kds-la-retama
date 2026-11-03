package pe.isil.kds.model;

import java.util.EnumSet;
import java.util.Set;

/**
 * Ciclo de vida de un ítem de pedido (HU013).
 *
 * Flujo definido (decisión D1 del Sprint 2):
 * RECIBIDO → EN_PREPARACION → LISTO → DESPACHADO
 * RECIBIDO → EN_ESPERA → EN_PREPARACION
 * ANULADO es alcanzable desde cualquier estado no final; DESPACHADO y ANULADO son finales.
 * El recall (LISTO → EN_PREPARACION) no forma parte del flujo y se rechaza.
 */
public enum EstadoItem {
    RECIBIDO,
    EN_ESPERA,
    EN_PREPARACION,
    LISTO,
    DESPACHADO,
    ANULADO;

    public Set<EstadoItem> siguientesPermitidos() {
        return switch (this) {
            case RECIBIDO -> EnumSet.of(EN_ESPERA, EN_PREPARACION, ANULADO);
            case EN_ESPERA -> EnumSet.of(EN_PREPARACION, ANULADO);
            case EN_PREPARACION -> EnumSet.of(LISTO, ANULADO);
            case LISTO -> EnumSet.of(DESPACHADO, ANULADO);
            case DESPACHADO, ANULADO -> EnumSet.noneOf(EstadoItem.class);
        };
    }

    public boolean puedeTransicionarA(EstadoItem destino) {
        return siguientesPermitidos().contains(destino);
    }

    public boolean esFinal() {
        return this == DESPACHADO || this == ANULADO;
    }

    /** Ítems que siguen en la cola activa de una estación de cocina. */
    public boolean enColaDeCocina() {
        return this == RECIBIDO || this == EN_ESPERA || this == EN_PREPARACION;
    }
}
