package pe.isil.kds.dto;

/**
 * Si el administrador ya tiene clave de autorización (HU049). Nunca se expone la clave ni su hash.
 */
public record ClaveAutorizacionEstadoDto(boolean configurada) {}
