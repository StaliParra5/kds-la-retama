// Cronómetro de la tarjeta (HU021 Esc. 2 y 6) con el color del semáforo del canal.
// Avanza cada segundo desde el envío a cocina usando la hora del servidor, no la de la PC. Cada cronómetro
// actualiza solo su propio texto, así el resto de la pantalla no se vuelve a dibujar cada segundo.

import { type FC, useEffect, useState } from 'react';
import { ahoraServidor } from '../../api/reloj';
import { claseSemaforo, formatoCronometro } from '../../utils/cocina';

export const Cronometro: FC<{
  envioMs: number;
  slaMinutos: number;
  umbralAmbar?: number | null;
  ambarMinutos?: number | null;
}> = ({ envioMs, slaMinutos, umbralAmbar, ambarMinutos }) => {
  const [ahora, setAhora] = useState(ahoraServidor);

  useEffect(() => {
    const intervalo = setInterval(() => setAhora(ahoraServidor()), 1000);
    return () => clearInterval(intervalo);
  }, []);

  const transcurrido = Math.max(0, ahora - envioMs);
  // Minutos con decimales, igual que la tarjeta: con un umbral ámbar bajo, el color cambia antes del minuto completo
  const minutos = transcurrido / 60000;

  return (
    <span
      data-cronometro
      data-segundos={Math.floor(transcurrido / 1000)}
      title={`SLA del canal: ${slaMinutos} min`}
      className={`flex items-center gap-1 px-2 py-1 rounded-lg border text-sm font-extrabold font-mono tabular-nums ${claseSemaforo(minutos, slaMinutos, umbralAmbar, ambarMinutos)}`}
    >
      <span className="material-symbols-outlined text-[16px]">timer</span>
      {formatoCronometro(transcurrido)}
    </span>
  );
};
