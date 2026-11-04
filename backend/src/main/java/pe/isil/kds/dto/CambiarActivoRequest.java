package pe.isil.kds.dto;

import jakarta.validation.constraints.NotNull;

/**
 * DTO para activar o desactivar un maestro (zonas y mesas, HU040/HU041).
 */
public class CambiarActivoRequest {

    @NotNull(message = "Debe indicar si queda activo o inactivo")
    private Boolean activo;

    public CambiarActivoRequest() {}

    public CambiarActivoRequest(Boolean activo) {
        this.activo = activo;
    }

    public Boolean getActivo() { return activo; }
    public void setActivo(Boolean activo) { this.activo = activo; }
}
