import { ChevronDown, ChevronRight, Plus, Check, X, MoreHorizontal, Pencil, Trash2 } from 'lucide-react'
import { useState, useRef, useEffect } from 'react'
import type { MockGroup, MockTask } from '@/types'
import { TaskRow } from './TaskRow'
import { EmptyState } from '@/components/ui/EmptyState'
import { useUIStore } from '@/store/uiStore'
import { useFilterStore, ALL_COLUMNS } from '@/store/filterStore'
import { useBoardStore } from '@/store/boardStore'
import { api } from '@/lib/api'
import { toast } from '@/components/ui/Toast'

interface BoardGroupProps {
  group: MockGroup
  tasks: MockTask[]
  label?: string
  onAddTask?: (title: string, deadline: string | null) => void
}

export function BoardGroup({ group, tasks, label, onAddTask }: BoardGroupProps) {
  const { toggleGroup, isGroupCollapsed } = useUIStore()
  const { isColumnVisible } = useFilterStore()
  const { removeGroup, patchGroup } = useBoardStore()
  const collapsed = isGroupCollapsed(group.id)
  const displayName = label ?? group.name
  const [adding, setAdding] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newDeadline, setNewDeadline] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const [editingName, setEditingName] = useState(false)
  const [nameDraft, setNameDraft] = useState('')
  const nameInputRef = useRef<HTMLInputElement>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => {
    if (!menuOpen) return
    function handler(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [menuOpen])

  useEffect(() => { if (editingName) nameInputRef.current?.focus() }, [editingName])

  function startEdit() {
    setMenuOpen(false)
    setNameDraft(group.name)
    setEditingName(true)
  }

  async function commitNameEdit() {
    const trimmed = nameDraft.trim()
    if (!trimmed || trimmed === group.name) { setEditingName(false); return }
    try {
      await api.groups.update(group.id, { name: trimmed })
      patchGroup(group.id, { name: trimmed })
      toast('Grupo actualizado.', 'success')
    } catch {
      toast('Error al renombrar el grupo.', 'error')
    }
    setEditingName(false)
  }

  async function handleDelete() {
    try {
      await api.groups.delete(group.id)
      removeGroup(group.id)
      toast('Grupo eliminado.', 'success')
    } catch {
      toast('Error al eliminar el grupo.', 'error')
    }
    setConfirmDelete(false)
  }

  useEffect(() => { if (adding) inputRef.current?.focus() }, [adding])

  function commitAdd() {
    if (!newTitle.trim()) return
    onAddTask?.(newTitle.trim(), newDeadline || null)
    setNewTitle('')
    setNewDeadline('')
    setAdding(false)
  }

  function handleAddKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') commitAdd()
    if (e.key === 'Escape') { setNewTitle(''); setNewDeadline(''); setAdding(false) }
  }

  const visibleColumns = ALL_COLUMNS.filter(col => isColumnVisible(col))
  // +2 = checkbox col + title col
  const colSpan = 2 + visibleColumns.length

  return (
    <div className="mb-6">
      <div className="flex items-center gap-1 mb-1 px-2 py-1 select-none group/header">
        <button
          onClick={() => toggleGroup(group.id)}
          className="flex items-center gap-1 hover:bg-gray-100 rounded px-1 py-0.5 transition-colors"
        >
          {collapsed
            ? <ChevronRight className="w-4 h-4 text-gray-400" />
            : <ChevronDown className="w-4 h-4 text-gray-400" />
          }
          {editingName ? (
            <input
              ref={nameInputRef}
              value={nameDraft}
              onChange={e => setNameDraft(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') commitNameEdit()
                if (e.key === 'Escape') setEditingName(false)
              }}
              onBlur={commitNameEdit}
              onClick={e => e.stopPropagation()}
              className="text-sm font-semibold border border-blue-400 rounded px-1 focus:outline-none focus:ring-2 focus:ring-blue-400"
              style={{ color: group.color, minWidth: '100px' }}
            />
          ) : (
            <span className="text-sm font-semibold" style={{ color: group.color }}>{displayName}</span>
          )}
          <span className="text-xs text-gray-400 ml-1">({tasks.length})</span>
        </button>

        {confirmDelete ? (
          <div className="flex items-center gap-1 ml-2">
            <span className="text-xs text-gray-500">¿Eliminar?</span>
            <button onClick={() => setConfirmDelete(false)} className="text-xs px-2 py-0.5 rounded hover:bg-gray-100 text-gray-500">No</button>
            <button onClick={handleDelete} className="text-xs px-2 py-0.5 rounded bg-red-600 hover:bg-red-700 text-white">Sí</button>
          </div>
        ) : (
          <div ref={menuRef} className="relative opacity-0 group-hover/header:opacity-100 transition-opacity ml-1">
            <button
              onClick={e => { e.stopPropagation(); setMenuOpen(o => !o) }}
              className="p-0.5 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
            >
              <MoreHorizontal className="w-3.5 h-3.5" />
            </button>
            {menuOpen && (
              <div className="absolute left-0 top-6 z-20 w-40 bg-white rounded-lg shadow-lg border border-gray-100 py-1">
                <button
                  onClick={startEdit}
                  className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  <Pencil className="w-3.5 h-3.5" /> Renombrar
                </button>
                <button
                  onClick={() => { setMenuOpen(false); setConfirmDelete(true) }}
                  className="flex items-center gap-2 w-full px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Eliminar
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {!collapsed && (
        <div className="rounded-sm border border-gray-100 overflow-x-auto" style={{ borderLeft: `4px solid ${group.color}` }}>
          <table className="w-full min-w-[600px] border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="w-8 px-2" />
                <th className="py-2 px-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Elemento</th>
                {isColumnVisible('Responsable') && <th className="py-2 px-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide w-28">Responsable</th>}
                {isColumnVisible('Estado')      && <th className="py-2 px-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide w-32">Estado</th>}
                {isColumnVisible('Prioridad')   && <th className="py-2 px-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide w-28">Prioridad</th>}
                {isColumnVisible('UEN')         && <th className="py-1.5 px-2 text-xs font-medium text-gray-400 uppercase tracking-wide text-left w-28">UEN</th>}
                {isColumnVisible('Fecha límite') && <th className="py-2 px-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide w-32">Fecha límite</th>}
                {isColumnVisible('Archivo')     && <th className="py-2 px-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide w-24">Archivo</th>}
                {isColumnVisible('Texto')       && <th className="py-2 px-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Texto</th>}
              </tr>
            </thead>
            <tbody className="bg-white">
              {tasks.length === 0
                ? <tr><td colSpan={colSpan}><EmptyState /></td></tr>
                : tasks.map(task => <TaskRow key={task.id} task={task} />)
              }
              {adding ? (
                <tr className="border-t border-gray-100 bg-blue-50/40">
                  <td className="w-8 px-2" />
                  {/* Title */}
                  <td className="py-1.5 px-3">
                    <div className="flex items-center gap-2">
                      <input
                        ref={inputRef}
                        value={newTitle}
                        onChange={e => setNewTitle(e.target.value)}
                        onKeyDown={handleAddKeyDown}
                        placeholder="Nombre del elemento..."
                        className="flex-1 text-sm text-gray-800 bg-white border border-blue-400 rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-400 min-w-[180px]"
                      />
                      <button
                        onClick={commitAdd}
                        disabled={!newTitle.trim()}
                        className="p-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-200 text-white rounded-md transition-colors"
                        title="Confirmar (Enter)"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => { setNewTitle(''); setNewDeadline(''); setAdding(false) }}
                        className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded-md transition-colors"
                        title="Cancelar (Esc)"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                  {/* Responsable — empty on creation */}
                  {isColumnVisible('Responsable') && <td className="w-28" />}
                  {/* Estado — empty on creation */}
                  {isColumnVisible('Estado') && <td className="w-32" />}
                  {/* Prioridad — empty on creation */}
                  {isColumnVisible('Prioridad') && <td className="w-28" />}
                  {/* UEN — empty on creation */}
                  {isColumnVisible('UEN') && <td className="w-28" />}
                  {/* Fecha límite — input aligned with column */}
                  {isColumnVisible('Fecha límite') && (
                    <td className="py-1.5 px-2 w-32">
                      <input
                        type="date"
                        value={newDeadline}
                        onChange={e => setNewDeadline(e.target.value)}
                        onKeyDown={handleAddKeyDown}
                        className="w-full text-xs text-gray-700 bg-white border border-gray-300 rounded-md px-2 py-1 focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
                      />
                    </td>
                  )}
                  {isColumnVisible('Archivo') && <td className="w-24" />}
                  {isColumnVisible('Texto') && <td />}
                </tr>
              ) : (
                <tr className="border-t border-gray-100">
                  <td colSpan={colSpan}>
                    <button
                      onClick={() => setAdding(true)}
                      className="flex items-center gap-1 px-4 py-2 text-sm text-gray-400 hover:text-gray-600 hover:bg-gray-50 w-full transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Agregar elemento</span>
                    </button>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          <div className="flex border-t border-gray-100 bg-gray-50 h-4">
            <div className="flex-1" />
            {isColumnVisible('Estado') && <div className="w-32 px-1"><div className="h-2 mt-1 rounded" style={{ backgroundColor: group.color, opacity: 0.35 }} /></div>}
            {isColumnVisible('Prioridad') && <div className="w-28 px-1"><div className="h-2 mt-1 rounded bg-rose-400/30" /></div>}
            {isColumnVisible('Fecha límite') && <div className="w-32" />}
          </div>
        </div>
      )}
    </div>
  )
}
