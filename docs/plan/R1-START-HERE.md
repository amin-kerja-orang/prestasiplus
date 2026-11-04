# R1 start here (developers and cloud agents)

Release 1 (R1) of PrestasiPlus V3. Read this page, then [R1-FAQ.md](R1-FAQ.md), then work **one card at a time**. This page is the **only place where the working rules are stated**; every other document links here. If you must ask a question that the documents should have answered, tell your team lead: that is a documentation defect, not your mistake.

Full detail: [`r1-development-plan.md`](r1-development-plan.md) (sections 0A, 0B, 6) and [`docs/prd/r1/00-index.md`](../prd/r1/00-index.md) (IDs and the "Codes in plain words" table).

## The rule

**Gap check first, close the gaps, never rebuild.** V3 already contains most of the screens and services. A card is finished when the existing code satisfies the card's acceptance criteria (ACs), not when new code exists.

## Which rules win (precedence)

- For any work on a card `S<n>-T<nn>`, **this page wins** over the repo-level `CLAUDE.md` and `AGENTS.md` on branches, commits, pull requests, claims and scope.
- The `CLAUDE.md` items "feature/<slug> branches", "gates G1-G6", "Delivery Lead plus role subagents" and "commit only when the user asks" are for non-R1 work. In R1 a session commits, pushes and opens its card PR as part of the card.
- Language: code, commits, PRs, issues and docs are English. UI copy is the exact Bahasa Melayu written in the PRD. A chat with the product owner is in Bahasa Melayu.
- Documents in `docs/plan/` that are not named on this page (BE cards `BE-01..BE-40`, `AGENT-SYNC.md`, `backend-tracker.md`, `onboarding.md`, `sessions.md`, branch `feature/v2-backend`) belong to the earlier backend programme. They are **superseded for R1**: do not follow their branch, claim or board rules.

## Day 1 box

1. **Which team starts where.** The first team takes sector **S0** (shared files, CI, the stack) and begins with card S0-T02. Other teams take the sectors the orchestrator prompt tells them to take. **Nobody takes sector S9**: the Delivery Lead session works the S9 cards (S9-T01..S9-T06, including the end-to-end chain suite S9-T06) and they need no lock (decision 10).
2. **Does the stack run?** Until S0-T02 is merged, `npm run stack:up` may not start (the e2e seed fails). Until then use unit tests, `npm run typecheck`, `npm run lint`, `npm test`, and for the API `npm run be:dev` as in [`http-switch-checklist.md`](http-switch-checklist.md) (needs `COOKIE_SECURE=false` in `.env.api`).
3. **Env files and logins.** Copy from `.env.example`, `.env.api.example`, `.env.db.example`. Local demo logins: [`docs/AKAUN-DEMO-LOCAL.md`](../AKAUN-DEMO-LOCAL.md). The CI seed and its profiles: [`docs/ops/e2e-seed.md`](../ops/e2e-seed.md). Demo and CI data are for automated tests only, never for acceptance.
4. **A cloud session without Docker** runs unit, typecheck, lint and contract checks only. It marks the ACs that need the stack or a browser as "awaiting CI/UAT" in the PR. **Every session has its own clone or worktree**; two sessions never share one checked-out branch.
5. **Duplication.** The word "duplicate" has six meanings in V3: read [R1-FAQ Q5](R1-FAQ.md) first. Then [30 section 3.3](../prd/r1/30-admin-pusat.md) (admin menu: keep / merge / hide / remove per menu id), [45 section 1.6](../prd/r1/45-question-authoring-flow.md) (one canonical screen per question function), [47](../prd/r1/47-v3-duplicates-register.md) (the register of 34 duplicates and what was decided) and the rule "No duplicates (enforced by CI)" at the end of this page.

## Decisions (D113, 2026-11-04). Stated once, here

