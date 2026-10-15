// Enrutador Principal de la Aplicación La Retama KDS (Sprint 1)
// Conecta las vistas protegidas por control de accesos RBAC (HU001 & HU002)
// con el sistema de notificaciones táctiles ToastProvider y diseño Tailwind CSS.

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { AdminCanalesPage } from './pages/AdminCanalesPage';
import { AdminEstacionesPage } from './pages/AdminEstacionesPage';
import { AdminMesasPage } from './pages/AdminMesasPage';
import { AdminProductosPage } from './pages/AdminProductosPage';
import { ComanderoPage } from './pages/ComanderoPage';
import { LoginPage } from './pages/LoginPage';
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
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <span className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
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
      <AuthProvider>
        <ToastProvider>
          <BrowserRouter>
            <Routes>
              {/* HU001: Autenticación por PIN y Credenciales */}
              <Route path="/login" element={<LoginPage />} />

              {/* HU006 & HU007: Comandero de Sala */}
              <Route
                path="/comandero"
                element={
                  <ProtectedRoute>
                    <ComanderoPage />
                  </ProtectedRoute>
                }
              />

              {/* HU003 & HU023: Catálogo de Platos y Tiempos Estándar */}
              <Route
                path="/admin/platos"
                element={
                  <ProtectedRoute requiredRole="ADMIN">
                    <AdminProductosPage />
                  </ProtectedRoute>
                }
              />

              {/* HU004: Configuración de Estaciones de Cocina */}
              <Route
                path="/admin/estaciones"
                element={
                  <ProtectedRoute requiredRole="ADMIN">
                    <AdminEstacionesPage />
                  </ProtectedRoute>
                }
              />

              {/* HU005: Gestión de Zonas y Mesas */}
              <Route
                path="/admin/mesas"
                element={
                  <ProtectedRoute requiredRole="ADMIN">
                    <AdminMesasPage />
                  </ProtectedRoute>
                }
              />

              {/* HU037: Configuración de Canales y SLA */}
              <Route
                path="/admin/canales"
                element={
                  <ProtectedRoute requiredRole="ADMIN">
                    <AdminCanalesPage />
                  </ProtectedRoute>
                }
              />

              {/* Redirección por defecto */}
              <Route path="*" element={<Navigate to="/comandero" replace />} />
            </Routes>
          </BrowserRouter>
        </ToastProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
