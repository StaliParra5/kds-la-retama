package pe.isil.kds;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import pe.isil.kds.security.IntegracionApiKeyFilter;

import java.io.UnsupportedEncodingException;

import static org.junit.jupiter.api.Assertions.*;

/**
 * HU019 Escenario 6: sin la clave de integración válida la solicitud se rechaza y no llega al controlador.
 */
class IntegracionApiKeyFilterTest {

    private static final String CLAVE = "clave-de-prueba-123";
    private static final String RUTA = "/api/v1/integracion/pedidos";

    @AfterEach
    void limpiarContexto() {
        SecurityContextHolder.clearContext();
    }

    private static MockHttpServletRequest solicitud(String ruta, String clave) {
        MockHttpServletRequest request = new MockHttpServletRequest("POST", ruta);
        if (clave != null) {
            request.addHeader(IntegracionApiKeyFilter.ENCABEZADO, clave);
        }
        return request;
    }

    @Test
    @DisplayName("HU019 Escenario 6: Con la clave correcta la solicitud continúa con la identidad de integración")
    void claveCorrecta_Continua() throws Exception {
        MockHttpServletResponse response = new MockHttpServletResponse();
        MockFilterChain chain = new MockFilterChain();

        new IntegracionApiKeyFilter(CLAVE).doFilter(solicitud(RUTA, CLAVE), response, chain);

        assertNotNull(chain.getRequest(), "La solicitud debe llegar al controlador");
        assertEquals(200, response.getStatus());
        Authentication autenticacion = SecurityContextHolder.getContext().getAuthentication();
        assertNotNull(autenticacion);
        assertTrue(autenticacion.getAuthorities().stream().anyMatch(a -> a.getAuthority().equals("ROLE_INTEGRACION")));
    }

    @Test
    @DisplayName("HU019 Escenario 6: Sin clave o con una clave incorrecta se responde 401 y no se llega al controlador")
    void claveAusenteOIncorrecta_Rechaza() throws Exception {
        for (String recibida : new String[] {null, "", "otra-clave", CLAVE + "x", CLAVE.toUpperCase()}) {
            MockHttpServletResponse response = new MockHttpServletResponse();
            MockFilterChain chain = new MockFilterChain();

            new IntegracionApiKeyFilter(CLAVE).doFilter(solicitud(RUTA, recibida), response, chain);

            assertEquals(401, response.getStatus(), String.valueOf(recibida));
            assertNull(chain.getRequest(), "No debe llegar al controlador: " + recibida);
            assertNull(SecurityContextHolder.getContext().getAuthentication());
            assertTrue(cuerpo(response).contains("Clave de integración ausente o inválida"));
            assertFalse(cuerpo(response).contains(CLAVE), "La respuesta nunca revela la clave configurada");
        }
    }

    @Test
    @DisplayName("HU019: Sin clave configurada en el servidor la integración queda deshabilitada y nunca acepta una clave vacía")
    void sinClaveConfigurada_RechazaTodo() throws Exception {
        for (String configurada : new String[] {"", "   ", null}) {
            for (String recibida : new String[] {null, "", " ", "cualquiera"}) {
                MockHttpServletResponse response = new MockHttpServletResponse();
                MockFilterChain chain = new MockFilterChain();

                new IntegracionApiKeyFilter(configurada).doFilter(solicitud(RUTA, recibida), response, chain);

                assertEquals(401, response.getStatus(), configurada + " / " + recibida);
                assertNull(chain.getRequest());
            }
        }
    }

    @Test
    @DisplayName("HU019: El filtro solo actúa sobre la ruta de integración; el resto de la API sigue con JWT")
    void otrasRutas_NoSeFiltran() throws Exception {
        MockHttpServletResponse response = new MockHttpServletResponse();
        MockFilterChain chain = new MockFilterChain();

        new IntegracionApiKeyFilter(CLAVE).doFilter(solicitud("/api/v1/pedidos", null), response, chain);

        assertNotNull(chain.getRequest());
        assertEquals(200, response.getStatus());
        assertNull(SecurityContextHolder.getContext().getAuthentication());
    }

    private static String cuerpo(MockHttpServletResponse response) throws UnsupportedEncodingException {
        return response.getContentAsString();
    }
}
