package pe.isil.kds.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;

/**
 * Habilita las tareas programadas (HU018: comprobación periódica de la salida a internet del servidor).
 */
@Configuration
@EnableScheduling
public class ProgramacionConfig {
}
