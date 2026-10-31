# R1 E2E targeted re-test on BASE-46, 2026-11-01 (T23 cycle 8, lane B4)

Addendum to [r1-e2e-2026-11-01-base37.md](r1-e2e-2026-11-01-base37.md). **Targeted re-test only, not a full run.** Scope: R1E2E-15 (REQ-B-030, Studio group page layout) and a first look at the Kandungan SPM hub (BASE-45, R1-21, KS-01 `/admin/spm`).

## Environment

| Item | Value |
|---|---|
| BASE | `feature/v3-bijak-r1` @ `1ee2b001` (BASE-46), merged into `r1/t23-e2e` (from f556e8ba, BASE-44 merged by the lead; merge commit 18d44401, clean). |
| Migrations | BASE-38..44 brought **`0103_question_report_context`**; the lane DB was dropped and migrated from scratch: **46 applied, last 0103**. BASE-45/46 add no migration and no `apps/api` change. Seeds `poc` + `e2e`, new snapshot `b4_r1e2e_seed`, fresh copy. |
| Builds | API rebuilt (changed since cycle 5 via BASE-38..44); SPA `vite build --mode production` with `VITE_API_MODE=http`, `VITE_PROTOTYPE_SCOPE=on`, `VITE_TEST_HOOKS=false`. API `BIJAK_POC_QUESTIONS=false`, otherwise as cycle 5. |
| Browser | Playwright Chromium 153, headless; 375×812 (touch), 768×1024 (touch), 1280×800. |

Commands:

```
R1_E2E_RUN=b46retest R1_E2E_SHOTS=docs/qa/r1-e2e-2026-11-01-base46-retest BASE_URL=http://127.0.0.1:5244 \
  npx playwright test -c playwright.r1-e2e.config.ts -g 'S1d'     # fresh DB; S1d needs only the admin login
node <scratch>/cycle8/hub/hub.mjs docs/qa/r1-e2e-2026-11-01-base46-retest   # hub look, 3 widths (Playwright library, read-only)
node <scratch>/cycle8/hub/lanes.mjs                                        # lane "Sunting" targets, 1280
```

## R1E2E-15: Studio "Kumpulan rangsangan" page

| Width | Result | Evidence |
|---|---|---|
| 375 | **Pass** | S1d Pass (2 members, no warning, no horizontal scroll). The group now sits on a white surface; empty "Kapsyen", "Penerangan gambar" fields are drawn as filled boxes; the locked "Jenis rangsangan" select is **one box** ("Petikan" + caret). `mobile-S1d.jpg` |
| 768 | **Pass** | same; select and Label side by side, both one box. `tablet-S1d.jpg` |
| 1280 | **Pass** | same. `desktop-S1d.jpg` |

**R1E2E-15: Fixed** (REQ-B-030). The locked select is drawn in the disabled tone (pale), which is expected for a locked control.

## Kandungan SPM hub (BASE-45), Admin Pusat (`admin.pusat.e2e@example.test`)

| Width | Hub loads | Tiles | Links from the tiles | Horizontal scroll |
|---|---|---|---|---|
| 375 | yes (`kandungan-hub`, no placeholder) | 2: "Databank Soalan" (11 perlu perhatian), "Bijak SPM" (25 perlu perhatian) | `/admin/spm/databank`, `/admin/spm/simulasi`: both open their lane (no "Halaman Tidak Dijumpai") | 0 px on the hub and both lanes |
| 768 | yes | same | same | 0 px |
| 1280 | yes | same | same | 0 px |

- Lane "Sunting" targets (1280): Databank rows → `/admin/spm/soalan/{id}/sunting`, Bijak SPM rows → `/admin/spm/kertas/{id}`; the two sampled per lane open (no placeholder).
- Only lanes with an R1 screen are shown (2 of the 6 V2 cards; `HUB_CARDS`, AC-R1-21.1). No console error after login (the one 401 is `/api/session` on the login page, before sign-in).
- Screenshots: `<viewport>-hub.jpg`, `<viewport>-hub-databank.jpg`, `<viewport>-hub-simulasi.jpg`; log `observations-hub.txt`.

### R1E2E-16 (Medium, team A; NEW): the hub's "Bijak SPM" attention count contradicts its lane, and the lane shows the unsittable PoC papers as fine
- Steps: fresh DB (`poc` + `e2e` seeds), API `BIJAK_POC_QUESTIONS=false`. Admin Pusat > `/admin/spm`: the Bijak SPM card reads "25 perlu perhatian". Press "Buka senarai" (`/admin/spm/simulasi`).
- Expected: the lane explains the 25 (rows with attention lines adding up to the card's number), and a paper pupils cannot start is flagged.
- Actual: the lane lists 5 papers, every one with `attentionCount: 0` and no attention line (`GET /api/admin/servability/lanes/bijak-spm`), while `GET /api/admin/servability/overview` gives `simulasi_paper` served 6 / total 31 / attention 25 (`basis: evaluated`). Papers 1–4 in that lane are the PoC papers that pupils get 403 on (R1E2E-14), yet the lane shows them as "Terbit" with nothing to check. (Databank: card 11 vs 6 rows with attention lines in the lane; possibly a different unit, not raised separately.)
- Evidence: `*-hub.jpg`, `*-hub-simulasi.jpg`, `observations-hub.txt`.

## Status changes

| ID | Change |
|---|---|
| R1E2E-15 | **Fixed** at 375 / 768 / 1280 (REQ-B-030) |
| R1E2E-16 | **New**, Medium, team A (above) |

Everything else as reported on BASE-37 (not re-run in this targeted cycle).
