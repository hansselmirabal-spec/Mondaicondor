import { Navigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const location = useLocation()
  const user = useAuthStore(state => state.user)
  const isLoggedIn = !!localStorage.getItem('access_token')

  if (!isLoggedIn) {
    return <Navigate to="/login" state={{ from: location.pathname + location.search }} replace />
  }

  if (user?.mustChangePassword) {
    return <Navigate to="/force-change-password" replace />
  }

  return <>{children}</>
}
