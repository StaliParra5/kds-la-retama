package pe.isil.kds.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

/**
 * Color e ícono de un canal (HU015). Las reglas de parecido entre colores se validan en el servicio.
 */
public class ActualizarAparienciaCanalRequest {

    @NotBlank(message = "El color es obligatorio")
    @Pattern(regexp = "^#[0-9a-fA-F]{6}$", message = "El color debe tener el formato #RRGGBB")
    private String color;

    // Nombre de un ícono de Material Symbols (letras minúsculas, números y guion bajo)
    @NotBlank(message = "El ícono es obligatorio")
    @Pattern(regexp = "^[a-z0-9_]{1,40}$", message = "El ícono no es válido")
    private String icono;

    public ActualizarAparienciaCanalRequest() {}

    public ActualizarAparienciaCanalRequest(String color, String icono) {
        this.color = color;
        this.icono = icono;
    }

    public String getColor() { return color; }
    public void setColor(String color) { this.color = color; }

    public String getIcono() { return icono; }
    public void setIcono(String icono) { this.icono = icono; }
}
