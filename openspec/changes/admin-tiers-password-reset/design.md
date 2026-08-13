# Design: Admin Tiers + In-App Password Reset

Change: `admin-tiers-password-reset` · Apps: backend + frontend · Store: hybrid
Reads: `proposal.md` (required), `exploration.md`. No Prisma migration.

## 1. Architecture approach

Two independent slices, one shared architectural primitive:

1. **Authorization slice (tier bypass).** Introduce ONE authorization helper as the
   single source of truth for "is this caller a workspace admin?", folding the global
   `isAppAdmin` tier into that predicate. Every existing workspace-admin gate calls it
   instead of re-implementing `membership.role === 'ADMIN'` inline. This removes the
   drift risk the proposal flagged: the bypass rule lives in exactly one function.
2. **Password-reset slice.** A dedicated `POST .../reset-password` endpoint that mirrors
   the existing auto-provisioned-invite pattern (`randomBytes` → bcrypt →
   `mustChangePassword` → session invalidation → return plaintext once). Remove the
   overloaded `password` field from the system-admin `PUT` so exactly one reset path
   remains.

Layering: authorization logic moves OUT of route handlers into a small `src/lib/authz.ts`
module (domain/authz concern), keeping Hono route files as thin transport + orchestration.
This is the Screaming/Hexagonal instinct applied narrowly — the permission rule is a
policy, not an HTTP detail, so it should not be copy-pasted across handlers.

## 2. Shared admin gate — helper design

New module `taskflow-ai-backend/src/lib/authz.ts`:

```
// Single source of truth for workspace-admin authorization.
// A caller is a workspace admin if they hold WorkspaceMember.role === 'ADMIN'
// in that workspace, OR they are a global system admin (User.isAppAdmin).
export async function isWorkspaceAdmin(workspaceId: string, userId: string): Promise<boolean> {
  const [membership, user] = await Promise.all([
    prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId } },
      select: { role: true },
    }),
    prisma.user.findUnique({ where: { id: userId }, select: { isAppAdmin: true } }),
  ])
  return membership?.role === 'ADMIN' || user?.isAppAdmin === true
}
```

Design rationale:
- **How the helper learns `isAppAdmin`:** a second, parallel `user.findUnique` selecting
  only `isAppAdmin`. Two queries run concurrently via `Promise.all`, so latency is one
  round-trip. Cost: one extra indexed PK lookup per admin-gated request — negligible and
  deterministic. Rejected alternative: short-circuit (check membership first, query user
  only if not admin) — saves one query for the common management-admin case but adds
  branchy control flow for micro-savings; not worth it.
- **Return type is `boolean`, not the membership object.** Audited all current call
  sites: none consume the object `assertAdmin` returns today (every site uses it purely
  as a truthiness guard). So narrowing to `boolean` is safe and clearer.
- **Management-admin behavior unchanged:** the `membership.role === 'ADMIN'` branch is
  identical to today for a workspace's own admin.

### Call sites that change

`assertAdmin` in `admin.ts` is deleted; both files import `isWorkspaceAdmin`.

**`admin.ts`** — remove local `assertAdmin` (lines 16-21); replace 4 call sites:

| Line | Route | New guard |
|---|---|---|
| 41 | `GET /workspaces/:workspaceId/users` | `if (!await isWorkspaceAdmin(workspaceId, userId))` |
| 63 | `POST /workspaces/:workspaceId/users` | same |
| 162 | `PUT /workspaces/:workspaceId/users/:targetUserId` | same |
| 196 | `DELETE /workspaces/:workspaceId/users/:targetUserId` | same |

**`workspaces.ts`** — replace the 6 inline `findUnique` + `role !== 'ADMIN'` blocks with a
single `if (!await isWorkspaceAdmin(id, userId)) return c.json({ error: <existing msg> }, 403)`.
Keep each route's existing Spanish error string.

