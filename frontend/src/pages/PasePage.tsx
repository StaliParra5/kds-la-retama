// Pantalla de Pase (decisión D9)
// - Lista los ítems Listos de todas las estaciones, agrupados por pedido y en orden de llegada.
// - Indica si al pedido le faltan ítems en cocina, para que el expedidor decida si espera.
// - "Despachar" confirma la salida de un ítem; "Despachar listos" saca todos los listos del pedido.
// - Se actualiza en tiempo real con el tópico general de ítems (expedidor y admin).
import { useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiClient } from '../api/client';
import { useRelojServidor } from '../api/reloj';
import { useRecargaAgrupada, useTiempoReal } from '../api/tiempoReal';
import { CanalFranja } from '../components/cocina/CanalFranja';
import { Cronometro } from '../components/cocina/Cronometro';
import { TarjetaSemaforo } from '../components/cocina/TarjetaSemaforo';
import { IndicadorConexion } from '../components/common/IndicadorConexion';
import { CLAVE_ESTADO_SISTEMA, IndicadorInternet } from '../components/common/IndicadorInternet';
import { TopAppBar } from '../components/common/TopAppBar';
import { useToast } from '../context/ToastContext';
import type { ItemCocina } from '../types';
import { agruparPorPedido, ESTILO_ESTADO } from '../utils/cocina';

const CLAVE_LISTOS = ['listos'];

