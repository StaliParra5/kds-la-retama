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

    @Test
    @DisplayName("HU042: Un token con la versión de sesión actual de un usuario activo sigue vigente")
    void versionActual_Vigente() {
        when(usuarioRepository.findById(10L)).thenReturn(Optional.of(mozo));

        assertTrue(vigenciaSesion.vigente(10L, 0));
    }

    @Test
    @DisplayName("HU042 Escenario 6: El token de un usuario desactivado deja de valer")
    void usuarioInactivo_NoVigente() {
        mozo.setActivo(false);
        when(usuarioRepository.findById(10L)).thenReturn(Optional.of(mozo));

        assertFalse(vigenciaSesion.vigente(10L, 0));
    }

    @Test
    @DisplayName("HU042 Escenario 5: Tras revocar, el token anterior deja de valer y el nuevo sí vale, aunque se emitan en el mismo segundo")
    void revocacion_InvalidaVersionAnterior() {
        when(usuarioRepository.findById(10L)).thenReturn(Optional.of(mozo));

        mozo.revocarSesiones();

        assertFalse(vigenciaSesion.vigente(10L, 0));
        assertTrue(vigenciaSesion.vigente(10L, 1));
    }

    @Test
    @DisplayName("HU042 Escenario 7: El token de un usuario eliminado deja de valer")
    void usuarioEliminado_NoVigente() {
        when(usuarioRepository.findById(10L)).thenReturn(Optional.empty());

        assertFalse(vigenciaSesion.vigente(10L, 0));
        assertFalse(vigenciaSesion.vigente(null, 0));
    }
}
