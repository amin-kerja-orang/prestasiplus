# R1 regression on BASE-93, 2026-11-01 (team C standing in for lane B4, cycle 22)

Completes B4's cycle-22 run ("full regression on BASE-93 d4a89143, official full run still after T36"). Written by team C QA on branch `r1/c-qa-base93`. Team B files (status/B4.md, MERGE-LOG.md, BOARD.md) were not touched. Method = B4's: `e2e/api/r1-e2e-baseline.spec.ts` + `playwright.r1-e2e.config.ts`, copied unchanged from `origin/r1/t23-e2e` @ d61f98bd5 (B4's branch; only these two test/config files were taken).

**Verdict: Not ready** (unchanged from B4's last verdict). No new regression from BASE-90..93 in the flow B4 tests; two new defects in the admin screens that BASE-92 (REQ-C-009/010) touched; the old blockers R1E2E-13/-23 (K1 paper cannot be completed in the picker), -17, -10 and T10 (Set Builder, `/admin/studio/sets`) remain open.

## Environment (and differences vs B4)

| Item | Value |
|---|---|
| BASE | `feature/v3-bijak-r1` @ **`d4a89143c620dc0038908dc0d4eb79c0823eb6bd`** (BASE-93). Branch `r1/c-qa-base93` = BASE-93 + B4's spec/config + this report. |
| Since B4's last run (BASE-89 f4b28a26) | BASE-90 REQ-B-013/014b/c, BASE-91 REQ-B-026, BASE-92 REQ-C-009/010/013 (+ D72 spec fixes), BASE-93 H-A9 chain. 46 migrations (to 0103), same as B4. |
| Database | **Local Postgres 16** `127.0.0.1:55432` (not Docker `postgres:16-alpine` :55444). Migrations applied in name order, seeds `poc` then `e2e` (`E2E_SEED=1`, `ALLOW_DEMO_SEED=1`), snapshot DB cloned fresh per run. |
| Stack | API `node dist/main.js` :3020 (`BIJAK_POC_QUESTIONS=false`, `THROTTLE_GLOBAL_PER_MINUTE=5000`, **`JOBS_WORKER_ENABLED=true`**), SPA `VITE_API_MODE=http` built `--mode demo`, `vite preview` :5320 proxying `/api`. |
| Browser | Playwright Chromium (preinstalled), headless, 375x812 / 768x1024 touch, 1280x800; 1 worker; `E2E_BOOT_TIMEOUT_MS=60000`. |
| Differences that matter | (1) Local PG default timezone is Asia/Singapore, Docker's is UTC: 20 DB-spec failures were only this; reruns used `PGOPTIONS="-c timezone=UTC"`. (2) Local PG uses `trust` auth (a wrong-password spec connects). (3) Prisma engine download is blocked here (403) and `prisma generate` uses a stub engine, so `migrate-cli.spec.ts` cannot run. (4) Machine shared with 3 agents: FE unit sweep took 1414 s vs B4's 286 s; a heavy overlap crashed the browser page twice (see E2E). |
| Harness note for B4's doc | The API must run with `JOBS_WORKER_ENABLED=true` or PDF intake (S1c) never leaves "queued" (jobs table, no worker). My first run lacked it and was discarded. A clean checkout needs `vite build` before `vue-tsc` (auto-imports.d.ts), as `.github/workflows/frontend.yml` says. |

## 1. Gates

| Gate | Result |
|---|---|
| `apps/api` `npx tsc --noEmit` | exit 0 (90 s) |
| `vue-tsc -b --noEmit` (app) | exit 0 after the Vite build (150 s). Without the build: 34 errors, all `useToast`/implicit-any from the missing git-ignored `auto-imports.d.ts`/`components.d.ts` (documented CI order, not a defect). One run was OOM-killed (exit 137) under shared load and repeated. |
| `packages/contract` `emit-openapi.ts --check` | ok, openapi.json up to date |

## 2. Frontend + packages unit sweep (`vitest --project unit`)

| Set | Files | Tests | Result |
|---|---|---|---|
| B4's set (registry-boot + m01/02/03/04/05/08/09/16/27) | 277 | 4279 passed / 0 failed / 2 skipped / 1 todo | **Identical to B4 cycle 20 (BASE-89: 277 / 4279 / 0 / 2 / 1).** No regression. |
| Not in B4's set: m28-bijak-spm, m06, m07, m10-m15, m17, m18, m20-m22, m25, `packages` (contract-tests, exam-core) | 259 | 4510 passed / **7 failed** / 3 expected-fail / 1 skipped / 8 todo | 7 failures, all in `m10-teacher-class` (below). |

m10 failures (3 files, mock data/handler assertions): `dashboard/GuruDashboardPage.test.ts` (admin stat cards), `mock/classrooms-store.test.ts` (2: "first 750-record build byte-identical", "anchors and owners"), `mock/guru-handlers.test.ts` (4: contributions 9533 vs 16817, page-2 totals, CSV import 7 vs 10, teacher cards 977 vs 969). **Pre-existing:** the same 7 fail at BASE-89 f4b28a26 (run in a throwaway worktree, identical test list). B4's set never included m10, which is why it was not seen. Likely tied to the D72 hidden-primary-school change (2026-10-29); owner: C (m10) / A (mock data).

## 3. DB sweep (`apps/api vitest run`, 671 files in 4 chunks, `maxWorkers=2`)

| Chunk (folders) | Files | Tests | First run | After rerun alone |
|---|---|---|---|---|
| c1: auth, account, users, schools | 53 | 579 | 8 failed (4 files) | session.spec (6) + hardening.spec (1) pass under UTC PG; remaining 2: `users/parent-links`, `schools/unique-backstop` (stale, below) |
| c2: questions, questions-workflow, intake-workflow, intake-files, intake-dashboard | 123 | 1217 (18 failed, 4 files) | 18 failed | **55/55 pass** under UTC PG (all 18 were the timezone) |
| c3: migration, reports, school-admin | 153 (2 skipped) | 2314 | 1 failed | `migration/anonymise/pg-source.spec` still fails: wrong-password connection succeeds (PG `trust`), environment |
| c4: all other folders + `test/*.spec.ts` | 342 | 5294 | 12 failed (7 files) | all 8 files (incl. pg-source) fail again alone, 13 tests |

Totals: 671 files, 9404 tests. Under a Docker-equivalent Postgres (UTC, password auth) the only real failures are the stale specs below. Every non-environment failure was **also run at BASE-89 and fails identically** (17 test entries, empty diff), so none comes from BASE-90..93.

| File | Error | Class |
|---|---|---|
| `users/parent-links.spec.ts` | creates a student with `grade: 3` -> 422 "The selected grade is invalid." | Stale spec: secondary-only rule (grade < 7 refused, 2026-10-29). Pre-existing. Owner A (spec). |
| `subscriptions/parents-links.spec.ts`, `parents-visibility.spec.ts` | ZodError on fixtures | Same family (not diagnosed further). Pre-existing. |
| `schools/unique-backstop.spec.ts` (update) | PUT of school `DEMO003` -> 404 instead of 422 | Stale: DEMO003 is a primary school, hidden since D72. Pre-existing. |
| `command-center/guru.spec.ts` (1), `shared.spec.ts` (4) | counts off (40 vs 46 answers, 3 vs 4, ...) | Stale seeded-world fixtures vs hidden schools. Pre-existing. |
| `content/articles.spec.ts` (190,000-char body) | 422 instead of 201 | Not diagnosed. Pre-existing. |
| `security/audit-coverage.spec.ts` (2) | "Soalan belum memenuhi syarat untuk diterbitkan." on publish | Fixture does not pass the current approve/publish gate. Pre-existing. |
| `db/migrate-cli.spec.ts` (4) | prisma schema-engine download 403 | Environment (blocked network). |
| `migration/anonymise/pg-source.spec.ts` (1) | wrong password accepted | Environment (`trust` auth). |

## 4. E2E, B4's T23 flow on the HTTP stack, 375 / 768 / 1280

43 tests per viewport (B4's BASE-79 run had 40; new S1j, S2h, S4f). Seed-only sanity (S0 + B-01, fresh DB): **6/6 pass**.

Full run (all three viewports, one run): 95 pass / 17 fail / 17 skip of 129. Tablet and desktop were clean (below). **Mobile had two browser page crashes** ("Target crashed" in S2b and, cascading, S4b) while my DB sweep ran at the same time and free RAM was about 1 GB. That is an environment artefact, so the **whole mobile project was rerun alone on a fresh DB** with nothing else running.

| Viewport | Pass | Fail | Skip |
|---|---|---|---|
| mobile 375 (clean rerun) | 33 | 5 | 5 |
| tablet 768 | 33 | 5 | 5 |
| desktop 1280 | 33 | 5 | 5 |

Compared with B4 BASE-79 (30/5/5 of 40): same 5 failing steps and same 5 skips, +3 passing steps. **No horizontal page scroll** at any width on any visited screen (the spec asserts it); an extra probe of Senarai Ekstrak, Studio, Bank Soalan SPM and the Kandungan hub at 375/768/1280 also showed 0 px overflow, no console errors, no 4xx/5xx on `/api`.

| Step | Result at 375/768/1280 | Reason observed | Known as |
|---|---|---|---|
| S1h | Fail x3 | SP "1.1" (not a real SP) accepted by the server gate, no banner | R1E2E-17 (and -03 unverifiable) |
| S2e | Fail x3 | bulk Terbitkan on approved row: "Peralihan 'Diterbitkan' -> 'Diterbitkan' tidak dibenarkan." | R1E2E-10 |
| S3a | Fail x3 | `/admin/studio/sets` renders "Halaman Tidak Dijumpai" | T10 (Set Builder not merged) |
| S3c, S3d | Fail x3 | Terbit refused: "Bahagian A: Kurang 35 soalan (perlu 40, ada 5)"; picker offers 0 bank candidates beyond the run's own | R1E2E-13/-23 |
| S2g, S2c, S2d, S5d | Skip | workaround not needed (S2a approves in the UI) / BASE-1 interim steps | as B4 |
| B-02 | Skip (Blocked) | no Sains Kertas 2 on the hub (PoC papers gone); self-mark covered by S4b | as B4 |

Pass highlights (observed): S1c PDF intake (2 cards, 1 passage group, 0 reloads), S2b Terima (Draf) 2/2, S2a "Hantar untuk Semakan" 9/9 and Terbitkan: approved via UI PDF 2/2, Studio 3/3, form 2/2 (CSV 0/2 untagged, by design); S5a-c counts rise 60->63 / Bab 10->15; S5e Latih Tubi 40 answered; S3f/S3g API-assisted pool fill then UI Terbitkan ok; S4a/S4a2 pupil sits K1 paper (Mula 201, pictures shown, 0 broken, 0 `data:`), S4c, S4d Cuba Lagi 201, S4e; S4b written paper sat, shared passage once per member, self-mark 200 (2->3/100); **S4f seeded K2 fixture: Mula 201, 15 screens, 4/100 -> self-mark 200 -> 5/100 after reload**; S6 Jana 3472/2 = 422 SHORTAGE (expected, fixed paper); S1i/S1j Studio list and "Bank Soalan (Studio)" menu entry; B-01, B-04 (Kuiz 20 questions), B-05.

### Status of R1E2E items on BASE-93

| ID | Status | Evidence |
|---|---|---|
| R1E2E-12, -20, -21, B-04, -13 (K2 side) | Fixed, confirmed | S2a 9/9, S2h pass, S1j pass, B-04 pass, S4f pass |
| R1E2E-17, -10, -23 (-13 K1 side), T10 | Open, unchanged | table above |
| R1E2E-03 | Still unverifiable | blocked by -17 |
| R1E2E-14 | Fixed for a pupil with no history | pupil hub (API) lists 5 bank/e2e papers, no PoC paper |
| R1E2E-16 | Open, unchanged | `GET /api/admin/servability/overview` simulasi_paper served 72 / total 97 / **attention 25**; `lanes/bijak-spm` 9 papers, every `attentionCount` 0 (PoC papers 1-4 still "published" in the lane) |
| R1E2E-09 | Open, unchanged | S5c: Matematik tile "63 soalan chapter" while the chapter total is 15 |
| R1E2E-07 | Unchanged (not separately probed) | S3e publish ok:true on 1449/2 with only quota "notes" |
| R1E2E-11, -18, -19, -22 | Not re-checked | not asserted by the spec |

## 5. New defects

### R1E2E-C1 (Medium, owner C: FE m28 intake wire) - Senarai Ekstrak ignores the REQ-C-009 counts and status
- Steps: Admin Pusat -> `/admin/spm/soalan/ekstrak` after a PDF batch was extracted, reviewed and submitted (S1c; 2 items accepted).
- Expected: columns "Bilangan Soalan" and "Disemak" show 2 and 2; status shows the review state ("Sedia untuk semakan").
- Actual: the row shows **0**, **-** and status **"Draf"**. `GET /api/intake/batches` returns `itemCount: 2, reviewedCount: 2, status: "ready_for_review"` for the same batch (verified in the browser's own network call and the DB), so the API is right and the page drops it. In `src/modules/m28-bijak-spm/server/intake-wire.ts` the list mapper hardcodes `questionCount: 0` (line ~114) and takes `status` from `statusFromWire()` instead of the wire.
- Severity Medium: wrong data in an admin list that REQ-C-009 was meant to fix; not a layout problem. Evidence `docs/qa/r1-regression-base93-teamc/probe/desktop-intake-list.jpg` (+ mobile/tablet). Probe: `/home/claude/scratch/qa93/probe-list.cjs`.

### R1E2E-C2 (Low, owner C, confirm against V2) - Studio list columns "No." and "Kertas" do not show the REQ-C-010 fields
- Steps: Admin Pusat -> `/admin/studio` (Bank Soalan (Studio)).
- Expected (REQ-C-010: rows carry `kertas` and `numberLabel`): "No." shows the question number label, "Kertas" shows the paper (e.g. Kertas 1/2).
- Actual: "No." shows the database id (1310, 1309, ...), "Kertas" shows "Matematik . Tingkatan 4". Status chips and stat cards read "Approved / Draft / Reviewed / Archived" in English in an otherwise BM screen. Evidence `probe/desktop-studio-list.jpg`.
- Not verified at the API for this list; confirm the intended V2 columns before fixing.

No Critical or High defect found in BASE-90..93. Nothing new in the pupil flow, and no responsive break.

## 6. Not run / limits

- `db/migrate-cli.spec.ts`: Prisma engine cannot be downloaded here (403); needs a Docker/CI run.
- The DB sweep ran on a local trust-auth Postgres in UTC for the reruns; the first-run timezone failures are listed above, not hidden.
- Not asserted by the spec and not re-tested: R1E2E-11, -18, -19, -22. R1E2E-03 cannot be provoked while -17 is open.
- The PoC path (`BIJAK_POC_QUESTIONS=true`) was not exercised (same lane rule as B4).
- Nothing deployed, migrated or seeded on any remote server.

Evidence: `docs/qa/r1-regression-base93-teamc/` (screenshots per viewport from the full run, `seed-only/`, `mobile-rerun/`, `probe/`). Raw outputs kept in `/home/claude/scratch/qa93/` and `/tmp/qa-*.txt`.
