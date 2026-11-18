package pe.isil.kds.dto;

/**
 * Zona asignada a un mozo, tal como se muestra en la gestión de mozos (HU043).
 */
public record ZonaAsignadaDto(Long id, String nombre, Boolean activo) {
}
