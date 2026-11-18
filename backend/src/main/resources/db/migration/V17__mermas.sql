-- ============================================================================
-- V17__mermas.sql
-- HU032 (D10, D12): mermas por anulación de ítems ya iniciados, consultables por rango de fechas
-- ============================================================================

-- Una fila por ítem anulado que ya estaba En preparación o Listo (comida que se perdió).
-- Los nombres se copian como foto del momento: el reporte no depende de ediciones posteriores del
-- catálogo ni necesita joins (sin consultas N+1). El UNIQUE sobre el ítem impide registrar dos veces
-- la misma merma si dos anulaciones llegaran a cruzarse.
CREATE TABLE mermas (
    id                 BIGSERIAL PRIMARY KEY,
    detalle_pedido_id  BIGINT         NOT NULL UNIQUE REFERENCES detalles_pedido (id),
    pedido_id          BIGINT         NOT NULL REFERENCES pedidos (id),
    codigo_pedido      VARCHAR(30)    NOT NULL,
    plato_nombre       VARCHAR(255)   NOT NULL,
    estacion_id        BIGINT         NOT NULL REFERENCES estaciones (id),
    estacion_nombre    VARCHAR(255)   NOT NULL,
    cantidad           INTEGER        NOT NULL CHECK (cantidad > 0),
    monto              NUMERIC(10, 2) NOT NULL,
    estado_al_anular   VARCHAR(30)    NOT NULL CHECK (estado_al_anular IN ('EN_PREPARACION', 'LISTO')),
    motivo             VARCHAR(40)    NOT NULL CHECK (motivo IN (
        'ERROR_DIGITACION', 'CLIENTE_CAMBIO_OPINION', 'CLIENTE_SE_RETIRO',
        'DEMORA_EXCESIVA', 'PLATO_CON_DEFECTO', 'OTRO')),
    responsable_id     BIGINT         NOT NULL REFERENCES usuarios (id),
    responsable_nombre VARCHAR(255)   NOT NULL,
    created_at         TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- La consulta filtra siempre por rango de fechas
CREATE INDEX idx_mermas_created_at ON mermas (created_at);
