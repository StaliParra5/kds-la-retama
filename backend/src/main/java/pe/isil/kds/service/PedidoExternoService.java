package pe.isil.kds.service;

import jakarta.validation.ConstraintViolation;
import jakarta.validation.Validator;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import pe.isil.kds.dto.CrearPedidoRequest;
import pe.isil.kds.dto.ItemPedidoRequest;
import pe.isil.kds.dto.PedidoExternoRequest;
import pe.isil.kds.dto.PedidoExternoResponse;
import pe.isil.kds.dto.PedidoResponse;
import pe.isil.kds.model.CanalVenta;
import pe.isil.kds.model.Plato;
import pe.isil.kds.repository.CanalVentaRepository;
import pe.isil.kds.repository.PlatoRepository;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Punto de integración para pedidos externos (HU019, RF-ING-02).
 *
 * Traduce el payload normalizado (canal y platos por código) al mismo registro que usa el comandero, de modo
 * que el pedido recibe correlativo, historial, enrutamiento por estación y avisos en tiempo real igual que
 * uno de sala (Esc. 5). Reglas:
 * - El payload se valida completo y el error nombra cada campo faltante o inválido (Esc. 2).
 * - El canal debe existir y estar activo; Salón no es un canal externo (Esc. 3).
 * - Cada plato se identifica por su código PLT-001 del catálogo; el error indica qué ítem no se reconoce (Esc. 4).
 * - Los modificadores deben pertenecer al catálogo del plato; los desconocidos se rechazan (HU008).
 * - Un reenvío con el mismo canal y número de orden no crea otro pedido (HU034): si los ítems coinciden devuelve
 *   el existente; si difieren se rechaza el conflicto sin tocar el original. Otro canal con el mismo número es
 *   otro pedido.
 * - El pedido queda registrado a nombre de la cuenta de servicio "integracion", sin sesión posible.
 * El acceso lo restringe IntegracionApiKeyFilter antes de llegar aquí (Esc. 6).
 */
@Service
public class PedidoExternoService {

    public static final String USUARIO_INTEGRACION = "integracion";
    private static final String CANAL_SALON = "SALON";

    private final CanalVentaRepository canalRepository;
    private final PlatoRepository platoRepository;
    private final PedidoService pedidoService;
    private final Validator validator;

    public PedidoExternoService(
            CanalVentaRepository canalRepository,
            PlatoRepository platoRepository,
            PedidoService pedidoService,
            Validator validator) {
        this.canalRepository = canalRepository;
        this.platoRepository = platoRepository;
        this.pedidoService = pedidoService;
        this.validator = validator;
    }

    /** Pedido externo aceptado y si se creó ahora (201) o ya existía por ser un reenvío (200, HU034). */
    public record Resultado(PedidoExternoResponse respuesta, boolean creado) {}

    @Transactional
    public Resultado registrar(PedidoExternoRequest request) {
        validarPayload(request);
        CanalVenta canal = resolverCanal(request.getCanal());

        CrearPedidoRequest pedido = new CrearPedidoRequest();
        pedido.setCanalId(canal.getId());
        pedido.setNumeroOrdenExterno(request.getNumeroOrden().trim());
        if (request.getCliente() != null) {
            pedido.setClienteNombre(request.getCliente().getNombre());
            pedido.setClienteTelefono(request.getCliente().getTelefono());
            pedido.setClienteDireccion(request.getCliente().getDireccion());
        }
        pedido.setObservaciones(request.getObservaciones());
        pedido.setItems(traducirItems(request.getItems()));

        // HU034: primero se resuelve un posible reenvío (sin crear nada ni avisar a cocina); si no lo es, se registra
        PedidoService.ResultadoEnvio resultado = pedidoService.resolverReenvioExterno(pedido)
                .orElseGet(() -> pedidoService.registrarComanda(pedido, USUARIO_INTEGRACION, true));
        PedidoResponse registrado = resultado.pedido();
        return new Resultado(new PedidoExternoResponse(registrado.getId(), registrado.getCodigoCorrelativo(), canal.getCodigo(),
                registrado.getNumeroOrdenExterno(), registrado.getEstado()), resultado.creado());
    }

    // Se valida a mano para devolver todos los errores juntos: quien integra los corrige de una vez
    private void validarPayload(PedidoExternoRequest request) {
        if (request == null) {
            throw new IllegalArgumentException("El cuerpo de la solicitud es obligatorio.");
        }
        Set<ConstraintViolation<PedidoExternoRequest>> errores = validator.validate(request);
        if (!errores.isEmpty()) {
            String detalle = errores.stream().map(ConstraintViolation::getMessage).distinct().sorted()
                    .collect(Collectors.joining("; "));
            throw new IllegalArgumentException("Payload inválido: " + detalle + ".");
        }
    }

    private CanalVenta resolverCanal(String codigoRecibido) {
        String codigo = codigoRecibido.trim().toUpperCase(Locale.ROOT);
        CanalVenta canal = canalRepository.findByCodigo(codigo)
                .filter(c -> Boolean.TRUE.equals(c.getActivo()))
                .orElseThrow(() -> new IllegalArgumentException(
                        "El canal '" + codigoRecibido.trim() + "' no existe o no está activo."));
        if (CANAL_SALON.equals(canal.getCodigo())) {
            throw new IllegalArgumentException("El canal 'SALON' no admite pedidos externos: requiere mesa y atención abierta.");
        }
        return canal;
    }

    private List<ItemPedidoRequest> traducirItems(List<PedidoExternoRequest.Item> items) {
        List<ItemPedidoRequest> traducidos = new ArrayList<>();
        for (int i = 0; i < items.size(); i++) {
            traducidos.add(traducirItem(i + 1, items.get(i)));
        }
        return traducidos;
    }

    private ItemPedidoRequest traducirItem(int numero, PedidoExternoRequest.Item item) {
        String codigo = item.getCodigoPlato().trim();
        Long platoId = CodigoPlato.aId(codigo).orElseThrow(() -> new IllegalArgumentException(
                "Ítem " + numero + ": el código de plato '" + codigo + "' no tiene el formato PLT-001."));
        Plato plato = platoRepository.findById(platoId).orElseThrow(() -> new IllegalArgumentException(
                "Ítem " + numero + ": el código de plato '" + codigo + "' no existe en el catálogo."));
        String modificadores = item.getModificadores() == null || item.getModificadores().isEmpty()
                ? null
                : item.getModificadores().stream().map(String::trim).collect(Collectors.joining(", "));
        return new ItemPedidoRequest(plato.getId(), item.getCantidad(), modificadores);
    }
}
