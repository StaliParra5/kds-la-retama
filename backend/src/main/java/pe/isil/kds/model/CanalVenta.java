package pe.isil.kds.model;

import jakarta.persistence.*;

/**
 * Entidad CanalVenta: Define el origen de pedidos (Salón, Para Llevar, Delivery)
 * y su SLA objetivo en minutos para el cálculo de semáforos de tiempo (RF-CFG-04).
 */
@Entity
@Table(name = "canales_venta")
public class CanalVenta {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 30)
    private String codigo;

    @Column(nullable = false, length = 60)
    private String nombre;

    @Column(name = "sla_objetivo_minutos", nullable = false)
    private Integer slaObjetivoMinutos;

    @Column(nullable = false)
    private Boolean activo = true;

    // HU019/HU020: un canal externo es un agregador (como Rappi): no se toma desde el comandero y su
    // pedido exige el número de orden con el que el agregador lo identifica
    @Column(nullable = false)
    private Boolean externo = false;

    public CanalVenta() {}

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
