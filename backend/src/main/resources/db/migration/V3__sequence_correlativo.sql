-- ============================================================================
-- V3__sequence_correlativo.sql
-- Secuencia para garantizar correlativos atómicos y prevenir condiciones de carrera en alta concurrencia
-- ============================================================================

CREATE SEQUENCE IF NOT EXISTS seq_pedido_correlativo START WITH 1 INCREMENT BY 1;
