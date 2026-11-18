package pe.isil.kds.model;

import jakarta.persistence.*;

import java.time.LocalDateTime;

/**
 * Entidad AtencionMesa: el período en que una mesa está ocupada (HU044, HU046, decisión D19).
 *
 * Reglas de Dominio:
 * - Se abre cuando un mozo entra a una mesa libre e indica cuántas personas hay.
 * - Una mesa tiene a lo sumo una atención abierta (índice único parcial en BD).
 * - Los pedidos de salón cuelgan de la atención abierta de su mesa.
 * - Se cierra al liberar la mesa; queda el registro de quién y cuándo.
 */
@Entity
@Table(name = "atenciones_mesa")
public class AtencionMesa {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "mesa_id", nullable = false, updatable = false)
    private Mesa mesa;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "mozo_id", nullable = false, updatable = false)
    private Usuario mozo;

    @Column(nullable = false)
    private Integer personas;

    @Column(name = "abierta_en", nullable = false, updatable = false)
    private LocalDateTime abiertaEn = LocalDateTime.now();

    @Column(name = "liberada_en")
    private LocalDateTime liberadaEn;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "liberada_por")
    private Usuario liberadaPor;

    public AtencionMesa() {}

    public boolean estaAbierta() {
        return liberadaEn == null;
    }

    public void liberar(Usuario mozo) {
        this.liberadaEn = LocalDateTime.now();
        this.liberadaPor = mozo;
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Mesa getMesa() { return mesa; }
    public void setMesa(Mesa mesa) { this.mesa = mesa; }

    public Usuario getMozo() { return mozo; }
    public void setMozo(Usuario mozo) { this.mozo = mozo; }

    public Integer getPersonas() { return personas; }
    public void setPersonas(Integer personas) { this.personas = personas; }

    public LocalDateTime getAbiertaEn() { return abiertaEn; }
    public void setAbiertaEn(LocalDateTime abiertaEn) { this.abiertaEn = abiertaEn; }

    public LocalDateTime getLiberadaEn() { return liberadaEn; }
    public void setLiberadaEn(LocalDateTime liberadaEn) { this.liberadaEn = liberadaEn; }

    public Usuario getLiberadaPor() { return liberadaPor; }
    public void setLiberadaPor(Usuario liberadaPor) { this.liberadaPor = liberadaPor; }
}
