# QA report: M27 Part B S6-S12 school user management (roles-matrix L56, L57, L58)

Feature slug: `m27-school-admin` (Part B, screens S6 Senarai Pelajar, S7 Senarai Guru, S9 Edit Pelajar, S10 Edit Guru, S11 Cipta Guru, S12 Tambah Pelajar, "Eksport CSV" on S6/S7).
Date: 2026-10-10. Tester: qa-engineer (independent G5 run).

## Build under test

- Tested trees: HEAD `242aa56` (S6, S7, S9 to S12, CSV) and HEAD `d023c1b` (S8); both descendants of Session 2 bundle `c5e1a7f` (confirmed with `git merge-base --is-ancestor c5e1a7f HEAD`). `git diff HEAD -- src` was empty at each build, so builds equal committed code.
- Build: `vite build --mode e2e --outDir dist-e2e-5140`, served by `vite preview --port 5140` (own port, stopped afterwards).
- Scope: S6 to S12 including S8 Kelas Sekolah (L58), added after the first pass.

## Test plan and results

Legend: P = Pass (executed), F = Fail, B = Blocked. "Auto" = Playwright spec at 375 / 768 / 1280 (desktop-only cases are skipped on the other two projects by design). "Expl" = exploratory in a real browser (Playwright MCP lane 3) against the 5140 preview.

### S6 Senarai Pelajar (FR-M27-88 to 93, 119, AC 25.x, 26.x)

| AC | Case | Where | Result |
|---|---|---|---|
| 25.1 header, single card "Pelajar", "{n} pengguna dijumpai", buttons | E2E-M27-83/84/41 | Auto, 3 widths | P |
| 25.2/25.3 columns, number, Tarikh dd/mm/yyyy, "-" for empty phone | E2E-M27-83, Expl | Auto, Expl | P |
| 26.1 filter Status/Cari, case-insensitive name and e-mail | E2E-M27-85, QA-L56-1 | Auto | P |
| 26.2 order active first then id descending | QA-L56-1 | Auto | P |
| 26.3 25 per page, paginator hidden for one page | E2E-M27-84 (P1 pager empty); only 10 pupils seeded, so a 2-page paginator could not be exercised | Auto | B (no data for page 2) |
| 25.4 read-only status badge, name link and "Edit" only when active | E2E-M27-84, QA-L56-2 | Auto | P |
| 25.5 empty row copy (P1) | E2E-M27-84, QA-L56-4 | Auto | P |
| 12.x scope: forged `school_id`, `schoolId`, `role` ignored | QA-ACC-3, QA-ACC-4 | Auto | P |
| 12.2 other roles get the 403 page (pupil, platform admin, teacher) | QA-ACC-1, QA-ACC-2, E2E-M27-36 | Auto | P |
| 14.4 no IC number, no leakage | QA-L56-2 | Auto | P |
| 14.5 loading skeleton, server error visible (not blank) | QA-L56-5 | Auto | P (inline `user-error`, see N-2) |
| 35.x CSV | see CSV table | Auto | P |

### S7 Senarai Guru (FR-M27-99 to 103, AC 28.x, 29.4/29.5)

| AC | Case | Where | Result |
|---|---|---|---|
| 28.1 header, card "Guru", buttons "Eksport CSV", "Cipta Pengguna" | E2E-M27-90 | Auto | P |
| 28.2/28.3 columns, "2 kelas", relative last login or "Belum login" | E2E-M27-90, QA-L57-1 | Auto | P |
| 28.4/28.5 filters and empty state (P1) | E2E-M27-91, QA-L56-4 | Auto | P |
| 29.4 "Aktif?" toggle with the exact confirm text; cancel does nothing | E2E-M27-94 | Auto | P |
| 29.5 deactivate then reactivate; inactive row loses link and Edit, impersonation disabled with title "Akaun ini tidak aktif", S10 gives 403 | E2E-M27-94, QA-S10-1, Expl | Auto, Expl | P |
| teachers only (no pupils or admin in table) | QA-L57-1 | Auto | P |

### S9 Edit Pelajar and S10 Edit Guru (FR-M27-94 to 98, 104 to 107)

