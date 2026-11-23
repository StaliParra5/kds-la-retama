// Punto de entrada principal de la aplicación React KDS
// Estratégicamente montamos la aplicación validando la existencia del elemento DOM raíz
// para evitar fallos de ejecución en modo estricto y navegadores kiosco antiguos.
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
// HU018 Esc. 3: tipografías e íconos locales (paquetes @fontsource y material-symbols); Vite los copia al build,
// así ninguna pantalla depende de Google Fonts ni de internet para verse completa
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import '@fontsource/inter/800.css';
import '@fontsource/plus-jakarta-sans/600.css';
import '@fontsource/plus-jakarta-sans/700.css';
import '@fontsource/plus-jakarta-sans/800.css';
import 'material-symbols/outlined.css';
import './index.css';

const rootElement = document.getElementById('root');
if (rootElement) {
  createRoot(rootElement).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}
