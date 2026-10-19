# M04 — Element inventory & link crawl: summary

- **Captured:** 2026-09-25 from live https://prestasiplus.my, read-only, admin session on browser lane 2 (`playwright2`).
- **Method:** the same pipeline as M01/M02: `tools/inventory.js` → `tools/run-state.js` → `tools/split-batch.js` → `tools/merge-inventory.js` → `tools/diff-narrative.js`.
  - Capture plan: `tools/jobs/M04.js`, 91 UI states over 14 screens in groups A–I.
  - Screen map: `tools/jobs/M04.screens.json`.
  - Masked screenshots: `tools/jobs/M04.shots.js` + `tools/shoot.js`, 50 PNGs in `docs/discovery/img/M04/`.
  - Appendix generator: `tools/jobs/M04-appendix.js`.
  - **No shared tool was modified.**
- **Privacy:**
  - Every job first runs `M04MASK`, then `tools/sanitize.js`. `M04MASK` is defined in `tools/jobs/M04.js`; it masks "Oleh: …", "Dicipta oleh: …", "oleh …", "Soalan Oleh: Cikgu …", the S10 teacher column (name, Cloudflare `data-cfemail` e-mail, school) and admin-note textareas.
  - One dataset code containing a teacher's first name is redacted (`opts.redact`) as `tracking_a_<redacted>_math_20260326`.
  - `meta.piiLeakCheck` is 0 leaks in all 91 states.
  - A grep of all raw and merged M04 files for the real names seen during discovery, `bin`/`binti` patterns and e-mail patterns found **no matches**.
  - Question content is kept as data samples.
- **Files:**
  - Screen inventories: `S1-questions.json` … `S14-report-modal.json`.
  - Layout chrome: `SHA-admin-shell.json` (admin panel) and `SHU-user-shell.json` (user portal, S12–S14). Both are owned by the global doc.
  - `_crawl.json`.
  - Raw captures: `../_raw/M04/*.json` (91).
- **Status legend:** same as M01/M02. `normalizeIds` is on. Data-driven list items (table rows, report cards, diagram-audit cards, master-note rows) are limited to the first 3 per list via `opts.repeat`; the totals are in each state's `meta.repeats`.

## 1. Per-screen counts

M04 content totals **1,226 elements** over 14 screens and **91** captured states (1280 / 768 / 375). The shells add 232 (admin) and 374 (user portal) chrome elements, which are not M04 content. **No captured state has horizontal page overflow**; overflow inside cards is described in narrative §7.

| Screen (route) | Total | Visible default | Conditional | Hidden only | Mobile only | Desktop only | States | States captured |
|---|---|---|---|---|---|---|---|---|
| S1-questions `/admin/questions` | 139 | 104 | 27 | 8 | 2 | 18 | 16 | default, subject-4, status-archived, status-draft-empty, compliance-quarantined, compliance-pending, compliance-draft, dskp-untagged, source-trial, search-empty, page-2, select-one, select-all (@1280); default@375, select-one@375, default@768 |
| S2-questions-create `/admin/questions/create` | 168 | 64 | 75 | 29 | 1 | 0 | 13 | default (mcq), type-true_false, type-short_answer, type-fill_blank, type-essay, dskp-bidang, dskp-tagged, keyboard-arab, keyboard-jawi (@1280); default@375, keyboard@375, type-essay@375, default@768 |
| S3-question-show `/admin/questions/{id}` | 62 | 48 | 10 | 4 | 0 | 0 | 4 | approved-dskp, archived-untagged (@1280); default@375, default@768 |
| S4-question-edit `/admin/questions/{id}/edit` | 91 | 61 | 1 | 29 | 0 | 0 | 5 | default (DSKP loaded), untagged, sp-cleared (@1280); default@375, default@768 |
| S5-import `/admin/questions/import` | 59 | 51 | 7 | 1 | 0 | 0 | 4 | default, history-500 (@1280); default@375, default@768 |
| S6-quality `/admin/questions/quality` | 96 | 93 | 0 | 3 | 0 | 0 | 3 | default @1280/375/768 |
| S7-reports `/admin/question-reports` | 146 | 53 | 72 | 21 | 0 | 0 | 8 | default (pending), status-reviewed, status-fixed, status-dismissed, status-all (@1280); default@375, status-all@375, status-all@768 |
| S8-structured `/admin/structured-questions` | 81 | 64 | 16 | 1 | 2 | 21 | 7 | default, kbat-5, subject-2 + T5, empty, page-2 (@1280); default@375, default@768 |
| S9-structured-show `/admin/structured-questions/{id}` | 45 | 34 | 11 | 0 | 0 | 0 | 4 | multi-sub (3698), single-sub (4454) (@1280); default@375, default@768 |
| S10-submissions `/admin/question-submissions` | 48 | 27 | 7 | 14 | 0 | 0 | 7 | default, status-processing, status-rejected (empty), row-open (@1280); default@375, row-open@375, default@768 |
| S11-gambar `/admin/soalan-gambar` | 145 | 96 | 42 | 7 | 4 | 36 | 8 | default, subject-9, mcq-page-2, str-page-2, few (Struktur omitted), all-done (empty) (@1280); default@375, default@768 |
| S12-master-notes `/admin/master-notes` | 88 | 6 | 78 | 4 | 2 | 1 | 6 | default (flagged, empty), tab-approved, tab-all, tab-all-page-2 (@1280); tab-all@375, tab-all@768 |
| S13-my-reports `/laporan-soalan` | 18 | 15 | 0 | 3 | 0 | 0 | 3 | default @1280/375/768 |
| S14-report-modal (modal on M05/M06 practice pages) | 40 | 29 | 11 | 0 | 0 | 0 | 3 | mcq@1280, structured@1280, mcq@375 (live markup injected statically, all branches shown) |
| SHA-admin-shell (chrome of S1–S11) | 232 | 81 | 39 | 112 | 7 | 76 | 78 | all admin states |
| SHU-user-shell (chrome of S12–S14) | 374 | 153 | 17 | 204 | 15 | 148 | 12 | all user-portal states |

