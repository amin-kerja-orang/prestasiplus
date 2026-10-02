# M11 — Element inventory & link crawl: summary

- **Captured:** 2026-09-25 from live https://prestasiplus.my, read-only, admin session on browser lane 2 (`playwright2`). Credentials are not stored.
- **Method:** the same pipeline as M01–M08: `tools/inventory.js` → `tools/run-state.js` → `tools/split-batch.js` → `tools/merge-inventory.js` → `tools/diff-narrative.js`.
  - Capture plan: `tools/jobs/M11.js`, 57 UI states over 8 screens in groups A–F.
  - Screen map: `tools/jobs/M11.screens.json`.
  - Masked screenshots: `tools/jobs/M11.shots.js` + `tools/shoot.js`, 31 PNGs in `docs/discovery/img/M11/`.
  - Appendix generator: `tools/jobs/M11-appendix.js` (copy of the M08 helper).
  - Read-only helpers used to study structure before writing the plan: `tools/jobs/M11-probe.js` (structure summary without table-cell text), `tools/jobs/M11-compact.js` (collapsed, masked `<main>` HTML).
  - **No shared tool was modified.**
- **Privacy (students are minors):**
  - Every job runs its client-side reveal actions, then `M11MASK` (in `tools/jobs/M11.js`), then `tools/sanitize.js {selectors:['.m11n'], titleName:false}`.
  - `M11MASK` masks student and teacher names (monitoring links and the e-mail line under them, the drill-down `<h2>` **and** the admin top bar / breadcrumb / `<title>` that echo it, laporan lists), names inside Alpine `x-show` search expressions, school names (`<school>`) and school codes (`<kod>`), avatars, and person-record ids in links and in the location (`/pelajar/{id}`, `/guru/{id}`). It also keeps only the first S4 question row's `@click` JSON payload and replaces the others with their key list, because those payloads are question-bank data rather than UI copy.
  - Two fixes during capture: a first S4/S5 run showed the student name in the admin top bar, and sanitize page-scrubbed the "Tingkatan n" chapter labels (because the header e-mail line had been tagged). The mask was changed and all S3–S5 states were re-captured.
  - `meta.piiLeakCheck` is 0 leaks in all 57 states.
  - An extra in-page check compared every captured batch against the original names and e-mails read live from the pages (school, drill-down headers, every row of the school and teacher tables, weekly-table school names): **0 leaks**. The only hit was a 5-letter name inside a place name in a question source string (a false positive).
  - A grep of all raw and merged M11 files, the narrative and the job files for e-mail, `bin`/`binti`/`A/P`/`A/L`, school-name and school-code patterns finds only a historical figure named in a Pendidikan Islam question ("Saidina Uthman bin Affan r.a.") and the regex/example strings in the job files. No personal data.
  - The temporary unmasked structure dumps written under the git-ignored `.playwright-mcp/lane2/m11/` and this session's MCP console log (it echoed one Alpine error containing a student name) were deleted. The mask regex for `x-show` search expressions was made apostrophe-safe; no sampled row contained such a name, so no captured file was affected.
- **Files:**
  - Screen inventories: `S1-laporan.json` … `S8-laporan-mingguan-kelas.json`.
  - Layout chrome: `SHU-user-shell.json` (S1, S6) and `SHA-admin-shell.json` (S2–S5), owned by the global doc.
  - `_crawl.json`.
  - Raw captures: `../_raw/M11/*.json` (57).
- **Status legend:** same as M01–M08. `normalizeIds` is on. Long lists are sampled with **variant-partitioned** `opts.repeat` selectors (one sample per row type), with totals in each state's `meta.repeats`:
  - S1: "Belum Pernah Buat Latihan" rows 3 of 10;
  - S2: pelajar/guru table rows 1 per tahap colour (of 33 / 13), weekly rows 1 per trend icon (of 33);
  - S3: student rows 2 active + 1 "Perlu Semak" + 1 "Perlu Semak · ditapis" + 1 "Login sahaja" + 1 "Belum login" (of 184), teacher rows 2 of 34;
  - S4: question rows 2 wrong + 2 right (of 71–265), wrong-answer cards 2, topic rows 1 per badge, subject rows 3, untried-subject chips 3;
  - S5: student rows 3 active + 1 per inactive status (of 184).

