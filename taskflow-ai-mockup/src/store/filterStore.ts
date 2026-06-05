import { create } from 'zustand'
import type { PriorityType } from '@/types'

export type ViewTab = 'table' | 'chart' | 'kanban'
export type SortField = 'title' | 'priority' | 'deadline' | 'status'
export type GroupBy = 'default' | 'status' | 'priority' | 'assignee'

export const ALL_COLUMNS = ['Responsable', 'Estado', 'Prioridad', 'Deadline', 'Archivo', 'Texto'] as const
export type ColumnName = typeof ALL_COLUMNS[number]

interface FilterStore {
  searchQuery: string
  setSearchQuery: (q: string) => void

  selectedPersonaId: string | null
  setSelectedPersonaId: (id: string | null) => void

  filterStatus: string | null
  setFilterStatus: (s: string | null) => void

  filterPriority: PriorityType | null
  setFilterPriority: (p: PriorityType | null) => void

  sortField: SortField | null
  sortDir: 'asc' | 'desc'
  setSortBy: (field: SortField | null, dir?: 'asc' | 'desc') => void

  hiddenColumns: string[]
  toggleColumn: (col: string) => void
  isColumnVisible: (col: string) => boolean

  groupBy: GroupBy
  setGroupBy: (g: GroupBy) => void

  activeView: ViewTab
  setActiveView: (v: ViewTab) => void

  clearFilters: () => void
}

export const useFilterStore = create<FilterStore>((set, get) => ({
  searchQuery: '',
  setSearchQuery: q => set({ searchQuery: q }),

  selectedPersonaId: null,
  setSelectedPersonaId: id => set({ selectedPersonaId: id }),

  filterStatus: null,
  setFilterStatus: s => set({ filterStatus: s }),

  filterPriority: null,
  setFilterPriority: p => set({ filterPriority: p }),

  sortField: null,
  sortDir: 'asc',
  setSortBy: (field, dir = 'asc') => set({ sortField: field, sortDir: dir }),

  hiddenColumns: [],
  toggleColumn: col =>
    set(state => ({
      hiddenColumns: state.hiddenColumns.includes(col)
        ? state.hiddenColumns.filter(c => c !== col)
        : [...state.hiddenColumns, col],
    })),
  isColumnVisible: col => !get().hiddenColumns.includes(col),

  groupBy: 'default',
  setGroupBy: g => set({ groupBy: g }),

  activeView: 'table',
  setActiveView: v => set({ activeView: v }),

  clearFilters: () =>
    set({ searchQuery: '', selectedPersonaId: null, filterStatus: null, filterPriority: null, sortField: null, sortDir: 'asc', groupBy: 'default' }),
}))
