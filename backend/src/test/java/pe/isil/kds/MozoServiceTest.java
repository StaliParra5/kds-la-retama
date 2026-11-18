package pe.isil.kds;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import pe.isil.kds.dto.MozoDto;
import pe.isil.kds.exception.OperacionNoPermitidaException;
import pe.isil.kds.exception.RecursoNoEncontradoException;
import pe.isil.kds.model.Rol;
import pe.isil.kds.model.Usuario;
import pe.isil.kds.model.AtencionMesa;
import pe.isil.kds.model.Mesa;
import pe.isil.kds.repository.AtencionMesaRepository;
import pe.isil.kds.repository.PedidoRepository;
import pe.isil.kds.repository.RolRepository;
import pe.isil.kds.repository.TransicionEstadoRepository;
import pe.isil.kds.repository.UsuarioRepository;
import pe.isil.kds.repository.ZonaRepository;
import pe.isil.kds.model.Zona;
import pe.isil.kds.service.MozoService;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class MozoServiceTest {

    @Mock
    private UsuarioRepository usuarioRepository;

    @Mock
    private RolRepository rolRepository;

    @Mock
    private PedidoRepository pedidoRepository;

    @Mock
    private TransicionEstadoRepository transicionRepository;

    @Mock
    private ZonaRepository zonaRepository;

    @Mock
    private AtencionMesaRepository atencionRepository;

    // Costo bajo: el test verifica la regla, no la fortaleza del hash
    private final PasswordEncoder encoder = new BCryptPasswordEncoder(4);

    private MozoService mozoService;
    private Rol rolMozo;
    private Usuario angie;
    private Usuario cocinero;
    private Usuario admin;

    @BeforeEach
    void setUp() {
        mozoService = new MozoService(usuarioRepository, rolRepository, pedidoRepository, transicionRepository, encoder, zonaRepository,
                atencionRepository);
        rolMozo = rol(2L, "MOZO");
        angie = usuario(10L, "angie", rolMozo, "1234");
        cocinero = usuario(11L, "cocinero1", rol(3L, "COCINERO"), "5678");
        admin = usuario(1L, "admin", rol(1L, "ADMIN"), "1111");
    }

    @Test
    @DisplayName("HU042 Escenario 1: Se registra un mozo con usuario y PIN de 4 dígitos")
    void crear_MozoNuevo() {
        when(usuarioRepository.findByUsernameIgnoreCase("lucia")).thenReturn(Optional.empty());
        when(usuarioRepository.conPinSalvo(null)).thenReturn(List.of(angie, cocinero, admin));
        when(rolRepository.bloquearPorCodigo("MOZO")).thenReturn(Optional.of(rolMozo));
        when(usuarioRepository.save(any(Usuario.class))).thenAnswer(i -> {
            Usuario u = i.getArgument(0);
            u.setId(20L);
            return u;
        });

        MozoDto creado = mozoService.crear(" lucia ", "Lucía", "Torres", "4321");
        verify(rolRepository).bloquearPorCodigo("MOZO");

        assertEquals("lucia", creado.getUsername());
        assertTrue(creado.getActivo());
        verify(usuarioRepository).save(argThat(u -> encoder.matches("4321", u.getPinHash()) && u.getRol() == rolMozo));
    }

    @Test
    @DisplayName("HU042 Escenario 3: El PIN de un usuario de otro rol (incluido el admin) tampoco se repite")
    void crear_PinIgualAlDeOtroRol() {
        when(usuarioRepository.findByUsernameIgnoreCase("lucia")).thenReturn(Optional.empty());
        when(usuarioRepository.conPinSalvo(null)).thenReturn(List.of(admin));
        when(rolRepository.bloquearPorCodigo("MOZO")).thenReturn(Optional.of(rolMozo));

        assertThrows(IllegalArgumentException.class, () -> mozoService.crear("lucia", "Lucía", "Torres", "1111"));
        verify(usuarioRepository, never()).save(any());
    }

    @Test
    @DisplayName("HU042 Escenario 2: Un usuario existente (sin distinguir mayúsculas) es rechazado")
    void crear_UsuarioDuplicado() {
        when(usuarioRepository.findByUsernameIgnoreCase("ANGIE")).thenReturn(Optional.of(angie));

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class,
                () -> mozoService.crear("ANGIE", "Otra", "Persona", "4321"));
        assertTrue(ex.getMessage().contains("ya existe"));
        verify(usuarioRepository, never()).save(any());
    }

    @Test
    @DisplayName("HU042 Escenario 3: Un PIN en uso por otro usuario operativo se rechaza sin revelar a quién pertenece")
    void crear_PinEnUso() {
        when(usuarioRepository.findByUsernameIgnoreCase("lucia")).thenReturn(Optional.empty());
        when(usuarioRepository.conPinSalvo(null)).thenReturn(List.of(angie, cocinero));
        when(rolRepository.bloquearPorCodigo("MOZO")).thenReturn(Optional.of(rolMozo));

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class,
                () -> mozoService.crear("lucia", "Lucía", "Torres", "5678"));
        assertTrue(ex.getMessage().contains("en uso"));
        assertFalse(ex.getMessage().contains("cocinero1"));
        verify(usuarioRepository, never()).save(any());
    }

    @Test
    @DisplayName("HU042 Escenario 3: El PIN de un usuario inactivo tampoco se reutiliza (al reactivarlo quedaría compartido)")
    void crear_PinDeUsuarioInactivo() {
        cocinero.setActivo(false);
        when(usuarioRepository.findByUsernameIgnoreCase("lucia")).thenReturn(Optional.empty());
        when(usuarioRepository.conPinSalvo(null)).thenReturn(List.of(cocinero));
        when(rolRepository.bloquearPorCodigo("MOZO")).thenReturn(Optional.of(rolMozo));

        assertThrows(IllegalArgumentException.class, () -> mozoService.crear("lucia", "Lucía", "Torres", "5678"));
    }

    @Test
    @DisplayName("HU042 Escenario 4: Se editan el nombre y el apellido del mozo")
    void editar_Datos() {
        when(usuarioRepository.findById(10L)).thenReturn(Optional.of(angie));
        when(usuarioRepository.save(any(Usuario.class))).thenAnswer(i -> i.getArgument(0));

        MozoDto editado = mozoService.editar(10L, " Angélica ", "Valencia Ruiz");

        assertEquals("Angélica", editado.getNombre());
        assertEquals("Valencia Ruiz", editado.getApellido());
    }

    @Test
    @DisplayName("HU042 Escenario 5: El PIN nuevo reemplaza al anterior")
    void cambiarPin_ReemplazaElAnterior() {
        when(usuarioRepository.findById(10L)).thenReturn(Optional.of(angie));
        when(usuarioRepository.conPinSalvo(10L)).thenReturn(List.of(cocinero));
        when(rolRepository.bloquearPorCodigo("MOZO")).thenReturn(Optional.of(rolMozo));
        when(usuarioRepository.save(any(Usuario.class))).thenAnswer(i -> i.getArgument(0));

        mozoService.cambiarPin(10L, "2468");

        assertTrue(encoder.matches("2468", angie.getPinHash()));
        assertFalse(encoder.matches("1234", angie.getPinHash()));
    }

    @Test
    @DisplayName("HU042 Escenario 5: Reasignar su mismo PIN no cuenta como PIN en uso")
    void cambiarPin_MismoPin() {
        when(usuarioRepository.findById(10L)).thenReturn(Optional.of(angie));
        when(usuarioRepository.conPinSalvo(10L)).thenReturn(List.of(cocinero));
        when(rolRepository.bloquearPorCodigo("MOZO")).thenReturn(Optional.of(rolMozo));
        when(usuarioRepository.save(any(Usuario.class))).thenAnswer(i -> i.getArgument(0));

        assertDoesNotThrow(() -> mozoService.cambiarPin(10L, "1234"));
    }

    @Test
    @DisplayName("HU042 Escenario 6: Se desactiva y se reactiva un mozo")
    void cambiarEstado_DesactivaYReactiva() {
        when(usuarioRepository.findById(10L)).thenReturn(Optional.of(angie));
        when(usuarioRepository.save(any(Usuario.class))).thenAnswer(i -> i.getArgument(0));

        assertFalse(mozoService.cambiarEstado(10L, false).getActivo());
        assertTrue(mozoService.cambiarEstado(10L, true).getActivo());
    }

    @Test
    @DisplayName("HU042 Escenario 7: Un mozo sin pedidos se elimina")
    void eliminar_SinHistorial() {
        when(usuarioRepository.findById(10L)).thenReturn(Optional.of(angie));
        when(pedidoRepository.existsByUsuarioId(10L)).thenReturn(false);
        when(transicionRepository.existsByUsuarioId(10L)).thenReturn(false);

        mozoService.eliminar(10L);

        verify(usuarioRepository).delete(angie);
    }

    @Test
    @DisplayName("HU042 Escenario 7: Un mozo que abrió mesas sin registrar pedidos se elimina junto con esas mesas vacías")
    void eliminar_AtencionesSinPedidos() {
        when(usuarioRepository.findById(10L)).thenReturn(Optional.of(angie));
        when(pedidoRepository.existsEnAtencionesDelMozo(10L)).thenReturn(false);
        when(atencionRepository.findByMozoIdAndLiberadaEnIsNull(10L)).thenReturn(List.of());

        mozoService.eliminar(10L);

        var orden = inOrder(atencionRepository, usuarioRepository);
        orden.verify(atencionRepository).olvidarLiberacionesDelMozo(10L);
        orden.verify(atencionRepository).eliminarLiberadasDelMozo(10L);
        orden.verify(usuarioRepository).delete(angie);
    }

    @Test
    @DisplayName("HU042 Escenario 8: Un mozo cuyas mesas tienen pedidos (de otro mozo) no se elimina")
    void eliminar_PedidosEnSusMesas() {
        when(usuarioRepository.findById(10L)).thenReturn(Optional.of(angie));
        when(pedidoRepository.existsEnAtencionesDelMozo(10L)).thenReturn(true);

        assertThrows(OperacionNoPermitidaException.class, () -> mozoService.eliminar(10L));
        verify(atencionRepository, never()).eliminarLiberadasDelMozo(anyLong());
        verify(usuarioRepository, never()).delete(any());
    }

    @Test
    @DisplayName("HU042: Un mozo con una mesa abierta no se elimina hasta liberarla")
    void eliminar_MesaAbierta() {
        Mesa mesa = new Mesa();
        mesa.setNumeroMesa("07");
        AtencionMesa abierta = new AtencionMesa();
        abierta.setMesa(mesa);
        abierta.setMozo(angie);
        when(usuarioRepository.findById(10L)).thenReturn(Optional.of(angie));
        when(atencionRepository.findByMozoIdAndLiberadaEnIsNull(10L)).thenReturn(List.of(abierta));

        OperacionNoPermitidaException ex = assertThrows(OperacionNoPermitidaException.class, () -> mozoService.eliminar(10L));
        assertTrue(ex.getMessage().contains("mesa 07"));
        assertEquals(MozoService.CODIGO_MESA_ABIERTA, ex.getCodigo());
        verify(usuarioRepository, never()).delete(any());
    }

    @Test
    @DisplayName("HU042 Escenario 8: Un mozo con pedidos no se elimina y se ofrece desactivarlo")
    void eliminar_ConHistorial() {
        when(usuarioRepository.findById(10L)).thenReturn(Optional.of(angie));
        when(pedidoRepository.existsByUsuarioId(10L)).thenReturn(true);

        OperacionNoPermitidaException ex = assertThrows(OperacionNoPermitidaException.class, () -> mozoService.eliminar(10L));
        assertEquals(MozoService.CODIGO_CON_HISTORIAL, ex.getCodigo());
        assertTrue(ex.getMessage().contains("desactivarlo"));
        verify(usuarioRepository, never()).delete(any());
    }

    @Test
    @DisplayName("HU042 Escenario 8: Las transiciones registradas también cuentan como historial")
    void eliminar_ConTransiciones() {
        when(usuarioRepository.findById(10L)).thenReturn(Optional.of(angie));
        when(pedidoRepository.existsByUsuarioId(10L)).thenReturn(false);
        when(transicionRepository.existsByUsuarioId(10L)).thenReturn(true);

        assertThrows(OperacionNoPermitidaException.class, () -> mozoService.eliminar(10L));
        verify(usuarioRepository, never()).delete(any());
    }

    @Test
    @DisplayName("HU042: La gestión de mozos no opera sobre otros roles")
    void soloMozos() {
        when(usuarioRepository.findById(11L)).thenReturn(Optional.of(cocinero));

        assertThrows(RecursoNoEncontradoException.class, () -> mozoService.eliminar(11L));
        assertThrows(RecursoNoEncontradoException.class, () -> mozoService.cambiarEstado(11L, false));
        verify(pedidoRepository, never()).existsByUsuarioId(anyLong());
    }

    @Test
    @DisplayName("HU042 Escenario 5: Cambiar el PIN revoca las sesiones abiertas")
    void cambiarPin_RevocaSesiones() {
        when(usuarioRepository.findById(10L)).thenReturn(Optional.of(angie));
        when(usuarioRepository.conPinSalvo(10L)).thenReturn(List.of());
        when(rolRepository.bloquearPorCodigo("MOZO")).thenReturn(Optional.of(rolMozo));
        when(usuarioRepository.save(any(Usuario.class))).thenAnswer(i -> i.getArgument(0));

        mozoService.cambiarPin(10L, "2468");

        assertEquals(1, angie.getVersionSesion());
    }

    @Test
    @DisplayName("HU042 Escenario 6: Desactivar revoca las sesiones abiertas; reactivar no las revoca")
    void desactivar_RevocaSesiones() {
        when(usuarioRepository.findById(10L)).thenReturn(Optional.of(angie));
        when(usuarioRepository.save(any(Usuario.class))).thenAnswer(i -> i.getArgument(0));

        mozoService.cambiarEstado(10L, true);
        assertEquals(0, angie.getVersionSesion());
        mozoService.cambiarEstado(10L, false);
        assertEquals(1, angie.getVersionSesion());
    }

    @Test
    @DisplayName("HU042 Escenario 8: Un pedido registrado durante el borrado se informa como historial")
    void eliminar_PedidoSimultaneo() {
        when(usuarioRepository.findById(10L)).thenReturn(Optional.of(angie));
        doThrow(new org.springframework.dao.DataIntegrityViolationException("fk")).when(usuarioRepository).flush();

        OperacionNoPermitidaException ex = assertThrows(OperacionNoPermitidaException.class, () -> mozoService.eliminar(10L));
        assertEquals(MozoService.CODIGO_CON_HISTORIAL, ex.getCodigo());
    }

    @Test
    @DisplayName("HU042: El listado marca el historial con dos consultas para todos los mozos")
    void listar_HistorialEnLote() {
        Usuario pedro = usuario(12L, "pedro", rolMozo, "2222");
        when(usuarioRepository.findByRolCodigoOrderByApellidoAscNombreAsc("MOZO")).thenReturn(List.of(angie, pedro));
        when(pedidoRepository.idsUsuariosConPedidos(List.of(10L, 12L))).thenReturn(List.of(10L));
        when(transicionRepository.idsUsuariosConTransiciones(List.of(10L, 12L))).thenReturn(List.of());

        List<MozoDto> mozos = mozoService.listar();

        assertTrue(mozos.get(0).isTieneHistorial());
        assertFalse(mozos.get(1).isTieneHistorial());
        verify(pedidoRepository, never()).existsByUsuarioId(anyLong());
    }

    // --- HU043: zonas del mozo

    @Test
    @DisplayName("HU043 Escenario 1: Se asignan una o varias zonas activas al mozo")
    void asignarZonas_Activas() {
        Zona terraza = zona(2L, "Terraza", true);
        Zona barra = zona(3L, "Barra", true);
        when(usuarioRepository.findById(10L)).thenReturn(Optional.of(angie));
        when(zonaRepository.findAllById(java.util.Set.of(2L, 3L))).thenReturn(List.of(terraza, barra));
        when(usuarioRepository.save(any(Usuario.class))).thenAnswer(i -> i.getArgument(0));

        MozoDto dto = mozoService.asignarZonas(10L, List.of(2L, 3L));

        assertEquals(List.of("Barra", "Terraza"), dto.getZonas().stream().map(z -> z.nombre()).toList());
    }

    @Test
    @DisplayName("HU043 Escenario 5: Quitar zonas reemplaza la asignación; una lista vacía deja al mozo sin zonas")
    void asignarZonas_Reemplaza() {
        angie.getZonas().add(zona(2L, "Terraza", true));
        when(usuarioRepository.findById(10L)).thenReturn(Optional.of(angie));
        when(zonaRepository.findAllById(java.util.Set.of())).thenReturn(List.of());
        when(usuarioRepository.save(any(Usuario.class))).thenAnswer(i -> i.getArgument(0));

        assertTrue(mozoService.asignarZonas(10L, List.of()).getZonas().isEmpty());
        assertTrue(angie.getZonas().isEmpty());
    }

    @Test
    @DisplayName("HU043 Escenario 1: No se asignan zonas inactivas ni inexistentes")
    void asignarZonas_InactivaOInexistente() {
        when(usuarioRepository.findById(10L)).thenReturn(Optional.of(angie));
        when(zonaRepository.findAllById(java.util.Set.of(4L))).thenReturn(List.of(zona(4L, "Rooftop", false)));
        when(zonaRepository.findAllById(java.util.Set.of(99L))).thenReturn(List.of());

        assertThrows(IllegalArgumentException.class, () -> mozoService.asignarZonas(10L, List.of(4L)));
        assertThrows(IllegalArgumentException.class, () -> mozoService.asignarZonas(10L, List.of(99L)));
        verify(usuarioRepository, never()).save(any());
    }

    @Test
    @DisplayName("HU043 Escenario 1: Una zona inactiva que el mozo ya tenía se conserva; un valor nulo se rechaza")
    void asignarZonas_ConservaInactivaYRechazaNulo() {
        Zona rooftop = zona(4L, "Rooftop", false);
        angie.getZonas().add(rooftop);
        when(usuarioRepository.findById(10L)).thenReturn(Optional.of(angie));
        when(zonaRepository.findAllById(java.util.Set.of(4L))).thenReturn(List.of(rooftop));
        when(usuarioRepository.save(any(Usuario.class))).thenAnswer(i -> i.getArgument(0));

        assertEquals(1, mozoService.asignarZonas(10L, List.of(4L)).getZonas().size());
        assertThrows(IllegalArgumentException.class, () -> mozoService.asignarZonas(10L, java.util.Arrays.asList(4L, null)));
    }

    @Test
    @DisplayName("HU043 Escenarios 2 y 4: Las zonas que opera el mozo son solo las activas asignadas (vacío si no tiene)")
    void idsZonasActivasDe() {
        angie.getZonas().add(zona(2L, "Terraza", true));
        angie.getZonas().add(zona(4L, "Rooftop", false));
        when(usuarioRepository.findByUsernameIgnoreCase("angie")).thenReturn(Optional.of(angie));
        when(usuarioRepository.findByUsernameIgnoreCase("nadie")).thenReturn(Optional.empty());

        assertEquals(java.util.Set.of(2L), mozoService.idsZonasActivasDe("angie"));
        assertTrue(mozoService.idsZonasActivasDe("nadie").isEmpty());
    }

    private static Zona zona(Long id, String nombre, boolean activo) {
        Zona z = new Zona();
        z.setId(id);
        z.setNombre(nombre);
        z.setActivo(activo);
        return z;
    }

    private Usuario usuario(Long id, String username, Rol rol, String pin) {
        Usuario u = new Usuario();
        u.setId(id);
        u.setUsername(username);
        u.setNombre(username);
        u.setApellido("Prueba");
        u.setRol(rol);
        u.setActivo(true);
        u.setPinHash(encoder.encode(pin));
        return u;
    }

    private static Rol rol(Long id, String codigo) {
        Rol r = new Rol();
        r.setId(id);
        r.setCodigo(codigo);
        return r;
    }
}
