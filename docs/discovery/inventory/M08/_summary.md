# M08 — Element inventory & link crawl: summary

- **Captured:** 2026-09-25 from live https://prestasiplus.my, read-only, admin session on browser lane 1 (`playwright`). Credentials are not stored.
- **Method:** the same pipeline as M01–M06: `tools/inventory.js` → `tools/run-state.js` → `tools/split-batch.js` → `tools/merge-inventory.js` → `tools/diff-narrative.js`.
  - Capture plan: `tools/jobs/M08.js`, 103 UI states over 21 screens in groups A–J.
  - Screen map: `tools/jobs/M08.screens.json`.
  - Masked screenshots: `tools/jobs/M08.shots.js` + `tools/shoot.js`, 50 PNGs in `docs/discovery/img/M08/`.
  - Appendix generator: `tools/jobs/M08-appendix.js`, a copy of the M06 helper.
  - **No shared tool was modified.**
- **Privacy (students are minors):**
  - Every job first runs `M08MASK` (in `tools/jobs/M08.js`), then `tools/sanitize.js {selectors:['.m08n'], titleName:false}`.
  - `M08MASK` tags every person-name node: teacher cards, top and at-risk students, class attention list, "Pelajar Yang Salah" chips, ranking rows, leaderboard podium, and the Prestasi 360 and headcount-student headers and tab titles. It also removes avatars, replaces school and PPD names, and rewrites person-record ids in links to `{id}`.
  - The mask also shields stat labels such as "Guru" from sanitize's label→value rule. A first run had masked the neighbouring "Kelas" card; all 103 states were re-captured after the fix.
  - `meta.piiLeakCheck` is 0 leaks in all 103 states.
  - A grep of all raw and merged M08 files, the narrative and the job files for `bin`/`binti`/`A/P`/`A/L` name patterns, school-name patterns (`SEKOLAH …`, `SMK …`, `PPD …`) and e-mail patterns found **no matches**.
  - One unmasked accessibility snapshot that the MCP navigate tool auto-saved in the git-ignored `.playwright-mcp/` folder was deleted.
- **Files:**
  - Screen inventories: `S1-prestasi-sekolah.json` … `S21-laporan-mingguan.json`.
  - Layout chrome: `SHU-user-shell.json`, owned by the global doc.
  - `_crawl.json`.
  - Raw captures: `../_raw/M08/*.json` (103).
- **Status legend:** same as M01–M06. `normalizeIds` is on. Long lists are limited via `opts.repeat`, with totals in each state's `meta.repeats`:
  - S1: teacher cards, first 3 of 310;
  - S3/S5: table rows 4, attention list 3;
  - S6: heatmap cells 7 of 90, mastery cards 3;
  - S7: expanded weak-topic cards 3;
  - S10: class cards 3 of 750;
  - S11: item rows 3 of 596, discrimination rows 3, "Tukar Kelas" chips 3 of 750;
  - S20: table rows 5 of ≤50.

## 0. Audit top-up (2026-09-25, lane 3 `playwright3`, own login) (added in audit top-up)

This top-up responds to AUD-M08-01 and AUD-M08-05 plus the coordinator checks (S10 sort, S19 footer, S17 captions).

- **Plan:** `tools/jobs/M08-topup.js` — 20 new states. It runs `M08MASK` and a `TMASK` that masks the "Guru: …" subtitle, the headcount-table student links and the row checkbox ids.
- **Screenshots:** `tools/jobs/M08-topup.shots.js`, 14 PNGs.
- **ID stability:** existing EL ids were kept by `tools/jobs/M08-stabilize-ids.js`, which re-matched every re-merged element to its pre-top-up id by signature. All 1,148 old ids were kept; 405 new ids were appended.
- **New states:**
  - S3 `t4-full-table` (13 rows, no repeat limit);
  - S5 `headcount` @1280/375 (class 516);
  - S6 `headcount-status` @1280/375;
  - S15 `populated` @1280/375, `selisih-besar`, `hampir-tepat`;
  - S17 `one-photo`, `caption-reset`;
  - S22 default @1280/375;
  - S23 default @1280/375, `keyin-menu`, `reset-modal`, `delete-modal` (opened, never confirmed), `sort-name`, `row-selected` (not submitted).
