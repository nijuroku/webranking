export interface User {
  id: string;
  username: string;
  email?: string;
  full_name?: string;
  nivel: number;
  created_at: string;
}

export interface Team {
  id: string;
  nombre: string;
  tag: string;
  created_at: string;
}

export interface Ranking {
  id: string;
  usuario_id: string;
  equipo_id: string;
  puntos: number;
  posicion: number;
}

// Auth functions would go here
