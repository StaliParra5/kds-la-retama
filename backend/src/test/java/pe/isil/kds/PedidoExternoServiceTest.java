package pe.isil.kds;

import jakarta.validation.Validation;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import pe.isil.kds.dto.CrearPedidoRequest;
import pe.isil.kds.dto.PedidoExternoRequest;
import pe.isil.kds.dto.PedidoExternoResponse;
import pe.isil.kds.dto.PedidoResponse;
import pe.isil.kds.model.CanalVenta;
import pe.isil.kds.model.Plato;
import pe.isil.kds.repository.CanalVentaRepository;
import pe.isil.kds.repository.PlatoRepository;
import pe.isil.kds.service.PedidoExternoService;
import pe.isil.kds.service.PedidoService;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

/**
 * HU019: el punto de integración valida el payload, resuelve canal y platos y reutiliza el registro del comandero.
 */
@ExtendWith(MockitoExtension.class)
class PedidoExternoServiceTest {

    @Mock
    private CanalVentaRepository canalRepository;
    @Mock
    private PlatoRepository platoRepository;
    @Mock
    private PedidoService pedidoService;

    private PedidoExternoService service;

    @BeforeEach
    void setUp() {
        // Validador real: las reglas del payload viven en sus anotaciones y se prueban tal como se usan
        service = new PedidoExternoService(canalRepository, platoRepository, pedidoService,
                Validation.buildDefaultValidatorFactory().getValidator());

        CanalVenta rappi = canal(5L, "RAPPI", true);
        lenient().when(canalRepository.findByCodigo("RAPPI")).thenReturn(Optional.of(rappi));
        lenient().when(canalRepository.findByCodigo("SALON")).thenReturn(Optional.of(canal(1L, "SALON", true)));
        lenient().when(canalRepository.findByCodigo("INACTIVO")).thenReturn(Optional.of(canal(9L, "INACTIVO", false)));
        lenient().when(platoRepository.findById(7L)).thenReturn(Optional.of(plato(7L)));
        lenient().when(platoRepository.findById(12L)).thenReturn(Optional.of(plato(12L)));

        PedidoResponse respuesta = new PedidoResponse();
        respuesta.setId(123L);
        respuesta.setCodigoCorrelativo("CMD-261113-0042");
        respuesta.setNumeroOrdenExterno("RP-48213");
        respuesta.setEstado("ENVIADO");
        lenient().when(pedidoService.registrarComanda(any(CrearPedidoRequest.class), anyString(), anyBoolean()))
                .thenReturn(new PedidoService.ResultadoEnvio(respuesta, true));
    }

    @Test
    @DisplayName("HU019 Escenario 1: Un payload válido devuelve el identificador interno del pedido y se registra como externo")
    void payloadValido_DevuelveElIdentificadorInterno() {
        PedidoExternoService.Resultado resultado = service.registrar(payloadValido());
        PedidoExternoResponse respuesta = resultado.respuesta();
        assertTrue(resultado.creado());

        assertEquals(123L, respuesta.pedidoId());
        assertEquals("CMD-261113-0042", respuesta.codigoPedido());
        assertEquals("RAPPI", respuesta.canal());
        assertEquals("RP-48213", respuesta.numeroOrden());
        assertEquals("ENVIADO", respuesta.estado());

        ArgumentCaptor<CrearPedidoRequest> captor = ArgumentCaptor.forClass(CrearPedidoRequest.class);
        // A nombre de la cuenta de servicio, marcado como externo
        verify(pedidoService).registrarComanda(captor.capture(), eq("integracion"), eq(true));
        CrearPedidoRequest enviado = captor.getValue();
        assertEquals(5L, enviado.getCanalId());
        assertEquals("RP-48213", enviado.getNumeroOrdenExterno());
        assertEquals("Ana Torres", enviado.getClienteNombre());
        assertEquals("987654321", enviado.getClienteTelefono());
        assertEquals("Av. Brasil 123", enviado.getClienteDireccion());
        assertEquals("Tocar el timbre", enviado.getObservaciones());
        assertEquals(2, enviado.getItems().size());
        assertEquals(7L, enviado.getItems().get(0).getPlatoId());
        assertEquals(2, enviado.getItems().get(0).getCantidad());
        assertEquals("Sin cebolla, Término medio", enviado.getItems().get(0).getModificadores());
        assertEquals(12L, enviado.getItems().get(1).getPlatoId());
        assertNull(enviado.getItems().get(1).getModificadores());
    }

