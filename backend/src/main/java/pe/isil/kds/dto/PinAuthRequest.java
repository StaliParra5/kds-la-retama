package pe.isil.kds.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

/**
 * DTO para autenticación rápida en cocina y sala con PIN numérico de 4 dígitos (HU001).
 */
public class PinAuthRequest {

    @NotBlank(message = "El PIN es requerido")
    @Pattern(regexp = "^\\d{4}$", message = "El PIN debe tener exactamente 4 dígitos numéricos")
    private String pin;

    private Long estacionId;

    // Campo opcional: si el puesto de trabajo tiene usuario preseleccionado, permite verificación O(1)
    private String username;

    public PinAuthRequest() {}

    public PinAuthRequest(String pin, Long estacionId) {
        this.pin = pin;
        this.estacionId = estacionId;
    }

    public PinAuthRequest(String pin, Long estacionId, String username) {
        this.pin = pin;
        this.estacionId = estacionId;
        this.username = username;
    }

    public String getPin() { return pin; }
    public void setPin(String pin) { this.pin = pin; }

    public Long getEstacionId() { return estacionId; }
    public void setEstacionId(Long estacionId) { this.estacionId = estacionId; }

    public String getUsername() { return username; }
    public void setUsername(String username) { this.username = username; }
}
