# Proposal — member-direct-add

**Change:** Consolidate "add a person to a workspace" into a single **direct-add + notify** flow, and remove the invite/accept machinery entirely.

**Apps affected:** both — `taskflow-ai-backend` (Hono/Prisma) and `taskflow-ai-mockup` (React).

**Chosen approach:** Exploration Approach 2 (b) — recommended and confirmed by the user.

---

## Why (intent)

Today, adding someone to a workspace behaves inconsistently and is partly broken:

- `POST /workspaces/:id/invite` is the only path that leaves an **existing user** in a *pending* `WorkspaceInvite` state with **no membership**. The admin believes the add succeeded, but nothing happened — the user is not a member and receives a misleading "Tu cuenta está lista" email with no password (`sendInviteEmail(..., tempPassword=undefined)`).
- The `POST /workspaces/accept/:token` step is **already dead code**: brand-new users are created as members *before* they ever visit the accept link, so accepting flips `acceptedAt` on an already-existing membership and does nothing. The only case where accept "matters" (existing users) is precisely the bug above.
- `POST /admin/workspaces/:id/users` **already implements the desired behavior** (direct membership + email) for existing users — it just isn't reachable from `BoardHeader` or the "Usuario nuevo" tab.

The product intent is simple and already established elsewhere in the app (board-member add, task assignment): **adding a person makes them a member immediately, and they are notified.** There is no "accept/reject" concept to preserve — it never functioned. This change makes the workspace-level flow match that intent, fixes the existing-user bug as a side effect, and deletes the dead/misleading invite/accept code.

### Success looks like

- Adding an email to a workspace creates a `WorkspaceMember` **immediately**, for both existing and brand-new users, from every entry point (`BoardHeader`, `MembersSettingsPage`).
- The added person is **notified**: an email (reused `sendInviteEmail`) **and** an in-app `Notification` row.
- No `WorkspaceInvite` table, no `/accept/:token` endpoint, no `AcceptInvitePage`, no "generate invite link" UI anywhere.
- No user-visible "pending invitation" state exists anymore.

---

## Scope

### In scope

**Backend (`taskflow-ai-backend`)**
- Make workspace member-add create a `WorkspaceMember` **immediately** for BOTH:
  - existing users → direct membership (keep the 409 duplicate-membership guard from `admin.createUser`);
  - brand-new users → still create the account (temp password, `mustChangePassword`) + membership in one step, **no pending state**.
- On add, in addition to the email, write an **in-app `Notification` row** for the added user. Reuse the `notifyUsers` pattern from `tasks.ts` (`Notification.taskId`/`boardId` are nullable, so it generalizes to "you were added to workspace X").
- Reuse `sendInviteEmail` (`src/lib/email.ts`) as the notification email.
- **Unify the email-send style** across the flow: adopt **fire-and-forget-with-catch** (as in `admin.createUser` — not awaited, `console.error` on failure). Email delivery must never block or fail the membership creation.
- **Remove** `POST /workspaces/accept/:token` (and its `acceptedAt` logic).
- **Remove** the `WorkspaceInvite` model from `prisma/schema.prisma` → **destructive Prisma migration (DROP TABLE)**. See the confirmation gate below.

**Frontend (`taskflow-ai-mockup`)**
- Rewrite copy/behavior in `BoardHeader.tsx` "Invitar miembro" → **"Agregar miembro"** (direct add). Drop "se generará un link de invitación", "Generar invitación y enviar correo", "Invitación enviada" language.
- Rewrite `MembersSettingsPage.tsx` `InviteNewUserTab` → direct-add semantics ("Agregar miembro"), drop the copyable invite-link panel entirely.
- Delete `AcceptInvitePage.tsx` and its `/workspaces/accept/:token` route.
- Remove the `acceptInvite` API method from `lib/api.ts` (and align `addMember` to the consolidated contract).
- `InviteRegisteredTab` is **already correct** ("El usuario será agregado al workspace y recibirá un email de notificación" / "Agregar a {name}") — used as the copy model, not rewritten.

### Out of scope (non-goals)

