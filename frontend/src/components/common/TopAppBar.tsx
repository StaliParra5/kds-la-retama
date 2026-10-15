// Barra Superior de Aplicación (TopAppBar) para La Retama KDS
// Basada en el sistema de diseño Stitch (Culinary Operations Light):
// Muestra estado de terminal, reloj digital en tiempo real, badge del operador y navegación contextual RBAC para Sprint 1.
import React, { useEffect, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export const TopAppBar: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [timeStr, setTimeStr] = useState<string>('');

  // Actualización de reloj en tiempo real para visibilidad inmediata de tiempos de atención
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTimeStr(
        now.toLocaleTimeString('es-PE', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false,
        }),
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const isAdmin = user?.rol === 'ADMIN';

  return (
    <header className="sticky top-0 z-40 bg-surface-container-lowest border-b border-surface-container-high shadow-sm px-4 lg:px-6 h-16 flex items-center justify-between transition-colors">
      {/* Lado Izquierdo: Branding y Estado de Terminal */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center text-on-primary shadow-sm">
            <span className="material-symbols-outlined text-[22px]">restaurant</span>
          </div>
          <div>
            <h1 className="font-headline font-bold text-base leading-tight tracking-tight text-on-surface">
              La Retama <span className="text-primary font-extrabold">KDS</span>
            </h1>
            <p className="text-[11px] font-medium text-on-surface-variant leading-none">
              Gestión Gastronómica • Sprint 1
            </p>
          </div>
        </div>

        {/* Indicador de Conexión LAN */}
        <div className="hidden sm:flex items-center gap-1.5 bg-surface-container-low px-2.5 py-1 rounded-full border border-surface-container-high">
          <span className="w-2 h-2 rounded-full bg-secondary animate-pulse" />
          <span className="text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant">
            LAN KDS-01 • En línea
          </span>
        </div>
      </div>

      {/* Centro: Pestañas de Navegación Contextual (Filtradas por Rol HU002) */}
      <nav className="flex items-center gap-1.5 overflow-x-auto py-1">
        {/* Comandero (HU006 & HU007) */}
        <NavLink
          to="/comandero"
          className={({ isActive }) =>
            `flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold tracking-wide transition-all ${
              isActive
                ? 'bg-primary text-on-primary shadow-sm'
                : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low'
            }`
          }
        >
          <span className="material-symbols-outlined text-[18px]">receipt_long</span>
          <span>Comandero</span>
        </NavLink>

        {/* Módulos Administrativos (HU003, HU004, HU005, HU023, HU037) */}
        {isAdmin && (
          <>
            <NavLink
              to="/admin/platos"
              className={({ isActive }) =>
                `flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold tracking-wide transition-all ${
                  isActive
                    ? 'bg-primary text-on-primary shadow-sm'
                    : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low'
                }`
              }
            >
              <span className="material-symbols-outlined text-[18px]">menu_book</span>
              <span>Catálogo Platos</span>
            </NavLink>

            <NavLink
              to="/admin/estaciones"
              className={({ isActive }) =>
                `flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold tracking-wide transition-all ${
                  isActive
                    ? 'bg-primary text-on-primary shadow-sm'
                    : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low'
                }`
              }
            >
              <span className="material-symbols-outlined text-[18px]">skillet</span>
              <span>Estaciones</span>
            </NavLink>

            <NavLink
              to="/admin/mesas"
              className={({ isActive }) =>
                `flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold tracking-wide transition-all ${
                  isActive
                    ? 'bg-primary text-on-primary shadow-sm'
                    : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low'
                }`
              }
            >
              <span className="material-symbols-outlined text-[18px]">table_restaurant</span>
              <span>Mesas & Zonas</span>
            </NavLink>

            <NavLink
              to="/admin/canales"
              className={({ isActive }) =>
                `flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold tracking-wide transition-all ${
                  isActive
                    ? 'bg-primary text-on-primary shadow-sm'
                    : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low'
                }`
              }
            >
              <span className="material-symbols-outlined text-[18px]">timer</span>
              <span>Canales & SLA</span>
            </NavLink>
          </>
        )}
      </nav>

      {/* Lado Derecho: Reloj, Badge de Operador y Salir */}
      <div className="flex items-center gap-3">
        {/* Reloj en Vivo */}
        <div className="hidden md:flex items-center gap-1.5 text-on-surface-variant font-mono text-xs bg-surface-container-low px-2.5 py-1 rounded-md border border-surface-container-high">
          <span className="material-symbols-outlined text-[16px]">schedule</span>
          <span>{timeStr || '--:--:--'}</span>
        </div>

        {/* Badge del Operador Autenticado (HU001 & HU002) */}
        <div className="flex items-center gap-2 bg-surface-container-low px-2.5 py-1 rounded-full border border-surface-container-high">
          <div className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs">
            {user?.nombreCompleto ? user.nombreCompleto.charAt(0).toUpperCase() : 'U'}
          </div>
          <div className="text-left hidden sm:block">
            <p className="text-xs font-semibold text-on-surface leading-none">
              {user?.nombreCompleto || 'Usuario'}
            </p>
            <span className="text-[10px] font-bold text-primary tracking-wide">
              {user?.rol || 'OPERADOR'}
            </span>
          </div>
        </div>

        {/* Botón de Cerrar Sesión */}
        <button
          type="button"
          onClick={handleLogout}
          title="Cerrar Sesión"
          className="p-2 text-on-surface-variant hover:text-error hover:bg-error-container/30 rounded-lg transition-colors"
          aria-label="Cerrar sesión"
        >
          <span className="material-symbols-outlined text-[20px]">logout</span>
        </button>
      </div>
    </header>
  );
};
