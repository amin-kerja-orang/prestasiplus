# V2 to V3 parity: student-facing (pelajar) features

Date: 2026-10-30 (rows B13 and B15-B18 re-checked against base 823d8dfb on 2026-10-31, H-A22; see the bold notes). Read-only audit, static reading only (nothing run). Branch `local/v2-full`.
Naming: V1 = prestasiplus.my, V2 = prestasiplus.cloud (+ admin), V3 = the new system (the repo calls it "v2").

## 0. Scope and method

- Scope (user, 2026-10-30): secondary students only (Tingkatan 1-5; Darjah out, D72). Bijak SPM / Simulasi first. Full detail only for the "Murid 1.0" matrix items (docs/Matriks-Akses-Peranan .xlsx): Dashboard, Headcount, Prestasi, Analitik Adaptif, Analisa Item, Video, Kelas Saya, Soalan by Chapter, Remedial, SPM (Bijak SPM / Simulasi, Databank, Tracking A, Mock, Subjektif), Heatmap Topik Lemah, Permainan, Laporan Soalan, plus Profil Saya, Tetapan Peribadi, Panduan, Log Keluar. Every other student feature is one row marked KIV.
- V2 sources: `D:\Dev Projects\prestasiplus-reference\backend` (controllers, Blade views `resources/views/exam-sim/*`), production routes.json (484 non-admin routes; about 189 carry `EnsureRole:pelajar`), server-facts and inventory notes.
- V3 sources: FE routes in `src/modules/*/routes*`, nav `src/shells/nav/user-nav.ts` and `out-of-scope.ts`, flags `src/app/features.ts`, BE controllers `apps/api/src/modules/**`, TRACKER D28-D85.
- "Real BE?" rule: the FE has one transport (`VITE_API_MODE=http` real, otherwise in-browser mock, `src/api/mode.ts`). A page is marked real when its FE api module calls a path that a Nest controller serves. Only paths were compared; response shapes were not diffed (unverified).
- Production flags (V2): OFF = latih-tubi, permainan, kertas-subjektif. ON for pelajar: remedial, sejarah, video, psikometrik, kemajuan, biasiswa, cita-cita, panduan, perutusan, profil-cerah, tiket, universiti. Slugs without a row count as ON (so Simulasi, SPM, Mock, Prestasi are ON). D80 (Q-02) makes Latihan Tubi and Permainan visible in V3 at go-live although they are OFF in V2.
- Status legend: ✅ rebuilt and displayed; ⚠️ partial; ❌ missing; 🚫 dropped or changed by decision; 🔒 built but hidden by flag; KIV = out of current scope (not assessed in depth).

## 1. Bijak SPM / Simulasi: V2 student engine vs V3

V2 routes (role pelajar and up, no flag): `GET /simulasi`, `/simulasi/{paper}`, `/simulasi/percubaan/{attempt}/semakan`; `PATCH /simulasi/percubaan/{attempt}/jawapan`; `POST .../hantar`, `.../semak`, `.../semak-bahagian`; `POST /simulasi/{paper}/cuba-lagi`; `GET /simulasi/kuiz`, `POST /simulasi/kuiz/semak`, `GET /simulasi/{paper}/kuiz`. Controllers `ExamSimulationController`, `ExamQuizController`; views `exam-sim/{index,resume,attempt}.blade.php` and `components/{cover,bahagian,bahagian-dokumen,question,part,widget,stimulus,scheme,question-map,refpanels}`.
V3: FE `/spm/bijak`, `/spm/bijak/sejarah`, `/spm/bijak/kertas/:paperId`, `/spm/bijak/percubaan/:attemptId`, `.../keputusan` (src/modules/m28-bijak-spm); BE `@Controller('bijak')` (`papers`, `papers/:id`, `contracts`, `subjects`, `papers/generate`, `attempts` create/get/answers/submit/abandon/check/result/history/photos, `papers/:paperId/in-progress`).
Real BE wiring: FE `server/http.ts` calls `/api/bijak/*`; real in http mode. Content gap: on UAT `papers`, `paper_placements`, `blueprints`, `stimuli` = 0 and `curriculum_nodes` = 0, so Kertas Pilihan is empty there until papers are built and published (admin pipeline D85) or the PoC flag `BIJAK_POC_QUESTIONS` is set.

Usage in V2: `exam_attempts` Jul 6, Aug 70, Sep 99, Oct 108 (submitted 1, 27, 29, 48; completion about 37-44%), rising; `part_responses` 1,262. Simulasi is the second most used activity after Databank (426 sessions). Subjective self-marking therefore matters (B15).

