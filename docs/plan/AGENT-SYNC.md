# Agent sync rules (one page)

Every backend agent on every PC follows this page. Re-read it from `origin/feature/v2-backend` at the start and end of each session. Details: [sessions.md](sessions.md) section 6.

## Groups: who takes which lanes (user decision D56, 2026-10-19)

Two groups of people work in parallel. Each session belongs to exactly one group, which is named in its first prompt ("Group A" or "Group B"). A session takes cards **only from its own group's lanes** (the tracker `Lane` column), so the two groups never edit the same folders.

| Group | Who | Lanes |
|---|---|---|
| **A** | The project owner's PC (the LEAD's machine) | PC-1 Identity, PC-4 Migration, PC-6 Teacher/Reports/Seed |
| **B** | The external collaborator's PCs | PC-2 Learning/Question bank, PC-3 Bijak/Paper builder, PC-5 AI intake, PC-7 Games |

- No group named in your prompt? Ask the user which group before taking a card.
- Cards claimed before D56 stay with their current holder until merged, even if they are in the other group's lane. Do not take over another group's claimed card.
- Nothing left in your group? Report `idle`. Never take the other group's cards unless a Lead notice says so.

## Quick start: many sessions in parallel (read this first)

Many sessions work at the same time, on one PC or on many. Each session is an independent worker.

1. **You are one session, not "the PC".** Make your own session name once:
   ```
   node -e "console.log('s-'+require('os').hostname().toLowerCase()+'-'+Math.random().toString(36).slice(2,6))"
   ```
   Use it as the Owner. Other sessions on the same PC are other workers: never continue their card and never wait for them.
2. **The live board is the list of `be/*` branches on GitHub.**
   ```
   git fetch origin --prune && git ls-remote --heads origin "be/*"
   ```
   - A branch exists for a card: that card is **taken**, whatever `backend-tracker.md` on `feature/v2-backend` says. Tracker rows change on the claim branch and only reach `feature/v2-backend` when the LEAD merges.
   - Do not ask other sessions what they are doing. GitHub is the only source.
3. **Take the first free card of your group's lanes** (see Groups above) from the Open list (section 0), using the rules in section 1. Several cards are open at once (contract-only cards do not wait for dependencies), so a second session normally has work.
4. **Work in your own folder.** Several sessions must never share one checkout:
   ```
   git worktree add ../pp-<card-id> -b <branch> origin/feature/v2-backend
   cd ../pp-<card-id>
   npm ci
   ```
5. **Check `docs/plan/reviews/`** for a file named after any card you hold: fix those first.
6. **Claim by pushing the branch** right away (section 2). The push is the claim:
   - If the push is rejected because the branch exists, another session won. Remove your worktree and take the next free card.
   - Add the draft PR when `gh` works.
7. **Nothing free?** Report `idle` in one line and stop. The LEAD opens more cards.