## 1. Per-screen counts

M11 content totals **937 elements** over 8 screens and **63** captured states (819 / 57 at discovery + 118 elements / 6 states appended in the audit top-up) (1280 / 768 / 375). The shells add 374 (SHU) and 252 (SHA) chrome elements, which are not M11 content.

| Screen (route) | Total | Visible default | Conditional | Hidden only | Mobile only | Desktop only | States | States captured |
|---|---|---|---|---|---|---|---|---|
| S1-laporan `/guru/laporan` | 75 | 31 | 38 | 6 | 0 | 0 | 12 | default, range-7, range-90, range-invalid, card-login, card-latihan, card-aktiviti, card-skor, card-toggle (@1280); default, card-aktiviti @375; default @768 |
| S2-monitoring `/guru/monitoring` | 308 | 220 | 87 | 1 | 0 | 0 | 10 | default, guide-hidden, refresh-paused, period-7d, period-3m, state-tahap, filter-empty, audit-period-30d (@1280); default @375/@768 |
| S3-monitoring-sekolah `/guru/monitoring/sekolah/{id}` | 111 | 55 | 56 | 0 | 0 | 0 | 15 | default, filter-active, filter-login, filter-never, search-none, teacher-active, teacher-never, no-teacher, not-found 404, audit-cancelled (8102), audit-expired (8107), audit-warn-no-excluded (8087), audit-warn-single (10220) (@1280); default @375/@768 |
| S4-monitoring-pelajar `/guru/monitoring/sekolah/{id}/pelajar/{id}` | 372 | 38 | 181 | 153 | 0 | 0 | 14 | default, tab-topic, tab-all, tab-all-more, modal, tab-wrong, tab-gaps-none, tab-gaps, tab-gaps-2, not-found 404, audit-topics-all (@1280); default, modal @375; default @768 |
| S5-monitoring-guru `/guru/monitoring/sekolah/{id}/guru/{id}` | 40 | 33 | 7 | 0 | 0 | 0 | 4 | default, not-found 404 (@1280); default @375/@768 |
| S6-analisis-item `/guru/analisis-item` | 17 | 13 | 1 | 3 | 0 | 0 | 4 | default, subject (@1280); default @375/@768 |
| S7-perbandingan-kelas `/guru/perbandingan-kelas` | 7 | 7 | 0 | 0 | 0 | 0 | 2 | HTTP 500 @1280/@375 |
| S8-laporan-mingguan-kelas `/guru/laporan-mingguan-kelas` | 7 | 7 | 0 | 0 | 0 | 0 | 2 | HTTP 403 @1280/@375 |
| SHU-user-shell (chrome of S1, S6) | 374 | 152 | 17 | 205 | 15 | 148 | 16 | all SHU states |
| SHA-admin-shell (chrome of S2–S5) | 252 | 75 | 50 | 127 | 7 | 70 | 34 | all SHA states |

S4's 160 hidden-only elements are mostly the Gap Analysis panel, which never becomes visible on live (D-M11-2), plus the other students' tab content captured in the gap states.

**Horizontal page overflow:**
- Flagged by the inventory: none (all 57 states).
- Direct `scrollWidth` measurement on the **unmasked** pages: `/guru/laporan` at 375 = **450 px > 375** (long student e-mails widen the grid card; hidden in the masked capture because masked e-mails are short) → narrative D-M11-16. All other screens: ≤ viewport at 375 and 768.

