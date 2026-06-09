import { useState, useRef, useEffect } from 'react'
import { Camera, Loader2, Check, Eye, EyeOff } from 'lucide-react'
import { Modal } from './Modal'
import { api } from '@/lib/api'
import { useAuthStore } from '@/store/authStore'

const COLORS = ['#e2445c', '#579bfc', '#00c875', '#fdab3d', '#a25ddc', '#00c2cd', '#ff7575', '#037f4c', '#6366f1', '#ec4899']

interface ProfileModalProps {
  isOpen: boolean
  onClose: () => void
}

export function ProfileModal({ isOpen, onClose }: ProfileModalProps) {
  const { user, setUser } = useAuthStore()

  const [name, setName] = useState(user?.name ?? '')
  const [color, setColor] = useState(user?.color ?? '#6366f1')
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [avatarFile, setAvatarFile] = useState<File | null>(null)

  const [currentPwd, setCurrentPwd] = useState('')
  const [newPwd, setNewPwd] = useState('')
  const [confirmPwd, setConfirmPwd] = useState('')
  const [showPwd, setShowPwd] = useState(false)

  const [saving, setSaving] = useState(false)
  const [savingPwd, setSavingPwd] = useState(false)
  const [profileError, setProfileError] = useState<string | null>(null)
  const [pwdError, setPwdError] = useState<string | null>(null)
  const [pwdSuccess, setPwdSuccess] = useState(false)

  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isOpen) {
      setName(user?.name ?? '')
      setColor(user?.color ?? '#6366f1')
      setAvatarPreview(null)
      setAvatarFile(null)
      setProfileError(null)
    }
  }, [isOpen])

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setAvatarFile(file)
    const reader = new FileReader()
    reader.onload = ev => setAvatarPreview(ev.target?.result as string)
    reader.readAsDataURL(file)
  }

  async function handleSaveProfile() {
    if (!name.trim()) return
    setSaving(true)
    setProfileError(null)
    try {
      let updatedUser = user!
      if (avatarFile) {
        const { user: u } = await api.users.uploadAvatar(avatarFile)
        updatedUser = u
      }
      const { user: u2 } = await api.users.updateProfile({
        name: name.trim(),
        color,
        ...(avatarFile ? {} : {}),
      })
      setUser({ ...updatedUser, ...u2 })
      setAvatarFile(null)
      onClose()
    } catch (err) {
      setProfileError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  async function handleChangePassword() {
    if (newPwd !== confirmPwd) { setPwdError('Las contraseñas no coinciden'); return }
    if (newPwd.length < 8) { setPwdError('Mínimo 8 caracteres'); return }
    setSavingPwd(true)
    setPwdError(null)
    setPwdSuccess(false)
    try {
      await api.users.changePassword(currentPwd, newPwd)
      setPwdSuccess(true)
      setCurrentPwd(''); setNewPwd(''); setConfirmPwd('')
    } catch (err) {
      setPwdError((err as Error).message)
    } finally {
      setSavingPwd(false)
    }
  }

  const displayAvatar = avatarPreview ?? user?.avatarUrl ?? null
  const initials = name.trim().split(' ').slice(0, 2).map(w => w[0]?.toUpperCase() ?? '').join('') || user?.initials || '?'

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Mi perfil" size="md">
      <div className="p-5 space-y-5">

        {/* Avatar */}
        <div className="flex flex-col items-center gap-2">
          <div className="relative group">
            <div
              className="w-20 h-20 rounded-full overflow-hidden flex items-center justify-center text-white text-xl font-bold cursor-pointer"
              style={{ backgroundColor: displayAvatar ? undefined : color }}
              onClick={() => fileRef.current?.click()}
            >
              {displayAvatar
                ? <img src={displayAvatar} alt="avatar" className="w-full h-full object-cover" />
                : initials
              }
            </div>
            <button
              onClick={() => fileRef.current?.click()}
              className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
            >
              <Camera className="w-6 h-6 text-white" />
            </button>
          </div>
          <button
            onClick={() => fileRef.current?.click()}
            className="text-xs text-blue-600 hover:text-blue-700 font-medium transition-colors"
          >
            Cambiar foto
          </button>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
          {avatarFile && (
            <p className="text-xs text-gray-400">{avatarFile.name}</p>
          )}
        </div>

        <hr className="border-gray-100" />

        {/* Profile fields */}
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Nombre completo</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Email</label>
            <input
              value={user?.email ?? ''}
              readOnly
              className="w-full px-3 py-2 border border-gray-100 rounded-lg text-sm bg-gray-50 text-gray-400 cursor-not-allowed"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-2">Color de avatar</label>
            <div className="flex gap-2 flex-wrap">
              {COLORS.map(c => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className={`w-7 h-7 rounded-full transition-transform ${color === c ? 'ring-2 ring-offset-2 ring-gray-400 scale-110' : 'hover:scale-110'}`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          {profileError && <p className="text-xs text-red-600">{profileError}</p>}

          <button
            onClick={handleSaveProfile}
            disabled={!name.trim() || saving}
            className="w-full py-2 text-sm bg-blue-600 hover:bg-blue-700 disabled:bg-blue-200 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Guardar cambios
          </button>
        </div>

        <hr className="border-gray-100" />

        {/* Password change */}
        <div className="space-y-3">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Cambiar contraseña</p>
          <div className="relative">
            <input
              type={showPwd ? 'text' : 'password'}
              value={currentPwd}
              onChange={e => setCurrentPwd(e.target.value)}
              placeholder="Contraseña actual"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 pr-9"
            />
          </div>
          <div className="relative">
            <input
              type={showPwd ? 'text' : 'password'}
              value={newPwd}
              onChange={e => setNewPwd(e.target.value)}
              placeholder="Nueva contraseña (mín. 8 caracteres)"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 pr-9"
            />
            <button onClick={() => setShowPwd(v => !v)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          <input
            type={showPwd ? 'text' : 'password'}
            value={confirmPwd}
            onChange={e => setConfirmPwd(e.target.value)}
            placeholder="Confirmar nueva contraseña"
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {pwdError && <p className="text-xs text-red-600">{pwdError}</p>}
          {pwdSuccess && (
            <p className="text-xs text-green-600 flex items-center gap-1">
              <Check className="w-3 h-3" /> Contraseña actualizada correctamente
            </p>
          )}
          <button
            onClick={handleChangePassword}
            disabled={!currentPwd || !newPwd || !confirmPwd || savingPwd}
            className="w-full py-2 text-sm bg-gray-800 hover:bg-gray-900 disabled:bg-gray-200 disabled:text-gray-400 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            {savingPwd && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Actualizar contraseña
          </button>
        </div>

      </div>
    </Modal>
  )
}
