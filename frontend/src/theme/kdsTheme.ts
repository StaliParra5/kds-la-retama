// Tema visual personalizado de Material UI para el Sistema KDS (La Retama Restaurante).
// Diseñado para reflejar con 100% de fidelidad la estética de los prototipos HTML entregados:
// - Paleta Slate-50 / Slate-900 con acentos gastronómicos Amber-600.
// - Botones táctiles optimizados para pantallas kiosco de cocina y salón.
// - Bordes suaves y elevaciones mínimas estilo flat profesional.

import { createTheme } from '@mui/material/styles';

export const kdsTheme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#d97706', // Amber 600
      dark: '#b45309', // Amber 700
      light: '#fef3c7', // Amber 100
      contrastText: '#ffffff',
    },
    secondary: {
      main: '#0f172a', // Slate 900
      dark: '#020617',
      light: '#334155',
      contrastText: '#ffffff',
    },
    background: {
      default: '#f8fafc', // Slate 50
      paper: '#ffffff',
    },
    text: {
      primary: '#0f172a',
      secondary: '#64748b',
    },
    success: {
      main: '#059669', // Emerald 600
      light: '#ecfdf5',
    },
    error: {
      main: '#e11d48', // Rose 600
      light: '#fff1f2',
    },
    warning: {
      main: '#f59e0b', // Amber 500
      light: '#fffbeb',
    },
    divider: '#e2e8f0', // Slate 200
  },
  typography: {
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    h1: { fontWeight: 700, fontSize: '1.75rem', letterSpacing: '-0.025em' },
    h2: { fontWeight: 700, fontSize: '1.35rem', letterSpacing: '-0.02em' },
    h3: { fontWeight: 600, fontSize: '1.15rem' },
    h4: { fontWeight: 600, fontSize: '1rem' },
    body1: { fontSize: '0.875rem' },
    body2: { fontSize: '0.75rem', color: '#64748b' },
    button: { textTransform: 'none', fontWeight: 600, fontSize: '0.8125rem' },
  },
  shape: {
    borderRadius: 8,
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          boxShadow: 'none',
          padding: '8px 16px',
          minHeight: 40,
          '&:hover': {
            boxShadow: '0 2px 4px 0 rgba(0, 0, 0, 0.05)',
          },
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          border: '1px solid #e2e8f0',
          boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.03)',
          borderRadius: 12,
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          border: '1px solid #e2e8f0',
          boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.03)',
          borderRadius: 12,
        },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          backgroundColor: '#f8fafc',
          borderRadius: 8,
          '& .MuiOutlinedInput-notchedOutline': {
            borderColor: '#e2e8f0',
          },
          '&:hover .MuiOutlinedInput-notchedOutline': {
            borderColor: '#cbd5e1',
          },
          '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
            borderColor: '#d97706',
          },
        },
      },
    },
  },
});
