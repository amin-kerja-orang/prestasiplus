# Team A R1 state: resume sheet

Date: 2026-11-02. Written off `feature/v3-bijak-r1` @ f9f8c721f (BASE-151). Docs only. Sources: `docs/team/BOARD.md`, `MERGE-LOG.md`, `QUESTIONS.md` and `requests/` on `origin/team/r1-board`, `git ls-remote`, and `docs/TRACKER.md` on `r1/d91-decisions` (PR #404). Heads change often: re-run `git ls-remote origin 'refs/heads/r1/*'` before relying on one.

Task source: `docs/handoff/CLOUD-HANDOFF.md` section 7. R1 = Bijak SPM release.

## 1. Units

### 1.1 Merged into base (BASE-n)

BASE-120 to BASE-151 are read from the merge subjects on `feature/v3-bijak-r1` and agree with the rows now in the MERGE-LOG on `team/r1-board` (`team/r1-board@76b2aade`, MERGE-LOG read to BASE-137; BASE-138 to BASE-151 are read from the merge subjects; the B2/B3 verdicts are in the MERGE-LOG). BASE-126 to BASE-131 include team C units (REQ-A-014/REQ-B-048, REQ-B-036, REQ-A-020, REQ-A-021) and REQ-A-013 with migration 0110; BASE-132 to BASE-135 are H-A18 (migration 0105, merged alone), REQ-C-012, REQ-B-052 and D72; BASE-136 to BASE-145 are the REQ-A-018 route, admin-list-perf (migrations 0106 and 0107), REQ-B-060/063, r1-chain-qa, chain-qa-selfmark, chain-qa-bab-3a, the D90 Kuiz sweep, the R1-10.1 practice spec, drop-lock-enums the H-A24 release input (docs) BASE-146 is team C's REQ-A-018 front end, BASE-147 the Kandungan hub (C), BASE-148 T48 (migration 0104; merged @ 8d84f6ab, so the 10c62437 doc hop was never merged), BASE-149 delete-served-guard, BASE-150 the Lapor FE with REQ-A-015 (C) and BASE-151 REQ-A-025 (C).

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
| a3-qa-doc-nits | `r1/a3-qa-doc-nits` @ e4d4dd32 | BASE-125 | A3 docs |
| REQ-B-049 (Lapor on a structured question, Q11) | `r1/reqb049-report-visible` @ 9ece8d76 | BASE-126 | A1b |
| REQ-A-014 + REQ-B-048 | `r1/reqa014-no-chapter-lock-fe` @ dc561730 | BASE-127 | team C |
| REQ-B-036 | `r1/reqb036-intake-group-header` @ 50096c38 | BASE-128 | team C |
| REQ-A-020 | `r1/reqa020-kuiz-table-parts` @ 371adfb2 | BASE-129 | team C |
| REQ-A-021 (T47 UI) | `r1/reqa021-bulk-filter` @ 1cbbeb57 | BASE-130 | team C |
| REQ-A-013 (T34-L1-residual, migration 0110) | `r1/t34-l1-residual-c` @ a2acf754 | BASE-131 | team C |
| H-A18 + REQ-B-017/037 + D99 (migration 0105) | `r1/ha18-gate-facts` @ a9ffe246 | BASE-132 (alone; the 0105 folder in base is byte-identical to a9ffe246) | A2 |
| REQ-C-012 (edit as draft) | `r1/req-c012-a2` @ 47b85424 | BASE-133 | A2 |
| REQ-B-052 (archived and pinned edits) | `r1/reqb052-archived-edit` @ f3a2448f | BASE-134 | A3 |
| D72 (stimulus lists) | `r1/stimulus-list-d72` @ b45ce519 | BASE-135 | A2 |
| REQ-A-018 route (GET /api/admin/questions/:id/paper-servability) | `r1/reqa018-paper-servability-route` @ 9d6ef833 | BASE-136 | A1b |
| REQ-B-050 admin list perf (migrations 0106 and 0107) + REQ-B-061 limit 240 | `r1/admin-list-perf` @ 69f465c8 | BASE-137 | A4 |
| REQ-B-060 + REQ-B-063 (KS-17 Set Builder in the access matrix, Import CSV button) | `r1/reqb060-ks17-csv-link` @ 05d12e41 | BASE-138 | team C |
| Chain QA: intake figure group to pupil sitting + step map | `r1/r1-chain-qa-a3` @ 9b70ae39 | BASE-139 | A3 |
| Chain QA: T38 self-mark reward join | `r1/chain-qa-selfmark-a3` @ 5b93da43 | BASE-140 | A3 |
| Chain QA 3a: Semakan without a Bab is refused | `r1/chain-qa-bab-3a-a3` @ 0efba36c | BASE-141 | A3 |
| D90 Kuiz/Simulasi sweep spec + 3 D9 rows | `r1/d90-kuiz-sweep-a3` @ 16cd704a | BASE-142 | A3 |
| R1-10.1 practice rewards pinned | `r1/r1-10-1-practice-spec` @ cfd6b6f7 | BASE-143 | A1b + A2 + A3 |
| Drop dead CHAPTER_LOCKED and locked enums from the contract | `r1/drop-lock-enums` @ 4d1424c8 | BASE-144 | A1a + A2 |
| H-A24 release input (docs) | `r1/ha24-release-input` @ c0f7a45d | BASE-145 (origin head 4335759e is ahead of the merged commit) | A3 docs |
| REQ-A-018 FE (paper-servability panel) | `r1/reqa018-paper-servability-fe` @ 8ad24143 | BASE-146 | team C |
| Kandungan hub cards (REQ-B-041) | `r1/reqb041-hub-cards` @ 151648eb | BASE-147 | team C |
| T48 builder parity (migration 0104) | `r1/t48-builder-parity` @ 8d84f6ab | BASE-148 (`c3098c9a`; the later head 10c62437, a merge of BASE-145 into it, was never merged) | A3 |
| delete-served-guard (409 for a served or pinned question) | `r1/delete-served-guard` @ da7a12e7 | BASE-149 | A2 |
| Lapor + REQ-A-015 | `r1/reqa005-bijak-lapor` @ 53fa8fad | BASE-150 | team C |
| REQ-A-025 (Tarik balik confirm) | `r1/reqa025-tarik-balik-confirm` @ eb211b64 | BASE-151 | team C |
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
| T54 F2: builder pool search matches the text in SQL and describes only the page | `r1/builder-search-perf` @ 1216b736 | A3 | T48 (carries 705468c1); merges after T48 | **BOARD: READY (B2 c23 APPROVED @1216b736; clean vs BASE-148)**; was: READY (A3, on T48 6c5ae3a8; restack only): 413 pass; alone = trial merge with H-A18 0 failures, tsc 0; merge after T48; B2 cycle 21: Approve with Minors (board: B2 c23 APPROVED @ 1216b736) |
| T45 part 3 builder specs (AC-R1-21.3 / 21.6 on the real bank) | `r1/t45-builder-acs` @ ee3a7d2b | A1b | T48 (stacked on 4a3ff264; merges after T48) | **BOARD: READY (A1b, @ee3a7d2b; clean vs BASE-148)**; was: READY (A1b, on T48 6c5ae3a8; specs only): builder-candidate-search giveBab; exam-builder 391/391 alone = trial merge with H-A18; tsc/eslint 0; merge after T48; B2 cycle 21: Approve with Minors |
| T45 part 3 WIP: AC-R1-21.3 / 21.6 builder specs on the real bank | `r1/t45-builder-acs-wip` @ 078204e1 | A4 | T48 (carries migration 0104) | SUPERSEDED by r1/t45-builder-acs; do not merge |
| REQ-B-022a servability overview counts in one Promise.all | `r1/req-b-022a` @ 688529b7 | A4 | T30 (base) | SUPERSEDED by r1/req-b-022a-a4; do not merge |
| T34-L1-residual (A3 WIP, for B3) | `r1/t34-l1-residual` @ e4bb72eb | A3 | T34 (B3 finding T34-L1-residual) | SUPERSEDED: team C took REQ-A-013 on r1/t34-l1-residual-c; do not merge |
| H-A8 stale specs | `r1/ha8-stale-specs` @ 56b1b6cc | A2 | base | STALE (never merged; REQ-B-026 ported its fix, BASE-91); do not merge |
| T31 builder wire | `r1/t31-builder-wire` @ eb0346d2 | A3 | T34 (base); REQ-A-008 (C), merges only together | READY (A3, hold lifted 19:55 UTC; fixes done @ eb0346d2, 441 pass): merge as a PAIR with C REQ-A-008 r1/reqa008-group-stimulus @ 29d24be9 right after it (vue-tsc TS2322 gone, vue-tsc 0); the builder stimulus uses stimulusTableParts; D93 min-2 is skipped for a group with no displayable stimulus; B2 (board: already an ancestor of C reqa008 f85db8ff, B2 c23 AwM; merging reqa008 brings T31; A4 pair check on BASE-129 green) (board: doc-only conflict vs BASE-148) |
| T43 chain + publish ACs | `r1/t43-chain-publish` @ 238eb6eb | A3 | T31, T48; REQ-A-008 | **BOARD: IN-PROGRESS (A3, head 238eb6eb; doc-only conflict vs BASE-148; merge after T31 + REQ-A-008)**; was: READY (A3, hold lifted): spec-only on T31 eb0346d2 + BASE-105, 458 pass; merge after T31 + REQ-A-008; preview #3 all green; B2 (board: B2 c23 APPROVED @ 238eb6eb, AwM; merge after T31 + REQ-A-008 f85db8ff) |
| T43b publish ACs | `r1/t43b-publish-acs` @ 457db6ae | A3 dev-2 | T48 (independent leaf after T48) | **BOARD: READY (A3, @457db6ae = 7a14581a + T48 10c62437 merged: contract union 26 codes, openapi regen; clean vs BASE-148; merge after T48, which is in base; B2 delta)**; was: READY (A3, on T48 6c5ae3a8): giveBab in publish-acs; 422 pass (was 12 red); alone = trial merge with H-A18 0 failures, tsc 0; independent leaf after T48; B2 cycle 21: Approve |
| T51 partial ACs (builder, Terbit, Kontrak, Jana) | `r1/t51-partial-acs-a3` @ 7cb8d814 | A3 dev-1 | T48, T31, T43 (restack in progress) | **BOARD: READY-AFTER-FIX (A3, @7cb8d814; clean vs BASE-148): exam-builder 416/417 red on the REQ-B-069 test ("stays outside D93", the pool page cap), fixed by `r1/t31-pool-lookup-fixture` 2046a330 merged after T31, no cascade needed**; was: READY (A3, hold lifted; @ 61c1b077 on T43 238eb6eb + T31 eb0346d2 + T48; does not contain T43b): merge after T48, T31, REQ-A-008, T43; never the old T31 6a27c8dd, T43 5ce5894f, T51 54f63116; preview #3 all green; B2 (board: B2 c23 APPROVED @ 61c1b077, AwM) |
| R1 AC sweep: R1-18.4 spec, coverage doc 132 entries proven (A1b) | `r1/ac-gaps-a1b` @ c2b93710 (and the BASE-151 docs pass on top) | A1b + A3 dev-1 | none (contains ha17 and t37) | READY (multi, @ 5ac9dfc9, CONTAINS ha17 + t37): coverage doc, runbook (§0 tiers, §2.3 migration rehearsal 0104-0107, §3.7 group SELECT, UAT SELECTs, 0106/0107 window, env), B4 QA pack, docs/qa/r1-proposed-copy.md (38 [PROPOSED] BM strings for one-pass user approval); delete-served-guard cited at fe7ef537 and reqa018 at cc42468e in the B4 pack; runbook section 0 item 6 (readiness) marked ON HOLD (ready-tiers-check); B4 pack 3x (D90 group in a paper, build it yourself) and section 5 R1-10.1 rates decided (Q12a) added in e57b1281, and the coverage R1-10.1 rows follow Q12a in 5ac9dfc9; merge after H-A18; B2 |
| Intake follow-up: unknownSp required, spNotInTaxonomy named in the deviations row | `r1/intake-reqs-followup` @ 2fe252ab | A2 | intake-reqs-a2 (merge after it) | READY (A2, @ 2fe252ab on intake-reqs 8c1964a6): unknownSp required, FACTS in unit.spec, deviations row 244 names spNotInTaxonomy; 43/43, tsc 0; merge AFTER intake-reqs (deviations conflict: keep both); B2 small |
| /api/ready returns 503 while wallet tiers are empty | `r1/ready-tiers-check` @ 9c80f08c | A2 | none (BASE-105) | ON HOLD (A2, @ 9c80f08c = 86e7a52a + a merge of BASE-107; REQ-A-028, B DevOps): code correct, Minors fixed (exact 503 body, WARN once per state change, INFO on recovery; mutations red); A3 pre-review asked for changes: B1 CI api.yml boot smoke curls /api/ready after migrate with no seed -> red (M1); a first-install deploy (deploy.sh, then --seed-reference) ends as a false FAILED deploy (M2); needs B DevOps changes (CI reference-seed step; first-install seed ordering); not in the merge order; B2 + DevOps |
| T48 fix: a PUT moving an added question across Bahagian keeps its Nombor soalan | `r1/t48-label-move-fix` @ 9783849c | A3 | T48 (leaf; merge right after T48) | **BOARD: READY (B2 c23 APPROVED @9783849c; clean vs BASE-148, no restack needed)**; was: READY (A3, leaf on T48 6c5ae3a8): PUT moving an added question across Bahagian keeps its Nombor soalan (4-line fix in update()); biting spec + same-section control; 410 alone = trial with H-A18; no D9 row; merge right after T48; pre-review by A2; B2 (board: B2 c23 APPROVED @ 9783849c) |
| D90 builder sweep spec + T48 D9 rows completed | `r1/d90-builder-sweep-a3` @ eeebce89 | A3 | T48 (merge after T48) | **BOARD: READY (A3, @eeebce89 = B2-approved da0bb7f3 + T48 10c62437 merged, deviations keep-both; exam-builder 400/400; clean vs BASE-148; B2 delta)**; was: READY (A3, @ da0bb7f3 on T48 6c5ae3a8; B2 cycle 23 approved it): D90 sweep spec + A4 Minors (copy order and pins, first/last member tags, scoped search) + T48 D9 rows (6 cells, LEAD, dates fixed, label-move note, duplicate Bahagian label row); 15 mutations listed, all red; 418 pass; merge after T48 (+ t48-label-move-fix) (board: B2 c23 APPROVED @ da0bb7f3, AwM) |
| Terbit drops " (draf)" from an exact auto title (D9) | `r1/publish-title-draft` @ 335e9cbb | A2 | none (merge-tree vs BASE-126: deviations doc keep-both only) | READY (A2, @ 335e9cbb = 4e768673 + a merge of BASE-148 (title constants + T48 helpers); exam-builder 396/396, tsc 0; merge-tree vs BASE clean); A4 pre-review; B2 delta |
| Q13: the pick-N rule line follows V2 "Jawab {N} soalan sahaja." | `r1/rule-line-v2` @ a425206c | A3 | BASE-109 | READY (A3, @ a425206c = 89961f9f + a merge of BASE-148 (the comment kept, the base `figures.questionCount` kept, output identical); exam-builder + bijak-papers 507, exam-core 221, tsc and vue-tsc 0; merge-tree clean; A4 pre-review; B2 delta; USER Q13 2026-11-02; USER Q13 2026-11-02): rules.ts + exam-core paper-model.ts; "Jawab semua soalan." unchanged; PoC/golden authored "daripada" text is an accepted limit (deviation row, KIV row 34); exam-core 219, bijak-papers 109, conformance 403; FE copies are REQ-A-035 (C); B2 |
| T51 follow-up specs: AC-18.1 5c via the Studio path, R1-11.4/12.6 SELECT pins | `r1/partial-acs-a3` @ e6ceece1 | A3 | T51 (merge after it) | **BOARD: READY-AFTER-FIX (A3; clean vs BASE-148; the same REQ-B-069 red, fixed by `r1/t31-pool-lookup-fixture`)**; READY (A3, @ 04a196eb on T51 (the board row text still says 01ab13f7); tests only; A1b pre-review Approve); B2 |
| Chain QA 6b: Jana Kertas with KBAT>0 (test only) | `r1/minors-kbat-chain-a3` @ a253b3bf | A3 | partial-acs-a3 (merge after it) | **BOARD: READY-AFTER-FIX (A3; clean vs BASE-148; the same REQ-B-069 red, fixed by `r1/t31-pool-lookup-fixture`)**; READY (A3, @ 29545691 on partial-acs-a3 01ab13f7; pipeline-chain step 6b, 48 pass, mutations red; closes a B2 c17 Minor; A1b pre-review Approve); B2 |
| Type-only Minor: AttemptSectionSnapshot.versions | `r1/minors-snapshot-versions-a3` @ 1ef2eb2e | A3 | BASE-120 | READY (A3, @ 1ef2eb2e on BASE-120; attempt-source 4/4, tsc 0; closes a B2 c20 Minor; A1b pre-review Approve); B2 |
| T38 accepted-risk deviation row (Q14, REQ-B-059) | `r1/t38-cap-risk-row` @ ee421f52 | A3 docs | BASE-120 | READY (A3 docs, @ ee421f52; docs only; USER Q14: no cross-attempt syiling/XP cap in R1; KIV row 35); B1 |
| A2 carried minors: REQ-A-018 JSDoc, D9 row for the simulasi_kuiz limit, deviation row PKSK applyStatus (KIV row 37) | `r1/a2-carried-minors` @ 45f15242 | A2 | none (comments and docs) | READY (A2, @ 45f15242 = 6b9104d3 + A1b JSDoc wording; comments and docs only; A1b Approve); B2 |
| Takedown pin: the list drops taken-down papers for a pupil with no sitting, batched pins (REQ-B-058) | `r1/reqb058-takedown-pin` @ f7cee944 | A4 | BASE-109 | READY (A4, @ f7cee944 = b1e96566 + a test-only inline-Bab update in `advance()` for the H-A18 gate; reqb058 9/9, pin-servable 3, be09-paper 8 on BASE and head; bite 6 red; A1b pre-review Approve on b1e96566); merge note: the deviations doc keeps the edited REQ-B-032 row and both BASE rows; B2 |
| REQ-B-058 dedupe test: one question in two sections (test only) | `r1/reqb058-dedupe-test-a3` @ d7665dfa | A3 | reqb058-takedown-pin (merge after it) | READY (A3, @ d7665dfa = a5f4d355 + takedown-pin f7cee944 + the inline Bab; 17 pass on BASE-148; mutations red); merge after reqb058-takedown-pin; the deviations doc keeps both; B2 |
| Minors: approval-check guard removed, servability-overview reads through the limiter | `r1/minors-chain-tip-a3` @ 41c22c96 | A3 | BASE-128 | READY (A3, @ 41c22c96 on BASE-128: dead reasons.length guard removed (A1b Approve on 666102d0); every servability-overview read goes through the limiter (4), max-in-flight spy spec; closes B2 c20 Minors); B2 |
| Publish lock: Terbit takes FOR SHARE on the placed questions before the check (KIV row 2) | `r1/publish-lock-share` @ 7ef73b79 | A1b | delete-served-guard (in base: BASE-149) | READY (A1b, @ 7ef73b79 = 225b6941 + a merge of BASE-148; A4 APPROVE: the dropped early read was T34's perf choice (5df0b2f1), fully replaced by the post-lock reads and PUBLISH_TX; the in-lock-window test has existed since 11c827b7; 418/418). delete-served-guard is merged (BASE-149), so it can merge now; B2 delta |
| REQ-B-066: the env.schema.ts:148 comment says 240 | `r1/alp-comment-240` @ 84b0c3a9 | A4 | admin-list-perf 69f465c8 (in base: BASE-137) | READY (A4, @ 84b0c3a9 on the approved admin-list-perf; comment only; A1b Approve); B2 |
| H-A18 follow-up: not_duplicate idempotent / 409 itemLocked on accepted, duplicateId in the audit, accepted-duplicates e2e test | `r1/ha18-minors` @ 17450966 | A2 | BASE-132 (H-A18 merged) | READY (A2, @ 17450966; B2 delta vs base is 5 files; no migration change: 0105 is restored byte-for-byte, the lead checked the 3-dot diff, because 0105 has been merged since BASE-132 and a comment edit would change its checksum; A1b Approve on content; A4 proof green: 495 passed + 1 todo, migration-0105 + accepted-duplicates + gate-facts 22/22); B2 |
| T45 Part 3 Minors: pinned title fixed and the number-clash pin (numberLabel only; the wider check is KIV row 38) | `r1/minors-t45-a3` @ eb8165ed | A3 | T45 builder-acs (merge after it) | READY (A3, @ eb8165ed, 2 test-only commits off T45 ee3a7d2b; 80/80 builder specs, mutations red; closes B2.md:30 Minors); B2. BOARD: it stacks on T45, so it is restacked with REQ-B-068 |
| REQ-B-025c carried Minors: essay-choice blank on a choose-N Bahagian (test only) | `r1/minors-b025c-a3` @ a4feeab0 | A3 | BASE-131 | READY (A3, @ a4feeab0 on BASE-131; 9 tests, best-N and the V2 self-mark rule pinned, mutations red; closes the A1b REQ-B-025c carried Minors); B2 |
| REQ-B-067: ETL guards (realOf symlinked-ancestor bypass; the >1 MB staged-file guard failed open on BSD stat) | `r1/reqb067-etl-guards` @ d402fdf2 | A1a | BASE-132 | READY (A1a, @ d402fdf2 off BASE-132): the real defects are fixed: `files.ts` `realOf` (realpath first, ancestor walk, dangling symlinks followed up to 40 hops) closes the "separate directories" guard bypass; the `.github/workflows/api.yml` >1 MB guard is portable and fail-closed (pipefail, `|| exit 1`); A1b pre-review Approve (0 Blocker/Major), its 3 Minors fixed, each new test bites; security + files.db 41, staging 148, tsc and eslint 0. **Needs the B security-engineer and DevOps (CI config)** |
| REQ-A-018 mock swap: drops the 3 paper-servability known-mismatch entries | `r1/reqa018-mock-swap` @ 0b774bd2 | A4 | C `r1/reqa018-paper-servability-fe` 8ad24143 (in base: BASE-146) | READY (A4, @ 0b774bd2 = 76511c9a + a merge of BASE-142; kept the base NO_* block, dropped NO_PAPER_SERVABILITY; contract-tests 22/22; stacked with C's reqa018-fe 8ad24143, mock conformance 2/2). **Binding was: merge AFTER C reqa018-paper-servability-fe (standalone it reds 3 entries); that FE is now in base (BASE-146)**, so the swap can merge; B2 small |
| REQ-B-069: the T31 pool lookup reads every page (cause: a pool page cap, not the Bab) | `r1/t31-pool-lookup-fixture` @ 2046a330 | A3 | T31 eb0346d2 / REQ-A-008 (merge right after them) | READY (A3, @ 2046a330, 2 test-only commits on T31 eb0346d2; every pool lookup in `builder-review.spec.ts` uses `poolUnits()`, which walks the pages; alone 26/26, the stack BASE-148 + reqa008 94880200 + the fix 32/32; mutation 3 red; doc-only conflict vs BASE-148, the deviations doc keeps both); B2 |
### 1.3 In progress, not pushed

| ID | Branch | Lane | Depends on |
|---|---|---|---|
None: every unit is pushed.

### 1.4 Docs units (A3 docs agent), all READY

| Unit | Branch @ head | Output |
|---|---|---|
| R1 release notes (BM) | `r1/ha24-release-input` @ 77b9d077 | `docs/release/r1-nota-keluaran.md` (written by dev-1 on this release-input branch) |
| R1 sign-off checklist (BM) | `r1/ha24-release-input` @ 77b9d077 | `docs/release/r1-signoff-checklist.md` (8 gates, Status column empty on purpose) |
| R1 KIV for R2 (BM) | `r1/ha24-release-input` @ 77b9d077 | `docs/release/r1-kiv-r2.md` (39 rows on ha24 77b9d077; rows 28 to 31 are the REQ-A-029 builder FE gaps, re-checked against BASE-109: Padam soalan and Semak partly done, Salin set done on the editor, the cross-Bahagian move still open; row 32 the FE-mock coverage scan; row 33 REQ-B-058; row 34 the accepted Q13 limit; row 35 no cross-attempt syiling/XP cap for T38 (Q14, REQ-B-059); row 36 the B3 Low on T48 setGroupLabel, no change in R1 by LEAD decision; row 37 PKSK applyStatus approves without the approve gate (B3 Info, KIV R2 by LEAD, deviation row on `r1/a2-carried-minors` @ 45f15242, `pksk.service.ts:232-237`; row 38 the T48 number-clash check in createQuestion compares only the new body.number (`builder.service.ts:1390-1391` on T45 ee3a7d2b), no change in R1 by LEAD; row 39 the split-VALIDATE pattern (a separate non-DO migration for an online constraint check; 43 ms vs about 0.4 s at 408k), no change in R1 by LEAD)) |
| R1 proposed BM copy table | `r1/ac-gaps-a1b` @ c2b93710 (and the BASE-151 docs pass on top) | `docs/qa/r1-proposed-copy.md` (38 [PROPOSED] strings for one-pass user approval; on ac-gaps) |
| T37 runbook | `r1/t37-r1-runbook` @ c9dcb5a0 | FROZEN, contained in `r1/ac-gaps-a1b` (B1 merges that instead); `docs/ops/r1-runbook.md` is edited only there |
| T39 K1 evidence | `r1/t39-k1-evidence` @ 1a26f7a6 | `docs/ops/r1-k1-blueprint-evidence.md` |
| T46 / H-A17 AC coverage | `r1/ha17-ac-coverage` @ 157b371c | FROZEN, contained in `r1/ac-gaps-a1b` (A1b owns `docs/qa/r1-backend-ac-coverage.md` now) |
| H-A19 admin parity | `r1/ha19-admin-parity` @ c7315b0e | `docs/qa/r1-admin-parity-check.md` |
| H-A20 student parity | `r1/ha20-student-parity` @ 557e17c6 | `docs/qa/r1-student-parity-check.md` |
| H-A22 parity docs | `r1/ha22-parity-docs` @ 4fb2a41b | both parity docs refreshed, deviation rows H22-D1/D2 in `v2-bijak-spm.md`, `student.md` rows marked |
| H-A23 E2E readiness | `r1/ha23-e2e-readiness` @ 9a86b5bb | `docs/qa/r1-e2e-readiness.md` (merge order, minimal set) |
| H-A24 release input | `r1/ha24-release-input` @ 77b9d077 | `docs/ops/r1-release-input-team-a.md` (merged at c0f7a45d as BASE-145; origin head 4335759e is 2 docs commits ahead; + scope AC-R1-18.2 and 18.4 text) |
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
| 0104 | `0104_paper_section_admin_created` | T48 (`r1/t48-builder-parity` @ 8d84f6ab) | merged BASE-148 (`c3098c9a`; the later head 10c62437, a merge of BASE-145 into it, was never merged); ACCESS EXCLUSIVE on `paper_sections` for milliseconds |
| 0105 | gate facts (BE-09 duplicate, media, AI-editor facts) | H-A18 (A2) `r1/ha18-gate-facts` @ a9ffe246 | merged BASE-132 (alone; the folder in base is byte-identical to a9ffe246; atomic (the file has a `DO` block) and not online: reads and writes wait for the whole file, 0.58 s cold / 0.35 s warm at 408k; the follow-up `r1/ha18-minors` @ 17450966 leaves 0105 byte-for-byte) |
| 0106 | `0106_question_stem_trgm` (pg_trgm and two GIN indexes) | admin-list-perf (A4) `r1/admin-list-perf` @ 69f465c8 | merged BASE-137 (B2 Approve w/ Minors, B3 Pass with Lows); maintenance window: SHARE lock, writes wait, reads do not, about 18 s at 408k; a file without a `DO` block is NOT atomic under Prisma 7.10.1; window procedure in the runbook 2.4 (REQ-B-066) |
| 0107 | `0107_question_paper_kertas_index` | same branch and head | merged BASE-137; about 1 to 2 s; same window; not atomic (no `DO` block) |
| 0108 | `feature_flags` | reserved (R1-B06) | no branch carries the folder |
| 0109 | `drop_pool_tag` | reserved; deferred to R2 by D92 | no branch carries the folder |
| 0110 | `0110_reference_image_tokens` | REQ-A-013 (team C) `r1/t34-l1-residual-c` @ a2acf754 | merged BASE-131 (one-off data fix, not reversible) |

Ranges: team A 0100 to 0109 (overflow 0120 to 0129), team C 0110 to 0119, team B none. Reservations (lead decision): 0104 T48, 0105 H-A18, 0106 and 0107 `r1/admin-list-perf` (A4), 0108 `feature_flags` (reserved), 0109 `drop_pool_tag` (reserved), 0110 team C (REQ-A-013, merged BASE-131); nothing in 0104 to 0110 is free. Any optional B12 or B20 migration goes to 0120 or above (the overflow range). SQL for 0092 to 0110 is in `docs/ops/r1-runbook.md`.

## 4. Open cross-team requests

Refreshed 2026-11-02 against `docs/team/requests/` on `team/r1-board@76b2aade`: `from-A.md`, `answers-A.md`, `from-B.md`, `answers-B.md`, and also `from-C.md` and `answers-C.md` (the requests to team C and from team C are answered there; `from-A.md` still says OPEN for several that `answers-C.md` shows DELIVERED). Answers files take precedence. A request file can lag the code: where the base merge subjects or MERGE-LOG (to BASE-151) show a unit merged, the row says so.

| Direction | IDs |
|---|---|
| Open for A (not delivered) | REQ-B-019, REQ-B-029, REQ-B-040, REQ-B-043, REQ-B-051, REQ-B-062 (A answered: the spec gets its own fixture, the seed stays as it is; `from-B.md` still OPEN), REQ-B-071 (answered under delegation, Q17: a Bab is NOT required to submit to Semakan, the DSKP refusal stays at Terbitkan (AC-03.2); A2 fixes it on `r1/reqb071-bab-submit`, not on origin yet; A3 updates the release notes (done on ha24, with the exact Terbitkan copy marked [PENDING A2]) and chain step 3a (not done yet); the FE shows the per-row refusal reason: REQ-A-041 to C), REQ-A-040 (C4: the bulk Terbitkan `skipped[]`, Q16, API branch `r1/r1e2e10-bulk-publish-noop` of A2), REQ-B-069 (cause: a pool page cap; fixed on `r1/t31-pool-lookup-fixture` 2046a330, merged right after T31), REQ-B-068 (DONE: T48 merged as BASE-148; was taken by A3, top priority: merge the latest BASE into T48 and restack the units behind it), REQ-B-067 (A1a: `r1/reqb067-etl-guards` d402fdf2, READY; both defects are real: the `realOf` guard bypass and the `stat -c` guard that fails open on BSD; needs the B security-engineer and DevOps), REQ-C-021 (IN-PROGRESS per answers-A; the backend is in base, BASE-102 and BASE-108), REQ-C-026, REQ-C-027 |
| Ready or fixed by A, waiting for B to merge or close | REQ-B-066 part: `r1/alp-comment-240` 84b0c3a9 (merge after admin-list-perf, now in base), REQ-B-058 (`r1/reqb058-takedown-pin` b1e96566 READY), REQ-B-059 (`r1/t38-cap-risk-row` ee421f52), REQ-B-070 (this sheet; B2 changes requested on edbf61ed, fixed at ca175679 and refreshed since), REQ-B-066 (the runbook 2.4 and the release-input number list are done on ac-gaps and ha24; the env.schema.ts:148 comment is `r1/alp-comment-240`), the ha18 follow-up (`r1/ha18-minors` 17450966, READY) |
| Delivered by A (answers-A DELIVERED; `from-B.md` or `from-C.md` may still say OPEN) | REQ-B-003, REQ-B-004, REQ-B-013, REQ-B-014, REQ-C-001, REQ-C-002, REQ-C-003, REQ-C-004, REQ-C-005, REQ-C-008, REQ-C-011, REQ-C-014, REQ-C-015, REQ-C-016, REQ-C-017, REQ-C-018, REQ-C-022 |
| Merged in base (the request files may still say READY or OPEN) | REQ-B-031 and REQ-B-046 (BASE-105), REQ-B-032 (BASE-109), REQ-B-022(a)(b), REQ-B-033, REQ-B-053 and REQ-C-020 (BASE-110, the A4 chain), REQ-B-025(c) (BASE-114), REQ-B-034 and REQ-B-035 (BASE-118), REQ-B-044 (BASE-119), REQ-B-025(a)(b) and REQ-C-019 (BASE-121, T49), REQ-B-049 (BASE-126), REQ-B-057, REQ-B-037 and REQ-B-017 (H-A18, BASE-132), REQ-C-012 (BASE-133), REQ-B-052 (BASE-134), REQ-C-009, REQ-C-010 and REQ-C-013 (BASE-92), REQ-A-018 route (BASE-136), REQ-B-050 and REQ-B-061 (admin-list-perf, BASE-137), REQ-B-060 and REQ-B-063 (BASE-138), drop-lock-enums (BASE-144) |
| Closed (done, declined, accepted risk) | REQ-B-005, REQ-B-006, REQ-B-007 (accepted risk), REQ-B-008, REQ-B-010, REQ-B-012, REQ-B-015, REQ-B-018, REQ-B-020, REQ-B-021, REQ-B-023, REQ-B-026, REQ-B-028, REQ-B-041, REQ-C-006 and REQ-C-007 (declined for A, done by C3), REQ-C-024, REQ-A-015, REQ-A-037 (superseded by C's own fix) |
| Open to B | REQ-A-017, REQ-A-024 with REQ-A-024b (the merge plan; A-024c and A-024d are the review and merge tables), REQ-A-028, REQ-A-033, REQ-A-039 (B2); accepted or in progress by B: REQ-A-007, REQ-A-009, REQ-A-011; delivered by B: REQ-A-001 |
| Open to C (OPEN or not yet answered) | REQ-A-023b, REQ-A-026b |
| Accepted or in progress by C | REQ-A-004, REQ-A-022, REQ-A-023, REQ-A-029 (narrowed), REQ-A-030, REQ-A-031, REQ-A-032, REQ-A-035, REQ-A-036, REQ-A-038; taken by C: REQ-A-025, REQ-A-027 (extended for REQ-B-061) |
| Team A side done, C to consume | REQ-A-018 and REQ-A-026 (the route is in base, BASE-136, and C's FE `r1/reqa018-paper-servability-fe` 8ad24143 is in base, BASE-146; `r1/reqa018-mock-swap` 0b774bd2 can merge now) |
| Delivered or merged on C's side | REQ-A-002, REQ-A-003, REQ-A-005, REQ-A-006, REQ-A-008 (C's `r1/reqa008-group-stimulus` carries T31), REQ-A-010, REQ-A-012, REQ-A-016, REQ-A-034 (answers-C 08:45); in base: REQ-A-013 (BASE-131, with 0110), REQ-A-014 (BASE-127), REQ-A-019 (team A side BASE-120), REQ-A-020 (BASE-129), REQ-A-021 (the T47 UI, BASE-130) |
| Raised between B and C, not A | open or in progress: REQ-B-072 (C3, mock vs real delete guard), REQ-B-073 (C4, the dead Retry-After branch), REQ-B-042, REQ-B-045, REQ-B-047, REQ-B-055, REQ-B-056, REQ-B-064, REQ-B-065; delivered: REQ-B-054 (BASE-106), REQ-B-060 and REQ-B-063 (answers-C 08:45, READY-FOR-REVIEW); in base: REQ-B-036 (BASE-128), REQ-B-048 (BASE-127); closed: REQ-B-001, REQ-B-002, REQ-B-009, REQ-B-011, REQ-B-016, REQ-B-024, REQ-B-027, REQ-B-030, REQ-B-038, REQ-B-039; REQ-C-023 (done, BASE-79), REQ-C-025 (open to B) |

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
| **T34 is in base (BASE-101); its stack is not.** T34 merged as `r1/t34-builder-review-c` @ 05451810 (team A T34 5bb590d0 fixed by team C, Disahkan gate kept, fixtures serve seeded blueprints). A3's `r1/t34-l1-residual` (e4bb72eb) is SUPERSEDED by team C's `r1/t34-l1-residual-c` (REQ-A-013), which merged as BASE-131 with migration 0110. Board state (BOARD AUDIT, BASE-151): H-A18 (BASE-132, merged alone), REQ-C-012 (133), REQ-B-052 (134), D72 (135), the REQ-A-018 route (136), admin-list-perf (137, migrations 0106 and 0107), the chain QA units (139 to 141), the D90 Kuiz sweep (142), the R1-10.1 practice spec (143), drop-lock-enums (144), the H-A24 docs (145), the REQ-A-018 FE (146), the hub (147), **T48 (148, @ 8d84f6ab)**, delete-served-guard (149), the Lapor FE (150) and REQ-A-025 (151) are all in base. The T48 dependents (T43b, d90-builder-sweep, label-move-fix, builder-search-perf, T45 Part 3, minors-t45, T51, partial-acs, minors-kbat) are clean against BASE-148; T31, T43 and `r1/t31-pool-lookup-fixture` have a doc-only conflict (the deviations doc, keep both). T51, partial-acs and minors-kbat were red on the REQ-B-069 test (a pool page cap); `r1/t31-pool-lookup-fixture` fixes it and merges right after T31. T31 (eb0346d2) is an ancestor of C's reqa008 f85db8ff. The proven B1 order is in `docs/ops/r1-release-input-team-a.md` section 3.5 (A4 preview #3, REQ-A-024). T10 and hc-builder-parity (team C) restack on BASE-101; REQ-A-008 follows T31. | Order: T31 / T48 / T43 each merge BASE-101 first (`questions.module.ts` and the deviations doc conflict as union). Do not push to `r1/t34-builder-review`. |
| **0103 attempt FK.** `fk_question_reports_attempt_id` is NOT VALID on purpose. | Never run `VALIDATE CONSTRAINT` in the release. |
| **Lapor (REQ-B-031, REP-M1).** The server guard merged as BASE-105 (B2 Approve w/ Minors, B3 Pass with Lows); REQ-B-049 is in base since BASE-126 (B2 Approve w/ Minors, B3 Pass with Lows; REP-N1 residual open). The Lapor FE (`r1/reqa005-bijak-lapor`, team C) can proceed. | A1 + team C. |
| **Branch heads move.** Several READY heads changed after their last B verdict. | A head that moved after review is not merged until B reviews the delta. |
