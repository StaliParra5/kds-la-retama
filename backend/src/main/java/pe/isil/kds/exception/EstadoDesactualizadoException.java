package pe.isil.kds.exception;

import pe.isil.kds.dto.ItemCocinaDto;

/**
 * El ítem cambió de estado desde que el cliente lo leyó (HU013 Esc. 6).
 * Se responde 409 incluyendo el estado vigente para que la pantalla se actualice.
 */
public class EstadoDesactualizadoException extends RuntimeException {

    private final transient ItemCocinaDto itemActual;

    public EstadoDesactualizadoException(ItemCocinaDto itemActual) {
        super("El ítem ya fue actualizado por otro usuario; su estado actual es " + itemActual.getEstado() + ".");
        this.itemActual = itemActual;
    }

    public ItemCocinaDto getItemActual() {
        return itemActual;
    }
}
