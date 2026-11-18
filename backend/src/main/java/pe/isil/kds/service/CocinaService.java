package pe.isil.kds.service;

import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import pe.isil.kds.dto.ItemCocinaDto;
import pe.isil.kds.exception.RecursoNoEncontradoException;
import pe.isil.kds.model.EstadoItem;
import pe.isil.kds.repository.DetallePedidoRepository;
import pe.isil.kds.repository.EstacionRepository;
import pe.isil.kds.security.SesionKds;

import java.util.Arrays;
import java.util.List;
import java.util.Objects;

/**
 * Consultas de las pantallas de cocina (HU011 / HU012).
 *
 * La cola de una estación se arma desde la base de datos: un ítem enrutado mientras la
 * pantalla estaba apagada aparece en cuanto la pantalla se conecta y pide su cola (HU011 Esc. 4).
 */
@Service
public class CocinaService {

    // Una sola definición de "cola activa": la del enum
    static final List<EstadoItem> ESTADOS_EN_COLA = Arrays.stream(EstadoItem.values()).filter(EstadoItem::enColaDeCocina).toList();

    private final DetallePedidoRepository detalleRepository;
    private final EstacionRepository estacionRepository;

    public CocinaService(DetallePedidoRepository detalleRepository, EstacionRepository estacionRepository) {
        this.detalleRepository = detalleRepository;
        this.estacionRepository = estacionRepository;
    }

    @Transactional(readOnly = true)
    public List<ItemCocinaDto> colaDeEstacion(Long estacionId, SesionKds sesion) {
        if (!estacionRepository.existsById(estacionId)) {
            throw new RecursoNoEncontradoException("Estación no encontrada con ID: " + estacionId);
        }
        // Un cocinero solo consulta la cola de la estación vinculada a su terminal (D6/D8)
        if (sesion.tieneRol("COCINERO") && !Objects.equals(sesion.estacionId(), estacionId)) {
            throw new AccessDeniedException("Esta terminal está vinculada a otra estación.");
        }
        return detalleRepository.findByEstacionIdAndEstadoItemInOrderByPedidoFechaEnvioCocinaAscIdAsc(estacionId, ESTADOS_EN_COLA)
                .stream().map(ItemCocinaMapper::aDto).toList();
    }

    /** Pase (D9): ítems Listos de todas las estaciones, esperando que el expedidor los despache. */
    @Transactional(readOnly = true)
    public List<ItemCocinaDto> listosParaPase() {
        return detalleRepository.findByEstadoItemOrderByPedidoFechaEnvioCocinaAscIdAsc(EstadoItem.LISTO)
                .stream().map(ItemCocinaMapper::aDto).toList();
    }
}