**Empty / error states captured:**
- S1 "Belum ada aktiviti", "Semua pelajar sudah pernah login!", "Semua pelajar sudah aktif buat latihan!".
- S2 "Tiada pemerhatian yang perlu diberi perhatian buat masa ini." and empty tables ("0 sekolah").
- S3 "Tiada guru berdaftar untuk sekolah ini.", "Tiada langganan", search with no matches (no message).
- S4 "Tiada topik lemah dikesan!" (hidden panel), "Pilihan jawapan telah dipadam dari sistem." (modal template).
- S6 "Tiada data analisis item untuk paparan ini." / "Pelajar perlu membuat latihan dahulu.".
- 404 pages: S3, S4, S5 unknown ids. 500: S7. 403: S8.

## 1a. Audit top-up (2026-09-25, AUD-M11-02/-03/-05/-06/-07)

- **Seed snapshot:** `_snapshot-2026-09-25.json`, captured in one pass **2026-09-25 19:24:59–19:26:29 MYT** (lane 2, read-only). It holds:
  - S2 for all four periods (default, 7d, 30d, 3m): every pelajar- and guru-table row with its live school id, every weekly cell with its colour class, Trend and Best, the KPI cards, and the Terbaik / Perhatian / Cadangan lists with names tokenised as `<school:{id}>`;
  - S3 for all 34 linked schools: cards, subscription, tahap, warning box, status / flag / "answered without login" counts, pill labels and the rows each pill shows, per-row `x-show` booleans;
  - S5 for 8080 and the S4 topic rows for Student A (2008);
  - `derivedRules` and `notes` (drift, internal inconsistencies).

  No person names or e-mails are in the file. It is the **seed source**; live values had drifted since discovery (Soalan Dijawab 472,261 → 472,371).
- **New inventory states** (group G in `tools/jobs/M11.js`): S2 `audit-period-30d`; S3 `audit-cancelled` (8102), `audit-expired` (8107), `audit-warn-no-excluded` (8087), `audit-warn-single` (10220); S4 `audit-topics-all` (Student A, every topic row).
  - A planned S3 "Aktif pill at 8080" state was dropped: its sanitize leak check reported 1, and the pill evidence is in the snapshot instead.
  - All new states: sanitize leak check 0; an in-page check against the live school, header and table names found 0 leaks.
- **IDs:** `tools/jobs/M11-idpin.js` restored every pre-top-up ID after the re-merge (matching on a content signature) and appended 118 new IDs: S2-296…308, S3-075…111, S4-305…372. Two old IDs (S2-281, S4-230) are identical-text siblings that the re-merge folded together; they were kept with a note so that no ID disappears.
- **Colour rule (OBSERVED, 0 exceptions over 4 periods):** 0 → "-" slate; M1 > 0 → blue; later weeks compared with the previous cell (0 counts): higher → green, lower → red, equal (> 0) → blue; the maximum week gets an amber ring.
- **Pill rules (OBSERVED on 34 schools):**
  - Aktif = answered (includes ditapis and rows without a login). The label count excludes ditapis, e.g. "Aktif (165)" shows 174 rows.
  - Login sahaja = no answer + login.
  - Belum login = no login (includes answered rows without a login).
  - Apostrophe-name rows show under every pill.

## 2. Not in the narrative discovery

`node tools/diff-narrative.js inventory/M11 docs/discovery/M11-teacher-analytics.md` reports **0 candidates on all 8 screens**. The not-in-narrative list is **empty**.

Appendix B of the narrative holds the remaining exact DOM strings, data samples and shell inline-script strings (generated by `tools/jobs/M11-appendix.js`). Appendix A holds the enumerations.

