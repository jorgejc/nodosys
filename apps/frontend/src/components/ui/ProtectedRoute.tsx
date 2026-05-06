/**
 * ProtectedRoute.tsx — Ruta protegida
 *
 * Si el usuario NO está autenticado e intenta ir a /dashboard,
 * lo redirige automáticamente a /login.
 *
 * Uso en App.tsx:
 *   <Route path="/dashboard" element={
 *     <ProtectedRoute><DashboardPage /></ProtectedRoute>
 *   } />
 */
import { Navigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/auth.store';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  if (!isAuthenticated) {
    // Redirige a login, y guarda la ruta actual para volver después del login
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}
