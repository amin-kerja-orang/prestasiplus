# M10 — Element inventory & link crawl: summary

- **Captured:** 2026-09-25 from live https://prestasiplus.my, read-only, admin session on browser lane 1 (`playwright`). Credentials are not stored.
- **Method:** the same pipeline as M01–M08: `tools/inventory.js` → `tools/run-state.js` → `tools/split-batch.js` → `tools/merge-inventory.js` → `tools/diff-narrative.js`.
  - Capture plan: `tools/jobs/M10.js`, 167 UI states over 35 screens in groups A–F, plus two targeted re-runs.
  - Screen map: `tools/jobs/M10.screens.json`.
  - Masked screenshots: `tools/jobs/M10.shots.js` + `tools/shoot.js`, 64 PNGs in `docs/discovery/img/M10/`.
  - Helpers:
    - `tools/jobs/M10-probe.js`: route crawl (status, titles, links, forms);
    - `tools/jobs/M10-reveal.js`: scanner for x-show, handlers, selects and `required`;
    - `tools/jobs/M10-scripts.js`: saves page inline scripts to `inventory/_raw/M10/_scripts/*.js`, with the CSRF token replaced by `{csrf}`;
    - `tools/jobs/M10-appendix.js`: a copy of the M08 appendix generator.
  - **No shared tool was modified.**
  - `_crawl.json` was produced after the TRACKER route-notation fix (no `|` alternations), so URLs are assigned to their real modules.
- **Privacy (students are minors):**
  - Every job runs `M10MASK` (in `tools/jobs/M10.js`) before and after its reveal actions, then `tools/sanitize.js {selectors:['.m10n'], titleName:false}`.
  - `M10MASK` masks:
    - author names after "Soalan Oleh:", "Dicipta oleh" and "Disediakan oleh", in text and in textarea values;
    - upper-case school names and school-search results;
    - avatars.

    It also trims the 936-option chapter selects to 12 options.
  - A first run's school pattern also matched the UI label "SK Baru" (Standard Kandungan). The pattern was tightened to upper-case names, and S5, S18, S22 and S32 were re-captured.
  - `meta.piiLeakCheck` is 0 leaks in all 167 states. The attendance list alone scrubbed 130 names.
  - All raw and merged M10 files, the narrative and the job files were grepped for:
    - the student and teacher names seen during the walk;
    - the name patterns `bin`, `binti`, `A/P` and `A/L`;
    - school-name patterns.

    There were **no matches**. The only "SK …" hit is the shell label "PKSK PRO".
  - The 40-character CSRF token in the harvested scripts was replaced by `{csrf}`.
- **Files:**
  - Screen inventories: `S1-guru-dashboard.json` … `S35-errors.json`.
  - Layout chrome: `SHU-user-shell.json`, owned by the global doc.
  - `_crawl.json`.
  - Raw captures: `../_raw/M10/*.json` (167) and `../_raw/M10/_scripts/*.js`.
- **Status legend:** same as M01–M08. `normalizeIds` is on. Long lists are limited via `opts.repeat`, with totals in each state's `meta.repeats`:
  - S7 attendance rows: 3 of 137;
  - S17 table rows: 3 of 20 per page;
  - S21 question cards: 3 of 20;
  - S26 question blocks: 2 of 30;
  - S28 question cards: 3 of 15;
  - S29 article rows: 3 of 15.

  The S12 chapter select is trimmed in the DOM to 12 of its 936 options before capture.

## 1. Per-screen counts

M10 content totals **3,150 elements** over 35 screens and **167** captured states (1280 / 768 / 375). The user-portal shell adds 415 chrome elements, which are not M10 content.

S18 is large (987 elements) for two reasons:
- each sub-question template has its own 72-button symbol palette;
- the "Eksperimen Sains" template renders 7 sub-questions.

