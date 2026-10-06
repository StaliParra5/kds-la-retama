package pe.isil.kds.dto;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

public class PedidoResponse {

    private Long id;
    private String codigoCorrelativo;
    private Long canalId;
    private String canalCodigo;
    private String canalNombre;
    private Long mesaId;
    private String mesaNumero;
    private String usuarioNombre;
    private String clienteNombre;
    private String clienteTelefono;
    private String estado;
    private BigDecimal total;
    private String observaciones;
    private LocalDateTime createdAt;
    private List<DetalleItemResponse> items = new ArrayList<>();

    public PedidoResponse() {}

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getCodigoCorrelativo() { return codigoCorrelativo; }
    public void setCodigoCorrelativo(String codigoCorrelativo) { this.codigoCorrelativo = codigoCorrelativo; }

    public Long getCanalId() { return canalId; }
    public void setCanalId(Long canalId) { this.canalId = canalId; }

    public String getCanalCodigo() { return canalCodigo; }
    public void setCanalCodigo(String canalCodigo) { this.canalCodigo = canalCodigo; }

    public String getCanalNombre() { return canalNombre; }
    public void setCanalNombre(String canalNombre) { this.canalNombre = canalNombre; }

    public Long getMesaId() { return mesaId; }
    public void setMesaId(Long mesaId) { this.mesaId = mesaId; }

    public String getMesaNumero() { return mesaNumero; }
    public void setMesaNumero(String mesaNumero) { this.mesaNumero = mesaNumero; }

    public String getUsuarioNombre() { return usuarioNombre; }
    public void setUsuarioNombre(String usuarioNombre) { this.usuarioNombre = usuarioNombre; }

    public String getClienteNombre() { return clienteNombre; }
    public void setClienteNombre(String clienteNombre) { this.clienteNombre = clienteNombre; }

    public String getClienteTelefono() { return clienteTelefono; }
    public void setClienteTelefono(String clienteTelefono) { this.clienteTelefono = clienteTelefono; }

    public String getEstado() { return estado; }
    public void setEstado(String estado) { this.estado = estado; }

    public BigDecimal getTotal() { return total; }
    public void setTotal(BigDecimal total) { this.total = total; }

    public String getObservaciones() { return observaciones; }
    public void setObservaciones(String observaciones) { this.observaciones = observaciones; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }

    public List<DetalleItemResponse> getItems() { return items; }
    public void setItems(List<DetalleItemResponse> items) { this.items = items; }

    public static class DetalleItemResponse {
        private Long id;
        private Long platoId;
        private String platoNombre;
        private Long estacionId;
        private String estacionNombre;
        private Integer cantidad;
        private BigDecimal precioUnitario;
        private BigDecimal subtotal;
        private String modificadores;
        private Integer tiempoEstandarMinutos;
        private String estadoItem;

        public DetalleItemResponse() {}

        public Long getId() { return id; }
        public void setId(Long id) { this.id = id; }

        public Long getPlatoId() { return platoId; }
        public void setPlatoId(Long platoId) { this.platoId = platoId; }

        public String getPlatoNombre() { return platoNombre; }
        public void setPlatoNombre(String platoNombre) { this.platoNombre = platoNombre; }

        public Long getEstacionId() { return estacionId; }
        public void setEstacionId(Long estacionId) { this.estacionId = estacionId; }

        public String getEstacionNombre() { return estacionNombre; }
        public void setEstacionNombre(String estacionNombre) { this.estacionNombre = estacionNombre; }

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

        public String getEstadoItem() { return estadoItem; }
        public void setEstadoItem(String estadoItem) { this.estadoItem = estadoItem; }
    }
}
