package pe.isil.kds.controller;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import pe.isil.kds.dto.AnularItemRequest;
import pe.isil.kds.dto.CambiarEstadoItemRequest;
import pe.isil.kds.dto.ItemCocinaDto;
import pe.isil.kds.dto.MotivoAnulacionDto;
import pe.isil.kds.dto.TransicionDto;
import pe.isil.kds.exception.EstadoDesactualizadoException;
import pe.isil.kds.model.EstadoItem;
import pe.isil.kds.security.SesionKds;
import pe.isil.kds.service.AnulacionItemService;
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
    private final AnulacionItemService anulacionItemService;

    public ItemController(CicloVidaItemService cicloVidaItemService, TrazabilidadService trazabilidadService,
                          CocinaService cocinaService, AnulacionItemService anulacionItemService) {
        this.cicloVidaItemService = cicloVidaItemService;
        this.trazabilidadService = trazabilidadService;
        this.cocinaService = cocinaService;
        this.anulacionItemService = anulacionItemService;
    }

    @Operation(summary = "Motivos de anulación disponibles; con 'estado' solo los que aplican a un ítem en ese estado (HU032, D12, D36, Mozo/Expedidor/Admin)")
    @PreAuthorize("hasAnyRole('MOZO', 'EXPEDIDOR', 'ADMIN')")
    @GetMapping("/motivos-anulacion")
    public ResponseEntity<List<MotivoAnulacionDto>> motivosAnulacion(
            @RequestParam(required = false) EstadoItem estado) {
        return ResponseEntity.ok(estado == null ? anulacionItemService.motivos() : anulacionItemService.motivos(estado));
    }

    @Operation(summary = "Anular un ítem enviado indicando el motivo; en preparación o listo registra merma (HU032, D8, D32, Mozo/Expedidor/Admin; el expedidor solo en pedidos externos)")
    @PreAuthorize("hasAnyRole('MOZO', 'EXPEDIDOR', 'ADMIN')")
    @PostMapping("/{id}/anulacion")
    public ResponseEntity<ItemCocinaDto> anular(
            @PathVariable Long id,
            @Valid @RequestBody AnularItemRequest request,
            Authentication authentication) {
        try {
            return ResponseEntity.ok(anulacionItemService.anular(id, request, SesionKds.de(authentication)));
        } catch (ObjectOptimisticLockingFailureException e) {
            // Mismo criterio que el cambio de estado: otra solicitud ganó la carrera y se responde con el estado vigente
            throw new EstadoDesactualizadoException(cicloVidaItemService.obtenerItem(id));
        }
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
