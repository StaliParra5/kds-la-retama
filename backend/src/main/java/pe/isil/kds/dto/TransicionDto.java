package pe.isil.kds.dto;

import java.time.LocalDateTime;

/**
 * Transición de estado de un pedido o ítem para la consulta de historial (HU022).
 */
public class TransicionDto {

    private Long id;
    private Long itemId;
    private String platoNombre;
    private String estadoOrigen;
    private String estadoDestino;
    private String responsable;
    private String rolResponsable;
    private LocalDateTime fechaHora;
    private String motivo;

    public TransicionDto() {}

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Long getItemId() { return itemId; }
    public void setItemId(Long itemId) { this.itemId = itemId; }

    public String getPlatoNombre() { return platoNombre; }
    public void setPlatoNombre(String platoNombre) { this.platoNombre = platoNombre; }

    public String getEstadoOrigen() { return estadoOrigen; }
    public void setEstadoOrigen(String estadoOrigen) { this.estadoOrigen = estadoOrigen; }

    public String getEstadoDestino() { return estadoDestino; }
    public void setEstadoDestino(String estadoDestino) { this.estadoDestino = estadoDestino; }

    public String getResponsable() { return responsable; }
    public void setResponsable(String responsable) { this.responsable = responsable; }

    public String getRolResponsable() { return rolResponsable; }
    public void setRolResponsable(String rolResponsable) { this.rolResponsable = rolResponsable; }

    public LocalDateTime getFechaHora() { return fechaHora; }
    public void setFechaHora(LocalDateTime fechaHora) { this.fechaHora = fechaHora; }

    public String getMotivo() { return motivo; }
    public void setMotivo(String motivo) { this.motivo = motivo; }
}
