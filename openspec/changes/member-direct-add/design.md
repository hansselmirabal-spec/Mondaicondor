# Design: member-direct-add

## Technical Approach

Consolidate ALL "add member to workspace" flows onto the existing, already-correct
`POST /admin/workspaces/:workspaceId/users` (`admin.ts`), which does direct membership +
fire-and-forget email + 409 dup guard. Extend it with (a) auto-provisioning of brand-new
users (temp password, no pending state) and (b) an in-app `Notification` row. Delete the
broken `/workspaces/:id/invite` + dead `/workspaces/accept/:token`, the `WorkspaceInvite`
model, `AcceptInvitePage`, and its route. Frontend callers keep calling
`api.workspaces.addMember` (name unchanged) but it repoints to the admin endpoint.

## Architecture Decisions

### Decision: Canonical endpoint = `POST /admin/workspaces/:workspaceId/users`
| Option | Tradeoff | Decision |
|---|---|---|
| Converge on admin endpoint | +1 endpoint owns add; response `{member}`; small FE churn | **CHOSEN** |
| Rewrite `/invite` in place | Leaves TWO direct-add endpoints → duplication, contradicts consolidation intent | Rejected |

**Rationale**: One endpoint, one behavior. `admin.createUser` already implements the target
semantics (direct member, fire-and-forget email, 409). Duplicating that into `/invite` would
re-create the exact inconsistency this change removes.

### Decision: Auto-provision new users on the admin endpoint
**Choice**: When the user does not exist AND `name`/`password` are omitted, generate a temp
password (`randomBytes(5).hex`), derive name/initials from the email local-part, set
`mustChangePassword: true`, create user + `WorkspaceMember` in one `$transaction`, and email
the temp password (port of the current `/invite` logic). Explicit `name`+`password` still
creates deliberately. **Rejected**: keeping the 404 "use invitation flow" branch — that flow
is being deleted.

### Decision: Email is fire-and-forget-with-catch (never blocks membership)
Converging on the admin endpoint adopts its `.catch()` pattern automatically; `/invite`'s
awaited+caught email is dropped. The `sendEmail` flag is retired — the endpoint always emails.

### Decision: In-app Notification reuses the existing model as-is
`Notification` (userId, title, body, taskId?, boardId?) is written with `taskId=boardId=null`.
No schema extension (no `workspaceId`/`actorId` columns added — out of scope). Actor name is
embedded in the body; deep-link target for null/null notifications is `/boards`.

## Data Flow

    BoardHeader / InviteNewUserTab ──> api.workspaces.addMember
        └─> POST /admin/workspaces/:id/users (assertAdmin)
              ├─ existing user  ─> create WorkspaceMember (409 if dup)
              └─ new user       ─> $tx: create User(temp pwd) + WorkspaceMember
              ├─ prisma.notification.create({userId, title, body})  .catch
              └─ sendInviteEmail(...)                               .catch
        <─ { member }

## Notification Payload
```ts
{ userId: <addedUserId>, title: `Te agregaron a ${workspaceName}`,
  body: `${actorName} te agregó al workspace ${workspaceName} como ${roleLabel}.`,
  taskId: null, boardId: null }  // read=false, createdAt=now by default
```
Deep-link: bell click with null task/board routes to `/boards`.

## File Changes
| File | Action | Description |
|---|---|---|
| `backend/src/routes/admin.ts` | Modify | Add auto-provision branch + `notification.create`; fetch actor name |
| `backend/src/routes/workspaces.ts` | Modify | Delete `/invite` (157-212) + `/accept/:token` (214-241), `inviteSchema`, now-unused imports (`bcrypt`, `randomBytes`, `sendInviteEmail`) |
| `backend/prisma/schema.prisma` | Modify | Remove `model WorkspaceInvite` (107-120) + `Workspace.invites` relation (71) |
| `backend/prisma/migrations/*_drop_workspace_invite/` | Create | `DROP TABLE "WorkspaceInvite"` (+FK) — GATED |
| `mockup/src/lib/api.ts` | Modify | Repoint `addMember` → `/admin/workspaces/:id/users`, return `{member}`; delete `invite`, `acceptInvite` |
| `mockup/src/pages/MembersSettingsPage.tsx` | Modify | Rewrite `InviteNewUserTab` as direct-add (model: `InviteRegisteredTab`); drop link/copy panel |
| `mockup/src/components/board/BoardHeader.tsx` | Modify | Copy → "Agregar miembro"; use `{member}` response; toast "Se agregó a…" |
| `mockup/src/pages/AcceptInvitePage.tsx` | Delete | Dead page |
| `mockup/src/app/router.tsx` | Modify | Remove import (6) + route (54) |

## Migration / Rollout — DESTRUCTIVE GATE
`prisma migrate` emits an irreversible `DROP TABLE "WorkspaceInvite"` that deletes all pending
rows (dead-weight; memberships live in `WorkspaceMember`). **Apply MUST NOT run the migration
until the user explicitly confirms** (openspec `archive.Warn before merging destructive deltas`).
Rollback: code revert restores endpoints/pages; the dropped table needs a new forward migration
(rows unrecoverable) — hence the gate.

## Testing Strategy
| Layer | What | Approach |
|---|---|---|
| Backend | none configured | Manual QA (add existing/new, 409 dup, notification row, email) |
| E2E | `e2e/09-settings-members.spec.ts` | Update: tests 71-84 (stale name/password "Crear y agregar" form) → new email+role direct-add form; test 59-68 selector `invitar a` → `Agregar a` |
| Build | both apps | `npm run build` (backend + mockup) |

No accept-invite E2E exists. `07-workspace.spec.ts` needs no change (grep false-positive on "accepts").

## Threat Matrix
N/A — REST endpoint consolidation behind existing `authMiddleware` + `assertAdmin`; no routing-security, shell, subprocess, VCS/PR automation, executable-file classification, or process-integration boundary introduced.

## Open Questions
- [ ] Confirm the destructive `DROP TABLE` at apply time (blocking gate).
- [ ] Keep the explicit `name`+`password` create path on the admin endpoint, or drop it? (Design keeps it — backward compatible, zero cost.)
