package pe.isil.kds.dto;

import java.util.List;

public class ZonaDto {

    private Long id;
    private String nombre;
    private String descripcion;
    private Boolean activo;
    private List<MesaDto> mesas;

    public ZonaDto() {}

    public ZonaDto(Long id, String nombre, String descripcion, Boolean activo, List<MesaDto> mesas) {
        this.id = id;
        this.nombre = nombre;
        this.descripcion = descripcion;
        this.activo = activo;
        this.mesas = mesas;
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getNombre() { return nombre; }
    public void setNombre(String nombre) { this.nombre = nombre; }

    public String getDescripcion() { return descripcion; }
    public void setDescripcion(String descripcion) { this.descripcion = descripcion; }

    public Boolean getActivo() { return activo; }
    public void setActivo(Boolean activo) { this.activo = activo; }

    public List<MesaDto> getMesas() { return mesas; }
    public void setMesas(List<MesaDto> mesas) { this.mesas = mesas; }
}
