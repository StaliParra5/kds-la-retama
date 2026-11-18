// Registro manual de pedidos externos (HU020): el expedidor carga un pedido recibido por WhatsApp,
// teléfono o un agregador (Rappi) y lo envía a cocina por la misma ruta que el comandero.
// - Canal obligatorio (Esc. 2); un agregador (Rappi) pide solo el número de orden, sin celular ni dirección,
//   y lo muestra la tarjeta (Esc. 3); Delivery propio (WhatsApp/teléfono) pide nombre, celular de 9 dígitos y
//   dirección; Para llevar es recojo en el local y pide nombre y celular, sin dirección (Esc. 4);
//   al menos un plato (Esc. 6).
// - Pensado para registrar en menos de 60 s (Esc. 1): canal con un toque, búsqueda de platos y envío en una acción.
// - Cada envío lleva una clave: un reintento tras una falla de red no duplica el pedido (HU009).
// - La pestaña "Recientes" lista los pedidos externos de las últimas 24 horas para anular un ítem (D32).

import { useQuery, useQueryClient } from '@tanstack/react-query';
import React, { useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiClient } from '../api/client';
import { useRecargaAgrupada, useTiempoReal } from '../api/tiempoReal';
import {
  AnularItemDialog,
  type ItemPorAnular,
  PedidosEnviados,
} from '../components/comandero/AnulacionItem';
import { TopAppBar } from '../components/common/TopAppBar';
import { useToast } from '../context/ToastContext';
import type { CanalVenta, CategoriaPlato, PedidoResponse, Plato } from '../types';

interface Linea {
  id: number;
  plato: Plato;
  cantidad: number;
  // Modificadores elegidos del catálogo del plato, unidos por coma como los guarda el servidor
  modificadores: string;
}

const CELULAR_PERU = /^9\d{8}$/;
const CANTIDAD_MAXIMA = 50;

