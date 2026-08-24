export type StatusType = string
export type PriorityType = 'Baja' | 'Media' | 'Alta' | 'Crítica' | 'Siempre activo'

export interface WorkspaceStatus {
  id: string
  workspaceId: string
  slug: string
  label: string
  color: string
  position: number
  isDefault: boolean
}

export interface WorkspaceUen {
  id: string
  workspaceId: string
  name: string
  color: string
  createdAt: string
}

export interface MockUser {
  id: string
  name: string
  initials: string
  color: string
  email: string
  avatarUrl?: string | null
}

export interface MockGroup {
  id: string
  boardId: string
  name: string
  color: string
}

export interface BoardMember {
  id: string
  boardId: string
  userId: string
  role: 'ADMIN' | 'MEMBER'
  user: { id: string; name: string; email: string; initials: string; color: string; avatarUrl: string | null }
}

export type CustomFieldType = 'TEXT' | 'NUMBER' | 'DATE' | 'SELECT' | 'CHECKBOX'

export interface CustomFieldOption {
  id: string
  label: string
  color: string
  order: number
  archivedAt: string | null
}

export interface CustomFieldDefinition {
  id: string
  boardId: string
  label: string
  type: CustomFieldType
  config: { options?: CustomFieldOption[] }
  order: number
  archivedAt: string | null
  createdAt: string
  hasValues: boolean
}

export interface MockBoard {
  id: string
  workspaceId: string
  name: string
  description: string
  isPrivate: boolean
  boardMembers?: BoardMember[]
  groups: MockGroup[]
}

export interface MockWorkspace {
  id: string
  name: string
  color: string
  boardIds: string[]
}

export interface MockTask {
  id: string
  groupId: string
  boardId: string
  title: string
  assigneeIds: string[]
  status: string
  priority: PriorityType
  deadline: string | null
  fileUrl: string | null
  text: string | null
  description: string
  order: number
  createdAt: string
  updatedAt: string
  uenIds: string[]
  customFields: Record<string, unknown>
}

export interface MockComment {
  id: string
  taskId: string
  authorId: string
  content: string
  createdAt: string
}

export interface MockActivity {
  id: string
  taskId: string
  userId: string
  action: string
  timestamp: string
}

export interface MockAutomation {
  id: string
  boardId: string
  name: string
  trigger: string
  action: string
  enabled: boolean
  triggerCount: number
}

export interface MockAgentOutput {
  summary: string
  items: string[]
  recommendation: string
}

export interface MockAgent {
  id: string
  name: string
  description: string
  iconName: string
  output: MockAgentOutput
}