- **New elements:** S3 +9, S5 +22, S6 +79, S15 +179, S17 +8, S22 46 (new screen), S23 62 (new screen) = **405**. The shell gained +2.
- **Privacy:**
  - `piiLeakCheck` is 0 leaks in all 20 new states.
  - One batch was held back before saving because a line break defeated the teacher-subtitle mask. The regex was fixed and the 7 S23 states were re-captured; nothing unmasked was written.
  - A pattern grep of all M08 outputs is clean.
- **The S3 T4 contradiction** is explained in narrative §2.22.1: the cards count student × config pairs (34 + 41 = 75 = 15 × 5), while the table counts one status per student (13 + 2 = 15).

## 1. Per-screen counts

M08 content totals **1,553 elements** over 23 screens and **123** captured states (1280 / 768 / 375). This was 1,148 / 21 / 103 before the audit top-up. The user-portal shell adds 401 chrome elements, which are not M08 content.

| Screen (route) | Total | Visible default | Conditional | Hidden only | Mobile only | Desktop only | States | States captured |
|---|---|---|---|---|---|---|---|---|
| S1-prestasi-sekolah `/prestasi` → `/prestasi/sekolah` | 111 | 108 | 0 | 3 | 0 | 0 | 3 | default @1280/375/768 |
| S2-prestasi-tingkatan-pilih `/prestasi/tingkatan` | 7 | 4 | 0 | 3 | 0 | 0 | 3 | default @1280/375/768 |
| S3-prestasi-tingkatan `/prestasi/tingkatan/{t4\|t5}` | 134 | 7 | 124 | 3 | 0 | 0 | 6 | t4, t5, not-found t3, **t4-full-table** (@1280); t4 @375/@768 |
| S4-prestasi-kelas-pilih `/prestasi/kelas` | 10 | 7 | 0 | 3 | 0 | 0 | 3 | empty @1280/375/768 |
| S5-prestasi-kelas `/prestasi/kelas/{id}` | 100 | 59 | 38 | 3 | 0 | 0 | 7 | no-activity (4), trend (228), sc-link 404, **headcount (516)** (@1280); trend, **headcount** @375; trend @768 |
| S6-prestasi-360 `/prestasi/{userId}` | 213 | 113 | 97 | 3 | 0 | 0 | 8 | empty (own), day-tooltip, data (student), not-found, **headcount-status** (@1280); data, **headcount-status** @375; data @768 |
| S7-analitik-pelajar `/analitik/pelajar` | 106 | 58 | 45 | 3 | 0 | 0 | 7 | default, all-weak, tab-sej, tab-sej-all (@1280); default, all-weak @375; default @768 |
| S8-analitik-kelas `/analitik/kelas` | 48 | 40 | 5 | 3 | 0 | 0 | 6 | empty, class-4, risk-low, subject-sej (@1280); class-4 @375/@768 |
| S9-analisa-item-sekolah `/analisa-item/sekolah` | 21 | 18 | 0 | 3 | 0 | 0 | 5 | default, t4, t5 (@1280); default @375/@768 |
| S10-analisa-item-kelas-pilih `/analisa-item/kelas` | 13 | 10 | 0 | 3 | 0 | 0 | 3 | default @1280/375/768 |
| S11-analisa-item-kelas `/analisa-item/kelas/{id}` | 82 | 40 | 36 | 6 | 0 | 0 | 10 | difficulty, row-open, discrimination, sort-changed, empty, empty-disc, not-found 403 (@1280); difficulty, row-open @375; difficulty @768 |
| S12-headcount `/headcount` | 42 | 8 | 30 | 4 | 0 | 0 | 7 | default, auto-setup, auto-setup-selected, auto-setup-reopen (@1280); default, auto-setup @375; default @768 |
| S13-headcount-dashboard `/headcount/dashboard` | 32 | 19 | 0 | 13 | 0 | 0 | 3 | empty @1280/375/768 |
| S14-headcount-create `/headcount/create` | 32 | 28 | 0 | 4 | 0 | 0 | 4 | default, manual (NOT submitted) (@1280); default @375/@768 |
| S15-headcount-pelajar `/headcount/student/{id}` | 244 | 55 | 186 | 3 | 0 | 0 | 8 | default, not-found, **populated, selisih-besar, hampir-tepat** (@1280); default, **populated** @375; default @768 |
| S16-timeline `/timeline` | 12 | 9 | 0 | 3 | 0 | 0 | 3 | empty @1280/375/768 |
| S17-timeline-create `/timeline/create` | 31 | 18 | 7 | 6 | 0 | 0 | 6 | default, category, **one-photo, caption-reset** (NOT submitted) (@1280); default @375/@768 |
| S18-profil-awam `/pelajar/{id}` | 65 | 59 | 6 | 0 | 0 | 4 | 4 | default (own), timeline-link /pelajar/3 404 (@1280); default @375/@768 |
| S19-ranking `/ranking` | 64 | 17 | 43 | 4 | 0 | 0 | 10 | nasional, negeri, daerah, sekolah, negeri-selangor, subject, tingkatan-empty (@1280); nasional, negeri @375; nasional @768 |
| S20-leaderboard `/leaderboard` | 71 | 55 | 13 | 3 | 0 | 6 | 5 | default (week), all, month (@1280); default @375/@768 |
| S21-laporan-mingguan `/laporan-mingguan` | 7 | 7 | 0 | 0 | 0 | 0 | 3 | forbidden 403 @1280/@375; /analitik/kelas/pelajar/{id} 403 |
| S22-headcount-ringkasan `/headcount/{id}/summary` (audit top-up) | 46 | 43 | 0 | 3 | 0 | 0 | 2 | default @1280/375 |
| S23-headcount-kelas `/headcount/{id}` (audit top-up) | 62 | 28 | 23 | 11 | 0 | 0 | 7 | default, keyin-menu, reset-modal, delete-modal, sort-name, row-selected (@1280); default @375 |
| SHU-user-shell (chrome of S1–S17, S19–S20, S22–S23) | 401 | 152 | 44 | 205 | 15 | 148 | 111 | all user-portal states |

