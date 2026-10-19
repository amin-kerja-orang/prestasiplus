# M14 — Element inventory and link crawl: summary

- **Captured:** from live https://prestasiplus.my, read-only, with an admin session on browser lane 2 (`playwright2`). Credentials are not stored.
  - Inventory states: 2026-09-25.
  - Resumed on 2026-09-26: seed snapshot, `/kombo` probe, page-script capture, layout measurement, screenshots, narrative.
- **Method:** the same pipeline as M01–M13: `tools/inventory.js` → `tools/run-state.js` → `tools/split-batch.js` → `tools/merge-inventory.js` → `tools/diff-narrative.js`.
  - Capture plan: `tools/jobs/M14.js`. It holds 118 UI states over 22 screens in groups A (admin gamification), B (admin teacher gamification and reward control), C (student pages) and D (teacher pages).
  - Screen map: `tools/jobs/M14.screens.json`.
  - Dated seed snapshot:
    - `tools/jobs/M14-snapshot.js` is the in-page extractor; it never reads person names;
    - `tools/jobs/M14-snapshot-run.js` is the runner (35 GETs, 400 ms apart);
    - `tools/jobs/M14-snapshot-post.js` is the post-processor (it refuses to write when a name marker survives);
    - output: `_snapshot-2026-09-26.json`.
  - Masked screenshots: `tools/jobs/M14.shots.js` + `tools/shoot.js` produced 55 PNGs in `docs/discovery/img/M14/`.
  - Appendix generator: `tools/jobs/M11-appendix.js` (generic).
  - **No shared tool was modified.** Node runs of the job scripts use `.cjs` copies in `<scratchpad>/m14/`, because the repo `package.json` is `"type": "module"`.
- **Resume notes:** the earlier run was stopped after the S6 fix. `M14.js` now skips `sanitize.js` on S6, because sanitize treated the badge-name inputs as person names.
  - The S6 raw states were re-captured after the fix (19:53). The merged S6 file holds all 8 badge names ("Penyumbang Baru" … "Legenda Terulung").
  - All earlier raw and merged files were kept unchanged. They are consistent with the current job file.
- **Privacy (students are minors):**
  - Every job runs its client-side reveal actions, then `M14MASK` (in `tools/jobs/M14.js`), then `tools/sanitize.js {selectors:['.m14n'], titleName:false}` (skipped on S6, which has no personal data).
  - `M14MASK` tags person-name nodes: overview Top 10, leaderboard podium and rows, tunai account number and holder. It also removes avatars and replaces school names with `<school>`. The screenshots additionally blank every "Sekolah" table cell. "Pelajar" and "Guru" table columns are masked by sanitize itself.
  - `meta.piiLeakCheck` is 0 leaks in every sanitized state.
  - A grep of all M14 raw and merged files, the snapshot, the narrative and the job files for `BIN`/`BINTI`/`A/L`/`A/P` + name, e-mail addresses and school-name patterns finds **nothing**.
  - The snapshot uses positional tokens `<student:{rank}>`, `<teacher:{rank}>`, `<school:{n}>` and `<admin-account>`.
  - **Temporary unmasked dumps deleted:**
    - the whole `.playwright-mcp/lane2/m14/` folder from the earlier run (`dumps1.json`, `dumps2.json` with teacher names, `snap1/2.json`, `snap-merged.json`, `tx.json`, `admin-overview.html`, helper scripts);
    - this run's `.playwright-mcp/lane2/m14-snap-raw.json`.
  - This session's lane-2 console logs were checked and hold no names.
- **Files:**
  - Screen inventories: `S1-admin-overview.json` … `S22-guru-leaderboard.json`.
  - Layout chrome: `SHA-admin-shell.json` (S1–S10, 218 elements) and `SHU-user-shell.json` (S11–S22, 382 elements). Both are owned by 00-global-ui.
  - `_crawl.json` (367 URLs).
  - `_snapshot-2026-09-26.json`.
  - Raw captures: `../_raw/M14/*.json` (118).
