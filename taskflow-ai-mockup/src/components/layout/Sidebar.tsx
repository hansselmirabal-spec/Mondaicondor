import {
  LayoutGrid, Users, Star, MoreHorizontal, Sidebar as SidebarIcon,
  LogOut, Settings, User as UserIcon, Bell, X, Check, ShieldCheck, BarChart2, ClipboardList
} from 'lucide-react'
import { useState, useRef, useEffect, useCallback } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { WorkspaceSelector } from './WorkspaceSelector'
import { BoardList } from './BoardList'
import { toast } from '@/components/ui/Toast'
import { useAuthStore } from '@/store/authStore'
import { ProfileModal } from '@/components/ui/ProfileModal'
import { api } from '@/lib/api'
import type { ApiNotification } from '@/lib/api'

interface NavIconProps {
  icon: React.ReactNode
  label: string
  active?: boolean
  onClick?: () => void
}

function NavIcon({ icon, label, active = false, onClick }: NavIconProps) {
  return (
    <button
      title={label}
      onClick={onClick}
      className={`flex flex-col items-center gap-0.5 py-2 px-1 rounded-lg transition-colors w-full ${
        active ? 'bg-white/20 text-white' : 'text-white/50 hover:text-white hover:bg-white/10'
      }`}
    >
      {icon}
      <span className="text-[10px] leading-none">{label}</span>
    </button>
  )
}

