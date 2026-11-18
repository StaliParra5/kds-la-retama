package pe.isil.kds.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
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

    // D36: credenciales del administrador que autoriza anular un ítem ya iniciado; no se usan para ítems pendientes
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

    /** Usuario y contraseña del administrador que autoriza. La contraseña nunca se registra ni se devuelve. */
    public static class Autorizacion {

        @Size(max = 50, message = "El usuario del administrador admite hasta 50 caracteres")
        private String usuario;

        @Size(max = 100, message = "La contraseña del administrador admite hasta 100 caracteres")
        private String password;

        public Autorizacion() {}

        public Autorizacion(String usuario, String password) {
            this.usuario = usuario;
            this.password = password;
        }

        public String getUsuario() { return usuario; }
        public void setUsuario(String usuario) { this.usuario = usuario; }

        public String getPassword() { return password; }
        public void setPassword(String password) { this.password = password; }

        // Evita que la contraseña aparezca si el objeto llega a imprimirse en un log
        @Override
        public String toString() {
            return "Autorizacion[usuario=" + usuario + "]";
        }
    }
}
