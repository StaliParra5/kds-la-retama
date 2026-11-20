package pe.isil.kds;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import pe.isil.kds.exception.AutorizacionAdminException;
import pe.isil.kds.model.Rol;
import pe.isil.kds.model.Usuario;
import pe.isil.kds.repository.UsuarioRepository;
import pe.isil.kds.service.CuentaService;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/**
 * HU049 (D36): clave de autorización del administrador.
 */
@ExtendWith(MockitoExtension.class)
class CuentaServiceTest {

    // Costo mínimo solo para que las pruebas sean rápidas; producción usa costo 12
    private static final BCryptPasswordEncoder ENCODER = new BCryptPasswordEncoder(4);

    @Mock
    private UsuarioRepository usuarioRepository;

    private CuentaService service;
    private Usuario admin;

    @BeforeEach
    void setUp() {
        service = new CuentaService(usuarioRepository, ENCODER);
        admin = new Usuario();
        admin.setId(1L);
        admin.setUsername("admin");
        admin.setRol(new Rol(1L, "ADMIN", "Administrador", null));
        admin.setActivo(true);
        admin.setPasswordHash(ENCODER.encode("admin123"));
        lenient().when(usuarioRepository.findByUsername("admin")).thenReturn(Optional.of(admin));
    }

    @Test
    @DisplayName("Sin clave configurada el estado lo indica; al crearla con la contraseña correcta se guarda solo su hash")
    void crearClave() {
        assertFalse(service.estadoClaveAutorizacion("admin").configurada());

        assertTrue(service.configurarClaveAutorizacion("admin", "admin123", "246810").configurada());

        assertNotNull(admin.getClaveAutorizacionHash());
        assertNotEquals("246810", admin.getClaveAutorizacionHash());
        assertTrue(ENCODER.matches("246810", admin.getClaveAutorizacionHash()));
        assertTrue(service.estadoClaveAutorizacion("admin").configurada());
        verify(usuarioRepository).save(admin);
    }

    @Test
    @DisplayName("Si se olvida, se vuelve a crear con la contraseña de la cuenta y la anterior deja de servir")
    void cambiarClaveOlvidada() {
        service.configurarClaveAutorizacion("admin", "admin123", "246810");

        service.configurarClaveAutorizacion("admin", "admin123", "135790");

        assertTrue(ENCODER.matches("135790", admin.getClaveAutorizacionHash()));
        assertFalse(ENCODER.matches("246810", admin.getClaveAutorizacionHash()));
    }

    @Test
    @DisplayName("Con la contraseña de la cuenta incorrecta no se cambia y responde 403 con código, sin cerrar la sesión")
    void contrasenaIncorrecta() {
        AutorizacionAdminException ex = assertThrows(AutorizacionAdminException.class,
                () -> service.configurarClaveAutorizacion("admin", "otra", "246810"));

        assertEquals(AutorizacionAdminException.INVALIDA, ex.getCodigo());
        assertNull(admin.getClaveAutorizacionHash());
        verify(usuarioRepository, never()).save(any());
    }

    @Test
    @DisplayName("La clave debe tener exactamente 6 dígitos y no ser igual a la contraseña")
    void formato() {
        for (String clave : new String[] {null, "", "12345", "1234567", "12a456", "abcdef"}) {
            assertThrows(IllegalArgumentException.class,
                    () -> service.configurarClaveAutorizacion("admin", "admin123", clave), String.valueOf(clave));
        }
        admin.setPasswordHash(ENCODER.encode("123456"));
        assertThrows(IllegalArgumentException.class, () -> service.configurarClaveAutorizacion("admin", "123456", "123456"));
        verify(usuarioRepository, never()).save(any());
    }

    @Test
    @DisplayName("Solo los administradores tienen clave de autorización")
    void soloAdministradores() {
        Usuario mozo = new Usuario();
        mozo.setUsername("angie");
        mozo.setRol(new Rol(2L, "MOZO", "Mozo", null));
        when(usuarioRepository.findByUsername("angie")).thenReturn(Optional.of(mozo));

        assertThrows(IllegalArgumentException.class, () -> service.estadoClaveAutorizacion("angie"));
        assertThrows(IllegalArgumentException.class, () -> service.configurarClaveAutorizacion("angie", "x", "246810"));
    }
}
