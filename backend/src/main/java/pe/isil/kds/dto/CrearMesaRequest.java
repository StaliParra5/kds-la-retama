package pe.isil.kds.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/**
 * DTO para la creación tipada y validada de mesas de salón por zona (HU005).
 */
public class CrearMesaRequest {

    @NotNull(message = "El ID de la zona es obligatorio")
    private Long zonaId;

    @NotBlank(message = "El número o identificador de mesa es obligatorio")
    @Size(min = 1, max = 20, message = "El número de mesa debe tener entre 1 y 20 caracteres")
    private String numeroMesa;

    @NotNull(message = "La capacidad de comensales es obligatoria")
    @Min(value = 1, message = "La capacidad mínima de una mesa debe ser de al menos 1 comensal")
    private Integer capacidad;

    public CrearMesaRequest() {}

    public CrearMesaRequest(Long zonaId, String numeroMesa, Integer capacidad) {
        this.zonaId = zonaId;
        this.numeroMesa = numeroMesa;
        this.capacidad = capacidad;
    }

    public Long getZonaId() { return zonaId; }
    public void setZonaId(Long zonaId) { this.zonaId = zonaId; }

    public String getNumeroMesa() { return numeroMesa; }
    public void setNumeroMesa(String numeroMesa) { this.numeroMesa = numeroMesa; }

    public Integer getCapacidad() { return capacidad; }
    public void setCapacidad(Integer capacidad) { this.capacidad = capacidad; }
}
