# v2 Question bank: intake pipeline and question display

- **Slug:** `v2-question-bank`
- **Status:** Draft G1 (requirements only; the exam schema and sample PDFs are not yet shared, so the data model is NOT final)
- **Date:** 2026-10-16
- **Owner:** product-analyst
- **Decisions applied:** D28(e), D29(a)(c), D30, D31, D32, D33, D39(a). Question screens stay held until this track passes G2 (D39a).
- **Evidence tags:** paths are in the .cloud reference repo `D:\Dev Projects\prestasiplus-reference`, written `backend/...` (= `...\backend\...`) or `docs/...`. `W` = `backend/routes/web.php`. `TC` = `backend/app/Http/Controllers/TeacherController.php`. No live or server access was used. The ~450k legacy-row figure comes from the user's brief and is not verified here.
- **Placeholders:** values marked **[Default]** are proposals to be tuned in the pilot. Items marked **[Schema]** wait for the user's exam schema.

## 1. Summary and goal

**Problem.** Teachers hold exam and trial papers as PDFs, but the system cannot turn those files into good, tagged, reviewed, reusable questions. Staff re-type them, and the .cloud system keeps two unreconciled banks.

**Goal.** One canonical question bank fed by one intake pipeline, with AI doing the typing and suggesting, and humans approving everything students see.

```
Teacher PDF (also Excel template, manual form)
  -> OCR + AI extraction against the Paper blueprint / question structure [Schema]
  -> AI-suggested tags with confidence (subject, level, chapter, DSKP topic, difficulty)
  -> duplicate check
  -> review queue (source page beside extracted text, inline edit)
  -> Draf -> Semakan -> Lulus -> Terbit
  -> served by tags / pools to Bijak SPM, Latih Tubi, Papan Bijak, PKSK, quizzes
```

**Success measures (targets, to confirm in the pilot):**

| Measure | Target [Default] |
|---|---|
| Staff typing of question text | Zero re-typing for digital-born PDFs; edits only |
| Median review time per question (extraction to Semakan) | <= 2 min |
| Questions reaching students without human approval | 0 |
| Duplicate questions reaching Terbit (confirmed by reports "pendua") | < 1% |
| Questions Terbit with missing answer key / mark scheme | 0 (hard gate) |

## 2. Problem statement and evidence (.cloud)

| # | Finding | Evidence |
|---|---|---|
| E1 | **Two parallel banks never unified.** Legacy `questions` and canonical `exam_*` coexist; "the two banks show different corpora on prod"; the unify step is operator-gated and not executed. | `docs/QUESTIONS-MENU-REORG.md:13-17, 46-47, 122-126`; `backend/database/migrations/2026_06_15_000011_create_questions_table.php`; `backend/database/migrations/2026_07_16_000032_create_exam_questions_table.php`; `backend/app/Console/Commands/UnifyExamTree.php:18` |
| E2 | **More than 10 intake paths, conflicting formats.** (1) teacher single MCQ form; (2) teacher CSV; (3) teacher file upload; (4) teacher "Soalan Guru" form; (5) teacher "Kertas Peperiksaan" form; (6) dead legacy admin form; (7) Filament CSV importer; (8) dead CSV stub; (9) Studio wizard; (10) Studio DOCX-ZIP upload; (11) BI comprehension DOCX upload; (12+) CLI importers (docx, OCR JSON, extraction ingest, 2025 questions, ripped questions, images, structured schemes). | (1) `TC:1050`, `W:1627`; (2) `TC:905`, `W:1629`; (3) `TC:996`, `W:1630`; (4) `W:1765-1767`; (5) `W:1723-1724`; (6) `docs/QUESTIONS-MENU-REORG.md:34-36`; (7) `backend/app/Filament/Pages/QuestionImport.php`; (8) `W:751`, `docs/QUESTIONS-MENU-REORG.md:28`; (9) `W:590-607`; (10) `W:612`; (11) `W:618`; (12) `backend/app/Console/Commands/{ImportDocxSet:19, ImportOcrPapers:26, IngestExtraction, Import2025Questions:31, ImportRippedQuestions, ImportQuestionImages, ImportStructuredSchemes}.php` |
| E3 | **Two CSV contracts.** Teacher CSV columns `subjek, tahap, soalan, pilihan_a..d, jawapan, kesukaran, penerangan` (names, A-D, difficulty 1-5 defaulting to 3). Filament CSV expects `body, option_a..d, correct, [difficulty]`. The .my importer documented a third (`question_text`, `subject_id`, ...). The repo's own plan says "do not leave two documented CSV contracts". | `TC:887, 933-934`; `backend/app/Filament/Pages/QuestionImport.php:89`; `docs/requirements/urs/M04-question-bank.md:219`; `docs/QUESTIONS-MENU-REORG.md:118-120` |
| E4 | **Teacher PDF uploads are disconnected.** `storeKertas` stores raw files (pdf/doc/docx/xls/xlsx, max 5 files, 20 MB each) as `question_submissions` rows (title, file path, status, notes only); "Admin extracts + enters the actual questions from the file manually"; the table has no link to any question. The plan notes the page is "orphaned from the Studio import pipeline it feeds". | `TC:990-1035, 1000-1007`; `backend/database/migrations/2026_06_15_000016_create_question_submissions_table.php`; `docs/QUESTIONS-MENU-REORG.md:32` |
| E5 | **No preview and no content dedupe on teacher paths.** Rows are created immediately and unconditionally. Only the staged import has a per-source idempotency hash (not a content check). Students still report "Soalan berulang / pendua" as a reason, so duplicates reach them. | `TC:958-977, 1064-1084`; `backend/database/migrations/2026_07_18_100002_create_import_items_table.php:23`; `docs/requirements/urs/M04-question-bank.md:247` |
| E6 | **Weak taxonomy.** Legacy: `chapter_id` and `topic_id` optional, difficulty is a 1-5 integer. Canonical: `chapter_id` optional, `topic` free text, `difficulty` free string. The teacher CSV validates subject but not level. | `...000011_create_questions_table.php:14-15, 18`; `...000032_create_exam_questions_table.php:17-19`; `TC:936-950` |
| E7 | **Teacher CSV has no review step.** Bad rows are reported, valid rows still import (a behaviour worth keeping), but there is no review step before they enter the bank as `menunggu`. | `TC:898-904, 952-956, 982-987` |
| E8 | **No in-app AI extraction or generation.** OCR/extraction happens in offline scripts whose JSON is loaded by CLI; AI exists only for essay grading. | `backend/app/Console/Commands/ImportOcrPapers.php:8-22`; `GradeEssays.php:22` |
| E9 | **Publish-gate incident.** A paper-level publish bypassed per-question validation and put 11 keyless questions live. v2 must make the answer-key gate impossible to bypass. | `docs/QUESTIONS-MENU-REORG.md:50-52`; `backend/app/Http/Controllers/Admin/Studio/PaperReviewController.php:50-90` |
| E10 | **Two copies of the authoring UI** (Blade `admin.studio.*` and Panel `panel.studio.*`) and several read-only replicas with CRUD twins. | `W:305-334, 587-607`; `docs/QUESTIONS-MENU-REORG.md:28-32` |
| E11 | **Good parts to keep.** Canonical lifecycle with an explicit allow-list (draft -> reviewed -> approved -> archived, archived -> draft only); import staging with per-field confidence, suggested tags and review status (pending / accepted / rejected / edited); blueprint contract per subject x kertas; human publish gate; edit-as-draft. | `backend/app/Support/Studio/QuestionLifecycle.php:21-26`; `backend/database/migrations/2026_07_18_100002_create_import_items_table.php:16-21`; `...2026_08_11_000001_create_paper_blueprints_tables.php`; `W:605` |

