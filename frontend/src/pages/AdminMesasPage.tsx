// Pantalla de Gestión de Zonas y Mesas de Salón para La Retama KDS (HU005, HU040, HU041)
// - Zonas: crear, editar, desactivar y reactivar (no se eliminan, D17).
// - Mesas: crear y editar número, capacidad y zona; desactivar y reactivar.
// - Una zona o mesa en atención no se desactiva ni se mueve: el servidor lo rechaza y aquí se muestra el motivo.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import React, { useState } from 'react';
import { apiClient } from '../api/client';
import { LaRetamaWatermark } from '../components/common/LaRetamaWatermark';
import { TopAppBar } from '../components/common/TopAppBar';
import { useToast } from '../context/ToastContext';
import type { Mesa, Zona } from '../types';

const CLAVE_ADMIN = ['zonas-admin'];

const mensajeError = (err: unknown, porDefecto: string): string =>
  (axios.isAxiosError(err) && err.response?.data?.mensaje) || porDefecto;

const claseInput =
  'w-full bg-surface-container-low text-xs font-medium px-3 py-2.5 rounded-lg border border-surface-container-high focus:outline-none focus:ring-2 focus:ring-primary';

interface FormZona {
  id: number | null;
  nombre: string;
  descripcion: string;
}

interface FormMesa {
  id: number | null;
  zonaId: number | '';
  numeroMesa: string;
  capacidad: string;
  activo: boolean;
  enAtencion: boolean;
}

