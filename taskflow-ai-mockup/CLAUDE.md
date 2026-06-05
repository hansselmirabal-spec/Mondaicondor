# CLAUDE.md — TaskFlow AI Mockup

## Project Context

This is a **navigable UI mockup** of TaskFlow AI, a Monday.com-inspired project management platform with native AI agent features. The purpose is to validate UX and visual design before building anything real.

**Reference:** See `PRD.md` for full product vision and acceptance criteria.

---

## Backend

El proyecto tiene un backend real corriendo en `http://localhost:3000`.

- **Siempre usar el backend real** — no mockear llamadas API en tests ni en código.
- El frontend proxea `/api/*` al backend vía Vite.
- Auth: `POST /api/auth/login` → `{ user, accessToken, refreshToken }`. El token se guarda en `localStorage` como `access_token`.
- Para pruebas Playwright: **no usar `page.route()`** para interceptar `/api/**`. Dejar que los requests lleguen al backend real.
- Credenciales de prueba: `tacosta@condor.com.py` / `password123`.
- Si el backend no está corriendo, levantarlo antes de cualquier prueba.

---

## CRITICAL RULE: Mockup First (OBSOLETO — ver sección Backend)

> ~~Esta regla ya no aplica. El proyecto tiene backend real.~~

---

## Stack

| Tool | Version | Purpose |
|---|---|---|
| React | 18 | UI framework |
| TypeScript | 5+ | Type safety |
| Vite | 5+ | Build tool |
| Tailwind CSS | 3+ | Styling |
| React Router | 6 | Client-side routing |
| Zustand | 4+ | Local state (optional, for drawer/panel state) |
| Lucide React | latest | Icons |
| Shadcn/UI | latest | UI primitives (optional) |

---

## Folder Structure

```
src/
  app/
    router.tsx          # All routes defined here
    providers.tsx       # App-level providers (Router, Zustand)
  data/
    mockUsers.ts        # User objects with name, initials, color, avatar
    mockWorkspaces.ts   # Workspace objects
    mockBoards.ts       # Board objects with metadata
    mockTasks.ts        # Task objects with all fields
    mockComments.ts     # Comment objects per task
    mockActivity.ts     # Activity log objects per task
    mockAutomations.ts  # Automation rule objects
    mockAgents.ts       # AI agent cards with mock outputs
  types/
    index.ts            # All shared TypeScript types
  components/
    layout/             # AppShell, Sidebar, WorkspaceSelector, BoardList
    board/              # BoardHeader, BoardToolbar, BoardViewTabs, BoardTable, BoardGroup, TaskRow
    task/               # TaskDetailDrawer, CommentList, ActivityTimeline
    ui/                 # StatusBadge, PriorityBadge, AssigneeAvatar, DeadlineCell, SearchInput, FilterButton, EmptyState
    panels/             # AgentPanel, AutomationPanel
  pages/
    LoginPage.tsx
    WorkspacePage.tsx
    BoardsPage.tsx
    BoardPage.tsx
    AutomationsPage.tsx
    AgentsPage.tsx
    SettingsPage.tsx
  lib/
    utils.ts            # cn(), formatDate(), getInitials(), getStatusColor(), getPriorityColor()
```

---

## Component Conventions

- Every component is a named export (no default exports from component files).
- Props are typed with an interface named `ComponentNameProps`.
- No `any` types.
- Use Tailwind only — no inline styles, no CSS modules.
- Icons come from `lucide-react` only.
- Components do not fetch data. They receive data as props.
- Page components are responsible for pulling from mock data.

---

## Visual Rules

- **Color palette:** Dark sidebar (#1f1f1f or similar), white/light main area, colored badges.
- **Status colors:**
  - Always On → cyan/teal (`#00c2cd` bg, white text)
  - Nuevo → gray
  - Asignado → orange-red (`#e2445c`)
  - En progreso → blue
  - En revisión → purple
  - Bloqueado → dark red
  - Completado → green
- **Priority colors:**
  - Always On → hot pink/magenta (`#e2445c` or similar)
  - Crítica → red
  - Alta → orange-red
  - Media → yellow/amber
  - Baja → yellow/light
- **Group left border:** Each group has a distinct left border color (teal, purple, orange, blue, red).
- **Assignee avatars:** Colored circles with 2-letter initials. Use a consistent color map per user.
- **Table rows:** Subtle hover state. Checkbox on left. Clean column separation.
- **Sidebar:** Fixed width, dark background, white text. Icon nav on far left.
- **Drawer:** Slides in from the right. Fixed width ~500px. Overlays the table.

---

## Mock Data Rules

- All mock data lives in `/src/data/`.
- No hardcoded data inside components.
- Every task must have: id, title, groupId, assignees, status, priority, deadline (nullable), text (nullable).
- Every user must have: id, name, initials (2 chars), color (hex).
- Use realistic Spanish-language task names as provided in the PRD.
- Dates should be realistic (2025 dates as shown in the reference image).
- Comments must reference real user IDs.
- Activity logs must reference real user IDs and real task IDs.

---

## Routing Rules

- Use React Router v6 with `createBrowserRouter`.
- No hash routing.
- Task detail uses query params: `?task=taskId`
- Panels use query params: `?panel=agents` or `?panel=automations`
- Drawer and panel state is managed via URL, not component state.

---

## What NOT to Build

- No WebSockets (por ahora).
- No email sending.
- No llamadas a servicios externos fuera del backend propio.

---

## Running the Project

```bash
npm install
npm run dev
```

App runs at `http://localhost:5173`.
