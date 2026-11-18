package pe.isil.kds.model;

import java.util.Collection;
import java.util.List;

/**
 * Estado agregado de un pedido, derivado del estado de sus ítems (HU013).
 */
public enum EstadoPedido {
    ENVIADO,
    EN_PREPARACION,
    LISTO,
    DESPACHADO,
    ANULADO;

    /**
     * Deriva el estado del pedido a partir de sus ítems:
     * todos anulados → ANULADO; los vigentes todos despachados → DESPACHADO;
     * todos listos o despachados → LISTO; alguno iniciado → EN_PREPARACION; si no, ENVIADO.
     */
    public static EstadoPedido derivar(Collection<EstadoItem> estadosItems) {
        if (estadosItems.isEmpty()) {
            return ENVIADO;
        }
        List<EstadoItem> vigentes = estadosItems.stream().filter(e -> e != EstadoItem.ANULADO).toList();
        if (vigentes.isEmpty()) {
            return ANULADO;
        }
        if (vigentes.stream().allMatch(e -> e == EstadoItem.DESPACHADO)) {
            return DESPACHADO;
        }
        if (vigentes.stream().allMatch(e -> e == EstadoItem.LISTO || e == EstadoItem.DESPACHADO)) {
            return LISTO;
        }
        boolean algunoIniciado = vigentes.stream().anyMatch(e ->
                e == EstadoItem.EN_PREPARACION || e == EstadoItem.LISTO || e == EstadoItem.DESPACHADO);
        return algunoIniciado ? EN_PREPARACION : ENVIADO;
    }

    public boolean esActivo() {
        return this != DESPACHADO && this != ANULADO;
    }
}
