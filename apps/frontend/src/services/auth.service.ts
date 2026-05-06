import api from './api';
import type { AuthResponse, LoginCredentials, User } from '@/types';

export const authService = {
  /**
   * Iniciar sesión
   * POST /api/auth/login → { accessToken, user }
   */
  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    const { data } = await api.post<AuthResponse>('/auth/login', credentials);
    return data;
  },

  /**
   * Obtener perfil del usuario autenticado
   * GET /api/auth/profile (requiere JWT en header)
   */
  async getProfile(): Promise<User> {
    const { data } = await api.get<User>('/auth/profile');
    return data;
  },
};
