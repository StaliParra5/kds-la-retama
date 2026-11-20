// Utilidades compartidas por las pantallas de cocina (HU012) y pase (D9)
import type { EstadoItem, ItemCocina } from '../types';

export interface GrupoPedido {
  pedidoId: number;
  codigoPedido: string;
  canalCodigo: string;
  canalNombre: string;
  // HU020 Esc. 3: número de orden del agregador, visible en la tarjeta
  numeroOrdenExterno?: string | null;
  // HU015: apariencia del canal; HU025: umbral ámbar del canal
  canalColor?: string | null;
  canalIcono?: string | null;
  canalUmbralAmbar?: number | null;
  canalAmbarMinutos?: number | null;
  // HU021: destino (zona y mesa), adición y cronómetro según la hora del servidor
  zonaNombre?: string | null;
  numeroAdicion: number;
  envioCocinaEpochMs: number;
  canalSlaMinutos: number;
  mesaNumero?: string | null;
  clienteNombre?: string | null;
  fechaEnvioCocina: string;
  itemsEnOtrasEstaciones: number;
  itemsPendientesPedido: number;
  items: ItemCocina[];
}

// Agrupa por pedido y los ordena por hora de ingreso a cocina (HU016 Esc. 2). El orden se calcula aquí
// y no solo se hereda del servidor: un pedido nuevo siempre cae en su lugar sin mover a los demás (Esc. 3)
export const agruparPorPedido = (items: ItemCocina[]): GrupoPedido[] => {
  const grupos = new Map<number, GrupoPedido>();
  for (const item of items) {
    let grupo = grupos.get(item.pedidoId);
    if (!grupo) {
      grupo = {
        pedidoId: item.pedidoId,
        codigoPedido: item.codigoPedido,
        canalCodigo: item.canalCodigo,
        canalNombre: item.canalNombre,
        numeroOrdenExterno: item.numeroOrdenExterno,
        zonaNombre: item.zonaNombre,
        canalColor: item.canalColor,
        canalIcono: item.canalIcono,
        canalUmbralAmbar: item.canalUmbralAmbar,
        canalAmbarMinutos: item.canalAmbarMinutos,
        numeroAdicion: item.numeroAdicion ?? 0,
        // Sin el instante del servidor (respuesta antigua) se usa la fecha de envío tal como llega
        envioCocinaEpochMs: item.envioCocinaEpochMs ?? new Date(item.fechaEnvioCocina).getTime(),
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
  // Empate en la hora: manda el id del pedido (el más antiguo primero); la comparación de texto ISO
  // conserva los microsegundos que Date perdería
  return [...grupos.values()].sort((a, b) =>
    a.fechaEnvioCocina < b.fechaEnvioCocina
      ? -1
      : a.fechaEnvioCocina > b.fechaEnvioCocina
        ? 1
        : a.pedidoId - b.pedidoId,
  );
};

// HU016 Esc. 5: pedidos activos por canal, para los botones de filtro de la cola
export interface ResumenCanal {
  codigo: string;
  nombre: string;
  pedidos: number;
}

// Cuenta pedidos distintos (no ítems) por canal. Si el filtro guardado apunta a un canal sin pedidos
// activos se conserva con 0, para que el cocinero pueda verlo y quitarlo
export const resumenPorCanal = (
  items: ItemCocina[],
  filtroActivo: string | null,
): ResumenCanal[] => {
  const canales = new Map<string, { nombre: string; pedidos: Set<number> }>();
  for (const item of items) {
    const canal = canales.get(item.canalCodigo) ?? {
      nombre: item.canalNombre,
      pedidos: new Set<number>(),
    };
    canal.pedidos.add(item.pedidoId);
    canales.set(item.canalCodigo, canal);
  }
  const resumen = [...canales.entries()]
    .map(([codigo, c]) => ({ codigo, nombre: c.nombre, pedidos: c.pedidos.size }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  if (filtroActivo && !canales.has(filtroActivo)) {
    resumen.push({ codigo: filtroActivo, nombre: filtroActivo, pedidos: 0 });
  }
  return resumen;
};

export const contarPedidos = (items: ItemCocina[]): number =>
  new Set(items.map((i) => i.pedidoId)).size;

export const minutosDesde = (fechaIso: string, ahora: number): number =>
  Math.max(0, Math.floor((ahora - new Date(fechaIso).getTime()) / 60000));

// HU008: los modificadores del ítem llegan unidos por coma; cocina y pase los muestran uno por uno y resaltados
export const listaModificadores = (texto?: string | null): string[] =>
  (texto ?? '')
    .split(',')
    .map((m) => m.trim())
    .filter(Boolean);

// Semáforo contra el SLA del canal: verde, ámbar desde el 75 % y rojo al superarlo
// HU025: nivel del semáforo. Verde hasta el minuto ámbar, ámbar hasta el SLA y rojo desde el SLA.
// D39: si el servidor manda el minuto ámbar ya resuelto (Salón usa los minutos de la pestaña Salón) se usa ese;
// si no, se calcula con el umbral en % del SLA (75 si no está configurado)
export type NivelSemaforo = 'verde' | 'ambar' | 'rojo';

export const nivelSemaforo = (
  minutos: number,
  sla: number,
  umbralAmbar?: number | null,
  ambarMinutos?: number | null,
): NivelSemaforo => {
  if (sla <= 0) return 'verde';
  if (minutos >= sla) return 'rojo';
  if (minutos >= (ambarMinutos ?? (sla * (umbralAmbar ?? 75)) / 100)) return 'ambar';
  return 'verde';
};

export const claseSemaforo = (
  minutos: number,
  sla: number,
  umbralAmbar?: number | null,
  ambarMinutos?: number | null,
): string => {
  const nivel = nivelSemaforo(minutos, sla, umbralAmbar, ambarMinutos);
  if (nivel === 'rojo') return 'border-error bg-error/10 text-error';
  if (nivel === 'ambar') return 'border-tertiary bg-tertiary/10 text-tertiary';
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

// HU021 Esc. 3: a dónde va el pedido. Salón: zona y mesa; para llevar, delivery o agregador: el cliente.
// Un agregador sin nombre devuelve null: en ese caso lo identifica la línea de su número de orden
export const destinoPedido = (grupo: GrupoPedido): string | null => {
  if (grupo.mesaNumero) {
    return grupo.zonaNombre
      ? `${grupo.zonaNombre} · Mesa ${grupo.mesaNumero}`
      : `Mesa ${grupo.mesaNumero}`;
  }
  return grupo.clienteNombre ?? null;
};

// HU021 Esc. 2: tiempo transcurrido como mm:ss (o h:mm:ss pasada la hora)
export const formatoCronometro = (milisegundos: number): string => {
  const total = Math.max(0, Math.floor(milisegundos / 1000));
  const horas = Math.floor(total / 3600);
  const minutos = Math.floor((total % 3600) / 60);
  const segundos = total % 60;
  const dos = (n: number) => String(n).padStart(2, '0');
  return horas > 0 ? `${horas}:${dos(minutos)}:${dos(segundos)}` : `${dos(minutos)}:${dos(segundos)}`;
};
