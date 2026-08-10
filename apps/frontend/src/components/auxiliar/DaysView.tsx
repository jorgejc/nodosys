/**
 * DaysView.tsx — Registro de actividades: los días de un período
 *
 * Sustituye a MonthView. Lo comparten la vista del auxiliar y la del
 * enlace; lo que cambia entre ambas es quién puede editar, y eso llega
 * por props.
 *
 * Estructura: resumen del mes arriba, filtro, la lista de días como
 * tarjetas, y paginación abajo. Los totales del resumen son SIEMPRE del
 * mes completo, aunque estés viendo una página suelta.
 */
import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  FileDown, Loader2, CalendarPlus, ClipboardList, ChevronLeft, ChevronRight,
} from 'lucide-react';
import { auxiliaryService } from '@/services/auxiliary.service';
import { apiErrorMessage } from '@/utils/apiError';
import type { AuxiliaryDaysPage, AuxiliaryActivity } from '@/types';
import DayCard from './DayCard';
import DayFilters, { type Filtros } from './DayFilters';
import ActivityModal from './ActivityModal';
import AuxEvidenceModal from './AuxEvidenceModal';

export const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

interface Props {
  page:       AuxiliaryDaysPage;
  canEdit:    boolean;
  canReport:  boolean;
  filtros:    Filtros;
  onFiltros:  (f: Filtros) => void;
  onPage:     (p: number) => void;
}

/** 'lunes, 4 de agosto' — para el encabezado del modal. */
function fechaLarga(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('es-CO', {
    weekday: 'long', day: 'numeric', month: 'long',
  });
}

