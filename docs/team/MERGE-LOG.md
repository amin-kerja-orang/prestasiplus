# Merge log (writer: team B lead)

| BASE | Commit on feature/v3-bijak-r1 | Merged unit | Re-run evidence on merge result | When (MYT) |
|---|---|---|---|---|
| BASE-1 | 14e4336c | handoff start | — | 2026-10-31 |
| BASE-2 | 5e856b5d | T01 `r1/t01-base-merge` @ 09d32822 (B2 Approve) | api tsc 0; vue-tsc 0 (after full `vite build` for components.d.ts); registry-boot 3/3; m04+m28+m11 unit 1186 pass / 3 expected-fail; api specs bijak-question-bridge+bijak-papers+bijak-integration+files 476/476 | 2026-10-31 |
| BASE-3 | 285387a3 | T03 `r1/b08-bridge` @ 7050f2d7 (B2 Approve, B3 Pass) | api tsc 0; vue-tsc 0; registry-boot+m28 unit 475/475; api specs bijak-question-bridge+bijak-integration+files+bijak-kuiz+bijak-papers 534/534 | 2026-10-31 |
