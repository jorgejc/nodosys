/**
 * AppLayout.tsx — Layout principal del sistema
 *
 * Este componente envuelve todas las páginas autenticadas.
 * Contiene:
 *  - Sidebar: navegación lateral con los módulos
 *  - Topbar: nombre del usuario y botón de logout
 *  - Área de contenido: aquí se renderizan las páginas (Outlet)
 *
 * Diseño intencional: oscuro, con acentos naranja.
 * NO es el dashboard genérico de IA. Es propio.
 */
import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Package, ClipboardList, FileText,
  Users, LogOut, Menu, X, ChevronRight, Zap,
} from 'lucide-react';
import { useAuthStore } from '@/stores/auth.store';
import { useAuth } from '@/hooks/useAuth';

export default function AppLayout() {
  const navigate  = useNavigate();
  const { user, logout } = useAuthStore();
  const { canViewInventory, canEditInventory, canAddInventory,
          canViewOwnPlan, canViewAllPlans, canViewReports,
          canManageUsers } = useAuth();
  const [open, setOpen] = useState(true);

  const handleLogout = () => { logout(); navigate('/login'); };

  const initials = user?.name.split(' ').slice(0,2).map(n => n[0]).join('').toUpperCase() ?? 'NS';

  // Construir nav según permisos
  const navItems = [
    { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard', sub: 'Vista general', show: true },
    { to: '/inventario', icon: Package, label: 'Inventario', sub: 'Equipos y materiales', show: canViewInventory || canAddInventory },
    { to: '/plan-trabajo', icon: ClipboardList, label: 'Plan de Trabajo', sub: 'Actividades y horas', show: canViewOwnPlan || canViewAllPlans },
    { to: '/reportes', icon: FileText, label: 'Reportes', sub: 'PDF y Excel', show: canViewReports },
    { to: '/usuarios', icon: Users, label: 'Usuarios', sub: 'Gestión de accesos', show: canManageUsers },
    { to: '/actividades', icon: Zap, label: 'Actividades', sub: 'Viáticos y solicitudes', show: true },
  ].filter(n => n.show);

  return (
    <div className="flex h-screen bg-[#0A0A0A] overflow-hidden">
      {/* Sidebar */}
      <aside className={`flex flex-col border-r border-[#1E1E1E] bg-[#0D0D0D] transition-all duration-300 flex-shrink-0 ${open ? 'w-64' : 'w-16'}`}>
        <div className="flex items-center justify-between p-4 border-b border-[#1E1E1E] h-16">
          {open && (
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-md bg-[#FF6B2B] flex items-center justify-center flex-shrink-0">
                <span className="text-white font-black text-sm">N</span>
              </div>
              <div>
                <div className="text-white font-bold text-sm leading-tight">NodoSys</div>
                <div className="text-[#555] text-xs font-mono">IU Digital</div>
              </div>
            </div>
          )}
          <button onClick={() => setOpen(!open)}
            className="p-1.5 rounded-md text-[#555] hover:text-white hover:bg-[#1A1A1A] transition-colors ml-auto">
            {open ? <X size={16} /> : <Menu size={16} />}
          </button>
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {navItems.map(item => (
            <NavLink key={item.to} to={item.to}
              className={({ isActive }) => `flex items-center gap-3 rounded-lg px-3 py-2.5 transition-all group border ${
                isActive
                  ? 'bg-[#FF6B2B]/10 text-[#FF6B2B] border-[#FF6B2B]/20'
                  : 'text-[#666] hover:text-white hover:bg-[#1A1A1A] border-transparent'
              }`}>
              {({ isActive }) => (
                <>
                  <item.icon size={18} className={`flex-shrink-0 ${isActive ? 'text-[#FF6B2B]' : 'text-[#555] group-hover:text-white'}`} />
                  {open && (
                    <>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{item.label}</div>
                        <div className="text-xs text-[#555] truncate">{item.sub}</div>
                      </div>
                      {isActive && <ChevronRight size={12} className="text-[#FF6B2B] flex-shrink-0" />}
                    </>
                  )}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="p-3 border-t border-[#1E1E1E]">
          {open ? (
            <div className="flex items-center gap-3 px-2 py-2">
              <div className="w-8 h-8 rounded-full bg-[#FF6B2B]/20 border border-[#FF6B2B]/30 flex items-center justify-center flex-shrink-0">
                <span className="text-[#FF6B2B] text-xs font-bold">{initials}</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-white text-xs font-medium truncate">{user?.name}</div>
                <div className="text-[#555] text-xs truncate capitalize">{user?.role?.replace('_', ' ')}</div>
              </div>
              <button onClick={handleLogout} className="p-1.5 text-[#555] hover:text-red-400 transition-colors" title="Cerrar sesión">
                <LogOut size={14} />
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-[#FF6B2B]/20 border border-[#FF6B2B]/30 flex items-center justify-center">
                <span className="text-[#FF6B2B] text-xs font-bold">{initials}</span>
              </div>
              <button onClick={handleLogout} className="p-1.5 text-[#555] hover:text-red-400 transition-colors">
                <LogOut size={14} />
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* Contenido principal */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="h-16 border-b border-[#1E1E1E] bg-[#0D0D0D] flex items-center px-6 flex-shrink-0">
          <div className="flex items-center gap-2 text-xs font-mono text-[#555]">
            <span>NODO ARBOLETES</span>
            <span className="text-[#2A2A2A]">/</span>
            <span className="text-[#888] uppercase">{user?.role?.replace('_', ' ')}</span>
          </div>
          <div className="ml-auto flex items-center gap-1.5 text-xs text-[#555]">
            <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
            <span className="font-mono">SISTEMA ACTIVO</span>
          </div>
        </header>
        <main className="flex-1 overflow-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