| ID | V2 screen / state / behaviour (BM verbatim) | V3 status | V3 evidence and differences | Priority |
|---|---|---|---|---|
| B01 | Senarai `/simulasi`: servable (published) papers grouped by subject; card = "Set N", "Tracking A" label for composites, "Kertas N", "N markah", "N min", button "Mula"; empty state "Tiada kertas tersedia buat masa ini / Set simulasi sedang dalam penyediaan. Semak semula tidak lama lagi." Content source: admin (published papers, Set Builder). | ✅ | `BijakHubPage.vue` tab "Kertas Pilihan" (subject and kertas filters, status per paper, "Mula" / "Sambung"), BE `GET /bijak/papers`. Same empty copy "Semak semula tidak lama lagi." | P0 |
| B02 | Muka depan (cover): SULIT, paper code, subject, "Kertas N", "N minit", numbered instructions, "Untuk Kegunaan Pemeriksa" mark grid (Bhg / Soalan / Penuh / Diperoleh / Jumlah) shown only if a part is self-marked, declared reference assets (formula, constants, normal_dist, graph_paper). | ⚠️ | `PaperCoverPage.vue`: code, subject, kertas, minutes, numbered instructions, foldable reference sheet. Missing: SULIT mark, examiner grid (print-era, low value), reference assets other than the one sheet (unverified). V3 adds "Pilih mod" (Mod Peperiksaan / Mod Latihan), which V2 does not have (D32). | P2 |
| B03 | Pintu masuk semula (more than 60 s into a running sitting): "Sambung Percubaan" page with "Masa berlalu setakat ini", buttons "Sambung — teruskan jawapan & masa sedia ada" and "Mula Semula — kosongkan jawapan & masa" ("Mula semula?" confirm). Sitting pinned in the session; a logout gives a blank sitting. | ✅ | `PaperCoverPage.vue` "Percubaan belum dihantar" with the same Sambung / Mula Semula copy and confirm; BE `GET papers/:paperId/in-progress`, `POST attempts/:id/abandon`. | P0 |
| B04 | Attempt page: whole paper rendered as printed sheets; page turner "← Sebelum", "Halaman X daripada Y", "Seterusnya →", last page "Hantar Jawapan" and "KERTAS PEPERIKSAAN TAMAT"; question map (dots per Bahagian, "pilih N"). | ⚠️ | `AttemptPage.vue`: one question per screen with `NavigatorPanel` map (right rail, sheet on mobile), shared Rajah pinned. This is the redesigned display (D28 c, D44), not a defect. No print-sheet look. | P1 (by design) |
| B05 | Bahagian with selection rule: "Jawab N daripada M" / choose_n (best-N scoring `ExamBestNScorer`), picks persisted, Jumlah uses the pilih-1 total. | ✅ | choose-N helpers in AttemptPage (`chooseCounterLine`, `chooseFullHint`); picks saved with the attempt. Best-N scoring on the server: unverified. | P0 |
| B06 | Document Bahagian (hybrid): page-image Kertas-2 paper with revealable scheme pages and one stepper per Bahagian (`semak-bahagian`); also the Kertas Subjektif lists `/kertas-subjektif`, `/kertas-subjektif/{paper}` (flag OFF in V2). | ❌ | No FE route or BE. D80 puts Kertas Subjektif behind one flag, OFF; D81 replaces page images with upload, OCR, sunting, terbit (admin pipeline D85). | P2 (flag OFF in V2) |
| B07 | Answer widgets, 14 modes: mcq, short_text, numeric, numbered_list, extended_essay, essay_choice, working_shown, graph_plot, draw_on_diagram, table_fill, sequence_order, code, gapped_text_match, cloze. | ⚠️ | `PartInput.vue` supports mcq, short_text, numeric, essay, working, drawing (photo upload, not drawing on the figure), match_letter (nearest gapped_text_match), plus the MathField keypad (V3 extra). Missing: numbered_list, essay_choice as a mode (only section choose-N), graph_plot, true draw_on_diagram, table_fill, sequence_order, code, cloze (multi-blank). See analysis/formats-authoring-gap.md. | P0 |
| B08 | Stimulus kinds, 15 (passage, box, table, diagram, graph, image, infographic, code, pseudocode, sql, math, audio, video, map, cartoon), 9 renderers. | ⚠️ | `StimulusView.vue`: passage, table, inline SVG diagram only. Missing: image file, infographic, cartoon, map, graph, box, code, audio, video. The BE bridge refuses image stimuli and option images (`bijak/question-bridge/be09-mapping.ts`). | P0 |
| B09 | Timer: timed paper counts down (`duration_minutes`), amber at 5 minutes, "Amaran: masa berbaki kurang 5 minit.", auto-submit at 0; untimed set counts up ("Masa berlalu"). | ✅ | `AttemptPage.vue` ("Masa berbaki" / "Masa berlalu", same warning copy, "Masa tamat" auto-submit). V3 is stronger: server deadline plus grace, sweeper, auto flag believed only near the deadline (`attempts.service.ts`). | P0 |
| B10 | Autosave: debounce 1 s `PATCH .../jawapan` {responses, flags, section_selections}, localStorage mirror, `sendBeacon` on leave; labels "menyimpan…", "disimpan", "gagal simpan", "luar talian". Server pre-fill on reload (cross-device). | ✅ | `lib/autosave.ts` (device first, then server `PUT attempts/:id/answers`). Exact save-state labels: unverified. | P0 |
| B11 | Flag for review and per-question dots (answered / flagged / skipped). | ✅ | `flags` ref in AttemptPage, `NavigatorPanel` states. | P1 |
| B12 | Hantar: confirm "Hantar jawapan anda sekarang?", posts answers with the submit, double-submit guard (a resubmit goes to Semakan). | ✅ | Hantar dialog in AttemptPage (same confirm sentence), BE `POST attempts/:id/submit`, pending-submit retry (`submitPending`). Idempotent resubmit: unverified. | P0 |
| B13 | Marking at submit: objective parts (single_key, accepted_values, mapping) auto-marked server-side; `mark_scheme_points` get a keyword suggestion that seeds the awarded mark (RubricKeywordMarker); band_rubric and model_answer stay pure self-mark. | ✅ done in base | Stale before 2026-10-31: `bijak/attempts/marking.ts`: server marking, statuses betul / separa / salah / kosong / belum_dimarkah. Whether a keyword suggestion seeds subjective marks: unverified (status "Belum dimarkah — perlu semakan" exists). **Done in base (H-A22 check, 2026-10-31): `keyword-suggest.ts` / `self-mark.ts` from R1-B12/B13/B15 (commit 4ba22af7, merge 100496c2); the suggestion is shown by `KeywordSuggestion.vue` (R1-F11, merge e8bd91d7). Spec evidence: `docs/qa/r1-backend-ac-coverage.md` AC-R1-07.1 to 07.4.** | P0 |
| B14 | Semakan (review): scheme revealed only after submit ("Skema Pemarkahan · N markah", correct option, accepted values, point list, model answer, band rubric), per-part ✓/✗, submitted score "x / max", status "Dihantar". | ✅ | `ResultPage.vue` + `PartResultCard.vue` (marks per section / question / marking point, ECF note, "Skema pemarkahan hanya dipaparkan selepas kertas dihantar"), win screen. | P0 |
| B15 | Self-mark ("honesty" stepper 0..N per part, `POST .../semak`; choosing a band defaults the stepper to the band midpoint; one stepper per document Bahagian `semak-bahagian`). Score label refreshes; recorded to practice. | ✅ done in base | Stale before 2026-10-31: No endpoint in the BE controller list and no stepper in `PartResultCard.vue`. Subjective parts stay "belum dimarkah", so scores of essay / working / structured parts are incomplete. **Done in base (H-A22 check, 2026-10-31): `POST bijak/attempts/:id/self-mark` (R1-B12, merge 100496c2) and the stepper `SelfMarkControl.vue` (R1-F11, merge e8bd91d7). The D94 self-mark reward is NOT in base (T38, `r1/t38-selfmark-reward`).** | P0 |
| B16 | "Cuba Lagi" button on Semakan (`POST /simulasi/{paper}/cuba-lagi`, fresh sitting); "Lihat semakan lepas" link on a new sitting. | ✅ done in base | Stale before 2026-10-31: Retry only via hub or cover ("Mula"); no "Cuba Lagi" button on the result page (the "Cuba lagi" in ResultPage is a load-error retry). Past results via `HistoryPage.vue` (`/spm/bijak/sejarah`). **Done in base (H-A22 check, 2026-10-31): `POST attempts/:id/retry` and `GET papers/:paperId/attempts` (R1-B15, merge 100496c2); "Cuba Lagi" on `ResultPage.vue` and `PastSittingsLink.vue` (R1-F11, merge e8bd91d7).** | P1 |
| B17 | Simulasi - Kuiz: `/simulasi/kuiz` (random canonical MCQ parts with stimulus, count 5/10/20/40, optional subject; server-checked `POST /simulasi/kuiz/semak`) and per-paper quiz `/simulasi/{paper}/kuiz` (MCQ parts paged by Bahagian). | ⚠️ API done in base; FE not in base | Stale before 2026-10-31: No FE route, no BE endpoint (activities-gap.md rows "Simulasi - Kuiz" and "Paper quiz view"). V3 Mod Latihan on a paper (untimed, "Semak" per question) is the nearest, but not a random quiz. **API done in base (H-A22 check, 2026-10-31): `bijak/kuiz` controller (R1-B16, merge 09f48585; follow-up `r1/b16-kuiz` unmerged). FE not in base: Kuiz pages are on `r1/hc8-kuiz-stimuli` (7ac922a7, contains `r1/f12-kuiz`).** | P1 |
| B18 | Records and rewards of a sitting: `PracticeRecorder` writes the session, feeds Prestasi, kombo, Syiling. | ⚠️ partly done in base | Stale before 2026-10-31: `bijak/integration/performance-bijak-aggregate.ts`, `practice-facts.ts` exist; reward (XP / syiling) award on submit: unverified. **Partly done in base (H-A22 check, 2026-10-31): wallet reward at submit, XP and streak (kombo) once per attempt (T28, merge 7ba5a589, BASE-11); Cuba Lagi earns per attempt (D93, second part). Not in base: the D94 self-mark reward (T38, `r1/t38-selfmark-reward`).** | P1 |
| B19 | Sejarah of attempts (`/spm/history`, `/pelajar/spm`). | ✅ | `HistoryPage.vue` `/spm/bijak/sejarah`, BE `GET bijak/history`; plus `/spm/history` (m06). | P1 |
| B20 | Content availability (serving whitelist = published papers only, approved questions). | ⚠️ | UAT has 0 papers / blueprints / stimuli / DSKP nodes. Nothing to sit until the pipeline publishes papers (D80: no copy of .cloud questions). | P0 |
| B21 | Random paper: V2 `/spm-mock` (K1 random MCQ, K2 structured) and the admin generator tool. | ✅ | D32: V3 "Jana Kertas" tab (`POST papers/generate`, under Kontrak Blueprint, shortage line) and `/spm-mock` page (m06, BE `spm-mocks`). | P0 |

