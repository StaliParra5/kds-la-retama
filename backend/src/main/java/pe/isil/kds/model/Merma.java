package pe.isil.kds.model;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * Merma: comida perdida porque se anuló un ítem que ya estaba En preparación o Listo (HU032, D12).
 *
 * Consideraciones:
 * - Guarda una foto de los datos (nombres, monto, responsable) en lugar de relaciones JPA: el reporte
 *   de mermas queda independiente de ediciones posteriores y se arma sin consultas N+1.
 * - Es de solo inserción: no hay endpoints para editar ni borrar mermas.
 */
@Entity
@Table(name = "mermas")
public class Merma {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "detalle_pedido_id", nullable = false, unique = true)
    private Long detallePedidoId;

    @Column(name = "pedido_id", nullable = false)
    private Long pedidoId;

    @Column(name = "codigo_pedido", nullable = false, length = 30)
    private String codigoPedido;

    @Column(name = "plato_nombre", nullable = false)
    private String platoNombre;

    @Column(name = "estacion_id", nullable = false)
    private Long estacionId;

    @Column(name = "estacion_nombre", nullable = false)
    private String estacionNombre;

    @Column(nullable = false)
    private Integer cantidad;

    // Subtotal del ítem al anularse: lo que se perdió
    @Column(nullable = false, precision = 10, scale = 2)
    private BigDecimal monto;

    @Enumerated(EnumType.STRING)
    @Column(name = "estado_al_anular", nullable = false, length = 30)
    private EstadoItem estadoAlAnular;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 40)
    private MotivoAnulacion motivo;

    @Column(name = "responsable_id", nullable = false)
    private Long responsableId;

    @Column(name = "responsable_nombre", nullable = false)
    private String responsableNombre;

    // D36: administrador que autorizó la anulación del ítem iniciado (null en mermas previas a la regla)
    @Column(name = "autorizado_por_id")
    private Long autorizadoPorId;

    @Column(name = "autorizado_por_nombre")
    private String autorizadoPorNombre;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    public Merma() {}

    public Long getId() { return id; }

    public Long getDetallePedidoId() { return detallePedidoId; }
    public void setDetallePedidoId(Long detallePedidoId) { this.detallePedidoId = detallePedidoId; }

    public Long getPedidoId() { return pedidoId; }
    public void setPedidoId(Long pedidoId) { this.pedidoId = pedidoId; }

    public String getCodigoPedido() { return codigoPedido; }
    public void setCodigoPedido(String codigoPedido) { this.codigoPedido = codigoPedido; }

    public String getPlatoNombre() { return platoNombre; }
    public void setPlatoNombre(String platoNombre) { this.platoNombre = platoNombre; }

    public Long getEstacionId() { return estacionId; }
    public void setEstacionId(Long estacionId) { this.estacionId = estacionId; }

    public String getEstacionNombre() { return estacionNombre; }
    public void setEstacionNombre(String estacionNombre) { this.estacionNombre = estacionNombre; }

    public Integer getCantidad() { return cantidad; }
    public void setCantidad(Integer cantidad) { this.cantidad = cantidad; }

    public BigDecimal getMonto() { return monto; }
    public void setMonto(BigDecimal monto) { this.monto = monto; }

    public EstadoItem getEstadoAlAnular() { return estadoAlAnular; }
    public void setEstadoAlAnular(EstadoItem estadoAlAnular) { this.estadoAlAnular = estadoAlAnular; }

    public MotivoAnulacion getMotivo() { return motivo; }
    public void setMotivo(MotivoAnulacion motivo) { this.motivo = motivo; }

    public Long getResponsableId() { return responsableId; }
    public void setResponsableId(Long responsableId) { this.responsableId = responsableId; }

    public String getResponsableNombre() { return responsableNombre; }
    public void setResponsableNombre(String responsableNombre) { this.responsableNombre = responsableNombre; }

    public Long getAutorizadoPorId() { return autorizadoPorId; }
    public void setAutorizadoPorId(Long autorizadoPorId) { this.autorizadoPorId = autorizadoPorId; }

    public String getAutorizadoPorNombre() { return autorizadoPorNombre; }
    public void setAutorizadoPorNombre(String autorizadoPorNombre) { this.autorizadoPorNombre = autorizadoPorNombre; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}
