# prestasiplus.cloud: how question content is managed (admin) and displayed (student mode)

Status: discovery baseline for TRACKER D79 / D79d (v2 Portal Pentadbiran absorbs admin.prestasiplus.cloud and follows .cloud mechanisms and admin UX exactly). No recommendations for v2 here.

Source: `D:\Dev Projects\prestasiplus-reference\backend` (Laravel 13, byte-identical to production as verified 2026-10-30). Paths below are relative to `backend/`. Route names/URIs come from the production `routes.json` (910 routes). Production facts (flags, counts) are the read-only DB aggregates supplied for 2026-10-30. Anything not confirmable from code or those facts is marked **unverified**. No real person names are used (roles only).

Earlier inventory reused and extended: `scratchpad/oldsys-cloud/inventory.md`.

Conventions
- "Main site" = Blade/Alpine `/admin/*` (+ Filament `/admin-filament/*`, teacher `/guru/*`) on prestasiplus.cloud.
- "Panel" = React/Inertia app on admin.prestasiplus.cloud (route names `panel.*`).
- Canonical bank = `exam_papers > paper_sections > exam_questions > question_parts (+part_options, part_answer_keys) + stimuli`. Legacy bank = `questions (+question_options)`, `structured_questions (+structured_sub_questions, structured_rubric_points)`, `pksk_questions`, `audio_kbat`.
- Student UI chrome: layout `pelajar.layout` (sidebar + top bar), Alpine + Tailwind CDN.

---------------------------------------------------------------------------------------------------

## 0. The single mechanism

### 0.1 The pipeline in plain terms

1. An admin (role `admin`; the other staff roles `admin_sekolah`, `pegawai_ppd` can only browse, see 0.5) puts content into a bank. Entry doors: the Studio wizard (one question), DOCX ZIP upload, BI Kertas 1 DOCX upload, OCR/extractor CLI + import review, Set Builder / Jana Kertas (assemble from existing questions), Tracking A set editor, Kertas Subjektif page-image import (CLI), legacy Filament form/CSV (legacy bank only), teacher doors (legacy bank only, see section 14).
2. Everything enters as **draft** (canonical) or **draf/menunggu** (legacy). Nothing enters servable. The only exception is a teacher's own "Soalan Guru (rujukan)" insert, which is written straight as `diluluskan` (TeacherController.php:1692-1730).
3. An admin flips a **gate**. There are exactly four gates, one per content shape:
   - Question gate (canonical): `exam_questions.status_id -> approved` (Studio `Terbitkan`, runs `PublishValidator`). Servable flag lives on the status row: `question_statuses.is_servable` true only for `approved` (ExamVocabSeeder.php:24).
   - Paper gate (canonical): `exam_papers.status_id -> published` (`paper_statuses.is_servable` true only for `published`, ExamVocabSeeder.php:25). Publishing a native paper also bulk-sets its own questions to `approved` (PaperReviewController::publish; Panel SimulasiPaperController::publish :630-696). Publishing a composite (Set Builder) pins snapshots instead (SetPublisher).
   - Legacy question gate: `questions.status = 'diluluskan'` (Luluskan per row / per filter, QuestionController.php:126-193).
   - Page-image paper gate: `paper_documents.published_at IS NOT NULL` (PaperDocument::scopePublished).
   - Teacher set gate: `question_sets.status = 'diterbitkan'`.
4. A student activity reads only through a whitelist (never a blacklist, with documented exceptions in 0.4). The canonical paper path is gated at the controller (`ExamPaper::servable()`), never inside a Blade component (ExamSimulationController.php:19-27).
5. The student answers; objective parts are auto-marked on the server, subjective parts are keyword-suggested and then self-marked after Hantar; legacy MCQ drills are marked in the browser (the correct flag is shipped in the page) and the result is POSTed to `PracticeRecorder`.
6. Analytics bridge: every canonical sitting writes one aggregate `practice_sessions` row (`recordAggregate`), because `question_attempts.question_id` has a real FK to the legacy `questions` table (ExamSimulationController::syncAnalytics :495-553).

### 0.2 Two banks that coexist

| | Legacy bank | Canonical bank |
|---|---|---|
| Tables | `questions`, `question_options`, `structured_*`, `pksk_questions`, `spm_sets`, `question_sets` | `exam_*`, `paper_sections`, `question_parts`, `part_options`, `part_answer_keys`, `stimuli`, `paper_blueprints` |
| Status vocabulary | `draf, menunggu, diluluskan, ditolak, diarkib` (QuestionForm.php:95-103) | `draft, reviewed, approved, archived` (question); `draft, in_review, published, archived` (paper) |
| Servable | `diluluskan` only (whitelist) | `approved` (question) / `published` (paper) |
| Production volume | mcq diluluskan 408,197; mcq diarkib 41,150; mcq draf 155; subjective diarkib 2,015; structured 4,061 diluluskan; spm_sets 60 (1,737 links) | 5,371 questions (667 approved, 5,037 draft... see 0.6 note); 5,860 parts; 1,611 stimuli; 69 published papers; 81 source_papers |
| Read by | Latih Tubi (default), Databank SPM, SPM Mock K1, Soalan Aku Salah, Set Soalan Guru, Peta Belajar link, games, Battle, Tracking A legacy sets | Simulasi Peperiksaan / Bijak SPM, Simulasi Kuiz, paper quiz view, Tracking A canonical composites, Subjektif SPM when flag on |

Bridge between them:
- `php artisan exam:unify {--source=mcq|structured|sets|all} {--dry-run} {--tracking-a}` (app/Console/Commands/UnifyExamTree.php) projects legacy rows into the canonical tree, idempotent, quarantining rather than dropping. Order is mcq, structured, sets. `--tracking-a` scopes to the `kind='ramalan'` corpus only. Projectors: `app/Services/Unify/{McqProjector,StructuredProjector,SpmSetProjector}`.
- `legacy_canonical_map` (columns used: `source`, `legacy_id`, `canonical_id`) records the id translation. QuizController reads it to (a) restrict the canonical Latih Tubi pool to mapped questions and (b) translate canonical ids back to legacy ids on write (QuizController::quizCanonical, ::result).
- `StatusBridge` (app/Services/Unify/StatusBridge.php) maps legacy status to canonical: `draf->draft`, `menunggu->reviewed`, `diluluskan->approved`, `ditolak->archived`, `diarkib->archived`.
- Feature flag `latih-tubi-canonical` (LatihTubiCanonicalFlag, `feature_flags` row; unset = OFF) switches **only** QuizController (Latih Tubi, `/latih-tubi/{code}/kuiz`) from the legacy `questions` table to the canonical bank. Per-subject flags `tracking-a-canonical-{code}` (TrackingACanonicalFlag) switch the Tracking A subject card from `/spm/ramalan/{code}` to `/spm/tracking-a/{code}`. Per-subject `subjektif-canonical-{code}` (SubjektifCanonicalFlag) makes `/spm/subjektif` link into `/simulasi/{paper}` instead of `/latihan-berstruktur`.
- Flag `legacy-retirement` (LegacyRetirementFlag, audience admin, unset = OFF): when ON, `LegacyRetirementFlag::guard()` aborts 403 with "Bank soalan lama kini baca sahaja — gunakan Studio." for legacy writers (Filament QuestionImport :72, teacher CSV import/Sumbang/Soalan Guru TeacherController.php:907,1052,1690, TrackingASetEditor :170, StructuredRubricEditor :94) and hides the Filament SpmSet/StructuredQuestion create/edit (`canCreate`/`canEdit` return false).
- None of these four canonical/retirement flags has an admin toggle UI. `FeatureTogglesController::toggle` aborts 404 for any slug not in `config/features.php`, and `config/features.php` contains neither `latih-tubi`, `kertas-subjektif`, nor any canonical flag (keys: permainan, misi-harian, kombo, leaderboard, remedial, cita-cita, universiti, biasiswa, target-spm, analisa-item, prestasi, psikometrik, profil-cerah, kemajuan, sejarah, video, perutusan, panduan, tiket, guru-*). The canonical `setEnabled()` helpers are called only from `TrackingACanonicalRollback` (auto-rollback to OFF); who flips them ON is **unverified** (no caller in app/ besides tests; presumably tinker/operator).
- `FeatureFlag::enabled($slug)` = `(bool)(row.enabled ?? true)`: a slug with no row is ON (fail-open) (app/Models/FeatureFlag.php:28-40). `EnsureFeatureEnabled` redirects a blocked user to their home with flash `error` = "Ciri ini tidak tersedia buat masa ini." (app/Http/Middleware/EnsureFeatureEnabled).

### 0.3 Who reads which bank (matrix)

| Activity | Bank | Gate on content | Route flag |
|---|---|---|---|
| Latih Tubi SPM `/latih-tubi`, `/practice` | legacy; canonical if `latih-tubi-canonical` ON | `questions.status='diluluskan'` (legacy) / `question_statuses.is_servable` + `legacy_canonical_map` (canonical) | `latih-tubi` (OFF in prod) |
| Simulasi Kuiz `/simulasi/kuiz` | canonical | question servable + (paperless OR paper servable) + has correct option | none |
| Paper quiz view `/simulasi/{paper}/kuiz` | canonical | `ExamPaper::servable()` | none |
| Soalan by Chapter `/latih-tubi/bab` | legacy | listing counts `status != 'menunggu'`; Mula goes to flagged Latih Tubi | none on listing; `latih-tubi` on destination |
| Latihan Berstruktur / Tracking A Bahasa | legacy structured | `status='diluluskan'` AND `StructuredServing::markable` | none |
| Soalan Aku Salah | legacy | latest attempt wrong AND `status='diluluskan'` | none (page) |
| Ujian Remedial Saya | none (history of Aku Salah sessions) | n/a | `remedial` (ON) |
| Pembetulan | none (own wrong answers, links to Latih Tubi) | n/a | none |
| Peta Belajar | none (chapter counts, links to Latih Tubi) | `status='diluluskan'` count | none |
| Misi Harian / Penguasaan | none | n/a | `misi-harian` (route `/pelajar/misi`) |
| Set Soalan Guru | legacy | `question_sets.status='diterbitkan'` and teacher of own class; items `status='diluluskan'` at serve | none |
| Databank Soalan SPM | legacy | `type='mcq' AND status='diluluskan'` | none |
| Tracking A SPM | legacy `spm_sets` (kind ramalan) or canonical composites | legacy `diluluskan`; canonical `paper servable` + `import_issues.auto='tracking-a'` | per-subject canonical flag chooses link |
| SPM Mock K1 / K2 | legacy | `diluluskan` (K2: plus `markable`) | none |
| Subjektif SPM | legacy structured, or canonical K2 papers | see above | per-subject `subjektif-canonical-*` |
| Simulasi Peperiksaan / Bijak SPM | canonical | `ExamPaper::servable()` only | none |
| Kertas Subjektif | `paper_documents` (page images) | `published_at IS NOT NULL` | `kertas-subjektif` (OFF in prod) |
| PKSK PRO | `pksk_questions` | `status IN ('approved','diluluskan')` | none (subscription grant gates the list) |
| Games (7) | legacy `questions` | `type='mcq' AND status != 'menunggu'` and has options | `permainan` (OFF in prod) |
| Battle | legacy `questions` | `type='mcq' AND status='diluluskan'` | not inside the `permainan` group |
| Liga / Tournament | none | n/a | none |

### 0.4 Where the "whitelist" is not a whitelist (observed in code)

