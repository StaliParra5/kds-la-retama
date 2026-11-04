package pe.isil.kds.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;

/**
 * DTO para entrar a una mesa (HU044). Las personas son obligatorias solo si la mesa está libre;
 * al entrar a una mesa en atención se ignoran.
 */
public class AbrirAtencionRequest {

    @Min(value = 1, message = "La cantidad de personas debe ser mayor que cero")
    @Max(value = 99, message = "La cantidad de personas no puede superar 99")
    private Integer personas;

    public AbrirAtencionRequest() {}

    public AbrirAtencionRequest(Integer personas) {
        this.personas = personas;
    }

    public Integer getPersonas() { return personas; }
    public void setPersonas(Integer personas) { this.personas = personas; }
}
