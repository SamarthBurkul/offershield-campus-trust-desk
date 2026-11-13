// Non-component helpers shared by the design-system components.
import clsx from 'clsx'
import { FileImage, FileText } from 'lucide-react'

export const BUTTON_VARIANTS = {
  primary: 'bg-accent-600 text-white shadow-sm hover:bg-accent-700 active:bg-accent-800 disabled:bg-accent-300',
  secondary:
    'bg-white text-slate-800 shadow-sm ring-1 ring-inset ring-slate-300 hover:bg-slate-50 hover:ring-slate-400 disabled:text-slate-400 disabled:ring-slate-200',
  ghost: 'text-slate-700 hover:bg-slate-100 hover:text-slate-900 disabled:text-slate-400',
  danger: 'bg-rose-600 text-white shadow-sm hover:bg-rose-700 active:bg-rose-800 disabled:bg-rose-300',
  success: 'bg-emerald-600 text-white shadow-sm hover:bg-emerald-700 active:bg-emerald-800 disabled:bg-emerald-300',
}

const SIZES = {
  sm: 'h-8 gap-1.5 rounded-lg px-3 text-xs',
  md: 'h-10 gap-2 rounded-xl px-4 text-sm',
  lg: 'h-12 gap-2 rounded-xl px-5 text-[15px]',
}

export const ICON_SIZES = { sm: 'h-3.5 w-3.5', md: 'h-4 w-4', lg: 'h-5 w-5' }

/** Class string shared by buttons and button-styled links. */
export function buttonClasses({ variant = 'primary', size = 'md', className } = {}) {
  return clsx(
    'inline-flex shrink-0 items-center justify-center whitespace-nowrap font-medium transition-colors duration-150 select-none disabled:cursor-not-allowed',
    BUTTON_VARIANTS[variant] ?? BUTTON_VARIANTS.primary,
    SIZES[size] ?? SIZES.md,
    className,
  )
}

export function initialsOf(name = '') {
  const parts = String(name ?? '')
    .replace(/[^\p{L}\p{N} ]/gu, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  if (parts.length === 0) return '?'
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase()
}


/** Icon for an evidence file name (PDF vs image). */
export const fileIconFor = (name = '') => (/.pdf$/i.test(name) ? FileText : FileImage)
