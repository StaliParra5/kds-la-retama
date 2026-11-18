package pe.isil.kds.config;

import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.security.SecurityRequirement;
import io.swagger.v3.oas.models.security.SecurityScheme;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Documentación OpenAPI con esquema de seguridad JWT.
 * Habilita el botón "Authorize" de Swagger UI para probar los endpoints protegidos
 * pegando el token obtenido en /api/v1/auth/login-admin o /api/v1/auth/login-pin.
 */
@Configuration
public class OpenApiConfig {

    private static final String ESQUEMA_JWT = "bearerAuth";

    @Bean
    public OpenAPI kdsOpenApi() {
        return new OpenAPI()
                .info(new Info()
                        .title("KDS La Retama - API")
                        .description("API del Kitchen Display System y comandero de La Retama Restaurante.")
                        .version("v1"))
                .components(new Components().addSecuritySchemes(ESQUEMA_JWT, new SecurityScheme()
                        .type(SecurityScheme.Type.HTTP)
                        .scheme("bearer")
                        .bearerFormat("JWT")
                        .description("Pegue solo el token (sin la palabra Bearer).")))
                .addSecurityItem(new SecurityRequirement().addList(ESQUEMA_JWT));
    }
}
