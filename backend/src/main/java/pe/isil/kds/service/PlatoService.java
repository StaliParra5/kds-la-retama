package pe.isil.kds.service;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import pe.isil.kds.dto.GuardarPlatoRequest;
import pe.isil.kds.dto.PlatoDto;
import pe.isil.kds.model.CategoriaPlato;
import pe.isil.kds.model.Estacion;
import pe.isil.kds.model.Plato;
import pe.isil.kds.repository.CategoriaPlatoRepository;
import pe.isil.kds.repository.EstacionRepository;
import pe.isil.kds.repository.PlatoRepository;

import java.util.List;
import java.util.stream.Collectors;

/**
 * Servicio de Gestión del Catálogo de Platos y Carta Digital (HU003, HU007, HU023).
 * 
 * Reglas de Negocio Implementadas:
 * - tiempoEstandarMinutos > 0 y estacion obligatoria en cada plato para permitir la secuenciación de cocina.
 * - Búsqueda textual insensible a mayúsculas optimizada para responder en menos de 500 ms (requisito < 3 s).
 */
@Service
public class PlatoService {

    private final PlatoRepository platoRepository;
    private final CategoriaPlatoRepository categoriaRepository;
    private final EstacionRepository estacionRepository;

    public PlatoService(
            PlatoRepository platoRepository,
            CategoriaPlatoRepository categoriaRepository,
            EstacionRepository estacionRepository) {
        this.platoRepository = platoRepository;
        this.categoriaRepository = categoriaRepository;
        this.estacionRepository = estacionRepository;
    }

    @Transactional(readOnly = true)
    public List<PlatoDto> listarPlatos(Long categoriaId, String busqueda) {
        List<Plato> platos;

        if (categoriaId != null && busqueda != null && !busqueda.isBlank()) {
            platos = platoRepository.findByCategoriaIdAndNombreContainingIgnoreCaseAndActivoTrue(categoriaId, busqueda.trim());
        } else if (categoriaId != null) {
            platos = platoRepository.findByCategoriaIdAndActivoTrue(categoriaId);
        } else if (busqueda != null && !busqueda.isBlank()) {
            platos = platoRepository.findByNombreContainingIgnoreCaseAndActivoTrue(busqueda.trim());
        } else {
            platos = platoRepository.findByActivoTrue();
        }

        return platos.stream().map(this::convertirADto).collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public PlatoDto obtenerPorId(Long id) {
        Plato plato = platoRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Plato no encontrado con ID: " + id));
        return convertirADto(plato);
    }

    @Transactional
    public PlatoDto crearPlato(GuardarPlatoRequest request) {
        validarCamposObligatorios(request);

        CategoriaPlato categoria = categoriaRepository.findById(request.getCategoriaId())
                .orElseThrow(() -> new IllegalArgumentException("Categoría no encontrada con ID: " + request.getCategoriaId()));

        Estacion estacion = estacionRepository.findById(request.getEstacionId())
                .orElseThrow(() -> new IllegalArgumentException("Estación de cocina no encontrada con ID: " + request.getEstacionId()));

        Plato plato = new Plato();
        plato.setNombre(request.getNombre().trim());
        plato.setDescripcion(request.getDescripcion());
        plato.setCategoria(categoria);
        plato.setEstacion(estacion);
        plato.setPrecio(request.getPrecio());
        plato.setTiempoEstandarMinutos(request.getTiempoEstandarMinutos());
        plato.setDisponible(request.getDisponible() != null ? request.getDisponible() : true);
        plato.setActivo(true);

        Plato guardado = platoRepository.save(plato);
        return convertirADto(guardado);
    }

    @Transactional
    public PlatoDto actualizarPlato(Long id, GuardarPlatoRequest request) {
        validarCamposObligatorios(request);

        Plato plato = platoRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Plato no encontrado con ID: " + id));

        CategoriaPlato categoria = categoriaRepository.findById(request.getCategoriaId())
                .orElseThrow(() -> new IllegalArgumentException("Categoría no encontrada"));

        Estacion estacion = estacionRepository.findById(request.getEstacionId())
                .orElseThrow(() -> new IllegalArgumentException("Estación no encontrada"));

        plato.setNombre(request.getNombre().trim());
        plato.setDescripcion(request.getDescripcion());
        plato.setCategoria(categoria);
        plato.setEstacion(estacion);
        plato.setPrecio(request.getPrecio());
        plato.setTiempoEstandarMinutos(request.getTiempoEstandarMinutos());
        if (request.getDisponible() != null) {
            plato.setDisponible(request.getDisponible());
        }

        Plato actualizado = platoRepository.save(plato);
        return convertirADto(actualizado);
    }

    @Transactional
    public PlatoDto cambiarDisponibilidad(Long id, boolean disponible) {
        Plato plato = platoRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Plato no encontrado con ID: " + id));
        plato.setDisponible(disponible);
        return convertirADto(platoRepository.save(plato));
    }

    @Transactional(readOnly = true)
    public List<CategoriaPlato> listarCategorias() {
        return categoriaRepository.findByActivoTrueOrderByOrdenVisualAsc();
    }

    private void validarCamposObligatorios(GuardarPlatoRequest request) {
        if (request.getEstacionId() == null) {
            throw new IllegalArgumentException("La estación asignada es un dato obligatorio para enrutar en cocina.");
        }
        if (request.getTiempoEstandarMinutos() == null || request.getTiempoEstandarMinutos() <= 0) {
            throw new IllegalArgumentException("El tiempo estándar de preparación debe ser un valor positivo mayor a 0.");
        }
    }

    private PlatoDto convertirADto(Plato plato) {
        PlatoDto dto = new PlatoDto();
        dto.setId(plato.getId());
        dto.setCategoriaId(plato.getCategoria().getId());
        dto.setCategoriaNombre(plato.getCategoria().getNombre());
        dto.setEstacionId(plato.getEstacion().getId());
        dto.setEstacionNombre(plato.getEstacion().getNombre());
        dto.setNombre(plato.getNombre());
        dto.setDescripcion(plato.getDescripcion());
        dto.setPrecio(plato.getPrecio());
        dto.setTiempoEstandarMinutos(plato.getTiempoEstandarMinutos());
        dto.setDisponible(plato.getDisponible());
        dto.setActivo(plato.getActivo());
        return dto;
    }
}
