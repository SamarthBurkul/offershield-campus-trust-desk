import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from './Button.jsx'

/** Previous / next pager with a "Page x of y" summary. Renders nothing for a single page. */
export function Pagination({ page, totalPages, summary, onPage }) {
  if (totalPages <= 1) return null
  return (
    <nav aria-label="Pagination" className="flex items-center justify-between gap-3 border-t border-slate-100 px-5 py-3 text-sm">
      <Button variant="secondary" size="sm" icon={ChevronLeft} disabled={page <= 1} onClick={() => onPage(page - 1)}>
        Previous
      </Button>
      <span className="text-slate-600 tabular-nums">
        Page {page} of {totalPages}
        {summary ? ` · ${summary}` : ''}
      </span>
      <Button variant="secondary" size="sm" iconRight={ChevronRight} disabled={page >= totalPages} onClick={() => onPage(page + 1)}>
        Next
      </Button>
    </nav>
  )
}
