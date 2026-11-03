package pe.isil.kds.service;

import pe.isil.kds.dto.ItemCocinaDto;
import pe.isil.kds.model.DetallePedido;
import pe.isil.kds.model.EstadoItem;
import pe.isil.kds.model.Pedido;

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
        dto.setMesaNumero(pedido.getMesa() != null ? pedido.getMesa().getNumeroMesa() : null);
        dto.setFechaEnvioCocina(pedido.getFechaEnvioCocina());

        long enOtras = pedido.getItems().stream()
                .filter(otro -> otro.getEstadoItem() != EstadoItem.ANULADO)
                .filter(otro -> !Objects.equals(otro.getEstacion().getId(), item.getEstacion().getId()))
                .count();
        dto.setItemsEnOtrasEstaciones((int) enOtras);
        return dto;
    }
}
