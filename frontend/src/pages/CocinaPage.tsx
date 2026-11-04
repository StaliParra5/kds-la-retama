// Pantalla de Estación de Cocina (HU012)
// - Muestra solo los ítems pendientes de una estación, agrupados por pedido (Esc. 1 y 3).
// - Cada grupo lleva el código del pedido, canal, mesa y tiempo transcurrido (Esc. 2).
// - Indica cuántos ítems del pedido están en otras estaciones, solo como referencia (Esc. 4).
// - Los ítems Listos salen de la cola (Esc. 5); sin pendientes muestra "Sin pedidos" (Esc. 6).
// Estación (decisión D6): la del JWT del cocinero (terminal vinculada en HU004); el admin elige cualquiera.
import { useQuery, useQueryClient } from '@tanstack/react-query';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { apiClient } from '../api/client';
import { useTiempoReal } from '../api/tiempoReal';
import { TopAppBar } from '../components/common/TopAppBar';
import { useAuth } from '../context/AuthContext';
import type { Estacion, EstadoItem, ItemCocina } from '../types';

interface GrupoPedido {
  pedidoId: number;
  codigoPedido: string;
  canalNombre: string;
  canalSlaMinutos: number;
  mesaNumero?: string | null;
  fechaEnvioCocina: string;
  itemsEnOtrasEstaciones: number;
  items: ItemCocina[];
}

const ESTILO_ESTADO: Record<EstadoItem, { etiqueta: string; clase: string }> = {
  RECIBIDO: { etiqueta: 'Pendiente', clase: 'bg-surface-container-high text-on-surface' },
  EN_ESPERA: { etiqueta: 'En espera', clase: 'bg-tertiary/15 text-tertiary' },
  EN_PREPARACION: { etiqueta: 'En preparación', clase: 'bg-primary text-on-primary' },
  LISTO: { etiqueta: 'Listo', clase: 'bg-secondary text-on-secondary' },
  DESPACHADO: { etiqueta: 'Despachado', clase: 'bg-surface-container text-on-surface-variant' },
  ANULADO: { etiqueta: 'Anulado', clase: 'bg-error/15 text-error' },
};

// Agrupa conservando el orden de llegada que entrega el servidor (FIFO por envío a cocina)
const agruparPorPedido = (items: ItemCocina[]): GrupoPedido[] => {
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
        fechaEnvioCocina: item.fechaEnvioCocina,
        itemsEnOtrasEstaciones: item.itemsEnOtrasEstaciones,
        items: [],
      };
      grupos.set(item.pedidoId, grupo);
    }
    grupo.items.push(item);
  }
  return [...grupos.values()];
};

const minutosDesde = (fechaIso: string, ahora: number): number =>
  Math.max(0, Math.floor((ahora - new Date(fechaIso).getTime()) / 60000));

// Semáforo contra el SLA del canal: verde, ámbar desde el 75 % y rojo al superarlo
const claseSemaforo = (minutos: number, sla: number): string => {
  if (sla > 0 && minutos >= sla) return 'border-error bg-error/10 text-error';
  if (sla > 0 && minutos >= sla * 0.75) return 'border-tertiary bg-tertiary/10 text-tertiary';
  return 'border-secondary/40 bg-secondary/10 text-secondary';
};