These are facts about the code, not recommendations.
- Canonical paper path: `ExamSimulationController::show/review` check only the **paper** status. They do not filter questions by `question_statuses`. A published native paper's questions are bulk-set to `approved` at publish; a published composite serves **pinned snapshots** (`exam_paper_questions.pinned_snapshot_id` -> `question_snapshots.content`), so the live question status is not consulted (PaperSection::orderedQuestions, ExamPaperQuestion::resolvedQuestion). The 5,037 draft questions in production are therefore bank questions not currently on a published paper (paperless bank, or members of unpublished papers/composites). Exact breakdown: **unverified**.
- Soalan by Chapter counts `status != 'menunggu'` (TeacherQuestionToolsController.php:511,544), so counts include `draf`, `ditolak`, `diarkib`.
- The seven Zona Permainan games and the teacher Set picker also use `status != 'menunggu'` (GameRoomService::poolQuery :179-200; BetulSalahController::drawStatements; TeacherController::bankSlice :1250, validateSet :1350-1352). Battle, Latih Tubi, Databank, Mock, Tracking A, Aku Salah, Peta Belajar and Set serving (at serve time) use `diluluskan`.
- Latih Tubi legacy query (QuizController::quiz) does **not** filter `type='mcq'`; Databank/Mock/Battle do.

### 0.5 Roles and access gates (admin)

- Main-site admin routes: `role:admin,admin_sekolah,pegawai_ppd` for reading (routes/web.php:176-188); all writes carry `role:admin`. `pusat:<label>` (NationalOnly) shows school admins a notice "diuruskan oleh Admin Pusat" for national content pages (SPM Quick Edit, Tracking A edit, Sunting Kandungan SPM). Panel nav shows national entries with a padlock to non-national roles (panel-layout.tsx:23-37).
- Student write routes (autosave, hantar, semak) are in the `role:pelajar` group (routes/web.php:1109-1135). Read routes (`/simulasi`, `/simulasi/{paper}`, `/simulasi/kuiz`) are `auth` only.

### 0.6 Production state at a glance (2026-10-30)

- OFF flags: `latih-tubi`, `permainan`, `kertas-subjektif`. ON for pelajar: remedial, sejarah, video, psikometrik, kemajuan, biasiswa, cita-cita, panduan, perutusan, profil-cerah, tiket, universiti. Flags not listed in the facts (`misi-harian`, `analisa-item`, `target-spm`, canonical flags, `legacy-retirement`): state **unverified**; unlisted slug with no row = ON (fail-open).
- Practical consequence visible from code: the student-facing links in Peta Belajar (`/latih-tubi/{code}/kuiz?chapter=..&count=..`, PetaBelajarController.php:123-124), Pembetulan (`/latih-tubi/{kod}`), and Soalan by Chapter `Mula` (`/latih-tubi/{code}`) all point at routes behind `latih-tubi`, so with the flag OFF each redirects to the student home with "Ciri ini tidak tersedia buat masa ini." (derived from code + OFF fact).
- Reachable and fed today: Simulasi Peperiksaan (69 published papers), Simulasi Kuiz (approved MCQ parts with a correct option), Databank SPM, SPM Mock, Tracking A, Subjektif SPM (legacy), Latihan Berstruktur, Soalan Aku Salah, Set Soalan Guru, Battle, PKSK list.

---------------------------------------------------------------------------------------------------

## 1. Shared canonical display engine (Simulasi Peperiksaan / Bijak SPM)

This engine is reused by S5 (Simulasi), Tracking A canonical composites, Subjektif canonical papers and the Studio/Panel preview (same Blade components).

### 1.1 Admin side of a canonical paper

Tables written: `exam_papers`, `paper_sections`, `exam_questions`, `question_parts`, `part_options`, `part_answer_keys`, `stimuli`, `question_stimulus`, `media_assets`, `exam_paper_questions` (composite membership), `question_snapshots` (publish pin), `source_papers`, `import_batches`, `import_items`, `paper_blueprints`, `blueprint_sections`, `paper_documents`/`paper_document_pages` (document Bahagian), `audit_logs`.

Paper kinds
- Native paper: `is_composite=false`; sections own questions via `exam_questions.paper_section_id` (`kertas` 1-4; 21 published with kertas 1/2 per facts).
- Composite paper: `is_composite=true`; sections reference bank questions through `exam_paper_questions` (reference, never reparent; ExamPaperQuestion docblock). Created by Set Builder (`Mula kosong`), Jana set (RandomSetGenerator), or `spm:build-tracking-a` (Tracking A). 41 of the 48 published null-kertas papers are composite.
- Document Bahagian: a `paper_sections` row with `paper_document_id` set (PaperSection::isDocumentSection :40-43); owns no questions; holds a page-image `PaperDocument` plus `mark_budget`.

Sections
- `selection_rule`: `answer_all` ("Jawab Semua") or `choose_n` ("Pilih N") with `select_count`. Scoring is best-N (ExamBestNScorer); the client tick-boxes are advisory only.
- `instruction_text` overrides the derived rule line. Derived defaults (components/bahagian.blade.php): choose_n -> "Jawab {N} soalan sahaja."; else "Jawab semua soalan."
- `mark_budget` applies only to document sections.

Blueprints ("Kontrak Simulasi")
- `paper_blueprints` unique per (subject, kertas 1-4): `paper_code`, `duration_minutes`, `total_marks`, `auto_markable`, `source` (`draft|spec|confirmed`), `notes`; child `blueprint_sections` (label, selection rule, select_count, mark_budget, instruction, expected answer modes). 36 blueprints, 23 blueprint_sections in production.
- Conformance (`BlueprintConformance`) is read-only; NULL means unknown and never fails. A composite or a paper with no `kertas`/subject has no contract (`for()` returns null). The publish gate blocks a native paper whose conformance fails unless the admin ticks an override checkbox (audited as `studio.paper.published_override`).

Publish gate stack (native paper, both main-site Studio and Panel):
1. At least one question (`Kertas ini tiada soalan — tidak boleh diterbitkan.`).
2. `SetPublishValidator` (app/Services/SetPublishValidator.php): per question the full `PublishValidator` (leaf marks >= 1; MCQ has >= 2 options and exactly 1 correct and a `single_key` pointing at its own option; non-MCQ leaf has an answer key with content; `table_fill` has at least one `_` blank; images resolve; intermediate marks sum rule), `choose_n` count not larger than available, no zero-mark section with questions, same-subject rule for composites, document section must have a published document with page_count >= 1, total >= 1.
3. Blueprint gate (native only).
4. Transaction: paper `published` and its own questions `approved`; audit log `studio.paper.published`.

### 1.2 Selection (student)

- Listing `/simulasi` (ExamSimulationController::index :31-60): `ExamPaper::servable()` with eager loads, `orderBy('title')`, grouped by `subject.name_bm` (fallback `Lain-lain`), groups sorted by paper count desc, papers within a group sorted by `import_issues['set']`. No kertas/year filter, no pagination.
- Open `/simulasi/{paper}` (show :62-139): re-resolves `ExamPaper::servable()->findOrFail` (draft = 404). Attempt resolution: session key `exam_sitting_{paper}` pins the in-progress attempt of this browser session; no pin -> create `ExamAttempt` (`mode='exam'`, `status in_progress`, `served_composition` snapshot of sections/question ids/positions/marks). Re-entry after more than 60 seconds without `?sambung=1` shows the resume choice page (see 1.3). A logout destroys the pin so a shared device starts blank.
- The paper is a fixed composition: no random draw at student time (random draw happens at admin time in Jana set / Tracking A build).

### 1.3 Student display step by step

1. Listing `/simulasi` (view `exam-sim/index.blade.php`): heading "Simulasi Peperiksaan", subheading "Duduki kertas SPM dalam format kertas sebenar — jawab, tanda automatik setiap halaman" (the "tanda automatik setiap halaman" part is stale: per-page auto-mark was removed; see 1.5). Per subject a card: `{subject}`, "`{N}` set · `{code}`". Per paper a tile: title is "Set {n}" when `import_issues.set` exists else the paper title; badge "Tracking A" if composite; chips "Kertas {k}", "{marks} markah" (choose_n-reduced `effectiveMarksTotal`), "{duration} min"; link "Mula". Empty state: "Tiada kertas tersedia buat masa ini" / "Set simulasi sedang dalam penyediaan. Semak semula tidak lama lagi."
2. Resume choice (only when re-entering an unsubmitted sitting older than 60 s): heading "Percubaan belum dihantar", "Masa berlalu setakat ini: mm:ss", buttons "Sambung — teruskan jawapan & masa sedia ada" and "Mula Semula — kosongkan jawapan & masa" (confirm dialog: "Semua jawapan dan masa untuk percubaan ini akan dikosongkan. Mula semula?"); footnote "“Sambung” mengekalkan semua jawapan anda. “Mula Semula” tidak boleh diundur."
3. The paper (view `exam-sim/attempt.blade.php`, inside the student shell, forced light theme). There is **no separate instruction/start screen**: the first sheet is the cover. Cover (components/cover): "SULIT", paper code (`cover_code` else subject code), subject name_bm as H1, "{code} · Kertas {k}", "{duration} minit", numbered instruction list (`instructionLines()`), the examiner grid "Untuk Kegunaan Pemeriksa" (columns Bhg, Soalan, Penuh, Diperoleh; row Jumlah) **only if the paper has any non-auto-marked part** (`isFullyAutoMarked()` false), and collapsible reference panels (formula sheets etc.) rendered open when `reference_assets` is set. The stored title/year is deliberately not shown.
4. Sticky control bar: timed paper counts down `mm:ss` (class `warn` at 5 minutes or less; banner "Amaran: masa berbaki kurang 5 minit."; auto-submit at 0 with no confirm); untimed paper shows elapsed with title "Masa berlalu". Save state text: `menyimpan…` / `disimpan` / `gagal simpan` / `luar talian`. Link "Lihat semakan lepas" when a submitted attempt exists. Button "Hantar" (confirm: "Hantar jawapan anda sekarang?"). Timer is UX only; server records real `submitted_at` and never rejects a late submit.
5. Bahagian header (components/bahagian): `{label}`, `[{effective marks} markah]`, rule line, and for choose_n a counter "{n} / {N} soalan dipilih"; each question shows a checkbox "Pilih soalan ini untuk dijawab" and unpicked questions dim/disable once the cap is reached.
6. Question card (components/question): number (`number_label`), stem HTML, `[N markah]` (always shown; `$showMarks = true`), flag button (glyph, title "Tanda soalan", `aria-pressed`), stimuli rendered **above** the stem, then the parts tree (components/part): label "(a)", prompt, `[N markah]`, nested sub-parts; only leaf parts get an answer widget. An essay whose single part prompt repeats the stem hides the duplicate prompt.
7. Question map rail (components/question-map): per Bahagian a group (with "pilih {N}" for choose_n) of numbered dot buttons (aria-label "Soalan {n}"); legend "Dijawab", "Ditanda", "Belum"; clicking a dot jumps to the sheet and scrolls. Mobile (max-width 900px): the rail moves above the paper (`order:-1`, not sticky); desktop: 260px right column, sticky top 74px.
8. Paging: the whole paper is paginated into "sheets" client-side (`buildSheets`, weight 4 per sheet; a question with a stimulus/figure/img/table counts 2; each Bahagian starts a new sheet; a shared-passage block is one sheet; a document Bahagian is its own sheet). Footer turner: "Halaman {x} daripada {y}", buttons "← Sebelum", "Seterusnya →", and on the last sheet "Hantar Jawapan"; last sheet also prints "KERTAS PEPERIKSAAN TAMAT"; footer shows "SULIT" and the subject code. Hidden questions stay in the DOM so answers are never dropped.
9. Autosave: one in-memory `answers` object, mirrored to `localStorage` key `exam-attempt-{id}`, server values win on load. Edits debounce 1 s then `PATCH /simulasi/percubaan/{attempt}/jawapan` with `{responses, flags, section_selections}`; on tab hide/pagehide it uses `sendBeacon`. Server stores raw responses only (never correctness) and only for parts in the attempt's served composition.
10. Submit: form POST `/simulasi/percubaan/{attempt}/hantar` (in-flight answers ride along) -> server marking (see 1.5) -> redirect to Semakan `/simulasi/percubaan/{attempt}/semakan`.

