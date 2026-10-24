# M04 — Question Bank — User Requirements Specification

## 0. Document control

| Field | Value |
|---|---|
| Document | URS — M04 Question Bank |
| Version | 1.13 |
| Date | 2026-09-25 |
| Status | Approved (G1). v1.2 = cross-module alignment (XL review, D11, D12); fidelity deviations decided under user rule D9 (pre-approved) and D10. |
| Author | product-analyst (agent) |
| Source discovery | [M04-question-bank.md](../../discovery/M04-question-bank.md) (incl. Appendix A exact strings), element inventory [`inventory/M04/`](../../discovery/inventory/M04/) (`S1…S14-*.json`, `SHA-admin-shell.json`, `SHU-user-shell.json`, `_crawl.json`, `_summary.md`), global shell [00-global-ui.md](../../discovery/00-global-ui.md), screenshots `docs/discovery/img/M04/` (50, masked) |
| Companion SRS | [srs/M04-question-bank.md](../srs/M04-question-bank.md) |
| Related | Cross-module review [cross-module-logic-M01-M07.md](../../qa/audit/cross-module-logic-M01-M07.md) (XL-01, 02, 07, 08, 09, 11, 12, 20, 22, 24). [srs/M03-curriculum.md](../srs/M03-curriculum.md) — subjects and levels (integer ids, `isCore`, lookups `GET /api/subjects` and `GET /api/education-levels`); M05/M06 practice (host the report modal); M10 teacher portal (structured create/edit, DSKP API, paper upload). Audit: [M04-audit.md](../../qa/audit/M04-audit.md) |

**Change log**

| Version | Date | Change |
|---|---|---|
| 1.13 | 2026-09-27 | F-25 as-built record: SRS §7.1 built function names, extra named queries, placement decisions, id holes, boot-cost note, XRs to M02 and M10. No requirement change. |
| 1.12 | 2026-09-27 | R2-08: SRS §4.1 adds Q-PKSK-DIFFICULTY (no count change). No requirement change. |
| 1.11 | 2026-09-27 | XL batch 3: Jutawan question store for M16 (FN-M04-6.3.12), analytics inputs for M17/M18 (FN-M04-6.3.13: coverage facet, teacher contributions, import runs, M18 anchors); US-34. |
| 1.10 | 2026-09-26 | Architecture X-11: repository method names aligned in the SRS (`countWhere`, `count(name, …)`, `contributeCells`). No requirement change. |
| 1.9 | 2026-09-26 | XL2-39: two SRS entity notes corrected (`createdBy`, report `source`). No requirement change. |
| 1.8 | 2026-09-26 | Alignment with M10 v1.4: `scriptType` `mixed` added (4 values OBSERVED); generic DSKP SP per subject–level pair (SRS §6.11, §6.13). No requirement change. |
| 1.7 | 2026-09-26 | XL batch 2: teacher and structured write contracts, contribution / teacher-databank / SP-availability queries, report additions (`outdated`, `teacher_databank`), paper types, chapter labels for M11, M10/M11 anchors (new FN-M04-6.3.9–6.3.11, US-33); non-MCQ rows exist in the BM teacher databank (OQ-3, DV-M04-05 updated). |
| 1.6 | 2026-09-25 | XL-39: seed anchors 570006 and 570025 moved to cells with room (SRS §6.11, §6.13); no requirement change. |
| 1.5 | 2026-09-25 | XL round 2: SPM pool = `spmPool` facet (AC-31.1/31.2 wording), runtime question ids from 9,000,001, D1–D4 and difficulty counts modelled (SRS §4.1, §6.13), count wording cites the named queries. |
| 1.4 | 2026-09-25 | Architecture alignment: SRS §6.13 dataset spec and contributed-anchor list (X-7, X-8). No requirement changes. |
| 1.3 | 2026-09-25 | **Cross-module alignment 2.** XL-13 lookup path is M02 `GET /api/schools?all=1`. Admin and student-side counts reconciled as named queries on one dataset (SRS §4.1); new DV-M04-18 (Prinsip Perakaunan approved count); DV-M04-04 and AC-29.3 updated. |
| 1.2 | 2026-09-25 | **Cross-module alignment (XL review; decisions D11, D12).** M04 owns the one question store (objective incl. SPM pool and PKSK rows) and the structured store. XL-01: SPM pool = eligible T4/T5 MCQ view of the store (FN-M04-6.3.6, US-31); eligibility everywhere (FN-6.3.7); "Buka Soalan Sama" served whenever eligible. XL-02: D11 virtual datasets with the live totals (objective 465,278; structured 4,064; master notes 525); fixtures are anchors; seeded totals removed (DV-M04-04 values). XL-07: PKSK fields, `pending` status, exclusion from lists/counts, S3 PKSK rendering (FN-1.5.10, US-32). XL-08: `curriculumChapterId`. XL-09: modal props `source`, `failureText`, `tints` (FN-6.3.8, AC-17.8/17.9). XL-11: one structured store, anchors incl. those cited by M06. XL-12: KBAT 1–6 in data, both live scales documented. XL-20: header titles from the route, no subtitle (DV-M04-02). XL-22: new DV-M04-17 (text below 12px). XL-24: canonical structured paths (SRS §7). Coverage still 1,226/1,226. |
| 1.1 | 2026-09-25 | **Audit round 1 fixes** (`docs/qa/audit/M04-audit.md`, 5 Major / 14 Minor) and D10. AUD-01 bulk alert is dead code (native required bubble). AUD-02 partial DSKP reset replicated (new AC-09.6). AUD-03 new DV-M04-15 (S4 preload). AUD-04 AI error mapping as live. AUD-05 S11 filters/pagers documented; new DV-M04-16 (pagers keep filters); DV-11 narrowed to the stat cards. AUD-06 S1 order. AUD-07 subject cell. AUD-08 missing_source. AUD-09 unknown status. AUD-10 casing, literal backticks, icon badges, link. AUD-11/12 in SRS. AUD-13 keyboard details. AUD-14 S12 button states. AUD-15 DV-14 cause observed. AUD-16 PROPOSED COPY marks; DV-01 reduced to a read-only table. AUD-17 DV-08 one rule. AUD-18 M03 lookups/`isCore` referenced (new FN-M04-6.3.5). AUD-19 in SRS seed. Discovery narrative corrected (marked "corrected after audit"). Coverage still 1,226/1,226. |
| 1.0 | 2026-09-25 | First issue under D7 (fidelity), D8 (proven completeness) and D9 (deviation rule). §3 breakdown and §6 coverage matrix generated by script from the inventory JSON: 1,226/1,226 content elements covered (1,218 mapped to a Function, 8 excluded with reason), 0 unmapped. Deviations DV-M04-01…14 decided under D9 (11 approved fixes, 3 replicate-live). |

**Conventions** (same as M01/M02)
- Quoted UI copy is the exact live text as displayed: Bahasa Melayu, or English where the live site is English (Laravel pager "Showing … results", "Previous"/"Next", compliance/source labels, "Pending"/"Processing", the Master Notes page, "Dismiss", "Download Template", "Published", "Visibiliti: Public"). Where CSS upper-cases text, the displayed form is given (e.g. sidebar "SOALAN", table headers, S3 "Maklumat" labels).
- **OBSERVED** = seen on the live site (walk-through, inventory state or page script). **INFERRED** = the live site does it but it could not be observed read-only (every POST outcome, non-MCQ show/edit, used-question statistics, AI regeneration, import template and history, populated "my reports", flagged notes, image previews). For INFERRED behaviour the most likely live behaviour is specified (Laravel defaults) and no new UX is invented.
- **UNVERIFIED COPY** = text shown after a submit that could not be captured. The prototype uses the placeholder in SRS §8 until verified (§9 OQ-1).
- **DV-M04-nn** = a fidelity deviation decided under rule D9 (§7). Anything not listed there must match live.
- **PROPOSED COPY** = new BM text written for a D9 fix where the live site has no working original (DV-M04-01, 07, 12). It needs the owner's acceptance at G1.
- **D10:** accessibility (ARIA, keyboard, focus, reduced motion) replicates live with no enhancements; a deliberate, consistent live limitation is not "broken"; adding options to a working feature is new scope.
- **SEC-M04-nn** = a risk of the live behaviour, replicated with dummy data and recorded for security-engineer review (SRS §11).
- Personal data: discovery masked every person (`<person>`, `<email>`, `<school>`, `<note>`); this URS quotes structure and UI copy only. Question content is not personal data; short samples are quoted as data, not fixed copy. One dataset code is quoted redacted as `tracking_a_<redacted>_math_20260326`.
- Inventory note: the `_summary.md` headline says 1,286 content elements, but its own per-screen rows and the JSON files hold **1,226** (S1 139, S2 168, S3 62, S4 91, S5 59, S6 96, S7 146, S8 81, S9 45, S10 48, S11 145, S12 88, S13 18, S14 40). This URS covers the 1,226 real IDs; the headline is a discovery typo (reported to the Delivery Lead).

---

## 1. Overview

M04 is the question bank. It has six parts:
1. The **objective bank** ("Soalan"): admin list with summary tiles, 8 filters and bulk actions; create form for 5 question types (MCQ, Betul / Salah, Jawapan Pendek, Isi Tempat Kosong, Esei / Subjektif) with DSKP tagging and an Arabic/Jawi virtual keyboard; detail page with an AI explanation card; an edit form; CSV import; and a quality dashboard.
2. The **structured bank** ("Soalan Berstruktur", SPM Kertas 2): admins list and view only. Create and edit live in the teacher portal (`/guru/soalan-berstruktur/…`, M10).
3. **Question reports**: the report modal on practice pages (S14, hosted by M05/M06), admin triage (S7) and the reporter's own list (S13).
4. **Teacher question papers** ("Kertas Soalan Guru"): files uploaded by teachers (upload is M10) that admins download and track.
5. **Diagram audit** ("Soalan Perlu Gambar Rajah"): questions flagged as needing a diagram; admins upload an image or dismiss the flag.
6. **Master Notes review**: AI "misconception" notes per question with Approve / Regenerate / Clear Flag.

Questions carry: subject and level (M03), optional DSKP Standard Pembelajaran (→ SK → Bidang), difficulty 1–5, language, points, a status (`draft`, `pending_review`, `approved`, `rejected`, `archived`), an active flag, a compliance status, an "AI Verified" flag, a source (type, file, page, set), a quality score and a needs-diagram flag. Structured questions carry a KBAT level (L2–L5) instead of difficulty. Approved, active questions feed M05/M06 practice.

**Store ownership (D12) and datasets (D11).** M04 owns the single question store — objective questions including the SPM practice pool (a filtered view, not a copy) and the PKSK rows that M07 manages — and the single structured-question store. M05, M06 and M07 read and write through M04's store contract (SRS §7.1). Both stores are deterministic virtual datasets that report the live totals (465,278 objective questions excluding 763 PKSK rows; 4,064 structured questions) and generate rows on demand; observed records (and module fixtures such as the M05/M08 practice questions) are anchors inside those totals, not additions to them.

**Routes covered** (`docs/TRACKER.md` §4 M04, plus crawl finds):

| # | Route | Shell header title / subtitle (as specified) | Tab title (exact live) | Layout |
|---|---|---|---|---|
| S1 | `/admin/questions` | "Pengurusan Soalan", no subtitle (DV-M04-02) | "Pengurusan Soalan" | admin |
| S2 | `/admin/questions/create` | "Tambah Soalan Baru", no subtitle (DV-M04-02) | "Tambah Soalan Baru" | admin |
| S3 | `/admin/questions/{id}` | "Detail Soalan", no subtitle (DV-M04-02) | "Lihat Soalan" | admin |
| S4 | `/admin/questions/{id}/edit` | "Edit Soalan", no subtitle (DV-M04-02) | "Edit Soalan" | admin |
| S5 | `/admin/questions/import` | "Import Soalan Secara Pukal" / "Muat naik fail CSV untuk menambah soalan secara pukal" | "Import Soalan" | admin |
| S5h | `/admin/questions/import-history` | "Sejarah Import", no subtitle (DV-M04-01, PROPOSED COPY; live HTTP 500) | "Sejarah Import" (PROPOSED COPY) | admin |
| S6 | `/admin/questions/quality` | "Dashboard Kualiti Soalan" / "Analisa kualiti keseluruhan bank soalan" | "Kualiti Soalan - Admin" | admin |
| S7 | `/admin/question-reports` | "Laporan Soalan", no subtitle (DV-M04-02) | "Laporan Soalan — Admin Panel" | admin |
| S8 | `/admin/structured-questions` | "Soalan Berstruktur", no subtitle (DV-M04-02) | "Soalan Berstruktur" | admin |
| S9 | `/admin/structured-questions/{id}` | "Detail Soalan Berstruktur", no subtitle (DV-M04-02) | "Detail Soalan Berstruktur" | admin |
| S10 | `/admin/question-submissions` | "Kertas Soalan Guru" / "Semak dan proses fail soalan yang dihantar oleh guru" | "Kertas Soalan - Admin" | admin |
| S11 | `/admin/soalan-gambar` | "Soalan Perlu Gambar Rajah" / "Audit soalan yang memerlukan gambar rajah dilengkapkan" | "Soalan Perlu Gambar Rajah - Admin" | admin (not in the admin sidebar, as live) |
| S12 | `/admin/master-notes` | "Master Notes — Admin Review", no subtitle (DV-M04-02) | "Master Notes — Admin Review" | **user portal** (as live) |
| S13 | `/laporan-soalan` | "Laporan Soalan Saya" / "Jejak status laporan soalan yang anda hantar" | "Laporan Soalan Saya" | user portal |
| S14 | modal "Lapor Soalan" on `/spm/latih-tubi/{code}/quiz` (M06) and `/latihan-berstruktur/{id}/jawab` (M05) | (host page) | (host page) | user portal |

Probed and absent on live (404), not added: `/admin/structured-questions/create`, `/{id}/edit`, `/admin/question-reports/{id}`, `/admin/question-submissions/{id}` and `/create`, `/admin/master-notes/{id}`, `/admin/questions/{id}/preview`, `/admin/soalan-gambar/mcq/{id}`, `/admin/questions/quality/details`, `/laporan-soalan/{id}`, `/admin/questions/import/history`. `/admin/questions/import-logs` returns 500 (same cause as the history route, INFERRED); it is not linked anywhere and is not reproduced.

## 2. Actors

| Role | Involvement in M04 | Verified |
|---|---|---|
| Admin | Sole user of S1–S12. Also reaches S12, S13, S10 and S11 from the user-portal sidebar. | Yes (admin account) |
| Pelajar (student) | Reports questions from practice pages (S14) and follows their reports (S13). | Inferred (the admin account rendered both; the modal says "Soalan ini akan dinyahaktifkan…" to the reporter; S7 says reports come "oleh pelajar") |
| Guru (teacher) | Author of structured questions and question papers (M10). Appears as creator ("Dicipta oleh", "oleh", "Soalan Oleh") and as a submitter on S10. Whether teachers can also report questions is INFERRED (same practice pages). "Teacher Approved" on S12 implies teachers approve master notes somewhere (not in M04; §9 OQ-10). | Inferred |
| Guest | Any M04 route redirects to `/login` (M01 FR-M01-14 pattern). | Inferred (pattern observed in M01/M02) |

URS.md §6: no correction needed; the student and teacher rows gain the M04 involvement above.

---

## 3. Functional breakdown (Epic → Feature → Function)

Generated by script from the element inventory (`docs/discovery/inventory/M04/`). "EL" lists inventory element IDs (prefix `EL-M04-`). Functions with EL "—" are behaviours (post-submit results, server rules, lookups, access) with no element of their own.

### EP-M04-1 — Objective question bank administration

**FT-M04-1.1 — Question list** (S1 `/admin/questions`)

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M04-1.1.1 | Page header: h1 "📚 Pengurusan Soalan", subtitle "Urus bank soalan untuk platform PRESTASIPLUS"; button `fa-plus` → `/admin/questions/create` labelled "Tambah Soalan" at ≥640px and "Tambah" below 640px | S1-001–003 | Admin | OBSERVED |
| FN-M04-1.1.2 | Card "Ringkasan Bank Soalan" with "Jumlah: **{n}** soalan" (thousands separator). Value from the single count source (DV-M04-04) | S1-004–007 | Admin | OBSERVED + DV-M04-04 |
| FN-M04-1.1.3 | "Subjek Teras" group (subjects with M03 `isCore` = true): 7 subject tiles (BM, BI, Matematik, Sains, Sejarah, Pendidikan Islam, Pendidikan Moral), each a link to `?subject_id=N` with icon, name cut to about 12 characters + "...", total, and "{n} lulus" (approved count; hidden when 0) | S1-008–015 | Admin | OBSERVED |
| FN-M04-1.1.4 | "Subjek Elektif" group: 22 live tiles (ids 8–18, 21–31, `fa-book` for the four 0-question subjects) plus tiles for Bahasa Cina (19) and Bahasa Tamil (20) in id order (DV-M04-13); Prinsip Perakaunan shows 2,970 lulus (DV-M04-18) | S1-016–038 | Admin | OBSERVED + DV-M04-13, DV-M04-18 |
| FN-M04-1.1.5 | Active tile when `subject_id` is set (indigo border, `bg-indigo-50 shadow-md`; others slate/white) and link `fa-times-circle` "Padam filter subjek — tunjuk semua" → `/admin/questions` | S1-139 | Admin | OBSERVED |
| FN-M04-1.1.6 | Filter form `GET /admin/questions`: "Subjek" (`subject_id`: "Semua Subjek" + 31 subjects in id order) and "Tahap" (`education_level_id`: "Semua Tahap" + Darjah 1–6, Tingkatan 1–5) | S1-039–043 | Admin | OBSERVED |
| FN-M04-1.1.7 | "Kesukaran" (`difficulty_level`: "Semua", "⭐ Sangat Mudah" … "⭐⭐⭐⭐⭐ Sangat Sukar") and "Status" (`status`: "Semua Status", Draf, Menunggu Semakan, Diluluskan, Ditolak, Diarkibkan) | S1-044–047 | Admin | OBSERVED |
| FN-M04-1.1.8 | "DSKP" (`dskp_filter`: Semua, Ada DSKP Tag, Belum Ditag), "Compliance" (`compliance_filter`: Semua, Verified, Pending Mapping, Quarantined, Rejected, Draft, Tiada Source PDF, AI Verified) and "Source" (`source_filter`: Semua, Textbook, DSKP, Trial, Skema) | S1-048–053 | Admin | OBSERVED |
| FN-M04-1.1.9 | "Cari" text input (`search`, placeholder "Cari soalan...") and the icon-only submit button (`fa-search`, no text) | S1-054–056 | Admin | OBSERVED |
| FN-M04-1.1.10 | Bulk bar (shown while ≥1 row is ticked): `fa-check-double` "{n} soalan dipilih", select `action` (`required`; "Pilih Tindakan", Luluskan, Tolak, Arkibkan, Padam) and "Laksanakan"; with no action the native browser required bubble on the select blocks the submit (the script alert "Sila pilih tindakan terlebih dahulu" is unreachable dead code and is never shown); else confirm "Adakah anda pasti mahu {meluluskan\|menolak\|mengarkibkan\|memadamkan} {n} soalan?" then `POST bulk-action` with `ids[]` | S1-057–063 | Admin | OBSERVED (UI) / INFERRED (result) |
| FN-M04-1.1.11 | Table (20 rows/page, newest created first, ties by id ascending — AUD-M04-06), columns [checkbox] "#" "Soalan" "Subjek" "Tahap" "Kesukaran" "Status" "Tindakan" (headers displayed upper case by CSS); header checkbox ticks/unticks every row on the page; row checkboxes bound to the selection | S1-064–067, 078, 089 | Admin | OBSERVED |
| FN-M04-1.1.12 | "Soalan" cell: text cut to 80 characters + "..."; badges icon + text: `fa-check-circle` + "DSKP" (green) or `fa-book-open` + "Latihan Tambahan"; compliance badge in upper case (VERIFIED, QUARANTINED, PENDING MAPPING per DV-M04-08, DRAFT); optional "AI Verified"; small line "Source: {TEXTBOOK\|DSKP\|TRIAL\|MARKING SCHEME\|TIADA}" + source file name | S1-068–070, 079–081, 090–092, 120–123, 125, 127, 129–134 | Admin | OBSERVED + DV-M04-08 |
| FN-M04-1.1.13 | "Subjek" cell: fixed indigo `fa-book` icon + subject name on every row (plain text, no pill, not the subject's own icon), "Tahap" text, "Kesukaran" 5 `fa-star` (first N filled), "Status" pill ("Diluluskan"; "Arkib" for archived) with "ACTIVE"/"INACTIVE" under it | S1-071, 082, 093, 124, 126, 128 | Admin | OBSERVED |
| FN-M04-1.1.14 | Row actions `fa-eye` (title "Lihat") → `/admin/questions/{id}` and `fa-edit` (title "Edit") → `/admin/questions/{id}/edit` | S1-072–073, 083–084, 094–095 | Admin | OBSERVED |
| FN-M04-1.1.15 | Row delete `fa-trash` (title "Padam"): confirm "Adakah anda pasti mahu memadamkan soalan ini?" → `DELETE /admin/questions/{id}` | S1-074–077, 085–088, 096–099 | Admin | OBSERVED (UI) / INFERRED (result) |
| FN-M04-1.1.16 | Pagination ≥640px (Laravel, English): "Showing {from} to {to} of {total} results", window 1–10 … last two, chevrons (aria "&laquo; Previous" / "Next &raquo;", "Go to page {n}"); links keep active filters; fits the viewport at 768 (DV-M04-09) | S1-102–119, 136 | Admin | OBSERVED + DV-M04-09 |
| FN-M04-1.1.17 | Pagination <640px: "« Previous" / "Next »" (plain text when unavailable) | S1-100–101, 135 | Admin | OBSERVED |
| FN-M04-1.1.18 | Empty state (table not rendered): `fa-inbox` icon, "Tiada soalan dijumpai", text link (indigo) `fa-plus` "Tambah Soalan Pertama" → create | S1-137–138 | Admin | OBSERVED |
| FN-M04-1.1.19 | Filter semantics: all filters combine (AND); `search` matches part of the question text; unknown params (`type`, `question_type`, `sort`) ignored; no type, sort or KBAT filter; PKSK rows (`pkskDomainId` set) never appear in the list, search, filters, tiles or totals (a PKSK text search returns "Tiada soalan dijumpai") | — | Admin | OBSERVED (results) / INFERRED (search field) |
| FN-M04-1.1.20 | Bulk-action and delete results: list reloads (filters kept) with a flash message; approve → `approved`, reject → `rejected`, archive → `archived`, delete → removed | — | Admin | INFERRED (UNVERIFIED COPY) |

**FT-M04-1.2 — Create question** (S2 `/admin/questions/create`)

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M04-1.2.1 | Back link `fa-arrow-left` → list, h1 "✨ Tambah Soalan Baru", subtitle "Isi maklumat di bawah untuk menambah soalan baharu" | S2-001–003 | Admin | OBSERVED |
| FN-M04-1.2.2 | Form `POST /admin/questions` (multipart); card "Maklumat Soalan" (`fa-question-circle`); "Subjek *" (required, "Pilih Subjek" + 31) and "Tahap Pendidikan *" (required, "Pilih Tahap Pendidikan" + 11) | S2-004–011 | Admin | OBSERVED |
| FN-M04-1.2.3 | "Tahap Kesukaran *": 5 radio cards 1 "Sangat Mudah" (1 star) … 5 "Sangat Sukar" (5 stars), required, no default | S2-020–030 | Admin | OBSERVED |
| FN-M04-1.2.4 | "Jenis Soalan *" select (`question_type`, default `mcq`): Objektif (MCQ), Betul / Salah, Jawapan Pendek, Isi Tempat Kosong, Esei / Subjektif; switches the answer card | S2-031–032 | Admin | OBSERVED |
| FN-M04-1.2.5 | "Teks Soalan *" textarea (4 rows, required, placeholder "Masukkan teks soalan di sini...") and hint "Minimum 10 aksara" | S2-033–034, 036 | Admin | OBSERVED |
| FN-M04-1.2.6 | `fa-image` "Gambar Soalan (Pilihan)": drop-zone label `fa-cloud-upload-alt` "Klik untuk muat naik gambar" / "JPG, PNG, WebP — Maks 2MB" (accept jpeg/png/webp); after choosing, a preview image with a remove button (`fa-times`) that clears the input | S2-037–041 | Admin | OBSERVED (markup) / INFERRED (preview state) |
| FN-M04-1.2.7 | MCQ card "Pilihan Jawapan" (`fa-list-check`; only for `mcq`): exactly 4 rows A–D, each radio `correct_answer` 0–3 (A checked by default), "Pilihan A *"…"Pilihan D *", text `options[]` ("Masukkan pilihan A"…"D"), image picker `fa-image` "Gambar" (`option_images[0..3]`, preview + remove); no add/remove; info `fa-info-circle` "**Nota:** Pilih butang radio di sebelah pilihan yang merupakan jawapan yang betul."; options and radio required only for MCQ | S2-042–073 | Admin | OBSERVED |
| FN-M04-1.2.8 | True/false card "Jawapan Betul / Salah" (`fa-check-double`): radio cards "Betul" (`true`, `fa-check-circle`) and "Salah" (`false`, `fa-times-circle`); no default, not required | S2-074–079 | Admin | OBSERVED |
| FN-M04-1.2.9 | Short-answer / fill-blank card (`fa-pen-fancy`), heading "Jawapan Pendek" or "Jawapan Isi Tempat Kosong": "Jawapan Betul *" (`correct_answer_text`, "Masukkan jawapan betul", no `required` in the DOM), "Jawapan Alternatif (pisahkan dengan koma)" (`alt_answers`, "cth: jawapan1, jawapan2") + hint "Jawapan lain yang juga diterima" | S2-080–086, 168 | Admin | OBSERVED |
| FN-M04-1.2.10 | Essay card "Jawapan Contoh (Esei)" (`fa-file-alt`): "Jawapan Model (pilihan — ditunjukkan sebagai rujukan)" textarea `model_answer` (6 rows, "Tulis jawapan contoh di sini...") | S2-087–090 | Admin | OBSERVED |
| FN-M04-1.2.11 | Card "Maklumat Tambahan" (`fa-info-circle`): "Penjelasan" (3 rows, "Penjelasan untuk jawapan (pilihan)", hint "Penjelasan akan ditunjukkan kepada pelajar selepas menjawab"), "Bahasa" (`bm` Bahasa Melayu selected, `en` English), "Nilai Mata" (number, value 1, min 1, hint "Mata yang diperoleh jika jawapan betul") | S2-091–100 | Admin | OBSERVED |
| FN-M04-1.2.12 | Actions: link `fa-times` "Batal" → `/admin/questions`; submit `fa-save` "Simpan Soalan" | S2-101–102 | Admin | OBSERVED |
| FN-M04-1.2.13 | Submit result: success → list (or detail) with a flash; validation errors → form with errors and old input; status of the new question INFERRED `approved` (OQ-2) | — | Admin | INFERRED (UNVERIFIED COPY) |

**FT-M04-1.3 — Arabic / Jawi virtual keyboard** (S2 `/admin/questions/create` (question text only))

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M04-1.3.1 | Toggle button `.vkb-toggle-btn` (36×36px, `fa-keyboard`, title "Papan kekunci Arab / Jawi") inside the bottom-left of the "Teks Soalan" textarea; it opens the panel, closes it when open, and shows a blue active state while the panel is open | S2-035 | Admin | OBSERVED |
| FN-M04-1.3.2 | Panel: mode buttons "عربي" (blue when active) and "جاوي" (emerald when active), caption "Papan Kekunci Arab" / "Papan Kekunci Jawi", close `fa-times` (32×32px) | S2-103, 105–109 | Admin | OBSERVED |
| FN-M04-1.3.3 | Letter rows. Arab: ض ص ث ق ف غ ع ه خ ح ج د / ش س ي ب ل ا ت ن م ك ط / ئ ء ؤ ر لا ى و ز ظ. Jawi inserts its letters inside the rows: row 1 ض ص ث ق ف ڤ غ ڠ ع ه خ ح چ ج د, row 2 ش س ي ب ل ا ت ن ڽ م ك ݢ ط, row 3 ئ ء ؤ ر لا ى و ۏ ز ظ | S2-110–145, 162–167 | Admin | OBSERVED |
| FN-M04-1.3.4 | Harakat row (◌ + mark, title = name): Fathah (atas), Kasrah (bawah), Dammah, Sukun, Tanwin Fathah, Tanwin Kasrah, Tanwin Dammah, Shadda (sabdu), Superscript Alif (alif kecil) | S2-146–155 | Admin | OBSERVED |
| FN-M04-1.3.5 | Bottom row: "SPACE", "ال", "ة", backspace (`fa-delete-left`), newline (`fa-turn-down`) | S2-156–160 | Admin | OBSERVED |
| FN-M04-1.3.6 | Below 640px the panel is a bottom sheet over a backdrop that closes it on tap | S2-104 | Admin | OBSERVED |
| FN-M04-1.3.7 | Behaviour: keys insert at the cursor (focus stays in the textarea); opening sets the textarea `dir="rtl"` and font "Scheherazade New", "Lateef", serif; Esc closes; `dir="rtl"` and the font stay on the textarea after closing; keys are 44px touch targets; at ≥640px a 580px panel below the textarea, placed above it when `rect.bottom + 8 + 360 > innerHeight`, and clamped horizontally inside the viewport (8px / 12px margins) | — | Admin | OBSERVED (script) |

**FT-M04-1.4 — DSKP tagging (cascading selects)** (S2 and S4)

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M04-1.4.1 | `fa-tags` "DSKP Tagging (Pilihan)" and "Bidang" select (no name): loads when both Subjek and Tahap are set (`GET dskp/bidang?subject_id&education_level_id`), options "-- Pilih Bidang --" + "{code} - {name}" (name only when no code). Setting both (again) resets Bidang/SK/SP and their lists; clearing Subjek or Tahap only empties the Bidang list — SK and SP keep their values, options and enabled state, "DSKP tagged" stays and the old `dskp_sp_id` is still posted (as live, AUD-M04-02) | S2-012–014; S4-013–015 | Admin | OBSERVED |
| FN-M04-1.4.2 | "Standard Kandungan" select: disabled until a Bidang is chosen; "-- Pilih SK --" + "{code} - {description}" from `dskp/sk?dskp_bidang_id` | S2-015–016; S4-016–017 | Admin | OBSERVED |
| FN-M04-1.4.3 | "Standard Pembelajaran" select (`dskp_sp_id`): disabled until an SK is chosen; "-- Pilih SP --" + "{code} - {description}" from `dskp/sp?dskp_sk_id`; when an SP is chosen `fa-check-circle` "DSKP tagged" shows | S2-017–019, 161; S4-018–021 | Admin | OBSERVED |
| FN-M04-1.4.4 | Edit version: the saved Bidang/SK/SP are shown selected and the saved SP is posted (DV-M04-15; live loads the ids and lists but all three selects display their placeholders and `dskp_sp_id` posts "", so saving drops the tag); a saved id not in the new parent list is cleared; changing Subjek or Tahap reloads Bidang | — | Admin | OBSERVED (script) + DV-M04-15 |
| FN-M04-1.4.5 | Button `fa-times` "Buang tag DSKP" (edit only) resets Bidang, SK and SP; shown whenever a Bidang is selected (DV-M04-06; live shows it only after the SP was cleared) | S4-022, 091 | Admin | OBSERVED + DV-M04-06 |

**FT-M04-1.5 — Question detail** (S3 `/admin/questions/{id}`)

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M04-1.5.1 | Back link → list, h1 "📝 Detail Soalan", "Soalan #{id}"; `fa-edit` "Edit" → edit; `fa-trash` "Padam" with confirm "Adakah anda pasti mahu memadamkan soalan ini?" → `DELETE` | S3-001–008 | Admin | OBSERVED (UI) / INFERRED (result) |
| FN-M04-1.5.2 | Card "Soalan" (`fa-question-circle`) with status pill ("Diluluskan"; archived "Diarkibkan") and the full question text | S3-009–012, 053–054 | Admin | OBSERVED |
| FN-M04-1.5.3 | Card "Pilihan Jawapan" (`fa-list-check`): letter bubbles A–D + option text; the correct option green-tinted with `fa-check-circle` "Jawapan Betul" | S3-013–023, 055–058 | Admin | OBSERVED |
| FN-M04-1.5.4 | Card "Penjelasan" (`fa-lightbulb`), only when an explanation exists | S3-024–026 | Admin | OBSERVED |
| FN-M04-1.5.5 | Sidebar card "Maklumat" (labels displayed upper case): Subjek (`fa-book`), Tahap Pendidikan (`fa-graduation-cap`), Tahap Kesukaran (5 stars + "(n/5)"), DSKP (three truncated lines `fa-layer-group` Bidang, `fa-bookmark` SK, `fa-tag` SP; untagged "Belum ditag"), Bahasa (`fa-language`), Nilai Mata (`fa-coins`, "{n} mata"), Dicipta Pada (`fa-calendar`, `dd/mm/yyyy HH:MM`) | S3-033–050, 059–062 | Admin | OBSERVED |
| FN-M04-1.5.6 | Usage card for an unused question: `fa-info-circle` "Soalan Baharu" / "Soalan ini belum digunakan dalam sebarang kuiz atau latihan." | S3-051–052 | Admin | OBSERVED |
| FN-M04-1.5.7 | Usage-statistics variant for a used question (attempts etc.) | — | Admin | INFERRED (UNVERIFIED COPY) |
| FN-M04-1.5.8 | Status quick actions: script `updateStatus(status)` confirms "Adakah anda pasti mahu mengubah status soalan ini?" then posts `bulk-action` with `pending_review` or `approve`; buttons render only for draft/pending questions | — | Admin | OBSERVED (script) / INFERRED (buttons) |
| FN-M04-1.5.9 | Rendering of non-MCQ questions (true/false, short answer, fill blank, essay) on the detail page | — | Admin | INFERRED |
| FN-M04-1.5.10 | PKSK question (`pkskDomainId` set) on S3: the question text and its PKSK options (0–6; every correct option marked `fa-check-circle` "Jawapan Betul"; no options card when there are none); "Subjek" and "Tahap Pendidikan" show "-" (INFERRED) | — | Admin | OBSERVED (text and options shown, M07 discovery) / INFERRED (layout) |

**FT-M04-1.6 — AI explanation (Penjelasan AI)** (S3 `/admin/questions/{id}`)

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M04-1.6.1 | Card "Penjelasan AI" (`fa-robot`, id `penjelasan-ai-card`), sub-label "Dijana AI · Boleh ada kesilapan, sahkan dengan cikgu"; empty state "Belum ada Penjelasan AI untuk soalan ini. Klik butang untuk jana." + button `fa-wand-magic-sparkles` "Jana Penjelasan AI" | S3-027–030 | Admin | OBSERVED |
| FN-M04-1.6.2 | Loading: `fa-spinner fa-spin` "Sedang menjana penjelasan... (anggaran 5-15 saat)" | S3-031 | Admin | OBSERVED (markup) |
| FN-M04-1.6.3 | Error: `fa-exclamation-triangle` + message: JSON reply with `message` → that message; JSON reply not ok without `message` (incl. HTTP 200 `{ok:false}`) → "HTTP {status}"; non-JSON reply → the browser JSON-parse exception text; network failure → "Failed to fetch"; "Gagal jana penjelasan" only for an empty exception message (practically never); the element's default text is "Ralat tidak diketahui"; the empty state (text and "Jana Penjelasan AI") is shown again beside the error box | S3-032 | Admin | OBSERVED (script) |
| FN-M04-1.6.4 | `POST generate-penjelasan-ai` → on `{ok:true}` the page reloads and the saved markdown renders (headings, lists, tables, code); simulated with canned text (D4) | — | Admin | OBSERVED (script) / INFERRED (content) |
| FN-M04-1.6.5 | Regenerate button (when a note exists) with confirm "Jana semula Penjelasan AI? Versi lama akan ditimpa." → `?force=1` | — | Admin | OBSERVED (script) / INFERRED (button) |

**FT-M04-1.7 — Edit question** (S4 `/admin/questions/{id}/edit`)

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M04-1.7.1 | Back link → detail, h1 "✏️ Edit Soalan", "Kemaskini maklumat soalan #{id}" | S4-001–003 | Admin | OBSERVED |
| FN-M04-1.7.2 | Form `PUT /admin/questions/{id}` (multipart), card "Maklumat Soalan", "Subjek *" and "Tahap Pendidikan *" pre-filled; no "Jenis Soalan" select | S4-004–012 | Admin | OBSERVED |
| FN-M04-1.7.3 | "Tahap Kesukaran *" radio cards with the saved value selected | S4-023–033 | Admin | OBSERVED |
| FN-M04-1.7.4 | "Teks Soalan *" (pre-filled) + "Minimum 10 aksara"; no virtual keyboard | S4-034–036 | Admin | OBSERVED |
| FN-M04-1.7.5 | Question image: zone text "Tukar gambar" when a preview exists else "Klik untuk muat naik gambar"; remove sets hidden `remove_question_image` = 1 | S4-037–042 | Admin | OBSERVED |
| FN-M04-1.7.6 | MCQ card (always shown for MCQ questions): options A–D pre-filled, saved correct radio, hard `required`; per-option image + hidden `remove_option_image_0..3`; note box | S4-043–078 | Admin | OBSERVED |
| FN-M04-1.7.7 | Card "Maklumat Tambahan" pre-filled (Penjelasan, Bahasa, Nilai Mata) | S4-079–088 | Admin | OBSERVED |
| FN-M04-1.7.8 | "Batal" `fa-times` → `/admin/questions/{id}`; submit `fa-save` "Kemaskini Soalan" | S4-089–090 | Admin | OBSERVED |
| FN-M04-1.7.9 | Non-MCQ questions: the edit form shows the answer card of the saved type (as on create) instead of the MCQ card; the type itself is not changeable (DV-M04-05) | — | Admin | DV-M04-05 |
| FN-M04-1.7.10 | Update result: detail or list with flash; errors → form with old input | — | Admin | INFERRED (UNVERIFIED COPY) |

### EP-M04-2 — Bulk import and quality

**FT-M04-2.1 — CSV import** (S5 `/admin/questions/import`)

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M04-2.1.1 | Shell header "Import Soalan Secara Pukal" / "Muat naik fail CSV untuk menambah soalan secara pukal"; top links `fa-history` "Sejarah Import" → import history (DV-M04-01) and `fa-arrow-left` "Kembali" → `/admin/questions` | S5-001–002; SHA-210–211 | Admin | OBSERVED + DV-M04-01 |
| FN-M04-2.1.2 | Card "Muat Naik Fail CSV" (`fa-file-upload`), form `POST` multipart; "Fail CSV *" (`csv_file`, accept `.csv,.txt`, required) + `fa-info-circle` "Saiz maksimum: 5MB. Format: CSV atau TXT" | S5-003–009 | Admin | OBSERVED |
| FN-M04-2.1.3 | "Tetapan Lalai (Opsional)" / "Nilai ini digunakan jika kolum berkaitan tiada dalam CSV.": "Subjek Lalai", "Tahap Pendidikan" ("-- Tidak ditetapkan --" + lists), "Kesukaran" ("-- Tidak ditetapkan --", 1–5, **2 Mudah selected**) | S5-010–017 | Admin | OBSERVED |
| FN-M04-2.1.4 | Footer `fa-shield-alt` "Soalan disimpan sebagai draf" and submit `fa-upload` "Mula Import" | S5-018–019 | Admin | OBSERVED |
| FN-M04-2.1.5 | Card "Muat Turun Template" (`fa-download`): "Template CSV dengan contoh soalan" + link `fa-file-csv` "Download Template" → template | S5-020–023 | Admin | OBSERVED |
| FN-M04-2.1.6 | Card "Format CSV": "Kolum diperlukan:" `question_text` — Teks soalan; `option_a`, `option_b` — Pilihan; `correct_answer` — Jawapan (A/B/C/D); `subject_id` — ID subjek; `education_level_id` — ID tahap; "Kolum opsional:" `option_c`, `option_d`; `difficulty_level` — Kesukaran (1-5); `marks`, `explanation`. Rule text per DV-M04-07 (added suffix is PROPOSED COPY) | S5-024–046 | Admin | OBSERVED + DV-M04-07 |
| FN-M04-2.1.7 | Card "Tips" (`fa-lightbulb`, `fa-check` bullets): "Fail CSV mesti encoding UTF-8"; "Guna petikan dua (\") untuk teks yang ada koma"; "Baris pertama = header kolum"; "Semua soalan disimpan sebagai \"draf\"" | S5-047–052 | Admin | OBSERVED |
| FN-M04-2.1.8 | "Sejarah Import" target: live HTTP 500 page ("500", "⚙️", "Ralat Pelayan", "Sesuatu tidak kena di pihak kami. Pasukan teknikal telah dimaklumkan. Sila cuba sebentar lagi.", "Halaman Utama", "Cuba Semula", "PRESTASIPLUS") replaced by a minimal read-only import-history table built from the import runs (DV-M04-01, PROPOSED COPY, no actions); the 500 page itself remains the generic server-error page | S5-053–059 | Admin | OBSERVED + DV-M04-01 |
| FN-M04-2.1.9 | Import processing: rows parsed (UTF-8, header row, quotes), defaults fill missing columns, every row saved as MCQ `draft`; result message with counts | — | Admin | INFERRED (UNVERIFIED COPY) |
| FN-M04-2.1.10 | Template download content (CSV with the header row and sample rows) | — | Admin | INFERRED |

**FT-M04-2.2 — Quality dashboard** (S6 `/admin/questions/quality`)

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M04-2.2.1 | Shell header "Dashboard Kualiti Soalan" / "Analisa kualiti keseluruhan bank soalan"; 4 KPI cards "Jumlah Soalan", "Purata Skor", "Cemerlang (76-100)", "Perlu Tindakan Aktif (≤ 50)" (totals from the single source, DV-M04-04) | S6-001–012; SHA-216–217 | Admin | OBSERVED + DV-M04-04 |
| FN-M04-2.2.2 | 3 bucket cards, titles displayed upper case (CSS) "SKOR 51-75", "SKOR ≤ 50", "LEGACY GENERIC": "Skor 51-75" + "Perlu semakan ringan atau pengayaan metadata."; "Skor ≤ 50" + "Bucket ini patut jadi fokus tindakan segera."; "Legacy Generic" + the text with **literal backtick characters**: Row legacy seperti &#96;tracking_a_feed_20260308&#96;, &#96;spm_tracking_auto_seed_v1&#96;, dan &#96;source_type=ai_generated&#96; diasingkan daripada senarai tindakan aktif. | S6-013–021 | Admin | OBSERVED |
| FN-M04-2.2.3 | "Taburan Kualiti": stacked bar with percentage labels and legend "Cemerlang", "Baik", "Lemah", "Kritikal" | S6-022–029 | Admin | OBSERVED |
| FN-M04-2.2.4 | "Mengikut Subjek" table ("Subjek", "Soalan", "Purata" coloured pill, "Cemerlang" %), sorted by average descending | S6-030–058 | Admin | OBSERVED |
| FN-M04-2.2.5 | "Mengikut Tingkatan": 11 rows label + "{n} soalan · {avg}" + progress bar | S6-059–082 | Admin | OBSERVED |
| FN-M04-2.2.6 | "Soalan Untuk Semakan Aktif" / "Memaparkan hanya soalan skor ≤ 50 selepas menolak sumber generic legacy." + pill "{n} soalan"; table "ID" "Soalan" "Subjek" "Tingkatan" "Sumber" "Skor" + `fa-edit` "Edit" → edit | S6-083–091 | Admin | OBSERVED |
| FN-M04-2.2.7 | Form `POST run-audit`: `fa-clipboard-check` "Jalankan Audit Semula"; while submitting disabled with `fa-spinner fa-spin` "Sedang audit..."; no confirm | S6-092–096 | Admin | OBSERVED |
| FN-M04-2.2.8 | Audit result: scores recomputed, page reloads with flash | — | Admin | INFERRED (UNVERIFIED COPY) |

### EP-M04-3 — Question reports

**FT-M04-3.1 — Report-a-question modal** (S14 modal on M05/M06 practice pages)

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M04-3.1.1 | MCQ quiz trigger: button `fa-flag` "Lapor Soalan" (opens the modal for the current question, form reset) | S14-002 | Pelajar (any logged-in user, INFERRED) | OBSERVED |
| FN-M04-3.1.2 | Structured practice trigger: small button `fa-flag` "Lapor" (title "Lapor soalan ini") | S14-031 | Pelajar (any logged-in user, INFERRED) | OBSERVED |
| FN-M04-3.1.3 | Modal frame: overlay `bg-black/40` (click closes), Esc closes, card `max-w-lg` scrollable (`max-h-[90vh]`); red flag, h3 "Lapor Soalan"; subtitle MCQ "Soalan ini akan dinyahaktifkan sementara" / structured "Soalan ini akan dinyahaktifkan selepas 3 laporan"; close `fa-times` | S14-003–007, 032 | Pelajar (any logged-in user, INFERRED) | OBSERVED |
| FN-M04-3.1.4 | MCQ reasons "Sebab Laporan *" (multi-select checkbox cards): Jawapan tidak tepat, Soalan mengelirukan, Set jawapan tidak tepat, Pilihan jawapan tidak lengkap, Soalan berulang / pendua, Kesalahan ejaan / taip, Lain-lain (each with its description); selected cards tinted by reason | S14-010–024 | Pelajar (any logged-in user, INFERRED) | OBSERVED |
| FN-M04-3.1.5 | Structured reasons: Skema jawapan tidak tepat, Soalan mengelirukan, Markah tidak adil, Kesalahan ejaan / taip, Lain-lain (with descriptions) | S14-033–040 | Pelajar (any logged-in user, INFERRED) | OBSERVED |
| FN-M04-3.1.6 | "Komen Tambahan (pilihan)" textarea (maxlength 500, "Terangkan masalah soalan ini...") + live counter "{n}/500" | S14-025–027 | Pelajar (any logged-in user, INFERRED) | OBSERVED |
| FN-M04-3.1.7 | "Batal" closes; `fa-paper-plane` "Hantar Laporan" disabled while no reason is ticked or while sending (`fa-spinner fa-spin` "Menghantar...") | S14-028–029 | Pelajar (any logged-in user, INFERRED) | OBSERVED |
| FN-M04-3.1.8 | Submitted state: green check, h4 "Terima Kasih!", message (server `message`, fallback "Laporan berjaya dihantar."; network error "Ralat. Sila cuba lagi."), button "Tutup" | S14-008–009 | Pelajar (any logged-in user, INFERRED) | OBSERVED (script) / INFERRED (server message) |
| FN-M04-3.1.9 | Request `POST /report-question` JSON (MCQ: question_id, reasons[], comment, quiz_session_id, source "spm"; structured: question_id, question_type "structured", reasons[], comment, source "structured_attempt"); report saved `pending`; MCQ question deactivated at once, structured after 3 reports | — | Pelajar (any logged-in user, INFERRED) | OBSERVED (request) / INFERRED (server rules) |

**FT-M04-3.2 — Admin report triage** (S7 `/admin/question-reports`)

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M04-3.2.1 | h1 `fa-flag` "Laporan Soalan" / "Soalan yang dilaporkan oleh pelajar dari kuiz, latihan & Papan Bijak" | S7-001–002 | Admin | OBSERVED |
| FN-M04-3.2.2 | Status tabs (links `?status=`, active tab solid colour + white text): `fa-clock` "Menunggu ({n})" amber (default), `fa-eye` "Disemak ({n})" blue, `fa-check` "Diperbaiki ({n})" emerald, `fa-times` "Ditolak ({n})" slate, `fa-list` "Semua ({n})" violet | S7-003–007 | Admin | OBSERVED |
| FN-M04-3.2.3 | Report card (newest first, no pagination) with status badge: `fa-clock` "Menunggu", `fa-eye` "Disemak", `fa-check` "Diperbaiki", `fa-ban` "Dikeluarkan" (fixed and the question removed from the live bank), "Ditolak"; info column and action column side by side at ≥1024px | S7-008–009, 042–043, 074–075, 091–092, 098–099, 106–107, 122–123, 132–133 | Admin | OBSERVED |
| FN-M04-3.2.4 | Reason-category badge: `fa-info-circle` "Lain-lain" (slate), `fa-question-circle` "Tak Jelas" (amber), `fa-times-circle` "Jawapan Salah" (red) | S7-010, 044, 076, 093, 100, 124, 134 | Admin | OBSERVED |
| FN-M04-3.2.5 | `fa-ban` "Dinyahaktif" (red) while the question is inactive | S7-077, 094, 101 | Admin | OBSERVED |
| FN-M04-3.2.6 | Source-set badge `fa-database` (e.g. "trial", "ai_generated", tracking set code); absent when none | S7-011, 045, 078, 108 | Admin | OBSERVED |
| FN-M04-3.2.7 | "Oleh: **{name}**", relative time ("2 minggu yang lepas", "3 bulan yang lepas"), optional "Bilik: {code}" | S7-012–014, 046–048, 079–081, 102, 109, 125, 135 | Admin | OBSERVED |
| FN-M04-3.2.8 | Violet badge `fa-hashtag` "ID Soalan: {id}" | S7-015, 049, 082 | Admin | OBSERVED |
| FN-M04-3.2.9 | Reason detail pill: submitted reason labels (e.g. "Lain-lain", "Soalan mengelirukan", "Set jawapan tidak tepat", "Jawapan tidak tepat"); legacy raw codes and structured labels per DV-M04-08 | S7-016, 050, 083, 095, 103, 110, 126, 136 | Admin | OBSERVED + DV-M04-08 |
| FN-M04-3.2.10 | Question block (`fa-file-alt`): structured "Soalan Struktur #{id}:" + stimulus; MCQ "Soalan #{id}:" + text + options "A. …"–"D. …" (2 columns, correct one green with `fa-check`); "{Subjek} — {Tingkatan N}"; "Compliance: {code}"; deleted question "Soalan tidak dijumpai" | S7-017–020, 051–054, 084–087, 096, 104–105, 111–117, 127–128, 137–139 | Admin | OBSERVED |
| FN-M04-3.2.11 | `fa-comment` "Komen pelajar:" + comment (when present) | S7-021–022, 088–089, 097, 129, 140 | Admin | OBSERVED |
| FN-M04-3.2.12 | `fa-sticky-note` "Status tindakan admin:" + admin notes (when present) | S7-118–119, 130–131, 141–142 | Admin | OBSERVED |
| FN-M04-3.2.13 | Action "Tandakan Selesai" (`fa-check`): textarea `admin_notes` (2 rows, "Contoh: Soalan diperbaiki / Soalan dikeluarkan kerana silibus lama...", pre-filled with existing notes), posts `status=fixed`; pending and reviewed reports only | S7-023–027, 055–059, 143–144 | Admin | OBSERVED (UI) / INFERRED (result) |
| FN-M04-3.2.14 | Action "Tolak & Aktifkan Semula" (`fa-times`): posts `status=dismissed`, `admin_notes="Soalan dan jawapan disemak — tiada masalah"`, `reactivate=1`; no confirm | S7-028–033, 060–065, 145–146 | Admin | OBSERVED (UI) / INFERRED (result) |
| FN-M04-3.2.15 | Action "Nyahaktif Segera" (`fa-ban`): posts `status=reviewed`, `admin_notes="Dinyahaktifkan segera oleh admin"`, `force_deactivate=1`; only while the question is active; no confirm | S7-036–041, 068–073 | Admin | OBSERVED (UI) / INFERRED (result) |
| FN-M04-3.2.16 | Links `fa-eye` "Lihat Soalan Struktur #{id}" → `/admin/structured-questions/{id}` or `fa-edit` "Edit Soalan #{id}" → `/admin/questions/{id}/edit` | S7-034, 066, 120 | Admin | OBSERVED |
| FN-M04-3.2.17 | `fa-external-link-alt` "Buka Soalan Sama" (new tab) → `/latihan-berstruktur/{id}/jawab?scope=spm` or `/spm/latih-tubi/{CODE}/quiz?question_id={id}&count=1` (CODE = the question subject code, any level); the host serves the question whenever it is eligible (BR-M04-03), otherwise the host fallback applies (M05/M06 contract) | S7-035, 067, 121 | Admin | OBSERVED |
| FN-M04-3.2.18 | Empty tab `fa-check-double` "Tiada laporan buat masa ini"; an unknown `status` value shows the same block and no tab is active | S7-090 | Admin | OBSERVED |
| FN-M04-3.2.19 | Action results: page reloads on the same tab with a flash; question active flag changed per action; tab counts updated | — | Admin | INFERRED (UNVERIFIED COPY) |

**FT-M04-3.3 — My question reports** (S13 `/laporan-soalan`)

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M04-3.3.1 | Shell header "Laporan Soalan Saya" / "Jejak status laporan soalan yang anda hantar"; 5 counter cards "Jumlah", "Menunggu", "Disemak", "Diperbaiki", "Ditolak" | S13-004–014; SHU-373–374 | Pelajar (any logged-in user, INFERRED) | OBSERVED |
| FN-M04-3.3.2 | Empty state "📋" / h3 "Tiada Laporan" / "Anda belum menghantar sebarang laporan soalan." | S13-015–018 | Pelajar (any logged-in user, INFERRED) | OBSERVED |
| FN-M04-3.3.3 | Populated list: one row per report sent by the user with status and admin notes | — | Pelajar (any logged-in user, INFERRED) | INFERRED (UNVERIFIED COPY) |

### EP-M04-4 — Structured question bank

**FT-M04-4.1 — Structured question list** (S8 `/admin/structured-questions`)

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M04-4.1.1 | h1 "Soalan Berstruktur" / "Semua soalan berstruktur SPM dalam sistem"; `fa-plus` "Tambah Soalan" → `/guru/soalan-berstruktur/cipta` (M10) | S8-001–003 | Admin | OBSERVED |
| FN-M04-4.1.2 | Stat cards "{n}" "Jumlah Soalan" and "{n}" "Published" | S8-004–009 | Admin | OBSERVED |
| FN-M04-4.1.3 | Card "Agihan Mengikut Subjek": pills "{Subjek}: **{n}**" (alphabetical) | S8-010–026 | Admin | OBSERVED |
| FN-M04-4.1.4 | Filter form `GET`: "Subjek" ("Semua Subjek" + 31 alphabetical), "Tingkatan" ("Semua" + 11), "KBAT" ("Semua KBAT", 2 Memahami (L2), 3 Mengaplikasi (L3), 4 Menganalisis (L4), 5 Menilai/Mencipta (L5)), `fa-search` "Cari"; "Reset" link when any filter is set | S8-027–034, 067 | Admin | OBSERVED |
| FN-M04-4.1.5 | Table (25/page): "#", "Stimulus / Soalan" (100 chars + "..."), "Subjek" pill (hidden <640), "Tgk" (hidden <640), "KBAT" pill "L{n}" (values 1–6 in the data), "Markah" "{n}m" (hidden <640), "Sub-Q" (hidden <768), "Aksi" `fa-eye` "Lihat" → detail | S8-035–045, 069–074, 079–081 | Admin | OBSERVED |
| FN-M04-4.1.6 | Malay counter "Menunjukkan {from}–{to} daripada {n} soalan"; empty "Menunjukkan 0 daripada 0 soalan" (DV-M04-12, PROPOSED COPY) | S8-066, 068, 075, 078 | Admin | OBSERVED + DV-M04-12 |
| FN-M04-4.1.7 | English pager ≥640px (as S1), fits at 768 (DV-M04-09) | S8-048–065, 077 | Admin | OBSERVED + DV-M04-09 |
| FN-M04-4.1.8 | English pager <640px "« Previous" / "Next »" | S8-046–047, 076 | Admin | OBSERVED |
| FN-M04-4.1.9 | Empty: single table row "Tiada soalan berstruktur ditemui" | — | Admin | OBSERVED |

**FT-M04-4.2 — Structured question detail** (S9 `/admin/structured-questions/{id}`)

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M04-4.2.1 | Back link `fa-arrow-left` "Kembali ke senarai" → list | S9-001 | Admin | OBSERVED |
| FN-M04-4.2.2 | Header card pills: subject, "Tingkatan N", "KBAT: {label} (L{n})" (labels BR-M04-28; L1 "Mengingat" and L6 "Mencipta" INFERRED from the student scale), "{n} Markah"; right "ID: #{id}" | S9-002–007, 035–037 | Admin | OBSERVED |
| FN-M04-4.2.3 | Box "Stimulus / Konteks Soalan" (label displayed upper case, CSS: "STIMULUS / KONTEKS SOALAN") + stimulus (line breaks kept) | S9-008–009, 038 | Admin | OBSERVED |
| FN-M04-4.2.4 | Meta line `fa-user` "Dicipta oleh: {name}", `fa-calendar` "dd Mon yyyy", `fa-eye` "Visibiliti: Public", `fa-circle` "Published" | S9-010–013, 039 | Admin | OBSERVED |
| FN-M04-4.2.5 | h2 "Bahagian Soalan ({n} sub-soalan)"; per sub-question: label pill ("3(A)" or "A"), text, marks chip "{n}m", box "Jawapan Model" (displayed "JAWAPAN MODEL", CSS) + answer (line breaks kept) | S9-014–032, 040–045 | Admin | OBSERVED |
| FN-M04-4.2.6 | Actions `fa-edit` "Edit Soalan" → `/guru/soalan-berstruktur/{id}/edit` (M10) and `fa-list` "Balik ke Senarai" | S9-033–034 | Admin | OBSERVED |

### EP-M04-5 — Content-quality workflows

**FT-M04-5.1 — Teacher question papers** (S10 `/admin/question-submissions`)

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M04-5.1.1 | Shell header "Kertas Soalan Guru" / "Semak dan proses fail soalan yang dihantar oleh guru"; counter cards "Jumlah" (slate), "Pending" (amber), "Processing" (blue), "Selesai" (emerald); no Ditolak card | S10-001–012; SHA-225–226 | Admin | OBSERVED |
| FN-M04-5.1.2 | Filter card: select `status` ("Semua Status", Pending, Processing, Selesai, Ditolak) + `fa-filter` "Tapis"; "Reset" link when filtered | S10-013–016, 046 | Admin | OBSERVED |
| FN-M04-5.1.3 | Table "Guru / Sekolah" (name, e-mail link, `fa-school` school) \| "Soalan" (subject free text + level chip + "(year)"; paper type in blue; "Oleh: {name}"; optional italic note) \| "Fail" \| "Status" \| "Tarikh" ("dd Mon yyyy" / "HH:MM") \| "Tindakan" | S10-017–018 | Admin | OBSERVED |
| FN-M04-5.1.4 | File links `fa-download` + name (truncated) → `/admin/question-submissions/{id}/download/{index}` | S10-019, 028, 037, 047 | Admin | OBSERVED (link) / INFERRED (download) |
| FN-M04-5.1.5 | Status pill `fa-check-circle` "Selesai" (green) / `fa-cogs` "Processing" (blue); pending and rejected pills INFERRED; admin note in italics under the pill | S10-020, 029, 038, 048 | Admin | OBSERVED / INFERRED (2 pills) |
| FN-M04-5.1.6 | `fa-edit` "Kemaskini" toggles an inline panel: form `PATCH …/status`, select `status` (required, current selected; Pending, Processing, Selesai, Ditolak), textarea `admin_notes` (2 rows, maxlength 1000, "Nota admin (pilihan)...", pre-filled), "Simpan" (no confirm) | S10-021–027, 030–036, 039–045 | Admin | OBSERVED (UI) / INFERRED (result) |
| FN-M04-5.1.7 | Empty table "Tiada rekod ditemui" | — | Admin | OBSERVED |
| FN-M04-5.1.8 | Update result: list reloads with flash; counters updated | — | Admin | INFERRED (UNVERIFIED COPY) |

**FT-M04-5.2 — Diagram audit** (S11 `/admin/soalan-gambar`)

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M04-5.2.1 | Shell header "Soalan Perlu Gambar Rajah" / "Audit soalan yang memerlukan gambar rajah dilengkapkan"; stat cards `fa-list-ol` "MCQ Perlu Gambar", `fa-pen-fancy` "Struktur Perlu Gambar", `fa-chart-bar` "Jumlah" (labels displayed upper case, CSS) — each card counts its list under the active filters (DV-M04-11; live stays global) | S11-001–009; SHA-227–228 | Admin | OBSERVED + DV-M04-11 |
| FN-M04-5.2.2 | Card "MCQ Perlu Gambar Mengikut Mata Pelajaran" (displayed upper case, CSS): top-10 subject pills "{Subjek}: {n}" by count, global (unchanged by either filter, as live) | S11-010–021 | Admin | OBSERVED |
| FN-M04-5.2.3 | Filter `GET`: `subject_id` ("Semua Mata Pelajaran" + 31 alphabetical), `school_id` ("Semua Sekolah" + every school alphabetical), `fa-filter` "Tapis"; the subject filter applies to both lists, the school filter to the MCQ list only (as live: structured questions carry no visible school) | S11-022–025 | Admin | OBSERVED |
| FN-M04-5.2.4 | Section h2 `fa-list-ol` "MCQ ({n})" (count after the filters); the whole MCQ section (heading and pager) is omitted when its count is 0 | S11-026, 108 | Admin | OBSERVED |
| FN-M04-5.2.5 | Question card: "#{id}", subject pill, "oleh {name}", full text (structured: pre-line text cut at about 400 chars), `fa-file-pdf` "{source file} ms.{page}" | S11-027–032, 040–045, 053–058, 109–130, 133–144 | Admin | OBSERVED |
| FN-M04-5.2.6 | Upload form `POST …/{mcq\|structured}/{id}/upload` (multipart, file `image`, `accept="image/*"`, required) + icon submit `fa-upload`; no confirm | S11-033–036, 046–049, 059–062 | Admin | OBSERVED (UI) / INFERRED (result) |
| FN-M04-5.2.7 | Form `POST …/dismiss` with `fa-times` "Dismiss"; no confirm | S11-037–039, 050–052, 063–065 | Admin | OBSERVED (UI) / INFERRED (result) |
| FN-M04-5.2.8 | MCQ list pager (20/page, `mcq_page`; ≥640 English pager, <640 "« Previous"/"Next »"); links keep `subject_id` and `school_id` (DV-M04-16; live drops them) and drop `str_page` (as live) | S11-066–085, 131 | Admin | OBSERVED |
| FN-M04-5.2.9 | Section h2 `fa-pen-fancy` "Struktur ({n})" with its own pager (`str_page`; links keep `subject_id` and `school_id` per DV-M04-16 and drop `mcq_page`); omitted when its count is 0 | S11-086–106, 132, 145 | Admin | OBSERVED |
| FN-M04-5.2.10 | Empty "Semua soalan sudah lengkap dengan gambar rajah!" (only when both lists are empty) | S11-107 | Admin | OBSERVED |
| FN-M04-5.2.11 | Upload / dismiss results: flag cleared (image attached for upload), page reloads with flash | — | Admin | INFERRED (UNVERIFIED COPY) |

**FT-M04-5.3 — Master notes review** (S12 `/admin/master-notes` (user-portal layout))

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M04-5.3.1 | Dark header card: h1 "Master Notes — Admin Review" (readable per DV-M04-14; live h1 colour = card background) and "Self-healing nota AI: {f} flagged · {a} teacher-approved · {t} total. Review yang flagged untuk improve quality." | S12-004–005 | Admin | OBSERVED + DV-M04-14 |
| FN-M04-5.3.2 | Tabs (links; active = dark pill): "Flagged Review" (`?tab=flagged`, default), "Teacher Approved" (`?tab=approved`), "Semua" (`?tab=all`) | S12-006–008 | Admin | OBSERVED |
| FN-M04-5.3.3 | Empty "Tiada nota dalam tab ini." | S12-009 | Admin | OBSERVED |
| FN-M04-5.3.4 | Row meta: "**question_id:** {id} · **subject:** {s} · **chapter:** {c or —} · **model:** {m} · **tokens:** {n} ·" + green badge "conf {n}" | S12-010–016, 025–031, 040–046, 076, 080, 084 | Admin | OBSERVED |
| FN-M04-5.3.5 | "**Soalan:**" + question cut at about 200 chars (grey box); note text (blue box); yellow box "**Trap:**" + misconception | S12-017–021, 032–036, 047–051, 077–079, 081–083, 085–087 | Admin | OBSERVED |
| FN-M04-5.3.6 | Buttons "Approve" (green), "Regenerate" (amber), "Clear Flag" (slate): click disables the button and posts `/admin/master-notes/{id}/{approve\|regen\|unflag}` at once (no confirm); label "..." while waiting; success (judged by HTTP status only) → row at 50% opacity, button "Done" and still disabled; error → label restored and button re-enabled | S12-022–024, 037–039, 052–054 | Admin | OBSERVED (script) / INFERRED (result) |
| FN-M04-5.3.7 | Pagination 15/page (`?tab=all&page=N`), English pager ≥640 / "« Previous"/"Next »" <640 | S12-055–075, 088 | Admin | OBSERVED |
| FN-M04-5.3.8 | Flag lifecycle: flagged rows appear under "Flagged Review", approved under "Teacher Approved"; Regenerate replaces the note with a canned note (D4) | — | Admin | INFERRED |

### EP-M04-6 — Navigation, shells and access

**FT-M04-6.1 — M04 entries in the admin shell** (admin shell (SHA))

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M04-6.1.1 | Desktop sidebar group "Soalan" (toggle `fa-question-circle`, displayed "SOALAN") with "Senarai Soalan", "Import CSV", "Kualiti Soalan", "Laporan Soalan", "Soalan Berstruktur", "Kertas Soalan Guru"; the current screen's item is highlighted (S2–S4 highlight "Senarai Soalan", DV-M04-02); S11 has no admin sidebar item (as live) | SHA-028–034 | Admin | OBSERVED + DV-M04-02 |
| FN-M04-6.1.2 | Mobile bottom nav "Soalan" (`fa-question-circle`) → `/admin/questions` | SHA-137 | Admin | OBSERVED |
| FN-M04-6.1.3 | Mobile "Lagi" menu section "Soalan": "Import CSV", "Kualiti Soalan", "Laporan Soalan", "Soalan Berstruktur", "Kertas Soalan Guru" | SHA-151–156 | Admin | OBSERVED |
| FN-M04-6.1.4 | Shell header title derived from the route (shell rule DV-SH-03), with no subtitle, instead of the live fallback "Dashboard" / "Selamat datang, Admin" on S1–S4, S7–S9 and S5h (DV-M04-02); S5, S6, S10, S11 keep their correct live title and subtitle | SHA-118–119 | Admin | OBSERVED + DV-M04-02 |

**FT-M04-6.2 — M04 entries in the user-portal shell** (user-portal shell (SHU))

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M04-6.2.1 | Sidebar section "🛡️ Kawalan Kualiti" (displayed upper case) with "Semakan Nota Master" (`fa-shield-alt`) → `/admin/master-notes` (desktop sidebar and mobile drawer) | SHU-040–041, 243–244 | Admin | OBSERVED |
| FN-M04-6.2.2 | "Laporan Soalan" (`fa-flag`) → `/laporan-soalan` in the "💎 Killer Features" section (sidebar and drawer) | SHU-058, 188 | Pelajar (any logged-in user, INFERRED) | OBSERVED |
| FN-M04-6.2.3 | "Kertas Soalan Guru" (`fa-file-upload`) → `/admin/question-submissions` in the "Admin" section (desktop sidebar only) | SHU-118 | Admin | OBSERVED |
| FN-M04-6.2.4 | "Gambar Rajah" (`fa-images`) → `/admin/soalan-gambar` with red count badge = MCQ needing a diagram (e.g. "6,144"), in the "Bantuan" section (desktop sidebar only) | SHU-126–127 | Admin | OBSERVED |
| FN-M04-6.2.5 | S12 header title "Master Notes — Admin Review" with no subtitle instead of the live fallback "Dashboard" / "Selamat datang kembali" (DV-M04-02, shell rule DV-SH-03) | SHU-136–137 | Admin | OBSERVED + DV-M04-02 |

**FT-M04-6.3 — Access, lookups and data source** ((behaviour))

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M04-6.3.1 | Access: every `/admin/*` M04 route needs an admin session; a guest goes to `/login` (M01); other roles are refused (INFERRED) | — | Admin | OBSERVED (guest pattern, M01/M02) / INFERRED (roles) |
| FN-M04-6.3.2 | `/laporan-soalan` and the report modal need a logged-in user; each user sees only their own reports | — | Pelajar (any logged-in user, INFERRED) | INFERRED |
| FN-M04-6.3.3 | DSKP lookups use the M10-owned API (`dskp/bidang`, `dskp/sk`, `dskp/sp`) over M03 subjects/levels | — | Admin | OBSERVED |
| FN-M04-6.3.4 | Single count source (D11): the question and structured stores are deterministic virtual datasets that report the live totals (objective 465,278; structured 4,064; master notes 525) and generate rows on demand; observed anchors override rows at their ids; every count on S1, S6, S8, S11 and the SHU badge is computed from them (DV-M04-04) | — | Admin | DV-M04-04 |
| FN-M04-6.3.5 | Subject and level lists (S1, S2, S4, S5, S8, S11 selects and tiles) come from the M03 lookups `GET /api/subjects` and `GET /api/education-levels` (integer ids 1–31 / 1–11, `isCore`), not duplicated in M04 | — | Admin | OBSERVED (values) / M03 reference |
| FN-M04-6.3.6 | SPM objective pool (D12, XL-01): M06 practice reads the M04 store through the store contract — Q-SPM-POOL: eligible (BR-M04-03) MCQ rows of Tingkatan 4/5 (levels 10, 11) carrying the SPM scope flag `spmPool` (observed pool sizes, e.g. MATH 1,681, Bahasa Arab 0); no separate SPM store. A question an admin creates at T4/T5 in an SPM subject gets the flag (INFERRED) and joins the pool while eligible; a deactivated one leaves it | — | Admin | OBSERVED (live links use M04 ids, e.g. 136891) / INFERRED (scope rule) |
| FN-M04-6.3.7 | Practice eligibility for every consumer (M05 drills, chapter mode, revision; M06 pools; M07 student pages): only `status = approved`, `isActive = true` questions are served; PKSK rows only to M07; structured practice lists (M05 S10/Q3, M06 S7–S9) show published, active T4/T5 structured questions of the same store | — | Admin | OBSERVED (counts 4,064 admin vs 4,059 student) / INFERRED (rule) |
| FN-M04-6.3.8 | Report modal contract for host modules: props `questionId`, `variant` (`mcq`/`structured`), `quizSessionId?`, `source` (default `spm` for MCQ, `structured_attempt` for structured; also `latihan`, `revision`), `failureText` (default "Ralat. Sila cuba lagi."), `tints` (per-reason ticked colours; default the M04 set) | — | Pelajar (any logged-in user, INFERRED) | OBSERVED (live values per host) / contract |
| FN-M04-6.3.9 | Teacher question write contract (M10 S22–S24, CSV import): `questions.createFromTeacher / updateOwn / deleteOwn / importFromTeacher` store rows with `status = pending_review`, `isActive = true`, `createdBy` = the teacher, runtime ids ≥ 9,000,001, and the M10 fields `curriculumChapterId`, `curriculumTopicId`, `scriptType`, `textDirection`; admin approval (S1 bulk, S3 quick action) makes them eligible for practice | — | Admin | OBSERVED (M10 forms, SOURCE-DERIVED) / INFERRED (store rules) |
| FN-M04-6.3.10 | Structured question write contract (M10 S18/S20): `structured.create / update / delete / toggleStatus` with the M10-authored fields (chapter, topic, DSKP SP, script, direction, template, sub-question parts, answer type, numeric answer and tolerance, rubrics); toggle switches draft ⇄ published; runtime ids ≥ 9,000,001 | — | Admin | SOURCE-DERIVED (M10) / INFERRED |
| FN-M04-6.3.11 | Named queries for teacher and analytics screens: Q-CONTRIB(user) (M10 S1/S21), Q-TEACHER-DATABANK(subject) (M10 S28), Q-SP-AVAILABLE(sp) (M08 S6/S7 "available"), and the question-level chapter label and topic used by M11 S4; reports from the teacher databank (source `teacher_databank`, reason `outdated`, response flag `success`) | — | Admin | OBSERVED (M08/M10/M11 values) / INFERRED (definitions) |
| FN-M04-6.3.12 | Jutawan question store (XL3-10, M16 S19/game): a separate M04-owned store `jutawanQuestions` with the 143 observed subject × grade counts (Σ 149,911) as Q-JUT-COUNT, sampled by the Jutawan game through `questions.jutawan.*`; outside Q-ALL and the 466,041 question rows | — | Admin | OBSERVED (M16 counts) / INFERRED (rows) |
| FN-M04-6.3.13 | Analytics inputs for M17/M18 (XL3-11): the `coverageExcluded` facet (Q-M17-COV 127,643), teacher contributions over active teachers (Q-TEACHER-CONTRIB 11,414), the ImportRun dataset (1,123 runs, 31,101 imported) and the M18 critical-question anchors | — | Admin | OBSERVED (M17/M18 values) / INFERRED (definitions) |

**Totals:** 6 epics · 20 features · 183 functions (146 cover inventory elements; 37 are behaviour-only: 1.1.19, 1.1.20, 1.2.13, 1.3.7, 1.4.4, 1.5.7, 1.5.8, 1.5.9, 1.5.10, 1.6.4, 1.6.5, 1.7.9, 1.7.10, 2.1.9, 2.1.10, 2.2.8, 3.1.9, 3.2.19, 3.3.3, 4.1.9, 5.1.7, 5.1.8, 5.2.11, 5.3.8, 6.3.1, 6.3.2, 6.3.3, 6.3.4, 6.3.5, 6.3.6, 6.3.7, 6.3.8, 6.3.9, 6.3.10, 6.3.11, 6.3.12, 6.3.13).

---

## 4. User stories

| ID | Feature | Priority | Story | Functions |
|---|---|---|---|---|
| US-M04-01 | FT-M04-1.1 | Must | As an admin, I want a paginated table of every objective question with its badges, subject, level, difficulty and status, so that I can see the state of the bank. | FN-M04-1.1.1, 1.1.2, 1.1.11, 1.1.12, 1.1.13, 1.1.16, 1.1.17 |
| US-M04-02 | FT-M04-1.1 | Must | As an admin, I want per-subject summary tiles that filter the list, so that I can jump to one subject. | FN-M04-1.1.3, 1.1.4, 1.1.5 |
| US-M04-03 | FT-M04-1.1 | Must | As an admin, I want to filter by subject, level, difficulty, status, DSKP, compliance and source and search the text, so that I can find questions. | FN-M04-1.1.6, 1.1.7, 1.1.8, 1.1.9, 1.1.18, 1.1.19 |
| US-M04-04 | FT-M04-1.1 | Must | As an admin, I want to approve, reject, archive or delete the questions I tick, so that I can manage many at once. | FN-M04-1.1.10, 1.1.20 |
| US-M04-05 | FT-M04-1.1 | Must | As an admin, I want to open, edit or delete a question from its row, so that single fixes are quick. | FN-M04-1.1.14, 1.1.15, 1.1.20 |
| US-M04-06 | FT-M04-1.2 | Must | As an admin, I want to create a question with subject, level, difficulty, text, optional image, explanation, language and points, so that it enters the bank. | FN-M04-1.2.1, 1.2.2, 1.2.3, 1.2.5, 1.2.6, 1.2.11, 1.2.12, 1.2.13 |
| US-M04-07 | FT-M04-1.2 | Must | As an admin, I want the answer section to follow the question type (MCQ, Betul / Salah, Jawapan Pendek, Isi Tempat Kosong, Esei), so that each type stores its own answer. | FN-M04-1.2.4, 1.2.7, 1.2.8, 1.2.9, 1.2.10 |
| US-M04-08 | FT-M04-1.3 | Should | As an admin writing Arabic or Jawi questions, I want an on-screen keyboard, so that I can type the script without a special keyboard. | FN-M04-1.3.1–1.3.7 |
| US-M04-09 | FT-M04-1.4 | Should | As an admin, I want to tag a question to a DSKP Standard Pembelajaran through Bidang → SK → SP, and remove the tag, so that questions map to the syllabus. | FN-M04-1.4.1–1.4.5, 6.3.3 |
| US-M04-10 | FT-M04-1.5 | Must | As an admin, I want a detail page with the question, options, correct answer, explanation and metadata, so that I can review one question. | FN-M04-1.5.1–1.5.9 |
| US-M04-11 | FT-M04-1.6 | Could | As an admin, I want to generate (and regenerate) an AI explanation for a question, so that students get a worked explanation. | FN-M04-1.6.1–1.6.5 |
| US-M04-12 | FT-M04-1.7 | Must | As an admin, I want to edit an existing question of any type, so that mistakes can be corrected. | FN-M04-1.7.1–1.7.10 |
| US-M04-13 | FT-M04-2.1 | Must | As an admin, I want to import MCQ questions from a CSV with default subject, level and difficulty, so that I can add many at once. | FN-M04-2.1.1–2.1.7, 2.1.9, 2.1.10 |
| US-M04-14 | FT-M04-2.1 | Should | As an admin, I want to see past imports, so that I know what was imported. | FN-M04-2.1.1, 2.1.8 |
| US-M04-15 | FT-M04-2.2 | Should | As an admin, I want a quality dashboard with score buckets, per-subject and per-level averages and the low-score list, so that I can target poor questions. | FN-M04-2.2.1–2.2.6 |
| US-M04-16 | FT-M04-2.2 | Could | As an admin, I want to re-run the quality audit, so that scores are current. | FN-M04-2.2.7, 2.2.8 |
| US-M04-17 | FT-M04-3.1 | Must | As a student in an MCQ quiz, I want to report a question with reasons and a comment, so that wrong questions get fixed. | FN-M04-3.1.1, 3.1.3, 3.1.4, 3.1.6, 3.1.7, 3.1.8, 3.1.9 |
| US-M04-18 | FT-M04-3.1 | Must | As a student in structured practice, I want to report a question with structured-specific reasons, so that marking problems get fixed. | FN-M04-3.1.2, 3.1.3, 3.1.5, 3.1.6, 3.1.7, 3.1.8, 3.1.9 |
| US-M04-19 | FT-M04-3.2 | Must | As an admin, I want to review reports by status with the question, reasons and comments, so that I can triage them. | FN-M04-3.2.1–3.2.12, 3.2.16, 3.2.17, 3.2.18 |
| US-M04-20 | FT-M04-3.2 | Must | As an admin, I want to mark a report fixed, dismiss it and reactivate the question, or deactivate the question at once, so that reports are resolved. | FN-M04-3.2.13, 3.2.14, 3.2.15, 3.2.19 |
| US-M04-21 | FT-M04-3.3 | Should | As a student, I want to see my reports and their status, so that I know what happened. | FN-M04-3.3.1, 3.3.2, 3.3.3, 6.3.2 |
| US-M04-22 | FT-M04-4.1 | Must | As an admin, I want to list and filter structured questions and reach the teacher-portal create form, so that I can oversee the structured bank. | FN-M04-4.1.1–4.1.9 |
| US-M04-23 | FT-M04-4.2 | Must | As an admin, I want to view a structured question with its sub-questions, marks and model answers, so that I can check it. | FN-M04-4.2.1–4.2.6 |
| US-M04-24 | FT-M04-5.1 | Should | As an admin, I want to see teachers' uploaded papers, download them and set their processing status and note, so that papers become questions. | FN-M04-5.1.1–5.1.8 |
| US-M04-25 | FT-M04-5.2 | Should | As an admin, I want to see questions that need a diagram by subject and school, so that I can complete them. | FN-M04-5.2.1–5.2.5, 5.2.8, 5.2.9, 5.2.10 |
| US-M04-26 | FT-M04-5.2 | Should | As an admin, I want to upload a diagram for a flagged question or dismiss the flag, so that the audit list shrinks. | FN-M04-5.2.6, 5.2.7, 5.2.11 |
| US-M04-27 | FT-M04-5.3 | Could | As an admin, I want to review AI master notes and approve, regenerate or clear their flag, so that note quality improves. | FN-M04-5.3.1–5.3.8 |
| US-M04-28 | FT-M04-6.1 / 6.2 | Must | As an admin, I want to reach every M04 screen from the admin and user-portal menus with the right page title, so that I always know where I am. | FN-M04-6.1.1–6.1.4, 6.2.1–6.2.5 |
| US-M04-29 | FT-M04-6.3 | Must | As the owner, I want M04 admin screens closed to non-admins and every count and subject/level list to agree, so that data is protected and trusted. | FN-M04-6.3.1, 6.3.4, 6.3.5 |
| US-M04-30 | cross-cutting | Must | As an admin or student on a phone, tablet or desktop, I want every M04 screen to fit my screen, so that I can work anywhere. | All screen FNs; DV-M04-09 |
| US-M04-31 | FT-M04-6.3 | Must | As a student practising (M05 drills and revision, M06 SPM), I want to be served exactly the active, approved questions of the one question bank, so that what admins create, fix or deactivate is what I see. | FN-M04-6.3.6, 6.3.7, 3.2.17 |
| US-M04-34 | FT-M04-6.3 | Must | As a player (M16) and an analytics reader (M17, M18), I want the Jutawan questions and the coverage, contribution and import figures to come from M04 stores, so that advertised counts, playable pools and dashboards agree. | FN-M04-6.3.12, 6.3.13 |
| US-M04-33 | FT-M04-6.3 | Must | As a teacher (M10) and an analytics reader (M08, M11), I want to write questions and structured questions into the one bank and read my contributions, the teacher databank, SP availability and chapter labels from it, so that every module shows the same questions. | FN-M04-6.3.9, 6.3.10, 6.3.11 |
| US-M04-32 | FT-M04-1.5 | Must | As an admin, I want PKSK questions kept out of the question-bank list and counts but still openable on the detail page, so that the two banks do not mix. | FN-M04-1.5.10, 1.1.19 |

### Acceptance criteria

**US-M04-01 — Question list**
- **AC-M04-01.1** Given I open `/admin/questions`, when it loads, then I see h1 "📚 Pengurusan Soalan", subtitle "Urus bank soalan untuk platform PRESTASIPLUS", the shell header "Pengurusan Soalan" with no subtitle (DV-M04-02) and the tab title "Pengurusan Soalan"; "Senarai Soalan" is highlighted in the sidebar.
- **AC-M04-01.2** Given the width is ≥640px, when the page loads, then the create button reads "Tambah Soalan" (`fa-plus`); below 640px it reads "Tambah". Both open `/admin/questions/create`.
- **AC-M04-01.3** Given the summary card, when it loads, then it reads "Ringkasan Bank Soalan" and "Jumlah: **{n}** soalan", where {n} equals the unfiltered pager total and the S6 "Jumlah Soalan" (DV-M04-04).
- **AC-M04-01.4** Given the table, when it loads, then it has the columns [checkbox], "#", "Soalan", "Subjek", "Tahap", "Kesukaran", "Status", "Tindakan" (displayed upper case), 20 rows, newest created first (ties by id ascending; e.g. 564159, 564160, 564161, then older rows).
- **AC-M04-01.5** Given a row, when it renders, then "Soalan" shows the text cut to 80 characters + "...", then the badges, each an icon + text: `fa-check-circle` "DSKP" (green) when tagged or `fa-book-open` "Latihan Tambahan" when not; the compliance badge upper case (VERIFIED, QUARANTINED, PENDING MAPPING, DRAFT — DV-M04-08); "AI Verified" when flagged; then a small line "Source: {TEXTBOOK|DSKP|TRIAL|MARKING SCHEME|TIADA}" and the source file name when there is one.
- **AC-M04-01.6** Given a row, when it renders, then "Subjek" is plain text with the same indigo `fa-book` icon on every row (not a pill, not the subject's tile icon), "Tahap" the level name (e.g. "Tingkatan 5"), "Kesukaran" 5 stars with the first {difficulty} filled, and "Status" a pill ("Diluluskan", or "Arkib" for archived; other statuses use the filter labels Draf, Menunggu Semakan, Ditolak — INFERRED) with "ACTIVE" or "INACTIVE" beneath.
- **AC-M04-01.7** Given more than 20 questions at ≥640px, when I view the pager, then I see "Showing {from} to {to} of {total} results" (total without separators, e.g. "465278" style), page links with "..." gaps (1–10 … last two) and chevrons; below 640px only "« Previous" / "Next »", plain text when unavailable. Page links keep active filters (e.g. `?status=archived&page=2`).

**US-M04-02 — Subject tiles**
- **AC-M04-02.1** Given the summary card, when it loads, then "Subjek Teras" (M03 subjects with `isCore`) shows 7 tiles (Bahasa Melayu, Bahasa Inggeris, Matematik, Sains, Sejarah, Pendidikan Islam, Pendidikan Moral) and "Subjek Elektif" shows 24 tiles in subject-id order, including "Bahasa Cina" and "Bahasa Tamil" (`fa-language`) after "Bahasa Arab" (DV-M04-13).
- **AC-M04-02.2** Given a tile, when it renders, then it shows the subject icon, the name cut to about 12 characters with "..." when longer (e.g. "Bahasa Melay..."), the total, and "{n} lulus" only when {n} > 0.
- **AC-M04-02.3** Given I click a tile, when the list reloads, then the URL is `?subject_id={id}`, only that subject's questions show, the tile has the active style (indigo border, indigo-50 background, shadow) and the link `fa-times-circle` "Padam filter subjek — tunjuk semua" appears; clicking it returns to `/admin/questions`.

**US-M04-03 — Filters and search**
- **AC-M04-03.1** Given the filter form, when it loads, then I see "Subjek" ("Semua Subjek" + 31 subjects, id order), "Tahap" ("Semua Tahap" + Darjah 1–6, Tingkatan 1–5), "Kesukaran" ("Semua", "⭐ Sangat Mudah", "⭐⭐ Mudah", "⭐⭐⭐ Sederhana", "⭐⭐⭐⭐ Sukar", "⭐⭐⭐⭐⭐ Sangat Sukar"), "Status" ("Semua Status", "Draf", "Menunggu Semakan", "Diluluskan", "Ditolak", "Diarkibkan"), "DSKP" ("Semua", "Ada DSKP Tag", "Belum Ditag"), "Compliance" ("Semua", "Verified", "Pending Mapping", "Quarantined", "Rejected", "Draft", "Tiada Source PDF", "AI Verified"), "Source" ("Semua", "Textbook", "DSKP", "Trial", "Skema") and "Cari" (placeholder "Cari soalan...") with an icon-only `fa-search` submit.
- **AC-M04-03.2** Given I set filters and submit, when the list reloads, then the URL carries `subject_id`, `education_level_id`, `difficulty_level`, `status`, `dskp_filter`, `compliance_filter`, `source_filter`, `search`, the controls keep their values and only questions matching all of them are listed.
- **AC-M04-03.3** Given `compliance_filter=missing_source`, when the list reloads, then only questions with no source file show: their "Source: {TYPE}" line has no file name after it (e.g. "Source: TEXTBOOK"); "Source: TIADA" appears only when the source type itself is empty (e.g. `compliance_filter=draft` rows). `verified_generated` lists "AI Verified" questions.
- **AC-M04-03.4** Given the URL has `type`, `question_type` or `sort`, when the list loads, then those parameters are ignored.
- **AC-M04-03.5** Given no question matches (e.g. `?search=zzqxv` or `?status=draft` with no drafts), when the list reloads, then the table and pager are not shown; I see `fa-inbox`, "Tiada soalan dijumpai" and the indigo text link "Tambah Soalan Pertama" (`fa-plus`) → create.

**US-M04-04 — Bulk actions**
- **AC-M04-04.1** Given I tick one row, when the selection changes, then the bulk bar appears with `fa-check-double` "1 soalan dipilih", the select ("Pilih Tindakan", "Luluskan", "Tolak", "Arkibkan", "Padam") and "Laksanakan"; with nothing ticked the bar is hidden.
- **AC-M04-04.2** Given I tick the header checkbox, when it applies, then all rows on the current page are ticked and the bar reads "20 soalan dipilih"; unticking clears them.
- **AC-M04-04.3** Given no action is chosen, when I press "Laksanakan", then the browser's native required-field bubble on the action select stops the submit (e.g. Chrome "Please select an item in the list."); no dialog appears and nothing is sent. The script text "Sila pilih tindakan terlebih dahulu" is unreachable on live and is not shown.
- **AC-M04-04.4** Given I choose "Arkibkan" with 3 ticked, when I press "Laksanakan", then the confirm reads "Adakah anda pasti mahu mengarkibkan 3 soalan?" (verbs: meluluskan, menolak, mengarkibkan, memadamkan); cancelling sends nothing.
- **AC-M04-04.5** (INFERRED) Given I accept, when the request completes, then the list reloads with filters kept, the ticked questions have the new status (approved / rejected / archived) or are gone (delete), and a success flash shows (UNVERIFIED COPY).

**US-M04-05 — Row actions**
- **AC-M04-05.1** Given a row, when I click `fa-eye` (title "Lihat") or `fa-edit` (title "Edit"), then `/admin/questions/{id}` or `/admin/questions/{id}/edit` opens.
- **AC-M04-05.2** Given I click `fa-trash` (title "Padam"), when the confirm "Adakah anda pasti mahu memadamkan soalan ini?" appears and I cancel, then nothing changes.
- **AC-M04-05.3** (INFERRED) Given I accept, when the request completes, then the question is removed, the list reloads with filters kept and shows a success flash (UNVERIFIED COPY).

**US-M04-06 — Create question (common fields)**
- **AC-M04-06.1** Given I open `/admin/questions/create`, when it loads, then I see the back arrow (→ list), h1 "✨ Tambah Soalan Baru", "Isi maklumat di bawah untuk menambah soalan baharu", and the shell header "Tambah Soalan Baru" with no subtitle (DV-M04-02).
- **AC-M04-06.2** Given card "Maklumat Soalan", when it loads, then it has "Subjek *" ("Pilih Subjek" + 31), "Tahap Pendidikan *" ("Pilih Tahap Pendidikan" + 11), "DSKP Tagging (Pilihan)", "Tahap Kesukaran *" (5 cards "Sangat Mudah"…"Sangat Sukar" with 1–5 stars, none selected), "Jenis Soalan *" ("Objektif (MCQ)" selected), "Teks Soalan *" (4 rows, "Masukkan teks soalan di sini...", hint "Minimum 10 aksara") and "Gambar Soalan (Pilihan)" ("Klik untuk muat naik gambar" / "JPG, PNG, WebP — Maks 2MB").
- **AC-M04-06.3** Given I choose an image, when it is read, then a preview replaces the prompt with a remove button (`fa-times`); removing clears the file and restores the prompt.
- **AC-M04-06.4** Given card "Maklumat Tambahan", when it loads, then "Penjelasan" (3 rows, "Penjelasan untuk jawapan (pilihan)", hint "Penjelasan akan ditunjukkan kepada pelajar selepas menjawab"), "Bahasa" ("Bahasa Melayu" selected, "English") and "Nilai Mata" (1, min 1, hint "Mata yang diperoleh jika jawapan betul") show, then "Batal" (→ list) and "Simpan Soalan".
- **AC-M04-06.5** Given a required field is empty (Subjek, Tahap Pendidikan, Tahap Kesukaran, Teks Soalan, or for MCQ the four options), when I press "Simpan Soalan", then the browser's native required-field bubble stops the submit.
- **AC-M04-06.6** (INFERRED) Given the form passes server validation (text ≥10 characters, image JPG/PNG/WebP ≤2 MB, points ≥1), when it is saved, then I return to the list with a success flash (UNVERIFIED COPY) and the question appears first; on a server error the form comes back with my input and the error under the field (UNVERIFIED COPY).

**US-M04-07 — Type-specific answers**
- **AC-M04-07.1** Given "Objektif (MCQ)", when the form shows, then card "Pilihan Jawapan" has exactly 4 rows A–D, each with a radio (A checked), "Pilihan A *"…"Pilihan D *", a text input "Masukkan pilihan A"…"D" and a "Gambar" image picker; no add/remove; and the note "**Nota:** Pilih butang radio di sebelah pilihan yang merupakan jawapan yang betul."
- **AC-M04-07.2** Given "Betul / Salah", when selected, then the MCQ card hides and card "Jawapan Betul / Salah" shows cards "Betul" (`fa-check-circle`) and "Salah" (`fa-times-circle`), none selected and not required; the MCQ options are no longer required.
- **AC-M04-07.3** Given "Jawapan Pendek" or "Isi Tempat Kosong", when selected, then one card shows with heading "Jawapan Pendek" or "Jawapan Isi Tempat Kosong", "Jawapan Betul *" ("Masukkan jawapan betul", not browser-required) and "Jawapan Alternatif (pisahkan dengan koma)" ("cth: jawapan1, jawapan2", hint "Jawapan lain yang juga diterima").
- **AC-M04-07.4** Given "Esei / Subjektif", when selected, then card "Jawapan Contoh (Esei)" shows "Jawapan Model (pilihan — ditunjukkan sebagai rujukan)" (6 rows, "Tulis jawapan contoh di sini...").
- **AC-M04-07.5** Given I switch back to MCQ, when the card returns, then the options I typed are still there (hidden cards keep their values; all fields are posted, as live).

**US-M04-08 — Arabic/Jawi keyboard**
- **AC-M04-08.1** Given the create form, when it loads, then a 36×36px keyboard button (`fa-keyboard`, title "Papan kekunci Arab / Jawi") sits inside the bottom-left of "Teks Soalan"; the edit form has none. Pressing it opens the panel (button shown blue/active); pressing it again closes the panel.
- **AC-M04-08.2** Given I open it, when the panel shows, then "عربي" is active, the caption reads "Papan Kekunci Arab", the three Arabic rows, the harakat row (9 keys, titles "Fathah (atas)" … "Superscript Alif (alif kecil)") and "SPACE", "ال", "ة", backspace and newline keys show, and the textarea switches to right-to-left with the Scheherazade New font.
- **AC-M04-08.3** Given I press "جاوي", when the mode changes, then the caption reads "Papan Kekunci Jawi" and the Jawi letters appear inside the rows: row 1 "… ف ڤ غ ڠ ع ه خ ح چ ج د", row 2 "… ن ڽ م ك ݢ ط", row 3 "… و ۏ ز ظ".
- **AC-M04-08.4** Given the cursor is inside the text, when I press a key, then its character is inserted at the cursor (backspace deletes the character before it, newline inserts a line break) and focus stays in the textarea.
- **AC-M04-08.5** Given the panel is open, when I press Esc, `fa-times` (32×32px) or the toggle, then it closes and the textarea keeps `dir="rtl"` and the Arabic font. Below 640px it is a bottom sheet over a backdrop and tapping the backdrop closes it; at ≥640px it opens below the textarea, or above it when `rect.bottom + 8 + 360` exceeds the window height, clamped 8px/12px inside the viewport.

**US-M04-09 — DSKP tagging**
- **AC-M04-09.1** Given Subjek and Tahap are both set, when either changes, then Bidang, SK and SP are reset and "Bidang" loads "-- Pilih Bidang --" + "{code} - {name}" rows (e.g. Sains + Tingkatan 5: "T5-SUB4-TEXTBOOK - Sains T5 - Sokongan Bab Buku Teks", "1.0 - Mikroorganisma"…); with only one set, Bidang shows only its placeholder.
- **AC-M04-09.2** Given no Bidang is chosen, when I look at SK and SP, then both are disabled; choosing a Bidang loads "-- Pilih SK --" + "{code} - {description}" and enables SK; choosing an SK loads and enables SP.
- **AC-M04-09.3** Given I choose an SP, when it is set, then `fa-check-circle` "DSKP tagged" appears and the SP id is posted as `dskp_sp_id`.
- **AC-M04-09.4** Given I edit a tagged question, when the form opens, then Bidang, SK and SP show the saved values (lists loaded in a chain), "DSKP tagged" shows, and saving without changes keeps the tag (DV-M04-15; on live the three selects show their placeholders and the save posts an empty `dskp_sp_id` — audit screenshot `s4-dskp-preload-placeholders-1280.png`).
- **AC-M04-09.5** Given a Bidang is selected on the edit form, when I press "Buang tag DSKP" (`fa-times`), then Bidang, SK and SP reset to their placeholders and the saved question loses its tag (DV-M04-06; shown whenever a Bidang is selected, not only after clearing SP).
- **AC-M04-09.6** Given a full tag Bidang → SK → SP on S2, when I clear Subjek or Tahap, then Bidang shows only "-- Pilih Bidang --", while SK and SP keep their chosen values and options and stay enabled, "DSKP tagged" stays visible and the old SP id is still posted as `dskp_sp_id` (as live, AUD-M04-02). Setting both again resets all three.

**US-M04-10 — Question detail**
- **AC-M04-10.1** Given I open `/admin/questions/{id}`, when it loads, then I see the back arrow, h1 "📝 Detail Soalan", "Soalan #{id}", "Edit" (`fa-edit`) and "Padam" (`fa-trash`); the shell header reads "Detail Soalan" with no subtitle (DV-M04-02); "Padam" asks "Adakah anda pasti mahu memadamkan soalan ini?".
- **AC-M04-10.2** Given an MCQ, when it loads, then card "Soalan" shows the status pill ("Diluluskan"; archived "Diarkibkan") and the full text, and card "Pilihan Jawapan" shows A–D bubbles with the correct one green-tinted and marked `fa-check-circle` "Jawapan Betul".
- **AC-M04-10.3** Given the question has an explanation, when it loads, then card "Penjelasan" (`fa-lightbulb`) shows it; without one the card is absent.
- **AC-M04-10.4** Given the sidebar, when it loads, then "Maklumat" shows (labels displayed upper case) SUBJEK, TAHAP PENDIDIKAN, TAHAP KESUKARAN (stars + "(n/5)"), DSKP (three truncated lines Bidang / SK / SP, or "Belum ditag"), BAHASA, NILAI MATA ("{n} mata") and DICIPTA PADA (`dd/mm/yyyy HH:MM`).
- **AC-M04-10.5** Given the question has never been attempted, when it loads, then the card "Soalan Baharu" / "Soalan ini belum digunakan dalam sebarang kuiz atau latihan." shows. (INFERRED) For a used question an attempt-statistics card shows instead (UNVERIFIED COPY).
- **AC-M04-10.6** (INFERRED) Given a draft or pending-review question, when the detail loads, then status buttons show; pressing one asks "Adakah anda pasti mahu mengubah status soalan ini?" and on OK sets `pending_review` or `approved`. (Button labels UNVERIFIED COPY.)
- **AC-M04-10.7** (INFERRED) Given a true/false, short-answer, fill-blank or essay question, when the detail loads, then instead of "Pilihan Jawapan" the page shows its stored answer (Betul/Salah; correct and alternative answers; model answer).

**US-M04-11 — AI explanation**
- **AC-M04-11.1** Given no AI explanation exists, when the detail loads, then card "Penjelasan AI" (`fa-robot`, "Dijana AI · Boleh ada kesilapan, sahkan dengan cikgu") shows "Belum ada Penjelasan AI untuk soalan ini. Klik butang untuk jana." and "Jana Penjelasan AI".
- **AC-M04-11.2** Given I press "Jana Penjelasan AI", when the request runs, then the button area is replaced by `fa-spinner` "Sedang menjana penjelasan... (anggaran 5-15 saat)".
- **AC-M04-11.3** Given the (simulated, D4) request succeeds, when it completes, then the page reloads and the card shows the canned markdown explanation rendered with headings, lists and tables.
- **AC-M04-11.4** Given the request fails, when it completes, then `fa-exclamation-triangle` and a message show beside the re-shown empty state (text and "Jana Penjelasan AI" button): a JSON reply with `message` → that message; a JSON reply that is not ok and has no message (incl. HTTP 200 `{ok:false}`) → "HTTP {status}"; a non-JSON reply → the browser's JSON-parse error text (e.g. "Unexpected token '<', \"<!DOCTYPE \"... is not valid JSON"); a network failure → "Failed to fetch". "Gagal jana penjelasan" is effectively never shown.
- **AC-M04-11.5** (INFERRED) Given an explanation exists, when I press the regenerate button, then the confirm "Jana semula Penjelasan AI? Versi lama akan ditimpa." appears; on OK the explanation is replaced (`force=1`).

**US-M04-12 — Edit question**
- **AC-M04-12.1** Given I open `/admin/questions/{id}/edit`, when it loads, then I see the back arrow (→ detail), h1 "✏️ Edit Soalan", "Kemaskini maklumat soalan #{id}", every field pre-filled, no "Jenis Soalan" select and no keyboard button; the shell header reads "Edit Soalan" with no subtitle (DV-M04-02).
- **AC-M04-12.2** Given an MCQ, when the form loads, then "Pilihan Jawapan" shows A–D pre-filled with the saved correct radio, and all four options are required.
- **AC-M04-12.3** Given a question of another type, when the form loads, then its type's answer card shows pre-filled (as on create) and no MCQ fields are required (DV-M04-05).
- **AC-M04-12.4** Given the question image, when I choose a new one, then the prompt reads "Tukar gambar"; when I remove it, `remove_question_image=1` is posted; option images work the same with `remove_option_image_0..3`.
- **AC-M04-12.5** Given the form, when I press "Batal", then the detail page opens; "Kemaskini Soalan" saves (INFERRED: detail or list with a success flash, UNVERIFIED COPY).

**US-M04-13 — CSV import**
- **AC-M04-13.1** Given I open `/admin/questions/import`, when it loads, then the shell header reads "Import Soalan Secara Pukal" / "Muat naik fail CSV untuk menambah soalan secara pukal" and the links "Sejarah Import" (`fa-history`) and "Kembali" (→ list) show.
- **AC-M04-13.2** Given card "Muat Naik Fail CSV", when it loads, then "Fail CSV *" (accepts `.csv,.txt`, required), "Saiz maksimum: 5MB. Format: CSV atau TXT", "Tetapan Lalai (Opsional)" / "Nilai ini digunakan jika kolum berkaitan tiada dalam CSV.", "Subjek Lalai" and "Tahap Pendidikan" ("-- Tidak ditetapkan --"), "Kesukaran" with "Mudah" selected, "Soalan disimpan sebagai draf" and "Mula Import" show.
- **AC-M04-13.3** Given the side cards, when they load, then "Muat Turun Template" ("Template CSV dengan contoh soalan", "Download Template"), "Format CSV" (required and optional column lists; `subject_id` and `education_level_id` carry the suffix " (atau guna Tetapan Lalai)" — DV-M04-07, PROPOSED COPY) and "Tips" (4 bullets) show.
- **AC-M04-13.4** Given no file is chosen, when I press "Mula Import", then the native required bubble stops the submit.
- **AC-M04-13.5** (INFERRED) Given a valid UTF-8 CSV ≤5 MB, when I import it, then each row becomes an MCQ `draft` question (option letters A–D → index 0–3; missing subject, level or difficulty taken from the defaults) and a result message with created and failed counts shows (UNVERIFIED COPY). A row with no subject or level and no default is rejected (DV-M04-07).
- **AC-M04-13.6** (INFERRED) Given I press "Download Template", when the file downloads, then it is a CSV with the header row `question_text,option_a,option_b,option_c,option_d,correct_answer,subject_id,education_level_id,difficulty_level,marks,explanation` and sample rows.

**US-M04-14 — Import history**
- **AC-M04-14.1** Given I press "Sejarah Import", when the page opens, then instead of the live HTTP 500 page I see a read-only page "Sejarah Import" with a table of past import runs ("Tarikh", "Fail", "Diimport", "Gagal"), newest first, or "Tiada sejarah import."; the page has no actions other than "Kembali" (DV-M04-01; all four strings and the empty text are PROPOSED COPY).
- **AC-M04-14.2** Given the history page, when I press "Kembali", then the import page opens.

**US-M04-15 — Quality dashboard**
- **AC-M04-15.1** Given I open `/admin/questions/quality`, when it loads, then the shell header reads "Dashboard Kualiti Soalan" / "Analisa kualiti keseluruhan bank soalan" and 4 KPI cards show "Jumlah Soalan", "Purata Skor" (one decimal), "Cemerlang (76-100)", "Perlu Tindakan Aktif (≤ 50)"; "Jumlah Soalan" equals the S1 total (DV-M04-04).
- **AC-M04-15.2** Given the bucket cards, when they load, then the titles display upper case "SKOR 51-75", "SKOR ≤ 50", "LEGACY GENERIC" (CSS) with their counts and exact descriptions; the Legacy Generic text shows the backtick characters literally (&#96;tracking_a_feed_20260308&#96;, &#96;spm_tracking_auto_seed_v1&#96;, &#96;source_type=ai_generated&#96;).
- **AC-M04-15.3** Given "Taburan Kualiti", when it loads, then a stacked bar shows the share of Cemerlang / Baik / Lemah / Kritikal with a percentage label on each non-empty segment and the 4-item legend.
- **AC-M04-15.4** Given "Mengikut Subjek", when it loads, then rows show Subjek, Soalan, Purata (coloured pill) and Cemerlang (%), sorted by Purata descending; "Mengikut Tingkatan" shows the 11 levels in order with "{n} soalan · {avg}" and a bar.
- **AC-M04-15.5** Given "Soalan Untuk Semakan Aktif", when it loads, then it reads "Memaparkan hanya soalan skor ≤ 50 selepas menolak sumber generic legacy.", a pill "{n} soalan", and a table ID ("#{id}"), Soalan, Subjek, Tingkatan, Sumber, Skor (pill) with "Edit" → the edit page; legacy generic questions are excluded.

**US-M04-16 — Re-run audit**
- **AC-M04-16.1** Given I press "Jalankan Audit Semula", when the form submits, then the button is disabled and shows `fa-spinner` "Sedang audit..."; there is no confirm.
- **AC-M04-16.2** (INFERRED) Given the audit completes, when the page reloads, then the scores and counts are recomputed and a flash shows (UNVERIFIED COPY).

**US-M04-17 — Report an MCQ**
- **AC-M04-17.1** Given an MCQ quiz question, when I press `fa-flag` "Lapor Soalan", then the modal opens with a cleared form: h3 "Lapor Soalan", subtitle "Soalan ini akan dinyahaktifkan sementara", close `fa-times`.
- **AC-M04-17.2** Given the modal, when it shows, then "Sebab Laporan *" lists 7 checkbox cards with label + description: "Jawapan tidak tepat" / "Jawapan yang ditandakan betul sebenarnya salah"; "Soalan mengelirukan" / "Ayat soalan tidak jelas atau mengelirukan"; "Set jawapan tidak tepat" / "Pilihan jawapan yang diberikan tidak betul"; "Pilihan jawapan tidak lengkap" / "Soalan tiada cukup pilihan jawapan"; "Soalan berulang / pendua" / "Soalan yang sama muncul lebih dari sekali"; "Kesalahan ejaan / taip" / "Ada kesilapan ejaan dalam soalan atau jawapan"; "Lain-lain" / "Sebab lain yang tidak disenaraikan". Several can be ticked; ticked cards are tinted (red, amber, orange, indigo for typo, slate for other).
- **AC-M04-17.3** Given no reason is ticked, when I look at "Hantar Laporan", then it is disabled; ticking one enables it.
- **AC-M04-17.4** Given "Komen Tambahan (pilihan)", when I type, then the counter shows "{n}/500" and input stops at 500 characters.
- **AC-M04-17.5** Given I press "Batal", the backdrop, `fa-times` or Esc, when the modal closes, then nothing is sent.
- **AC-M04-17.6** Given I press "Hantar Laporan", when sending, then it is disabled and reads "Menghantar..." with a spinner; on success the modal shows the green check, "Terima Kasih!", the server message (fallback "Laporan berjaya dihantar.") and "Tutup"; on a network error the message reads "Ralat. Sila cuba lagi.".
- **AC-M04-17.7** (INFERRED) Given the report is saved, when the admin opens S7, then it is under "Menunggu" and the MCQ is inactive (badge "Dinyahaktif").
- **AC-M04-17.8** Given a host page mounts the modal with `source`, `failureText` and `tints`, when a report is sent, then the request carries that `source` (e.g. `revision` from M05 S7; default `spm` for MCQ, `structured_attempt` for structured), a network failure shows that `failureText` (default "Ralat. Sila cuba lagi.") in the "Terima Kasih!" view, and ticked reasons use the given tints (default the M04 set; M05 S7 passes yellow for `missing_options` and blue for `duplicate`).
- **AC-M04-17.9** Given a host page mounts the modal without the new props, when it is used, then it behaves exactly as live (MCQ `source:'spm'`, structured `source:'structured_attempt'`, default failure text and tints).

**US-M04-18 — Report a structured question**
- **AC-M04-18.1** Given structured practice, when I press the small `fa-flag` "Lapor" (title "Lapor soalan ini"), then the modal opens with subtitle "Soalan ini akan dinyahaktifkan selepas 3 laporan".
- **AC-M04-18.2** Given the structured modal, when it shows, then the reasons are "Skema jawapan tidak tepat" / "Keyword/rubrik yang ditandakan tidak sepadan dengan jawapan sebenar"; "Soalan mengelirukan" / "Ayat soalan atau arahan tidak jelas"; "Markah tidak adil" / "Pembahagian markah atau pemarkahan auto tidak tepat"; "Kesalahan ejaan / taip" / "Ada kesilapan ejaan dalam soalan atau skema"; "Lain-lain" / "Sebab lain yang tidak disenaraikan".
- **AC-M04-18.3** (INFERRED) Given 3 reports on the same structured question, when the third is saved, then the question becomes inactive; with fewer it stays active.

**US-M04-19 — Report triage view**
- **AC-M04-19.1** Given I open `/admin/question-reports`, when it loads, then h1 `fa-flag` "Laporan Soalan", the subtitle, the shell header "Laporan Soalan" with no subtitle (DV-M04-02) and 5 tabs with counts show; "Menunggu ({n})" is active (solid amber) by default.
- **AC-M04-19.2** Given a tab, when I click it, then the URL is `?status=pending|reviewed|fixed|dismissed|all`, the tab turns solid (amber, blue, emerald, slate, violet) and only those reports show, newest first, with no pager.
- **AC-M04-19.3** Given a report card, when it renders, then the badge row shows, in order: status badge, reason-category badge (Lain-lain / Tak Jelas / Jawapan Salah), "Dinyahaktif" when the question is inactive, the source-set badge (`fa-database`) when set, "Oleh: {name}", the relative time, "Bilik: {code}" when from Papan Bijak, and "ID Soalan: {id}"; below it the reason detail pill(s).
- **AC-M04-19.4** Given a fixed report whose question was removed from the live bank, when it renders, then its status badge is `fa-ban` "Dikeluarkan" (red) instead of "Diperbaiki".
- **AC-M04-19.5** Given the question block, when it renders, then a structured question shows "Soalan Struktur #{id}:" + stimulus; an MCQ "Soalan #{id}:" + text and options "A. …"–"D. …" with the correct one marked `fa-check`; then "{Subjek} — {Tingkatan N}" and "Compliance: {code}"; a deleted question shows "Soalan tidak dijumpai".
- **AC-M04-19.6** Given a comment or admin notes exist, when the card renders, then "Komen pelajar:" + comment and "Status tindakan admin:" + notes show.
- **AC-M04-19.7** Given a legacy reason stored as the raw code "unclear", when the card renders, then the pill reads "Soalan mengelirukan"; on a structured report every reason code uses the structured label — `wrong_options` "Markah tidak adil" (report 4, question 3703) and `wrong_answer` "Skema jawapan tidak tepat" (report 3, question 2509) (DV-M04-08; live shows the MCQ labels on both).
- **AC-M04-19.8** Given a pending or reviewed card, when it renders, then the action column shows the notes textarea, "Tandakan Selesai", "Tolak & Aktifkan Semula", the question link ("Lihat Soalan Struktur #{id}" → S9, or "Edit Soalan #{id}" → S4), "Buka Soalan Sama" (new tab, practice URL) and, only while the question is active, "Nyahaktif Segera". Fixed, removed and dismissed cards have no actions.
- **AC-M04-19.9** Given a tab with no reports, when it loads, then `fa-check-double` "Tiada laporan buat masa ini" shows; an unknown `status` value (e.g. `?status=zzz`) shows the same block and no tab is active.

**US-M04-20 — Report actions**
- **AC-M04-20.1** Given I type a note and press "Tandakan Selesai", when it submits (no confirm), then (INFERRED) the report moves to "Diperbaiki" with my note, and the page reloads on the same tab with a flash (UNVERIFIED COPY).
- **AC-M04-20.2** Given I press "Tolak & Aktifkan Semula", when it submits (no confirm), then (INFERRED) the report becomes "Ditolak" with the note "Soalan dan jawapan disemak — tiada masalah" and the question is active again.
- **AC-M04-20.3** Given I press "Nyahaktif Segera", when it submits (no confirm), then (INFERRED) the report becomes "Disemak" with the note "Dinyahaktifkan segera oleh admin" and the question becomes inactive ("Dinyahaktif" badge; the button disappears).
- **AC-M04-20.4** Given any action completes, when the page reloads, then the tab counts reflect the new statuses.

**US-M04-21 — My reports**
- **AC-M04-21.1** Given I open `/laporan-soalan`, when it loads, then the user-portal header reads "Laporan Soalan Saya" / "Jejak status laporan soalan yang anda hantar" and 5 counter cards "Jumlah", "Menunggu", "Disemak", "Diperbaiki", "Ditolak" show my counts.
- **AC-M04-21.2** Given I have sent no reports, when it loads, then "📋", "Tiada Laporan" and "Anda belum menghantar sebarang laporan soalan." show.
- **AC-M04-21.3** (INFERRED) Given I have reports, when it loads, then one row per report shows the question reference, my reasons, the status and any admin note (UNVERIFIED COPY); other users' reports never show.

**US-M04-22 — Structured list**
- **AC-M04-22.1** Given I open `/admin/structured-questions`, when it loads, then h1 "Soalan Berstruktur", "Semua soalan berstruktur SPM dalam sistem", "Tambah Soalan" (→ `/guru/soalan-berstruktur/cipta`), cards "Jumlah Soalan" and "Published", and "Agihan Mengikut Subjek" pills "{Subjek}: {n}" (alphabetical, subjects with ≥1 question) show.
- **AC-M04-22.2** Given the filter, when it loads, then "Subjek" ("Semua Subjek" + 31 alphabetical), "Tingkatan" ("Semua" + 11), "KBAT" ("Semua KBAT", "Memahami (L2)", "Mengaplikasi (L3)", "Menganalisis (L4)", "Menilai/Mencipta (L5)") and "Cari" show; after filtering, a "Reset" link (→ unfiltered) appears.
- **AC-M04-22.3** Given the table, when it loads, then 25 rows show "#", "Stimulus / Soalan" (100 characters + "..."), "Subjek" pill, "Tgk", "KBAT" pill "L{n}" (1–6 in the data), "Markah" "{n}m", "Sub-Q" and "Lihat" (`fa-eye`) → detail; below 640px Subjek, Tgk and Markah are hidden, below 768px Sub-Q is hidden.
- **AC-M04-22.4** Given the list, when it loads, then the counter "Menunjukkan {from}–{to} daripada {n} soalan" and the English pager show.
- **AC-M04-22.5** Given no structured question matches, when the list reloads, then the table shows one row "Tiada soalan berstruktur ditemui" and the counter reads "Menunjukkan 0 daripada 0 soalan" (DV-M04-12, PROPOSED COPY).

**US-M04-23 — Structured detail**
- **AC-M04-23.1** Given I open `/admin/structured-questions/{id}`, when it loads, then "Kembali ke senarai", pills subject, "Tingkatan N", "KBAT: {label} (L{n})" (labels per BR-M04-28; L1 "Mengingat" and L6 "Mencipta" INFERRED), "{total} Markah", "ID: #{id}", box label displayed "STIMULUS / KONTEKS SOALAN" (CSS upper case) with the stimulus (line breaks kept) and the meta line "Dicipta oleh: {name}", "{dd Mon yyyy}", "Visibiliti: Public", "Published" show.
- **AC-M04-23.2** Given the sub-questions, when they render, then h2 reads "Bahagian Soalan ({n} sub-soalan)" and each card shows its label ("3(A)" or "A"), text, marks "{n}m" and the box "JAWAPAN MODEL" (CSS upper case) + answer.
- **AC-M04-23.3** Given the actions, when I click "Edit Soalan", then `/guru/soalan-berstruktur/{id}/edit` (M10) opens; "Balik ke Senarai" returns to the list.

**US-M04-24 — Teacher papers**
- **AC-M04-24.1** Given I open `/admin/question-submissions`, when it loads, then the header "Kertas Soalan Guru" / "Semak dan proses fail soalan yang dihantar oleh guru" and cards "Jumlah", "Pending", "Processing", "Selesai" show (no Ditolak card).
- **AC-M04-24.2** Given the filter, when I choose a status and press "Tapis", then only those rows show and "Reset" appears; with no match the table shows "Tiada rekod ditemui".
- **AC-M04-24.3** Given a row, when it renders, then it shows teacher name, e-mail link and `fa-school` school; subject text + level chip + "({year})", paper type in blue ("Buku Latihan", "Soalan Peperiksaan" or "Lain-lain"), "Oleh: {name}", optional italic note; one `fa-download` link per file; the status pill with the admin note under it; date and time.
- **AC-M04-24.4** Given I press "Kemaskini", when the panel toggles open, then it shows the status select (current value selected), "Nota admin (pilihan)..." (pre-filled, max 1000) and "Simpan"; pressing "Kemaskini" again closes it.
- **AC-M04-24.5** (INFERRED) Given I press "Simpan", when it saves (no confirm), then the row shows the new status and note, the counters update and a flash shows (UNVERIFIED COPY). Any status can follow any other.

**US-M04-25 — Diagram audit view**
- **AC-M04-25.1** Given I open `/admin/soalan-gambar`, when it loads, then the header "Soalan Perlu Gambar Rajah" / "Audit soalan yang memerlukan gambar rajah dilengkapkan", cards "MCQ PERLU GAMBAR", "STRUKTUR PERLU GAMBAR", "JUMLAH" and the card "MCQ PERLU GAMBAR MENGIKUT MATA PELAJARAN" (CSS upper case) with the top-10 subject pills show; the pills stay the same under any filter (as live).
- **AC-M04-25.2** Given I filter and press "Tapis", when the page reloads, then the subject filter applies to both lists and the school filter to the MCQ list only (the Struktur list ignores it, as live); each stat card shows its list's filtered count and "Jumlah" their sum (DV-M04-11).
- **AC-M04-25.3** Given the MCQ section has questions, when it loads, then "MCQ ({n})" heads cards showing "#{id}", subject pill, "oleh {name}", full text, `fa-file-pdf` "{file} ms.{page}", a required image input with `fa-upload`, and "Dismiss"; 20 per page with its own pager (`mcq_page`); when the MCQ count is 0 the whole MCQ section (heading and pager) is absent (as live).
- **AC-M04-25.4** Given the Struktur section, when it has questions, then "Struktur ({n})" shows the same cards (structured text with line breaks, cut at about 400 characters) with its own pager (`str_page`); when the count is 0 the section is absent.
- **AC-M04-25.5** Given a filter is set and I page one list, when the page reloads, then the pager link keeps `subject_id` and `school_id` (DV-M04-16; live drops them) and the other list is back on page 1.
- **AC-M04-25.6** Given neither list has a question under the filter, when the page loads, then "Semua soalan sudah lengkap dengan gambar rajah!" shows.

**US-M04-26 — Upload or dismiss**
- **AC-M04-26.1** Given no image is chosen, when I press `fa-upload`, then the native required bubble stops the submit.
- **AC-M04-26.2** (INFERRED) Given I choose an image and press `fa-upload` (no confirm), when it completes, then the question leaves the list, counts drop by one and a flash shows (UNVERIFIED COPY).
- **AC-M04-26.3** (INFERRED) Given I press "Dismiss" (no confirm), when it completes, then the flag is cleared without an image, the question leaves the list and a flash shows (UNVERIFIED COPY).

**US-M04-27 — Master notes**
- **AC-M04-27.1** Given I open `/admin/master-notes`, when it loads (user-portal layout), then the dark header card shows a readable white h1 "Master Notes — Admin Review" (DV-M04-14) and "Self-healing nota AI: {f} flagged · {a} teacher-approved · {t} total. Review yang flagged untuk improve quality."; tabs "Flagged Review" (active), "Teacher Approved", "Semua".
- **AC-M04-27.2** Given a tab with no notes, when it loads, then "Tiada nota dalam tab ini." shows.
- **AC-M04-27.3** Given "Semua", when it loads, then 15 rows per page show the meta line (question_id, subject, chapter or "—", model, tokens, badge "conf {n}"), "Soalan:" + question (about 200 characters), the note, "Trap:" + misconception, and "Approve", "Regenerate", "Clear Flag"; the English pager keeps `tab`.
- **AC-M04-27.4** Given I press a button, when the request runs (no confirm), then the button is disabled and reads "..."; on an HTTP success the row dims to 50% and the button reads "Done" and stays disabled; on an HTTP failure the label returns and the button is enabled again.
- **AC-M04-27.5** (INFERRED) Given I approve a flagged note, when I reload, then it is no longer under "Flagged Review" and appears under "Teacher Approved"; "Clear Flag" removes it from "Flagged Review" only; "Regenerate" replaces the note text (canned, D4).

**US-M04-28 — Navigation and titles**
- **AC-M04-28.1** Given the admin shell on desktop, when I open the "SOALAN" group, then it lists "Senarai Soalan", "Import CSV", "Kualiti Soalan", "Laporan Soalan", "Soalan Berstruktur", "Kertas Soalan Guru" with their icons, and the current screen's item is highlighted (S2–S4 highlight "Senarai Soalan").
- **AC-M04-28.2** Given a width below 1024px, when I use the admin shell, then the bottom nav has "Soalan" (→ `/admin/questions`) and the "Lagi" menu has a "Soalan" section with "Import CSV", "Kualiti Soalan", "Laporan Soalan", "Soalan Berstruktur", "Kertas Soalan Guru".
- **AC-M04-28.3** Given S1–S4, S7–S9 and S12, when they load, then the shell header shows the screen's title derived from the route with no subtitle (§1 table; shell rule DV-SH-03), never the fallback "Dashboard" / "Selamat datang, Admin" or "Selamat datang kembali" (DV-M04-02); S5, S6, S10, S11 and S13 keep their correct live title and subtitle.
- **AC-M04-28.4** Given the user-portal sidebar (desktop, admin), when it loads, then "🛡️ KAWALAN KUALITI" › "Semakan Nota Master", "💎 KILLER FEATURES" › "Laporan Soalan", "ADMIN" › "Kertas Soalan Guru" and "BANTUAN" › "Gambar Rajah" with a red badge equal to "MCQ Perlu Gambar" (unfiltered) show; the mobile drawer has "Semakan Nota Master" and "Laporan Soalan" only.

**US-M04-29 — Access and single source**
- **AC-M04-29.1** Given I am not logged in, when I open any M04 route, then I am redirected to `/login`.
- **AC-M04-29.2** (INFERRED) Given a logged-in non-admin, when they open an `/admin/*` M04 route, then they are sent to their own landing page (M01 BR); `/laporan-soalan` stays available to them.
- **AC-M04-29.3** Given the D11 dataset, when I compare S1 "Jumlah", the S1 unfiltered pager total, the sum of the S1 tiles and S6 "Jumlah Soalan", then all read 465,278 (the S1 tiles keep their live totals and "lulus" values, Bahasa Tamil adds 25,800 / 6,300 lulus, Bahasa Cina 0); status split 146,330 approved / 318,948 archived (DV-M04-18); student-facing figures read the named queries of SRS §4.1 (active and approved 128,989, active 129,389, PKSK 763); S8 "Jumlah Soalan" 4,064; S11 cards 6,144 / 522 / 6,666; S12 "525 total"; after any change every count moves together (DV-M04-04).
- **AC-M04-29.4** Given the M03 lookups, when S1, S2, S5, S8 and S11 load, then their subject and level lists are exactly `GET /api/subjects` / `GET /api/education-levels` (integer ids; S1/S2/S5 in id order, S8/S11 alphabetical) and the S1 "Subjek Teras" group is the `isCore` subjects.

**US-M04-30 — Responsive**
- **AC-M04-30.1** Given any M04 screen at 375, 768 and 1280px, when it renders, then there is no horizontal page scroll; wide tables (S1, S6 action list, S10) scroll inside their card.
- **AC-M04-30.2** Given S1 and S8 at 768px, when the pager renders, then it fits inside the viewport (DV-M04-09).
- **AC-M04-30.3** Given S1 at 375px, when the table renders, then the "Soalan" column is at least 240px wide, so the question text is readable, and the table scrolls inside its card (DV-M04-09).
- **AC-M04-30.4** Given S3 and S5 below 1024px, when they render, then the sidebar/side cards stack below the main column; at ≥1024px they sit beside it (2/3 + 1/3).
- **AC-M04-30.5** Given touch devices, when I use the keyboard panel, report modal and row actions, then every control is at least 44×44px or has a 44px hit area.
- **AC-M04-30.6** Given any M04 screen at any width, when content text renders (badges, pills, "Source:" lines, meta lines, counters), then no text is smaller than 12px (DV-M04-17; live sizes below 12px are raised to 12px, nothing else changes).

**US-M04-31 — Practice eligibility and SPM pool**
- **AC-M04-31.1** Given the store, when M06 asks for the SPM objective pool of a subject, then it receives Q-SPM-POOL: eligible `mcq` rows of Tingkatan 4 or 5 of that subject carrying the SPM scope flag `spmPool` (sizes as observed, e.g. MATH 1,681, Bahasa Arab 0), no PKSK rows; no other SPM store exists (the meaning of the flag is INFERRED).
- **AC-M04-31.2** Given I create an approved MCQ for Matematik Tingkatan 5 on S2, when M06 counts the MATH pool, then the new question carries `spmPool = true` (INFERRED rule), the pool is one larger (1,682) and the question can be drawn in SPM practice.
- **AC-M04-31.3** Given an MCQ is deactivated by a report (BR-M04-12) or "Nyahaktif Segera", when M05 (drill, chapter, revision) or M06 selects questions, then it is excluded, and after "Tolak & Aktifkan Semula" it is eligible again.
- **AC-M04-31.4** Given an active, approved MCQ of any level, when I open its "Buka Soalan Sama" link, then the quiz host (M06) serves exactly that question; for an inactive or non-approved question the host shows its fallback (M06 contract, INFERRED).
- **AC-M04-31.5** Given the structured store (4,064 rows, 5 of them inactive), when the student lists (M05 S10, M06 S7/S9) load, then they show the 4,059 published, active T4/T5 structured questions, while S8 still counts all 4,064.

**US-M04-32 — PKSK rows**
- **AC-M04-32.1** Given PKSK questions in the store (763 rows, ids 177698–178460), when S1 loads with any filter or search (e.g. a PKSK question text), then none appears, and no tile, total, S6 or S11 count includes them.
- **AC-M04-32.2** Given `/admin/questions/178460`, when it loads, then S3 shows the PKSK question text and its options (0–6; every correct option marked "Jawapan Betul"; no options card for a Bahagian C question), with "-" for Subjek and Tahap Pendidikan (INFERRED layout).
- **AC-M04-32.3** Given a PKSK question with status `pending`, when S3 shows it, then the status pill reads "Menunggu" (M07 label).

**US-M04-33 — Teacher and analytics contracts**
- **AC-M04-33.1** Given a teacher creates or imports a question through M10, when it is stored, then it has `status = pending_review`, `isActive = true`, `createdBy` = that teacher, an id ≥ 9,000,001 and the M10 fields (chapter, topic, script type, text direction); it shows in S1 under "Menunggu Semakan" and is not served to practice.
- **AC-M04-33.2** Given the admin approves it (S1 bulk "Luluskan" or S3 quick action), when practice selects questions, then it is eligible at once (and in the SPM pool when it is a T4/T5 SPM-subject MCQ).
- **AC-M04-33.3** Given a teacher creates, edits, toggles or deletes a structured question through M10, when the admin opens S8, then the total and list reflect it; a draft is not shown to students.
- **AC-M04-33.4** Given the admin's contributions (M10 S21), when counted, then Q-CONTRIB(1) = 16,817 approved rows with the observed subject split and ids ascending from 522425 (page 2 from 522445).
- **AC-M04-33.5** Given the Bahasa Melayu teacher databank (M10 S28), when counted, then it holds 6,048 questions: 5,918 MCQ, 105 essay and 25 of other types.
- **AC-M04-33.6** Given a teacher reports a databank question with reason "Soalan sudah tidak relevan", when sent, then the report is stored with source `teacher_databank`, the response carries `success: true`, and S7 shows the reason with category "Lain-lain".
- **AC-M04-33.7** Given a DSKP SP with observed availability (e.g. 9001 → 30, 194 → 50), when M08 asks, then the available count is the number of eligible questions tagged with it.
- **AC-M04-33.8** Given an M11 anchor question, when read, then it returns its observed chapter label (e.g. "Sejarah Tingkatan 5 KSSM") and its M03 topic, and M03 still has 1,251 chapters.

**US-M04-34 — Jutawan store and analytics inputs**
- **AC-M04-34.1** Given the Jutawan store, when M16 asks for a subject and grade, then the count is the observed one (e.g. Sejarah Tingkatan 1 = 2,974, 143 cells, Σ 149,911) and 0 for pairs without a cell; the question bank totals are unchanged.
- **AC-M04-34.2** Given the Jutawan game samples questions of a subject, grade and difficulty, when it draws, then it gets distinct rows without their keys from the same store, and grading returns the key.
- **AC-M04-34.3** Given the M17 coverage matrix, when counted, then it is 127,643 (active rows at a level that are not `coverageExcluded`) with the observed per-cell values and per-subject difficulty tiles.
- **AC-M04-34.4** Given teacher contributions, when counted over active teachers, then they total 11,414 (school 8087 2,432, 8107 1,403, 8880 13, 8090 1), the admin keeps 16,817 and teacher 5 keeps 1.
- **AC-M04-34.5** Given the import history, when counted, then there are 1,123 runs with 31,101 imported questions and none in August or September 2026; the seeded run is dated 20/07/2026.

## 5. UI expectations

Behaviour and content match the live site, including its look (design tokens in `00-global-ui.md` §6). Visual reference: the masked screenshots in `docs/discovery/img/M04/`.

| Screen | Key content and states | Screenshots |
|---|---|---|
| S1 list | Header + create button; summary card with 2 tile groups (active tile + clear link); 8-field filter card; bulk bar; table with badges; English pager (desktop/mobile); empty state. States: default, subject filter, archived, compliance draft/pending/quarantined, untagged, trial source, search empty, draft empty, page 2, one/all selected. | `questions-list-desktop/tablet/mobile.png`, `-bulk-bar.png`, `-subject-filter.png`, `-archived.png`, `-empty.png` |
| S2 create | Two cards + answer card per type (MCQ, T/F, short/fill, essay); DSKP cascade (empty → bidang → tagged); keyboard (Arab, Jawi, bottom sheet). | `question-create-mcq/true-false/short-answer/fill-blank/essay.png`, `-dskp-tagged.png`, `-keyboard-jawi.png`, `-mobile.png`, `-keyboard-mobile.png` |
| S3 detail | Main column (Soalan, Pilihan Jawapan, Penjelasan, Penjelasan AI empty/loading/error/rendered) + sidebar (Maklumat, usage card). Approved-tagged and archived-untagged variants. | `question-show-approved/archived/mobile.png` |
| S4 edit | Pre-filled form; DSKP preloaded and shown (DV-M04-15); "Buang tag DSKP" (DV-M04-06); per-type answer card (DV-M04-05). | `question-edit-desktop/remove-dskp/mobile.png` |
| S5 import (+ history) | Upload card with defaults; template, format, tips cards; read-only history table (DV-M04-01). | `import-desktop/mobile.png`, `import-history-500.png` (live defect) |
| S6 quality | KPI cards, buckets, distribution bar, subject table, level bars, action table, audit button (idle/submitting). | `quality-desktop/mobile.png` |
| S7 reports | Tabs; cards per status (Menunggu, Disemak, Diperbaiki, Dikeluarkan, Ditolak), structured and MCQ blocks, action column; empty. | `reports-pending-desktop.png`, `reports-all-desktop/mobile.png`, `reports-dismissed-empty.png` |
| S8–S9 structured | Stats, subject pills, filter (+ Reset), table, Malay counter, pager, empty; detail with sub-question cards. | `structured-list-desktop/mobile/empty.png`, `structured-show-desktop/mobile.png` |
| S10 papers | Counters, filter (+ Reset), table, inline "Kemaskini" panel; empty. | `submissions-desktop/row-open/mobile.png` |
| S11 diagram audit | Stats, subject pills, filter, MCQ section + pager, Struktur section + pager (omitted when 0), empty. | `gambar-desktop.png`, `gambar-structured-section.png`, `gambar-mobile.png` |
| S12 master notes | User-portal layout; dark header card; tabs; rows (meta, question, note, trap, 3 buttons with "..."/"Done" states); pager; empty. | `master-notes-default/all/mobile.png` |
| S13 my reports | 5 counters; empty state; populated list (INFERRED). | `my-reports-desktop/mobile.png` |
| S14 modal | MCQ and structured variants; reason cards (ticked tint); counter; sending; thank-you state. | `report-modal-mcq.png`, `report-modal-structured.png`, `report-modal-mcq-mobile.png` |

---

## 6. Coverage matrix (completeness proof)

Source: `docs/discovery/inventory/M04/` (generated 2026-09-25). Generated by script (`gen.js` in the author's scratchpad; reproducible from the Function catalogue `fns.js` + the inventory JSON). Every M04 content element (S1–S14) is listed with the Function that covers it, or with a concrete exclusion reason. Each element maps to exactly one Function. Shell elements (SHA, SHU) are chrome owned by the global shell / M23 and the module each link targets; only M04-relevant ones are mapped individually, the rest are listed by ID range with their owner. "Content" quotes the DOM text as captured (`<person>` = discovery privacy mask; ids in texts are live sample records).

**Summary**

| Set | Elements | Mapped to an M04 Function | Excluded (with reason) | Unmapped |
|---|---|---|---|---|
| M04 content (S1–S14) | 1226 | 1218 | 8 (M16 tournament banner 6; discovery-harness headings 2) | 0 |
| Admin shell SHA | 232 | 24 | 208 (M02 4; M06 2; M07 4; global shell / M23 198) | 0 |
| User-portal shell SHU | 374 | 13 | 361 (global shell / M23 and linked modules) | 0 |

**1226/1226 M04 content elements covered (1218 mapped, 8 excluded with reason), 0 unmapped.** Including the shells: 1832/1832 elements accounted for (1255 mapped, 577 excluded with reason). 146 of the 183 Functions in §3 appear in this matrix; the other 37 are behaviour-only Functions with no element by nature.

### 6.1 M04 content elements

#### S1 — `/admin/questions` (139 elements)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M04-S1-001 | heading | visible-default | "📚 Pengurusan Soalan" | FN-M04-1.1.1 |
| EL-M04-S1-002 | text | visible-default | "Urus bank soalan untuk platform PRESTASIPLUS" | FN-M04-1.1.1 |
| EL-M04-S1-003 | link | visible-default | "Tambah Soalan Tambah", → /admin/questions/create, fa-plus | FN-M04-1.1.1 |
| EL-M04-S1-004 | card | visible-default | "Ringkasan Bank Soalan" | FN-M04-1.1.2 |
| EL-M04-S1-005 | heading | visible-default | "Ringkasan Bank Soalan" | FN-M04-1.1.2 |
| EL-M04-S1-006 | text | visible-default | "Jumlah: soalan" | FN-M04-1.1.2 |
| EL-M04-S1-007 | text | visible-default | "439,478" | FN-M04-1.1.2 |
| EL-M04-S1-008 | badge | visible-default | "Subjek Teras" | FN-M04-1.1.3 |
| EL-M04-S1-009 | link | visible-default | "Bahasa Melay... 32,905 13,081 lulus", → /admin/questions?subject_id=1, fa-book-open | FN-M04-1.1.3 |
| EL-M04-S1-010 | link | visible-default | "Bahasa Ingge... 18,902 8,879 lulus", → /admin/questions?subject_id=2, fa-globe | FN-M04-1.1.3 |
| EL-M04-S1-011 | link | visible-default | "Matematik 38,504 16,645 lulus", → /admin/questions?subject_id=3, fa-calculator | FN-M04-1.1.3 |
| EL-M04-S1-012 | link | visible-default | "Sains 42,335 15,067 lulus", → /admin/questions?subject_id=4, fa-flask | FN-M04-1.1.3 |
| EL-M04-S1-013 | link | visible-default | "Sejarah 20,414 10,301 lulus", → /admin/questions?subject_id=5, fa-clock | FN-M04-1.1.3 |
| EL-M04-S1-014 | link | visible-default | "Pendidikan I... 27,962 10,455 lulus", → /admin/questions?subject_id=6, fa-moon | FN-M04-1.1.3 |
| EL-M04-S1-015 | link | visible-default | "Pendidikan M... 38,481 15,996 lulus", → /admin/questions?subject_id=7, fa-heart | FN-M04-1.1.3 |
| EL-M04-S1-016 | badge | visible-default | "Subjek Elektif" | FN-M04-1.1.4 |
| EL-M04-S1-017 | link | visible-default | "Matematik Ta... 7,580 2,579 lulus", → /admin/questions?subject_id=8, fa-square-root-alt | FN-M04-1.1.4 |
| EL-M04-S1-018 | link | visible-default | "Fizik 2,818 2,185 lulus", → /admin/questions?subject_id=9, fa-bolt | FN-M04-1.1.4 |
| EL-M04-S1-019 | link | visible-default | "Kimia 7,303 2,670 lulus", → /admin/questions?subject_id=10, fa-flask | FN-M04-1.1.4 |
| EL-M04-S1-020 | link | visible-default | "Biologi 14,001 4,580 lulus", → /admin/questions?subject_id=11, fa-leaf | FN-M04-1.1.4 |
| EL-M04-S1-021 | link | visible-default | "Geografi 21,318 6,886 lulus", → /admin/questions?subject_id=12, fa-map | FN-M04-1.1.4 |
| EL-M04-S1-022 | link | visible-default | "Pendidikan S... 48,360 4,910 lulus", → /admin/questions?subject_id=13, fa-palette | FN-M04-1.1.4 |
| EL-M04-S1-023 | link | visible-default | "Pendidikan M... 18,305 1,800 lulus", → /admin/questions?subject_id=14, fa-music | FN-M04-1.1.4 |
| EL-M04-S1-024 | link | visible-default | "Pendidikan J... 17,345 2,900 lulus", → /admin/questions?subject_id=15, fa-heartbeat | FN-M04-1.1.4 |
| EL-M04-S1-025 | link | visible-default | "Reka Bentuk... 1,811 200 lulus", → /admin/questions?subject_id=16, fa-wrench | FN-M04-1.1.4 |
| EL-M04-S1-026 | link | visible-default | "Sains Komput... 21,504 1,100 lulus", → /admin/questions?subject_id=17, fa-desktop | FN-M04-1.1.4 |
| EL-M04-S1-027 | link | visible-default | "Bahasa Arab 21,913 5,400 lulus", → /admin/questions?subject_id=18, fa-language | FN-M04-1.1.4 |
| EL-M04-S1-028 | link | visible-default | "Prinsip Pera... 6,052 2,329 lulus", → /admin/questions?subject_id=21, fa-receipt | FN-M04-1.1.4 |
| EL-M04-S1-029 | link | visible-default | "Ekonomi 5,591 3,051 lulus", → /admin/questions?subject_id=22, fa-chart-line | FN-M04-1.1.4 |
| EL-M04-S1-030 | link | visible-default | "Perniagaan 5,410 2,732 lulus", → /admin/questions?subject_id=23, fa-briefcase | FN-M04-1.1.4 |
| EL-M04-S1-031 | link | visible-default | "Pendidikan A... 3,970 1,000 lulus", → /admin/questions?subject_id=24, fa-quran | FN-M04-1.1.4 |
| EL-M04-S1-032 | link | visible-default | "Tasawwur Isl... 4,990 1,300 lulus", → /admin/questions?subject_id=25, fa-mosque | FN-M04-1.1.4 |
| EL-M04-S1-033 | link | visible-default | "Jawi 8,316 2,100 lulus", → /admin/questions?subject_id=26, fa-pen-nib | FN-M04-1.1.4 |
| EL-M04-S1-034 | link | visible-default | "Pendidikan S... 3,388 1,243 lulus", → /admin/questions?subject_id=27, fa-scale-balanced | FN-M04-1.1.4 |
| EL-M04-S1-035 | link | visible-default | "Sains Rumah... 0", → /admin/questions?subject_id=28, fa-book | FN-M04-1.1.4 |
| EL-M04-S1-036 | link | visible-default | "Pembuatan Pa... 0", → /admin/questions?subject_id=29, fa-book | FN-M04-1.1.4 |
| EL-M04-S1-037 | link | visible-default | "Pertanian 0", → /admin/questions?subject_id=30, fa-book | FN-M04-1.1.4 |
| EL-M04-S1-038 | link | visible-default | "Sains Sukan 0", → /admin/questions?subject_id=31, fa-book | FN-M04-1.1.4 |
| EL-M04-S1-039 | form | visible-default | GET /admin/questions | FN-M04-1.1.6 |
| EL-M04-S1-040 | label | visible-default | "Subjek" | FN-M04-1.1.6 |
| EL-M04-S1-041 | select | visible-default | `subject_id`, 32 options (first "Semua Subjek") | FN-M04-1.1.6 |
| EL-M04-S1-042 | label | visible-default | "Tahap" | FN-M04-1.1.6 |
| EL-M04-S1-043 | select | visible-default | `education_level_id`, 12 options (first "Semua Tahap") | FN-M04-1.1.6 |
| EL-M04-S1-044 | label | visible-default | "Kesukaran" | FN-M04-1.1.7 |
| EL-M04-S1-045 | select | visible-default | `difficulty_level`, 6 options (first "Semua") | FN-M04-1.1.7 |
| EL-M04-S1-046 | label | visible-default | "Status" | FN-M04-1.1.7 |
| EL-M04-S1-047 | select | visible-default | `status`, 6 options (first "Semua Status") | FN-M04-1.1.7 |
| EL-M04-S1-048 | label | visible-default | "DSKP" | FN-M04-1.1.8 |
| EL-M04-S1-049 | select | visible-default | `dskp_filter`, 3 options (first "Semua") | FN-M04-1.1.8 |
| EL-M04-S1-050 | label | visible-default | "Compliance" | FN-M04-1.1.8 |
| EL-M04-S1-051 | select | visible-default | `compliance_filter`, 8 options (first "Semua") | FN-M04-1.1.8 |
| EL-M04-S1-052 | label | visible-default | "Source" | FN-M04-1.1.8 |
| EL-M04-S1-053 | select | visible-default | `source_filter`, 5 options (first "Semua") | FN-M04-1.1.8 |
| EL-M04-S1-054 | label | visible-default | "Cari" | FN-M04-1.1.9 |
| EL-M04-S1-055 | input | visible-default | `search`, text, ph "Cari soalan..." | FN-M04-1.1.9 |
| EL-M04-S1-056 | button | visible-default | fa-search | FN-M04-1.1.9 |
| EL-M04-S1-057 | card | conditional | "Laksanakan" | FN-M04-1.1.10 |
| EL-M04-S1-058 | text | conditional | "soalan dipilih", fa-check-double | FN-M04-1.1.10 |
| EL-M04-S1-059 | text | conditional | "20" | FN-M04-1.1.10 |
| EL-M04-S1-060 | form | conditional | POST /admin/questions/bulk-action | FN-M04-1.1.10 |
| EL-M04-S1-061 | hidden-field | hidden-only | `_token` | FN-M04-1.1.10 |
| EL-M04-S1-062 | select | conditional | `action`, 5 options (first "Pilih Tindakan") | FN-M04-1.1.10 |
| EL-M04-S1-063 | button | conditional | "Laksanakan" | FN-M04-1.1.10 |
| EL-M04-S1-064 | card | visible-default | "#" | FN-M04-1.1.11 |
| EL-M04-S1-065 | table | visible-default | (table) | FN-M04-1.1.11 |
| EL-M04-S1-066 | checkbox | visible-default | checkbox | FN-M04-1.1.11 |
| EL-M04-S1-067 | checkbox | visible-default | checkbox, value N | FN-M04-1.1.11 |
| EL-M04-S1-068 | alert | visible-default | "DSKP", fa-check-circle | FN-M04-1.1.12 |
| EL-M04-S1-069 | alert | visible-default | "VERIFIED" | FN-M04-1.1.12 |
| EL-M04-S1-070 | badge | visible-default | "AI Verified" | FN-M04-1.1.12 |
| EL-M04-S1-071 | badge | visible-default | "Diluluskan" | FN-M04-1.1.13 |
| EL-M04-S1-072 | link | visible-default | → /admin/questions/564159, fa-eye, title "Lihat" | FN-M04-1.1.14 |
| EL-M04-S1-073 | link | visible-default | → /admin/questions/564159/edit, fa-edit, title "Edit" | FN-M04-1.1.14 |
| EL-M04-S1-074 | form | visible-default | POST /admin/questions/564159 (DELETE) | FN-M04-1.1.15 |
| EL-M04-S1-075 | hidden-field | hidden-only | `_token` | FN-M04-1.1.15 |
| EL-M04-S1-076 | hidden-field | hidden-only | `_method` | FN-M04-1.1.15 |
| EL-M04-S1-077 | button | visible-default | fa-trash, title "Padam" | FN-M04-1.1.15 |
| EL-M04-S1-078 | checkbox | visible-default | checkbox, value N | FN-M04-1.1.11 |
| EL-M04-S1-079 | alert | visible-default | "DSKP", fa-check-circle | FN-M04-1.1.12 |
| EL-M04-S1-080 | alert | visible-default | "VERIFIED" | FN-M04-1.1.12 |
| EL-M04-S1-081 | badge | visible-default | "AI Verified" | FN-M04-1.1.12 |
| EL-M04-S1-082 | badge | visible-default | "Diluluskan" | FN-M04-1.1.13 |
| EL-M04-S1-083 | link | visible-default | → /admin/questions/564160, fa-eye, title "Lihat" | FN-M04-1.1.14 |
| EL-M04-S1-084 | link | visible-default | → /admin/questions/564160/edit, fa-edit, title "Edit" | FN-M04-1.1.14 |
| EL-M04-S1-085 | form | visible-default | POST /admin/questions/564160 (DELETE) | FN-M04-1.1.15 |
| EL-M04-S1-086 | hidden-field | hidden-only | `_token` | FN-M04-1.1.15 |
| EL-M04-S1-087 | hidden-field | hidden-only | `_method` | FN-M04-1.1.15 |
| EL-M04-S1-088 | button | visible-default | fa-trash, title "Padam" | FN-M04-1.1.15 |
| EL-M04-S1-089 | checkbox | visible-default | checkbox, value N | FN-M04-1.1.11 |
| EL-M04-S1-090 | alert | visible-default | "DSKP", fa-check-circle | FN-M04-1.1.12 |
| EL-M04-S1-091 | alert | visible-default | "VERIFIED" | FN-M04-1.1.12 |
| EL-M04-S1-092 | badge | visible-default | "AI Verified" | FN-M04-1.1.12 |
| EL-M04-S1-093 | badge | visible-default | "Diluluskan" | FN-M04-1.1.13 |
| EL-M04-S1-094 | link | visible-default | → /admin/questions/564161, fa-eye, title "Lihat" | FN-M04-1.1.14 |
| EL-M04-S1-095 | link | visible-default | → /admin/questions/564161/edit, fa-edit, title "Edit" | FN-M04-1.1.14 |
| EL-M04-S1-096 | form | visible-default | POST /admin/questions/564161 (DELETE) | FN-M04-1.1.15 |
| EL-M04-S1-097 | hidden-field | hidden-only | `_token` | FN-M04-1.1.15 |
| EL-M04-S1-098 | hidden-field | hidden-only | `_method` | FN-M04-1.1.15 |
| EL-M04-S1-099 | button | visible-default | fa-trash, title "Padam" | FN-M04-1.1.15 |
| EL-M04-S1-100 | text | conditional (mobile-only) | "« Previous" | FN-M04-1.1.17 |
| EL-M04-S1-101 | pagination | conditional (mobile-only) | "Next »", → /admin/questions?page=2 | FN-M04-1.1.17 |
| EL-M04-S1-102 | text | visible-default (desktop-only) | "Showing to of results" | FN-M04-1.1.16 |
| EL-M04-S1-103 | text | visible-default (desktop-only) | "1" | FN-M04-1.1.16 |
| EL-M04-S1-104 | text | visible-default (desktop-only) | "20" | FN-M04-1.1.16 |
| EL-M04-S1-105 | text | visible-default (desktop-only) | "465278" | FN-M04-1.1.16 |
| EL-M04-S1-106 | text | visible-default (desktop-only) | "1" | FN-M04-1.1.16 |
| EL-M04-S1-107 | pagination | visible-default (desktop-only) | "2", → /admin/questions?page=2, aria "Go to page 2" | FN-M04-1.1.16 |
| EL-M04-S1-108 | pagination | visible-default (desktop-only) | "3", → /admin/questions?page=3, aria "Go to page 3" | FN-M04-1.1.16 |
| EL-M04-S1-109 | pagination | visible-default (desktop-only) | "4", → /admin/questions?page=4, aria "Go to page 4" | FN-M04-1.1.16 |
| EL-M04-S1-110 | pagination | visible-default (desktop-only) | "5", → /admin/questions?page=5, aria "Go to page 5" | FN-M04-1.1.16 |
| EL-M04-S1-111 | pagination | visible-default (desktop-only) | "6", → /admin/questions?page=6, aria "Go to page 6" | FN-M04-1.1.16 |
| EL-M04-S1-112 | pagination | visible-default (desktop-only) | "7", → /admin/questions?page=7, aria "Go to page 7" | FN-M04-1.1.16 |
| EL-M04-S1-113 | pagination | visible-default (desktop-only) | "8", → /admin/questions?page=8, aria "Go to page 8" | FN-M04-1.1.16 |
| EL-M04-S1-114 | pagination | visible-default (desktop-only) | "9", → /admin/questions?page=9, aria "Go to page 9" | FN-M04-1.1.16 |
| EL-M04-S1-115 | pagination | visible-default (desktop-only) | "10", → /admin/questions?page=10, aria "Go to page 10" | FN-M04-1.1.16 |
| EL-M04-S1-116 | text | visible-default (desktop-only) | "..." | FN-M04-1.1.16 |
| EL-M04-S1-117 | pagination | visible-default (desktop-only) | "23263", → /admin/questions?page=23263, aria "Go to page 23263" | FN-M04-1.1.16 |
| EL-M04-S1-118 | pagination | visible-default (desktop-only) | "23264", → /admin/questions?page=23264, aria "Go to page 23264" | FN-M04-1.1.16 |
| EL-M04-S1-119 | pagination | visible-default (desktop-only) | → /admin/questions?page=2, svg, aria "Next &raquo;" | FN-M04-1.1.16 |
| EL-M04-S1-120 | badge | conditional (state captured @1280 only) | "DRAFT" | FN-M04-1.1.12 |
| EL-M04-S1-121 | badge | conditional (state captured @1280 only) | "DRAFT" | FN-M04-1.1.12 |
| EL-M04-S1-122 | badge | conditional (state captured @1280 only) | "DRAFT" | FN-M04-1.1.12 |
| EL-M04-S1-123 | alert | conditional (state captured @1280 only) | "PENDING_MAPPING" | FN-M04-1.1.12 |
| EL-M04-S1-124 | badge | conditional (state captured @1280 only) | "Arkib" | FN-M04-1.1.13 |
| EL-M04-S1-125 | alert | conditional (state captured @1280 only) | "PENDING_MAPPING" | FN-M04-1.1.12 |
| EL-M04-S1-126 | badge | conditional (state captured @1280 only) | "Arkib" | FN-M04-1.1.13 |
| EL-M04-S1-127 | alert | conditional (state captured @1280 only) | "PENDING_MAPPING" | FN-M04-1.1.12 |
| EL-M04-S1-128 | badge | conditional (state captured @1280 only) | "Arkib" | FN-M04-1.1.13 |
| EL-M04-S1-129 | alert | conditional (state captured @1280 only) | "QUARANTINED" | FN-M04-1.1.12 |
| EL-M04-S1-130 | alert | conditional (state captured @1280 only) | "QUARANTINED" | FN-M04-1.1.12 |
| EL-M04-S1-131 | alert | conditional (state captured @1280 only) | "QUARANTINED" | FN-M04-1.1.12 |
| EL-M04-S1-132 | badge | conditional (state captured @1280 only) | "Latihan Tambahan", fa-book-open | FN-M04-1.1.12 |
| EL-M04-S1-133 | badge | conditional (state captured @1280 only) | "Latihan Tambahan", fa-book-open | FN-M04-1.1.12 |
| EL-M04-S1-134 | badge | conditional (state captured @1280 only) | "Latihan Tambahan", fa-book-open | FN-M04-1.1.12 |
| EL-M04-S1-135 | pagination | hidden-only | "« Previous", → /admin/questions?page=1 | FN-M04-1.1.17 |
| EL-M04-S1-136 | pagination | conditional (state captured @1280 only) | → /admin/questions?page=3, svg, aria "Next &raquo;" | FN-M04-1.1.16 |
| EL-M04-S1-137 | empty-state | conditional (state captured @1280 only) | "Tiada soalan dijumpai" | FN-M04-1.1.18 |
| EL-M04-S1-138 | link | conditional (state captured @1280 only) | "Tambah Soalan Pertama", → /admin/questions/create, fa-plus | FN-M04-1.1.18 |
| EL-M04-S1-139 | link | conditional (state captured @1280 only) | "Padam filter subjek — tunjuk semua", → /admin/questions, fa-times-circle | FN-M04-1.1.5 |

#### S2 — `/admin/questions/create` (168 elements)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M04-S2-001 | link | visible-default | → /admin/questions, fa-arrow-left | FN-M04-1.2.1 |
| EL-M04-S2-002 | heading | visible-default | "✨ Tambah Soalan Baru" | FN-M04-1.2.1 |
| EL-M04-S2-003 | text | visible-default | "Isi maklumat di bawah untuk menambah soalan baharu" | FN-M04-1.2.1 |
| EL-M04-S2-004 | form | visible-default | POST /admin/questions | FN-M04-1.2.2 |
| EL-M04-S2-005 | hidden-field | hidden-only | `_token` | FN-M04-1.2.2 |
| EL-M04-S2-006 | card | visible-default | "Maklumat Soalan" | FN-M04-1.2.2 |
| EL-M04-S2-007 | heading | visible-default | "Maklumat Soalan" | FN-M04-1.2.2 |
| EL-M04-S2-008 | label | visible-default | "Subjek *" | FN-M04-1.2.2 |
| EL-M04-S2-009 | select | visible-default | `subject_id`, 32 options (first "Pilih Subjek") | FN-M04-1.2.2 |
| EL-M04-S2-010 | label | visible-default | "Tahap Pendidikan *" | FN-M04-1.2.2 |
| EL-M04-S2-011 | select | visible-default | `education_level_id`, 12 options (first "Pilih Tahap Pendidikan") | FN-M04-1.2.2 |
| EL-M04-S2-012 | label | visible-default | "DSKP Tagging (Pilihan)" | FN-M04-1.4.1 |
| EL-M04-S2-013 | label | visible-default | "Bidang" | FN-M04-1.4.1 |
| EL-M04-S2-014 | select | visible-default | 1 options (first "-- Pilih Bidang --") | FN-M04-1.4.1 |
| EL-M04-S2-015 | label | visible-default | "Standard Kandungan" | FN-M04-1.4.2 |
| EL-M04-S2-016 | select | visible-default | 1 options (first "-- Pilih SK --") | FN-M04-1.4.2 |
| EL-M04-S2-017 | label | visible-default | "Standard Pembelajaran" | FN-M04-1.4.3 |
| EL-M04-S2-018 | select | visible-default | `dskp_sp_id`, 1 options (first "-- Pilih SP --") | FN-M04-1.4.3 |
| EL-M04-S2-019 | text | hidden-only | "DSKP tagged", fa-check-circle | FN-M04-1.4.3 |
| EL-M04-S2-020 | label | visible-default | "Tahap Kesukaran *" | FN-M04-1.2.3 |
| EL-M04-S2-021 | label | visible-default | "Sangat Mudah" | FN-M04-1.2.3 |
| EL-M04-S2-022 | radio | hidden-only | `difficulty_level`, radio, value 1 | FN-M04-1.2.3 |
| EL-M04-S2-023 | label | visible-default | "Mudah" | FN-M04-1.2.3 |
| EL-M04-S2-024 | radio | hidden-only | `difficulty_level`, radio, value 2 | FN-M04-1.2.3 |
| EL-M04-S2-025 | label | visible-default | "Sederhana" | FN-M04-1.2.3 |
| EL-M04-S2-026 | radio | hidden-only | `difficulty_level`, radio, value 3 | FN-M04-1.2.3 |
| EL-M04-S2-027 | label | visible-default | "Sukar" | FN-M04-1.2.3 |
| EL-M04-S2-028 | radio | hidden-only | `difficulty_level`, radio, value 4 | FN-M04-1.2.3 |
| EL-M04-S2-029 | label | visible-default | "Sangat Sukar" | FN-M04-1.2.3 |
| EL-M04-S2-030 | radio | hidden-only | `difficulty_level`, radio, value 5 | FN-M04-1.2.3 |
| EL-M04-S2-031 | label | visible-default | "Jenis Soalan *" | FN-M04-1.2.4 |
| EL-M04-S2-032 | select | visible-default | `question_type`, 5 options (first "Objektif (MCQ)") | FN-M04-1.2.4 |
| EL-M04-S2-033 | label | visible-default | "Teks Soalan *" | FN-M04-1.2.5 |
| EL-M04-S2-034 | textarea | visible-default | `question_text`, ph "Masukkan teks soalan di sini..." | FN-M04-1.2.5 |
| EL-M04-S2-035 | button | visible-default | button, fa-keyboard, title "Papan kekunci Arab / Jawi" | FN-M04-1.3.1 |
| EL-M04-S2-036 | text | visible-default | "Minimum 10 aksara" | FN-M04-1.2.5 |
| EL-M04-S2-037 | label | visible-default | "Gambar Soalan (Pilihan)" | FN-M04-1.2.6 |
| EL-M04-S2-038 | label | visible-default | "Klik untuk muat naik gambar JPG, PNG, WebP — Maks 2MB" | FN-M04-1.2.6 |
| EL-M04-S2-039 | input | hidden-only | `question_image`, file | FN-M04-1.2.6 |
| EL-M04-S2-040 | image | hidden-only | (img) | FN-M04-1.2.6 |
| EL-M04-S2-041 | button | hidden-only | button, fa-times | FN-M04-1.2.6 |
| EL-M04-S2-042 | card | visible-default | "Pilihan Jawapan" | FN-M04-1.2.7 |
| EL-M04-S2-043 | heading | visible-default | "Pilihan Jawapan" | FN-M04-1.2.7 |
| EL-M04-S2-044 | radio | visible-default | `correct_answer`, radio, value 0 | FN-M04-1.2.7 |
| EL-M04-S2-045 | label | visible-default | "Pilihan A *" | FN-M04-1.2.7 |
| EL-M04-S2-046 | input | visible-default | `options[]`, text, ph "Masukkan pilihan A" | FN-M04-1.2.7 |
| EL-M04-S2-047 | label | visible-default | "Gambar" | FN-M04-1.2.7 |
| EL-M04-S2-048 | input | hidden-only | `option_images[0]`, file | FN-M04-1.2.7 |
| EL-M04-S2-049 | image | hidden-only | (img) | FN-M04-1.2.7 |
| EL-M04-S2-050 | button | hidden-only | button, fa-times | FN-M04-1.2.7 |
| EL-M04-S2-051 | radio | visible-default | `correct_answer`, radio, value 1 | FN-M04-1.2.7 |
| EL-M04-S2-052 | label | visible-default | "Pilihan B *" | FN-M04-1.2.7 |
| EL-M04-S2-053 | input | visible-default | `options[]`, text, ph "Masukkan pilihan B" | FN-M04-1.2.7 |
| EL-M04-S2-054 | label | visible-default | "Gambar" | FN-M04-1.2.7 |
| EL-M04-S2-055 | input | hidden-only | `option_images[1]`, file | FN-M04-1.2.7 |
| EL-M04-S2-056 | image | hidden-only | (img) | FN-M04-1.2.7 |
| EL-M04-S2-057 | button | hidden-only | button, fa-times | FN-M04-1.2.7 |
| EL-M04-S2-058 | radio | visible-default | `correct_answer`, radio, value 2 | FN-M04-1.2.7 |
| EL-M04-S2-059 | label | visible-default | "Pilihan C *" | FN-M04-1.2.7 |
| EL-M04-S2-060 | input | visible-default | `options[]`, text, ph "Masukkan pilihan C" | FN-M04-1.2.7 |
| EL-M04-S2-061 | label | visible-default | "Gambar" | FN-M04-1.2.7 |
| EL-M04-S2-062 | input | hidden-only | `option_images[2]`, file | FN-M04-1.2.7 |
| EL-M04-S2-063 | image | hidden-only | (img) | FN-M04-1.2.7 |
| EL-M04-S2-064 | button | hidden-only | button, fa-times | FN-M04-1.2.7 |
| EL-M04-S2-065 | radio | visible-default | `correct_answer`, radio, value 3 | FN-M04-1.2.7 |
| EL-M04-S2-066 | label | visible-default | "Pilihan D *" | FN-M04-1.2.7 |
| EL-M04-S2-067 | input | visible-default | `options[]`, text, ph "Masukkan pilihan D" | FN-M04-1.2.7 |
| EL-M04-S2-068 | label | visible-default | "Gambar" | FN-M04-1.2.7 |
| EL-M04-S2-069 | input | hidden-only | `option_images[3]`, file | FN-M04-1.2.7 |
| EL-M04-S2-070 | image | hidden-only | (img) | FN-M04-1.2.7 |
| EL-M04-S2-071 | button | hidden-only | button, fa-times | FN-M04-1.2.7 |
| EL-M04-S2-072 | text | visible-default | "Pilih butang radio di sebelah pilihan yang merupakan jawapan yang betul." | FN-M04-1.2.7 |
| EL-M04-S2-073 | text | visible-default | "Nota:" | FN-M04-1.2.7 |
| EL-M04-S2-074 | card | conditional (state captured @1280 only) | "Jawapan Betul / Salah" | FN-M04-1.2.8 |
| EL-M04-S2-075 | heading | conditional (state captured @1280 only) | "Jawapan Betul / Salah" | FN-M04-1.2.8 |
| EL-M04-S2-076 | label | conditional (state captured @1280 only) | "Betul" | FN-M04-1.2.8 |
| EL-M04-S2-077 | radio | hidden-only | `tf_answer`, radio, value true | FN-M04-1.2.8 |
| EL-M04-S2-078 | label | conditional (state captured @1280 only) | "Salah" | FN-M04-1.2.8 |
| EL-M04-S2-079 | radio | hidden-only | `tf_answer`, radio, value false | FN-M04-1.2.8 |
| EL-M04-S2-080 | card | conditional (state captured @1280 only) | "Jawapan Isi Tempat Kosong" | FN-M04-1.2.9 |
| EL-M04-S2-081 | heading | conditional (state captured @1280 only) | "Jawapan Isi Tempat Kosong" | FN-M04-1.2.9 |
| EL-M04-S2-082 | label | conditional (state captured @1280 only) | "Jawapan Betul *" | FN-M04-1.2.9 |
| EL-M04-S2-083 | input | conditional (state captured @1280 only) | `correct_answer_text`, text, ph "Masukkan jawapan betul" | FN-M04-1.2.9 |
| EL-M04-S2-084 | label | conditional (state captured @1280 only) | "Jawapan Alternatif (pisahkan dengan koma)" | FN-M04-1.2.9 |
| EL-M04-S2-085 | input | conditional (state captured @1280 only) | `alt_answers`, text, ph "cth: jawapan1, jawapan2" | FN-M04-1.2.9 |
| EL-M04-S2-086 | text | conditional (state captured @1280 only) | "Jawapan lain yang juga diterima" | FN-M04-1.2.9 |
| EL-M04-S2-087 | card | conditional | "Jawapan Contoh (Esei)" | FN-M04-1.2.10 |
| EL-M04-S2-088 | heading | conditional | "Jawapan Contoh (Esei)" | FN-M04-1.2.10 |
| EL-M04-S2-089 | label | conditional | "Jawapan Model (pilihan — ditunjukkan sebagai rujukan)" | FN-M04-1.2.10 |
| EL-M04-S2-090 | textarea | conditional | `model_answer`, ph "Tulis jawapan contoh di sini..." | FN-M04-1.2.10 |
| EL-M04-S2-091 | card | visible-default | "Maklumat Tambahan" | FN-M04-1.2.11 |
| EL-M04-S2-092 | heading | visible-default | "Maklumat Tambahan" | FN-M04-1.2.11 |
| EL-M04-S2-093 | label | visible-default | "Penjelasan" | FN-M04-1.2.11 |
| EL-M04-S2-094 | textarea | visible-default | `explanation`, ph "Penjelasan untuk jawapan (pilihan)" | FN-M04-1.2.11 |
| EL-M04-S2-095 | text | visible-default | "Penjelasan akan ditunjukkan kepada pelajar selepas menjawab" | FN-M04-1.2.11 |
| EL-M04-S2-096 | label | visible-default | "Bahasa" | FN-M04-1.2.11 |
| EL-M04-S2-097 | select | visible-default | `language`, 2 options (first "Bahasa Melayu") | FN-M04-1.2.11 |
| EL-M04-S2-098 | label | visible-default | "Nilai Mata" | FN-M04-1.2.11 |
| EL-M04-S2-099 | input | visible-default | `points_value`, number | FN-M04-1.2.11 |
| EL-M04-S2-100 | text | visible-default | "Mata yang diperoleh jika jawapan betul" | FN-M04-1.2.11 |
| EL-M04-S2-101 | link | visible-default | "Batal", → /admin/questions, fa-times | FN-M04-1.2.12 |
| EL-M04-S2-102 | button | visible-default | "Simpan Soalan", fa-save | FN-M04-1.2.12 |
| EL-M04-S2-103 | card | visible-default | "عربي" | FN-M04-1.3.2 |
| EL-M04-S2-104 | clickable | conditional (mobile-only) | (div) | FN-M04-1.3.6 |
| EL-M04-S2-105 | modal | conditional | "عربي" | FN-M04-1.3.2 |
| EL-M04-S2-106 | button | conditional | "عربي" | FN-M04-1.3.2 |
| EL-M04-S2-107 | button | conditional | "جاوي" | FN-M04-1.3.2 |
| EL-M04-S2-108 | text | conditional | "Papan Kekunci Arab" | FN-M04-1.3.2 |
| EL-M04-S2-109 | button | conditional | fa-times | FN-M04-1.3.2 |
| EL-M04-S2-110 | button | hidden-only | (button) | FN-M04-1.3.3 |
| EL-M04-S2-111 | button | hidden-only | (button) | FN-M04-1.3.3 |
| EL-M04-S2-112 | button | conditional | "ض" | FN-M04-1.3.3 |
| EL-M04-S2-113 | button | conditional | "ص" | FN-M04-1.3.3 |
| EL-M04-S2-114 | button | conditional | "ث" | FN-M04-1.3.3 |
| EL-M04-S2-115 | button | conditional | "ق" | FN-M04-1.3.3 |
| EL-M04-S2-116 | button | conditional | "ف" | FN-M04-1.3.3 |
| EL-M04-S2-117 | button | conditional | "غ" | FN-M04-1.3.3 |
| EL-M04-S2-118 | button | conditional | "ع" | FN-M04-1.3.3 |
| EL-M04-S2-119 | button | conditional | "ه" | FN-M04-1.3.3 |
| EL-M04-S2-120 | button | conditional | "خ" | FN-M04-1.3.3 |
| EL-M04-S2-121 | button | conditional | "ح" | FN-M04-1.3.3 |
| EL-M04-S2-122 | button | conditional | "ج" | FN-M04-1.3.3 |
| EL-M04-S2-123 | button | conditional | "د" | FN-M04-1.3.3 |
| EL-M04-S2-124 | button | hidden-only | (button) | FN-M04-1.3.3 |
| EL-M04-S2-125 | button | conditional | "ش" | FN-M04-1.3.3 |
| EL-M04-S2-126 | button | conditional | "س" | FN-M04-1.3.3 |
| EL-M04-S2-127 | button | conditional | "ي" | FN-M04-1.3.3 |
| EL-M04-S2-128 | button | conditional | "ب" | FN-M04-1.3.3 |
| EL-M04-S2-129 | button | conditional | "ل" | FN-M04-1.3.3 |
| EL-M04-S2-130 | button | conditional | "ا" | FN-M04-1.3.3 |
| EL-M04-S2-131 | button | conditional | "ت" | FN-M04-1.3.3 |
| EL-M04-S2-132 | button | conditional | "ن" | FN-M04-1.3.3 |
| EL-M04-S2-133 | button | conditional | "م" | FN-M04-1.3.3 |
| EL-M04-S2-134 | button | conditional | "ك" | FN-M04-1.3.3 |
| EL-M04-S2-135 | button | conditional | "ط" | FN-M04-1.3.3 |
| EL-M04-S2-136 | button | hidden-only | (button) | FN-M04-1.3.3 |
| EL-M04-S2-137 | button | conditional | "ئ" | FN-M04-1.3.3 |
| EL-M04-S2-138 | button | conditional | "ء" | FN-M04-1.3.3 |
| EL-M04-S2-139 | button | conditional | "ؤ" | FN-M04-1.3.3 |
| EL-M04-S2-140 | button | conditional | "ر" | FN-M04-1.3.3 |
| EL-M04-S2-141 | button | conditional | "لا" | FN-M04-1.3.3 |
| EL-M04-S2-142 | button | conditional | "ى" | FN-M04-1.3.3 |
| EL-M04-S2-143 | button | conditional | "و" | FN-M04-1.3.3 |
| EL-M04-S2-144 | button | conditional | "ز" | FN-M04-1.3.3 |
| EL-M04-S2-145 | button | conditional | "ظ" | FN-M04-1.3.3 |
| EL-M04-S2-146 | button | hidden-only | (button) | FN-M04-1.3.4 |
| EL-M04-S2-147 | button | conditional | "◌َ", title "Fathah (atas)" | FN-M04-1.3.4 |
| EL-M04-S2-148 | button | conditional | "◌ِ", title "Kasrah (bawah)" | FN-M04-1.3.4 |
| EL-M04-S2-149 | button | conditional | "◌ُ", title "Dammah" | FN-M04-1.3.4 |
| EL-M04-S2-150 | button | conditional | "◌ْ", title "Sukun" | FN-M04-1.3.4 |
| EL-M04-S2-151 | button | conditional | "◌ً", title "Tanwin Fathah" | FN-M04-1.3.4 |
| EL-M04-S2-152 | button | conditional | "◌ٍ", title "Tanwin Kasrah" | FN-M04-1.3.4 |
| EL-M04-S2-153 | button | conditional | "◌ٌ", title "Tanwin Dammah" | FN-M04-1.3.4 |
| EL-M04-S2-154 | button | conditional | "◌ّ", title "Shadda (sabdu)" | FN-M04-1.3.4 |
| EL-M04-S2-155 | button | conditional | "◌ٰ", title "Superscript Alif (alif kecil)" | FN-M04-1.3.4 |
| EL-M04-S2-156 | button | conditional | "SPACE" | FN-M04-1.3.5 |
| EL-M04-S2-157 | button | conditional | "ال" | FN-M04-1.3.5 |
| EL-M04-S2-158 | button | conditional | "ة" | FN-M04-1.3.5 |
| EL-M04-S2-159 | button | conditional | fa-delete-left | FN-M04-1.3.5 |
| EL-M04-S2-160 | button | conditional | fa-turn-down | FN-M04-1.3.5 |
| EL-M04-S2-161 | text | conditional (state captured @1280 only) | "DSKP tagged", fa-check-circle | FN-M04-1.4.3 |
| EL-M04-S2-162 | button | conditional (state captured @1280 only) | "لا" | FN-M04-1.3.3 |
| EL-M04-S2-163 | button | conditional (state captured @1280 only) | "ى" | FN-M04-1.3.3 |
| EL-M04-S2-164 | button | conditional (state captured @1280 only) | "و" | FN-M04-1.3.3 |
| EL-M04-S2-165 | button | conditional (state captured @1280 only) | "ۏ" | FN-M04-1.3.3 |
| EL-M04-S2-166 | button | conditional (state captured @1280 only) | "ز" | FN-M04-1.3.3 |
| EL-M04-S2-167 | button | conditional (state captured @1280 only) | "ظ" | FN-M04-1.3.3 |
| EL-M04-S2-168 | heading | conditional (state captured @1280 only) | "Jawapan Pendek" | FN-M04-1.2.9 |

#### S3 — `/admin/questions/{id}` (62 elements)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M04-S3-001 | link | visible-default | → /admin/questions, fa-arrow-left | FN-M04-1.5.1 |
| EL-M04-S3-002 | heading | visible-default | "📝 Detail Soalan" | FN-M04-1.5.1 |
| EL-M04-S3-003 | text | visible-default | "Soalan #564159" | FN-M04-1.5.1 |
| EL-M04-S3-004 | link | visible-default | "Edit", → /admin/questions/564159/edit, fa-edit | FN-M04-1.5.1 |
| EL-M04-S3-005 | form | visible-default | POST /admin/questions/564159 (DELETE) | FN-M04-1.5.1 |
| EL-M04-S3-006 | hidden-field | hidden-only | `_token` | FN-M04-1.5.1 |
| EL-M04-S3-007 | hidden-field | hidden-only | `_method` | FN-M04-1.5.1 |
| EL-M04-S3-008 | button | visible-default | "Padam", fa-trash | FN-M04-1.5.1 |
| EL-M04-S3-009 | card | visible-default | "Soalan" | FN-M04-1.5.2 |
| EL-M04-S3-010 | heading | visible-default | "Soalan" | FN-M04-1.5.2 |
| EL-M04-S3-011 | badge | visible-default | "Diluluskan" | FN-M04-1.5.2 |
| EL-M04-S3-012 | text | visible-default | "Topup Sains T5 Bab 9 item 1: Apakah maksud satelit buatan? Pilih jawapan yang paling tepat" | FN-M04-1.5.2 |
| EL-M04-S3-013 | card | visible-default | "Pilihan Jawapan" | FN-M04-1.5.3 |
| EL-M04-S3-014 | heading | visible-default | "Pilihan Jawapan" | FN-M04-1.5.3 |
| EL-M04-S3-015 | text | visible-default | "A" | FN-M04-1.5.3 |
| EL-M04-S3-016 | text | visible-default | "Objek yang dilancarkan manusia untuk mengorbit Bumi atau jasad lain" | FN-M04-1.5.3 |
| EL-M04-S3-017 | text | visible-default | "Jawapan Betul" | FN-M04-1.5.3 |
| EL-M04-S3-018 | text | visible-default | "B" | FN-M04-1.5.3 |
| EL-M04-S3-019 | text | visible-default | "Planet semula jadi yang menghasilkan cahaya sendiri" | FN-M04-1.5.3 |
| EL-M04-S3-020 | text | visible-default | "C" | FN-M04-1.5.3 |
| EL-M04-S3-021 | text | visible-default | "Meteor yang jatuh ke Bumi" | FN-M04-1.5.3 |
| EL-M04-S3-022 | text | visible-default | "D" | FN-M04-1.5.3 |
| EL-M04-S3-023 | text | visible-default | "Awan yang bergerak mengikut angin" | FN-M04-1.5.3 |
| EL-M04-S3-024 | card | visible-default | "Penjelasan" | FN-M04-1.5.4 |
| EL-M04-S3-025 | heading | visible-default | "Penjelasan" | FN-M04-1.5.4 |
| EL-M04-S3-026 | text | visible-default | "Satelit buatan direka dan dilancarkan untuk tujuan komunikasi, pemantauan atau penyelidika" | FN-M04-1.5.4 |
| EL-M04-S3-027 | card | visible-default | "Penjelasan AI Dijana AI · Boleh ada kesilapan, sahkan dengan cikgu" | FN-M04-1.6.1 |
| EL-M04-S3-028 | heading | visible-default | "Penjelasan AI Dijana AI · Boleh ada kesilapan, sahkan dengan cikgu" | FN-M04-1.6.1 |
| EL-M04-S3-029 | text | visible-default | "Belum ada Penjelasan AI untuk soalan ini. Klik butang untuk jana." | FN-M04-1.6.1 |
| EL-M04-S3-030 | button | visible-default | "Jana Penjelasan AI", button, fa-wand-magic-sparkles | FN-M04-1.6.1 |
| EL-M04-S3-031 | text | hidden-only | "Sedang menjana penjelasan... (anggaran 5-15 saat)" | FN-M04-1.6.2 |
| EL-M04-S3-032 | text | hidden-only | "Ralat tidak diketahui" | FN-M04-1.6.3 |
| EL-M04-S3-033 | card | visible-default | "Maklumat" | FN-M04-1.5.5 |
| EL-M04-S3-034 | heading | visible-default | "Maklumat" | FN-M04-1.5.5 |
| EL-M04-S3-035 | text | visible-default | "Subjek" | FN-M04-1.5.5 |
| EL-M04-S3-036 | text | visible-default | "Sains", fa-book | FN-M04-1.5.5 |
| EL-M04-S3-037 | text | visible-default | "Tahap Pendidikan" | FN-M04-1.5.5 |
| EL-M04-S3-038 | text | visible-default | "Tingkatan 5", fa-graduation-cap | FN-M04-1.5.5 |
| EL-M04-S3-039 | text | visible-default | "Tahap Kesukaran" | FN-M04-1.5.5 |
| EL-M04-S3-040 | text | visible-default | "(3/5)" | FN-M04-1.5.5 |
| EL-M04-S3-041 | text | visible-default | "DSKP" | FN-M04-1.5.5 |
| EL-M04-S3-042 | text | visible-default | "Sains T5 - Sokongan Bab Buku Teks" | FN-M04-1.5.5 |
| EL-M04-S3-043 | text | visible-default | "T5SN.B9 - Menguasai konsep utama Bab 9: Satelit berdasarkan buku teks..." | FN-M04-1.5.5 |
| EL-M04-S3-044 | text | visible-default | "T5SN.B9.1 - Menjawab soalan objektif berkaitan konsep dan aplikasi Bab 9..." | FN-M04-1.5.5 |
| EL-M04-S3-045 | text | visible-default | "Bahasa" | FN-M04-1.5.5 |
| EL-M04-S3-046 | text | visible-default | "Bahasa Melayu", fa-language | FN-M04-1.5.5 |
| EL-M04-S3-047 | text | visible-default | "Nilai Mata" | FN-M04-1.5.5 |
| EL-M04-S3-048 | text | visible-default | "1 mata", fa-coins | FN-M04-1.5.5 |
| EL-M04-S3-049 | text | visible-default | "Dicipta Pada" | FN-M04-1.5.5 |
| EL-M04-S3-050 | text | visible-default | "18/05/2026 23:21", fa-calendar | FN-M04-1.5.5 |
| EL-M04-S3-051 | text | visible-default | "Soalan Baharu" | FN-M04-1.5.6 |
| EL-M04-S3-052 | text | visible-default | "Soalan ini belum digunakan dalam sebarang kuiz atau latihan." | FN-M04-1.5.6 |
| EL-M04-S3-053 | badge | conditional (state captured @1280 only) | "Diarkibkan" | FN-M04-1.5.2 |
| EL-M04-S3-054 | text | conditional (state captured @1280 only) | "34^-1/2 =" | FN-M04-1.5.2 |
| EL-M04-S3-055 | text | conditional (state captured @1280 only) | "1/34^2" | FN-M04-1.5.3 |
| EL-M04-S3-056 | text | conditional (state captured @1280 only) | "-1/34^2" | FN-M04-1.5.3 |
| EL-M04-S3-057 | text | conditional (state captured @1280 only) | "1/34^(1/2)" | FN-M04-1.5.3 |
| EL-M04-S3-058 | text | conditional (state captured @1280 only) | "-1/34^(1/2)" | FN-M04-1.5.3 |
| EL-M04-S3-059 | text | conditional (state captured @1280 only) | "Matematik", fa-book | FN-M04-1.5.5 |
| EL-M04-S3-060 | text | conditional (state captured @1280 only) | "(1/5)" | FN-M04-1.5.5 |
| EL-M04-S3-061 | text | conditional (state captured @1280 only) | "Belum ditag" | FN-M04-1.5.5 |
| EL-M04-S3-062 | text | conditional (state captured @1280 only) | "20/03/2026 17:08", fa-calendar | FN-M04-1.5.5 |

#### S4 — `/admin/questions/{id}/edit` (91 elements)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M04-S4-001 | link | visible-default | → /admin/questions/564159, fa-arrow-left | FN-M04-1.7.1 |
| EL-M04-S4-002 | heading | visible-default | "✏️ Edit Soalan" | FN-M04-1.7.1 |
| EL-M04-S4-003 | text | visible-default | "Kemaskini maklumat soalan #564159" | FN-M04-1.7.1 |
| EL-M04-S4-004 | form | visible-default | POST /admin/questions/564159 (PUT) | FN-M04-1.7.2 |
| EL-M04-S4-005 | hidden-field | hidden-only | `_token` | FN-M04-1.7.2 |
| EL-M04-S4-006 | hidden-field | hidden-only | `_method` | FN-M04-1.7.2 |
| EL-M04-S4-007 | card | visible-default | "Maklumat Soalan" | FN-M04-1.7.2 |
| EL-M04-S4-008 | heading | visible-default | "Maklumat Soalan" | FN-M04-1.7.2 |
| EL-M04-S4-009 | label | visible-default | "Subjek *" | FN-M04-1.7.2 |
| EL-M04-S4-010 | select | visible-default | `subject_id`, 32 options (first "Pilih Subjek") | FN-M04-1.7.2 |
| EL-M04-S4-011 | label | visible-default | "Tahap Pendidikan *" | FN-M04-1.7.2 |
| EL-M04-S4-012 | select | visible-default | `education_level_id`, 12 options (first "Pilih Tahap Pendidikan") | FN-M04-1.7.2 |
| EL-M04-S4-013 | label | visible-default | "DSKP Tagging (Pilihan)" | FN-M04-1.4.1 |
| EL-M04-S4-014 | label | visible-default | "Bidang" | FN-M04-1.4.1 |
| EL-M04-S4-015 | select | visible-default | 11 options (first "-- Pilih Bidang --") | FN-M04-1.4.1 |
| EL-M04-S4-016 | label | visible-default | "Standard Kandungan" | FN-M04-1.4.2 |
| EL-M04-S4-017 | select | visible-default | 20 options (first "-- Pilih SK --") | FN-M04-1.4.2 |
| EL-M04-S4-018 | label | visible-default | "Standard Pembelajaran" | FN-M04-1.4.3 |
| EL-M04-S4-019 | select | visible-default | `dskp_sp_id`, 2 options (first "-- Pilih SP --") | FN-M04-1.4.3 |
| EL-M04-S4-020 | text | hidden-only | "DSKP tagged", fa-check-circle | FN-M04-1.4.3 |
| EL-M04-S4-021 | text | visible-default | "DSKP tagged", fa-check-circle | FN-M04-1.4.3 |
| EL-M04-S4-022 | button | hidden-only | "Buang tag DSKP", button, fa-times | FN-M04-1.4.5 |
| EL-M04-S4-023 | label | visible-default | "Tahap Kesukaran *" | FN-M04-1.7.3 |
| EL-M04-S4-024 | label | visible-default | "Sangat Mudah" | FN-M04-1.7.3 |
| EL-M04-S4-025 | radio | hidden-only | `difficulty_level`, radio, value 1 | FN-M04-1.7.3 |
| EL-M04-S4-026 | label | visible-default | "Mudah" | FN-M04-1.7.3 |
| EL-M04-S4-027 | radio | hidden-only | `difficulty_level`, radio, value 2 | FN-M04-1.7.3 |
| EL-M04-S4-028 | label | visible-default | "Sederhana" | FN-M04-1.7.3 |
| EL-M04-S4-029 | radio | hidden-only | `difficulty_level`, radio, value 3 | FN-M04-1.7.3 |
| EL-M04-S4-030 | label | visible-default | "Sukar" | FN-M04-1.7.3 |
| EL-M04-S4-031 | radio | hidden-only | `difficulty_level`, radio, value 4 | FN-M04-1.7.3 |
| EL-M04-S4-032 | label | visible-default | "Sangat Sukar" | FN-M04-1.7.3 |
| EL-M04-S4-033 | radio | hidden-only | `difficulty_level`, radio, value 5 | FN-M04-1.7.3 |
| EL-M04-S4-034 | label | visible-default | "Teks Soalan *" | FN-M04-1.7.4 |
| EL-M04-S4-035 | textarea | visible-default | `question_text`, ph "Masukkan teks soalan di sini..." | FN-M04-1.7.4 |
| EL-M04-S4-036 | text | visible-default | "Minimum 10 aksara" | FN-M04-1.7.4 |
| EL-M04-S4-037 | label | visible-default | "Gambar Soalan (Pilihan)" | FN-M04-1.7.5 |
| EL-M04-S4-038 | label | visible-default | "Klik untuk muat naik gambar JPG, PNG, WebP — Maks 2MB" | FN-M04-1.7.5 |
| EL-M04-S4-039 | input | hidden-only | `question_image`, file | FN-M04-1.7.5 |
| EL-M04-S4-040 | image | hidden-only | (img) | FN-M04-1.7.5 |
| EL-M04-S4-041 | button | hidden-only | button, fa-times | FN-M04-1.7.5 |
| EL-M04-S4-042 | hidden-field | hidden-only | `remove_question_image` | FN-M04-1.7.5 |
| EL-M04-S4-043 | card | visible-default | "Pilihan Jawapan" | FN-M04-1.7.6 |
| EL-M04-S4-044 | heading | visible-default | "Pilihan Jawapan" | FN-M04-1.7.6 |
| EL-M04-S4-045 | radio | visible-default | `correct_answer`, radio, value 0 | FN-M04-1.7.6 |
| EL-M04-S4-046 | label | visible-default | "Pilihan A *" | FN-M04-1.7.6 |
| EL-M04-S4-047 | input | visible-default | `options[]`, text, ph "Masukkan pilihan A" | FN-M04-1.7.6 |
| EL-M04-S4-048 | label | visible-default | "Gambar" | FN-M04-1.7.6 |
| EL-M04-S4-049 | input | hidden-only | `option_images[0]`, file | FN-M04-1.7.6 |
| EL-M04-S4-050 | image | hidden-only | (img) | FN-M04-1.7.6 |
| EL-M04-S4-051 | button | hidden-only | button, fa-times | FN-M04-1.7.6 |
| EL-M04-S4-052 | hidden-field | hidden-only | `remove_option_image_0` | FN-M04-1.7.6 |
| EL-M04-S4-053 | radio | visible-default | `correct_answer`, radio, value 1 | FN-M04-1.7.6 |
| EL-M04-S4-054 | label | visible-default | "Pilihan B *" | FN-M04-1.7.6 |
| EL-M04-S4-055 | input | visible-default | `options[]`, text, ph "Masukkan pilihan B" | FN-M04-1.7.6 |
| EL-M04-S4-056 | label | visible-default | "Gambar" | FN-M04-1.7.6 |
| EL-M04-S4-057 | input | hidden-only | `option_images[1]`, file | FN-M04-1.7.6 |
| EL-M04-S4-058 | image | hidden-only | (img) | FN-M04-1.7.6 |
| EL-M04-S4-059 | button | hidden-only | button, fa-times | FN-M04-1.7.6 |
| EL-M04-S4-060 | hidden-field | hidden-only | `remove_option_image_1` | FN-M04-1.7.6 |
| EL-M04-S4-061 | radio | visible-default | `correct_answer`, radio, value 2 | FN-M04-1.7.6 |
| EL-M04-S4-062 | label | visible-default | "Pilihan C *" | FN-M04-1.7.6 |
| EL-M04-S4-063 | input | visible-default | `options[]`, text, ph "Masukkan pilihan C" | FN-M04-1.7.6 |
| EL-M04-S4-064 | label | visible-default | "Gambar" | FN-M04-1.7.6 |
| EL-M04-S4-065 | input | hidden-only | `option_images[2]`, file | FN-M04-1.7.6 |
| EL-M04-S4-066 | image | hidden-only | (img) | FN-M04-1.7.6 |
| EL-M04-S4-067 | button | hidden-only | button, fa-times | FN-M04-1.7.6 |
| EL-M04-S4-068 | hidden-field | hidden-only | `remove_option_image_2` | FN-M04-1.7.6 |
| EL-M04-S4-069 | radio | visible-default | `correct_answer`, radio, value 3 | FN-M04-1.7.6 |
| EL-M04-S4-070 | label | visible-default | "Pilihan D *" | FN-M04-1.7.6 |
| EL-M04-S4-071 | input | visible-default | `options[]`, text, ph "Masukkan pilihan D" | FN-M04-1.7.6 |
| EL-M04-S4-072 | label | visible-default | "Gambar" | FN-M04-1.7.6 |
| EL-M04-S4-073 | input | hidden-only | `option_images[3]`, file | FN-M04-1.7.6 |
| EL-M04-S4-074 | image | hidden-only | (img) | FN-M04-1.7.6 |
| EL-M04-S4-075 | button | hidden-only | button, fa-times | FN-M04-1.7.6 |
| EL-M04-S4-076 | hidden-field | hidden-only | `remove_option_image_3` | FN-M04-1.7.6 |
| EL-M04-S4-077 | text | visible-default | "Pilih butang radio di sebelah pilihan yang merupakan jawapan yang betul." | FN-M04-1.7.6 |
| EL-M04-S4-078 | text | visible-default | "Nota:" | FN-M04-1.7.6 |
| EL-M04-S4-079 | card | visible-default | "Maklumat Tambahan" | FN-M04-1.7.7 |
| EL-M04-S4-080 | heading | visible-default | "Maklumat Tambahan" | FN-M04-1.7.7 |
| EL-M04-S4-081 | label | visible-default | "Penjelasan" | FN-M04-1.7.7 |
| EL-M04-S4-082 | textarea | visible-default | `explanation`, ph "Penjelasan untuk jawapan (pilihan)" | FN-M04-1.7.7 |
| EL-M04-S4-083 | text | visible-default | "Penjelasan akan ditunjukkan kepada pelajar selepas menjawab" | FN-M04-1.7.7 |
| EL-M04-S4-084 | label | visible-default | "Bahasa" | FN-M04-1.7.7 |
| EL-M04-S4-085 | select | visible-default | `language`, 2 options (first "Bahasa Melayu") | FN-M04-1.7.7 |
| EL-M04-S4-086 | label | visible-default | "Nilai Mata" | FN-M04-1.7.7 |
| EL-M04-S4-087 | input | visible-default | `points_value`, number | FN-M04-1.7.7 |
| EL-M04-S4-088 | text | visible-default | "Mata yang diperoleh jika jawapan betul" | FN-M04-1.7.7 |
| EL-M04-S4-089 | link | visible-default | "Batal", → /admin/questions/564159, fa-times | FN-M04-1.7.8 |
| EL-M04-S4-090 | button | visible-default | "Kemaskini Soalan", fa-save | FN-M04-1.7.8 |
| EL-M04-S4-091 | button | conditional (state captured @1280 only) | "Buang tag DSKP", button, fa-times | FN-M04-1.4.5 |

#### S5 — `/admin/questions/import` (59 elements)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M04-S5-001 | link | visible-default | "Sejarah Import", → /admin/questions/import-history, fa-history | FN-M04-2.1.1 |
| EL-M04-S5-002 | link | visible-default | "Kembali", → /admin/questions, fa-arrow-left | FN-M04-2.1.1 |
| EL-M04-S5-003 | card | visible-default | "Muat Naik Fail CSV" | FN-M04-2.1.2 |
| EL-M04-S5-004 | heading | visible-default | "Muat Naik Fail CSV" | FN-M04-2.1.2 |
| EL-M04-S5-005 | form | visible-default | POST /admin/questions/import | FN-M04-2.1.2 |
| EL-M04-S5-006 | hidden-field | hidden-only | `_token` | FN-M04-2.1.2 |
| EL-M04-S5-007 | label | visible-default | "Fail CSV *" | FN-M04-2.1.2 |
| EL-M04-S5-008 | input | visible-default | `csv_file`, file | FN-M04-2.1.2 |
| EL-M04-S5-009 | text | visible-default | "Saiz maksimum: 5MB. Format: CSV atau TXT", fa-info-circle | FN-M04-2.1.2 |
| EL-M04-S5-010 | heading | visible-default | "Tetapan Lalai (Opsional)" | FN-M04-2.1.3 |
| EL-M04-S5-011 | text | visible-default | "Nilai ini digunakan jika kolum berkaitan tiada dalam CSV." | FN-M04-2.1.3 |
| EL-M04-S5-012 | label | visible-default | "Subjek Lalai" | FN-M04-2.1.3 |
| EL-M04-S5-013 | select | visible-default | `default_subject_id`, 32 options (first "-- Tidak ditetapkan --") | FN-M04-2.1.3 |
| EL-M04-S5-014 | label | visible-default | "Tahap Pendidikan" | FN-M04-2.1.3 |
| EL-M04-S5-015 | select | visible-default | `default_education_level_id`, 12 options (first "-- Tidak ditetapkan --") | FN-M04-2.1.3 |
| EL-M04-S5-016 | label | visible-default | "Kesukaran" | FN-M04-2.1.3 |
| EL-M04-S5-017 | select | visible-default | `default_difficulty_level`, 6 options (first "-- Tidak ditetapkan --") | FN-M04-2.1.3 |
| EL-M04-S5-018 | text | visible-default | "Soalan disimpan sebagai draf", fa-shield-alt | FN-M04-2.1.4 |
| EL-M04-S5-019 | button | visible-default | "Mula Import", fa-upload | FN-M04-2.1.4 |
| EL-M04-S5-020 | card | visible-default | "Muat Turun Template" | FN-M04-2.1.5 |
| EL-M04-S5-021 | heading | visible-default | "Muat Turun Template" | FN-M04-2.1.5 |
| EL-M04-S5-022 | text | visible-default | "Template CSV dengan contoh soalan" | FN-M04-2.1.5 |
| EL-M04-S5-023 | link | visible-default | "Download Template", → /admin/questions/import-template, fa-file-csv | FN-M04-2.1.5 |
| EL-M04-S5-024 | card | visible-default | "Format CSV" | FN-M04-2.1.6 |
| EL-M04-S5-025 | heading | visible-default | "Format CSV" | FN-M04-2.1.6 |
| EL-M04-S5-026 | text | visible-default | "Kolum diperlukan:" | FN-M04-2.1.6 |
| EL-M04-S5-027 | text | visible-default | "— Teks soalan" | FN-M04-2.1.6 |
| EL-M04-S5-028 | text | visible-default | "question_text" | FN-M04-2.1.6 |
| EL-M04-S5-029 | text | visible-default | ", — Pilihan" | FN-M04-2.1.6 |
| EL-M04-S5-030 | text | visible-default | "option_a" | FN-M04-2.1.6 |
| EL-M04-S5-031 | text | visible-default | "option_b" | FN-M04-2.1.6 |
| EL-M04-S5-032 | text | visible-default | "— Jawapan (A/B/C/D)" | FN-M04-2.1.6 |
| EL-M04-S5-033 | text | visible-default | "correct_answer" | FN-M04-2.1.6 |
| EL-M04-S5-034 | text | visible-default | "— ID subjek" | FN-M04-2.1.6 |
| EL-M04-S5-035 | text | visible-default | "subject_id" | FN-M04-2.1.6 |
| EL-M04-S5-036 | text | visible-default | "— ID tahap" | FN-M04-2.1.6 |
| EL-M04-S5-037 | text | visible-default | "education_level_id" | FN-M04-2.1.6 |
| EL-M04-S5-038 | text | visible-default | "Kolum opsional:" | FN-M04-2.1.6 |
| EL-M04-S5-039 | text | visible-default | "," | FN-M04-2.1.6 |
| EL-M04-S5-040 | text | visible-default | "option_c" | FN-M04-2.1.6 |
| EL-M04-S5-041 | text | visible-default | "option_d" | FN-M04-2.1.6 |
| EL-M04-S5-042 | text | visible-default | "— Kesukaran (1-5)" | FN-M04-2.1.6 |
| EL-M04-S5-043 | text | visible-default | "difficulty_level" | FN-M04-2.1.6 |
| EL-M04-S5-044 | text | visible-default | "," | FN-M04-2.1.6 |
| EL-M04-S5-045 | text | visible-default | "marks" | FN-M04-2.1.6 |
| EL-M04-S5-046 | text | visible-default | "explanation" | FN-M04-2.1.6 |
| EL-M04-S5-047 | card | visible-default | "Tips" | FN-M04-2.1.7 |
| EL-M04-S5-048 | heading | visible-default | "Tips" | FN-M04-2.1.7 |
| EL-M04-S5-049 | text | visible-default | "Fail CSV mesti encoding UTF-8" | FN-M04-2.1.7 |
| EL-M04-S5-050 | text | visible-default | "Guna petikan dua (") untuk teks yang ada koma" | FN-M04-2.1.7 |
| EL-M04-S5-051 | text | visible-default | "Baris pertama = header kolum" | FN-M04-2.1.7 |
| EL-M04-S5-052 | text | visible-default | "Semua soalan disimpan sebagai "draf"" | FN-M04-2.1.7 |
| EL-M04-S5-053 | text | conditional (state captured @1280 only) | "500" | FN-M04-2.1.8 |
| EL-M04-S5-054 | text | conditional (state captured @1280 only) | "⚙️" | FN-M04-2.1.8 |
| EL-M04-S5-055 | heading | conditional (state captured @1280 only) | "Ralat Pelayan" | FN-M04-2.1.8 |
| EL-M04-S5-056 | text | conditional (state captured @1280 only) | "Sesuatu tidak kena di pihak kami. Pasukan teknikal telah dimaklumkan. Sila cuba sebentar l" | FN-M04-2.1.8 |
| EL-M04-S5-057 | link | conditional (state captured @1280 only) | "Halaman Utama", → / | FN-M04-2.1.8 |
| EL-M04-S5-058 | link | conditional (state captured @1280 only) | "Cuba Semula", → javascript:location.reload() | FN-M04-2.1.8 |
| EL-M04-S5-059 | text | conditional (state captured @1280 only) | "PRESTASIPLUS" | FN-M04-2.1.8 |

#### S6 — `/admin/questions/quality` (96 elements)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M04-S6-001 | card | visible-default | "466,041" | FN-M04-2.2.1 |
| EL-M04-S6-002 | text | visible-default | "466,041" | FN-M04-2.2.1 |
| EL-M04-S6-003 | text | visible-default | "Jumlah Soalan" | FN-M04-2.2.1 |
| EL-M04-S6-004 | card | visible-default | "94.1" | FN-M04-2.2.1 |
| EL-M04-S6-005 | text | visible-default | "94.1" | FN-M04-2.2.1 |
| EL-M04-S6-006 | text | visible-default | "Purata Skor" | FN-M04-2.2.1 |
| EL-M04-S6-007 | card | visible-default | "146,275" | FN-M04-2.2.1 |
| EL-M04-S6-008 | text | visible-default | "146,275" | FN-M04-2.2.1 |
| EL-M04-S6-009 | text | visible-default | "Cemerlang (76-100)" | FN-M04-2.2.1 |
| EL-M04-S6-010 | card | visible-default | "2" | FN-M04-2.2.1 |
| EL-M04-S6-011 | text | visible-default | "2" | FN-M04-2.2.1 |
| EL-M04-S6-012 | text | visible-default | "Perlu Tindakan Aktif (≤ 50)" | FN-M04-2.2.1 |
| EL-M04-S6-013 | text | visible-default | "Skor 51-75" | FN-M04-2.2.2 |
| EL-M04-S6-014 | text | visible-default | "749" | FN-M04-2.2.2 |
| EL-M04-S6-015 | text | visible-default | "Perlu semakan ringan atau pengayaan metadata." | FN-M04-2.2.2 |
| EL-M04-S6-016 | text | visible-default | "Skor ≤ 50" | FN-M04-2.2.2 |
| EL-M04-S6-017 | text | visible-default | "2" | FN-M04-2.2.2 |
| EL-M04-S6-018 | text | visible-default | "Bucket ini patut jadi fokus tindakan segera." | FN-M04-2.2.2 |
| EL-M04-S6-019 | text | visible-default | "Legacy Generic" | FN-M04-2.2.2 |
| EL-M04-S6-020 | text | visible-default | "373" | FN-M04-2.2.2 |
| EL-M04-S6-021 | text | visible-default | "Row legacy seperti `tracking_a_feed_20260308`, `spm_tracking_auto_seed_v1`, dan `source_ty" | FN-M04-2.2.2 |
| EL-M04-S6-022 | card | visible-default | "Taburan Kualiti" | FN-M04-2.2.3 |
| EL-M04-S6-023 | heading | visible-default | "Taburan Kualiti" | FN-M04-2.2.3 |
| EL-M04-S6-024 | text | visible-default | "99.5%" | FN-M04-2.2.3 |
| EL-M04-S6-025 | text | visible-default | "0.5%" | FN-M04-2.2.3 |
| EL-M04-S6-026 | text | visible-default | "Cemerlang" | FN-M04-2.2.3 |
| EL-M04-S6-027 | text | visible-default | "Baik" | FN-M04-2.2.3 |
| EL-M04-S6-028 | text | visible-default | "Lemah" | FN-M04-2.2.3 |
| EL-M04-S6-029 | text | visible-default | "Kritikal" | FN-M04-2.2.3 |
| EL-M04-S6-030 | card | visible-default | "Mengikut Subjek" | FN-M04-2.2.4 |
| EL-M04-S6-031 | heading | visible-default | "Mengikut Subjek" | FN-M04-2.2.4 |
| EL-M04-S6-032 | table | visible-default | (table) | FN-M04-2.2.4 |
| EL-M04-S6-033 | badge | visible-default | "96.4" | FN-M04-2.2.4 |
| EL-M04-S6-034 | badge | visible-default | "96.0" | FN-M04-2.2.4 |
| EL-M04-S6-035 | badge | visible-default | "96.0" | FN-M04-2.2.4 |
| EL-M04-S6-036 | badge | visible-default | "95.9" | FN-M04-2.2.4 |
| EL-M04-S6-037 | badge | visible-default | "95.8" | FN-M04-2.2.4 |
| EL-M04-S6-038 | badge | visible-default | "95.5" | FN-M04-2.2.4 |
| EL-M04-S6-039 | badge | visible-default | "95.5" | FN-M04-2.2.4 |
| EL-M04-S6-040 | badge | visible-default | "95.4" | FN-M04-2.2.4 |
| EL-M04-S6-041 | badge | visible-default | "95.3" | FN-M04-2.2.4 |
| EL-M04-S6-042 | badge | visible-default | "95.2" | FN-M04-2.2.4 |
| EL-M04-S6-043 | badge | visible-default | "95.0" | FN-M04-2.2.4 |
| EL-M04-S6-044 | badge | visible-default | "94.8" | FN-M04-2.2.4 |
| EL-M04-S6-045 | badge | visible-default | "94.6" | FN-M04-2.2.4 |
| EL-M04-S6-046 | badge | visible-default | "94.0" | FN-M04-2.2.4 |
| EL-M04-S6-047 | badge | visible-default | "93.9" | FN-M04-2.2.4 |
| EL-M04-S6-048 | badge | visible-default | "93.4" | FN-M04-2.2.4 |
| EL-M04-S6-049 | badge | visible-default | "93.2" | FN-M04-2.2.4 |
| EL-M04-S6-050 | badge | visible-default | "93.0" | FN-M04-2.2.4 |
| EL-M04-S6-051 | badge | visible-default | "93.0" | FN-M04-2.2.4 |
| EL-M04-S6-052 | badge | visible-default | "93.0" | FN-M04-2.2.4 |
| EL-M04-S6-053 | badge | visible-default | "92.9" | FN-M04-2.2.4 |
| EL-M04-S6-054 | badge | visible-default | "91.9" | FN-M04-2.2.4 |
| EL-M04-S6-055 | badge | visible-default | "91.6" | FN-M04-2.2.4 |
| EL-M04-S6-056 | badge | visible-default | "90.8" | FN-M04-2.2.4 |
| EL-M04-S6-057 | badge | visible-default | "88.1" | FN-M04-2.2.4 |
| EL-M04-S6-058 | badge | visible-default | "88.0" | FN-M04-2.2.4 |
| EL-M04-S6-059 | card | visible-default | "Mengikut Tingkatan" | FN-M04-2.2.5 |
| EL-M04-S6-060 | heading | visible-default | "Mengikut Tingkatan" | FN-M04-2.2.5 |
| EL-M04-S6-061 | text | visible-default | "Darjah 1" | FN-M04-2.2.5 |
| EL-M04-S6-062 | text | visible-default | "4,325 soalan · 95.4" | FN-M04-2.2.5 |
| EL-M04-S6-063 | text | visible-default | "Darjah 2" | FN-M04-2.2.5 |
| EL-M04-S6-064 | text | visible-default | "3,941 soalan · 94.7" | FN-M04-2.2.5 |
| EL-M04-S6-065 | text | visible-default | "Darjah 3" | FN-M04-2.2.5 |
| EL-M04-S6-066 | text | visible-default | "5,906 soalan · 96.6" | FN-M04-2.2.5 |
| EL-M04-S6-067 | text | visible-default | "Darjah 4" | FN-M04-2.2.5 |
| EL-M04-S6-068 | text | visible-default | "7,242 soalan · 95.4" | FN-M04-2.2.5 |
| EL-M04-S6-069 | text | visible-default | "Darjah 5" | FN-M04-2.2.5 |
| EL-M04-S6-070 | text | visible-default | "8,696 soalan · 96.9" | FN-M04-2.2.5 |
| EL-M04-S6-071 | text | visible-default | "Darjah 6" | FN-M04-2.2.5 |
| EL-M04-S6-072 | text | visible-default | "10,048 soalan · 95.6" | FN-M04-2.2.5 |
| EL-M04-S6-073 | text | visible-default | "Tingkatan 1" | FN-M04-2.2.5 |
| EL-M04-S6-074 | text | visible-default | "18,746 soalan · 93.6" | FN-M04-2.2.5 |
| EL-M04-S6-075 | text | visible-default | "Tingkatan 2" | FN-M04-2.2.5 |
| EL-M04-S6-076 | text | visible-default | "13,530 soalan · 93.3" | FN-M04-2.2.5 |
| EL-M04-S6-077 | text | visible-default | "Tingkatan 3" | FN-M04-2.2.5 |
| EL-M04-S6-078 | text | visible-default | "14,702 soalan · 93.2" | FN-M04-2.2.5 |
| EL-M04-S6-079 | text | visible-default | "Tingkatan 4" | FN-M04-2.2.5 |
| EL-M04-S6-080 | text | visible-default | "32,942 soalan · 93.8" | FN-M04-2.2.5 |
| EL-M04-S6-081 | text | visible-default | "Tingkatan 5" | FN-M04-2.2.5 |
| EL-M04-S6-082 | text | visible-default | "26,718 soalan · 93.4" | FN-M04-2.2.5 |
| EL-M04-S6-083 | card | visible-default | "Soalan Untuk Semakan Aktif" | FN-M04-2.2.6 |
| EL-M04-S6-084 | heading | visible-default | "Soalan Untuk Semakan Aktif" | FN-M04-2.2.6 |
| EL-M04-S6-085 | text | visible-default | "Memaparkan hanya soalan skor ≤ 50 selepas menolak sumber generic legacy." | FN-M04-2.2.6 |
| EL-M04-S6-086 | text | visible-default | "2 soalan" | FN-M04-2.2.6 |
| EL-M04-S6-087 | table | visible-default | (table) | FN-M04-2.2.6 |
| EL-M04-S6-088 | badge | visible-default | "50" | FN-M04-2.2.6 |
| EL-M04-S6-089 | link | visible-default | "Edit", → /admin/questions/129114/edit, fa-edit | FN-M04-2.2.6 |
| EL-M04-S6-090 | badge | visible-default | "50" | FN-M04-2.2.6 |
| EL-M04-S6-091 | link | visible-default | "Edit", → /admin/questions/129216/edit, fa-edit | FN-M04-2.2.6 |
| EL-M04-S6-092 | form | visible-default | POST /admin/questions/quality/run-audit | FN-M04-2.2.7 |
| EL-M04-S6-093 | hidden-field | hidden-only | `_token` | FN-M04-2.2.7 |
| EL-M04-S6-094 | button | visible-default | "Jalankan Audit Semula", fa-clipboard-check | FN-M04-2.2.7 |
| EL-M04-S6-095 | text | hidden-only | "Jalankan Audit Semula", fa-clipboard-check | FN-M04-2.2.7 |
| EL-M04-S6-096 | text | hidden-only | "Sedang audit...", fa-spinner | FN-M04-2.2.7 |

#### S7 — `/admin/question-reports` (146 elements)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M04-S7-001 | heading | visible-default | "Laporan Soalan" | FN-M04-3.2.1 |
| EL-M04-S7-002 | text | visible-default | "Soalan yang dilaporkan oleh pelajar dari kuiz, latihan & Papan Bijak" | FN-M04-3.2.1 |
| EL-M04-S7-003 | filter | visible-default | "Menunggu (2)", → ?status=pending, fa-clock | FN-M04-3.2.2 |
| EL-M04-S7-004 | filter | visible-default | "Disemak (3)", → ?status=reviewed, fa-eye | FN-M04-3.2.2 |
| EL-M04-S7-005 | filter | visible-default | "Diperbaiki (5)", → ?status=fixed, fa-check | FN-M04-3.2.2 |
| EL-M04-S7-006 | filter | visible-default | "Ditolak (0)", → ?status=dismissed, fa-times | FN-M04-3.2.2 |
| EL-M04-S7-007 | filter | visible-default | "Semua (10)", → ?status=all, fa-list | FN-M04-3.2.2 |
| EL-M04-S7-008 | card | visible-default | "Menunggu" | FN-M04-3.2.3 |
| EL-M04-S7-009 | badge | visible-default | "Menunggu", fa-clock | FN-M04-3.2.3 |
| EL-M04-S7-010 | badge | visible-default | "Lain-lain", fa-info-circle | FN-M04-3.2.4 |
| EL-M04-S7-011 | badge | visible-default | "trial", fa-database | FN-M04-3.2.6 |
| EL-M04-S7-012 | text | visible-default | "Oleh:" | FN-M04-3.2.7 |
| EL-M04-S7-013 | text | visible-default | "<person>" | FN-M04-3.2.7 |
| EL-M04-S7-014 | text | visible-default | "2 minggu yang lepas" | FN-M04-3.2.7 |
| EL-M04-S7-015 | badge | visible-default | "ID Soalan: 3698", fa-hashtag | FN-M04-3.2.8 |
| EL-M04-S7-016 | badge | visible-default | "Lain-lain" | FN-M04-3.2.9 |
| EL-M04-S7-017 | text | visible-default | "Soalan Struktur #3698:", fa-file-alt | FN-M04-3.2.10 |
| EL-M04-S7-018 | text | visible-default | "Kedaulatan ialah konsep kenegaraan yang diasaskan sejak tamadun Yunani dan ditafsirkan ole" | FN-M04-3.2.10 |
| EL-M04-S7-019 | text | visible-default | "Sejarah — Tingkatan 5" | FN-M04-3.2.10 |
| EL-M04-S7-020 | text | visible-default | "Compliance: verified" | FN-M04-3.2.10 |
| EL-M04-S7-021 | text | visible-default | "Komen pelajar:", fa-comment | FN-M04-3.2.11 |
| EL-M04-S7-022 | text | visible-default | "Lambat" | FN-M04-3.2.11 |
| EL-M04-S7-023 | form | visible-default | POST /admin/question-reports/10/update | FN-M04-3.2.13 |
| EL-M04-S7-024 | hidden-field | hidden-only | `_token` | FN-M04-3.2.13 |
| EL-M04-S7-025 | hidden-field | hidden-only | `status` | FN-M04-3.2.13 |
| EL-M04-S7-026 | textarea | visible-default | `admin_notes`, ph "Contoh: Soalan diperbaiki / Soalan dikeluarkan kerana silibus lama..." | FN-M04-3.2.13 |
| EL-M04-S7-027 | button | visible-default | "Tandakan Selesai", fa-check | FN-M04-3.2.13 |
| EL-M04-S7-028 | form | visible-default | POST /admin/question-reports/10/update | FN-M04-3.2.14 |
| EL-M04-S7-029 | hidden-field | hidden-only | `_token` | FN-M04-3.2.14 |
| EL-M04-S7-030 | hidden-field | hidden-only | `status` | FN-M04-3.2.14 |
| EL-M04-S7-031 | hidden-field | hidden-only | `admin_notes` | FN-M04-3.2.14 |
| EL-M04-S7-032 | hidden-field | hidden-only | `reactivate` | FN-M04-3.2.14 |
| EL-M04-S7-033 | button | visible-default | "Tolak & Aktifkan Semula", fa-times | FN-M04-3.2.14 |
| EL-M04-S7-034 | link | visible-default | "Lihat Soalan Struktur #3698", → /admin/structured-questions/3698, fa-eye | FN-M04-3.2.16 |
| EL-M04-S7-035 | link | visible-default | "Buka Soalan Sama", → /latihan-berstruktur/3698/jawab?scope=spm, fa-external-link-alt | FN-M04-3.2.17 |
| EL-M04-S7-036 | form | visible-default | POST /admin/question-reports/10/update | FN-M04-3.2.15 |
| EL-M04-S7-037 | hidden-field | hidden-only | `_token` | FN-M04-3.2.15 |
| EL-M04-S7-038 | hidden-field | hidden-only | `status` | FN-M04-3.2.15 |
| EL-M04-S7-039 | hidden-field | hidden-only | `admin_notes` | FN-M04-3.2.15 |
| EL-M04-S7-040 | hidden-field | hidden-only | `force_deactivate` | FN-M04-3.2.15 |
| EL-M04-S7-041 | button | visible-default | "Nyahaktif Segera", fa-ban | FN-M04-3.2.15 |
| EL-M04-S7-042 | card | visible-default | "Menunggu" | FN-M04-3.2.3 |
| EL-M04-S7-043 | badge | visible-default | "Menunggu", fa-clock | FN-M04-3.2.3 |
| EL-M04-S7-044 | badge | visible-default | "Lain-lain", fa-info-circle | FN-M04-3.2.4 |
| EL-M04-S7-045 | badge | visible-default | "trial", fa-database | FN-M04-3.2.6 |
| EL-M04-S7-046 | text | visible-default | "Oleh:" | FN-M04-3.2.7 |
| EL-M04-S7-047 | text | visible-default | "<person>" | FN-M04-3.2.7 |
| EL-M04-S7-048 | text | visible-default | "3 bulan yang lepas" | FN-M04-3.2.7 |
| EL-M04-S7-049 | badge | visible-default | "ID Soalan: 3700", fa-hashtag | FN-M04-3.2.8 |
| EL-M04-S7-050 | badge | visible-default | "Lain-lain" | FN-M04-3.2.9 |
| EL-M04-S7-051 | text | visible-default | "Soalan Struktur #3700:", fa-file-alt | FN-M04-3.2.10 |
| EL-M04-S7-052 | text | visible-default | "Petikan 2: Dialog Kerabu Rumpai Laut." | FN-M04-3.2.10 |
| EL-M04-S7-053 | text | visible-default | "Bahasa Melayu — Tingkatan 5" | FN-M04-3.2.10 |
| EL-M04-S7-054 | text | visible-default | "Compliance: verified" | FN-M04-3.2.10 |
| EL-M04-S7-055 | form | visible-default | POST /admin/question-reports/9/update | FN-M04-3.2.13 |
| EL-M04-S7-056 | hidden-field | hidden-only | `_token` | FN-M04-3.2.13 |
| EL-M04-S7-057 | hidden-field | hidden-only | `status` | FN-M04-3.2.13 |
| EL-M04-S7-058 | textarea | visible-default | `admin_notes`, ph "Contoh: Soalan diperbaiki / Soalan dikeluarkan kerana silibus lama..." | FN-M04-3.2.13 |
| EL-M04-S7-059 | button | visible-default | "Tandakan Selesai", fa-check | FN-M04-3.2.13 |
| EL-M04-S7-060 | form | visible-default | POST /admin/question-reports/9/update | FN-M04-3.2.14 |
| EL-M04-S7-061 | hidden-field | hidden-only | `_token` | FN-M04-3.2.14 |
| EL-M04-S7-062 | hidden-field | hidden-only | `status` | FN-M04-3.2.14 |
| EL-M04-S7-063 | hidden-field | hidden-only | `admin_notes` | FN-M04-3.2.14 |
| EL-M04-S7-064 | hidden-field | hidden-only | `reactivate` | FN-M04-3.2.14 |
| EL-M04-S7-065 | button | visible-default | "Tolak & Aktifkan Semula", fa-times | FN-M04-3.2.14 |
| EL-M04-S7-066 | link | visible-default | "Lihat Soalan Struktur #3700", → /admin/structured-questions/3700, fa-eye | FN-M04-3.2.16 |
| EL-M04-S7-067 | link | visible-default | "Buka Soalan Sama", → /latihan-berstruktur/3700/jawab?scope=spm, fa-external-link-alt | FN-M04-3.2.17 |
| EL-M04-S7-068 | form | visible-default | POST /admin/question-reports/9/update | FN-M04-3.2.15 |
| EL-M04-S7-069 | hidden-field | hidden-only | `_token` | FN-M04-3.2.15 |
| EL-M04-S7-070 | hidden-field | hidden-only | `status` | FN-M04-3.2.15 |
| EL-M04-S7-071 | hidden-field | hidden-only | `admin_notes` | FN-M04-3.2.15 |
| EL-M04-S7-072 | hidden-field | hidden-only | `force_deactivate` | FN-M04-3.2.15 |
| EL-M04-S7-073 | button | visible-default | "Nyahaktif Segera", fa-ban | FN-M04-3.2.15 |
| EL-M04-S7-074 | card | conditional | "Dikeluarkan" | FN-M04-3.2.3 |
| EL-M04-S7-075 | badge | conditional | "Dikeluarkan", fa-ban | FN-M04-3.2.3 |
| EL-M04-S7-076 | badge | conditional | "Lain-lain", fa-info-circle | FN-M04-3.2.4 |
| EL-M04-S7-077 | badge | conditional | "Dinyahaktif", fa-ban | FN-M04-3.2.5 |
| EL-M04-S7-078 | badge | conditional | "trial", fa-database | FN-M04-3.2.6 |
| EL-M04-S7-079 | text | conditional | "Oleh:" | FN-M04-3.2.7 |
| EL-M04-S7-080 | text | conditional | "<person>" | FN-M04-3.2.7 |
| EL-M04-S7-081 | text | conditional | "3 bulan yang lepas" | FN-M04-3.2.7 |
| EL-M04-S7-082 | badge | conditional | "ID Soalan: 3699", fa-hashtag | FN-M04-3.2.8 |
| EL-M04-S7-083 | badge | conditional | "Lain-lain" | FN-M04-3.2.9 |
| EL-M04-S7-084 | text | conditional | "Soalan Struktur #3699:", fa-file-alt | FN-M04-3.2.10 |
| EL-M04-S7-085 | text | conditional | "Petikan 1: Rencana Wau Kapal." | FN-M04-3.2.10 |
| EL-M04-S7-086 | text | conditional | "Bahasa Melayu — Tingkatan 5" | FN-M04-3.2.10 |
| EL-M04-S7-087 | text | conditional | "Compliance: verified" | FN-M04-3.2.10 |
| EL-M04-S7-088 | text | conditional | "Komen pelajar:", fa-comment | FN-M04-3.2.11 |
| EL-M04-S7-089 | empty-state | conditional | "Tiada soalan???" | FN-M04-3.2.11 |
| EL-M04-S7-090 | empty-state | conditional (state captured @1280 only) | "Tiada laporan buat masa ini" | FN-M04-3.2.18 |
| EL-M04-S7-091 | card | conditional (state captured @1280 only) | "Dikeluarkan" | FN-M04-3.2.3 |
| EL-M04-S7-092 | badge | conditional (state captured @1280 only) | "Dikeluarkan", fa-ban | FN-M04-3.2.3 |
| EL-M04-S7-093 | alert | conditional (state captured @1280 only) | "Tak Jelas", fa-question-circle | FN-M04-3.2.4 |
| EL-M04-S7-094 | badge | conditional (state captured @1280 only) | "Dinyahaktif", fa-ban | FN-M04-3.2.5 |
| EL-M04-S7-095 | badge | conditional (state captured @1280 only) | "Soalan mengelirukan" | FN-M04-3.2.9 |
| EL-M04-S7-096 | text | conditional (state captured @1280 only) | "Petikan 1: Rencana Wau Kapal." | FN-M04-3.2.10 |
| EL-M04-S7-097 | text | conditional (state captured @1280 only) | "tidak dapat melihat petikan tersebut." | FN-M04-3.2.11 |
| EL-M04-S7-098 | card | conditional (state captured @1280 only) | "Dikeluarkan" | FN-M04-3.2.3 |
| EL-M04-S7-099 | badge | conditional (state captured @1280 only) | "Dikeluarkan", fa-ban | FN-M04-3.2.3 |
| EL-M04-S7-100 | alert | conditional (state captured @1280 only) | "Tak Jelas", fa-question-circle | FN-M04-3.2.4 |
| EL-M04-S7-101 | badge | conditional (state captured @1280 only) | "Dinyahaktif", fa-ban | FN-M04-3.2.5 |
| EL-M04-S7-102 | text | conditional (state captured @1280 only) | "4 bulan yang lepas" | FN-M04-3.2.7 |
| EL-M04-S7-103 | badge | conditional (state captured @1280 only) | "Soalan mengelirukan" | FN-M04-3.2.9 |
| EL-M04-S7-104 | text | conditional (state captured @1280 only) | "Petikan 1: Rencana Wau Kapal." | FN-M04-3.2.10 |
| EL-M04-S7-105 | text | conditional (state captured @1280 only) | "Bahasa Melayu — Tingkatan 5" | FN-M04-3.2.10 |
| EL-M04-S7-106 | card | conditional (state captured @1280 only) | "Disemak" | FN-M04-3.2.3 |
| EL-M04-S7-107 | badge | conditional (state captured @1280 only) | "Disemak", fa-eye | FN-M04-3.2.3 |
| EL-M04-S7-108 | badge | conditional (state captured @1280 only) | "tracking_a_<redacted>_math_20260326", fa-database | FN-M04-3.2.6 |
| EL-M04-S7-109 | text | conditional (state captured @1280 only) | "Bilik: Y31OBA" | FN-M04-3.2.7 |
| EL-M04-S7-110 | badge | conditional (state captured @1280 only) | "unclear" | FN-M04-3.2.9 |
| EL-M04-S7-111 | text | conditional (state captured @1280 only) | "Soalan #136891:", fa-file-alt | FN-M04-3.2.10 |
| EL-M04-S7-112 | text | conditional (state captured @1280 only) | "Rajah 16 menunjukkan dua segi tiga, GHIJ dan PQR, dilukis di atas satah Cartes. Segi tiga " | FN-M04-3.2.10 |
| EL-M04-S7-113 | text | conditional (state captured @1280 only) | "A. A" | FN-M04-3.2.10 |
| EL-M04-S7-114 | text | conditional (state captured @1280 only) | "B. B", fa-check | FN-M04-3.2.10 |
| EL-M04-S7-115 | text | conditional (state captured @1280 only) | "C. C" | FN-M04-3.2.10 |
| EL-M04-S7-116 | text | conditional (state captured @1280 only) | "D. D" | FN-M04-3.2.10 |
| EL-M04-S7-117 | text | conditional (state captured @1280 only) | "Matematik — Tingkatan 5" | FN-M04-3.2.10 |
| EL-M04-S7-118 | text | conditional (state captured @1280 only) | "Status tindakan admin:", fa-sticky-note | FN-M04-3.2.12 |
| EL-M04-S7-119 | text | conditional (state captured @1280 only) | "Dinyahaktifkan segera oleh admin" | FN-M04-3.2.12 |
| EL-M04-S7-120 | link | conditional (state captured @1280 only) | "Edit Soalan #136891", → /admin/questions/136891/edit, fa-edit | FN-M04-3.2.16 |
| EL-M04-S7-121 | link | conditional (state captured @1280 only) | "Buka Soalan Sama", → /spm/latih-tubi/MATH/quiz?question_id=136891&count=1, fa-external-link-alt | FN-M04-3.2.17 |
| EL-M04-S7-122 | card | conditional (state captured @1280 only) | "Disemak" | FN-M04-3.2.3 |
| EL-M04-S7-123 | badge | conditional (state captured @1280 only) | "Disemak", fa-eye | FN-M04-3.2.3 |
| EL-M04-S7-124 | alert | conditional (state captured @1280 only) | "Jawapan Salah", fa-times-circle | FN-M04-3.2.4 |
| EL-M04-S7-125 | text | conditional (state captured @1280 only) | "4 bulan yang lepas" | FN-M04-3.2.7 |
| EL-M04-S7-126 | badge | conditional (state captured @1280 only) | "Set jawapan tidak tepat" | FN-M04-3.2.9 |
| EL-M04-S7-127 | text | conditional (state captured @1280 only) | "Part 1 email response to cousin Fairuz about planning an outing after exams." | FN-M04-3.2.10 |
| EL-M04-S7-128 | text | conditional (state captured @1280 only) | "Bahasa Inggeris — Tingkatan 5" | FN-M04-3.2.10 |
| EL-M04-S7-129 | text | conditional (state captured @1280 only) | "This is supposed to be an email and obviously marks depends on what we say.. why is there " | FN-M04-3.2.11 |
| EL-M04-S7-130 | text | conditional (state captured @1280 only) | "Status tindakan admin:", fa-sticky-note | FN-M04-3.2.12 |
| EL-M04-S7-131 | text | conditional (state captured @1280 only) | "Dinyahaktifkan segera oleh admin" | FN-M04-3.2.12 |
| EL-M04-S7-132 | card | conditional (state captured @1280 only) | "Disemak" | FN-M04-3.2.3 |
| EL-M04-S7-133 | badge | conditional (state captured @1280 only) | "Disemak", fa-eye | FN-M04-3.2.3 |
| EL-M04-S7-134 | alert | conditional (state captured @1280 only) | "Jawapan Salah", fa-times-circle | FN-M04-3.2.4 |
| EL-M04-S7-135 | text | conditional (state captured @1280 only) | "5 bulan yang lepas" | FN-M04-3.2.7 |
| EL-M04-S7-136 | badge | conditional (state captured @1280 only) | "Jawapan tidak tepat" | FN-M04-3.2.9 |
| EL-M04-S7-137 | text | conditional (state captured @1280 only) | "Jadual 1 menunjukkan markah Irfan bagi empat subjek dalam asas yang berbeza." | FN-M04-3.2.10 |
| EL-M04-S7-138 | text | conditional (state captured @1280 only) | "Matematik — Tingkatan 4" | FN-M04-3.2.10 |
| EL-M04-S7-139 | text | conditional (state captured @1280 only) | "Compliance: draft" | FN-M04-3.2.10 |
| EL-M04-S7-140 | text | conditional (state captured @1280 only) | "Bende ni AI" | FN-M04-3.2.11 |
| EL-M04-S7-141 | text | conditional (state captured @1280 only) | "Status tindakan admin:", fa-sticky-note | FN-M04-3.2.12 |
| EL-M04-S7-142 | text | conditional (state captured @1280 only) | "Dinyahaktifkan segera oleh admin" | FN-M04-3.2.12 |
| EL-M04-S7-143 | textarea | conditional (state captured @1280 only) | `admin_notes`, ph "Contoh: Soalan diperbaiki / Soalan dikeluarkan kerana silibus lama..." | FN-M04-3.2.13 |
| EL-M04-S7-144 | button | conditional (state captured @1280 only) | "Tandakan Selesai", fa-check | FN-M04-3.2.13 |
| EL-M04-S7-145 | hidden-field | hidden-only | `reactivate` | FN-M04-3.2.14 |
| EL-M04-S7-146 | button | conditional (state captured @1280 only) | "Tolak & Aktifkan Semula", fa-times | FN-M04-3.2.14 |

#### S8 — `/admin/structured-questions` (81 elements)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M04-S8-001 | heading | visible-default | "Soalan Berstruktur" | FN-M04-4.1.1 |
| EL-M04-S8-002 | text | visible-default | "Semua soalan berstruktur SPM dalam sistem" | FN-M04-4.1.1 |
| EL-M04-S8-003 | link | visible-default | "Tambah Soalan", → /guru/soalan-berstruktur/cipta, fa-plus | FN-M04-4.1.1 |
| EL-M04-S8-004 | card | visible-default | "4,064" | FN-M04-4.1.2 |
| EL-M04-S8-005 | text | visible-default | "4,064" | FN-M04-4.1.2 |
| EL-M04-S8-006 | text | visible-default | "Jumlah Soalan" | FN-M04-4.1.2 |
| EL-M04-S8-007 | card | visible-default | "4,064" | FN-M04-4.1.2 |
| EL-M04-S8-008 | text | visible-default | "4,064" | FN-M04-4.1.2 |
| EL-M04-S8-009 | text | visible-default | "Published" | FN-M04-4.1.2 |
| EL-M04-S8-010 | card | visible-default | "774" | FN-M04-4.1.3 |
| EL-M04-S8-011 | text | visible-default | "Agihan Mengikut Subjek" | FN-M04-4.1.3 |
| EL-M04-S8-012 | badge | visible-default | "Bahasa Inggeris: 774" | FN-M04-4.1.3 |
| EL-M04-S8-013 | badge | visible-default | "Bahasa Melayu: 560" | FN-M04-4.1.3 |
| EL-M04-S8-014 | badge | visible-default | "Biologi: 219" | FN-M04-4.1.3 |
| EL-M04-S8-015 | badge | visible-default | "Ekonomi: 42" | FN-M04-4.1.3 |
| EL-M04-S8-016 | badge | visible-default | "Fizik: 246" | FN-M04-4.1.3 |
| EL-M04-S8-017 | badge | visible-default | "Geografi: 21" | FN-M04-4.1.3 |
| EL-M04-S8-018 | badge | visible-default | "Kimia: 232" | FN-M04-4.1.3 |
| EL-M04-S8-019 | badge | visible-default | "Matematik: 299" | FN-M04-4.1.3 |
| EL-M04-S8-020 | badge | visible-default | "Matematik Tambahan: 256" | FN-M04-4.1.3 |
| EL-M04-S8-021 | badge | visible-default | "Perniagaan: 763" | FN-M04-4.1.3 |
| EL-M04-S8-022 | badge | visible-default | "Prinsip Perakaunan: 76" | FN-M04-4.1.3 |
| EL-M04-S8-023 | badge | visible-default | "Sains: 204" | FN-M04-4.1.3 |
| EL-M04-S8-024 | badge | visible-default | "Sains Komputer: 22" | FN-M04-4.1.3 |
| EL-M04-S8-025 | badge | visible-default | "Sejarah: 328" | FN-M04-4.1.3 |
| EL-M04-S8-026 | badge | visible-default | "Tasawwur Islam: 22" | FN-M04-4.1.3 |
| EL-M04-S8-027 | form | visible-default | GET /admin/structured-questions | FN-M04-4.1.4 |
| EL-M04-S8-028 | label | visible-default | "Subjek" | FN-M04-4.1.4 |
| EL-M04-S8-029 | select | visible-default | `subject_id`, 32 options (first "Semua Subjek") | FN-M04-4.1.4 |
| EL-M04-S8-030 | label | visible-default | "Tingkatan" | FN-M04-4.1.4 |
| EL-M04-S8-031 | select | visible-default | `education_level_id`, 12 options (first "Semua") | FN-M04-4.1.4 |
| EL-M04-S8-032 | label | visible-default | "KBAT" | FN-M04-4.1.4 |
| EL-M04-S8-033 | select | visible-default | `kbat_level`, 5 options (first "Semua KBAT") | FN-M04-4.1.4 |
| EL-M04-S8-034 | button | visible-default | "Cari", fa-search | FN-M04-4.1.4 |
| EL-M04-S8-035 | card | visible-default | "#" | FN-M04-4.1.5 |
| EL-M04-S8-036 | table | visible-default | (table) | FN-M04-4.1.5 |
| EL-M04-S8-037 | badge | visible-default (desktop-only) | "Perniagaan" | FN-M04-4.1.5 |
| EL-M04-S8-038 | badge | visible-default | "L3" | FN-M04-4.1.5 |
| EL-M04-S8-039 | link | visible-default | "Lihat", → /admin/structured-questions/4454, fa-eye | FN-M04-4.1.5 |
| EL-M04-S8-040 | badge | visible-default (desktop-only) | "Perniagaan" | FN-M04-4.1.5 |
| EL-M04-S8-041 | badge | visible-default | "L3" | FN-M04-4.1.5 |
| EL-M04-S8-042 | link | visible-default | "Lihat", → /admin/structured-questions/4455, fa-eye | FN-M04-4.1.5 |
| EL-M04-S8-043 | badge | visible-default (desktop-only) | "Perniagaan" | FN-M04-4.1.5 |
| EL-M04-S8-044 | badge | visible-default | "L3" | FN-M04-4.1.5 |
| EL-M04-S8-045 | link | visible-default | "Lihat", → /admin/structured-questions/4456, fa-eye | FN-M04-4.1.5 |
| EL-M04-S8-046 | text | conditional (mobile-only) | "« Previous" | FN-M04-4.1.8 |
| EL-M04-S8-047 | pagination | conditional (mobile-only) | "Next »", → /admin/structured-questions?page=2 | FN-M04-4.1.8 |
| EL-M04-S8-048 | text | visible-default (desktop-only) | "Showing to of results" | FN-M04-4.1.7 |
| EL-M04-S8-049 | text | visible-default (desktop-only) | "1" | FN-M04-4.1.7 |
| EL-M04-S8-050 | text | visible-default (desktop-only) | "25" | FN-M04-4.1.7 |
| EL-M04-S8-051 | text | visible-default (desktop-only) | "4064" | FN-M04-4.1.7 |
| EL-M04-S8-052 | text | visible-default (desktop-only) | "1" | FN-M04-4.1.7 |
| EL-M04-S8-053 | pagination | visible-default (desktop-only) | "2", → /admin/structured-questions?page=2, aria "Go to page 2" | FN-M04-4.1.7 |
| EL-M04-S8-054 | pagination | visible-default (desktop-only) | "3", → /admin/structured-questions?page=3, aria "Go to page 3" | FN-M04-4.1.7 |
| EL-M04-S8-055 | pagination | visible-default (desktop-only) | "4", → /admin/structured-questions?page=4, aria "Go to page 4" | FN-M04-4.1.7 |
| EL-M04-S8-056 | pagination | visible-default (desktop-only) | "5", → /admin/structured-questions?page=5, aria "Go to page 5" | FN-M04-4.1.7 |
| EL-M04-S8-057 | pagination | visible-default (desktop-only) | "6", → /admin/structured-questions?page=6, aria "Go to page 6" | FN-M04-4.1.7 |
| EL-M04-S8-058 | pagination | visible-default (desktop-only) | "7", → /admin/structured-questions?page=7, aria "Go to page 7" | FN-M04-4.1.7 |
| EL-M04-S8-059 | pagination | visible-default (desktop-only) | "8", → /admin/structured-questions?page=8, aria "Go to page 8" | FN-M04-4.1.7 |
| EL-M04-S8-060 | pagination | visible-default (desktop-only) | "9", → /admin/structured-questions?page=9, aria "Go to page 9" | FN-M04-4.1.7 |
| EL-M04-S8-061 | pagination | visible-default (desktop-only) | "10", → /admin/structured-questions?page=10, aria "Go to page 10" | FN-M04-4.1.7 |
| EL-M04-S8-062 | text | visible-default (desktop-only) | "..." | FN-M04-4.1.7 |
| EL-M04-S8-063 | pagination | visible-default (desktop-only) | "162", → /admin/structured-questions?page=162, aria "Go to page 162" | FN-M04-4.1.7 |
| EL-M04-S8-064 | pagination | visible-default (desktop-only) | "163", → /admin/structured-questions?page=163, aria "Go to page 163" | FN-M04-4.1.7 |
| EL-M04-S8-065 | pagination | visible-default (desktop-only) | → /admin/structured-questions?page=2, svg, aria "Next &raquo;" | FN-M04-4.1.7 |
| EL-M04-S8-066 | text | visible-default | "Menunjukkan 1–25 daripada 4,064 soalan" | FN-M04-4.1.6 |
| EL-M04-S8-067 | link | conditional (state captured @1280 only) | "Reset", → /admin/structured-questions | FN-M04-4.1.4 |
| EL-M04-S8-068 | text | conditional (state captured @1280 only) | "Menunjukkan – daripada 0 soalan" | FN-M04-4.1.6 |
| EL-M04-S8-069 | badge | conditional (state captured @1280 only) | "Tasawwur Islam" | FN-M04-4.1.5 |
| EL-M04-S8-070 | badge | conditional (state captured @1280 only) | "L5" | FN-M04-4.1.5 |
| EL-M04-S8-071 | badge | conditional (state captured @1280 only) | "Tasawwur Islam" | FN-M04-4.1.5 |
| EL-M04-S8-072 | badge | conditional (state captured @1280 only) | "L5" | FN-M04-4.1.5 |
| EL-M04-S8-073 | badge | conditional (state captured @1280 only) | "Tasawwur Islam" | FN-M04-4.1.5 |
| EL-M04-S8-074 | badge | conditional (state captured @1280 only) | "L5" | FN-M04-4.1.5 |
| EL-M04-S8-075 | text | conditional (state captured @1280 only) | "Menunjukkan 1–25 daripada 483 soalan" | FN-M04-4.1.6 |
| EL-M04-S8-076 | pagination | hidden-only | "« Previous", → /admin/structured-questions?page=1 | FN-M04-4.1.8 |
| EL-M04-S8-077 | pagination | conditional (state captured @1280 only) | → /admin/structured-questions?page=3, svg, aria "Next &raquo;" | FN-M04-4.1.7 |
| EL-M04-S8-078 | text | conditional (state captured @1280 only) | "Menunjukkan 26–50 daripada 4,064 soalan" | FN-M04-4.1.6 |
| EL-M04-S8-079 | badge | conditional (state captured @1280 only) | "Bahasa Inggeris" | FN-M04-4.1.5 |
| EL-M04-S8-080 | badge | conditional (state captured @1280 only) | "Bahasa Inggeris" | FN-M04-4.1.5 |
| EL-M04-S8-081 | badge | conditional (state captured @1280 only) | "Bahasa Inggeris" | FN-M04-4.1.5 |

#### S9 — `/admin/structured-questions/{id}` (45 elements)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M04-S9-001 | link | visible-default | "Kembali ke senarai", → /admin/structured-questions, fa-arrow-left | FN-M04-4.2.1 |
| EL-M04-S9-002 | card | visible-default | "Sejarah" | FN-M04-4.2.2 |
| EL-M04-S9-003 | badge | visible-default | "Sejarah" | FN-M04-4.2.2 |
| EL-M04-S9-004 | badge | visible-default | "Tingkatan 5" | FN-M04-4.2.2 |
| EL-M04-S9-005 | badge | visible-default | "KBAT: Mengaplikasi (L3)" | FN-M04-4.2.2 |
| EL-M04-S9-006 | badge | visible-default | "10 Markah" | FN-M04-4.2.2 |
| EL-M04-S9-007 | text | visible-default | "ID: #3698" | FN-M04-4.2.2 |
| EL-M04-S9-008 | text | visible-default | "Stimulus / Konteks Soalan" | FN-M04-4.2.3 |
| EL-M04-S9-009 | text | visible-default | "Kedaulatan ialah konsep kenegaraan yang diasaskan sejak tamadun Yunani dan ditafsirkan ole" | FN-M04-4.2.3 |
| EL-M04-S9-010 | text | visible-default | "Dicipta oleh: <person>", fa-user | FN-M04-4.2.4 |
| EL-M04-S9-011 | text | visible-default | "08 Apr 2026", fa-calendar | FN-M04-4.2.4 |
| EL-M04-S9-012 | text | visible-default | "Visibiliti: Public", fa-eye | FN-M04-4.2.4 |
| EL-M04-S9-013 | text | visible-default | "Published", fa-circle | FN-M04-4.2.4 |
| EL-M04-S9-014 | heading | visible-default | "Bahagian Soalan (3 sub-soalan)" | FN-M04-4.2.5 |
| EL-M04-S9-015 | card | visible-default | "3(A)" | FN-M04-4.2.5 |
| EL-M04-S9-016 | badge | visible-default | "3(A)" | FN-M04-4.2.5 |
| EL-M04-S9-017 | text | visible-default | "Apakah yang anda faham dengan konsep kedaulatan?" | FN-M04-4.2.5 |
| EL-M04-S9-018 | text | visible-default | "2m" | FN-M04-4.2.5 |
| EL-M04-S9-019 | text | visible-default | "Jawapan Model" | FN-M04-4.2.5 |
| EL-M04-S9-020 | text | visible-default | "Kedaulatan ialah kekuasaan tertinggi sesebuah negara yang bebas daripada campur tangan kua" | FN-M04-4.2.5 |
| EL-M04-S9-021 | card | visible-default | "3(B)" | FN-M04-4.2.5 |
| EL-M04-S9-022 | badge | visible-default | "3(B)" | FN-M04-4.2.5 |
| EL-M04-S9-023 | text | visible-default | "Bagaimanakah pemerintah dan rakyat berperanan bagi mengekalkan kedaulatan negara?" | FN-M04-4.2.5 |
| EL-M04-S9-024 | text | visible-default | "4m" | FN-M04-4.2.5 |
| EL-M04-S9-025 | text | visible-default | "Jawapan Model" | FN-M04-4.2.5 |
| EL-M04-S9-026 | text | visible-default | "Pemerintah perlu mentadbir dengan cekap, menjaga keselamatan, menguatkuasakan undang-undan" | FN-M04-4.2.5 |
| EL-M04-S9-027 | card | visible-default | "3(C)" | FN-M04-4.2.5 |
| EL-M04-S9-028 | badge | visible-default | "3(C)" | FN-M04-4.2.5 |
| EL-M04-S9-029 | text | visible-default | "Jelaskan kepentingan mengekalkan kedaulatan negara." | FN-M04-4.2.5 |
| EL-M04-S9-030 | text | visible-default | "4m" | FN-M04-4.2.5 |
| EL-M04-S9-031 | text | visible-default | "Jawapan Model" | FN-M04-4.2.5 |
| EL-M04-S9-032 | text | visible-default | "Kedaulatan penting untuk menjamin keamanan, kestabilan politik, kemakmuran ekonomi, melind" | FN-M04-4.2.5 |
| EL-M04-S9-033 | link | visible-default | "Edit Soalan", → /guru/soalan-berstruktur/3698/edit, fa-edit | FN-M04-4.2.6 |
| EL-M04-S9-034 | link | visible-default | "Balik ke Senarai", → /admin/structured-questions, fa-list | FN-M04-4.2.6 |
| EL-M04-S9-035 | card | conditional (state captured @1280 only) | "Perniagaan" | FN-M04-4.2.2 |
| EL-M04-S9-036 | badge | conditional (state captured @1280 only) | "Perniagaan" | FN-M04-4.2.2 |
| EL-M04-S9-037 | badge | conditional (state captured @1280 only) | "8 Markah" | FN-M04-4.2.2 |
| EL-M04-S9-038 | text | conditional (state captured @1280 only) | "Soalan Oleh: <person> Kertas 2 Bab 7 Tingkatan 5 (2019) Item 1 Terangkan kepentingan menye" | FN-M04-4.2.3 |
| EL-M04-S9-039 | text | conditional (state captured @1280 only) | "20 May 2026", fa-calendar | FN-M04-4.2.4 |
| EL-M04-S9-040 | heading | conditional (state captured @1280 only) | "Bahagian Soalan (1 sub-soalan)" | FN-M04-4.2.5 |
| EL-M04-S9-041 | card | conditional (state captured @1280 only) | "A" | FN-M04-4.2.5 |
| EL-M04-S9-042 | badge | conditional (state captured @1280 only) | "A" | FN-M04-4.2.5 |
| EL-M04-S9-043 | text | conditional (state captured @1280 only) | "Terangkan kepentingan menyediakan rancangan perniagaan kepada usahawan. [8 markah] Negeri " | FN-M04-4.2.5 |
| EL-M04-S9-044 | text | conditional (state captured @1280 only) | "8m" | FN-M04-4.2.5 |
| EL-M04-S9-045 | text | conditional (state captured @1280 only) | "Terangkan kepentingan menyediakan rancangan perniagaan kepada usahawan. JAWAPAN Meyakinkan" | FN-M04-4.2.5 |

#### S10 — `/admin/question-submissions` (48 elements)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M04-S10-001 | card | visible-default | "4" | FN-M04-5.1.1 |
| EL-M04-S10-002 | text | visible-default | "4" | FN-M04-5.1.1 |
| EL-M04-S10-003 | text | visible-default | "Jumlah" | FN-M04-5.1.1 |
| EL-M04-S10-004 | card | visible-default | "0" | FN-M04-5.1.1 |
| EL-M04-S10-005 | text | visible-default | "0" | FN-M04-5.1.1 |
| EL-M04-S10-006 | text | visible-default | "Pending" | FN-M04-5.1.1 |
| EL-M04-S10-007 | card | visible-default | "3" | FN-M04-5.1.1 |
| EL-M04-S10-008 | text | visible-default | "3" | FN-M04-5.1.1 |
| EL-M04-S10-009 | text | visible-default | "Processing" | FN-M04-5.1.1 |
| EL-M04-S10-010 | card | visible-default | "1" | FN-M04-5.1.1 |
| EL-M04-S10-011 | text | visible-default | "1" | FN-M04-5.1.1 |
| EL-M04-S10-012 | text | visible-default | "Selesai" | FN-M04-5.1.1 |
| EL-M04-S10-013 | card | visible-default | "Tapis" | FN-M04-5.1.2 |
| EL-M04-S10-014 | form | visible-default | GET  | FN-M04-5.1.2 |
| EL-M04-S10-015 | select | visible-default | `status`, 5 options (first "Semua Status") | FN-M04-5.1.2 |
| EL-M04-S10-016 | button | visible-default | "Tapis", fa-filter | FN-M04-5.1.2 |
| EL-M04-S10-017 | card | visible-default | "Guru / Sekolah" | FN-M04-5.1.3 |
| EL-M04-S10-018 | table | visible-default | (table) | FN-M04-5.1.3 |
| EL-M04-S10-019 | link | visible-default | "PPSA K1 T4 2026.docx", → /admin/question-submissions/4/download/0, fa-download | FN-M04-5.1.4 |
| EL-M04-S10-020 | badge | visible-default | "Selesai", fa-check-circle | FN-M04-5.1.5 |
| EL-M04-S10-021 | dropdown-trigger | visible-default | "Kemaskini", fa-edit | FN-M04-5.1.6 |
| EL-M04-S10-022 | form | conditional | POST /admin/question-submissions/4/status (PATCH) | FN-M04-5.1.6 |
| EL-M04-S10-023 | hidden-field | hidden-only | `_token` | FN-M04-5.1.6 |
| EL-M04-S10-024 | hidden-field | hidden-only | `_method` | FN-M04-5.1.6 |
| EL-M04-S10-025 | select | conditional | `status`, 4 options (first "Pending") | FN-M04-5.1.6 |
| EL-M04-S10-026 | textarea | conditional | `admin_notes`, ph "Nota admin (pilihan)..." | FN-M04-5.1.6 |
| EL-M04-S10-027 | button | conditional | "Simpan" | FN-M04-5.1.6 |
| EL-M04-S10-028 | link | visible-default | "HIMPUNAN_SOALAN_SEJARAH_K1_IKUT_BAB_PERUBAAN_SPM_NEGERI_2024_TINGKATAN copy.pdf", → /admin/question-submissions/3/download/0, fa-download | FN-M04-5.1.4 |
| EL-M04-S10-029 | badge | visible-default | "Processing", fa-cogs | FN-M04-5.1.5 |
| EL-M04-S10-030 | dropdown-trigger | visible-default | "Kemaskini", fa-edit | FN-M04-5.1.6 |
| EL-M04-S10-031 | form | hidden-only | POST /admin/question-submissions/3/status (PATCH) | FN-M04-5.1.6 |
| EL-M04-S10-032 | hidden-field | hidden-only | `_token` | FN-M04-5.1.6 |
| EL-M04-S10-033 | hidden-field | hidden-only | `_method` | FN-M04-5.1.6 |
| EL-M04-S10-034 | select | hidden-only | `status`, 4 options (first "Pending") | FN-M04-5.1.6 |
| EL-M04-S10-035 | textarea | hidden-only | `admin_notes`, ph "Nota admin (pilihan)..." | FN-M04-5.1.6 |
| EL-M04-S10-036 | button | hidden-only | "Simpan" | FN-M04-5.1.6 |
| EL-M04-S10-037 | link | visible-default | "OBJ TOPIKAL T5.pdf", → /admin/question-submissions/2/download/0, fa-download | FN-M04-5.1.4 |
| EL-M04-S10-038 | badge | visible-default | "Processing", fa-cogs | FN-M04-5.1.5 |
| EL-M04-S10-039 | dropdown-trigger | visible-default | "Kemaskini", fa-edit | FN-M04-5.1.6 |
| EL-M04-S10-040 | form | hidden-only | POST /admin/question-submissions/2/status (PATCH) | FN-M04-5.1.6 |
| EL-M04-S10-041 | hidden-field | hidden-only | `_token` | FN-M04-5.1.6 |
| EL-M04-S10-042 | hidden-field | hidden-only | `_method` | FN-M04-5.1.6 |
| EL-M04-S10-043 | select | hidden-only | `status`, 4 options (first "Pending") | FN-M04-5.1.6 |
| EL-M04-S10-044 | textarea | hidden-only | `admin_notes`, ph "Nota admin (pilihan)..." | FN-M04-5.1.6 |
| EL-M04-S10-045 | button | hidden-only | "Simpan" | FN-M04-5.1.6 |
| EL-M04-S10-046 | link | conditional (state captured @1280 only) | "Reset", → /admin/question-submissions | FN-M04-5.1.2 |
| EL-M04-S10-047 | link | conditional (state captured @1280 only) | "GEAR UP 1 TINGKATAN 5.pdf", → /admin/question-submissions/1/download/0, fa-download | FN-M04-5.1.4 |
| EL-M04-S10-048 | badge | conditional (state captured @1280 only) | "Processing", fa-cogs | FN-M04-5.1.5 |

#### S11 — `/admin/soalan-gambar` (145 elements)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M04-S11-001 | card | visible-default | "MCQ Perlu Gambar" | FN-M04-5.2.1 |
| EL-M04-S11-002 | text | visible-default | "6,144" | FN-M04-5.2.1 |
| EL-M04-S11-003 | text | visible-default | "MCQ Perlu Gambar" | FN-M04-5.2.1 |
| EL-M04-S11-004 | card | visible-default | "Struktur Perlu Gambar" | FN-M04-5.2.1 |
| EL-M04-S11-005 | text | visible-default | "522" | FN-M04-5.2.1 |
| EL-M04-S11-006 | text | visible-default | "Struktur Perlu Gambar" | FN-M04-5.2.1 |
| EL-M04-S11-007 | card | visible-default | "Jumlah" | FN-M04-5.2.1 |
| EL-M04-S11-008 | text | visible-default | "6,666" | FN-M04-5.2.1 |
| EL-M04-S11-009 | text | visible-default | "Jumlah" | FN-M04-5.2.1 |
| EL-M04-S11-010 | card | visible-default | "MCQ Perlu Gambar Mengikut Mata Pelajaran" | FN-M04-5.2.2 |
| EL-M04-S11-011 | text | visible-default | "MCQ Perlu Gambar Mengikut Mata Pelajaran" | FN-M04-5.2.2 |
| EL-M04-S11-012 | badge | visible-default | "Biologi: 1,587" | FN-M04-5.2.2 |
| EL-M04-S11-013 | badge | visible-default | "Kimia: 1,077" | FN-M04-5.2.2 |
| EL-M04-S11-014 | badge | visible-default | "Fizik: 718" | FN-M04-5.2.2 |
| EL-M04-S11-015 | badge | visible-default | "Sains: 662" | FN-M04-5.2.2 |
| EL-M04-S11-016 | badge | visible-default | "Ekonomi: 570" | FN-M04-5.2.2 |
| EL-M04-S11-017 | badge | visible-default | "Prinsip Perakaunan: 393" | FN-M04-5.2.2 |
| EL-M04-S11-018 | badge | visible-default | "Matematik: 336" | FN-M04-5.2.2 |
| EL-M04-S11-019 | badge | visible-default | "Geografi: 320" | FN-M04-5.2.2 |
| EL-M04-S11-020 | badge | visible-default | "Perniagaan: 249" | FN-M04-5.2.2 |
| EL-M04-S11-021 | badge | visible-default | "Pendidikan Moral: 60" | FN-M04-5.2.2 |
| EL-M04-S11-022 | form | visible-default | GET  | FN-M04-5.2.3 |
| EL-M04-S11-023 | select | visible-default | `subject_id`, 32 options (first "Semua Mata Pelajaran") | FN-M04-5.2.3 |
| EL-M04-S11-024 | select | visible-default | `school_id`, 25 options (first "Semua Sekolah") | FN-M04-5.2.3 |
| EL-M04-S11-025 | button | visible-default | "Tapis", fa-filter | FN-M04-5.2.3 |
| EL-M04-S11-026 | heading | visible-default | "MCQ (6144)" | FN-M04-5.2.4 |
| EL-M04-S11-027 | card | visible-default | "Biologi" | FN-M04-5.2.5 |
| EL-M04-S11-028 | text | visible-default | "#563393" | FN-M04-5.2.5 |
| EL-M04-S11-029 | text | visible-default | "Biologi" | FN-M04-5.2.5 |
| EL-M04-S11-030 | text | visible-default | "oleh <person>" | FN-M04-5.2.5 |
| EL-M04-S11-031 | text | visible-default | "Seorang petani mendapati bahawa pokok getahnya menunjukkan kadar transpirasi yang sangat r" | FN-M04-5.2.5 |
| EL-M04-S11-032 | text | visible-default | "T5-BT-BIO---BIOLOGI.pdf ms.1", fa-file-pdf | FN-M04-5.2.5 |
| EL-M04-S11-033 | form | visible-default | POST /admin/soalan-gambar/mcq/563393/upload | FN-M04-5.2.6 |
| EL-M04-S11-034 | hidden-field | hidden-only | `_token` | FN-M04-5.2.6 |
| EL-M04-S11-035 | input | visible-default | `image`, file | FN-M04-5.2.6 |
| EL-M04-S11-036 | button | visible-default | fa-upload | FN-M04-5.2.6 |
| EL-M04-S11-037 | form | visible-default | POST /admin/soalan-gambar/mcq/563393/dismiss | FN-M04-5.2.7 |
| EL-M04-S11-038 | hidden-field | hidden-only | `_token` | FN-M04-5.2.7 |
| EL-M04-S11-039 | button | visible-default | "Dismiss", fa-times | FN-M04-5.2.7 |
| EL-M04-S11-040 | card | visible-default | "Pendidikan Moral" | FN-M04-5.2.5 |
| EL-M04-S11-041 | text | visible-default | "#562177" | FN-M04-5.2.5 |
| EL-M04-S11-042 | text | visible-default | "Pendidikan Moral" | FN-M04-5.2.5 |
| EL-M04-S11-043 | text | visible-default | "oleh <person>" | FN-M04-5.2.5 |
| EL-M04-S11-044 | text | visible-default | "Daniel melihat iklan pelaburan dalam talian yang menjanjikan keuntungan luar biasa dalam s" | FN-M04-5.2.5 |
| EL-M04-S11-045 | text | visible-default | "T5-BT-PM---PENDIDIKAN-MORAL-MPAK.pdf ms.1", fa-file-pdf | FN-M04-5.2.5 |
| EL-M04-S11-046 | form | visible-default | POST /admin/soalan-gambar/mcq/562177/upload | FN-M04-5.2.6 |
| EL-M04-S11-047 | hidden-field | hidden-only | `_token` | FN-M04-5.2.6 |
| EL-M04-S11-048 | input | visible-default | `image`, file | FN-M04-5.2.6 |
| EL-M04-S11-049 | button | visible-default | fa-upload | FN-M04-5.2.6 |
| EL-M04-S11-050 | form | visible-default | POST /admin/soalan-gambar/mcq/562177/dismiss | FN-M04-5.2.7 |
| EL-M04-S11-051 | hidden-field | hidden-only | `_token` | FN-M04-5.2.7 |
| EL-M04-S11-052 | button | visible-default | "Dismiss", fa-times | FN-M04-5.2.7 |
| EL-M04-S11-053 | card | visible-default | "Sains" | FN-M04-5.2.5 |
| EL-M04-S11-054 | text | visible-default | "#561050" | FN-M04-5.2.5 |
| EL-M04-S11-055 | text | visible-default | "Sains" | FN-M04-5.2.5 |
| EL-M04-S11-056 | text | visible-default | "oleh <person>" | FN-M04-5.2.5 |
| EL-M04-S11-057 | text | visible-default | "Apabila objek diletakkan pada jarak 5 cm dari kanta cembung dengan panjang fokus 8 cm, apa" | FN-M04-5.2.5 |
| EL-M04-S11-058 | text | visible-default | "T5-BT-SN---SAINS.pdf ms.1", fa-file-pdf | FN-M04-5.2.5 |
| EL-M04-S11-059 | form | visible-default | POST /admin/soalan-gambar/mcq/561050/upload | FN-M04-5.2.6 |
| EL-M04-S11-060 | hidden-field | hidden-only | `_token` | FN-M04-5.2.6 |
| EL-M04-S11-061 | input | visible-default | `image`, file | FN-M04-5.2.6 |
| EL-M04-S11-062 | button | visible-default | fa-upload | FN-M04-5.2.6 |
| EL-M04-S11-063 | form | visible-default | POST /admin/soalan-gambar/mcq/561050/dismiss | FN-M04-5.2.7 |
| EL-M04-S11-064 | hidden-field | hidden-only | `_token` | FN-M04-5.2.7 |
| EL-M04-S11-065 | button | visible-default | "Dismiss", fa-times | FN-M04-5.2.7 |
| EL-M04-S11-066 | text | conditional (mobile-only) | "« Previous" | FN-M04-5.2.8 |
| EL-M04-S11-067 | pagination | conditional (mobile-only) | "Next »", → /admin/soalan-gambar?mcq_page=2 | FN-M04-5.2.8 |
| EL-M04-S11-068 | text | visible-default (desktop-only) | "Showing to of results" | FN-M04-5.2.8 |
| EL-M04-S11-069 | text | visible-default (desktop-only) | "1" | FN-M04-5.2.8 |
| EL-M04-S11-070 | text | visible-default (desktop-only) | "20" | FN-M04-5.2.8 |
| EL-M04-S11-071 | text | visible-default (desktop-only) | "6144" | FN-M04-5.2.8 |
| EL-M04-S11-072 | text | visible-default (desktop-only) | "1" | FN-M04-5.2.8 |
| EL-M04-S11-073 | pagination | visible-default (desktop-only) | "2", → /admin/soalan-gambar?mcq_page=2, aria "Go to page 2" | FN-M04-5.2.8 |
| EL-M04-S11-074 | pagination | visible-default (desktop-only) | "3", → /admin/soalan-gambar?mcq_page=3, aria "Go to page 3" | FN-M04-5.2.8 |
| EL-M04-S11-075 | pagination | visible-default (desktop-only) | "4", → /admin/soalan-gambar?mcq_page=4, aria "Go to page 4" | FN-M04-5.2.8 |
| EL-M04-S11-076 | pagination | visible-default (desktop-only) | "5", → /admin/soalan-gambar?mcq_page=5, aria "Go to page 5" | FN-M04-5.2.8 |
| EL-M04-S11-077 | pagination | visible-default (desktop-only) | "6", → /admin/soalan-gambar?mcq_page=6, aria "Go to page 6" | FN-M04-5.2.8 |
| EL-M04-S11-078 | pagination | visible-default (desktop-only) | "7", → /admin/soalan-gambar?mcq_page=7, aria "Go to page 7" | FN-M04-5.2.8 |
| EL-M04-S11-079 | pagination | visible-default (desktop-only) | "8", → /admin/soalan-gambar?mcq_page=8, aria "Go to page 8" | FN-M04-5.2.8 |
| EL-M04-S11-080 | pagination | visible-default (desktop-only) | "9", → /admin/soalan-gambar?mcq_page=9, aria "Go to page 9" | FN-M04-5.2.8 |
| EL-M04-S11-081 | pagination | visible-default (desktop-only) | "10", → /admin/soalan-gambar?mcq_page=10, aria "Go to page 10" | FN-M04-5.2.8 |
| EL-M04-S11-082 | text | visible-default (desktop-only) | "..." | FN-M04-5.2.8 |
| EL-M04-S11-083 | pagination | visible-default (desktop-only) | "307", → /admin/soalan-gambar?mcq_page=307, aria "Go to page 307" | FN-M04-5.2.8 |
| EL-M04-S11-084 | pagination | visible-default (desktop-only) | "308", → /admin/soalan-gambar?mcq_page=308, aria "Go to page 308" | FN-M04-5.2.8 |
| EL-M04-S11-085 | pagination | visible-default (desktop-only) | → /admin/soalan-gambar?mcq_page=2, svg, aria "Next &raquo;" | FN-M04-5.2.8 |
| EL-M04-S11-086 | heading | visible-default | "Struktur (522)" | FN-M04-5.2.9 |
| EL-M04-S11-087 | text | conditional (mobile-only) | "« Previous" | FN-M04-5.2.9 |
| EL-M04-S11-088 | pagination | conditional (mobile-only) | "Next »", → /admin/soalan-gambar?str_page=2 | FN-M04-5.2.9 |
| EL-M04-S11-089 | text | visible-default (desktop-only) | "Showing to of results" | FN-M04-5.2.9 |
| EL-M04-S11-090 | text | visible-default (desktop-only) | "1" | FN-M04-5.2.9 |
| EL-M04-S11-091 | text | visible-default (desktop-only) | "20" | FN-M04-5.2.9 |
| EL-M04-S11-092 | text | visible-default (desktop-only) | "522" | FN-M04-5.2.9 |
| EL-M04-S11-093 | text | visible-default (desktop-only) | "1" | FN-M04-5.2.9 |
| EL-M04-S11-094 | pagination | visible-default (desktop-only) | "2", → /admin/soalan-gambar?str_page=2, aria "Go to page 2" | FN-M04-5.2.9 |
| EL-M04-S11-095 | pagination | visible-default (desktop-only) | "3", → /admin/soalan-gambar?str_page=3, aria "Go to page 3" | FN-M04-5.2.9 |
| EL-M04-S11-096 | pagination | visible-default (desktop-only) | "4", → /admin/soalan-gambar?str_page=4, aria "Go to page 4" | FN-M04-5.2.9 |
| EL-M04-S11-097 | pagination | visible-default (desktop-only) | "5", → /admin/soalan-gambar?str_page=5, aria "Go to page 5" | FN-M04-5.2.9 |
| EL-M04-S11-098 | pagination | visible-default (desktop-only) | "6", → /admin/soalan-gambar?str_page=6, aria "Go to page 6" | FN-M04-5.2.9 |
| EL-M04-S11-099 | pagination | visible-default (desktop-only) | "7", → /admin/soalan-gambar?str_page=7, aria "Go to page 7" | FN-M04-5.2.9 |
| EL-M04-S11-100 | pagination | visible-default (desktop-only) | "8", → /admin/soalan-gambar?str_page=8, aria "Go to page 8" | FN-M04-5.2.9 |
| EL-M04-S11-101 | pagination | visible-default (desktop-only) | "9", → /admin/soalan-gambar?str_page=9, aria "Go to page 9" | FN-M04-5.2.9 |
| EL-M04-S11-102 | pagination | visible-default (desktop-only) | "10", → /admin/soalan-gambar?str_page=10, aria "Go to page 10" | FN-M04-5.2.9 |
| EL-M04-S11-103 | text | visible-default (desktop-only) | "..." | FN-M04-5.2.9 |
| EL-M04-S11-104 | pagination | visible-default (desktop-only) | "26", → /admin/soalan-gambar?str_page=26, aria "Go to page 26" | FN-M04-5.2.9 |
| EL-M04-S11-105 | pagination | visible-default (desktop-only) | "27", → /admin/soalan-gambar?str_page=27, aria "Go to page 27" | FN-M04-5.2.9 |
| EL-M04-S11-106 | pagination | visible-default (desktop-only) | → /admin/soalan-gambar?str_page=2, svg, aria "Next &raquo;" | FN-M04-5.2.9 |
| EL-M04-S11-107 | text | conditional (state captured @1280 only) | "Semua soalan sudah lengkap dengan gambar rajah!" | FN-M04-5.2.10 |
| EL-M04-S11-108 | heading | conditional (state captured @1280 only) | "MCQ (5)" | FN-M04-5.2.4 |
| EL-M04-S11-109 | card | conditional (state captured @1280 only) | "Bahasa Arab" | FN-M04-5.2.5 |
| EL-M04-S11-110 | text | conditional (state captured @1280 only) | "Bahasa Arab" | FN-M04-5.2.5 |
| EL-M04-S11-111 | text | conditional (state captured @1280 only) | "Merujuk latihan pembelajaran Unit 1, pilih ejaan Arab yang betul bagi “poster-poster”." | FN-M04-5.2.5 |
| EL-M04-S11-112 | text | conditional (state captured @1280 only) | "Bahasa Arab Tingkatan 3.pdf ms.2", fa-file-pdf | FN-M04-5.2.5 |
| EL-M04-S11-113 | card | conditional (state captured @1280 only) | "Bahasa Arab" | FN-M04-5.2.5 |
| EL-M04-S11-114 | text | conditional (state captured @1280 only) | "Bahasa Arab" | FN-M04-5.2.5 |
| EL-M04-S11-115 | text | conditional (state captured @1280 only) | "Berdasarkan kosa kata Unit 1, pilih ejaan Arab yang betul bagi “poster-poster”." | FN-M04-5.2.5 |
| EL-M04-S11-116 | text | conditional (state captured @1280 only) | "Bahasa Arab Tingkatan 3.pdf ms.2", fa-file-pdf | FN-M04-5.2.5 |
| EL-M04-S11-117 | card | conditional (state captured @1280 only) | "Bahasa Arab" | FN-M04-5.2.5 |
| EL-M04-S11-118 | text | conditional (state captured @1280 only) | "Bahasa Arab" | FN-M04-5.2.5 |
| EL-M04-S11-119 | text | conditional (state captured @1280 only) | "Berdasarkan kosa kata Unit 1, dalam aktiviti lisan, murid hendak menyatakan “poster-poster" | FN-M04-5.2.5 |
| EL-M04-S11-120 | text | conditional (state captured @1280 only) | "Bahasa Arab Tingkatan 3.pdf ms.2", fa-file-pdf | FN-M04-5.2.5 |
| EL-M04-S11-121 | text | conditional (state captured @1280 only) | "Seorang remaja perempuan berumur 14 tahun mempunyai BMI 16.5 kg/m². Apakah tafsiran yang b" | FN-M04-5.2.5 |
| EL-M04-S11-122 | text | conditional (state captured @1280 only) | "T4-BT-SN---SAINS.pdf ms.1", fa-file-pdf | FN-M04-5.2.5 |
| EL-M04-S11-123 | card | conditional (state captured @1280 only) | "Sains" | FN-M04-5.2.5 |
| EL-M04-S11-124 | text | conditional (state captured @1280 only) | "Sains" | FN-M04-5.2.5 |
| EL-M04-S11-125 | text | conditional (state captured @1280 only) | "Seorang murid lelaki berumur 15 tahun mempunyai BMI 17.2 kg/m². Apakah interpretasi yang b" | FN-M04-5.2.5 |
| EL-M04-S11-126 | text | conditional (state captured @1280 only) | "T4-BT-SN---SAINS.pdf ms.1", fa-file-pdf | FN-M04-5.2.5 |
| EL-M04-S11-127 | card | conditional (state captured @1280 only) | "Matematik" | FN-M04-5.2.5 |
| EL-M04-S11-128 | text | conditional (state captured @1280 only) | "Matematik" | FN-M04-5.2.5 |
| EL-M04-S11-129 | text | conditional (state captured @1280 only) | "Graf jarak-masa menunjukkan perjalanan seorang pejalan kaki yang bergerak 3 km dalam 20 mi" | FN-M04-5.2.5 |
| EL-M04-S11-130 | text | conditional (state captured @1280 only) | "T4-BT-MAT---MATEMATIK.pdf ms.1", fa-file-pdf | FN-M04-5.2.5 |
| EL-M04-S11-131 | pagination | hidden-only | "« Previous", → /admin/soalan-gambar?mcq_page=1 | FN-M04-5.2.8 |
| EL-M04-S11-132 | pagination | conditional (state captured @1280 only) | → /admin/soalan-gambar?str_page=2, svg, aria "Next &raquo;" | FN-M04-5.2.9 |
| EL-M04-S11-133 | card | conditional (state captured @1280 only) | "Fizik" | FN-M04-5.2.5 |
| EL-M04-S11-134 | text | conditional (state captured @1280 only) | "Fizik" | FN-M04-5.2.5 |
| EL-M04-S11-135 | text | conditional (state captured @1280 only) | "Rajah 28 menunjukkan seorang lelaki melangkah masuk ke sebuah pasar raya dan pintu terbuka" | FN-M04-5.2.5 |
| EL-M04-S11-136 | text | conditional (state captured @1280 only) | "SET 1-FIZIK K1 PAHANG(JUJ)-2025.pdf ms.29", fa-file-pdf | FN-M04-5.2.5 |
| EL-M04-S11-137 | card | conditional (state captured @1280 only) | "Fizik" | FN-M04-5.2.5 |
| EL-M04-S11-138 | text | conditional (state captured @1280 only) | "Fizik" | FN-M04-5.2.5 |
| EL-M04-S11-139 | text | conditional (state captured @1280 only) | "Jadual 2 menunjukkan maklumat berkaitan reputan satu bahan radioaktif dengan aktiviti awal" | FN-M04-5.2.5 |
| EL-M04-S11-140 | text | conditional (state captured @1280 only) | "SET 1-FIZIK K1 PAHANG(JUJ)-2025.pdf ms.28", fa-file-pdf | FN-M04-5.2.5 |
| EL-M04-S11-141 | card | conditional (state captured @1280 only) | "Fizik" | FN-M04-5.2.5 |
| EL-M04-S11-142 | text | conditional (state captured @1280 only) | "Fizik" | FN-M04-5.2.5 |
| EL-M04-S11-143 | text | conditional (state captured @1280 only) | "Rajah 27 menunjukkan sebuah litar yang mengandungi satu diod dan satu mentol. Apabila suis" | FN-M04-5.2.5 |
| EL-M04-S11-144 | text | conditional (state captured @1280 only) | "SET 1-FIZIK K1 PAHANG(JUJ)-2025.pdf ms.28", fa-file-pdf | FN-M04-5.2.5 |
| EL-M04-S11-145 | heading | conditional (state captured @1280 only) | "Struktur (6)" | FN-M04-5.2.9 |

#### S12 — `/admin/master-notes` (88 elements)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M04-S12-001 | text | hidden-only | "LIVE:", fa-circle | Excluded — User-portal tournament banner (`tournamentBanner()`, "LIVE:", "MAIN", "DAFTAR") rendered on every user-portal page → owned by M16 (Battle, Games & Competitions) |
| EL-M04-S12-002 | text | hidden-only | "MAIN" | Excluded — User-portal tournament banner (`tournamentBanner()`, "LIVE:", "MAIN", "DAFTAR") rendered on every user-portal page → owned by M16 (Battle, Games & Competitions) |
| EL-M04-S12-003 | text | hidden-only | "DAFTAR" | Excluded — User-portal tournament banner (`tournamentBanner()`, "LIVE:", "MAIN", "DAFTAR") rendered on every user-portal page → owned by M16 (Battle, Games & Competitions) |
| EL-M04-S12-004 | heading | visible-default | "Master Notes — Admin Review" | FN-M04-5.3.1 |
| EL-M04-S12-005 | text | visible-default | "Self-healing nota AI: 0 flagged · 0 teacher-approved · 525 total. Review yang flagged untu" | FN-M04-5.3.1 |
| EL-M04-S12-006 | filter | visible-default | "Flagged Review", → /admin/master-notes?tab=flagged | FN-M04-5.3.2 |
| EL-M04-S12-007 | filter | visible-default | "Teacher Approved", → /admin/master-notes?tab=approved | FN-M04-5.3.2 |
| EL-M04-S12-008 | filter | visible-default | "Semua", → /admin/master-notes?tab=all | FN-M04-5.3.2 |
| EL-M04-S12-009 | empty-state | visible-default (desktop-only) | "Tiada nota dalam tab ini." | FN-M04-5.3.3 |
| EL-M04-S12-010 | text | conditional (state captured @1280 only) | "122411 · Fizik · Fizik Tingkatan 5 · gpt-4o-mini · 730 ·" | FN-M04-5.3.4 |
| EL-M04-S12-011 | text | conditional | "question_id:" | FN-M04-5.3.4 |
| EL-M04-S12-012 | text | conditional | "subject:" | FN-M04-5.3.4 |
| EL-M04-S12-013 | text | conditional | "chapter:" | FN-M04-5.3.4 |
| EL-M04-S12-014 | text | conditional | "model:" | FN-M04-5.3.4 |
| EL-M04-S12-015 | text | conditional | "tokens:" | FN-M04-5.3.4 |
| EL-M04-S12-016 | badge | conditional | "conf 85" | FN-M04-5.3.4 |
| EL-M04-S12-017 | text | conditional (state captured @1280 only) | "Apakah yang berlaku dalam litar apabila berlaku litar pintas (short circuit)?" | FN-M04-5.3.5 |
| EL-M04-S12-018 | text | conditional | "Soalan:" | FN-M04-5.3.5 |
| EL-M04-S12-019 | text | conditional (state captured @1280 only) | "Mungkin anda keliru sebab anda fikir litar berfungsi seperti biasa tetapi sebenarnya litar" | FN-M04-5.3.5 |
| EL-M04-S12-020 | text | conditional (state captured @1280 only) | "Salah faham tentang arus dalam litar pintas." | FN-M04-5.3.5 |
| EL-M04-S12-021 | text | conditional | "Trap:" | FN-M04-5.3.5 |
| EL-M04-S12-022 | button | conditional | "Approve" | FN-M04-5.3.6 |
| EL-M04-S12-023 | button | conditional | "Regenerate" | FN-M04-5.3.6 |
| EL-M04-S12-024 | button | conditional | "Clear Flag" | FN-M04-5.3.6 |
| EL-M04-S12-025 | text | conditional (state captured @1280 only) | "560001 · Matematik · Fungsi dan Persamaan Kuadratik · gpt-4o-mini · 812 ·" | FN-M04-5.3.4 |
| EL-M04-S12-026 | text | conditional | "question_id:" | FN-M04-5.3.4 |
| EL-M04-S12-027 | text | conditional | "subject:" | FN-M04-5.3.4 |
| EL-M04-S12-028 | text | conditional | "chapter:" | FN-M04-5.3.4 |
| EL-M04-S12-029 | text | conditional | "model:" | FN-M04-5.3.4 |
| EL-M04-S12-030 | text | conditional | "tokens:" | FN-M04-5.3.4 |
| EL-M04-S12-031 | badge | conditional | "conf 85" | FN-M04-5.3.4 |
| EL-M04-S12-032 | text | conditional (state captured @1280 only) | "Fungsi kuadratik f(x) = x² - 6x + 5 diubah kepada f(x) = x² - 6x + 9. Apakah perubahan yan" | FN-M04-5.3.5 |
| EL-M04-S12-033 | text | conditional | "Soalan:" | FN-M04-5.3.5 |
| EL-M04-S12-034 | text | conditional (state captured @1280 only) | "Mungkin anda keliru sebab perubahan dalam fungsi kuadratik hanya melibatkan perpindahan se" | FN-M04-5.3.5 |
| EL-M04-S12-035 | text | conditional (state captured @1280 only) | "Salah faham tentang perpindahan graf kuadratik yang melibatkan nilai pemalar." | FN-M04-5.3.5 |
| EL-M04-S12-036 | text | conditional | "Trap:" | FN-M04-5.3.5 |
| EL-M04-S12-037 | button | conditional | "Approve" | FN-M04-5.3.6 |
| EL-M04-S12-038 | button | conditional | "Regenerate" | FN-M04-5.3.6 |
| EL-M04-S12-039 | button | conditional | "Clear Flag" | FN-M04-5.3.6 |
| EL-M04-S12-040 | text | conditional (state captured @1280 only) | "559916 · Matematik · Kebarangkalian Peristiwa Bergabung · gpt-4o-mini · 790 ·" | FN-M04-5.3.4 |
| EL-M04-S12-041 | text | conditional | "question_id:" | FN-M04-5.3.4 |
| EL-M04-S12-042 | text | conditional | "subject:" | FN-M04-5.3.4 |
| EL-M04-S12-043 | text | conditional | "chapter:" | FN-M04-5.3.4 |
| EL-M04-S12-044 | text | conditional | "model:" | FN-M04-5.3.4 |
| EL-M04-S12-045 | text | conditional | "tokens:" | FN-M04-5.3.4 |
| EL-M04-S12-046 | badge | conditional | "conf 85" | FN-M04-5.3.4 |
| EL-M04-S12-047 | text | conditional (state captured @1280 only) | "Adakah peristiwa berikut saling eksklusif atau tidak saling eksklusif: memilih murid yang " | FN-M04-5.3.5 |
| EL-M04-S12-048 | text | conditional | "Soalan:" | FN-M04-5.3.5 |
| EL-M04-S12-049 | text | conditional (state captured @1280 only) | "Mungkin anda keliru sebab anda berfikir bahawa peristiwa saling eksklusif bermakna tidak b" | FN-M04-5.3.5 |
| EL-M04-S12-050 | text | conditional (state captured @1280 only) | "Salah faham tentang definisi peristiwa saling eksklusif." | FN-M04-5.3.5 |
| EL-M04-S12-051 | text | conditional | "Trap:" | FN-M04-5.3.5 |
| EL-M04-S12-052 | button | conditional | "Approve" | FN-M04-5.3.6 |
| EL-M04-S12-053 | button | conditional | "Regenerate" | FN-M04-5.3.6 |
| EL-M04-S12-054 | button | conditional | "Clear Flag" | FN-M04-5.3.6 |
| EL-M04-S12-055 | pagination | hidden-only | "« Previous", → /admin/master-notes?tab=all&page=1 | FN-M04-5.3.7 |
| EL-M04-S12-056 | pagination | conditional (mobile-only) | "Next »", → /admin/master-notes?tab=all&page=2 | FN-M04-5.3.7 |
| EL-M04-S12-057 | text | conditional (state captured @1280 only) | "Showing to of results" | FN-M04-5.3.7 |
| EL-M04-S12-058 | text | conditional (state captured @1280 only) | "16" | FN-M04-5.3.7 |
| EL-M04-S12-059 | text | conditional (state captured @1280 only) | "30" | FN-M04-5.3.7 |
| EL-M04-S12-060 | text | conditional (state captured @1280 only) | "525" | FN-M04-5.3.7 |
| EL-M04-S12-061 | pagination | conditional (state captured @1280 only) | → /admin/master-notes?tab=all&page=1, svg, aria "&laquo; Previous" | FN-M04-5.3.7 |
| EL-M04-S12-062 | pagination | conditional (state captured @1280 only) | "1", → /admin/master-notes?tab=all&page=1, aria "Go to page 1" | FN-M04-5.3.7 |
| EL-M04-S12-063 | text | conditional (state captured @1280 only) | "2" | FN-M04-5.3.7 |
| EL-M04-S12-064 | pagination | conditional (state captured @1280 only) | "3", → /admin/master-notes?tab=all&page=3, aria "Go to page 3" | FN-M04-5.3.7 |
| EL-M04-S12-065 | pagination | conditional (state captured @1280 only) | "4", → /admin/master-notes?tab=all&page=4, aria "Go to page 4" | FN-M04-5.3.7 |
| EL-M04-S12-066 | pagination | conditional (state captured @1280 only) | "5", → /admin/master-notes?tab=all&page=5, aria "Go to page 5" | FN-M04-5.3.7 |
| EL-M04-S12-067 | pagination | conditional (state captured @1280 only) | "6", → /admin/master-notes?tab=all&page=6, aria "Go to page 6" | FN-M04-5.3.7 |
| EL-M04-S12-068 | pagination | conditional (state captured @1280 only) | "7", → /admin/master-notes?tab=all&page=7, aria "Go to page 7" | FN-M04-5.3.7 |
| EL-M04-S12-069 | pagination | conditional (state captured @1280 only) | "8", → /admin/master-notes?tab=all&page=8, aria "Go to page 8" | FN-M04-5.3.7 |
| EL-M04-S12-070 | pagination | conditional (state captured @1280 only) | "9", → /admin/master-notes?tab=all&page=9, aria "Go to page 9" | FN-M04-5.3.7 |
| EL-M04-S12-071 | pagination | conditional (state captured @1280 only) | "10", → /admin/master-notes?tab=all&page=10, aria "Go to page 10" | FN-M04-5.3.7 |
| EL-M04-S12-072 | text | conditional (state captured @1280 only) | "..." | FN-M04-5.3.7 |
| EL-M04-S12-073 | pagination | conditional (state captured @1280 only) | "34", → /admin/master-notes?tab=all&page=34, aria "Go to page 34" | FN-M04-5.3.7 |
| EL-M04-S12-074 | pagination | conditional (state captured @1280 only) | "35", → /admin/master-notes?tab=all&page=35, aria "Go to page 35" | FN-M04-5.3.7 |
| EL-M04-S12-075 | pagination | conditional (state captured @1280 only) | → /admin/master-notes?tab=all&page=3, svg, aria "Next &raquo;" | FN-M04-5.3.7 |
| EL-M04-S12-076 | text | conditional | "129732 · Bahasa Inggeris · — · gpt-4o-mini · 1313 ·" | FN-M04-5.3.4 |
| EL-M04-S12-077 | text | conditional | "Refer to the texts. How Technology Helps Build Self-Confidence A - Jordan, Gamer and Strea" | FN-M04-5.3.5 |
| EL-M04-S12-078 | text | conditional | "Mungkin anda keliru sebab anda berfikir bahawa semua teks tentang teknologi dan keyakinan " | FN-M04-5.3.5 |
| EL-M04-S12-079 | text | conditional | "Salah faham tentang fokus setiap teks yang berkaitan dengan teknologi dan keyakinan diri." | FN-M04-5.3.5 |
| EL-M04-S12-080 | text | conditional | "129650 · Bahasa Inggeris · — · gpt-4o-mini · 1194 ·" | FN-M04-5.3.4 |
| EL-M04-S12-081 | text | conditional | "Refer to the passage. For the first time in my life, I felt like I wanted to escape my own" | FN-M04-5.3.5 |
| EL-M04-S12-082 | text | conditional | "Mungkin anda keliru sebab anda mungkin berfikir bahawa perasaan marah dan kekeliruan adala" | FN-M04-5.3.5 |
| EL-M04-S12-083 | text | conditional | "Salah faham tentang emosi yang dirasai dalam situasi yang sukar." | FN-M04-5.3.5 |
| EL-M04-S12-084 | text | conditional | "129614 · Bahasa Inggeris · — · gpt-4o-mini · 1359 ·" | FN-M04-5.3.4 |
| EL-M04-S12-085 | text | conditional | "Refer to the passage. Fast fashion refers to the rapid production of inexpensive clothing " | FN-M04-5.3.5 |
| EL-M04-S12-086 | text | conditional | "Mungkin anda keliru sebab anda berfikir bahawa kain semula jadi seperti kapas tidak member" | FN-M04-5.3.5 |
| EL-M04-S12-087 | text | conditional | "Salah faham tentang kelebihan kain semula jadi berbanding kain sintetik." | FN-M04-5.3.5 |
| EL-M04-S12-088 | text | conditional (mobile-only) | "« Previous" | FN-M04-5.3.7 |

#### S13 — `/laporan-soalan` (18 elements)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M04-S13-001 | text | hidden-only | "LIVE:", fa-circle | Excluded — Same tournament banner on `/laporan-soalan` → owned by M16 |
| EL-M04-S13-002 | text | hidden-only | "MAIN" | Excluded — Same tournament banner on `/laporan-soalan` → owned by M16 |
| EL-M04-S13-003 | text | hidden-only | "DAFTAR" | Excluded — Same tournament banner on `/laporan-soalan` → owned by M16 |
| EL-M04-S13-004 | card | visible-default | "Jumlah" | FN-M04-3.3.1 |
| EL-M04-S13-005 | text | visible-default | "0" | FN-M04-3.3.1 |
| EL-M04-S13-006 | text | visible-default | "Jumlah" | FN-M04-3.3.1 |
| EL-M04-S13-007 | text | visible-default | "0" | FN-M04-3.3.1 |
| EL-M04-S13-008 | text | visible-default | "Menunggu" | FN-M04-3.3.1 |
| EL-M04-S13-009 | text | visible-default | "0" | FN-M04-3.3.1 |
| EL-M04-S13-010 | text | visible-default | "Disemak" | FN-M04-3.3.1 |
| EL-M04-S13-011 | text | visible-default | "0" | FN-M04-3.3.1 |
| EL-M04-S13-012 | text | visible-default | "Diperbaiki" | FN-M04-3.3.1 |
| EL-M04-S13-013 | text | visible-default | "0" | FN-M04-3.3.1 |
| EL-M04-S13-014 | text | visible-default | "Ditolak" | FN-M04-3.3.1 |
| EL-M04-S13-015 | card | visible-default | "Tiada Laporan" | FN-M04-3.3.2 |
| EL-M04-S13-016 | text | visible-default | "📋" | FN-M04-3.3.2 |
| EL-M04-S13-017 | heading | visible-default | "Tiada Laporan" | FN-M04-3.3.2 |
| EL-M04-S13-018 | text | visible-default | "Anda belum menghantar sebarang laporan soalan." | FN-M04-3.3.2 |

#### S14 — `(modal on M05 practice pages: /latihan-berstruktur/{id}/jawab, /spm/latih-tubi/{code}/quiz)` (40 elements)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M04-S14-001 | heading | visible-default | "Host trigger (mcq)" | Excluded — Headings "Host trigger (mcq)" / "Host trigger (structured)" inserted by the discovery harness to label the injected triggers; not live UI |
| EL-M04-S14-002 | button | visible-default | "Lapor Soalan", fa-flag | FN-M04-3.1.1 |
| EL-M04-S14-003 | clickable | visible-default | (div) | FN-M04-3.1.3 |
| EL-M04-S14-004 | card | visible-default | "Lapor Soalan" | FN-M04-3.1.3 |
| EL-M04-S14-005 | heading | visible-default | "Lapor Soalan" | FN-M04-3.1.3 |
| EL-M04-S14-006 | text | visible-default | "Soalan ini akan dinyahaktifkan sementara" | FN-M04-3.1.3 |
| EL-M04-S14-007 | button | visible-default | fa-times | FN-M04-3.1.3 |
| EL-M04-S14-008 | heading | visible-default | "Terima Kasih!" | FN-M04-3.1.8 |
| EL-M04-S14-009 | button | visible-default | "Tutup" | FN-M04-3.1.8 |
| EL-M04-S14-010 | label | visible-default | "Sebab Laporan *" | FN-M04-3.1.4 |
| EL-M04-S14-011 | label | visible-default | "Jawapan tidak tepat Jawapan yang ditandakan betul sebenarnya salah" | FN-M04-3.1.4 |
| EL-M04-S14-012 | checkbox | visible-default | checkbox, value wrong_answer | FN-M04-3.1.4 |
| EL-M04-S14-013 | label | visible-default | "Soalan mengelirukan Ayat soalan tidak jelas atau mengelirukan" | FN-M04-3.1.4 |
| EL-M04-S14-014 | checkbox | visible-default | checkbox, value confusing_question | FN-M04-3.1.4 |
| EL-M04-S14-015 | label | visible-default | "Set jawapan tidak tepat Pilihan jawapan yang diberikan tidak betul" | FN-M04-3.1.4 |
| EL-M04-S14-016 | checkbox | visible-default | checkbox, value wrong_options | FN-M04-3.1.4 |
| EL-M04-S14-017 | label | visible-default | "Pilihan jawapan tidak lengkap Soalan tiada cukup pilihan jawapan" | FN-M04-3.1.4 |
| EL-M04-S14-018 | checkbox | visible-default | checkbox, value missing_options | FN-M04-3.1.4 |
| EL-M04-S14-019 | label | visible-default | "Soalan berulang / pendua Soalan yang sama muncul lebih dari sekali" | FN-M04-3.1.4 |
| EL-M04-S14-020 | checkbox | visible-default | checkbox, value duplicate | FN-M04-3.1.4 |
| EL-M04-S14-021 | label | visible-default | "Kesalahan ejaan / taip Ada kesilapan ejaan dalam soalan atau jawapan" | FN-M04-3.1.4 |
| EL-M04-S14-022 | checkbox | visible-default | checkbox, value typo | FN-M04-3.1.4 |
| EL-M04-S14-023 | label | visible-default | "Lain-lain Sebab lain yang tidak disenaraikan" | FN-M04-3.1.4 |
| EL-M04-S14-024 | checkbox | visible-default | checkbox, value other | FN-M04-3.1.4 |
| EL-M04-S14-025 | label | visible-default | "Komen Tambahan (pilihan)" | FN-M04-3.1.6 |
| EL-M04-S14-026 | textarea | visible-default | ph "Terangkan masalah soalan ini..." | FN-M04-3.1.6 |
| EL-M04-S14-027 | text | visible-default | "/500" | FN-M04-3.1.6 |
| EL-M04-S14-028 | button | visible-default | "Batal" | FN-M04-3.1.7 |
| EL-M04-S14-029 | button | visible-default | "Hantar Laporan Menghantar...", fa-paper-plane | FN-M04-3.1.7 |
| EL-M04-S14-030 | heading | conditional (state captured @1280 only) | "Host trigger (structured)" | Excluded — Headings "Host trigger (mcq)" / "Host trigger (structured)" inserted by the discovery harness to label the injected triggers; not live UI |
| EL-M04-S14-031 | button | conditional (state captured @1280 only) | "Lapor", button, fa-flag, title "Lapor soalan ini" | FN-M04-3.1.2 |
| EL-M04-S14-032 | text | conditional (state captured @1280 only) | "Soalan ini akan dinyahaktifkan selepas 3 laporan" | FN-M04-3.1.3 |
| EL-M04-S14-033 | label | conditional (state captured @1280 only) | "Skema jawapan tidak tepat Keyword/rubrik yang ditandakan tidak sepadan dengan jawapan sebe" | FN-M04-3.1.5 |
| EL-M04-S14-034 | checkbox | conditional (state captured @1280 only) | checkbox, value wrong_answer | FN-M04-3.1.5 |
| EL-M04-S14-035 | label | conditional (state captured @1280 only) | "Soalan mengelirukan Ayat soalan atau arahan tidak jelas" | FN-M04-3.1.5 |
| EL-M04-S14-036 | checkbox | conditional (state captured @1280 only) | checkbox, value confusing_question | FN-M04-3.1.5 |
| EL-M04-S14-037 | label | conditional (state captured @1280 only) | "Markah tidak adil Pembahagian markah atau pemarkahan auto tidak tepat" | FN-M04-3.1.5 |
| EL-M04-S14-038 | checkbox | conditional (state captured @1280 only) | checkbox, value wrong_options | FN-M04-3.1.5 |
| EL-M04-S14-039 | label | conditional (state captured @1280 only) | "Kesalahan ejaan / taip Ada kesilapan ejaan dalam soalan atau skema" | FN-M04-3.1.5 |
| EL-M04-S14-040 | checkbox | conditional (state captured @1280 only) | checkbox, value typo | FN-M04-3.1.5 |

### 6.2 Shell elements (M04-relevant only)

#### SHA — admin panel shell (chrome of S1–S11) — 232 elements, 24 M04-relevant

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M04-SHA-028 | toggle | visible-default (desktop-only) | "Soalan", fa-question-circle | FN-M04-6.1.1 |
| EL-M04-SHA-029 | link | visible-default (desktop-only) | "Senarai Soalan", → /admin/questions, fa-list | FN-M04-6.1.1 |
| EL-M04-SHA-030 | link | visible-default (desktop-only) | "Import CSV", → /admin/questions/import, fa-file-csv | FN-M04-6.1.1 |
| EL-M04-SHA-031 | link | visible-default (desktop-only) | "Kualiti Soalan", → /admin/questions/quality, fa-clipboard-check | FN-M04-6.1.1 |
| EL-M04-SHA-032 | link | visible-default (desktop-only) | "Laporan Soalan", → /admin/question-reports, fa-flag | FN-M04-6.1.1 |
| EL-M04-SHA-033 | link | visible-default (desktop-only) | "Soalan Berstruktur", → /admin/structured-questions, fa-list-ol | FN-M04-6.1.1 |
| EL-M04-SHA-034 | link | visible-default (desktop-only) | "Kertas Soalan Guru", → /admin/question-submissions, fa-file-upload | FN-M04-6.1.1 |
| EL-M04-SHA-118 | heading | visible-default | "Dashboard" | FN-M04-6.1.4 |
| EL-M04-SHA-119 | text | visible-default | "Selamat datang, Admin" | FN-M04-6.1.4 |
| EL-M04-SHA-137 | link | conditional (mobile-only) | "Soalan", → /admin/questions, fa-question-circle | FN-M04-6.1.2 |
| EL-M04-SHA-151 | text | hidden-only | "Soalan" | FN-M04-6.1.3 |
| EL-M04-SHA-152 | link | hidden-only | "Import CSV", → /admin/questions/import, fa-file-csv | FN-M04-6.1.3 |
| EL-M04-SHA-153 | link | hidden-only | "Kualiti Soalan", → /admin/questions/quality, fa-clipboard-check | FN-M04-6.1.3 |
| EL-M04-SHA-154 | link | hidden-only | "Laporan Soalan", → /admin/question-reports, fa-flag | FN-M04-6.1.3 |
| EL-M04-SHA-155 | link | hidden-only | "Soalan Berstruktur", → /admin/structured-questions, fa-list-ol | FN-M04-6.1.3 |
| EL-M04-SHA-156 | link | hidden-only | "Kertas Soalan Guru", → /admin/question-submissions, fa-file-upload | FN-M04-6.1.3 |
| EL-M04-SHA-210 | heading | conditional | "Import Soalan Secara Pukal" | FN-M04-2.1.1 |
| EL-M04-SHA-211 | text | conditional | "Muat naik fail CSV untuk menambah soalan secara pukal" | FN-M04-2.1.1 |
| EL-M04-SHA-216 | heading | conditional | "Dashboard Kualiti Soalan" | FN-M04-2.2.1 |
| EL-M04-SHA-217 | text | conditional | "Analisa kualiti keseluruhan bank soalan" | FN-M04-2.2.1 |
| EL-M04-SHA-225 | heading | conditional | "Kertas Soalan Guru" | FN-M04-5.1.1 |
| EL-M04-SHA-226 | text | conditional | "Semak dan proses fail soalan yang dihantar oleh guru" | FN-M04-5.1.1 |
| EL-M04-SHA-227 | heading | conditional | "Soalan Perlu Gambar Rajah" | FN-M04-5.2.1 |
| EL-M04-SHA-228 | text | conditional | "Audit soalan yang memerlukan gambar rajah dilengkapkan" | FN-M04-5.2.1 |

Excluded SHA elements (prefix EL-M04-SHA-):
- 198 elements — IDs 001–027, 035–038, 040, 042–045, 047–050, 053–117, 120–136, 138–146, 148–150, 157–161, 164–191, 194–209, 212–215, 218–224, 229–232: **global shell (docs/discovery/00-global-ui.md) / M23 and the module each link targets (classified per URL in `_crawl.json`)**.
- 4 elements — IDs 039, 041, 192–193: **M02 (Users & Schools)**.
- 2 elements — IDs 046, 147: **M06 (SPM: "Databank Soalan")**.
- 4 elements — IDs 051–052, 162–163: **M07 (Premium PKSK)**.

#### SHU — user-portal shell (chrome of S12–S14) — 374 elements, 13 M04-relevant

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M04-SHU-040 | text | visible-default (desktop-only) | "🛡️ Kawalan Kualiti" | FN-M04-6.2.1 |
| EL-M04-SHU-041 | link | visible-default (desktop-only) | "Semakan Nota Master", → /admin/master-notes, fa-shield-alt | FN-M04-6.2.1 |
| EL-M04-SHU-058 | link | visible-default (desktop-only) | "Laporan Soalan", → /laporan-soalan, fa-flag | FN-M04-6.2.2 |
| EL-M04-SHU-118 | link | visible-default (desktop-only) | "Kertas Soalan Guru", → /admin/question-submissions, fa-file-upload | FN-M04-6.2.3 |
| EL-M04-SHU-126 | link | visible-default (desktop-only) | "Gambar Rajah 6,144", → /admin/soalan-gambar, fa-images | FN-M04-6.2.4 |
| EL-M04-SHU-127 | badge | visible-default (desktop-only) | "6,144" | FN-M04-6.2.4 |
| EL-M04-SHU-136 | heading | visible-default | "Dashboard" | FN-M04-6.2.5 |
| EL-M04-SHU-137 | text | visible-default | "Selamat datang kembali" | FN-M04-6.2.5 |
| EL-M04-SHU-188 | link | hidden-only | "Laporan Soalan", → /laporan-soalan, fa-flag | FN-M04-6.2.2 |
| EL-M04-SHU-243 | text | hidden-only | "🛡️ Kawalan Kualiti" | FN-M04-6.2.1 |
| EL-M04-SHU-244 | link | hidden-only | "Semakan Nota Master", → /admin/master-notes, fa-shield-alt | FN-M04-6.2.1 |
| EL-M04-SHU-373 | heading | conditional | "Laporan Soalan Saya" | FN-M04-3.3.1 |
| EL-M04-SHU-374 | text | conditional | "Jejak status laporan soalan yang anda hantar" | FN-M04-3.3.1 |

Excluded SHU elements (prefix EL-M04-SHU-):
- 361 elements — IDs 001–039, 042–057, 059–117, 119–125, 128–135, 138–187, 189–242, 245–372: **global shell (docs/discovery/00-global-ui.md) / M23 and the module each link targets (classified per URL in `_crawl.json`)**.


---

## 7. Fidelity deviations

These are the **only** intended differences from the live site. Anything not listed must match live (D7, D9, D10). Rule D9 (user, standing, pre-approved): where live is broken or contradictory, fix it; where it works, replicate it exactly. D10: accessibility replicates live; deliberate, consistent limits are not broken; adding options to a working feature is new scope. Each row was checked against the discovery and audit evidence. Rows with status "Rejected — replicate live" were candidates that turned out to work; they are recorded so the audit can see the decision.

| ID | Category | Live behaviour (evidence) | Rebuild behaviour (specified) | Status |
|---|---|---|---|---|
| DV-M04-01 | Dead link | "Sejarah Import" → `/admin/questions/import-history` returns HTTP 500 "Ralat Pelayan" with only "Halaman Utama" and "Cuba Semula" (discovery D-1; state `history-500`; `import-history-500.png`; re-checked in the audit). | Smallest working page: a read-only table of past import runs built from the import job data the import already produces (FR-M04-56), in the admin shell. Header and h1 "Sejarah Import"; link "Kembali" → import page; columns "Tarikh", "Fail", "Diimport", "Gagal", newest first; empty text "Tiada sejarah import.". No other actions, filters or detail views. All these strings are **PROPOSED COPY** (no live original). | Approved (user rule D9); scope and copy for owner confirmation at G1 |
| DV-M04-02 | Wrong titles / missing active state | Shell header shows the fallback "Dashboard" / "Selamat datang, Admin" on S1, S2, S3, S4, S7, S8, S9, and "Dashboard" / "Selamat datang kembali" on S12; no sidebar item is active on S2–S4 (discovery D-2; SHA-118–119, SHU-136–137; audit DV check). | Implemented by the shell rule `docs/design/shells.md` DV-SH-03: the header title is derived from the route (the screen's own live tab/h1 title, URS §1 table) with **no subtitle**; S5h follows the same rule. S5, S6, S10, S11, S13, where live already shows a correct title and subtitle, are unchanged. On S2–S4 "Senarai Soalan" is the active sidebar item. | Approved (user rule D9) |
| DV-M04-03 | Candidate: navigation / layout | S11 is absent from the admin sidebar (reachable only from the user-portal sidebar "Gambar Rajah"); S12 renders in the user-portal layout with its own CSS (discovery D-2, §2.12). | **Replicated.** Both screens open and work; nothing is broken, only unusual. S11 keeps the admin shell with no sidebar item; S12 keeps the user-portal shell (header and h1 fixed by DV-M04-02 and DV-M04-14). | Rejected — replicate live (rule D9) |
| DV-M04-04 | Contradictory values | Totals disagree: S1 "Jumlah" 439,478, S1 pager 465,278, S6 "Jumlah Soalan" 466,041, M01/M03 128,989 / 130,152 / 129,389; per subject e.g. Pendidikan Seni Visual 48,360 (S1) vs 4,560 (S6) (discovery D-4). Reconciliation: 465,278 = 145,689 approved + 319,589 archived (status filters); 465,278 − Σ tiles 439,478 = 25,800 = the untiled Bahasa Tamil (whose 6,300 approved = 145,689 − Σ "lulus" 139,389 = the S6 BT figure); 466,041 − 465,278 = 763 = the PKSK rows. | One source (D11): the objective dataset reports **465,278** questions (PKSK excluded, XL-07) with the live breakdowns (SRS BR-M04-20, §6.11): S1 tiles and "lulus" as live, Bahasa Tamil 25,800 / 6,300, the status, compliance, source, DSKP, difficulty-1 and Darjah-1 filter sizes as observed; S6 "Jumlah Soalan" reads 465,278 (live 466,041 counted the 763 PKSK rows); the S6 score tables keep their live values (147,026 scored questions). Every count is computed from the dataset. Student-facing figures (M01 login stat 128,989, M03 "Soalan" columns, M05 cards and statistics) are the active subsets of the same dataset (SRS §4.1). | Approved (user rule D9) |
| DV-M04-05 | Contradictory / broken function | S4 is MCQ-only: no type select, options and correct answer hard-required, no T/F, short-answer or essay cards; create offers 5 types that edit cannot round-trip (discovery D-6). Non-MCQ questions do exist live: the M10 teacher databank shows 105 Bahasa Melayu "Subjektif" questions and 25 of other types (M10 S28), none of which S4 can edit. | S4 shows the saved type's answer card, pre-filled, with create's required rules (MCQ fields required only for MCQ). The type stays fixed (no "Jenis Soalan" select, as live). MCQ questions behave exactly as live. | Approved (user rule D9) |
| DV-M04-06 | Undiscoverable control | "Buang tag DSKP" renders only when `bidangId && !spId`. On a tagged question it is therefore unreachable until the admin clears SP by hand — and because of the preload defect (DV-M04-15) the SP is already blank-looking, so the admin cannot tell (discovery D-7; S4-022/091; audit AUD-M04-03). | "Buang tag DSKP" shows whenever a Bidang is selected (tagged or partly tagged) and resets all three selects. | Approved (user rule D9) |
| DV-M04-07 | Contradictory rule | "Format CSV" lists `subject_id` and `education_level_id` under "Kolum diperlukan:", while "Tetapan Lalai" says defaults are used "jika kolum berkaitan tiada dalam CSV" (discovery D-8). | Rule: the two columns are required **unless** the matching default is set. Copy: both lines keep their place under "Kolum diperlukan:" and gain the suffix " (atau guna Tetapan Lalai)" (**PROPOSED COPY**). A row with neither a value nor a default fails. | Approved (user rule D9) |
| DV-M04-08 | Raw codes shown as labels; contradictory labels | S1 compliance badge "PENDING_MAPPING" and source line "Source: MARKING_SCHEME" (raw codes); S7 reason pill shows the raw code "unclear"; the two structured reports show MCQ labels — report 4 (3703) "Set jawapan tidak tepat" and report 3 (2509) "Jawapan tidak tepat" — although the structured modal names those reasons "Markah tidak adil" and "Skema jawapan tidak tepat" (discovery D-5, D-9; S1-123, S7-110, S7-126, S7-136; audit AUD-M04-17). | Codes are shown with the underscore replaced by a space ("PENDING MAPPING", "MARKING SCHEME"; the English code is kept rather than the filter label "Skema"). Legacy raw reason "unclear" displays "Soalan mengelirukan". **One rule for reasons:** stored reasons are codes, and the pill uses the label set of the question's type — structured `wrong_answer` "Skema jawapan tidak tepat", `wrong_options` "Markah tidak adil", `confusing_question` "Soalan mengelirukan", `typo` "Kesalahan ejaan / taip", `other` "Lain-lain"; MCQ labels as the MCQ modal. Reports 4 and 3 therefore read "Markah tidak adil" and "Skema jawapan tidak tepat". | Approved (user rule D9) |
| DV-M04-09 | Responsive breakage; unreadable text | At 768px the Laravel pager on S1 and S8 overflows the viewport (right edge 827px / 786px) and is clipped; at 375px the S1 "Soalan" column is squeezed to about 82px, wrapping each question into 8–10 short lines (discovery D-3, §7; audit DV check). | At 640–1023px the pager fits the viewport (the page-link strip wraps onto a second line when needed). The S1 table keeps a minimum "Soalan" column width of 240px and scrolls inside its card below 1024px. | Approved (user rule D9) |
| DV-M04-10 | Candidate: risky actions | One-click, no-confirm actions: S7 "Nyahaktif Segera", "Tolak & Aktifkan Semula", "Tandakan Selesai"; S11 "Dismiss" and upload; S12 "Approve", "Regenerate", "Clear Flag"; S10 "Simpan"; S6 "Jalankan Audit Semula" (discovery D-11; audit confirmed). | **Replicated.** They work. Recorded for security review as SEC-M04-01. | Rejected — replicate live (rule D9) |
| DV-M04-11 | Contradictory display | S11 stat cards stay global (6,144 / 522 / 6,666) under any filter, while the section headings show the filtered counts (e.g. `subject_id=9` → "MCQ (718)" / "Struktur (6)") (discovery §2.11, D-12; audit AUD-M04-05). | Each stat card shows the count of its list under the active filters ("MCQ Perlu Gambar" = MCQ list, "Struktur Perlu Gambar" = Struktur list, "Jumlah" = their sum). **Replicated as live (not changed):** the top-10 subject pills stay global under both filters; the school filter applies to the MCQ list only (structured questions carry no visible school — their cards show only "oleh {creator}" and the stimulus — so this is a consistent limit, not a contradiction); the MCQ section is omitted when its count is 0, like the Struktur section; the 10,221-option school select. | Approved (user rule D9) — stat cards only |
| DV-M04-12 | Broken text | Empty structured list counter reads "Menunjukkan – daripada 0 soalan" (range missing) (discovery D-10; S8-068). | Reads "Menunjukkan 0 daripada 0 soalan" (**PROPOSED COPY**). | Approved (user rule D9) |
| DV-M04-13 | Contradictory / missing | S1 shows 29 tiles and omits Bahasa Cina (19) and Bahasa Tamil (20), although tiles 28–31 are shown with 0 questions (so the omission is not data-driven), both are filterable, and S6 lists 6,300 Bahasa Tamil questions (discovery D-13; audit DV check). | Tiles for Bahasa Cina and Bahasa Tamil (`fa-language`) appear in "Subjek Elektif" in id order, after Bahasa Arab. The tile name is the M03 subject name (not new copy). | Approved (user rule D9) |
| DV-M04-14 | Unreadable text | S12 h1 "Master Notes — Admin Review" is present in the DOM (S12-004) but invisible: its colour `rgb(30, 41, 59)` equals the `.adminhdr` card background `rgb(30, 41, 59)`; the subtitle is white (OBSERVED, audit AUD-M04-15; screenshots `master-notes-default.png`, `master-notes-all.png`, audit `s12-h1-invisible-1280.png`). | The h1 is shown in white on the dark card. | Approved (user rule D9) |
| DV-M04-15 | Broken display; silent data loss | On S4 the saved Bidang/SK/SP ids are loaded into the component and the three lists load, but the selects are bound before their options exist, so all three display their placeholders ("-- Pilih Bidang --", "-- Pilih SK --", "-- Pilih SP --") while "DSKP tagged" shows; the form posts `dskp_sp_id = ""`, so saving the edit form silently removes the tag (audit AUD-M04-03; screenshot `docs/qa/audit/img/M04/s4-dskp-preload-placeholders-1280.png`; discovery `question-edit-desktop.png`). | The edit form preloads and **shows** the saved Bidang, SK and SP as selected and posts the saved SP; saving without touching the DSKP block keeps the tag. | Approved (user rule D9) |
| DV-M04-16 | Broken navigation (filter lost) | S11 pager links drop every filter: they are `?mcq_page=2` / `?str_page=2` without `subject_id` or `school_id`, so page 2 of a filtered list shows the unfiltered list (audit AUD-M04-05: `?subject_id=9` → pager links `?mcq_page=2`). | Both S11 pagers keep `subject_id` and `school_id` in their links. Each pager still drops the other list's page parameter (the other list returns to page 1, as live). | Approved (user rule D9) |

| DV-M04-17 | Unreadable text | Small badge, pill and meta text on M04 screens (S1 compliance/"AI Verified"/DSKP badges and the "Source:" line, S7 badge row, S8 KBAT/subject pills, S10 level chip, S12 "conf" badge) is visibly tiny in the discovery screenshots; exact sizes were not captured (XL-22). | Wherever M04 content text renders below 12px on live, it is rendered at 12px; nothing else changes (same rule as M02 DV-01, M03 DV-06, M05 DV-11; master NFR-02). Sizes to be confirmed at re-audit. | Approved (user rule D9) |
| DV-M04-18 | Contradictory values | Prinsip Perakaunan: the admin S1 tile reads "6,052" / "2,329 lulus", while the student side (M03 "Soalan" 2,970; M05 subject card = approved and active 2,970) counts more approved-and-active questions than the admin counts approved — impossible on one dataset; every other subject satisfies admin "lulus" ≥ student count (SRS §4.1 check). | The dataset holds 2,970 approved Prinsip Perakaunan questions (all active): the tile reads "2,970 lulus" (total 6,052 unchanged), and the S1 status results become approved 146,330 / archived 318,948 (live 145,689 / 319,589; the 641 rows move from archived to approved). The student-side values, shared by M01, M03 and M05, stay as observed. | Approved (user rule D9) |
| DV-M04-21 | Broken function (rebuild only) | Not a live difference; http mode only. The question detail status actions (and the list bulk bar) send the question ids to `POST /api/questions/bulk-action` as numbers, while the API wants `ids: string[]`, so the call is refused with 422 and the action never runs. | The bulk-action client sends each id as a string in http mode (`wireId`); mock mode keeps the numbers the mock expects. No visible change. | Proposed (user rule D9; to be confirmed at G4) |
| DV-M04-22 | Broken function (rebuild only) | Not a live difference; http mode only. On S1 with `?subject_id=` the subject breakdown never shows the "Dipilih" badge or `aria-current` on the chosen subject: the id read from the URL (a number) is compared with the string subject ids the API sends using strict equality, so nothing matches. | The two ids are compared as strings; mock mode behaves as before. No other change. | Proposed (user rule D9; to be confirmed at G4) |

**Explicitly not deviations** (replicated as live):
- English Laravel pager and English UI words ("Showing … results", "Published", "Visibiliti: Public", "Dismiss", "Download Template", compliance/source filter labels, "Pending"/"Processing", the Master Notes page copy), and the browser's own English texts (native required bubble "Please select an item in the list.", the AI card's parser/network error texts). Mixed-language wording is consistent per screen, not broken.
- Archived shown as "Arkib" (S1 pill) but "Diarkibkan" (filter, S3): both correct BM for the same state (discovery D-5; M02 precedent).
- The S1 bulk action with no action chosen is stopped by the native required bubble; the script's own alert text is dead code and is not reproduced as a visible message (AUD-M04-01).
- Clearing Subjek or Tahap on S2 empties only the Bidang list; SK/SP keep their values and the old SP is still posted (AUD-M04-02). It works as coded and resets fully when both are set again, so it is replicated.
- The S1 "Subjek" cell uses one generic `fa-book` icon for every subject (AUD-M04-07).
- The MCQ create form has exactly 4 options with no add/remove; the CSV import is MCQ-only; KBAT exists only on structured questions and difficulty only on objective questions; there is no type filter, sort control, KBAT filter, tags or topic field on objective questions (D10: adding options is new scope).
- Structured questions are created/edited only in the teacher portal (S8 "Tambah Soalan", S9 "Edit Soalan" go to M10).
- Native `alert()`/`confirm()` dialogs and the confirmation policy (DV-M04-10).
- The S11 school select with every school; the S11 school filter applying to MCQ only; the global subject pills; each S11 list omitted at count 0 (DV-M04-11 notes).
- Source-set badges show dataset identifiers ("trial", "ai_generated", tracking codes): data, not labels.
- S7 has no pager; S13 counters show 0 for the admin; an unknown S7 `status` shows the empty block with no active tab.
- The S1 filter grid is 2 columns at 375px (`grid-cols-2 md:grid-cols-4`) and the S6 KPI grid 2 columns (`grid-cols-2 sm:grid-cols-4`): these work and fit (D10).
- Accessibility attributes, focus handling and motion replicate live (D10). The keyboard toggle (36×36px) and close button (32×32px) keep their live visual size; the project-wide touch rule NFR-RESP-03 (AC-M04-30.5) applies through a 44px hit area.
- KBAT: the data holds levels 1–6 (M05/M06 discovery: "LOTS 1" … "HOTS 6", `kbat_level=6` returns 3 BM sets). Two live scales exist in different places and are both replicated: the admin S8 filter offers only 2–5 with the label "Menilai/Mencipta (L5)"; the student filters (M05 S10, M06 S7/S9) offer "1. Mengingat" … "6. Mencipta". Each place is internally consistent (a limited admin filter is a deliberate limit, D10), so no fix; S8 pills show "L{n}" for any value and S9 uses "Mengingat (L1)" / "Mencipta (L6)" (INFERRED) for the values the admin labels lack.
- The report modal subtitles promise deactivation ("sementara" for MCQ, "selepas 3 laporan" for structured); the rule is replicated in the mock (SRS BR-M04-12).

---

## 8. Out of scope

| Item | Owner / reason |
|---|---|
| Hosting practice pages (`/spm/latih-tubi/{code}/quiz`, `/latihan-berstruktur/{id}/jawab`) and how questions are drawn for practice | M05 / M06. M04 owns the report modal component, the report entity and the question data they read. |
| Structured question create/edit (`/guru/soalan-berstruktur/cipta`, `/{id}/edit`), teacher paper upload (`/guru/soalan`), DSKP API (`/guru/api/dskp/*`) and the DSKP data set | M10 (API/screens). M04 consumes them. |
| Subjects and education levels (records, `isCore`, lookups `GET /api/subjects`, `GET /api/education-levels`), curriculum chapters (`curriculumChapterId` target) | M03. M04 reads them; it does not duplicate them. |
| Practice sessions, answer log, revision queue, mastery (D12) | M05. They read questions through the M04 store contract. |
| SPM hub constants and SPM screens; PKSK screens and PKSK domains | M06; M07 (their rows live in the M04 store). |
| "Databank Soalan" (`/spm/tahun-lepas`) and "PKSK Soalan/Akses" in the SOALAN / Premium sidebar groups | M06 / M07. |
| Tournament banner, chatbot, PWA/FCM scripts on user-portal pages | M16 / M22 / global shell. |
| Server status widget in the admin header | M23. |
| Real AI generation (AI explanation, master notes regeneration), real image storage, real CSV parsing security, file downloads from real storage | Backend phase (D1, D4). The prototype simulates them. |
| Where teachers "approve" master notes | Not found in M04 (§9 OQ-10). |

---

## 9. Open questions

Only questions that cannot be answered by following the live site.

1. **OQ-1 Post-submit results and messages (INFERRED; UNVERIFIED COPY).** No M04 POST could be sent: create, update, delete, bulk actions, status quick actions, import, audit, report update, paper status, diagram upload/dismiss, master-note actions, AI generation, report submission. The prototype uses the SRS §8 placeholders. A validation-failure probe would need the user's permission (as M01 OQ-1).
2. **OQ-2 Status of a new question (INFERRED).** S2 has no status field; import is documented as "draf". The prototype saves S2 questions as `approved` and active (live data holds only approved/archived rows). Confirm.
3. **OQ-3 Non-MCQ rendering (INFERRED).** Non-MCQ questions exist live only as observed on M10 S28 (Bahasa Melayu: 105 essay, 25 other types); none was opened on M04 S3/S4. S3 display and the DV-M04-05 edit form are specified from the create form; how practice (M05) scores these types is out of M04.
4. **OQ-4 Used-question statistics and quick-action buttons (INFERRED).** Content of the S3 statistics card and the labels/conditions of the `updateStatus` buttons. Also whether S4 previews an existing question image (the live component starts with `preview: null`; no question with an image was sampled).
5. **OQ-5 Import template and history.** Template columns and sample rows. DV-M04-01 scope (keep the minimal read-only history table or drop the link) and its PROPOSED COPY — for the owner at G1, together with the DV-M04-07 and DV-M04-12 PROPOSED COPY.
6. **OQ-6 "My reports" list (INFERRED).** Row layout and student-visible labels of `/laporan-soalan` when reports exist.
7. **OQ-7 Quality score.** The scoring formula and the Lemah/Kritikal boundary (the prototype uses Lemah 26–50, Kritikal 0–25, INFERRED) and whether "Jumlah Soalan" counts legacy generic rows (the prototype counts all questions, DV-M04-04).
8. **OQ-8 Needs-diagram flag.** What sets it (import/AI audit) and whether "Dismiss" can be undone.
9. **OQ-9 Auto-deactivation rules.** Whether "sementara" (MCQ) and "selepas 3 laporan" (structured) are enforced server-side and how "sementara" ends (the prototype: MCQ inactive on the first report until reactivated; structured inactive at the 3rd pending/reviewed report).
10. **OQ-10 Master-notes lifecycle.** What flags a note, who "teacher-approves" it and where (no flagged or approved rows live).
11. **OQ-11 Report sources.** S7 says reports come from "kuiz, latihan & Papan Bijak" and shows "Bilik: {code}"; only two modal hosts were seen. Papan Bijak (room code) belongs to another module (INFERRED M16/M10); its report entry point is not specified here.
12. **OQ-12 Inventory headline.** `_summary.md` says 1,286 content elements; the JSON holds 1,226 (per-screen rows agree). Discovery owner to correct the headline.
13. **OQ-13 SPM scope attribute (INFERRED).** Live links prove SPM practice serves M04 questions (e.g. `/spm/latih-tubi/MATH/quiz?question_id=136891`), and the observed pool sizes are smaller than the eligible T4/T5 counts (e.g. Matematik Tambahan 501 of 2,101), so live uses a further attribute; the prototype models it as the facet `spmPool` (SRS BR-M04-32) and sets it on runtime T4/T5 rows of SPM subjects. What live stores, and whether new admin questions join the pool, should be confirmed.
14. **OQ-14 KBAT labels 1 and 6 on admin screens (INFERRED).** How S9 labels L1 and L6 structured questions (the admin label set stops at "Menilai/Mencipta (L5)").