**Empty states captured:**
- S1 "Tiada soalan dijumpai" + "Tambah Soalan Pertama".
- S7 "Tiada laporan buat masa ini".
- S8 "Tiada soalan berstruktur ditemui" (inside the table) with "Menunjukkan – daripada 0 soalan".
- S10 "Tiada rekod ditemui".
- S11 "Semua soalan sudah lengkap dengan gambar rajah!".
- S12 "Tiada nota dalam tab ini.".
- S13 "Tiada Laporan" / "Anda belum menghantar sebarang laporan soalan.".

Empty-row text inside tables is claimed by the `table` element, so it is quoted in the narrative rather than stored as a separate element. Error page: `/admin/questions/import-history` → HTTP 500 (S5 state history-500).

## 2. Not in the narrative discovery

`node tools/diff-narrative.js inventory/M04 docs/discovery/M04-question-bank.md` reports **0 candidates on all 14 screens**. Appendix A of the narrative holds the concatenated DOM strings, the live data samples and the shared-layout inline-script strings.

Items that only the inventory and state captures surfaced during reconciliation, all now in the narrative:
1. S1 active subject tile + "Padam filter subjek — tunjuk semua" link. Bahasa Cina and Bahasa Tamil have no tile (D-13).
2. S1 badge variants: "Latihan Tambahan" (untagged), `PENDING_MAPPING`, `QUARANTINED`, `DRAFT`, "Arkib" + INACTIVE, "Source: TIADA".
3. S2 short-answer and fill-blank share one card with an x-text heading ("Jawapan Pendek" / "Jawapan Isi Tempat Kosong"). The virtual keyboard's Jawi-only keys (ڤ ڠ چ ڽ ݢ ۏ) and the harakat titles.
4. S4 "Buang tag DSKP" renders only after the SP is cleared (D-7). The edit form is MCQ-only (D-6).
5. S7 "Dikeluarkan" and "Dinyahaktif" badges. "Nyahaktif Segera" is absent on inactive questions. The MCQ variant shows options with the correct mark and an "Edit Soalan #id" link. "Bilik:" room code. Raw code "unclear" (D-9).
6. S8 Malay counter "Menunjukkan x–y daripada n soalan" alongside the English pager, a "Reset" link, and the empty counter defect (D-10).
7. S11 Struktur section omitted when empty. Stat cards ignore the filter. The school select has 10,221 options (D-12).
8. S14 the two modal variants (MCQ 7 reasons vs structured 5 reasons, different labels and deactivation subtitle).

## 3. New routes found by the crawl

532 unique URLs in `_crawl.json`: 334 M04, 196 in other modules via the shells, and 7 unknown.

Not yet in the TRACKER M04 checklist:

| URL | Kind | Found on | Note |
|---|---|---|---|
| `/admin/questions/create` | screen | S1 | S2 |
| `/admin/questions/{id}` | screen + DELETE | S1 | S3 |
| `/admin/questions/{id}/edit` | screen + PUT `/admin/questions/{id}` | S1, S6, S7 | S4 |
| `POST /admin/questions` | form | S2 | store |
| `POST /admin/questions/bulk-action` | form | S1, S3 script | approve/reject/archive/delete/pending_review |
| **`POST /admin/questions/{id}/generate-penjelasan-ai`** (`?force=1`) | JSON | S3 script | AI explanation (crawl shows the tail `/generate-penjelasan-ai`) |
| **`/admin/questions/import-history`** | link | S5 | **HTTP 500** (D-1) |
| `/admin/questions/import-template` | download | S5 | not fetched |
| `POST /admin/questions/quality/run-audit` | form | S6 | |
| `POST /admin/question-reports/{id}/update` | form | S7 | status/admin_notes/reactivate/force_deactivate |
| `/admin/structured-questions/{id}` | screen | S7, S8 | S9 |
| `PATCH /admin/question-submissions/{id}/status` | form | S10 | |
| `/admin/question-submissions/{id}/download/{n}` | download | S10 | not fetched |
| `POST /admin/soalan-gambar/{mcq,structured}/{id}/upload` and `/dismiss` | forms | S11 | |
| `POST /admin/master-notes/{id}/{approve,regen,unflag}` | JSON | S12 script | |
| **`POST /report-question`** | JSON | S14 host pages | student report submit |
| `GET /guru/api/dskp/bidang`, `/sk`, `/sp` | JSON | S2, S4 | DSKP pickers (teacher-portal API, M10/M03 data) |
| `/guru/soalan-berstruktur/cipta`, `/guru/soalan-berstruktur/{id}/edit` | screens (M10) | S8, S9 | structured create/edit lives in the teacher portal |
| Query variants: `/admin/questions?subject_id&education_level_id&difficulty_level&status&dskp_filter&compliance_filter&source_filter&search&page`, `/admin/question-reports?status=`, `/admin/structured-questions?subject_id&education_level_id&kbat_level&page`, `/admin/question-submissions?status=`, `/admin/soalan-gambar?subject_id&school_id&mcq_page&str_page`, `/admin/master-notes?tab=&page=` | | | captured as states |

