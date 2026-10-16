import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from './Button.jsx';

export function Pagination({ meta, onPageChange, disabled }) {
  if (!meta || meta.total === 0) return null;
  const { page, limit, total, totalPages } = meta;
  const from = (page - 1) * limit + 1;
  const to = Math.min(page * limit, total);

  return (
    <nav aria-label="Pagination" className="flex items-center justify-between gap-3 border-t border-slate-100 px-5 py-3">
      <p className="text-xs text-slate-500">
        Showing{' '}
        <span className="font-medium text-slate-700">
          {from}–{to}
        </span>{' '}
        of <span className="font-medium text-slate-700">{total}</span>
      </p>
      <div className="flex items-center gap-2">
        <Button
          variant="secondary"
          size="sm"
          disabled={disabled || page <= 1}
          onClick={() => onPageChange(page - 1)}
          aria-label="Previous page"
        >
          <ChevronLeft className="size-4" />
        </Button>
        <span className="text-xs text-slate-600 tabular-nums">
          {page} / {totalPages}
        </span>
        <Button
          variant="secondary"
          size="sm"
          disabled={disabled || page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          aria-label="Next page"
        >
          <ChevronRight className="size-4" />
        </Button>
      </div>
    </nav>
  );
}