## 3. Actors and roles

Roles follow .cloud (D31: single `pegawai_ppd`; dual role allowed). Nothing here changes the role set. Permissions in the portals doc (Bank Soalan and Kertas & SPM groups are Admin Pusat only, D30) are respected.

| Actor | Role code (.cloud / v2) | Question-bank rights (this spec) | Basis |
|---|---|---|---|
| Guru | `guru` | Upload PDF / Excel, create manually, see **only own** submissions and their status, edit own items while Draf, **verify own extraction** (Draf -> Semakan). Cannot approve, publish, or see other teachers' items. | .cloud: teachers submit (`W:1625-1630`) and F-97 "Verify Soalan" exists (cloud-gap F-97); verification step is the teacher review of OQ-4 |
| Admin Pusat | `admin` (national) | All of the above for any item; review queue; Semakan -> Lulus; Terbit; archive/withdraw; edit published (new version); tag taxonomy; blueprints; report triage; AI cost view. | `v2-portals.md` §6.3-6.4 |
| Admin Sekolah | `admin_sekolah` | **No access** to the bank or review queue in v2.0. | Bank Soalan is Pusat only (D30). **[Default]**, see Q9 |
| Pegawai PPD / JPN | `pegawai_ppd` | No access. | D30 |
| Murid | `pelajar` | Sees Terbit questions only; may report a question; sees own report status. | .cloud reports (M04 URS EP-M04-3) |
| Ibu bapa, Penaja | | No access. | |
| System (AI service) | n/a | Extracts and suggests only. Has no approval right and cannot change a status beyond creating a Draf. | D28e, user direction |

Roles that **do not exist in .cloud** and are not introduced: "Penyemak" (reviewer) or "Editor". If the user wants trusted teachers to approve, that is Q3.

## 4. End-to-end flows

### 4.1 Status model (question)

| Status | Meaning | Visible to students |
|---|---|---|
| Draf | Created by extraction, import or manual entry; under edit | No |
| Semakan | Submitted for review: the uploader (Guru) or an admin confirms the content matches the source | No |
| Lulus | Approved by Admin Pusat; ready to be published | No |
| Terbit | Live; servable through pools | Yes |
| Diarkib | Retired / withdrawn; never served; may be restored to Draf | No |

Allowed transitions (anything else is refused and logged). Compared with .cloud (`QuestionLifecycle.php:21-26`) v2 adds **Terbit** as separate from Lulus, so an approved question can wait for its paper.

| From | To | Who | Condition |
|---|---|---|---|
| Draf | Semakan | Guru (own), Admin Pusat | Submit-for-review checks (§4.8) pass |
| Draf | Diarkib | Guru (own), Admin Pusat | none |
| Semakan | Lulus | Admin Pusat | Approve checks pass |
| Semakan | Draf | Admin Pusat | Reason is mandatory; the uploader is notified |
| Lulus | Terbit | Admin Pusat | Publish gate (§4.8) passes |
| Lulus | Draf | Admin Pusat | Reason is mandatory |
| Terbit | Diarkib | Admin Pusat | Immediate withdraw; reason is mandatory |
| Terbit | (new version, Draf) | Admin Pusat | "Sunting" creates version n+1 as Draf; the live version keeps serving (§4.6) |
| Diarkib | Draf | Admin Pusat | Restore |

Extraction-item review state (staging, before/while a Draf exists): `Dijana`, `Perlu semakan`, `Diterima`, `Ditolak`, `Pendua`. An item **Diterima** is a Draf question; an item **Ditolak** never becomes a question but is kept with a reason.

### 4.2 Upload a teacher PDF (primary path)

1. Guru opens "Sumbang Soalan" and picks "Muat naik kertas".
2. Guru fills a short **declaration**: paper type (Soalan Umum / Trial / DSKP / Buku Teks / Buku Latihan / Peperiksaan / Lain-lain, from .cloud `TC:1000`), subject, level (Tingkatan 1-5 or Darjah), year, source declaration (§5.5), optional notes. Files: PDF (and the other formats of Q10), several files per submission, max size [Default] 20 MB each as today (`TC:1006-1007`).
3. System stores the file privately, creates a **Submission** (status `Diterima`), and queues extraction. Guru sees progress: Dihantar -> Sedang diproses -> Sedia untuk semakan (or Gagal).
4. Extraction produces a **paper** with sections and **question drafts**, each linked to its source page and region; tags with confidence; duplicate flags.
5. Items appear in the Guru's review list (own) and in the Admin Pusat queue.

### 4.3 Excel import (secondary path)

One versioned **Excel template** (downloadable), one contract for every role. Columns are generated from the question structure [Schema]. Each valid row becomes a Draf in the same review queue (it never bypasses review). Invalid rows are reported with the row number and reason; valid rows still import (replicates `TC:902-904`). Duplicates are checked as for PDF.

### 4.4 Manual create

One form for a single question of any type in the structure [Schema] (stem, options or parts, answer key / mark scheme, stimulus, tags). Same validation, same Draf status, same queue. This is the only manual path (replaces paths 1, 4, 5, 6, 9 of E2).

### 4.5 Review queue, publish, and paper assembly

- Queue lists items by status, source paper, uploader, age, confidence band, duplicate flag.
- Reviewer opens an item: source page (with the extracted region highlighted) beside the extracted fields; inline edit; tags show suggestion + confidence + accept/change; duplicate panel with the matching question side by side.
- Guru: Draf -> Semakan (own items). Admin Pusat: Semakan -> Lulus -> Terbit, or back to Draf with a reason.
- A **paper** (a past-year or trial paper with sections) is published only when all its questions are Terbit and it conforms to the Paper blueprint (§4.8). Papers feed Bijak SPM "Kertas Pilihan"; the pool of single questions feeds the rest.

