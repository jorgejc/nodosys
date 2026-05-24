/**
 * api.ts — Cliente HTTP centralizado (Axios)
 *
 * En lugar de escribir fetch() en cada componente, tenemos
 * un cliente Axios configurado que:
 *  1. Sabe la URL base del backend automáticamente
 *  2. Agrega el token JWT en cada petición automáticamente (interceptor)
 *  3. Si el token expiró (401), cierra sesión automáticamente
 *
 * Así el resto del código solo se preocupa de los datos, no del HTTP.
 */
import axios from 'axios';
import { useAuthStore } from '@/stores/auth.store';

// URL base: en desarrollo usa el proxy de Vite (/api → localhost:3001/api)
const api = axios.create({
  baseURL: '/api',
  // baseURL: import.meta.env.VITE_API_URL ?? '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// ─── Interceptor de REQUEST ───────────────────────────────
// Se ejecuta ANTES de cada petición
// Agrega el token JWT al header Authorization si existe
api.interceptors.request.use(
  (config) => {
    // Leer el token del store de Zustand
    const token = useAuthStore.getState().token;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

// ─── Interceptor de RESPONSE ──────────────────────────────
// Se ejecuta DESPUÉS de cada respuesta
// Si el servidor responde 401, el token expiró → cerrar sesión
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token expirado o inválido → limpiar sesión y redirigir al login
      useAuthStore.getState().logout();
      window.location.href = '/login';
    }
    return Promise.reject(error);
  },
);

export default api;
