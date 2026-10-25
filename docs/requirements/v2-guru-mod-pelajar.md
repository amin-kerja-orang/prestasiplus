# v2 Guru Mod Pelajar (`guru-mod-pelajar`)

Status: G1 draft, waiting for the user's answers to the open questions in section 8.
Track: Full (new capability for a new role, touches session, guard and a shared screen).
Related: `docs/requirements/v2-portals.md` (US-07, US-08, AC-15.1), TRACKER D31(c), D32(b), D33(b), D43, D48, D53(c), D54, `docs/adr/0017-role-list-active-role-scope.md`, `docs/qa/uat-2026-10-24-triage.md` (T2).

Labels: **[AS-BUILT]** = observed in this repo today. **[PROPOSED]** = new wording or behaviour proposed here. Nothing is claimed about the live sites.

## 1. Summary and goal

### Problem
- On "Soalan by Chapter" (`/practice/chapter`, shared Murid + Guru screen) the button "Latih Tubi Rawak" links to `/practice`. `/practice` is a Murid-only item (matrix row 16 "Latih Tubi"), not in the Guru prototype scope. The route guard (prototype scope, D43) therefore redirects a guru silently to `/guru`. The guru clicks and sees nothing happen. [AS-BUILT: `ChapterIndexPage.vue` `to="/practice"`; `guards.ts` scope step; `prototype-scope.ts` `TEACHER_ITEMS` has no `/practice` rule]
- More generally a guru has no way to see or try the student portal.

### User decision (2026-10-24, UAT triage T2, TRACKER D54)
User reaction: "bukan ada mod pelajar untuk admin/guru?" and chose **"Beri guru Mod Pelajar"**. Today Mod Pelajar exists only for Admin Pusat.

### Goal
A guru can enter Mod Pelajar from the Portal Pembelajaran, use the student portal in an explicit, visible, reversible mode, and return to the guru portal without logging in again. The "Latih Tubi Rawak" button then leads somewhere meaningful for a guru.

### Admin Mod Pelajar as built, versus what was written

| Aspect | US-07 "Pratonton sebagai Pelajar" (v2-portals, as written) | Admin Mod Pelajar as built [AS-BUILT] |
|---|---|---|
| Name | Pratonton sebagai Pelajar / "Keluar Pratonton" | "Masuk Mod Pelajar" / "Keluar Mod Pelajar" (D31c, D33c) |
| Entry | PS-01 row action + Ctrl+K | Account menu item "Masuk Mod Pelajar" in `PentadbiranLayout.vue` only; no Ctrl+K command, no PS-01 row action, no confirm dialog |
| Tab | New browser tab, admin tab unchanged | Same tab: the student session replaces the admin session in `pp.auth`; the admin session is parked in `session.mode.parent` |
| Which student | Any chosen real student | The fixed demo test student: id 2, "Pelajar Demo" (`mod-pelajar.ts`); call goes to `POST /api/admin/users/2/impersonate` |
| Read-only | Read-only by default (AC-07.5) | Not enforced. The student session is a normal session, so writes happen on the shared Pelajar Demo account. No `is_test` stamping exists in the mock |
| Banner | "Pratonton sebagai Pelajar — anda melihat sebagai {nama murid}" | "Mod Pelajar: anda melihat portal pelajar sebagai {nama}" + "Keluar Mod Pelajar"; fixed bar, 40 px, non-dismissible, `role="status"` (`ModPelajarBanner.vue`) |
| Exit lands | Close tab / return to admin portal | Restores the parked admin session, goes to `/admin/command-center`; if the parked session expired, session cleared and `/login` |
| Who | Admin; Admin Sekolah own school; PPD no | `session.role === 'admin'` only; any other role throws |
| Nesting | Not allowed | Refused (`enterModPelajar` returns false when a mode is on) |
| Audit | Start/stop audit log (AC-07.7) | No audit write in the mock handler |
| Survives reload | n/a | Yes (state is in `pp.auth`) |

