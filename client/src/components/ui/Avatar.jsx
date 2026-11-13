import clsx from 'clsx'
import { initialsOf } from './styles.js'

const PALETTE = [
  'bg-brand-100 text-brand-800',
  'bg-accent-100 text-accent-800',
  'bg-emerald-100 text-emerald-800',
  'bg-amber-100 text-amber-900',
  'bg-sky-100 text-sky-800',
  'bg-violet-100 text-violet-800',
  'bg-rose-100 text-rose-800',
  'bg-teal-100 text-teal-800',
]

function colourOf(name = '') {
  let hash = 0
  for (const char of String(name ?? '')) hash = (hash * 31 + char.codePointAt(0)) >>> 0
  return PALETTE[hash % PALETTE.length]
}

/** Initials avatar with a colour derived from the name (stable across renders and sessions). Decorative. */
export function Avatar({ name, size = 'md', className }) {
  const box = { xs: 'h-6 w-6 text-[10px]', sm: 'h-7 w-7 text-[11px]', md: 'h-9 w-9 text-xs', lg: 'h-11 w-11 text-sm' }[size]
  return (
    <span aria-hidden="true" className={clsx('inline-flex shrink-0 select-none items-center justify-center rounded-full font-semibold', box, colourOf(name), className)}>
      {initialsOf(name)}
    </span>
  )
}
