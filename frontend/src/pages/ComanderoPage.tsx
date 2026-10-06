// Pantalla del Comandero de Sala (HU006 & HU007)
// Permite al mozo abrir comandas por tipo, seleccionar mesas, buscar platos en < 3s,
// agregar modificadores y persistir la orden con acuse de recibo del servidor.
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import FormControl from '@mui/material/FormControl';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import Snackbar from '@mui/material/Snackbar';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useQuery } from '@tanstack/react-query';
import {
  CheckCircle2,
  Clock,
  Minus,
  Plus,
  Search,
  ShoppingBag,
  Trash2,
  Utensils,
} from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { apiClient } from '../api/client';
import { KdsHeader } from '../components/common/KdsHeader';
import { LaRetamaWatermark } from '../components/common/LaRetamaWatermark';
import type { CanalVenta, CategoriaPlato, ItemComanda, Mesa, Plato } from '../types';

export const ComanderoPage: React.FC = () => {
  // Estado de cabecera operativa
  const [canalSeleccionado, setCanalSeleccionado] = useState<number>(1); // 1 = Salón
  const [mesaSeleccionada, setMesaSeleccionada] = useState<number | ''>(8); // Mesa 08 por defecto
  const [categoriaActiva, setCategoriaActiva] = useState<number | null>(null); // null = Todos
  const [busqueda, setBusqueda] = useState<string>('');
  const [observacionesGenerales, setObservacionesGenerales] = useState<string>('');

  // Carrito de items en armado
  const [itemsComanda, setItemsComanda] = useState<ItemComanda[]>([]);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [snackbarMsg, setSnackbarMsg] = useState<string | null>(null);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  // Queries para datos maestros desde la API REST
  const { data: canales = [] } = useQuery<CanalVenta[]>({
    queryKey: ['canales'],
    queryFn: async () => (await apiClient.get('/canales')).data,
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

  // Búsqueda y filtrado reactivo de platos en memoria del cliente (< 100 ms)
  const platosFiltrados = useMemo(() => {
    return platos.filter((plato) => {
      const coincideCat = categoriaActiva ? plato.categoriaId === categoriaActiva : true;
      const coincideBusqueda = busqueda.trim()
        ? plato.nombre.toLowerCase().includes(busqueda.toLowerCase().trim())
        : true;
      return coincideCat && coincideBusqueda && plato.disponible;
    });
  }, [platos, categoriaActiva, busqueda]);

  // Funciones de gestión del carrito
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
    setErrorBanner(null);
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
    setErrorBanner(null);
  };

  // Cálculo de total
  const totalComanda = useMemo(() => {
    return itemsComanda.reduce((acc, item) => acc + item.plato.precio * item.cantidad, 0);
  }, [itemsComanda]);

  // Enviar / Abrir comanda al servidor (HU006)
  const handleEnviarComanda = async () => {
    const canalObj = canales.find((c) => c.id === canalSeleccionado);
    if (canalObj?.codigo === 'SALON' && !mesaSeleccionada) {
      setErrorBanner('Debe seleccionar obligatoriamente una mesa para pedidos de Salón.');
      return;
    }

    if (itemsComanda.length === 0) {
      setErrorBanner('Agregue al menos un plato a la comanda antes de enviarla.');
      return;
    }

    setIsSubmitting(true);
    setErrorBanner(null);

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

      setSnackbarMsg(
        `¡Comanda ${comandaCreada.codigoCorrelativo} abierta exitosamente con acuse de recibo!`,
      );
      handleLimpiarComanda();
    } catch (err: any) {
      const msg = err.response?.data?.mensaje || 'Error al enviar la comanda al servidor KDS.';
      setErrorBanner(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: '#f8fafc',
      }}
    >
      <KdsHeader sectionTitle="Comandero de Sala" />

      {/* Contenedor Principal: 2 Columnas (Catálogo y Resumen de Pedido) */}
      <Box sx={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Columna Izquierda: Controles, Filtros y Grilla de Platos */}
        <Box sx={{ flex: 1, p: 3, overflowY: 'auto' }}>
          {/* Fila Superior: Selección de Canal y Mesa */}
          <Box
            sx={{
              backgroundColor: '#ffffff',
              p: 2,
              borderRadius: '12px',
              border: '1px solid #e2e8f0',
              mb: 3,
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 2,
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
              <Box sx={{ minWidth: 160 }}>
                <Typography
                  variant="caption"
                  sx={{ fontWeight: 700, color: '#64748b', display: 'block', mb: 0.5 }}
                >
                  CANAL DE ORIGEN
                </Typography>
                <FormControl size="small" fullWidth>
                  <Select
                    value={canalSeleccionado}
                    onChange={(e) => setCanalSeleccionado(Number(e.target.value))}
                    sx={{ backgroundColor: '#f8fafc', fontWeight: 600 }}
                  >
                    {canales.map((c) => (
                      <MenuItem key={c.id} value={c.id}>
                        {c.nombre} (SLA: {c.slaObjetivoMinutos}m)
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Box>

              {/* Selector de Mesa (visible y obligatorio en Salón) */}
              <Box sx={{ minWidth: 160 }}>
                <Typography
                  variant="caption"
                  sx={{ fontWeight: 700, color: '#64748b', display: 'block', mb: 0.5 }}
                >
                  MESA DE SALÓN
                </Typography>
                <FormControl size="small" fullWidth>
                  <Select
                    value={mesaSeleccionada}
                    onChange={(e) => setMesaSeleccionada(Number(e.target.value))}
                    displayEmpty
                    sx={{ backgroundColor: '#f8fafc', fontWeight: 600 }}
                  >
                    <MenuItem value="">-- Sin Mesa --</MenuItem>
                    {mesas.map((m) => (
                      <MenuItem key={m.id} value={m.id}>
                        Mesa {m.numeroMesa} ({m.zonaNombre})
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Box>
            </Box>

            {/* Búsqueda Rápida de Platos (< 3 segundos) */}
            <Box sx={{ minWidth: { xs: '100%', sm: 260 } }}>
              <Typography
                variant="caption"
                sx={{ fontWeight: 700, color: '#64748b', display: 'block', mb: 0.5 }}
              >
                BUSCAR PLATO (RESPUESTA &lt; 3s)
              </Typography>
              <TextField
                size="small"
                fullWidth
                placeholder="Ej. lomo, ceviche..."
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                slotProps={{
                  input: {
                    startAdornment: (
                      <InputAdornment position="start">
                        <Search size={16} color="#94a3b8" />
                      </InputAdornment>
                    ),
                  },
                }}
              />
            </Box>
          </Box>

          {/* Filtros de Categoría tipo Pastilla */}
          <Box sx={{ display: 'flex', gap: 1, mb: 3, overflowX: 'auto', pb: 0.5 }}>
            <Button
              size="small"
              variant={categoriaActiva === null ? 'contained' : 'outlined'}
              color={categoriaActiva === null ? 'primary' : 'inherit'}
              onClick={() => setCategoriaActiva(null)}
              sx={{ borderRadius: '20px', px: 2, fontWeight: 700, borderColor: '#e2e8f0' }}
            >
              Todos
            </Button>
            {categorias.map((cat) => (
              <Button
                key={cat.id}
                size="small"
                variant={categoriaActiva === cat.id ? 'contained' : 'outlined'}
                color={categoriaActiva === cat.id ? 'primary' : 'inherit'}
                onClick={() => setCategoriaActiva(cat.id)}
                sx={{ borderRadius: '20px', px: 2, fontWeight: 700, borderColor: '#e2e8f0' }}
              >
                {cat.nombre}
              </Button>
            ))}
          </Box>

          {/* Grilla de Platos de la Carta */}
          {cargandoPlatos ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
              <CircularProgress color="primary" />
            </Box>
          ) : platosFiltrados.length === 0 ? (
            <Box
              sx={{
                textAlign: 'center',
                py: 8,
                backgroundColor: '#ffffff',
                borderRadius: '12px',
                border: '1px dashed #cbd5e1',
              }}
            >
              <Utensils size={40} color="#94a3b8" style={{ margin: '0 auto 12px' }} />
              <Typography variant="body1" sx={{ fontWeight: 600, color: '#64748b' }}>
                No se encontraron platos coincidentes
              </Typography>
            </Box>
          ) : (
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: {
                  xs: '1fr',
                  sm: 'repeat(2, 1fr)',
                  md: 'repeat(3, 1fr)',
                  lg: 'repeat(4, 1fr)',
                },
                gap: 2,
              }}
            >
              {platosFiltrados.map((plato) => (
                <Card
                  key={plato.id}
                  sx={{
                    borderRadius: '12px',
                    border: '1px solid #e2e8f0',
                    transition: 'all 0.15s ease',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    '&:hover': {
                      borderColor: '#d97706',
                      boxShadow: '0 4px 12px rgba(217, 119, 6, 0.08)',
                    },
                  }}
                >
                  <CardContent sx={{ p: 2 }}>
                    <Box
                      sx={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        mb: 1,
                      }}
                    >
                      <Chip
                        label={plato.estacionNombre}
                        size="small"
                        sx={{
                          height: 20,
                          fontSize: '0.65rem',
                          fontWeight: 700,
                          backgroundColor: '#fef3c7',
                          color: '#d97706',
                        }}
                      />
                      <Box
                        sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: '#64748b' }}
                      >
                        <Clock size={12} />
                        <Typography variant="caption" sx={{ fontWeight: 600 }}>
                          {plato.tiempoEstandarMinutos}m
                        </Typography>
                      </Box>
                    </Box>

                    <Typography
                      variant="subtitle1"
                      sx={{ fontWeight: 700, color: '#0f172a', mb: 0.5, lineHeight: 1.2 }}
                    >
                      {plato.nombre}
                    </Typography>

                    {plato.descripcion && (
                      <Typography
                        variant="caption"
                        sx={{
                          color: '#64748b',
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                          lineHeight: 1.25,
                        }}
                      >
                        {plato.descripcion}
                      </Typography>
                    )}
                  </CardContent>

                  <Box
                    sx={{
                      p: 2,
                      pt: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <Typography variant="h6" sx={{ fontWeight: 800, color: '#0f172a' }}>
                      S/ {Number(plato.precio).toFixed(2)}
                    </Typography>
                    <IconButton
                      size="small"
                      color="primary"
                      onClick={() => handleAgregarPlato(plato)}
                      sx={{
                        backgroundColor: '#fef3c7',
                        color: '#d97706',
                        '&:hover': { backgroundColor: '#d97706', color: '#ffffff' },
                      }}
                    >
                      <Plus size={18} />
                    </IconButton>
                  </Box>
                </Card>
              ))}
            </Box>
          )}
        </Box>

        {/* Columna Derecha: Panel de Resumen de la Comanda */}
        <Box
          sx={{
            width: 380,
            backgroundColor: '#ffffff',
            borderLeft: '1px solid #e2e8f0',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
        >
          {/* Cabecera del Resumen */}
          <Box sx={{ p: 2.5, borderBottom: '1px solid #e2e8f0' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <ShoppingBag size={20} color="#d97706" />
                <Typography variant="h3" sx={{ fontWeight: 700, fontSize: '1.1rem' }}>
                  Resumen del Pedido
                </Typography>
              </Box>
              <Chip
                label={`${itemsComanda.reduce((acc, i) => acc + i.cantidad, 0)} ítems`}
                size="small"
                sx={{ fontWeight: 700, backgroundColor: '#f1f5f9' }}
              />
            </Box>
          </Box>

          {/* Mensaje de Error en Panel */}
          {errorBanner && (
            <Alert severity="error" sx={{ m: 2, borderRadius: '8px', fontSize: '0.75rem' }}>
              {errorBanner}
            </Alert>
          )}

          {/* Lista de Platos en la Comanda */}
          <Box sx={{ flex: 1, p: 2, overflowY: 'auto' }}>
            {itemsComanda.length === 0 ? (
              <Box sx={{ textAlign: 'center', py: 6, color: '#94a3b8' }}>
                <Typography variant="body2" sx={{ fontWeight: 500 }}>
                  La comanda está vacía.
                </Typography>
                <Typography variant="caption">
                  Haga clic en los platos del menú para agregarlos.
                </Typography>
              </Box>
            ) : (
              itemsComanda.map((item) => (
                <Box
                  key={item.plato.id}
                  sx={{
                    mb: 1.5,
                    p: 1.5,
                    backgroundColor: '#f8fafc',
                    borderRadius: '8px',
                    border: '1px solid #e2e8f0',
                  }}
                >
                  <Box
                    sx={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                    }}
                  >
                    <Box>
                      <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#0f172a' }}>
                        {item.plato.nombre}
                      </Typography>
                      <Typography variant="caption" sx={{ color: '#64748b' }}>
                        S/ {Number(item.plato.precio).toFixed(2)} c/u
                      </Typography>
                    </Box>
                    <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#0f172a' }}>
                      S/ {(item.plato.precio * item.cantidad).toFixed(2)}
                    </Typography>
                  </Box>

                  {/* Controles de Cantidad (+ / -) y Modificador */}
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      mt: 1,
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <IconButton
                        size="small"
                        onClick={() => handleDecrementarPlato(item.plato.id)}
                        sx={{
                          width: 26,
                          height: 26,
                          backgroundColor: '#ffffff',
                          border: '1px solid #cbd5e1',
                        }}
                      >
                        <Minus size={14} />
                      </IconButton>
                      <Typography
                        variant="body2"
                        sx={{ fontWeight: 700, minWidth: 20, textAlign: 'center' }}
                      >
                        {item.cantidad}
                      </Typography>
                      <IconButton
                        size="small"
                        onClick={() => handleAgregarPlato(item.plato)}
                        sx={{
                          width: 26,
                          height: 26,
                          backgroundColor: '#ffffff',
                          border: '1px solid #cbd5e1',
                        }}
                      >
                        <Plus size={14} />
                      </IconButton>
                    </Box>

                    <IconButton
                      size="small"
                      onClick={() => handleQuitarPlato(item.plato.id)}
                      sx={{ color: '#94a3b8', '&:hover': { color: '#e11d48' } }}
                    >
                      <Trash2 size={16} />
                    </IconButton>
                  </Box>

                  {/* Campo de Modificadores / Observaciones del Plato */}
                  <TextField
                    size="small"
                    placeholder="Observación (ej: sin cebolla)"
                    value={item.modificadores || ''}
                    onChange={(e) => handleModificadorChange(item.plato.id, e.target.value)}
                    fullWidth
                    sx={{
                      mt: 1,
                      '& .MuiOutlinedInput-input': { fontSize: '0.75rem', py: 0.5 },
                    }}
                  />
                </Box>
              ))
            )}
          </Box>

          {/* Pie del Resumen: Total y Botón de Envío */}
          <Box sx={{ p: 2.5, borderTop: '1px solid #e2e8f0', backgroundColor: '#ffffff' }}>
            <TextField
              size="small"
              fullWidth
              multiline
              rows={2}
              placeholder="Notas generales de la comanda..."
              value={observacionesGenerales}
              onChange={(e) => setObservacionesGenerales(e.target.value)}
              sx={{ mb: 2, '& .MuiOutlinedInput-input': { fontSize: '0.8rem' } }}
            />

            <Box
              sx={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'baseline',
                mb: 2,
              }}
            >
              <Typography variant="body1" sx={{ fontWeight: 600, color: '#64748b' }}>
                TOTAL ESTIMADO:
              </Typography>
              <Typography variant="h4" sx={{ fontWeight: 800, color: '#0f172a' }}>
                S/ {totalComanda.toFixed(2)}
              </Typography>
            </Box>

            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button
                variant="outlined"
                color="inherit"
                fullWidth
                onClick={handleLimpiarComanda}
                disabled={itemsComanda.length === 0 || isSubmitting}
                sx={{ borderColor: '#e2e8f0', fontWeight: 600 }}
              >
                Cancelar
              </Button>
              <Button
                variant="contained"
                color="primary"
                fullWidth
                onClick={handleEnviarComanda}
                disabled={itemsComanda.length === 0 || isSubmitting}
                sx={{ fontWeight: 700, py: 1.25 }}
              >
                {isSubmitting ? <CircularProgress size={20} color="inherit" /> : 'Abrir Comanda'}
              </Button>
            </Box>
          </Box>
        </Box>
      </Box>

      {/* Notificación Toast de Éxito */}
      <Snackbar
        open={Boolean(snackbarMsg)}
        autoHideDuration={4000}
        onClose={() => setSnackbarMsg(null)}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert severity="success" sx={{ width: '100%', borderRadius: '8px', fontWeight: 600 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <CheckCircle2 size={18} />
            <span>{snackbarMsg}</span>
          </Box>
        </Alert>
      </Snackbar>

      <LaRetamaWatermark />
    </Box>
  );
};
