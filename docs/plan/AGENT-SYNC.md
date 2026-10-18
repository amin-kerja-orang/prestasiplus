# Agent sync rules (one page)

Every backend agent on every PC follows this page. Re-read it from `origin/feature/v2-backend` at the start and end of each session. Details: [sessions.md](sessions.md) section 6.

## 0. The LEAD is the central guide

- The **LEAD** is the project owner's own PC and Claude Code session. It is the single central source of instructions for every PC and session. Other PCs never decide programme matters themselves.
- Order of authority: **(1) Lead notices below and open GitHub issues labelled `lead`**, then (2) this page, then (3) your lane prompt (`agent-kickoff/PC-n.md`), then (4) the card file. On any conflict the higher one wins.
- Only the LEAD edits this page, [sessions.md](sessions.md), [agent-kickoff/](agent-kickoff/README.md), the card files and the tracker's Summary and Change log. Lanes edit only their own tracker rows.
- Questions, blockers and change requests go to the LEAD as a GitHub issue (label `question`, `blocked`, `contract` or `cross-lane`). Do not wait idle: take the next unblocked card.

### Lead notices (current instructions; newest first)

- 2026-10-19: Current setup is **3 PCs + LEAD** (table below). Plan published. No PC starts before sync point S0 is announced here.

## 0b. Which PC runs which lanes

The LEAD sets the current row in the Lead notices. Each PC owner tells the agent its PC letter (A, B, C, ...).

| Setup | PC-A | PC-B | PC-C | PC-D |
|---|---|---|---|---|
| **3 PCs + LEAD (current)** | PC-1 + PC-4 | PC-2 + PC-6 | PC-3 + PC-5 | - |
| 4 PCs + LEAD | PC-1 | PC-2, then BE-31, 17, 19, 18 | PC-3 + PC-5: BE-14, 36, 37, 10, 15, 38, 16, 39, 40 | PC-4, then BE-21, 22, 20, 26 |
| 2 PCs + LEAD | PC-1 + PC-2 + PC-4 | PC-3 + PC-5 + PC-6 | - | - |

With 6 PCs, each PC takes one lane (PC-1 to PC-6). A PC with several lanes:
- reads every lane prompt it holds (`agent-kickoff/PC-n.md`) and may edit the folders of all of them;
- takes cards in the order of the first lane listed; when that lane is blocked, it takes the next unblocked card of its next lane (section 1, step 3, applies to each lane);
- writes its owner in the tracker as the PC letter plus lane, e.g. `PC-A(PC-4)/S2`.

## 1. Start of session: find your task

```
git fetch origin --prune
git switch feature/v2-backend && git pull --ff-only
gh pr list --base feature/v2-backend --state open --json number,title,headRefName,isDraft
gh issue list --label lead --state open      # LEAD instructions: do what applies to your PC first
```

1. Open [backend-tracker.md](backend-tracker.md) **on `origin/feature/v2-backend`** and find the cards of your lanes (section 0b).
2. A card is **taken** if any of these is true: an open PR exists for its branch, the branch `origin/be/<card>-*` exists, or the tracker says `in-progress` / `review`. Never take a taken card, even if it is in your lane, unless it is yours (same PC).
3. Take the **first card of your lane, in lane order,** whose `Depends on` cards are all `done` on `origin/feature/v2-backend`. If you already have an unfinished card (your own branch or draft PR), continue that one first.
4. If nothing in your lane is unblocked: follow "What a lane does while it is blocked" in [sessions.md](sessions.md) section 2, or stop and report `blocked`.

## 2. Claim it immediately (before writing code)

```
git switch -c be/<card-id>-<slug> origin/feature/v2-backend
# set your tracker row: Status in-progress, Owner PC-n/Sx, Branch
git commit -am "chore(<card-id>): claim card" && git push -u origin HEAD
gh pr create --draft --base feature/v2-backend --title "<card-id>: <title>" --label lane:PC-n --body-file <template>
```

**The draft PR is the claim.** Other PCs see it within seconds; that is how two PCs never take the same card.

## 3. While working: commit and push often

- **Commit** after each green step (contract, schema/migration, service, tests). Message: `<type>(<card-id>): <what>`, e.g. `feat(BE-08): curriculum tree endpoint`.
- **Push** at least **every hour** and **always before the session ends** (`git push`, or `git push --force-with-lease` after a rebase, own branch only). Unpushed work does not exist for other PCs.
- **Rebase** on `origin/feature/v2-backend` at the start of each day, before marking the PR ready, and whenever the lead announces a merge: `git fetch origin && git rebase origin/feature/v2-backend`. Conflicts: [sessions.md](sessions.md) section 5/6 (regenerate `openapi.json` with `npm run contract:emit`, never hand-merge it).
- Never commit secrets, `.env.*`, dumps, real data or `.migration-out/`.

## 4. End of session (always, even if unfinished)

1. `npm run contract:check && npm run be:verify`, and paste the real output into the PR.
2. Update your tracker row on your branch: `in-progress` (unfinished), `review` (verify green, PR marked ready with `gh pr ready`) or `blocked` (one-line reason, plus a GitHub issue labelled `blocked`).
3. Commit and push. Nothing may be left only on this PC.
4. Report in 5 lines (to the PC owner, and as a PR comment if the LEAD must act): card, status, PR link, what is left, any question for the LEAD.

## 5. Never

- Push to `main`, `feature/student-prototype`, `feature/v2-backend` or `v2/*`; merge any PR (the lead merges).
- Edit another lane's folders, `src/**`, `e2e/**` or `docs/TRACKER.md` (open a `cross-lane` or `contract` issue instead).
- Ask for or use credentials, the .cloud database or real people's data.
