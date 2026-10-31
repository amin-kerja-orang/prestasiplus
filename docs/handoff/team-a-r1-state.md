# Team A R1 state: resume sheet

Date: 2026-10-31. Written off `feature/v3-bijak-r1` @ 5d1e9dc6 (BASE-23). Docs only. Sources: `docs/team/BOARD.md`, `MERGE-LOG.md`, `QUESTIONS.md` and `requests/` on `origin/team/r1-board`, `git ls-remote`, and `docs/TRACKER.md` on `r1/d91-decisions` (PR #404). Heads change often: re-run `git ls-remote origin 'refs/heads/r1/*'` before relying on one.

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

Team C/B units also in base: T13 (BASE-22), T14 (BASE-20), T15 (BASE-21), T24 (BASE-6).

### 1.2 READY, not merged (team B merges)

| ID | Branch @ head | Lane | Depends on |
|---|---|---|---|
| T26 E2E seed | `r1/t26-e2e-seed` @ d474227d | A1 | none (hazard X1 with H-A15) |
| T29 servability | `r1/t29-servability` @ c53e655d | A4 | T03, T04 (in base) |
| T30 servability reads | `r1/t30-servability-reads` @ 09d53c56 | A4 | T29 |
| H-A21 overview cache | `r1/ha21-overview-cache` @ 7399b63c | A4 | T30 |
| T45 part 1 (AC-04.3/04.5/05.3) | `r1/t45-servability-acs` @ 8eba44c0 | A4 | T29 |
| T45 part 2 (lanes, V2 hub) | `r1/t45-lanes` @ 3de39c85 | A4 | T30; R1-21.3/21.6 wait for T48 |
| R1E2E-05 / 05b own stimuli | `r1/e2e05b-own-stimuli` @ 57e7feee | A4 | T07 (in base); contains e2e05-stem-image |
| servability-own-stimuli | `r1/servability-own-stimuli` @ 11a4db3c | A4 | T29, 05b |
| servability-archived | `r1/servability-archived` @ 046cc3be | A4 | T29, H-A13 |
| B-request fixes (REQ-B-013/014) | `r1/b-requests-a4` @ 42396048 | A4 | base |
| T33 leaf tags + approve gate (0102) | `r1/t33-leaf-tags` @ 95cea5be | A2 | T29, T32 (base) |
| T36 remove PoC | `r1/t36-remove-poc` @ 5bc34543 | A2 | REQ-A-001 (b1-e2e-off-poc, team B) merged first |
| T42 report paper (0103) | `r1/t42-reports-intake-acs` @ d1210e96 | A2 | T35 (base) |
| T42b figure crop | `r1/t42b-intake-acs` @ bca92f3d | A2 | base |
| T45b question detail papers | `r1/t45b-question-detail-acs` @ 8342f9a0 | A2 | T42 |
| T47 bank filters, filter bulk | `r1/t47-bank-parity` @ 20cc7ba3 | A2 | T33 |
| T49 stimulus lists | `r1/t49-stimulus-lists` @ ed3f585f | A2 | T32 (base) |
| H-A16 table reader | `r1/ha16-table-reader` @ b283a746 | A2 | T32, T07 |
| H-A8 stale specs | `r1/ha8-stale-specs` @ 56b1b6cc | A2 | base |
| T04 minors (R1E2E-09) | `r1/t04-minors` @ ec179b12 | A2 | T04 |
| T38 self-mark reward (D94) | `r1/t38-selfmark-reward` @ 662e602f | A1 | T28 |
| T40 attempts ACs | `r1/t40-attempts-acs` @ 90973d72 | A1 | T38 |
| T41 curriculum ACs | `r1/t41-curriculum-acs` @ 067ff3cc | A1 | T40 order only |
| T50 partial ACs | `r1/t50-partial-acs` @ 7254a8a2 | A1 | none |
| H-A13 archived paper | `r1/ha13-archived-paper` @ 3979e212 | A1 | T35 (base) |
| B-request fixes (REQ-B-005/006/007/014a) | `r1/b-requests-a1` @ aa9f89dd | A1 | base |
| B-request fix (REQ-B-018) | `r1/b-requests-a1b` @ 6584c726 | A1 | T35 (base) |
| T34 builder review (+ structured blockers) | `r1/t34-builder-review` @ 7bc3419e | A3 | T29; B2 order T29 -> T33 -> T34 |
| T31 builder wire | `r1/t31-builder-wire` @ b3501db9 | A3 | T34; waits for C1 REQ-A-008 |
| T43 chain + publish ACs | `r1/t43-chain-publish` @ 89d30dab | A3 dev-1 | T31 (contains T34) |
| T44 Kontrak fields (contains H-A15 7e5d637e) | `r1/t44-blueprint-fields` @ 2d9c100d | A3 dev-2 | none |
| H-A15 blueprint evidence | `r1/ha15-blueprint-evidence` @ 7e5d637e | A3 dev-2 | none (hazard X1) |
| T48a paper list filters, title <= 200 | `r1/t48a-paper-list` @ e5041595 | A3 dev-2 | none |
| T48 builder parity (0104) | `r1/t48-builder-parity` @ 1b76778f | A3 | T34; re-verify running |
| H-A9 pipeline chain (older) | `r1/ha9-pipeline-chain` @ 1024616c | A3 | superseded by T43 |

### 1.3 In progress, not pushed

| ID | Branch | Lane | Depends on |
|---|---|---|---|
| T43b publish ACs | `r1/t43b-publish-acs` (not on origin) | A3 dev-2 | T43 (local worktree only) |
| T51 partial ACs (builder, Terbit, Kontrak, Jana) | `r1/t51-partial-acs-a3` (not on origin) | A3 dev-1 | T43 |
| T52 examinerGrid (AC-20.3) | `r1/t52-examiner-grid` (not on origin) | A1 | none |
| H-A18 gate facts (0105) | `r1/ha18-gate-facts` (not on origin) | A2 | T33 |

### 1.4 Docs units (A3 docs agent), all READY

| Unit | Branch @ head | Output |
|---|---|---|
| T37 runbook | `r1/t37-r1-runbook` @ ca2e0f93 | `docs/ops/r1-runbook.md` (migrations 0092 to 0104, SELECTs run 63/63) |
| T39 K1 evidence | `r1/t39-k1-evidence` @ 1a26f7a6 | `docs/ops/r1-k1-blueprint-evidence.md` |
| T46 / H-A17 AC coverage | `r1/ha17-ac-coverage` @ bef6f413 | `docs/qa/r1-backend-ac-coverage.md`, `r1-verify-first-notes.md` (proven 113 of 176) |
| H-A19 admin parity | `r1/ha19-admin-parity` @ c7315b0e | `docs/qa/r1-admin-parity-check.md` |
| H-A20 student parity | `r1/ha20-student-parity` @ 557e17c6 | `docs/qa/r1-student-parity-check.md` |
| H-A22 parity docs | `r1/ha22-parity-docs` @ 9f915e1d | both parity docs refreshed, deviation rows H22-D1/D2 in `v2-bijak-spm.md`, `student.md` rows marked |
| H-A23 E2E readiness | `r1/ha23-e2e-readiness` @ 81389f25 | `docs/qa/r1-e2e-readiness.md` (merge order, minimal set) |
| H-A24 release input | `r1/ha24-release-input` @ 646a034d | `docs/ops/r1-release-input-team-a.md` (+ scope AC-R1-18.2 and 18.4 text) |
| H-A25 / H-A26 | this unit and the SQL re-run | runbook 63/63 recorded in the runbook and H-A24 |

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
| 0102 | `0102_leaf_cognitive_level` | T33 (`r1/t33-leaf-tags` @ 95cea5be) | READY |
| 0103 | `0103_question_report_context` | T42 (`r1/t42-reports-intake-acs` @ d1210e96) | READY; attempt FK stays NOT VALID |
| 0104 | `0104_paper_section_admin_created` | T48 (`r1/t48-builder-parity` @ 1b76778f) | READY |
| 0105 | gate facts (BE-09 duplicate, media, AI-editor facts) | H-A18 (A2) | not pushed; plan and number to the lead first |

Ranges: team A 0100 to 0109 (overflow 0120 to 0129), team C 0110 to 0119, team B none. 0106 to 0109 free. SQL for 0092 to 0104 is in `docs/ops/r1-runbook.md`.

## 4. Open cross-team requests

Status as recorded in `requests/`. "Open for A" means work team A still owes; "open to others" means team A waits.

| Direction | IDs |
|---|---|
| Open for A (accepted or in progress, not yet merged) | REQ-B-008 (files, in progress), REQ-B-010, REQ-B-012, REQ-B-015, REQ-B-017, REQ-B-018 (`b-requests-a1b`), REQ-B-019, REQ-B-020, REQ-B-021, REQ-C-009, REQ-C-010, REQ-C-012, REQ-C-013, REQ-C-016 (done on `r1/ha24-release-input`, not merged), REQ-C-017 (T48), REQ-C-018 |
| Delivered by A, waiting for merge or the other side | REQ-B-003, REQ-B-005/006/007 and REQ-B-014 (`b-requests-a1`, `b-requests-a4`), REQ-B-013, REQ-C-001/002 (T34), REQ-C-004/005 (T49), REQ-C-011 (T47), REQ-C-014, REQ-C-015 (decisions) |
| Open to B | REQ-A-007 (merge order, `docs/qa/r1-e2e-readiness.md`), REQ-A-009 (render.yaml:27 and the demo redeploy script after T36) |
| Open to C | REQ-A-004 (admin parity FE), REQ-A-005 (student parity FE, incl. the missing Lapor control), REQ-A-006 (Kontrak FE text), REQ-A-008 (T31 type change), REQ-A-010 (no inline SVG on the pupil wire) |
| Closed | REQ-A-001 (delivered on `r1/b1-e2e-off-poc`), REQ-A-002, REQ-A-003 (delivered by C), REQ-C-003, REQ-C-006/007 (declined, owner is C), REQ-C-008 (T48a) |
| Raised by B/C to C, not A | REQ-B-001, REQ-B-002, REQ-B-009, REQ-B-011, REQ-B-016 |

## 5. How to resume

- **Lanes.** A1 is the lead and also a lane; A2 to A4 are separate sessions. Each lane session runs Sonnet subagents (two dev slots in A1, A2, A3, A4, plus an A3 docs agent). A1 is the only writer of `BOARD.md` and `status/A1..A4.md`; lanes report to the lead.
- **Ownership.** A1: rewards, attempts, reports, seed, Jana (T06, T26, T28, T35, T38, T40, T41, T50, T52, H-A13). A2: questions lifecycle, stimuli, DSKP gate, reports context (T03, T04, T32, T33, T36, T42, T45b, T47, T49, H-A18). A3: builder, blueprints, docs (T05, T31, T34, T43, T44, T48, T51, H-A15, parity and runbook docs). A4: servability, bridge, essay_choice (T07, T08, T25, T29, T30, R1E2E-05b, H-A21).
- **Worktrees.** One git worktree per session or task under `/home/user/`. Each worktree needs its own dependencies (`npm ci`, or a link to an existing `node_modules`) and, for the API, `npx prisma generate` after every base merge and every migration change. The `@pp/*` aliases resolve through the workspace; a worktree without them fails type checks. Do not edit another session's worktree.
- **One vitest at a time.** Database suites and the long vitest runs go through the shared lock (`flock`, one run at a time per machine) so lanes do not fight over the test database and CPU. The lock path is in the lane brief, not in the repo (unconfirmed here). Never kill other sessions' processes; stop only what you started.
- **Base rule.** Before marking a branch READY, merge `origin/feature/v3-bijak-r1` into it with `--no-ff`, re-run the gates on the merge result and paste the evidence (branch + SHA, `tsc`, `eslint`, targeted tests, flags, V2 citation) into the status file. Never rebase a pushed branch. Only team B (B1) merges into `feature/v3-bijak-r1`; after each B1 merge there is a new `BASE-n` line in MERGE-LOG.md and every open branch merges it.
- **Docs and secrets.** Docs in English, no real people's names, no secrets (env names only), local database passwords never in the repo. Commit messages end with the attribution lines given for the session. No AI session deploys or touches a server.
- **Board.** `team/r1-board` holds only the tracker; never merge it into code. Pull with rebase before pushing to it (each file has one writer).

## 6. Known hazards

| Hazard | What to do |
|---|---|
| **X1: T26 seed vs H-A15.** After H-A15 real Sahkan refuses 3472/2 (`NO_EVIDENCE_BODIES`) while the e2e seed sets it Disahkan. | Lead decision open: seed carries labelled admin-origin evidence, or document the bypass. Merge T26 before H-A15. |
| **T36 vs deploy config (REQ-A-009).** `render.yaml:27` still sets `BIJAK_POC_QUESTIONS` true and `deploy/demo/redeploy-demo-migration-aware.sh:676-678` refuses unless it is true. | Team B changes both when T36 merges; `r1/b1-e2e-off-poc` (REQ-A-001) merges first. After T36 PoC papers are not playable (403 / 422 SHORTAGE). |
| **T31 waits for C1 (REQ-A-008).** The wire emits stimulus-less groups; the FE type `BuilderGroup.stimulus` must become optional. | Merge T31 with or after the C1 change. |
| **T34 waits for T33 in base.** B2's order is T29 -> T33 -> T34 -> T31; T34 and T33 conflict with later base merges in `questions.module.ts` and `lifecycle.service.ts`. | Owner merges the new BASE (union of providers) after each predecessor lands. |
| **T48 migration 0104.** Adds `paper_sections.admin_created`; T48 contains T34 but not T33 or T42. Re-verify is running. | Deploy 0104 with the T48 build; reverse SQL is in the file header. |
| **0103 attempt FK.** `fk_question_reports_attempt_id` is NOT VALID on purpose. | Never run `VALIDATE CONSTRAINT` in the release. |
| **Branch heads move.** Several READY heads changed after their last B verdict. | A head that moved after review is not merged until B reviews the delta. |
