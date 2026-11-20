package pe.isil.kds.service;

import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.regex.Pattern;

/**
 * Reglas del color de un canal (HU015, decisión D37).
 *
 * - Formato #RRGGBB.
 * - Legible: el nombre del canal va en blanco sobre su color, así que el contraste con el blanco debe ser
 *   al menos 3:1 (WCAG para texto grande y negrita).
 * - No parecido al semáforo (verde, ámbar y rojo de las tarjetas, HU025): distancia de color mayor o igual
 *   a 35. Es la regla principal, para que el color del canal nunca se confunda con un retraso.
 * - No parecido a otro canal activo: distancia mayor o igual a 25 (incluye el mismo color, HU015 Esc. 4).
 *
 * La distancia es la diferencia de color CIE76 en el espacio Lab: 0 es el mismo color y a partir de unos
 * 20 a 25 dos colores se distinguen con claridad. Los mismos valores se usan en la pantalla de canales para
 * avisar antes de guardar (frontend/src/utils/canal.ts).
 */
public final class ColorCanal {

    public static final double DISTANCIA_MINIMA_SEMAFORO = 35;
    public static final double DISTANCIA_MINIMA_CANAL = 25;
    public static final double CONTRASTE_MINIMO_BLANCO = 3;

    // Colores del semáforo de las tarjetas (tokens secondary, tertiary y error de tailwind.config.js)
    public static final Map<String, String> SEMAFORO = Map.of(
            "verde", "#006c49",
            "ámbar", "#784b00",
            "rojo", "#ba1a1a");

    private static final Pattern FORMATO = Pattern.compile("^#[0-9a-fA-F]{6}$");

    private ColorCanal() {}

    /** Color de otro canal activo, para comparar. */
    public record OtroCanal(String nombre, String color) {}

    /**
     * Devuelve el color normalizado en minúsculas o lanza IllegalArgumentException con el motivo, listo para
     * mostrarse al administrador.
     */
    public static String validar(String color, List<OtroCanal> otrosCanalesActivos) {
        if (color == null || !FORMATO.matcher(color.trim()).matches()) {
            throw new IllegalArgumentException("El color debe tener el formato #RRGGBB (por ejemplo, #1d4ed8).");
        }
        String normalizado = color.trim().toLowerCase(Locale.ROOT);
        if (contrasteConBlanco(normalizado) < CONTRASTE_MINIMO_BLANCO) {
            throw new IllegalArgumentException("El color es demasiado claro: el nombre del canal, en blanco, no se leería. "
                    + "Elija un tono más oscuro.");
        }
        for (Map.Entry<String, String> semaforo : SEMAFORO.entrySet()) {
            if (distancia(normalizado, semaforo.getValue()) < DISTANCIA_MINIMA_SEMAFORO) {
                throw new IllegalArgumentException("El color se parece al " + semaforo.getKey()
                        + " del semáforo y podría confundirse con el estado del pedido. Elija otro tono.");
            }
        }
        for (OtroCanal otro : otrosCanalesActivos) {
            if (otro.color() != null && distancia(normalizado, otro.color().toLowerCase(Locale.ROOT)) < DISTANCIA_MINIMA_CANAL) {
                throw new IllegalArgumentException("El color es igual o muy parecido al del canal " + otro.nombre()
                        + ". Elija uno que se distinga.");
            }
        }
        return normalizado;
    }

    /** Diferencia de color CIE76 entre dos colores #RRGGBB. */
    public static double distancia(String a, String b) {
        double[] x = lab(a);
        double[] y = lab(b);
        return Math.sqrt(Math.pow(x[0] - y[0], 2) + Math.pow(x[1] - y[1], 2) + Math.pow(x[2] - y[2], 2));
    }

    /** Relación de contraste WCAG entre el color y el blanco. */
    public static double contrasteConBlanco(String color) {
        return 1.05 / (luminancia(color) + 0.05);
    }

    // sRGB -> XYZ (D65) -> Lab
    private static double[] lab(String hex) {
        double[] rgb = rgbLineal(hex);
        double x = (rgb[0] * 0.4124 + rgb[1] * 0.3576 + rgb[2] * 0.1805) / 0.95047;
        double y = rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
        double z = (rgb[0] * 0.0193 + rgb[1] * 0.1192 + rgb[2] * 0.9505) / 1.08883;
        double fx = f(x);
        double fy = f(y);
        double fz = f(z);
        return new double[] {116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)};
    }

    private static double f(double t) {
        return t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16.0 / 116;
    }

    private static double luminancia(String hex) {
        double[] rgb = rgbLineal(hex);
        return 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
    }

    private static double[] rgbLineal(String hex) {
        double[] canales = new double[3];
        for (int i = 0; i < 3; i++) {
            double c = Integer.parseInt(hex.substring(1 + i * 2, 3 + i * 2), 16) / 255.0;
            canales[i] = c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
        }
        return canales;
    }
}