| Screen (route) | Total | Visible default | Conditional | Hidden only | Mobile only | Desktop only | States | States captured |
|---|---|---|---|---|---|---|---|---|
| S1-guru-dashboard `/guru` | 83 | 79 | 1 | 3 | 0 | 0 | 4 | default@1280, guide-hidden@1280, default@375, default@768 |
| S2-command-center `/guru/command-center` | 102 | 66 | 30 | 6 | 0 | 13 | 11 | default, drill-gps, drill-kirk-t1, drill-mood, drill-students, kelas, predictive, remedial (@1280); default@375, default@768, drill-students@375 |
| S3-remedial-progress `/guru/remedial-progress` | 22 | 19 | 0 | 3 | 0 | 0 | 3 | default @1280/375/768 |
| S4-guru-kelas `/guru/kelas` | 18 | 8 | 7 | 3 | 0 | 0 | 4 | default, qr-modal (@1280); default @375/768 |
| S5-kelas-cipta `/guru/kelas/cipta` | 68 | 27 | 19 | 22 | 0 | 0 | 6 | default, school-none, school-search, school-selected (@1280); default @375/768 |
| S6-guru-pelajar `/guru/pelajar` | 20 | 10 | 7 | 3 | 0 | 0 | 5 | default, tab-school (@1280); default @375/768; tab-school @375 |
| S7-kehadiran-digital `/guru/kehadiran-digital` | 40 | 35 | 2 | 3 | 0 | 0 | 4 | default, date-past (@1280); default @375/768 |
| S8-jadual-belajar `/guru/jadual-belajar` | 36 | 32 | 0 | 4 | 0 | 0 | 3 | default @1280/375/768 |
| S9-broadcast `/guru/broadcast` | 14 | 10 | 0 | 4 | 0 | 0 | 4 | default, penting (@1280, NOT sent); default @375/768 |
| S10-live-kelas `/guru/live-kelas` | 31 | 19 | 0 | 12 | 0 | 0 | 4 | default, refreshed (@1280); default @375/768 |
| S11-misi-harian `/guru/misi-harian` | 9 | 6 | 0 | 3 | 0 | 0 | 3 | default @1280/375/768 |
| S12-misi-harian-cipta `/guru/misi-harian/cipta` | 35 | 26 | 0 | 9 | 0 | 0 | 7 | default, subject-bm, tracking-a, youtube (@1280, NOT submitted); default @375/768; youtube @375 |
| S13-set-soalan `/guru/set-soalan` | 11 | 8 | 0 | 3 | 0 | 0 | 3 | default @1280/375/768 |
| S14-set-soalan-cipta `/guru/set-soalan/cipta` | 39 | 30 | 2 | 7 | 0 | 0 | 5 | default, published, scheduled (@1280); default @375/768 |
| S15-soalan-guru `/guru/soalan-guru` | 22 | 19 | 0 | 3 | 0 | 0 | 3 | default @1280/375/768 |
| S16-soalan-guru-cipta `/guru/soalan-guru/cipta` | 189 | 120 | 36 | 33 | 0 | 0 | 9 | default, guide-hidden, link-other, subject-chapters, two-questions, youtube (@1280); default @375/768; two-questions @375 |
| S17-soalan-berstruktur `/guru/soalan-berstruktur` | 72 | 56 | 9 | 7 | 2 | 18 | 5 | default, filter-draf, page-2 (@1280); default @375/768 |
| S18-berstruktur-cipta `/guru/soalan-berstruktur/cipta` | 987 | 66 | 241 | 680 | 0 | 0 | 12 | default, inline-add, script-jawi, subject-level, symbols, template-eksperimen, two-subs-numeric, visibility-class, visibility-tingkatan (@1280); default @375/768; symbols @375 |
| S19-berstruktur-show `/guru/soalan-berstruktur/{id}` | 22 | 19 | 0 | 3 | 0 | 0 | 3 | default @1280/375/768 |
| S20-berstruktur-edit `/guru/soalan-berstruktur/{id}/edit` | 169 | 51 | 74 | 44 | 0 | 0 | 4 | default, symbols (@1280); default @375/768 |
| S21-sumbang-soalan `/guru/soalan` | 234 | 137 | 35 | 62 | 2 | 18 | 6 | default, card-open, import-open, page-2 (@1280); default @375/768 |
| S22-soalan-cipta `/guru/soalan/cipta` | 206 | 67 | 51 | 88 | 0 | 0 | 12 | default, galeri, inline-add, level-subject, script-arab, type-essay, type-fill-blank, type-short-answer, type-true-false (@1280); default @375/768; script-arab @375 |
| S23-soalan-show `/guru/soalan/{id}` | 30 | 27 | 0 | 3 | 0 | 0 | 3 | default @1280/375/768 |
| S24-soalan-edit `/guru/soalan/{id}/edit` | 44 | 35 | 0 | 9 | 0 | 0 | 3 | default @1280/375/768 |
| S25-audio-kbat `/guru/audio-kbat` | 31 | 28 | 0 | 3 | 0 | 0 | 3 | default @1280/375/768 |
| S26-audio-kbat-create `/guru/audio-kbat/create` | 106 | 102 | 0 | 4 | 0 | 0 | 3 | default @1280/375/768 |
| S27-databank `/guru/databank` | 67 | 64 | 0 | 3 | 0 | 0 | 3 | default @1280/375/768 |
| S28-databank-subjek `/guru/databank/{CODE}` | 166 | 98 | 58 | 10 | 2 | 18 | 8 | default, bidang, filtered, penerangan, report-modal (@1280, NOT sent); default @375/768; report-modal @375 |
| S29-sumbang-artikel `/guru/artikel` | 68 | 48 | 16 | 4 | 2 | 8 | 4 | default, page-2 (@1280); default @375/768 |
| S30-artikel-cipta `/guru/artikel/cipta` | 57 | 45 | 0 | 12 | 0 | 0 | 3 | default @1280/375/768 |
| S31-artikel-edit `/guru/artikel/{id}/edit` | 65 | 53 | 0 | 12 | 0 | 0 | 3 | default @1280/375/768 |
| S32-profil-guru `/guru/profil/edit` | 58 | 31 | 15 | 12 | 0 | 0 | 4 | default, school-search (@1280); default @375/768 |
| S33-kelas-saya `/kelas-saya` | 13 | 9 | 0 | 4 | 0 | 0 | 3 | default @1280/375/768 |
| S34-set-soalan-saya `/set-soalan-saya` | 6 | 3 | 0 | 3 | 0 | 0 | 3 | default @1280/375/768 |
| S35-errors `/settings`, `/guru/{id}`, `/guru/set-soalan/{id}` | 10 | 7 | 3 | 0 | 0 | 0 | 4 | settings-404 @1280/375, profil-awam-404, set-405 (@1280) |
| SHU-user-shell (chrome of S1, S3–S34) | 415 | 152 | 58 | 205 | 15 | 148 | 152 | all user-portal states |

