package pe.isil.kds.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

/**
 * DTO para asignar un PIN nuevo a un mozo (HU042 Escenario 5).
 */
public class CambiarPinRequest {

    @NotBlank(message = "El PIN es obligatorio")
    @Pattern(regexp = "^[0-9]{4}$", message = "El PIN debe tener exactamente 4 dígitos")
    private String pin;

    public CambiarPinRequest() {}

    public CambiarPinRequest(String pin) {
        this.pin = pin;
    }

    public String getPin() { return pin; }
    public void setPin(String pin) { this.pin = pin; }
}
