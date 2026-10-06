// Enrutador Principal de la Aplicación KDS con Rutas Protegidas por Rol (HU001 & HU002)
import CssBaseline from '@mui/material/CssBaseline';
import { ThemeProvider } from '@mui/material/styles';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AdminEstacionesPage } from './pages/AdminEstacionesPage';
import { AdminProductosPage } from './pages/AdminProductosPage';
import { ComanderoPage } from './pages/ComanderoPage';
import { LoginPage } from './pages/LoginPage';
import { kdsTheme } from './theme/kdsTheme';
import type { RolCodigo } from './types';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

interface ProtectedRouteProps {
  children: React.ReactElement;
  requiredRole?: RolCodigo;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, requiredRole }) => {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return null;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // HU002: Control de acceso RBAC estricto
  if (requiredRole && user.rol !== requiredRole && user.rol !== 'ADMIN') {
    return <Navigate to="/comandero" replace />;
  }

  return children;
};

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={kdsTheme}>
        <CssBaseline />
        <AuthProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/login" element={<LoginPage />} />

              <Route
                path="/comandero"
                element={
                  <ProtectedRoute>
                    <ComanderoPage />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/admin/productos"
                element={
                  <ProtectedRoute requiredRole="ADMIN">
                    <AdminProductosPage />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/admin/estaciones"
                element={
                  <ProtectedRoute requiredRole="ADMIN">
                    <AdminEstacionesPage />
                  </ProtectedRoute>
                }
              />

              {/* Redirección por defecto */}
              <Route path="*" element={<Navigate to="/comandero" replace />} />
            </Routes>
          </BrowserRouter>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
