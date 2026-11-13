import { CheckCircle2 } from 'lucide-react'

/**
 * Split auth layout: navy brand panel with value points (left, from lg) and the form card (right).
 * Stacks on mobile with a compact brand band on top.
 */
export default function AuthLayout({ eyebrow, title, description, points = [], children }) {
  return (
    <div className="grid grid-cols-1 min-h-[calc(100vh-4rem)] lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <section className="hero-band relative overflow-hidden px-6 py-10 text-white sm:px-10 lg:px-14 lg:py-16">
        <div className="mx-auto max-w-md space-y-6 lg:mx-0 lg:mt-8">
          {eyebrow && <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent-200">{eyebrow}</p>}
          <p className="text-2xl font-semibold leading-tight tracking-tight sm:text-3xl">{description}</p>
          {points.length > 0 && (
            <ul className="hidden space-y-4 sm:block">
              {points.map((point) => (
                <li key={point.title} className="flex gap-3">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-accent-300" aria-hidden="true" />
                  <span>
                    <span className="block font-medium text-white">{point.title}</span>
                    <span className="block text-sm leading-6 text-brand-200">{point.body}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
      <section className="flex items-start justify-center bg-slate-50 px-4 py-10 sm:px-8 lg:items-center lg:py-16">
        <div className="w-full max-w-md space-y-6">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">{title}</h1>
          {children}
        </div>
      </section>
    </div>
  )
}
