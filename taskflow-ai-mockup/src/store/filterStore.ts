import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { PriorityType } from '@/types'

export type ViewTab = 'table' | 'chart' | 'kanban'
export type SortField = 'title' | 'priority' | 'deadline' | 'status' | 'uen' | 'createdAt'
export type GroupBy = 'default' | 'status' | 'priority' | 'assignee'

export const ALL_COLUMNS = ['Responsable', 'Estado', 'Prioridad', 'UEN', 'Fecha límite', 'Archivo', 'Texto', 'Fecha creación', 'Grupo'] as const
export type ColumnName = typeof ALL_COLUMNS[number]

export const DEFAULT_WIDTHS: Record<string, number> = {
  'Responsable': 112,
  'Estado': 128,
  'Prioridad': 112,
  'UEN': 112,
  'Fecha límite': 128,
  'Archivo': 96,
  'Texto': 200,
  'Fecha creación': 128,
  'Grupo': 128,
}

// Custom field columns use the `cf:<definitionId>` id convention (see boardStore's
// setCustomFieldDefinitions). They aren't part of DEFAULT_WIDTHS since their set is
// dynamic per board, so this helper centralizes the fallback width instead of
// duplicating the `col.startsWith('cf:')` check across every consumer.
export function getDefaultColumnWidth(col: string): number {
  return DEFAULT_WIDTHS[col] ?? (col.startsWith('cf:') ? 120 : 112)
}

interface FilterStore {
  searchQuery: string
  setSearchQuery: (q: string) => void

  selectedPersonaId: string | null
  setSelectedPersonaId: (id: string | null) => void

  filterStatus: string | null
  setFilterStatus: (s: string | null) => void

  filterPriority: PriorityType | null
  setFilterPriority: (p: PriorityType | null) => void

  filterUenId: string | null
  setFilterUenId: (id: string | null) => void

  sortField: SortField | null
  sortDir: 'asc' | 'desc'
  setSortBy: (field: SortField | null, dir?: 'asc' | 'desc') => void

  hiddenColumns: string[]
  toggleColumn: (col: string) => void
  isColumnVisible: (col: string) => boolean

  columnOrder: string[]
  setColumnOrder: (order: string[]) => void

  columnWidths: Record<string, number>
  setColumnWidth: (col: string, width: number) => void

  groupBy: GroupBy
  setGroupBy: (g: GroupBy) => void

  activeView: ViewTab
  setActiveView: (v: ViewTab) => void

  clearFilters: () => void
}

export const useFilterStore = create<FilterStore>()(persist((set, get) => ({
  searchQuery: '',
  setSearchQuery: q => set({ searchQuery: q }),

  selectedPersonaId: null,
  setSelectedPersonaId: id => set({ selectedPersonaId: id }),

  filterStatus: null,
  setFilterStatus: s => set({ filterStatus: s }),

  filterPriority: null,
  setFilterPriority: p => set({ filterPriority: p }),

  filterUenId: null,
  setFilterUenId: id => set({ filterUenId: id }),

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

  columnOrder: [...ALL_COLUMNS],
  setColumnOrder: order => set({ columnOrder: order }),

  columnWidths: { ...DEFAULT_WIDTHS },
  setColumnWidth: (col, width) => set(state => ({
    columnWidths: { ...state.columnWidths, [col]: width },
  })),

  groupBy: 'default',
  setGroupBy: g => set({ groupBy: g }),

  activeView: 'table',
  setActiveView: v => set({ activeView: v }),

  clearFilters: () =>
    set({ searchQuery: '', selectedPersonaId: null, filterStatus: null, filterPriority: null, filterUenId: null, sortField: null, sortDir: 'asc', groupBy: 'default' }),
}), {
  name: 'taskflow-column-layout',
  // Persist only the column layout, not the transient filters/search/sort
  partialize: state => ({
    columnOrder: state.columnOrder,
    columnWidths: state.columnWidths,
    hiddenColumns: state.hiddenColumns,
  }),
}))
