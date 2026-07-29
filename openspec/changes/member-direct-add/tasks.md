# Tasks: member-direct-add

Source: `spec.md` (7 ADDED requirements, 1 REMOVED requirement) + `design.md`.
Delivery strategy: `ask-on-risk`. See Review Workload Forecast at the end — a
decision is needed before `sdd-apply` runs.

## 1. Backend — consolidate add-member on the admin endpoint

### 1.1 [x] Extend `POST /admin/workspaces/:workspaceId/users` with auto-provisioning + notification
- **File**: `taskflow-ai-backend/src/routes/admin.ts`
- **Satisfies**: Direct membership for brand-new user; Notification on add
  (both scenarios); Role selection on add (unaffected, already correct)
- **Change**:
  - Replace the `if (!name || !password) return 404 ...` branch (lines 87-89)
    with an auto-provision path: when `name`/`password` are omitted, generate
    a temp password (`randomBytes(5).toString('hex')`), derive `name` from
    `email.split('@')[0]` and `initials` from it, set
    `mustChangePassword: true`, and create `User` + `WorkspaceMember` inside
    the existing `$transaction` (ports the logic currently in
    `workspaces.ts:185-201`). Keep the explicit `name`+`password` path as-is
    (deliberate create, unchanged).
  - Fetch the actor's (`userId`) display name once per request (needed for
    the notification body: `${actorName} te agregó al workspace ${workspaceName} como ${roleLabel}.`).
  - After each successful member creation (both the "existing user" branch
    at line 77-84 and the new-user branch), add
    `prisma.notification.create({ data: { userId: <addedUserId>, title, body, taskId: null, boardId: null } }).catch(...)`
    alongside the existing `sendInviteEmail(...).catch(...)` — both
    fire-and-forget, never block the response.
  - When emailing a brand-new user, pass the temp password to
    `sendInviteEmail` (5th arg, already supported) instead of `undefined`.
- **Dependency**: none — can start immediately.
- **Parallel with**: 1.2 (different file).

### 1.2 [x] Delete the dead invite/accept endpoints
- **File**: `taskflow-ai-backend/src/routes/workspaces.ts`
- **Satisfies**: REMOVED "Invite-accept confirmation step" (both scenarios —
  route no longer exists)
- **Change**:
  - Delete `workspaceRoutes.post('/:id/invite', ...)` (lines 157-212).
  - Delete `workspaceRoutes.post('/accept/:token', ...)` (lines 214-241).
  - Delete `inviteSchema` (lines 42-46).
  - Remove now-unused imports: `bcrypt` (line 7), `randomBytes` (line 8),
    `sendInviteEmail` (line 6) — confirm no other route in this file still
    uses them before deleting each.
- **Dependency**: none — can start immediately.
- **Parallel with**: 1.1 (different file).

### 1.3 [x] [GATED — confirmed] Remove `WorkspaceInvite` model + destructive migration
- **Files**: `taskflow-ai-backend/prisma/schema.prisma`,
  `taskflow-ai-backend/prisma/migrations/*_drop_workspace_invite/`
- **Satisfies**: REMOVED "Invite-accept confirmation step" (data-model
  cleanup — no orphaned table/model backing a deleted feature)
- **Change**:
  - Remove `model WorkspaceInvite { ... }` (lines 107-120).
  - Remove `invites WorkspaceInvite[]` relation field from `model Workspace`
    (line 71).
  - Generate + apply the Prisma migration (`DROP TABLE "WorkspaceInvite"` +
    its FK), or run `prisma migrate dev` locally to produce it.
- **BLOCKED ON EXPLICIT USER CONFIRMATION BEFORE THIS TASK RUNS.** The
  migration is irreversible and drops all pending invite rows. `sdd-apply`
  MUST stop and ask before executing this task, per
  `openspec/config.yaml` (`archive: Warn before merging destructive
  deltas`) and design.md's Migration/Rollout gate.
- **Dependency**: 1.2 must land first (no code may still call
  `prisma.workspaceInvite.*` when the model is removed from the schema).

## 2. Frontend — repoint to the admin endpoint, remove invite UI

### 2.1 Repoint `api.workspaces.addMember`; delete `invite`/`acceptInvite`
- **File**: `taskflow-ai-mockup/src/lib/api.ts`
- **Satisfies**: Direct membership (both scenarios — this is the sole
  frontend entry point both callers use)
