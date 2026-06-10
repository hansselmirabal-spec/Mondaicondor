import { create } from 'zustand'
import type { PriorityType, MockBoard, MockComment, MockTask, MockUser, WorkspaceStatus } from '@/types'
import { mockComments } from '@/data/mockComments'

interface TaskMutation {
  status?: string
  priority?: PriorityType
  description?: string
  assigneeIds?: string[]
  deadline?: string | null
}

export interface DeadlineChange {
  from: string | null
  to: string | null
  at: string
  byId: string
  byName: string
}

interface BoardStore {
  taskMutations: Record<string, TaskMutation>
  updateTask: (taskId: string, patch: TaskMutation) => void
  getTaskMutation: (taskId: string) => TaskMutation

  deadlineHistory: Record<string, DeadlineChange[]>
  setDeadline: (taskId: string, from: string | null, to: string | null, byId: string, byName: string) => void
  getDeadlineHistory: (taskId: string) => DeadlineChange[]

  newTasks: MockTask[]
  addTask: (task: MockTask) => void
  removeTask: (taskId: string) => void

  apiTasks: MockTask[]
  setApiTasks: (tasks: MockTask[]) => void

  apiUsers: MockUser[]
  setApiUsers: (users: MockUser[]) => void

  workspaceStatuses: WorkspaceStatus[]
  setWorkspaceStatuses: (statuses: WorkspaceStatus[]) => void

  comments: MockComment[]
  addComment: (comment: MockComment) => void

  workspaces: Array<{ id: string; name: string; color: string }>
  setWorkspaces: (list: Array<{ id: string; name: string; color: string }>) => void
  workspace: { id: string; name: string; color: string } | null
  setWorkspace: (ws: { id: string; name: string; color: string }) => void
  updateWorkspace: (id: string, patch: { name?: string; color?: string }) => void
  removeWorkspace: (id: string) => void

  boards: MockBoard[]
  setBoards: (boards: MockBoard[] | ((prev: MockBoard[]) => MockBoard[])) => void
  addBoard: (board: MockBoard) => void
  removeBoard: (boardId: string) => void
  patchBoard: (boardId: string, patch: Partial<MockBoard>) => void

  removeGroup: (groupId: string) => void
  patchGroup: (groupId: string, patch: { name?: string; color?: string }) => void

  clearBoardData: () => void

  favorites: string[]
  toggleFavorite: (boardId: string) => void
  isFavorite: (boardId: string) => boolean
}

export const useBoardStore = create<BoardStore>((set, get) => ({
  taskMutations: {},

  updateTask: (taskId, patch) =>
    set(state => ({
      taskMutations: { ...state.taskMutations, [taskId]: { ...state.taskMutations[taskId], ...patch } },
    })),

  getTaskMutation: taskId => get().taskMutations[taskId] ?? {},

  deadlineHistory: {},
  setDeadline: (taskId, from, to, byId, byName) =>
    set(state => ({
      taskMutations: {
        ...state.taskMutations,
        [taskId]: { ...state.taskMutations[taskId], deadline: to },
      },
      deadlineHistory: {
        ...state.deadlineHistory,
        [taskId]: [
          ...(state.deadlineHistory[taskId] ?? []),
          { from, to, at: new Date().toISOString(), byId, byName },
        ],
      },
    })),
  getDeadlineHistory: taskId => get().deadlineHistory[taskId] ?? [],

  newTasks: [],
  addTask: task => set(state => ({ newTasks: [...state.newTasks, task] })),
  removeTask: taskId => set(state => ({
    newTasks: state.newTasks.filter(t => t.id !== taskId),
    apiTasks: state.apiTasks.filter(t => t.id !== taskId),
  })),

  apiTasks: [],
  setApiTasks: tasks => set(state => ({
    apiTasks: tasks,
    newTasks: state.newTasks.filter(t => !tasks.some(at => at.id === t.id)),
  })),

  apiUsers: [],
  setApiUsers: users => set({ apiUsers: users }),

  workspaceStatuses: [],
  setWorkspaceStatuses: statuses => set({ workspaceStatuses: statuses }),

  comments: [...mockComments],
  addComment: comment => set(state => ({ comments: [...state.comments, comment] })),

  workspaces: [],
  setWorkspaces: list => set({ workspaces: list }),
  workspace: null,
  setWorkspace: ws => set({ workspace: ws }),
  updateWorkspace: (id, patch) => set(state => ({
    workspaces: state.workspaces.map(w => w.id === id ? { ...w, ...patch } : w),
    workspace: state.workspace?.id === id ? { ...state.workspace, ...patch } : state.workspace,
  })),
  removeWorkspace: id => set(state => ({
    workspaces: state.workspaces.filter(w => w.id !== id),
    workspace: state.workspace?.id === id ? (state.workspaces.find(w => w.id !== id) ?? null) : state.workspace,
  })),

  boards: [],
  setBoards: boards =>
    set(state => ({
      boards: typeof boards === 'function' ? boards(state.boards) : boards,
    })),
  addBoard: board => set(state => ({ boards: [...state.boards, board] })),
  removeBoard: boardId => set(state => ({ boards: state.boards.filter(b => b.id !== boardId) })),
  patchBoard: (boardId, patch) =>
    set(state => ({
      boards: state.boards.map(b => (b.id === boardId ? { ...b, ...patch } : b)),
    })),

  removeGroup: groupId => set(state => ({
    boards: state.boards.map(b => ({
      ...b,
      groups: b.groups.filter(g => g.id !== groupId),
    })),
    apiTasks: state.apiTasks.filter(t => t.groupId !== groupId),
    newTasks: state.newTasks.filter(t => t.groupId !== groupId),
  })),

  patchGroup: (groupId, patch) => set(state => ({
    boards: state.boards.map(b => ({
      ...b,
      groups: b.groups.map(g => g.id === groupId ? { ...g, ...patch } : g),
    })),
  })),

  clearBoardData: () => set({
    apiTasks: [],
    newTasks: [],
    taskMutations: {},
    deadlineHistory: {},
    workspaceStatuses: [],
    comments: [],
    boards: [],
  }),

  favorites: [],
  toggleFavorite: boardId =>
    set(state => ({
      favorites: state.favorites.includes(boardId)
        ? state.favorites.filter(id => id !== boardId)
        : [...state.favorites, boardId],
    })),
  isFavorite: boardId => get().favorites.includes(boardId),
}))
