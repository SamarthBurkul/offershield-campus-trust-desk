import clsx from 'clsx'
import { useId } from 'react'

/** The OfferShield mark: a shield with a check. (The only place hex colours are allowed, per DESIGN_SYSTEM.md.) */
export function LogoMark({ className = 'h-8 w-8' }) {
  const gradient = useId()
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={gradient} x1="6" y1="3" x2="26" y2="29" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#5a7ffb" />
          <stop offset="1" stopColor="#233fb5" />
        </linearGradient>
      </defs>
      <path d="M16 2.5 5 6.6v8.2c0 7.1 4.7 12.3 11 14.7 6.3-2.4 11-7.6 11-14.7V6.6L16 2.5Z" fill={`url(#${gradient})`} />
      <path d="M16 2.5 5 6.6v8.2c0 7.1 4.7 12.3 11 14.7" fill="#ffffff" fillOpacity="0.08" />
      <path d="m11 16.4 3.6 3.6L21.4 13" fill="none" stroke="#ffffff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/**
 * Mark + "OfferShield" wordmark. Screen readers hear the full product name.
 * `tone="light"` for dark (navy) backgrounds.
 */
export function Logo({ tone = 'dark', tagline = false, className }) {
  return (
    <span className={clsx('inline-flex items-center gap-2.5', className)}>
      <LogoMark />
      <span className="sr-only">OfferShield — Campus Trust Desk</span>
      <span aria-hidden="true" className="leading-tight">
        <span className={clsx('block text-[17px] font-semibold tracking-tight', tone === 'light' ? 'text-white' : 'text-brand-950')}>OfferShield</span>
        {tagline && (
          <span className={clsx('block text-[11px] font-medium uppercase tracking-[0.14em]', tone === 'light' ? 'text-brand-200' : 'text-slate-500')}>
            Campus Trust Desk
          </span>
        )}
      </span>
    </span>
  )
}
