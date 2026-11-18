-- ============================================================================
-- V2__seed_retama_data.sql
-- Datos semilla iniciales del restaurante 'La Retama' (Jesús María, Lima)
--
-- Contiene:
-- 1. Roles y usuarios base con credenciales BCrypt (admin123 / PIN 1234).
-- 2. Estaciones operativas de cocina para enrutamiento.
-- 3. Zonas y mesas del salón.
-- 4. Canales de venta y sus SLAs comprometidos.
-- 5. Categorías y catálogo de más de 20 platos tradicionales peruanos con tiempos estándar.
-- ============================================================================

-- 1. Roles
INSERT INTO roles (codigo, nombre, descripcion) VALUES
('ADMIN', 'Administrador', 'Configuración de catálogo, usuarios, estaciones y visualización de reportes'),
('MOZO', 'Personal de Sala', 'Apertura y armado de comandas desde terminales de sala'),
('COCINERO', 'Personal de Cocina', 'Preparación de platos y cambio de estados en pantalla de estación'),
('EXPEDIDOR', 'Control de Pase', 'Inspección de completitud de pedidos y confirmación de despacho')
ON CONFLICT (codigo) DO NOTHING;

-- 2. Usuarios
-- Hashes generados con BCrypt:
-- admin123 -> $2a$10$0XEsYfXK3sj8lwrJYq0VH.zYMbN4mTXhWHevCSXozL6QcVY0oUe3e
-- 1234     -> $2a$10$PTxXLk4t0Ml0uC6NtCAVc.GF5cjChTRatYOGbdlPZEnpuZ8LwKHne
INSERT INTO usuarios (username, password_hash, pin_hash, nombre, apellido, rol_id, activo) VALUES
('admin', '$2a$10$0XEsYfXK3sj8lwrJYq0VH.zYMbN4mTXhWHevCSXozL6QcVY0oUe3e', NULL, 'Administrador', 'Sistema', (SELECT id FROM roles WHERE codigo = 'ADMIN'), TRUE),
('angie', '$2a$10$PTxXLk4t0Ml0uC6NtCAVc.GF5cjChTRatYOGbdlPZEnpuZ8LwKHne', '$2a$10$PTxXLk4t0Ml0uC6NtCAVc.GF5cjChTRatYOGbdlPZEnpuZ8LwKHne', 'Angie', 'Valencia', (SELECT id FROM roles WHERE codigo = 'MOZO'), TRUE),
('cocinero1', NULL, '$2a$10$PTxXLk4t0Ml0uC6NtCAVc.GF5cjChTRatYOGbdlPZEnpuZ8LwKHne', 'Carlos', 'Castilla', (SELECT id FROM roles WHERE codigo = 'COCINERO'), TRUE),
('expedidor1', '$2a$10$PTxXLk4t0Ml0uC6NtCAVc.GF5cjChTRatYOGbdlPZEnpuZ8LwKHne', NULL, 'Jorge', 'Guerra', (SELECT id FROM roles WHERE codigo = 'EXPEDIDOR'), TRUE)
ON CONFLICT (username) DO NOTHING;

-- 3. Estaciones de Cocina
INSERT INTO estaciones (codigo, nombre, descripcion, activo) VALUES
('PLANCHA', 'Plancha', 'Platos salteados al wok, lomos, hamburguesas y carnes', TRUE),
('FRIOS', 'Fríos', 'Ceviches, causas, ensaladas y postres fríos', TRUE),
('CALIENTES', 'Calientes', 'Guisos tradicionales, arroces, frituras y caldos', TRUE),
('BEBIDAS', 'Bebidas', 'Chichas, jugos, refrescos naturales y licores', TRUE),
('HORNO', 'Horno', 'Pollos a la brasa y asados', TRUE)
ON CONFLICT (codigo) DO NOTHING;

-- 4. Zonas
INSERT INTO zonas (nombre, descripcion, activo) VALUES
('Salón Principal', 'Zona central climatizada para comensales de salón', TRUE),
('Terraza', 'Zona al aire libre con vista a los jardines', TRUE),
('Barra', 'Área de atención rápida en barra', TRUE)
ON CONFLICT (nombre) DO NOTHING;

