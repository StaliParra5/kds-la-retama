package pe.isil.kds.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import pe.isil.kds.dto.EstadoSistemaDto;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.time.Instant;
import java.util.function.BooleanSupplier;

/**
 * Salida a internet del servidor (HU018 Esc. 4 y 6, decisión D43).
 *
 * - La cocina no depende de internet: esto solo avisa que los pedidos de canales externos (Rappi) no pueden
 *   llegar y que el expedidor debe registrarlos a mano.
 * - Cada 10 s pide una dirección de verificación que responde vacío (por defecto la de Google, configurable con
 *   KDS_INTERNET_URL). Espera como máximo 3 s por respuesta.
 * - Se da por caído tras 2 fallas seguidas, para no avisar por un paquete perdido (detección en unos 13 a 23 s);
 *   vuelve a "con internet" con la primera respuesta correcta.
 * - Cada cambio se publica por /topic/sistema; las pantallas no se recargan ni se reinician (Esc. 6).
 */
@Service
public class EstadoInternetService {

    private static final Logger log = LoggerFactory.getLogger(EstadoInternetService.class);
    static final int FALLAS_PARA_CAIDA = 2;

    private final SimpMessagingTemplate messagingTemplate;
    private final BooleanSupplier verificador;
    private final boolean activo;

    private volatile Boolean internet;
    private volatile Instant verificadoEn;
    private int fallasSeguidas;

    @Autowired
    public EstadoInternetService(
            SimpMessagingTemplate messagingTemplate,
            @Value("${kds.internet.url-verificacion:http://connectivitycheck.gstatic.com/generate_204}") String url,
            @Value("${kds.internet.verificar:true}") boolean activo) {
        this(messagingTemplate, consultaHttp(url), activo);
    }

    // Constructor para pruebas: el verificador se reemplaza por uno controlado
    public EstadoInternetService(SimpMessagingTemplate messagingTemplate, BooleanSupplier verificador, boolean activo) {
        this.messagingTemplate = messagingTemplate;
        this.verificador = verificador;
        this.activo = activo;
    }

    public EstadoSistemaDto estado() {
        return new EstadoSistemaDto(internet, verificadoEn);
    }

    @Scheduled(initialDelayString = "${kds.internet.retraso-inicial-ms:3000}",
            fixedDelayString = "${kds.internet.intervalo-ms:10000}")
    public void verificar() {
        if (!activo) {
            return;
        }
        boolean responde;
        try {
            responde = verificador.getAsBoolean();
        } catch (RuntimeException e) {
            responde = false;
        }
        registrar(responde);
    }

    // Aplica la regla de las 2 fallas seguidas y avisa solo cuando el estado cambia
    synchronized void registrar(boolean responde) {
        verificadoEn = Instant.now();
        Boolean anterior = internet;
        if (responde) {
            fallasSeguidas = 0;
            internet = true;
        } else {
            fallasSeguidas++;
            if (fallasSeguidas >= FALLAS_PARA_CAIDA || anterior == null) {
                internet = false;
            }
        }
        if (!internet.equals(anterior)) {
            log.info("Salida a internet del servidor: {}", internet ? "disponible" : "sin conexión");
            messagingTemplate.convertAndSend("/topic/sistema", estado());
        }
    }

    // Consulta HTTP con plazos cortos; cualquier respuesta 2xx o 3xx cuenta como salida a internet
    private static BooleanSupplier consultaHttp(String url) {
        HttpClient cliente = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(3)).build();
        HttpRequest solicitud = HttpRequest.newBuilder(URI.create(url)).timeout(Duration.ofSeconds(3)).GET().build();
        return () -> {
            try {
                int codigo = cliente.send(solicitud, HttpResponse.BodyHandlers.discarding()).statusCode();
                return codigo >= 200 && codigo < 400;
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                return false;
            } catch (Exception e) {
                return false;
            }
        };
    }
}
