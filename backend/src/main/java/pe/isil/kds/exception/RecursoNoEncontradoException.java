package pe.isil.kds.exception;

/**
 * El recurso solicitado por su identificador en la ruta no existe. Se traduce a 404 Not Found.
 */
public class RecursoNoEncontradoException extends RuntimeException {

    public RecursoNoEncontradoException(String mensaje) {
        super(mensaje);
    }
}
