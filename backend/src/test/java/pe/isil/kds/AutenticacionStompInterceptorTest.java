package pe.isil.kds;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.messaging.Message;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.MessageBuilder;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import pe.isil.kds.security.AutenticacionStompInterceptor;
import pe.isil.kds.security.JwtTokenProvider;
import pe.isil.kds.security.SesionKds;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AutenticacionStompInterceptorTest {

    @Mock
    private JwtTokenProvider tokenProvider;

    @InjectMocks
    private AutenticacionStompInterceptor interceptor;

    @Test
    @DisplayName("HU012: CONNECT con token válido asocia la sesión KDS a la conexión")
    void connect_TokenValido() {
        UsernamePasswordAuthenticationToken auth = autenticacion("cocinero1", "COCINERO", 2L);
        when(tokenProvider.autenticar("tok-ok")).thenReturn(auth);
        StompHeaderAccessor accessor = frame(StompCommand.CONNECT);
        accessor.setNativeHeader("Authorization", "Bearer tok-ok");

        interceptor.preSend(mensaje(accessor), null);

        assertSame(auth, accessor.getUser());
    }

    @Test
    @DisplayName("HU012: CONNECT sin token o con token inválido se rechaza")
    void connect_SinTokenOInvalido() {
        StompHeaderAccessor sinToken = frame(StompCommand.CONNECT);
        assertThrows(BadCredentialsException.class, () -> interceptor.preSend(mensaje(sinToken), null));

        StompHeaderAccessor invalido = frame(StompCommand.CONNECT);
        invalido.setNativeHeader("Authorization", "Bearer vencido");
        when(tokenProvider.autenticar("vencido")).thenReturn(null);
        assertThrows(BadCredentialsException.class, () -> interceptor.preSend(mensaje(invalido), null));
    }

    @Test
    @DisplayName("HU012 Escenario 1: Un cocinero de Fríos no puede suscribirse al tópico de Plancha")
    void subscribe_OtraEstacion_Rechazada() {
        StompHeaderAccessor propia = frame(StompCommand.SUBSCRIBE);
        propia.setUser(autenticacion("cocinero1", "COCINERO", 2L));
        propia.setDestination("/topic/estacion/2");
        assertDoesNotThrow(() -> interceptor.preSend(mensaje(propia), null));

        StompHeaderAccessor ajena = frame(StompCommand.SUBSCRIBE);
        ajena.setUser(autenticacion("cocinero1", "COCINERO", 2L));
        ajena.setDestination("/topic/estacion/1");
        assertThrows(AccessDeniedException.class, () -> interceptor.preSend(mensaje(ajena), null));
    }

    @Test
    @DisplayName("HU012: Suscripción sin CONNECT autenticado y envíos del cliente se rechazan")
    void subscribeAnonimoYSend_Rechazados() {
        StompHeaderAccessor anonimo = frame(StompCommand.SUBSCRIBE);
        anonimo.setDestination("/topic/pedidos");
        assertThrows(AccessDeniedException.class, () -> interceptor.preSend(mensaje(anonimo), null));

        StompHeaderAccessor envio = frame(StompCommand.SEND);
        envio.setUser(autenticacion("admin", "ADMIN", null));
        envio.setDestination("/app/cualquiera");
        assertThrows(AccessDeniedException.class, () -> interceptor.preSend(mensaje(envio), null));
    }

    private static StompHeaderAccessor frame(StompCommand comando) {
        StompHeaderAccessor accessor = StompHeaderAccessor.create(comando);
        accessor.setLeaveMutable(true);
        return accessor;
    }

    private static Message<byte[]> mensaje(StompHeaderAccessor accessor) {
        return MessageBuilder.createMessage(new byte[0], accessor.getMessageHeaders());
    }

    private static UsernamePasswordAuthenticationToken autenticacion(String username, String rol, Long estacionId) {
        UsernamePasswordAuthenticationToken auth = new UsernamePasswordAuthenticationToken(
                username, null, List.of(new SimpleGrantedAuthority("ROLE_" + rol)));
        auth.setDetails(new SesionKds(username, rol, estacionId));
        return auth;
    }

    @Test
    @DisplayName("HU012: El frame STOMP (equivalente a CONNECT en STOMP 1.2) también se autentica")
    void stompFrame_SeAutentica() {
        UsernamePasswordAuthenticationToken auth = autenticacion("admin", "ADMIN", null);
        when(tokenProvider.autenticar("tok-ok")).thenReturn(auth);
        StompHeaderAccessor accessor = frame(StompCommand.STOMP);
        accessor.setNativeHeader("Authorization", "Bearer tok-ok");

        interceptor.preSend(mensaje(accessor), null);

        assertSame(auth, accessor.getUser());
    }
}
