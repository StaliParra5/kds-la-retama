// Contexto global de Autenticación, Sesión y Vinculación de Estación de Trabajo (HU001 & HU004)
import React, { createContext, useContext, useEffect, useState } from 'react';
import { apiClient } from '../api/client';
import type { AuthResponse, UsuarioSesion } from '../types';

interface AuthContextType {
  user: UsuarioSesion | null;
  token: string | null;
  estacionId: number | null;
  estacionNombre: string | null;
  isLoading: boolean;
  loginAdmin: (username: string, password: string) => Promise<UsuarioSesion>;
  loginPin: (pin: string, stationId?: number | null) => Promise<UsuarioSesion>;
  logout: () => void;
  vincularEstacionTerminal: (id: number, nombre: string) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UsuarioSesion | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [estacionId, setEstacionId] = useState<number | null>(null);
  const [estacionNombre, setEstacionNombre] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Inicializar estado persistido desde localStorage al arrancar la app
  useEffect(() => {
    try {
      const storedToken = localStorage.getItem('kds_token');
      const storedUser = localStorage.getItem('kds_user');
      const storedStationId = localStorage.getItem('kds_terminal_station_id');
      const storedStationName = localStorage.getItem('kds_terminal_station_name');

      if (storedToken && storedUser) {
        setToken(storedToken);
        setUser(JSON.parse(storedUser));
      }

      if (storedStationId) {
        setEstacionId(Number(storedStationId));
        setEstacionNombre(storedStationName || null);
      }
    } catch (e) {
      console.error('Error restaurando sesión KDS:', e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loginAdmin = async (username: string, password: string): Promise<UsuarioSesion> => {
    const res = await apiClient.post<AuthResponse>('/auth/login-admin', { username, password });
    const data = res.data;

    const sesion: UsuarioSesion = {
      id: data.usuarioId,
      username: data.username,
      nombreCompleto: data.nombreCompleto,
      rol: data.rol,
      estacionId: data.estacionId,
      estacionNombre: data.estacionNombre,
    };

    localStorage.setItem('kds_token', data.token);
    localStorage.setItem('kds_user', JSON.stringify(sesion));
    setToken(data.token);
    setUser(sesion);
    return sesion;
  };

  const loginPin = async (pin: string, stationIdParam?: number | null): Promise<UsuarioSesion> => {
    // Si no se pasa estación explícita, se usa la vinculada a esta PC terminal
    const activeStation = stationIdParam || estacionId;
    const res = await apiClient.post<AuthResponse>('/auth/login-pin', {
      pin,
      estacionId: activeStation,
    });
    const data = res.data;

    const sesion: UsuarioSesion = {
      id: data.usuarioId,
      username: data.username,
      nombreCompleto: data.nombreCompleto,
      rol: data.rol,
      estacionId: data.estacionId || activeStation,
      estacionNombre: data.estacionNombre || estacionNombre,
    };

    localStorage.setItem('kds_token', data.token);
    localStorage.setItem('kds_user', JSON.stringify(sesion));
    setToken(data.token);
    setUser(sesion);
    return sesion;
  };

  const logout = () => {
    localStorage.removeItem('kds_token');
    localStorage.removeItem('kds_user');
    setToken(null);
    setUser(null);
  };

  const vincularEstacionTerminal = (id: number, nombre: string) => {
    localStorage.setItem('kds_terminal_station_id', String(id));
    localStorage.setItem('kds_terminal_station_name', nombre);
    setEstacionId(id);
    setEstacionNombre(nombre);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        estacionId,
        estacionNombre,
        isLoading,
        loginAdmin,
        loginPin,
        logout,
        vincularEstacionTerminal,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth debe ser utilizado dentro de un AuthProvider');
  }
  return context;
};
