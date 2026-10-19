# M15 — Element inventory & link crawl: summary

- **Captured:** 2026-09-26 from live https://prestasiplus.my, read-only, admin session on browser lane 1 (`playwright`). Credentials are not stored. Resume of an earlier stopped run: its plan `tools/jobs/M15.js` and crawl helper `tools/jobs/M15-crawl.js` were reused (plan corrected: tebusan masking of both cell lines, empty-state handling, state labels).
- **Method:** the standard pipeline: `tools/inventory.js` → `tools/run-state.js` → `tools/split-batch.js` → `tools/merge-inventory.js` → `tools/diff-narrative.js`.
  - Capture plan: `tools/jobs/M15.js`, 54 UI states over 9 screens in groups A–F.
  - Screen map: `tools/jobs/M15.screens.json`.
  - Crawl: `tools/jobs/M15-crawl.js` (21 URLs incl. 14 probes).
  - Seed snapshot: `tools/jobs/M15-snapshot.js` → `_snapshot-2026-09-26.json`.
  - Responsive measurements: `tools/jobs/M15-measure.js` (8 routes × 375/768/1280; output kept in the scratchpad, results in narrative §8.1).
  - Masked screenshots: `tools/shoot.js` with an inline shot list (31 PNGs in `docs/discovery/img/M15/`).
  - **No shared tool was modified.** The repo's `package.json` has `"type": "module"`, so the CommonJS tools (`split-batch`, `merge-inventory`, `diff-narrative`) were run from `.cjs` copies in the agent's scratchpad (`<scratchpad>/m15/tools/`, `merge-inventory` with `ROOT` fixed to the repo path). The copies are byte-identical otherwise.