**Probed, absent (404):**
- `/admin/structured-questions/create` and `/{id}/edit`
- `/admin/question-reports/{id}`
- `/admin/question-submissions/{id}` and `/create`
- `/admin/master-notes/{id}`
- `/admin/questions/{id}/preview`
- `/admin/soalan-gambar/mcq/{id}`
- `/admin/questions/quality/details`
- `/laporan-soalan/{id}`
- `/admin/questions/import/history`

`/admin/questions/import-logs` → 500.

**Unknown in the crawl:**
- `/`: the 500 page's "Halaman Utama" link.
- `/api/tournament/active` and `/tournament/`: user-layout banner (M16).
- `/chatbot/*`, `/fcm/token`: user-layout widgets.
- `/generate-penjelasan-ai`: the tail of the S3 URL concatenation.

## 4. Out-of-module links (target module)

From the shells on the M04 screens, as classified in `_crawl.json`: M01 5, M02 7, M03 5, M05 9, M06 7, M07 3, M08 7, M09 11, M10 17, M11 6, M12 15, M13 4, M14 14, M15 5, M16 8, M17 6, M18 12, M19 5, M20 3, M21 4, M22 4, M23 3, M24 6, M25 6, M26 4.

Found in M04 content (not the shell):

| URL | Found on | Target |
|---|---|---|
| `/latihan-berstruktur/{id}/jawab?scope=spm` ("Buka Soalan Sama") | S7 | M05 |
| `/spm/latih-tubi/{CODE}/quiz?question_id={id}&count=1` ("Buka Soalan Sama") | S7 | M06 |
| `/guru/soalan-berstruktur/cipta`, `/guru/soalan-berstruktur/{id}/edit` | S8, S9 | M10 |
| `/guru/api/dskp/*` | S2, S4 | M10 (API) / M03 (DSKP data) |
| `/admin/server-status` | admin header script | M23 |
| `/notifikasi`, `/notifikasi/unread-count` | user-layout script | M01/M22 |

The report modal (S14) is rendered by M05/M06 practice pages. M04 owns its data and the admin triage.

## 5. What could not be revealed read-only / safety notes

| Item | Why |
|---|---|
| All POST/PUT/PATCH/DELETE outcomes, flash and validation messages: create/update/delete question, bulk actions, import, run-audit, report update, submission status, diagram upload/dismiss, master-note approve/regen/unflag, AI explanation generation, report submit | Would change data. Confirm texts were read from the page source. |
| Import template CSV, submission file downloads | Download routes were not fetched. |
| Import history / result screen | `/admin/questions/import-history` returns 500. Nothing was imported. |
| Non-MCQ question show/edit rendering | No true/false, short-answer, fill-blank or essay question was found (no type filter; all sampled rows MCQ). |
| S3 usage-statistics card, Quick-Action status buttons, "regenerate AI explanation" branch | Only 2 detail pages opened; both unused and approved/archived, without an AI note. |
| `/laporan-soalan` populated list | The admin account has sent no reports. |
| Master Notes flagged / approved rows | Both tabs are empty live. |
| Image preview states (question/option images, diagram upload) | Choosing a file was forbidden. The preview markup is inventoried from `<template>`. |
| Report modal on a live practice page | The pages were fetched with GET only, and the modal markup was re-rendered on `/laporan-soalan` (static inventory, Alpine-rendered screenshots). The practice pages were not run in the browser, so no quiz session was started. |

**Safety notes:**
- No Simpan, Kemaskini, Padam, Import, Upload, Dismiss, Approve, Tandakan Selesai, Nyahaktif, Laksanakan, Jana Penjelasan AI or Jalankan Audit Semula control was clicked.
- No file was chosen and no download or template route was requested.
- Two GET requests were made to student practice pages (`/latihan-berstruktur/3698/jawab?scope=spm`, `/spm/latih-tubi/MATH/quiz?question_id=136891&count=1`), about 3 times each, only to read the report-modal markup. These are the "Buka Soalan Sama" links on S7. The GET may create an attempt or session record server-side (unknown).
- The load on the live site was modest: sequential page loads in one browser lane.
