package pe.isil.kds.dto;

import jakarta.validation.constraints.NotNull;
import pe.isil.kds.model.EstadoItem;

/**
 * Deshacer el último cambio de estado de un ítem (HU033). El cliente envía el estado que ve: si el servidor ya
 * tiene otro, responde 409 con el estado vigente, igual que en los cambios de estado normales.
 */
public class DeshacerCambioRequest {

    @NotNull(message = "El estado actual del ítem es obligatorio")
    private EstadoItem estadoActual;

    public DeshacerCambioRequest() {}

    public DeshacerCambioRequest(EstadoItem estadoActual) {
        this.estadoActual = estadoActual;
    }

    public EstadoItem getEstadoActual() { return estadoActual; }
    public void setEstadoActual(EstadoItem estadoActual) { this.estadoActual = estadoActual; }
}
