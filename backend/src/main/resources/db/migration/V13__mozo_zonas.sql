-- HU043: zonas que atiende cada mozo (asignación restrictiva, decisión D18).
CREATE TABLE mozo_zonas (
    usuario_id BIGINT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    zona_id    BIGINT NOT NULL REFERENCES zonas(id),
    PRIMARY KEY (usuario_id, zona_id)
);

-- Los mozos que ya existían conservan el acceso a todo el salón activo; desde ahora el admin lo ajusta
INSERT INTO mozo_zonas (usuario_id, zona_id)
SELECT u.id, z.id
FROM usuarios u
JOIN roles r ON r.id = u.rol_id
CROSS JOIN zonas z
WHERE r.codigo = 'MOZO' AND z.activo = TRUE;
