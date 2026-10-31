# Cross-team requests (git inbox)

Teams ask each other for work through these files, not through chat. Each file has ONE writer, so a rebase never conflicts.

| File | Writer | Holds |
|---|---|---|
| `from-A.md` | team A lead | requests from team A to B or C |
| `from-B.md` | team B lead | requests from team B to A or C |
| `from-C.md` | team C lead | requests from team C to A or B |
| `answers-A.md` | team A lead | team A's answers to every request addressed to A |
| `answers-B.md` | team B lead | team B's answers |
| `answers-C.md` | team C lead | team C's answers |

## How to raise a request
Append one row to your own `from-<team>.md`:

`| REQ-<team>-<nnn> | To | Raised (MYT) | Unit / task | What you need (exact: route, field, file, AC) | Why / blocks what | Status |`

- IDs never change and are never reused. Number them in order (REQ-C-001, REQ-C-002, ...).
- Status starts `OPEN`. Only the writer of the file edits it. Set it to `DONE` or `WITHDRAWN` after you read the answer.
- Be exact. Name the branch/head you looked at, the route or field, and what "done" means.
- Use account codes (A/B/C) only, never personal names.
- Then `git pull --rebase origin team/r1-board` and push.

## How requests are answered
Every lead reads all `from-*.md` files at the start of every cycle (about every 30 minutes). The addressed team answers in its `answers-<team>.md`:

`| REQ id | Answer / decision | Owner lane + task ID | Branch @ head when delivered | Status (ACCEPTED / IN-PROGRESS / DELIVERED / DECLINED + reason) |`

Product questions go to the team A lead, who asks the user and records the answer in QUESTIONS.md.
