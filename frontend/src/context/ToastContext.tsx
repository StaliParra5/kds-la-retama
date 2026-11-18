// Contexto Global de Notificaciones Toast Táctiles para La Retama KDS
// Proporciona alertas visuales inmediatas y no intrusivas sin modales bloqueantes,
// garantizando fluidez operativa en terminales de salón y cocina.
import React, { createContext, useCallback, useContext, useState } from 'react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastMessage {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextType {
  showToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const showToast = useCallback((message: string, type: ToastType = 'info') => {
    const id = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    setToasts((prev) => [...prev, { id, message, type }]);

    // Cierre automático tras 3.5 segundos para no congestionar la pantalla
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3500);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {/* Contenedor Flotante de Toasts en esquina superior derecha */}
      <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-sm pointer-events-none">
        {toasts.map((t) => {
          let bgClass = 'bg-surface-container-lowest text-on-surface border-outline-variant';
          let icon = 'info';
          let iconColor = 'text-primary';

          if (t.type === 'success') {
            bgClass = 'bg-surface-container-lowest text-on-surface border-secondary';
            icon = 'check_circle';
            iconColor = 'text-secondary';
          } else if (t.type === 'error') {
            bgClass = 'bg-surface-container-lowest text-on-surface border-error';
            icon = 'error';
            iconColor = 'text-error';
          } else if (t.type === 'warning') {
            bgClass = 'bg-surface-container-lowest text-on-surface border-tertiary';
            icon = 'warning';
            iconColor = 'text-tertiary';
          }

          return (
            <div
              key={t.id}
              className={`pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg border transition-all duration-300 animate-in fade-in slide-in-from-top-2 ${bgClass}`}
            >
              <span className={`material-symbols-outlined text-[20px] ${iconColor}`}>{icon}</span>
              <p className="text-sm font-medium flex-1">{t.message}</p>
              <button
                type="button"
                onClick={() => removeToast(t.id)}
                className="text-on-surface-variant hover:text-on-surface p-1 rounded transition-colors"
                aria-label="Cerrar notificación"
              >
                <span className="material-symbols-outlined text-[16px]">close</span>
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = (): ToastContextType => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast debe ser utilizado dentro de un ToastProvider');
  }
  return context;
};
