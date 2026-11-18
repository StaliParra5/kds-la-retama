package pe.isil.kds;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import pe.isil.kds.dto.UsuarioDto;
import pe.isil.kds.model.Rol;
import pe.isil.kds.model.Usuario;
import pe.isil.kds.repository.RolRepository;
import pe.isil.kds.repository.UsuarioRepository;
import pe.isil.kds.service.UsuarioService;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class UsuarioServiceTest {

    @Mock
    private UsuarioRepository usuarioRepository;

    @Mock
    private RolRepository rolRepository;

    @InjectMocks
    private UsuarioService usuarioService;

    private Usuario usuarioMozo;
    private Rol rolMozo;
    private Rol rolExpedidor;

    @BeforeEach
    void setUp() {
        rolMozo = new Rol(2L, "MOZO", "Mozo", "Atención en sala");
        rolExpedidor = new Rol(4L, "EXPEDIDOR", "Expedidor", "Control de pase y despacho");

        usuarioMozo = new Usuario();
        usuarioMozo.setId(5L);
        usuarioMozo.setUsername("angie");
        usuarioMozo.setNombre("Angie");
        usuarioMozo.setApellido("Valencia");
        usuarioMozo.setRol(rolMozo);
        usuarioMozo.setPasswordHash("hash123");
        usuarioMozo.setPinHash("pinHash123");
        usuarioMozo.setActivo(true);
        usuarioMozo.setCreatedAt(LocalDateTime.now());
    }

    @Test
    @DisplayName("HU002: Listar usuarios sanitiza datos y expone estado de PIN sin hashes")
    void listarUsuarios_Sanitizado() {
        when(usuarioRepository.findAll()).thenReturn(List.of(usuarioMozo));

        List<UsuarioDto> dtos = usuarioService.listarUsuarios();

        assertNotNull(dtos);
        assertEquals(1, dtos.size());
        UsuarioDto dto = dtos.get(0);
        assertEquals("angie", dto.getUsername());
        assertEquals("MOZO", dto.getRolCodigo());
        assertTrue(dto.getTienePin());
        assertTrue(dto.getActivo());
    }

    @Test
    @DisplayName("HU002 Escenario 2: Asignación de nuevo rol a usuario existente")
    void actualizarRolUsuario_Exitoso() {
        when(usuarioRepository.findById(5L)).thenReturn(Optional.of(usuarioMozo));
        when(rolRepository.findByCodigo("EXPEDIDOR")).thenReturn(Optional.of(rolExpedidor));
        when(usuarioRepository.save(any(Usuario.class))).thenAnswer(invocation -> invocation.getArgument(0));

        UsuarioDto resultado = usuarioService.actualizarRolUsuario(5L, "EXPEDIDOR");

        assertNotNull(resultado);
        assertEquals("EXPEDIDOR", resultado.getRolCodigo());
        assertEquals("Expedidor", resultado.getRolNombre());
        verify(usuarioRepository, times(1)).save(usuarioMozo);
    }

    @Test
    @DisplayName("HU002 Escenario 2: Error al actualizar con rol inexistente")
    void actualizarRolUsuario_RolInvalido_LanzaExcepcion() {
        when(usuarioRepository.findById(5L)).thenReturn(Optional.of(usuarioMozo));
        when(rolRepository.findByCodigo("SUPERVISOR_INEXISTENTE")).thenReturn(Optional.empty());

        assertThrows(IllegalArgumentException.class, () ->
                usuarioService.actualizarRolUsuario(5L, "SUPERVISOR_INEXISTENTE"));

        verify(usuarioRepository, never()).save(any());
    }
}
