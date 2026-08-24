import { useState, useEffect } from 'react'
import { X, ArrowRightLeft, ChevronDown, Loader2 } from 'lucide-react'
import { api } from '@/lib/api'
import type { ApiCustomFieldDefinition } from '@/lib/api'
import { useBoardStore } from '@/store/boardStore'
import { toast } from '@/components/ui/Toast'
import { toMockBoard } from '@/lib/adapters'
import type { MockBoard, MockGroup } from '@/types'

interface MoveBoardModalProps {
  taskId: string
  taskTitle: string
  currentBoardId: string
  customFields?: Record<string, unknown>
  onClose: () => void
  onMoved: () => void
}

export function MoveBoardModal({ taskId, taskTitle, currentBoardId, customFields, onClose, onMoved }: MoveBoardModalProps) {
  const { workspace, customFieldDefinitions } = useBoardStore()
  const workspaceId = workspace?.id ?? null

  const [boards, setBoards] = useState<MockBoard[]>([])
  const [selectedBoardId, setSelectedBoardId] = useState('')
  const [selectedGroupId, setSelectedGroupId] = useState('')
  const [groups, setGroups] = useState<MockGroup[]>([])
  const [loadingBoards, setLoadingBoards] = useState(true)
  const [loadingGroups, setLoadingGroups] = useState(false)
  const [moving, setMoving] = useState(false)
  const [destCustomFields, setDestCustomFields] = useState<ApiCustomFieldDefinition[]>([])

  useEffect(() => {
    if (!workspaceId) return
    api.boards.listByWorkspace(workspaceId)
      .then(({ boards: apiBoards }) => {
        const mapped = apiBoards.map(toMockBoard).filter(b => b.id !== currentBoardId)
        setBoards(mapped)
      })
      .catch(() => toast('Error al cargar tableros.', 'error'))
      .finally(() => setLoadingBoards(false))
  }, [workspaceId])

  // Cuando cambia el tablero seleccionado, cargamos sus grupos via GET /boards/:id
  useEffect(() => {
    if (!selectedBoardId) { setGroups([]); setSelectedGroupId(''); return }
    setLoadingGroups(true)
    api.boards.get(selectedBoardId)
      .then(({ board }) => {
        const g = toMockBoard(board).groups
        setGroups(g)
        setSelectedGroupId(g[0]?.id ?? '')
      })
      .catch(() => toast('Error al cargar grupos.', 'error'))
      .finally(() => setLoadingGroups(false))
  }, [selectedBoardId])

  // Definitions are board-scoped (each CustomFieldDefinition.id belongs to exactly
  // one board), so a destination board can never share a source field's id — this
  // fetch is what lets us compute the nominal "Se perderán: ..." warning below
  // instead of a generic always-on line.
  useEffect(() => {
    if (!selectedBoardId) { setDestCustomFields([]); return }
    api.boards.listCustomFields(selectedBoardId)
      .then(({ customFieldDefinitions }) => setDestCustomFields(customFieldDefinitions))
      .catch(() => setDestCustomFields([]))
  }, [selectedBoardId])

  const selectedBoard = boards.find(b => b.id === selectedBoardId)

  const sourceCustomFieldDefs = customFieldDefinitions.filter(d => d.boardId === currentBoardId)
  const lostCustomFieldLabels = selectedBoardId
    ? Object.entries(customFields ?? {})
        .filter(([, value]) => value !== null && value !== undefined)
        .filter(([fieldId]) => !destCustomFields.some(d => d.id === fieldId && !d.archivedAt))
        .map(([fieldId]) => sourceCustomFieldDefs.find(d => d.id === fieldId)?.label)
        .filter((label): label is string => !!label)
    : []

  async function handleMove() {
    if (!selectedGroupId) return
    setMoving(true)
    try {
      await api.tasks.move(taskId, selectedGroupId)
      toast(`Tarea movida a "${selectedBoard?.name}".`, 'success')
      onMoved()
      onClose()
    } catch (err) {
      toast((err as Error).message ?? 'Error al mover la tarea.', 'error')
    } finally {
      setMoving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <ArrowRightLeft className="w-4 h-4 text-indigo-500" />
            <h2 className="text-sm font-bold text-gray-800">Mover tarea</h2>
          </div>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-700 rounded-lg transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          {/* Task name */}
          <div className="bg-gray-50 rounded-lg px-3 py-2">
            <p className="text-xs text-gray-400 mb-0.5">Tarea</p>
            <p className="text-sm font-medium text-gray-800 truncate">{taskTitle}</p>
          </div>

          {/* Board selector */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Tablero destino</label>
            {loadingBoards ? (
              <div className="h-9 rounded-lg bg-gray-100 animate-pulse" />
            ) : boards.length === 0 ? (
              <p className="text-xs text-gray-400 py-2">No hay otros tableros disponibles.</p>
            ) : (
              <div className="relative">
                <select
                  value={selectedBoardId}
                  onChange={e => setSelectedBoardId(e.target.value)}
                  className="w-full appearance-none px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white pr-8"
                >
                  <option value="">Seleccioná un tablero...</option>
                  {boards.map(b => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2.5 top-2.5 w-4 h-4 text-gray-400 pointer-events-none" />
              </div>
            )}
          </div>

          {/* Group selector */}
          {selectedBoardId && (
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Grupo destino</label>
              {loadingGroups ? (
                <div className="flex items-center gap-2 h-9 px-3 border border-gray-200 rounded-lg text-sm text-gray-400">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Cargando grupos...
                </div>
              ) : (
                <div className="relative">
                  <select
                    value={selectedGroupId}
                    onChange={e => setSelectedGroupId(e.target.value)}
                    className="w-full appearance-none px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white pr-8"
                  >
                    {groups.map(g => (
                      <option key={g.id} value={g.id}>{g.name}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-2.5 top-2.5 w-4 h-4 text-gray-400 pointer-events-none" />
                </div>
              )}
              <p className="text-[10px] text-gray-400 mt-1">
                Los asignados que no pertenezcan a "{selectedBoard?.name}" serán removidos.
              </p>
              {lostCustomFieldLabels.length > 0 && (
                <p className="text-[10px] text-amber-600 mt-1">
                  Se perderán: {lostCustomFieldLabels.join(', ')}.
                </p>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            <button
              onClick={onClose}
              className="flex-1 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleMove}
              disabled={!selectedGroupId || moving}
              className="flex-1 py-2 text-sm bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-200 text-white font-medium rounded-lg transition-colors"
            >
              {moving ? 'Moviendo...' : 'Mover'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
