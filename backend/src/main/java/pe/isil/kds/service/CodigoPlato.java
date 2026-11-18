package pe.isil.kds.service;

import java.util.Optional;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Código de plato con el que los sistemas externos identifican un plato del catálogo (HU019): PLT-001, PLT-002...
 * Es el mismo que muestra el catálogo del administrador y se deriva del identificador del plato, de modo que
 * no hay una segunda numeración que mantener ni que pueda desalinearse.
 */
public final class CodigoPlato {

    private static final Pattern FORMATO = Pattern.compile("^PLT-(\\d{1,9})$", Pattern.CASE_INSENSITIVE);

    private CodigoPlato() {}

    public static String deId(Long platoId) {
        return String.format("PLT-%03d", platoId);
    }

    /** Devuelve el identificador del plato si el texto tiene el formato PLT-001; vacío si no lo tiene. */
    public static Optional<Long> aId(String codigo) {
        if (codigo == null) {
            return Optional.empty();
        }
        Matcher coincidencia = FORMATO.matcher(codigo.trim());
        return coincidencia.matches() ? Optional.of(Long.parseLong(coincidencia.group(1))) : Optional.empty();
    }
}