**Resume** a card only when the user's prompt says so ("Continue BE-xx"). Then work in that card's existing branch.

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
| BE-03 | full | 2026-10-19 | Group A (PC-1). Authentication, session, roles, scope and Mod Pelajar. Follow D55, D57, D59, UD-1 and UD-2 and the session contract in packages/contract/src/{session,auth,access}. **Security review required.** Unblocks most full cards. |
| BE-34 | full | 2026-10-19 | Group A. Migration kit (branch `be/BE-34-migration-kit`). BE-02 is merged: merge origin/feature/v2-backend into the branch. |
| BE-27 | full (stacked) | 2026-10-19 | Group A (PC-4). .cloud staging schema, loader and profiling report, stacked on `origin/be/BE-34-migration-kit`. Never connect to the .cloud DB: build against a staging schema and synthetic fixtures; the LEAD runs the real read-only profile. No real data, dumps or credentials in the repo. Adds the migration CLI npm script. |
| BE-31 | full | 2026-10-20 | Group A (PC-6). Conformance suite — harness-only part merged; remaining = API-target wiring (Nest supertest) + auth/users scenarios, now BE-03/05 merged. **Reassigned to s-aminfaudzi-e3m2** (original holder s-aminfaudzi-mlcq gone). Branch `be/BE-31-conformance-suite` from 8536a37e. Run conformance against the real API for existing endpoints (auth, users, schools, files). |
| BE-07 | full | 2026-10-20 | Group A (PC-1). Seed core population (schools, users, roles) for the PoC profile. Depends BE-05 (done). Unblocks BE-32, BE-26. Demo accounts only (Demo1234) via a 'demo' seed module gated by ALLOW_DEMO_SEED (reference/demo split from BE-25); fictitious names only, no real persons. No new migration (seed only). Branch `be/BE-07-seed-core-accounts`. **Claiming: s-aminfaudzi-e3m2.** |
| BE-04 | full | 2026-10-19 | Group A (PC-1). File storage + upload handling. **DONE — merged 8536a37e (2026-10-20).** Migration 0005_files. F1 IDOR closed. Unblocks BE-37. |
| BE-35 | full | 2026-10-20 | Group A (PC-4). Anonymiser tool + synthetic .cloud fixture generator. Opened after BE-27 merged. No folder overlap with BE-04, so it may run in parallel. Security review. LEAD runs the anonymiser (OD-18). |
| BE-05 | full | 2026-10-19 | Group A (PC-1). Users & schools (M02). **DONE — merged 2ab7976f (2026-10-20).** Unblocked BE-17 (also needs BE-08 full), BE-25. |
| BE-08 | full | 2026-10-19 | Group B (PC-2). Curriculum (M03): levels, subjects, chapters, topics, DSKP tree. Opened after S3; contract already merged. Unblocks BE-09 full. |
| BE-09 | contract-only | 2026-10-19 | Question bank core: `packages/contract/src/questions/**`. |
| BE-11 | contract-only | 2026-10-19 | Wallet and streak: `packages/contract/src/wallet/**`. |
| BE-12 | contract-only | 2026-10-19 | Practice write path: `packages/contract/src/practice/**`. |
| BE-25 | full | 2026-10-20 | Group A (PC-1). Subscriptions, packages, parent invites/links, complimentary students (M02 rest). **CLAIMED** pc-aminfaudzi/S2, branch `be/BE-25-subscriptions-parents` from 2ab7976f. Unblocked by BE-05 (done). **Migration number 0006** (allocated; BE-04 keeps 0005 and merges first). Enforce parent-visibility AC#7 (fail-closed, ≥1 child all in school); parent invite tokens random/hashed/single-use. Security review. |
| BE-06 | contract-only | 2026-10-19 | Account and notifications: `packages/contract/src/{account,notifications}/**`. |
| BE-10 | contract-only | 2026-10-19 | Question workflow: `packages/contract/src/question-workflow/**`. |
| BE-15 | contract-only | 2026-10-19 | Bijak papers: `packages/contract/src/bijak/papers/**`. |
| BE-17 | contract-only | 2026-10-19 | Classes (teacher): `packages/contract/src/classes/**`, not `classes/{missions,question-sets}`. |
| BE-19 | contract-only | 2026-10-19 | Performance reports: `packages/contract/src/reports/performance/**`. |
| BE-21 | contract-only | 2026-10-19 | School admin: `packages/contract/src/school-admin/**`. |
| BE-23 | contract-only | 2026-10-19 | Gamification and shop: `packages/contract/src/gamification/**`. |
| BE-24 | contract-only | 2026-10-19 | Content and support: `packages/contract/src/{content,support}/**`. |
| BE-36 | contract-only | 2026-10-19 | AI adapter wire types: `packages/contract/src/ai/**`. |
| BE-41 | contract-only | 2026-10-19 | SPM hub (M06): `packages/contract/src/spm/**`. |
| BE-48 | contract-only | 2026-10-19 | Heatmap: `packages/contract/src/heatmap/**`. |
| BE-13 | contract-only | 2026-10-19 | Practice read models (Group B): `packages/contract/src/practice/reads/**` only; do not edit BE-12's files in `practice/`. |
| BE-16 | contract-only | 2026-10-19 | Bijak attempts: `packages/contract/src/bijak/attempts/**` only (BE-15 owns `bijak/papers`). Foreign attempt = 403 (D54b). |
| BE-18 | contract-only | 2026-10-19 | Missions and question sets: `packages/contract/src/classes/{missions,question-sets}/**` only (BE-17 owns the rest of `classes/`). |
| BE-20 | contract-only | 2026-10-19 | Analytics and Kirkpatrick: `packages/contract/src/reports/{analytics,kirkpatrick}/**` only (BE-19 owns `reports/performance`). |
| BE-22 | contract-only | 2026-10-19 | Command Center and admin dashboard: `packages/contract/src/admin/command-center/**`. |
| BE-38 | contract-only | 2026-10-19 | Intake batches and review: `packages/contract/src/intake/**`. Match the prototype intake in `src/modules/m28-bijak-spm/admin/intake` (types.ts, server/store.ts) and the five lifecycle states (D54a). |
| BE-39 | contract-only | 2026-10-19 | Paper builder and blueprints: `packages/contract/src/bijak/builder/**` only. Match `src/modules/m28-bijak-spm/admin/papers` and server/admin.ts. |
| BE-42 | contract-only | 2026-10-19 | PKSK: `packages/contract/src/pksk/**`. |
| BE-43 | contract-only | 2026-10-19 | Cikgu Alesa: `packages/contract/src/cikgu/**`. |
| BE-44 | contract-only | 2026-10-19 | Battle: `packages/contract/src/battle/**`. |
| BE-45 | contract-only | 2026-10-19 | Papan Bijak, games hub, leagues: `packages/contract/src/games/**`. |
| BE-46 | contract-only | 2026-10-19 | Marketplace: `packages/contract/src/marketplace/**`. |
| BE-47 | contract-only | 2026-10-19 | Keluarga Angkat (student side): `packages/contract/src/sponsorship/**`. |

