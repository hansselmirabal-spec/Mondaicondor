import { RouterProvider } from 'react-router-dom'
import { router } from './router'
import { ErrorBoundary } from '@/components/ui/ErrorBoundary'

export function Providers() {
  return (
    <ErrorBoundary>
      <RouterProvider router={router} />
    </ErrorBoundary>
  )
}
