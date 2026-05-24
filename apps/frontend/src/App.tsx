/**
 * App.tsx — Configuración de rutas de la aplicación
 *
 * Cada "Route" es una página diferente.
 * El sistema de rutas irá creciendo a medida que construyamos los módulos.
 */
import { Routes, Route, Navigate } from 'react-router-dom'
import LoginPage from '@/pages/auth/LoginPage';
import DashboardPage from '@/pages/DashboardPage';
import AppLayout from '@/layouts/AppLayout';
import ProtectedRoute from '@/components/ui/ProtectedRoute';
import InventoryPage from '@/pages/inventario/InventoryPage';
import InventoryItemDetailPage from '@/pages/inventario/InventoryItemDetailPage';
import NewInventoryItemPage from '@/pages/inventario/NewInventoryItemPage';
import WorkPlanListPage from '@/pages/plan-trabajo/WorkPlanListPage';
import WorkPlanDetailPage from '@/pages/plan-trabajo/WorkPlanDetailPage';
import ReportesPage from '@/pages/reportes/ReportesPage';
import UsersPage from '@/pages/usuarios/UsersPage';
import ActivitiesPage from '@/pages/actividades/ActivitiesPage';
import NewActivityPage from '@/pages/actividades/NewActivityPage';
import ActivityDetailPage from '@/pages/actividades/ActivityDetailPage';

// // Por ahora una página temporal de "estamos construyendo"
// function ComingSoon({ name }: { name: string }) {
//     return (
//     <div className="flex flex-col items-center justify-center h-64 text-center">
//       <div className="text-4xl mb-4">🚧</div>
//       <h2 className="text-white font-semibold mb-2">{name}</h2>
//       <p className="text-[#666] text-sm">Módulo en desarrollo — próxima fase</p>
//     </div>
//   );
// }

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={ <ProtectedRoute> <AppLayout /> </ProtectedRoute> }>
        <Route path="/dashboard"         element={<DashboardPage />} />
        <Route path="/inventario"        element={<InventoryPage />} />
        <Route path="/inventario/nuevo"  element={<NewInventoryItemPage />} />
        <Route path="/inventario/:id"    element={<InventoryItemDetailPage />} />
        <Route path="/plan-trabajo"       element={<WorkPlanListPage />} />
        <Route path="/plan-trabajo/:id"   element={<WorkPlanDetailPage />} />
        <Route path="/reportes/*"        element={<ReportesPage />} />
        <Route path="/usuarios/*"        element={<UsersPage />}/>
        <Route path="/actividades"        element={<ActivitiesPage />} />
        <Route path="/actividades/nueva"  element={<NewActivityPage />} />
        <Route path="/actividades/:id"    element={<ActivityDetailPage />} />
      </Route>
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
