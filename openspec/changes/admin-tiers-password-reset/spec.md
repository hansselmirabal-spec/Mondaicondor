# Delta Specs: admin-tiers-password-reset

Two new capabilities. No prior `openspec/specs/` entries exist for either domain — both are written as full ADDED requirement sets. No Prisma schema/migration change is expected (see design); this note is informational only, not a requirement.

---

## Domain: system-admin-tier

### Purpose

Define admin authorization tiers: system admin (`User.isAppAdmin === true`, global) and management admin (`WorkspaceMember.role === 'ADMIN'`, per-workspace).

### ADDED Requirements

#### Requirement: System Admin Workspace Bypass

A system admin (`isAppAdmin === true`) MUST be authorized to perform any workspace-scoped admin action, even without a `WorkspaceMember` row for that workspace.

##### Scenario: System admin manages a workspace they don't belong to
- GIVEN a user with `isAppAdmin = true` and no `WorkspaceMember` row in workspace W
- WHEN they add, edit, or remove a member, or edit workspace settings in W
- THEN the action succeeds (no 403)

##### Scenario: System admin bypass applies to every admin-gated action
- GIVEN a system admin with no membership in workspace W
- WHEN they call each workspace-admin-gated endpoint in `workspaces.ts` (member add/edit/remove, workspace edit, and any other `role === 'ADMIN'`-gated action)
- THEN every call succeeds — no endpoint is missed by the bypass

#### Requirement: Management Admin Scope Unchanged

A management admin (`WorkspaceMember.role === 'ADMIN'`) MUST retain full admin capability in their own workspace and MUST NOT gain access to workspaces where they hold no ADMIN membership.

##### Scenario: Management admin acts on own workspace
- GIVEN a user whose `WorkspaceMember.role === 'ADMIN'` in workspace W
- WHEN they perform an admin action in W
- THEN the action succeeds, unchanged from current behavior

##### Scenario: Management admin cannot act on a foreign workspace
- GIVEN a user who is ADMIN in workspace W but has no membership (or non-ADMIN membership) in workspace X
- WHEN they attempt an admin action in X
- THEN the request is rejected with 403

#### Requirement: Non-Admin Rejection

A user who is neither a system admin nor a management admin of the target workspace MUST receive 403 on admin-gated actions.

##### Scenario: Regular member attempts an admin action
- GIVEN a user with `isAppAdmin = false` and `WorkspaceMember.role !== 'ADMIN'` in workspace W
- WHEN they attempt an admin action in W
- THEN the request is rejected with 403

---

## Domain: admin-password-reset

### Purpose

Give system admins a reliable, email-free way to reset any user's password, replacing the session-unsafe path currently embedded in `PUT /system-admin/users/:id`.

### ADDED Requirements

#### Requirement: Reset Endpoint Access Control

`POST /system-admin/users/:id/reset-password` MUST be accessible only to system admins.

##### Scenario: System admin resets a password
- GIVEN an authenticated system admin
- WHEN they call `POST /system-admin/users/:id/reset-password` for any target user id
- THEN the request succeeds (200)

##### Scenario: Non-system-admin is rejected
- GIVEN an authenticated user who is not a system admin (including a management admin)
- WHEN they call the reset endpoint
- THEN the request is rejected with 403

#### Requirement: Temp Password Generation and Session Invalidation

The reset endpoint MUST generate a random temporary password, store only its bcrypt hash, set `mustChangePassword = true`, invalidate every existing session of the target (`refreshToken.deleteMany`), and return the plaintext temp password exactly once. The plaintext MUST NOT be logged or persisted anywhere.

##### Scenario: Successful reset invalidates existing sessions
- GIVEN a target user with at least one active session (refresh token)
- WHEN the system admin resets that user's password
- THEN the response body contains the plaintext temp password
- AND the target's prior session(s) are rejected on next use
- AND the target is required to change password on next login

#### Requirement: No Target Restriction

A system admin MAY reset the password of any user: regular users, management admins, other system admins, and themselves. No target is protected from reset.

##### Scenario: System admin resets another system admin
- GIVEN a target user who is also `isAppAdmin = true`
- WHEN the acting system admin resets the target's password
- THEN the reset succeeds identically to a regular-user reset

##### Scenario: System admin resets their own password
- GIVEN a system admin acting on their own user id
- WHEN they call the reset endpoint on themselves
- THEN the reset succeeds
- AND their own current session(s) are invalidated, requiring them to re-authenticate with the returned temp password

#### Requirement: Single Reset Path (PUT Consolidation)

`PUT /system-admin/users/:id` MUST NOT accept or apply a `password` field. It edits profile/role fields only.

##### Scenario: PUT ignores a password field
- GIVEN a system admin calling `PUT /system-admin/users/:id` with a payload containing profile fields and a `password` field
- WHEN the request is processed
- THEN profile/role fields are updated
- AND the target's password and sessions are unaffected by this call

#### Requirement: Frontend Reveal-Once Reset UI

`SystemAdminPage` MUST expose a per-user "Resetear contraseña" action that, after confirmation, reveals the returned temp password exactly once in a copyable UI element. Admin tier labels (system vs. management) MUST be legible, and `isAppAdmin` nav/gating MUST be consistent across the app.

##### Scenario: Admin reveals and copies the temp password once
- GIVEN a system admin on `SystemAdminPage` viewing a target user
- WHEN they trigger "Resetear contraseña" and confirm
- THEN the temp password is shown once in a copyable field
- AND dismissing or navigating away removes it from the UI with no way to redisplay it

##### Scenario: Tier labels and nav gating are consistent
- GIVEN a logged-in user viewing app navigation
- WHEN their tier is system admin vs. management admin
- THEN the UI labels the tier distinctly
- AND Admin/Gerencia nav visibility matches `isAppAdmin` consistently across pages
