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
import { CocinaPage } from './pages/CocinaPage';
import { ComanderoPage } from './pages/ComanderoPage';
import { LoginPage } from './pages/LoginPage';
import { PasePage } from './pages/PasePage';
import type { RolCodigo } from './types';
import { rutaInicio } from './utils/rutas';

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
  // Roles operativos admitidos además del ADMIN (p. ej. la cocina admite COCINERO)
  roles?: RolCodigo[];
  // Pantallas que ni el ADMIN abre (HU039: el comandero es solo del mozo)
  exclusiva?: boolean;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requiredRole,
  roles,
  exclusiva = false,
}) => {
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

  // HU002: Control de acceso RBAC estricto; sin permiso, cada rol vuelve a su pantalla de inicio
  const permitidos = roles ?? (requiredRole ? [requiredRole] : null);
  const adminPasa = user.rol === 'ADMIN' && !exclusiva;
  if (permitidos && !adminPasa && !permitidos.includes(user.rol)) {
    return <Navigate to={rutaInicio(user.rol)} replace />;
  }

  return children;
};

const InicioPorRol: React.FC = () => {
  const { user, isLoading } = useAuth();
  if (isLoading) {
    return null;
  }
  return <Navigate to={user ? rutaInicio(user.rol) : '/login'} replace />;
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

              {/* HU006 & HU007: Comandero de Sala, exclusivo del mozo (HU039) */}
              <Route
                path="/comandero"
                element={
                  <ProtectedRoute roles={['MOZO']} exclusiva>
                    <ComanderoPage />
                  </ProtectedRoute>
                }
              />

              {/* HU012 & HU014: Pantalla de la estación de cocina */}
              <Route
                path="/cocina"
                element={
                  <ProtectedRoute roles={['COCINERO']}>
                    <CocinaPage />
                  </ProtectedRoute>
                }
              />

              {/* D9: Pase, despacho de los ítems listos */}
              <Route
                path="/pase"
                element={
                  <ProtectedRoute roles={['EXPEDIDOR']}>
                    <PasePage />
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

              {/* Redirección por defecto a la pantalla de inicio del rol */}
              <Route path="*" element={<InicioPorRol />} />
            </Routes>
          </BrowserRouter>
        </ToastProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
