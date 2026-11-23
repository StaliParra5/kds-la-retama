// Aviso de salida a internet del servidor (HU018 Esc. 4 y 6, decisión D43).
// Solo aparece cuando el servidor no tiene internet: la cocina sigue funcionando en la red local, pero los
// pedidos de canales externos (Rappi) no llegan y el expedidor debe registrarlos a mano. Va debajo de la
// insignia de conexión con el servidor para no ensanchar la barra.
// Se actualiza al instante por /topic/sistema (las páginas guardan el aviso en la consulta 'sistema-estado') y,
// como respaldo, se vuelve a consultar cada 15 s. Cuando vuelve internet desaparece solo.

import { useQuery } from '@tanstack/react-query';
import type { FC } from 'react';
import { apiClient } from '../../api/client';

export interface EstadoSistema {
  internet: boolean | null;
  verificadoEn?: string | null;
}

export const CLAVE_ESTADO_SISTEMA = ['sistema-estado'];

export const useEstadoInternet = () =>
  useQuery<EstadoSistema>({
    queryKey: CLAVE_ESTADO_SISTEMA,
    queryFn: async () => (await apiClient.get('/sistema/estado')).data,
    refetchInterval: 15000,
  });

export const IndicadorInternet: FC = () => {
  const { data } = useEstadoInternet();
  // null = aún no se comprobó: no se muestra nada para no alarmar sin motivo
  if (data?.internet !== false) return null;

  return (
    <span
      role="status"
      data-internet="sin-internet"
      title="La cocina sigue funcionando. Los pedidos de canales externos no llegan: regístrelos a mano."
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider border whitespace-nowrap bg-tertiary/10 text-tertiary border-tertiary/40"
    >
      <span className="material-symbols-outlined text-[14px]">cloud_off</span>
      Sin internet
    </span>
  );
};
