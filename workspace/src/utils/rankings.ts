import { supabase } from './supabase';
import type { Ranking, Team } from './types';

export async function fetchRankingMain(): Promise<Ranking[]> {
  try {
    // TODO: Implement Supabase query
    console.log('Fetching ranking main');
    return [];
  } catch (error) {
    console.error('Error fetching ranking:', error);
    throw error;
  }
}

export async function fetchRankingExtra(event?: string): Promise<Ranking[]> {
  try {
    // TODO: Implement Supabase query
    console.log('Fetching ranking extra', event);
    return [];
  } catch (error) {
    console.error('Error fetching extra ranking:', error);
    throw error;
  }
}

export async function fetchTeams(): Promise<Team[]> {
  try {
    // TODO: Implement Supabase query
    console.log('Fetching teams');
    return [];
  } catch (error) {
    console.error('Error fetching teams:', error);
    throw error;
  }
}

export async function addPuntos(usuarioId: string, puntos: number): Promise<void> {
  try {
    // TODO: Implement Supabase update
    console.log('Adding puntos:', usuarioId, puntos);
  } catch (error) {
    console.error('Error adding puntos:', error);
    throw error;
  }
}
