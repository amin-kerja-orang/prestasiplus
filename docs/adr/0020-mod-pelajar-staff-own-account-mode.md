# ADR-0020: Mod Pelajar for staff accounts is an own-account session mode with an effective role and an actor-derived test stamp

- **Status:** Proposed (user approval at G2 of `guru-mod-pelajar`)
- **Date:** 2026-10-25
- **Related:** TRACKER D31(c), D33(b), D45, D53(c), D54, D55; `docs/requirements/v2-guru-mod-pelajar.md`; `docs/architecture/v2-guru-mod-pelajar.md`; ADR-0013 (virtual datasets), ADR-0014 (store ownership), ADR-0017 (roles, scope, Mod Pelajar), ADR-0018 (contract-first)
- **Amends:** ADR-0017 item 7 (who may enter Mod Pelajar; own-account detail; stamp basis). ADR-0017 items 1-6 and 8 stay.

## Context
- ADR-0017 item 7 made Mod Pelajar a session mode for `admin` and `school_admin` (D33b): the user stays the account itself, the active role becomes `student` with self scope, rows written are test data. It was never built that way: the prototype's Admin Pusat flow impersonates a shared test student and parks the admin session.
- 2026-10-25 (D55) the user added `teacher` and chose "own account" for Guru and Admin Sekolah: the same user id and token, writes allowed but stamped as test data and excluded from every real aggregate, actions that reach other real users hidden.
- Code facts: about 30 client call sites read `session.role`; the mock resolves one role per request in `resolveCoreSession`; most learner endpoints are `requireAuth()` only; M05 facets (`inP`, `seg`) already exclude non-students; unfaceted global queries, M14 wallet/ledger/claims aggregates and M08 `leaderboardOf` do not.
- D45: the prototype is a fast proof of concept; the stamp (V2-T19) is not built.

## Decision
1. **Roles.** `MOD_PELAJAR_ROLES = ['admin', 'school_admin', 'teacher']` in the contract. Until Admin Pusat is realigned (Q-N1, V2-T31) the mock lets only `teacher` and `school_admin` through `POST /api/session/mode`; Admin Pusat keeps the legacy impersonation flow.
2. **The mode is server state on the session** (`POST/DELETE /api/session/mode`, D53c). The client `pp.auth.mode` is a presentation copy. The request carries no target user; `entry` (`menu`, `palette`, `latih_tubi_rawak`) is an optional audit hint.
3. **One effective role.** Client `session.role` and server `req.session.role` return `student` (scope self) while the mode is set; `accountRole` keeps the real role. Layouts, menus, guards, scope helpers and API role checks therefore need no per-site change; only account screens, entry visibility, return-path validation and audit read `accountRole`. `UserMe` is never projected (no default grade written to the staff record); the Tingkatan 4 default is a separate read-time value (`learnerGrade`, `effectiveGrade`).
4. **Stamp basis.** A learner write is test data iff the actor is in the mode or is not a `student` account. In the mock this is `isTestActor(userId)` (`role !== 'student'`), which is equivalent today and also covers a guru's practice on the shared chapter pages outside the mode. The stamp is set by the owner store, never from the request body.
5. **Two read channels.** Self reads (by user id) include the user's own test rows. Cross-user aggregate reads exclude stamped rows by default, implemented once in the owner store so consumers inherit it. In the prototype `isTest` is a declared facet on the four large datasets (M05 sessions/answers, M14 wallets/ledger) and an optional field on small tables; the minimum (D45) is 13 aggregates listed in the architecture doc, the rest of the stores are stamped when the backend is built, with a before/after invariance test as the safety net.
6. **Hidden cross-user screens** are derived from the matrix (`MOD_HIDDEN_ITEM_NOS`), enforced by the route guard (redirect `/dashboard`), the scope/menu helpers and `allows()`, keyed on the mode and independent of the prototype-scope switch.
7. **Audit.** One event per enter/exit (`mode.enter`, `mode.exit`, `mode.system_exit`) in a core table now, `audit_logs` (V2-T27) later.

## Alternatives considered
- **Impersonate a test student for staff too (the Admin Pusat build).** Rejected by the user (own account) and by D31(c); writes land on a shared account.
- **Parked-session swap for own account.** Needs a second token and a parked copy for no benefit; the session would not know it is the same person.
- **Client-only mode flag.** Cannot authorise or stamp; editing storage would escape the rules.
- **Project `grade: 10` into `UserMe`.** One-line default, but Profil Saya would save it onto the staff record.
- **Stamp strictly from the session mode only.** Leaves a guru's existing chapter-practice rows (outside the mode) in real aggregates.
- **Filter `isTest` in each consuming module.** Many sites, easy to miss; owner-level queries keep the single-owner rule (CLAUDE.md section 6).
- **Stamp every store in the prototype.** Roughly double the backend work with no visible demo gain (D45).

## Consequences
- The contract `Session` schema does not change; `MOD_PELAJAR_ROLES`, `EnterModeRequest.entry`, `MOD_PELAJAR_DEFAULT_GRADE` and an audit event type are added; `openapi.json` is regenerated.
- Mock: core `version` bump (one-time reset), `auth.sessions.mode`, two routes, `audit.events`, `isTestActor`; M05 and M14 plugin version bumps and a facet in four dataset specs (pinned totals must not move).
- Staff-only endpoints that were `requireAuth()`-only and return staff data get explicit `requireRole`; a route sweep test enforces AC-08.6.
- Admin Pusat keeps the legacy mode and the "test student" writes stay unstamped until Q-N1 moves it; the two mechanisms coexist behind `ModPelajarMode.account`.
- Deferred stamping: private per-user stores carry `is_test` only when the backend exists; the invariance test (GMP-T7) decides whether any of them must move into the prototype minimum.
- A new open item for the user (Kelas Saya join, Q1 of the architecture doc) extends the hidden list by one control if accepted.
