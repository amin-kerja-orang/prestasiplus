# v2 integration QA, 2026-10-29 (gate G5, interim)

Status: INTERIM. (a) secondary-only is "fix in progress, re-test pending". The run was cut short by the deadline (see Coverage gaps).

## 1. Scope

(a) v2-secondary-only (26 ACs, D72); (b) ALESA AI hidden (D73, `VITE_ALESA_AI`); (c) tab title `{Page Name} | PRESTASIPLUS`; (d) Command Center and Admin Sekolah header in portal (DV-M17-54); (e) "Ingat saya" (FN-M01-1.2.5 / AC-M01-03.2).

## 2. Environment

- Branch `local/v2-full`, uncommitted working tree shared with other live sessions (results can shift between runs).
- Unit: `npm test` (`vitest run --project unit`), run twice (second run with JSON reporter).
- E2E: own mock build, `npx vite build --mode e2e --outDir <SCRATCH>/qa-integration/dist-5601`, then `npx vite preview --mode e2e --port 5601`. `.env.e2e`: mock API, `VITE_ALESA_AI` unset (= off), `VITE_PROTOTYPE_SCOPE=off`.
- Config `<SCRATCH>/qa-integration/playwright.5601.config.mjs` (outside the repo, loads fine). Projects mobile 375x812, tablet 768x1024, desktop 1280x800. Browser channel `msedge`, because the Playwright chromium revision 1243 is not installed (only 1234/1248). Expect timeout 8 s (15 s for the global run).
- Throwaway specs (not in repo): `<SCRATCH>/qa-integration/specs/sweep.spec.ts`, `checks.spec.ts`, `alesa-dom.spec.ts`, config `playwright.sweep.config.mjs`.
- Backend `be:test` not run: its DB specs start a Testcontainers Postgres (Docker), which the brief excluded.
- Browser MCP lanes were unavailable; CLI runner only.

## 3. Unit result

| Run | Pass | Fail | Skipped/todo | Files |
|---|---|---|---|---|
| 1 (list) | 10350 | 46 | 36+9 | 625 (23 failed) |
| 2 (JSON) | 10357 | 35 | 76 | 625 |

Run-1-only failures were hook timeouts under load (users-store, questions-store, m21 routes, m27 performance-bijak).

Fixed by QA (stale test): `packages/contract/src/content/__tests__/content.test.ts` created a note with `grade: 'DARJAH_5'`. The contract now rejects D-codes on write (AC-10.1, `NOTE_WRITE_GRADES`). The test now uses `TINGKATAN_5` and asserts `DARJAH_5` is rejected. 31/31 pass.

Remaining failures (run 2), none caused by this session's five changes except where noted:

| Test | Cause | Owner |
|---|---|---|
| eslint ds-admin-ratchet (2), ds-debt-ratchet (3) | lint baselines | DS/lint session |
| src/ds h-api DsNativeSelect | DS class change | DS session |
| theme icon-offline route list; shells shell-title (2) | shell/menu changes | shells session |
| m02 UserListPage "4,533" vs "4533"; m05 DashboardPage "130,152"; m10 GuruDashboardPage "20,719" | DsStatTile thousands separator | DS session; the three spec files need updating |
| m11 monitoring pages (2) | asserts a "404" substring in `document.title`; the new title is "Halaman Tidak Dijumpai \| PRESTASIPLUS" (change (c)) | m11 owner |
| m17 pages.test (3), board.test (8), daily.test (2) | stale vs DV-M17-54/56 (LIVE badge, clock, back buttons, ALESA panel, column layout) and tab-title format | m17 owner |
| m12 Results (5), Chain (1) | ALESA panel hidden (flag off, D73) | m12 owner |
| m01 users-store, m04 questions-store, m21 mohon routes, m27 performance-bijak | hook/test timeouts under load | environment; re-run alone |

## 4. E2E result

