-- ============================================================================
-- V4__sync_sequence_correlativo.sql
-- Sincronizar el valor inicial de la secuencia con pedidos preexistentes
-- ============================================================================

SELECT setval('seq_pedido_correlativo', GREATEST(COALESCE((SELECT COUNT(*) FROM pedidos), 0), 1));
