-- ============================================================================
-- V18__pedidos_externos.sql
-- HU019 y HU020: pedidos de canales externos (agregadores como Rappi, WhatsApp y teléfono por el
-- registro manual del expedidor) que entran a la misma cola que los del comandero
-- ============================================================================

-- Un canal "externo" es un agregador: sus pedidos no se toman desde el comandero y exigen el número de
-- orden con el que el agregador identifica el pedido. Los canales existentes quedan como propios.
ALTER TABLE canales_venta ADD COLUMN externo BOOLEAN NOT NULL DEFAULT FALSE;

INSERT INTO canales_venta (codigo, nombre, sla_objetivo_minutos, activo, externo)
VALUES ('RAPPI', 'Rappi', 30, TRUE, TRUE)
ON CONFLICT (codigo) DO NOTHING;

-- Número de orden del pedido en el canal de origen (por ejemplo, el de Rappi); se muestra en la tarjeta.
-- El índice parcial deja listo el cruce por canal y número que usará la detección de duplicados (HU034).
ALTER TABLE pedidos ADD COLUMN numero_orden_externo VARCHAR(60);
CREATE INDEX idx_pedidos_orden_externo ON pedidos (canal_id, numero_orden_externo)
    WHERE numero_orden_externo IS NOT NULL;

-- Cuenta de servicio a nombre de la cual se registran los pedidos que llegan por el punto de integración.
-- Inactiva y sin contraseña ni PIN: no puede iniciar sesión; solo figura como autora en el historial.
INSERT INTO usuarios (username, password_hash, pin_hash, nombre, apellido, rol_id, activo)
VALUES ('integracion', NULL, NULL, 'Integración', 'Externa', (SELECT id FROM roles WHERE codigo = 'EXPEDIDOR'), FALSE)
ON CONFLICT (username) DO NOTHING;
