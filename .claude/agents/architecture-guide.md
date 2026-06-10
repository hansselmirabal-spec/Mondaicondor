---
name: architecture-guide
description: Full-stack architecture reference for TaskFlow AI. Use this agent when you need to understand how frontend, backend, infrastructure, and deploy pipeline fit together before making any change.
---

# Agent: Architecture Guide — TaskFlow AI

## Role
Senior architect with full visibility of the entire system. Frontend, backend, database, infrastructure, and deploy pipeline. When in doubt about where something lives, how data flows, or how to deploy a change — start here.

---

## Project Overview

**TaskFlow AI** is a Monday.com-inspired project management platform. Multi-workspace, multi-board, real-time task management with invite system.

**Repo:** `https://github.com/hansselmirabal-spec/Mondaicondor` (private)
**Server:** `53.103.13.238` — user `grafana`, pass `Konoha2024`
**Code on server:** `/opt/taskflow/`

---

## Repository Structure

```
/                                   ← project root
├── taskflow-ai-mockup/             ← React frontend
├── taskflow-ai-backend/            ← Hono backend
├── docker-compose.prod.yml         ← PROD stack (port 5300)
├── docker-compose.dev.yml          ← DEV stack (port 5301) — not configured yet
├── docker-compose.qas.yml          ← QAS stack (port 5302) — not configured yet
├── deploy-prod.sh                  ← Build + up PROD
├── deploy-dev.sh                   ← Build + up DEV
├── deploy-qas.sh                   ← Build + up QAS
├── .env.prod                       ← Secrets PROD (never commit — lives on server only)
├── .env.dev.example                ← Template for DEV
├── .env.qas.example                ← Template for QAS
└── setup.sh                        ← First-time server setup
```

---

## Frontend — `taskflow-ai-mockup/`

| Concern | Tool |
|---|---|
| Framework | React 18 + TypeScript 5 |
| Build | Vite 5 |
| Styling | Tailwind CSS 3 |
| Routing | React Router 6 (`createBrowserRouter`) |
| State | Zustand 4 |
| Icons | Lucide React |
| HTTP | `/src/lib/api.ts` — thin typed wrapper over `fetch` |
| Adapter layer | `/src/lib/adapters.ts` — API types → MockTypes |

### Key folders

```
src/
  app/
    router.tsx          ← All routes. AuthGuard wraps protected routes.
    providers.tsx       ← App-level providers
  lib/
    api.ts              ← All API calls. Typed. Single source of truth.
    adapters.ts         ← toMockBoard(), toMockTask(), extractTasks()
  store/
    authStore.ts        ← user, accessToken, setUser, logout
    boardStore.ts       ← boards, apiTasks, workspaceStatuses
    filterStore.ts      ← activeView (table | kanban | chart)
  pages/
    LoginPage.tsx
    BoardsPage.tsx
    BoardPage.tsx       ← Loads board + tasks. Polls every 30s for real-time sync.
    ForceChangePasswordPage.tsx  ← Shown on first login when mustChangePassword=true
    MembersSettingsPage.tsx
    WorkspaceStatusPage.tsx
    EmailAlertsPage.tsx
  components/
    auth/AuthGuard.tsx  ← Redirects to /force-change-password if mustChangePassword
    board/
      BoardHeader.tsx
      BoardToolbar.tsx  ← "Agregar elemento" modal. Deadline defaults to today, min=today.
      BoardTable.tsx
      KanbanView.tsx
      ChartView.tsx
    layout/
      AppShell.tsx
      Sidebar.tsx
  types/index.ts        ← All shared TypeScript types (MockBoard, MockTask, etc.)
```

### API client pattern (`api.ts`)

All calls go through `request<T>(path, options)`. It:
- Prepends `/api`
- Attaches `Authorization: Bearer <access_token>` from localStorage
- Throws with the server's error `message` on non-2xx

Namespaced: `api.auth.*`, `api.boards.*`, `api.tasks.*`, `api.users.*`, `api.workspaces.*`

### Real-time sync

No WebSockets. `BoardPage` polls `api.tasks.listByBoard(boardId)` every **30 seconds** via `setInterval`. `activeBoardId` ref guards stale responses on navigation.

### Auth flow

1. Login → `accessToken` + `refreshToken` + `user` (includes `mustChangePassword`)
2. Tokens stored in `localStorage` as `access_token` / `refresh_token`
3. `AuthGuard` checks `localStorage` + `mustChangePassword` state
4. If `mustChangePassword=true` → redirect to `/force-change-password`
5. Force change page calls `PUT /api/users/me/force-change-password` → updates store → redirect to `/boards`

### Vite proxy

`/api/*` → `http://localhost:3000` (dev only). In production nginx handles the proxy (`nginx.conf`).

---

## Backend — `taskflow-ai-backend/`

| Concern | Tool |
|---|---|
| Framework | Hono (TypeScript) |
| ORM | Prisma 5 |
| Database | PostgreSQL 15 |
| Auth | JWT (access 15min + refresh 7d) |
| Validation | Zod via `@hono/zod-validator` |
| Password | bcrypt (12 rounds) |
| Email | Nodemailer (SMTP) |

### Route structure

