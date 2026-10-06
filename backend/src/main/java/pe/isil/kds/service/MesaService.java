package pe.isil.kds.service;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import pe.isil.kds.dto.MesaDto;
import pe.isil.kds.dto.ZonaDto;
import pe.isil.kds.model.Mesa;
import pe.isil.kds.model.Zona;
import pe.isil.kds.repository.MesaRepository;
import pe.isil.kds.repository.ZonaRepository;

import java.util.List;
import java.util.stream.Collectors;

/**
 * Servicio de Zonas y Mesas de Salón (HU005).
 * 
 * Regla de Negocio Crítica:
 * - El número de mesa es estrictamente único por zona (HU005 Escenario 2).
 */
@Service
public class MesaService {

    private final ZonaRepository zonaRepository;
    private final MesaRepository mesaRepository;

    public MesaService(ZonaRepository zonaRepository, MesaRepository mesaRepository) {
        this.zonaRepository = zonaRepository;
        this.mesaRepository = mesaRepository;
    }

    @Transactional(readOnly = true)
    public List<ZonaDto> listarZonasConMesas() {
        return zonaRepository.findByActivoTrue().stream()
                .map(zona -> {
                    List<MesaDto> mesasDto = mesaRepository.findByZonaIdAndActivoTrue(zona.getId()).stream()
                            .map(m -> new MesaDto(m.getId(), zona.getId(), zona.getNombre(), m.getNumeroMesa(), m.getCapacidad(), m.getActivo()))
                            .collect(Collectors.toList());
                    return new ZonaDto(zona.getId(), zona.getNombre(), zona.getDescripcion(), zona.getActivo(), mesasDto);
                })
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<MesaDto> listarMesas() {
        return mesaRepository.findByActivoTrue().stream()
                .map(m -> new MesaDto(m.getId(), m.getZona().getId(), m.getZona().getNombre(), m.getNumeroMesa(), m.getCapacidad(), m.getActivo()))
                .collect(Collectors.toList());
    }

    @Transactional
    public MesaDto crearMesa(Long zonaId, String numeroMesa, Integer capacidad) {
        Zona zona = zonaRepository.findById(zonaId)
                .orElseThrow(() -> new IllegalArgumentException("Zona no encontrada con ID: " + zonaId));

        if (mesaRepository.findByZonaIdAndNumeroMesa(zonaId, numeroMesa.trim()).isPresent()) {
            throw new IllegalArgumentException("Ya existe una mesa con el número '" + numeroMesa + "' en la zona '" + zona.getNombre() + "'.");
        }

        Mesa mesa = new Mesa();
        mesa.setZona(zona);
        mesa.setNumeroMesa(numeroMesa.trim());
        mesa.setCapacidad(capacidad != null ? capacidad : 4);
        mesa.setActivo(true);

        Mesa guardada = mesaRepository.save(mesa);
        return new MesaDto(guardada.getId(), zona.getId(), zona.getNombre(), guardada.getNumeroMesa(), guardada.getCapacidad(), guardada.getActivo());
    }
}