**Horizontal page overflow at 375** (inventory flag plus a direct `scrollWidth` measurement):
- S12: 416 px;
- S16: 398 px;
- S18: 414 px;
- S20: 414 px;
- S22: 383 px.

These are narrative D-18 … D-21.

Two tables scroll inside their card, so the page does not overflow: S7 (484 / 340) and S17 (731 / 340). All other screens fit (`scrollWidth` 360–375).

**Empty and error states captured:**

| Screen | State |
|---|---|
| S1 | "Belum ada kelas. Cipta sekarang!", "Belum ada penghantaran tugasan." |
| S2 | "Tiada data", "Tiada aktiviti terkini", "Tiada data minggu ini", "Tiada data mencukupi untuk ramalan", remedial "Ralat: Unexpected token …" |
| S3 | "Belum ada ujian remedial dijana. …" |
| S4 | "Belum Ada Kelas" |
| S5 | "Tiada sekolah dijumpai" |
| S6 | "Belum ada pelajar dalam kelas anda", "Sekolah belum ditetapkan" |
| S8 | "Tiada jadual ditetapkan" |
| S9 | "Tiada mesej dihantar lagi." |
| S10 | "Tiada pelajar sedang aktif menjawab soalan sekarang", "Tiada streak aktif" |
| S11 | "Belum ada misi" |
| S13 | "Belum Ada Set Soalan" |
| S15 | "Belum ada soalan" |
| S16 | "Tiada kelas ditemui." |
| S17 | "Tiada soalan berstruktur lagi" |
| S22 | "Tiada galeri rajah tersedia" |
| S25 | "Belum ada set Audio KBAT." |
| S33 | "Belum Sertai Mana-Mana Kelas" |
| S34 | "Tiada Set Soalan" |
| S35 | 404 and 405 pages |

