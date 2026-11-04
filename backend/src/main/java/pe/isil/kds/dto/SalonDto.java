package pe.isil.kds.dto;

import java.time.LocalDateTime;
import java.util.List;

/**
 * Vista de salón del administrador (HU048): zonas activas con sus mesas y el color de cada una
 * según el semáforo vigente (HU047, D21).
 */
public record SalonDto(SemaforoDto semaforo, LocalDateTime generadoEn, List<Zona> zonas) {

    /** Estado de la mesa en el semáforo: libre (gris), verde, amarillo, rojo o atendida (azul). */
    public enum EstadoMesa { LIBRE, VERDE, AMARILLO, ROJO, ATENDIDA }

    /** Zona con los mozos que la atienden (HU043) y sus mesas. */
    public record Zona(Long id, String nombre, List<String> mozos, List<Mesa> mesas) {}

    /**
     * Mesa con su estado. Sin atención solo trae los datos de la mesa; con atención, quién la abrió,
     * cuántas personas hay, desde cuándo y los minutos de espera del pedido pendiente más antiguo.
     */
    public record Mesa(Long id, String numeroMesa, Integer capacidad, EstadoMesa estado,
                       Long atencionId, Integer personas, String mozoNombre, LocalDateTime abiertaEn,
                       Integer minutosEspera, int itemsPendientes) {}
}
