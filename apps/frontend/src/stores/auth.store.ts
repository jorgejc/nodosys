/**
 * auth.store.ts — Estado global de autenticación (Zustand)
 *
 * Zustand es como una caja de estado global que todos los componentes
 * pueden leer y modificar. Es más simple que Redux.
 *
 * Aquí guardamos:
 *  - El usuario autenticado
 *  - El token JWT
 *  - Si está cargando
 *
 * El token se persiste en localStorage para que al refrescar
 * la página, el usuario siga logueado.
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User } from '@/types';

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;

  // Acciones
  setAuth: (user: User, token: string) => void;
  logout: () => void;
  updateUser: (user: Partial<User>) => void;
}

export const useAuthStore = create<AuthState>()(
  // persist: guarda el estado en localStorage automáticamente
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,

      // Guardar usuario y token después del login exitoso
      setAuth: (user: User, token: string) =>
        set({ user, token, isAuthenticated: true }),

      // Limpiar todo al cerrar sesión
      logout: () =>
        set({ user: null, token: null, isAuthenticated: false }),

      // Actualizar datos del usuario sin hacer logout
      updateUser: (updatedFields: Partial<User>) =>
        set((state) => ({
          user: state.user ? { ...state.user, ...updatedFields } : null,
        })),
    }),
    {
      name: 'nodosys-auth', // Nombre en localStorage
      // Solo persiste user y token (no las funciones)
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        isAuthenticated: state.isAuthenticated,
      }),
    },
  ),
);
