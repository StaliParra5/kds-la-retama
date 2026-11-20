package pe.isil.kds.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import pe.isil.kds.model.EstadoItem;
import pe.isil.kds.model.MotivoAnulacion;

/**
 * Solicitud de anulación de un ítem enviado (HU032).
 */
public class AnularItemRequest {

    // Escenario 3: sin motivo no se confirma la anulación (el servidor lo exige aunque la pantalla ya lo bloquee)
    @NotNull(message = "Seleccione un motivo para anular el ítem")
    private MotivoAnulacion motivo;

    // Estado que el mozo ve; si ya cambió se responde 409, porque de él depende si la anulación genera merma
    @NotNull(message = "El estado actual del ítem es obligatorio")
    private EstadoItem estadoActual;

    // D36: usuario y clave de autorización (PIN de 6 dígitos, no su contraseña) del administrador que autoriza
    // anular un ítem ya iniciado; no se usan para ítems pendientes
    @Valid
    private Autorizacion autorizacion;

    public AnularItemRequest() {}

    public AnularItemRequest(EstadoItem estadoActual, MotivoAnulacion motivo) {
        this.estadoActual = estadoActual;
        this.motivo = motivo;
    }

    public AnularItemRequest(EstadoItem estadoActual, MotivoAnulacion motivo, Autorizacion autorizacion) {
        this(estadoActual, motivo);
        this.autorizacion = autorizacion;
    }

    public MotivoAnulacion getMotivo() { return motivo; }
    public void setMotivo(MotivoAnulacion motivo) { this.motivo = motivo; }

    public EstadoItem getEstadoActual() { return estadoActual; }
    public void setEstadoActual(EstadoItem estadoActual) { this.estadoActual = estadoActual; }

    public Autorizacion getAutorizacion() { return autorizacion; }
    public void setAutorizacion(Autorizacion autorizacion) { this.autorizacion = autorizacion; }

    /** Usuario y clave de autorización del administrador. La clave nunca se registra ni se devuelve. */
    public static class Autorizacion {

        @Size(max = 50, message = "El usuario del administrador admite hasta 50 caracteres")
        private String usuario;

        @Pattern(regexp = "^\\d{6}$", message = "La clave de autorización tiene 6 dígitos")
        private String clave;

        public Autorizacion() {}

        public Autorizacion(String usuario, String clave) {
            this.usuario = usuario;
            this.clave = clave;
        }

        public String getUsuario() { return usuario; }
        public void setUsuario(String usuario) { this.usuario = usuario; }

        public String getClave() { return clave; }
        public void setClave(String clave) { this.clave = clave; }

        // Evita que la clave aparezca si el objeto llega a imprimirse en un log
        @Override
        public String toString() {
            return "Autorizacion[usuario=" + usuario + "]";
        }
    }
}
