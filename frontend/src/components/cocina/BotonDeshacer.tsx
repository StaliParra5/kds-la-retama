// Botón "Deshacer" del ítem recién cambiado en la estación (HU033, decisión D41).
// Aparece solo mientras dure la ventana desde el último cambio (con la hora del servidor) y muestra el tiempo
// que queda debajo del botón, para no ensanchar la tarjeta. Al vencer desaparece; el servidor vuelve a validar.

import { type FC, useEffect, useState } from 'react';
import { ahoraServidor } from '../../api/reloj';

export const BotonDeshacer: FC<{
  ultimoCambioMs: number;
  ventanaMs: number;
  ocupado: boolean;
  onDeshacer: () => void;
}> = ({ ultimoCambioMs, ventanaMs, ocupado, onDeshacer }) => {
  const restante = () => Math.ceil((ultimoCambioMs + ventanaMs - ahoraServidor()) / 1000);
  const [segundos, setSegundos] = useState(restante);

  // biome-ignore lint/correctness/useExhaustiveDependencies: restante solo depende de estas props
  useEffect(() => {
    setSegundos(restante());
    const intervalo = setInterval(() => setSegundos(restante()), 1000);
    return () => clearInterval(intervalo);
  }, [ultimoCambioMs, ventanaMs]);

  if (segundos <= 0) return null;

  return (
    <div className="flex flex-col items-end gap-0.5 mt-1.5">
      <button
        type="button"
        data-deshacer
        onClick={onDeshacer}
        disabled={ocupado}
        className="min-h-[36px] px-3 rounded-lg border border-surface-container-high bg-surface-container-lowest text-xs font-bold flex items-center gap-1 hover:border-primary/50 disabled:opacity-50"
      >
        <span className="material-symbols-outlined text-[16px]">undo</span>
        Deshacer
      </button>
      <span data-deshacer-segundos className="text-[10px] font-semibold text-on-surface-variant tabular-nums">
        {segundos} s
      </span>
    </div>
  );
};
