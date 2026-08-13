# Tasks: Admin Tiers + In-App Password Reset

No Prisma migration — all fields (`passwordHash`, `mustChangePassword`, `isAppAdmin`, `RefreshToken`) already exist. Code-only rollback.

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~380–460 (additions + deletions) |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 (backend authz) → PR 2 (backend reset) → PR 3 (frontend + e2e) |
| Delivery strategy | ask-on-risk |
| Chain strategy | stacked-to-main |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | PR | Focused test command | Runtime harness | Rollback boundary |
|---|---|---|---|---|---|
| 1 | Authz bypass: `authz.ts` + all call sites (admin/workspaces/boards/tasks) | PR 1 | `npm run build` (backend) | Manual: system admin w/o membership passes every gate; management admin/member unchanged | Revert `authz.ts` + 4 route files, no dependents yet |
| 2 | Reset endpoint + PUT consolidation | PR 2 | `npm run build` (backend) | Manual: `POST .../reset-password` returns tempPassword once, sessions invalidated; PUT ignores password | Revert new route + `updateSchema`/branch in `systemAdmin.ts` |
| 3 | Frontend reset UI + labels + e2e | PR 3 | `npx playwright test e2e/10-system-admin.spec.ts` | Full E2E suite `npx playwright test` | Revert `api.ts`, `SystemAdminPage.tsx`, e2e spec; PR 2 API stays functional standalone |

## Phase 1: Backend Authorization Foundation (PR 1)

- [x] 1.1 Create `taskflow-ai-backend/src/lib/authz.ts`: `isWorkspaceAdmin(workspaceId, userId)` — parallel `Promise.all` (membership role, user.isAppAdmin), returns boolean.
- [x] 1.2 `admin.ts`: delete local `assertAdmin`; replace 4 call sites (~41, 63, 162, 196) with `isWorkspaceAdmin`.
- [x] 1.3 `workspaces.ts`: replace 6 inline `role !== 'ADMIN'` blocks (~140, 156, 179, 306, 396, 419) with `isWorkspaceAdmin`; keep each existing Spanish 403 message; delete now-unused membership fetches.
- [x] 1.4 `boards.ts`: add `|| isAppAdmin` to `assertBoardAccess` (~62); align admin-listing gate (~77); route `DELETE /boards/:id` (~166) through `isWorkspaceAdmin`.
- [x] 1.5 `tasks.ts`: route move-task admin/creator check (~616) through `isWorkspaceAdmin`.
- [x] 1.6 Re-grep `role === 'ADMIN'|role !== 'ADMIN'` across `src/routes` — confirm no missed site (design R3).

## Phase 2: Backend Password Reset (PR 2, depends: none — parallel with Phase 1)

- [x] 2.1 `systemAdmin.ts`: add `POST /system-admin/users/:id/reset-password` — `assertAppAdmin` guard, `$transaction` (temp password `randomBytes(6)`, `bcrypt.hash(12)`, `user.update` passwordHash+mustChangePassword, `refreshToken.deleteMany(userId=:id)`), `200 { tempPassword }` once, `404` on P2025.
- [x] 2.2 `systemAdmin.ts`: remove `password` from `updateSchema` (~63) and delete the `if (password)` branch (~79).

## Phase 3: Frontend (PR 3, depends: 2.1 for API contract)

- [ ] 3.1 `src/lib/api.ts`: add `systemAdmin.resetPassword(id)`; drop `password` from `updateUser`.
- [ ] 3.2 `SystemAdminPage.tsx`: `ModalState` add `{type:'reset'}`; add KeyRound row action.
- [ ] 3.3 `SystemAdminPage.tsx`: build `ResetPasswordModal` (confirm/revealed phases, amber self-reset warning, copy button, reveal-once clear-on-close).
- [ ] 3.4 `SystemAdminPage.tsx`: remove password field/validation/assembly from EditModal.
- [ ] 3.5 `SystemAdminPage.tsx`: relabel `isAppAdmin` badge "App Admin" → "Admin de sistema".
- [ ] 3.6 `Sidebar.tsx`: verify `isAppAdmin` gating — confirm no change needed (design: already aligned).

## Phase 4: Verification (depends: Phase 1–3)

- [ ] 4.1 Backend: `npm run build` (tsc gate).
- [ ] 4.2 Frontend: `npm run build` (tsc gate).
- [ ] 4.3 Create `e2e/10-system-admin.spec.ts`: nav visible, table renders, reset reveal+copy, self-reset warning, edit modal has no password field; confirm/seed `tacosta@condor.com.py` `isAppAdmin` or add fixture.
- [ ] 4.4 Manual QA — bypass matrix: system admin w/o membership passes every changed gate (admin/workspaces/boards/tasks); management admin unchanged; member/viewer still 403.
- [ ] 4.5 Manual QA — reset flow: tempPassword once, old sessions invalidated, `mustChangePassword` forces change, self-reset signs out after token expiry; PUT ignores password.
