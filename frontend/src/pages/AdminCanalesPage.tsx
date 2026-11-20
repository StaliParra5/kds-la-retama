// Pantalla de Configuración de Canales de Venta y SLA para La Retama KDS (HU037)
// Permite al Administrador parametrizar los tiempos objetivo de servicio (SLA > 0) por canal de atención
// y activar o desactivar canales: un canal inactivo no admite pedidos nuevos (HU010 Escenario 4).
// - HU025: umbral ámbar del semáforo por canal (% del SLA, entre 1 y 99).
// - D39: los tiempos de Salón no se editan aquí: se configuran en la pestaña Salón (semáforo de mesas), que
//   también rige las tarjetas de salón en cocina y pase. Su color e ícono sí se editan aquí.
// - HU015: color e ícono del canal con vista previa de la franja de la tarjeta. El color se revisa al escribirlo
//   (no parecido al semáforo ni a otro canal activo, legible con texto blanco); el servidor vuelve a validar.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { apiClient } from '../api/client';
import { CanalFranja } from '../components/cocina/CanalFranja';
import { LaRetamaWatermark } from '../components/common/LaRetamaWatermark';
import { TopAppBar } from '../components/common/TopAppBar';
import { useToast } from '../context/ToastContext';
import type { CanalVenta } from '../types';
import {
  COLOR_POR_DEFECTO,
  ICONO_POR_DEFECTO,
  ICONOS_CANAL,
  problemaColorCanal,
} from '../utils/canal';

interface EdicionTiempos {
  sla?: number;
  umbral?: number;
}

interface EdicionApariencia {
  color?: string;
  icono?: string;
}

const campoNumero =
  'w-24 bg-surface-container-lowest text-on-surface font-mono font-bold text-lg px-3 py-2 rounded-lg border border-surface-container-high focus:outline-none focus:ring-2 focus:ring-primary text-center';

