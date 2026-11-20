-- ============================================================================
-- V23__clave_autorizacion.sql
-- HU049 (D36): clave de autorización del administrador para anular ítems ya iniciados
-- ============================================================================

-- PIN de 6 dígitos propio de cada administrador, distinto de su contraseña de ingreso.
-- Se guarda solo su hash BCrypt. NULL = el administrador aún no la configuró y no puede autorizar.
ALTER TABLE usuarios ADD COLUMN clave_autorizacion_hash VARCHAR(100);
