package pe.isil.kds.exception;

/**
 * Violación de una regla de dominio sobre el estado actual de un recurso
 * (ej. cambiar el canal de un pedido registrado). Se traduce a 409 Conflict.
 */
public class OperacionNoPermitidaException extends RuntimeException {

    public OperacionNoPermitidaException(String mensaje) {
        super(mensaje);
    }
}
