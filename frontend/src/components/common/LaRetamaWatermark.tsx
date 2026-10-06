// Marca de agua y badge institucional de 'La Retama'
// Presente en todas las pantallas del KDS para dar identidad gastronómica local
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import React from 'react';

export const LaRetamaWatermark: React.FC = () => {
  return (
    <Box
      sx={{
        position: 'fixed',
        bottom: 16,
        right: 16,
        zIndex: 40,
        backgroundColor: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '12px',
        px: 1.5,
        py: 1,
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
        boxShadow: '0 2px 6px rgba(0, 0, 0, 0.04)',
        pointerEvents: 'none',
      }}
    >
      <Box
        sx={{
          width: 32,
          height: 32,
          borderRadius: '8px',
          backgroundColor: '#fef3c7',
          color: '#d97706',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontWeight: 700,
          fontSize: '0.8rem',
        }}
      >
        LR
      </Box>
      <Box sx={{ display: 'flex', flexDirection: 'column' }}>
        <Typography
          variant="caption"
          sx={{ fontWeight: 700, color: '#1e293b', lineHeight: 1.1, fontSize: '0.75rem' }}
        >
          LA RETAMA
        </Typography>
        <Typography variant="caption" sx={{ color: '#64748b', fontSize: '0.65rem' }}>
          cafetería-restaurante
        </Typography>
      </Box>
    </Box>
  );
};
