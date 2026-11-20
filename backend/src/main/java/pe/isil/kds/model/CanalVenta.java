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

    // HU015: color (#RRGGBB) e ícono (Material Symbols) con los que se reconoce el canal en la tarjeta
    @Column(length = 7)
    private String color;

    @Column(length = 40)
    private String icono;

    // HU025: porcentaje del SLA en el que el pedido pasa de verde a ámbar (rojo al llegar al 100 %)
    @Column(name = "umbral_ambar_porcentaje", nullable = false)
    private Integer umbralAmbarPorcentaje = 75;

    // D39: ámbar en minutos exactos; solo Salón, que toma sus tiempos del semáforo de mesas (pestaña Salón).
    // Si está definido manda sobre el porcentaje
    @Column(name = "umbral_ambar_minutos")
    private Integer umbralAmbarMinutos;

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

    public String getColor() { return color; }
    public void setColor(String color) { this.color = color; }

    public String getIcono() { return icono; }
    public void setIcono(String icono) { this.icono = icono; }

    public Integer getUmbralAmbarMinutos() { return umbralAmbarMinutos; }
    public void setUmbralAmbarMinutos(Integer umbralAmbarMinutos) { this.umbralAmbarMinutos = umbralAmbarMinutos; }

    // D39: minutos desde el ingreso en que el semáforo pasa a ámbar, sea por minutos fijos o por % del SLA
    public Double minutosAmbar() {
        if (umbralAmbarMinutos != null) {
            return umbralAmbarMinutos.doubleValue();
        }
        if (slaObjetivoMinutos == null) {
            return null;
        }
        return slaObjetivoMinutos * (umbralAmbarPorcentaje != null ? umbralAmbarPorcentaje : 75) / 100.0;
    }

    public Integer getUmbralAmbarPorcentaje() { return umbralAmbarPorcentaje; }
    public void setUmbralAmbarPorcentaje(Integer umbralAmbarPorcentaje) { this.umbralAmbarPorcentaje = umbralAmbarPorcentaje; }
}