export function Sidebar() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, logout } = useAuthStore()
  const [avatarOpen, setAvatarOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [bellOpen, setBellOpen] = useState(false)
  const [notifications, setNotifications] = useState<ApiNotification[]>([])
  const avatarRef = useRef<HTMLDivElement>(null)
  const bellRef = useRef<HTMLDivElement>(null)

  const unreadCount = notifications.filter(n => !n.read).length

  const fetchNotifications = useCallback(async () => {
    try {
      const { notifications } = await api.notifications.list()
      setNotifications(notifications)
    } catch {}
  }, [])

  useEffect(() => {
    if (!user) return
    fetchNotifications()
    const interval = setInterval(fetchNotifications, 30_000)
    return () => clearInterval(interval)
  }, [user, fetchNotifications])

  useEffect(() => {
    if (!avatarOpen && !bellOpen) return
    function handler(e: MouseEvent) {
      if (avatarRef.current && !avatarRef.current.contains(e.target as Node)) setAvatarOpen(false)
      if (bellRef.current && !bellRef.current.contains(e.target as Node)) setBellOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [avatarOpen, bellOpen])

  async function markRead(id: string) {
    await api.notifications.markRead(id)
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))
  }

  async function markAllRead() {
    await api.notifications.markAllRead()
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
  }

  async function deleteNotification(id: string) {
    await api.notifications.delete(id)
    setNotifications(prev => prev.filter(n => n.id !== id))
  }

  function timeAgo(dateStr: string): string {
    const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000)
    if (diff < 60) return 'ahora'
    if (diff < 3600) return `${Math.floor(diff / 60)}m`
    if (diff < 86400) return `${Math.floor(diff / 3600)}h`
    return `${Math.floor(diff / 86400)}d`
  }

  return (
    <>
    <div className="hidden md:flex h-full shrink-0">
      {/* Icon rail — leftmost */}
      <div className="w-14 flex flex-col items-center py-3 gap-1 bg-[#1a1a2e] border-r border-white/10">
        {/* Avatar with profile dropdown */}
        <div ref={avatarRef} className="relative mb-2">
          <button
            onClick={() => setAvatarOpen(o => !o)}
            className="w-8 h-8 rounded-full overflow-hidden flex items-center justify-center text-white text-xs font-bold hover:ring-2 hover:ring-white/40 transition-all shrink-0"
            style={{ backgroundColor: user?.avatarUrl ? undefined : (user?.color ?? '#6366f1') }}
            title="Mi perfil"
          >
            {user?.avatarUrl
              ? <img src={user.avatarUrl} alt={user.name} className="w-full h-full object-cover" />
              : (user?.initials ?? '?')
            }
          </button>
          {avatarOpen && (
            <div className="absolute left-10 top-0 z-[200] bg-white rounded-xl shadow-2xl border border-gray-100 w-44 overflow-hidden">
              <div className="px-3 py-2.5 border-b border-gray-100">
                <p className="text-xs font-semibold text-gray-800">{user?.name ?? '—'}</p>
                <p className="text-xs text-gray-400">{user?.email ?? '—'}</p>
              </div>
              <div className="p-1">
                <button
                  onClick={() => { setAvatarOpen(false); setProfileOpen(true) }}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 rounded-lg transition-colors"
                >
                  <UserIcon className="w-3.5 h-3.5 text-gray-400" /> Mi perfil
                </button>
                <button
                  onClick={() => { logout(); navigate('/login') }}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                >
                  <LogOut className="w-3.5 h-3.5" /> Cerrar sesión
                </button>
              </div>
            </div>
          )}
        </div>

        <NavIcon icon={<LayoutGrid className="w-4 h-4" />} label="Espacio" active={!location.pathname.startsWith('/settings')} onClick={() => navigate('/boards')} />
        <NavIcon icon={<Users className="w-4 h-4" />} label="Equipo" onClick={() => navigate('/members')} />
        <NavIcon icon={<ClipboardList className="w-4 h-4" />} label="Mis tareas" active={location.pathname === '/mis-tareas'} onClick={() => navigate('/mis-tareas')} />
        <NavIcon icon={<BarChart2 className="w-4 h-4" />} label="Gerencia" active={location.pathname === '/gerencia'} onClick={() => navigate('/gerencia')} />
        <NavIcon icon={<Settings className="w-4 h-4" />} label="Config." active={location.pathname.startsWith('/settings')} onClick={() => navigate('/settings')} />
        {user?.isAppAdmin && (
          <NavIcon
            icon={<ShieldCheck className="w-5 h-5" />}
            label="Admin"
            active={location.pathname.startsWith('/system-admin')}
            onClick={() => navigate('/system-admin/users')}
          />
        )}
        <div className="flex-1" />

        {/* Notification bell */}
        <div ref={bellRef} className="relative w-full">
          <button
            title="Notificaciones"
            onClick={() => { setBellOpen(o => !o); if (!bellOpen) fetchNotifications() }}
            className={`relative flex flex-col items-center gap-0.5 py-2 px-1 rounded-lg transition-colors w-full ${bellOpen ? 'bg-white/20 text-white' : 'text-white/50 hover:text-white hover:bg-white/10'}`}
          >
            <Bell className="w-4 h-4" />
            <span className="text-[10px] leading-none">Notific.</span>
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1.5 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center leading-none">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {bellOpen && (
            <div className="absolute left-12 bottom-0 z-[200] bg-white rounded-xl shadow-2xl border border-gray-100 w-80 overflow-hidden">
              <div className="flex items-center justify-between px-3 py-2.5 border-b border-gray-100">
                <p className="text-xs font-semibold text-gray-800">
                  Notificaciones {unreadCount > 0 && <span className="text-red-500">({unreadCount} nuevas)</span>}
                </p>
                {unreadCount > 0 && (
                  <button onClick={markAllRead} className="text-xs text-primary-600 hover:underline">
                    Marcar todas
                  </button>
                )}
              </div>
              <div className="max-h-80 overflow-y-auto divide-y divide-gray-50">
                {notifications.length === 0 ? (
                  <p className="text-xs text-gray-400 text-center py-6">Sin notificaciones</p>
                ) : notifications.map(n => (
                  <div
                    key={n.id}
                    className={`flex items-start gap-2.5 px-3 py-2.5 group transition-colors ${n.read ? 'bg-white' : 'bg-primary-50'}`}
                  >
                    <div className="w-2 h-2 rounded-full mt-1.5 shrink-0" style={{ backgroundColor: n.read ? '#e5e7eb' : '#3b82f6' }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-gray-800 truncate">{n.title}</p>
                      <p className="text-xs text-gray-500 truncate">{n.body}</p>
                      <p className="text-[10px] text-gray-400 mt-0.5">{timeAgo(n.createdAt)}</p>
                    </div>
                    <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                      {!n.read && (
                        <button onClick={() => markRead(n.id)} title="Marcar como leída" className="p-1 text-gray-400 hover:text-primary-600 rounded">
                          <Check className="w-3 h-3" />
                        </button>
                      )}
                      <button onClick={() => deleteNotification(n.id)} title="Eliminar" className="p-1 text-gray-400 hover:text-red-500 rounded">
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <NavIcon icon={<Star className="w-4 h-4" />} label="Favoritos" onClick={() => navigate('/boards')} />
      </div>

      {/* Main sidebar panel */}
      <div className="w-52 flex flex-col bg-[#292944] overflow-visible">
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-3 border-b border-white/10">
          <span className="text-sm font-semibold text-white/80">Espacio de trabajo</span>
          <div className="flex items-center gap-1">
            <button className="p-1 text-white/40 hover:text-white rounded transition-colors">
              <MoreHorizontal className="w-3.5 h-3.5" />
            </button>
            <button className="p-1 text-white/40 hover:text-white rounded transition-colors">
              <SidebarIcon className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Workspace selector */}
        <WorkspaceSelector />

        {/* Board list */}
        <div className="flex-1 overflow-y-auto scrollbar-thin">
          <BoardList />
        </div>
      </div>
    </div>

    <ProfileModal isOpen={profileOpen} onClose={() => setProfileOpen(false)} />
    </>
  )
}