## 2. Not in the narrative discovery

`node tools/diff-narrative.js inventory/M10 docs/discovery/M10-teacher-class.md` reports **0 candidates on all 35 screens**. The not-in-narrative list is **empty**.

Appendix B of the narrative holds the remaining exact DOM strings, data samples and shell inline-script strings, generated by `tools/jobs/M10-appendix.js`. It also has a byte-exact block for the two "🖼️" strings, because the diff tool normalises their U+FE0F differently.

Items that only the scripted states and probes surfaced, all now in the narrative:
1. S12: `toggleSource()` is undefined, so the YouTube mission type never shows its section (D-02).
2. S2: the remedial scan returns HTTP 500 (D-03), and drill modal titles show raw type keys (D-04).
3. "Batal" behaviour:
   - S16 inline "Batal" only hides the add-chapter panel; the typed value is still there when the panel is reopened.
   - S28 report modal "Batal" hides the modal; reopening it for any question resets the reasons and the comment.
4. Edit forms (D-05, D-15):
   - S20 chapter and topic are empty.
   - S24 difficulty is not preselected: the options are 1–3, while the question shows "Sukar" / "Tahap 4". The correct option is preselected.
   - S31 category and grade are preselected.
5. Pagers keep non-empty filters (S17 `?subject_id=5&page=2`, S28 `?question_type=mcq&difficulty=3&page=2`).
6. Dead links (D-06 … D-09, D-24): `/guru/pelajar/cipta`, `/guru/soalan/template`, `/guru/soalan/galeri-rajah`, `/guru/{id}`, `/settings`.
7. S5: the school-class picker exists only in script, and the "Tahap Pendidikan *" radios are not `required` (D-22).
8. The S12 chapter select holds 935 chapters and is filtered by subject in the browser (BM → 85).

## 3. New routes found by the crawl

`_crawl.json` has 311 unique URLs:

| Module | URLs |
|---|---|
| M10 | 178 |
| M05 | 9 |
| M08 | 9 |
| M09 | 12 |
| M11 | 5 |
| M12 | 7 |
| M14 | 9 |
| M18 | 12 |
| Other modules (via the shell) | rest |
| Unknown | 15 |

Not yet in the TRACKER M10 checklist:

| URL | Kind | Found on | Note |
|---|---|---|---|
| `/guru/remedial-progress` | screen | S2 "📊 Rekod" | S3 |
| `/guru/kelas/cipta` | screen | S1, S4, S6, S16 | S5 |
| `/guru/kelas/{id}/qr-data` | JSON | S4 script | 404 for a class the admin does not own |
| `/guru/pelajar/cipta` | dead link | S6 | 302 → `/guru/pelajar` |
| `/guru/misi-harian/cipta` | screen | S1, S11 | S12 |
| `/guru/set-soalan/cipta` | screen | S13 | S14 |
| `/guru/soalan-guru/cipta` | screen | S15 | S16 |
| `/guru/soalan-berstruktur/cipta`, `/{id}`, `/{id}/edit`, `/{id}/toggle-status` | screens / POST | S17 | S18–S20 |
| `/guru/soalan/cipta`, `/guru/soalan/{id}`, `/guru/soalan/{id}/edit` | screens | S21 | S22–S24 |
| `/guru/soalan/import`, `/guru/soalan/hantar-kertas` | POST | S21 | not submitted |
| `/guru/soalan/template`, `/guru/soalan/galeri-rajah` | dead links | S21, S22 | D-08, D-09 |
| `/guru/audio-kbat`, `/guru/audio-kbat/create` | screens | S21 | S25, S26 |
| `/guru/audio-kbat/template`, `/template-word` | downloads | S21 | XLSX / DOCX |
| `/guru/databank/{CODE}` (25 codes) | screen | S27 | S28 |
| `/guru/artikel/cipta`, `/guru/artikel/{id}/edit` | screens | S29 | S30, S31 |
| `/guru/artikel/attachment/{id}` | DELETE | S31 | not called |
| `/guru/profil/edit` | screen | S1, S6 | S32 |
| `/guru/profil` | PUT | S32 | not submitted |
| `/guru/{id}` | 404 | S32 | D-06 |
| `/guru/command-center/…` (see below) | JSON / pages | S2 script | |
| `/guru/api/chapters`, `/guru/api/topics`, `/guru/api/dskp/{bidang,sk,sp}` (GET + POST) | JSON | S16, S18, S22, S28 | also used by M04 |
| `/kelas-saya/join` | POST | S33 | not submitted |
| `/kelas-saya/{id}` | screen | S33 | not observable |
| `/report-question` | POST | S28 | M04 reports |

