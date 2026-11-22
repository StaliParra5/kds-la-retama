package pe.isil.kds.service;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import pe.isil.kds.dto.ConfiguracionCocinaDto;
import pe.isil.kds.model.ConfiguracionCocina;
import pe.isil.kds.repository.ConfiguracionCocinaRepository;

/**
 * Configuración de cocina (HU033, decisión D41). Si la fila no existiera se usan los valores por defecto,
 * así la cocina nunca queda sin ventana para deshacer.
 */
@Service
public class ConfiguracionCocinaService {

    private final ConfiguracionCocinaRepository repository;

    public ConfiguracionCocinaService(ConfiguracionCocinaRepository repository) {
        this.repository = repository;
    }

    @Transactional(readOnly = true)
    public int ventanaRecallSegundos() {
        return repository.findById(ConfiguracionCocina.ID_UNICO)
                .map(ConfiguracionCocina::getVentanaRecallSegundos)
                .orElse(ConfiguracionCocina.VENTANA_RECALL_POR_DEFECTO);
    }

    @Transactional(readOnly = true)
    public ConfiguracionCocinaDto obtener() {
        return new ConfiguracionCocinaDto(ventanaRecallSegundos());
    }

    @Transactional
    public ConfiguracionCocinaDto actualizar(Integer ventanaRecallSegundos) {
        if (ventanaRecallSegundos == null
                || ventanaRecallSegundos < ConfiguracionCocina.VENTANA_RECALL_MINIMA
                || ventanaRecallSegundos > ConfiguracionCocina.VENTANA_RECALL_MAXIMA) {
            throw new IllegalArgumentException("La ventana para deshacer debe estar entre "
                    + ConfiguracionCocina.VENTANA_RECALL_MINIMA + " y " + ConfiguracionCocina.VENTANA_RECALL_MAXIMA + " segundos.");
        }
        ConfiguracionCocina configuracion = repository.findById(ConfiguracionCocina.ID_UNICO).orElseGet(ConfiguracionCocina::new);
        configuracion.setVentanaRecallSegundos(ventanaRecallSegundos);
        return new ConfiguracionCocinaDto(repository.save(configuracion).getVentanaRecallSegundos());
    }
}
