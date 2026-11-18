package pe.isil.kds.dto;

import java.time.LocalDateTime;
import java.util.List;

/**
 * Atención de una mesa con sus pedidos (HU044 Escenario 4, HU046 Escenario 5).
 */
public class AtencionMesaDto {

    private Long id;
    private Long mesaId;
    private String mesaNumero;
    private Long zonaId;
    private String zonaNombre;
    private Integer capacidad;
    private Integer personas;
    private String mozoNombre;
    private LocalDateTime abiertaEn;
    private LocalDateTime liberadaEn;
    private String liberadaPorNombre;
    // Ítems de la atención que aún no salen de cocina (ni despachados ni anulados)
    private int itemsPendientes;
    private List<PedidoResponse> pedidos = List.of();

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Long getMesaId() { return mesaId; }
    public void setMesaId(Long mesaId) { this.mesaId = mesaId; }

    public String getMesaNumero() { return mesaNumero; }
    public void setMesaNumero(String mesaNumero) { this.mesaNumero = mesaNumero; }

    public Long getZonaId() { return zonaId; }
    public void setZonaId(Long zonaId) { this.zonaId = zonaId; }

    public String getZonaNombre() { return zonaNombre; }
    public void setZonaNombre(String zonaNombre) { this.zonaNombre = zonaNombre; }

    public Integer getCapacidad() { return capacidad; }
    public void setCapacidad(Integer capacidad) { this.capacidad = capacidad; }

    public Integer getPersonas() { return personas; }
    public void setPersonas(Integer personas) { this.personas = personas; }

    public String getMozoNombre() { return mozoNombre; }
    public void setMozoNombre(String mozoNombre) { this.mozoNombre = mozoNombre; }

    public LocalDateTime getAbiertaEn() { return abiertaEn; }
    public void setAbiertaEn(LocalDateTime abiertaEn) { this.abiertaEn = abiertaEn; }

    public LocalDateTime getLiberadaEn() { return liberadaEn; }
    public void setLiberadaEn(LocalDateTime liberadaEn) { this.liberadaEn = liberadaEn; }

    public String getLiberadaPorNombre() { return liberadaPorNombre; }
    public void setLiberadaPorNombre(String liberadaPorNombre) { this.liberadaPorNombre = liberadaPorNombre; }

    public int getItemsPendientes() { return itemsPendientes; }
    public void setItemsPendientes(int itemsPendientes) { this.itemsPendientes = itemsPendientes; }

    public List<PedidoResponse> getPedidos() { return pedidos; }
    public void setPedidos(List<PedidoResponse> pedidos) { this.pedidos = pedidos; }
}
