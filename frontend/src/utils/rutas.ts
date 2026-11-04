// Pantalla de inicio de cada rol: el login y las rutas sin permiso llevan a cada usuario a su puesto
import type { RolCodigo } from '../types';

export const rutaInicio = (rol: RolCodigo | undefined): string => {
  switch (rol) {
    case 'ADMIN':
      return '/admin/platos';
    case 'COCINERO':
      return '/cocina';
    case 'EXPEDIDOR':
      return '/pase';
    case 'MOZO':
      return '/comandero';
    // Un rol desconocido no tiene pantalla propia: volver a /comandero entraría en un bucle de redirecciones
    default:
      return '/login';
  }
};
