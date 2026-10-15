// Re-exportación estratégica de TopAppBar para compatibilidad hacia atrás
// Asegura que cualquier componente que importe KdsHeader reciba la nueva barra superior de Stitch.
import React from 'react';
import { TopAppBar } from './TopAppBar';

export const KdsHeader: React.FC = () => {
  return <TopAppBar />;
};
