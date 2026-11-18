-- HU040 Escenario 2 y HU041 Escenario 2: el nombre de zona y el número de mesa por zona
-- son únicos sin distinguir mayúsculas. La aplicación valida antes de guardar; estos índices
-- cubren dos registros simultáneos ("b1" y "B1") que pasarían la validación a la vez.
CREATE UNIQUE INDEX uq_zonas_nombre_ci ON zonas (lower(nombre));
CREATE UNIQUE INDEX uq_mesas_zona_numero_ci ON mesas (zona_id, lower(numero_mesa));
