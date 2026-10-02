# M03 — Curriculum (Subjects, Levels, Topics) — Software Requirements Specification

## 0. Document control

| Field | Value |
|---|---|
| Document | SRS — M03 Curriculum (Subjects, Levels, Topics) |
| Version | 1.10 |
| Date | 2026-09-25 |
| Status | Approved (G1) |
| Authors | product-analyst (functional: §1–5, §8–10, §12–13) · solution-architect (data entities & mock API: §6–7, NFR §11) |
| Source URS | [urs/M03-curriculum.md](../urs/M03-curriculum.md) (v1.10: 6 epics, 17 features, 138 Functions, 31 stories, 121 ACs, coverage 807/807) |
| Audit | [qa/audit/M03-audit.md](../../qa/audit/M03-audit.md) (round 1: FAIL; all findings addressed in v1.1) |
| Source discovery | [M03-curriculum.md](../../discovery/M03-curriculum.md), [inventory/M03/](../../discovery/inventory/M03/) (incl. `_curriculum-data.json`), [00-global-ui.md](../../discovery/00-global-ui.md) |
| Related | [srs/M01-authentication.md](M01-authentication.md) v1.5 (User `grade` 1–11, seed accounts incl. canonical id 4 `pelajarmaju`, mock helpers), [srs/M02-users-schools.md](M02-users-schools.md) v1.2 (`classLevel` D1–T5, school types, BR-21), [srs/M04-question-bank.md](M04-question-bank.md) v1.1 (question dataset, D11), [srs/M05-practice.md](M05-practice.md) v1.1 (answer log DATA-M05-02, D12), [design/shells.md](../../design/shells.md) (DV-SH-03) |

**Change log**

