# v2 Guru and Admin Sekolah Mod Pelajar (`guru-mod-pelajar`)

Status: **G1 answered 2026-10-25** (user answers applied, see section 8). Q-N2 answered the same day (option C, hide). No blocking question remains; Q-N1 and Q-N3 keep their recommended defaults.
Track: Full (new capability for two roles, touches session, guard, learner screens and test-data handling).
Related: `docs/requirements/v2-portals.md` (US-07, US-08, AC-15.1), TRACKER D31(c), D32(b), D33(b), D43, D48, D53(c), D54, `docs/adr/0017-role-list-active-role-scope.md`, `docs/qa/uat-2026-10-24-triage.md` (T2).

Labels: **[AS-BUILT]** = observed in this repo today. **[PROPOSED]** = new wording or behaviour proposed here. Nothing is claimed about the live sites.

## 1. Summary and goal

### Problem
- On "Soalan by Chapter" (`/practice/chapter`, shared Murid + Guru screen) the button "Latih Tubi Rawak" links to `/practice`. `/practice` is a Murid-only item (matrix row 16 "Latih Tubi"), not in the Guru prototype scope. The route guard (prototype scope, D43) redirects a guru silently to `/guru`; the guru clicks and sees nothing happen. [AS-BUILT: `ChapterIndexPage.vue` `to="/practice"`; `guards.ts` scope step; `prototype-scope.ts` `TEACHER_ITEMS` has no `/practice` rule]
- More generally, staff (Guru, Admin Sekolah) have no way to see or try the student portal.

### User decisions
- 2026-10-24 (UAT triage T2, TRACKER D54): "Beri guru Mod Pelajar".
- **2026-10-25 (this G1 round):**
  1. Which student: **"Akaun guru sendiri"**. The staff member uses THEIR OWN account inside the student layout (Portal Pembelajaran). No impersonation, no test student.
  2. Writes: **"Boleh, ditanda data ujian"**. Practice answers, coins etc. are allowed, saved, stamped as test data and excluded from real aggregates.
  3. "Latih Tubi Rawak" for a guru: **"Tanya, kemudian masuk mod"**. A themed dialog "Masuk Mod Pelajar?", then the mode is entered and `/practice` opens.
  4. Admin Sekolah: **"Tambah Admin Sekolah"**. Admin Sekolah gets the same Mod Pelajar (own account, student layout) in this same change.

### Goal
A Guru or Admin Sekolah can enter Mod Pelajar from the Portal Pembelajaran with their own account, use the whole student portal in an explicit, visible, reversible mode, and return to where they started without logging in again. Everything they do as a learner is test data and never reaches real students' figures. The "Latih Tubi Rawak" button then leads somewhere meaningful for a guru.

### Model in one paragraph (own account)
The session keeps the **same user id and token**. A `mode` flag (`mod_pelajar`) switches the *active view* to the learner portal: layout, menu, landing, route guard and API authorisation behave as role `student` with self scope while the flag is on (this matches the contract `Session.active.via = 'mod_pelajar'` and ADR-0017 item 7 [AS-BUILT in contract/ADR; not in the mock]). Nothing is parked or swapped; "Keluar Mod Pelajar" clears the flag.

### Admin Pusat Mod Pelajar as built, versus staff Mod Pelajar (this feature)

| Aspect | Admin Pusat as built [AS-BUILT] | Guru / Admin Sekolah (this feature) [PROPOSED] |
|---|---|---|
| Entry | Account menu item "Masuk Mod Pelajar" in `PentadbiranLayout.vue`; no Ctrl+K, no confirm | Account menu (desktop and "Lagi" sheet) + Ctrl+K in `PembelajaranLayout.vue`; guru also via the "Latih Tubi Rawak" dialog |
| Who is viewed | Fixed demo test student id 2 "Pelajar Demo" via `POST /api/admin/users/2/impersonate`; session replaced, admin session parked in `session.mode.parent` | The signed-in user's own account; same id and token; no parked session, no impersonation call |
| Writes | Normal session, writes land on the shared Pelajar Demo account; no `is_test` stamp | Allowed; stamped test data; excluded from aggregates (US-07) |
| Banner | "Mod Pelajar: anda melihat portal pelajar sebagai {nama}" + "Keluar Mod Pelajar"; 40 px bar, button 32 px, `role="status"` | Same component, copy adapted to own-account viewing (US-04); exit button >= 44 px |
| Exit lands | Fixed `/admin/command-center`; `/login` if parked session expired | Page where the mode started, else role home (`/guru` or `/admin-sekolah`) |
| Nesting | Refused | Refused |
| Audit | None | enter/exit logged (Should) |
| Survives reload | Yes (`pp.auth`) | Yes (`pp.auth`) |

