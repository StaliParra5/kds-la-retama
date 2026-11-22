package pe.isil.kds;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import pe.isil.kds.model.ConfiguracionCocina;
import pe.isil.kds.repository.ConfiguracionCocinaRepository;
import pe.isil.kds.service.ConfiguracionCocinaService;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/**
 * HU033 Escenario 4 (D41): ventana configurable para deshacer, entre 5 y 120 segundos.
 */
@ExtendWith(MockitoExtension.class)
class ConfiguracionCocinaServiceTest {

    @Mock
    private ConfiguracionCocinaRepository repository;

    @InjectMocks
    private ConfiguracionCocinaService service;

    @Test
    @DisplayName("Sin configuración guardada se usan 30 segundos")
    void porDefecto() {
        when(repository.findById(ConfiguracionCocina.ID_UNICO)).thenReturn(Optional.empty());

        assertEquals(30, service.ventanaRecallSegundos());
    }

    @Test
    @DisplayName("El administrador fija la ventana dentro del rango permitido")
    void actualizar() {
        when(repository.findById(ConfiguracionCocina.ID_UNICO)).thenReturn(Optional.of(new ConfiguracionCocina()));
        when(repository.save(any(ConfiguracionCocina.class))).thenAnswer(i -> i.getArgument(0));

        assertEquals(45, service.actualizar(45).getVentanaRecallSegundos());
        verify(repository).save(any(ConfiguracionCocina.class));
    }

    @Test
    @DisplayName("Fuera de 5 a 120 segundos se rechaza y no se guarda")
    void fueraDeRango() {
        for (Integer valor : new Integer[] {null, 0, 4, 121, -10}) {
            assertThrows(IllegalArgumentException.class, () -> service.actualizar(valor), String.valueOf(valor));
        }
        verify(repository, never()).save(any());
    }
}
