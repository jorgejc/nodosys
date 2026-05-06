/**
 * DashboardPage.tsx — Página de inicio (placeholder)
 *
 * Esta es la página temporal del dashboard mientras construimos
 * el módulo completo en la Fase 4.
 * Por ahora muestra un resumen estático para validar el layout.
 */
import { useAuthStore } from '@/stores/auth.store';
import { Package, ClipboardList, FileText, Clock } from 'lucide-react';

export default function DashboardPage() {
  const user = useAuthStore((state) => state.user);

  const stats = [
    {
      label: 'Ítems en Inventario',
      value: '—',
      icon: Package,
      color: 'text-blue-400',
      bg: 'bg-blue-400/10',
      border: 'border-blue-400/20',
    },
    {
      label: 'Horas Ejecutadas',
      value: '—',
      icon: Clock,
      color: 'text-green-400',
      bg: 'bg-green-400/10',
      border: 'border-green-400/20',
    },
    {
      label: 'Actividades Activas',
      value: '—',
      icon: ClipboardList,
      color: 'text-purple-400',
      bg: 'bg-purple-400/10',
      border: 'border-purple-400/20',
    },
    {
      label: 'Reportes Generados',
      value: '—',
      icon: FileText,
      color: 'text-[#FF6B2B]',
      bg: 'bg-[#FF6B2B]/10',
      border: 'border-[#FF6B2B]/20',
    },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <p className="text-xs font-mono text-[#555] uppercase tracking-widest mb-1">
          // PANEL PRINCIPAL
        </p>
        <h1 className="text-2xl font-bold text-white">
          Hola, {user?.name.split(' ')[0]} 👋
        </h1>
        <p className="text-[#666] text-sm mt-1">
          Aquí tienes el resumen de tu nodo.
        </p>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className={`bg-[#111] border ${stat.border} rounded-xl p-5`}
          >
            <div className={`w-10 h-10 ${stat.bg} rounded-lg flex items-center justify-center mb-4`}>
              <stat.icon size={18} className={stat.color} />
            </div>
            <div className={`text-2xl font-bold ${stat.color} mb-1`}>{stat.value}</div>
            <div className="text-xs text-[#666]">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* En construcción */}
      <div className="bg-[#111] border border-[#2A2A2A] rounded-xl p-8 text-center">
        <div className="text-4xl mb-3">🚧</div>
        <h2 className="text-white font-semibold mb-2">Dashboard completo · Fase 4</h2>
        <p className="text-[#666] text-sm">
          El dashboard detallado con gráficas se construye en la Fase 4,
          después de tener el inventario y el plan de trabajo listos.
        </p>
      </div>
    </div>
  );
}
