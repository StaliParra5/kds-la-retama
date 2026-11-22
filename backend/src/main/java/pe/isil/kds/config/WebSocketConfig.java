package pe.isil.kds.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.messaging.simp.config.ChannelRegistration;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.scheduling.concurrent.ThreadPoolTaskScheduler;
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
 * - HU038 Esc. 1: el broker envía y espera latidos cada 1,5 s. Sin ellos, una pantalla que pierde la red puede
 *   tardar minutos en notarlo; con ellos el cliente detecta el corte en menos de 5 s y muestra "Sin conexión".
 */
@Configuration
@EnableWebSocketMessageBroker
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {

    // HU038: intervalo de latidos servidor-cliente (ms); el cliente usa el mismo valor (frontend/src/api/tiempoReal.ts)
    static final long LATIDO_MS = 1500;

    private final AutenticacionStompInterceptor autenticacionStomp;

    public WebSocketConfig(AutenticacionStompInterceptor autenticacionStomp) {
        this.autenticacionStomp = autenticacionStomp;
    }

    @Override
    public void configureMessageBroker(MessageBrokerRegistry config) {
        // Prefijos para mensajes salientes del servidor hacia clientes suscritos
        // HU038: latidos en ambos sentidos; el broker simple necesita su propio planificador para enviarlos
        ThreadPoolTaskScheduler latidos = new ThreadPoolTaskScheduler();
        latidos.setPoolSize(1);
        latidos.setThreadNamePrefix("ws-latido-");
        latidos.initialize();
        config.enableSimpleBroker("/topic", "/queue")
                .setHeartbeatValue(new long[] {LATIDO_MS, LATIDO_MS})
                .setTaskScheduler(latidos);
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
