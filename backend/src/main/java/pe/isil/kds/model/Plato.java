package pe.isil.kds.model;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * Entidad Plato: Representa un ítem del menú de La Retama.
 * 
 * Reglas de Negocio Estratégicas:
 * - tiempoEstandarMinutos es mandatorio (> 0) para permitir la secuenciación de disparos de cocina (HU003 / HU023).
 * - estacion es mandatoria para asegurar el enrutamiento automático sin intervención manual (HU004 / HU011).
 */
@Entity
@Table(name = "platos")
public class Plato {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "categoria_id", nullable = false)
    private CategoriaPlato categoria;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "estacion_id", nullable = false)
    private Estacion estacion;

    @Column(nullable = false, length = 120)
    private String nombre;

    @Column(columnDefinition = "TEXT")
    private String descripcion;

    @Column(nullable = false, precision = 10, scale = 2)
    private BigDecimal precio;

    @Column(name = "tiempo_estandar_minutos", nullable = false)
    private Integer tiempoEstandarMinutos;

    @Column(nullable = false)
    private Boolean disponible = true;

    @Column(nullable = false)
    private Boolean activo = true;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    public Plato() {}

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public CategoriaPlato getCategoria() { return categoria; }
    public void setCategoria(CategoriaPlato categoria) { this.categoria = categoria; }

    public Estacion getEstacion() { return estacion; }
    public void setEstacion(Estacion estacion) { this.estacion = estacion; }

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

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}
