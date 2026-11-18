// Pantalla de Gestión de Mozos para La Retama KDS (HU042, HU043)
// - HU043: asignar las zonas que atiende cada mozo (restrictivo: fuera de ellas no ve mesas).
// - Crear mozos con usuario y PIN de 4 dígitos; editar nombre y apellido; asignar un PIN nuevo.
// - Desactivar y reactivar; eliminar solo si no tiene pedidos (con historial se ofrece desactivarlo).
// - El servidor valida usuario y PIN únicos; aquí se muestran sus mensajes tal cual.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import React, { useState } from 'react';
import { apiClient } from '../api/client';
import { LaRetamaWatermark } from '../components/common/LaRetamaWatermark';
import { TopAppBar } from '../components/common/TopAppBar';
import { useToast } from '../context/ToastContext';
import type { Mozo, Zona } from '../types';

const CLAVE_MOZOS = ['mozos'];
const PIN_VALIDO = /^\d{4}$/;

const mensajeError = (err: unknown, porDefecto: string): string =>
  (axios.isAxiosError(err) && err.response?.data?.mensaje) || porDefecto;

const claseInput =
  'w-full bg-surface-container-low text-xs font-medium px-3 py-2.5 rounded-lg border border-surface-container-high focus:outline-none focus:ring-2 focus:ring-primary';

type Formulario =
  | { tipo: 'crear'; username: string; nombre: string; apellido: string; pin: string }
  | { tipo: 'editar'; mozo: Mozo; nombre: string; apellido: string }
  | { tipo: 'pin'; mozo: Mozo; pin: string };

