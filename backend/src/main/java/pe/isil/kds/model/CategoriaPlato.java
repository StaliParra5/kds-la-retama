package pe.isil.kds.model;

import jakarta.persistence.*;

/**
 * Entidad CategoriaPlato: Agrupa los platos de la carta (Entradas, Fondos, Bebidas, Postres).
 * Su atributo ordenVisual permite renderizar los filtros en el orden de consumo gastronómico.
 */
@Entity
@Table(name = "categorias_plato")
public class CategoriaPlato {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 60)
    private String nombre;

    @Column(name = "orden_visual", nullable = false)
    private Integer ordenVisual = 0;

    @Column(nullable = false)
    private Boolean activo = true;

    public CategoriaPlato() {}

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getNombre() { return nombre; }
    public void setNombre(String nombre) { this.nombre = nombre; }

    public Integer getOrdenVisual() { return ordenVisual; }
    public void setOrdenVisual(Integer ordenVisual) { this.ordenVisual = ordenVisual; }

    public Boolean getActivo() { return activo; }
    public void setActivo(Boolean activo) { this.activo = activo; }
}
