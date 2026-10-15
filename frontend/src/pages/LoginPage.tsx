// Pantalla de Autenticación Dual para La Retama KDS (HU001 & HU002)
// Diseño exacto basado en Stitch (01 - Acceso y Login KDS / Culinary Operations Light):
// - Pestaña 1: Ingreso Rápido con PIN de 4 dígitos para personal operativo (Sala/Cocina) con teclado táctil numérico de 12 teclas grandes.
// - Pestaña 2: Acceso Administrativo con credenciales completas para configurar catálogo, estaciones y parámetros.
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LaRetamaWatermark } from '../components/common/LaRetamaWatermark';
import { useAuth } from '../context/AuthContext';

export const LoginPage: React.FC = () => {
  const { loginAdmin, loginPin } = useAuth();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<'pin' | 'admin'>('pin');
  const [pin, setPin] = useState<string>('');
  const [username, setUsername] = useState<string>('admin');
  const [password, setPassword] = useState<string>('admin123');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<string>('');

  // Reloj digital en vivo para cabecera táctil
  useEffect(() => {
    const tick = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString('es-PE', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false,
        }),
      );
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, []);

  // Manejo del teclado numérico en pantalla para terminales táctiles (HU001)
  const handlePinDigit = (digit: string) => {
    if (pin.length < 4) {
      const nextPin = pin + digit;
      setPin(nextPin);
      setErrorMsg(null);
      // Auto-envío opcional al completar los 4 dígitos
      if (nextPin.length === 4) {
        submitPin(nextPin);
      }
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

  const submitPin = async (pinValue: string) => {
    if (pinValue.length !== 4) {
      setErrorMsg('El PIN debe contener exactamente 4 dígitos.');
      return;
    }
    setErrorMsg(null);
    setIsSubmitting(true);
    try {
      const sesion = await loginPin(pinValue);
      // Enrutamiento basado en roles operativos (HU001 & HU002)
      if (sesion.rol === 'ADMIN') {
        navigate('/admin/platos');
      } else {
        navigate('/comandero');
      }
    } catch (err: any) {
      const msg =
        err.response?.data?.mensaje || 'PIN incorrecto o no autorizado para esta estación.';
      setErrorMsg(msg);
      setPin('');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAdminSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      setErrorMsg('Ingrese usuario y contraseña.');
      return;
    }
    setErrorMsg(null);
    setIsSubmitting(true);
    try {
      await loginAdmin(username.trim(), password);
      navigate('/admin/platos');
    } catch (err: any) {
      const msg = err.response?.data?.mensaje || 'Credenciales administrativas inválidas.';
      setErrorMsg(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="relative min-h-screen bg-background font-sans text-on-surface flex items-center justify-center p-4 overflow-hidden select-none">
      {/* Resplandores decorativos de ambiente (Design System Stitch) */}
      <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-[680px] h-[320px] bg-primary/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/3 -right-20 w-80 h-80 bg-secondary/5 rounded-full blur-2xl pointer-events-none" />

      <main className="w-full max-w-md flex flex-col items-center relative z-10">
        {/* Fila superior de contexto y estado de terminal */}
        <div className="w-full flex items-center justify-between mb-4 px-1">
          <div className="flex items-center gap-1.5 bg-surface-container-high/80 backdrop-blur-sm px-3 py-1 rounded-full border border-surface-container-highest">
            <span className="w-2 h-2 rounded-full bg-secondary animate-pulse" />
            <span className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">
              Terminal KDS-01 • En línea
            </span>
          </div>
          <div className="flex items-center gap-1 text-on-surface-variant text-xs font-mono">
            <span className="material-symbols-outlined text-[16px]">schedule</span>
            <span>{currentTime || '00:00:00'}</span>
          </div>
        </div>

        {/* Tarjeta Bento Central de Autenticación */}
        <div className="w-full bg-surface-container-lowest rounded-2xl shadow-xl border border-surface-container-high/60 p-6 sm:p-8 flex flex-col relative overflow-hidden backdrop-blur-sm">
          {/* Cabecera de Marca La Retama */}
          <div className="flex flex-col items-center text-center mb-6">
            <div className="w-14 h-14 rounded-2xl bg-primary flex items-center justify-center text-on-primary shadow-md mb-3">
              <span className="material-symbols-outlined text-[32px]">restaurant</span>
            </div>
            <h1 className="font-headline font-extrabold text-2xl tracking-tight text-on-surface">
              La Retama <span className="text-primary">KDS</span>
            </h1>
            <p className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider mt-1">
              Sistema de Cocina y Salón • Sprint 1
            </p>
          </div>

          {/* Selector de Modo: Ingreso Rápido con PIN vs Acceso Administrativo (HU001) */}
          <div className="grid grid-cols-2 gap-1 bg-surface-container-low p-1 rounded-xl mb-6 border border-surface-container-high">
            <button
              type="button"
              onClick={() => {
                setActiveTab('pin');
                setErrorMsg(null);
              }}
              className={`flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'pin'
                  ? 'bg-primary text-on-primary shadow-sm'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">dialpad</span>
              <span>PIN Cocina / Sala</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab('admin');
                setErrorMsg(null);
              }}
              className={`flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'admin'
                  ? 'bg-primary text-on-primary shadow-sm'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">admin_panel_settings</span>
              <span>Administración</span>
            </button>
          </div>

          {/* Banner de Error Operativo */}
          {errorMsg && (
            <div className="flex items-start gap-2.5 bg-error-container text-on-error-container p-3 rounded-xl mb-5 border border-error/20 animate-shake">
              <span className="material-symbols-outlined text-[20px] text-error shrink-0 mt-0.5">
                error
              </span>
              <div className="flex-1 text-left">
                <p className="text-xs font-bold text-error uppercase">Acceso Denegado</p>
                <p className="text-xs mt-0.5 leading-snug">{errorMsg}</p>
              </div>
              <button
                type="button"
                onClick={() => setErrorMsg(null)}
                className="text-on-error-container opacity-60 hover:opacity-100 p-0.5"
              >
                <span className="material-symbols-outlined text-[16px]">close</span>
              </button>
            </div>
          )}

          {/* MODO 1: Teclado Numérico Táctil con PIN (HU001 Escenario 1) */}
          {activeTab === 'pin' && (
            <div className="flex flex-col items-center">
              {/* Display de 4 Dots para el PIN */}
              <div className="flex items-center justify-center gap-3 my-2 py-3 px-6 bg-surface-container-low rounded-xl border border-surface-container-high w-full">
                {[0, 1, 2, 3].map((index) => {
                  const hasDigit = index < pin.length;
                  return (
                    <div
                      key={index}
                      className={`w-4 h-4 rounded-full transition-all duration-200 ${
                        hasDigit
                          ? 'bg-primary scale-110 shadow-sm'
                          : 'bg-surface-container-highest border border-outline-variant/50'
                      }`}
                    />
                  );
                })}
              </div>
              <p className="text-[11px] font-medium text-on-surface-variant mb-4">
                Digite su PIN de 4 dígitos asignado (ej. 1234)
              </p>

              {/* Grilla de Teclas Táctiles Grandes (Optimizadas para dedos con guantes o humedad) */}
              <div className="grid grid-cols-3 gap-2 w-full max-w-xs mb-4">
                {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
                  <button
                    key={digit}
                    type="button"
                    onClick={() => handlePinDigit(digit)}
                    disabled={isSubmitting}
                    className="h-14 rounded-xl bg-surface-container hover:bg-surface-container-high active:bg-primary active:text-on-primary text-xl font-bold font-mono text-on-surface flex items-center justify-center shadow-sm transition-all active:scale-95 disabled:opacity-50"
                  >
                    {digit}
                  </button>
                ))}
                {/* Botón Limpiar (C) */}
                <button
                  type="button"
                  onClick={handlePinClear}
                  disabled={isSubmitting || pin.length === 0}
                  className="h-14 rounded-xl bg-surface-container hover:bg-surface-container-high text-xs font-bold text-on-surface-variant flex items-center justify-center transition-all active:scale-95 disabled:opacity-40"
                  title="Borrar todo"
                >
                  LIMPIAR
                </button>
                {/* Dígito 0 */}
                <button
                  type="button"
                  onClick={() => handlePinDigit('0')}
                  disabled={isSubmitting}
                  className="h-14 rounded-xl bg-surface-container hover:bg-surface-container-high active:bg-primary active:text-on-primary text-xl font-bold font-mono text-on-surface flex items-center justify-center shadow-sm transition-all active:scale-95 disabled:opacity-50"
                >
                  0
                </button>
                {/* Botón Retroceso (Backspace) */}
                <button
                  type="button"
                  onClick={handlePinBackspace}
                  disabled={isSubmitting || pin.length === 0}
                  className="h-14 rounded-xl bg-surface-container hover:bg-surface-container-high text-on-surface flex items-center justify-center transition-all active:scale-95 disabled:opacity-40"
                  title="Borrar último"
                >
                  <span className="material-symbols-outlined text-[24px]">backspace</span>
                </button>
              </div>

              {/* Botón de Confirmación Manual */}
              <button
                type="button"
                onClick={() => submitPin(pin)}
                disabled={isSubmitting || pin.length !== 4}
                className="w-full max-w-xs bg-primary hover:bg-primary-container text-on-primary py-3.5 px-4 rounded-xl text-sm font-bold flex items-center justify-center gap-2 shadow-md transition-all active:scale-[0.98] disabled:opacity-50 cursor-pointer"
              >
                {isSubmitting ? (
                  <span className="inline-block w-5 h-5 border-2 border-on-primary border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[20px]">login</span>
                    <span>INGRESAR CON PIN</span>
                  </>
                )}
              </button>
            </div>
          )}

          {/* MODO 2: Acceso Administrativo (HU001 Escenario 2) */}
          {activeTab === 'admin' && (
            <form onSubmit={handleAdminSubmit} className="flex flex-col gap-4 text-left">
              {/* Campo Usuario */}
              <div>
                <label
                  htmlFor="admin-username"
                  className="block text-xs font-bold uppercase tracking-wider text-on-surface mb-1.5"
                >
                  Usuario de Administración
                </label>
                <div className="relative flex items-center">
                  <span className="material-symbols-outlined absolute left-3 text-[20px] text-on-surface-variant pointer-events-none">
                    badge
                  </span>
                  <input
                    id="admin-username"
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Ej. admin"
                    className="w-full bg-surface-container-low text-on-surface pl-10 pr-3 py-3 rounded-xl text-sm font-medium placeholder:text-outline border border-surface-container-high focus:outline-none focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary transition-all"
                  />
                </div>
              </div>

              {/* Campo Contraseña */}
              <div>
                <label
                  htmlFor="admin-password"
                  className="block text-xs font-bold uppercase tracking-wider text-on-surface mb-1.5"
                >
                  Contraseña
                </label>
                <div className="relative flex items-center">
                  <span className="material-symbols-outlined absolute left-3 text-[20px] text-on-surface-variant pointer-events-none">
                    lock
                  </span>
                  <input
                    id="admin-password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-surface-container-low text-on-surface pl-10 pr-10 py-3 rounded-xl text-sm font-medium placeholder:text-outline border border-surface-container-high focus:outline-none focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 text-on-surface-variant hover:text-on-surface p-1"
                    title={showPassword ? 'Ocultar' : 'Mostrar'}
                  >
                    <span className="material-symbols-outlined text-[20px]">
                      {showPassword ? 'visibility_off' : 'visibility'}
                    </span>
                  </button>
                </div>
              </div>

              {/* Botón Ingresar Admin */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full mt-2 bg-primary hover:bg-primary-container text-on-primary py-3.5 px-4 rounded-xl text-sm font-bold flex items-center justify-center gap-2 shadow-md transition-all active:scale-[0.98] disabled:opacity-50 cursor-pointer"
              >
                {isSubmitting ? (
                  <span className="inline-block w-5 h-5 border-2 border-on-primary border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[20px]">verified_user</span>
                    <span>INGRESAR AL PANEL ADMIN</span>
                  </>
                )}
              </button>
            </form>
          )}

          {/* Información de Ayuda Operativa de Guardia */}
          <div className="mt-6 pt-4 border-t border-surface-container-high flex items-center justify-between text-[11px] text-on-surface-variant">
            <span>
              Credenciales demo: <strong className="text-on-surface">admin / admin123</strong>
            </span>
            <span>
              PIN Mozo: <strong className="text-on-surface">1234</strong>
            </span>
          </div>
        </div>
      </main>

      <LaRetamaWatermark />
    </div>
  );
};