-- 5. Mesas
-- Salón Principal (Mesas 01 a 12)
INSERT INTO mesas (zona_id, numero_mesa, capacidad, activo)
SELECT z.id, LPAD(s.n::text, 2, '0'), 4, TRUE
FROM zonas z, generate_series(1, 12) s(n)
WHERE z.nombre = 'Salón Principal'
ON CONFLICT (zona_id, numero_mesa) DO NOTHING;

-- Terraza (Mesas 13 a 20)
INSERT INTO mesas (zona_id, numero_mesa, capacidad, activo)
SELECT z.id, s.n::text, 4, TRUE
FROM zonas z, generate_series(13, 20) s(n)
WHERE z.nombre = 'Terraza'
ON CONFLICT (zona_id, numero_mesa) DO NOTHING;

-- Barra (Mesas B1 a B4)
INSERT INTO mesas (zona_id, numero_mesa, capacidad, activo)
SELECT z.id, 'B' || s.n::text, 2, TRUE
FROM zonas z, generate_series(1, 4) s(n)
WHERE z.nombre = 'Barra'
ON CONFLICT (zona_id, numero_mesa) DO NOTHING;

-- 6. Canales de Venta y SLAs
INSERT INTO canales_venta (codigo, nombre, sla_objetivo_minutos, activo) VALUES
('SALON', 'Salón', 15, TRUE),
('PARA_LLEVAR', 'Para Llevar', 15, TRUE),
('DELIVERY', 'Delivery', 30, TRUE)
ON CONFLICT (codigo) DO NOTHING;

-- 7. Categorías de Platos
INSERT INTO categorias_plato (nombre, orden_visual, activo) VALUES
('Entradas', 1, TRUE),
('Fondos', 2, TRUE),
('Bebidas', 3, TRUE),
('Postres', 4, TRUE)
ON CONFLICT (nombre) DO NOTHING;

-- 8. Platos Tradicionales de La Retama
INSERT INTO platos (categoria_id, estacion_id, nombre, descripcion, precio, tiempo_estandar_minutos, disponible, activo) VALUES
-- Entradas
((SELECT id FROM categorias_plato WHERE nombre = 'Entradas'), (SELECT id FROM estaciones WHERE codigo = 'FRIOS'), 'Causa Limeña', 'Masa suave de papa amarilla rellena de pollo deshilachado con mayonesa y palta', 16.00, 6, TRUE, TRUE),
((SELECT id FROM categorias_plato WHERE nombre = 'Entradas'), (SELECT id FROM estaciones WHERE codigo = 'FRIOS'), 'Papa a la Huancaína', 'Papas sancochadas bañadas en cremosa salsa huancaína tradicional con huevo y aceituna', 14.00, 5, TRUE, TRUE),
((SELECT id FROM categorias_plato WHERE nombre = 'Entradas'), (SELECT id FROM estaciones WHERE codigo = 'CALIENTES'), 'Tequeños Criollos', 'Crujientes tequeños de queso andino servidos con abundante guacamole fresco', 15.00, 8, TRUE, TRUE),
((SELECT id FROM categorias_plato WHERE nombre = 'Entradas'), (SELECT id FROM estaciones WHERE codigo = 'FRIOS'), 'Ceviche Clásico', 'Pesca del día marinada al momento en jugo de limón, ají limo, camote y choclo desgranado', 28.00, 8, TRUE, TRUE),
((SELECT id FROM categorias_plato WHERE nombre = 'Entradas'), (SELECT id FROM estaciones WHERE codigo = 'PLANCHA'), 'Anticuchos de Corazón', 'Dos brochetas tiernas maceradas en ají panca y especias con papas doradas y choclo', 22.00, 10, TRUE, TRUE),

