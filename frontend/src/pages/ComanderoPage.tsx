// Pantalla de Comandero de Sala para La Retama KDS (HU006, HU007 & HU023)
// Basada en Stitch (02 - Comandero y Toma de Pedidos / Culinary Operations Light):
// - Subheader con selector de Canal de Venta (HU037) y Zonas/Mesas (HU005)
// - Búsqueda rápida con respuesta instantánea (< 500 ms) y categorías (HU007)
// - Tarjetas de platos con tiempo estándar de cocina (HU023) y precio en S/
// - Split View: Catálogo a la izquierda (65%) e Inspector de Comanda a la derecha (35%)

import { useQuery } from '@tanstack/react-query';
import React, { useEffect, useMemo, useState } from 'react';
import { apiClient } from '../api/client';
import { LaRetamaWatermark } from '../components/common/LaRetamaWatermark';
import { TopAppBar } from '../components/common/TopAppBar';
import { useToast } from '../context/ToastContext';
import type { CanalVenta, CategoriaPlato, ItemComanda, Mesa, Plato, Zona } from '../types';

export const ComanderoPage: React.FC = () => {
  const { showToast } = useToast();

  // Estado operativo de la comanda en armado
  const [canalSeleccionado, setCanalSeleccionado] = useState<number>(1); // 1 = Salón
  const [mesaSeleccionada, setMesaSeleccionada] = useState<number | ''>(8);
  const [zonaActiva, setZonaActiva] = useState<number | null>(null);
  const [categoriaActiva, setCategoriaActiva] = useState<number | null>(null);
  const [busqueda, setBusqueda] = useState<string>('');
  const [observacionesGenerales, setObservacionesGenerales] = useState<string>('');
  const [correlativoSiguiente, setCorrelativoSiguiente] = useState<string>('CMD-CARGANDO...');

  // Carrito de items de comanda
  const [itemsComanda, setItemsComanda] = useState<ItemComanda[]>([]);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Queries de datos maestros al Backend de Spring Boot
  const { data: canales = [] } = useQuery<CanalVenta[]>({
    queryKey: ['canales'],
    queryFn: async () => (await apiClient.get('/canales')).data,
  });

  const { data: zonas = [] } = useQuery<Zona[]>({
    queryKey: ['zonas'],
    queryFn: async () => (await apiClient.get('/zonas')).data,
  });

  const { data: mesas = [] } = useQuery<Mesa[]>({
    queryKey: ['mesas'],
    queryFn: async () => (await apiClient.get('/mesas')).data,
  });

  const { data: categorias = [] } = useQuery<CategoriaPlato[]>({
    queryKey: ['categorias'],
    queryFn: async () => (await apiClient.get('/categorias')).data,
  });

  const { data: platos = [], isLoading: cargandoPlatos } = useQuery<Plato[]>({
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

  // Filtrado de mesas por zona activa
  const mesasFiltradas = useMemo(() => {
    if (!zonaActiva) return mesas;
    return mesas.filter((m) => m.zonaId === zonaActiva);
  }, [mesas, zonaActiva]);

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

  // Funciones de gestión del carrito táctil
  const handleAgregarPlato = (plato: Plato) => {
    setItemsComanda((prev) => {
      const idx = prev.findIndex((i) => i.plato.id === plato.id);
      if (idx >= 0) {
        const copia = [...prev];
        copia[idx].cantidad += 1;
        return copia;
      }
      return [...prev, { plato, cantidad: 1, modificadores: '' }];
    });
  };

  const handleDecrementarPlato = (platoId: number) => {
    setItemsComanda((prev) => {
      const idx = prev.findIndex((i) => i.plato.id === platoId);
      if (idx >= 0) {
        if (prev[idx].cantidad > 1) {
          const copia = [...prev];
          copia[idx].cantidad -= 1;
          return copia;
        }
        return prev.filter((i) => i.plato.id !== platoId);
      }
      return prev;
    });
  };

  const handleQuitarPlato = (platoId: number) => {
    setItemsComanda((prev) => prev.filter((i) => i.plato.id !== platoId));
  };

  const handleModificadorChange = (platoId: number, mod: string) => {
    setItemsComanda((prev) =>
      prev.map((i) => (i.plato.id === platoId ? { ...i, modificadores: mod } : i)),
    );
  };

  const handleLimpiarComanda = () => {
    setItemsComanda([]);
    setObservacionesGenerales('');
  };

  // Cálculo de totales y tiempo estimado
  const totalComanda = useMemo(() => {
    return itemsComanda.reduce((acc, item) => acc + item.plato.precio * item.cantidad, 0);
  }, [itemsComanda]);

  const tiempoMaximoCocina = useMemo(() => {
    if (itemsComanda.length === 0) return 0;
    return Math.max(...itemsComanda.map((i) => i.plato.tiempoEstandarMinutos));
  }, [itemsComanda]);

  // Enviar y abrir comanda en cocina (HU006)
  const handleEnviarComanda = async () => {
    const canalObj = canales.find((c) => c.id === canalSeleccionado);
    if (canalObj?.codigo === 'SALON' && !mesaSeleccionada) {
      showToast('Seleccione una mesa obligatoriamente para pedidos de Salón.', 'warning');
      return;
    }

    if (itemsComanda.length === 0) {
      showToast('Agregue al menos un plato a la comanda antes de enviarla.', 'warning');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        canalId: canalSeleccionado,
        mesaId: mesaSeleccionada || null,
        observaciones: observacionesGenerales.trim() || undefined,
        items: itemsComanda.map((item) => ({
          platoId: item.plato.id,
          cantidad: item.cantidad,
          modificadores: item.modificadores?.trim() || undefined,
        })),
      };

      const res = await apiClient.post('/pedidos', payload);
      const comandaCreada = res.data;

      showToast(
        `¡Comanda ${comandaCreada.codigoCorrelativo} abierta y enviada a cocina!`,
        'success',
      );
      handleLimpiarComanda();
      refrescarCorrelativo();
    } catch (err: any) {
      const msg = err.response?.data?.mensaje || 'Error al enviar la comanda al servidor KDS.';
      showToast(msg, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background font-sans text-on-surface">
      <TopAppBar />

      {/* Subheader Operativo: Selección de Canal, Mesas y Barra de Búsqueda */}
      <section className="bg-surface-container-lowest border-b border-surface-container-high px-4 lg:px-6 py-3 shadow-xs">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
          {/* Canales de Venta (HU037) */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-on-surface-variant flex items-center gap-1">
              <span className="material-symbols-outlined text-[16px]">local_shipping</span>
              Canal:
            </span>
            <div className="flex items-center gap-1 bg-surface-container-low p-1 rounded-lg border border-surface-container-high">
              {canales.map((canal) => {
                const activo = canal.id === canalSeleccionado;
                return (
                  <button
                    key={canal.id}
                    type="button"
                    onClick={() => setCanalSeleccionado(canal.id)}
                    className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
                      activo
                        ? 'bg-primary text-on-primary shadow-xs'
                        : 'text-on-surface-variant hover:text-on-surface'
                    }`}
                  >
                    {canal.nombre}
                    <span className="ml-1 opacity-70 text-[10px]">
                      ({canal.slaObjetivoMinutos}m)
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Selección de Mesas y Zonas (HU005) - visible si es Salón */}
          {canales.find((c) => c.id === canalSeleccionado)?.codigo === 'SALON' && (
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-on-surface-variant flex items-center gap-1">
                <span className="material-symbols-outlined text-[16px]">table_restaurant</span>
                Mesa:
              </span>
              {/* Filtro rápido por zona física */}
              <div className="hidden sm:flex items-center gap-1 bg-surface-container-low p-0.5 rounded-lg border border-surface-container-high">
                <button
                  type="button"
                  onClick={() => setZonaActiva(null)}
                  className={`px-2 py-1 rounded text-[11px] font-bold transition-all ${
                    zonaActiva === null
                      ? 'bg-primary text-on-primary'
                      : 'text-on-surface-variant hover:text-on-surface'
                  }`}
                >
                  Todas
                </button>
                {zonas.map((z) => (
                  <button
                    key={z.id}
                    type="button"
                    onClick={() => setZonaActiva(z.id)}
                    className={`px-2 py-1 rounded text-[11px] font-bold transition-all ${
                      zonaActiva === z.id
                        ? 'bg-primary text-on-primary'
                        : 'text-on-surface-variant hover:text-on-surface'
                    }`}
                  >
                    {z.nombre}
                  </button>
                ))}
              </div>
              <select
                value={mesaSeleccionada}
                onChange={(e) => setMesaSeleccionada(e.target.value ? Number(e.target.value) : '')}
                className="bg-surface-container-low border border-surface-container-high text-on-surface text-xs font-bold rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-primary focus:outline-none"
              >
                <option value="">-- Seleccionar Mesa --</option>
                {mesasFiltradas.map((m) => (
                  <option key={m.id} value={m.id}>
                    Mesa {m.numeroMesa} ({m.zonaNombre}) • Cap. {m.capacidad}
                  </option>
                ))}
              </select>
            </div>
          )}

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
                const enCarrito = itemsComanda.find((i) => i.plato.id === plato.id);
                return (
                  <div
                    key={plato.id}
                    className="bg-surface-container-lowest border border-surface-container-high rounded-xl p-3.5 flex flex-col justify-between shadow-xs hover:border-primary/50 hover:shadow-md transition-all text-left relative overflow-hidden group"
                  >
                    {/* Indicador de cantidad en carrito si ya fue agregado */}
                    {enCarrito && (
                      <span className="absolute top-2 right-2 bg-primary text-on-primary text-[10px] font-extrabold w-5 h-5 rounded-full flex items-center justify-center shadow-xs">
                        {enCarrito.cantidad}
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
                {canales.find((c) => c.id === canalSeleccionado)?.nombre} •{' '}
                {mesaSeleccionada ? `Mesa 0${mesaSeleccionada}` : 'Sin mesa'}
              </p>
            </div>

            {itemsComanda.length > 0 && (
              <button
                type="button"
                onClick={handleLimpiarComanda}
                className="text-[11px] font-bold text-error hover:underline flex items-center gap-0.5"
                title="Limpiar todo el pedido"
              >
                <span className="material-symbols-outlined text-[14px]">delete</span>
                Limpiar
              </button>
            )}
          </div>

          {/* Lista de Ítems del Ticket: contenedor flex con scroll interno autónomo */}
          <div className="flex-1 min-h-0 p-3.5 overflow-y-auto flex flex-col gap-2.5">
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
                  key={item.plato.id}
                  className="bg-surface-container-low/70 border border-surface-container-high rounded-xl p-3 flex flex-col gap-2 shadow-2xs"
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

                  {/* Campo de Modificadores por Ítem ("Sin cebolla", "Término medio") */}
                  <input
                    type="text"
                    value={item.modificadores || ''}
                    onChange={(e) => handleModificadorChange(item.plato.id, e.target.value)}
                    placeholder="Nota de cocina (ej. Sin ají, término 3/4)..."
                    className="w-full bg-surface-container-lowest text-[11px] px-2.5 py-1.5 rounded-md border border-surface-container-high placeholder:text-outline/70 focus:outline-none focus:ring-1 focus:ring-primary"
                  />

                  {/* Controles de Cantidad (+ / -) y Quitar */}
                  <div className="flex items-center justify-between pt-1">
                    <button
                      type="button"
                      onClick={() => handleQuitarPlato(item.plato.id)}
                      className="text-on-surface-variant hover:text-error p-1"
                      title="Quitar plato"
                    >
                      <span className="material-symbols-outlined text-[16px]">delete</span>
                    </button>

                    <div className="flex items-center gap-2 bg-surface-container-lowest rounded-lg border border-surface-container-high px-2 py-0.5">
                      <button
                        type="button"
                        onClick={() => handleDecrementarPlato(item.plato.id)}
                        className="w-6 h-6 flex items-center justify-center text-on-surface hover:bg-surface-container rounded"
                      >
                        <span className="material-symbols-outlined text-[14px]">remove</span>
                      </button>
                      <span className="font-mono text-xs font-bold w-4 text-center">
                        {item.cantidad}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleAgregarPlato(item.plato)}
                        className="w-6 h-6 flex items-center justify-center text-on-surface hover:bg-surface-container rounded"
                      >
                        <span className="material-symbols-outlined text-[14px]">add</span>
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Pie de Comanda: Observaciones y Botón Enviar */}
          {/* flex-shrink-0 garantiza que el total y el botón de acción nunca sean colapsados por la lista de ítems */}
          <div className="p-3.5 bg-surface-container-low border-t border-surface-container-high flex flex-col gap-2.5 flex-shrink-0">
            {/* Observaciones Generales */}
            <input
              type="text"
              value={observacionesGenerales}
              onChange={(e) => setObservacionesGenerales(e.target.value)}
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
              disabled={isSubmitting || itemsComanda.length === 0}
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

      <LaRetamaWatermark />
    </div>
  );
};
