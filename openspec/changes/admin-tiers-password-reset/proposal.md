# Proposal: Admin Tiers + In-App Password Reset

## Intent

Formalize two distinct admin tiers and give system admins a reliable, email-free way to reset any user's password. Two concrete gaps drive this now: (1) `isAppAdmin` is documented as "global, sees/does everything" but the backend never honors it in workspace admin gates — a system admin with no `WorkspaceMember` row is blocked; (2) the only current reset path (`PUT /system-admin/users/:id` with a `password` field) does NOT invalidate sessions, unlike every other password-change path — a confirmed security bug. Prod SMTP is unreliable, so the email reset flow is not a dependable admin tool.

## Scope

Affected apps: **backend** and **frontend**.

### In Scope
- **System admin bypass:** `isAppAdmin === true` bypasses `assertAdmin()` (`admin.ts`) and ALL ~6 inline `membership.role === 'ADMIN'` checks in `workspaces.ts`. Applied consistently across every call site so a system admin acts on any workspace with no membership row.
- **New reset endpoint:** `POST /system-admin/users/:id/reset-password`, gated by `assertAppAdmin`. Generates a temp password (`randomBytes(...).toString('hex')`), bcrypt-hashes it, sets `mustChangePassword: true`, invalidates all sessions (`refreshToken.deleteMany`), returns plaintext temp password ONCE.
- **PUT consolidation:** remove `password` handling from `PUT /system-admin/users/:id`. That PUT is profile/role edits only. Exactly ONE reset path remains.
- **Frontend:** `SystemAdminPage.tsx` per-user "Resetear contraseña" action → confirm → reveal temp password once (copyable). Legible tier labels (system vs management admin) in nav/UI; consistent `isAppAdmin` gating for Admin nav + Gerencia.

### Out of Scope (non-goals)
- Any audit-log model/trail (recommended follow-up).
- Granting/revoking `isAppAdmin` from the UI (defer).
- The reset-LINK approach and email flow — `/auth/forgot-password` + `/auth/reset-password` stay untouched.
- Renaming `Role` enum or adding enum values.

## Capabilities

### New Capabilities
- `system-admin-tier`: global `isAppAdmin` bypass of workspace-scoped admin gates; two-tier definition (system vs management admin) and UI legibility.
- `admin-password-reset`: system-admin-only temp-password reset endpoint with session invalidation; single-reset-path consolidation.

### Modified Capabilities
- None (no existing specs).

## Approach

**Tier bypass:** centralize the check — a system admin passes any workspace admin gate. Prefer refactoring `assertAdmin()` to accept `isAppAdmin` as an OR condition and replacing the inline `workspaces.ts` checks with that shared helper, so the bypass lives in one place and cannot drift. Management admin (`WorkspaceMember.role === 'ADMIN'`) behavior for its own workspace is unchanged.

**Reset (temp-password, approach 2):** mirror the auto-provisioned-invite pattern already in the repo. Endpoint returns `{ tempPassword }` once; never logged/persisted in plaintext. Self-reset should redirect to `/users/me/password` (decide + cover in spec).

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `taskflow-ai-backend/src/routes/admin.ts` | Modified | `assertAdmin` honors `isAppAdmin` |
| `taskflow-ai-backend/src/routes/workspaces.ts` | Modified | ~6 inline ADMIN checks route through shared gate |
| `taskflow-ai-backend/src/routes/systemAdmin.ts` | Modified | New reset endpoint; drop `password` from PUT |
| `taskflow-ai-mockup/src/pages/SystemAdminPage.tsx` | Modified | Reset action + reveal-once modal |
| `taskflow-ai-mockup/src/components/layout/Sidebar.tsx` | Modified | Consistent tier labels/gating |
| `taskflow-ai-mockup/src/lib/api.ts` | Modified | New `resetPassword` client method |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Missing one of the ~6 `workspaces.ts` call sites → inconsistent permission surface | Med | Single shared gate helper; grep all `role === 'ADMIN'` sites; verify each |
| Temp password leaks (browser state/history/logs) | Med | Reveal once, never persist/log plaintext, clear from state after copy |
| Broadened access with no audit trail | Med | Note as follow-up; session invalidation limits stale-session blast radius |
| Self-reset undefined behavior | Low | Explicit decision + spec scenario (redirect to `/users/me/password`) |

## Rollback Plan

Revert the diff. No Prisma schema/migration changes (reuses `mustChangePassword`, `refreshToken`), so rollback is code-only with no data migration. The removed PUT `password` field can be restored by reverting `systemAdmin.ts`.

## Dependencies

- None new. Reuses bcrypt, `randomBytes`, `refreshToken` model, `mustChangePassword` flag.

## Success Criteria

- [ ] A system admin with no `WorkspaceMember` row can perform every workspace admin action.
- [ ] Management admin behavior in its own workspace is unchanged.
- [ ] `POST /system-admin/users/:id/reset-password` returns the temp password once, forces change on next login, and invalidates all sessions.
- [ ] `PUT /system-admin/users/:id` no longer accepts `password`; only one reset path exists.
- [ ] Frontend exposes reset action + reveal-once UI; tiers are clearly labeled.
