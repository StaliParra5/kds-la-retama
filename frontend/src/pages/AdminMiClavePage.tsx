// Clave de autorización del administrador (HU049, decisión D36).
// - Es un PIN de 6 dígitos, distinto de la contraseña de la cuenta, con el que el administrador autoriza en el
//   diálogo del mozo o del expedidor la anulación de un ítem que cocina ya inició.
// - Para crearla o cambiarla se confirma con la contraseña de la cuenta. Si la olvida, la crea de nuevo igual.
// - Los campos se vacían tras guardar; la clave nunca se muestra ni se guarda en el navegador.

import { useQuery, useQueryClient } from '@tanstack/react-query';
import React, { useState } from 'react';
import { apiClient } from '../api/client';
import { LaRetamaWatermark } from '../components/common/LaRetamaWatermark';
import { TopAppBar } from '../components/common/TopAppBar';
import { useToast } from '../context/ToastContext';

const campo =
  'w-full bg-surface-container-low text-sm font-medium px-3 py-2.5 rounded-lg border border-surface-container-high focus:outline-none focus:ring-2 focus:ring-primary';

export const AdminMiClavePage: React.FC = () => {
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const [password, setPassword] = useState('');
  const [clave, setClave] = useState('');
  const [confirmacion, setConfirmacion] = useState('');
  const [guardando, setGuardando] = useState(false);

  const { data: estado } = useQuery<{ configurada: boolean }>({
    queryKey: ['clave-autorizacion'],
    queryFn: async () => (await apiClient.get('/cuenta/clave-autorizacion')).data,
  });

  const soloDigitos = (valor: string) => valor.replace(/\D/g, '').slice(0, 6);
  const problema =
    clave.length > 0 && clave.length < 6
      ? 'La clave debe tener 6 dígitos.'
      : confirmacion.length === 6 && confirmacion !== clave
        ? 'Las dos claves no coinciden.'
        : null;
  const listo = password !== '' && clave.length === 6 && confirmacion === clave;

  const guardar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!listo || guardando) return;
    setGuardando(true);
    try {
      await apiClient.put('/cuenta/clave-autorizacion', { passwordActual: password, clave });
      showToast('Clave de autorización guardada.', 'success');
      queryClient.invalidateQueries({ queryKey: ['clave-autorizacion'] });
      setPassword('');
      setClave('');
      setConfirmacion('');
    } catch (err: any) {
      showToast(err.response?.data?.mensaje ?? 'No se pudo guardar la clave de autorización.', 'warning');
      setPassword('');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background font-sans text-on-surface">
      <TopAppBar />

      <main className="flex-1 max-w-lg w-full mx-auto p-4 lg:p-6 flex flex-col gap-6">
        <div>
          <h1 className="font-headline font-bold text-2xl tracking-tight">Mi clave de autorización</h1>
          <p className="text-sm text-on-surface-variant mt-1">
            Con esta clave de 6 dígitos autoriza que un mozo o el expedidor anule un ítem que cocina ya
            inició. Es distinta de la contraseña de su cuenta.
          </p>
        </div>

        <p
          data-estado-clave={estado?.configurada ? 'configurada' : 'pendiente'}
          className={`text-sm font-semibold rounded-xl px-4 py-3 ${
            estado?.configurada ? 'bg-secondary/10 text-secondary' : 'bg-tertiary/10 text-tertiary'
          }`}
        >
          {estado?.configurada
            ? 'Ya tiene una clave configurada. Puede cambiarla cuando quiera; si la olvidó, cree una nueva.'
            : 'Aún no tiene clave: mientras no la cree no podrá autorizar anulaciones.'}
        </p>

        <form
          onSubmit={guardar}
          className="bg-surface-container-lowest border border-surface-container-high rounded-2xl p-6 flex flex-col gap-4"
        >
          <label className="flex flex-col gap-1 text-xs font-bold uppercase">
            Contraseña de su cuenta
            <input
              id="mi-clave-password"
              type="password"
              autoComplete="current-password"
              value={password}
              maxLength={100}
              onChange={(e) => setPassword(e.target.value)}
              className={campo}
            />
          </label>
          <label className="flex flex-col gap-1 text-xs font-bold uppercase">
            Nueva clave (6 dígitos)
            <input
              id="mi-clave-nueva"
              type="password"
              inputMode="numeric"
              autoComplete="new-password"
              value={clave}
              maxLength={6}
              onChange={(e) => setClave(soloDigitos(e.target.value))}
              className={`${campo} font-mono tracking-[0.4em]`}
            />
          </label>
          <label className="flex flex-col gap-1 text-xs font-bold uppercase">
            Repita la clave
            <input
              id="mi-clave-confirmacion"
              type="password"
              inputMode="numeric"
              autoComplete="new-password"
              value={confirmacion}
              maxLength={6}
              onChange={(e) => setConfirmacion(soloDigitos(e.target.value))}
              className={`${campo} font-mono tracking-[0.4em]`}
            />
          </label>
          {problema && <p className="text-xs font-semibold text-error">{problema}</p>}
          <button
            type="submit"
            data-guardar-clave
            disabled={!listo || guardando}
            className="min-h-[48px] rounded-xl bg-primary text-on-primary font-bold disabled:opacity-50"
          >
            {guardando ? 'GUARDANDO…' : estado?.configurada ? 'CAMBIAR CLAVE' : 'CREAR CLAVE'}
          </button>
        </form>
      </main>

      <LaRetamaWatermark />
    </div>
  );
};
