# Bijak SPM in prestasiplus.cloud: discovery (student, admin, panel)

- **Feature slug:** `v2-bijak-spm` (companion: [../requirements/v2-bijak-spm.md](../requirements/v2-bijak-spm.md))
- **Date:** 2026-10-16 | **Method:** static reading of the .cloud server code only (D24: server code is authoritative where live cannot be observed). No live or server access was used. Nothing was run.
- **Evidence tags:** every fact is tagged `SERVER path:line`. Paths are relative to `D:\Dev Projects\prestasiplus-reference\backend`, written without the `backend/` prefix. Aliases: `W` = `routes/web.php`; `ESC` = `app/Http/Controllers/ExamSimulationController.php`; `EQC` = `app/Http/Controllers/ExamQuizController.php`; `SPC` = `app/Http/Controllers/Panel/SimulasiPaperController.php`; `SBC` = `app/Http/Controllers/Admin/Studio/SetBuilderController.php`; `ATT` = `resources/views/exam-sim/attempt.blade.php`.
- **Privacy:** no real person names or personal data from code, seeders or comments are copied here. Decisions quoted in code comments are attributed to "operator" only.
- **BM copy** is quoted exactly as in code. English wording in quotes is code English.

---

## 1. Overview

### 1.1 What "Bijak SPM" is in .cloud

| Item | Fact | Evidence |
|---|---|---|
| Name | The same feature carries four names. Student hub card "Bijak SPM"; sidebar item "Simulasi Peperiksaan" (badge "BARU"); page title "Simulasi Peperiksaan"; random-quiz page "Simulasi — Kuiz"; admin lane "Bijak SPM" (key `simulasi`); panel contract editor "Kontrak Simulasi". | `app/Http/Controllers/StudentController.php:943`; `resources/views/pelajar/layout.blade.php:221`; `resources/views/exam-sim/index.blade.php:3-4`; `resources/views/exam-sim/quiz.blade.php:3`; `app/Support/Spm/SpmLane.php:56-64`; `resources/js/panel/pages/spm/kontrak.tsx:678` |
| What it serves | Full SPM papers rendered "as the printed paper" from the **canonical exam tree** (`exam_papers` > `paper_sections` > `exam_questions` > `question_parts`). Student sits it timed, answers autosave, nothing is revealed until **Hantar**, then a **Semakan** screen shows scheme, auto-marks and self-mark steppers. | `ESC:20-27`, `ESC:555-558`, `ATT:40-44` |
| Two student modes | (1) **Exam mode** `/simulasi/{paper}` (attempt record, timer, autosave, submit, semakan). (2) **Kuiz mode**: `/simulasi/kuiz` (random MCQ drill, 5/10/20/40) and `/simulasi/{paper}/kuiz` (one paper paged by Bahagian). Kuiz mode writes **no attempt and no history**. | `W:1441-1454`; `EQC:28-30`, `EQC:109-118` |
| Who may sit | Route group is `auth` only (any role can open and **create an attempt**); all writes are `role:pelajar`. See defect N-07. | `W:1437-1454`, `W:1111-1135`; `ESC:103-112` |
| Feature flag | None for Bijak SPM itself. The hub card appears only when at least one paper is servable. `kertas-subjektif` flags the separate K2/K3/K4 viewer. | `StudentController.php:928,942-944`; `W:1459-1462` |
| Paper kinds | **Native** paper (`is_composite=false`; questions owned via `paper_section_id`; imported from DOCX/BI). **Composite** set (`is_composite=true`; questions referenced via `exam_paper_questions`; built in Set Builder or by "Jana set"; questions pinned to frozen snapshots on publish). | `app/Models/ExamPaper.php:17-31,92-95`; `app/Models/PaperSection.php:75-99`; `app/Services/SetPublisher.php:24-54` |
| Origin of composites | Tracking A sets are composites tagged in JSON column `import_issues.auto = 'tracking-a'` and `import_issues.set` (a metadata abuse of an issues column). | `ESC:459`; `resources/views/exam-sim/index.blade.php:24,35` |

### 1.2 Relationship to other SPM lanes (for the v2 merge, D32)

| .cloud lane (`SpmLane`) | Student URL | Store | Relation to Bijak SPM |
|---|---|---|---|
| `simulasi` "Bijak SPM" | `/simulasi` | canonical exam tree | This document |
| `databank`, `latih-tubi` | `/spm/tahun-lepas`, `/latih-tubi` | legacy `questions` | Bank drill; separate store (E1 in the question-bank doc) |
| `tracking-a` | `/spm/ramalan`, `/spm/tracking-a/{code}` | `spm_sets` or canonical composites | Its canonical sets are served **through /simulasi** (`ESC:449-461`) |
| `subjektif` | `/spm/subjektif` | `structured_*` | Separate; also feeds the `/spm-mock/kertas2` mock |
| `kertas` | `/kertas-subjektif` | `paper_documents` (page images) | Can be attached into a Bijak SPM Bahagian as a self-marked document (N-12) |
| SPM Mock (not a lane) | `/spm-mock`, `/spm-mock/kuiz`, `/spm-mock/kertas2` | legacy `questions` / `structured_*` | The "Jana Kertas" predecessor. See section 9 |

Source: `app/Support/Spm/SpmLane.php:23-84`; `app/Support/Spm/SpmLaneRegistry.php:24-32`; `W:1405-1418,1512-1523,1581-1584`.

### 1.3 Surface counts

| Surface | Screens documented | Notes |
|---|---|---|
| Student (Portal Pembelajaran equivalent) | **6** screens (S1-S6) + 2 entry points (E1 hub card, E2 sidebar) + 1 shared history screen (H1) | S3 is the review mode of the S2 view |
| Admin Blade (`/admin/**`) | **10** screens (A1-A10) | Create/Jana set and DOCX/BI upload exist **only** here |
| Panel (`admin.prestasiplus.cloud`) | **9** screens (P1-P9) + 4 adjacent editors noted, not counted | Panel has no "create set" and no "Jana set" |

---

## 2. Roles, gates and access