- **Consolidating the two overlapping members pages** (`/members` = `MembersPage.tsx`, edit/delete only, no add UI; `/settings/members` = `MembersSettingsPage.tsx`, owns the add UI). Flagged as an IA smell, but not touched here.
- **Task assignment** — already notify-only, no change.
- Collapsing `MembersSettingsPage`'s two tabs ("Usuario registrado" / "Usuario nuevo") into a single input — the split stays; only `InviteNewUserTab` copy/behavior is rewritten.
- Platform-level user CRUD (`/system-admin/users`) — not workspace-scoped, untouched.
- Any genuine self-service signup ("invitee sets own password before joining") — that would be a NEW feature, not a preservation of current `WorkspaceInvite` semantics.

---

## Approach & rationale

1. **One canonical direct-add flow.** Both frontend entry points converge on a single member-add contract that: (a) branches on new-vs-existing internally, (b) creates membership immediately, (c) notifies via email + in-app `Notification`. `admin.createUser` already proves this works for existing users; the change extends it to brand-new users and wires both frontend callers to it. Exact endpoint canonicalization (extend `admin.ts POST /workspaces/:id/users` vs. rewrite `workspaces.ts POST /:id/invite` in place) is a **design-phase decision** — it affects URL/contract stability for `api.ts`. Direction: prefer minimal contract churn for the two frontend callers.
2. **Delete, don't deprecate.** The accept step provides zero function for its only legitimate case, so removing it is not a regression — it's deleting dead weight while fixing the described bug. Leaving `WorkspaceInvite` as an inert table (Approach c) was rejected: it keeps a pointless table plus a dead route/page and a long-term two-endpoint maintenance smell.
3. **Notify = email + in-app.** "Direct add + notify" means both channels. Today no endpoint writes an in-app `Notification` on member-add; adding it is the "notify" half of the intent, using the existing `notifyUsers` generalization.

---

## Destructive migration — CONFIRMATION GATE (blocking)

⚠️ **This change requires a DESTRUCTIVE Prisma migration that DROPS the `WorkspaceInvite` table.** This is irreversible.

- **Current prod data:** there may be stale pending `WorkspaceInvite` rows. Dropping them is **acceptable** — they are the dead-weight this change removes (no other code reads `acceptedAt` or depends on pending-invite state). But it **must be stated**: any pending invitations that were never accepted will be permanently deleted. Existing users referenced by those rows are unaffected (their membership, if any, lives in `WorkspaceMember`, not `WorkspaceInvite`).
- **Gate:** the apply phase MUST NOT run the schema drop until the **user explicitly confirms** the destructive migration. Per `openspec/config.yaml` archive rule ("Warn before merging destructive deltas"), this is surfaced here at proposal time and must be re-confirmed before apply.

---

## Risks & open questions

- **Destructive migration (drop `WorkspaceInvite`)** — irreversible; explicit user confirmation required before apply (see gate above).
- **Endpoint canonicalization** (extend `admin.ts` vs. rewrite `workspaces.ts /invite`) — deferred to design; impacts `api.ts` contract stability for both frontend callers.
- **Notification copy/deep-link** — the title/body for the in-app "added to workspace" `Notification`, and whether it deep-links (mirroring `taskUrl` in `notifyUsers`), to be specified in spec/design.
- **No backend test framework** (`config.yaml`: `testing.backend.framework=none`) — verification relies on the Playwright E2E suite (`npx playwright test`, 9 sequential/stateful specs) plus manual QA. Any E2E spec that exercised the accept-invite flow must be updated/removed.
- **Email-send unification** — adopting fire-and-forget-with-catch changes error behavior on the `/invite` path (was awaited+caught); acceptable since email must never block membership.

## Rollback plan

- **Code (backend + frontend):** revert the change set. Endpoints, routes, page, and API methods are restored by git revert.
- **Schema:** the `WorkspaceInvite` DROP is **not** recoverable by revert alone — restoring the table requires a new forward migration re-adding it, and any dropped rows are gone. Because the table is dead-weight, rollback restores structure but not deleted pending-invite rows (which carried no live functional state). This asymmetry is the reason for the confirmation gate.

---

## Next phases

- **spec** — Given/When/Then scenarios (RFC 2119) for: add existing user, add brand-new user, duplicate add (409), notification (email + in-app) emitted, removal of accept flow, ADMIN-only gating, role handling (ADMIN/MEMBER/VIEWER, default MEMBER).
- **design** — canonical endpoint decision + `api.ts` contract, Prisma schema/migration plan (DROP `WorkspaceInvite`), in-app `Notification` payload/deep-link, email-send pattern, frontend component/copy changes, E2E spec updates.
