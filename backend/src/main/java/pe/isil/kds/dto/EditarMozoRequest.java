package pe.isil.kds.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * DTO para editar los datos personales de un mozo (HU042 Escenario 4).
 */
public class EditarMozoRequest {

    @NotBlank(message = "El nombre es obligatorio")
    @Size(max = 80, message = "El nombre admite hasta 80 caracteres")
    private String nombre;

    @NotBlank(message = "El apellido es obligatorio")
    @Size(max = 80, message = "El apellido admite hasta 80 caracteres")
    private String apellido;

    public EditarMozoRequest() {}

    public EditarMozoRequest(String nombre, String apellido) {
        this.nombre = nombre;
        this.apellido = apellido;
    }

    public String getNombre() { return nombre; }
    public void setNombre(String nombre) { this.nombre = nombre; }

    public String getApellido() { return apellido; }
    public void setApellido(String apellido) { this.apellido = apellido; }
}
