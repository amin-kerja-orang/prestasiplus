# M04 — Question Bank — Software Requirements Specification

## 0. Document control

| Field | Value |
|---|---|
| Document | SRS — M04 Question Bank |
| Version | 1.19 |
| Date | 2026-10-01 |
| Status | Approved (G1). v1.2 = cross-module alignment (XL review, D11, D12); v1.15–v1.16 = XL3 Addendum B, B-01 (no observed value changed) |
| Authors | product-analyst (functional: §1–5, 8–10, 12–13) and solution-architect (data entities §6, mock API §7, NFR/SEC §11) — agent |
| Source URS | [urs/M04-question-bank.md](../urs/M04-question-bank.md) v1.13 |
| Evidence | [discovery/M04-question-bank.md](../../discovery/M04-question-bank.md), inventory `docs/discovery/inventory/M04/`, audit [M04-audit.md](../../qa/audit/M04-audit.md), cross-module review [cross-module-logic-M01-M07.md](../../qa/audit/cross-module-logic-M01-M07.md) |

**Change log**

| Version | Date | Change |
|---|---|---|
| 1.19 | 2026-10-01 | **Question-report review outcomes (doc only; no observed value or live copy changed).** §2 S14 and SQ-2 (XL-09 note) and FR-M04-118: modal contract = `open` / `update:open` (v-model), emits `reported {ok, message}`, M05/M06 hosts own the trigger button; prop names `tints` (`tint` only as an alias if kept), `source`, `failureText`, `variant`, `questionId`, `quizSessionId`. §7 #15: `quizSessionId` / `roomCode` capped at 64 characters with a format check, 422 (INFERRED). §7 #16: response narrowed to `{data:{id, status, adminNotes, updatedAt}, status}`. §7 #17, §6.3 and §8.2: student's own reports carry the question block `{exists, type, id}` only, no text, options or correct answer (INFERRED security decision; live S13 never observed populated). §8.2 S13 rows: copy INFERRED, no "Oleh" line, no question block, no source badge. New §11.1 Real-backend security requirements (SEC-M04-11…15, backend-only). §13 SQ-9: "Buka Soalan Sama" 404 until M05/M06 build their routes. |
| 1.18 | 2026-10-01 | **Review and QA outcomes (doc only; no observed value changed).** New DV-M04-20 (D9): S6 "Taburan Kualiti" labels of segments narrower than 8 % move just below the bar (live clips them; "0.5" is cut off); "replicate the clipping" rejected. FR-M04-60 and E2E-M04-34 reworded. §10 S11 at 375: stat cards are "2 + 1 (as live)" (from `gambar-mobile.png`), replacing "stacked". §8.2: generic fallback "Ralat berlaku. Sila cuba lagi." listed as INFERRED / UNVERIFIED COPY. §6.5: default master-notes state 0 flagged / 0 approved / 525 total stated; populated tabs come only from the `masterNotes` reset override (no behaviour change). |
| 1.17 | 2026-09-30 | **G4 review follow-ups, as-built record (doc only; no observed value changed).** §7 #6 DELETE returns 200 `{data:{deleted}, status}` (not 204; flash from the API status). §6.4 and new DV-M04-19: the S10 seeds hold 6 rows (2 PROPOSED, ids 5 pending and 6 rejected, per §6.11), so the S10 count is 6 against 4 on live. BR-M04-22: the audit scores only runtime-created rows (id ≥ 9,000,001), so the S6 figures stay pinned (INFERRED). §7.1 adds `submissions.*` and `masterNotes.*` with the real signatures read from `mock/repository/submissions.ts` and `master-notes.ts`; DV-M04-19 is also listed in §0.1. |
| 1.16 | 2026-09-27 | **XL3 Addendum B, B-01 follow-up (Delivery Lead; doc only; no observed value changed).** The observed M17 Guru row `<teacher:137>` (SMK JALAN REKO = 8087, 497 MCQ + 1,062 structured) = M02 v1.25 teacher **4202** (the M14 anchor, not M04's 8107 anchor 4502) (M14 S22 rank 2, 1,559 = 497 + 1,062). 8087's 2,432 Q-TEACHER-CONTRIB rows are split by `createdBy`: **4202** 497 objective + 1,062 structured = 1,559; **4501** 871 objective + 2 structured = 873 (kept on the existing anchor; no captured row shows them). `contribSchoolId` stays 8087 on all 2,432, so school 8087 = 1,368 + 1,064 = 2,432, 11,414 and every cell are unchanged. Q-CONTRIB(4202) = 497, Q-CONTRIB(4501) = 871 (neither observed on an M10 screen). Captured live Guru rows: 389 of 551 (v1.15 said 400). Updated: BR-M04-38(c), §4.1, DATA-M04-01 `createdBy`, §6.13.1, §7.1, SQ-7, SQ-8. |
| 1.15 | 2026-09-27 | **XL3 Addendum B, B-01 (`docs/qa/audit/cross-module-logic-M12-M18.md`; doc only; no observed value changed).** SQ-8 answered in part: the M17 snapshot row `<teacher:101>` (no school, never logged in, 5,547 MCQ, 0 structured) is M02 v1.24 fixture teacher **5316**; **5,547** of the 7,565 placeholder rows now carry `createdBy` 5316 (all MCQ, as the placeholder rows already were); the other **2,018** stay on 5801 (open placeholder, SQ-8). `contribSchoolId` stays **0** on all 7,565 rows (meaning restated: "no contributing school" — teacher without a school, or the unattributed placeholder), so no facet cell changes. New per-teacher contract `questions.teacherContributions({teacherId})` → `{mcq, structured}` (= `count('Q-TEACHER-CONTRIB', {teacherId})` and `count('Q-TEACHER-CONTRIB-STR', {teacherId})`), for the M17 Guru-tab rows. Correction to the XL audit premise: `<teacher:137>` (SMK JALAN REKO = school 8087, 497 + 1,062) is inside 8087's observed 2,432 on 4501, not among the 7,565 (M17 S11 school row "2,432 1368M + 1064S"). Updated: BR-M04-38(c), §4.1 Q-TEACHER-CONTRIB / -STR, DATA-M04-01 `contribSchoolId` / `createdBy`, §6.13.1 `createdBy`, §7.1, FR-M04-128, SQ-7, SQ-8. Counts: Q-TEACHER-CONTRIB 11,414 = 3,849 (4501–4504) + 5,547 (5316) + 2,018 (5801); per school 2,432 / 1,403 / 13 / 1 and structured 1,064 / 219 / 0 / 0 unchanged; Q-CONTRIB(1) 16,817 and Q-CONTRIB(5) 1 unchanged; no row added, removed or moved between cells. |
| 1.14 | 2026-09-27 | **F-25 build review follow-up (doc only; no observed value changed).** BR-M04-38(c), SQ-7(a): the 3,849 Q-TEACHER-CONTRIB rows of schools 8087 / 8107 / 8880 / 8090 carry `createdBy` = the M02 v1.20 anchors 4501 / 4502 / 4503 / 4504 (done); the other 7,565 objective contribution rows stay on `createdBy` 5801 (M02 fixture admin) with `contribSchoolId` = 0 (sentinel "unattributed"), an open, documented placeholder (SQ-7(d)); consumers count through `count('Q-TEACHER-CONTRIB', scope)` / `teacherContributions(schoolId?)`, never by joining `createdBy` to the teacher role. DATA-M04-01 `createdBy` and `contribSchoolId` and the §6.13.1 `createdBy` row made accurate (sentinel 0; PPD/state scopes cannot attribute those rows). Id-range option for 108527 / 564156 is F-09 `absentIds` (not `holes`). §7.1 lists `questions.teacherContributions(schoolId?)` as the same contract. New non-blocking SQ-8 (XR to M02). Q-TEACHER-CONTRIB stays 11,414; §4.1, §7.1 counts and E2E-M04-69 unchanged. |
| 1.13 | 2026-09-27 | **F-25 as-built record.** §7.1 lists the store functions under their built names (`practiceQuery`, `countWhere`, `sampleKeyless`, `pkskList/Get/Create/Update/Delete`, `jutawanCount/Sample/Get/GradeAnswer`, `structured.visible`, `count('Q-IMPORT-RUNS')`, `importedTotal()`, `countByMonth(month)`); framework-reserved names noted. §4.1 adds the built named queries Q-CHAPTER, Q-TEACHER-CONTRIB-STR, R-STATUS, R-MINE. Placement decisions recorded (SP 418 / BM T4 SPs also take pool rows; databank difficulty 3 = 911 + 39; `sourceType` null 27,654 / textbook 382,432; new facet `contribSchoolId`). Id-range holes 108527 and 564156. Boot-cost note in NFR-M04-01. SQ-7: XR to M02 (teacher ids) and XR to M10 (4 missing generic SPs). No live count changes. |
| 1.12 | 2026-09-27 | **XL3 round 2, R2-08 (M07 XR-M07-01).** New named query Q-PKSK-DIFFICULTY(d) = 253 / 253 / 191 / 66 / 0 in §4.1, served by `questions.count`; it equals the existing §6.13 PKSK cells, so no count changes. |
| 1.11 | 2026-09-27 | **XL batch 3 round 1** (`docs/qa/audit/cross-module-logic-M12-M18.md`). XL3-10: new M04-owned store `jutawanQuestions` (143 cells, Σ 149,911, Q-JUT-COUNT; `questions.jutawan.count / sample / get / gradeAnswer`), outside Q-ALL; M16 can retire DC-M16-02. XL3-11: facet `coverageExcluded` (1,746 active rows; Q-M17-COV 127,643); Table A rebuilt as the M17 S10 matrix + the excluded rows (D1–D4 still equal the M05 pins; the 9 level-less rows move from Bahasa Melayu to Matematik; S10 per-subject difficulty tiles pinned; excluded rows difficulty 473 / 731 / 542 / 0); PKSK difficulty 253 / 253 / 191 / 66 (M17 XR-10, request to M07); M08's 15 Sejarah T4 anchors are SPM pool rows; ImportRun is a D11 set (1,123 runs, Σ 31,101, none in Aug–Sep 2026; seeded run re-dated to 2026-07-20; no objective question created on or after 21 Sep 2026); `createdBy` of generated contributions Σ 11,414 over active teachers outside the M14 S22 rows (Q-CONTRIB of users 1 and 5 unchanged); M18 critical-question block 701001–701099; M16 sample filters confirmed. New FN-M04-6.3.12/6.3.13, US-34, FR-127/128, E2E-68/69. Fit, difficulty-by-level, anchor-capacity checks: 0 violations. |
| 1.10 | 2026-09-26 | **Architecture overview v1.4, X-11 (wording only).** `questions.count(filter)` → `questions.countWhere(filter)` and `namedCount(name, params?)` → `count(name, ...params)` (§7.1, FR-M04-119); new owner method `questions.contributeCells(contributor, cells)` for seed-phase distribution cells from non-owners (M06 SPM pool), validated by M04; `overrideSpec` owner-only. No behaviour change. |
| 1.9 | 2026-09-26 | **XL2-39 (Minor).** DATA-M04-01 `createdBy` note aligned with the dataset spec (user 1 = the 16,817 layout-block rows, user 5 = 700302, other rows generated ids); DATA-M04-04 `source` list adds `teacher_databank` (as BR-M04-11 and #15). Checks re-run: 0 violations. |
| 1.8 | 2026-09-26 | **Alignment with M10 v1.4.** `scriptType` adds `mixed` ("Campuran", `ltr`); the 4 values are OBSERVED (M10 S18/S22). §6.11: every subject–level pair of Tables A–C has an M10 generic Bidang/SK/SP (SP id 8000 + 20 × subjectId + levelId; Sains T5 = 6191), replacing "Other pairs return `[]`". §6.13: generated `dskpTagged` rows point to their pair's generic SP; Q-SP-AVAILABLE of the named SPs unchanged (9001 = 30, 9002–9004 = 2, 221/206/222/214/179/194/418 = 16/16/7/12/13/50/13). Checks re-run: 0 violations. |
| 1.7 | 2026-09-26 | **XL batch 2 (`docs/qa/audit/cross-module-logic-M08-M11.md`).** XL2-09: facet `createdBy` + Q-CONTRIB(user) (16,817 admin rows per the M10 subject counts; anchors 522425–522447 BM D6, a layout block from 522425). XL2-10: Q-TEACHER-DATABANK(subject) on the new facet `teacherDatabank` (BM 6,048 = mcq 5,918 + essay 105 + 25 other types, observed on M10 S28); the "every row mcq" rule replaced (non-MCQ rows live only in the BM databank; MCQ practice requires `mcq`). XL2-11: M10 anchors registered (522425–522447, 525428–525433, 700302); 700301 is a test-only runtime fixture (hook), so the default "pending 0" stays; block 700001–700999 split M08 / M10 / M11. XL2-12: DATA-M04-01 `curriculumTopicId`, `scriptType`, `textDirection`; teacher write contract `questions.createFromTeacher/updateOwn/deleteOwn/importFromTeacher` (`pending_review`, **`isActive = true`**); §7.1 renamed to the architecture's `questions.* / structured.* / reports.*`. XL2-13: StructuredQuestion/SubQuestion completed with the M10-authored fields and `structured.create/update/delete/toggleStatus`; §6.2 heading fixed. XL2-14: reason `outdated`, source `teacher_databank`, #15 `{success, message}`. XL2-15: `paperType` 7 values, `levelCode` nullable. XL2-16: field `chapterLabel` (anchors only) + `curriculumTopicId`; M11 anchor block 700401–700931 (Students A/B/C). XL2-18: #28–#30 → `/api/guru/dskp/*` (M10 #39–#41). XL2-20: facet `dskpSpId` + Q-SP-AVAILABLE(sp) (9001 = 30, 9002–9004 = 2, admin SPs 221/206/222/214/179/194/418 = 16/16/7/12/13/50/13). XL2-34: `visibility` note. New US-33, FR-121…126, E2E-65…67; fit and anchor checks 0 violations. |
| 1.6 | 2026-09-25 | **XL-39 (round 3).** Coverage anchors moved so each has a slot: 570025 Bahasa Tamil D2 → T1 (D1–D4 pinned 0), 570006 Sains T4 → T1 (the eligible Sains T4 rows are all pool rows); 570024 scored 55 (`baik`; legacy rows stay in cemerlang/baik); master-note anchors given cells (BI T5 ×3, Fizik T5, Matematik T4 ×2, all pool rows); state profile defined as a spec override. New §6.13.1 anchor-cell table; anchor check `anchors.js`: every M04 and contributed anchor fits, 0 violations; fit re-run 0 violations. No observed count changed. |
| 1.5 | 2026-09-25 | **XL round 2.** XL-29: the SPM pool is defined only by the `spmPool` facet (BR-M04-32, FR-113, §6.13, §7.1, E2E-60); runtime rows created or imported at T4/T5 in an SPM subject get `spmPool = true` (INFERRED, BR-M04-09/10, URS OQ-13). XL-30: every D1–D4 cell of Table A is pinned to the M05 observed S3 values (Σ 32,204 = the M03 D1–D4 total; all other subjects 0 at D1–D4) and the fit is re-run. XL-31: new named query Q-DIFFICULTY = Q-ACTIVE + Q-PKSK by difficulty (39,694 / 47,138 / 33,720 / 9,600 / 0), modelled exactly (D1–D4 cells per M05, pool cells per M06, PKSK 190/191/191/191 required of M07, remainder); no active or PKSK row has difficulty 5. XL-37: runtime question ids start at 9,000,001. XL-36: count wording cites the §4.1 names (new Q-PRACTICE, Q-DIFFICULTY, Q-SPM-POOL, Q-STRUCT-ALL, Q-STRUCT-VISIBLE). XL-25: DATA-M04-04 `source` note and the §6.13.2 `dskpSpId` note corrected. Feasibility re-run, 0 violations. |
| 1.4 | 2026-09-25 | **Architecture alignment (overview §6.6–§6.7, ADR-0013/0014).** X-7: new §6.13 dataset spec for `questions` (N 466,041 = 465,278 + 763 PKSK) and `structuredQuestions` (4,064). It covers facets, id ranges, exact cell tables A (active, subject × level), B (inactive) and C (scored), nested facet totals with sources, anchors and D9 values. Feasibility is checked by script, 0 violations; the checks include M05 S3 pins, M06 pool lower bounds and M08 room. X-8: §6.13.2 contributed anchors (M05 600001–600065, M06 pool cells, M07 177698–178460, M08 700001–700215) with their cell buckets; no total changes. |
| 1.3 | 2026-09-25 | **Cross-module alignment 2.** XL-13: #31 now `GET /api/schools?all=1` (M02 §7 #43); `/api/admin/schools/options` removed. Count reconciliation with M05 v1.2: new §4.1 named count queries on one dataset (admin screens count every status; student-facing figures count active questions: Q-ELIGIBLE 128,989, Q-ACTIVE 129,389; 17,341 approved rows inactive; 400 archived Pendidikan Moral rows active; PKSK 763); M01 login stat and M03 per-subject counts checked against them; new DV-M04-18 (Prinsip Perakaunan "lulus" 2,329 vs student 2,970 → 2,970; status split 146,330 / 318,948). BR-M04-20, §6.11, §7 #31 and §7.1, E2E-02/57 updated. |
| 1.2 | 2026-09-25 | **Cross-module alignment (XL review; D11, D12).** One question store and one structured store owned by M04, exposed to M05/M06/M07 through the store contract §7.1. XL-01: SPM pool = eligible T4/T5 MCQ view (BR-M04-32, FR-113/114). XL-02: D11 datasets with live totals (465,278 / 4,064 / 525), fixtures as anchors, seeded totals removed (BR-M04-20, BR-M04-34, §6.11). XL-07: PKSK fields, `pending`, exclusion, S3 rendering (BR-M04-33, FR-116/117, §6.1, §7 #1/#4). XL-08: `curriculumChapterId`. XL-09: modal props `source`, `failureText`, `tints` (FR-118, §2, BR-M04-11). XL-11: structured dataset 4,064 (4,059 student-visible) with the valid anchor list. XL-12: KBAT 1–6, both live scales (BR-M04-28). XL-13: #31 → M02 `/api/admin/schools/options`. XL-20: titles without subtitle (FR-107). XL-22: DV-M04-17 (FR-120). XL-24: canonical structured paths (§7.1). Now 120 FRs, 34 business rules, 64 E2E. |
| 1.1 | 2026-09-25 | **Audit round 1 fixes** (AUD-M04-01…19) and D10: native bulk validation (FR-13), partial DSKP reset (FR-33), DV-M04-15 S4 preload (FR-35), live AI error mapping (FR-46, §7 #8), S11 filters/pagers (FR-95…99, BR-19, DV-M04-16), S1 order (BR-M04-31) and subject cell, missing_source seed anchor, unknown report status, casing/backticks/badges, §10 grids, Purata colours, keyboard details, S12 button states (§7 #27 non-2xx), DV-14 cause, PROPOSED COPY marks, one DV-08 rule, M03 lookups referenced (new FR-M04-112, §7 #32–33), live report ids in the seed, SQ-1 closed, new NFR-M04-06 (D10). Now 112 FRs, 31 business rules, 33 endpoints (27 M04-owned), 59 E2E. |
| 1.0 | 2026-09-25 | First issue. 111 FRs, 30 business rules, 11 data entities + seed, 30 mock endpoints (26 M04-owned), 59 E2E scenarios on 3 viewports, 10 SEC items. Traceability checked by script (§3.1). |

Conventions as in the URS (§0): OBSERVED / INFERRED / UNVERIFIED COPY / PROPOSED COPY / DV-M04-nn / SEC-M04-nn; D10 (accessibility replicates live). Exact live copy is quoted; displayed casing is given where CSS changes it.

### 0.1 Fidelity deviations referenced here

DV-M04-01 import history page · DV-M04-02 header titles and S2–S4 active item · DV-M04-04 single count source · DV-M04-05 edit form for every type · DV-M04-06 "Buang tag DSKP" visibility · DV-M04-07 CSV required-vs-default rule · DV-M04-08 raw codes and structured reason labels · DV-M04-09 pager at 768 and S1 column at 375 · DV-M04-11 S11 stat cards follow the filter · DV-M04-12 empty structured counter · DV-M04-13 BC/BT tiles · DV-M04-14 readable S12 h1 · DV-M04-15 S4 DSKP preload shown and kept · DV-M04-16 S11 pagers keep filters · DV-M04-17 text below 12px raised to 12px · DV-M04-18 Prinsip Perakaunan approved count (§4.1) · DV-M04-19 S10 seeds hold 6 rows against 4 on live (§6.4; PROPOSED, v1.17) · DV-M04-20 S6 "Taburan Kualiti" labels of segments narrower than 8 % shown below the bar (§6.13; v1.18). DV-M04-02 is implemented by the shell rule DV-SH-03 (title from the route, no subtitle). DV-M04-11 now covers the S11 stat cards only. PROPOSED COPY: DV-M04-01, 07, 12. Replicated (not changed): DV-M04-03 (S11 sidebar, S12 layout) and DV-M04-10 (one-click actions). Full table: URS §7.

## 1. Scope

The mock implementation covers S1–S14 (+ the DV-M04-01 history page) with dummy data behind a REST-shaped mock service layer (D1, D2):
- objective questions: list, filters, bulk and row actions, create for 5 types, detail, AI explanation (canned, D4), edit, CSV import (parsed in the browser by the mock), quality dashboard;
- structured questions: list and detail (read-only in M04);
- question reports: the modal component (exported for M05/M06 host pages), admin triage and "my reports";
- teacher papers, diagram audit, master notes.

Store ownership (D12): M04 owns the question store (objective questions incl. the SPM pool and the PKSK rows) and the structured-question store; both are D11 deterministic virtual datasets (§6.11, BR-M04-34). M05, M06 and M07 use the store contract of §7.1 and never keep their own copy.

Out of scope: see URS §8 (practice hosting and sessions M05/M06, SPM hub constants M06, PKSK screens M07, structured authoring and DSKP API M10, subjects/levels/chapters M03, real AI, real storage, real downloads).

## 2. Screens & routes

| Route | Screen | Primary actor | Shell | Notes |
|---|---|---|---|---|
| `/admin/questions` | S1 Pengurusan Soalan | Admin | admin | query: `subject_id, education_level_id, difficulty_level, status, dskp_filter, compliance_filter, source_filter, search, page` |
| `/admin/questions/create` | S2 Tambah Soalan Baru | Admin | admin | |
| `/admin/questions/:id` | S3 Detail Soalan | Admin | admin | unknown id → global 404 page (M01) |
| `/admin/questions/:id/edit` | S4 Edit Soalan | Admin | admin | |
| `/admin/questions/import` | S5 Import Soalan | Admin | admin | |
| `/admin/questions/import-history` | S5h Sejarah Import | Admin | admin | DV-M04-01 |
| `/admin/questions/quality` | S6 Kualiti Soalan | Admin | admin | |
| `/admin/question-reports` | S7 Laporan Soalan | Admin | admin | `status=pending` (default) `|reviewed|fixed|dismissed|all` |
| `/admin/structured-questions` | S8 Soalan Berstruktur | Admin | admin | `subject_id, education_level_id, kbat_level, page` |
| `/admin/structured-questions/:id` | S9 Detail Soalan Berstruktur | Admin | admin | |
| `/admin/question-submissions` | S10 Kertas Soalan Guru | Admin | admin | `status` |
| `/admin/soalan-gambar` | S11 Soalan Perlu Gambar Rajah | Admin | admin | `subject_id, school_id, mcq_page, str_page`; no admin sidebar item |
| `/admin/master-notes` | S12 Master Notes | Admin | user portal | `tab=flagged` (default) `|approved|all`, `page` |
| `/laporan-soalan` | S13 Laporan Soalan Saya | Logged-in user | user portal | |
| (component) `ReportQuestionModal` | S14 | Logged-in user | on M05/M06 pages | props `questionId`, `variant: 'mcq'|'structured'`, `quizSessionId?`, `source?` (default `'spm'` for mcq, `'structured_attempt'` for structured; allowed `spm`, `structured_attempt`, `latihan`, `revision`), `failureText?` (default "Ralat. Sila cuba lagi."), `tints?` (reason → ticked colour; default the M04 set of FR-M04-65; `tint` only if kept as an alias) — FR-M04-118. **Control contract (v1.19):** the modal is controlled with `open` and `update:open` (v-model) and emits `reported {ok, message}`; the host page in M05/M06 owns the trigger button, the modal renders none. |

Shell header titles: FR-M04-107 (from the route, no subtitle, except S5, S6, S10, S11, S13 which keep their live title and subtitle). Tab titles (exact): S1 "Pengurusan Soalan", S2 "Tambah Soalan Baru", S3 "Lihat Soalan", S4 "Edit Soalan", S5 "Import Soalan", S5h "Sejarah Import", S6 "Kualiti Soalan - Admin", S7 "Laporan Soalan — Admin Panel", S8 "Soalan Berstruktur", S9 "Detail Soalan Berstruktur", S10 "Kertas Soalan - Admin", S11 "Soalan Perlu Gambar Rajah - Admin", S12 "Master Notes — Admin Review", S13 "Laporan Soalan Saya".

## 3. Functional requirements

| ID | Requirement | FN | Traces |
|---|---|---|---|
| FR-M04-01 | S1 SHALL render h1 "📚 Pengurusan Soalan", subtitle "Urus bank soalan untuk platform PRESTASIPLUS" and the create button (`fa-plus`, "Tambah Soalan" ≥640px / "Tambah" <640px → `/admin/questions/create`); shell header per DV-M04-02. | 1.1.1, 6.1.4 | US-01; AC-01.1, AC-01.2 |
| FR-M04-02 | S1 SHALL render card "Ringkasan Bank Soalan" with "Jumlah: **{n}** soalan", {n} = Q-ALL (§4.1, BR-M04-20), `ms-MY` thousands separator. | 1.1.2 | US-01, US-29; AC-01.3, AC-29.3 |
| FR-M04-03 | S1 SHALL render the "Subjek Teras" group (M03 subjects with `isCore` = true, ids 1–7 today) and the "Subjek Elektif" group (the rest, ids 8–31 incl. 19 and 20 per DV-M04-13), both in id order from `GET /api/subjects` (M03) plus the counts of `GET /api/questions/summary`; each tile links `?subject_id={id}` and shows icon (tile icon map, SRS §6.10), name truncated to 12 characters + "..." when longer, the total = Q-ALL(subject), and "{n} lulus" with n = Q-APPROVED(subject) only when n > 0 (§4.1). | 1.1.3, 1.1.4 | US-02; AC-02.1, AC-02.2 |
| FR-M04-04 | When `subject_id` is set, the matching tile SHALL use the active style (`border-indigo-*`, `bg-indigo-50 shadow-md`) and the link `fa-times-circle` "Padam filter subjek — tunjuk semua" → `/admin/questions` SHALL show. | 1.1.5 | US-02; AC-02.3 |
| FR-M04-05 | S1 SHALL render the 8-field GET filter form with the exact labels, names and options of URS FN-M04-1.1.6–1.1.9 and an icon-only `fa-search` submit; controls reflect the current query. | 1.1.6, 1.1.7, 1.1.8, 1.1.9 | US-03; AC-03.1 |
| FR-M04-06 | The list SHALL apply all given filters with AND (BR-M04-04…07), ignore unknown parameters (`type`, `question_type`, `sort`), and never include PKSK rows (BR-M04-33). | 1.1.19 | US-03; AC-03.2, AC-03.3, AC-03.4 |
| FR-M04-07 | S1 SHALL render the table (20 rows/page, ordered by `createdAt` descending then `id` ascending, BR-M04-31) with columns [checkbox] "#" "Soalan" "Subjek" "Tahap" "Kesukaran" "Status" "Tindakan" (header text upper-cased by CSS). | 1.1.11 | US-01; AC-01.4 |
| FR-M04-08 | The "Soalan" cell SHALL show text truncated to 80 chars + "...", the DSKP badge as icon + text (`fa-check-circle` "DSKP" green / `fa-book-open` "Latihan Tambahan"; no "✓"/"📖" characters), the compliance badge (code upper case, `_` → space, DV-M04-08), "AI Verified" when `aiVerified`, and "Source: {SOURCETYPE}" (upper case, `_` → space, "TIADA" when `sourceType` is null) followed by the `sourceFile` line only when a file exists. | 1.1.12 | US-01, US-03; AC-01.5, AC-03.3 |
| FR-M04-09 | Other cells: "Subjek" = fixed indigo `fa-book` icon + subject name as plain text (no pill, same icon for every subject), level name, 5 stars (first `difficultyLevel` filled), status pill (BR-M04-02 labels; archived "Arkib", slate) and "ACTIVE"/"INACTIVE" (red). | 1.1.13 | US-01; AC-01.6 |
| FR-M04-10 | S1 SHALL render the shared Laravel-style pager (§8.1): ≥640px "Showing {from} to {to} of {total} results" + window (1–10, "...", last two, or the sliding window around the current page) + chevrons with aria "&laquo; Previous" / "Next &raquo;" and "Go to page {n}"; <640px "« Previous" / "Next »" (plain text when unavailable); links keep every active filter; at 640–1023px the link strip wraps and never overflows (DV-M04-09). | 1.1.16, 1.1.17 | US-01, US-30; AC-01.7, AC-30.2 |
| FR-M04-11 | With no matching rows S1 SHALL hide table and pager and show the empty block (`fa-inbox`, "Tiada soalan dijumpai", indigo text link `fa-plus` "Tambah Soalan Pertama" → create). | 1.1.18 | US-03; AC-03.5 |
| FR-M04-12 | Ticking rows SHALL keep `selectedIds`; the header checkbox SHALL tick/untick all rows of the page; the bulk bar SHALL show only while `selectedIds.length > 0` with "{n} soalan dipilih". | 1.1.10, 1.1.11 | US-04; AC-04.1, AC-04.2 |
| FR-M04-13 | The bulk `action` select SHALL carry native `required` (form without `novalidate`): pressing "Laksanakan" with no action shows the browser's native bubble and sends nothing, with no dialog (the script alert "Sila pilih tindakan terlebih dahulu" is unreachable and SHALL NOT be shown). With an action, `confirm('Adakah anda pasti mahu {verb} {n} soalan?')` (verbs meluluskan/menolak/mengarkibkan/memadamkan) and `POST /api/questions/bulk-action` only on OK. | 1.1.10 | US-04; AC-04.3, AC-04.4 |
| FR-M04-14 | Bulk result (INFERRED): statuses updated or rows deleted (BR-M04-01), list reloaded with the same query, success flash (§8, UNVERIFIED COPY), selection cleared. | 1.1.20 | US-04; AC-04.5 |
| FR-M04-15 | Row actions `fa-eye` (title "Lihat") and `fa-edit` (title "Edit") SHALL link to S3 and S4. | 1.1.14 | US-05; AC-05.1 |
| FR-M04-16 | Row `fa-trash` (title "Padam") SHALL `confirm('Adakah anda pasti mahu memadamkan soalan ini?')` and on OK call `DELETE /api/questions/:id`, then reload with flash (INFERRED). | 1.1.15, 1.1.20 | US-05; AC-05.2, AC-05.3 |
| FR-M04-17 | S2 SHALL render the back link, h1 "✨ Tambah Soalan Baru", subtitle, and card "Maklumat Soalan" with "Subjek *" and "Tahap Pendidikan *" (native `required`) and the DSKP block; shell header per DV-M04-02. | 1.2.1, 1.2.2 | US-06; AC-06.1, AC-06.2 |
| FR-M04-18 | "Tahap Kesukaran *" SHALL be 5 radio cards (value 1–5, labels Sangat Mudah, Mudah, Sederhana, Sukar, Sangat Sukar with 1–5 stars), `required`, none checked. | 1.2.3 | US-06; AC-06.2 |
| FR-M04-19 | "Teks Soalan *" SHALL be a 4-row `required` textarea with placeholder "Masukkan teks soalan di sini..." and hint "Minimum 10 aksara". | 1.2.5 | US-06; AC-06.2 |
| FR-M04-20 | The question image picker SHALL accept `image/jpeg,image/png,image/webp`, show a FileReader preview with a `fa-times` remove button that clears the input, and restore the prompt ("Klik untuk muat naik gambar" / "JPG, PNG, WebP — Maks 2MB") after removal. | 1.2.6 | US-06; AC-06.3 |
| FR-M04-21 | Card "Maklumat Tambahan" SHALL render "Penjelasan", "Bahasa" (`bm` default, `en`), "Nilai Mata" (number, default 1, min 1) with the exact hints, then "Batal" (→ S1) and "Simpan Soalan". | 1.2.11, 1.2.12 | US-06; AC-06.4 |
| FR-M04-22 | Submission SHALL be blocked by native `required` validation for Subjek, Tahap Pendidikan, Tahap Kesukaran, Teks Soalan and — only when the type is MCQ — `options[]` ×4 and `correct_answer`. No other client checks exist (as live). | 1.2.2, 1.2.3, 1.2.5, 1.2.7 | US-06; AC-06.5 |
| FR-M04-23 | Save (INFERRED): `POST /api/questions` validates per §5; on success S1 opens with flash and the new question first (status per BR-M04-09); on `VALIDATION_ERROR` the form keeps input and shows each field message under its field. | 1.2.13 | US-06; AC-06.6 |
| FR-M04-24 | "Jenis Soalan *" SHALL switch the answer card with `x-show` semantics: hidden cards keep their values and every field is posted; the server keeps only the fields of the chosen type (BR-M04-08). | 1.2.4 | US-07; AC-07.5 |
| FR-M04-25 | MCQ card per FN-M04-1.2.7: 4 fixed rows A–D, radio `correct_answer` 0–3 with A checked, `options[]`, option image pickers (preview/remove), the "Nota:" info box. | 1.2.7 | US-07; AC-07.1 |
| FR-M04-26 | True/false card per FN-M04-1.2.8 (`tf_answer` true/false, no default, not required). | 1.2.8 | US-07; AC-07.2 |
| FR-M04-27 | Short-answer / fill-blank card per FN-M04-1.2.9, heading "Jawapan Pendek" or "Jawapan Isi Tempat Kosong" by type. | 1.2.9 | US-07; AC-07.3 |
| FR-M04-28 | Essay card per FN-M04-1.2.10. | 1.2.10 | US-07; AC-07.4 |
| FR-M04-29 | The 36×36px keyboard toggle SHALL sit bottom-left inside the S2 "Teks Soalan" textarea only; it toggles the panel (blue active state while open). Opening sets `dir="rtl"` and font-family `'Scheherazade New', 'Lateef', serif` on the textarea (kept after closing) and shows the panel in "عربي" mode with caption "Papan Kekunci Arab". | 1.3.1, 1.3.2, 1.3.7 | US-08; AC-08.1, AC-08.2 |
| FR-M04-30 | The panel SHALL render the Arab rows; in "جاوي" mode (caption "Papan Kekunci Jawi") the Jawi letters are inserted within the rows at the live positions (row 1 ض ص ث ق ف ڤ غ ڠ ع ه خ ح چ ج د; row 2 ش س ي ب ل ا ت ن ڽ م ك ݢ ط; row 3 ئ ء ؤ ر لا ى و ۏ ز ظ); the 9 harakat keys with their titles; "SPACE", "ال", "ة", backspace, newline. Mode buttons tint blue (Arab) / emerald (Jawi) when active. | 1.3.2, 1.3.3, 1.3.4, 1.3.5 | US-08; AC-08.2, AC-08.3 |
| FR-M04-31 | A key SHALL insert its character at the caret (replacing a selection), backspace SHALL delete one character before the caret, newline SHALL insert "\n"; keys use `mousedown.prevent` so focus stays in the textarea; the textarea `input` event fires so the value is bound. | 1.3.7 | US-08; AC-08.4 |
| FR-M04-32 | Esc, the toggle and `fa-times` (32×32px) SHALL close the panel; <640px it is a bottom sheet with a backdrop that closes on tap; ≥640px a 580px panel placed below the textarea, or above it when `rect.bottom + 8 + 360 > innerHeight`, clamped horizontally inside the viewport (8px / 12px). Keys are 44px high. | 1.3.6, 1.3.7 | US-08; AC-08.5 |
| FR-M04-33 | When Subjek and Tahap are both set and either changes, S2/S4 SHALL reset Bidang/SK/SP and their lists and load Bidang from `GET /api/guru/dskp/bidang` (M10 #39), listing "-- Pilih Bidang --" + "{code} - {name}" (name alone when `code` is empty). When either is cleared, only the Bidang list is emptied (as live, AUD-M04-02): `bidangId`, `skId`, `spId`, the SK and SP lists and their enabled state are kept, "DSKP tagged" stays, and the old `dskp_sp_id` is still posted. | 1.4.1, 6.3.3 | US-09; AC-09.1, AC-09.6 |
| FR-M04-34 | SK SHALL be disabled until a Bidang is chosen, SP until an SK is chosen; each choice loads the next list and resets the lower ones; choosing an SP shows `fa-check-circle` "DSKP tagged" and posts `dskp_sp_id`. | 1.4.2, 1.4.3 | US-09; AC-09.2, AC-09.3 |
| FR-M04-35 | S4 SHALL preload the saved Bidang/SK/SP, load the three lists in sequence, and **show** each saved value as selected, posting the saved SP (DV-M04-15; live shows placeholders and posts `dskp_sp_id=""`); a saved id absent from its new parent list is cleared. | 1.4.4 | US-09; AC-09.4 |
| FR-M04-36 | S4 SHALL show `fa-times` "Buang tag DSKP" whenever `bidangId` is set (DV-M04-06); it resets the three selects and lists; saving then stores `dskpSpId = null`. | 1.4.5 | US-09; AC-09.5 |
| FR-M04-37 | S3 SHALL render the back link, h1 "📝 Detail Soalan", "Soalan #{id}", "Edit" → S4 and "Padam" (form with `confirm('Adakah anda pasti mahu memadamkan soalan ini?')` → delete → S1 with flash, INFERRED); shell header per DV-M04-02. | 1.5.1 | US-10; AC-10.1 |
| FR-M04-38 | S3 SHALL render card "Soalan" (status pill: approved "Diluluskan", archived "Diarkibkan", PKSK `pending` "Menunggu", others BR-M04-02) with full text, and for MCQ card "Pilihan Jawapan" with bubbles A–D, the correct option green-tinted + `fa-check-circle` "Jawapan Betul". | 1.5.2, 1.5.3 | US-10; AC-10.2 |
| FR-M04-39 | Card "Penjelasan" SHALL render only when `explanation` is non-empty. | 1.5.4 | US-10; AC-10.3 |
| FR-M04-40 | Sidebar "Maklumat" SHALL render the 7 label/value rows of FN-M04-1.5.5 (labels upper-cased by CSS); DSKP lines truncated with "..." (Bidang name, "SK code - description", "SP code - description"), or "Belum ditag"; date `dd/mm/yyyy HH:mm` (Asia/Kuala_Lumpur). | 1.5.5 | US-10; AC-10.4 |
| FR-M04-41 | When `usage.attempts = 0` the card "Soalan Baharu" / "Soalan ini belum digunakan dalam sebarang kuiz atau latihan." SHALL show; otherwise (INFERRED) a statistics card with "Jumlah Cubaan", "Jawapan Betul", "Kadar Betul" (UNVERIFIED COPY). | 1.5.6, 1.5.7 | US-10; AC-10.5 |
| FR-M04-42 | (INFERRED) For `draft` and `pending_review` questions S3 SHALL show status buttons in the "Quick Actions" slot ("Hantar untuk Semakan" for draft, "Luluskan" for draft/pending — UNVERIFIED COPY); each asks `confirm('Adakah anda pasti mahu mengubah status soalan ini?')` and posts `bulk-action` with `pending_review` / `approve` and `ids=[id]`, then reloads. | 1.5.8 | US-10; AC-10.6 |
| FR-M04-43 | (INFERRED) For non-MCQ types S3 SHALL replace "Pilihan Jawapan" with an answer card using the create-form headings: "Jawapan Betul / Salah" (Betul or Salah highlighted), "Jawapan Pendek"/"Jawapan Isi Tempat Kosong" (correct + alternatives), "Jawapan Contoh (Esei)" (model answer or "-"). | 1.5.9 | US-10; AC-10.7 |
| FR-M04-44 | Card "Penjelasan AI" SHALL render per FN-M04-1.6.1 with the empty state and "Jana Penjelasan AI" when `aiExplanation` is null. | 1.6.1 | US-11; AC-11.1 |
| FR-M04-45 | "Jana Penjelasan AI" SHALL hide the button, show the loading line, call `POST /api/questions/:id/ai-explanation` (mock latency 1.5 s), and on `{ok:true}` reload the page; the stored markdown renders with `.prose-ai` styles (headings, lists, tables, code). Content is canned (BR-M04-24, D4). | 1.6.2, 1.6.4 | US-11; AC-11.2, AC-11.3 |
| FR-M04-46 | On failure the card SHALL re-show the empty state (text and "Jana Penjelasan AI") beside the error box and set the error text exactly as the live script: the reply is parsed as JSON first; JSON with `message` (reply not ok or `ok` falsy) → `message`; JSON without `message` → "HTTP {status}" (also for HTTP 200 `{ok:false}`); non-JSON → the JSON-parse exception text; network failure → "Failed to fetch"; "Gagal jana penjelasan" only for an empty exception message. | 1.6.3 | US-11; AC-11.4 |
| FR-M04-47 | (INFERRED) When `aiExplanation` exists a regenerate button (`#btn-regen-penjelasan-ai`, label "Jana Semula" — UNVERIFIED COPY) SHALL ask `confirm('Jana semula Penjelasan AI? Versi lama akan ditimpa.')` and call the endpoint with `force=1`. | 1.6.5 | US-11; AC-11.5 |
| FR-M04-48 | S4 SHALL render back link (→ S3), h1 "✏️ Edit Soalan", "Kemaskini maklumat soalan #{id}", and the pre-filled fields of FN-M04-1.7.2–1.7.4, 1.7.7; no type select and no keyboard. | 1.7.1, 1.7.2, 1.7.3, 1.7.4, 1.7.7 | US-12; AC-12.1 |
| FR-M04-49 | For MCQ, S4 SHALL show the options card always, pre-filled, with `options[]` and `correct_answer` hard `required`. | 1.7.6 | US-12; AC-12.2 |
| FR-M04-50 | For other types, S4 SHALL show that type's card pre-filled with create's rules (DV-M04-05). | 1.7.9 | US-12; AC-12.3 |
| FR-M04-51 | Image fields: zone text "Tukar gambar" when a preview (new file) exists; remove sets `remove_question_image=1` / `remove_option_image_{i}=1`; choosing a new file resets the remove flag. | 1.7.5 | US-12; AC-12.4 |
| FR-M04-52 | "Batal" → S3; "Kemaskini Soalan" → `PUT /api/questions/:id`; success (INFERRED) → S3 with flash; validation errors as FR-M04-23. | 1.7.8, 1.7.10 | US-12; AC-12.5 |
| FR-M04-53 | S5 SHALL render the shell header, "Sejarah Import" (→ S5h, DV-M04-01) and "Kembali" (→ S1). | 2.1.1 | US-13; AC-13.1 |
| FR-M04-54 | S5 SHALL render the upload card (file `.csv,.txt` required, hint), "Tetapan Lalai (Opsional)" with defaults (difficulty preselected 2), the draft footer and "Mula Import". | 2.1.2, 2.1.3, 2.1.4 | US-13; AC-13.2, AC-13.4 |
| FR-M04-55 | S5 SHALL render cards "Muat Turun Template", "Format CSV" (required list with the DV-M04-07 suffix " (atau guna Tetapan Lalai)" — PROPOSED COPY — on `subject_id` and `education_level_id`) and "Tips". | 2.1.5, 2.1.6, 2.1.7 | US-13; AC-13.3 |
| FR-M04-56 | (INFERRED) "Mula Import" SHALL send the file to `POST /api/question-imports`; the mock parses per BR-M04-10, creates `draft` MCQ questions, records an ImportRun, and returns to S5 with the flash "Import selesai: {x} soalan diimport, {y} gagal." (UNVERIFIED COPY); files >5 MB or of another extension return `VALIDATION_ERROR` shown under "Fail CSV *". | 2.1.9 | US-13; AC-13.5 |
| FR-M04-57 | (INFERRED) "Download Template" SHALL download `template-import-soalan.csv` with the header row of AC-M04-13.6 and 2 sample rows (§6.12). | 2.1.10 | US-13; AC-13.6 |
| FR-M04-58 | S5h (DV-M04-01) SHALL be read-only: h1/header "Sejarah Import", link "Kembali" → S5, and a table of ImportRuns newest first ("Tarikh" `dd/mm/yyyy HH:mm`, "Fail", "Diimport", "Gagal") or "Tiada sejarah import."; no other actions. All five strings are PROPOSED COPY. | 2.1.8 | US-14; AC-14.1, AC-14.2 |
| FR-M04-59 | S6 SHALL render the header and the 4 KPI cards from `GET /api/question-quality`: "Jumlah Soalan" = Q-ALL, "Purata Skor" = mean score over Q-SCORED (one decimal), "Cemerlang (76-100)" = Q-SCORED ∧ bucket cemerlang, "Perlu Tindakan Aktif (≤ 50)" = Q-SCORED ∧ bucket le50 ∧ ¬legacy (§4.1); counts with separators. | 2.2.1 | US-15; AC-15.1 |
| FR-M04-60 | S6 SHALL render the 3 bucket cards (titles displayed upper case by CSS: "SKOR 51-75", "SKOR ≤ 50", "LEGACY GENERIC"; descriptions exact, the Legacy Generic text with literal backtick characters) and the "Taburan Kualiti" bar (segment width = share; label "{p}%" with one decimal on each non-empty segment, placed inside the segment, or just below the bar when the segment is narrower than 8 % — DV-M04-20; legend Cemerlang, Baik, Lemah, Kritikal). | 2.2.2, 2.2.3 | US-15; AC-15.2, AC-15.3 |
| FR-M04-61 | S6 SHALL render "Mengikut Subjek" (subjects with ≥1 question, sorted by average desc; Purata pill `bg-emerald-100 text-emerald-700` when ≥76, amber 51–75, red ≤50 — INFERRED thresholds; every live value is emerald) and "Mengikut Tingkatan" (11 levels in order, "{n} soalan · {avg}", bar width = avg %). | 2.2.4, 2.2.5 | US-15; AC-15.4 |
| FR-M04-62 | S6 SHALL render "Soalan Untuk Semakan Aktif" (non-legacy questions with score ≤ 50, id desc) with pill "{n} soalan" and rows "#{id}", text, subject, level, source set, score pill, `fa-edit` "Edit" → S4. | 2.2.6 | US-15; AC-15.5 |
| FR-M04-63 | "Jalankan Audit Semula" SHALL set `submitting` (button disabled, `fa-spinner fa-spin` "Sedang audit..."), call `POST /api/question-quality/audit` without confirm, then reload S6 with flash (INFERRED, BR-M04-22). | 2.2.7, 2.2.8 | US-16; AC-16.1, AC-16.2 |
| FR-M04-64 | The modal component (variant `mcq`) SHALL open from "Lapor Soalan" (`fa-flag`) with reasons and comment reset, h3 "Lapor Soalan", subtitle "Soalan ini akan dinyahaktifkan sementara", close `fa-times`. | 3.1.1, 3.1.3 | US-17; AC-17.1 |
| FR-M04-65 | Variant `mcq` SHALL list the 7 reason checkbox cards (value, label, description per URS FN-M04-3.1.4) bound to `reportReasons[]`; ticked tint per reason (wrong_answer red, confusing_question amber, wrong_options orange, typo indigo, other slate; missing_options and duplicate use the default ticked style — INFERRED). | 3.1.4 | US-17; AC-17.2 |
| FR-M04-66 | "Hantar Laporan" SHALL be disabled while `reportReasons.length === 0 || reportLoading`. | 3.1.7 | US-17; AC-17.3 |
| FR-M04-67 | "Komen Tambahan (pilihan)" SHALL be a 3-row textarea with `maxlength=500`, placeholder "Terangkan masalah soalan ini...", and a live counter "{length}/500". | 3.1.6 | US-17; AC-17.4 |
| FR-M04-68 | The modal SHALL close on "Batal", `fa-times`, backdrop click or Esc, without sending. | 3.1.3, 3.1.7 | US-17; AC-17.5 |
| FR-M04-69 | Submit SHALL set `reportLoading` ("Menghantar..." + spinner), call `POST /api/question-reports`, then show the submitted state ("Terima Kasih!", message from the response or "Laporan berjaya dihantar.", "Tutup"); on a network error the message is "Ralat. Sila cuba lagi.". | 3.1.8, 3.1.9 | US-17; AC-17.6 |
| FR-M04-70 | The mock SHALL save the report as `pending` and apply BR-M04-12 (MCQ inactive at once; structured inactive at the 3rd open report). | 3.1.9 | US-17, US-18; AC-17.7, AC-18.3 |
| FR-M04-71 | Variant `structured` SHALL open from the small "Lapor" button (title "Lapor soalan ini"), show subtitle "Soalan ini akan dinyahaktifkan selepas 3 laporan" and the 5 structured reasons, and post `question_type:'structured'`, `source:'structured_attempt'`. | 3.1.2, 3.1.5 | US-18; AC-18.1, AC-18.2 |
| FR-M04-72 | S7 SHALL render h1 `fa-flag` "Laporan Soalan", the subtitle and the 5 status tabs with live counts; default `pending`; active tab solid colour + white text. | 3.2.1, 3.2.2 | US-19; AC-19.1, AC-19.2 |
| FR-M04-73 | Each card SHALL render the badge row in order: status badge (BR-M04-14 "Dikeluarkan"), category badge (BR-M04-15), "Dinyahaktif", source-set badge, "Oleh: **{reporter}**", relative time (BR-M04-16), "Bilik: {roomCode}", "ID Soalan: {id}". The card border tint follows the status as in `reports-all-desktop.png` (pending amber, fixed and removed emerald, reviewed slate; dismissed INFERRED slate). | 3.2.3, 3.2.4, 3.2.5, 3.2.6, 3.2.7, 3.2.8 | US-19; AC-19.3, AC-19.4 |
| FR-M04-74 | Reason pills SHALL show one pill per stored reason using BR-M04-15 labels (DV-M04-08). | 3.2.9 | US-19; AC-19.7 |
| FR-M04-75 | The question block SHALL render per FN-M04-3.2.10 (structured stimulus vs MCQ text + 2-column options with the correct one green + `fa-check`; "{Subjek} — {Tingkatan}", "Compliance: {code}"; "Soalan tidak dijumpai" when the question no longer exists). | 3.2.10 | US-19; AC-19.5 |
| FR-M04-76 | "Komen pelajar:" and "Status tindakan admin:" blocks SHALL render only when the value is non-empty. | 3.2.11, 3.2.12 | US-19; AC-19.6 |
| FR-M04-77 | The action column SHALL render only for `pending` and `reviewed` reports: notes textarea (pre-filled), "Tandakan Selesai", "Tolak & Aktifkan Semula", the question link (structured → S9 "Lihat Soalan Struktur #{id}"; MCQ → S4 "Edit Soalan #{id}"), "Buka Soalan Sama" (`target=_blank`; URLs per FN-M04-3.2.17, MCQ code = subject code, BR-M04-17) and "Nyahaktif Segera" only while the question is active. | 3.2.13, 3.2.14, 3.2.15, 3.2.16, 3.2.17 | US-19; AC-19.8 |
| FR-M04-78 | Empty tab: `fa-check-double` "Tiada laporan buat masa ini"; an unknown `status` shows the same block and no tab is active. | 3.2.18 | US-19; AC-19.9 |
| FR-M04-79 | "Tandakan Selesai" SHALL call `PATCH /api/question-reports/:id` `{status:'fixed', adminNotes}` without confirm; reload on the same tab with flash; counts recomputed. | 3.2.13, 3.2.19 | US-20; AC-20.1, AC-20.4 |
| FR-M04-80 | "Tolak & Aktifkan Semula" SHALL send `{status:'dismissed', adminNotes:'Soalan dan jawapan disemak — tiada masalah', reactivate:true}` without confirm; the question becomes active. | 3.2.14, 3.2.19 | US-20; AC-20.2 |
| FR-M04-81 | "Nyahaktif Segera" SHALL send `{status:'reviewed', adminNotes:'Dinyahaktifkan segera oleh admin', forceDeactivate:true}` without confirm; the question becomes inactive. | 3.2.15, 3.2.19 | US-20; AC-20.3 |
| FR-M04-82 | S13 SHALL render the header, the 5 counters from `GET /api/question-reports/mine` (`meta.counts`), the empty state when the user has none, and (INFERRED) one row per report: "Soalan #{id}" / "Soalan Struktur #{id}", reason pills, status badge (labels as S7), "Status tindakan admin:" note, relative time — UNVERIFIED COPY; only the caller's reports. | 3.3.1, 3.3.2, 3.3.3, 6.3.2 | US-21; AC-21.1, AC-21.2, AC-21.3 |
| FR-M04-83 | S8 SHALL render h1, subtitle, "Tambah Soalan" → `/guru/soalan-berstruktur/cipta`, the two stat cards ("Jumlah Soalan" = Q-STRUCT-ALL, "Published" = Q-STRUCT-ALL ∧ published) and the subject pills (Q-STRUCT-ALL(subject), alphabetical, count ≥1) (§4.1). | 4.1.1, 4.1.2, 4.1.3 | US-22; AC-22.1 |
| FR-M04-84 | S8 filter SHALL list subjects alphabetically, levels in order, KBAT options, submit "Cari"; "Reset" shows when any filter is set. | 4.1.4 | US-22; AC-22.2 |
| FR-M04-85 | S8 table SHALL show 25 rows (BR-M04-26 order) with the FN-M04-4.1.5 columns (KBAT pill "L{n}" for any value 1–6), hiding Subjek/Tgk/Markah below 640px and Sub-Q below 768px. | 4.1.5 | US-22; AC-22.3 |
| FR-M04-86 | S8 SHALL render the Malay counter "Menunjukkan {from}–{to} daripada {n} soalan" and the shared pager (FR-M04-10 rules, DV-M04-09). | 4.1.6, 4.1.7, 4.1.8 | US-22, US-30; AC-22.4, AC-30.2 |
| FR-M04-87 | With no rows S8 SHALL render one table row "Tiada soalan berstruktur ditemui" and the counter "Menunjukkan 0 daripada 0 soalan" (DV-M04-12, PROPOSED COPY), no pager. | 4.1.9, 4.1.6 | US-22; AC-22.5 |
| FR-M04-88 | S9 SHALL render the back link, header pills, "ID: #{id}", the stimulus box (label displayed "STIMULUS / KONTEKS SOALAN" by CSS; text `white-space: pre-line`) and the meta line (date `dd Mon yyyy`, English month abbreviations as live e.g. "08 Apr 2026", "20 May 2026"). | 4.2.1, 4.2.2, 4.2.3, 4.2.4 | US-23; AC-23.1 |
| FR-M04-89 | S9 SHALL render "Bahagian Soalan ({n} sub-soalan)" and one card per sub-question (label, text, "{m}m", box "JAWAPAN MODEL" (CSS upper case) with pre-line answer). | 4.2.5 | US-23; AC-23.2 |
| FR-M04-90 | S9 actions: "Edit Soalan" → `/guru/soalan-berstruktur/{id}/edit`, "Balik ke Senarai" → S8. | 4.2.6 | US-23; AC-23.3 |
| FR-M04-91 | S10 SHALL render the header and the 4 counters (all, pending, processing, done). | 5.1.1 | US-24; AC-24.1 |
| FR-M04-92 | S10 filter SHALL filter by `status`; "Reset" shows when filtered; no rows → "Tiada rekod ditemui". | 5.1.2, 5.1.7 | US-24; AC-24.2 |
| FR-M04-93 | S10 rows SHALL render per FN-M04-5.1.3–5.1.5 (date "dd Mon yyyy" + "HH:mm"; status pills: done `fa-check-circle` "Selesai" green, processing `fa-cogs` "Processing" blue, pending `fa-clock` "Pending" amber and rejected `fa-times-circle` "Ditolak" red — last two INFERRED); file links call `GET /api/question-submissions/:id/files/:index` (mock returns a placeholder blob with the file name). | 5.1.3, 5.1.4, 5.1.5 | US-24; AC-24.3 |
| FR-M04-94 | "Kemaskini" SHALL toggle the inline panel; "Simpan" SHALL `PATCH /api/question-submissions/:id/status` `{status, adminNotes}` (no confirm) and reload with flash (INFERRED). | 5.1.6, 5.1.8 | US-24; AC-24.4, AC-24.5 |
| FR-M04-95 | S11 SHALL render the header, the 3 stat cards (labels displayed upper case by CSS; each = Q-FLAGGED-MCQ / Q-FLAGGED-STR under the active filters, "Jumlah" = their sum — DV-M04-11, §4.1) and the card "MCQ PERLU GAMBAR MENGIKUT MATA PELAJARAN" with the top-10 subject pills, global under every filter (as live). | 5.2.1, 5.2.2 | US-25; AC-25.1, AC-25.2 |
| FR-M04-96 | S11 filter SHALL offer subjects (alphabetical) and every school of the M02 fixture (alphabetical); `subject_id` filters both lists, `school_id` filters the MCQ list only (as live). | 5.2.3 | US-25; AC-25.2 |
| FR-M04-97 | S11 MCQ section SHALL render "MCQ ({n})", cards per FN-M04-5.2.5, 20 per page with `mcq_page`; its pager links keep `subject_id`/`school_id` (DV-M04-16) and drop `str_page`; the whole section is omitted when n = 0 (as live). | 5.2.4, 5.2.5, 5.2.8 | US-25; AC-25.3, AC-25.5 |
| FR-M04-98 | S11 Struktur section SHALL render "Struktur ({n})" with text cut at 400 chars and its own pager (`str_page`; links keep `subject_id`/`school_id` per DV-M04-16 and drop `mcq_page`), and be omitted when n = 0. | 5.2.9 | US-25; AC-25.4, AC-25.5 |
| FR-M04-99 | When both counts are 0 S11 SHALL show "Semua soalan sudah lengkap dengan gambar rajah!". | 5.2.10 | US-25; AC-25.6 |
| FR-M04-100 | The upload form SHALL require a file (`accept="image/*"`) and call `POST /api/diagram-audit/:kind/:id/image` (no confirm); success clears the flag and reloads with flash (INFERRED). | 5.2.6, 5.2.11 | US-26; AC-26.1, AC-26.2 |
| FR-M04-101 | "Dismiss" SHALL call `POST /api/diagram-audit/:kind/:id/dismiss` (no confirm); success clears the flag and reloads with flash (INFERRED). | 5.2.7, 5.2.11 | US-26; AC-26.3 |
| FR-M04-102 | S12 SHALL render (user-portal shell) the dark header card with a white h1 (DV-M04-14) and the summary line, the 3 tabs (default flagged; active tab dark pill) and "Tiada nota dalam tab ini." when empty. | 5.3.1, 5.3.2, 5.3.3 | US-27; AC-27.1, AC-27.2 |
| FR-M04-103 | S12 rows SHALL render per FN-M04-5.3.4–5.3.5, 15 per page, and the shared pager keeping `tab`. | 5.3.4, 5.3.5, 5.3.7 | US-27; AC-27.3 |
| FR-M04-104 | Row buttons SHALL, on click, disable themselves and call `POST /api/master-notes/:id/{approve|regen|unflag}` at once (no confirm): label "..." while pending; HTTP 2xx → row `opacity: .5`, clicked button "Done" and still disabled; non-2xx → label restored and button re-enabled. The response body is not read. | 5.3.6 | US-27; AC-27.4 |
| FR-M04-105 | The mock SHALL apply BR-M04-23 so that a reload shows the updated tabs, summary counts and (regen) the canned note. | 5.3.8 | US-27; AC-27.5 |
| FR-M04-106 | The admin shell SHALL provide the "SOALAN" sidebar group, the mobile bottom-nav "Soalan" item and the "Lagi" › "Soalan" section per FN-M04-6.1.1–6.1.3, with the active item per DV-M04-02. | 6.1.1, 6.1.2, 6.1.3 | US-28; AC-28.1, AC-28.2 |
| FR-M04-107 | Each M04 route SHALL declare its shell header title (URS §1; shell rule DV-SH-03: title from the route) with **no subtitle** on S1–S4, S5h, S7–S9 and S12; S5, S6, S10, S11 and S13 keep their live title and subtitle; no fallback "Dashboard" title is shown (DV-M04-02). | 6.1.4, 6.2.5 | US-28; AC-28.3 |
| FR-M04-108 | The user-portal shell SHALL provide the four M04 entries of FN-M04-6.2.1–6.2.4; the "Gambar Rajah" badge = Q-FLAGGED-MCQ unfiltered (§4.1), red, `ms-MY` separators. | 6.2.1, 6.2.2, 6.2.3, 6.2.4 | US-28; AC-28.4 |
| FR-M04-109 | Route guards: `/admin/*` M04 routes require role `admin`; guest → `/login`; other roles → their landing page (M01 BR, INFERRED); `/laporan-soalan` requires any logged-in user. Mock endpoints return `UNAUTHORIZED`/`FORBIDDEN` likewise. | 6.3.1, 6.3.2 | US-29; AC-29.1, AC-29.2 |
| FR-M04-110 | All counts SHALL be read from the D11 datasets (allocation table + change overlay, BR-M04-34) per BR-M04-20; no count is stored separately (DV-M04-04). | 6.3.4 | US-29; AC-29.3 |
| FR-M04-111 | Every M04 screen SHALL meet NFR-RESP-01…10 as specified per screen in §10 (incl. DV-M04-09 S1 column min width 240px). | all screen FNs | US-30; AC-30.1, AC-30.3, AC-30.4, AC-30.5 |
| FR-M04-112 | Subject and level lists and the Teras grouping SHALL come from the M03 lookups `GET /api/subjects` (`isCore`, integer ids) and `GET /api/education-levels` (integer ids); M04 keeps no copy of them (S1/S2/S4/S5 selects in id order, S8/S11 subject selects alphabetical). | 6.3.5 | US-29; AC-29.4 |
| FR-M04-113 | The store contract (§7.1) SHALL expose the SPM objective pool as the named query Q-SPM-POOL (§4.1, BR-M04-32): rows with the facet `spmPool = true` that are `mcq`, `educationLevelId` ∈ {10, 11} and eligible (BR-M04-03), PKSK excluded. The default dataset reproduces the observed M06 pool sizes (Σ 21,033; e.g. MATH 1,681; Bahasa Arab 0). Rows created or imported at runtime at T4/T5 in an SPM subject get `spmPool = true` (BR-M04-09/10), so an approved one joins the pool at once; a deactivated one leaves it through eligibility. | 6.3.6 | US-31; AC-31.1, AC-31.2 |
| FR-M04-114 | Every question the store hands to a practice consumer (M05 drill, chapter, revision; M06 pools and `question_id` single-question sessions) SHALL be eligible under BR-M04-03; `getEligible(id)` returns `null` for an ineligible or unknown id so the host applies its fallback; "Buka Soalan Sama" links are rendered for every report card as live and resolve through this call. | 6.3.7, 3.2.17 | US-31; AC-31.3, AC-31.4 |
| FR-M04-115 | The structured store SHALL expose to M05/M06 practice Q-STRUCT-VISIBLE (§4.1: published, active T4/T5 structured questions; 4,059 in the default dataset), filterable by subject and `kbatLevel` 1–6; S8 keeps counting Q-STRUCT-ALL (4,064) (BR-M04-20). | 6.3.7 | US-31; AC-31.5 |
| FR-M04-116 | Rows with `pkskDomainId ≠ null` (Q-PKSK) SHALL be excluded from `GET /api/questions`, `/summary`, every S1 filter, tile and total, S6, S11 and every other §4.1 query except Q-PKSK and Q-DIFFICULTY (BR-M04-33). | 1.1.19 | US-32; AC-32.1 |
| FR-M04-117 | `GET /api/questions/:id` and S3 SHALL serve PKSK rows: text, `pkskOptions` (0–6, each correct one marked "Jawapan Betul"; no options card when empty), status pill (`pending` "Menunggu"), "-" for Subjek and Tahap Pendidikan (INFERRED layout); the edit form (S4) is not offered for PKSK rows (M07 edits them). | 1.5.10 | US-32; AC-32.2, AC-32.3 |
| FR-M04-118 | `ReportQuestionModal` SHALL accept the props of §2 S14: the request `source` = prop value (default per variant), network failure text = `failureText`, ticked colours = `tints`; without the new props it behaves exactly as live. The modal is controlled by `open` / `update:open` (v-model) and emits `reported {ok, message}`; hosts own the trigger button (v1.19). | 6.3.8, 3.1.9 | US-17; AC-17.8, AC-17.9 |
| FR-M04-119 | The mock repository SHALL implement the D11 datasets of §6.11: `countWhere(filter)` from the allocation table plus the overlay, and `count(name, ...params)` for the §4.1 named queries; `page(filter, page)` generating rows on demand by id; anchors (observed, coverage and other modules' fixtures) replace one generated row of their allocation cell. | 6.3.4 | US-29; AC-29.3 |
| FR-M04-120 | M04 content text SHALL never render below 12px at any width (DV-M04-17); live sizes below 12px are raised to 12px, nothing else changes. | 1.1.12, 3.2.3 | US-30; AC-30.6 |
| FR-M04-121 | The store SHALL offer the teacher write contract of BR-M04-35 (`questions.createFromTeacher`, `updateOwn`, `deleteOwn`, `importFromTeacher`), used only by M10 with a teacher (or admin) session: new rows `pending_review`, `isActive = true`, `createdBy` = viewer, ids ≥ 9,000,001, with `curriculumChapterId`, `curriculumTopicId`, `scriptType`, `textDirection`; they appear in S1 under "Menunggu Semakan" and become eligible for practice when an admin approves them (S1 bulk "Luluskan" or S3 quick action). | 6.3.9 | US-33; AC-33.1, AC-33.2 |
| FR-M04-122 | The structured store SHALL offer `structured.create`, `update`, `delete` and `toggleStatus` (BR-M04-36) with the DATA-M04-02/03 fields; created rows get ids ≥ 9,000,001 and count in Q-STRUCT-ALL (and, when published and active at T4/T5, in Q-STRUCT-VISIBLE). | 6.3.10 | US-33; AC-33.3 |
| FR-M04-123 | The store SHALL answer Q-CONTRIB(user) and Q-TEACHER-DATABANK(subject) (§4.1) from the facets `createdBy` and `teacherDatabank`: admin (user 1) 16,817 approved rows with the M10 subject split; Bahasa Melayu databank 6,048 (mcq 5,918, essay 105, other 25). | 6.3.11 | US-33; AC-33.4, AC-33.5 |
| FR-M04-124 | `POST /api/question-reports` SHALL accept `source: 'teacher_databank'` and the MCQ reason `outdated` "Soalan sudah tidak relevan" (category "Lain-lain"), and respond `{success: true, message}`. | 6.3.11 | US-33; AC-33.6 |
| FR-M04-125 | The store SHALL answer Q-SP-AVAILABLE(sp) = Q-ELIGIBLE rows with that `dskpSpId` (and the SP's level when known); generated `dskpTagged` rows point only to SPs of the M10 DSKP store. | 6.3.11 | US-33; AC-33.7 |
| FR-M04-126 | `questions.get` SHALL return `chapterLabel` (anchors only; null on generated rows) and `curriculumTopicId` with its M03 topic, so M11 can group by the observed label while M03 keeps 1,251 chapters. | 6.3.11 | US-33; AC-33.8 |
| FR-M04-127 | The store SHALL hold the `jutawanQuestions` store of BR-M04-37 (DATA-M04-12, §6.13.4) and answer `questions.jutawan.count(subjectId, level)` = Q-JUT-COUNT (the 143 observed cells, Σ 149,911; 0 for every other pair), `questions.jutawan.sample({subjectId, level, difficulty?}, n, rng)` (rows without keys, no repeats), `questions.jutawan.get(id)` and `questions.jutawan.gradeAnswer(id, optionId)`. The rows never appear in Q-ALL, any other §4.1 query or any M04 screen. | 6.3.12 | US-34; AC-34.1, AC-34.2 |
| FR-M04-128 | The store SHALL answer Q-M17-COV (Q-ACTIVE ∧ ¬`coverageExcluded` ∧ level ≠ null; 127,643 with the S10 cells of §6.13 Table A), Q-TEACHER-CONTRIB (11,414; per school and, v1.15, per teacher through `questions.teacherContributions({teacherId})`) and the ImportRun queries Q-IMPORT-RUNS (1,123) / Q-IMPORTED (31,101) / Q-IMPORT-MONTH(month) (0 for August and September 2026), and return the M18 critical-question anchors 701001–701099 through `questions.get`. | 6.3.13 | US-34; AC-34.3, AC-34.4, AC-34.5 |


## 4. Business rules

| ID | Rule | Source |
|---|---|---|
| BR-M04-01 | Question `status` ∈ `draft`, `pending_review`, `approved`, `rejected`, `archived`, plus `pending` used only by PKSK rows (M07 BR-M07-02). Bulk "Luluskan" → `approved`, "Tolak" → `rejected`, "Arkibkan" → `archived`, "Padam" → deleted; S3 quick actions → `pending_review` or `approved`. Any status may move to any of these (no guard is visible). Delete is permanent (no soft delete visible). | OBSERVED (actions) / INFERRED (guards, delete) |
| BR-M04-02 | Status labels: filter/S3 `draft` "Draf", `pending_review` "Menunggu Semakan", `approved` "Diluluskan", `rejected` "Ditolak", `archived` "Diarkibkan", PKSK `pending` "Menunggu"; the S1 pill shows "Arkib" for archived and the filter label otherwise. | OBSERVED (approved, archived; `pending` label from M07) / INFERRED (others on S1) |
| BR-M04-03 | Eligibility (everywhere, D12): `isActive` is independent of `status`; only questions with `status = approved` and `isActive = true` are served to any practice consumer — M05 drills, chapter mode and revision, M06 pools and single-question (`question_id`) sessions, M07 student pages (PKSK rows only). MCQ practice (M05 quizzes, M06 pools) also requires `questionType = mcq`, so the non-MCQ rows of the BM teacher databank (XL2-10) are eligible (Q-ELIGIBLE) but never drawn into an MCQ quiz. Inactive (incl. report-deactivated) and non-approved questions are excluded until reactivated/approved. Structured questions: `status = published` and `isActive = true`. Live samples: quarantined questions are archived and inactive. | OBSERVED (flags) / INFERRED (practice rule) |
| BR-M04-04 | `compliance_filter`: `verified`, `pending_mapping`, `quarantined`, `rejected`, `draft` match `complianceStatus`; `missing_source` matches `sourceFile = null`; `verified_generated` matches `aiVerified = true`. | OBSERVED (option values, result sizes) / INFERRED (field mapping) |
| BR-M04-05 | `source_filter` matches `sourceType` (`textbook`, `dskp`, `trial`, `marking_scheme`); `ai_generated` and null exist as data but are not filter options. | OBSERVED |
| BR-M04-06 | `dskp_filter=tagged` ⇔ `dskpSpId ≠ null`; `untagged` ⇔ null. The row badge follows the same test. | OBSERVED |
| BR-M04-07 | `search` is a case-insensitive substring match on `questionText`. | INFERRED |
| BR-M04-08 | A question stores only the answer fields of its type: MCQ `options[4]`, `correctAnswer` 0–3, `optionImages[4]`; `true_false` `tfAnswer` (boolean, may be null); `short_answer`/`fill_blank` `correctAnswerText`, `altAnswers` (comma list, trimmed, empty items dropped); `essay` `modelAnswer`; PKSK rows `pkskOptions` (0–6 `{text, isCorrect}`, any number correct) with `options`/`correctAnswer` null. | OBSERVED (form) / INFERRED (storage) |
| BR-M04-09 | A question created on S2 is saved `approved`, `isActive = true`, `complianceStatus = draft`, `sourceType = null`, `aiVerified = false`, `needsDiagram = false`, `qualityScore = null` (not scored until the next audit), `spmPool` = true when the level is Tingkatan 4/5 and the subject has an M06 pool (BR-M04-32, INFERRED), id from the runtime range ≥ 9,000,001 (§6.13), `createdBy` = the admin (OQ-2). | INFERRED |
| BR-M04-10 | CSV import: UTF-8; first row = header; comma separator; `"` quoting (doubled `""` inside quotes); columns per URS FN-M04-2.1.6; `correct_answer` letter A–D (case-insensitive) → index 0–3; `option_c`/`option_d` may be empty (stored as ""); `difficulty_level` (1–5) from the column, else the default (preset 2 on the form); if neither is given the row fails; `marks` → `pointsValue` (default 1); `subject_id`/`education_level_id` from the column or the default (DV-M04-07). Each valid row → MCQ, `status = draft`, `isActive = true`, `complianceStatus = draft`, `spmPool` per BR-M04-32 (joins the pool only once approved), ids from the runtime range ≥ 9,000,001. Invalid rows are skipped and counted as failed. | OBSERVED (copy) / INFERRED (parsing) |
| BR-M04-11 | A report is created `pending` with `reasons[]` (≥1 value from the variant's list), `comment` (≤500), `questionType` (`mcq` default, `structured`), `source` — `spm` (M06 quiz), `structured_attempt` (structured practice), `latihan` (M05 drill), `revision` (M05 S7, observed there), `teacher_databank` (M10 S28, SOURCE-DERIVED); legacy `quiz`, `papan_bijak` — optional `quizSessionId` and `roomCode`, `reporterId` = caller. | OBSERVED (request, M05 S7 source) / INFERRED (storage) |
| BR-M04-12 | Auto-deactivation: an MCQ report sets the question `isActive = false` at once; a structured question becomes inactive when it has ≥3 reports in `pending` or `reviewed`. A later "Tolak & Aktifkan Semula" reactivates it. | OBSERVED (modal copy) / INFERRED (enforcement) |
| BR-M04-13 | Report update: `status` ∈ `fixed`, `dismissed`, `reviewed`; `adminNotes` replaces the stored notes; `reactivate = true` sets the question active; `forceDeactivate = true` sets it inactive. Only `pending`/`reviewed` reports show actions. | OBSERVED (hidden fields) / INFERRED (result) |
| BR-M04-14 | Displayed report status: `fixed` + question exists + question inactive → "Dikeluarkan" (`fa-ban`, red); `fixed` otherwise → "Diperbaiki"; `pending` "Menunggu"; `reviewed` "Disemak"; `dismissed` "Ditolak". Tab counts use the stored status ("Dikeluarkan" counts under Diperbaiki). | OBSERVED (badges, counts 2/3/5/0/10) / INFERRED (derivation) |
| BR-M04-15 | Reason labels by question type — MCQ: `wrong_answer` "Jawapan tidak tepat", `confusing_question` "Soalan mengelirukan", `wrong_options` "Set jawapan tidak tepat", `missing_options` "Pilihan jawapan tidak lengkap", `duplicate` "Soalan berulang / pendua", `typo` "Kesalahan ejaan / taip", `other` "Lain-lain", `outdated` "Soalan sudah tidak relevan" (sent only from the M10 teacher databank; category "Lain-lain"); structured: `wrong_answer` "Skema jawapan tidak tepat", `confusing_question` "Soalan mengelirukan", `wrong_options` "Markah tidak adil", `typo` "Kesalahan ejaan / taip", `other` "Lain-lain"; legacy code `unclear` → "Soalan mengelirukan" (DV-M04-08). Stored reasons are always codes (one rule for every report, DV-M04-08); the pill label comes from the question type's set. Category badge from the **first** reason: `wrong_answer`, `wrong_options` → "Jawapan Salah"; `confusing_question`, `unclear` → "Tak Jelas"; anything else → "Lain-lain". | OBSERVED (labels, badges) / INFERRED (first-reason and non-listed mapping) |
| BR-M04-16 | Relative time uses Laravel `diffForHumans` in Malay: "{n} saat/minit/jam/hari/minggu/bulan/tahun yang lepas" (e.g. "2 minggu yang lepas"). | OBSERVED (samples) / INFERRED (units) |
| BR-M04-17 | "Buka Soalan Sama": structured → `/latihan-berstruktur/{id}/jawab?scope=spm`; MCQ → `/spm/latih-tubi/{subject.code}/quiz?question_id={id}&count=1` (M03 subject code, e.g. `MATH`, for a question of any level). The host serves the question when it is eligible (BR-M04-03) and applies its own fallback otherwise (M06 contract; INFERRED for non-T4/T5 questions). | OBSERVED (URLs) / INFERRED (host behaviour) |
| BR-M04-18 | Question-paper `status` ∈ `pending`, `processing`, `done`, `rejected`; any value may follow any other; `adminNotes` ≤1000. New uploads (M10) start `pending`. | OBSERVED (options, maxlength) / INFERRED (transitions) |
| BR-M04-19 | Diagram audit lists questions with `needsDiagram = true` (MCQ and structured separately, `id` desc, 20 per page). `subject_id` filters both lists; `school_id` filters the MCQ list only (matched against the school of the question's creator, INFERRED). Each list (heading and pager) is omitted when its count is 0; the empty message shows only when both are 0. Pager links keep `subject_id`/`school_id` (DV-M04-16) and drop the other list's page parameter. Stat cards = filtered list counts (DV-M04-11). Subject pills: top 10 subjects by MCQ count, global (no filter). Upload stores the image (MCQ: `questionImage`; structured: stimulus image) and sets `needsDiagram = false`; dismiss sets `needsDiagram = false` only. | OBSERVED (lists, filters, pagers, pills — audit AUD-M04-05) / INFERRED (effects, school link) |
| BR-M04-20 | Count definitions (D11 single source, DV-M04-04): every figure is a named query of §4.1 on one dataset, PKSK excluded unless stated. Admin screens: S1 "Jumlah", pager, S6 "Jumlah Soalan" = Q-ALL (465,278); tiles = Q-ALL(subject) / Q-APPROVED(subject); S6 tables = Q-SCORED (147,026). Student-facing figures (M01 login stat, M03 "Soalan", M05 cards and statistics) = Q-ELIGIBLE (128,989) / Q-ACTIVE (129,389) and their per-subject/level forms. Structured: S8 = all 4,064, student lists = published + active (4,059). S11 cards and SHU badge = flagged counts; S12 = 525 notes. | DV-M04-04 / D11 |
| BR-M04-21 | Quality: `qualityScore` 0–100 (null = not scored, excluded from averages and buckets); buckets Cemerlang 76–100, Baik 51–75, Lemah 26–50, Kritikal 0–25; "Perlu Tindakan Aktif (≤ 50)" = non-legacy questions with score ≤50; "Skor ≤ 50" card counts the same set; "Legacy Generic" = questions whose `sourceSet` is in the legacy list (`tracking_a_feed_20260308`, `spm_tracking_auto_seed_v1`) or `sourceType = ai_generated`; Purata Skor = mean of scored questions, 1 decimal; subject "Cemerlang" % = share of the subject's scored questions ≥76, rounded. | OBSERVED (labels, bucket bounds 76/51/50) / INFERRED (Lemah/Kritikal split, formulas) |
| BR-M04-22 | "Jalankan Audit Semula" (mock): re-derives every score with the fixture function `score(q)` of §6.12 and sets `lastAuditAt`; scores of the anchor questions are fixed so tests are stable. **As built (v1.17):** the audit scores only runtime-created rows (id ≥ 9,000,001); generated and anchor rows keep their observed scores, so the S6 figures stay pinned. | INFERRED |
| BR-M04-23 | Master notes: `approve` → `teacherApproved = true`, `flagged = false`; `unflag` → `flagged = false`; `regen` → replaces `noteText`, `trapText`, `tokens` with the next canned note and keeps flags. Summary line counts `flagged`, `teacherApproved` and all notes. 15 per page, `id` desc. | OBSERVED (endpoints, copy) / INFERRED (effects) |
| BR-M04-24 | AI explanation (simulated, D4): the mock returns `{ok:true}` after ~1.5 s and stores a canned markdown text built from the question (title "## Penjelasan", the correct answer, a short reasoning list and a 2-column table); `force` replaces an existing one; without `force` an existing explanation is returned unchanged. | OBSERVED (endpoint, reload) / INFERRED (content) |
| BR-M04-25 | DSKP: Bidang by (subject, level); SK by Bidang; SP by SK; ids are those of the M10 DSKP data set; a question stores only `dskpSpId` (SK and Bidang derived). | OBSERVED |
| BR-M04-26 | Structured list order: `createdAt` desc, ties by `id` asc (live page 1 shows 4454, 4455, 4456); 25 per page. | INFERRED from samples |
| BR-M04-27 | Structured `totalMarks` = sum of sub-question marks (3698: 2 + 4 + 4 = 10). Sub-question label = "{questionNumber}({LETTER})" when the question has a number, else the letter. | OBSERVED |
| BR-M04-28 | KBAT exists only on structured questions: `kbatLevel` 1–6 in the data (M05/M06 observed LOTS 1 … HOTS 6). Two live scales, both replicated: admin S8 filter 2 "Memahami (L2)", 3 "Mengaplikasi (L3)", 4 "Menganalisis (L4)", 5 "Menilai/Mencipta (L5)" (live admin label); student filters (M05/M06) "1. Mengingat" … "6. Mencipta". S9 label for 1 "Mengingat" and 6 "Mencipta" (INFERRED). Difficulty exists only on objective questions (1–5). | OBSERVED (both scales, data 1–6) / INFERRED (S9 labels 1, 6) |
| BR-M04-29 | Reports are listed newest first without pagination (all rows of the tab). | OBSERVED (10 rows) / INFERRED (no pager at scale) |
| BR-M04-30 | A report whose question was deleted keeps its row; its block reads "Soalan tidak dijumpai" and it has no question link. | OBSERVED |
| BR-M04-31 | S1 order: `createdAt` descending, ties by `id` ascending (live page 1: 564159, 564160, 564161, 564157, 564158, 564155 …). | OBSERVED (audit AUD-M04-06) |
| BR-M04-32 | SPM objective pool (XL-01, XL-29, D12) = Q-SPM-POOL (§4.1): rows with `spmPool = true` ∧ `questionType = mcq` ∧ `educationLevelId` ∈ {10, 11} ∧ eligible (BR-M04-03) ∧ `pkskDomainId = null`. `spmPool` is a facet (the SPM scope attribute live uses; its meaning is INFERRED, URS OQ-13) whose default cells reproduce the observed M06 pool sizes exactly (§6.13; Σ 21,033; MATH 1,681; Bahasa Arab 0, which keeps the live lock). Eligible T4/T5 rows outside those cells have `spmPool = false`. Runtime rule (INFERRED): a row created on S2 or imported on S5 with level 10/11 in a subject that has an M06 pool (the 19 Latih Tubi subjects) gets `spmPool = true`, so it is in the pool whenever it is eligible (M06 FR-M06-89); deactivation or archiving removes it through eligibility; the flag is never cleared. M06 hub constants (BR-M06-01) are not derived from it. | OBSERVED (M04 ids in SPM links; pool sizes, M06) / INFERRED (attribute meaning, runtime rule) |
| BR-M04-33 | PKSK rows (`pkskDomainId ≠ null`, 763 rows, ids 177698–178460, managed by M07) have null `subjectId`, `educationLevelId`, `options`, `correctAnswer`; they are excluded from every M04 list, filter, tile and count and from the SPM pool; `GET /api/questions/:id` and S3 show them. | OBSERVED (list excludes, detail shows; live S6 466,041 − 465,278 = 763) |
| BR-M04-34 | D11 datasets: each store is an allocation table (counts per subject × level × status × compliance × source × flags) with deterministic row generation by id; anchors replace one generated row of the same cell; creates add, deletes remove and updates move rows between cells in a change overlay, so every count stays consistent; `reset()` restores the default dataset. | D11 |
| BR-M04-35 | Teacher question writes (XL2-12, M10 #53–#58): `createFromTeacher` and `importFromTeacher` store MCQ (or other create types) with `status = pending_review`, **`isActive = true`**, `createdBy` = the teacher, `createdAt`/`updatedAt` = now, ids ≥ 9,000,001, `spmPool` per BR-M04-32, `teacherDatabank = false`, plus `curriculumChapterId`, `curriculumTopicId`, `scriptType` (`rumi`, `arab`, `jawi`, `mixed` "Campuran"; OBSERVED on M10 S18/S22), `textDirection` (`rtl` for `arab`/`jawi`; `ltr` for `rumi` and `mixed`). `updateOwn` / `deleteOwn` act only on rows with `createdBy` = viewer (404 otherwise). The row is outside practice until approved; approval changes only `status`, and because it is already active it becomes eligible at once. | SOURCE-DERIVED (M10) / INFERRED |
| BR-M04-36 | Structured writes (XL2-13, M10 #45–#50): `structured.create` (status `draft`, or `published` when `publish = 1`), `update` (every field except the DSKP chain on edit, as M10 #48), `delete`, `toggleStatus` (`draft` ⇄ `published`); `isActive = true` on create; ids ≥ 9,000,001; `updatedAt` = now; `totalMarks` = Σ sub `marks` (BR-M04-27); stored `visibility` is always `public` (M10 R-M04-04). | SOURCE-DERIVED (M10) / INFERRED |
| BR-M04-37 | Jutawan store (XL3-10): `jutawanQuestions` is a separate M04 dataset (like `structuredQuestions`), not part of the 466,041 question rows or any other count. Its cells are the 143 subject × grade counts of M16 discovery A.7 exactly (grade = level id 1–11); every row is an active MCQ with 4 options and one key. The game draws 15 questions of the subject and grade, difficulty 1 for questions 1–4, 2 for 5–8, 3 for 9–12, 4 for 13–15 (M16 BR-M16-30, PROPOSED), so each cell's difficulty split is PROPOSED as an even split over 1–4 (largest remainder), which gives every cell ≥ 35 rows per difficulty. No admin screen for this store was observed. | OBSERVED (counts, M16) / INFERRED (rows, split) |
| BR-M04-38 | Analytics inputs (XL3-11): (a) `coverageExcluded = true` on 1,746 active rows (Matematik 518 incl. 108 at D1–D4 = 9 / 33 / 5 / 61 and the 9 level-less rows, Prinsip Perakaunan 641, Geografi 305, Ekonomi 145, Sejarah 40, Sains 37, Matematik Tambahan 23, Kimia 22, Fizik 10, Biologi 3, Pendidikan Islam 2); none at T1–T3; their difficulties are 1–3 only. (b) Generated rows have `createdAt` before 2026-09-21 (no objective question created on or after Mon 21 Sep 2026; M17 XR-11). (c) Generated contributions: generated objective and structured rows give Σ 11,414 over active teachers, carried by the facet `contribSchoolId` — school 8087 1,368 MCQ + 1,064 structured, 8107 1,184 + 219, 8880 13 + 0, 8090 1 + 0, the rest (7,565) over other active teachers (PROPOSED, all MCQ). As built (v1.14): the 3,849 rows of the four named schools have `createdBy` = the M02 v1.20 teacher anchors (8087 → 4501, 2,432 rows; 8107 → 4502, 1,403; 8880 → 4503, 13; 8090 → 4504, 1; done, SQ-7(a)); the other 7,565 rows are by teachers without a school (no S11 school row carries them) and have `contribSchoolId` = 0 ("no contributing school", not a school id). **v1.15 (XL3 B-01):** **5,547** of them carry `createdBy` = **5316**, the M02 v1.24 fixture teacher designated as the observed M17 Guru-tab row `<teacher:101>` (no school, never logged in, MCQ 5,547, Struktur 0); the remaining **2,018** keep `createdBy` = 5801 (M02's fixture admin) — their teachers are not in the 389 captured live rows, so they stay an open, documented placeholder (SQ-7(d), SQ-8); no teacher or school is invented for them. **v1.16:** `<teacher:137>` (SMK JALAN REKO = 8087, "Ya", 497 MCQ + 1,062 structured) is part of 8087's 2,432 and is M02 v1.25 teacher **4202**: 8087's rows are split 4202 = 497 + 1,062 (1,559) and 4501 = 871 + 2 (873); `contribSchoolId` stays 8087 on all of them. Because 5801 is an admin id, a consumer must not count contributions by joining `createdBy` to the teacher role; consumers use `count('Q-TEACHER-CONTRIB', scope)` / `teacherContributions(schoolId?)` for totals and `teacherContributions({teacherId})` for a teacher's own MCQ / structured figures (§7.1). M14 `questionsCount` is not derived from these rows and stays as observed (5316: 0; 4202: 1,559, which equals its 497 + 1,062 here), so its leaderboard stays as observed; Q-CONTRIB(1) = 16,817 and Q-CONTRIB(5) = 1 are unchanged. | OBSERVED (M17 values) / PROPOSED (placement) |

### 4.1 Named count queries (one dataset; D11)

Every question count on every screen of M01, M03, M04 and M05 is one of these named queries on the M04 objective dataset (PKSK rows are a separate allocation, BR-M04-33). Admin screens count every status; student-facing screens count only **active** questions (the live bank students can see). The two live sides reconcile as below.

| Query | Definition | Default value | Figures that use it |
|---|---|---|---|
| Q-ALL | objective questions, any status, any active flag (PKSK excluded) | 465,278 | S1 pager total and "Jumlah" (DV-M04-04), S6 "Jumlah Soalan" (live 466,041 = Q-ALL + Q-PKSK) |
| Q-ALL(subject) | Q-ALL of one subject | S1 tile totals (e.g. Matematik 38,504; Bahasa Tamil 25,800; Bahasa Cina 0) | S1 tiles |
| Q-APPROVED | `status = approved` | 146,330 (live filter 145,689; DV-M04-18) | S1 `status=approved` result, Σ tile "lulus" |
| Q-APPROVED(subject) | Q-APPROVED of one subject | S1 "lulus" (e.g. Matematik 16,645; Prinsip Perakaunan 2,970 per DV-M04-18) | S1 tile "lulus" |
| Q-ARCHIVED | `status = archived` | 318,948 (live filter 319,589; DV-M04-18) | S1 `status=archived` result |
| Q-ACTIVE | `isActive = true` | 129,389 = Q-ELIGIBLE + 400 | M05 "Statistik Subjek" Σ, M03 subject "Soalan" column Σ |
| Q-ACTIVE(subject) | Q-ACTIVE of one subject | as M03 (Pendidikan Moral 15,414; Matematik 13,872; Prinsip Perakaunan 2,970 …) | M03 S6 "Soalan", M05 S1 "Statistik Subjek" |
| Q-ACTIVE(level) | Q-ACTIVE of one level | Σ 129,380 over the 11 levels (Darjah 1 11,396 …); 9 active legacy rows have no level | M03 S9 "Soalan", M05 level pills |
| Q-ELIGIBLE | `status = approved` ∧ `isActive = true` (BR-M04-03) | 128,989 | M05 S1/S2 subject cards Σ, M01 login stat (DV-05 value 128,989), every practice query (M05, M06 pool, "Buka Soalan Sama") |
| Q-ELIGIBLE(subject) | Q-ELIGIBLE of one subject | Bahasa Melayu 11,688 · Bahasa Inggeris 8,039 · Matematik 13,872 · Sains 12,165 · Sejarah 6,508 · Pendidikan Islam 9,154 · Pendidikan Moral 15,014 (+400 archived-active = 15,414) · Matematik Tambahan 2,101 · Fizik 1,261 · Kimia 2,245 · Biologi 4,235 · Geografi 5,997 · Pendidikan Seni Visual 4,910 · Pendidikan Muzik 1,800 · Pendidikan Jasmani & Kesihatan 2,900 · Reka Bentuk & Teknologi 200 · Sains Komputer 1,100 · Bahasa Arab 5,400 · Bahasa Cina 0 · Bahasa Tamil 6,300 · Prinsip Perakaunan 2,970 · Ekonomi 2,770 · Perniagaan 2,732 · Pendidikan Al-Quran & As-Sunnah 1,000 · Tasawwur Islam 1,300 · Jawi 2,100 · Pendidikan Syariah Islamiah 1,228 | M05 S1/S2 subject cards |
| Q-ARCHIVED-ACTIVE | `status = archived` ∧ `isActive = true` | 400, all Pendidikan Moral | the 15,414 vs 15,014 difference on M05 S1 |
| Q-APPROVED-INACTIVE | `status = approved` ∧ `isActive = false` (deactivated by reports or admins) | 17,341 = 146,330 − 128,989 | not displayed; explains admin "lulus" ≥ student card per subject |
| Q-PKSK | `pkskDomainId ≠ null` (all approved and active live) | 763 | M07 S5 "Jumlah"; M05 "Total Soalan" = Q-ACTIVE + Q-PKSK = 130,152; "Soalan Approved" = Q-ELIGIBLE + Q-PKSK = 129,752 |
| Q-SCORED | `qualityScore ≠ null` | 147,026 | S6 buckets and tables |
| Q-PRACTICE(subject, level) | Q-ELIGIBLE at Darjah 1–4 (= Q-ACTIVE there; no archived-active row at D1–D4) | per M05 S3 (§6.13 Table A D1–D4 cells: e.g. BM 958 / 2,540 / 805 / 530 = 4,833; Σ 32,204; every subject outside the ten practice subjects 0) | M05 S3 level buttons and "Semua Tahap", M05 S4 "{n} soalan chapter" |
| Q-DIFFICULTY(d) | (Q-ACTIVE ∪ Q-PKSK) by `difficultyLevel` | 39,694 / 47,138 / 33,720 / 9,600 / 0 (Σ 130,152) | M05 S1 "Tahap Kesukaran" chart |
| Q-SPM-POOL(subject[, level, difficulty]) | BR-M04-32 | per M06 §6.10 (Σ 21,033; MATH 1,681; BA 0) | M06 S2–S4 counts |
| Q-STRUCT-ALL / Q-STRUCT-VISIBLE | all structured questions / published ∧ active T4/T5 | 4,064 / 4,059 | M04 S8, M10 S17 / M05 S10, M06 S7–S9 |
| Q-CONTRIB(user[, status, subject]) | objective rows with `createdBy = user`, PKSK excluded | user 1: 16,817, all approved and active (Matematik 3,287, Pendidikan Islam 2,516, Bahasa Melayu 2,342, Bahasa Inggeris 2,214, Sains 1,935, Pendidikan Moral 1,823, Sejarah 795, Pendidikan Seni Visual 510, Pendidikan Syariah Islamiah 363, Geografi 269, others 763); user 5: 1 (700302) in the default seed | M10 S1 "Soalan" / "diluluskan" for teachers, S21–S24 |
| Q-TEACHER-DATABANK(subject[, questionType, difficulty]) | rows with `teacherDatabank = true` of the subject, all levels, eligible | Bahasa Melayu 6,048 = mcq 5,918 + essay 105 + other 25; mcq difficulty 3 = 950 (live 64 pages of 15 → 946–960; PROPOSED value inside the range); other subjects not observed (PROPOSED: 0 until observed) | M10 S28 |
| Q-PKSK-DIFFICULTY(d) | Q-PKSK by `difficultyLevel` (served by `questions.count('Q-PKSK-DIFFICULTY', d)`) | 253 / 253 / 191 / 66 / 0 (= the §6.13 PKSK cells; M07 XR-M07-01) | M07 PKSK seed checks; part of Q-DIFFICULTY |
| Q-JUT-COUNT(subject, level) | rows of the separate `jutawanQuestions` store (BR-M04-37) | 143 cells, Σ 149,911 (e.g. Sejarah T1 2,974; Bahasa Melayu D1 1,009) | M16 S19 "{n} soalan" (replaces M16 DC-M16-02) |
| Q-M17-COV(subject, level) | Q-ACTIVE ∧ ¬`coverageExcluded` ∧ level ≠ null | 127,643 (the M17 S10 matrix cells, §6.13 Table A minus the excluded rows); per-subject difficulty = the S10 tiles | M17 S10 matrix and difficulty tiles |
| Q-TEACHER-CONTRIB(scope) | objective + structured teacher-contribution rows of the scope — platform, `schoolId`, or `{teacherId}` (v1.15) (PKSK excluded; attributed rows carry `createdBy` 4501–4504, 4202 (v1.16) and 5316, the rest the BR-M04-38(c) placeholder 5801 — count via this query, never a role join) | 11,414 (8087 2,432; 8107 1,403; 8880 13; 8090 1; no school 7,565); per teacher **4202 1,559** (8087; observed `<teacher:137>`) · 4501 873 (8087) · 4502 1,403 · 4503 13 · 4504 1 · **5316 5,547** · every other teacher 0 (placeholder 5801: 2,018) | M17 S11 "Jumlah Soalan" (platform) and the Guru-tab "MCQ" + "Struktur" of each row |
| Q-IMPORT-RUNS / Q-IMPORTED / Q-IMPORT-MONTH(month) | ImportRun rows / Σ `importedCount` / runs created in the month | 1,123 / 31,101 / 0 for August and September 2026 | M17 S10 import tiles, M04 S5h |
| Q-CHAPTER(chapterId) | eligible non-PKSK MCQ rows with `curriculumChapterId` = the chapter (v1.13, as built) | per chapter; D2–D4 chapter counts split evenly across the M03 chapters of each subject-level (PROPOSED) | M05 chapter mode counts |
| Q-TEACHER-CONTRIB-STR(scope) | the structured part of Q-TEACHER-CONTRIB (v1.13, as built; same scopes incl. `{teacherId}`, v1.15) | 8087 1,064; 8107 219; 8880 0; 8090 0; no school 0; per teacher **4202 1,062** · 4501 2 · 4502 219 · 5316 **0** · others 0 (v1.16) | M17 S11 (school "{n}S"; Guru-tab "Struktur") |
| R-STATUS(status) | reports by status (v1.13, as built) | per the §6.11 report seed | M04 S7 tabs |
| R-MINE(user) | reports created by the caller (v1.13, as built) | per the §6.11 report seed | M04 S13 |
| Q-SP-AVAILABLE(sp[, level]) | Q-ELIGIBLE with `dskpSpId = sp` | 9001: 30 · 9002–9004: 2 each · 221: 16 · 206: 16 · 222: 7 · 214: 12 · 179: 13 · 194: 50 · 418: 13 (M08) | M08 S6/S7 "Fokus" / "Latihan Fokus" counts |
| Q-FLAGGED-MCQ / Q-FLAGGED-STR | `needsDiagram` (S11 filters apply) | 6,144 / 522 | S11 cards, SHU badge |

**Consistency checks (script, v1.3):** for all 27 subjects with questions, Q-ALL(subject) ≥ Q-APPROVED(subject) ≥ Q-ELIGIBLE(subject), and Q-ACTIVE(subject) = Q-ELIGIBLE(subject) except Pendidikan Moral (+400). Σ Q-ELIGIBLE(subject) = 128,989 and Σ Q-ACTIVE(subject) = 129,389 (M03/M05). Σ Q-APPROVED(subject) = 146,330. Live Darjah 1 Q-ALL = 14,778 ≥ Q-ACTIVE 11,396. The only observed values that cannot all hold are the Prinsip Perakaunan pair (admin "2,329 lulus" vs student 2,970 approved and active), fixed by DV-M04-18.

## 5. Validation rules

Client checks are only the native HTML ones listed (as live). Server messages are UNVERIFIED COPY (Laravel `ms` style); the mock returns them in `error.fields` and the form shows them under the field in red.

| Form / field | Rule | Message (UNVERIFIED COPY unless native) | Trigger |
|---|---|---|---|
| S2/S4 `subject_id`, `education_level_id` | required, existing id | native bubble; server "Sila pilih subjek." / "Sila pilih tahap pendidikan." | submit |
| S2/S4 `difficulty_level` | required, 1–5 | native bubble; server "Sila pilih tahap kesukaran." | submit |
| S2 `question_type` | one of 5 values | server "Jenis soalan tidak sah." | submit |
| S2/S4 `question_text` | required, ≥10 characters | native bubble (empty); server "Teks soalan mesti sekurang-kurangnya 10 aksara." | submit |
| S2/S4 `question_image`, `option_images[i]` | optional; JPG/PNG/WebP; ≤2 MB | server "Gambar mesti jenis JPG, PNG atau WebP dan tidak melebihi 2MB." | submit |
| S2/S4 MCQ `options[]` ×4, `correct_answer` | required when MCQ; `correct_answer` 0–3 | native bubble | submit |
| S2/S4 `correct_answer_text` | required when short_answer/fill_blank (server only; no DOM `required`) | server "Sila masukkan jawapan betul." | submit |
| S2/S4 `tf_answer` | optional (as live) | — | — |
| S2/S4 `points_value` | integer ≥1 | native min bubble | submit |
| S2/S4 `language` | `bm` or `en` | — | — |
| S5 `csv_file` | required; `.csv`/`.txt`; ≤5 MB | native bubble (empty); server "Fail mesti jenis CSV atau TXT dan tidak melebihi 5MB." | submit |
| S5 rows | BR-M04-10 | counted in the result flash | import |
| S7 `admin_notes` | optional text | — | submit |
| S10 `status` | required, 4 values; `admin_notes` ≤1000 (maxlength) | native | submit |
| S11 `image` | required; `image/*` | native bubble; server "Sila pilih fail gambar." | submit |
| S14 reasons | ≥1 (button disabled otherwise) | — | live |
| S14 comment | ≤500 (maxlength) | — | live |

## 6. Data entities & fields

Types follow SRS.md §7.4: M04 resources are shown to users by numeric id ("#564159", "ID Soalan: 3698", `/question-reports/10/update`), so they keep integer ids, and the seed keeps the live ids where known. Subject and education-level ids are M03 integers (1–31, 1–11). Dates ISO 8601 with +08:00.

### 6.1 DATA-M04-01 — Question (objective bank; owned by M04)

| Field | Type | Req | Notes |
|---|---|---|---|
| id | int | yes | shown "#{id}"; runtime-created ids start at **9,000,001** and increase by 1 (above every generated, anchor and reserved range, XL-37) |
| spmPool | boolean | yes | SPM scope facet (BR-M04-32); default cells §6.13; runtime rule BR-M04-09 |
| subjectId | int (M03 Subject id 1–31) \| null | yes (null only for PKSK) | from `GET /api/subjects` (M03) |
| educationLevelId | int (M03 EducationLevel id 1–11) \| null | yes (null for PKSK and for 9 legacy Matematik rows, all `coverageExcluded`, §4.1, §6.13) | from `GET /api/education-levels` (M03) |
| dskpSpId | int \| null | no | M10 DSKP SP (→ SK → Bidang); a **facet** (§6.13) for the SPs with observed availability; generated tagged rows point only to SPs of the M10 DSKP store |
| curriculumTopicId | int \| null | no | M03 CurriculumTopic (XL2-12); written by M10 teacher forms; read by M11 S4 |
| chapterLabel | string \| null | no | observed chapter label of anchor questions (e.g. "Sejarah Tingkatan 5 KSSM"; XL2-16); null on generated rows; M11 groups by it, M03 chapters unchanged |
| scriptType | enum `rumi`, `arab`, `jawi`, `mixed` ("Campuran") | yes | default `rumi`; the 4 options of the M10 forms S18/S22 (OBSERVED) |
| textDirection | enum `ltr`, `rtl` | yes | `rtl` for `arab`/`jawi`, `ltr` for `rumi`/`mixed`; returned to M05 quizzes |
| teacherDatabank | boolean | yes | scope facet of Q-TEACHER-DATABANK (meaning INFERRED) |
| coverageExcluded | boolean | yes | facet of Q-M17-COV (1,746 active rows, BR-M04-38; meaning INFERRED, e.g. no chapter mapping) |
| contribSchoolId | int? | no | facet of Q-TEACHER-CONTRIB (v1.13, as built): on the 11,414 generated contribution rows, the school of the contributing teacher (8087 / 8107 / 8880 / 8090 on the 3,849 attributed rows) or the sentinel **0** on the other 7,565 rows (v1.15: 0 = "no contributing school" — the 5,547 rows of teacher 5316, who has no school, and the 2,018 unattributed placeholder rows; not a school id; BR-M04-38(c)); null elsewhere. A PPD or state scope counts none of the 7,565 (their teachers have no school); per-teacher figures come from `createdBy` (`{teacherId}` scope, §7.1) |
| curriculumChapterId | int \| null | no | M03 CurriculumChapter (XL-08); used by M05 chapter mode; not on the S2/S4 forms (as live), so admin-created questions keep null |
| pkskDomainId | int \| null | no | M07 PkskDomain; non-null = PKSK row (BR-M04-33) |
| pkskTargetLevel | enum `T1`, `T4` \| null | PKSK | M07 |
| pkskOptions | `{text, isCorrect}[]` \| null | PKSK | 0–6 entries (M07 DATA-M07-02) |
| questionType | enum `mcq`, `true_false`, `short_answer`, `fill_blank`, `essay` | yes | default `mcq` |
| questionText | string (≥10) | yes | plain text; math as ASCII |
| questionImage | string (url) \| null | no | |
| options | string[4] \| null | MCQ | "" allowed for C/D from import; null for PKSK |
| optionImages | (string \| null)[4] | no | |
| correctAnswer | int 0–3 \| null | MCQ | null for PKSK |
| tfAnswer | boolean \| null | T/F | |
| correctAnswerText | string \| null | short/fill | |
| altAnswers | string[] | no | from the comma list |
| modelAnswer | string \| null | no | essay |
| explanation | string \| null | no | |
| aiExplanation | { markdown: string, generatedAt: string } \| null | no | BR-M04-24 |
| difficultyLevel | int 1–5 | yes | |
| language | enum `bm`, `en` | yes | default `bm` |
| pointsValue | int ≥1 | yes | default 1 |
| status | enum BR-M04-01 (incl. PKSK `pending`) | yes | |
| isActive | boolean | yes | ACTIVE/INACTIVE |
| complianceStatus | enum `verified`, `pending_mapping`, `quarantined`, `rejected`, `draft` | yes | |
| aiVerified | boolean | yes | "AI Verified" |
| sourceType | enum `textbook`, `dskp`, `trial`, `marking_scheme`, `ai_generated` \| null | no | null → "TIADA" |
| sourceFile | string \| null | no | e.g. "DSKP KSSM Science Form 4 and 5.pdf" |
| sourcePage | int \| null | no | "ms.{n}" on S11 |
| sourceSet | string \| null | no | e.g. `trial`, `ai_generated`, tracking codes |
| qualityScore | int 0–100 \| null | no | BR-M04-21 |
| needsDiagram | boolean | yes | S11 |
| createdBy | int (user id) | yes | a **facet** (Q-CONTRIB); name and school derived from the M01/M02 user; user 1: the 16,817 rows of the layout block from 522425 (§6.13.1); user 5: 700302; users 4501–4504 (M02 v1.20): the objective Q-TEACHER-CONTRIB rows of schools 8087 / 8107 / 8880 / 8090 (BR-M04-38(c); 2,566 in all, of which 497 at 8087 moved to 4202 in v1.16); user **4202** (M02 v1.25, 8087, the observed `<teacher:137>`): 497 objective rows (+ 1,062 structured rows in DATA-M04-02); user **5316** (M02 v1.24, the observed `<teacher:101>`): 5,547 objective contribution rows, `contribSchoolId` = 0 (v1.15); every other generated row (including the 2,018 remaining unattributed contribution rows, `contribSchoolId` = 0) the placeholder creator 5801, M02's fixture admin (v1.14, as built; not a teacher) |
| createdAt, updatedAt | datetime | yes | S3 "Dicipta Pada" |
| usage | { attempts: int, correct: int } | yes | S3 usage card |

### 6.2 DATA-M04-02 — StructuredQuestion and DATA-M04-03 — StructuredSubQuestion (owned by M04; authored through M10)

StructuredQuestion (owned by M04, one store, D12; authored in M10): `id` int, `subjectId`, `educationLevelId`, `kbatLevel` 1–6 (BR-M04-28), `estimatedMinutes` int, `isTrial` boolean, `topic` string \| null (M05/M06 fields), `questionNumber` int \| null, `stimulus` string (pre-line), `stimulusImage` url \| null, `totalMarks` int (derived, BR-M04-27), `visibility` stored `public` for every row (displayed "Public"; the M10 source code also names `tingkatan`/`class`, unreachable — noted for the backend phase, XL2-34), `status` enum `published`, `draft` (displayed "Published"; `draft` via the M10 toggle), `complianceStatus` (as DATA-M04-01), `isActive` boolean, `needsDiagram` boolean, `sourceFile`, `sourcePage`, `sourceSet`, `createdBy` (user id), `createdAt`, `updatedAt`, and the M10-authored fields (XL2-13; null on generated rows unless stated): `curriculumChapterId` (e.g. 4454 → 1281 "Bab 7", Perniagaan T5), `curriculumTopicId`, `dskpSpId`, `scriptType`, `textDirection`, `questionTemplate` (null or `eksperimen`).
StructuredSubQuestion: `id`, `structuredQuestionId`, `partLabel` ("a"…; displayed as observed, e.g. "3(A)"), `questionText`, `marks` int, `answerType` (`text`, `numeric`; INFERRED values), `expectedNumeric` number \| null, `numericTolerance` number \| null, `rubrics` [{ `konstruk` (F P C H R L J), `keyword`, `marks` }], `modelAnswer` string (pre-line), `parentSubId` int \| null, `order` int.

### 6.3 DATA-M04-04 — QuestionReport (owned by M04)

| Field | Type | Notes |
|---|---|---|
| id | int | |
| questionType | enum `mcq`, `structured` | |
| questionId | int | may point to a deleted question (BR-M04-30) |
| reporterId | user id | shown "Oleh: {name}" |
| reasons | string[] | codes, or legacy free text / `unclear` |
| comment | string ≤500 \| null | |
| source | string | `spm`, `structured_attempt`, `latihan`, `revision`, `teacher_databank` (BR-M04-11); legacy `quiz`, `papan_bijak` |
| quizSessionId | string \| null | max 64 characters (INFERRED, §7 #15) |
| roomCode | string \| null | "Bilik: {code}"; max 64 characters (INFERRED, §7 #15) |
| status | enum `pending`, `reviewed`, `fixed`, `dismissed` | |
| adminNotes | string \| null | |
| createdAt, updatedAt | datetime | |

### 6.4 DATA-M04-05 — QuestionSubmission (teacher paper; created in M10, managed in M04)

`id`, `teacherId` (name, email, school via M02 User/School), `subjectText` (free text as typed, e.g. "SEJARAH SPM"), `levelCode` ("T1"–"T5" from the form value, or null), `year` int, `paperType` = one of the 7 values of the M10 form, stored as the live value = label: "Soalan Umum", "Trial Paper", "Soalan DSKP", "Buku Teks", "Buku Latihan", "Soalan Peperiksaan", "Lain-lain" (the 3 observed admin rows use "Buku Latihan", "Soalan Peperiksaan", "Lain-lain"), `authorCredit` string ("Oleh: …"), `note` string \| null, `files` [{ index, name, size, mime }], `status` BR-M04-18, `adminNotes` ≤1000, `createdAt`.

**S10 seeds (v1.17, as built).** The seeds contain two PROPOSED rows in addition to the 4 observed ones: id 5 (`pending`) and id 6 (`rejected`), which §6.11 mandates so that every status is covered. The S10 "all" count is therefore **6**, against 4 on live (DV-M04-19).

### 6.5 DATA-M04-06 — MasterNote (owned by M04)

`id`, `questionId`, `subjectName`, `chapter` string \| null ("—" when null), `model` ("gpt-4o-mini"), `tokens` int, `confidence` int (badge "conf {n}"), `noteText`, `trapText`, `flagged` boolean, `teacherApproved` boolean, `createdAt`.

**Default state (v1.18):** 0 flagged / 0 teacher-approved / 525 total (live flags; dataset in §6.13). With the defaults the "flagged" and "approved" tabs are empty ("Tiada nota dalam tab ini."); populated tabs come only from the `masterNotes` reset override (`reset({masterNotes:{flagged:[…], approved:[…]}})`). No behaviour change.

### 6.6 DATA-M04-07 — ImportRun (DV-M04-01; owned by M04; D11 dataset of 1,123 runs, §6.13.5)

`id`, `fileName`, `importedCount`, `failedCount`, `failures` [{ row, message }], `defaults` { subjectId, educationLevelId, difficultyLevel }, `createdBy`, `createdAt`.

### 6.6a DATA-M04-12 — JutawanQuestion (owned by M04; separate dataset, BR-M04-37)

`id` int (own id space 1–149,911, INFERRED), `subjectId` (M03), `educationLevelId` (1–11 = the game's `darjah`), `difficultyLevel` 1–4, `questionText`, `options` string[4], `correctAnswer` 0–3, `explanation` string \| null, `isActive` true. Not linked to DATA-M04-01 rows.

### 6.7 DATA-M04-08 — QualitySummary (derived, response only)

`total`, `average`, `excellentCount`, `activeActionCount`, `buckets` { baik, lemahKritikal (≤50 non-legacy), legacyGeneric }, `distribution` { cemerlang, baik, lemah, kritikal } (percent), `bySubject` [{ subjectId, name, count, average, excellentPct }], `byLevel` [{ levelId, name, count, average }], `actionList` [question summary], `lastAuditAt`.

### 6.8 DATA-M04-09 — Dskp (owned by M10; referenced)

Bidang { id, subjectId, educationLevelId, code \| null, name }, SK { id, bidangId, code, description }, SP { id, skId, code, description }.

### 6.9 DATA-M04-10 — ReportReasonSet (static)

Per variant: [{ value, label, description, tint }] exactly as URS FN-M04-3.1.4 / 3.1.5 and BR-M04-15. The MCQ label set also holds `outdated` "Soalan sudah tidak relevan" for the M10 teacher-databank report form (not shown in the S14 modal).

### 6.10 DATA-M04-11 — Lookups (static constants)

Subjects and levels: read from M03 (`GET /api/subjects` with `code`, `name`, `isCore`; `GET /api/education-levels`), integer ids 1–31 / 1–11 — not duplicated in M04. Teras = `isCore`. The only M04-owned subject constant is the S1 tile icon map (live tile icons differ from the M03 `icon` field). Subject → S1 tile icon: 1 `fa-book-open`, 2 `fa-globe`, 3 `fa-calculator`, 4 `fa-flask`, 5 `fa-clock`, 6 `fa-moon`, 7 `fa-heart`, 8 `fa-square-root-alt`, 9 `fa-bolt`, 10 `fa-flask`, 11 `fa-leaf`, 12 `fa-map`, 13 `fa-palette`, 14 `fa-music`, 15 `fa-heartbeat`, 16 `fa-wrench`, 17 `fa-desktop`, 18 `fa-language`, 19 `fa-language` (DV-M04-13), 20 `fa-language` (DV-M04-13), 21 `fa-receipt`, 22 `fa-chart-line`, 23 `fa-briefcase`, 24 `fa-quran`, 25 `fa-mosque`, 26 `fa-pen-nib`, 27 `fa-scale-balanced`, 28–31 `fa-book`. (Lucide equivalents chosen at design time; the FA names above are the live reference.) Difficulty labels, status labels (BR-M04-02), compliance and source labels (URS FN-M04-1.1.8), KBAT labels (BR-M04-28), paper types (DATA-M04-05).

### 6.11 Seed data (fictitious people only)

Seeds mirror observation: large collections are D11 datasets with the live totals; small collections (reports, papers, import runs, DSKP subset) are listed records. All people are fictitious ("Admin Demo", "Guru Pakar", "Cikgu Demo 01"…"Cikgu Demo 05", "Pelajar Demo 01"…"Pelajar Demo 08"); schools come from the M02 fixture. Question texts are modelled on the discovery samples.

**Objective question dataset (D11; the full dataset spec is §6.13).** A deterministic virtual dataset of **465,278** objective questions (PKSK rows excluded; they are a separate allocation of 763 rows, ids 177698–178460, owned by M07's seed). It is defined by an allocation table and generates any row on demand from its id; counts are read from the allocation table plus the change overlay (BR-M04-34), never by iterating rows.

| Dimension | Allocation (live values; sources) |
|---|---|
| Status | approved 146,330 · archived 318,948 (live filters 145,689 / 319,589; DV-M04-18 moves the 641 Prinsip Perakaunan rows) · draft / pending_review / rejected 0 (S1 status filters) |
| Subject totals / approved ("lulus") | the 29 S1 tile values (e.g. Bahasa Melayu 32,905 / 13,081 … Pendidikan Syariah Islamiah 3,388 / 1,243; subjects 28–31 0 / 0) + Bahasa Tamil 25,800 / 6,300 + Bahasa Cina 0 (DV-M04-04 reconciliation) |
| Level | Darjah 1 = 14,778 (observed filter); other levels INFERRED, spread over each subject's M03 levels in proportion to the S6 "Mengikut Tingkatan" counts |
| Difficulty | 1 = 45,686 (observed); 2–5 INFERRED even split |
| Compliance | quarantined 124,299 (all archived, inactive) · pending_mapping 2,756 · draft 27,652 · rejected 0 · verified 310,571 (remainder) · `aiVerified` on a share of verified rows (INFERRED) |
| Source | trial 19,219 · dskp 35,401 · marking_scheme 199 · null ("TIADA") on the compliance-draft rows · ai_generated and legacy sets inside the 373 legacy rows · textbook the remainder (INFERRED); `sourceFile = null` on 128,372 rows (`missing_source`) |
| DSKP | untagged 14,933; the rest tagged to DSKP SPs of their subject/level where the M10 subset has them |
| Active | per §4.1: Q-ELIGIBLE per subject as M05 cards (Σ 128,989); 17,341 approved rows inactive; 400 archived Pendidikan Moral rows active; every other archived row inactive; 9 active legacy rows have no level (Σ levels 129,380) |
| Quality | 147,026 scored questions with the S6 per-subject counts and averages; Cemerlang 146,275, Skor 51–75 749, Skor ≤ 50 2 (129114, 129216), Legacy Generic 373; per-level scored counts as S6 (T4 absorbs the 230 difference between the S6 subject and level sums — PROPOSED) |
| Needs diagram | MCQ 6,144 (top-10 pills as live: Biologi 1,587, Kimia 1,077, Fizik 718, Sains 662, Ekonomi 570, Prinsip Perakaunan 393, Matematik 336, Geografi 320, Perniagaan 249, Pendidikan Moral 60; 172 over other subjects, e.g. Bahasa Arab 5); none on school 380 (observed `?school_id=380` → no MCQ) |
| SPM pool | approved + active T4/T5 MCQ per SPM subject; M06 supplies the per-subject pool sizes it observed as inputs to this allocation (contract, §7.1) |
| Ids | generated rows take ids 1–564,161 (live range) in a fixed deterministic order, skipping the PKSK range and the anchor ids; `createdAt` descending with id order inside a batch (BR-M04-31); anchors placed as listed below |

**Observed anchors** (live ids and texts; each replaces one generated row of its allocation cell, so totals do not change):

| id | Subject / level | Type | Status / active | Compliance · AI | Source | DSKP | Other |
|---|---|---|---|---|---|---|---|
| 564159 | Sains / T5 | mcq | approved / active | verified · AI Verified | textbook, "DSKP KSSM Science Form 4 and 5.pdf" | SP 6191 | createdAt 18/05/2026 23:21 (same as 564160/564161, newest → S1 order 564159, 564160, 564161, then 564157, 564158 …); text "Topup Sains T5 Bab 9 item 1: Apakah maksud satelit buatan? Pilih jawapan yang paling tepat.", options as S3 sample, correct A, explanation, difficulty 3, usage 0, score 96 |
| 564160, 564161 | Sains / T5 | mcq | approved / active | verified · AI | textbook | tagged | difficulty 4, 3 |
| 564157, 564158 | Sains / T5 | mcq | approved / active | verified · AI | textbook | tagged | createdAt 18/05/2026 23:20 |
| 129114 | Matematik / T5 | mcq | archived / inactive | quarantined | null (TIADA) | none | text "34^-1/2 =", options "1/34^2", "-1/34^2", "1/34^(1/2)", "-1/34^(1/2)", difficulty 1, no explanation, score 50, sourceSet `trial_matematik_johor_set2_k1`, created 20/03/2026 17:08 |
| 129216 | Matematik / T5 | mcq | archived / inactive | quarantined | null | none | text "(-21)(1 3) =", score 50 |
| 136891 | Matematik / T5 | mcq | approved / **inactive** (report 6, "Nyahaktif Segera") | verified | trial | none | "Rajah 16 menunjukkan dua segi tiga…", options "A"–"D", correct B — not served to practice while inactive (BR-M04-03) |
| 124733 | Sejarah / T5 | mcq | archived / inactive | verified | ai_generated, sourceSet `ai_generated` | none | report 2 ("Dikeluarkan"), correct C |
| 563393, 562177, 561050 | Biologi T5 / Pendidikan Moral T5 / Sains T5 | mcq | approved / active | verified | textbook, "T5-BT-BIO---BIOLOGI.pdf" ms.1 etc. | none | needsDiagram (texts as S11 samples) |
| 129732, 129650, 129614 | Bahasa Inggeris / T5 | mcq | approved / active | verified | textbook | — | master-note questions (S12 texts), SPM pool rows (`spmPool = true`, difficulty 2) |
| 122411 | Fizik / T5 | mcq | approved / active | verified | textbook | — | master-note question, pool row (difficulty 2) |
| 560001, 559916 | Matematik / T4 | mcq | approved / active | verified | textbook | — | master-note questions (chapters "Fungsi dan Persamaan Kuadratik", "Kebarangkalian Peristiwa Bergabung"), pool rows (difficulty 2) |

108527 (report 1) is **not** in the store (deleted question, BR-M04-30).

**Coverage anchors** (prototype ids 570004–570025, outside the live range; each replaces a generated row of its cell): 570004 Biologi T4, pending_mapping, marking_scheme, file "KIMIA K1 SBP-2024.pdf" style ("Source: MARKING SCHEME"); 570005 Sejarah D6, compliance draft, source null ("Source: TIADA"); 570006 Sains T1 (moved from T4 in v1.6: every eligible Sains T4 row is a pool row), textbook, no source file (`missing_source`), `spmPool = false`; 570020 Bahasa Arab T3, Arabic text, "Bahasa Arab Tingkatan 3.pdf" ms.2, needsDiagram; 570021 Pendidikan Moral T5, usage {attempts 42, correct 30}; 570022 Fizik T5, question and option images, "SET 1-FIZIK K1 PAHANG(JUJ)-2025.pdf" ms.29, needsDiagram; 570023 Kimia T4 with an AI explanation; 570024 Matematik T4, legacy sourceSet `tracking_a_feed_20260308`, score 55 (bucket `baik`: legacy rows sit only in cemerlang/baik, §6.13; it stays out of the ≤ 50 action list as a legacy row), pool row; 570025 Bahasa Tamil T1 (moved from D2 in v1.6: Bahasa Tamil D1–D4 is 0). All approved and active. The pool anchors are 570021–570024 (`spmPool = true`); 570004–570006, 570020 and 570025 are non-pool.

**State profile** (`reset({profile:'states'})`, test-only, because live has none of these): 570001 Bahasa Melayu D3 draft (import run 1); 570002 Geografi T2 pending_review; 570003 Ekonomi T4 rejected; 570010 Sains T1 true_false (tfAnswer true); 570011 Bahasa Inggeris T3 short_answer ("photosynthesis", alt ["photo synthesis"]); 570012 Matematik D4 fill_blank ("12"); 570013 Sejarah T4 essay (modelAnswer). The default dataset keeps the live zero counts for draft, pending_review, rejected and non-MCQ types. The profile is a spec override applied before compilation (architecture §6.9): it adds one cell of count 1 per state anchor, so these anchors never compete for default slots.

**Module fixtures as anchors (D11/D12).** Questions that other modules seed (e.g. M05 600001+, M08 700001+) are anchors of this dataset: each replaces one generated row of the same subject/level/status cell and does not change any total. Their owners list them in their own SRS; they SHALL carry `subjectId`, `educationLevelId`, `status = approved`, `isActive = true` and may carry `curriculumChapterId`.

**Structured dataset (D11, one store).** A deterministic virtual dataset of **4,064** structured questions with ids **393–4456** (live observed ids 505 … 4456 lie inside), all `status = published`, `visibility = public`, levels T4/T5; per-subject counts as the live S8 pills (Bahasa Inggeris 774, Bahasa Melayu 560, Biologi 219, Ekonomi 42, Fizik 246, Geografi 21, Kimia 232, Matematik 299, Matematik Tambahan 256, Perniagaan 763, Prinsip Perakaunan 76, Sains 204, Sains Komputer 22, Sejarah 328, Tasawwur Islam 22); `kbatLevel` 5 on 483 rows (observed filter), Bahasa Melayu has exactly 3 at KBAT 6, Matematik none at 6, the rest spread 1–5 (INFERRED); 522 flag `needsDiagram` (Fizik 6, Bahasa Arab 0); **5 inactive** (3699, 3703, 2509 and two Biologi rows, INFERRED), so the student-visible total is **4,059** (M06 observed) while S8 counts 4,064. Order BR-M04-26: 4454–4456 are the newest (20 May 2026).

Structured anchors — **the valid ids M05/M06 may cite**:

| id | Subject / level | KBAT | Details |
|---|---|---|---|
| 3698 | Sejarah T5 | 3 | number 3, subs A 2m / B 4m / C 4m (S9 texts), created 08 Apr 2026, active |
| 3699 | Bahasa Melayu T5 | 2 (INFERRED) | "Petikan 1: Rencana Wau Kapal.", **inactive** (reports 8, 7, 5) |
| 3700 | Bahasa Melayu T5 | 2 | "Petikan 2: Dialog Kerabu Rumpai Laut.", Trial, 5 bahagian (M06) |
| 3701 | Bahasa Melayu T5 | 2 | "Petikan 3: Berita Pakaian Terpakai Jadi Pilihan.", Trial, 5 bahagian (M06) |
| 3702 | Bahasa Melayu T5 | 2 | "Petikan 4: Cerpen Gerai Karipap Parkir.", Trial, 5 bahagian (M06) |
| 3703 | Bahasa Inggeris T5 | 3 (INFERRED) | "Part 1 email response to cousin Fairuz about planning an outing after exams.", **inactive** (report 4) |
| 3704, 3705, 3706 | Bahasa Inggeris T5 | 3 | 4 bahagian · 10 markah, 10 minutes (M06) |
| 2505, 2510, 2511 | Matematik T4 | 1 | Trial (M06) |
| 2509 | Matematik T4 | 1 (INFERRED) | "Jadual 1 menunjukkan markah Irfan…", compliance draft, **inactive** (report 3) |
| 4454 | Perniagaan T5 | 3 | no number, one sub "A" 8m, stimulus "Soalan Oleh: Guru Pakar / Kertas 2 Bab 7 Tingkatan 5 (2019) / Item 1 …", topic "Merancang Pengendalian Perniagaan", created 20 May 2026 |
| 4455, 4456 | Perniagaan T5 | 3 | created 20 May 2026 (S8 page 1) |

Other ids seen in M05/M06 crawls (e.g. 505, 513, 518, 2474–2476, 2860–2862, 3535–3537, 3841, 4097, 4352) are generated rows of this dataset; their attributes are generated, not observed. Ids from 10001 (the former M06 generator) do not exist.

**Reports** (live ids kept where known, SRS.md §7.4; 11 = added dismissed report): pending **10** (structured 3698, `other`, comment "Lambat", source set `trial`, 2 weeks ago — live id), **9** (structured 3700, `other`, 3 months ago — live id); reviewed **6** (MCQ 136891, `unclear`, room "Y31OBA", source set `tracking_a_<redacted>_math_20260326`, notes "Dinyahaktifkan segera oleh admin" — live id), **4** (structured 3703, `wrong_options`, English comment, same notes — live id), **3** (structured 2509, `wrong_answer`, comment "Bende ni AI", same notes — live id); fixed **8** (structured 3699, `other`, comment "Tiada soalan???"), **7** and **5** (structured 3699, `confusing_question`, comment "tidak dapat melihat petikan tersebut." on 7), **2** (MCQ 124733, `other`, comment "SILUBUS LAMA", notes "Soalan telah dikeluarkan daripada live bank kerana sumber prediction legacy / silibus tidak relevan. Ditutup selepas semakan admin."), **1** (MCQ 108527 — deleted question, `wrong_answer`) — ids 8, 7, 5, 2, 1 INFERRED from the live newest-first order; dismissed **11** (MCQ 564160, `typo`, notes "Soalan dan jawapan disemak — tiada masalah"). Reporters: Pelajar Demo 01–08 (= users 5001–5008, PROPOSED as built v1.13). "Pelajar Demo 01" owns reports 10, 6 and 2 (for S13).

**Question papers:** 6 — 4 done "Selesai" (1) / processing (3) as live samples (files "PPSA K1 T4 2026.docx", "HIMPUNAN_SOALAN_SEJARAH_K1_IKUT_BAB_PERUBAAN_SPM_NEGERI_2024_TINGKATAN copy.pdf", "OBJ TOPIKAL T5.pdf", "GEAR UP 1 TINGKATAN 5.pdf"; subjects "Perniagaan", "SEJARAH SPM", "EKONOMI", "Sains"; note "Latih tubi kelas 5 Alfa pada 13 Mac 2026"), plus 1 pending and 1 rejected (with 2 files each) to cover every status. Teachers Cikgu Demo 01–05.

**Master notes (D11):** a deterministic dataset of **525** notes (ids 1–525, 35 pages of 15), live flags 0 flagged / 0 teacher-approved; flagged and approved states come from test overrides (`reset({masterNotes:{flagged:[…], approved:[…]}})`); texts modelled on the S12 samples (question ids 129732, 129650, 129614, 122411, 560001, 559916…), model "gpt-4o-mini", tokens 700–1400, confidence 85 (a few 70, 90), chapter null for the Bahasa Inggeris rows. Canned regeneration notes: 3 texts cycled.

**DSKP (data owned by M10; these records are requested from the M10 DSKP seed, XL2-20):** Sains (4) × Tingkatan 5 (11): Bidang 515 "T5-SUB4-TEXTBOOK" "Sains T5 - Sokongan Bab Buku Teks", 57 "1.0" "Mikroorganisma", 58 "2.0" "Nutrisi dan Teknologi Makanan", … "9.0" "Teknologi Angkasa" (names from the S4 sample); SK under 515 incl. 2667 "T5SN.B9" "Menguasai konsep utama Bab 9: Satelit berdasarkan buku teks Sains Tingkatan 5." and "BAB9" "Sokongan pembelajaran BAB9: Satelit"; SP 6191 "T5SN.B9.1" "Menjawab soalan objektif berkaitan konsep dan aplikasi Bab 9: Satelit.". Plus one Bidang with an empty code (to show the name-only format) for Matematik × Tingkatan 4. Every other subject–level pair of Tables A–C (183 pairs) has one generic Bidang / SK / SP seeded by M10 (M10 §6.9), with SP id = 8000 + 20 × subjectId + levelId; pairs with observed or named records keep them (Sains T5 uses 6191 and its chain above).

**M10 and M11 anchors (XL2-11, XL2-16):** listed in §6.13.2 with their cells.

**Import runs:** the ImportRun dataset of §6.13.5 (1,123 runs, Σ `importedCount` 31,101, none created in August or September 2026); the observed-style anchor run "soalan-bm-d3.csv" (12 imported, 1 failed) is dated **2026-07-20** (re-dated from "5 days ago", XL3-11). E2E resets the set for the empty state.

### 6.12 Fixture functions

- `score(q)` for BR-M04-22: `100 − 15·[no explanation] − 10·[untagged] − 10·[sourceType null] − 15·[complianceStatus ∈ quarantined, rejected] − 10·[questionText < 20 chars]`, clamped 0–100; anchor scores are pinned (a pinned score wins).
- CSV template (FR-M04-57): header of AC-M04-13.6 and rows `"Apakah ibu negara Malaysia?",Kuala Lumpur,Putrajaya,Johor Bahru,Ipoh,A,1,4,1,1,"Kuala Lumpur ialah ibu negara."` and `"2 + 3 = ?",4,5,6,7,B,3,1,1,1,` (INFERRED content).

### 6.13 Dataset spec (architecture overview §6.6–§6.7, ADR-0013/0014; X-7, X-8)

This section is the input to `defineVirtualDataset` for the two M04 stores. It restates §4.1 and §6.11 in the architecture's format. Every figure is built so that the counts can all be met at the same time. The author's script `dsspec.js` builds the tables below and checks every constraint listed here, including the M05 D1–D4 pins, the M05 difficulty-by-level cells, the M06 pool cells and the Q-DIFFICULTY marginals: **0 violations**, v1.5.

#### 6.13.1 `questions` (owner M04)

| Item | Value |
|---|---|
| Total N | **466,041** rows = 465,278 objective (Q-ALL) + 763 PKSK (Q-PKSK). This equals the live raw store count on S6 (466,041). Every M04 screen filters PKSK out (BR-M04-33). |
| Facets (count-relevant fields) | `subjectId`, `educationLevelId` (null allowed), `pkskDomainId`, `pkskTargetLevel`, `status`, `isActive`, `questionType`, `spmPool` (boolean, the SPM scope attribute, meaning INFERRED, BR-M04-32), `difficultyLevel`, `complianceStatus`, `aiVerified`, `sourceType`, `hasSourceFile`, `dskpTagged`, `dskpSpId` (only the SPs with an observed count; XL2-20), `needsDiagram`, `qualityBucket` (`unscored`, `cemerlang`, `baik`, `le50`), `legacyGeneric`, `curriculumChapterId`, `createdBy` (user id; XL2-09), `teacherDatabank` (XL2-10), `coverageExcluded` (XL3-11) |
| Derived (not facets) | text, options, key, explanation presence, file name, page, the creator's name and school (from `createdBy`), `curriculumTopicId`, `chapterLabel` (anchors only), `scriptType`/`textDirection` (`rumi`/`ltr` on generated rows; Bahasa Arab and Jawi rows `arab`/`jawi`, `rtl`), `createdAt` (monotone in id), exact `qualityScore` inside its bucket (chosen so each subject's mean equals S6: overall 94.14 → "94.1") |
| Generated id range | 1–564,161 (live range; max observed id 564161). Holes (v1.13): 108527 (deleted question, target of report 1) and 564156 (gap) are never generated (F-09 `absentIds` option, v1.14); totals are unchanged because the id range exceeds N. PKSK cells are anchored at 177698–178460 (M07). |
| Anchor id ranges outside the live range | 570001–570025 (M04 coverage and state-profile anchors); 600001–699999 (M05); 700001–700999 split into **700001–700299 M08**, **700300–700399 M10**, **700400–700999 M11**; **701001–701099 M18** (critical questions, XL3-11). No range overlaps another or the runtime floor. The state profile is test-only. |
| Runtime id range (XL-37) | rows created on S2 or imported on S5 take ids from **9,000,001** upwards (never `max + 1`), above every generated, anchor and reserved range. |

**Cells, layer 1. Active rows by subject × level (Table A)** (v1.11, XL3-11). Built with `exact`: **Table A = the M17 S10 coverage matrix (Q-M17-COV, 127,643 rows; OBSERVED) + the 1,746 `coverageExcluded` rows** (BR-M04-38). Row totals = Q-ACTIVE(subject) (M03); column totals = Q-ACTIVE(level) (M03, Σ 129,380); the 9 level-less rows are excluded Matematik rows (moved from Bahasa Melayu, whose S10 row is 11,688 = its Q-ACTIVE).
- Excluded rows per level: D1 9, D2 33, D3 5, D4 61 (all Matematik), D5 26 (Matematik 10, Sains 11, Sejarah 5), D6 22 (Matematik 8, Sains 10, Sejarah 4), T1–T3 0, T4 28 (Matematik 11, Sejarah 15, Pendidikan Islam 2), T5 1,553 (Prinsip Perakaunan 641, Matematik 372, Geografi 305, Ekonomi 145, Matematik Tambahan 23, Kimia 22, Sejarah 16, Sains 16, Fizik 10, Biologi 3), level-less 9 (Matematik). The per-level split is PROPOSED within the observed per-subject and per-level differences.
- D1–D4 cells still equal the M05 S3 values (XL-30): S10 already equals them except Matematik, whose excluded rows restore 2,734 / 2,129 / 682 / 993.
- Some subjects now have rows at levels M03 does not link (e.g. Pendidikan Muzik at T1–T3, Sains Komputer at T1–T3), because S10 observes them there; the M03 links are not used as a constraint for Table A.
- Pool room: every SPM subject's T4/T5 cell holds its M06 pool; where the S10 cell is smaller (Sejarah T4 762 < 777, Sejarah T5 746 < 762, Fizik T5 790 < 800, Pendidikan Islam T4 237 < 239, Geografi T5 673 < 978), excluded rows at that level are pool rows, and M08's 15 Sejarah T4 anchors are pool rows (Sejarah T4 has no non-pool room).

Inside each cell: `status = approved`, except that 400 Pendidikan Moral rows are `archived` and active (Q-ARCHIVED-ACTIVE). They sit in D5–T3 (23, 24, 189, 85, 79, PROPOSED). None sits at D1–D4, where the M05 figures equal Q-ELIGIBLE, and none at T4/T5, which keeps pool room.

| Subject (id) | D1 | D2 | D3 | D4 | D5 | D6 | T1 | T2 | T3 | T4 | T5 | Total |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Bahasa Melayu (1) | 958 | 2,540 | 805 | 530 | 407 | 400 | 2,104 | 1,800 | 1,500 | 257 | 387 | 11,688 |
| Bahasa Inggeris (2) | 926 | 1,225 | 846 | 524 | 403 | 992 | 1,609 | 400 | – | 362 | 752 | 8,039 |
| Matematik (3) | 2,734 | 2,129 | 682 | 993 | 583 | 641 | 1,300 | 1,300 | 900 | 1,511 | 1,090 | 13,863 |
| Sains (4) | 3,230 | 611 | 515 | 547 | 347 | 310 | 900 | 1,300 | 1,000 | 1,927 | 1,478 | 12,165 |
| Sejarah (5) | 650 | 451 | 418 | 412 | 234 | 204 | 800 | 1,000 | 800 | 777 | 762 | 6,508 |
| Pendidikan Islam (6) | 985 | 1,124 | 893 | 369 | 400 | 400 | 1,500 | 1,500 | 1,500 | 239 | 244 | 9,154 |
| Pendidikan Moral (7) | 1,013 | 1,265 | 717 | 312 | 400 | 417 | 3,300 | 1,500 | 1,400 | 2,666 | 2,424 | 15,414 |
| Matematik Tambahan (8) | – | – | – | – | – | – | – | – | – | 1,146 | 955 | 2,101 |
| Fizik (9) | – | – | – | – | – | – | – | – | – | 461 | 800 | 1,261 |
| Kimia (10) | – | – | – | – | – | – | – | – | – | 1,350 | 895 | 2,245 |
| Biologi (11) | – | – | – | – | – | – | – | – | – | 2,282 | 1,953 | 4,235 |
| Geografi (12) | 200 | 200 | 200 | 200 | 200 | 200 | 1,269 | 1,100 | 1,200 | 250 | 978 | 5,997 |
| Pendidikan Seni Visual (13) | – | – | – | – | – | – | 1,710 | 1,100 | 1,000 | 550 | 550 | 4,910 |
| Pendidikan Muzik (14) | – | – | – | – | – | – | 600 | 500 | 700 | – | – | 1,800 |
| Pendidikan Jasmani & Kesihatan (15) | – | – | – | – | – | – | 1,000 | 1,100 | 800 | – | – | 2,900 |
| Reka Bentuk & Teknologi (16) | – | – | – | – | – | – | – | 200 | – | – | – | 200 |
| Sains Komputer (17) | – | – | – | – | – | – | 400 | 300 | 400 | – | – | 1,100 |
| Bahasa Arab (18) | 400 | 400 | 400 | 500 | 500 | 500 | 500 | 500 | 500 | 600 | 600 | 5,400 |
| Bahasa Tamil (20) | – | – | – | – | – | – | 2,100 | 2,100 | 2,100 | – | – | 6,300 |
| Prinsip Perakaunan (21) | – | – | – | – | – | – | – | – | – | 845 | 2,125 | 2,970 |
| Ekonomi (22) | – | – | – | – | – | – | – | – | – | 1,251 | 1,519 | 2,770 |
| Perniagaan (23) | – | – | – | – | – | – | – | – | – | 727 | 2,005 | 2,732 |
| Pendidikan Al-Quran & As-Sunnah (24) | – | – | – | – | – | – | – | – | – | 500 | 500 | 1,000 |
| Tasawwur Islam (25) | – | – | – | – | – | – | – | – | – | 675 | 625 | 1,300 |
| Jawi (26) | 300 | 300 | 300 | 400 | 400 | 400 | – | – | – | – | – | 2,100 |
| Pendidikan Syariah Islamiah (27) | – | – | – | – | – | – | 363 | – | – | 737 | 128 | 1,228 |
| **Σ** | 11,396 | 10,245 | 5,776 | 4,787 | 3,874 | 4,464 | 19,455 | 15,700 | 13,800 | 19,113 | 20,770 | 129,380 |

**Cells, layer 2. Inactive rows by subject × level (Table B).** Row totals = Q-ALL(subject) − Q-ACTIVE(subject). The Darjah 1 column is pinned to 3,382, so that Q-ALL(D1) = 11,396 + 3,382 = 14,778 (S1 filter, observed). The other columns are PROPOSED (proportional over the links). Σ = 335,889 = 465,278 − 129,389.

| Subject (id) | D1 | D2 | D3 | D4 | D5 | D6 | T1 | T2 | T3 | T4 | T5 | Total |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Bahasa Melayu (1) | 251 | 2,137 | 2,138 | 2,144 | 2,149 | 2,152 | 1,898 | 1,945 | 1,946 | 2,227 | 2,230 | 21,217 |
| Bahasa Inggeris (2) | 128 | 1,095 | 1,095 | 1,100 | 1,099 | 1,099 | 973 | 996 | 996 | 1,141 | 1,141 | 10,863 |
| Matematik (3) | 291 | 2,483 | 2,483 | 2,493 | 2,493 | 2,493 | 2,206 | 2,258 | 2,258 | 2,587 | 2,587 | 24,632 |
| Sains (4) | 356 | 3,041 | 3,041 | 3,054 | 3,053 | 3,053 | 2,702 | 2,766 | 2,766 | 3,169 | 3,169 | 30,170 |
| Sejarah (5) | 164 | 1,402 | 1,402 | 1,407 | 1,407 | 1,407 | 1,245 | 1,275 | 1,275 | 1,461 | 1,461 | 13,906 |
| Pendidikan Islam (6) | 222 | 1,896 | 1,896 | 1,904 | 1,903 | 1,903 | 1,684 | 1,725 | 1,725 | 1,975 | 1,975 | 18,808 |
| Pendidikan Moral (7) | 272 | 2,325 | 2,325 | 2,335 | 2,335 | 2,334 | 2,065 | 2,115 | 2,115 | 2,423 | 2,423 | 23,067 |
| Matematik Tambahan (8) | – | – | – | – | – | – | – | – | – | 2,740 | 2,739 | 5,479 |
| Fizik (9) | – | – | – | – | – | – | – | – | – | 779 | 778 | 1,557 |
| Kimia (10) | – | – | – | – | – | – | – | – | – | 2,529 | 2,529 | 5,058 |
| Biologi (11) | – | – | – | – | – | – | – | – | – | 4,883 | 4,883 | 9,766 |
| Geografi (12) | 181 | 1,544 | 1,544 | 1,551 | 1,551 | 1,550 | 1,372 | 1,405 | 1,405 | 1,609 | 1,609 | 15,321 |
| Pendidikan Seni Visual (13) | 513 | 4,379 | 4,379 | 4,398 | 4,397 | 4,397 | 3,891 | 3,984 | 3,984 | 4,564 | 4,564 | 43,450 |
| Pendidikan Muzik (14) | 247 | 2,106 | 2,106 | 2,115 | 2,114 | 2,114 | 1,871 | 1,916 | 1,916 | – | – | 16,505 |
| Pendidikan Jasmani & Kesihatan (15) | 171 | 1,456 | 1,456 | 1,462 | 1,462 | 1,462 | 1,293 | 1,325 | 1,324 | 1,517 | 1,517 | 14,445 |
| Reka Bentuk & Teknologi (16) | 19 | 163 | 162 | 163 | 163 | 163 | 144 | 148 | 148 | 169 | 169 | 1,611 |
| Sains Komputer (17) | – | – | – | 2,625 | 2,625 | 2,625 | 2,323 | 2,378 | 2,378 | 2,725 | 2,725 | 20,404 |
| Bahasa Arab (18) | 195 | 1,665 | 1,665 | 1,671 | 1,671 | 1,671 | 1,479 | 1,514 | 1,514 | 1,734 | 1,734 | 16,513 |
| Bahasa Tamil (20) | 230 | 1,965 | 1,965 | 1,974 | 1,974 | 1,974 | 1,746 | 1,788 | 1,788 | 2,048 | 2,048 | 19,500 |
| Prinsip Perakaunan (21) | – | – | – | – | – | – | – | – | – | 1,541 | 1,541 | 3,082 |
| Ekonomi (22) | – | – | – | – | – | – | – | – | – | 1,411 | 1,410 | 2,821 |
| Perniagaan (23) | – | – | – | – | – | – | – | – | – | 1,339 | 1,339 | 2,678 |
| Pendidikan Al-Quran & As-Sunnah (24) | – | – | – | – | – | – | – | – | – | 1,485 | 1,485 | 2,970 |
| Tasawwur Islam (25) | – | – | – | – | – | – | – | – | – | 1,845 | 1,845 | 3,690 |
| Jawi (26) | 142 | 1,212 | 1,212 | 1,217 | 1,217 | 1,216 | – | – | – | – | – | 6,216 |
| Pendidikan Syariah Islamiah (27) | – | – | – | – | – | – | 646 | – | – | 757 | 757 | 2,160 |
| **Σ** | 3,382 | 28,869 | 28,869 | 31,613 | 31,613 | 31,613 | 27,538 | 27,538 | 27,538 | 48,658 | 48,658 | 335,889 |

**Scored rows (Table C, facet `qualityBucket ≠ unscored`).** Row totals = S6 "Mengikut Subjek". Column totals = S6 "Mengikut Tingkatan", with T4 +230 (D9, below). Each cell ≤ the Table A + Table B cell.

| Subject (id) | D1 | D2 | D3 | D4 | D5 | D6 | T1 | T2 | T3 | T4 | T5 | Total |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Bahasa Melayu (1) | 387 | 348 | 519 | 631 | 758 | 876 | 1,650 | 1,243 | 1,368 | 1,274 | 983 | 10,037 |
| Bahasa Inggeris (2) | 325 | 293 | 439 | 533 | 640 | 739 | 1,393 | 1,048 | 996 | 1,076 | 831 | 8,313 |
| Matematik (3) | 512 | 461 | 692 | 839 | 1,007 | 1,164 | 2,193 | 1,650 | 1,816 | 1,693 | 1,308 | 13,335 |
| Sains (4) | 653 | 589 | 882 | 1,070 | 1,285 | 1,485 | 2,798 | 2,104 | 2,317 | 2,160 | 1,669 | 17,012 |
| Sejarah (5) | 353 | 318 | 477 | 578 | 694 | 802 | 1,512 | 1,137 | 1,252 | 1,167 | 902 | 9,192 |
| Pendidikan Islam (6) | 439 | 396 | 594 | 720 | 864 | 999 | 1,882 | 1,415 | 1,559 | 1,453 | 1,122 | 11,443 |
| Pendidikan Moral (7) | 377 | 340 | 509 | 618 | 742 | 857 | 1,614 | 1,214 | 1,337 | 1,246 | 963 | 9,817 |
| Matematik Tambahan (8) | – | – | – | – | – | – | – | – | – | 1,286 | 993 | 2,279 |
| Fizik (9) | – | – | – | – | – | – | – | – | – | 1,063 | 821 | 1,884 |
| Kimia (10) | – | – | – | – | – | – | – | – | – | 3,296 | 2,546 | 5,842 |
| Biologi (11) | – | – | – | – | – | – | – | – | – | 6,430 | 4,967 | 11,397 |
| Geografi (12) | 280 | 252 | 378 | 458 | 550 | 635 | 1,198 | 901 | 992 | 925 | 714 | 7,283 |
| Pendidikan Seni Visual (13) | 175 | 158 | 237 | 287 | 344 | 398 | 750 | 564 | 621 | 579 | 447 | 4,560 |
| Pendidikan Muzik (14) | 89 | 81 | 121 | 147 | 176 | 203 | 383 | 288 | 317 | – | – | 1,805 |
| Pendidikan Jasmani & Kesihatan (15) | 113 | 102 | 153 | 185 | 223 | 257 | 484 | 364 | 401 | 374 | 289 | 2,945 |
| Reka Bentuk & Teknologi (16) | 19 | 47 | 71 | 86 | 104 | 120 | 144 | 169 | 148 | 169 | 134 | 1,211 |
| Sains Komputer (17) | – | – | – | 79 | 95 | 110 | 208 | 156 | 172 | 160 | 124 | 1,104 |
| Bahasa Arab (18) | 154 | 138 | 208 | 252 | 303 | 350 | 659 | 496 | 546 | 509 | 393 | 4,008 |
| Bahasa Tamil (20) | 228 | 219 | 328 | 397 | 477 | 551 | 1,038 | 781 | 860 | 802 | 619 | 6,300 |
| Prinsip Perakaunan (21) | – | – | – | – | – | – | – | – | – | 1,383 | 1,069 | 2,452 |
| Ekonomi (22) | – | – | – | – | – | – | – | – | – | 1,801 | 1,392 | 3,193 |
| Perniagaan (23) | – | – | – | – | – | – | – | – | – | 2,059 | 2,681 | 4,740 |
| Pendidikan Al-Quran & As-Sunnah (24) | – | – | – | – | – | – | – | – | – | 564 | 436 | 1,000 |
| Tasawwur Islam (25) | – | – | – | – | – | – | – | – | – | 773 | 597 | 1,370 |
| Jawi (26) | 221 | 199 | 298 | 362 | 434 | 502 | – | – | – | – | – | 2,016 |
| Pendidikan Syariah Islamiah (27) | – | – | – | – | – | – | 840 | – | – | 930 | 718 | 2,488 |
| **Σ** | 4,325 | 3,941 | 5,906 | 7,242 | 8,696 | 10,048 | 18,746 | 13,530 | 14,702 | 33,172 | 26,718 | 147,026 |

**Cells, layer 3 — nested facets** (built with `nest` + `split`; each line gives the observed total, the host cells and the source):

| Facet | Observed totals (source) | Placement rule |
|---|---|---|
| `status` / `isActive` on inactive rows | Q-APPROVED-INACTIVE 17,341 and Q-ARCHIVED-INACTIVE 318,548 per subject (Q-APPROVED(subject) − Q-ELIGIBLE(subject), and the rest) | split within each subject's Table B row in proportion to its levels |
| `status` totals | approved 146,330 · archived 318,948 · pending 0 (objective) · PKSK: 763 approved | follows from layers 1–2 |
| `questionType` | `mcq` everywhere except the Bahasa Melayu teacher databank: 105 `essay` and 25 other create types (true_false 9, short_answer 8, fill_blank 8; PROPOSED split), observed on M10 S28 (XL2-10). The admin list samples (S1) are MCQ. | the 130 non-MCQ rows sit in BM T1–T5 eligible non-pool cells inside `teacherDatabank = true` (outside the M05 D1–D4 pins); MCQ practice excludes them (BR-M04-03); the state profile still adds its own non-MCQ anchors |
| `teacherDatabank` | Bahasa Melayu 6,048 (mcq 5,918, essay 105, other 25; mcq difficulty 3 = 950 in the observed 946–960; as built: 911 non-pool BM D5–T5 rows + 39 BM T4/T5 SPM-pool rows, pool counts unchanged) (M10 S28); other subjects 0 until observed (PROPOSED) | BM D5–T5 eligible non-pool cells (room 6,332 − 1 for 700302), including the M10 anchors 522425–522447, 525428–525433 |
| `coverageExcluded` | 1,746 active rows (BR-M04-38 per subject and level; Table A caption) | the excluded rows of Table A; approved, active; difficulty 1–3 |
| `createdBy` | user 1 = 16,817 approved active rows (Q-CONTRIB split per subject: Matematik 3,287, Pendidikan Islam 2,516, Bahasa Melayu 2,342, Bahasa Inggeris 2,214, Sains 1,935, Pendidikan Moral 1,823, Sejarah 795, Pendidikan Seni Visual 510, Pendidikan Syariah Islamiah 363, Geografi 269, others 763 over the remaining subjects in proportion to Q-ELIGIBLE, PROPOSED) (M10 S21); user 5 = 700302; users 4501 / 4502 / 4503 / 4504 (M02 v1.20 teacher anchors) = the Q-TEACHER-CONTRIB rows of schools 8087 (1,368 MCQ + 1,064 structured = 2,432) / 8107 (1,184 + 219 = 1,403) / 8880 (13) / 8090 (1), Σ 3,849 — **v1.16:** 8087's 2,432 split by `createdBy` into 4202 (M02 v1.25; observed `<teacher:137>`) 497 MCQ + 1,062 structured and 4501 871 MCQ + 2 structured, `contribSchoolId` 8087 on all; user **5316** (M02 v1.24; the observed `<teacher:101>`) = 5,547 objective contribution rows with `contribSchoolId` = 0 (v1.15, XL3 B-01; taken from the former placeholder rows, same cells); every other generated row the placeholder creator 5801 (M02's fixture admin; PROPOSED as built v1.13–v1.14), including the remaining 2,018 objective contribution rows, which carry `contribSchoolId` = 0 (unattributed; BR-M04-38(c), SQ-7(d), SQ-8). All 11,414 contribution rows are marked by `contribSchoolId`; count them with `count('Q-TEACHER-CONTRIB', scope)`, not by joining `createdBy` to the teacher role | inside each subject's eligible cells (every subject count ≤ Q-ELIGIBLE(subject), checked). **Layout block:** user-1 rows take ids from 522425 upwards in ascending order (ids 522425–522447 are the M10 anchors, consecutive; page 2 of S21 starts at 522445); no user-1 row has an id below 522425 |
| `dskpSpId` | 9001 = 30 (M08 anchors 700001–700002, 700101–700128), 9002 / 9003 / 9004 = 2 each (M08 anchors), 221 = 16, 206 = 16, 222 = 7, 214 = 12, 179 = 13, 194 = 50 (Bahasa Melayu), 418 = 13 (Sejarah) eligible rows (M08 S6/S7) | inside eligible non-pool cells of the SP's subject and level as the M10 DSKP store records them (Kimia T5 for 9001–9004); every other generated `dskpTagged` row points to its pair's generic SP (id 8000 + 20 × subjectId + levelId, M10 §6.9; Sains T5 → 6191), so the named SPs hold only the rows counted here and Q-SP-AVAILABLE keeps 9001 = 30, 9002–9004 = 2, 221 = 16, 206 = 16, 222 = 7, 214 = 12, 179 = 13, 194 = 50, 418 = 13; anchors with an observed SP keep it. As built (v1.13): SP 418 and the BM T4 SPs also take SPM-pool rows because the non-pool cells have no room; the pool counts are unchanged |
| `spmPool` | M06 §6.10 table: per subject × T4/T5 × difficulty 1–4 (Σ 21,033; MATH 1,681; Bahasa Arab 0) = Q-SPM-POOL | exact cells inside eligible T4/T5 cells of Table A (lower bounds guarantee room); `spmPool = false` on every other generated row; runtime rows per BR-M04-32 |
| `difficultyLevel` | Q-DIFFICULTY (active + PKSK) = 39,694 / 47,138 / 33,720 / 9,600 / **0** (M05 S1); M17 S10 per-subject tiles over the covered rows (Σ 38,968 / 46,154 / 32,987 / 9,534 / 0; e.g. Bahasa Melayu 3,018 / 4,608 / 2,880 / 1,182); Q-ALL difficulty 1 = 45,686 (S1 filter) | exact, per subject × level: D1–D4 cells per M05 `difficultyByLevel`; T4/T5 pool cells per M06; each subject's covered rows sum to its S10 tile; excluded rows are difficulty 1–3 only: Σ 473 / 731 / 542 / 0 (per subject e.g. Prinsip Perakaunan 174 / 269 / 198, Matematik 141 / 216 / 161, Geografi 83 / 128 / 94); PKSK 253 / 253 / 191 / 66 (M17 XR-10; request to M07). The script `dsdiff.js` solves every subject's level × difficulty table with these pins and bounds: 0 violations. **No active or PKSK row has difficulty 5.** Inactive rows: difficulty 1 = 6,245 (= 45,686 − (39,694 − 253)); 2–5 split evenly (PROPOSED). |
| `complianceStatus` | quarantined 124,299 (all archived and inactive), pending_mapping 2,756, draft 27,652, rejected 0, verified 310,571 (S1 filters) | quarantined inside Q-ARCHIVED-INACTIVE cells (318,548 ≥ 124,299); the others split over all remaining cells |
| `aiVerified` | the AI Verified subset of verified rows (`compliance_filter=verified_generated` size not observed) | INFERRED share |
| `sourceType` | trial 19,219 · dskp 35,401 · marking_scheme 199 · null 27,654 (= the 27,652 compliance-draft rows, "Source: TIADA", plus the anchors 129114 and 129216, whose source is TIADA; v1.13) · legacy/ai_generated 373 · textbook 382,432 (remainder) | split; null exactly on the compliance-draft cells |
| `hasSourceFile` | false on 128,372 rows (`missing_source`), including the 27,652 null-source rows (INFERRED) | split |
| `dskpTagged` | false on 14,933 rows (`dskp_filter=untagged`) | split |
| `needsDiagram` | 6,144 rows: Biologi 1,587, Kimia 1,077, Fizik 718, Sains 662, Ekonomi 570, Prinsip Perakaunan 393, Matematik 336, Geografi 320, Perniagaan 249, Pendidikan Moral 60, plus 172 over other subjects (Bahasa Arab 5) (S11) | exact per subject, inside the subject's cells |
| `qualityBucket` | Table C cells are scored. Within them: `le50` 2 (anchors 129114, 129216, Matematik T5), `baik` 749 (Matematik 131, Bahasa Inggeris 166, Sains 452, so that the S6 "Cemerlang" shares read 99 %, 98 % and 97 %; every other subject 100 %), `cemerlang` 146,275 | exact per subject |
| `legacyGeneric` | 373 rows, all scored (S6 "Legacy Generic") | inside cemerlang/baik scored cells |
| `curriculumChapterId` | per-chapter eligible counts supplied by M05 (§6.12 there, e.g. MATH D1 Bab 1 464, Bab 2 302, Bab 3 316; BM D1 Bab 1 320, Bab 2 317, Bab 3 321) | inside eligible cells of that subject and level; each chapter total ≤ its cell; the rest `null` |
| `pkskDomainId`, `pkskTargetLevel` | 763 PKSK rows by domain × level (M07 §6.x totals, T1 383 / T4 380); difficulty 253 / 253 / 191 / 66 / 0 (M17 XR-10, required of M07; the observed anchors at 2 and 3 fit) | a separate PKSK cell family (subject and level null, approved, active, mcq A/B or essay C), all anchored by M07 |

**D9 values the spec is built to** (live contradicts itself):
- **DV-M04-04:**
  - Q-ALL 465,278 is the pager total, with tiles and statuses reconciled.
  - The S6 score-by-level sum (146,796) is 230 below the per-subject sum (147,026). T4 absorbs the 230 (PROPOSED).
- **DV-M04-19 (v1.17, as built):** the S10 seeds hold 6 submissions (the 4 observed plus the PROPOSED id 5 `pending` and id 6 `rejected`, mandated by §6.11 to cover every status), so the S10 count is 6 against 4 on live. Alternative: seed only the 4 observed rows, which leaves `pending` and `rejected` without a fixture. Chosen: the 6 rows. PROPOSED.
- **DV-M04-20 (v1.18, D9):** live clips the label of a narrow "Taburan Kualiti" segment (the "0.5" label is cut off, so the figure is unreadable). The rebuild moves the label just below the bar when its segment is narrower than 8 %; wider segments keep the label inside. Rejected alternative: replicate the clipping. Chosen: label below the bar. Minimal fix; no value changes.
- **DV-M04-21 (D54, 2026-10-24, user decision "buang skop sekolah rendah (darjah)"):** chapter-linked practice questions move from Darjah 1–4 to Tingkatan 4–5. Q-PRACTICE counts T4/T5 rows (Table A cell per subject and level); Q-CHAPTER is non-zero for the M03 T4/T5 chapters (223 chapters of 20 subjects, ≥ 39 questions each) and for the admin's observed BM anchors only on Darjah 1/2. The Darjah 1–4 difficulty pins, Table A–C, S10 and all other named queries are unchanged. Chapter totals per pair are an even split (PROPOSED). See URS §7 DV-M04-21.
- **DV-M04-18:** Prinsip Perakaunan approved = 2,970. The status split is therefore 146,330 / 318,948 (live 145,689 / 319,589).
- **PROPOSED splits, not observed:** the level spread of inactive rows and of active rows above Darjah 4 (outside the pins), the placement of the 400 archived-active rows, the difficulty spread of the non-observed cells, and the PKSK difficulty split. They are labelled PROPOSED and no screen asserts them.

**Anchors (seed phase) and their cells** (v1.6, XL-39). Each anchor claims the nearest slot of its own cell. The script `anchors.js` checks every M04 anchor and every contributed anchor against the cell capacities of Tables A/B and the M06 pool cells: **all fit, 0 violations**. "Eligible" = approved and active; "pool" = `spmPool = true` at that difficulty.

| Anchor(s) | Cell | Capacity |
|---|---|---|
| 564159, 564161, 561050 | Sains T5, eligible, pool, difficulty 3 | 293 |
| 564160 | Sains T5, eligible, pool, difficulty 4 | 86 |
| 564157, 564158 | Sains T5, eligible, pool, difficulty 2 | 498 |
| 563393 | Biologi T5, eligible, pool, difficulty 2 (needsDiagram) | 531 |
| 562177, 570021 | Pendidikan Moral T5, eligible, pool, difficulty 2 (562177 needsDiagram) | 402 |
| 129732, 129650, 129614 | Bahasa Inggeris T5, eligible, pool, difficulty 2 | 313 |
| 122411 | Fizik T5, eligible, pool, difficulty 2 | 268 |
| 570022 | Fizik T5, eligible, pool, difficulty 3 (needsDiagram) | 332 |
| 560001, 559916 | Matematik T4, eligible, pool, difficulty 2 | 309 |
| 570024 | Matematik T4, eligible, pool, difficulty 3 (legacy, baik) | 410 |
| 570023 | Kimia T4, eligible, pool, difficulty 2 | 442 |
| 129114, 129216, 136891 | Matematik T5, inactive (129114/129216 archived, quarantined, `le50`; 136891 approved-inactive) | 2,587 |
| 124733 | Sejarah T5, inactive, archived (legacy) | 1,461 |
| 570004 | Biologi T4, eligible, non-pool | 1,204 |
| 570005 | Sejarah D6, eligible, non-pool | 204 |
| 570006 | **Sains T1**, eligible, non-pool (was T4: no non-pool room) | 900 |
| 570020 | Bahasa Arab T3, eligible, non-pool (needsDiagram) | 500 |
| 570025 | **Bahasa Tamil T1**, eligible, non-pool (was D2: pinned 0) | 2,100 |
| M05 600001–600033 / 600034–600035 / 600036–600065 | BM D1 / BM D2 / Matematik D1, eligible, non-pool | 958 / 2,540 / 2,734 |
| M08 700001–700008, 700101–700128 | Kimia T5, eligible, non-pool | 493 |
| M08 700201–700215 | Sejarah T4, eligible, **pool** (difficulty 2; Sejarah T4 has no non-pool room, XL3-11) | 184 |
| M07 177698–178460 | the PKSK cell family (exactly 763) | 763 |
| State profile 570001–570003, 570010–570013 | override cells of count 1 (test-only) | 1 each |

A cell with more anchors than its count fails the build.

#### 6.13.2 Contributed anchors (`questions.contributeAnchors`, X-8)

Other modules pass these records in their seed phase. Each one takes the place of a generated slot in its own cell, so **no total changes**. If a module contributes more anchors to a cell than the cell count allows, the build fails.

| Contributor | Ids | Records | Cell bucket (facets) | Room in the bucket (Table A cell) |
|---|---|---|---|---|
| M05 practice anchors (M05 §6.15, `sourceSet: 'm05_practice_anchor'`) | 600001–600065 | BM D1 × 33 (Bab 1 × 18, Bab 2 × 5, Bab 3 × 10), BM D2 × 2, MATH D1 × 30 (Bab 1 × 20, Bab 2 × 5, Bab 3 × 5) | subject 1 or 3; level 1 or 2; approved; active; mcq; `spmPool = false`; `curriculumChapterId` set; difficulty 1–4 | BM D1 958 (= chapters 320 + 317 + 321) · BM D2 2,540 · MATH D1 2,734; each chapter count ≥ its anchors |
| M06 SPM pool (M06 §6.10) | cells, not rows: the pool counts of 19 subjects × T4/T5 × difficulty (`spmPool = true`); anchors inside the pool are existing M04 anchors with `spmPool = true` (564157–564161, 563393, 561050, 570021–570024) | 21,033 pool rows | approved; active; mcq; level 10/11; `spmPool = true` | fits inside each subject's eligible T4/T5 cells (checked lower bounds) |
| M07 PKSK (M07 §6.x) | 177698–178460 (763, contiguous) | all PKSK questions, including the live anchors (e.g. 178460, 178359, the 13 "inovasi" rows) | the PKSK cell family: `pkskDomainId` set; subject and level null; status as M07 (763 approved live) | exactly 763, all anchored |
| M08 designed data (M08 §6.x, `sourceSet: 'm08_fixture'`) | 700001–700008, 700101–700128, 700201–700215 (51) | Kimia T5 × 36 (DSKP SPs 9001–9004); Sejarah T4 × 15 | subject 10 or 5; level 11 or 10; approved; active; mcq; Kimia `spmPool = false`, Sejarah `spmPool = true` (XL3-11, M17 XR-09) | CHEM T5 895 (pool 402 + 36 anchors fit) · SEJ T4 777 = its pool (the 15 anchors are pool rows) |
| M04 coverage anchors (§6.11) | 570004–570006, 570020–570025 | 9 rows (approved, active) | their own subject/level cells | ≥ 1 each |
| M10 teacher anchors (M10 R-M04-03) | 522425–522447 (23; 522425–522427 and 522445–522447 observed texts, the rest generated texts) | BM D6 MCQ, approved, active, difficulty 4, `dskpTagged`, `sourceSet` "textbook_content_rebuild", `createdBy` 1, created 2026-05-02, `teacherDatabank` | BM D6 eligible non-pool | 400 |
| M10 teacher anchors | 525431–525433 | BM T1 MCQ difficulty 1, "chapter_textbook_rebuild", `teacherDatabank` | BM T1 eligible non-pool | 2,104 |
| M10 teacher anchors | 525428–525430 (ids assigned by M04; live ids not captured) | BM T3 MCQ difficulty 3, "Soalan kefahaman: … Tema Destinasi Misteri", "textbook_content_rebuild", `teacherDatabank` | BM T3 eligible non-pool | 1,500 |
| M10 teacher anchor | 700302 | BM T5 MCQ difficulty 2, approved, active, `spmPool = false`, `createdBy` 5 | BM T5 eligible non-pool | 78 |
| M10 test fixture | 700301 (Kimia T5 MCQ difficulty 3, `pending_review`, active, `createdBy` 5) | **not in the default seed** (live admin "Menunggu Semakan" 0): the M10 E2E creates it at runtime with the test hook `questions.createFixture` (overlay insert with this reserved id) | — | — |
| M18 critical-question anchors (M18 XR-M18-10, XR-M18-19) | 701001–701099 (20 KLUANG, 8880's 20 + the T4 variant, 8765's 6; ≤ 99) | MCQ, approved, active, stems/options/keys/subject/topic as M18 §6.11 lists them; non-pool unless T4/T5 SPM-subject (then pool rows); no difficulty is requested (the card label comes from % salah) | the eligible cells of their subjects and levels; every T-level cell has ≥ 78 free non-pool rows or pool room | fits (≤ 47 rows) |
| M11 anchors (M11 §6.7, XR-M11-05) | 700401–700931 (≤ 531: Student A 71, B 195, C 265 answers, one question per answer unless M11 lists fewer) | MCQ, approved, active, with `chapterLabel` and `curriculumTopicId`; T4/T5 anchors are pool rows (`spmPool = true`): BM T5 65, BM T4 1, SEJ T5 83, SEJ T4 12, BI T5 55, BIO T5 75, BIO T4 15, PI T5 70, PHY T5 15, MATH T5 15, SCI T5 10, SCI T4 9; others non-pool: SEJ T3 75, SCI T3 2, SCI T2 3, SCI T1 26 | pool room per subject/level and non-pool room checked (e.g. SEJ T5 pool 762, BI T5 pool 752) | fits |

The M08 fixtures carry `dskpSpId` 9001–9004 (`dskpTagged = true`); M10 seeds those SPs, the admin SPs 221, 206, 222, 214, 179, 194, 418 and the generic SP of every pair (M10 §6.9). M05 anchors carry a `dskpSpId` only if M05 §6.15 declares one; until then they are `dskpTagged = false`. The M08 claim of 9101–9108 on M05 anchors depends on that declaration (XL round 2, R2.4).

#### 6.13.3 `structuredQuestions` (owner M04)

| Item | Value |
|---|---|
| Total N | **4,064** (admin S8). The student-visible count is 4,059 (published and active). |
| Facets | `subjectId`, `educationLevelId` (10/11), `kbatLevel` 1–6, `status` (all `published`), `isActive`, `needsDiagram` |
| Generated id range | 393–4456 (4,064 consecutive ids; live ids 505 … 4456 are inside) |
| Observed counts | Per subject (S8 pills): BI 774, BM 560, BIO 219, EKON 42, PHY 246, GEO 21, CHEM 232, MATH 299, ADDMATH 256, PERNIAGA 763, AKAUN 76, SCI 204, SK 22, SEJ 328, TI 22. `kbatLevel = 5`: 483 (S8 filter). BM `kbatLevel = 6`: 3. MATH `kbatLevel = 6`: 0 (M06). Inactive rows: 5 (BM 1, BI 1, MATH 1, BIO 2), so the student counts equal M06 (BI 773, BM 559, MATH 298, BIO 217 …). `needsDiagram`: 522 (Fizik 6, Bahasa Arab 0). |
| PROPOSED splits | T4/T5 per subject, the KBAT 1–4 spread and the remaining `needsDiagram` spread |
| Anchors | the §6.11 structured anchors (3698–3706, 2505, 2509–2511, 4454–4456). M05 and M06 contribute no structured rows: they cite these anchors. |

#### 6.13.4 `jutawanQuestions` (owner M04, XL3-10)

| Item | Value |
|---|---|
| Total N | **149,911** (separate from the 466,041 question rows; no other query counts them) |
| Facets | `subjectId`, `educationLevelId`, `difficultyLevel` |
| Cells | the 143 subject × grade counts of M16 discovery A.7 (OBSERVED), e.g. D1: BM 1,009, BI 1,027, MATH 2,754, SCI 3,288, SEJ 862, PI 985, PM 1,013, GEO 200, BA 400, JAWI 300; T1: SEJ 2,974, PM 3,593, PSI 363; T5: PSI 143 (the smallest cell). Each cell split evenly over difficulty 1–4 (PROPOSED). |
| Id range | 1–149,911 in the store's own id space (INFERRED; live ids not observed) |
| Anchors | none (no Jutawan question was observed) |
| Contract | `questions.jutawan.count(subjectId, level)` = Q-JUT-COUNT; `sample({subjectId, level, difficulty?}, n, rng)`; `get(id)`; `gradeAnswer(id, optionId)` |

#### 6.13.5 `importRuns` (owner M04, XL3-11)

| Item | Value |
|---|---|
| Total N | **1,123** runs (M17 S10 "Jumlah Import") |
| Facets | `createdAt` month, `importedCount` (sum-constrained) |
| Observed counts | Σ `importedCount` = 31,101 (M17 "Soalan Diimport"); 0 runs created in August or September 2026 ("Import Bulan Ini" 0, "Import Lepas" 0) |
| PROPOSED | per-run `importedCount` (largest-remainder split of 31,101), `failedCount` 0–3, file names, dates spread from 2025-11 to 2026-07 |
| Anchors | the seeded run "soalan-bm-d3.csv" (12 imported, 1 failed), dated 2026-07-20 (inside the 1,123; id 1123, PROPOSED as built v1.13) |
| Ids | 1–1,123; runtime runs from 1,124 |

## 7. Mock API endpoints

Conventions: SRS.md §7 (list envelope `{data, meta}`, single `{data}`, error `{error:{code,message,fields}}`). Request/response keys are camelCase; list `meta` adds module-specific aggregates. Every mutating call needs an admin session unless stated. Mock latency default 300 ms (test-configurable, NFR-M04-02). File uploads are sent as `multipart/form-data` and kept in memory as object URLs.

| # | Method | Path | Request | Response | Kind |
|---|---|---|---|---|---|
| 1 | GET | `/api/questions` | query `subjectId, educationLevelId, difficultyLevel, status, dskpFilter, complianceFilter, sourceFilter, search, page` (unknown keys ignored) | `{data:[QuestionRow], meta:{page, pageSize:20, totalItems, totalPages}}`, order BR-M04-31; PKSK rows never included (BR-M04-33); QuestionRow = id, questionText, subject{id,name}, level{id,name}, difficultyLevel, status, isActive, complianceStatus, aiVerified, dskpTagged, sourceType, sourceFile | read |
| 2 | GET | `/api/questions/summary` | — | `{data:{total, subjects:[{id, name, icon, group:'teras'|'elektif', total, approved}]}}` (31 subjects) | read |
| 3 | POST | `/api/questions` | multipart: fields of §5 (`subjectId, educationLevelId, dskpSpId?, difficultyLevel, questionType, questionText, questionImage?, options[], optionImages[], correctAnswer, tfAnswer, correctAnswerText, altAnswers, modelAnswer, explanation, language, pointsValue`) | 201 `{data: Question}` · 422 `VALIDATION_ERROR` | mutating |
| 4 | GET | `/api/questions/:id` | — | `{data: Question + subject, level, dskp{bidang, sk, sp} \| null, createdBy{name}}` — PKSK rows included with `pkskDomainId`, `pkskTargetLevel`, `pkskOptions` · 404 `NOT_FOUND` | read |
| 5 | PUT | `/api/questions/:id` | as #3 without `questionType`, plus `removeQuestionImage, removeOptionImage[0..3]` | `{data: Question}` · 422 | mutating |
| 6 | DELETE | `/api/questions/:id` | — | 200 `{data:{deleted}, status}` · 404. **As-built deviation (v1.17):** not 204; the flash message comes from the API `status` field | mutating |
| 7 | POST | `/api/questions/bulk-action` | `{action:'approve'|'reject'|'archive'|'delete'|'pending_review', ids:[int]}` | `{data:{affected:int}}` · 422 (no action / no ids) | mutating |
| 8 | POST | `/api/questions/:id/ai-explanation` | query `force=1` optional | success HTTP 200 `{ok:true, message}`; failure HTTP 500 `{ok:false, message}` or without `message`; test hooks can also return a non-JSON body or a network error so the card's FR-M04-46 branches can be exercised | mutating (simulated AI, D4) |
| 9 | POST | `/api/question-imports` | multipart `csvFile, defaultSubjectId?, defaultEducationLevelId?, defaultDifficultyLevel?` | 201 `{data: ImportRun}` · 422 (file type/size) | mutating |
| 10 | GET | `/api/question-imports` | `page` | envelope of ImportRun (DV-M04-01) | read |
| 11 | GET | `/api/question-imports/template` | — | `text/csv` file `template-import-soalan.csv` | read |
| 12 | GET | `/api/question-quality` | — | `{data: QualitySummary}` | read |
| 13 | POST | `/api/question-quality/audit` | — | `{data:{lastAuditAt}}` | mutating |
| 14 | GET | `/api/question-reports` | `status=pending|reviewed|fixed|dismissed|all` (default pending; unknown → empty list, `meta.activeTab: null`) | `{data:[ReportView], meta:{activeTab, counts:{pending, reviewed, fixed, dismissed, all}}}` (no paging); ReportView = report + displayStatus, category, reasonLabels[], question{exists, type, id, text/stimulus, options?, correctAnswer?, subjectName, levelName, complianceStatus, isActive, practiceUrl} + reporter{name} | read |
| 15 | POST | `/api/question-reports` | `{questionId, questionType?, reasons[], comment?, quizSessionId?, source}` (any logged-in user; `source` ∈ `spm`, `structured_attempt`, `latihan`, `revision`, `teacher_databank`; reasons incl. `outdated`) | 201 `{success: true, message:'Laporan berjaya dihantar.'}` · 422 (no reason; v1.19, INFERRED: also 422 when `quizSessionId` or `roomCode` exceeds 64 characters or fails the format check) | mutating |
| 16 | PATCH | `/api/question-reports/:id` | `{status:'fixed'|'dismissed'|'reviewed', adminNotes?, reactivate?, forceDeactivate?}` | `{data:{id, status, adminNotes, updatedAt}, status}` (v1.19; narrower than the full QuestionReport) | mutating |
| 17 | GET | `/api/question-reports/mine` | — (caller) | `{data:[ReportView], meta:{counts:{all, pending, reviewed, fixed, dismissed}}}`. **INFERRED (v1.19, security decision; no live equivalent because live S13 was never observed populated, no DV):** for the caller's own reports the `question` block is `{exists, type, id}` only; students never receive question text, options or the correct answer, and the S13 row has no reporter name | read |
| 18 | GET | `/api/structured-questions` | `subjectId, educationLevelId, kbatLevel, page` | envelope (pageSize 25) of rows {id, stimulusExcerpt, subject, level, kbatLevel, totalMarks, subCount}; `meta.stats:{total, published, bySubject:[{name,count}]}` | read |
| 19 | GET | `/api/structured-questions/:id` | — | `{data: StructuredQuestion + subQuestions[] + createdBy{name}}` · 404 | read |
| 20 | GET | `/api/question-submissions` | `status` | `{data:[Submission + teacher{name,email,school}]}`, `meta.counts:{all,pending,processing,done,rejected}` | read |
| 21 | PATCH | `/api/question-submissions/:id/status` | `{status, adminNotes?}` | `{data: Submission}` · 422 | mutating |
| 22 | GET | `/api/question-submissions/:id/files/:index` | — | file blob (placeholder text with the file name) · 404 | read |
| 23 | GET | `/api/diagram-audit` | `subjectId, schoolId, mcqPage, strPage` | `{data:{mcq:{items, meta}, structured:{items, meta}}, meta:{stats:{mcq, structured, total}, bySubject:[{name,count}] (top 10, unfiltered), unfilteredMcq}}` — `schoolId` applies to `mcq` only (BR-M04-19) | read |
| 24 | POST | `/api/diagram-audit/:kind/:id/image` | `kind` = `mcq`\|`structured`; multipart `image` | `{data:{id, needsDiagram:false}}` · 422 | mutating |
| 25 | POST | `/api/diagram-audit/:kind/:id/dismiss` | — | `{data:{id, needsDiagram:false}}` | mutating |
| 26 | GET | `/api/master-notes` | `tab=flagged|approved|all` (default flagged), `page` | envelope (pageSize 15), `meta.summary:{flagged, teacherApproved, total}` | read |
| 27 | POST | `/api/master-notes/:id/:action` | `action` = `approve`\|`regen`\|`unflag` | success HTTP 200 `{ok:true}`; failure a non-2xx status (e.g. 500 `{ok:false}`) — the page judges success by the HTTP status only | mutating |
| 28 | GET | `/api/guru/dskp/bidang` | `subjectId, educationLevelId` | `[{id, code, name}]` (bare array, as live) | read — **owned by M10** (M10 #39) |
| 29 | GET | `/api/guru/dskp/sk` | `bidangId` | `[{id, code, description}]` | read — M10 (#40) |
| 30 | GET | `/api/guru/dskp/sp` | `skId` | `[{id, code, description}]` | read — M10 (#41) |
| 31 | GET | `/api/schools?all=1` (lookup) | `all=1` | `{data:[{id, name}]}` — every school (10,220, active and inactive), sorted by name, no limit | read — **owned by M02** (M02 §7 #43; XL-13) |
| 32 | GET | `/api/subjects` | `educationLevelId?` | `{data:[{id, code, name, nameEn, icon, color, isCore, educationLevelIds}]}` | read — **owned by M03** (#28 there) |
| 33 | GET | `/api/education-levels` | — | `{data:[{id, code, name, nameEn, stage, grade}]}` | read — M03 (#29 there) |

Total: 33 endpoints, 27 owned by M04 (13 read, 14 mutating), 6 referenced (M10 ×3, M02 ×1, M03 ×2).

### 7.1 Store contract for other modules (D12) and canonical paths

M04 owns the question store and the structured store. Other modules call these repository functions (architecture §6.7: `questions.*`, `structured.*`, `reports.*`; earlier drafts and other SRSs wrote `questionStore.*` / `structuredStore.*` for the same functions), not their own copies. Mutating calls from other modules use the viewer's session (teacher or admin for the M10 writes); every other M04 mutating endpoint needs an admin session. There is no HTTP alias for them in the prototype; a future backend may expose them as internal endpoints.

| Function | Used by | Returns / rule |
|---|---|---|
| `questions.get(id)` | M04, M07 (PKSK detail) | any row incl. PKSK and inactive; `null` if unknown |
| `questions.getEligible(id)` | M06 `question_id` sessions, "Buka Soalan Sama", M05 revision | the row only if eligible (BR-M04-03), else `null` |
| `questions.practiceQuery({subjectId?, educationLevelIds?, difficultyLevel?, curriculumChapterId?, excludeIds?, limit, seed})` | M05 drills/chapter mode, M06 pools | eligible non-PKSK MCQ rows only, deterministic order by `seed` |
| `questions.countWhere(filter)` / `questions.count(name, ...params)` | M01, M03, M04, M05, M06 counts | from the allocation table (BR-M04-34); names per §4.1 (Q-ALL, Q-APPROVED, Q-ACTIVE, Q-ELIGIBLE, Q-PKSK …). As built, `countWhere` excludes PKSK rows unless the filter gives `pkskDomainId` |
| `questions.spmPool({subjectId, educationLevelIds:[10,11], difficultyLevel?})` | M06 S2–S4, M06 Tracking A sets | Q-SPM-POOL (BR-M04-32: `spmPool` facet ∧ eligible; query + count) |
| `questions.pkskList` / `pkskGet` / `pkskCreate` / `pkskUpdate` / `pkskDelete` (by `pkskDomainId`) | M07 only | PKSK rows (BR-M04-33) |
| `questions.contributeAnchors(module, rows)` | M05, M06, M07, M08, M10, M11 (seed phase only) | validates each row against DATA-M04-01 and places it in its cell (§6.13.2); a cell over-subscribed fails the build |
| `questions.contributeCells(contributor, cells)` | non-owners contributing distribution cells, e.g. the M06 SPM pool (seed phase only) | the owner validates each cell against the §6.13 spec (facets, totals, room inside Table A); an inconsistent cell fails the build. `overrideSpec` (spec overrides such as the state profile or test overrides) is owner-only |
| `structured.visible({subjectId?, kbatLevel?, scope?, track?, page})` | M05 S10/Q3, M06 S7–S9 | published + active T4/T5 rows (FR-M04-115), pageSize 20 |
| `structured.get(id)` | M04 S9, M05 Q3 | any row; `null` if unknown |
| `reports.create(report)` | M04 modal (all hosts), M10 S28 databank report | BR-M04-11/12; returns `{success, message}` |
| `questions.createFromTeacher(viewer, input)` / `questions.updateOwn(viewer, id, patch)` / `questions.deleteOwn(viewer, id)` / `questions.importFromTeacher(viewer, csv)` | M10 #53–#58 | BR-M04-35 (`pending_review`, `isActive = true`, `createdBy` = viewer, ids ≥ 9,000,001) |
| `questions.contributions(user, {status?, subjectId?, page})` | M10 S1, S21–S24 | Q-CONTRIB (ids ascending, 20 per page) |
| `questions.teacherDatabank(subjectId, {q?, questionType?, sourceFamily?, difficulty?, dskpSpId?, page})` | M10 S28 | Q-TEACHER-DATABANK (id desc, 15 per page) |
| `questions.spAvailable(dskpSpId, {levelId?})` | M08 S6/S7 | Q-SP-AVAILABLE |
| `submissions.create(input: SubmissionInput, now: number)` / `submissions.list(status?: string)` (v1.17, as built) | M10 (teacher paper uploads), M04 S10 | QuestionSubmission (DATA-M04-05, endpoints #20–#22). `create`: `input = {teacherId, subjectText, levelCode?, year, paperType, authorCredit, note?, files: [{name, size, mime}]}` (`teacherId` is a field of the input, not a viewer argument); `now` is the mock clock in ms (`createdAt` = `toIsoMyt(now)`); at least one file, else a `CONTRACT` error; the row starts `pending` with `adminNotes` null; file `index` is assigned 0-based. `list`: one status or all, id descending (newest first), rows without the teacher join (the handler adds `teacher{name,email,school}`). Also `get(id)`, `counts()` (`meta.counts`: all, pending, processing, done, rejected, over every row), `updateStatus(id, {status, adminNotes?})` (#21; `null` if unknown id; any status may follow any other) and seed-phase `seedRows` |
| `masterNotes.list(tab: 'flagged' \| 'approved' \| 'all', page: number)` / `summary()` / `act(id: number, action: 'approve' \| 'regen' \| 'unflag')` / `get(id)` (v1.17, as built) | M04 S12 only (#26–#27) | `list`: id descending, 15 per page (BR-M04-23), returns the paged query result. `summary()` = `{flagged, teacherApproved, total}`. `act`: `approve` → approved and unflagged; `unflag` → unflagged; `regen` → the next of the 3 canned notes (PROPOSED texts; flags kept, `regenCount` + 1); `null` for an unknown id. Seed-phase only: `seedRows(rows)` and `applySeedOverride({flagged?: number[], approved?: number[]})` (E2E-M04-52; unknown ids or keys are `CONTRACT` errors) |
| `questions.sampleKeyless(filter, n, rng)` / `questions.gradeAnswer(id, optionId)` | M05, M06, M16 (battle and game pools) | confirmed for M16 XR-M16-01 (b): `filter` accepts `{educationLevelIds, subjectId?, questionType: 'mcq', eligible: true}`, the PKSK filter `{pkskDomainId, pkskTargetLevel}` and `spmPool`; rows are returned **without keys**; `gradeAnswer` returns `{isCorrect, correctOptionId}` |
| `questions.jutawanCount(subjectId, level)` / `questions.jutawanSample({subjectId, level, difficulty?}, n, rng)` / `questions.jutawanGet(id)` / `questions.jutawanGradeAnswer(id, optionId)` | M16 S19 and the Jutawan game | BR-M04-37, §6.13.4 (Q-JUT-COUNT; keyless rows) |
| `questions.count('Q-M17-COV', …)`, `count('Q-TEACHER-CONTRIB', scope)` (same contract as `questions.teacherContributions(schoolId?)`, v1.14; never a join of `createdBy` to the teacher role, BR-M04-38(c); count-only because it spans the objective and structured stores — `where`, `groupCount`, `query` and `sample` are unavailable for this name, so per-school figures come from `count(…, schoolId)`); **per teacher (v1.15, XL3 B-01):** `questions.teacherContributions({teacherId})` → `{mcq, structured}` with `structured` = `count('Q-TEACHER-CONTRIB-STR', {teacherId})` and `mcq` = `count('Q-TEACHER-CONTRIB', {teacherId})` − `structured`, over the rows with `createdBy = teacherId` (v1.16: 4202 497 / 1,062; 4501 871 / 2; 4502 1,184 / 219; 4503 13 / 0; 4504 1 / 0; 5316 5,547 / 0; any other teacher 0 / 0; the placeholder 5801 is not a teacher and is never listed), `importRuns.count('Q-IMPORT-RUNS')` / `importRuns.importedTotal()` / `importRuns.countByMonth(month)` | M17 S10/S11, M04 S5h | BR-M04-38, §6.13.5 |
| `reports.create({… source: 'papan_bijak', roomCode})` | M16 rooms (PROPOSED; no room report entry point observed) | legacy source accepted (BR-M04-11); "Bilik: {code}" on S7 |
| `questions.createFixture(row)` (test hook, dev/e2e only) | M10 E2E (700301) | overlay insert with a reserved anchor id |
| `structured.create / update / delete / toggleStatus` | M10 #46–#50 | BR-M04-36 |
| `structured.list({viewer?, subjectId?, educationLevelId?, status?, page})` | M10 S17 | order `updatedAt` desc, ties id asc (M10 BR-M10-20) |

**As-built names (v1.13, F-25).** The table above uses the names as built. Earlier versions of this SRS, other modules' SRSs and FR/E2E text may use the draft names; they map as follows: `questions.query` → `practiceQuery`; `questions.count(filter)` → `countWhere` (named counts stay `count(name, …)`); `questions.sample` → `sampleKeyless`; `questions.pksk.*` → `pkskList` / `pkskGet` / `pkskCreate` / `pkskUpdate` / `pkskDelete`; `questions.jutawan.*` → `jutawanCount` / `jutawanSample` / `jutawanGet` / `jutawanGradeAnswer`; `structured.query` → `structured.visible`; `importRuns.count` → `count('Q-IMPORT-RUNS')`; `importRuns.sum` → `importedTotal()`; `importRuns.countByMonth` → `countByMonth(month)`. The dataset framework (F-09) reserves `count`, `groupCount`, `query`, `sample`, `where` and `contributeAnchors`, so store-specific functions do not reuse those names. Behaviour and contracts are unchanged.

**Canonical structured paths (XL-24):** admin reads `/api/structured-questions` and `/api/structured-questions/:id` (#18, #19, M04); student practice reads `/api/practice/structured`, `/api/practice/structured/:id` and posts `/api/practice/structured/:id/attempts` (M05 #15–17) over the same store. `/api/structured-sets` is not a valid path.

## 8. States & messages

### 8.1 Shared pager (S1, S8, S11 ×2, S12, S5h)

Laravel "tailwind" pager, English, exactly as live: ≥640px "Showing **{from}** to **{to}** of **{total}** results" (numbers without separators), prev chevron (aria "&laquo; Previous", disabled on page 1), page links (aria "Go to page {n}", current page unlinked), "..." gaps with `onEachSide = 3` window (pages 1–10 then last two on page 1), next chevron (aria "Next &raquo;"); <640px "« Previous" / "Next »" buttons, plain text when disabled. Hidden when there is only one page. S11 pagers keep `subject_id`/`school_id` (DV-M04-16).

### 8.2 Per screen

| Screen | State | Copy / behaviour |
|---|---|---|
| All data screens | Loading | Skeleton rows/cards in the content area (FR-G-10); shell stays. |
| All data screens | Load error | "Maaf, berlaku ralat. Sila cuba semula." + "Cuba Semula" (FR-G-10; copy from the shared layout script string; UNVERIFIED as a page state). |
| All data screens | Error without a usable message | Generic fallback "Ralat berlaku. Sila cuba lagi." — INFERRED / UNVERIFIED COPY; used only when an error carries no usable message. |
| S1 | Empty | "Tiada soalan dijumpai" + "Tambah Soalan Pertama". |
| S1 | Bulk: no action / confirm | native required bubble on the action select (browser text, e.g. "Please select an item in the list."; the script alert is never shown) / "Adakah anda pasti mahu {verb} {n} soalan?" |
| S1, S3 | Delete confirm | "Adakah anda pasti mahu memadamkan soalan ini?" |
| S1 | Flash after bulk / delete | "{n} soalan berjaya dikemaskini." / "Soalan berjaya dipadam." (UNVERIFIED COPY) |
| S2 | Flash after save | "Soalan berjaya ditambah." (UNVERIFIED COPY) |
| S2/S4 | Field errors | §5 (UNVERIFIED COPY), red text under the field, fields keep input. |
| S3 | Status confirm / flash | "Adakah anda pasti mahu mengubah status soalan ini?" / "Status soalan berjaya dikemaskini." (UNVERIFIED COPY) |
| S3 | AI card | empty "Belum ada Penjelasan AI untuk soalan ini. Klik butang untuk jana."; loading "Sedang menjana penjelasan... (anggaran 5-15 saat)"; error (FR-M04-46): JSON `message` / "HTTP {status}" / browser JSON-parse text (mock fixed string "Unexpected token '<', \"<!DOCTYPE \"... is not valid JSON") / "Failed to fetch"; the empty state is shown again beside the error; element default text "Ralat tidak diketahui"; regenerate confirm "Jana semula Penjelasan AI? Versi lama akan ditimpa." |
| S4 | Flash after update | "Soalan berjaya dikemaskini." (UNVERIFIED COPY) |
| S5 | Flash after import | "Import selesai: {x} soalan diimport, {y} gagal." (UNVERIFIED COPY) |
| S5h | Empty | "Tiada sejarah import." (DV-M04-01, PROPOSED COPY) |
| S6 | Submitting / flash | "Sedang audit..." / "Audit kualiti selesai." (UNVERIFIED COPY) |
| S7 | Empty / unknown status | `fa-check-double` "Tiada laporan buat masa ini" in both cases; with an unknown status no tab is active |
| S7 | Flash after action | "Laporan berjaya dikemaskini." (UNVERIFIED COPY) |
| S8 | Empty | row "Tiada soalan berstruktur ditemui", counter "Menunjukkan 0 daripada 0 soalan" (DV-M04-12, PROPOSED COPY) |
| S10 | Empty / flash | "Tiada rekod ditemui" / "Status kertas soalan berjaya dikemaskini." (UNVERIFIED COPY) |
| S11 | Empty / flash | "Semua soalan sudah lengkap dengan gambar rajah!" / upload "Gambar rajah berjaya dimuat naik." / dismiss "Soalan telah dikeluarkan daripada senarai audit." (UNVERIFIED COPY) |
| S12 | Empty / buttons | "Tiada nota dalam tab ini." / clicked button disabled + "..." → HTTP success: "Done", still disabled, row 50% opacity / HTTP failure: label restored, enabled |
| S13 | Empty | "📋" "Tiada Laporan" "Anda belum menghantar sebarang laporan soalan." |
| S13 | Rows (v1.19) | Row copy is INFERRED (live S13 never observed populated). Rows omit the "Oleh" line, the question block (text, options, answer; only `{exists, type, id}` is available, §7 #17) and the source badge. |
| S14 | Sending / done / error | "Menghantar..." / "Terima Kasih!" + message ("Laporan berjaya dihantar.") + "Tutup" / "Ralat. Sila cuba lagi." |

Flash messages appear in the shared admin flash banner (global shell; green success, red error), as other admin modules.

## 9. Permissions matrix

| Role | View | Create | Edit | Delete / status | Notes |
|---|---|---|---|---|---|
| Admin | S1–S14 | questions (S2), imports (S5), reports (S14) | questions (S4), report status (S7), paper status (S10), diagram flags (S11), master notes (S12) | questions (S1/S3), bulk status | OBSERVED (single admin account) |
| Pelajar | S13 (own reports), S14 on practice pages | reports | — | — | INFERRED |
| Guru | S14 (INFERRED), S13 own reports (INFERRED) | reports (INFERRED); structured questions and papers in M10 | structured questions in M10 | — | INFERRED |
| Ibu Bapa, Penaja, Admin Sekolah, Pegawai PPD/JPN | S13 if they can practise (INFERRED) | reports (INFERRED) | — | — | INFERRED; `/admin/*` refused |
| Guest | — | — | — | — | redirected to `/login` |

## 10. Responsive behaviour

Admin shell: sidebar inline at ≥1024px, off-canvas below with the bottom nav and "Lagi" menu (global, M23/NFR-RESP-04). User-portal shell (S12–S14): sidebar ≥1024px, drawer + bottom nav below (global). Breakpoints named as Tailwind (`sm` 640, `md` 768, `lg` 1024).

| Screen | 375 (base) | 768 (`md`) | 1280 (`xl`) |
|---|---|---|---|
| S1 | Header stacks; button "Tambah"; tiles 4 per row (as live); filter grid 2 columns (`grid-cols-2`, as live — works and fits, D10); table scrolls inside its card with "Soalan" min-width 240px (DV-M04-09); bulk bar wraps; pager "« Previous / Next »". | Filter grid 4 columns (`md:grid-cols-4`); table scrolls in card; English pager wraps inside the viewport (DV-M04-09). | Full table, filter 4 per row, pager on one line. |
| S2/S4 | Single column; DSKP selects stacked; difficulty cards wrap; keyboard = bottom sheet with backdrop. | 2-column grids from `md` (as live); keyboard 580px panel. | As 768 in a wider card. |
| S3 | Main cards then sidebar cards stacked. | Stacked (split starts at `lg`). | 2/3 main + 1/3 sidebar. |
| S5 (+S5h) | Side cards below the form. | Stacked. | 2/3 + 1/3. S5h table scrolls in card below `md`. |
| S6 | KPI 2 columns (`grid-cols-2 sm:grid-cols-4`); bucket cards stacked; subject table fits; action table scrolls in card. | KPI 4 columns; buckets stacked (3 columns from `lg`). | As live. |
| S7 | Tabs wrap; card info then action column below. | Same stacked card. | Info and action column side by side (`lg:flex-row`). |
| S8 | Columns Subjek, Tgk, Markah hidden (<640); Sub-Q hidden (<768); filter 1 column. | Sub-Q visible from 768; filter 4 columns (`sm:grid-cols-4`); pager fits (DV-M04-09). | All columns. |
| S9 | Pills wrap; cards full width. | Same. | Same, wider. |
| S10 | Counters 2 per row (`grid-cols-2 md:grid-cols-4`, OBSERVED); table scrolls inside the card; inline panel inside the row. | Counters 4 per row; table scrolls in card. | Table fits. |
| S11 | Stat cards "2 + 1" (as live, `gambar-mobile.png`): two cards, then "Jumlah" at full width; filter 1 column; cards single column with upload/dismiss under the text. | Filter 3 columns (`sm:grid-cols-3`). | As live. |
| S12 | Rows full width; buttons wrap; user bottom nav. | Same. | Sidebar + rows. |
| S13 | Counters 2 per row, 5 from `sm` (`sm:grid-cols-5`). | 5 columns. | 5 columns. |
| S14 | Modal full-width with margins, scrolls within 90vh (NFR-RESP-07 full-width below `md`). | Centered `max-w-lg`. | Same. |

## 11. Non-functional requirements

| ID | Requirement | Specialises |
|---|---|---|
| NFR-M04-01 | Lists are always server-paged by the mock (S1 20, S8 25, S11 20+20, S12 15); counts come from the D11 allocation tables in <50 ms and a page of rows is generated in <50 ms regardless of the 465,278 total (no full iteration). The real backend will face ~465k rows: indexes on `status`, `subject_id`, `education_level_id`, `compliance_status`, `source_type`, `dskp_sp_id`, `needs_diagram`, and full-text search on `question_text` (backend phase). Boot cost (as built, F-25): building the `searchFields` index takes ~1.7 s at boot; F-09 is optimising it. | NFR-01 |
| NFR-M04-02 | The mock layer SHALL expose test hooks (dev/test builds only): `reset(seedOverrides?)`, `setLatency(ms)`, `failNext(endpoint, status)`, and `setUser(role, userId)`, used by E2E for loading, error and empty states. | NFR-03, FR-G-10 |
| NFR-M04-03 | No external calls: AI explanation and master-note regeneration return canned text (D4); uploads stay in memory; downloads are generated blobs. | D4 |
| NFR-M04-04 | Arabic/Jawi text renders with the "Scheherazade New" web font (fallback "Lateef", serif) in the keyboard panel and in any `dir="rtl"` question text. | NFR-02 |
| NFR-M04-05 | Security review items SEC-M04-01…10 below are replicated with dummy data and must be resolved in the backend phase. | NFR-04 |
| NFR-M04-06 | Accessibility replicates live (D10): labels, `aria-*` (e.g. the pager's "&laquo; Previous" / "Go to page {n}"), titles, focus behaviour, keyboard operability and motion match the live markup; nothing is added. Fixed only where D9-broken: DV-M04-14 (unreadable h1), DV-M04-09 (unreadable column), and the project touch rule NFR-RESP-03 via hit areas. | NFR-02 |

**Security items (for security-engineer review; live behaviour replicated in the prototype)**

| ID | Item | Recommendation for the backend phase |
|---|---|---|
| SEC-M04-01 | One-click, no-confirm state changes: S7 "Tandakan Selesai", "Tolak & Aktifkan Semula", "Nyahaktif Segera"; S11 upload and "Dismiss"; S12 "Approve", "Regenerate" (overwrites the note), "Clear Flag"; S10 "Simpan"; S6 "Jalankan Audit Semula" (DV-M04-10). | Admin-only authorization on every endpoint, CSRF protection, audit-log entries (M23), and keep history/undo for irreversible ones (regenerate, dismiss). |
| SEC-M04-02 | File uploads: question and option images (client `accept` JPG/PNG/WebP, hint ≤2 MB), diagram images (`accept="image/*"`, no size hint — SVG possible), CSV/TXT import ≤5 MB. | Server-side MIME sniffing and size limits, reject SVG/HTML, re-encode images and strip metadata, store outside the web root, virus scan. |
| SEC-M04-03 | CSV import: formula injection when data is later exported to spreadsheets; malformed encodings; very large row counts. | Sanitize cells starting with `=`, `+`, `-`, `@`; row limit; transactional import with per-row errors. |
| SEC-M04-04 | AI endpoint `generate-penjelasan-ai` (+ `force`) and master-note regeneration: cost abuse, prompt injection through question text, and the generated markdown rendered as HTML. | Rate-limit per admin, queue, sanitize rendered markdown (no raw HTML), log model/tokens. |
| SEC-M04-05 | Student report endpoint: one MCQ report deactivates the question immediately ("sementara"); any logged-in user can hide content from everyone. | Per-user rate limit, one report per user per question, threshold or admin confirmation before deactivation. |
| SEC-M04-06 | Stored XSS surface: question text/options (admin and import), student comments shown to admins (S7), admin notes, teacher paper notes, master notes. | Output-encode everywhere (Vue default text binding; never `v-html` except the sanitized AI markdown). |
| SEC-M04-07 | Teacher paper files served by index (`/download/{n}`) and teachers' name, e-mail and school shown on S10 (PDPA). | Authorize per file, signed URLs, malware scan, minimize personal data. |
| SEC-M04-08 | Bulk delete of questions via `ids[]` with no soft delete; ids are client-supplied. | Validate ids server-side, soft delete + restore, cap batch size, confirm server-side. |
| SEC-M04-09 | An admin page (S12) rendered in the student layout and reachable from the user-portal sidebar. | Enforce the admin role server-side on `/admin/master-notes*` regardless of layout. |
| SEC-M04-10 | "Buka Soalan Sama" opens student practice URLs as the admin; a GET may create quiz sessions/attempts (discovery safety note). | Make practice session creation a POST, or mark admin previews so they are not recorded. |

### 11.1 Real-backend security requirements (from G4 security review, 2026-10-01)

Every item is **backend-only; prototype replicates live** (D9: live behaviour works, so the mock and its copy are unchanged). They extend SEC-M04-05 and are binding on the real backend.

| ID | Area | Requirement for the real backend | Related |
|---|---|---|---|
| SEC-M04-11 | Report abuse control (#15) | (a) Throttle per user and per IP, for example 10 reports per hour. (b) One open report per user per question, enforced by a unique key; a duplicate returns 409 or an idempotent 201. (c) The structured-question threshold of 3 counts distinct reporters, not reports. (d) **Product decision needed (SQ-10):** whether a first report from a low-trust account auto-deactivates an MCQ or only flags it for review. (e) Verify that `quizSessionId` and `roomCode` belong to the caller. *Backend-only; prototype replicates live.* | SEC-M04-05, §7 #15, BR-M04-11 |
| SEC-M04-12 | Report transitions (#16) | (a) Reject updates to a closed report (`fixed`, `dismissed`) with 409. (b) Reject `reactivate` together with `forceDeactivate`. (c) Audit the acting admin and a timestamp on every transition. (d) Re-evaluate the structured threshold after a `reactivate`. *Backend-only; prototype replicates live.* | SEC-M04-01, §7 #16 |
| SEC-M04-13 | Question-id enumeration (#15) | The 404 (unknown question) versus 201 (known question) difference reveals which question ids exist. Return a uniform response, or record an explicit decision to accept this. *Backend-only; prototype replicates live.* | §7 #15 |
| SEC-M04-14 | PII minimisation (PDPA) | Do not log comment text or reporter names (application, access or audit logs); log ids only. *Backend-only; prototype replicates live.* | SEC-M04-07, SEC-M04-06 |
| SEC-M04-15 | Own-report data exposure (#17) | `GET /api/question-reports/mine` returns the question block `{exists, type, id}` only; students never receive question text, options or the correct answer. Binding in the real backend as well as the mock (INFERRED decision, no live equivalent). | §7 #17 |

## 12. E2E test scenarios

Every scenario runs on the three Playwright projects **mobile 375×812, tablet 768×1024, desktop 1280×800** (NFR-RESP) unless a step is viewport-specific, in which case the step asserts the behaviour for the current project. Each test starts with `mock.reset()` and an admin session unless stated.

| ID | Scenario | Verifies FR | Verifies AC |
|---|---|---|---|
| E2E-M04-01 | Open S1: header, shell title, active sidebar item (desktop) / bottom nav (mobile), create button label per viewport, summary total, table columns, row order 564159, 564160, 564161, 564157, 564158 (BR-M04-31), first row badges and cells for 564159 (icon + "DSKP", VERIFIED, AI Verified, "Source: TEXTBOOK" + file line, `fa-book` + "Sains" as plain text, stars, "Diluluskan", "ACTIVE"); no "✓"/"📖" characters in the badges. | FR-01, FR-02, FR-07, FR-08, FR-09 | AC-01.1, AC-01.2, AC-01.3, AC-01.4, AC-01.5, AC-01.6 |
| E2E-M04-02 | Tiles: 7 teras (M03 `isCore`) + 24 elektif incl. Bahasa Cina ("0", no "lulus") and Bahasa Tamil ("25,800", "6,300 lulus"); live values e.g. "Bahasa Melay..." 32,905 / 13,081 lulus; Prinsip Perakaunan "6,052" / "2,970 lulus" (DV-M04-18); click Sains → `?subject_id=4`, active style, only Sains rows, "Padam filter subjek — tunjuk semua" returns to all. | FR-03, FR-04 | AC-02.1, AC-02.2, AC-02.3 |
| E2E-M04-03 | Filters: options of each select; `status=archived` shows "Arkib"/"INACTIVE" rows; `compliance_filter=pending_mapping` shows "PENDING MAPPING"; `compliance_filter=missing_source` lists 570006 with "Source: TEXTBOOK" and no file line; `compliance_filter=draft` rows show "Source: TIADA"; `source_filter=marking_scheme` shows "Source: MARKING SCHEME"; `dskp_filter=untagged` shows "Latihan Tambahan"; combined filters + search; `?sort=x&type=y` ignored. | FR-05, FR-06, FR-08 | AC-03.1, AC-03.2, AC-03.3, AC-03.4 |
| E2E-M04-04 | `?search=zzqxv` and `?status=draft&subject_id=31`: empty block (`fa-inbox`, "Tiada soalan dijumpai"), no table/pager; "Tambah Soalan Pertama" is a link (`<a>`) that opens S2. | FR-11 | AC-03.5 |
| E2E-M04-05 | Pager: desktop/tablet "Showing 1 to 20 of 465278 results", window 1–10 … 23263 23264, page 2 link keeps `status`; at 768 the pager's right edge ≤ viewport width; mobile shows "« Previous"/"Next »" with "« Previous" as plain text on page 1. | FR-10 | AC-01.7, AC-30.2 |
| E2E-M04-06 | Bulk bar: hidden; tick 1 → "1 soalan dipilih"; header checkbox → "20 soalan dipilih"; untick → hidden. | FR-12 | AC-04.1, AC-04.2 |
| E2E-M04-07 | Tick 1 row, press "Laksanakan" with no action → the form's `checkValidity()` is false, the action select reports `valueMissing`, no dialog event fires and no request is sent; choose "Arkibkan" with 3 ticked → confirm text; dismiss → no request sent. | FR-13 | AC-04.3, AC-04.4 |
| E2E-M04-08 | Accept "Arkibkan" on 2 rows → rows show "Arkib"; accept "Padam" on 1 row → row gone, total −1; flash visible; filters kept. | FR-14 | AC-04.5 |
| E2E-M04-09 | Row "Lihat"/"Edit" navigate; "Padam" confirm cancel keeps row; accept removes it with flash. | FR-15, FR-16 | AC-05.1, AC-05.2, AC-05.3 |
| E2E-M04-10 | Open S2: header texts, shell title, all fields/placeholders/hints/defaults of both cards, no difficulty selected, "Objektif (MCQ)" selected, "Bahasa Melayu" selected, "Nilai Mata" 1; "Batal" returns to S1. | FR-17, FR-18, FR-19, FR-21 | AC-06.1, AC-06.2, AC-06.4 |
| E2E-M04-11 | Choose a PNG → preview + remove button; remove → prompt text back and input empty; same for option A image. | FR-20, FR-25 | AC-06.3 |
| E2E-M04-12 | Submit empty → native validity blocks (form `checkValidity()` false; first invalid = Subjek); fill all but difficulty → still blocked; switch to "Esei / Subjektif" with empty options → not blocked by options. | FR-22 | AC-06.5 |
| E2E-M04-13 | Create MCQ (Sains, T5, difficulty 3, text, 4 options, correct C) → S1 first row is the new question, flash; create with text "pendek" (<10) → error "Teks soalan mesti sekurang-kurangnya 10 aksara." under the field, input kept. | FR-23 | AC-06.6 |
| E2E-M04-14 | Switch types: MCQ card → T/F card (no default) → "Jawapan Pendek" heading → "Jawapan Isi Tempat Kosong" heading → essay card; back to MCQ keeps typed options. | FR-24, FR-25, FR-26, FR-27, FR-28 | AC-07.1, AC-07.2, AC-07.3, AC-07.4, AC-07.5 |
| E2E-M04-15 | Create one question of each non-MCQ type; open each S3: answer card per FR-43 (Betul highlighted; correct + alternatives; model answer). | FR-23, FR-26, FR-27, FR-28, FR-43 | AC-06.6, AC-10.7 |
| E2E-M04-16 | Keyboard: 36×36 toggle with its title; open → toggle active (blue), "عربي" active, caption "Papan Kekunci Arab", textarea `dir=rtl`, 9 harakat titles; "جاوي" → caption "Papan Kekunci Jawi" and row 1 reads ض ص ث ق ف ڤ غ ڠ ع ه خ ح چ ج د (Jawi keys inside rows 1–3 at the live positions); toggle again closes; S4 has no keyboard button. | FR-29, FR-30 | AC-08.1, AC-08.2, AC-08.3 |
| E2E-M04-17 | Type "ab", place caret at 1, press "ب" → "aبb"; backspace → "ab"; newline inserts "\n"; textarea stays focused. | FR-31 | AC-08.4 |
| E2E-M04-18 | Esc, the toggle and `fa-times` close the panel and the textarea keeps `dir=rtl`; on mobile the panel is a bottom sheet and a backdrop tap closes it; on desktop the panel is 580px wide and below the textarea, and above it when the textarea is scrolled near the window bottom; keys ≥44px tall. | FR-32 | AC-08.5, AC-30.5 |
| E2E-M04-19 | DSKP on S2: Bidang placeholder only until Sains + Tingkatan 5; list shows "T5-SUB4-TEXTBOOK - Sains T5 - Sokongan Bab Buku Teks"; SK/SP disabled until chosen; pick 515 → 2667 → 6191 → "DSKP tagged"; clear Tahap → Bidang placeholder only, SK "2667" and SP "6191" still selected and enabled, "DSKP tagged" visible, `FormData` `dskp_sp_id` = "6191"; set Tahap again → all three reset; Matematik T4 shows the name-only Bidang; a full tag saved → S1 row "DSKP". | FR-33, FR-34 | AC-09.1, AC-09.2, AC-09.3, AC-09.6 |
| E2E-M04-20 | S4 of 564159: Bidang 515 / SK 2667 / SP 6191 shown selected (DV-M04-15), "DSKP tagged", "Buang tag DSKP" visible; save without changes → S3 still shows the three DSKP lines; press "Buang tag DSKP" → three placeholders; save → S3 DSKP "Belum ditag" and S1 badge "Latihan Tambahan". | FR-35, FR-36 | AC-09.4, AC-09.5 |
| E2E-M04-21 | S3 of 564159: header, shell title, status "Diluluskan", text, options with A "Jawapan Betul", "Penjelasan" card, "Maklumat" rows (upper-case labels, DSKP 3 lines, "1 mata", "18/05/2026 23:21"), "Soalan Baharu"; S3 of 570021 shows the statistics card. | FR-37, FR-38, FR-39, FR-40, FR-41 | AC-10.1, AC-10.2, AC-10.3, AC-10.4, AC-10.5 |
| E2E-M04-22 | S3 of 129114: "Diarkibkan", no "Penjelasan" card, "Belum ditag", "(1/5)"; "Padam" confirm cancel keeps the page, accept → S1 without 129114. | FR-37, FR-38, FR-39, FR-40 | AC-10.1, AC-10.2, AC-10.3, AC-10.4 |
| E2E-M04-23 | With `reset({profile:'states'})`: S3 of draft 570001 shows the status buttons; confirm text; accept "Luluskan" → status "Diluluskan"; approved 564159 shows no buttons. | FR-42 | AC-10.6 |
| E2E-M04-24 | AI: empty-state copy; press "Jana Penjelasan AI" with latency 1500 → loading line visible; after reload the rendered explanation (heading, list, table) replaces the empty state. | FR-44, FR-45 | AC-11.1, AC-11.2, AC-11.3 |
| E2E-M04-25 | AI errors (hooks on #8), each followed by the empty text and "Jana Penjelasan AI" visible again beside the error box: HTTP 500 JSON with message "Kuota AI habis" → that text; HTTP 500 JSON without message → "HTTP 500"; HTTP 200 `{ok:false}` → "HTTP 200"; non-JSON reply → the parse-error text; network error → "Failed to fetch"; "Gagal jana penjelasan" never appears. | FR-46 | AC-11.4 |
| E2E-M04-26 | S3 of 570023 (has explanation): regenerate → confirm text; cancel keeps text; accept → new canned text. | FR-47 | AC-11.5 |
| E2E-M04-27 | S4 of 564159: header, shell title, pre-filled fields, no type select, options required, correct A checked; "Batal" → S3; change text and save → S3 shows new text + flash. | FR-48, FR-49, FR-52 | AC-12.1, AC-12.2, AC-12.5 |
| E2E-M04-28 | With `reset({profile:'states'})`: S4 of 570010, 570011, 570012, 570013 show their own answer cards pre-filled; saving 570011 with new alternatives works without MCQ fields. | FR-50 | AC-12.3 |
| E2E-M04-29 | S4 of 570022: choose new image → "Tukar gambar"; remove question image and option B image → request carries `removeQuestionImage=1`, `removeOptionImage[1]=1`; S3 shows no image. | FR-51 | AC-12.4 |
| E2E-M04-30 | S5 render: shell title, links, file input accept `.csv,.txt` required, defaults ("Mudah" selected), footer, template/format (with " (atau guna Tetapan Lalai)")/tips cards; submit without file blocked. | FR-53, FR-54, FR-55 | AC-13.1, AC-13.2, AC-13.3, AC-13.4 |
| E2E-M04-31 | Import a 3-row CSV (one row missing `subject_id`) with "Subjek Lalai" unset → flash "Import selesai: 2 soalan diimport, 1 gagal."; with "Subjek Lalai" = Matematik → 3 imported; S1 `status=draft` lists them; a `.pdf` file → error under "Fail CSV *". | FR-56 | AC-13.5 |
| E2E-M04-32 | "Download Template" downloads `template-import-soalan.csv` whose first line is the documented header. | FR-57 | AC-13.6 |
| E2E-M04-33 | "Sejarah Import" opens S5h (not a 500 page) with "Sejarah Import", the 4 column headers and the seeded run; the page has no buttons other than "Kembali"; after an import the new run is first; `reset({importRuns:[]})` → "Tiada sejarah import."; "Kembali" → S5. | FR-58 | AC-14.1, AC-14.2 |
| E2E-M04-34 | S6: header, KPI labels, "Jumlah Soalan" = S1 total, bucket titles rendered upper case ("SKOR 51-75", "SKOR ≤ 50", "LEGACY GENERIC") and the Legacy text containing literal backtick characters, distribution labels on non-empty segments (inside the segment; just below the bar when the segment is narrower than 8 %, so "0.5" is fully visible — DV-M04-20), subject table sorted by Purata desc with every pill ≥76 emerald, 11 level rows, action list excludes 570024 (legacy) and lists 129114/129216 with "Edit" → S4. | FR-59, FR-60, FR-61, FR-62 | AC-15.1, AC-15.2, AC-15.3, AC-15.4, AC-15.5 |
| E2E-M04-35 | "Jalankan Audit Semula" with latency → disabled + "Sedang audit..."; no dialog; after reload flash and recomputed values. | FR-63 | AC-16.1, AC-16.2 |
| E2E-M04-36 | Report modal (MCQ harness page mounting the M04 component): open via "Lapor Soalan", title/subtitle, 7 reasons with descriptions, send disabled → enabled after ticking, tint on ticked card, counter "5/500" and maxlength 500, close via Batal / `fa-times` / backdrop / Esc with no request. | FR-64, FR-65, FR-66, FR-67, FR-68 | AC-17.1, AC-17.2, AC-17.3, AC-17.4, AC-17.5 |
| E2E-M04-37 | Send an MCQ report on 564161 (as Pelajar Demo 01) → "Menghantar..." then "Terima Kasih!" + "Laporan berjaya dihantar."; as admin S7 "Menunggu" shows it with "Dinyahaktif"; `failNext(report, network)` → "Ralat. Sila cuba lagi.". | FR-69, FR-70 | AC-17.6, AC-17.7 |
| E2E-M04-38 | Structured variant: "Lapor" (title "Lapor soalan ini"), subtitle "…selepas 3 laporan", 5 structured reasons; 2 reports on 4455 keep it active, the 3rd makes it inactive (S7 "Dinyahaktif"). | FR-70, FR-71 | AC-18.1, AC-18.2, AC-18.3 |
| E2E-M04-39 | S7 default: shell title, subtitle, tabs "Menunggu (2)", "Disemak (3)", "Diperbaiki (5)", "Ditolak (1)", "Semua (11)", Menunggu active; click each tab → URL and active colour; `?status=zzz` → "Tiada laporan buat masa ini" with `fa-check-double` and no active tab; `reset` without the dismissed report → Ditolak shows "Tiada laporan buat masa ini". | FR-72, FR-78 | AC-19.1, AC-19.2, AC-19.9 |
| E2E-M04-40 | S7 "Semua": card for report 6 shows badges in order (Disemak, Tak Jelas, Dinyahaktif, tracking set, Oleh, time, "Bilik: Y31OBA", "ID Soalan: 136891"), pill "Soalan mengelirukan" (DV-M04-08), MCQ options with B marked, "Status tindakan admin:", "Edit Soalan #136891", "Buka Soalan Sama" URL `/spm/latih-tubi/MATH/quiz?question_id=136891&count=1` target _blank, no "Nyahaktif Segera"; report 4 (3703) pill "Markah tidak adil" and report 3 (2509) pill "Skema jawapan tidak tepat" (one DV-08 rule); report 10 structured block + "Lihat Soalan Struktur #3698" + "Nyahaktif Segera"; report 2 "Dikeluarkan" without actions; report 1 "Soalan tidak dijumpai". | FR-73, FR-74, FR-75, FR-76, FR-77 | AC-19.3, AC-19.4, AC-19.5, AC-19.6, AC-19.7, AC-19.8 |
| E2E-M04-41 | "Tandakan Selesai" on report 9 with a note → no dialog; on "Diperbaiki" tab with the note; counts Menunggu 1 / Diperbaiki 6. | FR-79 | AC-20.1, AC-20.4 |
| E2E-M04-42 | "Tolak & Aktifkan Semula" on report 6 → "Ditolak" tab with the fixed note; question 136891 ACTIVE on S1. | FR-80 | AC-20.2 |
| E2E-M04-43 | "Nyahaktif Segera" on report 10 → "Disemak" with "Dinyahaktifkan segera oleh admin", "Dinyahaktif" badge, button gone. | FR-81 | AC-20.3 |
| E2E-M04-44 | S13 as Pelajar Demo 01 (reports 10, 6, 2): header, counters (3 / 1 / 1 / 1 / 0), 3 rows; as Pelajar Demo 05 (no reports) → empty state; admin sees 0s and the empty state. | FR-82 | AC-21.1, AC-21.2, AC-21.3 |
| E2E-M04-45 | S8: header, "Tambah Soalan" href, stats 4,064 / 4,064, pills alphabetical with the live counts, filter options (subjects alphabetical, KBAT labels L2–L5 as live), `kbat_level=5` → "Menunjukkan 1–25 daripada 483 soalan" + "Reset", default counter "Menunjukkan 1–25 daripada 4,064 soalan", first rows 4454, 4455, 4456, pager 1–10 … 162 163, column visibility per viewport, pager fits at 768. | FR-83, FR-84, FR-85, FR-86 | AC-22.1, AC-22.2, AC-22.3, AC-22.4, AC-30.2 |
| E2E-M04-46 | S8 `subject_id=18` → row "Tiada soalan berstruktur ditemui", counter "Menunjukkan 0 daripada 0 soalan", no pager. | FR-87 | AC-22.5 |
| E2E-M04-47 | S9 of 3698: pills, "ID: #3698", box label rendered "STIMULUS / KONTEKS SOALAN", stimulus, meta ("08 Apr 2026", "Visibiliti: Public", "Published"), "Bahagian Soalan (3 sub-soalan)", labels 3(A)–3(C), "2m"/"4m"/"4m", "JAWAPAN MODEL"; 4454 label "A", "8 Markah"; "Edit Soalan" href `/guru/soalan-berstruktur/3698/edit`; "Balik ke Senarai" → S8. | FR-88, FR-89, FR-90 | AC-23.1, AC-23.2, AC-23.3 |
| E2E-M04-48 | S10: header, counters 6/1/3/1 (no Ditolak card), row content (subject + "T5" + "(2026)", paper type, "Oleh:", note, file link hrefs, pills incl. pending/rejected), filter `processing` + "Reset", `status=rejected` on a reset without rejected rows → "Tiada rekod ditemui". | FR-91, FR-92, FR-93 | AC-24.1, AC-24.2, AC-24.3 |
| E2E-M04-49 | "Kemaskini" toggles the panel (current status selected, note pre-filled, maxlength 1000); second click closes; set "Selesai" + note → saved with no dialog, counters updated, flash. | FR-94 | AC-24.4, AC-24.5 |
| E2E-M04-50 | S11: header, stat card labels rendered upper case, top-10 pills, filter options (subjects alphabetical, schools alphabetical), MCQ and Struktur sections with pagers; filter Fizik → both sections and the stat cards filtered (DV-M04-11), pills unchanged, MCQ pager page-2 link = `?subject_id=9&mcq_page=2` (DV-M04-16, no `str_page`) and following it keeps the Fizik filter; filter a school with no flagged MCQ → MCQ section absent, Struktur list unfiltered, Struktur pager keeps `school_id`; a subject with MCQ only → no Struktur section; Bahasa Cina → "Semua soalan sudah lengkap dengan gambar rajah!". | FR-95, FR-96, FR-97, FR-98, FR-99 | AC-25.1, AC-25.2, AC-25.3, AC-25.4, AC-25.5, AC-25.6 |
| E2E-M04-51 | Upload without a file blocked; upload a PNG for 563393 → removed from the list, counts −1, SHU badge −1, flash; "Dismiss" 562177 → removed, flash; no dialogs. | FR-100, FR-101 | AC-26.1, AC-26.2, AC-26.3 |
| E2E-M04-52 | S12: user-portal shell, header title with no subtitle (DV-M04-02), h1 visible with sufficient contrast (DV-M04-14), default summary "0 flagged · 0 teacher-approved · 525 total" and "Tiada nota dalam tab ini." on the flagged tab; with `reset({masterNotes:{flagged:[1,2,3], approved:[4,5]}})` the summary reads "3 flagged · 2 teacher-approved · 525 total" and the flagged tab lists 3 rows; "Semua" 15 rows + pager 1–10 … 34 35 keeping `tab=all`; row meta/Soalan/Trap. | FR-102, FR-103 | AC-27.1, AC-27.2, AC-27.3 |
| E2E-M04-53 | Press "Approve" (latency 500) → button disabled and "..." → "Done", still disabled, row 50% opacity; reload → note under "Teacher Approved"; "Regenerate" → "Done" and new text after reload; `failNext(500)` on "Clear Flag" → label restored and button enabled. | FR-104, FR-105 | AC-27.4, AC-27.5 |
| E2E-M04-54 | Admin shell nav: desktop "SOALAN" group items and hrefs, active item on S1–S4 and S5–S10; tablet/mobile bottom nav "Soalan" and "Lagi" › "Soalan" section; shell header titles on S1–S4, S5h, S7–S9 have no subtitle and are never "Dashboard"; S5, S6, S10, S11 keep their live subtitles. | FR-106, FR-107 | AC-28.1, AC-28.2, AC-28.3 |
| E2E-M04-55 | User-portal nav (desktop): "🛡️ KAWALAN KUALITI" › "Semakan Nota Master", "Laporan Soalan", "Kertas Soalan Guru", "Gambar Rajah" badge = S11 unfiltered MCQ count; mobile drawer shows only "Semakan Nota Master" and "Laporan Soalan". | FR-108 | AC-28.4 |
| E2E-M04-56 | Guest opening `/admin/questions` and `/laporan-soalan` → `/login`; Pelajar opening `/admin/questions` → own landing page; Pelajar opening `/laporan-soalan` → allowed. | FR-109 | AC-29.1, AC-29.2 |
| E2E-M04-57 | Counts agree with the named queries (§4.1): S1 "Jumlah" = S1 pager total = sum of tiles = S6 "Jumlah Soalan" = 465,278; `status=approved` 146,330 / `status=archived` 318,948; `questions.count` Q-ELIGIBLE 128,989, Q-ACTIVE 129,389, Q-PKSK 763; Prinsip Perakaunan tile "2,970 lulus" (DV-M04-18); S11 6,144 / 522 / 6,666; SHU badge 6,144; after deleting one approved active question Q-ALL, Q-APPROVED and Q-ELIGIBLE drop by 1 and `reset()` restores them. | FR-110, FR-119, FR-02 | AC-29.3, AC-01.3 |
| E2E-M04-58 | Responsive sweep: for every M04 route (S1–S14, S5h) assert `document.documentElement.scrollWidth ≤ innerWidth`; S1 "Soalan" column ≥240px at 375; S3/S5 sidebar below main under 1024 and beside it at 1280; S1 row action and S14 controls hit area ≥44px on mobile. | FR-111 | AC-30.1, AC-30.3, AC-30.4, AC-30.5 |
| E2E-M04-59 | Lookups: with the M03 fixture, the S1/S2/S5 subject selects equal `GET /api/subjects` in id order, S8/S11 alphabetically; level selects equal `GET /api/education-levels`; flipping `isCore` of subject 8 in a test seed moves its tile to "Subjek Teras". | FR-112 | AC-29.4 |
| E2E-M04-60 | Store contract: `spmPool({subjectId:3})` count = 1,681 and `spmPool({subjectId:18})` = 0 (Q-SPM-POOL); create an approved Matematik T5 MCQ on S2 → the new row has `spmPool = true`, the MATH pool is 1,682 and `getEligible(newId)` returns it; its id ≥ 9,000,001; "Nyahaktif Segera" on a report of that question → `getEligible` null and the pool is back to 1,681; "Tolak & Aktifkan Semula" → 1,682 again; `getEligible(136891)` = null (inactive anchor); `getEligible(564159)` returns the row. | FR-113, FR-114 | AC-31.1, AC-31.2, AC-31.3, AC-31.4 |
| E2E-M04-61 | Structured store: `structured.query({})` total 4,059, S8 total 4,064; 3699, 3703 and 2509 absent from the query and present on S8; `query({subjectId:1, kbatLevel:6})` → 3 rows; S8 row pill shows "L1" for 2505 and S9 of 2505 shows "KBAT: Mengingat (L1)". | FR-115, FR-85, FR-88 | AC-31.5, AC-22.3, AC-23.1 |
| E2E-M04-62 | PKSK: search S1 for the text of 178460 → "Tiada soalan dijumpai"; S1 total and tiles unchanged by the 763 PKSK rows; S3 of 178460 shows the text and its options with the correct ones marked "Jawapan Betul" and "-" for Subjek/Tahap; a Bahagian C row shows no options card; a `pending` PKSK row shows "Menunggu". | FR-116, FR-117 | AC-32.1, AC-32.2, AC-32.3 |
| E2E-M04-63 | Modal props on the harness page: `source:'revision'` → request body `source: 'revision'`; `failureText` "Gagal menghantar laporan. Sila cuba lagi." + network failure → that text under "Terima Kasih!"; `tints` yellow/blue for `missing_options`/`duplicate` → ticked cards use them; no props → `source:'spm'`, "Ralat. Sila cuba lagi." and default tints. | FR-118 | AC-17.8, AC-17.9 |
| E2E-M04-64 | Small text: on S1, S7, S8, S10, S11, S12 at 375/768/1280, every visible text node inside `main` has a computed font size ≥ 12px. | FR-120 | AC-30.6 |
| E2E-M04-65 | Teacher write contract: as teacher 5, `questions.createFromTeacher` a Matematik T5 MCQ with `curriculumTopicId`, `scriptType:'rumi'` → id ≥ 9,000,001, `pending_review`, `isActive = true`; admin S1 `status=pending_review` lists it; `getEligible` null; admin "Luluskan" → eligible and in the MATH pool (Q-SPM-POOL +1); Q-CONTRIB(5) = 2 / approved 2; `updateOwn` by teacher 6 → 404; `importFromTeacher` with 2 valid + 1 invalid row → 2 `pending_review` rows. | FR-121, FR-123 | AC-33.1, AC-33.2, AC-33.4 |
| E2E-M04-66 | Structured write contract: `structured.create` (Perniagaan T5, 2 subs with rubrics, `publish = 0`) → draft, id ≥ 9,000,001, Q-STRUCT-ALL 4,065, Q-STRUCT-VISIBLE unchanged; `toggleStatus` → published → Q-STRUCT-VISIBLE 4,060; `update` changes the stimulus; `delete` → back to 4,064. | FR-122 | AC-33.3 |
| E2E-M04-67 | Queries and report contract: Q-CONTRIB(1) = 16,817 (Matematik 3,287 … Geografi 269), first page ids 522425–522444, page 2 starts 522445; Q-TEACHER-DATABANK(1) = 6,048 (mcq 5,918, essay 105), `questionType=mcq&difficulty=3` → 64 pages of 15, first ids 525433, 525432, 525431; `POST /api/question-reports` with `source:'teacher_databank'`, reasons `['outdated']` → `{success:true}` and S7 shows "Soalan sudah tidak relevan" / "Lain-lain"; Q-SP-AVAILABLE(9001) = 30, (194) = 50; `questions.get(700401)` returns its `chapterLabel` and topic; default S1 `status=pending_review` → empty. | FR-123, FR-124, FR-125, FR-126 | AC-33.4, AC-33.5, AC-33.6, AC-33.7, AC-33.8 |
| E2E-M04-68 | Jutawan store: `questions.jutawan.count(5, 7)` = 2,974 (Sejarah T1), `count(27, 11)` = 143, `count(19, 1)` = 0; Σ over the 143 cells = 149,911; `sample({subjectId:1, level:1, difficulty:1}, 4, rng)` returns 4 distinct keyless rows of that cell; `gradeAnswer` on one returns its key; S1 "Jumlah" and Q-ALL are unchanged (465,278). | FR-127 | AC-34.1, AC-34.2 |
| E2E-M04-69 | Analytics inputs: `count('Q-M17-COV')` = 127,643 and its Bahasa Melayu row 958 / 2,540 / 805 / 530 / 407 / 400 / 2,104 / 1,800 / 1,500 / 257 / 387; Matematik row total 13,354; `count('Q-TEACHER-CONTRIB')` = 11,414 while Q-CONTRIB(1) = 16,817 and Q-CONTRIB(5) = 1; ImportRun count 1,123, Σ imported 31,101, runs in Aug/Sep 2026 = 0, S5h first row dated 20/07/2026; `questions.get(701001)` returns an M18 anchor; no generated question has `createdAt` ≥ 2026-09-21. | FR-128 | AC-34.3, AC-34.4, AC-34.5 |

### 12.1 Traceability (US → FR → E2E)

Generated by the traceability script (author's scratchpad `trace.js`): every FN in URS §3 is cited by ≥1 FR; every AC by ≥1 FR and ≥1 E2E; every FR by ≥1 E2E.

| US | FR | E2E |
|---|---|---|
| US-M04-01 | FR-M04-01, FR-M04-02, FR-M04-07, FR-M04-08, FR-M04-09, FR-M04-10 | E2E-M04-01, E2E-M04-03, E2E-M04-05, E2E-M04-57 |
| US-M04-02 | FR-M04-03, FR-M04-04 | E2E-M04-02 |
| US-M04-03 | FR-M04-05, FR-M04-06, FR-M04-08, FR-M04-11 | E2E-M04-01, E2E-M04-03, E2E-M04-04 |
| US-M04-04 | FR-M04-12, FR-M04-13, FR-M04-14 | E2E-M04-06, E2E-M04-07, E2E-M04-08 |
| US-M04-05 | FR-M04-15, FR-M04-16 | E2E-M04-09 |
| US-M04-06 | FR-M04-17, FR-M04-18, FR-M04-19, FR-M04-20, FR-M04-21, FR-M04-22, FR-M04-23 | E2E-M04-10, E2E-M04-11, E2E-M04-12, E2E-M04-13, E2E-M04-15 |
| US-M04-07 | FR-M04-24, FR-M04-25, FR-M04-26, FR-M04-27, FR-M04-28 | E2E-M04-11, E2E-M04-14, E2E-M04-15 |
| US-M04-08 | FR-M04-29, FR-M04-30, FR-M04-31, FR-M04-32 | E2E-M04-16, E2E-M04-17, E2E-M04-18 |
| US-M04-09 | FR-M04-33, FR-M04-34, FR-M04-35, FR-M04-36 | E2E-M04-19, E2E-M04-20 |
| US-M04-10 | FR-M04-37, FR-M04-38, FR-M04-39, FR-M04-40, FR-M04-41, FR-M04-42, FR-M04-43 | E2E-M04-15, E2E-M04-21, E2E-M04-22, E2E-M04-23 |
| US-M04-11 | FR-M04-44, FR-M04-45, FR-M04-46, FR-M04-47 | E2E-M04-24, E2E-M04-25, E2E-M04-26 |
| US-M04-12 | FR-M04-48, FR-M04-49, FR-M04-50, FR-M04-51, FR-M04-52 | E2E-M04-27, E2E-M04-28, E2E-M04-29 |
| US-M04-13 | FR-M04-53, FR-M04-54, FR-M04-55, FR-M04-56, FR-M04-57 | E2E-M04-30, E2E-M04-31, E2E-M04-32 |
| US-M04-14 | FR-M04-58 | E2E-M04-33 |
| US-M04-15 | FR-M04-59, FR-M04-60, FR-M04-61, FR-M04-62 | E2E-M04-34 |
| US-M04-16 | FR-M04-63 | E2E-M04-35 |
| US-M04-17 | FR-M04-64, FR-M04-65, FR-M04-66, FR-M04-67, FR-M04-68, FR-M04-69, FR-M04-70, FR-M04-118 | E2E-M04-36, E2E-M04-37, E2E-M04-38, E2E-M04-63 |
| US-M04-18 | FR-M04-70, FR-M04-71 | E2E-M04-37, E2E-M04-38 |
| US-M04-19 | FR-M04-72, FR-M04-73, FR-M04-74, FR-M04-75, FR-M04-76, FR-M04-77, FR-M04-78 | E2E-M04-39, E2E-M04-40 |
| US-M04-20 | FR-M04-79, FR-M04-80, FR-M04-81 | E2E-M04-41, E2E-M04-42, E2E-M04-43 |
| US-M04-21 | FR-M04-82 | E2E-M04-44 |
| US-M04-22 | FR-M04-83, FR-M04-84, FR-M04-85, FR-M04-86, FR-M04-87 | E2E-M04-45, E2E-M04-46, E2E-M04-61 |
| US-M04-23 | FR-M04-88, FR-M04-89, FR-M04-90 | E2E-M04-47, E2E-M04-61 |
| US-M04-24 | FR-M04-91, FR-M04-92, FR-M04-93, FR-M04-94 | E2E-M04-48, E2E-M04-49 |
| US-M04-25 | FR-M04-95, FR-M04-96, FR-M04-97, FR-M04-98, FR-M04-99 | E2E-M04-50 |
| US-M04-26 | FR-M04-100, FR-M04-101 | E2E-M04-51 |
| US-M04-27 | FR-M04-102, FR-M04-103, FR-M04-104, FR-M04-105 | E2E-M04-52, E2E-M04-53 |
| US-M04-28 | FR-M04-106, FR-M04-107, FR-M04-108 | E2E-M04-54, E2E-M04-55 |
| US-M04-29 | FR-M04-02, FR-M04-109, FR-M04-110, FR-M04-112, FR-M04-119 | E2E-M04-01, E2E-M04-56, E2E-M04-57, E2E-M04-59 |
| US-M04-30 | FR-M04-10, FR-M04-86, FR-M04-111, FR-M04-120 | E2E-M04-05, E2E-M04-45, E2E-M04-58, E2E-M04-64 |
| US-M04-31 | FR-M04-113, FR-M04-114, FR-M04-115 | E2E-M04-60, E2E-M04-61 |
| US-M04-34 | FR-M04-127, FR-M04-128 | E2E-M04-68, E2E-M04-69 |
| US-M04-33 | FR-M04-121, FR-M04-122, FR-M04-123, FR-M04-124, FR-M04-125, FR-M04-126 | E2E-M04-65, E2E-M04-66, E2E-M04-67 |
| US-M04-32 | FR-M04-116, FR-M04-117 | E2E-M04-62 |

Script result (v1.1, 2026-09-25): 183 FN → all cited by ≥1 FR · 167 AC → all cited by ≥1 FR and ≥1 E2E · 128 FR → all have ≥1 E2E · 69 E2E, each run at 375/768/1280 · 0 dangling FN/AC/FR references.

## 13. Open questions

Carried from URS §9 (OQ-1…OQ-12), plus:

1. **SQ-1 Mock numeric ids — Closed.** SRS.md §7.4 now grants numeric ids where the live site shows them; M03 uses integer subject/level ids too (Delivery Lead, v1.1).
2. **SQ-2 Report entry points.** The modal component is owned by M04 and mounted by M05/M06; E2E-M04-36…38 and 63 use a harness page. Hosts own the trigger button and control the modal with `open` / `update:open`, listening for `reported {ok, message}` (v1.19). Hosts pass `questionId`, `variant`, `quizSessionId` and, where they differ from the defaults, `source`, `failureText` and `tints` (FR-M04-118; M05 S7 passes `revision`, its failure text and the yellow/blue tints).
3. **SQ-3 Placeholder copy.** All UNVERIFIED COPY in §5 and §8 (flash and validation messages, S3 statistics/quick-action labels, AI regenerate label, S13 rows, S5h page) must be replaced when a validation probe or live observation is allowed (URS OQ-1).
4. **SQ-4 Flash banner.** The shared admin flash banner design is owned by the global shell; M04 only supplies the text.
6. **SQ-6 Cross-module notes (XL batch 3).** M16: DC-M16-02 can be retired — the S19 counts are now `questions.jutawan.count` (Q-JUT-COUNT) and the game samples the same store (XR-M16-01 answered: (a) store delivered, (b) sample filters confirmed, (c) `papan_bijak` + `roomCode` accepted, PROPOSED). M07: PKSK difficulty 253 / 253 / 191 / 66 (M17 XR-10). M17: Q-M17-COV, Q-TEACHER-CONTRIB and the ImportRun queries exist (XR-09/11/20). M18: anchor block 701001–701099 for the critical questions (XR-M18-10); M18 lists the records. M14: `questionsCount` and the S22 rows are untouched.
7. **SQ-7 As-built gaps (F-25, v1.13).** (a) **XR to M02 — done (v1.14, M02 v1.20):** Q-TEACHER-CONTRIB (11,414) is carried by the facet `contribSchoolId`; the 3,849 rows of schools 8087 / 8107 / 8880 / 8090 now have `createdBy` = the M02 teacher anchors 4501 (2,432; v1.16: 873, with 1,559 on 4202) / 4502 (1,403) / 4503 (13) / 4504 (1). The other 7,565 objective rows have `contribSchoolId` = 0; v1.15: 5,547 of them carry `createdBy` 5316 (SQ-8), the remaining 2,018 stay on 5801 (M02's fixture admin), an open placeholder (see (d) and SQ-8); consumers count through `count('Q-TEACHER-CONTRIB', scope)` / `teacherContributions(schoolId?)`, never by joining `createdBy` to the teacher role (BR-M04-38(c)). (b) **XR to M10:** the generic SPs 8287, 8288, 8289 (Pendidikan Muzik T1–T3) and 8547 (Pendidikan Syariah Islamiah T1) are missing from M10's 183 generic SPs; M04 has rows on 187 subject-level pairs, so M10 needs 187 generic SPs. (c) Deleted-question holes: id 108527 (target of report 1, deleted on live) and the gap 564156 are never generated; F-09's id-range option `absentIds` excludes them (v1.14; earlier drafts called it `holes`). (d) PROPOSED values chosen by F-25: D2–D4 chapter counts (Q-CHAPTER) split evenly across the M03 chapters of each subject-level; reporters "Pelajar Demo 01–08" = users 5001–5008; generated creator id 5801; the seeded import run "soalan-bm-d3.csv" has id 1123; **placeholder (v1.14, open; reduced in v1.15):** the **2,018** still-unattributed Q-TEACHER-CONTRIB rows keep `createdBy` = 5801 (an admin, not a teacher) and `contribSchoolId` = 0 (sentinel, not a school) because no teacher for them is in the captured live rows or in M02; no teacher or school record is invented; the total 11,414 is unchanged; a PPD or state scope counts none of them (their teachers have no school).
8. **SQ-8 XR to M02 — teacher ids for the remaining contributing teachers (partly answered v1.15; rest open, not blocking).** The premise "no teacher id observed on live" was wrong for part of the rows: the M17 snapshot `S11_laporan.default.tabs.guru` (389 of 551 rows captured) shows `<teacher:101>` — no school, "Belum", **5,547 MCQ, 0 structured**, 42,600 syiling. **Answered (XL3 B-01):** M02 v1.24 designates existing fixture teacher **5316** (active, no school, `lastLoginAt` null — attributes already matching); 5,547 of the 7,565 rows move to it (`contribSchoolId` stays 0, so every facet cell, 11,414 and every per-school figure are unchanged). The only other captured contributor, `<teacher:137>` (SMK JALAN REKO, 497 MCQ + 1,062 structured), is at school **8087** and is therefore inside 8087's observed 2,432, not among the 7,565 (M17 snapshot S11 school row "2,432 1368M + 1064S"; live feed `school_id` 8087) — the XL audit's "7,106 of 7,565 attributed" double-counts it. **Answered (v1.16):** `<teacher:137>` = M02 v1.25 teacher **4202** (at 8087; M14 S22 rank 2, 1,559 = 497 + 1,062); 8087's rows are split 4202 497 + 1,062 and 4501 871 + 2. **Open:** the teachers of the remaining **2,018** rows are not in the captured rows (they are among the 162 uncaptured); they stay on 5801 until observed (M17 DV-M17-32).
9. **SQ-9 Open item for the hand-off (v1.19; not blocking M04).** The "Buka Soalan Sama" links on S7 (`/spm/latih-tubi/...`, `/latihan-berstruktur/...`) give a 404 until M05 and M06 build those routes. Tracked in the hand-off; XR to M05 and M06.
10. **SQ-10 Product decision (v1.19, backend phase).** Does a first report from a low-trust account auto-deactivate an MCQ, or only flag it for review (SEC-M04-11(d))? The prototype keeps live behaviour (immediate deactivation).
5. **SQ-5 Contracts other modules must follow (D12).** M06: SPM pools via `questions.spmPool` (BR-M04-32), `question_id` sessions via `getEligible` (its E2E must use an active question, not 136891); structured sets via `structuredStore` with the anchor list of §6.11 (no ids from 10001); no separate question schema. M05: drills, chapter mode (`curriculumChapterId`) and revision via `query`/`getEligible` (revision serves a queued question only while eligible); its fixtures are dataset anchors (no total change); report modal props per FR-M04-118. M07: PKSK rows via `questions.pksk` with the DATA-M07-02 fields.