| Gate | Definition | Evidence |
|---|---|---|
| `auth` | Logged-in, any role | `W:1437` |
| `role:pelajar` | Student only (all attempt writes, retry, self-mark) | `W:1111-1135`; `app/Http/Middleware/EnsureRole.php:19-55` |
| `role:admin,admin_sekolah,pegawai_ppd` | Staff group for all `/admin/**` Studio/SPM routes and the whole Panel | `W:182,533` |
| `role:admin` | Every write (create, update, publish, import, generate, builder edits, blueprint CRUD) | e.g. `W:238-246,262-267,291-302,592-606,612,618,625-627,641-648,655-675` |
| `pusat:<label>` (`NationalOnly`) | Admin sees the page; `admin_sekolah` and `pegawai_ppd` get a **GET-only** 403 notice page "Halaman ini diuruskan oleh Admin Pusat sahaja. Ia tidak dipaparkan kepada mana-mana sekolah." with link "← Kembali ke Papan Pemuka"; a write is a plain 403 | `app/Http/Middleware/NationalOnly.php:46-107`; `resources/js/panel/pages/khas-pusat.tsx:21-48` |
| Panel gates | `pusat:Kandungan SPM` on hub, lanes, kertas, kontrak, review, tracking-a, soalan, subjektif; `pusat:Question Studio` on Studio browse/preview/edit/builder/bank/documents | `W:196,201-254,262,276,304-310,316-317,341-342,370-373` |
| Blade `/admin/spm/*` | Hub and lane listings are staff-readable; quick edit has its own `pusat:Sunting Kandungan SPM` | `W:691-692,700-722` |
| Blade `/admin/studio/*` | GET screens (index, edit, preview, imports index/review, set list, builder, bank, pool, paper review) are open to all three staff roles; writes are admin only | `W:533,590-598,633-635,654,658,660,664` |
| Essay review | Not gated by `pusat:`; scoped by `StaffScope` (a school admin sees only own school's pupils) | `W:219-222`; `app/Http/Controllers/Panel/EssayReviewController.php:29-39,52-65` |

**Observed gap:** Blade Studio GET screens carry no `pusat:` middleware (`W:590-598,633-635,654-665`), so school and district staff can open them although the content is national (they cannot write; per-controller scoping was not read, so this is route-level only). The Panel hides this with the Admin-Pusat-only notice; the Blade side does not. v2 resolves it by menu filtering (D30).

---

## 3. Screen inventory

### 3.1 Student screens

Layout for S1-S3, S5-S6 is `pelajar.layout` (student shell); S4 uses the bare `exam-sim.layout` (stamp "SULIT"). Attempt CSS forces `data-theme="light"` (paper look) (`ATT:21-27`).

| ID | Route (name) | Controller@method | View | Gate |
|---|---|---|---|---|
| S1 | `GET /simulasi` (`simulasi.index`) | `ESC@index` (`ESC:31-60`) | `exam-sim/index.blade.php` | `auth` (`W:1441`) |
| S2 | `GET /simulasi/{paper}` (`simulasi.show`, `whereNumber`) | `ESC@show` (`ESC:62-139`) | `exam-sim/attempt.blade.php` (`reviewing=false`) | `auth` (`W:1453`) |
| S3 | `GET /simulasi/percubaan/{attempt}/semakan` (`simulasi.review`) | `ESC@review` (`ESC:147-170`) | `exam-sim/attempt.blade.php` (`reviewing=true`) | `role:pelajar`, owner-checked 403 (`W:1120`; `ESC:149`) |
| S4 | same URL as S2 when an unsubmitted sitting > 60 s old exists and `?sambung=1` is absent | `ESC@show` (`ESC:113-128`) | `exam-sim/resume.blade.php` | `auth` |
| S5 | `GET /simulasi/kuiz?count=&subject=` (`simulasi.quiz`) | `EQC@index` (`EQC:30-95`) | `exam-sim/quiz.blade.php` | `auth` (`W:1446`) |
| S6 | `GET /simulasi/{paper}/kuiz` (`simulasi.paper.quiz`) | `EQC@paper` (`EQC:109-118`) | `exam-sim/quiz-paper.blade.php` | `auth` (`W:1450`) |
| H1 | `GET /spm/history` | `StudentController@spmHistory` (`StudentController.php:999-1055`) | `pelajar/spm-history` | `role:pelajar` (`W:1198`) |
| E1 | hub card on `/spm` and `/pelajar/spm` | `StudentController@spm` (`StudentController.php:910-975`) | `pelajar/spm` | `role:pelajar` |
| E2 | sidebar item under section "SPM" | `resources/views/pelajar/layout.blade.php:221` | n/a | shell |

Student JSON/POST endpoints (not screens):

| Endpoint | Controller | Purpose | Evidence |
|---|---|---|---|
| `PATCH /simulasi/percubaan/{attempt}/jawapan` (`simulasi.autosave`) | `ESC@autosave` | Batch autosave of the whole answer set + flags + choose-N picks | `W:1113-1114`; `ESC:231-276` |
| `POST /simulasi/percubaan/{attempt}/hantar` (`simulasi.submit`) | `ESC@submit` | Grade objective, finalize, redirect to S3 | `W:1115-1116`; `ESC:375-443` |
| `POST /simulasi/percubaan/{attempt}/semak` (`simulasi.selfmark`) | `ESC@selfMark` | Self-mark one part | `W:1122-1123`; `ESC:564-603` |
| `POST /simulasi/percubaan/{attempt}/semak-bahagian` (`simulasi.selfmark.section`) | `ESC@selfMarkSection` | Self-mark a whole document Bahagian | `W:1128-1129`; `ESC:613-654` |
| `POST /simulasi/{paper}/cuba-lagi` (`simulasi.retry`) | `ESC@retry` | Start a fresh attempt | `W:1134-1135`; `ESC:204-221` |
| `POST /simulasi/kuiz/semak` (`simulasi.quiz.check`) | `EQC@check` | Server-side check of one MCQ option | `W:1447`; `EQC:124-149` |

The removed endpoint `simulasi.markpage` (per-page instant mark) is documented as deliberately gone: "Do not re-add this route." (`W:1136-1138`; `ESC:555-558`).

### 3.2 S1 `/simulasi` (paper list)

| Element | Exact copy / rule | Evidence |
|---|---|---|
| Title / heading | "Simulasi Peperiksaan" | `exam-sim/index.blade.php:3-4` |
| Subheading | "Duduki kertas SPM dalam format kertas sebenar — jawab, tanda automatik setiap halaman" (**stale**, see N-03) | `index.blade.php:5` |
| Query | All `ExamPaper::servable()` ordered by title; grouped by `subject.name_bm` (fallback "Lain-lain"); papers sorted by `import_issues['set']`; groups sorted by paper count desc | `ESC:41-57` |
| Group header | subject name; "`{n}` set · `{subject code}`" | `index.blade.php:16-17` |
| Paper card | Link to S2. Title "Set `{n}`" if `import_issues.set` exists, else the paper title. Badge "Tracking A" when `is_composite` (every composite, not only Tracking A). Meta: "Kertas `{k}`" (if set), "`{m}` markah" (effective marks, so pilih-1 shows 100 not 310), "`{d}` min" (if duration). Action "Mula" | `index.blade.php:22-46`; `app/Models/ExamPaper.php:177-180` |
| Empty state | Heading "Tiada kertas tersedia buat masa ini"; body "Set simulasi sedang dalam penyediaan. Semak semula tidak lama lagi." | `index.blade.php:51-55` |
| Not shown | No attempt status, no best score, no filter, no search, no source papers (1,300+ registered PDFs deliberately hidden) | `ESC:33-37` |

### 3.3 S2 `/simulasi/{paper}` (attempt, exam mode)

**Entry logic** (`ESC:62-139`): servable gate re-applied (drafts 404). The sitting is pinned in the PHP session key `exam_sitting_{paper}`. If no pinned unsubmitted attempt for this user and paper: create `exam_attempts` (`mode='exam'`, `status=in_progress`, `started_at=now`, `served_composition` snapshot). If a pinned attempt exists, `started_at` is more than 60 s ago, and `?sambung=1` is absent: show S4 (nothing created). A logout destroys the pin, so a shared device gives the next pupil a **blank** paper (operator request, comment at `ESC:84-92`). The student's most recent submitted attempt is passed as `lastReview`.

**Layout regions** (`ATT:88-206`):

| Region | Content |
|---|---|
| Sticky control bar | Timed paper: countdown `mm:ss` (class `warn` at <= 300 s). Untimed paper: count-up clock with title "Masa berlalu". Save-state text. Link "Lihat semakan lepas" (only if a previous submitted attempt exists). Button "Hantar" |
| T-5 banner | "Amaran: masa berbaki kurang 5 minit." (`role="status"`, shown once when `left <= 300` and `> 0`) |
| Cover | "SULIT" and paper code (`cover_code`, else subject code); `h1` subject name; "`{code}` · Kertas `{k}`"; "`{d}` minit"; numbered instruction lines (`instructions`); grid "Untuk Kegunaan Pemeriksa" with columns "Bhg", "Soalan", "Penuh", "Diperoleh" and a "Jumlah" row (**rendered only if the paper has any self-marked part**, `isFullyAutoMarked()` false) |
| Reference panels | `<details open>` per `reference_assets` entry (formula sheet, constants, tables): title + items; rendered nothing if none declared |
| Bahagian block | Header label; `[{n} markah]` (effective marks); rule line = `instruction_text` else "Jawab `{n}` soalan sahaja." (choose_n) or "Jawab semua soalan."; choose-N counter "`{c}` / `{n}` soalan dipilih" |
| Shared passage | If exactly one stimulus is common to **every** question in the Bahagian (>= 2 questions): split layout, sticky left pane with "📌 Petikan kekal dipapar semasa menjawab". Below 820 px the pane collapses to a sticky header (max 42vh) |
| Question | Stimuli first, then number + stem + `[{n} markah]` + flag button (title "Tanda soalan"); choose-N checkbox "Pilih soalan ini untuk dijawab"; parts recursively (label "(a)", prompt, marks, nested sub-parts, widget on leaves only) |
| Paging | Paper is cut into "sheets" by weight rule (section 5.3). Footer: "SULIT", "← Sebelum" / "Halaman `{x}` daripada `{y}`" / "Seterusnya →" / "Hantar Jawapan" (last sheet), paper code; "KERTAS PEPERIKSAAN TAMAT" on last sheet |
| Question map (right rail, sticky) | Per Bahagian: label, "pilih `{n}`" for choose-N; one dot per question (aria-label "Soalan `{n}`") with state classes answered / flagged; legend "Dijawab", "Ditanda", "Belum" |

**Widget catalogue** (answer modes; `resources/views/exam-sim/components/widget.blade.php:28-86`):

| `answer_modes.slug` | UI | Response shape (key convention) | Evidence |
|---|---|---|---|
| `mcq` | Radio group `aria-label="Pilihan jawapan"`; labels A-D; value = `part_options.id` (never the letter) | `{value: optionId}` key `{part}` | `widgets/mcq.blade.php:11-21` |
| `short_text` | Text input, placeholder "Tulis jawapan…", aria "Jawapan" | `{value}` | `short-text.blade.php` |
| `numeric` | Text input `inputmode="decimal"`, placeholder "cth. 3.14…", aria "Jawapan berangka", optional unit label from `config.unit` | `{value}` | `numeric.blade.php` |
| `numbered_list` | `config.rows` (default 3) text rows labelled I, II, III, IV, V, VI then 7+; aria "Jawapan `{n}`" | keys `{part}-{i}` | `numbered-list.blade.php` |
| `extended_essay` | Textarea "Tulis jawapan anda di sini…", aria "Jawapan esei"; live counter "`{w}` patah perkataan"; optional `word_limit` as max | `{value}` | `extended-essay.blade.php`; `ATT:686-701` |
| `essay_choice` | Radio list of `config.topics`, then textarea "Tulis karangan anda di sini…" aria "Karangan"; counter "`{w}` patah perkataan · sasaran `{min}`–`{max}`" (`.over` / `.ok` classes) | keys `{part}-topic` and `{part}` | `essay-choice.blade.php` |
| `working_shown` | "Ruang kerja" textarea (placeholder "Tunjukkan langkah pengiraan…") + "Jawapan:" input (placeholder "jawapan akhir", aria "Jawapan akhir") + optional unit | `{working, value}` keys `{part}-w` and `{part}` | `working-shown.blade.php` |
| `table_fill` | Table from `config.head/rows`; each cell equal to `_` becomes an input (aria "Sel `{n}`") | keys `{part}-c{n}` | `table-fill.blade.php` |
| `sequence_order` | Draggable rows with grip glyph "⠿"; **no drag handler exists** (N-02) | ordered index array, key `{part}` | `sequence-order.blade.php:10-19` |
| `gapped_text_match` | Chip pool "A — body" (aria-hidden) + one `<select>` per gap, first option "— pilih —", aria "Padanan `{n}`" | keys `{part}-g{n}` | `gapped-text-match.blade.php` |
| `cloze` | Inline input `size=8`, aria "Isi tempat kosong" | `{value}` | `cloze.blade.php` |
| `graph_plot` | 480x360 canvas, aria "Ruang lukis graf"; axes from `config` (`x_/y_` min, max, step, label); hint "Klik untuk plot titik — titik disambung ikut turutan."; buttons "Buang terakhir", "Padam semua"; toolbar of sketch tools | `{points, strokes}` | `exam/widgets/graph-plot.blade.php:29-40` |
| `draw_on_diagram` | Transparent 360x220 canvas over `config.base_html`; hint "Lukis pada rajah"; button "Padam" | `{strokes}` | `exam/widgets/draw-on-diagram.blade.php` |
| `code` | Monospace textarea, aria "Editor kod", placeholder `config.placeholder` or "// tulis kod anda"; **no execution** | `{code, lang}` | `exam/widgets/code.blade.php` |
| unknown | "Jenis jawapan ini akan tersedia tidak lama lagi." | n/a | `widget.blade.php:85-86` |

**Stimulus kinds** rendered (`resources/views/exam-sim/components/stimulus.blade.php:30-165`): `passage` (title, html, `source_citation`), `box` (list), `table` (image if asset and no rows, else HTML table), `diagram`/`map`/`graph` (svg, asset image, or html; caption default "Rajah"/"Graf"), `image`/`infographic`/`cartoon` (picture **and** text), `math` (MathML, no JS), `code`/`pseudocode`/`sql` (pre/code, literal), `audio` (custom player: title default "Rakaman audio", aria "Main rakaman", `max_plays` enforced in JS at `resources/js/exam/hard-widgets.js:698-733`), `video` (placeholder "Media (video) — akan datang"), default html. Images carry `width`/`height` and `loading="lazy"` to avoid layout shift.

**Document Bahagian ("hybrid Bahagian B")** (`components/bahagian-dokumen.blade.php:25-119`): header label, `[{mark_budget} markah]`, rule line default "Jawab semua soalan pada Bahagian ini.", line "Kertas `{k}` — `{title}` · dinilai sendiri (bukan ditanda automatik)", page images (alt "Muka surat `{n}`"; empty "Imej kertas belum tersedia."), button "Tunjuk Skema Pemarkahan (cuba jawab dahulu)", revealed block "Skema Pemarkahan (dinilai sendiri)" with "Sembunyi", then "Markah dinilai sendiri (Bahagian B):" number input / `{budget}`; if budget unset "Markah maksimum Bahagian ini belum ditetapkan — hubungi pentadbir."; if no scheme pages "Skema pemarkahan tidak tersedia untuk kertas ini." **Note:** this scheme reveal is a self-toggle available **before** submit (N-12).

### 3.4 S3 Semakan (review of a submitted attempt)

Same view with `reviewing=true`. Differences (`ATT:105-127`; `components/scheme.blade.php`):

| Element | Behaviour / copy |
|---|---|
| Control bar | "Dihantar"; score "`{score}` / `{max_score}`" (updated live after each self-mark); form button "Cuba Lagi" (POST retry) |
| Fields | Read-only (`onFieldEvent` returns when `reviewing`); timer frozen |
| Per leaf part with an answer key | Block `Skema Pemarkahan · {marks} markah`, content by key kind: `single_key` "Jawapan: **`{label}`** `{body}`"; `accepted_values` "Jawapan diterima: **`{values}`**" and "(toleransi ±`{t}`)"; `mapping` "Padanan betul: `{json}`" (raw JSON, N-14); `mark_scheme_points` bullet list with `[{n} markah]` and a tick (title "Kata kunci dikesan dalam jawapan") for keyword hits, then "🔎 Cadangan automatik (kata kunci): `{a}` / `{m}` — `{x}`/`{y}` isi dikesan. Sila semak & laraskan."; `model_answer` text; `band_rubric` radio per band "Band `{b}` · `{label}` (`{min}`-`{max}`): `{descriptor}`" (aria "Pilih Band `{b}`") |
| Objective verdict | "✓ Betul (`{awarded}`/`{marks}`)" or "✗ Salah (`{awarded}`/`{marks}`)" for `single_key`, `accepted_values`, `mapping` |
| Subjective self-mark | "Markah kendiri:" number input 0..part marks, "/ `{marks}`", aria "Markah kendiri untuk bahagian ini". Pre-filled with the stored mark, else the keyword suggestion. A band selection sets the stepper to the band midpoint and narrows its min/max |
| Cover grid | "Untuk Kegunaan Pemeriksa" stays blank (never filled) |

Self-mark POST fires on `change`; failure is swallowed (comment "best-effort UX") (`ATT:447-460`).

### 3.5 S4 Resume choice

| Element | Copy |
|---|---|
| Title / stamp | "Sambung Percubaan" / "SULIT" |
| Heading | "Percubaan belum dihantar" |
| Body | "Anda mempunyai percubaan **`{title}`** yang masih berjalan." (shows the stored paper title, unlike the cover which hides it) / "Masa berlalu setakat ini: `mm:ss`" |
| Primary | Link "Sambung — teruskan jawapan & masa sedia ada" (`?sambung=1`) |
| Secondary | Form POST retry, `confirm('Semua jawapan dan masa untuk percubaan ini akan dikosongkan. Mula semula?')`, button "Mula Semula — kosongkan jawapan & masa" |
| Footnote | "“Sambung” mengekalkan semua jawapan anda. “Mula Semula” tidak boleh diundur." |

Evidence: `resources/views/exam-sim/resume.blade.php:11-45`. Note: `mm:ss` uses `gmdate('i:s')`, so elapsed >= 60 minutes wraps (N-16).

### 3.6 S5 `/simulasi/kuiz` (random MCQ drill) and S6 `/simulasi/{paper}/kuiz`

| Screen | Behaviour | Copy |
|---|---|---|
| S5 | `count` in {5,10,20,40} else 20; optional `subject` code; random servable MCQ parts that have a correct option; stem/prompt/stimulus (first stimulus only), options shuffled and relettered A-D; **no `is_correct` in the payload**; one question at a time; "Semak" posts `{part_id, option_id}` to `/simulasi/kuiz/semak` and gets `{correct, correct_option_id}`; local score/timer; **nothing stored** | "Simulasi — Kuiz"; "Soalan `{i}` daripada `{n}`"; "Masa"; "❓ Soalan `{i}`"; "`{m}` markah"; stimulus caption default "Petikan"; "✓ Semak Jawapan"; "🎉 Betul!" / "😟 Salah"; "Soalan Seterusnya →" / "Tamat →"; "Kuiz Selesai!"; "Markah"; "Ketepatan"; "Masa: "; "↻ Cuba Lagi"; "Kertas penuh". Empty: "Belum ada soalan objektif" + "Kuiz ini mengambil soalan objektif daripada kertas yang telah diterbitkan dan mempunyai skema jawapan. Buat masa ini belum ada kertas yang memenuhi kedua-duanya." + "← Kertas penuh" |
| S6 | `PaperViewBuilder::pages()` pages a servable paper **by Bahagian**; shared passage pinned above; MCQ parts have "✓ Semak"; other leaf parts get a textarea ("Tulis jawapan anda di sini…") whose value is **never sent or marked** (N-05); document Bahagian read-only with scheme toggle; footer "Skor: `x` / `y`" (markable parts only), "← Sebelum" / "Seterusnya →" | "Kertas ini tiada soalan"; "← Kembali"; "Skema jawapan belum tersedia untuk soalan ini."; "Skema pemarkahan tidak tersedia untuk kertas ini." |

Evidence: `EQC:30-149`; `resources/views/exam-sim/quiz.blade.php`; `quiz-paper.blade.php`.

### 3.7 Entry points and history

| ID | Copy / behaviour | Evidence |
|---|---|---|
| E1 | Card on the SPM hub: icon `fa-file-signature`, "Bijak SPM", "Duduki kertas SPM penuh dalam format kertas sebenar — bermasa, dengan skema.", count "`{n}` set" (= servable papers). Shown only when count > 0 | `StudentController.php:942-944` |
| E2 | Sidebar "Simulasi Peperiksaan", badge "BARU", tooltip "Duduki kertas SPM dalam format kertas sebenar — bermasa, dengan skema selepas hantar". Not behind a flag | `pelajar/layout.blade.php:221` |
| H1 | `/spm/history` lists the last 50 `practice_sessions` for modes `spm_tahun_lepas`, `spm`, `spm_mock`, `latih_tubi`, `spm_ramalan`. Mode labels: "Tahun Lepas", "SPM Mock", "Latih Tubi", "Tracking A". **There is no "Bijak SPM" label**: a native Simulasi run shows as "Tahun Lepas" (N-10). Letter grade is computed from accuracy: >=90 A+, >=80 A, >=70 A-, >=65 B+, >=60 B, >=55 C+, >=50 C, >=40 D, else E | `StudentController.php:999-1055`, `977-991` |

### 3.8 Admin Blade screens (`/admin/**`, layout "admin")

| ID | Route | Controller@method | Gate | Purpose |
|---|---|---|---|---|
| A1 | `GET /admin/spm` (`admin.spm.hub`) | `Admin\SpmHubController@index` | staff | Hub of the six lanes (`SpmLane::all()`): card label, `desc`, total, attention count + `attentionLabel` |
| A2 | `GET /admin/spm/{lane}` with `lane=simulasi` (`admin.spm.lane`) | `Admin\SpmLaneController@index` + `SimulasiLaneQuery` | staff | Paper list: 25/page, filter subject, search title; row = title, "`{subject}` · `{n}` soalan", status label (`paper_statuses.label`, "Terbit"/"Draf"), attention text; edit link = Set Builder (composite) or paper review (native) |
| A3 | `GET /admin/studio` (`admin.studio.index`) | `Admin\Studio\StudioController@index` | staff | Unified question browser (filters subject, chapter, status, year, board, kertas, type) |
| A4 | `GET /admin/studio/questions/create`, `/{q}/edit`, `/{q}/preview`; POST `submit`, `publish`, `archive`, `edit-as-draft`; `POST /admin/uploads/stimulus` | `StudioQuestionController` | read: staff; write: admin | Question Studio authoring + lifecycle (draft > reviewed > approved > archived) |
| A5 | `GET /admin/studio/imports` (tabs "kelompok" / "kertas") | `ImportReviewController@index` | staff | Import batches and native-paper list (`ExamPaper where is_composite=false`) |
| A6 | `GET /admin/studio/imports/{batch}/review` | `ImportReviewController@review` | staff | Split-pane review of staged OCR/extraction items; `accept`, `reject`, `edit`, `accept-all` (all draft-only, never auto) |
| A7 | `POST /admin/studio/imports/upload` | `ImportUploadController@store` | admin | DOCX **ZIP** of set folders > `DocxSetImporter::importAll` > DRAFT paper(s); synchronous |
| A8 | `POST /admin/studio/imports/bi-comprehension` | `BiComprehensionUploadController@store` | admin | BI Kertas 1 DOCX (+ optional answers DOCX) > DRAFT paper |
| A9 | `GET /admin/studio/imports/paper/{paper}/review`; POST `publish`, `unpublish` | `PaperReviewController` | read: staff; write: admin | Native-paper review + publish gate |
| A10 | `GET /admin/studio/sets` (list + "Cipta Set Baharu" + "Jana set"), `GET /admin/studio/sets/{paper}/builder` | `SetBuilderController@index/@builder` | read: staff | Composite sets: create, random draw, drag-drop builder, publish |

Set Builder JSON endpoints (all `role:admin` except `bank`/`pool`): `POST /admin/studio/sets` (create), `POST .../generate`, `POST .../{paper}/regenerate`, `GET .../{paper}/bank`, `GET .../pool`, `POST .../{paper}/sections/{section}/questions` (add), `.../reorder`, `DELETE .../questions/{membership}`, `PATCH .../sections/{section}`, `POST .../{paper}/publish` (`W:654-675`).

### 3.9 Panel screens (`admin.prestasiplus.cloud`, Inertia/React, "Metronic")

Group middleware `auth` + `role:admin,admin_sekolah,pegawai_ppd` (`W:176-182`). All screens below are national-only (`pusat:`) for reads and `role:admin` for writes.

| ID | Route (name) | Controller | React page | Purpose |
|---|---|---|---|---|
| P1 | `GET /spm` (`panel.spm.hub`) | `Panel\SpmController@hub` (`:45-68`) | `spm/hub.tsx` | Six lane cards |
| P2 | `GET /spm/{lane}` (`panel.spm.lane`), `lane=simulasi` | `Panel\SpmController@lane` (`:96-207`) | `spm/lane.tsx` | Paper list; row Sunting > P3 (native) or P5 (composite); "Salin set" on native rows; **no "Baharu", no "Jana"** |
| P3 | `GET /spm/simulasi-paper/{paper}/review` (`panel.spm.simulasi.review`) | `SPC@show` (`SPC:56-154`) | `spm/simulasi-review.tsx` | Native paper review, edit, publish |
| P4 | `GET /spm/kontrak` (`panel.spm.kontrak.index`) | `Panel\BlueprintController@index` (`:39-75`) | `spm/kontrak.tsx` | Kontrak Simulasi (blueprint) editor |
| P5 | `GET /studio/sets/{paper}/builder` (`panel.studio.sets.builder`) | `Panel\SetBuilderController@builder` | `studio/set-builder.tsx` | Composite set builder (read payload shared with Blade via `SetBuilderPayload`) |
| P6 | `GET /studio` (`panel.studio`) | `Panel\StudioController@index` | `studio.tsx` | Read-only bank browser (same `QuestionBankDirectory` service as A3) |
| P7 | `GET /studio/preview/{question}` | `Panel\StudioPreviewController` | `studio` preview | Same-host preview via `StudioPreview` |
| P8 | `GET /spm/tanda-karangan` (`panel.spm.essay-review`) | `Panel\EssayReviewController@index` | `spm/essay-review.tsx` | Confirm or adjust AI essay-mark proposals (not `pusat:`, scoped by school) |
| P9 | 403 notice | `NationalOnly` | `khas-pusat.tsx` | "Admin Pusat sahaja" |

Adjacent Panel editors **not** counted (other lanes): `/spm/tracking-a/{set}/sunting`, `/spm/soalan/{q}/sunting|pratonton`, `/spm/subjektif/{q}/sunting`, `/spm/kertas` CRUD (`W:201-256`). Panel in-place question edit is JSON-only: `GET /studio/{q}/edit`, `PUT /studio/{q}` (only for "simple" questions, `PanelEditable::isSimple`, draft only), `POST /studio/{q}/archive`, `POST /studio/uploads/stimulus` (`W:316-334`).

### 3.10 Admin and Panel element detail

**P1/A1 hub card copy** (`resources/js/panel/pages/spm/hub.tsx:42-88`; `SpmLane.php`): intro "Setiap kad ialah satu laluan yang pelajar boleh buka. Nombor merah menunjukkan berapa banyak item yang perlu diperiksa."; badge "Flag OFF" (flagged lanes off); count badge `{n} {attentionLabel}` (red) or "Semua elok" (green); "Buka senarai". Simulasi card: label "Bijak SPM", desc "Kertas SPM penuh dalam format sebenar.", `attentionLabel` "tiada kunci jawapan".

**P2/A2 lane list** (`lane.tsx`; `SimulasiLaneQuery.php:53-75`): filters "Subjek" (option "Semua Subjek"), "Status" (option "Semua Status"; **hidden for this lane**, `statuses()` returns `[]`, `:98-104`), "Cari" (placeholder "Teks soalan..."); table "Tajuk", "Status", "Perhatian", "Tindakan"; attention text only for **published** papers: "Disajikan tetapi tiada soalan" (0 questions) or "Ada soalan tanpa skema jawapan"; row meta "`{subject}` · `{n}` soalan"; disabled control title "Editor dalam panel akan datang" for rows with no in-panel editor; "Pratonton (baca sahaja)" for bank lanes. Rule source `SpmAttention::brokenSimulasiPaperIds()`. Hub total for the lane = `count(exam_papers)` including drafts (`SpmAttention.php:48,95`).

**P3 paper review** (`simulasi-review.tsx`; `SPC`):

| Region | Fields / buttons / messages |
|---|---|
| Header card | Title, badge "Terbit" or "Draf", "`{subject}` · Kertas `{k}` · `{n}` soalan", "Tempoh", "Status" |
| Live banner (published only) | "Kertas ini sudah diterbitkan (live)" / "Untuk menyunting soalan atau passage, buat salinan draf dahulu — kertas asal kekal tidak berubah sehingga anda menerbitkan salinan." + button "Salin untuk sunting" (busy "Menyalin…") |
| "Kemas kini metadata" | "Tajuk" (required, max 255), "Tempoh (minit)" (0-65535), "Kod kertas (kulit)" (max 32; help "Dipapar di kulit kertas (cth. 1449/1). Kosong = kod subjek “`{code}`”."), "Arahan kulit kertas" (textarea max 5000; placeholder "Satu baris = satu arahan bernombor di kulit kertas."), button "Simpan" (busy "Menyimpan…"). Cover code and instructions are disabled when published. Rule: changing them on a live paper is refused with "Kertas ini sudah diterbitkan — tekan "Salin untuk sunting" untuk menukar arahan kulit atau kod kertas." (`SPC:377-416`) |
| Reference panels | "Sunting bahan rujukan": up to 10 panels, each title (<=200) + up to 40 items, each exactly one of `keep` / image `asset_id` / text with baked math; buttons "Tambah panel", "Tambah gambar", "Tambah teks / rumus", "Simpan bahan rujukan"; error "Setiap item mesti satu gambar atau satu teks." (`SPC:747-829`) |
| "Isu import (`{n}`)" | Collapsible list of importer warnings, flattened to strings ("Soalan `{n}`: `{detail}`") |
| "Belum boleh diterbitkan" | Badge "`{n}` masalah" and the `SetPublishValidator` error list (section 6.2); recomputed on every GET |
| "Kontrak Simulasi" panel | Expected vs actual per Bahagian from `BlueprintConformance::gateFor`; informational, never disables Terbitkan |
| Bahagian cards | "Sunting bahagian": label (max 100; help "Tajuk bahagian yang pelajar nampak (cth. “Bahagian A”). Kontrak Simulasi memadankan bahagian ikut label ini — label yang tidak sepadan akan disekat semasa Terbitkan."), instruction text (max 2000), selection rule (`answer_all` / `choose_n`) and select count (1-100, must be <= question count), button "Simpan bahagian". Draft only (`abort_if(servable,403)`, `SPC:435-505`) |
| Passage box | "Sunting petikan" (TipTap), caption (<=240), "Simpan petikan". Draft only. If the stimulus row is shared with another paper (after "Salin set") it is **forked** for this paper: "Petikan telah dikemas kini. Ia dikongsi dengan kertas lain, jadi satu salinan dibuat untuk kertas ini sahaja." (`SPC:535-624`) |
| Question cards | "Sunting soalan" (opens the Studio editor in a dialog "Sunting Soalan `{n}`"; only if not servable and `PanelEditable::isSimple`); otherwise note "Kertas ini sudah diterbitkan — tekan “Salin set” di atas untuk menyunting salinan draf." or "Jenis soalan ini (cth. jawapan pendek) belum ada editor dalam panel. Sunting di Studio…" |
| Soalan Tambahan | "Tambah bahagian" (creates "Part `{n+1}`" at the end) and per-added-Bahagian "Tambah soalan" (dialog "Tambah bahagian" / "Tambah soalan — `{label}`"; number label, answer mode in `mcq, short_text, numeric, extended_essay, working_shown, graph_plot`, marks 0-200; confirm "Tambah & sunting"); "Padam soalan" only on an added question with no student responses on a draft paper; confirm "Padam soalan `{n}`?" (`SPC:885-1042`; `app/Support/Spm/SoalanTambahan.php:45`). Errors: "Nombor soalan `{label}` sudah digunakan dalam kertas ini."; "Soalan hanya boleh ditambah ke bahagian yang dicipta oleh admin."; "Soalan asal kertas tidak boleh dipadam."; "Soalan ini telah dijawab oleh pelajar dan tidak boleh dipadam. Sila salin dan terbitkan kertas soalan yang baharu." |
| "Penerbitan" | Live text "Kertas ini sedang DITERBITKAN — pelajar boleh mengaksesnya di Simulasi."; checkbox "Terbitkan walaupun tidak memenuhi kontrak Simulasi" (shown only after a blueprint block was flashed); buttons "Terbitkan" (disabled while blockers exist; tooltip "Betulkan `{n}` masalah dahulu" / "Terbitkan kertas"; busy "Menerbitkan…"), "Sembunyikan" (unpublish), "Salin untuk sunting" |
| Flash messages | publish ok "Kertas '`{title}`' telah DITERBITKAN — kini boleh diakses pelajar di Simulasi."; zero questions "Kertas ini tiada soalan — tidak boleh diterbitkan."; blocked "Kertas ini belum boleh diterbitkan — `{n}` masalah perlu dibetulkan."; blueprint blocked "Kertas ini tidak memenuhi kontrak blueprint subjek."; unpublish "Kertas '`{title}`' ditarik balik ke DRAF — tidak lagi diakses pelajar."; metadata "Kertas '`{title}`' telah dikemas kini."; duplicate "Set disalin sebagai draf. Sunting dan terbitkan salinan baharu." |

**P4 Kontrak Simulasi** (`kontrak.tsx`; `Panel\BlueprintController`): banner "**Kontrak dikongsi.** Setiap kontrak di bawah ialah peraturan bagi satu subjek × kertas — bukan satu set soalan. Menyunting kontrak ini mengubah pintu terbitan (publish gate) untuk **SEMUA** kertas subjek tersebut, bukan hanya satu kertas."; "Senarai Kontrak" with "`{n}` kontrak"; button "Baharu" > dialog "Kontrak Baharu" ("Cipta kontrak bagi satu subjek × kertas yang belum mempunyai kontrak. Bahagian boleh ditambah selepas dicipta."): "Subjek" (no "none" option), "Kertas" (Kertas 1-4), "Sumber" (Draf / Spec / Disahkan), "Kod Kertas" (<=50), "Tempoh (minit)" (0-65535), "Jumlah Markah" (0-65535), checkbox "Boleh tanda auto", "Nota" (<=2000), buttons "Batal"/"Cipta". Per contract card: title "Kertas `{k}`" + code, badge Draf (with " — sahkan dengan LPM") / Spec / Disahkan, "Padam kontrak" (confirm "Padam kontrak ini?" + "Padam kontrak Kertas `{k}` bagi `{subject}`? Semua Bahagian kontrak turut dipadam. Ini menjejaskan pintu terbitan untuk SEMUA kertas subjek/kertas ini. Tindakan ini tidak boleh dibatalkan."), header fields, "Bahagian" rows ("Label" placeholder "Contoh: Bahagian A"; "Peraturan Pilihan" Tiada / Jawab Semua / Pilih N; "Pilih N" 1-100 when Pilih N; "Markah" 0-65535; "Arahan (opsyenal)"; "Mod Jawapan Dijangka" checkboxes of all 14 answer-mode slugs shown as the slug with underscores replaced by spaces; "Buang Bahagian"; "Tambah Bahagian"; "Tiada Bahagian lagi."), "Simpan". Empty: "Tiada kontrak lagi. Cipta kontrak pertama menggunakan butang "Baharu" di atas." Flash: "Kontrak dicipta.", "Kontrak dikemas kini.", "Kontrak dipadam."; duplicate guard "Kontrak untuk subjek/kertas ini sudah wujud." Rules: one contract per subject x kertas (unique), identity fields immutable, sections wholesale replaced on save (`BlueprintController.php:117-172`).

**P5/A10 Set Builder**: create ("Cipta Set Baharu": title <=255, optional subject; creates a composite DRAFT with three empty Bahagian "Bahagian A/B/C", all `answer_all`; flash "Set komposit dicipta. Seret soalan ke dalam Bahagian untuk mula." `SBC:88-130`); **Jana set** (heading "Jana set" / "Ambil soalan secara rawak"; fields title, subject, count 1-100, "Tahun" ("— semua jika tiada pilihan") and board filters; live counter "`{n}` soalan tersedia" from `GET /pool`, hint "Pilih subjek untuk melihat bilangan soalan tersedia."; creates **one** Bahagian A with N questions; flash "`{n}` soalan dijana secara rawak. Semak sebelum menerbitkan."; shortfall error from `InsufficientPoolException` (`SBC:223-283`; `app/Services/Sets/RandomSetGenerator.php:44-73`)); builder (left "Bank Soalan" search with year/board filters, up to 150 rows, deduped by normalised stem, each showing marks, preview, "sumber", provenance, Bahagian select + "Tambah"; right Bahagian columns with drag/drop and per-Bahagian settings: label, rule, select count ("Pilih `{k}` daripada `{n}` soalan."), "Markah Bahagian" for document Bahagian; "Lampir Kertas 2" > "Pilih dokumen Kertas 2 diterbitkan" > "Lampir" / "Tanggalkan"; empty column hint "Seret soalan ke sini, atau gunakan butang 'Tambah' pada senarai bank."; "Kontrak Simulasi" readout of Bahagian A vs the subject's K1 contract; "Terbitkan" and "Terbitkan walaupun tidak memenuhi kontrak"; after publish, banner "Set ini diterbitkan, tetapi `{n}` soalan yang ditambah selepas itu belum dibekukan. Terbitkan semula untuk membekukannya.") Guards: either questions or a document per Bahagian ("Bahagian ini ialah dokumen Kertas; tanggalkan dokumen dahulu." / "Bahagian ini ada soalan; buang dulu sebelum lampir dokumen."); a question lives in at most one Bahagian of a set (move deletes the stray membership, `SBC:387-393`); regenerate refused when published: "Set ini sudah diterbitkan — nyahterbit dahulu sebelum menjana semula."; regenerate with only document Bahagian: "Tiada Bahagian soalan tersedia untuk dijana semula — semua Bahagian ialah dokumen Kertas."; attach limits: published document, same subject, Kertas 2 only ("Dokumen ini belum diterbitkan.", "Dokumen Kertas ini bukan untuk subjek set ini.", "Hanya Kertas 2 boleh dilampirkan sebagai Bahagian.").

**A5-A9 import and review copy**: DOCX ZIP success "Set '`{title}`' diimport sebagai DRAF — `{r}` soalan baharu, `{u}` dikemas kini, `{p}` dibuang. Semak dan terbitkan di Studio." (multi: "`{n}` set diimport sebagai DRAF — ..."); errors "Import gagal." / "Import gagal: `{msg}`" (`ImportUploadController.php:47-92`). BI upload errors "Import gagal: `{msg}` Pastikan fail ialah kertas BI Kertas 1 (Part 1–5)." and "Tiada soalan dikesan dalam fail — pastikan ia kertas BI Kertas 1 yang betul." (`BiComprehensionUploadController.php:53-60`). Native paper publish success "Kertas '`{title}`' telah DITERBITKAN — kini boleh diakses pelajar di Simulasi." (`PaperReviewController.php:135-137`). Import review confidence threshold `config('import.confidence.needs_review_threshold', 0.80)` (`ImportReviewController.php:72`).

**P8 Tanda Karangan**: queue = `part_responses` with `grading_status='graded'` and `graded_by IS NULL`; each row shows student name, question number, plain-text stem, marks, AI `proposed_marks`, rationale, per-point coverage, scheme points, the essay; admin enters integer marks 0-65535 (re-clamped to the part marks), flash "Markah karangan disahkan."; only this confirm writes `awarded_marks` (`EssayReviewController.php:15-72`). The batch that creates proposals is `exam:grade-essays`, feature-flagged (`essayGrading`) and not called from the submit path.

---

## 4. Flows

### 4.1 Student attempt lifecycle

```
S1 list -> S2 GET /simulasi/{paper}
   |-- no pinned attempt ------------> create attempt (served_composition snapshot) -> sit
   |-- pinned, >60 s, no ?sambung ---> S4 choice: Sambung (?sambung=1) | Mula Semula (POST cuba-lagi)
   '-- pinned, <=60 s or sambung ----> resume same attempt (timer from started_at, answers from server)
sit: type -> debounce 1 s -> PATCH jawapan (+ localStorage mirror, + beacon on hide/pagehide)
     Hantar (confirm) or timer 0 (auto, no confirm) -> POST hantar -> 302 S3
S3: read scheme, self-mark parts -> POST semak (score updates) -> Cuba Lagi -> new attempt -> S2
```

| Aspect | Rule | Evidence |
|---|---|---|
| Attempt creation | `exam_attempts` row: `user_id`, `exam_paper_id`, `mode='exam'`, `started_at`, `status=in_progress`, `served_composition` | `ESC:104-111` |
| Served composition | Snapshot `{sections:[{section_id, selection_rule, select_count, questions:[{id, position, marks}]}]}`. Used for the allowed part set (autosave/submit/self-mark), the score and the denominator, so later edits to a composite never change an attempt | `ESC:814-892`; `app/Support/ExamBestNScorer.php:25-35` |
| Timer | Duration from `exam_papers.duration_minutes`. `left = duration*60 - elapsed` where `elapsed` = server `now - started_at` at page render; client ticks every 1 s; warning once at <= 300 s; at <= 0 auto `submit(true)` (no confirm). Untimed: count-up. The server **accepts but records** late submits; it never rejects and never closes an overdue attempt | `ATT:78,409-422`; `ESC:371-374` |
| Autosave | One in-memory `answers` map (key per `data-ak`), localStorage mirror `exam-attempt-{id}`, debounce 1 s, `PATCH` with `{responses, flags, section_selections}`. Server restricts to parts of the served composition, groups flat keys into one structured response per part (`{part}`, `{part}-w`, `{part}-{i}`, `{part}-c{n}`, `{part}-g{n}`, `{part}-topic`) and **merges** fields (a partial payload never wipes other fields). Stores raw responses only: no marking, no leak. Labels: "menyimpan…", "disimpan", "gagal simpan", "luar talian". `sendBeacon` on `visibilitychange` (hidden) and `pagehide` | `ATT:236-407`; `ESC:231-348` |
| Server pre-fill | Reload (even on another device) re-renders saved answers server-side; server values override the localStorage mirror at init | `ESC:177-194`; `ATT:280-291` |
| Flags and picks | Flags and choose-N picks ride the same PATCH into `section_selections` JSON; both are advisory UI state and are **never read by scoring** | `ESC:262-273`; `ExamBestNScorer.php:10-18` |
| Choose-N | Client vetoes ticking more than `select_count` and dims the rest; student can still type in other questions; scoring takes the **best N attempted** | `ATT:482-541`; `ExamBestNScorer.php:138-152` |
| Submit | Double-submit guard (redirect to S3). Optional `responses` in the POST are autosaved first (the client does not send any, N-01). Objective parts graded now; subjective `mark_scheme_points` parts get a keyword suggestion stored as `awarded_marks` with `self_marked=true` only if it found > 0; `max_score` and `score` stored; status `submitted`; analytics aggregate written; session pin dropped | `ESC:375-443` |
| Review | `GET semakan`: owner only; an unsubmitted attempt redirects to S2 | `ESC:147-170` |
| Retry | `POST cuba-lagi` creates another `in_progress` attempt with a **new** snapshot and pins it; there is no limit or cooldown; the previous unsubmitted attempt is orphaned | `ESC:204-221` |

### 4.2 Admin authoring, import, review, publish

```
Source A: DOCX ZIP -> DocxSetImporter  ----\
Source B: BI Kertas 1 DOCX -> parser   -----+--> native DRAFT paper (is_composite=false)
Source C: staged OCR items -> accept ------/      -> /admin/studio/imports/paper/{id}/review  (or Panel P3)
                                                   edit text, sections, passages, panels; Salin untuk sunting
                                                   -> Terbitkan (SetPublishValidator + BlueprintConformance gate)
Source D: Studio bank (approved questions)
          -> Set Builder: Cipta Set / Jana set -> composite DRAFT -> add/reorder/remove/attach doc
                                                   -> Terbitkan (validators, snapshots, status flip)
Student sees only paper_statuses.is_servable = true (slug 'published').
```

Publish paths (three, all gated):

| Path | Entry | Gates, in order | Effect | Evidence |
|---|---|---|---|---|
| Native, Blade | A9 `studio.imports.paper.publish` | questions > 0; `SetPublishValidator`; `BlueprintConformance::gateFor` (override box); | `exam_papers.status=published` **and** all `exam_questions.status=approved` of the paper in one transaction; audit `studio.paper.published` (+ `studio.paper.published_override`) | `PaperReviewController.php:50-138` |
| Native, Panel | P3 `panel.spm.simulasi.publish` | identical (a deliberate mirror) | identical | `SPC:630-696` |
| Composite | `admin.studio.sets.publish` / `panel.studio.sets.publish` | `SetPublishValidator`, then blueprint gate (override via `override_blueprint=true`, 422 JSON with `errors`, `blueprint_block`) | `SetPublisher`: each membership pinned to a `question_snapshots` row (content + sha1 hash), paper status published; audit `studio.set.published` (+ `..._override`) | `SBC:624-677`; `SetPublisher.php:24-54` |

Unpublish (native only): paper > draft **and** its questions > draft; audit `studio.paper.unpublished` (`SPC:698-729`). There is no unpublish route for a composite set.

Edit rules (D-07 "never mutate a live surface"): metadata cover fields, Bahagian text, passages, reference panels and added questions are refused on a servable paper; the only door is **Salin untuk sunting**, a deep clone (`StudioQuestionAuthoring::clonePaperToDraft`), audited `studio.paper.duplicated`.

### 4.3 Blueprint (Kontrak) flow

1. Admin creates a contract per subject x kertas (P4) with sections (label, instruction, rule, count, mark budget, expected answer modes), `source` Draf / Spec / Disahkan.
2. At publish, `BlueprintConformance::gateFor` resolves the contract: a native paper uses its own subject x kertas contract; a **composite** (no `kertas`) is compared **only against the subject's Kertas 1 contract**; no contract or no subject = no gate (`BlueprintConformance.php:79-99`).
3. Sections pair by normalised label first, then by rank only if the candidate has no conflicting label (`:336-360`). Nulls mean "unknown" and never fail (`:13-23`).
4. **Hard gaps** (block publish unless overridden): contract Bahagian missing; selection rule differs; `select_count` differs under the same rule. **Soft gaps** (informational): marks budget, unexpected answer modes, section count, extra Bahagian. Document Bahagian skip rule/mode checks and use the document's `marks_total` (`:140-309`).
5. Override requires the admin to tick the box after a block, and writes an audit entry listing the gaps. There is no reason field.

The contract is a **validator only**. It does not drive generation (N-11).

### 4.4 Set Builder and random generation

| Step | Rule | Evidence |
|---|---|---|
| Pool | `PickableQuestionPool::base(subject)` joins keyed, servable questions (including paperless extraction corpus); filters by year and board; **deduped by normalised stem** in PHP | `app/Services/Sets/RandomSetGenerator.php:84-111`; `SBC:140-189` |
| Draw | `count` 1-100 from a shuffled pool; refuses to under-fill (`InsufficientPoolException` with real numbers); non-reproducible unless a test seed; stable order input | `RandomSetGenerator.php:44-73` |
| Result | One `Bahagian A`, `answer_all`, memberships `number_label` "1".."N" | `SBC:256-266,341-351` |
| Blueprint | **Ignored** by generation | N-11 |

### 4.5 Analytics bridge, rewards and history

On submit and on every self-mark, `ESC::syncAnalytics` writes or updates **one** aggregate `practice_sessions` row with `client_uuid='exam-attempt-{id}'` (idempotent), because all reports, Prestasi and syiling read that ledger (`ESC:471-553`).

| Paper kind | Mode written | `total` / `correct` | Evidence |
|---|---|---|---|
| Tracking A composite (`import_issues.auto='tracking-a'`) | `spm_ramalan`, paper1 | **Counts** of objective parts | `ESC:457-461,504-519` |
| Native paper (`is_composite=false`) | `spm_tahun_lepas`, paper1 if `kertas='1'` else paper2 | **Marks**: `maxScore` / `recomputeScore` | `ESC:464-466,520-526` |
| Any other composite (Set Builder, "Jana set") | **not bridged** (null) | none | `ESC:468` |

Rewards: `PracticeRecorder::SYILING_PER_CORRECT = 2` and `XP_PER_CORRECT = 10` per correct unit (so per **mark** for native papers); later self-marks add only a positive delta, never claw back (`app/Support/PracticeRecorder.php:27-31,77-98`).

---

## 5. Grading, scoring and rendering rules

### 5.1 Grading (server trust model)

| Rule | Detail | Evidence |
|---|---|---|
| Trust boundary | Correctness is read only from `part_answer_keys` / `part_options.is_correct`; a request claiming correctness is ignored; an option id not belonging to the part is rejected | `app/Support/ExamGrader.php:3-22,81-88` |
| Objective kinds | `single_key`, `accepted_values`, `mapping`. Dichotomous: full part marks or 0, no partial credit | `ExamGrader.php:25,55-60` |
| `single_key` | Student value (option id) must equal `content.option_id` and belong to the part | `:74-88` |
| `accepted_values` | Numeric compare within `content.tolerance` (default 0) only when **both** sides are `is_numeric`; else case/whitespace-insensitive string equality | `:91-117` |
| `mapping` | Exact match: ordered list for sequence, key-matched map for gaps; compared as strings | `:125-154` |
| Subjective kinds | `mark_scheme_points`, `band_rubric`, `model_answer` are never auto-graded; calling the grader on them is a programming error | `:19-21,42-44` |
| Keyword suggestion | `RubricKeywordMarker`: tokens lower-cased, stop-words removed, point matches if **any** token of length >= 5 appears in the answer; numeric/short points need **all** digit tokens; marks = sum of matched points' marks, else proportional; clamped 0..max. Reads `working` + `value` text | `app/Support/RubricKeywordMarker.php:21-146`; `ESC:355-365` |
| Self-mark | Per part `0..part.marks`, integer, server-clamped, no lock; sets `self_marked=true`, `marked_by`; recomputes score; syncs analytics | `ESC:564-603` |
| Document Bahagian | One self-mark `0..mark_budget` in `exam_attempts.section_scores[section_id]`, folded into the total only if the section is still a document section | `ESC:613-654,679-690` |
| AI essay marks | Proposal in `part_responses.ai_grade`, counted only after a staff confirm (`graded_by='teacher'`); not wired into submit | `app/Http/Controllers/Panel/EssayReviewController.php:15-24`; migration `2026_08_18_000100_add_ai_grading_to_part_responses.php` |

### 5.2 Scoring and denominators

| Rule | Detail | Evidence |
|---|---|---|
| Score | `ExamBestNScorer::scoreAttempt` + sum of document-section self-marks | `ESC:679-690` |
| Best-N | For a `choose_n` Bahagian: rank the **attempted** questions by awarded marks (tie: lower recorded position), take `select_count`; `answer_all` sums everything. Reads the served composition if present, else live | `ExamBestNScorer.php:39-152` |
| Unmarked | A part with no mark counts 0 until marked | `ExamBestNScorer.php:81` |
| Denominator | Sum of recorded per-question marks in the snapshot, with the same choose-N reduction (best `select_count` question marks), plus document `mark_budget`. Fallback for legacy attempts without a snapshot: `effectiveMarksTotal()` | `ESC:716-764` |
| Marks derivation | No stored marks columns above the part: `question_parts.marks` is the only physical leaf; question, section and paper totals are accessors; a parent's own marks are ignored when it has children; composite marks may come from `marks_override` | `app/Models/ExamQuestion.php:86-90`; `PaperSection.php:214-248`; migration `..000040`; `PublishValidator.php:52-80` |
| Status | `attempt_statuses`: `in_progress`, `submitted`, `marked`. `marked` is **never set** | `ExamVocabSeeder.php:26`; `ESC:428` (grep shows only the other two) |

### 5.3 Rendering and pagination rules

| Rule | Detail | Evidence |
|---|---|---|
| Sheet packing (client) | One screen = one printed page. Document Bahagian = its own sheet. A shared-passage block = one sheet and joins its empty Bahagian header sheet. A question with a `.stim`/figure/img/table counts weight 2, else 1; a sheet holds weight <= 4. A new Bahagian always starts a new sheet. Trailing empty header sheets are pruned. Answers live in a JS map, so hiding a sheet never drops an answer | `ATT:571-652` |
| Shared stimulus pinning | `PaperSection::sharedStimulus()`: pinned only when **exactly one** stimulus is common to **all** questions in the Bahagian (>= 2 questions). Sub-ranges (Q5-8 of 40) are never pinned (see the question-bank findings, section A) | `app/Models/PaperSection.php:187-207` |
| Echo suppression | A single part whose prompt repeats the stem is blanked; a single-question Bahagian drops an instruction that echoes the stem | `question.blade.php:16-22`; `PaperViewBuilder.php:61-68` |
| Marks badge | Every question and part shows `[n markah]`, including all-MCQ papers (operator decision 2026-08-14) | `ATT:13-17` |
| Math | MathML baked at save time (`InlineMathBaker`), raw-echoed on student pages; no client math library; a test asserts no dollar character in served HTML | `ATT:676-680`; `components/scheme.blade.php:11-16` |
| Escape rules | Authored content raw-echoed (`{!! !!}`); student input always escaped | per-view comments |
| Theme | Attempt forces light theme (printed-paper look); `exam-sim.css` has its own dark variables unused by the forced theme | `ATT:21-27`; `resources/css/exam-sim.css:16-58` |
| Breakpoints | `.sheetfoot` wraps at <= 520 px; `.instr` single column at <= 620 px; shared passage becomes a sticky header (max 42vh) at <= 820 px; rail changes at <= 900 px; sheet max width 1120 px | `exam-sim.css:100,151,259,391-412` |

---

## 6. Admin rules in detail

### 6.1 Question-level `PublishValidator` (blocking; reused per question)

| Rule key | Condition | Message (BM) | Evidence |
|---|---|---|---|
| `no_parts` | Question has no parts | "Soalan tiada sub-bahagian — tiada apa untuk dijawab." | `PublishValidator.php:43-45` |
| `marks_sum` | Parent's own marks nonzero and not equal to children's sum | "Bahagian (`{l}`) ditetapkan `{n}` markah tetapi sub-bahagiannya berjumlah `{m}` — markah induk akan diabaikan. Tetapkan 0 pada induk." | `:67-80` |
| `marks_sum` (leaf) | Leaf marks < 1 | "Bahagian (`{l}`) tiada markah — setiap sub-bahagian yang dijawab mesti bernilai sekurang-kurangnya 1 markah." | `:88-94` |
| `mcq_invalid` | < 2 options; not exactly 1 correct; key points to a foreign option | "Bahagian (`{l}`) ialah aneka pilihan tetapi mempunyai kurang daripada 2 pilihan." / "Bahagian (`{l}`) mempunyai `{n}` pilihan betul — mesti tepat 1." / "Bahagian (`{l}`): skema menunjuk pilihan yang bukan milik bahagian ini." | `:134-165` |
| `missing_answer_key` | A non-MCQ leaf has no key row; MCQ with a correct option but no `single_key` | "Bahagian (`{l}`) tiada skema jawapan." / "... (single_key)." | `:118-125,159-162` |
| `incomplete_key` | Key content empty for `accepted_values`, `mapping`, `mark_scheme_points`, `band_rubric`, `model_answer`; mapping covers fewer entries than `config.gaps` | "Bahagian (`{l}`): skema `{kind}` kosong." / "Bahagian (`{l}`): skema padanan hanya meliputi `{a}` daripada `{b}` tempat kosong." | `:186-225` |
| `table_no_blank` | `table_fill` grid has no `_` cell | "Bahagian (`{l}`): jadual tiada tempat kosong (`_`) — pelajar tiada ruang untuk menjawab." | `:111-116` |
| `image_unresolved` | Stimulus asset file missing on disk | "Imej rangsangan tidak dijumpai: `{path}`" | `:239-250` |
| `stimulus_empty` | Stimulus with no asset and no body | "Rangsangan tiada kandungan (bukan imej, bukan teks) — mungkin hilang semasa suntingan." | `:256-261` |

Not validated: `sequence_order`, `graph_plot`, `draw_on_diagram`, `code` and `essay` leaves only need **any** key row (and `model_answer`-type content), so an answer mode with no working student widget (N-02) passes the gate.

### 6.2 Paper-level `SetPublishValidator` (blocking; native and composite)

| Rule | Message (BM) | Evidence |
|---|---|---|
| Document Bahagian must have a published document with >= 1 page | "`{label}`: dokumen Kertas tiada halaman / belum diterbitkan." | `SetPublishValidator.php:47-55` |
| Each question passes 6.1 | "Soalan `{n}`: `{message}`" | `:63-74` |
| choose_n count <= available | "`{label}`: pilih `{k}` tetapi hanya `{n}` soalan tersedia." | `:78-80` |
| Bahagian with questions but total 0 | "`{label}`: jumlah markah 0 walaupun ada soalan." | `:86-88` |
| Single subject | "`{label}`: soalan `{n}` bukan subjek set ini." | `:93-101` |
| Empty paper | "Kertas tiada soalan — tidak boleh diterbitkan." | `:104-106` |

Does **not** check: question status (`draft` question inside a published composite is still shown), difficulty, topic tags, duplicate questions across sets, stimulus-group integrity, or duration being set.

### 6.3 Audit actions written

`studio.set.created`, `studio.set.generated`, `studio.set.published`, `studio.set.published_override`, `studio.paper.published`, `studio.paper.published_override`, `studio.paper.unpublished`, `studio.paper.duplicated`, `studio.paper.reference_assets_updated`, `studio.section.updated`, `studio.stimulus.updated`, `simulasi.question.added`, `simulasi.question.deleted`, `studio.import.docx_upload`, `studio.import_item.rejected`. No audit on blueprint create/update/delete, on regenerate, or on Set Builder add/remove/reorder.

---

## 7. Data model (ER summary)

```
subjects 1--* exam_papers 1--* paper_sections 1--* exam_questions 1--* question_parts (self FK parent_part_id)
                  |                 |                    |  *--* stimuli (question_stimulus.position)      | 1--* part_options
                  |                 |                    |                                                 | 1--* part_answer_keys (kind, content JSON, marks)
                  |                 |                    '--(composite only) exam_paper_questions: section x question, sort_order,
                  |                 |                        number_label, marks_override, pinned_snapshot_id -> question_snapshots
                  |                 '--paper_document_id -> paper_documents 1--* paper_document_pages (kind paper|scheme)   [document Bahagian]
                  '--(none)  paper_blueprints (subject x kertas, unique) 1--* blueprint_sections   [validation contract, no FK to a paper]
users 1--* exam_attempts (paper, mode, started/submitted, score, max_score, status, section_selections, served_composition, section_scores)
            1--* part_responses (attempt, part, response JSON, is_correct, awarded_marks, self_marked, marked_by, feedback,
                                 graded_by, grading_status, ai_grade)
exam_attempts ..> practice_sessions (client_uuid 'exam-attempt-{id}')  [analytics bridge, aggregate only]
```

| Table | Key columns and rules | Evidence |
|---|---|---|
| `exam_papers` | `title`, `subject_id`, `kertas` (string), `is_composite`, `duration_minutes`, `instructions` JSON (two shapes), `reference_assets` JSON, `cover_code`, `import_issues` JSON (also holds `auto`, `set`), `status_id`, `created_by`. No stored marks | migrations `2026_07_16_000030`, `2026_09_11_000001`, `2026_07_18_100010` |
| `paper_sections` | `exam_paper_id`, `position`, `label`, `instruction_text`, `selection_rule_id` (`answer_all`/`choose_n`), `select_count`, `paper_document_id` (nullable), `mark_budget` | `..000031`, `2026_08_11_000002/3` |
| `exam_questions` | `exam_paper_id` (**nullable** since composites), `paper_section_id`, `position`, `number_label`, `stem` JSON `{html}`, `chapter_id`, `topic` (free text), `difficulty` (free string), `status_id`, `source_paper_id` | `..000032`, `2026_07_17_000011/101` |
| `question_parts` | `parent_part_id` (any depth), `position`, `label`, `prompt` JSON, `answer_mode_id` (14), `marks`, `word_limit`, `config` JSON (rows, head, gaps, topics, range, unit, lang, axes, base_html), `stimulus_id` (part-level stimulus) | `..000040` |
| `part_options` | `label`, `body` JSON `{html, image_html}`, `is_correct`, `is_distractor`, `position` | `..000041` |
| `part_answer_keys` | `answer_key_kind_id` (6 kinds), `content` JSON, `marks`. Grader and renderer use only the **first** key of a part | `..000042`; `ExamGrader.php:39`; `scheme.blade.php:20` |
| `stimuli` | `stimulus_kind_id` (15), `body` JSON (`html`/`mathml`/`code`/`items`/`rows`/`svg`), `asset_id`, `caption`, `source_citation`, `meta` (e.g. `max_plays`), `editor_json` | `..000021`; `2026_07_18_000001` |
| `exam_attempts` / `part_responses` | as in the diagram; unique key is not declared on (`exam_attempt_id`, `question_part_id`) | `..000043`, `..000044` |
| `paper_blueprints` | `subject_id`, `kertas`, `paper_code`, `duration_minutes`, `total_marks`, `auto_markable`, `source` (comment says `derived\|spec\|confirmed`), `notes`; unique (`subject_id`,`kertas`) | `2026_08_11_000001` |
| `blueprint_sections` | `position`, `label`, `instruction`, `selection_rule_id`, `select_count`, `mark_budget`, `expected_answer_modes` JSON | same |
| `paper_documents` / pages | Kertas 2/3/4 page-image papers, `published_at`, `marks_total`, `page_count` | `2026_07_31_000003` |
| `structured_attempts` (+ `_answers`, `structured_rubric_points`) | **Not Bijak SPM.** Belong to the "Soalan Berstruktur"/Subjektif lane: `structured_question_id`, `score`, `max_score`, `track`, per-sub-question `answer`/`awarded`. Listed because the brief names it | `2026_07_31_000002` |

Vocabulary (fixed ids, `ExamVocabSeeder.php:15-26`): answer modes 1 `mcq`, 2 `short_text`, 3 `numeric`, 4 `numbered_list`, 5 `extended_essay`, 6 `essay_choice`, 7 `working_shown`, 8 `graph_plot`, 9 `draw_on_diagram`, 10 `table_fill`, 11 `sequence_order`, 12 `code`, 13 `gapped_text_match`, 14 `cloze`; key kinds `single_key`, `accepted_values`, `mark_scheme_points`, `band_rubric`, `model_answer`, `mapping`; stimulus kinds `passage`, `box`, `table`, `diagram`, `graph`, `image`, `infographic`, `code`, `pseudocode`, `sql`, `math`, `audio`, `video`, `map`, `cartoon`; selection rules `answer_all`, `choose_n`; question statuses `draft`, `reviewed`, `approved*`, `archived`; paper statuses `draft`, `in_review`, `published*`, `archived` (* servable); attempt statuses `in_progress`, `submitted`, `marked`.

Seeded contracts (`database/seeders/BlueprintSeeder.php`): e.g. Kertas 1 objektif 40 marks one Bahagian (`source='derived'`, `:92`), several `spec` rows with null durations and marks. The research doc states 0 of 116 papers had a duration and that Science K1 holds 40 not 50 (`docs/SPM-SIMULASI-BLUEPRINT.md:25-60,111-119`).

---

## 8. Known defects

### 8.1 Already recorded

See [../requirements/v2-question-bank-oldsystem-findings.md](../requirements/v2-question-bank-oldsystem-findings.md): A (stimulus groups: no group entity, sub-range never pinned, DOCX duplicates passages, assembly splits groups), B (no maths input, no photo, working/final split worth keeping), C (mark schemes free text, no K/N/P/ECF), D (matching: numeric-only compare, keyword marker over/under-awards). These apply directly to Bijak SPM.

### 8.2 New findings from this discovery

| ID | Severity | Finding | Evidence |
|---|---|---|---|
| N-01 | High | **Submit races the last autosave.** `submit()` builds a form containing only `_token`, calls `flush(false)` (async `fetch` PATCH) then `form.submit()` immediately. The comment says "Post the answers WITH the submit" but no `responses` field is added, and the server only merges `responses` when present. Answers typed in the last second (and on timer auto-submit) can be graded without them | `ATT:431-445`; `ESC:384-387` |
| N-02 | High | **`sequence_order` is unanswerable.** Markup is `draggable` rows with `data-seq`, but no drag handler exists anywhere (only the Blade file mentions `data-seq`/`draggable`); `data-ak` is on a `div` so no input event fires. The publish gate does not detect it. Authoring allows it | `sequence-order.blade.php:10-19`; grep of `resources/` for `dragstart` returns nothing; `SoalanTambahan.php:45` excludes it from "add" |
| N-03 | Low | S1 subheading "tanda automatik setiap halaman" is false: per-page marking was removed on purpose | `index.blade.php:5` vs `W:1136-1138` |
| N-04 | Low | Four names for one feature (section 1.1) and S5/S6 titles differ; flash text says "di Simulasi" | see 1.1; `PaperReviewController.php:137` |
| N-05 | Medium | **Paper kuiz (S6) discards written answers.** Textarea is bound to a local `written` object that is never sent, stored or marked; score counts MCQ only; S5/S6 write no attempt, no history, no syiling | `quiz-paper.blade.php:189-191,211-262`; `EQC` |
| N-06 | High (security) | **`/simulasi/kuiz/semak` is an answer oracle.** Any logged-in user may POST any `part_id` + one of its option ids and receive `correct_option_id`. It checks neither that the part belongs to a servable/published question, nor the role, nor a rate limit. Part ids are sequential, so unpublished questions' keys can be enumerated | `EQC:124-149`; `W:1447` (`auth` group only) |
| N-07 | Medium | **Non-students can start attempts.** The read routes are `auth` only, so a guru or admin opening `/simulasi/{paper}` creates an `exam_attempts` row, then every write (`jawapan`, `hantar`, `semak`) is 403 (`role:pelajar`). Admin "preview" therefore leaves junk attempts and a paper that cannot be completed | `ESC:103-112`; `W:1111,1437` |
| N-08 | Medium | **Abandoned attempts never close.** Retry and re-open create new `in_progress` rows; nothing expires an overdue attempt; the `marked` status exists but is never set | `ESC:204-221`; `ExamVocabSeeder.php:26` |
| N-09 | Medium | **Autosave is not offline-tolerant.** A failed PATCH only sets the label "gagal simpan" / "luar talian"; there is no retry, no `online` listener, no queue. localStorage is a write-only mirror except at init. Only the next keystroke, a flag/pick toggle, tab hide or `pagehide` triggers another send | `ATT:387-407,271-277` |
| N-10 | Medium | **History blind spots.** Only native papers and Tracking A composites are bridged; admin-built composites ("Jana set", Set Builder) give no history, no syiling, no teacher analytics. Native runs are labelled "Tahun Lepas" in `/spm/history`. Tracking A bridge uses question counts while native uses marks (mixed units in one ledger) | `ESC:457-469,520-526`; `StudentController.php:1007-1013` |
| N-11 | High (v2 relevant) | **Blueprint does not generate.** "Jana set" draws N flat questions into one `Bahagian A` from keyed MCQs only, ignoring sections, marks, selection rules and the contract; random draws can split stimulus groups (finding A3). Generated papers therefore fail the K1 contract only if they have a wrong Bahagian count, and cannot represent Kertas 2 | `SBC:256-266`; `RandomSetGenerator.php:84-111` |
| N-12 | Medium | **Document Bahagian scheme is revealable before submit** (self-toggle), unlike every other part, and its self-mark stepper is available at any time. A student can see the scheme mid-paper, contradicting the no-reveal rule | `bahagian-dokumen.blade.php:12-17,65-76` |
| N-13 | Medium | **Published composite can still be edited live.** Set Builder add/remove/reorder have no status guard; a removed membership disappears from what new students see (attempts are protected by `served_composition`). The UI only warns about unpinned additions | `SBC:370-478`; blade `set-builder.blade.php:328-332` |
| N-14 | Low | Semakan prints `mapping` keys as raw JSON ("Padanan betul: {...}") and `accepted_values` HTML-unescaped list; cover grid "Untuk Kegunaan Pemeriksa" is a print relic that is never filled | `scheme.blade.php:72-74`; `cover.blade.php:46-83` |
| N-15 | Medium | **Contract editor inconsistencies.** Seeder writes `source='derived'` (and the migration comment lists `derived\|spec\|confirmed`) but the editor and validator allow only `draft,spec,confirmed`, so a derived contract has no label in the UI and cannot be re-saved without changing its source. Answer-mode checkboxes show raw English slugs. Blueprint `position` is 1-based in the seeder but written 0-based on save. No audit on blueprint changes | `BlueprintSeeder.php:92`; migration `2026_08_11_000001:31`; `BlueprintController.php:90,126,155-157`; `kontrak.tsx:96-100,171-173` |
| N-16 | Low | S4 elapsed time uses `gmdate('i:s')` and wraps at 60 minutes (a 2.5 h paper shows 30:00 after 90 minutes) | `resume.blade.php:25` |
| N-17 | Medium | **No server-side deadline.** The server never auto-closes or rejects; a student who closes the tab after the deadline keeps an `in_progress` attempt that can be resumed ("Sambung") indefinitely, with the timer already at zero | `ESC:371-374`; `ATT:241` |
| N-18 | Low | `import_issues` JSON doubles as paper metadata (`set`, `auto`), and the "Tracking A" badge shows for every composite | `ESC:459`; `index.blade.php:24,34-36` |
| N-19 | Medium | **Admin split across surfaces.** Create set, Jana set, DOCX/BI upload and import review exist only in Blade; Panel has no entry for them. Blade Studio GETs are open to school and district staff although content is national | `W:612,618,654-659` vs `W:341-375`; `W:533` |
| N-20 | Low | Native publish flips every question of the paper to `approved` and does not pin snapshots; "approved" is therefore a side effect of publishing the paper, not a review decision | `PaperReviewController.php:103-111`; `SPC:661-669` |
| N-21 | Medium | Draw/graph/code answers are never marked and have no key requirement beyond "any key row"; they are self-marked only. `audio.max_plays` and `video` placeholder are the only media rules | `exam/widgets/*.php`; `PublishValidator.php:118-125` |

---

## 9. Differences from the old .my "SPM Mock" (M06 discovery)

Reference: [M06-spm.md](M06-spm.md) (S11 `/spm-mock`, S12 `/spm-mock/{id}/result`). The .cloud server also ships a re-implementation of `/spm-mock` (`SpmPracticeController`).

| Topic | .my SPM Mock (M06) | .cloud SPM Mock routes | .cloud Bijak SPM (`/simulasi`) |
|---|---|---|---|
| Start | Form "Subjek" (10 fixed subjects) + "Paper" ("Paper 1 (Objektif)" / "Paper 2 (Esei/Struktur)") + "🎯 Jana Mock SPM" (M06-spm.md §2.11) | Same form; Paper 1 = random MCQs (count 5/10/20/40), Paper 2 = random structured set (3/5/10) (`SpmPracticeController.php:239-277,306-351`) | No generation. Student picks a curated, published paper from a subject-grouped list |
| Source of questions | Unknown (AI or bank, open question L-8) | Legacy `questions` (MCQ) and `structured_questions` | Canonical exam tree, real paper structure |
| Structure | One flat list; no Bahagian | Flat | Cover, instructions, Bahagian, parts, choose-N, reference panels, document Bahagian |
| Timer | "timer", "tidak boleh stop" (inferred) | Client count-up only | Per-paper duration, countdown, T-5 warning, auto-submit; untimed = count-up |
| Persistence | "Belum submit" + "Sambung →" (resume) | None during the sitting; result POSTed once | Server attempt, 1 s autosave, resume choice, snapshot composition |
| Marking trust | Server | **Client posts `is_correct` per answer and the server records it** (`validateRun`, `SpmPracticeController.php:436-447`); Paper 1 payload ships `correct` with every option (`:264`) | Server-side only; keys never reach the page (exam mode); S5/S6 grade by server call |
| Subjective marking | "Paper 2" review with feedback | `StructuredMarker` rule-based auto-mark (`:364-428`) | Self-mark with keyword suggestion; AI proposal queue (not wired) |
| Result | Hero with grade (A+ to G), %, "x / y markah", weak topics, per-question review, "📝 Mock Lain", "📚 Belajar Topik Lemah" | Result stored as `practice_sessions` mode `spm_mock` | Semakan with score `s / m`, scheme and per-part verdicts; **no grade, no weak topics, no "Mock Lain"** |
| History | "Mock Sebelum Ini" list on `/spm-mock` | Last 10 sessions (`SpmPracticeController.php:177-205`) | None on `/simulasi`; only `/spm/history` aggregate, and a "Lihat semakan lepas" link to the latest attempt on the cover |
| Limits | "Boleh attempt setiap bulan" (copy) | No limit | No limit |
| Known .my defects (M06-spm.md §5) | S11 select truncation at 375 px; result "0 / 30 markah" vs 27 reviewed items | n/a | n/a |

What is **missing** in Bijak SPM relative to the Mock (needed for the D32 merge): on-demand generation by subject and paper; a grade and weak-topic analysis on the result; a "previous sittings" list; a "do another" action.

What is **missing** in the Mock relative to Bijak SPM: structure, durable attempts, autosave, sections, stimulus pinning, scheme reveal, self-mark, server trust.

---

## 10. Things not observed (UNVERIFIED, not guessed)

- Production data volumes, number of servable papers, share with durations: only the research document's 2026-08-11 numbers exist (`docs/SPM-SIMULASI-BLUEPRINT.md:25-60`).
- Live visual rendering of the paper skin, dark mode, and real timings.
- The content of `exam-sim/layout.blade.php` beyond its use by S4, `question_snapshots`/`QuestionLifecycle` internals, `StaffScope` rules, and `DocxSetImporter` parsing details (read only through their callers).
- Whether `exam:grade-essays` is scheduled on production.
