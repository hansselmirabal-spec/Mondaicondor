import { BarChart2, Kanban, Plus, Table2 } from 'lucide-react'
import { useState } from 'react'
import { useFilterStore } from '@/store/filterStore'
import { Modal } from '@/components/ui/Modal'

export function BoardViewTabs() {
  const { activeView, setActiveView } = useFilterStore()
  const [addViewModal, setAddViewModal] = useState(false)

  const tabs = [
    { key: 'table' as const,  label: 'Tabla principal', icon: <Table2 className="w-3.5 h-3.5" /> },
    { key: 'chart' as const,  label: 'Gráfico',         icon: <BarChart2 className="w-3.5 h-3.5" /> },
    { key: 'kanban' as const, label: 'Kanban',          icon: <Kanban className="w-3.5 h-3.5" /> },
  ]

  return (
    <>
      <div className="flex items-center border-b border-gray-200 px-4 bg-white">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveView(tab.key)}
            className={`flex items-center gap-1.5 px-3 py-2.5 text-sm border-b-2 transition-colors mr-1 ${
              activeView === tab.key
                ? 'border-blue-600 text-blue-600 font-medium'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
        <button
          onClick={() => setAddViewModal(true)}
          className="flex items-center gap-1 px-2 py-2.5 text-sm text-gray-400 hover:text-gray-600 border-b-2 border-transparent ml-1"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Agregar vista</span>
        </button>
      </div>

      <Modal isOpen={addViewModal} onClose={() => setAddViewModal(false)} title="Agregar vista" size="sm">
        <div className="p-5 space-y-4">
          <p className="text-sm text-gray-600">Creá una vista personalizada para este tablero.</p>
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Nombre de la vista</label>
            <input className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Mi vista personalizada" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Tipo de vista</label>
            <select className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option>Tabla</option>
              <option>Kanban</option>
              <option>Gráfico</option>
              <option>Calendario</option>
              <option>Línea de tiempo</option>
            </select>
          </div>
          <div className="flex gap-2 pt-2">
            <button onClick={() => setAddViewModal(false)} className="flex-1 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">Cancelar</button>
            <button onClick={() => setAddViewModal(false)} className="flex-1 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors">Crear vista</button>
          </div>
        </div>
      </Modal>
    </>
  )
}
