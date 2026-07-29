# Delta for Workspace Membership

No existing formal spec exists for this domain (`openspec/specs/` is empty for this project). This delta is written against current system behavior described in `openspec/changes/member-direct-add/exploration.md` and becomes the baseline spec at archive time.

## ADDED Requirements

### Requirement: Direct membership for existing user

The system MUST create a `WorkspaceMember` immediately when an ADMIN adds an email that belongs to an existing user account. No pending/invite state MUST exist at any point.

#### Scenario: Existing user added to workspace

- GIVEN an ADMIN of workspace W and an existing user account for email `e`, not currently a member of W
- WHEN the ADMIN submits an add-member request for `e` (with a role)
- THEN a `WorkspaceMember` row for that user and W MUST exist immediately after the request succeeds
- AND the response MUST NOT contain any pending/invite/token state

### Requirement: Direct membership for brand-new user

The system MUST, in a single operation, create a user account (with a system-generated temporary password and `mustChangePassword: true`) AND a `WorkspaceMember` row when an ADMIN adds an email with no existing account.

#### Scenario: New user added to workspace

- GIVEN an ADMIN of workspace W and no existing user account for email `e`
- WHEN the ADMIN submits an add-member request for `e` (with a role)
- THEN a new user account for `e` MUST exist with `mustChangePassword: true`
- AND a `WorkspaceMember` row linking that user to W MUST exist
- AND no separate "pending" or "accept" step MUST be required to activate membership

### Requirement: Duplicate add rejected

The system MUST reject an add-member request when the target user is already a member of the workspace, without creating a duplicate row.

#### Scenario: Adding an existing member again

- GIVEN a user `u` who is already a `WorkspaceMember` of workspace W
- WHEN an ADMIN submits an add-member request for `u`'s email against W
- THEN the system MUST respond with HTTP 409
- AND no additional `WorkspaceMember` row MUST be created for `u` in W

### Requirement: Notification on add

The system MUST notify the added user through both an email and an in-app notification whenever a `WorkspaceMember` is created via the add-member flow (existing or new user).

#### Scenario: Existing user notified

- GIVEN an existing user is successfully added to workspace W
- THEN an email MUST be sent to that user via the invite-email sender, without a temporary password
- AND a `Notification` row MUST be created for that user referencing the add-to-workspace event (`taskId`/`boardId` MAY be null)

#### Scenario: New user notified with credentials

- GIVEN a brand-new user account is created and added to workspace W
- THEN an email MUST be sent to that user containing the temporary password
- AND a `Notification` row MUST be created for that user referencing the add-to-workspace event

#### Scenario: Email failure does not block membership

- GIVEN an add-member request that succeeds in creating the `WorkspaceMember` row
- WHEN the email send fails (e.g. SMTP error)
- THEN the add-member request MUST still return success
- AND the failure MUST be logged, not surfaced as a request error

### Requirement: Admin-only authorization

The system MUST allow only users with the ADMIN role in the target workspace to add members. Non-admins MUST be rejected.

#### Scenario: Non-admin attempts to add a member

- GIVEN a user with role MEMBER or VIEWER in workspace W
- WHEN that user submits an add-member request against W
- THEN the system MUST respond with HTTP 403
- AND no `WorkspaceMember` row MUST be created

### Requirement: Role selection on add

The system MUST accept a role of MEMBER, VIEWER, or ADMIN for the added member, defaulting to MEMBER when none is provided.

#### Scenario: Explicit role assigned

- GIVEN an ADMIN adding a new member and specifying role `VIEWER`
- WHEN the request succeeds
- THEN the created `WorkspaceMember` MUST have role `VIEWER`

#### Scenario: Role omitted defaults to MEMBER

- GIVEN an ADMIN adding a new member without specifying a role
- WHEN the request succeeds
- THEN the created `WorkspaceMember` MUST have role `MEMBER`

### Requirement: Direct-add UI, no invite language

Frontend entry points for adding a workspace member MUST present the action as an immediate add ("Agregar miembro"), not as generating or sending an invitation link.

#### Scenario: BoardHeader add-member action

- GIVEN an ADMIN opens the add-member control from `BoardHeader`
- WHEN they view the available action
- THEN the UI MUST label it "Agregar miembro" (or equivalent direct-add copy)
- AND the UI MUST NOT reference generating an invitation link or an "invitation sent" pending state

#### Scenario: Members settings page add-member action

- GIVEN an ADMIN opens the add-member tab in `MembersSettingsPage` for a new-user email
- WHEN they view the available action
- THEN the UI MUST present direct-add semantics ("Agregar miembro") without a copyable invite-link panel

## REMOVED Requirements

### Requirement: Invite-accept confirmation step

(Reason: `POST /workspaces/accept/:token` never had a functional effect for its only reachable case — new users were already members before visiting the link; for existing users it previously only flipped `acceptedAt` on a pending invite, a state this change eliminates entirely. No accept step remains anywhere in the add-member flow.)
(Migration: None — direct-add requirements above fully replace this behavior. Any pending `WorkspaceInvite` rows are dropped as part of the accompanying destructive migration, confirmed separately at proposal/apply gates.)

#### Scenario: Accept endpoint is gone

- GIVEN the member-direct-add change is deployed
- WHEN a client calls `POST /workspaces/accept/:token`
- THEN the system MUST NOT expose that route (404 or equivalent, not a functional accept)

#### Scenario: No accept UI reachable

- GIVEN the member-direct-add change is deployed
- WHEN a user navigates the frontend
- THEN no `/workspaces/accept/:token` route, accept page, or "copy invite link" UI MUST be reachable
