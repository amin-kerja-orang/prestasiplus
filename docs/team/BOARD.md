# R1 board: Bijak SPM, admin → student question pipeline

Writer: team A lead. Last refresh: 2026-10-31 (cycle 3). Current BASE: **BASE-1** = `feature/v3-bijak-r1` @ 14e4336c.
Source of every task: `docs/handoff/CLOUD-HANDOFF.md` §7 on `feature/v3-bijak-r1`. Read the protocol in [README.md](README.md).

## Critical path

`T01 (base merge + vue-tsc)` → B1 merges = **BASE-2** → `T03 b08` → `T04 b01 lifecycle` → `T05 DB specs re-run` → `T23 E2E` → R1 sign-off.
Everything else runs beside it and merges BASE-2 in when it lands.

## Tasks

| ID | Handoff | Task | Lane | Depends on | Branch | Status | Evidence / verdict |
|---|---|---|---|---|---|---|---|
| T01 | (a-1)+(a0) | Merge `origin/handoff/shared-tree-2026-10-31`, resolve conflicts, fix the 5 vue-tsc errors; registry-boot, api tsc, vue-tsc, m04/m28/bijak specs | A1 | — | r1/t01-base-merge | **READY-FOR-REVIEW** @ 09d32822 | api tsc 0; vue-tsc 0; registry-boot 3/3; m04+m28 928/928; m11+registry-boot 261 pass / 0 fail (lead re-run); m03/m05/m12/ds pass; bijak specs 470/474 (golden.spec 4 pre-existing → H-A4); eslint 0 errors. No auth/files/input change in fixes. Evidence: status/A1.md |
| T03 | (a) | Verify `r1/b08-bridge`: vue-tsc m28, bijak-question-bridge, be09-paper spec, DB test of image read rule; merge BASE-2 into it | A2 | T01 merged | r1/b08-bridge | **READY-FOR-REVIEW** @ 7050f2d7 (needs security review: image URLs on served items, FilesModule) | BASE-1 merged; api tsc 0; vue-tsc = base (38 = base; 0 on trial merge with T01); m28 unit 472/472; bridge + be09-paper + question-image-access specs 144/144; eslint 0 errors; trial merge with T01 09d32822: no conflicts, tsc 0, vue-tsc 0, 144/144, 472/472. Pre-existing: golden.spec 4 (H-A4), seed/poc.spec 1 (H-A5). Merge right after T01 |
| T04 | (a) | Finish `r1/b01-lifecycle`: 4 `'published'` spots, drop `published` from isServableStatus, migration 0100 on a seeded DB, tsc/eslint/m04 tests/specs | A2 | T03 merged | r1/b01-lifecycle | IN-PROGRESS (on t01 + b08 local merge) | |
| T05 | (b) | Run never-run DB specs (B06 list, be09-paper, challenges-savepoint), fix; before/after counts (login 493; BM 53, MATH 54, SCI 50; one draw); re-run after T04 | A3 | T01 merged (first pass), T04 (final) | r1/t05-db-specs | **READY-FOR-REVIEW (first pass)** @ 4fff21ab; final pass after T04 | ddacd4e0: 8 never-run specs now green (draw-bounded 33/33, served.db 6/6, assignments-adapter 12/12, source 14/14, spm-servable 6/6, lobby 5/5, challenges-savepoint 3/3, invitations 21/21, new servable-counts 2/2), test-only fixes; api tsc 0; eslint 0. Counts: login 493; practice cards BM 53 / MATH 54 / SCI 50; drawable BM 50 (3 group MCQs) → D91; admin approved T4 MCQ +1 in Databank, Latih Tubi SPM, Mock K1, login. 4fff21ab adds: spm/hub 19/19, spm/mocks 21/21, shape-perf 6/6, golden 18/18 (H-A4), seed/poc 25/25 (H-A5: seed-profile.md was stale, 493/21891), servable-counts 3 pass + 3 todo (five readers incl. Battle SPM + Misi = H-A1). Test + doc only, no src/seed change |
| T06 | (g) | Student Jana Kertas → `composeStandardPaper` (D75); update generate.spec + golden-mock.json | A1 | T01 merged | r1/t06-jana-standard | **READY-FOR-REVIEW** @ 502280f5 (off T01 09d32822) | `POST /bijak/papers/generate` → `composeStandardPaper` (exact-or-refuse: 422 SHORTAGE, 503 GENERATE_LIMIT, no row on refusal; Disahkan-only, Admin Pusat Mod Pelajar may use Spec); stores `standard_report` (AC-34.7). api tsc 0; generate.spec 19/19 (D90 groups whole + consecutive, version pinning); bijak+builder specs 878 pass / 5 fail (golden 4 = H-A4, poc 1 = H-A5, pre-existing); eslint 0. Note: PoC blueprints with null mark_budget now refuse (release note for T24). No auth/files/input change |
| T07 | (f) | Question-model gaps: `groupOf` 7 stimulus kinds + caption/tableData/sourceCitation; `essay_choice` in parts contract; question-bank.source multi-stimulus groups; stimulus-body read for kuiz/bridges | A4 | T01 merged; **T03 (b08) merged first** | r1/t07-model-gaps | **READY-FOR-REVIEW** @ 809c2749 (contains b08 7050f2d7 + t01 09d32822; merge after T03) | b08 merged in, be09-mapping essay_choice cast fixed; m12 KirkpatrickOverviewPage restored to T01 version (b08 merge reintroduced the stale OverviewInfo line). api tsc 0; stimulus-display + exam-builder + bijak-question-bridge + question-image-access + bijak-kuiz + questions/groups: 24 files, 476 pass; contract 71/71; openapi --check ok; eslint 0. Touches input (contract) |
| T08 | (h) | R1-B21 secondary-only guard on Bijak + builder paths incl. `exam/builder/question-bank.source.ts` ~79 | A4 | T07 merged (same file) | r1/t08-secondary-guard | QUEUED | |
| T25 | (f) follow-up | `essay_choice` storage: migration 0101 (mode CHECK, topics column, projection, publish gate); drop the 422 ESSAY_CHOICE_NOT_STORED refusal added by T07 | A4 | T08 merged | r1/t25-essay-choice-store | **READY-FOR-REVIEW** @ ed5737c4 (merge after T08; doc numbering commit to follow) | migration 0101_essay_choice; api tsc 0; **vue-tsc 0**; m28 FE 472/472; broad api run 1708/1726 (17 fail = T05 set: golden 4, source 8, draw-bounded 3, shape-perf 2, fixed on r1/t05-db-specs); essay-choice-store 7/7; eslint 0; openapi --check ok. Touches input (question write path) → security review |
| T10 | (c) | Set Builder + Semak Kertas UI: SetBuilderPage `/admin/studio/sets/:paper/builder`, routes, PaperEditorPage extension (header, ReviewBlock, Terbitkan disabled w/ reason, Tarik balik, Salin set, student view), menu KS-17, tests; V2 Panel labels (Jana set + Terbitkan = 2 clicks) | C1 | T01 merged | r1/f08-builder-ui | QUEUED | |
| T11 | (d) BE | Verify `r1/b16-kuiz` top WIP; count fallback 20 (V2); D90: random mode serves member with its group stimulus; per-paper shows stimulus once per group | C2 | T01 merged; T07 for stimulus-body read | r1/b16-kuiz | QUEUED | |
| T12 | (d) FE | Verify/finish `r1/f12-kuiz`: `/simulasi/kuiz`, `/simulasi/:paperId/kuiz`, reuse `src/components/question-display`, route reachable (prototype scope), tests | C2 | T11 | r1/f12-kuiz | QUEUED | |
| T13 | (e) | Studio create/edit: one stimulus + ≥2 members (add/remove/reorder), DSKP tags per leaf (unit, SP, TP, cognitive), Bab, images; intake links a figure to EVERY referencing question; V2 Studio labels (4 clicks to publish) | C3 | T01 merged; read side from T07; labels from T04 | r1/t13-studio-groups | QUEUED | |
| T14 | QA bugs | Student smoke bugs B-06 (structured stem rows as answer boxes), B-07 (/spm "0 Tahun Tersedia"), B-08 (empty-subject "Mula" + "Locked: 0/40"), B-09 (wrong-answer panel) per D9 with V2 citation | C4 | T01 merged | r1/t14-student-bugs | QUEUED | |
| T15 | (j) | Apply proposed BM copy (handoff §7j) once confirmed in QUESTIONS.md Q1 | C4 | Q1 answered | r1/t15-bm-copy | WAITING (Q1) | |
| T16 | — | Responsive pass 375/768/1280 on every R1 page after T10–T14 merge (no UX changes, layout only) | C4 | T10–T14 merged | r1/t16-responsive | QUEUED | |
| T20 | — | Integration: merge queue for APPROVED units (`--no-ff`), re-run tsc + targeted tests on the merge result, BASE-n log, TRACKER.md change log | B1 | continuous | feature/v3-bijak-r1 | QUEUED | |
| T21 | (i) | G4 code-review of every READY-FOR-REVIEW unit; full review of everything since 100496c2 | B2 | continuous | — | QUEUED | |
| T22 | (i) | Security review for units touching auth/files/input (T03 image rule, T11, T13 intake/uploads, self-mark); full security pass since 100496c2 | B3 | continuous | — | QUEUED | |
| T23 | (i) | E2E: Playwright flow admin uploads (form/CSV/PDF, image, D90 group) → approves → builds paper → Terbit → pupil sits, self-marks, result, Cuba Lagi; Databank/Latih Tubi SPM/Bab receive the question; 375/768/1280; re-test B-01, B-02, B-04, B-05 | B4 | baseline now; final after T04, T05, T10–T13 | r1/t23-e2e | QUEUED | |
| T24 | (l) | Release runbook for the human deploy: migration order 0092 → 0093 → 0100 (+ any 0101–0119), DSKP load, Disahkan blueprint, config; `docs/ops/r1-release-notes.md` | B1 (idle time) | after T04 | r1/t24-release-notes | QUEUED | |

