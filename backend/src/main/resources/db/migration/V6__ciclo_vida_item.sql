-- ============================================================================
-- V6__ciclo_vida_item.sql
-- HU013 Ciclo de vida del ítem: estados válidos, bloqueo optimista y hora de disparo
-- ============================================================================

-- El estado BORRADOR desaparece: registrar una comanda equivale a enviarla (decisión D5)
UPDATE pedidos SET estado = 'ENVIADO' WHERE estado = 'BORRADOR';
UPDATE transiciones_estado SET estado_destino = 'ENVIADO' WHERE estado_destino = 'BORRADOR';
ALTER TABLE pedidos ALTER COLUMN estado SET DEFAULT 'ENVIADO';

ALTER TABLE pedidos
    ADD CONSTRAINT ck_pedidos_estado
    CHECK (estado IN ('ENVIADO', 'EN_PREPARACION', 'LISTO', 'DESPACHADO', 'ANULADO'));

ALTER TABLE detalles_pedido
    ADD CONSTRAINT ck_detalles_estado_item
    CHECK (estado_item IN ('RECIBIDO', 'EN_ESPERA', 'EN_PREPARACION', 'LISTO', 'DESPACHADO', 'ANULADO'));

-- Bloqueo optimista para cambios de estado simultáneos (HU013 Escenario 6)
ALTER TABLE detalles_pedido ADD COLUMN version BIGINT NOT NULL DEFAULT 0;

-- Hora programada de inicio; la asignará el motor de secuenciación (fuera del Sprint 2)
ALTER TABLE detalles_pedido ADD COLUMN hora_disparo TIMESTAMP;