### 1.4 Answer-mode widgets (exact markup labels)

Server renders plain markup with `data-ak` keys; the single Alpine engine binds them (components/widget.blade.php dispatcher).

| Mode | Production parts (all / approved) | Widget |
|---|---|---|
| mcq | 5,335 / 532 | Radio group, aria-label "Pilihan jawapan"; each option is a label chip with letter `option.label` and HTML body (+ optional `image_html`); selected option gets class `sel`. Options keep their stored order (not shuffled). Answer value = option id. |
| short_text | 136 / 49 | Single line input, placeholder "Tulis jawapan…", aria-label "Jawapan". |
| numeric | 7 / 7 | Text input `inputmode=decimal`, placeholder "cth. 3.14…", aria-label "Jawapan berangka", optional unit suffix from `config.unit`. |
| extended_essay | 532 / 229 | Textarea (placeholder "Tulis jawapan anda di sini…", aria-label "Jawapan esei") with live counter "{n} patah perkataan"; `word_limit` sets `data-max` (counter turns `over` when exceeded). |
| essay_choice | 39 / 31 | Radio list of topics (`config.topics`) + textarea (placeholder "Tulis karangan anda di sini…", aria-label "Karangan"); counter "{n} patah perkataan · sasaran {min}–{max}" from `config.range`; chosen topic stored as `{part}-topic`. |
| working_shown | 3 / 0 | Label "Ruang kerja" + textarea (placeholder "Tunjukkan langkah pengiraan…") and final line "Jawapan:" with input (placeholder "jawapan akhir", aria-label "Jawapan akhir") + unit. Stored as `{working, value}`. |
| numbered_list (0 in prod) | 0 / 0 | N rows (`config.rows`, default 3) numbered I, II, III...; input per row. |
| table_fill (0) | 0 / 0 | Table from `config.head`/`rows`; every cell equal to `_` becomes an input (aria-label "Sel {n}"). |
| sequence_order (0) | 0 / 0 | Draggable list (`draggable=true`, grip glyph), response = ordered list of original indexes. |
| gapped_text_match (0) | 0 / 0 | Chip pool "{label} — {body}" (distractors not flagged) + one `select` per gap, placeholder "— pilih —", aria-label "Padanan {n}". |
| cloze (0) | 0 / 0 | Inline text input size 8, aria-label "Isi tempat kosong". |
| graph_plot (0) | 0 / 0 | Canvas toolbar widget (`resources/views/exam/widgets/graph-plot.blade.php`, `hard-widgets.js` inlined). Response object `{points...}`. Detail labels: **unverified**. |
| draw_on_diagram (0) | 0 / 0 | Transparent canvas over `config.base_html`, label "Lukis pada rajah", button "Padam"; response `{strokes}`; self-mark only. |
| code (0) | 0 / 0 | Monospace textarea (aria-label "Editor kod", placeholder default "// tulis kod anda"); stores `{code, lang}`; no execution. |
| unknown mode | n/a | "Jenis jawapan ini akan tersedia tidak lama lagi." |

Production reality: only mcq, short_text, numeric, extended_essay, essay_choice and working_shown have rows; the other 8 modes have 0.

### 1.5 Stimulus rendering (components/stimulus.blade.php)

Wrapper `.stim` with optional caption (`.cap`). Renderer by `stimulus_kinds.slug`:
- passage (797 in prod): class `petikan`, optional bold title, `prose` HTML body, source citation line. 
- image (667), infographic (2): `.info` figure; `<img>` from the media asset (width/height attributes to avoid layout shift, `loading=lazy`, alt = caption), optional bold title, then body HTML under the picture; caption `.cap2`.
- diagram (410), map (9), graph (1): `.rajah` figure with inline `body.svg`, else asset `<img>`, else `body.html`; caption `.cap2` fallback "Rajah" (diagram/map) or "Graf" (graph).
- table (45): if an asset exists and no rows, an image figure (fallback caption "Jadual"); otherwise a real `<table>` from `body.head/rows` (first cell of each row is the row header) with `body.caption`.
- Kinds with 0 rows but code: box (bullet list), cartoon (as image), math (`body.mathml`), code/pseudocode/sql (`<pre class="codeblock">`), audio (`exam/stimulus/audio.blade.php`), video ("Media (video) — akan datang"), unknown (plain block).
- Placement: stimuli render above the stem. If exactly one stimulus is common to **every** question of a Bahagian (`PaperSection::sharedStimulus`, needs at least 2 questions) the Bahagian uses the split layout: passage pane (hint "📌 Petikan kekal dipapar semasa menjawab") + questions pane. CSS: two columns 1fr 1fr, passage pane `position:sticky; top:74px; max-height:calc(100vh - 96px); overflow:auto`; at max-width 820px it becomes one column with a short sticky header (top 57px, max-height 42vh). Otherwise each question carries its own stimulus(es) inline.
- Math is baked to MathML at authoring time (InlineMathBaker); the attempt page must contain no `$` characters (test-enforced).

### 1.6 Marking

- Objective (`ExamGrader`, answer-key kinds `single_key`, `accepted_values`, `mapping`) is marked **on the server at submit**. Correctness comes only from `part_answer_keys`/`part_options.is_correct`, never the request; a foreign option id scores false. All-or-nothing per part (`awarded_marks = part.marks` or 0). `accepted_values`: numeric compare within `tolerance`, else case/whitespace-insensitive text compare. `mapping`: exact map (gaps) or exact order (sequence).
- Subjective kinds `mark_scheme_points`, `band_rubric`, `model_answer`: at submit, only `mark_scheme_points` with a non-empty answer and no mark yet gets a keyword suggestion (`RubricKeywordMarker`: tokens of length 5 or more minus Malay/English stop-words; per-point marks summed if the rubric has them, else proportional) stored as `awarded_marks` with `self_marked=true` only when greater than 0. Zero match stays null.
- Score = ExamBestNScorer (best `select_count` per choose_n Bahagian, tie-break lower position) + document Bahagian self-marks. Denominator = `max_score` from the recorded composition (so later edits cannot change it) + document `mark_budget`s.
- AI essay grading exists as dormant code (`BandRubricMarker`, `GradeEssays`) and staff review (`/spm/tanda-karangan` in the Panel, only shown when the `essayGrading` flag is on): **unverified** whether active.

### 1.7 Semakan (result/review) and retry

`/simulasi/percubaan/{attempt}/semakan` (owner only; unsubmitted attempt redirects to the live sitting). Same paper view with `reviewing=true`: answers frozen, clock frozen, header shows "Dihantar", the score text `{score} / {max}` and the form button "Cuba Lagi". Per leaf part the scheme block ("Skema Pemarkahan · {n} markah") is revealed:
- single_key: "Jawapan: **{letter}** {option body}" then verdict "✓ Betul ({awarded}/{marks})" or "✗ Salah ({awarded}/{marks})".
- accepted_values: "Jawapan diterima: {values}" (+ "(toleransi ±{x})").
- mapping: "Padanan betul: {json}".
- mark_scheme_points: bullet list of points with `[N markah]`; matched points get a tick titled "Kata kunci dikesan dalam jawapan"; line "🔎 Cadangan automatik (kata kunci): {a} / {m}" and "— {x}/{y} isi dikesan. Sila semak & laraskan."
- model_answer: the text. band_rubric: one radio per band "Band {b} · {label} ({min}-{max}): {descriptor}" (choosing a band sets the stepper to the midpoint and narrows its range).
- Non-objective parts also show a number input "Markah kendiri:" (aria-label "Markah kendiri untuk bahagian ini") `/ {marks}`; server clamps 0..marks, no lock; each change POSTs `/simulasi/percubaan/{attempt}/semak` and refreshes the score label.
- Document Bahagian: "Markah dinilai sendiri (Bahagian B):" `/ {mark_budget}`, POST `/semak-bahagian`; note when budget unset: "Markah maksimum Bahagian ini belum ditetapkan — hubungi pentadbir."
- Retry: "Cuba Lagi" POST `/simulasi/{paper}/cuba-lagi` creates a new attempt. Re-opening `/simulasi/{paper}` after submit also starts blank; "Lihat semakan lepas" links to the last review.
- No per-page instant marking exists (route and code removed on purpose, ExamSimulationController.php:555-558).

### 1.8 Simulasi Kuiz and paper quiz view (same canonical bank, different UI)

- `/simulasi/kuiz` (ExamQuizController::index :30-95): parts with answer mode `mcq`, whose question is `is_servable` AND (`exam_paper_id IS NULL` OR paper in `ExamPaper::servable()`), optionally filtered by subject code via the question's paper subject, with at least one `is_correct` option; `inRandomOrder()->limit(count)`; counts 5/10/20/40 (default 20). The `$subjects` list is passed but the view has no subject picker markup (only the retry link carries `&subject=`); entry UI for choosing subject/count: **unverified** (no picker found in `exam-sim/quiz.blade.php`).
- Display: header "Simulasi — Kuiz", "Soalan {i} daripada {n}", timer "Masa", progress bar; card with chips "❓ Soalan {i}", subject, "{marks} markah"; stimulus box (caption or "Petikan"); prompt/stem HTML; options shuffled and re-lettered; button "✓ Semak" (server-graded via `POST /simulasi/kuiz/semak`, payload never contains `is_correct`); result "🎉 Betul!" / "😟 Salah"; next button "Soalan Seterusnya →" / "Tamat →"; finish "Kuiz Selesai!" with Markah, Ketepatan, Masa; buttons "↻ Cuba Lagi", "Kertas penuh". Empty: "Belum ada soalan objektif". Does not write `practice_sessions` (no recorder call): **verified absence in controller**.
- `/simulasi/{paper}/kuiz` (ExamQuizController::paper): servable paper paged by Bahagian through `PaperViewBuilder::pages`; shared stimulus pinned once; per question MCQ options with "✓ Semak" server check; non-MCQ parts show a plain textarea "Tulis jawapan anda di sini…" that is not graded or saved (no endpoint); document Bahagian shows page images and "Tunjuk Skema Pemarkahan (cuba jawab dahulu)" / "Sembunyi"; footer "← Sebelum", "Skor: x / y", "Seterusnya →". Empty: "Kertas ini tiada soalan".

---------------------------------------------------------------------------------------------------

## 2. Activity-by-activity (A = admin side, S = selection, D = display, M = marking, P = production state)

### 2.1 Latih Tubi SPM (`/latih-tubi`, `/practice`)

