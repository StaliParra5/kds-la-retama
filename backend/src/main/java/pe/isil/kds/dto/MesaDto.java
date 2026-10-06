package pe.isil.kds.dto;

public class MesaDto {

    private Long id;
    private Long zonaId;
    private String zonaNombre;
    private String numeroMesa;
    private Integer capacidad;
    private Boolean activo;

    public MesaDto() {}

    public MesaDto(Long id, Long zonaId, String zonaNombre, String numeroMesa, Integer capacidad, Boolean activo) {
        this.id = id;
        this.zonaId = zonaId;
        this.zonaNombre = zonaNombre;
        this.numeroMesa = numeroMesa;
        this.capacidad = capacidad;
        this.activo = activo;
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Long getZonaId() { return zonaId; }
    public void setZonaId(Long zonaId) { this.zonaId = zonaId; }

    public String getZonaNombre() { return zonaNombre; }
    public void setZonaNombre(String zonaNombre) { this.zonaNombre = zonaNombre; }

    public String getNumeroMesa() { return numeroMesa; }
    public void setNumeroMesa(String numeroMesa) { this.numeroMesa = numeroMesa; }

    public Integer getCapacidad() { return capacidad; }
    public void setCapacidad(Integer capacidad) { this.capacidad = capacidad; }

    public Boolean getActivo() { return activo; }
    public void setActivo(Boolean activo) { this.activo = activo; }
}
