package pe.isil.kds;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

import java.time.ZoneId;
import java.util.TimeZone;

/**
 * Punto de entrada del Backend KDS (La Retama Restaurante).
 * 
 * Consideraciones arquitectónicas:
 * - Habilita la autoconfiguración de Spring Boot 3 con soporte para servidor web embebido y mensajería STOMP.
 * - Diseñado para operar en alta disponibilidad dentro de la red local del restaurante sin acceso a internet externo.
 * - Fija la zona horaria del restaurante (KDS_ZONA_HORARIA, por defecto America/Lima) para que todas las
 *   horas registradas usen el reloj del servidor en hora local, sin importar la configuración del contenedor (HU022).
 */
@SpringBootApplication
public class KdsApplication {

    public static void main(String[] args) {
        String zona = System.getenv("KDS_ZONA_HORARIA");
        TimeZone.setDefault(TimeZone.getTimeZone(ZoneId.of(zona == null || zona.isBlank() ? "America/Lima" : zona)));
        SpringApplication.run(KdsApplication.class, args);
    }
}
