# R1 FAQ (plain English)

Read [R1-START-HERE.md](R1-START-HERE.md) first. It is the only place where the working rules are stated; this page answers the questions a new team asks on day one, and every answer is final (decisions D100 to D113). If a question is not answered here or in the PRD, it is a documentation defect: post `[<team>/S-<k>] QUESTION: ...` on the card's issue (Q11).

## A. Getting started

**Q1. Which documents do I read, in which order?**
1. [R1-START-HERE.md](R1-START-HERE.md) (the rule, the decisions, the 10 steps).
2. This FAQ.
3. [docs/prd/r1/00-index.md](../prd/r1/00-index.md) (what each PRD file is, how IDs work, "Codes in plain words").
4. Your card in [r1-development-plan.md](r1-development-plan.md) section 4 (search for the card ID), then the PRD sections named on the card's `PRD:` line.
5. Only when the card points to them: [40-cross-cutting.md](../prd/r1/40-cross-cutting.md) (shared rules, error catalogue, option sets, end-to-end chains), [45](../prd/r1/45-question-authoring-flow.md) (how a question is entered, reviewed, published), [46](../prd/r1/46-pupil-activity-flow.md) (how a pupil answers and what the reports read), [47](../prd/r1/47-v3-duplicates-register.md) (duplicates), [48](../prd/r1/48-game-and-gamification-spec.md) (games), [50](../prd/r1/50-data-model-erd.md) (DM rows), [60](../prd/r1/60-api-contract.md) (API rows).

The other files in `docs/plan/` (the `BE-01..BE-40` cards, `AGENT-SYNC.md`, `backend-tracker.md`, `onboarding.md`, `sessions.md`, branch `feature/v2-backend`) belong to the earlier backend programme and are superseded for R1: do not follow their branch, claim or board rules.

**Q2. What is the one rule?** Check what already exists, close only the gaps, never rebuild. A card is done when the existing code meets its acceptance criteria (ACs), not when new code exists. See [START-HERE "The rule"](R1-START-HERE.md) and [plan section 0B](r1-development-plan.md).

**Q3. What do "Keep / Verify / Fix / Complete / Build / Ops" allow me to change?**
- **Keep** and **Verify**: no product code; the card only proves ACs. If a Verify card turns out to need product code, it is not a Verify card: tell your team lead, who re-types it Fix or Complete in the issue before you write code (the scope guard FAILs a Verify PR that changes `src/`, `apps/` or `packages/`). S7-T01, S5-T10 and S10-T07 were re-typed for this reason.
- **Fix** and **Complete**: edit the files under the card's "Starts from (existing)" and other existing files of your own sector that your gap check names (Q41); a new file only if the card names it.
- **Build**: new files only at the paths of the card's `New files:` line, reusing the services, components and tables around it. Every Build card has that line; if you need a file that is not on it, post a QUESTION (Q11) before creating it.
- **Ops**: no product code.
See [plan section 0B](r1-development-plan.md).

**Q41. Which FR/AC does my card own, which files may I edit, where may I create files? (M-8)** (a) Every FR and AC of the PRD modules on the card's `PRD:` line, including IDs added to those modules later, unless another card names that ID explicitly (explicit beats module). (b) The Starts-from files, plus any other existing file of your own sector that your gap-check row names as on the path of an FR/AC; a file of another sector is a cross-sector PR (Q10). (c) New files only where the card's `New files:` line says. ([START-HERE decision 12](R1-START-HERE.md), [plan section 0B](r1-development-plan.md))