Related doc conflicts, not resolved here: D33(b) and ADR-0017 say Admin Pusat + Admin Sekolah; `v2-frontend.md` OQ-1 and the build say Admin Pusat only; ADR-0017 says US-07 is superseded by D31(c) Mod Pelajar; D31(c) says "act as themselves" while the build views as the test student; D53(c) says impersonation is dropped in favour of `POST /api/session/mode` (the mock still uses the impersonate endpoint, realignment is V2-T31).

## 2. Users / personas

| Persona | Need |
|---|---|
| Guru (role `teacher`, Portal Pembelajaran, e.g. Guru Demo, SMK DEMO) | See and try what a murid sees (practice, chapters, dashboard) without a second login, then come back to teaching screens |
| Admin Pusat | Unchanged. Existing Mod Pelajar must keep working |
| Murid (the test student) | Must not be disturbed or have real data polluted |
| QA / demo presenter | Can show the student view from the guru account |

## 3. User stories

Priority in brackets (MoSCoW).

- **US-01 [Must] Enter Mod Pelajar from the guru shell.** As a guru, I want a clear "Masuk Mod Pelajar" action in my account menu, so that I can open the student portal myself.
- **US-02 [Must] "Latih Tubi Rawak" works for a guru.** As a guru on Soalan by Chapter, I want the "Latih Tubi Rawak" button to do something understandable, so that I am not silently sent back to my dashboard.
- **US-03 [Must] Clear, persistent mode indicator.** As a guru in Mod Pelajar, I want to be told at all times that I am viewing as a student, so that I never mistake it for my teacher view.
- **US-04 [Must] Exit and return.** As a guru, I want "Keluar Mod Pelajar" to return me to the guru portal with my session intact, so that I do not log in again.
- **US-05 [Must] Safe data handling.** As a product owner, I want anything a guru does in Mod Pelajar kept apart from real students' data, so that class reports, rankings and wallets stay correct.
- **US-06 [Must] Guard rules while in the mode.** As a product owner, I want the mode to behave like a student session (no guru data, no nesting, no role switching), so that portals stay separate (AC-15.1).
- **US-07 [Should] Audit trail.** As an admin, I want every enter/exit by a guru recorded, so that use is traceable.

## 4. Acceptance criteria

Defaults assumed below follow section 6 (PROPOSED). Where an answer to section 8 changes a criterion, the criterion is marked "(Q#)".

### US-01 Enter from the guru shell
- AC-01.1 Given a signed-in guru on any Portal Pembelajaran page at desktop width, when the account menu (sidebar footer or navbar) is opened, then it contains the item "Masuk Mod Pelajar" with the same icon as the admin item (`i-ph-student`).
- AC-01.2 Given a guru at 375 px, when the "Lagi" sheet is opened, then the account block contains "Masuk Mod Pelajar" (touch target >= 44 px).
- AC-01.3 Given a guru, when Ctrl+K search is opened and "Mod Pelajar" is typed, then the command "Masuk Mod Pelajar" is offered under the "Akaun" group. (Ctrl+K is not present for the admin item today; adding it satisfies v2-portals AC-10.4 "appears only for roles allowed".)
- AC-01.4 Given a murid, Admin Sekolah, Ibu Bapa or any non-guru role in the Pembelajaran shell, then "Masuk Mod Pelajar" is not shown anywhere. (Admin Pusat keeps its existing entry in Portal Pentadbiran.) (Q5)
- AC-01.5 Given a guru activates "Masuk Mod Pelajar", when the switch succeeds, then the guru is on the student home `/dashboard` in the same tab, the student sidebar/bottom nav is shown, and the banner (US-03) is visible. No confirm dialog is shown for the menu action (same as admin).
- AC-01.6 Given the switch is refused or fails, then the guru stays on the current page, remains a guru, and sees the message "Mod Pelajar tidak dapat dibuka. Sila cuba lagi." [AS-BUILT copy, reused]
- AC-01.7 Given the action is activated twice quickly, then only one switch happens (the control is disabled while switching) [AS-BUILT: `switching` flag].
- AC-01.8 Given a guru account that is also marked as test or inactive, or has no school, then the action still works or fails with AC-01.6; it never leaves the guru in a half-switched state.

