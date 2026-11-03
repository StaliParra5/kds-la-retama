package pe.isil.kds.dto;

import java.time.LocalDateTime;

/**
 * Ítem de pedido tal como lo consumen las pantallas de cocina y pase:
 * incluye la referencia del pedido para no perder el contexto (HU012).
 */
public class ItemCocinaDto {

    private Long id;
    private Long version;
    private String estado;
    private Integer cantidad;
    private String platoNombre;
    private String modificadores;
    private Integer tiempoEstandarMinutos;
    private LocalDateTime horaDisparo;
    private LocalDateTime creadoEn;

    private Long estacionId;
    private String estacionNombre;

    private Long pedidoId;
    private String codigoPedido;
    private String estadoPedido;
    private String canalCodigo;
    private String canalNombre;
    private Integer canalSlaMinutos;
    private String mesaNumero;
    private LocalDateTime fechaEnvioCocina;
    // Ítems vigentes del mismo pedido asignados a otras estaciones (solo lectura)
    private Integer itemsEnOtrasEstaciones;

    public ItemCocinaDto() {}

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Long getVersion() { return version; }
    public void setVersion(Long version) { this.version = version; }

    public String getEstado() { return estado; }
    public void setEstado(String estado) { this.estado = estado; }

    public Integer getCantidad() { return cantidad; }
    public void setCantidad(Integer cantidad) { this.cantidad = cantidad; }

    public String getPlatoNombre() { return platoNombre; }
    public void setPlatoNombre(String platoNombre) { this.platoNombre = platoNombre; }

    public String getModificadores() { return modificadores; }
    public void setModificadores(String modificadores) { this.modificadores = modificadores; }

    public Integer getTiempoEstandarMinutos() { return tiempoEstandarMinutos; }
    public void setTiempoEstandarMinutos(Integer tiempoEstandarMinutos) { this.tiempoEstandarMinutos = tiempoEstandarMinutos; }

    public LocalDateTime getHoraDisparo() { return horaDisparo; }
    public void setHoraDisparo(LocalDateTime horaDisparo) { this.horaDisparo = horaDisparo; }

    public LocalDateTime getCreadoEn() { return creadoEn; }
    public void setCreadoEn(LocalDateTime creadoEn) { this.creadoEn = creadoEn; }

    public Long getEstacionId() { return estacionId; }
    public void setEstacionId(Long estacionId) { this.estacionId = estacionId; }

    public String getEstacionNombre() { return estacionNombre; }
    public void setEstacionNombre(String estacionNombre) { this.estacionNombre = estacionNombre; }

    public Long getPedidoId() { return pedidoId; }
    public void setPedidoId(Long pedidoId) { this.pedidoId = pedidoId; }

    public String getCodigoPedido() { return codigoPedido; }
    public void setCodigoPedido(String codigoPedido) { this.codigoPedido = codigoPedido; }

    public String getEstadoPedido() { return estadoPedido; }
    public void setEstadoPedido(String estadoPedido) { this.estadoPedido = estadoPedido; }

    public String getCanalCodigo() { return canalCodigo; }
    public void setCanalCodigo(String canalCodigo) { this.canalCodigo = canalCodigo; }

    public String getCanalNombre() { return canalNombre; }
    public void setCanalNombre(String canalNombre) { this.canalNombre = canalNombre; }

    public Integer getCanalSlaMinutos() { return canalSlaMinutos; }
    public void setCanalSlaMinutos(Integer canalSlaMinutos) { this.canalSlaMinutos = canalSlaMinutos; }

    public String getMesaNumero() { return mesaNumero; }
    public void setMesaNumero(String mesaNumero) { this.mesaNumero = mesaNumero; }

    public LocalDateTime getFechaEnvioCocina() { return fechaEnvioCocina; }
    public void setFechaEnvioCocina(LocalDateTime fechaEnvioCocina) { this.fechaEnvioCocina = fechaEnvioCocina; }

    public Integer getItemsEnOtrasEstaciones() { return itemsEnOtrasEstaciones; }
    public void setItemsEnOtrasEstaciones(Integer itemsEnOtrasEstaciones) { this.itemsEnOtrasEstaciones = itemsEnOtrasEstaciones; }
}
