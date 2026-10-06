// Punto de entrada principal de la aplicación React KDS
// Estratégicamente montamos la aplicación validando la existencia del elemento DOM raíz
// para evitar fallos de ejecución en modo estricto y navegadores kiosco antiguos.
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';

const rootElement = document.getElementById('root');
if (rootElement) {
  createRoot(rootElement).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}
