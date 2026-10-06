package pe.isil.kds.model;

import com.fasterxml.jackson.annotation.JsonManagedReference;
import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

/**
 * Entidad Pedido: Representa una comanda u orden en el sistema.
 * 
 * Reglas de Dominio:
 * - Si canal.codigo == 'SALON', la asociación con 'mesa' es obligatoria (HU006).
 * - Se inicializa con estado 'BORRADOR' en sala hasta que el mozo envía la orden a cocina.
 */
@Entity
@Table(name = "pedidos")
public class Pedido {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "codigo_correlativo", nullable = false, unique = true, length = 30)
    private String codigoCorrelativo;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "canal_id", nullable = false)
    private CanalVenta canal;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "mesa_id")
    private Mesa mesa;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "usuario_id", nullable = false)
    private Usuario usuario;

    @Column(name = "cliente_nombre", length = 120)
    private String clienteNombre;

    @Column(name = "cliente_telefono", length = 30)
    private String clienteTelefono;

    @Column(name = "cliente_direccion", columnDefinition = "TEXT")
    private String clienteDireccion;

    @Column(nullable = false, length = 30)
    private String estado = "BORRADOR";

    @Column(nullable = false, precision = 10, scale = 2)
    private BigDecimal total = BigDecimal.ZERO;

    @Column(columnDefinition = "TEXT")
    private String observaciones;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    @Column(name = "fecha_envio_cocina")
    private LocalDateTime fechaEnvioCocina;

    @Column(name = "fecha_despacho")
    private LocalDateTime fechaDespacho;

    @OneToMany(mappedBy = "pedido", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.LAZY)
    @JsonManagedReference
    private List<DetallePedido> items = new ArrayList<>();

    public Pedido() {}

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getCodigoCorrelativo() { return codigoCorrelativo; }
    public void setCodigoCorrelativo(String codigoCorrelativo) { this.codigoCorrelativo = codigoCorrelativo; }

    public CanalVenta getCanal() { return canal; }
    public void setCanal(CanalVenta canal) { this.canal = canal; }

    public Mesa getMesa() { return mesa; }
    public void setMesa(Mesa mesa) { this.mesa = mesa; }

    public Usuario getUsuario() { return usuario; }
    public void setUsuario(Usuario usuario) { this.usuario = usuario; }

    public String getClienteNombre() { return clienteNombre; }
    public void setClienteNombre(String clienteNombre) { this.clienteNombre = clienteNombre; }

    public String getClienteTelefono() { return clienteTelefono; }
    public void setClienteTelefono(String clienteTelefono) { this.clienteTelefono = clienteTelefono; }

    public String getClienteDireccion() { return clienteDireccion; }
    public void setClienteDireccion(String clienteDireccion) { this.clienteDireccion = clienteDireccion; }

    public String getEstado() { return estado; }
    public void setEstado(String estado) { this.estado = estado; }

    public BigDecimal getTotal() { return total; }
    public void setTotal(BigDecimal total) { this.total = total; }

    public String getObservaciones() { return observaciones; }
    public void setObservaciones(String observaciones) { this.observaciones = observaciones; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }

    public LocalDateTime getFechaEnvioCocina() { return fechaEnvioCocina; }
    public void setFechaEnvioCocina(LocalDateTime fechaEnvioCocina) { this.fechaEnvioCocina = fechaEnvioCocina; }

    public LocalDateTime getFechaDespacho() { return fechaDespacho; }
    public void setFechaDespacho(LocalDateTime fechaDespacho) { this.fechaDespacho = fechaDespacho; }

    public List<DetallePedido> getItems() { return items; }
    public void setItems(List<DetallePedido> items) { this.items = items; }

    public void addItem(DetallePedido item) {
        items.add(item);
        item.setPedido(this);
    }
}
