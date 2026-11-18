package pe.isil.kds;

import jakarta.validation.ConstraintViolation;
import jakarta.validation.Validation;
import jakarta.validation.Validator;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import pe.isil.kds.dto.AnularItemRequest;
import pe.isil.kds.model.EstadoItem;
import pe.isil.kds.model.MotivoAnulacion;

import java.util.Set;

import static org.junit.jupiter.api.Assertions.*;

/**
 * HU032 Escenario 3: sin motivo (o sin el estado que el mozo ve) la solicitud ni siquiera llega al servicio.
 */
class AnularItemRequestValidationTest {

    private static Validator validator;

    @BeforeAll
    static void crearValidador() {
        validator = Validation.buildDefaultValidatorFactory().getValidator();
    }

    @Test
    @DisplayName("HU032 Escenario 3: Una anulación sin motivo es inválida y explica que debe seleccionarlo")
    void sinMotivo_EsInvalida() {
        Set<ConstraintViolation<AnularItemRequest>> errores =
                validator.validate(new AnularItemRequest(EstadoItem.EN_PREPARACION, null));

        assertEquals(1, errores.size());
        assertEquals("Seleccione un motivo para anular el ítem", errores.iterator().next().getMessage());
    }

    @Test
    @DisplayName("HU032: Una anulación sin el estado que el mozo ve es inválida")
    void sinEstadoActual_EsInvalida() {
        Set<ConstraintViolation<AnularItemRequest>> errores =
                validator.validate(new AnularItemRequest(null, MotivoAnulacion.OTRO));

        assertEquals(1, errores.size());
        assertEquals("estadoActual", errores.iterator().next().getPropertyPath().toString());
    }

    @Test
    @DisplayName("HU032: Una anulación con motivo y estado es válida para cada motivo de la lista")
    void completa_EsValida() {
        for (MotivoAnulacion motivo : MotivoAnulacion.values()) {
            assertTrue(validator.validate(new AnularItemRequest(EstadoItem.RECIBIDO, motivo)).isEmpty(), motivo.name());
        }
    }
}
