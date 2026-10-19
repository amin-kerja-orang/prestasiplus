# M18 — Element inventory & link crawl: summary

- **Captured:** 2026-09-26 (12:10–12:55 MYT) from live https://prestasiplus.my, read-only, admin session on browser lane 2 (`playwright2`). Credentials are not stored. No PPD / JPN officer account was used; no "Login As" / impersonation.
- **Method:** the standard pipeline: `tools/inventory.js` → `tools/run-state.js` → `tools/split-batch.js` → `tools/merge-inventory.js` → `tools/diff-narrative.js`. **No shared tool was modified**; they ran directly (`tools/package.json` makes them CommonJS).
  - Capture plan: `tools/jobs/M18.js`, 136 UI states over 33 screens in groups A (PPD), B (JPN), C (Amaran), D (school drill-downs + item analysis), E (Kombo officer views).
  - Screen map: `tools/jobs/M18.screens.json` (extra module rules: `/ppd/*`, `/jpn/*`, `/amaran*`, `/analisa-item/(ppd|jpn)`, `/sekolah/{id}/(prestasi|amaran|kombo|analisa-item)`, `/kombo/(ppd|jpn|sekolah/{id})` → M18).
  - Crawl: `tools/jobs/M18-crawl.js` (structural GET crawl of 54 URLs incl. 16 probes; page text stayed in the browser) and `tools/jobs/M18-crawl-post.js` (adds every crawled page with its HTTP status and every in-page link — the inventory keeps only 3 sample rows per table — to `_crawl.json`).
  - Seed snapshot: `tools/jobs/M18-snapshot.js` → `_snapshot-2026-09-26.json` (55 pages + a 4-page Kombo supplement; person names tokenised in the parsed copy before reading).
  - Responsive measurements: `tools/jobs/M18-measure.js` (33 routes × 375/768/1280; stored in the snapshot under `layout`).
  - Masked screenshots: `tools/jobs/M18.shots.js` + `tools/shoot.js` (63 PNGs in `docs/discovery/img/M18/`).
- **Privacy:**
  - `M18MASK` (in `tools/jobs/M18.js`) tags person nodes (person-page links, the name line of "PELAJAR" cells, intervention rows, command-center student / feed names), strips Cloudflare e-mail payloads and avatars, masks intervention notes in place (`.m18l`) and replaces the student name in the intervention title; `tools/sanitize.js {selectors:['.m18n'], localSelectors:['.m18l'], keepCols:'^pelajar$', titleName:false}` masks the tagged nodes and the "Nama", "Nama Pelajar", "No. IC", "Email", "Guru" columns (the "PELAJAR" header is kept for column masking because in school tables it is a count column). Stat labels such as "Guru" under a count get an empty `<wbr>` child so sanitize's label→value rule does not mask the next stat card.
  - `piiLeakCheck` = **0 leaks in all 136 states**.
  - Independent check: 165 person-name strings and 177 word pairs were collected **in the browser** from the 16 person-bearing pages and only their SHA-256 hashes were saved (`.playwright-mcp/lane2/m18/name-hashes.json`, deleted after the check). A scratch script compared them with every 1–6-word window of every M18 file (raw captures, merged inventory, snapshot, narrative, jobs). The only hits are the class names "4 Simulasi" / "5 Simulasi" (a class-name line inside a student cell, not a person) — **0 person names**.
  - Found during capture: the intervention notes placeholder "Cth: Sesi kaunseling bersama pelajar tentang pengurusan masa..." had been scrubbed to "Cth: <name> …" because a note text equalled a UI phrase; notes were switched to in-place masking (`localSelectors`) and S24 was re-captured.
  - No unmasked dump was written to disk; scratch files (hash list, structural crawl, snapshot / measure temp files) were deleted at the end.
