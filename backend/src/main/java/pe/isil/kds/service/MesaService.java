package pe.isil.kds.service;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import pe.isil.kds.dto.MesaDto;
import pe.isil.kds.dto.ZonaDto;
import pe.isil.kds.exception.OperacionNoPermitidaException;
import pe.isil.kds.exception.RecursoNoEncontradoException;
import pe.isil.kds.model.EstadoPedido;
import pe.isil.kds.model.Mesa;
import pe.isil.kds.model.Zona;
import pe.isil.kds.repository.MesaRepository;
import pe.isil.kds.repository.PedidoRepository;
import pe.isil.kds.repository.ZonaRepository;

import java.util.Arrays;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Servicio de Zonas y Mesas de Salón (HU005, HU040, HU041).
 *
 * Reglas de Negocio:
 * - El número de mesa es único por zona, sin distinguir mayúsculas (HU005 Escenario 2, HU041 Escenario 2).
 * - El nombre de zona es único sin distinguir mayúsculas (HU040 Escenario 2).
 * - Las zonas no se eliminan: se desactivan (D17).
 * - Una zona o mesa en atención no se desactiva ni se mueve (HU040 Escenario 5, HU041 Escenario 5).
 */
@Service
public class MesaService {

    // Hasta HU044 una mesa está "en atención" mientras tenga un pedido sin terminar
    private static final List<EstadoPedido> PEDIDO_EN_CURSO =
            Arrays.stream(EstadoPedido.values()).filter(EstadoPedido::esActivo).toList();

    private final ZonaRepository zonaRepository;
    private final MesaRepository mesaRepository;
    private final PedidoRepository pedidoRepository;

    public MesaService(ZonaRepository zonaRepository, MesaRepository mesaRepository, PedidoRepository pedidoRepository) {
        this.zonaRepository = zonaRepository;
        this.mesaRepository = mesaRepository;
        this.pedidoRepository = pedidoRepository;
    }

    @Transactional(readOnly = true)
    public List<ZonaDto> listarZonasConMesas() {
        return zonaRepository.findByActivoTrue().stream()
                .map(zona -> {
                    List<MesaDto> mesasDto = mesaRepository.findByZonaIdAndActivoTrue(zona.getId()).stream()
                            .map(m -> aDto(m, false))
                            .collect(Collectors.toList());
                    return new ZonaDto(zona.getId(), zona.getNombre(), zona.getDescripcion(), zona.getActivo(), mesasDto);
                })
                .collect(Collectors.toList());
    }