A. Content: legacy `questions` (mcq) created by Filament form, CSV import, teacher CSV/Sumbang (menunggu), or canonical bank when `latih-tubi-canonical` is ON. Gate: `status='diluluskan'` (Luluskan) / canonical `approved` plus `legacy_canonical_map` row. Admin: see section 3 flows 3 and 4; no Latih Tubi-specific admin screen except the SPM lane "Latih Tubi" in the Panel/`/admin/spm/latih-tubi` (listing + Sunting).
S. `QuizController::index` lists active subjects with a count of `diluluskan` questions (canonical: `canonicalPoolCount`), only those with count > 0, split "Subjek Teras" / "Subjek Elektif"; `setup` offers Tahap Pendidikan (legacy only), Tahap Kesukaran (1-5 with counts), Bilangan Soalan 5/10/15/20; `quiz` query: `subject_id`, `status='diluluskan'`, optional `education_level_id`, `difficulty_level`, `topic_id`, `chapter_id`; `inRandomOrder()->limit(count)`; count 1-50 when `topic` or `chapter` filter present else 5/10/15/20 (default 10).
D. Index: heading "Latih Tubi SPM", subheading "Pilih subjek untuk mula berlatih", banner "Soalan by Chapter" with "Mula →", card chips "{n} soalan" and "Target SPM: {n}" / "Target Custom: {n}". Setup: "← Kembali ke Senarai Subjek", "🪙 {n} soalan tersedia", "🎓 Pilih Tahap Pendidikan" (option "♾️ Semua Tahap"), "📊 Pilih Tahap Kesukaran", "🔢 Bilangan Soalan", summary rows "Tahap Pendidikan", "Kesukaran", "Bilangan Soalan", button "▶ Mula Kuiz". Quiz: one question per screen, "Soalan {i} daripada {n}", elapsed timer "Masa", "🔀 Soalan dan pilihan jawapan dirawak setiap sesi.", chip "✓ Mengikut DSKP", question text as plain text (x-text, no HTML), optional image "Rajah soalan", options re-lettered A-D, label "💬 Soalan oleh: **Admin PRESTASI+**", "✓ Semak" -> immediate ✅/❌ and "🎉 Betul!"/"😟 Salah" (no explanation shown in this view), then "Soalan Seterusnya →"/"Tamat →". Result "Kuiz Selesai!", "Tahniah, anda telah lengkapkan {subject}.", tiles Markah, Ketepatan, "🪙 Syiling" (= 2 per correct), buttons "↻ Cuba Lagi", "Senarai Subjek". Empty: "Tiada soalan untuk pilihan ini.".
M. Client-side: the `correct` boolean for every option is in the page JSON; the browser decides and POSTs `/latih-tubi/{code}/result` (`answers[{question_id,is_correct,selected_option,time_seconds}]`) to `PracticeRecorder::record` mode `latih_tubi`. Canonical mode: canonical ids are translated to legacy ids via `legacy_canonical_map`; unmapped ids dropped.
P. Route flag `latih-tubi` is **OFF** -> unreachable (redirect with "Ciri ini tidak tersedia buat masa ini."). Would be fed by 408,197 legacy MCQ (or the mapped canonical pool). `latih-tubi-canonical` state: unverified (likely OFF).

### 2.2 Simulasi Kuiz and paper quiz view
Covered in 1.8. A: canonical bank (Studio/imports). Gate: question approved (Kuiz) / paper published (paper quiz). P: reachable (no flag).

### 2.3 Soalan by Chapter (`/latih-tubi/bab`, `/latih-tubi/bab/{code}`)
A. Reads legacy `questions.chapter_id` and `chapters` (curriculum). No own content.
S. Subject list: active subjects with at least one chapter, showing chapter count and question count (`chapter_id NOT NULL AND status != 'menunggu'`). Chapter list per subject ordered by education level, sort_order, number; each chapter row has `{n} soalan`; `Mula` links to `/latih-tubi/{code}` (subject setup page, not the chapter) when the count > 0, else a locked chip "Tiada soalan" (title "Belum ada soalan untuk...").
D. Pages `latih-tubi/bab.blade.php`, `bab-subject.blade.php`. Marking: n/a (hands off to Latih Tubi).
P. Listing reachable; `Mula` leads to flagged Latih Tubi (OFF) so the end of the flow redirects. Counts include non-approved statuses.

### 2.4 Latihan Berstruktur / Tracking A Bahasa (`/latihan-berstruktur`, `?scope=spm&track=bahasa`)
A. `structured_questions` + `structured_sub_questions` (+ `structured_rubric_points`). Authored in Filament `/admin-filament/structured-questions` (legacy), rubric editing in the Panel "Subjektif" editor (`/spm/subjektif/{question}/sunting`); status `diluluskan` makes it servable but **also** `StructuredServing::markable` must hold: at least one sub-question has a non-empty `scheme` or a rubric point row (app/Support/StructuredServing.php). 4,061 diluluskan / 9,796 sub-questions.
S. List: `markable` AND `status='diluluskan'`, optional `subject_id`, `kbat_level`; ordered by id desc; paginated 20. Tracking A Bahasa restricts the subject dropdown to BM and BI.
D. List: heading "Soalan Berstruktur" (or "Tracking A Bahasa" with subheading "BM dan BI ikut format kertas sebenar"; default subheading "Latih tubi format Kertas 2"), filters "Semua Subjek" and "Aras KBAT"/"Semua", cards with best score, `{n} markah`, button "Mula" or "Cuba Lagi". Notice: "{n} soalan untuk pilihan ini masih menunggu skema pemarkahan..." ; empty "Tiada soalan berstruktur ditemui" / "Tiada soalan sepadan dengan tapisan anda. Cuba tapisan lain." Answer page: "Soalan Berstruktur — Jawab", stimulus, "{n} bahagian · {m} markah", prompt "✍️ Tulis jawapan anda, kemudian tekan Hantar & Semak. Keputusan setiap bahagian muncul terus di bawah jawapan itu.", textarea per sub-question (placeholder "Tulis jawapan anda di sini..."), button "Hantar & Semak" ("Menyemak…"); after marking shows "Skema Pemarkahan:", "Jalan Kerja / Skema:" and, when no rubric points, "Tiada rubrik berpoin untuk bahagian ini, jadi pemarkahan automatik tidak dapat dijalankan."; final button "Hantar Jawapan". Result page `/latihan-berstruktur/keputusan/{attempt}`.
M. Server-side `StructuredMarker`: authored rubric points or points derived from the scheme sentence (flagged `derived`); literal keyword matching; saves `structured_attempts` + `structured_attempt_answers`; then `recordAggregate` (mode `spm_ramalan` for bahasa track else `spm_mock`, paper `paper2`). Only 9 `structured_attempts` exist in production.
P. Reachable (no flag), roles pelajar/guru/admin/admin_sekolah/pegawai_ppd.

### 2.5 Soalan Aku Salah (`/practice/revision`, `/practice/revision/{subject}`)
A. none (system).
S. Latest attempt per question (`MAX(id)` per question from `question_attempts`) with `is_correct=false` AND `questions.status='diluluskan'`, grouped by subject (`practiceRevisionIndex`); drill loads all those ids for the subject (`?question_id=` = single retry). Subject-id integer routes.
D. Heading "Soalan Aku Salah", subheading "Ulang kaji soalan yang pernah dijawab salah"; drill uses the same Alpine quiz as Latih Tubi.
M. Client-side; POST `/practice/revision/{subject}/result` -> `PracticeRecorder` mode `revision`.
P. Reachable. Only legacy ids are in `question_attempts` (7,685 rows) so canonical-only attempts never appear here (code fact).

### 2.6 Ujian Remedial Saya (`/remedial/saya`, `/pelajar/remedial`), Pembetulan (`/pembetulan`), Peta Belajar (`/peta-belajar`), Misi Harian (`/misi-harian`, `/pelajar/misi`), Penguasaan (`/penguasaan`)
No question content of their own.
- Remedial: heading "Ujian Remedial Saya", subheading "Ujian khas untuk topik yang perlu diperbaiki"; lists weak subjects (accuracy under 60) and completed `revision` sessions with Sebelum/Selepas accuracy. Flag `remedial` ON. Teacher side: `/guru/remedial-progress`, command-center remedial scan/generate (not detailed here).
- Pembetulan: monthly (`?bulan=YYYY-MM`) list of wrong answers by subject (`question_attempts.is_correct=0`), links to `/latih-tubi/{kod}`. No flag on the page; destination flagged OFF.
- Peta Belajar: heading "Peta Belajar", subheading "Terokai perjalanan pembelajaran — takluki setiap pulau!"; chapter islands; unlocked when `Question::where('chapter_id')->where('status','diluluskan')->count() > 0`; link `/latih-tubi/{code}/kuiz?chapter=..&count=min(20,available)`.
- Misi Harian: challenges via ChallengeProgress; teacher creates at `/guru/misi-harian/cipta`; links onward to Latih Tubi.

### 2.7 Set Soalan Guru (`/set-soalan-saya`, `/pelajar/set/{set}`)
A (teacher, main site): `/guru/set/cipta` form `title` (3-80), `type` (free string, default `latihan`), `status` (`draf|diterbitkan`), `subject_id`, `education_level_id`, `question_ids[]` (picked from a bank slice limited to 50 rows `status != 'menunggu'`, filter subject/level/text). Writes `question_sets`, `question_set_items` (`sort_order`). Flash: `Set "{title}" disimpan ({status}).`, update: `Set dikemas kini.` Gate: `diterbitkan` + teacher owns a class of the student. Production: `question_sets` 0 rows, `question_set_items` 20 (inconsistent; the 20 items belong to no listed set: **unverified**).
S. Fixed set; items filtered to `questions.status='diluluskan'` at serve; options shuffled and re-lettered; access check `classTeacherIds($student)` contains set teacher (403 otherwise).
D. Listing heading "Set Soalan Guru", subheading "Set soalan yang disediakan oleh guru anda"; play view `pelajar/set-quiz.blade.php` = same MCQ Alpine quiz; labels unverified beyond that.
M. Client-side; `/pelajar/set/{set}/result` -> mode `set`.
P. Route reachable but the table has 0 sets so nothing to play.

### 2.8 Databank Soalan SPM (`/spm/tahun-lepas`)
A. Legacy MCQ; Panel/Admin lane "Databank Soalan" (`/spm/databank`, `/admin/spm/databank`).
S. `SpmPracticeController::index` lists subjects with count of `type='mcq' AND status='diluluskan'` > 0; `quiz`: random `limit(count)`, counts 5/10/20 (default 10); no level/difficulty filters; always the legacy table (does not consult `latih-tubi-canonical`).
D. Heading "Databank Soalan SPM"; `spm/quiz.blade.php` quiz identical to Latih Tubi plus label "Penjelasan:" revealing `questions.explanation` after Semak when present.
M. Client-side; POST result -> mode `spm_tahun_lepas`; response includes letter grade, "Ganjaran Anda" values (syiling, kombo, mata, baki).
P. Reachable. Fed by the 408,197 diluluskan MCQ.