## Standby queue (a lane with no unblocked task takes the next one for its own team; never another team's)

| ID | Team | Task |
|---|---|---|
| H-A1 | A | DONE in T05 @ 4fff21ab: Spec coverage for `SPM_SERVABLE_SQL` readers (Databank, Latih Tubi SPM, Mock K1, Battle SPM, Misi): one approved-T4 fixture proves all five serve it |
| H-A2 | A | **READY-FOR-REVIEW** `r1/ha2-reports-darjah` @ 4eec8b78 (off T01): class member counts/ids (`VISIBLE_USER_SQL`), `ClassesRepository.all()` drops Darjah classes, teacher question stats `NOT_PRIMARY_LEVEL_SQL`; new spec classes/primary-hidden 4/4 (3 fail without fix); kelas-saya + question-stats-index adjusted; 21/21; api tsc 0; eslint 0 |
| H-A3 | A | CLOSED: `test/curriculum/learner.spec.ts` 28/28 on T01 head (fixed earlier by 8b fix3 c2b782e7); no change |
| H-A5 | A | DONE in T05 @ 4fff21ab (doc was stale): `test/seed/poc.spec.ts` 1 failure: docs/plan/seed-profile.md says spm_tracking_set_questions 493 / total 21891, seed produces 483 / 21881. Pre-existing on BASE-1 |
| H-A6 | A (A3 IN-PROGRESS, test-local fixture, no seed change) | `test/battle/queue.spec.ts` "school battle: bot from another school": no secondary pupil in another school in the demo seed (D72 seed gap) |
| H-A7 | A (A4 next, r1/ha7-essay-choice-flat-view) | `essay_choice` in flat admin/Guru views (`questions/projection.ts`, `bank-adapter.ts`): shows as structured today |
| H-A8 | A (A1 IN-PROGRESS, r1/ha8-stale-specs) | Pre-existing on T01: curriculum/admin-delete-conflict "level link only"; classes/teacher-classrooms-lookup (suite); battle/school-page (2), battle/seed (3) |
| H-A4 | A | DONE in T05 @ 4fff21ab: `test/bijak-attempts/golden.spec.ts` 4 failures (sej-k2-2025-a): mock engine emits `selfMarkable: true` on `belum_dimarkah` parts; spec strips it only on the API side. Pre-existing on BASE-1 |
| H-B1 | B | Unit sweep m01/02/03/04/05/08/09/16/27 + registry-boot on the latest BASE; file failures to the owning team's status file |
| H-B2 | B | `lint:admin` ratchet for the 7 m02/m03/m09 findings (report only; the fix goes to C) |
| H-C1 | C | ChapterIndexPage / Soalan by Chapter empty state (B-01 FE side) per V2 |
| H-C2 | C | Stale m17/m12/m11 unit tests and UserListPage number format (report first; fix only if R1 path) |

