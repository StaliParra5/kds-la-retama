package pe.isil.kds.dto;

/**
 * DTO de un mozo para la gestión de personal de sala (HU042). Nunca expone el hash del PIN.
 */
public class MozoDto {

    private Long id;
    private String username;
    private String nombre;
    private String apellido;
    private Boolean activo;
    // HU042 Escenario 8: con pedidos o transiciones registradas no se elimina, solo se desactiva
    private boolean tieneHistorial;

    public MozoDto() {}

    public MozoDto(Long id, String username, String nombre, String apellido, Boolean activo, boolean tieneHistorial) {
        this.id = id;
        this.username = username;
        this.nombre = nombre;
        this.apellido = apellido;
        this.activo = activo;
        this.tieneHistorial = tieneHistorial;
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getUsername() { return username; }
    public void setUsername(String username) { this.username = username; }

    public String getNombre() { return nombre; }
    public void setNombre(String nombre) { this.nombre = nombre; }

    public String getApellido() { return apellido; }
    public void setApellido(String apellido) { this.apellido = apellido; }

    public Boolean getActivo() { return activo; }
    public void setActivo(Boolean activo) { this.activo = activo; }

    public boolean isTieneHistorial() { return tieneHistorial; }
    public void setTieneHistorial(boolean tieneHistorial) { this.tieneHistorial = tieneHistorial; }
}
