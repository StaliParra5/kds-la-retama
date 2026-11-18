-- ============================================================================
-- V1__init_schema.sql
-- Definición DDL del esquema relacional del Sistema KDS (La Retama Restaurante)
--
-- Consideraciones estratégicas:
-- 1. Restricciones UNIQUE a nivel de tupla para evitar duplicados en concurrencia (ej. mesa por zona).
-- 2. Índices especializados en 'pedidos' y 'detalles_pedido' optimizados para consultas de tiempo real.
-- 3. Tabla inmutable 'transiciones_estado' para auditoría estricta y analítica de tiempos en Sprint 4.
-- ============================================================================

-- 1. Roles del Sistema
CREATE TABLE IF NOT EXISTS roles (
    id BIGSERIAL PRIMARY KEY,
    codigo VARCHAR(30) NOT NULL UNIQUE,
    nombre VARCHAR(60) NOT NULL,
    descripcion VARCHAR(255)
);

-- 2. Usuarios y Personal del Restaurante
CREATE TABLE IF NOT EXISTS usuarios (
    id BIGSERIAL PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    password_hash VARCHAR(255),
    pin_hash VARCHAR(255),
    nombre VARCHAR(80) NOT NULL,
    apellido VARCHAR(80) NOT NULL,
    rol_id BIGINT NOT NULL REFERENCES roles(id),
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 3. Estaciones de Cocina
CREATE TABLE IF NOT EXISTS estaciones (
    id BIGSERIAL PRIMARY KEY,
    codigo VARCHAR(30) NOT NULL UNIQUE,
    nombre VARCHAR(80) NOT NULL,
    descripcion VARCHAR(255),
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 4. Zonas del Restaurante
CREATE TABLE IF NOT EXISTS zonas (
    id BIGSERIAL PRIMARY KEY,
    nombre VARCHAR(60) NOT NULL UNIQUE,
    descripcion VARCHAR(255),
    activo BOOLEAN NOT NULL DEFAULT TRUE
);

-- 5. Mesas por Zona (con restricción de unicidad por zona)
CREATE TABLE IF NOT EXISTS mesas (
    id BIGSERIAL PRIMARY KEY,
    zona_id BIGINT NOT NULL REFERENCES zonas(id) ON DELETE CASCADE,
    numero_mesa VARCHAR(20) NOT NULL,
    capacidad INT NOT NULL DEFAULT 4,
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    CONSTRAINT uq_zona_numero_mesa UNIQUE (zona_id, numero_mesa)
);

-- 6. Canales de Venta y SLAs
CREATE TABLE IF NOT EXISTS canales_venta (
    id BIGSERIAL PRIMARY KEY,
    codigo VARCHAR(30) NOT NULL UNIQUE,
    nombre VARCHAR(60) NOT NULL,
    sla_objetivo_minutos INT NOT NULL CHECK (sla_objetivo_minutos > 0),
    activo BOOLEAN NOT NULL DEFAULT TRUE
);

-- 7. Categorías de la Carta
CREATE TABLE IF NOT EXISTS categorias_plato (
    id BIGSERIAL PRIMARY KEY,
    nombre VARCHAR(60) NOT NULL UNIQUE,
    orden_visual INT NOT NULL DEFAULT 0,
    activo BOOLEAN NOT NULL DEFAULT TRUE
);

-- 8. Catálogo de Platos
CREATE TABLE IF NOT EXISTS platos (
    id BIGSERIAL PRIMARY KEY,
    categoria_id BIGINT NOT NULL REFERENCES categorias_plato(id),
    estacion_id BIGINT NOT NULL REFERENCES estaciones(id),
    nombre VARCHAR(120) NOT NULL,
    descripcion TEXT,
    precio NUMERIC(10, 2) NOT NULL CHECK (precio >= 0),
    tiempo_estandar_minutos INT NOT NULL CHECK (tiempo_estandar_minutos > 0),
    disponible BOOLEAN NOT NULL DEFAULT TRUE,
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 9. Pedidos / Comandas
CREATE TABLE IF NOT EXISTS pedidos (
    id BIGSERIAL PRIMARY KEY,
    codigo_correlativo VARCHAR(30) NOT NULL UNIQUE,
    canal_id BIGINT NOT NULL REFERENCES canales_venta(id),
    mesa_id BIGINT REFERENCES mesas(id),
    usuario_id BIGINT NOT NULL REFERENCES usuarios(id),
    cliente_nombre VARCHAR(120),
    cliente_telefono VARCHAR(30),
    cliente_direccion TEXT,
    estado VARCHAR(30) NOT NULL DEFAULT 'BORRADOR',
    total NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    observaciones TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fecha_envio_cocina TIMESTAMP,
    fecha_despacho TIMESTAMP
);

-- 10. Detalles de Pedido (Ítems enrutable por plato y estación)
CREATE TABLE IF NOT EXISTS detalles_pedido (
    id BIGSERIAL PRIMARY KEY,
    pedido_id BIGINT NOT NULL REFERENCES pedidos(id) ON DELETE CASCADE,
    plato_id BIGINT NOT NULL REFERENCES platos(id),
    estacion_id BIGINT NOT NULL REFERENCES estaciones(id),
    cantidad INT NOT NULL CHECK (cantidad > 0),
    precio_unitario NUMERIC(10, 2) NOT NULL,
    subtotal NUMERIC(10, 2) NOT NULL,
    modificadores TEXT,
    tiempo_estandar_minutos INT NOT NULL,
    estado_item VARCHAR(30) NOT NULL DEFAULT 'RECIBIDO',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 11. Trazabilidad inmutable de transiciones de estado
CREATE TABLE IF NOT EXISTS transiciones_estado (
    id BIGSERIAL PRIMARY KEY,
    detalle_pedido_id BIGINT REFERENCES detalles_pedido(id) ON DELETE CASCADE,
    pedido_id BIGINT NOT NULL REFERENCES pedidos(id) ON DELETE CASCADE,
    estado_origen VARCHAR(30),
    estado_destino VARCHAR(30) NOT NULL,
    usuario_id BIGINT REFERENCES usuarios(id),
    fecha_hora TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    motivo TEXT
);

-- Índices estratégicos para alto rendimiento en LAN
CREATE INDEX IF NOT EXISTS idx_platos_categoria ON platos(categoria_id);
CREATE INDEX IF NOT EXISTS idx_platos_estacion ON platos(estacion_id);
CREATE INDEX IF NOT EXISTS idx_platos_busqueda ON platos(nombre);
CREATE INDEX IF NOT EXISTS idx_pedidos_estado ON pedidos(estado);
CREATE INDEX IF NOT EXISTS idx_pedidos_canal ON pedidos(canal_id);
CREATE INDEX IF NOT EXISTS idx_detalles_estacion_estado ON detalles_pedido(estacion_id, estado_item);
CREATE INDEX IF NOT EXISTS idx_transiciones_pedido ON transiciones_estado(pedido_id);
