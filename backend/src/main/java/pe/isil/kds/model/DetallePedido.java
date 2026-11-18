package pe.isil.kds.model;

import com.fasterxml.jackson.annotation.JsonBackReference;
import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * Entidad DetallePedido: Representa cada plato individual solicitado dentro de una comanda.
 * 
 * Consideraciones operativas:
 * - Guarda una referencia directa a la 'estacion' para permitir enrutar el ítem a la pantalla
 *   de cocina correspondiente sin consultas polimórficas complejas.
 * - Copia 'tiempoEstandarMinutos' del plato al momento de pedirlo para aislar variaciones históricas.
 * - 'version' habilita el bloqueo optimista ante cambios de estado simultáneos (HU013 Esc. 6).
 */
@Entity
@Table(name = "detalles_pedido")
public class DetallePedido {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "pedido_id", nullable = false)
    @JsonBackReference
    private Pedido pedido;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "plato_id", nullable = false)
    private Plato plato;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "estacion_id", nullable = false)
    private Estacion estacion;

    @Column(nullable = false)
    private Integer cantidad;

    @Column(name = "precio_unitario", nullable = false, precision = 10, scale = 2)
    private BigDecimal precioUnitario;

    @Column(nullable = false, precision = 10, scale = 2)
    private BigDecimal subtotal;

    @Column(columnDefinition = "TEXT")
    private String modificadores;

    @Column(name = "tiempo_estandar_minutos", nullable = false)
    private Integer tiempoEstandarMinutos;

    @Enumerated(EnumType.STRING)
    @Column(name = "estado_item", nullable = false, length = 30)
    private EstadoItem estadoItem = EstadoItem.RECIBIDO;

    // Hora programada de inicio; la asignará el motor de secuenciación (fuera del Sprint 2)
    @Column(name = "hora_disparo")
    private LocalDateTime horaDisparo;

    @Version
    @Column(nullable = false)
    private Long version = 0L;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    public DetallePedido() {}

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Pedido getPedido() { return pedido; }
    public void setPedido(Pedido pedido) { this.pedido = pedido; }

    public Plato getPlato() { return plato; }
    public void setPlato(Plato plato) { this.plato = plato; }

    public Estacion getEstacion() { return estacion; }
    public void setEstacion(Estacion estacion) { this.estacion = estacion; }

    public Integer getCantidad() { return cantidad; }
    public void setCantidad(Integer cantidad) { this.cantidad = cantidad; }

    public BigDecimal getPrecioUnitario() { return precioUnitario; }
    public void setPrecioUnitario(BigDecimal precioUnitario) { this.precioUnitario = precioUnitario; }

    public BigDecimal getSubtotal() { return subtotal; }
    public void setSubtotal(BigDecimal subtotal) { this.subtotal = subtotal; }

    public String getModificadores() { return modificadores; }
    public void setModificadores(String modificadores) { this.modificadores = modificadores; }

    public Integer getTiempoEstandarMinutos() { return tiempoEstandarMinutos; }
    public void setTiempoEstandarMinutos(Integer tiempoEstandarMinutos) { this.tiempoEstandarMinutos = tiempoEstandarMinutos; }

    public EstadoItem getEstadoItem() { return estadoItem; }
    public void setEstadoItem(EstadoItem estadoItem) { this.estadoItem = estadoItem; }

    public LocalDateTime getHoraDisparo() { return horaDisparo; }
    public void setHoraDisparo(LocalDateTime horaDisparo) { this.horaDisparo = horaDisparo; }

    public Long getVersion() { return version; }
    public void setVersion(Long version) { this.version = version; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}
