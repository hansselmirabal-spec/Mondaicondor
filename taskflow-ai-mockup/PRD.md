# PRD — TaskFlow AI Mockup

**Version:** 1.0  
**Status:** Active  
**Scope:** Mockup only — no backend, no real auth, no real AI

---

## 1. Vision

TaskFlow AI is a project and task management platform inspired by Monday.com, enhanced with native AI agent capabilities. The vision is a workspace where teams manage work visually and AI agents proactively surface risks, suggest actions, and automate repetitive workflows.

This PRD covers **Phase 0: Navigable Mockup** — the goal is to validate UX before building anything real.

---

## 2. Problem

Teams managing projects across multiple tools lose visibility, context, and accountability. Existing tools like Monday.com are powerful but lack native AI-first workflows. TaskFlow AI fills this gap by making AI a first-class citizen of the project management experience.

---

## 3. Objective of the Mockup

Validate the complete user experience before a single line of backend code is written.

- Confirm the information architecture makes sense.
- Test that the board view is legible and actionable.
- Validate that the AI agent panel feels natural, not bolted-on.
- Collect feedback from stakeholders on the visual design.

---

## 4. Target Users

| Persona | Role | Need |
|---|---|---|
| Team Lead | Manages multiple projects | See status at a glance |
| Team Member | Executes tasks | Know what to work on next |
| Stakeholder | Reviews progress | Understand delivery timelines |
| Admin | Configures workspace | Control automations and permissions |

---

## 5. Scope of the Mockup

### In Scope

- Login page (mock credentials)
- Workspace selector
- Dashboard of boards
- Board view: table with groups, tasks, columns
- Task detail drawer (sidebar panel)
- AI agents panel (visual mock results)
- Automations panel (visual rules, not executable)
- Basic board settings page
- Visual filtering and search (no persistence)
- Collapsible groups
- Status and priority color badges
- Assignee avatars with initials

### Out of Scope

- Real authentication
- Backend or database
- Real AI/LLM integration
- Prisma or any ORM
- Real-time collaboration
- File uploads
- Notifications (real)
- Billing or admin settings
- Mobile responsive (desktop-first for now)

---

## 6. Main Screens

| Screen | Route | Description |
|---|---|---|
| Login | `/login` | Mock login with any credentials |
| Workspace Selector | `/workspaces` | Choose workspace (Digital) |
| Boards Dashboard | `/boards` | List of boards in workspace |
| Board View | `/boards/:id` | Main table view |
| Task Detail | `/boards/:id?task=:taskId` | Drawer overlay |
| AI Agents Panel | `/boards/:id?panel=agents` | Agent cards with mock results |
| Automations Panel | `/boards/:id?panel=automations` | Visual automation rules |
| Board Settings | `/boards/:id/settings` | Basic config mock |

---

## 7. Required Components

### Layout
- `AppShell` — root layout with sidebar + main content
- `Sidebar` — left panel with workspace, nav icons, board list
- `WorkspaceSelector` — dropdown to switch workspace
- `BoardList` — list of boards in sidebar

### Board
- `BoardHeader` — board title, breadcrumb, action buttons
- `BoardViewTabs` — Tabla principal / Gráfico / Kanban tabs
- `BoardToolbar` — Agregar elemento, Buscar, Persona, Filtrar, Ordenar, Ocultar, Agrupar por, Automatizar, Agents
- `BoardTable` — full table container
- `BoardGroup` — collapsible group (Always On, Telefonía, etc.)
- `TaskRow` — single task row in table

### Task
- `StatusBadge` — colored pill for status
- `PriorityBadge` — colored pill for priority
- `AssigneeAvatar` — circle with initials and color
- `DeadlineCell` — date display
- `TaskDetailDrawer` — right panel with task details
- `CommentList` — mock comments
- `ActivityTimeline` — mock activity log

### UI
- `SearchInput` — search bar in toolbar
- `FilterButton` — filter dropdown (visual only)
- `EmptyState` — no tasks placeholder
- `AgentPanel` — AI agent cards
- `AutomationPanel` — automation rules list

---

## 8. User Flows

### Flow 1: Enter and navigate
1. User lands on `/login`
2. Enters any credentials → navigates to workspace
3. Selects "Digital" workspace
4. Sees boards list → clicks "Pendientes - Digital"
5. Board table loads with groups and tasks

### Flow 2: Inspect a task
1. User clicks any task row
2. Task detail drawer opens from the right
3. User sees: title, assignees, status, priority, deadline, description, comments, activity

### Flow 3: Explore AI agents
1. User clicks "Agents" button in board header
2. Agent panel opens as overlay or side panel
3. User sees 5 agent cards with mock results
4. Cards show: name, description, mock output, "Run" button (disabled)

### Flow 4: Explore automations
1. User clicks "Automatizar" in board header
2. Automation panel opens
3. User sees 4 visual rules with trigger → action format
4. Toggle switches are visual only

---

## 9. Visual Acceptance Criteria

- [ ] Board table looks like a real project management tool
- [ ] Groups are clearly separated with distinct left-border colors
- [ ] Status badges have distinct, recognizable colors
- [ ] Priority badges have distinct, recognizable colors
- [ ] Assignee avatars show initials with consistent colors
- [ ] Deadline cells show formatted dates
- [ ] Sidebar is stable and does not shift on navigation
- [ ] Board header has all action buttons from the reference image
- [ ] Task drawer opens smoothly and shows all sections
- [ ] AI panel feels like a real feature, not a placeholder
- [ ] Automation panel shows rules in a structured, readable format
- [ ] No broken routes or blank pages
- [ ] Mock data is realistic and coherent

---

## 10. Post-Mockup Roadmap

| Phase | Description |
|---|---|
| Phase 1 (Mockup) | This document — navigable UI, mock data |
| Phase 2 (Foundation) | Supabase auth, PostgreSQL schema, Prisma |
| Phase 3 (Core) | Real CRUD for tasks, boards, workspaces |
| Phase 4 (AI) | LLM integration for agents, real summaries |
| Phase 5 (Automations) | Trigger-action engine, notifications |
| Phase 6 (Collaboration) | Real-time with WebSockets |
| Phase 7 (Scale) | Multi-tenant, billing, roles |
