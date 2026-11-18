package pe.isil.kds.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.List;

/**
 * Autenticación por clave de integración del punto de pedidos externos (HU019 Esc. 6).
 *
 * Reglas:
 * - Solo actúa sobre /api/v1/integracion/**; el resto de la API sigue usando JWT.
 * - La clave llega en el encabezado X-Api-Key y se compara en tiempo constante (sobre sus hashes SHA-256,
 *   que además iguala los largos) para no filtrar información por el tiempo de respuesta.
 * - Si la clave no está configurada la integración queda deshabilitada: nunca se acepta una clave vacía.
 * - Una clave ausente o incorrecta se rechaza con 401 antes de llegar al controlador, de modo que no se
 *   registra ningún pedido, y ni siquiera un administrador con JWT puede usar esta ruta sin la clave.
 * - Nunca se escribe en el log la clave recibida ni la configurada.
 */
@Component
public class IntegracionApiKeyFilter extends OncePerRequestFilter {

    public static final String RUTA = "/api/v1/integracion/";
    public static final String ENCABEZADO = "X-Api-Key";
    public static final String ROL = "INTEGRACION";

    private static final Logger log = LoggerFactory.getLogger(IntegracionApiKeyFilter.class);

    private final byte[] huellaConfigurada;

    public IntegracionApiKeyFilter(@Value("${kds.integracion.api-key:}") String claveConfigurada) {
        this.huellaConfigurada = claveConfigurada == null || claveConfigurada.isBlank()
                ? null
                : huella(claveConfigurada);
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        return !request.getRequestURI().startsWith(RUTA);
    }

    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain) throws ServletException, IOException {

        String recibida = request.getHeader(ENCABEZADO);
        boolean valida = huellaConfigurada != null
                && recibida != null
                && MessageDigest.isEqual(huellaConfigurada, huella(recibida));

        if (!valida) {
            log.warn("Solicitud de integración rechazada: clave {} (origen {})",
                    huellaConfigurada == null ? "no configurada en el servidor" : "ausente o inválida",
                    request.getRemoteAddr());
            response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
            response.setContentType("application/json;charset=UTF-8");
            response.getWriter().write("{\"error\": \"No autorizado\", \"mensaje\": \"Clave de integración ausente o inválida.\"}");
            return;
        }

        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(
                "integracion", null, List.of(new SimpleGrantedAuthority("ROLE_" + ROL))));
        filterChain.doFilter(request, response);
    }

    private static byte[] huella(String texto) {
        try {
            return MessageDigest.getInstance("SHA-256").digest(texto.getBytes(StandardCharsets.UTF_8));
        } catch (NoSuchAlgorithmException e) {
            // SHA-256 es obligatorio en toda JVM: no hay forma de continuar sin él
            throw new IllegalStateException("SHA-256 no disponible", e);
        }
    }
}