V3-only additions in this area (not in V2, kept as is): Mod Latihan (instant feedback), photo answers (`attempts/:id/photos`), MathField keypad, win screen, Kontrak Blueprint.

## 2. Other in-scope Murid 1.0 features (full row)

| ID | V2 BM name and routes | Flag (V2) | What it does / outcome / content source | V3 status | V3 route and BE; real BE? | V2 usage | Priority |
|---|---|---|---|---|---|---|---|
| C01 | Dashboard: `/dashboard`, `/pelajar` (`StudentController@dashboard`), `POST /pelajar/mood` | none (ON) | Stats, subject counts, weak areas, recent questions, quick challenges, kombo streak and "Rekod Terbaik", teacher sets, articles, bank stats, daily mood check-in (gembira / okay / sedih / tertekan; sedih or tertekan raises a wellbeing alert). Content: system. | ⚠️ | FE `/dashboard` `DashboardPage.vue` (blocks incl. `HomeKombo`, `HomeQuests`); BE `GET /dashboard`. Real. Missing: mood check-in (no FE or BE for `mood` / `wellbeing/checkin`). | all students | P0 |
| C02 | Headcount: `/headcount`, `/headcount/student/{student}` (pelajar) | none | Teacher-created headcount; a student view of own result. | ⚠️ | FE `/headcount` built but hidden for student (`STUDENT_HIDDEN_IDS`; route refused for a pupil, FR-M08-08, observed on V1). V2 has a pelajar route `headcount/student/{student}`, so what V2 shows a pupil is unverified. BE `headcounts` real. | unknown | P2 |
| C03 | Prestasi: `/prestasi`, `/pelajar/prestasi` (flag prestasi) | prestasi (ON) | Own performance per subject (accuracy, sessions). | ✅ | FE `/prestasi` (`Prestasi360Page`); BE `performance/students/:userId`. Real. | all | P0 |
| C04 | Analitik Adaptif: `/pelajar/analitik`, `/analitik/pelajar` | none | Adaptive analytics for self. | ✅ | FE `/analitik/pelajar`; BE `GET analytics/me`. Real. | all | P1 |
| C05 | Analisa Item: `/analisa-item` (+ `kelas/{classroom}`) | none | Item analysis; V2 lists it among pelajar routes. | ⚠️ | FE route redirects a student to `/dashboard` (roles admin, teacher, school_admin); menu entry hidden for student (backlog "Not built for student"). What V2 shows a pupil: unverified. | unknown | P2 |
| C06 | Video: `/video`, `/video/{record}`, `POST /video`, `/video/tambah` redirect | video (ON) | Browse and search by subject, watch; a pelajar can submit a video. Content: users and admin. | ✅ | FE `/video`, `/video/:id`, `/video/tambah`, `/video/:id/edit` (m09); BE `@Controller('videos')`. Real. | unknown | P1 |
| C07 | Kelas Saya: `/kelas-saya` | none | Own classes, classmates ranked by syiling; join by code. | ✅ | FE `/kelas-saya`; BE `kelas-saya` (list, `join`). Real. | all | P1 |
| C08 | Soalan by Chapter: `/latih-tubi/bab`, `/latih-tubi/bab/{code}` | none | Practice by chapter; marks recorded as mode chapter (51 sessions, seeded timestamp). Content: system bank. | ⚠️ | FE `/practice/chapter...` (m05); BE `practice/chapter-subjects`, `practice/sessions`. Real. Served only through the MCQ bridge: published, active, ONE text-only MCQ leaf, no stimulus or option image (be09-practice-mapping.ts:27-39), so image and multi-part questions silently drop. Needs `chapterId` and curriculum (0 nodes on UAT). | 51 | P0 |
| C09 | Remedial: `/remedial/saya`, `/pelajar/remedial`, `/remedial/{record}` | remedial (ON) | Teacher-assigned remedial tests from the Command Center, then revision. | ⚠️ | FE `/remedial/saya`, `/remedial/:id`; BE `GET remedial-tests/mine`, `remedial-tests/:id`. Real. Same MCQ bridge gate (partial). | unknown | P1 |
| C10 | SPM hub: `/spm`, `/pelajar/spm`, `/spm/history` | none | Entry to Databank, Tracking A, Mock, Subjektif, Latih Tubi SPM, Bijak. | ✅ | FE `/spm` (`SpmHubPage`); BE `GET spm/overview`. Real. | all | P0 |
| C11 | Databank Soalan SPM: `/spm/tahun-lepas`, `/{code}/quiz`, `POST /spm/tahun-lepas/result` | none | Random 5/10/20 MCQs from the SPM pool; client-auto marking; mode `spm_tahun_lepas`. The most used activity in V2. | ⚠️ | FE `/spm/tahun-lepas(/:code/quiz)`; BE `spm/databank`. Real. Only `spmPool:true` questions appear; admin create hard-codes `spmPool:false` (questions.service.ts:592), so only migrated legacy MCQs show (406k loaded on UAT; the pool tag is written only by the loader). | **426 sessions** | P0 |
| C12 | Tracking A SPM: `/spm/ramalan`, `/spm/ramalan/{code}`, `/spm/tracking-a/{code}` | none | Fixed set per year and set number, shuffled options; mode `spm_ramalan`. Content: admin set editor. | ⚠️ | FE `/spm/ramalan(/:code)`; BE `spm/tracking-a(/:code)`. Real. `spm_tracking_sets` = 0 on UAT; the only writer is the seed (prisma/seed/spm.ts), no admin writer. | 18 | P1 |
| C13 | SPM Mock Exam Kertas 1: `/spm-mock`, `/spm-mock/kuiz`, `/spm-mock/{session}/result`, `POST /spm-mock/result` | none | Random MCQ (5/10/20/40), grade from accuracy. | ⚠️ | FE `/spm-mock`, `/spm-mock/:id(/result)`; BE `spm-mocks`. Real. Pool-tag issue as C11. | 26 | P1 |
| C14 | SPM Mock Exam Kertas 2: `/spm-mock/kertas2`, `POST /spm-mock/kertas2/result` | none | Structured questions, keyword marking. | ✅ | Same V3 mock pages; BE `markPaper2`; admin-created structured questions reach it. | (in 26) | P1 |
| C15 | Subjektif SPM: `/spm/subjektif` | none | Structured questions per subject (canonical K2 papers when the flag is ON). | ⚠️ | FE `/spm/subjektif`; BE `spm/subjektif` (counts only; answering = Latihan Berstruktur). Real. | unknown | P1 |
| C16 | Heatmap Topik Lemah: `/buku-nota/heatmap` | none | Weak-topic heatmap from own attempts by DSKP topic. | ⚠️ | FE `/buku-nota/heatmap` (`HeatmapTopikLemahPage`, m25); BE `GET buku-nota/heatmap`. Real. Needs curriculum nodes (0 on UAT), so it is empty there. | unknown | P1 |
| C17 | Permainan hub and games: `/permainan`, `/battle`, `/papan-bijak`, `/perang-fakta`, `/benteng-ilmu`, `/perlumbaan-matematik`, `/kuiz-relay`, `/betul-salah`, `/permainan/{slug}`, `api/battle/*` | permainan (OFF in V2) | Rooms of 2-4 with MCQ from the bank, battle 1v1 / school; coins on win. Small V2 usage. | ✅ | FE `/permainan`, `/battle*`, per-game lobby and room routes (m16 `lobbies.ts`), solo games; BE `battle/*`, `games/:game/*`, `games/solo/*`. Real. Flag: D80 makes it visible at go-live. V3 adds games not in V2 (Jutawan, Roda Nasib, Sambung Kata, Uji Minda, Pertandingan, Kad Memori, Cabaran Kilat, Tembak / Susun Jawapan). Games draw from the MCQ bridge. | battle 48, games 3, rooms 2 | P1 |
| C18 | Teka Silang Kata: `/teka-silang-kata` | permainan (OFF) | Crossword built from questions; submit-word. | ⚠️ | FE `/teka-silang-kata`; BE generic `games/:game/rooms`. Only MCQ answers of 20 characters or fewer (rooms.service.ts:553-555). | tiny | P2 |
| C19 | Laporan Soalan: `/laporan-soalan` | none | Own question reports with statuses Menunggu / Disemak / Diperbaiki / Ditolak (corrected 2026-10-31 from "baru"). Content: student. | ✅ | FE `/laporan-soalan` (m04); BE `question-reports` (`mine`, `POST`). Real. | `question_reports` = 0 | P2 |
| C20 | Profil Saya: `/profile`, `/pelajar/profil`, `POST /profile` | none | View and edit own profile and picture; public profile `/pelajar/{id}`. | ✅ | FE `/profile`, `/profile/edit`, `/pelajar/:id`; BE `GET/PUT me`, `POST me/picture`. Real. | all | P1 |
| C21 | Tetapan Peribadi: `/tetapan` | none | Settings (password etc). | ✅ | FE `/tetapan`; BE `me/settings`, `me/password`. Real. | all | P1 |
| C22 | Panduan: `/panduan`, `/pusat-tuisyen/panduan` | panduan (ON) | Help guide, static content. | ✅ | FE `/panduan`, `/pusat-tuisyen/panduan` (m09, `panduan-content.ts`). Static or BE-served: unverified. | all | P2 |
| C23 | Log Keluar: `POST /logout` | none | Ends the session. | ✅ | FE `/logout`; BE `POST auth/logout`. Real. | all | P0 |

