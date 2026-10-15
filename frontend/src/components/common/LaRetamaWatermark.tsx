// Marca de agua y badge institucional de 'La Retama' adaptado al Design System de Stitch
// Posicionado de forma fija en la esquina inferior derecha con mínima opacidad para no interferir en operaciones táctiles.
import React from 'react';

export const LaRetamaWatermark: React.FC = () => {
  return (
    <div className="fixed bottom-3 right-4 z-30 pointer-events-none select-none opacity-40 hover:opacity-100 transition-opacity flex items-center gap-2 bg-surface-container-lowest/80 backdrop-blur-sm px-3 py-1.5 rounded-lg border border-outline-variant/30 shadow-sm text-on-surface-variant">
      <div className="w-5 h-5 rounded-md bg-primary/10 text-primary flex items-center justify-center font-bold text-[10px]">
        LR
      </div>
      <div className="text-[11px] font-medium leading-none">
        <span className="font-semibold text-on-surface">La Retama</span> — KDS v2.4
      </div>
    </div>
  );
};