### 4.6 Edit or retire a published question (versioning)

- Each question has a stable id and a version number. "Sunting" on a Terbit question creates **version n+1 as Draf** that goes through the same path. When n+1 becomes Terbit, version n becomes `Diarkib (digantikan)` automatically in the same action; there is never a moment with zero live version unless the admin withdraws.
- Student answers and sessions record **question id + version served**, so history never changes meaning after an edit.
- Withdraw (Terbit -> Diarkib) removes the question from all pools immediately; sessions already in progress finish their current question and are not served it again.
- Version history shows who changed what, when, and why.

### 4.7 Report a wrong question (fix loop)

1. Murid taps "Lapor Soalan" (from the question card), picks reasons, optional comment (max 500). Reasons replicate .cloud: MCQ: Jawapan tidak tepat, Soalan mengelirukan, Set jawapan tidak tepat, Pilihan jawapan tidak lengkap, Soalan berulang / pendua, Kesalahan ejaan / taip, Lain-lain; structured: Skema jawapan tidak tepat, Soalan mengelirukan, Markah tidak adil, Kesalahan ejaan / taip, Lain-lain (`docs/requirements/urs/M04-question-bank.md:247-248`).
2. Report is linked to the question **and version**. Report statuses replicate .cloud: Menunggu, Disemak, Diperbaiki, Ditolak, Dikeluarkan.
3. Auto-hide rule: see Q7 (.cloud hides an MCQ at the first report but a structured question at the third; this contradicts itself, so v2 unifies it).
4. Admin Pusat triages in "Laporan Soalan": Tandakan Selesai (a fix), Tolak & Aktifkan Semula, Nyahaktif Segera. "Sunting" opens version n+1 as Draf, linked to the report(s).
5. When the new version is Terbit, linked reports become Diperbaiki and each reporter sees the new status in "Laporan Soalan Saya".

### 4.8 Quality gates (rules the system enforces)

| Gate | Rule (all must pass) |
|---|---|
| Submit for review (Draf -> Semakan) | Required fields present for the question type [Schema]; every **low-confidence** field has been confirmed or edited by a person; subject, level and chapter set; duplicate flag resolved or marked "Bukan pendua"; source declaration present. |
| Approve (Semakan -> Lulus) | Reviewer is not the AI service; tags valid against the controlled taxonomy; marks total equals the sum of part marks; stimulus / figure references resolve to uploaded media. |
| Publish (Lulus -> Terbit) | **Answer key (or mark scheme for every part) present**; difficulty set from the controlled scale; DSKP topic chosen from the curriculum list (not free text); copyright declaration is not "belum jelas"; no open duplicate flag. For a paper: blueprint conformance (section count, marks, question count) [Schema]. |
| No bypass | The same gate applies to single and paper-level publish and to any bulk action; a bulk action that includes a failing question reports it and skips it (E9). |

### 4.9 Serving to students (tags and pools)

- Features never copy questions; they ask for a **pool**: a saved filter over tags (subject, level, chapter, DSKP topic, difficulty, type, year, kertas, source paper, language, official-past-year flag) restricted to Terbit.
- Consumers: Bijak SPM ("Kertas Pilihan" uses published papers; "Jana Kertas" draws from pools under the Paper blueprint, D32), Latih Tubi, Papan Bijak, PKSK, quizzes, teacher class sets (M10). Their own screens are specified elsewhere; this spec only fixes what they receive.

### 4.10 Question display to students

Consistent with the approved learner prototype (`docs/design/v2-learner-prototype.html`, quiz screen at lines 704-724): **full screen, one question at a time**, progress bar and counter ("Soalan 1/5"), subject chip, question text as the heading, answer area, a "Semak" action, then feedback and "Teruskan". The report action ("Lapor Soalan") is reachable from every question card.

| Question kind | Required behaviour |
|---|---|
| MCQ (single answer) | Question text; options A-D (or the number of options in the structure) as large tap targets; one choice; "Semak" disabled until a choice is made (as prototype); correct/incorrect feedback with explanation when present. |
| Structured / subjective with parts | Nested parts (a), (b), (i), (ii) shown in order; marks shown per part; student answers per part (text, numeric, selection by part type [Schema]); marking and scheme reveal per the existing rule that per-page instant mark is not shown in Simulasi (`v2-cloud-gap.md` F-74). |
| Stimulus (passage, table, diagram, image, audio) | Shown with the question and shared by the questions that cite it ("Soalan 3-5 berdasarkan teks di atas"); always reachable in one action without leaving the question; stimulus is stored once and referenced. |
| Math / formulas, units, superscripts | Rendered as formatted math, not as images of text where avoidable; wide formulas scroll **inside** their container (no page scroll); the plain-text form is available to assistive tech. |
| Jawi / Arabic | Right-to-left text displays with correct direction and shaping, mixed with Latin text in the same sentence without garbling; option labels stay in reading order; the UI chrome is not mirrored. |
| Figures | Scale to the viewport; tap to enlarge; an alternative-text field exists for every figure (author supplies; AI may suggest). |

## 5. User stories and acceptance criteria

Priority: M = Must, S = Should, C = Could, W = Won't (v2.0). IDs are stable.

### Intake

**US-01 [M] As a Guru, I want to upload a paper PDF with a short declaration, so that I do not have to type the questions.**
- AC-01.1 Given I am a Guru, when I open Sumbang Soalan, then "Muat naik kertas" is offered with fields: jenis kertas, subjek, tahap, tahun, sumber (declaration), catatan, and file(s).
- AC-01.2 Given a file of an unsupported type or over the size limit, when I submit, then it is refused before upload completes with a BM message naming the limit; no submission is created.
- AC-01.3 Given a valid submission, when I submit, then a Submission is created, the file is stored privately, extraction is queued, and I see status "Sedang diproses" within 5 s.
- AC-01.4 Given a malicious or password-protected file, when processed, then the Submission ends "Gagal" with a reason and no questions are created.
- AC-01.5 Given I am a Murid, Ibu bapa, Admin Sekolah or PPD/JPN, when I request the upload page or API, then access is refused (403).

