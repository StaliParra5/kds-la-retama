// Hora del servidor para los cronómetros (HU021 Esc. 6).
// Cada pantalla pide /reloj, calcula cuánto se adelanta o atrasa su reloj y lo corrige. Así dos PCs con relojes
// distintos muestran el mismo tiempo transcurrido. El desfase se comparte en el módulo: una sola medición
// sirve a todas las tarjetas, y se repite cada 5 minutos por si el reloj de la PC se ajusta mientras tanto.

import { useEffect } from 'react';
import { apiClient } from './client';

let desfaseMs = 0;
let ultimaMedicion = 0;
const INTERVALO_MS = 5 * 60 * 1000;

// Mide el desfase tomando la mitad del viaje de ida y vuelta como momento de la lectura del servidor
const medirDesfase = async (): Promise<void> => {
  try {
    const inicio = Date.now();
    const { data } = await apiClient.get<{ epochMs: number }>('/reloj');
    const fin = Date.now();
    desfaseMs = data.epochMs - (inicio + fin) / 2;
    ultimaMedicion = fin;
  } catch {
    // Sin respuesta se conserva el último desfase conocido (o cero): el cronómetro sigue funcionando
  }
};

// Hora actual corregida con el reloj del servidor
export const ahoraServidor = (): number => Date.now() + desfaseMs;

// Mantiene el desfase al día mientras la pantalla esté abierta
export const useRelojServidor = (): void => {
  useEffect(() => {
    if (Date.now() - ultimaMedicion > INTERVALO_MS) medirDesfase();
    const intervalo = setInterval(medirDesfase, INTERVALO_MS);
    return () => clearInterval(intervalo);
  }, []);
};
