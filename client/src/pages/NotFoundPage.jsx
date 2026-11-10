import { Link } from 'react-router-dom'

export default function NotFoundPage() {
  return (
    <section className="space-y-3 text-center">
      <h1 className="text-2xl font-bold text-slate-900">Page not found</h1>
      <p className="text-slate-600">The page you are looking for does not exist.</p>
      <Link to="/" className="inline-block font-medium text-blue-700 hover:underline">
        Back to home
      </Link>
    </section>
  )
}
