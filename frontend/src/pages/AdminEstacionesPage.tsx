// Pantalla de Configuración de Estaciones de Cocina para La Retama KDS (HU004)
// Permite al Administrador registrar, editar y vincular terminales PC a estaciones operativas de cocina.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import React, { useState } from 'react';
import { apiClient } from '../api/client';
import { LaRetamaWatermark } from '../components/common/LaRetamaWatermark';
import { TopAppBar } from '../components/common/TopAppBar';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import type { Estacion } from '../types';

export const AdminEstacionesPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { estacionId, vincularEstacionTerminal } = useAuth();
  const { showToast } = useToast();

  const [modalOpen, setModalOpen] = useState<boolean>(false);
  const [estacionEditando, setEstacionEditando] = useState<Estacion | null>(null);
  const [codigo, setCodigo] = useState<string>('');
  const [nombre, setNombre] = useState<string>('');
  const [errorForm, setErrorForm] = useState<string | null>(null);

  // Consulta de estaciones de cocina
  const { data: estaciones = [], isLoading } = useQuery<Estacion[]>({
    queryKey: ['estaciones'],
    queryFn: async () => (await apiClient.get('/estaciones')).data,
  });

  // Mutación para crear / actualizar estación
  const guardarMutation = useMutation({
    mutationFn: async (payload: { codigo: string; nombre: string; activa: boolean }) => {
      if (estacionEditando) {
        return (await apiClient.put(`/estaciones/${estacionEditando.id}`, payload)).data;
      }
      return (await apiClient.post('/estaciones', payload)).data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['estaciones'] });
      showToast(
        estacionEditando
          ? 'Estación actualizada exitosamente'
          : 'Nueva estación de cocina registrada',
        'success',
      );
      handleCerrarModal();
    },
    onError: (err: any) => {
      setErrorForm(err.response?.data?.mensaje || 'Error al guardar la estación de cocina.');
    },
  });

  const handleAbrirNuevo = () => {
    setEstacionEditando(null);
    setCodigo('');
    setNombre('');
    setErrorForm(null);
    setModalOpen(true);
  };

  const handleAbrirEditar = (est: Estacion) => {
    setEstacionEditando(est);
    setCodigo(est.codigo);
    setNombre(est.nombre);
    setErrorForm(null);
    setModalOpen(true);
  };

  const handleCerrarModal = () => {
    setModalOpen(false);
    setEstacionEditando(null);
    setErrorForm(null);
  };

  const handleGuardarSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!codigo.trim() || !nombre.trim()) {
      setErrorForm('El código y el nombre de la estación son obligatorios.');
      return;
    }
    guardarMutation.mutate({
      codigo: codigo.trim().toUpperCase(),
      nombre: nombre.trim(),
      activa: estacionEditando ? estacionEditando.activo : true,
    });
  };

  const handleVincularTerminal = (est: Estacion) => {
    vincularEstacionTerminal(est.id, est.nombre);
    showToast(
      `Terminal KDS vinculada exitosamente a la estación: ${est.nombre} (HU004)`,
      'success',
    );
  };

  return (
    <div className="min-h-screen flex flex-col bg-background font-sans text-on-surface">
      <TopAppBar />

      <main className="flex-1 max-w-7xl w-full mx-auto p-4 lg:p-6 flex flex-col gap-6">
        {/* Cabecera de Página */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="font-headline font-bold text-2xl text-on-surface tracking-tight">
              Configuración de Estaciones de Cocina
            </h1>
            <p className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider mt-1">
              Registro de Áreas de Producción y Vinculación Persistente de Terminales (HU004)
            </p>
          </div>

          <button
            type="button"
            onClick={handleAbrirNuevo}
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-primary hover:bg-primary-container text-on-primary rounded-xl font-bold text-xs shadow-sm transition-all active:scale-95 cursor-pointer self-start md:self-auto"
          >
            <span className="material-symbols-outlined text-[18px]">add</span>
            <span>NUEVA ESTACIÓN</span>
          </button>
        </div>

        {/* Tarjetas de Estaciones Operativas */}
        {isLoading ? (
          <div className="p-12 text-center text-on-surface-variant">
            <span className="inline-block w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mb-2" />
            <p className="text-xs font-bold">Cargando estaciones de cocina...</p>
          </div>
        ) : estaciones.length === 0 ? (
          <div className="p-12 text-center bg-surface-container-lowest rounded-xl border border-surface-container-high text-on-surface-variant">
            <span className="material-symbols-outlined text-[42px] text-outline mb-2">skillet</span>
            <p className="text-xs font-bold text-on-surface">No hay estaciones registradas</p>
            <p className="text-[11px] mt-1">Registre la primera estación operativa de cocina.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {estaciones.map((est) => {
              const estaVinculada = estacionId === est.id;
              return (
                <div
                  key={est.id}
                  className={`bg-surface-container-lowest border rounded-2xl p-5 shadow-xs flex flex-col justify-between transition-all ${
                    estaVinculada
                      ? 'border-primary ring-2 ring-primary/20 shadow-md'
                      : 'border-surface-container-high hover:border-outline'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <span className="font-mono text-xs font-extrabold uppercase px-2.5 py-1 rounded-md bg-surface-container text-on-surface border border-surface-container-high">
                        {est.codigo}
                      </span>
                      <span
                        className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full ${
                          est.activo ? 'bg-secondary/15 text-secondary' : 'bg-error/15 text-error'
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            est.activo ? 'bg-secondary' : 'bg-error'
                          }`}
                        />
                        {est.activo ? 'Operativa' : 'Inactiva'}
                      </span>
                    </div>

                    <h2 className="font-headline font-bold text-lg text-on-surface mb-1">
                      {est.nombre}
                    </h2>
                    <p className="text-xs text-on-surface-variant">
                      Ruta de preparación para platos asignados en comanderas.
                    </p>

                    {estaVinculada && (
                      <div className="mt-3 flex items-center gap-1.5 bg-primary/10 text-primary text-xs font-bold px-3 py-1.5 rounded-lg border border-primary/20">
                        <span className="material-symbols-outlined text-[16px]">
                          desktop_windows
                        </span>
                        <span>Esta terminal está vinculada a esta estación</span>
                      </div>
                    )}
                  </div>

                  <div className="mt-5 pt-4 border-t border-surface-container-high flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => handleAbrirEditar(est)}
                      className="px-3 py-1.5 rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface text-xs font-bold transition-colors cursor-pointer flex items-center gap-1"
                    >
                      <span className="material-symbols-outlined text-[16px]">edit</span>
                      <span>Editar</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleVincularTerminal(est)}
                      disabled={estaVinculada}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${
                        estaVinculada
                          ? 'bg-secondary/15 text-secondary cursor-default'
                          : 'bg-primary hover:bg-primary-container text-on-primary shadow-xs active:scale-95'
                      }`}
                    >
                      <span className="material-symbols-outlined text-[16px]">
                        {estaVinculada ? 'check_circle' : 'link'}
                      </span>
                      <span>{estaVinculada ? 'Vinculada' : 'Vincular PC'}</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Modal para Crear / Editar Estación */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-on-surface/40 backdrop-blur-xs">
          <div className="bg-surface-container-lowest w-full max-w-md rounded-2xl shadow-2xl border border-surface-container-high overflow-hidden animate-in fade-in zoom-in-95">
            <div className="bg-surface-container-low px-6 py-4 border-b border-surface-container-high flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[22px]">skillet</span>
                <h3 className="font-headline font-bold text-base text-on-surface">
                  {estacionEditando ? 'Editar Estación de Cocina' : 'Nueva Estación de Cocina'}
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

              {/* Código */}
              <div>
                <label
                  htmlFor="estacion-codigo"
                  className="block text-xs font-bold text-on-surface uppercase mb-1"
                >
                  Código de Estación * (ej. PLANCHA, BEBIDAS)
                </label>
                <input
                  id="estacion-codigo"
                  type="text"
                  required
                  value={codigo}
                  onChange={(e) => setCodigo(e.target.value.toUpperCase())}
                  placeholder="PLANCHA"
                  className="w-full bg-surface-container-low text-xs font-mono font-bold uppercase px-3 py-2.5 rounded-lg border border-surface-container-high focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              {/* Nombre */}
              <div>
                <label
                  htmlFor="estacion-nombre"
                  className="block text-xs font-bold text-on-surface uppercase mb-1"
                >
                  Nombre Descriptivo * (ej. Estación de Calientes y Plancha)
                </label>
                <input
                  id="estacion-nombre"
                  type="text"
                  required
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  placeholder="Estación de Plancha"
                  className="w-full bg-surface-container-low text-xs font-medium px-3 py-2.5 rounded-lg border border-surface-container-high focus:outline-none focus:ring-2 focus:ring-primary"
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
                  disabled={guardarMutation.isPending}
                  className="px-5 py-2.5 bg-primary hover:bg-primary-container text-on-primary text-xs font-bold rounded-lg shadow-sm transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
                >
                  {guardarMutation.isPending ? 'Guardando...' : 'GUARDAR ESTACIÓN'}
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
