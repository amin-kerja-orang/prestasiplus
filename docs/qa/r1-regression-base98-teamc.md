# R1 targeted regression on BASE-98, 2026-11-01 (team C standing in for lane B4)

Branch `r1/c-qa-base98` = `feature/v3-bijak-r1` @ **`a350dac25545e13f30ffda973facb8cc05fe5da1`** (BASE-98) + B4's two E2E files unchanged from `origin/r1/t23-e2e` @ d61f98bd5 (`playwright.r1-e2e.config.ts`, `e2e/api/r1-e2e-baseline.spec.ts`). Same HTTP-stack method as `r1-regression-base93-teamc.md`: API `dist/main.js` rebuilt at BASE-98 with `JOBS_WORKER_ENABLED=true`, SPA `VITE_API_MODE=http` (`--mode demo`) via `vite preview`, local PG 16 on 55432 (session TZ forced to UTC), migrations 0001..0103 applied in order, seeds `poc` then `e2e`, a fresh DB clone per viewport, 1 worker. B4.md, MERGE-LOG, BOARD and TRACKER untouched. Nothing run or changed on any remote server. Test DBs, API and preview processes started by me are stopped/dropped.

**Verdict: Not ready** (E2E gate: S1h/R1E2E-17, S2e/R1E2E-10, T10 and the S3c/S3d spec steps still fail). But the BASE-98 changes themselves look good: R1E2E-C1, R1E2E-C2 and REQ-B-042 are confirmed fixed, H-C8 stimuli show in Simulasi Kuiz, no new defect, no responsive break. S3c/S3d still fail only because the harness (B4's spec) never presses "Muat lagi"; a manual run of the same flow publishes a 40/40 paper (details below).

## 1. E2E, B4's T23 flow, 43 tests per viewport

| Viewport | BASE-93 (pass/fail/skip) | BASE-98 |
|---|---|---|
| desktop 1280 | 33 / 5 / 5 | 33 / 5 / 5 |
| mobile 375 | 33 / 5 / 5 | 33 / 5 / 5 |
| tablet 768 | 33 / 5 / 5 | 33 / 5 / 5 (first tablet run 26/7/10 was invalid: browser "Page crashed" in S4b and cascade while another agent shared the RAM; rerun alone on a fresh DB is the figure) |

The failing set is the same at all three widths: S1h, S2e, S3a, S3c, S3d. Skips: S2g, S2c, S2d, S5d, B-02 (as before). The spec's `expectNoHScroll` passed on every visited screen at all widths.

| Step | BASE-93 | BASE-98 | Note |
|---|---|---|---|
| S1h R1E2E-17 | Fail | Fail | SP "1.1" still accepted by the server gate. Unchanged. |
| S2e R1E2E-10 | Fail | Fail | "Peralihan 'Diterbitkan' -> 'Diterbitkan' tidak dibenarkan." Unchanged. |
| S3a T10 | Fail | Fail | `/admin/studio/sets` is still "Halaman Tidak Dijumpai". |
| S3b picker | Pass, offered 5 | Pass, **picker now lists 18 bank candidates per page** (mobile obs: run's own 5 + 18 left) | REQ-B-042 effect. |
| S3c Terbit | Fail "Kurang 35 (perlu 40, ada 5)" | Fail "**Kurang 15 soalan (perlu 40, ada 25)**" + "Markah 25 tidak sama dengan bajet 40" | Improved: 20 more questions placed from the pool. Spec's fill loop stops when the visible page is exhausted and never clicks "Muat lagi". |
| S3d control | Fail (Kurang 35) | Fail "Kurang 21 soalan (perlu 40, ada 19)" | Same cause. |
| S3f / S3g (API-assisted fill, then UI Terbitkan) | Pass | Pass | 15 / 21 pool units placed, 40/40, published. |
| S1i / S1j (Studio list, menu) | Pass | Pass | |
| S1c intake PDF, S2a, S4a-f, S5a-e, S6, B-04, B-04b/c, B-05 | Pass | Pass | S4a: 40 MCQs, 2 pictures, 0 broken. S4f K2 fixture ok. |

Open R1E2E items: -17, -10, T10 unchanged. -13/-23 (K1 paper completion in the picker): the picker now offers the pool, see 2d; the spec still reports fail because it needs the "Muat lagi" click.

## 2. Probes (screenshots in `docs/qa/r1-regression-base98-teamc/probe/`, script `/home/claude/scratch/qa98/probe.cjs`)

All at 375 / 768 / 1280 unless stated. 0 px horizontal scroll everywhere, no 4xx/5xx on `/api` except the expected 401 `GET /api/session` on the login page before sign-in (same on BASE-93; not a defect). No console errors beyond that 401.

| Area | Result |
|---|---|
| 2a Admin intake list `/admin/spm/soalan/ekstrak` (R1E2E-C1) | **Fixed.** Rows show "Bilangan Soalan" 1 / 2 and "Disemak" 1 / 2 and status "Sedia untuk semakan", equal to `GET /api/intake/batches` (`itemCount`, `reviewedCount`, `statusLabel`). At 375 it renders as cards (no table), no overflow. |
| 2b Studio list `/admin/studio` (R1E2E-C2) | **Fixed.** Status words in BM (Diterbitkan, Draf, Menunggu Semakan, Diarkibkan; stat cards and filters), "Kertas" column shows "Kertas 2" (from the wire `kertas`). "No." still shows the id (1310, 1309 ...) because the wire `numberLabel` is `null` for these seeded K2 rows; a row with a non-null `numberLabel` was not available, so that branch is not verified here. |
| 2c Studio editor TP line `/admin/studio/questions/<id>/sunting` (REQ-B-045) | Line "TP soalan: 3 (tertinggi antara bahagian)" shown for a standalone MCQ (1293) and an intake-born group member (1291). The "(diwarisi daripada soalan)" inherited-TP variant was **not** reproduced (every question available had a leaf TP); covered only by the unit tests. |
| 2d Pembina Kertas picker (REQ-B-042) | **Works.** New Matematik Kertas 1 paper, "Tambah soalan dari bank": 18 candidates on open, "Muat lagi" -> 38 -> 58 -> 59 and then disappears; search "Fungsi" -> 12; no match -> "Tiada soalan sepadan."; group candidates carry "Kumpulan <label> · 2 soalan · 2 markah" (seen after Muat lagi, 2 groups at 375). Adding all needed units gave "Sepadan dengan blueprint", 40/40, Terbitkan -> HTTP 200 ok:true, banner "Kertas diterbitkan" and "Tarik balik" shown. Same result at 375, 768, 1280. |
| 2e Pupil Simulasi Kuiz `/simulasi/kuiz?subject=MATH` (H-C8) | **Works.** Stimulus blocks render above the question: passage ("Petikan bersama ...", "Harga sebatang pensel RM1 ...") and picture (0 broken images), at 375, 768 and 1280; a group passage is shown once. API check: MATH sessions of 20 items include stimuli in about 7 of 120 items (passage and image), BM has passages. One unfiltered 20-question run per viewport had no stimulus by chance, so the probe loops until one appears. |

## 3. Unit sweep (touched modules)

`npx vitest run --project unit src/modules/m28-bijak-spm src/modules/m04-question-bank src/modules/m05-practice src/modules/m06-spm src/mock/server/__tests__/registry-boot.test.ts`: **130 files, 1765 tests passed, 0 failed** (773 s, exit 0).

## 4. Defects

No new defect (R1E2E-C3 and above: none). Two observations, not defects:

- **Obs-1 (Low, owner C, FE m28 picker; for B4/B decision):** after the visible page of picker candidates is all added, the list is empty and only "Muat lagi" remains. Harness that fills a paper must press it (B4's `buildPaper` loop in the spec does not, which is why S3c/S3d still fail). Suggest B4 updates the spec to click `picker-more` when `pick-add-*` is empty. A human admin can finish the paper (proved in 2d).
- **Obs-2:** the Studio "No." column falls back to the id when `numberLabel` is null (see 2b).

Status of old items: R1E2E-C1 and R1E2E-C2 closed. R1E2E-16, -09, -07 not re-probed (not asserted by the spec). Studio 1291/1293 flake note: one Kuiz probe run failed to find options right after 30 quick session POSTs that returned 429 (throttle) and did not reproduce in 5 further runs; treated as my own rate-limit artefact.

## 5. Not run / limits

- Full API DB sweep and the non-touched FE unit sets (per brief).
- `db/migrate-cli.spec.ts` (Prisma engine download blocked).
- R1E2E-11, -18, -19, -22 and the PoC path not exercised.
- The first-run desktop E2E used the `list` reporter only, so its annotation dump was not saved (`observations-final.txt` for desktop is absent); mobile and tablet have theirs, the desktop failure causes were read from the error contexts and match mobile.

Evidence: `docs/qa/r1-regression-base98-teamc/{desktop,mobile,tablet,probe}/` (screenshots, `observations-final.txt`). Raw logs: `/home/claude/scratch/qa98/` (`e2e-*.txt`, `results-*.json`, `unit.txt`, `probe-*.out`).
