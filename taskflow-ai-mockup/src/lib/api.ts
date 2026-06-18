const BASE = '/api'

function getToken(): string | null {
  return localStorage.getItem('access_token')
}

let isRefreshing = false
let refreshQueue: Array<(token: string) => void> = []

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = localStorage.getItem('refresh_token')
  if (!refreshToken) return null
  try {
    const res = await fetch(`${BASE}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    })
    if (!res.ok) return null
    const data = await res.json()
    localStorage.setItem('access_token', data.accessToken)
    localStorage.setItem('refresh_token', data.refreshToken)
    return data.accessToken
  } catch {
    return null
  }
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const token = getToken()
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options?.headers,
    },
  })

  if (res.status === 401) {
    // Auth endpoints handle their own 401s — don't attempt token refresh
    if (path.startsWith('/auth/')) {
      const err = await res.json().catch(() => ({ error: res.statusText }))
      throw new Error(err.error ?? 'Credenciales inválidas')
    }

    if (!isRefreshing) {
      isRefreshing = true
      const newToken = await refreshAccessToken()
      isRefreshing = false

      if (newToken) {
        refreshQueue.forEach(cb => cb(newToken))
        refreshQueue = []
        const retryRes = await fetch(`${BASE}${path}`, {
          ...options,
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${newToken}`,
            ...options?.headers,
          },
        })
        if (!retryRes.ok) {
          const err = await retryRes.json().catch(() => ({ error: retryRes.statusText }))
          throw new Error(typeof err.error === 'string' ? err.error : err.message ?? `Error ${retryRes.status}`)
        }
        return retryRes.json() as Promise<T>
      } else {
        refreshQueue.forEach(cb => cb(''))
        refreshQueue = []
        localStorage.removeItem('access_token')
        localStorage.removeItem('refresh_token')
        window.location.href = '/login'
        throw new Error('Sesión expirada')
      }
    } else {
      // Enqueue concurrent 401s to retry once the ongoing refresh completes
      return new Promise<T>((resolve, reject) => {
        refreshQueue.push(async (token: string) => {
          if (!token) {
            reject(new Error('Sesión expirada'))
            return
          }
          try {
            const retryRes = await fetch(`${BASE}${path}`, {
              ...options,
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
                ...options?.headers,
              },
            })
            if (!retryRes.ok) {
              const err = await retryRes.json().catch(() => ({ error: retryRes.statusText }))
              reject(new Error(typeof err.error === 'string' ? err.error : err.message ?? `Error ${retryRes.status}`))
            } else {
              resolve(retryRes.json() as T)
            }
          } catch (e) {
            reject(e)
          }
        })
      })
    }
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    const msg = typeof err.error === 'string'
      ? err.error
      : err.message ?? JSON.stringify(err)
    throw new Error(msg || `Error ${res.status}`)
  }

  return res.json() as Promise<T>
}

