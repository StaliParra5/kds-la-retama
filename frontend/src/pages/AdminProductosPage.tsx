// Pantalla de Administración de Catálogo de Platos (HU003 & HU023)
// Permite al Administrador dar de alta, editar y gestionar el tiempo estándar por plato.
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Container from '@mui/material/Container';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import Snackbar from '@mui/material/Snackbar';
import Switch from '@mui/material/Switch';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Edit2, Plus } from 'lucide-react';
import React, { useState } from 'react';
import { apiClient } from '../api/client';
import { KdsHeader } from '../components/common/KdsHeader';
import { LaRetamaWatermark } from '../components/common/LaRetamaWatermark';
import type { CategoriaPlato, Estacion, Plato } from '../types';

export const AdminProductosPage: React.FC = () => {
  const queryClient = useQueryClient();

  // Estados de modal y formulario
  const [modalOpen, setModalOpen] = useState<boolean>(false);
  const [platoEditando, setPlatoEditando] = useState<Plato | null>(null);
  const [nombre, setNombre] = useState<string>('');
  const [descripcion, setDescripcion] = useState<string>('');
  const [categoriaId, setCategoriaId] = useState<number | ''>('');
  const [estacionId, setEstacionId] = useState<number | ''>('');
  const [precio, setPrecio] = useState<string>('25.00');
  const [tiempoEstandar, setTiempoEstandar] = useState<string>('10');
  const [errorForm, setErrorForm] = useState<string | null>(null);
  const [snackbarMsg, setSnackbarMsg] = useState<string | null>(null);

  // Queries
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

  // Mutación para guardar o actualizar plato
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
      setSnackbarMsg(
        platoEditando ? 'Plato actualizado exitosamente' : 'Plato creado exitosamente',
      );
      handleCerrarModal();
    },
    onError: (err: any) => {
      setErrorForm(err.response?.data?.mensaje || 'Error al guardar el plato.');
    },
  });

  // Mutación para toggle disponibilidad
  const toggleDisponibilidadMutation = useMutation({
    mutationFn: async ({ id, disponible }: { id: number; disponible: boolean }) => {
      return (await apiClient.patch(`/platos/${id}/disponibilidad`, { disponible })).data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-platos'] });
      queryClient.invalidateQueries({ queryKey: ['platos'] });
    },
  });

  const handleAbrirNuevo = () => {
    setPlatoEditando(null);
    setNombre('');
    setDescripcion('');
    setCategoriaId(categorias[0]?.id || '');
    setEstacionId(estaciones[0]?.id || '');
    setPrecio('25.00');
    setTiempoEstandar('10');
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre.trim() || !categoriaId || !estacionId) {
      setErrorForm('Todos los campos marcados son obligatorios, incluyendo la estación.');
      return;
    }

    const t = Number(tiempoEstandar);
    if (Number.isNaN(t) || t <= 0) {
      setErrorForm('El tiempo estándar debe ser un número entero mayor a 0 minutos (HU023).');
      return;
    }

    const p = Number(precio);
    if (Number.isNaN(p) || p < 0) {
      setErrorForm('El precio debe ser un número válido mayor o igual a 0.');
      return;
    }

    guardarMutation.mutate({
      nombre: nombre.trim(),
      descripcion: descripcion.trim() || undefined,
      categoriaId: Number(categoriaId),
      estacionId: Number(estacionId),
      precio: p,
      tiempoEstandarMinutos: t,
    });
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
      <KdsHeader sectionTitle="Administración / Productos" />

      <Container maxWidth="lg" sx={{ py: 4, flex: 1 }}>
        {/* Encabezado y Acción */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Box>
            <Typography variant="h2" sx={{ fontWeight: 800, color: '#0f172a' }}>
              Catálogo de Platos
            </Typography>
            <Typography variant="body2" sx={{ color: '#64748b', mt: 0.5 }}>
              Administre precios, estaciones de enrutamiento y tiempos estándar de preparación
              (HU003 & HU023).
            </Typography>
          </Box>

          <Button
            variant="contained"
            color="primary"
            startIcon={<Plus size={18} />}
            onClick={handleAbrirNuevo}
            sx={{ fontWeight: 700 }}
          >
            Nuevo Producto
          </Button>
        </Box>

        {/* Tabla de Productos */}
        <Card sx={{ borderRadius: '12px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
          <TableContainer>
            <Table>
              <TableHead sx={{ backgroundColor: '#f1f5f9' }}>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700, color: '#475569', fontSize: '0.75rem' }}>
                    PRODUCTO
                  </TableCell>
                  <TableCell sx={{ fontWeight: 700, color: '#475569', fontSize: '0.75rem' }}>
                    CATEGORÍA
                  </TableCell>
                  <TableCell sx={{ fontWeight: 700, color: '#475569', fontSize: '0.75rem' }}>
                    ESTACIÓN ASIGNADA
                  </TableCell>
                  <TableCell sx={{ fontWeight: 700, color: '#475569', fontSize: '0.75rem' }}>
                    PRECIO
                  </TableCell>
                  <TableCell sx={{ fontWeight: 700, color: '#475569', fontSize: '0.75rem' }}>
                    TIEMPO ESTÁNDAR
                  </TableCell>
                  <TableCell sx={{ fontWeight: 700, color: '#475569', fontSize: '0.75rem' }}>
                    DISPONIBILIDAD
                  </TableCell>
                  <TableCell
                    align="right"
                    sx={{ fontWeight: 700, color: '#475569', fontSize: '0.75rem' }}
                  >
                    ACCIONES
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={7} align="center" sx={{ py: 6 }}>
                      <CircularProgress size={30} />
                    </TableCell>
                  </TableRow>
                ) : platos.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} align="center" sx={{ py: 6, color: '#94a3b8' }}>
                      No hay productos registrados en el catálogo.
                    </TableCell>
                  </TableRow>
                ) : (
                  platos.map((p) => (
                    <TableRow
                      key={p.id}
                      hover
                      sx={{ '&:last-child td, &:last-child th': { border: 0 } }}
                    >
                      <TableCell>
                        <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#0f172a' }}>
                          {p.nombre}
                        </Typography>
                        {p.descripcion && (
                          <Typography variant="caption" sx={{ color: '#64748b' }}>
                            {p.descripcion}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={p.categoriaNombre}
                          size="small"
                          sx={{ fontWeight: 600, backgroundColor: '#f1f5f9' }}
                        />
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={p.estacionNombre}
                          size="small"
                          sx={{
                            fontWeight: 700,
                            backgroundColor: '#fef3c7',
                            color: '#d97706',
                          }}
                        />
                      </TableCell>
                      <TableCell sx={{ fontWeight: 700, color: '#0f172a' }}>
                        S/ {Number(p.precio).toFixed(2)}
                      </TableCell>
                      <TableCell sx={{ fontWeight: 600, color: '#334155' }}>
                        {p.tiempoEstandarMinutos} min
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={p.disponible}
                          onChange={(e) =>
                            toggleDisponibilidadMutation.mutate({
                              id: p.id,
                              disponible: e.target.checked,
                            })
                          }
                          color="primary"
                          size="small"
                        />
                      </TableCell>
                      <TableCell align="right">
                        <Button
                          size="small"
                          startIcon={<Edit2 size={14} />}
                          onClick={() => handleAbrirEditar(p)}
                          sx={{ color: '#475569', fontWeight: 600 }}
                        >
                          Editar
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Card>
      </Container>

      {/* Modal / Diálogo para Crear o Editar Plato */}
      <Dialog open={modalOpen} onClose={handleCerrarModal} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700, borderBottom: '1px solid #e2e8f0', pb: 2 }}>
          {platoEditando ? 'Editar Plato del Catálogo' : 'Nuevo Plato en Carta'}
        </DialogTitle>
        <Box component="form" onSubmit={handleSubmit}>
          <DialogContent sx={{ pt: 3 }}>
            {errorForm && (
              <Alert severity="error" sx={{ mb: 2.5, borderRadius: '8px' }}>
                {errorForm}
              </Alert>
            )}

            <TextField
              fullWidth
              label="Nombre del Plato *"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              required
              sx={{ mb: 2 }}
            />

            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, mb: 2 }}>
              <FormControl fullWidth required>
                <InputLabel>Categoría</InputLabel>
                <Select
                  value={categoriaId}
                  label="Categoría"
                  onChange={(e) => setCategoriaId(Number(e.target.value))}
                >
                  {categorias.map((c) => (
                    <MenuItem key={c.id} value={c.id}>
                      {c.nombre}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <FormControl fullWidth required>
                <InputLabel>Estación de Cocina *</InputLabel>
                <Select
                  value={estacionId}
                  label="Estación de Cocina *"
                  onChange={(e) => setEstacionId(Number(e.target.value))}
                >
                  {estaciones.map((e) => (
                    <MenuItem key={e.id} value={e.id}>
                      {e.nombre}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>

            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, mb: 2 }}>
              <TextField
                fullWidth
                label="Precio (S/) *"
                type="number"
                value={precio}
                onChange={(e) => setPrecio(e.target.value)}
                required
              />

              <TextField
                fullWidth
                label="Tiempo Estándar (min) *"
                type="number"
                value={tiempoEstandar}
                onChange={(e) => setTiempoEstandar(e.target.value)}
                helperText="Mínimo 1 minuto para secuenciación"
                required
              />
            </Box>

            <TextField
              fullWidth
              multiline
              rows={2}
              label="Descripción de la preparación"
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
            />
          </DialogContent>

          <DialogActions sx={{ p: 2.5, borderTop: '1px solid #e2e8f0' }}>
            <Button onClick={handleCerrarModal} color="inherit" sx={{ fontWeight: 600 }}>
              Cancelar
            </Button>
            <Button
              type="submit"
              variant="contained"
              color="primary"
              disabled={guardarMutation.isPending}
              sx={{ fontWeight: 700 }}
            >
              {guardarMutation.isPending ? (
                <CircularProgress size={18} color="inherit" />
              ) : (
                'Guardar Plato'
              )}
            </Button>
          </DialogActions>
        </Box>
      </Dialog>

      {/* Snackbar */}
      <Snackbar
        open={Boolean(snackbarMsg)}
        autoHideDuration={3000}
        onClose={() => setSnackbarMsg(null)}
        message={snackbarMsg}
      />

      <LaRetamaWatermark />
    </Box>
  );
};
