import { supabase } from './supabase';

export interface LoginCredentials {
  username: string;
  password: string;
}

export interface User {
  id?: string;
  username: string;
  full_name?: string;
  nivel: number;
}

let currentUser: User | null = null;

export async function login(credentials: LoginCredentials): Promise<User | null> {
  try {
    // TODO: Implement Supabase authentication
    console.log('Login attempt:', credentials.username);
    return null;
  } catch (error) {
    console.error('Login error:', error);
    throw error;
  }
}

export async function logout(): Promise<void> {
  currentUser = null;
  // Clear session storage
}

export function getCurrentUser(): User | null {
  return currentUser;
}

export function setCurrentUser(user: User | null): void {
  currentUser = user;
}

export function isAdmin(user: User | null): boolean {
  return user?.nivel ? user.nivel >= 1 : false;
}

export function isSuperAdmin(user: User | null): boolean {
  return user?.nivel ? user.nivel >= 2 : false;
}
