package pe.isil.kds;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import pe.isil.kds.service.CodigoPlato;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;

/**
 * HU019 Escenario 4: el código PLT-001 identifica a un plato; todo lo que no tenga ese formato no se reconoce.
 */
class CodigoPlatoTest {

    @Test
    @DisplayName("El código se arma con el identificador del plato, igual que el del catálogo de administración")
    void deId_UsaTresDigitosComoMinimo() {
        assertEquals("PLT-007", CodigoPlato.deId(7L));
        assertEquals("PLT-045", CodigoPlato.deId(45L));
        assertEquals("PLT-1234", CodigoPlato.deId(1234L));
    }

    @Test
    @DisplayName("Un código con formato PLT-001 se convierte en el identificador del plato, sin importar mayúsculas ni espacios")
    void aId_FormatoValido() {
        assertEquals(Optional.of(7L), CodigoPlato.aId("PLT-007"));
        assertEquals(Optional.of(12L), CodigoPlato.aId("plt-12"));
        assertEquals(Optional.of(5L), CodigoPlato.aId("  PLT-005 "));
        assertEquals(Optional.of(1234L), CodigoPlato.aId("PLT-1234"));
    }

    @Test
    @DisplayName("Un texto sin el formato PLT-001 no corresponde a ningún plato")
    void aId_FormatoInvalido() {
        for (String texto : new String[] {null, "", "PLT-", "PLT", "PLT-1A", "LOMO", "7", "PLT--7", "PLT-1234567890", "XPLT-007"}) {
            assertEquals(Optional.empty(), CodigoPlato.aId(texto), String.valueOf(texto));
        }
    }
}