    @Test
    @DisplayName("HU019: El código de canal y el de plato se aceptan sin importar mayúsculas ni espacios")
    void codigos_SinImportarMayusculas() {
        PedidoExternoRequest request = payloadValido();
        request.setCanal("  rappi ");
        request.getItems().get(0).setCodigoPlato(" plt-007 ");

        assertEquals(123L, service.registrar(request).respuesta().pedidoId());
    }

    @Test
    @DisplayName("HU019 Escenario 2: Un payload incompleto se rechaza nombrando todos los campos con problema, sin registrar nada")
    void payloadIncompleto_ListaTodosLosErrores() {
        PedidoExternoRequest request = new PedidoExternoRequest();
        request.setItems(new ArrayList<>());

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class, () -> service.registrar(request));

        assertTrue(ex.getMessage().startsWith("Payload inválido"));
        assertTrue(ex.getMessage().contains("'canal'"), ex.getMessage());
        assertTrue(ex.getMessage().contains("'numeroOrden'"), ex.getMessage());
        assertTrue(ex.getMessage().contains("'items'"), ex.getMessage());
        verifyNoInteractions(pedidoService);
    }

    @Test
    @DisplayName("HU019 Escenario 2: Un ítem sin código, con cantidad fuera de rango o con modificadores con coma se rechaza")
    void itemInvalido_SeRechaza() {
        PedidoExternoRequest sinCodigo = payloadValido();
        sinCodigo.getItems().get(0).setCodigoPlato(" ");
        sinCodigo.getItems().get(1).setCantidad(null);
        IllegalArgumentException ex1 = assertThrows(IllegalArgumentException.class, () -> service.registrar(sinCodigo));
        assertTrue(ex1.getMessage().contains("'codigoPlato'") && ex1.getMessage().contains("'cantidad'"), ex1.getMessage());

        for (int cantidad : new int[] {0, 51}) {
            PedidoExternoRequest fueraDeRango = payloadValido();
            fueraDeRango.getItems().get(0).setCantidad(cantidad);
            assertThrows(IllegalArgumentException.class, () -> service.registrar(fueraDeRango), String.valueOf(cantidad));
        }

        PedidoExternoRequest conComa = payloadValido();
        conComa.getItems().get(0).setModificadores(List.of("Sin cebolla, sin ají"));
        IllegalArgumentException ex2 = assertThrows(IllegalArgumentException.class, () -> service.registrar(conComa));
        assertTrue(ex2.getMessage().contains("comas"), ex2.getMessage());
        verifyNoInteractions(pedidoService);
    }

    @Test
    @DisplayName("HU019: Sin cuerpo en la solicitud se rechaza con un mensaje claro")
    void sinCuerpo_SeRechaza() {
        assertThrows(IllegalArgumentException.class, () -> service.registrar(null));
        verifyNoInteractions(pedidoService);
    }

    @Test
    @DisplayName("HU019 Escenario 3: Un canal inexistente o inactivo se rechaza indicando el canal inválido")
    void canalInvalido_SeRechazaIndicandoElCanal() {
        for (String codigo : List.of("XYZ", "INACTIVO")) {
            PedidoExternoRequest request = payloadValido();
            request.setCanal(codigo);

            IllegalArgumentException ex = assertThrows(IllegalArgumentException.class, () -> service.registrar(request), codigo);

            assertTrue(ex.getMessage().contains("'" + codigo + "'"), ex.getMessage());
            assertTrue(ex.getMessage().contains("no existe o no está activo"), ex.getMessage());
        }
        verifyNoInteractions(pedidoService);
    }

    @Test
    @DisplayName("HU019 Escenario 3: Salón no admite pedidos externos porque exige mesa y atención abierta")
    void salon_NoEsUnCanalExterno() {
        PedidoExternoRequest request = payloadValido();
        request.setCanal("SALON");

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class, () -> service.registrar(request));

        assertTrue(ex.getMessage().contains("no admite pedidos externos"));
        verifyNoInteractions(pedidoService);
    }

    @Test
    @DisplayName("HU019 Escenario 4: Un código de plato que no existe se rechaza indicando qué ítem no se reconoce")
    void platoDesconocido_IndicaElItem() {
        PedidoExternoRequest request = payloadValido();
        request.getItems().get(1).setCodigoPlato("PLT-999");
        when(platoRepository.findById(999L)).thenReturn(Optional.empty());

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class, () -> service.registrar(request));

        assertTrue(ex.getMessage().contains("Ítem 2"), ex.getMessage());
        assertTrue(ex.getMessage().contains("PLT-999"), ex.getMessage());
        assertTrue(ex.getMessage().contains("no existe en el catálogo"), ex.getMessage());
        verifyNoInteractions(pedidoService);
    }

    @Test
    @DisplayName("HU019 Escenario 4: Un código de plato con formato inválido se rechaza indicando el formato esperado")
    void platoConFormatoInvalido_IndicaElFormato() {
        PedidoExternoRequest request = payloadValido();
        request.getItems().get(0).setCodigoPlato("LOMO");

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class, () -> service.registrar(request));

        assertTrue(ex.getMessage().contains("Ítem 1") && ex.getMessage().contains("PLT-001"), ex.getMessage());
        verifyNoInteractions(pedidoService);
    }

    @Test
    @DisplayName("HU034 Escenarios 1, 2 y 6: Un reenvío igual devuelve el pedido existente sin registrar otro ni avisar a cocina")
    void reenvioIgual_DevuelveElExistente() {
        PedidoResponse existente = new PedidoResponse();
        existente.setId(77L);
        existente.setCodigoCorrelativo("CMD-261113-0010");
        existente.setNumeroOrdenExterno("RP-48213");
        existente.setEstado("EN_PREPARACION");
        when(pedidoService.resolverReenvioExterno(any(CrearPedidoRequest.class)))
                .thenReturn(Optional.of(new PedidoService.ResultadoEnvio(existente, false)));

        PedidoExternoService.Resultado resultado = service.registrar(payloadValido());

        assertFalse(resultado.creado());
        assertEquals(77L, resultado.respuesta().pedidoId());
        assertEquals("CMD-261113-0010", resultado.respuesta().codigoPedido());
        verify(pedidoService, never()).registrarComanda(any(CrearPedidoRequest.class), anyString(), anyBoolean());
    }

    @Test
    @DisplayName("HU034 Escenario 4: Un reenvío con otros ítems se rechaza con el conflicto y no se registra nada")
    void reenvioConCambios_SeRechaza() {
        when(pedidoService.resolverReenvioExterno(any(CrearPedidoRequest.class)))
                .thenThrow(new pe.isil.kds.exception.OperacionNoPermitidaException("ya fue recibido con otros ítems", "PEDIDO_EXTERNO_CONFLICTO"));

        assertThrows(pe.isil.kds.exception.OperacionNoPermitidaException.class, () -> service.registrar(payloadValido()));
        verify(pedidoService, never()).registrarComanda(any(CrearPedidoRequest.class), anyString(), anyBoolean());
    }

    private static PedidoExternoRequest payloadValido() {
        PedidoExternoRequest request = new PedidoExternoRequest();
        request.setCanal("RAPPI");
        request.setNumeroOrden(" RP-48213 ");
        PedidoExternoRequest.Cliente cliente = new PedidoExternoRequest.Cliente();
        cliente.setNombre("Ana Torres");
        cliente.setTelefono("987654321");
        cliente.setDireccion("Av. Brasil 123");
        request.setCliente(cliente);
        request.setObservaciones("Tocar el timbre");

        PedidoExternoRequest.Item primero = new PedidoExternoRequest.Item();
        primero.setCodigoPlato("PLT-007");
        primero.setCantidad(2);
        primero.setModificadores(new ArrayList<>(List.of("Sin cebolla", "Término medio")));
        PedidoExternoRequest.Item segundo = new PedidoExternoRequest.Item();
        segundo.setCodigoPlato("PLT-012");
        segundo.setCantidad(1);
        request.setItems(new ArrayList<>(List.of(primero, segundo)));
        return request;
    }

    private static CanalVenta canal(Long id, String codigo, boolean activo) {
        CanalVenta canal = new CanalVenta();
        canal.setId(id);
        canal.setCodigo(codigo);
        canal.setNombre(codigo);
        canal.setActivo(activo);
        return canal;
    }

    private static Plato plato(Long id) {
        Plato plato = new Plato();
        plato.setId(id);
        plato.setNombre("Plato " + id);
        return plato;
    }
}