### 2.9 Tracking A SPM (`/spm/ramalan`, `/spm/ramalan/{code}`, `/spm/tracking-a/{code}`)
A. Legacy: `spm_sets` (kind `ramalan`, `target_count` default 40, `year`, `set_number`) + `spm_set_question` (position), built by `spm:build-ramalan-sets` (tag `notes='auto:tracking-a'`) or the editor. Canonical: composites built by `spm:build-tracking-a {--year=2026 --size=40 --subject= --publish --dry-run}` (draw from paperless bank via RandomSetGenerator; lands `draft`; `--publish` runs SetPublisher). Edit membership in the Tracking A set editor (section 3 flow 5). Set status computed: `locked` (filled < target), `bersih` (=), `bank_besar` (>).
S. Hub lists subject cards for non-language subjects with at least one non-locked legacy set, plus canonical cards from published composites (`import_issues.auto='tracking-a'`, `canonicalTrackingA()`); BM/BI go to the Bahasa lane `/latihan-berstruktur?subject_id=..&scope=spm&track=bahasa`. A subject can get both a legacy and a canonical card (code appends both; behaviour in production unverified). Subject page: a locked set returns 404; run page loads set questions `status='diluluskan'` ordered by position, `limit(target_count)`, options shuffled.
D. Heading "Tracking A SPM", subheading "Set objektif penuh & bahasa format sebenar"; readiness report ("Set Bersih", "Bank Besar", "Set Masih Lock", per-subject "{n}/{m} set bersih", "Bank source: {n}"), card button "Pilih Set"; empty text "Tiada set objektif Tracking A yang bersedia lagi. Set sedang dibina — semua set semasa masih dalam proses pengisian. Semak semula tidak lama lagi!". Legacy run view `spm/ramalan-set.blade.php` = MCQ quiz with "Penjelasan:" and "Ganjaran Anda". Canonical run = the Simulasi engine of section 1 (`/simulasi/{id}`), listing page `spm/tracking-a-sets.blade.php`.
M. Legacy: client-side, mode `spm_ramalan`. Canonical: server-side (ExamGrader) and `syncAnalytics` branch `spm_ramalan` counting objective parts (count, not marks).
P. Reachable. 60 legacy ramalan sets, 1,737 links (target 2,400, so some sets are `locked`). Canonical flags unverified.

### 2.10 SPM Mock Exam (`/spm-mock`, `/spm-mock/kuiz`, `/spm-mock/kertas2`, `/spm-mock/{session}/result`)
A. Legacy MCQ (K1) and structured (K2).
S. K1: random `type='mcq' AND status='diluluskan'`, optional subject, counts 5/10/20/40 (default 20). K2: `markable` structured `status='diluluskan'`, optional subject, random, counts 3/5/10 (default 3).
D. Heading "SPM Mock Exam", subheading "Peperiksaan percubaan SPM"; history table "Mock Sebelum Ini" (10 latest `spm_mock` sessions with letter grade; labels "Paper 1 (Objektif)", "Paper 2 (Subjektif)"); K1 = MCQ quiz; K2 view `spm/mock-paper2.blade.php` ("SPM Mock — Kertas 2").
M. K1 client-side (mode `spm_mock`). K2 server-side `StructuredMarker` via `mock2Result` (returns breakdown) and `recordAggregate` paper `paper2`. Letter grade from accuracy: A+ 90, A 80, A- 70, B+ 65, B 60, C+ 55, C 50, D 40, else E.
P. Reachable.

### 2.11 Subjektif SPM (`/spm/subjektif`)
A. Legacy structured (as 2.4) or canonical K2 native papers.
S. Subjects with markable diluluskan structured counts; when `subjektif-canonical-{code}` is ON and a native servable kertas '2' paper exists, the card links to `/simulasi/{first paper}` and counts papers.
D. Heading "Subjektif SPM", subheading "Latihan struktur & esei"; stats Teras/Elektif/Set; progress tiles (answered, subjects, best) derived from `practice_sessions` paper 'paper2'.
P. Reachable; legacy path by default.

### 2.12 Simulasi Peperiksaan / Bijak SPM (`/simulasi`)
Full description in section 1. A: Studio (DOCX ZIP, BI DOCX, import review, Set Builder, Jana Kertas) and Panel "Semak Kertas Simulasi". Selection: fixed published paper. Marking: server-side objective + keyword suggestion + self-mark. P: reachable; 69 published papers (kertas 1: 10, kertas 2: 11, null/composite 48 of which 41 composite), 286 attempts all `mode='exam'`, 105 submitted, 1,262 part responses.

### 2.13 Kertas Subjektif (`/kertas-subjektif`, `/kertas-subjektif/{paper}`)
A. `paper_documents` (+ `paper_document_pages` kind `paper|scheme`): metadata created in the Panel "Kertas Subjektif" screen (Baharu), pages come from the CLI importer `exam:import-paper-docs` (a manually created record has `page_count=0`, cannot be published; the Panel publish button is disabled with title "Perlu sekurang-kurangnya satu halaman"). Publish toggle in the Panel (`Terbit`/`Sembunyikan`) and the main site `/admin/kertas-subjektif` (`Terbit`/`Sembunyi`). Gate: `published_at` set. Production: K2 222, K3 28, K4 4, all published, 7,258 pages.
S. All published, `orderBy kertas, negeri`, grouped by subject (groups ordered by size). 
D. Index heading "Kertas Subjektif", subheading "Kertas 2, 3 & 4 percubaan negeri — baca soalan, jawab atas kertas, kemudian buka skema untuk semak sendiri"; empty "Kertas subjektif sedang dalam penyediaan. Semak semula tidak lama lagi." Viewer (`kertas/show.blade.php`): heading "{subject} — Kertas {k}", `{marks_total} markah`, lazy page images `alt="Muka surat {n}"`, button "Tunjuk Skema Pemarkahan" ("Sembunyi" to hide), scheme pages `alt="Skema muka surat {n}"`; fallback "Skema pemarkahan tidak tersedia untuk kertas ini."
M. None: self-check on paper. The same documents can also be attached to a Simulasi composite as a document Bahagian (section 1.1) where a single self-mark is recorded.
P. Route flag `kertas-subjektif` is **OFF** -> unreachable, although the 254 documents are published. Document Bahagian path in Simulasi stays reachable if a published composite attaches one (how many: unverified).

### 2.14 PKSK PRO (`/pksk`)
A. Admin `/admin/pksk/questions` (PkskQuestionController) and `/admin/pksk/access` (grants); table `pksk_questions` with English status (`approved|pending`) and Malay (`diluluskan`/`menunggu`) both present. 748 rows: 728 diluluskan, 20 approved.
S. Servable = `status IN ('approved','diluluskan')`; counts per Bahagian and per domain (top 12) always shown; the question list (first 50 ordered by bahagian then id) only if the student has an active `pksk_accesses` grant (status `aktif`, `expires_at` null or in the future) joined to `pksk_packages`.
D. Heading "PKSK PRO", subheading "Bank soalan Pentaksiran Kompetensi & Sijil Kemahiran"; sections "Soalan mengikut Bahagian", "Soalan PKSK" cards "BAHAGIAN {n}" + domain. No answer widget found: listing only (answering flow **unverified**; none found in PkskController).
P. Reachable.

### 2.15 Games (7 in Zona Permainan + Battle), Liga/Tournament, Cabutan
- Zona Permainan hub `/permainan` and games `/papan-bijak`, `/perang-fakta`, `/benteng-ilmu`, `/perlumbaan-matematik`, `/kuiz-relay`, `/teka-silang-kata`, `/betul-salah` are inside the route group `feature:permainan` (routes/web.php:1310-1395) -> **OFF**, unreachable. Pool: `GameRoomService::poolQuery`: `type='mcq' AND status != 'menunggu'` and has options, subject-scoped, grade level scoped only if that yields rows; `drawQuestion` = `inRandomOrder()->first()`, options shuffled/relabeled A-D. Betul atau Salah derives a true/false statement from an MCQ (coin flip: stem + correct option -> `betul`, stem + random distractor -> `salah`); Teka Silang Kata builds a crossword with `CrosswordBuilder`. Admin: `/admin/permainan` (config), Kawalan Ciri toggle `permainan` ("Zona Permainan").
- Battle `/battle` (Quick Match, Battle Sekolah; Cabar Kawan has no backend): `BattleController::start` count 5/10/15/20 (default 10), `duration = count x 12 s`; `pullQuestions` = `type='mcq' AND status='diluluskan'` random for the chosen subject, correct flags in the session payload; two bot participants; not inside the `permainan` group so reachable.
- Liga `/liga`, Tournament `/tournament`, `/api/tournament/active`: leaderboards/competitions over `question_attempts` activity; no question selection. `tournaments` table has no migration in repo (guarded by `Schema::hasTable`): unverified.
- Cabutan `/cabutan`: lucky draw, no questions.

---------------------------------------------------------------------------------------------------

## 3. Admin task flows (D79d)

### 3.0 Admin navigation (exact labels)

Main site sidebar (resources/views/admin/layout.blade.php:225-730). Group "Soalan" (collapsible, label shown uppercase "SOALAN"):
- `SPM` -> `/admin/spm` (hub)
- `Bank Soalan (Studio)` -> `/admin/studio`
- `Import & Semakan` -> `/admin/studio/imports`
- `Set Builder` -> `/admin/studio/sets`
- `Sumber Kertas` -> `/admin/source-papers`
- `Kertas Subjektif` -> `/admin/kertas-subjektif`
- sub-group `Bank Lama (Legasi)`: `Senarai Soalan` -> `/admin/questions` (tabs inside: Kualiti, Laporan), `Soalan Berstruktur` -> `/admin/structured-questions`
Group "SPM" (student-side shortcuts): Databank Soalan, Latih Tubi, Tracking A, Subjektif. Group "Premium": `PKSK Soalan`, access. Standalone `Kawalan Ciri`. Top-bar shortcut `Audio KBAT`. Mobile bottom bar item "Soalan" -> `/admin/studio`.
Items marked national show a padlock titled "Diuruskan oleh Admin Pusat".

Panel sidebar (resources/js/panel/layouts/panel-layout.tsx:32-42): `Papan Pemuka`, `Analitik`, `Pengguna`, `Sekolah`, `Kandungan SPM` (padlock for non-national), `Tanda Karangan` (only when essay grading flag on), `Question Studio` (padlock for non-national). School-scoped items `Analitik`, `Sekolah` hidden for `pegawai_ppd`. Panel pages with no sidebar entry: `/spm/kontrak` ("Kontrak Simulasi"), `/spm/kertas` ("Senarai Kertas"), `/spm/simulasi-paper/{paper}/review` ("Semak Kertas Simulasi"), `/spm/tracking-a/{set}/sunting`, `/studio/sets/{paper}/builder` ("Pembina Set"); they are reached from the SPM hub/lane cards and buttons.

Panel hub `/spm` ("Kandungan SPM") shows one card per lane (SpmLane::all): `Databank Soalan` ("Bank soalan objektif SPM mengikut subjek."), `Tracking A` ("Set objektif penuh dan lane bahasa."), `Subjektif` ("Soalan berstruktur dan esei."), `Bijak SPM` ("Kertas SPM penuh dalam format sebenar."), `Kertas Subjektif` ("Kertas 2, 3 & 4 percubaan negeri."), `Latih Tubi` ("Latihan ikut topik dan bab."); each with a count of items needing attention (labels: "tidak boleh ditanda", "set tidak lengkap", "tiada skema — tidak disajikan", "tiada kunci jawapan", "tiada halaman") and button "Buka senarai". Lane page `/spm/{lane}` ("Kandungan SPM"): filters `Subjek` ("Semua Subjek"), `Status` ("Semua Status"), `Cari`, buttons `Tapis`, `Set Semula`; table columns `Senarai`, `Tajuk`, `Perhatian`, `Tindakan`; row actions `Pratonton`, `Salin` (native Simulasi rows), `Sunting`. Main-site lane page `/admin/spm/{lane}` has the same filters ("Semua Subjek", "Semua Status", "Cari") with link "← Semua laluan SPM" and "lihat sisi pelajar".

