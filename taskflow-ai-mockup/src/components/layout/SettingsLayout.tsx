import { NavLink, Outlet } from 'react-router-dom'
import { LayoutList, Mail, Users, ChevronDown } from 'lucide-react'
import { useBoardStore } from '@/store/boardStore'

export function SettingsLayout() {
  const { workspace, workspaces, setWorkspace } = useBoardStore()
  const currentWorkspace = workspace ?? workspaces[0] ?? null

  return (
    <div className="flex-1 flex overflow-hidden">
      {/* Sidebar */}
      <aside className="w-56 shrink-0 border-r border-gray-200 bg-white flex flex-col">
        <div className="px-4 py-4 border-b border-gray-100">
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-2">Configuración</p>

          {/* Workspace switcher */}
          <div className="relative">
            <select
              value={currentWorkspace?.id ?? ''}
              onChange={e => {
                const ws = workspaces.find(w => w.id === e.target.value)
                if (ws) setWorkspace(ws)
              }}
              className="w-full appearance-none bg-gray-50 border border-gray-200 text-sm font-medium text-gray-800 rounded-lg px-3 py-2 pr-8 focus:outline-none focus:ring-2 focus:ring-orange-400 cursor-pointer truncate"
            >
              {workspaces.length === 0 && currentWorkspace && (
                <option value={currentWorkspace.id}>{currentWorkspace.name}</option>
              )}
              {workspaces.map(ws => (
                <option key={ws.id} value={ws.id}>{ws.name}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
          </div>
        </div>

        <nav className="p-2 flex flex-col gap-0.5">
          <NavLink
            to="/settings/statuses"
            className={({ isActive }) =>
              `flex items-center gap-2.5 px-3 py-2 text-sm rounded-lg transition-colors ${
                isActive ? 'bg-orange-50 text-orange-600 font-medium' : 'text-gray-600 hover:bg-gray-50'
              }`
            }
          >
            <LayoutList className="w-4 h-4 shrink-0" />
            Estados
          </NavLink>
          <NavLink
            to="/settings/email-alerts"
            className={({ isActive }) =>
              `flex items-center gap-2.5 px-3 py-2 text-sm rounded-lg transition-colors ${
                isActive ? 'bg-orange-50 text-orange-600 font-medium' : 'text-gray-600 hover:bg-gray-50'
              }`
            }
          >
            <Mail className="w-4 h-4 shrink-0" />
            Alertas por correo
          </NavLink>
          <NavLink
            to="/settings/members"
            className={({ isActive }) =>
              `flex items-center gap-2.5 px-3 py-2 text-sm rounded-lg transition-colors ${
                isActive ? 'bg-orange-50 text-orange-600 font-medium' : 'text-gray-600 hover:bg-gray-50'
              }`
            }
          >
            <Users className="w-4 h-4 shrink-0" />
            Miembros
          </NavLink>
        </nav>
      </aside>

      {/* Content area */}
      <div className="flex-1 overflow-auto">
        <Outlet />
      </div>
    </div>
  )
}
