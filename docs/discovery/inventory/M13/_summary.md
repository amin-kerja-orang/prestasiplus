# M13 — Element inventory & link crawl: summary

- **Captured:** 2026-09-25 from live https://prestasiplus.my, read-only, admin session on browser lane 1 (`playwright`). Credentials are not stored.
- **Method:** the same pipeline as M01–M11: `tools/inventory.js` → `tools/run-state.js` → `tools/split-batch.js` → `tools/merge-inventory.js` → `tools/diff-narrative.js`.
  - Capture plan: `tools/jobs/M13.js`, 37 UI states over 8 screens in groups A–C.
  - Screen map: `tools/jobs/M13.screens.json`.
  - Masked screenshots: `tools/jobs/M13.shots.js` + `tools/shoot.js`, 21 PNGs in `docs/discovery/img/M13/`.
  - Appendix generator: `tools/jobs/M13-appendix.js` (copy of the M11 helper).
  - Layout probe: `tools/jobs/M13-probe.js` (page overflow, sub-12px text, control boxes, clipped tables; read-only).
  - **No shared tool was modified.**
- **Safety (no AI call):**
  - Never clicked: chat "Hantar", mic "🎤", "Jana RPH dengan Cikgu Alesa", "Jalankan Auto-Tag", "Lulus pukal (TP cadangan)".
  - Never opened: "Eksport CSV (Approved)".
  - RPH validation was shown with `reportValidity()` only.
  - The essay handoff used a neutral dummy text, which only navigates by GET to `/cikgu?action=…`. `/cikgu` does not auto-send, and the dummy text was removed from `sessionStorage`.
  - The voice toggle was set without a `change` event, so `localStorage` was not written.
  - The GETs that reached POST-only routes (`/cikgu/send`, `/cikgu/pbd/rollup`, `/cikgu/pbd/bulk-approve`) returned 405 and ran nothing.
  - Navigations ran sequentially with at least 350 ms between them.
- **Privacy:**
  - `M13MASK` replaces the three real teacher names in the `/cikgu` header by `<nama>` (structurally; no name is written in any file).
  - The handoff query's `student` value is masked in the location.
  - `tools/sanitize.js` (defaults) masks the shell user.
  - `meta.piiLeakCheck` = 0 leaks in all 37 states.
  - A grep of `docs/` for the three names finds nothing.
  - The temporary unmasked page dumps (`.playwright-mcp/lane1/m13/`) and this session's MCP snapshots and console logs were deleted.
  - All M13 lists are empty for the admin account, so no student data was on screen.
- **Files:**
  - Screen inventories: `S1-cikgu-chat.json` … `S8-method-not-allowed.json`.
  - Layout chrome: `SHU-user-shell.json` (owned by 00-global-ui).
  - `_crawl.json`.
  - Raw captures: `../_raw/M13/*.json` (37).

## 1. Per-screen counts

M13 content totals **137 elements** over 8 screens and **37** captured states (1280 / 768 / 375). The shell adds 372 SHU chrome elements, which are not M13 content.

| Screen (route) | Total | Visible default | Conditional | Hidden only | Mobile only | States | States captured |
|---|---|---|---|---|---|---|---|
| S1-cikgu-chat `/cikgu` | 16 | 12 | 0 | 4 | 0 | 6 | default, voice-on, ask-prefill, essay-handoff (@1280); default @375/@768 |
| S2-rph-list `/cikgu/rph` | 13 | 4 | 6 | 3 | 2 | 5 | default, page-2 (@1280); default, page-2 @375; default @768 |
| S3-rph-baharu `/cikgu/rph/baharu` | 35 | 31 | 0 | 4 | 0 | 5 | default, classroom-param, validity (@1280); default @375/@768 |
| S4-essay-list `/cikgu/essay` | 13 | 4 | 4 | 5 | 0 | 4 | default, page-2 (@1280); default @375/@768 |
| S5-essay-baharu `/cikgu/essay/baharu` | 28 | 21 | 4 | 3 | 0 | 6 | default, typed, too-short, rubric-general (@1280); default @375/@768 |
| S6-pbd-queue `/cikgu/pbd` | 22 | 11 | 4 | 7 | 0 | 6 | default, select-all, classroom-param, page-2 (@1280); default @375/@768 |
| S7-not-found `/cikgu/rph/{id}`, `/cikgu-alesa` | 7 | 7 | 0 | 0 | 0 | 3 | rph-id, cikgu-alesa (@1280); rph-id @375 |
| S8-method-not-allowed `GET /cikgu/send` | 3 | 3 | 0 | 0 | 0 | 2 | @1280 / @375 |
| SHU-user-shell (chrome of S1–S6) | 372 | 152 | 15 | 205 | 15 | 32 | all SHU states |