### 1. One claim system: the git lock
- The **lock** (`scripts/r1-lock.mjs`, a remote branch `r1-lock/<KEY>`) is the **only truth** about who holds a sector or a card.
- The issue comment `[<team>/S-<k>] claimed`, the label `team:<team>` and the `status:*` labels are the **human mirror** of the lock.
- **Self-assigning the issue means nothing** (several Claude accounts may share one GitHub user). Ignore any text that says "assign yourself", "set yourself as assignee" or "/claim".

### 2. The board is GitHub issues
- The board = the `r1` issues with their labels and milestones (`R1 Sprint 0..N`). There is **no `r1-board.md`** and no board file.
- Pinned issue **#502 "R1 sector claims"**: one mirror comment per sector hold. Pinned issue **#503 "R1 daily"**: daily team reports, UAT deploy notices, UAT requests.
- AC results are recorded in [`r1-ac-ledger.md`](r1-ac-ledger.md) (who writes rows and how: see that file).

### 3. Naming (one convention)
| Thing | Form | Example |
|---|---|---|
| Team name | `team-[a-z0-9-]{2,30}` | `team-amin` |
| Session | `S-<k>` (k = 1..4) | `S-2` |
| Branch | `r1/<team>/<card-id>-<slug>`, from `feature/v3-bijak-r1` | `r1/team-amin/S1-T01-group-publish` |
| Commit | repo conventional style, scope = sector, card at the end | `fix(s1): enforce group publish as one unit (S1-T01)` |
| PR title | `[<team>/S-<k>] <card-id> <title>` | `[team-amin/S-2] S1-T01 Stimulus group invariants` |
| PR body | names **exactly one** card ID (the scope guard reads it) | `Card: S1-T01` |
| Issue and PR comment | starts with `[<team>/S-<k>]` | `[team-amin/S-2] claimed` |
| Lock key | `S<n>` (sector) or `S<n>-T<nn>` (card; a split card has one lowercase letter) | `S1`, `S1-T01`, `S1-T09a` |
| Card to issue | One issue per card; its title starts with the card ID followed by a space. Find it by searching the `r1` issues for the card ID (for example `S1-T01`). The issue number is not part of the plan. | issue title `S1-T01 Stimulus group invariants end to end` |

The repo `CLAUDE.md` rule `feature/<slug>` is for non-R1 work. R1 branches always start with `r1/`.