- **Files:** `S1-ppd-dashboard.json` … `S33-kombo-sekolah.json`, shell `SHU-user-shell.json` (all screens except S2, S11 and the error pages), `_crawl.json`, `_snapshot-2026-09-26.json`; raw captures `../_raw/M18/*.json` (136).
- **Status legend:** as M01–M15; `normalizeIds` on. Tables sampled with `opts.repeat` (3 rows of `main tbody tr`, 3 calendar cells `div[title^="20"]`, 3 mobile leaderboard cards, 3 class cards on `/amaran`, 3 critical-question cards on S25/S26/S30); the totals are in each state's `repeats` and the full rows are in the snapshot.

## 1. Per-screen counts

M18 content totals **2,264 elements** over 33 screens and **136** captured states (1280 / 768 / 375). The shell adds 417 chrome elements (not M18 content).

| Screen (route) | Total | Visible default | Conditional | Hidden only | Mobile only | Desktop only | States | States captured |
|---|---|---|---|---|---|---|---|---|
| S1-ppd-dashboard `/ppd/dashboard` | 232 | 222 | 0 | 10 | 0 | 0 | 4 | default, pager-next, default @375, default @768 |
| S2-ppd-command-center `/ppd/command-center` | 7 | 7 | 0 | 0 | 0 | 0 | 2 | forbidden (403), forbidden @375 (403) |
| S3-ppd-statistik `/ppd/statistik-penggunaan` | 24 | 17 | 4 | 3 | 0 | 0 | 7 | default, period-30days, period-7days, period-bogus, period-today, default @375, default @768 |
| S4-ppd-ranking `/ppd/ranking-kebangsaan` | 30 | 19 | 8 | 3 | 0 | 0 | 5 | default, period-7days, period-today, default @375, default @768 |
| S5-ppd-benchmark `/ppd/benchmark-sekolah` | 41 | 30 | 8 | 3 | 0 | 0 | 5 | default, subject-3, subject-bogus, default @375, default @768 |
| S6-ppd-peta-haba `/ppd/peta-haba` | 26 | 23 | 0 | 3 | 0 | 0 | 3 | default, default @375, default @768 |
| S7-ppd-export `/ppd/export-laporan` | 32 | 29 | 0 | 3 | 0 | 0 | 3 | default, default @375, default @768 |
| S8-ppd-leaderboard `/ppd/leaderboard-sekolah` | 69 | 45 | 20 | 4 | 16 | 5 | 5 | default, subject-3, tab-subjek, default @375, default @768 |
| S9-ppd-sekolah `/ppd/sekolah/{id}` | 291 | 158 | 126 | 7 | 0 | 0 | 10 | default, class-516, class-open, grade-t5, not-found (404), rank-subjek, school-8765, subject-3, default @375, default @768 |
| S10-jpn-dashboard `/jpn/dashboard` | 215 | 194 | 18 | 3 | 0 | 0 | 6 | default, district, search-empty, search, default @375, default @768 |
| S11-jpn-command-center `/jpn/command-center` | 44 | 42 | 2 | 0 | 1 | 2 | 3 | default, default @375, default @768 |
| S12-jpn-statistik `/jpn/statistik-penggunaan` | 18 | 15 | 0 | 3 | 0 | 0 | 3 | default, default @375, default @768 |
| S13-jpn-ranking `/jpn/ranking-kebangsaan` | 40 | 26 | 11 | 3 | 0 | 0 | 5 | default, period-7days, period-today, default @375, default @768 |
| S14-jpn-daerah `/jpn/daerah/{ppd}` | 24 | 14 | 7 | 3 | 0 | 0 | 4 | default, not-found (404), default @375, default @768 |
| S15-jpn-sekolah `/jpn/sekolah/{id}` | 229 | 222 | 0 | 7 | 0 | 0 | 3 | default, default @375, default @768 |
| S16-amaran `/amaran` | 6 | 3 | 0 | 3 | 0 | 0 | 3 | default, default @375, default @768 |
| S17-amaran-kelas `/amaran/kelas/{id}` | 46 | 36 | 7 | 3 | 0 | 0 | 4 | default, forbidden (403), default @375, default @768 |
| S18-amaran-ppd `/amaran/ppd` | 30 | 27 | 0 | 3 | 0 | 0 | 3 | default, default @375, default @768 |
| S19-amaran-jpn `/amaran/jpn` | 40 | 37 | 0 | 3 | 0 | 0 | 3 | default, default @375, default @768 |
| S20-amaran-keberkesanan-ppd `/amaran/keberkesanan/ppd` | 51 | 48 | 0 | 3 | 0 | 0 | 4 | default, school-8880, default @375 (**overflow 498 px**), default @768 |
| S21-amaran-keberkesanan `/amaran/keberkesanan` | 28 | 25 | 0 | 3 | 0 | 0 | 3 | default, default @375, default @768 |
| S22-amaran-sekolah `/amaran/sekolah/{id}` | 30 | 27 | 0 | 3 | 0 | 0 | 3 | default, default @375, default @768 |
| S23-amaran-ringkasan `/amaran/ringkasan-eksekutif` | 57 | 39 | 14 | 4 | 0 | 0 | 6 | district, noscope, school, state, district @375, district @768 |
| S24-amaran-intervensi `/amaran/intervensi/{studentId}` | 62 | 43 | 4 | 15 | 1 | 1 | 4 | default, followup, default @375, default @768 |
| S25-analisa-item-ppd `/analisa-item/ppd` | 111 | 107 | 1 | 3 | 0 | 0 | 4 | default, show-all, default @375, default @768 |
| S26-analisa-item-jpn `/analisa-item/jpn` | 106 | 103 | 0 | 3 | 0 | 0 | 3 | default, default @375, default @768 |
| S27-sekolah-prestasi `/sekolah/{id}/prestasi` | 96 | 93 | 0 | 3 | 0 | 0 | 3 | default, default @375, default @768 |
| S28-sekolah-amaran `/sekolah/{id}/amaran` | 39 | 35 | 1 | 3 | 0 | 0 | 5 | default, t4, t5, default @375, default @768 |
| S29-sekolah-kombo `/sekolah/{id}/kombo` | 44 | 41 | 0 | 3 | 0 | 0 | 3 | default, default @375, default @768 |
| S30-sekolah-analisa-item `/sekolah/{id}/analisa-item` | 93 | 63 | 16 | 14 | 0 | 0 | 7 | default, not-found (200), students-open, subject-pill, t4, default @375, default @768 |
| S31-kombo-ppd `/kombo/ppd` | 26 | 23 | 0 | 3 | 0 | 0 | 3 | default, default @375, default @768 |
| S32-kombo-jpn `/kombo/jpn` | 26 | 23 | 0 | 3 | 0 | 0 | 3 | default, default @375, default @768 |
| S33-kombo-sekolah `/kombo/sekolah/{id}` | 51 | 41 | 7 | 3 | 0 | 0 | 4 | default, server-error (500), default @375, default @768 |
| SHU-user-shell (chrome) | 417 | 152 | 60 | 205 | 15 | 148 | 127 | all SHU states |