Global (all of `e2e/global`, 3 viewports, 15 s expect): 30 pass, 21 fail, 33 skipped.
Failed tests, each at all three viewports:
- cross-tab (2), guards (2), user-shell (1): probe-route specs expect `[data-layout="user"]`, a `/login` URL without `?redirect=`, and the 403 emoji.
- not-found (2): expects the 🔍 emoji.
Cause: stale against the committed shell and `DsErrorPage` work (commit 471567ce, guards v2 `?redirect=`), not the five changes. Not edited.

m17 (`e2e/m17-admin-dashboard`, 3 viewports): run stopped at 33 pass, 28 fail, 1 skipped of about 62 results (180 expected).
- Confirmed cause for E2E-M17-23 and E2E-M17-41: stale tab title. The specs expect `COMMAND CENTER | PRESTASIPLUS` and `AKTIVITI PLATFORM | PRESTASIPLUS`; the app now shows `Langsung | PRESTASIPLUS` and `Aktiviti Harian | PRESTASIPLUS` (change (c)).
- The other 26 failures (mostly drill S4-S7 and Admin Sekolah alias) are not classified.
- m17 is another session's area. Listed only.

Not run: m01, m10, m13, m27, m06, m03, m05, m02 (Tier-1 list was queued but the run was too slow, 6 to 12 tests/min with two workers on a loaded machine; about 4,250 test runs were in scope for the required folders). Not executed, so not Pass.

Custom sweeps (Playwright, all three viewports):
- `sweep.spec.ts`: 4 roles (student, teacher, school admin, admin), about 150 menu routes. Checks no `darjah|sekolah rendah|SJK|SK` text, title format, no horizontal scroll. Teacher and school admin: pass. Student and admin: fail on Darjah/SK text only (see bugs). Title format and h-scroll: no violations in any role or viewport.
- `checks.spec.ts` (desktop): register, profile edit, login, titles, ALESA, DV-M17-54.
- `alesa-dom.spec.ts` (desktop): ALESA DOM check, 4 roles.

## 5. Acceptance criteria

### (a) v2-secondary-only (fix in progress, re-test pending)

Pass in the table means executed; "unit" means the unit suite run 2 (not an e2e).

| AC | Result | Evidence |
|---|---|---|
| 01.1 | Fail (mock) | Sweep: Darjah/SK text for Murid and Admin Pusat, see B-01 to B-04. Guru and Admin Sekolah: clean. |
| 01.2 | Pass | `checks.spec` register: tiles grade-7..11, no Darjah; unit RegisterPage |
| 01.3 | Partial | Pass: profile edit shows 5 radios, no Darjah (e2e + unit). Not tested: a user with stored D-level asked to choose. |
| 02.1 | Not run | backend (`OFFERED_LEVEL_CODES = SPM_LEVEL_CODES` read in `practice/rules.ts:43`; be:test not run) |
| 02.2 | Pass (unit) | student-handlers topics/learning-map tests, StudentPages |
| 02.3 | Not run | backend |
| 02.4 | Partial | unit `lower-form.test.ts` (copy exact, grade 7-9 only). No browser check with a T1-T3 student. |
| 03.1 | Pass (unit) | `copy.test` LEVEL_TILES: five Tingkatan, no Tahun |
| 03.2 | Not run | import row rejection not exercised |
| 03.3 | Not run | `m27 page.test` renders "Darjah n" levels as the API gives them; filtering is backend. |
| 04.1 | Not run | no specific test run |
| 04.2 | Not run | backend |
| 04.3 | Pass | student sweep `/pksk`: no Darjah text |
| 05.1 | Fail (mock) | `/admin/questions/quality` lists Darjah 1 (4,325 soalan), Darjah 2 |
| 05.2 | Fail (mock) | Darjah filter/options on admin lists |
| 05.3 | Not run | backend |
| 06.1 | Not run | backend |
| 06.2 | Fail (mock) | `/admin/schools` "SK" type filter; `/admin/users` lists "SK Demo" schools |
| 07.1 | Not run | DB |
| 07.2 | Not run | DB |
| 07.3 | Fail (mock) | `/admin/education-levels` lists Darjah 1 / D1; `/admin/curriculum` Darjah picker |
| 08.1 | Not run | ETL tests not run |
| 09.1 | Fail (mock) | SK Demo schools visible; Darjah-tagged articles/notes/audio visible |
| 09.2 | Pass | `pelajar` session: grade 10 (Tingkatan 4), schoolId 900001. School name not verified. |
| 10.1 | Partial | contract write rejection of D-codes verified for notes only (content.test); other enums not run |
| 10.2 | Not ready | unit has 35 failures; e2e incomplete |

