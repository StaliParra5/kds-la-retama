// Pantalla de Estación de Cocina (HU012 y HU014)
// - Muestra solo los ítems pendientes de una estación, agrupados por pedido (Esc. 1 y 3).
// - Cada grupo lleva el código del pedido, canal, mesa y tiempo transcurrido (Esc. 2).
// - Indica cuántos ítems del pedido están en otras estaciones, solo como referencia (Esc. 4).
// - Los ítems Listos salen de la cola (Esc. 5); sin pendientes muestra "Sin pedidos" (Esc. 6).
// - HU014: un toque inicia el ítem y otro lo marca Listo, con el cambio visible al instante (Esc. 1, 2 y 5).
//   Un ítem En espera antes de su hora pide confirmación (Esc. 3); uno Listo no cambia porque el
//   despacho se hace en el pase (Esc. 4); uno anulado mientras estaba en pantalla se informa (Esc. 6).
// Estación (decisión D6): la del JWT del cocinero (terminal vinculada en HU004); el admin elige cualquiera.
import { useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { apiClient } from '../api/client';
import { useRecargaAgrupada, useTiempoReal } from '../api/tiempoReal';
import { TopAppBar } from '../components/common/TopAppBar';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import type { Estacion, EstadoItem, ItemCocina } from '../types';
import { agruparPorPedido, claseSemaforo, ESTILO_ESTADO, minutosDesde } from '../utils/cocina';

// Siguiente estado al tocar un ítem (HU014); los demás estados no cambian con un toque
const SIGUIENTE_ESTADO: Partial<Record<EstadoItem, EstadoItem>> = {
  RECIBIDO: 'EN_PREPARACION',
  EN_ESPERA: 'EN_PREPARACION',
  EN_PREPARACION: 'LISTO',
};

// Un ítem recién marcado Listo sigue visible unos segundos antes de salir de la cola
const MS_LISTO_VISIBLE = 4000;

const horaCorta = (fechaIso: string): string =>
  new Date(fechaIso).toLocaleTimeString('es-PE', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

const esperaVigente = (item: ItemCocina, ahora: number): boolean =>
  item.estado === 'EN_ESPERA' && !!item.horaDisparo && new Date(item.horaDisparo).getTime() > ahora;

export const CocinaPage: React.FC = () => {
  const { user, estacionId: estacionTerminal } = useAuth();
  const { showToast } = useToast();
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

  // Cualquier novedad de la estación recarga la cola: el servidor es la única fuente de verdad
  const recargarCola = useRecargaAgrupada(['cola', estacionId]);
  const { conectado, rechazo } = useTiempoReal({
    destinos: estacionId != null ? [`/topic/estacion/${estacionId}`] : [],
    alMensaje: recargarCola,
    alConectar: recargarCola,
  });

  // HU014 Esc. 5: estado mostrado mientras el servidor confirma el toque (cambio optimista)
  const [estadosLocales, setEstadosLocales] = useState<Record<number, EstadoItem>>({});
  // Ítems recién marcados Listo que ya salieron de la cola pero siguen visibles unos segundos
  const [recienListos, setRecienListos] = useState<Record<number, ItemCocina>>({});
  const [itemPorConfirmar, setItemPorConfirmar] = useState<ItemCocina | null>(null);
  // Una respuesta que llega después de cambiar de estación (o de salir) no debe tocar la vista actual
  const estacionActual = useRef(estacionId);
  estacionActual.current = estacionId;
  const temporizadores = useRef(new Set<ReturnType<typeof setTimeout>>());

  // Al cambiar de estación se descarta lo local de la anterior
  useEffect(() => {
    setEstadosLocales({});
    setRecienListos({});
    setItemPorConfirmar(null);
  }, [estacionId]);

  useEffect(() => {
    const pendientes = temporizadores.current;
    return () => {
      estacionActual.current = null;
      for (const t of pendientes) clearTimeout(t);
    };
  }, []);

  const quitarDe =
    <T,>(id: number) =>
    (prev: Record<number, T>) => {
      const { [id]: _, ...resto } = prev;
      return resto;
    };

  const enviarCambio = async (item: ItemCocina, destino: EstadoItem, inicioAnticipado = false) => {
    const estacionDelToque = estacionId;
    const sigueEnLaEstacion = () => estacionActual.current === estacionDelToque;
    setEstadosLocales((prev) => ({ ...prev, [item.id]: destino }));
    let recargar = true;
    try {
      const { data } = await apiClient.patch<ItemCocina>(`/items/${item.id}/estado`, {
        estadoActual: item.estado,
        estadoDestino: destino,
        inicioAnticipado,
      });
      if (!sigueEnLaEstacion()) {
        return;
      }
      if (data.estado === 'LISTO') {
        setRecienListos((prev) => ({ ...prev, [data.id]: data }));
        const t = setTimeout(() => {
          temporizadores.current.delete(t);
          setRecienListos(quitarDe<ItemCocina>(data.id));
        }, MS_LISTO_VISIBLE);
        temporizadores.current.add(t);
      }
      // Una recarga en vuelo leída antes del cambio no debe pisar el estado confirmado
      await queryClient.cancelQueries({ queryKey: ['cola', estacionId] });
      queryClient.setQueryData<ItemCocina[]>(['cola', estacionId], (prev) =>
        prev?.map((i) => (i.id === data.id ? data : i)),
      );
      // Conectados, el aviso del propio cambio por WebSocket ya recarga la cola
      recargar = !conectado;
    } catch (err) {
      if (!sigueEnLaEstacion()) {
        return;
      }
      const respuesta = axios.isAxiosError(err) ? err.response : undefined;
      const vigente = respuesta?.data?.item as ItemCocina | undefined;
      if (respuesta?.data?.codigo === 'INICIO_ANTICIPADO_REQUERIDO') {
        // El reloj del servidor manda: aunque la pantalla creyera llegada la hora, se pide confirmar
        setItemPorConfirmar(item);
      } else if (respuesta?.status === 409 && vigente?.estado === 'ANULADO') {
        showToast(
          `${item.platoNombre} (${item.codigoPedido}) fue anulado. No se prepara.`,
          'error',
        );
      } else if (respuesta?.status === 409 && vigente) {
        showToast(
          `${item.platoNombre} ya está ${ESTILO_ESTADO[vigente.estado].etiqueta.toLowerCase()}: lo cambiaron en otra pantalla.`,
          'warning',
        );
      } else {
        showToast(respuesta?.data?.mensaje ?? 'No se pudo cambiar el estado del ítem.', 'error');
      }
    } finally {
      if (sigueEnLaEstacion()) {
        setEstadosLocales(quitarDe<EstadoItem>(item.id));
        if (recargar) {
          queryClient.invalidateQueries({ queryKey: ['cola', estacionId] });
        }
      }
    }
  };

  const alTocar = (item: ItemCocina) => {
    if (estadosLocales[item.id]) {
      return; // ya hay un cambio en curso para este ítem
    }
    if (item.estado === 'LISTO') {
      showToast('El ítem ya está listo: el despacho se confirma desde el pase.', 'info');
      return;
    }
    if (item.estado === 'ANULADO') {
      showToast(`${item.platoNombre} (${item.codigoPedido}) fue anulado. No se prepara.`, 'error');
      return;
    }
    const destino = SIGUIENTE_ESTADO[item.estado];
    if (!destino) {
      return;
    }
    if (esperaVigente(item, Date.now())) {
      setItemPorConfirmar(item);
      return;
    }
    void enviarCambio(item, destino);
  };

  // Lo que se ve: la cola en el orden del servidor, con los cambios en curso aplicados y los
  // recién listos intercalados en su lugar de llegada
  const visibles = useMemo(() => {
    const enCola = new Set(cola.map((i) => i.id));
    const lista = [...cola];
    const llegaAntes = (a: ItemCocina, b: ItemCocina) =>
      a.fechaEnvioCocina < b.fechaEnvioCocina ||
      (a.fechaEnvioCocina === b.fechaEnvioCocina && a.id < b.id);
    for (const extra of Object.values(recienListos)) {
      if (enCola.has(extra.id)) continue;
      const posicion = lista.findIndex((i) => llegaAntes(extra, i));
      lista.splice(posicion === -1 ? lista.length : posicion, 0, extra);
    }
    return lista.map((i) => (estadosLocales[i.id] ? { ...i, estado: estadosLocales[i.id] } : i));
  }, [cola, recienListos, estadosLocales]);

  // Si el ítem por confirmar cambia o desaparece (anulado, iniciado en otra pantalla), se cierra el diálogo
  useEffect(() => {
    if (
      itemPorConfirmar &&
      !visibles.some((i) => i.id === itemPorConfirmar.id && i.estado === 'EN_ESPERA')
    ) {
      setItemPorConfirmar(null);
    }
  }, [visibles, itemPorConfirmar]);

  const grupos = useMemo(() => agruparPorPedido(visibles), [visibles]);

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
            {/* Sin estación no hay a qué conectarse: el indicador solo aparece con estación */}
            {estacionId != null && (
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
            )}
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
              La vinculación se guarda en el navegador de esta PC. El administrador debe entrar en
              este mismo navegador, ir a Estaciones › Vincular PC y luego usted vuelve a ingresar
              con su PIN. Vincular desde otra PC u otro navegador no aplica a esta terminal.
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
                      const enCurso = !!estadosLocales[item.id];
                      return (
                        <li key={item.id} data-item={item.id} data-estado={item.estado}>
                          <button
                            type="button"
                            onClick={() => alTocar(item)}
                            aria-busy={enCurso}
                            className={`w-full text-left rounded-xl border-2 px-3 py-3 min-h-[64px] flex items-start justify-between gap-3 transition-colors active:scale-[0.99] ${estilo.fila} ${enCurso ? 'opacity-80' : ''}`}
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
                              {item.estado === 'EN_ESPERA' && item.horaDisparo && (
                                <p className="text-xs font-semibold text-tertiary mt-0.5">
                                  Disparo a las {horaCorta(item.horaDisparo)}
                                </p>
                              )}
                            </div>
                            <span
                              className={`shrink-0 px-2 py-1 rounded-lg text-[11px] font-extrabold uppercase tracking-wide ${estilo.clase}`}
                            >
                              {estilo.etiqueta}
                            </span>
                          </button>
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

      {/* HU014 Esc. 3: confirmación antes de adelantar un ítem retenido */}
      {itemPorConfirmar && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="titulo-inicio-anticipado"
            className="w-full max-w-sm bg-surface-container-lowest rounded-2xl shadow-xl p-5"
          >
            <h3 id="titulo-inicio-anticipado" className="font-headline font-extrabold text-lg">
              ¿Iniciar antes de tiempo?
            </h3>
            <p className="text-sm text-on-surface-variant mt-2">
              <strong className="text-on-surface">
                {itemPorConfirmar.cantidad}× {itemPorConfirmar.platoNombre}
              </strong>{' '}
              ({itemPorConfirmar.codigoPedido}) está en espera hasta las{' '}
              {itemPorConfirmar.horaDisparo ? horaCorta(itemPorConfirmar.horaDisparo) : '—'}.
            </p>
            <div className="flex gap-2 mt-5">
              <button
                type="button"
                onClick={() => setItemPorConfirmar(null)}
                className="flex-1 py-3 rounded-xl border border-surface-container-high font-bold text-sm"
              >
                Esperar
              </button>
              <button
                type="button"
                onClick={() => {
                  const item = itemPorConfirmar;
                  setItemPorConfirmar(null);
                  void enviarCambio(item, 'EN_PREPARACION', true);
                }}
                className="flex-1 py-3 rounded-xl bg-primary text-on-primary font-bold text-sm"
              >
                Iniciar ahora
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
