package pe.isil.kds.service;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import pe.isil.kds.dto.CanalDto;
import pe.isil.kds.model.CanalVenta;
import pe.isil.kds.repository.CanalVentaRepository;

import java.util.List;
import java.util.stream.Collectors;

/**
 * Servicio de Canales de Venta y SLAs (RF-CFG-04).
 * Permite configurar los tiempos SLA por canal para semaforización en KDS
 * y activar o desactivar canales para la recepción de pedidos (HU010).
 */
@Service
public class CanalService {

    private final CanalVentaRepository canalRepository;

    public CanalService(CanalVentaRepository canalRepository) {
        this.canalRepository = canalRepository;
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
        CanalVenta canal = canalRepository.findById(canalId)
                .orElseThrow(() -> new IllegalArgumentException("Canal no encontrado con ID: " + canalId));
        canal.setActivo(activo);
        return convertirADto(canalRepository.save(canal));
    }

    @Transactional
    public CanalDto actualizarSla(Long canalId, Integer nuevoSla) {
        if (nuevoSla == null || nuevoSla <= 0) {
            throw new IllegalArgumentException("El SLA objetivo debe ser mayor a 0 minutos.");
        }

        CanalVenta canal = canalRepository.findById(canalId)
                .orElseThrow(() -> new IllegalArgumentException("Canal no encontrado con ID: " + canalId));

        canal.setSlaObjetivoMinutos(nuevoSla);
        return convertirADto(canalRepository.save(canal));
    }

    private CanalDto convertirADto(CanalVenta c) {
        return new CanalDto(c.getId(), c.getCodigo(), c.getNombre(), c.getSlaObjetivoMinutos(), c.getActivo());
    }
}
