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
  // HU040/HU041: con atención en curso no se desactiva ni se mueve de zona
  enAtencion?: boolean;
}

export interface Zona {
  id: number;
  nombre: string;
  descripcion?: string;
  activo: boolean;
  mesas: Mesa[];
}

// HU042: mozo gestionado por el administrador (nunca viaja el PIN)
export interface Mozo {
  id: number;
  username: string;
  nombre: string;
  apellido: string;
  activo: boolean;
  tieneHistorial: boolean;
  // HU043: zonas que atiende
  zonas: { id: number; nombre: string; activo: boolean }[];
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
  // Identificador local de la línea: un mismo plato puede repetirse con modificadores distintos (HU008)
  lineaId: string;
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
  canalSlaMinutos: number;
  fechaEnvioCocina: string;
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

// Sprint 2: ciclo de vida del ítem (HU013) y pantallas de cocina/pase (HU012, HU014)
export type EstadoItem =
  | 'RECIBIDO'
  | 'EN_ESPERA'
  | 'EN_PREPARACION'
  | 'LISTO'
  | 'DESPACHADO'
  | 'ANULADO';

export interface ItemCocina {
  id: number;
  version: number;
  estado: EstadoItem;
  cantidad: number;
  platoNombre: string;
  modificadores?: string | null;
  tiempoEstandarMinutos: number;
  horaDisparo?: string | null;
  creadoEn: string;
  estacionId: number;
  estacionNombre: string;
  pedidoId: number;
  codigoPedido: string;
  estadoPedido: string;
  canalCodigo: string;
  canalNombre: string;
  canalSlaMinutos: number;
  mesaNumero?: string | null;
  fechaEnvioCocina: string;
  itemsEnOtrasEstaciones: number;
  itemsPendientesPedido: number;
}
