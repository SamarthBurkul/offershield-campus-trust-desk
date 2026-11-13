import { FileText } from 'lucide-react'

const slug = (title) =>
  title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')

/** A titled section of a legal page; its id feeds the table of contents. */
export function LegalSection({ title, children }) {
  return (
    <section aria-labelledby={slug(title)}>
      <h2 id={slug(title)}>{title}</h2>
      {children}
    </section>
  )
}

/** Readable legal page: header card, sticky table of contents (lg) and prose column. */
export default function LegalLayout({ title, version, intro, sections, children }) {
  return (
    <article className="space-y-8">
      <header className="flex flex-wrap items-start gap-4 rounded-2xl bg-white p-6 shadow-card ring-1 ring-slate-900/5">
        <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-700" aria-hidden="true">
          <FileText className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1 space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">{title}</h1>
          <p className="text-sm text-slate-500">Version {version}</p>
        </div>
      </header>
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[220px_minmax(0,1fr)]">
        <nav aria-label="On this page" className="lg:sticky lg:top-24 lg:self-start">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">On this page</p>
          <ol className="space-y-1 border-l border-slate-200 text-sm">
            {sections.map((section) => (
              <li key={section}>
                <a href={`#${slug(section)}`} className="-ml-px block border-l border-transparent py-1 pl-3 text-slate-600 transition hover:border-accent-500 hover:text-accent-700">
                  {section}
                </a>
              </li>
            ))}
          </ol>
        </nav>
        <div className="prose-doc max-w-3xl rounded-2xl bg-white p-6 shadow-card ring-1 ring-slate-900/5 sm:p-8 [&>section:first-of-type>h2]:mt-0">
          {intro && <p className="mb-2">{intro}</p>}
          {children}
        </div>
      </div>
    </article>
  )
}
