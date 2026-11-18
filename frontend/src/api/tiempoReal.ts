// Conexión STOMP sobre WebSocket con el servidor KDS (decisión D7)
// - Se autentica en el frame CONNECT con el mismo JWT de la API (el handshake no lleva cabeceras).
// - Reconecta sola; al conectarse avisa con alConectar para que la pantalla recargue su cola,
//   porque los mensajes emitidos mientras estuvo desconectada se pierden.
// - Si el servidor rechaza la sesión deja de reintentar: CONNECT rechazado equivale a un 401
//   (vuelve al login); una suscripción rechazada se informa a la pantalla.
import { Client } from '@stomp/stompjs';
import { type QueryKey, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';
import { cerrarSesionExpirada } from './client';

const urlWebSocket = () =>
  `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}/ws`;

interface OpcionesTiempoReal {
  destinos: string[];
  alMensaje: (destino: string, cuerpo: unknown) => void;
  alConectar?: () => void;
}

export interface EstadoTiempoReal {
  conectado: boolean;
  // Motivo por el que el servidor rechazó la suscripción; null mientras no haya rechazo
  rechazo: string | null;
}

export const useTiempoReal = ({
  destinos,
  alMensaje,
  alConectar,
}: OpcionesTiempoReal): EstadoTiempoReal => {
  const [conectado, setConectado] = useState(false);
  const [rechazo, setRechazo] = useState<string | null>(null);
  // Los callbacks cambian en cada render; la conexión solo depende de los destinos
  const alMensajeRef = useRef(alMensaje);
  const alConectarRef = useRef(alConectar);
  alMensajeRef.current = alMensaje;
  alConectarRef.current = alConectar;
  const claveDestinos = destinos.join('|');

  useEffect(() => {
    const lista = claveDestinos ? claveDestinos.split('|') : [];
    setRechazo(null);
    if (lista.length === 0) {
      return;
    }
    // Un cliente reemplazado (cambio de destinos) puede seguir emitiendo eventos al cerrarse
    let activo = true;
    let sesionAceptada = false;
    const cliente = new Client({
      brokerURL: urlWebSocket(),
      reconnectDelay: 3000,
      heartbeatIncoming: 10000,
      heartbeatOutgoing: 10000,
      // El token se lee en cada intento: tras un nuevo login la reconexión usa el vigente
      beforeConnect: (c) => {
        sesionAceptada = false;
        c.connectHeaders = { Authorization: `Bearer ${localStorage.getItem('kds_token') ?? ''}` };
      },
      onConnect: () => {
        sesionAceptada = true;
        for (const destino of lista) {
          cliente.subscribe(destino, (mensaje) => {
            let cuerpo: unknown = mensaje.body;
            try {
              cuerpo = JSON.parse(mensaje.body);
            } catch {
              // cuerpo no JSON: se entrega tal cual
            }
            if (activo) {
              alMensajeRef.current(destino, cuerpo);
            }
          });
        }
        if (activo) {
          setConectado(true);
          alConectarRef.current?.();
        }
      },
      onStompError: (frame) => {
        if (!activo) {
          return;
        }
        activo = false;
        setConectado(false);
        void cliente.deactivate();
        if (sesionAceptada) {
          setRechazo(frame.headers.message ?? 'El servidor rechazó la suscripción.');
        } else {
          cerrarSesionExpirada();
        }
      },
      onWebSocketClose: () => {
        if (activo) {
          setConectado(false);
        }
      },
    });
    cliente.activate();
    return () => {
      activo = false;
      setConectado(false);
      void cliente.deactivate();
    };
  }, [claveDestinos]);

  return { conectado, rechazo };
};

// Recarga una consulta ante avisos en tiempo real, agrupando ráfagas (un pedido de varios ítems
// llega como varios mensajes seguidos) en una sola petición
export const useRecargaAgrupada = (queryKey: QueryKey, esperaMs = 150) => {
  const queryClient = useQueryClient();
  const pendiente = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clave = JSON.stringify(queryKey);

  useEffect(
    () => () => {
      if (pendiente.current) clearTimeout(pendiente.current);
    },
    [],
  );

  // La clave serializada representa a queryKey: un arreglo nuevo con el mismo contenido no recrea la función
  return useCallback(() => {
    if (pendiente.current) clearTimeout(pendiente.current);
    pendiente.current = setTimeout(
      () => queryClient.invalidateQueries({ queryKey: JSON.parse(clave) }),
      esperaMs,
    );
  }, [clave, esperaMs, queryClient]);
};
