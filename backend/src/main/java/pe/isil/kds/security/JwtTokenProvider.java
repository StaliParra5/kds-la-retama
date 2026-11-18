package pe.isil.kds.security;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.Date;
import java.util.List;

/**
 * Proveedor y Validador Criptográfico de Tokens JWT.
 * 
 * Estrategia de Ciberseguridad:
 * - Firma criptográfica HMAC-SHA256 con clave secreta robusta.
 * - Incluye claims de rol ("role") y usuarioId para autorizaciones sin consultas redundantes a BD en cada request.
 * - Validación defensiva de expiración, formato y alteración de firmas.
 */
@Component
public class JwtTokenProvider {

    private final SecretKey secretKey;
    private final long expirationMs;

    public JwtTokenProvider(
            @Value("${kds.security.jwt.secret}") String secret,
            @Value("${kds.security.jwt.expiration-ms}") long expirationMs) {
        // Asegura que la clave secreta tenga suficiente entropía para HMAC-SHA256 (mínimo 256 bits)
        byte[] keyBytes = secret.getBytes(StandardCharsets.UTF_8);
        this.secretKey = Keys.hmacShaKeyFor(keyBytes);
        this.expirationMs = expirationMs;
    }

    // Opcional para que las pruebas unitarias construyan el proveedor sin base de datos
    private VigenciaSesion vigenciaSesion;

    @org.springframework.beans.factory.annotation.Autowired(required = false)
    public void setVigenciaSesion(VigenciaSesion vigenciaSesion) {
        this.vigenciaSesion = vigenciaSesion;
    }

    public String generateToken(Long usuarioId, String username, String role) {
        return generateToken(usuarioId, username, role, null);
    }

    public String generateToken(Long usuarioId, String username, String role, Long estacionId) {
        return generateToken(usuarioId, username, role, estacionId, 0);
    }

    // versionSesion: versión vigente del usuario al emitir el token (HU042, revocación de sesiones)
    public String generateToken(Long usuarioId, String username, String role, Long estacionId, int versionSesion) {
        Date now = new Date();
        Date expiryDate = new Date(now.getTime() + expirationMs);

        return Jwts.builder()
                .subject(username)
                .claim("usuarioId", usuarioId)
                .claim("role", role)
                .claim("estacionId", estacionId)
                .claim("ver", versionSesion)
                .issuedAt(now)
                .expiration(expiryDate)
                .signWith(secretKey)
                .compact();
    }

    public boolean validateToken(String token) {
        try {
            Jwts.parser()
                    .verifyWith(secretKey)
                    .build()
                    .parseSignedClaims(token);
            return true;
        } catch (JwtException | IllegalArgumentException e) {
            // El token es inválido, manipulado o ha expirado
            return false;
        }
    }

    /**
     * Autenticación de Spring a partir de un token válido, con autoridad 'ROLE_<ROL>' y la
     * sesión KDS (rol y estación de la terminal) como detalles. Devuelve null si el token no es válido.
     * La usan tanto las peticiones HTTP como la conexión STOMP del WebSocket.
     */
    public UsernamePasswordAuthenticationToken autenticar(String token) {
        if (token == null || token.isBlank()) {
            return null;
        }
        Claims claims;
        try {
            // Una sola verificación de firma y expiración por petición
            claims = getClaims(token);
        } catch (JwtException | IllegalArgumentException e) {
            return null;
        }
        // HU042: un usuario desactivado, o con PIN o rol cambiados, pierde las sesiones ya abiertas
        Long usuarioId = claims.get("usuarioId") instanceof Number id ? id.longValue() : null;
        int versionSesion = claims.get("ver") instanceof Number v ? v.intValue() : 0;
        if (vigenciaSesion != null && !vigenciaSesion.vigente(usuarioId, versionSesion)) {
            return null;
        }
        String username = claims.getSubject();
        String role = claims.get("role", String.class);
        String roleName = role.startsWith("ROLE_") ? role : "ROLE_" + role;
        Long estacionId = claims.get("estacionId") instanceof Number n ? n.longValue() : null;
        UsernamePasswordAuthenticationToken authentication =
                new UsernamePasswordAuthenticationToken(username, null, List.of(new SimpleGrantedAuthority(roleName)));
        authentication.setDetails(new SesionKds(username, role, estacionId));
        return authentication;
    }

    public String getUsernameFromToken(String token) {
        Claims claims = getClaims(token);
        return claims.getSubject();
    }

    public String getRoleFromToken(String token) {
        Claims claims = getClaims(token);
        return claims.get("role", String.class);
    }

    public Long getEstacionIdFromToken(String token) {
        Object id = getClaims(token).get("estacionId");
        if (id instanceof Number number) {
            return number.longValue();
        }
        return null;
    }

    public Long getUsuarioIdFromToken(String token) {
        Claims claims = getClaims(token);
        Object id = claims.get("usuarioId");
        if (id instanceof Number number) {
            return number.longValue();
        }
        return null;
    }

    private Claims getClaims(String token) {
        return Jwts.parser()
                .verifyWith(secretKey)
                .build()
                .parseSignedClaims(token)
                .getPayload();
    }
}
