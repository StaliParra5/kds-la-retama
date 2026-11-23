package pe.isil.kds.dto;

import java.time.Instant;

/**
 * Estado de la salida a internet del servidor (HU018 Esc. 4 y 6). internet es null mientras no hay una primera
 * comprobación. No afecta a la operación local: solo avisa que los canales externos (Rappi) no pueden llegar.
 */
public record EstadoSistemaDto(Boolean internet, Instant verificadoEn) {}