### US-02 "Latih Tubi Rawak" for a guru (default: option A, Q3)
- AC-02.1 Given a guru on `/practice/chapter` (not in Mod Pelajar), then the button "Latih Tubi Rawak" is still shown and is no longer a plain link to `/practice`.
- AC-02.2 Given a guru clicks it, then a themed dialog (not a native confirm, D33a) appears. PROPOSED copy: title "Masuk Mod Pelajar?"; body "Latih Tubi Rawak ialah skrin pelajar. Anda akan melihat portal sebagai Pelajar Demo dan boleh keluar bila-bila masa."; buttons "Masuk Mod Pelajar" and "Batal".
- AC-02.3 Given the guru confirms, when the switch succeeds, then the guru lands on `/practice` in Mod Pelajar with the banner visible, and the page renders (no redirect to `/guru`).
- AC-02.4 Given the guru presses "Batal" or Esc, then the dialog closes, the guru stays a guru on `/practice/chapter`, nothing is written.
- AC-02.5 Given a murid, or a guru already in Mod Pelajar (role is then student), when "Latih Tubi Rawak" is clicked, then it navigates straight to `/practice` as today with no dialog.
- AC-02.6 Given the switch fails, then AC-01.6 applies and the guru stays on `/practice/chapter`.
- AC-02.7 Regression: no guru click on any button of `/practice/chapter` ends in a silent redirect to `/guru`. QA clicks every button and chapter card on the screen as a guru, outside and inside the mode.

### US-03 Banner
- AC-03.1 Given a guru in Mod Pelajar, then on every page of the mode a fixed bar is shown with the text "Mod Pelajar: anda melihat portal pelajar sebagai {nama murid}" and the button "Keluar Mod Pelajar" (same component and copy as admin, [AS-BUILT]).
- AC-03.2 The bar cannot be dismissed and is exposed as `role="status"`.
- AC-03.3 The bar never covers the top-most page content at 375 / 768 / 1280 px (content is offset, v2-portals AC-16.5), and "Keluar Mod Pelajar" is reachable by keyboard and touch (>= 44 px target at 375 px; the built button is 32 px high, so the architect must confirm or fix against this AC).
- AC-03.4 Given the page is reloaded or reopened in the same browser while the mode is on, then the mode and the banner are still on (state kept in `pp.auth`).

### US-04 Exit
- AC-04.1 Given a guru in Mod Pelajar, when "Keluar Mod Pelajar" is pressed, then the guru's own session is restored (same user, no password prompt) and the banner disappears.
- AC-04.2 Exit lands on the page where Mod Pelajar was started when that page is allowed for a guru; otherwise on `/guru` (Dashboard Guru). (Q4; default A)
- AC-04.3 Given the parked guru session has expired while in the mode, when exit is pressed, then the session is cleared and the user is sent to `/login`, with no stale guru data shown. [AS-BUILT behaviour for admin]
- AC-04.4 Given the guru logs out (Log Keluar) while in the mode, then the whole session ends, including the parked one; Back does not show protected data (v2-portals AC-01.9).
- AC-04.5 Given the mode was started via "Latih Tubi Rawak", then exit returns to `/practice/chapter`.
- AC-04.6 After exit the guru menu, chip and landing are those of the guru; no student menu item remains visible.

### US-05 Data handling (default: option A in Q1 and Q2)
- AC-05.1 Given the mode, then the guru views as exactly one student: the demo test student "Pelajar Demo" (id 2, SMK DEMO). There is no student picker. (Q1)
- AC-05.2 Given the guru answers questions, earns coins or writes notes in the mode, then the write is allowed and stamped as test data (D31c, D32b). (Q2)
- AC-05.3 Given test data exists, then it is excluded from other users' aggregates: class and school reports, rankings, leaderboards, Command Center and analytics shown to gurus, admins and murid. PROPOSED; in the current mock no `is_test` stamping exists, so the architect must state how the mock avoids polluting shared figures.
- AC-05.4 Given the guru leaves the mode, then data created in it stays marked as test data and is not shown as the guru's own teaching data.
- AC-05.5 The guru's own data (class lists, question contributions, reports) is not readable from inside the mode: it is not reachable through any student screen.

