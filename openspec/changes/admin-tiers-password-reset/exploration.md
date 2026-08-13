# Exploration — admin-tiers-password-reset

**Goal:** (1) Two admin tiers — **system admin** (global, sees/does everything) and **management admin** (per-workspace). (2) **In-app password reset** a system admin can run on any user, no email dependency.

## Current state (confirmed)

**Both tiers already exist as separate mechanisms — just not unified/labeled:**

| Tier | Mechanism | Gate | Scope today |
|---|---|---|---|
| System admin | `User.isAppAdmin` (bool) | `assertAppAdmin()` in `systemAdmin.ts:14` | list/create/edit/delete ALL users, mounted `/system-admin/*` |
| Management admin | `WorkspaceMember.role === 'ADMIN'` | `assertAdmin()` in `admin.ts:16` + ~6 inline checks in `workspaces.ts` | their workspace only |

**Two key discoveries:**
1. **Password reset already partially exists:** `PUT /system-admin/users/:id` (`systemAdmin.ts:66`) accepts an optional `password` and resets it (+ `mustChangePassword`). **BUG:** it's missing `refreshToken.deleteMany` — every other password-change path invalidates sessions; this one doesn't. Fix regardless.
2. **"System admin sees everything" is NOT true yet:** `assertAdmin()` + inline checks only look at `WorkspaceMember.role`, never `isAppAdmin`. A system admin with no membership row is blocked from that workspace's admin endpoints. Frontend `GerenciaPage` already treats `isAppAdmin` as a superset, but backend doesn't. **← central architectural fork.**

No audit-log model exists (`Activity` is task-scoped).

## Approaches for the in-app reset

1. **Extend existing `PUT /system-admin/users/:id`** — fix session bug, split UI. Low effort; conflates edit+reset, weak audit, admin invents password.
2. **New endpoint + server-generated temp password** (`POST /system-admin/users/:id/reset-password`) — reuses `randomBytes` pattern, `mustChangePassword`, invalidates sessions, returns plaintext once. Medium; clean audit; manual handoff.
3. **Reuse `PasswordResetToken`, return the link (don't email)** — end user completes via existing `/auth/reset-password`. Zero new schema; user picks own password; session-invalidation inherited. Low–Medium; two-step.

**Recommendation:** Approach 3 default + Approach 2 as a secondary explicit action; remove the password field from the current `PUT` so there's ONE safe reset path.

## Open questions for proposal
1. Does `isAppAdmin` **bypass** workspace `assertAdmin` checks (true global) or get parallel workspace-agnostic endpoints? **(user said "el admin de sistemas ve todo" → lean bypass)**
2. Reset via link, temp-password, or both?
3. Minimal audit log in scope? (recommend defer)
4. Granting/revoking `isAppAdmin` itself in scope? (recommend defer)

## Risks
- ~6+ call sites to update together if isAppAdmin bypasses workspace checks — easy to miss one.
- Confirmed session-invalidation bug on current reset path.
- No audit trail.
- No backend tests; frontend E2E only → sensitive endpoints need an E2E spec.

## Engram
`sdd/admin-tiers-password-reset/explore` (project: `gentle-ai`).
