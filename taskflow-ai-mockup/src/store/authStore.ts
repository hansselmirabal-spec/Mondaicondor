import { create } from 'zustand'
import { api } from '@/lib/api'
import type { ApiUser } from '@/lib/api'

interface AuthStore {
  user: ApiUser | null
  isLoading: boolean
  initialized: boolean
  error: string | null
  initialize: () => Promise<void>
  login: (email: string, password: string) => Promise<void>
  logout: () => void
  clearError: () => void
  setUser: (user: ApiUser) => void
}

export const useAuthStore = create<AuthStore>(set => ({
  user: null,
  isLoading: false,
  initialized: false,
  error: null,

  initialize: async () => {
    if (!localStorage.getItem('access_token')) {
      set({ initialized: true })
      return
    }
    try {
      const { user } = await api.users.me()
      set({ user, initialized: true })
    } catch {
      localStorage.removeItem('access_token')
      localStorage.removeItem('refresh_token')
      set({ initialized: true })
    }
  },

  login: async (email, password) => {
    set({ isLoading: true, error: null })
    try {
      const { user, accessToken, refreshToken } = await api.auth.login(email, password)
      localStorage.setItem('access_token', accessToken)
      localStorage.setItem('refresh_token', refreshToken)
      set({ user, isLoading: false })
    } catch (err) {
      set({ isLoading: false, error: (err as Error).message ?? 'Credenciales incorrectas.' })
    }
  },

  logout: () => {
    const refreshToken = localStorage.getItem('refresh_token')
    if (refreshToken) api.auth.logout(refreshToken).catch(() => {})
    localStorage.removeItem('access_token')
    localStorage.removeItem('refresh_token')
    set({ user: null })
  },

  clearError: () => set({ error: null }),
  setUser: (user: ApiUser) => set({ user }),
}))

// Recover session on app load
if (typeof window !== 'undefined') {
  useAuthStore.getState().initialize()
}