**US-02 [M] As a Guru or Admin Pusat, I want to import questions from one Excel template, so that I can add many questions I already have in a spreadsheet.**
- AC-02.1 Given the template download, then it is versioned (version shown in the file) and has one header contract for all roles.
- AC-02.2 Given an upload with a valid row and an invalid row, when imported, then the valid row becomes a Draf, the invalid row is listed with row number and reason, and the result message gives both counts.
- AC-02.3 Given an uploaded template of an old version, then it is refused with a message naming the current version.
- AC-02.4 Given imported rows, then each has source "Excel", the importing user, and the file name; none is Terbit.
- AC-02.5 Given the same row appears twice or already exists in the bank, then the duplicate flag is raised as in US-06.

**US-03 [M] As a Guru or Admin Pusat, I want one manual form for a single question, so that I can add or fix a question without a file.**
- AC-03.1 Given I choose a question type, then the form shows exactly the fields of that type [Schema].
- AC-03.2 Given required fields are missing, when I save, then the question is saved as Draf with the gaps listed, and cannot move to Semakan.
- AC-03.3 Given I save, then the question has provenance "Manual", my user id and time.

**US-04 [M] As the system, I want to extract questions from a paper against the question structure, so that staff only edit.**
- AC-04.1 Given a digital-born PDF, when processed, then each detected question becomes a Draf with stem, options / parts, answer key (when the paper has one), marks (when printed), and the number label (e.g. "12(a)").
- AC-04.2 Given a separate answer-scheme file linked to the paper, then answers and mark schemes are matched to questions by number label, and unmatched ones are listed.
- AC-04.3 Given every Draf produced, then it stores the source file, page number and region (box) of the stem and of each option / part (see US-16).
- AC-04.4 Given a figure, table or diagram, then it is cropped and stored as media attached to the question or stimulus; the page region is kept.
- AC-04.5 Given a question the extractor cannot parse, then a placeholder Draf is created with the page region, "Perlu semak manual", and the raw text, so no question is silently lost.
- AC-04.6 Given a paper with N questions, then the Submission reports "N dikesan" and a person can add a missing question or split / merge two questions in the review screen.
- AC-04.7 Given extraction fails or times out, then the Submission shows "Gagal" with a retry action and a manual-entry fallback; no partial data is published.
- AC-04.8 Given any extraction, then no student, teacher or school identifier is included in the AI request (see NFR-04).

**US-05 [M] As a reviewer, I want AI-suggested tags with confidence, so that tagging is fast but never automatic.**
- AC-05.1 Given a Draf, then suggestions exist for subject, level, chapter, DSKP topic and difficulty, each with a confidence value.
- AC-05.2 Given a suggestion, then the reviewer can accept it, choose another value from the controlled list, or leave it empty; free text is not accepted for chapter, topic, or difficulty.
- AC-05.3 Confidence bands [Default]: High >= 0.90, Medium 0.70-0.89, Low < 0.70. High is pre-filled; Medium is pre-filled and highlighted; Low is **not** pre-filled as accepted and must be confirmed.
- AC-05.4 Given a question with any field still Low and unconfirmed, then Draf -> Semakan is refused with the field names.
- AC-05.5 Given a tag accepted or changed, then the audit trail records the suggested value, the final value, the confidence, and the person.
- AC-05.6 Given the AI service, then it cannot set a status beyond Draf and cannot confirm a Low field.

**US-06 [M] As a reviewer, I want duplicate detection before a question is accepted, so that the bank does not fill with repeats.**
- AC-06.1 Given a new Draf, then it is compared with Draf, Semakan, Lulus and Terbit questions and with other items in the same upload.
- AC-06.2 Exact match on normalised stem + options (ignoring case, spacing, option order) is flagged "Pendua tepat" and cannot move to Semakan unless the reviewer rejects it or links it as a version / variant.
- AC-06.3 Near match at or above [Default] 0.85 similarity is flagged "Mungkin pendua" with the matching question shown beside it; the reviewer chooses Bukan pendua / Gabung (keep one) / Tolak.
- AC-06.4 Same source paper + same number label already in the bank is flagged "Kertas sama sudah diimport" at upload time, before extraction cost is spent, with a choice to continue.
- AC-06.5 The decision and its reviewer are logged; "Bukan pendua" suppresses the flag for that pair only.

**US-07 [M] As a reviewer, I want a review queue I can filter and work through quickly.**
- AC-07.1 The queue lists items with: source paper, number label, subject, level, status, confidence band (lowest field), duplicate flag, uploader, age; Guru sees own only; Admin Pusat sees all.
- AC-07.2 Filters: status, subject, level, uploader, source paper, confidence band, duplicate flag, date; the list is paginated in BM (D33).
- AC-07.3 "Seterusnya" opens the next item matching the current filter without returning to the list.
- AC-07.4 A bulk action "Hantar untuk semakan" applies only to selected items that pass the gate; items that fail are listed and skipped.
- AC-07.5 A "Terima semua High" shortcut exists only for fields (tags), never for the whole question's status.

**US-08 [M] As a reviewer, I want to see the source page beside the extracted question and edit inline.**
- AC-08.1 Given an item, then the source page image is shown with the region of the question highlighted, beside the extracted fields.
- AC-08.2 Given an edit of the stem, option, answer, marks or part, then it saves inline, the field is marked "Disunting oleh manusia", and previous AI text is kept in history.
- AC-08.3 Given the highlighted region is wrong, then the reviewer can redraw it and re-run extraction for that question only.
- AC-08.4 Given Low-confidence fields, then they are visually distinguished and reachable by a "field Low seterusnya" action.
- AC-08.5 Responsive: at 1280 px the source and extracted panes are side by side; at 768 px both are available without losing any function (side by side or one-tap switch); at 375 px the review screen is usable (read the source, edit, move status) with no horizontal page scroll at 320, 375, 768 or 1280 px.
- AC-08.6 Math, figures, Jawi / Arabic and tables in the extracted pane use the same renderer as the student display (§4.10), so the reviewer sees what students will see.

**US-09 [M] As a Guru, I want to verify my own extraction and follow its status, so that my paper is correct before the admin sees it.**
- AC-09.1 Given my Submission, then I see only my own items and the status of each (Draf, Semakan, Lulus, Terbit, Diarkib, Ditolak) with the reason for any return.
- AC-09.2 Given I tick that an item matches my source, when I submit it, then it becomes Semakan (subject to US-05 and the gates in §4.8).
- AC-09.3 Given an item in Semakan, Lulus, Terbit or Diarkib, then I cannot edit it; I can only view it.
- AC-09.4 Given another Guru's item or Submission, when I request it by id, then 403 and no data is returned.

**US-10 [M] As Admin Pusat, I want to approve or return items in Semakan, so that only checked questions go forward.**
- AC-10.1 Given an item in Semakan, when I approve, then it becomes Lulus with my id and time; when I return it, a reason is mandatory and the uploader is notified.
- AC-10.2 Given the item was uploaded by me, then I may approve it [Default, Q3]; the audit trail shows uploader and approver.
- AC-10.3 Given an item with a failing gate (§4.8), then approve is refused with the failing rule named.