Hidden-only elements on S1–S6 are mostly the shell tournament banner templates ("LIVE:", "MAIN", "DAFTAR") inside `<main>` and the `_token` / thread-id hidden fields.

The S3 `datalist#subject-list` (31 options) and the table empty-state rows are not separate inventory elements. They are quoted in the narrative (§2.2–2.6, Appendix A.2).

**Horizontal page overflow:**
- Flagged by the inventory: `S1-cikgu__default__375` (the only one).
- Direct measurement with `M13-probe.js`: `/cikgu` at 375 = **408 px** (D-M13-3). S2/S4/S6 have no page overflow, but their tables are clipped inside `overflow-hidden` cards at 375 (right edges 430 / 447 / 408 px; D-M13-4). Nothing overflows at 768 or 1280.
- Text below 12px: none in M13 content at any width.

**Empty / error states captured:**
- S2 "Belum ada RPH. …", S4 "Belum ada karangan dimark. …", S6 "Tiada antrian semakan. …".
- S3 "Sistem belum jumpa kelas yang dikaitkan dengan akaun Cikgu. Sila isi manual.".
- S3 native validation (3 fields), S5 alert "Karangan terlalu pendek (minimum 50 aksara).".
- `?page=2` paginator "Showing 0 of 0 results".
- 404 (S7), 405 (S8).

## 2. Not in the narrative discovery

`node tools/diff-narrative.js inventory/M13 docs/discovery/M13-cikgu-alesa.md` reports **0 candidates on all 8 screens**. The not-in-narrative list is **empty**.

Appendix B of the narrative holds the remaining exact DOM strings and the shell inline-script strings (generated by `tools/jobs/M13-appendix.js`). Appendix A holds the enumerations.

Items that only the state captures and source reading surfaced, all now in the narrative:
1. The essay handoff (S5 → S1) is broken: `?action=mark_essay…` and `sessionStorage.cikgu_pending_essay` are ignored by S1 → D-M13-1.
2. Voice mode never speaks (the observer targets non-existent containers) → D-M13-2.
3. S1 page overflow at 375 → D-M13-3. Table clipping on S2/S4/S6 at 375 → D-M13-4.
4. The lists are paginated (`?page=2` reveals the Laravel paginator with English copy) → D-M13-9.
5. `/cikgu-alesa` (linked from M25 `/pusat-nota-ringkas`) is 404 → D-M13-7.

## 3. New routes found by the crawl

151 unique URLs are in `_crawl.json`: 22 M13, and others via the shell (M10 17, M18 12, M05 9, M14 9, M08 8, M01 7, M12 7, …); 8 unknown (shell endpoints `/api/tournament/active`, `/chatbot/*`, `/fcm/token`; `/` and `/latih-tubi` from the 404 page; `/cikgu-alesa`).

New M13 routes and endpoints (not in the TRACKER checklist):
- `/cikgu/rph/baharu` — RPH create form (S3)
- `/cikgu/essay/baharu` — essay form (S5)
- `POST /cikgu/send` — chat turn (JSON)
- `POST /cikgu/rph` — generate RPH
- `POST /cikgu/pbd/rollup` — run auto-tag
- `POST /cikgu/pbd/bulk-approve` — bulk approve
- `GET /cikgu/pbd/export.csv` — export (target only)
- Query states: `/cikgu?ask=`, `/cikgu?action=mark_essay&…`, `?page=` on the three lists

Probed and **404**: every `/{id}`, `/edit`, `/print`, `/pdf`, `/create` variant under `/cikgu/rph`, `/cikgu/essay`, `/cikgu/pbd`, plus `/cikgu/history`, `/cikgu/threads`, `/cikgu/quota`, `/admin/cikgu*`, `/admin/ai*`, `/cikgu-alesa` (full list in narrative §1).

## 4. States requiring a live AI call

See narrative §7 (AI-1 … AI-10). None was executed.