Feature flags admin: `/admin/feature-toggles` ("Kawalan Ciri"); flash `Ciri "{label}" telah DIAKTIFKAN.` / `Ciri "{label}" telah DINYAHAKTIFKAN.`

### 3.1 Flow 1: create one question

Main site only (Panel has no create: its button "Cipta di Studio" is disabled, title "Cipta soalan dalam panel akan datang", `STUDIO_CREATE_IN_PANEL=false`). Role `admin` (staff read-only).

Steps and clicks (to "visible to students"):
1. Sidebar `Soalan > Bank Soalan (Studio)` (`/admin/studio`, title "Studio", subtitle "Bank soalan kanonikal — cipta, semak, terbit"). Click `Cipta baharu` (route `admin.studio.create`, title "Studio — Cipta soalan", subtitle "Cipta soalan kanonikal dari kosong (draf)"). [2 clicks]
2. Wizard form, sticky tab nav (aria-label "Bahagian borang"): `Kertas`, `Rangsangan`, `Sub-bahagian`, `Tag`.
   - "Langkah 1 Kertas & bahagian" ("Letak soalan dalam kertas peperiksaan, atau simpan sebagai soalan bank."): `Kertas (pilihan)` select (default "— Soalan bank (tiada kertas) —"), `Bahagian` select, `Nombor soalan` (required, placeholder "1"), `Teks soalan (stem)` textarea (placeholder "Contoh: Rajah 1 menunjukkan litar bersiri.").
   - "Langkah 2 Rangsangan (stimulus)": `Jenis rangsangan` (stimulus kind, default passage), `Kapsyen (pilihan)`, rich editor (TipTap) toolbar: Tebal, Condong, `• Senarai`, `1. Senarai`, `</>` (Blok kod), `Jadual` (Sisip jadual 2×2), `+Baris`, `+Lajur`, `×Jadual`, `√x` (Matematik dalam baris), `√x blok`, `Imej` (Muat naik imej), buat asal/semula; math dialog placeholder "cth. \frac{a}{b} atau \ce{H2O}" with `Sisip`/`Batal`.
   - "Langkah 3 Sub-bahagian" ("Setiap bahagian membawa jenis jawapan, markah dan skema tersendiri."; running "Jumlah markah"): per part `Label` (placeholder "a"), `Jenis jawapan` (13 modes; cloze is not offered), `Markah`, `Arahan sub-bahagian`; mode-specific editor (MCQ: option rows with letter and "Teks pilihan", mark-correct tick, `+ Pilihan`; numeric: `Jawapan`, `Toleransi` (0.01), `Unit`; accepted values: "Jawapan diterima"; scheme points: "Isi skema pemarkahan"; essay: `Had perkataan`); buttons `+ Sub-bahagian` (nest one level), `Buang`.
   - "Langkah 4 Tag & pengelasan" ("Bab, topik dan aras kesukaran untuk penapisan dan pelaporan."): `Bab`, `Topik`, `Kesukaran` (options "Mudah", "Sederhana", "Sukar").
   - Footer save bar (appears when dirty): "{n} markah", "· {n} belum lengkap", button `Simpan draf`.
   - Draft recovery banner: "Terdapat kerja yang belum disimpan daripada sesi sebelum ini." with `Pulihkan` / `Buang`. Error banner: "Ada masalah — {n} ralat." / "Kerja anda telah dikembalikan; betulkan yang berikut dan simpan semula."
3. `Simpan draf` -> flash "Soalan draf disimpan. Terbitkan melalui semakan apabila sedia." and redirect to the edit screen (title "Studio — Sunting soalan", subtitle "Soalan draf #{id}"). Status bar: label "Status", badge `Draft`, text "Belum dipapar kepada pelajar.", buttons `Pratonton` (preview), `Hantar untuk semakan`, `Arkib`.
4. `Hantar untuk semakan` -> flash "Soalan dihantar untuk semakan." (status `Reviewed`). Button `Terbitkan` appears.
5. `Terbitkan` (no confirm dialog) -> `PublishValidator`; on failure it lists every violation (e.g. "Soalan belum boleh diterbitkan — sila betulkan isu di bawah." plus messages such as "Bahagian (a) mempunyai 0 pilihan betul — mesti tepat 1.", "Bahagian (a) tiada skema jawapan.", "Soalan tiada sub-bahagian — tiada apa untuk dijawab."); on success status `Approved`, flash "Soalan diterbitkan — kini boleh dijawab oleh pelajar." and bar text "Soalan ini boleh dijawab oleh pelajar."

Click count: new question to approved = Cipta baharu (1) + fill + Simpan draf (1) + Hantar untuk semakan (1) + Terbitkan (1) = **4 button clicks** beyond filling the wizard (plus sidebar navigation click). Note: "approved" makes the question servable to question-level readers (Simulasi Kuiz, Tracking A build, Set Builder bank) but a question appears in a full Simulasi paper only after its paper/composite is published (flow 4).

Other buttons in this area: list `Studio` (`/admin/studio`): status tiles (Draft, Reviewed, Approved, Archived with counts); filters (selects, aria "Tapis mengikut subjek/status/tahun/negeri atau badan peperiksaan/kertas/jenis peperiksaan"): `Semua subjek`, `Semua status`, `Semua tahun`, `Semua negeri`, `Semua kertas` (Kertas 1-3), `Semua jenis`; button `Tapis`; columns `No.`, `Soalan` (stem truncated to 90 chars), `Kertas` (paper title or "Bank (tiada kertas)" + subject code), `Sumber` (provenance badge), `Status`; row actions `Pratonton`, `Edit` (draft/reviewed) or `Edit sebagai draf` (approved: clones to a new draft, original keeps serving; flash "Draf baharu #{id} dicipta. Soalan asal kekal diterbitkan sehingga draf ini diterbitkan."); 25 per page. Archive: `Arkib` on the edit screen, flash "Soalan diarkibkan — tidak lagi dipapar kepada pelajar." Allowed transitions: draft->reviewed|archived; reviewed->approved|draft|archived; approved->archived; archived->draft (QuestionLifecycle). Illegal move flash: "Peralihan '{from}' -> '{to}' tidak dibenarkan."; editing an approved question flash: "Soalan ini telah diterbitkan. Gunakan "Edit sebagai draf" untuk menyuntingnya."

Panel counterpart (edit only): `Question Studio` -> `/studio` ("Bank Soalan"): status tiles, filters `Subjek`, `Status`, `Tahun`, `Negeri`, `Kertas`, `Jenis` (each "Semua ..."), buttons `Tapis`, `Set Semula`; columns `No.`, `Soalan`, `Tindakan`; row actions `Pratonton`, `Edit` (in-panel modal for Panel-editable modes: mcq, numeric, numbered_list, extended_essay, essay_choice, working_shown, code, gapped_text_match, table_fill, draw_on_diagram, sequence_order, short_text, graph_plot; others link out "Buka di Studio penuh"), `Sembunyikan` with dialog title "Arkibkan soalan ini?" and buttons `Batal` / `Sembunyikan`. Panel edit modal fields: Kertas, Bahagian, Nombor soalan, Teks soalan (stem), Jenis rangsangan, Kapsyen (pilihan), Bab, Topik, Kesukaran; buttons `Simpan`, `Tutup`; note "Status ditukar melalui Studio penuh (hantar/terbit/arkib)." Out-of-scope message: "Soalan ini di luar skop suntingan Panel — sunting di Studio penuh." (Panel has no submit/publish.)

### 3.2 Flow 2: import a batch (DOCX/OCR) and review it

Three import doors, all produce **draft** content.

A. DOCX set ZIP (main site, `/admin/studio`): button `Import DOCX (ZIP)` opens modal "Import set DOCX" ("Muat naik satu fail ZIP mengandungi folder set (DOCX utama, Skema, imej)."). Field: file `archive` (.zip, max 30 MB, aria "Fail ZIP set DOCX"). Notice: "Kertas diimport sebagai DRAF — tiada apa-apa diterbitkan kepada pelajar sehingga anda menerbitkannya. Pemprosesan berjalan serta-merta; kertas besar mungkin mengambil beberapa saat." Buttons `Batal`, `Muat naik & proses` (busy text "Memproses…"). Synchronous (no queue). On success a green banner (import_status, may list warnings and "Isu: {kind} — {detail}") with button `Semak & terbitkan kertas →` to the paper review. Error banner = `import_error`.
B. BI Kertas 1 comprehension: button `Import BI Kertas 1` -> modal "Import BI Kertas 1 (Comprehension)" ("Muat naik fail DOCX soalan (Part 1–5). Soalan, pilihan & jawapan diekstrak automatik."). Fields: `Fail soalan (DOCX) *`, `Fail skema jawapan (DOCX) — pilihan` (hint "Perlu hanya jika fail soalan tiada grid ANSWERS di hujungnya."), `Tajuk kertas — pilihan` (placeholder "cth. PRESTASIPLUS BAHASA INGGERIS KERTAS 1 (Set 2)"). Buttons `Batal`, `Muat naik & ekstrak`. Draft paper.
C. OCR/extractor pipeline: CLI only (`exam:import-ocr-papers`, `exam:ingest-extraction` (accuracy gate `--min-accuracy=90`), `exam:accept-extraction`, `questions:import-2025`, `exam:import-docx`, `exam:import-paper-docs`, `questions:import-rip`); extractor script is not in the repo (unverified). Result lands in `import_batches`/`import_items`, reviewed in the UI below. 43 batches, 1,468 items in production.

Review screens
1. `Import & Semakan` (`/admin/studio/imports`): tabs `Kelompok Item`, `Kertas Diimport`, `Kiriman Guru` (-> `/admin/question-submissions`). `Kelompok Item` columns: `Fail Sumber`, `Subjek`, `Bilangan Soalan`, `Disemak`, `Status`, link `Semak`. `Kertas Diimport` columns: `Kertas`, `Subjek`, `Bilangan Soalan`, `Status`, link `Semak & Terbit`; empty "Tiada kertas diimport lagi."
2. Item review (`/admin/studio/imports/{batch}/review`, title "Studio — Semak Import"): link "← Kembali ke senarai import"; counter "Item {i} / {n}"; button `Terima semua yang belum disemak`; left pane "Sumber PDF" (pdf.js, `Sebelum`/next page), right pane editable stem ("Teks soalan"), options ("Pilihan A..." inputs), "Jawapan" ("Jawapan betul"), "Cadangan Provenans"; actions `Terima (A)`, `Tolak (R)`, `Simpan Sunting (E)` (keyboard shortcuts A, R, E). `accept` creates canonical question(s) via `ExtractionItemAccepter` (draft).
3. Paper review (`Semak & Terbit`, `/admin/studio/imports/paper/{paper}/review`, title "Semak kertas", subtitle = paper title): renders the paper as students see it (via `PaperViewBuilder`); blockers banner "{n} masalah menghalang penerbitan." (or "Kertas ini SUDAH TERBIT tetapi ada {n} masalah — pelajar sedang menerimanya begini."); link "← Bank"; per-question edit via Studio. 
4. Publish: button `Terbitkan` (rocket icon; title "Betulkan {n} masalah dahulu" when blocked) with confirm "Terbitkan kertas ini? Ia akan terus boleh diakses pelajar di Simulasi."; optional checkbox "Terbitkan walaupun tidak memenuhi kontrak blueprint" (only when the sole blocker is the blueprint gate). Success flash: "Kertas '{title}' telah DITERBITKAN — kini boleh diakses pelajar di Simulasi." Reverse: `Tarik balik ke draf` with confirm "Tarik balik kertas ini ke draf? Pelajar tidak lagi dapat mengaksesnya." -> flash "Kertas '{title}' ditarik balik ke DRAF — tidak lagi diakses pelajar."; paper and its questions both return to draft.
Click count (DOCX): `Import DOCX (ZIP)` (1) + pick file + `Muat naik & proses` (1) + `Semak & terbitkan kertas →` (1) + `Terbitkan` (1) + confirm OK (1) = **4 clicks + 1 dialog confirm** after navigating to Studio. 
Panel counterpart: the same paper in `Semak Kertas Simulasi` (`/spm/simulasi-paper/{paper}/review`), see flow 4. Panel has no upload/import ("Panel create/import TBD").
Teacher uploads (`Kiriman Guru`, `/admin/question-submissions`): admin downloads files (`/admin/question-submissions/{id}/download/{file}`) and imports by hand (no automated parser: unverified UI labels).

