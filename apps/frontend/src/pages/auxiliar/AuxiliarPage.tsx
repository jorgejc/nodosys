/**
 * AuxiliarPage.tsx — Registro de actividad del nodo
 *
 * Según el rol muestra una cosa u otra:
 *   auxiliar       → su propio registro (lo edita)
 *   enlace / admin → la lista de auxiliares de su nodo y, al entrar en
 *                    uno, su mes en modo consulta
 *   resto          → sin acceso (el backend también responde 403)
 */
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  NotebookPen, Loader2, ShieldOff, Users, ChevronRight,
  ChevronLeft, ArrowLeft,
} from 'lucide-react';
import { auxiliaryService } from '@/services/auxiliary.service';
import { useAuth } from '@/hooks/useAuth';
import { apiErrorMessage } from '@/utils/apiError';
import DaysView, { MESES } from '@/components/auxiliar/DaysView';
import type { Filtros } from '@/components/auxiliar/DayFilters';

export default function AuxiliarPage() {
  const { auxiliaryId } = useParams<{ auxiliaryId: string }>();
  const { canViewAuxiliar, canEditOwnAuxiliar, canReviewAuxiliar, role } = useAuth();

  if (!canViewAuxiliar) return <NoAccess />;

  // El enlace entrando al registro de un auxiliar concreto
  if (auxiliaryId) {
    return <AuxiliaryDetail auxiliaryId={auxiliaryId} canReport={canReviewAuxiliar} />;
  }

  return role === 'auxiliar'
    ? <MyRecord canEdit={canEditOwnAuxiliar} />
    : <AuxiliaryList />;
}

/**
 * Estado del período, el filtro y la página, compartido por las dos vistas.
 * Cambiar de mes o de filtro devuelve a la página 1: seguir en la 3 tras
 * filtrar mostraria una lista vacia sin motivo aparente.
 */
function useDaysState() {
  const now = new Date();
  const [year, setYear]   = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [page, setPage]   = useState(1);
  const [filtros, setFiltros] = useState<Filtros>({ search: '', from: '', to: '' });

  const shift = (delta: number) => {
    const d = new Date(year, month - 1 + delta, 1);
    setYear(d.getFullYear());
    setMonth(d.getMonth() + 1);
    setPage(1);
    setFiltros({ search: '', from: '', to: '' });
  };

  const onFiltros = (f: Filtros) => { setFiltros(f); setPage(1); };

  return { year, month, shift, page, setPage, filtros, onFiltros };
}

function MonthPicker({
  year, month, shift,
}: { year: number; month: number; shift: (d: number) => void }) {
  return (
    <div className="flex items-center gap-1 rounded-lg border border-[#2A2A2A] bg-[#141414] p-1">
      <button onClick={() => shift(-1)} title="Mes anterior"
        className="rounded-md p-1.5 text-[#666] transition-colors hover:text-white">
        <ChevronLeft size={15} />
      </button>
      <span className="min-w-[130px] text-center text-sm text-white">
        {MESES[month - 1]} {year}
      </span>
      <button onClick={() => shift(1)} title="Mes siguiente"
        className="rounded-md p-1.5 text-[#666] transition-colors hover:text-white">
        <ChevronRight size={15} />
      </button>
    </div>
  );
}

// ══════════════════════════════════════════════════════════
// Vista del AUXILIAR
// ══════════════════════════════════════════════════════════
function MyRecord({ canEdit }: { canEdit: boolean }) {
  const { year, month, shift, page, setPage, filtros, onFiltros } = useDaysState();

  const { data, isLoading, error } = useQuery({
    queryKey: ['auxiliary-days', 'me', year, month, page, filtros],
    queryFn:  () => auxiliaryService.getMyDays({ year, month, page, ...filtros }),
  });

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 font-mono text-xs text-[#555]">
            <NotebookPen size={13} /> REGISTRO DE ACTIVIDADES
          </div>
          <h1 className="mt-1 text-2xl font-bold text-white">Mi registro de actividades</h1>
          <p className="mt-1 text-sm text-[#666]">
            Documenta tu trabajo diario y tu participación en las actividades del nodo.
          </p>
        </div>
        <MonthPicker year={year} month={month} shift={shift} />
      </header>

      {isLoading ? <Spinner /> : error || !data
        ? <ErrorBox message={apiErrorMessage(error)} />
        : <DaysView page={data} canEdit={canEdit} canReport
                    filtros={filtros} onFiltros={onFiltros} onPage={setPage} />}
    </div>
  );
}