| Check line | Route (def line) | Existing error message to preserve |
|---|---|---|
| 140 | `DELETE /:id` (133) | "Solo admins pueden eliminar el workspace" |
| 156 | `PUT /:id/members/:memberId` (148) | "Solo admins pueden cambiar roles" |
| 179 | `DELETE /:id/members/:memberId` (172) | "Solo admins pueden remover miembros" |
| 306 | `DELETE /:id/statuses/:statusId` (299) | "Solo admins pueden eliminar estados" |
| 396 | `PUT /:id/members/:memberId/email-notifications` (386) | "Solo admins pueden cambiar esta configuración" |
| 419 | `PUT /:id/settings` (411) | "Solo admins pueden cambiar la configuración" |

Each block currently fetches `membership`/`callerMembership` only for the role check and
uses it nowhere else, so the fetch is deleted along with the check.

### Boundary decision — do NOT expand new gates

The bypass changes only EXISTING admin gates. It does not add authorization to routes that
are currently open (e.g. `POST/PUT /:id/statuses/*`, the `/:id/uens/*` routes have no ADMIN
gate today). Scope stays "make `isAppAdmin` pass the gates that already exist."

## 3. ⚠ Architectural finding — the invariant is broader than the proposal scope

The proposal says "~6 inline checks in `workspaces.ts`". A full grep of `src/routes` shows
**additional workspace-admin gates outside the two proposal files**:

| File | Line | Gate | Effect on a no-membership system admin |
|---|---|---|---|
| `boards.ts` | 62 | `assertBoardAccess`: `wsMembership.role === 'ADMIN'` grants access | blocked from private boards |
| `boards.ts` | 77 | `isAdmin` gates admin board listing | partial view |
| `boards.ts` | 166 | `DELETE /boards/:id` admin-only | blocked |
| `tasks.ts` | 616 | move task: `ADMIN` or creator | blocked |

**Consequence:** if we ship the proposal scope verbatim, Success Criterion "a system admin
can perform EVERY workspace admin action" is only PARTIALLY met — board and task-move admin
actions still 403 for a membership-less system admin. This is the exact "missed call site →
inconsistent permission surface" risk, one layer up.

**Recommendation (needs user/orchestrator confirmation before tasks):**
- **Option A (recommended):** extend this change to route `boards.ts:166` and `tasks.ts:616`
  through `isWorkspaceAdmin`, and add an `|| isAppAdmin` branch to `assertBoardAccess`
  (grant board access to system admins regardless of `isPrivate`). Cheap now that the helper
  exists; fully satisfies the invariant. Adds ~4 more call sites + `assertBoardAccess` edit.
- **Option B:** ship proposal scope as-is, document the gap, file a follow-up. Faster PR,
  but the "sees/does everything" promise is knowingly incomplete.

Design defaults to **Option A** for correctness; flag it so scope is a conscious choice, not
drift. Either way, apply MUST re-grep `role === 'ADMIN'|role !== 'ADMIN'` across `src/routes`
and account for every hit.

## 4. Reset endpoint contract

`POST /system-admin/users/:id/reset-password` in `systemAdmin.ts` (route group already has
`authMiddleware` on `*`).

- **Auth:** `assertAppAdmin(userId)` (existing helper) → `403 { error: 'Sin acceso' }` if false.
- **Request body:** none. No `zValidator` needed.
- **Behavior (wrap the two writes in `prisma.$transaction`):**
  1. `tempPassword = randomBytes(6).toString('hex')` → 12 hex chars (invite pattern uses 5;
     bump to 6 for a bit more entropy on an admin-triggered reset — still simple, still a
     forced-change temp secret).
  2. `passwordHash = await bcrypt.hash(tempPassword, 12)`.
  3. `user.update({ where: { id }, data: { passwordHash, mustChangePassword: true } })`.
  4. `refreshToken.deleteMany({ where: { userId: id } })` — **target user's** id, invalidating
     all their sessions. This is the bug fix: mirrors `users.ts:185`.
- **Response:** `200 { tempPassword }` — plaintext returned exactly once, never logged, never
  persisted in plaintext.
- **Status codes:** `200` success · `403` caller not app admin · `404 { error: 'Usuario no
  encontrado' }` on Prisma `P2025` (unknown `:id`).
- **No self-restriction:** a system admin MAY reset any user including other app admins and
  themselves. Self-reset is allowed and behaves uniformly (see §6).

