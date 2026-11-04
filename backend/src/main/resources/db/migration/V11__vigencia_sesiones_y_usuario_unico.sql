-- HU042 Escenarios 5 y 6: al desactivar a un usuario, cambiarle el PIN o el rol, los tokens emitidos
-- antes de ese momento dejan de valer (el token dura horas y la sesión abierta seguiría operando).
ALTER TABLE usuarios ADD COLUMN sesiones_validas_desde TIMESTAMP;

-- HU042 Escenario 2: el usuario es único sin distinguir mayúsculas, también ante altas simultáneas.
CREATE UNIQUE INDEX uq_usuarios_username_ci ON usuarios (lower(username));
