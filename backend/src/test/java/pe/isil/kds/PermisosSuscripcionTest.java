package pe.isil.kds;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import pe.isil.kds.security.PermisosSuscripcion;
import pe.isil.kds.security.SesionKds;

import static org.junit.jupiter.api.Assertions.*;

class PermisosSuscripcionTest {

    private final SesionKds cocineroFrios = new SesionKds("cocinero1", "COCINERO", 2L);
    private final SesionKds cocineroSinEstacion = new SesionKds("cocinero1", "COCINERO", null);
    private final SesionKds expedidor = new SesionKds("expedidor1", "EXPEDIDOR", null);
    private final SesionKds admin = new SesionKds("admin", "ADMIN", null);
    private final SesionKds mozo = new SesionKds("angie", "MOZO", null);

    @Test
    @DisplayName("HU012 Escenario 1: La pantalla de Fríos escucha su tópico y no el de Plancha")
    void cocinero_SoloSuEstacion() {
        assertTrue(PermisosSuscripcion.puedeSuscribirse(cocineroFrios, "/topic/estacion/2"));
        assertFalse(PermisosSuscripcion.puedeSuscribirse(cocineroFrios, "/topic/estacion/1"));
        assertFalse(PermisosSuscripcion.puedeSuscribirse(cocineroFrios, "/topic/items"));
        assertFalse(PermisosSuscripcion.puedeSuscribirse(cocineroSinEstacion, "/topic/estacion/2"));
    }

    @Test
    @DisplayName("HU012 / D9: Expedidor y admin escuchan cualquier estación y el tópico general del pase")
    void expedidorYAdmin_TodasLasEstaciones() {
        for (SesionKds sesion : new SesionKds[] {expedidor, admin}) {
            assertTrue(PermisosSuscripcion.puedeSuscribirse(sesion, "/topic/estacion/1"));
            assertTrue(PermisosSuscripcion.puedeSuscribirse(sesion, "/topic/items"));
        }
    }

    @Test
    @DisplayName("HU012: El mozo solo escucha pedidos; destinos desconocidos o mal formados se rechazan")
    void mozoYDestinosInvalidos() {
        assertTrue(PermisosSuscripcion.puedeSuscribirse(mozo, "/topic/pedidos"));
        // HU030: cualquier usuario autenticado escucha los cambios de la carta
        assertTrue(PermisosSuscripcion.puedeSuscribirse(mozo, "/topic/platos"));
        assertFalse(PermisosSuscripcion.puedeSuscribirse(mozo, "/topic/estacion/2"));
        assertFalse(PermisosSuscripcion.puedeSuscribirse(admin, "/topic/estacion/2/extra"));
        assertFalse(PermisosSuscripcion.puedeSuscribirse(admin, "/topic/estacion/abc"));
        // Un id que no cabe en Long se rechaza sin lanzar NumberFormatException
        assertFalse(PermisosSuscripcion.puedeSuscribirse(admin, "/topic/estacion/99999999999999999999"));
        assertFalse(PermisosSuscripcion.puedeSuscribirse(admin, "/queue/otro"));
        assertFalse(PermisosSuscripcion.puedeSuscribirse(null, "/topic/pedidos"));
        assertFalse(PermisosSuscripcion.puedeSuscribirse(admin, null));
    }
}
