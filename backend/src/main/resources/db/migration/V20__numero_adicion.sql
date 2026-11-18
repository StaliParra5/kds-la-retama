-- ============================================================================
-- V20__numero_adicion.sql
-- HU021 Esc. 4 (y HU031): identificar en la tarjeta los ítems agregados a una mesa después del primer envío
-- ============================================================================

-- Con la atención de mesa (HU044), cada comanda que el mozo agrega a una mesa abierta es un pedido nuevo de la
-- misma atención. numero_adicion = 0 es la comanda original; 1, 2... las adiciones en el orden en que se enviaron.
-- Los pedidos sin atención (para llevar, delivery, externos) siempre son 0.
ALTER TABLE pedidos ADD COLUMN numero_adicion INTEGER NOT NULL DEFAULT 0;

-- Numera las comandas que ya existían dentro de cada atención por orden de creación
UPDATE pedidos p
SET numero_adicion = orden.posicion - 1
FROM (
    SELECT id, ROW_NUMBER() OVER (PARTITION BY atencion_id ORDER BY created_at, id) AS posicion
    FROM pedidos
    WHERE atencion_id IS NOT NULL
) AS orden
WHERE p.id = orden.id;
