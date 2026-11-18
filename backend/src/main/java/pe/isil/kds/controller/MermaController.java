package pe.isil.kds.controller;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import pe.isil.kds.dto.MermasConsultaDto;
import pe.isil.kds.service.MermaService;

/**
 * Consulta de mermas por anulación de ítems (HU032, D10).
 */
@Tag(name = "Mermas", description = "Ítems anulados que ya estaban en preparación o listos")
@RestController
@RequestMapping("/api/v1/mermas")
@PreAuthorize("hasRole('ADMIN')")
public class MermaController {

    private final MermaService mermaService;

    public MermaController(MermaService mermaService) {
        this.mermaService = mermaService;
    }

    @Operation(summary = "Mermas de un rango de fechas AAAA-MM-DD, con totales; sin fechas devuelve las de hoy (HU032, Admin)")
    @GetMapping
    public ResponseEntity<MermasConsultaDto> consultar(
            @RequestParam(required = false) String desde,
            @RequestParam(required = false) String hasta) {
        return ResponseEntity.ok(mermaService.consultar(desde, hasta));
    }
}
