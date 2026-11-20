// Apariencia de los canales en las tarjetas (HU015, decisión D37).
// - Las reglas de color repiten las del servidor (backend ColorCanal.java) para avisar antes de guardar;
//   el servidor vuelve a validar y es quien decide.
// - ICONOS_CANAL es la lista de íconos que el administrador puede asignar. Lista provisional: solo trae los
//   íconos ya usados por los canales actuales; el equipo definirá cuáles se agregan.

export interface IconoCanal {
  // Nombre del ícono en Material Symbols
  nombre: string;
  etiqueta: string;
}

export const ICONOS_CANAL: IconoCanal[] = [
  { nombre: 'table_restaurant', etiqueta: 'Mesa' },
  { nombre: 'shopping_bag', etiqueta: 'Bolsa' },
  { nombre: 'two_wheeler', etiqueta: 'Moto' },
  // Rappi: ícono genérico de repartidor; ver el comentario del logo en components/cocina/CanalFranja.tsx
  { nombre: 'delivery_dining', etiqueta: 'Repartidor' },
];

// Respaldo para un canal que aún no tiene color o ícono: gris neutro, distinto de los colores del semáforo
export const COLOR_POR_DEFECTO = '#475569';
export const ICONO_POR_DEFECTO = 'storefront';

// Colores del semáforo (tokens secondary, tertiary y error de tailwind.config.js)
export const COLORES_SEMAFORO: Record<string, string> = {
  verde: '#006c49',
  ámbar: '#784b00',
  rojo: '#ba1a1a',
};

export const DISTANCIA_MINIMA_SEMAFORO = 35;
export const DISTANCIA_MINIMA_CANAL = 25;
export const CONTRASTE_MINIMO_BLANCO = 3;

const FORMATO_COLOR = /^#[0-9a-f]{6}$/i;

const rgbLineal = (hex: string): number[] =>
  [1, 3, 5].map((i) => {
    const c = Number.parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });

// sRGB -> XYZ (D65) -> Lab
const lab = (hex: string): number[] => {
  const [r, g, b] = rgbLineal(hex);
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const fx = f((r * 0.4124 + g * 0.3576 + b * 0.1805) / 0.95047);
  const fy = f(r * 0.2126 + g * 0.7152 + b * 0.0722);
  const fz = f((r * 0.0193 + g * 0.1192 + b * 0.9505) / 1.08883);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
};

// Diferencia de color CIE76: 0 es el mismo color; desde unos 20 a 25 se distinguen con claridad
export const distanciaColor = (a: string, b: string): number => {
  const x = lab(a);
  const y = lab(b);
  return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]);
};

export const contrasteConBlanco = (hex: string): number => {
  const [r, g, b] = rgbLineal(hex);
  return 1.05 / (0.2126 * r + 0.7152 * g + 0.0722 * b + 0.05);
};

// Devuelve el motivo por el que el color no se puede usar, o null si cumple todas las reglas
export const problemaColorCanal = (
  color: string,
  otrosCanalesActivos: { nombre: string; color?: string | null }[],
): string | null => {
  if (!FORMATO_COLOR.test(color)) return 'El color debe tener el formato #RRGGBB.';
  if (contrasteConBlanco(color) < CONTRASTE_MINIMO_BLANCO) {
    return 'Es demasiado claro: el nombre del canal, en blanco, no se leería.';
  }
  for (const [nombre, semaforo] of Object.entries(COLORES_SEMAFORO)) {
    if (distanciaColor(color, semaforo) < DISTANCIA_MINIMA_SEMAFORO) {
      return `Se parece al ${nombre} del semáforo y podría confundirse con el estado del pedido.`;
    }
  }
  for (const otro of otrosCanalesActivos) {
    if (otro.color && distanciaColor(color, otro.color) < DISTANCIA_MINIMA_CANAL) {
      return `Es igual o muy parecido al color del canal ${otro.nombre}.`;
    }
  }
  return null;
};
