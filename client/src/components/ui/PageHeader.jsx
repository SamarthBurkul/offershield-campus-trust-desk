import clsx from 'clsx'
import { ChevronRight } from 'lucide-react'
import { Link } from 'react-router-dom'

/** Page title row: optional breadcrumb [{ label, to? }], title (h1), description and actions. */
export function PageHeader({ title, description, actions, breadcrumb, eyebrow, className, children }) {
  return (
    <div className={clsx('space-y-3', className)}>
      {breadcrumb?.length > 0 && (
        <nav aria-label="Breadcrumb">
          <ol className="flex flex-wrap items-center gap-1 text-sm text-slate-500">
            {breadcrumb.map((item, index) => (
              <li key={item.label} className="flex items-center gap-1">
                {index > 0 && <ChevronRight className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />}
                {item.to ? (
                  <Link to={item.to} className="font-medium text-slate-600 transition hover:text-accent-700">
                    {item.label}
                  </Link>
                ) : (
                  <span aria-current="page">{item.label}</span>
                )}
              </li>
            ))}
          </ol>
        </nav>
      )}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0 space-y-1">
          {eyebrow && <p className="text-xs font-semibold uppercase tracking-wider text-accent-700">{eyebrow}</p>}
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">{title}</h1>
          {description && <div className="max-w-3xl text-sm text-slate-600 sm:text-[15px]">{description}</div>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {children}
    </div>
  )
}
