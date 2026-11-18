-- HU047 (decisión D21): minutos de espera que cambian el color de una mesa en la vista de salón.
-- Una sola fila de configuración; por defecto amarillo a los 20 minutos y rojo a los 30.
CREATE TABLE configuracion_semaforo (
    id               SMALLINT PRIMARY KEY CHECK (id = 1),
    minutos_amarillo INTEGER  NOT NULL CHECK (minutos_amarillo > 0),
    minutos_rojo     INTEGER  NOT NULL,
    CHECK (minutos_rojo > minutos_amarillo)
);

INSERT INTO configuracion_semaforo (id, minutos_amarillo, minutos_rojo) VALUES (1, 20, 30);
