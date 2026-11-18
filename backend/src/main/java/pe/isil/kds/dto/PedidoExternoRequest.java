package pe.isil.kds.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.util.ArrayList;
import java.util.List;

/**
 * Payload normalizado del punto de integración para pedidos externos (HU019, RF-ING-02).
 *
 * Ejemplo:
 * {
 *   "canal": "RAPPI",
 *   "numeroOrden": "RP-48213",
 *   "cliente": { "nombre": "Ana Torres", "telefono": "987654321", "direccion": "Av. Brasil 123" },
 *   "observaciones": "Tocar el timbre",
 *   "items": [ { "codigoPlato": "PLT-007", "cantidad": 2, "modificadores": ["Sin cebolla"] } ]
 * }
 */
public class PedidoExternoRequest {

    @NotBlank(message = "El campo 'canal' es obligatorio")
    @Size(max = 30, message = "El campo 'canal' admite hasta 30 caracteres")
    private String canal;

    @NotBlank(message = "El campo 'numeroOrden' es obligatorio")
    @Size(max = 60, message = "El campo 'numeroOrden' admite hasta 60 caracteres")
    private String numeroOrden;

    @Valid
    private Cliente cliente;

    @Size(max = 500, message = "El campo 'observaciones' admite hasta 500 caracteres")
    private String observaciones;

    @NotEmpty(message = "El campo 'items' debe incluir al menos un ítem")
    @Size(max = 50, message = "Un pedido admite como máximo 50 ítems")
    @Valid
    private List<Item> items = new ArrayList<>();

    public PedidoExternoRequest() {}

    public String getCanal() { return canal; }
    public void setCanal(String canal) { this.canal = canal; }

    public String getNumeroOrden() { return numeroOrden; }
    public void setNumeroOrden(String numeroOrden) { this.numeroOrden = numeroOrden; }

    public Cliente getCliente() { return cliente; }
    public void setCliente(Cliente cliente) { this.cliente = cliente; }

    public String getObservaciones() { return observaciones; }
    public void setObservaciones(String observaciones) { this.observaciones = observaciones; }

    public List<Item> getItems() { return items; }
    public void setItems(List<Item> items) { this.items = items; }

    public static class Cliente {

        @Size(max = 120, message = "El campo 'cliente.nombre' admite hasta 120 caracteres")
        private String nombre;

        @Size(max = 30, message = "El campo 'cliente.telefono' admite hasta 30 caracteres")
        private String telefono;

        @Size(max = 255, message = "El campo 'cliente.direccion' admite hasta 255 caracteres")
        private String direccion;

        public Cliente() {}

        public String getNombre() { return nombre; }
        public void setNombre(String nombre) { this.nombre = nombre; }

        public String getTelefono() { return telefono; }
        public void setTelefono(String telefono) { this.telefono = telefono; }

        public String getDireccion() { return direccion; }
        public void setDireccion(String direccion) { this.direccion = direccion; }
    }

    public static class Item {

        @NotBlank(message = "El campo 'codigoPlato' es obligatorio")
        @Size(max = 20, message = "El campo 'codigoPlato' admite hasta 20 caracteres")
        private String codigoPlato;

        @NotNull(message = "El campo 'cantidad' es obligatorio")
        @Min(value = 1, message = "La 'cantidad' mínima es 1")
        @Max(value = 50, message = "La 'cantidad' máxima por ítem es 50")
        private Integer cantidad;

        // Se guardan unidos por coma: ningún modificador puede llevar coma
        @Size(max = 20, message = "Un ítem admite como máximo 20 modificadores")
        private List<@NotBlank(message = "Los modificadores no pueden estar vacíos")
                @Size(max = 60, message = "Cada modificador admite hasta 60 caracteres")
                @Pattern(regexp = "[^,]*", message = "Los modificadores no pueden contener comas") String> modificadores = new ArrayList<>();

        public Item() {}

        public String getCodigoPlato() { return codigoPlato; }
        public void setCodigoPlato(String codigoPlato) { this.codigoPlato = codigoPlato; }

        public Integer getCantidad() { return cantidad; }
        public void setCantidad(Integer cantidad) { this.cantidad = cantidad; }

        public List<String> getModificadores() { return modificadores; }
        public void setModificadores(List<String> modificadores) { this.modificadores = modificadores; }
    }
}
