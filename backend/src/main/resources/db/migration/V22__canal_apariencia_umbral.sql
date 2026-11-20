-- ============================================================================
-- V22__canal_apariencia_umbral.sql
-- HU015: color e ícono de cada canal para reconocerlo en la tarjeta sin leer texto
-- HU025 (y HU037 Esc. 1 y 3): umbral ámbar del semáforo configurable por canal
-- ============================================================================

-- color: hexadecimal #RRGGBB. icono: nombre de un ícono de Material Symbols.
-- Las reglas de color (no parecido al semáforo ni a otro canal activo, legible con texto blanco) se validan
-- en el servicio, porque dependen de los demás canales.
ALTER TABLE canales_venta ADD COLUMN color VARCHAR(7);
ALTER TABLE canales_venta ADD COLUMN icono VARCHAR(40);

-- Porcentaje del SLA en el que el pedido pasa de verde a ámbar; al llegar al 100 % pasa a rojo.
-- 75 conserva el comportamiento que ya tenían los canales existentes.
ALTER TABLE canales_venta ADD COLUMN umbral_ambar_porcentaje INTEGER NOT NULL DEFAULT 75
    CHECK (umbral_ambar_porcentaje BETWEEN 1 AND 99);

-- Apariencia inicial aprobada por el equipo (D37). Para llevar usa cian: un naranja legible queda demasiado
-- cerca del rojo del semáforo. Rappi usa un ícono genérico de repartidor, no el logo de la marca.
UPDATE canales_venta SET color = '#1d4ed8', icono = 'table_restaurant' WHERE codigo = 'SALON';
UPDATE canales_venta SET color = '#0e7490', icono = 'shopping_bag'     WHERE codigo = 'PARA_LLEVAR';
UPDATE canales_venta SET color = '#7e22ce', icono = 'two_wheeler'      WHERE codigo = 'DELIVERY';
UPDATE canales_venta SET color = '#db2777', icono = 'delivery_dining'  WHERE codigo = 'RAPPI';
