import clsx from 'clsx'
import { Link } from 'react-router-dom'
import { Spinner } from './Spinner.jsx'
import { BUTTON_VARIANTS, ICON_SIZES, buttonClasses } from './styles.js'

/**
 * Button. `loading` shows a spinner and disables it; `icon` is a lucide component rendered before the label.
 * Defaults to type="button" so it never submits a form by accident.
 */
export function Button({ variant = 'primary', size = 'md', loading = false, icon: Icon, iconRight: IconRight, className, children, disabled, ...props }) {
  return (
    <button type="button" className={buttonClasses({ variant, size, className })} disabled={disabled || loading} {...props}>
      {loading ? <Spinner /> : Icon && <Icon className={ICON_SIZES[size]} aria-hidden="true" />}
      {children}
      {IconRight && <IconRight className={ICON_SIZES[size]} aria-hidden="true" />}
    </button>
  )
}

/** A react-router Link styled as a button. */
export function ButtonLink({ variant = 'primary', size = 'md', icon: Icon, iconRight: IconRight, className, children, ...props }) {
  return (
    <Link className={buttonClasses({ variant, size, className })} {...props}>
      {Icon && <Icon className={ICON_SIZES[size]} aria-hidden="true" />}
      {children}
      {IconRight && <IconRight className={ICON_SIZES[size]} aria-hidden="true" />}
    </Link>
  )
}

/** Square icon-only button; `label` becomes its accessible name (and tooltip). */
export function IconButton({ icon: Icon, label, variant = 'ghost', size = 'md', className, children, ...props }) {
  const box = { sm: 'h-8 w-8 rounded-lg', md: 'h-10 w-10 rounded-xl', lg: 'h-12 w-12 rounded-xl' }[size]
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={clsx(
        'relative inline-flex shrink-0 items-center justify-center transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-50',
        BUTTON_VARIANTS[variant],
        box,
        className,
      )}
      {...props}
    >
      <Icon className={ICON_SIZES[size === 'sm' ? 'sm' : 'md']} aria-hidden="true" />
      {children}
    </button>
  )
}