**US-11 [M] As Admin Pusat, I want to publish approved questions, so that students can receive them.**
- AC-11.1 Given a Lulus question, when I publish, then it becomes Terbit and appears in matching pools within [Default] 60 s.
- AC-11.2 Given a question without an answer key (or a part without a mark scheme), then publish is refused, in single and in paper-level and bulk publish (E9).
- AC-11.3 Given a Draf, Semakan, Lulus or Diarkib question, then no student-facing request returns it, including by direct id.
- AC-11.4 Publishing and withdrawing are recorded with the user and time.

**US-12 [M] As Admin Pusat, I want to publish a whole paper only if it fits its Paper blueprint.**
- AC-12.1 Given a paper whose questions are not all Terbit, then paper publish is refused and the missing questions are listed.
- AC-12.2 Given a blueprint for the paper's subject x kertas, then publish checks section count, question count per section and total marks against it and lists every mismatch.
- AC-12.3 Given a paper without a blueprint, then it cannot be published as a "Kertas Pilihan" (it may still contribute its questions to pools).
- AC-12.4 A published paper can be unpublished; its questions remain Terbit.

**US-13 [M] As Admin Pusat, I want to correct a published question without a gap in service.**
- AC-13.1 Given a Terbit question, when I choose Sunting, then version n+1 is created as Draf and version n keeps serving.
- AC-13.2 Given version n+1 reaches Terbit, then version n becomes Diarkib (digantikan) in the same action and appears in version history.
- AC-13.3 Given a student attempt made on version n, then it still shows version n's text and key after n+1 is live.
- AC-13.4 Given a change that alters the correct answer, then the audit trail flags it "Jawapan berubah" and the count of affected recorded attempts is shown to the admin.

**US-14 [M] As Admin Pusat, I want to withdraw or archive questions at once.**
- AC-14.1 Given Nyahaktif Segera or Terbit -> Diarkib, then the question is no longer served within [Default] 60 s, with a mandatory reason.
- AC-14.2 Given a question inside a published paper, then the paper is flagged "Perlu semakan" and stops serving until resolved (replace the question or unpublish).
- AC-14.3 Given Diarkib, when restored, then it returns as Draf, never directly as Terbit.

**US-15 [M] As Admin Pusat, I want an audit trail of every change, so that we can explain any question.**
- AC-15.1 Each create, edit, tag decision, status change, duplicate decision, publish, withdraw, restore, and export is logged with user, role, time, before / after, and (where applicable) reason.
- AC-15.2 AI actions are logged as such (model identifier and run id, no user data).
- AC-15.3 Audit entries cannot be edited or deleted from the UI; Admin Pusat can filter them by question, user, action and date.

**US-16 [M] As a reviewer, I want provenance on every question, so that I can find where it came from.**
- AC-16.1 Each question stores source type (PDF, Excel, Manual, AI variant), the Submission, file, page number and region, and number label in the paper.
- AC-16.2 From a question, "Lihat sumber" opens the source page at the region; this is visible to Admin Pusat and to the uploading Guru only, never to Murid.
- AC-16.3 A **Sumber Kertas** register lists papers by subject, year, kertas, type, board [Schema], number of questions, number Terbit; each row links to its questions (replaces BS-03 dead-ends, `docs/QUESTIONS-MENU-REORG.md:97-98`).

**US-17 [M] As a Guru and as the organisation, I want to declare the source and rights of an upload.**
- AC-17.1 Given an upload, then the declaration is mandatory: own work, school-owned, official KPM / LPM past-year, commercial / textbook / third-party (details in Q4).
- AC-17.2 Given "commercial / third-party", then the paper cannot reach Terbit until Admin Pusat records a rights decision.
- AC-17.3 Given a rights complaint, then Admin Pusat can withdraw all questions of a source in one action (US-14 rules apply).
- AC-17.4 The source file is never exposed to Murid; only the extracted, approved content is.

**US-18 [M] As a Murid, I want to report a wrong question, so that it gets fixed.**
- AC-18.1 Given a question card, then "Lapor Soalan" is reachable at 375 px without leaving the question, with the reasons of §4.7 and an optional comment up to 500 characters with a live counter "{n}/500".
- AC-18.2 Given I submit, then I see "Terima Kasih!" and the report is stored with question id, version, my id, reasons, comment, and time.
- AC-18.3 Given I have already reported this question version, then a second report is refused with a clear message (one per student per version).
- AC-18.4 Given the auto-hide rule of Q7 is reached, then the question stops serving and is flagged in the triage list.
- AC-18.5 Report text is never sent to the AI service (NFR-04).

**US-19 [M] As Admin Pusat, I want to triage reports and trace each to its fix.**
- AC-19.1 Given the list "Laporan Soalan", then tabs Menunggu / Disemak / Diperbaiki / Ditolak / Dikeluarkan / Semua show counts that equal the rows shown.
- AC-19.2 Each report shows the question as the student saw it (the reported version), reasons, comment, reporter, time, and the reason category.
- AC-19.3 Given Sunting from a report, then version n+1 is linked to all open reports of that question; when n+1 is Terbit those reports move to Diperbaiki.
- AC-19.4 Given Tolak & Aktifkan Semula on a question hidden by the auto-hide rule, then it serves again and the decision is logged.

**US-20 [S] As a Murid, I want to see what happened to my report.**
- AC-20.1 Given "Laporan Saya", then my reports are listed with the current status, the date, and the admin note when present; counters Jumlah / Menunggu / Disemak / Diperbaiki / Ditolak equal the list.
- AC-20.2 Given a report becomes Diperbaiki, then I receive an in-app notification once.

### Serving and display

**US-21 [M] As a feature owner (Bijak SPM, Latih Tubi, Papan Bijak, PKSK, quizzes, class sets), I want to get questions by tags / pools from the one bank.**
- AC-21.1 Given a pool definition (tags + optional exclusions), then only Terbit questions matching it are returned; counts shown to users are computed from the same query.
- AC-21.2 Given a Draf / Semakan / Lulus / Diarkib question, then it is never in any pool.
- AC-21.3 Given a feature needs a tag the bank lacks (e.g. a chapter with zero questions), then the feature gets an empty result, not an error or a question from another tag.
- AC-21.4 Given the "official past-year" flag, then Kertas Pilihan uses only questions inside published papers, and practice pools can include or exclude the flag.
- AC-21.5 No feature stores its own copy of a question; they store question id + version.

