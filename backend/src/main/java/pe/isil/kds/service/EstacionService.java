package pe.isil.kds.service;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import pe.isil.kds.dto.EstacionDto;
import pe.isil.kds.model.Estacion;
import pe.isil.kds.repository.EstacionRepository;
import pe.isil.kds.repository.PlatoRepository;

import java.util.List;
import java.util.stream.Collectors;

/**
 * Servicio de Estaciones de Cocina (HU004).
 * Provee consulta y administración de las líneas de preparación física de La Retama.
 */
@Service
public class EstacionService {

    private final EstacionRepository estacionRepository;
    private final PlatoRepository platoRepository;

    public EstacionService(EstacionRepository estacionRepository, PlatoRepository platoRepository) {
        this.estacionRepository = estacionRepository;
        this.platoRepository = platoRepository;
    }

    @Transactional(readOnly = true)
    public List<EstacionDto> listarEstaciones() {
        return estacionRepository.findByActivoTrue().stream()
                .map(estacion -> {
                    // Consulta agregada a nivel de base de datos para prevenir problemas de rendimiento N+1
                    long count = platoRepository.countByEstacionIdAndActivoTrue(estacion.getId());
                    return new EstacionDto(
                            estacion.getId(),
                            estacion.getCodigo(),
                            estacion.getNombre(),
                            estacion.getDescripcion(),
                            estacion.getActivo(),
                            count
                    );
                })
                .collect(Collectors.toList());
    }

    @Transactional
    public Estacion crearEstacion(pe.isil.kds.dto.CrearEstacionRequest req) {
        if (estacionRepository.findByCodigo(req.getCodigo().trim()).isPresent()) {
            throw new IllegalArgumentException("Ya existe una estación con el código: " + req.getCodigo());
        }
        // HU004 Escenario 3: Validación de nombre único
        if (estacionRepository.findByNombreIgnoreCase(req.getNombre().trim()).isPresent()) {
            throw new IllegalArgumentException("Ya existe una estación con el nombre: " + req.getNombre());
        }
        Estacion nueva = new Estacion();
        nueva.setCodigo(req.getCodigo().trim().toUpperCase());
        nueva.setNombre(req.getNombre().trim());
        nueva.setDescripcion(req.getDescripcion());
        nueva.setActivo(true);
        return estacionRepository.save(nueva);
    }

    @Transactional
    public Estacion actualizarEstacion(Long id, pe.isil.kds.dto.ActualizarEstacionRequest req) {
        Estacion existente = estacionRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Estación no encontrada con ID: " + id));

        // HU004 Escenario 4: Impedir desactivación si la estación tiene platos activos asignados
        if (Boolean.FALSE.equals(req.getActivo())) {
            List<pe.isil.kds.model.Plato> platosAsignados = platoRepository.findByEstacionIdAndActivoTrue(id);
            if (!platosAsignados.isEmpty()) {
                String nombres = platosAsignados.stream()
                        .map(pe.isil.kds.model.Plato::getNombre)
                        .collect(Collectors.joining(", "));
                throw new IllegalArgumentException("No se puede desactivar la estación porque tiene platos asignados: " + nombres + ". Reasigne los platos antes de desactivarla.");
            }
        }

        existente.setNombre(req.getNombre().trim());
        existente.setDescripcion(req.getDescripcion());
        if (req.getActivo() != null) {
            existente.setActivo(req.getActivo());
        }
        return estacionRepository.save(existente);
    }
}
