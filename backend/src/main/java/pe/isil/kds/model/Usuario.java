package pe.isil.kds.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import java.time.LocalDateTime;

/**
 * Entidad Usuario: Representa al empleado del restaurante (Mozo, Cocinero, Administrador, Expedidor).
 * 
 * Consideraciones de Ciberseguridad:
 * - Los campos passwordHash y pinHash se ignoran en serialización JSON (@JsonIgnore)
 *   para garantizar que nunca viajen en las respuestas HTTP a los clientes.
 * - Soporta tanto contraseña para roles administrativos como PIN de 4 dígitos para agilidad operativa en cocina.
 */
@Entity
@Table(name = "usuarios")
public class Usuario {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 50)
    private String username;

    @JsonIgnore
    @Column(name = "password_hash")
    private String passwordHash;

    @JsonIgnore
    @Column(name = "pin_hash")
    private String pinHash;

    @Column(nullable = false, length = 80)
    private String nombre;

    @Column(nullable = false, length = 80)
    private String apellido;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "rol_id", nullable = false)
    private Rol rol;

    @Column(nullable = false)
    private Boolean activo = true;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    // Versión que viaja en el token: al cambiar, los tokens emitidos antes dejan de autenticar (HU042)
    @Column(name = "version_sesion", nullable = false)
    private Integer versionSesion = 0;

    // HU043: zonas que atiende el mozo; fuera de ellas no ve ni registra pedidos de mesa
    @JsonIgnore
    @ManyToMany(fetch = FetchType.LAZY)
    @JoinTable(name = "mozo_zonas",
            joinColumns = @JoinColumn(name = "usuario_id"),
            inverseJoinColumns = @JoinColumn(name = "zona_id"))
    private java.util.Set<Zona> zonas = new java.util.HashSet<>();

    public Usuario() {}

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getUsername() { return username; }
    public void setUsername(String username) { this.username = username; }

    public String getPasswordHash() { return passwordHash; }
    public void setPasswordHash(String passwordHash) { this.passwordHash = passwordHash; }

    public String getPinHash() { return pinHash; }
    public void setPinHash(String pinHash) { this.pinHash = pinHash; }

    public String getNombre() { return nombre; }
    public void setNombre(String nombre) { this.nombre = nombre; }

    public String getApellido() { return apellido; }
    public void setApellido(String apellido) { this.apellido = apellido; }

    public Rol getRol() { return rol; }
    public void setRol(Rol rol) { this.rol = rol; }

    public Boolean getActivo() { return activo; }
    public void setActivo(Boolean activo) { this.activo = activo; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }

    public java.util.Set<Zona> getZonas() { return zonas; }
    public void setZonas(java.util.Set<Zona> zonas) { this.zonas = zonas; }

    // Nombre para mostrar en pantallas, acuses y mensajes
    public String getNombreCompleto() { return nombre + " " + apellido; }

    public Integer getVersionSesion() { return versionSesion; }
    public void setVersionSesion(Integer versionSesion) { this.versionSesion = versionSesion; }

    /**
     * Invalida los tokens ya emitidos (desactivación, cambio de PIN o de rol): los tokens nuevos
     * llevarán la versión siguiente.
     */
    public void revocarSesiones() {
        this.versionSesion = (versionSesion == null ? 0 : versionSesion) + 1;
    }
}
