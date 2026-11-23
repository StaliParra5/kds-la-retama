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
import { ahoraServidor, useRelojServidor } from '../api/reloj';
import { useRecargaAgrupada, useTiempoReal } from '../api/tiempoReal';
import { BotonDeshacer } from '../components/cocina/BotonDeshacer';
import { CanalFranja } from '../components/cocina/CanalFranja';
import { Cronometro } from '../components/cocina/Cronometro';
import { TarjetaSemaforo } from '../components/cocina/TarjetaSemaforo';
import { IndicadorConexion } from '../components/common/IndicadorConexion';
import { CLAVE_ESTADO_SISTEMA, IndicadorInternet } from '../components/common/IndicadorInternet';
import { TopAppBar } from '../components/common/TopAppBar';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import type { Estacion, EstadoItem, ItemCocina } from '../types';
import {
  agruparPorPedido,
  contarPedidos,
  destinoPedido,
  ESTILO_ESTADO,
  listaModificadores,
  resumenPorCanal,
} from '../utils/cocina';

// Siguiente estado al tocar un ítem (HU014); los demás estados no cambian con un toque
const SIGUIENTE_ESTADO: Partial<Record<EstadoItem, EstadoItem>> = {
  RECIBIDO: 'EN_PREPARACION',
  EN_ESPERA: 'EN_PREPARACION',
  EN_PREPARACION: 'LISTO',
};

