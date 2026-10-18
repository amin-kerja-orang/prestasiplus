# Agent sync rules (one page)

Every backend agent on every PC follows this page. Re-read it from `origin/feature/v2-backend` at the start and end of each session. Details: [sessions.md](sessions.md) section 6.

> **Standing rule for every PC and every session: commit, push and update the shared records regularly.**
> - **Commit** after every green step.
> - **Push** at least every hour and before the session stops.
> - **With every push, update the shared records of your card:**
>   - the tracker row (status, notes);
>   - the PR description (done / left, real `be:verify` output);
>   - any doc the card changes (deviations, mapping-matrix rows).
>
> Other PCs and the LEAD see only what is on GitHub.

## 0. The LEAD is the central guide

- The **LEAD** is the project owner's own PC and Claude Code session. It is the single central source of instructions for every PC and session. Other PCs never decide programme matters themselves.
- Order of authority: **(1) Lead notices below and open GitHub issues labelled `lead`**, then (2) this page, then (3) the lane prompt of your card (`agent-kickoff/PC-n.md`), then (4) the card file. On any conflict the higher one wins. In particular, a lane prompt's "YOUR LANE" does **not** bind a PC to that lane: section 1 decides which card you take.
- Only the LEAD edits this page, [sessions.md](sessions.md), [agent-kickoff/](agent-kickoff/README.md), the card files and the tracker's Summary and Change log. PCs edit only the tracker rows of cards they hold.
- Questions, blockers and change requests go to the LEAD as a GitHub issue (label `question`, `blocked`, `contract` or `cross-lane`). Do not wait idle: take the next card.

### Open list (the LEAD controls what may start)

A PC may claim **only** cards listed here. A card that is not listed is closed, even if it looks ready. The LEAD adds and removes rows. A row gives the mode:

| Mode | Meaning |
|---|---|
| `full` | The whole card, normally. Section 1 applies (dependencies must be `done`). |
| `contract-only` | Only the wire contract of the card: zod schemas, contract tests and the `openapi.ts` registration. Edit only in `packages/contract/src/<card's domain>/**`. This mode may start before the card's dependencies are done. Branch `be/<card-id>-contract`, PR label `contract`, tracker note "contract only". After the LEAD merges it, the card goes back to `todo` with the note "contract merged", and any PC can later take the full card. |

| Card | Mode | Opened | Note |
|---|---|---|---|
| BE-01 | full | 2026-10-19 | Scaffold + CI; first card on the critical path. |
| BE-05 | contract-only | 2026-10-19 | Users and schools: `packages/contract/src/{users,schools}/**`. |
| BE-08 | contract-only | 2026-10-19 | Curriculum: `packages/contract/src/curriculum/**`. |
| BE-09 | contract-only | 2026-10-19 | Question bank core: `packages/contract/src/questions/**`. |
| BE-11 | contract-only | 2026-10-19 | Wallet and streak: `packages/contract/src/wallet/**`. |
| BE-12 | contract-only | 2026-10-19 | Practice write path: `packages/contract/src/practice/**`. |

Rules for `contract-only`:
- The frontend mock is the spec: match the mock handlers' request and response shapes, error codes and BM messages exactly.
- Run `npm run contract:check` and `npm run contract:emit`.
- Never edit `packages/contract/src/{common,session,auth,access}/**`; those belong to the LEAD.

### Lead notices (current instructions; newest first)

- 2026-10-19: **Start now; do not wait for perfect docs.** Take cards only from the Open list above. If `docs/requirements/v2-backend-urs.md` or `docs/plan/backend-dev-guide.md` is not on the branch yet, follow `docs/architecture/v2-backend-plan.md` and the card file. Once they land, re-read them at your next session start.

- 2026-10-19: **S0 is open, start now.** Defaults in force until the LEAD says otherwise:
  - Stack: NestJS 11 + Prisma + Vitest (OD-3).
  - The LEAD reviews and merges every PR (OD-12).
  - Any number of PCs may join; there is no fixed PC-to-lane split (section 1).
  - What may start is set only by the Open list.
  - When the Open list has nothing free for you, stop and report `idle`; the LEAD opens more cards as merges land.

## 0b. Any number of PCs

