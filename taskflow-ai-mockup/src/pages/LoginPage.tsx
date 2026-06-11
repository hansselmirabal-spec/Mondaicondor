import { useState } from 'react'
import { useNavigate, Link, useLocation } from 'react-router-dom'
import { Zap, CheckCircle, AlertCircle } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'

export function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { login, isLoading, error, clearError } = useAuthStore()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const state = location.state as { resetSuccess?: boolean; from?: string } | null
  const resetSuccess = state?.resetSuccess
  const redirectTo = state?.from ?? '/boards'

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    await login(email, password)
    if (localStorage.getItem('access_token')) {
      navigate(redirectTo, { replace: true })
    }
  }

  function handleEmailChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (error) clearError()
    setEmail(e.target.value)
  }

  function handlePasswordChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (error) clearError()
    setPassword(e.target.value)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#1a1a2e] to-[#292944] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center">
            <Zap className="w-6 h-6 text-white" />
          </div>
          <span className="text-2xl font-bold text-white">TaskFlow AI</span>
        </div>

        <div className="bg-white rounded-2xl p-8 shadow-2xl">
          <h1 className="text-xl font-bold text-gray-900 mb-1">Bienvenido de nuevo</h1>
          <p className="text-sm text-gray-500 mb-6">Ingresá a tu espacio de trabajo</p>

          {resetSuccess && (
            <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700 flex items-center gap-2">
              <CheckCircle className="w-4 h-4 flex-shrink-0" />
              <span>Contraseña actualizada. Ya podés ingresar.</span>
            </div>
          )}

          {error && (
            <div className="mb-4 p-4 bg-red-50 border-2 border-red-300 rounded-xl text-sm text-red-700 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5 text-red-500" />
              <div>
                <p className="font-semibold">Acceso denegado</p>
                <p className="text-red-600 mt-0.5">Email o contraseña incorrectos. Verificá tus datos e intentá de nuevo.</p>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">Correo electrónico</label>
              <input
                type="email"
                value={email}
                onChange={handleEmailChange}
                disabled={isLoading}
                className={`w-full px-3 py-2.5 border rounded-lg text-base md:text-sm focus:outline-none focus:ring-2 focus:border-transparent disabled:opacity-50 ${
                  error
                    ? 'border-red-400 focus:ring-red-400 bg-red-50'
                    : 'border-gray-200 focus:ring-blue-500'
                }`}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">Contraseña</label>
              <input
                type="password"
                value={password}
                onChange={handlePasswordChange}
                disabled={isLoading}
                className={`w-full px-3 py-2.5 border rounded-lg text-base md:text-sm focus:outline-none focus:ring-2 focus:border-transparent disabled:opacity-50 ${
                  error
                    ? 'border-red-400 focus:ring-red-400 bg-red-50'
                    : 'border-gray-200 focus:ring-blue-500'
                }`}
              />
            </div>
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold rounded-lg transition-colors text-sm flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Ingresando...
                </>
              ) : (
                'Ingresar'
              )}
            </button>
          </form>

          <div className="text-center mt-4">
            <Link
              to="/forgot-password"
              className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
            >
              ¿Olvidaste tu contraseña?
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
