import clsx from 'clsx'
import { useEffect, useId, useRef, useState } from 'react'

/**
 * Accessible menu button. `items`: [{ label, onSelect, icon?, tone?: 'danger', disabled?, href? }] (falsy items
 * skipped); `trigger` renders the button content. Arrow keys / Home / End move between items, Escape closes and
 * returns focus to the button, a click outside closes.
 */
export function DropdownMenu({ label, trigger, items, align = 'right', buttonClassName, menuClassName, header }) {
  const [open, setOpen] = useState(false)
  const menuId = useId()
  const buttonRef = useRef(null)
  const menuRef = useRef(null)
  const visible = items.filter(Boolean)

  useEffect(() => {
    if (!open) return undefined
    const first = menuRef.current?.querySelector('[role="menuitem"]:not([disabled])')
    first?.focus()
    const onDown = (event) => {
      if (!menuRef.current?.contains(event.target) && !buttonRef.current?.contains(event.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  function onMenuKey(event) {
    const entries = [...menuRef.current.querySelectorAll('[role="menuitem"]:not([disabled])')]
    const index = entries.indexOf(document.activeElement)
    const move = (to) => {
      event.preventDefault()
      entries[(to + entries.length) % entries.length]?.focus()
    }
    if (event.key === 'ArrowDown') move(index + 1)
    else if (event.key === 'ArrowUp') move(index - 1)
    else if (event.key === 'Home') move(0)
    else if (event.key === 'End') move(entries.length - 1)
    else if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      setOpen(false)
      buttonRef.current?.focus()
    } else if (event.key === 'Tab') setOpen(false)
  }

  return (
    <div className="relative inline-block text-left">
      <button
        ref={buttonRef}
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((value) => !value)}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown' && !open) {
            event.preventDefault()
            setOpen(true)
          }
        }}
        className={clsx(
          'inline-flex items-center gap-2 rounded-xl transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-500',
          buttonClassName,
        )}
      >
        {trigger}
      </button>
      {open && (
        <div
          ref={menuRef}
          id={menuId}
          role="menu"
          aria-label={label}
          onKeyDown={onMenuKey}
          className={clsx(
            'absolute z-40 mt-2 min-w-48 animate-pop-in overflow-hidden rounded-xl bg-white py-1 shadow-raised ring-1 ring-slate-900/10',
            align === 'right' ? 'right-0 origin-top-right' : 'left-0 origin-top-left',
            menuClassName,
          )}
        >
          {header}
          {visible.map((item) => {
            const Icon = item.icon
            return (
              <button
                key={item.label}
                type="button"
                role="menuitem"
                tabIndex={-1}
                disabled={item.disabled}
                onClick={() => {
                  setOpen(false)
                  item.onSelect?.()
                }}
                className={clsx(
                  'flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-sm transition-colors duration-150 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50',
                  item.tone === 'danger' ? 'text-rose-700 hover:bg-rose-50 focus:bg-rose-50' : 'text-slate-700 hover:bg-slate-50 focus:bg-slate-100',
                )}
              >
                {Icon && <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />}
                {item.label}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

/** Lightweight tooltip: the exact text is also the native `title`, so it works with mouse and long-press. */
export function Tooltip({ content, children, className }) {
  return (
    <span title={content} className={clsx('cursor-help', className)}>
      {children}
    </span>
  )
}
