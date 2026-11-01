# R1 team tracker (central board)

Public link: https://github.com/amin-kerja-orang/prestasiplus/tree/team/r1-board/docs/team

This branch (`team/r1-board`) holds ONLY the tracker. It has no shared history with the code and must never be merged into any code branch.

## Teams and lanes

Three Claude accounts work in parallel. Each runs one **lead session** that keeps four **developer lanes** busy. Account codes are used instead of personal names (privacy rule).

| Team | Role | Lanes | Owns |
|---|---|---|---|
| **A** | Delivery Lead + backend core | A1–A4 | BOARD.md, QUESTIONS.md, decisions D91+, backend: lifecycle, bridges, servable/spmPool specs, Jana Kertas, question model, secondary-only guard |
| **B** | Integrator, review, QA, release | B1–B4 | The ONLY team that merges into `feature/v3-bijak-r1`. MERGE-LOG.md, TRACKER.md change log, G4 reviews, security review, E2E QA, release runbook. The human owner of team B deploys; no AI session ever deploys. |
| **C** | Frontend + full-stack slices | C1–C4 | Set Builder / Semak Kertas UI, Simulasi Kuiz (BE+FE), Studio with D90 groups, student bug fixes, `src/shells/pentadbiran/menu.ts` (C1 only) |

## Files and who may edit them (no two writers per file)

| File | Writer |
|---|---|
| `BOARD.md` | Team A lead only |
| `QUESTIONS.md` | Team A lead only (other teams raise questions in their status file) |
| `MERGE-LOG.md` | Team B lead only |
| `status/<lane>.md` | That lane's team lead only (e.g. `status/C2.md` by team C) |

Before every push: `git pull --rebase origin team/r1-board`, then push. Retry once on rejection. Because every file has one writer, a rebase never conflicts.

## Cross-team requests

Ask another team for work through `requests/` (git inbox), not chat: append a `REQ-<team>-<nnn>` row to your own `requests/from-<team>.md`; the addressed team answers in `requests/answers-<team>.md`. Every lead reads all request files each cycle. See [requests/README.md](requests/README.md).

## Task lifecycle (status values)

`QUEUED → IN-PROGRESS → READY-FOR-REVIEW → CHANGES-REQUESTED ↔ READY-FOR-REVIEW → APPROVED → MERGED → VERIFIED-E2E`
Also `BLOCKED (reason)` and `WAITING (dependency)`.

## Branch rules

- Base: `feature/v3-bijak-r1`. Each task: `r1/tNN-<slug>` (or the existing WIP branch named on the board).
- Never commit to `main`. Never merge into `feature/v3-bijak-r1` unless you are team B lane B1.
- After each B1 merge, MERGE-LOG.md gets a new `BASE-n` line. Lanes with open branches merge the new base into their branch (merge, not rebase, since branches are already pushed).
- Migration number ranges (to avoid collisions): team A 0100–0109, team C 0110–0119. Team B creates no migrations.
- `docs/TRACKER.md` is edited only by B1 in merge commits (change log) and by team A in decision PRs (D91+). Feature branches do not touch it.

## READY-FOR-REVIEW evidence (all required, pasted into the status file)

1. Branch + commit SHA, merged with the latest BASE.
2. `npx tsc --noEmit` (apps/api) and/or `npx vue-tsc --noEmit -p tsconfig.app.json`: exit code + error count.
3. `npx eslint <changed files>`: result.
4. Targeted tests: exact command + pass/fail counts.
5. Flags: touches auth / files / new input? (yes → security review needed).
6. V2 behaviour cited (discovery doc + section) and fidelity-deviation rows added, if any.


## Record rule (all teams; team A applies it from 2026-11-01) (user, 2026-11-01, effective now)
"Jangan ada yang buat kerja cuai, mana-mana team sekalipun."
1. **READY = record in the same round.** A unit is READY only when, in one round, (a) the branch is pushed, (b) its BOARD row carries the real head, and (c) every related REQ row in requests/answers-A.md carries status + head + base. A message alone does not make a unit READY. Lanes A2–A4 and subagents do not write the tracker; they send READY to the lead, and the lead writes BOARD + answers-A.md **before** acknowledging or forwarding it.
2. **Head changed = record changed.** Every new push to a READY branch updates its head in BOARD and answers-A.md in the same round.
3. **Check before reporting.** Before reporting READY, run `git ls-remote origin <branch>` and `git show origin/team/r1-board:docs/team/requests/answers-A.md | grep <REQ>`. Branch, BOARD and answers-A must match.
4. **No stale records.** At the start of every cycle, the lead checks every READY/IN-PROGRESS head in BOARD and answers-A.md against origin and fixes any mismatch.
5. Teams B and C are asked to apply the same rule (REQ-A-017).