**US-22 [M] As a Murid, I want an MCQ one question at a time, full screen.**
- AC-22.1 Given an MCQ, then the screen shows the progress bar, counter, subject chip, question text, options, and a disabled "Semak" until I choose (as the approved prototype).
- AC-22.2 Given I choose and tap "Semak", then feedback shows correct / incorrect and the explanation when present; "Teruskan" moves on.
- AC-22.3 Given 375 / 768 / 1280 px, then there is no horizontal page scroll and every option is fully readable (no truncated text) and tappable.
- AC-22.4 Given a very long stem or option, then the content scrolls inside the question area and the "Semak" action stays reachable.

**US-23 [M] As a Murid, I want structured questions with parts.**
- AC-23.1 Given a question with parts (a), (b)(i), (b)(ii), then every part shows its label, prompt, mark value, and answer input matching its answer mode [Schema].
- AC-23.2 Given the sum of part marks, then the question shows its total, equal to the stored marks (no separate total column that can disagree).
- AC-23.3 Given Bijak SPM Simulasi, then no per-page instant mark is shown (kept from .cloud F-74); in practice mode, the mark scheme reveals after I submit.
- AC-23.4 Given marking, then each part is marked against its own scheme and the result is stored per part.

**US-24 [M] As a Murid, I want to see the passage, table, diagram or audio a question depends on.**
- AC-24.1 Given a question with a stimulus, then it is shown with the question or one tap away, and stays available while I answer.
- AC-24.2 Given several questions share a stimulus, then it is stored once and every question shows the same content.
- AC-24.3 Given a figure, then it scales to the viewport and can be enlarged.
- AC-24.4 Given a missing stimulus file, then the question is not served and is flagged to Admin Pusat (never shown without its stimulus).

**US-25 [M] As a Murid, I want math, units and formulas displayed correctly.**
- AC-25.1 Given a question with fractions, powers, roots, subscripts, units, and chemical formulas, then they render formatted at 375 px without overlapping text.
- AC-25.2 Given a wide formula, then it scrolls inside its own container; the page does not scroll horizontally.
- AC-25.3 Given an option containing a formula, then it is selectable by tapping anywhere on the option.

**US-26 [M] As a Murid, I want Jawi, Arabic and mixed-language text displayed correctly.**
- AC-26.1 Given right-to-left text, then direction and shaping are correct, including a sentence mixing Malay and Arabic script.
- AC-26.2 Given a question tagged with a language, then the language is stored per question (BM, BI, Arab, Jawi [Schema]) and used by pools.
- AC-26.3 Given an RTL option, then its A-D label stays in the same position as the other options.

### Administration

**US-27 [M] As Admin Pusat, I want one list of the bank with filters and bulk actions.**
- AC-27.1 Given the bank list, then filters cover status, subject, level, chapter, DSKP topic, difficulty, type, source, year, language, duplicate flag, reported flag; counts match the rows.
- AC-27.2 Bulk archive / restore / change-tag actions apply only to selected rows, are logged, and obey the gates (§4.8).
- AC-27.3 Export of questions is Admin Pusat only and logged; the export contains only Terbit unless a status filter is chosen.
- AC-27.4 Only one list and one editor exist for the bank (E10).

**US-28 [M] As Admin Pusat, I want to manage the Paper blueprint (question structure) as data, so that a new subject or format needs no code change.**
- AC-28.1 Given a blueprint per subject x kertas, then it defines sections (label, instruction, question count or choose N of M, marks budget, allowed question types), total marks and duration [Schema].
- AC-28.2 Given a blueprint is changed, then it is versioned; papers already published stay valid under the version they were published with.
- AC-28.3 Given an extraction or manual form, then field sets and validation come from the blueprint / question-type definition, not from fixed screens.
- AC-28.4 Given "Jana Kertas" (D32), then the generator uses the same blueprint.

**US-29 [S] As Admin Pusat, I want an intake dashboard, so that I can see queue health and AI cost.**
- AC-29.1 Given the dashboard, then it shows: submissions by status, queue size and oldest item age, extraction success rate, percentage of tags accepted unchanged per field, duplicate rate, and AI cost this month.
- AC-29.2 Given a monthly AI budget [Default: configurable cap], when 80% is reached, then Admin Pusat is notified; at 100% new extractions are queued and not run until the cap is raised.
- AC-29.3 Replaces the legacy "Kualiti Soalan" dashboard (BS-04); legacy score semantics are not carried over.

**US-30 [S] As a Guru, I want in-app notifications when my items change status.**
- AC-30.1 Given an item is returned, approved, published, or withdrawn, then I receive one in-app notification with the item and reason.
- AC-30.2 Given I have many items, then notifications are grouped per submission.

**US-31 [M] As Admin Pusat, I want to see a failed or stuck extraction and act on it.**
- AC-31.1 Given a Submission stuck over [Default] 30 min, then it appears in an alert list.
- AC-31.2 Given a failed Submission, then Retry, Replace file, or Switch to manual entry are available, each logged.

**US-32 [C, later v2.1+] As Admin Pusat, I want AI-generated variants of an approved question.**
- AC-32.1 Given a Terbit question, when I request variants, then the AI creates Drafs marked source "Varian AI" linked to the parent question and its blueprint tags.
- AC-32.2 Variants follow the same Draf -> Semakan -> Lulus -> Terbit path and gates; none is served before human approval.
- AC-32.3 Variants of official past-year questions are never placed in Kertas Pilihan.
- AC-32.4 The data model must allow "Varian AI" and a parent link in v2.0, but no generation UI ships in v2.0.

## 6. Non-functional requirements

