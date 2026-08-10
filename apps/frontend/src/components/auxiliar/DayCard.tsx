/**
 * DayCard.tsx — Un día como una tarjeta, con sus actividades dentro
 *
 * Misma forma que la tarjeta de semana de monitorías: encabezado con la
 * fecha y sus totales, y las actividades como filas limpias debajo. La
 * fecha aparece UNA vez; antes se repetía en cada fila y un mes activo se
 * leía como una lista interminable de fechas iguales.
 */
import {
  Plus, Trash2, Pencil, Paperclip, ExternalLink,
  CalendarDays, Clock, ClipboardList,
} from 'lucide-react';
import type { AuxiliaryDay, AuxiliaryActivity } from '@/types';

interface Props {
  day:            AuxiliaryDay;
  canEdit:        boolean;
  onAddActivity:  () => void;
  onEditActivity: (a: AuxiliaryActivity) => void;
  onDeleteActivity: (a: AuxiliaryActivity) => void;
  onAddEvidence:  (a: AuxiliaryActivity) => void;
  onDeleteEvidence: (evidenceId: string) => void;
  onDeleteDay:    () => void;
}

/** '4 de agosto de 2026' a partir de un 'YYYY-MM-DD'. */
function fechaLarga(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('es-CO', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });
}

export default function DayCard({
  day, canEdit, onAddActivity, onEditActivity, onDeleteActivity,
  onAddEvidence, onDeleteEvidence, onDeleteDay,
}: Props) {
  const vacio = day.activities.length === 0;

  return (
    <div className="overflow-hidden rounded-xl border border-[#1E1E1E] bg-[#0D0D0D]">
      {/* ── Encabezado del día ── */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#1E1E1E] bg-[#101010] px-4 py-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <CalendarDays size={14} className="flex-shrink-0 text-[#FF6B2B]" />
            <h3 className="truncate text-sm font-semibold capitalize text-white">
              {fechaLarga(day.logDate)}
            </h3>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-[#666]">
            <span className="flex items-center gap-1">
              <ClipboardList size={11} />
              {day.activityCount} actividad{day.activityCount === 1 ? '' : 'es'}
            </span>
            {/* Las horas solo se muestran si alguien las registró */}
            {day.totalHours !== null && (
              <span className="flex items-center gap-1 text-[#4ADE80]">
                <Clock size={11} /> {day.totalHours} h
              </span>
            )}
          </div>
        </div>

        {canEdit && (
          <div className="flex items-center gap-1.5">
            <button onClick={onAddActivity}
              className="flex items-center gap-1.5 rounded-lg bg-[#FF6B2B] px-3 py-1.5 text-xs font-medium text-white transition-opacity hover:opacity-90">
              <Plus size={13} /> Actividad
            </button>
            {/* Borrar el día solo si está vacío: el backend lo bloquea igual */}
            {vacio && (
              <button onClick={onDeleteDay} title="Eliminar día vacío"
                className="rounded-lg border border-[#2A2A2A] p-1.5 text-[#555] transition-colors hover:border-red-500/40 hover:text-red-400">
                <Trash2 size={13} />
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── Actividades ── */}
      {vacio ? (
        <div className="px-4 py-6 text-center">
          <p className="text-xs text-[#666]">
            Día abierto, sin actividades todavía.
          </p>
          {canEdit && (
            <p className="mt-1 text-xs text-[#555]">
              Usa “Actividad” para registrar lo que hiciste.
            </p>
          )}
        </div>
      ) : (
        <ul className="divide-y divide-[#1A1A1A]">
          {day.activities.map((a) => (
            <li key={a.id} className="px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm leading-snug text-white">{a.description}</p>

                  {/* De qué actividad del nodo forma parte */}
                  {a.isLinked && a.linkLabel && (
                    <p className="mt-1 flex items-center gap-1 text-xs text-[#38BDF8]">
                      <ExternalLink size={10} className="flex-shrink-0" />
                      <span className="truncate">{a.linkLabel}</span>
                    </p>
                  )}

                  {/* Funciones y tipos, como etiquetas */}
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {a.functions.map((f) => (
                      <span key={f.id}
                        className="rounded border border-[#FF6B2B]/25 bg-[#FF6B2B]/5 px-1.5 py-0.5 text-[10px] text-[#FF6B2B]">
                        {f.name}
                      </span>
                    ))}
                    {a.types.map((t) => (
                      <span key={t.id}
                        className="rounded border border-[#2A2A2A] px-1.5 py-0.5 text-[10px] text-[#888]">
                        {t.name}
                      </span>
                    ))}
                  </div>

                  {/* Evidencias */}
                  {a.evidences.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {a.evidences.map((e) => (
                        <span key={e.id}
                          className="group inline-flex items-center gap-1 rounded border border-[#2A2A2A] bg-[#141414] px-1.5 py-0.5 text-[10px] text-[#888]">
                          <a href={e.fileUrl} target="_blank" rel="noopener noreferrer"
                            className="flex items-center gap-1 transition-colors hover:text-[#38BDF8]">
                            <Paperclip size={9} />
                            {e.caption?.trim() || 'Evidencia'}
                          </a>
                          {canEdit && (
                            <button onClick={() => onDeleteEvidence(e.id)} title="Quitar evidencia"
                              className="text-[#444] transition-colors hover:text-red-400">
                              <Trash2 size={9} />
                            </button>
                          )}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex flex-shrink-0 items-center gap-2">
                  {a.hours !== null && (
                    <span className="whitespace-nowrap text-xs text-[#4ADE80]">{a.hours} h</span>
                  )}
                  {canEdit && (
                    <div className="flex items-center gap-0.5">
                      <IconBtn title="Adjuntar evidencia" onClick={() => onAddEvidence(a)}>
                        <Paperclip size={13} />
                      </IconBtn>
                      <IconBtn title="Editar" onClick={() => onEditActivity(a)}>
                        <Pencil size={13} />
                      </IconBtn>
                      <IconBtn title="Eliminar" danger onClick={() => onDeleteActivity(a)}>
                        <Trash2 size={13} />
                      </IconBtn>
                    </div>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function IconBtn({
  children, title, onClick, danger,
}: {
  children: React.ReactNode; title: string; onClick: () => void; danger?: boolean;
}) {
  return (
    <button title={title} onClick={onClick}
      className={`rounded p-1.5 text-[#555] transition-colors ${
        danger ? 'hover:text-red-400' : 'hover:text-white'
      }`}>
      {children}
    </button>
  );
}