### 3.3 Flow 3: approve or archive questions

Canonical: per question in Studio (flow 1 steps 4-5, `Arkib`), Panel `Sembunyikan`. Paper publish/unpublish bulk-changes the paper's own questions (flow 4). There is no multi-select bulk action in Studio or Panel lists (none found).

Legacy bank (`Bank Lama (Legasi) > Senarai Soalan`, `/admin/questions`, title "Senarai Soalan", subtitle "Pengurusan bank soalan platform", heading "📚 Pengurusan Soalan" / "Urus bank soalan untuk platform PRESTASIPLUS"):
- Header buttons: `Tambah Soalan` (redirects to Studio with notice "Borang soalan lama telah dipindahkan ke Studio. Sila cipta soalan baharu di sini."), `Import CSV` (dead stub; real import is Filament `/admin-filament/questions/import`), `Luluskan Hasil Tapisan` (title "Luluskan semua soalan yang sepadan dengan tapisan semasa"; confirm "Luluskan SEMUA soalan hasil tapisan ini? Ia akan kelihatan kepada pelajar."; requires at least one filter, else error "Sila pilih sekurang-kurangnya satu penapis (subjek/aras/status/carian) sebelum meluluskan secara pukal."; success "Berjaya luluskan {n} soalan (hasil tapisan) — kini kelihatan kepada pelajar."), `Arkib Semua` (title "Arkibkan semua soalan — sembunyikan daripada pelajar"; confirm "ARKIB SEMUA soalan?\n\nBank soalan pelajar akan menjadi KOSONG sehingga anda luluskan soalan secara manual (per soalan atau per tapisan). Tindakan ini boleh dibalikkan."; success "Berjaya arkib {n} soalan. Bank pelajar kini kosong — luluskan soalan secara manual untuk memaparkannya semula.").
- Summary "Ringkasan Bank Soalan" ("Jumlah: {n} soalan") per subject.
- Filters: `Subjek` (Semua Subjek), `Tahap` (Semua Tahap), `Kesukaran` (Semua; ⭐ Sangat Mudah ... ⭐⭐⭐⭐⭐ Sangat Sukar), `Status` (Semua Status; Draf, Menunggu, Diluluskan, Ditolak, Diarkib), `DSKP` (Ada DSKP Tag / Belum Ditag), `Compliance` (Verified, AI Verified, Pending Mapping, Tiada Source PDF), `Source` (Textbook, Trial, Skema), search "Cari teks soalan...", buttons `Cari`, reset (title "Reset").
- Columns `Soalan`, `Tindakan`; row buttons (icon, titles) "Luluskan — paparkan kepada pelajar" and "Arkib — sembunyikan daripada pelajar"; badge `VERIFIED`. Row flashes: "Soalan #{id} telah diluluskan (kini kelihatan kepada pelajar)." / "Soalan #{id} telah diarkibkan (disembunyikan daripada pelajar)."
- Filament form `/admin-filament/questions` (QuestionForm): field `type` (options "Objektif (MCQ)", "Berstruktur"), status select (draf, menunggu, diluluskan, ditolak, diarkib), `source` (textbook/dskp/trial/skema), options repeater; Filament CSV import columns `body, option_a-d, correct, [difficulty]`, creates `draf`, `source=import`.
- Quick Edit (`/admin/spm/{lane}/{id}/sunting` main, `/spm/soalan/{id}/sunting` Panel): fields "Teks soalan", "Pilihan jawapan — pilih yang betul", status radio "Diluluskan (dipaparkan kepada pelajar)", "Draf", "Menunggu", "Ditolak", section "Tetapan lanjutan", buttons "Buka editor penuh", "Pratonton pelajar"; gate `McqGate` blocks a question that cannot be marked ("Soalan ini tidak boleh ditanda seperti sedia ada:" with problems "Teks soalan tidak boleh kosong.", "Soalan objektif memerlukan sekurang-kurangnya 2 pilihan jawapan.", "Pilihan {x} tidak boleh kosong.", "Tiada jawapan betul dipilih — soalan ini tidak boleh ditanda.", "{n} jawapan betul dipilih. Soalan objektif hanya boleh ada satu.").
- Teacher-submitted questions arrive as `menunggu` ("Kiriman Guru"/`guru_sumbang`); the admin approves them with the same Luluskan controls.

### 3.4 Flow 4: build or generate a paper (Set Builder / Jana Kertas) and publish it

Main site `Set Builder` (`/admin/studio/sets`, title "Set Builder", subtitle "Kertas latihan daripada bank soalan percubaan").
1. Landing (no paper): heading area "Bank soalan" / "Bina set soalan" / "Ambil soalan daripada kertas percubaan mengikut subjek, tahun dan negeri."; right: mini form `Tajuk set kosong` + `Subjek` + `Mula kosong` (creates a composite with three empty sections "Bahagian A/B/C", rule `answer_all`; flash "Set komposit dicipta. Seret soalan ke dalam Bahagian untuk mula.").
2. Card "Jana set" / "Ambil soalan secara rawak" (this is "Jana Kertas"): fields `Tajuk set` (placeholder "cth: Latih Tubi Sejarah Mac"), `Subjek` ("Pilih subjek"), `Bilangan soalan` (1-100), `Tahun` ("— semua jika tiada pilihan", chips), `Negeri` (same); aside "Kolam soalan": "{n} soalan tersedia", "Anda meminta {k} daripadanya.", warnings "Subjek ini tiada soalan berskema, jadi set tidak boleh dijana.", "Sama dengan jumlah kolam — setiap set akan serupa.", "Kurangkan bilangan soalan atau longgarkan penapis."; button `Jana set` (disabled unless pool is sufficient). Pool = deduped paperless/native non-composite questions with an answer key, not already a composite member (`PickableQuestionPool`). Insufficient pool shows `InsufficientPoolException` message on `count`. Success flash: "{n} soalan dijana secara rawak. Semak sebelum menerbitkan." Existing list below shows each set with status chip `Terbit` / `Draf`.
3. Builder (`/admin/studio/sets/{paper}/builder`): header with title and "Jumlah markah keseluruhan: {n} markah", links "← Kembali" and `Terbitkan` ("Menerbitkan…"). Left "Bank Soalan" browser (filters Tahun, Negeri, search "Cari teks soalan…", destination select aria "Bahagian destinasi", per-card `Tambah`, or drag with sort handle); right one column per Bahagian: fill bar "{n} / {N} dipilih" style, rule select `Jawab Semua` / `Pilih N` with number input, drop zone hint "Seret soalan ke sini, atau gunakan butang 'Tambah' pada senarai bank.", per item `Buang` (title) and badge `Terbit`; edit link per item opens Studio edit with `set` context (breadcrumb "← Kembali ke set “{title}”"). JS errors verbatim: "Soalan gagal ditambah — cuba lagi.", "Susunan gagal disimpan — muat semula halaman dan cuba lagi.", "Soalan gagal dibuang — cuba lagi.", "Bahagian gagal dikemas kini.", "Ralat semasa mencari bank soalan.", "Set ini tidak lulus pengesahan.", "Ralat tidak dijangka semasa menerbitkan.", "Ralat rangkaian semasa menerbitkan." After publish: "Set ini telah diterbitkan."; unpinned warning "Set ini diterbitkan, tetapi {n} soalan yang ditambah selepas itu belum dibekukan. Terbitkan semula untuk membekukannya."
4. Publish (`Terbitkan`, no confirm dialog): `SetPublishValidator` (+ blueprint gate returns 422 JSON with `blueprint_block`); success pins a `question_snapshots` row per membership and sets the paper `published`. Audit logged.
Clicks: `Mula kosong` or `Jana set` (1) + for generated sets 0 extra edits + `Terbitkan` (1) = **2 clicks** minimum to publish a generated set (manual: 1 + N adds/drags + 1).

Panel `Pembina Set` (`/studio/sets/{paper}/builder`): same assembler in React: title edit (aria "Tajuk set"; flash "Set '{title}' telah dinamakan semula."), bank search ("Cari soalan…"; "Menunjukkan 150 teratas — tapis lagi untuk menyempitkan."; "Tiada soalan sepadan."), per Bahagian label ("Label bahagian"/placeholder "Bahagian"), rule select `Jawab Semua` / `Pilih N`, `Markah Bahagian` (document Bahagian max), `Lampir Kertas 2` / `Tanggalkan` (attach/detach a published Kertas Subjektif document: dialog "Pilih dokumen Kertas 2 diterbitkan", `Lampir`, `Tutup`, "Tiada dokumen Kertas 2 diterbitkan untuk subjek ini."), per question `Sunting`, `Buang`, chips `Disematkan`, `Tidak disajikan`, section hint "Tiada soalan dalam bahagian ini. Lepaskan soalan di sini.", "Dalam set", "Set ini belum mempunyai bahagian.", contract panel `Kontrak Simulasi` with `Sunting kontrak`, "Bahagian objektif set ini vs kontrak Kertas 1", warnings "Set ini belum memenuhi kontrak penuh (K2 subjektif tiada).", "Set kelihatan belum lengkap — ada bahagian tanpa soalan.", override checkbox "Terbitkan walaupun tidak memenuhi kontrak"; publish route `panel.studio.sets.publish`.

