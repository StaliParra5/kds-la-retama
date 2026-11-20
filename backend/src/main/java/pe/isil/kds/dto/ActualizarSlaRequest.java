package pe.isil.kds.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

public class ActualizarSlaRequest {

    @NotNull(message = "El SLA objetivo es obligatorio")
    @Min(value = 1, message = "El SLA objetivo debe ser de al menos 1 minuto")
    private Integer slaObjetivoMinutos;

    // HU025 (HU037 Esc. 3): porcentaje del SLA en que el semáforo pasa a ámbar; null conserva el actual
    @Min(value = 1, message = "El umbral ámbar debe ser al menos 1 % del SLA")
    @Max(value = 99, message = "El umbral ámbar debe ser menor al 100 % del SLA")
    private Integer umbralAmbarPorcentaje;

    public ActualizarSlaRequest() {}

    public ActualizarSlaRequest(Integer slaObjetivoMinutos) {
        this.slaObjetivoMinutos = slaObjetivoMinutos;
    }

    public ActualizarSlaRequest(Integer slaObjetivoMinutos, Integer umbralAmbarPorcentaje) {
        this.slaObjetivoMinutos = slaObjetivoMinutos;
        this.umbralAmbarPorcentaje = umbralAmbarPorcentaje;
    }

    public Integer getSlaObjetivoMinutos() { return slaObjetivoMinutos; }
    public void setSlaObjetivoMinutos(Integer slaObjetivoMinutos) { this.slaObjetivoMinutos = slaObjetivoMinutos; }

    public Integer getUmbralAmbarPorcentaje() { return umbralAmbarPorcentaje; }
    public void setUmbralAmbarPorcentaje(Integer umbralAmbarPorcentaje) { this.umbralAmbarPorcentaje = umbralAmbarPorcentaje; }
}