Hidden-only (3 on most screens) are the global tournament banner's templates ("LIVE:", "MAIN", "DAFTAR"). S8 "mobile-only" is the card list shown below 640 px instead of the table.

**Horizontal page overflow:** only S20 at 375 px (`scrollWidth` 498). All tables are in `overflow-x-auto` wrappers (scroll, no clipping); measured per route in the snapshot (`layout`).

**Empty / error states captured:** S3 "Tiada data untuk tempoh ini" (+ 30 Hari / 7 Hari / Hari Ini variants); S12/S14 "Data belum tersedia"; S9 "Tiada data ranking", "Tiada data ranking untuk subjek ini", "Tiada kelas dijumpai", "Tiada data pelajar", "Tiada guru berdaftar", "Tiada data subjek", "Tiada aktiviti direkodkan buat masa ini"; S10 "Tiada sekolah dijumpai"; S11 "Tiada data"; S21 "Tiada data intervensi lagi.", "Tiada data trend lagi.", "Belum Ada Intervensi"; S30 "Sekolah Tidak Dinyatakan", "Tiada Data Pelajar"; S1/S10 "Tiada data pembetulan untuk bulan ini (2026-09)"; 403 (S2, S17), 404 (S9, S14), 500 (S33).

## 2. Link crawl (`_crawl.json`)

