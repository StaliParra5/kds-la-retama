package pe.isil.kds.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;
import java.math.BigDecimal;

/**
 * DTO para creación y edición de platos (HU003 & HU023).
 * Valida reglas de negocio estrictas: tiempo estándar > 0 y estación mandatoria.
 */
public class GuardarPlatoRequest {

    @NotBlank(message = "El nombre del plato es obligatorio")
    private String nombre;

    private String descripcion;

    @NotNull(message = "La categoría del plato es obligatoria")
    private Long categoriaId;

    @NotNull(message = "La estación de cocina es obligatoria para el enrutamiento")
    private Long estacionId;

    @NotNull(message = "El precio es obligatorio")
    @PositiveOrZero(message = "El precio no puede ser negativo")
    private BigDecimal precio;

    @NotNull(message = "El tiempo estándar de preparación es obligatorio")
    @Min(value = 1, message = "El tiempo estándar de preparación debe ser de al menos 1 minuto")
    private Integer tiempoEstandarMinutos;

    private Boolean disponible = true;

    public GuardarPlatoRequest() {}

    public String getNombre() { return nombre; }
    public void setNombre(String nombre) { this.nombre = nombre; }

    public String getDescripcion() { return descripcion; }
    public void setDescripcion(String descripcion) { this.descripcion = descripcion; }

    public Long getCategoriaId() { return categoriaId; }
    public void setCategoriaId(Long categoriaId) { this.categoriaId = categoriaId; }

    public Long getEstacionId() { return estacionId; }
    public void setEstacionId(Long estacionId) { this.estacionId = estacionId; }

    public BigDecimal getPrecio() { return precio; }
    public void setPrecio(BigDecimal precio) { this.precio = precio; }

    public Integer getTiempoEstandarMinutos() { return tiempoEstandarMinutos; }
    public void setTiempoEstandarMinutos(Integer tiempoEstandarMinutos) { this.tiempoEstandarMinutos = tiempoEstandarMinutos; }

    public Boolean getDisponible() { return disponible; }
    public void setDisponible(Boolean disponible) { this.disponible = disponible; }
}
