package pe.isil.kds.dto;

import jakarta.validation.constraints.NotNull;

import java.util.List;

/**
 * DTO para reemplazar las zonas que atiende un mozo (HU043). Una lista vacía le quita todas.
 */
public class AsignarZonasRequest {

    @NotNull(message = "Debe indicar las zonas del mozo (puede ser una lista vacía)")
    private List<Long> zonaIds;

    public AsignarZonasRequest() {}

    public AsignarZonasRequest(List<Long> zonaIds) {
        this.zonaIds = zonaIds;
    }

    public List<Long> getZonaIds() { return zonaIds; }
    public void setZonaIds(List<Long> zonaIds) { this.zonaIds = zonaIds; }
}
