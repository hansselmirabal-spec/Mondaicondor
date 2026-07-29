# Exploration — member-direct-add

**Goal:** Adding someone to a workspace should make them a member **immediately** and just **notify** them by email — no "accept/reject invitation" step.

## Current state (confirmed)

| Path | File | Existing user | New user | Notifies |
|---|---|---|---|---|
| `POST /workspaces/:id/invite` | `workspaces.ts:157` | ❌ only a pending `WorkspaceInvite` (no membership) | ✅ creates user + member directly | email (buggy for existing) |
| `POST /admin/workspaces/:id/users` | `admin.ts:56` | ✅ direct member (409-guards dupes) | ✅ creates user + member | email |
| `POST /boards/:id/members` | `boards.ts` | ✅ direct add | — | — |
| `POST /workspaces/accept/:token` | `workspaces.ts` | membership already existed → effectively dead | — | — |

**Root of the confusion:** the `/invite` endpoint is the only path that leaves an existing user as a *pending* invite instead of a member. `admin.createUser` already implements the desired behavior — it just isn't reachable from `BoardHeader` or the "new user" tab.

**Bonus bug found:** for an existing user, `/invite` sends `sendInviteEmail(..., tempPassword=undefined)` → email says "your account is ready" with no password, to someone who isn't even a member yet. This fix resolves it.

## Affected areas

- Backend: `workspaces.ts` (`/invite`, `/accept/:token`), `admin.ts` (reference impl), `prisma/schema.prisma` (`WorkspaceInvite`), `tasks.ts` (`notifyUsers` reusable helper), `lib/email.ts` (`sendInviteEmail`).
- Frontend: `BoardHeader.tsx` (Invitar miembro), `MembersSettingsPage.tsx` (InviteRegisteredTab OK / InviteNewUserTab needs rewrite), `AcceptInvitePage.tsx` + route (deletion candidate), `lib/api.ts` (`addMember`/`acceptInvite`). `MembersPage.tsx` is NOT a touchpoint.

## Approaches

1. **Patch `/invite` in place, keep token/accept for new users** — smallest diff; but keeps a functionally-dead accept step and two duplicated add paths. Effort: Low.
2. **Consolidate into one direct-add+notify flow; remove `WorkspaceInvite` + `/accept/:token` + `AcceptInvitePage`** — single source of truth, matches intent, deletes dead/misleading code. Requires a **destructive Prisma migration** (drop table). Effort: Medium. **← recommended**
3. **Minimal patch: fix existing-user branch, keep `WorkspaceInvite` as inert audit log** — lowest effort, no migration; leaves a pointless table + dead route/page.

## Risks / open questions

- Approach 2 needs a **destructive migration** (drop `WorkspaceInvite`) — explicit confirmation required.
- Two existing endpoints send email differently (awaited+caught vs fire-and-forget) — unify.
- No endpoint writes an in-app `Notification` today (email-only); "notify" scope may add it.
- Two overlapping members pages (`/members`, `/settings/members`) — out of scope, flag.
- No backend test framework; verification via Playwright E2E + manual QA.

## Engram

`sdd/member-direct-add/explore` (project: `gentle-ai`).
