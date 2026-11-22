-- ============================================================================
-- V25__recall.sql
-- HU033: deshacer el último cambio de estado de un ítem dentro de una ventana configurable
-- ============================================================================

-- Configuración de cocina: una sola fila. Ventana para deshacer, en segundos (decisión D41: 30 por defecto,
-- entre 5 y 120). La edita el administrador en Administración > Estaciones.
CREATE TABLE configuracion_cocina (
    id                      SMALLINT PRIMARY KEY CHECK (id = 1),
    ventana_recall_segundos INTEGER  NOT NULL DEFAULT 30 CHECK (ventana_recall_segundos BETWEEN 5 AND 120)
);
INSERT INTO configuracion_cocina (id, ventana_recall_segundos) VALUES (1, 30);

-- Último cambio de cocina del ítem que todavía se puede deshacer: el estado al que vuelve y cuándo ocurrió.
-- Se llenan al iniciar o marcar listo y se vacían al deshacer o al despachar, así solo se revierte el último
-- cambio y nunca un recall ni un despacho.
ALTER TABLE detalles_pedido ADD COLUMN estado_previo VARCHAR(30);
ALTER TABLE detalles_pedido ADD COLUMN ultimo_cambio_en TIMESTAMP;
