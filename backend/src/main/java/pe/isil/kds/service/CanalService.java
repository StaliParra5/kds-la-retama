package pe.isil.kds.service;

import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import pe.isil.kds.dto.CanalDto;
import pe.isil.kds.model.CanalVenta;
import pe.isil.kds.repository.CanalVentaRepository;

import java.util.List;
import java.util.Objects;
import java.util.stream.Collectors;

/**
 * Servicio de Canales de Venta y SLAs (RF-CFG-04).
 * Permite configurar los tiempos SLA por canal para semaforización en KDS
 * y activar o desactivar canales para la recepción de pedidos (HU010).
 *
 * Reglas agregadas en Sprint 3:
 * - HU025 (HU037 Esc. 3): umbral ámbar por canal, entre 1 % y 99 % del SLA.
 * - HU015: color e ícono por canal; el color no puede parecerse al semáforo ni a otro canal activo
 *   (ColorCanal). Al reactivar un canal se revisa que su color siga distinguiéndose de los activos.
 * - D39: los tiempos de Salón se configuran solo en la pestaña Salón (semáforo de mesas); aquí se rechazan.
 * - Todo cambio de SLA, umbral o apariencia avisa por /topic/canales: las pantallas abiertas recalculan los
 *   colores de los pedidos activos al instante (HU025 Esc. 4).
 */
@Service
public class CanalService {

    // D39: canal cuyos tiempos se configuran en la pestaña Salón
    public static final String CODIGO_SALON = "SALON";

    private final CanalVentaRepository canalRepository;
    private final ApplicationEventPublisher eventPublisher;

    public CanalService(CanalVentaRepository canalRepository, ApplicationEventPublisher eventPublisher) {
        this.canalRepository = canalRepository;
        this.eventPublisher = eventPublisher;
    }

    @Transactional(readOnly = true)
    public List<CanalDto> listarCanales(boolean incluirInactivos) {
        List<CanalVenta> canales = incluirInactivos
                ? canalRepository.findAllByOrderByIdAsc()
                : canalRepository.findByActivoTrueOrderByIdAsc();
        return canales.stream().map(this::convertirADto).collect(Collectors.toList());
    }

    @Transactional
    public CanalDto cambiarEstado(Long canalId, boolean activo) {
        CanalVenta canal = buscar(canalId);
        // HU015: un canal que vuelve a activarse no puede compartir un color parecido con otro canal activo
        if (activo && !Boolean.TRUE.equals(canal.getActivo()) && canal.getColor() != null) {
            try {
                ColorCanal.validar(canal.getColor(), otrosCanalesActivos(canal));
            } catch (IllegalArgumentException e) {
                throw new IllegalArgumentException("No se puede activar el canal " + canal.getNombre() + ": " + e.getMessage()
                        + " Cambie su color antes de activarlo.");
            }
        }
        canal.setActivo(activo);
        return guardarYAvisar(canal);
    }

    @Transactional
    public CanalDto actualizarSla(Long canalId, Integer nuevoSla) {
        return actualizarSla(canalId, nuevoSla, null);
    }

    /** HU037/HU025: SLA del canal y, si llega, el porcentaje del SLA en que el semáforo pasa a ámbar. */
    @Transactional
    public CanalDto actualizarSla(Long canalId, Integer nuevoSla, Integer umbralAmbarPorcentaje) {
        if (nuevoSla == null || nuevoSla <= 0) {
            throw new IllegalArgumentException("El SLA objetivo debe ser mayor a 0 minutos.");
        }
        if (umbralAmbarPorcentaje != null && (umbralAmbarPorcentaje < 1 || umbralAmbarPorcentaje > 99)) {
            throw new IllegalArgumentException("El umbral ámbar debe estar entre 1 % y 99 % del SLA.");
        }

        CanalVenta canal = buscar(canalId);
        if (CODIGO_SALON.equalsIgnoreCase(canal.getCodigo())) {
            throw new IllegalArgumentException("Los tiempos de Salón se configuran en la pestaña Salón (semáforo de mesas).");
        }
        canal.setSlaObjetivoMinutos(nuevoSla);
        if (umbralAmbarPorcentaje != null) {
            canal.setUmbralAmbarPorcentaje(umbralAmbarPorcentaje);
        }
        return guardarYAvisar(canal);
    }

    /** HU015: color e ícono del canal, validando que el color se distinga del semáforo y de los demás canales. */
    @Transactional
    public CanalDto actualizarApariencia(Long canalId, String color, String icono) {
        CanalVenta canal = buscar(canalId);
        String colorValido = ColorCanal.validar(color, otrosCanalesActivos(canal));
        if (icono == null || !icono.matches("^[a-z0-9_]{1,40}$")) {
            throw new IllegalArgumentException("El ícono no es válido.");
        }
        canal.setColor(colorValido);
        canal.setIcono(icono);
        return guardarYAvisar(canal);
    }

    private CanalVenta buscar(Long canalId) {
        return canalRepository.findById(canalId)
                .orElseThrow(() -> new IllegalArgumentException("Canal no encontrado con ID: " + canalId));
    }

    // Solo los canales activos compiten por colores distinguibles en el tablero
    private List<ColorCanal.OtroCanal> otrosCanalesActivos(CanalVenta canal) {
        return canalRepository.findByActivoTrueOrderByIdAsc().stream()
                .filter(c -> !Objects.equals(c.getId(), canal.getId()))
                .map(c -> new ColorCanal.OtroCanal(c.getNombre(), c.getColor()))
                .toList();
    }

    // El aviso se envía al confirmarse la transacción (NotificadorKds), para no anunciar cambios que se revierten
    private CanalDto guardarYAvisar(CanalVenta canal) {
        CanalDto dto = convertirADto(canalRepository.save(canal));
        eventPublisher.publishEvent(new NotificadorKds.CanalKdsEvent(dto.getId(), dto.getCodigo()));
        return dto;
    }

    private CanalDto convertirADto(CanalVenta c) {
        CanalDto dto = new CanalDto(c.getId(), c.getCodigo(), c.getNombre(), c.getSlaObjetivoMinutos(), c.getActivo());
        dto.setExterno(Boolean.TRUE.equals(c.getExterno()));
        dto.setColor(c.getColor());
        dto.setIcono(c.getIcono());
        dto.setUmbralAmbarPorcentaje(c.getUmbralAmbarPorcentaje());
        dto.setUmbralAmbarMinutos(c.getUmbralAmbarMinutos());
        return dto;
    }
}
