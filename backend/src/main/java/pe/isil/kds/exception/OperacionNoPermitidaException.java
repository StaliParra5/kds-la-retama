package pe.isil.kds.exception;

/**
 * Violación de una regla de dominio sobre el estado actual de un recurso
 * (ej. cambiar el canal de un pedido registrado). Se traduce a 409 Conflict.
 * El código opcional permite al cliente reaccionar a un caso concreto sin depender del texto.
 */
public class OperacionNoPermitidaException extends RuntimeException {

    // HU014 Esc. 3: el ítem está retenido hasta su hora de disparo y falta la confirmación
    public static final String INICIO_ANTICIPADO_REQUERIDO = "INICIO_ANTICIPADO_REQUERIDO";

    private final String codigo;

    public OperacionNoPermitidaException(String mensaje) {
        this(mensaje, null);
    }

    public OperacionNoPermitidaException(String mensaje, String codigo) {
        super(mensaje);
        this.codigo = codigo;
    }

    public String getCodigo() {
        return codigo;
    }
}
