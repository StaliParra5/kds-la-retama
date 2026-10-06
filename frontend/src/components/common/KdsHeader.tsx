// Barra de navegación superior unificada (KdsHeader)
// Replica el diseño de los prototipos 02_comandero y 08_admin con soporte responsivo y roles
import AppBar from '@mui/material/AppBar';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import { ChefHat, LogOut, Utensils } from 'lucide-react';
import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

interface KdsHeaderProps {
  sectionTitle?: string;
}

export const KdsHeader: React.FC<KdsHeaderProps> = ({ sectionTitle = 'Comandero' }) => {
  const { user, logout } = useAuth();
  const location = useLocation();

  const isAdmin = user?.rol === 'ADMIN';

  return (
    <AppBar
      position="sticky"
      color="inherit"
      elevation={0}
      sx={{
        backgroundColor: '#ffffff',
        borderBottom: '1px solid #e2e8f0',
        zIndex: 50,
      }}
    >
      <Toolbar
        sx={{
          minHeight: '64px !important',
          px: { xs: 2, sm: 3 },
          display: 'flex',
          justifyContent: 'space-between',
        }}
      >
        {/* Izquierda: Marca KDS y Sección Activa */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
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
              <Typography
                variant="h6"
                sx={{
                  fontWeight: 800,
                  color: '#0f172a',
                  lineHeight: 1,
                  letterSpacing: '-0.02em',
                }}
              >
                KDS
              </Typography>
              <Typography
                variant="caption"
                sx={{
                  color: '#64748b',
                  fontSize: '0.65rem',
                  fontWeight: 600,
                  letterSpacing: '0.05em',
                  textTransform: 'uppercase',
                }}
              >
                Kitchen Display System
              </Typography>
            </Box>
          </Box>

          <Box sx={{ height: 24, width: '1px', backgroundColor: '#e2e8f0', mx: 1 }} />

          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              backgroundColor: '#f8fafc',
              px: 1.5,
              py: 0.5,
              borderRadius: '6px',
              border: '1px solid #e2e8f0',
            }}
          >
            <ChefHat size={14} color="#d97706" />
            <Typography variant="body2" sx={{ fontWeight: 700, color: '#0f172a' }}>
              {sectionTitle}
            </Typography>
          </Box>
        </Box>

        {/* Centro/Navegación: Enlaces según rol */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Button
            component={Link}
            to="/comandero"
            size="small"
            variant={location.pathname === '/comandero' ? 'contained' : 'text'}
            color={location.pathname === '/comandero' ? 'primary' : 'inherit'}
            sx={{ fontWeight: 600 }}
          >
            Comandero
          </Button>

          {isAdmin && (
            <>
              <Button
                component={Link}
                to="/admin/productos"
                size="small"
                variant={location.pathname.startsWith('/admin/productos') ? 'contained' : 'text'}
                color={location.pathname.startsWith('/admin/productos') ? 'primary' : 'inherit'}
                sx={{ fontWeight: 600 }}
              >
                Productos
              </Button>
              <Button
                component={Link}
                to="/admin/estaciones"
                size="small"
                variant={location.pathname.startsWith('/admin/estaciones') ? 'contained' : 'text'}
                color={location.pathname.startsWith('/admin/estaciones') ? 'primary' : 'inherit'}
                sx={{ fontWeight: 600 }}
              >
                Estaciones
              </Button>
            </>
          )}
        </Box>

        {/* Derecha: Estado de Conexión en LAN, Perfil de Usuario y Logout */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Box sx={{ display: { xs: 'none', md: 'flex' }, alignItems: 'center', gap: 1 }}>
            <Box
              sx={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                backgroundColor: '#10b981',
              }}
            />
            <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 500 }}>
              LAN Conectada
            </Typography>
          </Box>

          {user && (
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1.5,
                backgroundColor: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '9999px',
                py: 0.5,
                px: 1.5,
              }}
            >
              <Box
                sx={{
                  width: 24,
                  height: 24,
                  borderRadius: '50%',
                  backgroundColor: '#d97706',
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                }}
              >
                {user.nombreCompleto ? user.nombreCompleto.charAt(0) : 'U'}
              </Box>
              <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                <Typography variant="body2" sx={{ fontWeight: 700, lineHeight: 1 }}>
                  {user.nombreCompleto || user.username}
                </Typography>
              </Box>
              <Chip
                label={user.rol}
                size="small"
                sx={{
                  height: 20,
                  fontSize: '0.65rem',
                  fontWeight: 700,
                  backgroundColor: '#e2e8f0',
                  color: '#334155',
                }}
              />
            </Box>
          )}

          <IconButton
            onClick={logout}
            size="small"
            title="Cerrar sesión"
            sx={{
              color: '#64748b',
              '&:hover': { color: '#e11d48', backgroundColor: '#fff1f2' },
            }}
          >
            <LogOut size={18} />
          </IconButton>
        </Box>
      </Toolbar>
    </AppBar>
  );
};
