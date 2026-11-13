import { ArrowLeft, Compass } from 'lucide-react'
import { ButtonLink, EmptyState } from '../components/ui/index.js'
import usePageTitle from '../hooks/usePageTitle.js'

export default function NotFoundPage() {
  usePageTitle('Page not found')
  return (
    <div className="mx-auto max-w-xl py-10">
      <EmptyState
        icon={Compass}
        as="h1"
        title="Page not found"
        action={
          <ButtonLink to="/" variant="secondary" icon={ArrowLeft}>
            Back to home
          </ButtonLink>
        }
      >
        The page you are looking for does not exist.
      </EmptyState>
    </div>
  )
}
