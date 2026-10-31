# R1 board: Bijak SPM, admin → student question pipeline

Writer: team A lead. Last refresh: 2026-10-31 12:00 MYT. Current BASE: **BASE-1** = `feature/v3-bijak-r1` @ 14e4336c.
Source of every task: `docs/handoff/CLOUD-HANDOFF.md` §7 on `feature/v3-bijak-r1`. Read the protocol in [README.md](README.md).

## Critical path

`T01 (base merge + vue-tsc)` → B1 merges = **BASE-2** → `T03 b08` → `T04 b01 lifecycle` → `T05 DB specs re-run` → `T23 E2E` → R1 sign-off.
Everything else runs beside it and merges BASE-2 in when it lands.

## Tasks

| ID | Handoff | Task | Lane | Depends on | Branch | Status | Evidence / verdict |
|---|---|---|---|---|---|---|---|
| T01 | (a-1)+(a0) | Merge `origin/handoff/shared-tree-2026-10-31`, resolve conflicts, fix the 5 vue-tsc errors; registry-boot, api tsc, vue-tsc, m04/m28/bijak specs | A1 | — | r1/t01-base-merge | QUEUED | |
| T03 | (a) | Verify `r1/b08-bridge`: vue-tsc m28, bijak-question-bridge, be09-paper spec, DB test of image read rule; merge BASE-2 into it | A2 | T01 merged | r1/b08-bridge | QUEUED | |
| T04 | (a) | Finish `r1/b01-lifecycle`: 4 `'published'` spots, drop `published` from isServableStatus, migration 0100 on a seeded DB, tsc/eslint/m04 tests/specs | A2 | T03 merged | r1/b01-lifecycle | QUEUED | |
| T05 | (b) | Run never-run DB specs (B06 list, be09-paper, challenges-savepoint), fix; before/after counts (login 493; BM 53, MATH 54, SCI 50; one draw); re-run after T04 | A3 | T01 merged (first pass), T04 (final) | r1/t05-db-specs | QUEUED | |
| T06 | (g) | Student Jana Kertas → `composeStandardPaper` (D75); update generate.spec + golden-mock.json | A1 | T01 merged | r1/t06-jana-standard | QUEUED | |
| T07 | (f) | Question-model gaps: `groupOf` 7 stimulus kinds + caption/tableData/sourceCitation; `essay_choice` in parts contract; question-bank.source multi-stimulus groups; stimulus-body read for kuiz/bridges | A4 | T01 merged | r1/t07-model-gaps | QUEUED | |
| T08 | (h) | R1-B21 secondary-only guard on Bijak + builder paths incl. `exam/builder/question-bank.source.ts` ~79 | A4 | T07 merged (same file) | r1/t08-secondary-guard | QUEUED | |
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
| H-A1 | A | Spec coverage for `SPM_SERVABLE_SQL` readers (Databank, Latih Tubi SPM, Mock K1, Battle SPM, Misi): one approved-T4 fixture proves all five serve it |
| H-A2 | A | `reports/classes` raw SQL Darjah counts (8b open item) — audit and fix under D72 |
| H-A3 | A | 3 known apps/api `learner.spec` label failures (BR-16 code map, subject labels) |
| H-B1 | B | Unit sweep m01/02/03/04/05/08/09/16/27 + registry-boot on the latest BASE; file failures to the owning team's status file |
| H-B2 | B | `lint:admin` ratchet for the 7 m02/m03/m09 findings (report only; the fix goes to C) |
| H-C1 | C | ChapterIndexPage / Soalan by Chapter empty state (B-01 FE side) per V2 |
| H-C2 | C | Stale m17/m12/m11 unit tests and UserListPage number format (report first; fix only if R1 path) |

## After R1 sign-off (G5 Ready + user confirmation): R2 queue, issued by the team A lead

A: Tracking A sets (BE), Mock K1/K2 (BE), practice-family bridge upgrades (images and groups in Latih Tubi/Bab/Remedial).
C: Tracking A editor UI, Mock K1/K2 UI (B-03), Subjektif SPM / Latihan Berstruktur, Heatmap.
B: review, security, E2E and release for each R2 unit.
