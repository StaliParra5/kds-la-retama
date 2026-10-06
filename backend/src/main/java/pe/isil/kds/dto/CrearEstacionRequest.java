package pe.isil.kds.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/**
 * DTO para la creación de nuevas estaciones de preparación física en cocina (HU004).
 * Incluye validaciones JSR-380 para proteger la integridad estructural de la cocina.
 */
public class CrearEstacionRequest {

    @NotBlank(message = "El código identificador de la estación es obligatorio")
    @Size(min = 2, max = 30, message = "El código debe tener entre 2 y 30 caracteres")
    @Pattern(regexp = "^[A-Z0-9_-]+$", message = "El código solo debe contener letras mayúsculas, números, guiones y guiones bajos")
    private String codigo;

    @NotBlank(message = "El nombre de la estación es obligatorio")
    @Size(min = 2, max = 80, message = "El nombre debe tener entre 2 y 80 caracteres")
    private String nombre;

    @Size(max = 255, message = "La descripción no puede superar 255 caracteres")
    private String descripcion;

    public CrearEstacionRequest() {}

    public CrearEstacionRequest(String codigo, String nombre, String descripcion) {
        this.codigo = codigo;
        this.nombre = nombre;
        this.descripcion = descripcion;
    }

    public String getCodigo() { return codigo; }
    public void setCodigo(String codigo) { this.codigo = codigo; }

    public String getNombre() { return nombre; }
    public void setNombre(String nombre) { this.nombre = nombre; }

    public String getDescripcion() { return descripcion; }
    public void setDescripcion(String descripcion) { this.descripcion = descripcion; }
}