export const AdminMozosPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  const [form, setForm] = useState<Formulario | null>(null);
  const [errorForm, setErrorForm] = useState<string | null>(null);
  // Mozo con historial que el admin intentó eliminar: se le ofrece desactivarlo
  const [ofrecerDesactivar, setOfrecerDesactivar] = useState<{
    mozo: Mozo;
    mensaje: string;
  } | null>(null);
  const [confirmarEliminar, setConfirmarEliminar] = useState<Mozo | null>(null);

  const {
    data: mozos = [],
    isLoading,
    isError,
  } = useQuery<Mozo[]>({
    queryKey: CLAVE_MOZOS,
    queryFn: async () => (await apiClient.get('/mozos')).data,
  });

  const refrescar = () => queryClient.invalidateQueries({ queryKey: CLAVE_MOZOS });

  // HU043: zonas activas que se pueden asignar (el admin recibe todo el salón activo)
  const [zonasDe, setZonasDe] = useState<{ mozo: Mozo; seleccion: number[] } | null>(null);
  const { data: zonasAsignables = [], isLoading: cargandoZonas } = useQuery<Zona[]>({
    queryKey: ['zonas-asignables'],
    queryFn: async () => (await apiClient.get('/zonas')).data,
    enabled: zonasDe !== null,
  });

  const asignarZonas = useMutation({
    mutationFn: async ({ mozo, zonaIds }: { mozo: Mozo; zonaIds: number[] }) =>
      (await apiClient.put<Mozo>(`/mozos/${mozo.id}/zonas`, { zonaIds })).data,
    onSuccess: (mozo) => {
      refrescar();
      setZonasDe(null);
      showToast(
        mozo.zonas.length === 0
          ? `${mozo.nombre} ${mozo.apellido} queda sin zonas: solo para llevar o delivery.`
          : `${mozo.nombre} ${mozo.apellido} atiende: ${mozo.zonas.map((z) => z.nombre).join(', ')}.`,
        'success',
      );
    },
    onError: (err) => showToast(mensajeError(err, 'No se pudieron asignar las zonas.'), 'warning'),
  });

  const cerrar = () => {
    setForm(null);
    setErrorForm(null);
  };

  const guardar = useMutation({
    mutationFn: async (f: Formulario) => {
      if (f.tipo === 'crear') {
        // El servidor valida el formato del usuario tal como llega: se envía sin espacios al borde
        const { nombre, apellido, pin } = f;
        return (
          await apiClient.post<Mozo>('/mozos', {
            username: f.username.trim(),
            nombre,
            apellido,
            pin,
          })
        ).data;
      }
      if (f.tipo === 'editar') {
        return (
          await apiClient.put<Mozo>(`/mozos/${f.mozo.id}`, {
            nombre: f.nombre,
            apellido: f.apellido,
          })
        ).data;
      }
      return (await apiClient.put<Mozo>(`/mozos/${f.mozo.id}/pin`, { pin: f.pin })).data;
    },
    onSuccess: (mozo, f) => {
      refrescar();
      const nombre = `${mozo.nombre} ${mozo.apellido}`;
      showToast(
        f.tipo === 'crear'
          ? `${nombre} registrado: ya puede ingresar con su PIN.`
          : f.tipo === 'editar'
            ? `Datos de ${nombre} actualizados.`
            : `PIN de ${nombre} actualizado: el anterior deja de funcionar.`,
        'success',
      );
      cerrar();
    },
    onError: (err) => setErrorForm(mensajeError(err, 'No se pudo guardar el mozo.')),
  });

  const cambiarEstado = useMutation({
    mutationFn: async ({ mozo, activo }: { mozo: Mozo; activo: boolean }) =>
      (await apiClient.patch<Mozo>(`/mozos/${mozo.id}/estado`, { activo })).data,
    onSuccess: (mozo) => {
      refrescar();
      setOfrecerDesactivar(null);
      showToast(
        mozo.activo
          ? `${mozo.nombre} ${mozo.apellido} reactivado.`
          : `${mozo.nombre} ${mozo.apellido} desactivado: ya no puede ingresar.`,
        'success',
      );
    },
    onError: (err) => showToast(mensajeError(err, 'No se pudo cambiar el estado.'), 'warning'),
  });

  const eliminar = useMutation({
    mutationFn: async (mozo: Mozo) => apiClient.delete(`/mozos/${mozo.id}`),
    onSuccess: (_r, mozo) => {
      refrescar();
      setConfirmarEliminar(null);
      showToast(`${mozo.nombre} ${mozo.apellido} eliminado.`, 'success');
    },
    onError: (err, mozo) => {
      setConfirmarEliminar(null);
      const datos = axios.isAxiosError(err) ? err.response?.data : undefined;
      if (datos?.codigo === 'MOZO_CON_HISTORIAL') {
        setOfrecerDesactivar({ mozo, mensaje: datos.mensaje });
        refrescar();
        return;
      }
      showToast(mensajeError(err, 'No se pudo eliminar el mozo.'), 'warning');
    },
  });

  const enviar = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form) return;
    if (form.tipo !== 'pin' && (!form.nombre.trim() || !form.apellido.trim())) {
      setErrorForm('El nombre y el apellido son obligatorios.');
      return;
    }
    if (form.tipo === 'crear' && !/^[A-Za-z0-9._-]{3,50}$/.test(form.username.trim())) {
      setErrorForm(
        'El usuario debe tener entre 3 y 50 caracteres: letras, números, punto, guion o guion bajo.',
      );
      return;
    }
    if (form.tipo !== 'editar' && !PIN_VALIDO.test(form.pin)) {
      setErrorForm('El PIN debe tener exactamente 4 dígitos.');
      return;
    }
    guardar.mutate(form);
  };

  const activos = mozos.filter((m) => m.activo).length;

  return (
    <div className="min-h-screen flex flex-col bg-background font-sans text-on-surface">
      <TopAppBar />

      <main className="flex-1 max-w-7xl w-full mx-auto p-4 lg:p-6 flex flex-col gap-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="font-headline font-bold text-2xl text-on-surface tracking-tight">
              Gestión de Mozos
            </h1>
            <p className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider mt-1">
              Personal de sala, acceso por PIN y estado (HU042) · {activos} activos de{' '}
              {mozos.length}
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setErrorForm(null);
              setForm({ tipo: 'crear', username: '', nombre: '', apellido: '', pin: '' });
            }}
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-primary hover:bg-primary-container text-on-primary rounded-xl font-bold text-xs shadow-sm transition-all active:scale-95 cursor-pointer self-start md:self-auto"
          >
            <span className="material-symbols-outlined text-[18px]">person_add</span>
            <span>NUEVO MOZO</span>
          </button>
        </div>

        {isLoading ? (
          <div className="p-12 text-center text-on-surface-variant">
            <span className="inline-block w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mb-2" />
            <p className="text-xs font-bold">Cargando mozos...</p>
          </div>
        ) : isError ? (
          <div className="p-6 rounded-xl border border-error/40 bg-error/10 text-error font-bold text-center text-sm">
            No se pudo cargar la lista de mozos.
          </div>
        ) : mozos.length === 0 ? (
          <div className="p-12 text-center bg-surface-container-lowest rounded-xl border border-surface-container-high text-on-surface-variant">
            <span className="material-symbols-outlined text-[42px] text-outline mb-2">badge</span>
            <p className="text-xs font-bold text-on-surface">Aún no hay mozos registrados</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {mozos.map((m) => (
              <article
                key={m.id}
                data-mozo={m.username}
                className={`rounded-xl border p-4 flex flex-col gap-3 ${
                  m.activo
                    ? 'bg-surface-container-lowest border-surface-container-high'
                    : 'bg-surface-container border-outline/20 opacity-75'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 shrink-0 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold">
                      {m.nombre.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-sm truncate">
                        {m.nombre} {m.apellido}
                      </p>
                      <p className="text-xs font-mono text-on-surface-variant truncate">
                        @{m.username}
                      </p>
                    </div>
                  </div>
                  <span
                    className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                      m.activo ? 'bg-secondary/15 text-secondary' : 'bg-error/15 text-error'
                    }`}
                  >
                    {m.activo ? 'Activo' : 'Inactivo'}
                  </span>
                </div>

                {/* HU043: zonas que atiende; sin zonas solo toma pedidos para llevar o delivery */}
                <div data-zonas className="flex flex-wrap items-center gap-1">
                  {m.zonas.length === 0 ? (
                    <span className="text-[11px] font-semibold text-tertiary">
                      Sin zonas: solo para llevar o delivery
                    </span>
                  ) : (
                    m.zonas.map((z) => (
                      <span
                        key={z.id}
                        className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                          z.activo
                            ? 'bg-primary/10 text-primary'
                            : 'bg-surface-container-high text-on-surface-variant line-through'
                        }`}
                      >
                        {z.nombre}
                      </span>
                    ))
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-surface-container-low">
                  <BotonAccion
                    icono="table_restaurant"
                    texto="Zonas"
                    onClick={() =>
                      setZonasDe({
                        mozo: m,
                        // Las inactivas asignadas se conservan: vuelven a operar al reactivarse
                        seleccion: m.zonas.map((z) => z.id),
                      })
                    }
                  />
                  <BotonAccion
                    icono="edit"
                    texto="Editar"
                    onClick={() => {
                      setErrorForm(null);
                      setForm({ tipo: 'editar', mozo: m, nombre: m.nombre, apellido: m.apellido });
                    }}
                  />
                  <BotonAccion
                    icono="pin"
                    texto="Cambiar PIN"
                    onClick={() => {
                      setErrorForm(null);
                      setForm({ tipo: 'pin', mozo: m, pin: '' });
                    }}
                  />
                  <BotonAccion
                    icono={m.activo ? 'person_off' : 'person_check'}
                    texto={m.activo ? 'Desactivar' : 'Reactivar'}
                    disabled={cambiarEstado.isPending}
                    onClick={() => cambiarEstado.mutate({ mozo: m, activo: !m.activo })}
                  />
                  <BotonAccion
                    icono="delete"
                    texto="Eliminar"
                    peligro
                    onClick={() => setConfirmarEliminar(m)}
                  />
                </div>
              </article>
            ))}
          </div>
        )}
      </main>

      {form && (
        <Dialogo
          titulo={
            form.tipo === 'crear'
              ? 'Nuevo Mozo'
              : form.tipo === 'editar'
                ? `Editar ${form.mozo.nombre} ${form.mozo.apellido}`
                : `PIN de ${form.mozo.nombre} ${form.mozo.apellido}`
          }
          onCerrar={cerrar}
        >
          <form onSubmit={enviar} className="p-6 flex flex-col gap-4 text-left">
            {errorForm && (
              <div
                role="alert"
                className="p-3 bg-error-container text-on-error-container text-xs rounded-lg border border-error/20 font-medium"
              >
                {errorForm}
              </div>
            )}

            {form.tipo === 'crear' && (
              <Campo id="mozo-usuario" etiqueta="Usuario *">
                <input
                  id="mozo-usuario"
                  required
                  maxLength={50}
                  autoComplete="off"
                  value={form.username}
                  onChange={(e) => setForm({ ...form, username: e.target.value })}
                  placeholder="Ej. lucia.torres"
                  className={`${claseInput} font-mono`}
                />
              </Campo>
            )}

            {form.tipo !== 'pin' && (
              <div className="grid grid-cols-2 gap-3">
                <Campo id="mozo-nombre" etiqueta="Nombre *">
                  <input
                    id="mozo-nombre"
                    required
                    maxLength={80}
                    value={form.nombre}
                    onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                    className={claseInput}
                  />
                </Campo>
                <Campo id="mozo-apellido" etiqueta="Apellido *">
                  <input
                    id="mozo-apellido"
                    required
                    maxLength={80}
                    value={form.apellido}
                    onChange={(e) => setForm({ ...form, apellido: e.target.value })}
                    className={claseInput}
                  />
                </Campo>
              </div>
            )}

            {form.tipo !== 'editar' && (
              <Campo
                id="mozo-pin"
                etiqueta={form.tipo === 'crear' ? 'PIN de acceso *' : 'PIN nuevo *'}
                ayuda="4 dígitos. No puede repetirse con el PIN de otro usuario."
              >
                <input
                  id="mozo-pin"
                  required
                  inputMode="numeric"
                  autoComplete="off"
                  maxLength={4}
                  value={form.pin}
                  onChange={(e) => setForm({ ...form, pin: e.target.value.replace(/\D/g, '') })}
                  placeholder="••••"
                  className={`${claseInput} font-mono font-bold tracking-[0.5em] text-base`}
                />
              </Campo>
            )}

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-surface-container-high">
              <button
                type="button"
                onClick={cerrar}
                className="px-4 py-2 text-xs font-bold text-on-surface-variant hover:text-on-surface rounded-lg"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={guardar.isPending}
                className="px-5 py-2.5 bg-primary hover:bg-primary-container text-on-primary text-xs font-bold rounded-lg shadow-sm transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
              >
                {guardar.isPending
                  ? 'Guardando...'
                  : form.tipo === 'crear'
                    ? 'REGISTRAR MOZO'
                    : 'GUARDAR CAMBIOS'}
              </button>
            </div>
          </form>
        </Dialogo>
      )}

      {zonasDe && (
        <Dialogo
          titulo={`Zonas de ${zonasDe.mozo.nombre} ${zonasDe.mozo.apellido}`}
          onCerrar={() => setZonasDe(null)}
        >
          <div className="p-6 flex flex-col gap-4 text-sm">
            <p className="text-xs text-on-surface-variant">
              El mozo solo verá y podrá tomar pedidos en las mesas de las zonas marcadas. Sin zonas,
              solo registra pedidos para llevar o delivery.
            </p>
            {zonasDe.mozo.zonas.some((z) => !z.activo) && (
              <p className="text-[11px] text-on-surface-variant">
                Conserva además las zonas inactivas:{' '}
                {zonasDe.mozo.zonas
                  .filter((z) => !z.activo)
                  .map((z) => z.nombre)
                  .join(', ')}
                .
              </p>
            )}
            {cargandoZonas ? (
              <p className="text-xs font-bold text-on-surface-variant">Cargando zonas...</p>
            ) : zonasAsignables.length === 0 ? (
              <p className="text-xs font-bold">No hay zonas activas.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {zonasAsignables.map((z) => (
                  <label
                    key={z.id}
                    className="flex items-center gap-3 px-3 py-2 rounded-lg border border-surface-container-high hover:bg-surface-container-low cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      data-zona-check={z.id}
                      checked={zonasDe.seleccion.includes(z.id)}
                      onChange={(e) =>
                        setZonasDe({
                          ...zonasDe,
                          seleccion: e.target.checked
                            ? [...zonasDe.seleccion, z.id]
                            : zonasDe.seleccion.filter((id) => id !== z.id),
                        })
                      }
                      className="w-4 h-4 accent-primary"
                    />
                    <span className="font-semibold text-xs">{z.nombre}</span>
                    <span className="ml-auto text-[10px] text-on-surface-variant">
                      {z.mesas.length} mesas
                    </span>
                  </label>
                ))}
              </div>
            )}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-surface-container-high">
              <button
                type="button"
                onClick={() => setZonasDe(null)}
                className="px-4 py-2 text-xs font-bold text-on-surface-variant hover:text-on-surface rounded-lg"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={asignarZonas.isPending || cargandoZonas}
                onClick={() =>
                  asignarZonas.mutate({ mozo: zonasDe.mozo, zonaIds: zonasDe.seleccion })
                }
                className="px-5 py-2.5 bg-primary text-on-primary text-xs font-bold rounded-lg disabled:opacity-50"
              >
                GUARDAR ZONAS
              </button>
            </div>
          </div>
        </Dialogo>
      )}

      {confirmarEliminar && (
        <Dialogo titulo="Eliminar mozo" onCerrar={() => setConfirmarEliminar(null)}>
          <div className="p-6 flex flex-col gap-4 text-sm">
            <p>
              ¿Eliminar a{' '}
              <strong>
                {confirmarEliminar.nombre} {confirmarEliminar.apellido}
              </strong>
              ? Esta acción no se puede deshacer.
            </p>
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-surface-container-high">
              <button
                type="button"
                onClick={() => setConfirmarEliminar(null)}
                className="px-4 py-2 text-xs font-bold text-on-surface-variant hover:text-on-surface rounded-lg"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={eliminar.isPending}
                onClick={() => eliminar.mutate(confirmarEliminar)}
                className="px-5 py-2.5 bg-error text-on-error text-xs font-bold rounded-lg disabled:opacity-50"
              >
                ELIMINAR
              </button>
            </div>
          </div>
        </Dialogo>
      )}

      {ofrecerDesactivar && (
        <Dialogo titulo="No se puede eliminar" onCerrar={() => setOfrecerDesactivar(null)}>
          <div className="p-6 flex flex-col gap-4 text-sm">
            <p role="alert">{ofrecerDesactivar.mensaje}</p>
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-surface-container-high">
              <button
                type="button"
                onClick={() => setOfrecerDesactivar(null)}
                className="px-4 py-2 text-xs font-bold text-on-surface-variant hover:text-on-surface rounded-lg"
              >
                Cerrar
              </button>
              {ofrecerDesactivar.mozo.activo && (
                <button
                  type="button"
                  disabled={cambiarEstado.isPending}
                  onClick={() =>
                    cambiarEstado.mutate({ mozo: ofrecerDesactivar.mozo, activo: false })
                  }
                  className="px-5 py-2.5 bg-primary text-on-primary text-xs font-bold rounded-lg disabled:opacity-50"
                >
                  DESACTIVAR
                </button>
              )}
            </div>
          </div>
        </Dialogo>
      )}

      <LaRetamaWatermark />
    </div>
  );
};

const BotonAccion: React.FC<{
  icono: string;
  texto: string;
  onClick: () => void;
  disabled?: boolean;
  peligro?: boolean;
}> = ({ icono, texto, onClick, disabled, peligro }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold disabled:opacity-50 ${
      peligro
        ? 'text-error hover:bg-error/10'
        : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low'
    }`}
  >
    <span className="material-symbols-outlined text-[16px]">{icono}</span>
    {texto}
  </button>
);

const Campo: React.FC<{
  id: string;
  etiqueta: string;
  ayuda?: string;
  children: React.ReactNode;
}> = ({ id, etiqueta, ayuda, children }) => (
  <div>
    <label htmlFor={id} className="block text-xs font-bold text-on-surface uppercase mb-1">
      {etiqueta}
    </label>
    {children}
    {ayuda && <span className="text-[10px] text-on-surface-variant mt-1 block">{ayuda}</span>}
  </div>
);

const Dialogo: React.FC<{ titulo: string; onCerrar: () => void; children: React.ReactNode }> = ({
  titulo,
  onCerrar,
  children,
}) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-on-surface/40 backdrop-blur-xs">
    <div
      role="dialog"
      aria-label={titulo}
      className="bg-surface-container-lowest w-full max-w-sm rounded-2xl shadow-2xl border border-surface-container-high overflow-hidden"
    >
      <div className="bg-surface-container-low px-6 py-4 border-b border-surface-container-high flex items-center justify-between">
        <h3 className="font-headline font-bold text-base text-on-surface">{titulo}</h3>
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