-- Fondos
((SELECT id FROM categorias_plato WHERE nombre = 'Fondos'), (SELECT id FROM estaciones WHERE codigo = 'PLANCHA'), 'Lomo Saltado', 'Trozos selectos de lomo fino salteados al wok con cebolla, tomate, ají amarillo, papas fritas y arroz', 32.00, 12, TRUE, TRUE),
((SELECT id FROM categorias_plato WHERE nombre = 'Fondos'), (SELECT id FROM estaciones WHERE codigo = 'HORNO'), 'Pollo a la Brasa (1/4)', 'Cuarto de pollo marinado en receta secreta con papas fritas crocantes y ensalada fresca', 22.00, 8, TRUE, TRUE),
((SELECT id FROM categorias_plato WHERE nombre = 'Fondos'), (SELECT id FROM estaciones WHERE codigo = 'CALIENTES'), 'Ají de Gallina', 'Cremoso guiso de pechuga deshilachada en crema de ají amarillo, nueces, huevo y arroz', 26.00, 10, TRUE, TRUE),
((SELECT id FROM categorias_plato WHERE nombre = 'Fondos'), (SELECT id FROM estaciones WHERE codigo = 'CALIENTES'), 'Arroz con Mariscos', 'Arroz meloso criollo con mixtura selecta de mariscos, pimientos y toque de chicha de jora', 34.00, 14, TRUE, TRUE),
((SELECT id FROM categorias_plato WHERE nombre = 'Fondos'), (SELECT id FROM estaciones WHERE codigo = 'CALIENTES'), 'Seco de Res con Frijoles', 'Guiso tierno de asado de tira en aderezo de culantro y chicha acompañado de frijoles canarios', 30.00, 12, TRUE, TRUE),
((SELECT id FROM categorias_plato WHERE nombre = 'Fondos'), (SELECT id FROM estaciones WHERE codigo = 'PLANCHA'), 'Tallarín Saltado Criollo', 'Fideos criollos salteados a fuego vivo con lomo, verduras crocantes y cebolla china', 28.00, 11, TRUE, TRUE),
((SELECT id FROM categorias_plato WHERE nombre = 'Fondos'), (SELECT id FROM estaciones WHERE codigo = 'PLANCHA'), 'Hamburguesa Clásica La Retama', 'Carne artesanal de 180g a la plancha con queso, huevo frito, lechuga y papas fritas', 20.00, 9, TRUE, TRUE),
((SELECT id FROM categorias_plato WHERE nombre = 'Fondos'), (SELECT id FROM estaciones WHERE codigo = 'CALIENTES'), 'Milanesa de Pollo', 'Pechuga empanizada dorada con papas fritas y arroz blanco', 24.00, 10, TRUE, TRUE),

-- Bebidas
((SELECT id FROM categorias_plato WHERE nombre = 'Bebidas'), (SELECT id FROM estaciones WHERE codigo = 'BEBIDAS'), 'Chicha Morada (Jarra 1L)', 'Elaborada naturalmente con maíz morado, piña, manzana, canela y clavo', 14.00, 2, TRUE, TRUE),
((SELECT id FROM categorias_plato WHERE nombre = 'Bebidas'), (SELECT id FROM estaciones WHERE codigo = 'BEBIDAS'), 'Chicha Morada (Vaso)', 'Vaso de chicha morada natural refrescante', 5.00, 1, TRUE, TRUE),
((SELECT id FROM categorias_plato WHERE nombre = 'Bebidas'), (SELECT id FROM estaciones WHERE codigo = 'BEBIDAS'), 'Limonada Frozen', 'Zumo de limón recién exprimido batido con hielo frappé', 8.00, 3, TRUE, TRUE),
((SELECT id FROM categorias_plato WHERE nombre = 'Bebidas'), (SELECT id FROM estaciones WHERE codigo = 'BEBIDAS'), 'Inca Kola 500ml', 'Bebida gaseosa helada', 6.00, 1, TRUE, TRUE),
((SELECT id FROM categorias_plato WHERE nombre = 'Bebidas'), (SELECT id FROM estaciones WHERE codigo = 'BEBIDAS'), 'Cerveza Cusqueña Trigo', 'Cerveza rubia helada 330ml', 10.00, 1, TRUE, TRUE),

-- Postres
((SELECT id FROM categorias_plato WHERE nombre = 'Postres'), (SELECT id FROM estaciones WHERE codigo = 'FRIOS'), 'Suspiro a la Limeña', 'Manjar blanco de yemas coronado con merengue al oporto y canela', 12.00, 2, TRUE, TRUE),
((SELECT id FROM categorias_plato WHERE nombre = 'Postres'), (SELECT id FROM estaciones WHERE codigo = 'FRIOS'), 'Crema Volteada', 'Clásico postre de leche asada con caramelo rubio', 11.00, 2, TRUE, TRUE),
((SELECT id FROM categorias_plato WHERE nombre = 'Postres'), (SELECT id FROM estaciones WHERE codigo = 'CALIENTES'), 'Mazamorra Morada Criolla', 'Tradicional mazamorra limeña con guindones y canela en polvo', 10.00, 3, TRUE, TRUE);