/** Hoy en 'YYYY-MM-DD', en hora local (no UTC: cambiaría el día). */
function hoyISO(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export default function DaysView({
  page, canEdit, canReport, filtros, onFiltros, onPage,
}: Props) {
  const qc = useQueryClient();
  const [activityModal, setActivityModal] = useState<
    { dayId: string; dayLabel: string; activity: AuxiliaryActivity | null } | null
  >(null);
  const [evidenceModal, setEvidenceModal] = useState<
    { activityId: string; label: string } | null
  >(null);
  const [nuevoDia, setNuevoDia] = useState(hoyISO());
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState('');

  const invalidate = () => qc.invalidateQueries({ queryKey: ['auxiliary-days'] });
  const onError = (e: unknown) => setError(apiErrorMessage(e));

  const crearDia = useMutation({
    mutationFn: () => auxiliaryService.createDay(nuevoDia),
    onSuccess: invalidate, onError,
  });
  const borrarDia = useMutation({
    mutationFn: auxiliaryService.deleteDay, onSuccess: invalidate, onError,
  });
  const borrarActividad = useMutation({
    mutationFn: auxiliaryService.deleteActivity, onSuccess: invalidate, onError,
  });
  const borrarEvidencia = useMutation({
    mutationFn: auxiliaryService.deleteEvidence, onSuccess: invalidate, onError,
  });

  const { summary, pagination, days } = page;

  const descargarReporte = async () => {
    setError('');
    setDownloading(true);
    try {
      await auxiliaryService.downloadMonthlyReport(
        page.auxiliary.id, page.year, page.month, page.auxiliary.name,
      );
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* ── Resumen del mes ── */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Días con registro" value={summary.daysWithLog} accent big />
        <StatCard label="Actividades"       value={summary.activityCount} />
        <StatCard label="Evidencias"        value={summary.evidenceCount} />
        <StatCard
          label="Horas registradas"
          value={summary.totalHours !== null ? `${summary.totalHours} h` : '—'}
          hint={summary.totalHours === null ? 'Opcional, no se registraron' : undefined}
        />
      </div>

      {/* ── Acciones ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {canEdit ? (
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="date" value={nuevoDia}
              onChange={(e) => setNuevoDia(e.target.value)}
              className="rounded-lg border border-[#2A2A2A] bg-[#141414] px-3 py-2 text-sm text-white outline-none focus:border-[#FF6B2B]"
            />
            <button onClick={() => crearDia.mutate()} disabled={crearDia.isPending || !nuevoDia}
              className="flex items-center gap-2 rounded-lg bg-[#FF6B2B] px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50">
              {crearDia.isPending
                ? <Loader2 size={14} className="animate-spin" />
                : <CalendarPlus size={14} />}
              Abrir día
            </button>
          </div>
        ) : <div />}

        {canReport && (
          <button onClick={descargarReporte} disabled={downloading}
            className="flex items-center gap-2 rounded-lg border border-[#2A2A2A] px-4 py-2 text-sm font-medium text-[#888] transition-colors hover:border-[#FF6B2B]/40 hover:text-[#FF6B2B] disabled:opacity-50">
            {downloading ? <Loader2 size={14} className="animate-spin" /> : <FileDown size={14} />}
            Reporte del mes
          </button>
        )}
      </div>

      <DayFilters value={filtros} onChange={onFiltros} year={page.year} month={page.month} />

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* ── Días ── */}
      {days.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[#2A2A2A] py-16 text-center">
          <ClipboardList size={28} className="mx-auto mb-3 text-[#333]" />
          <p className="text-sm text-[#888]">
            {filtros.search || filtros.from || filtros.to
              ? 'Ningún día coincide con el filtro.'
              : `Sin registros en ${MESES[page.month - 1].toLowerCase()}.`}
          </p>
          {canEdit && !filtros.search && !filtros.from && !filtros.to && (
            <p className="mt-1 text-xs text-[#555]">
              Abre un día y empieza a registrar tus actividades.
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {days.map((d) => (
            <DayCard
              key={d.id}
              day={d}
              canEdit={canEdit}
              onAddActivity={() => setActivityModal({
                dayId: d.id, dayLabel: fechaLarga(d.logDate), activity: null,
              })}
              onEditActivity={(a) => setActivityModal({
                dayId: d.id, dayLabel: fechaLarga(d.logDate), activity: a,
              })}
              onDeleteActivity={(a) => borrarActividad.mutate(a.id)}
              onAddEvidence={(a) => setEvidenceModal({
                activityId: a.id,
                label: a.description.slice(0, 60),
              })}
              onDeleteEvidence={(id) => borrarEvidencia.mutate(id)}
              onDeleteDay={() => borrarDia.mutate(d.id)}
            />
          ))}
        </div>
      )}

      {/* ── Paginación ── */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-[#1E1E1E] bg-[#0D0D0D] px-4 py-3">
          <span className="text-xs text-[#666]">
            {pagination.total} día{pagination.total === 1 ? '' : 's'} ·
            página {pagination.page} de {pagination.totalPages}
          </span>
          <div className="flex items-center gap-1">
            <PagBtn
              disabled={pagination.page <= 1}
              onClick={() => onPage(pagination.page - 1)}
              title="Página anterior">
              <ChevronLeft size={15} />
            </PagBtn>
            <PagBtn
              disabled={pagination.page >= pagination.totalPages}
              onClick={() => onPage(pagination.page + 1)}
              title="Página siguiente">
              <ChevronRight size={15} />
            </PagBtn>
          </div>
        </div>
      )}

      {activityModal && (
        <ActivityModal
          dayId={activityModal.dayId}
          dayLabel={activityModal.dayLabel}
          activity={activityModal.activity}
          onClose={() => setActivityModal(null)}
        />
      )}
      {evidenceModal && (
        <AuxEvidenceModal
          activityId={evidenceModal.activityId}
          label={evidenceModal.label}
          onClose={() => setEvidenceModal(null)}
        />
      )}
    </div>
  );
}

function StatCard({
  label, value, accent, big, hint,
}: {
  label: string; value: string | number;
  accent?: boolean; big?: boolean; hint?: string;
}) {
  return (
    <div className="rounded-xl border border-[#1E1E1E] bg-[#0D0D0D] p-4">
      <div className="text-xs text-[#666]">{label}</div>
      <div className={`mt-1 font-bold ${big ? 'text-2xl' : 'text-xl'} ${
        accent ? 'text-[#FF6B2B]' : 'text-white'
      }`}>
        {value}
      </div>
      {hint && <div className="mt-0.5 text-[10px] text-[#555]">{hint}</div>}
    </div>
  );
}

function PagBtn({
  children, disabled, onClick, title,
}: {
  children: React.ReactNode; disabled: boolean; onClick: () => void; title: string;
}) {
  return (
    <button title={title} onClick={onClick} disabled={disabled}
      className="rounded-md border border-[#2A2A2A] p-1.5 text-[#888] transition-colors hover:border-[#FF6B2B]/40 hover:text-[#FF6B2B] disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:border-[#2A2A2A] disabled:hover:text-[#888]">
      {children}
    </button>
  );
}