    /**
     * Vista de administración: todas las zonas y mesas, incluidas las inactivas, con la marca de atención en curso.
     */
    @Transactional(readOnly = true)
    public List<ZonaDto> listarZonasAdmin() {
        Set<Long> enAtencion = mesasEnAtencion();
        Map<Long, List<MesaDto>> mesasPorZona = mesaRepository.findAll().stream()
                .sorted(Comparator.comparing(Mesa::getId))
                .collect(Collectors.groupingBy(m -> m.getZona().getId(),
                        Collectors.mapping(m -> aDto(m, enAtencion.contains(m.getId())), Collectors.toList())));
        return zonaRepository.findAllByOrderByIdAsc().stream()
                .map(z -> new ZonaDto(z.getId(), z.getNombre(), z.getDescripcion(), z.getActivo(),
                        mesasPorZona.getOrDefault(z.getId(), List.of())))
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<MesaDto> listarMesas() {
        return mesaRepository.findByActivoTrueAndZonaActivoTrue().stream()
                .map(m -> aDto(m, false))
                .collect(Collectors.toList());
    }

    @Transactional
    public ZonaDto crearZona(String nombre, String descripcion) {
        String limpio = nombre.trim();
        validarNombreLibre(limpio, null);
        Zona zona = new Zona();
        zona.setNombre(limpio);
        zona.setDescripcion(descripcionLimpia(descripcion));
        zona.setActivo(true);
        Zona guardada = zonaRepository.save(zona);
        return new ZonaDto(guardada.getId(), guardada.getNombre(), guardada.getDescripcion(), guardada.getActivo(), List.of());
    }

    @Transactional
    public ZonaDto editarZona(Long zonaId, String nombre, String descripcion) {
        Zona zona = buscarZona(zonaId);
        String limpio = nombre.trim();
        validarNombreLibre(limpio, zonaId);
        zona.setNombre(limpio);
        zona.setDescripcion(descripcionLimpia(descripcion));
        Zona guardada = zonaRepository.save(zona);
        return new ZonaDto(guardada.getId(), guardada.getNombre(), guardada.getDescripcion(), guardada.getActivo(), List.of());
    }

    @Transactional
    public ZonaDto cambiarEstadoZona(Long zonaId, boolean activo) {
        Zona zona = buscarZona(zonaId);
        if (!activo) {
            // Bloquear las mesas de la zona antes de revisar pedidos: un pedido simultáneo espera o es rechazado
            List<Mesa> mesas = mesaRepository.bloquearPorZona(zonaId);
            Set<Long> enAtencion = mesasEnAtencion();
            List<String> ocupadas = mesas.stream()
                    .filter(m -> enAtencion.contains(m.getId()))
                    .map(Mesa::getNumeroMesa)
                    .toList();
            if (!ocupadas.isEmpty()) {
                throw new OperacionNoPermitidaException("No se puede desactivar la zona '" + zona.getNombre()
                        + "': siguen en atención las mesas " + String.join(", ", ocupadas) + ".");
            }
        }
        zona.setActivo(activo);
        Zona guardada = zonaRepository.save(zona);
        return new ZonaDto(guardada.getId(), guardada.getNombre(), guardada.getDescripcion(), guardada.getActivo(), List.of());
    }

    @Transactional
    public MesaDto crearMesa(Long zonaId, String numeroMesa, Integer capacidad) {
        Zona zona = zonaDestino(zonaId);
        if (!zona.getActivo()) {
            throw new IllegalArgumentException("La zona '" + zona.getNombre() + "' está inactiva: reactívela antes de registrar mesas.");
        }
        String numero = numeroMesa.trim();
        validarNumeroLibre(zona, numero, null);

        Mesa mesa = new Mesa();
        mesa.setZona(zona);
        mesa.setNumeroMesa(numero);
        mesa.setCapacidad(capacidad != null ? capacidad : 4);
        mesa.setActivo(true);
        return aDto(mesaRepository.save(mesa), false);
    }

    @Transactional
    public MesaDto editarMesa(Long mesaId, Long zonaId, String numeroMesa, Integer capacidad) {
        Mesa mesa = buscarMesaBloqueada(mesaId);
        Zona destino = zonaDestino(zonaId);
        boolean cambiaDeZona = !destino.getId().equals(mesa.getZona().getId());
        boolean enAtencion = estaEnAtencion(mesaId);
        if (cambiaDeZona && !destino.getActivo()) {
            throw new IllegalArgumentException("La zona '" + destino.getNombre() + "' está inactiva: no se pueden mover mesas a ella.");
        }
        if (cambiaDeZona && enAtencion) {
            throw new OperacionNoPermitidaException("La mesa " + mesa.getNumeroMesa()
                    + " está en atención: no se puede mover de zona hasta que sea liberada.");
        }
        String numero = numeroMesa.trim();
        validarNumeroLibre(destino, numero, mesaId);

        mesa.setZona(destino);
        mesa.setNumeroMesa(numero);
        mesa.setCapacidad(capacidad);
        return aDto(mesaRepository.save(mesa), enAtencion);
    }

    @Transactional
    public MesaDto cambiarEstadoMesa(Long mesaId, boolean activo) {
        Mesa mesa = buscarMesaBloqueada(mesaId);
        boolean enAtencion = estaEnAtencion(mesaId);
        if (!activo && enAtencion) {
            throw new OperacionNoPermitidaException("La mesa " + mesa.getNumeroMesa()
                    + " está en atención: no se puede desactivar hasta que sea liberada.");
        }
        mesa.setActivo(activo);
        return aDto(mesaRepository.save(mesa), enAtencion);
    }

    private Set<Long> mesasEnAtencion() {
        return Set.copyOf(pedidoRepository.idsMesasConPedidoEn(PEDIDO_EN_CURSO));
    }

    private boolean estaEnAtencion(Long mesaId) {
        return pedidoRepository.existsByMesaIdAndEstadoIn(mesaId, PEDIDO_EN_CURSO);
    }

    private void validarNombreLibre(String nombre, Long zonaActualId) {
        zonaRepository.findByNombreIgnoreCase(nombre)
                .filter(otra -> !otra.getId().equals(zonaActualId))
                .ifPresent(otra -> {
                    throw new IllegalArgumentException("Ya existe una zona con el nombre '" + otra.getNombre() + "'.");
                });
    }

    private void validarNumeroLibre(Zona zona, String numero, Long mesaActualId) {
        mesaRepository.findByZonaIdAndNumeroMesaIgnoreCase(zona.getId(), numero)
                .filter(otra -> !otra.getId().equals(mesaActualId))
                .ifPresent(otra -> {
                    throw new IllegalArgumentException("Ya existe una mesa con el número '" + numero
                            + "' en la zona '" + zona.getNombre() + "'.");
                });
    }

    private Zona buscarZona(Long zonaId) {
        return zonaRepository.findById(zonaId)
                .orElseThrow(() -> new RecursoNoEncontradoException("Zona no encontrada con ID: " + zonaId));
    }

    private Zona zonaDestino(Long zonaId) {
        return zonaRepository.findById(zonaId)
                .orElseThrow(() -> new IllegalArgumentException("Zona no encontrada con ID: " + zonaId));
    }

    // Con la fila bloqueada, un pedido que llega en paralelo para esta mesa espera a que termine el cambio
    private Mesa buscarMesaBloqueada(Long mesaId) {
        return mesaRepository.bloquearPorId(mesaId)
                .orElseThrow(() -> new RecursoNoEncontradoException("Mesa no encontrada con ID: " + mesaId));
    }

    private static String descripcionLimpia(String descripcion) {
        return descripcion == null || descripcion.isBlank() ? null : descripcion.trim();
    }

    private static MesaDto aDto(Mesa m, boolean enAtencion) {
        MesaDto dto = new MesaDto(m.getId(), m.getZona().getId(), m.getZona().getNombre(),
                m.getNumeroMesa(), m.getCapacidad(), m.getActivo());
        dto.setEnAtencion(enAtencion);
        return dto;
    }
}
