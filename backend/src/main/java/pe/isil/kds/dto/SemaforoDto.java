package pe.isil.kds.dto;

import jakarta.validation.constraints.NotNull;

/**
 * Umbrales del semáforo de mesas en minutos (HU047). También es el cuerpo de la actualización.
 */
public class SemaforoDto {

    @NotNull(message = "Indique los minutos para amarillo")
    private Integer minutosAmarillo;

    @NotNull(message = "Indique los minutos para rojo")
    private Integer minutosRojo;

    public SemaforoDto() {}

    public SemaforoDto(Integer minutosAmarillo, Integer minutosRojo) {
        this.minutosAmarillo = minutosAmarillo;
        this.minutosRojo = minutosRojo;
    }

    public Integer getMinutosAmarillo() { return minutosAmarillo; }
    public void setMinutosAmarillo(Integer minutosAmarillo) { this.minutosAmarillo = minutosAmarillo; }

    public Integer getMinutosRojo() { return minutosRojo; }
    public void setMinutosRojo(Integer minutosRojo) { this.minutosRojo = minutosRojo; }
}
