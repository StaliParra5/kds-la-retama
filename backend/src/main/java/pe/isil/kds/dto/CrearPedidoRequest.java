package pe.isil.kds.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import java.util.ArrayList;
import java.util.List;

public class CrearPedidoRequest {

    @NotNull(message = "El canal de venta es obligatorio")
    private Long canalId;

    private Long mesaId;

    private String clienteNombre;
    private String clienteTelefono;
    private String clienteDireccion;
    private String observaciones;

    @NotEmpty(message = "La comanda debe contener al menos un plato")
    @Valid
    private List<ItemPedidoRequest> items = new ArrayList<>();

    public CrearPedidoRequest() {}

    public Long getCanalId() { return canalId; }
    public void setCanalId(Long canalId) { this.canalId = canalId; }

    public Long getMesaId() { return mesaId; }
    public void setMesaId(Long mesaId) { this.mesaId = mesaId; }

    public String getClienteNombre() { return clienteNombre; }
    public void setClienteNombre(String clienteNombre) { this.clienteNombre = clienteNombre; }

    public String getClienteTelefono() { return clienteTelefono; }
    public void setClienteTelefono(String clienteTelefono) { this.clienteTelefono = clienteTelefono; }

    public String getClienteDireccion() { return clienteDireccion; }
    public void setClienteDireccion(String clienteDireccion) { this.clienteDireccion = clienteDireccion; }

    public String getObservaciones() { return observaciones; }
    public void setObservaciones(String observaciones) { this.observaciones = observaciones; }

    public List<ItemPedidoRequest> getItems() { return items; }
    public void setItems(List<ItemPedidoRequest> items) { this.items = items; }
}
