package pe.isil.kds.dto;

import jakarta.validation.constraints.NotNull;

public class CambiarEstadoCanalRequest {

    @NotNull(message = "Debe indicar si el canal queda activo o inactivo")
    private Boolean activo;

    public CambiarEstadoCanalRequest() {}

    public CambiarEstadoCanalRequest(Boolean activo) {
        this.activo = activo;
    }

    public Boolean getActivo() { return activo; }
    public void setActivo(Boolean activo) { this.activo = activo; }
}