### PUT consolidation
In `systemAdmin.ts`: remove `password` from `updateSchema` (line 63) and delete the
`if (password) { ... }` branch (line 79). `PUT /system-admin/users/:id` becomes profile/role
edits only. Exactly one reset path (`POST .../reset-password`) remains.

## 5. Frontend design

### `src/lib/api.ts`
- Add to `systemAdmin`:
  ```
  resetPassword: (id: string) =>
    request<{ tempPassword: string }>(`/system-admin/users/${id}/reset-password`, { method: 'POST' }),
  ```
- `updateUser` signature: drop `password` → `data: { name?: string; email?: string }`.

### `SystemAdminPage.tsx`
- `ModalState` union: add `| { type: 'reset'; user: SystemAdminUser }`.
- Row actions (line 437-453): add a "Resetear contraseña" button (lucide `KeyRound` /
  `KeyRethinking`) between edit and delete, same hover-reveal styling.
- New `ResetPasswordModal` component, two-phase local state
  (`phase: 'confirm' | 'revealed'`, `tempPassword: string | null`, `copied: boolean`):
  - **confirm phase:** target avatar/name/email; text explaining sessions will be closed and
    the user must change the password next login; "Resetear" button.
  - **self-reset warning:** when `currentUser.id === user.id`, render an amber warning:
    "Vas a resetear TU PROPIA contraseña. Se cerrarán todas tus sesiones y vas a tener que
    volver a entrar con la contraseña temporal." Do NOT block — allowed by design.
  - on submit → `api.systemAdmin.resetPassword(user.id)` → store `tempPassword`, go to
    `revealed`.
  - **revealed phase:** monospace temp password + Copy button (`navigator.clipboard.writeText`,
    flip `copied` for feedback). Note "Se muestra una sola vez." Closing clears `tempPassword`
    from state (reveal-once; never re-fetchable).
- **Edit modal:** remove the "Nueva contraseña (opcional)" field (lines 222-231), its
  validation (line 179), and `data.password` assembly (line 184). Reset is now a distinct action.
- **Tier label legibility:** relabel the existing `isAppAdmin` badge (line 423) from
  "App Admin" to "Admin de sistema" so the system tier reads clearly. (Management admin is a
  per-workspace role and is not surfaced on this global page.)

### `Sidebar.tsx` — verify/align (likely NO change)
- Admin nav is already correctly gated `user?.isAppAdmin` (lines 144-151) → aligned.
- Gerencia nav (line 142) is shown to everyone; access is enforced at the page level in
  `GerenciaPage.tsx` (`userRole !== 'ADMIN' && !user?.isAppAdmin` → access-denied view). This
  page-guard pattern is consistent; no nav change required. Optional polish only.

## 6. Self-reset behavior (explicit decision)

Backend treats self-reset identically to any other target — no special case. Because step 4
deletes ALL of the target's refresh tokens, a self-resetting admin keeps their current
short-lived access token until it expires, then their next refresh fails and they are logged
out. The frontend surfaces this with the amber warning above; no forced redirect, no separate
`/users/me/password` bounce. Rationale: one endpoint, one code path, predictable; the UI
carries the "you're about to sign yourself out" affordance. (Supersedes the proposal's tentative
"redirect to /users/me/password" note.)

## 7. Prisma / migration impact — NONE

Confirmed against `prisma/schema.prisma`:
- `User.passwordHash` (30), `User.mustChangePassword` (32), `User.isAppAdmin` (33) all exist.
- `RefreshToken` model (49) exists with `userId` relation.

No schema change, no `prisma migrate`, no data migration. Rollback is code-only (revert diff).

## 8. Data flow (reset)

```
SystemAdminPage → api.systemAdmin.resetPassword(id)
  → POST /system-admin/users/:id/reset-password  (authMiddleware → assertAppAdmin)
    → $transaction: user.update(passwordHash, mustChangePassword=true)
                    refreshToken.deleteMany(userId=:id)
    → 200 { tempPassword }
  ← reveal-once modal (copy) ; target user's sessions now invalid
target user next login → forced password change (mustChangePassword)
```

## 9. Verification approach

