import {
  Plus, Search, User, Filter, ArrowUpDown, EyeOff, Rows3, Zap, MoreHorizontal, Check, X, Calendar, Flag, SlidersHorizontal
} from 'lucide-react'
import { useNavigate, useSearchParams, useParams } from 'react-router-dom'
import { useState } from 'react'
import { Dropdown, DropdownItem } from '@/components/ui/Dropdown'
import { SearchInput } from '@/components/ui/SearchInput'
import { Modal } from '@/components/ui/Modal'
import { AssigneeAvatar } from '@/components/ui/AssigneeAvatar'
import { useFilterStore, ALL_COLUMNS } from '@/store/filterStore'
import { useBoardStore } from '@/store/boardStore'
import { api } from '@/lib/api'
import { toMockTask } from '@/lib/adapters'
import type { PriorityType } from '@/types'

const PRIORITY_TO_API: Record<PriorityType, string> = {
  'Crítica': 'Critica', 'Alta': 'Alta', 'Media': 'Media', 'Baja': 'Baja', 'Siempre activo': 'AlwaysOn',
}

const PRIORITIES: PriorityType[] = ['Crítica', 'Alta', 'Media', 'Baja', 'Siempre activo']
const SORT_OPTIONS = [
  { label: 'Nombre A→Z',    field: 'title' as const, dir: 'asc' as const },
  { label: 'Nombre Z→A',    field: 'title' as const, dir: 'desc' as const },
  { label: 'Prioridad ↑',   field: 'priority' as const, dir: 'asc' as const },
  { label: 'Prioridad ↓',   field: 'priority' as const, dir: 'desc' as const },
  { label: 'Deadline ↑',    field: 'deadline' as const, dir: 'asc' as const },
  { label: 'Deadline ↓',    field: 'deadline' as const, dir: 'desc' as const },
  { label: 'Estado A→Z',    field: 'status' as const, dir: 'asc' as const },
]
const GROUP_OPTIONS = [
  { label: 'Sin agrupar',  value: 'default' as const },
  { label: 'Por Estado',   value: 'status' as const },
  { label: 'Por Prioridad',value: 'priority' as const },
  { label: 'Por Responsable', value: 'assignee' as const },
]

