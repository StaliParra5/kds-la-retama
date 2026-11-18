-- ============================================================================
-- V21__merma_autorizacion.sql
-- HU032 (D36): anular un ítem ya iniciado exige la autorización de un administrador; la merma guarda quién la dio
-- ============================================================================

-- Las mermas existentes se registraron antes de esta regla: quedan sin autorizador (NULL)
ALTER TABLE mermas ADD COLUMN autorizado_por_id BIGINT REFERENCES usuarios (id);
ALTER TABLE mermas ADD COLUMN autorizado_por_nombre VARCHAR(255);
