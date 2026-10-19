# M17 — Element inventory & link crawl: summary

- **Captured:** 2026-09-26 (11:55–12:45 MYT) from live https://prestasiplus.my, read-only, admin session on browser lane 1 (`playwright`). Credentials are not stored.
- **Method:** the standard pipeline: `tools/inventory.js` → `tools/run-state.js` → `tools/split-batch.js` → `tools/merge-inventory.js` → `tools/diff-narrative.js`. **No shared tool was modified**; the tools ran directly (the `tools/package.json` `"type": "commonjs"` fix from M15 is in place).
  - Capture plan: `tools/jobs/M17.js`, 77 UI states over 11 screens in groups A–K.
  - Screen map: `tools/jobs/M17.screens.json` (with classification rules: `/admin`, `/admin/laporan`, `/admin/monitoring` → M17 because the TRACKER also mentions them under M01 / M12 / M11; `/admin/performance` → M23; `/guru/command-center` → M10).
  - Crawl: `tools/jobs/M17-crawl.js` (35 URLs in three passes, incl. 16 probes of unknown ids, bad query values and guessed routes).
  - Seed snapshot: `tools/jobs/M17-snapshot.js` → `_snapshot-2026-09-26.json` (includes the layout measurements).
  - Responsive measurements: `tools/jobs/M17-measure.js` (11 routes × 375 / 768 / 1280; stored under `layout` in the snapshot; results in narrative §8.1).
  - Masked screenshots: `tools/shoot.js` with an inline shot list (44 PNGs in `docs/discovery/img/M17/`).
- **Privacy:**
  - Persons appear on S2, S3 (live data), S4–S7 (tables, breadcrumbs, modals) and S11 (top pupils, teachers never logged in with e-mails, teacher and pupil tabs).
  - Each job runs `M17MASK` first: it stops all intervals, wraps `window.fetch` so every Command Center JSON has `name`, `student`, `student_name`, `teacher_name`, `reason`, `full_name` replaced by `<name>`, re-runs the page's loader, tags person crumbs / "Guru:" values / overview name + e-mail lines / `[data-name]` person rows / e-mail-shaped leaves as `.m17n`, and rewrites `…/student/{id}`, `…/teacher/{id}` in links. `tools/sanitize.js` then runs with `{selectors:['.m17n'], titleName:false, cols:'^(nama|murid|pelajar)'}`. `titleName:false` because the default title rule would mask "Command Center" instead of the name; M17MASK sets the title of S5 / S7 to `<name> - Command Center` itself.
  - `piiLeakCheck` = **0 leaks in all 77 states**.
  - The snapshot never returns person names (`<student:n>`, `<teacher:n>`, `<person:n>` tokens; e-mails as a domain class; person ids as `<id>`).
  - A scripted check compared every M17 file in `docs/discovery` (inventory, raw captures, jobs, snapshot, narrative; 97 text files) against the 119 person names and e-mails read live: **0 hits**. The unmasked scratch dumps (`.playwright-mcp/m17-disc/`) were deleted at the end of the run.
  - School names are kept (observed public anchors). Server host name and process user from `/admin/performance` (M23) were not written anywhere.
- **Files:** `S1-dashboard.json` … `S11-laporan.json`, layout chrome `SHA-admin-shell.json` (S1, S8–S11), `_crawl.json`, `_snapshot-2026-09-26.json`; raw captures `../_raw/M17/*.json` (77).
- **Status legend:** as M01–M15; `normalizeIds` on. Long lists sampled with `opts.repeat` (S1 latest questions, S2 feed / top lists, S3 feeds, S4–S6 table rows, S7 modal rows, S8 lists, S10 matrix rows, S11 tables: 2–3 samples each; totals in `meta.repeats`). Full row data is in the snapshot.

## 1. Per-screen counts

M17 content totals **1,851 elements** over 11 screens and **77** captured states (1280 / 768 / 375). The shell adds 233 (SHA) chrome elements, which are not M17 content. S2–S7 are standalone pages without a shell, so all their elements are content.

| Screen (route) | Total | Visible default | Conditional | Hidden only | Mobile only | Desktop only | States | States captured |
|---|---|---|---|---|---|---|---|---|
| S1-dashboard `/admin` | 87 | 87 | 0 | 0 | 0 | 0 | 3 | default @1280/@375/@768 |
| S2-command-center `/admin/command-center` | 108 | 106 | 1 | 1 | 0 | 60 | 3 | default @1280/@375/@768 (live data after the first poll; polling stopped) |
| S3-daily-activity `/admin/command-center/daily-activity` | 376 | 63 | 245 | 68 | 14 | 2 | 9 | default (today), week, month, drill, month-drill, query-ignored (@1280); default, drill @375; default @768 |
| S4-cc-school `/admin/command-center/school/{id}` | 29 | 19 | 10 | 0 | 0 | 0 | 5 | 8082, 8080, not-found 404 (@1280); default @375/@768 |
| S5-cc-teacher `/admin/command-center/school/{sid}/teacher/{uid}` | 27 | 15 | 12 | 0 | 0 | 0 | 6 | 7 classes, 1 class, 0 classes, not-found 404 (@1280); default @375/@768 |
| S6-cc-classroom `/admin/command-center/classroom/{id}` | 31 | 24 | 7 | 0 | 0 | 0 | 4 | 370, not-found 404 (@1280); default @375/@768 |
| S7-cc-student `/admin/command-center/student/{id}` | 86 | 47 | 33 | 6 | 0 | 0 | 11 | default, all-sessions, week, week-empty, subject, session, headcount, not-found 404 (@1280); default, session @375; default @768 |
| S8-laporan-eksekutif `/admin/laporan-eksekutif` | 327 | 288 | 37 | 2 | 0 | 0 | 6 | 2026 (default), year-2025, year-2027, year-invalid 500 (@1280); default @375/@768 |
| S9-eksekutif-sekolah `/admin/laporan-eksekutif/sekolah/{id}` | 113 | 99 | 14 | 0 | 0 | 0 | 5 | 8880, 5183 (no data), not-found 404 (@1280); default @375/@768 |
| S10-analytics `/admin/analytics` | 494 | 494 | 0 | 0 | 0 | 0 | 3 | default @1280/@375/@768 |
| S11-laporan `/admin/laporan` | 173 | 119 | 54 | 0 | 0 | 0 | 22 | default, range-7, range-90, range-invalid, tab-sekolah, sekolah-{aktif, kurang, tidak, search}, tab-guru, guru-{login, belum, school, search-none}, tab-murid, murid-{aktif, login, belum, school} (@1280); default, tab-guru @375; default @768 |
| SHA-admin-shell (chrome of S1, S8–S11) | 233 | 75 | 40 | 118 | 7 | 70 | 37 | all SHA states |

