package pe.isil.kds;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import pe.isil.kds.service.ColorCanal;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

/**
 * HU015 (D37): reglas del color de un canal.
 */
class ColorCanalTest {

    private static final List<ColorCanal.OtroCanal> APROBADOS = List.of(
            new ColorCanal.OtroCanal("Salón", "#1d4ed8"),
            new ColorCanal.OtroCanal("Para llevar", "#0e7490"),
            new ColorCanal.OtroCanal("Delivery propio", "#7e22ce"),
            new ColorCanal.OtroCanal("Rappi", "#db2777"));

    @Test
    @DisplayName("Los cuatro colores aprobados cumplen las reglas entre sí")
    void coloresAprobados_SonValidos() {
        for (ColorCanal.OtroCanal canal : APROBADOS) {
            List<ColorCanal.OtroCanal> otros = APROBADOS.stream().filter(o -> o != canal).toList();
            assertEquals(canal.color(), ColorCanal.validar(canal.color(), otros), canal.nombre());
        }
    }

    @Test
    @DisplayName("El color se normaliza en minúsculas y sin espacios")
    void normaliza() {
        assertEquals("#9333ea", ColorCanal.validar(" #9333EA ", List.of()));
    }

    @Test
    @DisplayName("Un naranja legible queda demasiado cerca del rojo del semáforo y se rechaza")
    void naranja_ParecidoAlRojo() {
        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class, () -> ColorCanal.validar("#c2410c", List.of()));
        assertTrue(ex.getMessage().contains("rojo"), ex.getMessage());
    }

    @Test
    @DisplayName("Formato inválido, color muy claro o parecido a otro canal se rechazan con un mensaje claro")
    void reglas() {
        for (String formato : new String[] {null, "", "1d4ed8", "#1d4ed", "#zzzzzz", "rgb(0,0,0)"}) {
            assertThrows(IllegalArgumentException.class, () -> ColorCanal.validar(formato, List.of()), String.valueOf(formato));
        }
        assertTrue(assertThrows(IllegalArgumentException.class, () -> ColorCanal.validar("#ffffff", List.of()))
                .getMessage().contains("demasiado claro"));
        assertTrue(assertThrows(IllegalArgumentException.class, () -> ColorCanal.validar("#1e40af", APROBADOS))
                .getMessage().contains("Salón"));
    }

    @Test
    @DisplayName("La distancia entre un color y sí mismo es cero y crece con la diferencia")
    void distancia() {
        assertEquals(0, ColorCanal.distancia("#1d4ed8", "#1d4ed8"), 0.0001);
        assertTrue(ColorCanal.distancia("#1d4ed8", "#1e40af") < ColorCanal.DISTANCIA_MINIMA_CANAL);
        assertTrue(ColorCanal.distancia("#1d4ed8", "#ba1a1a") > ColorCanal.DISTANCIA_MINIMA_SEMAFORO);
    }
}
