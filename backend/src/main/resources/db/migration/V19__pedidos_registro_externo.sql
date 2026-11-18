-- ============================================================================
-- V19__pedidos_registro_externo.sql
-- HU020/HU032 (D32): reconocer los pedidos registrados por el expedidor o la integración, para listarlos
-- y permitir que el expedidor anule sus ítems sin darle acceso a los pedidos del comandero
-- ============================================================================

-- Marca de origen: verdadero cuando el pedido entró por el registro manual del expedidor o por el punto de
-- integración. No se deduce del canal porque WhatsApp y teléfono usan Delivery propio, que el mozo también usa.
ALTER TABLE pedidos ADD COLUMN registro_externo BOOLEAN NOT NULL DEFAULT FALSE;

-- Los pedidos externos que ya existían se reconocen por su número de orden o por la cuenta de integración
UPDATE pedidos
SET registro_externo = TRUE
WHERE numero_orden_externo IS NOT NULL
   OR usuario_id IN (SELECT id FROM usuarios WHERE username = 'integracion');

-- La lista de recientes filtra siempre por esta marca y por fecha
CREATE INDEX idx_pedidos_registro_externo ON pedidos (created_at) WHERE registro_externo;
