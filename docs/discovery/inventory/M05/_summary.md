# M05 — Element inventory & link crawl: summary

- **Captured:** 2026-09-25, live https://prestasiplus.my, read-only, admin session (browser lane 1).
- **Method:** same pipeline as M01–M03 (`tools/inventory.js` → `tools/run-state.js` → `tools/split-batch.js` → `tools/merge-inventory.js` → `tools/diff-narrative.js`).
  - Capture plan: `tools/jobs/M05.js` (68 UI states over 14 rendered screens, groups A–H). Screen map: `tools/jobs/M05.screens.json`.
  - Screenshots: `tools/jobs/M05.shots.js` + `tools/shoot.js` (46 PNG in `docs/discovery/img/M05/`).
  - M05-only helpers: `tools/jobs/M05-guard.js` (write guard), `tools/jobs/M05-main.js` (prints a saved page's `<main>`), `tools/jobs/M05-appendixC.js` (builds narrative Appendix C from the diff).
  - **No shared tool was modified.**
- **Write guard:** before any capture, `M05-guard.js` installed a context-level Playwright route that aborts every non-GET/HEAD/OPTIONS request. Blocked log for the whole run: only the self-test probe `POST /__m05_probe` and Cloudflare RUM analytics beacons (`POST /cdn-cgi/rum?`). **No application request other than GET was sent.**
- **Session-starting URLs never opened:** `/practice/{CODE}/quiz?…`, `/practice/chapter/{CODE}/{id}/quiz?count=`, `/practice/{CODE}/subjektif`, `/latihan-berstruktur/{id}/jawab`, and `/practice/revision/{CODE}` (its `x-init` POSTs `/practice/start-revision-quiz` on load).
  - `/practice/revision/{BM,SEJ}` HTML was fetched with `fetch()` (GET, no script execution) for the template and logic only.
  - An attempt to render it with locally mocked JSON responses was **declined by the permission system** and not pursued. S7 is therefore documented from source only (narrative §2.7) and has **no browser inventory (no EL-M05-S7 IDs)**. The URS should map §2.7 items directly.
- **Privacy:** the only account is the system account "Admin PRESTASI+" (own stats only).
  - On `/latihan-berstruktur` the question preview ("Soalan Oleh: `<teacher>`") and the author/school line were masked in the inventory (`opts.mask`) and replaced in the DOM before screenshots.
  - A grep of all 68 raw files for 40-character tokens, the teacher name and the school name found none. CSRF tokens were replaced by `CSRF`.
  - No leaderboard or other person names appear on M05 screens.
- **Data rows:** limited with `repeat`:
  - S1: 4 of 31 subject cards, 3 of 31 subject-stat cards, 2 of 5 recent questions
  - S2: 3 of 31 cards
  - S5: 3 chapter cards
  - S9: 2 session cards
  - S10: 3 of 20 cards
  - S15: 4 of 20 rows

  Full data is in `_practice-data.json` and narrative Appendix B.
- **Files:** `S1-dashboard.json` … `S15-target-spm.json` (S7 absent, see above); `SHU-user-shell.json` (layout chrome, owned by the global doc); `_crawl.json`; `_practice-data.json`; raw captures `../_raw/M05/*.json` (68). Raw page sources used for the analysis are in `../_raw/M05/work/` (CSRF-scrubbed HTML, GET only).
- **Status legend:** as M01–M03 (`visible-default`, `conditional`, `hidden-only`, `mobile-only`, `desktop-only`). `normalizeIds` is on.

## 1. Per-screen counts

M05 content totals **860 elements** over 14 rendered screens and **68** captured states (1280 / 768 / 375). The user-portal shell adds 391 chrome elements.

| Screen (route) | Total | Visible default | Conditional | Hidden only | Mobile only | Desktop only | States | States captured |
|---|---|---|---|---|---|---|---|---|
| S1-dashboard `/dashboard` | 323 | 291 | 14 | 18 | 0 | 8 | 5 | default, slide2-expanded, slide5 (@1280); default@375, default@768 |
| S2-practice `/practice` | 25 | 22 | 0 | 3 | 0 | 0 | 6 | default, subject-param, level-param, topic-param (@1280); default@375, default@768 |
| S3-subject-config `/practice/{CODE}` | 87 | 44 | 36 | 7 | 0 | 0 | 9 | math-default, math-d2-diff3-20, math-diff5-insufficient, math-d3-count5, bm-default, addmath-empty, sk-d4-only (@1280); math-default@375, @768 |
| S4-chapter-index `/practice/chapter` | 27 | 24 | 0 | 3 | 0 | 0 | 3 | default @1280/375/768 |
| S5-chapter-subject `/practice/chapter/{CODE}?level=` | 47 | 7 | 37 | 3 | 0 | 0 | 6 | math-d1, math-d2, bm-progress, addmath-empty (@1280); math-d1@375, @768 |
| S6-revision `/practice/revision` | 18 | 14 | 1 | 3 | 0 | 0 | 4 | default, flash-none (@1280); default@375, @768 |
| S7-revision-quiz `/practice/revision/{CODE}` | — | — | — | — | — | — | 0 | **source only** (narrative §2.7) |
| S8-progress `/practice/progress?period=` | 54 | 20 | 31 | 3 | 0 | 0 | 6 | default-30, 7, 90, all (@1280); all@375, all@768 |
| S9-history `/practice/history?period=` | 64 | 55 | 6 | 3 | 0 | 0 | 6 | all, week-empty, month-empty, year (@1280); all@375, @768 |
| S10-berstruktur `/latihan-berstruktur` | 85 | 57 | 24 | 4 | 2 | 18 | 6 | default, math, empty, page2 (@1280); default@375, @768 |
| S11-pembetulan `/pembetulan?bulan=` | 44 | 8 | 33 | 3 | 0 | 0 | 5 | current-empty, may-data, future (@1280); may-data@375, @768 |
| S12-penguasaan `/penguasaan` | 43 | 40 | 0 | 3 | 0 | 0 | 3 | default @1280/375/768 |
| S13-remedial `/remedial/saya` | 8 | 5 | 0 | 3 | 0 | 0 | 3 | empty @1280/375/768 |
| S14-misi-harian `/misi-harian` | 6 | 3 | 0 | 3 | 0 | 0 | 3 | empty @1280/375/768 |
| S15-target-spm `/target-spm` | 29 | 25 | 0 | 4 | 0 | 0 | 3 | default @1280/375/768 |
| SHU-user-shell (chrome of S1–S15) | 391 | 152 | 34 | 205 | 15 | 148 | 68 | all states |

The hidden-only elements on every screen are the tournament-banner templates (`LIVE:`, `MAIN`, `DAFTAR`) plus x-cloak blocks (S3 insufficient warning, S3 "Latihan Subjektif" x-if, and carousel slides 3–4 on S1). S10 "desktop-only" is the Laravel paginator's `sm:` block ("Showing … results" + page numbers). The 375-px pager is the simple "« Previous / Next »".

Empty/error/flash states captured:
- S6 flash "Tiada soalan salah untuk subjek ini. Tahniah!"
- S3 "Soalan Tidak Mencukupi" (difficulty 5, ADDMATH, SK)
- S5 "Tiada bab tersedia untuk tahap ini."
- S8 "Belum Ada Data"
- S9 "Belum Ada Rekod Latihan"
- S10 "Tiada soalan berstruktur buat masa ini"
- S11 "Tiada Data Pembetulan"
- S13 "Tiada ujian remedial. Bagus — teruskan usaha!"
- S14 "Tiada misi hari ini"
- S1 "Belum Ada Lencana Lagi!"

No horizontal page overflow in any of the 68 states.

## 2. Not in the narrative discovery

`node tools/diff-narrative.js inventory/M05 docs/discovery/M05-practice.md` → **0 candidates on all 14 screens.**

Appendix C of the narrative lists icons, whole-card concatenations, data values and shell script literals. Items found only by the scripted inventory, state captures or crawl during reconciliation, and now in the narrative:
1. `?subject=`, `?level=` and `?topic_id=` on `/practice` are ignored: byte-identical pages (D-3).
2. S3/S5 offer only Darjah 1–4, and secondary subjects show 0 questions there (D-4). Difficulty 5 has 0 questions everywhere.
3. Count contradictions across S1/S2/S3/S8/S9/S12 (D-5).
4. Wrong "Dashboard" header on S3, S6, S7, S10, S13 (D-1).
5. The ADDMATH chapter page has an empty level select (D-6). JAWI has 13 chapters (card), not 12.
6. The aside "Lihat Semua Artikel" link (desktop only) and quick-link "Panel Admin" icon `fa-shield-alt`.
7. Broken icon classes (Lucide/emoji/double prefix; S12 `<i class="book-open">`) (D-2).
8. Future months reachable on `/pembetulan` (D-11).

## 3. New routes found by the crawl

250 unique URLs (`_crawl.json`; 123 classified M05, 0 unknown). Not in the TRACKER M05 checklist:

| URL | Kind | Found on | Note |
|---|---|---|---|
| **`/practice/{CODE}`** (31 codes) | screen | S2, S8 | S3 pre-start config |
| **`/practice/{CODE}/quiz?level=&difficulty=&count=`** | screen (session) | S3 "Mula Kuiz" | **not opened** |
| **`/practice/{CODE}/subjektif`** | screen (session) | S3 (x-if, never shown) | **not opened** |
| **`/practice/chapter/{CODE}`** (`?level=`) | screen | S4 | S5 |
| **`/practice/chapter/{CODE}/{chapterId}/quiz?count=5|10|15|20`** | screen (session) | S5 | **not opened** |
| **`/practice/revision/{CODE}`** | screen (session on load) | S6 | S7, source only |
| `/practice/progress?period=7|30|90|all` | query variants | S8 | |
| `/practice/history?period=week|month|year` | query variants | S9 | |
| `/latihan-berstruktur?subject_id=&kbat_level=&page=` | query variants | S10 | 204 pages / 4,061 items |
| **`/latihan-berstruktur/{id}/jawab`** | screen (attempt) | S10 | **not opened** |
| `/pembetulan?bulan=YYYY-MM` | query variant | S11 | |
| `POST /target-spm` | form | S15 | never submitted |
| `POST /practice/start-revision-quiz`, `/practice/check-answer`, `/practice/submit-quiz`, `/report-question` | JSON endpoints | S7 script | never called |
| `/practice?subject=`, `/practice?level=` | links | S1 | dead filters (D-3) |

Probed, absent (404): `/practice/history/1`, `/practice/result/1`, `/practice/review/1`, `/practice/session/1`, `/practice/sessions`, `/practice/stats`, `/practice/leaderboard`, `/practice/daily-quest`, `/daily-quests`, `/api/practice`, `/remedial`, `/remedial/1`, `/misi-harian/1`, `/penguasaan/1`, `/target-spm/edit`, `/latihan-berstruktur/999999`, `/practice/XYZ`, `/practice/chapter/XYZ`, `/practice/revision/XYZ`. `/practice/revision/MATH` (0 wrong) → 302 `/practice/revision` + flash. M05 has **no JSON read endpoints**.

## 4. Out-of-module links (target module)

Found in M05 content (not the shell):

| URL | Found on | Target |
|---|---|---|
| `/pricing` ("Langgan Sekarang", "Langgan untuk akses tanpa had") | S1, S3 | M19 |
| `/leaderboard` ("Papan Pendahulu") | S1 | M14 |
| `/admin` ("Panel Admin") | S1 | M17 |
| `/artikel`, `/artikel/{slug}` ×5 | S1 | M09 |
| `/report-question` (POST, S7 script) | S7 | M04 (question reports) |
| `/guru/soalan-berstruktur`, `/guru/misi-harian` (shell) | all | M10 |

Shell links on M05 screens are classified per module in `_crawl.json`: M01 4, M01+M22 2, M03 2, M04 4, M06 2, M07 1, M08 7, M09 11, M10 30, M11 1, M13 4, M14 9, M15 5, M16 6, M17 1, M18 12, M19 3, M20 3, M21 1, M22 6, M23 1, M24 3, M25 5, M26 4.

## 5. States requiring a live practice session

See narrative §9 (LS-1 … LS-12). None were attempted.
