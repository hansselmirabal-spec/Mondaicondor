import { Send } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useBoardStore } from '@/store/boardStore'
import { useAuthStore } from '@/store/authStore'
import { AssigneeAvatar } from '@/components/ui/AssigneeAvatar'
import { api } from '@/lib/api'
import type { MockComment, MockUser } from '@/types'

interface CommentListProps {
  taskId: string
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function CommentList({ taskId }: CommentListProps) {
  const allComments = useBoardStore(state => state.comments)
  const addComment = useBoardStore(state => state.addComment)
  const setTaskComments = useBoardStore(state => state.setTaskComments)
  const apiUsers = useBoardStore(state => state.apiUsers)
  const currentUser = useAuthStore(state => state.user)
  const comments = allComments.filter(c => c.taskId === taskId)
  const [draft, setDraft] = useState('')
  const [mentionedUserIds, setMentionedUserIds] = useState<string[]>([])
  const [mentionQuery, setMentionQuery] = useState<string | null>(null)
  const [mentionStart, setMentionStart] = useState(-1)
  const inputRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  function loadComments() {
    api.tasks.get(taskId)
      .then(({ task }) => {
        setTaskComments(taskId, task.comments.map(c => ({
          id: c.id, taskId, authorId: c.author.id, content: c.content,
          mentionedUserIds: c.mentionedUserIds, createdAt: c.createdAt,
        })))
      })
      .catch(() => {})
  }

  useEffect(() => {
    loadComments()
    const poll = setInterval(loadComments, 5_000)
    return () => clearInterval(poll)
  }, [taskId])

  useEffect(() => {
    if (mentionQuery === null) return
    function handler(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setMentionQuery(null)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [mentionQuery])

  function formatTs(ts: string) {
    return new Date(ts).toLocaleString('es-PY', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
  }

  function handleDraftChange(e: React.ChangeEvent<HTMLInputElement>) {
    const value = e.target.value
    setDraft(value)

    const cursor = e.target.selectionStart ?? value.length
    const uptoCursor = value.slice(0, cursor)
    const atIndex = uptoCursor.lastIndexOf('@')
    if (atIndex === -1) { setMentionQuery(null); return }
    const between = uptoCursor.slice(atIndex + 1)
    if (/\s/.test(between)) { setMentionQuery(null); return }
    setMentionStart(atIndex)
    setMentionQuery(between)
  }

  function selectMention(user: MockUser) {
    if (mentionStart === -1) return
    const cursor = inputRef.current?.selectionStart ?? draft.length
    const before = draft.slice(0, mentionStart)
    const after = draft.slice(cursor)
    const insertion = `@${user.name} `
    const newValue = before + insertion + after
    setDraft(newValue)
    setMentionedUserIds(prev => prev.includes(user.id) ? prev : [...prev, user.id])
    setMentionQuery(null)
    setMentionStart(-1)

    requestAnimationFrame(() => {
      const pos = before.length + insertion.length
      inputRef.current?.focus()
      inputRef.current?.setSelectionRange(pos, pos)
    })
  }

  const mentionMatches = mentionQuery !== null
    ? apiUsers.filter(u => u.name.toLowerCase().includes(mentionQuery.toLowerCase()))
    : []

  async function send() {
    const text = draft.trim()
    if (!text || !currentUser) return
    // Only keep mention ids whose "@Name" text is still present — covers the
    // case where the user manually deleted a mention before sending.
    const finalMentionIds = mentionedUserIds.filter((id) => {
      const name = apiUsers.find(u => u.id === id)?.name
      return name ? text.includes(`@${name}`) : false
    })

    setDraft('')
    setMentionedUserIds([])
    setMentionQuery(null)
    const tempComment: MockComment = {
      id: `temp-${Date.now()}`,
      taskId,
      authorId: currentUser.id,
      content: text,
      mentionedUserIds: finalMentionIds,
      createdAt: new Date().toISOString(),
    }
    addComment(tempComment)
    try {
      const { comment } = await api.tasks.addComment(taskId, text, finalMentionIds)
      setTaskComments(taskId, [
        ...allComments.filter(c => c.taskId === taskId && c.id !== tempComment.id),
        {
          id: comment.id, taskId, authorId: comment.author.id, content: comment.content,
          mentionedUserIds: comment.mentionedUserIds, createdAt: comment.createdAt,
        },
      ])
    } catch {
      console.error('Error guardando comentario')
    }
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
    else if (e.key === 'Escape') { setMentionQuery(null) }
  }

  function renderContent(comment: MockComment) {
    const mentionNames = comment.mentionedUserIds
      .map(id => apiUsers.find(u => u.id === id)?.name)
      .filter((name): name is string => Boolean(name) && comment.content.includes(`@${name}`))
    if (mentionNames.length === 0) return comment.content

    // Longest names first so a shorter mentioned name can't shadow a longer
    // one that contains it (e.g. "@Ana" inside "@Ana Paredes").
    const sorted = [...new Set(mentionNames)].sort((a, b) => b.length - a.length)
    const pattern = sorted.map(n => `@${escapeRegExp(n)}`).join('|')
    const parts = comment.content.split(new RegExp(`(${pattern})`, 'g'))

    return parts.map((part, i) =>
      sorted.some(n => part === `@${n}`)
        ? <span key={i} className="text-primary-600 font-medium bg-primary-50 rounded px-1">{part}</span>
        : <span key={i}>{part}</span>,
    )
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
              <p className="text-xs text-gray-600 mt-0.5 leading-relaxed">{renderContent(comment)}</p>
            </div>
          </div>
        )
      })}

      {currentUser && (
        <div className="flex gap-2 pt-1">
          <AssigneeAvatar userId={currentUser.id} size="sm" />
          <div className="relative flex-1 flex items-center border border-gray-200 rounded-lg px-3 py-2 bg-white focus-within:ring-2 focus-within:ring-primary-500 focus-within:border-transparent">
            <input
              ref={inputRef}
              type="text"
              value={draft}
              onChange={handleDraftChange}
              onKeyDown={handleKey}
              placeholder="Escribí un comentario... (@ para mencionar, Enter para enviar)"
              className="flex-1 text-xs outline-none placeholder:text-gray-400"
            />
            <button
              onClick={send}
              disabled={!draft.trim()}
              className="text-primary-600 hover:text-primary-700 ml-2 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Send className="w-3.5 h-3.5" />
            </button>

            {mentionQuery !== null && (
              <div
                ref={dropdownRef}
                className="absolute left-0 top-full mt-1 z-50 w-56 max-h-56 overflow-y-auto bg-white border border-gray-200 rounded-xl shadow-xl"
              >
                {mentionMatches.length === 0 && (
                  <p className="text-xs text-gray-400 px-3 py-2 italic">Sin coincidencias</p>
                )}
                {mentionMatches.map(u => (
                  <button
                    key={u.id}
                    type="button"
                    onMouseDown={(e) => { e.preventDefault(); selectMention(u) }}
                    className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-primary-50 transition-colors"
                  >
                    <AssigneeAvatar userId={u.id} size="sm" />
                    <span className="text-xs text-gray-700">{u.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
