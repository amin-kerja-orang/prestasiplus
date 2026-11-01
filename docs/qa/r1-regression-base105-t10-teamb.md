# R1 E2E regression on a TRIAL tree: BASE-105 + T10 (team B, lane B4)

Date 2026-11-02. **Trial tree, not a released base.** T10 (`r1/f08-builder-ui`) is NOT merged into `feature/v3-bijak-r1`. This run answers one question: does T10 close S3a (`/admin/studio/sets` 404) and R1E2E-C5 (S3c, S3d, S3f, S3g)?

Tree (branch `r1/b4-e2e-base105-t10`, local only, not pushed):

| Part | SHA |
|---|---|
| E2E script `r1/t23-e2e-c` | c8f5b25dd |
| BASE-105 | 7ea2208c1 (merge 9bb42a899, clean) |
| T10 `r1/f08-builder-ui` | bf78ca930 (merge 50a376e2d, one conflict, below) |
| Harness cherry-pick from BASE-102 run (`r1/b4-e2e-base102` @ 2ddb1ba61, spec file only) | 12ea4c17c (applied cleanly, no conflict) |
| Graded runs ran at | 12ea4c17c |
| Diagnostic switches added after the graded runs | the commit after 12ea4c17c (spec only, default off) |

Merge conflict (stated): `e2e/bijak/admin-publish-http.spec.ts`. c8f5b25dd added an API-assisted override with `TODO(T10)`; T10 added a `confirm-ok` click after Terbitkan. Resolved by taking the T10 UI path as the TODO asked: if the plain Terbitkan is disabled, assert the reason text `belum Disahkan`, tick the override, fill a reason, press "Terbitkan walaupun...", confirm; else plain Terbitkan then confirm. The now-unused `publishPaperWithOverride` import was removed from that file. No other conflict.

Stack (local only, nothing on any server): own Postgres 16 container `b4-e2e-105-pg` on 55475 (UTC, removed afterwards), migrations applied, seeds `poc` then `e2e`, a fresh DB per width and per spec, API `dist/main.js` on 3475 with `JOBS_WORKER_ENABLED=true`, SPA built `VITE_API_MODE=http --mode demo` served by `vite preview` on 5475, 1 worker, Node 22.23.4, Playwright CLI, Chromium headless shell. The API and preview processes were stopped by PID after each run; `vite preview` on 5244 and container `b4-r1e2e-pg` were not touched.

Throttle env: **yes, raised** for every run (global, admin read/write, login, questions write, builder read/write, servability, Bijak attempt/check, practice, account, public: all set high through env only). Not tested with default throttles this time.

## 1. Verdict: Not ready (this trial tree)

- S3a is fixed by T10 (Set Builder route exists, passes at all widths).
- R1E2E-C5 is fixed in the product: the T10 editor shows the reason "Kontrak Simulasi 1449/1 (versi 2) belum Disahkan ..." up front, under the budget line, with the override tick. But the graded spec still expects the pre-T10 flow (click a plain Terbitkan, then read the refusal), so S3c, S3d, S3f, S3g still fail in the graded run. They pass in the diagnostic run that follows the T10 UI path. The spec needs a T10 update (owner B4, harness).
- Still failing, not fixed: S1h (R1E2E-17, team A), S2e (R1E2E-10, team A).
- New: S1b fails (menu change from T10 / R1-F09, below).
- `admin-publish-http` fails its only write test at all widths (18 of 40 questions available in the picker on a fresh seed).
- No layout break found: `expectNoHScroll` passed on every visited screen at 375, 768 and 1280, including the T10 editor and Set Builder screens the spec visits.

## 2. Spec `r1-e2e-baseline` (43 steps per width), graded run, spec at 12ea4c17c, unmodified

| Width | Pass / Fail / Skip | Failing steps |
|---|---|---|
| 1280 desktop | 29 / 7 / 7 | S1b, S1h, S2e, S3c, S3f, S3d, S3g |
| 768 tablet | 29 / 7 / 7 | same |
| 375 mobile | 29 / 7 / 7 | same |

Skips (same at all widths): S2g, S2c, S2d, S5d (not needed by design), B-02 (known), S4a and S4a2 (blocked by S3c/S3d).

Same counts as BASE-102 (29 / 7 / 7) but a different failing set: S3a is now Pass, S1b is a new Fail.

### Failures, compared with the BASE-102 list

| Step | What the command showed | Status vs BASE-102 | Owner |
|---|---|---|---|
| S1h R1E2E-17 | Unknown SP "1.1" in the intake editor is not refused by the server gate (`expected > 0, received 0`). | Carried over | team A (REQ-B-034 not merged) |
| S2e R1E2E-10 | Bulk Terbitkan on an approved question: refusal "Peralihan 'Diterbitkan' -> 'Diterbitkan' tidak dibenarkan." | Carried over | team A |
| S3a | `/admin/studio/sets` now exists (passes at all widths; Set Builder landing visible, no h-scroll). | **Fixed by T10** | T10 |
| S3c, S3d, S3f, S3g (R1E2E-C5) | `paper-publish` is disabled for the K1 paper (1449/1 is Spec, not Disahkan), so the spec's click times out ("element is not enabled"). The page itself shows the reason and the override tick (screenshots `evidence/*-S3f-graded-t10-reason-and-override.jpg`): "Terbitkan dinyahaktifkan: 1 masalah perlu dibetulkan." / "Kontrak Simulasi 1449/1 (versi 2) belum Disahkan (status: Spec); Terbit memerlukan kontrak Disahkan." / tick "Terbitkan walaupun tidak memenuhi kontrak Simulasi". | **Product defect fixed by T10; test still fails** because the spec predates T10's up-front reason and disabled button | B4 (spec update to the T10 flow); T10 product ok |
| S1b | Menu entry "Import & Semakan" now opens the batch list `/admin/spm/soalan/ekstrak` (T10 / R1-F09 changed BS-02, comment "V2 I1"), so `import-page` is never shown (`getByTestId('import-page')` not found). The CSV page still exists at `/admin/questions/import`. | **New** (passed on BASE-102) | T10 changed the menu on purpose; the spec path needs updating (B4). Product question for the lead: is the CSV page meant to lose its menu entry? |

