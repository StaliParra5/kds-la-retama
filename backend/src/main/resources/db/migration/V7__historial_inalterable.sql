-- ============================================================================
-- V7__historial_inalterable.sql
-- HU022 Escenario 5: el historial de transiciones no puede editarse ni eliminarse
-- ============================================================================

CREATE OR REPLACE FUNCTION fn_bloquear_cambios_historial() RETURNS trigger AS $$
BEGIN
    RAISE EXCEPTION 'El historial de transiciones es inalterable: % no permitido en transiciones_estado', TG_OP
        USING ERRCODE = 'insufficient_privilege';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_historial_inalterable
    BEFORE UPDATE OR DELETE ON transiciones_estado
    FOR EACH ROW EXECUTE FUNCTION fn_bloquear_cambios_historial();

-- TRUNCATE no dispara triggers por fila: se bloquea con un trigger de sentencia
CREATE TRIGGER trg_historial_sin_truncate
    BEFORE TRUNCATE ON transiciones_estado
    FOR EACH STATEMENT EXECUTE FUNCTION fn_bloquear_cambios_historial();

-- Consecuencia buscada: un pedido con historial no puede eliminarse (ON DELETE CASCADE choca
-- con el trigger); los pedidos e ítems se anulan, nunca se borran (HU032).

CREATE INDEX IF NOT EXISTS idx_transiciones_detalle ON transiciones_estado(detalle_pedido_id);
