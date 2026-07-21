import { useRef } from 'react'
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  horizontalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, ArrowUp, ArrowDown, ChevronsUpDown } from 'lucide-react'
import { useFilterStore, DEFAULT_WIDTHS, type SortField } from '@/store/filterStore'

// Columns whose header doubles as a click-to-sort control
const SORTABLE_COLUMN: Record<string, Extract<SortField, 'createdAt' | 'deadline'>> = {
  'Fecha creación': 'createdAt',
  'Fecha límite': 'deadline',
}

const MIN_WIDTH = 80
const MAX_WIDTH = 600

interface SortableHeaderCellProps {
  col: string
}

function SortableHeaderCell({ col }: SortableHeaderCellProps) {
  const columnWidths = useFilterStore(s => s.columnWidths)
  const setColumnWidth = useFilterStore(s => s.setColumnWidth)
  const sortField = useFilterStore(s => s.sortField)
  const sortDir = useFilterStore(s => s.sortDir)
  const setSortBy = useFilterStore(s => s.setSortBy)

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: col })

  const width = columnWidths[col] ?? DEFAULT_WIDTHS[col] ?? 112

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    width,
    position: 'relative',
    opacity: isDragging ? 0.6 : 1,
    zIndex: isDragging ? 20 : undefined,
    background: isDragging ? '#eef2ff' : undefined,
  }

  const sortable = SORTABLE_COLUMN[col]

  function toggleSort() {
    const field = SORTABLE_COLUMN[col]
    if (!field) return
    if (sortField !== field) setSortBy(field, 'asc')
    else if (sortDir === 'asc') setSortBy(field, 'desc')
    else setSortBy(null)
  }

  function startResize(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    const startX = e.clientX
    const startW = width
    document.body.style.userSelect = 'none'
    document.body.style.cursor = 'col-resize'
    function onMove(ev: MouseEvent) {
      const next = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, startW + ev.clientX - startX))
      setColumnWidth(col, next)
    }
    function onUp() {
      document.body.style.userSelect = ''
      document.body.style.cursor = ''
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }

  return (
    <th
      ref={setNodeRef}
      style={style}
      className="group/col py-2 px-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide select-none"
    >
      <div className="flex items-center gap-1">
        {/* Drag handle — only this initiates the column reorder */}
        <button
          type="button"
          {...attributes}
          {...listeners}
          title="Arrastrar para reordenar"
          className="opacity-0 group-hover/col:opacity-100 transition-opacity cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-500 -ml-1 shrink-0"
        >
          <GripVertical className="w-3.5 h-3.5" />
        </button>

        {sortable ? (
          <button
            type="button"
            onClick={toggleSort}
            title={col === 'Fecha creación' ? 'Ordenar por fecha de creación' : 'Ordenar por fecha límite'}
            className="inline-flex items-center gap-1 uppercase tracking-wide hover:text-gray-700 transition-colors truncate"
          >
            {col === 'Fecha creación' ? 'Creado' : col}
            {sortField === sortable
              ? (sortDir === 'asc'
                  ? <ArrowUp className="w-3 h-3 text-blue-600 shrink-0" />
                  : <ArrowDown className="w-3 h-3 text-blue-600 shrink-0" />)
              : <ChevronsUpDown className="w-3 h-3 text-gray-300 shrink-0" />}
          </button>
        ) : (
          <span className="truncate">{col}</span>
        )}
      </div>

      {/* Resize handle — subtle separator, highlights on hover */}
      <div
        onMouseDown={startResize}
        title="Arrastrar para redimensionar"
        className="absolute right-0 top-1/2 -translate-y-1/2 h-5 w-1 rounded cursor-col-resize bg-gray-200 group-hover/col:bg-gray-300 hover:!bg-blue-500 transition-colors"
      />
    </th>
  )
}

interface ColumnHeaderRowProps {
  orderedVisible: string[]
}

export function ColumnHeaderRow({ orderedVisible }: ColumnHeaderRowProps) {
  const columnOrder = useFilterStore(s => s.columnOrder)
  const setColumnOrder = useFilterStore(s => s.setColumnOrder)

  // Small activation distance so a plain click (e.g. on the sort control) never starts a drag
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  const draggingRef = useRef(false)

  function handleDragEnd(e: DragEndEvent) {
    draggingRef.current = false
    const { active, over } = e
    if (!over || active.id === over.id) return
    const from = columnOrder.indexOf(String(active.id))
    const to = columnOrder.indexOf(String(over.id))
    if (from === -1 || to === -1) return
    setColumnOrder(arrayMove(columnOrder, from, to))
  }

  return (
    <thead>
      <tr className="bg-gray-50 border-b border-gray-200">
        <th className="w-8 px-2" />
        <th className="py-2 px-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide min-w-[200px]">
          Elemento
        </th>
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={() => { draggingRef.current = true }}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={orderedVisible} strategy={horizontalListSortingStrategy}>
            {orderedVisible.map(col => (
              <SortableHeaderCell key={col} col={col} />
            ))}
          </SortableContext>
        </DndContext>
      </tr>
    </thead>
  )
}
