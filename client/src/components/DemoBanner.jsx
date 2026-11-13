import { FlaskConical } from 'lucide-react'
import { useAuth } from '../auth/useAuth.js'

/** Slim strip for accounts in a demo college (isDemo), so sample data is never mistaken for real cases. */
export default function DemoBanner() {
  const { college } = useAuth()
  if (!college?.isDemo) return null
  return (
    <div role="note" className="flex items-center justify-center gap-2 bg-amber-100 px-4 py-1 text-center text-xs font-medium text-amber-950">
      <FlaskConical className="h-3.5 w-3.5" aria-hidden="true" />
      Demo environment — sample data
    </div>
  )
}
