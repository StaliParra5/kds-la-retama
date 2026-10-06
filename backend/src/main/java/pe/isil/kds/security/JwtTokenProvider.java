package pe.isil.kds.security;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.Date;

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

    public String generateToken(Long usuarioId, String username, String role) {
        Date now = new Date();
        Date expiryDate = new Date(now.getTime() + expirationMs);

        return Jwts.builder()
                .subject(username)
                .claim("usuarioId", usuarioId)
                .claim("role", role)
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

    public String getUsernameFromToken(String token) {
        Claims claims = getClaims(token);
        return claims.getSubject();
    }

    public String getRoleFromToken(String token) {
        Claims claims = getClaims(token);
        return claims.get("role", String.class);
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