**Q4. What do the internal codes mean (D113, BS-, OPT-, XS-, HC-SPEC, U-OP, ...)?** One table, [00-index "Codes in plain words"](../prd/r1/00-index.md#codes-in-plain-words).

**Q5. What is "duplication in V3"? What do I keep?** The word is used for six different things. Delete or hide only what the documents list.
1. *Duplicate admin screens and menu entries* (three lists called "Bank Soalan"; Pembina Kertas and Set Builder show the same papers; two review queues). Keep one screen; the others become a redirect or a hidden link. The keep / merge / hide / remove table per menu id is [30 section 3.3](../prd/r1/30-admin-pusat.md); the one canonical screen per question function is [45 section 1.6](../prd/r1/45-question-authoring-flow.md); the full register of 34 duplicates is [47](../prd/r1/47-v3-duplicates-register.md). Example: the regroup work-list is not a new page or a Studio filter, it is the tab `Perlu dikumpulkan semula` of `Senarai Soalan` (45 section 1.6, card S2-T04); the `Soalan` admin menu group has nine entries (30 section 3.2, card S0-T07).
2. *Duplicated stem text* (a stem repeated as the only part's prompt, flag `stem_duplicated`). **Show the text once and do not exclude the question**; the data is cleaned later (DM-40). Only `stimulus_missing` and `figure_only` questions are excluded from serving.
3. *A figure copied per question, or a figure entered as a "question".* One stimulus group holds the figure once and its 1 to n questions ([40 FR-X1-4](../prd/r1/40-cross-cutting.md)).
4. *Two places that store or compute the same number* (two answer tables, different totals on different screens). One answer store, `practice_answers`, and the XS definitions ([40 FR-X4-5](../prd/r1/40-cross-cutting.md)).
5. *Duplicate routes* (for example `/leaderboard` and `/gamification/leaderboard`). Keep one; the other redirects.
6. *Duplicate code you might add* (a second page, service, store, route or table for something that exists). Forbidden. CI enforces it: `node scripts/r1-canonical-map.mjs --check` and `node scripts/r1-scope-guard.mjs` (see "No duplicates" in START-HERE and `docs/plan/r1-canonical-map.json`).
Two unrelated uses of the word are not duplicates in this sense: the intake detector `duplicate-detector.ts` (finds duplicate questions) and the redemption "duplicate-submission flag"; keep them as they are.
"Never delete working code" and "merge duplicates, no function lost" do not conflict: build or confirm the function in the kept copy first, then redirect or hide the other copy, keep the old URL as a redirect, and drop old tables only in a later release. If you find a duplicate that is not on a list, do not delete it: comment on the issue.

## B. Claiming and working

**Q6. How do I claim a card?** The lock is the only claim. Your team holds the sector lock, then you lock the card: `node scripts/r1-lock.mjs acquire S<n> --team <team> --session S-<k>`, then `node scripts/r1-lock.mjs acquire S<n>-T<nn> --team <team> --session S-<k>`. Exit code 3 = another team holds it (pick another); 4 = you are not the holder or your team does not hold the sector. Mirror it on the issue: label `team:<team>` and the comment `[<team>/S-<k>] claimed`. Assigning yourself on GitHub or commenting `/claim` means nothing, because several Claude accounts may share one GitHub user. ([START-HERE decision 1](R1-START-HERE.md), [ORCHESTRATOR section 1](R1-ORCHESTRATOR-PROMPT.md))

**Q7. Lock cheat-sheet.** `node scripts/r1-lock.mjs --help` prints it.
- `register-team --team team-amin --session S-1` once, from the lead session.
- `list` all locks (STALE after 24 h without heartbeat). `mine --team team-amin` your locks.
- `acquire S1` a sector; `acquire S1-T01` a card (needs the sector). A split card has a letter: `S1-T09a`.
- `heartbeat-all` every day. `release S1-T01` after the merge or if you drop the card; `release S1` when the sector is finished.
- `break` is for the product owner only, for a STALE lock after 1 working day without an answer in #503.
- Needs a git remote with push rights. Hold at most 3 sectors at a time (a card of a 4th sector waits until you release one, or is done by the team that holds it). Never hold a sector idle for more than a day. S9 cannot be claimed as a sector (Q31).
- Weekends and leave: run `heartbeat-all` first and write `[<team>/S-<k>] away until <date>` in #503.

**Q8. What do I name my branch, commits and PR?** Branch `r1/<team>/<card-id>-<slug>` from `feature/v3-bijak-r1` (for example `r1/team-amin/S1-T01-group-publish`). Commit in the repo's conventional style with the card at the end (`fix(s1): enforce group publish as one unit (S1-T01)`). PR title `[<team>/S-<k>] S1-T01 <title>`. The PR body names exactly one card ID. Every issue and PR comment starts with `[<team>/S-<k>]`. The repo `CLAUDE.md` rule `feature/<slug>` is for non-R1 work.

**Q9. What is a "gap check" and where does it go?** Before your first commit, open every file under the card's "Starts from (existing)" and post an issue comment with a table: requirement (FR/AC) | works / broken / missing | file::symbol | planned change. Example row: `AC-MUR-16-5 | missing | practice/start.planner.ts::plan | warn when available < chosen`. File and line numbers on cards were true on 2026-11-04; find the code by symbol. Only then set `status:in-progress`.

**Q10. What if a file of another sector must change (migration, contract, menu, nav)?** Open a small PR that names the card it serves, has the line `Cross-sector: S<n> (reason)` and the label `needs:S<n>`. It is not a card of its own and you do not need the lock of S<n>. The team that holds S<n> reviews it within 1 working day; if no team holds S<n>, the product owner reviews it. Use only your own sector's migration number range ([plan section 3](r1-development-plan.md)); a migration in another range is requested from the team that holds that sector. Order: schema PR first, then contract PR, then code. One migration per PR: a card that owns several migrations (for example S7-T05: `0223`, `0229`, `0230`) opens one PR per migration, in number order, each naming the same card ID.

**Q11. What do I do when I am blocked, or the documents contradict each other?** Do not guess and do not wait. Comment on the issue `[<team>/S-<k>] QUESTION: <question>; the two places that disagree; my suggested answer`, set `status:blocked`, and tell your team lead. The team lead answers and records the answer on the issue. The tie-break order is: improve, not rebuild (FR-X1-5); follow V2 for unchanged flows; DSKP for question structure; stimulus groups 1..n, never split; one answer store (`practice_answers` with a `mode`); privacy first; the SRS (10/20/30) wins on behaviour and 50/60 win on technical shape. For the exact text of a message the ERR catalogue ([40 X10](../prd/r1/40-cross-cutting.md)) wins over a different wording in a screen description. Only the reasons in [ORCHESTRATOR section 6](R1-ORCHESTRATOR-PROMPT.md) go to the product owner.

**Q12. Which card first? What is the order?** P0 before P1 before P2, in milestone order (`R1 Sprint 0..N`), respecting the card's `deps:`. **A dependency is satisfied when its PR is merged into `feature/v3-bijak-r1` and CI is green.** Wait for its `status:done` only when the card says "needs data on UAT". All issues start as `status:ready`; the tool does not show dependencies, so read `deps:` on the card. The order of work is [plan section 5.2](r1-development-plan.md) (critical path derived from the `deps:`) and the sprint lists in [section 5A](r1-development-plan.md). The first team takes S0 (stack and shared files), starting with S0-T02. If the card you want has a dependency that no team has started, tell your team lead in #503.

**Q31. Who works the S9 cards, and who writes the end-to-end chain specs (AC-CHAIN-1..10)?** S9 is the Delivery Lead's sector: no team can hold the lock `S9`, and its cards (S9-T01..S9-T06) are worked by the Delivery Lead session, S9-T06 included. The spec of AC-CHAIN-n is written by the LAST card of chain n (table in card S9-T06), under `e2e/r1/chains/chain-<n>.http.spec.ts`. That folder is S0's, so the card PR is a small cross-sector PR with `Cross-sector: S0 (chain spec)` and the label `needs:S0`. S9-T06 runs and maintains the whole suite and never writes a product fix. ([START-HERE decision 10](R1-START-HERE.md), [plan card S9-T06](r1-development-plan.md))

**Q28. Which labels exist?** `r1` · `sector:S0..S10` · `type:fix|complete|build|keep|verify|ops` · `prio:P0|P1|P2` · `status:ready|in-progress|in-review|blocked|done` · `r1-delivery:A|B` · `team:<team>` (the team lead creates it on first use) · `needs:S0..S10` (a cross-sector PR, or a request waiting on that sector). Milestones `R1 Sprint 0..N`. There is no board file; the board is the issues with these labels. Stuck = `status:blocked` plus a `QUESTION:` comment.

## C. Testing, proof and review

**Q13. What must I run before I push?** `npm run typecheck`, `npm run lint`, `npm test`; for the backend `npm run be:verify`; `npm run contract:check` if the contract changed; `node scripts/r1-scope-guard.mjs --base origin/feature/v3-bijak-r1 --head HEAD` (set `PR_BODY` to your PR text); `node scripts/r1-canonical-map.mjs --check`; and, if you touched docs or the plan, `node scripts/r1-trace-check.mjs`.

**Q14. How do I run the stack, and with which accounts?** `npm ci`, then `npm run stack:up` (Docker; UI on port 5192/5193). Copy the env files from `.env.example`, `.env.api.example`, `.env.db.example`. Local demo logins are in [docs/AKAUN-DEMO-LOCAL.md](../AKAUN-DEMO-LOCAL.md); the CI seed is described in [docs/ops/e2e-seed.md](../ops/e2e-seed.md). Until card S0-T02 is merged the stack may not start: use unit tests, typecheck, lint and `npm run be:dev` as in [http-switch-checklist.md](http-switch-checklist.md) (`COOKIE_SECURE=false` in `.env.api`). A cloud session without Docker runs unit, typecheck, lint and contract checks only and marks stack/e2e ACs "awaiting CI/UAT". Demo and CI data are for automated tests only, never for acceptance.

**Q15. Where and when do I prove the acceptance criteria?** In two steps (D113).
1. *Before the merge, in CI, by your team.* Tag every AC of the card `[CI]` (proven by a named automated test; UI also at 375, 768 and 1280 px with no horizontal scroll), `[UAT]` (needs UAT data or a human look) or `[CI+UAT]`. The PR lists the `[CI]` tests and a list "ACs awaiting UAT".
2. *After the merge, on UAT, by your team.* The designated UAT developer deploys `feature/v3-bijak-r1` to UAT once a day after CI is green (on request during Slice 0) and posts the deployed commit in #503. When that commit contains your merge, your team runs the `[UAT]` ACs and every AC-CHAIN through your card in a visible (headed) browser at 375, 768 and 1280 with its shared test accounts, and writes one Pass/Fail row per AC in [r1-ac-ledger.md](r1-ac-ledger.md). A Fail re-opens the card (`status:in-progress`).
A card is `status:done` only after UAT Pass of all its ACs. Evidence (screenshots, logs) stays in your local `.evidence/<card>/` (gitignored); issues, PRs and the ledger carry only pass/fail, AC IDs and file names. Comparison with V2 is done by the Delivery Lead at verification, never by a card team and never required in a card PR; the PR lists "deviations from the PRD text" instead.

**Q16. How do I get UAT logins?** The designated UAT developer creates, through the admin UI on a dedicated test school, one account per role per team (Admin Pusat, Admin Sekolah, Guru, Murid T1, T2, T3, T4, T5) and shares the credentials privately with the team leads. They are never written in the repo, an issue, a PR, a comment or a log. You ask your team lead; the team lead asks in #503: `[<team>/S-<k>] needs UAT test accounts for <team>`. The designated UAT developer is the person the product owner names in the first line of #503 (`UAT developer: @handle`). The team lead gives each session only what it needs, for the run.

**Q17. Who may write to UAT?** Three kinds of writer, and no others. (1) The designated UAT developer runs script data operations (U-OP): dry-run first, report, the product owner's approval, then the real run. (2) Admin users do content work (Bab mapping, figures, regrouping, papers) in the Portal Pentadbiran. (3) A team doing its UAT acceptance may use the app normally with its test accounts, including creating the test records an AC-CHAIN needs, on the dedicated test school, with the prefix `UJI <team> <date>` in the name; the creating team removes them through the UI the same day. No AI session has SSH, database or deploy access to any server, and nobody touches a real school's data. ([plan section 7 RACI](r1-development-plan.md), [ledger rules](r1-ac-ledger.md))

**Q18. Who reviews and merges? What does "Done" mean?** The team lead of the author's team reviews the PR within 1 working day against the card, the gap check and the guardrails, and comments `[<team>/S-<k>] review: approved`. The product owner `@aminfaudzi` merges (squash) after green CI. Nobody else merges. `.github/CODEOWNERS` names `@aminfaudzi` for every path; sector ownership is expressed by the locks, because GitHub users may be shared between accounts. "Sector lead" means the team that holds the sector lock. **Merged is not Done:** the card moves to `status:done` only after UAT Pass of all its ACs (Q15); the team lead sets it, the Delivery Lead samples and may re-open. ([START-HERE decisions 4 and 6](R1-START-HERE.md), [plan 6.5](r1-development-plan.md))

**Q19. What does CI check?** `r1-scope-guard` (one card ID; change budget by Type; a new page, controller or model needs a DM/API ID; no duplicate route, menu entry, model or API; warns if no "Starts from" file is touched or a file loses more than 60% of its lines), `r1-docs` (trace-check: every PRD module has a card, every DM/API has exactly one owning card), the canonical-map check, plus the existing frontend and API jobs.

**Q20. How do teams avoid clashing?** Sector locks (a sector owns its paths), card locks, migration number ranges per sector, contract-first PRs, S0 as the single owner of shared files (menu, nav, schema index, contract index, seeds index, CI), cross-sector small PRs (Q10), delete-only regions in scope lists. Short branches, rebase daily, PR up to about 400 lines. ([plan section 3](r1-development-plan.md))

**Q29. What does "Not observed in V2" in the PRD mean?** It is not a question and not a blocker. Build from the FR text and the generic loading, error and empty rules (FR-X6); the Delivery Lead verifies it later.

**Q30. May I open V1 or V2 to compare?** No. Agents and card teams never open V1 or V2 and never touch a server. Everything needed from them is written in the PRD. The Delivery Lead alone compares with V2 at verification.

## D. Product rules you will meet on many cards

**Q21. What is a stimulus group?** One figure, passage, table or graph (the *stimulus*) with the 1 to n questions that refer to it (the *group*). A group has 1 to 3 stimuli (a part-level stimulus is allowed) and 0 to 40 members; 0 members is a draft only and cannot be published or placed; 1 member is valid. A stimulus is never a question and carries no marks. It is entered once, shown once above its questions (sticky on a phone), and moved, drawn, published, edited (draft copy and atomic swap) and retired as ONE unit. If a question's stem text is also repeated as its only part's prompt, it is shown once and the question is still served. ([40 FR-X1-4a..f](../prd/r1/40-cross-cutting.md), [45](../prd/r1/45-question-authoring-flow.md))

**Q22. What is the single answer store?** `practice_answers`. Every pupil activity that answers a question (Latih Tubi, Soalan by Chapter, Databank, Kuiz, Bijak sittings, Tracking A, Subjektif self-mark, Set Soalan Guru, games) writes there with a `mode` (`latih_tubi`, `chapter`, `question_set`, `kuiz`, `simulasi`, `tracking_a`, `subjektif`, `structured`, `battle`, `pksk`, `audio_kbat` and the game modes), through the one `AnswerLogPort` (card S5-T15, which also owns the abandoned-session sweeper, DM-66). Every report reads only that store, so the same number shows on every screen. ([46](../prd/r1/46-pupil-activity-flow.md), [40 FR-X4-5](../prd/r1/40-cross-cutting.md), DM-44, XS-8)

**Q23. Does a question need a Bab, SP and TP to be published?** One rule everywhere (D112-1, D112-3): **Bab** is required when the question's Subjek + Tingkatan has chapters; a Subjek + Tingkatan without chapters does not list the Bab item. **SP, TP and aras** are required only when DSKP nodes exist for that Subjek + Tingkatan (until a subject's DSKP is loaded, they are not required, and no Kontrak can be created for it); the pupil's level or whether the paper is SPM-bound does not change this. **Kesukaran** (1 to 5) is ALWAYS required, to send for review and to publish; it is a separate field from TP (1 to 6), defaults to min(5, TP), or 3 when there is no TP, and is typed by the admin. Old questions without a Bab are listed in the admin work-list "Soalan tanpa Bab"; admin users fix them in bulk by filter, never by an automatic guess (D89). The message is exactly "Sila pilih Bab." ([30 QE-03/QE-04](../prd/r1/30-admin-pusat.md), [60 API-Q-05](../prd/r1/60-api-contract.md), D112)

**Q24. Which pupil levels exist?** Tingkatan 1 to 5 only; no Darjah anywhere. T1-T3 pupils practise like T4-T5 wherever questions exist (D101).

**Q25. Which modules stay hidden?** Only Cikgu Alesa and Mohon Keluarga Angkat (D102), and the pupil Jana Kertas tab (D112(6)). A hidden module answers with the standard 404 page, never "akan datang".

**Q26. What copy do I use?** The exact Bahasa Melayu text in the PRD. Code, commits, docs and PR text are in English. No placeholder text ("akan datang", "belum tersedia", "Pratonton", "prototaip") on any page or notice. Exception: the admin buttons and titles `Pratonton`, `Pratonton kumpulan`, `Pratonton kertas` and `Pratonton — Soalan #{id} — PRESTASIPLUS` are real functions and are on the allow-list (`scripts/placeholder-allowlist.json`, card S0-T04; see START-HERE Hard rules); the word on a pupil, teacher or school-admin screen stays banned. New copy needs approval (D94).

**Q27. Privacy: what can I put in GitHub?** The repo is public. Nothing that identifies a real person or a secret: no names, e-mails, IC numbers, phone numbers, passwords, tokens, server addresses. Use fictitious data (`contoh@email.com`, `@demo.test`, `0191234567`). UAT holds real pupil data: screenshots stay in local `.evidence/`; issues, PRs and the ledger carry pass/fail and IDs only.

**Q32. In AC-CHAIN-2, who approves the imported questions, and with which tags?** Imported questions arrive as Draf. An Admin Pusat user (the only reviewer role; there is no Penyemak role) sets Bab, SP, TP and Kesukaran in the wizard (Bab is required where the Subjek + Tingkatan has chapters; SP, TP and aras where DSKP nodes exist), sends the group to review with the button `Hantar kumpulan untuk semakan` (every `Draf` member becomes `Menunggu Semakan` in one transaction; Studio filter `status=review`), and then `Terbitkan kumpulan` approves and publishes it: it is allowed only when every member is `Menunggu Semakan` or already `Diluluskan`, sets all members `Diluluskan` atomically, and otherwise answers 409 "Semua soalan dalam kumpulan mesti dihantar untuk semakan dahulu." A single question uses `Hantar untuk semakan` and `Terbitkan`. The chain test seeds these steps through the UI. ([40 X9 AC-CHAIN-2](../prd/r1/40-cross-cutting.md), [45 section 4.1](../prd/r1/45-question-authoring-flow.md), card S9-T06)

**Q33. Is accuracy (Ketepatan) an integer or a decimal?** Both, in different places. Every report and practice API returns accuracy as a JSON number rounded to ONE decimal (pooled correct ÷ answered × 100; 100 and 50 are returned as 100 and 50, never with a second decimal digit); every screen shows the whole number rounded half up. Only the manual Headcount AR screen may show one decimal. ([60 section 4.6](../prd/r1/60-api-contract.md), [40 XS-5](../prd/r1/40-cross-cutting.md), [START-HERE decision 11](R1-START-HERE.md))

**Q34. Which `mode` string does the Databank write, and what are `past_year` and `ramalan`?** `databank` (and `tracking_a` for Tracking A), both for the answer row and the session. `past_year` and `ramalan` are legacy values: R1 code only reads them on old rows (they count in the Databank and Tracking A lanes and chips) and never writes them. ([40 OPT-MODE-SESI](../prd/r1/40-cross-cutting.md), [50 section 4.7a](../prd/r1/50-data-model-erd.md), cards S3-T05, S3-T07)

**Q35. Which API does Random Kuiz (Bijak SPM "Kuiz") use?** API-BIJAK-06 (`POST /api/bijak/kuiz/sessions`, `.../:id/check`, `.../:id/finish`); the rows of mode `kuiz` are written at `finish`, not at `check`. It does not use API-PRAC-01 (Latih Tubi). ([60 API-BIJAK-06](../prd/r1/60-api-contract.md), card S3-T04)

**Q36. API says 403 for another teacher's class but the rule says 404. Which?** 404 is the default for another user's object (no existence leak). The listed exceptions answer 403, for example another teacher's class in Laporan Mingguan (AC-GUR-43-6). The list is in [60 section 1.7](../prd/r1/60-api-contract.md).

**Q37. May a Latih Tubi quiz be shorter than the chosen count?** Yes, in one case: groups are never split, so if only a group that overshoots remains, the quiz is shorter and the result screen shows "Kuiz ini mempunyai {n} soalan kerana kumpulan soalan tidak dipecahkan." With enough single questions the quiz has exactly the chosen count. ([10 FR-MUR-16-5, AC-MUR-16-2](../prd/r1/10-murid.md))

**Q38. Which card owns the free-trial rule behind the Latih Tubi 402 (ERR-PRAC-01)?** Card S5-T03, with the Latih Tubi start call (API-PRAC-01). The rule exists and stays unchanged: 50 checked answers for a pupil without an active subscription; R1 adds no new quota rule. ([10 R1-MUR-16 free-trial rule](../prd/r1/10-murid.md))

**Q39. "mata", XP, "syiling", "koin", "token": which word means what?** Syiling is the coin, token is the shop token, mata is XP ([48 section 0 item 4](../prd/r1/48-game-and-gamification-spec.md)); follow 48 when 10 words it differently.

**Q40. What are `AC-R1-14.2` and `AC-R1-17.2` in 30?** Legacy audit IDs from the earlier source pipeline, quoted where an FR or a gap came from. They are not IDs of the R1 ID chain (the chain is URS, FR/AC, DM/API, card, ledger). Prove the FR sentence next to them (for example FR-ADM-Q06.2) through the card's `AC-ADM-...` IDs; the test described in the FR text is the proof. ([30 section Q-06 and Q-07](../prd/r1/30-admin-pusat.md))

## E. Where to find answers that already exist

| If you wonder... | Look here |
|---|---|
| Which menu entry do I keep or redirect? | [30 section 3.3](../prd/r1/30-admin-pusat.md), [47](../prd/r1/47-v3-duplicates-register.md) |
| How does a question enter the system, step by step? | [45](../prd/r1/45-question-authoring-flow.md) and 30 QE-01..08 |
| How does a pupil answer, and what do the reports read? | [46](../prd/r1/46-pupil-activity-flow.md) |
| What does the pupil see in a paper (stimulus, navigator, Hantar)? | [10 section 4.8 and FR-MUR-QP](../prd/r1/10-murid.md), [40 X6.1](../prd/r1/40-cross-cutting.md) |
| Is this number the same on every screen? | XS in [20 section 5](../prd/r1/20-guru-admin-sekolah.md) |
| Which exact error text and behaviour? | [40 X10](../prd/r1/40-cross-cutting.md) (ERR catalogue) |
| Which values may a dropdown have? | [40 X11](../prd/r1/40-cross-cutting.md) (OPT sets) |
| How do the games work? | [48](../prd/r1/48-game-and-gamification-spec.md) |
| Which API do I add or change? | the card's `Data/API:` line, then [60 section 2](../prd/r1/60-api-contract.md) |
| Which migration number do I use? | [plan section 3 table](r1-development-plan.md) |
| Which UAT operation is mine? | [plan section 7 runbook](r1-development-plan.md) |
| Which ACs make an end-to-end chain, and who writes its spec? | [40 section X9](../prd/r1/40-cross-cutting.md), Q31 |
| Where are AC results recorded? | [r1-ac-ledger.md](r1-ac-ledger.md) |