### US-06 Guard rules
- AC-06.1 Given a guru in the mode (active role student), when a guru-only URL is typed (for example `/guru`, `/guru/kelas`, `/guru/command-center`), then no guru data is shown and the user lands on the student home `/dashboard`. [AS-BUILT behaviour for admin URLs; here the role guard `landing` outcome applies]
- AC-06.2 Given a guru in the mode, then the sidebar, bottom nav, "Lagi" sheet and Ctrl+K show the student menu only, with the 37 Murid items of the matrix; no guru item is listed.
- AC-06.3 Given the mode is on, when "Masuk Mod Pelajar" is looked for, then it is not offered (no nesting, v2-portals AC-07.6).
- AC-06.4 Given a user with two roles and a role switcher, when the mode is on, then switching role is blocked (v2-portals AC-08.6). (The switcher itself is not built for the Guru prototype; this AC is a guard for when it is.)
- AC-06.5 Given the mode is on, when the browser Back button is used to reach a guru page that was open before, then AC-06.1 applies (no cached guru data shown).
- AC-06.6 Given a guru outside the mode, then every route outside the Guru matrix still redirects to `/guru` as before; this feature does not add any student route to the Guru scope (`TEACHER_ITEMS` stays at 15 items).
- AC-06.7 Given Admin Pusat, then the existing "Masuk Mod Pelajar", banner, exit to `/admin/command-center` and tests behave exactly as before.

### US-07 Audit (Should)
- AC-07.1 Given a guru enters or exits the mode, then one audit entry per transition is written with actor (guru id), role, action (enter / exit), target (test student id), time and the entry point (menu, Ctrl+K, Latih Tubi Rawak). PROPOSED; the admin flow writes no audit entry today.
- AC-07.2 Audit entries for guru transitions are visible to Admin Pusat where an audit screen exists; they are never shown to murid or other gurus.
- AC-07.3 Given the guru's session expires while in the mode, then a system exit entry is written (or the architect documents why not).

## 5. Non-functional requirements

| Area | Requirement |
|---|---|
| Security | The enter action must be authorised on the server for the guru role only and may only target the test student. Today the mock endpoint `POST /api/admin/users/:id/impersonate` is admin-only and takes any user id; a guru must not gain a general impersonation endpoint. A guru must not be able to choose another target by editing the request. The parked guru token is held client-side in `pp.auth`; the architect must confirm this is acceptable for the mock and what replaces it on the real backend (contract `POST/DELETE /api/session/mode`, D53c). |
| Privacy | The mode shows a fictitious test student only. No real student's data is exposed to a guru by this feature (PDPA). No real person's name appears in docs or seeds (CLAUDE.md section 6). |
| Responsive | Entry action, dialog, banner and exit work at 375 / 768 / 1280 px with no horizontal page scroll (v2-portals AC-16.1, AC-16.3, AC-16.5). |
| Accessibility | Replicates existing admin Mod Pelajar behaviour (D10): `role="status"` banner, keyboard-reachable buttons, focus management of the dialog per the design system. No enhancements beyond that. |
| Localisation | All UI copy in Bahasa Melayu. Reused strings: "Masuk Mod Pelajar", "Keluar Mod Pelajar", "Mod Pelajar: anda melihat portal pelajar sebagai {nama}", "Mod Pelajar tidak dapat dibuka. Sila cuba lagi." New strings (dialog) are marked PROPOSED in AC-02.2. |
| Theme | Light and dark both supported; banner and dialog use theme tokens (D29e). |
| Performance | Enter and exit complete without a full page reload; the student home is shown within the normal navigation time. |
| Reliability | The state is never half-switched: after any failure the guru is still a guru (AC-01.6, AC-01.8). |
| Testability | Unit tests for the session mode with role `teacher` as `returnRole`; guard tests for guru URLs in the mode; E2E at the three widths (enter, banner, `/practice` renders, exit, Back button). Existing admin tests must keep passing. |

## 6. Proposed defaults (for the lead to confirm quickly with the user)

