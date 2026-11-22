package pe.isil.kds.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

/**
 * Configuración de cocina (HU033): ventana en segundos para deshacer el último cambio de estado de un ítem.
 */
public class ConfiguracionCocinaDto {

    @NotNull(message = "La ventana para deshacer es obligatoria")
    @Min(value = 5, message = "La ventana para deshacer debe ser de al menos 5 segundos")
    @Max(value = 120, message = "La ventana para deshacer no puede pasar de 120 segundos")
    private Integer ventanaRecallSegundos;

    public ConfiguracionCocinaDto() {}

    public ConfiguracionCocinaDto(Integer ventanaRecallSegundos) {
        this.ventanaRecallSegundos = ventanaRecallSegundos;
    }

    public Integer getVentanaRecallSegundos() { return ventanaRecallSegundos; }
    public void setVentanaRecallSegundos(Integer ventanaRecallSegundos) { this.ventanaRecallSegundos = ventanaRecallSegundos; }
}