- **Change**:
  - Change `addMember` (lines 226-230) to call
    `POST /admin/workspaces/${workspaceId}/users` with
    `{ email, role, name?, password? }` and return `{ member: ApiWorkspaceMember }`
    (drop the `invite`/`inviteUrl` return type).
  - Delete the `invite` method (lines 220-224) — dead code, no caller uses
    it directly (only `addMember` pointed at the same route).
  - Delete the `acceptInvite` method (lines 289-290).
- **Dependency**: requires the `{ member }` response contract from **1.1**
  to be defined (can be coded in parallel, but do not merge/deploy ahead of
  1.1).
- **Parallel with**: 2.4 (different files, no shared dependency).

### 2.2 `BoardHeader.tsx` — direct-add copy + consume `{ member }`
- **File**: `taskflow-ai-mockup/src/components/board/BoardHeader.tsx`
- **Satisfies**: Direct-add UI, no invite language (BoardHeader scenario)
- **Change**:
  - Section header "Invitar miembro" (line 329) → "Agregar miembro".
  - Helper text (line 331) "Se generará un link de invitación y se enviará
    un email." → direct-add copy, e.g. "Se agregará al workspace y se le
    notificará por correo." (no link/invitation language).
  - Button label (line 354) "Generar invitación y enviar correo" →
    "Agregar miembro".
  - `handleInvite` (lines 88-101): destructure `{ member }` from the
    `addMember` response, push it into `apiUsers` (same pattern as
    `handleAddMember`, lines 103-114), and change the success toast (line
    93) from `Invitación enviada a ${inviteEmail}` to
    `Se agregó a ${inviteEmail}` (or the member's name).
- **Dependency**: 2.1.

### 2.3 `MembersSettingsPage.tsx` — rewrite `InviteNewUserTab` as direct-add
- **File**: `taskflow-ai-mockup/src/pages/MembersSettingsPage.tsx`
- **Satisfies**: Direct membership for brand-new user; Direct-add UI, no
  invite language (Members settings page scenario)
- **Change**:
  - Rewrite `InviteNewUserTab` (lines 224-342) modeled on
    `InviteRegisteredTab` (lines 93-221): keep the email input + `RoleDropdown`,
    call `api.workspaces.addMember(workspaceId, { email, role })`, show a
    success toast, and reset the form — **remove** the `inviteLink` state,
    the copy-to-clipboard panel, and the "Invitación generada" success
    block entirely (no copyable invite-link UI).
  - Wire the tab's success path to call the page's `onInvited`-equivalent
    refresh (see `handleMemberCreated`, lines 397-402, or trigger the same
    `api.workspaces.get(workspace.id)` refresh `InviteRegisteredTab` uses at
    lines 545-551) so the member list updates without a manual reload.
  - Drop now-unused imports: `Mail`, `Link2` (already dead pre-change),
    `Copy`, `CheckCheck` (dead once the link panel is removed) — lines
    12-15.
- **Dependency**: 2.1.
- **Parallel with**: 2.2 (different files).

### 2.4 Delete `AcceptInvitePage.tsx` + its route/import
- **Files**: `taskflow-ai-mockup/src/pages/AcceptInvitePage.tsx` (delete, 71
  lines), `taskflow-ai-mockup/src/app/router.tsx` (modify)
- **Satisfies**: REMOVED "No accept UI reachable" scenario
- **Change**:
  - Delete `AcceptInvitePage.tsx` entirely.
  - Remove `import { AcceptInvitePage } from '@/pages/AcceptInvitePage'`
    (router.tsx line 6).
  - Remove the route `{ path: 'workspaces/accept/:token', element: <AcceptInvitePage /> }`
    (router.tsx line 54).
- **Dependency**: none structurally — safe to do in parallel with 2.1-2.3,
  but land alongside them so no PR ships a still-reachable dead route.
- **Parallel with**: 2.1.

## 3. Verification

### 3.1 Update `e2e/09-settings-members.spec.ts`
- **File**: `taskflow-ai-mockup/e2e/09-settings-members.spec.ts`
- **Satisfies**: test coverage for Direct membership + Direct-add UI
  requirements
- **Change**:
  - Line 67: selector `/invitar a/i` → `/agregar a/i` (the button already
    renders "Agregar a {name}"; the test regex was stale even before this
    change).
  - Lines 71-84 (`'tab "Usuario nuevo" shows create form'` and `'create
    form validates password length'`): rewrite for the new email+role
    direct-add form — drop assertions on `input[placeholder="Ana García"]`,
    `input[type="password"]`, and `/crear y agregar/i`; assert the email
    input, `RoleDropdown`, and an "Agregar miembro"-style submit button
    instead.
- **Dependency**: 2.2, 2.3.
- No change needed in `07-workspace.spec.ts` (its "accepts" match is a
  grep false-positive, confirmed in design.md).

### 3.2 Build both apps
- **Command**: `npm run build` in `taskflow-ai-backend/` and
  `taskflow-ai-mockup/`.
- **Dependency**: backend build after 1.1-1.3; frontend build after
  2.1-2.4.

### 3.3 Manual QA
- **Dependency**: 1.1, 1.2, 2.1-2.4 (1.3's migration is not required for
  this QA pass — auto-provision only touches `User`/`WorkspaceMember`).
- **Steps** (no backend test framework configured — manual only):
  1. Admin adds an existing user's email → `WorkspaceMember` created
     immediately, 201 response, no invite/token in payload.
  2. Admin adds a brand-new email → new `User` (`mustChangePassword: true`)
     + `WorkspaceMember` created in one request; email received with temp
     password.
  3. Admin re-adds an already-member email → 409, no duplicate row.
  4. Non-admin attempts add → 403.
  5. Confirm a `Notification` row exists for the added user in both cases
     (1) and (2); bell icon shows it; click routes to `/boards`.
  6. Kill SMTP (or force a send error) → request still returns success;
     error is logged, not surfaced.
  7. Confirm `POST /workspaces/:id/invite` and
     `POST /workspaces/accept/:token` return 404/route-not-found.
  8. Confirm no `/workspaces/accept/:token` route or copy-invite-link UI is
     reachable from the frontend.

---

## Review Workload Forecast

| File | Action | Est. changed lines |
|---|---|---|
| `backend/src/routes/admin.ts` | modify | ~35 |
| `backend/src/routes/workspaces.ts` | delete routes/schema/imports | ~92 |
| `backend/prisma/schema.prisma` | modify (gated) | ~15 |
| `backend/prisma/migrations/*/migration.sql` | new (gated) | ~10 |
| `mockup/src/lib/api.ts` | modify | ~15 |
| `mockup/src/pages/MembersSettingsPage.tsx` | rewrite one function | ~200 |
| `mockup/src/components/board/BoardHeader.tsx` | modify | ~30 |
| `mockup/src/pages/AcceptInvitePage.tsx` | delete | ~71 |
| `mockup/src/app/router.tsx` | modify | ~2 |
| `mockup/e2e/09-settings-members.spec.ts` | modify | ~20 |
| **Total** | | **~490** |

- **Chained PRs recommended: Yes**
- **400-line budget risk: High** (~490 est. changed lines, well over the
  400-line review budget)
- **Decision needed before apply: Yes**

**Suggested split** (natural fault line — backend and frontend are already
independent per `openspec/config.yaml` task-grouping rule, and the frontend
depends on the backend's `{ member }` contract, not the reverse):

- **PR 1 — Backend** (tasks 1.1, 1.2 code; 1.3 gated separately or as a
  final commit in the same PR pending explicit confirmation): ~137-152
  lines.
- **PR 2 — Frontend + E2E** (tasks 2.1-2.4, 3.1): ~267 lines, still over
  400 alone is unlikely but `MembersSettingsPage.tsx`'s rewrite (~200
  lines) is the single largest slice — consider landing 2.1+2.4 (small,
  ~17 lines) together, then 2.2 (~30 lines), then 2.3 (~200 lines) as
  separate reviewable commits/PRs within the frontend chain if the team
  wants tighter slices.
- Delivery strategy is `ask-on-risk` — `sdd-apply` MUST stop and ask
  whether to chain these PRs (and confirm `chain_strategy`:
  `stacked-to-main` vs `feature-branch-chain`) or proceed under
  `size:exception` before implementing.