| # | Topic | Recommendation | Why |
|---|---|---|---|
| D1 | Which student | The demo test student "Pelajar Demo" only, exactly as admin | Matches D31(c)/ADR-0017 (preview of a real student was dropped), avoids exposing real student data, smallest change; the guru already has "Pelajar Saya" and Prestasi for real students |
| D2 | Writes | Allowed, stamped as test data and excluded from aggregates (D31c, D32b); not read-only | The feature exists so a guru can actually try practice ("Latih Tubi Rawak"); read-only would make the button pointless |
| D3 | "Latih Tubi Rawak" for a guru | Keep the button; show a themed confirm dialog, then enter Mod Pelajar and open `/practice` | Satisfies the user's decision, no silent failure, no new route added to Guru scope |
| D4 | Entry points | Account menu (desktop and "Lagi") + Ctrl+K + the contextual button above | One consistent explicit transition (D31c) |
| D5 | Exit destination | The page where the mode was started when allowed for a guru, else `/guru` | Predictable; admin keeps its fixed `/admin/command-center` |
| D6 | Banner | Reuse the existing admin banner component and copy unchanged | D33(c) already accepted this copy |
| D7 | Role switcher | Blocked while in the mode | v2-portals AC-08.6 |
| D8 | Audit | Enter/exit logged (Should) | v2-portals AC-07.7 intent, D31c "explicit and visible" |
| D9 | Other roles | Guru only now; Admin Sekolah not changed in this feature | Not requested; docs conflict on Admin Sekolah (D33b vs OQ-1) is handled separately |
| D10 | Prototype scope / matrix | No new route in `TEACHER_ITEMS`; Mod Pelajar is an account action, not a menu row; note it under Guru in `role-access-matrix.md` | Keeps D43 scope exact |

## 7. Scope

### In scope
- "Masuk Mod Pelajar" for the `teacher` role in the Portal Pembelajaran (account menu, "Lagi" sheet, Ctrl+K).
- Contextual behaviour of "Latih Tubi Rawak" on `/practice/chapter` for a guru.
- Mode banner and exit for a guru (reuse), return destination, guard behaviour in the mode.
- Test-data handling and audit of guru transitions.
- Doc updates listed in the impact list.

### Out of scope
- Viewing as a real student of the guru's classes (not in D1).
- "Pratonton sebagai Pelajar" per US-07 as written (new tab, chosen student, PS-01 row action).
- Mod Pelajar for Admin Sekolah, PPD/JPN, Ibu Bapa, Penaja (unchanged).
- Adding any student route to the Guru prototype scope or menu.
- Changing what Admin Pusat Mod Pelajar does, except shared-code refactors that keep its behaviour.
- Role switcher (US-08) build; only the "blocked in mode" rule is stated.
- The wider Darjah/primary removal (D54) and the other UAT triage tasks.
- Any audit screen build.

### Assumptions
- A1 The demo teacher (Guru Demo, SMK DEMO) and the test student (Pelajar Demo, SMK DEMO) exist in the seeds [AS-BUILT: `accounts.ts` ids 5 and 2]. Whether Pelajar Demo is a member of a Guru Demo class is not checked here; it does not matter for D1.
- A2 The mode keeps the same-tab, session-replacement design of the admin build.
- A3 `/practice` and `/dashboard` are allowed for role `student` in the prototype scope (matrix rows 2 and 16).
- A4 The architect decides whether the mock reuses the impersonate endpoint with a new guard or moves to the contract `POST /api/session/mode` now (D53c).

### Risks
- R1 Without `is_test` stamping in the mock, a guru's practice answers and coins land on the shared Pelajar Demo account, which other demos and UAT use. Mitigation: stamping or a resettable test student; the architect must decide before build.
- R2 Admin-only guard on the impersonate endpoint: widening it naively lets a guru impersonate any user (privilege escalation). Needs a target restriction and a security review (G4 `security-engineer`, because it touches auth/session).
- R3 Other shared Murid + Guru screens may contain further links to student-only routes (same silent-redirect defect). An inventory is needed; fixing them is out of this story set unless the user decides otherwise.
- R4 Banner button is 32 px high, below the 44 px touch target in AC-16.3/AC-03.3.

