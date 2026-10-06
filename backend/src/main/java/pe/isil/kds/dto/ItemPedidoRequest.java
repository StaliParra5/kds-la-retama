package pe.isil.kds.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

public class ItemPedidoRequest {

    @NotNull(message = "El identificador del plato es requerido")
    private Long platoId;

    @NotNull(message = "La cantidad es requerida")
    @Min(value = 1, message = "La cantidad mínima debe ser 1")
    private Integer cantidad;

    private String modificadores;

    public ItemPedidoRequest() {}

    public ItemPedidoRequest(Long platoId, Integer cantidad, String modificadores) {
        this.platoId = platoId;
        this.cantidad = cantidad;
        this.modificadores = modificadores;
    }

    public Long getPlatoId() { return platoId; }
    public void setPlatoId(Long platoId) { this.platoId = platoId; }

    public Integer getCantidad() { return cantidad; }
    public void setCantidad(Integer cantidad) { this.cantidad = cantidad; }

    public String getModificadores() { return modificadores; }
    public void setModificadores(String modificadores) { this.modificadores = modificadores; }
}