## After R1 sign-off (G5 Ready + user confirmation): R2 queue, issued by the team A lead

A: Tracking A sets (BE), Mock K1/K2 (BE), practice-family bridge upgrades (images and groups in Latih Tubi/Bab/Remedial).
C: Tracking A editor UI, Mock K1/K2 UI (B-03), Subjektif SPM / Latihan Berstruktur, Heatmap.
B: review, security, E2E and release for each R2 unit.

## Decisions this cycle

- **D91** (PR [amin-kerja-orang/prestasiplus#404](https://github.com/amin-kerja-orang/prestasiplus/pull/404), merge after T01): counts per surface, card = details = drawable; login counts all servable incl. group members. Code change in T04 (`bankMatrix` + `group_id IS NULL`); expected BM practice card 50, login 493.

## File locks from planning (2026-10-31 12:20)

Until the named task is MERGED, nobody else edits these files:

| Files | Locked by | Note for other lanes |
|---|---|---|
| `packages/contract/src/questions/parts.ts`, `packages/contract/openapi.json` | A4 (T07: 7 stimulus kinds, `essay_choice`) | C3 Studio consumes these after T07 merges; raise needs in status/C3.md |
| m04 `api/questions.ts`, `lib/question-list.ts`, `QuestionDetailPage.vue`, `packages/contract/src/intake/items.ts` | A2 (T04 b01 lifecycle) | C3 starts with new Studio components/pages; edits these only after T04 merges |
| `apps/api/src/modules/questions/questions.repository.ts`, `exam/builder/{builder.service,builder.constants,question-bank.source,question-bank.mapping}.ts` | A2 (T04), then A4 (T07 → T08) | Sequenced inside team A |
| `bijak/integration/integration.module.ts` | A2 (T03) | C2 (kuiz) must merge BASE after T03 before touching it |

Merge order (team A): T01 → T03 (b08) → T07 → T08; T07 also adds optional `groupStimuli` to `packages/contract/src/bijak/builder/schema.ts` (C1 builder UI: consume after T07 merges) and a `KUIZ_KIND` table in `bijak/kuiz/kuiz.mapper.ts` (C2: widen kuiz wire to 7 kinds after T07).

T04 scope widened by planning: raw-SQL `'published'` question-status spots in `practice/reads/{overview,writes/listing,analytics}`, `account/account-data.repository.ts`, `bijak/kuiz/kuiz.service.ts:99`, `exam/builder/*` (paper `published`/Terbit stays).
