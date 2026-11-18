/** @type {import('tailwindcss').Config} */
// Configuración de Tokens de Diseño para La Retama KDS (Google Stitch: Culinary Operations Light)
// Proporciona fidelidad visual estricta 1:1 con el prototipo de Stitch (Proyecto 11881567410534928871)
// optimizado para pantallas táctiles de salón, cocina y administración en red local (LAN).
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // Paleta semántica Stitch: Superficies y Contenedores Bento
        background: "#faf8ff",
        surface: "#faf8ff",
        "surface-dim": "#d2d9f4",
        "surface-bright": "#faf8ff",
        "surface-container-lowest": "#ffffff",
        "surface-container-low": "#f2f3ff",
        "surface-container": "#eaedff",
        "surface-container-high": "#e2e7ff",
        "surface-container-highest": "#dae2fd",
        "surface-variant": "#dae2fd",
        "surface-tint": "#0053db",

        // Textos y Contraste Táctil
        "on-surface": "#131b2e",
        "on-surface-variant": "#434655",
        "inverse-surface": "#283044",
        "inverse-on-surface": "#eef0ff",
        outline: "#737686",
        "outline-variant": "#c3c6d7",

        // Acentos Funcionales y Estados SLA
        primary: "#004ac6",
        "primary-container": "#2563eb",
        "on-primary": "#ffffff",
        "on-primary-container": "#eeefff",
        "primary-fixed": "#dbe1ff",
        "primary-fixed-dim": "#b4c5ff",
        "inverse-primary": "#b4c5ff",

        // Listo / Despachado (Verde Esmeralda)
        secondary: "#006c49",
        "secondary-container": "#6cf8bb",
        "on-secondary": "#ffffff",
        "on-secondary-container": "#00714d",
        "secondary-fixed": "#6ffbbe",
        "secondary-fixed-dim": "#4edea3",

        // En Preparación / Advertencias (Ámbar)
        tertiary: "#784b00",
        "tertiary-container": "#996100",
        "on-tertiary": "#ffffff",
        "on-tertiary-container": "#ffeedd",
        "tertiary-fixed": "#ffddb8",
        "tertiary-fixed-dim": "#ffb95f",

        // Errores / Alertas Críticas SLA (Rojo Rubí)
        error: "#ba1a1a",
        "error-container": "#ffdad6",
        "on-error": "#ffffff",
        "on-error-container": "#93000a",
      },
      borderRadius: {
        sm: "0.125rem",
        DEFAULT: "0.25rem",
        md: "0.375rem",
        lg: "0.5rem",
        xl: "0.75rem",
        "2xl": "1rem",
        full: "9999px",
      },
      spacing: {
        "space-xs": "0.25rem",
        "space-sm": "0.5rem",
        "space-md": "0.75rem",
        "space-lg": "1rem",
        "space-xl": "1.5rem",
        "space-2xl": "2rem",
        gutter: "1rem",
        "gutter-lg": "1.5rem",
        margin: "1rem",
        "margin-lg": "1.5rem",
      },
      fontFamily: {
        sans: ["Inter", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "Roboto", "sans-serif"],
        headline: ["Plus Jakarta Sans", "Inter", "sans-serif"],
        "plus-jakarta": ["Plus Jakarta Sans", "sans-serif"],
      },
    },
  },
  plugins: [],
};