Doc conflicts and their resolution:
- **D33(b) / ADR-0017 item 7 versus `v2-frontend.md` OQ-1 and the build** (Admin Pusat + Admin Sekolah versus Admin Pusat only): **resolved 2026-10-25 by the user, Admin Sekolah is included.** The user also added Guru (D54). Roles allowed to enter Mod Pelajar become `admin`, `school_admin`, `teacher`; ADR-0017 item 7 and the contract constant `MOD_PELAJAR_ROLES` (`packages/contract/src/session/session.ts`) must be amended accordingly (see section 9).
- **D31(c) "act as themselves" / ADR-0017 "never a real student's data" versus the admin build (test student by impersonation):** the user's choice for Guru and Admin Sekolah follows D31(c) and ADR-0017. The admin build remains the odd one out; see Q-N1.
- D53(c) (impersonation dropped, `POST /api/session/mode` only) is consistent with the own-account model. The staff flow should use that contract shape, not the impersonate endpoint (architect decides how the mock does it, A4).
- US-07 "Pratonton sebagai Pelajar" in `v2-portals.md` (chosen real student, new tab, read-only) stays superseded.

## 2. Users / personas

| Persona | Need |
|---|---|
| Guru (role `teacher`, Portal Pembelajaran, e.g. Guru Demo, SMK DEMO) | See and try what a murid sees (practice, chapters, rewards, dashboard) with their own account, then return to teaching screens |
| Admin Sekolah (role `school_admin`, e.g. Pentadbir Sekolah Demo, SMK DEMO; currently rendered in the Pembelajaran layout, home `/admin-sekolah`) | Same, to understand what students in the school see |
| Admin Pusat | Unchanged in this feature (Q-N1) |
| Murid, other users | Must not see staff test activity anywhere (rankings, lobbies, reports) |
| QA / demo presenter | Can show the student view from a guru or school admin account |

## 3. User stories

Priority in brackets (MoSCoW).

- **US-01 [Must] Guru enters Mod Pelajar.** As a guru, I want a clear "Masuk Mod Pelajar" action in my account menu, so that I can use the student portal with my own account.
- **US-02 [Must] Admin Sekolah enters Mod Pelajar.** As an Admin Sekolah, I want the same action, so that I can see what students in my school see.
- **US-03 [Must] "Latih Tubi Rawak" works for a guru.** As a guru on Soalan by Chapter, I want the "Latih Tubi Rawak" button to ask me and then take me to the practice screen, so that I am not silently sent back to my dashboard.
- **US-04 [Must] Clear, persistent mode indicator.** As a staff member in Mod Pelajar, I want to be told at all times that I am in the student view, so that I never mistake it for my staff view.
- **US-05 [Must] Exit and return.** As a staff member, I want "Keluar Mod Pelajar" to return me to where I started, so that I continue my work without logging in again.
- **US-06 [Must] The learner portal works for a staff account.** As a staff member with no class or form, I want every student screen in the mode to open without errors and show a sensible default or empty state, so that the preview is usable.
- **US-07 [Must] Test data is kept apart.** As a product owner, I want everything a staff member writes in the mode stamped as test data and excluded from real aggregates, so that class and school reports, rankings, leaderboards and analytics stay correct.
- **US-08 [Must] Guard rules while in the mode.** As a product owner, I want the mode to behave like a student session (no staff data, no nesting, no role switching), so that portals stay separate (AC-15.1).
- **US-09 [Should] Audit trail.** As an admin, I want every enter/exit by staff recorded, so that use is traceable.
- **US-10 [Must] No side effects on other real users (Q-N2 resolved: hide).** As a product owner, I want the screens whose actions reach other real users hidden while a staff member is in the mode, so that students, parents and sponsors are not disturbed by test activity.

## 4. Acceptance criteria

Where the recommended default of an open question (section 8) shapes a criterion, it is marked "(Q-N#)".

### US-01 Guru enters Mod Pelajar
- AC-01.1 Given a signed-in guru on any Portal Pembelajaran page at desktop width, when the account menu (sidebar footer or navbar avatar) is opened, then it contains the item "Masuk Mod Pelajar" with icon `i-ph-student` (same as the admin item).
- AC-01.2 Given a guru at 375 px, when the "Lagi" sheet is opened, then the account block contains "Masuk Mod Pelajar" with a touch target >= 44 px.
- AC-01.3 Given a guru, when Ctrl+K search is opened and "Mod Pelajar" is typed, then the command "Masuk Mod Pelajar" is offered under the "Akaun" group.
- AC-01.4 Given a murid, Ibu Bapa, Penaja, Admin Pusat (in Portal Pentadbiran) or any other role, then "Masuk Mod Pelajar" is not added to the Pembelajaran account menu, "Lagi" sheet or Ctrl+K. (Admin Pusat keeps only its existing entry.)
- AC-01.5 Given a guru activates "Masuk Mod Pelajar", when it succeeds, then in the same tab the guru is on `/dashboard`, the student sidebar/bottom nav is shown, the banner (US-04) is visible, and the signed-in user is still the same guru account (same name, same school, no new login). No confirm dialog is shown for the menu action.
- AC-01.6 Given the switch is refused or fails, then the guru stays on the current page, remains in the staff view, and sees "Mod Pelajar tidak dapat dibuka. Sila cuba lagi." [AS-BUILT copy, reused]
- AC-01.7 Given the action is activated twice quickly, then only one switch happens (the control is disabled while switching). [AS-BUILT `switching` flag]
- AC-01.8 Given any failure during the switch, then the user is never half-switched: after the failure the staff view, menu and data are exactly those from before.

