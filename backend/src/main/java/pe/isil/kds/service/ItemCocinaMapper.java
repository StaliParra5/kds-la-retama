package pe.isil.kds.service;

import pe.isil.kds.dto.ItemCocinaDto;
import pe.isil.kds.model.DetallePedido;
import pe.isil.kds.model.EstadoItem;
import pe.isil.kds.model.Pedido;

import java.time.ZoneId;
import java.util.Objects;

/**
 * Convierte un DetallePedido en la vista que consumen las pantallas de cocina y pase.
 */
public final class ItemCocinaMapper {

    private ItemCocinaMapper() {}

    public static ItemCocinaDto aDto(DetallePedido item) {
        Pedido pedido = item.getPedido();
        ItemCocinaDto dto = new ItemCocinaDto();
        dto.setId(item.getId());
        dto.setVersion(item.getVersion());
        dto.setEstado(item.getEstadoItem().name());
        dto.setCantidad(item.getCantidad());
        dto.setPlatoNombre(item.getPlato().getNombre());
        dto.setModificadores(item.getModificadores());
        dto.setTiempoEstandarMinutos(item.getTiempoEstandarMinutos());
        dto.setHoraDisparo(item.getHoraDisparo());
        dto.setCreadoEn(item.getCreatedAt());
        dto.setEstacionId(item.getEstacion().getId());
        dto.setEstacionNombre(item.getEstacion().getNombre());

        dto.setPedidoId(pedido.getId());
        dto.setCodigoPedido(pedido.getCodigoCorrelativo());
        dto.setEstadoPedido(pedido.getEstado() != null ? pedido.getEstado().name() : null);
        dto.setCanalCodigo(pedido.getCanal().getCodigo());
        dto.setCanalNombre(pedido.getCanal().getNombre());
        dto.setCanalSlaMinutos(pedido.getCanal().getSlaObjetivoMinutos());
        // HU015: la tarjeta usa el mismo color e ícono configurados en el canal (estación y pase iguales, Esc. 3 y 5)
        dto.setCanalColor(pedido.getCanal().getColor());
        dto.setCanalIcono(pedido.getCanal().getIcono());
        // HU025: umbral ámbar del canal para el semáforo de la tarjeta
        dto.setCanalUmbralAmbar(pedido.getCanal().getUmbralAmbarPorcentaje());
        // D39: el servidor resuelve el minuto del ámbar (Salón en minutos fijos, el resto por % del SLA)
        dto.setCanalAmbarMinutos(pedido.getCanal().minutosAmbar());
        dto.setMesaNumero(pedido.getMesa() != null ? pedido.getMesa().getNumeroMesa() : null);
        // HU021 Esc. 3: zona de la mesa para el destino; la zona se carga por lotes (default_batch_fetch_size), sin N+1
        dto.setZonaNombre(pedido.getMesa() != null && pedido.getMesa().getZona() != null
                ? pedido.getMesa().getZona().getNombre() : null);
        // HU021 Esc. 4: las adiciones a una mesa se marcan en la tarjeta
        dto.setNumeroAdicion(pedido.getNumeroAdicion() != null ? pedido.getNumeroAdicion() : 0);
        // HU045 Escenario 3: el nombre del cliente para llevar acompaña al código del pedido
        dto.setClienteNombre(pedido.getClienteNombre());
        // HU020 Esc. 3: el número de orden del agregador acompaña al código del pedido en la tarjeta
        dto.setNumeroOrdenExterno(pedido.getNumeroOrdenExterno());
        dto.setFechaEnvioCocina(pedido.getFechaEnvioCocina());
        // HU021 Esc. 6: la hora se guarda en la zona del restaurante (fijada al arrancar, KdsApplication); como instante
        // absoluto el cronómetro de cualquier PC calcula lo mismo aunque su reloj o su zona horaria sean distintos
        dto.setEnvioCocinaEpochMs(pedido.getFechaEnvioCocina() != null
                ? pedido.getFechaEnvioCocina().atZone(ZoneId.systemDefault()).toInstant().toEpochMilli() : null);

        long enOtras = pedido.getItems().stream()
                .filter(otro -> otro.getEstadoItem() != EstadoItem.ANULADO)
                .filter(otro -> !Objects.equals(otro.getEstacion().getId(), item.getEstacion().getId()))
                .count();
        dto.setItemsEnOtrasEstaciones((int) enOtras);
        long pendientes = pedido.getItems().stream()
                .filter(otro -> otro.getEstadoItem().enColaDeCocina())
                .count();
        dto.setItemsPendientesPedido((int) pendientes);
        return dto;
    }
}
