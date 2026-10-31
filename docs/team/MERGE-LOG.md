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
