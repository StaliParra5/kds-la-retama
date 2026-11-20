// Franja superior de la tarjeta con el color, el ícono y el nombre del canal (HU015, D37).
// Ocupa todo el ancho para reconocer el canal a 1,5 m sin leer texto (Esc. 2); el borde de la tarjeta queda
// libre para el semáforo (HU025), así ambos colores se ven a la vez (Esc. 6). Estación y pase usan este mismo
// componente, por eso un pedido se ve igual en las dos vistas (Esc. 5).

import type { FC } from 'react';
import { COLOR_POR_DEFECTO, ICONO_POR_DEFECTO } from '../../utils/canal';

export const CanalFranja: FC<{
  codigo: string;
  nombre: string;
  color?: string | null;
  icono?: string | null;
}> = ({ codigo, nombre, color, icono }) => {
  // LOGO DE RAPPI: aquí iría el logo oficial de Rappi (por ejemplo, un <img> de un archivo local en
  // public/canales/rappi.svg cuando codigo === 'RAPPI'). Mientras no se cuente con autorización de la marca
  // para usarlo, se muestra el ícono genérico de repartidor configurado en el canal.
  const nombreIcono = icono || ICONO_POR_DEFECTO;

  return (
    <div
      data-canal-franja={codigo}
      data-canal-color={color || COLOR_POR_DEFECTO}
      style={{ backgroundColor: color || COLOR_POR_DEFECTO }}
      className="flex items-center gap-2 px-4 py-2 text-white"
    >
      <span aria-hidden="true" className="material-symbols-outlined text-[26px] leading-none">
        {nombreIcono}
      </span>
      <span data-canal className="text-sm font-extrabold uppercase tracking-wider truncate">
        {nombre}
      </span>
    </div>
  );
};
