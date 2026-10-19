# ADR-0017: Role list per account, one active role, server-derived scope, and "Mod Pelajar" as a session mode

- **Status:** Proposed
- **Date:** 2026-10-16
- **Related:** TRACKER D30, D31(a,b,c), D32(b); `docs/requirements/v2-portals.md` §4, US-04, US-05, US-07, US-08; `docs/architecture/v2-data-migration.md` §4.0 X6, §4.1; `docs/architecture/v2-frontend.md` §4
- **Supersedes in part:** ADR-0008 guard step 3 (role check on a single `role`), M01 `UserMe.role` single value, `Role` type with `jpn_officer`. ADR-0007 (state) stays; the session store gains fields. Requirements US-07 "Pratonton sebagai Pelajar" (preview of a chosen real student) is superseded by D31(c) Mod Pelajar; see Consequences.

## Amendment 2026-10-16
Aligned with the contract package (V2-T06 to T08): item 2 (parent and sponsor may combine with teacher or school_admin; student and admin stay single), item 5 (`capabilities` is `CapabilityKey[]`), item 7 (Mod Pelajar for admin and school_admin, D33b). Also recorded: a role carries a fixed scope level (student, parent, sponsor: self; teacher, school_admin: school; ppd_officer: district or state; admin: national), and logout is idempotent (204 without a session).

## Context
- .cloud has one `users.role` string and no scope column; `pegawai_ppd` scope is derived from the officer's school (`PpdJpnController::scope()`); D31(a) keeps that model. D31(b) allows dual roles with one active role and an explicit switcher; migrated accounts become one-item lists. D31(c): an admin may use the student portal as themselves, through a visible transition, with data marked as test data.
- The prototype `Role` has 8 codes including `jpn_officer`, which has no .cloud source. The guard compares one role to a route's `roles` list.
- Scope must be enforced by the server (US-05); the client only displays and uses it for UX.

## Decision
1. **Role codes (English, API and storage):** `student`, `teacher`, `parent`, `sponsor`, `school_admin`, `ppd_officer`, `admin`. `jpn_officer` is removed; `unmapped` is gone. Mapping from .cloud (`pelajar`, `guru`, `ibu_bapa`, `penaja`, `admin_sekolah`, `pegawai_ppd`, `admin`) is one to one. Display labels stay BM ("Pegawai PPD", "Admin Sekolah", "Admin Pusat").
2. **Role list:** an account has `roles: RoleGrant[]`, each grant = `{ role, scope }`. Allowed combinations (amended 2026-10-16 to match the code): any two of `teacher`, `school_admin`, `ppd_officer`; `parent` and `sponsor` may combine with `teacher` or `school_admin`; `student` and `admin` are always single-role.
3. **One active role per session.** Permissions are those of the active role only, never a union. Portal is a pure function of the active role (`student|teacher|parent|sponsor` -> Pembelajaran; `admin|school_admin|ppd_officer` -> Pentadbiran).
4. **Scope is server-derived and stored on the grant:** `Scope = { level: 'national'|'state'|'district'|'school'|'class'|'self', stateCode?, districtCode?, schoolId?, label }`. For `ppd_officer` the server derives it from the officer's school (as .cloud does) and returns it; the migration script stores the result. The client never computes or sends a scope; there is no `scope` query parameter anywhere. `level: 'state'` exists in the type so a later JPN-style grant needs no contract break, but v2.0 produces only `district` for `ppd_officer` (open question).
5. **Capabilities are returned by the server:** `capabilities: CapabilityKey[]` for the active role (amended 2026-10-16), keys of the form `admin.<group>.<item>.read|write` produced by `capabilitiesFor(role, scope)` from the access matrix (`.write` only for modes F and S; item ids such as `PM-04` stay the matrix identifiers). The menu, Ctrl+K and route guard read capabilities; the access matrix itself is data in the shared contract package (ADR-0018) and is the source for both the mock and the NestJS authorisation layer.
6. **Role switch:** `POST /api/session/role { role }` validates the role is in the account's list, regenerates the session id, writes an audit entry, and returns the new `Session`. Blocked while a mode is active.
7. **Mod Pelajar is a session mode, not impersonation.** `POST /api/session/mode { mode: 'mod_pelajar' }` is allowed only for `admin` and `school_admin` (amended 2026-10-16, D33b). The session then has `active = { role: 'student', scope: self, via: 'mod_pelajar' }` and `mode = { kind: 'mod_pelajar', returnRole: 'admin' | 'school_admin', since, isTest: true }`. The user is the admin account itself (own student-side data, never a real student's). Entry shows a transition screen; the Pembelajaran layout shows a persistent, non-dismissible banner with "Keluar Mod Pelajar" (`DELETE /api/session/mode`). Every row written while the mode is on is stamped `is_test = true` by the owner repository/service; analytics, rankings, leaderboards and wallet totals exclude test rows by default.
8. **Guard model** (client, UX only; the API repeats every check): session -> portal match -> auth -> role/capability (`meta.menuId` or `meta.capability`) -> mode rules (admin-portal routes unavailable in Mod Pelajar) -> `onForbidden` outcome (`landing`, `403`, `404`).

## Alternatives considered
- **Union of permissions across roles:** simpler UI, but a Guru + Admin Sekolah user would see school data while acting as teacher (violates AC-08.4) and widens the blast radius of a mistake.
- **Separate login per role:** avoids the switcher, but forces re-login and two accounts per person, which D31(b) rejects.
- **Impersonating a real student (the .cloud `ImpersonateController` model, and the earlier Pratonton):** rejected by D31(c) as the user wants admin-as-self; it also exposes real student data.
- **Two roles `ppd_officer` and `jpn_officer`:** matches the prototype but not .cloud nor the migrated data; D31(a) chooses the .cloud model.
- **Scope in JWT claims only:** cannot change without re-issue; the session is server-side so a permission change applies on the next request (NFR Availability).

## Consequences
- M01/M02 mock contracts change (V2-T09, V2-T24): role list, nullable email, username login, `isActive` + `isSuspended`, scope table. Tests and seeds that use `jpn_officer` change; E2E helper `act-as.ts` gains a role-switch variant.
- The earlier requirement US-07 (open a real student's view in a new tab, read-only) is not built; its function is covered by Mod Pelajar. If the user wants real-student preview as well, it is a later, separate, audited feature that fits the `mode` field (`kind` is an open union).
- The test-data stamp touches every owner repository that a student can write to (practice, wallet, notes, notifications); V2-T19 implements it once in the repository layer (ADR-0014) and adds exclusion rules to the aggregate queries.
- Dual-role and Mod Pelajar are testable: unit tests for `decideAccess`, E2E for switch, enter/exit mode and a forbidden direct URL in each state.
- Audit log entries are required for role switch, mode enter/exit and writes made under an active role (the audit store is a new Sistem store, V2-T27).