Rules for `contract-only`:
- The frontend mock is the spec: match the mock handlers' request and response shapes, error codes and BM messages exactly.
- Never edit `packages/contract/src/{common,session,auth,access}/**`; those belong to the LEAD.
- Recipe (copy the pattern of `packages/contract/src/session/`):
  1. Schemas in `packages/contract/src/<domain>/schema.ts`; import `z` from `'../zod'`, never from `'zod'`.
  2. `packages/contract/src/<domain>/paths.ts` exports `<DOMAIN>_COMPONENT_SCHEMAS` and `register<Domain>Paths(registry)` (see `session/paths.ts`).
  3. Register in `packages/contract/src/openapi.ts`: add the import, `...<DOMAIN>_COMPONENT_SCHEMAS,` inside `COMPONENT_SCHEMAS`, and `register<Domain>Paths(registry)` inside `buildOpenApiDocument()`. Add `export * from './<domain>/schema'` to `src/index.ts`. These shared files take added lines only; on a rebase conflict keep both sides.
  4. Tests in `packages/contract/src/<domain>/__tests__/<domain>.test.ts` (patterns: `src/access/__tests__/`, `src/__tests__/session.test.ts`): valid mock payloads parse, invalid ones are rejected, and `buildOpenApiDocument()` contains your paths and components.
  5. `npm run contract:emit`, commit the changed `packages/contract/openapi.json` (never hand-edit it), then `npm run contract:check` and `npm test -- packages/contract` (about 10 seconds).

### Lead notices (current instructions; newest first)