export const AdminMesasPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  const [zonaSeleccionada, setZonaSeleccionada] = useState<number | null>(null);
  const [formZona, setFormZona] = useState<FormZona | null>(null);
  const [formMesa, setFormMesa] = useState<FormMesa | null>(null);
  const [errorForm, setErrorForm] = useState<string | null>(null);

  const { data: zonas = [], isLoading } = useQuery<Zona[]>({
    queryKey: CLAVE_ADMIN,
    queryFn: async () => (await apiClient.get('/zonas/todas')).data,
  });

  // El comandero lee /zonas y /mesas: también se refrescan tras cada cambio
  const refrescar = () => {
    queryClient.invalidateQueries({ queryKey: CLAVE_ADMIN });
    queryClient.invalidateQueries({ queryKey: ['zonas'] });
    queryClient.invalidateQueries({ queryKey: ['mesas'] });
  };

  const guardarZona = useMutation({
    mutationFn: async (f: FormZona) => {
      const cuerpo = { nombre: f.nombre, descripcion: f.descripcion };
      return f.id === null
        ? (await apiClient.post<Zona>('/zonas', cuerpo)).data
        : (await apiClient.put<Zona>(`/zonas/${f.id}`, cuerpo)).data;
    },
    onSuccess: (zona, f) => {
      refrescar();
      showToast(
        f.id === null ? `Zona "${zona.nombre}" registrada.` : `Zona "${zona.nombre}" actualizada.`,
        'success',
      );
      if (f.id === null) setZonaSeleccionada(zona.id);
      cerrarModales();
    },
    onError: (err) => setErrorForm(mensajeError(err, 'No se pudo guardar la zona.')),
  });

  const estadoZona = useMutation({
    mutationFn: async ({ id, activo }: { id: number; activo: boolean }) =>
      (await apiClient.patch<Zona>(`/zonas/${id}/estado`, { activo })).data,
    onSuccess: (zona) => {
      refrescar();
      showToast(
        zona.activo
          ? `Zona "${zona.nombre}" reactivada: vuelve a estar disponible para los mozos.`
          : `Zona "${zona.nombre}" desactivada: sus mesas ya no se muestran a los mozos.`,
        'success',
      );
    },
    onError: (err) =>
      showToast(mensajeError(err, 'No se pudo cambiar el estado de la zona.'), 'warning'),
  });

  const guardarMesa = useMutation({
    mutationFn: async (f: FormMesa) => {
      const cuerpo = {
        zonaId: Number(f.zonaId),
        numeroMesa: f.numeroMesa.trim(),
        capacidad: Number.parseInt(f.capacidad, 10),
      };
      return f.id === null
        ? (await apiClient.post<Mesa>('/mesas', cuerpo)).data
        : (await apiClient.put<Mesa>(`/mesas/${f.id}`, cuerpo)).data;
    },
    onSuccess: (mesa, f) => {
      refrescar();
      showToast(
        f.id === null
          ? `Mesa ${mesa.numeroMesa} registrada en ${mesa.zonaNombre}.`
          : `Mesa ${mesa.numeroMesa} actualizada.`,
        'success',
      );
      cerrarModales();
    },
    onError: (err) =>
      setErrorForm(
        mensajeError(
          err,
          'No se pudo guardar la mesa. Verifique que el número no se repita en la zona.',
        ),
      ),
  });

  const estadoMesa = useMutation({
    mutationFn: async ({ id, activo }: { id: number; activo: boolean }) =>
      (await apiClient.patch<Mesa>(`/mesas/${id}/estado`, { activo })).data,
    onSuccess: (mesa) => {
      refrescar();
      showToast(
        mesa.activo
          ? `Mesa ${mesa.numeroMesa} reactivada.`
          : `Mesa ${mesa.numeroMesa} desactivada.`,
        'success',
      );
      cerrarModales();
    },
    onError: (err) => setErrorForm(mensajeError(err, 'No se pudo cambiar el estado de la mesa.')),
  });

  const zonaActual = zonas.find((z) => z.id === zonaSeleccionada) ?? null;
  const todasLasMesas = zonas.flatMap((z) => z.mesas);
  const mesasVisibles = zonaActual ? zonaActual.mesas : todasLasMesas;
  const zonaDeMesa = (mesa: Mesa) => zonas.find((z) => z.id === mesa.zonaId);

  const cerrarModales = () => {
    setFormZona(null);
    setFormMesa(null);
    setErrorForm(null);
  };

  const abrirZona = (zona: Zona | null) => {
    setErrorForm(null);
    setFormZona({
      id: zona?.id ?? null,
      nombre: zona?.nombre ?? '',
      descripcion: zona?.descripcion ?? '',
    });
  };

  const abrirMesa = (mesa: Mesa | null) => {
    setErrorForm(null);
    setFormMesa(
      mesa
        ? {
            id: mesa.id,
            zonaId: mesa.zonaId,
            numeroMesa: mesa.numeroMesa,
            capacidad: String(mesa.capacidad),
            activo: mesa.activo,
            enAtencion: !!mesa.enAtencion,
          }
        : {
            id: null,
            // Las mesas nuevas solo van a zonas activas: el selector no ofrece las inactivas
            zonaId: (zonaActual?.activo ? zonaActual.id : zonas.find((z) => z.activo)?.id) ?? '',
            numeroMesa: '',
            capacidad: '4',
            activo: true,
            enAtencion: false,
          },
    );
  };

  const enviarZona = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formZona) return;
    if (!formZona.nombre.trim()) {
      setErrorForm('El nombre de la zona es obligatorio.');
      return;
    }
    guardarZona.mutate(formZona);
  };

  const enviarMesa = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formMesa) return;
    const cap = Number.parseInt(formMesa.capacidad, 10);
    if (!formMesa.numeroMesa.trim()) {
      setErrorForm('El número de mesa es obligatorio.');
      return;
    }
    if (Number.isNaN(cap) || cap <= 0) {
      setErrorForm('La capacidad de comensales debe ser mayor a 0.');
      return;
    }
    if (!formMesa.zonaId) {
      setErrorForm('Seleccione una zona de salón.');
      return;
    }
    guardarMesa.mutate(formMesa);
  };

  const zonaOriginalMesa = formMesa?.id
    ? todasLasMesas.find((m) => m.id === formMesa.id)?.zonaId
    : undefined;

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
              Zonas, mesas por zona y capacidad de comensales (HU005, HU040, HU041)
            </p>
          </div>

          <div className="flex items-center gap-2 self-start md:self-auto">
            <button
              type="button"
              onClick={() => abrirZona(null)}
              className="flex items-center justify-center gap-2 px-4 py-2.5 border-2 border-primary text-primary hover:bg-primary/10 rounded-xl font-bold text-xs transition-all active:scale-95 cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px]">add_location_alt</span>
              <span>NUEVA ZONA</span>
            </button>
            <button
              type="button"
              onClick={() => abrirMesa(null)}
              disabled={zonas.length === 0}
              className="flex items-center justify-center gap-2 px-4 py-2.5 bg-primary hover:bg-primary-container text-on-primary rounded-xl font-bold text-xs shadow-sm transition-all active:scale-95 cursor-pointer disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-[18px]">add</span>
              <span>NUEVA MESA</span>
            </button>
          </div>
        </div>

        {/* Filtro por Zona */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          <span className="text-xs font-bold text-on-surface-variant uppercase mr-1">Zona:</span>
          <button
            type="button"
            onClick={() => setZonaSeleccionada(null)}
            className={`shrink-0 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              zonaSeleccionada === null
                ? 'bg-primary text-on-primary shadow-xs'
                : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high'
            }`}
          >
            Todas las Zonas ({todasLasMesas.length} mesas)
          </button>
          {zonas.map((zona) => {
            const activa = zona.id === zonaSeleccionada;
            return (
              <button
                key={zona.id}
                type="button"
                data-zona={zona.id}
                onClick={() => setZonaSeleccionada(zona.id)}
                className={`shrink-0 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                  activa
                    ? 'bg-primary text-on-primary shadow-xs'
                    : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high'
                } ${zona.activo ? '' : 'opacity-60 line-through'}`}
              >
                {zona.nombre} ({zona.mesas.length})
              </button>
            );
          })}
        </div>

        {/* Ficha de la zona elegida */}
        {zonaActual && (
          <section
            data-zona-panel={zonaActual.id}
            className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl border ${
              zonaActual.activo
                ? 'bg-surface-container-lowest border-surface-container-high'
                : 'bg-surface-container border-outline/30'
            }`}
          >
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-headline font-bold text-base">{zonaActual.nombre}</h2>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                    zonaActual.activo ? 'bg-secondary/15 text-secondary' : 'bg-error/15 text-error'
                  }`}
                >
                  {zonaActual.activo ? 'Activa' : 'Inactiva'}
                </span>
              </div>
              <p className="text-xs text-on-surface-variant mt-0.5">
                {zonaActual.descripcion || 'Sin descripción'}
                {!zonaActual.activo && ' · Los mozos no ven esta zona ni sus mesas.'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => abrirZona(zonaActual)}
                className="px-3 py-2 rounded-lg text-xs font-bold text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low"
              >
                Editar zona
              </button>
              <button
                type="button"
                disabled={estadoZona.isPending}
                onClick={() => estadoZona.mutate({ id: zonaActual.id, activo: !zonaActual.activo })}
                className={`px-3 py-2 rounded-lg text-xs font-bold disabled:opacity-50 ${
                  zonaActual.activo
                    ? 'text-error border border-error/40 hover:bg-error/10'
                    : 'text-secondary border border-secondary/40 hover:bg-secondary/10'
                }`}
              >
                {zonaActual.activo ? 'Desactivar zona' : 'Reactivar zona'}
              </button>
            </div>
          </section>
        )}

        {/* Grilla de Mesas de Salón */}
        {isLoading ? (
          <div className="p-12 text-center text-on-surface-variant">
            <span className="inline-block w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mb-2" />
            <p className="text-xs font-bold">Cargando distribución de mesas...</p>
          </div>
        ) : mesasVisibles.length === 0 ? (
          <div className="p-12 text-center bg-surface-container-lowest rounded-xl border border-surface-container-high text-on-surface-variant">
            <span className="material-symbols-outlined text-[42px] text-outline mb-2">
              table_restaurant
            </span>
            <p className="text-xs font-bold text-on-surface">No hay mesas en esta zona</p>
            <p className="text-[11px] mt-1">Registre una nueva mesa para comenzar a comandar.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {mesasVisibles.map((m) => {
              const zonaInactiva = zonaDeMesa(m)?.activo === false;
              return (
                <button
                  key={m.id}
                  type="button"
                  data-mesa={m.id}
                  onClick={() => abrirMesa(m)}
                  title="Editar mesa"
                  className={`relative border rounded-xl p-4 shadow-xs flex flex-col items-center justify-between text-center hover:border-primary/50 transition-all group ${
                    m.activo && !zonaInactiva
                      ? 'bg-surface-container-lowest border-surface-container-high'
                      : 'bg-surface-container border-outline/20 opacity-70'
                  }`}
                >
                  {(m.enAtencion || !m.activo) && (
                    <span
                      className={`absolute top-2 right-2 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${
                        m.activo ? 'bg-tertiary/15 text-tertiary' : 'bg-error/15 text-error'
                      }`}
                    >
                      {m.activo ? 'En atención' : 'Inactiva'}
                    </span>
                  )}
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
                </button>
              );
            })}
          </div>
        )}
      </main>

      {/* Modal de Zona (crear o editar) */}
      {formZona && (
        <Modal
          icono="add_location_alt"
          titulo={formZona.id === null ? 'Nueva Zona de Salón' : 'Editar Zona'}
          onCerrar={cerrarModales}
        >
          <form onSubmit={enviarZona} className="p-6 flex flex-col gap-4 text-left">
            {errorForm && <AvisoError texto={errorForm} />}
            <div>
              <label
                htmlFor="zona-nombre"
                className="block text-xs font-bold text-on-surface uppercase mb-1"
              >
                Nombre *
              </label>
              <input
                id="zona-nombre"
                required
                maxLength={60}
                value={formZona.nombre}
                onChange={(e) => setFormZona({ ...formZona, nombre: e.target.value })}
                placeholder="Ej. Rooftop"
                className={claseInput}
              />
              <span className="text-[10px] text-on-surface-variant mt-1 block">
                No puede repetirse con otra zona, sin importar mayúsculas.
              </span>
            </div>
            <div>
              <label
                htmlFor="zona-descripcion"
                className="block text-xs font-bold text-on-surface uppercase mb-1"
              >
                Descripción
              </label>
              <input
                id="zona-descripcion"
                maxLength={255}
                value={formZona.descripcion}
                onChange={(e) => setFormZona({ ...formZona, descripcion: e.target.value })}
                placeholder="Ej. Terraza del segundo piso"
                className={claseInput}
              />
            </div>
            <BotonesModal
              onCancelar={cerrarModales}
              ocupado={guardarZona.isPending}
              texto={formZona.id === null ? 'REGISTRAR ZONA' : 'GUARDAR CAMBIOS'}
            />
          </form>
        </Modal>
      )}

      {/* Modal de Mesa (crear o editar) */}
      {formMesa && (
        <Modal
          icono="table_restaurant"
          titulo={
            formMesa.id === null ? 'Nueva Mesa de Salón' : `Editar Mesa ${formMesa.numeroMesa}`
          }
          onCerrar={cerrarModales}
        >
          <form onSubmit={enviarMesa} className="p-6 flex flex-col gap-4 text-left">
            {errorForm && <AvisoError texto={errorForm} />}
            {formMesa.enAtencion && (
              <div className="p-3 bg-tertiary/10 text-tertiary text-xs rounded-lg border border-tertiary/30 font-medium">
                Mesa en atención: puede cambiar su número o capacidad, pero no moverla de zona ni
                desactivarla hasta que sea liberada.
              </div>
            )}
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
                value={formMesa.zonaId}
                disabled={formMesa.enAtencion}
                onChange={(e) => setFormMesa({ ...formMesa, zonaId: Number(e.target.value) })}
                className={`${claseInput} disabled:opacity-60`}
              >
                <option value="">-- Seleccionar Zona --</option>
                {zonas
                  .filter((z) => z.activo || z.id === zonaOriginalMesa)
                  .map((z) => (
                    <option key={z.id} value={z.id}>
                      {z.nombre}
                      {z.activo ? '' : ' (inactiva)'}
                    </option>
                  ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="modal-numero-mesa"
                  className="block text-xs font-bold text-on-surface uppercase mb-1"
                >
                  Número de Mesa *
                </label>
                <input
                  id="modal-numero-mesa"
                  required
                  maxLength={20}
                  value={formMesa.numeroMesa}
                  onChange={(e) => setFormMesa({ ...formMesa, numeroMesa: e.target.value })}
                  placeholder="Ej. 16 o B5"
                  className={`${claseInput} font-mono font-bold`}
                />
              </div>
              <div>
                <label
                  htmlFor="modal-capacidad"
                  className="block text-xs font-bold text-on-surface uppercase mb-1"
                >
                  Capacidad *
                </label>
                <input
                  id="modal-capacidad"
                  type="number"
                  min="1"
                  max="20"
                  required
                  value={formMesa.capacidad}
                  onChange={(e) => setFormMesa({ ...formMesa, capacidad: e.target.value })}
                  className={`${claseInput} font-mono font-bold`}
                />
              </div>
            </div>
            <span className="text-[10px] text-on-surface-variant -mt-2 block">
              El número debe ser único dentro de la zona.
            </span>

            {formMesa.id !== null && (
              <div className="flex items-center justify-between gap-3 p-3 rounded-lg bg-surface-container-low border border-surface-container-high">
                <span className="text-xs font-semibold">
                  {formMesa.activo ? 'Mesa activa' : 'Mesa inactiva: los mozos no la ven'}
                </span>
                <button
                  type="button"
                  disabled={estadoMesa.isPending || (formMesa.activo && formMesa.enAtencion)}
                  onClick={() =>
                    formMesa.id !== null &&
                    estadoMesa.mutate({ id: formMesa.id, activo: !formMesa.activo })
                  }
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold disabled:opacity-50 ${
                    formMesa.activo
                      ? 'text-error border border-error/40 hover:bg-error/10'
                      : 'text-secondary border border-secondary/40 hover:bg-secondary/10'
                  }`}
                >
                  {formMesa.activo ? 'Desactivar mesa' : 'Reactivar mesa'}
                </button>
              </div>
            )}

            <BotonesModal
              onCancelar={cerrarModales}
              ocupado={guardarMesa.isPending}
              texto={formMesa.id === null ? 'REGISTRAR MESA' : 'GUARDAR CAMBIOS'}
            />
          </form>
        </Modal>
      )}

      <LaRetamaWatermark />
    </div>
  );
};

const Modal: React.FC<{
  icono: string;
  titulo: string;
  onCerrar: () => void;
  children: React.ReactNode;
}> = ({ icono, titulo, onCerrar, children }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-on-surface/40 backdrop-blur-xs">
    <div
      role="dialog"
      aria-label={titulo}
      className="bg-surface-container-lowest w-full max-w-sm rounded-2xl shadow-2xl border border-surface-container-high overflow-hidden animate-in fade-in zoom-in-95"
    >
      <div className="bg-surface-container-low px-6 py-4 border-b border-surface-container-high flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-primary text-[22px]">{icono}</span>
          <h3 className="font-headline font-bold text-base text-on-surface">{titulo}</h3>
        </div>
        <button
          type="button"
          onClick={onCerrar}
          aria-label="Cerrar"
          className="text-on-surface-variant hover:text-on-surface p-1"
        >
          <span className="material-symbols-outlined text-[20px]">close</span>
        </button>
      </div>
      {children}
    </div>
  </div>
);

const AvisoError: React.FC<{ texto: string }> = ({ texto }) => (
  <div
    role="alert"
    className="p-3 bg-error-container text-on-error-container text-xs rounded-lg border border-error/20 font-medium"
  >
    {texto}
  </div>
);

const BotonesModal: React.FC<{ onCancelar: () => void; ocupado: boolean; texto: string }> = ({
  onCancelar,
  ocupado,
  texto,
}) => (
  <div className="flex items-center justify-end gap-3 pt-3 border-t border-surface-container-high">
    <button
      type="button"
      onClick={onCancelar}
      className="px-4 py-2 text-xs font-bold text-on-surface-variant hover:text-on-surface rounded-lg"
    >
      Cancelar
    </button>
    <button
      type="submit"
      disabled={ocupado}
      className="px-5 py-2.5 bg-primary hover:bg-primary-container text-on-primary text-xs font-bold rounded-lg shadow-sm transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
    >
      {ocupado ? 'Guardando...' : texto}
    </button>
  </div>
);
