-- HU044 / HU046 (decisión D19): abrir una mesa crea una atención (mozo, personas, hora) y los pedidos
-- de salón cuelgan de ella; la mesa vuelve a estar libre cuando un mozo de su zona la libera.
CREATE TABLE atenciones_mesa (
    id            BIGSERIAL PRIMARY KEY,
    mesa_id       BIGINT    NOT NULL REFERENCES mesas(id),
    mozo_id       BIGINT    NOT NULL REFERENCES usuarios(id),
    personas      INTEGER   NOT NULL CHECK (personas > 0),
    abierta_en    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    liberada_en   TIMESTAMP,
    liberada_por  BIGINT    REFERENCES usuarios(id)
);

-- HU044 Escenario 5: una sola atención abierta por mesa, también ante aperturas simultáneas
CREATE UNIQUE INDEX uq_atencion_abierta_por_mesa ON atenciones_mesa (mesa_id) WHERE liberada_en IS NULL;

ALTER TABLE pedidos ADD COLUMN atencion_id BIGINT REFERENCES atenciones_mesa(id);
CREATE INDEX idx_pedidos_atencion ON pedidos (atencion_id);

-- Mesas con pedidos en curso al migrar: se abre su atención con el mozo del primer pedido y la
-- capacidad de la mesa como personas, para que sigan figurando en atención
INSERT INTO atenciones_mesa (mesa_id, mozo_id, personas, abierta_en)
SELECT DISTINCT ON (p.mesa_id) p.mesa_id, p.usuario_id, m.capacidad, p.created_at
FROM pedidos p
JOIN mesas m ON m.id = p.mesa_id
WHERE p.estado IN ('ENVIADO', 'EN_PREPARACION', 'LISTO')
ORDER BY p.mesa_id, p.created_at;

UPDATE pedidos p
SET atencion_id = a.id
FROM atenciones_mesa a
WHERE a.mesa_id = p.mesa_id
  AND a.liberada_en IS NULL
  AND p.estado IN ('ENVIADO', 'EN_PREPARACION', 'LISTO');