### US-02 Admin Sekolah enters Mod Pelajar
- AC-02.1 Given a signed-in Admin Sekolah on any Portal Pembelajaran page, then the account menu (desktop), the "Lagi" sheet (375 px, target >= 44 px) and Ctrl+K ("Akaun" group) offer "Masuk Mod Pelajar", with the same copy and icon as for the guru.
- AC-02.2 Given an Admin Sekolah activates it and it succeeds, then in the same tab the user is on `/dashboard` with the student menu and the banner, still signed in as the same Admin Sekolah account (same school).
- AC-02.3 AC-01.6, AC-01.7 and AC-01.8 apply unchanged.
- AC-02.4 Given an Admin Sekolah, then "Latih Tubi Rawak" is not reachable from the Admin Sekolah menu (`/practice/chapter` is not in the Admin Sekolah matrix, rows 1-7, 10, 11, 45-53), so US-03 does not apply to this role.
- AC-02.5 Given the Admin Sekolah view later moves into Portal Pentadbiran (D30), the entry must be offered in that portal's account menu too (see assumption A6); not testable in the current prototype.

### US-03 "Latih Tubi Rawak" for a guru (resolved Q3)
- AC-03.1 Given a guru on `/practice/chapter` outside the mode, then the button "Latih Tubi Rawak" is still shown and is no longer a plain link to `/practice`.
- AC-03.2 Given the guru clicks it, then a themed dialog (not a native confirm, D33a) appears. PROPOSED copy: title "Masuk Mod Pelajar?"; body "Latih Tubi Rawak ialah skrin pelajar. Anda akan masuk Mod Pelajar dengan akaun sendiri. Jawapan dan ganjaran direkod sebagai data ujian. Anda boleh keluar bila-bila masa."; buttons "Masuk Mod Pelajar" and "Batal".
- AC-03.3 Given the guru confirms and the switch succeeds, then the guru lands on `/practice` in the mode with the banner visible, and the page renders (no redirect to `/guru`).
- AC-03.4 Given the guru presses "Batal" or Esc, then the dialog closes, the guru stays in the staff view on `/practice/chapter`, and nothing is written.
- AC-03.5 Given a murid, or a guru already in the mode (effective view is student), when "Latih Tubi Rawak" is clicked, then it navigates straight to `/practice` with no dialog.
- AC-03.6 Given the switch fails, then AC-01.6 applies and the guru stays on `/practice/chapter`.
- AC-03.7 Regression: no guru click on any button or card of `/practice/chapter`, outside and inside the mode, ends in a silent redirect to `/guru`.

