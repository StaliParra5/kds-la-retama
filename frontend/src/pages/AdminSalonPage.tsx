// Vista de Salón del administrador (HU048, decisiones D21 y D22) y configuración del semáforo (HU047)
// - Mesas activas agrupadas por zona, con color según la espera del pedido pendiente más antiguo.
// - Se actualiza en tiempo real (eventos de pedidos e ítems) y cada pocos segundos (aperturas y liberaciones).
// - Al tocar una mesa en atención se ve su detalle: mozos, personas, tiempos y pedidos. Solo lectura.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import React, { useEffect, useState } from 'react';
import { apiClient } from '../api/client';
import { useRecargaAgrupada, useTiempoReal } from '../api/tiempoReal';
import { TopAppBar } from '../components/common/TopAppBar';
import { useToast } from '../context/ToastContext';
import type { AtencionMesa, EstadoMesaSalon, MesaSalon, VistaSalon } from '../types';
import { ESTILO_ESTADO, minutosDesde } from '../utils/cocina';

const CLAVE_SALON = ['salon'];

const ESTILO_MESA: Record<EstadoMesaSalon, { etiqueta: string; tarjeta: string; punto: string }> = {
  LIBRE: {
    etiqueta: 'Libre',
    tarjeta: 'bg-surface-container-low border-surface-container-high text-on-surface-variant',
    punto: 'bg-outline',
  },
  VERDE: {
    etiqueta: 'En tiempo',
    tarjeta: 'bg-secondary/10 border-secondary text-secondary',
    punto: 'bg-secondary',
  },
  AMARILLO: {
    etiqueta: 'Demora',
    tarjeta: 'bg-amber-100 border-amber-500 text-amber-800',
    punto: 'bg-amber-500',
  },
  ROJO: {
    etiqueta: 'Crítica',
    tarjeta: 'bg-error/10 border-error text-error',
    punto: 'bg-error',
  },
  ATENDIDA: {
    etiqueta: 'Atendida',
    tarjeta: 'bg-primary/10 border-primary text-primary',
    punto: 'bg-primary',
  },
};

const hora = (iso: string) =>
  new Date(iso).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', hour12: false });