- **Status legend:** same as M01–M13. `normalizeIds` is on. Long lists are sampled with variant-partitioned `opts.repeat` selectors, with totals in each state's `meta.repeats`:
  - S1: Top 10 and transactions, 3 each;
  - S4: 1 row per tier colour;
  - S5: 1 row per type badge;
  - S8: 1 row;
  - S10: 3 reward-cost rows;
  - S14: 3 of 47 rows;
  - S17: 3 of 14 rows;
  - S19: 2 earned + 1 unearned badge tile;
  - S22: 4 of 50 rows.

  The full row data is in the snapshot.

## 1. Per-screen counts

M14 content totals **1,759 elements** over 22 screens and **118** captured states (1280 / 768 / 375).

| Screen (route) | Total | Visible default | Conditional | Hidden only | Mobile only | Desktop only | States | States captured |
|---|---|---|---|---|---|---|---|---|
| S1-admin-overview `/admin/gamification` | 49 | 49 | 0 | 0 | 0 | 0 | 3 | default@1280, default@375, default@768 |
| S2-admin-tiers `/admin/gamification/tiers` | 204 | 187 | 0 | 17 | 0 | 0 | 3 | default@1280, default@375, default@768 |
| S3-admin-challenges `/admin/gamification/challenges` | 347 | 296 | 0 | 51 | 0 | 0 | 3 | default@1280, default@375, default@768 |
| S4-admin-students `/admin/gamification/students` | 46 | 38 | 5 | 3 | 2 | 18 | 7 | default@1280, last-page@1280, search-none@1280, sort-level@1280, tier-silver@1280, default@375, default@768 |
| S5-admin-transactions `/admin/gamification/transactions` | 37 | 28 | 7 | 2 | 2 | 18 | 10 | default@1280, date-empty@1280, last-page@1280, type-bonus@1280, type-convert@1280, type-earn@1280, type-refund@1280, type-spend@1280, default@375, default@768 |
| S6-admin-guru `/admin/gamifikasi/guru` | 179 | 38 | 32 | 109 | 0 | 0 | 6 | default@1280, badge-edit@1280, ganjaran-form@1280, default@375, default@768, ganjaran-form@375 |
| S7-admin-guru-tebusan `/admin/gamifikasi/guru/tebusan` | 11 | 7 | 4 | 0 | 0 | 0 | 7 | default@1280, status-CANCELLED@1280, status-DELIVERED@1280, status-PROCESSING@1280, status-all@1280, default@375, default@768 |
| S8-admin-guru-tunai `/admin/gamifikasi/guru/tunai` | 29 | 27 | 0 | 2 | 0 | 0 | 8 | default@1280, status-APPROVED@1280, status-PAID@1280, status-PROCESSING@1280, status-REJECTED@1280, status-all@1280, default@375, default@768 |
| S9-admin-pengaturan `/admin/gamifikasi/pengaturan` | 63 | 52 | 0 | 11 | 0 | 0 | 3 | default@1280, default@375, default@768 |
| S10-admin-reward-control `/admin/reward-control` | 55 | 34 | 16 | 5 | 0 | 0 | 5 | default@1280, draw-open@1280, default@375, default@768, draw-open@375 |
| S11-gamification `/gamification` | 133 | 130 | 0 | 3 | 0 | 0 | 3 | default@1280, default@375, default@768 |
| S12-convert `/gamification/convert` | 52 | 48 | 0 | 4 | 0 | 0 | 7 | default@1280, above-max@1280, below-min@1280, quick-250@1280, quick-all@1280, default@375, default@768 |
| S13-challenges `/gamification/challenges` | 97 | 94 | 0 | 3 | 0 | 0 | 3 | default@1280, default@375, default@768 |
| S14-leaderboard `/gamification/leaderboard` | 45 | 42 | 0 | 3 | 0 | 0 | 4 | default@1280, period-ignored@1280, default@375, default@768 |
| S15-achievements `/gamification/achievements` | 150 | 142 | 4 | 4 | 0 | 0 | 10 | default@1280, rarity-common@1280, rarity-epic@1280, rarity-legendary@1280, rarity-rare@1280, rarity-zzz@1280, share-modal@1280, default@375, default@768, share-modal@375 |
| S16-referral `/gamification/referral` | 26 | 22 | 1 | 3 | 0 | 0 | 4 | default@1280, copied@1280, default@375, default@768 |
| S17-history `/gamification/history` | 32 | 25 | 4 | 3 | 0 | 0 | 8 | default@1280, type-bonus@1280, type-convert@1280, type-earn@1280, type-spend@1280, type-zzz@1280, default@375, default@768 |
| S18-kad-kongsi `/gamification/kad-kongsi` | 73 | 21 | 49 | 3 | 0 | 0 | 7 | default@1280, tab-kombo@1280, tab-penguasaan@1280, tab-ranking@1280, default@375, default@768, tab-penguasaan@375 |
| S19-guru-gamifikasi `/guru/gamifikasi` | 63 | 60 | 0 | 3 | 0 | 0 | 3 | default@1280, default@375, default@768 |
| S20-guru-tebus-tunai `/guru/gamifikasi/tebus-tunai` | 47 | 40 | 2 | 5 | 0 | 0 | 5 | default@1280, below-min@1280, quick-500@1280, default@375, default@768 |
| S21-guru-kedai `/guru/gamifikasi/kedai` | 12 | 9 | 0 | 3 | 0 | 0 | 3 | default@1280, default@375, default@768 |
| S22-guru-leaderboard `/guru/gamifikasi/leaderboard` | 9 | 5 | 1 | 3 | 0 | 0 | 6 | default@1280, tab-global@1280, tab-invalid@1280, default@375, default@768, tab-global@375 |