// ══════════════════════════════════════════════════════════
// Vista del ENLACE — lista de auxiliares del nodo
// ══════════════════════════════════════════════════════════
function AuxiliaryList() {
  const { data: auxiliaries, isLoading, error } = useQuery({
    queryKey: ['auxiliaries'],
    queryFn:  auxiliaryService.listAuxiliaries,
  });

  if (isLoading) return <Spinner />;
  if (error) return <ErrorBox message={apiErrorMessage(error)} />;

  return (
    <div className="space-y-6">
      <header>
        <div className="flex items-center gap-2 font-mono text-xs text-[#555]">
          <NotebookPen size={13} /> REGISTRO DE ACTIVIDADES
        </div>
        <h1 className="mt-1 text-2xl font-bold text-white">Auxiliares del nodo</h1>
        <p className="mt-1 text-sm text-[#666]">
          Consulta sus actividades y genera el reporte mensual.
        </p>
      </header>

      {!auxiliaries?.length ? (
        <div className="rounded-xl border border-dashed border-[#2A2A2A] py-16 text-center">
          <Users size={28} className="mx-auto mb-3 text-[#333]" />
          <p className="text-sm text-[#888]">No hay auxiliares registrados en tu nodo.</p>
          <p className="mt-1 text-xs text-[#555]">
            El administrador crea los usuarios con rol auxiliar y los asigna al nodo.
          </p>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {auxiliaries.map((a) => (
            <Link key={a.id} to={`/registro-nodo/${a.id}`}
              className="group flex items-center justify-between gap-3 rounded-xl border border-[#1E1E1E] bg-[#0D0D0D] p-4 transition-colors hover:border-[#FF6B2B]/40">
              <div className="min-w-0">
                <div className="truncate text-sm font-medium text-white">{a.name}</div>
                <div className="mt-0.5 truncate text-xs text-[#666]">
                  {a.documentNumber
                    ? `${a.documentType ?? 'CC'} ${a.documentNumber}`
                    : a.email}
                </div>
                {a.nodoName && (
                  <div className="mt-0.5 truncate text-xs text-[#555]">Nodo {a.nodoName}</div>
                )}
              </div>
              <ChevronRight size={16} className="flex-shrink-0 text-[#333] transition-colors group-hover:text-[#FF6B2B]" />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════
// Vista del ENLACE — mes de un auxiliar concreto
// ══════════════════════════════════════════════════════════
function AuxiliaryDetail({
  auxiliaryId, canReport,
}: { auxiliaryId: string; canReport: boolean }) {
  const { year, month, shift, page, setPage, filtros, onFiltros } = useDaysState();

  const { data, isLoading, error } = useQuery({
    queryKey: ['auxiliary-days', auxiliaryId, year, month, page, filtros],
    queryFn:  () => auxiliaryService.getAuxiliaryDays(auxiliaryId, { year, month, page, ...filtros }),
  });

  return (
    <div className="space-y-6">
      <Link to="/registro-nodo"
        className="inline-flex items-center gap-1.5 text-sm text-[#666] transition-colors hover:text-white">
        <ArrowLeft size={14} /> Auxiliares del nodo
      </Link>

      {isLoading ? <Spinner /> : error || !data ? (
        <ErrorBox message={apiErrorMessage(error, 'No se pudo cargar el registro')} />
      ) : (
        <>
          <header className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2 font-mono text-xs text-[#555]">
                <NotebookPen size={13} /> REGISTRO DE ACTIVIDADES
              </div>
              <h1 className="mt-1 truncate text-2xl font-bold text-white">
                {data.auxiliary.name}
              </h1>
              <p className="mt-1 text-sm text-[#666]">
                {[
                  data.auxiliary.documentNumber
                    ? `${data.auxiliary.documentType ?? 'CC'} ${data.auxiliary.documentNumber}`
                    : null,
                  data.auxiliary.nodoName ? `Nodo ${data.auxiliary.nodoName}` : null,
                ].filter(Boolean).join(' · ') || data.auxiliary.email}
              </p>
            </div>
            <MonthPicker year={year} month={month} shift={shift} />
          </header>

          {/* El enlace consulta y reporta; no escribe el registro ajeno */}
          <DaysView page={data} canEdit={false} canReport={canReport}
                    filtros={filtros} onFiltros={onFiltros} onPage={setPage} />
        </>
      )}
    </div>
  );
}

// ── Piezas compartidas ──────────────────────────────────────

function Spinner() {
  return (
    <div className="flex h-64 items-center justify-center">
      <Loader2 size={24} className="animate-spin text-[#FF6B2B]" />
    </div>
  );
}

function ErrorBox({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
      {message}
    </div>
  );
}

function NoAccess() {
  return (
    <div className="flex h-64 flex-col items-center justify-center text-center">
      <ShieldOff size={28} className="mb-3 text-[#333]" />
      <h2 className="font-semibold text-white">Sin acceso</h2>
      <p className="mt-1 text-sm text-[#666]">
        El registro de actividades del nodo es del auxiliar y su enlace.
      </p>
    </div>
  );
}
