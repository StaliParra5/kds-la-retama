// Cliente HTTP Axios configurado con interceptores para JWT y manejo de errores LAN
import axios from 'axios';

export const apiClient = axios.create({
  baseURL: '/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000,
});

// Interceptor de Petición: Inyecta el token Bearer si existe en localStorage
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('kds_token');
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

// Sesión vencida o inválida: se limpia y se vuelve al login (API REST y canal en tiempo real)
export const cerrarSesionExpirada = () => {
  localStorage.removeItem('kds_token');
  localStorage.removeItem('kds_user');
  // Redirigir a login si no estamos ya en la pantalla de autenticación
  if (!window.location.pathname.includes('/login')) {
    window.location.href = '/login';
  }
};

// Interceptor de Respuesta: Maneja expiración de sesión y errores 401
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      cerrarSesionExpirada();
    }
    return Promise.reject(error);
  },
);