## 8. Open questions (blocking G1)

1. **Which student does the guru view as?**
   Options: (A) the demo test student only, as admin; (B) any student of the guru's own classes (needs read-only, audit, PDPA review; conflicts with D31c and ADR-0017); (C) the guru's own account shown in a student layout.
   Recommended: **A**.
2. **Can the guru write while in the mode (answer questions, earn coins), or is it read-only?**
   Options: (A) writes allowed, stamped as test data and excluded from real aggregates (D31c, D32b); (B) read-only, writes blocked with a message (US-07 AC-07.5).
   Recommended: **A** (B makes "Latih Tubi Rawak" unusable).
3. **What should "Latih Tubi Rawak" do for a guru on Soalan by Chapter?**
   Options: (A) keep it, ask "Masuk Mod Pelajar?" in a dialog, then enter the mode and open `/practice`; (B) hide it for gurus; (C) leave as is (silent redirect, defect).
   Recommended: **A**.
4. **Where does "Keluar Mod Pelajar" return the guru?**
   Options: (A) the page where the mode was started (fallback `/guru`); (B) always `/guru`.
   Recommended: **A**.
5. **Should Admin Sekolah get Mod Pelajar in this same change?** (Docs disagree: D33b/ADR-0017 yes, `v2-frontend.md` OQ-1 and the build no.)
   Options: (A) Guru only now, settle Admin Sekolah separately; (B) add Admin Sekolah now.
   Recommended: **A**.

## 9. Impact list (for the architect)

Likely code touched (no code is written in this phase):

| Area | Files |
|---|---|
| Mode logic | `src/shells/shared/mod-pelajar.ts` (role check is `admin` only; return path fixed to `/admin/command-center`; make return path and allowed roles parametric) |
| Session | `src/stores/session.ts` (`enterModPelajar`/`leaveModPelajar`, `returnTo`), `src/stores/session-types.ts` (`ModPelajarMode.returnRole` already a `Role`), `src/mock/core-data/client-session.ts` (parser for `mode`) |
| Entry UI | `src/shells/pembelajaran/PembelajaranLayout.vue` (account menu, "Lagi" sheet, Ctrl+K groups; banner is already mounted), `src/shells/pembelajaran/pembelajaran-nav.ts` / `src/shells/nav/user-nav.ts` (account links, if the item is modelled there) |
| Banner | `src/shells/shared/ModPelajarBanner.vue` (reuse; touch-target check) |
| Contextual button | `src/modules/m05-practice/pages/ChapterIndexPage.vue` (button target and dialog; owner module M05) |
| Guard / scope | `src/app/router/guards.ts`, `src/app/prototype-scope.ts` (no new Guru item; verify student-role rules apply in the mode), `src/app/router/layouts.ts` |
| Mock server | `src/modules/m02-users-schools/mock/handlers/users-admin.ts` (impersonate route is `adminOnly`), M01 session handlers; any shared mock data change follows the isolated-worktree rule |
| Test data | M05 sessions/answers, M14 wallet, notes, aggregates (rankings, leaderboards, Command Center): `is_test` stamping and exclusion (V2-T19), per the single-owner rule in CLAUDE.md section 6 |
| Audit | Audit store/handler of the mock (none for Mod Pelajar today); backend card BE-03/BE-21 mention |
| Tests | `src/shells/__tests__/mod-pelajar.test.ts` (extend for `teacher`), guard tests, M05 chapter page test, E2E at 375/768/1280 |

Docs to update when built: `docs/requirements/role-access-matrix.md` (Guru note), `docs/requirements/v2-portals.md` (US-07 pointer to this doc), `docs/adr/0017-role-list-active-role-scope.md` and `docs/architecture/v2-frontend.md` (OQ-1, who may enter), `docs/AKAUN-DEMO.md` (Guru account), `docs/TRACKER.md` (D54 follow-up, status), backend plan cards BE-03/BE-21 (guru allowed on `POST /session/mode`).