Backend has NO test framework (`config.yaml`: `strict_tdd: false`, backend framework `none`).
Frontend is Playwright E2E only (`npx playwright test`, workers 1, retries 1, real backend on
:3000 + dev server on :5173, login `tacosta@condor.com.py` / `password123`, never mock `/api/**`).

**Type/build gate:** `npm run build` in `taskflow-ai-backend` (tsc) and `taskflow-ai-mockup`
must pass (verify `build_command`).

**Manual QA — authorization bypass (the load-bearing check):**
1. As a system admin with NO `WorkspaceMember` row in workspace W: exercise each changed gate
   (admin.ts user CRUD, workspaces delete/roles/remove/statuses/settings/email-notifications;
   and, if Option A, board delete + task move) → expect 2xx, not 403.
2. Management admin in their OWN workspace → unchanged (still 2xx).
3. Plain member / viewer with no `isAppAdmin` → still 403 everywhere.

**Manual QA — reset + consolidation:**
4. `POST .../reset-password` → returns `{ tempPassword }` once; old password login fails
   (sessions invalidated); temp password login works and forces change; `mustChangePassword`
   flips true.
5. `PUT /system-admin/users/:id` with a `password` field → field ignored/rejected, password
   unchanged (only one reset path remains).
6. Self-reset → succeeds; admin is signed out after access-token expiry.

**Frontend E2E — new spec `e2e/10-system-admin.spec.ts`** (none exists today; specs 01-09 do
not cover `/system-admin/*`):
- Admin nav icon visible for app admin; `/system-admin/users` renders the user table.
- Reset action opens modal → reveals a temp password → Copy button present.
- Self-reset row shows the amber warning.
- Edit modal no longer has a password field.
Prerequisite: seed/confirm `tacosta@condor.com.py` has `isAppAdmin = true`; if not, use/create
an app-admin fixture. Relevant skill for spec design: `qa-engineer`.
Existing `09-settings-members.spec.ts` remains the coverage for management-admin workspace flows.

## 10. ADR-style decisions

- **ADR-1 Single `isWorkspaceAdmin` helper in `src/lib/authz.ts`.** Accepted. Alternatives
  rejected: (a) add `|| isAppAdmin` inline at each site — re-introduces the drift the change
  is meant to kill; (b) Hono middleware factory `requireWorkspaceAdmin(paramName)` — cleaner
  long-term but the workspace-id param name varies (`workspaceId` vs `id`) and some routes do
  work before the check, so a plain awaited helper is the lowest-risk refactor now. Middleware
  is a viable follow-up.
- **ADR-2 Two parallel queries over short-circuit.** Accepted for determinism/simplicity; the
  extra PK lookup is negligible.
- **ADR-3 New endpoint + server-generated temp password (proposal approach 2).** Accepted over
  extending PUT (conflates concerns, weak audit) and over reset-link (SMTP unreliable in prod —
  the whole motivation). Consolidate to one reset path.
- **ADR-4 Self-reset allowed, uniform code path, UI-warned.** Accepted; supersedes proposal's
  redirect idea.
- **ADR-5 Extend bypass to `boards.ts`/`tasks.ts` (Option A).** Proposed, pending confirmation.
  Required for the "sees/does everything" invariant; documented as risk if deferred.

## 11. Risks / assumptions

- **R1 (High if Option B):** board + task-move admin gates outside proposal scope leave the
  system-admin invariant partially unmet. Mitigation: Option A, or explicit follow-up.
- **R2 (Med):** temp-password leakage via browser state/history. Mitigation: reveal once, clear
  from state on close, never log, HTTPS.
- **R3 (Med):** a missed call site. Mitigation: single helper + mandatory `role === 'ADMIN'`
  grep across `src/routes` during apply; every hit accounted for.
- **R4 (Low):** no audit trail for resets/bypassed actions. Accept as follow-up; session
  invalidation limits blast radius.
- **A1:** `tacosta@condor.com.py` (E2E login) is or can be made an app admin; otherwise the
  system-admin E2E needs a dedicated app-admin fixture.
- **A2:** no consumer relies on `PUT /system-admin/users/:id` accepting `password` (removed).
