# R1 board: Bijak SPM, admin → student question pipeline

Writer: team A lead. Last refresh: 2026-11-01 14:55 UTC (cycle 18). Current BASE: **BASE-105** = `feature/v3-bijak-r1` @ 7ea2208c. Every open team A branch merges the latest BASE before re-marking READY.
Source of every task: `docs/handoff/CLOUD-HANDOFF.md` §7 on `feature/v3-bijak-r1`. Read the protocol in [README.md](README.md).
> **Current state = the auto table at the end of this file (AUDIT:BEGIN/END).** History sections below are a log; a READY there is only valid if the auto table agrees.

## Team A record rule (user, 2026-11-01, effective now)
"Jangan ada yang buat kerja cuai, mana-mana team sekalipun."
1. **READY = record in the same round.** A unit is READY only when, in one round, (a) the branch is pushed, (b) its BOARD row carries the real head, and (c) every related REQ row in requests/answers-A.md carries status + head + base. A message alone does not make a unit READY. Lanes A2–A4 and subagents do not write the tracker; they send READY to the lead, and the lead writes BOARD + answers-A.md **before** acknowledging or forwarding it.
2. **Head changed = record changed.** Every new push to a READY branch updates its head in BOARD and answers-A.md in the same round.
3. **Check before reporting.** Before reporting READY, run `git ls-remote origin <branch>` and `git show origin/team/r1-board:docs/team/requests/answers-A.md | grep <REQ>`. Branch, BOARD and answers-A must match.
4. **No stale records.** At the start of every cycle, the lead checks every READY/IN-PROGRESS head in BOARD and answers-A.md against origin and fixes any mismatch.
5. Teams B and C are asked to apply the same rule (REQ-A-017).


## Team A sessions (from cycle 7)

Each team A lane is its own Claude session (main Opus 5.5, subagents Sonnet high, sized per queue). The lead runs in session A1 and is the only writer of this board and status/A1–A4.md; lanes report to the lead.

| Lane | Session | Owns |
|---|---|---|
| A1 | A1 (lead + lane) | T06, H-A2, T26/T35/T28 minors, T38; board, questions, decisions |
| A2 | A2 | T32 (priority, unblocks C3), t04-minors, T33, H-A11 |
| A3 | A3 | T34 (+ builder findings + D93 blocker), H-A9, T31, t05-minors; holds builder.service |
| A4 | A4 | T07 → T08 → T25 → H-A7, T29, T30, T36, H-A12 |

## Critical path

`T01 (base merge + vue-tsc)` → B1 merges = **BASE-2** → `T03 b08` → `T04 b01 lifecycle` → `T05 DB specs re-run` → `T23 E2E` → R1 sign-off.
Everything else runs beside it and merges BASE-2 in when it lands.

## Tasks

| ID | Handoff | Task | Lane | Depends on | Branch | Status | Evidence / verdict |
|---|---|---|---|---|---|---|---|
| T01 | (a-1)+(a0) | Merge `origin/handoff/shared-tree-2026-10-31`, resolve conflicts, fix the 5 vue-tsc errors; registry-boot, api tsc, vue-tsc, m04/m28/bijak specs | A1 | — | r1/t01-base-merge | **MERGED (BASE-2)** | api tsc 0; vue-tsc 0; registry-boot 3/3; m04+m28 928/928; m11+registry-boot 261 pass / 0 fail (lead re-run); m03/m05/m12/ds pass; bijak specs 470/474 (golden.spec 4 pre-existing → H-A4); eslint 0 errors. No auth/files/input change in fixes. Evidence: status/A1.md |
| T03 | (a) | Verify `r1/b08-bridge`: vue-tsc m28, bijak-question-bridge, be09-paper spec, DB test of image read rule; merge BASE-2 into it | A2 | T01 merged | r1/b08-bridge | **MERGED (BASE-3)** | BASE-1 merged; api tsc 0; vue-tsc = base (38 = base; 0 on trial merge with T01); m28 unit 472/472; bridge + be09-paper + question-image-access specs 144/144; eslint 0 errors; trial merge with T01 09d32822: no conflicts, tsc 0, vue-tsc 0, 144/144, 472/472. Pre-existing: golden.spec 4 (H-A4), seed/poc.spec 1 (H-A5). Merge right after T01 |
| T04 | (a) | Finish `r1/b01-lifecycle`: 4 `'published'` spots, drop `published` from isServableStatus, migration 0100 on a seeded DB, tsc/eslint/m04 tests/specs | A2 | T03 merged | r1/b01-lifecycle | **MERGED (BASE-4)** | migration 0100 spec 4/4 (draft 4→4, review 2→6, approved 4→6, published 6→0, archived 1→1; served count unchanged); `'published'` question-status spots changed in practice bridge/structured/overview(4)/listing(2)/analytics, account, bijak bridge/pool-source/kuiz, builder bankQuery; `SERVABLE_QUESTION_STATUSES=['approved']`; paper Terbit untouched; m28 admin wire approved→Terbit. D91: bankMatrix `group_id IS NULL`, card-ungrouped.spec 2/2 (BM 50, login 493). api tsc 0; vue-tsc 0; FE m04+m28 951 pass / 43 fail (questions-store.perf timing budget, pre-existing); bijak/files/builder specs 1003 pass / 4 fail (golden, fixed in T05); eslint: 2 pre-existing errors in untouched files |
| T05 | (b) | Run never-run DB specs (B06 list, be09-paper, challenges-savepoint), fix; before/after counts (login 493; BM 53, MATH 54, SCI 50; one draw); re-run after T04 | A3 | T01 merged (first pass), T04 (final) | r1/t05-db-specs | **MERGED (BASE-5)** | ddacd4e0: 8 never-run specs now green (draw-bounded 33/33, served.db 6/6, assignments-adapter 12/12, source 14/14, spm-servable 6/6, lobby 5/5, challenges-savepoint 3/3, invitations 21/21, new servable-counts 2/2), test-only fixes; api tsc 0; eslint 0. Counts: login 493; practice cards BM 53 / MATH 54 / SCI 50; drawable BM 50 (3 group MCQs) → D91; admin approved T4 MCQ +1 in Databank, Latih Tubi SPM, Mock K1, login. 4fff21ab adds: spm/hub 19/19, spm/mocks 21/21, shape-perf 6/6, golden 18/18 (H-A4), seed/poc 25/25 (H-A5: seed-profile.md was stale, 493/21891), servable-counts 3 pass + 3 todo (five readers incl. Battle SPM + Misi = H-A1). Test + doc only, no src/seed change. **Final pass after T04**: 20 specs all green one file at a time; BM practice card 53→**50**, login 493, card = details = drawable for BM 50 / MATH 54 / SCI 50; admin T4 MCQ approved only → Databank, Latih Tubi SPM, Mock K1, login +1, Battle SPM + Misi serve it |
| T06 | (g) | Student Jana Kertas → `composeStandardPaper` (D75); update generate.spec + golden-mock.json | A1 | T01 merged | r1/t06-jana-standard | **READY-FOR-REVIEW** @ 502280f5 (off T01 09d32822) | `POST /bijak/papers/generate` → `composeStandardPaper` (exact-or-refuse: 422 SHORTAGE, 503 GENERATE_LIMIT, no row on refusal; Disahkan-only, Admin Pusat Mod Pelajar may use Spec); stores `standard_report` (AC-34.7). api tsc 0; generate.spec 19/19 (D90 groups whole + consecutive, version pinning); bijak+builder specs 878 pass / 5 fail (golden 4 = H-A4, poc 1 = H-A5, pre-existing); eslint 0. Note: PoC blueprints with null mark_budget now refuse (release note for T24). No auth/files/input change |
| T07 | (f) | Question-model gaps: `groupOf` 7 stimulus kinds + caption/tableData/sourceCitation; `essay_choice` in parts contract; question-bank.source multi-stimulus groups; stimulus-body read for kuiz/bridges | A4 | T01 merged; **T03 (b08) merged first** | r1/t07-model-gaps | **READY-FOR-REVIEW** @ 809c2749 (contains b08 7050f2d7 + t01 09d32822; merge after T03) | b08 merged in, be09-mapping essay_choice cast fixed; m12 KirkpatrickOverviewPage restored to T01 version (b08 merge reintroduced the stale OverviewInfo line). api tsc 0; stimulus-display + exam-builder + bijak-question-bridge + question-image-access + bijak-kuiz + questions/groups: 24 files, 476 pass; contract 71/71; openapi --check ok; eslint 0. Touches input (contract) |
| T08 | (h) | R1-B21 secondary-only guard on Bijak + builder paths incl. `exam/builder/question-bank.source.ts` ~79 | A4 | T07 merged (same file) | r1/t08-secondary-guard | QUEUED | |
| T25 | (f) follow-up | `essay_choice` storage: migration 0101 (mode CHECK, topics column, projection, publish gate); drop the 422 ESSAY_CHOICE_NOT_STORED refusal added by T07 | A4 | T08 merged | r1/t25-essay-choice-store | **READY-FOR-REVIEW** @ ed5737c4 (merge after T08; doc numbering commit to follow) | migration 0101_essay_choice; api tsc 0; **vue-tsc 0**; m28 FE 472/472; broad api run 1708/1726 (17 fail = T05 set: golden 4, source 8, draw-bounded 3, shape-perf 2, fixed on r1/t05-db-specs); essay-choice-store 7/7; eslint 0; openapi --check ok. Touches input (question write path) → security review |
| T10 | (c) | Set Builder + Semak Kertas UI: SetBuilderPage `/admin/studio/sets/:paper/builder`, routes, PaperEditorPage extension (header, ReviewBlock, Terbitkan disabled w/ reason, Tarik balik, Salin set, student view), menu KS-17, tests; V2 Panel labels (Jana set + Terbitkan = 2 clicks) | C1 | T01 merged | r1/f08-builder-ui | QUEUED | |
| T11 | (d) BE | Verify `r1/b16-kuiz` top WIP; count fallback 20 (V2); D90: random mode serves member with its group stimulus; per-paper shows stimulus once per group | C2 | T01 merged; T07 for stimulus-body read | r1/b16-kuiz | QUEUED | |
| T12 | (d) FE | Verify/finish `r1/f12-kuiz`: `/simulasi/kuiz`, `/simulasi/:paperId/kuiz`, reuse `src/components/question-display`, route reachable (prototype scope), tests | C2 | T11 | r1/f12-kuiz | QUEUED | |
| T13 | (e) | Studio create/edit: one stimulus + ≥2 members (add/remove/reorder), DSKP tags per leaf (unit, SP, TP, cognitive), Bab, images; intake links a figure to EVERY referencing question; V2 Studio labels (4 clicks to publish) | C3 | T01 merged; read side from T07; labels from T04 | r1/t13-studio-groups | QUEUED | |
| T14 | QA bugs | Student smoke bugs B-06 (structured stem rows as answer boxes), B-07 (/spm "0 Tahun Tersedia"), B-08 (empty-subject "Mula" + "Locked: 0/40"), B-09 (wrong-answer panel) per D9 with V2 citation | C4 | T01 merged | r1/t14-student-bugs | QUEUED | |
| T15 | (j) | Apply proposed BM copy (handoff §7j) once confirmed in QUESTIONS.md Q1 | C4 | Q1 answered | r1/t15-bm-copy | QUEUED (Q1 = YES, unblocked) | |
| T16 | — | Responsive pass 375/768/1280 on every R1 page after T10–T14 merge (no UX changes, layout only) | C4 | T10–T14 merged | r1/t16-responsive | QUEUED | |
| T20 | — | Integration: merge queue for APPROVED units (`--no-ff`), re-run tsc + targeted tests on the merge result, BASE-n log, TRACKER.md change log | B1 | continuous | feature/v3-bijak-r1 | QUEUED | |
| T21 | (i) | G4 code-review of every READY-FOR-REVIEW unit; full review of everything since 100496c2 | B2 | continuous | — | QUEUED | |
| T22 | (i) | Security review for units touching auth/files/input (T03 image rule, T11, T13 intake/uploads, self-mark); full security pass since 100496c2 | B3 | continuous | — | QUEUED | |
| T23 | (i) | E2E: Playwright flow admin uploads (form/CSV/PDF, image, D90 group) → approves → builds paper → Terbit → pupil sits, self-marks, result, Cuba Lagi; Databank/Latih Tubi SPM/Bab receive the question; 375/768/1280; re-test B-01, B-02, B-04, B-05 | B4 | baseline now; final after T04, T05, T10–T13 | r1/t23-e2e | QUEUED | |
| T24 | (l) | Release runbook for the human deploy: migration order 0092 → 0093 → 0100 (+ any 0101–0119), DSKP load, Disahkan blueprint, config; `docs/ops/r1-release-notes.md` | B1 (idle time) | after T04 | r1/t24-release-notes | **MERGED (BASE-6)** | |


## Team A queue from the R1 backend gap audit (H-A10, 2026-10-31)

