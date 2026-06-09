import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { Zap, CheckCircle, XCircle, Loader2 } from 'lucide-react'
import { api } from '@/lib/api'

export function AcceptInvitePage() {
  const { token } = useParams<{ token: string }>()
  const navigate = useNavigate()
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    if (!token) { setStatus('error'); setErrorMsg('Token de invitación inválido.'); return }

    api.workspaces.acceptInvite(token)
      .then(() => {
        setStatus('success')
        setTimeout(() => navigate('/boards', { replace: true }), 2500)
      })
      .catch(err => {
        setStatus('error')
        setErrorMsg((err as Error).message || 'La invitación es inválida o ya expiró.')
      })
  }, [token])

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#1a1a2e] to-[#292944] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center">
            <Zap className="w-6 h-6 text-white" />
          </div>
          <span className="text-2xl font-bold text-white">TaskFlow AI</span>
        </div>

        <div className="bg-white rounded-2xl p-8 shadow-2xl text-center">
          {status === 'loading' && (
            <>
              <Loader2 className="w-10 h-10 text-blue-500 animate-spin mx-auto mb-4" />
              <h1 className="text-lg font-bold text-gray-900 mb-1">Procesando invitación</h1>
              <p className="text-sm text-gray-500">Un momento...</p>
            </>
          )}

          {status === 'success' && (
            <>
              <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
              <h1 className="text-lg font-bold text-gray-900 mb-1">¡Te uniste al workspace!</h1>
              <p className="text-sm text-gray-500">Redirigiendo a tus tableros...</p>
            </>
          )}

          {status === 'error' && (
            <>
              <XCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
              <h1 className="text-lg font-bold text-gray-900 mb-2">Invitación inválida</h1>
              <p className="text-sm text-gray-500 mb-6">{errorMsg}</p>
              <Link
                to="/boards"
                className="inline-block px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
              >
                Ir a mis tableros
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
