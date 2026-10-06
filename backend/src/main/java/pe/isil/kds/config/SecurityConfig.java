package pe.isil.kds.config;

import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;
import pe.isil.kds.security.JwtAuthenticationFilter;

import java.util.Arrays;
import java.util.List;

/**
 * Configuración Central de Seguridad Spring Security 6.
 * 
 * Principios de Arquitectura:
 * - Sesiones HTTP completamente Stateless mediante tokens JWT.
 * - Desactivación de CSRF al ser una API orientada a servicios y tokens.
 * - Soporte de CORS estricto para red local (LAN) permitiendo acceso de terminales cliente.
 * - Habilitación de @PreAuthorize para control granular por rol en endpoints administrativos (HU002).
 */
@Configuration
@EnableWebSecurity
@EnableMethodSecurity
public class SecurityConfig {

    private final JwtAuthenticationFilter jwtAuthenticationFilter;

    @Value("${kds.cors.allowed-origins:http://localhost:5173,http://127.0.0.1:5173,http://localhost:8080}")
    private String allowedOrigins;

    public SecurityConfig(JwtAuthenticationFilter jwtAuthenticationFilter) {
        this.jwtAuthenticationFilter = jwtAuthenticationFilter;
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
            .cors(cors -> cors.configurationSource(corsConfigurationSource()))
            .csrf(AbstractHttpConfigurer::disable)
            .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .exceptionHandling(exceptions -> exceptions
                .authenticationEntryPoint((request, response, authException) -> {
                    response.setContentType("application/json");
                    response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
                    response.getWriter().write("{\"error\": \"No autorizado\", \"mensaje\": \"" + authException.getMessage() + "\"}");
                })
                .accessDeniedHandler((request, response, accessDeniedException) -> {
                    response.setContentType("application/json");
                    response.setStatus(HttpServletResponse.SC_FORBIDDEN);
                    response.getWriter().write("{\"error\": \"Acceso denegado\", \"mensaje\": \"Permisos insuficientes para esta operación\"}");
                })
            )
            .authorizeHttpRequests(auth -> auth
                // Endpoints de autenticación públicos
                .requestMatchers("/api/v1/auth/**").permitAll()
                // Handshake de WebSockets y SockJS para sincronización de comandas en tiempo real en LAN
                .requestMatchers("/ws/**").permitAll()
                // Documentación técnica Swagger / OpenAPI
                .requestMatchers("/swagger-ui/**", "/swagger-ui.html", "/v3/api-docs/**", "/api/v1/docs/**").permitAll()
                // Recursos estáticos y rutas SPA del frontend React servidos por Spring Boot
                .requestMatchers("/", "/index.html", "/assets/**", "/vite.svg", "/*.ico", "/*.png", "/*.css", "/*.js").permitAll()
                .requestMatchers("/login", "/comandero", "/admin", "/admin/**", "/cocina", "/cocina/**").permitAll()
                // Cualquier endpoint de API o recurso privado exige autenticación con JWT
                .anyRequest().authenticated()
            )
            .addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration configuration = new CorsConfiguration();
        List<String> origins = Arrays.asList(allowedOrigins.split(","));
        configuration.setAllowedOrigins(origins);
        configuration.setAllowedMethods(Arrays.asList("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
        configuration.setAllowedHeaders(Arrays.asList("Authorization", "Content-Type", "Accept", "X-Requested-With"));
        configuration.setAllowCredentials(true);
        configuration.setMaxAge(3600L);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", configuration);
        return source;
    }
}
