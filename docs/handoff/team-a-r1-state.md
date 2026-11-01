# Team A R1 state: resume sheet

Date: 2026-11-01. Written off `feature/v3-bijak-r1` @ d42351f71 (BASE-102). Docs only. Sources: `docs/team/BOARD.md`, `MERGE-LOG.md`, `QUESTIONS.md` and `requests/` on `origin/team/r1-board`, `git ls-remote`, and `docs/TRACKER.md` on `r1/d91-decisions` (PR #404). Heads change often: re-run `git ls-remote origin 'refs/heads/r1/*'` before relying on one.

Task source: `docs/handoff/CLOUD-HANDOFF.md` section 7. R1 = Bijak SPM release.

## 1. Units

### 1.1 Merged into base (BASE-n)

| ID | Branch @ head | Merged as | Lane |
|---|---|---|---|
| T01 | `r1/t01-base-merge` @ 09d32822 | BASE-2 | A1 |
| T03 | `r1/b08-bridge` @ 7050f2d7 | BASE-3 | A2 |
| T04 | `r1/b01-lifecycle` @ 3cbc9092 | BASE-4 | A2 |
| T05 final | `r1/t05-db-specs` @ 37770b77 | BASE-5 | A3 |
| H-A11 | `r1/ha11-school-scope` @ 91432622 | BASE-7 | A2 |
| T27 | `r1/t27-darjah-refusal` @ 3cf53190 | BASE-8 | A1 |
| T07 | `r1/t07-model-gaps` @ b0421c6b | BASE-9 | A4 |
| T08 | `r1/t08-secondary-guard` @ 7a3f754c | BASE-10 | A4 |
| T28 | `r1/t28-bijak-rewards` @ 54c17c4d | BASE-11 | A1 |
| H-A2 | `r1/ha2-reports-darjah` @ 38d57846 | BASE-12 | A1 |
| R1E2E-01 | `r1/e2e01-intake-subject` @ dbf524de | BASE-13 | A2 |
| T32 | `r1/t32-stimulus-api` @ 87a9a363 | BASE-14 | A2 |
| T25 | `r1/t25-essay-choice-store` @ e14f4f91 | BASE-15 | A4 |
| H-A7 | `r1/ha7-essay-choice-flat-view` @ d7424ace | BASE-16 | A4 |
| T06 | `r1/t06-jana-standard` @ 4349bb00 | BASE-17 | A1 |
| T35 | `r1/t35-report-archive` @ 4ea790b1 | BASE-18 | A1 |
| T05 minors | `r1/t05-minors` @ 99dd5fef | BASE-19 | A3 |
| H-A12 | `r1/ha12-conformance` @ e1fa7217 | BASE-23 | A4 |
| T26 | `r1/t26-e2e-seed` @ d474227d | BASE-24 | A1 |
| T29 | `r1/t29-servability` @ c53e655d | BASE-26 | A4 |
| T33 | `r1/t33-leaf-tags` @ 95cea5be | BASE-27 | A2 |
| REQ-B-010/012/015 | `r1/b-requests-a2` @ 873641d4 | BASE-31 | A2 |
| T49 | `r1/t49-stimulus-lists` @ ed3f585f | BASE-32 | A2 |
| T47 | `r1/t47-bank-parity` @ b551c679 | BASE-33 | A2 |
| T48a | `r1/t48a-paper-list` @ e5041595 | BASE-34 | A3 dev-2 |
| REQ-B-018/020 + REQ-C-018 | `r1/b-requests-a1b` @ f79675fc | BASE-35 | A1 |
| REQ-B-021 | `r1/b-req-021` @ 07566831 | BASE-36 | A4 |
| REQ-B-008 | `r1/b-req-008` @ 27e24f08 | BASE-38 | A2 |
| REQ-B-005/006/007/014a | `r1/b-requests-a1` @ aa9f89dd | BASE-39 | A1 |
| T41 | `r1/t41-curriculum-acs` @ 067ff3cc | BASE-40 | A1 |
| T42 part 1 | `r1/t42-reports-intake-acs` @ d1210e96 | BASE-41 | A2 |
| T53 | `r1/t53-partial-acs-a4` @ 0fcae409 | BASE-42 | A4 |
| H-A17 | `r1/ha17-ac-coverage` @ 9738f8f5 | BASE-43 | A3 docs |
| H-A26 | `r1/ha26-team-a-state` @ aee473af | BASE-44 | A3 docs |
| REQ: BASE regression fix | `r1/fix-attempt-image-url` @ 68f70635 | BASE-64 (not yet in MERGE-LOG) | A1 |
| T26b | `r1/t26b-e2e-seed` @ 5cfd6ea5 | BASE-65 | A1 |
| T44 (+H-A15) | `r1/t44-blueprint-fields` @ 77984abc | BASE-67 | A3 dev-2 |
| T42b | `r1/t42b-intake-acs` @ 5318a971 | BASE-69 | A2 |
| H-A13 | `r1/ha13-archived-paper` @ 61b8851d | BASE-70 | A1 |
| servability-archived | `r1/servability-archived` @ 8de1b394 | BASE-72 | A4 |
| H-A17 | `r1/ha17-ac-coverage` @ b74f8e5f | BASE-77 | A3 docs |
| H-A26 | `r1/ha26-team-a-state` @ 696799a6 | BASE-78 | A3 docs |
| T26c | `r1/t26c-e2e-k2` @ df8a52a5 | BASE-80 | A1 |
| T45b | `r1/t45b-question-detail-acs` @ cfe98740 | BASE-81 | A2 |
| H-A16 | `r1/ha16-table-reader` @ 085dec38 | BASE-82 | A2 |
| R008-L1 | `r1/r008-l1` @ 4cd62e5b | BASE-83 | A2 |
| REQ-B-013/014b/c | `r1/b-requests-a4` @ de34ec27 | BASE-90 | A4 |
| REQ-B-026 | `r1/reqb026-spec-fixture` @ 03e4485d | BASE-91 | A1 |
| REQ-C-009/010/013 | `r1/c-requests-a2` @ 60e301d6 | BASE-92 | A2 |
| H-A9 | `r1/ha9-pipeline-chain` @ d3257e69 | BASE-93 | A3 |
| T34 | `r1/t34-builder-review-c` @ 05451810 | BASE-101 | team C (covering A3 on T34) |
| REQ-C-021 | `r1/reqc021-no-chapter-lock` @ 15cc2f64 | BASE-102 | A1 |
| T30 servability reads | `r1/t30-servability-reads` @ 409df4bf | BASE-28 (T30 tip, contains 05b and own-stimuli) | A4 |
| R1E2E-05 / 05b own stimuli | `r1/e2e05b-own-stimuli` @ 9895d004 | BASE-28 (T30 tip, contains 05b and own-stimuli) | A4 |
| servability-own-stimuli | `r1/servability-own-stimuli` @ eea90859 | BASE-28 (T30 tip, contains 05b and own-stimuli) | A4 |
| T36 remove PoC | `r1/t36-remove-poc` @ 64ebb379 | BASE-99 (as `r1/t36-remove-poc-c`, fixed by team C) | A2 |
| T34 builder review (+ structured blockers) | `r1/t34-builder-review` @ 5bb590d0 | BASE-101 (as `r1/t34-builder-review-c`) | A3 |

Other teams' units also in base: T24 (BASE-6), T14 (BASE-20), T15 (BASE-21), T13 (BASE-22), REQ-A-001 (BASE-25), H-C3 (BASE-29), H-C7 (BASE-30), H-C5 (BASE-37), R1-21 hub (BASE-45), REQ-B-030 (BASE-46), REQ-B-001/016 (BASE-47), REQ-B-002 (BASE-48), T11 (BASE-49), REQ-A-010 (BASE-50), H-C6 (BASE-51), REQ-B-011 (BASE-52), T13 follow-up (BASE-53), intake parity (BASE-54), T13b (BASE-55), REQ-B-027 (form part) (BASE-56), H-C5 follow-up (BASE-57), T12 (BASE-58), T13c (BASE-59), intake cognitive (BASE-61), H-C3 follow-up (BASE-62), BASE type-check fix (BASE-63), REQ-B-023 (BASE-66), Kontrak parity (BASE-68), H-C4 (BASE-71), T37/H-A25 runbook (BASE-73), H-A24 (BASE-74), H-A23 (BASE-75), H-A22 (+H-A19/H-A20) (BASE-76), REQ-C-023 (BASE-79), REQ-B-038 (BASE-84), REQ-B-039 (BASE-85), H-C8 (BASE-94), REQ-B-042 (BASE-95), REQ-B-045 (BASE-96), R1E2E-C1/C2 (BASE-97), REQ-B-040 (BASE-98), T36 (BASE-99), team C follow-ups (BASE-100).

### 1.2 READY, not merged (team B merges)

| ID | Branch @ head | Lane | Depends on | B state |
|---|---|---|---|---|
| Seed spec: no published seeded paper holds a dangling placement (25 PoC ones withdrawn) | `r1/seed-dangling-placements` @ 7285d961 | A (lane unconfirmed) | T36 (base) | READY (test-only); lane and review not seen (unconfirmed) |
| T45 part 3 builder specs (AC-R1-21.3 / 21.6 on the real bank) | `r1/t45-builder-acs` @ 69d16a7f | A1b | T48 (stacked on 4a3ff264; merges after T48) | READY (A1b, specs only, @ 69d16a7f); merges after T48; review not seen (unconfirmed) |
| REQ-C-021 follow-up: catalogue to D98, stale lock comments, conformance check | `r1/reqc021-followup` @ 8210ac5b | A1 | REQ-C-021 (BASE-102) | READY (A1); review not seen (unconfirmed) |
| E05B-L1 spec: archived pinned version keeps its own stimulus locked | `r1/e05b-l1-spec` @ baa42a15 | A4 | R1E2E-05b (base) | READY (A4, test-only); review not seen (unconfirmed) |
| REQ-B-022a overview cold path in parallel + cold before/after on the 408k bank (docs) | `r1/req-b-022a-a4` @ e81f64d5 | A4 | T30 (base) | READY (A4): overview counts in one Promise.all, routes stay Admin Pusat (REQ-B-022a/c); review not seen (unconfirmed) |
| REQ-C-020 lane pages carry subjects for the Subjek filter | `r1/req-c-020` @ e5e39d51 | A4 | T30 lanes (base) | READY (A4); review not seen (unconfirmed) |
| T45 part 3 WIP: AC-R1-21.3 / 21.6 builder specs on the real bank | `r1/t45-builder-acs-wip` @ 078204e1 | A4 | T48 (carries migration 0104) | WIP (A4); stacked on T48, so it carries migration 0104; superseded by `r1/t45-builder-acs` (A1b) |
| REQ-B-025c a choice-only essay_choice counts as blank (leaf kind passed to isBlank) | `r1/req-b-025c` @ a2865119 | A1b (handed over from A4) | none (REQ-B-025c) | READY (A1b, handed over from A4); review not seen (unconfirmed) |
| REQ-B-022a servability overview counts in one Promise.all | `r1/req-b-022a` @ 688529b7 | A4 | T30 (base) | READY (A4); review not seen (unconfirmed) |
| T54 performance report at ~406k questions (docs) | `r1/t54-perf-400k` @ f90a63bd | A4 | none (docs) | pushed (A4): docs/qa performance report, 11 paths p50/p95 and fixes for p95 over 1 s; review not seen (unconfirmed) |
| REQ-B-035 review queue rows carry the stimulus group (D90) | `r1/intake-reqs-a2` @ b70dc957 | A2 | none (REQ-B-035) | READY (A2); review not seen (unconfirmed) |
| T34-L1-residual (A3 WIP, for B3) | `r1/t34-l1-residual` @ e4bb72eb | A3 | T34 (B3 finding T34-L1-residual) | WIP, untested (A3): the answer to B3 finding T34-L1-residual; not for merge yet |
| REQ-B-031 report guard, no auto-deactivation, capped (D98) | `r1/reqb031-report-guard` @ 9cd9a1ed | A1 | none (D98); unblocks the Lapor FE | REQ-B-046 follow-up pushed (structured Lapor needs no proof, the cap skips a refresh, no existence/type oracle, at most 8 reasons, stale copy; openapi re-emitted) on top of REP-L1/L2; awaiting B2 re-review (A1) |
| REQ-C-019 joinable filter on group list and filter-options | `r1/t49-served-now` @ 221c2b28 | A2 | T49 (base) | smoke role for GET /questions/filter-options, trimmed Negeri match, joinable wording pushed (221c2b28); awaiting B1 gate and B2 (A2) |
| REQ-B-033 paper lane names a placed question the bank does not return | `r1/req-b-033` @ f3da2b7d | A4 | servability lanes (T30, in base) | READY (A4); review not seen (unconfirmed) |
| H-A21 overview cache | `r1/ha21-overview-cache` @ 669b0caf | A4 | T30 | same chain as T45 part 1 (A4) |
| T45 part 1 (AC-04.3/04.5/05.3) | `r1/t45-servability-acs` @ 37d24013 | A4 | T29 | fix pushed (T45-L1: approve-time servability check at the shared approve point; cognitiveLevel in the fresh spec); awaiting B2 re-review (A4) |
| T45 part 2 (lanes, V2 hub) | `r1/t45-lanes` @ e7e5d3dd | A4 | T30; R1-21.3/21.6 wait for T48 | same chain as T45 part 1 (A4) |
| H-A8 stale specs | `r1/ha8-stale-specs` @ 56b1b6cc | A2 | base | READY (test-only) |
| T04 minors (R1E2E-09) | `r1/t04-minors` @ d0740a32 | A2 | T04 | REQ-B-044 fix pushed (chapter-practice spec follows the Soalan by Chapter tile rule, D91 / FD-11); awaiting B1 gate and B2 (A2) |
| T38 self-mark reward (D94) | `r1/t38-selfmark-reward` @ e8af872f | A1 | T28 | fix pushed (6995d091: reward on the best-N gain, T38-L1) and base merged; awaiting B2 re-review (A1) |
| T40 attempts ACs | `r1/t40-attempts-acs` @ 985e2af0 | A1 | T38 | restacked on the T38 fix (midpoint spec renamed, choose-N self-mark reward case); awaiting B2 (A1) |
| T50 partial ACs | `r1/t50-partial-acs` @ e436e084 | A1 | none | B2 Changes requested (A1) |
| T31 builder wire | `r1/t31-builder-wire` @ 6a27c8dd | READY @ 6a27c8dd (lead, 2026-11-01; BASE-102 merged, virtual merge clean); waits for C1 to rebase REQ-A-008 on BASE-102 | T34; waits for C1 REQ-A-008 | restacked on BASE-102 (6a27c8dd is a base merge of the bf825128 checkpoint), checkpoint, not yet READY (bf825128: builder helper follows T36, poc-flag publishes under a Disahkan Kontrak, openapi re-emitted; evidence still running); REQ-A-008 (C1) follows it |
| T43 chain + publish ACs | `r1/t43-chain-publish` @ 5ce5894f | READY @ 5ce5894f (lead, 2026-11-01; on T31, Jana Kertas fixtures use a non-KBAT level); merges after T31 | T31 (contains T34) | real commits on the T31 chain (Jana Kertas fixtures use a non-KBAT level, base merges); T31 is a checkpoint, so T43 waits for T31 (A3) |
| T48 builder parity (0104) | `r1/t48-builder-parity` @ 4a3ff264 | A3 | T34; re-verify running | T34 is in base (BASE-101); head 4a3ff264 = fix 2cbe7d28 plus base merge and two spec follow-ups (blocker catalogue has 21 codes; the PoC double re-publish spec serves the seeded Kontrak); needs B2 re-review (migration 0104) |
| T43b publish ACs | `r1/t43b-publish-acs` @ 8841a31b | A3 dev-2 | T43 | publish-acs.spec pushed (AC-07.4 to AC-07.9, NO_QUESTIONS / ZERO_MARK_SECTION / TOTAL_MARKS_BELOW_ONE checks, carries T48); READY status not announced (unconfirmed) (A3) |
| T51 partial ACs (builder, Terbit, Kontrak, Jana) | `r1/t51-partial-acs-a3` @ 359fe16e | A3 dev-1 | T43 | pushed; not yet in the B queue |
| T52 examinerGrid (AC-20.3) | `r1/t52-examiner-grid` @ addae644 | A1 | none | B2 eslint BLOCKER `bijak-papers.test.ts:317` (A1); REQ-A-012 FE waits for it |

### 1.3 In progress, not pushed

| ID | Branch | Lane | Depends on |
|---|---|---|---|
| H-A18 gate facts (0105) | `r1/ha18-gate-facts` @ d3842c48 (pushed: move to 1.2 after review) | A2 | T33 |

### 1.4 Docs units (A3 docs agent), all READY

| Unit | Branch @ head | Output |
|---|---|---|
| T37 runbook | `r1/t37-r1-runbook` @ f4bb197c | `docs/ops/r1-runbook.md` (migrations 0092 to 0105, SELECTs run 74/74 on BASE-62) |
| T39 K1 evidence | `r1/t39-k1-evidence` @ 1a26f7a6 | `docs/ops/r1-k1-blueprint-evidence.md` |
| T46 / H-A17 AC coverage | `r1/ha17-ac-coverage` @ f73bc37a | `docs/qa/r1-backend-ac-coverage.md`, `r1-verify-first-notes.md` (kept current by H-A27) |
| H-A19 admin parity | `r1/ha19-admin-parity` @ c7315b0e | `docs/qa/r1-admin-parity-check.md` |
| H-A20 student parity | `r1/ha20-student-parity` @ 557e17c6 | `docs/qa/r1-student-parity-check.md` |
| H-A22 parity docs | `r1/ha22-parity-docs` @ 4fb2a41b | both parity docs refreshed, deviation rows H22-D1/D2 in `v2-bijak-spm.md`, `student.md` rows marked |
| H-A23 E2E readiness | `r1/ha23-e2e-readiness` @ 9a86b5bb | `docs/qa/r1-e2e-readiness.md` (merge order, minimal set) |
| H-A24 release input | `r1/ha24-release-input` @ f27ea3ab | `docs/ops/r1-release-input-team-a.md` (+ scope AC-R1-18.2 and 18.4 text) |
| H-A26 this sheet | `r1/ha26-team-a-state` @ this branch (head = tip of the branch) | `docs/handoff/team-a-r1-state.md` |

## 2. Decisions and answers

| D | Decision |
|---|---|
| D91 | Question counts are per surface: card = details = drawable (`group_id IS NULL` on practice cards); the login count includes grouped members. No seed is tuned to agree. |
| D92 | R1 backend calls: Databank, Latih Tubi SPM and Bab stay text-only MCQ in R1; servability starts as a service over existing predicates; keep the duplicate-Kontrak copy "Kontrak untuk subjek dan kertas ini sudah wujud. Cipta versi baharu."; dropping `spmPool` (planned 0107) is deferred to R2; team A overflow migrations 0120 to 0129. |
| D93 | Part 1: Studio makes a stimulus group first (draft group with 0 or 1 member, warning until 2); a group with fewer than 2 members cannot be placed ("Kumpulan perlu sekurang-kurangnya 2 soalan."). Part 2: Cuba Lagi earns rewards per attempt, as V2. |
| D94 | User: the proposed BM copy is approved as written; self-mark earns 2 Syiling + 10 XP per mark gained, positive delta only, once per part, capped at the part marks, no claw-back (built as T38). |
| D95 | User: UAT blueprints are created and verified by an Admin Pusat in Kontrak (Sahkan, two-body evidence); no seed on UAT. Order: 3472/2 first, then the 4 go-live K1 papers when evidence is ready. |
| D96 | User: Darjah (D1 to D6) questions stay hidden from admin lists too; supersedes AC-R1-19.2, PIPE AC-02.7 and R1-21.5. |
| D97 | User: every submitted Bijak attempt earns 2 Syiling + 10 XP per mark (no per-paper cap); Studio [PROPOSED] copy approved where it fits; Simulasi Kuiz "Semak" does not use BR-07 trial checks; per-paper Kuiz may show key and explanation during an open scored sitting; archived questions still leave the per-paper Kuiz. |

Earlier decisions still in force for R1: D72 (secondary only), D75/D76 (standard paper, Disahkan only, two-body evidence rule), D79 (V2 admin parity), D87 (R1 scope, U2 text-only practice family), D89 (admin picks the Bab), D90 (shared stimulus = one group).

| Q | User answer (QUESTIONS.md) |
|---|---|
| Q1 | Use the proposed BM copy as written (T15). |
| Q2 | Self-mark reward: follow V2 with a cap (D94, T38). |
| Q3 | UAT blueprints: admin creates and verifies in Kontrak, no seed (D95). |
| Q4 | Darjah hidden from admin lists too (D96). |
| Q5 | Rewards per attempt: follow V2 (D97). |
| Q6 | Studio [PROPOSED] copy: yes where the wording fits the screen state; team C flags any line that does not (REQ-C-014). |
| Q7 | Kuiz: follow V2 (REQ-C-015): "Semak" does not consume trial checks; per-paper Kuiz shows key and explanation (D97). |

## 3. Migrations

| No. | Folder | Owner unit | State |
|---|---|---|---|
| 0100 | `0100_question_lifecycle_approved` | T04 | merged BASE-4 (irreversible: restore the dump) |
| 0101 | `0101_essay_choice` | T25 | merged BASE-15 |
| 0102 | `0102_leaf_cognitive_level` | T33 (`r1/t33-leaf-tags` @ 95cea5be) | merged BASE-27 |
| 0103 | `0103_question_report_context` | T42 (`r1/t42-reports-intake-acs` @ d1210e96) | merged BASE-41; attempt FK stays NOT VALID |
| 0104 | `0104_paper_section_admin_created` | T48 (`r1/t48-builder-parity` @ 4a3ff264) | T34 is in base (BASE-101); head 4a3ff264 = fix 2cbe7d28 plus base merge and two spec follow-ups (blocker catalogue has 21 codes; the PoC double re-publish spec serves the seeded Kontrak); needs B2 re-review (migration 0104) |
| 0105 | gate facts (BE-09 duplicate, media, AI-editor facts) | H-A18 (A2) `r1/ha18-gate-facts` @ d3842c48 | B3 Pass, B2 pending; needs the Q10 user answer |

Ranges: team A 0100 to 0109 (overflow 0120 to 0129), team C 0110 to 0119, team B none. 0106 to 0109 free. SQL for 0092 to 0105 is in `docs/ops/r1-runbook.md`.

## 4. Open cross-team requests

Status as recorded in `requests/` (answers files take precedence). "Open for A" = work team A still owes (accepted, in progress or open).

| Direction | IDs |
|---|---|
| Open for A | REQ-B-017, REQ-B-019, REQ-B-022, REQ-B-025, REQ-B-029, REQ-B-031, REQ-B-032, REQ-B-033, REQ-B-034, REQ-B-035, REQ-B-037, REQ-B-040, REQ-B-043, REQ-B-044, REQ-B-046, REQ-B-049, REQ-B-050, REQ-B-051, REQ-C-012, REQ-C-019, REQ-C-020, REQ-C-021, REQ-C-024 |
| Delivered by A (waiting for merge or the other side) | REQ-B-003, REQ-B-004, REQ-B-007, REQ-B-013, REQ-B-014, REQ-B-041, REQ-C-016, REQ-C-017, REQ-C-018 |
| Open to B | REQ-A-007, REQ-A-009, REQ-A-011 |
| Open to C | REQ-A-004, REQ-A-013, REQ-A-014, REQ-A-015, REQ-A-016 |
| Delivered by B or C to A's request | REQ-A-001, REQ-A-002, REQ-A-003, REQ-A-005, REQ-A-006, REQ-A-008, REQ-A-010, REQ-A-012 |
| Closed (done, declined, withdrawn) | REQ-B-001, REQ-B-002, REQ-B-005, REQ-B-006, REQ-B-008, REQ-B-009, REQ-B-010, REQ-B-011, REQ-B-012, REQ-B-015, REQ-B-016, REQ-B-018, REQ-B-020, REQ-B-021, REQ-B-023, REQ-B-024, REQ-B-026, REQ-B-027, REQ-B-028, REQ-B-030, REQ-B-038, REQ-B-039, REQ-C-001, REQ-C-002, REQ-C-003, REQ-C-004, REQ-C-005, REQ-C-006, REQ-C-007, REQ-C-008, REQ-C-009, REQ-C-010, REQ-C-011, REQ-C-013, REQ-C-014, REQ-C-015, REQ-C-022, REQ-C-023 |
| Raised between B and C, not A | REQ-B-001, REQ-B-002, REQ-B-009, REQ-B-011, REQ-B-016, REQ-B-024, REQ-B-027, REQ-B-030, REQ-B-036, REQ-B-038, REQ-B-039, REQ-B-042, REQ-B-045, REQ-B-047, REQ-B-048, REQ-C-023 |

## 5. How to resume

- **Lanes.** A1 is the lead and also a lane; A2 to A4 are separate sessions. Each lane session runs Sonnet subagents (two dev slots in A1, A2, A3, A4, plus an A3 docs agent). A1 is the only writer of `BOARD.md` and `status/A1..A4.md`; lanes report to the lead.
- **Ownership.** A1: rewards, attempts, reports, seed, Jana (T06, T26, T28, T35, T38, T40, T41, T50, T52, H-A13). A2: questions lifecycle, stimuli, DSKP gate, reports context (T03, T04, T32, T33, T36, T42, T45b, T47, T49, H-A18). A3: builder, blueprints, docs (T05, T31, T34, T43, T44, T48, T51, H-A15, parity and runbook docs). A4: servability, bridge, essay_choice (T07, T08, T25, T29, T30, R1E2E-05b, H-A21).
- **Worktrees.** One git worktree per session or task under `/home/user/`. Each worktree needs its own dependencies (`npm ci`, or a link to an existing `node_modules`) and, for the API, `npx prisma generate` after every base merge and every migration change. The `@pp/*` aliases resolve through the workspace; a worktree without them fails type checks. Do not edit another session's worktree.
- **One vitest at a time.** Database suites and the long vitest runs go through the shared lock (`flock`, one run at a time per machine) so lanes do not fight over the test database and CPU. The lock path is in the lane brief, not in the repo (unconfirmed here). Never kill other sessions' processes; stop only what you started.
- **Base rule.** Before marking a branch READY, merge `origin/feature/v3-bijak-r1` into it with `--no-ff`, re-run the gates on the merge result and paste the evidence (branch + SHA, `tsc`, `eslint`, targeted tests, flags, V2 citation) into the status file. Never rebase a pushed branch. Only team B (B1) merges into `feature/v3-bijak-r1`; after each B1 merge there is a new `BASE-n` line in MERGE-LOG.md and every open branch merges it.
- **Team B's gate (B1 cycle 32).** B1's merge gate now also runs `tsc -p tsconfig.node.json` and the `packages/contract` tsc, in addition to the API tsc, `contract:check`, vue-tsc, eslint and the targeted tests. A branch should pass both before it is marked READY; BASE-63 (`r1/fix-base-vuetsc`) fixed a one-line failure of exactly this kind (found as TS2339 in the contract package since BASE-36).
- **Docs and secrets.** Docs in English, no real people's names, no secrets (env names only), local database passwords never in the repo. Commit messages end with the attribution lines given for the session. No AI session deploys or touches a server.
- **Board.** `team/r1-board` holds only the tracker; never merge it into code. Pull with rebase before pushing to it (each file has one writer).

## 6. Known hazards

| Hazard | What to do |
|---|---|
| **X1: T26 seed vs H-A15.** Resolved by order: T26b (admin-origin evidence in the e2e seed) merged first (BASE-65), then T44 with H-A15 (BASE-67). | Nothing open; keep the e2e seed on admin-origin evidence. |
| **T36 (REQ-A-009, REQ-B-029).** Merged as BASE-99 (`r1/t36-remove-poc-c`, team A T36 64ebb379 fixed by team C): `BIJAK_POC_QUESTIONS` is a no-op, `render.yaml:27` removed, demo redeploy check is a read-only count of playable bank papers. | Open Minors (team C log): no explicit guard for reserved PoC ids, stale PoC comments in `e2e-http.yml:90`, `frontend.yml:173`, `prisma/seed/poc/export/attempt-source.ts:8`. The demo database needs at least one published bank paper before the redeploy. |
| **T34 is in base (BASE-101); its stack is not.** T34 merged as `r1/t34-builder-review-c` @ 05451810 (team A T34 5bb590d0 fixed by team C, Disahkan gate kept, fixtures serve seeded blueprints). A3 WIP `r1/t34-l1-residual` @ e4bb72eb (untested) answers B3 T34-L1-residual. T31, T48 (0104) and T43 now need a base merge and a B2 pass; T10 and hc-builder-parity (team C) restack on BASE-101; REQ-A-008 follows T31. | Order: T31 / T48 / T43 each merge BASE-101 first (`questions.module.ts` and the deviations doc conflict as union). Do not push to `r1/t34-builder-review`. |
| **0103 attempt FK.** `fk_question_reports_attempt_id` is NOT VALID on purpose. | Never run `VALIDATE CONSTRAINT` in the release. |
| **Held: Lapor from Bijak Semakan (REQ-B-031, REP-M1 HIGH).** The FE branch is held by B until team A answers. | A1 + lead. |
| **Branch heads move.** Several READY heads changed after their last B verdict. | A head that moved after review is not merged until B reviews the delta. |