export function BoardToolbar() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { boardId } = useParams<{ boardId: string }>()

  const boards = useBoardStore(state => state.boards)
  const apiUsers = useBoardStore(state => state.apiUsers)
  const workspaceStatuses = useBoardStore(state => state.workspaceStatuses)
  const workspaceUens = useBoardStore(state => state.workspaceUens)
  const board = boards.find(b => b.id === boardId)

  const {
    searchQuery, setSearchQuery,
    selectedPersonaId, setSelectedPersonaId,
    filterStatus, setFilterStatus,
    filterPriority, setFilterPriority,
    filterUenId, setFilterUenId,
    sortField, sortDir, setSortBy,
    hiddenColumns, toggleColumn,
    groupBy, setGroupBy,
    clearFilters,
  } = useFilterStore()

  const [showMobileFilters, setShowMobileFilters] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [showSearch, setShowSearch] = useState(false)
  const [openDropdown, setOpenDropdown] = useState<string | null>(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [newTaskTitle, setNewTaskTitle] = useState('')
  const [newTaskGroupId, setNewTaskGroupId] = useState('')
  const [newTaskAssigneeIds, setNewTaskAssigneeIds] = useState<string[]>([])
  const [newTaskPriority, setNewTaskPriority] = useState<PriorityType>('Baja')
  const today = new Date().toISOString().slice(0, 10)
  const [newTaskDeadline, setNewTaskDeadline] = useState(today)
  const [newTaskDescription, setNewTaskDescription] = useState('')
  const [newTaskUenIds, setNewTaskUenIds] = useState<string[]>([])

  function toggleNewAssignee(userId: string) {
    setNewTaskAssigneeIds(prev =>
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    )
  }

  function resetForm() {
    setNewTaskTitle('')
    setNewTaskGroupId('')
    setNewTaskAssigneeIds([])
    setNewTaskPriority('Baja')
    setNewTaskDeadline(new Date().toISOString().slice(0, 10))
    setNewTaskDescription('')
    setNewTaskUenIds([])
    setSaveError(null)
  }

  async function handleAddTask() {
    if (!newTaskTitle.trim() || !board || saving) return
    const groupId = newTaskGroupId || board.groups[0]?.id
    if (!groupId) return
    setSaving(true)
    setSaveError(null)
    try {
      const deadlineIso = newTaskDeadline ? new Date(newTaskDeadline + 'T00:00:00').toISOString() : undefined
      const { task: apiTask } = await api.tasks.create({
        groupId,
        title: newTaskTitle.trim(),
        priority: PRIORITY_TO_API[newTaskPriority] ?? 'Media',
        ...(deadlineIso && { deadline: deadlineIso }),
        ...(newTaskUenIds.length > 0 && { uenIds: newTaskUenIds }),
      })
      const updates: { assigneeIds?: string[]; description?: string } = {}
      if (newTaskAssigneeIds.length > 0) updates.assigneeIds = newTaskAssigneeIds
      if (newTaskDescription.trim()) updates.description = newTaskDescription.trim()
      if (Object.keys(updates).length > 0) {
        await api.tasks.update(apiTask.id, updates)
      }
      const real = toMockTask({
        ...apiTask,
        assignees: newTaskAssigneeIds.map(id => {
          const u = apiUsers.find(u => u.id === id)
          return { user: { id, name: u?.name ?? '', initials: u?.initials ?? '', color: u?.color ?? '#999', email: u?.email ?? '', avatarUrl: null } }
        }),
        group: apiTask.group ?? { id: groupId, name: '', boardId: board.id },
      })
      if (newTaskDeadline) real.deadline = newTaskDeadline
      if (newTaskDescription.trim()) real.description = newTaskDescription.trim()
      useBoardStore.setState(s => ({ apiTasks: [...s.apiTasks, real] }))
      resetForm()
      setShowAddModal(false)
    } catch (err) {
      setSaveError((err as Error).message ?? 'Error al crear el elemento')
    } finally {
      setSaving(false)
    }
  }

  const toggle = (name: string) => setOpenDropdown(prev => prev === name ? null : name)
  const close = () => setOpenDropdown(null)

  const hasActiveFilters = !!selectedPersonaId || !!filterStatus || !!filterPriority || !!filterUenId || !!sortField || hiddenColumns.length > 0

  function openPanel(panel: string) {
    const params = new URLSearchParams(searchParams)
    params.set('panel', panel)
    params.delete('task')
    navigate('?' + params.toString())
  }

  return (
    <>
    <div className="flex items-center gap-1 px-4 py-2 bg-white border-b border-gray-200 flex-wrap">
      {/* Add element */}
      <button
        onClick={() => setShowAddModal(true)}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-md transition-colors mr-2"
      >
        <Plus className="w-3.5 h-3.5" />
        <span>Agregar elemento</span>
      </button>

      {/* Mobile filter toggle */}
      <button
        onClick={() => setShowMobileFilters(v => !v)}
        className={`md:hidden flex items-center gap-1.5 px-2.5 py-1.5 text-sm rounded-md transition-colors ml-auto ${
          hasActiveFilters ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-100'
        }`}
      >
        <SlidersHorizontal className="w-3.5 h-3.5" />
        {hasActiveFilters && <span className="w-1.5 h-1.5 rounded-full bg-blue-600" />}
      </button>

      {/* Secondary controls — hidden on mobile unless showMobileFilters */}
      <div className={`${showMobileFilters ? 'flex' : 'hidden'} md:flex items-center gap-1 flex-wrap flex-1`}>

      {/* Search */}
      {showSearch ? (
        <div className="flex items-center gap-1">
          <SearchInput value={searchQuery} onChange={setSearchQuery} placeholder="Buscar en tablero..." />
          <button onClick={() => { setShowSearch(false); setSearchQuery('') }} className="p-1 text-gray-400 hover:text-gray-600">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ) : (
        <button onClick={() => setShowSearch(true)} className="flex items-center gap-1 px-2 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-md transition-colors">
          <Search className="w-3.5 h-3.5" />
          <span>Buscar</span>
        </button>
      )}

      {/* Persona */}
      <Dropdown
        isOpen={openDropdown === 'persona'}
        onClose={close}
        trigger={
          <button onClick={() => toggle('persona')} className={`flex items-center gap-1 px-2 py-1.5 text-sm rounded-md transition-colors ${selectedPersonaId ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-600 hover:bg-gray-100'}`}>
            <User className="w-3.5 h-3.5" />
            <span>{selectedPersonaId ? apiUsers.find(u => u.id === selectedPersonaId)?.name.split(' ')[0] : 'Persona'}</span>
          </button>
        }
        width="w-48"
      >
        <div className="p-1">
          <DropdownItem onClick={() => { setSelectedPersonaId(null); close() }} active={!selectedPersonaId}>
            Todos
          </DropdownItem>
          {apiUsers.map(u => (
            <DropdownItem key={u.id} onClick={() => { setSelectedPersonaId(u.id); close() }} active={selectedPersonaId === u.id}>
              <span className="inline-flex w-5 h-5 rounded-full items-center justify-center text-white text-xs font-bold shrink-0" style={{ backgroundColor: u.color }}>
                {u.initials[0]}
              </span>
              {u.name}
            </DropdownItem>
          ))}
        </div>
      </Dropdown>

      {/* Filtrar */}
      <Dropdown
        isOpen={openDropdown === 'filter'}
        onClose={close}
        width="w-64"
        trigger={
          <button onClick={() => toggle('filter')} className={`flex items-center gap-1 px-2 py-1.5 text-sm rounded-md transition-colors ${(filterStatus || filterPriority) ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-600 hover:bg-gray-100'}`}>
            <Filter className="w-3.5 h-3.5" />
            <span>Filtrar</span>
          </button>
        }
      >
        <div className="p-3 space-y-3">
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Estado</p>
            <div className="flex flex-wrap gap-1">
              {workspaceStatuses.map(s => (
                <button
                  key={s.slug}
                  onClick={() => setFilterStatus(filterStatus === s.slug ? null : s.slug)}
                  className={`px-2 py-0.5 rounded text-xs font-medium border transition-colors ${filterStatus === s.slug ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-200 text-gray-600 hover:border-blue-400'}`}
                >{s.label}</button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Prioridad</p>
            <div className="flex flex-wrap gap-1">
              {PRIORITIES.map(p => (
                <button
                  key={p}
                  onClick={() => setFilterPriority(filterPriority === p ? null : p)}
                  className={`px-2 py-0.5 rounded text-xs font-medium border transition-colors ${filterPriority === p ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-200 text-gray-600 hover:border-blue-400'}`}
                >{p}</button>
              ))}
            </div>
          </div>
          {workspaceUens.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">UEN</p>
              <div className="flex flex-wrap gap-1">
                {workspaceUens.map(u => (
                  <button
                    key={u.id}
                    onClick={() => setFilterUenId(filterUenId === u.id ? null : u.id)}
                    className={`px-2 py-0.5 rounded text-xs font-medium border transition-colors ${filterUenId === u.id ? 'text-white border-transparent' : 'border-gray-200 text-gray-600 hover:border-blue-400'}`}
                    style={filterUenId === u.id ? { backgroundColor: u.color, borderColor: u.color } : {}}
                  >{u.name}</button>
                ))}
              </div>
            </div>
          )}
          {(filterStatus || filterPriority || filterUenId) && (
            <button onClick={() => { setFilterStatus(null); setFilterPriority(null); setFilterUenId(null) }} className="text-xs text-red-600 hover:underline">
              Limpiar filtros
            </button>
          )}
        </div>
      </Dropdown>

      {/* Ordenar */}
      <Dropdown
        isOpen={openDropdown === 'sort'}
        onClose={close}
        trigger={
          <button onClick={() => toggle('sort')} className={`flex items-center gap-1 px-2 py-1.5 text-sm rounded-md transition-colors ${sortField ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-600 hover:bg-gray-100'}`}>
            <ArrowUpDown className="w-3.5 h-3.5" />
            <span>Ordenar</span>
          </button>
        }
        width="w-44"
      >
        <div className="p-1">
          <DropdownItem onClick={() => { setSortBy(null); close() }} active={!sortField}>
            Sin ordenar
          </DropdownItem>
          {SORT_OPTIONS.map(opt => (
            <DropdownItem
              key={opt.label}
              onClick={() => { setSortBy(opt.field, opt.dir); close() }}
              active={sortField === opt.field && sortDir === opt.dir}
            >
              {sortField === opt.field && sortDir === opt.dir && <Check className="w-3 h-3" />}
              {opt.label}
            </DropdownItem>
          ))}
        </div>
      </Dropdown>

      {/* Ocultar columnas */}
      <Dropdown
        isOpen={openDropdown === 'hide'}
        onClose={close}
        trigger={
          <button onClick={() => toggle('hide')} className={`flex items-center gap-1 px-2 py-1.5 text-sm rounded-md transition-colors ${hiddenColumns.length > 0 ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-600 hover:bg-gray-100'}`}>
            <EyeOff className="w-3.5 h-3.5" />
            <span>Ocultar{hiddenColumns.length > 0 ? ` (${hiddenColumns.length})` : ''}</span>
          </button>
        }
        width="w-44"
      >
        <div className="p-2 space-y-0.5">
          {ALL_COLUMNS.map(col => {
            const hidden = hiddenColumns.includes(col)
            return (
              <button
                key={col}
                onClick={() => toggleColumn(col)}
                className="w-full flex items-center gap-2 px-2 py-1.5 text-sm text-gray-700 hover:bg-gray-50 rounded-lg transition-colors"
              >
                <span className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${hidden ? 'border-gray-200 bg-white' : 'border-blue-600 bg-blue-600'}`}>
                  {!hidden && <Check className="w-2.5 h-2.5 text-white" />}
                </span>
                {col}
              </button>
            )
          })}
        </div>
      </Dropdown>

      {/* Agrupar por */}
      <Dropdown
        isOpen={openDropdown === 'group'}
        onClose={close}
        trigger={
          <button onClick={() => toggle('group')} className={`flex items-center gap-1 px-2 py-1.5 text-sm rounded-md transition-colors ${groupBy !== 'default' ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-600 hover:bg-gray-100'}`}>
            <Rows3 className="w-3.5 h-3.5" />
            <span>Agrupar por</span>
          </button>
        }
        width="w-44"
      >
        <div className="p-1">
          {GROUP_OPTIONS.map(opt => (
            <DropdownItem key={opt.value} onClick={() => { setGroupBy(opt.value); close() }} active={groupBy === opt.value}>
              {groupBy === opt.value && <Check className="w-3 h-3" />}
              {opt.label}
            </DropdownItem>
          ))}
        </div>
      </Dropdown>

      {hasActiveFilters && (
        <button onClick={clearFilters} className="flex items-center gap-1 px-2 py-1.5 text-xs text-red-600 hover:bg-red-50 rounded-md transition-colors">
          <X className="w-3 h-3" />
          Limpiar
        </button>
      )}

      <div className="flex-1" />

      <button onClick={() => openPanel('automations')} className="flex items-center gap-1 px-2 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-md transition-colors">
        <Zap className="w-3.5 h-3.5 text-orange-500" />
        <span>Automatizaciones</span>
      </button>
      <button className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-md transition-colors">
        <MoreHorizontal className="w-4 h-4" />
      </button>

      </div>{/* end secondary controls */}
    </div>

    <Modal isOpen={showAddModal} onClose={() => { resetForm(); setShowAddModal(false) }} title="Nuevo elemento" size="md">
      <div className="p-5 space-y-4">

        {/* Nombre */}
        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1">Nombre *</label>
          <input
            autoFocus
            value={newTaskTitle}
            onChange={e => setNewTaskTitle(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && newTaskTitle.trim()) handleAddTask() }}
            placeholder="Nombre del elemento..."
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Grupo */}
        {board && board.groups.length > 1 && (
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Grupo</label>
            <select
              value={newTaskGroupId || board.groups[0]?.id}
              onChange={e => setNewTaskGroupId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {board.groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          </div>
        )}

        {/* Prioridad + Deadline */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1 flex items-center gap-1">
              <Flag className="w-3 h-3" /> Prioridad
            </label>
            <select
              value={newTaskPriority}
              onChange={e => setNewTaskPriority(e.target.value as PriorityType)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1 flex items-center gap-1">
              <Calendar className="w-3 h-3" /> Fecha límite
            </label>
            <input
              type="date"
              value={newTaskDeadline}
              min={today}
              onChange={e => setNewTaskDeadline(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Responsables */}
        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-2 flex items-center gap-1">
            <User className="w-3 h-3" /> Responsables
          </label>
          <div className="flex flex-wrap gap-2">
            {apiUsers.map(u => {
              const selected = newTaskAssigneeIds.includes(u.id)
              return (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => toggleNewAssignee(u.id)}
                  className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium border transition-all ${
                    selected
                      ? 'border-blue-500 bg-blue-50 text-blue-700 ring-1 ring-blue-400'
                      : 'border-gray-200 bg-white text-gray-600 hover:border-gray-400'
                  }`}
                >
                  <AssigneeAvatar userId={u.id} size="sm" />
                  {u.name.split(' ')[0]}
                  {selected && <Check className="w-3 h-3 text-blue-500 ml-0.5" />}
                </button>
              )
            })}
          </div>
          {newTaskAssigneeIds.length > 0 && (
            <p className="text-xs text-blue-600 mt-1">{newTaskAssigneeIds.length} responsable{newTaskAssigneeIds.length > 1 ? 's' : ''} seleccionado{newTaskAssigneeIds.length > 1 ? 's' : ''}</p>
          )}
        </div>

        {/* UEN */}
        {workspaceUens.length > 0 && (
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">UEN</label>
            <div className="flex flex-wrap gap-1.5">
              {workspaceUens.map(u => {
                const selected = newTaskUenIds.includes(u.id)
                return (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => setNewTaskUenIds(prev => selected ? prev.filter(id => id !== u.id) : [...prev, u.id])}
                    className={`px-2 py-0.5 rounded text-xs font-medium border transition-colors ${selected ? 'text-white border-transparent' : 'border-gray-200 text-gray-600 hover:border-blue-400'}`}
                    style={selected ? { backgroundColor: u.color, borderColor: u.color } : {}}
                  >
                    {u.name}
                  </button>
                )
              })}
            </div>
            {newTaskUenIds.length > 0 && (
              <p className="text-xs text-blue-600 mt-1">{newTaskUenIds.length} UEN{newTaskUenIds.length > 1 ? 's' : ''} seleccionada{newTaskUenIds.length > 1 ? 's' : ''}</p>
            )}
          </div>
        )}

        {/* Descripción */}
        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1">Descripción</label>
          <textarea
            value={newTaskDescription}
            onChange={e => setNewTaskDescription(e.target.value)}
            placeholder="Agregá contexto sobre esta tarea..."
            rows={2}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
        </div>

        {saveError && (
          <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{saveError}</p>
        )}

        {/* Buttons */}
        <div className="flex gap-2 pt-1">
          <button
            onClick={() => { resetForm(); setShowAddModal(false) }}
            className="flex-1 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50"
          >
            Cancelar
          </button>
          <button
            onClick={handleAddTask}
            disabled={!newTaskTitle.trim() || saving}
            className="flex-1 py-2 text-sm bg-blue-600 hover:bg-blue-700 disabled:bg-blue-200 text-white font-medium rounded-lg transition-colors"
          >
            {saving ? 'Creando...' : 'Crear elemento'}
          </button>
        </div>
      </div>
    </Modal>
    </>
  )
}
