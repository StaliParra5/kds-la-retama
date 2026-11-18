package pe.isil.kds.dto;

public class CanalDto {

    private Long id;
    private String codigo;
    private String nombre;
    private Integer slaObjetivoMinutos;
    private Boolean activo;
    // HU019/HU020: agregador (Rappi); el comandero no lo ofrece y su pedido exige número de orden
    private Boolean externo = false;

    public CanalDto() {}

    public CanalDto(Long id, String codigo, String nombre, Integer slaObjetivoMinutos, Boolean activo) {
        this.id = id;
        this.codigo = codigo;
        this.nombre = nombre;
        this.slaObjetivoMinutos = slaObjetivoMinutos;
        this.activo = activo;
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getCodigo() { return codigo; }
    public void setCodigo(String codigo) { this.codigo = codigo; }

    public String getNombre() { return nombre; }
    public void setNombre(String nombre) { this.nombre = nombre; }

    public Integer getSlaObjetivoMinutos() { return slaObjetivoMinutos; }
    public void setSlaObjetivoMinutos(Integer slaObjetivoMinutos) { this.slaObjetivoMinutos = slaObjetivoMinutos; }

    public Boolean getActivo() { return activo; }
    public void setActivo(Boolean activo) { this.activo = activo; }

    public Boolean getExterno() { return externo; }
    public void setExterno(Boolean externo) { this.externo = externo; }
}