## 3. Diagnostic run (not graded): T10 UI path and direct CSV URL

Two switches, default off, never set in the graded run, added to `e2e/api/r1-e2e-baseline.spec.ts` (the assertions are not weakened):
- `R1_E2E_DIAG_T10_UI=1`: in `publishPaper`, when the plain Terbitkan is disabled, assert `publish-errors` contains `belum Disahkan` and that `publish-override` is visible, then tick, fill the reason, press the override button, press `confirm-ok`, expect "Tarik balik" (`paper-unpublish`).
- `R1_E2E_DIAG_S1B_DIRECT=1`: S1b opens `/admin/questions/import` by URL instead of the menu.

| Width | Pass / Fail / Skip | Failing steps |
|---|---|---|
| 1280 | 34 / 2 / 7 | S1h, S2e |
| 768 | 34 / 2 / 7 | S1h, S2e |
| 375 | 34 / 2 / 7 | S1h, S2e |

Skips: S2g, S2c, S2d, S5d, B-02, and S3f/S3g (skipped by design once S3c/S3d publish). Under the diagnostic: S1b, S3a, S3c, S3d pass, then S4a and S4a2 (pupil sits the admin and control papers), S3e (K2, API-assisted override), S4b to S4f, S6, B-01, B-04, B-04b, B-04c, B-05 pass. The diagnostic confirms T10's UI override publishes the K1 paper and the pupil flow downstream works. S3e still uses the API-assisted override for the 1449/2 paper (the spec does that through the API, unchanged).

Not verified: that the override reason (5+ characters) is audited server-side from the UI path; only the publish outcome and "Tarik balik" were asserted.

## 4. Spec `admin-publish-http` (skipped on BASE-102; run now)

Command: `playwright.http.config.ts --project=<w> e2e/bijak/admin-publish-http.spec.ts --grep @bijak`, fresh DB per width, e2e seed accounts (fictitious) and the demo password. Spec after the conflict resolution in the header.

| Width | Pass / Fail / Skip |
|---|---|
| 1280 | 5 / 1 / 0 |
| 768 | 5 / 1 / 0 |
| 375 | 4 / 1 / 1 |

- Passing at all widths: login + menu offers Pembina Kertas; list renders through the http client; Bank Soalan, Baris Gilir Semakan and Intake load; Terbitkan on an empty draft is refused with the gap list, no h-scroll (the T10 "disabled button + reason" text assertion passes).
- Skipped at 375 only: "opening an existing paper renders the editor read-only path", skip reason in the spec "no existing paper in this environment" (the spec's row locator found none at mobile; not investigated further).
- **Fail, all widths:** "draft, assemble to Sepadan, Simpan, Terbitkan, student sees it, Tarik balik, delete". With the default 30 s test timeout it times out; with `--timeout=120000` it still fails at the same place: `assembleUntilMatching` presses `add-0` and `pick-add-*` about 18 times, then the picker offers no candidate (`pick-add-*` never appears, 107 s wait). Page state at the failure (error-context): "18 / 40", "Bahagian A: Kurang 22 soalan (perlu 40, ada 18)", "Markah 18 tidak sama dengan bajet 40". So on a fresh `poc` + `e2e` seed the builder pool for Matematik Kertas 1 (1449/1) holds 18 pickable questions, short of the 40 needed. `docs/ops/e2e-seed.md` says the e2e seed lets the builder reach Sepadan for 1449/1 from the bank. The baseline spec reaches 40/40 only because S1/S2 add the run's own approved questions and S3b/S3f fill more. The T10-specific part of this spec (override tick, `confirm-ok`, student sees the paper, Tarik balik, delete) was therefore NOT reached by this spec; it is covered only by the diagnostic baseline run above (S3c/S3d/S4a). Whether the 18-question pool is new (REQ-B-042 picker pool) or older was not checked: BASE-102 skipped this spec. Owner: A (seed / picker pool) or B4 (precondition); undecided.

## 5. Not run, and caveats

- Unit and API DB suites, lint, type-check, PoC path, R1E2E-16 and R1E2E-09 (not asserted by the spec): not run.
- Default throttles: not run. Flakes seen: none (no 429 under the raised throttles).
- Graded results are from one run per width; no reruns.
- The diagnostic and `admin-publish-http` runs used a spec file with the two diagnostic switches present (default off); the graded run used the file without them.
- Evidence: `docs/qa/r1-regression-base105-t10-teamb/evidence/` (S3a Set Builder at 3 widths, S3f graded-run T10 reason and override at 3 widths, S3c after the UI override in the diagnostic at 3 widths).

## 6. Commit

Branch `r1/b4-e2e-base105-t10`, local only, not pushed, not merged.
