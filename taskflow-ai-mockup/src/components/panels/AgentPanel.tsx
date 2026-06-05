import { X, LayoutDashboard, AlertTriangle, Zap, Wand2, Bot, ChevronRight, Loader2, CheckCircle } from 'lucide-react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { mockAgents } from '@/data/mockAgents'
import type { MockAgent } from '@/types'

const ICON_MAP: Record<string, React.ReactNode> = {
  LayoutDashboard: <LayoutDashboard className="w-5 h-5" />,
  AlertTriangle:   <AlertTriangle className="w-5 h-5" />,
  Zap:             <Zap className="w-5 h-5" />,
  Wand2:           <Wand2 className="w-5 h-5" />,
  Bot:             <Bot className="w-5 h-5" />,
}

function AgentCard({ agent }: { agent: MockAgent }) {
  const [state, setState] = useState<'idle' | 'running' | 'done'>('idle')

  function run() {
    setState('running')
    setTimeout(() => setState('done'), 2000)
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 hover:border-purple-300 hover:shadow-sm transition-all">
      <div className="flex items-start gap-3 mb-3">
        <div className="w-9 h-9 rounded-lg bg-purple-100 flex items-center justify-center text-purple-600 shrink-0">
          {ICON_MAP[agent.iconName] ?? <Bot className="w-5 h-5" />}
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-semibold text-gray-900">{agent.name}</h4>
          <p className="text-xs text-gray-500 mt-0.5">{agent.description}</p>
        </div>
      </div>

      <div className="bg-gray-50 rounded-lg p-3 space-y-2">
        <p className="text-xs text-gray-600 leading-relaxed">{agent.output.summary}</p>
        <ul className="space-y-1">
          {agent.output.items.map((item, i) => (
            <li key={i} className="text-xs text-gray-600 flex gap-1.5">
              <span className="text-purple-500 shrink-0 mt-0.5">•</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
        <div className="pt-1 border-t border-gray-200">
          <p className="text-xs font-medium text-purple-700">{agent.output.recommendation}</p>
        </div>
      </div>

      {state === 'done' && (
        <div className="mt-3 flex items-center gap-2 text-green-700 bg-green-50 rounded-lg px-3 py-2">
          <CheckCircle className="w-4 h-4 shrink-0" />
          <span className="text-xs font-medium">Agente ejecutado correctamente.</span>
        </div>
      )}

      <button
        onClick={run}
        disabled={state === 'running' || state === 'done'}
        className="mt-3 w-full flex items-center justify-center gap-1.5 px-3 py-1.5 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-300 text-white text-xs font-medium rounded-lg transition-colors"
      >
        {state === 'running'
          ? <><Loader2 className="w-3 h-3 animate-spin" /> Ejecutando...</>
          : state === 'done'
          ? <><CheckCircle className="w-3 h-3" /> Ejecutado</>
          : <><Zap className="w-3 h-3" /> Ejecutar agente</>
        }
      </button>
    </div>
  )
}

export function AgentPanel() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const isOpen = searchParams.get('panel') === 'agents'

  function close() {
    const params = new URLSearchParams(searchParams)
    params.delete('panel')
    navigate('?' + params.toString())
  }

  useEffect(() => {
    if (!isOpen) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') close() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [isOpen])

  if (!isOpen) return null

  return (
    <>
      <div className="fixed inset-0 bg-black/10 z-40" onClick={close} />
      <aside className="fixed right-0 top-0 h-full w-[520px] bg-gray-50 shadow-2xl z-50 flex flex-col border-l border-gray-200 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 bg-white border-b border-gray-200">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-purple-600 flex items-center justify-center">
              <Bot className="w-4 h-4 text-white" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-gray-900">Agentes IA</h2>
              <p className="text-xs text-gray-500">Insights automáticos del tablero</p>
            </div>
          </div>
          <button onClick={close} className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 scrollbar-thin">
          <div className="flex items-center gap-1.5 text-xs text-purple-600 font-medium bg-purple-50 px-3 py-2 rounded-lg">
            <Zap className="w-3.5 h-3.5" />
            <span>5 agentes analizaron tu tablero en tiempo real</span>
            <ChevronRight className="w-3.5 h-3.5 ml-auto" />
          </div>
          {mockAgents.map(agent => <AgentCard key={agent.id} agent={agent} />)}
        </div>
      </aside>
    </>
  )
}
