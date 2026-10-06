package pe.isil.kds.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;

/**
 * Entidad TransicionEstado: Registro inmutable de cambios de estado de platos y pedidos.
 * Base para auditoría de acciones y analítica de tiempos reales de despacho y cuellos de botella (HU022 / HU028).
 */
@Entity
@Table(name = "transiciones_estado")
public class TransicionEstado {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "detalle_pedido_id")
    private DetallePedido detallePedido;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "pedido_id", nullable = false)
    private Pedido pedido;

    @Column(name = "estado_origen", length = 30)
    private String estadoOrigen;

    @Column(name = "estado_destino", nullable = false, length = 30)
    private String estadoDestino;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "usuario_id")
    private Usuario usuario;

    @Column(name = "fecha_hora", nullable = false, updatable = false)
    private LocalDateTime fechaHora = LocalDateTime.now();

    @Column(columnDefinition = "TEXT")
    private String motivo;

    public TransicionEstado() {}

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public DetallePedido getDetallePedido() { return detallePedido; }
    public void setDetallePedido(DetallePedido detallePedido) { this.detallePedido = detallePedido; }

    public Pedido getPedido() { return pedido; }
    public void setPedido(Pedido pedido) { this.pedido = pedido; }

    public String getEstadoOrigen() { return estadoOrigen; }
    public void setEstadoOrigen(String estadoOrigen) { this.estadoOrigen = estadoOrigen; }

    public String getEstadoDestino() { return estadoDestino; }
    public void setEstadoDestino(String estadoDestino) { this.estadoDestino = estadoDestino; }

    public Usuario getUsuario() { return usuario; }
    public void setUsuario(Usuario usuario) { this.usuario = usuario; }

    public LocalDateTime getFechaHora() { return fechaHora; }
    public void setFechaHora(LocalDateTime fechaHora) { this.fechaHora = fechaHora; }

    public String getMotivo() { return motivo; }
    public void setMotivo(String motivo) { this.motivo = motivo; }
}
