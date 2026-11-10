import { Link, Outlet } from 'react-router-dom'

export default function Layout() {
  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-800">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-4xl px-4 py-4">
          <Link to="/" className="text-lg font-semibold text-blue-900">
            OfferShield — Campus Trust Desk
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-10">
        <Outlet />
      </main>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto max-w-4xl px-4 py-4 text-sm text-slate-500">
          OfferShield helps placement teams verify recruitment offers. Automated checks assist staff; they
          never decide whether an offer is genuine.
        </div>
      </footer>
    </div>
  )
}
