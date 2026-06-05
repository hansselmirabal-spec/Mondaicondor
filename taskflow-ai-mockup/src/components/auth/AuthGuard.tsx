import { Navigate } from 'react-router-dom'

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const isLoggedIn = !!localStorage.getItem('access_token')
  if (!isLoggedIn) return <Navigate to="/login" replace />
  return <>{children}</>
}
