package pe.isil.kds.dto;

import jakarta.validation.constraints.NotNull;
import pe.isil.kds.model.EstadoItem;

public class CambiarEstadoItemRequest {

    @NotNull(message = "El estado destino es obligatorio")
    private EstadoItem estadoDestino;

    // Estado que el cliente ve en pantalla; si ya cambió en el servidor se responde 409 (HU013 Esc. 6)
    @NotNull(message = "El estado actual del ítem es obligatorio")
    private EstadoItem estadoActual;

    // HU014 Esc. 3: el cocinero confirmó iniciar un ítem En espera antes de su hora de disparo
    private boolean inicioAnticipado;

    public CambiarEstadoItemRequest() {}

    public CambiarEstadoItemRequest(EstadoItem estadoActual, EstadoItem estadoDestino) {
        this.estadoActual = estadoActual;
        this.estadoDestino = estadoDestino;
    }

    public EstadoItem getEstadoDestino() { return estadoDestino; }
    public void setEstadoDestino(EstadoItem estadoDestino) { this.estadoDestino = estadoDestino; }

    public EstadoItem getEstadoActual() { return estadoActual; }
    public void setEstadoActual(EstadoItem estadoActual) { this.estadoActual = estadoActual; }

    public boolean isInicioAnticipado() { return inicioAnticipado; }
    public void setInicioAnticipado(boolean inicioAnticipado) { this.inicioAnticipado = inicioAnticipado; }
}
