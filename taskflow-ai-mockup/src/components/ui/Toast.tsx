import { create } from 'zustand'
import { CheckCircle, Info, XCircle, X } from 'lucide-react'

interface ToastItem {
  id: string
  message: string
  type: 'success' | 'info' | 'error'
}

interface ToastStore {
  toasts: ToastItem[]
  addToast: (message: string, type?: ToastItem['type']) => void
  removeToast: (id: string) => void
}

const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  addToast: (message, type = 'success') => {
    const id = Math.random().toString(36).slice(2)
    set(state => ({ toasts: [...state.toasts, { id, message, type }] }))
    setTimeout(() => set(state => ({ toasts: state.toasts.filter(t => t.id !== id) })), 3500)
  },
  removeToast: id => set(state => ({ toasts: state.toasts.filter(t => t.id !== id) })),
}))

export function toast(message: string, type: ToastItem['type'] = 'success') {
  useToastStore.getState().addToast(message, type)
}

export function ToastContainer() {
  const { toasts, removeToast } = useToastStore()
  if (toasts.length === 0) return null

  const icons = {
    success: <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />,
    info:    <Info className="w-4 h-4 text-blue-500 shrink-0" />,
    error:   <XCircle className="w-4 h-4 text-red-500 shrink-0" />,
  }

  return (
    <div className="fixed bottom-6 right-6 z-[200] flex flex-col gap-2 pointer-events-none">
      {toasts.map(t => (
        <div key={t.id} className="flex items-center gap-3 bg-white border border-gray-200 rounded-xl px-4 py-3 shadow-xl min-w-[280px] pointer-events-auto">
          {icons[t.type]}
          <span className="text-sm text-gray-800 flex-1">{t.message}</span>
          <button onClick={() => removeToast(t.id)} className="text-gray-400 hover:text-gray-600">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
    </div>
  )
}