| ID | Area | Requirement |
|---|---|---|
| NFR-01 | OCR / AI accuracy (targets, measured on the pilot sample set before go-live) [Default] | Question segmentation: detected count equals true count >= 98% of papers (digital-born), >= 90% (scans). Stem and option text after normalisation: >= 97% character-accurate (digital), >= 92% (clean scan). Answer key matched to the right question >= 99% when a key is supplied. Tag top-1 accuracy: subject >= 98%, level >= 95%, chapter >= 80%, DSKP topic >= 70%, difficulty within +-1 of the reviewer >= 75%. Calibration: fields scored High are correct >= 97% of the time. Targets are reviewed after the pilot; missing a target means a higher Low threshold, not auto-approval. |
| NFR-02 | Throughput | A 40-question paper extracts in <= 10 min (p90); the review screen opens in <= 2 s (p90) on a typical 4G connection; the queue handles 5,000 open items with pagination. |
| NFR-03 | Cost | A monthly AI budget cap is configurable; usage per Submission is recorded (tokens / pages / cost) and reported (US-29). Proposed per-paper ceiling for a 40-question paper: [Default] RM 2.00, to be validated; extraction of an already-imported paper is blocked before any cost (AC-06.4). |
| NFR-04 | Privacy | **No student data in any AI prompt.** No names, ids, or free text from students, parents, or reports. Teacher and school details on a paper cover (names, school name, contact) are removed or masked before sending paper content to AI and are not stored in the question. AI requests use content + taxonomy only. The AI provider must not use the content for training and must follow PDPA-aligned retention; the provider and region are the user's decision (Q5). |
| NFR-05 | Copyright and source policy | Mandatory source declaration (AC-17.1). Third-party / commercial papers need a recorded rights decision before Terbit. Source files stay private and are not shown to Murid. A takedown withdraws all questions of a source (AC-17.3). Student-facing screens never show the original PDF. Policy default in Q4. |
| NFR-06 | Security | Role checks on every request (Guru sees only own; Pusat all); uploads validated by type and size, scanned for malware, and stored privately with expiring access links; no cross-school or cross-teacher reads by id; audit trail append-only. |
| NFR-07 | Reliability | An extraction can be retried without creating duplicates (idempotency by file hash + page + number label); a failed run leaves no half-created questions; the bank is never left with a published paper that has an unpublished question. |
| NFR-08 | Data integrity | Question id + version are stable; student history references the version served; no "marks" figure can disagree with the sum of its parts; counts shown anywhere are computed from the bank. |
| NFR-09 | Localisation | All UI in Bahasa Melayu with exact copy to be written by the designer; question content may be BM, BI, Arabic, or Jawi, tagged per question; dates in Malaysia time (Asia/Kuala_Lumpur); numbers and BM pagination as in D33. |
| NFR-10 | Accessibility | Follows the design-system baseline; figures have alt text; math has a text form; keyboard operation for the review screen (next / previous / accept / edit). |
| NFR-11 | Responsiveness | Review and display screens work at 375 / 768 / 1280 px with no horizontal page scroll (CLAUDE.md §7). Tablet and desktop are primary for review. |
| NFR-12 | Retention | Source files: retained while any question from them is Terbit plus [Default] 12 months, then deleted or archived (assumption A8); audit trail: [Default] 5 years. |

## 7. Scope and assumptions

### In scope (v2.0)
- Teacher PDF upload, Excel template import, manual create; OCR + AI extraction; AI tag suggestions with confidence; duplicate check; review queue; Draf -> Semakan -> Lulus -> Terbit -> Diarkib; versioning; audit; provenance and Sumber Kertas; source declaration.
- Paper assembly and publish gate under the Paper blueprint; blueprint management as data.
- Student reporting, triage, and fix loop; "Laporan Saya".
- Tag / pool serving contract for Bijak SPM, Latih Tubi, Papan Bijak, PKSK, quizzes, class sets.
- Student question display rules (MCQ, structured, stimulus, math, Jawi / Arabic).
- Menu mapping: BS-01 Bank Soalan, BS-02 Import & Semakan, BS-03 Sumber Kertas, BS-04 (as intake dashboard), BS-05 Laporan Soalan; KS-09 Set Builder and KS-05 mark-scheme editing consume this spec.

### Assumptions
- A1 Questions are not migrated from .cloud (D29a); historical attempts keep snapshots per `docs/architecture/v2-data-migration.md` §3.3; the bank is loaded only through this pipeline.
- A2 Roles and portals are as in `v2-portals.md` and D30-D33; the bank is in Portal Pentadbiran, Sumbang Soalan for Guru is in Portal Pembelajaran.
- A3 The user's exam schema will define question types, answer modes, mark schemes, sections and blueprints; v2.0 builds a pluggable structure, not a fixed one.
- A4 Review is human; the AI never approves.
- A5 Past-year official papers (LPM) are used as in .cloud; the rights position is Q4.
- A6 PKSK questions live in the same bank as a tag / pool (BS-06); Audio KBAT (BS-07) is outside this spec.
- A7 No private per-teacher question bank in v2.0 (Q8).
- A8 The source-file retention period is a default pending Q-assumption confirmation by the user.
- A9 Teacher "Set Soalan" (M10 class sets) uses only Terbit questions.

## 8. Data needs from the user (what we need)

### 8.1 The exam schema (per question type)
For each type the user's schema defines, we need: the type name and the list of types; the fields; which are required; the answer-key shape; the marks rule; the answer mode.

| # | Needed item |
|---|---|
| D1 | The list of **question types** (e.g. MCQ single, MCQ multiple, true / false, fill-in-blank, short answer, structured with parts, essay / karangan, comprehension, practical / diagram, other) with the exact names used in your papers. |
| D2 | For each type, the **fields** and their data type and required flag (stem, sub-stem, options, number of options, labels, parts, nesting depth, instruction text). |
| D3 | The **answer-key shape** per type: single / multiple letters, number with tolerance and unit, accepted text variants, ordering, matching, model answer. |
| D4 | The **mark scheme**: marks per question and per part, marking points / rubric levels (for essay), accepted alternatives, error-carried-forward rule, partial-credit rules, how total marks is computed. |
| D5 | **Sections** of a paper (Bahagian A / B / C ...): labels, instructions, "choose N of M", per-section marks and allowed types. |
| D6 | **Stimulus** types and sharing: passage, table, diagram, image, audio; "questions X-Y based on ..."; reuse across papers. |
| D7 | **Paper blueprint** per subject x kertas: duration, total marks, number of questions, section composition, topic weighting, difficulty mix, cognitive level, selection rules for random generation. |
| D8 | **Controlled vocabularies**: difficulty scale (values and meaning), cognitive / KBAT level if used, question language codes, paper types, exam boards / bodies, status words you want shown. |
| D9 | **Curriculum list**: subjects (with codes), levels, chapters, DSKP topic codes and names, per subject and level (we can reuse M03 if it matches; confirm it is the right list). |
| D10 | **Per-question metadata**: year, source, number label format, rights field values, anything else you want recorded on a question. |
| D11 | Rules about **what counts as a duplicate** in your view (same stem with different numbers? same question in a different paper?). |
| D12 | Any **lifecycle words or rules** you want to change in §4.1. |

