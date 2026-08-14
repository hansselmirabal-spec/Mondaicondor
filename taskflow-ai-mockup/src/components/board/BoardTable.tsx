import type { MockBoard, MockGroup, MockTask, StatusType, PriorityType } from '@/types'
import { useBoardStore } from '@/store/boardStore'
import { useFilterStore } from '@/store/filterStore'
import { BoardGroup } from './BoardGroup'
import { api } from '@/lib/api'
import { toMockTask } from '@/lib/adapters'
import { useState, useRef, useEffect } from 'react'
import { Plus, Check, X, FolderOpen } from 'lucide-react'
import { useNavigate, useSearchParams } from 'react-router-dom'

const PRIORITY_ORDER: Record<PriorityType, number> = { 'Crítica': 0, 'Siempre activo': 1, 'Alta': 2, 'Media': 3, 'Baja': 4 }
const STATUS_ORDER: Record<StatusType, number> = { 'Bloqueado': 0, 'En revisión': 1, 'En progreso': 2, 'Asignado': 3, 'Nuevo': 4, 'Siempre activo': 5, 'Completado': 6 }

interface BoardTableProps { board: MockBoard }

const GROUP_COLORS = ['#6366f1', '#f59e0b', '#10b981', '#f43f5e', '#8b5cf6', '#0ea5e9', '#22c55e', '#ec4899']