| AC | Case | Where | Result |
|---|---|---|---|
| 27.1/29.1 profile card, fields, status line (S9 only), closed reset bar | E2E-M27-86, E2E-M27-92 | Auto | P |
| 27.2/29.2 save returns to list with flash "Pengguna berjaya dikemaskini."; persists in list and CSV | E2E-M27-87, E2E-M27-92, QA-S9-2 | Auto | P |
| 27.3 validation errors above form (empty name, used e-mail, 256-char name) | E2E-M27-87, QA-S9-1, Expl | Auto, Expl | P |
| 27.4 password reset: under 6 refused, mismatch refused, fields cleared, valid password lets the pupil sign in | E2E-M27-88, QA-S9-1 | Auto | P |
| 27.5 inactive account gives 403 | QA-S10-1 (teacher); no inactive pupil exists because pupils are read-only | Auto | P (S10) / B (S9, no way to make a pupil inactive) |
| 27.6/29.6 role, school, grade not editable; no select, no IC | E2E-M27-86, QA-S9-2 | Auto | P |
| FR-M27-43 foreign, unknown, wrong-role id gives 404 | E2E-M27-39, QA-ACC-5 | Auto | P |

### S11 Cipta Guru (FR-M27-108 to 110, AC 30.x)

| AC | Case | Where | Result |
|---|---|---|---|
| 30.2 copy, read-only role "Guru", locked school label, six fields | E2E-M27-95 | Auto | P |
| 30.3 create: flash "Pengguna berjaya didaftarkan.", listed active in S7, appears in CSV | E2E-M27-95, QA-S11-1 | Auto | P |
| 30.4 validation: required, password under 6, mismatch, duplicate e-mail (also different case) | QA-S11-1, Expl | Auto, Expl | P |
| 30.5 role and school pinned by the server | QA-S11-1 (own school, active) | Auto | P |

### S12 Tambah Pelajar (FR-M27-117, 118, 120, BR-M27-41, G1-9, AC 34.x)

| AC | Case | Where | Result |
|---|---|---|---|
| copy, locked school, "Kelas" options, hint, buttons | E2E-M27-100 | Auto | P |
| validation: required, name min 3, e-mail format, duplicate, password min 8 (7 refused), values kept | QA-S12-1, Expl | Auto, Expl | P |
| create with class: flash, one-time credential block, reload shows no password | E2E-M27-101, QA-S12-CRED | Auto | P |
| default password (empty field) of 8+ characters shown once; class enrolment visible in S6; pupil can sign in | QA-S12-2 | Auto | P |
| pupil created in the viewer's school (P1) and visible only there; P1 class list has only "Tiada kelas" | QA-S12-3 | Auto | P |
| foreign `classId` refused (422) | not reachable from the UI (select lists own classes only); relies on the owner's unit tests | - | B |

### "Eksport CSV" (FR-M27-119, BR-M27-40, AC 35.x)

| Check | Case | Result |
|---|---|---|
| file names `users-pelajar-yyyy-mm-dd.csv`, `users-guru-yyyy-mm-dd.csv` | E2E-M27-102, QA-CSV-1, Expl | P |
| BOM, columns `id,name,email,role,sekolah,kelas,is_active,created_at`, ordered by id | QA-CSV-1, Expl | P |
| own school only (also with forged `school_id`), P1 gets header-only file | QA-CSV-1, QA-CSV-2 | P |
| no phone, no IC | QA-CSV-1 | P |
| form values honoured without pressing "Cari" (status, search) | E2E-M27-102, QA-CSV-1 | P |
| injection guard (`=` name gets leading apostrophe), class names exported | QA-CSV-3, Expl | P |
| inactive teacher in export with is_active 0 | QA-S10-1 | P |

### Responsive matrix (mandatory; replaces Session 2 T8), executed per screen at 320 / 375 / 768 / 1280

Check per cell: no horizontal page scroll (3-sample check), every control inside the viewport, tap height at least 40 px for buttons below 1280, no overlap between controls, no text under 12 px, table card scrolls inside its own container. Test ids `QA-RESP-S6` to `QA-RESP-S12`, `QA-RESP-S12-CRED` (credential block, long name and e-mail); plus QA-L56-3 and QA-FORM-LAYOUT.

| Screen | 320 | 375 | 768 | 1280 |
|---|---|---|---|---|
| S6 `/admin-sekolah/pelajar` | P | P | P | P |
| S7 `/admin-sekolah/guru` | P | P | P | P |
| S9 `/admin-sekolah/pelajar/3001` | P | P | P | P |
| S10 `/admin-sekolah/guru/5` | P | P | P | P |
| S11 `/admin-sekolah/guru/baru` | P | P | P | P |
| S12 `/admin-sekolah/pelajar/baru` | P | P | P | P |
| S12 credential block | P | P | P | P |

