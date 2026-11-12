import { useAuth } from '../auth/useAuth.js'

/** Thin notice for accounts in a demo college (isDemo), so sample data is never mistaken for real cases. */
export default function DemoBanner() {
  const { college } = useAuth()
  if (!college?.isDemo) return null
  return (
    <div role="note" className="bg-amber-100 px-4 py-1 text-center text-xs font-medium text-amber-900">
      Demo environment — sample data
    </div>
  )
}
