-- ============================================================================
-- V24__salon_semaforo_unico.sql
-- HU025 / HU047 (decisión D39): un solo semáforo para Salón
-- ============================================================================

-- Ámbar en minutos exactos para un canal. Solo lo usa Salón, cuyos tiempos se configuran en la pestaña Salón
-- (semáforo de mesas): así una mesa y las tarjetas de sus pedidos cambian de color en el mismo minuto.
-- Los demás canales lo dejan en NULL y siguen con el umbral ámbar en % del SLA.
ALTER TABLE canales_venta ADD COLUMN umbral_ambar_minutos INTEGER CHECK (umbral_ambar_minutos > 0);

-- Salón toma los minutos vigentes del semáforo de mesas: SLA = minutos de rojo, ámbar = minutos de amarillo
UPDATE canales_venta c
SET sla_objetivo_minutos = s.minutos_rojo,
    umbral_ambar_minutos = s.minutos_amarillo
FROM configuracion_semaforo s
WHERE c.codigo = 'SALON' AND s.id = 1;
