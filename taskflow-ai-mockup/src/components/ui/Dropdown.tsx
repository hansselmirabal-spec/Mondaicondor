import { useEffect, useRef, type ReactNode } from 'react'

interface DropdownProps {
  trigger: ReactNode
  children: ReactNode
  isOpen: boolean
  onClose: () => void
  align?: 'left' | 'right'
  width?: string
}

export function Dropdown({ trigger, children, isOpen, onClose, align = 'left', width = 'w-52' }: DropdownProps) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isOpen) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [isOpen, onClose])

  return (
    <div ref={ref} className="relative">
      {trigger}
      {isOpen && (
        <div className={`absolute top-full mt-1 z-50 bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden ${width} ${align === 'right' ? 'right-0' : 'left-0'}`}>
          {children}
        </div>
      )}
    </div>
  )
}

interface DropdownItemProps {
  onClick: () => void
  children: ReactNode
  active?: boolean
  danger?: boolean
}

export function DropdownItem({ onClick, children, active = false, danger = false }: DropdownItemProps) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-3 py-2 text-sm transition-colors flex items-center gap-2 ${
        danger ? 'text-red-600 hover:bg-red-50'
        : active ? 'bg-primary-50 text-primary-700 font-medium'
        : 'text-gray-700 hover:bg-gray-50'
      }`}
    >
      {children}
    </button>
  )
}
