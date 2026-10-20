# Bijak SPM - go/no-go run script (UAT 22:00, decision 23:00)

Follow top to bottom. Detailed rows live in `docs/qa/bijak-uat.md` (IDs `UAT-A-xx`, `UAT-B-xx`, `UAT-C-xx`); they are referenced here, not repeated. Criteria below are proposed; the lead decides. Nothing here was executed by the author.

## 0. Header

| Item | Value |
|---|---|
| Date / tester / lead | ____ / ____ / ____ |
| Integration SHA | ______________ (be/e2e-bijak was at 521903df when this was written) |
| Pages URL (real deploy path, `/api` proxy) | ______________ |
| Render URL (API direct) | ______________ |
| Accounts (role only; passwords come from the lead at GO, never written here) | Murid (`pelajar`), Guru (`guru`), Admin Sekolah (`admin_sekolah`), Admin Pusat (`admin@demo.test`) |

## 1. Smoke twice (about 10 s each, no browser)

Each run WRITES real data: one student attempt, started and submitted. Login is throttled at 5 per minute, so run each smoke once, do not loop. A user forced to change password gets 403 at login: change it first or use another account.

| Run | Command | Expected | FAIL means |
|---|---|---|---|
| (i) Render direct | `BASE_URL=<Render URL> BIJAK_STUDENT_USER=<pelajar> BIJAK_STUDENT_PASS=<pass> npm run smoke:bijak` | Eight lines `PASS health`, `PASS login`, `PASS list-papers`, `PASS start-attempt`, `PASS autosave`, `PASS read-back`, `PASS submit`, `PASS result` (each with ms), then `SMOKE PASS`, exit 0. | `FAIL <step>: <status> <reason>` then `SMOKE FAIL (n/8 passed)`, exit 1; the API itself is broken at that step. Exit 2 = missing env. |
| (ii) Pages | Same with `BASE_URL=<Pages URL>` | Same output. This proves the deploy path: `/api` proxy, `pp_session` cookie and the CSRF token (`X-CSRF-Token`). | Passes on Render but fails on Pages = proxy, cookie or CSRF problem (deploy config), not the API. |

Options: `SMOKE_HEALTH_PATH=/healthz` when nginx serves health there (default `/api/health`); `SMOKE_LOGIN_PATH` (default `/api/auth/login`); `BIJAK_SCHOOL_ID` for a username present in several schools; `BIJAK_PAPER_ID` to pick a paper (default: first published); `SMOKE_MODE=exam` (default `latihan`); `SMOKE_TIMEOUT_MS` (default 10000).
A FAIL at `login` with 429 = throttle (wait 1 minute); with 403 = forced password change; `list-papers` FAIL "no published paper" = nothing is published on the target.

## 2. Automated e2e in http mode

```
BIJAK_API_BASE=<Pages URL> \
BIJAK_STUDENT_USER=.. BIJAK_STUDENT_PASS=.. \
BIJAK_ADMIN_SEKOLAH_USER=.. BIJAK_ADMIN_SEKOLAH_PASS=.. \
BIJAK_GURU_USER=.. BIJAK_GURU_PASS=.. \
BIJAK_ADMIN_PUSAT_USER=.. BIJAK_ADMIN_PUSAT_PASS=.. \
npx playwright test -c playwright.bijak.config.mjs --grep @bijak --workers=1
```

Add `E2E_BOOT_TIMEOUT_MS=60000` on a busy machine. Projects run at 375, 768 and 1280. `student-http` writes one attempt and `admin-publish-http` writes data (it cleans up after itself).

| Spec (http mode) | Objective | Expected |
|---|---|---|
| `http-autosave.spec.ts` | (a) autosave | PASS: answer sends `PUT /api/bijak/attempts/:id/answers` (2xx) and survives a reload. |
| `student-http.spec.ts` | (a) | PASS: login, hub, cover, Mula, answer, server-side resume after reload, Hantar, result, history. |
| `us33-http.spec.ts` | (b) | PASS: school dashboard badge and Guru class view show "Keputusan Bijak SPM" with figures or "Tiada data". Skips if the school-admin or guru credentials are missing (a skip is not a pass). |
| `admin-publish-http.spec.ts` | (c) | 1 real test (login, menu offers Pembina Kertas at `/admin/spm/kertas`) PASS; the other 3 stay `fixme` (skipped) until B4 (create and full publish need PoC questions). Needs confirmation: another agent may un-fixme the list test now that B3 landed. |

Read the result: expected is 0 failed. Every `skipped` must be explained by a fixme or a missing credential, never silently. A failure on one size only is a responsive bug (High). A failure on all sizes at login or at a `/api/bijak/...` wait points at the API or deploy (compare with Step 1). Specs that only run in mock mode (`student`, `teacher`, `admin-mod-pelajar`, ...) are skipped in http mode.

Optional artifact check (mock build of the integration commit, not the deployed URL): `bash scripts/bijak-regression.sh <sha>`. Expected: 0 failed at 375/768/1280; the fixme count equals the known Blocked items.

## 3. Manual UAT matrix

Tick the box when every listed row passes at that size; run the rows from `bijak-uat.md`. Use the Pages URL (http mode) unless noted.