Each responsive test loops all four widths inside one test, in all three Playwright projects. Observations: the user list table is wider than the card at 375 and 768 and scrolls inside its card (page does not scroll); the e-mail cell wraps mid-word at 375 (see N-3). Screenshot kept in the QA scratchpad (`qa-pelajar-375.png`, not in the repo).

Test-code note: in the first full run, three desktop cases (S10, S11, credential block) reported a first overflow sample of 38 to 82 px immediately after `setViewportSize` and 0 in the next samples. That was a layout-settle timing issue in my spec, not an app defect; I added a 600 ms settle after each resize and re-ran all seven responsive tests on desktop: 7 of 7 pass. The three project runs of the same tests at mobile and tablet passed in the full run.

### S8 Kelas Sekolah (roles-matrix L58; FR-M27-111 to 116, BR-M27-35, AC 31.x, 32.x; D26 G1-6 classroom only, PROPOSED)

Existing `partb-proposed.spec.ts` (E2E-M27-96, 97) and `partb-class-link.spec.ts` were re-run together with my cases.

| AC | Case | Where | Result |
|---|---|---|---|
| 31.1 tile "Kelas Aktif" equals the S0 card; "{n} kelas dipaparkan" | E2E-M27-96, QA-S8-3, QA-S8-4 | Auto, Expl | P |
| 31.2 columns `#, Kelas, Subjek, Tingkatan, Guru, Murid, Kod Kelas`; cell formats; rows of classes 2001 and 2002 ("5 MARIKH - Kimia", "5 MARIKH - Sejarah", Tingkatan 5, Guru Demo, 8 pupils) | E2E-M27-96, QA-S8-8, Expl | Auto, Expl | P |
| 31.3 `classroom` rows only: `school_class` 419 and 806 appear on no list | E2E-M27-97, QA-S8-4 | Auto | P |
| 31.4 empty state for school 900003: "0 kelas dipaparkan", tile 0, "Tiada kelas dijumpai" / "Sila cipta kelas terlebih dahulu" | E2E-M27-97, QA-S8-5 | Auto | P |
| 31.5 no class of another school; forged `school`, `school_id`, `schoolId`, `role` ignored; P1 with `school_id=900001` sees nothing | E2E-M27-97, QA-S8-4, QA-S8-5 | Auto | P |
| 32.1 level filter shows only the school's levels, narrows rows, unknown level falls back to all; search is case-insensitive on class name; miss shows the empty row; tile ignores filters; order A to Z; row numbers 1..n | E2E-M27-98 range, QA-S8-6, QA-S8-7, QA-S8-8 | Auto | P |
| 32.2 25 per page, paginator | no school with more than 25 classes exists in the seed | - | B |
| 32.3 class name opens `/prestasi/kelas/{id}` (2001 opens "5 MARIKH - Kimia - Dashboard Kelas"); a class of another school is refused | QA-S8-9, partb-class-link (own class opens, foreign class 366 refused), Expl | Auto, Expl | P |
| 13.x header, tab title "Kelas Sekolah - PRESTASIPLUS", breadcrumb "← Dashboard Sekolah", sidebar item "Kelas Sekolah" active and "Dashboard" not | QA-S8-3 | Auto | P |
| 12.2 teacher, pupil, platform admin get the 403 page | QA-S8-1 (three roles) | Auto | P |
| 14.4 no IC or pupil e-mail on the page; read-only (no buttons); text at least 12px | QA-S8-11 | Auto | P |
| 14.5 loading spinner while the call is slow; a server error shows the inline `kl-error` block | QA-S8-10 | Auto | P (see N-2) |

Responsive row for S8 (test `QA-RESP-S8`, same checks as the other screens, plus tap height of the level select, search box and class link):

| Screen | 320 | 375 | 768 | 1280 |
|---|---|---|---|---|
| S8 `/admin-sekolah/kelas` | P | P | P | P |

Observation N-5 (Low, info, already tracked as OQ-M27-26): S8 shows each class's join code ("Kod Kelas", for example DMO101). This is what the SRS specifies for the school admin; recorded only so the open question is not lost.

S8 commands: after the first S8 run two of my cases failed for test-code reasons only (a count-line regex that did not allow trailing whitespace, and a latency hook set before the app had booted; both fixed in the spec). Final S8 run on HEAD `d023c1b` (includes `c5e1a7f`), `playwright test -c playwright.5140.config.mjs qa-l56-l58 partb-proposed partb-class-link -g "S8|E2E-M27-9[6-9]|class" --workers=1`: 56 passed, 16 skipped (desktop-only cases on mobile and tablet), 0 failed.