### (b) ALESA hidden: Pass

| Check | Result | Evidence |
|---|---|---|
| No ALESA panel/text: M17 CC, M10 CC, Kirkpatrick, Laporan Mingguan, SPM, practice | Pass | text sweep and `ALESA off` checks, 4 roles |
| No Cikgu floating button, menu link, "Powered by" footer | Pass | `alesa-dom.spec`: 0 "alesa" in HTML, 0 `/cikgu` links, no "Powered by" |
| `/cikgu`, `/cikgu/rph`, `/pusat-ai/spm`, `/guru/alesa` give the normal 404 | Pass | "Halaman Tidak Dijumpai \| PRESTASIPLUS" |
| M06 result tip | Partial | `MockResultPage.vue` gated by `isAlesaAiOn()`; not opened in a browser |
| Flag on/off | Pass (unit) | `src/app/__tests__/features.test.ts` |

### (c) Tab titles: Pass

About 150 routes x 4 roles x 3 viewports: no title violating `{Name} | PRESTASIPLUS`. Auth: Log Masuk, Daftar, Lupa Kata Laluan. Errors: Halaman Tidak Dijumpai (404), Akses Ditolak (403). Guard redirects: student to `/admin-sekolah/command-center` gives "Akses Ditolak". Unit: `tabTitle.test.ts`, `guards.test.ts`, `helpers.test.ts` pass. Note: `/prestasi` for a student shows "Dashboard Sekolah" (a student reaching a school dashboard route; not investigated, outside scope).

### (d) DV-M17-54

| Check | Result |
|---|---|
| Admin Sekolah S2 and S3: no LIVE pill, no clock, no header buttons, no h-scroll | Pass (desktop) |
| S2 and S3 render in the portal layout (`data-layout="pembelajaran"`) | Pass |
| Sidebar "Command Center" same tab (no `target`); "Aktiviti Harian" under it; not in the guru sidebar | Pass |
| Admin Pusat S2/S3 | Partial: e2e stopped early; the two failures inspected are stale titles |
| S4-S7 drill aliases | Not run (m17 drill spec: 12 of its failures unclassified) |
| Mobile/tablet for these | Not run |

### (e) Ingat saya: Pass
Unticked by default (unit and e2e). Ticked login stores `remember:true` (e2e). `LoginPage.test.ts` asserts `remember:false` and `true` in the payload. e2e `smoke-auth` and `smoke-profile` not run in this session.

## 6. Bugs

| ID | Sev | What | Steps | Expected | Actual | Suspected owner |
|---|---|---|---|---|---|---|
| B-01 | High | Mock build shows Darjah in Admin Pusat pickers and lists | Login `admin@demo.test`, open `/admin/education-levels`, `/admin/curriculum`, `/admin/subjects`, `/admin/questions`, `/admin/questions/import`, `/admin/audio-kbat` | No Darjah (AC-01.1, 07.3) | Darjah 1-6 rows/options; subjects list "Darjah 1, Darjah 2..." | frontend (mock stores m03, m04, m09); fix in progress |
| B-02 | High | Kualiti Soalan panel lists Darjah | `/admin/questions/quality` | Tingkatan 1-5 only (AC-05.1) | "Darjah 1 4,325 soalan", "Darjah 2" | frontend mock (m04) |
| B-03 | High | Primary demo schools and SK filter visible | `/admin/schools`, `/admin/users` | no primary school or SK type (AC-06.2, 09.1) | "SK" in type filter; "SK Demo" / "SK Demo Bestari" | frontend mock (m02) |
| B-04 | High | Darjah-tagged content visible to Murid and Admin | Murid `/artikel`, `/audio-kbat`; Admin `/admin/articles`, `/admin/notes` | no Darjah (AC-01.1, 09.1; OQ-04) | "Cara Mudah Hafal Sifir untuk Darjah 2 dan 3", Darjah 1-4 filter, `DARJAH_4`, `DARJAH 2` | frontend mock (m09) |
| B-05 | Medium | Student reaches `/prestasi` showing "Dashboard Sekolah" | Murid, router push to `/prestasi` | forbidden or student view | page with title "Dashboard Sekolah" | frontend (m08), unconfirmed |
| B-06 | Low | Stale global e2e specs (404/403 emoji, `?redirect=`, `data-layout="user"`) | `npx playwright test e2e/global` | green | 21 fail | e2e owner |