### 4. How an AC is proven, and how code reaches UAT
1. **Before the PR (the team).** Prove every AC that can be automated in CI tests: unit, integration or e2e on the CI seed; for UI also at 375, 768 and 1280 px with no horizontal scroll. Tag each AC in the PR as `[CI]` (proven by a named automated test), `[UAT]` (needs UAT data or a human look) or `[CI+UAT]`.
2. **PR review (the team lead).** The team lead (orchestrator) reviews the PR against the card and the guardrails within 1 working day and comments `[<team>/S-<k>] review: approved`, or the exact changes needed. The **product owner (@aminfaudzi) merges** (squash) into `feature/v3-bijak-r1` after green CI.
3. **Deploy to UAT.** The **designated UAT developer** deploys `feature/v3-bijak-r1` to UAT once a day (or on request during Slice 0) after CI is green, and posts the deployed commit in **#503**. Nobody else deploys.
4. **UAT acceptance (the card's team).** Once the deployed commit contains the card's merge, the card's team runs the `[UAT]` ACs and every AC-CHAIN-n through the card on UAT, in a **visible (headed) browser** at 375, 768 and 1280, using the shared test accounts (decision 5). It records Pass or Fail in [`r1-ac-ledger.md`](r1-ac-ledger.md). **A Fail re-opens the card** (`status:in-progress`).
5. **Done.** The card moves to `status:done` **only after UAT Pass** of all its ACs.
6. Side-by-side comparison with V2 is done by the Delivery Lead at verification, never by a card team and never required in a card PR. The PR lists "deviations from the PRD text" instead.

### 5. UAT access
- "No server access" means **no SSH, no database access, no deploy** for AI sessions (D95).
- **Using UAT through the browser with test accounts is allowed**, including creating the test records that an AC-CHAIN needs. Those records live on the dedicated test school, carry the prefix `UJI <team> <date>`, and are removed afterwards by the designated UAT developer as U-OP-14 (40 X9; rules in [`r1-ac-ledger.md`](r1-ac-ledger.md)).
- The **designated UAT developer** creates, through the admin UI on a dedicated test school, **one account per role per team**: Admin Pusat, Admin Sekolah, Guru, Murid T1, T2, T3, T4, T5. The credentials go **privately to the team leads**, never into the repo, an issue, a PR, a comment or a log.
- **Content work** (questions, papers, Bab mapping, figures) is done by named content admins through the UI (D110); developers do not do it. Script data operations on UAT stay with the designated UAT developer and the product owner's approval ([plan section 7](r1-development-plan.md)).
- **Request path for a new developer:** you -> your team lead -> the designated UAT developer (comment in #503: `[<team>/S-<k>] needs UAT test accounts for <team>`).
- The designated UAT developer is named by the product owner in the first line of #503 (`UAT developer: @handle`).
- Real pupil data is on UAT: screenshots stay in the local `.evidence/` folder and are never uploaded.

### 6. Ownership and merging
- `.github/CODEOWNERS` lists `@aminfaudzi` as owner of everything. GitHub users may be shared between accounts, so **sector ownership is expressed by the locks**, not by CODEOWNERS.
- "Sector lead" means **the team holding the sector lock**. There is no other sector lead.
- **Merge rule:** the team lead review (decision 4.2) plus the product owner's merge. Nobody else merges.

### 7. Cross-sector small PRs
- A small PR that touches another sector's paths (a migration number, a contract index entry, a menu line) names the card it serves in the body, adds the line `Cross-sector: S<n> (<reason>)`, and gets the label `needs:S<n>`.
- The team holding the lock on S<n> reviews it **within 1 working day**. If no team holds that sector, the product owner reviews it.
- Use only your own sector's migration range ([plan section 3](r1-development-plan.md)); a migration in another range is requested from the team holding that sector (label `needs:S<n>`).

### 8. Order, dependencies and "done"
- Take cards P0 first, then P1, then P2, in milestone order. Respect the card's `deps:`.
- **A dependency is satisfied when its PR is merged into `feature/v3-bijak-r1` and CI is green.** Wait for `status:done` only when the card says "needs data on UAT".
- Every card starts as `status:ready`: the tool does not show dependencies, so read `deps:` on the card.

### 9. The label list (the real one)
`r1` · `sector:S0..S10` · `type:fix|complete|build|keep|verify|ops` · `prio:P0|P1|P2` · `status:ready|in-progress|in-review|blocked|done` · `r1-delivery:A|B` · `team:<team>` (created by the team lead on first use) · `needs:S0..S10` (a cross-sector PR, or a request waiting on that sector) · `needs:schema` (a migration requested from the team that holds the sector of its number range, together with `needs:S<n>` of that sector). Stuck: `status:blocked` plus a comment. Milestones: `R1 Sprint 0..N`.

### 10. S9 cards and the end-to-end chain specs
- S9 is the Delivery Lead's sector. It cannot be claimed as a SECTOR (no team holds the lock `S9`), but its cards S9-T01..S9-T06 are worked by the Delivery Lead session; S9-T06 is included. S9 cards need no lock.
- The spec of AC-CHAIN-n is written by the LAST card of chain n (the table in card S9-T06, copied from 40 section X9; each last card lists every other card of its chain in `deps:` and also S9-T06, so it starts only when the whole chain and the helper are merged), in the same PR as that card's change, under `e2e/r1/chains/chain-<n>.http.spec.ts`. That folder belongs to S0, so the card PR is a small cross-sector PR (decision 7): the line `Cross-sector: S0 (chain spec)` and the label `needs:S0`. The spec file is on the `New files:` line of that last card (step 5 allows exactly the paths of that line), so creating it is not a "file that is not listed". The shared helper `e2e/r1/chains/helpers.ts` (login and `UJI` record helpers) is landed by card S9-T06 as its FIRST small PR in Sprint 1 (S9-T06 has no `deps:`; it is a recurring card; the file is on S9-T06's `New files:` line; a small cross-sector PR to S0); a last card imports it, depends on S9-T06 and asks S9-T06 by issue for a missing helper, never the reverse. Only the full suite RUN waits for the ten last cards. S9-T06 runs the full chain suite on the CI seed and on UAT and maintains it; it never writes a product fix.

### 11. Numbers on the wire and on the screen
Every report and practice API returns accuracy as a JSON number rounded to ONE decimal (pooled correct ÷ answered × 100, XS-5; 60 section 4.6); a value with no fraction is returned without one (100 and 50, not 100.0), and the test is: the number equals itself rounded to one decimal and the response never carries a second decimal digit; every screen shows the whole number rounded half up (40 XS-5). Only the manual Headcount AR screen may show one decimal. Cards S10-T01, S10-T03, S6-T01 and S6-T03 apply this rule.

### 12. Which FR/AC a card owns and which files it may touch (M-8)
- **(a) FR/AC.** A card owns EVERY FR and AC of the PRD modules on its `PRD:` line, including IDs added to those modules later, unless another card names that ID explicitly on its own line (explicit beats module).
- **(b) Existing files.** "Starts from" lists the entry files. The card may also edit any other existing file of ITS OWN sector that its gap check shows is on the path of one of its FR/AC; name the file in the gap-check row. A file of another sector needs a cross-sector PR (decision 7).
- **(c) New files.** A card creates a new file only where its `New files:` line says; a test file for the card's own code may be created beside that code. A card may also create the migration file(s) that a DM row it owns names (no `New files:` entry needed). A migration on a table whose schema file belongs to another sector is written by the holder of that sector at the card's request (decision 7); if no team holds that sector, the requesting card's team writes it in a PR labelled `needs:S<n>` that the product owner reviews.
- **(b) applies to every card Type except Keep, Verify and Ops (round 4):** a Build card too may edit the existing files of its own sector that its gap check shows are on the path (route, menu and module wiring included) and creates new files only at its `New files:` paths.
- **(d) Parts.** A big card may be delivered in several PRs ("parts") that all name the same card ID (the title may add `part <name>`); each PR states which FR/AC it proves, and the card is Done when all its ACs pass. One PR still names exactly one card ID.
- **(d) Team and session names.** `<team>` and `S-<k>` are the values in your cloud-agent prompt (below) or, for a team lead, in the orchestrator prompt ([R1-ORCHESTRATOR-PROMPT.md](R1-ORCHESTRATOR-PROMPT.md)); scripts and the chain helper `e2e/r1/chains/helpers.ts` read them from `R1_TEAM` and `R1_SESSION`.

## Steps for one card

1. **Read** [`docs/prd/r1/00-index.md`](../prd/r1/00-index.md), then the PRD sections on the card's `PRD:` line, then its `Data/API:` rows in 50 and 60.
   Then open the flow of your card in [`docs/prd/r1/49-flow-diagrams.md`](../prd/r1/49-flow-diagrams.md) (find the card ID): it shows the whole journey your card is part of, what already exists in V3, and the steps owned by other cards.
2. **Pick a card**: label `r1` + `status:ready` + your sector (`sector:S<n>`), in the current sprint milestone, P0 first, `deps:` satisfied (decision 8).
3. **Join your team once, then claim it with the lock** (decision 1). The lead runs `register-team` (or `claim-token` for a team registered before the token fix) once; it prints the **team token once**. The lead hands the token to each session privately (never in an issue, PR or commit). Each session runs `node scripts/r1-lock.mjs join --team <team> --token <token>` once, or sets the env var `R1_TEAM_TOKEN`. Without the token every lock command of the team exits 3.
   - sector: `node scripts/r1-lock.mjs acquire S<n> --team <team> --session S-<k>`;
   - card: `node scripts/r1-lock.mjs acquire S<n>-T<nn> --team <team> --session S-<k>`.

   Then mirror it on the issue (label `team:<team>`, comment `[<team>/S-<k>] claimed`). Cheat-sheet below.
4. **Code gap check, then post it** as an issue comment before any commit: for every FR/AC of the card, works / broken / missing with file and symbol, starting from "Starts from (existing)". Example rows:
   ```
   | FR/AC       | status  | file::symbol                                | planned change                  |
   |-------------|---------|---------------------------------------------|---------------------------------|
   | AC-MUR-16-5 | missing | practice/start.planner.ts::plan             | warn when available < chosen    |
   | FR-X1-4a    | broken  | questions/stimuli.service.ts::createGroup   | allow 1 member (today: 2+)      |
   | FR-X1-4d    | works   | question-display/StimulusGroup.vue          | none                            |
   ```
   File and line numbers written on the cards were true on 2026-11-04; find the code by name (symbol). Only then set `status:in-progress`.
5. **Close the gaps in the existing files only** (decision 12): the Starts-from files, and any other existing file of your own sector that your gap-check row names as on the path of an FR/AC; a file of another sector is a cross-sector PR (decision 7). A new file only if the card names it: every Build card has a `New files:` line with the exact paths you may create (a card that has no such line creates no file). If you need a file that is not listed, post a QUESTION (Hard rules) before creating it. Branch, commit and PR names: decision 3.
6. **Prove the automatable ACs in CI** (decision 4.1). Local checks before you push:
   ```
   npm run typecheck && npm run lint && npm test     # backend also: npm run be:verify; contract change: npm run contract:check
   node scripts/r1-scope-guard.mjs --base origin/feature/v3-bijak-r1 --head HEAD     # set PR_BODY to your PR text
   node scripts/r1-canonical-map.mjs --check
   node scripts/r1-trace-check.mjs                   # only if your PR touches docs/ or the plan (it must exit 0)
   ```
7. **Open the PR** to `feature/v3-bijak-r1` with the template: exactly one card ID, gap-check link, existing files changed, the reason for any new file, DM/API IDs, ACs proven with their `[CI]`/`[UAT]` tags, "ACs awaiting UAT", and the scope-guard and canonical-map results. Set `status:in-review`.
8. **CI** must be green: `r1-scope-guard`, `r1-docs` (when docs or the plan change), and the existing frontend/api jobs. The scripts `scripts/r1-scope-guard.mjs`, `scripts/r1-canonical-map.mjs` and `scripts/r1-trace-check.mjs` exist today; the required CI jobs that run them are wired by card S0-T04. Until S0-T04 is merged CI does not run them, so run them locally (step 6) and paste the output in the PR.
9. **Review and merge**: decisions 4.2 and 6. A cross-sector PR also follows decision 7.
10. **UAT acceptance and Done**: decisions 4.3 to 4.5. Release your card lock after the merge (`release S<n>-T<nn>`); release the sector lock when the sector is finished or your team stops.

## Lock cheat-sheet (`node scripts/r1-lock.mjs --help` prints it)

```
node scripts/r1-lock.mjs register-team --team team-amin --session S-1      once, from the lead session; prints the team token ONCE
node scripts/r1-lock.mjs claim-token --team team-amin --session S-1         lead, team registered before the token fix: adds the token, prints it once
node scripts/r1-lock.mjs join --team team-amin --token <token>              every other session, once (or set R1_TEAM_TOKEN)
node scripts/r1-lock.mjs list [--all]                                      live locks (STALE after 24 h without heartbeat); --all also shows RELEASED locks
node scripts/r1-lock.mjs mine --team team-amin                             locks of your team
node scripts/r1-lock.mjs acquire S1 --team team-amin --session S-1         a sector
node scripts/r1-lock.mjs acquire S1-T01 --team team-amin --session S-2     a card (needs the sector)
node scripts/r1-lock.mjs heartbeat-all --team team-amin --session S-1      daily
node scripts/r1-lock.mjs release S1-T01 --team team-amin --session S-2     after merge, or if you drop the card (marks the lock released; the ref is not deleted)
node scripts/r1-lock.mjs release team-amin --team team-amin --session S-1   frees the team name (marks it released; register-team can reuse it)
```
- You may set `R1_TEAM`, `R1_SESSION` and `R1_TEAM_TOKEN` in the environment instead of the flags and `join` (the env token wins over the one saved by `join`). Prefer `R1_TEAM_TOKEN` over `join --token` to keep the token out of shell history. `join` on a team that is not registered exits 4. A team key can be broken by the owner only when it is STALE (`--force-owner` is refused on a team key).
- **After this merge, every lead who registered a team earlier runs `node scripts/r1-lock.mjs list` first (check the team row and its session), then `claim-token --team <team> --session S-1` once.** The command prints the recorded session and time, and must be run only by the current lead of that team. `list`, `mine` and `--help` need no token. `break` is for the product owner only and needs no token.
- Exit codes: **0** ok · **2** usage or setup error · **3** held by another team (pick another), or the team token is missing or wrong (ask your lead for it, then `join`) · **4** you are not the holder, or your team does not hold the sector.
- The tool needs a git remote with **push rights** to the repository (a cloud session uses the repository token its platform provides).
- Conventions the tool does not enforce: hold at most 3 sectors at a time (a card of a 4th sector waits until you release one, or is done by the team that holds it; a one-file change there is a cross-sector PR); never hold a sector idle for more than a day; S9 is the Delivery Lead's sector and cannot be claimed as a SECTOR (decision 10).
- **Weekends and leave:** STALE counts calendar hours. Before a weekend or leave run `heartbeat-all` and write `[<team>/S-<k>] away until <date>` in #503. The product owner breaks a STALE lock only after one working day without an answer in #503.

## Hard rules

- **Every card lists four bullets (D115):** "Exists in V3 (reuse; do not rebuild)", "Change", "Remove", "Build (absent in V3)" (plan section 0B). A PR that adds a new file duplicating an existing V3 component, route, service or table fails review. You work from the docs only (no browser, no V1, no V2); a missing detail is a documentation defect: stop and report it (QUESTION below), do not guess.
- **UI: V3 layout and components are kept; V2/V1 define function only (D115).** Never restyle or re-lay-out a V3 screen to look like V2; never add a V2-only visual element. PRD screen specs define fields, actions, rules, copy and states, not layout.
- **No rebuilding.** Do not rewrite or delete working code, pages or modules.
- **No parallel pages, services, stores, routes or tables** for something that already exists. Every schema change names a DM ID, every endpoint an API ID.
- **Change budget by card Type**: Keep/Verify/Ops = no product code; Fix/Complete = the "Starts from" files plus other existing files of your own sector named in your gap check (decision 12; new file only if the card names it); Build = the same existing files of your own sector as Fix/Complete when the gap check shows they are on the path (route, menu and module wiring), and new files only at the paths of the card's `New files:` line. If a Verify card turns out to need product code, it is a Fix or Complete card: tell your team lead.
- **No server access for AI sessions** (decision 5). V1 and V2 are not opened by agents.
- No placeholder strings and no mock path in the http build. The rule is about placeholder PAGES and notices. The ONE banned-string list and the ONE allow-list (the admin `Pratonton` labels, register 6.2b row 18, the defensive pupil states) are written only in 40 AC-X2-3 (master); this page, FAQ, 10 section 4.11 and the plan cite it and never restate it. The allow-list (table X2-3-A) is mirrored in `scripts/placeholder-allowlist.json` (card S0-T04, which also flips the check from report to fail at the start of Sprint 4). The same word on a pupil, teacher or school-admin screen, a hidden-module page or a toast is still banned.
- **Duplicated stem text:** a question whose stem is repeated as its only part's prompt (`stem_duplicated`) is **shown once and is NOT excluded** from serving or counting; the data is cleaned later (DM-40). Only `stimulus_missing` and `figure_only` questions are excluded (FR-X1-4, FR-MUR-QP-5, OD-3).
- Public repo: no real person names, e-mails, credentials, server addresses or personal data in code, seeds, docs, issues, PRs or logs. Use fictitious names.
- Docs-only PRs (touch only `docs/**`) have no card and skip the scope guard.
- **Stuck, or the PRD does not answer?** Comment on the issue: `[<team>/S-<k>] QUESTION: <question>; the two places that disagree; my suggested answer`, add `status:blocked`, tell your team lead. The team lead answers with the tie-break in [R1-FAQ Q11](R1-FAQ.md) and records the answer on the issue; the product owner is asked only for the reasons in [ORCHESTRATOR section 6](R1-ORCHESTRATOR-PROMPT.md). "Not observed in V2" in the PRD is **not** a question: build from the FR text and the generic loading/error/empty rules (FR-X6) without blocking.

## Cloud agent prompt

Give a cloud session this text verbatim, replacing `<CARD>` (for example `S1-T02`), `<TEAM>` and `<K>`:

```
You are session S-<K> of team <TEAM> working on PrestasiPlus V3, Release 1, on exactly ONE plan card: <CARD>.
Repo: amin-kerja-orang/prestasiplus. Base branch: feature/v3-bijak-r1. Branch: r1/<TEAM>/<CARD>-<short-slug>.

Before anything else read, in this order:
1. docs/plan/R1-START-HERE.md  (the working rules; they win over CLAUDE.md for this card)
2. docs/plan/R1-FAQ.md
3. docs/prd/r1/00-index.md and the PRD sections your card cites
4. Your card in docs/plan/r1-development-plan.md (search for "**<CARD> ") and its GitHub issue.

Rules (mandatory):
- Claim: your team lead holds the lock for the sector; you lock the card with `node scripts/r1-lock.mjs acquire <CARD> --team <TEAM> --session S-<K>`. Every issue and PR comment starts with [<TEAM>/S-<K>].
- Gap check first. Open every file under the card's "Starts from (existing)". For each FR/AC of the card write works / broken / missing with file::symbol. Post it as a comment on the card's issue BEFORE your first commit. Do not code until it is posted.
- Close only those gaps, in the existing files. Never rebuild, rewrite or delete working code. No parallel page, service, store, route or table. A new file only if the card names it. Schema changes need a DM ID, endpoints an API ID, as on the card.
- Respect the card Type budget: Keep/Verify/Ops = no product code; Fix/Complete/Build = the Starts-from files and the other existing files of your own sector named in the gap check; Build creates new files only where the card says.
- Do not touch another sector's paths. If you need a change there, open a small PR that names your card, has the line "Cross-sector: S<n> (reason)" and the label needs:S<n>.
- No server access: never SSH or call V1, V2, V3 or UAT servers, never deploy. You may use UAT in a browser with the shared test accounts your team lead holds; never write credentials anywhere.
- Privacy: this repo is public. No real person names, e-mails, credentials, server addresses or personal data in code, docs, issues or PR text. Screenshots and logs go to local .evidence/<CARD>/ only (gitignored) and are never uploaded.
- If the PRD does not answer a question, comment "[<TEAM>/S-<K>] QUESTION: ..." with the two places that disagree and your suggested answer, label status:blocked, and tell your team lead. "Not observed in V2" is not a question: build from the FR text.

Finish with:
- typecheck, lint and tests run locally (a session without Docker runs unit/typecheck/lint/contract only); paste the real output tails in the PR.
- node scripts/r1-scope-guard.mjs --base origin/feature/v3-bijak-r1 --head HEAD  (must not FAIL)
- node scripts/r1-canonical-map.mjs --check  (must pass)
- node scripts/r1-trace-check.mjs  (if you touched docs or the plan)
- Open a PR to feature/v3-bijak-r1 using the PR template. Title: "[<TEAM>/S-<K>] <CARD> <card title>". Body: exactly one card ID (<CARD>), the gap-check link, existing files changed, the reason for each new file, DM/API IDs, every AC tagged [CI], [UAT] or [CI+UAT], and the list "ACs awaiting UAT".
- Commits look like: fix(s<n>): <what> (<CARD>).
- Do not merge. Do not move the card to Done: the card moves to Done only after the card's team records UAT Pass in docs/plan/r1-ac-ledger.md.
```

## Where things are

| Question | Answer |
|---|---|
| Which menu entry do I keep, merge, hide or remove? | [30 section 3.3](../prd/r1/30-admin-pusat.md) |
| One canonical screen per question function | [45 section 1.6](../prd/r1/45-question-authoring-flow.md) |
| What do BS-, KS-, OPT-, DM-, API-, XS-, HC-SPEC, FD-, OQ-, D- mean? | [00-index "Codes in plain words"](../prd/r1/00-index.md#codes-in-plain-words) |
| Local demo logins | [`docs/AKAUN-DEMO-LOCAL.md`](../AKAUN-DEMO-LOCAL.md) |
| Answers to the first-day questions | [R1-FAQ.md](R1-FAQ.md) |
| What a team lead does, and what goes to the product owner | [R1-ORCHESTRATOR-PROMPT.md](R1-ORCHESTRATOR-PROMPT.md) |
| AC results and test-record cleanup rule | [r1-ac-ledger.md](r1-ac-ledger.md) |

## No duplicates (enforced by CI)

V3 was damaged when several sessions each built their own copy of one function (menus, routes, tables, endpoints). The rule is now checked by machines, not by reading docs: **one function = one screen, one route, one menu entry, one table/model, one API.**

- **Source of truth:** `docs/plan/r1-canonical-map.json` (routes, menus, models, APIs and the business `concepts`, each with its owning sector and a status: `canonical`, `redirect-to:<path>`, `retire`, or for models `legacy-retire` / `parallel-of:<model>`). Statuses follow the V3 duplicates register (D113) and the PRD.
- **Before you add anything:** search the map (and `concepts`) first. If the function exists, change the existing file; never add `2`, `v2`, `new`, `baru`, `-lama`, `legacy` or a plural twin.
- **`node scripts/r1-canonical-map.mjs --check`** (CI, job `r1-scope-guard`) fails when the code has a route, menu entry, model or API that is not in the map. After a legitimate change run `node scripts/r1-canonical-map.mjs --write` (it keeps the hand-set statuses) and commit the map with your code.
- **`node scripts/r1-scope-guard.mjs`** also FAILS the PR when it adds: a route whose path or name differs from an existing one only by a suffix/prefix or plural, or reuses an existing route's component; a menu entry with the same label (case and spacing ignored) as an existing one for the same role; a model with a similar name (same stem or edit distance <= 2) or any new model for a listed concept; an endpoint that repeats an existing method+path pattern or adds an endpoint under a concept's canonical API; or any new reference to something with status `retire` / `legacy-retire`.
- **The only way through** is an explicit approval in the same PR: the PR body names a `DM-` or `API-` ID **and** the item's entry in the map carries `"approved_by_card": "<this PR's card id>"`. Approval is a decision of the sector owner and the Delivery Lead, not a way round the check.
- Messages are in BM and English. Self-test: `node scripts/r1-scope-guard.mjs --self-test`.
