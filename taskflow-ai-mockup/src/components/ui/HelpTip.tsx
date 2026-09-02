import { useState, useRef, useEffect } from 'react'
import { Info, X } from 'lucide-react'

interface HelpTipProps {
  title: string
  children: React.ReactNode
  side?: 'right' | 'bottom'
}

export function HelpTip({ title, children, side = 'bottom' }: HelpTipProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  const positionClasses = side === 'right'
    ? 'left-full top-1/2 -translate-y-1/2 ml-2'
    : 'top-full left-0 mt-2'

  return (
    <div ref={ref} className="relative inline-flex align-middle">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        title={title}
        aria-label={`Ayuda: ${title}`}
        className="inline-flex items-center justify-center w-[18px] h-[18px] rounded-full text-gray-400 hover:text-primary-600 transition-colors"
      >
        <Info className="w-[18px] h-[18px]" />
      </button>
      {open && (
        <div className={`absolute ${positionClasses} z-50 w-72 max-w-[320px] bg-white border border-gray-200 rounded-xl shadow-xl p-4`}>
          <div className="flex items-start justify-between gap-2 mb-1.5">
            <p className="text-sm font-bold text-gray-900">{title}</p>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Cerrar ayuda"
              className="p-0.5 text-gray-300 hover:text-gray-600 transition-colors shrink-0"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="text-sm text-gray-600 leading-relaxed space-y-1.5">
            {children}
          </div>
        </div>
      )}
    </div>
  )
}