// Un ítem recién marcado Listo sigue visible unos segundos antes de salir de la cola; HU033: si la ventana
// para deshacer es mayor, sigue visible toda la ventana para poder deshacerlo
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
  const [, setAhora] = useState(ahoraServidor);
  // HU016 Esc. 5: filtro por canal (null = cola completa)
  const [filtroCanal, setFiltroCanal] = useState<string | null>(null);

  // HU021 Esc. 6: la pantalla corrige su reloj con el del servidor; este reloj interno solo refresca los
  // ítems en espera (el cronómetro de cada tarjeta avanza por su cuenta cada segundo)
  useRelojServidor();
  useEffect(() => {
    const intervalo = setInterval(() => setAhora(ahoraServidor()), 30000);
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

  // El filtro se recuerda por estación: si la pantalla táctil se reinicia en pleno servicio, el cocinero
  // recupera la misma vista. localStorage puede estar bloqueado, por eso todo acceso va protegido
  const claveFiltro = estacionId != null ? `kds_filtro_canal_${estacionId}` : null;
  useEffect(() => {
    try {
      setFiltroCanal(claveFiltro ? localStorage.getItem(claveFiltro) : null);
    } catch {
      setFiltroCanal(null);
    }
  }, [claveFiltro]);
  const elegirFiltro = (codigo: string | null) => {
    setFiltroCanal(codigo);
    try {
      if (!claveFiltro) return;
      if (codigo) localStorage.setItem(claveFiltro, codigo);
      else localStorage.removeItem(claveFiltro);
    } catch {
      // sin almacenamiento: el filtro vale solo mientras la pantalla siga abierta
    }
  };

  const {
    data: cola = [],
    isLoading,
    isError,
  } = useQuery<ItemCocina[]>({
    queryKey: ['cola', estacionId],
    queryFn: async () => (await apiClient.get(`/estaciones/${estacionId}/cola`)).data,
    enabled: estacionId != null,
  });

  // HU014 Esc. 5: estado mostrado mientras el servidor confirma el toque (cambio optimista)
  const [estadosLocales, setEstadosLocales] = useState<Record<number, EstadoItem>>({});
  // Ítems recién marcados Listo que ya salieron de la cola pero siguen visibles unos segundos
  const [recienListos, setRecienListos] = useState<Record<number, ItemCocina>>({});
  const [itemPorConfirmar, setItemPorConfirmar] = useState<ItemCocina | null>(null);
  // HU032 Esc. 5: ítems que se estaban cocinando y se anularon; el aviso queda fijo hasta que el cocinero lo confirme
  const [avisosAnulacion, setAvisosAnulacion] = useState<ItemCocina[]>([]);
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

  // Cualquier novedad de la estación recarga la cola: el servidor es la única fuente de verdad.
  // HU017 Esc. 3 y 4: un ítem despachado o anulado sale al instante, sin esperar la recarga ni los
  // segundos que un ítem recién listo sigue visible; la anulación de un ítem en cola se avisa al cocinero
  const recargarCola = useRecargaAgrupada(['cola', estacionId]);
  const colaRef = useRef(cola);
  colaRef.current = cola;
  const alMensaje = (destino: string, cuerpo: unknown) => {
    // HU025 Esc. 4: cambió el SLA, el umbral o la apariencia de un canal; la cola trae los valores nuevos
    if (destino === '/topic/canales') {
      recargarCola();
      return;
    }
    // HU018: cambió la salida a internet del servidor; solo actualiza el aviso
    if (destino === '/topic/sistema') {
      queryClient.setQueryData(CLAVE_ESTADO_SISTEMA, cuerpo);
      return;
    }
    const item = (cuerpo as { item?: ItemCocina } | null)?.item;
    if (item && (item.estado === 'DESPACHADO' || item.estado === 'ANULADO')) {
      // HU032 Esc. 5: si ya se estaba cocinando el aviso queda fijo para que nadie lo termine por error;
      // si aún no se iniciaba (o ya estaba listo) basta un aviso breve
      const previo = colaRef.current.find((i) => i.id === item.id);
      if (item.estado === 'ANULADO' && (previo || recienListos[item.id])) {
        if (previo?.estado === 'EN_PREPARACION') {
          setAvisosAnulacion((prev) => [...prev.filter((a) => a.id !== item.id), item]);
        } else {
          showToast(
            `${item.platoNombre} (${item.codigoPedido}) fue anulado y se retiró de la pantalla.`,
            'warning',
          );
        }
      }
      setRecienListos(quitarDe<ItemCocina>(item.id));
      setEstadosLocales(quitarDe<EstadoItem>(item.id));
      queryClient.setQueryData<ItemCocina[]>(['cola', estacionId], (prev) =>
        prev?.filter((i) => i.id !== item.id),
      );
    }
    recargarCola();
  };
  const { conectado, rechazo } = useTiempoReal({
    destinos:
      estacionId != null
        ? [`/topic/estacion/${estacionId}`, '/topic/canales', '/topic/sistema']
        : [],
    alMensaje,
    alConectar: recargarCola,
  });

  // HU033: ventana para deshacer (la configura el administrador en Estaciones)
  const { data: configuracionCocina } = useQuery<{ ventanaRecallSegundos: number }>({
    queryKey: ['configuracion-cocina'],
    queryFn: async () => (await apiClient.get('/configuracion/cocina')).data,
    staleTime: 60000,
  });
  const ventanaRecallMs = (configuracionCocina?.ventanaRecallSegundos ?? 30) * 1000;

  // HU033: deshace el último cambio del ítem; la estación y el pase lo reciben por tiempo real
  const deshacer = async (item: ItemCocina) => {
    if (estadosLocales[item.id]) return;
    // HU038 Esc. 4: sin conexión no se intenta deshacer
    if (!conectado) {
      showToast(
        'Sin conexión con el servidor: no se pudo deshacer. Espere a que se reconecte.',
        'error',
      );
      return;
    }
    setEstadosLocales((prev) => ({ ...prev, [item.id]: item.estado }));
    try {
      const { data } = await apiClient.post<ItemCocina>(`/items/${item.id}/recall`, {
        estadoActual: item.estado,
      });
      setRecienListos(quitarDe<ItemCocina>(item.id));
      await queryClient.cancelQueries({ queryKey: ['cola', estacionId] });
      queryClient.setQueryData<ItemCocina[]>(['cola', estacionId], (prev) =>
        prev?.some((i) => i.id === data.id)
          ? prev.map((i) => (i.id === data.id ? data : i))
          : [...(prev ?? []), data],
      );
      showToast(
        `${item.platoNombre}: se deshizo el cambio, vuelve a ${ESTILO_ESTADO[data.estado].etiqueta.toLowerCase()}.`,
        'info',
      );
    } catch (err: any) {
      showToast(err.response?.data?.mensaje ?? 'No se pudo deshacer el cambio.', 'warning');
    } finally {
      setEstadosLocales(quitarDe<EstadoItem>(item.id));
      queryClient.invalidateQueries({ queryKey: ['cola', estacionId] });
    }
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
        const t = setTimeout(
          () => {
            temporizadores.current.delete(t);
            setRecienListos(quitarDe<ItemCocina>(data.id));
          },
          Math.max(MS_LISTO_VISIBLE, ventanaRecallMs),
        );
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

  // HU038 Esc. 4: sin conexión con el servidor el cambio no se puede guardar; se avisa y no se intenta
  const avisarSinConexion = () =>
    showToast(
      'Sin conexión con el servidor: el cambio no se registró. Espere a que se reconecte.',
      'error',
    );

  const alTocar = (item: ItemCocina) => {
    if (estadosLocales[item.id]) {
      return; // ya hay un cambio en curso para este ítem
    }
    if (!conectado) {
      avisarSinConexion();
      return;
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
    // Se compara con la hora del servidor, como los cronómetros: el reloj de la PC puede estar desfasado
    if (esperaVigente(item, ahoraServidor())) {
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

  // HU016 Esc. 5 y 6: la cola completa manda en los totales; el filtro solo cambia lo que se muestra
  const gruposTodos = useMemo(() => agruparPorPedido(visibles), [visibles]);
  const grupos = useMemo(
    () => (filtroCanal ? gruposTodos.filter((g) => g.canalCodigo === filtroCanal) : gruposTodos),
    [gruposTodos, filtroCanal],
  );
  const canales = useMemo(() => resumenPorCanal(cola, filtroCanal), [cola, filtroCanal]);
  const totalPedidos = useMemo(() => contarPedidos(cola), [cola]);
  const colaFiltrada = useMemo(
    () => (filtroCanal ? cola.filter((i) => i.canalCodigo === filtroCanal) : cola),
    [cola, filtroCanal],
  );
  const pedidosMostrados = useMemo(() => contarPedidos(colaFiltrada), [colaFiltrada]);
  const nombreFiltro = canales.find((c) => c.codigo === filtroCanal)?.nombre ?? filtroCanal;

  return (
    <div className="min-h-screen flex flex-col bg-background font-sans text-on-surface">
      <TopAppBar />

      <div className="sticky top-16 z-30 bg-surface-container-lowest border-b border-surface-container-high px-4 lg:px-6 py-3">
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
            <span
              data-total-pedidos={totalPedidos}
              className="text-xs font-bold text-on-surface-variant"
            >
              {filtroCanal
                ? `${pedidosMostrados} de ${totalPedidos} pedidos activos`
                : `${totalPedidos} ${totalPedidos === 1 ? 'pedido activo' : 'pedidos activos'}`}{' '}
              · {colaFiltrada.length} {colaFiltrada.length === 1 ? 'ítem' : 'ítems'}
            </span>
            {/* Sin estación no hay a qué conectarse: el indicador solo aparece con estación.
                HU038 Esc. 1, 5 y 6: misma insignia de conexión con el servidor que el comandero y el pase */}
            {estacionId != null && (
              <div className="flex flex-col items-end gap-1">
                <IndicadorConexion conectado={conectado} />
                {/* HU018: "Sin internet" debajo, para no ensanchar la barra; solo aparece cuando falta */}
                <IndicadorInternet />
              </div>
            )}
          </div>
        </div>

        {/* HU016 Esc. 5: filtro por canal; quitarlo devuelve la cola completa */}
        {canales.length > 0 && (
          <div
            data-filtro-canales
            className="max-w-7xl mx-auto mt-3 flex flex-wrap items-center gap-2"
          >
            <span className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">
              Canal
            </span>
            <button
              type="button"
              data-filtro-canal="TODOS"
              aria-pressed={filtroCanal === null}
              onClick={() => elegirFiltro(null)}
              className={`min-h-[44px] px-4 rounded-xl border text-xs font-bold transition-colors ${
                filtroCanal === null
                  ? 'bg-primary text-on-primary border-primary'
                  : 'bg-surface-container-low text-on-surface-variant border-surface-container-high hover:border-primary/50'
              }`}
            >
              Todos ({totalPedidos})
            </button>
            {canales.map((canal) => (
              <button
                key={canal.codigo}
                type="button"
                data-filtro-canal={canal.codigo}
                aria-pressed={filtroCanal === canal.codigo}
                onClick={() => elegirFiltro(filtroCanal === canal.codigo ? null : canal.codigo)}
                className={`min-h-[44px] px-4 rounded-xl border text-xs font-bold transition-colors ${
                  filtroCanal === canal.codigo
                    ? 'bg-primary text-on-primary border-primary'
                    : 'bg-surface-container-low text-on-surface-variant border-surface-container-high hover:border-primary/50'
                }`}
              >
                {canal.nombre} ({canal.pedidos})
              </button>
            ))}
          </div>
        )}
      </div>

      <main className="flex-1 max-w-7xl w-full mx-auto p-4 lg:p-6">
        {/* HU032 Esc. 5: aviso visible de un ítem anulado mientras se preparaba, solo de esta estación */}
        {avisosAnulacion.some((a) => a.estacionId === estacionId) && (
          <div
            role="alert"
            aria-live="assertive"
            data-avisos-anulacion
            className="mb-4 flex flex-col gap-2"
          >
            {avisosAnulacion
              .filter((a) => a.estacionId === estacionId)
              .map((aviso) => (
                <div
                  key={aviso.id}
                  data-aviso-anulacion={aviso.id}
                  className="flex items-start gap-3 p-3 rounded-xl border-2 border-error bg-error/10"
                >
                  <span className="material-symbols-outlined text-error text-[28px]">cancel</span>
                  <div className="flex-1">
                    <p className="text-sm font-extrabold text-error uppercase">
                      Anulado en preparación · deje de prepararlo
                    </p>
                    <p className="text-sm font-semibold">
                      {aviso.cantidad}× {aviso.platoNombre} · {aviso.codigoPedido}
                      {aviso.mesaNumero ? ` · Mesa ${aviso.mesaNumero}` : ''}
                    </p>
                    {aviso.motivoAnulacion && (
                      <p className="text-xs text-on-surface-variant">
                        Motivo: {aviso.motivoAnulacion}
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setAvisosAnulacion((prev) => prev.filter((a) => a.id !== aviso.id))
                    }
                    className="min-h-[44px] px-4 rounded-xl bg-error text-on-error text-xs font-bold"
                  >
                    Entendido
                  </button>
                </div>
              ))}
          </div>
        )}
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
          filtroCanal && totalPedidos > 0 ? (
            // HU016 Esc. 5: el filtro no deja ver pedidos, pero la cola tiene pedidos en otros canales
            <div
              data-filtro-sin-pedidos
              className="flex flex-col items-center justify-center py-24 text-center text-on-surface-variant"
            >
              <span className="material-symbols-outlined text-[64px] text-outline/60 mb-3">
                filter_alt_off
              </span>
              <p className="font-headline text-2xl font-extrabold text-on-surface">
                Sin pedidos de {nombreFiltro}
              </p>
              <p className="text-sm mt-1">
                Hay {totalPedidos} {totalPedidos === 1 ? 'pedido' : 'pedidos'} en otros canales.
              </p>
              <button
                type="button"
                onClick={() => elegirFiltro(null)}
                className="mt-4 min-h-[44px] px-5 rounded-xl bg-primary text-on-primary text-sm font-bold"
              >
                Quitar filtro
              </button>
            </div>
          ) : (
            // HU012 Esc. 6
            <div className="flex flex-col items-center justify-center py-24 text-center text-on-surface-variant">
              <span className="material-symbols-outlined text-[64px] text-outline/60 mb-3">
                check_circle
              </span>
              <p className="font-headline text-2xl font-extrabold text-on-surface">Sin pedidos</p>
              <p className="text-sm mt-1">Los nuevos ítems de la estación aparecerán aquí.</p>
            </div>
          )
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 items-start">
            {grupos.map((grupo) => {
              const destino = destinoPedido(grupo);
              return (
                // HU025: el borde de la tarjeta toma el color del semáforo; HU015: la franja superior, el del canal
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
                    {/* HU021 Esc. 1: código, canal, destino, ítems con modificadores y cronómetro en la misma tarjeta */}
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <p className="font-mono text-base font-extrabold text-primary">
                          {grupo.codigoPedido}
                        </p>
                        {/* HU021 Esc. 4: comanda agregada después a la misma mesa */}
                        {grupo.numeroAdicion > 0 && (
                          <span
                            data-adicion={grupo.numeroAdicion}
                            className="px-1.5 py-0.5 rounded-md border border-tertiary/40 bg-tertiary/15 text-tertiary text-[10px] font-extrabold uppercase tracking-wide"
                          >
                            Adición {grupo.numeroAdicion}
                          </span>
                        )}
                      </div>
                      {/* HU021 Esc. 3: salón con zona y mesa; para llevar o delivery con el cliente */}
                      {destino && (
                        <p
                          data-destino
                          className="text-sm font-bold text-on-surface leading-tight [overflow-wrap:anywhere]"
                        >
                          {destino}
                        </p>
                      )}
                      {/* HU020 Esc. 3: número de orden del agregador junto al código del pedido */}
                      {grupo.numeroOrdenExterno && (
                        <p data-orden-externo className="text-xs font-bold text-on-surface mt-0.5">
                          Orden {grupo.canalNombre}: {grupo.numeroOrdenExterno}
                        </p>
                      )}
                    </div>
                    {/* HU021 Esc. 2 y 6: avanza cada segundo con la hora del servidor */}
                    <Cronometro
                      envioMs={grupo.envioCocinaEpochMs}
                      slaMinutos={grupo.canalSlaMinutos}
                      umbralAmbar={grupo.canalUmbralAmbar}
                      ambarMinutos={grupo.canalAmbarMinutos}
                    />
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
                            aria-disabled={!conectado}
                            className={`w-full text-left rounded-xl border-2 px-3 py-3 min-h-[64px] flex items-start justify-between gap-3 transition-colors active:scale-[0.99] ${estilo.fila} ${enCurso || !conectado ? 'opacity-60' : ''}`}
                          >
                            <div className="min-w-0">
                              {/* HU021 Esc. 5: el nombre se parte en varias líneas antes que cortarse */}
                              <p className="font-bold text-base leading-tight [overflow-wrap:anywhere]">
                                <span className="font-mono text-primary mr-1.5">
                                  {item.cantidad}×
                                </span>
                                {item.platoNombre}
                                {grupo.numeroAdicion > 0 && (
                                  <span
                                    data-item-adicion
                                    className="ml-1.5 align-middle px-1.5 py-0.5 rounded bg-tertiary/15 text-tertiary text-[10px] font-extrabold uppercase"
                                  >
                                    Adición
                                  </span>
                                )}
                              </p>
                              {/* HU008 Esc. 1 y 4: cada modificador resaltado junto al ítem y su cantidad */}
                              {listaModificadores(item.modificadores).length > 0 && (
                                <p data-modificadores className="flex flex-wrap gap-1 mt-1">
                                  {listaModificadores(item.modificadores).map((mod) => (
                                    <span
                                      key={mod}
                                      className="px-2 py-0.5 rounded-md bg-error text-on-error text-xs font-extrabold uppercase tracking-wide"
                                    >
                                      {mod}
                                    </span>
                                  ))}
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
                          {/* HU033: deshacer el último toque mientras dure la ventana (tiempo debajo del botón) */}
                          {item.estadoPrevio &&
                            item.ultimoCambioEpochMs &&
                            (item.estado === 'EN_PREPARACION' || item.estado === 'LISTO') && (
                              <BotonDeshacer
                                ultimoCambioMs={item.ultimoCambioEpochMs}
                                ventanaMs={ventanaRecallMs}
                                ocupado={enCurso}
                                onDeshacer={() => void deshacer(item)}
                              />
                            )}
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
                </TarjetaSemaforo>
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