export const AdminCanalesPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  const [tiempos, setTiempos] = useState<Record<number, EdicionTiempos>>({});
  const [apariencias, setApariencias] = useState<Record<number, EdicionApariencia>>({});

  // Consultar todos los canales de venta, incluidos los inactivos para poder reactivarlos
  const { data: canales = [], isLoading } = useQuery<CanalVenta[]>({
    queryKey: ['canales', 'admin'],
    queryFn: async () => (await apiClient.get('/canales/todos')).data,
  });

  const errorDe = (err: any, porDefecto: string) => err.response?.data?.mensaje || porDefecto;

  // HU037/HU025: SLA y umbral ámbar se guardan juntos
  const actualizarTiemposMutation = useMutation({
    mutationFn: async ({ canalId, sla, umbral }: { canalId: number; sla: number; umbral: number }) =>
      (
        await apiClient.put(`/canales/${canalId}/sla`, {
          slaObjetivoMinutos: sla,
          umbralAmbarPorcentaje: umbral,
        })
      ).data,
    onSuccess: (canal: CanalVenta) => {
      queryClient.invalidateQueries({ queryKey: ['canales'] });
      setTiempos((prev) => ({ ...prev, [canal.id]: {} }));
      showToast(
        `${canal.nombre}: SLA ${canal.slaObjetivoMinutos} min, ámbar desde el ${canal.umbralAmbarPorcentaje} %.`,
        'success',
      );
    },
    onError: (err: any) => showToast(errorDe(err, 'Error al actualizar los tiempos del canal.'), 'error'),
  });

  // HU015: color e ícono
  const actualizarAparienciaMutation = useMutation({
    mutationFn: async ({ canalId, color, icono }: { canalId: number; color: string; icono: string }) =>
      (await apiClient.put(`/canales/${canalId}/apariencia`, { color, icono })).data,
    onSuccess: (canal: CanalVenta) => {
      queryClient.invalidateQueries({ queryKey: ['canales'] });
      setApariencias((prev) => ({ ...prev, [canal.id]: {} }));
      showToast(`Apariencia de ${canal.nombre} actualizada.`, 'success');
    },
    onError: (err: any) => showToast(errorDe(err, 'Error al actualizar la apariencia del canal.'), 'error'),
  });

  // Mutación para activar / desactivar canal (HU010)
  const cambiarEstadoMutation = useMutation({
    mutationFn: async ({ canalId, activo }: { canalId: number; activo: boolean }) => {
      return (await apiClient.patch(`/canales/${canalId}/estado`, { activo })).data;
    },
    onSuccess: (canalActualizado: CanalVenta) => {
      queryClient.invalidateQueries({ queryKey: ['canales'] });
      showToast(
        canalActualizado.activo
          ? `Canal ${canalActualizado.nombre} activado: vuelve a recibir pedidos.`
          : `Canal ${canalActualizado.nombre} desactivado: no recibirá pedidos nuevos.`,
        canalActualizado.activo ? 'success' : 'info',
      );
    },
    onError: (err: any) => showToast(errorDe(err, 'Error al cambiar el estado del canal.'), 'error'),
  });

  const editarTiempos = (canalId: number, campo: keyof EdicionTiempos, valor: string) => {
    const num = Number.parseInt(valor, 10);
    setTiempos((prev) => ({
      ...prev,
      [canalId]: { ...prev[canalId], [campo]: Number.isNaN(num) ? 0 : num },
    }));
  };

  const editarApariencia = (canalId: number, cambios: EdicionApariencia) =>
    setApariencias((prev) => ({ ...prev, [canalId]: { ...prev[canalId], ...cambios } }));

  return (
    <div className="min-h-screen flex flex-col bg-background font-sans text-on-surface">
      <TopAppBar />

      <main className="flex-1 max-w-7xl w-full mx-auto p-4 lg:p-6 flex flex-col gap-6">
        {/* Cabecera */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="font-headline font-bold text-2xl text-on-surface tracking-tight">
              Canales de Venta y Tiempos SLA
            </h1>
            <p className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider mt-1">
              Tiempos de despacho, semáforo y apariencia de cada canal (HU037, HU025, HU015)
            </p>
          </div>
        </div>

        {/* Tarjetas de Canales de Venta */}
        {isLoading ? (
          <div className="p-12 text-center text-on-surface-variant">
            <span className="inline-block w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mb-2" />
            <p className="text-xs font-bold">Cargando canales de venta...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {canales.map((canal) => {
              const sla = tiempos[canal.id]?.sla ?? canal.slaObjetivoMinutos;
              const umbral = tiempos[canal.id]?.umbral ?? canal.umbralAmbarPorcentaje ?? 75;
              const tiemposModificados =
                sla !== canal.slaObjetivoMinutos || umbral !== (canal.umbralAmbarPorcentaje ?? 75);
              const problemaTiempos =
                sla <= 0
                  ? 'El SLA debe ser mayor a 0 minutos.'
                  : umbral < 1 || umbral > 99
                    ? 'El umbral ámbar debe estar entre 1 % y 99 % del SLA.'
                    : null;

              const color = apariencias[canal.id]?.color ?? canal.color ?? COLOR_POR_DEFECTO;
              const icono = apariencias[canal.id]?.icono ?? canal.icono ?? ICONO_POR_DEFECTO;
              const aparienciaModificada =
                color !== (canal.color ?? COLOR_POR_DEFECTO) ||
                icono !== (canal.icono ?? ICONO_POR_DEFECTO);
              // HU015 Esc. 4: se compara solo con los otros canales activos
              const problemaColor = problemaColorCanal(
                color,
                canales
                  .filter((c) => c.id !== canal.id && c.activo)
                  .map((c) => ({ nombre: c.nombre, color: c.color })),
              );

              return (
                <div
                  key={canal.id}
                  data-canal-config={canal.codigo}
                  className={`bg-surface-container-lowest border border-surface-container-high rounded-2xl shadow-xs flex flex-col overflow-hidden text-left ${
                    canal.activo ? '' : 'opacity-60'
                  }`}
                >
                  {/* Vista previa de la franja tal como se verá en la tarjeta */}
                  <CanalFranja codigo={canal.codigo} nombre={canal.nombre} color={color} icono={icono} />

                  <div className="p-6 flex flex-col gap-5">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-bold text-on-surface-variant uppercase px-2 py-0.5 rounded bg-surface-container">
                        {canal.codigo}
                      </span>
                      {/* Estado del canal: un canal inactivo rechaza pedidos nuevos (HU010) */}
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                            canal.activo ? 'bg-primary/10 text-primary' : 'bg-error/10 text-error'
                          }`}
                        >
                          {canal.activo ? 'Activo' : 'Inactivo'}
                        </span>
                        <button
                          type="button"
                          role="switch"
                          aria-checked={canal.activo}
                          aria-label={`${canal.activo ? 'Desactivar' : 'Activar'} canal ${canal.nombre}`}
                          onClick={() =>
                            cambiarEstadoMutation.mutate({ canalId: canal.id, activo: !canal.activo })
                          }
                          disabled={cambiarEstadoMutation.isPending}
                          className={`relative w-10 h-5 rounded-full transition-colors disabled:opacity-50 cursor-pointer ${
                            canal.activo ? 'bg-primary' : 'bg-outline-variant'
                          }`}
                        >
                          <span
                            className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow-xs transition-transform ${
                              canal.activo ? 'translate-x-5' : ''
                            }`}
                          />
                        </button>
                      </div>
                    </div>

                    {/* HU037/HU025: SLA y umbral ámbar del semáforo; D39: Salón se configura en la pestaña Salón */}
                    {canal.codigo === 'SALON' ? (
                      <section
                        data-tiempos-salon
                        className="bg-surface-container-low p-4 rounded-xl border border-surface-container-high flex flex-col gap-2"
                      >
                        <h2 className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                          Tiempos y semáforo
                        </h2>
                        <p className="text-xs text-on-surface-variant">
                          Los tiempos de Salón se configuran en la pestaña Salón y se aplican a las mesas y a
                          las tarjetas de salón en cocina y pase. Hoy: ámbar desde{' '}
                          {canal.umbralAmbarMinutos ?? '—'} min y rojo desde {canal.slaObjetivoMinutos} min.
                        </p>
                        <Link
                          to="/admin/salon"
                          className="self-end px-4 py-2 rounded-xl border border-surface-container-high text-xs font-bold hover:border-primary/50 flex items-center gap-1.5"
                        >
                          <span className="material-symbols-outlined text-[16px]">table_restaurant</span>
                          Ir a Salón
                        </Link>
                      </section>
                    ) : (
                    <section className="bg-surface-container-low p-4 rounded-xl border border-surface-container-high flex flex-col gap-3">
                      <h2 className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                        Tiempos y semáforo
                      </h2>
                      <div className="flex flex-wrap gap-4">
                        <label className="flex flex-col gap-1 text-[11px] font-bold text-on-surface-variant">
                          SLA (minutos)
                          <input
                            id={`sla-input-${canal.id}`}
                            type="number"
                            min="1"
                            max="180"
                            value={sla}
                            onChange={(e) => editarTiempos(canal.id, 'sla', e.target.value)}
                            className={campoNumero}
                          />
                        </label>
                        <label className="flex flex-col gap-1 text-[11px] font-bold text-on-surface-variant">
                          Ámbar desde (% del SLA)
                          <input
                            id={`umbral-input-${canal.id}`}
                            type="number"
                            min="1"
                            max="99"
                            value={umbral}
                            onChange={(e) => editarTiempos(canal.id, 'umbral', e.target.value)}
                            className={campoNumero}
                          />
                        </label>
                      </div>
                      <p className="text-[11px] text-on-surface-variant">
                        Verde hasta {Math.round((sla * umbral) / 100)} min, ámbar hasta {sla} min y rojo
                        desde {sla} min.
                      </p>
                      {problemaTiempos && (
                        <p className="text-[11px] font-semibold text-error">{problemaTiempos}</p>
                      )}
                      <button
                        type="button"
                        data-guardar-tiempos={canal.codigo}
                        onClick={() =>
                          actualizarTiemposMutation.mutate({ canalId: canal.id, sla, umbral })
                        }
                        disabled={
                          !tiemposModificados || !!problemaTiempos || actualizarTiemposMutation.isPending
                        }
                        className="self-end px-4 py-2 bg-primary text-on-primary rounded-xl text-xs font-bold disabled:opacity-40 cursor-pointer flex items-center gap-1.5"
                      >
                        <span className="material-symbols-outlined text-[16px]">save</span>
                        Guardar tiempos
                      </button>
                    </section>
                    )}

                    {/* HU015: color e ícono */}
                    <section className="bg-surface-container-low p-4 rounded-xl border border-surface-container-high flex flex-col gap-3">
                      <h2 className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                        Apariencia en las tarjetas
                      </h2>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          aria-label={`Color del canal ${canal.nombre}`}
                          value={/^#[0-9a-f]{6}$/i.test(color) ? color : COLOR_POR_DEFECTO}
                          onChange={(e) => editarApariencia(canal.id, { color: e.target.value })}
                          className="w-11 h-11 rounded-lg border border-surface-container-high cursor-pointer bg-transparent"
                        />
                        <input
                          id={`color-input-${canal.id}`}
                          type="text"
                          value={color}
                          maxLength={7}
                          onChange={(e) =>
                            editarApariencia(canal.id, { color: e.target.value.trim().toLowerCase() })
                          }
                          className="w-28 bg-surface-container-lowest font-mono text-sm px-3 py-2 rounded-lg border border-surface-container-high focus:outline-none focus:ring-2 focus:ring-primary"
                        />
                      </div>
                      {problemaColor && (
                        <p data-problema-color className="text-[11px] font-semibold text-error">
                          {problemaColor}
                        </p>
                      )}
                      <fieldset className="flex flex-wrap gap-2">
                        <legend className="text-[11px] font-bold text-on-surface-variant mb-1">Ícono</legend>
                        {ICONOS_CANAL.map((opcion) => (
                          <button
                            key={opcion.nombre}
                            type="button"
                            aria-pressed={icono === opcion.nombre}
                            title={opcion.etiqueta}
                            onClick={() => editarApariencia(canal.id, { icono: opcion.nombre })}
                            className={`w-11 h-11 rounded-lg border flex items-center justify-center ${
                              icono === opcion.nombre
                                ? 'border-primary bg-primary/10 text-primary'
                                : 'border-surface-container-high hover:border-primary/50'
                            }`}
                          >
                            <span className="material-symbols-outlined text-[22px]">{opcion.nombre}</span>
                          </button>
                        ))}
                      </fieldset>
                      <button
                        type="button"
                        data-guardar-apariencia={canal.codigo}
                        onClick={() =>
                          actualizarAparienciaMutation.mutate({ canalId: canal.id, color, icono })
                        }
                        disabled={
                          !aparienciaModificada ||
                          !!problemaColor ||
                          actualizarAparienciaMutation.isPending
                        }
                        className="self-end px-4 py-2 bg-primary text-on-primary rounded-xl text-xs font-bold disabled:opacity-40 cursor-pointer flex items-center gap-1.5"
                      >
                        <span className="material-symbols-outlined text-[16px]">palette</span>
                        Guardar apariencia
                      </button>
                    </section>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      <LaRetamaWatermark />
    </div>
  );
};
