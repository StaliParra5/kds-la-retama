package pe.isil.kds.service;

import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import pe.isil.kds.dto.AtencionMesaDto;
import pe.isil.kds.dto.PedidoResponse;
import pe.isil.kds.exception.OperacionNoPermitidaException;
import pe.isil.kds.exception.RecursoNoEncontradoException;
import pe.isil.kds.model.AtencionMesa;
import pe.isil.kds.model.EstadoItem;
import pe.isil.kds.model.Mesa;
import pe.isil.kds.model.Usuario;
import pe.isil.kds.repository.AtencionMesaRepository;
import pe.isil.kds.repository.MesaRepository;
import pe.isil.kds.repository.UsuarioRepository;
import pe.isil.kds.security.SesionKds;

import java.util.List;

/**
 * Servicio de Atención de Mesas (HU044, HU046, decisión D19).
 *
 * Reglas de Negocio:
 * - Entrar a una mesa libre abre su atención con la cantidad de personas; entrar a una en atención
 *   devuelve la existente sin volver a pedirlas (HU044 Escenarios 3 y 4).
 * - Abrir y liberar bloquean la fila de la mesa: dos aperturas simultáneas dejan una sola atención
 *   (Escenario 5) y un pedido no puede colarse en una mesa que se está liberando.
 * - Solo operan los mozos con la zona de la mesa asignada (HU043); el admin puede consultar.
 * - Liberar exige que no queden ítems por despachar; los anulados no cuentan (HU046 Escenarios 2 y 3).
 */
@Service
public class AtencionService {

    private final AtencionMesaRepository atencionRepository;
    private final MesaRepository mesaRepository;
    private final UsuarioRepository usuarioRepository;
    private final PedidoService pedidoService;

    public AtencionService(AtencionMesaRepository atencionRepository, MesaRepository mesaRepository,
                           UsuarioRepository usuarioRepository, PedidoService pedidoService) {
        this.atencionRepository = atencionRepository;
        this.mesaRepository = mesaRepository;
        this.usuarioRepository = usuarioRepository;
        this.pedidoService = pedidoService;
    }

    @Transactional
    public AtencionMesaDto entrar(Long mesaId, Integer personas, String username) {
        Mesa mesa = bloquearMesa(mesaId);
        if (!Boolean.TRUE.equals(mesa.getActivo()) || !Boolean.TRUE.equals(mesa.getZona().getActivo())) {
            throw new OperacionNoPermitidaException("La mesa " + mesa.getNumeroMesa() + " no está disponible: fue desactivada o su zona está inactiva.",
                        PedidoService.CODIGO_MESA_NO_DISPONIBLE);
        }
        Usuario mozo = buscarUsuario(username);
        validarZona(mozo, mesa);

        var abierta = atencionRepository.findByMesaIdAndLiberadaEnIsNull(mesaId);
        if (abierta.isPresent()) {
            return aDto(abierta.get());
        }
        if (personas == null) {
            throw new IllegalArgumentException("La mesa " + mesa.getNumeroMesa() + " está libre: indique cuántas personas hay para abrirla.");
        }
        AtencionMesa atencion = new AtencionMesa();
        atencion.setMesa(mesa);
        atencion.setMozo(mozo);
        atencion.setPersonas(personas);
        return aDto(atencionRepository.save(atencion));
    }

    @Transactional(readOnly = true)
    public AtencionMesaDto consultar(Long mesaId, SesionKds sesion) {
        Mesa mesa = mesaRepository.findById(mesaId)
                .orElseThrow(() -> new RecursoNoEncontradoException("Mesa no encontrada con ID: " + mesaId));
        if (sesion.tieneRol("MOZO")) {
            validarZona(buscarUsuario(sesion.username()), mesa);
        }
        AtencionMesa atencion = atencionRepository.findByMesaIdAndLiberadaEnIsNull(mesaId)
                .orElseThrow(() -> new RecursoNoEncontradoException("La mesa " + mesa.getNumeroMesa() + " está libre."));
        return aDto(atencion);
    }

    @Transactional
    public AtencionMesaDto liberar(Long mesaId, String username) {
        Mesa mesa = bloquearMesa(mesaId);
        Usuario mozo = buscarUsuario(username);
        validarZona(mozo, mesa);
        AtencionMesa atencion = atencionRepository.findByMesaIdAndLiberadaEnIsNull(mesaId)
                .orElseThrow(() -> new OperacionNoPermitidaException("La mesa " + mesa.getNumeroMesa() + " ya está libre."));

        List<PedidoResponse> pedidos = pedidoService.pedidosDeAtencion(atencion.getId());
        int pendientes = itemsPendientes(pedidos);
        if (pendientes > 0) {
            throw new OperacionNoPermitidaException("No se puede liberar la mesa " + mesa.getNumeroMesa() + ": faltan "
                    + pendientes + (pendientes == 1 ? " ítem por despachar." : " ítems por despachar."));
        }
        atencion.liberar(mozo);
        return aDto(atencionRepository.save(atencion), pedidos);
    }

    private Mesa bloquearMesa(Long mesaId) {
        return mesaRepository.bloquearPorId(mesaId)
                .orElseThrow(() -> new RecursoNoEncontradoException("Mesa no encontrada con ID: " + mesaId));
    }

    private Usuario buscarUsuario(String username) {
        return usuarioRepository.findByUsername(username)
                .orElseThrow(() -> new IllegalArgumentException("Usuario no encontrado: " + username));
    }

    private static void validarZona(Usuario mozo, Mesa mesa) {
        Long zonaMesa = mesa.getZona().getId();
        if (mozo.getZonas().stream().noneMatch(z -> z.getId().equals(zonaMesa))) {
            throw new AccessDeniedException("La mesa " + mesa.getNumeroMesa() + " pertenece a la zona '"
                    + mesa.getZona().getNombre() + "', que no tiene asignada.");
        }
    }

    private static int itemsPendientes(List<PedidoResponse> pedidos) {
        return (int) pedidos.stream()
                .flatMap(p -> p.getItems() == null ? java.util.stream.Stream.empty() : p.getItems().stream())
                .filter(i -> !EstadoItem.DESPACHADO.name().equals(i.getEstadoItem())
                        && !EstadoItem.ANULADO.name().equals(i.getEstadoItem()))
                .count();
    }

    private AtencionMesaDto aDto(AtencionMesa atencion) {
        return aDto(atencion, pedidoService.pedidosDeAtencion(atencion.getId()));
    }

    private static AtencionMesaDto aDto(AtencionMesa a, List<PedidoResponse> pedidos) {
        AtencionMesaDto dto = new AtencionMesaDto();
        dto.setId(a.getId());
        dto.setMesaId(a.getMesa().getId());
        dto.setMesaNumero(a.getMesa().getNumeroMesa());
        dto.setZonaId(a.getMesa().getZona().getId());
        dto.setZonaNombre(a.getMesa().getZona().getNombre());
        dto.setCapacidad(a.getMesa().getCapacidad());
        dto.setPersonas(a.getPersonas());
        dto.setMozoNombre(a.getMozo().getNombre() + " " + a.getMozo().getApellido());
        dto.setAbiertaEn(a.getAbiertaEn());
        dto.setLiberadaEn(a.getLiberadaEn());
        if (a.getLiberadaPor() != null) {
            dto.setLiberadaPorNombre(a.getLiberadaPor().getNombre() + " " + a.getLiberadaPor().getApellido());
        }
        dto.setPedidos(pedidos);
        dto.setItemsPendientes(itemsPendientes(pedidos));
        return dto;
    }
}