Items that only the inventory and state captures surfaced, all now in the narrative:
1. S4 "Gap Analysis" tab blanks the page: the panel is outside the Alpine `tab` scope (verified: `tab = 'gaps'`, every panel `display:none`) → D-M11-2.
2. S4 "Jawapan Salah" has no "Papar lagi"; only 10 of up to 97 answers are reachable → D-M11-6.
3. S2 `tahap` filters only the pelajar table; `period` does not change the guru or weekly tables.
4. S2 "Reset" appears only when a filter is set, and points to `/admin/monitoring`.
5. S3 vs S2/S5 disagree for the same school (165 / 89.7% vs 174 / 94.6%) → D-M11-11.
6. S1 card vs panel contradictions → D-M11-1.
7. S2 filter selects are 18 px tall at 375 → D-M11-17.
8. The browser console on S3 logged "Alpine Expression Error: Unexpected identifier" for a student whose name contains an apostrophe (the row filter embeds names unescaped) → D-M11-18.

## 3. New routes found by the crawl

238 unique URLs are in `_crawl.json`: 19 M11, 32 M17, 17 M10, 16 M12, 15 M14, 12 M18, and others via the shells; 7 unknown.

Not yet in the TRACKER M11 checklist:

| URL | Kind | Found on | Note |
|---|---|---|---|
| `/guru/monitoring/sekolah/{id}` | screen | S2 (as `/admin/…` link), probe | S3; twin of M17 `/admin/monitoring/sekolah/{id}` |
| `/guru/monitoring/sekolah/{id}/pelajar/{id}` | screen | S3/S5 (as `/admin/…` links) | S4; school segment not validated |
| `/guru/monitoring/sekolah/{id}/guru/{id}` | screen | S3 (as `/admin/…` link) | S5 |
| `/guru/laporan?range=7\|30\|90&classroom_id=` | filter variants | S1 | unknown range → 30 |
| `/guru/monitoring?period=&state=&tahap=` | filter variants | URL probe | the page's own form targets `/admin/monitoring` |
| `/guru/analisis-item?subject_id=&classroom_id=` | filter variants | S6 | — |

**Unknown in the crawl:** `/` (error pages' "Halaman Utama"), `/latih-tubi` (404 page "Mula Latihan", itself a 404, M06 D-8), `/api/tournament/active`, `/chatbot/*`, `/fcm/token` (shell widgets).

## 4. Out-of-module links (target module)

| URL | Found on | Target |
|---|---|---|
| `/admin/monitoring`, `/admin/monitoring?…` (form, Reset) | S2 | M17 |
| `/admin/monitoring/export/pdf?…`, `/admin/monitoring/export/csv?…` | S2 | M17 (export formats PDF, CSV; **not opened**) |
| `/admin/monitoring/sekolah/{id}`, `…/pelajar/{id}`, `…/guru/{id}` | S2, S3, S5, S4/S5 breadcrumb | M17 (same templates as S3–S5) |
| `/admin/kirkpatrick/pelajar/{id}` | S3 (inactive students) | M12 |
| `/admin/server-status` | SHA shell script | M01 / global |
| `/prestasi/kelas`, `/amaran` | SHU sidebar | M08, M18 |
| `/login` | S8 | M01 |

## 5. What could not be revealed read-only / safety notes

| Item | Why |
|---|---|
| `/guru/perbandingan-kelas` content (comparison dimensions, charts) | HTTP 500 for the admin account (also with `?classroom_id=4`) |
| `/guru/laporan-mingguan-kelas` weekly class report sections | HTTP 403 for the admin account (also `?week=1`, `/4`) |
| `/guru/analisis-item` populated table; S1 "Paling Aktif", per-type chips, score colours | Admin owns no class; no activity in scope |
| What a teacher sees on `/guru/monitoring*` and whether it can reach the `/admin/*` links | Admin account only |
| Monitoring PDF / CSV export contents | Export links not opened (safety rule) |
| Anomaly thresholds, gap rule, S1 student population | Server-side |

Safety: nothing was submitted, exported or printed; no quiz or session URL was opened; filters were applied through URL query strings; all reveals were client-side; navigations ran sequentially with ≥ 350 ms between them.
