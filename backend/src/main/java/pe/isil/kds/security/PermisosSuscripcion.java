package pe.isil.kds.security;

import java.util.Objects;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Qué tópicos STOMP puede escuchar cada rol (HU012, decisiones D6 y D8).
 *
 * - /topic/estacion/{id}: el cocinero solo la de su estación; expedidor y admin, cualquiera.
 * - /topic/items: todos los ítems, solo para el pase (expedidor) y el admin.
 * - /topic/pedidos: cualquier usuario autenticado (comandero y monitores).
 * Cualquier otro destino se rechaza.
 */
public final class PermisosSuscripcion {

    private static final Pattern TOPICO_ESTACION = Pattern.compile("^/topic/estacion/(\\d{1,18})$");

    private PermisosSuscripcion() {}

    public static boolean puedeSuscribirse(SesionKds sesion, String destino) {
        if (sesion == null || destino == null) {
            return false;
        }
        Matcher estacion = TOPICO_ESTACION.matcher(destino);
        if (estacion.matches()) {
            if (sesion.tieneRol("ADMIN", "EXPEDIDOR")) {
                return true;
            }
            return sesion.tieneRol("COCINERO")
                    && Objects.equals(sesion.estacionId(), Long.valueOf(estacion.group(1)));
        }
        return switch (destino) {
            case "/topic/items" -> sesion.tieneRol("ADMIN", "EXPEDIDOR");
            case "/topic/pedidos" -> true;
            default -> false;
        };
    }
}