- S2 "desktop-only" 60: at 375 the 3-column board does not collapse and 60 elements are clipped off-screen (narrative D-M17-01), not a designed mobile variant.
- S3 "hidden-only" 68: the 24 heatmap tooltips plus drill links rendered as masked (`<name>`) anchors; "mobile-only" 14 are live clock and "… minit yang lepas" readings captured only in the 375 states.

**Horizontal page overflow** (inventory flag + direct measurement): S4, S5, S6, S7, S8, S9 at 375 (554 / 588 / 652 / 395 / 525 / 429 px), S11 at 375 (388 px). S2 has no page scroll because the body clips (content cut instead). No overflow at 768 / 1280.

**Empty / error states captured:** S3 "Tiada aktiviti", "Tiada data", "Tiada badge baru", "-" (subjects); S5 "Senarai Kelas (0)" (empty table, no message); S7 "Tiada data mood"; S7 zero-answer week bar (click ignored); S8 empty year (0 figures; sections omitted); S8 500 "Ralat Pelayan"; S9 no-data school; S11 "Kurang (0)", "Login Sahaja", "Belum Login", no-match search (empty tables without a message); 404 "Halaman Tidak Dijumpai" on S4–S7 and S9.

## 2. Link crawl (`_crawl.json`)

158 URLs classified; **72 are M17**: S1 export links (4, never opened), S2 / S3 / S4–S7 drill links and templates (`__ID__`, `__SID__`, `__UID__`), class ids 366–372 / 813, the 4 `/api/command-center/*` families, `live-data`, S8 year links (`?year=2023…2027`), 9 "Fokus →" school links, `clear-cache` POST, S11 `?range=` links. The rest are shell links classified to their owning modules (M01–M26). Unknown (2): `/` and `/latih-tubi` (links of the global 404 page).

**New routes (not in TRACKER):** `/admin/command-center/school/{id}`, `/admin/command-center/school/{sid}/teacher/{uid}`, `/admin/command-center/classroom/{id}`, `/admin/command-center/student/{id}`, `/admin/laporan-eksekutif/sekolah/{id}`; endpoints `GET /admin/command-center/live-data`, `GET /api/command-center/daily-activity`, `GET /api/command-center/daily-activity/school/{id}`, `GET /api/command-center/student/{id}/week`, `GET /api/command-center/student/{id}/subject`, `GET /api/command-center/session/{id}`, `GET /api/command-center/headcount/{id}`, `POST /admin/laporan-eksekutif/clear-cache`, `GET /admin/export/{users,questions,payments,schools}`.

**Probed:** 404 — `/admin/dashboard`, `/admin/statistics`, `/admin/reports`, `/admin/command-center/school`, `/admin/laporan-eksekutif/sekolah`, unknown ids on S4–S7 / S9; 500 — `/admin/laporan-eksekutif?year=abc`; 200 fall-backs — `/admin/laporan?range=999` (→ 30), `/admin/analytics?tab=x` (ignored), `/admin/command-center/daily-activity?period=week` (ignored).

**Owned elsewhere:** `/admin/monitoring*` → M11 component (identity re-verified: `/admin/monitoring` = `/guru/monitoring`, 221,357 chars); `/admin/performance` → **M23** (system performance & security, not academic); `/guru/command-center/*` → M10 (same drill-down templates; recommendation: M17 owns them); `/admin/audio-kbat` → M09; Kirkpatrick submenu → M12.

## 3. Reconciliation

`node tools/diff-narrative.js inventory/M17 M17-admin-dashboard.md` → **0 candidates on every screen** (S1–S11).

**Not in narrative:** (none)

## 4. Read-only limits

- Not opened / not sent: the 4 CSV exports, S8 "Refresh" (`POST …/clear-cache`), the monitoring PDF / CSV exports, the S1 quick-action forms.
- Not observable with today's data: S3 subject breakdown and live feed with rows, S3 mood / badges, S7 mood trend and mood-day modal, S2 "Top Improvers", positive / zero week change, S2 / S3 / S7 error branches.
- Admin account only: what PPD / JPN / school-admin / teacher accounts see on these routes is not known (narrative OQ-M17-08, OQ-M17-10).
