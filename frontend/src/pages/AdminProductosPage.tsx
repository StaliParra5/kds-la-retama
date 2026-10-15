// Pantalla de Gestión de Catálogo de Platos y Enrutamiento a Estaciones (HU003 & HU023)
// Diseño exacto basado en Stitch (08 - Catálogo y Rutas de Menú / Culinary Operations Light):
// - Telemetría de catálogo (Total Platos, Tiempo Promedio de Cocina, Estaciones activas)
// - Filtros rápidos por Estación de Cocina (HU004) y Categoría
// - Tabla de gestión con elevación Level 1, badges de color de estación y tiempo estándar SLA
// - Slide-over / Modal para crear y editar platos validando tiempoEstándar > 0 y estación obligatoria

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import React, { useMemo, useState } from 'react';
import { apiClient } from '../api/client';
import { LaRetamaWatermark } from '../components/common/LaRetamaWatermark';
import { TopAppBar } from '../components/common/TopAppBar';
import { useToast } from '../context/ToastContext';
import type { CategoriaPlato, Estacion, Plato } from '../types';

export const AdminProductosPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  // Estados de filtros y búsqueda
  const [filtroEstacion, setFiltroEstacion] = useState<number | null>(null);
  const [filtroCategoria, setFiltroCategoria] = useState<number | null>(null);
  const [busqueda, setBusqueda] = useState<string>('');

  // Estados de modal de creación / edición
  const [modalOpen, setModalOpen] = useState<boolean>(false);
  const [platoEditando, setPlatoEditando] = useState<Plato | null>(null);
  const [nombre, setNombre] = useState<string>('');
  const [descripcion, setDescripcion] = useState<string>('');
  const [categoriaId, setCategoriaId] = useState<number | ''>('');
  const [estacionId, setEstacionId] = useState<number | ''>('');
  const [precio, setPrecio] = useState<string>('28.00');
  const [tiempoEstandar, setTiempoEstandar] = useState<string>('12');
  const [errorForm, setErrorForm] = useState<string | null>(null);

  // Queries de datos
  const { data: platos = [], isLoading } = useQuery<Plato[]>({
    queryKey: ['admin-platos'],
    queryFn: async () => (await apiClient.get('/platos')).data,
  });

  const { data: categorias = [] } = useQuery<CategoriaPlato[]>({
    queryKey: ['categorias'],
    queryFn: async () => (await apiClient.get('/categorias')).data,
  });

  const { data: estaciones = [] } = useQuery<Estacion[]>({
    queryKey: ['estaciones'],
    queryFn: async () => (await apiClient.get('/estaciones')).data,
  });

  // Mutación para guardar plato (POST / PUT)
  const guardarMutation = useMutation({
    mutationFn: async (payload: any) => {
      if (platoEditando) {
        return (await apiClient.put(`/platos/${platoEditando.id}`, payload)).data;
      }
      return (await apiClient.post('/platos', payload)).data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-platos'] });
      queryClient.invalidateQueries({ queryKey: ['platos'] });
      showToast(
        platoEditando ? 'Plato actualizado exitosamente' : 'Nuevo plato registrado en el catálogo',
        'success',
      );
      handleCerrarModal();
    },
    onError: (err: any) => {
      setErrorForm(err.response?.data?.mensaje || 'Error al guardar el plato.');
    },
  });

  // Mutación para toggle disponibilidad (Activo / Agotado)
  const toggleDisponibilidadMutation = useMutation({
    mutationFn: async ({ id, disponible }: { id: number; disponible: boolean }) => {
      return (await apiClient.patch(`/platos/${id}/disponibilidad`, { disponible })).data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-platos'] });
      queryClient.invalidateQueries({ queryKey: ['platos'] });
      showToast('Estado de disponibilidad actualizado', 'info');
    },
    onError: () => {
      showToast('No se pudo actualizar la disponibilidad', 'error');
    },
  });

  // Métricas calculadas para cabecera Stitch
  const totalPlatos = platos.length;
  const tiempoPromedioCocina = useMemo(() => {
    if (platos.length === 0) return 0;
    const suma = platos.reduce((acc, p) => acc + p.tiempoEstandarMinutos, 0);
    return Math.round(suma / platos.length);
  }, [platos]);

  // Filtrado reactivo de platos por estación, categoría y búsqueda instantánea (HU003 & HU007)
  const platosFiltrados = useMemo(() => {
    return platos.filter((plato) => {
      const matchEstacion = filtroEstacion ? plato.estacionId === filtroEstacion : true;
      const matchCategoria = filtroCategoria ? plato.categoriaId === filtroCategoria : true;
      const matchBusqueda = busqueda.trim()
        ? plato.nombre.toLowerCase().includes(busqueda.toLowerCase().trim()) ||
          plato.id.toString().includes(busqueda.trim())
        : true;
      return matchEstacion && matchCategoria && matchBusqueda;
    });
  }, [platos, filtroEstacion, filtroCategoria, busqueda]);

  const handleAbrirNuevo = () => {
    setPlatoEditando(null);
    setNombre('');
    setDescripcion('');
    setCategoriaId(categorias[0]?.id || '');
    setEstacionId(estaciones[0]?.id || '');
    setPrecio('28.00');
    setTiempoEstandar('12');
    setErrorForm(null);
    setModalOpen(true);
  };

  const handleAbrirEditar = (plato: Plato) => {
    setPlatoEditando(plato);
    setNombre(plato.nombre);
    setDescripcion(plato.descripcion || '');
    setCategoriaId(plato.categoriaId);
    setEstacionId(plato.estacionId);
    setPrecio(String(plato.precio));
    setTiempoEstandar(String(plato.tiempoEstandarMinutos));
    setErrorForm(null);
    setModalOpen(true);
  };

  const handleCerrarModal = () => {
    setModalOpen(false);
    setPlatoEditando(null);
    setErrorForm(null);
  };

  const handleGuardarSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre.trim()) {
      setErrorForm('El nombre del plato es obligatorio.');
      return;
    }
    const precioNum = Number.parseFloat(precio);
    if (Number.isNaN(precioNum) || precioNum <= 0) {
      setErrorForm('El precio debe ser un número estrictamente mayor a 0.');
      return;
    }
    const tiempoNum = Number.parseInt(tiempoEstandar, 10);
    if (Number.isNaN(tiempoNum) || tiempoNum <= 0) {
      setErrorForm('El tiempo estándar debe ser mayor a 0 minutos (HU023).');
      return;
    }
    if (!estacionId) {
      setErrorForm('Debe asignar una estación de cocina obligatoria (HU003).');
      return;
    }
    if (!categoriaId) {
      setErrorForm('Debe seleccionar una categoría.');
      return;
    }

    guardarMutation.mutate({
      nombre: nombre.trim(),
      descripcion: descripcion.trim() || undefined,
      categoriaId: Number(categoriaId),
      estacionId: Number(estacionId),
      precio: precioNum,
      tiempoEstandarMinutos: tiempoNum,
      disponible: platoEditando ? platoEditando.disponible : true,
    });
  };

  return (
    <div className="min-h-screen flex flex-col bg-background font-sans text-on-surface">
      <TopAppBar />

      <main className="flex-1 max-w-7xl w-full mx-auto p-4 lg:p-6 flex flex-col gap-6">
        {/* Cabecera y Resumen de Telemetría (Design System Stitch) */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="font-headline font-bold text-2xl text-on-surface tracking-tight">
              Catálogo de Platos y Rutas de Menú
            </h1>
            <p className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider mt-1">
              Configuración de Platos, Estaciones de Cocina y Tiempos Estándar SLA (HU003 & HU023)
            </p>
          </div>

          <button
            type="button"
            onClick={handleAbrirNuevo}
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-primary hover:bg-primary-container text-on-primary rounded-xl font-bold text-xs shadow-sm transition-all active:scale-95 self-start md:self-auto cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">add</span>
            <span>NUEVO PLATO</span>
          </button>
        </div>

        {/* Tarjetas de Métricas de Catálogo */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-surface-container-lowest border border-surface-container-high rounded-xl p-4 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                Total de Platos
              </span>
              <span className="material-symbols-outlined text-primary text-[20px]">menu_book</span>
            </div>
            <p className="font-headline text-2xl font-extrabold text-on-surface mt-2">
              {totalPlatos}
            </p>
            <span className="text-[11px] text-secondary font-semibold">
              Disponibles en comanderas de sala
            </span>
          </div>

          <div className="bg-surface-container-lowest border border-surface-container-high rounded-xl p-4 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                Tiempo SLA Promedio
              </span>
              <span className="material-symbols-outlined text-tertiary text-[20px]">schedule</span>
            </div>
            <p className="font-headline text-2xl font-extrabold text-on-surface mt-2">
              {tiempoPromedioCocina} min
            </p>
            <span className="text-[11px] text-on-surface-variant font-medium">
              Objetivo de preparación estándar
            </span>
          </div>

          <div className="bg-surface-container-lowest border border-surface-container-high rounded-xl p-4 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                Estaciones Activas
              </span>
              <span className="material-symbols-outlined text-secondary text-[20px]">skillet</span>
            </div>
            <p className="font-headline text-2xl font-extrabold text-on-surface mt-2">
              {estaciones.length}
            </p>
            <span className="text-[11px] text-on-surface-variant font-medium">
              Rutas operativas en cocina
            </span>
          </div>
        </div>

        {/* Barra de Filtros: Por Estación y Categoría */}
        <div className="bg-surface-container-lowest border border-surface-container-high rounded-xl p-4 shadow-xs flex flex-col gap-3">
          {/* Fila 1: Filtro por Estaciones de Cocina */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            <span className="text-xs font-bold text-on-surface-variant uppercase mr-1 whitespace-nowrap">
              Estación:
            </span>
            <button
              type="button"
              onClick={() => setFiltroEstacion(null)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                filtroEstacion === null
                  ? 'bg-primary text-on-primary shadow-xs'
                  : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high'
              }`}
            >
              Todas
            </button>
            {estaciones.map((est) => {
              const activo = est.id === filtroEstacion;
              return (
                <button
                  key={est.id}
                  type="button"
                  onClick={() => setFiltroEstacion(est.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    activo
                      ? 'bg-primary text-on-primary shadow-xs'
                      : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high'
                  }`}
                >
                  {est.nombre}
                </button>
              );
            })}
          </div>

          {/* Fila 2: Filtro por Categorías y Buscador */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pt-2 border-t border-surface-container-high">
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
              <span className="text-xs font-bold text-on-surface-variant uppercase mr-1 whitespace-nowrap">
                Categoría:
              </span>
              <button
                type="button"
                onClick={() => setFiltroCategoria(null)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  filtroCategoria === null
                    ? 'bg-primary text-on-primary shadow-xs'
                    : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high'
                }`}
              >
                Todas
              </button>
              {categorias.map((cat) => {
                const activo = cat.id === filtroCategoria;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setFiltroCategoria(cat.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      activo
                        ? 'bg-primary text-on-primary shadow-xs'
                        : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high'
                    }`}
                  >
                    {cat.nombre}
                  </button>
                );
              })}
            </div>

            {/* Buscador Rápido */}
            <div className="relative min-w-[260px]">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[18px] text-on-surface-variant pointer-events-none">
                search
              </span>
              <input
                type="text"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Buscar por nombre o código..."
                className="w-full bg-surface-container-low text-on-surface text-xs font-medium pl-9 pr-3 py-2 rounded-lg border border-surface-container-high placeholder:text-outline focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>
        </div>

        {/* Tabla de Gestión de Menú (Elevation Level 1) */}
        <div className="bg-surface-container-lowest border border-surface-container-high rounded-xl shadow-xs overflow-hidden">
          {isLoading ? (
            <div className="p-12 text-center text-on-surface-variant">
              <span className="inline-block w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mb-2" />
              <p className="text-xs font-bold">Cargando catálogo...</p>
            </div>
          ) : platosFiltrados.length === 0 ? (
            <div className="p-12 text-center text-on-surface-variant">
              <span className="material-symbols-outlined text-[40px] text-outline mb-2">
                search_off
              </span>
              <p className="text-xs font-bold text-on-surface">No se encontraron platos</p>
              <p className="text-[11px] mt-1">Modifique los filtros o registre un nuevo plato.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-surface-container-low text-on-surface-variant font-bold uppercase tracking-wider text-[11px] border-b border-surface-container-high">
                  <tr>
                    <th className="py-3 px-4">Código</th>
                    <th className="py-3 px-4">Plato</th>
                    <th className="py-3 px-4">Categoría</th>
                    <th className="py-3 px-4">Estación Cocina</th>
                    <th className="py-3 px-4 text-center">Tiempo SLA</th>
                    <th className="py-3 px-4 text-right">Precio</th>
                    <th className="py-3 px-4 text-center">Disponibilidad</th>
                    <th className="py-3 px-4 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-container-high">
                  {platosFiltrados.map((plato) => (
                    <tr
                      key={plato.id}
                      className="hover:bg-surface-container-low/50 transition-colors"
                    >
                      <td className="py-3.5 px-4 font-mono font-bold text-on-surface-variant">
                        {`PLT-${String(plato.id).padStart(3, '0')}`}
                      </td>
                      <td className="py-3.5 px-4">
                        <p className="font-bold text-on-surface">{plato.nombre}</p>
                        {plato.descripcion && (
                          <p className="text-[11px] text-on-surface-variant line-clamp-1">
                            {plato.descripcion}
                          </p>
                        )}
                      </td>
                      <td className="py-3.5 px-4 font-medium text-on-surface-variant">
                        {plato.categoriaNombre}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold bg-primary/10 text-primary border border-primary/20">
                          <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                          {plato.estacionNombre}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center font-mono font-bold text-on-surface">
                        {plato.tiempoEstandarMinutos} min
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-extrabold text-on-surface">
                        S/ {plato.precio.toFixed(2)}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <button
                          type="button"
                          onClick={() =>
                            toggleDisponibilidadMutation.mutate({
                              id: plato.id,
                              disponible: !plato.disponible,
                            })
                          }
                          className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer ${
                            plato.disponible
                              ? 'bg-secondary/15 text-secondary border border-secondary/30 hover:bg-secondary/25'
                              : 'bg-error/15 text-error border border-error/30 hover:bg-error/25'
                          }`}
                        >
                          {plato.disponible ? 'Disponible' : 'Agotado'}
                        </button>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => handleAbrirEditar(plato)}
                          className="p-1.5 text-on-surface-variant hover:text-primary hover:bg-surface-container rounded-lg transition-colors cursor-pointer"
                          title="Editar plato"
                        >
                          <span className="material-symbols-outlined text-[18px]">edit</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {/* Modal / Slide-over para Nuevo / Editar Plato (HU003 & HU023) */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-on-surface/40 backdrop-blur-xs">
          <div className="bg-surface-container-lowest w-full max-w-lg rounded-2xl shadow-2xl border border-surface-container-high overflow-hidden animate-in fade-in zoom-in-95">
            <div className="bg-surface-container-low px-6 py-4 border-b border-surface-container-high flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[22px]">
                  restaurant
                </span>
                <h3 className="font-headline font-bold text-base text-on-surface">
                  {platoEditando ? 'Editar Plato del Menú' : 'Nuevo Plato en la Carta'}
                </h3>
              </div>
              <button
                type="button"
                onClick={handleCerrarModal}
                className="text-on-surface-variant hover:text-on-surface p-1"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <form onSubmit={handleGuardarSubmit} className="p-6 flex flex-col gap-4 text-left">
              {errorForm && (
                <div className="p-3 bg-error-container text-on-error-container text-xs rounded-lg border border-error/20 font-medium">
                  {errorForm}
                </div>
              )}

              {/* Nombre */}
              <div>
                <label
                  htmlFor="plato-nombre"
                  className="block text-xs font-bold text-on-surface uppercase mb-1"
                >
                  Nombre del Plato *
                </label>
                <input
                  id="plato-nombre"
                  type="text"
                  required
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  placeholder="Ej. Seco de Asado con Frejoles"
                  className="w-full bg-surface-container-low text-xs font-medium px-3 py-2.5 rounded-lg border border-surface-container-high focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              {/* Categoría y Estación (Obligatoria HU003) */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="plato-categoria"
                    className="block text-xs font-bold text-on-surface uppercase mb-1"
                  >
                    Categoría *
                  </label>
                  <select
                    id="plato-categoria"
                    required
                    value={categoriaId}
                    onChange={(e) => setCategoriaId(Number(e.target.value))}
                    className="w-full bg-surface-container-low text-xs font-medium px-3 py-2.5 rounded-lg border border-surface-container-high focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="">-- Seleccionar --</option>
                    {categorias.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nombre}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="plato-estacion"
                    className="block text-xs font-bold text-on-surface uppercase mb-1"
                  >
                    Estación Cocina * (HU003)
                  </label>
                  <select
                    id="plato-estacion"
                    required
                    value={estacionId}
                    onChange={(e) => setEstacionId(Number(e.target.value))}
                    className="w-full bg-surface-container-low text-xs font-medium px-3 py-2.5 rounded-lg border border-surface-container-high focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="">-- Seleccionar --</option>
                    {estaciones.map((est) => (
                      <option key={est.id} value={est.id}>
                        {est.nombre}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Precio y Tiempo Estándar SLA (HU023) */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="plato-precio"
                    className="block text-xs font-bold text-on-surface uppercase mb-1"
                  >
                    Precio (S/) *
                  </label>
                  <input
                    id="plato-precio"
                    type="number"
                    step="0.5"
                    min="1"
                    required
                    value={precio}
                    onChange={(e) => setPrecio(e.target.value)}
                    placeholder="28.00"
                    className="w-full bg-surface-container-low text-xs font-mono font-bold px-3 py-2.5 rounded-lg border border-surface-container-high focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>

                <div>
                  <label
                    htmlFor="plato-tiempo-sla"
                    className="block text-xs font-bold text-on-surface uppercase mb-1"
                  >
                    Tiempo SLA Minutos * (HU023)
                  </label>
                  <input
                    id="plato-tiempo-sla"
                    type="number"
                    min="1"
                    required
                    value={tiempoEstandar}
                    onChange={(e) => setTiempoEstandar(e.target.value)}
                    placeholder="12"
                    className="w-full bg-surface-container-low text-xs font-mono font-bold px-3 py-2.5 rounded-lg border border-surface-container-high focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>

              {/* Descripción */}
              <div>
                <label
                  htmlFor="plato-descripcion"
                  className="block text-xs font-bold text-on-surface uppercase mb-1"
                >
                  Descripción / Receta / Alérgenos
                </label>
                <textarea
                  id="plato-descripcion"
                  rows={2}
                  value={descripcion}
                  onChange={(e) => setDescripcion(e.target.value)}
                  placeholder="Guarnición de arroz criollo y sarsa de cebolla fresca..."
                  className="w-full bg-surface-container-low text-xs px-3 py-2 rounded-lg border border-surface-container-high focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              {/* Botones de Acción */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-surface-container-high">
                <button
                  type="button"
                  onClick={handleCerrarModal}
                  className="px-4 py-2 text-xs font-bold text-on-surface-variant hover:text-on-surface rounded-lg"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={guardarMutation.isPending}
                  className="px-5 py-2.5 bg-primary hover:bg-primary-container text-on-primary text-xs font-bold rounded-lg shadow-sm transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
                >
                  {guardarMutation.isPending ? 'Guardando...' : 'GUARDAR PLATO'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <LaRetamaWatermark />
    </div>
  );
};