Note: B-01 to B-04 are observed in the mock (e2e) build. The http stack was not tested, so whether http mode is clean is unknown.

## 7. Specs updated
- `packages/contract/src/content/__tests__/content.test.ts` (unit): AC-10.1, D72.
- No e2e spec edited. The m17 e2e specs had already been updated for DV-M17-54; their remaining stale titles belong to change (c) and m17 is another session's area.

## 8. Failures owned by other sessions (not fixed)
See the unit table (DS, shells, theme, m11, m12, m17), the global e2e failures (B-06), and the m17 e2e failures (stale tab titles `COMMAND CENTER` / `AKTIVITI PLATFORM`).

## 9. Coverage gaps
Not executed: backend be:test for AC-02.1/02.3/03.2/04.2/05.3/06.1/07.1/07.2/08.1; e2e for m01, m02, m03, m05, m06, m10, m13, m27 and the mobile/tablet runs of the custom checks; the unclassified m17 failures.

## 10. Re-run commands
- (a) re-test: rebuild the 5601 build, then from the repo root `npx playwright test -c <SCRATCH>/qa-integration/playwright.sweep.config.mjs sweep.spec.ts -g "student|admin"` (`<SCRATCH>` = `C:\Users\hp\AppData\Local\Temp\claude\d--Dev-Projects-prestasiplus\5d72503c-2cda-43fd-962f-f28a05e253d2\scratchpad`).
- Unit: `npm test`.
- Global: `npx playwright test -c <SCRATCH>/qa-integration/playwright.5601.config.mjs e2e/global --workers=2`.

## 11. Verdict: NOT READY
- (a) has open High bugs B-01 to B-04 (fix in progress) and most backend ACs unexecuted.
- Unit suite has 35 failures (mostly other sessions and stale tests).
- Required e2e folders mostly not run.
(b), (c) and (e) pass in what was executed; (d) passes for Admin Sekolah, Admin Pusat is partial.


## HTTP-mode re-test 2026-10-30 (preview 5192)

Scope: feature `v2-secondary-only` (D72), targeted G5 re-test, HTTP mode against the running preview http://localhost:5192 (full stack, built 22:08, branch `local/v2-full`, uncommitted tree). Strictly read-only (GET, navigation, login only). Accounts used (demo, names only): pelajarmaju (Murid), pelajar (Murid, API only), guru, adminsekolah (Admin Sekolah), admin (Admin Pusat). Browser: Playwright MCP lane 1 at 375 / 768 / 1280. Evidence and screenshots: `C:/Users/hp/AppData/Local/Temp/claude/d--Dev-Projects-prestasiplus/5d72503c-2cda-43fd-962f-f28a05e253d2/scratchpad/qa-5192/` (peta-belajar-t5-375.png, register-375.png, profile-edit-375.png, practice-bm-375.png, admin-*-1280.png).

### Results per AC

