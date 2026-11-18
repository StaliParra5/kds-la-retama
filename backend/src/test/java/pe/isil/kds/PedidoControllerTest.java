package pe.isil.kds;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.core.annotation.AnnotatedElementUtils;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestMethod;
import pe.isil.kds.controller.PedidoController;
import pe.isil.kds.dto.CrearPedidoRequest;

import java.lang.reflect.Method;
import java.util.Arrays;
import java.util.List;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.*;

class PedidoControllerTest {

    /**
     * HU009 Escenario 4: un pedido enviado no se edita directamente; los cambios se hacen
     * como adición (HU031) o anulación (HU032). Se revisan todos los mapeos del controlador
     * (incluidos @RequestMapping con método explícito) contra la lista de operaciones permitidas.
     */
    @Test
    @DisplayName("HU009 Escenario 4: La API de pedidos no expone edición directa de un pedido enviado")
    void pedidoEnviado_SinEdicionDirecta() {
        Set<String> permitidas = Set.of(
                "POST ", "POST /externo", "GET /externos/recientes", "GET /{id}", "GET /{id}/historial", "GET /activos", "GET /correlativo-siguiente", "GET /envio/{clave}");

        List<String> expuestas = Arrays.stream(PedidoController.class.getDeclaredMethods())
                .map(m -> AnnotatedElementUtils.findMergedAnnotation(m, RequestMapping.class))
                .filter(java.util.Objects::nonNull)
                .flatMap(rm -> Arrays.stream(rm.method()).map(metodo ->
                        metodo + " " + (rm.path().length > 0 ? rm.path()[0] : "")))
                .toList();

        assertFalse(expuestas.isEmpty());
        for (String operacion : expuestas) {
            assertTrue(permitidas.contains(operacion), "Operación no prevista en pedidos: " + operacion);
            assertFalse(operacion.startsWith(RequestMethod.PUT.name()) || operacion.startsWith(RequestMethod.PATCH.name())
                    || operacion.startsWith(RequestMethod.DELETE.name()), operacion);
        }
    }

    @Test
    @DisplayName("HU039 Escenario 3: Solo el mozo puede registrar pedidos")
    void registrarPedido_SoloMozo() throws NoSuchMethodException {
        Method abrir = PedidoController.class.getMethod("abrirComanda", CrearPedidoRequest.class, Authentication.class);
        PreAuthorize permiso = abrir.getAnnotation(PreAuthorize.class);

        assertNotNull(permiso, "El registro de pedidos debe exigir un rol");
        assertEquals("hasRole('MOZO')", permiso.value());
    }

    @Test
    @DisplayName("HU020: El expedidor (y, de forma provisional, el administrador) registra pedidos externos a mano; el mozo no")
    void registrarPedidoExterno_SoloExpedidor() throws NoSuchMethodException {
        Method externo = PedidoController.class.getMethod("registrarPedidoExterno", CrearPedidoRequest.class, Authentication.class);
        PreAuthorize permiso = externo.getAnnotation(PreAuthorize.class);

        assertNotNull(permiso, "El registro manual de pedidos externos debe exigir un rol");
        assertEquals("hasAnyRole('EXPEDIDOR', 'ADMIN')", permiso.value());
    }

    @Test
    @DisplayName("D32: Solo el expedidor y el administrador consultan los pedidos externos recientes")
    void externosRecientes_ExpedidorYAdmin() throws NoSuchMethodException {
        PreAuthorize permiso = PedidoController.class.getMethod("externosRecientes").getAnnotation(PreAuthorize.class);

        assertNotNull(permiso);
        assertEquals("hasAnyRole('EXPEDIDOR', 'ADMIN')", permiso.value());
    }

    @Test
    @DisplayName("HU019: El punto de integración solo admite la identidad de la clave de integración, no usuarios")
    void integracion_SoloConClaveDeIntegracion() {
        PreAuthorize permiso = pe.isil.kds.controller.IntegracionController.class.getAnnotation(PreAuthorize.class);

        assertNotNull(permiso);
        assertEquals("hasRole('INTEGRACION')", permiso.value());
    }
}
