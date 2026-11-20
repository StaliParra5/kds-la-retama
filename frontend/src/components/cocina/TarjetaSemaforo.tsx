// Tarjeta de pedido con su nivel de semáforo (HU025).
// - Decisión D40: el color del semáforo se muestra solo en el cronómetro; el borde de la tarjeta queda neutro.
//   El nivel se publica en data-semaforo para pruebas y accesibilidad.
// - Verde hasta el umbral ámbar del canal, ámbar hasta el SLA y rojo desde el SLA (Esc. 1 y 2).
// - Cuenta el tiempo con la hora del servidor (Esc. 3) y revisa cada segundo, así cambia de color sola
//   sin recargar (Esc. 6). Solo se vuelve a dibujar cuando cambia el nivel, no cada segundo.
// - Si cambian el SLA o el umbral del canal, llegan nuevos valores por props y el color se recalcula (Esc. 4).

import { type FC, type ReactNode, useEffect, useState } from 'react';
import { ahoraServidor } from '../../api/reloj';
import { nivelSemaforo, type NivelSemaforo } from '../../utils/cocina';

export const TarjetaSemaforo: FC<{
  codigoPedido: string;
  envioMs: number;
  slaMinutos: number;
  umbralAmbar?: number | null;
  // D39: minuto ámbar resuelto por el servidor (Salón)
  ambarMinutos?: number | null;
  children: ReactNode;
}> = ({ codigoPedido, envioMs, slaMinutos, umbralAmbar, ambarMinutos, children }) => {
  const calcular = () =>
    nivelSemaforo(
      Math.max(0, ahoraServidor() - envioMs) / 60000,
      slaMinutos,
      umbralAmbar,
      ambarMinutos,
    );
  const [nivel, setNivel] = useState<NivelSemaforo>(calcular);

  // calcular solo depende de estas props; se recalcula al instante si cambian (Esc. 4)
  // biome-ignore lint/correctness/useExhaustiveDependencies: calcular se recrea en cada render con las mismas props
  useEffect(() => {
    setNivel(calcular());
    const intervalo = setInterval(() => setNivel(calcular()), 1000);
    return () => clearInterval(intervalo);
  }, [envioMs, slaMinutos, umbralAmbar, ambarMinutos]);

  return (
    <article
      data-pedido={codigoPedido}
      data-semaforo={nivel}
      className="bg-surface-container-lowest border border-surface-container-high rounded-2xl shadow-sm overflow-hidden flex flex-col"
    >
      {children}
    </article>
  );
};
