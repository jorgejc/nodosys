/**
 * DayFilters.tsx — Filtro de la lista de días
 *
 * Dos cosas: buscar por lo que se hizo (texto de la actividad) y acotar
 * por rango de fechas dentro del mes. El backend recorta el rango al mes
 * consultado, así que el selector se limita a esos días y no se puede
 * pedir algo que la vista no vaya a mostrar.
 *
 * La búsqueda se aplica con un pequeño retardo para no lanzar una petición
 * por cada tecla.
 */
import { useEffect, useState } from 'react';
import { Search, X, SlidersHorizontal } from 'lucide-react';

export interface Filtros {
  search: string;
  from:   string;
  to:     string;
}

interface Props {
  value:    Filtros;
  onChange: (f: Filtros) => void;
  year:     number;
  month:    number;
}

/** Primer y último día del mes en 'YYYY-MM-DD', para acotar el selector. */
function limitesDelMes(year: number, month: number): { min: string; max: string } {
  const p = (n: number) => String(n).padStart(2, '0');
  const ultimo = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return { min: `${year}-${p(month)}-01`, max: `${year}-${p(month)}-${p(ultimo)}` };
}

export default function DayFilters({ value, onChange, year, month }: Props) {
  const [texto, setTexto] = useState(value.search);
  const { min, max } = limitesDelMes(year, month);

  // Al cambiar de mes el texto local se resincroniza con el de arriba
  useEffect(() => setTexto(value.search), [value.search]);

  // Retardo: evita una petición por pulsación
  useEffect(() => {
    if (texto === value.search) return;
    const t = setTimeout(() => onChange({ ...value, search: texto }), 350);
    return () => clearTimeout(t);
  }, [texto]);   // eslint-disable-line react-hooks/exhaustive-deps

  const hayFiltro = !!(value.search || value.from || value.to);

  return (
    <div className="rounded-xl border border-[#1E1E1E] bg-[#0D0D0D] p-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        {/* Búsqueda por lo que se hizo */}
        <div className="relative flex-1">
          <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#555]" />
          <input
            type="text" value={texto} maxLength={200}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="Buscar en las actividades…"
            className="w-full rounded-lg border border-[#2A2A2A] bg-[#141414] py-2 pl-9 pr-3 text-sm text-white outline-none focus:border-[#FF6B2B]"
          />
        </div>

        {/* Rango de fechas, acotado al mes */}
        <div className="flex items-center gap-2">
          <SlidersHorizontal size={14} className="flex-shrink-0 text-[#555] sm:hidden" />
          <input
            type="date" value={value.from} min={min} max={max}
            onChange={(e) => onChange({ ...value, from: e.target.value })}
            title="Desde"
            className="w-full rounded-lg border border-[#2A2A2A] bg-[#141414] px-2.5 py-2 text-xs text-white outline-none focus:border-[#FF6B2B] sm:w-auto"
          />
          <span className="text-xs text-[#555]">a</span>
          <input
            type="date" value={value.to} min={min} max={max}
            onChange={(e) => onChange({ ...value, to: e.target.value })}
            title="Hasta"
            className="w-full rounded-lg border border-[#2A2A2A] bg-[#141414] px-2.5 py-2 text-xs text-white outline-none focus:border-[#FF6B2B] sm:w-auto"
          />
        </div>

        {hayFiltro && (
          <button
            onClick={() => { setTexto(''); onChange({ search: '', from: '', to: '' }); }}
            className="flex items-center justify-center gap-1.5 rounded-lg border border-[#2A2A2A] px-3 py-2 text-xs text-[#888] transition-colors hover:border-[#FF6B2B]/40 hover:text-[#FF6B2B]">
            <X size={12} /> Limpiar
          </button>
        )}
      </div>
    </div>
  );
}
