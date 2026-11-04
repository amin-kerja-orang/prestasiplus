# R1 documentation cold-reader test

Reader: a developer agent who had never seen the project. Worktree `docs/r1-prd-devplan`, read on 2026-11-04 (the worktree was changing while I read: `45-question-authoring-flow.md` appeared and the plan, 00-index and SRS files were being edited; I read the state at that moment). Read-only; the only file written is this one (plus three scratch parts next to it).

What I read: R1-START-HERE, R1-ORCHESTRATOR-PROMPT, 00-index, 01 (decisions), 40 (X1, X2, X5, X7, X8), the relevant modules of 10, 20, 30, DM/API rows of 50 and 60, the whole of `r1-development-plan.md` (cards, sprints, sections 3, 6, 7, 8, 10), the issue and PR templates, CODEOWNERS, the three workflows, `scripts/r1-lock.mjs`, `r1-scope-guard.mjs`, `r1-trace-check.mjs`, `r1-create-issues.mjs` (headers/usage), the real GitHub issues (S1-T01 body, labels, 115 open `r1` issues, pinned #502/#503), and the code at the paths cards cite. I also ran two scripts: (a) every "Starts from (existing)" path exists (no missing path); (b) card `deps:` versus the sprint lists (4 conflicts, see F-09). I did not run `r1-trace-check` because it rewrites `r1-traceability.md` (read-only task). I did not read `r1-traceability.md` or the full 50/60 in detail; module text of 10/20/30 was read for the 33 cards below, not end to end.

## 1. Summary

### Counts (74 findings)

| Severity | Register (F-nn, process and content) | Card-level (K-nn) | Total |
|---|--:|--:|--:|
| BLOCKER (cannot start, or would build wrong) | 6 | 0 | **6** |
| MAJOR (likely wrong, duplicated or stuck) | 25 | 17 | **42** |
| MINOR (wording) | 6 | 20 | **26** |
| Total | 37 | 37 | **74** |

Cards planned: 33 (3 per sector S0-S10; mix of P0/P1 and Fix/Complete/Build/Verify/Ops), plus S1-T10 as an extra. Result by card: every one of the 33 needs the same process answers first (claim: F-02; branch names: F-03; how ACs are proven: F-04/F-05); beyond that, most cards can be planned with only the questions and guesses listed in section 3, and about a third have a real blocker on a dependency, a contradiction or a cross-sector PR (S1-T05, S2-T02, S3-T04, S3-T06, S5-T02, S5-T03, S6-T16, S7-T01, S8-T03, S10-T01, S10-T02).

### The one-paragraph verdict
The product rules are strong and mostly consistent: the improve-not-rebuild rule, the stimulus-group rule, the single answer store, the change budget by Type, and the card format (Starts from, Data/API, Approach, Tests) are clear enough that a team can plan most cards. What fails is the layer around the rules: how to enter (nothing in the repo points to R1), how to claim (two systems), how to name things, where and when acceptance happens (nobody deploys to UAT; no way to get UAT accounts), who reviews (one person), what order to work in (the stated critical path contradicts the card dependencies), and a handful of direct contradictions in the SRS (the duplicated-stem rule is the worst). "Duplication in V3" is explained in pieces in six places but never as a whole.

### Top 20

| # | ID | Sev | One line |
|--:|---|---|---|
| 1 | F-01 | BLOCKER | No repo entry point (README, AGENTS.md, CLAUDE.md, docs index, docs/plan/README) mentions R1; AGENTS.md says "no build yet"; docs/plan/README says "start here" for the old BE-card programme. |
| 2 | F-02 | BLOCKER | Two claim systems: git-ref locks (START-HERE/ORCHESTRATOR) vs self-assign and `/claim` (plan 6.3, every issue body, issue template, PR checklist); `r1-board.md` and `r1-ac-ledger.md` do not exist. |
| 3 | F-04 | BLOCKER | ACs must be proven "on UAT" before the PR (START-HERE), after deploy (V-STD), by a human later (cloud prompt), by the Delivery Lead after merge (Done); nobody is said to deploy to UAT. |
| 4 | F-05 | BLOCKER | No path to UAT accounts; "UAT read-only" contradicts AC-CHAIN test records and ADMIN content work; the designated UAT developer is still unnamed. |
| 5 | F-26 | BLOCKER | Duplicated stem: AC-MUR-9-8 / AC-MUR-16-8 say "not served"; OD-3 / FR-MUR-QP-5 / G7.2 say "shown once, not excluded"; OQ-API-19 still asks for confirmation. |
| 6 | F-03 | BLOCKER | Branch / commit / comment naming conflicts between START-HERE, ORCHESTRATOR, plan 6.4 and the repo CLAUDE.md. |
| 7 | F-09 | MAJOR | Critical path and sprint plan contradict `deps:`; the answer store (S5-T15, Sprint 2) is needed by Sprint 1 reports and by S3/S7 cards that do not list it; S5-T10 (P0) is in no sprint. |
| 8 | F-08 | MAJOR | Cross-sector "small PRs" (S1-T10, S4-T03, S6-T16..T20, S7-T09 ...) have no card ID, lock or label rule the scope guard accepts. |
| 9 | F-21 | MAJOR | "Duplicate" means six different things and no document says which; "never delete" vs "merge duplicates" looks contradictory. |
| 10 | F-06 | MAJOR | CODEOWNERS maps every path to one person; sector blocks commented; "sector lead" does not exist; who merges is never stated. |
| 11 | F-22 | MAJOR | Verify-type cards (S7-T01, S10-T07, S5-T10) need product code, so the scope guard would fail them; PRD Action vs card Type differ. |
| 12 | F-16 | MAJOR | V-STD step 3 asks every developer for a V2 side-by-side that agents may not do; one Delivery Lead cannot verify 113 cards at 3 widths. |
| 13 | F-12 | MAJOR | The repo CLAUDE.md (auto-loaded) imposes gates, "replicate don't redesign", "commit only on request", Delivery Lead roles, no precedence statement. |
| 14 | F-14 | MAJOR | The local stack does not boot until S0-T02; env vars and demo logins (an existing `docs/AKAUN-DEMO-LOCAL.md`) are not linked from R1 docs. |
| 15 | F-27 | MAJOR | Three CSV definitions (V2 positional vs `question_text/correct_answer` error text vs QE-06 DSKP columns). |
| 16 | F-20 | MAJOR | BS/KS/OPT/DM/XS/HC-SPEC/FD/OQ/U-OP/D112/D113/D-A* are used but not glossed in one place; "OPT" appears in no definition table. |
| 17 | F-15 | MAJOR | Fixture-style ACs ("a test bank of 20 MCQs and one group of 3") cannot be run on a clone of production data; ACs are not tagged CI vs UAT. |
| 18 | F-23 | MAJOR | New PRD 45 is not in the index/plan/trace and already conflicts with cards (drawing/table_fill in R1 vs P2; essay_choice; bilingual; full scheme editor). |
| 19 | F-29 | MAJOR | S2-T01 and S2-T05 both claim manual entry; flat legacy create/edit pages are listed as files to change though 45 says they redirect. |
| 20 | K-34 | MAJOR | S10-T02 Headcount covers three roles, HC-SPEC and a new table in one L card (limit is 6 days per card). |

(Process findings dominate the top: the content is more ready than the process.)

### "Duplication in V3": did the docs explain it?
Partly, and only for admin screens. The decision table exists (30 section 3.3, BS/KS ids, with KEEP/MERGE/HIDE/REMOVE per entry; 45 section 1.6 for question screens), the problem statement exists (30 section 2 list; 01 "Admin side is duplicated"), and the code-level rule exists (0B "no parallel page..."). But START-HERE, the cards and ORCHESTRATOR never connect them, and five other duplicates (stem text, figure copies, answer stores, routes, detector/redemption "duplicate") use the same word. A team's agents saying "we did not understand" is the expected outcome. See F-21 and FAQ Q5 for the fix.

### Are the internal codes explained?
No. The only glossary is 9 lines (40 X8). BS-xx/KS-xx are menu ids from code and appear in 30 without saying so. OPT appears only in 45 and in one place of 20 (`OPT-ENGAGEMENT`) with no table. FAQ Q4 contains the proposed table.

### Does every card have enough to start?
Format yes (Starts from, PRD, Data/API, Approach, Files, Tests, Verify, DoD). Gaps: wildcard ACs ("AC-ADM-QE1.*") instead of lists; `BE/ SCH/ CT/` shorthand defined only in plan section 2; no per-card list of which ACs of a multi-card module belong to it (F-33); "Gap:" lines already stale in places (F-31); Type conflicting with content (F-22). Cards that were best written: S1-T10, S6-T01 (with its PRD), S5-T15, S4-T03.

### Order and dependencies
Not clear: the three documents that describe order (ORCHESTRATOR critical path, plan 5.2, plan 5A sprint lists) disagree with each other and with the `deps:` fields (F-09). The tool cannot show dependencies (all issues `status:ready`).

### Lock and claim tooling
The tool itself is sound (atomic ref, clear exit codes, `list`, `mine`, `heartbeat-all`, `--self-test`). It is not explained well enough to use: no `--help`, usage only in the script header, inconsistent session naming, exit code 4 unexplained, rules (3-sector cap, S9 not claimable) not enforced, no mention that push rights are needed, and the rest of the docs still describe a different claim method (F-02, F-17).

---

## 2. Findings register

Format: `ID [SEVERITY] place`, then the problem, then the proposed answer. "Answer exists" means the answer is in the docs but cannot be found; the fix is then a link, not new text.

### 2.1 Process and tooling

**F-01 [BLOCKER] The repo entry points never mention R1.** Place: `README.md`, `AGENTS.md` (section 1 says "v2 G2 Design in progress, no v2 build yet"), `CLAUDE.md`, `docs/README.md`, `docs/plan/README.md` ("Backend collaboration: start here": BE-01..BE-40 cards, branch `feature/v2-backend`, `be/<card>` branches, `AGENT-SYNC.md`, `backend-tracker.md`, `onboarding.md`). A search for `R1-START|r1-development|prd/r1` in all five returns nothing. A new developer or agent who opens the repo follows the old programme; `onboarding.md` tells them to branch from `feature/v2-backend`.
Proposed: add a 3-line banner at the top of all five files: "Release 1 work: read docs/plan/R1-START-HERE.md. Everything else in docs/plan/ is legacy (BE cards) unless R1-START-HERE links it." Mark the legacy files `SUPERSEDED for R1`. Answer exists, not discoverable.

**F-02 [BLOCKER] Two incompatible claim systems.** Place: START-HERE step 3 and ORCHESTRATOR section 1 (git-ref locks, `team:` label, signed comments) versus plan 6.3 ("self-assign the issue and comment `claim`", `Claimed` column), the text generated into every issue ("How to claim: Comment `/claim` and set yourself as assignee"), issue-template field "Claimed by", PR checkbox "Claim is current (issue assigned to me, board row updated)", plan 6.2 sector leads in `docs/plan/r1-board.md`, CODEOWNERS header. `r1-board.md` and `r1-ac-ledger.md` do not exist.
Proposed: one sentence in START-HERE and plan 6.3: "The lock (`r1-lock/<KEY>` branch) is the only claim. Assignee, `/claim` and board rows are optional mirrors." Remove `/claim` from `scripts/r1-create-issues.mjs` output, the issue template field and the PR checklist line. Create `r1-board.md` / `r1-ac-ledger.md` (empty tables) or remove every reference.

**F-03 [BLOCKER] Branch, commit and comment names conflict.** Place: START-HERE step 5 (`r1/S<n>-T<nn>-<slug>`, commits `S<n>-T<nn>: ...`); ORCHESTRATOR 1.8 and the session prompt (`r1/<TEAM>/<card>-<slug>`, every commit/PR title/comment starts `[<TEAM>/S-<k>]`); plan 6.4 (first form, squash title `S3-T04 ...`); repo `CLAUDE.md` section 7 (`feature/<slug>`). The scope guard reads the card ID from the PR body, so titles are free, but nobody knows which form is right.
Proposed: branch `r1/<team>/<card>-<slug>` (team in the path avoids clashes); commit subject `S<n>-T<nn>: <what>`; PR title `S<n>-T<nn> <title>`; the `[team/S-k]` tag goes in the PR body and issue comments only. Put it in START-HERE and delete the other copies.

**F-04 [BLOCKER] When, where and by whom ACs are proven is contradictory, and nobody is said to deploy to UAT.** Place: START-HERE step 6 (the developer proves ACs on UAT before the PR); V-STD step 2 ("after the change is deployed to UAT"); cloud-agent prompt ("UAT acceptance still to be done by a human"); step 10 and plan 6.5 (Delivery Lead re-runs after merge); PR template "Verification evidence (UAT...)"; DoD-T (d); RACI ("designated UAT developer ... deploys, restores state"). UAT is "a clone of V2 production data": which V3 build runs on it, who deploys a merged PR, how often, and is a PR build ever on UAT before merge? Not written anywhere. Without this no card can reach Done.
Proposed (principle: nobody touches servers except the designated UAT developer): two-stage proof. Stage 1 before merge, by the developer: CI green and automated specs for every AC tagged [CI]; the PR carries real output and lists ACs "awaiting UAT". Stage 2 after merge and after the designated UAT developer deploys the integration branch (cadence written in plan 7, for example once per sprint or on request): the Delivery Lead/QA runs every [UAT] AC headed at 375/768/1280. START-HERE step 6 becomes "prove locally; list ACs awaiting UAT". Add a "UAT deploy" row to the RACI.

**F-05 [BLOCKER] No way for a new developer to get UAT access or test accounts; "UAT is read-only" contradicts what AC-CHAINs and ADMIN content work need.** Place: plan 7 "Accounts" (points to a "credentials file outside the repo (CLAUDE.md 'Credentials')"; the repo CLAUDE.md only holds a placeholder path); START-HERE hard rule ("UAT writes only by the designated developer ... everyone else read-only"); 00-index "Awaiting user decision" #2 (designated developer not named; ORCHESTRATOR has a `<GitHub handle>` placeholder); AC-CHAIN-1..9 / S9-T06 (create test records on UAT, remove later by U-OP-14); ADMIN users write content on UAT in the UI. Who creates the chain records? Who gives a tester the five role logins (pupil T1, pupil T5, teacher, school admin, admin)? May chain tests write to a clone that holds real pupil data?
Proposed: (a) introduce a "UAT tester" role distinct from the "UAT operator"; testers get role logins from the Delivery Lead out of band (never in the repo, issues or PRs) and may create clearly prefixed test records that U-OP-14 removes; (b) define "UAT is read-only" as "no server, DB or bulk-data action; normal in-app use by an authorised tester is allowed"; (c) naming the designated developer is a Sprint 0 entry condition and must be recorded in plan 7.

**F-06 [MAJOR] Review, approval and merge authority is one person; "sector lead" does not exist.** Place: `.github/CODEOWNERS` (all 44 rules map to one owner; sector blocks S1..S10 are commented out); START-HERE step 9 ("one approval per owner"), plan 6.4, ORCHESTRATOR 5.2 ("ask the product owner to merge, or merge if you were granted that"). The Delivery Lead (S9) is also the only one who sets Done. With 113 cards the single reviewer is the bottleneck, and START-HERE never says who merges.
Proposed: state in START-HERE: reviewer = CODEOWNER of the touched paths; until sector blocks are uncommented the product owner is that owner and may delegate by uncommenting a block (small S0 PR). Merge = squash by the reviewer after green CI. Add a 24 h review SLA (plan 3 has it only for cross-sector) and a named back-up reviewer.

**F-07 [MAJOR] Labels and statuses differ in three places.** Place: plan 6.1 (`delivery:A|B`, `priority:`, `size:`, `status:backlog|claimed|in-progress|in-review|verifying|done`, `needs:gapcheck|schema|contract|answer|approval`), START-HERE (`status:ready|in-progress|in-review|blocked|done`, `team:<name>`), ORCHESTRATOR (`needs:S0`), the real issues (`prio:P0`, `r1-delivery:A`, `type:verify`, and all 113 cards `status:ready`). START-HERE says "stuck -> `status:blocked`", plan 0A says "`needs:answer`".
Proposed: publish the real label list once (from `scripts/gh-labels.sh`) in START-HERE; use `status:blocked` plus one `needs:*` reason label; drop the rest from plan 6.1.

**F-08 [MAJOR] Cross-sector work has no process the tooling accepts.** Place: START-HERE says "if you need a change in another sector's file, stop and comment"; cards say the opposite: S1-T10 (migration `0163` in S3's range), S4-T03 (`0126` in S1's range), S4-T06 (edits `practice/rules.ts`), S6-T16..T20 ("small PR to S1", "delete-only PR to S0"), S5-T10 ("one PR to S0"), S7-T09 (`0180` in S5), S0-T10 (page in an S6 path). Every PR must name exactly one card (scope guard exit 2 otherwise), and a card lock only covers its own sector. Which card ID does a "small PR to S0" carry? Does the requester need S0's lock? What if the S0 team is another account?
Proposed: define a "dependency PR": it carries the requester's card ID plus a line `Cross-sector: S0 (reason)`, label `needs:S0|schema|contract`, review by the target sector's CODEOWNER, and the guard accepts files in the named sector when that line is present. The owner team answers within 24 h; if idle, the requester may open it and the owner only reviews. Update the scope guard.

**F-09 [MAJOR] Order and dependencies contradict each other.** Place: ORCHESTRATOR 1.3 critical path `S0 -> S1 -> S2 -> S3 -> S8 -> S4 -> S10 -> S6 -> S5 -> S7` while S3 depends on S8-T01..T04 and S4-T02/T03, and S10/S6 read the answer store written by S5-T15 (Sprint 2). Sprint-plan violations (found by script over `deps:`): S10-T04 (Sprint 1) needs S4-T03 (Sprint 2); S6-T06 (Sprint 2) needs S1-T08 (Sprint 4); S8-T03 (Sprint 3) needs S1-T09 (Sprint 4). Undeclared deps: S3-T04/T05/T06/T07 and S7-T01 write via `AnswerLogPort` (S5-T15) but do not list it; S10-T01..T04, T07 and S6-T01/T03/T10 must count "all modes" yet are Sprint 1-2 while the store lands in Sprint 2; S7-T01 (Sprint 4) reads `reward_settings` from S7-T05 (Sprint 5). S5-T10 (P0) and S4-T09 are in no sprint list. START-HERE says "check deps are done", but all 113 issues are `status:ready` and there is no dependency view.
Proposed: generate sprint lists from `deps:` and make `r1-trace-check` fail on "dependency in a later sprint"; add S5-T15 to the cards above (or a note "reads existing modes until S5-T15 lands"); replace the ORCHESTRATOR path with plan 5.2; show `deps` in the issue title or a label; put S5-T10 in Sprint 1.

**F-10 [MAJOR] "Dependency done" and "Done" have three meanings.** Place: plan 6.3 step 2 ("Done, or merged to the integration branch"), START-HERE step 2 ("deps are done") and step 10 (Done = Delivery Lead re-ran ACs on UAT), sprint cards "deps: sprint merged". If a dependency must be Done (UAT-verified) the next card waits for the Delivery Lead.
Proposed: "A dependency is satisfied when its PR is merged and CI is green. A card is Done only after UAT verification. Wait for Done only if the card says 'needs data on UAT'."

**F-11 [MAJOR] PR and issue templates still contain the old BE-card process.** Place: `.github/pull_request_template.md`: "Checks that exist for this card (AGENT-SYNC section 4)", "Migration-first checklist (plan section 14.9)... mapping-matrix row", "My row(s) in docs/plan/backend-tracker.md updated", "Mode: full | contract-only" (never explained), "UAT data checked on: UAT | UAT-like dataset | demo only" (D110 forbids a UAT-like acceptance dataset), "appended to docs/architecture/v2-backend-deviations.md". The issue template field "Claimed by" conflicts with F-02.
Proposed: delete the four legacy lines; define or delete "Mode"; replace the UAT-data line with "ACs awaiting UAT: <ids>".

**F-12 [MAJOR] The repo's own `CLAUDE.md` (auto-loaded by every Claude Code session) conflicts with R1.** Place: CLAUDE.md sections 1-7: Delivery Lead plus role subagents, gates G1-G6 with user approval, "work one module at a time", "replicate, don't redesign; D9; D10 accessibility replicates live", "commit only when the user asks", `feature/<slug>`, reply in Bahasa Melayu, read and update `docs/TRACKER.md`. R1 says: parallel sectors, improve using DSKP and stimulus rules, a PR per card, TRACKER owned by the Delivery Lead. A cold agent gets two rule sets and no precedence.
Proposed: add a "Release 1 precedence" paragraph to CLAUDE.md and AGENTS.md: "For cards S*-T*, R1-START-HERE.md wins on branches, commits, PRs, claims and scope."

**F-13 [MAJOR] Work-environment rules conflict: one clone vs four sessions vs cloud sessions.** Place: plan 0 "Where work happens" (one normal clone, no git worktrees, sessions share one checked-out branch, claim one task at a time); ORCHESTRATOR 3-4 (four sessions per team, cloud sessions, "use an isolated git worktree when two implementers write at once", up to 2 cards per session); START-HERE cloud prompt ("use the local stack `npm run stack:up`", but a cloud sandbox may have no Docker or headed browser).
Proposed: "Each session has its own clone or worktree; sessions never share a checked-out branch. A cloud session without Docker runs unit, typecheck, lint and contract checks only and marks stack/e2e ACs 'awaiting CI/UAT'." Move the single-clone paragraph to the Delivery Lead's own notes.

**F-14 [MAJOR] Running the stack locally is a chicken-and-egg problem and env setup is not in the R1 docs.** Place: START-HERE says use `npm run stack:up`; FR-X5-2 and S0-T02 say the stack does NOT boot today (e2e seed fails on blueprint 3472/2); plan 7 gives ports 5192/5193; env vars (`COOKIE_SECURE=false`, `JOBS_WORKER_ENABLED`, `OCR_ENGINE`, `AI_PROVIDER`) are only in `http-switch-checklist.md` / `e2e-seed.md`; no list of local demo logins. Teams that do not hold S0 cannot run runtime tests until S0-T02 merges.
Proposed: a "Day 1" box in START-HERE: (1) the first team claims S0, starting with S0-T02; (2) until it merges, use unit tests and `npm run be:dev` per `http-switch-checklist.md`; (3) link the `.env*.example` files and `docs/AKAUN-DEMO-LOCAL.md` (the local demo logins; it exists, in Bahasa Melayu, and no R1 document links to it) and `docs/ops/e2e-seed.md`.

**F-15 [MAJOR] No rule says which ACs can be proven where.** Place: cards' DoD "all ACs on UAT". Many ACs are fixture ACs that a clone of production data cannot give: AC-MUR-13-9 ("30 servable MCQs including one group of 3"), AC-MUR-16-2 ("test bank of 20 MCQs, 3 figure, one group of 3"), AC-MUR-13-20 ("2 published and 1 draft Kertas Subjektif"), AC-MUR-16-4. Only a few ACs carry (R)/(U)/(E2E) tags.
Proposed: tag every AC `[CI]`, `[UAT]` or `[CI+UAT]` (script-assisted) and add to DoD-T: CI ACs are proven by a named automated test, UAT ACs by the headed run.

**F-16 [MAJOR] V-STD step 3 ("side by side with V2, list every difference in the PR") cannot be done by the people it is assigned to.** Place: V-STD 3 applies to every card; plan 0A, START-HERE and S9-T02 say agents never open V1/V2 and only the Delivery Lead captures V2 (R15: V2 blocks an IP on rapid access); Latih Tubi, Permainan hub, Kertas Subjektif are "Not observed in V2" (10-murid 6.3 E-7, E-10, E-16). Capacity: one Delivery Lead does V2 compare plus a headed UAT walk at 3 widths for 113 cards with 3 s between V2 pages.
Proposed: V-STD 3 is done by the Delivery Lead at verification only; the developer's PR lists "deviations from the SRS text". Remove V2 comparison from per-card DoD-T. State the verification capacity per sprint and name a delegate.

**F-17 [MINOR] `r1-lock.mjs` works but is under-documented.** `--help` prints "command required"; usage is only in the file header; session examples differ (`S-1` in START-HERE, `s1` and `lead` in the header); exit code 4 is not explained in START-HERE; the 3-sector cap, "S9 is not claimable" and "register-team only from S-1" are not enforced; the tool needs push rights to the public repo (cloud sessions need a token; not mentioned); `STALE` after 24 h counts weekends and leave; no advice when the lead is a chat session without git.
Proposed: add `--help` and a 10-line lock cheat-sheet to START-HERE (register, list, acquire sector, acquire card, heartbeat-all, release, exit 3 and 4) plus a weekend rule.

**F-18 [MINOR] Gap-check rules are good but unenforced and scattered.** "No In-progress without gap check" is not machine-checked (the label `needs:gapcheck` appears only in plan 6.3). The table format lives in the issue template only.
Proposed: CI check that the PR body links an issue comment that contains the table header; put a 5-line example in START-HERE.

**F-19 [MAJOR] Stale statements and machine-local references.** Place: plan section 10 (still says plan approval and the designated developer are awaited; item 7 says the code lives in `D:\pp-cloud-review`), risk R12 ("PRD parts 10 and 30 not yet final"), 5.3 ("110 cards", sector tables "set before S6-T16..T20 were added"), 00-index ("DM-01..DM-43" but DM-49 exists; "187 rows" but there are 202 API rows), plan header "Gap evidence: `D:\pp-v2-v3-compare\gap\*.md` (outside the repo)", S4-T09 "any PDF in `d:\prestasiplus-dskp`". Missing files referenced: `r1-board.md`, `r1-ac-ledger.md`, `docs/qa/r1/`, `docs/ops/uat-like-data.md`, `scripts/ac-ledger.mjs`. The gap analysis file in the repo does exist.
Proposed: refresh section 10 and R12; generate counts from `r1-trace-check`; replace machine paths with "the Delivery Lead supplies the file; put the needed extract in the repo"; create or drop the missing files.

**F-20 [MAJOR] Internal codes are used everywhere and explained nowhere.** The only glossary (40 X8) has 9 terms. Undefined or defined only in passing: BS-xx / KS-xx (ids of sidebar entries in `src/shells/pentadbiran/menu.ts`: BS = group "Bank Soalan", KS = group "Kertas & SPM"), DM / ENT (50), API-AREA-nn (60), U-OP (a UAT data operation, 30 section 5), XS-1..8 (cross-screen numbers, 20 section 5), HC-SPEC (the one Headcount rule set, 20 R1-GUR-3), FD-xx (fidelity deviation), OQ / OD (open question), DV, DK, QP (question-paper contract), RP (responsive pattern), E-nn (evidence the lead must capture), F-nn (audit finding), D-A1..A17 / D-API-n / D-QA-n (Delivery Lead decisions listed only in plan 4.0D and 45), D112 and D113 (cited in 30 and 20, absent from the decision list in 01), `[PROPOSED]` / `[P]` / `[PRINCIPLE]`, `OPT-*` (shared option sets, defined in 45 and 30's field register; "OPT" alone is in no definition table), and the domain words Tingkatan/Darjah/Bab/SP/TP/KBAT/aras/Kertas/Terbit/Disahkan.
Proposed: add the plain-words table in the FAQ (Q4) to `00-index.md`, link it from START-HERE, and add D109-D113 and D-A/D-API/D-QA to 01.

**F-21 [MAJOR] "Duplication in V3" is one word for six problems and is never explained as a whole.** (1) Duplicate admin screens/menu entries (three lists called "Bank Soalan", Pembina Kertas vs Set Builder, two review queues, Import & Semakan vs Senarai Ekstrak): keep one, redirect or hide the others; the keep/merge/hide/remove table is 30 section 3.3 (BS/KS ids). (2) Duplicated stem text (stem repeated as its only leaf prompt): flag `stem_duplicated`, show once, clean by DM-40. (3) A shared figure copied per question, or a figure turned into a "question": one stimulus group (FR-X1-4). (4) Duplicate stores and numbers (two answer tables, different counts per screen): one answer store `practice_answers` (FR-X4-5, XS-8). (5) Duplicate routes (`/leaderboard` vs `/gamification/leaderboard`, FR-MUR-33-5). (6) The developer rule "no parallel page, service, store, route or table". Two unrelated uses add noise: intake `duplicate-detector.ts` (duplicate questions) and the redemption "duplicate-submission flag" (P2-08.3). Neither START-HERE, the cards nor ORCHESTRATOR says which meaning applies, and "never delete working code" appears to clash with "merge duplicates, no function lost" (D107). PRD 45 section 1.6 ("one canonical screen per function") is the best single statement but covers question screens only and is not yet in the index.
Proposed: add a "What 'duplicate' means in V3" box to START-HERE with the six meanings and the rule: "Delete or hide only what 30 section 3.3 or 45 section 1.6 marks MERGE/HIDE/REMOVE; keep the old URL as a redirect; never create a second implementation; if you find a duplicate that is not listed, comment on the issue." Extend 45 section 1.6 to a repo-wide table.

**F-22 [MAJOR] Card Type conflicts with its own content (change budget).** Place: S7-T01 Type Verify ("no product code") but must remove mock paths and make games write through `AnswerLogPort` (AC-MUR-21-6; PRD Action is Fix); S10-T07 Verify but owns new FR-GUR-4-6 / FR-AS-4-6 / AC-AS-4-7; S5-T10 Verify but changes pill/search code through a PR to S0; S4-T02 Verify plus an Ops run; S8-T07 Verify. PRD Action vs card Type also differ: R1-MUR-21 Fix vs Verify; R1-ADM-Q-12 Build vs S1-T08 Complete; Q-07 Fix vs S1-T10 Build. The scope guard FAILs a Verify card that changes `src/`, `apps/` or `packages/`, so these cards cannot merge as written.
Proposed: re-type S7-T01, S10-T07, S5-T10 as Fix/Complete, or state in the guard rule that "a failing AC on a Verify card becomes a one-line fix named in the issue"; add a trace-check rule that card Type is not weaker than the PRD Action.

**F-23 [MAJOR] PRD 45 (question authoring flow) is not in the index, plan or trace script and already conflicts with cards.** Place: `45-question-authoring-flow.md` ("Draft ... not yet wired into 50, 60 and the plan"). D-QA-2 puts `drawing` and `table_fill` in R1 and D-QA-4 serves `essay_choice`, but S1-T09 says "`drawing`/`table_fill` stay P2" and OQ-MUR-13 replaces `essay_choice` by "Pilih N"; D-QA-3 (full scheme editor, API-Q-30, DM-54), D-QA-1 (bilingual) and D-QA-6 (1-3 stimuli) have no card. Also `/admin/studio?status=review` (45) vs `?status=reviewed` (30 3.3).
Proposed: wire 45 into 00-index, trace-check and the plan before Sprint 2; until then START-HERE says "45 is a draft; if it contradicts 30/40/50/60, ask".

**F-24 [MAJOR] The PRD still lists work "the lead must capture on live V2" while telling developers to ask, not guess.** Place: 10-murid 6.3 (E-1, E-2, E-5, E-6b, E-7, E-10, E-12, E-13, E-16 ...) and many "Not observed in V2 - follow FR-X6 / V1" lines; 00-index says everything is decided. A developer meets "Not observed" and cannot tell whether it is intentionally open.
Proposed: one line in 00-index: "'Not observed in V2' means build from the FR text and the generic loading/error/empty rules (FR-X6); do not block." Put the E-items in one table with the cards they touch.

**F-25 [MINOR] Card ordering and numbering oddities.** S10 sits between S5 and S6; S6-T14/T15 are before T13; "113 cards" in section 0 vs "110" in 5.3; START-HERE points to plan "sections 0A, 0B, 6" while DoD is in 4 and 8.
Proposed: add one index table (sector -> cards -> sprint -> deps).

### 2.2 Content contradictions and unclear requirements

**F-26 [BLOCKER] Is a question with a duplicated stem served or not?** AC-MUR-9-8, AC-MUR-16-8, URS-MUR-23 and 10-murid R1-MUR-16 "Current gap (4)" say a question "whose stem text appears twice" is not served and not counted. FR-MUR-QP-5, AC-MUR-QP-5, FR-ADM-G7.2, OD-3 and API-Q-12 say `stem_duplicated` is shown once, cleaned by DM-40, not excluded. 60 OQ-API-19 says "needs the Delivery Lead's confirmation" while 00-index says every OQ-API is closed. S5-T02 and S5-T03 would implement the AC and break OD-3.
Proposed (principle: admin-fixable data, no silent loss, counts consistent per D91): follow OD-3. Change AC-MUR-9-8 and AC-MUR-16-8 to "figure-less (`stimulus_missing` / `figure_only`) is excluded; a duplicated stem is shown once and counted". Close OQ-API-19 explicitly.

**F-27 [MAJOR] Three CSV definitions.** 30 R1-ADM-Q-11 spec: V2 positional columns `body, option_a..d, correct, difficulty`, subject and level chosen in the dialog "not in the file"; FR-ADM-Q11.1 error text "Fail CSV mesti mempunyai kolum question_text, correct_answer."; QE-06 / API-Q-17 / DM-10: human-readable columns (subject code, Tingkatan, unit, `sp_kod`, TP, KBAT, kertas, bahagian, number label, `group_key`, `stimulus_text`, `stimulus_image`, `bab_kod`). S1-T05 follows the third, S2-T05 the page.
Proposed: the QE-06 columns are the target; the dialog defaults (subject, level, difficulty) apply only when a column is blank; the error text names the missing required target columns. Edit Q-11 to say so.

**F-28 [MAJOR] Accuracy precision and wire format conflict.** XS-5: whole-number percent on every screen (only a Manual headcount AR may show a decimal). R1-GUR-43 Computation: "accuracy ... 1 decimal"; S10-T01: "Ketepatan pooled with 1 decimal on the wire"; the GUR-43 AC shows "45%".
Proposed: store and return 1 decimal, DISPLAY whole numbers (XS-5); fix the GUR-43 wording; define "on the wire" as API field precision.

**F-29 [MAJOR] S2-T01 and S2-T05 both claim the manual entry form; legacy flat forms are listed as files to change.** S2-T01 "Cipta baharu ... wizard" lists `QuestionCreatePage.vue` and `QuestionEditPage.vue`; S2-T05 says "DSKP-correct forms (G.5)". PRD 45 section 1.6 says the flat create/edit pages redirect to the wizard (Q-20). Q-10 (`Tulis Soalan Manual` batch form) says "keep or fold into Studio".
Proposed: S2-T01 owns the wizard including G.5; S2-T05 owns the CSV page, import history and Quick Edit only; the flat pages become redirects, not files to extend. Say it in both cards.

**F-30 [MAJOR] Group size rules differ in wording.** S1-T01: "a zero-member group is blocked"; DM-01: a 0-member group is allowed as a draft and only blocked from a paper; API-Q-08: `questionIds[0..40]`, `stimulusIds[1..3]`; 45 D-QA-6: 1 to 3 stimuli (FR-X1-4a speaks of one stimulus). `group-members.ts` today warns below 2.
Proposed: "A group has 1-3 stimuli and 0-40 members; 0 members = draft only, cannot be published or placed; 1 member is valid." Put it as one sentence in FR-X1-4a.

**F-31 [MAJOR] Card "Gap:" lines are already stale against the code.** S10-T01 says `PRESTASI_SCHOOL_ROLES` includes `student` at `prestasi.ts:18`; the file now lists only admin and teacher (the leak may still exist elsewhere, but the cited cause is gone). S5-T05 says `profile.service.ts:157-158` writes `grade` and `schoolId`; `schoolId` is already guarded by `mayChooseSchool`, `grade` is still written. This is expected (the gap check exists for it), but someone reading only the card will fix the wrong thing.
Proposed: START-HERE: "file:line on cards was true on 2026-11-04; re-find by symbol." Prefer `file::symbol` on cards.

**F-32 [MINOR] MUR-13 internal inconsistencies.** S1 says the V2 hub shows four cards, FR-MUR-13-1 requires six (explained, but the reader meets both). Sitting button "Hantar" (AC-13-15) vs last-screen "Hantar Jawapan" (FR-13-7). Kuiz write rule FR-13-16 (only `finish` writes, mode `kuiz`) vs S3-T04 ("submit ... mode `simulasi` or `kuiz` by paper kind"). Sub-sections are lettered A-F (out of order: F before E) and also S1-S7; AC-MUR-13-19 is listed last.
Proposed: one sentence per item; reorder.

**F-33 [MAJOR] It is unclear which ACs belong to which card when one module is split over cards.** S3-T04 cites "R1-MUR-13 (all Bijak ACs)", S3-T05 Tracking A, S3-T06 Subjektif, S3-T07 hub/Databank, but AC-MUR-13-1..25 are not tagged by lane. Same for S5-T11 ("every AC of the listed modules"), S7-T04..T06.
Proposed: tag each AC with its card (generated by trace-check from a mapping table) or add a table "AC range -> card" under each multi-card module.

**F-34 [MINOR] Small contradictions.** 10-murid 16 reference says the level picker offers T4/T5/Semua (V1) while FR-16-2 says T1-T5; MUR-13 "Tahun Tersedia" constant 0 vs FR-13-3; plan 5A Sprint 0 exit needs "UAT Tahap = 5" which is an ADM write on UAT (U-OP-03) and needs F-05.

**F-35 [MAJOR] Files that live in another sector's folder are not owned clearly.** S1-T01's DM-02 includes `apps/api/scripts/uat-ops/group-integrity.sql` (S4 directory; not in S1-T01 "Files"); S3-T08 writes in S4's `uat-ops/`; S0-T10 touches `m17-admin-dashboard` and `CT/admin` (both S6) and its text "CT/admin -> (S6 owns CT/admin; use new CT/common/feature-flags.ts)" contradicts itself; S5-T06 and S0-T05 both un-hide Laporan Soalan through `prototype-scope.ts`.
Proposed: add "Reviewer sector" to every cross-sector file in "Files"; move `group-integrity.sql` into S1 test scripts or declare S4 review; clean the S0-T10 text; S5-T06 keeps only the pupil page.

**F-36 [MAJOR] S9-T06 owns nine Playwright specs but is "no product code", and "chains land with their cards".** Who writes `e2e/r1/chain-n.http.spec.ts`? S9 owns no code, `e2e/r1/` is S0's.
Proposed: the last card in each chain's list writes its spec; S9-T06 only runs and accepts.

**F-37 [MINOR] Issue bodies copy the card text.** The issue is "verbatim from the plan" and goes stale when the plan changes (it changes often), but developers read the issue.
Proposed: the issue shows the ID, a link and the checklists; or add `r1-create-issues.mjs --update`.
## 3. Per-card findings (build-planning test, 33 cards)

How I did it: for each card I read the card in `docs/plan/r1-development-plan.md`, then the PRD module it cites, then the DM/API rows, then checked the "Starts from" paths in the code (all of them exist; I ran a script over every card). "Plan" is what I would do using only the docs. "Q" = a question I would have to ask. "G" = a guess I would have to make. "X" = a contradiction. Card-specific findings use IDs `K-nn`; findings that repeat a register item cite the `F-nn`.

Cross-card note: every card's step 0 is the same: get a team lock (F-02), find out whether the stack boots (F-14), and find out how the ACs will be proven (F-04, F-05). I do not repeat these below.

### S0 Platform

**S0-T02 Stack boots with no manual step** (P0, Fix, M)
- Plan: reproduce the seed failure; give the e2e blueprint 3472/2 its quota and KBAT from `docs/reference/blueprints/3472-2.json` (DM-21) or seed through the Disahkan path; make `compose.http.yaml` wait for migrate and seed; add CI job `stack-smoke` that runs `npm run stack:up` and logs in as 5 roles; update `docs/ops/e2e-seed.md`. API-AUTH-17 is health only.
- Q: DM-21 says "either ... or": which? G: I would take the fixture fix because UAT must not be seeded (D95). Q: which five logins and their demo passwords? They are not listed in the card; `e2e-seed.md` may have them. Q: `stack-smoke` in `frontend.yml` while S0-T04 adds separate workflows: one file or two?
- K-01 [MINOR] DoD asks "a second developer reproduces it on a clean clone": who? Another team, the lead? Say "another session of the same team, on a fresh clone".
- K-02 [MINOR] The card edits `e2e-k2.ts` and `e2e-trial.ts` (S3-owned). It says "S3 review", but with no S3 team the review is the product owner (F-06).

**S0-T07 Target admin menu** (P0, Fix, M)
- Plan: edit `src/shells/pentadbiran/menu.ts` to the exact Soalan group of 30 section 3.2 (8 items, positions 1-8 plus sub-group "Bank Lama (Legasi)"), apply the HIDE/MERGE/REMOVE of every BS/KS id in 30 section 3.3; snapshot test; V2 paths stay as redirects (done in S2-T03).
- Q: the dependency "deps: S2-T03" is cross-sector: S0 cannot finish before another team merges (F-09). Q: the test says "no duplicate Bank Soalan", but the target has "Bank Soalan (Studio)" and a group called "Bank Soalan" (current `key: 'bank-soalan'`): is the group label kept? 30 section 3.1 would say; I had to open it.
- X: 30 section 3.3 mixes ids from `menu.ts` (BS/KS/PM) with "no ID" routes, so the test cannot be written from the card alone. K-03 [MINOR] The card should list the 8 labels and routes (it names them but not the routes).
- Duplicates here = menu duplicates (F-21 meaning 1).

**S0-T10 Kawalan Ciri (minimum)** (P1, Build, M)
- Plan: new `feature-flags.prisma` + migration `0250_s0_feature_flags` (DM-34), seeds ~25 V2 toggles; Nest module for list/toggle (API-ADM-09, API-AUTH-16 global FeatureGuard returning 404, API-GAME-10, API-GUR-23); `src/app/features.ts` reads server flags; admin page `/admin/feature-toggles`; Cikgu Alesa and Keluarga Angkat locked OFF.
- Q: which ~25 toggles? The card says "the ~25 V2 toggles that exist in V3"; the list is in 30 N-06 (I would have to open it). Q: page location: `m17-admin-dashboard/pages/` (S6 path) but the contract: "CT/admin -> (S6 owns CT/admin; use new CT/common/feature-flags.ts)" is self-contradictory (F-35).
- X: S0-T10 (Sprint 4) is also the dependency of U-OP-11 and of Delivery B go-live, but S0-T10 depends on S0-T07 which depends on S2-T03: three cross-sector hops for a P1 card.
- K-04 [MAJOR] API-AUTH-16 (a global 404 guard) changes behaviour for every route; the card has no AC list (only "toggle a module and see it appear"). Which AC IDs? `AC-ADM-N06.*` is implied but not written.

### S1 Question model and pipeline (backend)

**S1-T01 Stimulus group invariants end to end** (P0, Complete, L) — requested focus card
- Plan (from docs only): (1) read FR-X1-4a/b/d (40), QE-01/02 (30), DM-01..DM-04, DM-06 (50), API-Q-03/07/08, API-FILE-01 (60). (2) Characterisation test first (S1 principle): create a group of 1 and 3 members; today `group-members.ts:41` returns a warning under 2 and `createGroup` requires 2 (DM-01). (3) Change `STIMULUS_MESSAGES.smallGroup`, `builderBlocker`, the "2+ at creation" rule in `StimuliService.createGroup`, the `GroupMembers` threshold; migration `0120_s1_group_fk_restrict` (`fk_questions_group_id` set null to restrict, clean 409 "Rangsangan ini masih digunakan oleh {n} soalan."); DM-03: projection returns a `group` shape for question-level and part-level stimulus, no backfill; DM-04: a question held by an open servability flag is not "served" for the lock; DM-06 widen `archive_reason` with `regrouped` (migration `0122`). (4) Contract: additive `CT/questions` group shapes. (5) Tests: group of 3 returns 3 members, count 3; add 2nd and 3rd question without re-upload. (6) Files: `BE/questions/{stimuli.service.ts,stimuli.repository.ts,group-members.ts,projection.ts,questions.service.ts,http/**,studio/**}`, `SCH/questions.prisma`.
- Q1: `BE/` and `SCH/` are shorthand (plan section 2). A cold reader must find that table first (K-05).
- Q2: DM-02 also asks for (b) an optional partial unique index "only after the duplicate report is empty" and (c) a SQL pack `apps/api/scripts/uat-ops/group-integrity.sql`: are (b) and (c) in this card? The card's migration line mentions only the FK. (c) lives in an S4 directory (F-35). G: I would implement (a) and (c) as test-only, skip (b).
- Q3: group "scope: section/paper" (API-Q-08) and `stimulusIds[1..3]` appear in the API but nowhere on the card or in FR-X1-4a (F-30). G: support 1..3 as the API says.
- Q4: "zero-member group is blocked" (card) vs "draft only" (DM-01) (F-30).
- Q5: projection "counts exclude stimuli": which counts? Studio list, hub, API `summary`? No list.
- Q6: AC IDs "AC-ADM-QE1.*, QE2.*, Q05.*": the DoD points to wildcards, not a list; I must open 30 and count (about 20).
- X: card Gap says "UAT shows figure-only and figure-less questions (30 section 4.G.7)" but figure-less detection is S1-T07, not this card; boundary unclear.
- K-05 [MINOR] Add a legend line to every card: "BE = apps/api/src/modules, SCH = apps/api/prisma/schema, CT = packages/contract/src, FE = src". Currently only in plan section 2.

**S1-T03 Extraction keeps groups and paper structure** (P0, Complete, L) — question import focus
- Plan: extend `intake/workflow/figure-links.ts` (BE) so extraction output is groups ("Rajah 3 -> soalan 5-8") with members; reviewer edits the range; accept creates one group plus members; the upload's subject/level/paper/year carried to every accepted question (DM-07 section label, DM-08 kertas 1..4, DM-09 intake level); free-text SP checked at entry; golden test fixture (Rajah 3 -> Q5-8, Rajah 4 -> Q9: 2 groups, 5 members, no duplicate figure). API-Q-14, API-Q-15.
- Q: where is the fixture PDF? "fixture paper" is not in the repo path list; G: create a synthetic one (no real paper, public repo). Q: `FE twin` `m28-bijak-spm/admin/intake/domain/figure-links.ts` exists (the card says so in Gap): do I keep two copies of the keyword detector? That is a duplicate in meaning 6. Proposed: BE is the source; FE twin calls the API result.
- X: Q-08 says "PDF max size [PROPOSED 30 MB]" and FR-ADM-Q07.5 says rule-based extraction, no AI provider (D112(2)); the card says `ai-extraction/**` is in Files. Which is it? D112 is not in the decision list (F-20).
- Dep: S0-T03 (worker + OCR) is a Docker/ops item; extraction cannot be tested without Tesseract in CI: Q: do CI images include traineddata? Not stated.

**S1-T05 CSV with DSKP and group fields** (P0, Complete, M)
- Plan: template adds human-readable columns (subject code, Tingkatan, unit code, `sp_kod` `;`-separated, TP, KBAT, kertas, bahagian, number label, `group_key`, `stimulus_text`, `stimulus_image`, `bab_kod`); rows sharing `group_key` become one group with draft members in one transaction; unknown codes reported per row with row number and field; banner clears on next upload. DM-10, API-Q-17.
- X: F-27, three CSV definitions (the 30 spec says subject/level come from the dialog; QE-06 says columns). Blocks the template design.
- Q: how does a CSV carry an image (`stimulus_image`)? A path, a URL, a file id? API-FILE-01 accepts images only via multipart. G: ZIP upload? Not documented. K-06 [MAJOR] `stimulus_image` transport is undefined.
- Q: "one row per leaf" (45) vs "one row per question" (card): how are multi-part questions encoded (parts a, b, c)? 45 says one row per leaf; the card does not. K-07 [MAJOR].

**S1-T10 Accepted batch becomes a draft paper** (P0, Build, M) — extra, question-import
- Plan: `POST /api/intake/batches/:id/paper` creating draft `papers` (+ `paper_sections`, `paper_placements`) via the existing builder services; idempotent per batch and paper code; new `batch-to-paper.service.ts`; migration `0163_s3_paper_source_batch` (S3 range, `needs:schema`). Tests listed (A 10 items, B 5 items, group 5-8). Good, one of the most complete cards.
- Q: "`needs:schema` request to S3": I need the S3 team to add the migration (F-08); if no team holds S3, I am blocked.

### S2 Admin question UI

**S2-T01 Studio list, wizard, group-first entry** (P0, Complete, L)
- Plan: in `StudioListPage.vue` / `StudioEditorPage.vue` / `StudioGroupPage.vue` make "Cipta baharu" start with an optional stimulus and then add questions; completeness panel renders `issues[]` from `GET /questions/:id/gate-check` (API-Q-05) with jump links; "Dilihat murid di" uses S1-T07; remove `lib/submissions-unavailable.ts` copy; Bab uses `ChapterSelect.vue` and is labelled "Bab", DSKP unit "Unit DSKP"; `NO_CHAPTER` blocker links to the Bab field. FR-ADM-Q03.7, QE3.7. Tests: component + `e2e/m04*` "create group of 3, publish".
- Q: which of the wizard field lists applies, 30 Q-04 field-by-field vs 45 section 3.1 (draft, bilingual, scheme editor)? F-23. G: follow 30 and treat 45 as extra only after it is wired.
- X: Files list includes `QuestionCreatePage.vue`, `QuestionEditPage.vue` (the flat legacy form) while 45 section 1.6 says they redirect (F-29).
- K-08 [MAJOR] No field table on the card: the wizard has about 40 fields (45 T-01..T-13+). The card says "30 section 4.G.5 manual flow"; the 30 file has two overlapping places (Q-04 and G.5) and 45 a third. A developer cannot tell the single source of truth for field order.
- Dep L-size: S1-T01 (L) must land first in the same sprint.

**S2-T02 Import & Semakan (3 tabs) and Semak Ekstrak** (P0, Complete, L)
- Plan: tabs `Kelompok Item`, `Kertas Diimport` (needs S1-T10), `Kiriman Guru` (needs S1-T08), review screen with adjustable group range; PDF pane + editor become tabs under 1024 px (FR-X6-11); busy/failed/timeout states; exact copy in 30 Q-07/Q-09; keys A/R/E on review.
- Q: the card says Starts-from `m28-bijak-spm/admin/intake` (a directory), Files add `m04-question-bank/pages/SubmissionListPage.vue`: the same screen exists in two modules (intake in m28, submissions in m04) - which module owns the shell of the tab strip? G: m28 intake page hosts the tabs; m04 page is embedded.
- X: Q-07 reference: "Kiriman Guru tab opens `/admin/question-submissions`" (a separate page with tiles and filter) vs "tab inside the page". Tab or link? F-29-like. K-09 [MINOR].
- Dep: S1-T10's API for tab 2 and S1-T08's for tab 3 may not exist when the UI is built; the card says "deps S1-T03, S1-T04" only (K-10 [MAJOR] missing deps S1-T08, S1-T10).

**S2-T05 Manual entry, CSV import UI, Quick Edit** (P1, Complete, M)
- Plan: `QuestionImportPage.vue` and `ImportHistoryPage.vue` use the new template and show per-row errors; Quick Edit shows completeness.
- Q: "Manual entry" in the title: which screen? The wizard is S2-T01; `Tulis Soalan Manual` (batch form, Q-10) is a different route `/admin/spm/soalan/manual`. F-29. X: V2 page shows a "Halaman ini tidak aktif" notice: replicate or not? (F-27 area.)

### S3 Bijak SPM papers

**S3-T02 One Set Builder** (P0, Fix, L)
- Plan: keep `SetBuilderPage.vue` as the single builder at `/admin/studio/sets`; `/admin/spm/kertas` list redirects; `/admin/spm/kertas/:id` stays as "Semak Kertas Simulasi"; Jana set gets Tahun/Negeri/Bilangan and "Jawab Semua / Pilih N" (section rule control); bank panel adds a group as a unit; two-pane -> tabs under 1024. DM-11 (placement FK, migration `0160`), DM-26; API-BIJAK-10, API-BIJAK-11.
- Q: "Jana set has no Tahun/Negeri/Bilangan ... Sejarah only Kertas 2 (gap F4)": F4 is a finding in the gap analysis (docs/qa/gap-analysis...). Q: the card says Starts-from includes `admin/papers/PaperListPage.vue` which becomes the redirect: delete or keep? Duplicate meaning 1: "redirect, keep URL".
- X: DM table says migration `0160_s3_placement_question_fk` (DM-11) but plan 3 "Not needed: `0160_s3_self_mark`" - the number 0160 is reused. Fine but confusing.
- K-11 [MAJOR] Publish rules: "Terbit with a Disahkan contract needs no exception box; keep the exception path but record it" (S3-T01) and Q-15 "exception always needed" (Gap) - where is the exact flow spec? In 30 Q-13..Q-15; the card does not list the FR numbers, only "Q-13, Q-14, Q-15, QE-07".

**S3-T04 Pupil sitting and result (Bijak SPM)** (P0, Complete, L) — requested focus card
- Plan: compose S8 components in `AttemptPage`, `PaperQuizPage`, `ResultPage`; remove "Tidak disajikan: jenis jawapan tidak dibenarkan dalam bahagian ini" for allowed modes; remove demo message "Fungsi ini belum tersedia dalam demo" from `m28-bijak-spm/server/errors.ts:14`, `server/http-admin.ts:153`; stimulus group once and sticky; submit writes one `practice_answers` row per answered leaf with `mode` `simulasi` or `kuiz` and `attempt_id` through `AnswerLogPort` (S5-T15), idempotent per `(attempt_id, question_id, part_ref)`, then upsert `practice_attempt_aggregates`; API-BIJAK-04, API-BIJAK-06; tests: spec with a group-of-3 paper at 375.
- Q1: ACs: "AC-MUR-13-* (all Bijak ACs)": which of 13-1..25 are Bijak? (F-33). My reading: 13-1..8, 13-14..18, 13-25; 13-9..11 Databank (T07), 13-11 Tracking A (T05), 13-12/20..24 Subjektif (T06), 13-13 hub (T03/T07). The card should say.
- Q2: Dependencies S8-T02/T03/T04 and S3-T02 are all L/M, so this card cannot start for about two sprints; AnswerLogPort (S5-T15) not listed as a dep (F-09). G: I would code against a stub port.
- Q3: Where are Pilih N and Jawab Semua rules enforced: client, server, both? FR-MUR-13-8 says server scores best N; the "Starts from" lists only pages. The server code `exam/` and `bijak/` is S3's too but is not in this card's Files (only `pages/**`, `lib/**`, `domain/**`). K-12 [MAJOR] Card Files omit BE although the answer-store write and the scoring rule are BE.
- X1: FR-MUR-13-16 (Kuiz writes only at `finish`) vs card (submit writes `kuiz` mode by paper kind) (F-32).
- X2: FR-MUR-13-7 "one question or one stimulus group per screen" vs `AttemptShell` navigator; V2 uses printed-sheet pagination. Fine, but the S8-T04 card says "bottom-sheet navigator"; consistent.
- Verification: "on UAT data" but UAT has 0 papers until U-OP-04/08/09 are done by ADM and approved (F-05): the card cannot be verified in Sprint 3 unless Terbit has happened. K-13 [MAJOR] State that AC proof for this card needs S3-T08 (UAT ops) done first.

**S3-T06 Kertas Subjektif and self-mark** (P0, Build, L) — requested focus card
- Plan: admin list/detail/build on `papers` with `surface = 'subjektif'` (API-BIJAK-14, DM-23, migration `0161_s3_paper_surface`); pupil Subjektif answer and Semakan on the EXISTING route `POST /api/bijak/attempts/:id/self-mark` (API-BIJAK-05); `exam_attempts` row of kind `subjektif` (API-PRAC-10 delegates); self-mark updates `marks_awarded` of part rows (mode `subjektif`) via `AnswerLogPort`; no feature flag (D104); AC-MUR-13-24/25 (new). Components: `SelfMarkControl.vue` exists.
- Q1: Type says Build but the self-mark endpoint and the control exist: which parts are new? Admin screens (R1-ADM-Q-18), the pupil lane screens, the paper surface. G: Complete would be more honest. 
- Q2: D81 flow: "uploaded, OCR, edited, published by the admin; not page images; the viewer shows the paper as reflowing text": this reuses the intake pipeline (S1-T03 worker). No dependency on S1 is listed (deps: S3-T04, S1-T09). K-14 [MAJOR] missing deps S1-T03/S0-T03 and S1-T10.
- Q3: AC-MUR-13-23: acceptance needs "a fixture with at least 2 published papers": built by whom, where (UAT = admin content work; CI = fixture)? F-15.
- Q4: "R1-ADM-Q-18", "E-10" (evidence not captured: V2 flag OFF; the Subjektif answer page was never observed): follow V1/D81 text. G: build per FR text and 4.6.
- X: FR-MUR-13-29 says "Markah dinilai sendiri" and FR-13-13 says "Markah kendiri:" (two labels for the same control).

### S4 Curriculum / DSKP and UAT data

**S4-T03 Bab/Topik/SP mapping tool and bulk API** (P0, Build, L)
- Plan: `POST /api/admin/curriculum/questions/bulk-chapter` (API-DSKP-09: strict body `chapterId`, `filter` or `ids[]`, `dryRun`, `expectedCount`; response `matched/eligible/refused/applied/cap/remaining/capped/dryRun/auditId`), `GET .../chapter-coverage` (API-DSKP-10); in-place update of `curriculumChapterId` (DM-17), audit trail; no auto-mapping (D89), no guessing script. UI is S2-T08.
- Q: what is the `cap` (a per-call maximum)? Defined in 60 section 2.17.4 only; fine but not on the card. Q: the "investigation / open question Q3" in plan 5.2 is not defined anywhere I can find (K-15 [MINOR] dangling "open question Q3").
- X: Starts-from is `curriculum/admin.service.ts` "(nothing exists for the new part)": the scope guard treats Build cards as new files at the named location, but the named location is a file that exists (OK).
- Dependency trap: S10-T04 (Sprint 1) needs this card (Sprint 2) (F-09).

**S4-T05 Darjah deactivation (Tingkatan 1-5 only)** (P0, Fix, S)
- Plan: make every picker, list, count and public stat exclude inactive levels (grep for hard-coded level lists); add `check-levels.ts` verification script; public stats must show Tahap = 5. The deactivation itself is U-OP-03 (ADM in the UI).
- Q: "grep for hard-coded level lists" - the exhaustive list of places is not given; DM-12/DM-13 and API-AUTH-13, API-DSKP-02. G: search `D1`..`D6` and `Darjah` in FE and BE. K-16 [MINOR] Give the starting grep.
- Proof: "UAT 11 levels, Tahap = 11" can only be seen on UAT after a deploy and U-OP-03; in CI use a seed with 11 levels (S4-T01). OK.

**S4-T06 T1-T5 learning served (BE)** (P0, Fix, M)
- Plan: change `SPM_LEVEL_CODES = ['T4','T5']` (`practice/rules.ts:41`, still true in the code) and curriculum learner rules to serve every active Tingkatan; subject list per level only for subjects with questions; DM-16, DM-20; API-DSKP-01.
- Q: the card edits `BE/practice/rules.ts` "by agreement" (S5 owns): the agreement is the card text; but who is S5's reviewer? F-08. X: FR-MUR-16-2 says `OFFERED_LEVEL_CODES` at `rules.ts:40-43`; the code constant is named `SPM_LEVEL_CODES` (line 41). K-17 [MINOR] two names for one constant in the PRD and the card.

### S5 Murid learning

**S5-T02 Soalan by Chapter** (P0, Complete, M)
- Plan: subjects and chapters from the Bab mapping; every chapter open (no 70% rule or copy); groups shown once; AC-MUR-9-9 (a question approved through the Studio wizard with a Bab appears on next load); API-GUR-08, API-PRAC-05. Files `m05-practice/pages/Chapter*.vue`, `BE/practice/**`.
- X: F-26: AC-MUR-9-8 "stem text appears twice -> not served" vs OD-3. Blocker for this card's test.
- Q: the card title is the pupil screen but also R1-GUR-9 ("teacher view of the same screens") - are there two sets of ACs, two route sets? Teachers use `/soalan-by-chapter` too? Not on the card's Files. K-18 [MAJOR] teacher screen path is absent.
- Dep: S4-T03 data, which only exists after ADM content work on UAT (U-OP-07); the screen can be built before, but its AC ("Bab 2 opens with Bab 1 unanswered") needs data. F-15.

**S5-T03 Latih Tubi** (P0, Fix, M) — requested focus card
- Plan: read FR-MUR-16-1..12 and AC-16-1..8; use S1 servability (`served-rule.ts`) in `start.planner.ts` / `rules.ts`; counts per D91 (card count = detail = drawable); draw by whole groups (FR-MUR-16-5 algorithm: add whole groups while they fit, then singles; a last overshooting group means a shorter quiz with a message); T1-T5 levels plus "Semua Tahap"; difficulty labels 1..5 ("Sangat Mudah" ... "Sangat Sukar"); button "Semak Jawapan"; Syiling credit reads `reward_settings.coins_per_correct` (default 1) not the old constant; 10 mata per correct; rows to `practice_answers` mode `latih_tubi` through `AnswerLogPort`; tests: no stimulus-less item in 200 draws.
- Q1: exact result-screen copy: the PRD says "Result as above" and the V2 flag is OFF, so the Latih Tubi setup screens come from V1 notes (`docs/discovery/M05-practice.md`, which exists) and "the V2 mechanism doc" (10-murid cites "V2 mechanism section 2.1" with no file name or path). K-19 [MINOR] give the path of the "V2 mechanism doc".
- Q2: "Ringkasan" summary tile wording and "Soalan Tidak Mencukupi" copy are given (V1). OK.
- X1: F-26 (duplicated stem). X2: PRD reference "Pilih Tahap Pendidikan (only T4, T5 and Semua)" vs FR-16-2 T1..T5 (F-34). X3: card says "the PRD constant 2 is dropped" for Syiling; AC-MUR-16-4 uses 1 and 3 - consistent. X4: V-STD step 3 (compare with V2) impossible because V2 redirects `/practice` (F-16).
- Dep chain: S1-T06 (M) + S1-T07 (M) + S8-T02 (M), all required; S1-T07 detectors must exist before AC-16-8 can be tested.

**S5-T15 Single answer store: mode column and write path** (P0, Complete, M)
- Plan: migration `0181_s5_answer_store_mode` adding `mode`, `attempt_id`, `part_ref`, `marks_awarded`, `marks_max` to `practice_answers` (nullable, backfill from the session mode, then NOT NULL + check); new `answer-log.port.ts` with `AnswerLogPort.record(...)`; existing check-answer calls it; expose to Bijak, Subjektif, Set Soalan, games; dry-run backfill script for past Bijak; a lint-style test that fails if any module inserts into `practice_answers` without the port; XS-4 numbers test (10 Latih Tubi + 40 Bijak = 50 on every screen).
- Q: the mode registry is "50 section 4.7a": I would need to open it (about 15 values); the card says "mode registry" without listing. K-20 [MINOR].
- Q: "a lint-style test that fails when a module inserts into `practice_answers` without the port": how (ESLint rule, grep test)? G: a vitest scanning `src` for `practiceAnswer.create`. Fine.
- X: card is S5 but touches `BE/bijak/integration/` (S3 review) and the backfill for UAT is a data operation (a new U-OP not in the 17): who runs it, and which U-OP id? K-21 [MAJOR] The Bijak backfill is not in the U-OP list or the runbook.
- This card is the root of AC-CHAIN-1,3,4 yet is only in Sprint 2 (F-09).

### S6 Guru, Admin Sekolah, Admin Pusat users

**S6-T01 Laporan Mingguan Guru** (P0, Build, L) — requested focus card
- Plan: new `GET /api/guru/weekly-report?classroomId=&week=YYYY-MM-DD` (API-GUR-21; teacher, own classes, another class = 403); page `/guru/laporan-mingguan-kelas` (alias `/guru/laporan-mingguan`) with toolbar (Pilih Kelas, Cetak), print title, 4 tiles, Top Performers (>= 5 answers, top 5), Paling Meningkat, Subjek Perlu Perhatian (< 50%); fix menu target `user-nav.ts:287` (S0-T06 does the menu); remove `PrototypeUnavailablePage` in `m11-teacher-analytics/routes/laporan-mingguan.ts:12-27`; figures count all modes from `practice_answers` (XS-8); print A4 portrait; 375: tiles 2x2.
- Q1: where does the service live? "weekly service is S10's folder: S10 reviews; endpoint under `BE/command-center/guru/` is the alternative if S10 objects" - left to me (K-22 [MINOR] decide: use `reports/performance/services/weekly-report.service.ts` as the PRD cites).
- Q2: `week=YYYY-MM-DD` parameter vs FR-GUR-43-5 "no week navigation": what is it for? G: Monday of the requested week, default current. K-23 [MINOR].
- Q3: names of pupils appear in Top Performers; in public-repo tests use fictitious names (rule in START-HERE, fine).
- X: F-28 (1 decimal vs whole number). Dep: the all-modes ACs (43-8, 43-10) need S5-T15 (F-09); card deps only S0-T06.
- Good: the PRD for this module is the clearest I read: regions in order, computation rules, 10 ACs with tags.

**S6-T14 Teacher Set Soalan and Kelas Saya (guru)** (P1, Build, L)
- Plan: new teacher pages `/guru/set-soalan`, `/cipta`, `/:id`, `/:id/keputusan` (list with counters, create/edit from approved questions only, Terbitkan/Draf/Jadikan Draf, Salin to a class, results per class); `classroomIds[]` on create/update/copy (API-GUR-16), table `question_set_classrooms` (DM-46, migration `0201`, backfill one row per existing set); partial stimulus group = 422 "Soalan dalam kumpulan rangsangan mesti dipilih bersama."; pupil session mode `question_set`; archived question drops out; API-GUR-01..04.
- Q1: "Starts from `SetSoalanSayaPage.vue` (the pupil-facing list)" for a teacher feature: new pages go where? `m10-teacher-class/pages/**` (S6): fine.
- Q2: Title says "and Kelas Saya (guru)" - R1-GUR-8 (Kelas Saya) appears in the PRD, and the pupil side is S5-T08; what is new for teachers in Kelas Saya? Not on the card body (only Set Soalan). K-24 [MAJOR] Title promises Kelas Saya (R1-GUR-8) but the body covers only 8b; confirm scope.
- X: pupil can no longer join a class by code (D-A8, FR-MUR-8-3, `POST /kelas-saya/join` removed) - this card lists API-GUR-04 (class code?) - what does a teacher do to add pupils? "Guru anda yang menambah pelajar" - add pupil flow is S6-T10 (Pelajar Saya). OK.
- BE in `classes/question-sets` is S1's carve-out (F-08, F-35).

**S6-T16 Soalan & Rujukan (guru personal MCQ with a reference link)** (P1, Build, M)
- Plan: migration `0127_s1_personal_question` (S1 range, small PR to S1, `needs:schema`) + visibility predicate in every served set (`served-rule.ts`); `BE/classes/teacher-tools/personal-questions.*` CRUD (own only, another id = 404, http/https links only, Tingkatan 1-5); mission draw adds the owner's personal questions for the owner's classes only; pages `/guru/soalan-guru`, `/cipta`; link opens in new tab on the pupil screen; delete-only PR to S0 removes two routes from `GURU_TOOLS`. DM-42; API-GUR-24/25.
- Q: three other-sector PRs are required (S1 schema + predicate, S0 nav). Which card ID do they carry (F-08)? Is the S6 team allowed to hold S1's locks? This card cannot be completed by an S6-only team. K-25 [MAJOR] State who opens the S1 and S0 PRs and in which order; at least schema PR first.
- Q: `DV-GUR-44a-1/2` (deviations) are mentioned without text; I would open 20 to read them.
- Dep: "S6-T07 (Misi Harian)" - the mission draw is built in S6-T07, a P1 L card; the personal-question serving cannot be tested until then.

### S7 Gamification, games

**S7-T01 Permainan (pupil) on real API** (P1, Verify, S) — requested focus card
- Plan: PRD R1-MUR-21: games hub lists working games; question-based games write each answer to `practice_answers` mode `game` via `AnswerLogPort`; admin setting "Mini-games beri syiling?" decides whether Syiling is credited; rate from `reward_settings`; level pickers T1-T5 only; room codes 6 characters; remove mock paths under `m16-battle-games/mock`; AC-MUR-21-1..6.
- X1 (F-22): Type Verify (no product code) but the work is code: port calls in `BE/games`, `BE/battle`, mock-path removal. The scope guard will fail it.
- X2 (F-09): reads `reward_settings` (S7-T05, Sprint 5) and `AnswerLogPort` (S5-T15) but lists only S0-T09.
- Q: "E-7 evidence" (games hub not observed in V2) - nothing to compare with (F-16). Q: which games are "question-based" (Papan Bijak, Battle, Perang Fakta, ...)? The PRD lists names but not which use bank questions; the code decides: K-26 [MINOR] list them.
- Q: FR-MUR-21-1 "a game without playable content is hidden (no 500 such as V1 Sambung Kata)" - the "playable content" test is undefined.

**S7-T02 Sekolah Bersaing (school admin)** (P0, Fix, M)
- Plan: compute the board on request from live sessions (average session accuracy per school over T1-T5 sessions; no weekly job or `week` line; DM-31; API-AS-14); delete the `SB_WEEKS` seed read in `m16-battle-games/mock/data/sekolah-bersaing-seed.ts`; highlight own school; restrict the route to Admin Sekolah and Admin Pusat (OQ-API-09).
- Q: "average session accuracy" vs XS-5 "pooled accuracy"? Different formulas: per-session average vs pooled. K-27 [MAJOR] FR-AS-45-4 uses session average while XS-5 and F-10 require pooled; confirm Sekolah Bersaing is the exception (the card says session accuracy explicitly, so I would follow the card).
- Q: which sessions count: only battles, or all modes now in the answer store? "over T1-T5 sessions" is ambiguous.

**S7-T05 Kedai Hadiah, Kedai Hadiah Digital, Tebusan, Kawalan Reward** (P1, Complete, L)
- Plan: `reward_settings` singleton table (migration `0223_s7_reward_settings`, `coins_per_correct` default 1, `mini_games_give_coins`) with API-ADM-16 `flatCoins`; admin Kedai Hadiah/Tebusan/Kawalan Reward screens (P2-07..09) and pupil Kedai Hadiah (MUR-31, 38); redeem -> queue -> deliver/cancel; U-OP-13 activation is ADM.
- Q: Delivery A vs B: MUR-31 is A (linked) and MUR-38 B, the card is one L card; which part is the Sprint 5 deliverable? G: DM-48 and API-ADM-16 first (they unblock S5-T03/S7-T01), rest later. K-28 [MAJOR] Split the card: the coin-rate part is a P0-ish dependency of S5-T03, S3-T04, S7-T01, but the card is P1 and L.
- Q: `FR-ADM-P2-08.4` and `09.3` (new from audit) wording is in 30; "pending_admin row has Hantar kod and Batal; delivering stores the code and notifies" - V1 form never captured (E-14): follow text.

### S8 Rendering and responsive

**S8-T02 Stimulus panel: once, sticky, zoomable** (P0, Fix, M)
- Plan: group panel above its questions; on < 768 px a collapsible sticky "Lihat Rajah"; pinch/tap full-screen zoom; table/passage/graph stimulus kinds; long maths scrolls inside; files in `src/components/question-display/{StimulusGroup,StimulusFigure,StimulusView,StimulusStack}.vue`; component tests with a 375 snapshot; spec in `e2e/bijak`.
- X1: the threshold. S8-T02 says < 768 px collapsible chip; FR-MUR-13-9 says below 1024 px a chip, from 1024 px pinned beside. Which is the breakpoint (768 vs 1024)? K-29 [MAJOR] Pick 1024 (FR-MUR-13-9, FR-X6-11 use 1024) and fix the card.
- X2: "3/15 stimulus types supported" - the 15 types are listed in `docs/requirements/v2-exam-schema.md`; the card does not list them. Q: which types are in R1 (45 D-QA-6, 2.4)? G: all 15 per schema except where P2 is declared. K-30 [MINOR].
- Dep: S8-T01 (the move) lands first; if the move is late, S8-T02 conflicts with S3 pages (F-09).

**S8-T03 Answer widgets and maths input** (P0, Complete, L)
- Plan: complete 14 widgets (8 exist): full-width MCQ, short text, working + final answer, "Pilih N", photo upload; `MathField`/`MathKeyboard` usable on the phone keyboard; touch >= 44 px; tests per mode. D41, OQ-MUR-13, FR-X6-8.
- X: the widget list: OQ-MUR-13 / S1-T09 (P1 modes `match_letter`, `working`, "Pilih N"; `drawing`/`table_fill` P2) vs 45 D-QA-2 (`drawing`/`table_fill` in R1) (F-23). Q: "photo upload" writes through API-FILE-01 `bijak_photo` purpose (images, 2 MB limit for avatar-like?). The size limit for answer photos is not stated. K-31 [MINOR].
- Dep S1-T09 is Sprint 4 but this card is Sprint 3 (F-09).

**S8-T04 Navigator, timer, Hantar on phone** (P0, Fix, M)
- Plan: bottom-sheet navigator showing answered/flagged; sticky timer/Hantar not covering the question; landscape rotation keeps place; legend with colour key + shape/icon (AC-13-18); badge "Mod Peperiksaan/Latihan" visible; "Lapor Soalan" inside the question card toolbar (AC-13-16).
- Q: the card lists FR-X6-8/9 only; the ACs it must satisfy are in 10-murid (AC-13-15,16,18) - not on the card. K-32 [MINOR] list them.
- Q: how to prove "on-screen keyboard does not cover Hantar" (S8-T03/T04) - needs a real phone/emulator; the headed browser emulation does not reproduce the OS keyboard. F-15.

### S9 / S10 Verification and reports

**S10-T01 Prestasi 360 (pupil own data)** (P0, Fix, M)
- Plan: route `/prestasi` for a pupil renders own `Prestasi360Page` (`/prestasi/:userId` with own id); BE rejects school-wide endpoints for the student role (`access-policy.ts`, `privacy.ts`); metrics over `practice_answers` all modes (XS-4/5/7); Bijak sittings as one unit in the session list; AC-MUR-4-8, AC-X4-1; API-RPT-01/02.
- X1: F-31: the cited cause (`student` in `PRESTASI_SCHOOL_ROLES`) is no longer in `prestasi.ts`. I would first re-run the gap check; the redirect `/prestasi -> /prestasi/sekolah` may remain.
- X2: F-28 precision; X3: F-09: needs S5-T15 for "all modes" but is Sprint 1.
- Q: "Bijak sittings appear as one unit in the session list": from `practice_attempt_aggregates` or `exam_attempts`? G: aggregates.

**S10-T02 Headcount (pupil, guru, school admin)** (P0, Complete, L) — requested focus card
- Plan: implement HC-SPEC (20 R1-GUR-3, HC-1..HC-6) once in `BE/reports/performance/**`: TOV, ETR, OTR_k = round(TOV + (ETR - TOV) x r_k), Auto AR = round(correct / answered x 100) over `practice_answers` all modes, status "On Track" = AR >= OTR_k of the latest checkpoint with an AR, Jurang = ETR - TOV, Unjuran, Keyakinan; pupil read view (cards "Lihat Data Saya"), guru key-in AR, edit TOV/ETR, Unjuran, Tetapan; AS read-only school list; `PUT /api/headcounts/:id/defaults` ("Simpan Sasaran", DM-49 migration `0191`); fix pupil `/headcount` 403 in `routes/headcount.ts`; replace `HeadcountShellPage.vue` shells. API-AS-15, API-RPT-08/09/10/16.
- Q1: the English status words stay (OQ-MUR-12). Q2: "Keyakinan" thresholds and "Unjuran" formula are in HC-6: fine but I read it three times; K-33 [MINOR] a worked example exists only in AC-CHAIN-5 (40): link from the card.
- Q3: "headcount data for evidence E-1" - E-1 means a V2 capture the lead has not taken (10-murid 6.3). The card cannot be compared to V2 (F-16).
- X: one card covers three roles' screens (pupil, guru, AS) at L: about 25 screens/states and 40+ ACs; "Anything >6 days must be split" (sizes rule) but this is L with three roles. K-34 [MAJOR] split by role (BE rules + guru, pupil, AS).
- Dep: S5-T15 for AR (F-09).

**S10-T03 Analisa Item (pupil, guru, school admin)** (P0, Fix, M)
- Plan: add the missing pupil target in `analisa-item.ts:43` (`analisaItemTarget`), fix the guru band contradiction and unbound sort; "Soalan Diuji" = distinct questions (XS-7), counters count all modes (XS-8); discrimination index needs at least 10 pupils [PROPOSED]; API-AS-17, API-RPT-05/06/07.
- Q: "guru band contradiction": which contradiction? The card says it, the PRD for GUR-6 must define the band; I had to search. K-35 [MINOR]. Q: `[PROPOSED]` on a value means "no source": am I allowed to build it? F-20: define.
- Dep S0-T05 (unhide) and S5-T15.

**S9-T06 End-to-end data chains AC-CHAIN-1..9** (P0, Verify, L)
- Plan: nine Playwright specs `e2e/r1/chain-n.http.spec.ts` that enter ONE record on the first side and assert the same figure on every other side; CI on the seed, acceptance on UAT headed at 3 widths; failing chains go back to the owning card.
- X: F-36 (who writes the specs); F-05 (writing test records on UAT); the chains cover three sprints so the card is "recurring" yet marked L P0 and "owned by Delivery Lead (no claim)"; K-36 [MINOR] state that the specs are a deliverable of the last card in each chain.

**S9-T01 Per-sprint UAT acceptance walk** and **S9-T03 XL integration pass** (P0, Ops, M)
- Plan: run the sprint's exit ACs in a headed browser (T5 pupil first), update the AC ledger (a file that does not exist: F-02/F-19); XL pass: links resolve, ids/enums agree, seeds coherent, permissions consistent, `r1-trace-check` exit 0.
- Q: S9 has no lock and "recurring, no claim": can another team do S9-T03? G: no. Q: the XL pass is a read-only review; it needs the ledger and the deployed build; depends on F-04.
- K-37 [MINOR] These two cards "Start from `docs/prd/r1/40-cross-cutting.md`" - not a file to change; guard will WARN? (Ops: no product code; fine.)
## 4. FAQ (ready to paste as `docs/plan/R1-FAQ.md`)

Answers marked **[PROPOSED]** are not yet in the docs; the product owner must confirm them before the file is published. Everything else is quoted from the existing documents (links given).

---

# R1 FAQ (plain English)

Read [R1-START-HERE.md](R1-START-HERE.md) first. This page answers the questions a new team asks on day one.

## A. Getting started

**Q1. Which documents do I read, in which order?**
1. [R1-START-HERE.md](R1-START-HERE.md) (one page: the rule and the 10 steps).
2. [docs/prd/r1/00-index.md](../prd/r1/00-index.md) (what each file is, how IDs work).
3. Your card in [r1-development-plan.md](r1-development-plan.md) section 4, then the PRD sections named on the card's `PRD:` line.
4. Only when needed: [40-cross-cutting.md](../prd/r1/40-cross-cutting.md) (shared rules), [50](../prd/r1/50-data-model-erd.md) (data: DM rows), [60](../prd/r1/60-api-contract.md) (API rows).
Documents in `docs/plan/` that are not named here (BE cards, `AGENT-SYNC.md`, `backend-tracker.md`, `onboarding.md`) are from the earlier backend programme. Do not follow their branch or claim rules. **[PROPOSED]**

**Q2. What is the one rule?** Check what already exists, close only the gaps, never rebuild. A card is done when the existing code meets its acceptance criteria (ACs). See [START-HERE "The rule"](R1-START-HERE.md) and [plan section 0B](r1-development-plan.md).

**Q3. What do "Keep / Verify / Fix / Complete / Build / Ops" mean for what I may change?** Keep and Verify: no product code unless an AC fails (then a one-line fix named in the issue). Fix and Complete: edit the "Starts from (existing)" files; a new file only if the card names it. Build: new files only at the named location. Ops: no product code. See [plan section 0B](r1-development-plan.md).

**Q4. What do the internal codes mean?**

| Code | Plain meaning | Where defined |
|---|---|---|
| D100..D113, D-A1.., D-API-n, D-QA-n | Decisions by the user or the Delivery Lead. D100 = everything in the matrix must work. | [01 section "decisions"](../prd/r1/01-product-overview.md), plan 4.0D, [45 section 0](../prd/r1/45-question-authoring-flow.md) |
| URS / FR / AC | User requirement / functional requirement / acceptance criterion (a testable "Given/When/Then") | [00-index "ID chain"](../prd/r1/00-index.md) |
| R1-MUR-n, R1-GUR-n, R1-AS-n, R1-ADM-xx | A module (screen group): pupil / teacher / school admin / central admin | [00-index "ID conventions"](../prd/r1/00-index.md) |
| DM-nn | A data change (table, column, rule, data fix), with its migration number | [50 section 4](../prd/r1/50-data-model-erd.md) |
| API-AREA-nn | One endpoint (or group). Exists-OK = verify only; Exists-Fix = change the stated defect; Missing-Build = add it | [60 section 2](../prd/r1/60-api-contract.md) |
| BS-nn, KS-nn, PM-nn | Ids of sidebar entries in `src/shells/pentadbiran/menu.ts` (BS = group "Bank Soalan", KS = group "Kertas & SPM", PM = a monitoring group). The merge/hide/remove decision per id is in [30 section 3.3](../prd/r1/30-admin-pusat.md). | menu.ts, 30 3.3 |
| U-OP-nn | A one-off data operation on UAT (for example load DSKP, map chapters). Run by the designated UAT developer or by admin users, always dry-run first and with the user's approval | [plan section 7](r1-development-plan.md), [30 section 5](../prd/r1/30-admin-pusat.md) |
| XS-1..8 | The agreed definitions of numbers shown on more than one screen (pupils, active pupils, teachers, answered, accuracy, scope, "questions tested", answer source) | [20 section 5](../prd/r1/20-guru-admin-sekolah.md) |
| HC-SPEC (HC-1..6) | The one set of Headcount rules (TOV, ETR, OTR, AR, status, projection) used by every screen | [20, R1-GUR-3](../prd/r1/20-guru-admin-sekolah.md) |
| FD-xx | A deliberate difference from V1/V2 (fidelity deviation), listed per module | each module section |
| OQ-xx / OD-xx | Open question / open data question. All are closed; "closed" answers are written in the module | 00-index "Open questions" |
| DV-xx, DK-xx, RP-xx, QP | Deviation note / DSKP-level rule / responsive pattern / question-paper contract (FR-MUR-QP-1..17) | 20, 10 section 4.10, 20, 10 section 4.8 |
| E-nn | A piece of V2 evidence the Delivery Lead still has to capture. "Not observed in V2" means: build from the FR text, do not block | [10 section 6.3](../prd/r1/10-murid.md) |
| OPT-* | A shared option list (for example the list of Kertas values) used by forms, CSV and filters | [45](../prd/r1/45-question-authoring-flow.md) |
| `[PROPOSED]` | Copy or a value with no source in V1/V2/code; needs copy review (D94) but you may build it | 45 section 10.4 |
| P0 / P1 / P2 | Blocks release / important / polish. All are in scope. | 00-index |
| Delivery A / B | Order of delivery, never less scope | 00-index "Delivery order" |
| Tingkatan / Darjah | Secondary form 1-5 / primary year. Only Tingkatan 1-5 exists in R1 (D72, D96) | [40 X3](../prd/r1/40-cross-cutting.md) |
| Bab / SP / TP / KBAT | Textbook chapter / DSKP learning standard / performance level (1-6) / higher-order thinking | [40 X8](../prd/r1/40-cross-cutting.md) |
| Terbit / Disahkan | Published / verified (a verified contract is required before a paper is shown to pupils) | 40 X8 |
| Kontrak (blueprint) | The rule set of a paper: sections, quotas, marks | 40 X8 |

**Q5. What is "duplication in V3"? What do I keep?** The word is used for six different things. Delete or hide only what the documents list.
1. *Duplicate admin screens and menu entries* (three lists called "Bank Soalan"; Pembina Kertas and Set Builder show the same papers; two review queues). Keep one screen; the others become a redirect or a hidden link. The full keep/merge/hide/remove table is [30 section 3.3](../prd/r1/30-admin-pusat.md); the one canonical screen per function is [45 section 1.6](../prd/r1/45-question-authoring-flow.md).
2. *Duplicated stem text* (a stem repeated as the only part's prompt). Show the text once; the data is cleaned later (DM-40). Do not hide the question for this reason **[PROPOSED, see F-26]**.
3. *A figure copied per question, or a figure that is itself a "question".* One stimulus group holds the figure once and its 1 to n questions ([40 FR-X1-4](../prd/r1/40-cross-cutting.md)).
4. *Two places that store or compute the same number* (two answer tables, different totals on different screens). One answer store, `practice_answers`, and the XS definitions ([40 FR-X4-5](../prd/r1/40-cross-cutting.md)).
5. *Duplicate routes* (for example `/leaderboard` and `/gamification/leaderboard`). Keep one; the other redirects.
6. *Duplicate code you might add* (a second page, service, store, route or table for something that exists). Forbidden ([START-HERE "Hard rules"](R1-START-HERE.md)).
If you find a duplicate that is not on a list: do not delete it; comment on the issue.

## B. Claiming and working

**Q6. How do I claim a card?** Your team must hold the lock for the sector, then lock the card (`node scripts/r1-lock.mjs acquire S<n>` then `acquire S<n>-T<nn>`, with `--team team-<name> --session S-<k>`). The lock is the only claim. Exit code 3 = another team has it; 4 = you are not the holder or the sector is not yours. Mirror it on the issue with the `team:<name>` label. Ignore any text that says "assign yourself" or "comment /claim". **[PROPOSED]** ([START-HERE step 3](R1-START-HERE.md), [ORCHESTRATOR section 1](R1-ORCHESTRATOR-PROMPT.md)).

**Q7. Lock cheat-sheet.** `register-team` (once, from the lead session) · `list` (all locks; STALE after 24 h without heartbeat) · `mine --team ...` · `acquire S1` / `acquire S1-T03` · `heartbeat-all` (daily) · `release S1-T03` (after merge or if you drop it) · `break` is for the product owner only. The tool needs push rights to the repo. Hold at most 3 sectors and never hold one idle for more than a day.

**Q8. What do I name my branch, commits and PR?** Branch `r1/<team>/<card>-<slug>` from `feature/v3-bijak-r1`; commit subject `S<n>-T<nn>: <what>`; PR title `S<n>-T<nn> <title>` and the PR body names exactly one card ID. Put `[team/S-k]` in issue comments and the PR body. **[PROPOSED; resolves START-HERE vs ORCHESTRATOR]**

**Q9. What is a "gap check" and where does it go?** Before your first commit, open every file under the card's "Starts from (existing)" and post an issue comment with a table: requirement (FR/AC) | works / broken / missing | file and symbol | planned change. Example row: `AC-MUR-16-5 | missing | practice/start.planner.ts::plan | add warning when available < chosen`. File and line numbers on cards were true on 2026-11-04; find the code by name. Only then move the card to `status:in-progress`.

**Q10. What if another sector's file must change (migration, contract, menu, nav)?** Open a small "dependency PR" that carries your card ID and the line `Cross-sector: S<m> (reason)`, label `needs:S<m>`/`needs:schema`/`needs:contract`. The owner sector reviews it within 24 hours. Use only your sector's migration number range ([plan section 3](r1-development-plan.md)). **[PROPOSED]**

**Q11. What do I do when I am blocked, or the docs contradict each other?** Comment on the issue with the question, the two places that disagree and your proposed answer; add `status:blocked`. Do not guess. The tie-break order is: the SRS (10/20/30) wins on behaviour; 50 and 60 win on technical shape; where they disagree, the user's principles ([01](../prd/r1/01-product-overview.md)) decide: improve not rebuild, follow V2 for unchanged flows, follow the DSKP, stimulus groups of 1 to n, one answer store, privacy. ([00-index "Rules of the chain"](../prd/r1/00-index.md))

**Q12. Which card first? What is the order?** P0 before P1. Respect `deps:` on the card: a dependency is satisfied when its PR is merged and CI is green. **[PROPOSED]** Critical path: S0-T02 stack, S1-T01 groups, S1-T03 extraction, S2-T02 import UI, S3-T02 Set Builder, S8-T01..T04, S3-T04 pupil sitting, S4/S3 UAT operations ([plan section 5.2](r1-development-plan.md)). The first team should take S0 (stack and shared files).

## C. Testing, proof and review

**Q13. What must I run before I push?** `npm run typecheck`, `npm run lint`, `npm test`, for backend `npm run be:verify`, `npm run contract:check` if the contract changed, plus `node scripts/r1-scope-guard.mjs --base origin/feature/v3-bijak-r1 --head HEAD` (set `PR_BODY`) and, if you touched docs or the plan, `node scripts/r1-trace-check.mjs`.

**Q14. How do I run the stack, and with which accounts?** `npm ci`, then `npm run stack:up` (Docker; UI on port 5192/5193). Local demo logins are in [docs/AKAUN-DEMO-LOCAL.md](../AKAUN-DEMO-LOCAL.md). Until card S0-T02 is merged the stack may not start; then use unit tests and `npm run be:dev`. A cloud session without Docker runs unit, typecheck, lint and contract checks only. The demo seed is for automated tests, never for acceptance.

**Q15. Where do I prove the acceptance criteria?** Two stages. **[PROPOSED]** Stage 1, before merge, by you: automated tests in CI and locally for every AC that needs fixtures (tag `[CI]`); the PR lists "ACs awaiting UAT". Stage 2, after merge and after the designated UAT developer deploys: the Delivery Lead or a UAT tester runs the `[UAT]` ACs in a visible browser at 375, 768 and 1280 with no horizontal scroll, and every AC-CHAIN that passes through your card. Evidence stays in your local `.evidence/<card>/` (gitignored); issues and PRs carry only pass/fail and AC IDs.

**Q16. How do I get UAT logins?** The Delivery Lead hands out role logins out of band (pupil T1, pupil T5, teacher, school admin, admin). They are never written in the repo, an issue or a PR. Agents never receive them and never open UAT, V1 or V2. **[PROPOSED]**

**Q17. Who may write to UAT?** The designated UAT developer runs data operations (dry-run, report, the user's approval, real run). Admin users do content work (Bab mapping, figures, regrouping) in the Portal Pentadbiran. A UAT tester may create clearly prefixed test records for the AC-CHAINs, removed afterwards (U-OP-14). No AI session touches any server. **[PROPOSED where it extends the existing rule]** ([plan section 7 RACI](r1-development-plan.md))

**Q18. Who reviews and merges? What does "Done" mean?** CODEOWNERS requests a review from the owner of every path you touch; today that is the product owner for all paths until sector leads are declared. Squash merge after review and green CI. **Merged** is not **Done**: the Delivery Lead moves a card to `status:done` only after re-running its ACs on UAT. A failed AC sends it back to `status:in-progress`. ([START-HERE steps 9-10](R1-START-HERE.md), [plan 6.5](r1-development-plan.md))

**Q19. What does CI check?** `r1-scope-guard` (one card ID; change budget by Type; new page/controller/model needs a DM/API ID; warns if no "Starts from" file is touched or a file loses more than 60% of its lines), `r1-docs` (trace-check: every PRD module has a card, every DM/API has exactly one owning card), plus the existing frontend/api jobs.

**Q20. How do teams avoid clashing?** Sector locks (a sector owns its paths), card locks, migration number ranges per sector, contract-first PRs, S0 as single owner of shared files (menu, nav, schema index, contract index, seeds index, CI), delete-only regions in scope lists. Short branches, rebase daily, PR up to about 400 lines. ([plan section 3](r1-development-plan.md))

## D. Product rules you will meet on many cards

**Q21. What is a stimulus group?** One figure, passage, table or graph (the *stimulus*) with the 1 to n questions that refer to it (a *group*). A stimulus is never a question and carries no marks. It is entered once, shown once above its questions (sticky on a phone), moved, drawn, published and archived as one unit. A group with 1 question is valid. ([40 FR-X1-4a..f](../prd/r1/40-cross-cutting.md))

**Q22. What is the single answer store?** `practice_answers`. Every pupil activity that answers a question (Latih Tubi, Soalan by Chapter, Databank, Kuiz, Bijak sittings, Tracking A, Subjektif self-mark, Set Soalan Guru, games) writes there with a `mode`, through the one `AnswerLogPort`. Every report reads only that store, so the same number shows on every screen. ([40 FR-X4-5](../prd/r1/40-cross-cutting.md), DM-44, XS-8)

**Q23. Does a question need a Bab, SP and TP to be published?** Yes: Bab when the subject and Tingkatan have chapters, SP, and TP/aras (for T4/T5 papers). Old questions without a Bab are listed in the admin work-list "Soalan tanpa Bab"; admin users fix them in bulk by filter, never by an automatic guess (D89). ([30 QE-03/QE-04](../prd/r1/30-admin-pusat.md), [60 API-Q-05](../prd/r1/60-api-contract.md))

**Q24. Which pupil levels exist?** Tingkatan 1 to 5 only; no Darjah anywhere. T1-T3 pupils practise like T4-T5 wherever questions exist (D101).

**Q25. Which modules stay hidden?** Only Cikgu Alesa and Mohon Keluarga Angkat (D102). A hidden module answers with the standard 404 page, never "akan datang".

**Q26. What copy do I use?** The exact Bahasa Melayu text in the PRD. Code, commits and docs are in English. No placeholder text ("akan datang", "belum tersedia", "Pratonton", "prototaip") on any screen. New copy needs approval (D94).

**Q27. Privacy: what can I put in GitHub?** Nothing that identifies a real person or secret: no names, e-mails, IC, phone, passwords, tokens, server addresses. Use fictitious data. UAT holds real pupil data: screenshots stay local; issues and PRs carry pass/fail and IDs only.

## E. Where to find answers that already exist but are hard to find

| If you wonder... | Look here |
|---|---|
| Which menu entry do I keep or redirect? | [30 section 3.3](../prd/r1/30-admin-pusat.md) |
| How does a question enter the system, step by step? | [45](../prd/r1/45-question-authoring-flow.md) (draft) and 30 QE-01..08 |
| What does the pupil see in a paper (stimulus, navigator, Hantar)? | [10 section 4.8 and FR-MUR-QP](../prd/r1/10-murid.md), [40 X6.1](../prd/r1/40-cross-cutting.md) |
| Is this number the same on every screen? | XS in [20 section 5](../prd/r1/20-guru-admin-sekolah.md) |
| Which API do I add or change? | the card's `Data/API:` line, then [60 section 2](../prd/r1/60-api-contract.md) and 2.17 |
| Which migration number do I use? | [plan section 3 table](r1-development-plan.md) |
| Which UAT operation is mine? | [plan section 7 runbook](r1-development-plan.md) |
| Which ACs make an end-to-end chain? | [40 section X9](../prd/r1/40-cross-cutting.md) |

---

## 5. Doc-fix list (file -> section -> change)

| # | File | Section | Change | Fixes |
|---|---|---|---|---|
| 1 | `README.md`, `AGENTS.md`, `CLAUDE.md`, `docs/README.md`, `docs/plan/README.md` | top | Add the R1 banner (link to R1-START-HERE and R1-FAQ); mark BE-card docs as legacy; update AGENTS.md "Current phase" | F-01, F-12 |
| 2 | `CLAUDE.md`, `AGENTS.md` | new "Release 1 precedence" | State that START-HERE wins for cards S*-T* on branches, commits, PRs, claims and scope | F-12 |
| 3 | `docs/plan/R1-START-HERE.md` | Steps 3, 5, 6, 10; new boxes | One claim system (lock is the truth); one naming rule; two-stage proof; cross-sector rule; lock cheat-sheet; "Day 1" box; "What duplicate means"; dependency-satisfied rule | F-02, F-03, F-04, F-08, F-10, F-14, F-17, F-21 |
| 4 | `docs/plan/R1-ORCHESTRATOR-PROMPT.md` | 0, 1.3, 1.8, 3 | Replace critical path with plan 5.2; align branch/commit naming; state the 3-sector cap is a convention; fill in the designated UAT developer rule; one environment paragraph per session | F-03, F-09, F-13 |
| 5 | `docs/plan/r1-development-plan.md` | section 0 "Where work happens" | Remove the single-clone / no-worktree paragraph or limit it to the Delivery Lead PC | F-13 |
| 6 | same | 6.1-6.3, 6.6, 6.9 | Remove self-assign/`claim`; unify label list with the real labels; drop `r1-board.md`/ledger rows or create the files | F-02, F-07, F-19 |
| 7 | same | 4 (V-STD, DoD-T) | V-STD 3 only at Delivery Lead verification; tag ACs `[CI]/[UAT]`; define "dependency satisfied" | F-10, F-15, F-16 |
| 8 | same | sprint lists (5A), cards S10-T04, S6-T06, S8-T03, S3-T04..T07, S7-T01, S10-T01..T04/T07, S6-T01/T03/T10, S5-T10 | Fix dependency/sprint order; add S5-T15 and S7-T05 dependencies; schedule S5-T10 | F-09 |
| 9 | same | cards S7-T01, S10-T07, S5-T10, S4-T02, S8-T07 | Re-type or reword (Verify cards cannot change code) | F-22 |
| 10 | same | sections 5.3, 10, R12, header "Gap evidence" | Refresh counts and stale statements; remove machine-local paths | F-19 |
| 11 | same | cards S0-T10, S1-T01 (DM-02 SQL pack), S5-T06, S3-T08 | Cross-sector file ownership clean-up; add "Reviewer sector" | F-35 |
| 12 | same | cards S2-T01, S2-T05 | Split manual wizard vs CSV/Quick Edit; flat pages become redirects | F-29 |
| 13 | same | card S1-T01 | One-sentence group rule (1-3 stimuli, 0-40 members, 0 = draft only); say whether DM-02 (b)/(c) are in scope | F-30 |
| 14 | same | card S2-T02 | Add deps S1-T08, S1-T10; define tab vs page for Kiriman Guru | K-09, K-10 |
| 15 | same | card S8-T02 | Breakpoint 1024 not 768 | K-29 |
| 16 | same | card S10-T02 | Split by role (BE rules, guru, pupil, AS) | K-34 |
| 17 | same | card S7-T05 | Split the coin-rate part (DM-48/API-ADM-16) into its own early card | K-28 |
| 18 | same | cards S3-T04, S3-T06, S3-T07, S5-T11, S7-T04..T06 | Add an "AC range -> card" line; add BE files to S3-T04 | F-33, K-12, K-14 |
| 19 | same | card S6-T14 | Title promises Kelas Saya (guru); confirm scope | K-24 |
| 20 | same | cards S6-T16..T20 | State order and owner of the S1/S0 side PRs | F-08, K-25 |
| 21 | `docs/prd/r1/00-index.md` | doc map, counts, "Awaiting user" | Add 45 (and 46) to the map; fix "DM-01..DM-43" and "187 rows"; add the code table (FAQ Q4); add "Not observed in V2 means build from FR" | F-19, F-20, F-23, F-24 |
| 22 | `docs/prd/r1/01-product-overview.md` | decisions list | Add D109-D113, D-A1..A17, D-API-n, D-QA-n | F-20 |
| 23 | `docs/prd/r1/10-murid.md` | AC-MUR-9-8, AC-MUR-16-8, 16 "Current gap (4)", URS-MUR-23 (02) | Duplicated stem = show once, not excluded; figure-less = excluded | F-26 |
| 24 | `docs/prd/r1/60-api-contract.md` | OQ-API-19 | Close with the OD-3 decision | F-26 |
| 25 | `docs/prd/r1/30-admin-pusat.md` | R1-ADM-Q-11 and FR-ADM-Q11.1 | CSV columns = QE-06; dialog values are defaults; error text | F-27 |
| 26 | `docs/prd/r1/20-guru-admin-sekolah.md` | R1-GUR-43 Computation | Precision wording per XS-5 | F-28 |
| 27 | `docs/prd/r1/10-murid.md` | R1-MUR-13 | Reorder A-F, one label for self-mark, fix Kuiz mode wording, tag ACs by lane | F-32, F-33 |
| 28 | `docs/prd/r1/40-cross-cutting.md` | X8 glossary; X9 before X8 order | Extend glossary with the code table | F-20 |
| 29 | `docs/prd/r1/45-question-authoring-flow.md` | section 0 | Align D-QA-2/3/4 with S1-T09 and OQ-MUR-13, or mark them out of R1; extend 1.6 beyond question screens | F-21, F-23 |
| 30 | `.github/pull_request_template.md` | whole | Remove AGENT-SYNC, plan 14.9, backend-tracker, board row, "Mode", "UAT-like dataset"; add "ACs awaiting UAT" | F-11 |
| 31 | `.github/ISSUE_TEMPLATE/r1-card.yml`, `scripts/r1-create-issues.mjs` | claim text, "Claimed by", card copy | Remove `/claim`; link instead of copy; add `--update` | F-02, F-37 |
| 32 | `.github/CODEOWNERS` | header, sector blocks | Say who reviews until blocks are uncommented; fix reference to `r1-board.md` | F-06 |
| 33 | `scripts/r1-lock.mjs` | CLI | Add `--help`; document exit codes in header | F-17 |
| 34 | `scripts/r1-scope-guard.mjs`, `scripts/r1-trace-check.mjs` | rules | Accept `Cross-sector:` line; fail on "dependency in later sprint" and "card Type weaker than PRD Action" | F-08, F-09, F-22 |
| 35 | `docs/plan/onboarding.md`, `AGENT-SYNC.md`, `sessions.md`, `backend-tracker.md` | top | Add "Superseded for R1 by R1-START-HERE" | F-01 |
| 36 | `docs/qa/` (new `docs/qa/r1/`) or the plan | AC ledger | Create `r1-ac-ledger.md` and `r1-board.md` or remove all references | F-02, F-19 |
