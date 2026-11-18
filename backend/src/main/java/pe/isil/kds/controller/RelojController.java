package pe.isil.kds.controller;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import pe.isil.kds.dto.RelojDto;

import java.time.ZoneId;

/**
 * Hora de referencia del servidor (HU021 Esc. 6).
 *
 * Los cronómetros de las tarjetas no confían en el reloj de cada PC: cada pantalla pide esta hora, calcula su
 * desfase y lo aplica, de modo que dos PCs con relojes distintos muestran el mismo tiempo transcurrido.
 * Requiere sesión iniciada (cualquier rol); no expone datos sensibles.
 */
@Tag(name = "Reloj", description = "Hora del servidor para sincronizar los cronómetros")
@RestController
@RequestMapping("/api/v1/reloj")
public class RelojController {

    @Operation(summary = "Hora actual del servidor en milisegundos y zona horaria del restaurante (HU021)")
    @GetMapping
    public ResponseEntity<RelojDto> ahora() {
        // Sin caché: una respuesta guardada daría una hora vieja y un desfase falso
        return ResponseEntity.ok()
                .cacheControl(CacheControl.noStore())
                .body(new RelojDto(System.currentTimeMillis(), ZoneId.systemDefault().getId()));
    }
}
