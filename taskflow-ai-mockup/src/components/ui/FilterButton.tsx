import { ChevronDown } from 'lucide-react'
import type { ReactNode } from 'react'

interface FilterButtonProps {
  icon: ReactNode
  label: string
  onClick?: () => void
  active?: boolean
}

export function FilterButton({ icon, label, onClick, active = false }: FilterButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1 px-2 py-1.5 text-sm rounded-md transition-colors ${
        active
          ? 'bg-blue-50 text-blue-600 font-medium'
          : 'text-gray-600 hover:bg-gray-100'
      }`}
    >
      {icon}
      <span>{label}</span>
      <ChevronDown className="w-3 h-3 opacity-60" />
    </button>
  )
}