```
src/
  index.ts              ← App entry. Mounts all routes under /api.
  routes/
    auth.ts             ← /auth/login, /auth/register, /auth/refresh, /auth/logout
    users.ts            ← /users/me (GET/PUT), /users/me/password, /users/me/force-change-password
    workspaces.ts       ← /workspaces (CRUD), /workspaces/:id/invite, /workspaces/accept/:token
    boards.ts           ← /boards (CRUD), /boards/:id
    tasks.ts            ← /tasks (CRUD), /tasks/:id, /tasks/board/:boardId
    notifications.ts    ← /notifications
    automations.ts      ← /automations
    admin.ts            ← Admin-only routes
  middleware/
    auth.ts             ← JWT verification middleware. Sets c.get('user') = { userId }
  db/
    client.ts           ← Prisma client singleton
  lib/
    email.ts            ← Nodemailer helper
```

### Prisma schema — key models

```prisma
User        id, email, name, initials, passwordHash, mustChangePassword, avatarUrl
Workspace   id, name, ownerId
WorkspaceMember  workspaceId, userId, role (OWNER|ADMIN|MEMBER)
WorkspaceInvite  token, email, workspaceId, expiresAt, accepted
Board       id, name, workspaceId
Group       id, name, boardId, order
Task        id, title, groupId, status, priority, deadline, description, mustChangePassword
```

**`mustChangePassword`**: `Boolean @default(false)`. Set to `true` when user is created via workspace invite. Reset to `false` on `PUT /users/me/force-change-password`.

### Key business rules

- Invited users are created with `mustChangePassword: true` and a temp password in `workspaces.ts`
- `z.string().datetime()` requires full ISO format — always convert `YYYY-MM-DD` dates with `new Date(date + 'T00:00:00').toISOString()` before sending
- Clipboard over HTTP: use `input.focus()` + `input.select()` + `document.execCommand('copy')` — `navigator.clipboard` is blocked on non-HTTPS

### Migrations

```
prisma/migrations/
  20260610000000_add_must_change_password/migration.sql
  (other migrations...)
```

Run on container start: `npx prisma migrate deploy && node dist/index.js`

---

## Infrastructure

### Environments

| Port | Env | Status | docker-compose file |
|---|---|---|---|
| 5300 | PROD | ✅ Running | `docker-compose.prod.yml` |
| 5301 | DEV | ❌ Not configured | `docker-compose.dev.yml` |
| 5302 | QAS | ❌ Not configured | `docker-compose.qas.yml` |

### docker-compose.prod.yml — services

| Service | Image | Notes |
|---|---|---|
| `frontend` | `taskflow-frontend:prod` | nginx on :80, exposed as :5300 |
| `backend` | `taskflow-backend:prod` | Hono on :3000, internal only |
| `db` | `postgres:15-alpine` | Volume `taskflow_db-data` |

All services share network `taskflow_net`. nginx resolves backend by hostname `backend` — the `--network-alias` must match.

### `.env.prod` (on server only — never commit)

```
DB_PASSWORD=<generated>
JWT_SECRET=<generated>
JWT_REFRESH_SECRET=<generated>
APP_URL=http://53.103.13.238:5300
SMTP_HOST=53.103.13.216
SMTP_PORT=25
SMTP_USER=agenda@grupocondor.com.py
SMTP_PASSWORD=
```

---

## Deploy Workflow

### Standard deploy (code change)

```bash
# 1. Local: commit + push
git add .
git commit -m "feat: description"
git push origin main

# 2. Server: pull + rebuild
ssh grafana@53.103.13.238
cd /opt/taskflow
git pull
bash deploy-prod.sh
```

### `deploy-prod.sh` does

1. `docker-compose -f docker-compose.prod.yml --env-file .env.prod build --no-cache`
2. `docker-compose -f docker-compose.prod.yml --env-file .env.prod up -d`

### Database migrations

Migrations run automatically on container start via `npx prisma migrate deploy`.
For a new migration: add the SQL file to `prisma/migrations/` → commit → deploy.

### First-time server setup

```bash
scp .env.prod grafana@53.103.13.238:/opt/taskflow/.env.prod
ssh grafana@53.103.13.238
cd /opt/taskflow
git clone https://<TOKEN>@github.com/hansselmirabal-spec/Mondaicondor.git .
bash deploy-prod.sh
```

---

## Other Apps on the Server

The server hosts multiple apps. **Never touch these containers:**

| Container | Port | App |
|---|---|---|
| `nginx-proxy` | 80, 443 | Reverse proxy global |
| `portainer` | 9443 | Container management |
| `itam-system-*` | 5010 | IT Asset Management |
| `onlyprint` | 5050 | Print service |
| `activos_ti-*` | 5173 | Assets app |
| `cockpit` | 9090 | Server monitoring |
| `termix` | 8080 | Terminal web |

---

## Rules

1. **Never hardcode secrets.** JWT, DB passwords, SMTP — always from env vars.
2. **Never commit `.env*` files** (except `.example` templates).
3. **Never touch non-taskflow containers** on the server.
4. **All dates sent to the API must be ISO 8601** (`2024-01-15T00:00:00.000Z`), never `YYYY-MM-DD`.
5. **Conventional commits only.** No "Co-Authored-By: Claude" in commit messages.
6. **Read this file before any architectural change.** If something seems to contradict this doc, verify current state before proceeding.
