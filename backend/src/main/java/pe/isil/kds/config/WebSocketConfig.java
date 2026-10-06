package pe.isil.kds.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;
import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer;

/**
 * Configuración del Broker de Mensajería WebSocket con protocolo STOMP.
 * 
 * Justificación de Diseño:
 * - Provee el canal bidireccional de baja latencia (< 2s) en la red local del restaurante (LAN)
 *   para notificar apertura de comandas, enrutamiento a estaciones y cambios de estado (HU017).
 */
@Configuration
@EnableWebSocketMessageBroker
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {

    @Override
    public void configureMessageBroker(MessageBrokerRegistry config) {
        // Prefijos para mensajes salientes del servidor hacia clientes suscritos
        config.enableSimpleBroker("/topic", "/queue");
        // Prefijo para mensajes entrantes desde clientes hacia controladores con @MessageMapping
        config.setApplicationDestinationPrefixes("/app");
    }

    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        // Endpoint WebSocket principal con soporte para SockJS para navegadores en kiosco
        registry.addEndpoint("/ws")
                .setAllowedOriginPatterns("*")
                .withSockJS();

        // Endpoint WebSocket nativo sin SockJS
        registry.addEndpoint("/ws")
                .setAllowedOriginPatterns("*");
    }
}