- 2026-10-20: **BE-04 merged** (8536a37e, file storage; F1 IDOR closed, opaque ids, migration 0005_files). LEAD verify caught a flaky files.spec assertion — fixed before merge. **BE-07 opened + BE-31 reopened as full, both to s-aminfaudzi-e3m2** (parallel, no folder overlap). Done so far: BE-01, 02, 03, 34, 27, 05, 35, 04 (8/48). Still blocked: BE-28 (needs BE-08+BE-17 full), BE-06 (PC-1, free for whoever finishes — depends BE-03/04/05, all done).
- 2026-10-20: **BE-05 merged** (2ab7976f, users & schools). LEAD independent 2-layer verify green (be:verify 553 passed + 1188 contract tests; focused security review no Crit/High, parent visibility fail-closed confirmed). **BE-25 opened + claimed** (pc-aminfaudzi/S2). **Migration numbering:** 0001-0004 merged (0004 = BE-05); 0005 = BE-04 (merges first), 0006 = BE-25. Ask the LEAD for a number before creating a migration folder. BE-17 still needs BE-08 full before it can start. Done so far: BE-01, 02, 03, 34, 27, 05 (6/48).
- 2026-10-20: **BE-34 + BE-27 merged** (migration kit + .cloud staging/profiling). LEAD independent verify green for each (contract:check + be:lint:migration + be:verify, real Testcontainers). Apply guard now enforced at Runner level (hard condition). **BE-35 opened** (Group A/PC-4, anonymiser + synthetic fixtures — no overlap with BE-04, parallel OK). **BE-04 claimed** (s-aminfaudzi-e3m2). **Migration numbering:** 0001_init, 0002_identity, 0003_etl_control_tables merged; 0004 reserved for BE-05 (merges first); BE-04 uses 0005 if it needs a table. LEAD allocates every migration number and merges in numeric order — ask before using a new number. Done so far: BE-01, 02, 03, 34, 27 (5/48).
- 2026-10-19 (S3): **BE-03 merged — gate S3 passed** (squash b85df54a, tracker 41b4e6a9). LEAD independent verify green (contract:check + be:verify, 24 files / 195 passed, real Testcontainers Postgres). **Full cards opened:** BE-04 (Group A/PC-1), BE-05 (Group A/PC-1, **CLAIMED** pc-aminfaudzi/S2), BE-08 (Group B/PC-2). BE-36 still waits on BE-06 (full). Rebase on origin/feature/v2-backend before starting.
- 2026-10-19 18:15: **BE-02 merged (S2).** **BE-03 (auth) is open** for Group A, as a full card with a security review. BE-34 is no longer stacked; merge the base in.
- 2026-10-19 17:45: **BE-39 mock reference is now on this branch:** `docs/reference/bijak-paper-builder-mock/` (read-only snapshot of the prototype paper-builder mock). BE-39 must match it. **D59a accepted risk:** IC self-reset for pupils was flagged High by security review; the user kept it (D59a) with the D55 limits plus notifications, recorded as an accepted risk.
- 2026-10-19 17:00: **D59 (user):** IC reset stays for all roles (with D55 limits and a notification); initial passwords are random per account, shown once, with mustChangePassword (no shared default); Battle search covers all schools; the shared 429 response is coming to common/ (LEAD). **Reviewers are now read-only** (no worktrees, no npm); the LEAD runs the checks at merge.
- 2026-10-19 16:20: **Group A opened:** BE-02 (database, stacked on the BE-01 branch, for BE-01's holder) and BE-31 harness-only (conformance runner against the mock). New mode `harness-only` means only the parts that need no unmerged dependency.
- 2026-10-19 16:05: **D58 (TRACKER)** covers BE-45 server-checked solo games, BE-39 [PROPOSED] copy, the BE-06 rate-limit copy, and the BE-05 and BE-25 rules. The base lint failure (`_stats` in the BE-12 test) is fixed here. **Worktree rule:** before `npm ci` or `npm install` in a worktree, check `(Get-Item node_modules -Force).LinkType`; if it is a junction, delete the link with `.Delete()` first. A junctioned install wiped the main node_modules today.
- 2026-10-19 15:45: **Review feedback now lives in `docs/plan/reviews/<card>.md`** on this branch. Changes are requested for BE-05, BE-09, BE-19 and BE-25 (Group A) and for BE-06 and BE-21 (Group B). The holder fixes the branch, rebases on origin/feature/v2-backend, and sets the row back to `review`. **D57 security defaults** (TRACKER) apply to every contract: 429 on writes and public lookups, no-store on credentials and tokens, role and scope limits, and parent-invite PDPA rules. **Opened for Group B:** BE-13 contract-only (`packages/contract/src/practice/reads/**` only; BE-12 is merged). Merged so far: BE-08, 10, 11, 12, 15, 17, 23, 24, 41, 48.
- 2026-10-19: **Decisions D55 (security):** BE-06 reset-ic has an attempt limit (5 per 15 min per account and IP, 429 RATE_LIMITED, BM message); unknown e-mail answers with the invalid-token message (no enumeration); BE-21 student-create returns the password once to the creating admin only, never logged, and the account must change its password at first login. Contracts and cards BE-03, BE-06, BE-21 and BE-33 follow D55.
- 2026-10-19 14:40: **12 more contract-only cards opened:** BE-16, 18, 20, 22, 38, 39, 42, 43, 44, 45, 46, 47. Only BE-19 and BE-36 were left before. Same rules: one branch `be/<card>-contract` per card, push = claim.
- 2026-10-19: **Reserved for an external collaborator: BE-11 and BE-24 (contract-only), branches `be/BE-11-contract` and `be/BE-24-contract`.** Every session skips these two cards even before their branches appear on GitHub. BE-08 contract stays with the session that pushed `be/BE-08-contract` first.
- 2026-10-19: **Decisions D54 (docs/TRACKER.md):** questions use the v2 lifecycle on the wire: Draf, Semakan, Lulus, Diterbitkan, Diarkib (codes draft, review, approved, published, archived); another student's Bijak attempt returns 403; BE-23 is now P1; M16 leaderboards show classmates' display names (fictitious names in seeds). Cards that conflict with these follow D54.
- 2026-10-19: **Start now; do not wait for perfect docs.** Take cards only from the Open list above. If `docs/requirements/v2-backend-urs.md` or `docs/plan/backend-dev-guide.md` is not on the branch yet, follow `docs/architecture/v2-backend-plan.md` and the card file. Once they land, re-read them at your next session start.

- 2026-10-19: **Parallel sessions fixed:** read the Quick start at the top. Each session has its own name and its own worktree; a `be/*` branch on GitHub means the card is taken. 17 contract-only cards are open, so every session has work.
- 2026-10-19: **S0 is open, start now.** Defaults in force until the LEAD says otherwise:
  - Stack: NestJS 11 + Prisma + Vitest (OD-3).
  - The LEAD reviews and merges every PR (OD-12).
  - Any number of PCs may join; there is no fixed PC-to-lane split (section 1).
  - What may start is set only by the Open list.
  - When the Open list has nothing free for you, stop and report `idle`; the LEAD opens more cards as merges land.

## 0b. Any number of PCs

- There is no fixed number of PCs and no fixed PC-to-lane split. Every PC **pulls** the next ready card from the whole tracker (section 1). A PC can join or leave at any time; a new PC only needs the setup in [agent-kickoff/README.md](agent-kickoff/README.md) section 1.
- **Session name (automatic):** each session makes its own name (Quick start step 1, e.g. `s-desktop-7h2k-q3x9`) and writes the tracker Owner as that name. Two sessions on one PC have different names.
- **Lanes are file-ownership groups, not people.** The lane of a card (tracker column `Lane`) tells you which lane prompt to read and which folders you may edit while you hold that card.
- More PCs help only while there are ready cards. When none is ready, a PC does the "blocked" work of [sessions.md](sessions.md) section 2 or stops and reports `idle`.

## 0c. Understand the system first (every new session, before picking a card)

Skim these in order. They take about 15 minutes, and without them a card is easy to misread.

| # | Read | Why |
|---|---|---|
| 1 | `AGENTS.md` | What PrestasiPlus is, and the repo rules (privacy, English docs, no secrets). |
| 2 | [docs/README.md](../README.md) | Docs index: where everything lives. |
| 3 | `docs/TRACKER.md`, decision rows **D28 onward** only | v2 direction: a new system, two portals, one question bank, the intake pipeline, migration from .cloud. |
| 4 | [docs/requirements/role-access-matrix.md](../requirements/role-access-matrix.md) | **Top priority.** Roles, and who may do what. Every auth and scope check follows it. |
| 5 | [docs/requirements/v2-portals.md](../requirements/v2-portals.md) | Portal Pentadbiran and Portal Pembelajaran, Mod Pelajar. |
| 6 | [docs/architecture/v2-backend-plan.md](../architecture/v2-backend-plan.md) sections 1 to 7, 14 and 15 | What we are building, the stack, the layout, the data model, contract-first, the frontend switch, migration-first, SPM intake. |
| 7 | [docs/requirements/v2-backend-urs.md](../requirements/v2-backend-urs.md) and [backend-dev-guide.md](backend-dev-guide.md) | Testable backend requirements, and the coding conventions every PC uses. |

Then, for the card you take, read its domain sources:
- the module URS and SRS: `docs/requirements/urs/Mxx-*.md`, `docs/requirements/srs/Mxx-*.md`;
- the module's mock handlers, tables and seeds in `src/modules/<module>/mock/`. The mock is the behavioural spec;
- the v2 domain docs the card names, for example `docs/requirements/v2-question-bank.md`, `v2-exam-schema.md`, `v2-bijak-spm.md` and `docs/architecture/v2-data-migration.md`.

## 1. Start of session: find your task

First time on this PC? Do the one-time setup in [agent-kickoff/README.md](agent-kickoff/README.md) section 1 (each tool has a one-line check: `node -v`, `docker info`, `gh auth status`).

```
git fetch origin --prune
git switch feature/v2-backend && git pull --ff-only
git ls-remote --heads origin "be/*"          # existing be/ branches = cards already taken
gh pr list --base feature/v2-backend --state open --json number,title,headRefName,isDraft
gh issue list --label lead --state open      # LEAD instructions; if the label does not exist yet, ignore the error
```

1. **Resume only when told:** if the user's prompt says "Continue BE-xx", continue that card in its existing branch (in its own worktree). Otherwise always take a new free card. A card with a branch is never yours just because it was claimed from this PC.
2. Otherwise open [backend-tracker.md](backend-tracker.md) **on `origin/feature/v2-backend`** and list the cards that are **ready**:
   - listed in the **Open list** (section 0); `contract-only` rows skip the dependency check below;
   - **no `origin/be/<card-id>-*` branch exists** (`git ls-remote --heads origin "be/*"`) and no open PR. This is the real "taken" test, because tracker status on `feature/v2-backend` lags until merge;
   - every card in `Depends on` is `done`;
   - **no clash:** no card currently `in-progress` or `review` in the same lane touches the same module folder or Prisma file (check the "Files" or scope section of both card files). Two cards of one lane may run in parallel only when neither depends on the other and their files do not overlap (example: BE-08 curriculum and BE-11 wallet).
3. Take the ready card with the **highest priority** (P0, then P1, then P2); on a tie, the one that unblocks the most other cards (the most cards list it in `Depends on`); then the lowest card number.
4. Read the lane prompt of that card's lane (`agent-kickoff/PC-n.md`, where `PC-n` is the `Lane` column) for its folders, rules and verification, then the card file. Before writing code, also read the requirements for your domain in [v2-backend-urs.md](../requirements/v2-backend-urs.md) (your BE-FR rows plus the BE-NFR, BE-MIG and BE-OPS sections) and the developer handbook [backend-dev-guide.md](backend-dev-guide.md).

## 2. Claim it immediately (before writing code)

```
git worktree add ../pp-<card-id> -b be/<card-id>-<slug> origin/feature/v2-backend   # contract-only: be/<card-id>-contract
cd ../pp-<card-id> && npm ci
# edit the card's row in docs/plan/backend-tracker.md: Status in-progress, Owner <session-name>, Branch
git add docs/plan/backend-tracker.md
git commit -m "chore(<card-id>): claim card" && git push -u origin HEAD
gh pr create --draft --base feature/v2-backend --title "[PC-n] <card-id>: <title>" --body-file .github/pull_request_template.md
gh pr edit --add-label lane:PC-n || true     # add `contract` for contract-only; labels may not exist yet, ignore the error
```

`PC-n` is the card's `Lane` column. The `[PC-n]` title prefix always carries the lane, so a missing label costs nothing. Always `git add` explicit paths, never `git commit -a`: the full test run rewrites a tracked snapshot under `src/`, and it must not enter your PR.

**The pushed branch is the claim** (the draft PR adds detail). Other sessions see it within seconds. If `git push` says the branch already exists, someone claimed it first: delete your local branch and go back to section 1. If `gh` says you are not logged in, run `gh auth login` once; do not skip the PR.

## 3. While working: commit and push often

- **Commit** after each green step (contract, schema/migration, service, tests). Message: `<type>(<card-id>): <what>`, e.g. `feat(BE-08): curriculum tree endpoint`.
- **Push** at least **every hour** and **always before the session ends** (`git push`, or `git push --force-with-lease` after a rebase, own branch only). Unpushed work does not exist for other PCs.
- **Rebase** on `origin/feature/v2-backend` at the start of each day, before marking the PR ready, and whenever the LEAD announces a merge: `git fetch origin && git rebase origin/feature/v2-backend`. Conflicts: [sessions.md](sessions.md) sections 5 and 6 (regenerate `openapi.json` with `npm run contract:emit`, never hand-merge it).
- Edit only the folders of your card's lane (its lane prompt) plus the append-only shared files listed there.
- Never commit secrets, `.env.*`, dumps, real data or `.migration-out/`.

## 4. End of session (always, even if unfinished)

1. Run the checks that exist for your card and paste the real tail of the output into the PR:

   | Card | Checks |
   |---|---|
   | `contract-only` | `npm run contract:check`, `npm test -- packages/contract`, `npm run typecheck` |
   | `full`, before BE-01 is merged (`be:verify` does not exist yet) | `npm run contract:check`, `npm run typecheck`, `npm test -- <your test folder>` |
   | `full`, after BE-01 is merged | `npm run contract:check && npm run be:verify` |

   BE-01 creates `be:verify`, `be:test`, `be:db:*` and the `.env.*.example` files; until it merges, do not look for them. `npm run typecheck` needs the generated, git-ignored `auto-imports.d.ts` and `components.d.ts`; a fresh clone gets them from any vitest run, so run `npm test -- packages/contract` first (6 seconds). The full root `npm test` takes 15+ minutes and has a few failures on a clean checkout that are not yours: do not fix them, report only new failures, and run it only if you touched `packages/**` outside `packages/contract`.
2. Update the card's tracker row on your branch: `in-progress` (unfinished), `review` (verify green, PR marked ready with `gh pr ready`) or `blocked` (one-line reason, plus a GitHub issue labelled `blocked`).
3. Commit and push. Nothing may be left only on this PC.
4. Report in 5 lines (to the PC owner, and as a PR comment if the LEAD must act): card, status, PR link, what is left, any question for the LEAD.
5. Leaving the programme for good, or handing a card over? Push, set the Owner to `-` and status to `todo`, and comment "released" on the PR so another PC can continue the same branch.

## 5. Never

- Push to `main`, `feature/student-prototype`, `feature/v2-backend` or `v2/*`; merge any PR (the LEAD merges).
- Work on a card another PC holds; edit another lane's folders, `src/**`, `e2e/**` or `docs/TRACKER.md` (open a `cross-lane` or `contract` issue instead).
- Ask for or use credentials, the .cloud database or real people's data.