1,156 URLs classified (merge 248 + crawl supplement); **908 are M18** (881 not in the TRACKER checklist: the new routes plus every school / class / district id link). Unknown (10): `/`, `/ppd`, `/jpn` (404 probes), `/latih-tubi` (error-page link), `/api/tournament/active`, `/fcm/token`, `/chatbot/send`, `/chatbot/rate`, `/chatbot/history?session_id=…` ×2 — global shell endpoints. Every probe carries its `httpStatus`.

**New routes (not in TRACKER):** `/ppd/sekolah/{id}`, `/jpn/sekolah/{id}`, `/jpn/daerah/{ppd}`, `/jpn/command-center` (+ JSON `/jpn/command-center/live-data`), `/amaran/kelas/{id}`, `/amaran/ppd`, `/amaran/jpn`, `/amaran/sekolah/{id}`, `/amaran/keberkesanan`, `/amaran/keberkesanan/ppd`, `/amaran/ringkasan-eksekutif`, `/amaran/intervensi/{studentId}` (+ `POST /amaran/intervensi`, `PATCH`/`DELETE /amaran/intervensi/{id}`), `/amaran/export/{class|school|district}/{id}` (downloads, not opened), `/analisa-item/ppd`, `/analisa-item/jpn`, `/sekolah/{id}/prestasi`, `/sekolah/{id}/amaran`, `/sekolah/{id}/kombo`, `/sekolah/{id}/analisa-item`, `/kombo/ppd`, `/kombo/jpn`, `/kombo/sekolah/{id}`, `/ppd/export-laporan?format=csv` (download, not opened).

**Probed:** 404 — `/ppd`, `/jpn`, `/jpn/benchmark-sekolah`, `/jpn/peta-haba`, `/jpn/export-laporan`, `/jpn/leaderboard-sekolah`, `/amaran/keberkesanan/jpn`, `/amaran/export`, `/ppd/sekolah/99999999`, `/jpn/sekolah/99999999`, `/jpn/daerah/BOGUS`; 403 — `/ppd/command-center`, `/amaran/kelas/99999999`; 500 — `/kombo/sekolah/99999999`; 200 — `/sekolah/99999999/analisa-item` (empty page); `/kombo` → redirect `/dashboard`.

**Owned elsewhere:** `/prestasi/sekolah`, `/prestasi/tingkatan/{t4|t5}`, `/prestasi/{userId}`, `/prestasi/sekolah/{id}/guru/{id}`, `/headcount/student/{id}`, `/analisa-item/sekolah/{id}` → **M08**; `/kombo` → M14; `/dashboard` → shell / M05. (`/analisa-item/sekolah/8880` was opened once: same template as S30.)

## 3. Reconciliation

`node tools/diff-narrative.js inventory/M18 docs/discovery/M18-ppd-jpn.md` → **0 candidates on every screen** (33 screens). Appendix B of the narrative holds the exact remaining DOM strings (data rows, select options, global script strings) in fenced blocks.

**Not in narrative:** (none)

## 4. Read-only limits

Not observable without another account or a mutation (full list in the narrative, "States requiring a live action or another account"): every page as a real `ppd_officer` / `jpn_officer` (scope, menu, shell), `/ppd/command-center`, CSV exports, print view, intervention create / evaluate / follow-up / delete, the full-IC reveal, filled usage statistics, student ranking, trend icons, a working JPN command center.

Nothing was submitted, exported, downloaded, printed, approved, evaluated or deleted. GETs were sequential with ≥ 350 ms spacing (≥ 400 ms in the crawl and the snapshot). The JPN command center's own 10-second poll ran only while that page was open during capture.
