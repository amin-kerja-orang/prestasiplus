# R1 E2E targeted re-test on BASE-89, 2026-11-01 (T23 cycle 19, lane B4)

Addendum to [r1-e2e-2026-11-01-base79.md](r1-e2e-2026-11-01-base79.md). **Targeted re-test, not a full run** (the official full run waits for T36). Scope: R1E2E-20 (REQ-B-038), R1E2E-21 (REQ-B-039), the T26c structured K2 fixture, S6 Jana Kertas, a quick R1E2E-23 check, plus seed-only sanity.

## Environment

| Item | Value |
|---|---|
| BASE | `feature/v3-bijak-r1` @ **`f4b28a26`** (BASE-89, the tip at the start of the cycle), merged into `r1/t23-e2e` (from 7f3bd6263; merge commit 8edbadfe, clean). New since BASE-79: BASE-80 T26c (structured K2 E2E paper in the e2e seed), BASE-81 T45b, BASE-82 H-A16, BASE-83 R008-L1, BASE-84 REQ-B-038 (Studio TP inherit), BASE-85 REQ-B-039 (Studio menu entry), BASE-86..89 docs. |
| Builds | API rebuilt (`apps/api/src` changed) and SPA rebuilt. |
| Database | No new migration (46, last `0103`); T26c changed the e2e seed, so the lane DB was dropped, migrated from scratch, seeded `poc` + `e2e` into a **new snapshot**; each run from a fresh copy and a restarted API. `BIJAK_POC_QUESTIONS=false`. |
| Browser | Playwright Chromium 153, headless; 375×812 (touch), 768×1024 (touch), 1280×800; `--workers` 1, one run for all three. |
| Accounts | `admin.pusat.e2e@example.test`, `murid.t4.e2e@example.test` (T26). Demo password convention. |
| Spec | `e2e/api/r1-e2e-baseline.spec.ts`: new steps S1j, S2h, S4f (below). e2e `tsc` 0, `eslint` 0, prettier clean. |

Commands (repo root, Node 22):

```
R1_E2E_RUN=b89seed R1_E2E_SHOTS=docs/qa/r1-e2e-2026-11-01-base89-retest/seed-only BASE_URL=http://127.0.0.1:5244 \
  npx playwright test -c playwright.r1-e2e.config.ts -g 'S0 pupil|B-01'                                    # fresh DB: 6/6 pass
R1_E2E_RUN=b89run1 R1_E2E_SHOTS=docs/qa/r1-e2e-2026-11-01-base89-retest BASE_URL=http://127.0.0.1:5244 \
  npx playwright test -c playwright.r1-e2e.config.ts -g 'S0 pupil|S1c admin|S1f|S1j|S2b|S2h|S2g|S2a|S3b|S4f|S6 |B-01'   # fresh DB
```

Result: per viewport **12 pass / 0 fail / 1 skip** (S2g, workaround not needed), identical at 375, 768 and 1280. (The `S3b` filter also selected S3f, whose title names S3b; it ran and passed.) No horizontal page scroll on any visited screen at any width.

## Checks (375 / 768 / 1280)

| Check | Result | Evidence (observed) |
|---|---|---|
| Seed-only sanity (S0, B-01) | Pass ×3 | Databank / Latih Tubi MATH 54 on the fresh DB; B-01 empty state |
| S1c → S2b intake path | Pass ×3 | PDF intake accepted by the server; 2 items "Terima (Draf)" |
| **R1E2E-20** (S2h, new): an intake-born question in Studio "Sunting" | **Pass ×3** | the intake question opens **editable** (no "TP soalan tidak sepadan …" refusal); Aras pemikiran changed to Mengaplikasi, "Simpan draf" → `PUT /api/questions/{id}` **200** |
| **R1E2E-21** (S1j, new): menu entry | **Pass ×3** | Pentadbiran menu, group Bank Soalan: entry **"Bank Soalan (Studio)"** → `/admin/studio`, Studio list loads (drawer below 1024 px) |
| S2a UI approval | Pass ×3 | approved PDF intake 2/2, Studio 1/1 (S2g skipped: not needed) |
| **T26c K2 fixture** (S4f, new): pupil sits the seeded structured K2 paper, self-marks | **Pass ×3** | T4 hub card "E2E fixture: Percubaan Matematik Tambahan Kertas 2 · Kertas 2 · 100 markah · 150 minit"; Mula **201**; 15 screens, 73 answer fields filled; Hantar; "4/100 markah (sementara)"; 12 self-mark controls; "Simpan markah" → `POST …/self-mark` 200; after reload **5/100 (sementara)**. **No API-assisted S3e needed** for a structured K2 sitting |
| **S6 Jana Kertas 3472/2** | Pass ×3 (observed **422 SHORTAGE**, changed shape) | "Kertas tidak dapat dijana kerana soalan tidak mencukupi. Bahagian A: perlu 6 markah, hanya 2 tersedia · Bahagian B: perlu 40 markah KBAT, hanya 0 tersedia · Bahagian C: perlu 40 markah KBAT, hanya 0 tersedia". The 15 fixture questions are a fixed paper, not a generation pool (docs/ops/e2e-seed.md) |
| **R1E2E-23** quick check (S3b) | **Unchanged** | the K1 picker still offers only the run's own Kertas 1 questions ("bank candidates with an empty search": 0 / 1 / 2, i.e. earlier viewports' own); S3f's API fill from the builder pool still needed (39 / 38 / 37 units placed → 40/40, Terbit ok) |

## Status changes

| ID | Change |
|---|---|
| R1E2E-20 | **Fixed** (REQ-B-038) at 375 / 768 / 1280 |
| R1E2E-21 | **Fixed** (REQ-B-039): "Bank Soalan (Studio)" menu entry → `/admin/studio` |
| R1E2E-13 | **K2 sitting side fixed by T26c** (a structured K2 paper is seeded, playable, self-markable). Jana Kertas 3472/2 still 422 SHORTAGE (no generation pool; expected per the seed doc) |
| R1E2E-23 | Open, unchanged |

No new bug. Everything else as reported on BASE-79 (not re-run in this targeted cycle).

Evidence: `r1-e2e-2026-11-01-base89-retest/observations-retest.txt`, `…/seed-only/observations-seedonly.txt`, screenshots `<viewport>-<step>.jpg`.
