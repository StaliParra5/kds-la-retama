// Pantalla de Configuración de Canales de Venta y SLA para La Retama KDS (HU037)
// Permite al Administrador parametrizar los tiempos objetivo de servicio (SLA > 0) por canal de atención
// y activar o desactivar canales: un canal inactivo no admite pedidos nuevos (HU010 Escenario 4).

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import React, { useState } from 'react';
import { apiClient } from '../api/client';
import { LaRetamaWatermark } from '../components/common/LaRetamaWatermark';
import { TopAppBar } from '../components/common/TopAppBar';
import { useToast } from '../context/ToastContext';
import type { CanalVenta } from '../types';

export const AdminCanalesPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  const [slasEditados, setSlasEditados] = useState<Record<number, number>>({});

  // Consultar todos los canales de venta, incluidos los inactivos para poder reactivarlos
  const { data: canales = [], isLoading } = useQuery<CanalVenta[]>({
    queryKey: ['canales', 'admin'],
    queryFn: async () => (await apiClient.get('/canales/todos')).data,
  });

  // Mutación para actualizar SLA de canal (HU037)
  const actualizarSlaMutation = useMutation({
    mutationFn: async ({ canalId, sla }: { canalId: number; sla: number }) => {
      return (await apiClient.put(`/canales/${canalId}/sla`, { slaObjetivoMinutos: sla })).data;
    },
    onSuccess: (canalActualizado) => {
      queryClient.invalidateQueries({ queryKey: ['canales'] });
      showToast(
        `Tiempo SLA para ${canalActualizado.nombre} actualizado a ${canalActualizado.slaObjetivoMinutos} min.`,
        'success',
      );
    },
    onError: (err: any) => {
      const msg = err.response?.data?.mensaje || 'Error al actualizar el tiempo SLA del canal.';
      showToast(msg, 'error');
    },
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
    onError: (err: any) => {
      const msg = err.response?.data?.mensaje || 'Error al cambiar el estado del canal.';
      showToast(msg, 'error');
    },
  });

  const handleSlaChange = (canalId: number, valor: string) => {
    const num = Number.parseInt(valor, 10);
    setSlasEditados((prev) => ({ ...prev, [canalId]: Number.isNaN(num) ? 0 : num }));
  };

  const handleGuardarSla = (canal: CanalVenta) => {
    // Lectura del nuevo SLA o fallback al valor actual persistido (HU037)
    const nuevoSla = slasEditados[canal.id] ?? canal.slaObjetivoMinutos;
    if (nuevoSla <= 0) {
      showToast('El SLA objetivo debe ser un número entero estrictamente mayor a 0.', 'warning');
      return;
    }
    actualizarSlaMutation.mutate({ canalId: canal.id, sla: nuevoSla });
  };

  const getCanalIcon = (codigo: string) => {
    switch (codigo) {
      case 'SALON':
        return 'table_restaurant';
      case 'PARA_LLEVAR':
        return 'shopping_bag';
      case 'DELIVERY':
        return 'two_wheeler';
      default:
        return 'storefront';
    }
  };

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
              Parametrización de Tiempos Máximos de Despacho y Compromisos de Servicio (HU037)
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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {canales.map((canal) => {
              const valorActual = slasEditados[canal.id] ?? canal.slaObjetivoMinutos;
              const modificado = valorActual !== canal.slaObjetivoMinutos;

              return (
                <div
                  key={canal.id}
                  className={`bg-surface-container-lowest border border-surface-container-high rounded-2xl p-6 shadow-xs flex flex-col justify-between hover:border-primary/50 transition-all text-left ${
                    canal.activo ? '' : 'opacity-60'
                  }`}
                >
                  <div>
                    <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mb-4">
                      <span className="material-symbols-outlined text-[28px]">
                        {getCanalIcon(canal.codigo)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between mb-1">
                      <h2 className="font-headline font-bold text-xl text-on-surface">
                        {canal.nombre}
                      </h2>
                      <span className="font-mono text-xs font-bold text-on-surface-variant uppercase px-2 py-0.5 rounded bg-surface-container">
                        {canal.codigo}
                      </span>
                    </div>

                    {/* Estado del canal: un canal inactivo rechaza pedidos nuevos (HU010) */}
                    <div className="flex items-center justify-between mb-3">
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

                    <p className="text-xs text-on-surface-variant mb-6">
                      {canal.codigo === 'SALON' &&
                        'Atención presencial en mesas de salón con comanda abierta por mozo.'}
                      {canal.codigo === 'PARA_LLEVAR' &&
                        'Pedidos recogidos en barra o mostrador del restaurante.'}
                      {canal.codigo === 'DELIVERY' &&
                        'Reparto a domicilio con repartidores propios del restaurante.'}
                    </p>

                    {/* Formulario de SLA */}
                    <div className="bg-surface-container-low p-4 rounded-xl border border-surface-container-high">
                      <label
                        htmlFor={`sla-input-${canal.id}`}
                        className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-2"
                      >
                        SLA Objetivo de Despacho (Minutos)
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          id={`sla-input-${canal.id}`}
                          type="number"
                          min="1"
                          max="180"
                          value={valorActual}
                          onChange={(e) => handleSlaChange(canal.id, e.target.value)}
                          className="w-28 bg-surface-container-lowest text-on-surface font-mono font-bold text-lg px-3 py-2 rounded-lg border border-surface-container-high focus:outline-none focus:ring-2 focus:ring-primary text-center"
                        />
                        <span className="text-xs font-bold text-on-surface-variant">minutos</span>
                      </div>
                      <span className="text-[10px] text-on-surface-variant mt-2 block">
                        Si un pedido excede este tiempo, se marcará en estado de Alerta/Demora.
                      </span>
                    </div>
                  </div>

                  <div className="mt-6 pt-4 border-t border-surface-container-high flex items-center justify-between">
                    <span className="text-[11px] font-medium text-on-surface-variant">
                      Actual: <strong>{canal.slaObjetivoMinutos} min</strong>
                    </span>

                    <button
                      type="button"
                      onClick={() => handleGuardarSla(canal)}
                      disabled={!modificado || actualizarSlaMutation.isPending}
                      className="px-4 py-2 bg-primary hover:bg-primary-container text-on-primary rounded-xl text-xs font-bold transition-all shadow-sm active:scale-95 disabled:opacity-40 cursor-pointer flex items-center gap-1.5"
                    >
                      <span className="material-symbols-outlined text-[16px]">save</span>
                      <span>Guardar SLA</span>
                    </button>
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