- There is no fixed number of PCs and no fixed PC-to-lane split. Every PC **pulls** the next ready card from the whole tracker (section 1). A PC can join or leave at any time; a new PC only needs the setup in [agent-kickoff/README.md](agent-kickoff/README.md) section 1.
- **PC name (automatic):** the agent names its PC itself: `pc-` plus the computer name in lower case (run `hostname`, e.g. `pc-desktop-7h2k`). It writes the tracker Owner as `<pc-name>/S<n>` (n = session number on that PC). Nobody has to choose a name.
- **Lanes are file-ownership groups, not people.** The lane of a card (tracker column `Lane`) tells you which lane prompt to read and which folders you may edit while you hold that card.
- More PCs help only while there are ready cards. When none is ready, a PC does the "blocked" work of [sessions.md](sessions.md) section 2 or stops and reports `idle`.

## 1. Start of session: find your task

```
git fetch origin --prune
git switch feature/v2-backend && git pull --ff-only
gh pr list --base feature/v2-backend --state open --json number,title,headRefName,isDraft
gh issue list --label lead --state open      # LEAD instructions: do what applies to you first
```

1. **Unfinished card of yours first:** if this PC already holds a card (its branch or draft PR, Owner = your PC name), continue it.
2. Otherwise open [backend-tracker.md](backend-tracker.md) **on `origin/feature/v2-backend`** and list the cards that are **ready**:
   - listed in the **Open list** (section 0); `contract-only` rows skip the dependency check below;
   - status `todo`, and no open PR or `origin/be/<card>-*` branch exists for it (that would mean it is taken);
   - every card in `Depends on` is `done`;
   - **no clash:** no card currently `in-progress` or `review` in the same lane touches the same module folder or Prisma file (check the "Files" or scope section of both card files). Two cards of one lane may run in parallel only when neither depends on the other and their files do not overlap (example: BE-08 curriculum and BE-11 wallet).
3. Take the ready card with the **highest priority** (P0, then P1, then P2); on a tie, the one that unblocks the most other cards (the most cards list it in `Depends on`); then the lowest card number.
4. Read the lane prompt of that card's lane (`agent-kickoff/PC-n.md`, where `PC-n` is the `Lane` column) for its folders, rules and verification, then the card file.

## 2. Claim it immediately (before writing code)

```
git switch -c be/<card-id>-<slug> origin/feature/v2-backend
# set the card's tracker row: Status in-progress, Owner <pc-name>/S<n>, Branch
git commit -am "chore(<card-id>): claim card" && git push -u origin HEAD
gh pr create --draft --base feature/v2-backend --title "<card-id>: <title>" --label lane:PC-n --body-file <template>
```

**The draft PR is the claim.** Other PCs see it within seconds. If `git push` says the branch already exists, someone claimed it first: delete your local branch and go back to section 1.

## 3. While working: commit and push often

- **Commit** after each green step (contract, schema/migration, service, tests). Message: `<type>(<card-id>): <what>`, e.g. `feat(BE-08): curriculum tree endpoint`.
- **Push** at least **every hour** and **always before the session ends** (`git push`, or `git push --force-with-lease` after a rebase, own branch only). Unpushed work does not exist for other PCs.
- **Rebase** on `origin/feature/v2-backend` at the start of each day, before marking the PR ready, and whenever the LEAD announces a merge: `git fetch origin && git rebase origin/feature/v2-backend`. Conflicts: [sessions.md](sessions.md) sections 5 and 6 (regenerate `openapi.json` with `npm run contract:emit`, never hand-merge it).
- Edit only the folders of your card's lane (its lane prompt) plus the append-only shared files listed there.
- Never commit secrets, `.env.*`, dumps, real data or `.migration-out/`.

## 4. End of session (always, even if unfinished)

1. `npm run contract:check && npm run be:verify`, and paste the real output into the PR.
2. Update the card's tracker row on your branch: `in-progress` (unfinished), `review` (verify green, PR marked ready with `gh pr ready`) or `blocked` (one-line reason, plus a GitHub issue labelled `blocked`).
3. Commit and push. Nothing may be left only on this PC.
4. Report in 5 lines (to the PC owner, and as a PR comment if the LEAD must act): card, status, PR link, what is left, any question for the LEAD.
5. Leaving the programme for good, or handing a card over? Push, set the Owner to `-` and status to `todo`, and comment "released" on the PR so another PC can continue the same branch.

## 5. Never

- Push to `main`, `feature/student-prototype`, `feature/v2-backend` or `v2/*`; merge any PR (the LEAD merges).
- Work on a card another PC holds; edit another lane's folders, `src/**`, `e2e/**` or `docs/TRACKER.md` (open a `cross-lane` or `contract` issue instead).
- Ask for or use credentials, the .cloud database or real people's data.
