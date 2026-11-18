package pe.isil.kds.controller;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import pe.isil.kds.dto.AbrirAtencionRequest;
import pe.isil.kds.dto.AtencionMesaDto;
import pe.isil.kds.dto.CambiarActivoRequest;
import pe.isil.kds.service.AtencionService;
import pe.isil.kds.dto.CrearMesaRequest;
import pe.isil.kds.dto.GuardarZonaRequest;
import pe.isil.kds.dto.MesaDto;
import pe.isil.kds.dto.ZonaDto;
import pe.isil.kds.security.SesionKds;
import pe.isil.kds.service.MesaService;
import pe.isil.kds.service.MozoService;
import org.springframework.security.core.Authentication;

import java.util.List;
import java.util.Set;

/**
 * Controlador de Zonas y Mesas de Salón (HU005, HU040, HU041).
 */
@Tag(name = "Zonas y Mesas", description = "Endpoints de distribución física de mesas para el mozo en sala")
@RestController
@RequestMapping("/api/v1")
public class MesaController {

    private final MesaService mesaService;
    private final MozoService mozoService;
    private final AtencionService atencionService;

    public MesaController(MesaService mesaService, MozoService mozoService, AtencionService atencionService) {
        this.mesaService = mesaService;
        this.mozoService = mozoService;
        this.atencionService = atencionService;
    }

    @Operation(summary = "Entrar a una mesa: abre su atención si está libre (exige personas) o devuelve la abierta (HU044)")
    @PreAuthorize("hasRole('MOZO')")
    @PostMapping("/mesas/{id}/atencion")
    public ResponseEntity<AtencionMesaDto> entrarAMesa(@PathVariable Long id,
                                                       @Valid @RequestBody AbrirAtencionRequest request,
                                                       Authentication authentication) {
        return ResponseEntity.ok(atencionService.entrar(id, request.getPersonas(), authentication.getName()));
    }

    @Operation(summary = "Consultar la atención abierta de una mesa con sus pedidos (HU044 Esc. 4)")
    @PreAuthorize("hasAnyRole('MOZO', 'ADMIN')")
    @GetMapping("/mesas/{id}/atencion")
    public ResponseEntity<AtencionMesaDto> consultarAtencion(@PathVariable Long id, Authentication authentication) {
        return ResponseEntity.ok(atencionService.consultar(id, SesionKds.de(authentication)));
    }

    @Operation(summary = "Liberar la mesa cuando el cliente se retira; exige que no queden ítems por despachar (HU046)")
    @PreAuthorize("hasRole('MOZO')")
    @PostMapping("/mesas/{id}/atencion/liberar")
    public ResponseEntity<AtencionMesaDto> liberarMesa(@PathVariable Long id, Authentication authentication) {
        return ResponseEntity.ok(atencionService.liberar(id, authentication.getName()));
    }

    // HU043: el mozo solo recibe sus zonas asignadas; el resto del personal ve todo el salón activo
    private Set<Long> zonasPermitidas(Authentication authentication) {
        SesionKds sesion = SesionKds.de(authentication);
        return sesion.tieneRol("MOZO") ? mozoService.idsZonasActivasDe(sesion.username()) : null;
    }

    @Operation(summary = "Listar zonas con sus mesas para el comandero (el mozo recibe solo sus zonas, HU043)")
    @GetMapping("/zonas")
    public ResponseEntity<List<ZonaDto>> listarZonasConMesas(Authentication authentication) {
        return ResponseEntity.ok(mesaService.listarZonasConMesas(zonasPermitidas(authentication)));
    }

    @Operation(summary = "Listar todas las zonas y mesas, incluidas las inactivas (Admin, HU040)")
    @PreAuthorize("hasRole('ADMIN')")
    @GetMapping("/zonas/todas")
    public ResponseEntity<List<ZonaDto>> listarZonasAdmin() {
        return ResponseEntity.ok(mesaService.listarZonasAdmin());
    }

    @Operation(summary = "Registrar una zona del salón (Admin, HU040)")
    @PreAuthorize("hasRole('ADMIN')")
    @PostMapping("/zonas")
    public ResponseEntity<ZonaDto> crearZona(@Valid @RequestBody GuardarZonaRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(mesaService.crearZona(request.getNombre(), request.getDescripcion()));
    }

    @Operation(summary = "Editar el nombre y la descripción de una zona (Admin, HU040)")
    @PreAuthorize("hasRole('ADMIN')")
    @PutMapping("/zonas/{id}")
    public ResponseEntity<ZonaDto> editarZona(@PathVariable Long id, @Valid @RequestBody GuardarZonaRequest request) {
        return ResponseEntity.ok(mesaService.editarZona(id, request.getNombre(), request.getDescripcion()));
    }

    @Operation(summary = "Desactivar o reactivar una zona (Admin, HU040)")
    @PreAuthorize("hasRole('ADMIN')")
    @PatchMapping("/zonas/{id}/estado")
    public ResponseEntity<ZonaDto> cambiarEstadoZona(@PathVariable Long id, @Valid @RequestBody CambiarActivoRequest request) {
        return ResponseEntity.ok(mesaService.cambiarEstadoZona(id, request.getActivo()));
    }

    @Operation(summary = "Listar las mesas activas (el mozo recibe solo las de sus zonas, HU043)")
    @GetMapping("/mesas")
    public ResponseEntity<List<MesaDto>> listarMesas(Authentication authentication) {
        return ResponseEntity.ok(mesaService.listarMesas(zonasPermitidas(authentication)));
    }

    @Operation(summary = "Registrar nueva mesa en una zona (Admin)")
    @PreAuthorize("hasRole('ADMIN')")
    @PostMapping("/mesas")
    public ResponseEntity<MesaDto> crearMesa(@Valid @RequestBody CrearMesaRequest request) {
        MesaDto creada = mesaService.crearMesa(request.getZonaId(), request.getNumeroMesa(), request.getCapacidad());
        return ResponseEntity.status(HttpStatus.CREATED).body(creada);
    }

    // Los datos editables de una mesa son los mismos que al crearla: zona, número y capacidad
    @Operation(summary = "Editar el número, la capacidad o la zona de una mesa (Admin, HU041)")
    @PreAuthorize("hasRole('ADMIN')")
    @PutMapping("/mesas/{id}")
    public ResponseEntity<MesaDto> editarMesa(@PathVariable Long id, @Valid @RequestBody CrearMesaRequest request) {
        return ResponseEntity.ok(mesaService.editarMesa(id, request.getZonaId(), request.getNumeroMesa(), request.getCapacidad()));
    }

    @Operation(summary = "Desactivar o reactivar una mesa (Admin, HU041)")
    @PreAuthorize("hasRole('ADMIN')")
    @PatchMapping("/mesas/{id}/estado")
    public ResponseEntity<MesaDto> cambiarEstadoMesa(@PathVariable Long id, @Valid @RequestBody CambiarActivoRequest request) {
        return ResponseEntity.ok(mesaService.cambiarEstadoMesa(id, request.getActivo()));
    }
}
