// Pantalla de Comandero de Sala para La Retama KDS (HU006, HU007, HU008, HU009, HU010, HU023, HU044 & HU046)
// Basada en Stitch (02 - Comandero y Toma de Pedidos / Culinary Operations Light):
// - Antes de la carta el mozo elige el destino: canal y, en Salón, zona → mesa → personas (HU044)
// - Subheader con el destino elegido, "Cambiar" (confirma si hay comanda sin enviar) y "Liberar mesa" (HU046)
// - Búsqueda rápida con respuesta instantánea (< 500 ms) y categorías (HU007)
// - Tarjetas de platos con tiempo estándar de cocina (HU023) y precio en S/
// - Split View: Catálogo a la izquierda (65%) e Inspector de Comanda a la derecha (35%)
// - Cantidades y modificadores por línea; un mismo plato admite varias preparaciones (HU008)
// - Envío en una acción con acuse del servidor y reintento sin duplicar (HU009)

import { useQuery, useQueryClient } from '@tanstack/react-query';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { apiClient } from '../api/client';
import { type Destino, SeleccionDestino } from '../components/comandero/SeleccionDestino';
import { LaRetamaWatermark } from '../components/common/LaRetamaWatermark';
import { TopAppBar } from '../components/common/TopAppBar';
import { useToast } from '../context/ToastContext';
import type {
  AtencionMesa,
  CanalVenta,
  CategoriaPlato,
  ItemComanda,
  PedidoResponse,
  Plato,
} from '../types';
import { ESTILO_ESTADO } from '../utils/cocina';

// Límites de HU008, alineados con las validaciones de ItemPedidoRequest en el backend
const CANTIDAD_MAXIMA = 50;
const MODIFICADORES_MAX_CARACTERES = 255;
const MODIFICADORES_RAPIDOS = ['Sin cebolla', 'Sin ají', 'Poco picante', 'Sin sal'];

// HU009: clave de idempotencia del envío. getRandomValues sí funciona por HTTP plano en la LAN
const nuevaClaveEnvio = (): string => {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return `cmd-${Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')}`;
};

const horaLocal = (fechaIso: string): string =>
  new Date(fechaIso).toLocaleTimeString('es-PE', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

// Contador local de líneas (crypto.randomUUID no está disponible por HTTP plano en la LAN)
let contadorLineas = 0;
const nuevaLineaId = () => `linea-${++contadorLineas}`;

// Activa o retira un modificador rápido dentro de la nota separada por comas
const alternarModificador = (actual: string, modificador: string): string => {
  const partes = actual
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean);
  const existe = partes.some((p) => p.toLowerCase() === modificador.toLowerCase());
  const resultado = existe
    ? partes.filter((p) => p.toLowerCase() !== modificador.toLowerCase())
    : [...partes, modificador];
  return resultado.join(', ');
};

const tieneModificador = (actual: string | undefined, modificador: string): boolean =>
  (actual ?? '').split(',').some((p) => p.trim().toLowerCase() === modificador.toLowerCase());