## 2. Link crawl (`_crawl.json`)

- 367 unique URLs, classified by module: M14 185 (incl. pagination and filter links), M10 18, M12 15, M18 12, M09 11, M01/M04/M05/M08/M16 9 each, …, unknown 5 (shell JS endpoints: `/api/tournament/active`, `/chatbot/*`, `/fcm/token`).
- **New M14 routes (not in TRACKER):** `/admin/gamifikasi/guru/tebusan`, `/admin/gamifikasi/guru/tunai`, `/admin/gamifikasi/pengaturan`, `/gamification/history`, `/gamification/kad-kongsi`, `/guru/gamifikasi/tebus-tunai`, `/guru/gamifikasi/kedai`, `/guru/gamifikasi/leaderboard`. There are also 71 untracked M14 form or filter URLs. Examples: `/admin/gamification/award-syiling`, `/tiers/{1-4}[/toggle]`, `/challenges/{1-10}[/toggle]`, `/admin/gamifikasi/guru/lencana/{1-8}`, `/guru/ganjaran`, `/guru/tunai/2`, `/admin/reward-control/{settings,draw,reward/{1-11}/cost}`, and the `?status=` / `?type=` / `?rarity=` / `?tab=` filters.
- **TRACKER route without a page:** `/kombo` (sidebar "Kombo") → **302 → `/dashboard`** for the admin account (narrative §9).
- **Links owned elsewhere:**
  - M15: `/gamification/rewards`, `/gamification/mystery-box`, `/cabutan`, `/admin/hadiah`, `/cikgu/kelulusan-hadiah`;
  - M16: `/battle*`, `/liga`, `/tournament*`, `/permainan`, `/sekolah-bersaing`, `/admin/permainan`;
  - M08: `/leaderboard`, `/ranking`, `/pelajar/3` (**404**, D-2);
  - M10: `/guru/soalan/cipta`;
  - M01: `/register?ref={CODE}`.
- **External:** `wa.me`, `t.me/share/url`.

## 3. Reconciliation

- `node tools/diff-narrative.js inventory/M14 ../M14-gamification.md` → **0 candidates** on all 22 screens.
- **Inventoried strings not in the narrative:** *(none)*.
  - Appendix B of the narrative lists the residual exact strings (per-row amounts, field names, icons, script literals).
  - A trailing line gives the U+FE0F-stripped forms that `diff-narrative.js` normalises.
- Shell files (SHA/SHU) are not reconciled here; 00-global-ui owns them. The M14-specific shell data is noted in narrative §1.1 and §5.4: the header chips "256 koin", "8 mata" and "1 hari 🔥", and the sidebar "Kombo" link.

## 4. Read-only limits (states not revealable)

The full list is in narrative §9. In short:
- results of every POST/PUT/PATCH/DELETE: convert, award, tier/challenge/badge/reward/settings/cost/draw saves, cash-out submit and status changes;
- teacher catalogue items and redemptions;
- unlocked achievement and completed challenge styles;
- draw rows;
- referral stats > 0;
- `/kombo` for a student;
- kombo multiplier steps above 1.0x.
