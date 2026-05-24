/**
 * Pagination.tsx — Componente de paginación reutilizable
 * Máximo 10 ítems por página por defecto
 *
 * Uso:
 *   const { page, pageSize, paginated, PaginationUI } = usePagination(items, 10);
 *   return <>{paginated.map(...)} <PaginationUI /></>;
 */
import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

// ── Hook de paginación ────────────────────────────────────
export function usePagination<T>(items: T[], pageSize = 10) {
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const safePage   = Math.min(page, totalPages);
  const start      = (safePage - 1) * pageSize;
  const paginated  = items.slice(start, start + pageSize);

  const PaginationUI = () => (
    <PaginationComponent
      page={safePage}
      totalPages={totalPages}
      total={items.length}
      pageSize={pageSize}
      onPage={setPage}
    />
  );

  return { page: safePage, pageSize, paginated, totalPages, setPage, PaginationUI };
}

// ── Componente visual ─────────────────────────────────────
interface Props {
  page: number;
  totalPages: number;
  total: number;
  pageSize: number;
  onPage: (p: number) => void;
}

export default function PaginationComponent({ page, totalPages, total, pageSize, onPage }: Props) {
  if (totalPages <= 1) return null;

  const start = (page - 1) * pageSize + 1;
  const end   = Math.min(page * pageSize, total);

  // Generar rango de páginas a mostrar
  const pages: (number | '...')[] = [];
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i);
  } else {
    pages.push(1);
    if (page > 3) pages.push('...');
    for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) {
      pages.push(i);
    }
    if (page < totalPages - 2) pages.push('...');
    pages.push(totalPages);
  }

  return (
    <div className="flex items-center justify-between px-4 py-3 border-t border-[#1E1E1E]">
      <span className="text-xs text-[#555]">
        Mostrando {start}–{end} de {total}
      </span>

      <div className="flex items-center gap-1">
        <button
          onClick={() => onPage(page - 1)}
          disabled={page === 1}
          className="p-1.5 text-[#555] hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronLeft size={16} />
        </button>

        {pages.map((p, i) =>
          p === '...' ? (
            <span key={`ellipsis-${i}`} className="px-2 text-[#444] text-sm">…</span>
          ) : (
            <button
              key={p}
              onClick={() => onPage(p as number)}
              className={`min-w-[32px] h-8 text-xs rounded-lg transition-colors ${
                p === page
                  ? 'bg-[#FF6B2B] text-white font-semibold'
                  : 'text-[#666] hover:text-white hover:bg-[#1A1A1A]'
              }`}
            >
              {p}
            </button>
          )
        )}

        <button
          onClick={() => onPage(page + 1)}
          disabled={page === totalPages}
          className="p-1.5 text-[#555] hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}
