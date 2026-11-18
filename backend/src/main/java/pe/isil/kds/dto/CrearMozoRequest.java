package pe.isil.kds.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/**
 * DTO para registrar un mozo con su PIN de acceso (HU042 Escenario 1).
 */
public class CrearMozoRequest {

    @NotBlank(message = "El usuario es obligatorio")
    @Pattern(regexp = "^[A-Za-z0-9._-]{3,50}$", message = "El usuario debe tener entre 3 y 50 caracteres: letras, números, punto, guion o guion bajo")
    private String username;

    @NotBlank(message = "El nombre es obligatorio")
    @Size(max = 80, message = "El nombre admite hasta 80 caracteres")
    private String nombre;

    @NotBlank(message = "El apellido es obligatorio")
    @Size(max = 80, message = "El apellido admite hasta 80 caracteres")
    private String apellido;

    @NotBlank(message = "El PIN es obligatorio")
    @Pattern(regexp = "^[0-9]{4}$", message = "El PIN debe tener exactamente 4 dígitos")
    private String pin;

    public CrearMozoRequest() {}

    public CrearMozoRequest(String username, String nombre, String apellido, String pin) {
        this.username = username;
        this.nombre = nombre;
        this.apellido = apellido;
        this.pin = pin;
    }

    public String getUsername() { return username; }
    public void setUsername(String username) { this.username = username; }

    public String getNombre() { return nombre; }
    public void setNombre(String nombre) { this.nombre = nombre; }

    public String getApellido() { return apellido; }
    public void setApellido(String apellido) { this.apellido = apellido; }

    public String getPin() { return pin; }
    public void setPin(String pin) { this.pin = pin; }
}
