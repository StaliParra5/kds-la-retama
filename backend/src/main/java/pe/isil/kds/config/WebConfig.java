package pe.isil.kds.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.core.io.ClassPathResource;
import org.springframework.core.io.Resource;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;
import org.springframework.web.servlet.resource.PathResourceResolver;

import java.io.IOException;

/**
 * Configuración Web MVC para soporte de Single Page Application (SPA React).
 * 
 * Consideración Estratégica:
 * - Redirige cualquier ruta no encontrada de API hacia index.html para permitir
 *   navegación del lado del cliente (React Router) en terminales de sala y cocina.
 */
@Configuration
public class WebConfig implements WebMvcConfigurer {

    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        registry.addResourceHandler("/**")
                .addResourceLocations("classpath:/static/")
                .resourceChain(true)
                .addResolver(new PathResourceResolver() {
                    @Override
                    protected Resource getResource(String resourcePath, Resource location) throws IOException {
                        Resource requestedResource = location.createRelative(resourcePath);
                        // Si el archivo estático existe físicamente en classpath:/static/, lo sirve directamente
                        if (requestedResource.exists() && requestedResource.isReadable()) {
                            return requestedResource;
                        }
                        // Si la petición inicia con /api o /ws, no interferir con los controladores REST
                        if (resourcePath.startsWith("api") || resourcePath.startsWith("ws") || resourcePath.startsWith("swagger")) {
                            return null;
                        }
                        // Para cualquier otra ruta SPA (ej. /comandero, /login), devolver index.html
                        return new ClassPathResource("/static/index.html");
                    }
                });
    }
}
