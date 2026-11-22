package pe.isil.kds.model;

import jakarta.persistence.*;

/**
 * Configuración de cocina (HU033, decisión D41): una sola fila con la ventana, en segundos, para deshacer el
 * último cambio de estado de un ítem.
 */
@Entity
@Table(name = "configuracion_cocina")
public class ConfiguracionCocina {

    public static final short ID_UNICO = 1;
    public static final int VENTANA_RECALL_POR_DEFECTO = 30;
    public static final int VENTANA_RECALL_MINIMA = 5;
    public static final int VENTANA_RECALL_MAXIMA = 120;

    @Id
    private Short id = ID_UNICO;

    @Column(name = "ventana_recall_segundos", nullable = false)
    private Integer ventanaRecallSegundos = VENTANA_RECALL_POR_DEFECTO;

    public ConfiguracionCocina() {}

    public Short getId() { return id; }
    public void setId(Short id) { this.id = id; }

    public Integer getVentanaRecallSegundos() { return ventanaRecallSegundos; }
    public void setVentanaRecallSegundos(Integer ventanaRecallSegundos) { this.ventanaRecallSegundos = ventanaRecallSegundos; }
}