The Command Center paths under `/guru/command-center/` are: `live-data`, `drill`, `remedial/scan`, `remedial/generate`, `remedial/cancel`, `evaluate`, `predictive`, `achievements`, `badge-holders`, `student/{id}`, `classroom/{id}` and `school/{sid}/teacher/{uid}`.

**Unknown in the crawl:**
- `/` (error pages);
- `/latih-tubi` (404 page link, itself a 404);
- template fragments `/edit`, `/view`, `/view?`, `/qr-data`, `/students`, `/remedial/`, `/api/school-classes/`, `/report-question`;
- shell widgets `/api/tournament/active`, `/chatbot/*`, `/fcm/token`.

## 4. Out-of-module links (target module)

| URL | Found on | Target |
|---|---|---|
| `/guru/monitoring` | S1 guide | M11 |
| `/analitik/kelas` | S1 "Analitik Kelas →" | M08 |
| `/misi-harian`, `/remedial/saya`, `/latihan-berstruktur` | sidebar; student side of S12, S2, S18 | M05 |
| `/artikel/{slug}` | S29 | M09 |
| `/api/schools/search` | S5, S32 | M02 |
| `/admin/question-submissions`, `/admin/soalan-gambar`, `/laporan-soalan` | shell / review targets | M04 |
| `/guru/kirkpatrick*`, `/guru/gamifikasi`, `/ppd/command-center` | shell | M12, M14, M18 |

## 5. What could not be revealed read-only / safety notes

| Item | Why |
|---|---|
| Populated class list, class detail, QR with a real join code, student roster, Pelajar Sekolah list | The admin owns no class and has no school. Creating one writes data. |
| Mission list and progress, broadcast history, timetable entries, set builder and set list, Soalan & Rujukan list | These need a POST. Missions and broadcasts reach real students. |
| Live session cards and weekly leaders; attendance "Hadir" rows | These need real student activity. |
| Remedial scan results, Jana / Lihat Quiz / Batal & Jana Semula, populated S3 | The scan returns 500; generate and cancel are POST. |
| Command Center Evaluate and Badges panels | Their GET endpoints are named "Penilaian Risiko" and "Scan & Award Badges" and may write. Not opened. |
| Validation errors and success messages of every form | Submitting is not allowed. |
| Galeri Rajah folders | The endpoint redirects (D-09). |
| Differences for a real teacher role (sidebar, shell, own-data scoping) | Only the admin account exists. |

**Safety notes:**
- No form was submitted and no mutating button was clicked (full list in narrative §10). No broadcast, mission, attendance change, toggle, approval or report was made.
- No `/quiz`, `/jawab`, `/start`, `/mula` or live-class join link was opened.
- Read-only GETs were sequential in one worker tab, at least 400 ms apart.
- The probes included the status and method checks listed in narrative §1.2, and two template downloads (header check only).
- The MCP navigate tool was not used; all navigation ran through `run_code` in the worker tab. So no unmasked accessibility snapshot was saved to `.playwright-mcp/`.