export const api = {
  auth: {
    login: (email: string, password: string) =>
      request<{ user: ApiUser; accessToken: string; refreshToken: string }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      }),

    register: (email: string, password: string, name: string) =>
      request<{ user: ApiUser; accessToken: string; refreshToken: string }>('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ email, password, name }),
      }),

    logout: (refreshToken: string) =>
      request<void>('/auth/logout', {
        method: 'POST',
        body: JSON.stringify({ refreshToken }),
      }),

    forgotPassword: (email: string) =>
      request<{ message: string }>('/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email }),
      }),

    resetPassword: (token: string, newPassword: string) =>
      request<{ message: string }>('/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ token, newPassword }),
      }),
  },

  users: {
    list: () => request<{ users: ApiUser[] }>('/users/list'),

    me: () => request<{ user: ApiUser }>('/users/me'),

    updateProfile: (data: { name?: string; color?: string; avatarUrl?: string | null }) =>
      request<{ user: ApiUser }>('/users/me', { method: 'PUT', body: JSON.stringify(data) }),

    uploadAvatar: async (file: File): Promise<{ user: ApiUser }> => {
      const token = getToken()
      const form = new FormData()
      form.append('file', file)
      const res = await fetch('/api/users/me/avatar', {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: form,
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }))
        throw new Error(err.error ?? 'Error al subir la imagen')
      }
      return res.json()
    },

    changePassword: (currentPassword: string, newPassword: string) =>
      request<{ message: string }>('/users/me/password', {
        method: 'PUT',
        body: JSON.stringify({ currentPassword, newPassword }),
      }),

    forceChangePassword: (newPassword: string) =>
      request<{ message: string }>('/users/me/force-change-password', {
        method: 'PUT',
        body: JSON.stringify({ newPassword }),
      }),

    getPreferences: () =>
      request<{ preferences: ApiUserPreferences | null }>('/users/me/preferences'),

    updatePreferences: (data: Partial<ApiUserPreferences>) =>
      request<{ preferences: ApiUserPreferences }>('/users/me/preferences', {
        method: 'PUT',
        body: JSON.stringify(data),
      }),

    search: (email: string) =>
      request<{ user: ApiUser | null }>(`/users/search?email=${encodeURIComponent(email)}`),
  },

  workspaces: {
    list: () => request<{ workspaces: ApiWorkspace[] }>('/workspaces'),

    create: (data: { name: string; color?: string }) =>
      request<{ workspace: ApiWorkspace }>('/workspaces', {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    get: (id: string) => request<{ workspace: ApiWorkspaceDetail }>(`/workspaces/${id}`),

    update: (id: string, data: { name?: string; color?: string }) =>
      request<{ workspace: ApiWorkspace }>(`/workspaces/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),

    delete: (id: string) =>
      request<{ message: string }>(`/workspaces/${id}`, { method: 'DELETE' }),

    invite: (id: string, email: string, role: 'ADMIN' | 'MEMBER' | 'VIEWER') =>
      request<{ invite: { token: string }; inviteUrl: string }>(`/workspaces/${id}/invite`, {
        method: 'POST',
        body: JSON.stringify({ email, role }),
      }),

    addMember: (workspaceId: string, data: { email: string; role: 'ADMIN' | 'MEMBER' | 'VIEWER'; sendEmail?: boolean }) =>
      request<{ invite: { token: string }; inviteUrl: string }>(`/workspaces/${workspaceId}/invite`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    updateMemberRole: (workspaceId: string, memberId: string, role: 'ADMIN' | 'MEMBER' | 'VIEWER') =>
      request<{ member: { userId: string; role: string } }>(`/workspaces/${workspaceId}/members/${memberId}`, {
        method: 'PUT',
        body: JSON.stringify({ role }),
      }),

    removeMember: (workspaceId: string, memberId: string) =>
      request<{ message: string }>(`/workspaces/${workspaceId}/members/${memberId}`, { method: 'DELETE' }),

    listStatuses: (workspaceId: string) =>
      request<{ statuses: ApiWorkspaceStatus[] }>(`/workspaces/${workspaceId}/statuses`),

    createStatus: (workspaceId: string, data: { label: string; color: string }) =>
      request<{ status: ApiWorkspaceStatus }>(`/workspaces/${workspaceId}/statuses`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    updateStatus: (workspaceId: string, statusId: string, data: { label?: string; color?: string }) =>
      request<{ status: ApiWorkspaceStatus }>(`/workspaces/${workspaceId}/statuses/${statusId}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),

    deleteStatus: (workspaceId: string, statusId: string) =>
      request<{ message: string }>(`/workspaces/${workspaceId}/statuses/${statusId}`, { method: 'DELETE' }),

    reorderStatuses: (workspaceId: string, order: string[]) =>
      request<{ statuses: ApiWorkspaceStatus[] }>(`/workspaces/${workspaceId}/statuses/reorder`, {
        method: 'PUT',
        body: JSON.stringify({ order }),
      }),

    listUens: (workspaceId: string) =>
      request<{ uens: ApiUen[] }>(`/workspaces/${workspaceId}/uens`),

    createUen: (workspaceId: string, data: { name: string; color: string }) =>
      request<{ uen: ApiUen }>(`/workspaces/${workspaceId}/uens`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    updateUen: (workspaceId: string, uenId: string, data: { name?: string; color?: string }) =>
      request<{ uen: ApiUen }>(`/workspaces/${workspaceId}/uens/${uenId}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),

    deleteUen: (workspaceId: string, uenId: string) =>
      request<{ message: string }>(`/workspaces/${workspaceId}/uens/${uenId}`, { method: 'DELETE' }),

    updateMemberEmailNotifications: (workspaceId: string, memberId: string, enabled: boolean) =>
      request<{ member: { userId: string; emailNotifications: boolean } }>(
        `/workspaces/${workspaceId}/members/${memberId}/email-notifications`,
        { method: 'PUT', body: JSON.stringify({ enabled }) }
      ),

    acceptInvite: (token: string) =>
      request<{ message: string }>(`/workspaces/accept/${token}`, { method: 'POST' }),
  },

  boards: {
    listByWorkspace: (workspaceId: string) =>
      request<{ boards: ApiBoard[] }>(`/boards/workspace/${workspaceId}`),

    get: (boardId: string) => request<{ board: ApiBoard }>(`/boards/${boardId}`),

    create: (data: { name: string; description?: string; workspaceId: string; isPrivate?: boolean }) =>
      request<{ board: ApiBoard }>('/boards', { method: 'POST', body: JSON.stringify(data) }),

    update: (id: string, data: { name?: string; description?: string | null; isPrivate?: boolean }) =>
      request<{ board: ApiBoard }>(`/boards/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

    delete: (id: string) =>
      request<{ message: string }>(`/boards/${id}`, { method: 'DELETE' }),

    createGroup: (boardId: string, data: { name: string; color?: string }) =>
      request<{ group: ApiGroup }>(`/boards/${boardId}/groups`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    listMembers: (boardId: string) =>
      request<{ members: ApiBoardMember[] }>(`/boards/${boardId}/members`),

    addMember: (boardId: string, userId: string) =>
      request<{ member: ApiBoardMember }>(`/boards/${boardId}/members`, {
        method: 'POST',
        body: JSON.stringify({ userId }),
      }),

    removeMember: (boardId: string, userId: string) =>
      request<{ message: string }>(`/boards/${boardId}/members/${userId}`, { method: 'DELETE' }),
  },

  groups: {
    update: (groupId: string, data: { name?: string; color?: string }) =>
      request<{ group: ApiGroup }>(`/boards/groups/${groupId}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),

    delete: (groupId: string) =>
      request<{ message: string }>(`/boards/groups/${groupId}`, { method: 'DELETE' }),
  },

  admin: {
    listUsers: (workspaceId: string) =>
      request<{ members: ApiWorkspaceMember[] }>(`/admin/workspaces/${workspaceId}/users`),

    createUser: (workspaceId: string, data: { email: string; role: 'ADMIN' | 'MEMBER' | 'VIEWER'; name?: string; password?: string }) =>
      request<{ member: ApiWorkspaceMember }>(`/admin/workspaces/${workspaceId}/users`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    updateUser: (workspaceId: string, userId: string, data: { name?: string; email?: string; color?: string; role?: 'ADMIN' | 'MEMBER' | 'VIEWER' }) =>
      request<{ member: ApiWorkspaceMember }>(`/admin/workspaces/${workspaceId}/users/${userId}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),

    deleteUser: (workspaceId: string, userId: string) =>
      request<{ message: string }>(`/admin/workspaces/${workspaceId}/users/${userId}`, { method: 'DELETE' }),
  },

  systemAdmin: {
    listUsers: () =>
      request<{ users: SystemAdminUser[] }>('/system-admin/users'),

    createUser: (data: { email: string; name: string; password: string }) =>
      request<{ user: SystemAdminUser }>('/system-admin/users', {
        method: 'POST', body: JSON.stringify(data),
      }),

    updateUser: (id: string, data: { name?: string; email?: string; password?: string }) =>
      request<{ user: SystemAdminUser }>(`/system-admin/users/${id}`, {
        method: 'PUT', body: JSON.stringify(data),
      }),

    deleteUser: (id: string) =>
      request<{ message: string }>(`/system-admin/users/${id}`, { method: 'DELETE' }),
  },

  tasks: {
    create: (data: { groupId: string; title: string; status?: string; priority?: string; deadline?: string; uenId?: string | null }) =>
      request<{ task: ApiTask }>('/tasks', { method: 'POST', body: JSON.stringify(data) }),

    listByBoard: (boardId: string, filters?: Record<string, string>) => {
      const qs = filters ? '?' + new URLSearchParams(filters).toString() : ''
      return request<{ tasks: ApiTask[] }>(`/tasks/board/${boardId}${qs}`)
    },

    update: (taskId: string, data: Partial<ApiTaskUpdate>) =>
      request<{ task: ApiTask }>(`/tasks/${taskId}`, { method: 'PUT', body: JSON.stringify(data) }),

    delete: (taskId: string) =>
      request<{ message: string }>(`/tasks/${taskId}`, { method: 'DELETE' }),

    move: (taskId: string, groupId: string) =>
      request<{ task: ApiTask }>(`/tasks/${taskId}/move`, { method: 'PATCH', body: JSON.stringify({ groupId }) }),

    addComment: (taskId: string, content: string) =>
      request<{ comment: ApiComment }>(`/tasks/${taskId}/comments`, {
        method: 'POST',
        body: JSON.stringify({ content }),
      }),
  },

  automations: {
    listByBoard: (boardId: string) =>
      request<{ automations: ApiAutomation[] }>(`/boards/${boardId}/automations`),

    create: (boardId: string, data: { name: string; triggerEvent: string; actionType: string; config?: Record<string, string>; enabled?: boolean }) =>
      request<{ automation: ApiAutomation }>(`/boards/${boardId}/automations`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    update: (id: string, data: Partial<{ name: string; triggerEvent: string; actionType: string; config: Record<string, string>; enabled: boolean }>) =>
      request<{ automation: ApiAutomation }>(`/automations/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),

    delete: (id: string) =>
      request<{ message: string }>(`/automations/${id}`, { method: 'DELETE' }),
  },

  notifications: {
    list: () => request<{ notifications: ApiNotification[] }>('/notifications'),

    markRead: (id: string) =>
      request<{ notification: ApiNotification }>(`/notifications/${id}/read`, { method: 'PUT' }),

    markAllRead: () =>
      request<{ message: string }>('/notifications/read-all', { method: 'PUT' }),

    delete: (id: string) =>
      request<{ message: string }>(`/notifications/${id}`, { method: 'DELETE' }),
  },
}

export interface SystemAdminUser {
  id: string
  name: string
  email: string
  initials: string
  color: string
  isAppAdmin: boolean
  mustChangePassword: boolean
  createdAt: string
}

export interface ApiUser {
  id: string
  email: string
  name: string
  initials: string
  color: string
  avatarUrl?: string | null
  mustChangePassword?: boolean
  isAppAdmin?: boolean
}

export interface ApiWorkspace {
  id: string
  name: string
  slug: string
  color: string
  members: Array<{ userId: string; role: string; user: ApiUser }>
  _count: { boards: number }
}

export interface ApiBoardMember {
  id: string
  boardId: string
  userId: string
  user: { id: string; name: string; email: string; initials: string; color: string; avatarUrl: string | null }
}

export interface ApiBoard {
  id: string
  workspaceId: string
  name: string
  description: string | null
  isPrivate: boolean
  boardMembers?: ApiBoardMember[]
  groups: ApiGroup[]
}

export interface ApiGroup {
  id: string
  boardId: string
  name: string
  color: string
  order: number
  tasks: ApiTask[]
}

export interface ApiTask {
  id: string
  groupId: string
  title: string
  description: string | null
  status: string
  priority: string
  deadline: string | null
  fileUrl: string | null
  createdBy: string | null
  createdAt: string
  updatedAt: string
  assignees: Array<{ user: ApiUser }>
  group: { id: string; name: string; boardId: string }
  uen: { id: string; name: string; color: string } | null
}

export interface ApiTaskUpdate {
  title: string
  description: string | null
  status: string
  priority: string
  deadline: string | null
  groupId: string
  assigneeIds: string[]
  uenId?: string | null
}

export interface ApiWorkspaceMember {
  userId: string
  role: 'ADMIN' | 'MEMBER' | 'VIEWER'
  emailNotifications: boolean
  user: ApiUser
}

export interface ApiWorkspaceDetail {
  id: string
  name: string
  slug: string
  color: string
  members: ApiWorkspaceMember[]
  settings: { timezone: string | null; language: string | null; logoUrl: string | null } | null
  _count: { boards: number }
}

export interface ApiComment {
  id: string
  taskId: string
  content: string
  createdAt: string
  author: ApiUser
}

export interface ApiWorkspaceStatus {
  id: string
  workspaceId: string
  slug: string
  label: string
  color: string
  position: number
  isDefault: boolean
}

export interface ApiUen {
  id: string
  workspaceId: string
  name: string
  color: string
  createdAt: string
}

export interface ApiAutomation {
  id: string
  boardId: string
  name: string
  triggerEvent: string
  actionType: string
  config: Record<string, unknown>
  enabled: boolean
  triggerCount: number
  createdAt: string
  updatedAt: string
}

export interface ApiUserPreferences {
  theme: 'light' | 'dark'
  language: string
  emailNotifications: boolean
}

export interface ApiNotification {
  id: string
  userId: string
  title: string
  body: string
  taskId: string | null
  boardId: string | null
  read: boolean
  createdAt: string
}