const nuevaClave = (): string =>
  `ext-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

// Búsqueda sin distinguir mayúsculas ni tildes: "ají" y "aji" encuentran el mismo plato
const normalizar = (texto: string): string =>
  texto.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');

const campo =
  'w-full bg-surface-container-low text-sm font-medium px-3 py-2.5 rounded-lg border border-surface-container-high focus:outline-none focus:ring-2 focus:ring-primary';
// Mismo campo marcado en rojo cuando el celular escrito todavía no es válido
const campoError = campo
  .replace('border-surface-container-high', 'border-error')
  .replace('focus:ring-primary', 'focus:ring-error');

export const PedidoExternoPage: React.FC = () => {
  const { showToast } = useToast();
  const [canalId, setCanalId] = useState<number | null>(null);
  const [numeroOrden, setNumeroOrden] = useState('');
  const [nombre, setNombre] = useState('');
  const [telefono, setTelefono] = useState('');
  const [direccion, setDireccion] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [categoriaId, setCategoriaId] = useState<number | null>(null);
  const [lineas, setLineas] = useState<Linea[]>([]);
  const [enviando, setEnviando] = useState(false);
  const [ultimo, setUltimo] = useState<PedidoResponse | null>(null);
  const [pestana, setPestana] = useState<'registrar' | 'recientes'>('registrar');
  const [itemPorAnular, setItemPorAnular] = useState<ItemPorAnular | null>(null);
  const queryClient = useQueryClient();
  const siguienteLinea = useRef(1);
  // Misma clave hasta que el servidor confirme: reintentar tras una falla de red no duplica el pedido
  const clave = useRef(nuevaClave());

  const { data: canales = [] } = useQuery<CanalVenta[]>({
    queryKey: ['canales'],
    queryFn: async () => (await apiClient.get('/canales')).data,
  });
  const {
    data: platos = [],
    isLoading: cargandoPlatos,
    refetch: refetchPlatos,
  } = useQuery<Plato[]>({
    queryKey: ['platos'],
    queryFn: async () => (await apiClient.get('/platos')).data,
  });
  const { data: categorias = [] } = useQuery<CategoriaPlato[]>({
    queryKey: ['categorias'],
    queryFn: async () => (await apiClient.get('/categorias')).data,
  });

  // D32: pedidos externos de las últimas 24 horas. El estado de sus ítems cambia en cocina, así que la lista se
  // recarga con cada aviso de /topic/pedidos (llega uno por cada ítem que cambia) y al reconectar; la lectura
  // cada 15 s queda solo como respaldo por si un aviso se pierde
  const { data: recientes = [] } = useQuery<PedidoResponse[]>({
    queryKey: ['pedidos-externos-recientes'],
    queryFn: async () => (await apiClient.get('/pedidos/externos/recientes')).data,
    refetchInterval: 15000,
  });
  const recargarRecientes = useRecargaAgrupada(['pedidos-externos-recientes']);
  // HU030: un plato agotado o reactivado también se refleja al instante en la carta de esta pantalla
  const recargarCarta = useRecargaAgrupada(['platos']);
  useTiempoReal({
    destinos: ['/topic/pedidos', '/topic/platos'],
    alMensaje: (destino) => (destino === '/topic/platos' ? recargarCarta() : recargarRecientes()),
    alConectar: () => {
      recargarRecientes();
      recargarCarta();
    },
  });

  // Salón no es externo: exige mesa y atención abierta, y es del mozo
  const opciones = canales.filter((c) => c.codigo !== 'SALON');
  const canal = opciones.find((c) => c.id === canalId) ?? null;
  const esAgregador = canal?.externo === true;
  const esParaLlevar = canal?.codigo === 'PARA_LLEVAR';
  const necesitaContacto = canal !== null && !esAgregador;
  // Solo el reparto propio necesita dirección: Para llevar se recoge en el local y el agregador entrega por su cuenta
  const pideDireccion = canal !== null && !esAgregador && !esParaLlevar;
  const celularInvalido = necesitaContacto && !CELULAR_PERU.test(telefono);
  // El aviso aparece solo cuando ya se empezó a escribir: un campo vacío no se marca en rojo
  const avisarCelular = celularInvalido && telefono.length > 0;

  const platosVisibles = useMemo(() => {
    const texto = normalizar(busqueda.trim());
    return platos.filter(
      (p) =>
        p.activo !== false &&
        p.disponible &&
        (categoriaId === null || p.categoriaId === categoriaId) &&
        (texto === '' || normalizar(p.nombre).includes(texto)),
    );
  }, [platos, busqueda, categoriaId]);

  // Lo que falta para poder enviar; el servidor vuelve a validar todo
  const errores: string[] = [];
  if (!canal) errores.push('Seleccione el canal del pedido.');
  if (canal && esAgregador && !numeroOrden.trim()) {
    errores.push(`Ingrese el número de orden de ${canal.nombre}.`);
  }
  if (canal && necesitaContacto) {
    if (!nombre.trim()) errores.push('Ingrese el nombre del cliente.');
    // El celular no tiene aviso aparte: el campo solo admite hasta 9 dígitos y el envío sigue bloqueado hasta completarlo
    if (pideDireccion && !direccion.trim()) errores.push('Ingrese la dirección de entrega.');
  }
  if (lineas.length === 0) errores.push('Agregue al menos un plato.');

  const agregarPlato = (plato: Plato) =>
    setLineas((prev) => {
      // Un mismo plato sin modificadores suma cantidad; con modificadores distintos queda en otra línea (HU008)
      const existente = prev.find((l) => l.plato.id === plato.id && l.modificadores === '');
      if (existente) {
        return prev.map((l) =>
          l === existente ? { ...l, cantidad: Math.min(CANTIDAD_MAXIMA, l.cantidad + 1) } : l,
        );
      }
      return [...prev, { id: siguienteLinea.current++, plato, cantidad: 1, modificadores: '' }];
    });

  const cambiarCantidad = (id: number, delta: number) =>
    setLineas((prev) =>
      prev.map((l) =>
        l.id === id
          ? { ...l, cantidad: Math.min(CANTIDAD_MAXIMA, Math.max(1, l.cantidad + delta)) }
          : l,
      ),
    );

  const quitarLinea = (id: number) => setLineas((prev) => prev.filter((l) => l.id !== id));

  const alternarModificador = (id: number, modificador: string) =>
    setLineas((prev) =>
      prev.map((l) => {
        if (l.id !== id) return l;
        const actuales = l.modificadores ? l.modificadores.split(', ') : [];
        const nuevos = actuales.includes(modificador)
          ? actuales.filter((m) => m !== modificador)
          : [...actuales, modificador];
        return { ...l, modificadores: nuevos.join(', ') };
      }),
    );

  // Tras un envío exitoso se conserva el canal: el expedidor suele cargar varios pedidos seguidos del mismo
  const reiniciarFormulario = () => {
    setNumeroOrden('');
    setNombre('');
    setTelefono('');
    setDireccion('');
    setObservaciones('');
    setBusqueda('');
    setLineas([]);
    clave.current = nuevaClave();
  };

  const enviar = async () => {
    if (errores.length > 0 || celularInvalido || enviando || !canal) return;
    setEnviando(true);
    try {
      const { data } = await apiClient.post<PedidoResponse>('/pedidos/externo', {
        canalId: canal.id,
        numeroOrdenExterno: esAgregador ? numeroOrden.trim() : undefined,
        clienteNombre: nombre.trim() || undefined,
        clienteTelefono: necesitaContacto ? telefono || undefined : undefined,
        clienteDireccion: pideDireccion ? direccion.trim() || undefined : undefined,
        observaciones: observaciones.trim() || undefined,
        claveIdempotencia: clave.current,
        items: lineas.map((l) => ({
          platoId: l.plato.id,
          cantidad: l.cantidad,
          modificadores: l.modificadores || undefined,
        })),
      });
      setUltimo(data);
      queryClient.invalidateQueries({ queryKey: ['pedidos-externos-recientes'] });
      showToast(`Pedido ${data.codigoCorrelativo} (${data.canalNombre}) enviado a cocina.`, 'success');
      reiniciarFormulario();
    } catch (err: any) {
      const respuesta = err.response;
      showToast(
        respuesta?.data?.mensaje ?? 'No se pudo registrar el pedido. Revise la conexión e intente de nuevo.',
        respuesta ? 'warning' : 'error',
      );
      // Un plato pudo agotarse o cambiar mientras se armaba el pedido: se recarga la carta
      if (respuesta?.status === 400) refetchPlatos();
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background font-sans text-on-surface">
      <TopAppBar />

      <div className="bg-surface-container-lowest border-b border-surface-container-high px-4 lg:px-6 py-3">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-[28px] text-secondary">add_call</span>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">
                Pase
              </p>
              <h2 className="font-headline font-extrabold text-xl">Registrar pedido externo</h2>
            </div>
          </div>
          {/* Una sola barra de pestañas en vez de más botones: Recientes lista los pedidos y permite anular un ítem */}
          <div data-pestanas className="flex items-center gap-2">
            {(
              [
                ['registrar', 'Registrar'],
                ['recientes', `Recientes (${recientes.length})`],
              ] as const
            ).map(([valor, texto]) => (
              <button
                key={valor}
                type="button"
                data-pestana={valor}
                aria-pressed={pestana === valor}
                onClick={() => {
                  setPestana(valor);
                  if (valor === 'recientes') recargarRecientes();
                }}
                className={`min-h-[44px] px-4 rounded-xl border text-xs font-bold transition-colors ${
                  pestana === valor
                    ? 'bg-primary text-on-primary border-primary'
                    : 'bg-surface-container-low text-on-surface-variant border-surface-container-high hover:border-primary/50'
                }`}
              >
                {texto}
              </button>
            ))}
          </div>
          <Link
            to="/pase"
            className="min-h-[44px] px-4 inline-flex items-center gap-2 rounded-xl border border-surface-container-high text-xs font-bold hover:border-primary/50"
          >
            <span className="material-symbols-outlined text-[18px]">arrow_back</span>
            Volver al pase
          </Link>
        </div>
      </div>

      {pestana === 'registrar' ? (
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 lg:p-6 grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6">
        <section className="flex flex-col gap-5">
          {ultimo && (
            <p
              data-ultimo-externo={ultimo.codigoCorrelativo}
              className="text-sm font-semibold rounded-xl bg-secondary/10 text-secondary px-4 py-3"
            >
              Último pedido enviado: {ultimo.codigoCorrelativo} · {ultimo.canalNombre}
              {ultimo.numeroOrdenExterno ? ` · Orden ${ultimo.numeroOrdenExterno}` : ''}
            </p>
          )}

          {/* Canal obligatorio (Esc. 2) */}
          <div>
            <h3 className="text-xs font-bold uppercase text-on-surface-variant mb-2">Canal</h3>
            <div className="flex flex-wrap gap-2">
              {opciones.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  data-canal-externo={c.codigo}
                  aria-pressed={canalId === c.id}
                  onClick={() => setCanalId(c.id)}
                  className={`min-h-[48px] px-5 rounded-xl border text-sm font-bold transition-colors ${
                    canalId === c.id
                      ? 'bg-primary text-on-primary border-primary'
                      : 'bg-surface-container-lowest border-surface-container-high hover:border-primary/50'
                  }`}
                >
                  {c.nombre}
                </button>
              ))}
            </div>
          </div>

          {/* Datos según el canal: número de orden del agregador o contacto del cliente (Esc. 3 y 4) */}
          {canal && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {esAgregador && (
                <div className="sm:col-span-2">
                  <label htmlFor="externo-numero-orden" className="block text-xs font-bold uppercase mb-1">
                    Número de orden de {canal.nombre}
                  </label>
                  <input
                    id="externo-numero-orden"
                    className={campo}
                    value={numeroOrden}
                    maxLength={60}
                    onChange={(e) => setNumeroOrden(e.target.value)}
                    placeholder="Ej. RP-48213"
                  />
                </div>
              )}
              <div>
                <label htmlFor="externo-nombre" className="block text-xs font-bold uppercase mb-1">
                  Nombre del cliente{esAgregador ? ' (opcional)' : ''}
                </label>
                <input
                  id="externo-nombre"
                  className={campo}
                  value={nombre}
                  maxLength={120}
                  onChange={(e) => setNombre(e.target.value)}
                />
              </div>
              {/* Rappi no maneja celular del cliente */}
              {!esAgregador && (
                <div>
                  <label htmlFor="externo-telefono" className="block text-xs font-bold uppercase mb-1">
                    Celular
                  </label>
                  <input
                    id="externo-telefono"
                    className={avisarCelular ? campoError : campo}
                    inputMode="numeric"
                    value={telefono}
                    maxLength={9}
                    aria-invalid={avisarCelular}
                    aria-describedby={avisarCelular ? 'externo-celular-aviso' : undefined}
                    onChange={(e) => setTelefono(e.target.value.replace(/\D/g, '').slice(0, 9))}
                    placeholder="987654321"
                  />
                  {avisarCelular && (
                    <p
                      id="externo-celular-aviso"
                      data-aviso-celular
                      className="mt-1 text-xs font-semibold text-error"
                    >
                      {telefono.length < 9 ? 'Complete los 9 dígitos' : 'El celular debe empezar con 9'}
                    </p>
                  )}
                </div>
              )}
              {pideDireccion && (
                <div className="sm:col-span-2">
                  <label htmlFor="externo-direccion" className="block text-xs font-bold uppercase mb-1">
                    Dirección
                  </label>
                  <input
                    id="externo-direccion"
                    className={campo}
                    value={direccion}
                    maxLength={255}
                    onChange={(e) => setDireccion(e.target.value)}
                  />
                </div>
              )}
            </div>
          )}

          {/* Carta: búsqueda y categorías, un toque agrega el plato */}
          <div>
            <h3 className="text-xs font-bold uppercase text-on-surface-variant mb-2">Platos</h3>
            <input
              id="externo-buscar"
              className={campo}
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar plato…"
              autoComplete="off"
            />
            <div className="flex flex-wrap gap-1.5 mt-2">
              <button
                type="button"
                aria-pressed={categoriaId === null}
                onClick={() => setCategoriaId(null)}
                className={`min-h-[36px] px-3 rounded-full border text-xs font-bold ${
                  categoriaId === null
                    ? 'bg-primary text-on-primary border-primary'
                    : 'border-surface-container-high hover:border-primary/50'
                }`}
              >
                Todas
              </button>
              {categorias.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  aria-pressed={categoriaId === c.id}
                  onClick={() => setCategoriaId(c.id)}
                  className={`min-h-[36px] px-3 rounded-full border text-xs font-bold ${
                    categoriaId === c.id
                      ? 'bg-primary text-on-primary border-primary'
                      : 'border-surface-container-high hover:border-primary/50'
                  }`}
                >
                  {c.nombre}
                </button>
              ))}
            </div>
            {/* Mismas tarjetas de plato que el comandero del mozo */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-3 max-h-[560px] overflow-y-auto pr-1">
              {cargandoPlatos && <p className="text-sm text-on-surface-variant">Cargando carta…</p>}
              {!cargandoPlatos && platosVisibles.length === 0 && (
                <p className="col-span-full text-sm text-on-surface-variant">
                  No hay platos disponibles con ese criterio.
                </p>
              )}
              {platosVisibles.map((p) => {
                // Suma todas las líneas del plato (puede haber varias con modificadores distintos)
                const cantidadEnPedido = lineas
                  .filter((l) => l.plato.id === p.id)
                  .reduce((acc, l) => acc + l.cantidad, 0);
                return (
                  <div
                    key={p.id}
                    data-plato={p.id}
                    className="bg-surface-container-lowest border border-surface-container-high rounded-xl p-3.5 flex flex-col justify-between shadow-xs hover:border-primary/50 hover:shadow-md transition-all text-left relative overflow-hidden group"
                  >
                    {cantidadEnPedido > 0 && (
                      <span className="absolute top-2 right-2 bg-primary text-on-primary text-[10px] font-extrabold w-5 h-5 rounded-full flex items-center justify-center shadow-xs">
                        {cantidadEnPedido}
                      </span>
                    )}

                    <div>
                      <div className="flex items-center gap-1.5 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider mb-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                        <span>{p.estacionNombre || 'Cocina'}</span>
                      </div>
                      <h2 className="font-bold text-sm text-on-surface line-clamp-2 leading-snug group-hover:text-primary transition-colors">
                        {p.nombre}
                      </h2>
                    </div>

                    <div className="mt-3 pt-2.5 border-t border-surface-container-low flex items-center justify-between">
                      <div>
                        <span className="text-xs font-extrabold text-on-surface">
                          S/ {Number(p.precio).toFixed(2)}
                        </span>
                        <div className="flex items-center gap-0.5 text-[10px] font-medium text-on-surface-variant">
                          <span className="material-symbols-outlined text-[12px]">timer</span>
                          <span>{p.tiempoEstandarMinutos}m</span>
                        </div>
                      </div>

                      <button
                        type="button"
                        data-plato-agregar={p.id}
                        onClick={() => agregarPlato(p)}
                        className="w-8 h-8 rounded-lg bg-surface-container-high hover:bg-primary hover:text-on-primary text-on-surface flex items-center justify-center transition-colors shadow-xs active:scale-90"
                        title="Agregar al pedido"
                        aria-label={`Agregar ${p.nombre}`}
                      >
                        <span className="material-symbols-outlined text-[18px]">add</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Resumen del pedido y envío */}
        <aside className="bg-surface-container-lowest border border-surface-container-high rounded-2xl p-4 flex flex-col gap-3 h-fit lg:sticky lg:top-20">
          <h3 className="font-headline font-bold text-lg">
            Pedido {canal ? `· ${canal.nombre}` : ''}
          </h3>

          {lineas.length === 0 ? (
            <p className="text-sm text-on-surface-variant">Todavía no hay platos.</p>
          ) : (
            <ul className="flex flex-col gap-2.5">
              {lineas.map((l) => (
                <li
                  key={l.id}
                  data-linea-externa={l.plato.id}
                  className="border rounded-xl p-3 flex flex-col gap-2 shadow-2xs bg-surface-container-low/70 border-surface-container-high"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="text-left flex-1">
                      <p className="text-xs font-bold text-on-surface leading-tight">{l.plato.nombre}</p>
                      <span className="text-[10px] text-on-surface-variant font-medium">
                        S/ {Number(l.plato.precio).toFixed(2)} c/u • {l.plato.tiempoEstandarMinutos} min
                      </span>
                    </div>
                    <span className="text-xs font-extrabold text-on-surface font-mono">
                      S/ {(Number(l.plato.precio) * l.cantidad).toFixed(2)}
                    </span>
                  </div>

                  {/* Modificadores del plato; sin ellos solo se indica la cantidad (HU008) */}
                  {l.plato.modificadores.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {l.plato.modificadores.map((m) => {
                        const activo = l.modificadores.split(', ').includes(m);
                        return (
                          <button
                            key={m}
                            type="button"
                            aria-pressed={activo}
                            onClick={() => alternarModificador(l.id, m)}
                            className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border transition-colors ${
                              activo
                                ? 'bg-primary text-on-primary border-primary'
                                : 'bg-surface-container-lowest text-on-surface-variant border-surface-container-high hover:border-primary/50'
                            }`}
                          >
                            {m}
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-[10px] font-medium text-outline">
                      Este plato no tiene modificadores: solo indique la cantidad.
                    </p>
                  )}

                  <div className="flex items-center justify-between pt-1">
                    <button
                      type="button"
                      aria-label={`Quitar ${l.plato.nombre}`}
                      onClick={() => quitarLinea(l.id)}
                      className="text-on-surface-variant hover:text-error p-1"
                      title="Quitar plato"
                    >
                      <span className="material-symbols-outlined text-[16px]">delete</span>
                    </button>

                    <div className="flex items-center gap-2 bg-surface-container-lowest rounded-lg border border-surface-container-high px-2 py-0.5">
                      <button
                        type="button"
                        aria-label="Menos"
                        onClick={() => cambiarCantidad(l.id, -1)}
                        className="w-6 h-6 flex items-center justify-center text-on-surface hover:bg-surface-container rounded"
                      >
                        <span className="material-symbols-outlined text-[14px]">remove</span>
                      </button>
                      <span className="font-mono text-xs font-bold w-4 text-center">{l.cantidad}</span>
                      <button
                        type="button"
                        aria-label="Más"
                        onClick={() => cambiarCantidad(l.id, 1)}
                        disabled={l.cantidad >= CANTIDAD_MAXIMA}
                        className="w-6 h-6 flex items-center justify-center text-on-surface hover:bg-surface-container rounded disabled:opacity-40"
                      >
                        <span className="material-symbols-outlined text-[14px]">add</span>
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}

          <div>
            <label htmlFor="externo-observaciones" className="block text-xs font-bold uppercase mb-1">
              Observaciones (opcional)
            </label>
            <input
              id="externo-observaciones"
              type="text"
              className={campo}
              maxLength={500}
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
            />
          </div>

          {errores.length > 0 && (
            <ul data-errores-externo className="text-xs text-on-surface-variant flex flex-col gap-0.5">
              {errores.map((e) => (
                <li key={e}>• {e}</li>
              ))}
            </ul>
          )}

          <button
            type="button"
            data-enviar-externo
            onClick={enviar}
            disabled={errores.length > 0 || celularInvalido || enviando}
            className="min-h-[52px] rounded-xl bg-primary text-on-primary font-bold disabled:opacity-50"
          >
            {enviando ? 'ENVIANDO…' : 'ENVIAR A COCINA'}
          </button>
        </aside>
      </main>
      ) : (
        <main data-recientes className="flex-1 max-w-3xl w-full mx-auto p-4 lg:p-6">
          <div className="bg-surface-container-lowest border border-surface-container-high rounded-2xl p-4">
            <h3 className="font-headline font-bold text-lg">Pedidos externos de las últimas 24 horas</h3>
            <p className="text-xs text-on-surface-variant mt-1">
              Pulse "Anular" en un ítem para retirarlo del pedido.
            </p>
            {recientes.length === 0 ? (
              <p data-sin-recientes className="text-sm text-on-surface-variant mt-4">
                No hay pedidos externos en las últimas 24 horas.
              </p>
            ) : (
              <PedidosEnviados
                pedidos={recientes}
                onAnular={setItemPorAnular}
                mostrarCanal
                claseLista="max-h-[65vh] overflow-y-auto"
              />
            )}
          </div>
        </main>
      )}

      {itemPorAnular && (
        <AnularItemDialog
          objetivo={itemPorAnular}
          onCerrar={() => setItemPorAnular(null)}
          onResuelto={() => {
            setItemPorAnular(null);
            queryClient.invalidateQueries({ queryKey: ['pedidos-externos-recientes'] });
          }}
        />
      )}
    </div>
  );
};