| Objective | Role | Rows | Pass criterion (one line) | 375 | 768 | 1280 |
|---|---|---|---|---|---|---|
| (a) Student journey | Murid | A-01 to A-03, A-05 to A-10, A-12 to A-20, A-24, A-27 | Hub, cover, answer incl. Rajah group and maths keyboard, "Disimpan" after reload, Hantar, result, history all work with no horizontal scroll. | [ ] | [ ] | [ ] |
| (a) optional | Murid | A-04, A-11, A-21 to A-23, A-25, A-26 | Edge cases (empty state, resume, Mod Latihan, timer, offline); lead may accept Not run. | [ ] | [ ] | [ ] |
| (b) Teacher/school see results | Guru | B-01 to B-04 | `/spm/bijak`, a paper cover and `/spm/bijak/sejarah` give the in-place 403; no Bijak entry in the Guru menu. | [ ] | [ ] | [ ] |
| (b) | Guru | B-06 | HTTP only: `/prestasi/kelas/228` and a pupil's Prestasi 360 show the "Keputusan Bijak SPM" label, figures OR "Tiada data", never both. | [ ] | [ ] | [ ] |
| (b) | Admin Sekolah | B-05, B-09 | `/spm/bijak` is 403; `/admin-sekolah` panel "Ringkasan Prestasi" shows the badge "Keputusan Bijak SPM", figures OR "Tiada data". | [ ] | [ ] | [ ] |
| (b) | Admin Pusat | B-11 to B-14 | "Masuk Mod Pelajar" -> attempt -> result -> history -> "Keluar Mod Pelajar" returns to the admin portal. Mock-tested; run on http if the account allows. | [ ] | [ ] | [ ] |
| (b) known gaps | Guru, Admin Sekolah, Admin Pusat | B-07, B-08, B-10, B-15, B-16 | **Blocked (known, accepted)**: no Analitik/Analisa Item/Monitoring view, no per-attempt drill-down, no Admin Pusat analytics (B-07, B-08, B-10); Mod Pelajar for Admin Sekolah (B-15) and the test-data flag (B-16) not built. | n/a | n/a | n/a |
| (c) Pembina Kertas, mandatory (http) | Admin Pusat | C-01, C-02, C-20 (+ C-17, C-19) | `/admin/spm/kertas` renders its list (rows or "Belum ada kertas"), and "Buka" on a ready-to-publish paper renders the editor with no error panel. Guru/Murid are refused (C-17). | [ ] | [ ] | [ ] |
| (c) create + publish | Admin Pusat | C-03 to C-09, C-12 to C-15 | **Blocked-on-B4** (accepted, not a NO-GO): without PoC questions the builder cannot reach a publishable paper. Run on the mock build if a demo is wanted. | n/a | n/a | n/a |
| (c) known gaps | Admin Pusat | C-11, C-16 | **Blocked (known, accepted)**: paper-level key re-check at "Terbitkan"; "Salin untuk sunting". | n/a | n/a | n/a |

Objective (c), demo path: Pembina Kertas (`/admin/spm/kertas` list, `/admin/spm/kertas/baharu` create, then editor / save / check / publish). B3 landed (commit 003cff0b): the admin http client is wired to BE-39, so the list and the editor are read paths that should render once deployed. Creating a paper and publishing it need B4 (PoC questions in the builder); until then publish is refused for a shortage of questions (BE-39 contract copy "{Bahagian}: Kurang N soalan (perlu X, ada Y)"; check only that it contains "Kurang"). That is Blocked-on-B4, not a NO-GO. Needs confirmation: B4 status at UAT time.

**Known limitations (not blockers; post-demo follow-up):** Bank Soalan SPM (`/admin/spm/soalan`), Baris Gilir Semakan (`/admin/spm/semakan`) and the intake pages (`/admin/spm/soalan/muat-naik`, `/ekstrak`, `/manual`) are out of scope for the demo. In http mode their methods reject with "Fungsi ini belum tersedia." and the pages should show a graceful error. One check only (UAT-C-21): the page shows the graceful state and does not crash. They are not part of the go/no-go rows.

## 4. Go/no-go decision (proposed; the lead decides)

| Condition | GO needs |
|---|---|
| Step 1 | Both smokes `SMOKE PASS`, exit 0. |
| Step 2 | `http-autosave` and `student-http` PASS at 375/768/1280; `us33-http` PASS (not skipped); `admin-publish-http` 1 real test PASS, rest only fixme. |
| Step 3 (a) | All required (a) rows Pass at all 3 sizes. |
| Step 3 (b) | Built rows (B-01 to B-06, B-09, B-11 to B-14) Pass; label/figures rule holds; Blocked rows accepted. |
| Step 3 (c) | In http mode the Pembina Kertas list (C-01, C-02) and the editor of a ready-to-publish paper (C-20) render and Pass at all 3 sizes. Create and full publish (C-03 to C-09, C-12 to C-15) are Blocked-on-B4: accepted. If B4 has landed, those rows must Pass in http mode. Known limitations (C-21) show a graceful state. |
| Defects | No open Critical or High (any layout break at a width is High; no lost answer; no mark scheme visible before Hantar in exam mode). |

NO-GO if any of: a smoke FAILs (Render ok but Pages fails = deploy blocker); an http e2e spec fails or skips without a known reason; any (a) row fails; figures and "Tiada data" shown together, or the label missing in http mode; the Guru can open a Bijak route; an unbuilt gate lets a paper publish without a mark scheme; the Pembina Kertas list or editor fails to render in http mode, or B4 has landed and create/publish fails, or an out-of-scope screen (Bank, Baris Gilir Semakan, intake) crashes instead of showing the graceful state; a Pass is claimed for a Blocked row.

## 5. Results log

| Time | Step | Result (Pass/Fail/Blocked) | Notes | Evidence (screenshot/log path) |
|---|---|---|---|---|
| | 1(i) smoke Render | | | |
| | 1(ii) smoke Pages | | | |
| | 2 e2e http | | | |
| | 2 regression (optional) | | | |
| | 3 (a) 375 / 768 / 1280 | | | |
| | 3 (b) | | | |
| | 3 (c) | | | |
| | Decision | | | |
