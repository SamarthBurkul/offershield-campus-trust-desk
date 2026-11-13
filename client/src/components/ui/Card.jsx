import clsx from 'clsx'

/**
 * Surface card. With `title` it renders a header (title, optional description, icon and actions) and a body;
 * without it, children are padded directly.
 */
export function Card({ title, description, icon: Icon, actions, className, bodyClassName, padded = true, interactive = false, children, ...props }) {
  return (
    <section
      className={clsx(
        'rounded-2xl bg-white shadow-card ring-1 ring-slate-900/5',
        interactive && 'transition duration-150 hover:-translate-y-0.5 hover:shadow-raised',
        className,
      )}
      {...props}
    >
      {(title || actions) && <CardHeader title={title} description={description} icon={Icon} actions={actions} />}
      <CardBody className={clsx(!padded && 'p-0', bodyClassName)}>{children}</CardBody>
    </section>
  )
}

export function CardHeader({ title, description, icon: Icon, actions, className }) {
  return (
    <div className={clsx('flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-5 py-4', className)}>
      <div className="flex min-w-0 items-start gap-3">
        {Icon && (
          <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700" aria-hidden="true">
            <Icon className="h-4 w-4" />
          </span>
        )}
        <div className="min-w-0">
          {title && <h2 className="text-base font-semibold tracking-tight text-slate-900">{title}</h2>}
          {description && <p className="mt-0.5 text-sm text-slate-500">{description}</p>}
        </div>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

export function CardBody({ className, children }) {
  return <div className={clsx('space-y-4 p-5', className)}>{children}</div>
}