export const CocinaPage: React.FC = () => {
  const { user, estacionId: estacionTerminal } = useAuth();
  const queryClient = useQueryClient();
  const esAdmin = user?.rol === 'ADMIN';
  const [estacionElegida, setEstacionElegida] = useState<number | null>(null);
  const [ahora, setAhora] = useState(() => Date.now());

  // El reloj de la pantalla avanza solo para refrescar los minutos transcurridos
  useEffect(() => {
    const intervalo = setInterval(() => setAhora(Date.now()), 30000);
    return () => clearInterval(intervalo);
  }, []);

  const { data: estaciones = [] } = useQuery<Estacion[]>({
    queryKey: ['estaciones'],
    queryFn: async () => (await apiClient.get('/estaciones')).data,
    enabled: esAdmin,
  });

  // Cocinero: estación del token. Admin: la elegida, o la vinculada a la PC, o la primera activa.
  const estacionId = esAdmin
    ? (estacionElegida ?? estacionTerminal ?? estaciones.find((e) => e.activo)?.id ?? null)
    : (user?.estacionId ?? null);
  const nombreEstacion = esAdmin
    ? estaciones.find((e) => e.id === estacionId)?.nombre
    : user?.estacionNombre;

  const {
    data: cola = [],
    isLoading,
    isError,
  } = useQuery<ItemCocina[]>({
    queryKey: ['cola', estacionId],
    queryFn: async () => (await apiClient.get(`/estaciones/${estacionId}/cola`)).data,
    enabled: estacionId != null,
  });

  // Cualquier novedad de la estación recarga la cola: el servidor es la única fuente de verdad.
  // Un pedido con varios ítems llega como una ráfaga de mensajes: se agrupan en una sola recarga.
  const recargaPendiente = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recargarCola = () => {
    if (recargaPendiente.current) clearTimeout(recargaPendiente.current);
    recargaPendiente.current = setTimeout(
      () => queryClient.invalidateQueries({ queryKey: ['cola', estacionId] }),
      150,
    );
  };
  useEffect(
    () => () => {
      if (recargaPendiente.current) clearTimeout(recargaPendiente.current);
    },
    [],
  );
  const { conectado, rechazo } = useTiempoReal({
    destinos: estacionId != null ? [`/topic/estacion/${estacionId}`] : [],
    alMensaje: recargarCola,
    alConectar: recargarCola,
  });

  const grupos = useMemo(() => agruparPorPedido(cola), [cola]);

  return (
    <div className="min-h-screen flex flex-col bg-background font-sans text-on-surface">
      <TopAppBar />

      <div className="bg-surface-container-lowest border-b border-surface-container-high px-4 lg:px-6 py-3">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-[28px] text-primary">skillet</span>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">
                Estación de cocina
              </p>
              {esAdmin ? (
                <select
                  aria-label="Estación"
                  value={estacionId ?? ''}
                  onChange={(e) => setEstacionElegida(Number(e.target.value))}
                  className="font-headline font-extrabold text-xl bg-transparent border-0 p-0 pr-6 focus:ring-0 cursor-pointer"
                >
                  {estaciones.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.nombre}
                      {e.activo ? '' : ' (inactiva)'}
                    </option>
                  ))}
                </select>
              ) : (
                <h2 className="font-headline font-extrabold text-xl">{nombreEstacion ?? '—'}</h2>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs font-bold text-on-surface-variant">
              {cola.length} {cola.length === 1 ? 'ítem' : 'ítems'} · {grupos.length}{' '}
              {grupos.length === 1 ? 'pedido' : 'pedidos'}
            </span>
            <span
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider border ${
                conectado
                  ? 'bg-secondary/10 text-secondary border-secondary/30'
                  : 'bg-error/10 text-error border-error/30'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${conectado ? 'bg-secondary animate-pulse' : 'bg-error'}`}
              />
              {conectado ? 'En vivo' : rechazo ? 'Sin conexión' : 'Reconectando…'}
            </span>
          </div>
        </div>
      </div>

      <main className="flex-1 max-w-7xl w-full mx-auto p-4 lg:p-6">
        {rechazo && (
          <div
            role="alert"
            className="mb-4 p-3 rounded-xl border border-error/40 bg-error/10 text-sm font-semibold text-error"
          >
            Sin actualizaciones en tiempo real: {rechazo} Vuelva a ingresar con su PIN.
          </div>
        )}
        {estacionId == null ? (
          <div className="flex flex-col items-center justify-center p-12 bg-surface-container-lowest rounded-2xl border border-dashed border-outline-variant text-center">
            <span className="material-symbols-outlined text-[48px] text-outline mb-2">
              link_off
            </span>
            <p className="font-bold">Esta terminal no está vinculada a una estación</p>
            <p className="text-sm text-on-surface-variant mt-1 max-w-md">
              Pida al administrador que la vincule en Estaciones y vuelva a ingresar con su PIN.
            </p>
          </div>
        ) : isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 animate-pulse">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-48 bg-surface-container rounded-2xl" />
            ))}
          </div>
        ) : isError ? (
          <div className="p-6 rounded-2xl border border-error/40 bg-error/10 text-error font-bold text-center">
            No se pudo cargar la cola de la estación.
          </div>
        ) : grupos.length === 0 ? (
          // HU012 Esc. 6
          <div className="flex flex-col items-center justify-center py-24 text-center text-on-surface-variant">
            <span className="material-symbols-outlined text-[64px] text-outline/60 mb-3">
              check_circle
            </span>
            <p className="font-headline text-2xl font-extrabold text-on-surface">Sin pedidos</p>
            <p className="text-sm mt-1">Los nuevos ítems de la estación aparecerán aquí.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 items-start">
            {grupos.map((grupo) => {
              const minutos = minutosDesde(grupo.fechaEnvioCocina, ahora);
              return (
                <article
                  key={grupo.pedidoId}
                  data-pedido={grupo.codigoPedido}
                  className="bg-surface-container-lowest border border-surface-container-high rounded-2xl shadow-sm overflow-hidden flex flex-col"
                >
                  <header className="px-4 py-3 bg-surface-container-low border-b border-surface-container-high flex items-start justify-between gap-2">
                    <div>
                      <p className="font-mono text-base font-extrabold text-primary">
                        {grupo.codigoPedido}
                      </p>
                      <p className="text-xs font-semibold text-on-surface-variant mt-0.5">
                        {grupo.canalNombre}
                        {grupo.mesaNumero ? ` · Mesa ${grupo.mesaNumero}` : ''}
                      </p>
                    </div>
                    <span
                      title={`SLA del canal: ${grupo.canalSlaMinutos} min`}
                      className={`flex items-center gap-1 px-2 py-1 rounded-lg border text-sm font-extrabold font-mono ${claseSemaforo(minutos, grupo.canalSlaMinutos)}`}
                    >
                      <span className="material-symbols-outlined text-[16px]">timer</span>
                      {minutos} min
                    </span>
                  </header>

                  <ul className="p-3 flex flex-col gap-2">
                    {grupo.items.map((item) => {
                      const estilo = ESTILO_ESTADO[item.estado];
                      return (
                        <li
                          key={item.id}
                          data-item={item.id}
                          className="rounded-xl border border-surface-container-high bg-surface-container-low/60 px-3 py-2.5 flex items-start justify-between gap-3"
                        >
                          <div className="min-w-0">
                            <p className="font-bold text-base leading-tight">
                              <span className="font-mono text-primary mr-1.5">
                                {item.cantidad}×
                              </span>
                              {item.platoNombre}
                            </p>
                            {item.modificadores && (
                              <p className="text-sm font-semibold text-error mt-0.5">
                                {item.modificadores}
                              </p>
                            )}
                          </div>
                          <span
                            className={`shrink-0 px-2 py-1 rounded-lg text-[11px] font-extrabold uppercase tracking-wide ${estilo.clase}`}
                          >
                            {estilo.etiqueta}
                          </span>
                        </li>
                      );
                    })}
                  </ul>

                  {/* HU012 Esc. 4: referencia de solo lectura a las otras estaciones */}
                  {grupo.itemsEnOtrasEstaciones > 0 && (
                    <footer className="px-4 py-2 border-t border-surface-container-high text-xs font-semibold text-on-surface-variant flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[16px]">call_split</span>+
                      {grupo.itemsEnOtrasEstaciones}{' '}
                      {grupo.itemsEnOtrasEstaciones === 1 ? 'ítem' : 'ítems'} en otras estaciones
                    </footer>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
};
