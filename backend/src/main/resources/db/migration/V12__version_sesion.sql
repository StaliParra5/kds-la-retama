-- HU042: la revocación por fecha (V11) dejaba válido un token emitido en el mismo segundo que el cambio,
-- porque la emisión del JWT viaja en segundos. Se reemplaza por una versión de sesión exacta: el token
-- lleva la versión vigente al emitirse y deja de valer cuando la versión del usuario cambia.
ALTER TABLE usuarios ADD COLUMN version_sesion INTEGER NOT NULL DEFAULT 0;
ALTER TABLE usuarios DROP COLUMN sesiones_validas_desde;
