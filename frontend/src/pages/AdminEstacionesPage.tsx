// Pantalla de Administración de Estaciones de Cocina y SLAs (HU004 & RF-CFG-04)
// Implementa vinculación persistente de la PC a una estación y parametrización de tiempos SLA.
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Container from '@mui/material/Container';
import Snackbar from '@mui/material/Snackbar';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Flame, Monitor, Save } from 'lucide-react';
import React, { useState } from 'react';
import { apiClient } from '../api/client';
import { KdsHeader } from '../components/common/KdsHeader';
import { LaRetamaWatermark } from '../components/common/LaRetamaWatermark';
import { useAuth } from '../context/AuthContext';
import type { CanalVenta, Estacion } from '../types';

export const AdminEstacionesPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { estacionId, vincularEstacionTerminal } = useAuth();

  const [snackbarMsg, setSnackbarMsg] = useState<string | null>(null);
  const [slasEditados, setSlasEditados] = useState<Record<number, number>>({});

  // Queries
  const { data: estaciones = [], isLoading: cargandoEstaciones } = useQuery<Estacion[]>({
    queryKey: ['estaciones'],
    queryFn: async () => (await apiClient.get('/estaciones')).data,
  });

  const { data: canales = [], isLoading: cargandoCanales } = useQuery<CanalVenta[]>({
    queryKey: ['canales'],
    queryFn: async () => (await apiClient.get('/canales')).data,
  });

  // Mutación para actualizar SLA de canal
  const actualizarSlaMutation = useMutation({
    mutationFn: async ({ canalId, sla }: { canalId: number; sla: number }) => {
      return (await apiClient.put(`/canales/${canalId}/sla`, { slaObjetivoMinutos: sla })).data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['canales'] });
      setSnackbarMsg('Tiempo SLA de canal actualizado exitosamente.');
    },
  });

  const handleVincularEstacion = (est: Estacion) => {
    vincularEstacionTerminal(est.id, est.nombre);
    setSnackbarMsg(`Terminal vinculado exitosamente a la estación: ${est.nombre} (HU004)`);
  };

  const handleSlaChange = (canalId: number, val: number) => {
    setSlasEditados((prev) => ({ ...prev, [canalId]: val }));
  };

  const handleGuardarSla = (canal: CanalVenta) => {
    const nuevoSla = slasEditados[canal.id] ?? canal.slaObjetivoMinutos;
    if (nuevoSla <= 0) {
      alert('El SLA debe ser mayor a 0 minutos');
      return;
    }
    actualizarSlaMutation.mutate({ canalId: canal.id, sla: nuevoSla });
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
      <KdsHeader sectionTitle="Administración / Estaciones y SLAs" />

      <Container maxWidth="lg" sx={{ py: 4, flex: 1 }}>
        {/* SECCIÓN 1: Estaciones de Cocina */}
        <Box sx={{ mb: 5 }}>
          <Box sx={{ mb: 3 }}>
            <Typography variant="h2" sx={{ fontWeight: 800, color: '#0f172a' }}>
              Estaciones Operativas de Cocina (HU004)
            </Typography>
            <Typography variant="body2" sx={{ color: '#64748b', mt: 0.5 }}>
              Vincule esta terminal PC a una estación específica para que el cocinero reciba solo
              sus platos asignados.
            </Typography>
          </Box>

          {cargandoEstaciones ? (
            <CircularProgress />
          ) : (
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' },
                gap: 2.5,
              }}
            >
              {estaciones.map((est) => {
                const esEstaTerminal = estacionId === est.id;

                return (
                  <Card
                    key={est.id}
                    sx={{
                      borderRadius: '12px',
                      border: esEstaTerminal ? '2px solid #d97706' : '1px solid #e2e8f0',
                      backgroundColor: '#ffffff',
                      position: 'relative',
                      overflow: 'visible',
                      boxShadow: esEstaTerminal
                        ? '0 4px 14px rgba(217, 119, 6, 0.12)'
                        : '0 1px 3px rgba(0, 0, 0, 0.04)',
                    }}
                  >
                    <CardContent sx={{ p: 3 }}>
                      <Box
                        sx={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          mb: 2,
                        }}
                      >
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                          <Box
                            sx={{
                              width: 36,
                              height: 36,
                              borderRadius: '8px',
                              backgroundColor: '#fef3c7',
                              color: '#d97706',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            <Flame size={20} />
                          </Box>
                          <Typography variant="h3" sx={{ fontWeight: 800, fontSize: '1.15rem' }}>
                            {est.nombre}
                          </Typography>
                        </Box>
                        <Chip
                          label={est.activo ? 'Activa' : 'Inactiva'}
                          size="small"
                          sx={{
                            backgroundColor: est.activo ? '#ecfdf5' : '#f1f5f9',
                            color: est.activo ? '#059669' : '#64748b',
                            fontWeight: 700,
                          }}
                        />
                      </Box>

                      <Typography variant="body2" sx={{ color: '#64748b', mb: 2.5 }}>
                        {est.descripcion || 'Sin descripción'}
                      </Typography>

                      <Box
                        sx={{
                          p: 1.5,
                          backgroundColor: '#f8fafc',
                          borderRadius: '8px',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          mb: 2.5,
                        }}
                      >
                        <Typography variant="caption" sx={{ fontWeight: 600, color: '#64748b' }}>
                          Platos vinculados:
                        </Typography>
                        <Typography variant="body2" sx={{ fontWeight: 800, color: '#0f172a' }}>
                          {est.cantidadPlatos ?? 0} platos
                        </Typography>
                      </Box>

                      <Button
                        fullWidth
                        variant={esEstaTerminal ? 'contained' : 'outlined'}
                        color={esEstaTerminal ? 'primary' : 'inherit'}
                        onClick={() => handleVincularEstacion(est)}
                        startIcon={esEstaTerminal ? <Check size={16} /> : <Monitor size={16} />}
                        sx={{ fontWeight: 700 }}
                      >
                        {esEstaTerminal ? 'Esta PC está Vinculada' : 'Vincular a esta PC'}
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </Box>
          )}
        </Box>

        {/* SECCIÓN 2: Canales de Venta y SLAs (RF-CFG-04) */}
        <Box>
          <Box sx={{ mb: 3 }}>
            <Typography variant="h2" sx={{ fontWeight: 800, color: '#0f172a' }}>
              Canales de Venta y Tiempos SLA (RF-CFG-04)
            </Typography>
            <Typography variant="body2" sx={{ color: '#64748b', mt: 0.5 }}>
              Defina el tiempo máximo objetivo por canal para cálculo de los semáforos de
              advertencia.
            </Typography>
          </Box>

          {cargandoCanales ? (
            <CircularProgress />
          ) : (
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' },
                gap: 2.5,
              }}
            >
              {canales.map((canal) => {
                const valorActual = slasEditados[canal.id] ?? canal.slaObjetivoMinutos;

                return (
                  <Card
                    key={canal.id}
                    sx={{ borderRadius: '12px', border: '1px solid #e2e8f0', p: 2.5 }}
                  >
                    <Box
                      sx={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        mb: 2,
                      }}
                    >
                      <Typography variant="h4" sx={{ fontWeight: 800, color: '#0f172a' }}>
                        {canal.nombre}
                      </Typography>
                      <Chip
                        label={canal.codigo}
                        size="small"
                        sx={{ fontWeight: 700, backgroundColor: '#f1f5f9' }}
                      />
                    </Box>

                    <Typography variant="body2" sx={{ color: '#64748b', mb: 2 }}>
                      Tiempo SLA estándar para preparación y despacho:
                    </Typography>

                    <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
                      <TextField
                        size="small"
                        type="number"
                        label="Minutos objetivo"
                        value={valorActual}
                        onChange={(e) => handleSlaChange(canal.id, Number(e.target.value))}
                        sx={{ flex: 1 }}
                      />
                      <Button
                        variant="contained"
                        color="secondary"
                        onClick={() => handleGuardarSla(canal)}
                        startIcon={<Save size={16} />}
                        sx={{ fontWeight: 700 }}
                      >
                        Guardar
                      </Button>
                    </Box>
                  </Card>
                );
              })}
            </Box>
          )}
        </Box>
      </Container>

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
