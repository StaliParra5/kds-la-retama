package pe.isil.kds;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import pe.isil.kds.model.EstadoItem;
import pe.isil.kds.model.EstadoPedido;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static pe.isil.kds.model.EstadoItem.*;

class EstadoItemTest {

    @Test
    @DisplayName("HU013 Escenario 1: El ítem recorre Recibido → En preparación → Listo → Despachado")
    void flujoValido() {
        assertTrue(RECIBIDO.puedeTransicionarA(EN_PREPARACION));
        assertTrue(EN_PREPARACION.puedeTransicionarA(LISTO));
        assertTrue(LISTO.puedeTransicionarA(DESPACHADO));
        // Rama con espera previa
        assertTrue(RECIBIDO.puedeTransicionarA(EN_ESPERA));
        assertTrue(EN_ESPERA.puedeTransicionarA(EN_PREPARACION));
    }

    @Test
    @DisplayName("HU013 Escenario 2: De Recibido no se puede saltar a Despachado ni a Listo")
    void saltosInvalidos() {
        assertFalse(RECIBIDO.puedeTransicionarA(DESPACHADO));
        assertFalse(RECIBIDO.puedeTransicionarA(LISTO));
        assertFalse(EN_ESPERA.puedeTransicionarA(LISTO));
    }

    @Test
    @DisplayName("HU013 Escenario 4: Listo no puede volver a En preparación (sin recall)")
    void retrocesoNoPermitido() {
        assertFalse(LISTO.puedeTransicionarA(EN_PREPARACION));
        assertFalse(EN_PREPARACION.puedeTransicionarA(RECIBIDO));
    }

    @ParameterizedTest
    @EnumSource(EstadoItem.class)
    @DisplayName("HU013 Escenario 5: Despachado y Anulado son finales y no admiten ningún cambio")
    void estadosFinales(EstadoItem destino) {
        assertFalse(DESPACHADO.puedeTransicionarA(destino));
        assertFalse(ANULADO.puedeTransicionarA(destino));
        assertTrue(DESPACHADO.esFinal());
        assertTrue(ANULADO.esFinal());
    }

    @Test
    @DisplayName("HU013: Anular es posible desde cualquier estado no final")
    void anulacionDesdeEstadosNoFinales() {
        for (EstadoItem e : List.of(RECIBIDO, EN_ESPERA, EN_PREPARACION, LISTO)) {
            assertTrue(e.puedeTransicionarA(ANULADO), e.name());
        }
    }

    @Test
    @DisplayName("HU013: El estado del pedido se deriva del estado de sus ítems")
    void derivacionEstadoPedido() {
        assertEquals(EstadoPedido.ENVIADO, EstadoPedido.derivar(List.of(RECIBIDO, EN_ESPERA)));
        assertEquals(EstadoPedido.EN_PREPARACION, EstadoPedido.derivar(List.of(RECIBIDO, EN_PREPARACION)));
        assertEquals(EstadoPedido.EN_PREPARACION, EstadoPedido.derivar(List.of(RECIBIDO, LISTO)));
        assertEquals(EstadoPedido.LISTO, EstadoPedido.derivar(List.of(LISTO, DESPACHADO, ANULADO)));
        assertEquals(EstadoPedido.DESPACHADO, EstadoPedido.derivar(List.of(DESPACHADO, ANULADO)));
        assertEquals(EstadoPedido.ANULADO, EstadoPedido.derivar(List.of(ANULADO, ANULADO)));
    }
}
