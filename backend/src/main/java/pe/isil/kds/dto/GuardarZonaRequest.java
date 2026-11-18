package pe.isil.kds.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * DTO para crear o editar una zona del salón (HU040).
 */
public class GuardarZonaRequest {

    @NotBlank(message = "El nombre de la zona es obligatorio")
    @Size(max = 60, message = "El nombre de la zona admite hasta 60 caracteres")
    private String nombre;

    @Size(max = 255, message = "La descripción admite hasta 255 caracteres")
    private String descripcion;

    public GuardarZonaRequest() {}

    public GuardarZonaRequest(String nombre, String descripcion) {
        this.nombre = nombre;
        this.descripcion = descripcion;
    }

    public String getNombre() { return nombre; }
    public void setNombre(String nombre) { this.nombre = nombre; }

    public String getDescripcion() { return descripcion; }
    public void setDescripcion(String descripcion) { this.descripcion = descripcion; }
}
