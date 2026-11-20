package pe.isil.kds.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/**
 * Crear o cambiar la clave de autorización del administrador (HU049, D36). Se confirma con la contraseña de
 * su cuenta; si olvida la clave, la vuelve a crear con esa misma contraseña.
 */
public class ClaveAutorizacionRequest {

    @NotBlank(message = "Ingrese la contraseña de su cuenta")
    @Size(max = 100, message = "La contraseña admite hasta 100 caracteres")
    private String passwordActual;

    @NotBlank(message = "Ingrese la clave de autorización")
    @Pattern(regexp = "^\\d{6}$", message = "La clave de autorización debe tener 6 dígitos")
    private String clave;

    public ClaveAutorizacionRequest() {}

    public ClaveAutorizacionRequest(String passwordActual, String clave) {
        this.passwordActual = passwordActual;
        this.clave = clave;
    }

    public String getPasswordActual() { return passwordActual; }
    public void setPasswordActual(String passwordActual) { this.passwordActual = passwordActual; }

    public String getClave() { return clave; }
    public void setClave(String clave) { this.clave = clave; }

    // Nunca imprime la contraseña ni la clave si el objeto llega a un log
    @Override
    public String toString() {
        return "ClaveAutorizacionRequest[***]";
    }
}
