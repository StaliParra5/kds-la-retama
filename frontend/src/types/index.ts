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

// HU044/HU046: atención de una mesa (desde que se abre hasta que se libera) con sus pedidos
export interface AtencionMesa {
  id: number;
  mesaId: number;
  mesaNumero: string;
  zonaId: number;
  zonaNombre: string;
  capacidad: number;
  personas: number;
  mozoNombre: string;
  abiertaEn: string;
  liberadaEn?: string | null;
  liberadaPorNombre?: string | null;
  itemsPendientes: number;
  pedidos: PedidoResponse[];
}

// HU047/HU048: semáforo de mesas y vista de salón del administrador
export interface Semaforo {
  minutosAmarillo: number;
  minutosRojo: number;
}

export type EstadoMesaSalon = 'LIBRE' | 'VERDE' | 'AMARILLO' | 'ROJO' | 'ATENDIDA';

export interface MesaSalon {
  id: number;
  numeroMesa: string;
  capacidad: number;
  estado: EstadoMesaSalon;
  atencionId?: number | null;
  personas?: number | null;
  mozoNombre?: string | null;
  abiertaEn?: string | null;
  minutosEspera?: number | null;
  itemsPendientes: number;
}

export interface VistaSalon {
  semaforo: Semaforo;
  generadoEn: string;
  zonas: { id: number; nombre: string; mozos: string[]; mesas: MesaSalon[] }[];
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
  // SALON, PARA_LLEVAR, DELIVERY y los agregadores (RAPPI): el catálogo de canales es administrable
  codigo: string;
  nombre: string;
  slaObjetivoMinutos: number;
  activo: boolean;
  // HU019/HU020: agregador; el comandero no lo ofrece y su pedido exige el número de orden
  externo?: boolean;
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
  // HU008: modificadores predefinidos del plato; vacío = solo se indica la cantidad
  modificadores: string[];
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
  numeroOrdenExterno?: string | null;
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

// HU032: motivo de anulación elegible (lista fija del servidor, D12)
export interface MotivoAnulacion {
  codigo: string;
  etiqueta: string;
}

export interface ItemCocina {
  clienteNombre?: string | null;
  // HU032 Esc. 5: solo llega en el aviso de un ítem recién anulado
  motivoAnulacion?: string | null;
  // HU020 Esc. 3: número de orden del pedido en su canal de origen (Rappi)
  numeroOrdenExterno?: string | null;
  // HU021: zona de la mesa (destino), número de adición (0 = original) y envío a cocina como instante del servidor
  zonaNombre?: string | null;
  numeroAdicion?: number;
  envioCocinaEpochMs?: number | null;
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