**Horizontal page overflow:**
- Flagged by the inventory at 375: S6 (data) and S7 (default, all-weak).
- A direct measurement also found S20 at 375: `scrollWidth` 385 > 375.
- Measured widths: S6 392 px (headcount chip row), S7 418 px (DSKP legend), S20 385 px (podium). Narrative §8, D-9.

**Empty / error states captured:**
- S4 "Anda belum mempunyai kelas aktif."
- S5 "Belum ada aktiviti dalam 30 hari terakhir."
- S6 "Belum ada data latihan." / "Tiada topik lemah! Teruskan usaha."
- S8 "Tiada data analitik untuk kelas dan subjek ini."
- S9 "Tiada Data Pelajar".
- S11 "Tiada Data Lagi" / "Data Tidak Mencukupi".
- S12 and S13 "Belum ada headcount."
- S16 "Timeline Kosong".
- S19 "Tiada data kedudukan".
- 404 pages: S3 t3, S5 sc-419, S6, S15, S18 /pelajar/3.
- 403 pages: S11 unknown id, S21, /analitik/kelas/pelajar/{id}.

## 2. Not in the narrative discovery

`node tools/diff-narrative.js inventory/M08 docs/discovery/M08-student-performance.md` reports **0 candidates on all 23 screens** (re-run after the audit top-up). The not-in-narrative list is **empty**.

