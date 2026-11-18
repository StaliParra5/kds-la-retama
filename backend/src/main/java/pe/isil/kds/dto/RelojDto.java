package pe.isil.kds.dto;

/**
 * Hora del servidor (HU021 Esc. 6): instante en milisegundos desde 1970 y zona horaria del restaurante.
 * Las pantallas calculan con ella cuánto se adelanta o atrasa su propio reloj.
 */
public record RelojDto(long epochMs, String zona) {}
