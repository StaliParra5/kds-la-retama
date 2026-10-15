// Pantalla de Gestión de Zonas y Mesas de Salón para La Retama KDS (HU005)
// Permite al Administrador gestionar la distribución física de mesas por zona y validar la unicidad de número de mesa.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import React, { useState } from 'react';
import { apiClient } from '../api/client';
import { LaRetamaWatermark } from '../components/common/LaRetamaWatermark';
import { TopAppBar } from '../components/common/TopAppBar';
import { useToast } from '../context/ToastContext';
import type { Mesa, Zona } from '../types';

export const AdminMesasPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  const [zonaSeleccionada, setZonaSeleccionada] = useState<number | null>(null);
  const [modalOpen, setModalOpen] = useState<boolean>(false);
  const [numeroMesa, setNumeroMesa] = useState<string>('');
  const [capacidad, setCapacidad] = useState<string>('4');
  const [zonaIdModal, setZonaIdModal] = useState<number | ''>('');
  const [errorForm, setErrorForm] = useState<string | null>(null);

  // Consultar Zonas
  const { data: zonas = [], isLoading: cargandoZonas } = useQuery<Zona[]>({
    queryKey: ['zonas'],
    queryFn: async () => (await apiClient.get('/zonas')).data,
  });

  // Consultar Mesas
  const { data: mesas = [], isLoading: cargandoMesas } = useQuery<Mesa[]>({
    queryKey: ['mesas'],
    queryFn: async () => (await apiClient.get('/mesas')).data,
  });

  // Mutación para crear nueva mesa
  const crearMesaMutation = useMutation({
    mutationFn: async (payload: { zonaId: number; numeroMesa: number; capacidad: number }) => {
      return (await apiClient.post('/mesas', payload)).data;
    },
    onSuccess: (mesaCreada) => {
      queryClient.invalidateQueries({ queryKey: ['mesas'] });
      queryClient.invalidateQueries({ queryKey: ['zonas'] });
      showToast(`Mesa ${mesaCreada.numeroMesa} registrada exitosamente en la zona.`, 'success');
      handleCerrarModal();
    },
    onError: (err: any) => {
      const msg =
        err.response?.data?.mensaje ||
        'Error al registrar la mesa. Verifique que el número no esté duplicado en esta zona (HU005).';
      setErrorForm(msg);
    },
  });

  const mesasFiltradas = zonaSeleccionada
    ? mesas.filter((m) => m.zonaId === zonaSeleccionada)
    : mesas;

  const handleAbrirNuevo = () => {
    setNumeroMesa('');
    setCapacidad('4');
    setZonaIdModal(zonaSeleccionada || (zonas[0]?.id ?? ''));
    setErrorForm(null);
    setModalOpen(true);
  };

  const handleCerrarModal = () => {
    setModalOpen(false);
    setErrorForm(null);
  };

  const handleGuardarSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const num = Number.parseInt(numeroMesa, 10);
    const cap = Number.parseInt(capacidad, 10);
    if (Number.isNaN(num) || num <= 0) {
      setErrorForm('El número de mesa debe ser un entero estrictamente positivo.');
      return;
    }
    if (Number.isNaN(cap) || cap <= 0) {
      setErrorForm('La capacidad de comensales debe ser mayor a 0.');
      return;
    }
    if (!zonaIdModal) {
      setErrorForm('Seleccione una zona de salón.');
      return;
    }

    crearMesaMutation.mutate({
      zonaId: Number(zonaIdModal),
      numeroMesa: num,
      capacidad: cap,
    });
  };

  return (
    <div className="min-h-screen flex flex-col bg-background font-sans text-on-surface">
      <TopAppBar />

      <main className="flex-1 max-w-7xl w-full mx-auto p-4 lg:p-6 flex flex-col gap-6">
        {/* Cabecera */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="font-headline font-bold text-2xl text-on-surface tracking-tight">
              Gestión de Zonas y Mesas de Salón
            </h1>
            <p className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider mt-1">
              Distribución de Salón, Mesas por Zona y Capacidad de Comensales (HU005)
            </p>
          </div>

          <button
            type="button"
            onClick={handleAbrirNuevo}
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-primary hover:bg-primary-container text-on-primary rounded-xl font-bold text-xs shadow-sm transition-all active:scale-95 cursor-pointer self-start md:self-auto"
          >
            <span className="material-symbols-outlined text-[18px]">add</span>
            <span>NUEVA MESA</span>
          </button>
        </div>

        {/* Filtro por Zona */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          <span className="text-xs font-bold text-on-surface-variant uppercase mr-1">Zona:</span>
          <button
            type="button"
            onClick={() => setZonaSeleccionada(null)}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              zonaSeleccionada === null
                ? 'bg-primary text-on-primary shadow-xs'
                : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high'
            }`}
          >
            Todas las Zonas ({mesas.length} mesas)
          </button>
          {zonas.map((zona) => {
            const activa = zona.id === zonaSeleccionada;
            const cantMesas = mesas.filter((m) => m.zonaId === zona.id).length;
            return (
              <button
                key={zona.id}
                type="button"
                onClick={() => setZonaSeleccionada(zona.id)}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                  activa
                    ? 'bg-primary text-on-primary shadow-xs'
                    : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high'
                }`}
              >
                {zona.nombre} ({cantMesas})
              </button>
            );
          })}
        </div>

        {/* Grilla de Mesas de Salón */}
        {cargandoMesas || cargandoZonas ? (
          <div className="p-12 text-center text-on-surface-variant">
            <span className="inline-block w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mb-2" />
            <p className="text-xs font-bold">Cargando distribución de mesas...</p>
          </div>
        ) : mesasFiltradas.length === 0 ? (
          <div className="p-12 text-center bg-surface-container-lowest rounded-xl border border-surface-container-high text-on-surface-variant">
            <span className="material-symbols-outlined text-[42px] text-outline mb-2">
              table_restaurant
            </span>
            <p className="text-xs font-bold text-on-surface">No hay mesas en esta zona</p>
            <p className="text-[11px] mt-1">Registre una nueva mesa para comenzar a comandar.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {mesasFiltradas.map((m) => (
              <div
                key={m.id}
                className="bg-surface-container-lowest border border-surface-container-high rounded-xl p-4 shadow-xs flex flex-col items-center justify-between text-center hover:border-primary/50 transition-all group"
              >
                <div className="w-12 h-12 rounded-xl bg-surface-container group-hover:bg-primary/10 group-hover:text-primary flex items-center justify-center font-headline font-black text-lg text-on-surface transition-colors mb-2">
                  {m.numeroMesa}
                </div>
                <h3 className="font-bold text-xs text-on-surface">Mesa {m.numeroMesa}</h3>
                <span className="text-[11px] text-on-surface-variant font-medium">
                  {m.zonaNombre}
                </span>
                <div className="mt-2 pt-2 border-t border-surface-container-low w-full flex items-center justify-center gap-1 text-[11px] font-semibold text-on-surface-variant">
                  <span className="material-symbols-outlined text-[14px]">group</span>
                  <span>{m.capacidad} pers.</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Modal para Crear Mesa */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-on-surface/40 backdrop-blur-xs">
          <div className="bg-surface-container-lowest w-full max-w-sm rounded-2xl shadow-2xl border border-surface-container-high overflow-hidden animate-in fade-in zoom-in-95">
            <div className="bg-surface-container-low px-6 py-4 border-b border-surface-container-high flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[22px]">
                  table_restaurant
                </span>
                <h3 className="font-headline font-bold text-base text-on-surface">
                  Nueva Mesa de Salón
                </h3>
              </div>
              <button
                type="button"
                onClick={handleCerrarModal}
                className="text-on-surface-variant hover:text-on-surface p-1"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <form onSubmit={handleGuardarSubmit} className="p-6 flex flex-col gap-4 text-left">
              {errorForm && (
                <div className="p-3 bg-error-container text-on-error-container text-xs rounded-lg border border-error/20 font-medium">
                  {errorForm}
                </div>
              )}

              {/* Zona */}
              <div>
                <label
                  htmlFor="modal-zona"
                  className="block text-xs font-bold text-on-surface uppercase mb-1"
                >
                  Zona de Ubicación *
                </label>
                <select
                  id="modal-zona"
                  required
                  value={zonaIdModal}
                  onChange={(e) => setZonaIdModal(Number(e.target.value))}
                  className="w-full bg-surface-container-low text-xs font-medium px-3 py-2.5 rounded-lg border border-surface-container-high focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="">-- Seleccionar Zona --</option>
                  {zonas.map((z) => (
                    <option key={z.id} value={z.id}>
                      {z.nombre}
                    </option>
                  ))}
                </select>
              </div>

              {/* Número de Mesa */}
              <div>
                <label
                  htmlFor="modal-numero-mesa"
                  className="block text-xs font-bold text-on-surface uppercase mb-1"
                >
                  Número de Mesa * (HU005)
                </label>
                <input
                  id="modal-numero-mesa"
                  type="number"
                  min="1"
                  required
                  value={numeroMesa}
                  onChange={(e) => setNumeroMesa(e.target.value)}
                  placeholder="Ej. 16"
                  className="w-full bg-surface-container-low text-xs font-mono font-bold px-3 py-2.5 rounded-lg border border-surface-container-high focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <span className="text-[10px] text-on-surface-variant mt-1 block">
                  Debe ser un número único dentro de la zona seleccionada.
                </span>
              </div>

              {/* Capacidad */}
              <div>
                <label
                  htmlFor="modal-capacidad"
                  className="block text-xs font-bold text-on-surface uppercase mb-1"
                >
                  Capacidad de Comensales *
                </label>
                <input
                  id="modal-capacidad"
                  type="number"
                  min="1"
                  max="20"
                  required
                  value={capacidad}
                  onChange={(e) => setCapacidad(e.target.value)}
                  placeholder="4"
                  className="w-full bg-surface-container-low text-xs font-mono font-bold px-3 py-2.5 rounded-lg border border-surface-container-high focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              {/* Botones */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-surface-container-high">
                <button
                  type="button"
                  onClick={handleCerrarModal}
                  className="px-4 py-2 text-xs font-bold text-on-surface-variant hover:text-on-surface rounded-lg"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={crearMesaMutation.isPending}
                  className="px-5 py-2.5 bg-primary hover:bg-primary-container text-on-primary text-xs font-bold rounded-lg shadow-sm transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
                >
                  {crearMesaMutation.isPending ? 'Guardando...' : 'REGISTRAR MESA'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <LaRetamaWatermark />
    </div>
  );
};