export function BoardTable({ board }: BoardTableProps) {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { searchQuery, selectedPersonaId, filterStatus, filterPriority, sortField, sortDir, groupBy } = useFilterStore()
  const taskMutations = useBoardStore(state => state.taskMutations)
  const newTasks = useBoardStore(state => state.newTasks)
  const apiTasks = useBoardStore(state => state.apiTasks)
  const apiUsers = useBoardStore(state => state.apiUsers)
  const addTask = useBoardStore(state => state.addTask)
  const patchBoard = useBoardStore(state => state.patchBoard)
  const allApiTasks = apiTasks.filter(t => t.boardId === board.id)

  const [addingGroup, setAddingGroup] = useState(false)
  const [groupName, setGroupName] = useState('')
  const [groupError, setGroupError] = useState('')
  const groupInputRef = useRef<HTMLInputElement>(null)
  useEffect(() => { if (addingGroup) groupInputRef.current?.focus() }, [addingGroup])

  const [draggingGroupId, setDraggingGroupId] = useState<string | null>(null)
  const [overGroupId, setOverGroupId] = useState<string | null>(null)
  const groupDragCounter = useRef<Record<string, number>>({})

  function handleGroupDragStart(e: React.DragEvent, groupId: string) {
    setDraggingGroupId(groupId)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('groupId', groupId)
  }

  function handleGroupDragEnd() {
    setDraggingGroupId(null)
    setOverGroupId(null)
    groupDragCounter.current = {}
  }

  function handleGroupDragEnter(e: React.DragEvent, groupId: string) {
    e.preventDefault()
    groupDragCounter.current[groupId] = (groupDragCounter.current[groupId] ?? 0) + 1
    setOverGroupId(groupId)
  }

  function handleGroupDragLeave(e: React.DragEvent, groupId: string) {
    e.preventDefault()
    groupDragCounter.current[groupId] = (groupDragCounter.current[groupId] ?? 1) - 1
    if ((groupDragCounter.current[groupId] ?? 0) <= 0) {
      groupDragCounter.current[groupId] = 0
      setOverGroupId(prev => prev === groupId ? null : prev)
    }
  }

  function handleGroupDragOver(e: React.DragEvent) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  function handleGroupDrop(e: React.DragEvent, targetGroupId: string) {
    e.preventDefault()
    const sourceId = e.dataTransfer.getData('groupId') || draggingGroupId
    if (!sourceId || sourceId === targetGroupId) { handleGroupDragEnd(); return }

    const currentGroups = [...board.groups]
    const fromIndex = currentGroups.findIndex(g => g.id === sourceId)
    const toIndex = currentGroups.findIndex(g => g.id === targetGroupId)
    if (fromIndex === -1 || toIndex === -1) { handleGroupDragEnd(); return }

    const reordered = [...currentGroups]
    const [moved] = reordered.splice(fromIndex, 1)
    reordered.splice(toIndex, 0, moved)
    const withOrder = reordered.map((g, i) => ({ ...g, order: i }))

    patchBoard(board.id, { groups: withOrder })

    api.boards.reorderGroups(board.id, withOrder.map(g => g.id)).catch(() => {
      patchBoard(board.id, { groups: currentGroups })
    })

    handleGroupDragEnd()
  }

  async function handleCreateGroup() {
    const name = groupName.trim()
    if (!name) return
    setGroupError('')
    try {
      const { group } = await api.boards.createGroup(board.id, {
        name,
        color: GROUP_COLORS[board.groups.length % GROUP_COLORS.length],
      })
      patchBoard(board.id, {
        groups: [...board.groups, { id: group.id, boardId: board.id, name: group.name, color: group.color }],
      })
      setGroupName('')
      setAddingGroup(false)
    } catch {
      setGroupError('No se pudo crear el grupo')
    }
  }

  function handleGroupKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') handleCreateGroup()
    if (e.key === 'Escape') { setGroupName(''); setAddingGroup(false) }
  }

  function getStatus(task: MockTask): StatusType  { return taskMutations[task.id]?.status ?? task.status }
  function getPriority(task: MockTask): PriorityType { return taskMutations[task.id]?.priority ?? task.priority }

  function filterTask(task: MockTask) {
    if (searchQuery && !task.title.toLowerCase().includes(searchQuery.toLowerCase())) return false
    if (selectedPersonaId && !task.assigneeIds.includes(selectedPersonaId)) return false
    if (filterStatus && getStatus(task) !== filterStatus) return false
    if (filterPriority && getPriority(task) !== filterPriority) return false
    return true
  }

  function sortTasks(tasks: MockTask[]) {
    if (!sortField) return [...tasks].sort((a, b) => a.order - b.order)
    return [...tasks].sort((a, b) => {
      let cmp = 0
      if (sortField === 'title')    cmp = a.title.localeCompare(b.title)
      if (sortField === 'status')   cmp = STATUS_ORDER[getStatus(a)] - STATUS_ORDER[getStatus(b)]
      if (sortField === 'priority') cmp = PRIORITY_ORDER[getPriority(a)] - PRIORITY_ORDER[getPriority(b)]
      if (sortField === 'deadline') {
        const da = a.deadline ?? '9999', db = b.deadline ?? '9999'
        cmp = da.localeCompare(db)
      }
      if (sortField === 'createdAt') cmp = a.createdAt.localeCompare(b.createdAt)
      return sortDir === 'asc' ? cmp : -cmp
    })
  }

  function makeAddTask(groupId: string, boardId: string) {
    return async (title: string, deadline: string | null) => {
      const tempId = `task-temp-${Date.now()}`
      const now = new Date().toISOString()
      addTask({
        id: tempId, groupId, boardId, title,
        assigneeIds: [], status: 'Nuevo', priority: 'Media',
        deadline, fileUrl: null, text: null, description: '',
        order: -Date.now(), // new tasks go to the TOP (below every existing order)
        createdAt: now, updatedAt: now,
        uenIds: [],
      })
      const params = new URLSearchParams(searchParams)
      params.set('task', tempId)
      navigate('?' + params.toString())
      try {
        const { task: apiTask } = await api.tasks.create({ groupId, title })
        const real = toMockTask({ ...apiTask, group: apiTask.group ?? { id: groupId, name: '', boardId } })
        useBoardStore.setState(s => ({
          newTasks: s.newTasks.filter(t => t.id !== tempId),
          apiTasks: [...s.apiTasks, real],
        }))
        const newParams = new URLSearchParams(searchParams)
        newParams.set('task', real.id)
        navigate('?' + newParams.toString(), { replace: true })
      } catch (err) {
        console.error('Error creando tarea:', err)
      }
    }
  }

  const addGroupBar = (
    <div className="mt-2">
      {addingGroup ? (
        <div className="flex items-center gap-2 px-4 py-2 bg-white border border-blue-300 rounded-lg shadow-sm">
          <input
            ref={groupInputRef}
            value={groupName}
            onChange={e => { setGroupName(e.target.value); setGroupError('') }}
            onKeyDown={handleGroupKeyDown}
            placeholder="Nombre del grupo..."
            className="flex-1 text-sm text-gray-800 bg-transparent border-none focus:outline-none"
          />
          {groupError && <span className="text-xs text-red-500">{groupError}</span>}
          <button
            onClick={handleCreateGroup}
            disabled={!groupName.trim()}
            className="p-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-200 text-white rounded transition-colors"
          >
            <Check className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => { setGroupName(''); setAddingGroup(false); setGroupError('') }}
            className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ) : (
        <button
          onClick={() => setAddingGroup(true)}
          className="flex items-center gap-2 px-4 py-2.5 text-sm text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 rounded-lg border border-dashed border-indigo-300 hover:border-indigo-400 w-full transition-colors"
        >
          <Plus className="w-4 h-4" />
          Agregar grupo
        </button>
      )}
    </div>
  )

  if (groupBy === 'default') {
    if (board.groups.length === 0) {
      return (
        <div className="flex-1 overflow-auto px-4 py-8 scrollbar-thin">
          <div className="flex flex-col items-center justify-center gap-4 text-center py-12">
            <div className="w-14 h-14 rounded-full bg-indigo-50 flex items-center justify-center">
              <FolderOpen className="w-7 h-7 text-indigo-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-700">Este tablero no tiene grupos</p>
              <p className="text-xs text-gray-400 mt-1">Creá un grupo para organizar tus tareas</p>
            </div>
          </div>
          <div className="max-w-sm mx-auto">{addGroupBar}</div>
        </div>
      )
    }

    return (
      <div className="flex-1 overflow-auto px-4 py-4 scrollbar-thin">
        {board.groups.map(group => {
          const groupTasks = [
            ...allApiTasks.filter(t => t.groupId === group.id),
            ...newTasks.filter(t => t.groupId === group.id),
          ]
          const tasks = sortTasks(groupTasks.filter(filterTask))
          return (
            <BoardGroup
              key={group.id}
              group={group}
              tasks={tasks}
              onAddTask={makeAddTask(group.id, board.id)}
              isDragging={draggingGroupId === group.id}
              isOver={overGroupId === group.id && draggingGroupId !== group.id}
              onDragStart={e => handleGroupDragStart(e, group.id)}
              onDragEnd={handleGroupDragEnd}
              onDragEnter={e => handleGroupDragEnter(e, group.id)}
              onDragLeave={e => handleGroupDragLeave(e, group.id)}
              onDragOver={handleGroupDragOver}
              onDrop={e => handleGroupDrop(e, group.id)}
            />
          )
        })}
        {addGroupBar}
      </div>
    )
  }

  const allTasks = sortTasks([...allApiTasks, ...newTasks.filter(t => t.boardId === board.id)].filter(filterTask))
  let groups: { key: string; label: string; tasks: MockTask[] }[] = []

  if (groupBy === 'status') {
    const byStatus: Record<string, MockTask[]> = {}
    allTasks.forEach(t => { const s = getStatus(t); (byStatus[s] ??= []).push(t) })
    groups = Object.entries(byStatus).map(([key, tasks]) => ({ key, label: key, tasks }))
  } else if (groupBy === 'priority') {
    const byPriority: Record<string, MockTask[]> = {}
    allTasks.forEach(t => { const p = getPriority(t); (byPriority[p] ??= []).push(t) })
    groups = Object.entries(byPriority).map(([key, tasks]) => ({ key, label: key, tasks }))
  } else if (groupBy === 'assignee') {
    const byUser: Record<string, MockTask[]> = {}
    allTasks.forEach(t => {
      const ids = t.assigneeIds.length > 0 ? t.assigneeIds : ['unassigned']
      ids.forEach(id => { (byUser[id] ??= []).push(t) })
    })
    groups = Object.entries(byUser).map(([id, tasks]) => {
      const user = apiUsers.find(u => u.id === id)
      return { key: id, label: user?.name ?? 'Sin responsable', tasks }
    })
  }

  const fakeGroup = (key: string, color: string): MockGroup => ({
    id: key, boardId: board.id, name: key, color,
  })

  const colors = ['#6366f1', '#f59e0b', '#10b981', '#f43f5e', '#8b5cf6', '#0ea5e9', '#22c55e']

  return (
    <div className="flex-1 overflow-auto px-4 py-4 scrollbar-thin">
      {groups.map((g, i) => (
        <BoardGroup
          key={g.key}
          group={fakeGroup(g.key, colors[i % colors.length])}
          tasks={g.tasks}
          label={g.label}
        />
      ))}
    </div>
  )
}