Native paper publish and edit (Panel `Semak Kertas Simulasi`, `/spm/simulasi-paper/{paper}/review`; opened from the lane `Bijak SPM` row `Sunting`): blocks `Kontrak Simulasi` ("Tiada kontrak untuk subjek/kertas ini."), `Kemas kini metadata` (fields `Tajuk`, `Tempoh (minit)`, `Kod kertas (kulit)`, `Arahan kulit kertas` placeholder "Satu baris = satu arahan bernombor di kulit kertas."; flash "Kertas '{title}' telah dikemas kini."), `Sunting bahagian` (`Label bahagian`, `Peraturan menjawab`, `Bilangan soalan dipilih`, `Arahan bahagian` placeholder "Kosongkan untuk membuang arahan."; flash "Bahagian '{label}' telah dikemas kini."), `Sunting petikan` (stimulus: `Tajuk petikan`), `Bahan rujukan (kulit kertas)` (`Tambah gambar`, `Tajuk panel`, `Buang panel`, up/down arrows; flash "Bahan rujukan kertas telah dikemas kini."), `Tambah soalan` (fields `Nombor soalan`, `Jenis jawapan`, `Markah`; only to admin-created Bahagian; errors "Soalan hanya boleh ditambah ke bahagian yang dicipta oleh admin.", "Nombor soalan {x} sudah digunakan dalam kertas ini."), `Padam soalan` (confirm text "Soalan tambahan ini, termasuk bahagian, pilihan jawapan dan skemanya, akan dibuang dari kertas. Tindakan ini tidak boleh dibatalkan."; flash "Soalan {label} telah dipadam."), `Salin set` (duplicate to a draft; flash "Set disalin sebagai draf. Sunting dan terbitkan salinan baharu."), `Penerbitan` panel: while draft "Belum boleh diterbitkan" blockers, button `Terbit`; while live "Kertas ini sedang DITERBITKAN — pelajar boleh mengaksesnya di Simulasi." and `Sembunyikan`; override "Terbitkan walaupun tidak memenuhi kontrak Simulasi". A published paper cannot be edited: "Kertas ini sudah diterbitkan — tekan “Salin set” di atas untuk menyunting salinan draf." Flashes: "Kertas '{title}' telah DITERBITKAN — kini boleh diakses pelajar di Simulasi." / "Kertas ini belum boleh diterbitkan — {n} masalah perlu dibetulkan." / "Kertas ini tidak memenuhi kontrak blueprint subjek." / "Kertas '{title}' ditarik balik ke DRAF — tidak lagi diakses pelajar." Panel `publish`/`unpublish` abort 404 for composites (composites publish through the builder).

### 3.5 Flow 5: manage Tracking A sets

Entry: Panel `Kandungan SPM` > card `Tracking A` > lane list > row `Sunting` (route `panel.spm.tracking-a.edit`); main site `/admin/spm/tracking-a/{set}/sunting` (national-only notice for school admins). Legacy `spm_sets` only (canonical composites are managed in the Set Builder).
Screen "Set Tracking A" (title `Tracking A`, section "Soalan dalam set"): list of member questions in order (drag handle "Susun semula soalan"), each row `tukar` (replace with another servable question; gate message on failure "Tiada soalan lain yang boleh disajikan untuk ditukar." / "Tukar gagal."; notice "Soalan yang ditukar telah dibuang; tukaran diabaikan."), `buang` (remove), chip `Baharu` for newly added; button `Isi set` (fills the shortfall from the free pool; failure reason "Tiada soalan lain yang boleh disajikan untuk mengisi set ini."; hidden when the set is full); state text "Set ini masih kosong." / "Set ini lengkap."; inline question editor "Sunting Soalan" (right pane: "Pilih soalan untuk menyunting.", "Memuatkan…", `Cuba lagi`, link "Buka di laman berasingan"); button `Simpan`. Nothing is committed until `Simpan` (client-side fill/buang/tukar only). Save validation: "Pilih sekurang-kurangnya satu soalan sebelum menyimpan."; `validateSave` rejects a question already used in a sibling set of the same subject/year or an invalid question; success flash "Set dikemas kini." (Panel redirects back to the Panel). Writes `spm_set_question` in one transaction. Build commands (CLI): `spm:build-ramalan-sets`, `spm:build-tracking-a`.
Status shown to the student is derived: set must reach `target_count` questions to leave `locked`.
Click count: Kandungan SPM (1) > Tracking A card (1) > row `Sunting` (1) > `Isi set` (1) > `Simpan` (1) = 5 to make a short set playable.
Canonical flip (`tracking-a-canonical-{code}`) requires `TrackingAParityGate::passesFor` (blueprint conformance or a logged override) as a pre-flip check; no UI to flip (see 0.2).

### 3.6 Flow 6: manage Kertas Subjektif

Panel `Kandungan SPM` > card `Kertas Subjektif` > `Senarai Kertas` (`/spm/kertas`, title "Kertas Subjektif"): stat tiles `Jumlah Kertas`, `Diterbitkan`, `Ada Skema`; filters `Subjek` ("Semua Subjek"), `Kertas` ("Semua Kertas" with Kertas 2/3/4), `Status` ("Semua Status", `Terbit`, `Draf`), search `Cari` (placeholder "Tajuk..."), buttons `Tapis`, `Set Semula`; columns `Tajuk`, `Subjek`, `Kertas`, `Negeri`, `Tahun`, `Halaman`, `Status`, `Tindakan`; badge "tiada skema"; row actions `Sunting`, `Sembunyikan` / `Terbit`, `Padam` (dialog "Padam kertas ini?" with `Batal` / `Padam`). Create form `Baharu`: `Tajuk` (placeholder "Contoh: Bahasa Melayu Kertas 2"), `Subjek` ("Tiada subjek"), `Kertas` (Kertas 2/3/4), `Negeri`, `Tahun`, `Tempoh (minit)`, `Jumlah Markah`; buttons `Cipta`/`Batal` (flash "“{title}” telah dicipta sebagai draf."; update "“{title}” telah dikemas kini."; delete "“{title}” telah dipadam."). Detail page (`/spm/kertas/{paper}`): "← Kembali ke Kertas" (`Kembali ke Kertas`), `Lihat sebagai pelajar`, `Terbit` / `Sembunyikan`, `Padam`, facts `Tempoh`, `Jumlah Markah`, sections `Halaman Kertas` ("Tiada halaman kertas."), `Skema` / `Halaman Skema` ("Tiada halaman skema."). Page images cannot be uploaded in either UI; they come only from `exam:import-paper-docs` (verified: KertasController::store sets `page_count=0`).
Publish: `Terbit` -> flash "“{title}” kini diterbitkan."; no pages -> error "“{title}” tiada halaman — tidak boleh diterbitkan."; hide -> "“{title}” disembunyikan daripada pelajar."
Main-site equivalent `Soalan > Kertas Subjektif` (`/admin/kertas-subjektif`, title "Kertas Subjektif", subtitle "Kertas 2/3/4 percubaan negeri — pratonton & terbitan"): tiles `Jumlah Kertas`, `Diterbitkan`, `Ada Skema`; filters (Semua Subjek / Semua Kertas / Semua Status with Diterbitkan, Draf), `Tapis`; columns `Subjek`, `Kertas`, `Negeri`, `Tahun`, `Halaman`, `Status`, `Tindakan`; actions `Pratonton`, `Sembunyi`, `Terbit`; empty "Tiada kertas sepadan penapis." Publish route `POST /admin/kertas-subjektif/{paper}/terbit` (`role:admin`).
Student-visibility needs, besides `published_at`, the route flag `kertas-subjektif` ON (currently OFF; and not toggleable in Kawalan Ciri).
To use a document inside Simulasi: Panel `Pembina Set` > `Lampir Kertas 2` (flow 4).
Clicks: `Terbit` is 1 click once pages exist.

### 3.7 Flow 7: edit a blueprint (Kontrak Simulasi)

Panel only (`/spm/kontrak`, title "Kontrak Simulasi"; reached from the Panel Set Builder / paper review buttons `Sunting kontrak`, and from direct URL; no sidebar entry). Heading `Senarai Kontrak`; button `Baharu` opens "Kontrak Baharu": `Subjek`, `Kertas` (Kertas 1-4), `Cipta`; creating a duplicate subject+kertas fails with "Kontrak untuk subjek/kertas ini sudah wujud." Success flashes: "Kontrak dicipta.", "Kontrak dikemas kini.", "Kontrak dipadam." Empty state: "Tiada kontrak lagi. Cipta kontrak pertama menggunakan butang "Baharu" di atas."
Editor fields (in order): `Kod Kertas`, `Tempoh (minit)`, `Jumlah Markah`, `Sumber` (values `Draf`, `Spec`, `Disahkan`), `Boleh tanda auto` (toggle), `Nota`; then `Bahagian` table with `Tambah Bahagian` ("Tiada Bahagian lagi."): per Bahagian `Label` (placeholder "Contoh: Bahagian A"), `Peraturan Pilihan` (`Tiada`, `Pilih N`), `Markah`, `Arahan (opsyenal)`, `Mod Jawapan Dijangka`, remove (aria "Buang Bahagian"); button `Simpan`. Warning text "Kontrak dikongsi." ("...SEMUA kertas subjek tersebut, bukan hanya satu kertas."). Delete dialog "Padam kontrak ini?" (title "Padam kontrak") with `Batal` / `Padam`.
Effect: `BlueprintConformance` compares a **native** paper's sections (selection rule, select_count, mark budget, answer modes) and kertas metadata to this contract at publish time; NULL blueprint values never fail. Draft contracts are marked in the Panel as "Tanda manual" / "draft — sahkan dengan LPM". Seeded by `BlueprintSeeder` from docs.

---------------------------------------------------------------------------------------------------

## 4. Table of student gates (summary)

| Student activity | What the admin must do to make it visible |
|---|---|
| Simulasi / Bijak SPM | Publish a paper (native: Studio `Terbitkan` or Panel `Terbit`; composite: Set Builder `Terbitkan`) |
| Simulasi Kuiz | Approve a MCQ question (with a correct option), either paperless or on a published paper |
| Paper quiz view | Publish the paper |
| Tracking A (legacy) | Fill the `spm_sets` set to `target_count` questions that are `diluluskan` |
| Tracking A (canonical) | Build + publish a composite tagged `import_issues.auto='tracking-a'` |
| Latih Tubi / Databank / Mock K1 / Aku Salah / Battle | Luluskan (`diluluskan`) the legacy MCQ; Latih Tubi also needs flag `latih-tubi` ON |
| Latihan Berstruktur / Mock K2 / Subjektif | `diluluskan` + a scheme or rubric point on at least one sub-question |
| Kertas Subjektif | `published_at` set (needs at least one page) + flag `kertas-subjektif` ON |
| Set Soalan Guru | Teacher publishes the set (`diterbitkan`) + approved items |
| PKSK | `approved/diluluskan` rows + student grant |
| Games | Flag `permainan` ON; pool uses non-`menunggu` MCQ |

## 5. Unverified items

1. Who turns on/off `latih-tubi`, `kertas-subjektif`, `latih-tubi-canonical`, `tracking-a-canonical-*`, `subjektif-canonical-*`, `legacy-retirement` (no admin UI; only rollback helper in code); current state of the canonical and retirement flags in production.
2. State of flags not in the supplied facts (`misi-harian`, `analisa-item`, `target-spm`, `leaderboard`, `kombo`, `prestasi`).
3. Breakdown of the 5,037 draft canonical questions (paperless bank vs members of unpublished papers/composites) and whether published composites rely on pinned snapshots for every membership.
4. Whether canonical Tracking A composites in production are all tagged `import_issues.auto='tracking-a'` (41 composite papers) and whether subjects show duplicate legacy+canonical cards.
5. Entry UI (subject/count picker) for `/simulasi/kuiz`; no picker markup found.
6. PKSK answering flow (none found); Set Soalan Guru play-view labels beyond the shared quiz; K2 mock view labels; graph_plot widget labels.
7. `question_sets` = 0 vs `question_set_items` = 20 in production.
8. Essay review queue `/spm/tanda-karangan` and AI essay grading activity (flag `essayGrading`).
9. `tournaments` table existence; Liga/Tournament role gating.
10. The OCR extractor script (`tools/import/2025/extract_runner.py`) is not in the repo; CLI operator procedure unverified.
11. `Kiriman Guru` (`/admin/question-submissions`) screen labels; Filament form field labels beyond those quoted.
12. Whether the auto-submit at timer expiry (0 seconds, no confirm) fires reliably on all devices (client code reviewed only).
13. Stale subheading on `/simulasi`: "tanda automatik setiap halaman" contradicts the removed per-page marking (code comment states removal; subheading text still ships).
