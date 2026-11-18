package pe.isil.kds.dto;

public class EstacionDto {

    private Long id;
    private String codigo;
    private String nombre;
    private String descripcion;
    private Boolean activo;
    private Long cantidadPlatos;

    public EstacionDto() {}

    public EstacionDto(Long id, String codigo, String nombre, String descripcion, Boolean activo, Long cantidadPlatos) {
        this.id = id;
        this.codigo = codigo;
        this.nombre = nombre;
        this.descripcion = descripcion;
        this.activo = activo;
        this.cantidadPlatos = cantidadPlatos;
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getCodigo() { return codigo; }
    public void setCodigo(String codigo) { this.codigo = codigo; }

    public String getNombre() { return nombre; }
    public void setNombre(String nombre) { this.nombre = nombre; }

    public String getDescripcion() { return descripcion; }
    public void setDescripcion(String descripcion) { this.descripcion = descripcion; }

    public Boolean getActivo() { return activo; }
    public void setActivo(Boolean activo) { this.activo = activo; }

    public Long getCantidadPlatos() { return cantidadPlatos; }
    public void setCantidadPlatos(Long cantidadPlatos) { this.cantidadPlatos = cantidadPlatos; }
}
