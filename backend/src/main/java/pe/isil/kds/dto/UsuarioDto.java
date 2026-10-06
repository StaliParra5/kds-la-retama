package pe.isil.kds.dto;

import java.time.LocalDateTime;

/**
 * DTO para exposición segura de usuarios del restaurante sin hashes criptográficos (HU002).
 */
public class UsuarioDto {

    private Long id;
    private String username;
    private String nombre;
    private String apellido;
    private Long rolId;
    private String rolCodigo;
    private String rolNombre;
    private Boolean tienePin;
    private Boolean activo;
    private LocalDateTime createdAt;

    public UsuarioDto() {}

    public UsuarioDto(Long id, String username, String nombre, String apellido,
                      Long rolId, String rolCodigo, String rolNombre,
                      Boolean tienePin, Boolean activo, LocalDateTime createdAt) {
        this.id = id;
        this.username = username;
        this.nombre = nombre;
        this.apellido = apellido;
        this.rolId = rolId;
        this.rolCodigo = rolCodigo;
        this.rolNombre = rolNombre;
        this.tienePin = tienePin;
        this.activo = activo;
        this.createdAt = createdAt;
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getUsername() { return username; }
    public void setUsername(String username) { this.username = username; }

    public String getNombre() { return nombre; }
    public void setNombre(String nombre) { this.nombre = nombre; }

    public String getApellido() { return apellido; }
    public void setApellido(String apellido) { this.apellido = apellido; }

    public Long getRolId() { return rolId; }
    public void setRolId(Long rolId) { this.rolId = rolId; }

    public String getRolCodigo() { return rolCodigo; }
    public void setRolCodigo(String rolCodigo) { this.rolCodigo = rolCodigo; }

    public String getRolNombre() { return rolNombre; }
    public void setRolNombre(String rolNombre) { this.rolNombre = rolNombre; }

    public Boolean getTienePin() { return tienePin; }
    public void setTienePin(Boolean tienePin) { this.tienePin = tienePin; }

    public Boolean getActivo() { return activo; }
    public void setActivo(Boolean activo) { this.activo = activo; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}
