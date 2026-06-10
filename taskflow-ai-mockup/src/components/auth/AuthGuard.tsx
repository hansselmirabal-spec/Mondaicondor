import { Navigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const location = useLocation()
  const user = useAuthStore(state => state.user)
  const initialized = useAuthStore(state => state.initialized)
  const hasToken = !!localStorage.getItem('access_token')

  if (!hasToken) {
    return <Navigate to="/login" state={{ from: location.pathname + location.search }} replace />
  }

  if (!initialized) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-screen">
        <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location.pathname + location.search }} replace />
  }

  if (user.mustChangePassword) {
    return <Navigate to="/force-change-password" replace />
  }

  return <>{children}</>
}
