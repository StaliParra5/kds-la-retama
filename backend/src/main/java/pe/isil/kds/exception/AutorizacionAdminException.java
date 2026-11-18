package pe.isil.kds.exception;

/**
 * Falta o falla la autorización del administrador para anular un ítem ya iniciado (HU032, D36). Se traduce a 403
 * con un código, nunca a 401: una clave de administrador incorrecta no debe cerrar la sesión del mozo.
 */
public class AutorizacionAdminException extends RuntimeException {

    public static final String REQUERIDA = "AUTORIZACION_ADMIN_REQUERIDA";
    public static final String INVALIDA = "AUTORIZACION_ADMIN_INVALIDA";
    public static final String BLOQUEADA = "AUTORIZACION_ADMIN_BLOQUEADA";

    private final String codigo;

    public AutorizacionAdminException(String mensaje, String codigo) {
        super(mensaje);
        this.codigo = codigo;
    }

    public String getCodigo() {
        return codigo;
    }
}