### 8.2 Sample PDFs
| # | Needed item |
|---|---|
| S1 | At least **3 papers per format family**, so about 20-30 papers: MCQ-only (e.g. Sains / Sejarah paper 1); structured with parts and marks (e.g. Matematik, Sains paper 2); essay / karangan (BM, BI); comprehension with passages (BI, BM); Arabic / Jawi (Pendidikan Islam, Bahasa Arab); diagram-heavy (Fizik, Biologi, Geografi); math-heavy (Matematik Tambahan); a bilingual (dwibahasa) paper. |
| S2 | **Scan quality mix** per family: digital-born PDF; clean scan; photocopy; phone photo; skewed or dark pages; handwritten annotations. State which one is typical for your teachers. |
| S3 | Whether the **answer scheme** is in the same PDF, a separate file, or absent, for each sample. |
| S4 | For each sample, the **correct digital version** if you have one (Word / Excel), so we can measure accuracy (ground truth), or at least 5 papers whose questions you will check by hand. |
| S5 | **Levels** covered (Tingkatan 4-5 only, or Tingkatan 1-3 and Darjah too) and the subjects for the pilot. |
| S6 | **Permission** to use each sample for development and testing, and whether it contains personal data (teacher or school names on the cover). |
| S7 | A rough **volume forecast**: papers per month at start, papers per month when stable, teachers who will upload. |

## 9. Open questions (blocking only)

| ID | Question | Blocks | Recommended default |
|---|---|---|---|
| Q1 | Share the **exam schema** (§8.1). | G2 data model; tasks for extraction, form, Excel template, display of parts | Proceed with the pluggable structure described in this document; final fields wait for the user. |
| Q2 | Share the **sample PDFs** (§8.2). | OCR / AI choice, accuracy targets (NFR-01), cost estimate | Start the pilot with the first 3 families of S1 once received; keep NFR-01 targets as proposed. |
| Q3 | Who may approve? Only Admin Pusat, or also trusted Guru reviewers (a role that does not exist in .cloud)? | Role model, permission matrix | Admin Pusat only. Guru verifies own items (Draf -> Semakan). Self-approval by Admin Pusat is allowed and logged. |
| Q4 | **Copyright and source policy** for uploaded papers (official LPM past-year, state trial papers, publisher / textbook content). | Publish rules, takedown process | Allow own / school-owned and official KPM / LPM past-year papers; commercial / third-party need an Admin Pusat rights decision before Terbit (AC-17.2); no student-facing source PDF; takedown by source. |
| Q5 | **AI provider and data location**: can paper content (personal names masked, no student data) be sent to an external AI service, and where is the content stored? | NFR-04, vendor choice at G2 | Yes for masked paper content with a no-training, short-retention setting; never student data; provider decided at G2 with the user. |
| Q6 | **Launch scope**: which levels and subjects first? | Pilot, blueprints, sample set | SPM Tingkatan 4-5, a few core subjects first; PT3 (Tingkatan 1-3) and Darjah in later waves. |
| Q7 | **Auto-hide rule for reports**: .cloud hides an MCQ at the first report but a structured question at the third. | AC-18.4, abuse risk | One rule for all types: hide pending review after 3 reports from different students; Admin Pusat can hide at once (Nyahaktif Segera). |
| Q8 | Does v2.0 need **private teacher questions** (visible only to the teacher's own class sets, no national review)? | Visibility model, review load | No private bank in v2.0: everything goes through the shared bank; class sets use Terbit questions (A7, A9). |
| Q9 | Should **Admin Sekolah** see the status of their own school's teacher submissions (read-only)? | Permission matrix | No access in v2.0 (D30), so no scope work is needed. |
| Q10 | Which **file types** besides PDF: DOCX, photos (JPG / PNG) of papers? | Extraction scope, scan quality | PDF and image files (JPG / PNG); DOCX and Excel through the template only; keep the 20 MB / 5 files limits of .cloud (`TC:1006-1007`). |

## 10. Out of scope for v2.0

- Migrating any question from .cloud or .my (D29a); the archive is read-only (`v2-data-migration.md` §3.3).
- AI variant generation UI and AI-written new questions (US-32; data model only).
- AI marking of essays and structured answers (separate, M13 / KS-10).
- Auto-approval or auto-publish of any question; auto-tagging without human confirmation.
- Private per-teacher banks, marketplace sale of questions, contributor rewards (D28c).
- Admin Sekolah, PPD / JPN, Ibu bapa access to the bank.
- Audio KBAT items (BS-07) and PKSK-specific content rules beyond using the same bank.
- Handwriting recognition of student answers; scanning of student work.
- UI design and technology choices (owned by `ui-ux-designer` and `solution-architect`).
- Legacy features not rebuilt: Studio duplicate UIs, dead CSV stub, legacy create form, CLI importers (E2, E10).
- Public search engines or open question sharing.

## Addendum 2026-10-29: question images, student image access and kertas (Standard track)

Decisions of the user for the manual forms (admin and Guru) and the paper builder. No new table or column.

1. **Images by file id (D-7 completed).** Create and update stay JSON. The form first uploads each picture with `POST /api/files?purpose=question_image` and then sends the returned file token: `questionImageFileId` (stem image) and `optionImageFileIds` (four positions, null = none). Omitted keeps what is stored; `removeQuestionImage` / `removeOptionImage` and a null id remove. The stem image is stored as an **image stimulus** linked to the question version (no new column); option images stay on the options. The admin and Guru reads return `questionImage` and `optionImages` as the same tokens. Errors use the keys `questionImage`, `optionImages.<i>`.
2. **Ownership only on new files.** A Guru may attach only their own files (unowned files are allowed; an admin may attach any). The check applies to image ids that are NEW compared with the stored version, so a Guru can edit an admin-made question that already has images. A missing file, a wrong purpose and someone else's new file all give the same 422 (no existence oracle).
3. **Students read question images of live questions.** A signed-in user other than staff may download a `question_image` file only while it belongs to the live version of an active, published question; drafts, withdrawn questions and loose uploads stay admin and teacher only (404, never 403).
4. **Kertas.** `kertas` (`'1'`, `'2'`, `'3'`, nullable, optional; error key `kertas`) is accepted on the admin create and update and as an optional last column `kertas` of the CSV import and its template. It is stored as the trailing digit of `question_versions.paper_code` (an existing `…/<digit>` code has its digit replaced, otherwise `<subject code>/<digit>`, for example `MATH/2`). This is the form the paper builder already reads (`candidates`, `kertasOf`) and needs no mapping from the curriculum subject to a Bijak subject code or a section letter, which a pool tag `MAT2-B` would need. Intake accept derives it from the source paper: its `paper_code` when it ends in `/<digit>` (stored verbatim), else the digit of its printed label (`K2`, `P1`); no source paper means no kertas. A question without a kertas is not a paper-builder candidate.
5. **Known limit.** A stem image is an image stimulus on the version; the Bijak and practice bridges still refuse questions that carry version stimuli outside a group, so such questions do not enter those pools yet (out of scope here).
