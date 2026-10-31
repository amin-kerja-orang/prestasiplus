# Merge log (writer: team B lead)

| BASE | Commit on feature/v3-bijak-r1 | Merged unit | Re-run evidence on merge result | When (MYT) |
|---|---|---|---|---|
| BASE-1 | 14e4336c | handoff start | — | 2026-10-31 |
| BASE-2 | 5e856b5d | T01 `r1/t01-base-merge` @ 09d32822 (B2 Approve) | api tsc 0; vue-tsc 0 (after full `vite build` for components.d.ts); registry-boot 3/3; m04+m28+m11 unit 1186 pass / 3 expected-fail; api specs bijak-question-bridge+bijak-papers+bijak-integration+files 476/476 | 2026-10-31 |
| BASE-3 | 285387a3 | T03 `r1/b08-bridge` @ 7050f2d7 (B2 Approve, B3 Pass) | api tsc 0; vue-tsc 0; registry-boot+m28 unit 475/475; api specs bijak-question-bridge+bijak-integration+files+bijak-kuiz+bijak-papers 534/534 | 2026-10-31 |
| BASE-4 | c8991ddb | T04 `r1/b01-lifecycle` @ 3cbc9092 (B2 Approve, B3 Pass; migration 0100) | api tsc 0; contract:check ok; vue-tsc 0; unit registry-boot+packages+m04+m28 129 files 2566/2566; api specs migration-0100+approved-servable+files+bijak-question-bridge+bijak-kuiz+exam-builder+questions-workflow 51 files 941/941. Branch lacked BASE-3 only as 2 TRACKER lines (code-identical, B2-checked) | 2026-10-31 |
| BASE-5 | da381624 | T05 final `r1/t05-db-specs` @ 37770b77 (B2 Approve; test-only) | api tsc 0; servable-counts, assignments-adapter, practice-question-source, battle/lobby, spm, golden, seed/poc + all changed specs: 23 files 291/291 | 2026-10-31 |
| BASE-6 | 21ae62dd | T24 `r1/t24-release-notes` @ a3fb712c (B2 Approve r3; docs only) | docs-only diff (docs/ops/r1-release-notes.md) | 2026-10-31 |
| BASE-7 | b8c92619 | H-A11 `r1/ha11-school-scope` @ 91432622 (B2 Approve, B3 Pass; test-only; head tree = reviewed trial merge on BASE-6) | sampled-domains 34/34 | 2026-10-31 |
| BASE-8 | baad88b7 | T27 `r1/t27-darjah-refusal` @ 3cf53190 (B2 Approve, B3 Pass; head tree = reviewed trial merge on BASE-6) | api tsc 0; primary-level-refused + blueprint-primary-unit + questions/service + secondary-only-counts + questions-workflow 23 files 285/285 | 2026-10-31 |
| BASE-9 | e5480fd4 | T07 `r1/t07-model-gaps` @ b0421c6b (B2 Approve w/ Minors, B3 Pass) | api tsc 0; contract:check 0; vue-tsc 0; unit registry-boot+contract+m28 1892/1892; api stimulus-display+exam-builder+bijak-question-bridge+bijak-kuiz 464/464 | 2026-10-31 |
| BASE-10 | 3ded770e | T08 `r1/t08-secondary-guard` @ 7a3f754c (B2 Approve w/ Minors, B3 Pass) | api tsc 0; contract:check 0; api secondary-only-bijak+bijak-pool+exam-builder+bridge+kuiz+practice-question-source+practice 786 pass / 1 skip | 2026-10-31 |
| BASE-11 | 7ba5a589 | T28 `r1/t28-bijak-rewards` @ 54c17c4d (B2 Approve, B3 Pass) | api tsc 0; contract:check 0; bijak-integration+bijak-attempts 224/224 | 2026-10-31 |
| BASE-12 | bcce5e7b | H-A2 `r1/ha2-reports-darjah` @ 38d57846 (B1-as-reviewer Approve) | api tsc 0; contract:check 0; classes+reports+remedial+missions 741 pass / 11 skip; teacher-classrooms-lookup.spec fails = pre-existing on BASE-8 (H-A8) | 2026-10-31 |
| BASE-13 | 7194b411 | R1E2E-01 `r1/e2e01-intake-subject` @ dbf524de (B1-as-reviewer Approve, B3 Pass) | api tsc 0; contract:check 0; intake-workflow+intake-files 262/262 | 2026-10-31 |
| BASE-14 | 70971776 | T32 `r1/t32-stimulus-api` @ 87a9a363 (B2 Approve w/ Minors, B3 Pass) | api tsc 0; contract:check 0; vue-tsc 0; api test/questions+question-bank-stimuli+bijak-question-bridge 848/848; unit registry-boot+m04 477/477 | 2026-10-31 |
| BASE-15 | d21f9d45 | T25 `r1/t25-essay-choice-store` @ e14f4f91 (B2 Approve w/ Minors, B3 Pass; **migration 0101_essay_choice**) | api tsc 0; contract:check 0; essay-choice-store+stimulus-display+migration-0100+secondary-only-bijak+exam-builder+bijak-question-bridge+bijak-attempts 633/633 | 2026-10-31 |
| BASE-16 | 8cd98979 | H-A7 `r1/ha7-essay-choice-flat-view` @ d7424ace (B2 Approve w/ Minors, B3 Pass) | api tsc 0; contract:check 0; essay-choice-flat-view+store+crud+service+questions-workflow 297/297 | 2026-10-31 |
| BASE-17 | 8e8812ed | T06 `r1/t06-jana-standard` @ 4349bb00 (B1-as-reviewer Approve w/ Minors) | api tsc 0; contract:check 0; bijak-papers+secondary-only-bijak+builder-placements 132/132 | 2026-10-31 |
| BASE-18 | 65d0d067 | T35 `r1/t35-report-archive` @ 4ea790b1 (B2 Approve, delta B1-as-reviewer; B3 Pass) | api tsc 0; contract:check 0; report-archive+questions-workflow+bijak-papers 362/362 | 2026-10-31 |
| BASE-19 | 823d8dfb | T05 minors `r1/t05-minors` @ 99dd5fef (B1-as-reviewer Approve; test-only) | api tsc 0; servable-counts+assignments-adapter 15/15 | 2026-10-31 |
| BASE-20 | 4004a071 | T14 `r1/t14-student-bugs` @ 1903b713 (B2 Approve) | api tsc 0; contract:check 0; vue-tsc 0; bijak-attempts 173/173; unit m05+m06+m28+exam-core 1255/1255 | 2026-10-31 |
| BASE-21 | a6ff0c0d | T15 `r1/t15-bm-copy` @ 09eabe2e (B2 Approve; docs/comments) | api tsc 0; contract:check 0; unit m28 474/474 | 2026-10-31 |
| BASE-22 | e28e4f5c | T13 `r1/t13-studio-groups` @ 114173c9 (B2 Approve w/ Minors, B3 Pass) | api tsc 0; contract:check 0; vue-tsc 0; DB studio/stimulus/intake 318/318; unit registry-boot+m04+m28 admin+stores 581/581 | 2026-10-31 |