## 3. KIV (out of current scope), one row each

Status for all rows below: **KIV (out of current scope)**. The V3 hint is only a pointer for a later round and was not assessed in depth.

| Feature (V2 BM name, route) | V2 flag | V3 hint |
|---|---|---|
| Latih Tubi `/practice`, `/latih-tubi/{code}` (50 sessions) | latih-tubi OFF | Built (`/practice`, BE `practice/sessions`); random mode limited to T4/T5 (rules.ts:43); D80 visible at go-live. Matters for T1-T3 pupils. |
| Latih Tubi SPM `/spm/latih-tubi` | none | Built; pool-tag dependent. |
| Soalan Berstruktur / Latihan Berstruktur `/latihan-berstruktur` | none | Built (BE `practice/structured`). |
| Soalan Aku Salah `/practice/revision` (94 sessions) | none | Built (BE `practice/revision`). |
| Set Soalan Guru `/set-soalan-saya` | none | Built (BE `set-soalan-saya`). |
| Misi Harian `/misi-harian`, `/pelajar/misi` | misi-harian | Built (BE `missions/today`). |
| Target SPM `/target-spm` | target-spm | Built (BE `spm-targets`). |
| Pembetulan `/pembetulan` | none | BE `practice/corrections` exists; no FE page (nav hidden, M26). |
| Penguasaan `/penguasaan` | none | BE `practice/mastery` exists; no FE page. |
| Peta Belajar `/peta-belajar`, Topik `/topics` | none | Built (BE `learning-map`, `topics`). |
| PKSK `/pksk` | none | Built (BE `pksk/*`). |
| Artikel `/artikel` | none | Built (BE `articles`). |
| Audio KBAT `/audio-kbat`, Cikgu Suara `/cikgu-suara` | none | Audio KBAT built (BE `audio-kbat-sets`); Cikgu Suara has no FE. |
| Buku Nota `/buku-nota`, Pusat Nota Ringkas `/pusat-nota-ringkas` | none | No FE (only the heatmap is built). |
| Pusat Ilmu Sekolah `/pusat-ilmu-sekolah`, Pusat Kerjaya `/pusat-kerjaya` | none | Missing (M26). |
| Cita-Cita `/cita-cita`, Universiti, Biasiswa, Psikometrik (0 results in V2), Profil Cerah | ON | Missing (hidden "belum dibina", M26). |
| Kombo `/kombo`, Streak | kombo | Home widget only; no page. |
| Syiling and Token, Tukar Token, Cabaran Harian, Kedai Hadiah, Papan Pendahulu, Pencapaian, Kotak Misteri, Rujuk Kawan (`/gamification/*`) | none | Built (BE `gamification/*`, `shop`). |
| Kedai Hadiah Digital `/cikgu/hadiah` | none | Built (BE `shop`). |
| Marketplace `/marketplace` | none | Built (BE `marketplace`). |
| Cabutan Bertuah `/cabutan` | none | Built (BE `cabutan`). |
| Kedudukan `/ranking`, Leaderboard | leaderboard | Built (BE `rankings`, `leaderboard`). |
| Tournament / Liga `/tournament`, `/liga` | none | Tournament built; Liga route hidden. |
| Sekolah Bersaing `/sekolah-bersaing` | none | Built (BE `sekolah-bersaing`). |
| Timeline Saya `/timeline` | none | Built (BE `timeline`). |
| Sejarah `/practice/history`, Kemajuan `/practice/progress` | sejarah, kemajuan ON | Built (BE `practice/history`, `progress`). |
| Laporan Mingguan `/pelajar/laporan`, `/pelajar/laporan/{week}` | none | Student entry hidden; BE `weekly-report` exists. |
| Notifikasi `/notifikasi` (+ read, bulk) | none | BE `me/notifications` exists; the FE route file is empty (the bell links to a missing page). |
| Wellbeing: `/wellbeing/mood-saya`, `POST /wellbeing/checkin` | none | Missing (no FE or BE). |
| Chatbot, Pusat AI (`/pusat-ai/{tool}`: kamus, aktiviti, pendamping, doa, whiteboard), Cikgu Alesa `/cikgu` | none | Hidden by D73 (`VITE_ALESA_AI`); the tools are not built. |
| Perutusan `/perutusan` | perutusan ON | BE `perutusan` exists; FE route file empty. |
| Tiket `/tiket`, `/pusat-tuisyen/tiket` | tiket ON | Built (`/pusat-tuisyen/tiket`, BE `tiket`). |
| Jemput Ibu Bapa `/jemput-ibu-bapa`, `/ibu-bapa/terima/{token}` | none | Built (BE `parents`). |
| Mohon Keluarga Angkat | none | Hidden, D74 (`VITE_KELUARGA_ANGKAT`). |
| Bilik Duta, Akademi Duta, Kem, Jemput Duta | none | Not built (M24); only the SPM Duta block. |
| Kertas Subjektif `/kertas-subjektif` | kertas-subjektif OFF | Not built; D80 and D81 plan it behind a flag, OFF. |
| Billing `/billing/invoices`, Google login, mobile API `api/v1/*` | none | Billing not built (M19); Google login and `api/v1` not seen in V3 (unverified). |

