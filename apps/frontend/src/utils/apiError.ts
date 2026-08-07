/**
 * apiError.ts — Mensaje legible a partir de un error de Axios
 *
 * NestJS responde { message: string | string[] }. Cuando falla la validación
 * de un DTO llega un array; el resto de las veces, un texto.
 */
import axios from 'axios';

export function apiErrorMessage(error: unknown, fallback = 'Ocurrió un error inesperado'): string {
  if (axios.isAxiosError(error)) {
    const message = error.response?.data?.message;
    if (Array.isArray(message)) return message.join('. ');
    if (typeof message === 'string' && message) return message;
    if (error.response?.status === 403) return 'No tienes permiso para esta acción';
    if (error.message) return error.message;
  }
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}
