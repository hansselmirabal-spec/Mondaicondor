import { LayoutGrid, Bell, Settings, ShieldCheck } from 'lucide-react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useState, useCallback, useEffect } from 'react'
import { useAuthStore } from '@/store/authStore'
import { api } from '@/lib/api'

export function BottomNav() {
  const navigate = useNavigate()
  const location = useLocation()
  const user = useAuthStore(state => state.user)
  const [unread, setUnread] = useState(0)

  const fetchUnread = useCallback(async () => {
    try {
      const { notifications } = await api.notifications.list()
      setUnread(notifications.filter(n => !n.read).length)
    } catch {}
  }, [])

  useEffect(() => {
    if (!user) return
    fetchUnread()
    const t = setInterval(fetchUnread, 30_000)
    return () => clearInterval(t)
  }, [user, fetchUnread])

  const isBoards = location.pathname.startsWith('/boards')
  const isSettings = location.pathname.startsWith('/settings')
  const isAdmin = location.pathname.startsWith('/system-admin')

  return (
    <nav
      className="bg-[#1f1f1f] border-t border-white/10 md:hidden shrink-0"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="flex items-center justify-around h-14">
        <NavBtn
          icon={<LayoutGrid className="w-5 h-5" />}
          label="Tableros"
          active={isBoards}
          onClick={() => navigate('/boards')}
        />
        <NavBtn
          icon={
            <div className="relative">
              <Bell className="w-5 h-5" />
              {unread > 0 && (
                <span className="absolute -top-1 -right-1.5 min-w-[14px] h-[14px] bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center px-0.5">
                  {unread > 9 ? '9+' : unread}
                </span>
              )}
            </div>
          }
          label="Alertas"
          active={false}
          onClick={() => navigate('/settings/email-alerts')}
        />
        <NavBtn
          icon={<Settings className="w-5 h-5" />}
          label="Config."
          active={isSettings}
          onClick={() => navigate('/settings')}
        />
        {user?.isAppAdmin && (
          <NavBtn
            icon={<ShieldCheck className="w-5 h-5" />}
            label="Admin"
            active={isAdmin}
            onClick={() => navigate('/system-admin/users')}
          />
        )}
      </div>
    </nav>
  )
}

interface NavBtnProps {
  icon: React.ReactNode
  label: string
  active: boolean
  onClick: () => void
}

function NavBtn({ icon, label, active, onClick }: NavBtnProps) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center gap-0.5 py-1.5 px-4 rounded-lg transition-colors ${
        active ? 'text-indigo-400' : 'text-white/40 active:text-white/70'
      }`}
    >
      {icon}
      <span className="text-[10px] leading-none">{label}</span>
    </button>
  )
}
