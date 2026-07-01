import { FileText, Trophy, HelpCircle } from 'lucide-react'
import { useState } from 'react'
import { useSearchParams, useParams } from 'react-router-dom'
import { Modal } from '@/components/ui/Modal'
import { useBoardStore } from '@/store/boardStore'

function SummaryModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { boardId } = useParams<{ boardId: string }>()
  const boards = useBoardStore(state => state.boards)
  const apiTasks = useBoardStore(state => state.apiTasks)
  const board = boards.find(b => b.id === boardId)
  const tasks = boardId ? apiTasks.filter(t => t.boardId === boardId) : apiTasks
  const total = tasks.length
  const groupCount = board?.groups.length ?? 0
  const byStatus: Record<string, number> = {}
  tasks.forEach(t => { byStatus[t.status] = (byStatus[t.status] ?? 0) + 1 })

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Resumen del tablero" size="md">
      <div className="p-5 space-y-4">
        <p className="text-sm text-gray-600">
          El tablero <strong>{board?.name ?? 'actual'}</strong> tiene <strong>{total} {total === 1 ? 'tarea' : 'tareas'}</strong>{groupCount > 0 ? ` distribuidas en ${groupCount} ${groupCount === 1 ? 'grupo' : 'grupos'}` : ''}.
        </p>
        <div className="space-y-2">
          {Object.entries(byStatus).map(([status, count]) => (
            <div key={status} className="flex items-center justify-between py-1.5 px-3 bg-gray-50 rounded-lg">
              <span className="text-sm text-gray-700">{status}</span>
              <span className="text-sm font-semibold text-gray-900">{count} tarea{count !== 1 ? 's' : ''}</span>
            </div>
          ))}
        </div>
        {byStatus['Bloqueado'] > 0 && (
          <div className="bg-blue-50 rounded-lg p-3">
            <p className="text-xs font-semibold text-blue-700 mb-1">Recomendación IA</p>
            <p className="text-xs text-blue-600">Hay {byStatus['Bloqueado']} {byStatus['Bloqueado'] === 1 ? 'tarea bloqueada que requiere' : 'tareas bloqueadas que requieren'} atención inmediata.</p>
          </div>
        )}
      </div>
    </Modal>
  )
}

function GamifyModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Gamificación del tablero" size="md">
      <div className="p-5 space-y-4">
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-700">
          Datos de ejemplo — esta función está en desarrollo.
        </div>
        <div className="flex items-center gap-4 bg-gradient-to-r from-purple-50 to-blue-50 rounded-xl p-4">
          <div className="text-4xl">🏆</div>
          <div>
            <p className="text-lg font-bold text-gray-900">Nivel 3 — Estratega</p>
            <p className="text-sm text-gray-500">1.240 puntos acumulados este mes</p>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {[
            { emoji: '🔥', label: 'Racha', value: '7 días' },
            { emoji: '✅', label: 'Completadas', value: '24 tareas' },
            { emoji: '⚡', label: 'Velocidad', value: 'Alta' },
          ].map(stat => (
            <div key={stat.label} className="bg-gray-50 rounded-xl p-3 text-center">
              <div className="text-2xl mb-1">{stat.emoji}</div>
              <p className="text-xs text-gray-500">{stat.label}</p>
              <p className="text-sm font-bold text-gray-900">{stat.value}</p>
            </div>
          ))}
        </div>
        <div>
          <p className="text-xs font-semibold text-gray-700 mb-2">Logros desbloqueados</p>
          <div className="space-y-2">
            {['🎯 Primera tarea completada', '💪 Racha de 7 días', '🚀 10 tareas en una semana'].map(a => (
              <div key={a} className="flex items-center gap-2 text-sm text-gray-700 bg-yellow-50 px-3 py-1.5 rounded-lg">
                <span>{a}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  )
}

function ComingSoonModal({ isOpen, onClose, title }: { isOpen: boolean; onClose: () => void; title: string }) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} size="sm">
      <div className="p-8 text-center space-y-3">
        <div className="text-4xl">🚧</div>
        <p className="text-sm font-semibold text-gray-800">Próximamente</p>
        <p className="text-xs text-gray-500">Esta funcionalidad estará disponible en la próxima versión de TaskFlow AI.</p>
      </div>
    </Modal>
  )
}

export function FloatingActions() {
  const [summaryOpen, setSummaryOpen] = useState(false)
  const [gamifyOpen, setGamifyOpen] = useState(false)
  const [soonOpen, setSoonOpen] = useState(false)
  const [soonTitle, setSoonTitle] = useState('')
  const [searchParams] = useSearchParams()

  // Move away from drawer (480px wide) when task or panel is open (desktop only)
  const drawerOpen = !!searchParams.get('task') || !!searchParams.get('panel')
  const rightClass = drawerOpen ? 'right-6 md:right-[500px]' : 'right-6'

  function openSoon(title: string) {
    setSoonTitle(title)
    setSoonOpen(true)
  }

  return (
    <>
      <div className={`fixed bottom-[calc(3.5rem+1.5rem)] md:bottom-6 flex flex-col items-end gap-2 z-[60] transition-all duration-300 ${rightClass}`}>
        <button
          onClick={() => openSoon('Ayuda contextual')}
          title="Ayuda"
          className="w-10 h-10 bg-white border border-gray-200 rounded-full flex items-center justify-center text-gray-500 hover:text-blue-600 hover:border-blue-300 shadow-md transition-all"
        >
          <HelpCircle className="w-5 h-5" />
        </button>
        <button
          onClick={() => setSummaryOpen(true)}
          title="Resumir esta página"
          className="w-10 h-10 bg-white border border-gray-200 rounded-full flex items-center justify-center text-gray-500 hover:text-purple-600 hover:border-purple-300 shadow-md transition-all"
        >
          <FileText className="w-5 h-5" />
        </button>
        <button
          onClick={() => setGamifyOpen(true)}
          title="Gamificar esta página"
          className="w-10 h-10 bg-white border border-gray-200 rounded-full flex items-center justify-center text-gray-500 hover:text-yellow-600 hover:border-yellow-300 shadow-md transition-all"
        >
          <Trophy className="w-5 h-5" />
        </button>
      </div>

      <SummaryModal isOpen={summaryOpen} onClose={() => setSummaryOpen(false)} />
      <GamifyModal isOpen={gamifyOpen} onClose={() => setGamifyOpen(false)} />
      <ComingSoonModal isOpen={soonOpen} onClose={() => setSoonOpen(false)} title={soonTitle} />
    </>
  )
}
