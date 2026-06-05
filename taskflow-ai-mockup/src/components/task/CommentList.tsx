import { Send } from 'lucide-react'
import { useState } from 'react'
import { useBoardStore } from '@/store/boardStore'
import { useAuthStore } from '@/store/authStore'
import { AssigneeAvatar } from '@/components/ui/AssigneeAvatar'
import { api } from '@/lib/api'
import type { MockComment } from '@/types'

interface CommentListProps {
  taskId: string
}

export function CommentList({ taskId }: CommentListProps) {
  const allComments = useBoardStore(state => state.comments)
  const addComment = useBoardStore(state => state.addComment)
  const apiUsers = useBoardStore(state => state.apiUsers)
  const currentUser = useAuthStore(state => state.user)
  const comments = allComments.filter(c => c.taskId === taskId)
  const [draft, setDraft] = useState('')

  function formatTs(ts: string) {
    return new Date(ts).toLocaleString('es-PY', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
  }

  async function send() {
    const text = draft.trim()
    if (!text || !currentUser) return
    setDraft('')
    const tempComment: MockComment = {
      id: `temp-${Date.now()}`,
      taskId,
      authorId: currentUser.id,
      content: text,
      createdAt: new Date().toISOString(),
    }
    addComment(tempComment)
    try {
      await api.tasks.addComment(taskId, text)
    } catch {
      console.error('Error guardando comentario')
    }
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
  }

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-semibold text-gray-700">Comentarios ({comments.length})</h4>

      {comments.length === 0 && <p className="text-xs text-gray-400">Sin comentarios todavía.</p>}

      {comments.map(comment => {
        const author = apiUsers.find(u => u.id === comment.authorId)
        return (
          <div key={comment.id} className="flex gap-2">
            {author && <AssigneeAvatar userId={author.id} size="sm" />}
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline gap-2">
                <span className="text-xs font-semibold text-gray-800">{author?.name ?? 'Usuario'}</span>
                <span className="text-xs text-gray-400">{formatTs(comment.createdAt)}</span>
              </div>
              <p className="text-xs text-gray-600 mt-0.5 leading-relaxed">{comment.content}</p>
            </div>
          </div>
        )
      })}

      {currentUser && (
        <div className="flex gap-2 pt-1">
          <AssigneeAvatar userId={currentUser.id} size="sm" />
          <div className="flex-1 flex items-center border border-gray-200 rounded-lg px-3 py-2 bg-white focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-transparent">
            <input
              type="text"
              value={draft}
              onChange={e => setDraft(e.target.value)}
              onKeyDown={handleKey}
              placeholder="Escribí un comentario... (Enter para enviar)"
              className="flex-1 text-xs outline-none placeholder:text-gray-400"
            />
            <button
              onClick={send}
              disabled={!draft.trim()}
              className="text-blue-600 hover:text-blue-700 ml-2 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