export const AdminSalonPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [zonaFiltro, setZonaFiltro] = useState<number | null>(null);
  const [mesaDetalle, setMesaDetalle] = useState<MesaSalon | null>(null);
  const [editarSemaforo, setEditarSemaforo] = useState<{ amarillo: string; rojo: string } | null>(
    null,
  );
  const [errorSemaforo, setErrorSemaforo] = useState<string | null>(null);
  const [ahora, setAhora] = useState(() => Date.now());

  useEffect(() => {
    const intervalo = setInterval(() => setAhora(Date.now()), 30000);
    return () => clearInterval(intervalo);
  }, []);

  // HU048 Escenario 3: en vivo por WebSocket y, como respaldo de aperturas y liberaciones, cada 4 s
  const {
    data: salon,
    isLoading,
    isError,
  } = useQuery<VistaSalon>({
    queryKey: CLAVE_SALON,
    queryFn: async () => (await apiClient.get('/salon')).data,
    refetchInterval: 4000,
  });
  const recargar = useRecargaAgrupada(CLAVE_SALON);
  const { conectado } = useTiempoReal({
    destinos: ['/topic/pedidos', '/topic/items'],
    alMensaje: recargar,
    alConectar: recargar,
  });

  const zonas = salon?.zonas ?? [];
  const zonaDeDetalle = zonas.find((z) => z.mesas.some((m) => m.id === mesaDetalle?.id));
  // El detalle sigue a la mesa con los datos más recientes de la vista
  const mesaActual = zonaDeDetalle?.mesas.find((m) => m.id === mesaDetalle?.id) ?? null;

  // Si la mesa deja de figurar (se desactivó o su zona), el detalle se cierra
  useEffect(() => {
    if (mesaDetalle && salon && !mesaActual) setMesaDetalle(null);
  }, [mesaDetalle, salon, mesaActual]);

  // Detalle de la mesa elegida (solo lectura). La clave incluye la atención: al reabrirse la mesa
  // no se muestran los pedidos de la visita anterior
  const { data: detalle, isLoading: cargandoDetalle } = useQuery<AtencionMesa>({
    queryKey: ['salon-mesa', mesaActual?.id, mesaActual?.atencionId],
    queryFn: async () => (await apiClient.get(`/mesas/${mesaActual?.id}/atencion`)).data,
    enabled: !!mesaActual?.atencionId,
    refetchInterval: 4000,
  });

  const guardarSemaforo = useMutation({
    mutationFn: async (valores: { minutosAmarillo: number; minutosRojo: number }) =>
      (await apiClient.put('/salon/semaforo', valores)).data,
    onSuccess: () => {
      showToast('Semáforo actualizado: los colores ya usan los nuevos minutos.', 'success');
      setEditarSemaforo(null);
      queryClient.invalidateQueries({ queryKey: CLAVE_SALON });
    },
    onError: (err) =>
      setErrorSemaforo(
        (axios.isAxiosError(err) && err.response?.data?.mensaje) ||
          'No se pudo guardar el semáforo.',
      ),
  });

  const enviarSemaforo = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editarSemaforo) return;
    const amarillo = Number.parseInt(editarSemaforo.amarillo, 10);
    const rojo = Number.parseInt(editarSemaforo.rojo, 10);
    if (Number.isNaN(amarillo) || amarillo <= 0) {
      setErrorSemaforo('Los minutos para amarillo deben ser mayores que cero.');
      return;
    }
    if (Number.isNaN(rojo) || rojo <= amarillo) {
      setErrorSemaforo('Los minutos para rojo deben ser mayores que los de amarillo.');
      return;
    }
    guardarSemaforo.mutate({ minutosAmarillo: amarillo, minutosRojo: rojo });
  };

  const zonasVisibles = zonaFiltro ? zonas.filter((z) => z.id === zonaFiltro) : zonas;
  const todas = zonas.flatMap((z) => z.mesas);
  const conteo = (estado: EstadoMesaSalon) => todas.filter((m) => m.estado === estado).length;

  return (
    <div className="min-h-screen flex flex-col bg-background font-sans text-on-surface">
      <TopAppBar />

      <main className="flex-1 max-w-7xl w-full mx-auto p-4 lg:p-6 flex flex-col gap-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="font-headline font-bold text-2xl tracking-tight">Vista de Salón</h1>
            <p className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider mt-1">
              Estado de las mesas por zona · solo lectura (HU048)
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider border ${
                conectado
                  ? 'bg-secondary/10 text-secondary border-secondary/30'
                  : 'bg-tertiary/10 text-tertiary border-tertiary/30'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${conectado ? 'bg-secondary animate-pulse' : 'bg-tertiary'}`}
              />
              {conectado ? 'En vivo' : 'Actualizando cada 4 s'}
            </span>
            {salon && (
              <button
                type="button"
                data-config-semaforo
                onClick={() => {
                  setErrorSemaforo(null);
                  setEditarSemaforo({
                    amarillo: String(salon.semaforo.minutosAmarillo),
                    rojo: String(salon.semaforo.minutosRojo),
                  });
                }}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl border-2 border-primary text-primary text-xs font-bold hover:bg-primary/10"
              >
                <span className="material-symbols-outlined text-[18px]">traffic</span>
                Semáforo
              </button>
            )}
          </div>
        </div>

        {/* Leyenda con los umbrales vigentes (HU047) */}
        {salon && (
          <div data-leyenda className="flex flex-wrap items-center gap-2 text-[11px] font-bold">
            {(Object.keys(ESTILO_MESA) as EstadoMesaSalon[]).map((estado) => (
              <span
                key={estado}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border ${ESTILO_MESA[estado].tarjeta}`}
              >
                <span className={`w-2 h-2 rounded-full ${ESTILO_MESA[estado].punto}`} />
                {ESTILO_MESA[estado].etiqueta}
                {estado === 'VERDE' && ` < ${salon.semaforo.minutosAmarillo} min`}
                {estado === 'AMARILLO' && ` ≥ ${salon.semaforo.minutosAmarillo} min`}
                {estado === 'ROJO' && ` ≥ ${salon.semaforo.minutosRojo} min`}
                <span className="opacity-70">({conteo(estado)})</span>
              </span>
            ))}
          </div>
        )}

        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <button
            type="button"
            onClick={() => setZonaFiltro(null)}
            className={`shrink-0 px-4 py-2 rounded-xl text-xs font-bold ${
              zonaFiltro === null
                ? 'bg-primary text-on-primary'
                : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high'
            }`}
          >
            Todas las zonas
          </button>
          {zonas.map((z) => (
            <button
              key={z.id}
              type="button"
              data-filtro-zona={z.id}
              onClick={() => setZonaFiltro(z.id)}
              className={`shrink-0 px-4 py-2 rounded-xl text-xs font-bold ${
                zonaFiltro === z.id
                  ? 'bg-primary text-on-primary'
                  : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high'
              }`}
            >
              {z.nombre}
            </button>
          ))}
        </div>

        {isLoading ? (
          <p className="p-12 text-center text-sm text-on-surface-variant">Cargando salón...</p>
        ) : isError ? (
          <p className="p-6 rounded-xl border border-error/40 bg-error/10 text-error font-bold text-center text-sm">
            No se pudo cargar la vista de salón.
          </p>
        ) : (
          zonasVisibles.map((zona) => (
            <section key={zona.id} data-zona-salon={zona.id} className="flex flex-col gap-3">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <h2 className="font-headline font-bold text-lg">{zona.nombre}</h2>
                <span className="text-xs text-on-surface-variant">
                  {zona.mozos.length > 0
                    ? `Mozos: ${zona.mozos.join(', ')}`
                    : 'Sin mozos asignados'}
                </span>
              </div>
              {zona.mesas.length === 0 ? (
                <p className="text-xs text-on-surface-variant">Sin mesas activas.</p>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3">
                  {zona.mesas.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      data-mesa-salon={m.id}
                      data-estado={m.estado}
                      onClick={() => setMesaDetalle(m)}
                      className={`flex flex-col items-center gap-0.5 p-3 rounded-xl border-2 transition-transform active:scale-95 ${ESTILO_MESA[m.estado].tarjeta}`}
                    >
                      <span className="font-headline font-black text-xl text-on-surface">
                        {m.numeroMesa}
                      </span>
                      <span className="text-[10px] font-bold uppercase tracking-wider">
                        {ESTILO_MESA[m.estado].etiqueta}
                      </span>
                      <span className="text-[10px] font-semibold text-on-surface-variant">
                        {m.minutosEspera != null
                          ? `${m.minutosEspera} min`
                          : m.personas
                            ? `${m.personas} pers.`
                            : `Cap. ${m.capacidad}`}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </section>
          ))
        )}
      </main>

      {/* HU048 Escenarios 4 y 5: detalle de la mesa, sin acciones que modifiquen */}
      {mesaActual && (
        <div className="fixed inset-0 z-50 flex items-center justify-end bg-on-surface/30 backdrop-blur-xs">
          <aside
            role="dialog"
            aria-label={`Detalle de la mesa ${mesaActual.numeroMesa}`}
            data-detalle-mesa
            className="h-full w-full max-w-md bg-surface-container-lowest shadow-2xl border-l border-surface-container-high flex flex-col"
          >
            <header className="px-5 py-4 border-b border-surface-container-high flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">
                  {zonaDeDetalle?.nombre}
                </p>
                <h2 className="font-headline font-extrabold text-xl">
                  Mesa {mesaActual.numeroMesa}
                </h2>
                <span
                  className={`inline-flex items-center gap-1.5 mt-1 px-2 py-0.5 rounded-full border text-[11px] font-bold ${ESTILO_MESA[mesaActual.estado].tarjeta}`}
                >
                  <span
                    className={`w-2 h-2 rounded-full ${ESTILO_MESA[mesaActual.estado].punto}`}
                  />
                  {ESTILO_MESA[mesaActual.estado].etiqueta}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setMesaDetalle(null)}
                aria-label="Cerrar detalle"
                className="p-1 text-on-surface-variant hover:text-on-surface"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </header>

            <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-4 text-sm">
              {!mesaActual.atencionId ? (
                <p className="text-on-surface-variant">
                  Mesa libre · capacidad {mesaActual.capacidad} personas.
                </p>
              ) : (
                <>
                  <dl className="grid grid-cols-2 gap-3">
                    <Dato titulo="Abrió la mesa" valor={mesaActual.mozoNombre ?? '-'} />
                    <Dato
                      titulo="Personas"
                      valor={`${mesaActual.personas} de ${mesaActual.capacidad}`}
                    />
                    <Dato
                      titulo="Tiempo en mesa"
                      valor={
                        mesaActual.abiertaEn
                          ? `${minutosDesde(mesaActual.abiertaEn, ahora)} min (desde ${hora(mesaActual.abiertaEn)})`
                          : '-'
                      }
                    />
                    <Dato
                      titulo="Espera de cocina"
                      valor={
                        mesaActual.minutosEspera != null
                          ? `${mesaActual.minutosEspera} min · ${mesaActual.itemsPendientes} pendientes`
                          : 'Todo despachado'
                      }
                    />
                    <div className="col-span-2">
                      <Dato
                        titulo="Mozos de la zona"
                        valor={zonaDeDetalle?.mozos.join(', ') || 'Sin mozos asignados'}
                      />
                    </div>
                  </dl>

                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-2">
                      Pedidos realizados
                    </h3>
                    {cargandoDetalle ? (
                      <p className="text-xs text-on-surface-variant">Cargando pedidos...</p>
                    ) : !detalle || detalle.pedidos.length === 0 ? (
                      <p className="text-xs text-on-surface-variant">Aún no hay pedidos.</p>
                    ) : (
                      <ul data-pedidos-detalle className="flex flex-col gap-3">
                        {detalle.pedidos.map((p) => (
                          <li
                            key={p.id}
                            className="rounded-xl border border-surface-container-high p-3"
                          >
                            <p className="flex justify-between text-xs">
                              <span className="font-mono font-extrabold text-primary">
                                {p.codigoCorrelativo}
                              </span>
                              <span className="text-on-surface-variant">
                                {p.fechaEnvioCocina ? `${hora(p.fechaEnvioCocina)} · ` : ''}
                                {p.usuarioNombre}
                              </span>
                            </p>
                            <ul className="mt-2 flex flex-col gap-1">
                              {p.items.map((i) => {
                                const estilo =
                                  ESTILO_ESTADO[i.estadoItem as keyof typeof ESTILO_ESTADO];
                                return (
                                  <li key={i.id} className="flex justify-between gap-2 text-xs">
                                    <span>
                                      {i.cantidad}× {i.platoNombre}
                                    </span>
                                    <span
                                      className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${estilo?.clase ?? ''}`}
                                    >
                                      {estilo?.etiqueta ?? i.estadoItem}
                                    </span>
                                  </li>
                                );
                              })}
                            </ul>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </>
              )}
            </div>
          </aside>
        </div>
      )}

      {/* HU047: configuración del semáforo */}
      {editarSemaforo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-on-surface/40 backdrop-blur-xs">
          <form
            role="dialog"
            aria-label="Configurar semáforo"
            onSubmit={enviarSemaforo}
            className="bg-surface-container-lowest w-full max-w-sm rounded-2xl shadow-2xl border border-surface-container-high p-6 flex flex-col gap-4"
          >
            <div>
              <h2 className="font-headline font-bold text-lg">Semáforo de mesas</h2>
              <p className="text-xs text-on-surface-variant">
                Minutos de espera desde el envío a cocina del pedido pendiente más antiguo.
              </p>
            </div>
            {errorSemaforo && (
              <p
                role="alert"
                className="p-3 bg-error-container text-on-error-container text-xs rounded-lg border border-error/20 font-medium"
              >
                {errorSemaforo}
              </p>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="semaforo-amarillo"
                  className="block text-xs font-bold uppercase mb-1"
                >
                  Amarillo desde
                </label>
                <input
                  id="semaforo-amarillo"
                  type="number"
                  value={editarSemaforo.amarillo}
                  onChange={(e) =>
                    setEditarSemaforo({ ...editarSemaforo, amarillo: e.target.value })
                  }
                  className="w-full bg-surface-container-low text-lg font-mono font-bold text-center px-3 py-2 rounded-lg border border-surface-container-high focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div>
                <label htmlFor="semaforo-rojo" className="block text-xs font-bold uppercase mb-1">
                  Rojo desde
                </label>
                <input
                  id="semaforo-rojo"
                  type="number"
                  value={editarSemaforo.rojo}
                  onChange={(e) => setEditarSemaforo({ ...editarSemaforo, rojo: e.target.value })}
                  className="w-full bg-surface-container-low text-lg font-mono font-bold text-center px-3 py-2 rounded-lg border border-surface-container-high focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setEditarSemaforo(null)}
                className="px-4 py-2 rounded-lg text-xs font-bold text-on-surface-variant hover:bg-surface-container-low"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={guardarSemaforo.isPending}
                className="px-4 py-2 rounded-lg bg-primary text-on-primary text-xs font-bold disabled:opacity-50"
              >
                GUARDAR
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

const Dato: React.FC<{ titulo: string; valor: string }> = ({ titulo, valor }) => (
  <div>
    <dt className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">
      {titulo}
    </dt>
    <dd className="text-sm font-semibold">{valor}</dd>
  </div>
);
