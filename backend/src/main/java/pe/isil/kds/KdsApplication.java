package pe.isil.kds;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

/**
 * Punto de entrada del Backend KDS (La Retama Restaurante).
 * 
 * Consideraciones arquitectónicas:
 * - Habilita la autoconfiguración de Spring Boot 3 con soporte para servidor web embebido y mensajería STOMP.
 * - Diseñado para operar en alta disponibilidad dentro de la red local del restaurante sin acceso a internet externo.
 */
@SpringBootApplication
public class KdsApplication {

    public static void main(String[] args) {
        SpringApplication.run(KdsApplication.class, args);
    }
}
