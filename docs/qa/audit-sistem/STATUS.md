# System audit, screen by screen â€” STATUS

- **Last updated:** 2026-10-24
- **Base code SHA:** `3e192a7a46971adc07e27ac6add2036468bf2602` (`feature/student-prototype`, also on `origin/feature/student-prototype`)
- **Feedback branch:** `audit/sistem-2026-10-23` (this file)
- **Fix branch (cloud):** claude/determined-dijkstra-ju5q60 — verified at 4469dc02 (see VERIFY.md)
- **Current screen:** Verification + user answers done (2026-10-24). Design-system conformance audit (all screens) in progress — will be added as a new report.

## Reports

- [BIJAK-SPM-AUDIT-REPORT.md](BIJAK-SPM-AUDIT-REPORT.md) â€” consolidated old vs new matrix (audit findings only, no approved fixes).
- [BIJAK-SPM-STUDENT-AUDIT-REPORT.md](BIJAK-SPM-STUDENT-AUDIT-REPORT.md) â€” student-scope old vs new report (audit findings only, no approved fixes).
- [BIJAK-SPM-PARITY.md](BIJAK-SPM-PARITY.md) â€” detailed code/doc parity matrix with file:line citations.

## How to read this folder

- `screens/S-<nnn>-<role>-<slug>.md` â€” one file per screen, with `FB-<nnn>` items (Status: Open â†’ Fixed/Verified/Reopened).
- `screens/img/` â€” evidence screenshots.
- `VERIFY.md` â€” local verification results of cloud fixes.

## Screens

| S | Role | Route | Status | FB count |
|---|---|---|---|---|
| â€” | â€” | â€” | â€” | â€” |

## Open questions

- None yet.

## Verification and answers summary (2026-10-24)

- **Verified:** 36 of 38 Fixed items (see VERIFY.md).
- **Reopened (2):** FB-023 (bank stat sub text "… Terbit · … menunggu semakan" not rendered in compact tiles); FB-047 (keypad drawn over the edited field and under the footer from 768 on short viewports, e.g. 1280x700).
- **Answered:** every Need-info / Planned item now has a decision in ANSWERS.md — explicit user answers for FB-024, 025, 026 (6 sub-questions + KBAT), 037, 039, 040, 041, 042, 045 (+ new WYSIWYG math input request), 048 (rule per mode), 051 (1), 059 (user requirement: read Arahan before Mula), 060, 063, 064 (show both versions first), 065; lead decisions on the user's delegation for FB-011, 039, 042, 056, 059; and the user's blanket rule "convert from the old system and fix what is broken, do not redesign" for all remaining items (FB-038, 051 (2), 027–036, 062, 066–068).
- **Still open with the user:** FB-064 (choose after seeing the compact vs current versions), FB-045 WYSIWYG input (cloud to propose scope first), FB-040 (confirm the paper-type mapping table), FB-042 (confirm the Tracking A data → label mapping), KBAT field form (cloud proposes).
- **New user observation:** UI components inconsistent / not using the design system (custom classes) — fix on all screens; per-screen DS audit in progress.