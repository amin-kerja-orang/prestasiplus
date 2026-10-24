# M03 — Curriculum (Subjects, Levels, Topics) — User Requirements Specification

## 0. Document control

| Field | Value |
|---|---|
| Document | URS — M03 Curriculum (Subjects, Levels, Topics) |
| Version | 1.10 |
| Date | 2026-09-25 |
| Status | Approved (G1) |
| Author | product-analyst (agent) |
| Source discovery | [M03-curriculum.md](../../discovery/M03-curriculum.md) (incl. Appendix A exact strings, B enumerations, C reconciliation), element inventory [`inventory/M03/`](../../discovery/inventory/M03/) (`S1…S14-*.json`, `SHA-admin-shell.json`, `SHU-user-shell.json`, `_crawl.json`, `_summary.md`, `_curriculum-data.json`), global shell [00-global-ui.md](../../discovery/00-global-ui.md), screenshots `docs/discovery/img/M03/` (37) |
| Companion SRS | [srs/M03-curriculum.md](../srs/M03-curriculum.md) |
| Audit | [qa/audit/M03-audit.md](../../qa/audit/M03-audit.md) (round 1: FAIL, all findings addressed in v1.1) |
| Related | [urs/M01-authentication.md](M01-authentication.md) (v1.5: `grade` 1–11, canonical seed accounts), [urs/M02-users-schools.md](M02-users-schools.md) (v1.2: `classLevel` D1–T5, school types), [urs/M04-question-bank.md](M04-question-bank.md) (v1.1: question dataset, D11), [urs/M05-practice.md](M05-practice.md) (v1.1: answer log, D12), [design/shells.md](../../design/shells.md) (DV-SH-03) |

**Change log**

| Version | Date | Change |
|---|---|---|
| 1.10 | 2026-09-27 | **Revision history — v1.10** (XL3-24): OQ-12 added (out-of-tree chapters counted by M17); no other URS change; version aligned with SRS v1.10. Status Approved (G1) kept. |
| 1.9 | 2026-09-27 | **Revision history — v1.9**: no URS content change; version aligned with SRS v1.9 (named queries §6.11, test-only override, id floors, subtopics 133/134 kept). Status Approved (G1) kept. |
| 1.8 | 2026-09-26 | **Revision history — v1.8**: no URS content change; version aligned with SRS v1.8 (chapter ids observed in M10 kept as live ids, XL2-17). Status Approved (G1) kept. |
| 1.7 | 2026-09-25 | **Revision history — v1.7, XL round 3** (XL-36): "Soalan" counts cite M04 SRS §4.1 Q-ACTIVE(subject) / Q-ACTIVE(level) (FN-6.3.5, AC-30.3, OQ-10). Status Approved (G1) kept. |
| 1.6 | 2026-09-25 | **Revision history — v1.6**: no URS content change; version aligned with SRS v1.6 (dataset spec §6.10, ADR-0013). Status Approved (G1) kept. |
| 1.5 | 2026-09-25 | **Revision history — v1.5, cross-module logic review** (`docs/qa/audit/cross-module-logic-M01-M07.md`; D11, D12). XL-02: "Soalan" counts come from the M04 D11 dataset (AC-30.3, OQ-10). XL-17: student topic progress is derived from the M05 answer log (§2, AC-22.6, §8, OQ-4). XL-20: DV-M03-04 is an instance of shell rule DV-SH-03 (§7). XL-14/XL-25: cross-references refreshed (Related). Status Approved (G1) kept. Coverage unchanged. |
| 1.4 | 2026-09-25 | **Revision history — v1.4**: no URS content change; version aligned with SRS v1.4 (chapter ids observed on the M05 chapter pages kept in the seed, M05 OQ-13c). |
| 1.3 | 2026-09-25 | **Revision history — v1.3, round-2 audit Minor findings** (round 2: PASS). R2-23: DV-M03-06(b) covers text only; decorative icons (8 px ticks, 6–8 px dots, chevrons) keep their live size (§7). R2-24: the ≥12 px rule is limited to M03 content inside `main`; the global shell belongs to M23 (AC-31.1, §7). R2-22/R2-25 are SRS-only. |
| 1.2 | 2026-09-25 | **Revision history — v1.2**: no URS content change; version aligned with the SRS v1.2 integer-id alignment (M04 audit). |
| 1.1 | 2026-09-25 | **Revision history — v1.1, audit fixes** (`docs/qa/audit/M03-audit.md`, round 1 FAIL: 8 Major, 13 Minor) and project decision D10 (accessibility and scope replicate live). AUD-01: "Batal" only hides the subtopic forms, typed values persist until reload (FN-1.1.16/18, AC-04.1/04.4). AUD-02: S7/S8 levels are a single-column 256 px scroll box (FN-2.2.9, AC-13.2). AUD-03: form buttons inline, right-aligned at every width (AC-31.4). AUD-04/05: Peta Belajar pill colours and hero labels as observed (AC-25.1, 24.2). AUD-06: DV-M03-08 reduced to removing the always-empty "🌍 Geografi" pill; Darjah 1–4 and the fallback to Darjah 4 replicated; "📚" icons and the learner-grade default removed (FN-5.1.4/5/11, AC-25.x). AUD-07: DV-M03-02 withdrawn; /topics chips as live (FN-4.1.2/3, AC-20.x). AUD-08: no reduced-motion handling (§7 D-10). AUD-09: "Topik tidak dijumpai." OBSERVED (FN-1.1.19, 1.5.7, AC-05.4). AUD-10: all 8 practice codes OBSERVED, OQ-7 closed. AUD-11: S6 below 640 px (FN-2.1.3, AC-10.3). AUD-12: displayed "CTH: MATH01"/"CTH: Y1" (FN-2.2.4, 3.2.4). AUD-13: S9–S11 pink accent (FN-3.1.2, 3.2.8). AUD-14: S2 back link keeps the received query (FN-1.2.2, AC-06.3). AUD-15/16/17/19/21: breakpoints, static bar, case-insensitive /topics filters (AC-20.7), S13 details, INFERRED tags. AUD-18: seed uses the captured subtopic names (OQ-11 narrowed). AUD-20: the ≥12 px text rule of DV-M03-06 applied to every M03 screen (master NFR-02: text < 12 px is unreadable). Coverage still 807/807. |
| 1.0 | 2026-09-25 | First issue, written under D7 (fidelity), D8 (proven completeness) and D9 (deviation rule). The Epic → Feature → Function breakdown (§3) and the coverage matrix (§6) are generated by script from the inventory JSON (807/807 content elements covered). Deviations DV-M03-01…09 applied under D9; discovery defects D-9, D-10, D-11, D-12 are replicated as live. |