Appendix B of the narrative holds the remaining exact DOM strings, data samples and shell inline-script strings (generated by `tools/jobs/M08-appendix.js`). It also has a byte-exact block for the four emoji strings with U+FE0F, which the diff tool normalises differently. Appendix A holds the enumerations.

Items that only the inventory and state captures surfaced, all now in the narrative:
1. S11 sort select and search have no effect: the `sort-changed` state logged `rows=596 visible=596 first=0.0%` (D-15).
2. S12 "Batal" only hides the modal; reopening resets the selection (`auto-setup-reopen` logged `checked=0`).
3. S12 submit "Auto-Setup" is disabled at 0 selections and shows "(2)" after two ticks.
4. S20: no period parameter and an unknown value both activate "Minggu Ini"; the table is capped at 50 rows; the viewer's own rank "#1050" appears only for "Semua Masa".
5. S19 scope pills keep the current filters; the Negeri select also appears on the Daerah scope; the tab title changes only with `negeri=`.
6. Accuracy above 100% in S3, S5 and S20 (D-8).
7. The shell header shows "Dashboard / Selamat datang kembali" on S1, S6, S12–S15 and S19 (D-1).

## 3. New routes found by the crawl

216 unique URLs are in `_crawl.json`: 57 M08, 22 M05, 16 M11, 18 M10, and others via the shell; 15 unknown.

Not yet in the TRACKER M08 checklist:

| URL | Kind | Found on | Note |
|---|---|---|---|
| `/prestasi/sekolah` | screen | S1 (302 target of `/prestasi`) | S1 Dashboard Sekolah |
| `/prestasi/tingkatan` | screen | S1 | S2 |
| `/prestasi/tingkatan/{t4\|t5}` | screen | S1, S2 | S3; other levels 404 |
| `/prestasi/{userId}` | screen | S5, S11 | S6 Prestasi 360 |
| `/prestasi?{userId}` | broken link | S3 "Murid Berisiko" | lands on S1 (D-5) |
| `/prestasi/kelas/{id}` | screen (M11 route) | S3 | S5; `sc-{id}` 404 (D-4) |
| `/analitik/kelas` (`?classroom_id=&subject_id=&risk_level=`) | screen | direct probe | S8; recommended owner M11 |
| `/analitik/kelas/pelajar/{id}` | 403 | S8 | not observable (L-3) |
| `/analisa-item/sekolah` (`?tingkatan=T4\|T5`) | screen | S1 | S9 |
| `/analisa-item/kelas` | screen | direct probe | S10 |
| `/analisa-item/kelas/{id}` | screen | S10, S11 | S11; unknown id 403 |
| `/headcount/dashboard` | screen | S12 | S13 |
| `/headcount/create` | screen | S12 | S14 |
| `POST /headcount` | form | S14 | **not submitted** |
| `POST /headcount/auto-setup` | form | S12 | **not submitted** |
| `/headcount/student/{id}` | screen | S6 "Lihat Penuh" | S15 |
| `/timeline/create` | screen | S16 | S17 |
| `POST /timeline` | form | S17 | **not submitted** |
| `/headcount/{id}` (`?sort=ranking|name`) | screen | S5 → S22 → "Lihat Table Penuh" | **S23** (added in audit top-up) |
| `/headcount/{id}/summary` | screen | S5 "Lihat Penuh →", S23 | **S22** (added in audit top-up) |
| `/headcount/{id}/results/{n}`, `/edit`, `/unjuran`, `/settings` | screens (edit forms) | S23 | **not opened** (added in audit top-up) |
| `/headcount/{id}/export` | CSV download | S22, S23 | **not opened** |
| `POST /headcount/{id}/reset-ar`, `POST /headcount/{id}` + `_method=DELETE`, `POST /headcount/{id}/drop-students` | forms | S23 | **not submitted** (modals opened only) |
| `/timeline/{id}` | GET 405 | probe | PUT/DELETE INFERRED |
| `/pelajar/{id}` | screen (public layout) | S16 | S18; the S16 link uses the wrong id (D-6) |
| `/ranking?scope=nasional\|negeri\|daerah\|sekolah&subject_id=&tingkatan=&negeri=` | filter variants | S19 | |
| `/leaderboard?period=all\|week\|month` | filter variants | S20 | |
| `/practice/{CODE}/quiz?level=&dskp_sp_id=&count=` | session start (M05) | S6, S7 | **not opened** |