| Version | Date | Change |
|---|---|---|
| 1.10 | 2026-09-27 | **Revision history — v1.10, XL batch 3** (`docs/qa/audit/cross-module-logic-M12-M18.md` XL3-24, M17 XR-M17-19): 60 out-of-tree chapters added as records with `inTree = false` (Pendidikan Muzik 56, Pendidikan Syariah Islamiah 3, Sains Rumah Tangga 1; ids 1282–1341; only `subjectId` observed, other fields designed; no titles) — DATA-M03-03 `inTree`, BR-06, §6.9, §6.10 (alternatives recorded; tree total 1,251 unchanged), §6.11 new CH-ALL-INCL-ORPHAN 1,311 and CH-SUBJECT-INCL-ORPHAN, CH-* restricted to the tree, chapter runtime floor 1342, E2E-51. Status Approved (G1) kept. |
| 1.9 | 2026-09-27 | **Revision history — v1.9, F-24 build alignment**: new §6.11 Named queries (LVL-, SUBJ-, LINK-, CH-, TP-, ST-, LT-, LS- with expected values; M06 "Subjek SPM" = LINK-LEVELS([10, 11]) distinct subjects = 25). The "Bab Tidak Aktif Demo" chapter and topic are test-only, behind the seed override `curriculumInactiveDemo: true` (off by default; E2E-06 sets it in `mockInit`). Runtime id floors recorded (chapter 1282, topic 2424, subtopic 235, subject 32, level 12; chapter ids 1250–1279 unused). Subtopics 133 and 134 added to the keep-live-id set (ids observed as form actions in the discovery capture; 38 named records). #28: an invalid `educationLevelId` is ignored, no error (INFERRED). Status Approved (G1) kept. |
| 1.8 | 2026-09-26 | **Revision history — v1.8, XL batch 2** (`docs/qa/audit/cross-module-logic-M08-M11.md`, XL2-17): the chapters observed in the M10 chapter selects keep their live ids — Perniagaan T5 258–262, 1280 and 1281 (the M10 DV-M10-05 preload), Bahasa Melayu T5 413, Sains T5 347 and 362–369 (§6 intro, §6.9 anchor list (c), §6.10). 36 named tree records in total; chapter total unchanged at 1,251; no other id renumbered; M11 chapter labels stay outside M03 (M04 XL2-16). No other Minor is assigned to M03. Status Approved (G1) kept. |
| 1.7 | 2026-09-25 | **Revision history — v1.7, XL round 3** (XL-36): every "Soalan" count now names its query, M04 SRS §4.1 Q-ACTIVE(subject) / Q-ACTIVE(level) (FR-40, FR-58, FR-98, BR-12, §6.1/6.2, §6.10, E2E-21/30/51). Values unchanged. Status Approved (G1) kept. |
| 1.6 | 2026-09-25 | **Revision history — v1.6, architecture alignment** (overview §6.6, ADR-0013): new §6.10 Dataset spec for the 8 curriculum stores (levels, subjects, subject × level links, chapters, topics, subtopics, catalogue topics and catalogue subtopics) — total, count-relevant fields, observed counts with source, id range, anchors, D9 values; all are small seeded (materialised) sets, not virtual datasets; the 194 links are the allowed combinations for the M04 question dataset. No requirement changed. Status Approved (G1) kept. |
| 1.5 | 2026-09-25 | **Revision history — v1.5, cross-module logic review** (`docs/qa/audit/cross-module-logic-M01-M07.md`; decisions D11, D12). XL-02: "Soalan" counts are always computed from the M04 D11 question dataset; the seeded live counts are removed (FR-98, §6.9, E2E-21/30/51). XL-14: `pelajarmaju` is the canonical M01 account id 4, grade 1 (§6.9). XL-17: DATA-M03-07 is now derived on read from the M05 answer log (DATA-M05-02, owner M05 per D12) with the INFERRED chapter mapping, progress formula and 80 % threshold (BR-14, new BR-19); `mock.setProgress` and the separate progress seed removed; pelajarmaju states come from the M05 answer-log anchors M1–M4 (E2E-39/47). XL-20: DV-M03-04 confirmed as an instance of shell rule DV-SH-03 (FR-80). XL-23: `Subject.usedCount` noted as derived by M05. XL-25: cross-references refreshed (Related, §1). Status Approved (G1) kept. |
| 1.4 | 2026-09-25 | **Revision history — v1.4, M05 alignment** (M05 OQ-13c): the chapters observed on the M05 chapter pages keep their live ids — 1, 3, 18, 57, 120, 142, 164, 179, 263, 325 (35 was already kept); §6 intro and §6.9 list them with the other named records (19 in total). Nothing else renumbered. |
| 1.3 | 2026-09-25 | **Revision history — v1.3, round-2 audit Minor findings** (`docs/qa/audit/M03-audit.md` round 2: PASS). R2-22: id wording corrected — only subjects, levels, catalogue topics and the 9 named tree records keep live ids; other tree ids are sequential seed ids (§6 intro, §6.9, v1.2 line). R2-23: DV-06(b) covers text only; decorative icons keep their live size (FR-99). R2-24: the ≥12 px rule is limited to M03 content inside `main`; the global shell is M23 (FR-99, E2E-52). R2-25: §10 S13 row "text ≥12 px (DV-M03-06b)". |
| 1.2 | 2026-09-25 | **Revision history — v1.2, integer-id alignment** (M04 audit): subjects, levels, chapters, topics, subtopics and catalogue topics use integer ids (SRS §6 intro, DATA-M03-01…07, §6.9 id rule; §7 shapes follow the entities): subjects 1–31, levels 1–11 and catalogue topics 1–125 keep their live ids, plus the 9 named tree records; all other chapter, topic and subtopic ids are sequential seed ids that do not match live; codes (MATH, D1, DARJAH_1, MATEMATIK) stay separate string fields; the `GET /api/subjects` / `GET /api/education-levels` contracts and `isCore` are unchanged for M04/M05. DV-M03-06(b) confirmed by the Delivery Lead. |
| 1.1 | 2026-09-25 | **Revision history — v1.1, audit fixes** (`docs/qa/audit/M03-audit.md`) and D10. AUD-01: subtopic "Batal" only hides, typed text persists (FR-17, FR-20, E2E-11/12). AUD-02: level checkboxes single-column 256 px scroll box (FR-52, §10, E2E-27). AUD-03: form buttons inline at every width (FR-99, §10, E2E-52). AUD-04: observed pill colours (§6.8, FR-82, E2E-43; Q1 closed). AUD-05: hero label = pill label (FR-81, BR-15). AUD-06: Darjah 1–4 + fallback replicated, DV-08 reduced to removing the Geografi pill, "📚" icons and learner default removed (FR-82–84, BR-15, §6.6, §6.9, §7 #27, E2E-43–45/47/51). AUD-07: DV-02 withdrawn, live chips (FR-70/71, E2E-35/36). AUD-08: no reduced-motion handling (FR-85, NFR-05, E2E-42). AUD-09: "Topik tidak dijumpai." OBSERVED (FR-38, BR-18, §8, E2E-13). AUD-10: all practice codes OBSERVED (BR-16, FR-78, E2E-40). AUD-11: S6 below 640 px (FR-40, §10, E2E-21). AUD-12: "CTH: MATH01"/"CTH: Y1" (FR-48, FR-64). AUD-13: S9–S11 pink accent, S9 fixed sizes (FR-57/58/64, NFR-06). AUD-14: S2 back link keeps the received query (FR-25, E2E-15). AUD-15: S1 tree breakpoint `sm` (FR-24, §10). AUD-16: static bar (FR-81, E2E-41). AUD-17: case-insensitive filters, no active chip for non-canonical values (FR-70–72, BR-13, E2E-36). AUD-18: captured subtopic names and descriptions in the seed (§6.9). AUD-19: S13 clamp and icon colours (FR-76/77). AUD-20: ≥12 px text on every M03 screen (DV-06b, FR-99). AUD-21: INFERRED tags (FR-02, BR-08, FR-58). |
| 1.0 | 2026-09-25 | First issue under D7/D8/D9. FRs trace to Functions and stories; every FN has ≥1 FR, every AC and FR has ≥1 E2E (script-checked, §3.1). The only intended differences from live are DV-M03-01…09 (URS §7). |

**Tags:** **OBSERVED** · **INFERRED** (most likely live behaviour; Laravel defaults where they apply) · **UNVERIFIED COPY** (text not captured; placeholder in §8 until verified, URS OQ-1) · **DV-M03-nn** (fidelity deviation, URS §7) · **SEC-M03-nn** (security note for the backend phase, NFR-M03-04).

### 0.1 Fidelity deviations referenced here

Approved under user rule D9 (fix broken or contradictory, replicate what works); specified as the behaviour in this SRS:
- DV-M03-01 subject icons resolved by format and rendered with Lucide / emoji (FR-M03-41, BR-05);
- DV-M03-02 — withdrawn (S12 chips replicate live, FR-M03-70, 71);
- DV-M03-03 S6 table fits at ≥1280 (FR-M03-46, §10);
- DV-M03-04 S14 header "Peta Belajar" (FR-M03-80);
- DV-M03-05 chapter/topic sort by number (FR-M03-11, BR-08);
- DV-M03-06 (a) S1 names wrap (FR-M03-24); (b) no text below 12 px on any M03 screen (FR-M03-99);
- DV-M03-07 S6 switch reverts and alerts on failure like S9 (FR-M03-42);
- DV-M03-08 S14 "🌍 Geografi" pill not rendered (FR-M03-82, BR-15); Darjah 1–4 and the fallback to Darjah 4 replicate live;
- DV-M03-09 seed data: renumber import-id chapter numbers and repeated topic numbers (§6.9).
- DV-M03-10 (M03-T2 build) S9 cell padding is `px-3` instead of the live `px-4` (text sizes stay `text-xs`): with the app font the live `px-4` table measures about 1013 px and overflows its card (971 px) at 1280, which FR-M03-46 forbids; `px-3` brings it to about 930 px so it fits from 1280 and still scrolls inside the card below.
- DV-M03-11 (M03-T3 build) S1 touch-width controls are raised to 44 px: the chapter/topic chevrons, the edit and delete icon buttons (chapter, topic, subtopic), "Tambah Topik", "Tambah Subtopik" and the inline form buttons are at least 44 px high (icon buttons 44 x 44) below `lg`; from `lg` the icon buttons and the two add links shrink to 32 px (the live size). Consistent with M02 and FR-M03-99 / NFR-RESP-03.

---

## 1. Scope

**In scope:** every Function FN-M03-1.1.1 … FN-M03-6.3.5 in URS §3: screens S1–S14, the M03 entries of the admin and user shells, the curriculum lookups other modules use, the mock endpoints (§7) and the seed data (§6.9) that make every flow clickable end to end, and the documented inferred server rules for the later backend (D5).

**Out of scope:** URS §8 — practice sessions (M05), the practice answer log (M05, D12; M03 derives topic progress from it on read, BR-19), the question bank and its counts' source (M04), the tournament banner (M16), maintenance screens for the student catalogue (none exist), the rest of both shells (global / M22 / M23), and real persistence.

## 2. Screens & routes

| # | Route | Screen | Actor | Shell | Shell header (title / subtitle) | Tab title (exact) |
|---|---|---|---|---|---|---|
| S1 | `/admin/curriculum` (`?subject_id=&education_level_id=`) | Curriculum browser & tree | Admin | Admin | "Pengurusan Kurikulum" / "Urus struktur kurikulum (Bab → Topik → Subtopik)" | "Pengurusan Kurikulum - Admin PRESTASIPLUS" |
| S2 | `/admin/curriculum/chapters/create` (`?subject_id=&education_level_id=`) | Create chapter | Admin | Admin | "Tambah Bab Baru" / "Cipta bab baharu dalam kurikulum" | "Tambah Bab - Admin PRESTASIPLUS" |
| S3 | `/admin/curriculum/chapters/:id/edit` | Edit chapter | Admin | Admin | "Edit Bab" / "Kemaskini maklumat bab" | "Edit Bab - Admin PRESTASIPLUS" |
| S4 | `/admin/curriculum/topics/create?chapter_id=:id` | Create topic | Admin | Admin | "Tambah Topik Baru" / "Cipta topik baharu dalam bab" | "Tambah Topik - Admin PRESTASIPLUS" |
| S5 | `/admin/curriculum/topics/:id/edit` | Edit topic | Admin | Admin | "Edit Topik" / "Kemaskini maklumat topik" | "Edit Topik - Admin PRESTASIPLUS" |
| S6 | `/admin/subjects` | Subject list | Admin | Admin | "Pengurusan Subjek" / "Urus subjek pembelajaran dalam sistem" | "Pengurusan Subjek - Admin PRESTASIPLUS" |
| S7 | `/admin/subjects/create` | Create subject | Admin | Admin | "Tambah Subjek Baru" / "Cipta subjek pembelajaran baharu" | "Tambah Subjek - Admin PRESTASIPLUS" |
| S8 | `/admin/subjects/:id/edit` | Edit subject | Admin | Admin | "Edit Subjek" / "Kemaskini maklumat subjek" | "Edit Subjek - Admin PRESTASIPLUS" |
| S9 | `/admin/education-levels` | Level list | Admin | Admin | "Pengurusan Tahap Pendidikan" / "Urus tahap pendidikan dalam sistem" | "Pengurusan Tahap Pendidikan - Admin PRESTASIPLUS" |
| S10 | `/admin/education-levels/create` | Create level | Admin | Admin | "Tambah Tahap Pendidikan" / "Cipta tahap pendidikan baharu" | "Tambah Tahap Pendidikan - Admin PRESTASIPLUS" |
| S11 | `/admin/education-levels/:id/edit` | Edit level | Admin | Admin | "Edit Tahap Pendidikan" / "Kemaskini maklumat tahap pendidikan" | "Edit Tahap Pendidikan - Admin PRESTASIPLUS" |
| S12 | `/topics` (`?grade_level=&subject=`) | Topic catalogue | Student (any session) | User portal | "Topik Pembelajaran" / "Terokai semua topik pembelajaran" | "Topik - PRESTASIPLUS" |
| S13 | `/topics/:id` | Topic detail | Student | User portal | "{topic name}" / "{SUBJECT LABEL}" | "{topic name} - PRESTASIPLUS" |
| S14 | `/peta-belajar` (`?subject=&grade=`) | Learning map | Student | User portal | "Peta Belajar" / (none) — DV-M03-04 | "Peta Belajar — PRESTASIPLUS" |

Page URLs keep the live query names (`subject_id`, `education_level_id`, `chapter_id`, `grade_level`, `subject`, `grade`) so bookmarked links work unchanged. Admin "not found" cases redirect (§4 BR-18); `/topics/:id` unknown → the global 404 page.

## 3. Functional requirements

| ID | Requirement | FN | US |
|---|---|---|---|
| FR-M03-01 | S1 SHALL render in the admin shell with the header and tab title of §2. | 1.1.1 | 01 |
| FR-M03-02 | S1 SHALL show the filter card "Tapis Kurikulum" (`fa-filter`) with "Subjek" (`subject_id`: "" "-- Pilih Subjek --" + every subject ordered by id, label = `name`, value = id; whether inactive subjects are listed is INFERRED — listed, URS OQ-8), "Tahap" (`education_level_id`: "" "-- Pilih Tahap --" + every level by `order`, label = `name`) and the submit "Tapis" (`fa-search`). Grid 2 columns (button spans 2) below `md`, 3 columns from `md`. The two selects are independent (no cross-filtering). | 1.1.2 | 01 |
| FR-M03-03 | Submitting the filter SHALL navigate to `/admin/curriculum?subject_id={s}&education_level_id={l}` (empty values sent as empty parameters, as a GET form); on load the selects are initialised from the URL and, when both are present, the tree is fetched with `GET /api/admin/curriculum` (§7 #13). | 1.1.2 | 01 |
| FR-M03-04 | When either parameter is missing or empty, S1 SHALL show only the prompt card (`fa-info-circle`, "Sila pilih subjek dan tahap pendidikan", "Gunakan penapis di atas") below the filter, with no request for the tree. | 1.1.3 | 01 |
| FR-M03-05 | With both parameters, S1 SHALL show 4 summary cards (2 across below `md`, 4 from `md`): "Subjek" (blue, `fa-book`) subject name; "Tahap" (purple, `fa-graduation-cap`) level name; "Jumlah Bab" (emerald, `fa-book-open`) chapter count; "Topik / Subtopik" (amber, `fa-list`) "{topics} / {subtopics}". Counts include inactive records (BR-06). | 1.1.4 | 01 |
| FR-M03-06 | S1 SHALL show the button "Tambah Bab" (`fa-plus`) linking to `/admin/curriculum/chapters/create?subject_id={s}&education_level_id={l}`. | 1.1.5 | 02 |
| FR-M03-07 | When the pair has no chapters, the tree card SHALL show `fa-inbox`, "Tiada bab dijumpai untuk subjek dan tahap ini." and the link "Tambah Bab Pertama" (`fa-plus`, same URL as FR-06). This also applies to a pair that is not linked on S6/S8, with no warning (BR-04). | 1.1.6 | 02 |
| FR-M03-08 | Each chapter block SHALL have an indigo left border, a chevron button (`fa-chevron-down` when open, `fa-chevron-right` when closed; open by default, state per block, not persisted), `fa-book-open`, the heading "Bab {chapterNumber}: {name}" (when `chapterNumber` is null: "Bab : {name}", as the live template prints an empty number — INFERRED) and the description line when not empty. The chevron shows/hides the chapter's topic list and its "Tambah Topik" link. | 1.1.7 | 01 |
| FR-M03-09 | Each chapter block SHALL have the edit link (`fa-edit`, `title="Edit Bab"`) → `/admin/curriculum/chapters/{id}/edit`. | 1.1.8 | 07 |
| FR-M03-10 | Each chapter block SHALL have the delete button (`fa-trash`, `title="Padam Bab"`). Pressing it SHALL open the native confirm "Adakah anda pasti mahu padam bab ini?"; cancel → nothing; OK → `DELETE /api/admin/curriculum/chapters/{id}` (§7 #17), then reload the same tree with the success flash (§8, UNVERIFIED COPY). The chapter's topics and subtopics are deleted with it (BR-10). | 1.1.9, 1.1.20 | 03 |
| FR-M03-11 | Chapters SHALL be listed by `chapterNumber` ascending (numeric; null last), then `createdSeq`; topics by `topicNumber` in natural order (BR-08; null last), then `createdSeq`; subtopics by `createdSeq` (DV-M03-05). | 1.1.10, 1.1.11 | 01 |
| FR-M03-12 | Each topic row (indented under its chapter) SHALL have a chevron (`fa-chevron-right` when closed, `fa-chevron-down` when open; closed by default), `fa-list` (purple), the heading "Topik {topicNumber}: {name}" and the description line when not empty. The chevron shows/hides the topic's subtopic area (list, "Tambah Subtopik" toggle and add form). | 1.1.11 | 01 |
| FR-M03-13 | Each topic row SHALL have the edit link (`fa-edit`, `title="Edit Topik"`) → `/admin/curriculum/topics/{id}/edit`. | 1.1.12 | 09 |
| FR-M03-14 | Each topic row SHALL have the delete button (`fa-trash`, `title="Padam Topik"`), confirm "Adakah anda pasti mahu padam topik ini?"; OK → `DELETE /api/admin/curriculum/topics/{id}` (§7 #21) → reload the tree with the success flash; its subtopics are deleted (BR-10). | 1.1.13, 1.1.20 | 03 |
| FR-M03-15 | After each chapter's topics, S1 SHALL show the link "Tambah Topik" (`fa-plus`) → `/admin/curriculum/topics/create?chapter_id={id}`, also when the chapter has no topics. | 1.1.14 | 02 |
| FR-M03-16 | An open topic SHALL list its subtopics, one row each with `fa-chevron-right`, the name, the edit button and the delete button; with none it SHALL show "Tiada subtopik" (italic). | 1.1.15 | 01, 04 |
| FR-M03-17 | The subtopic edit button (`fa-edit`, `title="Edit Subtopik"`) SHALL replace that row with an inline purple form: `name` (required, placeholder "Nama Subtopik (BM)", pre-filled), `nameEn` ("Nama Subtopik (EN)"), `learningObjective` (textarea, 2 rows, "Objektif Pembelajaran"), buttons "Simpan" (`fa-save`, submit) and "Batal" (type button). "Batal" SHALL only hide the form (`editingSubtopic = null`): the row shows the stored name again, but the inputs are not reset, so reopening the form before a page reload shows the text typed earlier (OBSERVED). At most one subtopic per topic is in edit mode: opening another closes the first (state `editingSubtopic` per topic). | 1.1.16 | 04 |
| FR-M03-18 | "Simpan" SHALL send `PUT /api/admin/curriculum/subtopics/{id}` (§7 #23) and reload the same tree with the success flash (INFERRED). After the reload the topics are collapsed again, as live after a server redirect. | 1.1.16, 1.1.20 | 04 |
| FR-M03-19 | The subtopic delete button (`fa-trash`, `title="Padam Subtopik"`) SHALL confirm "Adakah anda pasti mahu padam subtopik ini?"; OK → `DELETE /api/admin/curriculum/subtopics/{id}` (§7 #24) → reload with the success flash. | 1.1.17, 1.1.20 | 03 |
| FR-M03-20 | Below each open topic's subtopics, S1 SHALL show the toggle button `fa-plus` "Tambah Subtopik"; when pressed it becomes `fa-minus` "Batal" and shows an inline form (hidden `curriculumTopicId`; `name` required "Nama Subtopik (BM)"; `nameEn` "Nama Subtopik (EN)"; `learningObjective` textarea "Objektif Pembelajaran"; submit `fa-plus` "Tambah Subtopik"). Pressing "Batal" only hides it; typed values stay in the fields until the page reloads (OBSERVED). | 1.1.18 | 04 |
| FR-M03-21 | Submitting the add form SHALL be blocked by the browser when `name` is empty (native `required`); otherwise `POST /api/admin/curriculum/subtopics` (§7 #22) → reload with the success flash; the new subtopic is appended last. | 1.1.18, 1.1.20 | 04 |
| FR-M03-22 | S1, S6 and S9 SHALL show one-time flash messages at the top of the content: error = red box (`bg-red-50`, `border-red-200`, `text-red-700`, `fa-exclamation-circle`) with the exact texts of §8; success = green box (INFERRED, UNVERIFIED COPY). A flash is shown once, after the redirect that set it, and is gone on reload. | 1.1.19 | 05 |
| FR-M03-23 | (INFERRED) Inactive chapters and topics SHALL be listed in the admin tree exactly like active ones (no marker) and counted in FR-05. | 1.1.21 | 01 |
| FR-M03-24 | On S1, chapter, topic and subtopic names and descriptions SHALL wrap (no `truncate`/ellipsis) at every width (DV-M03-06a). The tree's indentation, padding and text sizes switch at `sm` (640 px) as live (`ml-4 sm:ml-8`, `pl-2 sm:pl-4`, `p-2.5 sm:p-4`), with every text size below `sm` raised to at least 12 px (DV-M03-06b, FR-99); the filter grid and the summary cards switch at `md`. | 1.1.7, 1.1.11, 1.1.15 | 31 |
| FR-M03-25 | S2 SHALL render with the §2 header/tab title; the back link "Kembali ke Kurikulum" (`fa-arrow-left`) and "Batal" SHALL go to `/admin/curriculum` carrying exactly the `subject_id` and/or `education_level_id` that S2 received (both → `?subject_id={s}&education_level_id={l}`; one → e.g. `?subject_id=3`; none → no query) (OBSERVED). | 1.2.1, 1.2.2 | 06 |
| FR-M03-26 | S2 SHALL show one card with: "Subjek *" select (required; "" "-- Pilih Subjek --" + subjects by id), "Tahap Pendidikan *" select (required; "" "-- Pilih Tahap --" + levels by order), both pre-selected from the query; "Nama Bab (Bahasa Melayu) *" (required, placeholder "cth: Nombor Bulat"); "Nama Bab (English)" ("e.g: Whole Numbers"); "Nombor Bab" (number, min 1, "cth: 1", hint `fa-info-circle` "Contoh: 1, 2, 3 (opsional)"); "Penerangan" (textarea 4 rows, "Penerangan ringkas tentang bab ini..."); "Batal" and "Simpan Bab" (`fa-save`). No "Aktif" field. | 1.2.3, 1.2.4, 1.2.5, 1.2.6 | 06 |
| FR-M03-27 | "Simpan Bab" SHALL rely on native validation (§5), then `POST /api/admin/curriculum/chapters` (§7 #15). (INFERRED) On success: navigate to the S1 tree of the saved pair with the success flash; the chapter is active. On `VALIDATION_ERROR`: stay on S2, show the red error box listing `error.fields` messages (§5, UNVERIFIED COPY) and keep the input. | 1.2.7, 1.2.8 | 06 |
| FR-M03-28 | S3 SHALL load the chapter (`GET /api/admin/curriculum/chapters/{id}`, §7 #14) and render the §2 header, the FR-26 fields pre-filled with the chapter's values; back link and "Batal" → S1 tree of the chapter's current pair. | 1.3.1, 1.3.2, 1.3.3 | 07 |
| FR-M03-29 | S3 SHALL also show the checkbox "Aktif" (value 1, checked when `isActive`) with the hint "Nyahtanda jika bab ini tidak mahu dipaparkan buat masa ini". | 1.3.4 | 07 |
| FR-M03-30 | "Kemaskini Bab" (`fa-save`) SHALL send `PUT /api/admin/curriculum/chapters/{id}` (§7 #16) with every field and `isActive` (false when unticked). (INFERRED) On success: navigate to the S1 tree of the saved (possibly new) pair with the success flash; the chapter keeps its topics when it moves. Validation errors as FR-27. | 1.3.5, 1.3.7 | 07 |
| FR-M03-31 | When the chapter id does not exist (S3, or S4's `chapter_id`), the app SHALL navigate to `/admin/curriculum` and show the error flash "Bab tidak dijumpai.". | 1.3.6, 1.4.8 | 05 |
| FR-M03-32 | S4 SHALL load the chapter of `chapter_id` and render the §2 header, back link/"Batal" → S1 tree of the chapter's pair, and the context card: tile `fa-book-open`, label "Bab", heading "Bab {n}: {name}", chips `fa-book` {subject name} and `fa-graduation-cap` {level name}. | 1.4.1, 1.4.2, 1.4.3 | 08 |
| FR-M03-33 | S4's form SHALL have hidden `chapterId` and: "Nama Topik (Bahasa Melayu) *" (required, "cth: Nombor hingga 1000"); "Nama Topik (English)" ("e.g: Numbers up to 1000"); "Nombor Topik" (text, "cth: 1.1", hint `fa-info-circle` "Contoh: 1.1, 1.2, 2.1 (opsional)"); "Penerangan" (textarea 4, "Penerangan ringkas tentang topik ini..."); "Standard Pembelajaran" (textarea 4, "Standard pembelajaran mengikut kurikulum KSSM/KSSR...", hint `fa-info-circle` "Rujuk dokumen standard kurikulum KPM"); "Batal"; "Simpan Topik" (`fa-save`). No "Aktif" field. | 1.4.4, 1.4.5, 1.4.6 | 08 |
| FR-M03-34 | "Simpan Topik" SHALL send `POST /api/admin/curriculum/topics` (§7 #19). (INFERRED) On success: S1 tree of the chapter's pair with the success flash; topic active. Validation errors as FR-27. | 1.4.7, 1.4.9 | 08 |
| FR-M03-35 | Opening S4 without `chapter_id` SHALL navigate to `/admin/curriculum` with the error flash "Chapter ID diperlukan." (exact live copy). | 1.4.8 | 05 |
| FR-M03-36 | S5 SHALL load the topic with its chapter context (`GET /api/admin/curriculum/topics/{id}`, §7 #18) and render the §2 header, back link/"Batal" → S1 tree of the chapter's pair, the FR-32 context card and the FR-33 fields pre-filled. The chapter cannot be changed. | 1.5.1, 1.5.2, 1.5.3, 1.5.4 | 09 |
| FR-M03-37 | S5 SHALL show the checkbox "Aktif" (checked when active) with the hint "Nyahtanda jika topik ini tidak mahu dipaparkan buat masa ini". | 1.5.5 | 09 |
| FR-M03-38 | "Kemaskini Topik" (`fa-save`) SHALL send `PUT /api/admin/curriculum/topics/{id}` (§7 #20). (INFERRED) On success: S1 tree with the success flash. An unknown topic id SHALL navigate to `/admin/curriculum` with the one-time error flash "Topik tidak dijumpai." (OBSERVED). | 1.5.6, 1.5.7, 1.1.19 | 05, 09 |
| FR-M03-39 | S6 SHALL render the §2 header/tab title, the heading "Senarai Subjek", "Jumlah: {n} subjek" (n = all subjects) and the button "Tambah" (`fa-plus`) → `/admin/subjects/create`. | 2.1.1, 2.1.2 | 10 |
| FR-M03-40 | S6 SHALL list every subject (no pagination, search or filter; order BR-08) in a table whose headers are displayed upper-case: "#" (id), "Ikon" (FR-41), "Nama (BM)" (name; below it `fa-graduation-cap` + the linked level names joined by ", " in level order; no line when none), "Nama (EN)", "Kod" (grey mono pill), "Warna" (round swatch + `color` text as stored; below `sm` (640 px) the swatch only — the hex is `hidden sm:inline`), "Teras?" ("Teras" emerald with `fa-star` when `isCore`, else "Elektif" slate), "Soalan" (amber pill "{questionCount} soalan", `questionCount` = M04 §4.1 Q-ACTIVE(subject), FR-98; below `sm` the number only — "soalan" is `hidden sm:inline`), "Aktif?" (FR-42), "Tindakan" (FR-43). Live text sizes are responsive (`text-[9px] sm:text-xs`); below `sm` they are raised to 12 px (DV-M03-06b). | 2.1.3 | 10 |
| FR-M03-41 | The "Ikon" cell SHALL be a rounded tile with background = `color` + `20` (hex alpha, 12.5 %) and the icon resolved by BR-05, drawn in `color`; an empty or unresolvable value leaves the tile empty (DV-M03-01). | 2.1.4 | 10 |
| FR-M03-42 | The S6 "Aktif?" switch (emerald/on, slate/off) SHALL flip immediately on click (no confirm), then send `PATCH /api/admin/subjects/{id}/active` `{isActive}` (§7 #5). No success message. On an error response it SHALL flip back and `alert("Gagal kemaskini status")`; on a network failure flip back and `alert("Ralat rangkaian")` (DV-M03-07). | 2.1.5 | 11 |
| FR-M03-43 | Each S6 row SHALL have the edit link (`fa-edit`, `title="Edit"`) → `/admin/subjects/{id}/edit` and the delete button (`fa-trash`, `title="Padam"`) with the native confirm "Adakah anda pasti mahu padam subjek ini?"; OK → `DELETE /api/admin/subjects/{id}` (§7 #6). | 2.1.6, 2.1.7 | 10, 12 |
| FR-M03-44 | (INFERRED) After a successful subject delete, S6 SHALL reload without the row, with the count updated and the success flash; the subject's level links and curriculum chapters are removed (BR-10). | 2.1.9 | 12 |
| FR-M03-45 | Opening `/admin/subjects/{unknown}/edit` SHALL navigate to `/admin/subjects` with the error flash "Subjek tidak dijumpai.". | 2.1.8, 2.3.5 | 14 |
| FR-M03-46 | The S6 table SHALL fit its card with all 10 columns visible at ≥1280 px (the level line and names wrap; no text truncation); below 1280 px it SHALL scroll horizontally inside its card (DV-M03-03). S9's table (fits at 1280 on live) SHALL behave the same. | 2.1.3 | 31 |
| FR-M03-47 | S7 SHALL render the §2 header/tab title; "Kembali ke Senarai" (`fa-arrow-left`) and "Batal" → `/admin/subjects`. | 2.2.1, 2.2.2 | 13 |
| FR-M03-48 | S7 SHALL show "Nama Subjek (Bahasa Melayu) *" (required, "cth: Matematik"), "Nama Subjek (English) *" (required, "e.g: Mathematics") and "Kod Subjek *" (required, `maxlength=20`, CSS `uppercase font-mono`: the placeholder displays "CTH: MATH01" (source "cth: MATH01") and typed text displays upper-case; hint `fa-info-circle` "Kod akan ditukar ke huruf besar automatik"). | 2.2.3, 2.2.4 | 13 |
| FR-M03-49 | S7 SHALL show "Ikon (Font Awesome)" (text, value "fas fa-book", placeholder "cth: fas fa-calculator") with the hint `fa-lightbulb` "Lihat ikon di" + link "Font Awesome" → `https://fontawesome.com/icons` (`target="_blank"`). Any value format is accepted (BR-05). | 2.2.5 | 13 |
| FR-M03-50 | S7 SHALL show "Warna Tema": a colour input (value "#4f46e5") and a read-only text input showing the same value; every `input` event on the picker copies its value into the text. | 2.2.6 | 13 |
| FR-M03-51 | S7 SHALL show "Subjek Teras (Core Subject)" (checkbox, unchecked, hint "Tandakan jika subjek ini adalah subjek wajib") and "Susunan Paparan" (number, min 0, value 0, hint `fa-sort` "Nombor lebih kecil akan dipaparkan dahulu"). | 2.2.7, 2.2.8 | 13 |
| FR-M03-52 | S7 SHALL show "Tahap Pendidikan Berkaitan" with one checkbox per level (value = level id), labelled "{name} ({nameEn})" ("Darjah 1 (Year 1)" … "Tingkatan 5 (Form 5)"), all unticked, as a single-column list (each row a padded label with a hover background) inside a bordered, rounded box with a maximum height of 16 rem (256 px) that scrolls vertically inside itself (about 5 rows visible), at every width (OBSERVED). | 2.2.9 | 13 |
| FR-M03-53 | "Simpan Subjek" (`fa-save`) SHALL send `POST /api/admin/subjects` (§7 #3). (INFERRED) On success: navigate to `/admin/subjects` with the success flash; the subject is active, `code` stored upper-case. Validation errors as FR-27 (e.g. duplicate code). | 2.2.10, 2.2.11 | 13 |
| FR-M03-54 | S8 SHALL load the subject (§7 #2) and render the §2 header, the back link/"Batal" → `/admin/subjects`, and the FR-48…52 fields pre-filled (icon value as stored, colour picker and text = stored colour, core and level checkboxes ticked per data). | 2.3.1, 2.3.2, 2.3.3 | 14 |
| FR-M03-55 | "Kemaskini Subjek" (`fa-save`) SHALL send `PUT /api/admin/subjects/{id}` (§7 #4); the ticked set replaces the level links. (INFERRED) On success: `/admin/subjects` with the success flash. | 2.3.4, 2.3.6 | 14 |
| FR-M03-56 | S8 SHALL have no "Aktif" field (active status changes only via FR-42). | 2.3.3 | 14 |
| FR-M03-57 | S9 SHALL render the §2 header/tab title, "Senarai Tahap Pendidikan", "Jumlah: {n} tahap" and "Tambah Tahap" (`fa-plus`, pink gradient `from-pink-500 to-pink-600`) → `/admin/education-levels/create`. S9–S11 use the pink accent (buttons, input and switch focus rings `ring-pink-500`) where S6–S8 use indigo (OBSERVED). | 3.1.1, 3.1.2 | 15 |
| FR-M03-58 | S9 SHALL list every level by `order` then id (INFERRED; order = id on live) in a table with headers displayed upper-case: "#" (id), "Nama (BM)", "Nama (EN)", "Kod" (mono pill), "Peringkat" (badge per `stage`: `primary` "Rendah" blue `fa-child`; `lower_secondary` "Menengah Rendah" purple `fa-book-reader`; `upper_secondary` "Menengah Atas" indigo `fa-user-graduate`), "Kurikulum" (plain text), "Soalan" (amber "{n} soalan", n = M04 §4.1 Q-ACTIVE(level), FR-98, at every width), "Subjek" (emerald "{n} subjek", at every width), "Aktif?", "Tindakan". Cell sizes are fixed (`text-xs`, `px-4 py-3`) at every width, unlike S6. | 3.1.3 | 15 |
| FR-M03-59 | The S9 "Aktif?" switch SHALL flip immediately, then send `PATCH /api/admin/education-levels/{id}/active` `{isActive}` (§7 #11; live `_toggle_only`); on an error response flip back + `alert("Gagal kemaskini status")`; on network failure flip back + `alert("Ralat rangkaian")`. No confirm, no success message. | 3.1.4 | 16 |
| FR-M03-60 | Each S9 row SHALL have the edit link (`fa-edit`, `title="Edit"`) → `/admin/education-levels/{id}/edit` and the delete button (`fa-trash`, `title="Padam"`) with confirm "Adakah anda pasti mahu padam tahap pendidikan ini?"; OK → `DELETE /api/admin/education-levels/{id}` (§7 #12). | 3.1.5, 3.1.6 | 15, 17 |
| FR-M03-61 | (INFERRED) After a successful level delete, S9 SHALL reload without the row with the success flash; the level's subject links and curriculum chapters are removed (BR-10). | 3.1.8 | 17 |
| FR-M03-62 | Opening `/admin/education-levels/{unknown}/edit` SHALL navigate to `/admin/education-levels` with the error flash "Tahap Pendidikan tidak dijumpai.". | 3.1.7, 3.3.5 | 19 |
| FR-M03-63 | S10 SHALL render the §2 header/tab title; "Kembali ke Senarai" and "Batal" → `/admin/education-levels`. | 3.2.1, 3.2.2 | 18 |
| FR-M03-64 | S10 SHALL show "Nama Tahap (Bahasa Melayu) *" (required, "cth: Tahun 1"), "Nama Tahap (English) *" (required, "e.g: Year 1"), "Kod Tahap *" (required, `maxlength=10`, CSS `uppercase font-mono`: placeholder displayed "CTH: Y1" (source "cth: Y1"), typed text displayed upper-case; hint `fa-info-circle` "Kod akan ditukar ke huruf besar automatik"), "Peringkat *" (required select: "" "-- Pilih Peringkat --", `primary` "Rendah (Primary)", `lower_secondary` "Menengah Rendah (Lower Secondary)", `upper_secondary` "Menengah Atas (Upper Secondary)"), "Kurikulum *" (required, "cth: KSSR, KSSM", hint `fa-book-open` "Nama kurikulum yang diguna pakai"), "Susunan Paparan" (number min 0, value 0, hint `fa-sort` "Nombor lebih kecil akan dipaparkan dahulu"). No active field. Submit "Simpan Tahap" in the pink gradient (FR-57). | 3.2.3, 3.2.4, 3.2.5, 3.2.6, 3.2.7 | 18 |
| FR-M03-65 | "Simpan Tahap" (`fa-save`) SHALL send `POST /api/admin/education-levels` (§7 #9). (INFERRED) On success: the list with the success flash; `code` stored upper-case; `grade` null (BR-17). Validation errors as FR-27. | 3.2.8, 3.2.9 | 18 |
| FR-M03-66 | S11 SHALL load the level (§7 #8) and render the §2 header, the back links and the FR-64 fields pre-filled. | 3.3.1, 3.3.2, 3.3.3 | 19 |
| FR-M03-67 | "Kemaskini Tahap" (`fa-save`) SHALL send `PUT /api/admin/education-levels/{id}` (§7 #10). (INFERRED) On success: the list with the success flash. | 3.3.4, 3.3.6 | 19 |
| FR-M03-68 | S11 SHALL have no "Aktif" field. | 3.3.3 | 19 |
| FR-M03-69 | S12 SHALL render in the user shell with the header "Topik Pembelajaran" / "Terokai semua topik pembelajaran" and the tab title "Topik - PRESTASIPLUS". | 4.1.1 | 20 |
| FR-M03-70 | S12 SHALL show the grade chips "Semua Darjah", "Darjah 1" … "Darjah 6" (as live; no Tingkatan chips — DV-M03-02 withdrawn). Active chip: `bg-green-600` white text; others white with border, hover green. Each chip links to `/topics` with `grade_level=DARJAH_n` (none for "Semua Darjah") plus the current `subject` when set. The active chip is the one whose code equals `grade_level` exactly; "Semua Darjah" is active only when `grade_level` is absent; for any other value (e.g. `darjah_1`, `TINGKATAN_4`) no grade chip is active (OBSERVED). | 4.1.2 | 20 |
| FR-M03-71 | S12 SHALL show the subject chips "Semua Subjek", "MATEMATIK", "BAHASA MELAYU", "BAHASA INGGERIS", "SAINS", "PENDIDIKAN ISLAM", "PENDIDIKAN MORAL", "SEJARAH" (as live; no GEOGRAFI chip). Active: `bg-purple-600` white; active rule as FR-70 (exact code; "Semua Subjek" only when `subject` is absent). Each links with `subject={CODE}` (label with "_" for spaces; none for "Semua Subjek") plus the current `grade_level`. | 4.1.3 | 20 |
| FR-M03-72 | S12 SHALL call `GET /api/topics?gradeLevel=&subject=` (§7 #25) and list every matching topic on one page, ordered by `sequence` then id (BR-13); filters combine with AND and match case-insensitively (`darjah_1` = `DARJAH_1`); unknown codes match nothing. Tingkatan and GEOGRAFI topics are reachable through the default list and typed URLs. | 4.1.6 | 20 |
| FR-M03-73 | Each S12 card SHALL be one link to `/topics/{id}` in a grid of 1 / 2 (`sm`) / 3 (`lg`) columns: purple→pink gradient header with a white `fa-book-open` circle, pill "{n} Subtopik" (n = subtopic count), h3 name, subject label (code with "_" → space); body: description (2-line clamp; omitted when null or empty), label "Subtopik:" (displayed upper-case), the first 3 subtopic names each with a green `fa-check-circle`, "+{n−3} lagi..." when n > 3, and the button-styled "Lihat Topik" (`fa-eye`). | 4.1.4 | 21 |
| FR-M03-74 | With no matching topic, S12 SHALL show `fa-book-open` (slate) and "Tiada topik tersedia buat masa ini.". | 4.1.5 | 20 |
| FR-M03-75 | S13 SHALL load `GET /api/topics/{id}` (§7 #26) and render the header "{name}" / "{subject label}", tab title "{name} - PRESTASIPLUS", and the back link "Kembali ke Senarai Topik" (`fa-arrow-left`) → `/topics` (no query). | 4.2.1, 4.2.2 | 22 |
| FR-M03-76 | S13 SHALL show the purple→pink hero (h1 name, subject label, description when present clamped to 3 lines (`line-clamp-3`), `fa-book-open`) and 3 stat cards in 3 columns at every width: `fa-list` (purple-600) {subtopic count} "Subtopik"; `fa-question-circle` (green-600) {questionsAnswered} "Dijawab"; `fa-chart-line` (amber-600) "{progress}%" "Kemajuan" — values for the current user from `progress` (0 / 0% without history). | 4.2.3, 4.2.4, 4.2.8 | 22 |
| FR-M03-77 | S13 SHALL show the heading "Subtopik" and one card per subtopic (1 column, 2 from `sm`), in order: gradient circle with its position (1, 2, …), h3 name, the description when present, badges "Level 1" (green), "Level 2" (yellow), "Level 3" (red) each with `fa-circle` (not interactive), "Kemajuan" + "{p}%" (purple-600) and a purple→pink bar of width p % (p = the user's subtopic progress, 0 without history). | 4.2.5, 4.2.8 | 22 |
| FR-M03-78 | Each subtopic card SHALL end with the link "Mula Berlatih" (`fa-play`) → `/practice/{admin subject code}` where the code maps from the topic's legacy subject (BR-16, all 8 OBSERVED); the same target for every subtopic of the topic (D-9 replicated). | 4.2.6, 6.3.4 | 23 |
| FR-M03-79 | `/topics/{unknown id}` SHALL render the global 404 page (as M01's 404). | 4.2.7 | 22 |
| FR-M03-80 | S14 SHALL render in the user shell with the header title "Peta Belajar" and no subtitle (DV-M03-04), and the tab title "Peta Belajar — PRESTASIPLUS". This is one of the per-module fixes implemented by the global shell rule DV-SH-03 (`docs/design/shells.md`: title from the current route, no subtitle where the page has none). | 5.1.1 | 24 |
| FR-M03-81 | S14 SHALL call `GET /api/learning-map?subject=&grade=` (§7 #27) and render the hero (`journey-hero`: gradient #059669 → #10B981 → #34D399, radius 2rem): h1 "🗺️ Peta Belajar"; subtitle "Terokai perjalanan {label} — takluki setiap pulau! 🏝️" where label = the subject's pill label without its emoji ("Matematik", "Bahasa Melayu", "Bahasa Inggeris", "Sains", "Pend. Islam", "Pend. Moral", "Sejarah"; GEOGRAFI typed in the URL → "Geografi"), and for an unknown code the code title-cased ("ZZZ" → "Zzz") (OBSERVED); stat tiles (`md` and up only) "{done}/{total}" "Topik Selesai" and "{progress}%" "Kemajuan"; a full-width bar (yellow→amber) of width progress % with a white highlight overlay that stays still (the live `animation: shimmer` has no `@keyframes`, so nothing moves — OBSERVED). | 5.1.2, 5.1.3 | 24 |
| FR-M03-82 | S14 SHALL show the selectors card with the subject pills "🔢 Matematik" (`MATEMATIK`), "📝 Bahasa Melayu" (`BAHASA_MELAYU`), "🇬🇧 Bahasa Inggeris" (`BAHASA_INGGERIS`), "🔬 Sains" (`SAINS`), "☪️ Pend. Islam" (`PENDIDIKAN_ISLAM`), "🤝 Pend. Moral" (`PENDIDIKAN_MORAL`), "🏛️ Sejarah" (`SEJARAH`); the live "🌍 Geografi" pill is not rendered (DV-M03-08). Each links to `?subject={CODE}&grade={current grade}`; the active pill is filled with that subject's pill colour (§6.8, OBSERVED: background and border) with white text; inactive pills `bg-slate-50 text-slate-600`. | 5.1.4 | 25 |
| FR-M03-83 | S14 SHALL show the grade chips "Darjah 1" … "Darjah 4" only (as live), each linking to `?subject={current subject}&grade=DARJAH_n`; the active chip has the indigo→purple gradient (`from-indigo-500 to-purple-600`) with white text, the others slate; the chips sit in one row (`flex gap-2`, no wrap). | 5.1.5 | 25 |
| FR-M03-84 | S14 parameters (BR-15, OBSERVED): `subject` default `MATEMATIK`; `grade` default `DARJAH_4`; only the exact codes `DARJAH_1`…`DARJAH_4` are accepted — any other value (DARJAH_5, DARJAH_6, TINGKATAN_*, lower-case `darjah_2`, invalid) is served as `DARJAH_4` with the "Darjah 4" chip active; an unknown subject code (incl. a typed `GEOGRAFI`) is kept (no pill active) and yields no topics. The same default applies to every user (URS OQ-5). | 5.1.11 | 25 |
| FR-M03-85 | The map (`map-container`) SHALL show one node per topic of the subject + grade in `sequence` order: at > 768 px a vertical green path (`map-path`, first child) in the middle with a dot per node (`path-dot {state}`, positioned 0 %…100 %), islands alternating right (first) and left; at ≤ 768 px islands centred, path and dots hidden. Each node starts at opacity 0 / translateY(30px) and fades in (0.5 s, delay i × 0.1 s) when it enters the viewport (IntersectionObserver, threshold 0.1), exactly as live, with no reduced-motion handling (D10). | 5.1.12 | 24 |
| FR-M03-86 | An `unlocked` island SHALL be a link to `/practice?topic_id={id}` styled amber (border #FBBF24, `pulse-glow`), with the topic emoji in a tile, "🎯 BUKA" (amber), the h3 name, a blue progress bar + "{progress}%", and "{sessions} sesi · {questionsAnswered} soalan dijawab". | 5.1.6 | 26 |
| FR-M03-87 | A `locked` island SHALL be a non-link block, slate, 60 % opacity, `cursor: not-allowed`, with a 🔒 tile, "🔒 TERKUNCI", the h3 name and "Selesaikan topik sebelumnya dulu". | 5.1.7 | 26 |
| FR-M03-88 | (INFERRED) `mastered` (green, border #34D399) and `started` (blue, border #60A5FA) islands SHALL use the unlocked card content (emoji, label, name, bar, sessions line) with the state labels of §8 (UNVERIFIED COPY) and link to `/practice?topic_id={id}`. | 5.1.8 | 26 |
| FR-M03-89 | Island states and hero values SHALL follow BR-14 (state per topic from the user's progress, derived from the M05 answer log per BR-19; first two open; next opens after the previous is started or mastered) and BR-15 ("Topik Selesai" = mastered count / topic count; "Kemajuan" = rounded average progress). | 5.1.9 | 26 |
| FR-M03-90 | With no topics, S14 SHALL show the empty card "🗺️", "Tiada Topik Dijumpai", "Pilih subjek dan darjah yang lain untuk melihat peta belajar" instead of the map; the hero shows "0/0" and "0%". | 5.1.10 | 25 |
| FR-M03-91 | The admin shell sidebar (≥1024 px) SHALL show, under the section "PENGURUSAN", the collapsible group "Kurikulum" (`fa-sitemap`, displayed "KURIKULUM", group key `kurikulum`, open state saved in `localStorage["admin_sidebar"]` as the global shell does) with "Kurikulum" (`fa-sitemap`) → `/admin/curriculum`, "Subjek" (`fa-book`) → `/admin/subjects`, "Tahap Pendidikan" (`fa-graduation-cap`) → `/admin/education-levels`. On S1–S11 the group is open and the matching item is active: "Kurikulum" on S1–S5, "Subjek" on S6–S8, "Tahap Pendidikan" on S9–S11. | 6.1.1, 6.1.3 | 27 |
| FR-M03-92 | Below 1024 px the admin "Lagi" menu SHALL contain the section "Kurikulum" (displayed upper-case) with the same 3 links. | 6.1.2 | 27 |
| FR-M03-93 | The user shell SHALL show "Topik" (`fa-book-open`) → `/topics` and "Peta Belajar" (`fa-map`) → `/peta-belajar` in the desktop sidebar and in the drawer (below 1024 px), and "Topik" in the mobile bottom nav; "Topik" is active on S12/S13, "Peta Belajar" on S14 (no bottom-nav item). | 6.2.1, 6.2.2, 6.2.3 | 28 |
| FR-M03-94 | (INFERRED) Route guards: a guest opening any M03 route is redirected to `/login` (M01 FR-M01-14); S1–S11 require role `admin`, other roles are sent to their landing page (M01 BR-07); S12–S14 open for any authenticated user. The mock API enforces the same (§7 auth column). | 6.3.1 | 29 |
| FR-M03-95 | The app SHALL map grades with one shared helper (BR-17): grade 1–6 ↔ level code D1–D6 ↔ `DARJAH_1`–`DARJAH_6`; grade 7–11 ↔ T1–T5 ↔ `TINGKATAN_1`–`TINGKATAN_5`. M01/M02/M05 use the same helper. | 6.3.2 | 30 |
| FR-M03-96 | The mock layer SHALL expose `GET /api/subjects` and `GET /api/education-levels` (§7 #28, #29) returning only active records in BR-08 order, for M04/M05 selectors; inactive records never appear there. | 6.3.3 | 11, 16, 30 |
| FR-M03-97 | The practice links SHALL use the BR-16 map for `/practice/{CODE}` and the legacy topic id for `/practice?topic_id={id}`; both routes belong to M05. | 6.3.4 | 23, 26, 30 |
| FR-M03-98 | "Soalan" on S6/S9 SHALL show `questionCount` = the named count query **M04 SRS §4.1 Q-ACTIVE(subject) / Q-ACTIVE(level)** (active questions, `isActive = true`, PKSK excluded) on the M04 question dataset (D11; M04 owns it per D12), per subject on S6 and per level on S9. No separate count is seeded in M03; the dataset is built to the live per-subject and per-level values (e.g. Matematik 13872, Darjah 1 11396), so the displayed values equal live. S9 "Subjek" = number of subjects linked to the level (computed). | 6.3.5 | 10, 15, 30 |
| FR-M03-99 | Every M03 screen SHALL follow §10 and NFR-RESP-01..10: no horizontal page scroll at 320–1920 px; touch targets ≥44 px high; the form buttons ("Batal" + submit) sit side by side, right-aligned, below a top border at every width, as live (`flex justify-end space-x-3 pt-4 border-t`; they fit at 375 px); no text in M03 content inside `main` (the global shell — header subtitle and pills, bottom nav, footer — is owned by M23 and out of M03 scope) is rendered below 12 px (DV-M03-06b: live 8–11 px text sizes below `sm` on S1, S6, S12, S13, S14 are raised to 12 px); decorative icons keep their live size (e.g. the 8 px ticks, the 6–8 px dots, the chevrons). DV-M03-03 and DV-M03-06 included. | all screen FNs | 31 |

### 3.1 Traceability (US → FR → E2E)

Generated and verified by script (`check.js` in the author's scratchpad) from URS §3/§4 and this §3/§12: every FN has ≥1 FR, every AC and every FR has ≥1 E2E, no dangling IDs.

| US | FR | E2E |
|---|---|---|
| US-M03-01 | 01, 02, 03, 04, 05, 08, 11, 12, 16, 23 | 01, 02, 03, 04, 05, 06 |
| US-M03-02 | 06, 07, 15 | 02, 07, 08 |
| US-M03-03 | 10, 14, 19 | 09, 10 |
| US-M03-04 | 16, 17, 18, 20, 21 | 11, 12 |
| US-M03-05 | 22, 31, 35, 38 | 13 |
| US-M03-06 | 25, 26, 27 | 14, 15, 16 |
| US-M03-07 | 09, 28, 29, 30 | 17, 18 |
| US-M03-08 | 32, 33, 34 | 19 |
| US-M03-09 | 13, 36, 37, 38 | 20 |
| US-M03-10 | 39, 40, 41, 43, 98 | 21, 22 |
| US-M03-11 | 42, 96 | 23, 24, 25 |
| US-M03-12 | 43, 44 | 26 |
| US-M03-13 | 47, 48, 49, 50, 51, 52, 53 | 27, 28 |
| US-M03-14 | 45, 54, 55, 56 | 29 |
| US-M03-15 | 57, 58, 60, 98 | 30 |
| US-M03-16 | 59, 96 | 25, 31 |
| US-M03-17 | 60, 61 | 32 |
| US-M03-18 | 63, 64, 65 | 33 |
| US-M03-19 | 62, 66, 67, 68 | 34 |
| US-M03-20 | 69, 70, 71, 72, 74 | 35, 36 |
| US-M03-21 | 73 | 37 |
| US-M03-22 | 75, 76, 77, 79 | 38, 39 |
| US-M03-23 | 78, 97 | 40 |
| US-M03-24 | 80, 81, 85 | 41, 42 |
| US-M03-25 | 82, 83, 84, 90 | 43, 44, 45 |
| US-M03-26 | 86, 87, 88, 89, 97 | 46, 47 |
| US-M03-27 | 91, 92 | 48 |
| US-M03-28 | 93 | 49 |
| US-M03-29 | 94 | 50 |
| US-M03-30 | 95, 96, 97, 98 | 25, 51 |
| US-M03-31 | 24, 46, 99 | 52 |

## 4. Business rules

| # | Rule | Source |
|---|---|---|
| BR-01 | Education levels (seed): 11 records, id 1–11 = order 1–11: D1–D6 "Darjah n" / "Year n", stage `primary`, "KSSR"; T1–T3 "Tingkatan n" / "Form n", `lower_secondary`, "KSSM"; T4–T5 `upper_secondary`, "KSSM". Stage labels: `primary` "Rendah", `lower_secondary` "Menengah Rendah", `upper_secondary` "Menengah Atas" (select labels add " (Primary)", " (Lower Secondary)", " (Upper Secondary)"). | OBSERVED |
| BR-02 | Subject: `name`, `nameEn`, `code` required; `code` ≤20, stored upper-case, unique (INFERRED); `icon` free text (default "fas fa-book"); `color` hex (default #4f46e5); `isCore` default false; `order` int ≥0 default 0; `educationLevelIds` any subset; new subjects active. | OBSERVED (form) / INFERRED (server) |
| BR-03 | Level: `name`, `nameEn`, `code`, `stage`, `curriculum` required; `code` ≤10, stored upper-case, unique (INFERRED); `order` int ≥0 default 0; new levels active; `grade` null unless seeded (BR-17). | OBSERVED (form) / INFERRED (server) |
| BR-04 | Subject ↔ level links are many-to-many and only edited on S7/S8. The curriculum tree does not check the link: any subject × level pair can be viewed and given chapters (D-12 replicated). | OBSERVED |
| BR-05 | Icon resolution (DV-M03-01), in order: (1) empty → no glyph; (2) contains a non-ASCII character → render the text as is (emoji); (3) matches `^(?:(?:fa[srlbd]?|fa-solid|fa-regular)\s+)?fa-([a-z0-9-]+)$` — i.e. an optional FA5 prefix (`fa`, `fas`, `far`, `fal`, `fab`, `fad`) or FA6 long prefix (`fa-solid`, `fa-regular`, both rendered by live Font Awesome 6.5.1), then one `fa-` name; the prefix never changes the result → take the name after `fa-`, map with the Font Awesome → Lucide table (the single authority is `docs/design/design-system.md` §6; e.g. `quran`→`book-open-text`, `mosque`→`landmark`, `pen-nib`→`pen-tool`, `scale-balanced`→`scale`, `book`→`book`, `calculator`→`calculator`; NFR-M03-06 must agree with it), else try the same name as a Lucide icon; (4) a bare kebab-case name → the Lucide icon of that name; (5) unknown → no glyph. Values are never injected as HTML or CSS classes (SEC-M03-03). | DV-M03-01 |
| BR-06 | Tree: needs both `subjectId` and `educationLevelId`; returns all chapters of the pair with `inTree = true` (every chapter a tree screen can reach) with their topics and subtopics, active or not; the 60 out-of-tree chapters (§6.9) never appear on S1–S5 and are not in any M03 total except CH-ALL-INCL-ORPHAN; stats = chapter count, topic count, subtopic count of the pair. | OBSERVED |
| BR-07 | Chapter: `subjectId`, `educationLevelId`, `name` required; `chapterNumber` int ≥1 or null; `nameEn`, `description` optional; new chapters active; editing may change the pair (the chapter keeps its topics). Topic: `chapterId`, `name` required; `topicNumber` free text ≤20 (INFERRED) or null; `nameEn`, `description`, `learningStandard` optional; chapter fixed after creation. Subtopic: `topicId`, `name` required; `nameEn`, `learningObjective` optional. No uniqueness rules on numbers (as live). | OBSERVED (form) / INFERRED (server) |
| BR-08 | Ordering: subjects and levels by `order`, then id (INFERRED: `order` = id for every live record, so order-then-id cannot be told apart from id order); chapters by `chapterNumber` (numeric, null last), then `createdSeq`; topics by `topicNumber` natural order (split on "."; numeric parts compared as numbers; non-numeric text compared as text after numbers; null last), then `createdSeq`; subtopics by `createdSeq` (DV-M03-05); legacy topics by `sequence` then id (OBSERVED). | INFERRED (subjects/levels) / OBSERVED (legacy) / DV-M03-05 |
| BR-09 | Subtopic create appends (`createdSeq` = max + 1). Inline forms on S1 submit one subtopic at a time. | INFERRED |
| BR-10 | Deletes (INFERRED): chapter → its topics and their subtopics; topic → its subtopics; subject → its level links and all chapters of that subject (cascade); level → its subject links and all chapters of that level (cascade). M04 questions referencing a deleted subject/level/topic are left unchanged (URS OQ-6/OQ-10). The logged-out/other-role cases are refused by the guard (FR-94). | INFERRED |
| BR-11 | Active flags: subjects and levels switch only from the lists (FR-42, FR-59); chapters and topics only on S3/S5. Inactive records remain on every admin screen and in counts; they are excluded from `GET /api/subjects`, `GET /api/education-levels` (other modules' selectors). The student catalogue (S12–S14) has no active flag and is unaffected (URS OQ-8). | OBSERVED (UI) / INFERRED (effects) |
| BR-12 | Counts are computed when read: subject `questionCount` = M04 §4.1 Q-ACTIVE(subject), level `questionCount` = M04 §4.1 Q-ACTIVE(level) (FR-98), level `subjectCount` = linked subjects, "Jumlah: n" = all records. | OBSERVED (subjectCount) / INFERRED |
| BR-13 | Legacy catalogue: `gradeLevel` ∈ `DARJAH_1…6`, `TINGKATAN_1…5`; `subject` ∈ the 8 codes; label = code with "_" → " ". `/api/topics` filters by `gradeLevel` and `subject` when given (AND), **case-insensitively** (`darjah_1` lists the 17 Darjah 1 topics); an unknown value matches nothing (empty state). Chip active state uses the exact code (FR-70/71). Each topic has 1–6 subtopics; each subtopic shows three fixed difficulty badges "Level 1/2/3". | OBSERVED |
| BR-14 | Island state per topic (in `sequence` order, index k from 1) for the current user, from the derived topic progress of BR-19 (INFERRED except the no-history case): `mastered` if `progress` ≥ 80 (threshold INFERRED); else `started` if `sessions` ≥ 1 or `questionsAnswered` ≥ 1; else `unlocked` if k ≤ 2 or topic k−1 is `started` or `mastered`; else `locked`. With no history: topics 1–2 `unlocked`, the rest `locked` (OBSERVED). Because the inputs are read from the M05 answer log, a student who practises a topic sees its state change on the next load. | OBSERVED (no history) / INFERRED |
| BR-15 | Peta Belajar values: `total` = topic count; `done` = mastered count; `progress` = round(average of topic progress) (0 with no topics). Parameters: subject default `MATEMATIK`; grade default `DARJAH_4`; accepted grades exactly `DARJAH_1`…`DARJAH_4`, anything else served as `DARJAH_4` with that chip active; subtitle label = the pill label without emoji for the 7 pill subjects, "Geografi" for a typed GEOGRAFI, else the code title-cased (first letter upper, rest lower, "_" → " "). Subject pills: 7 (Geografi removed, DV-M03-08). | OBSERVED (defaults, fallback, labels) / INFERRED (formulas) / DV-M03-08 |
| BR-16 | Practice code map (legacy subject → admin subject code), all OBSERVED: MATEMATIK→MATH, BAHASA_MELAYU→BM, BAHASA_INGGERIS→BI, SAINS→SCI, PENDIDIKAN_ISLAM→PI, PENDIDIKAN_MORAL→PM, SEJARAH→SEJ, GEOGRAFI→GEO. | OBSERVED |
| BR-17 | Grade mapping: User `grade` (M01) n = 1…6 ↔ level `grade` n ↔ code `Dn` ↔ `DARJAH_n`; n = 7…11 ↔ `T{n−6}` ↔ `TINGKATAN_{n−6}`. School stage: SK, SJK(C), SJK(T) ↔ `primary` levels (M02 BR-21 / DV-M02-09); other types ↔ secondary levels. | OBSERVED (codes) / INFERRED (mapping) |
| BR-18 | Admin "not found" and guard cases redirect with a one-time error flash: unknown chapter (S3, S4) → `/admin/curriculum` "Bab tidak dijumpai."; S4 without `chapter_id` → `/admin/curriculum` "Chapter ID diperlukan."; unknown topic (S5) → `/admin/curriculum` "Topik tidak dijumpai."; unknown subject → `/admin/subjects` "Subjek tidak dijumpai."; unknown level → `/admin/education-levels` "Tahap Pendidikan tidak dijumpai.". | OBSERVED |
| BR-19 | **Topic progress (derived, INFERRED; XL-17).** M03 stores no progress. For user U and legacy topic T (subject → admin subject id via BR-16; `gradeLevel` → level id: DARJAH_n → n, TINGKATAN_n → n+6), the topic is linked to a DSKP chapter by position: the k-th topic of that subject + grade in `sequence` order ↔ the k-th chapter of the same subject × level in `chapterNumber` order (BR-08); a topic with no k-th chapter has no answers. From the M05 answer log (DATA-M05-02, rows of U with that `chapterId`): `questionsAnswered` = number of rows; `correct` = rows with `isCorrect`; `sessions` = number of distinct non-null `sessionId`; `progress` = min(100, round(100 × correct ÷ 20)) (20 correct answers = 100 %); every subtopic bar on S13 shows the topic `progress` (no subtopic tagging exists). Values are computed on each read (§7 #26, #27). | INFERRED |

## 5. Validation rules

**Client side — native HTML5 only, as live.** Browser-native messages appear in the browser's language; there is no custom client copy.

| Form | Field | Native constraints |
|---|---|---|
| S1 filter | both selects | none |
| S1 add / edit subtopic | `name` | `required` |
| S2, S3 | `subjectId`, `educationLevelId`, `name` | `required` |
| S2, S3 | `chapterNumber` | `type=number`, `min=1` |
| S4, S5 | `name` | `required` |
| S7, S8 | `name`, `nameEn`, `code` | `required`; `code` `maxlength=20` |
| S7, S8 | `order` | `type=number`, `min=0` |
| S10, S11 | `name`, `nameEn`, `code`, `stage`, `curriculum` | `required`; `code` `maxlength=10` |
| S10, S11 | `order` | `type=number`, `min=0` |

**Server side (mock; INFERRED, UNVERIFIED COPY — Laravel default English messages, as M01 §5).** On `VALIDATION_ERROR` (422) the page stays, shows the red error box above the form with one line per message, and keeps the input.

| Rule | Message (placeholder) |
|---|---|
| required field missing | "The {field} field is required." |
| subject `code` taken / level `code` taken | "The code has already been taken." |
| `code` too long | "The code field must not be greater than 20 characters." (10 for levels) |
| `chapterNumber` < 1 | "The chapter number field must be at least 1." |
| `order` < 0 | "The order field must be at least 0." |
| `stage` not in the enum | "The selected stage is invalid." |
| `subjectId` / `educationLevelId` / `chapterId` / `educationLevelIds[]` not existing | "The selected {field} is invalid." |

## 6. Data entities & fields

*(solution-architect)* JSON fields are camelCase. **IDs are positive integers**, as on live, which exposes numeric ids in its URLs and forms (`?subject_id=3`, `/admin/curriculum/chapters/91/edit`, `/practice?topic_id=38`); the master SRS §7.4 allows numeric ids wherever live exposes them (aligned with M04 v1.1). Codes (`MATH`, `D1`, `DARJAH_1`, `MATEMATIK`) are separate string fields, never ids. Subjects (1–31), levels (1–11) and legacy topics (1–125) keep their live ids. Of the tree records, only the 38 named in §6.9 (11 observed in M03, 10 observed on the M05 chapter pages, 17 observed in the M10 chapter selects) keep their live ids; every other chapter, topic and subtopic id is a sequential seed id that does **not** match live (live ids were not harvested). The lookup contracts `GET /api/subjects` and `GET /api/education-levels` (§7 #28/#29, fields incl. `isCore`) are stable for M04/M05. All data lives in the in-memory store seeded from fixtures and reset per E2E test (`mock.reset()`, M01 NFR-M01-02).

### 6.1 DATA-M03-01 — EducationLevel (owned by M03)

| Field | Type | Required | Notes |
|---|---|---|---|
| id | int | yes | 1–11 for seeds (live ids) |
| code | string ≤10, upper-case | yes | D1…D6, T1…T5; unique (INFERRED) |
| name | string ≤255 | yes | "Darjah 1" |
| nameEn | string ≤255 | yes | "Year 1" |
| stage | enum `primary\|lower_secondary\|upper_secondary` | yes | BR-01 |
| curriculum | string ≤255 | yes | "KSSR" / "KSSM" (free text) |
| order | int ≥0 | yes | Default 0 |
| isActive | boolean | yes | Default true |
| grade | int 1–11 \| null | no | Link to M01 `grade` (BR-17); seeded 1–11; null for levels created later. Not shown in the UI |
| createdAt, updatedAt | datetime | yes | |
| *questionCount* | int | derived | M04 SRS §4.1 Q-ACTIVE(subject) / Q-ACTIVE(level) (FR-98) |
| *subjectCount* | int | derived | Linked subjects |

### 6.2 DATA-M03-02 — Subject (owned by M03)

| Field | Type | Required | Notes |
|---|---|---|---|
| id | int | yes | 1–31 for seeds (live ids) |
| code | string ≤20, upper-case | yes | BM, BI, MATH, …; unique (INFERRED) |
| name, nameEn | string ≤255 | yes | |
| icon | string ≤100 \| null | no | Free text: Lucide name, FA class or emoji (BR-05) |
| color | string `#rrggbb` | yes | Case kept as stored ("#0f766e") |
| isCore | boolean | yes | "Teras"/"Elektif" |
| order | int ≥0 | yes | |
| isActive | boolean | yes | |
| educationLevelIds | int[] | yes | Pivot `SubjectLevel {subjectId, educationLevelId}` |
| createdAt, updatedAt | datetime | yes | |
| *questionCount* | int | derived | M04 SRS §4.1 Q-ACTIVE(subject) / Q-ACTIVE(level) (FR-98) |

### 6.3 DATA-M03-03 — CurriculumChapter

| Field | Type | Required | Notes |
|---|---|---|---|
| id | int | yes | Auto-increment (§6.9) |
| subjectId | int → Subject | yes | |
| educationLevelId | int → EducationLevel \| null | yes for tree chapters | Pair not checked against the links (BR-04); null only for out-of-tree chapters (level not observed, **designed**) |
| name | string ≤255 \| null | yes for tree chapters | null only for out-of-tree chapters (title not observed, never displayed; **designed**) |
| nameEn | string \| null | no | |
| chapterNumber | int ≥1 \| null | no | Displayed "Bab {n}" |
| description | text \| null | no | |
| isActive | boolean | yes | Default true |
| createdSeq | int | yes | Tie-break order (creation order; seeds = dataset order) |
| inTree | boolean | yes | true for every tree chapter (seeded and created at runtime); false only for the 60 out-of-tree chapters (§6.9, XL3-24) |
| createdAt, updatedAt | datetime | yes | |

### 6.4 DATA-M03-04 — CurriculumTopic

| Field | Type | Required | Notes |
|---|---|---|---|
| id | int | yes | Auto-increment (§6.9) |
| chapterId | int → CurriculumChapter | yes | Fixed after creation |
| name | string ≤255 | yes | |
| nameEn | string \| null | no | |
| topicNumber | string ≤20 \| null | no | Free text ("1", "1.1") |
| description | text \| null | no | |
| learningStandard | text \| null | no | "Standard Pembelajaran" |
| isActive | boolean | yes | |
| createdSeq | int | yes | |

### 6.5 DATA-M03-05 — CurriculumSubtopic

| Field | Type | Required | Notes |
|---|---|---|---|
| id | int | yes | Auto-increment (§6.9) |
| topicId | int → CurriculumTopic | yes | live `curriculum_topic_id` |
| name | string ≤255 | yes | |
| nameEn | string \| null | no | |
| learningObjective | text \| null | no | |
| createdSeq | int | yes | |

### 6.6 DATA-M03-06 — LegacyTopic and LegacySubtopic (student catalogue; separate from 6.3–6.5)

| Field | Type | Required | Notes |
|---|---|---|---|
| id | int | yes | 1–125 (live ids, used by `/practice?topic_id=`) |
| gradeLevel | enum `DARJAH_1…DARJAH_6\|TINGKATAN_1…TINGKATAN_5` | yes | |
| subject | enum `MATEMATIK\|BAHASA_MELAYU\|BAHASA_INGGERIS\|SAINS\|PENDIDIKAN_ISLAM\|PENDIDIKAN_MORAL\|SEJARAH\|GEOGRAFI` | yes | |
| name | string | yes | |
| description | text \| null | no | 61 topics have none |
| icon | string (emoji) \| null | no | Peta Belajar tile; seeded only where observed (discovery B.6); null → empty tile (only possible for a topic that becomes open in test data) |
| sequence | int | yes | Catalogue order |
| subtopics | LegacySubtopic[] (1–6) | yes | `{id, name, description \| null, order}` |

### 6.7 DATA-M03-07 — LearnerTopicProgress (derived response shape; not stored)

Computed on read by BR-19 from the M05 answer log (DATA-M05-02; owner M05 per D12). M03 stores nothing and nothing writes this shape.

| Field | Type | Notes |
|---|---|---|
| legacyTopicId | int → LegacyTopic | |
| sessions | int ≥0 | "{s} sesi" |
| questionsAnswered | int ≥0 | "Dijawab", "{q} soalan dijawab" |
| correct | int ≥0 | Input to `progress` |
| progress | int 0–100 | Topic % (BR-19) |

No answers = 0 everywhere. `Subject.usedCount` (M05 DATA-M05-07) is derived by M05 and is not an M03 field (XL-23).

### 6.8 DATA-M03-08 — Lookups (static constants)

| Lookup | Values |
|---|---|
| Stage labels / badge icons / colours | BR-01; `fa-child` blue, `fa-book-reader` purple, `fa-user-graduate` indigo |
| Legacy subject labels | code with "_" → " " (S12/S13); Peta Belajar pill labels "🔢 Matematik", "📝 Bahasa Melayu", "🇬🇧 Bahasa Inggeris", "🔬 Sains", "☪️ Pend. Islam", "🤝 Pend. Moral", "🏛️ Sejarah" (the live "🌍 Geografi" pill is not rendered, DV-M03-08); hero label = pill label without the emoji; typed GEOGRAFI → "Geografi" (OBSERVED) |
| Peta Belajar pill colours (active background and border, OBSERVED) | MATEMATIK #3B82F6, BAHASA_MELAYU #10B981, BAHASA_INGGERIS #8B5CF6, SAINS #F59E0B, PENDIDIKAN_ISLAM #14B8A6, PENDIDIKAN_MORAL #F97316, SEJARAH #EF4444 (GEOGRAFI #06B6D4 on live; pill not rendered) |
| Grade codes | `DARJAH_1`…`DARJAH_6` "Darjah n"; `TINGKATAN_1`…`TINGKATAN_5` "Tingkatan n" |
| Practice code map | BR-16 |
| FA → Lucide (icons in data) | `quran`→`book-open-text`, `mosque`→`landmark`, `pen-nib`→`pen-tool`, `scale-balanced`→`scale`, `book`→`book`, `calculator`→`calculator`; unknown → same-name Lucide lookup |

### 6.9 Seed data (curriculum is public, non-personal: seeded from `docs/discovery/inventory/M03/_curriculum-data.json`)

| Set | Content | Purpose |
|---|---|---|
| Levels | `educationLevels` (11) as is: id, code, name, name_en → nameEn, stage, curriculum, is_active; `order` = id; `grade` = id. No question count is seeded: FR-98 computes it from the M04 D11 dataset | S9, S1 filter, lookups |
| Subjects | `subjects` (31) as is: id, code, name, nameEn, color, is_core, `icon_raw` → `icon` (empty → null), `education_level_ids`, is_active; `order` = id (subject 3 order 3 observed). No question count is seeded (FR-98) | S6, DV-M03-01 |
| Tree | `tree` (194 pairs): each chapter title "Bab {n}: {name}" → `chapterNumber` n, `name` = text after the first ": " (e.g. "Unit 1: Mozhiyum Kadamaiyum"); each topic title "Topik {x}: {name}" → `topicNumber` x, `name`; descriptions and subtopics (`name`, `name_en`, `learning_objective`) as is; `createdSeq` = dataset order; all active. Known extra values: chapter 91 (Matematik T4 Bab 1) `nameEn` "Functions and Quadratic Equations"; topic 126 "Fungsi" `nameEn` "Functions". Integer ids: the live ids of these named records are kept — (a) opened in M03: chapters 35, 36 (BM D1 Bab 1/2), 91, 92 (Matematik T4 Bab 1/2); topics 59, 60 (BM D1), 126, 127 (Matematik T4 Bab 1 "Fungsi", "Persamaan kuadratik"); subtopics 132 "Mendengar sebutan dan intonasi" (name observed by the audit), 133 "Bertutur untuk menyatakan permintaan" and 134 "Mengenal huruf dan suku kata" (ids observed as the `PUT/DELETE /admin/curriculum/subtopics/{id}` form actions of the BM D1 tree in discovery capture `S1-curriculum__bm-d1-topic-open__1280`, in row order: 132 and 133 under "Topik 1: Mendengar dan Memahami", 134 first under "Topik 1: Membaca Perkataan"); (b) observed on the M05 chapter pages (`/practice/chapter/{CODE}/{chapterId}/quiz`, `docs/discovery/M05-practice.md` §2.5 and `inventory/M05/_practice-data.json`; each title matches the M03 tree): chapter 1 MATH D1 "Bab 1: Nombor Bulat hingga 100", 3 MATH D2 "Bab 1: Nombor Bulat hingga 1000", 18 SCI D1 "Bab 1: Sains Hayat", 57 BI D1 "Bab 1: Listening and Speaking", 120 PI D1 "Bab 1: Akidah D1", 142 PM D1 "Bab 1: Nilai Diri D1", 164 SEJ D1 "Bab 1: Asas Sejarah D1", 179 GEO D1 "Bab 1: Asas Geografi D1", 263 BA D1 "Bab 1: Kemahiran Mendengar dan Bertutur (الاستماع والتحدث)", 325 JAWI D1 "Bab 1: Mengenal Huruf Jawi" (and 35 BM D1, already in (a)); (c) observed in the M10 chapter selects (`chapter_id` option values, `docs/discovery/inventory/M10/S20-berstruktur-edit.json` and raw captures S16/S18/S22 of `inventory/_raw/M10/`; each title matches the M03 tree): Perniagaan T5 258 "Bab 1: Pengurusan dan Kepimpinan", 259 "Bab 2: Kewangan Perniagaan", 260 "Bab 3: Pemasaran (Lanjutan)", 261 "Bab 4: Perniagaan Antarabangsa", 262 "Bab 5: Etika dan Tanggungjawab Sosial", 1280 "Bab 6: Persediaan Memulakan Perniagaan", 1281 "Bab 7: Merancang Pengendalian Perniagaan" (the M10 DV-M10-05 preload; M10 S20 masked its title, which is taken from the M03 tree); Bahasa Melayu T5 413 "Bab 99: Kemahiran Bahasa Tingkatan 5"; Sains T5 362 "Bab 1: Dunia mikroorganisma", 363 "Bab 2: Diet seimbang dan nilai kalori", 347 "Bab 3: Kelestarian Alam Sekitar", 364 "Bab 4: Aplikasi kadar tindak balas", 365 "Bab 5: Alkohol", 366 "Bab 6: Sel elektrolisis", 367 "Bab 7: Alat optik", 368 "Bab 8: Tekanan dalam bendalir", 369 "Bab 9: Satelit". Two kept ids (1280, 1281) lie above 1,251, so chapter ids are not contiguous; the total stays 1,251. Every other chapter, topic and subtopic gets a sequential seed id (next free integer in dataset order, reserved ids skipped) that does not match its live id; new records created in the prototype get max id + 1. Legacy subtopic ids are integers assigned in catalogue order. | S1–S5 |
| DV-M03-09 data fixes | (a) In each tree, chapters with `chapterNumber` ≥ 100 (334 chapters in BI T2, SCI T3, PSV T2, PSV T3, PJK T1, PJK T2, RBT T2, SK T2, SK T3, BT T1, BT T2) are renumbered consecutively after the highest number < 100 in that tree, in their stored order (e.g. SK T3 "Bab 902" → the next number after the tree's highest genuine number). (b) In each chapter where a `topicNumber` repeats (478 repeats), the chapter's topics are renumbered "1"…"n" in stored order. Names, descriptions and everything else unchanged. | DV-M03-09 |
| Out-of-tree chapters (XL3-24, M17 XR-M17-19) | 60 chapter records that exist on live but are not reachable in the M03 subject × level tree. Observed only as per-subject counts on the M17 S10 "Status Kurikulum" figure (Σ 1,311 vs the tree's 1,251): Pendidikan Muzik (subject 14) 56, Pendidikan Syariah Islamiah (27) 3, Sains Rumah Tangga (28) 1. Fields: `subjectId` as observed (count per subject); `inTree = false`; **designed** (not observed): `educationLevelId = null`, `name = null`, `nameEn`, `chapterNumber`, `description` null, `isActive = true`, no topics or subtopics. No titles are invented; no M03 screen displays them. Ids 1282–1341 (clear of every kept live id; live ids not observed) | M17 S10, CH-ALL-INCL-ORPHAN |
| Test-only records | One inactive chapter (Sejarah Darjah 1, "Bab 3: Bab Tidak Aktif Demo") with one inactive topic "Topik 1: Topik Tidak Aktif Demo", added **only** when the seed override `curriculumInactiveDemo: true` is set (off by default, so the default totals stay CH-ALL 1,251 / TP-ALL 2,423 and do not include them); these records do not exist on live; one subject with a failing toggle is simulated with `mock.failNext`, not with data | FR-23, E2E |
| Legacy topics | `legacyTopics` (125): id, grade_level → `gradeLevel`, subject label → code (" " → "_"), name, description (null kept), `sequence` = dataset order. Subtopics: the full observed names — `subtopics_preview` for topics with ≤3 subtopics, topic 7 + "Menulis Nombor dalam Perkataan", and for the other 18 topics with more than 3 subtopics (8, 10, 12, 32, 41, 47, 49, 54, 57, 102, 103, 104, 109, 110, 111, 113, 114, 116) the names in audit Appendix A (`docs/qa/audit/M03-audit.md`). Subtopic descriptions (OBSERVED): topic 4 "Mengenal haiwan peliharaan seperti kucing, anjing" / "Mengenal haiwan liar seperti harimau, gajah"; topic 68 "Kemahiran Bahasa Melayu SPM Tingkatan 5 berdasarkan DSKP KSSM"; topic 69 "Membaca dan mentafsir peta" / "Rujukan grid"; topic 103 subtopic 1 "SK 4.6 Sains Tingkatan 4"; all others null. `icon` from discovery Appendix B.6 where observed (e.g. 1 🔢, 7 🔢, 6 ✖️, 19 🔢, 29 🔢, 30 🥧, 38 🔢, 39 🔣, 3 🔤, 10 📖, 4 🐾, 13 🌿, 15 🕌, 16 🤲, 17 💖, 18 👨‍👩‍👦, …); null for every other topic (not invented, URS OQ-11) | S12–S14 |
| Users | M01 seeds (§6.8 of the M01 SRS) reused: `admin@demo.test`, `pelajar@demo.test`, `pelajar2@demo.test` and the canonical id 4 `pelajarmaju@demo.test` "Pelajar Maju Demo" (student, grade 1 — XL-14); all get Peta Belajar Matematik + Darjah 4 by default, as live | S14 defaults and progress |
| Progress | None seeded in M03. Topic progress is derived (BR-19) from the M05 answer-log anchors: `pelajarmaju` sessions M1–M4 (M05 SRS §6.12) give MATH D1 Bab 1 23 answers / 19 correct / 3 sessions, Bab 2 7 / 3 / 2, Bab 3 7 / 4 / 2 → legacy topics 1 "Nombor" 95 % mastered, 7 "Nombor Bulat Hingga 100" 15 % started, "Bentuk" 20 % started, "Operasi Tambah dan Tolak" 0 % unlocked, "Bentuk dan Ruang" locked | BR-14/15/19, S13/S14 values |
| Question counts | Not seeded in M03: computed from the M04 D11 dataset (FR-98) | FR-98 |

### 6.10 Dataset spec (overview §6.6 X-7, ADR-0013)

**Out-of-tree chapters (XL3-24) — alternatives:** (a) add the 60 observed chapters as records with `inTree = false` (chosen): one definition then reproduces both observed figures (M03 tree 1,251, M17 S10 1,311) and the per-subject M17 tiles, with no constant; (b) make the M17 S10 sum a documented display constant: rejected, because the per-subject tiles would also need constants and M17 would show computed and constant chapter figures side by side, which the D11 exception forbids. Only `subjectId` and the counts are observed; every other field of the 60 is designed and none is displayed.

**Decision:** every M03 curriculum store is a **small seeded (materialised) set**, not a virtual dataset. The largest has 2,423 rows, and the live site shows every row of the collection. There is no live total that exceeds the rows shown, so there is nothing to generate: the seed is the whole observed collection (`docs/discovery/inventory/M03/_curriculum-data.json`, captured 2026-09-25), loaded once at boot into materialised tables that implement the same `Store` interface. Every M03 count (S1 cards, S6/S9 "Jumlah", S9 "Subjek", S12 filters, S14 totals) is computed from these tables. The "Soalan" counts are **not** M03 data: they are the M04 `questions` dataset queries Q-ACTIVE(subject) / Q-ACTIVE(level) (M04 SRS §4.1; FR-98). M03 provides that dataset's allowed subject × level combinations (the 194 links below) for its `fit2d` step. The live marginals disagree (subjects sum 129,389, levels sum 129,380), so the total is the M04 SRS's D9 value (M04 §4.1: Q-ACTIVE = 129,389); M03 asserts no total.

| Store (entity) | Total | Count-relevant fields | Observed counts (source: `_curriculum-data.json`) | Id range | Anchors (kept live ids) | D9 values |
|---|---|---|---|---|---|---|
| Levels (DATA-M03-01) | 11 | `stage`, `isActive`, `order` | `primary` 6, `lower_secondary` 3, `upper_secondary` 2; all 11 active (`educationLevels`) | 1–11 (live) | all 11 (live ids = live data) | none |
| Subjects (DATA-M03-02) | 31 | `isCore`, `isActive`, `order` | 7 core ("Teras"), 24 elective; all 31 active (`subjects`) | 1–31 (live) | all 31 | DV-M03-01 affects only rendering of `icon` (data kept as stored) |
| Subject × level links (pivot `SubjectLevel`) | 194 | `subjectId`, `educationLevelId` | 194 pairs (`subjects[].education_level_ids`; `totals.combos`); per-level "Subjek" 16/16/16/17/17/17/15/15/15/25/25; 4 subjects with no level | no own id (composite key) | all 194 | none |
| Curriculum chapters (DATA-M03-03) | 1,251 | `subjectId`, `educationLevelId`, `isActive`, `chapterNumber` | 1,251 (`totals.chapters`) over 140 pairs; 54 pairs empty; per level D1 41 · D2 41 · D3 33 · D4 34 · D5 35 · D6 36 · T1 183 · T2 329 · T3 296 · T4 117 · T5 106 (`byLevel`); per subject `bySubject` (e.g. BM 84, MATH 94, SCI 109) | ≤ 1,281, not contiguous (seed ids for unobserved rows; live ids not harvested) | 31 kept live ids: 35, 36, 91, 92 (opened in M03); 1, 3, 18, 57, 120, 142, 164, 179, 263, 325 (M05 chapter pages); 258–262, 1280, 1281 (Perniagaan T5), 413 (BM T5), 347, 362–369 (Sains T5) (M10 chapter selects) | DV-M03-09 (a): 334 chapter numbers ≥ 100 in 11 trees renumbered after the highest number < 100 |
| Out-of-tree chapters (DATA-M03-03, `inTree = false`) | 60 | `subjectId`, `inTree` | Pendidikan Muzik 56 · Pendidikan Syariah Islamiah 3 · Sains Rumah Tangga 1 (source: M17 S10 per-subject counts, M17 SRS R-14 / XR-M17-19, minus the tree's per-subject counts; not in `_curriculum-data.json`) | 1282–1341 (seed ids) | none (live ids not observed) | none; fields other than `subjectId` are designed (§6.9) |
| Curriculum topics (DATA-M03-04) | 2,423 | `chapterId`, `isActive`, `topicNumber` | 2,423 (`totals.topics`); per level D1 55 · D2 57 · D3 47 · D4 48 · D5 51 · D6 51 · T1 356 · T2 418 · T3 334 · T4 530 · T5 476 | 1–2,423 (seed ids) | 59, 60, 126, 127 | DV-M03-09 (b): topics renumbered 1…n in the 102 chapters with repeated topic numbers (478 repeats) |
| Curriculum subtopics (DATA-M03-05) | 234 | `topicId` | 234 (`totals.subtopics`), only in BM, BI, MATH, SCI at D1–D6 (24 pairs); per level D1 35 · D2 37 · D3 40 · D4 36 · D5 43 · D6 43 | 1–234 (seed ids) | 132, 133, 134 | none |
| Student topic catalogue (DATA-M03-06) | 125 | `gradeLevel`, `subject`, `sequence` | per grade DARJAH_1 17 · DARJAH_2 11 · DARJAH_3 9 · DARJAH_4 9 · DARJAH_5 8 · DARJAH_6 8 · TINGKATAN_1 34 · TINGKATAN_4 19 · TINGKATAN_5 10 (TINGKATAN_2/3: 0); per subject MATEMATIK 34 · SAINS 35 · BAHASA_MELAYU 15 · PENDIDIKAN_MORAL 12 · SEJARAH 11 · PENDIDIKAN_ISLAM 7 · BAHASA_INGGERIS 6 · GEOGRAFI 5 (`legacyTopics`) | 1–125 (live, contiguous) | all 125 | none (the Geografi pill is removed by DV-M03-08, the data is unchanged) |
| Catalogue subtopics (LegacySubtopic) | 335 | `legacyTopicId`, `order` | 335 = sum of `subtopic_count` (1–6 per topic); names from `subtopics_preview` + audit Appendix A | 1–335 (seed ids, catalogue order) | none | none |

Rules shared by all eight stores:
- **Seed ids:** where live ids were not harvested (chapters, topics, subtopics, catalogue subtopics), ids are assigned in dataset order. The anchors keep their live ids, and every other row gets the next free integer, skipping reserved ids (§6.9). Runtime creates get max id + 1, which gives the floors (F-24): chapter 1342 (above the out-of-tree ids 1282–1341, which follow the kept id 1281; ids 1250–1279 are unused), topic 2424, subtopic 235, subject 32, level 12.
- **Mutations:** admin create/update/delete write the table directly (no overlay is needed for materialised stores). Deletes cascade per BR-10.
- **Per-user derived values** are computed from other owners' stores and are not M03 datasets: topic progress from the M05 answer log (BR-19) and "Soalan" from the M04 dataset.
- **Revisit:** if a later module shows a curriculum total larger than the seeded rows, that store becomes a virtual dataset under ADR-0013. No such total is known.

### 6.11 Named queries (D11 / overview §6.6–6.7; implemented by F-24 `src/modules/m03-curriculum/mock/repository/queries.ts`)

Every M03 figure a screen shows is one of these counts on the owner's tables (default seed, override `curriculumInactiveDemo` off). The expected values are checked by `checkNamedQueries` in the tests. Other modules cite these names (e.g. M01 `levelCount` = LVL-ALL, `subjectCount` = SUBJ-ALL; M06 "Subjek SPM").

| Query | Definition | Expected value | Used by |
|---|---|---|---|
| LVL-ALL | all levels | 11 | S9 "Jumlah: n tahap"; M01 `levelCount` |
| LVL-ACTIVE | `isActive = true` | 11 | lookups (#29) |
| LVL-STAGE(stage) | `stage = s` | primary 6 · lower_secondary 3 · upper_secondary 2 | stage split |
| SUBJ-ALL | all subjects | 31 | S6 "Jumlah: n subjek"; M01 `subjectCount` |
| SUBJ-ACTIVE | `isActive = true` | 31 | lookups (#28) |
| SUBJ-CORE | `isCore = true` | 7 | "Teras" |
| LINK-ALL | all subject × level links | 194 | §6.10; M04 `fit2d` allowed cells |
| LINK-LEVEL(level) | links of one level | D1–D6 16/16/16/17/17/17, T1–T3 15/15/15, T4–T5 25/25 | S9 "Subjek" |
| LINK-SUBJECT(subject) | links of one subject | 0 for subjects 28–31 (e.g. Matematik 11) | S6 level line |
| LINK-LEVELS(levels) | links whose level is in the list | — (parameterised) | M06 "Subjek SPM" = `groupCount('LINK-LEVELS', 'subjectId', [10, 11]).size` = **25** |
| CH-ALL | chapters with `inTree = true` | 1,251 | §6.10 |
| CH-ALL-INCL-ORPHAN | all chapters, in or outside the tree | 1,311 | M17 S10 "Status Kurikulum" Σ (Q-M17-CHAPTERS) |
| CH-SUBJECT-INCL-ORPHAN(subject) | all chapters of one subject, in or outside the tree | Pendidikan Muzik 56 · Pendidikan Syariah Islamiah 9 · Sains Rumah Tangga 1 · Matematik 94 | M17 S10 per-subject tiles |
| CH-LEVEL(level) | tree chapters (`inTree = true`) of one level | D1 41 · D2 41 · D3 33 · D4 34 · D5 35 · D6 36 · T1 183 · T2 329 · T3 296 · T4 117 · T5 106 | §6.10 |
| CH-SUBJECT(subject) | tree chapters of one subject | BM 84 · Matematik 94 · Sains 109 (full list `bySubject`) | §6.10 |
| CH-PAIR(subject, level) | tree chapters of one pair | Matematik T4 10 · BI T3 0 · Matematik Tambahan D1 0 | S1 "Jumlah Bab" (E2E-02, E2E-07) |
| TP-ALL | all topics | 2,423 | §6.10 |
| TP-CHAPTER(chapter) | topics of one chapter | — | S1 tree |
| TP-CHAPTERS(chapters) | topics of the listed chapters | Matematik T4 chapters → 24 | S1 "Topik / Subtopik" (first number) |
| ST-ALL | all subtopics | 234 | §6.10 |
| ST-TOPIC(topic) | subtopics of one topic | — | S1 tree |
| ST-TOPICS(topics) | subtopics of the listed topics | BM D1 topics → 7; Matematik T4 → 0 | S1 "Topik / Subtopik" (second number) |
| LT-ALL | all catalogue topics | 125 | S12 default list |
| LT-GRADE(grade) | `gradeLevel` (case-insensitive, BR-13) | DARJAH_1 17 · 2 11 · 3 9 · 4 9 · 5 8 · 6 8 · TINGKATAN_1 34 · 2 0 · 3 0 · 4 19 · 5 10; `darjah_1` 17 | S12 filter |
| LT-SUBJECT(subject) | `subject` (case-insensitive) | MATEMATIK 34 · SAINS 35 · BAHASA_MELAYU 15 · PENDIDIKAN_MORAL 12 · SEJARAH 11 · PENDIDIKAN_ISLAM 7 · BAHASA_INGGERIS 6 · GEOGRAFI 5 · ZZZ 0 | S12 filter |
| LT-FILTER(grade, subject) | both filters, AND; null = no filter | DARJAH_1 + SAINS 4 · (none) 125 | S12 list size (E2E-36) |
| LS-ALL | all catalogue subtopics | 335 | §6.10 |
| LS-TOPIC(topic) | subtopics of one catalogue topic | topic 7 → 4 · topic 103 → 6 | S12 "{n} Subtopik", S13 |

"Soalan" counts are not M03 queries (M04 §4.1 Q-ACTIVE(subject) / Q-ACTIVE(level), FR-98).

## 7. Mock API endpoints

*(solution-architect)* Base `/api`, envelope/error/locale conventions of SRS.md §7 with the M01 extensions. **AD** = admin session required (guest `401 UNAUTHORIZED` → `/login`; other roles `403 FORBIDDEN`); **A** = any session. Every call has the configurable mock latency (NFR-M03-02). The live site has **no JSON read endpoints** for M03 (all pages are server-rendered; the only JSON calls are the two switches); these read endpoints exist so the SPA prototype can render the same pages and so a future backend has a contract (D2). Lists are not paginated (as live); they still use the `{data, meta}` envelope with `meta.totalItems` and `page: 1`, `pageSize = totalItems`, `totalPages: 1`.

| # | Method | Path | Auth | Mut. | Request | Success | Errors | Live equivalent |
|---|---|---|---|---|---|---|---|---|
| 1 | GET | `/api/admin/subjects` | AD | no | — | 200 envelope `{data: SubjectListItem[]}` where `SubjectListItem = Subject + {questionCount, levels:[{id, name}]}` (BR-08 order) | 401, 403 | `GET /admin/subjects` (HTML) |
| 2 | GET | `/api/admin/subjects/:id` | AD | no | — | 200 `{data: Subject}` | 404 `NOT_FOUND` (→ FR-45) | `GET /admin/subjects/{id}/edit` |
| 3 | POST | `/api/admin/subjects` | AD | yes | `{name, nameEn, code, icon?, color, isCore, order, educationLevelIds}` | 201 `{data: Subject, status}` | 422 `fields` | `POST /admin/subjects` |
| 4 | PUT | `/api/admin/subjects/:id` | AD | yes | same as #3 | 200 `{data: Subject, status}` | 422; 404 | `PUT /admin/subjects/{id}` |
| 5 | PATCH | `/api/admin/subjects/:id/active` | AD | yes | `{isActive: boolean}` | 200 `{data:{id, isActive}}` | 404; 500 (fault injection) | `POST /admin/subjects/{id}` JSON `{_method:'PUT', is_active}` |
| 6 | DELETE | `/api/admin/subjects/:id` | AD | yes | — | 200 `{data:{deleted:1}, status}` | 404 | `DELETE /admin/subjects/{id}` |
| 7 | GET | `/api/admin/education-levels` | AD | no | — | 200 envelope `{data: (EducationLevel + {questionCount, subjectCount})[]}` | 401, 403 | `GET /admin/education-levels` |
| 8 | GET | `/api/admin/education-levels/:id` | AD | no | — | 200 `{data: EducationLevel}` | 404 (→ FR-62) | `GET …/{id}/edit` |
| 9 | POST | `/api/admin/education-levels` | AD | yes | `{name, nameEn, code, stage, curriculum, order}` | 201 `{data, status}` | 422 | `POST /admin/education-levels` |
| 10 | PUT | `/api/admin/education-levels/:id` | AD | yes | same as #9 | 200 `{data, status}` | 422; 404 | `PUT /admin/education-levels/{id}` |
| 11 | PATCH | `/api/admin/education-levels/:id/active` | AD | yes | `{isActive}` | 200 `{data:{id, isActive}}` | 404; 500 | `POST …/{id}` JSON `{_method:'PUT', is_active, _toggle_only:true}` |
| 12 | DELETE | `/api/admin/education-levels/:id` | AD | yes | — | 200 `{data:{deleted:1}, status}` | 404 | `DELETE /admin/education-levels/{id}` |
| 13 | GET | `/api/admin/curriculum` | AD | no | `?subjectId=&educationLevelId=` (both required) | 200 `{data:{subject:{id, name}, level:{id, name}, stats:{chapters, topics, subtopics}, chapters: ChapterNode[]}}`; `ChapterNode = CurriculumChapter + {topics: (CurriculumTopic + {subtopics: CurriculumSubtopic[]})[]}` (BR-08 order) | 422 (missing param); 404 (unknown subject/level) | `GET /admin/curriculum?subject_id=&education_level_id=` |
| 14 | GET | `/api/admin/curriculum/chapters/:id` | AD | no | — | 200 `{data: CurriculumChapter + {subject:{id, name}, level:{id, name}}}` | 404 (→ "Bab tidak dijumpai.") | S3 / S4 context |
| 15 | POST | `/api/admin/curriculum/chapters` | AD | yes | `{subjectId, educationLevelId, name, nameEn?, chapterNumber?, description?}` | 201 `{data: CurriculumChapter, status}` | 422 | `POST /admin/curriculum/chapters` |
| 16 | PUT | `/api/admin/curriculum/chapters/:id` | AD | yes | #15 + `isActive` | 200 `{data, status}` | 422; 404 | `PUT …/chapters/{id}` |
| 17 | DELETE | `/api/admin/curriculum/chapters/:id` | AD | yes | — | 200 `{data:{deleted:{chapters:1, topics, subtopics}}, status}` | 404 | `DELETE …/chapters/{id}` |
| 18 | GET | `/api/admin/curriculum/topics/:id` | AD | no | — | 200 `{data: CurriculumTopic + {chapter: CurriculumChapter + {subject, level}}}` | 404 | S5 |
| 19 | POST | `/api/admin/curriculum/topics` | AD | yes | `{chapterId, name, nameEn?, topicNumber?, description?, learningStandard?}` | 201 `{data, status}` | 422 (incl. unknown chapter) | `POST /admin/curriculum/topics` |
| 20 | PUT | `/api/admin/curriculum/topics/:id` | AD | yes | #19 without `chapterId` + `isActive` | 200 `{data, status}` | 422; 404 | `PUT …/topics/{id}` |
| 21 | DELETE | `/api/admin/curriculum/topics/:id` | AD | yes | — | 200 `{data:{deleted:{topics:1, subtopics}}, status}` | 404 | `DELETE …/topics/{id}` |
| 22 | POST | `/api/admin/curriculum/subtopics` | AD | yes | `{topicId, name, nameEn?, learningObjective?}` | 201 `{data, status}` | 422 | `POST /admin/curriculum/subtopics` |
| 23 | PUT | `/api/admin/curriculum/subtopics/:id` | AD | yes | `{name, nameEn?, learningObjective?}` | 200 `{data, status}` | 422; 404 | `PUT …/subtopics/{id}` |
| 24 | DELETE | `/api/admin/curriculum/subtopics/:id` | AD | yes | — | 200 `{data:{deleted:1}, status}` | 404 | `DELETE …/subtopics/{id}` |
| 25 | GET | `/api/topics` | A | no | `?gradeLevel=&subject=` | 200 envelope `{data:[{id, gradeLevel, subject, subjectLabel, name, description, subtopicCount, subtopicsPreview: string[] (≤3)}]}` | 401 | `GET /topics` (HTML) |
| 26 | GET | `/api/topics/:id` | A | no | — | 200 `{data:{…LegacyTopic, subjectLabel, practiceCode, subtopics:[{id, name, description, progress}], progress:{questionsAnswered, progress}}}` (current user) | 404 (→ global 404 page) | `GET /topics/{id}` |
| 27 | GET | `/api/learning-map` | A | no | `?subject=&grade=` (both optional) | 200 `{data:{subject, subjectLabel, grade (the served grade: DARJAH_1…4), gradeOptions: ["DARJAH_1","DARJAH_2","DARJAH_3","DARJAH_4"], subjects:[{code, label, emoji, color}] (7), stats:{done, total, progress}, topics:[{id, name, icon, state:'mastered'\|'started'\|'unlocked'\|'locked', progress, sessions, questionsAnswered, practiceUrl \| null}]}}` (BR-14/15) | 401 | `GET /peta-belajar` |
| 28 | GET | `/api/subjects` | A | no | `?educationLevelId=` optional (filters to subjects linked to that level; an unknown or non-numeric value is ignored and the full active list is returned, no error — INFERRED) | 200 `{data:[{id, code, name, nameEn, icon, color, isCore, educationLevelIds}]}` — active only, BR-08 order | 401 | none (for M04/M05) |
| 29 | GET | `/api/education-levels` | A | no | — | 200 `{data:[{id, code, name, nameEn, stage, grade}]}` — active only | 401 | none (for M01/M02/M04/M05) |

Notes:
- `status` fields carry the success flash text of §8 (UNVERIFIED COPY); the client shows it on the redirect target (FR-22).
- Endpoint #5 replaces the live JSON `POST` + `_method` spoof; #11 likewise (`_toggle_only` is implied: only `isActive` changes).
- Mock-only helpers (dev/E2E, not part of the REST contract): the M01 helpers (`mock.reset()`, `mock.setLatency(ms)`, `mock.failNext(path, code)`, `mock.expireSession()`) plus `mock.networkErrorNext(path)` (the next matching call rejects like a network failure, for "Ralat rangkaian"). Topic progress changes only through the M05 answer log (e.g. submitting a practice session through M05 §7); M03 never writes it.

## 8. States & messages

**Observed copy (exact).**

| Screen | State | Copy |
|---|---|---|
| S1 | Prompt (no pair) | "Sila pilih subjek dan tahap pendidikan" · "Gunakan penapis di atas" |
| S1 | Empty tree | "Tiada bab dijumpai untuk subjek dan tahap ini." · "Tambah Bab Pertama" |
| S1 | Empty subtopics | "Tiada subtopik" |
| S1 | Confirms (native) | "Adakah anda pasti mahu padam bab ini?" · "Adakah anda pasti mahu padam topik ini?" · "Adakah anda pasti mahu padam subtopik ini?" |
| S1 | Tooltips | "Edit Bab" · "Padam Bab" · "Edit Topik" · "Padam Topik" · "Edit Subtopik" · "Padam Subtopik" |
| S1 | Add toggle | "Tambah Subtopik" ↔ "Batal" ("Batal" on both inline forms only hides them; typed text stays until reload) |
| S1 | Error flashes | "Bab tidak dijumpai." · "Chapter ID diperlukan." · "Topik tidak dijumpai." (S5 unknown topic → S1) |
| S6 | Error flash | "Subjek tidak dijumpai." |
| S6 | Confirm | "Adakah anda pasti mahu padam subjek ini?" |
| S6, S9 | Tooltips | "Edit" · "Padam" |
| S6, S9 | Switch failure alerts | "Gagal kemaskini status" · "Ralat rangkaian" (S6 per DV-M03-07) |
| S9 | Error flash | "Tahap Pendidikan tidak dijumpai." |
| S9 | Confirm | "Adakah anda pasti mahu padam tahap pendidikan ini?" |
| S12 | Empty | "Tiada topik tersedia buat masa ini." |
| S13 | Not found | global 404 page (M01) |
| S14 | Empty | "🗺️" · "Tiada Topik Dijumpai" · "Pilih subjek dan darjah yang lain untuk melihat peta belajar" |
| S14 | Islands | "🎯 BUKA" · "🔒 TERKUNCI" · "Selesaikan topik sebelumnya dulu" · "{s} sesi · {q} soalan dijawab" |
| All | Loading | none: pages appear when their data is ready (live pages are server-rendered); with the mock latency the content area stays empty until then |

**UNVERIFIED COPY (placeholders until URS OQ-1 / OQ-4 are resolved).** Success messages show in the green alert box (green-50 background, green-200 border, green-700 text, circle-check icon) at the top of the content (INFERRED).

| Situation | Prototype copy | Basis |
|---|---|---|
| Chapter created / updated / deleted | "Bab berjaya ditambah." · "Bab berjaya dikemaskini." · "Bab berjaya dipadam." | Placeholder |
| Topic created / updated / deleted | "Topik berjaya ditambah." · "Topik berjaya dikemaskini." · "Topik berjaya dipadam." | Placeholder |
| Subtopic added / updated / deleted | "Subtopik berjaya ditambah." · "Subtopik berjaya dikemaskini." · "Subtopik berjaya dipadam." | Placeholder |
| Subject created / updated / deleted | "Subjek berjaya ditambah." · "Subjek berjaya dikemaskini." · "Subjek berjaya dipadam." | Placeholder |
| Level created / updated / deleted | "Tahap Pendidikan berjaya ditambah." · "Tahap Pendidikan berjaya dikemaskini." · "Tahap Pendidikan berjaya dipadam." | Placeholder |
| Validation errors | §5 | Laravel defaults |
| Island label `mastered` / `started` | "⭐ DIKUASAI" · "📘 SEDANG BELAJAR" | Placeholder (CSS states exist; labels not observed) |
| Page data failed to load (mock fault) | red flash "Ralat memuatkan data. Sila cuba semula." | Placeholder (no live equivalent: server errors show the framework error page) |
| S1 | Nonsense `subject_id` / `education_level_id` in the URL (unknown or non-numeric, so #13 answers 404 or 422) | the same red load-error box "Ralat memuatkan data. Sila cuba semula." | INFERRED, live behaviour not observed: Perlu pengesahan |

## 9. Permissions matrix

| Role | Can view | Can create | Can edit | Can delete | Notes |
|---|---|---|---|---|---|
| Admin | S1–S14 | Chapters, topics, subtopics, subjects, levels | All of them; active switches (subjects, levels) and "Aktif" (chapters, topics) | Chapters, topics, subtopics, subjects, levels (cascade BR-10, INFERRED) | Legacy catalogue read-only (no screen) |
| Pelajar | S12–S14 (INFERRED) | — | — | — | Sees own progress on S13/S14 |
| Guru, Ibu Bapa, Penaja, Admin Sekolah, Pegawai PPD, Pegawai JPN | S12–S14 (INFERRED; shell items shown to the admin in the portal) | — | — | — | May call `/api/subjects`, `/api/education-levels` |
| Guest | — | — | — | — | Redirect to `/login` (INFERRED) |

## 10. Responsive behaviour

The live admin shell switches at 1024 px (sidebar ≥1024; header + bottom nav + "Lagi" menu below); the user shell likewise (sidebar ≥1024; drawer + bottom nav below). The rebuild keeps the live layout at each width, mapped to Tailwind breakpoints (NFR-RESP-02), changed only by DV-M03-03 and 06. No horizontal page scroll at 320–1920 px (live has none on any of the 71 captured states); touch targets ≥44 px on touch viewports (NFR-RESP-03).

| Screen | 375 (mobile) | 768 (tablet) | 1280 (desktop) | Breakpoints | Deviation |
|---|---|---|---|---|---|
| Admin shell | Header, bottom nav, "Lagi" menu with "KURIKULUM" section | Same as 375 | Sidebar with "KURIKULUM" group open | `lg` | none |
| S1 | Filter 2 columns + full-width "Tapis"; cards 2×2; tree indentation/padding reduced below `sm` (as live); names wrap; text ≥12 px | Filter 3 columns; cards 4 across; full tree indentation | Same as 768 | `sm` (tree), `md` (filter, cards) | DV-M03-06 |
| S2–S5, S7, S8, S10, S11 | Single card full width; "Batal" + submit side by side, right-aligned (they fit); S7/S8 level list one column in a 256 px scroll box | Same | Single card, max width; same button row and level box | — | none |
| S6 | Table scrolls inside its card; level line wraps; "Soalan" number only and "Warna" swatch only (below `sm`, as live); text ≥12 px | Table scrolls inside its card; "{n} soalan" and hex shown | All 10 columns fit | `sm`, `xl` (fit) | DV-M03-03, DV-M03-06b |
| S9 | Table scrolls inside its card | Table scrolls inside its card | Fits | — | none |
| User shell | Header, drawer, bottom nav ("Topik") | Same as 375 | Sidebar with "Topik", "Peta Belajar" | `lg` | none |
| S12 | Cards 1 column; chips wrap (7 grade + 8 subject chips, as live); text ≥12 px | 2 columns | 3 columns | `sm`, `lg` | DV-M03-06b (sizes) |
| S13 | Stat cards 3 across; subtopic cards 1 column; text ≥12 px (DV-M03-06b) | 3 across; 2 columns | 3 across; 2 columns | `sm` | DV-M03-06b (sizes) |
| S14 | Hero bar only (tiles hidden); 7 pills wrap; 4 grade chips in one row; islands centred, no path/dots; text ≥12 px | Tiles shown; islands centred, no path/dots (≤768) | Tiles; path, dots, alternating islands | `md` (tiles), 769 px (map) | DV-M03-06b (sizes), DV-M03-08 (no Geografi pill) |

## 11. Non-functional requirements

| ID | Category | Requirement | Specialises |
|---|---|---|---|
| NFR-M03-01 | Fidelity override | M03 overrides FR-G-07 (no pagination on S6/S9/S12, as live), FR-G-08 (no filters/sorting on S6/S9), FR-G-09 (native validation + server error box) and FR-G-10 (no skeletons; the only error state is the placeholder flash of §8) per D7. | FR-G-07..10 |
| NFR-M03-02 | Testability | As M01 NFR-M01-02 (latency default 400 ms, `mock.failNext`, `mock.reset`) plus `mock.networkErrorNext` (§7); progress scenarios use the M05 answer-log seeds or M05 practice submits. E2E handles native confirms/alerts with `page.on('dialog')`. | NFR-07 |
| NFR-M03-03 | Performance | The full seed (2,423 topics) is loaded lazily per subject × level pair: `GET /api/admin/curriculum` returns only the selected tree (largest: SCI T4 121 topics, BIO T4 225 topics) and renders within the NFR-01 budget; S12 renders 125 cards on one page. | NFR-01 |
| NFR-M03-04 | Security — for the backend phase (**security-engineer review required**) | **SEC-M03-01** all mutating curriculum endpoints (including both switches) must be admin-only server-side and CSRF-protected; the live switches post JSON with only a CSRF header. **SEC-M03-02** cascading deletes of subjects/levels/chapters (hundreds of records, only a browser confirm, no audit or soft delete) need confirmation, audit logging and a check against M04 references. **SEC-M03-03** the live site writes the free-text `icon` into an HTML `class` attribute; the rebuild resolves it to known icons only (BR-05) and the backend must validate it. **SEC-M03-04** free-text fields (names, descriptions, learning standards) must be escaped on output. | NFR-04 |
| NFR-M03-05 | Accessibility (D10) | Accessibility behaviour replicates live, with no enhancements: labels, tooltips (`title`), native confirms/alerts, no added ARIA or keyboard handling, and no reduced-motion handling (`pulse-glow` and the island fade-in run as live; live has no `prefers-reduced-motion` rule of its own). Only D9-broken items are fixed: DV-M03-06 (truncated and <12 px text). | NFR-02 |
| NFR-M03-06 | Visual fidelity | Colours, gradients, radii as `00-global-ui.md` §6 and discovery §2. Font Awesome → Lucide mapping for UI icons (must agree with `docs/design/design-system.md` §6, the single mapping authority): `fa-filter`→`Funnel`, `fa-search`→`Search`, `fa-info-circle`→`Info`, `fa-book`→`Book`, `fa-graduation-cap`→`GraduationCap`, `fa-book-open`→`BookOpen`, `fa-list`→`List`, `fa-plus`→`Plus`, `fa-minus`→`Minus`, `fa-inbox`→`Inbox`, `fa-chevron-down/right`→`ChevronDown/ChevronRight`, `fa-edit`→`SquarePen`, `fa-trash`→`Trash`, `fa-save`→`Save`, `fa-arrow-left`→`ArrowLeft`, `fa-exclamation-circle`→`CircleAlert`, `fa-lightbulb`→`Lightbulb`, `fa-sort`→`ArrowUpDown`, `fa-star`→`Star`, `fa-child`→`Baby`, `fa-book-reader`→`BookOpenText`, `fa-user-graduate`→`GraduationCap`, `fa-check-circle`→`CircleCheck`, `fa-eye`→`Eye`, `fa-question-circle`→`CircleQuestionMark`, `fa-chart-line`→`ChartLine`, `fa-circle`→`Circle`, `fa-play`→`Play`, `fa-sitemap`→`Network`, `fa-map`→`Map`. Emoji stay emoji. | — |

## 12. E2E test scenarios

Every scenario runs on the **mobile (375×812), tablet (768×1024) and desktop (1280×800)** Playwright projects, starts from `mock.reset()`, logs in as `admin@demo.test` unless stated, and uses the §6.9 seeds. Assertions are viewport-aware where the live layout differs by width (sidebar vs bottom nav/"Lagi", hero tiles, map path). Native confirms/alerts are handled with `page.on('dialog')`.

| ID | Scenario (abridged) | ACs | FRs |
|---|---|---|---|
| E2E-M03-01 | S1 default: header, tab title, filter card labels, 32 subject options (first "-- Pilih Subjek --", then by id), 12 level options; prompt card texts; `?subject_id=3` only → prompt, no tree. | 01.1, 01.2, 01.3 | 01, 02, 04 |
| E2E-M03-02 | Choose Matematik + Tingkatan 4 → "Tapis": URL `?subject_id=3&education_level_id=10`, selects keep values, cards "Matematik", "Tingkatan 4", "10", "24 / 0"; "Tambah Bab" href. | 01.4, 02.1 | 03, 05, 06 |
| E2E-M03-03 | Tree Matematik T4: chapters expanded with "Bab n: …" and descriptions, topics collapsed with descriptions; chapter chevron hides/shows topics and flips icon; topic chevron shows "Tiada subtopik". | 01.5, 01.6 | 08, 12, 16 |
| E2E-M03-04 | BM Darjah 1: open "Topik 1: Mendengar dan Memahami" → two subtopic rows with icons and buttons. | 01.7 | 16 |
| E2E-M03-05 | Ordering: Matematik D1 chapters read Bab 1…8 in order; SK T3 has no chapter number ≥100 and no repeated "Topik n" inside a chapter (DV-M03-09 seed); Matematik T4 Bab 1 topics "Topik 1", "Topik 2", "Topik 3". | 01.8 | 11 |
| E2E-M03-06 | `mockInit` sets the override `curriculumInactiveDemo: true`. Sejarah + Darjah 1: the inactive test-only chapter "Bab 3: Bab Tidak Aktif Demo" and its inactive topic are listed without a marker and counted ("Jumlah Bab" 3, "3 / 0"). | 01.9 | 23 |
| E2E-M03-07 | Empty trees: BI + T3 (cards 0, "0 / 0", inbox text, "Tambah Bab Pertama" href); Matematik Tambahan + D1 same, no warning. | 02.2, 02.3 | 07 |
| E2E-M03-08 | "Tambah Topik" after every chapter's topics (incl. a chapter with none) → `topics/create?chapter_id=`. | 02.4 | 15 |
| E2E-M03-09 | Delete chapter: tooltip "Padam Bab"; dismiss confirm → unchanged; accept → chapter, its topics and subtopics gone, cards updated, success flash, same URL. | 03.1, 03.2, 03.3 | 10 |
| E2E-M03-10 | Delete topic ("Padam Topik") and subtopic ("Padam Subtopik"): confirm texts, cancel keeps, accept removes + flash; topic delete removes its subtopics. | 03.1, 03.2, 03.3 | 14, 19 |
| E2E-M03-11 | Add subtopic: toggle "Tambah Subtopik" ↔ "Batal", form placeholders; type "Draf", press "Batal" → form hidden, nothing saved; reopen → "Draf" still in the field; reload → field empty; empty name blocked (native); valid → appended last + flash. | 04.1, 04.2, 04.3 | 20, 21 |
| E2E-M03-12 | Edit subtopic: button "Edit Subtopik" → pre-filled form; change the name, "Batal" → row shows the stored name, nothing saved; reopen → the changed text is still in the input; reload → stored value; opening another row closes the first; change + "Simpan" → new name + flash. | 04.4, 04.5 | 17, 18 |
| E2E-M03-13 | Flashes: `/admin/curriculum/chapters/zzz/edit` and `topics/create?chapter_id=zzz` → "Bab tidak dijumpai." on `/admin/curriculum`; `topics/create` → "Chapter ID diperlukan."; `/admin/curriculum/topics/zzz/edit` → "Topik tidak dijumpai."; reload → flash gone. | 05.1, 05.2, 05.3, 05.4 | 22, 31, 35, 38 |
| E2E-M03-14 | S2 from "Tambah Bab" (Matematik T4): header, tab title, selects pre-selected, field labels/placeholders/hint, no "Aktif". | 06.1, 06.2 | 25, 26 |
| E2E-M03-15 | S2 without query: selects on "-- Pilih … --"; back link and "Batal" → `/admin/curriculum`; with both parameters → the filtered URL; with `?subject_id=3` only → `/admin/curriculum?subject_id=3`. | 06.3 | 25 |
| E2E-M03-16 | S2 native validation (empty name; "Nombor Bab" 0) blocks; valid "Bab 11 Demo" number 11 → S1 tree of the pair, listed last in number order, flash; `mock.failNext` 422 → red error box, input kept. | 06.4, 06.5 | 26, 27 |
| E2E-M03-17 | S3 chapter 91 via "Edit Bab": header, tab title, pre-filled values, "Aktif" checked + hint, back links → `?subject_id=3&education_level_id=10`. | 07.1, 07.2 | 09, 28, 29 |
| E2E-M03-18 | S3 save with "Aktif" unticked → still listed; change level to Tingkatan 5 → lands on T5 tree with the chapter and its topics, flash. | 07.3, 07.4 | 30 |
| E2E-M03-19 | S4 chapter 91: header, tab title, context card and chips, fields/hints, no "Aktif"; empty name blocked; valid → tree + flash, topic in number order. | 08.1, 08.2, 08.3, 08.4 | 32, 33, 34 |
| E2E-M03-20 | S5 topic 126 via "Edit Topik": header, tab title, context card, values, "Aktif" + hint, no chapter select; save → tree + flash. | 09.1, 09.2, 09.3 | 13, 36, 37, 38 |
| E2E-M03-21 | S6: header, tab title, "Senarai Subjek", "Jumlah: 31 subjek", "Tambah" href; displayed headers upper-case; 31 rows by id; row 8 level line "Tingkatan 4, Tingkatan 5", row 28 no level line; Kod pill, hex "#0f766e" row 27, Teras/Elektif, "Soalan" = M04 §4.1 Q-ACTIVE(subject) ("13872 soalan" for Matematik, as live); at 375 "Soalan" reads the number only and "Warna" shows no hex; tooltips "Edit"/"Padam", edit href. | 10.1, 10.2, 10.3, 10.5 | 39, 40, 43, 98 |
| E2E-M03-22 | S6 icons: each of the 29 subjects with a non-empty icon renders a visible glyph (svg or emoji text) in its colour; rows 30–31 tiles empty; tile background = colour + "20". | 10.4 | 41 |
| E2E-M03-23 | S6 switch: on/off styles; click → flips, no dialog; reload → persisted. | 11.1, 11.2 | 42 |
| E2E-M03-24 | S6 switch failures: `mock.failNext` 500 → reverts + alert "Gagal kemaskini status"; `mock.networkErrorNext` → reverts + alert "Ralat rangkaian". | 11.3 | 42 |
| E2E-M03-25 | Lookups: deactivate subject 12 on S6 and level 11 on S9 → `GET /api/subjects` / `/api/education-levels` omit them, admin lists still show them; order by `order`. | 11.4, 16.3, 30.2 | 96 |
| E2E-M03-26 | S6 delete: cancel confirm → unchanged; accept on "Sains Sukan" → row gone, "Jumlah: 30 subjek", flash; its S1 filter option gone. | 12.1, 12.2 | 43, 44 |
| E2E-M03-27 | S7: header, tab title, back link; every label/placeholder/hint/default; code placeholder rendered upper-case ("CTH: MATH01", computed `text-transform: uppercase`); "Font Awesome" link target and `_blank`; typing "math02" displays "MATH02", max 20; colour change mirrors text; "Tahap Pendidikan Berkaitan" is one column in a box of max height 256 px with its own vertical scroll (scrollHeight > clientHeight) at every width. | 13.1, 13.2, 13.3, 13.4 | 47, 48, 49, 50, 51, 52 |
| E2E-M03-28 | S7 validation (empty required, order −1) blocked; valid "Sains Demo"/"DEMO01"/D1+D2 → S6 with flash, row active, code upper-case, level line "Darjah 1, Darjah 2", "Jumlah: 32 subjek"; duplicate code with `mock` → red error box. | 13.5, 13.6 | 48, 51, 53 |
| E2E-M03-29 | S8 subject 3: header, tab title, pre-filled values incl. 11 ticked levels, "Kemaskini Subjek", no active field; untick Darjah 1 → S6 flash, level line without Darjah 1, S9 Darjah 1 "15 subjek"; `/admin/subjects/999/edit` → "Subjek tidak dijumpai." | 14.1, 14.2, 14.3 | 45, 54, 55, 56 |
| E2E-M03-30 | S9: header, tab title, count, "Tambah Tahap" href and pink gradient; headers upper-case; 11 rows with values, badges (label, icon), "Soalan" = M04 §4.1 Q-ACTIVE(level) (Darjah 1 "11396 soalan"), "16 subjek" at every width; tooltips, edit href. | 15.1, 15.2, 15.3 | 57, 58, 60, 98 |
| E2E-M03-31 | S9 switch: flips + persists; `failNext` → revert + "Gagal kemaskini status"; `networkErrorNext` → revert + "Ralat rangkaian". | 16.1, 16.2 | 59 |
| E2E-M03-32 | S9 delete: cancel → unchanged; accept on "Tingkatan 5" → row gone, "Jumlah: 10 tahap", flash; "Tingkatan 5" gone from S6 level lines and from the S1 "Tahap" options. | 17.1, 17.2 | 60, 61 |
| E2E-M03-33 | S10: header, tab title, labels/placeholders/hints (incl. "CTH: Y1" displayed upper-case and the info icon), stage options, pink submit; empty required blocked; valid "Tahun Demo"/"yd"/primary/"KSSR" → list flash, "YD", "0 soalan", "0 subjek", "Jumlah: 12 tahap". | 18.1, 18.2, 18.3 | 63, 64, 65 |
| E2E-M03-34 | S11 level 10: header, tab title, values, "Kemaskini Tahap", no active field; save change → flash; `/admin/education-levels/999/edit` → "Tahap Pendidikan tidak dijumpai." | 19.1, 19.2, 19.3 | 62, 66, 67, 68 |
| E2E-M03-35 | S12 default (as pelajar): header, tab title, active chips, 7 grade chips ("Semua Darjah", Darjah 1–6) and 8 subject chips with hrefs, no Tingkatan/GEOGRAFI chip, 125 cards incl. "Kemahiran Geografi" and "Kemahiran Bahasa Tingkatan 4", no pagination. | 20.1, 20.2, 20.3, 20.6 | 69, 70, 71, 72 |
| E2E-M03-36 | S12 filters: `?grade_level=DARJAH_1&subject=SAINS` → 4 named topics, chips keep the other filter; typed `?grade_level=TINGKATAN_4` and `?subject=GEOGRAFI` → matching topics with no grade/subject chip active respectively; `?grade_level=darjah_1` → 17 cards and no grade chip active; typed `?grade_level=TINGKATAN_2` → empty text; `?subject=ZZZ` → empty text. | 20.4, 20.5, 20.6, 20.7 | 70, 71, 72, 74 |
| E2E-M03-37 | S12 cards: "Nombor" card content; "Nombor Bulat Hingga 100" "+1 lagi..."; a null-description card has no description line; card click → `/topics/{id}`; columns 1/2/3 by viewport. | 21.1, 21.2, 21.3 | 73 |
| E2E-M03-38 | S13 topic 7 (as pelajar): header, tab title, back href `/topics` (from a filtered list), hero (description clamped to 3 lines), 3 stat cards in one row at 375 with purple/green/amber icons, 4 subtopic cards numbered with badges "Level 1/2/3" and purple "0%"; topic 68 and topic 4 subtopic descriptions; `/topics/99999` → 404 page. | 22.1, 22.2, 22.3, 22.4, 22.5 | 75, 76, 77, 79 |
| E2E-M03-39 | S13 as `pelajarmaju@demo.test`: topic 1 "Dijawab" 23, "Kemajuan" 95 %, subtopic bars 95 %; topic 7 "Dijawab" 7, "Kemajuan" 15 %, every subtopic bar 15 % (derived from the M05 answer-log anchors, BR-19); after submitting one more M05 chapter session on MATH D1 Bab 2 with 5 correct, topic 7 reads 40 %. | 22.6 | 76, 77 |
| E2E-M03-40 | "Mula Berlatih" hrefs: topic 7 all → `/practice/MATH`; 68 → `/practice/BM`; 12 → BI; 4 → SCI; 15 → PI; 17 → PM; 18 → SEJ; 69 → GEO. | 23.1, 23.2 | 78, 97 |
| E2E-M03-41 | S14 as admin: header "Peta Belajar", no subtitle, tab title with em dash; hero texts; tiles visible at 768/1280 and hidden at 375; bar width = progress and its highlight has no running animation (no `@keyframes shimmer` in the app CSS). | 24.1, 24.2 | 80, 81 |
| E2E-M03-42 | S14 layout: at 1280 path and dots visible, first island right, second left; at 768/375 centred, path hidden; islands below the fold have opacity 0 until scrolled into view, then 1; with emulated `prefers-reduced-motion: reduce` the behaviour is the same (as live). | 24.3, 24.4 | 85 |
| E2E-M03-43 | S14 selectors: 7 pills (labels, hrefs with current grade), no "Geografi" pill; active colours checked for Matematik #3B82F6, Pend. Islam #14B8A6 and Sejarah #EF4444; subtitles "Terokai perjalanan Pend. Islam — …" and "… Pend. Moral …"; 4 grade chips (Darjah 1–4) with hrefs and active gradient. | 25.1, 25.2, 25.6 | 82, 83, 81 |
| E2E-M03-44 | S14 params: admin and pelajar default Matematik + Darjah 4 (3 islands); `?subject=SAINS&grade=DARJAH_5`, `grade=TINGKATAN_1`, `grade=darjah_2` and `grade=XYZ` → "Darjah 4" chip active and the Darjah 4 topics. | 25.3, 25.4 | 84 |
| E2E-M03-45 | S14 empty: typed `?subject=GEOGRAFI&grade=DARJAH_1` and `?subject=ZZZ&grade=DARJAH_1` → empty texts, "0/0", "0%", no active pill, subtitles "… Geografi …" and "Terokai perjalanan Zzz — takluki setiap pulau! 🏝️". | 25.5 | 81, 84, 90 |
| E2E-M03-46 | S14 islands (no history, Matematik D1): 2 "🎯 BUKA" islands with emoji, "0%", "0 sesi · 0 soalan dijawab", hrefs `/practice?topic_id=1`, `=7`; 3 locked with "🔒 TERKUNCI", text, not links, cursor not-allowed; "0/5". | 26.1, 26.2 | 86, 87, 89, 97 |
| E2E-M03-47 | S14 as `pelajarmaju@demo.test` at `?subject=MATEMATIK&grade=DARJAH_1` (answer-log anchors M1–M4): topic 1 "Nombor" mastered (green, placeholder label, "3 sesi · 23 soalan dijawab"), topic 7 started (blue), "Bentuk" started (blue; emoji tile empty, seed gap URS OQ-11), "Operasi Tambah dan Tolak" unlocked, "Bentuk dan Ruang" locked; "1/5", "Kemajuan" = round((95+15+20+0+0)/5) = 26 %. | 26.3, 26.4 | 88, 89 |
| E2E-M03-48 | Admin menus: ≥1024 sidebar group "KURIKULUM" open with 3 links and hrefs, active item per screen (S1, S3, S6, S8, S9, S11), group toggle; <1024 "Lagi" menu "KURIKULUM" section links. | 27.1, 27.2, 27.3 | 91, 92 |
| E2E-M03-49 | User menus (as pelajar): sidebar/drawer "Topik", "Peta Belajar" hrefs and active states on S12/S13/S14; bottom nav "Topik" only. | 28.1, 28.2 | 93 |
| E2E-M03-50 | Access: guest → `/admin/curriculum`, `/topics`, `/peta-belajar` → `/login`; pelajar → `/admin/subjects` → own landing page; API 401/403 codes. | 29.1, 29.2 | 94 |
| E2E-M03-51 | Shared data: grade helper maps 1→D1/DARJAH_1, 7→T1/TINGKATAN_1, 11→T5; CH-ALL = 1,251 and CH-ALL-INCL-ORPHAN = 1,311; S1 Pendidikan Muzik + Darjah 1 still shows the empty tree (the 56 out-of-tree chapters are not listed); S9 "Subjek" equals linked subjects after a link change; S6/S9 "Soalan" equal M04 §4.1 Q-ACTIVE(subject) / Q-ACTIVE(level) on the M04 dataset (no separate M03 value); deactivating a seeded question lowers its subject and level figures by one. | 30.1, 30.3 | 95, 98 |
| E2E-M03-52 | Responsive sweep over S1–S14: `scrollWidth ≤ clientWidth` at 375/768/1280; S6 at 1280 "TINDAKAN" cell inside the card box; S6/S9 scroll inside the card below 1280; S1 at 375 headings not truncated (no ellipsis); on every screen at 375 the computed font-size of every visible text node inside `main` is ≥12 px (icon glyphs and the global shell excluded); form buttons on S2–S5, S7, S8, S10, S11 on one row, right-aligned, at 375/768/1280. | 31.1, 31.2, 31.3, 31.4 | 24, 46, 99 |

## 13. Open questions

Carried from URS §9 (OQ-1…OQ-11); the SRS adds:

1. **Q1 Pill colours — closed.** All active pill colours were observed by the audit (AUD-M03-04) and are in §6.8.
2. **Q2 Mastery threshold (INFERRED).** BR-14 uses 80 %; the live rule is unknown (URS OQ-4).
3. **Q3 Null chapter number display.** A chapter created without "Nombor Bab" is shown as "Bab : {name}" (INFERRED from the template "Bab {chapter_number}: {name}"); no such record exists on live to confirm.
4. **Q4 API naming.** `/api/learning-map` and `/api/topics` are prototype names for server-rendered pages; M05 may prefer to own `/api/topics` — to align when M05 is specified.
