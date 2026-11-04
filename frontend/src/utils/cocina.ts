// Utilidades compartidas por las pantallas de cocina (HU012) y pase (D9)
import type { EstadoItem, ItemCocina } from '../types';

export interface GrupoPedido {
  pedidoId: number;
  codigoPedido: string;
  canalNombre: string;
  canalSlaMinutos: number;
  mesaNumero?: string | null;
  clienteNombre?: string | null;
  fechaEnvioCocina: string;
  itemsEnOtrasEstaciones: number;
  itemsPendientesPedido: number;
  items: ItemCocina[];
}

// Agrupa conservando el orden de llegada que entrega el servidor (FIFO por envío a cocina)
export const agruparPorPedido = (items: ItemCocina[]): GrupoPedido[] => {
  const grupos = new Map<number, GrupoPedido>();
  for (const item of items) {
    let grupo = grupos.get(item.pedidoId);
    if (!grupo) {
      grupo = {
        pedidoId: item.pedidoId,
        codigoPedido: item.codigoPedido,
        canalNombre: item.canalNombre,
        canalSlaMinutos: item.canalSlaMinutos,
        mesaNumero: item.mesaNumero,
        clienteNombre: item.clienteNombre,
        fechaEnvioCocina: item.fechaEnvioCocina,
        itemsEnOtrasEstaciones: item.itemsEnOtrasEstaciones,
        itemsPendientesPedido: item.itemsPendientesPedido,
        items: [],
      };
      grupos.set(item.pedidoId, grupo);
    }
    grupo.items.push(item);
  }
  return [...grupos.values()];
};

export const minutosDesde = (fechaIso: string, ahora: number): number =>
  Math.max(0, Math.floor((ahora - new Date(fechaIso).getTime()) / 60000));

// Semáforo contra el SLA del canal: verde, ámbar desde el 75 % y rojo al superarlo
export const claseSemaforo = (minutos: number, sla: number): string => {
  if (sla > 0 && minutos >= sla) return 'border-error bg-error/10 text-error';
  if (sla > 0 && minutos >= sla * 0.75) return 'border-tertiary bg-tertiary/10 text-tertiary';
  return 'border-secondary/40 bg-secondary/10 text-secondary';
};

// Etiqueta y colores de cada estado: la fila entera cambia de color para que el cambio se note al tocar
export const ESTILO_ESTADO: Record<EstadoItem, { etiqueta: string; clase: string; fila: string }> =
  {
    RECIBIDO: {
      etiqueta: 'Pendiente',
      clase: 'bg-surface-container-high text-on-surface',
      fila: 'border-surface-container-high bg-surface-container-low/60',
    },
    EN_ESPERA: {
      etiqueta: 'En espera',
      clase: 'bg-tertiary/15 text-tertiary',
      fila: 'border-tertiary/40 bg-tertiary/5',
    },
    EN_PREPARACION: {
      etiqueta: 'En preparación',
      clase: 'bg-primary text-on-primary',
      fila: 'border-primary bg-primary/10',
    },
    LISTO: {
      etiqueta: 'Listo',
      clase: 'bg-secondary text-on-secondary',
      fila: 'border-secondary bg-secondary/10',
    },
    DESPACHADO: {
      etiqueta: 'Despachado',
      clase: 'bg-surface-container text-on-surface-variant',
      fila: 'border-surface-container-high bg-surface-container',
    },
    ANULADO: {
      etiqueta: 'Anulado',
      clase: 'bg-error/15 text-error',
      fila: 'border-error/40 bg-error/5 line-through',
    },
  };
