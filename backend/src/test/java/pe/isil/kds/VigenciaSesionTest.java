package pe.isil.kds;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import pe.isil.kds.model.Usuario;
import pe.isil.kds.repository.UsuarioRepository;
import pe.isil.kds.security.VigenciaSesion;

import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.Date;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class VigenciaSesionTest {

    @Mock
    private UsuarioRepository usuarioRepository;

    @InjectMocks
    private VigenciaSesion vigenciaSesion;

    private Usuario mozo;

    @BeforeEach
    void setUp() {
        mozo = new Usuario();
        mozo.setId(10L);
        mozo.setActivo(true);
    }

    private static Date haceMinutos(long minutos) {
        return Date.from(LocalDateTime.now().minusMinutes(minutos).atZone(ZoneId.systemDefault()).toInstant());
    }

    @Test
    @DisplayName("HU042: Un token de un usuario activo sin revocaciones sigue vigente")
    void usuarioActivo_Vigente() {
        when(usuarioRepository.findById(10L)).thenReturn(Optional.of(mozo));

        assertTrue(vigenciaSesion.vigente(10L, haceMinutos(30)));
    }

    @Test
    @DisplayName("HU042 Escenario 6: El token de un usuario desactivado deja de valer")
    void usuarioInactivo_NoVigente() {
        mozo.setActivo(false);
        when(usuarioRepository.findById(10L)).thenReturn(Optional.of(mozo));

        assertFalse(vigenciaSesion.vigente(10L, haceMinutos(1)));
    }

    @Test
    @DisplayName("HU042 Escenario 5: Un token emitido antes del cambio de PIN deja de valer; uno posterior sí vale")
    void tokenAnteriorALaRevocacion_NoVigente() {
        mozo.setSesionesValidasDesde(LocalDateTime.now().minusMinutes(10));
        when(usuarioRepository.findById(10L)).thenReturn(Optional.of(mozo));

        assertFalse(vigenciaSesion.vigente(10L, haceMinutos(20)));
        assertTrue(vigenciaSesion.vigente(10L, haceMinutos(5)));
    }

    @Test
    @DisplayName("HU042 Escenario 7: El token de un usuario eliminado deja de valer")
    void usuarioEliminado_NoVigente() {
        when(usuarioRepository.findById(10L)).thenReturn(Optional.empty());

        assertFalse(vigenciaSesion.vigente(10L, haceMinutos(1)));
        assertFalse(vigenciaSesion.vigente(null, haceMinutos(1)));
    }
}
