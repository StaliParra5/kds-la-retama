// Ventana para deshacer cambios de estado en cocina (HU033 Esc. 4, decisión D41).
// Va dentro de Administración > Estaciones para no sumar otra pestaña a la barra superior.
// Rango 5 a 120 segundos; el servidor vuelve a validar.

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { type FC, useState } from 'react';
import { apiClient } from '../../api/client';
import { useToast } from '../../context/ToastContext';

export const VentanaRecallConfig: FC = () => {
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const [valor, setValor] = useState<number | null>(null);
  const [guardando, setGuardando] = useState(false);

  const { data } = useQuery<{ ventanaRecallSegundos: number }>({
    queryKey: ['configuracion-cocina'],
    queryFn: async () => (await apiClient.get('/configuracion/cocina')).data,
  });

  const actual = data?.ventanaRecallSegundos ?? 30;
  const segundos = valor ?? actual;
  const valido = Number.isInteger(segundos) && segundos >= 5 && segundos <= 120;

  const guardar = async () => {
    if (!valido || guardando) return;
    setGuardando(true);
    try {
      await apiClient.put('/configuracion/cocina', { ventanaRecallSegundos: segundos });
      queryClient.invalidateQueries({ queryKey: ['configuracion-cocina'] });
      setValor(null);
      showToast(`Ventana para deshacer: ${segundos} segundos.`, 'success');
    } catch (err: any) {
      showToast(
        err.response?.data?.mensaje ?? 'No se pudo guardar la ventana para deshacer.',
        'error',
      );
    } finally {
      setGuardando(false);
    }
  };

  return (
    <section
      data-ventana-recall
      className="bg-surface-container-lowest border border-surface-container-high rounded-2xl p-4 flex flex-wrap items-end gap-4"
    >
      <div className="flex-1 min-w-[220px]">
        <h2 className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
          Ventana para deshacer
        </h2>
        <p className="text-xs text-on-surface-variant mt-1">
          Tiempo que tiene un cocinero para deshacer un toque accidental (Iniciar o Listo).
        </p>
      </div>
      <label className="flex flex-col gap-1 text-[11px] font-bold text-on-surface-variant">
        Segundos (5 a 120)
        <input
          id="ventana-recall"
          type="number"
          min="5"
          max="120"
          value={segundos}
          onChange={(e) => setValor(Number.parseInt(e.target.value, 10) || 0)}
          className="w-24 bg-surface-container-low font-mono font-bold text-lg px-3 py-2 rounded-lg border border-surface-container-high focus:outline-none focus:ring-2 focus:ring-primary text-center"
        />
      </label>
      <button
        type="button"
        data-guardar-ventana-recall
        onClick={guardar}
        disabled={!valido || segundos === actual || guardando}
        className="px-4 py-2.5 bg-primary text-on-primary rounded-xl text-xs font-bold disabled:opacity-40"
      >
        Guardar
      </button>
      {!valido && (
        <p className="w-full text-xs font-semibold text-error">
          Debe estar entre 5 y 120 segundos.
        </p>
      )}
    </section>
  );
};
