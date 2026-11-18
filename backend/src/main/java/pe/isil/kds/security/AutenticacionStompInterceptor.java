package pe.isil.kds.security;

import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.messaging.support.MessageHeaderAccessor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Component;

/**
 * Seguridad del WebSocket (HU012). El handshake HTTP de /ws es público porque el navegador
 * no puede enviar cabeceras en él; la autenticación ocurre en el frame STOMP CONNECT:
 *
 * - CONNECT/STOMP: exige "Authorization: Bearer <token>" válido; sin él la conexión se rechaza.
 * - SUBSCRIBE: solo a los tópicos que el rol puede ver (PermisosSuscripcion). Así una
 *   pantalla de Fríos no recibe los ítems de Plancha aunque conozca el tópico.
 * - SEND: el servidor no recibe mensajes de los clientes; los cambios van por la API REST.
 */
@Component
public class AutenticacionStompInterceptor implements ChannelInterceptor {

    private static final String PREFIJO_BEARER = "Bearer ";

    private final JwtTokenProvider tokenProvider;

    public AutenticacionStompInterceptor(JwtTokenProvider tokenProvider) {
        this.tokenProvider = tokenProvider;
    }

    @Override
    public Message<?> preSend(Message<?> message, MessageChannel channel) {
        StompHeaderAccessor accessor = MessageHeaderAccessor.getAccessor(message, StompHeaderAccessor.class);
        if (accessor == null || accessor.getCommand() == null) {
            return message;
        }
        // STOMP es el nombre del frame de conexión en STOMP 1.2; equivale a CONNECT
        if (accessor.getCommand() == StompCommand.CONNECT || accessor.getCommand() == StompCommand.STOMP) {
            Authentication autenticacion = tokenProvider.autenticar(extraerToken(accessor));
            if (autenticacion == null) {
                throw new BadCredentialsException("Conexión en tiempo real rechazada: token ausente, inválido o vencido.");
            }
            accessor.setUser(autenticacion);
        } else if (accessor.getCommand() == StompCommand.SUBSCRIBE) {
            SesionKds sesion = accessor.getUser() instanceof Authentication a ? SesionKds.de(a) : null;
            if (!PermisosSuscripcion.puedeSuscribirse(sesion, accessor.getDestination())) {
                throw new AccessDeniedException("Sin permiso para escuchar " + accessor.getDestination() + ".");
            }
        } else if (accessor.getCommand() == StompCommand.SEND) {
            throw new AccessDeniedException("El canal en tiempo real es solo de lectura.");
        }
        return message;
    }

    private static String extraerToken(StompHeaderAccessor accessor) {
        String cabecera = accessor.getFirstNativeHeader("Authorization");
        if (cabecera != null && cabecera.startsWith(PREFIJO_BEARER)) {
            return cabecera.substring(PREFIJO_BEARER.length());
        }
        return null;
    }
}
