package pe.isil.kds.dto;

import java.math.BigDecimal;

public class PlatoDto {

    private Long id;
    private Long categoriaId;
    private String categoriaNombre;
    private Long estacionId;
    private String estacionNombre;
    private String nombre;
    private String descripcion;
    private BigDecimal precio;
    private Integer tiempoEstandarMinutos;
    private Boolean disponible;
    private Boolean activo;

    public PlatoDto() {}

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Long getCategoriaId() { return categoriaId; }
    public void setCategoriaId(Long categoriaId) { this.categoriaId = categoriaId; }

    public String getCategoriaNombre() { return categoriaNombre; }
    public void setCategoriaNombre(String categoriaNombre) { this.categoriaNombre = categoriaNombre; }

    public Long getEstacionId() { return estacionId; }
    public void setEstacionId(Long estacionId) { this.estacionId = estacionId; }

    public String getEstacionNombre() { return estacionNombre; }
    public void setEstacionNombre(String estacionNombre) { this.estacionNombre = estacionNombre; }

    public String getNombre() { return nombre; }
    public void setNombre(String nombre) { this.nombre = nombre; }

    public String getDescripcion() { return descripcion; }
    public void setDescripcion(String descripcion) { this.descripcion = descripcion; }

    public BigDecimal getPrecio() { return precio; }
    public void setPrecio(BigDecimal precio) { this.precio = precio; }

    public Integer getTiempoEstandarMinutos() { return tiempoEstandarMinutos; }
    public void setTiempoEstandarMinutos(Integer tiempoEstandarMinutos) { this.tiempoEstandarMinutos = tiempoEstandarMinutos; }

    public Boolean getDisponible() { return disponible; }
    public void setDisponible(Boolean disponible) { this.disponible = disponible; }

    public Boolean getActivo() { return activo; }
    public void setActivo(Boolean activo) { this.activo = activo; }
}
