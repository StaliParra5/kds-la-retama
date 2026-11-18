package pe.isil.kds.security;

import org.springframework.security.core.Authentication;

/**
 * Datos de la sesión autenticada extraídos del JWT: usuario, rol y estación vinculada
 * a la terminal en el login por PIN (decisión D6 del Sprint 2).
 */
public record SesionKds(String username, String rol, Long estacionId) {

    public static SesionKds de(Authentication authentication) {
        if (authentication.getDetails() instanceof SesionKds sesion) {
            return sesion;
        }
        String rol = authentication.getAuthorities().stream()
                .map(a -> a.getAuthority().replaceFirst("^ROLE_", ""))
                .findFirst()
                .orElse("");
        return new SesionKds(authentication.getName(), rol, null);
    }

    public boolean tieneRol(String... roles) {
        for (String r : roles) {
            if (r.equalsIgnoreCase(rol)) {
                return true;
            }
        }
        return false;
    }
}