## Bugs

No Critical, High or Medium defects were found. Observations for the owner (none blocks the gate):

| ID | Severity | Where | Steps and observation | Expected vs actual | Suggested owner |
|---|---|---|---|---|---|
| N-1 | Low (info) | S9 to S12 forms | Open any form with a password field: Chrome logs "Input elements should have autocomplete attributes" (verbose, not an error). | Per D10 accessibility replicates live, so no change needed unless live has it; recorded only. | frontend-developer |
| N-2 | Low (verify) | S6, S7 | `failNext` 500 on the list call shows the inline block `user-error`. FR-M27-48 says a server error shows "the M01 global error page; no M27 copy". | Inline error block with the API message (visible, not blank) vs global error page. Confirm which the SRS intends; the SRS as-built text may already accept the inline block. | frontend-developer / product-analyst |
| N-3 | Low (cosmetic) | S6 at 375 | E-mail text in the table wraps mid-word ("...@demo.tes / t"). | Table scrolls in its card, so nothing is lost; optional `whitespace-nowrap` for the e-mail cell. Screenshot QA scratchpad `qa-pelajar-375.png`. | frontend-developer |
| N-4 | Low (info) | CSV | `created_at` of records created at run time includes milliseconds (`2026-10-10T10:03:34.738+08:00`), seeded rows do not. BR-M27-40 says "ISO with +08:00", so both are valid. | No change needed. | backend-developer |
| N-5 | Low (info) | S8 | Class "Kod Kelas" (join code) is shown to the school admin as specified; tracked as OQ-M27-26. | Recorded only. | product-analyst |

Privacy: only fictitious names (Murid Demo nn, Guru Demo, Pentadbir Sekolah Demo) were observed on the pages and in the CSV; no IC numbers and no phone numbers in the CSV.

## Commands and counts

- Pre-run: `npx playwright test -c playwright.5140.config.mjs partb-users --workers=1` gave 42 passed, 18 skipped (desktop-only cases on mobile and tablet), 0 failed. My spec's first run gave 36 passed, 32 skipped, 1 failed (test bug: password fields are cleared after a refused submit, fixed in the spec).
- Official run on HEAD 242aa56 (includes c5e1a7f), same config, `E2E_BOOT_TIMEOUT_MS=90000`, `--workers=1`: `partb-users` and `qa-l56-l58` together gave 97 passed, 50 skipped, 3 failed (the three timing artefacts above). Re-run of the seven `QA-RESP` cases with `--project=desktop`: 7 passed, 0 failed. Net: no failing assertion against the application.
- `npx eslint e2e/m27-school-admin/qa-l56-l58.spec.ts`: clean. `npx tsc --noEmit -p tsconfig.e2e.json`: 0 errors in my file.
- Exploratory: Playwright lane 3 against `http://localhost:5140` (not live): S6 to S12 at 320 / 375 / 768 / 1280, create / edit / deactivate / CSV, console had only a favicon 404 (preview server) and the verbose autocomplete hint (N-1).
- Not run: unit/integration suites of the module (not requested in this brief; owner's G3 evidence).

## Verdict

**Ready for S6, S7, S8, S9, S10, S11, S12 and the "Eksport CSV" on S6 and S7 (roles-matrix rows L56, L57, L58).** Every executed AC passes, the responsive matrix passes at 320 / 375 / 768 / 1280 on all seven screens, and there is no open Critical, High or Medium bug. Open items are Low observations only (N-1 to N-5).

Items marked Blocked cannot be reached with the seeded data or from the UI, and are covered only by the owner's unit tests; they do not block release: second page of the S6/S7/S8 paginator (no school with more than 25 rows), S9 403 for an inactive pupil (pupils are read-only), foreign `classId` 422 on S12.

Test-suite status: the S6, S7, S9 to S12 and CSV runs were on HEAD `242aa56`; the S8 run was on HEAD `d023c1b`. Both include Session 2 bundle `c5e1a7f`. Application code under `src/` was unchanged between those runs apart from what Session 2 had already committed (`git diff HEAD -- src` was empty at each build).

Spec: `e2e/m27-school-admin/qa-l56-l58.spec.ts` (uncommitted, untracked; Session 2 or the lead should commit it with this report). Screenshots are kept outside the repo in the QA scratchpad (`.playwright-mcp/` is gitignored anyway).
