// HU032: anular un ítem ya enviado desde el comandero del mozo.
// - PedidosEnviados lista los pedidos enviados con un botón "Anular" en cada ítem vigente.
// - AnularItemDialog exige elegir un motivo de la lista fija (Esc. 3) y avisa si habrá merma (Esc. 2).
// Un ítem despachado o anulado no ofrece el botón (Esc. 4); el servidor lo valida igualmente.
// - D36: los motivos dependen de si cocina ya inició el ítem, y anular uno iniciado (En preparación o Listo)
//   requiere usuario y contraseña de un administrador; el administrador anula sin ingresar otra clave.

import { useQuery } from '@tanstack/react-query';
import { type FC, useState } from 'react';
import { apiClient } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import type {
  DetallePedidoResponse,
  EstadoItem,
  MotivoAnulacion,
  PedidoResponse,
} from '../../types';
import { ESTILO_ESTADO } from '../../utils/cocina';

export interface ItemPorAnular {
  pedido: PedidoResponse;
  item: DetallePedidoResponse;
}

const horaLocal = (fechaIso: string): string =>
  new Date(fechaIso).toLocaleTimeString('es-PE', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

const etiquetaEstado = (estado: string): string =>
  ESTILO_ESTADO[estado as EstadoItem]?.etiqueta ?? estado;

// Se puede anular hasta antes de despachar; un ítem ya anulado no se vuelve a anular
const esAnulable = (estado: string): boolean => estado !== 'DESPACHADO' && estado !== 'ANULADO';

// Un ítem que ya se cocinó (o se está cocinando) y se anula es comida perdida: merma (D12)
const generaMerma = (estado: string): boolean => estado === 'EN_PREPARACION' || estado === 'LISTO';

// mostrarCanal agrega el canal y el número de orden del agregador (lista de pedidos externos); claseLista
// reemplaza la altura de la lista cuando se usa en una pantalla propia en vez de un panel pequeño
export const PedidosEnviados: FC<{
  pedidos: PedidoResponse[];
  onAnular: (objetivo: ItemPorAnular) => void;
  mostrarCanal?: boolean;
  claseLista?: string;
}> = ({ pedidos, onAnular, mostrarCanal = false, claseLista = 'max-h-40 overflow-y-auto' }) => (
  <ul className={`mt-2 flex flex-col gap-1.5 ${claseLista}`}>
    {pedidos.map((p) => (
      <li key={p.id} data-pedido-enviado={p.codigoCorrelativo} className="text-[11px]">
        <span className="font-mono font-bold text-primary">{p.codigoCorrelativo}</span>
        <span className="text-on-surface-variant">
          {' '}
          · {horaLocal(p.fechaEnvioCocina)}
          {p.clienteNombre ? ` · ${p.clienteNombre}` : ''}
          {mostrarCanal ? ` · ${p.canalNombre}` : ''}
          {mostrarCanal && p.numeroOrdenExterno ? ` · Orden ${p.numeroOrdenExterno}` : ''}
        </span>
        <ul className="pl-3">
          {p.items.map((i) => (
            <li
              key={i.id}
              data-item-enviado={i.id}
              data-estado={i.estadoItem}
              className="flex items-center justify-between gap-2"
            >
              <span className={i.estadoItem === 'ANULADO' ? 'line-through opacity-60' : ''}>
                {i.cantidad}× {i.platoNombre}
              </span>
              <span className="flex items-center gap-1.5">
                <span className="font-semibold text-on-surface-variant">
                  {etiquetaEstado(i.estadoItem)}
                </span>
                {esAnulable(i.estadoItem) && (
                  <button
                    type="button"
                    data-anular-item={i.id}
                    onClick={() => onAnular({ pedido: p, item: i })}
                    className="min-h-[32px] px-2 rounded-md border border-error/40 text-error text-[10px] font-bold hover:bg-error/10"
                  >
                    Anular
                  </button>
                )}
              </span>
            </li>
          ))}
        </ul>
      </li>
    ))}
  </ul>
);

export const AnularItemDialog: FC<{
  objetivo: ItemPorAnular;
  onCerrar: () => void;
  // Se llama cuando el servidor ya respondió (anulado o cambió de estado): la lista debe recargarse
  onResuelto: () => void;
}> = ({ objetivo, onCerrar, onResuelto }) => {
  const { showToast } = useToast();
  const { user } = useAuth();
  const [motivo, setMotivo] = useState<string | null>(null);
  const [adminUsuario, setAdminUsuario] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [enviando, setEnviando] = useState(false);
  const { item, pedido } = objetivo;
  const habraMerma = generaMerma(item.estadoItem);
  // D36: si cocina ya empezó el ítem decide un administrador; si quien anula ya lo es, no se pide otra clave
  const requiereAutorizacion = habraMerma && user?.rol !== 'ADMIN';
  const autorizacionCompleta = !requiereAutorizacion || (adminUsuario.trim() !== '' && adminPassword !== '');

  // D36: solo los motivos que tienen sentido para el estado del ítem; la lista por estado es fija y se pide una vez
  const { data: motivos = [] } = useQuery<MotivoAnulacion[]>({
    queryKey: ['motivos-anulacion', item.estadoItem],
    queryFn: async () =>
      (await apiClient.get('/items/motivos-anulacion', { params: { estado: item.estadoItem } })).data,
    staleTime: Number.POSITIVE_INFINITY,
  });

  const confirmar = async () => {
    // Esc. 3: sin motivo no se confirma; D36: sin la clave del administrador tampoco
    if (!motivo || !autorizacionCompleta || enviando) return;
    setEnviando(true);
    try {
      await apiClient.post(`/items/${item.id}/anulacion`, {
        estadoActual: item.estadoItem,
        motivo,
        autorizacion: requiereAutorizacion
          ? { usuario: adminUsuario.trim(), password: adminPassword }
          : undefined,
      });
      showToast(
        habraMerma
          ? `${item.cantidad}× ${item.platoNombre} anulado y registrado como merma.`
          : `${item.cantidad}× ${item.platoNombre} anulado.`,
        'success',
      );
      onResuelto();
    } catch (err: any) {
      const respuesta = err.response;
      if (!respuesta) {
        // Sin respuesta del servidor: se mantiene el diálogo para reintentar sin perder el motivo elegido
        showToast('No se pudo anular el ítem. Revise la conexión e intente de nuevo.', 'error');
      } else if (respuesta.status === 403 && String(respuesta.data?.codigo ?? '').startsWith('AUTORIZACION_ADMIN')) {
        // D36: clave incorrecta o bloqueada; el diálogo sigue abierto y la contraseña se borra para reintentar
        setAdminPassword('');
        showToast(
          respuesta.data?.mensaje ?? 'No se pudo validar la autorización del administrador.',
          respuesta.data?.codigo === 'AUTORIZACION_ADMIN_BLOQUEADA' ? 'error' : 'warning',
        );
      } else if (respuesta.status === 409 && respuesta.data?.item) {
        // Cocina cambió el ítem mientras el mozo decidía: de su estado depende la merma, se decide de nuevo
        const actual = respuesta.data.item.estado as string;
        showToast(
          `El ítem ahora está "${etiquetaEstado(actual)}". Revise y vuelva a intentarlo.`,
          'warning',
        );
        onResuelto();
      } else {
        showToast(respuesta.data?.mensaje ?? 'No se pudo anular el ítem.', 'warning');
        onResuelto();
      }
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-on-surface/40 backdrop-blur-xs">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Anular ítem"
        data-dialogo-anular
        className="bg-surface-container-lowest w-full max-w-sm rounded-2xl shadow-2xl border border-surface-container-high p-6 flex flex-col gap-4 max-h-[90vh] overflow-y-auto"
      >
        <div>
          <h2 className="font-headline font-bold text-lg">¿Anular este ítem?</h2>
          <p className="text-sm text-on-surface-variant mt-1">
            {item.cantidad}× {item.platoNombre} · {pedido.codigoCorrelativo} ·{' '}
            {etiquetaEstado(item.estadoItem)}
          </p>
        </div>

        <fieldset className="flex flex-col gap-1.5">
          <legend className="text-xs font-bold uppercase text-on-surface-variant mb-1">
            Motivo (obligatorio)
          </legend>
          {motivos.map((m) => (
            <label
              key={m.codigo}
              className={`flex items-center gap-3 min-h-[44px] px-3 rounded-xl border cursor-pointer text-sm font-semibold ${
                motivo === m.codigo
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-surface-container-high hover:border-primary/50'
              }`}
            >
              <input
                type="radio"
                name="motivo-anulacion"
                value={m.codigo}
                checked={motivo === m.codigo}
                onChange={() => setMotivo(m.codigo)}
                className="accent-primary"
              />
              {m.etiqueta}
            </label>
          ))}
        </fieldset>

        <p
          className={`text-xs rounded-lg px-3 py-2 ${
            habraMerma
              ? 'bg-error/10 text-error font-semibold'
              : 'bg-surface-container-low text-on-surface-variant'
          }`}
        >
          {habraMerma
            ? `Cocina ya empezó este ítem: la anulación se registrará como merma y la estación recibirá un aviso.${
                requiereAutorizacion ? ' Requiere la autorización de un administrador.' : ''
              }`
            : 'Aún no se inició: se retira de la estación sin registrar merma.'}
        </p>

        {/* D36: el administrador ingresa su usuario y contraseña en este mismo equipo para autorizar */}
        {requiereAutorizacion && (
          <fieldset data-autorizacion-admin className="flex flex-col gap-2">
            <legend className="text-xs font-bold uppercase text-on-surface-variant mb-1">
              Autorización del administrador
            </legend>
            <input
              id="anulacion-admin-usuario"
              type="text"
              value={adminUsuario}
              maxLength={50}
              autoComplete="off"
              onChange={(e) => setAdminUsuario(e.target.value)}
              placeholder="Usuario del administrador"
              className="w-full bg-surface-container-low text-sm font-medium px-3 py-2.5 rounded-lg border border-surface-container-high focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <input
              id="anulacion-admin-password"
              type="password"
              value={adminPassword}
              maxLength={100}
              autoComplete="new-password"
              onChange={(e) => setAdminPassword(e.target.value)}
              placeholder="Contraseña"
              className="w-full bg-surface-container-low text-sm font-medium px-3 py-2.5 rounded-lg border border-surface-container-high focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </fieldset>
        )}

        <div className="flex gap-2 justify-end">
          <button
            type="button"
            onClick={onCerrar}
            disabled={enviando}
            className="px-4 py-2 rounded-lg text-xs font-bold text-on-surface-variant hover:bg-surface-container-low"
          >
            Cancelar
          </button>
          <button
            type="button"
            data-confirmar-anulacion
            onClick={confirmar}
            disabled={!motivo || !autorizacionCompleta || enviando}
            className="px-4 py-2 rounded-lg bg-error text-on-error text-xs font-bold disabled:opacity-50"
          >
            {enviando ? 'ANULANDO…' : 'ANULAR ÍTEM'}
          </button>
        </div>
      </div>
    </div>
  );
};