- **Privacy:**
  - Only `/admin/hadiah/tebusan` shows people (Pelajar column: name line + e-mail line). Each job runs `M15MASK` (tags both lines `.m15n`, strips `data-cfemail`, blanks avatars) then `tools/sanitize.js {selectors:['.m15n'], titleName:false}`, which also masks the whole Pelajar column.
  - Fix during capture: on zero-row states the empty-state cell is the first (Pelajar) cell, so sanitize masked "Tiada tebusan dalam status ini." and `piiLeakCheck` reported 1 "leak" (the job's state label contained that sentence). Group B was re-captured with `keepCols:'^pelajar$'` for the zero-row states only (default, pending_admin, pending_parent_consent, delivered, bogus); `cancelled` / `all` keep full masking. `piiLeakCheck` is **0 leaks in all 54 states**.
  - The snapshot never reads the Pelajar column; owners are `<student:n>` tokens.
  - A scripted check compared every M15 file in `docs/discovery` (73 files, PNGs excluded) against the name and e-mail tokens read live from the 3 tebusan rows: 1 hit, a false positive (a 4-letter token inside the English word "belong"). Scratch files that held the unmasked crawl text were deleted.
- **Files:** `S1-hadiah.json` … `S9-hadiah-show.json`, layout chrome `SHA-admin-shell.json` (S1–S4) and `SHU-user-shell.json` (S5–S8), `_crawl.json`, `_snapshot-2026-09-26.json`; raw captures `../_raw/M15/*.json` (54).
- **Status legend:** as M01–M14; `normalizeIds` on. Catalogue rows sampled with `opts.repeat {'main tbody tr': 3}` (totals in `meta.repeats`); the full row data is in the snapshot, not the inventory (table cell text is not inventoried).

## 1. Per-screen counts

M15 content totals **250 elements** over 9 screens and **54** captured states (1280 / 768 / 375). The shells add 207 (SHA) and 372 (SHU) chrome elements, which are not M15 content.

| Screen (route) | Total | Visible default | Conditional | Hidden only | Mobile only | Desktop only | States | States captured |
|---|---|---|---|---|---|---|---|---|
| S1-hadiah `/admin/hadiah` | 58 | 38 | 13 | 7 | 2 | 10 | 19 | default, page-2, page-3, cat-{flagship, ewallet, telco, gaming, streaming, foodbeverage, ecommerce, education, entertainment, bogus}, bulk-one, bulk-all, bulk-cleared (@1280); default, bulk-one @375; default @768 |
| S2-tebusan `/admin/hadiah/tebusan` | 9 | 9 | 0 | 0 | 0 | 0 | 10 | default, status-{pendingadmin, pendingparentconsent, delivered, cancelled, all, bogus} (@1280); default, status-all @375; default @768 |
| S3-hadiah-baharu `/admin/hadiah/baharu` | 40 | 39 | 0 | 1 | 0 | 0 | 4 | default, validity (@1280); default @375/@768 |
| S4-hadiah-edit `/admin/hadiah/{id}/edit` | 54 | 39 | 13 | 2 | 0 | 0 | 6 | default (id 1), stock (id 9), flagship (id 59), not-found 404 (@1280); default @375/@768 |
| S5-rewards `/gamification/rewards` | 10 | 7 | 0 | 3 | 0 | 0 | 4 | default, query-ignored (@1280); default @375/@768 |
| S6-mystery-box `/gamification/mystery-box` | 58 | 51 | 0 | 7 | 0 | 0 | 3 | default @1280/@375/@768 |
| S7-cabutan `/cabutan` | 9 | 6 | 0 | 3 | 0 | 0 | 3 | default @1280/@375/@768 |
| S8-kelulusan-hadiah `/cikgu/kelulusan-hadiah` | 9 | 6 | 0 | 3 | 0 | 0 | 3 | default @1280/@375/@768 |
| S9-hadiah-show `GET /admin/hadiah/{id}` | 3 | 3 | 0 | 0 | 0 | 0 | 2 | HTTP 405 @1280/@375 |
| SHA-admin-shell (chrome of S1–S4) | 207 | 75 | 17 | 115 | 7 | 70 | 38 | all SHA states |
| SHU-user-shell (chrome of S5–S8) | 372 | 152 | 15 | 205 | 15 | 148 | 13 | all SHU states |

Hidden-only in S5–S8 (3 each) are the global tournament banner's templates ("LIVE:", "MAIN", "DAFTAR"), owned by the global widget. S1 "desktop-only" includes the row "Edit" links: at 375 they are clipped off-screen by the table wrapper (narrative D-M15-1).

**Horizontal page overflow:** flagged in none of the 54 states; direct measurement confirms page `scrollWidth` ≤ viewport everywhere. Content clipping inside `overflow-hidden` table wrappers (S1, S2 at 375 and 768) is measured separately in narrative §8.1.

**Empty / error states captured:** S1 "Tiada hadiah dalam kategori ini." (cat=bogus, page=3); S2 "Tiada tebusan dalam status ini."; S5 "Tiada Hadiah Tersedia" / "Hadiah akan ditambah tidak lama lagi. Tunggu ya!"; S6 all buttons "🔒 Token Tidak Cukup"; S7 "Tiada cabutan dibuka buat masa ini. Nanti datang lagi! 🎈"; S8 "Tiada tebusan menunggu kelulusan." / "Belum ada sejarah tebusan."; S3 native "Please fill out this field." (×4); 404 (S4 unknown id); 405 (S9).

## 2. Link crawl (`_crawl.json`)

258 URLs classified; **67 are M15** (catalogue with 10 `cat` values + `page`, row "Edit" links and the PUT actions of the captured edit forms, `baharu`, `bulk`, tebusan with 6 `status` values, the 4 mystery-box open actions, the 4 student routes). The rest are shell links classified to their owning modules. Unknown (7): `/`, `/latih-tubi` (404-page links), `/api/tournament/active`, `/fcm/token`, `/chatbot/send`, `/chatbot/rate`, `/chatbot/history?session_id=…` — all global shell endpoints.

**New routes (not in TRACKER):** `/admin/hadiah/tebusan`, `/admin/hadiah/baharu`, `/admin/hadiah/{id}/edit` (and its `PUT /admin/hadiah/{id}`; GET → 405), `POST /admin/hadiah/bulk`, `POST /gamification/mystery-box/{id}/open`.

**Probed, 404:** `/gamification/rewards/1`, `/gamification/rewards/history`, `/gamification/redemptions`, `/gamification/mystery-box/1`, `/gamification/mystery-box/history`, `/cabutan/1`, `/cabutan/sejarah`, `/admin/cabutan`, `/admin/mystery-box`, `/admin/hadiah/tebusan/1`, `/admin/hadiah/99999/edit`.

**Owned elsewhere:** `/admin/reward-control` (Cabutan admin + legacy reward costs) → M14 S10; `/gamification/convert` → M14 S12; `/guru/gamifikasi/kedai`, `/admin/gamifikasi/guru/tebusan` → M14.

## 3. Reconciliation

`node diff-narrative.cjs inventory/M15 docs/discovery/M15-rewards-shop.md` → **0 candidates on every screen**.

**Not in narrative:** (none)

## 4. Read-only limits

Not observable without changing data or another account (full list in the narrative, "States requiring a live action"): active-reward rows and the "On" pill; pending/delivered redemption rows and their S2 actions; the student reward cards and claim flow; the enabled mystery-box button, result modal, history and odds; any cabutan draw, ticket purchase or winner; the parent approval request and history; every server-side validation and flash message.

Nothing was submitted, bought, redeemed, opened, drawn, approved, rejected, added, edited or deleted. GETs were sequential with ≥ 350 ms spacing.
