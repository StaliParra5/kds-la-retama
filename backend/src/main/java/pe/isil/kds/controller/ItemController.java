package pe.isil.kds.controller;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import pe.isil.kds.dto.CambiarEstadoItemRequest;
import pe.isil.kds.dto.ItemCocinaDto;
import pe.isil.kds.dto.TransicionDto;
import pe.isil.kds.exception.EstadoDesactualizadoException;
import pe.isil.kds.security.SesionKds;
import pe.isil.kds.service.CicloVidaItemService;
import pe.isil.kds.service.CocinaService;
import pe.isil.kds.service.TrazabilidadService;

import java.util.List;

/**
 * Controlador del ciclo de vida de ítems de pedido (HU013).
 */
@Tag(name = "Ítems de Pedido", description = "Cambios de estado de los ítems en cocina y pase")
@RestController
@RequestMapping("/api/v1/items")
public class ItemController {

    private final CicloVidaItemService cicloVidaItemService;
    private final TrazabilidadService trazabilidadService;
    private final CocinaService cocinaService;

    public ItemController(CicloVidaItemService cicloVidaItemService, TrazabilidadService trazabilidadService,
                          CocinaService cocinaService) {
        this.cicloVidaItemService = cicloVidaItemService;
        this.trazabilidadService = trazabilidadService;
        this.cocinaService = cocinaService;
    }

    @Operation(summary = "Ítems listos de todas las estaciones para el pase (D9, Expedidor/Admin)")
    @PreAuthorize("hasAnyRole('EXPEDIDOR', 'ADMIN')")
    @GetMapping("/listos")
    public ResponseEntity<List<ItemCocinaDto>> listos() {
        return ResponseEntity.ok(cocinaService.listosParaPase());
    }

    @Operation(summary = "Historial de transiciones de un ítem en orden cronológico (HU022, Admin)")
    @PreAuthorize("hasRole('ADMIN')")
    @GetMapping("/{id}/historial")
    public ResponseEntity<List<TransicionDto>> historial(@PathVariable Long id) {
        return ResponseEntity.ok(trazabilidadService.historialItem(id));
    }

    @Operation(summary = "Cambiar el estado de un ítem según el flujo definido (HU013)")
    @PreAuthorize("hasAnyRole('COCINERO', 'EXPEDIDOR', 'ADMIN')")
    @PatchMapping("/{id}/estado")
    public ResponseEntity<ItemCocinaDto> cambiarEstado(
            @PathVariable Long id,
            @Valid @RequestBody CambiarEstadoItemRequest request,
            Authentication authentication) {
        try {
            return ResponseEntity.ok(cicloVidaItemService.cambiarEstado(id, request, SesionKds.de(authentication)));
        } catch (ObjectOptimisticLockingFailureException e) {
            // HU013 Esc. 6: otra solicitud ganó la carrera; se responde con el estado vigente (lectura en transacción nueva)
            throw new EstadoDesactualizadoException(cicloVidaItemService.obtenerItem(id));
        }
    }
}
