# Team A R1 state: resume sheet

Date: 2026-11-01. Written off `feature/v3-bijak-r1` @ 21afed8eb (BASE-124). Docs only. Sources: `docs/team/BOARD.md`, `MERGE-LOG.md`, `QUESTIONS.md` and `requests/` on `origin/team/r1-board`, `git ls-remote`, and `docs/TRACKER.md` on `r1/d91-decisions` (PR #404). Heads change often: re-run `git ls-remote origin 'refs/heads/r1/*'` before relying on one.

Task source: `docs/handoff/CLOUD-HANDOFF.md` section 7. R1 = Bijak SPM release.

## 1. Units

### 1.1 Merged into base (BASE-n)

BASE-120 to BASE-124 are read from the merge subjects on `feature/v3-bijak-r1` (the MERGE-LOG on `team/r1-board` had no rows for them when this was written; its last row was BASE-119).

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
| T45 | `r1/t45-lanes` @ e7e5d3dd | BASE-103 | A4 |
| H-A21 | `r1/ha21-overview-cache` @ 669b0caf | BASE-104 | A4 |
| REQ-B-031 | `r1/reqb031-report-guard` @ 9cd9a1ed | BASE-105 | A1 |
| REQ-C-021 follow-up | `r1/reqc021-followup` @ 948aa327 | BASE-108 | A1a |
| REQ-B-032 | `r1/reqb032-pinned-rule` @ a2cb5bb4 | BASE-109 | A2 (slot 2; moved from A3, earlier from A4) |
| A4 chain | `r1/a4chain-minors` @ 6f2fb793 | BASE-110 | A1a |
| T54 | `r1/t54-perf-400k` @ 03c76eb0 | BASE-111 | A4 |
| T38 | `r1/t38-selfmark-reward` @ 13134ced | BASE-112 | A1 |
| T50 | `r1/t50-partial-acs` @ 075e1b58 | BASE-113 | A1 |
| REQ-B-025(c) | `r1/req-b-025c` @ d4735304 | BASE-114 | A1b |
| E05B-L1 | `r1/e05b-l1-spec` @ 4b9eac57 | BASE-115 | A1b |
| T40 | `r1/t40-attempts-acs` @ 31a684ed | BASE-116 | A1 |
| T52 | `r1/t52-examiner-grid` @ 5a0d7bd0 | BASE-117 | A1 |
| intake-reqs | `r1/intake-reqs-a2` @ 8c1964a6 | BASE-118 | A2 |
| T04 minors | `r1/t04-minors` @ 8ae70d6e | BASE-119 | A2 |
| mock-known-mismatches | `r1/mock-known-mismatches` @ a279e68c | BASE-120 | A3 |
| T49 | `r1/t49-served-now` @ 8cb9fa5f | BASE-121 | A2 |
| seed-dangling-placements | `r1/seed-dangling-placements` @ 11cbcf45 | BASE-122 | A1b |
| bridge-table-parts | `r1/bridge-table-parts` @ c805ecc7 | BASE-123 | A4 |
| docs-credential-scrub | `r1/docs-credential-scrub` @ b3db5e0d | BASE-124 | A1a |
| REQ-B-022a overview: parallel getMany reads | `r1/overview-getmany-parallel` @ 0ba236ef | BASE-110 (inside the A4 chain) (merged at 0ba236ef; live head 2809a87f only adds restacks) | A4 |
| REQ-B-022a overview: skip the Jana pool facts in the published-paper pass (cold 15.3 s to 9.3 s on 408k) | `r1/overview-mcq-shape-once` @ 5a785be8 | BASE-110 (inside the A4 chain) (merged at 5a785be8) | A4 |
| REQ-B-022a overview cold path in parallel + cold before/after on the 408k bank (docs) | `r1/req-b-022a-a4` @ d82c5256 | BASE-110 (inside the A4 chain) (merged at d82c5256) | A4 |
| REQ-C-020 lane pages carry subjects for the Subjek filter | `r1/req-c-020` @ 8733a378 | BASE-110 (inside the A4 chain) (merged at 8733a378) | A4 |
| REQ-B-033 paper lane names a placed question the bank does not return | `r1/req-b-033` @ b5e713fa | BASE-110 (inside the A4 chain) (merged at b5e713fa) | A4 |
| T45 part 1 (AC-04.3/04.5/05.3) | `r1/t45-servability-acs` @ 954614c6 | BASE-110 (inside the A4 chain) (merged at 954614c6) | A4 |
| T30 servability reads | `r1/t30-servability-reads` @ 409df4bf | BASE-28 (T30 tip, contains 05b and own-stimuli) | A4 |
| R1E2E-05 / 05b own stimuli | `r1/e2e05b-own-stimuli` @ 9895d004 | BASE-28 (T30 tip, contains 05b and own-stimuli) | A4 |
| servability-own-stimuli | `r1/servability-own-stimuli` @ eea90859 | BASE-28 (T30 tip, contains 05b and own-stimuli) | A4 |
| T36 remove PoC | `r1/t36-remove-poc` @ 64ebb379 | BASE-99 (as `r1/t36-remove-poc-c`, fixed by team C) | A2 |
| T34 builder review (+ structured blockers) | `r1/t34-builder-review` @ 5bb590d0 | BASE-101 (as `r1/t34-builder-review-c`) | A3 |

Other teams' units also in base: T24 (BASE-6), T14 (BASE-20), T15 (BASE-21), T13 (BASE-22), REQ-A-001 (BASE-25), H-C3 (BASE-29), H-C7 (BASE-30), H-C5 (BASE-37), R1-21 hub (BASE-45), REQ-B-030 (BASE-46), REQ-B-001/016 (BASE-47), REQ-B-002 (BASE-48), T11 (BASE-49), REQ-A-010 (BASE-50), H-C6 (BASE-51), REQ-B-011 (BASE-52), T13 follow-up (BASE-53), intake parity (BASE-54), T13b (BASE-55), REQ-B-027 (form part) (BASE-56), H-C5 follow-up (BASE-57), T12 (BASE-58), T13c (BASE-59), intake cognitive (BASE-61), H-C3 follow-up (BASE-62), BASE type-check fix (BASE-63), REQ-B-023 (BASE-66), Kontrak parity (BASE-68), H-C4 (BASE-71), T37/H-A25 runbook (BASE-73), H-A24 (BASE-74), H-A23 (BASE-75), H-A22 (+H-A19/H-A20) (BASE-76), REQ-C-023 (BASE-79), REQ-B-038 (BASE-84), REQ-B-039 (BASE-85), H-C8 (BASE-94), REQ-B-042 (BASE-95), REQ-B-045 (BASE-96), R1E2E-C1/C2 (BASE-97), REQ-B-040 (BASE-98), T36 (BASE-99), team C follow-ups (BASE-100), T10 (BASE-106), hc-builder-parity (BASE-107).

### 1.2 READY, not merged (team B merges)

| ID | Branch @ head | Lane | Depends on | B state |
|---|---|---|---|---|
| REQ-B-052: an archived question pinned on a published paper is rewritten in place by update and updateOwn (fix: branch to a new version instead of refusing) | `r1/reqb052-archived-edit` @ f3a2448f | A3 (T48 dev) | none (REQ-B-052) | READY (A3, BASE-105; replaces 17196431): P1 pinned-clause spec (bites), guard published OR (withdrawn AND EXISTS attempts), header; archived-edit 6/6, pinned-version-rule 6/6, workflow 296/296; tsc/eslint 0; B2; **contains the held H-A18 fc409ae1 and may need A2's REQ-B-057 fix, pending until checked**; REQ-B-032 a2cb5bb4 it contains is in base (BASE-109); reviewed head f3a2448f stays (policy: no forward-merge) |
| T54 F2: builder pool search matches the text in SQL and describes only the page | `r1/builder-search-perf` @ 1216b736 | A3 | T48 (carries 705468c1); merges after T48 | READY (A3, on T48 6c5ae3a8; restack only): 413 pass; alone = trial merge with H-A18 0 failures, tsc 0; merge after T48; B2 cycle 21: Approve with Minors |
| T34-L1-residual, taken by team C (REQ-A-013) | `r1/t34-l1-residual-c` @ a2acf754 | team C (REQ-A-013) | BASE-102 (not built from e4bb72eb) | team C has taken T34-L1-residual (REQ-A-013): restacked (a2acf754), 0110 identical; NOT built from A3 e4bb72eb; review not seen (unconfirmed) |
| T45 part 3 builder specs (AC-R1-21.3 / 21.6 on the real bank) | `r1/t45-builder-acs` @ ee3a7d2b | A1b | T48 (stacked on 4a3ff264; merges after T48) | READY (A1b, on T48 6c5ae3a8; specs only): builder-candidate-search giveBab; exam-builder 391/391 alone = trial merge with H-A18; tsc/eslint 0; merge after T48; B2 cycle 21: Approve with Minors |
| T45 part 3 WIP: AC-R1-21.3 / 21.6 builder specs on the real bank | `r1/t45-builder-acs-wip` @ 078204e1 | A4 | T48 (carries migration 0104) | SUPERSEDED by r1/t45-builder-acs; do not merge |
| REQ-B-022a servability overview counts in one Promise.all | `r1/req-b-022a` @ 688529b7 | A4 | T30 (base) | SUPERSEDED by r1/req-b-022a-a4; do not merge |
| T34-L1-residual (A3 WIP, for B3) | `r1/t34-l1-residual` @ e4bb72eb | A3 | T34 (B3 finding T34-L1-residual) | SUPERSEDED: team C took REQ-A-013 on r1/t34-l1-residual-c; do not merge |
| H-A8 stale specs | `r1/ha8-stale-specs` @ 56b1b6cc | A2 | base | STALE (never merged; REQ-B-026 ported its fix, BASE-91); do not merge |
| T31 builder wire | `r1/t31-builder-wire` @ eb0346d2 | A3 | T34 (base); REQ-A-008 (C), merges only together | READY (A3, hold lifted 19:55 UTC; fixes done @ eb0346d2, 441 pass): merge as a PAIR with C REQ-A-008 r1/reqa008-group-stimulus @ 29d24be9 right after it (vue-tsc TS2322 gone, vue-tsc 0); the builder stimulus uses stimulusTableParts; D93 min-2 is skipped for a group with no displayable stimulus; B2 |
| T43 chain + publish ACs | `r1/t43-chain-publish` @ 238eb6eb | A3 | T31, T48; REQ-A-008 | READY (A3, hold lifted): spec-only on T31 eb0346d2 + BASE-105, 458 pass; merge after T31 + REQ-A-008; preview #3 all green; B2 |
| T48 builder parity (0104) | `r1/t48-builder-parity` @ 5d3e56fd | A3 | T34; re-verify running | READY (A3, BASE-105; 0104): giveBab fixture fix, support/bab.ts byte-identical to H-A18; exam-builder + pipeline-chain 409 pass (was 19 red); alone = trial merge with H-A18 fc409ae1, 0 failures, tsc 0; merge AFTER H-A18; Padam only unplaces a question that was ever approved; duplicate Bahagian label gets 422; B2 cycle 21: T48 6c5ae3a8 Approve with Minors (the unique-label D9 row is coming on d90-builder); B reviewed 6c5ae3a8 and the live head is 5d3e56fd = 6c5ae3a8 + merges of BASE-107 and BASE-108 only (merge the reviewed SHA, or treat the newer head as a base-only delta); B3 |
| T43b publish ACs | `r1/t43b-publish-acs` @ 7a14581a | A3 dev-2 | T48 (independent leaf after T48) | READY (A3, on T48 6c5ae3a8): giveBab in publish-acs; 422 pass (was 12 red); alone = trial merge with H-A18 0 failures, tsc 0; independent leaf after T48; B2 cycle 21: Approve |
| T51 partial ACs (builder, Terbit, Kontrak, Jana) | `r1/t51-partial-acs-a3` @ 61c1b077 | A3 dev-1 | T48, T31, T43 (restack in progress) | READY (A3, hold lifted; @ 61c1b077 on T43 238eb6eb + T31 eb0346d2 + T48; does not contain T43b): merge after T48, T31, REQ-A-008, T43; never the old T31 6a27c8dd, T43 5ce5894f, T51 54f63116; preview #3 all green; B2 |
| H-A18 gate facts (0105) | `r1/ha18-gate-facts` @ a9ffe246 | A2 | T33 | READY again (A2, @ a9ffe246; REQ-B-057 MAJOR fixed): the gate counts only pending exact or near duplicate links; accepted items may dismiss links (not_duplicate, cleared_duplicate event; V2 rows 252 and 254); the 0105 CHECKs are now NOT VALID then VALIDATE (the 0105 file changed; not re-run on a DB by A3); gate-facts 1b + accepted-duplicates.spec, mutations red; 70/70 + 8/8; B delta ba5bdd6c -> 629ea0d3 (BASE-108 only) -> a9ffe246; A4 pre-review queued; B2 delta re-review; merge before delete-served-guard, reqb052 and chain-qa-bab-3a |
| R1 AC sweep: R1-18.4 spec, coverage doc 117 to 133 proven (A1b) | `r1/ac-gaps-a1b` @ 1f922ddd | A1b + A3 dev-1 | none (contains ha17 and t37) | READY (multi, @ 5ac9dfc9, CONTAINS ha17 + t37): coverage doc, runbook (§0 tiers, §2.3 migration rehearsal 0104-0107, §3.7 group SELECT, UAT SELECTs, 0106/0107 window, env), B4 QA pack, docs/qa/r1-proposed-copy.md (38 [PROPOSED] BM strings for one-pass user approval); delete-served-guard cited at fe7ef537 and reqa018 at cc42468e in the B4 pack; runbook section 0 item 6 (readiness) marked ON HOLD (ready-tiers-check); B4 pack 3x (D90 group in a paper, build it yourself) and section 5 R1-10.1 rates decided (Q12a) added in e57b1281, and the coverage R1-10.1 rows follow Q12a in 5ac9dfc9; merge after H-A18; B2 |
| REQ-B-050 admin list perf (0106 pg_trgm, 0107 Kertas index) + exact counts | `r1/admin-list-perf` @ 6389cd54 | A4 | none (0106, 0107) | READY (A4, @ 6389cd54, BASE-105): REQ-B-050 + 0106 pg_trgm + 0107 kertas index; per-user rate limit on GET /api/questions (env THROTTLE_QUESTIONS_LIST_PER_MINUTE, default 60, 429 above); docs: feature_flags 0108, drop_pool_tag 0109, optional B12 0122 / B20 0123 (lead-confirmed); migration SQL unchanged since 2a8ab674 (6389cd54 only rewrites the 0107 header comment: 0.9 s bare, about 2 s via migrate deploy); B2 + B3 + DevOps (maintenance window, new env) |
| REQ-B-049 Lapor on a structured question before the first submit (Q11) | `r1/reqb049-report-visible` @ 9ece8d76 | A1b | REQ-B-031 (base) | READY (A1b, BASE-105): pre-review Minors fixed; 316/316; B2 + B3 |
| D72 stimulus lists: one combined where for page and count, joinable spec | `r1/stimulus-list-d72` @ b45ce519 | A2 | T49 (merge t49-served-now first) | READY (A2, BASE-105; contains t49 b99068a6; board row says 86b40246, ls-remote has b45ce519 = the spec-only follow-up of A2 closing the part-linked Darjah/PKSK Minor): Minor fixed (listStimulusIds subject/level via question_parts); stimulus-lists 18/18, questions 938, workflow 275; merge AFTER t49; only v2-backend-deviations.md conflicts vs the A4 chain (keep both); A3 dev-1 delta: correct; B2 |
| REQ-C-012 POST /api/questions/:id/edit-as-draft (SEC-C012-1, import hold) | `r1/req-c012-a2` @ 47b85424 | A2 | H-A18 (merges after it) | READY (A2, @ 47b85424 = 9b1fd35e + the new ha18 a9ffe246): merge after ha18; B3 re-check |
| REQ-A-018 GET /api/admin/questions/:id/paper-servability | `r1/reqa018-paper-servability-route` @ 9d6ef833 | A1b | T45 part 1 (merges after it) | READY (A2, @ 9d6ef833 = cc42468e + contract-tests scenarios + merges of BASE-107): admin papers only, cap 200 + meta, one batched read (spy-pinned), chunk 200, contract exports QuestionPaperServabilityMeta/Response; API conformance 413/413; mock: 3 known-mismatch assertions until C serves the route; A4 Approve + B3 PASS; C reqa018-fe must re-merge + fix the {data,meta} unwrap (REQ-A-026b); merges after T45; B2 + B3; merge-tree vs BASE-109 clean |
| QA doc nits: T38 self-mark reward notes (docs only) | `r1/a3-qa-doc-nits` @ e4d4dd32 | A3 | none (docs) | READY (A3, BASE-105, docs only): stale QA notes on T38 self-mark reward fixed (2 files); B2 |
| Intake follow-up: unknownSp required, spNotInTaxonomy named in the deviations row | `r1/intake-reqs-followup` @ 2fe252ab | A2 | intake-reqs-a2 (merge after it) | READY (A2, @ 2fe252ab on intake-reqs 8c1964a6): unknownSp required, FACTS in unit.spec, deviations row 244 names spNotInTaxonomy; 43/43, tsc 0; merge AFTER intake-reqs (deviations conflict: keep both); B2 small |
| D90 Kuiz/Simulasi sweep spec + 3 D9 rows | `r1/d90-kuiz-sweep-a3` @ f95745b9 | A3 | none (BASE-105) | IN-PROGRESS (A3, @ f95745b9): fixing A4 pre-review Minors (recursive allow-map key-leak check with planted secrets and a positive control, 2-stimulus test, legacy Simulasi pin tests); was READY @ 1bf273ca; READY again when A3 reports; 3 D9 rows (Simulasi legacy groups KIV R2 + runbook SELECT; random Kuiz draws members independently as V2; shows every stimulus vs V2 first-only = fix); B2 |
| /api/ready returns 503 while wallet tiers are empty | `r1/ready-tiers-check` @ 9c80f08c | A2 | none (BASE-105) | ON HOLD (A2, @ 9c80f08c = 86e7a52a + a merge of BASE-107; REQ-A-028, B DevOps): code correct, Minors fixed (exact 503 body, WARN once per state change, INFO on recovery; mutations red); A3 pre-review asked for changes: B1 CI api.yml boot smoke curls /api/ready after migrate with no seed -> red (M1); a first-install deploy (deploy.sh, then --seed-reference) ends as a false FAILED deploy (M2); needs B DevOps changes (CI reference-seed step; first-install seed ordering); not in the merge order; B2 + DevOps |
| T48 fix: a PUT moving an added question across Bahagian keeps its Nombor soalan | `r1/t48-label-move-fix` @ 9783849c | A3 | T48 (leaf; merge right after T48) | READY (A3, leaf on T48 6c5ae3a8): PUT moving an added question across Bahagian keeps its Nombor soalan (4-line fix in update()); biting spec + same-section control; 410 alone = trial with H-A18; no D9 row; merge right after T48; pre-review by A2; B2 |
| D90 builder sweep spec + T48 D9 rows completed | `r1/d90-builder-sweep-a3` @ da0bb7f3 | A3 | T48 (merge after T48) | READY (A3, @ 5200156b on T48 6c5ae3a8): D90 sweep spec + T48 D9 rows (6 cells, LEAD, dates fixed, label-move note); merge after T48 (+ t48-label-move-fix); B2 |
| R1-10.1 practice rewards pinned (specs + docs/qa/r1-10-1-practice-rewards.md; Q12 open) | `r1/r1-10-1-practice-spec` @ cfd6b6f7 | A1b + A2 + A3 | none (anywhere after BASE-105) | READY (A1b + A2 + A3, @ 568f2e55, BASE-105; specs + docs): pins today's practice rewards (19 tests, 11/11 mutations); R1-10.1 row reworded from code (challenges every mode; achievements random/chapter/revision only); Q12a decided (USER, 2026-11-02, via Mandor): keep 1 syiling + 10 points per correct; Q12b as is by lead default; .cloud confirmation in R2; B2 |
| Chain QA 3a: Semakan without a Bab is refused (H-A18) | `r1/chain-qa-bab-3a-a3` @ 0efba36c | A3 | H-A18, chain-qa-selfmark-a3 (contains both) | READY (A3, @ 0efba36c; contains H-A18 fc409ae1 and chain-qa-selfmark 5b93da43): Semakan without a Bab is refused with Sila pilih bab. before the Bab is given; spec only; merges after H-A18 and chain-qa-selfmark-a3; B2 |
| Guru/admin DELETE refused (409) for a served or pinned question; one served rule | `r1/delete-served-guard` @ fe7ef537 | A2 | REQ-B-052 (merge after H-A18, REQ-B-032, REQ-B-052) | READY (A2, @ fe7ef537; contains B-052 f3a2448f): only a held paper (Terbit, or withdrawn with sittings) blocks a delete, status clause gone (V2 parity); FK-restrict (sets/remedial/battle) -> 409 in_use; no in-practice block (regrade fallback proven); A4 Approve + B3 PASS (7e5d82e6) + Minors fixed (regrade, mixed bulk, all 4 RESTRICT tables, isForeignKeyViolation unit); questions 665, practice 175, security 185, r1 61; delta to fe7ef537 = errors.ts FK detection + specs only; team C reqa023-ai-draft-delete-409 pairs with it; B2 + B3; merge after t49 + d72 and H-A18, B-032, B-052 |
| Chain QA: intake figure group to pupil sitting + step map (specs, docs) | `r1/r1-chain-qa-a3` @ 9b70ae39 | A3 | none (specs, docs) | READY (A3, @ 9b70ae39; the key-leak check is an allow-list (A2 pre-review), hold lifted): chain-intake-to-pupil.spec + docs/qa/r1-chain-step-map.md (step to spec table for B4); green alone and on the builder stack; B2 |
| Chain QA: T38 self-mark reward join (specs) | `r1/chain-qa-selfmark-a3` @ 5b93da43 | A3 | T38, r1-chain-qa-a3 | READY (A3, @ 5b93da43 = T38 13134ced + chain-qa 9b70ae39 + test): self-mark reward join in the chain (one row per new score, replay adds nothing; bites); alone 620 pass; merge after T38 and r1-chain-qa-a3; the H-A18 Bab-refusal join (3a) is on r1/chain-qa-bab-3a-a3 (READY @ 0efba36c) |
| Drop dead CHAPTER_LOCKED and locked enums from the contract | `r1/drop-lock-enums` @ 4d1424c8 | A1a | team C reqa014-no-chapter-lock-fe | READY (A1a + A2, @ 4d1424c8, BASE-105): contract drops dead CHAPTER_LOCKED + locked states; negative contract tests; contract 1435/1435, emit no diff, api tsc 0; with C reqa014 merged vue-tsc 0, m03/m05 659/659; merge after C reqa014-no-chapter-lock-fe dc561730; B2 |

### 1.3 In progress, not pushed

| ID | Branch | Lane | Depends on |
|---|---|---|---|
None: every unit is pushed.

### 1.4 Docs units (A3 docs agent), all READY

| Unit | Branch @ head | Output |
|---|---|---|
| R1 release notes (BM) | `r1/ha24-release-input` @ fdfaa810 | `docs/release/r1-nota-keluaran.md` (written by dev-1 on this release-input branch) |
| R1 sign-off checklist (BM) | `r1/ha24-release-input` @ fdfaa810 | `docs/release/r1-signoff-checklist.md` (8 gates, Status column empty on purpose) |
| R1 KIV for R2 (BM) | `r1/ha24-release-input` @ fdfaa810 | `docs/release/r1-kiv-r2.md` (36 rows on ha24 fdfaa810; rows 28 to 31 are the REQ-A-029 builder FE gaps, re-checked against BASE-109: Padam soalan and Semak partly done, Salin set done on the editor, the cross-Bahagian move still open; row 32 the FE-mock coverage scan; row 33 REQ-B-058; row 34 the accepted Q13 limit; row 35 no cross-attempt syiling/XP cap for T38 (Q14, REQ-B-059); row 36 the B3 Low on T48 setGroupLabel, no change in R1 by LEAD decision) |
| R1 proposed BM copy table | `r1/ac-gaps-a1b` @ 1f922ddd | `docs/qa/r1-proposed-copy.md` (38 [PROPOSED] strings for one-pass user approval; on ac-gaps) |
| T37 runbook | `r1/t37-r1-runbook` @ c9dcb5a0 | FROZEN, contained in `r1/ac-gaps-a1b` (B1 merges that instead); `docs/ops/r1-runbook.md` is edited only there |
| T39 K1 evidence | `r1/t39-k1-evidence` @ 1a26f7a6 | `docs/ops/r1-k1-blueprint-evidence.md` |
| T46 / H-A17 AC coverage | `r1/ha17-ac-coverage` @ 157b371c | FROZEN, contained in `r1/ac-gaps-a1b` (A1b owns `docs/qa/r1-backend-ac-coverage.md` now) |
| H-A19 admin parity | `r1/ha19-admin-parity` @ c7315b0e | `docs/qa/r1-admin-parity-check.md` |
| H-A20 student parity | `r1/ha20-student-parity` @ 557e17c6 | `docs/qa/r1-student-parity-check.md` |
| H-A22 parity docs | `r1/ha22-parity-docs` @ 4fb2a41b | both parity docs refreshed, deviation rows H22-D1/D2 in `v2-bijak-spm.md`, `student.md` rows marked |
| H-A23 E2E readiness | `r1/ha23-e2e-readiness` @ 9a86b5bb | `docs/qa/r1-e2e-readiness.md` (merge order, minimal set) |
| H-A24 release input | `r1/ha24-release-input` @ fdfaa810 | `docs/ops/r1-release-input-team-a.md` (+ scope AC-R1-18.2 and 18.4 text) |
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
| 0104 | `0104_paper_section_admin_created` | T48 (`r1/t48-builder-parity` @ 5d3e56fd) | READY (A3, BASE-105; 0104): giveBab fixture fix, support/bab.ts byte-identical to H-A18; exam-builder + pipeline-chain 409 pass (was 19 red); alone = trial merge with H-A18 fc409ae1, 0 failures, tsc 0; merge AFTER H-A18; Padam only unplaces a question that was ever approved; duplicate Bahagian label gets 422; B2 cycle 21: T48 6c5ae3a8 Approve with Minors (the unique-label D9 row is coming on d90-builder); B reviewed 6c5ae3a8 and the live head is 5d3e56fd = 6c5ae3a8 + merges of BASE-107 and BASE-108 only (merge the reviewed SHA, or treat the newer head as a base-only delta); B3 |
| 0105 | gate facts (BE-09 duplicate, media, AI-editor facts) | H-A18 (A2) `r1/ha18-gate-facts` @ a9ffe246 | READY again (A2, @ a9ffe246; REQ-B-057 MAJOR fixed): the gate counts only pending exact or near duplicate links; accepted items may dismiss links (not_duplicate, cleared_duplicate event; V2 rows 252 and 254); the 0105 CHECKs are now NOT VALID then VALIDATE (the 0105 file changed; not re-run on a DB by A3); gate-facts 1b + accepted-duplicates.spec, mutations red; 70/70 + 8/8; B delta ba5bdd6c -> 629ea0d3 (BASE-108 only) -> a9ffe246; A4 pre-review queued; B2 delta re-review; merge before delete-served-guard, reqb052 and chain-qa-bab-3a |

Ranges: team A 0100 to 0109 (overflow 0120 to 0129), team C 0110 to 0119, team B none. Taken inside that range (lead decision): 0106 and 0107 by `r1/admin-list-perf` (A4), 0108 by `feature_flags`, 0109 by `drop_pool_tag` (R1-B06); nothing in 0106 to 0109 is free. Any optional B12 or B20 migration goes to 0120 or above (the overflow range). SQL for 0092 to 0107 is in `docs/ops/r1-runbook.md`.

## 4. Open cross-team requests

Status as recorded in `requests/` (answers files take precedence). "Open for A" = work team A still owes (accepted, in progress or open).

| Direction | IDs |
|---|---|
| Open for A | REQ-B-019, REQ-B-029, REQ-B-040, REQ-B-043, REQ-B-050, REQ-B-051, REQ-B-057, REQ-B-058, REQ-B-062, REQ-C-021, REQ-C-026, REQ-C-027 |
| Delivered by A (waiting for merge or the other side) | REQ-B-003, REQ-B-004, REQ-B-007, REQ-B-013, REQ-B-014, REQ-C-016, REQ-C-017, REQ-C-018 |
| Open to B | REQ-A-007, REQ-A-009, REQ-A-011, REQ-A-017, REQ-A-024, REQ-A-028, REQ-A-033 |
| Open to C | REQ-A-004, REQ-A-022, REQ-A-023, REQ-A-029, REQ-A-030, REQ-A-031, REQ-A-032, REQ-A-034, REQ-A-035, REQ-A-036, REQ-A-037 |
| Delivered by B or C to A's request | REQ-A-001, REQ-A-002, REQ-A-003, REQ-A-005, REQ-A-006, REQ-A-008, REQ-A-010, REQ-A-012, REQ-A-014, REQ-A-016, REQ-A-020 |
| Closed (done, declined, withdrawn) | REQ-A-015, REQ-B-001, REQ-B-002, REQ-B-005, REQ-B-006, REQ-B-008, REQ-B-009, REQ-B-010, REQ-B-011, REQ-B-012, REQ-B-015, REQ-B-016, REQ-B-018, REQ-B-020, REQ-B-021, REQ-B-023, REQ-B-024, REQ-B-026, REQ-B-027, REQ-B-028, REQ-B-030, REQ-B-031, REQ-B-038, REQ-B-039, REQ-B-041, REQ-B-046, REQ-C-001, REQ-C-002, REQ-C-003, REQ-C-004, REQ-C-005, REQ-C-006, REQ-C-007, REQ-C-008, REQ-C-009, REQ-C-010, REQ-C-011, REQ-C-013, REQ-C-014, REQ-C-015, REQ-C-022, REQ-C-023, REQ-C-024 |
| Raised between B and C, not A | REQ-B-001, REQ-B-002, REQ-B-009, REQ-B-011, REQ-B-016, REQ-B-024, REQ-B-027, REQ-B-030, REQ-B-036, REQ-B-038, REQ-B-039, REQ-B-042, REQ-B-045, REQ-B-047, REQ-B-048, REQ-B-054, REQ-B-055, REQ-B-056, REQ-B-060, REQ-B-063, REQ-C-023, REQ-C-025 |

## 5. How to resume

- **Lanes.** A1 is the lead and also a lane; A2 to A4 are separate sessions. Each lane session runs Sonnet subagents (two dev slots in A1, A2, A3, A4, plus an A3 docs agent). A1 is the only writer of `BOARD.md` and `status/A1..A4.md`; lanes report to the lead.
- **Ownership.** A1: rewards, attempts, reports, seed, Jana (T06, T26, T28, T35, T38, T40, T41, T50, T52, H-A13). A2: questions lifecycle, stimuli, DSKP gate, reports context (REQ-B-032 from 2026-11-01, T03, T04, T32, T33, T36, T42, T45b, T47, T49, H-A18). A3: builder, blueprints, docs (T05, T31, T34, T43, T44, T48, T51, H-A15, parity and runbook docs). A4: servability, bridge, essay_choice (T07, T08, T25, T29, T30, R1E2E-05b, H-A21).
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
| **T34 is in base (BASE-101); its stack is not.** T34 merged as `r1/t34-builder-review-c` @ 05451810 (team A T34 5bb590d0 fixed by team C, Disahkan gate kept, fixtures serve seeded blueprints). A3's `r1/t34-l1-residual` (e4bb72eb) is SUPERSEDED by team C's `r1/t34-l1-residual-c` (REQ-A-013). Board states (heads from ls-remote): T48 (0104, 5d3e56fd = 6c5ae3a8 + merges of BASE-107 and BASE-108), T43b (7a14581a), builder-search-perf (1216b736) and t45-builder-acs (ee3a7d2b) are READY on T48 and merge after H-A18; T31 (eb0346d2), T43 (238eb6eb) and T51 (61c1b077) are READY (holds lifted 19:55 UTC) and merge in that order with C's REQ-A-008 (29d24be9) right after T31. The proven B1 order is in `docs/ops/r1-release-input-team-a.md` section 3.5 (A4 preview #3, REQ-A-024). T10 and hc-builder-parity (team C) restack on BASE-101; REQ-A-008 follows T31. | Order: T31 / T48 / T43 each merge BASE-101 first (`questions.module.ts` and the deviations doc conflict as union). Do not push to `r1/t34-builder-review`. |
| **0103 attempt FK.** `fk_question_reports_attempt_id` is NOT VALID on purpose. | Never run `VALIDATE CONSTRAINT` in the release. |
| **Lapor (REQ-B-031, REP-M1).** The server guard merged as BASE-105 (B2 Approve w/ Minors, B3 Pass with Lows); REQ-B-049 stays open. The Lapor FE (`r1/reqa005-bijak-lapor`, team C) can proceed. | A1 + team C. |
| **Branch heads move.** Several READY heads changed after their last B verdict. | A head that moved after review is not merged until B reviews the delta. |
