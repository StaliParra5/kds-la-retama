package pe.isil.kds.service;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import pe.isil.kds.dto.SalonDto;
import pe.isil.kds.dto.SemaforoDto;
import pe.isil.kds.model.AtencionMesa;
import pe.isil.kds.model.ConfiguracionSemaforo;
import pe.isil.kds.model.DetallePedido;
import pe.isil.kds.model.Mesa;
import pe.isil.kds.model.Pedido;
import pe.isil.kds.model.Usuario;
import pe.isil.kds.model.Zona;
import pe.isil.kds.repository.AtencionMesaRepository;
import pe.isil.kds.repository.ConfiguracionSemaforoRepository;
import pe.isil.kds.repository.MesaRepository;
import pe.isil.kds.repository.PedidoRepository;
import pe.isil.kds.repository.UsuarioRepository;
import pe.isil.kds.repository.ZonaRepository;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Servicio de la Vista de Salón y del semáforo de mesas (HU047, HU048, decisiones D21 y D22).
 *
 * Color de cada mesa:
 * - Gris (LIBRE): sin atención abierta.
 * - Azul (ATENDIDA): con atención abierta y todo despachado (o anulado), aún sin liberar.
 * - Verde, amarillo o rojo: con ítems pendientes, según los minutos desde el envío a cocina del
 *   pedido pendiente más antiguo de la mesa, comparados con los umbrales configurados.
 */
@Service
public class SalonService {

    private static final String ROL_MOZO = "MOZO";

    private final ConfiguracionSemaforoRepository semaforoRepository;
    private final ZonaRepository zonaRepository;
    private final MesaRepository mesaRepository;
    private final AtencionMesaRepository atencionRepository;
    private final PedidoRepository pedidoRepository;
    private final UsuarioRepository usuarioRepository;

    public SalonService(ConfiguracionSemaforoRepository semaforoRepository, ZonaRepository zonaRepository,
                        MesaRepository mesaRepository, AtencionMesaRepository atencionRepository,
                        PedidoRepository pedidoRepository, UsuarioRepository usuarioRepository) {
        this.semaforoRepository = semaforoRepository;
        this.zonaRepository = zonaRepository;
        this.mesaRepository = mesaRepository;
        this.atencionRepository = atencionRepository;
        this.pedidoRepository = pedidoRepository;
        this.usuarioRepository = usuarioRepository;
    }

    // --- HU047: semáforo

    /** HU047 Escenario 1: sin configuración guardada rigen 20 y 30 minutos. */
    @Transactional(readOnly = true)
    public SemaforoDto semaforo() {
        ConfiguracionSemaforo c = semaforoRepository.findById(ConfiguracionSemaforo.ID_UNICO)
                .orElseGet(ConfiguracionSemaforo::new);
        return new SemaforoDto(c.getMinutosAmarillo(), c.getMinutosRojo());
    }

    /** HU047 Escenarios 2 y 3: amarillo mayor que cero y rojo mayor que amarillo. */
    @Transactional
    public SemaforoDto actualizarSemaforo(Integer minutosAmarillo, Integer minutosRojo) {
        if (minutosAmarillo == null || minutosAmarillo <= 0) {
            throw new IllegalArgumentException("Los minutos para amarillo deben ser mayores que cero.");
        }
        if (minutosRojo == null || minutosRojo <= minutosAmarillo) {
            throw new IllegalArgumentException("Los minutos para rojo deben ser mayores que los de amarillo.");
        }
        ConfiguracionSemaforo c = semaforoRepository.findById(ConfiguracionSemaforo.ID_UNICO)
                .orElseGet(ConfiguracionSemaforo::new);
        c.setMinutosAmarillo(minutosAmarillo);
        c.setMinutosRojo(minutosRojo);
        ConfiguracionSemaforo guardada = semaforoRepository.save(c);
        return new SemaforoDto(guardada.getMinutosAmarillo(), guardada.getMinutosRojo());
    }

    // --- HU048: vista de salón

    @Transactional(readOnly = true)
    public SalonDto vistaSalon() {
        return vistaSalon(LocalDateTime.now());
    }

