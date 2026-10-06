import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// Configuración estratégica de Vite para KDS:
// En desarrollo, reenviamos las peticiones /api y /ws hacia el servidor Spring Boot (puerto 8080)
// para evitar restricciones de CORS y permitir la emulación exacta del entorno de producción.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true, // Permite acceder desde otras PCs o tablets en la red local (LAN)
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
      '/ws': {
        target: 'http://localhost:8080',
        ws: true,
      },
    },
  },
});
