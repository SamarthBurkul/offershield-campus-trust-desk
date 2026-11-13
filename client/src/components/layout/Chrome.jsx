import clsx from 'clsx'
import { ChevronDown, KeyRound, LogOut, Search, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { errorMessage } from '../../api/errors.js'
import { lookup } from '../../api/lookup.js'
import { ROLE_LABELS } from '../../auth/roles.js'
import { useAuth } from '../../auth/useAuth.js'
import LookupResultCard from '../LookupResultCard.jsx'
import { Avatar, DropdownMenu, Spinner } from '../ui/index.js'

/** Footer shared by every layout: the product disclaimer (contract text) and the legal links. */
export function SiteFooter({ tone = 'light', className }) {
  return (
    <footer className={clsx('border-t', tone === 'dark' ? 'border-white/10 bg-brand-950 text-brand-200' : 'border-slate-200 bg-white text-slate-500', className)}>
      <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-3 px-6 py-5 text-sm lg:px-8">
        <p>OfferShield helps your placement cell review opportunities. It never certifies an offer as safe.</p>
        <nav aria-label="Legal" className="flex gap-5">
          <Link to="/privacy" className={clsx('transition', tone === 'dark' ? 'hover:text-white' : 'hover:text-accent-700')}>
            Privacy
          </Link>
          <Link to="/terms" className={clsx('transition', tone === 'dark' ? 'hover:text-white' : 'hover:text-accent-700')}>
            Terms
          </Link>
        </nav>
      </div>
    </footer>
  )
}

/** Avatar menu: name, role, change password and log out. */
export function UserMenu({ tone = 'light', compact = false }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  if (!user) return null

  async function handleLogout() {
    await logout()
    navigate('/login', { replace: true })
  }

  return (
    <DropdownMenu
      label={`Account menu for ${user.name}`}
      buttonClassName={clsx('py-1 pl-1 pr-2', tone === 'dark' ? 'text-white hover:bg-white/10' : 'text-slate-700 hover:bg-slate-100')}
      trigger={
        <>
          <Avatar name={user.name} size="sm" />
          <span className={clsx('hidden text-left leading-tight md:block', compact && 'md:hidden xl:block')}>
            <span className={clsx('block text-sm font-medium', tone === 'dark' ? 'text-white' : 'text-slate-900')}>{user.name}</span>
            <span className={clsx('block text-xs', tone === 'dark' ? 'text-brand-200' : 'text-slate-500')}>{ROLE_LABELS[user.role]}</span>
          </span>
          <ChevronDown className={clsx('h-4 w-4', tone === 'dark' ? 'text-brand-200' : 'text-slate-400')} aria-hidden="true" />
        </>
      }
      header={
        <div className="border-b border-slate-100 px-3.5 pb-2.5 pt-1.5">
          <p className="truncate text-sm font-medium text-slate-900">{user.name}</p>
          <p className="truncate text-xs text-slate-500">{user.email}</p>
        </div>
      }
      items={[
        !user.mustChangePassword && { label: 'Change password', icon: KeyRound, onSelect: () => navigate('/change-password') },
        { label: 'Log out', icon: LogOut, tone: 'danger', onSelect: handleLogout },
      ]}
    />
  )
}

/** Staff top-bar lookup: the same "check before you pay" API, result in a popover panel. */
export function QuickLookup() {
  const [query, setQuery] = useState('')
  const [state, setState] = useState(null)
  const containerRef = useRef(null)

  useEffect(() => {
    if (!state) return undefined
    const onDown = (event) => containerRef.current && !containerRef.current.contains(event.target) && setState(null)
    const onKey = (event) => event.key === 'Escape' && setState(null)
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [state])

  async function submit(event) {
    event.preventDefault()
    const q = query.trim()
    if (q.length < 3) {
      setState({ error: 'Enter at least 3 characters.' })
      return
    }
    setState({ busy: true })
    try {
      setState({ result: await lookup(q), query: q })
    } catch (err) {
      setState({ error: errorMessage(err, 'The lookup is unavailable right now. Please try again.') })
    }
  }

  return (
    <div ref={containerRef} className="relative w-full max-w-md">
      <form role="search" aria-label="Quick lookup" onSubmit={submit}>
        <label htmlFor="quick-lookup" className="sr-only">
          Quick lookup: company, website, email, phone or UPI ID
        </label>
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
        <input
          id="quick-lookup"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Quick lookup — UPI ID, domain, phone…"
          className="h-10 w-full rounded-xl border-0 bg-slate-100 pl-9 pr-9 text-sm text-slate-900 ring-1 ring-inset ring-transparent transition placeholder:text-slate-400 hover:bg-slate-200/70 focus:bg-white focus:outline-none focus:ring-2 focus:ring-accent-500"
        />
        {state?.busy && <Spinner className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />}
      </form>
      {state && !state.busy && (
        <div className="absolute left-0 right-0 z-40 mt-2 animate-pop-in rounded-2xl bg-white p-3 shadow-raised ring-1 ring-slate-900/10 sm:min-w-[26rem]">
          <div className="mb-2 flex items-center justify-between px-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Lookup</p>
            <button type="button" aria-label="Close lookup" onClick={() => setState(null)} className="rounded-md p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700">
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
          {state.error ? (
            <p role="alert" className="px-1 pb-1 text-sm text-rose-700">
              {state.error}
            </p>
          ) : (
            <LookupResultCard result={state.result} query={state.query} showAskButton={false} />
          )}
        </div>
      )}
    </div>
  )
}