### US-04 Banner
- AC-04.1 Given a guru or Admin Sekolah in the mode, then on every page a fixed bar shows the PROPOSED copy "Mod Pelajar: anda melihat portal pelajar sebagai diri sendiri" and the button "Keluar Mod Pelajar". (Admin Pusat's banner copy "... sebagai {nama}" is unchanged.)
- AC-04.2 PROPOSED secondary line, shown from 640 px up and in the accessible text at all widths: "Aktiviti direkod sebagai data ujian." The primary text must stay fully readable at 375 px (wrapping allowed, no clipped words) and never be the only cue: the icon `i-ph-student` accompanies it.
- AC-04.3 The bar cannot be dismissed and is exposed as `role="status"`. [AS-BUILT behaviour, replicated]
- AC-04.4 The bar never covers the top of the page content at 375 / 768 / 1280 px (content is offset), and there is no horizontal page scroll.
- AC-04.5 "Keluar Mod Pelajar" is reachable by keyboard and has a hit area >= 44 x 44 px at 375 px and on touch (the built button is 32 px high; the shared component must be fixed; the same change may apply to the admin banner as a style-only change).
- AC-04.6 Given a reload or reopening of the app in the same browser while the mode is on, then the mode and the banner are still on. A second tab of the same browser shows the same mode on its next navigation. [AS-BUILT: state in `pp.auth`]

### US-05 Exit and return (resolved Q4)
- AC-05.1 Given a staff member in the mode, when "Keluar Mod Pelajar" is pressed, then the banner disappears, the staff menu, chip and landing return, and the user is still signed in as the same account without any password prompt.
- AC-05.2 Exit lands on the page where the mode was started when that page is allowed for the staff role in the staff view; otherwise on the role home: `/guru` (Guru) or `/admin-sekolah` (Admin Sekolah). The remembered page is an internal path only (never an external URL).
- AC-05.3 Given the mode was started from the "Latih Tubi Rawak" dialog, then exit returns to `/practice/chapter`.
- AC-05.4 Given the remembered start page no longer exists or is no longer permitted, then exit lands on the role home with no error page.
- AC-05.5 Given the session expires while in the mode, then the normal expiry rule applies (session cleared, `/login`), no staff or learner data stays visible, and the mode flag is gone at the next login. (There is no parked session in the own-account model, so the old "parked session expired" case does not exist for staff.)
- AC-05.6 Given the user logs out ("Log Keluar") while in the mode, then the whole session ends including the mode; Back does not show protected data (v2-portals AC-01.9). The next login starts in the normal staff view.
- AC-05.7 After exit, no student menu item or student route is available (AC-08.1 applies again with the staff role).

### US-06 The learner portal for a staff account
Scope of the mode: the **30 Murid items** of the role-access matrix (`STUDENT_ITEMS`, rows 2-9 and 12-40) that remain after the 7 cross-user items of US-10 are hidden (rows 15, 21, 22, 23, 32, 36, 40), plus section A account screens, exactly as a murid sees them. No screen is added. The staff account has `grade = null`, no class, no parents and no student record. [AS-BUILT: `accounts.ts` ids 5 and 8 have `grade: null`.]
- AC-06.1 Given a staff member in the mode, when each of the 30 visible Murid screens is opened (QA checklist, one row per matrix item), then the screen renders without an error page, a blank page or a console error, at 375 / 768 / 1280 px.
- AC-06.2 Given a screen needs a form/level and the account has none, then it uses **Tingkatan 4** (PROPOSED default, same as the demo student after D54; value 10 in the current grade scale [AS-BUILT: Pelajar Demo `grade: 10`]), and any existing form/level selector on that screen still works and keeps its choice for the rest of the mode. The default is applied in the learner view only; the staff account record is not changed (`grade` stays null). (Q-N3)
- AC-06.3 Given a screen depends on class, teacher or parent links (for example Kelas Saya, Set Soalan Guru, Remedial, Jemput Ibu Bapa, Prestasi, Headcount, Dashboard widgets), then it shows its existing empty state with the existing BM copy for a learner without a class. No new empty-state wording is introduced unless the screen has none, in which case the architect/designer proposes it and QA records it.
- AC-06.4 Given the dashboard and gamification screens (Syiling & Token, Cabaran Harian, Kedai Hadiah, Pencapaian, Kotak Misteri, Timeline), then they show the staff member's own test-data balances and history, starting from empty/zero for an account that never used the mode, and they persist between uses of the mode (not reset on exit or login).
- AC-06.5 Given the leaderboards and rankings (Kedudukan, Papan Pendahulu, Papan Bijak, Tournament standings), then (for those that stay visible: Kedudukan, Papan Pendahulu) the staff member is not listed as a ranked participant and sees the real list unchanged; where the screen normally shows "my position", it shows the existing "not ranked / no data" state. [Because of US-07]
- AC-06.6 Given account screens (Profil Saya, Tetapan Peribadi, Panduan, Tiket Bantuan) in the mode, then they operate on the real account, the same data as in the staff view: changes made there are real, are not stamped as test data, and are visible after exit. Learner-only fields (form, class, parent) are not shown or written for a staff account.
- AC-06.7 Given Cikgu Alesa (AI chat) in the mode, then it works as for a learner; the conversation is test data (US-07).
- AC-06.8 Given a typed or linked student-only URL in the mode, then it opens (it is in the student scope), except the 7 hidden screens of US-10 (AC-10.2); given the same URL outside the mode, the existing guard rule applies (redirect to the staff home).

### US-07 Test data (resolved Q2)
- AC-07.1 Given the mode is on, when the staff member writes learner data, then the write is allowed and saved. Writes covered: practice sessions and answers, revision/mastery, Bijak SPM and SPM attempts, structured answers, notes and bookmarks, coins/tokens/streak/achievements/challenges/mystery box/reward claims, games results, timeline entries, notifications created for the user, Cikgu Alesa messages, referrals and articles/video progress.
- AC-07.2 Each such record is stamped as test data (`is_test = true` in the contract/ADR-0017 sense) at the owner store (single-owner rule, CLAUDE.md section 6), together with the owning user id (the staff id). The stamp is set by the system from the session mode, never by a client-supplied field.
- AC-07.3 Given test records exist, then they are excluded by default from every aggregate shown to anyone else, whether or not the staff member belongs to a class: class, school, district and national reports; Prestasi, Headcount, Analitik Adaptif and Analisa Item figures; Command Center / Pemantauan live counts; Kirkpatrick; Statistik Penggunaan; Laporan Aktiviti and Laporan Bulanan; Amaran Awal; DSKP Heatmap; Sekolah Bersaing; every leaderboard and ranking; wallet/economy totals; "active learners" and streak counts.
- AC-07.4 Given the Admin Pusat, Admin Sekolah or Guru dashboards, then the figures are identical before and after a staff member answers 10 questions and earns coins in the mode (testable by comparing figures).
- AC-07.5 Given the staff member leaves the mode, then their test records stay stamped, are not shown as teaching data and do not appear in the staff views (Prestasi of own classes, Pelajar Saya, reports). They remain visible to the same user the next time the mode is on (AC-06.4).
- AC-07.6 Given a record that is not learner data (account/profile/ticket, AC-06.6), then it is not stamped.
- AC-07.7 Given the PROPOSED rule "reads inside the mode include the user's own test rows and the real shared content, never other users' private data", then the learner screens show the staff member's own test history together with the normal shared content (questions, notes, videos, leaderboards of real students).

### US-08 Guard rules
- AC-08.1 Given a staff member in the mode, then for every access decision (menu, Ctrl+K, bottom nav, "Lagi", route guard, landing, 403/404 pages) the effective view is the student view with self scope. The signed-in account's own role is unchanged and is restored on exit.
- AC-08.2 Given a staff member in the mode, when a staff-only URL is typed (for example `/guru`, `/guru/kelas`, `/guru/command-center`, `/admin-sekolah`, `/admin-sekolah/pelajar`), then no staff data is shown and the user lands on `/dashboard`.
- AC-08.3 Given the mode is on, then the sidebar, bottom nav, "Lagi" sheet and Ctrl+K show the 30 visible Murid items (37 minus the 7 hidden by US-10) and the account items only; no guru or Admin Sekolah item is listed, and "Masuk Mod Pelajar" is not offered (no nesting; v2-portals AC-07.6 intent).
- AC-08.4 Given a user with two roles and a role switcher, when the mode is on, then switching role is blocked (v2-portals AC-08.6). (The switcher is not built for the prototype roles; this is a guard for when it is.)
- AC-08.5 Given the mode is on, when the browser Back button reaches a staff page opened earlier, then AC-08.2 applies (no cached staff data).
- AC-08.6 Given the mode is on, when an API call for staff-only data is made (for example class lists, other students' records), then it is refused by the server/mock, not only hidden in the UI; learner calls of the account are accepted. (Security NFR.)
- AC-08.7 Given a guru outside the mode, then every route outside the Guru matrix still redirects to `/guru` as before; this feature adds no student route to the Guru or Admin Sekolah scope (`TEACHER_ITEMS` stays 15 items, `SCHOOL_ADMIN_ITEMS` stays 18).
- AC-08.8 Given Admin Pusat, then the existing "Masuk Mod Pelajar", banner, exit to `/admin/command-center` and tests behave exactly as before (Q-N1).

### US-09 Audit (Should)
- AC-09.1 Given a guru or Admin Sekolah enters or exits the mode, then one audit entry per transition is written with actor (user id), role, action (enter / exit / system exit), time and entry point (menu, Ctrl+K, Latih Tubi Rawak). No target user is recorded because the target is the actor. PROPOSED; the admin flow writes none today.
- AC-09.2 Audit entries are visible to Admin Pusat where an audit screen exists; never to murid or other gurus. No audit screen is built here.
- AC-09.3 Given the session expires while in the mode, then a system exit entry is written or the architect documents why not.

### US-10 No side effects on other real users (Q-N2 resolved 2026-10-25: option C, hide)
- AC-10.1 Hidden items. Given the mode is on, then these 7 Murid matrix items are hidden everywhere they can be entered (sidebar, bottom nav, "Lagi" sheet, Ctrl+K results, dashboard cards and shortcuts, in-page links and buttons from other screens): Mohon Keluarga Angkat (row 15, `/mohon-keluarga-angkat`), Permainan (row 21, the whole game family: `/permainan`, `/battle`, `/papan-bijak`, `/perang-fakta`, `/benteng-ilmu`, `/perlumbaan-matematik`, `/kuiz-relay`, `/teka-silang-kata`), Cabutan Bertuah (row 22, `/cabutan`), Tournament (row 23, `/tournament`), Marketplace (row 32, `/marketplace`), Rujuk Kawan (row 36, `/gamification/referral`, `/gamification/kad-kongsi`) and Jemput Ibu Bapa (row 40, `/jemput-ibu-bapa`, `/ibu-bapa/terima`). The list is the screens whose actions reach other real users (live rooms, sponsor requests, invitations, trades); the architect confirms each against the built screens (unobserved behaviour is not claimed here) and records any further item found by the sweep, which the user must approve.
- AC-10.2 Direct URL. Given the mode is on, when a hidden screen is opened by typed URL, bookmark or Back, then no content of that screen is shown and the user lands on the learner home `/dashboard`, the same outcome as a staff-only URL in the mode (AC-08.2). The existing "Belum tersedia dalam prototaip" page is not used for this. No flash message is required.
- AC-10.3 Outside the mode, the 7 items are unchanged for a murid, and a staff member's normal view is unaffected (staff already have no access to these routes). After exit, the hidden items are not part of the staff menu either.
- AC-10.4 Given a screen that stays visible (practice, notes, SPM, topics, rewards, Kedai Hadiah, Syiling & Token, Cabaran Harian, Kotak Misteri, Pencapaian, Kedudukan, Papan Pendahulu, Cikgu Alesa, Timeline and the rest), then it is never blocked by this story, because it only changes the staff member's own test data or reads shared content.
- AC-10.5 Given a visible screen contains an entry point into a hidden screen (for example a game banner on the dashboard), then that entry point is not rendered in the mode and leaves no empty gap or dead link; QA checks every visible screen for links to the 7 hidden routes.
- AC-10.6 Given a staff member has already joined or been given a record in a hidden feature outside the mode, nothing is changed or deleted; hiding applies only to access in the mode.

## 5. Non-functional requirements

| Area | Requirement |
|---|---|
| Security | Entry is authorised on the server for `teacher`, `school_admin` and `admin` only. The request carries no target user id (own account), so no impersonation or privilege-escalation surface exists. While the mode is on the server resolves the effective role as student: learner endpoints accept the account, staff endpoints refuse it (AC-08.6). The mode flag is part of the server-side session (contract `POST/DELETE /api/session/mode`, D53c); it cannot be set by editing client storage alone. The remembered return path is validated as an internal path. Because the feature touches auth/session, `security-engineer` review is required at G4. |
| Privacy | The mode exposes only the staff member's own data; no real student's data is shown by this feature (PDPA). No real person's name in docs, seeds or copy (CLAUDE.md section 6). Test data is attributable to the staff account for support but never exposed to other users. |
| Data integrity | Stamping and exclusion are complete: every learner write path in the mode stamps, every aggregate listed in AC-07.3 excludes (US-07). A missed path is a Major finding. |
| Responsive | Entry action, dialog, banner and exit work at 375 / 768 / 1280 px, no horizontal page scroll, touch targets >= 44 px (v2-portals AC-16.1, AC-16.3, AC-16.5). |
| Accessibility | Replicates the existing admin Mod Pelajar (D10): `role="status"` banner, keyboard-reachable buttons, dialog focus per the design system. No enhancements beyond that, except the 44 px target (AC-04.5). |
| Localisation | All UI copy in Bahasa Melayu. Reused: "Masuk Mod Pelajar", "Keluar Mod Pelajar", "Mod Pelajar tidak dapat dibuka. Sila cuba lagi.". New strings are marked PROPOSED (AC-03.2, AC-04.1, AC-04.2) for the user to approve at G2. |
| Theme | Light and dark both supported; banner and dialog use theme tokens (D29e). |
| Performance | Enter and exit complete without a full page reload; the student home shows within normal navigation time. |
| Reliability | No half-switched state after any failure (AC-01.8). |
| Testability | Unit: session mode for `teacher` and `school_admin`, effective-role resolution, stamping, aggregate exclusion. Guard tests: staff URLs in the mode, learner URLs outside it. E2E at three widths for Guru and Admin Sekolah: enter, banner, `/practice` renders, a write is stamped and absent from a staff dashboard, exit, Back button, reload. 30-screen sweep with a staff account (AC-06.1), plus a check that the 7 hidden routes redirect to `/dashboard` and no visible screen links to them (AC-10.1, AC-10.2, AC-10.5). Existing admin tests keep passing. |

## 6. Proposed defaults (not asked; user told "take the recommended defaults")

| # | Topic | Default | Why |
|---|---|---|---|
| D1 | Which student | **Superseded: own account** (user, 2026-10-25) | Replaces the earlier default "demo test student" |
| D2 | Writes | **Confirmed: allowed, stamped, excluded** (user, 2026-10-25) | |
| D3 | "Latih Tubi Rawak" | **Confirmed: dialog, then enter the mode, then `/practice`** (user, 2026-10-25) | |
| D4 | Entry points | Account menu (desktop and "Lagi") + Ctrl+K + the contextual button (guru only) | One consistent explicit transition (D31c) |
| D5 | Exit destination | Page where the mode started when allowed, else role home (`/guru`, `/admin-sekolah`) | Predictable; admin keeps `/admin/command-center` |
| D6 | Banner | Reuse the component; copy adapted for own account (AC-04.1); exit button >= 44 px | |
| D7 | Role switcher | Blocked while in the mode | v2-portals AC-08.6 |
| D8 | Audit | Enter/exit logged (Should) | v2-portals AC-07.7 intent |
| D9 | Other roles | **Superseded: Guru and Admin Sekolah** (user, 2026-10-25); PPD/JPN, Ibu Bapa, Penaja unchanged (none) | |
| D10 | Prototype scope / matrix | No new route in `TEACHER_ITEMS` or `SCHOOL_ADMIN_ITEMS`; Mod Pelajar is an account action, not a menu row; note it under Guru and Admin Sekolah in `role-access-matrix.md` | Keeps D43 scope exact |
| D11 | Staff with no form | Learner view defaults to Tingkatan 4 (Q-N3) | Matches D54 demo student |
| D12 | Persistence of test data | Kept between mode uses, never shown as teaching data | AC-06.4, AC-07.5 |

## 7. Scope

### In scope
- "Masuk Mod Pelajar" for `teacher` and `school_admin` in the Portal Pembelajaran (account menu, "Lagi" sheet, Ctrl+K).
- Own-account mode: the same user id viewed through the student layout, menu, guard and API authorisation.
- Contextual behaviour of "Latih Tubi Rawak" on `/practice/chapter` for a guru.
- Mode banner (adapted copy, 44 px exit) and exit with return destination.
- What the learner portal shows for a staff account (default form, empty states, 30-screen sweep).
- Test-data stamping and aggregate exclusion for all learner writes in the mode.
- Hiding the 7 screens that reach other real users while the mode is on, with `/dashboard` as the direct-URL outcome (US-10).
- Audit of transitions (Should).
- Doc updates listed in section 9.

### Out of scope
- Viewing as another user or as a real student (any impersonation); a student picker.
- "Pratonton sebagai Pelajar" per US-07 as written.
- Mod Pelajar for PPD/JPN, Ibu Bapa, Penaja.
- Changing the behaviour of Admin Pusat Mod Pelajar (test student by impersonation), except style-only shared-banner changes and shared-code refactors that keep its behaviour (Q-N1).
- Adding any student route to the Guru or Admin Sekolah prototype scope or menu.
- Role switcher (US-08) build; only the "blocked in mode" rule is stated.
- The wider Darjah/primary removal (D54) and the other UAT triage tasks.
- Any audit screen build; a "reset my test data" feature.
- Fixing other silent-redirect links on shared Murid + Guru screens (R3), unless the user decides otherwise.

### Assumptions
- A1 Guru Demo (id 5) and Pentadbir Sekolah Demo (id 8), both SMK DEMO with `grade: null`, exist in the seeds [AS-BUILT: `accounts.ts`].
- A2 The mode stays in the same tab and survives reload (state in `pp.auth` for the mock).
- A3 `/practice` and `/dashboard` are allowed for the student view in the prototype scope (matrix rows 2 and 16).
- A4 The architect decides how the mock models the mode (the contract `POST/DELETE /api/session/mode`, D53c, or an interim mock-only mechanism) and how the mock resolves the effective role on learner endpoints.
- A5 Admin Sekolah is rendered in the Pembelajaran layout in the prototype (`layouts.ts`), so one entry point serves Guru and Admin Sekolah.
- A6 In v2 final, Admin Sekolah is planned for Portal Pentadbiran (D30); the entry must then exist there too. Not built now.
- A7 Test-data stamping (V2-T19) does not exist in the mock today; this feature depends on it or builds the minimum needed (section 9, R5).
- A8 A staff account has no parent links, class membership or student record; screens must not require them.

### Risks
- R1 (old, restated) Pollution of the shared Pelajar Demo account: **removed for Guru and Admin Sekolah** (own account, stamped). Still true for Admin Pusat, which is unchanged (Q-N1).
- R2 (old) Widening the admin-only impersonate endpoint for gurus: **removed**. No impersonation, no target id, no endpoint widening. **Replaced by R2':** the mock authorises many learner endpoints by the token's role (`student`); with the same token as a `teacher`/`school_admin` they would answer 403. The server/mock must resolve the effective role from the session mode on every learner endpoint (and refuse staff endpoints in the mode, AC-08.6). Cross-owner mock handler changes follow the isolated-worktree rule and `registry-boot.test.ts`. G4 `security-engineer` required.
- R3 Other shared Murid + Guru screens may contain further links to student-only routes (same silent-redirect defect). Inventory needed; fixing is out of scope unless the user decides.
- R4 The banner exit button is 32 px high, below the 44 px target (AC-04.5).
- R5 Stamping and exclusion are not built (A7). Without them, AC-07 fails and staff test activity pollutes leaderboards and reports. Sequencing against V2-T19 is a lead/architect decision.
- R6 Staff with no class/grade may crash screens that assume `grade != null` or class membership (AC-06.1 sweep).
- R7 Layout personality, menu builders, scope helpers and landing read `session.role` (for example `learner = role === 'student'` in `PembelajaranLayout.vue`); all must read the effective role in the mode, or the staff menu leaks into the student view.
- R8 Cross-user side effects (Q-N2 resolved: hide): a guru in a live game room, a sponsor request or an invitation to a real parent would reach real people. Mitigated by hiding the 7 screens; residual risk is an unlisted screen or a visible screen with an entry point into a hidden one (AC-10.5 sweep).
- R9 Admin Sekolah moving to Portal Pentadbiran (A6) will need the entry re-provided.

## 8. Open questions

### Resolved (user, 2026-10-25)

| # | Question | Answer | Effect |
|---|---|---|---|
| Q1 | Which student does the user view as? | **"Akaun guru sendiri"** (guru and Admin Sekolah use their own account in the student layout; no impersonation, no test student). Replaces proposed default D1 (option C). | Own-account model (section 1); US-06, US-07, US-08; R2 removed |
| Q2 | Writes during the mode | **"Boleh, ditanda data ujian"** (option A) | US-07 |
| Q3 | "Latih Tubi Rawak" for a guru | **"Tanya, kemudian masuk mod"** (option A) | US-03 |
| Q4 | Exit destination | Recommended default **A**: page where the mode started, fallback role home (`/guru` or `/admin-sekolah`) | US-05 |
| Q5 | Admin Sekolah in this change | **"Tambah Admin Sekolah"** (option B). Resolves the D33(b)/ADR-0017 versus `v2-frontend.md` OQ-1 conflict: Admin Sekolah is included. | US-02; ADR-0017 item 7, contract `MOD_PELAJAR_ROLES`, `v2-frontend.md` OQ-1 to be aligned (section 9) |
| Q-N2 | Which actions that reach other real users are handled in the mode? (asked after the first draft) | **"Sembunyikan menu itu"** (option C, 2026-10-25): live game rooms, Tournament, Cabutan, Jemput Ibu Bapa, Mohon Keluarga Angkat, Rujuk Kawan, Marketplace are hidden from menus and entry points; a direct URL lands on `/dashboard` (choice made in this doc, same as staff-only URLs in the mode). Replaces the draft default "block with a message". | US-10 (AC-10.1 to AC-10.6); US-06 scope is 30 visible screens; R8 mitigated |

### New (open, non-blocking; defaults applied)

- **Q-N1 (non-blocking, default applied). Should Admin Pusat's Mod Pelajar also become own-account, for consistency?** Today Admin Pusat views as the shared test student "Pelajar Demo" by impersonation, which contradicts D31(c), ADR-0017 and D53(c) (all say "as themselves"). Options: (A) leave Admin Pusat unchanged now and move it to the same own-account mechanism in the already-planned realignment V2-T31; (B) migrate Admin Pusat in this change; (C) keep Admin Pusat on the test student permanently and amend D31(c)/ADR-0017. **Recommended: A** (no behaviour change to a built, working feature without being asked; the mechanism is built once so the move is small). AC-08.8 assumes A.
- **Q-N3 (non-blocking, default applied). Which form does the learner view use for a staff account with no form?** Options: (A) Tingkatan 4 (matches the D54 demo student); (B) Tingkatan 5 (SPM candidates); (C) ask the staff member on entry. **Recommended: A** (AC-06.2); the existing form/level selectors on each screen still let the staff member change it.

## 9. Impact list (for the architect)

Likely code touched (no code is written in this phase):

| Area | Files |
|---|---|
| Mode logic | `src/shells/shared/mod-pelajar.ts` (admin-only role check, fixed admin return path, impersonate call); add the own-account enter/exit for `teacher` and `school_admin` with a parametric return path; keep the admin path working (Q-N1) |
| Session | `src/stores/session.ts` (`enterModPelajar`/`leaveModPelajar`, `mode` computed, `role` computed: add an effective/active view without parking a session), `src/stores/session-types.ts` (`ModPelajarMode` currently requires a parked `parent`; own-account mode needs no parent), `src/mock/core-data/client-session.ts` (parser for `mode`) |
| Contract | `packages/contract/src/session/session.ts` (`MOD_PELAJAR_ROLES` is `['admin','school_admin']`: add `teacher`; confirm `mode.returnRole` and `active.via` fit own-account for teacher/school_admin), contract tests |
| Entry UI | `src/shells/pembelajaran/PembelajaranLayout.vue` (account menu, "Lagi" sheet, `searchGroups` "Akaun" group; show the item for `teacher`/`school_admin` only and only when the mode is off; `learner` and `personality` currently derive from `role === 'student'`; `showAlesa`), `src/shells/pembelajaran/pembelajaran-nav.ts` (menus by role), `src/shells/pembelajaran/useShellUser.ts` |
| Banner | `src/shells/shared/ModPelajarBanner.vue` (copy per role/mode, 44 px exit button, secondary line, offset of content `top-10!` in the layout if the bar grows) |
| Contextual button | `src/modules/m05-practice/pages/ChapterIndexPage.vue` (button target and dialog; owner module M05) |
| Guard / scope | `src/app/router/guards.ts` (role step and scope step read `session.role`), `src/app/prototype-scope.ts` (`isPathAllowed`, `shellHomePath`, `scopeHomePath` must use the effective role; no new Guru/Admin Sekolah item), `src/app/router/layouts.ts` (portal by role, lines 35 and 49), `src/composables/usePrototypeScope.ts` |
| Mock server | Authorisation of learner endpoints by token role (R2'); M01 session handlers (`POST/DELETE /api/session/mode` if adopted, D53c); `src/modules/m02-users-schools/mock/handlers/users-admin.ts` impersonate route stays admin-only and unchanged; any shared mock data or handler change follows the isolated-worktree rule |
| Test data | M05 sessions/answers/revision/mastery, wallet/gamification, notes, notifications, games, referral, Cikgu Alesa history: `is_test` stamping at the owner store (V2-T19, ADR-0014/0017); exclusion in aggregates of AC-07.3 (M08 Prestasi/Headcount/Analitik/Analisa Item, M17 Command Center/Pemantauan, M10 classes, M27 Admin Sekolah reports, leaderboards/rankings, M14 economy totals) |
| Hidden screens | The 7 items of AC-10.1 (games M16, Tournament, Cabutan, Jemput Ibu Bapa, Mohon Keluarga Angkat M21, Rujuk Kawan, Marketplace M20): filter in the menu builders, Ctrl+K, dashboard/in-page links; guard outcome `landing` (`/dashboard`) for their routes in the mode; the rules are keyed on the mode, not on the role |
| Audit | Audit store/handler of the mock (none for Mod Pelajar today); backend cards BE-03/BE-21 |
| Tests | `src/shells/__tests__/mod-pelajar.test.ts` (extend for `teacher`, `school_admin`), guard and prototype-scope tests, M05 chapter page test, 37-screen staff sweep, aggregate-exclusion tests, E2E at 375/768/1280 |

Docs to update when built: `docs/requirements/role-access-matrix.md` (Guru and Admin Sekolah note), `docs/requirements/v2-portals.md` (US-07 pointer to this doc), `docs/adr/0017-role-list-active-role-scope.md` (item 7 and amendment: add `teacher`; note the 2026-10-25 own-account confirmation), `docs/architecture/v2-frontend.md` (OQ-1: Admin Pusat, Admin Sekolah and Guru), `docs/AKAUN-DEMO.md` (Guru and Admin Sekolah accounts), `docs/TRACKER.md` (new decision row for the 2026-10-25 answers, D54 follow-up, status), backend plan cards BE-03/BE-21 (`teacher` and `school_admin` allowed on `POST /session/mode`).

## 10. Change log

- 2026-10-25: Applied user answers (own account, writes stamped as test data, dialog then enter, Admin Sekolah added); rewrote stories/ACs for Guru and Admin Sekolah, resolved Q1-Q5, added Q-N1 to Q-N3, restated risks (R2 removed, R2' added) and the impact list.
- 2026-10-25: Q-N2 answered "Sembunyikan menu itu" (option C): US-10 rewritten from "block with message" to "hide 7 cross-user screens in the mode, direct URL lands on `/dashboard`"; Murid scope in the mode is now 30 visible screens; Q-N2 marked resolved; R8 and impact list updated.
