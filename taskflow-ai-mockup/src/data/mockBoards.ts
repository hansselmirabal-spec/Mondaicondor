import type { MockBoard } from '@/types'

export const mockBoards: MockBoard[] = [
  {
    id: 'board-main',
    workspaceId: 'ws-digital',
    name: 'Mi tablero',
    description: '',
    isPrivate: false,
    groups: [
      { id: 'group-default', boardId: 'board-main', name: 'Sin grupo', color: '#3b82f6' },
    ],
  },
]

export function getBoardById(id: string): MockBoard | undefined {
  return mockBoards.find(b => b.id === id)
}
