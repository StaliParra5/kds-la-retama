package pe.isil.kds.model;

import com.fasterxml.jackson.annotation.JsonManagedReference;
import jakarta.persistence.*;
import pe.isil.kds.exception.OperacionNoPermitidaException;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

/**
 * Entidad Pedido: Representa una comanda u orden en el sistema.
 * 
 * Reglas de Dominio:
 * - Si canal.codigo == 'SALON', la asociación con 'mesa' es obligatoria (HU006).
 * - El canal de origen es inmutable una vez registrado el pedido (HU010 Escenario 5).
 * - Su estado se deriva del estado de sus ítems (HU013); al registrarse queda ENVIADO.
 */
@Entity
@Table(name = "pedidos")
public class Pedido {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "codigo_correlativo", nullable = false, unique = true, length = 30)
    private String codigoCorrelativo;

    // Clave de idempotencia del envío desde el comandero (HU009)
    @Column(name = "clave_idempotencia", unique = true, length = 64, updatable = false)
    private String claveIdempotencia;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "canal_id", nullable = false, updatable = false)
    private CanalVenta canal;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "mesa_id")
    private Mesa mesa;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "usuario_id", nullable = false)
    private Usuario usuario;

    // HU044: atención de la mesa a la que pertenece el pedido de salón (nula fuera de salón)
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "atencion_id")
    private AtencionMesa atencion;

    @Column(name = "cliente_nombre", length = 120)
    private String clienteNombre;

    @Column(name = "cliente_telefono", length = 30)
    private String clienteTelefono;

    @Column(name = "cliente_direccion", columnDefinition = "TEXT")
    private String clienteDireccion;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private EstadoPedido estado = EstadoPedido.ENVIADO;

    @Column(nullable = false, precision = 10, scale = 2)
    private BigDecimal total = BigDecimal.ZERO;

    @Column(columnDefinition = "TEXT")
    private String observaciones;

    // HU019/HU020: identificador del pedido en el canal de origen (por ejemplo, el número de orden de Rappi)
    @Column(name = "numero_orden_externo", length = 60)
    private String numeroOrdenExterno;

    // HU020/HU032: lo registró el expedidor o la integración (no el comandero); el expedidor solo anula estos pedidos
    @Column(name = "registro_externo", nullable = false)
    private Boolean registroExterno = false;

    // HU021 Esc. 4: 0 es la comanda original de la mesa; 1, 2... las adiciones enviadas después en la misma atención
    @Column(name = "numero_adicion", nullable = false)
    private Integer numeroAdicion = 0;

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

    public Integer getNumeroAdicion() { return numeroAdicion; }
    public void setNumeroAdicion(Integer numeroAdicion) { this.numeroAdicion = numeroAdicion; }

    public Boolean getRegistroExterno() { return registroExterno; }
    public void setRegistroExterno(Boolean registroExterno) { this.registroExterno = registroExterno; }

    public String getNumeroOrdenExterno() { return numeroOrdenExterno; }
    public void setNumeroOrdenExterno(String numeroOrdenExterno) { this.numeroOrdenExterno = numeroOrdenExterno; }

    public String getClaveIdempotencia() { return claveIdempotencia; }
    public void setClaveIdempotencia(String claveIdempotencia) { this.claveIdempotencia = claveIdempotencia; }

    public CanalVenta getCanal() { return canal; }
    public void setCanal(CanalVenta canal) {
        if (this.id != null && this.canal != null && !mismoCanal(canal)) {
            throw new OperacionNoPermitidaException("El canal de origen de un pedido registrado no puede modificarse.");
        }
        this.canal = canal;
    }

    private boolean mismoCanal(CanalVenta otro) {
        return otro != null && otro.getId() != null && otro.getId().equals(this.canal.getId());
    }

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

    public AtencionMesa getAtencion() { return atencion; }
    public void setAtencion(AtencionMesa atencion) { this.atencion = atencion; }

    public EstadoPedido getEstado() { return estado; }
    public void setEstado(EstadoPedido estado) { this.estado = estado; }

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