export const ComanderoPage: React.FC = () => {
  const { showToast } = useToast();

  // Estado operativo de la comanda en armado
  // HU044: canal y, en Salón, la atención de la mesa elegida antes de ver la carta
  const [destino, setDestino] = useState<Destino | null>(null);
  const [confirmar, setConfirmar] = useState<'cambiar' | 'liberar' | null>(null);
  const [liberando, setLiberando] = useState<boolean>(false);
  const [categoriaActiva, setCategoriaActiva] = useState<number | null>(null);
  const [busqueda, setBusqueda] = useState<string>('');
  const [observacionesGenerales, setObservacionesGenerales] = useState<string>('');
  const [correlativoSiguiente, setCorrelativoSiguiente] = useState<string>('CMD-CARGANDO...');

  // Carrito de items de comanda
  const [itemsComanda, setItemsComanda] = useState<ItemComanda[]>([]);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // HU009: la misma clave se reutiliza en cada reintento de la misma comanda. Se guarda en refs
  // (no en estado) para que dos pulsaciones antes del siguiente render compartan clave y bloqueo.
  const claveEnvioRef = useRef<string | null>(null);
  const enviandoRef = useRef<boolean>(false);
  // Envío sin respuesta del servidor: la comanda queda bloqueada hasta reintentar o descartar
  const [envioSinConfirmar, setEnvioSinConfirmar] = useState<boolean>(false);
  const [acuse, setAcuse] = useState<PedidoResponse | null>(null);

  // Queries de datos maestros al Backend de Spring Boot
  const { data: canales = [], refetch: refetchCanales } = useQuery<CanalVenta[]>({
    queryKey: ['canales'],
    queryFn: async () => (await apiClient.get('/canales')).data,
  });

  const queryClient = useQueryClient();

  const canalActual = destino?.canal;
  const esSalon = canalActual?.codigo === 'SALON';
  const atencion = destino?.atencion ?? null;

  // HU010 Escenario 4: si el canal elegido fue desactivado, se vuelve a elegir el destino
  useEffect(() => {
    if (!destino || canales.length === 0) return;
    if (!canales.some((c) => c.id === destino.canal.id)) {
      setDestino(null);
      showToast(
        'El canal elegido fue desactivado. Seleccione otro canal para la comanda.',
        'warning',
      );
    }
  }, [canales, destino, showToast]);

  const recargarAtencion = async (actual: AtencionMesa) => {
    try {
      const res = await apiClient.get<AtencionMesa>(`/mesas/${actual.mesaId}/atencion`);
      setDestino((prev) => (prev ? { ...prev, atencion: res.data } : prev));
    } catch (err: any) {
      // Solo si la mesa ya no está abierta (404) o se le quitó al mozo (403) se vuelve a elegir;
      // un corte de red no debe sacar al mozo de la mesa
      const status: number | undefined = err.response?.status;
      if (status === 404 || status === 403) setDestino(null);
    }
  };

  // HU044 Escenario 6: cambiar de destino con platos sin enviar pide confirmar el descarte
  const handleCambiarDestino = () => {
    if (envioSinConfirmar) return;
    if (itemsComanda.length > 0) {
      setConfirmar('cambiar');
      return;
    }
    setDestino(null);
  };

  // HU046: liberar la mesa cuando el cliente se retira; el servidor exige que todo esté despachado
  const handleLiberarMesa = async () => {
    if (!atencion) return;
    setLiberando(true);
    try {
      await apiClient.post(`/mesas/${atencion.mesaId}/atencion/liberar`);
      showToast(`Mesa ${atencion.mesaNumero} liberada.`, 'success');
      setConfirmar(null);
      handleLimpiarComanda();
      setAcuse(null);
      setDestino(null);
      queryClient.invalidateQueries({ queryKey: ['zonas'] });
    } catch (err: any) {
      showToast(err.response?.data?.mensaje || 'No se pudo liberar la mesa.', 'warning');
      setConfirmar(null);
      recargarAtencion(atencion);
    } finally {
      setLiberando(false);
    }
  };

  const { data: categorias = [] } = useQuery<CategoriaPlato[]>({
    queryKey: ['categorias'],
    queryFn: async () => (await apiClient.get('/categorias')).data,
  });

  const {
    data: platos = [],
    isLoading: cargandoPlatos,
    refetch: refetchPlatos,
  } = useQuery<Plato[]>({
    queryKey: ['platos'],
    queryFn: async () => (await apiClient.get('/platos')).data,
  });

  // Consultar correlativo diario sugerido (HU006)
  const refrescarCorrelativo = async () => {
    try {
      const res = await apiClient.get('/pedidos/correlativo-siguiente');
      if (res.data?.codigoCorrelativo) {
        setCorrelativoSiguiente(res.data.codigoCorrelativo);
      }
    } catch {
      setCorrelativoSiguiente('CMD-LOCAL');
    }
  };

  useEffect(() => {
    refrescarCorrelativo();
  }, []);

  // Búsqueda y filtrado reactivo de platos en memoria (< 100 ms) (HU007)
  const platosFiltrados = useMemo(() => {
    return platos.filter((plato) => {
      const coincideCat = categoriaActiva ? plato.categoriaId === categoriaActiva : true;
      const coincideBusqueda = busqueda.trim()
        ? plato.nombre.toLowerCase().includes(busqueda.toLowerCase().trim())
        : true;
      return coincideCat && coincideBusqueda && plato.disponible;
    });
  }, [platos, categoriaActiva, busqueda]);

  // Funciones de gestión del carrito táctil (actualizaciones inmutables, seguras con StrictMode)
  const handleIncrementarLinea = (lineaId: string) => {
    const linea = itemsComanda.find((i) => i.lineaId === lineaId);
    if (linea && linea.cantidad >= CANTIDAD_MAXIMA) {
      showToast(`La cantidad máxima por ítem es ${CANTIDAD_MAXIMA}.`, 'warning');
      return;
    }
    setItemsComanda((prev) =>
      prev.map((i) =>
        i.lineaId === lineaId ? { ...i, cantidad: Math.min(i.cantidad + 1, CANTIDAD_MAXIMA) } : i,
      ),
    );
  };

  // HU008 Escenario 3: se reutiliza la línea del plato sin modificadores; si todas tienen
  // modificadores, se abre una línea nueva para que cocina distinga cada preparación.
  const handleAgregarPlato = (plato: Plato) => {
    if (envioSinConfirmar) {
      showToast(
        'Reintente el envío pendiente o elija "Editar comanda" antes de cambiarla.',
        'warning',
      );
      return;
    }
    setAcuse(null);
    const lineaBase = itemsComanda.find((i) => i.plato.id === plato.id && !i.modificadores?.trim());
    if (lineaBase) {
      handleIncrementarLinea(lineaBase.lineaId);
      return;
    }
    setItemsComanda((prev) => [
      ...prev,
      { lineaId: nuevaLineaId(), plato, cantidad: 1, modificadores: '' },
    ]);
  };

  // HU008 Escenario 1: al bajar de 1 la línea se retira de la comanda
  const handleDecrementarLinea = (lineaId: string) => {
    setItemsComanda((prev) =>
      prev.flatMap((i) => {
        if (i.lineaId !== lineaId) return [i];
        return i.cantidad > 1 ? [{ ...i, cantidad: i.cantidad - 1 }] : [];
      }),
    );
  };

  const handleQuitarLinea = (lineaId: string) => {
    setItemsComanda((prev) => prev.filter((i) => i.lineaId !== lineaId));
  };

  const handleModificadorChange = (lineaId: string, mod: string) => {
    setItemsComanda((prev) =>
      prev.map((i) =>
        i.lineaId === lineaId
          ? { ...i, modificadores: mod.slice(0, MODIFICADORES_MAX_CARACTERES) }
          : i,
      ),
    );
  };

  const handleToggleModificadorRapido = (lineaId: string, modificador: string) => {
    const linea = itemsComanda.find((i) => i.lineaId === lineaId);
    if (!linea) return;
    const nuevo = alternarModificador(linea.modificadores ?? '', modificador);
    if (nuevo.length > MODIFICADORES_MAX_CARACTERES) {
      showToast(
        `La nota de cocina no puede superar los ${MODIFICADORES_MAX_CARACTERES} caracteres.`,
        'warning',
      );
      return;
    }
    handleModificadorChange(lineaId, nuevo);
  };

  const handleLimpiarComanda = () => {
    setItemsComanda([]);
    setObservacionesGenerales('');
    claveEnvioRef.current = null;
    setEnvioSinConfirmar(false);
  };

  // HU009: antes de permitir editar se pregunta al servidor si el envío sin confirmación llegó
  const handleEditarTrasEnvioFallido = async () => {
    const clave = claveEnvioRef.current;
    if (!clave) {
      setEnvioSinConfirmar(false);
      return;
    }
    try {
      const res = await apiClient.get<PedidoResponse>(`/pedidos/envio/${clave}`);
      // Sí llegó: se muestra el acuse y la comanda se da por enviada (no se edita ni se duplica)
      setAcuse(res.data);
      showToast(`La comanda ${res.data.codigoCorrelativo} sí había llegado a cocina.`, 'info');
      handleLimpiarComanda();
      refrescarCorrelativo();
    } catch (err: any) {
      if (err.response?.status === 404) {
        // No llegó: se puede editar con seguridad y el próximo envío usará una clave nueva
        claveEnvioRef.current = null;
        setEnvioSinConfirmar(false);
        return;
      }
      showToast('Aún no hay conexión con el servidor para verificar el envío.', 'warning');
    }
  };

  // Cálculo de totales y tiempo estimado
  const totalComanda = useMemo(() => {
    return itemsComanda.reduce((acc, item) => acc + item.plato.precio * item.cantidad, 0);
  }, [itemsComanda]);

  const tiempoMaximoCocina = useMemo(() => {
    if (itemsComanda.length === 0) return 0;
    return Math.max(...itemsComanda.map((i) => i.plato.tiempoEstandarMinutos));
  }, [itemsComanda]);

  // Enviar y abrir comanda en cocina (HU006 & HU010)
  const handleEnviarComanda = async () => {
    if (!canalActual) {
      showToast('Seleccione un canal de venta activo para registrar la comanda.', 'warning');
      return;
    }

    if (esSalon && !atencion) {
      showToast('Elija una mesa antes de enviar un pedido de Salón.', 'warning');
      return;
    }

    if (itemsComanda.length === 0) {
      showToast('Agregue al menos un plato a la comanda antes de enviarla.', 'warning');
      return;
    }

    // HU009 Esc. 5: una segunda pulsación mientras hay un envío en curso no hace nada
    if (enviandoRef.current) return;
    enviandoRef.current = true;

    // HU009 Esc. 2 y 5: la clave se genera una vez por comanda y se reutiliza al reintentar
    const clave = claveEnvioRef.current ?? nuevaClaveEnvio();
    claveEnvioRef.current = clave;

    setIsSubmitting(true);
    try {
      const payload = {
        claveIdempotencia: clave,
        canalId: canalActual.id,
        // La mesa solo aplica a consumo en Salón; Para llevar y Delivery no la arrastran
        mesaId: esSalon ? (atencion?.mesaId ?? null) : null,
        // HU045: datos del cliente para llevar
        clienteNombre: destino.cliente?.nombre,
        clienteTelefono: destino.cliente?.celular,
        observaciones: observacionesGenerales.trim() || undefined,
        items: itemsComanda.map((item) => ({
          platoId: item.plato.id,
          cantidad: item.cantidad,
          modificadores: item.modificadores?.trim() || undefined,
        })),
      };

      const res = await apiClient.post<PedidoResponse>('/pedidos', payload);
      const comandaCreada = res.data;

      // HU009 Esc. 1: acuse de recibo confirmado por el servidor (código y hora de registro)
      setAcuse(comandaCreada);
      showToast(
        `Comanda ${comandaCreada.codigoCorrelativo} (${comandaCreada.canalNombre}) recibida por cocina.`,
        'success',
      );
      handleLimpiarComanda();
      refrescarCorrelativo();
      // HU044 Escenario 4: la comanda nueva aparece entre los pedidos de la mesa
      if (atencion) recargarAtencion(atencion);
      // HU045: cada pedido para llevar es de un cliente distinto; se vuelve a pedir nombre y celular
      if (destino.cliente) setDestino(null);
    } catch (err: any) {
      const status: number | undefined = err.response?.status;
      if (!status || status >= 500) {
        // HU009 Esc. 2: sin respuesta o con error del servidor/proxy (502/504) no hay certeza de que
        // no se haya registrado; se conserva la comanda y la misma clave para reintentar
        setEnvioSinConfirmar(true);
        showToast(
          'No hubo confirmación del servidor. Reintente el envío: no se duplicará.',
          'warning',
        );
        return;
      }
      const msg = err.response?.data?.mensaje || 'Error al enviar la comanda al servidor KDS.';
      showToast(msg, 'error');
      // Rechazo definitivo (4xx): la comanda no se registró; se desbloquea y el próximo intento usa otra clave
      setEnvioSinConfirmar(false);
      claveEnvioRef.current = null;
      if (err.response?.status === 400) {
        // HU010 Esc. 4 / HU009 Esc. 6: el canal pudo desactivarse o un plato agotarse mientras se armaba
        refetchCanales();
        refetchPlatos();
      }
      const codigo: string | undefined = err.response?.data?.codigo;
      const mesaPerdida =
        status === 403 || codigo === 'MESA_SIN_ATENCION' || codigo === 'MESA_NO_DISPONIBLE';
      if (esSalon && mesaPerdida) {
        // HU040/HU043/HU044: la mesa se desactivó, se liberó o su zona se le quitó al mozo;
        // se vuelve a elegir la mesa conservando los platos armados
        queryClient.invalidateQueries({ queryKey: ['zonas'] });
        setDestino(null);
      }
    } finally {
      enviandoRef.current = false;
      setIsSubmitting(false);
    }
  };

  if (!destino) {
    return (
      <div className="min-h-screen flex flex-col bg-background font-sans text-on-surface">
        <TopAppBar />
        {/* HU009/HU045: el acuse del último envío sigue visible al volver a elegir destino */}
        {acuse && (
          <output
            aria-live="polite"
            className="max-w-5xl w-full mx-auto mt-4 px-4 lg:px-6 flex items-center gap-2 text-left"
          >
            <span className="flex-1 flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/10 px-3 py-2.5">
              <span className="material-symbols-outlined text-[20px] text-primary">task_alt</span>
              <span className="text-xs font-extrabold">
                Recibido por cocina · {acuse.codigoCorrelativo}
                {acuse.clienteNombre ? ` · ${acuse.clienteNombre}` : ''}
                <span className="font-semibold text-on-surface-variant">
                  {' '}
                  · {acuse.canalNombre} · {horaLocal(acuse.fechaEnvioCocina)}
                </span>
              </span>
            </span>
          </output>
        )}
        <SeleccionDestino
          canales={canales}
          onElegir={(d) => {
            setAcuse(null);
            setDestino(d);
          }}
        />
        <LaRetamaWatermark />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background font-sans text-on-surface">
      <TopAppBar />

      {/* Subheader Operativo: destino elegido (HU044) y Barra de Búsqueda */}
      <section className="bg-surface-container-lowest border-b border-surface-container-high px-4 lg:px-6 py-3 shadow-xs">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
          {/* Destino de la comanda (HU044): canal y, en Salón, la mesa abierta */}
          <div data-destino className="flex items-center gap-3 flex-wrap">
            <span className="material-symbols-outlined text-[24px] text-primary">
              {esSalon ? 'table_restaurant' : 'takeout_dining'}
            </span>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">
                {canalActual?.nombre}
              </p>
              <p className="font-headline font-extrabold text-base leading-tight">
                {atencion
                  ? `Mesa ${atencion.mesaNumero} · ${atencion.zonaNombre}`
                  : destino.cliente
                    ? `Cliente: ${destino.cliente.nombre} · ${destino.cliente.celular}`
                    : 'Pedido sin mesa'}
              </p>
              {atencion && (
                <p className="text-[11px] font-semibold text-on-surface-variant">
                  {atencion.personas} {atencion.personas === 1 ? 'persona' : 'personas'} · abrió{' '}
                  {atencion.mozoNombre}
                </p>
              )}
            </div>
            <button
              type="button"
              data-cambiar-destino
              onClick={handleCambiarDestino}
              disabled={envioSinConfirmar}
              className="px-3 py-1.5 rounded-lg border border-surface-container-high text-xs font-bold text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low disabled:opacity-40"
            >
              {esSalon ? 'Cambiar mesa' : 'Cambiar'}
            </button>
            {atencion && (
              <button
                type="button"
                data-liberar-mesa
                onClick={() => setConfirmar('liberar')}
                disabled={envioSinConfirmar || liberando}
                className="px-3 py-1.5 rounded-lg border border-secondary/40 text-xs font-bold text-secondary hover:bg-secondary/10 disabled:opacity-40"
              >
                Liberar mesa
              </button>
            )}
          </div>

          {/* Barra de Búsqueda Rápida (< 500 ms) (HU007) */}
          <div className="relative flex-1 min-w-[240px] max-w-md">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[18px] text-on-surface-variant pointer-events-none">
              search
            </span>
            <input
              type="text"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar plato en la carta (ej. Lomo, Ceviche)..."
              className="w-full bg-surface-container-low text-on-surface text-xs font-medium pl-9 pr-8 py-2 rounded-lg border border-surface-container-high placeholder:text-outline focus:outline-none focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary transition-all"
            />
            {busqueda && (
              <button
                type="button"
                onClick={() => setBusqueda('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-on-surface"
              >
                <span className="material-symbols-outlined text-[16px]">cancel</span>
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Contenido Principal Split View (65% Catálogo / 35% Comanda Activa) */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 lg:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* PANEL IZQUIERDO: Carta Digital y Filtros por Categoría (65%) */}
        <section className="lg:col-span-8 flex flex-col gap-4">
          {/* Selector de Categorías (Pills táctiles) */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
            <button
              type="button"
              onClick={() => setCategoriaActiva(null)}
              className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all shadow-xs ${
                categoriaActiva === null
                  ? 'bg-primary text-on-primary'
                  : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high'
              }`}
            >
              Todos los Platos
            </button>
            {categorias.map((cat) => {
              const activo = cat.id === categoriaActiva;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setCategoriaActiva(cat.id)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all shadow-xs ${
                    activo
                      ? 'bg-primary text-on-primary'
                      : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high'
                  }`}
                >
                  {cat.nombre}
                </button>
              );
            })}
          </div>

          {/* Grilla de Platos de la Carta */}
          {cargandoPlatos ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 animate-pulse">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="h-32 bg-surface-container rounded-xl" />
              ))}
            </div>
          ) : platosFiltrados.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 bg-surface-container-lowest rounded-2xl border border-dashed border-outline-variant text-center">
              <span className="material-symbols-outlined text-[48px] text-outline mb-2">
                restaurant_menu
              </span>
              <p className="text-sm font-bold text-on-surface">No se encontraron platos</p>
              <p className="text-xs text-on-surface-variant mt-1">
                Pruebe con otra búsqueda o seleccione una categoría diferente.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {platosFiltrados.map((plato) => {
                // Suma todas las líneas del plato (puede haber varias con modificadores distintos)
                const cantidadEnCarrito = itemsComanda
                  .filter((i) => i.plato.id === plato.id)
                  .reduce((acc, i) => acc + i.cantidad, 0);
                return (
                  <div
                    key={plato.id}
                    className="bg-surface-container-lowest border border-surface-container-high rounded-xl p-3.5 flex flex-col justify-between shadow-xs hover:border-primary/50 hover:shadow-md transition-all text-left relative overflow-hidden group"
                  >
                    {/* Indicador de cantidad en carrito si ya fue agregado */}
                    {cantidadEnCarrito > 0 && (
                      <span className="absolute top-2 right-2 bg-primary text-on-primary text-[10px] font-extrabold w-5 h-5 rounded-full flex items-center justify-center shadow-xs">
                        {cantidadEnCarrito}
                      </span>
                    )}

                    <div>
                      <div className="flex items-center gap-1.5 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider mb-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                        <span>{plato.estacionNombre || 'Cocina'}</span>
                      </div>
                      <h2 className="font-bold text-sm text-on-surface line-clamp-2 leading-snug group-hover:text-primary transition-colors">
                        {plato.nombre}
                      </h2>
                    </div>

                    <div className="mt-3 pt-2.5 border-t border-surface-container-low flex items-center justify-between">
                      <div>
                        <span className="text-xs font-extrabold text-on-surface">
                          S/ {plato.precio.toFixed(2)}
                        </span>
                        <div className="flex items-center gap-0.5 text-[10px] font-medium text-on-surface-variant">
                          <span className="material-symbols-outlined text-[12px]">timer</span>
                          <span>{plato.tiempoEstandarMinutos}m</span>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleAgregarPlato(plato)}
                        className="w-8 h-8 rounded-lg bg-surface-container-high hover:bg-primary hover:text-on-primary text-on-surface flex items-center justify-center transition-colors shadow-xs active:scale-90"
                        title="Agregar a la comanda"
                      >
                        <span className="material-symbols-outlined text-[18px]">add</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* PANEL DERECHO: Inspector de Comanda Activa (35%) */}
        {/* Layout táctil autoregulable (self-start + max-h + flex-shrink-0): */}
        {/* Evita el estiramiento forzado de CSS Grid al alto del catálogo (40+ platos), */}
        {/* adaptando la altura orgánicamente al contenido y fijando el total/envío en el viewport. */}
        <aside className="lg:col-span-4 bg-surface-container-lowest border border-surface-container-high rounded-2xl shadow-sm flex flex-col self-start lg:sticky lg:top-20 max-h-[calc(100vh-180px)] overflow-hidden transition-all">
          {/* Cabecera del Ticket */}
          <div className="bg-surface-container-low p-3.5 border-b border-surface-container-high flex items-center justify-between flex-shrink-0">
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-on-surface-variant uppercase">
                  Comanda:
                </span>
                <span className="font-mono text-sm font-extrabold text-primary">
                  {correlativoSiguiente}
                </span>
              </div>
              <p className="text-[11px] font-medium text-on-surface-variant mt-0.5">
                {canalActual?.nombre ?? 'Sin canal'} •{' '}
                {atencion ? `Mesa ${atencion.mesaNumero}` : 'Sin mesa'}
              </p>
            </div>

            {itemsComanda.length > 0 && (
              <button
                type="button"
                onClick={handleLimpiarComanda}
                disabled={envioSinConfirmar}
                className="text-[11px] font-bold text-error hover:underline flex items-center gap-0.5 disabled:opacity-40 disabled:no-underline"
                title="Limpiar todo el pedido"
              >
                <span className="material-symbols-outlined text-[14px]">delete</span>
                Limpiar
              </button>
            )}
          </div>

          {/* HU044 Escenario 4: pedidos ya realizados en la mesa */}
          {atencion && atencion.pedidos.length > 0 && (
            <details
              data-pedidos-mesa
              className="mx-3.5 mt-3 rounded-xl border border-surface-container-high bg-surface-container-low/60 px-3 py-2 text-left flex-shrink-0"
            >
              <summary className="text-xs font-extrabold cursor-pointer">
                Pedidos en esta mesa ({atencion.pedidos.length})
                {atencion.itemsPendientes > 0 && (
                  <span className="ml-1 font-semibold text-tertiary">
                    · {atencion.itemsPendientes} por despachar
                  </span>
                )}
              </summary>
              <ul className="mt-2 flex flex-col gap-1.5 max-h-40 overflow-y-auto">
                {atencion.pedidos.map((p) => (
                  <li key={p.id} className="text-[11px]">
                    <span className="font-mono font-bold text-primary">{p.codigoCorrelativo}</span>
                    <span className="text-on-surface-variant">
                      {' '}
                      · {horaLocal(p.fechaEnvioCocina)}
                    </span>
                    <ul className="pl-3">
                      {p.items.map((i) => (
                        <li key={i.id} className="flex justify-between gap-2">
                          <span>
                            {i.cantidad}× {i.platoNombre}
                          </span>
                          <span className="font-semibold text-on-surface-variant">
                            {ESTILO_ESTADO[i.estadoItem as keyof typeof ESTILO_ESTADO]?.etiqueta ??
                              i.estadoItem}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            </details>
          )}

          {/* HU009 Esc. 1: acuse de recibo del último envío confirmado por el servidor */}
          {acuse && (
            <output
              aria-live="polite"
              className="mx-3.5 mt-3 flex items-start gap-2 rounded-xl border border-primary/30 bg-primary/10 px-3 py-2.5 text-left flex-shrink-0"
            >
              <span className="material-symbols-outlined text-[20px] text-primary">task_alt</span>
              <span className="flex-1">
                <span className="block text-xs font-extrabold text-on-surface">
                  Recibido por cocina · {acuse.codigoCorrelativo}
                  {acuse.clienteNombre ? ` · ${acuse.clienteNombre}` : ''}
                </span>
                <span className="block text-[11px] text-on-surface-variant">
                  {acuse.canalNombre}
                  {acuse.mesaNumero ? ` · Mesa ${acuse.mesaNumero}` : ''} · confirmado a las{' '}
                  {horaLocal(acuse.fechaEnvioCocina)}
                </span>
              </span>
              <button
                type="button"
                onClick={() => setAcuse(null)}
                className="text-on-surface-variant hover:text-on-surface"
                aria-label="Cerrar acuse de recibo"
              >
                <span className="material-symbols-outlined text-[16px]">close</span>
              </button>
            </output>
          )}

          {/* HU009 Esc. 2: envío sin confirmación; se bloquea la edición hasta reintentar o descartar */}
          {envioSinConfirmar && (
            <div
              role="alert"
              className="mx-3.5 mt-3 rounded-xl border border-error/40 bg-error/10 px-3 py-2.5 text-left flex-shrink-0"
            >
              <p className="text-xs font-extrabold text-error flex items-center gap-1">
                <span className="material-symbols-outlined text-[18px]">wifi_off</span>
                Sin confirmación del servidor
              </p>
              <p className="text-[11px] text-on-surface-variant mt-1">
                No sabemos si cocina recibió la comanda. Reintentar es seguro: no se duplicará.
              </p>
              <div className="flex gap-2 mt-2">
                <button
                  type="button"
                  onClick={handleEnviarComanda}
                  disabled={isSubmitting}
                  className="px-3 py-1.5 rounded-lg bg-error text-on-error text-[11px] font-bold disabled:opacity-50"
                >
                  Reintentar envío
                </button>
                <button
                  type="button"
                  onClick={handleEditarTrasEnvioFallido}
                  className="px-3 py-1.5 rounded-lg border border-surface-container-high text-[11px] font-bold text-on-surface-variant"
                >
                  Editar comanda
                </button>
              </div>
            </div>
          )}

          {/* Lista de Ítems del Ticket: contenedor flex con scroll interno autónomo */}
          {/* El scroll vive en un div: los navegadores no hacen scroll fiable sobre un fieldset flex */}
          <div className="flex-1 min-h-0 overflow-y-auto flex flex-col">
            {/* fieldset deshabilita toda la edición mientras hay un envío sin confirmar (HU009) */}
            <fieldset
              disabled={envioSinConfirmar}
              className="flex-1 p-3.5 flex flex-col gap-2.5 min-w-0 border-0 m-0 disabled:opacity-60"
            >
              {itemsComanda.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-on-surface-variant">
                  <span className="material-symbols-outlined text-[42px] text-outline/50 mb-2">
                    shopping_cart
                  </span>
                  <p className="text-xs font-bold text-on-surface">Comanda vacía</p>
                  <p className="text-[11px] mt-1 max-w-[200px]">
                    Seleccione platos de la carta a la izquierda para armar la orden.
                  </p>
                </div>
              ) : (
                itemsComanda.map((item) => (
                  <div
                    key={item.lineaId}
                    className="bg-surface-container-low/70 border border-surface-container-high rounded-xl p-3 flex flex-col gap-2 shadow-2xs flex-shrink-0"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="text-left flex-1">
                        <p className="text-xs font-bold text-on-surface leading-tight">
                          {item.plato.nombre}
                        </p>
                        <span className="text-[10px] text-on-surface-variant font-medium">
                          S/ {item.plato.precio.toFixed(2)} c/u • {item.plato.tiempoEstandarMinutos}{' '}
                          min
                        </span>
                      </div>
                      <span className="text-xs font-extrabold text-on-surface font-mono">
                        S/ {(item.plato.precio * item.cantidad).toFixed(2)}
                      </span>
                    </div>

                    {/* Campo de Modificadores por Ítem ("Sin cebolla", "Término medio") (HU008) */}
                    <div className="relative">
                      <input
                        type="text"
                        value={item.modificadores || ''}
                        maxLength={MODIFICADORES_MAX_CARACTERES}
                        onChange={(e) => handleModificadorChange(item.lineaId, e.target.value)}
                        placeholder="Nota de cocina (ej. Sin ají, término 3/4)..."
                        className="w-full bg-surface-container-lowest text-[11px] pl-2.5 pr-14 py-1.5 rounded-md border border-surface-container-high placeholder:text-outline/70 focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                      {(item.modificadores?.length ?? 0) > 0 && (
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] font-mono text-outline">
                          {item.modificadores?.length}/{MODIFICADORES_MAX_CARACTERES}
                        </span>
                      )}
                    </div>

                    {/* Modificadores rápidos táctiles: un toque agrega, otro toque retira */}
                    <div className="flex flex-wrap gap-1">
                      {MODIFICADORES_RAPIDOS.map((mod) => {
                        const activo = tieneModificador(item.modificadores, mod);
                        return (
                          <button
                            key={mod}
                            type="button"
                            onClick={() => handleToggleModificadorRapido(item.lineaId, mod)}
                            aria-pressed={activo}
                            className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border transition-colors ${
                              activo
                                ? 'bg-primary text-on-primary border-primary'
                                : 'bg-surface-container-lowest text-on-surface-variant border-surface-container-high hover:border-primary/50'
                            }`}
                          >
                            {mod}
                          </button>
                        );
                      })}
                    </div>

                    {/* Controles de Cantidad (+ / -) y Quitar */}
                    <div className="flex items-center justify-between pt-1">
                      <button
                        type="button"
                        onClick={() => handleQuitarLinea(item.lineaId)}
                        className="text-on-surface-variant hover:text-error p-1"
                        title="Quitar plato"
                      >
                        <span className="material-symbols-outlined text-[16px]">delete</span>
                      </button>

                      <div className="flex items-center gap-2 bg-surface-container-lowest rounded-lg border border-surface-container-high px-2 py-0.5">
                        <button
                          type="button"
                          onClick={() => handleDecrementarLinea(item.lineaId)}
                          className="w-6 h-6 flex items-center justify-center text-on-surface hover:bg-surface-container rounded"
                        >
                          <span className="material-symbols-outlined text-[14px]">remove</span>
                        </button>
                        <span className="font-mono text-xs font-bold w-4 text-center">
                          {item.cantidad}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleIncrementarLinea(item.lineaId)}
                          disabled={item.cantidad >= CANTIDAD_MAXIMA}
                          className="w-6 h-6 flex items-center justify-center text-on-surface hover:bg-surface-container rounded disabled:opacity-40"
                        >
                          <span className="material-symbols-outlined text-[14px]">add</span>
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </fieldset>
          </div>

          {/* Pie de Comanda: Observaciones y Botón Enviar */}
          {/* flex-shrink-0 garantiza que el total y el botón de acción nunca sean colapsados por la lista de ítems */}
          <div className="p-3.5 bg-surface-container-low border-t border-surface-container-high flex flex-col gap-2.5 flex-shrink-0">
            {/* Observaciones Generales */}
            <input
              type="text"
              value={observacionesGenerales}
              onChange={(e) => setObservacionesGenerales(e.target.value)}
              disabled={envioSinConfirmar}
              placeholder="Observación general para el pase (opcional)..."
              className="w-full bg-surface-container-lowest text-xs px-3 py-2 rounded-lg border border-surface-container-high placeholder:text-outline focus:outline-none focus:ring-1 focus:ring-primary"
            />

            {/* Resumen de Tiempos y Total */}
            <div className="flex items-center justify-between text-xs">
              <span className="text-on-surface-variant font-medium flex items-center gap-1">
                <span className="material-symbols-outlined text-[16px]">schedule</span>
                Tiempo Max: <strong>{tiempoMaximoCocina} min</strong>
              </span>
              <div className="text-right">
                <span className="text-[11px] text-on-surface-variant block uppercase font-bold">
                  Total Comanda
                </span>
                <span className="text-base font-extrabold text-on-surface font-mono">
                  S/ {totalComanda.toFixed(2)}
                </span>
              </div>
            </div>

            {/* Botón Principal Táctil de Envío a Cocina */}
            <button
              type="button"
              onClick={handleEnviarComanda}
              disabled={isSubmitting || itemsComanda.length === 0 || envioSinConfirmar}
              className="w-full py-3.5 px-4 bg-primary hover:bg-primary-container active:scale-[0.98] text-on-primary rounded-xl font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-md transition-all disabled:opacity-50 cursor-pointer"
            >
              {isSubmitting ? (
                <span className="inline-block w-5 h-5 border-2 border-on-primary border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <span className="material-symbols-outlined text-[18px]">send</span>
                  <span>ENVIAR A COCINA (ABRIR COMANDA)</span>
                </>
              )}
            </button>
          </div>
        </aside>
      </main>

      {confirmar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-on-surface/40 backdrop-blur-xs">
          <div
            role="dialog"
            aria-label={confirmar === 'cambiar' ? 'Descartar comanda' : 'Liberar mesa'}
            className="bg-surface-container-lowest w-full max-w-sm rounded-2xl shadow-2xl border border-surface-container-high p-6 flex flex-col gap-4"
          >
            <h2 className="font-headline font-bold text-lg">
              {confirmar === 'cambiar'
                ? '¿Descartar la comanda?'
                : `¿Liberar la mesa ${atencion?.mesaNumero}?`}
            </h2>
            <p className="text-sm text-on-surface-variant">
              {confirmar === 'cambiar'
                ? `Tiene ${itemsComanda.length} ${itemsComanda.length === 1 ? 'plato' : 'platos'} sin enviar. Si cambia de destino se descartan.`
                : `Hágalo cuando el cliente se haya retirado. La mesa quedará libre para la siguiente atención.${
                    itemsComanda.length > 0
                      ? ` Se descartarán ${itemsComanda.length} ${itemsComanda.length === 1 ? 'plato' : 'platos'} sin enviar.`
                      : ''
                  }`}
            </p>
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setConfirmar(null)}
                className="px-4 py-2 rounded-lg text-xs font-bold text-on-surface-variant hover:bg-surface-container-low"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={liberando}
                onClick={() => {
                  if (confirmar === 'cambiar') {
                    handleLimpiarComanda();
                    setConfirmar(null);
                    setDestino(null);
                  } else {
                    handleLiberarMesa();
                  }
                }}
                className="px-4 py-2 rounded-lg bg-primary text-on-primary text-xs font-bold disabled:opacity-50"
              >
                {confirmar === 'cambiar' ? 'DESCARTAR Y CAMBIAR' : 'LIBERAR MESA'}
              </button>
            </div>
          </div>
        </div>
      )}

      <LaRetamaWatermark />
    </div>
  );
};
