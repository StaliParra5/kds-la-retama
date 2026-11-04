// Paso previo al comandero (HU044): el mozo elige dónde va el pedido antes de ver la carta.
// - Salón: zona → mesa (cada una indica si está libre o en atención) → personas si está libre.
// - Para llevar y Delivery pasan directo al comandero.
// - Sin zonas asignadas (HU043) el salón no está disponible.
import { useMutation, useQuery } from '@tanstack/react-query';
import axios from 'axios';
import React, { useEffect, useState } from 'react';
import { apiClient } from '../../api/client';
import { useToast } from '../../context/ToastContext';
import type { AtencionMesa, CanalVenta, Mesa, Zona } from '../../types';

export interface Destino {
  canal: CanalVenta;
  // Solo en Salón: la atención abierta de la mesa elegida
  atencion: AtencionMesa | null;
}

interface Props {
  canales: CanalVenta[];
  onElegir: (destino: Destino) => void;
}

const ICONO_CANAL: Record<string, string> = {
  SALON: 'table_restaurant',
  PARA_LLEVAR: 'takeout_dining',
  DELIVERY: 'delivery_dining',
};

export const SeleccionDestino: React.FC<Props> = ({ canales, onElegir }) => {
  const { showToast } = useToast();
  const [paso, setPaso] = useState<'canal' | 'mesa'>('canal');
  const [zonaId, setZonaId] = useState<number | null>(null);
  const [mesaLibre, setMesaLibre] = useState<Mesa | null>(null);
  const [personas, setPersonas] = useState('');

  // HU043: el servidor solo entrega las zonas del mozo; cada mesa trae si está en atención
  const {
    data: zonas = [],
    isSuccess: zonasCargadas,
    refetch: refetchZonas,
  } = useQuery<Zona[]>({
    queryKey: ['zonas'],
    queryFn: async () => (await apiClient.get('/zonas')).data,
    // Otros mozos abren y liberan mesas: mientras se elige, el estado de cada una se refresca
    refetchInterval: paso === 'mesa' ? 10000 : false,
  });
  const sinZonasAsignadas = zonasCargadas && zonas.length === 0;
  const canalSalon = canales.find((c) => c.codigo === 'SALON');

  // La zona elegida puede desaparecer (se la quitaron al mozo o se desactivó): se vuelve a la primera
  useEffect(() => {
    if (zonas.length > 0 && !zonas.some((z) => z.id === zonaId)) setZonaId(zonas[0].id);
  }, [zonas, zonaId]);

  const zona = zonas.find((z) => z.id === zonaId) ?? null;

  const entrar = useMutation({
    mutationFn: async ({ mesa, personas }: { mesa: Mesa; personas?: number }) =>
      (await apiClient.post<AtencionMesa>(`/mesas/${mesa.id}/atencion`, { personas })).data,
    onSuccess: (atencion, { personas: pedidas }) => {
      // Otro mozo la abrió justo antes: se entra a su atención y se avisa que las personas no cambian
      if (pedidas !== undefined && atencion.personas !== pedidas) {
        showToast(
          `La mesa ${atencion.mesaNumero} ya estaba abierta por ${atencion.mozoNombre} con ${atencion.personas} personas.`,
          'info',
        );
      }
      setMesaLibre(null);
      if (canalSalon) onElegir({ canal: canalSalon, atencion });
    },
    onError: (err) => {
      const mensaje =
        (axios.isAxiosError(err) && err.response?.data?.mensaje) || 'No se pudo entrar a la mesa.';
      showToast(mensaje, 'warning');
      setMesaLibre(null);
      refetchZonas();
    },
  });

  const elegirCanal = (canal: CanalVenta) => {
    if (canal.codigo === 'SALON') {
      setPaso('mesa');
      refetchZonas();
      return;
    }
    onElegir({ canal, atencion: null });
  };

  const elegirMesa = (mesa: Mesa) => {
    if (entrar.isPending) return;
    if (mesa.enAtencion) {
      // HU044 Escenario 4: a una mesa en atención se entra sin volver a pedir personas
      entrar.mutate({ mesa });
      return;
    }
    setPersonas('');
    setMesaLibre(mesa);
  };

  const confirmarPersonas = (e: React.FormEvent) => {
    e.preventDefault();
    const n = Number.parseInt(personas, 10);
    if (!mesaLibre || Number.isNaN(n) || n < 1 || n > 99) {
      showToast('Indique una cantidad de personas entre 1 y 99.', 'warning');
      return;
    }
    entrar.mutate({ mesa: mesaLibre, personas: n });
  };

  return (
    <main className="flex-1 max-w-5xl w-full mx-auto p-4 lg:p-6 flex flex-col gap-5">
      {paso === 'canal' ? (
        <>
          <div>
            <h1 className="font-headline font-bold text-2xl tracking-tight">Nuevo pedido</h1>
            <p className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider mt-1">
              ¿Dónde se consume?
            </p>
          </div>
          {sinZonasAsignadas && (
            <p
              data-sin-zonas
              className="text-xs font-bold text-tertiary bg-tertiary/10 border border-tertiary/30 px-3 py-2 rounded-lg"
            >
              Sin zonas asignadas: solo puede tomar pedidos para llevar o delivery.
            </p>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {canales.map((canal) => {
              const bloqueado = canal.codigo === 'SALON' && sinZonasAsignadas;
              return (
                <button
                  key={canal.id}
                  type="button"
                  data-canal={canal.codigo}
                  disabled={bloqueado}
                  onClick={() => elegirCanal(canal)}
                  className="flex flex-col items-center justify-center gap-2 p-6 rounded-2xl border-2 border-surface-container-high bg-surface-container-lowest hover:border-primary hover:bg-primary/5 transition-all active:scale-[0.98] disabled:opacity-40 disabled:hover:border-surface-container-high disabled:hover:bg-surface-container-lowest"
                >
                  <span className="material-symbols-outlined text-[40px] text-primary">
                    {ICONO_CANAL[canal.codigo] ?? 'receipt_long'}
                  </span>
                  <span className="font-headline font-extrabold text-base">{canal.nombre}</span>
                  <span className="text-[11px] font-semibold text-on-surface-variant">
                    SLA {canal.slaObjetivoMinutos} min
                  </span>
                </button>
              );
            })}
          </div>
        </>
      ) : (
        <>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setPaso('canal')}
              className="p-2 rounded-lg hover:bg-surface-container-low text-on-surface-variant"
              aria-label="Volver a elegir el tipo de pedido"
            >
              <span className="material-symbols-outlined">arrow_back</span>
            </button>
            <div>
              <h1 className="font-headline font-bold text-2xl tracking-tight">Elija la mesa</h1>
              <p className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider mt-1">
                Salón · primero la zona, luego la mesa
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {zonas.map((z) => (
              <button
                key={z.id}
                type="button"
                data-zona-sel={z.id}
                onClick={() => setZonaId(z.id)}
                className={`shrink-0 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                  z.id === zonaId
                    ? 'bg-primary text-on-primary shadow-xs'
                    : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high'
                }`}
              >
                {z.nombre}
              </button>
            ))}
          </div>

          {zona && zona.mesas.length === 0 ? (
            <p className="p-8 text-center text-sm text-on-surface-variant">
              Esta zona no tiene mesas activas.
            </p>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-3">
              {zona?.mesas.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  data-mesa-sel={m.id}
                  data-estado={m.enAtencion ? 'en-atencion' : 'libre'}
                  disabled={entrar.isPending}
                  onClick={() => elegirMesa(m)}
                  className={`flex flex-col items-center gap-1 p-4 rounded-xl border-2 transition-all active:scale-95 disabled:opacity-60 ${
                    m.enAtencion
                      ? 'border-tertiary/50 bg-tertiary/10'
                      : 'border-secondary/40 bg-secondary/5 hover:border-secondary'
                  }`}
                >
                  <span className="font-headline font-black text-xl">{m.numeroMesa}</span>
                  <span
                    className={`text-[10px] font-bold uppercase tracking-wider ${
                      m.enAtencion ? 'text-tertiary' : 'text-secondary'
                    }`}
                  >
                    {m.enAtencion ? 'En atención' : 'Libre'}
                  </span>
                  <span className="text-[10px] text-on-surface-variant">{m.capacidad} pers.</span>
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {/* HU044 Escenario 3: cantidad de personas al abrir una mesa libre */}
      {mesaLibre && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-on-surface/40 backdrop-blur-xs">
          <form
            role="dialog"
            aria-label={`Abrir mesa ${mesaLibre.numeroMesa}`}
            onSubmit={confirmarPersonas}
            className="bg-surface-container-lowest w-full max-w-xs rounded-2xl shadow-2xl border border-surface-container-high p-6 flex flex-col gap-4"
          >
            <div>
              <h2 className="font-headline font-bold text-lg">Mesa {mesaLibre.numeroMesa}</h2>
              <p className="text-xs text-on-surface-variant">
                {mesaLibre.zonaNombre} · capacidad {mesaLibre.capacidad}
              </p>
            </div>
            <label htmlFor="personas-input" className="text-xs font-bold uppercase">
              ¿Cuántas personas?
            </label>
            <input
              id="personas-input"
              type="number"
              inputMode="numeric"
              min={1}
              max={99}
              required
              value={personas}
              onChange={(e) => setPersonas(e.target.value)}
              className="w-full bg-surface-container-low text-2xl font-mono font-bold text-center px-3 py-3 rounded-xl border border-surface-container-high focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setMesaLibre(null)}
                className="flex-1 py-2.5 rounded-xl text-xs font-bold text-on-surface-variant hover:bg-surface-container-low"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={entrar.isPending}
                className="flex-1 py-2.5 rounded-xl bg-primary text-on-primary text-xs font-bold disabled:opacity-50"
              >
                ABRIR MESA
              </button>
            </div>
          </form>
        </div>
      )}
    </main>
  );
};