## 4. Counts per status

Detailed rows only (Bijak 21 + other in-scope 23 = 44 rows). Bijak column updated 2026-10-31 for B13, B15, B16 (now ✅) and B17 (❌ to ⚠️, FE not in base); the 2026-10-30 figures were 10 / 8 / 3:

| Status | Bijak SPM / Simulasi (B01-B21) | Other in-scope (C01-C23) | Total |
|---|---|---|---|
| ✅ rebuilt and displayed | 13 | 12 | 25 |
| ⚠️ partial | 7 | 11 | 18 |
| ❌ missing | 1 | 0 | 1 |
| 🚫 dropped by decision | 0 | 0 | 0 |
| 🔒 built but hidden | 0 | 0 | 0 |
| KIV (section 3) | | | 37 rows |

Hidden-by-flag items such as ALESA, Keluarga Angkat and Kertas Subjektif sit in the KIV rows.

## 5. Top 15 gaps (Bijak SPM first)

| # | Gap | What must be built and where | Basis |
|---|---|---|---|
| 1 | B15 Self-mark (per part, band rubric, per Bahagian) is missing (done in base since 2026-10-31 except per-Bahagian, see row B15) | BE: new endpoint `POST bijak/attempts/:id/self-mark` (clamp 0..part.marks, recompute score, record to performance) in `apps/api/src/modules/bijak/attempts`; FE: stepper and band picker in `PartResultCard.vue` / `ResultPage.vue`, refresh the score ring. | Subjective parts never get a mark; Simulasi has 283 attempts and rising |
| 2 | B20 No servable content (0 papers, 0 DSKP nodes on UAT) | Load the DSKP curriculum, then build and publish papers through the D85 pipeline (or enable the PoC set) so Kertas Pilihan is not empty. | Nothing in B01-B21 can be seen working without it |
| 3 | B07 Missing answer widgets: numbered_list, table_fill, cloze (multi-blank), sequence_order, graph_plot, true draw_on_diagram, code, essay_choice mode | FE `m28-bijak-spm/components/PartInput.vue` widgets; BE `bijak/question-bridge/be09-mapping.ts` stops refusing table_fill and multi-blank short_text; marking in `attempts/marking.ts`. Order by SPM need: numbered_list, table_fill, cloze, graph_plot. | formats-authoring-gap.md |
| 4 | B08 Missing stimulus kinds: image file, infographic, cartoon, map, graph, box, code, audio, video | FE `StimulusView.vue` renderers; BE bridge must accept image stimuli (be09-mapping.ts:210-218). Depends on the v2 image upload (D80 item 3). | Figure-based SPM questions fail closed |
| 5 | C11 Databank pool is never fed by admin-created questions | BE `questions.service.ts:592` (`spmPool:false` on create) and repository: set the SPM pool tag from the intake / approval path. | Databank is the most used activity (426 sessions) |
| 6 | C08/C09 MCQ-bridge gate drops richer questions (Chapter, Remedial, games) | BE `practice/question-bridge/be09-practice-mapping.ts:27-39`: allow stimulus, multi-part and option images; align T1-T5 (rules.ts:43 limits random mode to T4/T5). | 51 chapter sessions; D72 scope is T1-T5 |
| 7 | B17 Simulasi - Kuiz (random MCQ with stimulus, per-paper quiz) | FE new pages under m28 or m06; BE `GET bijak/quiz`, `POST bijak/quiz/check` (server-side check, answers not sent to the client). | V2 route pair `simulasi/kuiz`, `simulasi/{paper}/kuiz` |
| 8 | B13 Keyword suggestion for mark_scheme_points | BE `attempts/marking.ts`: keyword matcher that seeds awarded marks; verify first (unverified). | V2 fix for "tetap 0 markah" |
| 9 | B16 "Cuba Lagi" and "Lihat semakan lepas" | FE `ResultPage.vue` button (new attempt via `POST attempts`), link from a fresh cover to the last result. | Teacher complaint "tak boleh cuba semula" |
| 10 | C12 Tracking A has no admin writer | BE admin endpoint plus FE editor for `spm_tracking_sets` (Portal Pentadbiran); remove the seed-only dependency. | 18 sessions; 0 sets on UAT |
| 11 | C13 Mock K1 and C15 Subjektif pool dependence | BE `spm/mocks` `poolFilter spmPool` (pool.service.ts:19) plus the same fix as gap 5. | 26 mock sessions |
| 12 | C16 Heatmap Topik Lemah is empty | Same curriculum load as gap 2 (`question_version_sp_nodes`); BE `heatmap` reads DSKP tags. | Murid 1.0 item |
| 13 | C01 Dashboard mood check-in | FE widget in `DashboardPage`; BE endpoint for mood check-ins (gembira / okay / sedih / tertekan) and a wellbeing alert for sedih / tertekan. | V2 `POST pelajar/mood` |
| 14 | B18 Rewards and records of a Bijak sitting | Verify and wire submit to XP / syiling and Prestasi aggregates (`bijak/integration/*`, `gamification`). | unverified |
| 15 | B02/B04/B06 Fidelity items | Cover: SULIT, examiner grid, other reference assets (P2); document Bahagian / Kertas Subjektif behind a flag (D80, D81; flag OFF in V2). | low usage |

## 6. Unverified items

- Response shapes between FE api modules and Nest controllers (only paths were compared).
- B05 best-N scoring on the server; B10 exact save-state labels; B12 idempotent resubmit; B13 keyword suggestion; B18 reward award on submit.
- C02 / C05: what V2 shows a pupil on `headcount` and `analisa-item` (V1 shows 403 / redirect; V3 hides them).
- C22 Panduan: whether content is served from the BE or static.
- Production counts for most KIV features (no usage data supplied for `kemajuan`, `video`, `universiti`; `psychometric_results` = 0, `question_reports` = 0).
- Whether the page-image Kertas-2 document flow exists in production papers (flag `kertas-subjektif` OFF).
- V2 `/practice*` and `/latih-tubi*` carry the OFF flag, yet 50 sessions exist from Jun-Jul (timing of the flag change unknown).
- Whether any in-scope V3 page works only in mock mode: all in-scope rows use `/api/...` paths that a controller serves, but no runtime check was done.
