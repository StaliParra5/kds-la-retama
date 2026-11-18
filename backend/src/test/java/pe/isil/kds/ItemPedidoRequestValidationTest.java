package pe.isil.kds;

import jakarta.validation.ConstraintViolation;
import jakarta.validation.Validation;
import jakarta.validation.Validator;
import jakarta.validation.ValidatorFactory;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import pe.isil.kds.dto.ItemPedidoRequest;

import java.util.Set;

import static org.junit.jupiter.api.Assertions.*;

class ItemPedidoRequestValidationTest {

    private static ValidatorFactory factory;
    private static Validator validator;

    @BeforeAll
    static void setUp() {
        factory = Validation.buildDefaultValidatorFactory();
        validator = factory.getValidator();
    }

    @AfterAll
    static void tearDown() {
        factory.close();
    }

    @Test
    @DisplayName("HU008 Escenario 1: Cantidades entre 1 y 50 con modificador son válidas")
    void itemValido_SinViolaciones() {
        assertTrue(validator.validate(new ItemPedidoRequest(50L, 1, "Sin cebolla")).isEmpty());
        assertTrue(validator.validate(new ItemPedidoRequest(50L, 50, null)).isEmpty());
    }

    @Test
    @DisplayName("HU008 Escenario 4: Cantidad fuera del rango 1 a 50 es rechazada")
    void cantidadFueraDeRango_EsRechazada() {
        assertViolacionEn("cantidad", new ItemPedidoRequest(50L, 0, null));
        assertViolacionEn("cantidad", new ItemPedidoRequest(50L, 51, null));
    }

    @Test
    @DisplayName("HU008 Escenario 4: Modificadores de más de 255 caracteres son rechazados")
    void modificadoresDemasiadoLargos_SonRechazados() {
        assertTrue(validator.validate(new ItemPedidoRequest(50L, 1, "x".repeat(255))).isEmpty());
        assertViolacionEn("modificadores", new ItemPedidoRequest(50L, 1, "x".repeat(256)));
    }

    private void assertViolacionEn(String campo, ItemPedidoRequest item) {
        Set<ConstraintViolation<ItemPedidoRequest>> violaciones = validator.validate(item);
        assertEquals(1, violaciones.size());
        assertEquals(campo, violaciones.iterator().next().getPropertyPath().toString());
    }
}
