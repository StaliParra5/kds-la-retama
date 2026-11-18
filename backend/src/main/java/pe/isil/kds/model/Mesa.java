package pe.isil.kds.model;

import jakarta.persistence.*;

/**
 * Entidad Mesa: Ubicación de comensales en salón vinculada a una zona específica.
 * 
 * Regla de Integridad de Datos:
 * - El número de mesa es único dentro de su respectiva zona (HU005 Escenario 2).
 */
@Entity
@Table(name = "mesas", uniqueConstraints = {
    @UniqueConstraint(name = "uq_zona_numero_mesa", columnNames = {"zona_id", "numero_mesa"})
})
public class Mesa {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "zona_id", nullable = false)
    private Zona zona;

    @Column(name = "numero_mesa", nullable = false, length = 20)
    private String numeroMesa;

    @Column(nullable = false)
    private Integer capacidad = 4;

    @Column(nullable = false)
    private Boolean activo = true;

    public Mesa() {}

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Zona getZona() { return zona; }
    public void setZona(Zona zona) { this.zona = zona; }

    public String getNumeroMesa() { return numeroMesa; }
    public void setNumeroMesa(String numeroMesa) { this.numeroMesa = numeroMesa; }

    public Integer getCapacidad() { return capacidad; }
    public void setCapacidad(Integer capacidad) { this.capacidad = capacidad; }

    public Boolean getActivo() { return activo; }
    public void setActivo(Boolean activo) { this.activo = activo; }
}