    @Transactional(readOnly = true)
    public SalonDto vistaSalon(LocalDateTime ahora) {
        SemaforoDto semaforo = semaforo();

        Map<Long, AtencionMesa> atencionPorMesa = atencionRepository.findByLiberadaEnIsNull().stream()
                .collect(Collectors.toMap(a -> a.getMesa().getId(), Function.identity(), (a, b) -> a));
        Map<Long, List<Pedido>> pedidosPorAtencion = atencionPorMesa.isEmpty() ? Map.of()
                : pedidoRepository.findByAtencionIdIn(atencionPorMesa.values().stream().map(AtencionMesa::getId).toList())
                .stream().collect(Collectors.groupingBy(p -> p.getAtencion().getId()));

        Map<Long, List<Mesa>> mesasPorZona = mesaRepository.findByActivoTrueAndZonaActivoTrue().stream()
                .sorted(Comparator.comparing(Mesa::getId))
                .collect(Collectors.groupingBy(m -> m.getZona().getId()));
        Map<Long, List<String>> mozosPorZona = mozosActivosPorZona();

        List<SalonDto.Zona> zonas = zonaRepository.findByActivoTrue().stream()
                .sorted(Comparator.comparing(Zona::getId))
                .map(z -> new SalonDto.Zona(z.getId(), z.getNombre(),
                        mozosPorZona.getOrDefault(z.getId(), List.of()),
                        mesasPorZona.getOrDefault(z.getId(), List.of()).stream()
                                .map(m -> mesa(m, atencionPorMesa.get(m.getId()), pedidosPorAtencion, semaforo, ahora))
                                .toList()))
                .toList();
        return new SalonDto(semaforo, ahora, zonas);
    }

    private static SalonDto.Mesa mesa(Mesa m, AtencionMesa atencion, Map<Long, List<Pedido>> pedidosPorAtencion,
                                      SemaforoDto semaforo, LocalDateTime ahora) {
        if (atencion == null) {
            return new SalonDto.Mesa(m.getId(), m.getNumeroMesa(), m.getCapacidad(), SalonDto.EstadoMesa.LIBRE,
                    null, null, null, null, null, 0);
        }
        List<Pedido> pedidos = pedidosPorAtencion.getOrDefault(atencion.getId(), List.of());
        int pendientes = 0;
        LocalDateTime masAntiguo = null;
        for (Pedido p : pedidos) {
            long delPedido = p.getItems().stream().filter(SalonService::pendiente).count();
            if (delPedido > 0) {
                pendientes += (int) delPedido;
                LocalDateTime envio = Objects.requireNonNullElse(p.getFechaEnvioCocina(), p.getCreatedAt());
                if (masAntiguo == null || envio.isBefore(masAntiguo)) {
                    masAntiguo = envio;
                }
            }
        }
        Usuario mozo = atencion.getMozo();
        String mozoNombre = mozo.getNombreCompleto();
        if (masAntiguo == null) {
            return new SalonDto.Mesa(m.getId(), m.getNumeroMesa(), m.getCapacidad(), SalonDto.EstadoMesa.ATENDIDA,
                    atencion.getId(), atencion.getPersonas(), mozoNombre, atencion.getAbiertaEn(), null, 0);
        }
        int minutos = (int) Math.max(0, Duration.between(masAntiguo, ahora).toMinutes());
        SalonDto.EstadoMesa estado = minutos >= semaforo.getMinutosRojo() ? SalonDto.EstadoMesa.ROJO
                : minutos >= semaforo.getMinutosAmarillo() ? SalonDto.EstadoMesa.AMARILLO
                : SalonDto.EstadoMesa.VERDE;
        return new SalonDto.Mesa(m.getId(), m.getNumeroMesa(), m.getCapacidad(), estado,
                atencion.getId(), atencion.getPersonas(), mozoNombre, atencion.getAbiertaEn(), minutos, pendientes);
    }

    private static boolean pendiente(DetallePedido item) {
        return !item.getEstadoItem().esFinal();
    }

    // HU048 Escenario 4: mozos activos asignados a cada zona (HU043)
    private Map<Long, List<String>> mozosActivosPorZona() {
        Map<Long, List<String>> porZona = new java.util.HashMap<>();
        for (Usuario u : usuarioRepository.findByRolCodigoOrderByApellidoAscNombreAsc(ROL_MOZO)) {
            if (!Boolean.TRUE.equals(u.getActivo())) {
                continue;
            }
            for (Zona z : u.getZonas()) {
                porZona.computeIfAbsent(z.getId(), k -> new java.util.ArrayList<>()).add(u.getNombreCompleto());
            }
        }
        return porZona;
    }
}