**Conventions** (as M01/M02)
- Quoted UI copy is the exact live text **as displayed**. Where CSS changes the casing, the displayed form is given and the source text noted (e.g. sidebar "KURIKULUM", source "Kurikulum"; S6/S9 table headers displayed upper-case, e.g. "NAMA (BM)"; S12 "SUBTOPIK:", source "Subtopik:"). English appears only where the live site uses it ("Level 1", "Chapter ID diperlukan.", English level/subject names such as "Year 1", English legacy topic names such as "Phonics and Vocabulary").
- **OBSERVED** = seen on the live site (walkthrough, inventory state, page script or markup). **INFERRED** = the live site does it but it could not be observed read-only (every POST/PUT/DELETE outcome, toggle responses, inactive-record display, Peta Belajar mastered/started states and formulas, a real student's defaults). For INFERRED behaviour the most likely live behaviour is specified and no new UX is invented.
- **UNVERIFIED COPY** = text shown after an action that could not be captured. The prototype uses the placeholder given in SRS §8 until verified (§9 OQ-1).
- **DV-M03-nn** = a fidelity deviation decided under rule D9 (§7). Anything not listed there must match the live site. Under D10, accessibility behaviour (ARIA, keyboard, focus, reduced motion) replicates live, and deliberate, consistent live limitations (e.g. Peta Belajar Darjah 1–4, the /topics chip set) are replicated, not extended.
- There is no personal data on M03 screens. Curriculum data (subjects, levels, chapters, topics, subtopics, legacy topics) is public reference data and is quoted and seeded as is (with the D9 data fixes of DV-M03-09).

---

## 1. Overview

M03 manages and presents the curriculum. On the live site it consists of **two separate data sets** that are not linked to each other (different ids, names and subject codes). The rebuild keeps both, exactly as live (D7; §9 OQ-3):

1. **Admin curriculum ("DSKP tree")** — 11 education levels (`D1`–`D6` Darjah 1–6, `T1`–`T5` Tingkatan 1–5) and 31 subjects, linked many-to-many (194 subject × level links). For each subject × level pair there is a tree **Bab (chapter) → Topik (topic) → Subtopik (subtopic)**: 1,251 chapters, 2,423 topics, 234 subtopics (140 pairs have chapters, 54 are empty). Admins manage subjects, levels and the tree in the admin panel (sidebar "PENGURUSAN" → group "KURIKULUM": "Kurikulum", "Subjek", "Tahap Pendidikan"). Subjects and levels are the reference data used by M04 (question subject/level/topic), M05 (practice) and M01/M02 (the learner's level, grade 1–11).
2. **Student topic catalogue ("legacy topics")** — a flat list of 125 topics, each with a grade code (`DARJAH_1`…`TINGKATAN_5`), an upper-case subject code (`MATEMATIK`, `BAHASA_MELAYU`, `BAHASA_INGGERIS`, `SAINS`, `PENDIDIKAN_ISLAM`, `PENDIDIKAN_MORAL`, `SEJARAH`, `GEOGRAFI`), an emoji icon and 1–6 subtopics. It feeds the student pages `/topics`, `/topics/{id}` and `/peta-belajar`, which hand off to M05 practice: `/topics/{id}` → `/practice/{admin subject code}`; Peta Belajar islands → `/practice?topic_id={legacy topic id}`. No admin screen maintains it (§9 OQ-2).

The rebuild replicates the live behaviour exactly (D7), as a front-end prototype with dummy data and a mock service layer (D1, D2). Its curriculum data is **seeded from `_curriculum-data.json`** (public, non-personal), with the data-quality fixes of DV-M03-09.

**Routes covered** (`docs/TRACKER.md` §4 M03, plus the routes found by the crawl):

| # | Route | Screen (shell header title / subtitle) | Tab title (exact) |
|---|---|---|---|
| S1 | `/admin/curriculum` (`?subject_id=&education_level_id=`) | "Pengurusan Kurikulum" / "Urus struktur kurikulum (Bab → Topik → Subtopik)" | "Pengurusan Kurikulum - Admin PRESTASIPLUS" |
| S2 | `/admin/curriculum/chapters/create` (`?subject_id=&education_level_id=`) | "Tambah Bab Baru" / "Cipta bab baharu dalam kurikulum" | "Tambah Bab - Admin PRESTASIPLUS" |
| S3 | `/admin/curriculum/chapters/{id}/edit` | "Edit Bab" / "Kemaskini maklumat bab" | "Edit Bab - Admin PRESTASIPLUS" |
| S4 | `/admin/curriculum/topics/create?chapter_id={id}` | "Tambah Topik Baru" / "Cipta topik baharu dalam bab" | "Tambah Topik - Admin PRESTASIPLUS" |
| S5 | `/admin/curriculum/topics/{id}/edit` | "Edit Topik" / "Kemaskini maklumat topik" | "Edit Topik - Admin PRESTASIPLUS" |
| S6 | `/admin/subjects` | "Pengurusan Subjek" / "Urus subjek pembelajaran dalam sistem" | "Pengurusan Subjek - Admin PRESTASIPLUS" |
| S7 | `/admin/subjects/create` | "Tambah Subjek Baru" / "Cipta subjek pembelajaran baharu" | "Tambah Subjek - Admin PRESTASIPLUS" |
| S8 | `/admin/subjects/{id}/edit` | "Edit Subjek" / "Kemaskini maklumat subjek" | "Edit Subjek - Admin PRESTASIPLUS" |
| S9 | `/admin/education-levels` | "Pengurusan Tahap Pendidikan" / "Urus tahap pendidikan dalam sistem" | "Pengurusan Tahap Pendidikan - Admin PRESTASIPLUS" |
| S10 | `/admin/education-levels/create` | "Tambah Tahap Pendidikan" / "Cipta tahap pendidikan baharu" | "Tambah Tahap Pendidikan - Admin PRESTASIPLUS" |
| S11 | `/admin/education-levels/{id}/edit` | "Edit Tahap Pendidikan" / "Kemaskini maklumat tahap pendidikan" | "Edit Tahap Pendidikan - Admin PRESTASIPLUS" |
| S12 | `/topics` (`?grade_level=&subject=`) | "Topik Pembelajaran" / "Terokai semua topik pembelajaran" | "Topik - PRESTASIPLUS" |
| S13 | `/topics/{id}` | "{topic name}" / "{SUBJECT LABEL}" | "{topic name} - PRESTASIPLUS" |
| S14 | `/peta-belajar` (`?subject=&grade=`) | "Peta Belajar" (no subtitle; DV-M03-04 — live shows "Dashboard" / "Selamat datang kembali") | "Peta Belajar — PRESTASIPLUS" (em dash, as live) |

There are no subtopic pages (subtopics are edited inline on S1), no index/show pages for chapters, topics, subjects or levels (405 on live), and no JSON read endpoints on live (`/api/subjects`, `/api/education-levels`, `/api/topics`, … are 404). None are added as screens. The mock service layer still exposes REST read endpoints (SRS §7), because the prototype has no server rendering (D2). Lists have no pagination, search or sorting controls on any M03 screen (as live).

## 2. Actors

| Role | Involvement in M03 | Verified |
|---|---|---|
| Admin | Sole user of S1–S11 (curriculum tree, subjects, levels). Also sees S12–S14 in the user portal (all discovery of S12–S14 was done as admin: progress 0, Peta Belajar default grade Darjah 4). | Yes (admin account) |
| Pelajar (student) | Main user of S12–S14: browses the topic catalogue, opens a topic, starts practice, follows the learning map with personal progress. | Inferred (menus observed in the user portal; no student account) |
| Guru, Ibu Bapa, other portal roles | The user-portal menu items "Topik" / "Peta Belajar" are shown in the shell; whether other roles see them is not known. | Inferred |
| Guest | Any M03 route redirects to `/login` (INFERRED; the global auth rule of M01 FR-M01-14). | Inferred |
| Other modules (system actors) | M04 (question subject/level/topic; its D11 dataset gives the "Soalan" counts), M05 (practice by subject code or legacy topic id; its answer log, owned by M05 per D12, feeds the S13/S14 progress), M01/M02 (learner grade 1–11 ↔ level). | Inferred (links observed; data flows inferred) |

URS.md §6: no correction needed.

---

## 3. Functional breakdown (Epic → Feature → Function)

Generated by script from the element inventory (`docs/discovery/inventory/M03/`) and the function list (`gen.js` + `fns.txt` in the author's scratchpad). "EL" lists inventory element IDs (prefix `EL-M03-`). Functions with no EL are behaviours (post-submit results, rules, access) with no element of their own. Roles: "Admin" for S1–S11; "Student" for S12–S14 (all portal users, INFERRED).

### EP-M03-1 — Curriculum tree administration (DSKP tree: Bab → Topik → Subtopik)

**FT-M03-1.1 — Curriculum browser and tree** (S1 `/admin/curriculum`)

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M03-1.1.1 | Shell header "Pengurusan Kurikulum" / "Urus struktur kurikulum (Bab → Topik → Subtopik)"; tab title "Pengurusan Kurikulum - Admin PRESTASIPLUS" | SHA-118–119 | Admin | OBSERVED |
| FN-M03-1.1.2 | Filter card "Tapis Kurikulum" (`fa-filter`): GET form to `/admin/curriculum` with "Subjek" select (`subject_id`: "-- Pilih Subjek --" + the 31 subjects, label = Nama (BM), value = id), "Tahap" select (`education_level_id`: "-- Pilih Tahap --" + Darjah 1 … Tingkatan 5, value 1–11) and submit "Tapis" (`fa-search`); selects keep the query values; options are not filtered by each other | S1-001–008 | Admin | OBSERVED |
| FN-M03-1.1.3 | Prompt card when `subject_id` or `education_level_id` is missing: `fa-info-circle` "Sila pilih subjek dan tahap pendidikan" / "Gunakan penapis di atas" | S1-009–010 | Admin | OBSERVED |
| FN-M03-1.1.4 | Summary cards for the selected pair: "Subjek" (blue, `fa-book`, subject name), "Tahap" (purple, `fa-graduation-cap`, level name), "Jumlah Bab" (emerald, `fa-book-open`, count), "Topik / Subtopik" (amber, `fa-list`, "{topics} / {subtopics}") | S1-011–022, S1-115–121, S1-127–128, S1-131–137 | Admin | OBSERVED |
| FN-M03-1.1.5 | Button "Tambah Bab" (`fa-plus`) → `/admin/curriculum/chapters/create?subject_id={s}&education_level_id={l}` | S1-023, S1-122, S1-129, S1-138 | Admin | OBSERVED |
| FN-M03-1.1.6 | Empty tree: `fa-inbox` "Tiada bab dijumpai untuk subjek dan tahap ini." + link "Tambah Bab Pertama" (`fa-plus`, same create URL); also shown for a level not linked to the subject (the link is not checked) | S1-123–124, S1-130 | Admin | OBSERVED |
| FN-M03-1.1.7 | Chapter block (expanded by default): chevron toggle (`fa-chevron-down` ↔ `fa-chevron-right`) collapses/expands its topics and its "Tambah Topik" link; `fa-book-open` + heading "Bab {chapter_number}: {name}"; optional description line. Titles wrap instead of being cut with an ellipsis; text ≥12 px (DV-M03-06) | S1-024–026, S1-077–078, S1-139–140, S1-158 | Admin | OBSERVED + DV-M03-06 |
| FN-M03-1.1.8 | Chapter edit link (`fa-edit`, tooltip "Edit Bab") → `/admin/curriculum/chapters/{id}/edit` | S1-027, S1-079 | Admin | OBSERVED |
| FN-M03-1.1.9 | Chapter delete form `DELETE /admin/curriculum/chapters/{id}` (`fa-trash`, tooltip "Padam Bab") with native confirm "Adakah anda pasti mahu padam bab ini?" | S1-028–031, S1-080–083 | Admin | OBSERVED (UI) / INFERRED (result) |
| FN-M03-1.1.10 | Chapter order: by chapter number ascending, then creation order (DV-M03-05; live shows stored order, e.g. Bab 3…8, 1, 2) | — | Admin | DV-M03-05 |
| FN-M03-1.1.11 | Topic row (collapsed by default): chevron toggle shows/hides its subtopics; `fa-list` (purple) + heading "Topik {topic_number}: {name}"; description line. Titles wrap (DV-M03-06). Topic order: topic number (natural order), then creation order (DV-M03-05) | S1-032–034, S1-084–086, S1-141–142, S1-145–146, S1-148–150 | Admin | OBSERVED + DV-M03-05/06 |
| FN-M03-1.1.12 | Topic edit link (`fa-edit`, tooltip "Edit Topik") → `/admin/curriculum/topics/{id}/edit` | S1-035, S1-087, S1-151 | Admin | OBSERVED |
| FN-M03-1.1.13 | Topic delete form `DELETE /admin/curriculum/topics/{id}` (`fa-trash`, tooltip "Padam Topik") with native confirm "Adakah anda pasti mahu padam topik ini?" | S1-036–039, S1-088–091, S1-152 | Admin | OBSERVED (UI) / INFERRED (result) |
| FN-M03-1.1.14 | Link "Tambah Topik" (`fa-plus`) after each chapter's topics → `/admin/curriculum/topics/create?chapter_id={id}` | S1-076, S1-114, S1-157, S1-159 | Admin | OBSERVED |
| FN-M03-1.1.15 | Subtopic list of an open topic: one row per subtopic (`fa-chevron-right` + name, wraps per DV-M03-06); "Tiada subtopik" (italic) when none | S1-040, S1-054, S1-092, S1-143, S1-147, S1-153 | Admin | OBSERVED |
| FN-M03-1.1.16 | Subtopic inline edit: button (`fa-edit`, tooltip "Edit Subtopik") replaces the row with a purple form `PUT /admin/curriculum/subtopics/{id}`: `name` required (placeholder "Nama Subtopik (BM)", pre-filled), `name_en` ("Nama Subtopik (EN)"), `learning_objective` textarea 2 rows ("Objektif Pembelajaran"); "Simpan" (`fa-save`) and "Batal". "Batal" only hides the form: the row shows the stored name again, but typed values stay in the hidden inputs and reappear when the form is reopened, until the page reloads. One subtopic per topic in edit mode | S1-041, S1-046–053, S1-055, S1-060–067, S1-093, S1-098–105 | Admin | OBSERVED (UI, Batal) / INFERRED (result) |
| FN-M03-1.1.17 | Subtopic delete form `DELETE /admin/curriculum/subtopics/{id}` (`fa-trash`, tooltip "Padam Subtopik") with native confirm "Adakah anda pasti mahu padam subtopik ini?" | S1-042–045, S1-056–059, S1-094–097 | Admin | OBSERVED (UI) / INFERRED (result) |
| FN-M03-1.1.18 | Add subtopic: toggle button `fa-plus` "Tambah Subtopik" ↔ `fa-minus` "Batal" shows/hides an inline form `POST /admin/curriculum/subtopics` (hidden `curriculum_topic_id`; `name` required "Nama Subtopik (BM)"; `name_en` "Nama Subtopik (EN)"; `learning_objective` "Objektif Pembelajaran"; submit "Tambah Subtopik" `fa-plus`). "Batal" only hides the form; typed values stay until the page reloads | S1-068–075, S1-106–113, S1-144, S1-154–156, S1-160 | Admin | OBSERVED (UI) / INFERRED (result) |
| FN-M03-1.1.19 | Red flash (`fa-exclamation-circle`, one-time) after a redirect: "Bab tidak dijumpai." (unknown chapter id), "Chapter ID diperlukan." (topic create without `chapter_id`) and "Topik tidak dijumpai." (unknown topic id on S5) — exact live copy (DV candidate D-11 rejected) | S1-125–126 | Admin | OBSERVED |
| FN-M03-1.1.20 | Results of chapter/topic/subtopic delete and inline subtopic add/edit: redirect back to the same `subject_id` + `education_level_id` tree with a green success flash; deletes cascade to children | — | Admin | INFERRED (UNVERIFIED COPY) |
| FN-M03-1.1.21 | Inactive chapters/topics (`is_active` = 0) stay listed in the admin tree with no marker; counts include them | — | Admin | INFERRED |

**FT-M03-1.2 — Create chapter** (S2 `/admin/curriculum/chapters/create`)

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M03-1.2.1 | Shell header "Tambah Bab Baru" / "Cipta bab baharu dalam kurikulum"; tab title "Tambah Bab - Admin PRESTASIPLUS" | SHA-201–202 | Admin | OBSERVED |
| FN-M03-1.2.2 | Back link "Kembali ke Kurikulum" (`fa-arrow-left`) and "Batal" → `/admin/curriculum` carrying whichever of `subject_id` / `education_level_id` S2 received (both, one, or none → `/admin/curriculum`) | S2-001, S2-018, S2-020–021 | Admin | OBSERVED |
| FN-M03-1.2.3 | Form `POST /admin/curriculum/chapters`: "Subjek *" select (required, "-- Pilih Subjek --" + 31 subjects) and "Tahap Pendidikan *" select (required, "-- Pilih Tahap --" + 11 levels), pre-selected from the query | S2-002–008 | Admin | OBSERVED |
| FN-M03-1.2.4 | "Nama Bab (Bahasa Melayu) *" (`name`, required, "cth: Nombor Bulat") and "Nama Bab (English)" (`name_en`, "e.g: Whole Numbers") | S2-009–012 | Admin | OBSERVED |
| FN-M03-1.2.5 | "Nombor Bab" (`chapter_number`, number, min 1, "cth: 1") + hint `fa-info-circle` "Contoh: 1, 2, 3 (opsional)" | S2-013–015 | Admin | OBSERVED |
| FN-M03-1.2.6 | "Penerangan" (`description`, textarea 4 rows, "Penerangan ringkas tentang bab ini...") | S2-016–017 | Admin | OBSERVED |
| FN-M03-1.2.7 | Submit "Simpan Bab" (`fa-save`); no "Aktif" field (new chapters are active) | S2-019 | Admin | OBSERVED (UI) / INFERRED (default) |
| FN-M03-1.2.8 | Result: on success redirect to the S1 tree of the chosen pair with a success flash; on validation failure the form returns with errors and the input kept | — | Admin | INFERRED (UNVERIFIED COPY) |

**FT-M03-1.3 — Edit chapter** (S3 `/admin/curriculum/chapters/{id}/edit`)

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M03-1.3.1 | Shell header "Edit Bab" / "Kemaskini maklumat bab"; tab title "Edit Bab - Admin PRESTASIPLUS" | SHA-205–206 | Admin | OBSERVED |
| FN-M03-1.3.2 | "Kembali ke Kurikulum" and "Batal" → the S1 tree of the chapter's subject + level | S3-001, S3-022 | Admin | OBSERVED |
| FN-M03-1.3.3 | Form `PUT /admin/curriculum/chapters/{id}` with the S2 fields pre-filled (subject and level can be changed) | S3-002–018 | Admin | OBSERVED |
| FN-M03-1.3.4 | Checkbox "Aktif" (`is_active` value 1) + hint "Nyahtanda jika bab ini tidak mahu dipaparkan buat masa ini" | S3-019–021 | Admin | OBSERVED |
| FN-M03-1.3.5 | Submit "Kemaskini Bab" (`fa-save`) | S3-023 | Admin | OBSERVED (UI) |
| FN-M03-1.3.6 | Unknown chapter id → redirect to `/admin/curriculum` with flash "Bab tidak dijumpai." | — | Admin | OBSERVED |
| FN-M03-1.3.7 | Result: redirect to the S1 tree of the (possibly new) pair with a success flash; validation errors keep the input | — | Admin | INFERRED (UNVERIFIED COPY) |

**FT-M03-1.4 — Create topic** (S4 `/admin/curriculum/topics/create?chapter_id={id}`)

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M03-1.4.1 | Shell header "Tambah Topik Baru" / "Cipta topik baharu dalam bab"; tab title "Tambah Topik - Admin PRESTASIPLUS" | SHA-207–208 | Admin | OBSERVED |
| FN-M03-1.4.2 | "Kembali ke Kurikulum" and "Batal" → the S1 tree of the chapter's subject + level | S4-001, S4-023 | Admin | OBSERVED |
| FN-M03-1.4.3 | Chapter context card: `fa-book-open` tile, label "Bab", heading "Bab {n}: {name}", chips `fa-book` {subject} and `fa-graduation-cap` {level} | S4-002–006 | Admin | OBSERVED |
| FN-M03-1.4.4 | Form `POST /admin/curriculum/topics` (hidden `chapter_id`): "Nama Topik (Bahasa Melayu) *" (`name`, required, "cth: Nombor hingga 1000"), "Nama Topik (English)" (`name_en`, "e.g: Numbers up to 1000") | S4-007–014 | Admin | OBSERVED |
| FN-M03-1.4.5 | "Nombor Topik" (`topic_number`, text, "cth: 1.1") + hint `fa-info-circle` "Contoh: 1.1, 1.2, 2.1 (opsional)" | S4-015–017 | Admin | OBSERVED |
| FN-M03-1.4.6 | "Penerangan" (textarea 4, "Penerangan ringkas tentang topik ini...") and "Standard Pembelajaran" (`learning_standard`, textarea 4, "Standard pembelajaran mengikut kurikulum KSSM/KSSR...") + hint `fa-info-circle` "Rujuk dokumen standard kurikulum KPM" | S4-018–022 | Admin | OBSERVED |
| FN-M03-1.4.7 | Submit "Simpan Topik" (`fa-save`); no "Aktif" field | S4-024 | Admin | OBSERVED |
| FN-M03-1.4.8 | Guard: no `chapter_id` → redirect to `/admin/curriculum` with "Chapter ID diperlukan."; unknown id → "Bab tidak dijumpai." | — | Admin | OBSERVED |
| FN-M03-1.4.9 | Result: redirect to the S1 tree with a success flash; validation errors keep the input | — | Admin | INFERRED (UNVERIFIED COPY) |

**FT-M03-1.5 — Edit topic** (S5 `/admin/curriculum/topics/{id}/edit`)

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M03-1.5.1 | Shell header "Edit Topik" / "Kemaskini maklumat topik"; tab title "Edit Topik - Admin PRESTASIPLUS" | SHA-210–211 | Admin | OBSERVED |
| FN-M03-1.5.2 | "Kembali ke Kurikulum" and "Batal" → S1 tree of the topic's chapter | S5-001, S5-026 | Admin | OBSERVED |
| FN-M03-1.5.3 | Chapter context card as S4 (the chapter cannot be changed here) | S5-002–006 | Admin | OBSERVED |
| FN-M03-1.5.4 | Form `PUT /admin/curriculum/topics/{id}` with the S4 fields pre-filled | S5-007–022 | Admin | OBSERVED |
| FN-M03-1.5.5 | Checkbox "Aktif" (`is_active`) + hint "Nyahtanda jika topik ini tidak mahu dipaparkan buat masa ini" | S5-023–025 | Admin | OBSERVED |
| FN-M03-1.5.6 | Submit "Kemaskini Topik" (`fa-save`) | S5-027 | Admin | OBSERVED (UI) |
| FN-M03-1.5.7 | Result: redirect to S1 tree with a success flash (INFERRED, UNVERIFIED COPY); unknown topic id → redirect to `/admin/curriculum` with the one-time flash "Topik tidak dijumpai." (OBSERVED) | — | Admin | INFERRED (result) / OBSERVED (unknown id) |

### EP-M03-2 — Subjects

**FT-M03-2.1 — Subject list** (S6 `/admin/subjects`)

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M03-2.1.1 | Shell header "Pengurusan Subjek" / "Urus subjek pembelajaran dalam sistem"; tab title "Pengurusan Subjek - Admin PRESTASIPLUS" | SHA-212–213 | Admin | OBSERVED |
| FN-M03-2.1.2 | Heading "Senarai Subjek", "Jumlah: {n} subjek", button "Tambah" (`fa-plus`) → `/admin/subjects/create` | S6-001–003 | Admin | OBSERVED |
| FN-M03-2.1.3 | Table (all subjects, no pagination/search), headers displayed upper-case: "#", "Ikon", "Nama (BM)" (+ second line `fa-graduation-cap` linked level names, comma-separated; absent when none), "Nama (EN)", "Kod" (grey mono pill), "Warna" (swatch + hex as stored; below 640 px swatch only), "Teras?" ("Teras" emerald `fa-star` / "Elektif" slate), "Soalan" (amber "{n} soalan"; below 640 px the number only), "Aktif?", "Tindakan". Fits at ≥1280, scrolls inside its card below (DV-M03-03); text ≥12 px (DV-M03-06) | S6-004–006, S6-013, S6-020, S6-027, S6-034, S6-041, S6-048, S6-055 | Admin | OBSERVED + DV-M03-03/06 |
| FN-M03-2.1.4 | "Ikon" tile: background = colour at 12.5 % alpha, glyph in the colour; the stored icon value is rendered whatever its format (Lucide name, Font Awesome class, emoji); empty value → empty tile (DV-M03-01; live shows 4 of 31) | — | Admin | DV-M03-01 |
| FN-M03-2.1.5 | "Aktif?" switch (emerald on / slate off): click flips it at once and saves `is_active` (no confirm, no success message); on failure it reverts and alerts "Gagal kemaskini status", on network error "Ralat rangkaian" (DV-M03-07) | S6-007, S6-014, S6-021, S6-028, S6-035, S6-042, S6-049, S6-056 | Admin | OBSERVED + DV-M03-07 |
| FN-M03-2.1.6 | Row edit link (`fa-edit`, tooltip "Edit") → `/admin/subjects/{id}/edit` | S6-008, S6-015, S6-022, S6-029, S6-036, S6-043, S6-050, S6-057 | Admin | OBSERVED |
| FN-M03-2.1.7 | Row delete form `DELETE /admin/subjects/{id}` (`fa-trash`, tooltip "Padam") with native confirm "Adakah anda pasti mahu padam subjek ini?" | S6-009–012, S6-016–019, S6-023–026, S6-030–033, S6-037–040, S6-044–047, S6-051–054, S6-058–061 | Admin | OBSERVED (UI) / INFERRED (result) |
| FN-M03-2.1.8 | Red flash "Subjek tidak dijumpai." after a redirect from an unknown subject id | S6-062 | Admin | OBSERVED |
| FN-M03-2.1.9 | Results: delete → list reloads without the row + success flash (level links removed; chapters of the subject removed); row order = "Susunan Paparan" then id (order = id for every live record, so indistinguishable from id order) | — | Admin | INFERRED (UNVERIFIED COPY) |

**FT-M03-2.2 — Create subject** (S7 `/admin/subjects/create`)

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M03-2.2.1 | Shell header "Tambah Subjek Baru" / "Cipta subjek pembelajaran baharu"; tab title "Tambah Subjek - Admin PRESTASIPLUS" | SHA-217–218 | Admin | OBSERVED |
| FN-M03-2.2.2 | "Kembali ke Senarai" (`fa-arrow-left`) and "Batal" → `/admin/subjects` | S7-001, S7-048 | Admin | OBSERVED |
| FN-M03-2.2.3 | Form `POST /admin/subjects`: "Nama Subjek (Bahasa Melayu) *" (required, "cth: Matematik"), "Nama Subjek (English) *" (required, "e.g: Mathematics") | S7-002–008 | Admin | OBSERVED |
| FN-M03-2.2.4 | "Kod Subjek *" (`code`, required, maxlength 20, CSS upper-case + mono: placeholder displayed "CTH: MATH01", source "cth: MATH01"; typed text displayed upper-case) + hint `fa-info-circle` "Kod akan ditukar ke huruf besar automatik" | S7-009–011 | Admin | OBSERVED |
| FN-M03-2.2.5 | "Ikon (Font Awesome)" (`icon`, default "fas fa-book", placeholder "cth: fas fa-calculator") + hint `fa-lightbulb` "Lihat ikon di" + link "Font Awesome" → https://fontawesome.com/icons (new tab) | S7-012–015 | Admin | OBSERVED |
| FN-M03-2.2.6 | "Warna Tema": colour picker (`color`, default #4f46e5) + read-only text mirroring the value on input | S7-016–018 | Admin | OBSERVED |
| FN-M03-2.2.7 | "Subjek Teras (Core Subject)" checkbox (`is_core`, unchecked) + hint "Tandakan jika subjek ini adalah subjek wajib" | S7-019–021 | Admin | OBSERVED |
| FN-M03-2.2.8 | "Susunan Paparan" (`order`, number min 0, default 0) + hint `fa-sort` "Nombor lebih kecil akan dipaparkan dahulu" | S7-022–024 | Admin | OBSERVED |
| FN-M03-2.2.9 | "Tahap Pendidikan Berkaitan": 11 checkboxes `education_levels[]` "Darjah 1 (Year 1)" … "Tingkatan 5 (Form 5)" in a single-column list inside a bordered box with a maximum height of 16 rem (256 px) that scrolls inside itself (about 5 rows visible) | S7-025–047 | Admin | OBSERVED |
| FN-M03-2.2.10 | Submit "Simpan Subjek" (`fa-save`); no active field (new subjects active) | S7-049 | Admin | OBSERVED (UI) / INFERRED (default) |
| FN-M03-2.2.11 | Result: redirect to `/admin/subjects` with a success flash; code stored upper-case; validation errors keep the input | — | Admin | INFERRED (UNVERIFIED COPY) |

**FT-M03-2.3 — Edit subject** (S8 `/admin/subjects/{id}/edit`)

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M03-2.3.1 | Shell header "Edit Subjek" / "Kemaskini maklumat subjek"; tab title "Edit Subjek - Admin PRESTASIPLUS" | SHA-219–220 | Admin | OBSERVED |
| FN-M03-2.3.2 | "Kembali ke Senarai" and "Batal" → `/admin/subjects` | S8-001, S8-049 | Admin | OBSERVED |
| FN-M03-2.3.3 | Form `PUT /admin/subjects/{id}` with every S7 field pre-filled (incl. linked levels ticked) | S8-002–048 | Admin | OBSERVED |
| FN-M03-2.3.4 | Submit "Kemaskini Subjek" (`fa-save`) | S8-050 | Admin | OBSERVED (UI) |
| FN-M03-2.3.5 | Unknown subject id → redirect to `/admin/subjects` with flash "Subjek tidak dijumpai." | — | Admin | OBSERVED |
| FN-M03-2.3.6 | Result: redirect to `/admin/subjects` with a success flash; level links replaced by the ticked set | — | Admin | INFERRED (UNVERIFIED COPY) |

### EP-M03-3 — Education levels

**FT-M03-3.1 — Level list** (S9 `/admin/education-levels`)

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M03-3.1.1 | Shell header "Pengurusan Tahap Pendidikan" / "Urus tahap pendidikan dalam sistem"; tab title "Pengurusan Tahap Pendidikan - Admin PRESTASIPLUS" | SHA-222–223 | Admin | OBSERVED |
| FN-M03-3.1.2 | Heading "Senarai Tahap Pendidikan", "Jumlah: {n} tahap", button "Tambah Tahap" (`fa-plus`, pink gradient) → `/admin/education-levels/create` | S9-001–003 | Admin | OBSERVED |
| FN-M03-3.1.3 | Table (all levels, by "Susunan Paparan"), headers upper-case: "#", "Nama (BM)", "Nama (EN)", "Kod" (mono pill), "Peringkat" (badge: "Rendah" blue `fa-child`, "Menengah Rendah" purple `fa-book-reader`, "Menengah Atas" indigo `fa-user-graduate`), "Kurikulum", "Soalan" (amber "{n} soalan"), "Subjek" (emerald "{n} subjek"), "Aktif?", "Tindakan" | S9-004–006, S9-013, S9-020, S9-027, S9-034, S9-041, S9-048, S9-055, S9-062, S9-069, S9-076 | Admin | OBSERVED |
| FN-M03-3.1.4 | "Aktif?" switch: click flips and saves at once (`is_active`, toggle-only); on failure reverts + alert "Gagal kemaskini status"; on network error reverts + alert "Ralat rangkaian" | S9-007, S9-014, S9-021, S9-028, S9-035, S9-042, S9-049, S9-056, S9-063, S9-070, S9-077 | Admin | OBSERVED (code) |
| FN-M03-3.1.5 | Row edit link (`fa-edit`, tooltip "Edit") → `/admin/education-levels/{id}/edit` | S9-008, S9-015, S9-022, S9-029, S9-036, S9-043, S9-050, S9-057, S9-064, S9-071, S9-078 | Admin | OBSERVED |
| FN-M03-3.1.6 | Row delete form (`fa-trash`, tooltip "Padam") with native confirm "Adakah anda pasti mahu padam tahap pendidikan ini?" | S9-009–012, S9-016–019, S9-023–026, S9-030–033, S9-037–040, S9-044–047, S9-051–054, S9-058–061, S9-065–068, S9-072–075, S9-079–082 | Admin | OBSERVED (UI) / INFERRED (result) |
| FN-M03-3.1.7 | Red flash "Tahap Pendidikan tidak dijumpai." after a redirect from an unknown level id | S9-083 | Admin | OBSERVED |
| FN-M03-3.1.8 | Results: delete → list reloads without the row + success flash; subject links and chapters of the level removed | — | Admin | INFERRED (UNVERIFIED COPY) |

**FT-M03-3.2 — Create level** (S10 `/admin/education-levels/create`)

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M03-3.2.1 | Shell header "Tambah Tahap Pendidikan" / "Cipta tahap pendidikan baharu"; tab title "Tambah Tahap Pendidikan - Admin PRESTASIPLUS" | SHA-225–226 | Admin | OBSERVED |
| FN-M03-3.2.2 | "Kembali ke Senarai" and "Batal" → `/admin/education-levels` | S10-001, S10-020 | Admin | OBSERVED |
| FN-M03-3.2.3 | Form `POST /admin/education-levels`: "Nama Tahap (Bahasa Melayu) *" (required, "cth: Tahun 1"), "Nama Tahap (English) *" (required, "e.g: Year 1") | S10-002–008 | Admin | OBSERVED |
| FN-M03-3.2.4 | "Kod Tahap *" (required, maxlength 10, CSS upper-case + mono: placeholder displayed "CTH: Y1", source "cth: Y1") + hint `fa-info-circle` "Kod akan ditukar ke huruf besar automatik" | S10-009–011 | Admin | OBSERVED |
| FN-M03-3.2.5 | "Peringkat *" select (required): "-- Pilih Peringkat --", "Rendah (Primary)", "Menengah Rendah (Lower Secondary)", "Menengah Atas (Upper Secondary)" | S10-012–013 | Admin | OBSERVED |
| FN-M03-3.2.6 | "Kurikulum *" (required, "cth: KSSR, KSSM") + hint `fa-book-open` "Nama kurikulum yang diguna pakai" | S10-014–016 | Admin | OBSERVED |
| FN-M03-3.2.7 | "Susunan Paparan" (number min 0, default 0) + hint `fa-sort` "Nombor lebih kecil akan dipaparkan dahulu" | S10-017–019 | Admin | OBSERVED |
| FN-M03-3.2.8 | Submit "Simpan Tahap" (`fa-save`, pink gradient); no active field; S9–S11 use the pink accent (buttons, focus rings) | S10-021 | Admin | OBSERVED |
| FN-M03-3.2.9 | Result: redirect to `/admin/education-levels` with a success flash; code stored upper-case | — | Admin | INFERRED (UNVERIFIED COPY) |

**FT-M03-3.3 — Edit level** (S11 `/admin/education-levels/{id}/edit`)

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M03-3.3.1 | Shell header "Edit Tahap Pendidikan" / "Kemaskini maklumat tahap pendidikan"; tab title "Edit Tahap Pendidikan - Admin PRESTASIPLUS" | SHA-228–229 | Admin | OBSERVED |
| FN-M03-3.3.2 | "Kembali ke Senarai" and "Batal" → `/admin/education-levels` | S11-001, S11-021 | Admin | OBSERVED |
| FN-M03-3.3.3 | Form `PUT /admin/education-levels/{id}` with the S10 fields pre-filled | S11-002–020 | Admin | OBSERVED |
| FN-M03-3.3.4 | Submit "Kemaskini Tahap" (`fa-save`) | S11-022 | Admin | OBSERVED (UI) |
| FN-M03-3.3.5 | Unknown level id → redirect to `/admin/education-levels` with flash "Tahap Pendidikan tidak dijumpai." | — | Admin | OBSERVED |
| FN-M03-3.3.6 | Result: redirect to the list with a success flash | — | Admin | INFERRED (UNVERIFIED COPY) |

### EP-M03-4 — Student topic catalogue (legacy "Topik")

**FT-M03-4.1 — Topic list** (S12 `/topics`)

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M03-4.1.1 | User-portal header "Topik Pembelajaran" / "Terokai semua topik pembelajaran"; tab title "Topik - PRESTASIPLUS" | SHU-136–137 | Student, all portal users | OBSERVED (admin) |
| FN-M03-4.1.2 | Grade chips (active green, else white bordered): "Semua Darjah", "Darjah 1" … "Darjah 6" → `?grade_level=DARJAH_n`; each keeps the current `subject`; no grade chip is active when `grade_level` is not one of the canonical codes (e.g. `darjah_1`) | S12-004–010, S12-037–043, S12-092–098 | Student | OBSERVED |
| FN-M03-4.1.3 | Subject chips (active purple): "Semua Subjek", "MATEMATIK", "BAHASA MELAYU", "BAHASA INGGERIS", "SAINS", "PENDIDIKAN ISLAM", "PENDIDIKAN MORAL", "SEJARAH" → `?subject={CODE}`; each keeps the current `grade_level` (no chip for GEOGRAFI or Tingkatan; those topics are in the default list) | S12-011–018, S12-044–051, S12-059–066, S12-071–078 | Student | OBSERVED |
| FN-M03-4.1.4 | Topic cards (grid 1 / 2 at sm / 3 at lg; whole card links to `/topics/{id}`): gradient header with `fa-book-open` circle, pill "{n} Subtopik", title, subject label; body: description (2-line clamp; omitted when empty), "Subtopik:" (upper-case) + first 3 subtopic names with green `fa-check-circle`, "+{n} lagi..." when more; button "Lihat Topik" (`fa-eye`) | S12-019–036, S12-052–058, S12-068–070, S12-079–091, S12-099–119 | Student | OBSERVED |
| FN-M03-4.1.5 | Empty state: `fa-book-open` "Tiada topik tersedia buat masa ini." (no match, unknown code) | S12-067 | Student | OBSERVED |
| FN-M03-4.1.6 | List rule: all matching topics on one page, order = sequence then id; filters combine with AND and ignore case (`darjah_1` = `DARJAH_1`) | — | Student | OBSERVED |

**FT-M03-4.2 — Topic detail** (S13 `/topics/{id}`)

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M03-4.2.1 | User-portal header = topic name / subject label; tab title "{topic name} - PRESTASIPLUS" | SHU-373–376 | Student | OBSERVED |
| FN-M03-4.2.2 | Back link "Kembali ke Senarai Topik" (`fa-arrow-left`) → `/topics` (filters not kept) | S13-004 | Student | OBSERVED |
| FN-M03-4.2.3 | Hero (purple→pink): h1 topic name, subject label, description (clamped to 3 lines), `fa-book-open` | S13-005–007, S13-054–056 | Student | OBSERVED |
| FN-M03-4.2.4 | 3 stat cards (3 columns at every width): `fa-list` (purple) {n} "Subtopik"; `fa-question-circle` (green) {n} "Dijawab"; `fa-chart-line` (amber) {n}% "Kemajuan" | S13-008–016 | Student | OBSERVED (layout) / INFERRED (values) |
| FN-M03-4.2.5 | Section "Subtopik": card per subtopic (1 col, 2 from sm): numbered gradient circle, name, description when present, badges "Level 1" (green), "Level 2" (yellow), "Level 3" (red) with `fa-circle` (not links), "Kemajuan" + {n}% (purple) + gradient bar | S13-017–025, S13-027–034, S13-036–043, S13-045–052, S13-057–059 | Student | OBSERVED |
| FN-M03-4.2.6 | Button "Mula Berlatih" (`fa-play`) on every subtopic card → `/practice/{admin subject code}` (same target for all subtopics of the topic; DV candidate D-9 rejected) | S13-026, S13-035, S13-044, S13-053, S13-060 | Student | OBSERVED |
| FN-M03-4.2.7 | Unknown topic id → the global 404 page | — | Student | OBSERVED |
| FN-M03-4.2.8 | Per-learner values: "Dijawab" = questions answered in the topic, "Kemajuan" and per-subtopic % from M05 practice data (0 for a learner with no history) | — | Student | INFERRED |

### EP-M03-5 — Learning map (Peta Belajar)

**FT-M03-5.1 — Peta Belajar** (S14 `/peta-belajar`)

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M03-5.1.1 | User-portal header "Peta Belajar" with no subtitle (DV-M03-04; live shows "Dashboard" / "Selamat datang kembali"); tab title "Peta Belajar — PRESTASIPLUS" (em dash) | SHU-377–378 | Student | OBSERVED + DV-M03-04 |
| FN-M03-5.1.2 | Hero (emerald gradient): h1 "🗺️ Peta Belajar", subtitle "Terokai perjalanan {pill label} — takluki setiap pulau! 🏝️" (pill label without emoji, e.g. "Pend. Islam"; unknown code → the code title-cased, e.g. "Zzz") | S14-004–005, S14-033, S14-050, S14-082 | Student | OBSERVED |
| FN-M03-5.1.3 | Hero stat tiles (md and up only): "{done}/{total}" "Topik Selesai" and "{n}%" "Kemajuan"; full-width progress bar (yellow→amber with a static highlight; the live `shimmer` animation has no keyframes and does not move) at every width | S14-006–010 | Student | OBSERVED (layout) / INFERRED (formulas) |
| FN-M03-5.1.4 | Subject pills in the selectors card: "🔢 Matematik", "📝 Bahasa Melayu", "🇬🇧 Bahasa Inggeris", "🔬 Sains", "☪️ Pend. Islam", "🤝 Pend. Moral", "🏛️ Sejarah" → `?subject={CODE}&grade={current}`; active pill filled with the subject's pill colour. The live "🌍 Geografi" pill is not shown (DV-M03-08) | S14-011–019, S14-034–041, S14-051–058 | Student | OBSERVED + DV-M03-08 |
| FN-M03-5.1.5 | Grade chips (active indigo→purple): "Darjah 1" … "Darjah 4" only → `?subject={current}&grade=DARJAH_n` | S14-020–023, S14-042–045, S14-059–062, S14-083–086 | Student | OBSERVED |
| FN-M03-5.1.6 | Unlocked island (amber, `pulse-glow`): topic emoji, "🎯 BUKA", title, blue progress bar + "{n}%", "{s} sesi · {q} soalan dijawab"; card links to `/practice?topic_id={id}` | S14-024–027, S14-046–049, S14-067–070 | Student | OBSERVED |
| FN-M03-5.1.7 | Locked island (slate, 60 % opacity, not-allowed cursor, not a link): 🔒 icon, "🔒 TERKUNCI", title, "Selesaikan topik sebelumnya dulu" | S14-028–032, S14-071–081 | Student | OBSERVED |
| FN-M03-5.1.8 | Mastered (green) and started (blue) island states: same card layout as unlocked, linked to `/practice?topic_id={id}` | — | Student | INFERRED (UNVERIFIED COPY) |
| FN-M03-5.1.9 | State and unlock rules: first two topics always open; topic k opens when topic k−1 is started or mastered; "Topik Selesai" = mastered count; "Kemajuan" = average topic progress | — | Student | OBSERVED (first two open) / INFERRED (rest) |
| FN-M03-5.1.10 | Empty state: "🗺️", "Tiada Topik Dijumpai", "Pilih subjek dan darjah yang lain untuk melihat peta belajar" | S14-063–066 | Student | OBSERVED |
| FN-M03-5.1.11 | Parameters: default subject MATEMATIK and grade DARJAH_4; only DARJAH_1–DARJAH_4 (exact, upper-case) are accepted; any other grade (DARJAH_5, TINGKATAN_*, `darjah_2`, invalid) shows Darjah 4 with the "Darjah 4" chip active; unknown subject → no active pill + empty state | — | Student | OBSERVED (admin) / INFERRED (a student's default) |
| FN-M03-5.1.12 | Map layout: vertical path with a dot per topic, islands alternate right/left (first on the right); ≤768 px islands centred and path/dots hidden; islands fade in on scroll (opacity 0 → 1, translateY 30px → 0, staggered 0.1 s) | — | Student | OBSERVED |

### EP-M03-6 — Navigation, access and shared curriculum data

**FT-M03-6.1 — M03 entries in the admin shell** (admin shell (SHA))

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M03-6.1.1 | Desktop sidebar, section "PENGURUSAN": collapsible group "Kurikulum" (`fa-sitemap`, displayed "KURIKULUM") with "Kurikulum" (`fa-sitemap`) → `/admin/curriculum`, "Subjek" (`fa-book`) → `/admin/subjects`, "Tahap Pendidikan" (`fa-graduation-cap`) → `/admin/education-levels`; the group is open on M03 pages | SHA-024–027 | Admin | OBSERVED |
| FN-M03-6.1.2 | Mobile "Lagi" menu section "Kurikulum" (displayed upper-case) with the same 3 links | SHA-157–160 | Admin | OBSERVED |
| FN-M03-6.1.3 | Active item: "Kurikulum" on S1–S5, "Subjek" on S6–S8, "Tahap Pendidikan" on S9–S11 | — | Admin | OBSERVED |

**FT-M03-6.2 — M03 entries in the user-portal shell** (user shell (SHU))

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M03-6.2.1 | Desktop sidebar links "Topik" (`fa-book-open`) → `/topics` and "Peta Belajar" (`fa-map`) → `/peta-belajar`; "Topik" active on S12/S13, "Peta Belajar" on S14 | SHU-075–076 | Student | OBSERVED |
| FN-M03-6.2.2 | Drawer (below 1024 px) links "Topik" and "Peta Belajar", same targets and active states | SHU-216–217 | Student | OBSERVED |
| FN-M03-6.2.3 | Mobile bottom nav "Topik" (`fa-book-open`) → `/topics`, active on S12/S13 (no Peta Belajar item) | SHU-340 | Student | OBSERVED |

**FT-M03-6.3 — Access and cross-module curriculum data** ((behaviour))

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M03-6.3.1 | Access: S1–S11 require an admin session; S12–S14 require any session; a guest is redirected to `/login` | — | All | INFERRED |
| FN-M03-6.3.2 | Grade mapping shared with M01/M02: grade 1–6 ↔ level D1–D6 ↔ `DARJAH_1`–`DARJAH_6`; grade 7–11 ↔ T1–T5 ↔ `TINGKATAN_1`–`TINGKATAN_5`; stage `primary` ↔ primary school types (SK, SJK(C), SJK(T)) | — | All | OBSERVED (codes) / INFERRED (mapping) |
| FN-M03-6.3.3 | Subject and level lookups (active records) for other modules (M04 question subject/level/topic, M05 practice) | — | All | INFERRED |
| FN-M03-6.3.4 | Practice hand-off to M05: legacy subject → admin code (MATEMATIK→MATH, BAHASA_MELAYU→BM, BAHASA_INGGERIS→BI, SAINS→SCI, PENDIDIKAN_ISLAM→PI, PENDIDIKAN_MORAL→PM, SEJARAH→SEJ, GEOGRAFI→GEO) for `/practice/{CODE}`; legacy topic id for `/practice?topic_id=` | — | Student | OBSERVED |
| FN-M03-6.3.5 | "Soalan" counts on S6/S9 = M04 SRS §4.1 Q-ACTIVE(subject) / Q-ACTIVE(level) (active questions of the M04 dataset); "Subjek" per level = linked subjects | — | Admin | OBSERVED (Subjek) / INFERRED (Soalan) |

**Totals:** 6 epics · 17 features · 138 functions (107 cover inventory elements; 31 are behaviour-only: 1.1.10, 1.1.20, 1.1.21, 1.2.8, 1.3.6, 1.3.7, 1.4.8, 1.4.9, 1.5.7, 2.1.4, 2.1.9, 2.2.11, 2.3.5, 2.3.6, 3.1.8, 3.2.9, 3.3.5, 3.3.6, 4.1.6, 4.2.7, 4.2.8, 5.1.8, 5.1.9, 5.1.11, 5.1.12, 6.1.3, 6.3.1, 6.3.2, 6.3.3, 6.3.4, 6.3.5).

---

## 4. User stories

| ID | Feature | Priority | Story | Functions |
|---|---|---|---|---|
| US-M03-01 | FT-M03-1.1 | Must | As an admin, I want to pick a subject and a level and see that pair's chapters, topics and subtopics with counts, so that I can review the curriculum. | FN-M03-1.1.1, 1.1.2, 1.1.3, 1.1.4, 1.1.7, 1.1.10, 1.1.11, 1.1.15, 1.1.21 |
| US-M03-02 | FT-M03-1.1 | Must | As an admin, I want to start adding chapters and topics from the tree (also when a pair is empty), so that I can build the curriculum where it is missing. | FN-M03-1.1.5, 1.1.6, 1.1.14 |
| US-M03-03 | FT-M03-1.1 | Must | As an admin, I want to delete a chapter, topic or subtopic after confirming, so that wrong entries are removed. | FN-M03-1.1.9, 1.1.13, 1.1.17, 1.1.20 |
| US-M03-04 | FT-M03-1.1 | Must | As an admin, I want to add and edit subtopics inline in the tree, so that I can maintain them without leaving the page. | FN-M03-1.1.15, 1.1.16, 1.1.18, 1.1.20 |
| US-M03-05 | FT-M03-1.1 | Should | As an admin, I want a clear message when a chapter I open does not exist, so that I know why I was sent back. | FN-M03-1.1.19, 1.3.6, 1.4.8 |
| US-M03-06 | FT-M03-1.2 | Must | As an admin, I want to create a chapter for a subject and level, so that the tree grows. | FN-M03-1.2.1–1.2.8 |
| US-M03-07 | FT-M03-1.3 | Must | As an admin, I want to edit a chapter and switch it active or inactive, so that it stays correct and can be hidden from students. | FN-M03-1.1.8, 1.3.1–1.3.7 |
| US-M03-08 | FT-M03-1.4 | Must | As an admin, I want to add a topic to a chapter, with its learning standard, so that the chapter is complete. | FN-M03-1.4.1–1.4.9 |
| US-M03-09 | FT-M03-1.5 | Must | As an admin, I want to edit a topic and switch it active or inactive, so that it stays correct. | FN-M03-1.1.12, 1.5.1–1.5.7 |
| US-M03-10 | FT-M03-2.1 | Must | As an admin, I want to see every subject with its icon, levels, code, colour, core flag and question count, so that I know the subject catalogue. | FN-M03-2.1.1, 2.1.2, 2.1.3, 2.1.4, 2.1.6, 6.3.5 |
| US-M03-11 | FT-M03-2.1 | Must | As an admin, I want to switch a subject active or inactive from the list, so that I can withdraw it quickly. | FN-M03-2.1.5 |
| US-M03-12 | FT-M03-2.1 | Must | As an admin, I want to delete a subject after confirming, so that obsolete subjects go away. | FN-M03-2.1.7, 2.1.9 |
| US-M03-13 | FT-M03-2.2 | Must | As an admin, I want to create a subject with its code, icon, colour, core flag, order and levels, so that it can be used everywhere. | FN-M03-2.2.1–2.2.11 |
| US-M03-14 | FT-M03-2.3 | Must | As an admin, I want to edit a subject, so that its details and levels stay correct. | FN-M03-2.1.8, 2.3.1–2.3.6 |
| US-M03-15 | FT-M03-3.1 | Must | As an admin, I want to see every education level with its stage, curriculum and counts, so that I know the level structure. | FN-M03-3.1.1, 3.1.2, 3.1.3, 3.1.5, 6.3.5 |
| US-M03-16 | FT-M03-3.1 | Must | As an admin, I want to switch a level active or inactive from the list and be told if it fails, so that the status is reliable. | FN-M03-3.1.4 |
| US-M03-17 | FT-M03-3.1 | Should | As an admin, I want to delete a level after confirming, so that obsolete levels go away. | FN-M03-3.1.6, 3.1.8 |
| US-M03-18 | FT-M03-3.2 | Must | As an admin, I want to create a level with its code, stage, curriculum and order, so that new levels can be used. | FN-M03-3.2.1–3.2.9 |
| US-M03-19 | FT-M03-3.3 | Must | As an admin, I want to edit a level, so that its details stay correct. | FN-M03-3.1.7, 3.3.1–3.3.6 |
| US-M03-20 | FT-M03-4.1 | Must | As a student, I want to filter the topic catalogue by grade and subject, so that I find the topics for my class. | FN-M03-4.1.1, 4.1.2, 4.1.3, 4.1.5, 4.1.6 |
| US-M03-21 | FT-M03-4.1 | Must | As a student, I want each topic shown as a card with its subtopics, so that I can see what it covers before opening it. | FN-M03-4.1.4 |
| US-M03-22 | FT-M03-4.2 | Must | As a student, I want to open a topic and see its subtopics, difficulty levels and my progress, so that I know where I stand. | FN-M03-4.2.1, 4.2.2, 4.2.3, 4.2.4, 4.2.5, 4.2.7, 4.2.8 |
| US-M03-23 | FT-M03-4.2 | Must | As a student, I want to start practising from a topic, so that I can drill its subject. | FN-M03-4.2.6, 6.3.4 |
| US-M03-24 | FT-M03-5.1 | Must | As a student, I want a learning map of a subject's topics with my overall progress, so that learning feels like a journey. | FN-M03-5.1.1, 5.1.2, 5.1.3, 5.1.12 |
| US-M03-25 | FT-M03-5.1 | Must | As a student, I want to switch the map's subject and grade (Darjah 1–4), so that I can follow each subject's journey. | FN-M03-5.1.4, 5.1.5, 5.1.10, 5.1.11 |
| US-M03-26 | FT-M03-5.1 | Must | As a student, I want open topics to lead to practice and later topics to unlock as I progress, so that I work through them in order. | FN-M03-5.1.6, 5.1.7, 5.1.8, 5.1.9, 6.3.4 |
| US-M03-27 | FT-M03-6.1 | Must | As an admin, I want to reach the curriculum, subject and level screens from the admin menus, so that I can find them on any device. | FN-M03-6.1.1, 6.1.2, 6.1.3 |
| US-M03-28 | FT-M03-6.2 | Must | As a student, I want "Topik" and "Peta Belajar" in my menus, so that I can reach them on any device. | FN-M03-6.2.1, 6.2.2, 6.2.3 |
| US-M03-29 | FT-M03-6.3 | Must | As the owner, I want the admin curriculum screens closed to non-admins and every M03 page closed to guests, so that the data is protected. | FN-M03-6.3.1 |
| US-M03-30 | FT-M03-6.3 | Must | As another module (and its users), I want one consistent set of levels, grades and subjects, so that questions, practice and profiles use the same curriculum. | FN-M03-6.3.2, 6.3.3, 6.3.4, 6.3.5 |
| US-M03-31 | cross-cutting (all M03 features) | Must | As an admin or student on a phone, tablet or desktop, I want every M03 screen to fit my screen and stay readable, so that I can use it anywhere. | All screen FNs; DV-M03-03, 06 |

### Acceptance criteria

**US-M03-01 — Browse the curriculum tree**
- **AC-M03-01.1** Given I open `/admin/curriculum`, when it loads, then the shell header shows "Pengurusan Kurikulum" / "Urus struktur kurikulum (Bab → Topik → Subtopik)" and the tab title is "Pengurusan Kurikulum - Admin PRESTASIPLUS".
- **AC-M03-01.2** Given the filter card "Tapis Kurikulum" (funnel icon), when it loads, then it shows "Subjek" ("-- Pilih Subjek --" + the 31 subjects by id, labelled with the BM name), "Tahap" ("-- Pilih Tahap --", "Darjah 1" … "Darjah 6", "Tingkatan 1" … "Tingkatan 5") and the button "Tapis" (search icon). Subject options do not depend on the level and vice versa.
- **AC-M03-01.3** Given no subject or no level is chosen (e.g. `?subject_id=3` only), when the page loads, then only the prompt card shows, with an info icon, "Sila pilih subjek dan tahap pendidikan" and "Gunakan penapis di atas"; no summary cards, button or tree.
- **AC-M03-01.4** Given I choose "Matematik" and "Tingkatan 4" and press "Tapis", when the page reloads, then the URL is `?subject_id=3&education_level_id=10`, both selects keep the choice, and 4 cards show: "Subjek" "Matematik", "Tahap" "Tingkatan 4", "Jumlah Bab" "10", "Topik / Subtopik" "24 / 0".
- **AC-M03-01.5** Given the tree, when it renders, then every chapter block is expanded, shows a book icon and "Bab {n}: {name}" (e.g. "Bab 1: Fungsi dan Persamaan Kuadratik") with its description line when it has one (e.g. "Auto-created from textbook coverage audit: T4-BT-MAT---MATEMATIK.pdf"), and its topics are listed collapsed, each with a list icon, "Topik {n}: {name}" and its description line.
- **AC-M03-01.6** Given a chapter's chevron, when I click it, then its topics hide and the chevron points right; clicking again shows them. Given a topic's chevron, when I click it, then its subtopics (or "Tiada subtopik" in italic) show below it and the chevron points down.
- **AC-M03-01.7** Given "Bahasa Melayu" + "Darjah 1", when I open "Topik 1: Mendengar dan Memahami", then I see "Mendengar sebutan dan intonasi" and "Bertutur untuk menyatakan permintaan", each with a chevron-right icon, an edit and a delete button.
- **AC-M03-01.8** Given "Matematik" + "Darjah 1", when the tree renders, then the chapters appear in chapter-number order Bab 1, 2, 3 … 8 (DV-M03-05; live shows 3, 4, 5, 6, 7, 8, 1, 2), and topics inside a chapter appear in topic-number order.
- **AC-M03-01.9** (INFERRED) Given a chapter or topic that is inactive, when the tree renders, then it is still listed like the others, with no marker, and it is counted in the cards.

**US-M03-02 — Start adding from the tree**
- **AC-M03-02.1** Given a pair is selected, when the page loads, then the button "Tambah Bab" (plus icon) links to `/admin/curriculum/chapters/create?subject_id={s}&education_level_id={l}`.
- **AC-M03-02.2** Given a pair with no chapters (e.g. "Bahasa Inggeris" + "Tingkatan 3"), when the page loads, then the cards read "0" and "0 / 0" and the tree card shows an inbox icon, "Tiada bab dijumpai untuk subjek dan tahap ini." and the link "Tambah Bab Pertama" (plus icon) to the same create URL.
- **AC-M03-02.3** Given a level that is not linked to the subject (e.g. "Matematik Tambahan" + "Darjah 1"), when the page loads, then it behaves as AC-02.2 (empty tree, create links for that pair); no warning is shown (as live).
- **AC-M03-02.4** Given a chapter, when its topics are listed, then the link "Tambah Topik" (plus icon) follows them and opens `/admin/curriculum/topics/create?chapter_id={id}`; it shows even when the chapter has no topics.

**US-M03-03 — Delete from the tree**
- **AC-M03-03.1** Given a chapter, topic or subtopic, when I hover its bin button, then the tooltip reads "Padam Bab", "Padam Topik" or "Padam Subtopik".
- **AC-M03-03.2** Given I press a bin button, when the browser confirm appears, then it reads "Adakah anda pasti mahu padam bab ini?", "Adakah anda pasti mahu padam topik ini?" or "Adakah anda pasti mahu padam subtopik ini?"; if I cancel, nothing changes.
- **AC-M03-03.3** (INFERRED) Given I accept, when the delete completes, then the same subject + level tree reloads without the item and with a green success message (UNVERIFIED COPY); deleting a chapter also removes its topics and their subtopics, and deleting a topic removes its subtopics; the cards update.

**US-M03-04 — Subtopics inline**
- **AC-M03-04.1** Given an open topic, when I press "Tambah Subtopik" (plus icon), then an inline purple form opens with "Nama Subtopik (BM)" (required), "Nama Subtopik (EN)", "Objektif Pembelajaran" (textarea) and the submit "Tambah Subtopik" (plus icon), and the toggle becomes "Batal" (minus icon). Pressing "Batal" hides the form without saving; text I typed is still in the fields when I open the form again, until the page reloads (as live).
- **AC-M03-04.2** Given the add form, when I submit with an empty "Nama Subtopik (BM)", then the browser blocks the submit (native required).
- **AC-M03-04.3** (INFERRED) Given I submit a name, when it completes, then the tree reloads with the new subtopic at the end of that topic's list and a success message (UNVERIFIED COPY).
- **AC-M03-04.4** Given a subtopic row, when I press its edit button (tooltip "Edit Subtopik"), then the row is replaced by a purple form pre-filled with the name, English name and learning objective, with "Simpan" (save icon) and "Batal". "Batal" hides the form and shows the row with its stored name, without saving; if I reopen the form before reloading the page, it still shows what I typed (as live). Opening another subtopic's edit form in the same topic closes the first one.
- **AC-M03-04.5** (INFERRED) Given I change the name and press "Simpan", when it completes, then the tree reloads with the new name and a success message (UNVERIFIED COPY).

**US-M03-05 — "Not found" messages**
- **AC-M03-05.1** Given I open `/admin/curriculum/chapters/{unknown id}/edit` or `/admin/curriculum/topics/create?chapter_id={unknown id}`, when the request completes, then I am on `/admin/curriculum` and a red box with a circle-exclamation icon reads "Bab tidak dijumpai.".
- **AC-M03-05.2** Given I open `/admin/curriculum/topics/create` without `chapter_id`, when the request completes, then I am on `/admin/curriculum` and the red box reads "Chapter ID diperlukan." (exact live copy).
- **AC-M03-05.3** Given a flash was shown, when I reload the page, then it is gone (one-time message).
- **AC-M03-05.4** Given I open `/admin/curriculum/topics/{unknown id}/edit`, when the request completes, then I am on `/admin/curriculum` and the red box reads "Topik tidak dijumpai.".

**US-M03-06 — Create a chapter**
- **AC-M03-06.1** Given I open S2 from "Tambah Bab" of Matematik + Tingkatan 4, when it loads, then the header is "Tambah Bab Baru" / "Cipta bab baharu dalam kurikulum", the tab title "Tambah Bab - Admin PRESTASIPLUS", and "Subjek *" and "Tahap Pendidikan *" are pre-selected with Matematik and Tingkatan 4.
- **AC-M03-06.2** Given the form, when it loads, then it shows "Nama Bab (Bahasa Melayu) *" (placeholder "cth: Nombor Bulat"), "Nama Bab (English)" ("e.g: Whole Numbers"), "Nombor Bab" (number, "cth: 1", hint "Contoh: 1, 2, 3 (opsional)" with info icon), "Penerangan" ("Penerangan ringkas tentang bab ini..."), "Batal" and "Simpan Bab" (save icon); there is no "Aktif" checkbox.
- **AC-M03-06.3** Given S2 opened without a query, when it loads, then both selects show their "-- Pilih … --" option and "Kembali ke Kurikulum" and "Batal" go to `/admin/curriculum`; with the query they go to `/admin/curriculum` with the same parameters it received (both: `?subject_id={s}&education_level_id={l}`; only one, e.g. `?subject_id=3`: `/admin/curriculum?subject_id=3`).
- **AC-M03-06.4** Given I leave a required field (subject, level, BM name) empty or enter "Nombor Bab" 0, when I press "Simpan Bab", then the browser blocks the submit.
- **AC-M03-06.5** (INFERRED) Given valid input, when I save, then I land on the S1 tree of the chosen pair, the new chapter is listed in chapter-number order, it is active, and a success message shows (UNVERIFIED COPY).

**US-M03-07 — Edit a chapter**
- **AC-M03-07.1** Given a chapter's edit button (tooltip "Edit Bab"), when I press it, then S3 opens with the header "Edit Bab" / "Kemaskini maklumat bab", tab title "Edit Bab - Admin PRESTASIPLUS", and every field pre-filled (chapter 91: Matematik, Tingkatan 4, "Fungsi dan Persamaan Kuadratik", "Functions and Quadratic Equations", 1, empty description).
- **AC-M03-07.2** Given S3, when it loads, then it also shows the checked "Aktif" checkbox with "Nyahtanda jika bab ini tidak mahu dipaparkan buat masa ini", and the submit "Kemaskini Bab"; "Kembali ke Kurikulum" and "Batal" go to the S1 tree of the chapter's subject + level.
- **AC-M03-07.3** (INFERRED) Given I change the name and untick "Aktif", when I press "Kemaskini Bab", then I land on the S1 tree with the new name and a success message (UNVERIFIED COPY); the chapter stays listed in the admin tree (AC-01.9).
- **AC-M03-07.4** (INFERRED) Given I change the subject or level, when I save, then the chapter (with its topics) moves to the new pair and I land on the new pair's tree.

**US-M03-08 — Create a topic**
- **AC-M03-08.1** Given "Tambah Topik" of chapter 91, when S4 opens, then the header is "Tambah Topik Baru" / "Cipta topik baharu dalam bab", tab title "Tambah Topik - Admin PRESTASIPLUS", and a context card shows a book tile, "Bab", "Bab 1: Fungsi dan Persamaan Kuadratik" and chips "Matematik" (book icon) and "Tingkatan 4" (graduation-cap icon).
- **AC-M03-08.2** Given the form, when it loads, then it shows "Nama Topik (Bahasa Melayu) *" ("cth: Nombor hingga 1000"), "Nama Topik (English)" ("e.g: Numbers up to 1000"), "Nombor Topik" (text, "cth: 1.1", hint "Contoh: 1.1, 1.2, 2.1 (opsional)"), "Penerangan" ("Penerangan ringkas tentang topik ini..."), "Standard Pembelajaran" ("Standard pembelajaran mengikut kurikulum KSSM/KSSR...", hint "Rujuk dokumen standard kurikulum KPM"), "Batal" and "Simpan Topik"; no "Aktif" checkbox.
- **AC-M03-08.3** Given an empty BM name, when I press "Simpan Topik", then the browser blocks the submit.
- **AC-M03-08.4** (INFERRED) Given valid input, when I save, then I land on the S1 tree of the chapter's pair, the topic is listed under the chapter in topic-number order, and a success message shows (UNVERIFIED COPY).

**US-M03-09 — Edit a topic**
- **AC-M03-09.1** Given a topic's edit button (tooltip "Edit Topik"), when I press it, then S5 opens with the header "Edit Topik" / "Kemaskini maklumat topik", tab title "Edit Topik - Admin PRESTASIPLUS", the chapter context card, and the fields pre-filled (topic 126: "Fungsi", "Functions", "1", "Konsep fungsi dan graf", empty learning standard); the chapter cannot be changed.
- **AC-M03-09.2** Given S5, when it loads, then it shows the checked "Aktif" with "Nyahtanda jika topik ini tidak mahu dipaparkan buat masa ini" and the submit "Kemaskini Topik".
- **AC-M03-09.3** (INFERRED) Given I save a change, when it completes, then I land on the S1 tree with the change and a success message (UNVERIFIED COPY).

**US-M03-10 — Subject list**
- **AC-M03-10.1** Given I open `/admin/subjects`, when it loads, then the header is "Pengurusan Subjek" / "Urus subjek pembelajaran dalam sistem", tab title "Pengurusan Subjek - Admin PRESTASIPLUS", with "Senarai Subjek", "Jumlah: 31 subjek" and the button "Tambah" (plus icon) → `/admin/subjects/create`.
- **AC-M03-10.2** Given the table, when it loads, then all 31 subjects are listed (no pagination, search or filter) in "Susunan Paparan" order (ids 1 → 31), under the headers displayed "#", "IKON", "NAMA (BM)", "NAMA (EN)", "KOD", "WARNA", "TERAS?", "SOALAN", "AKTIF?", "TINDAKAN".
- **AC-M03-10.3** Given a row, when it shows, then "Nama (BM)" has the name and a second line with a graduation-cap icon and the linked level names comma-separated (e.g. Matematik Tambahan "Tingkatan 4, Tingkatan 5"; no second line for Sains Rumah Tangga); "Kod" is a grey mono pill; "Warna" a round swatch + the hex as stored (e.g. "#EF4444", "#0f766e"); "Teras?" "Teras" (emerald, star) for ids 1–7, "Elektif" (slate) for the rest; "Soalan" an amber pill "{n} soalan" (e.g. "13872 soalan"). Below 640 px "Warna" shows the swatch only and "Soalan" the number only (e.g. "13872"), as live.
- **AC-M03-10.4** Given the "Ikon" column, when it renders, then every subject whose stored icon has a value shows a visible glyph in its colour on a 12.5 % tint of that colour: e.g. Bahasa Melayu (`book-open`) an open book, Matematik (`calculator`) a calculator, Pendidikan Al-Quran & As-Sunnah (`fas fa-quran`) a book glyph, Sains Rumah Tangga (🍽) the emoji; Pertanian and Sains Sukan (empty value) show an empty tinted tile (DV-M03-01).
- **AC-M03-10.5** Given the row actions, when I hover them, then the edit link (tooltip "Edit") goes to `/admin/subjects/{id}/edit` and the bin button has the tooltip "Padam".

**US-M03-11 — Subject active switch**
- **AC-M03-11.1** Given an active subject, when the row shows, then "Aktif?" is an emerald switch in the on position; an inactive subject shows a slate switch in the off position.
- **AC-M03-11.2** Given I click the switch, when it flips, then it changes position at once with no confirm and no success message, and the new state is saved (after reload the switch keeps the new position).
- **AC-M03-11.3** Given the save fails, when the error response arrives, then the switch returns to its previous position and a browser alert reads "Gagal kemaskini status"; given the network fails, then it reverts and the alert reads "Ralat rangkaian" (DV-M03-07).
- **AC-M03-11.4** (INFERRED) Given a subject is inactive, when another module lists subjects for selection (M04, M05), then it is not offered; the admin screens still list it.

**US-M03-12 — Delete a subject**
- **AC-M03-12.1** Given I press a row's bin button, when the confirm "Adakah anda pasti mahu padam subjek ini?" appears and I cancel, then nothing changes.
- **AC-M03-12.2** (INFERRED) Given I accept, when it completes, then the list reloads without the subject, "Jumlah" decreases by one, and a success message shows (UNVERIFIED COPY); its level links and curriculum tree are removed.

**US-M03-13 — Create a subject**
- **AC-M03-13.1** Given I open S7, when it loads, then the header is "Tambah Subjek Baru" / "Cipta subjek pembelajaran baharu", tab title "Tambah Subjek - Admin PRESTASIPLUS", back link "Kembali ke Senarai" → `/admin/subjects`.
- **AC-M03-13.2** Given the form, when it loads, then it shows "Nama Subjek (Bahasa Melayu) *" ("cth: Matematik"), "Nama Subjek (English) *" ("e.g: Mathematics"), "Kod Subjek *" (placeholder displayed "CTH: MATH01" — source "cth: MATH01" in CSS upper-case, mono; hint "Kod akan ditukar ke huruf besar automatik"), "Ikon (Font Awesome)" (value "fas fa-book", placeholder "cth: fas fa-calculator", hint "Lihat ikon di" + link "Font Awesome" opening https://fontawesome.com/icons in a new tab), "Warna Tema" (picker #4f46e5 + read-only text "#4f46e5"), "Subjek Teras (Core Subject)" (unticked, hint "Tandakan jika subjek ini adalah subjek wajib"), "Susunan Paparan" (0, hint "Nombor lebih kecil akan dipaparkan dahulu"), "Tahap Pendidikan Berkaitan" with 11 unticked boxes "Darjah 1 (Year 1)" … "Tingkatan 5 (Form 5)" in one column inside a bordered box 256 px high that scrolls on its own (about 5 rows visible), "Batal" and "Simpan Subjek".
- **AC-M03-13.3** Given I type "math02" in "Kod Subjek", when it shows, then it is displayed "MATH02"; it accepts at most 20 characters.
- **AC-M03-13.4** Given I pick another colour, when the picker changes, then the read-only text shows the new hex at once.
- **AC-M03-13.5** Given an empty required field or "Susunan Paparan" below 0, when I press "Simpan Subjek", then the browser blocks the submit.
- **AC-M03-13.6** (INFERRED) Given valid input, when I save, then I land on `/admin/subjects` with a success message (UNVERIFIED COPY), the new subject is listed (active, code upper-case, ticked levels on its second line), and "Jumlah" increases by one.

**US-M03-14 — Edit a subject**
- **AC-M03-14.1** Given subject 3's edit link, when S8 opens, then the header is "Edit Subjek" / "Kemaskini maklumat subjek", tab title "Edit Subjek - Admin PRESTASIPLUS", and the form is pre-filled: "Matematik", "Mathematics", "MATH", "calculator", "#EF4444", core ticked, order 3, all 11 levels ticked; the submit reads "Kemaskini Subjek".
- **AC-M03-14.2** Given I open `/admin/subjects/{unknown id}/edit`, when it completes, then I am on `/admin/subjects` with the red box "Subjek tidak dijumpai.".
- **AC-M03-14.3** (INFERRED) Given I untick "Darjah 1" and save, when it completes, then I land on the list with a success message (UNVERIFIED COPY) and Darjah 1 is gone from the subject's level line; S9's "Subjek" count for Darjah 1 decreases by one.

**US-M03-15 — Level list**
- **AC-M03-15.1** Given I open `/admin/education-levels`, when it loads, then the header is "Pengurusan Tahap Pendidikan" / "Urus tahap pendidikan dalam sistem", tab title "Pengurusan Tahap Pendidikan - Admin PRESTASIPLUS", with "Senarai Tahap Pendidikan", "Jumlah: 11 tahap" and "Tambah Tahap" (plus icon, pink gradient; S9–S11 use the pink accent where S6–S8 use indigo).
- **AC-M03-15.2** Given the table, when it loads, then its headers are displayed "#", "NAMA (BM)", "NAMA (EN)", "KOD", "PERINGKAT", "KURIKULUM", "SOALAN", "SUBJEK", "AKTIF?", "TINDAKAN" and it lists the 11 levels in order: e.g. row 1 "Darjah 1", "Year 1", "D1", badge "Rendah" (blue, child icon), "KSSR", "11396 soalan", "16 subjek"; row 7 "Tingkatan 1", "Form 1", "T1", "Menengah Rendah" (purple, reader icon), "KSSM"; row 10 "Tingkatan 4", "Form 4", "T4", "Menengah Atas" (indigo, graduate icon), "25 subjek".
- **AC-M03-15.3** Given the row actions, when I hover them, then the edit link (tooltip "Edit") goes to `/admin/education-levels/{id}/edit` and the bin button has the tooltip "Padam".

**US-M03-16 — Level active switch**
- **AC-M03-16.1** Given I click a level's switch, when it flips, then it changes position at once (no confirm, no message) and the new state is saved.
- **AC-M03-16.2** Given the save fails, when the error response arrives, then the switch reverts and the alert reads "Gagal kemaskini status"; on a network error it reverts and reads "Ralat rangkaian".
- **AC-M03-16.3** (INFERRED) Given a level is inactive, when another module offers levels for selection, then it is not offered.

**US-M03-17 — Delete a level**
- **AC-M03-17.1** Given I press a row's bin button, when the confirm "Adakah anda pasti mahu padam tahap pendidikan ini?" appears and I cancel, then nothing changes.
- **AC-M03-17.2** (INFERRED) Given I accept, when it completes, then the list reloads without the level with a success message (UNVERIFIED COPY); its subject links and curriculum trees are removed.

**US-M03-18 — Create a level**
- **AC-M03-18.1** Given I open S10, when it loads, then the header is "Tambah Tahap Pendidikan" / "Cipta tahap pendidikan baharu", tab title "Tambah Tahap Pendidikan - Admin PRESTASIPLUS", and the form shows "Nama Tahap (Bahasa Melayu) *" ("cth: Tahun 1"), "Nama Tahap (English) *" ("e.g: Year 1"), "Kod Tahap *" (placeholder displayed "CTH: Y1" — source "cth: Y1" in CSS upper-case, mono; typed text displayed upper-case; info-icon hint "Kod akan ditukar ke huruf besar automatik"; max 10 characters), "Peringkat *" ("-- Pilih Peringkat --", "Rendah (Primary)", "Menengah Rendah (Lower Secondary)", "Menengah Atas (Upper Secondary)"), "Kurikulum *" ("cth: KSSR, KSSM", hint "Nama kurikulum yang diguna pakai"), "Susunan Paparan" (0, hint "Nombor lebih kecil akan dipaparkan dahulu"), "Batal" and "Simpan Tahap" (pink gradient, like "Tambah Tahap" on S9 and "Kemaskini Tahap" on S11); no active field.
- **AC-M03-18.2** Given an empty required field, when I press "Simpan Tahap", then the browser blocks the submit.
- **AC-M03-18.3** (INFERRED) Given valid input, when I save, then I land on the list with a success message (UNVERIFIED COPY) and the new level is listed at its "Susunan Paparan" position, active, with "0 soalan" and "0 subjek".

**US-M03-19 — Edit a level**
- **AC-M03-19.1** Given level 10's edit link, when S11 opens, then the header is "Edit Tahap Pendidikan" / "Kemaskini maklumat tahap pendidikan", tab title "Edit Tahap Pendidikan - Admin PRESTASIPLUS", the fields read "Tingkatan 4", "Form 4", "T4", "Menengah Atas (Upper Secondary)", "KSSM", 10, and the submit reads "Kemaskini Tahap"; there is no active field.
- **AC-M03-19.2** Given I open `/admin/education-levels/{unknown id}/edit`, when it completes, then I am on the list with the red box "Tahap Pendidikan tidak dijumpai.".
- **AC-M03-19.3** (INFERRED) Given I save a change, when it completes, then I land on the list with the change and a success message (UNVERIFIED COPY).

**US-M03-20 — Filter the topic catalogue**
- **AC-M03-20.1** Given I open `/topics`, when it loads, then the header is "Topik Pembelajaran" / "Terokai semua topik pembelajaran", the tab title "Topik - PRESTASIPLUS", "Semua Darjah" and "Semua Subjek" are active, and all 125 topics are listed on one page.
- **AC-M03-20.2** Given the grade chips, when they render, then they read "Semua Darjah", "Darjah 1" … "Darjah 6" (as live; no Tingkatan chips); the active chip is green, the others white with a border. Each links to `?grade_level=DARJAH_n` and keeps the current `subject` ("Semua Darjah" drops `grade_level` only).
- **AC-M03-20.3** Given the subject chips, when they render, then they read "Semua Subjek", "MATEMATIK", "BAHASA MELAYU", "BAHASA INGGERIS", "SAINS", "PENDIDIKAN ISLAM", "PENDIDIKAN MORAL", "SEJARAH" (as live; no GEOGRAFI chip); the active chip is purple. Each links to `?subject={CODE}` (spaces as "_") and keeps the current `grade_level`.
- **AC-M03-20.4** Given `?grade_level=DARJAH_1&subject=SAINS`, when the list loads, then both chips are active and only the 4 Darjah 1 Sains topics show ("Haiwan", "Hidupan", "Tumbuhan", "Fizikal dan Bahan").
- **AC-M03-20.5** Given a filter with no topics (e.g. `?grade_level=TINGKATAN_2` typed in the URL, or `?subject=ZZZ`), when the list loads, then it shows a book icon and "Tiada topik tersedia buat masa ini.".
- **AC-M03-20.6** Given the default list (no filter), when it loads, then it also contains the Tingkatan 1/4/5 and GEOGRAFI topics (e.g. "Kemahiran Geografi", "Geografi Tingkatan 4", "Kemahiran Bahasa Tingkatan 4"); typing `?grade_level=TINGKATAN_4` or `?subject=GEOGRAFI` in the URL filters to them with no chip of that value shown.
- **AC-M03-20.7** Given `?grade_level=darjah_1` (lower case), when the list loads, then the 17 Darjah 1 topics show (matching ignores case) and no grade chip is active, not even "Semua Darjah".

**US-M03-21 — Topic cards**
- **AC-M03-21.1** Given a topic card, when it renders, then its purple→pink header shows a white book icon circle, the pill "{n} Subtopik", the title and the subject label (e.g. "Nombor", "MATEMATIK"); the body shows the description (at most 2 lines; no line when the topic has none), "SUBTOPIK:" and up to 3 subtopic names each with a green tick, and "+{n} lagi..." when there are more (e.g. "Nombor Bulat Hingga 100": 3 names + "+1 lagi..."), and the button "Lihat Topik" (eye icon).
- **AC-M03-21.2** Given I click anywhere on a card, when it navigates, then `/topics/{id}` opens.
- **AC-M03-21.3** Given the grid, when it renders, then it has 1 column below 640 px, 2 from 640 px, 3 from 1024 px.

**US-M03-22 — Topic detail**
- **AC-M03-22.1** Given I open `/topics/7`, when it loads, then the header reads "Nombor Bulat Hingga 100" / "MATEMATIK", the tab title "Nombor Bulat Hingga 100 - PRESTASIPLUS", and the back link "Kembali ke Senarai Topik" goes to `/topics` (without the previous filters).
- **AC-M03-22.2** Given the hero, when it renders, then it shows the topic name, "MATEMATIK", "Mengenal, membilang dan menulis nombor 1 hingga 100" (clamped to 3 lines) and a book icon.
- **AC-M03-22.3** Given the stat cards, when they render, then they are 3 across at every width: purple list icon "4" "Subtopik", green question icon "{answered}" "Dijawab", amber chart icon "{n}%" "Kemajuan" (a learner with no history: "0" and "0%").
- **AC-M03-22.4** Given the "Subtopik" section, when it renders, then there is one card per subtopic in order, numbered 1, 2, …: "Membilang 1-20", "Membilang 21-50", "Membilang 51-100", "Menulis Nombor dalam Perkataan"; each shows the badges "Level 1" (green), "Level 2" (yellow), "Level 3" (red) with a dot icon (not clickable), "Kemajuan" and a purple "{n}%" with a bar of that width, and a subtopic description when it has one (topic 68: "Kemahiran Bahasa Melayu SPM Tingkatan 5 berdasarkan DSKP KSSM"; topic 4: "Mengenal haiwan peliharaan seperti kucing, anjing").
- **AC-M03-22.5** Given `/topics/99999`, when it loads, then the global 404 page shows.
- **AC-M03-22.6** (INFERRED) Given a learner with practice history in the topic, when S13 loads, then "Dijawab", "Kemajuan" and each subtopic's % show that learner's values, derived on each load from the M05 answer log (SRS BR-19), so practising the topic changes them.

**US-M03-23 — Start practice from a topic**
- **AC-M03-23.1** Given `/topics/7` (MATEMATIK), when I press "Mula Berlatih" (play icon) on any subtopic, then `/practice/MATH` opens; on `/topics/68` (BAHASA MELAYU) it opens `/practice/BM`.
- **AC-M03-23.2** Given a topic of another legacy subject, when I press "Mula Berlatih", then it opens `/practice/{code}`: BAHASA_INGGERIS → BI (topic 12), SAINS → SCI (4), PENDIDIKAN_ISLAM → PI (15), PENDIDIKAN_MORAL → PM (17), SEJARAH → SEJ (18), GEOGRAFI → GEO (69) (OBSERVED).

**US-M03-24 — Learning map view**
- **AC-M03-24.1** Given I open `/peta-belajar`, when it loads, then the shell header reads "Peta Belajar" with no subtitle (DV-M03-04) and the tab title "Peta Belajar — PRESTASIPLUS".
- **AC-M03-24.2** Given the hero (emerald gradient), when it renders, then it shows "🗺️ Peta Belajar", "Terokai perjalanan Matematik — takluki setiap pulau! 🏝️" and a yellow→amber progress bar whose width is the "Kemajuan" %, with a static highlight (no moving shimmer, as live); at 768 px and wider it also shows the tiles "{done}/{total}" "Topik Selesai" and "{n}%" "Kemajuan" (hidden below 768 px).
- **AC-M03-24.3** Given a map with topics, when it renders at ≥769 px, then a vertical green path runs down the middle with a dot per topic and the islands alternate right and left (first on the right); at ≤768 px the islands are centred and the path and dots are hidden.
- **AC-M03-24.4** Given the islands, when I scroll, then each fades in and slides up as it enters the viewport, staggered.

**US-M03-25 — Choose subject and grade**
- **AC-M03-25.1** Given the selectors card, when it renders, then it shows the pills "🔢 Matematik", "📝 Bahasa Melayu", "🇬🇧 Bahasa Inggeris", "🔬 Sains", "☪️ Pend. Islam", "🤝 Pend. Moral", "🏛️ Sejarah" and no "🌍 Geografi" pill (DV-M03-08). The active pill is filled with the subject's colour with white text (Matematik #3B82F6, Bahasa Melayu #10B981, Bahasa Inggeris #8B5CF6, Sains #F59E0B, Pend. Islam #14B8A6, Pend. Moral #F97316, Sejarah #EF4444), the others slate. Each links to `?subject={CODE}&grade={current grade}`; the hero subtitle uses the pill label (e.g. "Terokai perjalanan Pend. Islam — takluki setiap pulau! 🏝️").
- **AC-M03-25.2** Given the grade chips, when they render, then they read "Darjah 1" … "Darjah 4" only (as live); the active chip has the indigo→purple gradient. Each links to `?subject={current}&grade={CODE}`.
- **AC-M03-25.3** Given `?grade=DARJAH_5`, `TINGKATAN_1`, `darjah_2` or any other value outside DARJAH_1–DARJAH_4, when the map loads, then the "Darjah 4" chip is active and the Darjah 4 topics show (e.g. Sains: "Penyiasatan Saintifik"), as live.
- **AC-M03-25.4** Given no parameters, when the map opens, then Matematik + Darjah 4 are active (OBSERVED for the admin; the same default is used for every user — URS OQ-5).
- **AC-M03-25.5** Given a subject + grade with no topics or an unknown subject (`?subject=ZZZ`, or `?subject=GEOGRAFI` typed in the URL), when the map loads, then it shows "🗺️", "Tiada Topik Dijumpai", "Pilih subjek dan darjah yang lain untuk melihat peta belajar", "0/0" and "0%"; no pill is active and the subtitle reads "Terokai perjalanan Zzz — takluki setiap pulau! 🏝️" (for GEOGRAFI: "… Geografi …").
- **AC-M03-25.6** Given any subject at Darjah 1–4, when the pills render, then none of them leads to a subject that has no topics at those grades (the Geografi pill, which always led to the empty state, is not offered — DV-M03-08).

**US-M03-26 — Islands, unlocking and practice**
- **AC-M03-26.1** Given a learner with no practice history and Matematik + Darjah 1, when the map loads, then the first two islands ("Nombor" 🔢, "Nombor Bulat Hingga 100" 🔢) are open: amber card with a glow, "🎯 BUKA", title, a blue bar "0%" and "0 sesi · 0 soalan dijawab"; the others ("Bentuk", "Operasi Tambah dan Tolak", "Bentuk dan Ruang") are locked: grey, faded, 🔒 icon, "🔒 TERKUNCI", title, "Selesaikan topik sebelumnya dulu"; "Topik Selesai" reads "0/5".
- **AC-M03-26.2** Given an open island, when I click it, then `/practice?topic_id={id}` opens (e.g. "Nombor" → `/practice?topic_id=1`); a locked island is not a link and shows a not-allowed cursor.
- **AC-M03-26.3** (INFERRED) Given the learner has started topic k (≥1 session), when the map loads, then island k shows the "started" (blue) state and island k+1 is open.
- **AC-M03-26.4** (INFERRED) Given the learner has mastered a topic, when the map loads, then its island shows the "mastered" (green) state and "Topik Selesai" counts it; "Kemajuan" is the average of the topic progress values.

**US-M03-27 — Admin menus**
- **AC-M03-27.1** Given the admin shell at ≥1024 px, when I am on any M03 admin page, then the sidebar section "PENGURUSAN" shows the group "KURIKULUM" (sitemap icon; source text "Kurikulum") open, with "Kurikulum" (→ `/admin/curriculum`), "Subjek" (→ `/admin/subjects`), "Tahap Pendidikan" (→ `/admin/education-levels`); the group toggles closed/open on click.
- **AC-M03-27.2** Given S1–S5, S6–S8 and S9–S11, when they load, then "Kurikulum", "Subjek" and "Tahap Pendidikan" respectively show the active style.
- **AC-M03-27.3** Given the admin shell below 1024 px, when I open the "Lagi" menu, then its "KURIKULUM" section lists the same 3 links.

**US-M03-28 — User-portal menus**
- **AC-M03-28.1** Given the user shell at ≥1024 px, when it renders, then the sidebar has "Topik" (book icon) → `/topics` and "Peta Belajar" (map icon) → `/peta-belajar`; "Topik" is active on S12/S13 and "Peta Belajar" on S14.
- **AC-M03-28.2** Given below 1024 px, when I open the drawer, then it has the same two links and active states; the bottom nav has "Topik" (active on S12/S13) and no "Peta Belajar" item.

**US-M03-29 — Access**
- **AC-M03-29.1** (INFERRED) Given I am a guest, when I open any M03 route, then I am redirected to `/login`.
- **AC-M03-29.2** (INFERRED) Given I am logged in without the admin role, when I open S1–S11, then I cannot see them and land on my own landing page (as M02 OQ-5); S12–S14 open for any logged-in user.

**US-M03-30 — One curriculum for all modules**
- **AC-M03-30.1** Given a learner with `grade` n (M01/M02), when M03 needs the learner's level, then grade 1–6 maps to level D1–D6 / `DARJAH_n` and grade 7–11 to T1–T5 / `TINGKATAN_{n−6}`.
- **AC-M03-30.2** (INFERRED) Given another module asks for subjects or levels to choose from, when the list returns, then it holds only active records, in "Susunan Paparan" order, with the same ids, codes and names as S6/S9.
- **AC-M03-30.3** (INFERRED) Given M04 questions reference a subject and a level, when S6/S9 load, then "Soalan" shows the number of questions per subject / per level, computed by the M04 named queries Q-ACTIVE(subject) / Q-ACTIVE(level) (M04 SRS §4.1) on the M04 question dataset (D11), with no separate M03 count; S9 "Subjek" equals the number of subjects linked to the level.

**US-M03-31 — Every device**
- **AC-M03-31.1** Given any M03 screen at 375, 768 or 1280 px, when it renders, then there is no horizontal page scroll and the layout matches SRS §10; no text in M03 content inside `main` (the global shell — header subtitle and pills, bottom nav, footer — is owned by M23 and out of M03 scope) is smaller than 12 px (DV-M03-06b; live uses 8–11 px text below 640 px on S1, S6, S12, S13, S14); decorative icons (ticks, dots, chevrons) keep their live size.
- **AC-M03-31.2** Given S6 at 1280 px, when the table renders, then every column including "TINDAKAN" is visible without scrolling (DV-M03-03); below 1280 px the S6 and S9 tables scroll horizontally inside their card, never the page, with every column reachable.
- **AC-M03-31.3** Given S1 at 375 px, when the tree renders, then chapter, topic and subtopic names are shown in full (wrapping, no "…") (DV-M03-06).
- **AC-M03-31.4** Given the forms (S2–S5, S7, S8, S10, S11) at any width, when they render, then "Batal" and the submit button sit side by side, right-aligned, below a top border (as live; they fit at 375 px); the field layout is as live (SRS §10).

**Count:** 31 user stories · 121 acceptance criteria.

---

## 5. UI expectations

Behaviour and content match the live site, including its look (design tokens in `00-global-ui.md` §6; icons mapped Font Awesome → Lucide, SRS NFR-M03-06). Visual reference: `docs/discovery/img/M03/`.

| Screen | Key content and states | Screenshots |
|---|---|---|
| S1 | Filter card; prompt card (no pair); summary cards; "Tambah Bab"; tree with chapter blocks (open) and topic rows (closed); subtopic rows; inline add/edit subtopic forms; empty tree; red flash. | `curriculum-default-desktop/mobile.png`, `curriculum-tree-desktop/tablet/mobile.png` (mobile truncation = DV-M03-06), `curriculum-subtopics-desktop.png`, `curriculum-no-chapters.png`, `curriculum-flash-error.png` |
| S2–S5 | Single form card with back link; chapter context card on S4/S5; "Aktif" on S3/S5 only. | `chapter-create-desktop/mobile.png`, `chapter-edit-desktop.png`, `topic-create-desktop.png`, `topic-edit-desktop/mobile.png` |
| S6 | Header row; 31-row table with icon tiles (DV-M03-01), level lines, pills, switches, actions; red flash. | `subjects-desktop/tablet/mobile.png` (icons and 1280 overflow = DV-M03-01/03), `subjects-flash-error.png` |
| S7–S8 | Subject form with colour picker and 11 level checkboxes. | `subject-create-desktop.png`, `subject-edit-desktop/mobile.png` |
| S9–S11 | Level table with stage badges and switches; level form. | `levels-desktop/mobile.png`, `level-create-desktop.png`, `level-edit-desktop.png` |
| S12 | Grade chips (Darjah 1–6) and subject chips (7 codes) as live, topic cards grid, empty state. | `topics-desktop/tablet/mobile.png`, `topics-filter-d1-sains.png`, `topics-empty.png` |
| S13 | Back link, hero, 3 stat cards, subtopic cards with badges, progress and "Mula Berlatih". | `topic-show-desktop/mobile.png` |
| S14 | Hero with tiles and bar; selectors card (7 pills, Darjah 1–4; Geografi pill removed by DV-M03-08); map with open/locked islands; empty state; header (DV-M03-04). | `peta-belajar-desktop/tablet/mobile.png`, `peta-belajar-math-d1.png`, `peta-belajar-empty.png` |

---

## 6. Coverage matrix (completeness proof)

Source: `docs/discovery/inventory/M03/` (generated 2026-09-25). Generated by script (`gen.js` in the author's scratchpad, reproducible from `fns.txt` + the inventory JSON): every M03 content element (S1–S14) is listed with the Function that covers it, or a concrete exclusion reason. Each element maps to exactly one Function. Data rows were inventoried with `repeat` limits (S1: 2 chapters / 3 topic blocks / 3 subtopic rows; S6: 8 of 31 rows; S12: sample cards) — every row of the same kind is covered by the same Function. Shell elements are layout chrome owned by the global shell / M23; only the M03-relevant ones are mapped individually, the rest are listed by ID range with their owner. "Content" quotes the DOM text as captured (source casing).

**Summary**

| Set | Elements | Mapped to an M03 Function | Excluded (with reason) | Unmapped |
|---|---|---|---|---|
| M03 content (S1–S14) | 807 | 798 | 9 (tournament banner, M16) | 0 |
| Admin shell SHA | 229 | 30 | 199 (global shell / M23) | 0 |
| User-portal shell SHU | 378 | 13 | 365 (global shell / other modules) | 0 |

**807/807 M03 content elements covered (798 mapped to a Function, 9 excluded with a concrete reason), 0 unmapped.** Including the shells: 1414/1414 elements accounted for (841 mapped, 573 excluded with reason). 107 of the 138 Functions in §3 appear in this matrix; the other 31 are behaviour-only Functions with no element by nature.

### 6.1 M03 content elements

#### S1 — `/admin/curriculum` (160 elements)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M03-S1-001 | card | visible-default | "Tapis Kurikulum" | FN-M03-1.1.2 |
| EL-M03-S1-002 | heading | visible-default | "Tapis Kurikulum" | FN-M03-1.1.2 |
| EL-M03-S1-003 | form | visible-default | GET /admin/curriculum | FN-M03-1.1.2 |
| EL-M03-S1-004 | label | visible-default | "Subjek" | FN-M03-1.1.2 |
| EL-M03-S1-005 | select | visible-default | `subject_id`, 32 options (first "-- Pilih Subjek --") | FN-M03-1.1.2 |
| EL-M03-S1-006 | label | visible-default | "Tahap" | FN-M03-1.1.2 |
| EL-M03-S1-007 | select | visible-default | `education_level_id`, 12 options (first "-- Pilih Tahap --") | FN-M03-1.1.2 |
| EL-M03-S1-008 | button | visible-default | "Tapis", fa-search | FN-M03-1.1.2 |
| EL-M03-S1-009 | text | visible-default | "Sila pilih subjek dan tahap pendidikan" | FN-M03-1.1.3 |
| EL-M03-S1-010 | text | visible-default | "Gunakan penapis di atas" | FN-M03-1.1.3 |
| EL-M03-S1-011 | card | conditional | "Bahasa Melayu" | FN-M03-1.1.4 |
| EL-M03-S1-012 | text | conditional | "Subjek" | FN-M03-1.1.4 |
| EL-M03-S1-013 | text | conditional | "Bahasa Melayu" | FN-M03-1.1.4 |
| EL-M03-S1-014 | card | conditional | "Darjah 1" | FN-M03-1.1.4 |
| EL-M03-S1-015 | text | conditional | "Tahap" | FN-M03-1.1.4 |
| EL-M03-S1-016 | text | conditional | "Darjah 1" | FN-M03-1.1.4 |
| EL-M03-S1-017 | card | conditional | "3" | FN-M03-1.1.4 |
| EL-M03-S1-018 | text | conditional | "Jumlah Bab" | FN-M03-1.1.4 |
| EL-M03-S1-019 | text | conditional | "3" | FN-M03-1.1.4 |
| EL-M03-S1-020 | card | conditional | "3 / 7" | FN-M03-1.1.4 |
| EL-M03-S1-021 | text | conditional | "Topik / Subtopik" | FN-M03-1.1.4 |
| EL-M03-S1-022 | text | conditional | "3 / 7" | FN-M03-1.1.4 |
| EL-M03-S1-023 | link | conditional | "Tambah Bab", → /admin/curriculum/chapters/create?subject_id=1&education_level_id=1, fa-plus | FN-M03-1.1.5 |
| EL-M03-S1-024 | card | conditional | "Bab 1: Kemahiran Mendengar dan Bertutur" | FN-M03-1.1.7 |
| EL-M03-S1-025 | dropdown-trigger | conditional | fa-chevron-down | FN-M03-1.1.7 |
| EL-M03-S1-026 | heading | conditional | "Bab 1: Kemahiran Mendengar dan Bertutur" | FN-M03-1.1.7 |
| EL-M03-S1-027 | link | conditional | → /admin/curriculum/chapters/35/edit, fa-edit, title "Edit Bab" | FN-M03-1.1.8 |
| EL-M03-S1-028 | form | conditional | POST /admin/curriculum/chapters/35 | FN-M03-1.1.9 |
| EL-M03-S1-029 | hidden-field | hidden-only | `_token` | FN-M03-1.1.9 |
| EL-M03-S1-030 | hidden-field | hidden-only | `_method` | FN-M03-1.1.9 |
| EL-M03-S1-031 | button | conditional | fa-trash, title "Padam Bab" | FN-M03-1.1.9 |
| EL-M03-S1-032 | toggle | conditional | fa-chevron-down | FN-M03-1.1.11 |
| EL-M03-S1-033 | heading | conditional | "Topik 1: Mendengar dan Memahami" | FN-M03-1.1.11 |
| EL-M03-S1-034 | text | conditional | "Kemahiran mendengar asas" | FN-M03-1.1.11 |
| EL-M03-S1-035 | link | conditional | → /admin/curriculum/topics/59/edit, fa-edit, title "Edit Topik" | FN-M03-1.1.12 |
| EL-M03-S1-036 | form | conditional | POST /admin/curriculum/topics/59 | FN-M03-1.1.13 |
| EL-M03-S1-037 | hidden-field | hidden-only | `_token` | FN-M03-1.1.13 |
| EL-M03-S1-038 | hidden-field | hidden-only | `_method` | FN-M03-1.1.13 |
| EL-M03-S1-039 | button | conditional | fa-trash, title "Padam Topik" | FN-M03-1.1.13 |
| EL-M03-S1-040 | text | conditional | "Mendengar sebutan dan intonasi" | FN-M03-1.1.15 |
| EL-M03-S1-041 | button | conditional | fa-edit, title "Edit Subtopik" | FN-M03-1.1.16 |
| EL-M03-S1-042 | form | conditional | POST /admin/curriculum/subtopics/132 | FN-M03-1.1.17 |
| EL-M03-S1-043 | hidden-field | hidden-only | `_token` | FN-M03-1.1.17 |
| EL-M03-S1-044 | hidden-field | hidden-only | `_method` | FN-M03-1.1.17 |
| EL-M03-S1-045 | button | conditional | fa-trash, title "Padam Subtopik" | FN-M03-1.1.17 |
| EL-M03-S1-046 | form | conditional (state captured @1280 only) | POST /admin/curriculum/subtopics/132 | FN-M03-1.1.16 |
| EL-M03-S1-047 | hidden-field | hidden-only | `_token` | FN-M03-1.1.16 |
| EL-M03-S1-048 | hidden-field | hidden-only | `_method` | FN-M03-1.1.16 |
| EL-M03-S1-049 | input | conditional (state captured @1280 only) | `name`, ph "Nama Subtopik (BM)", required | FN-M03-1.1.16 |
| EL-M03-S1-050 | input | conditional (state captured @1280 only) | `name_en`, ph "Nama Subtopik (EN)" | FN-M03-1.1.16 |
| EL-M03-S1-051 | textarea | conditional (state captured @1280 only) | `learning_objective`, ph "Objektif Pembelajaran" | FN-M03-1.1.16 |
| EL-M03-S1-052 | button | conditional (state captured @1280 only) | "Simpan", fa-save | FN-M03-1.1.16 |
| EL-M03-S1-053 | button | conditional (state captured @1280 only) | "Batal" | FN-M03-1.1.16 |
| EL-M03-S1-054 | text | conditional | "Bertutur untuk menyatakan permintaan" | FN-M03-1.1.15 |
| EL-M03-S1-055 | button | conditional | fa-edit, title "Edit Subtopik" | FN-M03-1.1.16 |
| EL-M03-S1-056 | form | conditional | POST /admin/curriculum/subtopics/133 | FN-M03-1.1.17 |
| EL-M03-S1-057 | hidden-field | hidden-only | `_token` | FN-M03-1.1.17 |
| EL-M03-S1-058 | hidden-field | hidden-only | `_method` | FN-M03-1.1.17 |
| EL-M03-S1-059 | button | conditional | fa-trash, title "Padam Subtopik" | FN-M03-1.1.17 |
| EL-M03-S1-060 | form | hidden-only | POST /admin/curriculum/subtopics/133 | FN-M03-1.1.16 |
| EL-M03-S1-061 | hidden-field | hidden-only | `_token` | FN-M03-1.1.16 |
| EL-M03-S1-062 | hidden-field | hidden-only | `_method` | FN-M03-1.1.16 |
| EL-M03-S1-063 | input | hidden-only | `name`, ph "Nama Subtopik (BM)", required | FN-M03-1.1.16 |
| EL-M03-S1-064 | input | hidden-only | `name_en`, ph "Nama Subtopik (EN)" | FN-M03-1.1.16 |
| EL-M03-S1-065 | textarea | hidden-only | `learning_objective`, ph "Objektif Pembelajaran" | FN-M03-1.1.16 |
| EL-M03-S1-066 | button | hidden-only | "Simpan", fa-save | FN-M03-1.1.16 |
| EL-M03-S1-067 | button | hidden-only | "Batal" | FN-M03-1.1.16 |
| EL-M03-S1-068 | toggle | conditional | "Tambah Subtopik", fa-plus | FN-M03-1.1.18 |
| EL-M03-S1-069 | form | conditional (state captured @1280 only) | POST /admin/curriculum/subtopics | FN-M03-1.1.18 |
| EL-M03-S1-070 | hidden-field | hidden-only | `_token` | FN-M03-1.1.18 |
| EL-M03-S1-071 | hidden-field | hidden-only | `curriculum_topic_id` | FN-M03-1.1.18 |
| EL-M03-S1-072 | input | hidden-only | `name`, ph "Nama Subtopik (BM)", required | FN-M03-1.1.18 |
| EL-M03-S1-073 | input | hidden-only | `name_en`, ph "Nama Subtopik (EN)" | FN-M03-1.1.18 |
| EL-M03-S1-074 | textarea | hidden-only | `learning_objective`, ph "Objektif Pembelajaran" | FN-M03-1.1.18 |
| EL-M03-S1-075 | button | conditional (state captured @1280 only) | "Tambah Subtopik", fa-plus | FN-M03-1.1.18 |
| EL-M03-S1-076 | link | conditional | "Tambah Topik", → /admin/curriculum/topics/create?chapter_id=35, fa-plus | FN-M03-1.1.14 |
| EL-M03-S1-077 | dropdown-trigger | conditional | fa-chevron-down | FN-M03-1.1.7 |
| EL-M03-S1-078 | heading | conditional | "Bab 2: Kemahiran Membaca" | FN-M03-1.1.7 |
| EL-M03-S1-079 | link | conditional | → /admin/curriculum/chapters/36/edit, fa-edit, title "Edit Bab" | FN-M03-1.1.8 |
| EL-M03-S1-080 | form | conditional | POST /admin/curriculum/chapters/36 | FN-M03-1.1.9 |
| EL-M03-S1-081 | hidden-field | hidden-only | `_token` | FN-M03-1.1.9 |
| EL-M03-S1-082 | hidden-field | hidden-only | `_method` | FN-M03-1.1.9 |
| EL-M03-S1-083 | button | conditional | fa-trash, title "Padam Bab" | FN-M03-1.1.9 |
| EL-M03-S1-084 | toggle | conditional | fa-chevron-right | FN-M03-1.1.11 |
| EL-M03-S1-085 | heading | conditional | "Topik 1: Membaca Perkataan" | FN-M03-1.1.11 |
| EL-M03-S1-086 | text | conditional | "Asas bacaan" | FN-M03-1.1.11 |
| EL-M03-S1-087 | link | conditional | → /admin/curriculum/topics/60/edit, fa-edit, title "Edit Topik" | FN-M03-1.1.12 |
| EL-M03-S1-088 | form | conditional | POST /admin/curriculum/topics/60 | FN-M03-1.1.13 |
| EL-M03-S1-089 | hidden-field | hidden-only | `_token` | FN-M03-1.1.13 |
| EL-M03-S1-090 | hidden-field | hidden-only | `_method` | FN-M03-1.1.13 |
| EL-M03-S1-091 | button | conditional | fa-trash, title "Padam Topik" | FN-M03-1.1.13 |
| EL-M03-S1-092 | text | hidden-only | "Mengenal huruf dan suku kata" | FN-M03-1.1.15 |
| EL-M03-S1-093 | button | hidden-only | fa-edit, title "Edit Subtopik" | FN-M03-1.1.16 |
| EL-M03-S1-094 | form | hidden-only | POST /admin/curriculum/subtopics/134 | FN-M03-1.1.17 |
| EL-M03-S1-095 | hidden-field | hidden-only | `_token` | FN-M03-1.1.17 |
| EL-M03-S1-096 | hidden-field | hidden-only | `_method` | FN-M03-1.1.17 |
| EL-M03-S1-097 | button | hidden-only | fa-trash, title "Padam Subtopik" | FN-M03-1.1.17 |
| EL-M03-S1-098 | form | hidden-only | POST /admin/curriculum/subtopics/134 | FN-M03-1.1.16 |
| EL-M03-S1-099 | hidden-field | hidden-only | `_token` | FN-M03-1.1.16 |
| EL-M03-S1-100 | hidden-field | hidden-only | `_method` | FN-M03-1.1.16 |
| EL-M03-S1-101 | input | hidden-only | `name`, ph "Nama Subtopik (BM)", required | FN-M03-1.1.16 |
| EL-M03-S1-102 | input | hidden-only | `name_en`, ph "Nama Subtopik (EN)" | FN-M03-1.1.16 |
| EL-M03-S1-103 | textarea | hidden-only | `learning_objective`, ph "Objektif Pembelajaran" | FN-M03-1.1.16 |
| EL-M03-S1-104 | button | hidden-only | "Simpan", fa-save | FN-M03-1.1.16 |
| EL-M03-S1-105 | button | hidden-only | "Batal" | FN-M03-1.1.16 |
| EL-M03-S1-106 | toggle | hidden-only | "Tambah Subtopik", fa-plus | FN-M03-1.1.18 |
| EL-M03-S1-107 | form | hidden-only | POST /admin/curriculum/subtopics | FN-M03-1.1.18 |
| EL-M03-S1-108 | hidden-field | hidden-only | `_token` | FN-M03-1.1.18 |
| EL-M03-S1-109 | hidden-field | hidden-only | `curriculum_topic_id` | FN-M03-1.1.18 |
| EL-M03-S1-110 | input | hidden-only | `name`, ph "Nama Subtopik (BM)", required | FN-M03-1.1.18 |
| EL-M03-S1-111 | input | hidden-only | `name_en`, ph "Nama Subtopik (EN)" | FN-M03-1.1.18 |
| EL-M03-S1-112 | textarea | hidden-only | `learning_objective`, ph "Objektif Pembelajaran" | FN-M03-1.1.18 |
| EL-M03-S1-113 | button | hidden-only | "Tambah Subtopik", fa-plus | FN-M03-1.1.18 |
| EL-M03-S1-114 | link | conditional | "Tambah Topik", → /admin/curriculum/topics/create?chapter_id=36, fa-plus | FN-M03-1.1.14 |
| EL-M03-S1-115 | card | conditional (state captured @1280 only) | "Bahasa Inggeris" | FN-M03-1.1.4 |
| EL-M03-S1-116 | text | conditional (state captured @1280 only) | "Bahasa Inggeris" | FN-M03-1.1.4 |
| EL-M03-S1-117 | card | conditional (state captured @1280 only) | "Tingkatan 3" | FN-M03-1.1.4 |
| EL-M03-S1-118 | text | conditional (state captured @1280 only) | "Tingkatan 3" | FN-M03-1.1.4 |
| EL-M03-S1-119 | card | conditional (state captured @1280 only) | "0" | FN-M03-1.1.4 |
| EL-M03-S1-120 | card | conditional (state captured @1280 only) | "0 / 0" | FN-M03-1.1.4 |
| EL-M03-S1-121 | text | conditional (state captured @1280 only) | "0 / 0" | FN-M03-1.1.4 |
| EL-M03-S1-122 | link | conditional (state captured @1280 only) | "Tambah Bab", → /admin/curriculum/chapters/create?subject_id=2&education_level_id=9, fa-plus | FN-M03-1.1.5 |
| EL-M03-S1-123 | empty-state | conditional (state captured @1280 only) | "Tiada bab dijumpai untuk subjek dan tahap ini." | FN-M03-1.1.6 |
| EL-M03-S1-124 | link | conditional (state captured @1280 only) | "Tambah Bab Pertama", → /admin/curriculum/chapters/create?subject_id=2&education_level_id=9, fa-plus | FN-M03-1.1.6 |
| EL-M03-S1-125 | alert | conditional (state captured @1280 only) | "Bab tidak dijumpai.", fa-exclamation-circle | FN-M03-1.1.19 |
| EL-M03-S1-126 | alert | conditional (state captured @1280 only) | "Chapter ID diperlukan.", fa-exclamation-circle | FN-M03-1.1.19 |
| EL-M03-S1-127 | card | conditional (state captured @1280 only) | "Matematik Tambahan" | FN-M03-1.1.4 |
| EL-M03-S1-128 | text | conditional (state captured @1280 only) | "Matematik Tambahan" | FN-M03-1.1.4 |
| EL-M03-S1-129 | link | conditional (state captured @1280 only) | "Tambah Bab", → /admin/curriculum/chapters/create?subject_id=8&education_level_id=1, fa-plus | FN-M03-1.1.5 |
| EL-M03-S1-130 | link | conditional (state captured @1280 only) | "Tambah Bab Pertama", → /admin/curriculum/chapters/create?subject_id=8&education_level_id=1, fa-plus | FN-M03-1.1.6 |
| EL-M03-S1-131 | card | conditional | "Matematik" | FN-M03-1.1.4 |
| EL-M03-S1-132 | text | conditional | "Matematik" | FN-M03-1.1.4 |
| EL-M03-S1-133 | card | conditional | "Tingkatan 4" | FN-M03-1.1.4 |
| EL-M03-S1-134 | text | conditional | "Tingkatan 4" | FN-M03-1.1.4 |
| EL-M03-S1-135 | card | conditional | "10" | FN-M03-1.1.4 |
| EL-M03-S1-136 | card | conditional | "24 / 0" | FN-M03-1.1.4 |
| EL-M03-S1-137 | text | conditional | "24 / 0" | FN-M03-1.1.4 |
| EL-M03-S1-138 | link | conditional | "Tambah Bab", → /admin/curriculum/chapters/create?subject_id=3&education_level_id=10, fa-plus | FN-M03-1.1.5 |
| EL-M03-S1-139 | card | conditional | "Bab 1: Fungsi dan Persamaan Kuadratik" | FN-M03-1.1.7 |
| EL-M03-S1-140 | heading | conditional | "Bab 1: Fungsi dan Persamaan Kuadratik" | FN-M03-1.1.7 |
| EL-M03-S1-141 | heading | conditional | "Topik 1: Fungsi" | FN-M03-1.1.11 |
| EL-M03-S1-142 | text | conditional | "Konsep fungsi dan graf" | FN-M03-1.1.11 |
| EL-M03-S1-143 | empty-state | conditional | "Tiada subtopik" | FN-M03-1.1.15 |
| EL-M03-S1-144 | toggle | conditional (state captured @1280 only) | "Batal", fa-minus | FN-M03-1.1.18 |
| EL-M03-S1-145 | heading | conditional | "Topik 1: Fungsi dan Persamaan Kuadratik" | FN-M03-1.1.11 |
| EL-M03-S1-146 | text | conditional | "Auto-created from DSKP SK 1.1 for chapter scale-up." | FN-M03-1.1.11 |
| EL-M03-S1-147 | empty-state | hidden-only | "Tiada subtopik" | FN-M03-1.1.15 |
| EL-M03-S1-148 | toggle | conditional | fa-chevron-right | FN-M03-1.1.11 |
| EL-M03-S1-149 | heading | conditional | "Topik 2: Persamaan kuadratik" | FN-M03-1.1.11 |
| EL-M03-S1-150 | text | conditional | "Menyelesaikan persamaan kuadratik" | FN-M03-1.1.11 |
| EL-M03-S1-151 | link | conditional | → /admin/curriculum/topics/127/edit, fa-edit, title "Edit Topik" | FN-M03-1.1.12 |
| EL-M03-S1-152 | form | conditional | POST /admin/curriculum/topics/127 | FN-M03-1.1.13 |
| EL-M03-S1-153 | empty-state | hidden-only | "Tiada subtopik" | FN-M03-1.1.15 |
| EL-M03-S1-154 | form | hidden-only | POST /admin/curriculum/subtopics | FN-M03-1.1.18 |
| EL-M03-S1-155 | hidden-field | hidden-only | `curriculum_topic_id` | FN-M03-1.1.18 |
| EL-M03-S1-156 | button | hidden-only | "Tambah Subtopik", fa-plus | FN-M03-1.1.18 |
| EL-M03-S1-157 | link | conditional | "Tambah Topik", → /admin/curriculum/topics/create?chapter_id=91, fa-plus | FN-M03-1.1.14 |
| EL-M03-S1-158 | heading | conditional | "Bab 2: Asas Nombor" | FN-M03-1.1.7 |
| EL-M03-S1-159 | link | conditional | "Tambah Topik", → /admin/curriculum/topics/create?chapter_id=92, fa-plus | FN-M03-1.1.14 |
| EL-M03-S1-160 | toggle | hidden-only | "Tambah Subtopik", fa-plus | FN-M03-1.1.18 |

#### S2 — `/admin/curriculum/chapters/create` (21 elements)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M03-S2-001 | link | visible-default | "Kembali ke Kurikulum", → /admin/curriculum?subject_id=3&education_level_id=10, fa-arrow-left | FN-M03-1.2.2 |
| EL-M03-S2-002 | card | visible-default | "Subjek *" | FN-M03-1.2.3 |
| EL-M03-S2-003 | form | visible-default | POST /admin/curriculum/chapters | FN-M03-1.2.3 |
| EL-M03-S2-004 | hidden-field | hidden-only | `_token` | FN-M03-1.2.3 |
| EL-M03-S2-005 | label | visible-default | "Subjek *" | FN-M03-1.2.3 |
| EL-M03-S2-006 | select | visible-default | `subject_id`, required, 32 options (first "-- Pilih Subjek --") | FN-M03-1.2.3 |
| EL-M03-S2-007 | label | visible-default | "Tahap Pendidikan *" | FN-M03-1.2.3 |
| EL-M03-S2-008 | select | visible-default | `education_level_id`, required, 12 options (first "-- Pilih Tahap --") | FN-M03-1.2.3 |
| EL-M03-S2-009 | label | visible-default | "Nama Bab (Bahasa Melayu) *" | FN-M03-1.2.4 |
| EL-M03-S2-010 | input | visible-default | `name`, ph "cth: Nombor Bulat", required | FN-M03-1.2.4 |
| EL-M03-S2-011 | label | visible-default | "Nama Bab (English)" | FN-M03-1.2.4 |
| EL-M03-S2-012 | input | visible-default | `name_en`, ph "e.g: Whole Numbers" | FN-M03-1.2.4 |
| EL-M03-S2-013 | label | visible-default | "Nombor Bab" | FN-M03-1.2.5 |
| EL-M03-S2-014 | input | visible-default | `chapter_number`, number, min 1, ph "cth: 1" | FN-M03-1.2.5 |
| EL-M03-S2-015 | text | visible-default | "Contoh: 1, 2, 3 (opsional)", fa-info-circle | FN-M03-1.2.5 |
| EL-M03-S2-016 | label | visible-default | "Penerangan" | FN-M03-1.2.6 |
| EL-M03-S2-017 | textarea | visible-default | `description`, ph "Penerangan ringkas tentang bab ini..." | FN-M03-1.2.6 |
| EL-M03-S2-018 | link | visible-default | "Batal", → /admin/curriculum?subject_id=3&education_level_id=10 | FN-M03-1.2.2 |
| EL-M03-S2-019 | button | visible-default | "Simpan Bab", fa-save | FN-M03-1.2.7 |
| EL-M03-S2-020 | link | conditional (state captured @1280 only) | "Kembali ke Kurikulum", → /admin/curriculum, fa-arrow-left | FN-M03-1.2.2 |
| EL-M03-S2-021 | link | conditional (state captured @1280 only) | "Batal", → /admin/curriculum | FN-M03-1.2.2 |

#### S3 — `/admin/curriculum/chapters/{id}/edit` (23 elements)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M03-S3-001 | link | visible-default | "Kembali ke Kurikulum", → /admin/curriculum?subject_id=3&education_level_id=10, fa-arrow-left | FN-M03-1.3.2 |
| EL-M03-S3-002 | card | visible-default | "Subjek *" | FN-M03-1.3.3 |
| EL-M03-S3-003 | form | visible-default | POST /admin/curriculum/chapters/91 | FN-M03-1.3.3 |
| EL-M03-S3-004 | hidden-field | hidden-only | `_token` | FN-M03-1.3.3 |
| EL-M03-S3-005 | hidden-field | hidden-only | `_method` | FN-M03-1.3.3 |
| EL-M03-S3-006 | label | visible-default | "Subjek *" | FN-M03-1.3.3 |
| EL-M03-S3-007 | select | visible-default | `subject_id`, required, 32 options (first "-- Pilih Subjek --") | FN-M03-1.3.3 |
| EL-M03-S3-008 | label | visible-default | "Tahap Pendidikan *" | FN-M03-1.3.3 |
| EL-M03-S3-009 | select | visible-default | `education_level_id`, required, 12 options (first "-- Pilih Tahap --") | FN-M03-1.3.3 |
| EL-M03-S3-010 | label | visible-default | "Nama Bab (Bahasa Melayu) *" | FN-M03-1.3.3 |
| EL-M03-S3-011 | input | visible-default | `name`, ph "cth: Nombor Bulat", required | FN-M03-1.3.3 |
| EL-M03-S3-012 | label | visible-default | "Nama Bab (English)" | FN-M03-1.3.3 |
| EL-M03-S3-013 | input | visible-default | `name_en`, ph "e.g: Whole Numbers" | FN-M03-1.3.3 |
| EL-M03-S3-014 | label | visible-default | "Nombor Bab" | FN-M03-1.3.3 |
| EL-M03-S3-015 | input | visible-default | `chapter_number`, number, min 1, ph "cth: 1" | FN-M03-1.3.3 |
| EL-M03-S3-016 | text | visible-default | "Contoh: 1, 2, 3 (opsional)", fa-info-circle | FN-M03-1.3.3 |
| EL-M03-S3-017 | label | visible-default | "Penerangan" | FN-M03-1.3.3 |
| EL-M03-S3-018 | textarea | visible-default | `description`, ph "Penerangan ringkas tentang bab ini..." | FN-M03-1.3.3 |
| EL-M03-S3-019 | label | visible-default | "Aktif" | FN-M03-1.3.4 |
| EL-M03-S3-020 | checkbox | visible-default | `is_active`, checkbox, value 1 | FN-M03-1.3.4 |
| EL-M03-S3-021 | text | visible-default | "Nyahtanda jika bab ini tidak mahu dipaparkan buat masa ini" | FN-M03-1.3.4 |
| EL-M03-S3-022 | link | visible-default | "Batal", → /admin/curriculum?subject_id=3&education_level_id=10 | FN-M03-1.3.2 |
| EL-M03-S3-023 | button | visible-default | "Kemaskini Bab", fa-save | FN-M03-1.3.5 |

#### S4 — `/admin/curriculum/topics/create?chapter_id={id}` (24 elements)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M03-S4-001 | link | visible-default | "Kembali ke Kurikulum", → /admin/curriculum?subject_id=3&education_level_id=10, fa-arrow-left | FN-M03-1.4.2 |
| EL-M03-S4-002 | card | visible-default | "Bab 1: Fungsi dan Persamaan Kuadratik" | FN-M03-1.4.3 |
| EL-M03-S4-003 | text | visible-default | "Bab" | FN-M03-1.4.3 |
| EL-M03-S4-004 | heading | visible-default | "Bab 1: Fungsi dan Persamaan Kuadratik" | FN-M03-1.4.3 |
| EL-M03-S4-005 | text | visible-default | "Matematik", fa-book | FN-M03-1.4.3 |
| EL-M03-S4-006 | text | visible-default | "Tingkatan 4", fa-graduation-cap | FN-M03-1.4.3 |
| EL-M03-S4-007 | card | visible-default | "Nama Topik (Bahasa Melayu) *" | FN-M03-1.4.4 |
| EL-M03-S4-008 | form | visible-default | POST /admin/curriculum/topics | FN-M03-1.4.4 |
| EL-M03-S4-009 | hidden-field | hidden-only | `_token` | FN-M03-1.4.4 |
| EL-M03-S4-010 | hidden-field | hidden-only | `chapter_id` | FN-M03-1.4.4 |
| EL-M03-S4-011 | label | visible-default | "Nama Topik (Bahasa Melayu) *" | FN-M03-1.4.4 |
| EL-M03-S4-012 | input | visible-default | `name`, ph "cth: Nombor hingga 1000", required | FN-M03-1.4.4 |
| EL-M03-S4-013 | label | visible-default | "Nama Topik (English)" | FN-M03-1.4.4 |
| EL-M03-S4-014 | input | visible-default | `name_en`, ph "e.g: Numbers up to 1000" | FN-M03-1.4.4 |
| EL-M03-S4-015 | label | visible-default | "Nombor Topik" | FN-M03-1.4.5 |
| EL-M03-S4-016 | input | visible-default | `topic_number`, ph "cth: 1.1" | FN-M03-1.4.5 |
| EL-M03-S4-017 | text | visible-default | "Contoh: 1.1, 1.2, 2.1 (opsional)", fa-info-circle | FN-M03-1.4.5 |
| EL-M03-S4-018 | label | visible-default | "Penerangan" | FN-M03-1.4.6 |
| EL-M03-S4-019 | textarea | visible-default | `description`, ph "Penerangan ringkas tentang topik ini..." | FN-M03-1.4.6 |
| EL-M03-S4-020 | label | visible-default | "Standard Pembelajaran" | FN-M03-1.4.6 |
| EL-M03-S4-021 | textarea | visible-default | `learning_standard`, ph "Standard pembelajaran mengikut kurikulum KSSM/KSSR..." | FN-M03-1.4.6 |
| EL-M03-S4-022 | text | visible-default | "Rujuk dokumen standard kurikulum KPM", fa-info-circle | FN-M03-1.4.6 |
| EL-M03-S4-023 | link | visible-default | "Batal", → /admin/curriculum?subject_id=3&education_level_id=10 | FN-M03-1.4.2 |
| EL-M03-S4-024 | button | visible-default | "Simpan Topik", fa-save | FN-M03-1.4.7 |

#### S5 — `/admin/curriculum/topics/{id}/edit` (27 elements)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M03-S5-001 | link | visible-default | "Kembali ke Kurikulum", → /admin/curriculum?subject_id=3&education_level_id=10, fa-arrow-left | FN-M03-1.5.2 |
| EL-M03-S5-002 | card | visible-default | "Bab 1: Fungsi dan Persamaan Kuadratik" | FN-M03-1.5.3 |
| EL-M03-S5-003 | text | visible-default | "Bab" | FN-M03-1.5.3 |
| EL-M03-S5-004 | heading | visible-default | "Bab 1: Fungsi dan Persamaan Kuadratik" | FN-M03-1.5.3 |
| EL-M03-S5-005 | text | visible-default | "Matematik", fa-book | FN-M03-1.5.3 |
| EL-M03-S5-006 | text | visible-default | "Tingkatan 4", fa-graduation-cap | FN-M03-1.5.3 |
| EL-M03-S5-007 | card | visible-default | "Nama Topik (Bahasa Melayu) *" | FN-M03-1.5.4 |
| EL-M03-S5-008 | form | visible-default | POST /admin/curriculum/topics/126 | FN-M03-1.5.4 |
| EL-M03-S5-009 | hidden-field | hidden-only | `_token` | FN-M03-1.5.4 |
| EL-M03-S5-010 | hidden-field | hidden-only | `_method` | FN-M03-1.5.4 |
| EL-M03-S5-011 | label | visible-default | "Nama Topik (Bahasa Melayu) *" | FN-M03-1.5.4 |
| EL-M03-S5-012 | input | visible-default | `name`, ph "cth: Nombor hingga 1000", required | FN-M03-1.5.4 |
| EL-M03-S5-013 | label | visible-default | "Nama Topik (English)" | FN-M03-1.5.4 |
| EL-M03-S5-014 | input | visible-default | `name_en`, ph "e.g: Numbers up to 1000" | FN-M03-1.5.4 |
| EL-M03-S5-015 | label | visible-default | "Nombor Topik" | FN-M03-1.5.4 |
| EL-M03-S5-016 | input | visible-default | `topic_number`, ph "cth: 1.1" | FN-M03-1.5.4 |
| EL-M03-S5-017 | text | visible-default | "Contoh: 1.1, 1.2, 2.1 (opsional)", fa-info-circle | FN-M03-1.5.4 |
| EL-M03-S5-018 | label | visible-default | "Penerangan" | FN-M03-1.5.4 |
| EL-M03-S5-019 | textarea | visible-default | `description`, ph "Penerangan ringkas tentang topik ini..." | FN-M03-1.5.4 |
| EL-M03-S5-020 | label | visible-default | "Standard Pembelajaran" | FN-M03-1.5.4 |
| EL-M03-S5-021 | textarea | visible-default | `learning_standard`, ph "Standard pembelajaran mengikut kurikulum KSSM/KSSR..." | FN-M03-1.5.4 |
| EL-M03-S5-022 | text | visible-default | "Rujuk dokumen standard kurikulum KPM", fa-info-circle | FN-M03-1.5.4 |
| EL-M03-S5-023 | label | visible-default | "Aktif" | FN-M03-1.5.5 |
| EL-M03-S5-024 | checkbox | visible-default | `is_active`, checkbox, value 1 | FN-M03-1.5.5 |
| EL-M03-S5-025 | text | visible-default | "Nyahtanda jika topik ini tidak mahu dipaparkan buat masa ini" | FN-M03-1.5.5 |
| EL-M03-S5-026 | link | visible-default | "Batal", → /admin/curriculum?subject_id=3&education_level_id=10 | FN-M03-1.5.2 |
| EL-M03-S5-027 | button | visible-default | "Kemaskini Topik", fa-save | FN-M03-1.5.6 |

#### S6 — `/admin/subjects` (62 elements)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M03-S6-001 | heading | visible-default | "Senarai Subjek" | FN-M03-2.1.2 |
| EL-M03-S6-002 | text | visible-default | "Jumlah: 31 subjek" | FN-M03-2.1.2 |
| EL-M03-S6-003 | link | visible-default | "Tambah", → /admin/subjects/create, fa-plus | FN-M03-2.1.2 |
| EL-M03-S6-004 | card | visible-default | "#" | FN-M03-2.1.3 |
| EL-M03-S6-005 | table | visible-default |  | FN-M03-2.1.3 |
| EL-M03-S6-006 | badge | visible-default | "Teras", fa-star | FN-M03-2.1.3 |
| EL-M03-S6-007 | toggle | visible-default |  | FN-M03-2.1.5 |
| EL-M03-S6-008 | link | visible-default | → /admin/subjects/1/edit, fa-edit, title "Edit" | FN-M03-2.1.6 |
| EL-M03-S6-009 | form | visible-default | POST /admin/subjects/1 | FN-M03-2.1.7 |
| EL-M03-S6-010 | hidden-field | hidden-only | `_token` | FN-M03-2.1.7 |
| EL-M03-S6-011 | hidden-field | hidden-only | `_method` | FN-M03-2.1.7 |
| EL-M03-S6-012 | button | visible-default | fa-trash, title "Padam" | FN-M03-2.1.7 |
| EL-M03-S6-013 | badge | visible-default | "Teras", fa-star | FN-M03-2.1.3 |
| EL-M03-S6-014 | toggle | visible-default |  | FN-M03-2.1.5 |
| EL-M03-S6-015 | link | visible-default | → /admin/subjects/2/edit, fa-edit, title "Edit" | FN-M03-2.1.6 |
| EL-M03-S6-016 | form | visible-default | POST /admin/subjects/2 | FN-M03-2.1.7 |
| EL-M03-S6-017 | hidden-field | hidden-only | `_token` | FN-M03-2.1.7 |
| EL-M03-S6-018 | hidden-field | hidden-only | `_method` | FN-M03-2.1.7 |
| EL-M03-S6-019 | button | visible-default | fa-trash, title "Padam" | FN-M03-2.1.7 |
| EL-M03-S6-020 | badge | visible-default | "Teras", fa-star | FN-M03-2.1.3 |
| EL-M03-S6-021 | toggle | visible-default |  | FN-M03-2.1.5 |
| EL-M03-S6-022 | link | visible-default | → /admin/subjects/3/edit, fa-edit, title "Edit" | FN-M03-2.1.6 |
| EL-M03-S6-023 | form | visible-default | POST /admin/subjects/3 | FN-M03-2.1.7 |
| EL-M03-S6-024 | hidden-field | hidden-only | `_token` | FN-M03-2.1.7 |
| EL-M03-S6-025 | hidden-field | hidden-only | `_method` | FN-M03-2.1.7 |
| EL-M03-S6-026 | button | visible-default | fa-trash, title "Padam" | FN-M03-2.1.7 |
| EL-M03-S6-027 | badge | visible-default | "Teras", fa-star | FN-M03-2.1.3 |
| EL-M03-S6-028 | toggle | visible-default |  | FN-M03-2.1.5 |
| EL-M03-S6-029 | link | visible-default | → /admin/subjects/4/edit, fa-edit, title "Edit" | FN-M03-2.1.6 |
| EL-M03-S6-030 | form | visible-default | POST /admin/subjects/4 | FN-M03-2.1.7 |
| EL-M03-S6-031 | hidden-field | hidden-only | `_token` | FN-M03-2.1.7 |
| EL-M03-S6-032 | hidden-field | hidden-only | `_method` | FN-M03-2.1.7 |
| EL-M03-S6-033 | button | visible-default | fa-trash, title "Padam" | FN-M03-2.1.7 |
| EL-M03-S6-034 | badge | visible-default | "Teras", fa-star | FN-M03-2.1.3 |
| EL-M03-S6-035 | toggle | visible-default |  | FN-M03-2.1.5 |
| EL-M03-S6-036 | link | visible-default | → /admin/subjects/5/edit, fa-edit, title "Edit" | FN-M03-2.1.6 |
| EL-M03-S6-037 | form | visible-default | POST /admin/subjects/5 | FN-M03-2.1.7 |
| EL-M03-S6-038 | hidden-field | hidden-only | `_token` | FN-M03-2.1.7 |
| EL-M03-S6-039 | hidden-field | hidden-only | `_method` | FN-M03-2.1.7 |
| EL-M03-S6-040 | button | visible-default | fa-trash, title "Padam" | FN-M03-2.1.7 |
| EL-M03-S6-041 | badge | visible-default | "Teras", fa-star | FN-M03-2.1.3 |
| EL-M03-S6-042 | toggle | visible-default |  | FN-M03-2.1.5 |
| EL-M03-S6-043 | link | visible-default | → /admin/subjects/6/edit, fa-edit, title "Edit" | FN-M03-2.1.6 |
| EL-M03-S6-044 | form | visible-default | POST /admin/subjects/6 | FN-M03-2.1.7 |
| EL-M03-S6-045 | hidden-field | hidden-only | `_token` | FN-M03-2.1.7 |
| EL-M03-S6-046 | hidden-field | hidden-only | `_method` | FN-M03-2.1.7 |
| EL-M03-S6-047 | button | visible-default | fa-trash, title "Padam" | FN-M03-2.1.7 |
| EL-M03-S6-048 | badge | visible-default | "Teras", fa-star | FN-M03-2.1.3 |
| EL-M03-S6-049 | toggle | visible-default |  | FN-M03-2.1.5 |
| EL-M03-S6-050 | link | visible-default | → /admin/subjects/7/edit, fa-edit, title "Edit" | FN-M03-2.1.6 |
| EL-M03-S6-051 | form | visible-default | POST /admin/subjects/7 | FN-M03-2.1.7 |
| EL-M03-S6-052 | hidden-field | hidden-only | `_token` | FN-M03-2.1.7 |
| EL-M03-S6-053 | hidden-field | hidden-only | `_method` | FN-M03-2.1.7 |
| EL-M03-S6-054 | button | visible-default | fa-trash, title "Padam" | FN-M03-2.1.7 |
| EL-M03-S6-055 | badge | visible-default | "Elektif" | FN-M03-2.1.3 |
| EL-M03-S6-056 | toggle | visible-default |  | FN-M03-2.1.5 |
| EL-M03-S6-057 | link | visible-default | → /admin/subjects/8/edit, fa-edit, title "Edit" | FN-M03-2.1.6 |
| EL-M03-S6-058 | form | visible-default | POST /admin/subjects/8 | FN-M03-2.1.7 |
| EL-M03-S6-059 | hidden-field | hidden-only | `_token` | FN-M03-2.1.7 |
| EL-M03-S6-060 | hidden-field | hidden-only | `_method` | FN-M03-2.1.7 |
| EL-M03-S6-061 | button | visible-default | fa-trash, title "Padam" | FN-M03-2.1.7 |
| EL-M03-S6-062 | alert | conditional (state captured @1280 only) | "Subjek tidak dijumpai.", fa-exclamation-circle | FN-M03-2.1.8 |

#### S7 — `/admin/subjects/create` (49 elements)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M03-S7-001 | link | visible-default | "Kembali ke Senarai", → /admin/subjects, fa-arrow-left | FN-M03-2.2.2 |
| EL-M03-S7-002 | card | visible-default | "Nama Subjek (Bahasa Melayu) *" | FN-M03-2.2.3 |
| EL-M03-S7-003 | form | visible-default | POST /admin/subjects | FN-M03-2.2.3 |
| EL-M03-S7-004 | hidden-field | hidden-only | `_token` | FN-M03-2.2.3 |
| EL-M03-S7-005 | label | visible-default | "Nama Subjek (Bahasa Melayu) *" | FN-M03-2.2.3 |
| EL-M03-S7-006 | input | visible-default | `name`, ph "cth: Matematik", required | FN-M03-2.2.3 |
| EL-M03-S7-007 | label | visible-default | "Nama Subjek (English) *" | FN-M03-2.2.3 |
| EL-M03-S7-008 | input | visible-default | `name_en`, ph "e.g: Mathematics", required | FN-M03-2.2.3 |
| EL-M03-S7-009 | label | visible-default | "Kod Subjek *" | FN-M03-2.2.4 |
| EL-M03-S7-010 | input | visible-default | `code`, maxlength 20, ph "cth: MATH01", required | FN-M03-2.2.4 |
| EL-M03-S7-011 | text | visible-default | "Kod akan ditukar ke huruf besar automatik", fa-info-circle | FN-M03-2.2.4 |
| EL-M03-S7-012 | label | visible-default | "Ikon (Font Awesome)" | FN-M03-2.2.5 |
| EL-M03-S7-013 | input | visible-default | `icon`, ph "cth: fas fa-calculator" | FN-M03-2.2.5 |
| EL-M03-S7-014 | text | visible-default | "Lihat ikon di", fa-lightbulb | FN-M03-2.2.5 |
| EL-M03-S7-015 | link | visible-default | "Font Awesome", → https://fontawesome.com/icons | FN-M03-2.2.5 |
| EL-M03-S7-016 | label | visible-default | "Warna Tema" | FN-M03-2.2.6 |
| EL-M03-S7-017 | input | visible-default | `color`, color | FN-M03-2.2.6 |
| EL-M03-S7-018 | input | visible-default | #color_text, read-only | FN-M03-2.2.6 |
| EL-M03-S7-019 | label | visible-default | "Subjek Teras (Core Subject)" | FN-M03-2.2.7 |
| EL-M03-S7-020 | checkbox | visible-default | `is_core`, checkbox, value 1 | FN-M03-2.2.7 |
| EL-M03-S7-021 | text | visible-default | "Tandakan jika subjek ini adalah subjek wajib" | FN-M03-2.2.7 |
| EL-M03-S7-022 | label | visible-default | "Susunan Paparan" | FN-M03-2.2.8 |
| EL-M03-S7-023 | input | visible-default | `order`, number, min 0 | FN-M03-2.2.8 |
| EL-M03-S7-024 | text | visible-default | "Nombor lebih kecil akan dipaparkan dahulu", fa-sort | FN-M03-2.2.8 |
| EL-M03-S7-025 | label | visible-default | "Tahap Pendidikan Berkaitan" | FN-M03-2.2.9 |
| EL-M03-S7-026 | label | visible-default | "Darjah 1 (Year 1)" | FN-M03-2.2.9 |
| EL-M03-S7-027 | checkbox | visible-default | `education_levels[]`, checkbox, value 1 | FN-M03-2.2.9 |
| EL-M03-S7-028 | label | visible-default | "Darjah 2 (Year 2)" | FN-M03-2.2.9 |
| EL-M03-S7-029 | checkbox | visible-default | `education_levels[]`, checkbox, value 2 | FN-M03-2.2.9 |
| EL-M03-S7-030 | label | visible-default | "Darjah 3 (Year 3)" | FN-M03-2.2.9 |
| EL-M03-S7-031 | checkbox | visible-default | `education_levels[]`, checkbox, value 3 | FN-M03-2.2.9 |
| EL-M03-S7-032 | label | visible-default | "Darjah 4 (Year 4)" | FN-M03-2.2.9 |
| EL-M03-S7-033 | checkbox | visible-default | `education_levels[]`, checkbox, value 4 | FN-M03-2.2.9 |
| EL-M03-S7-034 | label | visible-default | "Darjah 5 (Year 5)" | FN-M03-2.2.9 |
| EL-M03-S7-035 | checkbox | visible-default | `education_levels[]`, checkbox, value 5 | FN-M03-2.2.9 |
| EL-M03-S7-036 | label | visible-default | "Darjah 6 (Year 6)" | FN-M03-2.2.9 |
| EL-M03-S7-037 | checkbox | visible-default | `education_levels[]`, checkbox, value 6 | FN-M03-2.2.9 |
| EL-M03-S7-038 | label | visible-default | "Tingkatan 1 (Form 1)" | FN-M03-2.2.9 |
| EL-M03-S7-039 | checkbox | visible-default | `education_levels[]`, checkbox, value 7 | FN-M03-2.2.9 |
| EL-M03-S7-040 | label | visible-default | "Tingkatan 2 (Form 2)" | FN-M03-2.2.9 |
| EL-M03-S7-041 | checkbox | visible-default | `education_levels[]`, checkbox, value 8 | FN-M03-2.2.9 |
| EL-M03-S7-042 | label | visible-default | "Tingkatan 3 (Form 3)" | FN-M03-2.2.9 |
| EL-M03-S7-043 | checkbox | visible-default | `education_levels[]`, checkbox, value 9 | FN-M03-2.2.9 |
| EL-M03-S7-044 | label | visible-default | "Tingkatan 4 (Form 4)" | FN-M03-2.2.9 |
| EL-M03-S7-045 | checkbox | visible-default | `education_levels[]`, checkbox, value 10 | FN-M03-2.2.9 |
| EL-M03-S7-046 | label | visible-default | "Tingkatan 5 (Form 5)" | FN-M03-2.2.9 |
| EL-M03-S7-047 | checkbox | visible-default | `education_levels[]`, checkbox, value 11 | FN-M03-2.2.9 |
| EL-M03-S7-048 | link | visible-default | "Batal", → /admin/subjects | FN-M03-2.2.2 |
| EL-M03-S7-049 | button | visible-default | "Simpan Subjek", fa-save | FN-M03-2.2.10 |

#### S8 — `/admin/subjects/{id}/edit` (50 elements)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M03-S8-001 | link | visible-default | "Kembali ke Senarai", → /admin/subjects, fa-arrow-left | FN-M03-2.3.2 |
| EL-M03-S8-002 | card | visible-default | "Nama Subjek (Bahasa Melayu) *" | FN-M03-2.3.3 |
| EL-M03-S8-003 | form | visible-default | POST /admin/subjects/3 | FN-M03-2.3.3 |
| EL-M03-S8-004 | hidden-field | hidden-only | `_token` | FN-M03-2.3.3 |
| EL-M03-S8-005 | hidden-field | hidden-only | `_method` | FN-M03-2.3.3 |
| EL-M03-S8-006 | label | visible-default | "Nama Subjek (Bahasa Melayu) *" | FN-M03-2.3.3 |
| EL-M03-S8-007 | input | visible-default | `name`, ph "cth: Matematik", required | FN-M03-2.3.3 |
| EL-M03-S8-008 | label | visible-default | "Nama Subjek (English) *" | FN-M03-2.3.3 |
| EL-M03-S8-009 | input | visible-default | `name_en`, ph "e.g: Mathematics", required | FN-M03-2.3.3 |
| EL-M03-S8-010 | label | visible-default | "Kod Subjek *" | FN-M03-2.3.3 |
| EL-M03-S8-011 | input | visible-default | `code`, maxlength 20, ph "cth: MATH01", required | FN-M03-2.3.3 |
| EL-M03-S8-012 | text | visible-default | "Kod akan ditukar ke huruf besar automatik", fa-info-circle | FN-M03-2.3.3 |
| EL-M03-S8-013 | label | visible-default | "Ikon (Font Awesome)" | FN-M03-2.3.3 |
| EL-M03-S8-014 | input | visible-default | `icon`, ph "cth: fas fa-calculator" | FN-M03-2.3.3 |
| EL-M03-S8-015 | text | visible-default | "Lihat ikon di", fa-lightbulb | FN-M03-2.3.3 |
| EL-M03-S8-016 | link | visible-default | "Font Awesome", → https://fontawesome.com/icons | FN-M03-2.3.3 |
| EL-M03-S8-017 | label | visible-default | "Warna Tema" | FN-M03-2.3.3 |
| EL-M03-S8-018 | input | visible-default | `color`, color | FN-M03-2.3.3 |
| EL-M03-S8-019 | input | visible-default | #color_text, read-only | FN-M03-2.3.3 |
| EL-M03-S8-020 | label | visible-default | "Subjek Teras (Core Subject)" | FN-M03-2.3.3 |
| EL-M03-S8-021 | checkbox | visible-default | `is_core`, checkbox, value 1 | FN-M03-2.3.3 |
| EL-M03-S8-022 | text | visible-default | "Tandakan jika subjek ini adalah subjek wajib" | FN-M03-2.3.3 |
| EL-M03-S8-023 | label | visible-default | "Susunan Paparan" | FN-M03-2.3.3 |
| EL-M03-S8-024 | input | visible-default | `order`, number, min 0 | FN-M03-2.3.3 |
| EL-M03-S8-025 | text | visible-default | "Nombor lebih kecil akan dipaparkan dahulu", fa-sort | FN-M03-2.3.3 |
| EL-M03-S8-026 | label | visible-default | "Tahap Pendidikan Berkaitan" | FN-M03-2.3.3 |
| EL-M03-S8-027 | label | visible-default | "Darjah 1 (Year 1)" | FN-M03-2.3.3 |
| EL-M03-S8-028 | checkbox | visible-default | `education_levels[]`, checkbox, value 1 | FN-M03-2.3.3 |
| EL-M03-S8-029 | label | visible-default | "Darjah 2 (Year 2)" | FN-M03-2.3.3 |
| EL-M03-S8-030 | checkbox | visible-default | `education_levels[]`, checkbox, value 2 | FN-M03-2.3.3 |
| EL-M03-S8-031 | label | visible-default | "Darjah 3 (Year 3)" | FN-M03-2.3.3 |
| EL-M03-S8-032 | checkbox | visible-default | `education_levels[]`, checkbox, value 3 | FN-M03-2.3.3 |
| EL-M03-S8-033 | label | visible-default | "Darjah 4 (Year 4)" | FN-M03-2.3.3 |
| EL-M03-S8-034 | checkbox | visible-default | `education_levels[]`, checkbox, value 4 | FN-M03-2.3.3 |
| EL-M03-S8-035 | label | visible-default | "Darjah 5 (Year 5)" | FN-M03-2.3.3 |
| EL-M03-S8-036 | checkbox | visible-default | `education_levels[]`, checkbox, value 5 | FN-M03-2.3.3 |
| EL-M03-S8-037 | label | visible-default | "Darjah 6 (Year 6)" | FN-M03-2.3.3 |
| EL-M03-S8-038 | checkbox | visible-default | `education_levels[]`, checkbox, value 6 | FN-M03-2.3.3 |
| EL-M03-S8-039 | label | visible-default | "Tingkatan 1 (Form 1)" | FN-M03-2.3.3 |
| EL-M03-S8-040 | checkbox | visible-default | `education_levels[]`, checkbox, value 7 | FN-M03-2.3.3 |
| EL-M03-S8-041 | label | visible-default | "Tingkatan 2 (Form 2)" | FN-M03-2.3.3 |
| EL-M03-S8-042 | checkbox | visible-default | `education_levels[]`, checkbox, value 8 | FN-M03-2.3.3 |
| EL-M03-S8-043 | label | visible-default | "Tingkatan 3 (Form 3)" | FN-M03-2.3.3 |
| EL-M03-S8-044 | checkbox | visible-default | `education_levels[]`, checkbox, value 9 | FN-M03-2.3.3 |
| EL-M03-S8-045 | label | visible-default | "Tingkatan 4 (Form 4)" | FN-M03-2.3.3 |
| EL-M03-S8-046 | checkbox | visible-default | `education_levels[]`, checkbox, value 10 | FN-M03-2.3.3 |
| EL-M03-S8-047 | label | visible-default | "Tingkatan 5 (Form 5)" | FN-M03-2.3.3 |
| EL-M03-S8-048 | checkbox | visible-default | `education_levels[]`, checkbox, value 11 | FN-M03-2.3.3 |
| EL-M03-S8-049 | link | visible-default | "Batal", → /admin/subjects | FN-M03-2.3.2 |
| EL-M03-S8-050 | button | visible-default | "Kemaskini Subjek", fa-save | FN-M03-2.3.4 |

#### S9 — `/admin/education-levels` (83 elements)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M03-S9-001 | heading | visible-default | "Senarai Tahap Pendidikan" | FN-M03-3.1.2 |
| EL-M03-S9-002 | text | visible-default | "Jumlah: 11 tahap" | FN-M03-3.1.2 |
| EL-M03-S9-003 | link | visible-default | "Tambah Tahap", → /admin/education-levels/create, fa-plus | FN-M03-3.1.2 |
| EL-M03-S9-004 | card | visible-default | "#" | FN-M03-3.1.3 |
| EL-M03-S9-005 | table | visible-default |  | FN-M03-3.1.3 |
| EL-M03-S9-006 | badge | visible-default | "Rendah", fa-child | FN-M03-3.1.3 |
| EL-M03-S9-007 | toggle | visible-default |  | FN-M03-3.1.4 |
| EL-M03-S9-008 | link | visible-default | → /admin/education-levels/1/edit, fa-edit, title "Edit" | FN-M03-3.1.5 |
| EL-M03-S9-009 | form | visible-default | POST /admin/education-levels/1 | FN-M03-3.1.6 |
| EL-M03-S9-010 | hidden-field | hidden-only | `_token` | FN-M03-3.1.6 |
| EL-M03-S9-011 | hidden-field | hidden-only | `_method` | FN-M03-3.1.6 |
| EL-M03-S9-012 | button | visible-default | fa-trash, title "Padam" | FN-M03-3.1.6 |
| EL-M03-S9-013 | badge | visible-default | "Rendah", fa-child | FN-M03-3.1.3 |
| EL-M03-S9-014 | toggle | visible-default |  | FN-M03-3.1.4 |
| EL-M03-S9-015 | link | visible-default | → /admin/education-levels/2/edit, fa-edit, title "Edit" | FN-M03-3.1.5 |
| EL-M03-S9-016 | form | visible-default | POST /admin/education-levels/2 | FN-M03-3.1.6 |
| EL-M03-S9-017 | hidden-field | hidden-only | `_token` | FN-M03-3.1.6 |
| EL-M03-S9-018 | hidden-field | hidden-only | `_method` | FN-M03-3.1.6 |
| EL-M03-S9-019 | button | visible-default | fa-trash, title "Padam" | FN-M03-3.1.6 |
| EL-M03-S9-020 | badge | visible-default | "Rendah", fa-child | FN-M03-3.1.3 |
| EL-M03-S9-021 | toggle | visible-default |  | FN-M03-3.1.4 |
| EL-M03-S9-022 | link | visible-default | → /admin/education-levels/3/edit, fa-edit, title "Edit" | FN-M03-3.1.5 |
| EL-M03-S9-023 | form | visible-default | POST /admin/education-levels/3 | FN-M03-3.1.6 |
| EL-M03-S9-024 | hidden-field | hidden-only | `_token` | FN-M03-3.1.6 |
| EL-M03-S9-025 | hidden-field | hidden-only | `_method` | FN-M03-3.1.6 |
| EL-M03-S9-026 | button | visible-default | fa-trash, title "Padam" | FN-M03-3.1.6 |
| EL-M03-S9-027 | badge | visible-default | "Rendah", fa-child | FN-M03-3.1.3 |
| EL-M03-S9-028 | toggle | visible-default |  | FN-M03-3.1.4 |
| EL-M03-S9-029 | link | visible-default | → /admin/education-levels/4/edit, fa-edit, title "Edit" | FN-M03-3.1.5 |
| EL-M03-S9-030 | form | visible-default | POST /admin/education-levels/4 | FN-M03-3.1.6 |
| EL-M03-S9-031 | hidden-field | hidden-only | `_token` | FN-M03-3.1.6 |
| EL-M03-S9-032 | hidden-field | hidden-only | `_method` | FN-M03-3.1.6 |
| EL-M03-S9-033 | button | visible-default | fa-trash, title "Padam" | FN-M03-3.1.6 |
| EL-M03-S9-034 | badge | visible-default | "Rendah", fa-child | FN-M03-3.1.3 |
| EL-M03-S9-035 | toggle | visible-default |  | FN-M03-3.1.4 |
| EL-M03-S9-036 | link | visible-default | → /admin/education-levels/5/edit, fa-edit, title "Edit" | FN-M03-3.1.5 |
| EL-M03-S9-037 | form | visible-default | POST /admin/education-levels/5 | FN-M03-3.1.6 |
| EL-M03-S9-038 | hidden-field | hidden-only | `_token` | FN-M03-3.1.6 |
| EL-M03-S9-039 | hidden-field | hidden-only | `_method` | FN-M03-3.1.6 |
| EL-M03-S9-040 | button | visible-default | fa-trash, title "Padam" | FN-M03-3.1.6 |
| EL-M03-S9-041 | badge | visible-default | "Rendah", fa-child | FN-M03-3.1.3 |
| EL-M03-S9-042 | toggle | visible-default |  | FN-M03-3.1.4 |
| EL-M03-S9-043 | link | visible-default | → /admin/education-levels/6/edit, fa-edit, title "Edit" | FN-M03-3.1.5 |
| EL-M03-S9-044 | form | visible-default | POST /admin/education-levels/6 | FN-M03-3.1.6 |
| EL-M03-S9-045 | hidden-field | hidden-only | `_token` | FN-M03-3.1.6 |
| EL-M03-S9-046 | hidden-field | hidden-only | `_method` | FN-M03-3.1.6 |
| EL-M03-S9-047 | button | visible-default | fa-trash, title "Padam" | FN-M03-3.1.6 |
| EL-M03-S9-048 | badge | visible-default | "Menengah Rendah", fa-book-reader | FN-M03-3.1.3 |
| EL-M03-S9-049 | toggle | visible-default |  | FN-M03-3.1.4 |
| EL-M03-S9-050 | link | visible-default | → /admin/education-levels/7/edit, fa-edit, title "Edit" | FN-M03-3.1.5 |
| EL-M03-S9-051 | form | visible-default | POST /admin/education-levels/7 | FN-M03-3.1.6 |
| EL-M03-S9-052 | hidden-field | hidden-only | `_token` | FN-M03-3.1.6 |
| EL-M03-S9-053 | hidden-field | hidden-only | `_method` | FN-M03-3.1.6 |
| EL-M03-S9-054 | button | visible-default | fa-trash, title "Padam" | FN-M03-3.1.6 |
| EL-M03-S9-055 | badge | visible-default | "Menengah Rendah", fa-book-reader | FN-M03-3.1.3 |
| EL-M03-S9-056 | toggle | visible-default |  | FN-M03-3.1.4 |
| EL-M03-S9-057 | link | visible-default | → /admin/education-levels/8/edit, fa-edit, title "Edit" | FN-M03-3.1.5 |
| EL-M03-S9-058 | form | visible-default | POST /admin/education-levels/8 | FN-M03-3.1.6 |
| EL-M03-S9-059 | hidden-field | hidden-only | `_token` | FN-M03-3.1.6 |
| EL-M03-S9-060 | hidden-field | hidden-only | `_method` | FN-M03-3.1.6 |
| EL-M03-S9-061 | button | visible-default | fa-trash, title "Padam" | FN-M03-3.1.6 |
| EL-M03-S9-062 | badge | visible-default | "Menengah Rendah", fa-book-reader | FN-M03-3.1.3 |
| EL-M03-S9-063 | toggle | visible-default |  | FN-M03-3.1.4 |
| EL-M03-S9-064 | link | visible-default | → /admin/education-levels/9/edit, fa-edit, title "Edit" | FN-M03-3.1.5 |
| EL-M03-S9-065 | form | visible-default | POST /admin/education-levels/9 | FN-M03-3.1.6 |
| EL-M03-S9-066 | hidden-field | hidden-only | `_token` | FN-M03-3.1.6 |
| EL-M03-S9-067 | hidden-field | hidden-only | `_method` | FN-M03-3.1.6 |
| EL-M03-S9-068 | button | visible-default | fa-trash, title "Padam" | FN-M03-3.1.6 |
| EL-M03-S9-069 | badge | visible-default | "Menengah Atas", fa-user-graduate | FN-M03-3.1.3 |
| EL-M03-S9-070 | toggle | visible-default |  | FN-M03-3.1.4 |
| EL-M03-S9-071 | link | visible-default | → /admin/education-levels/10/edit, fa-edit, title "Edit" | FN-M03-3.1.5 |
| EL-M03-S9-072 | form | visible-default | POST /admin/education-levels/10 | FN-M03-3.1.6 |
| EL-M03-S9-073 | hidden-field | hidden-only | `_token` | FN-M03-3.1.6 |
| EL-M03-S9-074 | hidden-field | hidden-only | `_method` | FN-M03-3.1.6 |
| EL-M03-S9-075 | button | visible-default | fa-trash, title "Padam" | FN-M03-3.1.6 |
| EL-M03-S9-076 | badge | visible-default | "Menengah Atas", fa-user-graduate | FN-M03-3.1.3 |
| EL-M03-S9-077 | toggle | visible-default |  | FN-M03-3.1.4 |
| EL-M03-S9-078 | link | visible-default | → /admin/education-levels/11/edit, fa-edit, title "Edit" | FN-M03-3.1.5 |
| EL-M03-S9-079 | form | visible-default | POST /admin/education-levels/11 | FN-M03-3.1.6 |
| EL-M03-S9-080 | hidden-field | hidden-only | `_token` | FN-M03-3.1.6 |
| EL-M03-S9-081 | hidden-field | hidden-only | `_method` | FN-M03-3.1.6 |
| EL-M03-S9-082 | button | visible-default | fa-trash, title "Padam" | FN-M03-3.1.6 |
| EL-M03-S9-083 | alert | conditional (state captured @1280 only) | "Tahap Pendidikan tidak dijumpai.", fa-exclamation-circle | FN-M03-3.1.7 |

#### S10 — `/admin/education-levels/create` (21 elements)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M03-S10-001 | link | visible-default | "Kembali ke Senarai", → /admin/education-levels, fa-arrow-left | FN-M03-3.2.2 |
| EL-M03-S10-002 | card | visible-default | "Nama Tahap (Bahasa Melayu) *" | FN-M03-3.2.3 |
| EL-M03-S10-003 | form | visible-default | POST /admin/education-levels | FN-M03-3.2.3 |
| EL-M03-S10-004 | hidden-field | hidden-only | `_token` | FN-M03-3.2.3 |
| EL-M03-S10-005 | label | visible-default | "Nama Tahap (Bahasa Melayu) *" | FN-M03-3.2.3 |
| EL-M03-S10-006 | input | visible-default | `name`, ph "cth: Tahun 1", required | FN-M03-3.2.3 |
| EL-M03-S10-007 | label | visible-default | "Nama Tahap (English) *" | FN-M03-3.2.3 |
| EL-M03-S10-008 | input | visible-default | `name_en`, ph "e.g: Year 1", required | FN-M03-3.2.3 |
| EL-M03-S10-009 | label | visible-default | "Kod Tahap *" | FN-M03-3.2.4 |
| EL-M03-S10-010 | input | visible-default | `code`, maxlength 10, ph "cth: Y1", required | FN-M03-3.2.4 |
| EL-M03-S10-011 | text | visible-default | "Kod akan ditukar ke huruf besar automatik", fa-info-circle | FN-M03-3.2.4 |
| EL-M03-S10-012 | label | visible-default | "Peringkat *" | FN-M03-3.2.5 |
| EL-M03-S10-013 | select | visible-default | `stage`, required, 4 options (first "-- Pilih Peringkat --") | FN-M03-3.2.5 |
| EL-M03-S10-014 | label | visible-default | "Kurikulum *" | FN-M03-3.2.6 |
| EL-M03-S10-015 | input | visible-default | `curriculum`, ph "cth: KSSR, KSSM", required | FN-M03-3.2.6 |
| EL-M03-S10-016 | text | visible-default | "Nama kurikulum yang diguna pakai", fa-book-open | FN-M03-3.2.6 |
| EL-M03-S10-017 | label | visible-default | "Susunan Paparan" | FN-M03-3.2.7 |
| EL-M03-S10-018 | input | visible-default | `order`, number, min 0 | FN-M03-3.2.7 |
| EL-M03-S10-019 | text | visible-default | "Nombor lebih kecil akan dipaparkan dahulu", fa-sort | FN-M03-3.2.7 |
| EL-M03-S10-020 | link | visible-default | "Batal", → /admin/education-levels | FN-M03-3.2.2 |
| EL-M03-S10-021 | button | visible-default | "Simpan Tahap", fa-save | FN-M03-3.2.8 |

#### S11 — `/admin/education-levels/{id}/edit` (22 elements)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M03-S11-001 | link | visible-default | "Kembali ke Senarai", → /admin/education-levels, fa-arrow-left | FN-M03-3.3.2 |
| EL-M03-S11-002 | card | visible-default | "Nama Tahap (Bahasa Melayu) *" | FN-M03-3.3.3 |
| EL-M03-S11-003 | form | visible-default | POST /admin/education-levels/10 | FN-M03-3.3.3 |
| EL-M03-S11-004 | hidden-field | hidden-only | `_token` | FN-M03-3.3.3 |
| EL-M03-S11-005 | hidden-field | hidden-only | `_method` | FN-M03-3.3.3 |
| EL-M03-S11-006 | label | visible-default | "Nama Tahap (Bahasa Melayu) *" | FN-M03-3.3.3 |
| EL-M03-S11-007 | input | visible-default | `name`, ph "cth: Tahun 1", required | FN-M03-3.3.3 |
| EL-M03-S11-008 | label | visible-default | "Nama Tahap (English) *" | FN-M03-3.3.3 |
| EL-M03-S11-009 | input | visible-default | `name_en`, ph "e.g: Year 1", required | FN-M03-3.3.3 |
| EL-M03-S11-010 | label | visible-default | "Kod Tahap *" | FN-M03-3.3.3 |
| EL-M03-S11-011 | input | visible-default | `code`, maxlength 10, ph "cth: Y1", required | FN-M03-3.3.3 |
| EL-M03-S11-012 | text | visible-default | "Kod akan ditukar ke huruf besar automatik", fa-info-circle | FN-M03-3.3.3 |
| EL-M03-S11-013 | label | visible-default | "Peringkat *" | FN-M03-3.3.3 |
| EL-M03-S11-014 | select | visible-default | `stage`, required, 4 options (first "-- Pilih Peringkat --") | FN-M03-3.3.3 |
| EL-M03-S11-015 | label | visible-default | "Kurikulum *" | FN-M03-3.3.3 |
| EL-M03-S11-016 | input | visible-default | `curriculum`, ph "cth: KSSR, KSSM", required | FN-M03-3.3.3 |
| EL-M03-S11-017 | text | visible-default | "Nama kurikulum yang diguna pakai", fa-book-open | FN-M03-3.3.3 |
| EL-M03-S11-018 | label | visible-default | "Susunan Paparan" | FN-M03-3.3.3 |
| EL-M03-S11-019 | input | visible-default | `order`, number, min 0 | FN-M03-3.3.3 |
| EL-M03-S11-020 | text | visible-default | "Nombor lebih kecil akan dipaparkan dahulu", fa-sort | FN-M03-3.3.3 |
| EL-M03-S11-021 | link | visible-default | "Batal", → /admin/education-levels | FN-M03-3.3.2 |
| EL-M03-S11-022 | button | visible-default | "Kemaskini Tahap", fa-save | FN-M03-3.3.4 |

#### S12 — `/topics` (119 elements)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M03-S12-001 | text | hidden-only | "LIVE:", fa-circle | Excluded — tournament banner template (global widget, **owned by M16**) |
| EL-M03-S12-002 | text | hidden-only | "MAIN" | Excluded — tournament banner template (global widget, **owned by M16**) |
| EL-M03-S12-003 | text | hidden-only | "DAFTAR" | Excluded — tournament banner template (global widget, **owned by M16**) |
| EL-M03-S12-004 | link | visible-default | "Semua Darjah", → /topics | FN-M03-4.1.2 |
| EL-M03-S12-005 | link | visible-default | "Darjah 1", → /topics?grade_level=DARJAH_1 | FN-M03-4.1.2 |
| EL-M03-S12-006 | link | visible-default | "Darjah 2", → /topics?grade_level=DARJAH_2 | FN-M03-4.1.2 |
| EL-M03-S12-007 | link | visible-default | "Darjah 3", → /topics?grade_level=DARJAH_3 | FN-M03-4.1.2 |
| EL-M03-S12-008 | link | visible-default | "Darjah 4", → /topics?grade_level=DARJAH_4 | FN-M03-4.1.2 |
| EL-M03-S12-009 | link | visible-default | "Darjah 5", → /topics?grade_level=DARJAH_5 | FN-M03-4.1.2 |
| EL-M03-S12-010 | link | visible-default | "Darjah 6", → /topics?grade_level=DARJAH_6 | FN-M03-4.1.2 |
| EL-M03-S12-011 | link | visible-default | "Semua Subjek", → /topics | FN-M03-4.1.3 |
| EL-M03-S12-012 | link | visible-default | "MATEMATIK", → /topics?subject=MATEMATIK | FN-M03-4.1.3 |
| EL-M03-S12-013 | link | visible-default | "BAHASA MELAYU", → /topics?subject=BAHASA_MELAYU | FN-M03-4.1.3 |
| EL-M03-S12-014 | link | visible-default | "BAHASA INGGERIS", → /topics?subject=BAHASA_INGGERIS | FN-M03-4.1.3 |
| EL-M03-S12-015 | link | visible-default | "SAINS", → /topics?subject=SAINS | FN-M03-4.1.3 |
| EL-M03-S12-016 | link | visible-default | "PENDIDIKAN ISLAM", → /topics?subject=PENDIDIKAN_ISLAM | FN-M03-4.1.3 |
| EL-M03-S12-017 | link | visible-default | "PENDIDIKAN MORAL", → /topics?subject=PENDIDIKAN_MORAL | FN-M03-4.1.3 |
| EL-M03-S12-018 | link | visible-default | "SEJARAH", → /topics?subject=SEJARAH | FN-M03-4.1.3 |
| EL-M03-S12-019 | link | visible-default | "3 Subtopik Nombor MATEMATIK Belajar nombor 1 hingga 100 Subtopik: Tambah 1-10 Tolak 1-10 K…", → /topics/1, fa-book-open | FN-M03-4.1.4 |
| EL-M03-S12-020 | badge | visible-default | "3 Subtopik" | FN-M03-4.1.4 |
| EL-M03-S12-021 | heading | visible-default | "Nombor" | FN-M03-4.1.4 |
| EL-M03-S12-022 | link | visible-default | "2 Subtopik Huruf BAHASA MELAYU Mengenal huruf A-Z Subtopik: Huruf Besar Huruf Kecil Lihat …", → /topics/3, fa-book-open | FN-M03-4.1.4 |
| EL-M03-S12-023 | badge | visible-default | "2 Subtopik" | FN-M03-4.1.4 |
| EL-M03-S12-024 | heading | visible-default | "Huruf" | FN-M03-4.1.4 |
| EL-M03-S12-025 | link | visible-default | "2 Subtopik Haiwan SAINS Mengenal jenis-jenis haiwan Subtopik: Haiwan Peliharaan Haiwan Lia…", → /topics/4, fa-book-open | FN-M03-4.1.4 |
| EL-M03-S12-026 | badge | visible-default | "2 Subtopik" | FN-M03-4.1.4 |
| EL-M03-S12-027 | heading | visible-default | "Haiwan" | FN-M03-4.1.4 |
| EL-M03-S12-028 | link | visible-default | "2 Subtopik Pendaraban MATEMATIK Sifir 2, 3, 4, 5 Subtopik: Sifir 2 Sifir 3 Lihat Topik", → /topics/6, fa-book-open | FN-M03-4.1.4 |
| EL-M03-S12-029 | badge | visible-default | "2 Subtopik" | FN-M03-4.1.4 |
| EL-M03-S12-030 | heading | visible-default | "Pendaraban" | FN-M03-4.1.4 |
| EL-M03-S12-031 | link | visible-default | "4 Subtopik Nombor Bulat Hingga 100 MATEMATIK Mengenal, membilang dan menulis nombor 1 hing…", → /topics/7, fa-book-open | FN-M03-4.1.4 |
| EL-M03-S12-032 | badge | visible-default | "4 Subtopik" | FN-M03-4.1.4 |
| EL-M03-S12-033 | heading | visible-default | "Nombor Bulat Hingga 100" | FN-M03-4.1.4 |
| EL-M03-S12-034 | link | visible-default | "4 Subtopik Membaca dan Menulis BAHASA MELAYU Mengenal huruf, suku kata dan membaca perkata…", → /topics/10, fa-book-open | FN-M03-4.1.4 |
| EL-M03-S12-035 | badge | visible-default | "4 Subtopik" | FN-M03-4.1.4 |
| EL-M03-S12-036 | heading | visible-default | "Membaca dan Menulis" | FN-M03-4.1.4 |
| EL-M03-S12-037 | link | conditional (state captured @1280 only) | "Semua Darjah", → /topics?subject=SAINS | FN-M03-4.1.2 |
| EL-M03-S12-038 | link | conditional (state captured @1280 only) | "Darjah 1", → /topics?subject=SAINS&grade_level=DARJAH_1 | FN-M03-4.1.2 |
| EL-M03-S12-039 | link | conditional (state captured @1280 only) | "Darjah 2", → /topics?subject=SAINS&grade_level=DARJAH_2 | FN-M03-4.1.2 |
| EL-M03-S12-040 | link | conditional (state captured @1280 only) | "Darjah 3", → /topics?subject=SAINS&grade_level=DARJAH_3 | FN-M03-4.1.2 |
| EL-M03-S12-041 | link | conditional (state captured @1280 only) | "Darjah 4", → /topics?subject=SAINS&grade_level=DARJAH_4 | FN-M03-4.1.2 |
| EL-M03-S12-042 | link | conditional (state captured @1280 only) | "Darjah 5", → /topics?subject=SAINS&grade_level=DARJAH_5 | FN-M03-4.1.2 |
| EL-M03-S12-043 | link | conditional (state captured @1280 only) | "Darjah 6", → /topics?subject=SAINS&grade_level=DARJAH_6 | FN-M03-4.1.2 |
| EL-M03-S12-044 | link | conditional (state captured @1280 only) | "Semua Subjek", → /topics?grade_level=DARJAH_1 | FN-M03-4.1.3 |
| EL-M03-S12-045 | link | conditional (state captured @1280 only) | "MATEMATIK", → /topics?grade_level=DARJAH_1&subject=MATEMATIK | FN-M03-4.1.3 |
| EL-M03-S12-046 | link | conditional (state captured @1280 only) | "BAHASA MELAYU", → /topics?grade_level=DARJAH_1&subject=BAHASA_MELAYU | FN-M03-4.1.3 |
| EL-M03-S12-047 | link | conditional (state captured @1280 only) | "BAHASA INGGERIS", → /topics?grade_level=DARJAH_1&subject=BAHASA_INGGERIS | FN-M03-4.1.3 |
| EL-M03-S12-048 | link | conditional (state captured @1280 only) | "SAINS", → /topics?grade_level=DARJAH_1&subject=SAINS | FN-M03-4.1.3 |
| EL-M03-S12-049 | link | conditional (state captured @1280 only) | "PENDIDIKAN ISLAM", → /topics?grade_level=DARJAH_1&subject=PENDIDIKAN_ISLAM | FN-M03-4.1.3 |
| EL-M03-S12-050 | link | conditional (state captured @1280 only) | "PENDIDIKAN MORAL", → /topics?grade_level=DARJAH_1&subject=PENDIDIKAN_MORAL | FN-M03-4.1.3 |
| EL-M03-S12-051 | link | conditional (state captured @1280 only) | "SEJARAH", → /topics?grade_level=DARJAH_1&subject=SEJARAH | FN-M03-4.1.3 |
| EL-M03-S12-052 | link | conditional (state captured @1280 only) | "3 Subtopik Hidupan SAINS Mengenal haiwan dan tumbuhan di persekitaran Subtopik: Jenis-jeni…", → /topics/13, fa-book-open | FN-M03-4.1.4 |
| EL-M03-S12-053 | heading | conditional (state captured @1280 only) | "Hidupan" | FN-M03-4.1.4 |
| EL-M03-S12-054 | link | conditional (state captured @1280 only) | "1 Subtopik Tumbuhan SAINS Mengenal bahagian-bahagian tumbuhan Subtopik: Bahagian Tumbuhan …", → /topics/5, fa-book-open | FN-M03-4.1.4 |
| EL-M03-S12-055 | badge | conditional (state captured @1280 only) | "1 Subtopik" | FN-M03-4.1.4 |
| EL-M03-S12-056 | heading | conditional (state captured @1280 only) | "Tumbuhan" | FN-M03-4.1.4 |
| EL-M03-S12-057 | link | conditional (state captured @1280 only) | "2 Subtopik Fizikal dan Bahan SAINS Mengenal objek dan sifat bahan Subtopik: Sifat Bahan (K…", → /topics/14, fa-book-open | FN-M03-4.1.4 |
| EL-M03-S12-058 | heading | conditional (state captured @1280 only) | "Fizikal dan Bahan" | FN-M03-4.1.4 |
| EL-M03-S12-059 | link | conditional (state captured @1280 only) | "Semua Subjek", → /topics?grade_level=TINGKATAN_2 | FN-M03-4.1.3 |
| EL-M03-S12-060 | link | conditional (state captured @1280 only) | "MATEMATIK", → /topics?grade_level=TINGKATAN_2&subject=MATEMATIK | FN-M03-4.1.3 |
| EL-M03-S12-061 | link | conditional (state captured @1280 only) | "BAHASA MELAYU", → /topics?grade_level=TINGKATAN_2&subject=BAHASA_MELAYU | FN-M03-4.1.3 |
| EL-M03-S12-062 | link | conditional (state captured @1280 only) | "BAHASA INGGERIS", → /topics?grade_level=TINGKATAN_2&subject=BAHASA_INGGERIS | FN-M03-4.1.3 |
| EL-M03-S12-063 | link | conditional (state captured @1280 only) | "SAINS", → /topics?grade_level=TINGKATAN_2&subject=SAINS | FN-M03-4.1.3 |
| EL-M03-S12-064 | link | conditional (state captured @1280 only) | "PENDIDIKAN ISLAM", → /topics?grade_level=TINGKATAN_2&subject=PENDIDIKAN_ISLAM | FN-M03-4.1.3 |
| EL-M03-S12-065 | link | conditional (state captured @1280 only) | "PENDIDIKAN MORAL", → /topics?grade_level=TINGKATAN_2&subject=PENDIDIKAN_MORAL | FN-M03-4.1.3 |
| EL-M03-S12-066 | link | conditional (state captured @1280 only) | "SEJARAH", → /topics?grade_level=TINGKATAN_2&subject=SEJARAH | FN-M03-4.1.3 |
| EL-M03-S12-067 | empty-state | conditional (state captured @1280 only) | "Tiada topik tersedia buat masa ini." | FN-M03-4.1.5 |
| EL-M03-S12-068 | link | conditional (state captured @1280 only) | "4 Subtopik Phonics and Vocabulary BAHASA INGGERIS Learn basic phonics and everyday vocabul…", → /topics/12, fa-book-open | FN-M03-4.1.4 |
| EL-M03-S12-069 | badge | conditional (state captured @1280 only) | "4 Subtopik" | FN-M03-4.1.4 |
| EL-M03-S12-070 | heading | conditional (state captured @1280 only) | "Phonics and Vocabulary" | FN-M03-4.1.4 |
| EL-M03-S12-071 | link | conditional (state captured @1280 only) | "Semua Subjek", → /topics?grade_level=TINGKATAN_4 | FN-M03-4.1.3 |
| EL-M03-S12-072 | link | conditional (state captured @1280 only) | "MATEMATIK", → /topics?grade_level=TINGKATAN_4&subject=MATEMATIK | FN-M03-4.1.3 |
| EL-M03-S12-073 | link | conditional (state captured @1280 only) | "BAHASA MELAYU", → /topics?grade_level=TINGKATAN_4&subject=BAHASA_MELAYU | FN-M03-4.1.3 |
| EL-M03-S12-074 | link | conditional (state captured @1280 only) | "BAHASA INGGERIS", → /topics?grade_level=TINGKATAN_4&subject=BAHASA_INGGERIS | FN-M03-4.1.3 |
| EL-M03-S12-075 | link | conditional (state captured @1280 only) | "SAINS", → /topics?grade_level=TINGKATAN_4&subject=SAINS | FN-M03-4.1.3 |
| EL-M03-S12-076 | link | conditional (state captured @1280 only) | "PENDIDIKAN ISLAM", → /topics?grade_level=TINGKATAN_4&subject=PENDIDIKAN_ISLAM | FN-M03-4.1.3 |
| EL-M03-S12-077 | link | conditional (state captured @1280 only) | "PENDIDIKAN MORAL", → /topics?grade_level=TINGKATAN_4&subject=PENDIDIKAN_MORAL | FN-M03-4.1.3 |
| EL-M03-S12-078 | link | conditional (state captured @1280 only) | "SEJARAH", → /topics?grade_level=TINGKATAN_4&subject=SEJARAH | FN-M03-4.1.3 |
| EL-M03-S12-079 | link | conditional (state captured @1280 only) | "2 Subtopik Kemahiran Bahasa Tingkatan 4 BAHASA MELAYU Subtopik: Penulisan karangan lanjuta…", → /topics/67, fa-book-open | FN-M03-4.1.4 |
| EL-M03-S12-080 | heading | conditional (state captured @1280 only) | "Kemahiran Bahasa Tingkatan 4" | FN-M03-4.1.4 |
| EL-M03-S12-081 | link | conditional (state captured @1280 only) | "1 Subtopik Geografi Tingkatan 4 GEOGRAFI Subtopik: Geografi fizikal lanjutan Lihat Topik", → /topics/73, fa-book-open | FN-M03-4.1.4 |
| EL-M03-S12-082 | heading | conditional (state captured @1280 only) | "Geografi Tingkatan 4" | FN-M03-4.1.4 |
| EL-M03-S12-083 | link | conditional (state captured @1280 only) | "2 Subtopik Fungsi dan Persamaan Kuadratik MATEMATIK Subtopik: Fungsi Persamaan kuadratik L…", → /topics/86, fa-book-open | FN-M03-4.1.4 |
| EL-M03-S12-084 | heading | conditional (state captured @1280 only) | "Fungsi dan Persamaan Kuadratik" | FN-M03-4.1.4 |
| EL-M03-S12-085 | link | conditional (state captured @1280 only) | "1 Subtopik Pendidikan Moral Tingkatan 4 PENDIDIKAN MORAL Subtopik: Nilai-nilai universal L…", → /topics/94, fa-book-open | FN-M03-4.1.4 |
| EL-M03-S12-086 | badge | conditional (state captured @1280 only) | "1 Subtopik" | FN-M03-4.1.4 |
| EL-M03-S12-087 | heading | conditional (state captured @1280 only) | "Pendidikan Moral Tingkatan 4" | FN-M03-4.1.4 |
| EL-M03-S12-088 | link | conditional (state captured @1280 only) | "3 Subtopik Alat pemadam api SAINS Subtopik: Peralatan perlindungan diri Pelupusan bahan bu…", → /topics/100, fa-book-open | FN-M03-4.1.4 |
| EL-M03-S12-089 | heading | conditional (state captured @1280 only) | "Alat pemadam api" | FN-M03-4.1.4 |
| EL-M03-S12-090 | link | conditional (state captured @1280 only) | "2 Subtopik Sejarah Tingkatan 4 SEJARAH Subtopik: Kemunculan tamadun awal Penjajahan dan pe…", → /topics/125, fa-book-open | FN-M03-4.1.4 |
| EL-M03-S12-091 | heading | conditional (state captured @1280 only) | "Sejarah Tingkatan 4" | FN-M03-4.1.4 |
| EL-M03-S12-092 | link | conditional (state captured @1280 only) | "Semua Darjah", → /topics?subject=GEOGRAFI | FN-M03-4.1.2 |
| EL-M03-S12-093 | link | conditional (state captured @1280 only) | "Darjah 1", → /topics?subject=GEOGRAFI&grade_level=DARJAH_1 | FN-M03-4.1.2 |
| EL-M03-S12-094 | link | conditional (state captured @1280 only) | "Darjah 2", → /topics?subject=GEOGRAFI&grade_level=DARJAH_2 | FN-M03-4.1.2 |
| EL-M03-S12-095 | link | conditional (state captured @1280 only) | "Darjah 3", → /topics?subject=GEOGRAFI&grade_level=DARJAH_3 | FN-M03-4.1.2 |
| EL-M03-S12-096 | link | conditional (state captured @1280 only) | "Darjah 4", → /topics?subject=GEOGRAFI&grade_level=DARJAH_4 | FN-M03-4.1.2 |
| EL-M03-S12-097 | link | conditional (state captured @1280 only) | "Darjah 5", → /topics?subject=GEOGRAFI&grade_level=DARJAH_5 | FN-M03-4.1.2 |
| EL-M03-S12-098 | link | conditional (state captured @1280 only) | "Darjah 6", → /topics?subject=GEOGRAFI&grade_level=DARJAH_6 | FN-M03-4.1.2 |
| EL-M03-S12-099 | link | conditional (state captured @1280 only) | "2 Subtopik Kemahiran Geografi GEOGRAFI Subtopik: Peta dan skala Koordinat dan grid Lihat T…", → /topics/69, fa-book-open | FN-M03-4.1.4 |
| EL-M03-S12-100 | heading | conditional (state captured @1280 only) | "Kemahiran Geografi" | FN-M03-4.1.4 |
| EL-M03-S12-101 | link | conditional (state captured @1280 only) | "2 Subtopik Bentuk Muka Bumi GEOGRAFI Subtopik: Bumi dan pembentukan muka bumi Tanah tinggi…", → /topics/70, fa-book-open | FN-M03-4.1.4 |
| EL-M03-S12-102 | heading | conditional (state captured @1280 only) | "Bentuk Muka Bumi" | FN-M03-4.1.4 |
| EL-M03-S12-103 | link | conditional (state captured @1280 only) | "2 Subtopik Cuaca dan Iklim GEOGRAFI Subtopik: Unsur cuaca Iklim Malaysia Lihat Topik", → /topics/71, fa-book-open | FN-M03-4.1.4 |
| EL-M03-S12-104 | heading | conditional (state captured @1280 only) | "Cuaca dan Iklim" | FN-M03-4.1.4 |
| EL-M03-S12-105 | link | conditional (state captured @1280 only) | "2 Subtopik Sumber dan Kelestarian GEOGRAFI Subtopik: Sumber asli Kelestarian sumber Lihat …", → /topics/72, fa-book-open | FN-M03-4.1.4 |
| EL-M03-S12-106 | badge | conditional (state captured @1280 only) | "2 Subtopik" | FN-M03-4.1.4 |
| EL-M03-S12-107 | heading | conditional (state captured @1280 only) | "Sumber dan Kelestarian" | FN-M03-4.1.4 |
| EL-M03-S12-108 | link | conditional (state captured @1280 only) | "3 Subtopik Bumi dan Alam Semesta SAINS Mengenal siang, malam, cuaca dan musim Subtopik: Si…", → /topics/25, fa-book-open | FN-M03-4.1.4 |
| EL-M03-S12-109 | badge | conditional (state captured @1280 only) | "3 Subtopik" | FN-M03-4.1.4 |
| EL-M03-S12-110 | heading | conditional (state captured @1280 only) | "Bumi dan Alam Semesta" | FN-M03-4.1.4 |
| EL-M03-S12-111 | link | conditional (state captured @1280 only) | "3 Subtopik Daya dan Tenaga SAINS Mengenal daya tolakan, tarikan dan sumber tenaga Subtopik…", → /topics/34, fa-book-open | FN-M03-4.1.4 |
| EL-M03-S12-112 | badge | conditional (state captured @1280 only) | "3 Subtopik" | FN-M03-4.1.4 |
| EL-M03-S12-113 | heading | conditional (state captured @1280 only) | "Daya dan Tenaga" | FN-M03-4.1.4 |
| EL-M03-S12-114 | link | conditional (state captured @1280 only) | "3 Subtopik Penyiasatan Saintifik SAINS Kaedah saintifik, pemboleh ubah dan eksperimen Subt…", → /topics/43, fa-book-open | FN-M03-4.1.4 |
| EL-M03-S12-115 | badge | conditional (state captured @1280 only) | "3 Subtopik" | FN-M03-4.1.4 |
| EL-M03-S12-116 | heading | conditional (state captured @1280 only) | "Penyiasatan Saintifik" | FN-M03-4.1.4 |
| EL-M03-S12-117 | link | conditional (state captured @1280 only) | "3 Subtopik Sistem dalam Hidupan SAINS Sistem respirasi, pencernaan dan peredaran darah Sub…", → /topics/51, fa-book-open | FN-M03-4.1.4 |
| EL-M03-S12-118 | badge | conditional (state captured @1280 only) | "3 Subtopik" | FN-M03-4.1.4 |
| EL-M03-S12-119 | heading | conditional (state captured @1280 only) | "Sistem dalam Hidupan" | FN-M03-4.1.4 |

#### S13 — `/topics/{id}` (60 elements)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M03-S13-001 | text | hidden-only | "LIVE:", fa-circle | Excluded — tournament banner template (global widget, **owned by M16**) |
| EL-M03-S13-002 | text | hidden-only | "MAIN" | Excluded — tournament banner template (global widget, **owned by M16**) |
| EL-M03-S13-003 | text | hidden-only | "DAFTAR" | Excluded — tournament banner template (global widget, **owned by M16**) |
| EL-M03-S13-004 | link | visible-default | "Kembali ke Senarai Topik", → /topics, fa-arrow-left | FN-M03-4.2.2 |
| EL-M03-S13-005 | heading | visible-default | "Nombor Bulat Hingga 100" | FN-M03-4.2.3 |
| EL-M03-S13-006 | text | visible-default | "MATEMATIK" | FN-M03-4.2.3 |
| EL-M03-S13-007 | text | visible-default | "Mengenal, membilang dan menulis nombor 1 hingga 100" | FN-M03-4.2.3 |
| EL-M03-S13-008 | card | visible-default | "4" | FN-M03-4.2.4 |
| EL-M03-S13-009 | text | visible-default | "4" | FN-M03-4.2.4 |
| EL-M03-S13-010 | text | visible-default | "Subtopik" | FN-M03-4.2.4 |
| EL-M03-S13-011 | card | visible-default | "0" | FN-M03-4.2.4 |
| EL-M03-S13-012 | text | visible-default | "0" | FN-M03-4.2.4 |
| EL-M03-S13-013 | text | visible-default | "Dijawab" | FN-M03-4.2.4 |
| EL-M03-S13-014 | card | visible-default | "0%" | FN-M03-4.2.4 |
| EL-M03-S13-015 | text | visible-default | "0%" | FN-M03-4.2.4 |
| EL-M03-S13-016 | text | visible-default | "Kemajuan" | FN-M03-4.2.4 |
| EL-M03-S13-017 | heading | visible-default | "Subtopik" | FN-M03-4.2.5 |
| EL-M03-S13-018 | card | visible-default | "1" | FN-M03-4.2.5 |
| EL-M03-S13-019 | badge | visible-default | "1" | FN-M03-4.2.5 |
| EL-M03-S13-020 | heading | visible-default | "Membilang 1-20" | FN-M03-4.2.5 |
| EL-M03-S13-021 | badge | visible-default | "Level 1", fa-circle | FN-M03-4.2.5 |
| EL-M03-S13-022 | badge | visible-default | "Level 2", fa-circle | FN-M03-4.2.5 |
| EL-M03-S13-023 | badge | visible-default | "Level 3", fa-circle | FN-M03-4.2.5 |
| EL-M03-S13-024 | text | visible-default | "Kemajuan" | FN-M03-4.2.5 |
| EL-M03-S13-025 | text | visible-default | "0%" | FN-M03-4.2.5 |
| EL-M03-S13-026 | link | visible-default | "Mula Berlatih", → /practice/MATH, fa-play | FN-M03-4.2.6 |
| EL-M03-S13-027 | card | visible-default | "2" | FN-M03-4.2.5 |
| EL-M03-S13-028 | badge | visible-default | "2" | FN-M03-4.2.5 |
| EL-M03-S13-029 | heading | visible-default | "Membilang 21-50" | FN-M03-4.2.5 |
| EL-M03-S13-030 | badge | visible-default | "Level 1", fa-circle | FN-M03-4.2.5 |
| EL-M03-S13-031 | badge | visible-default | "Level 2", fa-circle | FN-M03-4.2.5 |
| EL-M03-S13-032 | badge | visible-default | "Level 3", fa-circle | FN-M03-4.2.5 |
| EL-M03-S13-033 | text | visible-default | "Kemajuan" | FN-M03-4.2.5 |
| EL-M03-S13-034 | text | visible-default | "0%" | FN-M03-4.2.5 |
| EL-M03-S13-035 | link | visible-default | "Mula Berlatih", → /practice/MATH, fa-play | FN-M03-4.2.6 |
| EL-M03-S13-036 | card | visible-default | "3" | FN-M03-4.2.5 |
| EL-M03-S13-037 | badge | visible-default | "3" | FN-M03-4.2.5 |
| EL-M03-S13-038 | heading | visible-default | "Membilang 51-100" | FN-M03-4.2.5 |
| EL-M03-S13-039 | badge | visible-default | "Level 1", fa-circle | FN-M03-4.2.5 |
| EL-M03-S13-040 | badge | visible-default | "Level 2", fa-circle | FN-M03-4.2.5 |
| EL-M03-S13-041 | badge | visible-default | "Level 3", fa-circle | FN-M03-4.2.5 |
| EL-M03-S13-042 | text | visible-default | "Kemajuan" | FN-M03-4.2.5 |
| EL-M03-S13-043 | text | visible-default | "0%" | FN-M03-4.2.5 |
| EL-M03-S13-044 | link | visible-default | "Mula Berlatih", → /practice/MATH, fa-play | FN-M03-4.2.6 |
| EL-M03-S13-045 | card | visible-default | "4" | FN-M03-4.2.5 |
| EL-M03-S13-046 | badge | visible-default | "4" | FN-M03-4.2.5 |
| EL-M03-S13-047 | heading | visible-default | "Menulis Nombor dalam Perkataan" | FN-M03-4.2.5 |
| EL-M03-S13-048 | badge | visible-default | "Level 1", fa-circle | FN-M03-4.2.5 |
| EL-M03-S13-049 | badge | visible-default | "Level 2", fa-circle | FN-M03-4.2.5 |
| EL-M03-S13-050 | badge | visible-default | "Level 3", fa-circle | FN-M03-4.2.5 |
| EL-M03-S13-051 | text | visible-default | "Kemajuan" | FN-M03-4.2.5 |
| EL-M03-S13-052 | text | visible-default | "0%" | FN-M03-4.2.5 |
| EL-M03-S13-053 | link | visible-default | "Mula Berlatih", → /practice/MATH, fa-play | FN-M03-4.2.6 |
| EL-M03-S13-054 | heading | conditional (state captured @1280 only) | "Kemahiran Bahasa Tingkatan 5" | FN-M03-4.2.3 |
| EL-M03-S13-055 | text | conditional (state captured @1280 only) | "BAHASA MELAYU" | FN-M03-4.2.3 |
| EL-M03-S13-056 | text | conditional (state captured @1280 only) | "Kemahiran Bahasa Melayu SPM Tingkatan 5 berdasarkan DSKP KSSM" | FN-M03-4.2.3 |
| EL-M03-S13-057 | card | conditional (state captured @1280 only) | "1" | FN-M03-4.2.5 |
| EL-M03-S13-058 | heading | conditional (state captured @1280 only) | "Kemahiran Bahasa Tingkatan 5" | FN-M03-4.2.5 |
| EL-M03-S13-059 | text | conditional (state captured @1280 only) | "Kemahiran Bahasa Melayu SPM Tingkatan 5 berdasarkan DSKP KSSM" | FN-M03-4.2.5 |
| EL-M03-S13-060 | link | conditional (state captured @1280 only) | "Mula Berlatih", → /practice/BM, fa-play | FN-M03-4.2.6 |

#### S14 — `/peta-belajar` (86 elements)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M03-S14-001 | text | hidden-only | "LIVE:", fa-circle | Excluded — tournament banner template (global widget, **owned by M16**) |
| EL-M03-S14-002 | text | hidden-only | "MAIN" | Excluded — tournament banner template (global widget, **owned by M16**) |
| EL-M03-S14-003 | text | hidden-only | "DAFTAR" | Excluded — tournament banner template (global widget, **owned by M16**) |
| EL-M03-S14-004 | heading | visible-default | "🗺️ Peta Belajar" | FN-M03-5.1.2 |
| EL-M03-S14-005 | text | visible-default | "Terokai perjalanan Matematik — takluki setiap pulau! 🏝️" | FN-M03-5.1.2 |
| EL-M03-S14-006 | text | visible-default (desktop-only) | "0" | FN-M03-5.1.3 |
| EL-M03-S14-007 | text | visible-default (desktop-only) | "/3" | FN-M03-5.1.3 |
| EL-M03-S14-008 | text | visible-default (desktop-only) | "Topik Selesai" | FN-M03-5.1.3 |
| EL-M03-S14-009 | text | visible-default (desktop-only) | "0%" | FN-M03-5.1.3 |
| EL-M03-S14-010 | text | visible-default (desktop-only) | "Kemajuan" | FN-M03-5.1.3 |
| EL-M03-S14-011 | card | visible-default | "Darjah 1" | FN-M03-5.1.4 |
| EL-M03-S14-012 | link | visible-default | "🔢 Matematik", → /peta-belajar?subject=MATEMATIK&grade=DARJAH_4 | FN-M03-5.1.4 |
| EL-M03-S14-013 | link | visible-default | "📝 Bahasa Melayu", → /peta-belajar?subject=BAHASA_MELAYU&grade=DARJAH_4 | FN-M03-5.1.4 |
| EL-M03-S14-014 | link | visible-default | "🇬🇧 Bahasa Inggeris", → /peta-belajar?subject=BAHASA_INGGERIS&grade=DARJAH_4 | FN-M03-5.1.4 |
| EL-M03-S14-015 | link | visible-default | "🔬 Sains", → /peta-belajar?subject=SAINS&grade=DARJAH_4 | FN-M03-5.1.4 |
| EL-M03-S14-016 | link | visible-default | "☪️ Pend. Islam", → /peta-belajar?subject=PENDIDIKAN_ISLAM&grade=DARJAH_4 | FN-M03-5.1.4 |
| EL-M03-S14-017 | link | visible-default | "🤝 Pend. Moral", → /peta-belajar?subject=PENDIDIKAN_MORAL&grade=DARJAH_4 | FN-M03-5.1.4 |
| EL-M03-S14-018 | link | visible-default | "🏛️ Sejarah", → /peta-belajar?subject=SEJARAH&grade=DARJAH_4 | FN-M03-5.1.4 |
| EL-M03-S14-019 | link | visible-default | "🌍 Geografi", → /peta-belajar?subject=GEOGRAFI&grade=DARJAH_4 | FN-M03-5.1.4 |
| EL-M03-S14-020 | link | visible-default | "Darjah 1", → /peta-belajar?subject=MATEMATIK&grade=DARJAH_1 | FN-M03-5.1.5 |
| EL-M03-S14-021 | link | visible-default | "Darjah 2", → /peta-belajar?subject=MATEMATIK&grade=DARJAH_2 | FN-M03-5.1.5 |
| EL-M03-S14-022 | link | visible-default | "Darjah 3", → /peta-belajar?subject=MATEMATIK&grade=DARJAH_3 | FN-M03-5.1.5 |
| EL-M03-S14-023 | link | visible-default | "Darjah 4", → /peta-belajar?subject=MATEMATIK&grade=DARJAH_4 | FN-M03-5.1.5 |
| EL-M03-S14-024 | link | visible-default | "🔢 🎯 BUKA Nombor Hingga 100 000 0% 0 sesi · 0 soalan dijawab", → /practice?topic_id=38 | FN-M03-5.1.6 |
| EL-M03-S14-025 | heading | visible-default | "Nombor Hingga 100 000" | FN-M03-5.1.6 |
| EL-M03-S14-026 | link | visible-default | "🔣 🎯 BUKA Perpuluhan 0% 0 sesi · 0 soalan dijawab", → /practice?topic_id=39 | FN-M03-5.1.6 |
| EL-M03-S14-027 | heading | visible-default | "Perpuluhan" | FN-M03-5.1.6 |
| EL-M03-S14-028 | card | visible-default | "🔒 TERKUNCI" | FN-M03-5.1.7 |
| EL-M03-S14-029 | text | visible-default | "🔒" | FN-M03-5.1.7 |
| EL-M03-S14-030 | text | visible-default | "🔒 TERKUNCI" | FN-M03-5.1.7 |
| EL-M03-S14-031 | heading | visible-default | "Geometri" | FN-M03-5.1.7 |
| EL-M03-S14-032 | text | visible-default | "Selesaikan topik sebelumnya dulu" | FN-M03-5.1.7 |
| EL-M03-S14-033 | text | conditional (state captured @1280 only) | "Terokai perjalanan Bahasa Melayu — takluki setiap pulau! 🏝️" | FN-M03-5.1.2 |
| EL-M03-S14-034 | link | conditional (state captured @1280 only) | "🔢 Matematik", → /peta-belajar?subject=MATEMATIK&grade=DARJAH_2 | FN-M03-5.1.4 |
| EL-M03-S14-035 | link | conditional (state captured @1280 only) | "📝 Bahasa Melayu", → /peta-belajar?subject=BAHASA_MELAYU&grade=DARJAH_2 | FN-M03-5.1.4 |
| EL-M03-S14-036 | link | conditional (state captured @1280 only) | "🇬🇧 Bahasa Inggeris", → /peta-belajar?subject=BAHASA_INGGERIS&grade=DARJAH_2 | FN-M03-5.1.4 |
| EL-M03-S14-037 | link | conditional (state captured @1280 only) | "🔬 Sains", → /peta-belajar?subject=SAINS&grade=DARJAH_2 | FN-M03-5.1.4 |
| EL-M03-S14-038 | link | conditional (state captured @1280 only) | "☪️ Pend. Islam", → /peta-belajar?subject=PENDIDIKAN_ISLAM&grade=DARJAH_2 | FN-M03-5.1.4 |
| EL-M03-S14-039 | link | conditional (state captured @1280 only) | "🤝 Pend. Moral", → /peta-belajar?subject=PENDIDIKAN_MORAL&grade=DARJAH_2 | FN-M03-5.1.4 |
| EL-M03-S14-040 | link | conditional (state captured @1280 only) | "🏛️ Sejarah", → /peta-belajar?subject=SEJARAH&grade=DARJAH_2 | FN-M03-5.1.4 |
| EL-M03-S14-041 | link | conditional (state captured @1280 only) | "🌍 Geografi", → /peta-belajar?subject=GEOGRAFI&grade=DARJAH_2 | FN-M03-5.1.4 |
| EL-M03-S14-042 | link | conditional (state captured @1280 only) | "Darjah 1", → /peta-belajar?subject=BAHASA_MELAYU&grade=DARJAH_1 | FN-M03-5.1.5 |
| EL-M03-S14-043 | link | conditional (state captured @1280 only) | "Darjah 2", → /peta-belajar?subject=BAHASA_MELAYU&grade=DARJAH_2 | FN-M03-5.1.5 |
| EL-M03-S14-044 | link | conditional (state captured @1280 only) | "Darjah 3", → /peta-belajar?subject=BAHASA_MELAYU&grade=DARJAH_3 | FN-M03-5.1.5 |
| EL-M03-S14-045 | link | conditional (state captured @1280 only) | "Darjah 4", → /peta-belajar?subject=BAHASA_MELAYU&grade=DARJAH_4 | FN-M03-5.1.5 |
| EL-M03-S14-046 | link | conditional (state captured @1280 only) | "📝 🎯 BUKA Tatabahasa Asas 0% 0 sesi · 0 soalan dijawab", → /practice?topic_id=22 | FN-M03-5.1.6 |
| EL-M03-S14-047 | heading | conditional (state captured @1280 only) | "Tatabahasa Asas" | FN-M03-5.1.6 |
| EL-M03-S14-048 | link | conditional (state captured @1280 only) | "✍️ 🎯 BUKA Pemahaman dan Penulisan 0% 0 sesi · 0 soalan dijawab", → /practice?topic_id=23 | FN-M03-5.1.6 |
| EL-M03-S14-049 | heading | conditional (state captured @1280 only) | "Pemahaman dan Penulisan" | FN-M03-5.1.6 |
| EL-M03-S14-050 | text | conditional (state captured @1280 only) | "Terokai perjalanan Geografi — takluki setiap pulau! 🏝️" | FN-M03-5.1.2 |
| EL-M03-S14-051 | link | conditional (state captured @1280 only) | "🔢 Matematik", → /peta-belajar?subject=MATEMATIK&grade=DARJAH_1 | FN-M03-5.1.4 |
| EL-M03-S14-052 | link | conditional (state captured @1280 only) | "📝 Bahasa Melayu", → /peta-belajar?subject=BAHASA_MELAYU&grade=DARJAH_1 | FN-M03-5.1.4 |
| EL-M03-S14-053 | link | conditional (state captured @1280 only) | "🇬🇧 Bahasa Inggeris", → /peta-belajar?subject=BAHASA_INGGERIS&grade=DARJAH_1 | FN-M03-5.1.4 |
| EL-M03-S14-054 | link | conditional (state captured @1280 only) | "🔬 Sains", → /peta-belajar?subject=SAINS&grade=DARJAH_1 | FN-M03-5.1.4 |
| EL-M03-S14-055 | link | conditional (state captured @1280 only) | "☪️ Pend. Islam", → /peta-belajar?subject=PENDIDIKAN_ISLAM&grade=DARJAH_1 | FN-M03-5.1.4 |
| EL-M03-S14-056 | link | conditional (state captured @1280 only) | "🤝 Pend. Moral", → /peta-belajar?subject=PENDIDIKAN_MORAL&grade=DARJAH_1 | FN-M03-5.1.4 |
| EL-M03-S14-057 | link | conditional (state captured @1280 only) | "🏛️ Sejarah", → /peta-belajar?subject=SEJARAH&grade=DARJAH_1 | FN-M03-5.1.4 |
| EL-M03-S14-058 | link | conditional (state captured @1280 only) | "🌍 Geografi", → /peta-belajar?subject=GEOGRAFI&grade=DARJAH_1 | FN-M03-5.1.4 |
| EL-M03-S14-059 | link | conditional (state captured @1280 only) | "Darjah 1", → /peta-belajar?subject=GEOGRAFI&grade=DARJAH_1 | FN-M03-5.1.5 |
| EL-M03-S14-060 | link | conditional (state captured @1280 only) | "Darjah 2", → /peta-belajar?subject=GEOGRAFI&grade=DARJAH_2 | FN-M03-5.1.5 |
| EL-M03-S14-061 | link | conditional (state captured @1280 only) | "Darjah 3", → /peta-belajar?subject=GEOGRAFI&grade=DARJAH_3 | FN-M03-5.1.5 |
| EL-M03-S14-062 | link | conditional (state captured @1280 only) | "Darjah 4", → /peta-belajar?subject=GEOGRAFI&grade=DARJAH_4 | FN-M03-5.1.5 |
| EL-M03-S14-063 | card | conditional (state captured @1280 only) | "Tiada Topik Dijumpai" | FN-M03-5.1.10 |
| EL-M03-S14-064 | text | conditional (state captured @1280 only) | "🗺️" | FN-M03-5.1.10 |
| EL-M03-S14-065 | heading | conditional (state captured @1280 only) | "Tiada Topik Dijumpai" | FN-M03-5.1.10 |
| EL-M03-S14-066 | text | conditional (state captured @1280 only) | "Pilih subjek dan darjah yang lain untuk melihat peta belajar" | FN-M03-5.1.10 |
| EL-M03-S14-067 | link | conditional (state captured @1280 only) | "🔢 🎯 BUKA Nombor 0% 0 sesi · 0 soalan dijawab", → /practice?topic_id=1 | FN-M03-5.1.6 |
| EL-M03-S14-068 | heading | conditional (state captured @1280 only) | "Nombor" | FN-M03-5.1.6 |
| EL-M03-S14-069 | link | conditional (state captured @1280 only) | "🔢 🎯 BUKA Nombor Bulat Hingga 100 0% 0 sesi · 0 soalan dijawab", → /practice?topic_id=7 | FN-M03-5.1.6 |
| EL-M03-S14-070 | heading | conditional (state captured @1280 only) | "Nombor Bulat Hingga 100" | FN-M03-5.1.6 |
| EL-M03-S14-071 | heading | conditional (state captured @1280 only) | "Bentuk" | FN-M03-5.1.7 |
| EL-M03-S14-072 | card | conditional (state captured @1280 only) | "🔒 TERKUNCI" | FN-M03-5.1.7 |
| EL-M03-S14-073 | text | conditional (state captured @1280 only) | "🔒" | FN-M03-5.1.7 |
| EL-M03-S14-074 | text | conditional (state captured @1280 only) | "🔒 TERKUNCI" | FN-M03-5.1.7 |
| EL-M03-S14-075 | heading | conditional (state captured @1280 only) | "Operasi Tambah dan Tolak" | FN-M03-5.1.7 |
| EL-M03-S14-076 | text | conditional (state captured @1280 only) | "Selesaikan topik sebelumnya dulu" | FN-M03-5.1.7 |
| EL-M03-S14-077 | card | conditional (state captured @1280 only) | "🔒 TERKUNCI" | FN-M03-5.1.7 |
| EL-M03-S14-078 | text | conditional (state captured @1280 only) | "🔒" | FN-M03-5.1.7 |
| EL-M03-S14-079 | text | conditional (state captured @1280 only) | "🔒 TERKUNCI" | FN-M03-5.1.7 |
| EL-M03-S14-080 | heading | conditional (state captured @1280 only) | "Bentuk dan Ruang" | FN-M03-5.1.7 |
| EL-M03-S14-081 | text | conditional (state captured @1280 only) | "Selesaikan topik sebelumnya dulu" | FN-M03-5.1.7 |
| EL-M03-S14-082 | text | conditional (state captured @1280 only) | "Terokai perjalanan Zzz — takluki setiap pulau! 🏝️" | FN-M03-5.1.2 |
| EL-M03-S14-083 | link | conditional (state captured @1280 only) | "Darjah 1", → /peta-belajar?subject=ZZZ&grade=DARJAH_1 | FN-M03-5.1.5 |
| EL-M03-S14-084 | link | conditional (state captured @1280 only) | "Darjah 2", → /peta-belajar?subject=ZZZ&grade=DARJAH_2 | FN-M03-5.1.5 |
| EL-M03-S14-085 | link | conditional (state captured @1280 only) | "Darjah 3", → /peta-belajar?subject=ZZZ&grade=DARJAH_3 | FN-M03-5.1.5 |
| EL-M03-S14-086 | link | conditional (state captured @1280 only) | "Darjah 4", → /peta-belajar?subject=ZZZ&grade=DARJAH_4 | FN-M03-5.1.5 |


### 6.2 Shell elements (M03-relevant only)

#### SHA — admin panel shell (chrome of S1–S11) — 229 elements, 30 M03-relevant

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M03-SHA-024 | toggle | visible-default (desktop-only) | "Kurikulum", fa-sitemap | FN-M03-6.1.1 |
| EL-M03-SHA-025 | link | visible-default (desktop-only) | "Kurikulum", → /admin/curriculum, fa-sitemap | FN-M03-6.1.1 |
| EL-M03-SHA-026 | link | visible-default (desktop-only) | "Subjek", → /admin/subjects, fa-book | FN-M03-6.1.1 |
| EL-M03-SHA-027 | link | visible-default (desktop-only) | "Tahap Pendidikan", → /admin/education-levels, fa-graduation-cap | FN-M03-6.1.1 |
| EL-M03-SHA-118 | heading | visible-default | "Pengurusan Kurikulum" | FN-M03-1.1.1 |
| EL-M03-SHA-119 | text | visible-default | "Urus struktur kurikulum (Bab → Topik → Subtopik)" | FN-M03-1.1.1 |
| EL-M03-SHA-157 | text | hidden-only | "Kurikulum" | FN-M03-6.1.2 |
| EL-M03-SHA-158 | link | hidden-only | "Kurikulum", → /admin/curriculum, fa-sitemap | FN-M03-6.1.2 |
| EL-M03-SHA-159 | link | hidden-only | "Subjek", → /admin/subjects, fa-book | FN-M03-6.1.2 |
| EL-M03-SHA-160 | link | hidden-only | "Tahap Pendidikan", → /admin/education-levels, fa-graduation-cap | FN-M03-6.1.2 |
| EL-M03-SHA-201 | heading | conditional | "Tambah Bab Baru" | FN-M03-1.2.1 |
| EL-M03-SHA-202 | text | conditional | "Cipta bab baharu dalam kurikulum" | FN-M03-1.2.1 |
| EL-M03-SHA-205 | heading | conditional | "Edit Bab" | FN-M03-1.3.1 |
| EL-M03-SHA-206 | text | conditional | "Kemaskini maklumat bab" | FN-M03-1.3.1 |
| EL-M03-SHA-207 | heading | conditional | "Tambah Topik Baru" | FN-M03-1.4.1 |
| EL-M03-SHA-208 | text | conditional | "Cipta topik baharu dalam bab" | FN-M03-1.4.1 |
| EL-M03-SHA-210 | heading | conditional | "Edit Topik" | FN-M03-1.5.1 |
| EL-M03-SHA-211 | text | conditional | "Kemaskini maklumat topik" | FN-M03-1.5.1 |
| EL-M03-SHA-212 | heading | conditional | "Pengurusan Subjek" | FN-M03-2.1.1 |
| EL-M03-SHA-213 | text | conditional | "Urus subjek pembelajaran dalam sistem" | FN-M03-2.1.1 |
| EL-M03-SHA-217 | heading | conditional | "Tambah Subjek Baru" | FN-M03-2.2.1 |
| EL-M03-SHA-218 | text | conditional | "Cipta subjek pembelajaran baharu" | FN-M03-2.2.1 |
| EL-M03-SHA-219 | heading | conditional | "Edit Subjek" | FN-M03-2.3.1 |
| EL-M03-SHA-220 | text | conditional | "Kemaskini maklumat subjek" | FN-M03-2.3.1 |
| EL-M03-SHA-222 | heading | conditional | "Pengurusan Tahap Pendidikan" | FN-M03-3.1.1 |
| EL-M03-SHA-223 | text | conditional | "Urus tahap pendidikan dalam sistem" | FN-M03-3.1.1 |
| EL-M03-SHA-225 | heading | conditional | "Tambah Tahap Pendidikan" | FN-M03-3.2.1 |
| EL-M03-SHA-226 | text | conditional | "Cipta tahap pendidikan baharu" | FN-M03-3.2.1 |
| EL-M03-SHA-228 | heading | conditional | "Edit Tahap Pendidikan" | FN-M03-3.3.1 |
| EL-M03-SHA-229 | text | conditional | "Kemaskini maklumat tahap pendidikan" | FN-M03-3.3.1 |

Excluded SHA elements (prefix EL-M03-SHA-): 199 elements — IDs 001–023, 028–117, 120–156, 161–200, 203–204, 209, 214–216, 221, 224, 227: **owned by the global shell (docs/discovery/00-global-ui.md) / M23** — logo, section headers (incl. "PENGURUSAN", shared by several groups), every other sidebar group and link (classified per URL in `_crawl.json`), identity block, server-status widget and its tooltips/values (M23), header avatar/logout (M01), footer, mobile bottom nav, and "Lagi" menu items outside the Kurikulum section.

#### SHU — user-portal shell (chrome of S12–S14) — 378 elements, 13 M03-relevant

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M03-SHU-075 | link | visible-default (desktop-only) | "Topik", → /topics, fa-book-open | FN-M03-6.2.1 |
| EL-M03-SHU-076 | link | visible-default (desktop-only) | "Peta Belajar", → /peta-belajar, fa-map | FN-M03-6.2.1 |
| EL-M03-SHU-136 | heading | visible-default | "Topik Pembelajaran" | FN-M03-4.1.1 |
| EL-M03-SHU-137 | text | visible-default | "Terokai semua topik pembelajaran" | FN-M03-4.1.1 |
| EL-M03-SHU-216 | link | hidden-only | "Topik", → /topics, fa-book-open | FN-M03-6.2.2 |
| EL-M03-SHU-217 | link | hidden-only | "Peta Belajar", → /peta-belajar, fa-map | FN-M03-6.2.2 |
| EL-M03-SHU-340 | link | conditional (mobile-only) | "Topik", → /topics, fa-book-open | FN-M03-6.2.3 |
| EL-M03-SHU-373 | heading | conditional | "Nombor Bulat Hingga 100" | FN-M03-4.2.1 |
| EL-M03-SHU-374 | text | conditional | "MATEMATIK" | FN-M03-4.2.1 |
| EL-M03-SHU-375 | heading | conditional (state captured @1280 only) | "Kemahiran Bahasa Tingkatan 5" | FN-M03-4.2.1 |
| EL-M03-SHU-376 | text | conditional (state captured @1280 only) | "BAHASA MELAYU" | FN-M03-4.2.1 |
| EL-M03-SHU-377 | heading | conditional | "Dashboard" | FN-M03-5.1.1 |
| EL-M03-SHU-378 | text | conditional | "Selamat datang kembali" | FN-M03-5.1.1 |

Excluded SHU elements (prefix EL-M03-SHU-): 365 elements — IDs 001–074, 077–135, 138–215, 218–339, 341–372: **owned by the global shell (docs/discovery/00-global-ui.md) / M23** — logo, header coin/points/streak pills, notification bell (M01/M22), avatar/logout (M01), every other sidebar/drawer/bottom-nav link (classified per URL in `_crawl.json`, owned by M05–M26), PWA install prompt, chatbot widget (M22), footer.

---

## 7. Fidelity deviations

These are the **only** intended differences from the live site. Anything not listed here must match the live site (D7, D9, D10). Rule D9 (user, standing, pre-approved): where the live site is broken or contradictory, fix it; where it works, replicate it exactly. D10: accessibility behaviour replicates live, and a deliberate, consistent live limitation is not "broken" (adding options, grades or chips to a working feature is new scope). Each candidate from the discovery defect list (D-1…D-12) was checked against the evidence and the M03 audit.

| ID | Discovery | Category | Live behaviour (evidence) | Rebuild behaviour (specified) | Status |
|---|---|---|---|---|---|
| DV-M03-01 | D-2 | Visual bug (content invisible); contradictory rule | S6 renders the stored `icon` as `<i class="{icon}">` (Font Awesome), but subjects 1–23 store Lucide names (`book-open`, `calculator`, …), 28–29 emoji (🍽, 👗), 30–31 nothing: only rows 24–27 (`fas fa-quran`, `fas fa-mosque`, `fas fa-pen-nib`, `fas fa-scale-balanced`) show a glyph; 27 of 31 tiles are empty (discovery §1.3, `subjects-desktop.png`; confirmed by audit). The form asks for a Font Awesome class while the data uses other formats. | The icon value is resolved by format (SRS BR-05): a bare kebab-case name → the Lucide icon of that name; a Font Awesome class (`fas fa-x`, `fa-x`) → the mapped Lucide icon; an emoji → the emoji as text; empty or unknown → empty tinted tile (as live). All 29 non-empty seed values render. The form field, label "Ikon (Font Awesome)", default "fas fa-book", placeholder and the "Font Awesome" link stay as live (both formats are accepted). | Approved (user rule D9) |
| DV-M03-02 | D-4 | — | S12 has grade chips for Darjah 1–6 only and subject chips without GEOGRAFI. The Tingkatan 1/4/5 and GEOGRAFI topics **are reachable through the UI**: the default list ("Semua Darjah" + "Semua Subjek", also the sidebar "Topik" target) shows all 125 topics, and the filters also work when typed in the URL. The chip set is an incomplete filter, not broken navigation. | Replicate live: the chip set is not extended (D10: adding chips to a working filter is new scope). | **Withdrawn** (audit AUD-M03-07; Delivery Lead decision) |
| DV-M03-03 | D-3 | Layout breakage | S6 table is 983 px inside a 911 px card at 1280: the "TINDAKAN" column is cut off and needs horizontal scrolling (discovery §7). | At ≥1280 px all 10 S6 columns fit the card (the level line wraps; no truncation). Below 1280 px S6 and S9 scroll horizontally inside their card (NFR-RESP-05 b), as live. S9 already fits at 1280 (unchanged). | Approved (user rule D9) |
| DV-M03-04 | D-1 | Wrong label/title | S14's shell header shows "Dashboard" / "Selamat datang kembali" (EL-M03-SHU-377–378), a stale title from another page, while the sidebar item "Peta Belajar" is active. | The header shows "Peta Belajar" with no subtitle (same pattern as M01 DV-13; implemented by the global shell rule DV-SH-03 in `docs/design/shells.md`: title from the current route). Tab title unchanged ("Peta Belajar — PRESTASIPLUS"). | Approved (user rule D9) |
| DV-M03-05 | D-6 (UI part) | Contradictory rule (displayed numbering out of sequence) | S1 lists chapters in stored order, not by number: Matematik D1/D2 "Bab 3, 4, 5, 6, 7, 8, 1, 2", Perniagaan T5 "1, 6, 2, 7, 3, 4, 5", BI T2 "1, 2, 3, 903, 4" (5 trees out of order). Chapters have no order field in the form, so an admin cannot fix the order. | Chapters sort by `chapterNumber` ascending (numeric; chapters without a number last), then creation order. Topics sort by `topicNumber` in natural order ("1" < "1.1" < "1.2" < "2" < "10"; none last), then creation order (SRS BR-08). | Approved (user rule D9) |
| DV-M03-06 | D-7 (+ audit AUD-M03-20) | Unreadable text | (a) S1 below 640 px truncates chapter/topic titles with "…" (10 cut headings on Matematik T4) with no way to read them (`curriculum-tree-mobile.png`). (b) Below 640 px several M03 screens use 8–10 px text: S1 tree `text-[10px]`/`text-[9px]`, S6 headers and pills `text-[9px]`, S12 "SUBTOPIK:" `text-[9px]`, chips `text-[10px]`, S13 badges `text-[9px]` and hero description `text-[11px]`, S14 island lines `text-[10px]`. Master NFR-02 (D10) names text < 12 px as unreadable (broken). | (a) On S1, chapter, topic and subtopic names wrap at every width (no ellipsis). (b) In M03 content inside `main` (not the global shell, which is M23), no text is rendered below 12 px; decorative icons keep their live size (the 8 px ticks, the 6–8 px dots, the chevrons); elements keep their live position, weight and colour, only the size is raised to 12 px where live is smaller. Layout otherwise as live. | Approved (user rule D9; NFR-02 as updated for D10) |
| DV-M03-07 | D-8 | Contradictory behaviour | The S6 subject switch sends the change with no error handling (`active=!active; fetch(…)` with no `.then`/`.catch`: the UI keeps the new state even if the save fails), while the S9 level switch reverts and alerts "Gagal kemaskini status" / "Ralat rangkaian". | The S6 switch behaves exactly like the S9 switch: on a failed save it reverts and alerts "Gagal kemaskini status"; on a network error it reverts and alerts "Ralat rangkaian". | Approved (user rule D9) |
| DV-M03-08 | D-5 (narrowed) | Contradictory rule | S14 offers the "🌍 Geografi" pill, but the map accepts only Darjah 1–4 and the catalogue has Geografi topics only at Tingkatan 1 and 4, so the pill always leads to "Tiada Topik Dijumpai" (offered but never usable). The rest of D-5 is **not** a defect under D10: live deliberately offers Darjah 1–4 only and serves Darjah 4, with the "Darjah 4" chip visibly active, for any other grade (DARJAH_5, TINGKATAN_*, `darjah_2`, invalid) — a consistent, visible limitation that is replicated. | The "🌍 Geografi" pill is not rendered. Everything else on S14 is as live (7 pills, Darjah 1–4 chips, fallback to Darjah 4, default Matematik + Darjah 4). A typed `?subject=GEOGRAFI` behaves as live (empty state, no active pill, subtitle "Geografi"). **Minimal fix chosen:** removing the pill is the smallest change that removes the contradiction; extending the grades (the other way to make the pill usable) is new scope under D10, and keeping it would keep a control that can never work. | Approved (user rule D9; narrowed by Delivery Lead after AUD-M03-06) |
| DV-M03-09 | D-6 (data part) | Data quality (contradictory numbering) | 334 chapters in 11 trees carry import ids as chapter numbers (e.g. Sains Komputer T3 "Bab 902" … "Bab 961", Sains T3 9481…9959, RBT T2 100761…100807); 478 topic numbers repeat inside a chapter, in 102 chapters (e.g. two "Topik 1" in Matematik T4 Bab 1). The forms accept any number and do not check duplicates. | Seed data only (SRS §6.9): in each tree, chapters numbered ≥100 are renumbered consecutively after the highest number below 100, keeping their stored order and names; in each chapter with a repeated topic number, topics are renumbered 1…n in stored order. No new validation is added to the forms (as live: free numbers, duplicates allowed). The repeats partly come from older topics filed under the wrong chapters; renumbering does not move them (as live data). | Approved (user rule D9) |
| DV-M03-10 | New (rebuild measurement) | Layout breakage (horizontal overflow) | S14 /peta-belajar at 320 px: the four Darjah chips (`flex-1` with 12 px side padding) cannot shrink below their text width, so the last chip ends at 323.2 px and the page scrolls horizontally by 3 px (`scrollWidth` 323 vs `clientWidth` 320, measured on the rebuild; the live page at 320 px was not re-measured, live is read-only and its chip row uses the same single-row layout). | The chips use 8 px side padding below 375 px and 12 px from 375 px up, so 375 / 768 / 1280 are unchanged and 320 px has no horizontal scroll (`scrollWidth` 320). Nothing else on S14 changes. | Approved (user rule D9, layout-breakage case) |
| DV-M03-11 | - | Language (BM copy) | `/admin/curriculum/topics/create` without a chapter: Flash "Chapter ID diperlukan." | "ID Bab diperlukan.". | Approved: user decision 2026-10-24 (system audit FB-025) |
| DV-M03-12 | - | Language (BM copy) | Topic detail difficulty chips: "Level 1", "Level 2", "Level 3" | "Tahap 1", "Tahap 2", "Tahap 3". | Approved: user decision 2026-10-24 (system audit FB-025) |

**Candidates evaluated and not deviations** (replicated as live):
- **D-9** "Mula Berlatih" on every subtopic of S13 goes to the same `/practice/{CODE}` page and the "Level 1/2/3" badges are not links (`<span>`). The link works and leads to practice of the topic's subject; nothing on the page promises subtopic-level practice → replicate.
- **D-10** Peta Belajar islands fade in on scroll (opacity 0 until in view, 0.5 s transition, staggered); `pulse-glow` runs continuously. Works in normal use; only a full-page capture/print shows blank islands → replicate exactly, with no reduced-motion handling (live has none; D10).
- **D-11** "Chapter ID diperlukan." mixes English. The message is correct and understandable, reached only by a hand-typed URL → replicate exact copy.
- **D-12** S1 offers every level for every subject and lets an admin build a tree for a pair the subject is not linked to. No live rule forbids it and nothing fails → replicate.
- The /topics chip set (Darjah 1–6, 7 subject codes; DV-M03-02 withdrawn) and case-insensitive filters with no active chip for a non-canonical value.
- Peta Belajar Darjah 1–4 only, with the visible fallback to Darjah 4 (D10).
- The two separate curriculum data sets (admin DSKP tree vs student catalogue) and their different subject codes (`MATH` vs `MATEMATIK`).
- No pagination, search or sorting on S6/S9/S12; no "Aktif" field on create forms and on subject/level forms; S2 accepts a subject–level pair that is not linked.
- Native `confirm()` for deletes; switches change without confirmation; "Batal" on the inline subtopic forms only hides them (typed text persists until reload).
- S7/S8 "Tahap Pendidikan Berkaitan" in a single-column 256 px scroll box; form buttons side by side at every width (they fit at 375 px).
- S6 below 640 px shows "Soalan" as a number only and "Warna" as a swatch only.
- The S14 progress bar highlight is static (the live `shimmer` animation has no keyframes).
- S6/S9 headers and the S7/S10 code fields displayed upper-case (e.g. placeholder "CTH: MATH01"); S12 subject chips upper-case codes; English level names and "Level 1/2/3" badges; machine-generated descriptions ("Auto-created from DSKP SK 1.1 for chapter scale-up.") are data and shown as is.
- S9–S11 pink accent vs S6–S8 indigo.
- `/topics/{id}` back link drops the filters; S13 stat cards stay 3 across on mobile; S14 hero tiles hidden below 768 px (bar remains).
- The green ticks on S12 cards are decorative (not progress).
- The em dash in the S14 tab title ("Peta Belajar — PRESTASIPLUS") vs hyphen elsewhere.
- Accessibility as live (D10): tooltips via `title`, native dialogs, no added ARIA, keyboard or motion handling.

---

## 8. Out of scope

| Item | Owner / reason |
|---|---|
| Practice sessions started from S13/S14 (`/practice/{CODE}`, `/practice?topic_id=`) | M05 (M03 only builds the links). |
| The practice answer log that S13/S14 progress is derived from | M05 (D12). M03 stores no progress; it derives it on read (SRS BR-19). |
| Question bank and per-question subject/level/topic assignment; the "Soalan" counts' source | M04 (M03 shows the counts). |
| Tournament banner on S12–S14 ("LIVE:", "MAIN", "DAFTAR", `/api/tournament/active`) | M16 / global widget. |
| Maintenance screens for the student topic catalogue | None exist on live (§9 OQ-2); catalogue is seed data, read-only in the prototype. |
| Rest of the admin and user shells (other menus, server status, header pills, chatbot, PWA) | Global shell / M23 / M22. |
| Real persistence, cascading deletes in a database, referential integrity with questions | Backend phase (D1). The prototype simulates the user-visible behaviour. |

---

## 9. Open questions

Only questions that cannot be answered by following the live site.

1. **OQ-1 Post-submit results and messages (INFERRED; UNVERIFIED COPY).** No M03 form, delete or switch could be submitted: chapter/topic/subtopic create/update/delete, subject and level create/update/delete, both "Aktif?" switches. Success flash texts, validation messages and the switch responses are placeholders (SRS §8). A validation-failure probe (e.g. submitting S7 with a duplicate code) changes no data but needs the user's permission (same as M01 OQ-1). (Discovery Q-M03-5.)
2. **OQ-2 Student catalogue maintenance (Q-M03-1).** No admin screen edits the 125 legacy topics, their emoji icons or subtopics. Is it seeded only, or edited elsewhere (M04/M05)? The prototype treats it as read-only seed data.
3. **OQ-3 Two data sets (Q-M03-2).** The rebuild keeps the admin tree and the student catalogue separate, as live. Should the future backend join them (e.g. Peta Belajar built from the DSKP tree)? Backend-phase decision; no change for the prototype.
4. **OQ-4 Peta Belajar states and formulas (Q-M03-3; INFERRED).** The `mastered` and `started` islands, their labels and links, the unlock rule beyond "first two open", the mastery threshold, "Topik Selesai" and "Kemajuan" formulas could not be observed (admin has no practice history). The prototype derives progress from the M05 answer log (SRS BR-19: position mapping topic ↔ chapter, 20 correct answers = 100 %) and uses SRS BR-14/BR-15 (mastered at 80 %) and the placeholder labels in SRS §8 (UNVERIFIED COPY).
5. **OQ-5 Default Peta Belajar grade for a real student (Q-M03-4; INFERRED).** Darjah 4 is observed for the admin; the prototype uses Darjah 4 for every user (a student of Darjah 5 or above would get Darjah 4 anyway, because of the observed fallback). Whether a Darjah 1–3 student starts on their own grade is unknown.
6. **OQ-6 Delete rules (Q-M03-6; INFERRED).** Do subject/level/chapter deletes cascade, or are they refused when questions (M04) or chapters exist? The prototype cascades inside M03 and leaves M04 references untouched (SRS BR-10).
7. **OQ-7 Practice codes — closed.** All 8 codes were observed by the audit (AUD-M03-10): BI, SCI, PI, PM, SEJ, GEO in addition to MATH and BM.
8. **OQ-8 Inactive records on the student side (Q-M03-8; INFERRED).** Are inactive subjects/levels/chapters/topics hidden from students and other modules? No inactive records exist on live. The prototype hides them from other modules' selectors only (the student catalogue has no active flag). Whether the S1–S3 selects list inactive subjects is also INFERRED (listed).
9. **OQ-9 Access (INFERRED).** What a guest or a non-admin sees on M03 routes (redirect assumed, as M02 OQ-5); whether teachers/parents see "Topik" and "Peta Belajar".
10. **OQ-10 M04 linkage.** Does a question reference the DSKP tree (chapter/topic ids), the legacy topics, or only subject + level? The "Soalan" counts are settled by D11: they are the M04 queries Q-ACTIVE(subject) / Q-ACTIVE(level) (M04 SRS §4.1) on the M04 question dataset, built to the live per-subject and per-level values (the live 129,389 vs 129,380 totals are reconciled by M04).
11. **OQ-11 Remaining catalogue data gaps (narrowed after audit AUD-M03-18).** The subtopic names of all legacy topics are now known (audit Appendix A), and subtopic descriptions for topics 4, 68, 69 and 103. Still not captured: descriptions of the other subtopics (assumed none), and the emoji of the Darjah 1–4 topics that were only seen locked (e.g. "Bentuk", "Operasi Tambah dan Tolak", "Tumbuhan"); topics above Darjah 4 never appear on the map and need no emoji. Chapter/topic English names and learning standards are also missing from the dataset except the records opened (chapter 91, topic 126).
12. **OQ-12 Out-of-tree chapters (XL3-24).** M17 S10 counts 1,311 chapters, 60 more than the M03 tree (Pendidikan Muzik 56, Pendidikan Syariah Islamiah 3, Sains Rumah Tangga 1). They are modelled as records outside the tree (SRS §6.9, `inTree = false`) that no M03 screen shows. Their levels, titles and live ids were not observed (designed as null / seed ids); why live keeps them outside the tree is unknown.
