/**
 * ExportMenu — Botón desplegable PDF + Excel para exportar reportes.
 * Uso: <ExportMenu pdfUrl="/reports/foo/pdf" excelUrl="/reports/foo/excel" params={{ status }} />
 */
import { useState, useRef, useEffect } from 'react';
import { FileDown, FileSpreadsheet, FileText, Loader2, ChevronDown } from 'lucide-react';
import api from '@/services/api';

interface ExportMenuProps {
  pdfUrl: string;
  excelUrl: string;
  params?: Record<string, string | undefined>;
  label?: string;
  className?: string;
}

async function downloadBlob(url: string, filename: string, params?: Record<string, string | undefined>) {
  const cleanParams = params
    ? Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== ''))
    : undefined;
  const res = await api.get(url, { responseType: 'blob', params: cleanParams });
  const blob = new Blob([res.data]);
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

export default function ExportMenu({ pdfUrl, excelUrl, params, label = 'Exportar', className = '' }: ExportMenuProps) {
  const [open, setOpen]       = useState(false);
  const [loading, setLoading] = useState<'pdf' | 'excel' | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const run = async (type: 'pdf' | 'excel') => {
    setOpen(false);
    setLoading(type);
    const date = new Date().toISOString().split('T')[0];
    try {
      if (type === 'pdf') {
        const filename = pdfUrl.split('/').filter(Boolean).join('-') + `-${date}.pdf`;
        await downloadBlob(pdfUrl, filename, params);
      } else {
        const filename = excelUrl.split('/').filter(Boolean).join('-') + `-${date}.xlsx`;
        await downloadBlob(excelUrl, filename, params);
      }
    } catch {
      alert('Error al generar el reporte. Intenta de nuevo.');
    } finally {
      setLoading(null);
    }
  };

  return (
    <div ref={ref} className={`relative inline-block ${className}`}>
      <button
        onClick={() => setOpen(!open)}
        disabled={!!loading}
        className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[#2A2A2A] bg-[#111] text-sm text-[#999] hover:text-white hover:border-[#FF6B2B]/50 transition-all disabled:opacity-50"
      >
        {loading ? (
          <Loader2 size={14} className="animate-spin text-[#FF6B2B]" />
        ) : (
          <FileDown size={14} />
        )}
        {loading ? 'Generando...' : label}
        {!loading && <ChevronDown size={12} className={`transition-transform ${open ? 'rotate-180' : ''}`} />}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 z-30 bg-[#111] border border-[#2A2A2A] rounded-lg shadow-xl py-1 w-48">
          <button
            onClick={() => run('pdf')}
            className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm text-[#CC3333] hover:bg-[#1A1A1A] hover:text-red-400 transition-colors"
          >
            <FileText size={14} />
            Descargar PDF
          </button>
          <button
            onClick={() => run('excel')}
            className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm text-[#33AA55] hover:bg-[#1A1A1A] hover:text-green-400 transition-colors"
          >
            <FileSpreadsheet size={14} />
            Descargar Excel
          </button>
        </div>
      )}
    </div>
  );
}
