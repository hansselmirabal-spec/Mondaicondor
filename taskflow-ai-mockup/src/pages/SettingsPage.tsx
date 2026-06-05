import { Settings, Bell, Users, Shield, Palette } from 'lucide-react'

const SETTINGS_SECTIONS = [
  { icon: <Settings className="w-4 h-4" />, title: 'General', description: 'Nombre del tablero, descripción y preferencias.' },
  { icon: <Bell className="w-4 h-4" />, title: 'Notificaciones', description: 'Configura cuándo y cómo recibir alertas.' },
  { icon: <Users className="w-4 h-4" />, title: 'Miembros', description: 'Invitaciones, roles y permisos del tablero.' },
  { icon: <Shield className="w-4 h-4" />, title: 'Permisos', description: 'Control de acceso por rol.' },
  { icon: <Palette className="w-4 h-4" />, title: 'Apariencia', description: 'Tema y personalización visual.' },
]

export function SettingsPage() {
  return (
    <div className="flex-1 overflow-auto p-6">
      <div className="max-w-2xl">
        <h1 className="text-xl font-bold text-gray-900 mb-1">Configuración del tablero</h1>
        <p className="text-sm text-gray-500 mb-6">Administrá las opciones del tablero Pendientes - Digital.</p>

        <div className="space-y-2">
          {SETTINGS_SECTIONS.map(section => (
            <button
              key={section.title}
              className="w-full flex items-center gap-4 p-4 bg-white rounded-xl border border-gray-200 hover:border-blue-300 hover:shadow-sm transition-all text-left group"
            >
              <div className="w-9 h-9 rounded-lg bg-gray-100 group-hover:bg-blue-50 flex items-center justify-center text-gray-500 group-hover:text-blue-600 transition-colors shrink-0">
                {section.icon}
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
                  {section.title}
                </p>
                <p className="text-xs text-gray-500">{section.description}</p>
              </div>
            </button>
          ))}
        </div>

        <div className="mt-8 p-4 bg-amber-50 border border-amber-200 rounded-xl">
          <p className="text-xs font-semibold text-amber-700 mb-1">Zona de peligro</p>
          <p className="text-xs text-amber-600 mb-3">Estas acciones son irreversibles.</p>
          <button className="px-3 py-1.5 text-xs font-medium text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors">
            Eliminar tablero
          </button>
        </div>
      </div>
    </div>
  )
}
