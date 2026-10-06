package pe.isil.kds.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

/**
 * DTO para la modificación de roles de usuarios por parte del Administrador (HU002 Escenario 2).
 */
public class ActualizarRolRequest {

    @NotBlank(message = "El código de rol es obligatorio")
    @Pattern(regexp = "^(ADMIN|MOZO|COCINERO|EXPEDIDOR)$", message = "El rol debe ser uno de los permitidos: ADMIN, MOZO, COCINERO, EXPEDIDOR")
    private String rolCodigo;

    public ActualizarRolRequest() {}

    public ActualizarRolRequest(String rolCodigo) {
        this.rolCodigo = rolCodigo;
    }

    public String getRolCodigo() { return rolCodigo; }
    public void setRolCodigo(String rolCodigo) { this.rolCodigo = rolCodigo; }
}
