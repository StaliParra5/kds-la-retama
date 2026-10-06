package pe.isil.kds;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.crypto.password.PasswordEncoder;
import pe.isil.kds.dto.AuthRequest;
import pe.isil.kds.dto.AuthResponse;
import pe.isil.kds.dto.PinAuthRequest;
import pe.isil.kds.model.Estacion;
import pe.isil.kds.model.Rol;
import pe.isil.kds.model.Usuario;
import pe.isil.kds.repository.EstacionRepository;
import pe.isil.kds.repository.UsuarioRepository;
import pe.isil.kds.security.JwtTokenProvider;
import pe.isil.kds.service.AuthService;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AuthServiceTest {

    @Mock
    private UsuarioRepository usuarioRepository;

    @Mock
    private EstacionRepository estacionRepository;

    @Mock
    private PasswordEncoder passwordEncoder;

    @Mock
    private JwtTokenProvider tokenProvider;

    @InjectMocks
    private AuthService authService;

    private Usuario adminUser;
    private Usuario cocineroUser;
    private Estacion estacionPlancha;

    @BeforeEach
    void setUp() {
        Rol rolAdmin = new Rol(1L, "ADMIN", "Administrador", "Acceso total");
        adminUser = new Usuario();
        adminUser.setId(1L);
        adminUser.setUsername("admin");
        adminUser.setPasswordHash("hashedPass");
        adminUser.setNombre("Admin");
        adminUser.setApellido("Sistema");
        adminUser.setRol(rolAdmin);
        adminUser.setActivo(true);

        Rol rolCocinero = new Rol(2L, "COCINERO", "Cocinero", "Estación cocina");
        cocineroUser = new Usuario();
        cocineroUser.setId(2L);
        cocineroUser.setUsername("cocinero1");
        cocineroUser.setPinHash("hashedPin");
        cocineroUser.setNombre("Carlos");
        cocineroUser.setApellido("Castilla");
        cocineroUser.setRol(rolCocinero);
        cocineroUser.setActivo(true);

        estacionPlancha = new Estacion();
        estacionPlancha.setId(10L);
        estacionPlancha.setCodigo("PLANCHA");
        estacionPlancha.setNombre("Plancha");
    }

    @Test
    @DisplayName("HU001 Escenario 2: Login administrativo exitoso con usuario y contraseña")
    void loginAdmin_Exitoso() {
        when(usuarioRepository.findByUsername("admin")).thenReturn(Optional.of(adminUser));
        when(passwordEncoder.matches("admin123", "hashedPass")).thenReturn(true);
        when(tokenProvider.generateToken(1L, "admin", "ADMIN")).thenReturn("fake-jwt-token");

        AuthResponse response = authService.loginAdmin(new AuthRequest("admin", "admin123"));

        assertNotNull(response);
        assertEquals("fake-jwt-token", response.getToken());
        assertEquals("ADMIN", response.getRol());
    }

    @Test
    @DisplayName("HU001 Escenario 2: Login administrativo con clave incorrecta es rechazado")
    void loginAdmin_ClaveInvalida_LanzaExcepcion() {
        when(usuarioRepository.findByUsername("admin")).thenReturn(Optional.of(adminUser));
        when(passwordEncoder.matches("claveMala", "hashedPass")).thenReturn(false);

        assertThrows(BadCredentialsException.class, () ->
                authService.loginAdmin(new AuthRequest("admin", "claveMala")));
    }

    @Test
    @DisplayName("HU001 Escenario 1: Ingreso con PIN de 4 dígitos en cocina exitoso")
    void loginPin_Cocinero_Exitoso() {
        when(usuarioRepository.findByActivoTrue()).thenReturn(List.of(cocineroUser));
        when(passwordEncoder.matches("1234", "hashedPin")).thenReturn(true);
        when(estacionRepository.findById(10L)).thenReturn(Optional.of(estacionPlancha));
        when(tokenProvider.generateToken(2L, "cocinero1", "COCINERO")).thenReturn("cocina-jwt-token");

        AuthResponse response = authService.loginPin(new PinAuthRequest("1234", 10L));

        assertNotNull(response);
        assertEquals("cocina-jwt-token", response.getToken());
        assertEquals("COCINERO", response.getRol());
        assertEquals(10L, response.getEstacionId());
        assertEquals("Plancha", response.getEstacionNombre());
    }

    @Test
    @DisplayName("HU001 Escenario 2: PIN numérico rechaza perfiles con rol ADMIN")
    void loginPin_AdminIntentaAccederSoloConPin_EsRechazado() {
        adminUser.setPinHash("hashedPinAdmin");
        when(usuarioRepository.findByActivoTrue()).thenReturn(List.of(adminUser));
        when(passwordEncoder.matches("1234", "hashedPinAdmin")).thenReturn(true);

        assertThrows(BadCredentialsException.class, () ->
                authService.loginPin(new PinAuthRequest("1234", null)));
    }
}