| ID | §13.3 | Task | Lane | Depends on | Branch | Status |
|---|---|---|---|---|---|---|
| T26 | R1-B19 | Local/E2E seed behind a guard: T4 pupil, Admin Pusat, one T4 blueprint Disahkan + serves_students (D77 evidence). **Unblocks T23 (B4)** | A1 | — | r1/t26-e2e-seed | **READY-FOR-REVIEW** @ dfa88cf0 — `prisma/seed/e2e.ts` (profile e2e + `E2E_SEED=1`, default off, prod guard skips); T4 pupil + Admin Pusat (example.test, demo-password convention); launch blueprint 3472/2 → Disahkan + serves_students via the real Sahkan checks (only blueprint that passes honestly); e2e.spec 7/7; registry-boot 3/3; api tsc 0; eslint 0; docs/ops/e2e-seed.md. Touches auth (accounts) → security review |
| T27 | R1-B21 residual | Refuse Darjah level on question and blueprint create (BM message) | A1 | — | r1/t27-darjah-refusal | **MERGED (BASE-8)** @ 3cf53190; was 2024e2fa — question create/edit with primary level now 422 (`questions.service` draftOf, writes nothing); blueprints already refuse (spec only); primary-level-refused 3/3 (2 fail before), blueprint-primary-unit 2/2; api tsc 0; eslint 0. New input validation |
| T28 | R1-B14 | Reward parity on Bijak submit (XP, Syiling, kombo, Prestasi), idempotent | A1 | — | r1/t28-bijak-rewards | **READY-FOR-REVIEW** @ 19ff1af9 — V2 BIJAK-SPM-cloud §4.5: XP 10/mark and streak (kombo) were missing on Bijak submit, fixed in `bijak/integration/bindings.ts` (one tx, XP only on a new credit, Mod Pelajar earns nothing); Syiling + Prestasi already correct; rewards/flow specs; bijak specs 241/245 (4 = golden, fixed in T05); api tsc 0; eslint 0. Open: self-mark Syiling delta → Q2 |
| T29 | R1-B03 lite | Servability service + contract (evaluate per activity over existing predicates, BM reasons, parity spec), no facts table (D92) | A4 | T03, T04 merged | r1/t29-servability | **READY-FOR-REVIEW** @ 4a0ef95b (contains T04 + b08; SERVABLE_STATUSES = approved; t29 specs + bridge + builder 447/447) — contract `servability/` (6 activities, 25 reason codes, BM copy in one table, design 9.3 sentences verbatim, rest [PROPOSED]); `questions/serving/` evaluate + filterOf reuse real reader predicates; rules spec 9/9, DB parity spec 9/9 vs real draws; contract 5/5; openapi --check ok; api tsc 0; eslint 0; regression 1172 pass / 13 fail (T05 set). Touches `practice/question-bridge/be09-practice-{mapping,question-source}.ts` (PRACTICE_SHAPE move) |
| T30 | R1-B11 | Admin servability reads ("Dilihat murid di"): single, batch, overview, lanes | A4 | T29 | r1/t30-servability-reads | **READY-FOR-REVIEW** @ f2eeec7d (+ archived-on-published-paper fix: reason `archived`, lane attention, parity vs getMany(published=true); 29/29) — `/api/admin/servability/{questions/:id, questions/batch (≤100), overview, lanes/databank, lanes/bijak-spm}`, Admin Pusat only, rate limit `THROTTLE_SERVABILITY_READ_PER_MINUTE` (new env, in .env.api.example), CSRF on batch; per-id Jana read; 5k-bank perf: single ~110–210 ms, batch 100 ~280–410 ms, lane page ~100–120 ms, overview ~2.1–2.5 s; reads 9/9, perf 5/5, contract 9/9, openapi --check ok, api tsc 0, eslint 0. New input → security review |
| T31 | R1-B08/B09a wire | Builder wire: `stimuli[]`, 7 kinds, picture URL (kuiz wire → C2 under T11) | A3 (moved from A4) | T34 | r1/t31-builder-wire | pushed @ 477fbb7c (BASE-6; READY after T34 merged in; + builder↔bridge table parity 10 shapes, qb-stimuli 17/17, builder + bridge 280/280, vue-tsc 0): admin student view + editor groups carry `stimuli[]` 7 kinds, image group kind 'image' + `/api/files/<token>`; chain 27 + 1 todo; 6 builder specs 141/141; contract 1428/1428; openapi ok; tsc 0; eslint 0 |
| T32 | R1-F03 backend | Stimulus + stimulus-group HTTP API for Studio (create/edit stimulus 7 kinds + image, group 1–3 stimuli + ≥2 members, add/remove/reorder, create in group; intake links one figure to every referencing question). **Unblocks T13 (C3)** | A2 | T04, T07 | r1/t32-stimulus-api | **READY-FOR-REVIEW (re-review)** @ 87a9a363 (BASE-6 merged) — B2/B3 fixes: `stimulusGroupId` on POST/PUT /api/questions via GroupMembers (memberTaken 422, groupServed 409); served lock on every write path (stimulusServed/groupServed/memberServed 409); group FOR UPDATE (4 parallel creates 201); 40 cap (membersTooMany 422); D93 draft groups 0–1 members + warning; atomic `PUT /stimulus-groups/:id/members`; decimal ids 422; content_hash nulled on edit. api tsc 0; contract tsc 0; eslint 0; contract:check up to date; stimulus-group-rules + stimulus-api 37/37; stimulus-links + groups/stimulus-display/pksk-leaf/crud/service/bijak-pool/schema + intake stimuli + question-image-access 101/101; contract questions 78/78. Needs B2 re-review + B3 (files + input). **Lead re-run @87a9a363: BASE-6 ancestor ✓; api tsc 0; contract:check ok; stimulus-group-rules + stimulus-api + stimulus-links 3 files 40/40.** **C3: Studio API ready** (see note below) |
| T33 | R1-B05 | Per-leaf `tp`/`cognitive_level` (migration 0102), merged approve gate, gate-check route, status with servability | A2 | T32, T29 | r1/t33-leaf-tags | **READY-FOR-REVIEW** @ 276a6622 (310f1ed1 + docs line; BASE-6 + T32 87a9a363 merged) — migration 0102_leaf_cognitive_level; DSKP approve gate for SPM T4/T5 new approvals (cognitive level per leaf + kertas); `GET /api/questions/:id/gate-check`, `POST /api/questions/:id/status`; `dskpStatus`/`dskpComplete` reads; intake carries cognitiveLevel; **B3 bulk-approve gap CLOSED** (bulk, status route, gate-check and create-as-approved share one full approve gate; refused bulk rows in `failed[]`). api tsc 0; eslint 0; contract 1433/1433; targeted 82/82; questions 739/739, questions-workflow 264/264, intake-workflow 95/95, spm 103/103, bijak-papers 102/102, practice-reads 106 + 1 skip. Lead: create-as-approved keeps skipping the submit gate (approve gate is the bar; Bab optional per D89). Needs B2 + B3 |
| T34 | R1-B09a/B09b | Builder per-row servability + audited override; paper-review edits (metadata, Bahagian, petikan title, reference assets, add/delete extra question) | A3 | T05 final, T29 | r1/t34-builder-review | **READY-FOR-REVIEW** @ e363fe51 (BASE-6; tsc 0, vue-tsc 0, eslint 0, contract 48/48, exam-builder + chain 357 + 1 todo). Added: builder.service early-return MAJOR fixed (one never-overridable blocker per placed question missing from the pool); minors (1-member group keeps groupId, full-set search, null blueprint 422, lock before compose); D93 "Kumpulan perlu sekurang-kurangnya 2 soalan." (not overridable); R1E2E-06 Terbit refuses questions the attempt path refuses (not overridable); R1E2E-07 / AC-R1-16.2 Terbit needs Disahkan, overridable with reason + audit; 5 D9 rows. Earlier: G3 `GET/PUT /api/admin/section-pools/:questionId` (blueprint pool tags only, audited); review rows `reasons` + `seenIn` from ServabilityService; audited Terbit override `{override, reason≥5}` for structural blueprint blockers only; B09b edits (Bahagian label/instruction/compulsory, Bahan rujukan panels with `question_image`, petikan title, extra question) read-only after Terbit; 4 D9 rows in v2-backend-deviations.md; builder-review 16/16, builder-api 31/31, placements 20/20, wired-bank 10/10, builder-security 55/55, contract 1428/1428; chain spec 25 + 1 todo; api tsc 0; eslint 0; openapi --check ok. New input → security review |
| T35 | R1-B17 | Laporan Soalan: lifecycle archive from the report row; spec with a Bijak question id | A1 (moved from A2) | T04 | r1/t35-report-archive | **READY-FOR-REVIEW** @ 2dd3c598 — `PATCH /question-reports/:id {archive}` → real lifecycle archive (status event, same tx); archived question leaves Latih Tubi SPM and new Jana pool; started sittings keep pinned version; report-archive.spec 8/8; questions-workflow + bijak-integration 301/301; api tsc 0; eslint 0. New input → security review. Follow-up H-A13 (Terbit paper with archived question) |
| T38 | Q2 / D94 | Self-mark reward delta as V2 with a cap: 2 Syiling + 10 XP per mark gained, positive delta only, once per part, ≤ part full marks, no claw-back; idempotent key per attempt+part | A1 | T28 (merged) | r1/t38-selfmark-reward | **READY-FOR-REVIEW** @ 662e602f (BASE-17): `BijakRewardPort.awardSelfMark`, ledger key attempt:part:level, cap, no claw-back, Mod Pelajar none, per-part advisory lock; rewards.spec +5 real-wallet cases; bijak-integration + attempts + kuiz 263/263; tsc 0; eslint 0 |
| T39 | D95 | Evidence list for 4 go-live K1 blueprints (1449/1, 1249/1, 4531/1, Sains K1) + 3472/2 worked example: Kontrak fields, evidence in repo, missing bodies, Sahkan checks → `docs/ops/r1-k1-blueprint-evidence.md` | A3 | — | r1/t39-k1-evidence | **READY-FOR-REVIEW** @ 1a26f7a6 (docs only: `docs/ops/r1-k1-blueprint-evidence.md`). Sahkan today: 3472/2 yes on repo data (caveat: duration 150 has 1 real body → needs a cover page / 3rd body / LPM format doc); 1449/1 no (KBAT 35 vs 36, needs a legible SBP Q13 scan + a 2nd skema or LPM format); 1249/1 no (1 body); 4531/1 no (paper + skema of a 2nd body); Sains K1 no (nothing paper-derived; code 1511/1 unconfirmed) |
| T40 | AC gaps (H-A17) | Attempts AC specs: R1-02.1 pick cap, R1-03.1 five modes end to end, R1-05.2 resume, R1-06.2 band rounding, R1-06.5 unmarked part pending, R1-10.2 Cuba Lagi rewards, R1-10.4 Databank → Prestasi (`past_year` kept, D9 naming row) | A1 | T38 | r1/t40-attempts-acs | **READY-FOR-REVIEW** @ 90973d72 (on T38): specs R1-02.1/05.2/06.2/06.5 (ac-r1.spec), R1-03.1 five modes, R1-10.2 Cuba Lagi rewards, R1-10.4 Databank → Prestasi (`past_year` + D9 row); no code fix needed; 250/250 + practice 26 files + FE semakan 29; tsc 0; eslint 0 |
| T41 | AC gaps | Curriculum/DSKP loader specs: R1-12.3 rejected-row reason, R1-12.5 load changes no served count, R1-19.3 Darjah refusal text | A1 | T40 | r1/t41-curriculum-acs | IN-PROGRESS |
| T42 | AC gaps | Laporan Soalan R1-18.1–18.4 (paper/attempt on question_reports, **migration 0103**; labels per V2; Kuiz exclusion on archive); intake R1-14.3 figure crop → question_image; AC-03.4 free-text tag | A2 | H-A16, T36 | r1/t42-reports-intake-acs (part 1, migration 0103, on T35) + r1/t42b-intake-acs (parts 2–3, off BASE-6) | part 1 **READY-FOR-REVIEW @ d1210e96 (BASE-17)**; was bc5c36e7: migration 0103 question_reports.paper_id + paper_label + attempt FK; `POST /api/question-reports {attemptId?, paperId?}` (own attempt, question in composition, context from the attempt); admin/mine rows carry `paper`; R1-18.2 labels follow V2 (Menunggu/Disemak/Diperbaiki/Dikeluarkan/Ditolak, AC wording fix); R1-18.4 random Kuiz excludes, per-paper Kuiz → REQ-A-003 (C2); report-context 9/9, reports/schema/archive 60/60, kuiz 21/21, contract 1409/1409; tsc 0; eslint 0; input + migration + ownership → B3. Parts 2–3 in progress |
| T43 | AC gaps | Chain upgrade (T5 pupil, blueprint created + Disahkan via API, T33 gate, pupil Jana Kertas: R1-20.1/20.2, AC-18.1/18.2) + builder publish specs AC-07.4/07.6/07.7/07.9 | A3 dev-1 | T34, T31 | r1/t43-chain-publish-acs | QUEUED |
| T44 | AC gaps | Blueprint: R1-21.4 / AC-06.2 "Boleh tanda auto" (auto_markable) in Kontrak write schema; AC-06.5/06.6 null tolerance + "Blueprint perlu semakan" flag | A3 dev-2 | H-A15 note gate | r1/t44-blueprint-fields | **READY-FOR-REVIEW** @ e7be54fe (contains H-A15; base merge pending): `autoMarkable` on Kontrak create/version/view (existing column, no migration), not in the structural hash; AC-06.6 "Blueprint perlu semakan" flag computed on read vs newest 20 published papers (`reviewPapers`, never blocks); AC-06.5 null tolerance pinned; 361/361; tsc 0; eslint 0; vue-tsc 0. B3: note schema + new read path |
| T45 | AC gaps | Servability AC-04.3/04.5/05.3 + admin lanes R1-21.1/21.2/21.3/21.6 (AC-04.4, 16.3 → A2 T45b) | A4 | R1E2E-05b, T30 | r1/t45-servability-acs | QUEUED |
| T46 | AC gaps | Docs: R1-07.1/10.1 verify-first notes; keep the coverage doc current with T40–T46 | A3 docs agent | H-A17 | r1/ha17-ac-coverage | **READY-FOR-REVIEW** @ 349d0fc3 (ids filled, BASE-8) (`docs/qa/r1-verify-first-notes.md`; coverage now proven 91, partial 44, no proof 4, FE 31, R2 2, skipped 1, superseded D96 3 → 47 gaps) |
| T45b | AC gaps | AC-04.4 question detail lists its papers; AC-16.3 image upload reactivates a held question | A2 | T42 part 1 | r1/t45b-question-detail-acs | IN-PROGRESS |
| T47 | D79 parity (H-A19) | Question bank: list filters Tahun/Negeri/Kertas/Jenis; filter-based bulk "Luluskan Hasil Tapisan" / "Arkib Semua" (full gate per row, failed[], cap, confirm count); V2 illegal-move message "Peralihan '…' -> '…' tidak dibenarkan." | A2 | T45b | r1/t47-bank-parity | QUEUED |
| T48 | D79 parity (H-A19) | Builder (+ P5 `pinned` per placement, R3 body/caption edit, REQ-C-008 title max 200): patchable "Kod kertas (kulit)"; per-paper section rule/select-count; review "Tambah bahagian" + "Tambah soalan" (new question in paper via T33 gate) + "Padam soalan"; paper list subject + search filters | A3 | T34 follow-up | r1/t48-builder-parity | QUEUED |
| T48a | D79 parity | Paper list subject + search filters (R12); title max 200 everywhere (REQ-C-008) | A3 dev-2 | — | r1/t48a-paper-list | IN-PROGRESS |
| T43b | AC gaps | Builder publish specs AC-07.4/07.6/07.7/07.9 (split from T43) | A3 dev-2 | T34 follow-up | r1/t43b-publish-acs | IN-PROGRESS |
| H-A24 | docs | R1 release-notes input table for B1 | A3 docs agent | — | r1/ha24-release-input | **READY-FOR-REVIEW** @ 12cabae7 (`docs/ops/r1-release-input-team-a.md`; deploy-config items → REQ-A-009) |
| H-A25 | docs | Run 0102/0103/0105 verification SELECTs on a local migrated DB; add them to the runbook | A3 docs agent | H-A24 | r1/t37-r1-runbook | IN-PROGRESS |
| T50 | AC partials | Close "partial" ACs in A1 area | A1 | — | r1/t50-partial-acs | **READY-FOR-REVIEW** @ 7254a8a2: R1-11.3 (databank-sejarah.spec), AC-10.9 (reveal-data.spec) proven; other A1 rows closed by T40/T41/T38 once merged; R1-10.1 / R1-11.4 = docs/ops proof; AC-10.6 FE; AC-08.4 → A4; AC-20.3 → T52 |
| T52 | AC-20.3 | Cover `examinerGrid: boolean` | A1 | — | r1/t52-examiner-grid | **READY-FOR-REVIEW** @ c8490879 (BASE-27; examiner-grid.spec; bijak-papers 112, bridge 129, attempts 173, integration 62, contract 1424; FE → REQ-A-012). Merge note: T36 deletes poc-question-source.ts which T52 edits → take T36's deletion |
| c-requests-a1 | REQ-C-012/013 | edit-as-draft endpoint; archive without reason + review → archived | A1 | — | r1/c-requests-a1 | IN-PROGRESS |
| T51 | AC partials | Close "partial" ACs in builder / Semak Kertas / Terbit / Kontrak / Jana admin / chain (incl. Jana short-pool variant) | A3 dev-1 | T43 | r1/t51-partial-acs-a3 | IN-PROGRESS |
| T53 | AC partials | Close partial ACs in servability / lanes / stimuli / intake / reports | A4 | — | r1/t53-partial-acs-a4 | **READY-FOR-REVIEW** @ 0fcae409: AC-R1-21.6 API part (pool blocks ≤ 100, search; 150 cap = FE) + PIPE AC-08.4 admin part proven; others proven-pending-merge on t42/t42b/t45-*/t45b; AC-18.4 per-paper Kuiz closes with C2's T11 |
| T54 | perf | 400k-bank p50/p95 for pupil + admin read paths; flag > 1 s with proposed fix (no schema change without lead) | A4 | — | r1/t54-perf-400k | IN-PROGRESS |
| T36 | R1-B07 | Remove PoC fixture and composite split; bank is the only source | **A2** | T04 (contains b08) | r1/t36-remove-poc @ 40d4851d | **READY-FOR-REVIEW** (BASE-6 merged): bank is the only question source for Bijak papers, attempts, Jana, kuiz, builder; `BIJAK_POC_QUESTIONS` deprecated no-op (warns when true); PoC export → prisma/seed/poc/export, doubles → test/support/poc; poc-flag specs rewritten + bank-sources.spec 5; bijak-papers 102, bijak-attempts 173, bijak-integration 60, bridge 110, exam-builder 295, seed 138 + 1 skip, school-admin 239, config 10, registry-boot 3 (all green); tsc 0; eslint 0. **Merge after T26, and B1 must first switch the e2e workflows off PoC papers**: `BIJAK_POC_QUESTIONS` true at compose.http.yaml:31, render.yaml:27, .github/workflows/e2e-http.yml:74, .github/workflows/frontend.yml:102 (+ deploy/vps/compose.prod.yaml:77/113 false). Seeded PoC papers become unplayable outside tests (403 not eligible; Jana 422 SHORTAGE). Release-note text in status/A2.md |
| T37 | R1-D01/D02 | Consolidated ops runbook (migrations 0092→0093→0100→0101, env, verification queries) + D95 (admin creates + Sahkan on UAT, no seed) | **A3** (cycle 7) | T35 | r1/t37-r1-runbook | **READY-FOR-REVIEW** @ 971dfca0 (+ §4.2 → D95; before: 5540289f (+ release-notes §4.1 → D95; runbook SQL 51/51 ok on a local migrated + seeded postgres:16, recorded in §9) (was b0d0046f; BASE-6 merged; docs only: status table, 0092→0093→0100→0101→0102 with pre/post SELECTs, VACUUM ANALYZE + rollback, env names, D95 §5 Kontrak + Sahkan order, no-seed check, links T39). Follow-up on branch: release-notes §4.1 → D95; run all SELECTs on a local migrated DB |

R2 (deferred by D92): practice-family bridge with images/groups (Databank, Latih Tubi, Bab), dropping `spmPool`/pool tags (0107).
Team C note (C3 Studio, T33 @ 310f1ed1 fields): `cognitiveLevel` mengingat|memahami|mengaplikasi|menganalisis|menilai|mencipta (kbat derived) — flat: top-level, structured: `parts[].cognitiveLevel` per leaf; `kertas` '1'|'2'|'3' (null clears); reads `dskpStatus {complete, issues[{path,code,message,step}]}` + list `dskpComplete`; `GET /api/questions/:id/gate-check?gate=approve|submit`; `POST /api/questions/:id/status {to, reason?}` → {question, servability}; 422 "Soalan belum memenuhi syarat untuk diterbitkan." details.gate='approve'; codes LEAF_COGNITIVE_LEVEL_MISSING (step 3), LEAF_TP_MISSING (3), KERTAS_MISSING (1), UNIT_MISSING / SP_MISSING (4).

Team C note (C3 Studio on T32 @ 87a9a363): admin-only, envelope {data,status}; `POST/GET/PUT/DELETE /api/stimuli[/:id]`; `POST /api/stimulus-groups {stimulusIds 1..3, questionIds? 0..40, label?}` → detail with `warning`; `PUT /:id` label/stimulusIds; `DELETE /:id`; `POST /:id/members`, `DELETE /:id/members/:questionId`, `PUT /:id/members/order`, atomic `PUT /:id/members {questionIds}` (drag-and-drop), `POST /:id/questions` (create in group). 422 codes membersTooMany/memberMixed/memberInactive/memberTaken/memberExists/membersInvalid; 409 groupServed/memberServed/stimulusServed; BM texts in contract `questions/stimuli.ts` STIMULUS_MESSAGES. C3 should drop its duplicate group API (B2 recommendation). C3 (T13 Studio) must offer a cognitive level per leaf and Kertas for SPM T4/T5 questions: the approve gate refuses without them after T33. C2 (T11) also widens the kuiz wire to the 7 stimulus kinds after T07 merges (T07 added a `KUIZ_KIND` collapse table in `kuiz.mapper.ts`). C3 (T13) builds Studio on the T32 API.

## Standby queue (a lane with no unblocked task takes the next one for its own team; never another team's)

| ID | Team | Task |
|---|---|---|
| H-A1 | A | DONE in T05 @ 4fff21ab: Spec coverage for `SPM_SERVABLE_SQL` readers (Databank, Latih Tubi SPM, Mock K1, Battle SPM, Misi): one approved-T4 fixture proves all five serve it |
| H-A2 | A | **READY-FOR-REVIEW** `r1/ha2-reports-darjah` @ 4eec8b78 (off T01): class member counts/ids (`VISIBLE_USER_SQL`), `ClassesRepository.all()` drops Darjah classes, teacher question stats `NOT_PRIMARY_LEVEL_SQL`; new spec classes/primary-hidden 4/4 (3 fail without fix); kelas-saya + question-stats-index adjusted; 21/21; api tsc 0; eslint 0 |
| H-A3 | A | CLOSED: `test/curriculum/learner.spec.ts` 28/28 on T01 head (fixed earlier by 8b fix3 c2b782e7); no change |
| H-A5 | A | DONE in T05 @ 4fff21ab (doc was stale): `test/seed/poc.spec.ts` 1 failure: docs/plan/seed-profile.md says spm_tracking_set_questions 493 / total 21891, seed produces 483 / 21881. Pre-existing on BASE-1 |
| H-A6 | A | DONE in T05 @ 5c96c7e9 (test-local secondary pupil at a 2nd school; queue 27/27; arena 15/15, forfeit 9/9, queue-guards 31/31 unchanged): `test/battle/queue.spec.ts` "school battle: bot from another school": no secondary pupil in another school in the demo seed (D72 seed gap) |
| H-A7 | A | **READY-FOR-REVIEW** `r1/ha7-essay-choice-flat-view` @ 66b3adb8 (stacked on T25; merge after T25): flat projection + `essayTopics` on QuestionRow/Question (contract, additive), bank-adapter explanation; new spec 4/4; api tsc 0; vue-tsc 0; eslint 0; openapi --check ok. FE label/topics in m04 → H-C3 after T04 |
| H-A8 | A | **READY-FOR-REVIEW** `r1/ha8-stale-specs` @ 56b1b6cc (battle/seed.spec 13/13 asserting D72 hiding; school-page 7/7) | Fixture-only fixes (D72): admin-delete-conflict 14/14 (fixture level KSSM), teacher-classrooms-lookup 11/11 (own SMK school), battle/school-page 7/7; battle/seed.spec 3 fail → lead decision: assert D72 hiding of the SJK(C) replay, no seed change. api tsc 0; eslint 0 |
| H-A9 | A | **READY-FOR-REVIEW** `r1/ha9-pipeline-chain` @ 1024616c (BASE-6 merged; chain 24 pass + 1 R2 todo; api tsc 0; test-only) (G1 closed: stimuli + groups over T32 HTTP routes; 24 pass + 1 R2 todo; was 28dae379) (on T05 final): `test/r1/pipeline-chain.spec.ts` 24 pass, 2 todo over HTTP — upload image → create groups + MCQs + structured → approve (approved only) → builder places group as unit (lone member 422) → review → Terbit → pupil sits, stimulus once, image readable (anon 401), submit, self-mark, result, Cuba Lagi → Databank/Latih Tubi SPM get the 3 solo MCQs only. Gaps: G1 (stimulus/group HTTP) closed by T32, being wired in; G3 section-pool tag has no admin route → T34; G2 closed by b08. |
| H-A11 | A | **READY-FOR-REVIEW** `r1/ha11-school-scope` @ 91432622 (BASE-6 merged; sampled-domains 34/34; tsc 0); was 72779429: NOT a leak. School-admin cross-school calls already 404; the failing line was the all-schools sanity read of a DEMO002 (SK, primary) user hidden by D72. Spec now uses an SMK fixture with controls; sampled-domains 34/34; test-only |
| H-A12 | A | **READY-FOR-REVIEW** `r1/ha12-conformance` @ c2a2e34b (on T04 2f16c1fe): suite targets the local in-process app (never a server). 27/400 → 406/406 (run + negative). Stale fixtures after D72/B01/B06 (Darjah grades, SK school, `published` filter, Spec blueprints, empty pools, D90 group placement) + regenerated openapi.json; local `setPocMarkBudgets` in boot (swap for T06 helper at merge); api tsc 0; eslint 0 |
| H-A13 | A | **READY-FOR-REVIEW** `r1/ha13-archived-paper` @ d51a4abf (on T35): new sitting on a paper with an archived question → 403 + BM \"Kertas ini sedang dikemas kini…\" [PROPOSED]; open sitting resumes (200, pinned); Kertas Pilihan hides the paper (kept for pupils with an open sitting); Arkib response lists affected published papers + BM warning [PROPOSED]; report-archive 10/10; bijak-papers/attempts pass except golden (fixed in T05); api tsc 0; eslint 0. T30 evaluator gap → A4 |
| H-C4 | C | m04 `components/report/ReportCard.vue` + `api/reports.ts` + mock: "Arkib" button sends `archive: true` (API from T35); after T04 |
| H-A14 | A (A1 IN-PROGRESS, r1/a-integration-preview) | Integration preview: all READY team A branches merged in order onto feature/v3-bijak-r1 (preview only, never merged by A), full targeted test run, conflict + failure notes for B1 |
| H-C5 | C | m28 Bijak "Mula": show the API BM message on 403 (paper unavailable) — API from H-A13 |
| H-A15 | A | **READY-FOR-REVIEW** `r1/ha15-blueprint-evidence` @ 7e5d637e (+ server-side note required: trimmed 1–2000, 422 \"Isi nota pengesahan dahulu.\"; 350/350; unit 1635/1635; base merge pending): (i) checkEvidence gates on origin='admin' rows only (AC-39.2); (iii) skema Markah agrees with budget OR choose-section offered marks (SPP 10.3, AC-39.7/39.8) in exam-core; 4 D9 rows; blueprint/exam specs 164/164; exam-core + contract 1620/1620; tsc 0; eslint 0. B3: origin filter |
| H-A16 | A | **READY-FOR-REVIEW** `r1/ha16-table-reader` @ b283a746 (BASE-17; 119 + 3 todo); before 8e04a9fa (on T32 87a9a363 + T07 b0421c6b; merge after both): one reader `questions/stimulus-table.ts` (+ `stimulusTableParts` → body:null when the table comes from the body); stimuli.repository duplicate removed; parity spec on A3's 10 shapes (Studio 10/10, builder 8 + 2 todo, bridge 19 + 1 todo — todos flip after T31 / R1E2E-05b one-liners); 85 pass + 3 todo; bridge stimuli 35/35; tsc 0; eslint 0 |
| H-A17 | A | **READY-FOR-REVIEW** `r1/ha17-ac-coverage` @ bef6f413 (BASE-23): 176 entries → **proven 113** (was 88), partial 24, no proof 2, FE-only 31, deferred R2 2, skipped 1, superseded D96 3. Remaining: AC-07.x (T43b), AC-18.1 (T51), AC-20.3 (T52), R1-10.1/21.6 partial, ops rows |
| H-A18 | A (A2, r1/ha18-gate-facts; plan APPROVED incl. migration **0105** question_versions.last_editor + declared_marks) | BE-09 does not store duplicate-flag, media and AI-editor facts, so those approve-gate rules are always satisfied on every path (pre-existing, from T33) |
| H-C6 | C | Kontrak evidence drawer: omit `rule` (and duration) on skema rows (SPP 10.3: a skema prints no rules) so choose sections don't show `differs`; keep "Isi nota pengesahan dahulu." (server now also refuses, H-A15) |
| H-A19 | A (A3 docs agent, r1/ha19-admin-parity) | D79 admin-UX parity check for R1: every admin.md row R1 covers vs V3 API (team A branches) and FE (team C branches): parity / label / steps / missing API / missing FE → `docs/qa/r1-admin-parity-check.md`; gap lists for A and C |
| H-C7 | C | Student FE: `QuestionBlock.vue` ~122-127 and `ResultPage.vue` ~409-413 render `<StimulusStack :stimuli="question.stimuli ?? (question.stemImage ? [question.stemImage] : [])" />` ABOVE the stem (V2 §1.5), one or the other (else a single picture shows twice). API from R1E2E-05b |
| H-C8 | C (C2) | Kuiz parity with R1E2E-05b: `kuiz.mapper.ts` resolveStimuli serves only a non-group picture (hardcoded 'diagram', passage/table → complete=false), KUIZ_KIND collapses 4 kinds; `kuiz.service.ts` prepare needs `versionStimuli` + `stimulusUseCounts` + caption/table/source on BijakKuizStimulusSchema |
| H-A19 | A | **READY-FOR-REVIEW** `r1/ha19-admin-parity` @ c7315b0e (docs): 66 rows; API parity 41 / label 3 / missing 12 / unconfirmed 3; FE parity 8 / label 22 / steps 7 / missing 17 / unconfirmed 6 → T47, T48, T45 wording; FE list → REQ-A-004 |
| H-A20 | A | **READY-FOR-REVIEW** `r1/ha20-student-parity` @ 557e17c6 (docs; BASE-19): 73 rows; API parity 49 / label 1 / step 2 / missing 2 / unconfirmed 4; FE parity 30 / label 13 / step 9 / missing 2 / unconfirmed 5; A items already in T38/T40/T41/T42; FE → REQ-A-005; copy rule: V2 .cloud source wins, V1 only where V2 has none |
| H-A21 | A (A4 dev1, after T45 Part 1) | Servability overview cache: 400k bank overview = 22.5 s (T30); short-TTL cache + stale-while-revalidate, event invalidation where cheap, `computedAt`; target warm p95 < 500 ms. Migration only with lead approval (0105 next free) |
| H-A22 | A (A3 docs agent, r1/ha22-parity-docs) | Deviation rows S-10 (attempt survives logout), S-45 (random Kuiz stored + rewarded, D85 U8); mark stale student.md B13/B15–B18 done; fix D-references |
| H-A23 | A (A3 docs agent, r1/ha23-e2e-readiness) | R1 E2E readiness map: each acceptance-flow step → API routes + FE pages → unit/branch, merged or not, blockers; recommended merge order for B to unblock T23 fastest |
| H-A26 | A | **READY-FOR-REVIEW** `r1/ha26-team-a-state` @ 45d3b954 (docs) |
| H-A27 | A (A3 docs agent, standing) | After each BASE-n / READY: refresh team-a-r1-state + coverage doc; report deltas |
| (was H-A26) | A (A3 docs agent, r1/ha26-team-a-state) | Team A state/handoff doc `docs/handoff/team-a-r1-state.md` (units, decisions D91–D97 + Q1–Q7, migrations 0100–0105, open requests, how to resume, hazards) |
| H-A4 | A | DONE in T05 @ 4fff21ab: `test/bijak-attempts/golden.spec.ts` 4 failures (sej-k2-2025-a): mock engine emits `selfMarkable: true` on `belum_dimarkah` parts; spec strips it only on the API side. Pre-existing on BASE-1 |
| H-C3 | C | m04 admin list/detail: show "Esei pilihan" + topics list when `essayTopics` is present (API from H-A7). After T04 merges (m04 lock) |
| H-A10 | A | DONE: audit at lead scratchpad; result = tasks T26–T36 below and D92 |
| H-B1 | B | Unit sweep m01/02/03/04/05/08/09/16/27 + registry-boot on the latest BASE; file failures to the owning team's status file |
| H-B2 | B | `lint:admin` ratchet for the 7 m02/m03/m09 findings (report only; the fix goes to C) |
| H-C1 | C | ChapterIndexPage / Soalan by Chapter empty state (B-01 FE side) per V2 |
| H-C2 | C | Stale m17/m12/m11 unit tests and UserListPage number format (report first; fix only if R1 path) |

## After R1 sign-off (G5 Ready + user confirmation): R2 queue, issued by the team A lead

A: Tracking A sets (BE), Mock K1/K2 (BE), practice-family bridge upgrades (images and groups in Latih Tubi/Bab/Remedial).
C: Tracking A editor UI, Mock K1/K2 UI (B-03), Subjektif SPM / Latihan Berstruktur, Heatmap.
B: review, security, E2E and release for each R2 unit.

## Migration ranges (update)

Team A 0100–0109, overflow **0120–0129**; team C 0110–0119. In code today: 0092, 0093, 0100 (T04), 0101 (T25), 0102 (T33). Reserved: 0103 (T42, A2), 0104 (T48 `paper_sections.admin_created`, A3), 0105 (H-A18, A2). Next free: 0106. Planned numbers are in `docs/architecture/v2-admin-student-pipeline.md` §2 (renumbered on T25).

## Decisions this cycle

- **D92** (same PR #404): R1 backend scope calls: Databank/Latih Tubi/Bab text-only in R1 (D87 U2); B03 lite first; keep B10 duplicate copy; pool-tag drop → R2; team A overflow migrations 0120–0129.
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

## Team A routing of B2/B3 verdicts (lead, cycle 7)

| Unit | B verdict | Routed to | Fix in progress |
|---|---|---|---|
| T06 | CHANGES-REQUESTED (bridge filter before compose; candidatesOf D72) | A1 | merge BASE-6 + T08; bridge-filter candidates + spec |
| H-A2 | CHANGES-REQUESTED (D72 half-applied: teacherStudentIds, classesByStudent, studentLines, schoolStudentLines, remedial) | A1 | full D72 + dashboard = cards spec |
| T26 / T35 / T28 | Approve with Minors | A1 | e2e pool for 3472/2 (201), production refusal; BM 409 on archive; streak asserts. AC-R1-10.2: Cuba Lagi re-earns per attempt (= V2), lead confirms |
| T32 | CHANGES-REQUESTED (stimulusGroupId bypass on /api/questions; served lock; concurrency; 40 cap) | A2 (priority, unblocks C3) | + **D93**: Studio creates a draft group (0–1 members) first, warning until 2, builder blocker "Kumpulan perlu sekurang-kurangnya 2 soalan." |
| T04 Minors | Approve (merged BASE-4) | A2 | **READY-FOR-REVIEW** r1/t04-minors @ ec179b12 (BASE-17; practice-reads + secondary-only-counts 119 + 1 skip); before cc630e49 (+ FD-11 fidelity row; was ad5867dc) (BASE-6): chapterQuestionCounts `group_id IS NULL`; R1E2E-09 Bab tile = sum of chaptered+ungrouped+approved (V2 §2.3; D9 row for V2 `!= 'menunggu'` draft leak); m28 kontrak `'approved'`; ops doc VACUUM ANALYZE + `migrate resolve --rolled-back`; api tsc 0, vue-tsc 0, eslint 0; card-ungrouped + overview + secondary-only-counts 44/44 (new Bab spec fails without fix); m28 kontrak 42/42 |
| T07 | CHANGES-REQUESTED → **READY-FOR-REVIEW** @ b0421c6b (BASE-6) | A4 | openapi check 0; shared `stimulus-table.ts` in views/mapping/bridge; stimulus-less groups always emitted (placeholder until A3 makes `BijakBuilderGroupSchema.stimulus` optional, then A4 flips ports.ts); stimulus-display + qb-stimuli 12/12; exam-builder + bridge 435/435; contract 1417/1417; tsc 0; eslint 0 |
| T08 | READY-FOR-REVIEW @ 7a3f754c (T07 + BASE-6) | A4 | secondary-guard 7/7; builder + bridge + pool-source 448/448; pupil-pool guard → B3 |
| T25 | READY-FOR-REVIEW @ e14f4f91 (T08 merged; migration 0101) | A4 | essay-choice 25/25; 442/442; lint:migration pass; input + migration → B3 |
| H-A7 | READY-FOR-REVIEW @ d7424ace (T25 merged) | A4 | 11/11; contract 1417/1417 |
| T29 | CHANGES-REQUESTED (live ?? latest) | A4 | + parity fixtures |
| T30 | CHANGES-REQUESTED (overview scale; attention = lane rows) | A4 | |
| T34 / H-A9 | not yet reviewed | A3 | merge BASE-6; + full-review builder findings (`builder.service` early return MAJOR, minors) |
| T05 Minors | Approve (merged BASE-5) | A3 | **READY-FOR-REVIEW** r1/t05-minors @ 99dd5fef (off BASE-6): pool ≤ 50, duplicate removed, BM 50 / MATH 54 / SCI 50 asserted on every surface, login 493; 15/15; tsc 0; eslint 0; test-only |
| H-A14 integration preview | — | A1 | **stopped** (B is merging; preview branch left untouched) |

## Team B E2E + security findings routed to team A (cycle 7)

| ID | Sev | Lane | Action |
|---|---|---|---|
| R1E2E-01 | Critical | A2 | **READY-FOR-REVIEW** r1/e2e01-intake-subject @ dbf524de (BASE-6): `curriculumCodeOf` in curriculum-facts (TagResolver.subject + taxonomy), duplicate-detector bank(), extraction ensureSourcePaper (same bug: MAT batch had subject_id NULL); subject-code.spec 13/13 (9 fail without fix); intake-workflow 101/101; api tsc 0; eslint 0. **Lead re-run: BASE-6 ancestor ✓; test/intake-workflow 15 files 101/101.** Input → B3 |
| R1E2E-05 | Critical | A4 | **READY-FOR-REVIEW** r1/e2e05-stem-image @ 00cec26f: stem image already served on BASE-6 (b08 fixed it; 201, pupil reads PNG, anon 401); FIX for own picture of kind diagram/map/graph/infographic (was 403); stem-image.spec 6/6; bridge + attempts + image-access 323/323. Files → B3. Follow-up **R1E2E-05b READY-FOR-REVIEW** `r1/e2e05b-own-stimuli` @ fcf08660 (BASE-6 + T07; merge T07 → 05b): own stimuli served inline (7 kinds, link order, caption/source/table, picture tokens), new optional `stimuli[]` on BijakAttemptQuestionSchema, refusal `stimulus_shared_ungrouped` (D90), `stem_images_many` removed; intake readers → stimulusTableOf; stem-image 10/10, bridge/attempts/image-access/integration/kuiz/papers 494/494, intake/files/dashboard 286/286, contract + exam-core 1626/1626; tsc 0; eslint 0; files → B3 |
| R1E2E-06 | High | A3 | READY in T34 @ e363fe51 |
| R1E2E-07 | Medium | A3 | READY in T34 @ e363fe51 (overridable with reason + audit per AC-R1-16.2) |
| R1E2E-08 | High | A2 | CLOSED by T04 (BASE-4): approved = servable |
| R1E2E-09 | Low | A2 | READY in r1/t04-minors @ ad5867dc |
| B3 bulk-approve gap | Medium | A2 | bulk approve runs the full approve gate (+ DSKP) → in T33 |

AC decisions (lead, from H-A17): R1-16.2 Terbit needs Disahkan, overridable only by the audited override (PIPE AC-07.5), handled in T34; R1-13.2 / AC-11.12 / AC-12.1 Databank + Latih Tubi images/groups deferred to R2 (D87 U2, D92); R1-10.4 keep `past_year` code (naming D9 row); R1-06.3 skip if no whole-marked Bahagian in R1 papers (OQ-2); R1-19.2 → Q4 answered: Darjah stays hidden from admin lists too (D96, supersedes AC-R1-19.2 / AC-02.7 / R1-21.5 "visible"); current code already does this.

Answer to B1 Q-B1-2: T01 removed the old `0092_part_options_image_file_index` folder (A1 verified: only 0092_bijak_standards and 0093_part_options_image_file_index exist). Q-B1-1 (UAT blueprints) → answered (Q3, D95 final): **no seed on UAT**; Admin Pusat creates and Sahkan blueprints in Kontrak (real flow): 3472/2 first, then 1449/1, 1249/1, 4531/1, Sains K1 when 2+ body evidence is ready. A3 writes the evidence list (T39), A1 the runbook step (T37).

## Answers to team C requests (C3 status, cycle 7)

1. `/questions/studio` routes + `questions/studio.ts` OpenAPI (asked of A4/T07): **not needed**. Per B2's recommendation and D93, the Studio uses the T32 API (`/api/stimuli`, `/api/stimulus-groups*`, @ 87a9a363). C3 drops its duplicate group API.
2. 7 stimulus kinds + caption/tableData/sourceCitation + public image token on question reads: T07 (7 kinds, A4 re-submitting) + T32 (token in question detail). Done on the A side.
3. "Edit di Studio" link in m04 QuestionDetailPage / list rows: the m04 lock ended when T04 merged (BASE-4). **C3 may edit those m04 files now.**
4. Builder reads only the first stimulus of a group: fixed by T07 (`stimuliOf`, 1–3) + T31 wire (A3, in progress).
5. T33 will add `cognitiveLevel` per leaf (contract) and the approve gate for SPM T4/T5 (cognitive level per leaf + Kertas). A2 will post the exact fields in its READY note.

Also noted: user decisions of 18:03 relayed by team B — B09b paper-review edits are in R1 (team A endpoints in T34, C1 UI); the "Tiada soalan" tile stays (deliberate difference from V2).

## Cycle 10 READY units (team A, 2026-10-31 14:50 UTC, all on BASE-19 823d8dfb unless noted)

| Unit | Branch @ head | Lane | Note |
|---|---|---|---|
| T33 | r1/t33-leaf-tags @ 95cea5be | A2 | PRIORITY (blocks T34); questions 759/759, workflow 264/264, intake 108/108; B2 + B3 |
| T36 | r1/t36-remove-poc @ 5bc34543 | A2 | after REQ-A-001 / REQ-B-003 |
| T42b | r1/t42b-intake-acs @ bca92f3d | A2 | AC-R1-14.3 fix: accepted figure gets its own question_image (pupils could not see it); files → B3 |
| T47 | r1/t47-bank-parity @ 20cc7ba3 (04cdb0ef + docs) | A2 | Studio filters + filter bulk (expectedCount, cap 500) + V2 illegal-move text; bulk input → B3 |
| T34 follow-up | r1/t34-builder-review @ 7bc3419e | A3 | `blockerDetails` + `canOverride` (REQ-C-002); merge after T33 in base |
| T44 | r1/t44-blueprint-fields @ 2d9c100d | A3 | contains H-A15 @ 7e5d637e |
| T48a | r1/t48a-paper-list @ e5041595 | A3 | paper list subject + search; title ≤ 200 |
| T31 | r1/t31-builder-wire @ b3501db9 | A3 | BLOCKED on C1 type change (REQ-A-008); merge with/after it |
| T29 | r1/t29-servability @ c53e655d | A4 | B2 MAJOR fixed (live ?? latest) |
| T30 | r1/t30-servability-reads @ 09d53c56 | A4 | B2 MAJORs fixed (Jana SQL count; card = lane rows) |
| t45-lanes | r1/t45-lanes @ 3de39c85 | A4 | R1-21.1/21.2 + V2 wording; R1-21.3/21.6 wait for T48 |
| T45 Part 1 | r1/t45-servability-acs @ 8eba44c0 | A4 | AC-04.3, 04.5, 05.3 (Terbitkan refused when unservable everywhere) |
| R1E2E-05b | r1/e2e05b-own-stimuli @ 57e7feee | A4 | use instead of 00cec26f; B3 |
| servability-own-stimuli | r1/servability-own-stimuli @ 11a4db3c | A4 | after T29 + 05b |
| H-A12 | r1/ha12-conformance @ e1fa7217 | A4 | shared setPocMarkBudgets; 406/406 |
| H-A21 | r1/ha21-overview-cache @ 7399b63c | A4 | after T30 → t45-lanes |
| T45b | r1/t45b-question-detail-acs @ 8342f9a0 | A2 | AC-04.4 placements on admin question detail; AC-16.3 fix (approve releases legacy image hold); BASE-21 |
| T49 | r1/t49-stimulus-lists @ ed3f585f | A2 | REQ-C-004/005 lists + members summary; B3 |
| T26 / T35 / H-A13 (minors) | r1/t26-e2e-seed @ d474227d / r1/t35-report-archive @ 4ea790b1 / r1/ha13-archived-paper @ 3979e212 | A1 (b) | B2 minors fixed; BASE-21 |
| T26b | r1/t26b-e2e-seed @ 7f62ede2 | A1 (b) | REQ-B-003: H-A15-safe e2e evidence; builder Sepadan proven; no honest structured K2 → fixme |
| b-requests-a4 | r1/b-requests-a4 @ 42396048 | A4 | REQ-B-013, REQ-B-014 b/c (inline SVG dropped) |
| T43 | r1/t43-chain-publish @ 8e04493f | A3 | spec-only; chain: Kontrak created + Disahkan over API, plain Terbit, T5 pupil, Jana T4/T5 distinct, negatives; merge after T31 |
| T48 | r1/t48-builder-parity @ 1b76778f | A3 | READY pending re-run; migration 0104; cover code, per-paper rule (overridable RULE_NOT_IN_CONTRACT), Tambah bahagian / Tambah soalan (V2 texts) / Padam soalan, `pinned`, R3 caption/body; B3 |
| H-A25 | r1/t37-r1-runbook @ ca2e0f93 + r1/ha24-release-input @ 9fd0d724 | A3 docs | 0102/0103/0104 SELECTs 63/63 on local pg16; REQ-C-016 scope doc fixed; 0105 when pushed |
| b-req-021 | r1/b-req-021 @ 07566831 | A4 | REQ-B-021 (a) topic label trim, (b) essay_choice choice-only = blank, (c) flat PUT guard (tiny edit in A2's questions.service); (d) closed by T31 |
| REQ-B-008 | r1/b-req-008 @ 883ddf27 | A4 | teachers read own uploads + own-authored question images only; pupil served only; admin unchanged; uniform 404; matrix spec; B3 (tightening) |
| servability-archived | r1/servability-archived @ f1fa3681 | A4 | simulasi_paper `archived`; dedicated `stimulus_shared_ungrouped` reason [PROPOSED] |
| b-requests-a1b | r1/b-requests-a1b @ f79675fc | A1 (b) | REQ-B-018, REQ-B-020, REQ-C-018; BASE-27 |
| T38 / T40 | r1/t38-selfmark-reward @ 662e602f / r1/t40-attempts-acs @ 90973d72 | A1 | |
| T41 | r1/t41-curriculum-acs @ 067ff3cc | A1 | DSKP loader BM reasons (code fix), load changes no served count, Darjah text; dskp-acs 3/3 |
| b-requests-a1 | r1/b-requests-a1 @ aa9f89dd | A1 | REQ-B-005/006/007/014a; B3 for 005/007 |
| T42 p1 / t04-minors / H-A16 | d1210e96 / ec179b12 / b283a746 | A2 | |

Merge order proposal for B: see REQ-A-007 (docs/qa/r1-e2e-readiness.md). Q5 decided (follow V2, rewards per attempt).

## B3 cycle 10 findings routed (team A)

| Finding | Lane | Action |
|---|---|---|
| T47-L1 blank filter approves whole bank | A2 | trim + empty check on approve, spec, on r1/t47-bank-parity |
| T33-L1 rights_status not copied | A2 | = REQ-B-017, in H-A18 |
| T32-M1 served lock ignores pinned | A2 | = REQ-B-012, r1/b-requests-a2 |
| T49-I1 SERVED_NOW text vs predicate | A2 | follow-up after REQ-B-012 |
| T34-L1 reference images any token/id | A3 | r1/t34-security-lows (or T48) |
| T34-L2 no_key/no_marks overridable | A3 | make HARD |
| T34-L3 reference title/items unbounded | A3 | bounds + spec |
| E05B-L1 own stimuli + T32-M1 | A4 | spec after REQ-B-012 |
| T35-L2 report Arkib not version-bound | A1 (b) | = REQ-B-018 |
| T35-L1 per-paper Kuiz archived | C2 | closes with T11 (B3) |

## Cycle 12 (2026-10-31 22:20 UTC, BASE-60 a3e92b06) — team A READY re-posts on BASE-60

| Unit | Branch @ head | Lane | Note |
|---|---|---|---|
| T26b (REQ-B-028) | r1/t26b-e2e-seed @ 5cfd6ea5 | A1 (b) | bank pool under e2e profile, X1 solved; unblocks B4 |
| REQ-C-012 | r1/req-c012-a2 @ ba57ecc52 | A2 | edit-as-draft; questions + workflow 840/840; B3 |
| T44 (+ H-A15) | r1/t44-blueprint-fields @ 77984abc | A3 | B2 MAJOR fixed (fixtures), reviewOf batching; 560 + 1 todo; unit 1666 |
| T52 | r1/t52-examiner-grid @ c8490879 | A1 | BASE refresh in progress |
| A3 docs (B2 fixes, BASE-60) | runbook r1/t37-r1-runbook @ dbf25cf2 · H-A24 @ bc2a0fc5 · H-A23 @ ef24addc · H-A22 @ 4fb2a41b · H-A17 @ b74f8e5f · H-A26 @ 7c7663de | A3 docs | rollback MAJOR fixed (no migrate resolve after dump restore, P3011/P3012), merge order defers to MERGE-LOG + C-POLICY-2, coverage 117 proven |
In progress: T34 (A3, B2 MAJORs + B3 lows, hard-code fix approved), T48, T31 (+ C1 REQ-A-008), REQ-B-031 (A1, D98), REQ-C-021 (A1, D98), REQ-B-029 (A2), REQ-B-033 (A4), H-A18 (A2, 0105).

## Priorities (team B via user, 2026-11-01 06:45 MYT)

1. **T34** — A3, all slots, ETA ~1 h (blocks C's T10 and B4).
2. **T36** — A2 slot 2 (with REQ-B-029, REQ-B-019/A-009), ETA ~1 h (blocks B4). REQ-B-003 delivered by T26b @ 5cfd6ea5.
3. **REQ-A-005 Lapor (Q8 / D98)** — backend guard REQ-B-031 by A1, ETA ~1.5 h; FE Lapor control = team C, unblocked by the decision.

### Cycle 13b (22:50 UTC)
- **H-A9** READY @ 1e80b005 (A3, r1/ha9-pipeline-chain, spec-only delta, BASE-60 merged): pipeline-chain 24 pass + 1 R2 todo; tsc 0; eslint 0. Needs B2.
- **T31** N+1 fix pushed @ 085c4945 (A3, r1/t31-builder-wire, BASE-62 merged); waits for T34.
- **T26c** NEW (A1, r1/t26c-e2e-k2): structured K2 pool plus a Terbit paper in the e2e seed only (local/E2E). Without it, removing PoC (T36) leaves no K2 paper for bijak-part-input and the REQ-B-003 e2e. No file overlap with T36. **B1: merge together with T36.**
- **Conformance baseline 407/409 on BASE-62**: questions-api "admin lifecycle" and "publish gate" fixtures lack cognitiveLevel (T33 gate). Fix → A2 slot 1.
- ETAs: T34 23:30–23:45 UTC (A3); T36 ~23:45 UTC (A2).
- **BASE vue-tsc fix READY** r1/fix-base-vuetsc @ 1a2a5ca6 (A4): 1-line test fix; tsconfig.node + contract tsconfig 1→0 errors; contract questions 95/95. **B1: merge first.**
- Merge order: T26b → T26c → T36 (no fixme left in base). Conformance fix = REQ-B-023 on r1/t33-conformance-fix (A2 slot 1).
- **Stale-branch round on BASE-60 (A1b)**: H-A13 @ 61b8851d (B2 + B3 Approve; only change is the BASE merge), T38 @ ff1e8a1b, T40 @ 1ef1341b, T50 @ 50dd05ab, T52 @ 31812d8c; tsc 0 on all five; openapi has no drift.
- **BASE REGRESSION**: `test/bijak-attempts` has 46 failures on BASE-60 (attempts, attempts-hardening, self-mark). ZodError: stimulus `image.url` > 300 at contract bijak/attempts/schema.ts:358. Suspect 23a4955a4 (r1e2e-05b). It passed 293/293 at BASE-21. The T38/T40/T50 self-mark/ac-r1/reveal-data failures have the same cause. **Fix → A1, r1/fix-attempt-image-url (bisect in progress).**

### Cycle 14 (23:00 UTC), BASE-63 = 1b028710 (vue-tsc fix merged)
- **T36 READY** r1/t36-remove-poc @ 64ebb379c (A2; BASE-62 merged; REQ-B-029 + B-019 + A-009). New idempotent seed step `exam-retire-poc` WITHDRAWS published all-PoC papers and never deletes; spec 3/3. render.yaml:27 removed; demo script nogo → read-only count of playable bank papers; ops note docs/ops/r1-b07-remove-poc.md. tsc 0; eslint 0. Results: seed 149 + 1 skip; bijak-papers 109/109; bijak-integration 102 + 1 todo; bridge 114/114; exam-builder 310/310; registry-boot 3/3. bijak-attempts 56 fail is identical to clean BASE-62 (→ r1/fix-attempt-image-url); conformance 407/409 is identical to BASE-62 (→ REQ-B-023). Security: none. **Depends on T26c** for bijak-part-input (structured K2) and admin-publish-http (approved bank K1 for 1449/1). B1: docs/ops/r1-release-notes.md:524 still says render.yaml sets true. Needs B2.
- **T42b READY** r1/t42b-intake-acs @ 5318a971a (A2; BASE-60): orphan Minor fixed (a refused accept removes its group, stimulus and figure); intake-workflow 125/125, intake-files 161/161, files 244/244, free-text-tag 6/6; tsc 0; eslint 0. **Security YES → B2 + B3.**
- REQ-B-010(a) lead decision: keep the existing "chapter kept only while it belongs" rule (silent drop when curriculumChapterId is not sent). Not broken under D9, so no new refusal.
- **T34 READY** r1/t34-builder-review @ 5bb590d0 (A3; BASE-63 merged). All B2 MAJOR 1/2 + B3 L1/L2/L3 + Minors fixed:
  - hard blockers: NO_KEY, NO_MARKS, MODE_NOT_ALLOWED, GROUP_BROKEN, NOT_SERVABLE (fails closed; was a 500)
  - overridable: only BLUEPRINT_NOT_VERIFIED + INELIGIBLE
  - existingImages: own or same-sheet files only (D9 row)
  - panel limits added
  - Evidence: api tsc 0; tsconfig.node 0; contract tsc 0; vue-tsc 0; eslint 0; contract 1452/1452; DB 655 pass + 1 todo; conformance 407/409 = BASE baseline.
  - **Needs B2 + B3 re-check.** Unblocks C's T10, A3's T48/T31 and T43b.
  - **Team C:** the blocker catalogue is now 18 codes, 2 overridable. C1/T10 should re-check its union.
- **T26c READY** r1/t26c-e2e-k2 @ df8a52a5b (A1; BASE-63 + T26b merged):
  - E2E-only structured K2 fixture: 15 approved multi-part Matematik Tambahan items, labelled `E2E-K2-*` / "E2E fixture". Each passes the real `GATES.approve`.
  - One Terbit paper on Disahkan 3472/2 (A 7 / B 4 / C 4), built through BuilderRepository. The re-publish route returns ok.
  - Profile e2e + E2E_SEED only; not in seedModules, so UAT and prod never run it.
  - T26b fixme → real tests in bijak-part-input.spec and e2e-profile-builder.spec.
  - Evidence: tsc 0; eslint 0; seed/e2e + e2e-profile-builder 14/14; seed guards + exam-builder + papers seed 355/355; registry-boot 3/3. Playwright not run (full stack needed; covered by the API integration spec).
  - Security: none (seed and tests only). Needs B2.
  - **B1 merge order: T26b → T26c → T36.** Expect a `test/bijak-integration/helpers.ts` conflict between T26b and T36 (both edit it; T26c does not). Re-run e2e-profile-builder after T36.
- **fix-attempt-image-url READY** r1/fix-attempt-image-url @ 8a48a7ac (A1b; off BASE-62, BASE-63 merge pending). The fix is test-only.
  - Root cause: since REQ-A-010 (Team C, 892eeae82 → BASE-50), the m28 mock registry gives diagrams `data:` URL pictures. `test/bijak-attempts/helpers.ts` serves that mock raw, so the contract's 300-char file-token cap (correct; production only emits `/api/files/<token>`) rejected it.
  - Fix: `servedStimulus()` drops `data:` pictures from the fixture and keeps the svg. No src or contract change.
  - Evidence: bijak-attempts 180/180 (was 56 fail); contract bijak 151/151; contract:check ok; tsc 0; eslint 0. Needs B2.
  - T38, T40 and T50 will go green once this merges.
  - **Process note for B2/C:** a change to the m28 mock registry must also run `apps/api/test/bijak-attempts`.
- REQ-B-026 moved from A1a to A1b, to run in parallel.
- **A2 slot 1 READY ×6** (all with BASE-62 merged; tsc 0; eslint 0):
  1. REQ-B-023 r1/t33-conformance-fix @ 94106d298 — **conformance 409/409**. Needs B2.
  2. H-A18 + REQ-B-017 + REQ-B-037 r1/ha18-gate-facts @ d3842c48c (docs line on 3a2ac810f) — **migration 0105**; 15 provenance columns carried to every new version; workflow 283/283, questions 570/570. Needs **B2 + B3**. **B1: merge H-A18 before T45b** and keep H-A18's `approveFields(record, version)` on conflict.
     - Lead decision: `hasSourceDeclaration` keeps counting created_by_id. An admin- or Guru-authored manual draft declares its author as its source; tightening it would block every manual draft at Semakan, which is not V2 behaviour.
  3. T45b r1/t45b-question-detail-acs @ cfe98740f — T45B-L1 fixed; contract 1451/1451. Needs B2.
  4. H-A16 r1/ha16-table-reader @ 085dec382 — pipe-body MAJOR fixed; 652 pass + 3 todo. Needs B2.
  5. REQ-B-025(a)(b) + REQ-C-019 r1/t49-served-now @ 2e6d06dfd — new GET /api/questions/filter-options (Admin Pusat). Needs **B2 + B3** (new input).
  6. R008-L1 r1/r008-l1 @ 4cd62e5bb — a non-admin may only reference stimuli it already carries ("Stimulus tidak sah."). Needs **B2 + B3**.

### Cycle 15 (23:20 UTC, BASE-63) — routing
- **H-A18 @ 3a2ac810: B2 CHANGES REQUESTED** → A2 slot 1. MAJOR intake marks 0 (declaredMarks/backfill); Minors: bulk review submit gate, import_issues carry. MAJOR migrated rights → **Q10 (user)**. REQ-C-012 merges after the fixed H-A18. B3 Pass.
- **T38 MAJOR / T38-L1** (best-N self-mark overpayment) → A1b after the image fix; then restack T40 (B2 Minors). REQ-B-026 after that.
- **REQ-B-031 @ 8e913fb5a: B3 Pass (REP-M1 HIGH closed).** REP-L1 (cap lock) → A1a. REP-L2 lead decision: "served" is enough proof (a broken question must be reportable); BM copy → "Anda hanya boleh melapor soalan yang dipaparkan kepada anda." [PROPOSED].
- **T34 @ 5bb590d0: B3 Pass** (L2, L3 closed). T34-L1-residual (blueprint reference imageFileId + path C decimal id) → A3 follow-up.
- B2 ready lists: T26b, T44, REQ-B-023, T42b, H-A13 + A3 docs; REQ-C-023 Approve.

### Cycle 16 (2026-11-01 13:35 UTC, BASE-100 = 2211c7f5) — resume after usage limit + container restart
- All A sessions are running again (A2, A3, A4 woken by Mandor). The A1 subagents were lost in the container restart and were re-spawned: **A1a** REQ-B-031 REP-L1/L2 → REQ-C-021 → REQ-C-016; **A1b** T38 MAJOR → T40 restack → T50/T52 refresh.
- In base since cycle 15: T26b, T26c, fix-attempt-image-url, REQ-B-026, T36 (team C version, BASE-99).
- T34/T36 now owned by team C (owner decision). A3: T48, T31, T43, T43b, T51 restack onto BASE-100.
- Q10 (migrated rights after an edit) is still open with the user; it blocks H-A18 MAJOR 2.
- Cycle 16 notes:
  - A2 is back (c-requests-a2 merged at BASE-92). It is implementing Q10 inside H-A18.
  - A3 is back, restacking T48/T31/T43/T43b/T51 on BASE-100 + T34-c. Its T34-L1-residual WIP is offered to C as REQ-A-013.
  - A1b: T50 flake MAJOR and T52 eslint BLOCKER + T36 import clash added to its queue.
  - H-A23: keep as historical. Add a one-line "superseded by MERGE-LOG / C-POLICY-2" header only.
- **REQ-B-041 READY** (A4): r1/t45-lanes @ 9a445240 (BASE-100) → r1/ha21-overview-cache @ 95ad2607. The mock overview now returns `cards` and `computedAt`, which fixes vue-tsc TS2741.
  - Evidence: vue-tsc app + node 0; api tsc 0; contract ok; eslint 0; m28 589/589; DB 37/37.
  - Merge order: t45-lanes → H-A21. Touches C2's hub mock file (FYI C2).
  - REQ-C-024 acknowledged (consistent with D90).
- H-A23 @ 9a86b5bb: header marks it superseded (docs only).
- H-A18 + D99 ETA ~15:15 UTC (A2).
- **BASE-101 = b24d8917**: T34 merged as team C's t34-builder-review-c @ 05451810. This unblocks T31, T48 and T43b (A3 is merging BASE-101 into each). AC coverage: 117 proven; AC-07.4 still partial until T43b.
- T38 T38-L1 fix pushed @ 6995d091 (A1b); the formal READY evidence follows from A1b.
- **REQ-B-031 READY** @ 9311fed0a (A1a, BASE-101): REP-L1 + REP-L2 fixed; reports 37/37; needs a B3 re-check. Lapor FE merges after it.
- **REQ-C-021 READY** @ 15cc2f64c (A1a, BASE-101): no chapter lock (D98). FE follow-up is REQ-A-014 (team C).
- REQ-C-016 DONE (already on base, BASE-76).
- T50 and T52 move to A1a. A1b keeps T38 + T40.
- **A2 READY ×2** (BASE-100):
  - r1/intake-reqs-a2 @ a2b7207a8: REQ-B-034 (unknown SP refused, BM field message) + REQ-B-035 (review-queue `group` badge, D90). contract 1432/1432; intake-workflow 131/131; tsc 0; eslint 0. B3 optional (B-034 is input validation).
  - REQ-B-044, r1/t04-minors @ d248166ea: spec expectation follows FD-11 (tile counts chaptered + ungrouped + approved); no code change. practice 330 + 1 skip; questions 895 + 3 todo; conformance practice 25/25.
- REQ-B-040: already in BASE-98. Nothing to do.
- **T43b READY** r1/t43b-publish-acs @ 9ef2bba6 (A3, BASE-101):
  - 3 new hard blockers: NO_QUESTIONS (V2 verbatim), ZERO_MARK_SECTION, TOTAL_MARKS_BELOW_ONE ([PROPOSED]). The catalogue is now 21 codes; 2 are overridable.
  - publish-acs.spec has 12 tests covering AC-07.4/07.6/07.7/07.9.
  - Evidence: 815 pass + 1 todo; unit 1670/1670; all tsc 0; vue-tsc 0; **conformance fully green on BASE-101**.
  - D9: Terbit never auto-approves (lead accepted).
  - Needs B2. **Team C:** re-check the blocker union (21 codes).
- REQ-B-032 moved from A4 to A3 dev-2 (r1/reqb032-pinned-rule).
- **T38 READY** r1/t38-selfmark-reward @ e8af872f5 (A1b, BASE-101). Fixes the B2 MAJOR, which is the same issue as B3 T38-L1.
  - Payout is now computed once per attempt: `gain = min(score,max) − max(base best-N automatic score, highest paid level)`. Ledger key `attemptId:score:<level>`, advisory lock per attempt.
  - Specs cover: choose-N paid once; a displacement pays only the delta; replay and concurrency pay nothing; clamp; Mod Pelajar.
  - Evidence: bijak-attempts + integration 300 pass + 1 todo; tsc 0; eslint 0.
  - V2 reference: BIJAK-SPM-cloud §4.5. Needs **B2 + B3** (wallet).
- **T40 READY** r1/t40-attempts-acs @ 985e2af0b (T38 + BASE-101). B2 Minors fixed (R1-06.2 renamed, choose-N case added), plus the T36 import in cuba-lagi-rewards. 308 pass + 1 todo; tsc 0. Needs B2. Merge after T38.
- T50 flake fix @ e436e084d (A1b). A1a is merging BASE-101 and doing T52.
- REQ-B-025(c) and the E05B-L1 spec move from A4 to A1b (no file overlap).
- **T52 READY** r1/t52-examiner-grid @ addae6444 (A1a, BASE-101).
  - Fixes: eslint BLOCKER fixed; T36 import clash fixed.
  - Evidence: tsc 0; eslint 0; papers + bridge 232/232; attempts + integration 289 + 1 todo; contract papers 26/26.
  - Needs B2. C1's REQ-A-012 merges after it.
- **T50 READY** @ e436e084d (contains BASE-101): flake fixed, 4 consecutive green runs; tsc 0; eslint 0. Needs B2.
- **REQ-C-021** full practice + curriculum recount: 571 pass + 1 opt-in skip.
- A1a next: `r1/a1-ac-proofs`, backend proof specs for unproven R1 ACs (117/176 proven). Gaps are reported, never marked it.fails.
- **T54 READY** r1/t54-perf-400k @ f90a63bd (A4; docs only, BASE-101). 408k questions bank.
  - p95 over 1 s, and who fixes it:

    | # | Path | Time | Owner / fix |
    |---|---|---|---|
    | 1 | overview cold | 33.6 s | A4 REQ-B-022(a) on r1/req-b-022a |
    | 2 | builder Cari soalan | 12–14 s | A3, after T48 |
    | 3 | admin list text search | 1.6–1.8 s | A2, **migration 0106** pg_trgm GIN, approved by lead; 1.8 s → 21 ms |
    | 4 | admin list counts | ~0.85 s each | A2 |

  - **BUG (A2):** the kertas filter regex `\s` is lost inside a Prisma.sql template.
  - **Migration ranges:** team A 0105 (H-A18), 0106 (admin-list-perf).
  - **B1/devops:** pg_trgm must be available on the target DB.
- A2 ETAs (UTC): t49 fixes ~14:45 · H-A18 (D99) ~15:15 · C-012 ~15:45 · admin-list-perf (0106) ~16:30. A3: r1/builder-search-perf right after T48 READY.
- **t49-served-now READY** r1/t49-served-now @ 221c2b287 (A2, BASE-101): REQ-B-025(a)(b) + REQ-C-019 B2 fixes. MAJOR fixed (smoke ALLOWED_ROLE filter-options → admin); conformance 409/409. Negeri filter is now trim + case-insensitive. joinable wording updated. Evidence: questions 899 + 3 todo; workflow 267/267; tsc 0; eslint 0. Needs a B2 re-check and B3 (new input).
- **T48 READY** r1/t48-builder-parity @ 4a3ff264 (A3; BASE-101 + T34-c; migration 0104).
  - Catalogue is now 21 codes (T34's 18 + RULE_NOT_IN_CONTRACT, SECTION_NOT_IN_CONTRACT (both overridable) + RULE_N_EXCEEDS_QUESTIONS (hard)). Overridable: 4.
  - All B2 items are in this head, including REQ-C-017 `pinned` on pool unit questions.
  - Evidence: all tsc 0; vue-tsc 0; contract 1460/1460; DB 514 + 1 todo; conformance 409/409.
  - Needs **B2 + B3**.
  - **Merge order: T48 → T43b.** T43b is merging T48 now to reach a 24-code catalogue. **Team C:** re-check the union after T43b.
- A1a: T45 Part 3 builder AC specs (R1-21.3 / R1-21.6) on r1/t45-builder-acs off T48, handed over from A4.

### Cycle 17 (2026-11-01 14:20 UTC, BASE-102 = d42351f7: REQ-C-021 merged)
- **REQ-B-031 @ 9311fed0a: B2 CHANGES REQUESTED (REQ-B-046)**: a pupil's first Lapor on a structured question is 422, plus the cap/re-POST Minor, stale copy, and B3 REP-N1/N2 → **A1a top priority** (T45 Part 3 paused). Lapor FE stays held.
- B2 Approve with Minors, each blocked only on the BASE merge:
  - intake-reqs a2b7207a8 and T04-minors d248166ea → A2 merges BASE-102, plus the Minors.
  - T45 9a445240 → H-A21 95ad2607 → A4 merges BASE-102.
- Not yet reviewed by B: T38, T40, T43b, T48, T52, T50, t49-served-now, T54, H-A18 (pending).
- C items from B: REQ-B-047 (C2 hub rebuild on H-A21), REQ-B-048 (C3 m03 mock test red since BASE-98).
- AC coverage 120/176 (A3 @ f1cf02eb). A2 ETAs: intake-reqs + T04-minors tips ~15:15 UTC; admin-list-perf ~17:00 UTC.
- **REQ-B-025(c) READY** r1/req-b-025c @ a2865119f (A1b, BASE-101).
  - A choice-only essay_choice is no longer counted as attempted in best-N, and its self-mark gives "kosong".
  - The spec was red before the fix.
  - Evidence: bijak-attempts + integration 292 + 1 todo; tsc 0; eslint 0.
  - Needs B2. It touches lines in attempts.service.ts different from T38's.
- **E05B-L1 spec READY** r1/e05b-l1-spec @ baa42a152 (A1b): editing a pinned own stimulus while it is served is refused with 409, and the pupil still sees the original text. 11/11 pass; tsc 0. No finding. Needs B2 + B3 to close E05B-L1.
- T45 Part 3 moved to A1b. A1a stays on REQ-B-046.
- **REQ-B-031 / REQ-B-046 READY** r1/reqb031-report-guard @ 9cd9a1eda (A1a, BASE-102):
  - The MAJOR is fixed: a structured question can be reported before its first submit (live = served proof, capped).
  - Re-POST at the cap returns 201. Copy fixed.
  - REP-N1: a pupil gets one uniform 422 until the proof passes. REP-N2: at most 8 reasons.
  - Evidence: reports 39/39; contract 1455; tsc 0; eslint 0; contract:check ok.
  - **Needs B2 + B3 re-check.** Lapor FE follows; FE strings sent to C as REQ-A-015.
- A1a next: r1/reqc021-followup (B2 Minors on C-021). A1b: T45 Part 3 from the WIP @ 078204e1c.
- **T31 READY** r1/t31-builder-wire @ 6a27c8dd (A3, BASE-102).
  - Evidence: tsc 0 (all three); contract 1456/1456; DB 1818 + 4 todo; conformance 409/409.
  - **vue-tsc 1 error** (http-admin.ts:198 BuilderGroup.stimulus). C1's REQ-A-008 closes it, but REQ-A-008 @ 7e2e4392 conflicts with BASE-101/102 (PaperEditorPage.vue + deviations doc). **C1 must rebase REQ-A-008 onto BASE-102**; B1 merges T31 together with REQ-A-008.
- **T43 READY** r1/t43-chain-publish @ 5ce5894f (on T31; spec-only; chain questions are non-KBAT for the Kontrak KBAT quota). 932 pass + 2 todo; tsc 0. Merge order: T31 + REQ-A-008 → T43. A3 dev-1 next: T51.
- **A4 READY ×5.** Merge order: t45-lanes → H-A21 → 022a-a4 → c-020 → b-033 (A4 is stacking them on BASE-102; final heads follow).
  - REQ-B-041 re-post: t45-lanes @ e7e5d3dd, H-A21 @ 669b0caf (BASE-102 + B2 Minor). vue-tsc 0; m28 589/589; DB 59/59.
  - T45 Part 1: r1/t45-servability-acs @ a0f11f68 (BASE-102 merge in progress). B2 MAJOR + B3 T45-L1 fixed. Shared `assertServableSomewhere` is called from questions.service.ts setStatus and createFrom. **This overlaps A2's H-A18 file; A2 has been told the exact lines.** 305/305. Needs B3.
  - REQ-B-022(a) @ 448366da: cold overview 34 s → 14.5 s. New env SERVABILITY_OVERVIEW_WARM. Needs B3 + DevOps.
  - REQ-C-020 @ 1a6e2610: lane `subjects`. 65/65.
  - REQ-B-033 @ 572490e9: new reason `question_missing`. **Seed finding:** 25 placements on the 5 published demo papers point at missing question ids → A1a investigates.
- FE follow-ups to C: REQ-A-016 (lane subjects, hub reads `cards`, `question_missing` label).
- **T45 Part 3 READY** r1/t45-builder-acs @ 69d16a7f9 (A1b, on T48 4a3ff264, specs only): proves AC-R1-21.3 + AC-R1-21.6. exam-builder 387/387; tsc 0; eslint 0. Needs B2. Merges after T48.
- The dangling-placements seed finding (REQ-B-033) goes to **A1b**, not A1a: r1/seed-dangling-placements.
- **BASE-102 RED (found by A1a):** `apps/api/test/questions/draw-bounded.spec.ts` "BR-16: a chapter holding one non-servable MCQ…" still expects the old 409 lock and fails with 201 since REQ-C-021 merged. **Fix READY** in r1/reqc021-followup @ 8210ac5bd (A1a, BASE-102), together with the B2 C-021 Minors (catalogue docs, comments, conformance check "no chapter is locked"). draw-bounded + topic-progress 40/40; tsc 0; eslint 0. A1a is running the whole questions/practice/curriculum/conformance suites for more lock assertions. **B1: merge early.**
- AC coverage 124/176 (120 base + 4 READY on T43b) (A3 @ 58c004bb). R1-21.3/21.6 are READY on r1/t45-builder-acs. T43b head 8841a31b (T48 merged, 24 codes); READY evidence pending.
- **A4 servability chain on BASE-102, final heads (no conflicts left).** Merge order:
  1. t45-lanes @ e7e5d3dd
  2. H-A21 @ 669b0caf
  3. req-b-022a-a4 @ e81f64d5 (r1/req-b-022a is fully superseded)
  4. req-c-020 @ e5e39d51
  5. req-b-033 @ f3da2b7d

  r1/t45-servability-acs @ 37d24013 merges at any time.
  - Evidence: api tsc 0; vue-tsc 0; DB 94/94; m28 589/589; t45 19/19.
- reqc021-followup @ 8210ac5bd confirmed as the only D98 red. Counts: questions 628 + 3 todo; practice 175; practice-reads 106 + 1 skip; curriculum 257; conformance 409/409.
- A1a next: **integration preview** (local only, not pushed). It stacks every team A READY head on BASE-102 in merge order and runs the full api suites, so conflicts and reds are found before B1.
- **Seed dangling placements (A1b)**: there is no seed bug. After a default/e2e seed, the 25 PoC-id placements are all on 4 **withdrawn** PoC papers (T36 exam-retire-poc runs in every profile). They are on published papers only in a test harness that seeds without the retire step. A new spec locks this in: r1/seed-dangling-placements @ 7285d961c, seed + bijak-papers 264 + 1 skip; tsc 0. Needs B2. A4 is asked to confirm its harness, and that the `question_missing` lane counts published papers only.
- A1b queue: empty after this (A1a is running the integration preview).

### Cycle 18 (2026-11-01 14:55 UTC, BASE-102 = d42351f7)
- REQ-B-051 fixed: history lines restored (cycle 14 = BASE-63 1b028710; BASE-101 b24d8917 = T34).
- **B2 cycle 16**:
  - **Ready for the B1 gate:** REQ-B-031 9cd9a1eda (Lapor FE after it); T45 e7e5d3dd → H-A21 669b0caf.
  - **Approve w/ Minors (need BASE-102 merged + tip posted):** T38 → T40 (A1b); T48 → T43b (A3); t49 (A2); T54 (A4); intake-reqs, T04-minors (A2).
  - **Routed:** REQ-B-049 → A1b (+ Q11 to user); REQ-B-050 regex = A2 admin-list-perf item 1.
- ETAs:
  - A2 intake-reqs/T04 tips + H-A18: ~15:15–15:30 UTC.
  - A2 t49 tip: ~15:50 UTC.
  - A3 T48 adds a new hard code SECTION_EMPTY for an empty admin Bahagian, then T43b re-merges it. **The catalogue will be 25 codes: 4 overridable, 21 hard.** Team C should re-check the union after T43b.
- **T54 tip** r1/t54-perf-400k @ bbf412c6 (A4, BASE-102): all B2 Minors fixed (sum reconciled, P11a/b, F3 labelled as EXPLAIN, F4 regex, harness refuses a non-local DB). Ready for the B1 gate.
- **REQ-B-031 / REQ-B-046 READY @ 9cd9a1eda (BASE-102)**: B2 Approve w/ Minors, B3 Pass w/ Lows. **Ready for the B1 gate.** Lapor FE (team C) merges right after it (REQ-A-015). REQ-B-049 follow-up is on its own branch r1/reqb049-report-visible; it does not block this merge.

### Head audit 2026-11-01 15:00 UTC (superseded)
This manual table has been removed because it went stale. **The only current source for team A heads and states is the auto table between the `AUDIT:BEGIN/END` markers at the end of this file.** It is regenerated from `git ls-remote` every cycle.

### Cycle 25 note: cross-team wire check (A1a, 19:20 UTC, local only)
BASE-105 + 11 team A READY API heads + C FE heads (reqa014 dc561730, reqa005 3ee17660, reqb041 41e0cb3b, reqa018-fe e6d96462, reqa020 371adfb2, reqa012 813ace12): **no wire mismatch that breaks the pupil or admin flow**. contract:emit no diff, contract:check ok, api tsc 0, vue-tsc 0, FE unit m28/m04 1212 + m05/m03/api 706 pass; conformance green except `GET /questions/filter-options` (t49, not mocked → A1a adds a notServed entry).
**Merge order for B1:** team A API heads first → `reqa012-examiner-grid` (stacked on T52) → `reqa018-paper-servability-fe` (contains the REQ-A-018 route) → other C FE branches.
**Conflicts B1 will see:** `questions.module.ts` (A4 chain `OverviewWarmer` × REQ-A-018 `QuestionPaperServabilityController`: keep both providers/controllers); `stimuli.repository.ts:112` (t49 deletes the `SERVED_NOW`/`VERSION_SERVED_NOW` constants B-032 added: take t49, no use remains); `v2-backend-deviations.md` (keep both sides); C docs in reqa012 (keep both).


### Cycle 29 note: wallet tiers (A2 investigation, 21:42 UTC)
Wallet tiers come only from the `reference` seed, never from a migration. Prod deploy runs `migrate deploy` only, so an operator must run `deploy.sh --seed-reference`. Without tiers, the dashboard and wallet return 500, and **every practice or Kuiz submit 500s and rolls back** (the reward runs inside the completion tx). Lead decision: (1) add a runbook precondition (`tiers` count = 4) and (3) make /api/ready return not-ready when tiers is empty (r1/ready-tiers-check). No migration. The reward is not made non-fatal, because silent coin loss is worse.

<!-- AUDIT:BEGIN -->
### Team A open branches: heads from origin (auto, 2026-11-01 22:50 UTC, BASE 7ea2208c)
This table is regenerated from `git ls-remote` every cycle and replaces every head mentioned earlier. Branches already in base are left out.
| Branch | Origin head | State |
|---|---|---|
| r1/a-integration-preview | 6e5ae945b | STALE/CLOSED (H-A14 stopped; superseded by A1a's local preview); do not merge |
| r1/a3-qa-doc-nits | e4d4dd322 | READY (A3, BASE-105, docs only): stale QA notes on T38 self-mark reward fixed (2 files); B2 |
| r1/a4chain-minors | 6f2fb7938 | READY (A1b, @6f2fb793 on 0ba236ef): symlink removed; janaSkipped guard first line of evaluate; T45 HTTP POST /questions/:id/status case with pinned BM reasons; 022a row real commits + proof spec; A3 dev-1 delta pre-review CLEAN (13 files 76 tests, mutations bite); merge after the A4 chain; B2 |
| r1/ac-gaps-a1b | f937caaca | READY (multi, @f937caac, CONTAINS ha17 + t37): coverage doc; runbook (§0 tiers, §2.3 migration rehearsal 0104–0107 by A4: apply/revert/re-apply clean, 408k timings, 0105 ACCESS EXCLUSIVE brief read stall, 0106 P3009 recovery procedure; §3.7 group SELECT; UAT SELECTs; env); B4 QA pack; copy-approval table (38 rows); merge after H-A18; B2 |
| r1/admin-list-perf | 2cd7889ae | READY (A4, @2cd7889a, BASE-105): REQ-B-050 + 0106 pg_trgm + 0107 kertas index; per-user @RateLimit GET /api/questions (THROTTLE_QUESTIONS_LIST_PER_MINUTE=60); docs: feature_flags 0108, drop_pool_tag 0109, optional B12 0122 / B20 0123 (lead-confirmed); B2 + B3 + DevOps (maintenance window, new env) |
| r1/admin-list-perf-wip | 9cc78c4db | SUPERSEDED by r1/admin-list-perf (A4); do not merge |
| r1/bridge-table-parts | c805ecc7c | READY (A4, BASE-105): the bridge uses stimulusTableParts (an invalid grid + pipe body shows the table only, as in builder/Studio); bridge 118/118, attempts 180/180, kuiz 39/39; B2. Follow-up after T31 + this merge: drop PENDING_BRIDGE_TEXT in the parity spec (A4) |
| r1/builder-search-perf | 1216b736c | READY (A3, on T48 6c5ae3a8; restack only): 413 pass; alone = trial merge with H-A18 fc409ae1, 0 failures, tsc 0; merge after T48; B2 |
| r1/chain-qa-bab-3a-a3 | 0efba36c4 | READY (A3, @0efba36c; contains chain-qa-selfmark + H-A18 + T38): Bab-refusal step 3a (bites); 642 pass; merge after H-A18 + chain-qa-selfmark; B2 |
| r1/chain-qa-selfmark-a3 | 5b93da43f | READY (A3, @5b93da43 = T38 13134ced + chain-qa 9b70ae39 + self-mark reward join, bites); merge after T38 + r1-chain-qa-a3; B2 |
| r1/d90-builder-sweep-a3 | 5200156be | READY (A3, @5200156b on T48 6c5ae3a8): D90 sweep spec + T48 D9 rows (6 cells, LEAD, dates fixed, label-move note); merge after T48 (+ t48-label-move-fix); B2 |
| r1/d90-kuiz-sweep-a3 | 1bf273ca6 | READY (A3, @1bf273ca, BASE-105): Kuiz/Simulasi D90 sweep spec (6 tests, 10 mutations red) + 3 D9 rows (Simulasi legacy groups KIV R2 + runbook SELECT; random Kuiz draws members independently, follows V2; shows every stimulus vs V2 first-only = fix); B2 |
| r1/delete-served-guard | fe7ef5378 | READY (A2, @fe7ef537; contains B-052 f3a2448f): only held papers block (served/pinned) + FK-restrict → 409 in_use; no in-practice block (regrade fallback proven); A4 Approve + B3 PASS (7e5d82e6) + Minors fixed (regrade, mixed bulk, all 4 RESTRICT tables, isForeignKeyViolation unit); questions 665, practice 175, security 185, r1 61; merge after t49 + d72 and H-A18 → B-032 → B-052; B2 + B3 |
| r1/docs-credential-scrub | b3db5e0d2 | READY (A1a, BASE-105; replaces 5cd46c4a): A4 Minors fixed: Demo1234 doc replacements reverted (allowed fictitious dev default; docs match code), DOC-02 wording, row relabelled privacy override, srs/M02 v1.34 revision row (v1.30 keeps placeholders, lead decision); 0 hits for the 3 old values repo-wide; M02 unit 724, eslint + vue-tsc 0; B3 + B2 |
| r1/drop-lock-enums | 4d1424c8b | READY (A1a + A2, @4d1424c8, BASE-105): contract drops dead CHAPTER_LOCKED + locked states; negative contract tests; row: no FE reader depends on them (dead local FE types = C follow-up); contract 1435/1435, emit no diff, check ok, api tsc 0; with C reqa014 merged: vue-tsc 0, m03/m05 659/659; merge after reqa014-no-chapter-lock-fe; B2 |
| r1/e05b-l1-spec | 4b9eac57a | READY (A1b, BASE-105): negative control added; 12/12; B2 + B3 |
| r1/ha17-ac-coverage | 157b371c3 | SUPERSEDED for B1: contained in r1/ac-gaps-a1b; head 157b371c |
| r1/ha18-gate-facts | fc409ae16 | READY (A2, BASE-105): H-A18 + REQ-B-017/037 + D99 + pre-review fixes (M2 held-issues helper on both edit paths; m1 gate-issue codes; deviation row); workflow 296/296; conformance 409/409; B2 + B3 |
| r1/ha23-e2e-readiness | 9a86b5bb6 | historical (superseded header), docs |
| r1/ha24-release-input | 5307df74b | READY (A3 docs, @5307df74): §3.5 B1 merge order + BM release notes (migration window aligned to A4 rehearsal) + sign-off checklist + r1-kiv-r2.md; ready-tiers-check marked ON HOLD (REQ-A-028); B1/B2 |
| r1/ha26-team-a-state | 686813a3c | READY (A3 docs, @686813a3): team-a-r1-state.md; vs ac-gaps take ha26 side; B2 |
| r1/ha8-stale-specs | 56b1b6cc6 | STALE (never merged; REQ-B-026 ported its fix, merged BASE-91); do not merge |
| r1/intake-reqs-a2 | 8c1964a6f | READY (A2, BASE-105): prefetch crash fixed (awaited Promise.all, failed read → 500, no unhandledRejection; red-first specs); row 908 6 cells; tsc/eslint 0, intake-workflow 137/137; A4 pre-review: Approve; B2 |
| r1/mock-known-mismatches | a279e68cd | READY (A3, BASE-105): REQ-A-019 base red fixed (7 routes notServed, stale m27 entry removed); conformance 2/2; B2 | A4 pre-review: Approve (nits) |
| r1/overview-getmany-parallel | 0ba236ef8 | READY (A4): chain 6th; 1334 pass at the tip (only the known base red); B2 |
| r1/overview-mcq-shape-once | 5a785be84 | READY (A4): chain 5th; B2 |
| r1/r1-10-1-practice-spec | 568f2e55c | READY (A1b + A2 + A3, @568f2e55, BASE-105; specs + docs): pins today's practice rewards (19 tests, 11/11 mutations); R1-10.1 row reworded from code (challenges every mode; achievements random/chapter/revision only); Q12 open; B2 |
| r1/r1-chain-qa-a3 | 9b70ae395 | READY (A3, @9b70ae39, BASE-105; spec + step map): A2 MAJOR fixed (key allow-list on the served pupil shape + recursive forbidden-key walk + reason text absent) + Minors (stimulus once exact, same-key replay, exact 12 syiling / 60 XP, Cuba Lagi 2 attempts); mutations red; ignore the unverified REQ ids in the commit message; B2 |
| r1/ready-tiers-check | 10eca4cdb | ON HOLD (A2, @10eca4cd): code correct, but A3 pre-review REQUEST CHANGES — B1 CI api.yml boot smoke curls /api/ready after migrate with no seed → red; M2 first-install deploy (deploy.sh then --seed-reference) ends as a false FAILED deploy. Needs B DevOps changes (REQ-A-028: CI reference-seed step; deploy first-install seed ordering) before merge; A2 fixes Minors (exact 503 body + logger spy; log once per state change) |
| r1/req-b-022a | 688529b77 | SUPERSEDED by r1/req-b-022a-a4; do not merge |
| r1/req-b-022a-a4 | d82c52567 | READY (A4): REQ-B-053 + pre-review rows (per-instance warm-up documented; env comment moved); chain 2nd; B2 + B3 + DevOps |
| r1/req-b-025c | d47353043 | READY (A1b, BASE-105): Minors fixed (decision row REQ-B-007/025c, lateSync, fixture names); attempts 183/183; B2 |
| r1/req-b-033 | b5e713fa4 | READY (A4): deviation row added; chain 4th; B2 |
| r1/req-c-020 | 8733a3785 | READY (A4): deviation row added; chain 3rd; B2 |
| r1/req-c012-a2 | dc3bfae88 | READY (A2, on H-A18 fc409ae1): M1 fixed (edit-as-draft keeps the import hold); 298/298; merges after H-A18; B3 re-check |
| r1/reqa018-paper-servability-route | cc42468ee | READY (A2, @cc42468e — final): admin papers only, cap 200 + meta, one batched read (spy-pinned), chunk 200, contract exports QuestionPaperServabilityMeta/Response; A4 Approve + B3 PASS; C reqa018-fe must re-merge + fix {data,meta} unwrap (REQ-A-026b); B2 + B3 |
| r1/reqb032-pinned-rule | a2cb5bb42 | READY (A2+A3, BASE-105): spec title + R1-limitation row (takedown vs running sitting, KIV R2); 6/6; B2 + B3 |
| r1/reqb049-report-visible | 9ece8d76d | READY (A1b, BASE-105): pre-review Minors fixed (type from the live version, spec titles, real level codes); 316/316; B2 + B3 | A2 B3 pre-scan: CLEAN (no IDOR/oracle, no echo, caps bite under mutation) |
| r1/reqb052-archived-edit | f3a2448f9 | READY (A3, BASE-105; replaces 17196431): follow-ups done: P1 pinned-clause spec (bites), guard published OR (withdrawn AND EXISTS attempts), header; archived-edit 6/6, pinned-version-rule 6/6, workflow 296/296; tsc/eslint 0; B2 |
| r1/reqc021-followup | 948aa327a | READY (A1a, BASE-105): fixes the base red draw-bounded BR-16; merge early |
| r1/seed-dangling-placements | 11cbcf458 | READY (A1b, BASE-105): asserts paper titles + counts = POC_BANK; seed 155 + 1 skip; B2 |
| r1/stimulus-list-d72 | b45ce5197 | READY (A2, @b45ce519; contains t49 b99068a6): one where for page+count; part-linked Darjah/PKSK hiding spec (bites); A4 + A3 pre-reviews Approve; merge AFTER t49; B2 |
| r1/t04-minors | 8ae70d6e8 | READY (A2, @8ae70d6e): FD-11/AP-17 row; card-ungrouped afterEach reset + per-test restore assertion (bites, order-independent); A4 + A3 pre-reviews Approve; B2 |
| r1/t31-builder-wire | eb0346d25 | READY (A3, hold LIFTED 19:55 UTC): merge as a PAIR with C REQ-A-008 r1/reqa008-group-stimulus @29d24be9 right after it (http-admin TS2322 gone, vue-tsc 0); Preview #3 (A4, 33 heads on BASE-105 @525f9ca1, local): ALL GREEN, vue-tsc 0 after REQ-A-008, 0 reds. Order: after T48; then REQ-A-008; B2 |
| r1/t34-l1-residual | e4bb72eb6 | SUPERSEDED: team C took REQ-A-013 on r1/t34-l1-residual-c; do not merge |
| r1/t34-l1-residual-a3 | e4bb72eb6 | SUPERSEDED: team C took REQ-A-013 on r1/t34-l1-residual-c; do not merge |
| r1/t37-r1-runbook | c9dcb5a08 | SUPERSEDED for B1: contained in r1/ac-gaps-a1b (823bb4a1); head c9dcb5a0 |
| r1/t38-selfmark-reward | 13134ced7 | READY (A1b, BASE-105): A3 pre-review CLEAN (concurrency + best-N sound; red proof); B2 delta + B3 |
| r1/t39-k1-evidence | 1a26f7a60 | check: A3 to confirm state |
| r1/t40-attempts-acs | 31a684ed4 | READY (A1a/A1b, @31a684ed): D9 row R1-02.1 (client-side cap, best N attempted by awarded marks, ties to lower position; V2 cited BIJAK-SPM-cloud.md:286-287/372-373) + two-pick spec that bites; A3 dev-1 delta pre-review CLEAN, 191 tests; B2 |
| r1/t43-chain-publish | 238eb6eb0 | READY (A3, hold LIFTED): spec-only on T31 eb0346d2; merge after T31 + REQ-A-008; Preview #3 (A4, 33 heads on BASE-105 @525f9ca1, local): ALL GREEN, vue-tsc 0 after REQ-A-008, 0 reds. B2 |
| r1/t43b-publish-acs | 7a14581a7 | READY (A3, on T48 6c5ae3a8): giveBab in publish-acs; 422 pass (was 12 red); alone = trial merge with H-A18 fc409ae1, 0 failures, tsc 0; merge after T48; B2 |
| r1/t45-builder-acs | ee3a7d2ba | READY (A1b, on T48 6c5ae3a8; specs only): builder-candidate-search giveBab; bab.ts via T48 merge (cmp = fc409ae1); exam-builder 391/391 alone = trial merge with H-A18; tsc/eslint 0; merge after T48; B2 |
| r1/t45-builder-acs-wip | 078204e1c | SUPERSEDED by r1/t45-builder-acs; do not merge |
| r1/t45-servability-acs | 954614c69 | READY (A4, BASE-105): pre-review M1/M2 + Minors fixed; trial merge with H-A18 22/22; chain 1st; B2 + B3 | A1b delta re-review 18:5x UTC: all 6 tips green alone, no Blocker/Major; 3 Minors (approval-check guard untested; perf deviation line; jana-null guard) → A4 follow-up, non-blocking |
| r1/t48-builder-parity | 6c5ae3a86 | READY (A3, BASE-105; migration 0104): giveBab fixture fix, support/bab.ts byte-identical to H-A18; exam-builder + pipeline-chain 409 pass (was 19 red); alone = trial merge with H-A18 fc409ae1, 0 failures, tsc 0; merge AFTER H-A18; B2 + B3 |
| r1/t48-label-move-fix | 9783849cf | READY (A3, @9783849c, leaf on T48 6c5ae3a8): PUT moving an added question across Bahagian keeps its Nombor soalan (4-line fix in update()); biting spec + same-section control; 410 alone = trial with H-A18; no D9 row (label belongs to the question, as in V2); merge right after T48; pre-review by A2; B2 | A2 delta pre-review: no findings (mutation red) |
| r1/t49-served-now | 8cb9fa5f1 | READY (A2 + A1a, @8cb9fa5f): blank-filter 422 + filter-options notServed entry in known-mismatches (route ships here); A4 pre-review Approve + B3 checklist Pass; merge BEFORE d72 (clean, A3 merge-tree); conformance proof on this head being re-run (A1a evidence lost in container restart); B2 + B3 |
| r1/t50-partial-acs | 075e1b587 | READY (A1a, BASE-105): A3 pre-review CLEAN (nits only); B2 |
| r1/t51-partial-acs-a3 | 61c1b077f | READY (A3, hold LIFTED; @61c1b077 on T43 238eb6eb + T31 eb0346d2 + T48): merge after T48, T31, REQ-A-008, T43; never old T31 6a27c8dd / T43 5ce5894f / T51 54f63116; Preview #3 (A4, 33 heads on BASE-105 @525f9ca1, local): ALL GREEN, vue-tsc 0 after REQ-A-008, 0 reds. B2 |
| r1/t52-examiner-grid | 5a0d7bd0e | READY (A1a/A1b, @5a0d7bd0): examinerGrid from marked (live+pinned), be09 test 8 bites; deviation note live-wins in withPinned; A2 + A3 dev-1 delta pre-reviews CLEAN; 124 tests; B2 (C REQ-A-012 reqa012 813ace12 stacks on it) |
| r1/t54-perf-400k | 03c76eb0d | READY (A4, docs): credentials replaced by placeholders; may 3-line-conflict with 022a perf docs (trivial); B2 |
<!-- AUDIT:END -->
- **Lapor:** REQ-B-031 @ 9cd9a1eda merged at BASE-105. Next for B1: **Lapor FE (team C) r1/reqa005-bijak-lapor @ d905ccac7** (contains 9cd9a1eda; REQ-A-015 DONE).
- T44: the tip 072d8f4b is only a BASE-63 merge on top of 77984abc (no non-merge commits outside base) → **MERGED BASE-67**. The audit script now skips such branches.
- **Evidence caveat (A3):** in worktree wt-a3-ha9, a node_modules symlink made conformance load the MAIN tree's @pp/contract openapi.json. So the conformance counts reported earlier for H-A15/T44, H-A9 and an older T43b head were measured against another tree's contract. T43b's final result is valid. H-A15/T44 and H-A9 are merged and passed the B1 gate. A3 dev-2 is re-running conformance on BASE-105 to confirm. Rule for every lane: use per-package symlinks in worktrees (A1a `mknm.sh`), and run `prisma generate` after a branch switch.
- **Worktree evidence caveat CLOSED (A3):** on a clean BASE-105 with per-package links, conformance + test/r1 give 442 pass + 1 todo, 0 fail (conformance 409/409; pipeline-chain H-A9 24 + 1 todo; blueprint-review-flag H-A15/T44 8/8). The earlier reds came from the symlink, not from the code.
- **Team A migration numbers used:** 0100, 0101, 0102 (T33), 0103 (in base), 0104 (T48), 0105 (H-A18), **0106 + 0107 (admin-list-perf, A4; 0107 approved by the lead 15:45 UTC)**. Free: 0108, 0109, 0120–0129. 0106 and 0107 need a **maintenance window**: each is a plain index build (Prisma runs one transaction per file) that blocks writes to question_versions, about 21 s in total at 408k. pg_trgm must be allowed on the server.
- **Integration preview (A1a, local, 22 team A heads stacked on BASE-102).**
  - Merge conflicts: 3, all trivial (t45-servability-acs module/service union; deviations doc rows ×2).
  - api tsc 0; contract:check ok; 14 folders run.
  - **3 reds, one cause: t45-servability-acs** (AC-05.3 approve gate vs specs that approve an unservable question: studio-edit-as-draft, builder-blockers R1E2E-06, builder-review). → A4 fixes the specs on its branch; the gate stays. **B1: HOLD t45-servability-acs until its new head.**
  - Everything else on the stack is green.
- A1 BASE-105 merges (A1a), all recorded in the auto table: t52 f2d36f64, t50 075e1b58, req-b-025c 37007e49, e05b f9eab2ab, seed 2bbd4f3c, reqc021-followup 948aa327.
- H-A18 (A2): fixes committed locally (D99 + MAJOR 1 + Minors); merging BASE now. New ETA ~16:30 UTC.

### Cycle 20 (2026-11-01 15:52 UTC, BASE-105 = 7ea2208c). No new merges and no new B verdicts since cycle 19.
- Lanes:
  - A1b: pre-review Minors on four branches.
  - A1a: idle; integration preview done.
  - A2 slot 1: H-A18 (ETA 16:30).
  - A2 slot 2: stimulus-list D72.
  - A3: REQ-B-052 fix + H-A27 docs.
  - A4: REQ-B-053 restack + migration header alignment.
- Team C has REQ-A-014 FE up: r1/reqa014-no-chapter-lock-fe @ dc561730.

### Cycle 21 (2026-11-01 16:25 UTC, BASE-105). No new merges since BASE-105.
- B4 reports E2E on BASE-102: "Not ready, no regression". REQ-B-054 (C1, T10 Terbit blocker reasons + override UI) is team C's.
- In flight:
  - A2 slot 1 H-A18 (late; head pending)
  - A3 REQ-B-052 stacked on REQ-B-032
- Idle: A1a, A1b, A4, A2 slot 2, A3 dev-1/dev-2. Everything team A has is READY and waits on B2/B3 review and the B1 gate.
- A4: **integration preview #2** (local; about 30 team A READY heads on BASE-105 in merge order; 17 api folders; reds bisected to their owners).
- **Internal pre-review (read-only; B2/B3 checklist; exact SHA against BASE-105).**
  - A1a: H-A18, C-012, REQ-B-032.
  - A1b: T48, T43b, builder-search-perf, admin-list-perf.
  - A2 slot 1: the A4 chain (T45 P1, 022a, c-020, b-033).
  - Each owner fixes its findings before B reviews. A changed head is recorded the same round.
- A2 fix ETAs (UTC): H-A18 ~17:45 → C-012 ~18:10 → B-032 ~18:25. After each, A3 re-merges H-A18 and B-032 into REQ-B-052.
- **Pre-review of the A3 builder chain (A2): 2 Majors.**
  - **T31 merges only together with team C's REQ-A-008** @ 77ffe84d. T31 alone fails vue-tsc.
  - T51 (and T48's builder-parity spec) gives 22 reds once merged with H-A18, from the bab gate. A3 is fixing the fixture.
  - Lead decision: the D93 min-2 rule is skipped for a group with no displayable stimulus, and that stays (the group is still one D90 unit; a deviation row will be added).
  - **For B1:** 19 baseline vue-tsc errors (implicit-any in m02/m03/m04/m07/m09/m28 pages) appear on BASE-105 in team A's env. Please check them on your setup.
- A2 slot 2 switched to fixing the 4 held units (order: intake-reqs crash → t49 bulk-blank → t04 wording → d72 merge/row). The A4 chain delta re-review is paused, to be reassigned when a lane is free. Slot 1 is on the REQ-B-052 re-review.
- **Trial merge (A1b, local; questions-module stack on BASE-105, in this order):** reqc021-followup → H-A18 fc409ae1 → C-012 dc3bfae8 → B-032 a2cb5bb4 → B-052 17196431 → T45 954614c6 → REQ-A-018 2f5a85e7.
  - Result: **all green**. One trivial deviations-doc conflict (keep both rows).
  - Evidence: api tsc 0; contract:check ok; questions 990 pass + 3 todo; questions-workflow 304/304; conformance 409/409. The BR-16 red is gone because reqc021-followup is included.
  - **Note for B1:** with this set, the migration order is 0103 → 0105; T48 brings 0104 later. `migrate deploy` applies pending migrations by name, so the gap is harmless.
- The A4-chain delta re-review is reassigned to A1b.
- **Integration preview #2 (A4, local; all 33 team A heads stacked on BASE-105).**
  - Migrations 0103–0107 appear once each, in order. tsc 0, contract ok, lint:migration ok.
  - 15 of 17 folders are green, including conformance 409/409 and questions-workflow 304/304.
  - **Reds, one root cause:** H-A18's bab submit gate meets fixtures that have no bab. The affected units are T48 builder-parity, T43b publish-acs and T51 pipeline-chain (A3 fixing) and t45-builder-acs (A1b after the T48 tip).
  - **vue-tsc TS2322:** enters with T31 → fixed by REQ-A-008 (C). They merge together.
  - **Logic merge:** stimulus-d72 × the c-020/t49 joinable `where`. A2 resolves it and adds a spec.
  - **For B1:** r1-runbook.md would carry the SERVABILITY_OVERVIEW_WARM rows twice (from 022a and from t37). Keep t37's (A3) and drop 022a's on merge.
- **A2 re-review of REQ-B-052 @17196431:** correct and green on its own. Minors (pinned-clause spec, perf guard, header) → A3 follow-up.
- **NEW MAJOR outside B-052 (found by A2):** a Guru `DELETE /api/guru/questions/:id` deletes a served or pinned question while a pupil is mid-attempt, and the attempt view then returns 500. Admin DELETE is also unguarded. → A2 slot 1, `r1/delete-served-guard`. It also aligns the served-lock predicate (withdrawn papers with sittings) and the setExplanation in-place rewrite. B2 + B3.