**Unknown in the crawl:**
- `/`: error pages "Halaman Utama" and S18 logo.
- `/latih-tubi`: the 404 page's "Mula Latihan", itself a 404 (M06 D-8).
- `/pelajar/1`, `/pelajar/3`: S18 (M08).
- `/analitik/kelas*`: S8.
- `/api/tournament/active`, `/chatbot/*`, `/fcm/token`: shell widgets.

## 4. Out-of-module links (target module)

| URL | Found on | Target |
|---|---|---|
| `/practice`, `/practice/{CODE}/quiz?…`, `/dashboard` | S6, S7, S9–S11, S19 | M05 |
| `/guru/kelas/cipta` | S4 | M10 |
| `/prestasi/kelas`, `/prestasi/kelas/{id}` | S1, S3, S5 | M11 (TRACKER) |
| `/sponsor/register` | S18 | M21 |
| `/login` | error pages | M01 |
| `/gamification/leaderboard`, `/battle/leaderboard` | shell / admin sidebar | M14 / M16 (overlap notes in narrative §1.1) |

## 5. What could not be revealed read-only / safety notes

| Item | Why |
|---|---|
| `/laporan-mingguan` weekly report (all sections) and `/guru/laporan-mingguan-kelas` | 403 for the admin account (L-1) |
| `/analisa-item` (role view), `/analitik/kelas/pelajar/{id}` | redirect to `/dashboard` / 403 (L-2, L-3) |
| The admin's own headcount list and dashboard; auto-setup and create results and errors (L-4, narrowed: populated S15/S6/S5 and S22/S23 captured in the audit top-up) | no configs owned; POST not allowed |
| Headcount result, edit, unjuran and settings forms, CSV export (L-12) | edit forms / download, not opened in the top-up |
| Timeline posts, edit/delete, profile with posts | no posts; POST not allowed (L-5) |
| Teacher-owned class picker (S4), "Tukar Kelas..." options (S5), S8 class select options | admin owns no class (L-6) |
| Populated school item analysis (S9) | no data in the admin's school (L-7) |
| Heatmap active cells; high-accuracy message/ring variants; Kritikal/Tinggi badges; ranking page size | no such data (L-8 … L-11) |

**Safety notes:**
- No quiz or practice session was started. No `/quiz`, `/jawab`, `/start` or `/mula` URL was opened; the "Latihan Fokus" / "Fokus" links were recorded only.
- No form was submitted: "Auto-Setup", "Cipta Headcount" and "Terbitkan" were never clicked. Checkboxes, radios and selects were changed client-side only.
- GET filter pages were loaded by URL only: `/ranking?…`, `/analitik/kelas?…`, `/analisa-item/sekolah?tingkatan=`, `/leaderboard?period=`.
- Probed read-only GETs:
  - `/analitik`, `/analitik/guru`, `/analisa-item`, `/analisa-item/pelajar`, `/analisa-item/1`, `/analisa-item/kelas/99999999`;
  - `/headcount/1`, `/headcount/student/99999999`, `/timeline/1`;
  - `/prestasi/99999999`, `/prestasi/tingkatan/{t1,t3}`, `/prestasi/kelas/sc-419`;
  - `/pelajar/{1,3}`, `/laporan-mingguan?week=1`, `/guru/laporan-mingguan-kelas`, `/ranking?scope=xyz`, `/leaderboard?period=xyz`.
- Load was modest: sequential page loads in one lane with one worker tab. Scripted probe loops waited ≥400 ms between GETs. Only 8 item-analysis class pages were sampled to find one with data.
