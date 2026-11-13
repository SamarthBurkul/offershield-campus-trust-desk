import clsx from 'clsx'

/**
 * Styled table. The wrapper scrolls horizontally on small screens; `stickyHeader` keeps the header visible
 * inside a height-limited wrapper; `density="compact"` tightens rows.
 */
export function Table({ children, className, density = 'normal', stickyHeader = false, maxHeight, label }) {
  return (
    <div
      className={clsx('overflow-x-auto', stickyHeader && 'overflow-y-auto', className)}
      style={maxHeight ? { maxHeight } : undefined}
      data-density={density}
      data-sticky={stickyHeader || undefined}
    >
      <table aria-label={label} className={clsx('w-full border-separate border-spacing-0 text-left text-sm', density === 'compact' ? '[&_td]:py-2 [&_th]:py-2' : '[&_td]:py-3 [&_th]:py-2.5')}>
        {children}
      </table>
    </div>
  )
}

export function THead({ children, sticky = false }) {
  return <thead className={clsx('bg-slate-50/80 text-xs font-semibold uppercase tracking-wide text-slate-500', sticky && 'sticky top-0 z-10 backdrop-blur')}>{children}</thead>
}

export function TBody({ children }) {
  return <tbody className="[&>tr:last-child>td]:border-b-0">{children}</tbody>
}

export function Th({ children, className, ...props }) {
  return (
    <th scope="col" className={clsx('border-b border-slate-200 px-4 font-semibold first:pl-5 last:pr-5', className)} {...props}>
      {children}
    </th>
  )
}

export function Td({ children, className, ...props }) {
  return (
    <td className={clsx('border-b border-slate-100 px-4 align-middle first:pl-5 last:pr-5', className)} {...props}>
      {children}
    </td>
  )
}

const INTERACTIVE = 'a, button, input, select, textarea, label, summary, [role="menuitem"]'

/**
 * Table row. With `onActivate`, the whole row is clickable (for mouse users) while the real link/button
 * inside the row remains the keyboard and screen-reader target.
 */
export function Tr({ children, className, onActivate, muted = false, ...props }) {
  return (
    <tr
      className={clsx(
        'transition-colors duration-150',
        onActivate && 'cursor-pointer hover:bg-accent-50/40',
        !onActivate && 'hover:bg-slate-50/70',
        muted && 'text-slate-400',
        className,
      )}
      onClick={
        onActivate
          ? (event) => {
              if (event.target.closest(INTERACTIVE)) return
              onActivate(event)
            }
          : undefined
      }
      {...props}
    >
      {children}
    </tr>
  )
}
