// Pantalla de Autenticación Dual (HU001)
// Implementa Pestaña 1: Ingreso Rápido con PIN táctil para Cocina y Sala (Escenario 1)
// e Implementa Pestaña 2: Acceso Administrativo con credenciales completas (Escenario 2).
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CircularProgress from '@mui/material/CircularProgress';
import Container from '@mui/material/Container';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { ArrowRight, Delete, Eye, EyeOff, KeyRound, Lock, User, Utensils } from 'lucide-react';
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LaRetamaWatermark } from '../components/common/LaRetamaWatermark';
import { useAuth } from '../context/AuthContext';

export const LoginPage: React.FC = () => {
  const { loginAdmin, loginPin } = useAuth();
  const navigate = useNavigate();

  const [tabIndex, setTabIndex] = useState<number>(0); // 0: PIN, 1: Admin
  const [username, setUsername] = useState<string>('admin');
  const [password, setPassword] = useState<string>('admin123');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [pin, setPin] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Manejador del teclado numérico en pantalla para terminales táctiles (HU001)
  const handlePinDigit = (digit: string) => {
    if (pin.length < 4) {
      setPin((prev) => prev + digit);
      setErrorMsg(null);
    }
  };

  const handlePinBackspace = () => {
    setPin((prev) => prev.slice(0, -1));
    setErrorMsg(null);
  };

  const handlePinClear = () => {
    setPin('');
    setErrorMsg(null);
  };

  const handleAdminSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setIsSubmitting(true);
    try {
      await loginAdmin(username.trim(), password);
      navigate('/admin/productos');
    } catch (err: any) {
      const msg =
        err.response?.data?.mensaje || 'Credenciales incorrectas. Verifique usuario y contraseña.';
      setErrorMsg(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePinSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (pin.length !== 4) {
      setErrorMsg('El PIN debe tener exactamente 4 dígitos.');
      return;
    }
    setErrorMsg(null);
    setIsSubmitting(true);
    try {
      const sesion = await loginPin(pin);
      // Navegación contextual inteligente según el rol operativo asignado (HU001 & HU002)
      if (sesion.rol === 'MOZO') {
        navigate('/comandero');
      } else if (sesion.rol === 'COCINERO' || sesion.rol === 'EXPEDIDOR') {
        navigate('/admin/estaciones');
      } else {
        navigate('/comandero');
      }
    } catch (err: any) {
      const msg = err.response?.data?.mensaje || 'PIN incorrecto o no autorizado.';
      setErrorMsg(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        backgroundColor: '#f8fafc',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        position: 'relative',
      }}
    >
      {/* Barra Superior Simplificada */}
      <Box
        sx={{
          backgroundColor: '#ffffff',
          borderBottom: '1px solid #e2e8f0',
          px: { xs: 2, sm: 4 },
          py: 1.5,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Box
            sx={{
              width: 36,
              height: 36,
              backgroundColor: '#0f172a',
              color: '#ffffff',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Utensils size={18} />
          </Box>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 800, color: '#0f172a', lineHeight: 1 }}>
              KDS
            </Typography>
            <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600 }}>
              Sistema de Control
            </Typography>
          </Box>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography
            variant="caption"
            sx={{ color: '#64748b', display: { xs: 'none', sm: 'inline' } }}
          >
            Módulo de Autenticación
          </Typography>
          <Box sx={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#10b981' }} />
        </Box>
      </Box>

      {/* Tarjeta Central de Inicio de Sesión */}
      <Container maxWidth="xs" sx={{ py: 6, flex: 1, display: 'flex', alignItems: 'center' }}>
        <Card
          sx={{
            width: '100%',
            borderRadius: '16px',
            border: '1px solid #e2e8f0',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.03)',
            backgroundColor: '#ffffff',
          }}
        >
          <CardContent sx={{ p: { xs: 3, sm: 4 } }}>
            {/* Encabezado de la Tarjeta */}
            <Box sx={{ textAlign: 'center', mb: 3 }}>
              <Box
                sx={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 48,
                  height: 48,
                  backgroundColor: '#fef3c7',
                  color: '#d97706',
                  borderRadius: '12px',
                  mb: 1.5,
                  border: '1px solid #fde68a',
                }}
              >
                <KeyRound size={24} />
              </Box>
              <Typography
                variant="h2"
                sx={{ fontWeight: 700, color: '#0f172a', fontSize: '1.25rem' }}
              >
                Acceso al Sistema
              </Typography>
              <Typography variant="body2" sx={{ color: '#64748b', mt: 0.5 }}>
                Seleccione el modo de ingreso según su puesto
              </Typography>
            </Box>

            {/* Pestañas de Selección de Modo (PIN vs Admin) */}
            <Tabs
              value={tabIndex}
              onChange={(_, val) => {
                setTabIndex(val);
                setErrorMsg(null);
              }}
              variant="fullWidth"
              sx={{
                mb: 3,
                backgroundColor: '#f1f5f9',
                borderRadius: '8px',
                p: 0.5,
                '& .MuiTabs-indicator': { display: 'none' },
                '& .MuiTab-root': {
                  minHeight: 36,
                  borderRadius: '6px',
                  fontWeight: 600,
                  fontSize: '0.8rem',
                  textTransform: 'none',
                  color: '#64748b',
                  '&.Mui-selected': {
                    backgroundColor: '#ffffff',
                    color: '#0f172a',
                    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
                  },
                },
              }}
            >
              <Tab label="PIN de Estación" />
              <Tab label="Administración" />
            </Tabs>

            {/* Mensaje de Error */}
            {errorMsg && (
              <Alert severity="error" sx={{ mb: 2.5, borderRadius: '8px', fontSize: '0.8rem' }}>
                {errorMsg}
              </Alert>
            )}

            {/* MODO 0: PIN Rápido con Teclado Numérico */}
            {tabIndex === 0 && (
              <Box>
                {/* Visualizador de dígitos ingresados */}
                <Box
                  sx={{
                    display: 'flex',
                    justifyContent: 'center',
                    gap: 1.5,
                    mb: 3,
                    py: 1.5,
                    backgroundColor: '#f8fafc',
                    borderRadius: '10px',
                    border: '1px solid #e2e8f0',
                  }}
                >
                  {[0, 1, 2, 3].map((idx) => (
                    <Box
                      key={idx}
                      sx={{
                        width: 14,
                        height: 14,
                        borderRadius: '50%',
                        backgroundColor: pin.length > idx ? '#d97706' : '#cbd5e1',
                        transition: 'all 0.15s ease',
                      }}
                    />
                  ))}
                </Box>

                {/* Teclado Táctil 0-9 */}
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, 1fr)',
                    gap: 1.25,
                    mb: 2.5,
                  }}
                >
                  {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
                    <Button
                      key={digit}
                      variant="outlined"
                      onClick={() => handlePinDigit(digit)}
                      sx={{
                        height: 48,
                        fontSize: '1.15rem',
                        fontWeight: 700,
                        color: '#0f172a',
                        backgroundColor: '#f8fafc',
                        borderColor: '#e2e8f0',
                        '&:hover': {
                          backgroundColor: '#f1f5f9',
                          borderColor: '#cbd5e1',
                        },
                      }}
                    >
                      {digit}
                    </Button>
                  ))}
                  <Button
                    variant="outlined"
                    onClick={handlePinClear}
                    sx={{
                      height: 48,
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      color: '#64748b',
                      borderColor: '#e2e8f0',
                    }}
                  >
                    Borrar
                  </Button>
                  <Button
                    variant="outlined"
                    onClick={() => handlePinDigit('0')}
                    sx={{
                      height: 48,
                      fontSize: '1.15rem',
                      fontWeight: 700,
                      color: '#0f172a',
                      backgroundColor: '#f8fafc',
                      borderColor: '#e2e8f0',
                    }}
                  >
                    0
                  </Button>
                  <Button
                    variant="outlined"
                    onClick={handlePinBackspace}
                    sx={{
                      height: 48,
                      color: '#64748b',
                      borderColor: '#e2e8f0',
                    }}
                  >
                    <Delete size={18} />
                  </Button>
                </Box>

                <Button
                  fullWidth
                  variant="contained"
                  color="primary"
                  onClick={() => handlePinSubmit()}
                  disabled={pin.length !== 4 || isSubmitting}
                  sx={{ py: 1.25, fontWeight: 700 }}
                >
                  {isSubmitting ? (
                    <CircularProgress size={20} color="inherit" />
                  ) : (
                    'Ingresar a Estación'
                  )}
                </Button>

                <Typography
                  variant="caption"
                  sx={{ display: 'block', textAlign: 'center', color: '#94a3b8', mt: 2 }}
                >
                  Demostración: PIN de mozo/cocinero es <strong>1234</strong>
                </Typography>
              </Box>
            )}

            {/* MODO 1: Acceso Administrativo (Usuario / Contraseña) */}
            {tabIndex === 1 && (
              <Box component="form" onSubmit={handleAdminSubmit}>
                <TextField
                  fullWidth
                  label="Usuario"
                  size="small"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  sx={{ mb: 2 }}
                  slotProps={{
                    input: {
                      startAdornment: (
                        <InputAdornment position="start">
                          <User size={16} color="#94a3b8" />
                        </InputAdornment>
                      ),
                    },
                  }}
                />

                <TextField
                  fullWidth
                  label="Contraseña"
                  type={showPassword ? 'text' : 'password'}
                  size="small"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  sx={{ mb: 3 }}
                  slotProps={{
                    input: {
                      startAdornment: (
                        <InputAdornment position="start">
                          <Lock size={16} color="#94a3b8" />
                        </InputAdornment>
                      ),
                      endAdornment: (
                        <InputAdornment position="end">
                          <IconButton size="small" onClick={() => setShowPassword(!showPassword)}>
                            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                          </IconButton>
                        </InputAdornment>
                      ),
                    },
                  }}
                />

                <Button
                  fullWidth
                  type="submit"
                  variant="contained"
                  color="secondary"
                  disabled={isSubmitting}
                  sx={{ py: 1.25, fontWeight: 700, display: 'flex', gap: 1 }}
                >
                  {isSubmitting ? (
                    <CircularProgress size={20} color="inherit" />
                  ) : (
                    <>
                      <span>Ingresar a Administración</span>
                      <ArrowRight size={16} />
                    </>
                  )}
                </Button>

                <Typography
                  variant="caption"
                  sx={{ display: 'block', textAlign: 'center', color: '#94a3b8', mt: 2 }}
                >
                  Demostración: <strong>admin</strong> / <strong>admin123</strong>
                </Typography>
              </Box>
            )}
          </CardContent>
        </Card>
      </Container>

      {/* Pie de Página */}
      <Box sx={{ textAlign: 'center', pb: 3 }}>
        <Typography variant="caption" sx={{ color: '#94a3b8' }}>
          Sistema KDS v1.0 • Acceso autorizado para personal de La Retama
        </Typography>
      </Box>

      {/* Marca de agua institucional */}
      <LaRetamaWatermark />
    </Box>
  );
};