| AC | Result | Evidence |
|---|---|---|
| AC-01.1 | Pass (rendered UI); API leak in B-HTTP-01 | Text sweep (Darjah / Sekolah Rendah / SJK / SK x) over every menu route of Murid (42), Guru (23), Admin Sekolah (25), Admin Pusat (32) at 375, plus Murid/Admin key pages at 768 and 1280: zero hits. |
| AC-01.2 | Pass | /register: "Sekolah Menengah", Ting.1 to Ting.5 only. |
| AC-01.3 | Partial | /profile/edit shows Ting. 1 to Ting. 5 only. Not testable: a user with stored D-level (no such demo user; would need a write). |
| AC-02.1 | Partial (B-HTTP-04) | /practice/BM level picker offers Semua Tahap, Tingkatan 4, Tingkatan 5 only; GET /api/practice/subjects/BM levels = T4, T5. But the student dashboard shows links "Tingkatan 1 (0)", "Tingkatan 2 (0)", "Tingkatan 3 (0)" to /practice?level=T1..T3. |
| AC-02.2 | Fail | /api/learning-map and /api/topics emit DARJAH_1..6 (B-HTTP-01). /peta-belajar: the Tingkatan 5 tab shows Darjah 4 topics (B-HTTP-02). The /topics page itself shows only T4/T5 tabs (client-side filtering). |
| AC-02.3 | Not testable | Needs a write (POST practice session). |
| AC-02.4 | Not testable | No T1-T3 student account in the demo seed (students are grade 10/11). |
| AC-03.1 | Pass (data) | Admin Sekolah pelajar form-options and class lists: Tingkatan 1 to 4 only. Create form not submitted. |
| AC-03.2 | Not testable | Needs an import write. /admin/import-students offers Tingkatan 1 to 5 only. |
| AC-03.3 | Pass | /api/guru/classes, /api/admin-sekolah/kelas: only Tingkatan classes. |
| AC-04.1 | Pass | /permainan, /battle, /api/games/*/lobby: no Darjah picker, autoGrade TINGKATAN_5; /ranking Tingkatan filter = Semua / T4 / T5. |
| AC-04.2 | Pass (no Darjah rows; data sparse) | /api/battle/standings/*, /api/gamification/leaderboard, /api/sekolah-bersaing, /api/battle/search-opponent: no Darjah pupil or primary school. |
| AC-04.3 | Pass | /pksk shows "Tingkatan 1" and "Tingkatan 4" cards; no "Darjah 6" text. |
| AC-05.1 | Pass | /admin/questions/quality "Mengikut Tingkatan": Tingkatan 1 to 5 only (all 0, no audit run; /api/question-quality byLevel = 5 rows). |
| AC-05.2 | Fail (B-HTTP-03, B-HTTP-05) | Bank Soalan OK: GET /api/questions?status=published returns data.length 20 (page 1), totalItems 500, counts.published 500; UI shows rows and "Jumlah: 503" (503 = 500 published + 1 draft + 1 review + 1 archived). Level, subject, school and user lists have T1-T5 and SMK only. But practice and landing totals include non-T4/T5 questions, and Command Center totals disagree. |
| AC-05.3 | Fail | /api/education-levels and /api/admin/education-levels return T1-T5 only (Pass), but /api/topics and /api/learning-map still return DARJAH_* (B-HTTP-01). |
| AC-06.1 | Pass | /api/schools/search?q=SK returns []; q=SMK returns SMK Demo Satu; registration school search for "SK" shows "Tiada sekolah dijumpai". |
| AC-06.2 | Pass | /admin/schools: 1 school (SMK Demo Satu), type filter lists SMK only, counts 1/1/0. |
| AC-07.3 | Pass | /admin/education-levels: 5 rows T1-T5, no Darjah, no activate control. /admin/curriculum Tahap select T1-T5. |
| AC-09.x | Partial | SK Demo Dua hidden everywhere checked (admin schools, user filters, search). AC-09.2 mismatch: pelajarmaju is grade 11 / "5 Amanah" = Tingkatan 5 (autoGrade TINGKATAN_5), AC says Tingkatan 4 (B-HTTP-06). pelajar is Tingkatan 4. Both at SMK Demo Satu. |
| AC-10.1 | Fail | /api/topics, /api/learning-map emit DARJAH_1..6 (B-HTTP-01). The other ~70 GET endpoints across 5 accounts: no D-codes. Write rejection not testable (read-only). |
| Responsive | Pass | No horizontal scroll at 375 on all swept routes (4 roles); none at 768 / 1280 on 24 sampled pages. |

### Bugs

| ID | Sev | Layer | Detail |
|---|---|---|---|
| B-HTTP-01 | High | Backend | GET /api/topics and GET /api/learning-map (any role) return DARJAH_1..6 topics and `gradeOptions` DARJAH_1..4 (125 topics: Darjah 1-6 plus Tingkatan 1/4/5). Steps: log in as pelajarmaju, GET /api/topics. Expected: only TINGKATAN_4 and TINGKATAN_5 (AC-02.2, AC-05.3, AC-10.1). Files: apps/api/src/modules/curriculum/rules.ts (grade list, MAP_GRADES, DEFAULT_MAP_GRADE = DARJAH_4), learner.service.ts. /topics page hides them client-side only. |
| B-HTTP-02 | High | Backend (FE masks) | Peta Belajar shows Darjah 4 content under Tingkatan labels. Steps: /peta-belajar, click "Tingkatan 5". Request /api/learning-map?subject=MATEMATIK&grade=TINGKATAN_5 returns grade DARJAH_4 with topics "Nombor Hingga 100 000", "Perpuluhan", "Geometri" (same for TINGKATAN_4). Expected: T4/T5 topics for the chosen grade. Cause: learner.service ignores TINGKATAN_* and falls back to DARJAH_4. Screenshot: C:/Users/hp/AppData/Local/Temp/claude/d--Dev-Projects-prestasiplus/5d72503c-2cda-43fd-962f-f28a05e253d2/scratchpad/qa-5192/peta-belajar-t5-375.png |
| B-HTTP-03 | High | Backend | Question counts include hidden-level questions. Practice subject cards and the login/landing stat show 1,268 questions (BM 153) while subject detail totals 53 (T4 25 + T5 28) and the bank has 500 published (T4 251 + T5 249). Sum of cards 1268 vs sum of details 493; about 100 extra per core subject (likely Darjah / unlevelled pool). Steps: murid /practice vs /practice/BM; GET /api/public/stats (questionCount 1268); /login footer "1,268+ Soalan". Expected: counts equal the T4-T5 bank (AC-05.2). Files: practice/reads/overview/overview.service.ts (bank.count), account/account-data.repository.ts (questionCount). |
| B-HTTP-04 | Medium | Frontend | Student dashboard lists "Tingkatan 1 (0)", "Tingkatan 2 (0)", "Tingkatan 3 (0)" linking to /practice?level=T1..T3 although practice offers T4/T5 only (BR-11, AC-02.1). /practice?level=T1 silently shows all subjects. |
| B-HTTP-05 | Medium | Backend | Admin Pusat Command Center totals contradict other screens: "0 Sekolah Berdaftar" (1 school exists), "31 Pelajar Berdaftar" (users list 16 students; monitoring 12 T4/T5). GET /api/admin/command-center/live-data: totalSchools 0, totalStudents 31, engagement.disengaged 2229. The 15 extra students may be hidden-school or Darjah pupils (unverified). File: command-center/board/board.service.ts. |
| B-HTTP-06 | Low | Seed / doc | AC-09.2 says pelajarmaju is Tingkatan 4; seed (core/identity.ts) gives grade 11 = Tingkatan 5 ("5 Amanah"). Fix the AC or the seed. |
| Note | Info | n/a | HTTP 429 appeared when a sweep issued about 30 page loads per minute (rate limit, not a defect). Quality page shows 0 per level because no audit has run. |

Earlier mock bugs B-01..B-04 were not re-tested (mock mode).

### Verdict (HTTP mode, 5192)

Not ready for G5: 3 High bugs open (B-HTTP-01, B-HTTP-02, B-HTTP-03), 2 Medium, 1 Low. The visible UI is free of Darjah / SK / SJK text for all four roles, and Bank Soalan rows and totals now agree (20 rows on page 1, totalItems 500).

Data written: none. Only GET requests, page navigation and logins (which update last-login timestamps) were performed.
