-- ============================================================================
-- V5__canal_delivery_propio.sql
-- HU010 Escenario 3: el canal de reparto propio se presenta como "Delivery propio"
-- ============================================================================

UPDATE canales_venta SET nombre = 'Delivery propio' WHERE codigo = 'DELIVERY';