export const PasePage: React.FC = () => {
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const [enCurso, setEnCurso] = useState<Set<number>>(() => new Set());
  // HU025 Esc. 3: el semáforo y el cronómetro del pase usan la hora del servidor, como en cocina
  useRelojServidor();

  const {
    data: listos = [],
    isLoading,
    isError,
  } = useQuery<ItemCocina[]>({
    queryKey: CLAVE_LISTOS,
    queryFn: async () => (await apiClient.get('/items/listos')).data,
  });

  // Cada cambio de ítem en cualquier estación recarga la lista
  const recargar = useRecargaAgrupada(CLAVE_LISTOS);
  // HU025 Esc. 4: un cambio de SLA, umbral o apariencia de un canal también recarga la lista
  const { conectado, rechazo } = useTiempoReal({
    destinos: ['/topic/items', '/topic/canales', '/topic/sistema'],
    // HU018: el aviso de internet solo actualiza su consulta; lo demás recarga los pedidos por entregar
    alMensaje: (destino, cuerpo) => {
      if (destino === '/topic/sistema') queryClient.setQueryData(CLAVE_ESTADO_SISTEMA, cuerpo);
      else recargar();
    },
    alConectar: () => {
      recargar();
      queryClient.invalidateQueries({ queryKey: CLAVE_ESTADO_SISTEMA });
    },
  });

  const marcarEnCurso = (id: number, activo: boolean) =>
    setEnCurso((prev) => {
      const siguiente = new Set(prev);
      if (activo) siguiente.add(id);
      else siguiente.delete(id);
      return siguiente;
    });

  // Devuelve null si el ítem salió del pase, o el motivo por el que no salió.
  // El llamador decide cómo avisar: un toast por ítem o un resumen del pedido.
  const despachar = async (item: ItemCocina): Promise<string | null> => {
    marcarEnCurso(item.id, true);
    try {
      await apiClient.patch(`/items/${item.id}/estado`, {
        estadoActual: 'LISTO',
        estadoDestino: 'DESPACHADO',
      });
      // Una recarga en vuelo leída antes del despacho no debe devolver el ítem a la lista
      await queryClient.cancelQueries({ queryKey: CLAVE_LISTOS });
      queryClient.setQueryData<ItemCocina[]>(CLAVE_LISTOS, (prev) =>
        prev?.filter((i) => i.id !== item.id),
      );
      return null;
    } catch (err) {
      const respuesta = axios.isAxiosError(err) ? err.response : undefined;
      const vigente = respuesta?.data?.item as ItemCocina | undefined;
      if (respuesta?.status === 409 && vigente) {
        return `${item.platoNombre} (${item.codigoPedido}) ya no está listo: está ${ESTILO_ESTADO[vigente.estado].etiqueta.toLowerCase()}.`;
      }
      return respuesta?.data?.mensaje ?? `No se pudo despachar ${item.platoNombre}.`;
    } finally {
      marcarEnCurso(item.id, false);
    }
  };

  const despacharItem = async (item: ItemCocina) => {
    const error = await despachar(item);
    if (error) {
      showToast(error, 'warning');
      queryClient.invalidateQueries({ queryKey: CLAVE_LISTOS });
    }
  };

  const despacharPedido = async (items: ItemCocina[]) => {
    const errores: string[] = [];
    for (const item of items) {
      const error = await despachar(item);
      if (error) errores.push(error);
    }
    const despachados = items.length - errores.length;
    if (despachados > 0) {
      showToast(
        `${items[0].codigoPedido}: ${despachados} ${despachados === 1 ? 'ítem despachado' : 'ítems despachados'}.`,
        'success',
      );
    }
    if (errores.length > 0) {
      showToast(
        errores.length === 1 ? errores[0] : `${errores.length} ítems no se pudieron despachar.`,
        'warning',
      );
      queryClient.invalidateQueries({ queryKey: CLAVE_LISTOS });
    }
  };

  const grupos = useMemo(() => agruparPorPedido(listos), [listos]);

  return (
    <div className="min-h-screen flex flex-col bg-background font-sans text-on-surface">
      <TopAppBar />

      <div className="bg-surface-container-lowest border-b border-surface-container-high px-4 lg:px-6 py-3">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-[28px] text-secondary">
              room_service
            </span>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">
                Pase
              </p>
              <h2 className="font-headline font-extrabold text-xl">Listos para despachar</h2>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* HU020: el expedidor registra aquí los pedidos recibidos por WhatsApp, teléfono o un agregador */}
            <Link
              to="/pase/externo"
              data-registrar-externo
              className="min-h-[44px] px-4 inline-flex items-center gap-2 rounded-xl bg-primary text-on-primary text-xs font-bold"
            >
              <span className="material-symbols-outlined text-[18px]">add_call</span>
              Registrar pedido externo
            </Link>
            <span className="text-xs font-bold text-on-surface-variant">
              {listos.length} {listos.length === 1 ? 'ítem' : 'ítems'} · {grupos.length}{' '}
              {grupos.length === 1 ? 'pedido' : 'pedidos'}
            </span>
            {/* HU038 Esc. 5 y 6: misma insignia de conexión que la estación; el pase no se bloquea (sus acciones se reintentan) */}
            <div className="flex flex-col items-end gap-1">
              <IndicadorConexion conectado={conectado} />
              {/* HU018: "Sin internet" debajo, solo cuando falta */}
              <IndicadorInternet />
            </div>
          </div>
        </div>
      </div>

      <main className="flex-1 max-w-7xl w-full mx-auto p-4 lg:p-6">
        {rechazo && (
          <div
            role="alert"
            className="mb-4 p-3 rounded-xl border border-error/40 bg-error/10 text-sm font-semibold text-error"
          >
            Sin actualizaciones en tiempo real: {rechazo}
          </div>
        )}
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 animate-pulse">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-40 bg-surface-container rounded-2xl" />
            ))}
          </div>
        ) : isError ? (
          <div className="p-6 rounded-2xl border border-error/40 bg-error/10 text-error font-bold text-center">
            No se pudieron cargar los ítems listos.
          </div>
        ) : grupos.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center text-on-surface-variant">
            <span className="material-symbols-outlined text-[64px] text-outline/60 mb-3">
              done_all
            </span>
            <p className="font-headline text-2xl font-extrabold text-on-surface">
              Sin platos por despachar
            </p>
            <p className="text-sm mt-1">Los ítems que cocina marque como listos aparecerán aquí.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 items-start">
            {grupos.map((grupo) => {
              const ocupado = grupo.items.some((i) => enCurso.has(i.id));
              return (
                // HU015/HU025: misma franja de canal y mismo marco de semáforo que en la estación (HU015 Esc. 5)
                <TarjetaSemaforo
                  key={grupo.pedidoId}
                  codigoPedido={grupo.codigoPedido}
                  envioMs={grupo.envioCocinaEpochMs}
                  slaMinutos={grupo.canalSlaMinutos}
                  umbralAmbar={grupo.canalUmbralAmbar}
                  ambarMinutos={grupo.canalAmbarMinutos}
                >
                  <CanalFranja
                    codigo={grupo.canalCodigo}
                    nombre={grupo.canalNombre}
                    color={grupo.canalColor}
                    icono={grupo.canalIcono}
                  />
                  <header className="px-4 py-3 bg-surface-container-low border-b border-surface-container-high flex items-start justify-between gap-2">
                    <div>
                      <p className="font-mono text-base font-extrabold text-primary">
                        {grupo.codigoPedido}
                      </p>
                      <p className="text-xs font-semibold text-on-surface-variant mt-0.5">
                        {grupo.mesaNumero ? `Mesa ${grupo.mesaNumero}` : ''}
                        {grupo.mesaNumero && grupo.clienteNombre ? ' · ' : ''}
                        {grupo.clienteNombre ?? ''}
                      </p>
                      {/* HU020 Esc. 3: número de orden del agregador junto al código del pedido */}
                      {grupo.numeroOrdenExterno && (
                        <p data-orden-externo className="text-xs font-bold text-on-surface mt-0.5">
                          Orden {grupo.canalNombre}: {grupo.numeroOrdenExterno}
                        </p>
                      )}
                    </div>
                    <Cronometro
                      envioMs={grupo.envioCocinaEpochMs}
                      slaMinutos={grupo.canalSlaMinutos}
                      umbralAmbar={grupo.canalUmbralAmbar}
                      ambarMinutos={grupo.canalAmbarMinutos}
                    />
                  </header>

                  {/* Si el pedido aún tiene ítems en cocina, el expedidor decide si espera */}
                  <p
                    data-pendientes={grupo.itemsPendientesPedido}
                    className={`px-4 py-1.5 text-xs font-bold flex items-center gap-1.5 ${
                      grupo.itemsPendientesPedido > 0
                        ? 'bg-tertiary/10 text-tertiary'
                        : 'bg-secondary/10 text-secondary'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[16px]">
                      {grupo.itemsPendientesPedido > 0 ? 'hourglass_top' : 'check_circle'}
                    </span>
                    {grupo.itemsPendientesPedido > 0
                      ? `Faltan ${grupo.itemsPendientesPedido} en cocina`
                      : 'Pedido completo'}
                  </p>

                  <ul className="p-3 flex flex-col gap-2">
                    {grupo.items.map((item) => (
                      <li
                        key={item.id}
                        data-item={item.id}
                        className="rounded-xl border border-secondary/40 bg-secondary/5 px-3 py-2.5 flex items-center justify-between gap-3"
                      >
                        <div className="min-w-0">
                          <p className="font-bold text-base leading-tight">
                            <span className="font-mono text-primary mr-1.5">{item.cantidad}×</span>
                            {item.platoNombre}
                          </p>
                          <p className="text-xs font-semibold text-on-surface-variant mt-0.5">
                            {item.estacionNombre}
                            {item.modificadores ? ` · ${item.modificadores}` : ''}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => void despacharItem(item)}
                          disabled={ocupado}
                          className="shrink-0 px-3 py-2 rounded-lg bg-secondary text-on-secondary text-xs font-extrabold uppercase tracking-wide disabled:opacity-50"
                        >
                          Despachar
                        </button>
                      </li>
                    ))}
                  </ul>

                  {grupo.items.length > 1 && (
                    <footer className="px-3 pb-3">
                      <button
                        type="button"
                        onClick={() => void despacharPedido(grupo.items)}
                        disabled={ocupado}
                        className="w-full py-2.5 rounded-xl border-2 border-secondary text-secondary text-xs font-extrabold uppercase tracking-wide hover:bg-secondary/10 disabled:opacity-50"
                      >
                        Despachar listos ({grupo.items.length})
                      </button>
                    </footer>
                  )}
                </TarjetaSemaforo>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
};
