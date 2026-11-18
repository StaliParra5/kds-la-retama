package pe.isil.kds.model;

import jakarta.persistence.*;

/**
 * Configuración del semáforo de mesas (HU047, decisión D21): una sola fila con los minutos
 * de espera a partir de los cuales una mesa pasa a amarillo y a rojo.
 */
@Entity
@Table(name = "configuracion_semaforo")
public class ConfiguracionSemaforo {

    public static final short ID_UNICO = 1;
    public static final int AMARILLO_POR_DEFECTO = 20;
    public static final int ROJO_POR_DEFECTO = 30;

    @Id
    private Short id = ID_UNICO;

    @Column(name = "minutos_amarillo", nullable = false)
    private Integer minutosAmarillo = AMARILLO_POR_DEFECTO;

    @Column(name = "minutos_rojo", nullable = false)
    private Integer minutosRojo = ROJO_POR_DEFECTO;

    public ConfiguracionSemaforo() {}

    public Short getId() { return id; }
    public void setId(Short id) { this.id = id; }

    public Integer getMinutosAmarillo() { return minutosAmarillo; }
    public void setMinutosAmarillo(Integer minutosAmarillo) { this.minutosAmarillo = minutosAmarillo; }

    public Integer getMinutosRojo() { return minutosRojo; }
    public void setMinutosRojo(Integer minutosRojo) { this.minutosRojo = minutosRojo; }
}
