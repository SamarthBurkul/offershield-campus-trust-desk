import clsx from 'clsx'
import { useRef } from 'react'

/**
 * Underline tabs with optional count chips. `tabs`: [{ value, label, count? }]. Arrow Left/Right, Home and End
 * move between tabs and select them (automatic activation); only the selected tab is in the Tab order.
 * The count is part of the accessible name as "Label (n)".
 */
export function Tabs({ label, tabs, value, onChange, className, size = 'md' }) {
  const listRef = useRef(null)

  function onKeyDown(event) {
    const index = tabs.findIndex((tab) => tab.value === value)
    const go = (next) => {
      event.preventDefault()
      const target = (next + tabs.length) % tabs.length
      onChange(tabs[target].value)
      listRef.current?.querySelectorAll('[role="tab"]')[target]?.focus()
    }
    if (event.key === 'ArrowRight') go(index + 1)
    else if (event.key === 'ArrowLeft') go(index - 1)
    else if (event.key === 'Home') go(0)
    else if (event.key === 'End') go(tabs.length - 1)
  }

  return (
    <div className={clsx('-mb-px overflow-x-auto', className)}>
      <div ref={listRef} role="tablist" aria-label={label} onKeyDown={onKeyDown} className="flex min-w-max gap-1 border-b border-slate-200">
        {tabs.map((tab) => {
          const selected = tab.value === value
          return (
            <button
              key={tab.value}
              type="button"
              role="tab"
              data-value={tab.value}
              aria-selected={selected}
              tabIndex={selected ? 0 : -1}
              aria-label={tab.count != null ? `${tab.label} (${tab.count})` : undefined}
              onClick={() => onChange(tab.value)}
              className={clsx(
                'inline-flex items-center gap-2 border-b-2 font-medium transition-colors duration-150 focus-visible:outline-offset-[-2px]',
                size === 'sm' ? 'px-2.5 py-2 text-xs' : 'px-3 py-2.5 text-sm',
                selected ? 'border-accent-600 text-accent-700' : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-800',
              )}
            >
              {tab.icon && <tab.icon className="h-4 w-4" aria-hidden="true" />}
              {tab.label}
              {tab.count != null && (
                <span
                  aria-hidden="true"
                  className={clsx(
                    'rounded-full px-1.5 py-px text-[11px] font-semibold tabular-nums',
                    selected ? 'bg-accent-100 text-accent-800' : 'bg-slate-100 text-slate-600',
                  )}
                >
                  {tab.count}
                </span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
