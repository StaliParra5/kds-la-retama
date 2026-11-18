package pe.isil.kds.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.messaging.simp.config.ChannelRegistration;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;
import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer;
import pe.isil.kds.security.AutenticacionStompInterceptor;

/**
 * Configuración del Broker de Mensajería WebSocket con protocolo STOMP.
 *
 * Justificación de Diseño:
 * - Provee el canal bidireccional de baja latencia (< 2s) en la red local del restaurante (LAN)
 *   para notificar apertura de comandas, enrutamiento a estaciones y cambios de estado (HU017).
 * - Un único endpoint nativo /ws (decisión D7): los navegadores de las terminales soportan WebSocket,
 *   así que no se usa SockJS. La autenticación y los permisos por tópico viven en AutenticacionStompInterceptor.
 */
@Configuration
@EnableWebSocketMessageBroker
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {

    private final AutenticacionStompInterceptor autenticacionStomp;

    public WebSocketConfig(AutenticacionStompInterceptor autenticacionStomp) {
        this.autenticacionStomp = autenticacionStomp;
    }

    @Override
    public void configureMessageBroker(MessageBrokerRegistry config) {
        // Prefijos para mensajes salientes del servidor hacia clientes suscritos
        config.enableSimpleBroker("/topic", "/queue");
        // Prefijo para mensajes entrantes desde clientes hacia controladores con @MessageMapping
        config.setApplicationDestinationPrefixes("/app");
    }

    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        registry.addEndpoint("/ws")
                .setAllowedOriginPatterns("*");
    }

    @Override
    public void configureClientInboundChannel(ChannelRegistration registration) {
        registration.interceptors(autenticacionStomp);
    }
}
