# R1 AC ledger

The ledger is the record of **which acceptance criteria (ACs) and end-to-end chains (AC-CHAIN-n) passed or failed, where, when and by whom**. It is the measure of progress ("ACs passing / ACs planned", plan section 5A). Working rules: [R1-START-HERE.md](R1-START-HERE.md) (decision 4). Codes: [00-index "Codes in plain words"](../prd/r1/00-index.md#codes-in-plain-words).

## Who writes rows

| Env | Who writes the row | When |
|---|---|---|
| **CI** | The card's own team (the session that opened the PR). | In the card's PR, for every AC tagged `[CI]` or `[CI+UAT]`. One row per AC with the name of the automated test in the evidence column. |
| **UAT** | The card's team, acting as the UAT tester (it runs the ACs in a visible browser with the shared test accounts). | After the designated UAT developer posted, in #503, a deployed commit that contains the card's merge. One row per AC, and one row per AC-CHAIN-n that passes through the card. |

- A row is added or updated by a **docs-only PR** (touches only `docs/plan/r1-ac-ledger.md`; no card ID needed; no scope guard). When two PRs conflict on this file, rebase and keep both rows.
- A card moves to `status:done` only when every one of its ACs has a **Pass** row for the env it is tagged with (`[CI]` -> CI, `[UAT]` -> UAT, `[CI+UAT]` -> both). **A Fail row re-opens the card** (`status:in-progress`); when the fix is deployed, a new row is added below the Fail row (rows are never deleted or edited into a pass). The card's team lead sets `status:done` when every AC has its Pass row; the Delivery Lead samples Pass rows each sprint and may re-open a card with a new Fail row.

## Columns

| Column | Content |
|---|---|
| card | the card ID, for example `S1-T01` |
| AC / AC-CHAIN ID | the AC ID from the PRD (`AC-ADM-QE1.2`) or `AC-CHAIN-1` (one row per AC; do not write wildcards) |
| env | `CI` or `UAT` |
| result | `Pass` or `Fail` |
| date | `YYYY-MM-DD` |
| team/session | `<team>/S-<k>`, for example `team-amin/S-2` |
| evidence ref | **the name only** of a local `.evidence/` path (for example `.evidence/S1-T01/375-studio-wizard.png`) or the automated test name (`stimuli.service.spec.ts`). Never a link, never an uploaded file. |

Example of one row (format only; this is not a result):
`| S1-T01 | AC-ADM-QE1.2 | CI | Pass | 2026-11-10 | team-amin/S-2 | stimuli.service.spec.ts |`

## Privacy rules

- UAT holds real pupil data. **No person name, e-mail, phone, IC number, credential or server address** in this file. Evidence stays on the local machine in `.evidence/` (gitignored) and only its path name is written here.
- For a Fail, write the failing step in the PR or the issue comment in plain words and the AC ID, never the data that was on the screen.

## UAT test records (AC-CHAIN steps and any AC that needs data)

- Test records are created **on the dedicated test school** with the team's own test accounts, through the UI.
- Every record carries the prefix **`UJI <team> <date>`** in its name or title (`UJI team-amin 2026-11-10 Rajah 3`).
- The **creating team removes its records through the UI the same day** after the run (also after a Fail, once the failing step is written down). The test accounts themselves are kept.
- Anything left behind is reported by the team lead in #503 and removed by the creating team. At the end of each sprint the designated UAT developer lists records with the prefix `UJI ` and removes the leftovers as part of U-OP-14 (plan section 7 runbook).
- Never create records on a real school, never edit or delete a record that does not carry the team's prefix.

## Slice 0

During Slice 0 (plan section 5A) the UAT deploy is made on request. The team lead asks the designated UAT developer in #503; the rows are written in the same way.

## Sprint 0

| card | AC / AC-CHAIN ID | env | result | date | team/session | evidence ref |
|---|---|---|---|---|---|---|

## Sprint 1

| card | AC / AC-CHAIN ID | env | result | date | team/session | evidence ref |
|---|---|---|---|---|---|---|

## Sprint 2

| card | AC / AC-CHAIN ID | env | result | date | team/session | evidence ref |
|---|---|---|---|---|---|---|

## Sprint 3

| card | AC / AC-CHAIN ID | env | result | date | team/session | evidence ref |
|---|---|---|---|---|---|---|

## Sprint 4

| card | AC / AC-CHAIN ID | env | result | date | team/session | evidence ref |
|---|---|---|---|---|---|---|

## Sprint 5

| card | AC / AC-CHAIN ID | env | result | date | team/session | evidence ref |
|---|---|---|---|---|---|---|

## Sprint 6

| card | AC / AC-CHAIN ID | env | result | date | team/session | evidence ref |
|---|---|---|---|---|---|---|

## Sprint 7

| card | AC / AC-CHAIN ID | env | result | date | team/session | evidence ref |
|---|---|---|---|---|---|---|

## Sprint 8

| card | AC / AC-CHAIN ID | env | result | date | team/session | evidence ref |
|---|---|---|---|---|---|---|

## Sprint 9

| card | AC / AC-CHAIN ID | env | result | date | team/session | evidence ref |
|---|---|---|---|---|---|---|
