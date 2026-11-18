package pe.isil.kds.dto;

public class AuthResponse {

    private String token;
    private Long usuarioId;
    private String username;
    private String nombreCompleto;
    private String rol;
    private Long estacionId;
    private String estacionNombre;

    public AuthResponse() {}

    public AuthResponse(String token, Long usuarioId, String username, String nombreCompleto, String rol, Long estacionId, String estacionNombre) {
        this.token = token;
        this.usuarioId = usuarioId;
        this.username = username;
        this.nombreCompleto = nombreCompleto;
        this.rol = rol;
        this.estacionId = estacionId;
        this.estacionNombre = estacionNombre;
    }

    public String getToken() { return token; }
    public void setToken(String token) { this.token = token; }

    public Long getUsuarioId() { return usuarioId; }
    public void setUsuarioId(Long usuarioId) { this.usuarioId = usuarioId; }

    public String getUsername() { return username; }
    public void setUsername(String username) { this.username = username; }

    public String getNombreCompleto() { return nombreCompleto; }
    public void setNombreCompleto(String nombreCompleto) { this.nombreCompleto = nombreCompleto; }

    public String getRol() { return rol; }
    public void setRol(String rol) { this.rol = rol; }

    public Long getEstacionId() { return estacionId; }
    public void setEstacionId(Long estacionId) { this.estacionId = estacionId; }

    public String getEstacionNombre() { return estacionNombre; }
    public void setEstacionNombre(String estacionNombre) { this.estacionNombre = estacionNombre; }
}
