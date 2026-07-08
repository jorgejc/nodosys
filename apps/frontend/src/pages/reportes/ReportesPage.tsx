/**
 * ReportesPage.tsx — Página de reportes con botones de descarga
 */
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FileDown, FileSpreadsheet, FileText, Loader2 } from 'lucide-react';
import api from '@/services/api';
import { workPlanService } from '@/services/workplan.service';
import { useAuth } from '@/hooks/useAuth';
import type { WorkPlan } from '@/types';

function DownloadButton({ label, icon: Icon, color, onClick, loading }: {
  label: string; icon: typeof FileDown; color: string; onClick: () => void; loading: boolean;
}) {
  return (
    <button onClick={onClick} disabled={loading}
      className={`flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-all disabled:opacity-50 ${color}`}>
      {loading ? <Loader2 size={14} className="animate-spin" /> : <Icon size={14} />}
      {loading ? 'Generando...' : label}
    </button>
  );
}

async function downloadFile(url: string, filename: string) {
  const response = await api.get(url, { responseType: 'blob' });
  const blob = new Blob([response.data]);
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

export default function ReportesPage() {
  const [loading, setLoading] = useState<string | null>(null);
  const [selectedPlanId, setSelectedPlanId] = useState('');
  const { canViewInventoryReports, canViewPlanReports } = useAuth();

  const plansQuery = useQuery({
    queryKey: ['workplans'],
    queryFn: () => workPlanService.getAll(),
    enabled: canViewPlanReports,
  });
  const plans = (plansQuery.data ?? []) as WorkPlan[];

  const download = async (key: string, url: string, filename: string) => {
    setLoading(key);
    try {
      await downloadFile(url, filename);
    } catch {
      alert('Error al generar el reporte. Intenta de nuevo.');
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <p className="text-xs font-mono text-[#555] uppercase tracking-widest mb-1">// MÓDULO DE REPORTES</p>
        <h1 className="text-2xl font-bold text-white">Reportes y Exportaciones</h1>
        <p className="text-[#666] text-sm mt-1">Genera reportes en PDF y Excel de los módulos que tienes disponibles</p>
      </div>

      {/* Reportes de Inventario — solo para roles con acceso al módulo */}
      {canViewInventoryReports && <div className="bg-[#111] border border-[#2A2A2A] rounded-xl p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 bg-green-400/10 border border-green-400/20 rounded-lg flex items-center justify-center">
            <span className="text-xl">📦</span>
          </div>
          <div>
            <h2 className="text-white font-semibold">Inventario del Nodo</h2>
            <p className="text-[#666] text-xs">Reporte completo de equipos, materiales y unidades</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          <DownloadButton
            label="Descargar Excel (.xlsx)"
            icon={FileSpreadsheet}
            color="text-green-400 border-green-400/30 bg-green-400/5 hover:bg-green-400/10"
            loading={loading === 'inv-excel'}
            onClick={() => download('inv-excel', '/reports/inventory/excel', `inventario-${new Date().toISOString().split('T')[0]}.xlsx`)}
          />
          <DownloadButton
            label="Descargar PDF"
            icon={FileText}
            color="text-red-400 border-red-400/30 bg-red-400/5 hover:bg-red-400/10"
            loading={loading === 'inv-pdf'}
            onClick={() => download('inv-pdf', '/reports/inventory/pdf', `inventario-${new Date().toISOString().split('T')[0]}.pdf`)}
          />
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 text-xs text-[#555]">
          <div className="bg-[#1A1A1A] rounded-lg p-3 border border-[#2A2A2A]">
            <div className="text-white font-medium mb-1">📊 Excel incluye:</div>
            <ul className="space-y-0.5">
              <li>• Hoja 1: Resumen por ítem (totales)</li>
              <li>• Hoja 2: Detalle de todas las unidades físicas</li>
              <li>• Color por condición (bueno/regular/malo)</li>
              <li>• Formato profesional con estilos</li>
            </ul>
          </div>
          <div className="bg-[#1A1A1A] rounded-lg p-3 border border-[#2A2A2A]">
            <div className="text-white font-medium mb-1">📄 PDF incluye:</div>
            <ul className="space-y-0.5">
              <li>• Agrupado por categoría</li>
              <li>• Conteo de unidades por estado</li>
              <li>• Encabezado con fecha y nodo</li>
              <li>• Numeración de páginas</li>
            </ul>
          </div>
        </div>
      </div>}

      {/* Reportes de Plan de Trabajo — solo para roles con planes */}
      {canViewPlanReports && <div className="bg-[#111] border border-[#2A2A2A] rounded-xl p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 bg-[#FF6B2B]/10 border border-[#FF6B2B]/20 rounded-lg flex items-center justify-center">
            <span className="text-xl">📋</span>
          </div>
          <div>
            <h2 className="text-white font-semibold">Plan de Trabajo Profesoral</h2>
            <p className="text-[#666] text-xs">Formato DO-F-002 · Seguimiento de ejes misionales</p>
          </div>
        </div>

        <div className="mb-4">
          <label className="text-xs text-[#666] uppercase tracking-wider block mb-2">
            Selecciona el plan de trabajo
          </label>
          <select value={selectedPlanId} onChange={e => setSelectedPlanId(e.target.value)}
            className="w-full max-w-sm bg-[#1A1A1A] border border-[#2A2A2A] rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-[#FF6B2B]">
            <option value="">— Seleccionar plan —</option>
            {plans.map(p => (
              <option key={p.id} value={p.id}>{p.semester} · {p.year} · {p.faculty ?? 'Sin facultad'}</option>
            ))}
          </select>
        </div>

        <div className="flex flex-wrap gap-3">
          <DownloadButton
            label="Descargar Excel (.xlsx)"
            icon={FileSpreadsheet}
            color="text-green-400 border-green-400/30 bg-green-400/5 hover:bg-green-400/10"
            loading={loading === 'wp-excel'}
            onClick={() => {
              if (!selectedPlanId) { alert('Selecciona un plan de trabajo primero'); return; }
              download('wp-excel', `/reports/workplan/${selectedPlanId}/excel`, `plan-trabajo-${selectedPlanId.slice(0,8)}.xlsx`);
            }}
          />
          <DownloadButton
            label="Descargar PDF (DO-F-002)"
            icon={FileDown}
            color="text-[#FF6B2B] border-[#FF6B2B]/30 bg-[#FF6B2B]/5 hover:bg-[#FF6B2B]/10"
            loading={loading === 'wp-pdf'}
            onClick={() => {
              if (!selectedPlanId) { alert('Selecciona un plan de trabajo primero'); return; }
              download('wp-pdf', `/reports/workplan/${selectedPlanId}/pdf`, `plan-trabajo-DO-F-002-${selectedPlanId.slice(0,8)}.pdf`);
            }}
          />
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 text-xs text-[#555]">
          <div className="bg-[#1A1A1A] rounded-lg p-3 border border-[#2A2A2A]">
            <div className="text-white font-medium mb-1">📊 Excel incluye:</div>
            <ul className="space-y-0.5">
              <li>• Encabezado DO-F-002 completo</li>
              <li>• Una sección por eje misional</li>
              <li>• Tabla de actividades con horas</li>
              <li>• Totales por eje y plan completo</li>
            </ul>
          </div>
          <div className="bg-[#1A1A1A] rounded-lg p-3 border border-[#2A2A2A]">
            <div className="text-white font-medium mb-1">📄 PDF incluye:</div>
            <ul className="space-y-0.5">
              <li>• Formato horizontal (Hoja 2)</li>
              <li>• Dimensiones de Digitalidad Próxima</li>
              <li>• Estado y fechas por actividad</li>
              <li>• Enlace a soportes/evidencias</li>
            </ul>
          </div>
        </div>
      </div>}
    </div>
  );
}
