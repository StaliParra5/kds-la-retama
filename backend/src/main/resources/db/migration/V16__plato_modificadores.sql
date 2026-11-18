-- HU008 (RF-CAP-03): modificadores predefinidos por plato, administrables desde el catálogo.
-- Un plato sin filas aquí solo admite cantidad. 'orden' conserva la secuencia en que el administrador
-- los definió; no lleva unicidad por nombre en BD (se valida en el servicio) para que reordenar la lista
-- no choque con un índice único durante las actualizaciones fila a fila de Hibernate.
CREATE TABLE plato_modificadores (
    plato_id BIGINT      NOT NULL REFERENCES platos (id) ON DELETE CASCADE,
    orden    INTEGER     NOT NULL,
    nombre   VARCHAR(60) NOT NULL,
    PRIMARY KEY (plato_id, orden)
);

-- Modificadores iniciales de los platos de La Retama; si un plato fue renombrado o no existe, simplemente se omite.
INSERT INTO plato_modificadores (plato_id, orden, nombre)
SELECT p.id, m.orden, m.nombre
FROM (VALUES
    ('Lomo Saltado', 0, 'Sin cebolla'),
    ('Lomo Saltado', 1, 'Sin ají'),
    ('Lomo Saltado', 2, 'Sin papas fritas'),
    ('Lomo Saltado', 3, 'Término medio'),
    ('Lomo Saltado', 4, 'Bien cocido'),
    ('Tallarín Saltado Criollo', 0, 'Sin cebolla'),
    ('Tallarín Saltado Criollo', 1, 'Sin ají'),
    ('Tallarín Saltado Criollo', 2, 'Sin cebolla china'),
    ('Ceviche Clásico', 0, 'Sin ají'),
    ('Ceviche Clásico', 1, 'Poco picante'),
    ('Ceviche Clásico', 2, 'Sin cebolla'),
    ('Ceviche Clásico', 3, 'Sin camote'),
    ('Ceviche Clásico', 4, 'Sin choclo'),
    ('Anticuchos de Corazón', 0, 'Sin ají'),
    ('Anticuchos de Corazón', 1, 'Término medio'),
    ('Anticuchos de Corazón', 2, 'Bien cocido'),
    ('Hamburguesa Clásica La Retama', 0, 'Sin cebolla'),
    ('Hamburguesa Clásica La Retama', 1, 'Sin lechuga'),
    ('Hamburguesa Clásica La Retama', 2, 'Sin huevo'),
    ('Hamburguesa Clásica La Retama', 3, 'Sin queso'),
    ('Hamburguesa Clásica La Retama', 4, 'Término medio'),
    ('Hamburguesa Clásica La Retama', 5, 'Bien cocida'),
    ('Ají de Gallina', 0, 'Poco picante'),
    ('Ají de Gallina', 1, 'Sin nueces'),
    ('Ají de Gallina', 2, 'Sin huevo'),
    ('Causa Limeña', 0, 'Sin palta'),
    ('Causa Limeña', 1, 'Sin mayonesa'),
    ('Papa a la Huancaína', 0, 'Poco picante'),
    ('Papa a la Huancaína', 1, 'Sin aceituna'),
    ('Papa a la Huancaína', 2, 'Sin huevo'),
    ('Tequeños Criollos', 0, 'Sin guacamole'),
    ('Seco de Res con Frijoles', 0, 'Sin frijoles'),
    ('Seco de Res con Frijoles', 1, 'Poco picante'),
    ('Arroz con Mariscos', 0, 'Poco picante'),
    ('Arroz con Mariscos', 1, 'Sin pimiento'),
    ('Milanesa de Pollo', 0, 'Sin papas fritas'),
    ('Milanesa de Pollo', 1, 'Sin arroz'),
    ('Pollo a la Brasa (1/4)', 0, 'Sin ensalada'),
    ('Pollo a la Brasa (1/4)', 1, 'Sin papas fritas'),
    ('Pollo a la Brasa (1/4)', 2, 'Ají aparte'),
    ('Chicha Morada (Jarra 1L)', 0, 'Sin hielo'),
    ('Chicha Morada (Vaso)', 0, 'Sin hielo'),
    ('Limonada Frozen', 0, 'Poca azúcar'),
    ('Limonada Frozen', 1, 'Sin azúcar')
) AS m (plato, orden, nombre)
JOIN platos p ON p.nombre = m.plato;
