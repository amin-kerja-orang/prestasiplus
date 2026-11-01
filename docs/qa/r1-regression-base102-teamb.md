# R1 E2E regression on BASE-102 (team B, lane B4)

Date 2026-11-01. Tree = `origin/r1/t23-e2e-c` (c8f5b25dd) merged with `origin/feature/v3-bijak-r1` **d42351f71 (BASE-102)** -> merge commit 493aa5dfe, plus the two spec fixes listed in section 4. Comparison baseline: BASE-98 (`r1/c-qa-base98` @ c2e9f510d). Newer team C results (BASE-101) do not exist on that branch.

Stack (local only, nothing on any server): own Postgres 16 container (UTC), migrations applied in order, seeds `poc` then `e2e`, a fresh DB per viewport, API `dist/main.js` (vite build) with `JOBS_WORKER_ENABLED=true`, SPA `VITE_API_MODE=http --mode demo` via `vite preview` on 5462 (API 3462), 1 worker. Spec `r1-e2e-baseline` (43 steps per viewport). Process and container stopped/removed afterwards.

**Verdict: Not ready.** No regression against BASE-98 and no layout break, but T34 produced one new product defect (R1E2E-C5) and the known fails remain.

## 1. Result per width (graded run, raised API throttles, section 5)

| Width | Pass / Fail / Skip | Failing steps |
|---|---|---|
| 1280 desktop | 29 / 7 / 7 | S1h, S2e, S3a, S3c, S3f, S3d, S3g |
| 768 tablet | 29 / 7 / 7 | same |
| 375 mobile | 29 / 7 / 7 | same |

Skips (same at all widths): S2g, S2c, S2d, S5d (not needed by design), B-02 (known), S4a and S4a2 (blocked by S3c/S3d). `expectNoHScroll` passed on every visited screen; also 0 px at 375 and 1280 in the S3c browser check. No console errors beyond the expected 401 on `/api/session` before login.

Diagnostic run (only `R1_E2E_DIAG_SKIP_REASON_TEXT=1`, which skips the single reason-text assertion so the override and the downstream flow run): S3c, S3d publish through the audited override, then S4a, S4a2 (pupil sits the admin and control papers), S3e (K2 override), S4b to S4f, S6 all pass at 1280, 768 and 375. Remaining fails there: S1h, S2e, S3a only (plus throttle flakes when default throttles are used).

## 2. Failures (graded run)

| Test | Steps / expected vs actual | New vs BASE-98? | Owner |
|---|---|---|---|
| **S3c, S3d, S3f, S3g** "Kontrak ... belum Disahkan" (**R1E2E-C5**, Medium) | Pembina Kertas, K1 paper 40/40, "Terbitkan". API answers `ok:false`, error "Kontrak Simulasi 1449/1 (versi 2) belum Disahkan ...", `blockerDetails[BLUEPRINT_NOT_VERIFIED].overridable=true`, `canOverride=true`. Expected: the UI shows why. Actual: the UI shows only "Kertas belum boleh diterbitkan: selesaikan 1 perkara di atas." under a green "Sepadan dengan blueprint"; the reason is not rendered anywhere (`PaperEditorPage.vue` keeps only `res.errors.length`). Screenshots `docs/qa/r1-regression-base102-teamb/evidence/*-S3c-refusal-no-reason.jpg` (3 widths). S3d/S3g/S3f fail the same way (S3f/S3g are no longer skipped because their Terbitkan now meets the T34 gate). | New (T34 effect; BASE-98 fails were the picker loop) | C (FE m28 PaperEditorPage); A for the override UI (T10) |
| S1h R1E2E-17 | Unknown SP "1.1" in the intake editor: server gate should refuse; actual accepted, banner "Dihantar untuk semakan". | No | A (REQ-B-034 still not merged) |
| S2e R1E2E-10 | Bulk Terbitkan on an approved question: refusal "Peralihan 'Diterbitkan' -> 'Diterbitkan' tidak dibenarkan." | No | A |
| S3a | `/admin/studio/sets` "Halaman Tidak Dijumpai" (T10 not merged). | No | A (T10) |

## 3. S3c browser check after T34 (1449/1, 1280 and 375, screenshots in `docs/qa/r1-regression-base102-teamb/s3c-check/`)

1. Fill a new K1 paper from the picker to 40/40 ("Sepadan dengan blueprint"), Terbitkan: refused as above (R1E2E-C5, reason hidden); no "Tarik balik"; 0 px scroll.
2. Override without reason (`POST publish {override:true}`): HTTP 422 "Sebab diperlukan untuk menerbitkan walaupun tidak memenuhi kontrak blueprint". Pass.
3. Override with reason: HTTP 200 `ok:true`, `overridden:[Kontrak ... belum Disahkan]`; after reload "Tarik balik" shown. Pass. The override is API-assisted: the UI tick is T10 (not merged).
Blueprint 1449/1 was not seeded as Disahkan.

## 4. Spec changes (harness defects only, stated)

File `e2e/api/r1-e2e-baseline.spec.ts`:
- S3e published the 1449/2 paper with a plain publish, which T34 now refuses (blueprint Spec). It now uses the same audited override. Before the fix S3e failed at all widths.
- `publishPaper` read `canOverride` on each blocker detail. The wire has `overridable` per detail and `canOverride` at the top level (`blockers.ts`), so the check could never pass. Fixed to read both correctly.
- Diagnostic switch `R1_E2E_DIAG_SKIP_REASON_TEXT=1` (default off, never set in the graded run) so the downstream flow can be observed while R1E2E-C5 is open. The reason-text assertion itself is unchanged.

## 5. Flakes and harness notes (not product failures)

- With the default API throttles (login 5/min, global 300/min per address) the run on a fast idle Mac hit 429: S1i (Studio list/editor showed the generic "Maaf, berlaku ralat" after `GET /api/questions` 429; confirmed in the trace), B-04b, B-04c, B-05 (login 429). B-04b, B-04c, B-05 pass when rerun alone (desktop and tablet). S1i is state-dependent and cannot be rerun alone; it passes at all three widths when the throttles are raised through env vars only (`THROTTLE_GLOBAL_PER_MINUTE`, `THROTTLE_ADMIN_READ_PER_MINUTE`, `THROTTLE_LOGIN_PER_MINUTE` and the write limits). Section 1 is that run. Suggest raising them in the local E2E stack config (owner B/C) and showing a rate-limit message instead of the generic error (Low, C).
- S5e did not flake this time (passes at all widths). The earlier B-04 flake did not recur.
- Not run: unit and API DB suites, PoC path, R1E2E-16 and -09 (not asserted by the spec).

## 6. Commit

Branch `r1/b4-e2e-base102`, local only, not pushed, not merged into `feature/v3-bijak-r1`.
