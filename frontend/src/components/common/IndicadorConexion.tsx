// Indicador de conexión con el servidor del restaurante (HU038, decisión D42). Es la misma insignia en
// comandero, estación y pase (Esc. 5):
// - "En vivo" en verde mientras la pantalla está conectada.
// - "Sin conexión con el servidor" en rojo apenas se corta (Esc. 1); la reconexión es automática (Esc. 3).
// - Al recuperar la conexión muestra "Conectado" unos segundos y vuelve a "En vivo" (Esc. 6).
// - Al abrir la pantalla dice "Conectando…" durante la primera conexión, así no aparece un corte falso.
// La conexión con internet (canales externos como Rappi) es otra cosa y se indicará aparte (HU018).

import { type FC, useEffect, useRef, useState } from 'react';

const GRACIA_INICIAL_MS = 4000;
const MS_AVISO_CONECTADO = 3000;

type Estado = 'conectando' | 'en-vivo' | 'sin-conexion' | 'conectado';

const ESTILOS: Record<Estado, { texto: string; caja: string; punto: string }> = {
  conectando: {
    texto: 'Conectando…',
    caja: 'bg-surface-container-low text-on-surface-variant border-surface-container-high',
    punto: 'bg-outline',
  },
  'en-vivo': {
    texto: 'En vivo',
    caja: 'bg-secondary/10 text-secondary border-secondary/30',
    punto: 'bg-secondary animate-pulse',
  },
  'sin-conexion': {
    texto: 'Sin conexión con el servidor',
    caja: 'bg-error text-on-error border-error',
    punto: 'bg-on-error',
  },
  conectado: {
    texto: 'Conectado',
    caja: 'bg-secondary text-on-secondary border-secondary',
    punto: 'bg-on-secondary',
  },
};

export const IndicadorConexion: FC<{ conectado: boolean }> = ({ conectado }) => {
  const [graciaInicial, setGraciaInicial] = useState(true);
  const [recienConectado, setRecienConectado] = useState(false);
  const huboCorte = useRef(false);

  useEffect(() => {
    const t = setTimeout(() => setGraciaInicial(false), GRACIA_INICIAL_MS);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!conectado) {
      // Cuenta como corte si ya pasó la gracia inicial (o si ya se había conectado antes)
      if (!graciaInicial) huboCorte.current = true;
      setRecienConectado(false);
      return;
    }
    setGraciaInicial(false);
    if (!huboCorte.current) return;
    huboCorte.current = false;
    setRecienConectado(true);
    const t = setTimeout(() => setRecienConectado(false), MS_AVISO_CONECTADO);
    return () => clearTimeout(t);
  }, [conectado, graciaInicial]);

  const estado: Estado = conectado
    ? recienConectado
      ? 'conectado'
      : 'en-vivo'
    : graciaInicial
      ? 'conectando'
      : 'sin-conexion';
  const estilo = ESTILOS[estado];

  return (
    <span
      role={estado === 'sin-conexion' ? 'alert' : 'status'}
      data-conexion={estado}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider border whitespace-nowrap ${estilo.caja}`}
    >
      <span className={`w-2 h-2 rounded-full ${estilo.punto}`} />
      {estilo.texto}
    </span>
  );
};
