package pe.isil.kds.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

public class ActualizarSlaRequest {

    @NotNull(message = "El SLA objetivo es obligatorio")
    @Min(value = 1, message = "El SLA objetivo debe ser de al menos 1 minuto")
    private Integer slaObjetivoMinutos;

    public ActualizarSlaRequest() {}

    public ActualizarSlaRequest(Integer slaObjetivoMinutos) {
        this.slaObjetivoMinutos = slaObjetivoMinutos;
    }

    public Integer getSlaObjetivoMinutos() { return slaObjetivoMinutos; }
    public void setSlaObjetivoMinutos(Integer slaObjetivoMinutos) { this.slaObjetivoMinutos = slaObjetivoMinutos; }
}
