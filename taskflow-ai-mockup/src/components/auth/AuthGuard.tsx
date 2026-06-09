import { Navigate, useLocation } from 'react-router-dom'

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const location = useLocation()
  const isLoggedIn = !!localStorage.getItem('access_token')
  if (!isLoggedIn) {
    return <Navigate to="/login" state={{ from: location.pathname + location.search }} replace />
  }
  return <>{children}</>
}
