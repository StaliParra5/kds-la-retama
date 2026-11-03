-- ============================================================================
-- V8__idempotencia_envio.sql
-- HU009 Escenarios 2 y 5: un reintento o doble pulsación no duplica el pedido
-- ============================================================================

ALTER TABLE pedidos ADD COLUMN clave_idempotencia VARCHAR(64);
ALTER TABLE pedidos ADD CONSTRAINT uq_pedidos_clave_idempotencia UNIQUE (clave_idempotencia);
