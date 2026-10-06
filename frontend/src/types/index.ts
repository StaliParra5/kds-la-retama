// Tipos de datos compartidos en el Frontend KDS
// Refleja con precisión los modelos y DTOs del Backend Spring Boot

export type RolCodigo = 'ADMIN' | 'MOZO' | 'COCINERO' | 'EXPEDIDOR';

export interface UsuarioSesion {
  id: number;
  username: string;
  nombreCompleto: string;
  rol: RolCodigo;
  estacionId?: number | null;
  estacionNombre?: string | null;
}

export interface AuthResponse {
  token: string;
  usuarioId: number;
  username: string;
  nombreCompleto: string;
  rol: RolCodigo;
  estacionId?: number | null;
  estacionNombre?: string | null;
}

export interface Estacion {
  id: number;
  codigo: string;
  nombre: string;
  descripcion?: string;
  activo: boolean;
  cantidadPlatos?: number;
}

export interface Mesa {
  id: number;
  zonaId: number;
  zonaNombre: string;
  numeroMesa: string;
  capacidad: number;
  activo: boolean;
}

export interface Zona {
  id: number;
  nombre: string;
  descripcion?: string;
  activo: boolean;
  mesas: Mesa[];
}

export interface CanalVenta {
  id: number;
  codigo: 'SALON' | 'PARA_LLEVAR' | 'DELIVERY';
  nombre: string;
  slaObjetivoMinutos: number;
  activo: boolean;
}

export interface CategoriaPlato {
  id: number;
  nombre: string;
  ordenVisual: number;
  activo: boolean;
}

export interface Plato {
  id: number;
  categoriaId: number;
  categoriaNombre: string;
  estacionId: number;
  estacionNombre: string;
  nombre: string;
  descripcion?: string;
  precio: number;
  tiempoEstandarMinutos: number;
  disponible: boolean;
  activo: boolean;
}

export interface ItemComanda {
  plato: Plato;
  cantidad: number;
  modificadores?: string;
}

export interface DetallePedidoResponse {
  id: number;
  platoId: number;
  platoNombre: string;
  estacionId: number;
  estacionNombre: string;
  cantidad: number;
  precioUnitario: number;
  subtotal: number;
  modificadores?: string;
  tiempoEstandarMinutos: number;
  estadoItem: string;
}

export interface PedidoResponse {
  id: number;
  codigoCorrelativo: string;
  canalId: number;
  canalCodigo: string;
  canalNombre: string;
  mesaId?: number | null;
  mesaNumero?: string | null;
  usuarioNombre: string;
  clienteNombre?: string;
  clienteTelefono?: string;
  estado: string;
  total: number;
  observaciones?: string;
  createdAt: string;
  items: DetallePedidoResponse[];
}
