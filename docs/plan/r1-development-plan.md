# PrestasiPlus V3 — Release 1 development plan

**Status:** APPROVED by the user on 2026-11-04 (D111) — development may start; working model decided by the user (D110, 2026-11-04): (1) the UAT operator is a designated developer with server access and the user approves every write; (2) acceptance runs on UAT (a clone of V2 production data), there is no local acceptance environment; (3) content work (Bab mapping, figure images, regrouping) is done by ADMIN users in the Portal Pentadbiran. **Date:** 2026-11-04. **Owner:** Delivery Lead. **Language:** English (UI copy quoted in BM).
**Document set:** `docs/prd/r1/00-index.md` (entry) → `01-product-overview.md` (PRD/BRD) → `02-urs.md` (user requirements) → SRS per portal `10-murid.md`, `20-guru-admin-sekolah.md`, `30-admin-pusat.md` → `40-cross-cutting.md` (cross-cutting and NFR) → `50-data-model-erd.md` (DM) → `60-api-contract.md` (API) → this plan → `docs/plan/r1-traceability.md`. ID chain: URS → FR/AC → DM/API → plan card → AC ledger (`docs/plan/r1-ac-ledger.md`).
**Governing rule (user):** "berdasarkan V2+V1 untuk betulkan V3". V2 is the reference, V1 the fallback. Exception: question STRUCTURE follows D90/D41 and the DSKP (PRD 40 §X1, FR-X1-4).
**Inputs:** PRD `docs/prd/r1/` (00-index, 10-murid, 20-guru-admin-sekolah, 30-admin-pusat, 40-cross-cutting, **all FINAL**). Task cards use the real PRD IDs: `R1-MUR-<row>`, `FR-MUR-QP-n`, `R1-GUR-n`, `R1-AS-n`, `XS-n`, `R1-ADM-Q/C/N/U/M/P2-nn`, `QE-nn`, `U-OP-nn`; §4.0 reconciles them. Gap evidence: `docs/qa/gap-analysis-2026-11-04/`.

## 0. How to read this plan (one page)

1. The work is cut into **11 non-overlapping sectors** (S0–S10, §2). Every path in the repo has exactly one sector owner (CODEOWNERS, App. C).
2. Each sector has **task cards** (§4), 118 (Delivery A and B), each with PRD refs, root cause, files, tests, verification and Definition of Done.
3. A team **holds a sector by lock** (`scripts/r1-lock.mjs`) and **claims a card by lock** (R1-START-HERE, decision 1); the issue is the board. One claimant per card; the team holding the sector lock is the sector lead.
4. Work is delivered in **2-week sprints** (§5A) whose exit is measured by **PRD acceptance criteria passing in a visible browser on UAT (a clone of V2 production data)**, proven in CI first and then on UAT by the card's team (two-stage, D113); the comparison with V2 is the Delivery Lead's, not the card team's. Sprint exit is measured by ACs passing, not by tasks closed.
5. Nothing on V1, V2 or UAT is changed without the user's explicit approval (§7). UAT writes are run only by the designated UAT developer (D95 and D110: no AI session acts on a server).
6. **Acceptance is on UAT only (D110).** There is no local acceptance environment. Developers run unit/integration tests and CI (lint, typecheck, test) locally and in CI; functional acceptance evidence (card ACs, AC proofs, AC-CHAIN-1..10) comes from UAT (`uat.prestasiplus.cloud`, a clone of V2 production data) in a visible browser at 375/768/1280.
7. **Content work belongs to ADMIN users (D110).** Mapping questions to the right Bab, supplying missing figure images for "Rajah n" questions and regrouping stimulus groups are done by Admin users through the Portal Pentadbiran (improved question entry, "Soalan tanpa Bab" work-list, diagram audit, regroup work-list). Developers build and fix those screens; they do not do the content work.

**Where work happens.** Each session has its own clone or worktree; two sessions never share a checked-out branch. Screenshots and logs go in `.evidence/<task-id>/` (gitignored). UAT holds real pupil data, so evidence taken on UAT stays local and is never committed; issues and PRs carry pass/fail and IDs only. V2/V1 captures are never committed anywhere; they exist only on the Delivery Lead's PC.

---

## 0B. Improve, not rebuild

This plan closes the gaps of the existing V3; it is not a redevelopment. This is **not a rewrite.** All work is done on the existing V3 codebase (branch `feature/v3-bijak-r1`: Vue 3 + Nuxt UI in `src/`, NestJS + Prisma in `apps/api/`, `packages/contract`, `packages/exam-core`). The routes, menus, modules, API endpoints, contract, database schema and seeds stay; each card starts from a named existing file, fixes what is wrong, completes what is half-built, and builds only what does not exist. No framework, folder layout or data model is replaced.

Every card carries one **Type**, chosen after checking the code:
- **Fix**: the code exists but is wrong (a wrong route or redirect, a hidden menu, a bad rule, a bug).
- **Complete**: partly built (a backend with no screen, a screen with no backend, missing states or fields).
- **Build**: nothing exists yet.
- **Verify**: it already works; the card proves the ACs and closes small gaps.
- **Ops**: data, environment or governance work, not product code.

| Type | Delivery A cards | Delivery B cards | Total cards | Estimate (ideal days; S=1, M=3, L=6) |
|---|--:|--:|--:|--:|
| Fix | 25 | 0 | 25 | 64 |
| Complete | 39 | 4 | 43 | 178 |
| Build | 31 | 5 | 36 | 144 |
| Verify | 2 | 0 | 2 | 9 |
| Ops | 12 | 0 | 12 | 28 |
| **Total** | **109** | **9** | **118** | **423** |

Three cards that were typed Verify need product code, so they are re-typed (F-22, D113): S5-T10 Fix, S7-T01 Complete, S10-T07 Complete (the table above already counts them). S6-T06 is re-typed Fix to Complete in round 4 (it owns the whole of R1-GUR-44: CSV import, conditional DSKP form, the six-tile Alat Soalan block, stats and badges). The totals are recomputed from the cards by the Delivery Lead whenever cards are added or split (for example S1-T09a/S1-T09b).

Only **Build** is new code; Fix, Complete and Verify reuse what exists. (Estimates are rough and are re-baselined after Sprint 1.)

**Card ownership rules (D113-continued, M-8; the same text is R1-START-HERE decision 12).** (a) A card owns EVERY FR and AC of the PRD modules on its `PRD:` line, including IDs added to those modules later, unless another card names that ID explicitly on its own line (explicit beats module). (b) `Starts from (existing)` lists the entry files. The card may also edit any other EXISTING file of ITS OWN sector that its gap check shows is on the path of one of its FR/AC (the gap-check row names the file; the scope guard only warns when no Starts-from file is touched and FAILs on another sector's path); a file of another sector needs a cross-sector PR (R1-START-HERE decision 7). (c) A card creates a new file only where its `New files:` line says; a card without that line creates none. A test file for the card's own code may be created beside that code. (b) applies to every card Type except Keep, Verify and Ops: a Build card too may edit the existing files of its own sector that its gap check shows are on the path (route, menu and module wiring included), and creates new files only at its `New files:` paths (round 4). (d) Parts (round 4): a big card may be delivered in several PRs that all name the same card ID ("parts"); each PR states which FR/AC it proves; the card is Done when all its ACs pass. (e) A PRD module on the `PRD:` line of several cards is either split by ID in the table of section 4.0 E (then each card owns only the IDs listed there for it) or layered (a backend card and a screen card of the same module: each proves the ACs through its own layer and the screen card writes the UAT ledger row).

**Five concrete examples of reuse**
1. **Prestasi 360 exists but a redirect hides it.** `Prestasi360Page.vue` and the `/prestasi/:userId` route are built; `routes/prestasi.ts` sends the pupil to the school dashboard and lists `student` in `PRESTASI_SCHOOL_ROLES`. S10-T01 is a Fix, not a new screen.
2. **Set Builder exists; Pembina Kertas is merged into it.** `SetBuilderPage.vue` stays as the single builder; the duplicate list route redirects and `/admin/spm/kertas/:id` stays as "Semak Kertas Simulasi" (S3-T02, S2-T03).
3. **The gamification and shop backends exist, so only admin screens are needed.** `apps/api/src/modules/gamification/admin.controller.ts` and `shop/` already serve the data; S7-T04/T05 add the Pentadbiran pages and fix the pupil side against them.
4. **Headcount, Analisa Item and Laporan Soalan are built but hidden.** They are blocked by `STUDENT_HIDDEN_IDS` in `user-nav.ts` and by `prototype-scope.ts`; S0-T05/T06 un-hide them and S10-T02/T03 and S5-T06 fix what is wrong inside.
5. **Tracking A has a backend with no screen.** `apps/api/src/modules/spm/tracking.service.ts` exists while `/admin/spm/tracking-a` is a 404; S3-T05 is a Complete (add the lane list and set editor on the existing service). Likewise the DSKP loader (`docs/ops/dskp-loader.md`) already exists: S4-T02 is a Verify plus an Ops run, not new code (it changes no product code; a failing AC there becomes a separate Fix card).


### Guardrails: analyse, find the gap, close it, never rebuild (mandatory, user instruction 2026-11-04)

**1. Mandatory per-card workflow (in this order; a developer or a cloud agent skips none).**
1. **Code gap check before any code.** For every FR and AC on the card, record in the existing V3 code whether it **works / is broken / is missing**, with `file:line` evidence, and post it as the issue's **"Gap check"** section (table: FR/AC, status, evidence, planned change). **A card cannot move to In progress without it.** The "Gap:" line on the card is a starting hypothesis, not the evidence.
2. **Confirm scope.** If the code has changed since the PRD's "Current gap" was written, update the Gap check, not the PRD intent. The intent (FR/AC) never changes in a card.
3. **Close the gaps only**, in the existing files named under "Starts from (existing)".
4. **Prove, in two steps (D113).** (a) *Before the PR, in CI:* tag every AC of the card `[CI]` (proven by a named automated test: unit, integration or e2e on the CI seed; UI also at 375, 768 and 1280 px with no horizontal scroll), `[UAT]` (needs UAT data or a human look) or `[CI+UAT]`. (b) *After the merge,* when the designated UAT developer has deployed `feature/v3-bijak-r1` to UAT (daily; the commit is posted in the pinned issue #503), the card's team runs the `[UAT]` ACs and every AC-CHAIN-n that passes through the card (40 section X9, card S9-T06) in a **visible browser at 375, 768 and 1280 px** with the team's shared test accounts (D110: no local acceptance) and writes Pass/Fail rows in `docs/plan/r1-ac-ledger.md`. A Fail re-opens the card. Evidence in `.evidence/<card>/` (gitignored, never committed; only pass/fail and IDs go into issues, PRs and the ledger).

**2. Change budget by card Type.**

| Type | Allowed in the diff |
|---|---|
| **Keep** | No product-code change; ACs are proven only. |
| **Verify** | No product code; the card proves ACs only. A card that turns out to need product code is re-typed Fix or Complete by the team lead in the issue before any code (the scope guard FAILs a Verify PR that changes `src/`, `apps/` or `packages/`). |
| **Ops** | No product code (data, environment, governance, scripts under `apps/api/scripts/uat-ops/` only when the card names them). |
| **Fix**, **Complete** | Edit the files under "Starts from (existing)" (and the files the Gap check names there); a **new file only when the card names it**. |
| **Build** | New files **only at the location the card names**; reuse the existing services, components and tables around it. |

**3. Prohibited (a PR containing any of these is rejected).**
- creating a **parallel** page, service, store, route or table for something that already exists;
- deleting or rewriting a working page or module;
- a schema change without a **DM ID** (listed on the card and in 50);
- an endpoint without an **API ID** (listed on the card and in 60).

**4. PR template and reviewer rule.** The PR template (App. B) has these fields: card ID (exactly one), `Cross-sector:` line (or none), Gap-check link, existing files changed, the reason for each new file, DM/API IDs, the scope-guard and canonical-map results, every AC with its `[CI]`/`[UAT]` tag and the list "ACs awaiting UAT". **Reviewer rule: reject a Fix or Complete PR that does not touch its "Starts from" files or that adds a parallel implementation.** The reviewer is the team lead of the author's team, then the product owner merges (R1-START-HERE decisions 4 and 6).

**5. CI helper `scripts/r1-scope-guard.mjs` (wired by S0-T04).** Inputs: base ref, head ref and the PR body (`PR_BODY`). It reads the card ID from the PR body, looks the card up in this plan (Type, "Starts from (existing)" paths) and checks the diff:
- **FAIL** if a Fix, Complete, Keep or Verify card adds a new Vue page or route file, a NestJS controller or a Prisma model without a DM or API ID listed in the PR body;
- **FAIL** if a Keep, Verify or Ops card changes product code (`src/`, `apps/`, `packages/`) (so a card that needs code must be typed Fix or Complete first);
- **WARN** if a Fix or Complete card touches none of its "Starts from" paths;
- **WARN** if an existing file loses more than 60% of its lines.
It prints a BM and English summary; exit code 1 = FAIL, 2 = setup error, 0 = pass (warnings allowed). `node scripts/r1-scope-guard.mjs --self-test` runs its fixtures. A cross-sector small PR (R1-START-HERE decision 7) names the card it serves and carries the line `Cross-sector: S<n> (<reason>)`; the guard accepts the files of the named sector when that line is present. Plan format the script relies on (do not change it): the card line `**S<n>-T<nn> <title>** ... Type: <type>` (a split card has one lowercase letter after the number, `S1-T09a`), no heading inside a card, and "Starts from (existing)" paths in backticks, repo-relative, plain paths or directories (no `**` globs, no prose in backticks).

---

## 0A. Building with cloud agents (mandatory)

The system is built by **cloud agents** (one session per card). They have **no access to V1 or V2** and no server access, and never open them; the only thing they may open is UAT in a browser, with the shared test accounts their team lead holds. Everything an agent needs is in the repository. Each session has its own clone or worktree and never shares a checked-out branch with another session; a session without Docker runs unit, typecheck, lint and contract checks only and marks stack/e2e ACs "awaiting CI/UAT".

**Gap check first.** Before writing code, post the card's **Gap check** on the issue (works / broken / missing per FR and AC, with file:line, §0B workflow). The card is built from that check inside the change budget of its Type (§0B); the agent never creates a parallel implementation.

**Read order for every card, in this order:**
0. `docs/plan/R1-START-HERE.md` (the working rules) and `docs/plan/R1-FAQ.md`.
1. `docs/prd/r1/00-index.md` (IDs, conventions, "Codes in plain words") then `docs/prd/r1/40-cross-cutting.md` (reference rule, X1-X8, NFR).
2. The PRD section of each module named on the card's "PRD:" line (`10-murid.md`, `20-guru-admin-sekolah.md` or `30-admin-pusat.md`): the FRs, ACs, exact BM copy and deviations.
3. For the data and API shape: `docs/prd/r1/50-data-model-erd.md` and `docs/prd/r1/60-api-contract.md`. There are **no screenshots** in the repo: every V2/V1 screen is described in words (layout, blocks in order, exact BM copy, states) inside the SRS section of its module, so the SRS text is the only screen reference.
4. The card itself (this plan, §4, mirrored on the GitHub issue).

**Rules**
- **Agents never open V1 or V2, and never touch a server.** Using UAT in a browser with the team's shared test accounts is allowed (R1-START-HERE decision 5). If a behaviour, copy, field, state or screen is not in the PRD text, **ask your team lead**: comment `[<team>/S-<k>] QUESTION: ...` on the issue with the two places that disagree and your suggested answer, and set `status:blocked`. The team lead answers by the tie-break in R1-FAQ Q11 and records the answer on the issue. Do not guess, do not invent, do not "improve". "Not observed in V2" in the PRD is not a question: build from the FR text and the generic loading/error/empty rules (FR-X6).
- **One card per session.** Stay inside the sector's owned paths (§2); a change elsewhere is a small cross-sector PR (§3, R1-START-HERE decision 7: the card ID of the work it serves, the line `Cross-sector: S<n> (reason)`, the label `needs:S<n>`, reviewed within 1 working day by the team holding S<n>). Do not start a second card in the same session.
- **FR-X1-5, close the gaps only (user directive: "close, fix and improve the gaps only; never rebuild from scratch").** Change only what the card's gap lists. Reuse the existing routes, components, APIs and data. Never rewrite, restyle or restructure a working screen or module. A **Verify** card changes no code unless one of its ACs fails, and then fixes only that failure. Replacing a working screen, component or API needs the Delivery Lead's **written approval in the issue** before the work starts; without it the PR is rejected.
- **Banned patterns** (a PR containing any of them is rejected): placeholder strings ("akan datang", "belum tersedia", "Pratonton", prototype notices), mock or demo data in a matrix module, a new menu item or page that the PRD does not list, a renamed label, an extra feature, a feature flag that hides a matrix module (except those named in the PRD), copy in English where the PRD gives BM, a real person's name anywhere.
- **Evidence the PR must carry:** real test output (`typecheck`, `lint`, `npm test`, `be:verify`); the scope-guard and canonical-map results; the card's **AC list, every AC tagged `[CI]`, `[UAT]` or `[CI+UAT]`**, with the automated test that proves each `[CI]` AC (UI also at 375 / 768 / 1280 with no horizontal scroll); the list "ACs awaiting UAT"; the deviations from the PRD text, if any, as a numbered list. Screenshots from UAT stay in the local `.evidence/` and are never attached; the PR carries only pass/fail and IDs, never names.
- **UAT proof and Done (§6.5).** After the PR is merged and the designated UAT developer has deployed, the card's team runs the `[UAT]` ACs in a visible browser and writes the rows in `docs/plan/r1-ac-ledger.md`. A card moves to `status:done` only after UAT Pass. Comparison with V2 is the Delivery Lead's job at verification (§8); a card team never compares with V2 and never opens it.

**Using the traceability report.** `node scripts/r1-trace-check.mjs` (from the repo root) reads the PRD IDs and this plan's cards and writes `docs/plan/r1-traceability.md`: every PRD module with its FR/AC counts and the cards that cover it, and every card with the PRD modules it cites. Before starting, open that file, find your card, and read **every** PRD module listed against it. When you add or split a card, re-run the script: it must exit 0 (first line `uncovered: 0 | dangling: 0`, second line with `unknown URS: 0`, `unknown DM/API: 0` and `ownership defects: 0`). **Every card carries a line `- Data/API: DM-xx, …; API-…` (or `none`)**: the DM rows of `50-data-model-erd.md` and the `Exists-Fix`/`Missing-Build` API rows of `60-api-contract.md` that the card implements (the `Exists-OK` routes it verifies may be listed too). Each DM and each `Exists-Fix`/`Missing-Build` API is owned by **exactly one** card; a card that only reads an owned item names it in `- Also uses:`. If a DM or API has no card, add it to the most fitting card of the same sector (a new card only when nothing fits, with the card format, sector and CODEOWNERS rules, the sprint table and the totals updated). A card must name every PRD module it implements in its "PRD:" line as full IDs (`R1-MUR-17, R1-MUR-26`, `FR-MUR-QP-6`, `R1-ADM-Q-16`, `NFR-1`). CI runs the same script (S0-T04) and fails when a PRD module has no card or a card cites an unknown ID.

---

## 1. Goal, phases and milestones

**Goal.** Every module ticked in `docs/Matriks-Akses-Peranan .xlsx` is **fully working on real data**: no "Pratonton", "akan datang", "belum tersedia", prototype page, mock path or dead control (D100, FR-X2-0). Behaviour replicates V2 (V1 fallback). Questions are entered and served the DSKP-correct way, with stimulus groups at the centre (D90). Every screen works at 375/768/1280, question-paper screens first.

| Delivery | Scope | Exit (all must hold) |
|---|---|---|
| **Delivery A (1.0 + linked modules, D106)** | Murid, Guru, Admin Sekolah 1.0 columns + Latih Tubi (PRD 40 §X2) + every module that a 1.0 screen links to (Murid 17, 18, 20, 23, 26, 28-31, 33; Guru 2b, 8, 8b; D106) + the Admin Pusat screens that feed them (PRD 30) | Every AC of every 1.0 module passes on UAT (visible browser, side by side with V2); AC-X2-1, AC-X2-2, AC-X2-3, AC-X6-1, AC-X6-2, AC-X3-1 pass; P0 data operations done on UAT (§7); user signs off the Delivery A demo |
| **Delivery B** | Every other module ticked in the full Murid/Guru/Admin Sekolah columns (Murid A4, rows 15–40; Guru A4; AS A1–A4, 2) + the admin screens that feed them (Gamifikasi, Kedai Hadiah, Marketplace, Kawalan Reward, …). Cikgu Alesa and Keluarga Angkat stay hidden (D102) | Each module passes its ACs and is then switched on via its scope flag (FR-X2-1). No other matrix module is hidden at the end |

**Order inside Delivery A: P0 first, then P1.** P2 items (PRD priority) may slip behind the Delivery A sign-off if the user agrees, but they are not forgotten: they stay on the board.

| Milestone | When (5-dev plan, §5A) | Meaning |
|---|---|---|
| M0 Foundation | end of Sprint 0 | Stack boots untouched, board live, UAT accounts and DSKP loaded |
| M1 No broken sidebar | end of Sprint 1 | AC-X2-1 passes for pupil, teacher, school admin; weekly-report, analytics, Kirkpatrick, Headcount, Prestasi, Analisa Item, Laporan Soalan work |
| M2 DSKP-correct questions | end of Sprint 2 | An admin can enter/import a paper with stimulus groups and publish it |
| M3 Bijak SPM on a phone | end of Sprint 3 | T5 pupil sits a published paper with stimulus groups on 375 px (AC-X6-2) |
| M4 Delivery A complete (RC) | end of Sprint 6 | All P0+P1 ACs pass; release checklist (§8) green |
| M5 Delivery B | Sprint 7+ | Rest of the matrix |

---

## 2. Sectors

Rules for all sectors: a sector owns the listed paths (read anywhere, **write only in owned paths**). A change in a forbidden path is a small PR to its owner (§3). "FE/BE/data" = skills. "Start now" = no unmet dependency.

Shorthand: `FE` = `src/`; `BE` = `apps/api/src/modules/`; `SCH` = `apps/api/prisma/schema/`; `SEED` = `apps/api/prisma/seed/`; `CT` = `packages/contract/src/`.

### S0 Platform, build, shared registries
- **Scope:** PRD 40 §X2/X5/X6 NFR-4/6/7; AC-X2-1/2/3; register 6.2b rows 3, 17, 18 (20-guru-admin-sekolah); PRD 30 §3 (admin menu), N-06 Kawalan Ciri.
- **Owned:** `.github/**`, `scripts/**`, `compose*.yaml`, `Dockerfile*`, `docs/ops/**`, `docs/plan/**`, `e2e/global/**`, `e2e/fixtures/**`, new `e2e/r1/**`; `src/app/**` (incl. `prototype-scope.ts`, `features.ts`, `router/**`), `src/shells/**` (`pentadbiran/menu.ts`, `nav/user-nav.ts`), `src/api/**`, `src/lib/**` (except `lower-form.ts`), `src/modules/m01-authentication/**`; BE `auth/`, `jobs/`, `ocr/`, `common/` (= `apps/api/src/common/**`), `index.ts`; `SCH/base.prisma`, `identity.prisma`, `etl.prisma`, `feature-flags.prisma` (new, DM-34); `SEED/index.ts`, `guard.ts`, `e2e*.ts`, `core/**`; `CT/common`, `CT/auth`, `CT/access`, `CT/session`, `CT/index.ts`, `CT/openapi.ts`, `packages/contract/openapi.json`; frozen (hidden) modules `cikgu`, `src/modules/m13-*`, `m25-*`.
- **Forbidden:** all page code of other sectors.
- **Skills:** BE/infra, small FE. **Deps:** none. **Start now: yes.**

### S1 Question model and pipeline (backend)
- **Scope:** PRD 30 §4.0 QE-01..08, Q-05, Q-06, Q-07..Q-12, Q-22/23 backend; 40 §X1-4a..f, §X4-2; 30 §4.G.7 (FR-ADM-G7.1..G7.3); 20 row 5 of 6.2b (paper intake).
- **Owned:** BE `questions/`, `intake/`, `ai-extraction/`, `files/`, `classes/question-sets/**` (carve-out of S6's `classes/`); `SCH/questions.prisma`, `questions-workflow.prisma`, `intake.prisma`, `ai.prisma`, `files.prisma`; `SEED/questions/**`; `CT/questions`, `CT/question-workflow`, `CT/servability`, `CT/intake`, `CT/ai`, `CT/files`; `apps/api/test/intake-workflow/**`.
- **Forbidden:** `BE/exam`, `BE/spm`, `BE/bijak` (S3), `BE/curriculum` (S4), any `src/`.
- **Skills:** BE, data. **Deps:** S0-T02 (stack) for runtime tests only. **Start now: yes.**

### S2 Admin question UI
- **Scope:** PRD 30 §3.2 (Soalan group), Q-03/04/05/07..12, Q-19..24, C-05 bulk UI, QE-02/04/08 UI, 4.R.1 responsive for these screens.
- **Owned:** `src/modules/m04-question-bank/**`, `src/modules/m28-bijak-spm/admin/intake/**`, `src/modules/m28-bijak-spm/__tests__/` files named `intake*`, `figure-links*`, `semakan*`; `e2e/m04*`, `e2e/bijak/intake-*`, `e2e/bijak/admin-publish-*`.
- **Forbidden:** `m28-bijak-spm/admin/{builder,kontrak,papers,kandungan}` (S3), shared display components (S8), `menu.ts` (S0).
- **Skills:** FE. **Deps:** S1 (T01/T02/T03/T07) for real data; can start against current API. **Start now: yes** (UI/responsive first).

### S3 Bijak SPM papers
- **Scope:** PRD 30 Q-01/02, Q-13..Q-18; 10-murid R1-MUR-13 (hub, Bijak SPM, Databank, Tracking A, Subjektif, self-mark); 40 §X6.1 paper screens (pages only).
- **Owned:** `src/modules/m28-bijak-spm/{admin/builder,admin/kontrak,admin/papers,admin/kandungan,pages,lib,domain,server,data,routes.ts}`, `m28-bijak-spm/components/{SelfMarkControl,ResultGroup,PartResultCard,PastSittingsLink,GenerateShortageAlert,KeywordSuggestion,KuizItem,ReportQuestionButton}.vue`, `src/modules/m06-spm/**`, `packages/exam-core/**`; BE `spm/`, `bijak/`, `exam/`; `SCH/exam.prisma`, `spm.prisma`, `bijak-attempts.prisma`; `SEED/{exam*.ts,spm*.ts,bijak-standards/**}`; `CT/bijak`; `e2e/bijak/**` (except intake/publish specs of S2).
- **Forbidden:** the shared display components listed under S8, `BE/questions` (S1), `BE/curriculum` (S4).
- **Skills:** FE + BE. **Deps:** S8-T01 (component move), S1-T01/T06, S4-T02/T03. **Start now:** Kontrak and builder tasks yes; pupil sitting waits for S8-T02.

### S4 Curriculum / DSKP and UAT data
- **Scope:** PRD 30 §4.B C-01..C-05, §4.G, QE-08 data part, 40 §X3; U-OP data operations (§7).
- **Owned:** BE `curriculum/**`; `SCH/curriculum.prisma`; `SEED/{curriculum.ts,curriculum-data/**,spm-subject-configs.ts}`; `CT/curriculum`; `apps/api/scripts/uat-ops/**` (new); `docs/reference/dskp/**`, `docs/ops/dskp-loader.md`; FE `src/modules/m03-curriculum/pages/{Chapter*,Topic*Create*,Topic*Edit*,Level*,Subject*,CurriculumBrowserPage}.vue` and its `api/`, `mock/`, `routes` for those pages.
- **Forbidden:** pupil pages `TopicsPage`, `LearningMapPage`, `TopicDetailPage` (S5), `BE/questions` (S1).
- **Skills:** BE, data (+ small FE). **Deps:** S0-T02. **Start now: yes.**

### S5 Murid learning, account, content
- **Scope:** 10-murid rows A1, A2, A3 (**for all roles**, incl. GUR-A1..A3, AS-A5), 2 Dashboard, 7 Video, 8 Kelas Saya, 9 Soalan by Chapter, 12 Remedial, 16 Latih Tubi, 54 Laporan Soalan; PRD 30 N-01..N-04 (Video/Artikel/Banner/Nota admin); `/perutusan`; register 6.2b rows 6, 7, 14 (page part), 19.
- **Owned:** `src/modules/m05-practice/**`, `m09-content/**`, `m03-curriculum/pages/{TopicsPage,LearningMapPage,TopicDetailPage}.vue`, `src/modules/m10-teacher-class/pages/{KelasSayaPelajarPage,KelasListPage}.vue`, `src/modules/m01-authentication/pages/{Profile*,Tetapan*}` and `routes/{profile,tetapan}.ts` (S0 keeps the rest of m01), `src/lib/lower-form.ts`; BE `practice/`, `content/`, `account/`, `classes/kelas-saya.controller.ts`; `SCH/practice.prisma`, `content.prisma`; `SEED/{practice.ts,content.ts,gamification-data.ts excluded}`; `CT/practice`, `CT/content`, `CT/account`.
- **Forbidden:** `m08-*` (S10), `BE/curriculum` (S4), `BE/questions` (S1), teacher pages in `m10` (S6).
- **Skills:** FE + BE. **Deps:** S4-T03/T06 (chapters/levels), S8-T02 (stimulus display). **Start now:** profile, Laporan Soalan, Video yes.

### S10 Performance and analytics (m08), all roles
- **Scope:** 10-murid R1-MUR-3 (Headcount, pupil), R1-MUR-4 (Prestasi), R1-MUR-5, R1-MUR-6 (Analisa Item), R1-MUR-14 (Heatmap), R1-MUR-39 (Timeline); 20-guru-admin-sekolah R1-GUR-3/4/5/6 and R1-AS-3/4/5/6 (Headcount, Prestasi, Analitik and Analisa Item of the teacher and the school admin); the weekly-report service; register rows 4, 8, 11. Migration range 0190-0199.
- **Owned:** `src/modules/m08-student-performance/**` (pages, routes, api, components, mock); BE `reports/performance/**` (`domain/access-policy.ts`, `domain/privacy.ts`, `http/**`, `services/**`) and `heatmap/`; `SCH/reports.prisma`; `CT/reports/` (except `CT/reports/kirkpatrick*`, S6) and `CT/heatmap`.
- **Forbidden:** `m11-*`, `m12-*`, `m27-*`, `BE/school-admin`, `BE/command-center`, `BE/reports/analytics`, `BE/reports/kirkpatrick` (S6); `BE/practice` (S5: S10 reads `practice_answers`, never writes it); `BE/curriculum` (S4).
- **Skills:** FE + BE. **Deps:** S5-T15 (the single answer store) and S0-T05/T06 (un-hide, nav). **Start now:** S10-T01 and S10-T02 on fixture rows before S5-T15 merges. Lock key `S10`; other sectors' cards that need an S10 file (S6-T01, S6-T03) use a cross-sector PR with `needs:S10`.

### S6 Guru and Admin Sekolah portals, Admin Pusat users/monitoring
- **Scope:** 20-guru-admin-sekolah (R1-GUR-1,2,2b,8,8b,10,11,41–44 and the Alat Soalan tools 44a–44e; R1-AS-0,1,10,11,46–53; shell FR-SH, XS-1..6); PRD 30 U-01..U-09, M-01..M-08.
- **Owned:** `src/modules/m10-teacher-class/**` (except the pupil page `KelasSayaPelajarPage.vue` in S5; `KelasListPage.vue`, the teacher page `/guru/kelas`, is also listed under S5, so S6-T14's change to that one file is a small cross-sector PR to S5), `m11-teacher-analytics/**`, `m12-kirkpatrick/**`, `m27-school-admin/**`, `m17-admin-dashboard/**`, `m02-users-schools/**`, `m18-ppd-jpn/**` (frozen, out of 1.0); BE `school-admin/`, `command-center/`, `classes/**` (except `question-sets/`, `kelas-saya.controller.ts`), `reports/analytics/`, `reports/kirkpatrick/`, `users/`, `schools/`, `parents/`; `SCH/classes.prisma`, `schools.prisma`; `SEED/core/schools.ts` by request to S0; `CT/classes`, `CT/school-admin`, `CT/schools`, `CT/admin`, `CT/reports/kirkpatrick*`.
- **Forbidden:** `m08-*` and `BE/reports/performance` (S10), `BE/games`+`battle` (S7).
- **Skills:** FE + BE. **Deps:** S10 (shared read models), S7-T02 (Sekolah Bersaing). **Start now: yes** (UAT account, Laporan Mingguan, Kirkpatrick).

### S7 Gamification, rewards, games, marketplace (pupil + admin)
- **Scope:** 10-murid R1-MUR-21 (Delivery A); AS-45 Sekolah Bersaing; PRD 30 N-05 Tetapan Permainan (Delivery A); Delivery B: murid rows 15–40, admin Gamifikasi, Kedai Hadiah, Kawalan Reward, Marketplace, Notifikasi, Sokongan.
- **Owned:** `src/modules/m14-*`, `m15-*`, `m16-*`, `m20-*`, `m21-*`, `m22-*`; BE `gamification/`, `games/`, `battle/`, `shop/`, `marketplace/`, `wallet/`, `sponsorship/`, `subscriptions/`, `support/`, `notifications/`; `SCH/{gamification,games,battle,marketplace,wallet,sponsorship}.prisma`; `SEED/{games,battle,gamification*,marketplace,wallet}.ts`; `CT/{gamification,games,battle,marketplace,notifications}`.
- **Forbidden:** `m05`, `m08`. **Skills:** FE + BE. **Deps:** none for Delivery A cards. **Start now: yes** (low load until Delivery B).

### S8 Question rendering and responsive (shared display layer)
- **Scope:** PRD 40 §X6.1 (FR-X6-1..11), AC-X6-1/2, FR-X1-4d; 10-murid §4.6, §4.8, §4.9; 30 §4.R.
- **Owned (precise):** `src/components/question-display/**`; `src/ds/**`, `src/theme/**`, `src/styles/**`; and the display-layer files that today live in `src/modules/m28-bijak-spm/components/`: `PartInput.vue`, `PartNode.vue`, `QuestionBlock.vue`, `RichText.vue`, `MathField.vue`, `MathKeyboard.vue`, `StimulusStack.vue`, `StimulusView.vue`, `StimulusChip.vue`, `NavigatorPanel.vue`, `AttemptShell.vue`. S8-T01 **moves** them into `src/components/question-display/` and leaves re-export stubs, so S3, S5 and S2 import only from the barrel `src/components/question-display/index.ts`.
- **Forbidden:** pages (they compose the components) in every module. A page needing a new prop/slot asks S8 by issue (small PR to S8, §3).
- **Skills:** FE (CSS, a11y, maths). **Deps:** none to start. **Start now: yes.** S8 is the *only* writer of these files; the "move" PR lands first (S8-T01, day 1–2 of Sprint 0) and other sectors rebase on it.

### S9 Verification and UAT acceptance (Delivery Lead)
Owns no product code. Owns: `.evidence/**` (local), `docs/plan/r1-ac-ledger.md` (§6.9), `docs/qa/r1/**`. The S9 sector runs the §5A ceremonies, the V2 side-by-side checks at verification (evidence never committed), UAT acceptance walks of the sprint's exit list (all functional acceptance evidence is taken on UAT, D110), the XL integration pass and the release checklist, and samples the ledger. **A card's team lead sets `status:done` after the card's UAT Pass; the Delivery Lead samples and may re-open (§6.5).** **S9 is the Delivery Lead's sector and cannot be claimed as a SECTOR (no team holds the lock `S9`), but its cards (S9-T01..S9-T06) are worked by the Delivery Lead session, S9-T06 included (D-T10-5).** The chain spec of AC-CHAIN-n is written by the LAST card of that chain (the card named for chain n in the card S9-T06) under `e2e/r1/chains/` (an S0-owned folder: that card's PR is a small cross-sector PR with the line `Cross-sector: S0 (chain spec)` and the label `needs:S0`); S9-T06 runs and maintains the full chain suite.

---

## 3. Shared-file protocol

| Shared file | Single owner | How others change it | Merge order |
|---|---|---|---|
| `src/shells/pentadbiran/menu.ts` | S0 | Menu is changed only by S0-T07 (the target menu is FINAL, D107: no approval wait) and later by one-line cross-sector PRs to S0 (label/route/`built`; R1-START-HERE decision 7: the PR names its card, carries `Cross-sector: S0 (menu line)` and the label `needs:S0`). A sector never edits `menu.ts` in its own card PR; it makes its route exist and names the route in the cross-sector PR. | S0 first, then pages |
| `src/shells/nav/user-nav.ts` | S0 | Same. All wrong targets of the 1.0 rows are fixed in S0-T06 in one PR (so the nav is touched once). Later: PR ≤20 lines to S0, reviewed within 1 working day | S0 first |
| `src/app/prototype-scope.ts`, `features.ts`, `modules.ts`, `router/**` | S0 | **Delete-only for sectors**: when a module passes its ACs, its sector opens a PR that removes its own entry from the scope list (lines between `// [S<n> begin]` / `// [S<n> end]` markers that S0-T05 inserts). Adding an entry (hiding something) is S0 only | after the module PR |
| Route registries `src/modules/*/routes.ts`, `src/app/modules.ts` | the module's sector (routes.ts); S0 (modules.ts list) | A new module is registered by S0; routes inside a module by its sector | |
| `apps/api/prisma/schema/*.prisma` | the sector that owns that file (§2). `base.prisma` S0 | A sector needing a table/column in another sector's file asks that sector (issue label `needs:schema`); the owner adds it in **their** migration range | schema PR before consumers |
| Migrations `apps/api/prisma/migrations/` | S0 as gatekeeper of the numbering only | **Reserved ranges** below; name `0NNN_<sector>_<slug>`; one migration per PR (a card that owns several migrations, such as S7-T05 with `0223`, `0229`, `0230`, opens one PR per migration in number order; every PR body names the same card ID and the scope guard accepts that); expand-then-contract only (no destructive change in the same release); `npm run be:lint:migration` must pass | by number |
| `packages/contract/src/**`, `openapi.json` | per folder (§2); `index.ts`, `openapi.ts`, `openapi.json` S0 | see contract rules | contract PR first |
| Seeds `apps/api/prisma/seed/**` | per file (§2); `index.ts`, `guard.ts`, `e2e*.ts`, `core/**` S0 | A sector never edits another sector's seed; asks for a fixture by issue. New fixtures go in the sector's own file and are registered in `index.ts` by S0 in the same PR as a one-line change | seed owner first |
| `package.json`, `package-lock.json` | S0 | New dependency = PR to S0 with reason (no new dependency without it) | |
| `docs/TRACKER.md` | Delivery Lead | Sectors do not edit it | |

**Migration number reservation** (next free number today is `0120`; `0111–0119` kept for an S0 hotfix):

| Sector | Range | | Sector | Range |
|---|---|---|---|---|
| S1 | 0120–0139 | | S6 | 0200–0219 |
| S4 | 0140–0159 | | S7 | 0220–0239 |
| S3 | 0160–0179 | | S2 | 0240–0244 (spare, UI sector rarely needs one) |
| S5 | 0180–0189 | | S0 | 0250–0259 |
| S10 | 0190–0199 | | Delivery Lead (data fixes) | 0260–0269 |

**Migrations by card (numbering from `50-data-model-erd.md` §4.8; 50 migrations; these are the only ones R1 needs).**

| Migration | DM | Card |
|---|---|---|
| `0120_s1_group_fk_restrict` | DM-02 | S1-T01 |
| `0121_s1_servability_flags` | DM-05 | S1-T07 |
| `0122_s1_archive_reason_regrouped` | DM-06 | S1-T01 |
| `0123_s1_section_label`, `0124_s1_kertas_range`, `0125_s1_intake_level` | DM-07, DM-08, DM-09 | S1-T03 |
| `0126_s1_chapter_fk_restrict` (S1 range, requested by S4 with `needs:schema`) | DM-18 | S4-T07 |
| `0127_s1_personal_question` (S1 range, requested by S6 with `needs:schema`) | DM-42 | S6-T16 |
| `0140_s4_levels_secondary_only` | DM-13 | S4-T05 |
| `0160_s3_placement_question_fk` | DM-11 | S3-T02 |
| `0161_s3_paper_surface` | DM-23 | S3-T06 |
| `0162_s3_tracking_sibling_unique` | DM-24 | S3-T05 |
| `0180_s5_support_ticket_context` (S5 range, requested by S7 with `needs:schema`) | DM-32 | S7-T09 |
| `0200_s6_question_set_kind` | DM-43 | S6-T20 |
| `0221_s7_draw_winners`, `0222_s7_mystery_boxes` | DM-36, DM-37 | S7-T07 |
| `0250_s0_feature_flags` | DM-34 | S0-T10 |
| `0128_s1_difficulty_level` | DM-47 | S1-T02 |
| `0163_s3_paper_source_batch` (S3 range, requested by S1 with `needs:schema`) | DM-45 | S1-T10 |
| `0181_s5_answer_store_mode` | DM-44 | S5-T15 |
| `0191_s10_headcount_defaults` | DM-49 | S10-T02 |
| `0201_s6_question_set_assignments` | DM-46 | S6-T14 |
| `0223_s7_reward_settings` | DM-48 | S7-T05 |
| `0129_s1_bilingual_twins` | DM-50 | S1-T09b |
| `0130_s1_group_draft_copy` | DM-51, DM-52 | S1-T01 |
| `0131_s1_stimulus_kinds` | DM-70 | S1-T01 |
| `0132_s1_stimulus_flag_ref` | DM-53 | S1-T07 |
| `0133_s1_scheme_v2_mode_config` | DM-54, DM-55 | S1-T09a |
| `0134_s1_question_types` | DM-69 | S1-T09a |
| `0135_s1_textbook_ref_rejection` | DM-56, DM-58 | S1-T02 |
| `0136_s1_intake_retry_status` | DM-71 | S1-T04 |
| `0137_s1_intake_guru_source` | DM-72 | S1-T08 |
| `0164_s3_blueprint_marks_per_question` | DM-57 | S3-T01 |
| `0182_s5_session_abandoned` | DM-66 | S5-T15 |
| `0183_s5_video_school_visibility` | DM-76 | S5-T08 |
| `0184_s5_user_aspiration` (identity table, requested with `needs:schema`) | DM-80 | S5-T05 |
| `0185_s5_report_source` | DM-82 | S5-T06 |
| `0202_s6_intervention_review` | DM-30 | S6-T02 |
| `0203_s6_classroom_unique_name` | DM-73 | S6-T14 |
| `0204_s6_user_username_unique` (identity table, requested with `needs:schema`) | DM-74 | S6-T10 |
| `0205_s6_mission_fields` | DM-75 | S6-T07 |
| `0224_s7_game_engine` | DM-60, DM-64 | S7-T01 |
| `0225_s7_league_tournament` | DM-61, DM-62 | S7-T06 |
| `0226_s7_challenge_claims` | DM-63 | S7-T04 |
| `0227_s7_draw_status` | DM-65 | S7-T07 |
| `0228_s7_game_room_session` | DM-67 | S7-T01 |
| `0229_s7_reward_catalogue_merge` | DM-77 | S7-T05 |
| `0230_s7_redemption_idempotency` | DM-78 | S7-T05 |
| `0231_s7_ledger_idempotency` | DM-79 | S7-T04 |
| `0232_s7_challenge_type_combo` | DM-81 | S7-T04 |

Not needed (50 §4.8): `0140_s4_question_chapter_link`, `0160_s3_self_mark`, `0220_s7_marketplace_admin`.

Prisma applies pending migrations by name, so a lower number landing after a higher one is safe if the tables are independent. A migration that depends on another sector's migration states it in the PR and waits for it to merge. Data repairs for UAT are **scripts** (`apps/api/scripts/uat-ops/`), run by the designated UAT developer, never migrations (as `dskp-loader.md` does). **Exception (D113-continued, M-9):** a data migration is allowed only when it ships in the same PR as the schema change it completes and is idempotent (re-runnable; dry-run first on UAT by the designated UAT developer). Migration `0229_s7_reward_catalogue_merge` (DM-77) qualifies; DM-77 names the U-OP that runs its dry run.

**Contract-change rules.**
1. Additive only inside Release 1 (new optional field, new endpoint, new enum value with a safe default). A breaking change needs an ADR and S0's approval.
2. The contract change is its **own small PR** (`CT/<folder>` + `npm run contract:emit` + regenerated `openapi.json`), merged **before** the BE and FE PRs that use it. Run `npm run contract:check` and `npm run be:verify`.
3. `openapi.json` is generated: on a merge conflict, take either side and re-run `npm run contract:emit`; never hand-merge.
4. FE uses only the contract type; no ad-hoc response shapes.
5. A change in a folder owned by another sector needs that sector's review (CODEOWNERS enforces it).

**Rebase and merge rules.** Short-lived branches from `feature/v3-bijak-r1`; rebase onto it daily; **squash merge**; CI green is required; prefer PRs of ≤400 changed lines. Order in a day: S0 → contract PRs → schema/migration PRs → BE → FE. A PR waiting more than 1 working day for a cross-sector review is escalated to the Delivery Lead (S9), who may reassign the review. No long-lived integration branches (the old `team/*`, `be/integration-*` pattern is not used).

---

## 4. Task cards

### 4.0 Reconciliation with the final PRD (IDs, P0 coverage, placeholder registers)

**A. Question-paper contract FR-MUR-QP-1..17 / AC-MUR-QP-1..17 (P0, 10-murid §4.8) to cards.**

| PRD | Owner card(s) |
|---|---|
| QP-1, 2, 3, 8, 9 (stimulus once, sticky, never a question, phone panel, zoom) | S8-T02 (components), S3-T04 and S5-T02/T03 (pages use them) |
| QP-4, 5 (stimulus never missing; stem never twice) | S1-T07 (detectors + exclusion), S4-T04 (data), S8-T02 (display shows text once) |
| QP-6, 7 (draw takes whole group or nothing; every drill serves figures and groups, D105; a surface that cannot render one kind excludes the whole group with a reason) | S1-T06, S3-T07, S5-T03 |
| QP-10, 15 (full-width inputs, keyboard, maths notation incl. matrices) | S8-T03 |
| QP-11, 12, 16 (sticky top/bottom bar, Hantar at every width, rotation, legend not by colour) | S8-T04, S3-T04 |
| QP-13 (quiz layout Semak/Lapor) | S5-T03, S5-T02, S5-T06 |
| QP-14 (result/review cards) | S8-T05, S3-T04 |
| QP-17 (observed V3 problems: no Hantar at 375, no mode badge, prose matrices, Rajah 14/11/9/7 without figure) | S8-T04, S8-T03, S1-T07 |
| DK-1..4 (10-murid 4.10, DSKP level per module) | S4-T03/T02 (data), S5-T02, S10-T04, S10-T05 |

**B. P0 coverage check (every P0 module or screen has at least one card).**

| PRD P0 item | Card |
|---|---|
| Murid A5 Log Keluar / shell | S5-T10, S0-T06 |
| MUR-3 Headcount; MUR-4 Prestasi; MUR-6 Analisa Item | S10-T02; S10-T01; S10-T03 |
| MUR-9 Soalan by Chapter; MUR-16 Latih Tubi; MUR-54 Laporan Soalan | S5-T02; S5-T03; S5-T06 |
| MUR-13 SPM / Bijak / Tracking A / Subjektif | S3-T04, T05, T06, T07 |
| GUR-43; GUR-5; AS-5; AS-11; AS-3; AS-45; AS-0; XS-1..5; FR-SH | S6-T01; S10-T04; S10-T04; S6-T02; S10-T02; S7-T02; S6-T05; S6-T03; S0-T06 |
| ADM Q-01, Q-02 | S3-T03 |
| Q-03, Q-04, Q-05, Q-06 | S2-T01, S1-T01, S1-T02, S1-T07 |
| Q-07, Q-08, Q-09 | S2-T02, S1-T03, S1-T04, S0-T03 |
| Q-13, Q-14, Q-15, Q-16, Q-17 | S3-T02, S3-T01, S3-T05, S3-T08 |
| C-01, C-03, C-04, C-05 | S4-T07, S4-T05, S4-T02, S4-T03 and S2-T08 |
| U-01..U-04 | S6-T12 |
| QE-01..QE-08 | S1-T01..T07, S2-T01/T02/T04, S4-T04 |
| Responsive AC-ADM-R1..R11 | S2-T07, S8-T06 |

P1 screens not named above are covered by: Q-10/11/24 S2-T05; Q-12 S1-T08 + S2-T02 + S6-T06; Q-18 S3-T06; Q-20/22/23 S2-T06; N-01 S5-T08; N-05 S7-T03; N-06 S0-T10; R1-GUR-44a..44e (Alat Soalan tools) S6-T16..T20, FR-GUR-44-8/AC-GUR-44-9 S6-T06; U-05/06/08/09 S6-T11; M-01..M-06 S6-T08/T11. P2 screens: Q-19, Q-21 S2-T09; N-02..N-04 S5-T09; U-07 S6-T11; M-07/08 S6-T13; P2-01..P2-19 S7-T04..T06, S0-T11, S5-T11.

**C. Placeholder registers to cards (AC-X2-3; every row has an owner).**

| Register row | Card |
|---|---|
| 20-guru 6.2b #1, #2 (Laporan Mingguan page and menu) | S6-T01, S0-T06 |
| #3 and 10-murid 4.11 #7 (`prototype-scope.ts`, `LayoutHost.vue`, `src/pages/PrototypeUnavailablePage.vue`) | S0-T05 |
| #4, #11 (Headcount shells, AS list empty) | S10-T02 |
| #5 and 4.11 #12 (paper intake 503, "belum tersedia dalam demo") | S1-T08, S6-T06, S2-T01, S3-T04 |
| #6, #7 (dashboard checklist, `/guru/profil/edit`) | S6-T07, S5-T05 |
| #8 (Analitik routes) | S10-T04, S0-T06 |
| #9, #10 (Kirkpatrick) | S6-T02 |
| #12 (Sekolah Bersaing) | S7-T02 |
| #13 (Import Pelajar hidden) | S6-T09, S0-T06 |
| #14 (`/perutusan`) | S5-T09, S6-T07 |
| #15 (Amaran Awal) | S6-T04 |
| #16, #17 (fixed-date seeds, mock folders) | S6-T09, S6-T03, S0-T09 and each sector |
| #18 (m18 officers PPD/JPN) | allow-list (S0-T04), out of scope |
| #19 and 4.11 #13 (`/api/config/support` 404) | S5-T05 |
| #20 (Command Center Remedial/Evaluate/Badges) | S6-T07 |
| 10-murid 4.11 #1-#6 (lower-form, T4/T5 gates) | S5-T01, S4-T06 |
| 4.11 #8, #14 (`STUDENT_HIDDEN_IDS`, 403 routes) | S0-T05, S0-T06, S10-T01..T03 |
| 4.11 #9-#11 (lock/defensive states) | accepted by the PRD; they are allow-list entries of 40 AC-X2-3 (S0-T04 reads them; this table does not restate the list) |

**D. Audit fixes (docs/qa/r1-dev-readiness-audit.md) and where they land.** A row is a requirement of the PRD that a card now carries; no row creates a second implementation.

| Finding | Decision | Card(s) | Data / API |
|---|---|---|---|
| F-01 accepted batch to paper | D-A2 | S1-T10 (BE), S2-T02 (tab and link), S3-T02 (publish) | DM-45, API-Q-25 |
| F-02 one answer store | D-A1 | S5-T15 (store and port); writers S3-T04, S3-T05, S3-T06, S3-T07, S5-T11, S7-T01; readers S10-T01..T04, S6-T03 | DM-44, XS-8 |
| F-03 one Headcount computation | D-A3 | S10-T02 | HC-SPEC (20), DM-49 |
| F-04 no 70% chapter lock | D-A4 | S5-T02 (verified: no lock in plan, API-PRAC-05 or sprint demo) | n/a |
| F-05 Bab in the publish gate, "Soalan tanpa Bab" | D-A5 | S1-T02, S1-T05, S2-T01, S2-T08, S4-T03 | API-Q-05 `NO_CHAPTER`, API-DSKP-10, API-DSKP-09 |
| F-06 TP and difficulty | D-A6 | S1-T02 | DM-47, API-Q-03 |
| F-07 Set Soalan to selected classes | D-A7 | S6-T14, S5-T11 | DM-46, API-GUR-16 |
| F-08 no pupil join by code | D-A8 (follow V2) | S5-T08, S6-T14 | API-MUR-04, API-GUR-04 |
| F-09 Subjektif self-mark | D-A9 | S3-T06, S5-T11 | API-PRAC-10, API-BIJAK-05 |
| F-10 one number, one precision | D-A10 | S10-T01, S10-T03, S6-T03 | XS-1..8, 60 section 4.6 |
| F-12 coin rate | D-A11 | S7-T05 (store), S5-T03 (reads) | DM-48, API-ADM-16 |
| F-13 display name | D-A12 | S7-T06, S5-T08, S5-T05 | 60 section 4.6, API-MUR-03 |
| F-14 ticket semantics | D-A13 | S7-T09, S7-T10 | API-SUP-01..05 (OD-4) |
| F-17 `PUT /me` scope hole | D-A15 | S5-T05 | API-AUTH-09 |
| F-11 Simpan Sasaran | n/a | S10-T02 | DM-49, API-RPT-16 |
| F-16 plan cards that drifted | n/a | S1-T02 (no `/completeness`), S1-T05 (CSV), S5-T02 | 50 "Corrections" 9-11 |
| F-18 chain tests | D-A16 | S9-T06 | AC-CHAIN-1..10 |
| F-20 password and quota | D-A17 | S6-T12 (password 8), S6-T09 (quota, whole-file refusal) | API-ADM-01, API-AS-06 |

**Common blocks (referenced by every card).**

**E. ID splits for PRD modules that stand on the `PRD:` line of several cards (round 4, rule (e) of section 0B).** One ID, one owner: an ID in this table belongs to the card named for it; an ID of the module that is not named here belongs to the card marked "rest". "Layered" means a backend card and a screen card: the ID has ONE owner (the card marked owner) and the other card proves its own layer and writes its UAT ledger row under the owner's card ID.

| Module | Owner card and IDs |
|---|---|
| R1-ADM-QE-03 | S1-T02: FR-ADM-QE3.4, AC-ADM-QE3.3. S1-T09a: FR-ADM-QE3.2, 3.3, 3.19, 3.20, AC-ADM-QE3.2, 3.4, 3.11. S1-T09b: FR-ADM-QE3.10, 3.11, 3.13, AC-ADM-QE3.5, 3.6, 3.8. S1-T03: FR-ADM-QE3.6. S1-T07: FR-ADM-QE3.22, AC-ADM-QE3.14. S1-T01: AC-ADM-QE3.13. S2-T01: FR-ADM-QE3.1, 3.5, 3.7, 3.14, 3.21, AC-ADM-QE3.1. S2-T10 (rest): FR-ADM-QE3.8, 3.9, 3.12, 3.15, 3.16, 3.17, 3.18, 3.23, 3.24, 3.25, AC-ADM-QE3.7, 3.9, 3.10, 3.12, 3.15, 3.16, 3.17, 3.18 |
| R1-ADM-Q-04 | S2-T01 owns every ID. S2-T10 builds the leaf forms of the step `Sub-bahagian` that FR-ADM-Q04.1 refers to and owns no Q-04 ID |
| R1-ADM-Q-23 | S2-T06: FR-ADM-Q23.1, FR-ADM-Q23.3. S2-T10: FR-ADM-Q23.2, FR-ADM-Q23.4, AC-ADM-Q23.1, AC-ADM-Q23.2. S1-T09a: FR-ADM-Q23.5 |
| R1-ADM-Q-07 | S0-T03: FR-ADM-Q07.5. S1-T04: FR-ADM-Q07.2, AC-ADM-Q07.1. S1-T10: FR-ADM-Q07.6, AC-ADM-Q07.3, AC-ADM-Q07.4. S3-T02: FR-ADM-Q07.7, FR-ADM-Q07.8, AC-ADM-Q07.5, AC-ADM-Q07.6. S2-T02 (rest, including FR-ADM-Q07.1 and the header buttons of the Import and Semakan page) |
| R1-ADM-QE-01, QE-02, QE-04, Q-05, Q-06, Q-09, Q-12 | Layered. The owner of every FR is the S1 card (S1-T01 for QE-01, QE-02, Q-05; S1-T02 for QE-04 and Q-06; S1-T03 for Q-09; S1-T08 for the backend of Q-12); the S2 card (S2-T01, S2-T02) proves the ACs on screen and writes the UAT rows. FR-QA-08 and AC-QA-08 (Gabungkan kumpulan) are S2-T02's alone |
| R1-MUR-13 | S3-T07: FR-MUR-13-1, 13-20, 13-34, AC-MUR-13-9, 13-10, 13-26, 13-29. S3-T06: FR-MUR-13-29, 13-30, the Kertas Subjektif half of FR-MUR-13-19 and AC-MUR-13-24. S5-T11: the Soalan Berstruktur half (kind `structured`) of FR-MUR-13-19 and AC-MUR-13-24. S5-T15: FR-MUR-13-35. S3-T04 (rest): every other FR and AC, including AC-MUR-13-25, 13-27, 13-28, 13-31, 13-32 |
| R1-MUR-17 | S5-T11 owns every ID. S3-T06 proves the Kertas Subjektif side of the shared ACs on its screens (layered) |
| R1-MUR-16 | S5-T01: FR-MUR-16-13, AC-MUR-16-9. S5-T03 (rest) |
| 46 AC-PA-02 | S5-T03 (Latih Tubi), S5-T02 (Chapter), S3-T07 (Databank) |
| 46 AC-PA-36 | S5-T01 (Latih Tubi, Chapter, Topik, Peta Belajar pages), S3-T07 (Databank and the Bijak list with `level_scope`), S5-T11 (Set Soalan) |
| FR-QA and AC-QA IDs on several cards (FR-QA-17 to 30 and 46) | Layered: validation and storage S1-T09a or S1-T09b, authoring form S2-T10, pupil widget S8-T03. Exception: the sanitiser allow-list and the rich-text toolbar (FR-QA-18, AC-QA-18) belong to S8-T03 alone (`RichText.vue`); S2-T10 only places the toolbar buttons |

**V-STD (verification, all cards unless the card says otherwise).**
1. Before merge (developer): unit/integration tests and CI (`typecheck`, `lint`, `npm test`, `be:verify`) locally and in CI. The local stack and the demo/e2e seed are for these automated tests only; they are not acceptance evidence (D110).
2. After the change is deployed to UAT (`uat.prestasiplus.cloud`, a clone of V2 production data): run the card's ACs in a **visible (headed) browser** (Playwright MCP or manual; never headless) at **375, 768 and 1280 px**, logged in as the role(s) named on the card; check `document.documentElement.scrollWidth <= window.innerWidth` (AC-X6-1); save screenshots to `.evidence/<task-id>/<width>-<screen>.png` (gitignored; UAT holds real pupil data, so they are never committed and issues/PRs carry only pass/fail and IDs, never names).
3. **V2 comparison.** The Delivery Lead compares with V2 at verification; a card team never opens V2 and lists deviations from the PRD text in its PR.
4. **Data:** step 2 already runs on UAT data; if a data operation (U-OP-nn, §7) the card depends on is not yet done on UAT, say so in the issue and re-run the AC after that step.
5. No text from the placeholder list (§8, AC-X2-3) on any screen touched.

**DoD-T (task Definition of Done).** (a) every AC on the card passes with evidence; (b) `npm run typecheck`, `npm run lint`, `npm test`, and for BE `npm run be:verify` green (real output pasted); (c) tests added as listed; (d) every AC is tagged `[CI]`, `[UAT]` or `[CI+UAT]`, and `[CI]` ACs are proven by named automated tests; the V-STD result on UAT is recorded as pass/fail and AC IDs in the ledger and the PR (screenshots stay in the gitignored `.evidence/`; no names; D110); (e) no new placeholder string, no new mock path in the http build; (f) PRD/doc updated if behaviour diverges; (f2) **FR-X1-5:** no rewrite of working code; only the gaps listed on the card changed, existing files reused (listed in the PR), and any replacement of a working screen, component or API has the Delivery Lead's written approval in the issue; (f3) the issue carries the Gap check section, the PR names exactly one card and lists its DM/API IDs, and `scripts/r1-scope-guard.mjs` has no FAIL (§0B); (g) PR reviewed by the author's team lead; the team holding any other sector touched approved (label `needs:S<n>`); the product owner merged; (h) after the designated UAT developer's deploy, the `[UAT]` ACs have Pass rows in the ledger; the team lead set `status:done`.

**Sizes** (ideal focused days for one developer): S = 1, M = 3, L = 6. Anything >6 must be split before it is claimed.

Priority: P0 blocks 1.0; P1 important; P2 polish. Delivery: A unless stated.

### 4.S0 Platform and shared registries

**S0-T01 Governance setup** · P0 · S · Type: Ops · deps: none · owner: Delivery Lead (not a dev task)
- Starts from (existing): `.github/pull_request_template.md`.
- PRD: NFR-5 (privacy: no real name in repo, `.evidence/` stays gitignored); plan §6. Do: install the PR template (App. B), the issue template (App. A) and CODEOWNERS (App. C: every path to the product owner, who reviews as owner of record and merges); create the labels (`r1`, `sector:S0..S10`, `type:*`, `prio:*`, `status:*`, `r1-delivery:*`, `needs:S0..S10`) and the milestones `R1 Sprint 0..N`; check that `node scripts/r1-lock.mjs --help` prints the cheat-sheet teams use to hold a sector and claim a card (R1-START-HERE, decision 1); create the issues for all cards with `scripts/r1-create-issues.mjs` (the plan is approved, D111).
- Data/API: none
- Files: `.github/CODEOWNERS`, `.github/pull_request_template.md` (replaces the old BE-card template), `.github/ISSUE_TEMPLATE/r1-card.yml`, `scripts/gh-labels.sh` (exists; extend), `scripts/r1-create-issues.mjs`, `scripts/r1-lock.mjs`.
- Tests: none. Verify: open a test PR whose body has the line `Cross-sector: S<n> (reason)` and the label `needs:S<n>`; the scope guard accepts the files of sector S<n>.
- DoD: DoD-T (a), (g), (h) only.

**S0-T02 Stack boots with no manual step** · P0 · M · Type: Fix · deps: none
- Starts from (existing): `apps/api/prisma/seed/e2e.ts`, `compose.http.yaml`.
- PRD: FR-X5-2. Gap: e2e seed fails `blueprint 3472/2 does not pass the Sahkan checks (NO_QUOTA, NO_KBAT)` and the API does not start by itself (gap §6, `docs/ops/e2e-seed.md`).
- Data/API: DM-21; API-AUTH-17
- Also uses: DM-39 (owned by another card; read or verified here, not an ownership claim)
- Approach: reproduce on a clean clone; fix the e2e fixture so the verified blueprint has quota and KBAT (S3 reviews the blueprint file edit) or make the seed use the Disahkan fixture path; make `compose.http.yaml` wait for migrate+seed; document one command. Add a CI job `stack-smoke` that runs `npm run stack:up` and logs in as 5 roles.
- Files: `apps/api/prisma/seed/e2e.ts`, `e2e-k2.ts`, `e2e-trial.ts` (S3-owned, one-off edit with S3 review), `exam-launch-blueprints.ts`, `compose.yaml`, `compose.http.yaml`, `.github/workflows/frontend.yml`, `docs/ops/e2e-seed.md`.
- API/contract/migration: none.
- Tests: CI `stack-smoke`. Verify: fresh clone, `npm ci`, `npm run stack:up`, open 5193, log in as admin/guru/admin-sekolah/murid T4/murid T1.
- DoD: DoD-T + a second session (another developer, or a cloud agent session with Docker) reproduces it on a clean clone and pastes the command output in the PR; a cloud session without Docker marks this DoD item "awaiting CI" and CI `stack-smoke` is the proof.

**S0-T03 Jobs worker and OCR configured** · P0 · M · Type: Build · deps: none
- Starts from (existing): `apps/api/src/modules/jobs/jobs.worker.ts`, `apps/api/src/common/health/ready.controller.ts` (the existing `GET /api/ready`, API-AUTH-17: it gains one additive field `worker`, one of `ok`, `down` or `disabled`; no new route).
- New files: `apps/api/src/modules/ocr/tesseract.engine.ts` (the Tesseract engine beside `ocr-engine.ts` and `pdfjs.engine.ts`; it uses the package `tesseract.js` 7.0.0 that `package.json` and `apps/api/package.json` already list, so no new dependency), `apps/api/src/modules/jobs/jobs.health.ts` (the worker-alive check read by `ready.controller.ts`).
- PRD: Q-07 FR-ADM-Q07.5, QE-05 FR-ADM-QE5.7, Q-18 FR-ADM-Q18.5; gap F2. D112(2): extraction is REAL OCR, in-house (Tesseract worker, `OCR_ENGINE=tesseract`); there is NO external AI provider in R1 (ALESA/AI stays hidden, D73/D102; pupil data stays private); extraction is rule-based and an admin always reviews before anything publishes; a mock OCR exists only in CI tests and is never configured on UAT. Gap: extraction stuck at "Sedang diproses" because `JOBS_WORKER_ENABLED=false`, `OCR_ENGINE=none` (`apps/api/src/common/config/env.schema.ts:169,175`; `jobs/jobs.worker.ts`, `intake/files/intake-processing.service.ts`).
- Data/API: none
- Also uses: API-AUTH-17 (owned by S0-T02; read or verified here, not an ownership claim; this card adds only the `worker` field)
- Worker field (D113-continued): `jobs.health.ts` exports `getWorkerHealth()`: `disabled` when `JOBS_WORKER_ENABLED` is false; otherwise `ok` when `lastTickAt` is at most 60 s old, else `down`. The jobs worker loop stamps `lastTickAt` (a module variable in `jobs/jobs.health.ts`, no table) on every tick (the same rule as 60 API-AUTH-17: it ticks at least every 15 s even when no job is queued); `down` also when the worker never ticked since start. `ready.controller.ts` adds `worker` beside its existing fields; the field is informational only and the HTTP status does NOT change because of it.
- Language data (D113-continued): the API image never downloads language data at run time (`tesseract.js` runs with `langPath = OCR_LANG_DIR`, no CDN). The API `Dockerfile` gets one build stage that fetches `msa.traineddata` and `eng.traineddata` from the pinned `tessdata_fast` 4.1.0 release of the Tesseract project, checks the SHA-256 written in the Dockerfile (the developer computes the two values once from the downloaded pinned files and writes them as the build arguments `TESSDATA_MSA_SHA256` and `TESSDATA_ENG_SHA256`; the build fails on a mismatch) and copies them to `/opt/tessdata`; compose and the UAT env template set `OCR_ENGINE=tesseract` and `OCR_LANG_DIR=/opt/tessdata`. No data file is committed to the repo. CI builds the same image; `docs/ops/api-runbook.md` documents it.
- CI proof: the e2e uses a text-layer fixture PDF (needs no OCR) and a unit test of `tesseract.engine.ts` with a stubbed recogniser; real Tesseract runs on UAT only, after U-OP-02.
- Approach: enable worker and `OCR_ENGINE=tesseract` (+ the traineddata folder above) in compose and in the UAT env template; health endpoint reports worker state; document UAT enablement as U-OP-02 (OPS, user approval, §7). The in-service timeout/error state is S1-T04.
- Files: `compose*.yaml`, API `Dockerfile`, `docs/ops/api-runbook.md`, `apps/api/src/common/config/env.schema.ts`, `apps/api/src/common/health/ready.controller.ts`, `apps/api/src/modules/jobs/**`, `apps/api/src/modules/ocr/**`.
- Tests: jobs worker unit test; e2e: upload a small PDF, batch leaves "Sedang diproses".
- Verify: V-STD steps 1, 2 on `/admin/spm/soalan/muat-naik`.
- DoD: DoD-T.

**S0-T04 Repo checks in CI: placeholder strings and R1 traceability** · P0 · S · Type: Build · deps: none
- Starts from (existing): `scripts/lint.mjs`, `scripts/r1-trace-check.mjs`, `scripts/r1-scope-guard.mjs`, `.github/workflows/` (the placeholder check is new and is added beside these files).
- New files: `scripts/check-placeholders.mjs`, `scripts/placeholder-allowlist.json`. No new workflow file: `.github/workflows/r1-scope-guard.yml` (workflow `r1-scope-guard`, job `scope-guard`, which also runs the canonical-map check) and `.github/workflows/r1-docs.yml` (the trace check) already exist; this card extends them and sets them as required checks, so until this card merges every team runs the scripts locally (R1-START-HERE step 6).
- PRD: AC-X2-3, FR-X2-0, FR-ADM-H0.2 (the no-placeholder rule of 30). **Also owns the traceability gate:** add `node scripts/r1-trace-check.mjs` (exists; the lead owns its logic, S0 only wires it) as a required CI step in `.github/workflows/frontend.yml`. It regenerates `docs/plan/r1-traceability.md` and fails unless it exits 0 (`uncovered: 0 | dangling: 0`, no unknown id, no DM/API ownership defect) (a PRD module without a card, or a card citing an unknown PRD ID). Approach for the placeholder check: `scripts/check-placeholders.mjs` fails the build if module code (`src/modules/**` and `src/shells/**`, excluding tests and the allow-list) contains any banned string of the ONE list written in 40 AC-X2-3 (master). This card, R1-START-HERE, the FAQ answer on placeholders, 10 section 4.11 and the register table C cite that list and never restate or extend it; the script reads the strings from the list as written in 40 AC-X2-3 and its self-test fails when the script and that list differ. The banned-string rule (D113-continued, L-13) is about placeholder PAGES and notices; a real admin function whose label contains a banned word is not a placeholder. Allow-list `scripts/placeholder-allowlist.json`: every entry names the exact string, the path glob where it is allowed and the PRD exception; its starting entries are exactly the allow-list of 40 AC-X2-3 (the admin `Pratonton` labels and title under `src/modules/m04-question-bank/**` and `src/modules/m28-bijak-spm/admin/**`, register 6.2b row 18 officers PPD/JPN, and the defensive pupil states of 10 section 4.11 #9-#11, each with its PRD row). Anywhere else a banned string fails the check. A further real admin function is added by a one-line PR to `scripts/placeholder-allowlist.json` naming the FR and the path glob, together with the same line in the 40 AC-X2-3 allow-list. Wire into `npm run lint` (`package.json` runs `node scripts/lint.mjs`, which calls `scripts/check-placeholders.mjs` as its last step). Mode switch: the script reads `PLACEHOLDER_CHECK_MODE` (`report` or `fail`, default `fail`); `.github/workflows/frontend.yml` sets `report` until the end of Sprint 3 (the strings are removed by the cards of Sprints 1 to 3) and S0 changes that one line to `fail` in the first PR of Sprint 4 (plan 5A Sprint 4 exit). **Also wires the scope guard (§0B, guardrail 5):** make the existing job `scope-guard` of `.github/workflows/r1-scope-guard.yml` a REQUIRED status check (it checks out with `fetch-depth: 0` and runs `node scripts/r1-scope-guard.mjs --base origin/<target branch> --head HEAD` with `env: PR_BODY: ${{ github.event.pull_request.body }}`); exit code 1 (FAIL) blocks the merge, 2 (setup error, e.g. no card ID in the PR body) also blocks, warnings are printed in the job summary. The script exists (`--self-test` runs its fixtures); S0 wires it and does not change its rules without the Delivery Lead. Making a job a required check is a branch-protection setting that only the product owner (repository admin) can change: this card's PR body lists the check names (`scope-guard` and `r1-docs`) and the card is Done when the product owner confirms in the PR that both are required. The trace check already runs in `r1-docs.yml`; `frontend.yml` gets the step only if `r1-docs.yml` does not run on every PR (one run per PR, never twice).
- Data/API: none
- Files: `scripts/check-placeholders.mjs`, `scripts/placeholder-allowlist.json`, `scripts/lint.mjs`, `.github/workflows/frontend.yml`, `.github/workflows/r1-scope-guard.yml`, `.github/workflows/r1-docs.yml`.
- Tests: script self-test with a fixture (it asserts that `Pratonton kumpulan` passes in `m04-question-bank` and that `Pratonton` as a page title in `src/modules/m05-practice` fails). In `report` mode the script prints the ~20 known strings and exits 0, so the card is green; the self-test fixture is the only red case. CI uses "report" until the end of Sprint 3 and "fail" from Sprint 4 (mode switch above).
- Verify: introduce the string in a throwaway branch; CI fails. Open a throwaway PR whose body names a Verify card and adds a Vue page: the `r1-scope-guard` workflow (job `scope-guard`) fails.
- DoD: DoD-T.

**S0-T05 Retire prototype scope** · P0 · M · Type: Fix · deps: S0-T04
- Starts from (existing): `src/app/prototype-scope.ts`.
- PRD: FR-X2-0/1/2; register 6.2b row 3 (`src/app/prototype-scope.ts:28-30,56-59`, `src/app/LayoutHost.vue:51,54`); OQ-MUR-5 copy.
- Data/API: none
- Approach: replace the "Belum tersedia dalam prototaip" page and the "Known gaps" note with the standard not-available page (copy per OQ-MUR-5, decided: the standard 404 page, D108(6); nothing awaits approval); add `// [S<n> begin/end]` markers per sector in the scope lists; one scope flag per Delivery B module; a hidden module is unreachable by URL (FR-X2-2) and answers **404** with the standard not-available page (D108(7)), never 403; unhide, in this task, everything already built for a 1.0 row (Headcount, Analisa Item, Laporan Soalan, Import Pelajar items hidden by `STUDENT_HIDDEN_IDS` at `src/shells/nav/user-nav.ts:749`) so sectors only fix their own screens.
- Files: `src/app/prototype-scope.ts`, `src/app/LayoutHost.vue`, `src/app/router/guards.ts`, `src/shells/nav/user-nav.ts`, `src/app/features.ts`.
- Note (OQ-G-15, closed): the `GURU_TOOLS` entry in `src/shells/nav/out-of-scope.ts` (routes `/guru/soalan-guru`, `/guru/databank`, `/guru/kertas-peperiksaan`, and the Gambar Rajah and Soalan Berstruktur tool routes) stays until S6-T16..T20 land; each of those cards then removes its own routes from `GURU_TOOLS` (delete-only, §3). S0 keeps the nav items.
- Tests: router guard unit tests for hidden/visible module; update `src/app/__tests__`.
- Verify: V-STD; type a hidden URL as pupil: standard page; each 1.0 sidebar item opens (even if the screen is still fixed later, no scope page).
- DoD: DoD-T + AC-X2-3 check passes for `src/app/**`.

**S0-T06 Nav integrity and sidebar walk** · P0 · M · Type: Fix · deps: S0-T05
- Starts from (existing): `src/shells/nav/user-nav.ts`.
- New files: `e2e/r1/sidebar-walk.http.spec.ts`.
- PRD: AC-X2-1/2, FR-X2-3; 20 FR-SH, AC-SH-*; register rows 2, 8, 13. Gap: `user-nav.ts:284` Analitik Adaptif → `/analitik/pelajar` (should be `/analitik/kelas` for GUR-5/AS-5; `:398` for AS); `:287` Laporan Mingguan → `/laporan-mingguan` (403; should be `/guru/laporan-mingguan-kelas`); `:385` `sa-import-pelajar` hidden; Murid Prestasi → school dashboard; `/admin/monitoring` item points to `/guru/monitoring`.
- Data/API: API-AUTH-03, API-AUTH-15
- Approach: one PR fixing every 1.0 target for Murid, Guru, Admin Sekolah in the order given by each PRD part; new e2e `e2e/r1/sidebar-walk.http.spec.ts`: logs in as each role, opens each sidebar item, asserts title, no 403/404/"Akses Ditolak", no redirect to another role's screen, no placeholder string (AC-X2-1/2). Items whose screens are not yet built are listed as `expected-red` with the owning task ID so the spec doubles as a progress meter.
- Files: `src/shells/nav/user-nav.ts`, `src/shells/__tests__/**`, `e2e/r1/sidebar-walk.http.spec.ts`.
- Note (OQ-G-15, closed): the sidebar walk lists the Alat Soalan tool items as `expected-red` with their owning card (S6-T16..T20) until they land. The `GURU_TOOLS` entry in `src/shells/nav/out-of-scope.ts` (routes `/guru/soalan-guru`, `/guru/databank`, `/guru/kertas-peperiksaan`, and the Gambar Rajah and Soalan Berstruktur tool routes) stays until S6-T16..T20 land; each of those cards then removes its own routes from `GURU_TOOLS` (delete-only, §3). S0 keeps the nav items.
- Tests: the walk spec; `user-nav` unit tests per role.
- Verify: V-STD in headed mode for the three roles at 375 (drawer) and 1280.
- DoD: DoD-T; spec is green for every row whose owning task is Done.

**S0-T07 Target admin menu** · P0 · M · Type: Fix · deps: S2-T03 (the menu is FINAL, D107: no approval wait)
- Starts from (existing): `src/shells/pentadbiran/menu.ts`.
- PRD: 30 §3.1–3.4. Approach: implement the target groups and the exact "Soalan" group (SPM, Bank Soalan (Studio), Import & Semakan, Set Builder, Sumber Kertas, Kertas Subjektif, Audit Rajah, then the sub-group Bank Lama (Legasi) with Senarai Soalan and Soalan Berstruktur: nine entries, the order of 30 §3.2); HIDE/MERGE/REMOVE the mapped IDs; V2 paths stay as alias redirects (the redirects themselves are S2-T03).
- Data/API: none
- New requirements (45, 46, 48; D113): FR-QA-15; AC-QA-15.
- Files: `src/shells/pentadbiran/menu.ts`, `src/shells/__tests__/**`.
- Tests: menu snapshot test (no duplicate "Bank Soalan"; 9 items in Soalan: SPM, Bank Soalan (Studio), Import & Semakan, Set Builder, Sumber Kertas, Kertas Subjektif, Audit Rajah, Senarai Soalan, Soalan Berstruktur). Verify: V-STD against V2 admin sidebar at 1280 and drawer at 375.
- DoD: DoD-T.

**S0-T08 Rate limits and 429 UX** · P1 · S · Type: Fix · deps: none
- Starts from (existing): `compose.http.yaml`, `apps/api/src/common/config/env.schema.ts`.
- PRD: NFR-4. Gap: fast admin navigation hits 429 and shows an empty "Ralat" on Kurikulum/Subjek/Tahap/Set Builder. Approach: tune throttle per route group (admin reads high, auth strict); the FE transport turns 429 into a retry message with `Retry-After`, not "Ralat".
- Data/API: none
- Files: `apps/api/src/common/**` (throttle config), `compose*.yaml` env, `src/api/**`, `src/ds/DsLoadError.vue` (S8 by request).
- Tests: BE throttle test; FE transport unit test. Verify: click 20 admin pages at ~2 s each in the visible browser: no 429.
- DoD: DoD-T.

**S0-T09 Mock-path audit** · P1 · S · Type: Build · deps: S0-T04
- Starts from (existing): `scripts/check-demo-bundle.mjs` (nothing exists for the new part; it is added beside these files).
- New files: `scripts/check-http-build.mjs` (and its self-test `scripts/check-http-build.test.mjs`).
- PRD: FR-X2-0 (no mock data), register 6.2b row 17. Approach: `scripts/check-http-build.mjs` builds with `VITE_API_MODE=http` and fails if a matrix route's chunk imports a `*/mock/**` module (data), reporting module by module. Output goes to each sector's checklist; sectors delete their mock paths as part of their cards.
- Data/API: none
- Files: `scripts/check-http-build.mjs`, `scripts/check-demo-bundle.mjs`. Tests: script self-test. DoD: DoD-T.

**S0-T10 Kawalan Ciri (minimum)** · P1 · M · Type: Build · deps: S0-T07
- Starts from (existing): `src/app/features.ts` (nothing exists for the new part; it is added beside these files).
- New files: `apps/api/prisma/schema/feature-flags.prisma`, `apps/api/prisma/migrations/0250_s0_feature_flags/migration.sql`, `packages/contract/src/common/feature-flags.ts`, `apps/api/src/common/feature-flags/{feature-flags.module.ts,feature-flags.controller.ts,feature-flags.service.ts}`, `src/modules/m17-admin-dashboard/pages/FeatureTogglesPage.vue` (route `/admin/feature-toggles` added in the existing `m17-admin-dashboard/routes.ts`).
- PRD: R1-ADM-N-06 (`/admin/feature-toggles`), NFR-6; gap §5.5 (none in V3). Approach: a `feature_flags` table + admin list/toggle of the ~25 V2 toggles that exist in V3 (rest not shown), read by the FE `features.ts`; Cikgu Alesa and Keluarga Angkat locked OFF (D102).
- Data/API: DM-34; API-ADM-09, API-AUTH-16, API-GAME-10, API-GUR-23
- Files: new `SCH/feature-flags.prisma` (S0-owned, not `base.prisma`; DM-34), migration `0250_s0_feature_flags` (table + seed rows), new `CT/common/feature-flags.ts` (S6 owns `CT/admin`, so the contract does not go there), `BE/common` or new `BE/feature-flags/`, `src/app/features.ts`, a page under `src/modules/m17-admin-dashboard/pages/` (S6 reviews).
- Tests: BE service+controller; FE toggle page. Verify: V-STD vs V2 admin "Kawalan Ciri" at 375/768/1280; toggle a Delivery B module; the pupil sees it appear/disappear.
- DoD: DoD-T.

**S0-T11 Kawalan Ciri full and go-live switch-over** · P1 · M · Type: Build · deps: S0-T10 · Delivery B
- Starts from (existing): `src/app/features.ts`.
- New files: none (this card extends the files of S0-T10: the same `features.ts`, flag table, admin page and flag seed rows; no new migration).
- PRD: R1-ADM-P2-19 (all ticked modules toggleable), U-OP-11. Extends S0-T10 to every ticked module; Delivery B modules stay hidden (404, FR-X2-2) until their card passes, then the flag turns ON on UAT (U-OP-11). Files: `src/app/features.ts`, `BE/common`/feature-flags, admin page of S0-T10. Tests: toggle spec per module. Verify: V-STD per module against the SRS description of the PRD modules on this card's "PRD:" line (screen layout, exact BM copy and states are written in words there; §0A). DoD: DoD-T + every AC of the listed modules.
- Data/API: none
- Also uses: API-ADM-09, DM-34 (owned by another card; read or verified here, not an ownership claim)

**S0-T12 Error handling: envelope, transport, global states and the ERR catalogue** · P1 · L · Type: Complete · deps: none
- Starts from (existing): `apps/api/src/common/errors/all-exceptions.filter.ts`, `src/api/errors.ts`, `src/api/client.ts`.
- New files: `e2e/r1/errors.http.spec.ts`.
- PRD: 40 section X10 (FR-ERR-1..27, AC-ERR-1..12, the ERR catalogue X10.11 and the code changes X10.12). Gap: the API filter answers with Laravel-style English defaults and turns an unmapped 4xx into 5xx; the frontend `ApiError` has no `requestId`; no return-URL on 401, no global offline banner, no single timeout and retry policy, no double-submit lock.
- Data/API: none
- Approach: (1) envelope `{error: {code, message, fields?, details?, retryAfter?, requestId}}` with BM default messages, an unmapped 4xx kept as 4xx, and the codes `BAD_REQUEST`, `PAYLOAD_TOO_LARGE`, `UNSUPPORTED_MEDIA_TYPE`, `SERVICE_UNAVAILABLE`, `TIMEOUT`, `BAD_GATEWAY` added to the contract (X10.12 E-1, `CT/common`); (2) frontend core in `src/api/**` (E-2, E-3, E-8): `ApiError` gets `requestId` and `details`, 401 keeps the edited path and the draft (`/login?kembali=`, the banner "Sesi anda telah tamat. Sila log masuk semula.", the restore notice), a global offline banner, one client timeout and retry policy (a GET that fails with 503 is retried twice, a POST never), a double-submit lock, the toast rules, first-error focus, `Rujukan: {requestId}` with `Salin` on every 5xx; (3) error pages, the maintenance page and the chunk-load dialog use the copy of X10.3.8 (E-5, `DsErrorPage.vue`, `DsLoadError.vue`). The other X10.12 changes belong to the cards of the sector named there (E-4 and E-6 Bijak S3, E-7 and E-12 S7, E-9 S1 and S3, E-10 S1-T04, E-11 S6-T09, E-13 S2-T03). Every row of X10.11 is asserted by the card that owns the screen (AC-ERR-9); this card builds the five cross-cutting specs (AC-ERR-2..6) and the CI list of ERR ids that have no assertion.
- Files: `apps/api/src/common/errors/**`, `apps/api/src/common/http/**`, `CT/common`, `src/api/{client.ts,errors.ts,envelope.ts,http-transport.ts}`, `src/ds/{DsErrorPage,DsLoadError}.vue` (S8 by request), new `e2e/r1/errors.http.spec.ts`.
- Tests: filter unit tests per status; transport unit tests (401 return URL, offline banner, retry policy, double submit); the five cross-cutting specs. Verify: V-STD at 375 (no layout shift when the offline banner shows). DoD: DoD-T + AC-ERR-1..12 for the cross-cutting parts.

### 4.S1 Question model and pipeline (backend)

*Principle for every S1 card:* the first step is a **characterisation test** that fails on the current behaviour named in the card (so the fix is proven, not assumed). The gap file says "root cause (file:line)"; confirm it in the first hour and note differences in the issue.

**S1-T01 Stimulus group invariants end to end** · P0 · L · Type: Complete · deps: none
- Starts from (existing): `apps/api/src/modules/questions/stimuli.service.ts`, `apps/api/src/modules/questions/group-members.ts`, `apps/api/src/modules/questions/stimuli.repository.ts`, `apps/api/src/modules/questions/projection.ts`, `apps/api/src/modules/questions/questions.service.ts`.
- PRD: FR-X1-4a/b/d, R1-ADM-QE-01, R1-ADM-QE-02, R1-ADM-Q-05 (AC-ADM-QE3.13 is also this card's, table 4.0 E). A group holds **1..n** questions, also inside a paper; a one-member group is valid, a zero-member group is blocked (D108(1), FR-ADM-QE2.4). Gap: V1/V2 treat a figure as a question; V3 has `stimuli.service.ts`/`group-members.ts` but UAT shows figure-only and figure-less questions (30 §4.G.7).
- Data/API: DM-01, DM-02, DM-03, DM-06, DM-51, DM-52, DM-70; API-FILE-01, API-Q-03, API-Q-07, API-Q-08, API-Q-04, API-Q-31, API-Q-32, API-Q-33, API-Q-34, API-Q-35
- Also uses: DM-04 (owned by another card; read or verified here, not an ownership claim)
- New requirements (45, 46, 48; D113): FR-QA-02..07, 50, 51; AC-QA-02..07, 50, 51 (API side; the buttons are S2-T01; FR-QA-08 is S2-T02's).
- API-Q-03 (the question save route) is owned here; S1-T02, S1-T09a and S1-T09b change it only in the files named on their cards and list API-Q-03 under Also uses.
- Approach: group entity = 1–3 stimuli + ordered members 1..n (0–40 members; 0 members is a draft only and is never published, placed in a paper or served); stimulus carries no marks and is never counted as a question (QE1.5); API to create a group, add/remove/reorder members, attach the stimulus once; projection returns group + members as one unit; counts exclude stimuli. **Group scope (D113-continued, L-3):** the group row stores its own Subjek, Tingkatan and optional Kertas (DM-51), so an empty group already has them; `POST/PUT /api/stimulus-groups` (API-Q-08) carries `subjectId`, `educationLevelId` and `kertas`, and a member whose Subjek or Tingkatan differs is refused with 422 "Subjek dan Tingkatan ahli mesti sama dengan kumpulan.". **Group review (L-2):** a group moves as one unit: API-Q-04 with `groupId` moves every `Draf` member to `Menunggu Semakan` in one transaction; `POST /api/stimulus-groups/:id/publish` (`Terbitkan kumpulan`) is allowed only when every member is `Menunggu Semakan` or already `Diluluskan` and sets all members `Diluluskan` atomically, otherwise 409 "Semua soalan dalam kumpulan mesti dihantar untuk semakan dahulu."; a single (ungrouped) question keeps `Hantar untuk semakan` and `Terbitkan`. **Bulk call (D113-continued, round 4):** `groupId` and `ids` are never sent together (422); an `ids` list that holds some members of a group but not all of them is refused as a whole with 409 "Ahli kumpulan diluluskan bersama. Pilih semua ahli kumpulan atau gunakan Terbitkan kumpulan." (45 section 4.2) and nothing changes; a list that holds every member of a group moves the group as one unit. **DM-02(b):** the unique stimulus per group is created only when the U-OP-18 report shows 0 stimuli in more than one group (50 OD-13); migration `0120` carries only the FK change. **Canonical map:** the new stimulus-group routes (the last five API-Q rows of 60) are added to `docs/plan/r1-canonical-map.json` by `node scripts/r1-canonical-map.mjs --write` in the same PR (the PR body names the API IDs, which approves them for the scope guard).
- New files: `apps/api/scripts/uat-ops/group-integrity.sql` (the read-only duplicate-stimulus report of U-OP-18 for DM-02; the file is in S4's directory, so S4 reviews it; U-OP-18 is a row of the runbook in plan section 7).
- Files: `BE/questions/{stimuli.service.ts,stimuli.repository.ts,group-members.ts,projection.ts,questions.service.ts,http/**,studio/**}`, `SCH/questions.prisma`, `apps/api/scripts/uat-ops/group-integrity.sql`.
- Contract: `CT/questions` (group read/write shapes, additive). Migrations (four, S1 range, one PR each in number order): `0120_s1_group_fk_restrict` (DM-02: `fk_questions_group_id` set null to restrict; a constraint change, no new column), `0122_s1_archive_reason_regrouped` (DM-06: adds `'regrouped'` to `ck_question_versions_archive_reason`; the regroup work-list of S2-T04 and S4-T04 uses it), `0130_s1_group_draft_copy` (DM-51: the group's own `subject_id`, `education_level_id` and `kertas`, and the draft copy of a published group; DM-52 stimulus citation and option-bank fields) and `0131_s1_stimulus_kinds` (DM-70, the 7 stimulus kinds and `stimuli.style`).
- Tests: unit + integration (`apps/api/test/`) for create/add 2nd and 3rd question without re-upload; a group of 3 returns 3 members, count = 3.
- Verify: V-STD via API then Studio (S2-T01) at 1280; V2 has no group, so compare the pupil result of the same real paper (the deviation is FR-X1-4).
- DoD: DoD-T + AC-ADM-QE1.*, QE2.*, Q05.* through the API layer (the screen layer is S2-T01, which writes the UAT rows), except AC-ADM-QE2.5, FR-ADM-Q05.2 (the "Dilihat murid di" reasons per member; they need DM-05, migration `0121` and API-Q-11, which are S1-T07's) and the IDs that table 4.0 E gives to another card. This card has no dependency on S1-T07 for that reason.

**S1-T02 Itemised completeness and DSKP-aware validation** · P0 · M · Type: Complete · deps: S1-T01
- Starts from (existing): `apps/api/src/modules/questions/publish-gate.ts`, `apps/api/src/modules/questions/dskp-gate.ts`.
- PRD: R1-ADM-QE-04 (all), R1-ADM-QE-03 (only FR-ADM-QE3.4 and AC-ADM-QE3.3, table 4.0 E); the gate function of 45 section 4.1 (its rows are split by card in the "Gate rows by card" line below); 30 §4.G. Aras pemikiran per leaf stays an approval gate wherever DSKP nodes exist for the Subjek + Tingkatan, with a question-level default (D108(2), FR-ADM-QE3.4, FR-ADM-QE4.6; OQ-QE2 closed). Gap: publish returns 422 only at the end (needs SP, thinking level, paper; `publish-gate.ts`, `dskp-gate.ts`); the Studio bar says "5 belum lengkap" without saying what; free-text SP validated late (gap F1/F2).
- Data/API: DM-19, DM-47, DM-56, DM-58; API-Q-02, API-Q-05, API-Q-06
- Also uses: API-Q-03, DM-09 (owned by another card; read or verified here, not an ownership claim)
- New requirements (45, 46, 48; D113): FR-QA-11, 29, 31, 32, 42; AC-QA-11, 29, 31, 32, 42.
- New requirements from the audit (this card owns them): FR-ADM-QE4.5, FR-ADM-QE4.6 (D112(1), D112(3)); ACs AC-ADM-QE4.4, AC-ADM-QE4.5.
- Data chain (D-A5, D-A6): `NO_CHAPTER` blocker and `difficulty_level` (DM-47); the write of `difficulty_level` happens in the same save as TP.
- Approach: reuse `GET /api/questions/:id/gate-check` (API-Q-05), which already returns `issues[{path, code, message, step}]` in BM, and the same list in the `422 fields` of the save routes; **no new `/completeness` route** (D-API-2); the Studio completeness panel renders `issues` instead of ignoring them; validate SP/TP/level/part marks against DSKP when typed; paper optional for non-SPM bank questions as in V2; keep D80/D85 rules. **Publish gate (D-A5, D112(1)(3)):** Bab is REQUIRED before Terbit when the question's Subjek + Tingkatan has chapters (N-3; any older rule that Bab is not required is superseded), and SP, TP and aras are required only when DSKP nodes exist for that Subjek + Tingkatan (the same conditional pattern as Bab, one rule everywhere, D112(1), D112(3): the level of the pupil or whether the paper is SPM-bound does not matter; Kimia, Biologi, Geografi, Perniagaan, Prinsip Perakaunan and Ekonomi stay without those items until S4-T09 loads their DSKP): add the blocker `NO_CHAPTER` "Sila pilih Bab." to `gate-check` `issues[]` (absent for a Subjek + Tingkatan without chapters) and make the unit/SP/TP items conditional on one `curriculum_node` lookup; the wizard label of the DSKP unit is "Tajuk DSKP" (30 section 0 and FR-ADM-QE3.1, never "Unit"), the gate message keeps its exact text "Sila pilih unit DSKP.", and the textbook chapter is "Bab"; "has chapters" means at least one active `chapters` row (DM-16) for the question's Subjek + Tingkatan. **Difficulty (D-A6, D-QA-9, 45 T-12, AC-QA-31):** Kesukaran (`difficultyLevel`, 1 to 5) is ALWAYS required, to send for review and to publish (blocker `NO_DIFFICULTY` "Sila pilih tahap kesukaran."), and is a typed field separate from TP (1 to 6, kept in `difficulty_tp`). The Tag step pre-fills it with `min(5, TP)` until the admin touches it (`difficultyTouched`); a later TP change never overwrites a touched value; the server stores the typed value in `difficulty_level` (DM-47, migration `0128_s1_difficulty_level`, mapping cited in 50 section 4.2.1) and never derives it.
- Gate rows (45 section 4.1): this card builds all 30 rows, the function `gate-check` in `publish-gate.ts`, `GET /api/questions/:id/gate-check` (API-Q-05) and the 422 of API-Q-04 and API-Q-06. Rows 13 to 16 and 19 to 22 call the scheme and mode validators that S1-T09a and S1-T09b write (the scheme validate route); rows 25 and 26 read the flags of S1-T07 (this card adds them as rows that return no item until DM-05 exists). The code is `NO_CHAPTER` (not `chapter_missing`) and `step` is the number 1 to 4, never the word `tag`.
- Rejection (45 section 4.2 step 3, DM-58): API-Q-06 (`POST /api/questions/:id/status`, route in `lifecycle.controller.ts`, edited by this card) accepts `{to: "rejected", reason}` from `Menunggu Semakan` (45 round-4 decision f); `reason` is required, 5 to 500 characters (422 otherwise); it writes `rejection_reason` (DM-58) and the question becomes `Draf` shown with the chip `Ditolak`; a later `to: "review"` clears the reason.
- Difficulty backfill (DM-47, U-OP-19): after migration `0128` the script `apps/api/scripts/uat-ops/difficulty-level-backfill.ts` (dry-run default, batches of 5,000, idempotent) sets `difficulty_level = least(5, difficulty_tp)` where `difficulty_level` is null and `difficulty_tp` is not null and leaves `difficulty_tp` as it is; it is run by the designated UAT developer as U-OP-19 (runbook, plan section 7); until it has run, readers use `least(5, difficulty_tp)` when `difficulty_level` is null.
- New files: `apps/api/scripts/uat-ops/tag-integrity.sql` (DM-19 verification pack), `apps/api/scripts/uat-ops/difficulty-level-backfill.ts`.
- API-Q-03 save path: this card edits only the validators (`publish-gate.ts`, `dskp-gate.ts`, `gate-data.ts`) and the `difficultyLevel` write in the same save; the route itself is S1-T01's.
- Files: `BE/questions/{publish-gate.ts,dskp-gate.ts,gate-data.ts,status.ts}`, `CT/questions`, `CT/servability`; migration `0135_s1_textbook_ref_rejection` (DM-56 `textbook_ref`, DM-58 `rejection_reason`).
- Tests: table-driven gate tests (every missing field named). Verify: V-STD; API response compared with V2 messages where V2 has them.
- DoD: DoD-T + AC-ADM-QE4.* (all), AC-ADM-QE3.3 and the gate rows named above.

**S1-T03 Extraction keeps groups and paper structure** · P0 · L · Type: Complete · deps: S1-T01, S0-T03
- Starts from (existing): `apps/api/src/modules/intake/workflow/figure-links.ts`.
- PRD: R1-ADM-QE-05, FR-X1-4c, R1-ADM-Q-09; FR-ADM-G6.* (30 §4.G.6 upload flow). Gap: V2 links a figure to the first following question and duplicates shared figures; V3 `intake/workflow/figure-links.ts` exists (BE and a FE twin in `m28-bijak-spm/admin/intake/domain/figure-links.ts`); chosen paper at upload is not carried to questions.
- Data/API: DM-07, DM-08, DM-09; API-Q-14, API-Q-15, API-Q-37, API-Q-38
- New requirements (45, 46, 48; D113): FR-QA-12, 35..37, 43; AC-QA-12, 35..37, 43 (FR-QA-08 and AC-QA-08 are S2-T02's: `Gabungkan kumpulan` lives in Semak Ekstrak). FR-ADM-QE3.6 (provenance declared once per upload batch, D99) is this card's.
- Approach: extraction output = groups ("Rajah 3 → soalan 5–8") with members; reviewer edits the range; accept creates one group + members; the upload's subject/level/paper/year carried to every accepted question; a free-text SP is validated on field blur (FR-ADM-QE4.3); the manual `Terima` that rejects it late and leaves the batch at 0 questions is S1-T04's fix, not this card's.
- Files: `BE/intake/workflow/**`, `BE/ai-extraction/**`, `BE/intake/files/**`, `CT/intake`, `apps/api/test/intake-workflow/**`.
- Tests: golden test with a fixture paper (Rajah 3 → Q5–8, Rajah 4 → Q9): 2 groups, 5 members, no duplicate figure, paper carried.
- Verify: V-STD at 1280/768/375 on upload → review (S2-T02), plus one real PDF on UAT (the admin uploads it).
- DoD: DoD-T + AC-ADM-QE5.*, AC-ADM-Q09.* through the API layer (the screen layer is S2-T02); AC-ADM-Q07.* are S2-T02's, S1-T04's and S1-T10's (table 4.0 E).

**S1-T04 Intake timeout, error state, manual Terima** · P0 · S · Type: Fix · deps: S0-T03
- Starts from (existing): `apps/api/src/modules/intake/files/intake-processing.service.ts`, `apps/api/src/modules/intake/workflow/` (the retry routes and the status words).
- PRD: NFR-7, FR-ADM-Q07.2, AC-ADM-Q07.1 (FR-ADM-Q07.5, the worker and OCR runtime, is S0-T03's). Gap: "Sedang diproses" forever; manual "Terima" rejected late then batch shows 0 questions ("Hantar untuk semakan" disabled).
- Data/API: DM-71; API-Q-26
- Also uses: API-Q-14, API-Q-15 (owned by another card; read or verified here, not an ownership claim)
- New requirements (45, 46, 48; D113): FR-QA-38; AC-QA-38.
- Approach: job timeout (90 s per page, 15 min per batch, `OCR_TIMEOUT`) → batch state `gagal` with BM reason and a retry (3 per file, ERR-INT-11, `intake_files.retry_count`), and the partial state `Selesai dengan ralat` (migration `0136_s1_intake_retry_status`, DM-71); manual Terima creates the drafts or tells why. Retry (one path): failed files or pages are retried only through the two retry routes of the retry API (`POST /api/intake/files/:id/retry`, `POST /api/intake/batches/:id/retry`), each counting toward the 3 retries per file (ERR-INT-11); `extract` (API-Q-15) starts the first extraction of a batch and, with `pages[]`, retries chosen pages. The status `selesai_dengan_ralat` ("Selesai dengan ralat") is in API-Q-14 and OPT-BATCH-STATUS. The 90 s and 15 min limits are two constants in `intake-processing.service.ts`, overridable by two settings `OCR_PAGE_TIMEOUT_SECONDS` (default 90) and `OCR_BATCH_TIMEOUT_MINUTES` (default 15), both ending in the error code `OCR_TIMEOUT` (ERR-INT-05); the 15-minute clock starts when the batch enters `Sedang diproses` (45 section 3.3.2 item 6). Retry (the one rule of 45 section 3.3.2 item 6): one failed page is retried through `extract` with `pages[]` (API-Q-15), one failed file through `POST /api/intake/files/:id/retry` and all failed pages of a batch through `POST /api/intake/batches/:id/retry` (the retry API of 60); every one of the three counts toward the 3 retries per file (`intake_files.retry_count`, the same counter whichever route) and the 4th is refused with 409 ERR-INT-11. The stored batch status is `failed` (shown "Gagal"; this plan's word `gagal` means that status); `Cuba lagi` is offered only for `failed` and `selesai_dengan_ralat`, never for a cancelled batch (shown "Dibatalkan"). The manual `Terima` that rejects late is fixed only here. Files: `BE/intake/files/intake-processing.service.ts`, `BE/intake/workflow/**`, `CT/intake`. Tests: timeout unit test; the limits are the same everywhere (90 s per page, 15 min per batch, 3 retries per file; AC-ADM-Q07.1: a test PDF of up to 5 pages reaches "Selesai" within 5 minutes and no batch is still "Sedang diproses" after 15 minutes). Verify: V-STD; kill the worker and watch the error appear. DoD: DoD-T.

**S1-T05 CSV with DSKP and group fields** · P0 · M · Type: Build · deps: S1-T02
- Starts from (existing): `apps/api/src/modules/questions/questions.service.ts`.
- New files: `apps/api/src/modules/questions/import/csv-import.service.ts`, `apps/api/src/modules/questions/import/csv-template.ts`, `apps/api/src/modules/questions/import/sample-template.csv`.
- PRD: QE-06, Q-11. Gap: template has raw ids; no unit/SP/level/paper columns, so CSV questions can never publish (gap F2).
- Data/API: DM-10; API-Q-17
- Also uses: API-GUR-19, DM-07, DM-08 (owned by another card; read or verified here, not an ownership claim)
- New requirements (45, 46, 48; D113): FR-QA-33, 34; AC-QA-33, 34.
- Approach: the CSV header names are exactly the list written once in 30 Q-11 (it wins over any name written here, for example `sp_codes`, `stimulus_image_url`, `stimulus_body_ms`); template adds the human-readable QE6.1 / DM-10 / API-Q-17 columns (subject code, Tingkatan, unit code, `sp_kod` codes separated by `;`, TP, KBAT, kertas, bahagian, number label, `group_key`, `stimulus_text`, `stimulus_image`) **plus `bab_kod`** (Bab code or number; blank allowed for a draft, required to approve, D-A5); unknown codes are reported per row; the old success banner clears on the next upload. Files: `BE/questions/**` import service, `CT/questions`, sample template under `apps/api/src/modules/questions/import/`. Tests: row-level error report; a CSV of one group of 3 yields one group. Verify: V-STD; download the template, fill, upload, publish. DoD: DoD-T + AC-ADM-QE6.*.

**S1-T06 Group-safe assembly** · P0 · M · Type: Complete · deps: S1-T01
- Starts from (existing): `apps/api/src/modules/questions/served-rule.ts`, `apps/api/src/modules/questions/bijak-pool.ts`.
- PRD: R1-ADM-QE-07, FR-X1-4e, FR-MUR-QP-6, FR-MUR-QP-7, D91, D105. Approach: one "unit" abstraction (single question or whole group) used by `exam/builder` draws, Jana set, Latih Tubi, Databank and games; per D105 every drill (Latih Tubi, Databank, Soalan by Chapter) serves figure questions and whole groups, but games serve only standalone text questions: a game draw excludes every group member and every question with a figure (L-12; 46 section 5.1, 48 GAME-00 3.2, servability surface `permainan`); a surface that cannot render one stimulus kind or answer mode excludes that whole group with an admin-visible reason, and its card, details and draw counts agree (D91); never split or reorder members. Rule files: `serving/rules.ts` (the draw-time rule) belongs to this card; `served-rule.ts` and `learner-visibility.ts` (the indicator, one function shared with the draw, 30 FR-ADM-Q06.2) are edited by S1-T07 and only called here. Files: `BE/questions/serving/**`, `BE/questions/served-rule.ts`, `BE/questions/bijak-pool.ts`, call sites in `BE/practice/` and `BE/exam/builder/` (one-line change each, S3/S5 review). Tests: a 1000-draw property test never returns a member without its stimulus. Verify: V-STD on Latih Tubi and Jana set. DoD: DoD-T + AC-ADM-QE7.*.
- Data/API: DM-27
- Also uses: API-BIJAK-10, API-PRAC-01, DM-03, DM-26 (owned by another card; read or verified here, not an ownership claim)

**S1-T07 Servability indicator and stimulus flags** · P0 · M · Type: Complete · deps: S1-T01
- Starts from (existing): `apps/api/src/modules/questions/learner-visibility.ts`, `apps/api/src/modules/questions/served-rule.ts`.
- PRD: R1-ADM-Q-06, FR-X4-2, FR-MUR-QP-4, FR-MUR-QP-5, 30 §4.G.7 (FR-ADM-G7.1–G7.3, AC-ADM-G7.1/G7.3). Gap: UAT "Dilihat murid di 0/6" while Latih Tubi serves; published "Rajah 14 …" questions with no figure and a duplicated stem (id 812791) are served.
- Data/API: DM-04, DM-05, DM-53, DM-59; API-Q-01, API-Q-11, API-Q-12, API-Q-13, API-Q-24, API-Q-36
- Also uses: API-PRAC-04, API-Q-02, DM-42 (owned by another card; read or verified here, not an ownership claim)
- New requirements (45, 46, 48; D113): FR-QA-01, 12, 13, 45; AC-QA-01, 12, 13, 45.
- New requirements from the audit (this card owns them): FR-ADM-Q06.4, FR-ADM-Q05.2 and AC-ADM-QE2.5 (the "Dilihat murid di" reasons per member and `stimulus_missing` on member removal need DM-05; S1-T01 does not claim them), FR-ADM-QE3.22 and AC-ADM-QE3.14 (Kertas 1 to 4, `kertas=5` answers 422 in API-Q-01), AC-MUR-13-19 (a question that says "Rajah 14" with no figure is not served); the flag validators behind gate rows 25 and 26 are written here (the rows themselves are S1-T02's).
- Approach: the indicator is computed by the **same** function that pupil draws use (`served-rule.ts`, `learner-visibility.ts`); detectors `stimulus_missing` (keywords Rajah/Jadual/Graf/Petikan/Peta/Carta, no group/stimulus/image) and `stem_duplicated`; questions flagged `stimulus_missing` or `figure_only` get a servability reason and are excluded from every pupil surface, while `stem_duplicated` is shown once and cleaned by DM-40 (not excluded; OD-3); the flag clears when a group is attached or "Bukan masalah" is set. Reuse `intake/workflow/figure-links.ts` keyword code.
- Files: `BE/questions/{served-rule.ts,learner-visibility.ts,effective-leaf.ts,studio/**}`, `CT/servability`; migrations `0121_s1_servability_flags` (the flag is stored, DM-05, OD-1) and `0132_s1_stimulus_flag_ref` (DM-53, numbered or unnumbered reference kind); the regroup audit payload and its undo are DM-59 and a route in the Data/API line. This card also owns API-Q-01 (list filters `tingkatan`, `chapter`, `unit`, `rejected`, `source`, `q`, flags; `kertas=5` answers 422, the BE part of AC-ADM-QE3.14) and stops writing `spmPool:false` on admin create (`questions.service.ts:592`) so every approved MCQ of a subject is eligible for the Databank.
- Tests: detector unit tests with real stems; indicator equals draw outcome on 50 sampled questions.
- Verify: V-STD; T4 pupil Latih Tubi Sains never draws id 812791-like questions (on UAT data).
- DoD: DoD-T.

**S1-T08 Kiriman Guru backend** · P0 · M · Type: Build · deps: none (stack)
- Starts from (existing): `apps/api/src/modules/classes/question-sets/question-sets.ports.ts`.
- New files: `apps/api/src/modules/classes/question-sets/guru-paper-intake.adapter.ts` (the real intake port bound in place of `UnavailablePaperIntake`), `apps/api/prisma/migrations/0137_s1_intake_guru_source/migration.sql`.
- PRD: Q-12, GUR-44; register 6.2b row 5. Gap: `POST /api/guru/question-papers` = 503 because `question-sets.ports.ts:46,56` binds `UnavailablePaperIntake` and nothing calls `provideIntake`; admin "Kiriman Guru" says "Fungsi ini belum tersedia dalam demo".
- Data/API: DM-15, DM-72; API-GUR-17
- New requirements (45, 46, 48; D113): FR-QA-39; AC-QA-39.
- New requirements from the audit (this card owns them): FR-ADM-Q12.6.
- Approach: bind the real intake port (D113-continued, L-6: EVERY teacher submission, whether a single MCQ (API-GUR-18, S6-T06), a structured question, a paper upload (API-GUR-17) or a diagram, is an intake item of an `intake_batches` row tagged `source=guru`; this card binds the port that all of them use); the admin sees it in the "Kiriman Guru" tab of Import & Semakan through the existing `GET /api/intake/batches` (filter `source=guru`, API-Q-14) and approves or rejects it with the existing intake review routes (API-Q-15); **no `/api/question-submissions` route is built** (FR-ADM-Q12.2, D-API-5, OQ-API-13); remove demo copy (`m04-question-bank/lib/submissions-unavailable.ts` is S2-T01's change).
- Files: `BE/classes/question-sets/**`, `BE/intake/**`, `CT/intake`, `CT/questions`; migration `0137_s1_intake_guru_source` (DM-72: `intake_batches.source`, nullable `kertas` and `year`, the `paper_type` union and its legacy mapping).
- Tests: teacher uploads a PDF → admin sees a batch. Verify: V-STD as Guru (375/768/1280) then as admin. DoD: DoD-T + AC-GUR-44-*.

**S1-T09a Answer-mode kinds and the marking-scheme editor (backend)** · P0 · L · Type: Complete · deps: S1-T01, S1-T07
- Starts from (existing): `apps/api/src/modules/questions/grading.ts`, `apps/api/src/modules/questions/types.ts`.
- PRD: the IDs of table 4.0 E for this card (FR-ADM-QE3.2, 3.3, 3.19, 3.20, AC-ADM-QE3.2, 3.4, 3.11, FR-ADM-Q23.5), nothing else of R1-ADM-QE-03 or R1-ADM-Q-23 (the scheme of Soalan Berstruktur and Subjektif), OQ-MUR-13, `docs/requirements/v2-exam-schema.md`, D41; 45 §2.3, §2.6, §3.1.6, §3.1.7; 46 §2.2. Gap: 8 of 14 widgets and 3 of 15 stimulus types are supported (gap §2.2 row 13); the scheme model has no groups, pairs, caps, bonus, deductions or per-criterion rubric; an MCQ needs 3 options; `true_false`, `mcq_multi`, `essay_choice`, "Pilih N" and `working` are not whole kinds.
- Data/API: DM-54, DM-55, DM-69; API-Q-30
- Also uses: API-Q-03, API-BIJAK-04, API-BIJAK-05 (owned by another card; read or verified here, not an ownership claim)
- New requirements (45, 46, 48; D113): FR-QA-19, 21, 22, 27, 28, 30, 48, 49; AC-QA-19, 21, 22, 27, 28, 30, 48, 49; FR-PA-02, 07, 21, 39; AC-PA-35 (46 section 7: `served-rule.ts` excludes an `mcq_multi` question from Latih Tubi, Chapter, Databank, Tracking A objective, Remedial, Misi, PKSK and games, and a Bijak sitting and Set Soalan Guru serve it).
- Backend of the example leaf and the Kertas range (AC-ADM-QE3.17, QE3.18; the forms are S2-T10): marks 0 is valid only for a leaf with `mode_config.example` (the answer is required: "Jawapan contoh diperlukan."), such a leaf is exempt from the scheme-sum check and `grading.ts` returns no mark row for it, so no caller logs it. This card edits API-Q-03 only in `types.ts`, `grading.ts` and the scheme validation.
- Approach: (1) the 11 question types of OPT-JENIS-SOALAN (40, the master list; FR-ADM-QE3.2 and DM-69 agree) in one `QUESTION_TYPES` constant, in this order: `mcq`, `mcq_multi`, `true_false`, `match`, `short_answer`, `fill_blank`, `structured`, `working`, `essay`, `drawing`, `table_fill`. `short_text` and `numeric` are LEAF MODES (OPT-MOD-JAWAPAN, 9 modes), never question types; the table `questionType` to default leaf mode(s) sits next to OPT-JENIS-SOALAN in 40 (`mcq` to `mcq`; `mcq_multi` to `mcq` multi; `true_false` to `mcq` with 2 options Betul/Salah; `match` to `match_letter`; `short_answer` to `short_text` or `numeric`; `fill_blank` to `short_text`, one leaf per gap; `structured` to any leaf modes per part; `working` to `working`; `essay` to `essay` or `essay_choice`; `drawing` to `drawing`; `table_fill` to `table_fill`). The 14 V2 modes map onto the 11 types by the migration map of 30 QE3.8; `mcq_multi` and `true_false` are question types and never leaf kinds: their leaves use leaf mode `mcq` with `multi: true` (`mcq_multi`) or two fixed options Betul/Salah (`true_false`) ; the answer-key kind `options` carries `choices: string[]` beside `choice`; MCQ has 2 to 8 options (default 4); `mcq_multi` has 2 to 8 options with 1..(n-1) correct, and the key and the reveal use the field `correctOptionIds: Id[]` everywhere (DM-69, API-BIJAK-06 and the reveal; migration `0134_s1_question_types`). (2) Scheme v2 in `answer_keys.content` (`scheme_v: 2`) and `question_versions.scheme_rules` (DM-54), and `question_parts.mode_config` (DM-55, migration `0133_s1_scheme_v2_mode_config`): point kinds K/N/P/B/M/F/C, "@" alternatives, "Maks N", groups with caps and bonus, Ciri/Sebab pairs, paths, count-based marks, deductions and zero rules, bands and word ranges, `essay_choice` with 2 to 6 prompts, `Templat jawapan (pra-isi)`, "Bergantung pada jawapan bahagian" (carried-value points), `Had perkataan`, two accepted options with a note. The field names of the scheme v2 object are those of 45 section 7 (normative; they supersede `docs/requirements/v2-exam-schema.md` D4 wherever the two differ); DM-54, DM-55 and the scheme validate route cite 45 section 7 and use its names, and "best reachable marks with caps" is the algorithm worked in 45 section 7. The matcher kinds of 46 M-WORK (`step`, `all_of`, `final`, `unit`, `keywords`, `manual`) are read through the point fields of 45 section 3.1.7 by the mapping table that 46 M-WORK holds; `grading.ts` implements that table and nothing else. Marks are 1..100; 0 only for an example leaf (45 L-04 wins over 46 section 3.1 "0 or more"). (3) The route `POST /api/questions/:id/parts/:partId/scheme/validate` (the Data/API line) returns `{ok, issues[{path, code, message, step}]}` so the editor shows every problem live. (4) Grading and marking for each kind, the P1 modes `match_letter` and `working`, "Pilih N" (a group is one choice unit); essays and unparseable numbers become `belum_dimarkah`.
- Files: `BE/questions/{grading.ts,types.ts,publish-gate.ts}`, `BE/questions/served-rule.ts` (S1-T07's file, same sector S1: the `mcq_multi` exclusion of AC-PA-35 is added to it here by rule (b); S1-T07 is a dependency for that reason), `SCH/questions.prisma`, `CT/questions`; `packages/exam-core/**` only by a small cross-sector PR to S3 (`Cross-sector: S3 (exam-core Pilih N and kinds)`, `needs:S3`). **"Pilih N" has one owner: this card** owns the rule (a group is one choice unit) in `grading.ts` and `exam-core`; S3-T02 only places the section-rule control of the Set Builder and S1-T10 does not touch it.
- Tests: table-driven grading per kind and per scheme kind, with the worked examples of 45 section 7 as fixtures; scheme validation names every issue with its step; mcq_multi bounds; an old V2 mode maps onto the new kind.
- Verify: V-STD with the S8-T03 widgets and the S2-T10 forms. DoD: DoD-T + the IDs of table 4.0 E for this card.

**S1-T09b Bilingual questions, drawing and table_fill** · P0 · L · Type: Complete · deps: S1-T09a
- Starts from (existing): `apps/api/src/modules/questions/questions.service.ts`, `apps/api/src/modules/questions/grading.ts`.
- PRD: the IDs of table 4.0 E for this card (FR-ADM-QE3.10, 3.11, 3.13, AC-ADM-QE3.5, 3.6, 3.8; the rubric per-criterion rules are added to the `scheme/validate` route of S1-T09a in this card's PR, after S1-T09a has merged), 45 §2.7, §3.1.5, §3.1.6 (modes 8 and 9); 46 §2.2.2, §2.2.3. Gap: there is no English text next to the Malay text (`language` is `bm` or `en`), and `drawing` and `table_fill` cannot be authored, validated, marked or served.
- Data/API: DM-50
- Also uses: API-Q-03, API-BIJAK-05 (owned by another card; read or verified here, not an ownership claim)
- New requirements (45, 46, 48; D113): FR-QA-17, 20, 23; AC-QA-17, 20, 23; FR-PA-09.
- Approach: (1) bilingual `ms+en` (DM-50, migration `0129_s1_bilingual_twins`): `stem_en`, `body_en`, `caption_en`, the bank option `body_en` (`stimulus_group_options`; leaf options are already `{ms, en?}` JSON), and the `language` check widened to `ms`, `en`, `ms+en` (stored values, M-3; the migration first sets `bm` to `ms`, idempotent); a `ms+en` question needs the English text on the stem, leaf prompts, options, stimulus bodies, bank texts and alternative prompts (caption, instruction and scheme text may stay BM) ("Teks English diperlukan untuk soalan dwibahasa."); CSV or API input `bm` is accepted and stored as `ms`. (2) `drawing` (a template image, the axes/grid settings, a checklist and an optional model image; the pupil's PNG up to 5 MB) and `table_fill` (grid, blank cells and key) are stored in `question_parts.mode_config` with the key names written in 45 section 3.1.8 and DM-55; the images use the file purpose `drawing_template` of API-FILE-01 (FILE_PURPOSES); both kinds are authored, validated and self-marked with the suggestion "Cadangan automatik: {k} daripada {n} sel sepadan" (46); Terbit is never refused for these two kinds. (3) Rubric mode "Markah setiap kriteria" (BI C, CA, O, L): the criteria are stored in the scheme; the self-mark request shape (`criteria`) is changed by S3-T06.
- Files: `BE/questions/{questions.service.ts,grading.ts,types.ts}`, `SCH/questions.prisma`, `CT/questions`.
- Migration `0129` is numbered below its dependency's `0133`/`0134`; Prisma applies by name and the columns are independent (plan section 3). Tests: a bilingual question round-trips with both texts; sending for review and Terbitkan without the English text are refused (saving a draft is allowed); a drawing and a table_fill leaf publish and are `belum_dimarkah` until self-marked.
- Verify: V-STD with the S8-T03 widgets. DoD: DoD-T + the IDs of table 4.0 E for this card (bilingual, drawing, table_fill, rubric).

**S1-T10 Accepted batch becomes a draft paper (Semak & Terbit)** · P0 · M · Type: Build · deps: S1-T03, S1-T04
- Starts from (existing): `apps/api/src/modules/intake/workflow/`, `apps/api/src/modules/exam/builder/`
- New files: `apps/api/src/modules/intake/workflow/batch-to-paper.service.ts`, `apps/api/prisma/migrations/0163_s3_paper_source_batch/migration.sql` (S3 range, requested with `needs:schema`: this card writes the file and opens it as the schema PR with the labels `needs:schema` and `needs:S3`, including the Prisma model line in `SCH/exam.prisma`; S3 reviews and merges it first).
- PRD: R1-ADM-Q-07 (FR-ADM-Q07.6, AC-ADM-Q07.3 and AC-ADM-Q07.4 only, table 4.0 E), R1-ADM-Q-15, R1-ADM-QE-05, FR-X1-4e. Gap: no FR, endpoint, table link or card turned an accepted intake batch into a paper: the intake controller has extract / review / items / stimuli / accept / reject / duplicate only, `Kertas Diimport` lists nothing and `Semak & Terbit` has nothing to open (audit F-01, D-A2).
- Data/API: DM-45; API-Q-25
- Also uses: API-Q-14, API-Q-15, API-BIJAK-10, DM-07, DM-11, DM-23 (owned by another card; read or verified here, not an ownership claim)
- New requirements (45, 46, 48; D113): FR-QA-41; AC-QA-41.
- New requirements from the audit (this card owns them): FR-ADM-Q07.6 and its ACs (AC-ADM-Q07.3, AC-ADM-Q07.4). The `Semak & Terbit` preview and blueprint validation (FR-ADM-Q07.7, FR-ADM-Q07.8, AC-ADM-Q07.5, AC-ADM-Q07.6) are Semak Kertas (R1-ADM-Q-15) and belong to S3-T02; the tab UI of FR-ADM-Q07.9 is S2-T02, and this card adds the list filter it reads (below).
- Approach: `POST /api/intake/batches/:id/paper` in the intake module creates ONE draft `papers` row per batch (an upload carries one paper code, U-09; to import two paper codes the admin uploads twice) (`surface = simulasi`, header from the batch), one `paper_sections` row per distinct item Bahagian in order of first appearance (`label`; rule copied from the Disahkan contract when one exists) and `paper_placements` in printed order with `number_label`, each stimulus group placed whole and contiguous in one section, by calling the existing builder services in `exam/builder/` (no second paper writer). Idempotent per batch and paper code: the table has a unique index on (`source_batch_id`, `paper_code`) (DM-45, L-5), so a second call never creates a second paper. Paper code (45 section 3.5): the upload's `Kod kertas`; when the upload gave none, `paper_code` = `K{kertas}` (for example `K1`), so it is never empty; the column is NULL on a paper not created from a batch and the unique index covers the rows where `source_batch_id` is not null. Bahagian to section: one section per distinct item Bahagian (`intake_items.section_label`, detected or edited in Semak Ekstrak, with the one Bahagian typed at upload U-04 as the default), in order of first appearance; none at all gives one section "Bahagian A". Re-call rule: a second call on a batch that already has a paper only appends placements for items accepted since the first call (printed order, at the end of their section; missing sections are created) and never removes, reorders or edits anything the admin changed in Set Builder; it answers 409 "Kertas ini sudah diterbitkan. Tarik balik ke draf dahulu." when the paper is `Terbit`. Split-group rule: a group is placed whole with its accepted members; a rejected member is not placed, a group with no accepted member is not placed, and the 422 applies only when a placement would separate accepted members of one group. API-Q-25 is for `surface = simulasi` only: for a batch created by API-BIJAK-14 (it already targets a `subjektif` paper) it answers 422 "Kertas subjektif tidak dijana daripada kelompok." and creates nothing. The `surface` column and the batches of a Kertas Subjektif arrive only with S3-T06 (migration `0161`, Sprint 4), while this card is Sprint 2, so S3-T06 cannot be in this card's `deps:` (sprint order); this card therefore writes the route for `surface = simulasi` (it writes no `surface` and no `exam_board`; the column default `simulasi` applies once `0161` has landed) and the one guard line `if paper.surface = 'subjektif' then 422` together with its test is added by S3-T06's own PR as a small cross-sector PR to S1 (`Cross-sector: S1 (batch-to-paper guard)`, `needs:S1`, D113-continued). This card also adds the additive filter `imported=true` to `GET /api/admin/papers` (API-BIJAK-10, owner S3-T02; a small PR to S3 with `Cross-sector: S3 (papers list filter)` and `needs:S3`): papers whose `source_batch_id` is set, newest first, 20 per page; it is the list of `Kertas Diimport`. The UI is S2-T02 (tab `Kertas Diimport`, link `Semak & Terbit`); publishing stays S3-T02 (Set Builder, Disahkan contract).
- Files: new `BE/intake/workflow/batch-to-paper.service.ts` (named here), `BE/intake/workflow/**` controller route, call site in `BE/exam/builder/` (S3 review), `CT/intake`; migration `0163_s3_paper_source_batch` (S3 range, `needs:schema` request to S3, DM-45).
- Tests: batch with sections A (10 items) and B (5 items) of which items 5-8 form a group gives 1 draft paper, 2 sections, 15 placements, items 5-8 adjacent; a second call appends only and creates no second paper; a pending item gives 409; a split group gives 422; a batch created by API-BIJAK-14 gives 422 (this test is written and run in S3-T06's PR, after the guard line exists).
- Verify: V-STD at 1280/768/375 from upload (S2-T02) to `Semak & Terbit`; AC-CHAIN-2. DoD: DoD-T + the Semak & Terbit AC of 30 Q-07.

### 4.S2 Admin question UI

**S2-T01 Studio list, wizard, group-first entry** · P0 · L · Type: Complete · deps: S1-T01, S1-T02, S1-T07
- Starts from (existing): `src/modules/m04-question-bank/pages/StudioListPage.vue`, `src/modules/m04-question-bank/pages/StudioEditorPage.vue`, `src/modules/m04-question-bank/pages/StudioGroupPage.vue`, `src/modules/m04-question-bank/routes/questions-form.ts`.
- PRD: R1-ADM-Q-03, R1-ADM-Q-04 (all), R1-ADM-Q-05, R1-ADM-Q-06, R1-ADM-QE-02, R1-ADM-QE-03 (only FR-ADM-QE3.1, 3.5, 3.7, 3.14, 3.21 and AC-ADM-QE3.1, table 4.0 E; the other QE3 IDs are S1 cards and S2-T10), R1-ADM-QE-04; FR-ADM-G5.* (30 §4.G.5 manual flow). R1-ADM-QE-02, Q-05, Q-06 and QE-04 are layered with S1-T01 and S1-T02 (table 4.0 E): this card proves the ACs on screen and writes the UAT rows. The Studio header carries `Import PDF` and `Import CSV` (FR-ADM-Q07.1, 30 Q-03); the three header buttons of the Import and Semakan page are S2-T02's. Gap: gap §5.4, F1 (bar "5 belum lengkap" without detail), third "Bank Soalan", no way to add a 2nd question to a figure.
- Data/API: API-Q-09
- Also uses: API-Q-01, API-Q-05, API-Q-08, API-Q-04, DM-01, DM-51 (owned by another card; read or verified here, not an ownership claim; API-Q-01 and its filters are S1-T07's, this card only sends them)
- New requirements (45, 46, 48; D113): FR-QA-03..11, 16, 35, 50, 51; AC-QA-03..11, 16, 35, 50, 51 (the UI side of FR-QA-05..08, 50, 51; their API side is S1-T01). FR-QA-17, 18, 19, 24, 26 and 46 are S2-T10, not this card.
- New requirements from the audit (this card owns them): FR-ADM-Q03.7, FR-ADM-QE3.7.
- Approach: "Cipta baharu" starts with the stimulus (optional) then adds its questions; completeness panel lists each missing field with a jump link; "Dilihat murid di" uses S1-T07; the demo copy `submissions-unavailable` is removed from the Studio pages only: the file `lib/submissions-unavailable.ts` stays until S2-T02 deletes it with its last consumer `SubmissionListPage.vue` (no dependency between the two cards is needed); Bab field uses `ChapterSelect.vue` and is labelled "Bab" (the DSKP unit is "Unit DSKP"); the completeness panel shows `NO_CHAPTER` with a link to the Bab field.
- Wizard host and the flat form (45 section 1.6, FR-ADM-Q04.7): the ONE wizard is `StudioEditorPage.vue` (routes `/admin/studio/questions/create` and `/admin/studio/questions/:id/sunting`; V2 `/edit` redirects to it). `QuestionCreatePage.vue` and `QuestionEditPage.vue` are the old flat form: this card does NOT extend them and does NOT delete the files; it changes the route records in `src/modules/m04-question-bank/routes/questions-form.ts` so that `/admin/questions/create` and `/admin/questions/:id/edit` redirect to the wizard with the notice "Borang soalan lama telah dipindahkan ke Studio. Sila cipta soalan baharu di sini." This card owns that redirect (S2-T03 owns the V2 path aliases of 30 section 3.3 only). Before the redirect lands, compare the fields (Arabic/Jawi keyboard, single question image, the legacy `Jenis Soalan` values) and add any missing one to the wizard first (30 section 3.3, row of the flat form). S2-T10 builds the leaf forms in the wizard and never in `QuestionEditPage.vue`.
- Studio list filters (FR-ADM-Q03.4, FR-ADM-Q03.8; this card owns them): `StudioListPage.vue` gains the filters `Tingkatan`, `Bab` (with the value "Belum dipautkan" = `chapter=none`) and `DSKP` (`Ada DSKP Tag` / `Belum Ditag`), all read by `GET /api/questions` (API-Q-01: `tingkatan`, `chapter`, `unit`); the filter values stay in the URL after paging (AC-ADM-Q03.4). The saved view `Soalan tanpa Bab` and the bulk bar are S2-T08.
- Group page (L-2, L-3): the group page `StudioGroupPage.vue` has the action `Hantar kumpulan untuk semakan` (API-Q-04 with `groupId`: every `Draf` member to `Menunggu Semakan` in one transaction) and `Terbitkan kumpulan` (`POST /api/stimulus-groups/:id/publish`; disabled until every member is `Menunggu Semakan` or `Diluluskan`; the API answer 409 is shown as "Semua soalan dalam kumpulan mesti dihantar untuk semakan dahulu."); creating a group asks Subjek and Tingkatan (and optional Kertas) first and stores them on the group (API-Q-08, DM-51); adding a member of another Subjek or Tingkatan shows "Subjek dan Tingkatan ahli mesti sama dengan kumpulan.". A single question keeps `Hantar untuk semakan` and `Terbitkan`.
- Group page buttons (UI of FR-QA-04..08, 10; copy per 45 section 3.1; each calls the S1-T01 route): `Sunting kumpulan` (draft copy route), `Buang draf kumpulan` (same route family), `Pindah ke kumpulan lain` (the move route), `Arkibkan kumpulan` (the retire route; the confirm names the affected Terbit papers), `Bubarkan kumpulan` (confirm "Bubarkan kumpulan ini?", body "Soalan ahli kekal, tanpa rangsangan bersama."), `Buang` of a member (confirm "Keluarkan soalan daripada kumpulan?"), `Naik`/`Turun`, `Tambah rangsangan`, and the stimulus kind select with exactly the 7 kinds (AC-ADM-QE3.15, form side). `Gabungkan kumpulan` is in Semak Ekstrak (S2-T02), not on this page.
- Flat-form comparison list (fixed, nothing else is added): (1) the Arabic/Jawi keyboard: a text editor of a question whose `Jenis tulisan` (field 04-23) is `Arab`, `Jawi` or `Campuran` shows the existing keyboard component of the flat form, imported, not rewritten; (2) the single question image becomes the stimulus of a one-member group; (3) the legacy `Jenis Soalan` values map to the 11 question types by the migration map of 30 QE3.8.
- Files: `src/modules/m04-question-bank/pages/{StudioListPage,StudioEditorPage,StudioGroupPage}.vue`, `src/modules/m04-question-bank/routes/questions-form.ts` (the redirects), `components/**`, `api/**`.
- Tests: component tests + `e2e/m04*` http spec "create group of 3, publish". Verify: V-STD, V2 `/admin/studio` side by side (deviation = groups).
- DoD: DoD-T + AC-ADM-Q03.*, AC-ADM-Q04.*, AC-ADM-Q05.*, AC-ADM-Q06.* and, on screen, the ACs of QE-02 and QE-04 (their owners are the S1 cards, table 4.0 E), AC-ADM-QE3.1.

**S2-T02 Import & Semakan (3 tabs) and Semak Ekstrak** · P0 · L · Type: Build · deps: S1-T03, S1-T04, S1-T10
- Starts from (existing): `src/modules/m04-question-bank/lib/submissions-unavailable.ts` (the demo copy; this card deletes the file with its last consumer `SubmissionListPage.vue`), `src/modules/m28-bijak-spm/admin/intake/pages/IntakeReviewPage.vue` (exists: Semak Ekstrak, 45 §1.6; this card extends it), `src/modules/m28-bijak-spm/admin/intake/pages/IntakeListPage.vue` (the tab host of Import & Semakan), `src/modules/m04-question-bank/pages/SubmissionListPage.vue` (exists: it IS the body of the tab `Kiriman Guru`, route `/admin/question-submissions`).
- New files: `src/modules/m28-bijak-spm/admin/intake/pages/KertasDiimportTab.vue`, `src/modules/m28-bijak-spm/admin/intake/components/GroupRangeEditor.vue`. There is no `KirimanGuruTab.vue`: the tab `Kiriman Guru` mounts the existing `SubmissionListPage.vue` in its place, and this card CHANGES that page (a second teacher-submission list would be a parallel page).
- PRD: Q-07 (all except the IDs that table 4.0 E gives to S0-T03, S1-T04, S1-T10 and S3-T02), Q-08, Q-09 UI (layered with S1-T03), Q-12 UI (layered with S1-T08). The three header buttons `Muat Naik Kertas`, `Tulis Soalan Manual` and `Import CSV` are on the Import and Semakan page header (FR-ADM-Q07.1, not the Studio header). Approach: tabs `Kelompok Item`, `Kertas Diimport` (FR-ADM-Q07.9; lists `GET /api/admin/papers?imported=true`, the filter added by S1-T10 to API-BIJAK-10, with columns Kertas, Subjek, Bilangan Soalan, Status and the link `Semak & Terbit` to `/admin/spm/kertas/:id`; the preview and publish screen is S3-T02), `Kiriman Guru`; `Gabungkan kumpulan` of Semak Ekstrak calls the stimulus merge route; `Hantar untuk semakan` is enabled when no item is `pending` and at least one is accepted (45 section 3.3.6; this wins over "at least one draft" wording of FR-ADM-Q09.4, which means the same state); review screen lets the reviewer change the group range (add/remove member) before Terima; PDF pane + editor become tabs under 1024 px (FR-X6-11); busy/failed/timeout states. **Teacher items and the pre-fill (D113-continued, L-6; this card owns it):** every teacher submission is an intake item with `source = guru` (S1-T08, API-GUR-17/18); the tab `Kiriman Guru` lists them (`GET /api/intake/batches?source=guru`, API-Q-14; `SubmissionListPage.vue` is changed to read this route, since no `/api/question-submissions` route exists). The tiles `Pending`, `Processing`, `Selesai`, `Ditolak` and `Jumlah` and the filter use the ONE mapping of FR-ADM-Q12.1 (45 §3.4: `Pending` = item pending, `Processing` = item accepted but question not yet `Diluluskan`, `Selesai` = question `Diluluskan`, `Ditolak` = item rejected with a reason); the TEACHER sees Menunggu Semakan (item pending or accepted and not yet published), Diluluskan only after `Terbitkan`, and Ditolak with the reason. `Tolak` on a teacher item needs a reason of 5 to 500 characters (API-Q-06); on an item of an admin paper batch the reason is optional (at most 200) and `Semak` / `Terima` (API-Q-15) creates a `Draf` question and opens the Studio wizard `/admin/studio/questions/:id/sunting` with that Draf's id; the pre-fill IS the Draf that Terima created from the submitted fields (Subjek, Tingkatan, stem, options and correct answer, the teacher's 1 to 5 star difficulty as `difficultyLevel`; TP, Bab, SP and aras stay empty for the admin, FR-ADM-Q12.6). Missing DSKP fields never block Terima (for teacher items and for paper items alike: Terima refuses only an invalid typed value, such as a free-text SP, with the field name, FR-ADM-Q09.3); only `Terbitkan` is blocked, with the gate list (AC-ADM-Q12.3). The `Kiriman Guru` tab needs the backend of S1-T08 (Sprint 4); until it merges the tab shows the empty text "Tiada kertas soalan dihantar oleh guru lagi." and the ACs AC-ADM-Q12.* on teacher items are `[UAT]`, proven after S1-T08. Files: `src/modules/m28-bijak-spm/admin/intake/**`, `m04-question-bank/pages/SubmissionListPage.vue` (StudioEditorPage.vue is not touched; the existing intake pages are edited under the round-4 rule of section 0B). Tests: spec for a 2-group fixture paper; intake-375 regression. Verify: V-STD; V2 `/admin/studio/imports`. DoD: DoD-T + AC-ADM-Q07.* (except AC-ADM-Q07.3 to 07.6, which are S1-T10 and S3-T02), AC-ADM-Q08.*, AC-ADM-Q09.*, AC-ADM-Q12.*.
- Data/API: none
- Also uses: API-Q-14, API-Q-15, API-Q-25, API-Q-38, API-BIJAK-10, DM-09 (owned by another card; read or verified here, not an ownership claim)
- New requirements (45, 46, 48; D113): FR-QA-08, 36; AC-QA-08, 36 (`Gabungkan kumpulan` in Semak Ekstrak; the work-list row action of S2-T04 calls the stimulus merge route and is not this card's).

**S2-T03 One bank, one queue, aliases** · P0 · M · Type: Fix · deps: none (S0-T07 consumes it)
- Starts from (existing): `src/modules/m04-question-bank/routes.ts`.
- PRD: 30 §3.3; gap §5.4. Approach: `/admin/spm/soalan` list redirects to `/admin/spm/databank`; `/admin/spm/semakan` redirects to `/admin/studio?status=review` (the status value is `review`, 45 §1.6); "Menunggu Semakan" and the old queue show the **same** count (gap F3: 3 vs 0); V2 paths (`/admin/studio/imports`, `/admin/spm/kertas-subjektif`, …) redirect (the alias `/admin/spm/kertas-subjektif` targets the Kertas Subjektif admin list that S3-T06 builds in Sprint 4: until S3-T06 merges the route-table test lists it as `expected-red` with the owner S3-T06, and the alias is added in S3-T06's own PR as a one-line change to `routes.ts`, not here); the header buttons are not built here (Import and Semakan page header: S2-T02; Studio header `Import PDF` and `Import CSV`: S2-T01). Files: route files in `m04-question-bank/routes*`, `m28-bijak-spm/admin/intake/routes*`. Tests: route table test (every alias resolves, no 404). Verify: V-STD. DoD: DoD-T.
- Data/API: none
- Also uses: API-Q-01 (owned by another card; read or verified here, not an ownership claim)
- New requirements (45, 46, 48; D113): FR-QA-15, 32, 47; AC-QA-15, 32, 47.

**S2-T04 Regroup work-list** · P0 · M · Type: Build · deps: S1-T07, S4-T04
- Starts from (existing): `src/modules/m04-question-bank/pages/QuestionListPage.vue` (the page of `Senarai Soalan`, `/admin/questions`; nothing exists for the new part; it is added beside this file).
- New files: `src/modules/m04-question-bank/pages/RegroupPage.vue`, `src/modules/m04-question-bank/components/RegroupRow.vue`.
- PRD: QE-08, FR-ADM-G7.4/G7.5, AC-ADM-G7.2. Location (45 §1.6, one canonical screen): the regroup work-list is the tab `Perlu dikumpulkan semula` of `Senarai Soalan` (45 §6.6): not a Studio filter, not a new route and not a new menu entry. Approach: the tab lists flagged questions with counts per subject × Tingkatan; attach existing figure (upload/pick) or form a group; "Bukan masalah"; same count on the SPM hub lane Latih Tubi ("Perhatian"). This card adds only its own tab entry to the tab strip of `QuestionListPage.vue` (S2-T06 adds the tabs `Kualiti` and `Laporan` to the same strip; neither card removes the other's entry). Files: `m04-question-bank/pages/QuestionListPage.vue` (tab entry), new `m04-question-bank/pages/RegroupPage.vue` (the tab body), `components/**`. Tests: spec attaches a figure → flag clears. Content work (attach figures, regroup) is done by ADMIN users in this screen (D110); developers only build and fix it. Verify: V-STD on UAT data with id 812791-like items. DoD: DoD-T.
- Data/API: none
- Also uses: API-Q-13, API-Q-24, API-Q-35, DM-04, DM-05, DM-06 (owned by another card; read or verified here, not an ownership claim)
- New requirements (45, 46, 48; D113): FR-QA-14; AC-QA-14. The row action `Gabungkan` of the work-list calls the stimulus merge route (owned by S1-T01); FR-QA-08 itself is S2-T02's.

**S2-T05 Manual entry, CSV import UI, Quick Edit** · P1 · M · Type: Complete · deps: S1-T02, S1-T05
- Starts from (existing): `src/modules/m04-question-bank/pages/QuestionImportPage.vue`.
- PRD: Q-10, Q-11, Q-24. Approach: DSKP-correct forms (G.5), CSV page with the new template, import history; Quick Edit shows completeness and is repaired to work on the real API (Q-24 is Fix, D112(5): "dead on the real API" per Team B's audit). Files: `m04-question-bank/pages/{QuestionImportPage,ImportHistoryPage}.vue`, `m28-bijak-spm/admin/intake/**`. Tests: component + spec. Verify: V-STD. DoD: DoD-T.
- Data/API: none
- Also uses: API-Q-17, DM-10 (owned by another card; read or verified here, not an ownership claim)
- New requirements (45, 46, 48; D113): FR-QA-34, 44; AC-QA-34, 44.

**S2-T06 Senarai Soalan tabs and Soalan Berstruktur** · P1 · M · Type: Complete · deps: S2-T03
- Starts from (existing): `src/modules/m04-question-bank/pages/StructuredListPage.vue`, `src/modules/m04-question-bank/pages/QuestionQualityPage.vue`.
- PRD: Q-20..Q-22 and, of Q-23, only FR-ADM-Q23.1 and FR-ADM-Q23.3 (table 4.0 E). Approach: tabs Kualiti and Laporan under Senarai Soalan; `/admin/structured-questions` gets a real list (route exists, no menu); row actions of Laporan Soalan verified (gap §5.1). Files: `m04-question-bank/pages/{QuestionListPage,QuestionQualityPage,QuestionReportsPage,LaporanSoalanPage,StructuredListPage,StructuredDetailPage}.vue`. Tests: row-action specs. Verify: V-STD vs V2 `/admin/questions`. DoD: DoD-T.
- Data/API: API-Q-10
- Also uses: API-Q-20 (owned by another card; read or verified here, not an ownership claim)
- New requirements (45, 46, 48; D113): FR-QA-47; AC-QA-47.

**S2-T07 Responsive pass: admin question screens** · P0 · M · Type: Fix · deps: S8-T06
- Starts from (existing): `src/modules/m04-question-bank/pages/StudioEditorPage.vue`.
- PRD: NFR-1, FR-X6-11, 30 §4.R.1, AC-ADM-R1..R11. Approach: two-pane to tabs/stack on ≤1024; tables to cards ≤640; sticky bars never cover content; run the checklist on every S2 screen. Files: all S2 pages. Tests: Playwright width loop (375/768/1280) asserting no horizontal scroll. Verify: V-STD only (the point of the card). DoD: DoD-T + AC-X6-1 for each S2 screen.
- Data/API: none

**S2-T08 Bulk "Tetapkan Bab" UI** · P1 · S · Type: Build · deps: S4-T03
- Starts from (existing): `src/modules/m04-question-bank/pages/StudioListPage.vue` (nothing exists for the new part; it is added beside these files).
- New files: `src/modules/m04-question-bank/components/BulkChapterPanel.vue` (beside `BulkFilterResult.vue`, mounted in `StudioListPage.vue`).
- PRD: C-05. Approach: filter by subject+level, select rows, choose Bab; shows result counts. Also the admin work-list **"Soalan tanpa Bab"**: the Studio list filter `chapter=none` (API-Q-01) with per-subject counts from API-DSKP-10 and the bulk apply of API-DSKP-09 (D-A5). The mapping itself is ADMIN work in this screen (D110). Files: `m04-question-bank/pages/StudioListPage.vue`, `components/**`. Tests: component. Verify: V-STD on UAT data. DoD: DoD-T + AC-ADM-C05.*.
- Data/API: none
- Also uses: API-DSKP-09, API-Q-01, DM-17 (owned by another card; read or verified here, not an ownership claim)

**S2-T09 Sumber Kertas** · P2 · M · Type: Build · deps: S1-T03 · PRD Q-19. List/detail of source papers. Files: `m04-question-bank/pages/**`. Tests/verify/DoD standard.
- Starts from (existing): `src/modules/m04-question-bank/routes.ts` (nothing exists for the new part; it is added beside these files).
- New files: `src/modules/m04-question-bank/pages/SourcePaperListPage.vue`, `src/modules/m04-question-bank/pages/SourcePaperDetailPage.vue` (routes `/admin/source-papers` and `/admin/source-papers/:id` added in the existing `routes.ts`).
- Data/API: API-Q-18, API-Q-23

**S2-T10 Leaf forms for every answer mode and the marking-scheme editor (UI)** · P0 · L · Type: Complete · deps: S2-T01, S1-T09a, S1-T09b, S8-T03
- Starts from (existing): `src/modules/m04-question-bank/pages/StudioEditorPage.vue`, `src/modules/m04-question-bank/components/studio/` (the wizard step components).
- PRD: R1-ADM-QE-03 (only the IDs of table 4.0 E for this card), R1-ADM-Q-23 (FR-ADM-Q23.2, 23.4, AC-ADM-Q23.1, AC-ADM-Q23.2 only; scheme editing for Soalan Berstruktur); the wizard step `Sub-bahagian` is FR-ADM-Q04.1, owned by S2-T01 and delivered here by the leaf forms; 45 §3.1.5, §3.1.6, §3.1.7. Gap: the wizard has one generic answer box; no leaf form per mode, no scheme editor, no bilingual stacked editors, no rich-text controls for poems or two columns.
- Data/API: none
- Also uses: API-Q-30, DM-54, DM-55, DM-50, DM-69 (owned by another card; read or verified here, not an ownership claim)
- New requirements (45, 46, 48; D113): FR-QA-17, 19, 21..24, 26..28, 30, 46; AC-QA-17, 19, 21..24, 26..28, 30, 46 (the authoring-form layer; FR-QA-18 and AC-QA-18, the rich-text toolbar and the sanitiser allow-list, are S8-T03's alone).
- New requirements from the audit (this card owns them): FR-ADM-QE3.8, 3.9, 3.12, 3.15..3.18, 3.23..3.25 and AC-ADM-QE3.7, 3.9, 3.10, 3.12, 3.15..3.18 (table 4.0 E).
- Split of the neighbouring QE3 ACs (round 4): AC-ADM-QE3.13 (stimulus delete guard) is S1-T01's, the message is shown by the group page of S2-T01; AC-ADM-QE3.14 (`kertas=5` 422) is S1-T07's, here the wizard Kertas select lists 1 to 4 only (proof, not ownership). Owned here: AC-ADM-QE3.15 stimulus kinds (select on the group page of S2-T01 and DM-70 of S1-T01; here the `Petikan` pseudocode `</>` block in monospace in the editor and preview), QE3.16 `Pratonton` equals the pupil view (with the S8-T03 components), QE3.17 and QE3.18 the example leaf: the fields `Contoh (tidak dimarkah)` and `Jawapan contoh` are this card; the validation, the 0-mark rule and "no mark row" are S1-T09a; the read-only display to the pupil is S8-T03.
- Approach: in the existing wizard step `Sub-bahagian`, a leaf form for each of the nine modes (fields of 45 section 3.1.6, extras stored in `mode_config`), the full scheme editor of 45 section 3.1.7 with live validation through the S1-T09a validate route, stacked BM and English editors for a `ms+en` question, the toolbar buttons of the rich-text editor (`U`, `S`, `Baris puisi`, `Dua lajur`, `Kotak teks`, `Penanda ruang kosong`; the component `RichText.vue` and the widened sanitiser allow-list are S8-T03's, which this card waits for) and `{{gap:N}}` gaps linked to leaves; a structured question with marks opens and saves in the wizard whatever path created it; the preview equals the pupil view (S8-T03 components).
- Files: `src/modules/m04-question-bank/pages/StudioEditorPage.vue` (the wizard; the flat `QuestionEditPage.vue` is redirected by S2-T01 and is not touched here), `src/modules/m04-question-bank/components/**`, `src/modules/m04-question-bank/api/**`; the rich-text sanitiser allow-list and `RichText.vue` are S8-T03's (single owner, FR-QA-18); this card edits neither.
- Tests: component tests per mode form; the scheme editor reproduces Fizik 9(d) (4 pairs, "Maks 8", bonus 2 = 10 marks) and a BI P2 rubric of 4 criteria; spec at 375/768/1280. Verify: V-STD. DoD: DoD-T + AC-ADM-QE3.*, AC-ADM-Q23.*.

### 4.S3 Bijak SPM papers

**S3-T01 Kontrak: "Disahkan" selectable and honest** · P0 · M · Type: Fix · deps: S4-T02
- Starts from (existing): `src/modules/m28-bijak-spm/admin/kontrak`, `apps/api/src/modules/exam/blueprints/blueprints.controller.ts`.
- PRD: Q-16 (incl. FR-ADM-Q16.7, AC-ADM-Q16.4: D112(3), a Kontrak (JSU) can be created only for a Subjek whose DSKP is loaded; the create call and the `Baharu` Subjek list check `curriculum_node`); gap F7, §5.3 (0 contracts on UAT; all 8 "Spec"; Disahkan not choosable). Approach: Disahkan in the status control with the evidence/quota conditions shown inline (not only on the Pengesahan tab); Terbit with a Disahkan contract needs no exception box; keep the exception path but record it. Files: `src/modules/m28-bijak-spm/admin/kontrak/**`, `BE/exam/blueprints/**`; migration `0164_s3_blueprint_marks_per_question` (DM-57: `marks_per_question`, stored `compulsory`, free `label`, `question_count`). Tests: gate tests, spec. Verify: V-STD vs V2 Kontrak; UAT: U-OP-08 later. DoD: DoD-T + AC-ADM-Q16.*.
- Data/API: DM-57; API-BIJAK-02, API-BIJAK-09, API-DSKP-06
- Also uses: DM-21 (owned by another card; read or verified here, not an ownership claim)
- New requirements (45, 46, 48; D113): FR-QA-25, 40, 42; AC-QA-25, 40, 42.

**S3-T02 One Set Builder** · P0 · L · Type: Complete · deps: S1-T06, S3-T01, S1-T10
- Starts from (existing): `src/modules/m28-bijak-spm/admin/builder/pages/SetBuilderPage.vue`, `src/modules/m28-bijak-spm/admin/papers/PaperListPage.vue`.
- PRD: Q-13, Q-14, Q-15, QE-07. Gap: Pembina Kertas and Set Builder show the same papers; Jana set has no Tahun/Negeri/Bilangan, no "Jawab Semua/Pilih N", Sejarah only Kertas 2 (gap F4).
- Data/API: DM-11, DM-26; API-BIJAK-10, API-BIJAK-11, API-Q-39
- Also uses: DM-01, DM-23 (owned by another card; read or verified here, not an ownership claim)
- New requirements (45, 46, 48; D113): FR-QA-40, 41; AC-QA-40, 41.
- New requirements from the audit (this card owns them): FR-ADM-Q07.7, FR-ADM-Q07.8, AC-ADM-Q07.5, AC-ADM-Q07.6 (`Semak & Terbit` preview and blueprint validation of an imported draft paper, Semak Kertas = R1-ADM-Q-15; the batch-to-paper route is S1-T10 and the `Kertas Diimport` tab is S2-T02).
- Approach: Set Builder `/admin/studio/sets` is the single builder; `/admin/spm/kertas` redirects; `/admin/spm/kertas/:id` stays as "Semak Kertas Simulasi"; Jana set fields per V2; section rule control; bank panel adds a group as a unit; builder two-pane → tabs ≤1024.
- Files: `m28-bijak-spm/admin/{builder,papers}/**`, `BE/exam/builder/**`, `CT/bijak`. Tests: builder spec incl. group unit. Verify: V-STD vs V2 Set Builder. DoD: DoD-T + AC-ADM-Q13.*, AC-ADM-Q14.*, AC-ADM-Q15.*.

**S3-T03 SPM hub with 6 lanes** · P0 · M · Type: Complete · deps: none
- Starts from (existing): `src/modules/m28-bijak-spm/admin/kandungan/lanes.ts`, `apps/api/src/modules/spm/hub.service.ts`.
- PRD: Q-01, Q-02. Gap: 2 of 6 cards (Databank, Bijak SPM); lanes Latih Tubi, Tracking A, Subjektif, Bijak missing. Files: `m28-bijak-spm/admin/kandungan/**`, `BE/spm/hub.service.ts`. Tests: hub counts equal list counts. Verify: V-STD vs V2 `/admin/spm`. DoD: DoD-T.
- Data/API: API-BIJAK-12, API-BIJAK-15
- Also uses: API-Q-11 (owned by another card; read or verified here, not an ownership claim)

**S3-T04 Pupil sitting and result (Bijak SPM)** · P0 · L · Type: Complete · deps: S8-T02, S8-T03, S8-T04, S3-T02, S5-T15, S1-T01, S1-T02, S1-T03, S1-T10, S2-T01, S2-T02, S9-T06 (S1-T01 to S2-T02 are the front of AC-CHAIN-2, the row of the chain table in 40 X9; S9-T06 lands `helpers.ts`)
- Starts from (existing): `src/modules/m28-bijak-spm/pages/AttemptPage.vue`, `src/modules/m28-bijak-spm/pages/ResultPage.vue`, `src/modules/m28-bijak-spm/server/errors.ts`, `src/modules/m28-bijak-spm/server/http-admin.ts` (demo copy removal only; the line numbers in this card are hints, find the code by the message text), and the backend (S3-owned) `apps/api/src/modules/bijak/attempts/attempts.service.ts`, `attempts.controller.ts`, `marking.ts`, `exam-core.adapter.ts` (submit, answer writes, reward gate).
- New files: `e2e/r1/chains/chain-2.http.spec.ts` (the chain spec; the shared helper `e2e/r1/chains/helpers.ts` is landed by S9-T06 in Sprint 1 and only imported here).
- Chain spec (D-T10-5): this card is the last card of AC-CHAIN-2, so it also writes `e2e/r1/chains/chain-2.http.spec.ts` (an S0-owned folder: a small cross-sector PR with the line `Cross-sector: S0 (chain spec)` and the label `needs:S0`, S0 reviews within 1 working day); S9-T06 runs and maintains it.
- PRD: R1-MUR-13 (every FR and AC except the IDs that table 4.0 E gives to S3-T06, S3-T07, S5-T11 and S5-T15), AC-X6-2, QP contract 10-murid §4.8. Gap: F8 passes functionally; UAT 0 papers; 375 px gaps (gap §2.2 row 13); structured item "Tidak disajikan: jenis jawapan tidak dibenarkan dalam bahagian ini".
- Data/API: DM-68; API-BIJAK-04, API-BIJAK-06
- New requirements from the audit (this card owns them): AC-MUR-13-25 (a Bijak sitting of 40 MCQ writes 40 `practice_answers` rows once; the Hantar is idempotent).
- Random Kuiz (Bijak SPM "Kuiz", D-T10-3; the question count is a URL parameter with fallback 20, no picker): uses API-BIJAK-06 only (`POST /api/bijak/kuiz/sessions`, `.../:id/check`, `.../:id/finish`) and writes `practice_answers` with mode `kuiz` at `finish`; it does not call the Latih Tubi start API of S5-T03.
- New requirements (45, 46, 48; D113): FR-PA-01, 08, 14, 16, 17, 21, 26, 39; AC-PA-07, 08, 11, 20, 41.
- Answer store (D-A1, DM-44, owned by S5-T15): `POST /bijak/attempts/:id/submit` writes one answer row per answered leaf with `mode = simulasi` and the `attempt_id`, then upserts the `practice_attempt_aggregates` summary; a regrade updates the rows (idempotent per `(attempt_id, user_id, question_id, part_ref)`). The `kuiz` rows are written only by the Kuiz `finish` (API-BIJAK-06). Databank and Tracking A objective are NOT sittings: they are drill sessions on API-PRAC-01 (S5-T03) that write `databank` and `tracking_a` (46 D-PA-12); only paper sittings use this submit (mode per the master table "Pupil activity → stored `mode` → API → card" in 40 (after X11.3)). Late submit (D113-continued): a submit is never rejected for lateness; at 00:00 the client auto-submits, and a submit or offline sync arriving after expiry (up to 24 h) is accepted and stored with its real `submittedAt`; the 30 s figure is only the client grace before auto-submit. Reward gate (46 D-PA-13): a Mod Latihan sitting credits Syiling only for parts never revealed by "Semak" (in `attempts.service.ts`). Grader (D113-continued): marking calls the one grader `apps/api/src/modules/questions/grading.ts` (S1-owned; S1-T09a extends it) through `marking.ts`; `packages/exam-core/src/grading.ts` is not extended and no second grader is written. Writes go through the one `AnswerLogPort` of `practice/`; no second answer table, no report reads anything else.
- Approach: compose S8 components in `AttemptPage`, `PaperQuizPage`, `ResultPage`; remove "not served" for allowed modes; remove the demo message "Fungsi ini belum tersedia dalam demo" from the real path (`m28-bijak-spm/server/errors.ts:14`, `server/http-admin.ts:153`, register 10-murid 4.11 #12); stimulus group once, sticky; the self-mark control and the Semakan view are S3-T06's (kind `subjektif`) and are reused by S5-T11 (kind `structured`); this card's sitting is the Bijak paper sitting with stored mode `simulasi`. Lateness: no sweeper closes a Bijak attempt in R1 (the only sweeper is S5-T15's, for drill sessions), so a submit after the deadline is always accepted (the late-submit rule above). Coin rate (L-8): until S7-T05 merges, the Syiling credit reads the rate with the default 1 when no `reward_settings` row exists; the card does not wait for S7-T05 in Slice 0. Files: `m28-bijak-spm/pages/**`, `lib/**`, `domain/**`, `server/errors.ts`, `server/http-admin.ts`. Tests: spec with a group-of-3 paper at 375. Verify: V-STD on a phone-size headed browser on UAT data. DoD: DoD-T + AC-MUR-13-*, AC-X6-2.

**S3-T05 Tracking A** · P0 (Q-17; pupil Tracking A part P1) · M · Type: Build · deps: S3-T03, S5-T15
- Starts from (existing): `apps/api/src/modules/spm/tracking.service.ts`.
- New files: `src/modules/m28-bijak-spm/admin/kandungan/pages/TrackingAListPage.vue`, `src/modules/m28-bijak-spm/admin/kandungan/pages/TrackingASetEditorPage.vue` (route `/admin/spm/tracking-a`), `apps/api/prisma/migrations/0162_s3_tracking_sibling_unique/migration.sql`; the pupil subject page is the existing `src/modules/m06-spm/pages/TrackingASubjectPage.vue`.
- PRD: Q-17, MUR-13 Tracking A. Gap: `/admin/spm/tracking-a` 404 (F5); `BE/spm/tracking.service.ts` exists. Approach: lane list + set editor + pupil subject page. Files: `m28-bijak-spm/admin/kandungan/**`, `m06-spm/pages/**`, `BE/spm/tracking.service.ts`. Tests: spec. Verify: V-STD vs V2 Tracking A. DoD: DoD-T + AC-ADM-Q17.*.
- Data/API: DM-24; API-BIJAK-13
- New requirements (45, 46, 48; D113): FR-PA-22; AC-PA-09, 34.
- Answer store (D-A1, DM-44, owned by S5-T15): Tracking A objective uses the drill engine (see the master table "Pupil activity → stored `mode` → API → card" in 40 (after X11.3); session mode `tracking_a` and answer rows `mode = tracking_a`; the legacy value `ramalan` is only read for old rows, in the same lane, and is never written by R1 code, D-T10-2, 46 §4.5); Tracking A Bahasa uses the Subjektif sitting of S3-T06 and its rows carry `mode = tracking_a` with `part_ref`. Writes go through the one `AnswerLogPort` of `practice/`; no second answer table, no report reads anything else.

**S3-T06 Kertas Subjektif and self-mark** · P0 (D104, no flag) · L · Type: Build · deps: S3-T04, S1-T09a, S1-T09b, S5-T15
- Starts from (existing): `src/modules/m28-bijak-spm/components/SelfMarkControl.vue`, `src/modules/m28-bijak-spm/routes.ts` (pupil routes `/kertas-subjektif*`), `src/modules/m28-bijak-spm/routes/admin-papers.ts` (admin routes), `apps/api/src/modules/exam/builder/builder.controller.ts`, `apps/api/src/modules/spm/spm.controller.ts`, `apps/api/src/modules/bijak/attempts/attempts.controller.ts` (the `surface` filter of the pupil paper list), `src/modules/m04-question-bank/routes.ts` (S2 file: the one-line alias, small cross-sector PR `Cross-sector: S2 (routes alias)`, `needs:S2`; S2-T03 lists it as `expected-red` until then) (nothing exists for the new part; it is added beside these files).
- New files: `src/modules/m28-bijak-spm/admin/papers/SubjektifPaperListPage.vue`, `src/modules/m28-bijak-spm/admin/papers/SubjektifPaperDetailPage.vue`, `src/modules/m28-bijak-spm/pages/SubjektifAttemptPage.vue`, `src/modules/m28-bijak-spm/pages/SubjektifSemakanPage.vue`, `apps/api/src/modules/exam/builder/paper-source.service.ts` (API-BIJAK-14: the paper-source upload to an intake batch; it creates the batch by calling the existing S1 intake upload service `IntakeUploadService` in `apps/api/src/modules/intake/files/intake-upload.service.ts` through its exported module, with `source = admin` and the paper's subject, Tingkatan and Kertas, and edits no S1 file; if that service needs a new export, that is a small cross-sector PR to S1), `apps/api/prisma/migrations/0161_s3_paper_surface/migration.sql`.
- Admin routes (30 Q-18): the canonical list route is `/admin/kertas-subjektif` and the detail `/admin/kertas-subjektif/:id`; the alias `/admin/spm/kertas-subjektif` redirects to the list (the alias line is in the S2 file above). The lane read and the menu entries follow the same paths.
- Screen ownership (D113-continued, 46 section 4.6 and 4.7): this card owns **B6 Kertas Subjektif** (pupil `/kertas-subjektif` and `/kertas-subjektif/:paperId`, here `SubjektifAttemptPage.vue` and `SubjektifSemakanPage.vue`), its admin list/detail/build, and the shared self-mark control (`SelfMarkControl.vue`, `SubjektifSemakanPage.vue` as the reusable Semakan view). **B5 Soalan Berstruktur** pupil screens (`/latihan-berstruktur`, `/latihan-berstruktur/:id`, `/latihan-berstruktur/keputusan/:attempt`) belong to S5-T11 (their rows carry `mode = structured`, API-PRAC-10), which reuses this card's self-mark control and Semakan view and adds no second one. Tracking A Bahasa also reuses the sitting of this card.
- API location (API-BIJAK-14): there is NO `subjektif.controller.ts`. The list, create, read, update, delete, publish and withdraw of a Kertas Subjektif paper are the existing `/api/admin/papers*` routes (API-BIJAK-10, `apps/api/src/modules/exam/builder/builder.controller.ts`) with `surface = 'subjektif'`; this card adds in that controller only `POST /api/admin/papers/:id/source` (calling the new `paper-source.service.ts`, which creates the intake batch) and the lane read `GET /api/admin/servability/lanes/kertas-subjektif` in the existing servability controller.
- PRD: R1-ADM-Q-18, R1-MUR-13 (Subjektif lane), R1-MUR-17 (answer screen), E-10; D104 (fully working at release). Gap: 404 (F6); the self-mark route `POST /api/bijak/attempts/:id/self-mark` already exists (API-BIJAK-05), the Subjektif lane and its screens do not. Approach (45 section 3.5): the admin creates the Kertas Subjektif paper FIRST in Set Builder (`surface = 'subjektif'`, the existing `/api/admin/papers*` routes); `POST /api/admin/papers/:id/source` (API-BIJAK-14) then attaches the source PDF to THAT paper, creates the intake batch and its accepted stimulus groups become placements of that same paper (no new paper and no call of API-Q-25, which is for `simulasi` only); the pupil list and viewer of published papers is `GET /api/bijak/papers?surface=subjektif` (API-BIJAK-04, the `surface` filter is added by this card in `attempts.controller.ts`, a same-sector change to a route S3-T04 owns), and the pupil attempt (kind `subjektif`) is started by this card's `SubjektifAttemptPage.vue` through API-BIJAK-04; admin list/detail/build on `papers` with `surface = 'subjektif'` (API-BIJAK-14, DM-23); pupil Kertas Subjektif answer and Semakan with scheme on the existing self-mark route (no new self-mark endpoint, no `0160_s3_self_mark`, DM-25); the pupil side is UI wiring on that existing endpoint: one stepper per scheme point or per criterion, "Hantar & Semak" before "Tunjuk Skema Pemarkahan" (FR-PA-18..20, FR-PA-24); fully working at release with **no feature flag** (D104 supersedes D80(2)). The menu entries and pupil routes `/kertas-subjektif*` are registered by one-line cross-sector PRs to S0 (menu.ts, user-nav.ts, decision 7); the admin lane is R1-ADM-Q-18 (30 Q-18, FR-ADM-Q18.1..8). Files: `m28-bijak-spm/admin/**`, `components/SelfMarkControl.vue`, `BE/exam/builder/builder.controller.ts` (the `source` route), `BE/spm/**`, `BE/bijak/attempts/**`, `CT/bijak`, the route files named above, and the guard line in `BE/intake/workflow/batch-to-paper.service.ts` (small cross-sector PR to S1: `Cross-sector: S1 (batch-to-paper guard)`, `needs:S1`; S1-T10 refuses a Kertas Subjektif batch with 422 and this card writes the line and its test); migration `0161_s3_paper_surface` (DM-23). Tests: BE + spec. Verify: V-STD vs V2 Subjektif. DoD: DoD-T.
- Data/API: DM-23, DM-25; API-BIJAK-05, API-BIJAK-14
- Also uses: DM-08, API-BIJAK-04, API-BIJAK-10 (owned by another card; read or verified here, not an ownership claim)
- New requirements (45, 46, 48; D113): FR-QA-20, 23, 48, 49; AC-QA-20, 23, 48, 49; FR-PA-18..20, 24, 40; AC-PA-10, 18, 19, 43.
- New requirements from the audit (this card owns them): FR-MUR-13-29, FR-MUR-13-30, the Kertas Subjektif half of FR-MUR-13-19 and of AC-MUR-13-24 (Subjektif self-mark stored and listed with kind and mode `subjektif`; the structured half is S5-T11's; AC-MUR-13-25, the Bijak sitting submit writing 40 rows once, belongs to S3-T04); table 4.0 E.
- Answer store (D-A1, DM-44, owned by S5-T15): the Kertas Subjektif lane starts an `exam_attempts` row of kind `subjektif` (through API-BIJAK-04; API-PRAC-10 is not involved, it creates kind `structured` for S5-T11); `POST /bijak/attempts/:id/self-mark` (API-BIJAK-05, existing route, D-A9) serves both kinds and updates `marks_awarded` of the part rows (`mode = subjektif` for this kind, `structured` for S5-T11's, the master table "Pupil activity → stored `mode` → API → card" in 40 (after X11.3)). Writes go through the one `AnswerLogPort` of `practice/`; no second answer table, no report reads anything else.

**S3-T07 Pupil SPM hub, Databank** · P1 · M · Type: Complete · deps: S1-T06, S5-T15, S3-T04, S3-T05, S3-T06, S10-T02, S9-T06 (the other cards of AC-CHAIN-3, the row of the chain table in 40 X9)
- Starts from (existing): `apps/api/src/modules/spm/hub.service.ts`, `src/modules/m06-spm/routes.ts`, `src/modules/m06-spm/routes/tracking.ts`, `src/modules/m06-spm/pages/SubjektifPage.vue`.
- New files: `e2e/r1/chains/chain-3.http.spec.ts` (the chain spec; helper `helpers.ts` landed by S9-T06 in Sprint 1).
- Cross-sector: S5. The Databank draw moves from `spmPool` to the servable rule in `apps/api/src/modules/practice/start.planner.ts` (S5 path) and `apps/api/src/modules/spm/pool.service.ts` (this sector): a small PR to S5 (`Cross-sector: S5 (Databank draw predicate)`, `needs:S5`, S5 reviews within 1 working day) carries the first file.
- Chain spec (D-T10-5): this card is the last card of AC-CHAIN-3, so it also writes `e2e/r1/chains/chain-3.http.spec.ts` (an S0-owned folder: a small cross-sector PR with the line `Cross-sector: S0 (chain spec)` and the label `needs:S0`, S0 reviews within 1 working day); S9-T06 runs and maintains it.
- PRD: R1-MUR-13 hub and Databank (the IDs of table 4.0 E: FR-MUR-13-1, 13-20, 13-34, AC-MUR-13-9, 13-10, 13-26, 13-29), AC-PA-02 clause (c) Databank and AC-PA-36 clause (b) Databank and the Bijak list (a T1 pupil sees a Bijak paper only when its `level_scope` includes the pupil's form, otherwise the data-empty state) (OQ-MUR-7 closed by D112(6)). Routes (decided): the Tracking A pupil page route stays `/spm/ramalan` and `/spm/ramalan/:code` (existing; the API stays `/api/spm/tracking-a`); `/spm/subjektif` (`SubjektifPage.vue`, the subject picker "Latihan Subjektif SPM") is this card's and hands over to `/latihan-berstruktur?subjectId={id}` of S5-T11 (the subject travels as that query parameter). The hub shows six links: five cards (Databank, Latih Tubi SPM, Tracking A, Subjektif, Kertas Subjektif) and the Bijak SPM banner. The Databank draw no longer filters on `spmPool` (`BE/spm/pool.service.ts`; S1-T07 stops writing the flag). Approach: hub counts = what is servable (D91); the hub card `Kertas Subjektif` exists for every T1-T5 pupil at a fixed position (after `Bijak SPM`), shows "{n} kertas" and opens `/kertas-subjektif` (FR-MUR-13-34, AC-PA-33); "Tahun Tersedia" is computed or hidden, never a constant 0, and each card chip equals its details view; Databank draws units; the pupil "Jana Kertas" tab is hidden and its route returns 404 (FR-X2-2); no pupil path generates a paper; the generate route stays for the admin Jana Kertas only (FR-ADM-QE7.2). Files: `m06-spm/**`, `BE/spm/{hub,pool,mock}.service.ts`. Tests: counts spec. Verify: V-STD vs V2 `/spm`. DoD: DoD-T.
- Data/API: API-BIJAK-03, API-BIJAK-07, API-BIJAK-08
- New requirements (45, 46, 48; D113): FR-PA-34; AC-PA-32, 33.
- Answer store (D-A1, DM-44, owned by S5-T15; the master table "Pupil activity → stored `mode` → API → card" in 40 (after X11.3)): a Databank drill answer writes `mode = databank` (D-T10-2: the session mode is `databank` too; `past_year` is a legacy value, only read for old rows and never written by R1 code; the history chip "Tahun Lepas" filters `databank` and old `past_year` rows). Writes go through the one `AnswerLogPort` of `practice/`; no second answer table, no report reads anything else.

**S3-T08 Terbit pipeline (dry-run tooling for UAT)** · P0 · M · Type: Ops · deps: S3-T01, S3-T02, S4-T03
- Starts from (existing): `apps/api/src/modules/exam/builder`.
- PRD: gap §7 P0-1. Approach: script `apps/api/scripts/uat-ops/terbit-papers.ts` (dry-run default) that builds papers through the admin API from approved contracts; documents U-OP-04/08/09; the script only produces the dry-run report; the real publish is confirmed by the user and run by the designated UAT developer or done by an admin in Set Builder (D110). Files: `apps/api/scripts/uat-ops/**` (S4 dir; S4 reviews), `docs/ops/`. Tests: dry-run report test (CI). Verify: on UAT, after the approved run, a T5 pupil sees papers in Bijak SPM. DoD: DoD-T + AC-MUR-13 "paper list non-empty".
- Data/API: DM-22; API-BIJAK-01, API-BIJAK-02

### 4.S4 Curriculum / DSKP and UAT data

**S4-T01 CI test seed profile (not acceptance data)** · P0 · M · Type: Ops · deps: S0-T02
- Starts from (existing): `apps/api/prisma/seed/index.ts`.
- PRD: 40 §X5 FR-X5-1. Decision D110: acceptance data is **UAT, a clone of V2 production data**; no UAT dump, no anonymised local restore and no synthetic acceptance profile is made. This card keeps only a small deterministic seed profile `uat-like` used by **automated tests in CI** (it may reproduce the defect shapes for test fixtures: ≥11 education levels active, questions without Bab/SP, stimulus-less "Rajah n" stems, duplicated stems, 0 contracts, 0 papers, T1–T5 pupils, school admin account, ≥3 schools, all fictitious). Files: `SEED/uat-like/**` (new), `SEED/index.ts` (S0 one-line), `docs/ops/uat-like-data.md` (states "CI fixtures only, not acceptance evidence"). Tests: seed idempotence. Verify: CI green with the profile. DoD: DoD-T.
- Data/API: DM-39

**S4-T02 DSKP loader verified; T1–T5 content** · P0 · M · Type: Build · deps: S0-T02
- Starts from (existing): `docs/ops/dskp-loader.md`, `apps/api/src/modules/curriculum/dskp`.
- New files: `src/modules/m03-curriculum/pages/SubjectDskpReportTab.vue` (named in the approach); no other new file.
- PRD: R1-ADM-C-04, FR-X3-3. Approach: loader tests and dry-run in CI; the real run on UAT is U-OP-01, run by the designated UAT developer after the user approves the dry-run report (D110); confirm 13 subjects × T4/T5 load (`dskp-loader.md`); T1–T3 drop-in follows the D109 rule (the same structure as T4–T5, built from the existing chapter and topic data, S4-T09); the loader report is shown in the Kurikulum `DSKP` tab (R1-ADM-C-04), a new tab component `src/modules/m03-curriculum/pages/SubjectDskpReportTab.vue` that S4-T07 mounts in the Kurikulum browser. Files: `BE/curriculum/dskp/**`, `docs/ops/dskp-loader.md`, new `src/modules/m03-curriculum/pages/SubjectDskpReportTab.vue`. Tests: loader idempotence (exists). Verify: counts of nodes per subject. UAT run = U-OP-01. DoD: DoD-T.
- Data/API: DM-14; API-DSKP-05

**S4-T03 Bab/Topik/SP mapping tool and bulk API** · P0 · L · Type: Build · deps: S4-T02
- Starts from (existing): `apps/api/src/modules/curriculum/admin.service.ts` (nothing exists for the new part; it is added beside these files).
- New files: `apps/api/src/modules/curriculum/bulk-chapter.service.ts` (the bulk apply and dry-run; the route `POST /api/admin/curriculum/questions/bulk-chapter` is added in the existing `admin.controller.ts`), `packages/contract/src/curriculum/bulk-chapter.ts`, `apps/api/scripts/uat-ops/bulk-chapter-dry-run.ts` (dry-run report only).
- PRD: R1-ADM-C-05, FR-ADM-C05.*, OQ-MUR-6. Gap: UAT 686 chapters, 0 of 339,112 questions linked (gap §5.3). Approach: **bulk by filter only, no auto-mapping** (D89 forbids derived data; PRD 30 OQ-03): `POST /api/admin/curriculum/questions/bulk-chapter` (filter subject+level+optional unit, dry-run count, apply, audit trail), used by ADMIN users through the Studio UI (S2-T08) for U-OP-07 (content work is the admin's, D110; a script may only produce a dry-run report or assist a bulk action the admin confirms in the UI), starting with the T4-T5 subjects pupils use (Matematik, Sains, Sejarah, BI, BM). A Bab-to-Unit lookup to pre-filter the Tag step is a suggestion only (OQ-C1). No script that guesses chapters. Files: `BE/curriculum/**`, `apps/api/scripts/uat-ops/**`, `CT/curriculum`; no migration for the bulk update (DM-17: in-place update of `curriculumChapterId`; `0140_s4_question_chapter_link` is not needed). The chapter-delete guard is migration `0126_s1_chapter_fk_restrict` (DM-18, S1 range, `needs:schema`). Tests: bulk API + script dry-run (CI). Verify: on UAT: Soalan by Chapter fills for T4/T5 after the admin's mapping. DoD: DoD-T + AC-ADM-C05.*.
- Data/API: DM-17; API-DSKP-09, API-DSKP-10
- Also uses: API-AS-11, DM-18, DM-41 (owned by another card; read or verified here, not an ownership claim)
- Work-list (D-A5): `GET /api/admin/curriculum/chapter-coverage` (API-DSKP-10) gives the counts behind "Soalan tanpa Bab"; the list is API-Q-01 `chapter=none` (S2-T08 UI).

**S4-T04 Regroup data operations and duplicate-stem cleanup** · P0 · M · Type: Ops · deps: S1-T07
- Starts from (existing): `apps/api/src/modules/intake/workflow/figure-links.ts`.
- PRD: QE-08, G7.6, FR-X1-4f. Approach: dry-run report script listing flagged questions per subject/level; one-off trim of duplicated leaf prompt equal to stem (dry-run first; the real run only by the designated UAT developer after the user approves the report; reversible via a backup table); no content invented. Figures cannot be recovered by code: ADMIN users supply the missing figure images and regroup stimulus groups in the regroup work-list and diagram audit (D110); scripts only report or assist bulk actions an admin confirms in the UI. Files: `apps/api/scripts/uat-ops/regroup-report.ts`, `trim-duplicate-stem.ts`. Tests: script unit tests (CI). Verify: on UAT, report counts match S2-T04. DoD: DoD-T.
- Data/API: DM-40
- Also uses: API-Q-13, API-Q-21, API-Q-24, DM-05, DM-06 (owned by another card; read or verified here, not an ownership claim)
- New requirements (45, 46, 48; D113): FR-QA-13; AC-QA-13.

**S4-T05 Darjah deactivation (Tingkatan 1–5 only)** · P0 · S · Type: Fix · deps: none
- Starts from (existing): `src/modules/m03-curriculum/pages/LevelListPage.vue`, `apps/api/src/modules/curriculum/curriculum.repository.ts`.
- PRD: FR-X3-1, FR-X3-2, R1-ADM-C-03, D96. Gap: UAT 11 levels, public "Tahap" = 11. Approach: code ensures inactive levels are excluded from every picker/list/count/public stat (grep for hard-coded level lists); the deactivation itself is done by the admin in `Tahap Pendidikan` (U-OP-03, UI); this card adds a verification script `check-levels.ts`. Files: `BE/curriculum/**`, `m03-curriculum/pages/Level*.vue`, public stats endpoint under `BE/content` (S5 review). Tests: public stats = 5. Verify: V-STD on the public landing and pickers. DoD: DoD-T + AC-X3-*.
- Data/API: DM-12, DM-13; API-AUTH-13, API-DSKP-02
- Also uses: API-DSKP-01 (owned by another card; read or verified here, not an ownership claim)

**S4-T06 T1–T5 learning served (BE)** · P0 · M · Type: Fix · deps: S4-T05, S1-T07
- Starts from (existing): `apps/api/src/modules/practice/rules.ts`, `apps/api/src/modules/curriculum/learner.service.ts`, `apps/api/src/modules/curriculum/rules.ts`.
- PRD: FR-X3-3, AC-X3-1, D101. The backend half of FR-MUR-16-13 (`rules.ts:43-45`, `OFFERED_LEVEL_CODES`) is delivered here; FR-MUR-16-13 and AC-MUR-16-9 are owned and verified by S5-T01 (10 section 4.11 item 6). Gap: `apps/api/src/modules/practice/rules.ts:41` `SPM_LEVEL_CODES = ['T4','T5']` and curriculum learner rules limit to T4/T5 (S5 owns `practice/rules.ts`; this card edits that one file through a small cross-sector PR to S5, `Cross-sector: S5 (practice/rules.ts level codes)`, `needs:S5`). This card alone changes 10 section 4.11 item 6 (find the lines by the symbols `SPM_LEVEL_CODES` and `OFFERED_LEVEL_CODES`; S5-T03 does not touch level codes). The servable-subject filter reads the S1-T07 flags, hence the dependency below, and it is the same predicate that API-PRAC-04 (S5-T03) uses for its servable counts, so no second calculation exists; DM-20 `stage <> 'primary'` is the Tingkatan 1 to 5 filter. UAT data: if the UAT bank has no servable T1 to T3 questions yet, the UAT row of AC-X3-1 is recorded as data-blocked (content is Admin Pusat work, D110) and CI proves it on the seed. Approach: serve every active Tingkatan; subject list per level only for subjects with questions; no level-wide "akan datang". Files: `BE/curriculum/{learner.service.ts,rules.ts}`, `BE/practice/rules.ts`. Tests: T1 and T5 pupils both get subjects with counts. Verify: V-STD as T1 and T5. DoD: DoD-T + AC-X3-1.
- Data/API: DM-16, DM-20; API-DSKP-01
- Also uses: API-PRAC-01 (owned by another card; read or verified here, not an ownership claim)

**S4-T07 Kurikulum admin UI** · P0 (C-01) / P1 (C-02) · M · Type: Complete · deps: S4-T02
- Starts from (existing): `src/modules/m03-curriculum/pages/CurriculumBrowserPage.vue`.
- PRD: R1-ADM-C-01, R1-ADM-C-02 (incl. FR-ADM-C01.6: Tingkatan 1-3 chapters created by the admin, U-OP-15). Approach: Bab/Topik/SP CRUD, DSKP tab with loader report, responsive. Files: `m03-curriculum/pages/{Chapter*,Topic*Create*,Topic*Edit*,Subject*,CurriculumBrowserPage}.vue`. Tests: specs. Verify: V-STD vs V2 `/admin/curriculum`. DoD: DoD-T.
- Data/API: DM-18; API-DSKP-03, API-DSKP-04
- Also uses: DM-41 (owned by another card; read or verified here, not an ownership claim)

**S4-T08 UAT data-operations pack** · P0 · M · Type: Ops · deps: S4-T02..T05
- Starts from (existing): `docs/ops/dskp-loader.md`, `docs/ops/r1-operator-checklist.md`.
- Data/API: DM-41
- Also uses: DM-12, DM-17, DM-19, DM-22 (owned by another card; read or verified here, not an ownership claim)
- New requirements (45, 46, 48; D113): FR-QA-43; AC-QA-43.
- Verification and report scripts for U-OP-01..U-OP-17 under `apps/api/scripts/uat-ops/` each with `--dry-run` default, a report file, idempotence. The operations are run by the designated UAT developer (OPS) or by ADMIN users in the UI (ADM), never by an AI session (D95, D110); the runbook in §7 is the human side. Tests: dry-run unit tests in CI. Verify: on UAT, dry-run then (after the user's approval) real run, in order. DoD: DoD-T.

**S4-T09 DSKP structure for T1-T3 and for every SPM subject offered** · P1 · M · Type: Ops · deps: S4-T07 (user decision D109; not blocked)
- Starts from (existing): `docs/reference/dskp`, `docs/ops/dskp-loader.md`.
- D112(3) scope extension: this card ALSO loads the DSKP structure for EVERY SPM subject offered that has no `curriculum_node` rows yet (Kimia, Biologi, Geografi, Perniagaan, Prinsip Perakaunan, Ekonomi and any other), from the official KPM DSKP documents, in the same structure as D109 (Tingkatan, Subjek, Bab, SK, SP, TP) and the same JSON format, audit and checksum copy (FR-ADM-C04.5; AC-ADM-C04.3, AC-ADM-C04.4). The loader report lists each offered subject and Tingkatan as `dimuatkan` or `belum dimuatkan` (U-OP-01). Until a subject is loaded, SP and TP are required at publish only where nodes exist (FR-ADM-C04.6, enforced by S1-T02) and no Kontrak can be created for it (FR-ADM-Q16.7, enforced by S3-T01). The sector lead re-estimates the size at sprint planning, since the official documents of several subjects are added to the T1-T3 work.
- PRD: FR-ADM-C04.3, FR-ADM-C04.5, FR-ADM-C04.6, FR-ADM-C04.7, R1-ADM-C-04, FR-ADM-C01.6, D101. The repo has T4-T5 extracts only. Decision D109: T1-T3 use the same DSKP structure as T4-T5 (Tingkatan, Subjek, Bab, SK, SP, TP). Build the T1-T3 content from the T1-T3 chapter and topic data that already exists in V3/UAT (and V2), mapped into that structure, plus any T1-T3 PDF supplied outside the repo. The official T1-T3 PDFs are not a prerequisite. Write it in the JSON format of `docs/reference/dskp/*.json` (`level` T1/T2/T3), run the loader dry-run, then U-OP-01 for T1-T3 (the user approves the UAT write). Bab stays required only where the subject and Tingkatan have chapters (N-3).
- Data/API: API-DSKP-05
- Also uses: DM-14 (owned by another card; read or verified here, not an ownership claim)
- Files: `docs/reference/dskp/**`, `apps/api/src/modules/curriculum/dskp/data/**`. Tests: loader tests with a T1-T3 fixture. Verify: V-STD; T2 pupil sees subjects and Bab. DoD: DoD-T + AC-ADM-C04.*.

### 4.S5 Murid learning, account, content

**S5-T01 T1–T3 pupils get practice (FE)** · P0 · M · Type: Fix · deps: S4-T06
- Starts from (existing): `src/lib/lower-form.ts`, `src/modules/m05-practice/pages/ChapterIndexPage.vue`, `src/modules/m05-practice/pages/PracticeListPage.vue`, `src/modules/m03-curriculum/pages/TopicsPage.vue`, `src/modules/m03-curriculum/pages/LearningMapPage.vue` (10 section 4.11 items 1 to 5; this card is their only owner; S5-T12 reuses the cleaned pages and does not repeat the removal).
- PRD: FR-X3-3, AC-X3-1, D101, FR-MUR-16-13, AC-MUR-16-9 (verified on this PR; the backend half is S4-T06), OQ-MUR-1 (**superseded by D101**). Gap: `src/lib/lower-form.ts:9` ("Kandungan untuk Tingkatan anda akan datang…") used by `ChapterIndexPage.vue`, `PracticeListPage.vue`, `TopicsPage.vue`, `LearningMapPage.vue`. Approach: delete `lower-form.ts` and its uses; per-subject empty state only. Files: those pages, `m05-practice/mock/datasets/prime.ts` (only the lower-form copy is removed so the demo build matches; no new mock code), tests. Tests: T1 pupil spec. Verify: V-STD as T1 and T5 (375/768/1280). DoD: DoD-T + AC-X3-1.
- Data/API: none
- Also uses: API-PRAC-01, DM-20 (owned by another card; read or verified here, not an ownership claim)
- New requirements (45, 46, 48; D113): AC-PA-36 clause (a) only (Latih Tubi, Soalan by Chapter, Topik and Peta Belajar pages as for T5; clauses (b) Databank and the Bijak list are S3-T07's and (c) Set Soalan is S5-T11's, table 4.0 E). Test accounts: the T1 pupil of AC-X3-1 and AC-MUR-16-6 is created by U-OP-12 (with the T5, T4 and T2 pupils).
- Modes (50 DM-44, 40 OPT-MODE-SESI): the R1 Latih Tubi screens of this card start a session with mode `latih_tubi` only (the master table "Pupil activity → stored `mode` → API → card" in 40 (after X11.3)); the registry has 19 values = 16 writable + 3 legacy read-only (`past_year`, `ramalan`, `random`), and no R1 screen writes a legacy value.

**S5-T02 Soalan by Chapter** · P0 · M · Type: Complete · deps: S4-T03, S8-T02
- Starts from (existing): `src/modules/m05-practice/pages/ChapterIndexPage.vue`, `src/modules/m05-practice/pages/ChapterSubjectPage.vue`.
- PRD: R1-MUR-9 (all ACs), R1-GUR-9 (teacher view of the same screens), FR-MUR-QP-13. Gap: UAT "Tiada subjek bab tersedia untuk tahap ini"; V2 prints a 70% unlock sentence under 14 subject cards with chapter counts; D98 and the SRS remove the rule and the sentence (every chapter is open, no lock, no 70% copy; FD-MUR-15, OQ-API-11). Approach: subjects/chapters from Bab mapping, every chapter open, no 70% rule or copy; groups shown once. Files: `m05-practice/pages/Chapter*.vue`, `BE/practice/**`. Tests: spec that Bab 2 opens with Bab 1 unanswered and no text mentions 70%. Verify: V-STD vs V2 `/soalan-by-chapter`, on UAT data. DoD: DoD-T.
- Data/API: API-GUR-08, API-PRAC-05
- New requirements (45, 46, 48; D113): AC-PA-02 clause (b) Soalan by Chapter.
- New requirements from the audit (this card owns them): AC-MUR-9-9 (a question approved through the Studio wizard with a Bab appears in Soalan by Chapter on the next load).

**S5-T03 Latih Tubi** · P0 · M · Type: Fix · deps: S1-T06, S1-T07, S1-T02, S8-T02, S5-T15, S5-T01, S4-T06
- Starts from (existing): `src/modules/m05-practice/pages/PracticeConfigPage.vue`, `apps/api/src/modules/practice/start.planner.ts`.
- Dependencies explained: S5-T01 and S4-T06 because the ACs need a T1 to T3 pupil who can practise (D101, 46 section 4.8); S7-T05 is deliberately NOT a dependency (L-8, see the coin-rate line below).
- PRD: R1-MUR-16, FR-MUR-QP-6, FR-MUR-QP-7, FR-MUR-QP-13. Gap: figure-less items served on UAT; figures and whole groups served (D105). Approach: use S1 servability; counts per D91; the difficulty filter reads `difficulty_level` (DM-47, S1-T02) and a row without it is read as `least(5, difficulty_tp)`; config page copy exact. Files: `m05-practice/pages/{PracticeConfigPage,PracticeListPage,PracticeQuizPage}.vue`, `BE/practice/{start.planner.ts,rules.ts}`. Tests: no stimulus-less item in 200 draws. Verify: V-STD, T5 on UAT data. DoD: DoD-T + AC-MUR-16-*.
- Data/API: API-PRAC-01, API-PRAC-02, API-PRAC-04, API-PRAC-03
- Free-trial rule (existing, kept unchanged, no new card): the Latih Tubi start call `POST /api/practice/sessions` (API-PRAC-01, this card) keeps the free-trial limit stated in 10-murid R1-MUR-16 (50 checked answers, `TRIAL_EXHAUSTED`, 402 ERR-PRAC-01 "Baki percubaan percuma anda telah habis."); this card verifies it and adds no new quota rule.
- Also uses: DM-27 (owned by another card; read or verified here, not an ownership claim)
- New requirements (45, 46, 48; D113): FR-PA-01, 03, 11..13, 15, 26, 31; AC-PA-02 clause (a) Latih Tubi, 12, 13, 15, 24; FR-GM-20.3; AC-GM-20.2, AC-GM-20.5 (the pupil path and rate of Misi Harian; the teacher validation and cap FR-GM-20.1, 20.2, AC-GM-20.1, 20.3, 20.4 are S6-T07).
- Misi Harian rate (B-10): this card is the ONLY card that removes `MISSION_COINS_PER_CORRECT = 3` (`practice/rules.ts:50`, its use at `rules.ts:61`, `start.planner.ts:317`, `ports.ts:133`, and the mock copies `m05-practice/mock/datasets/pins.ts`, `mock/repository/start.ts`, `mock/repository/practice.ts`), replacing it with a reader of `reward_settings.coins_per_correct` that returns the default 1 when the table or the row does not exist yet (S7-T05 creates the table later). S6-T07 and S7-T05 do not touch that constant.
- Answer store (D-A1, DM-44, owned by S5-T15; the master table "Pupil activity → stored `mode` → API → card" in 40 (after X11.3)): check-answer writes `mode` of the session (existing path, moved behind the port). The Syiling credit reads `reward_settings.coins_per_correct` (DM-48, default 1, range 0..20; S7-T05 owns it); until S7-T05 merges, or when no `reward_settings` row exists, the rate is read as the default 1 (L-8; this card does not wait for S7-T05, so Slice 0 needs no S7-T05); the old per-answer constant 2 in the PRD text is dropped. Session start: every Latih Tubi session of the R1 screens starts with mode `latih_tubi` only; no R1 screen starts a session with the value `random`, and `POST /api/practice/sessions` rejects `mode: "random"` with 422 (ERR-REQ code; the stored value is legacy only). The abandoned-session sweeper (a 2 h idle session becomes `abandoned`, DM-66) is NOT built here: S5-T15 owns it alone (L-7); this card only reads the status (the session list excludes `abandoned`). Writes go through the one `AnswerLogPort` of `practice/`; no second answer table, no report reads anything else.

**S5-T04 Dashboard murid** · P1 · M · Type: Complete · deps: none
- Starts from (existing): `src/modules/m05-practice/pages/DashboardPage.vue`.
- PRD: R1-MUR-2. Gap: missing Pakej SPM Aktif, Kombo, Cabaran Kilat, Soalan Terkini (mood hidden OQ-MUR-10; mascot/carousel hidden OQ-MUR-3). Files: `m05-practice/pages/DashboardPage.vue`, `BE/practice/reads/overview/**`. Tests: component. Verify: V-STD vs V2 `/dashboard`. DoD: DoD-T.
- Data/API: API-MUR-01
- Also uses: DM-35 (owned by another card; read or verified here, not an ownership claim)

**S5-T05 Profil, Tetapan, Panduan for all roles** · P1 · L · Type: Build · deps: none
- Starts from (existing): `src/modules/m01-authentication/routes/profile.ts`, `src/modules/m09-content/pages/PanduanPage.vue`.
- New files: `src/modules/m01-authentication/pages/ProfileAccountPanel.vue`, `src/modules/m01-authentication/pages/ProfileAspirationField.vue`, `apps/api/src/modules/account/config.controller.ts` (`GET /api/config/support`), `apps/api/prisma/migrations/0184_s5_user_aspiration/migration.sql` (requested with `needs:schema`; the table is S0's identity file).
- PRD: R1-MUR-AUTH (shared login, register and reset screens; the screens are `src/modules/m01-authentication/pages/**`, an S0 folder, so those edits are small PRs to S0), R1-MUR-A1, R1-MUR-A2, R1-MUR-A3, R1-GUR-A1, R1-GUR-A2, R1-GUR-A3 (all roles), R1-AS-A5, R1-ADM-N-07 (support contact read by Panduan); register 6.2b rows 7, 19. Gap: `PUT /api/me` lets a pupil change `grade` and `schoolId` (`apps/api/src/modules/account/profile.service.ts:157-158`; fix per API-AUTH-09, AC-MUR-A2-6, FR-AS-51-9: delete both writes, ignore `grade`, `schoolId` and `role` for every role); pupil profile minimal; no public profile; `/guru/profil/edit` has no route (`m10-teacher-class/components/dashboard/copy.ts:91`); account block missing; `GET /api/config/support` 404 on UAT. Files: `m01-authentication/pages/Profile*`, `routes/{profile,tetapan}.ts`, `m09-content/pages/PanduanPage.vue`, `BE/account/**`, `BE/support/` config route (S7 review), `CT/account`. Tests: per-role specs. Verify: V-STD for pupil, guru. DoD: DoD-T.
- Data/API: DM-33, DM-80; API-AUTH-08, API-AUTH-09, API-AUTH-10, API-AUTH-11, API-AUTH-12, API-GUR-22, API-MUR-02, API-MUR-03, API-SUP-04, API-AUTH-06, API-AUTH-07, API-ADM-04
- New requirements from the audit (this card owns them): FR-MUR-A2-6, AC-MUR-A1-7, AC-MUR-A2-5, AC-MUR-A2-6 (`PUT /me` ignores grade, school and role), AC-MUR-A3-4.
- Scope hole (D-A15): `PUT /api/me` ignores `grade`, `schoolId` and `role` for every role (API-AUTH-09, exact defect `profile.service.ts:157-158`).

**S5-T06 Laporan Soalan (pupil)** · P0 · M · Type: Fix · deps: S0-T05
- Starts from (existing): `src/app/prototype-scope.ts`, `src/modules/m04-question-bank/pages/LaporanSoalanPage.vue`.
- PRD: R1-MUR-54, D98, OQ-MUR-15. Gap: hidden by `prototype-scope.ts`; `my-reports.ts` exists; `/laporan-soalan` redirects to Dashboard. Approach: menu item under the V2 "Killer Features" heading, list with counts Jumlah/Menunggu/Disemak/Diperbaiki/Ditolak, report dialog in every quiz; daily cap 20 (OQ-API-06). Files: `m04-question-bank/pages/LaporanSoalanPage.vue`: **S2 owns it**, so the pupil route/page lives in `m05-practice/pages/LaporanSoalanSayaPage.vue` (new); BE reuse `question reports` via S1 contract. Tests: submit → appears. Verify: V-STD vs V2 `/laporan-soalan`. DoD: DoD-T + AC-MUR-54-*.
- Data/API: DM-82; API-Q-19, API-Q-20

**S5-T07 Remedial auto-generated** · P1 · M · Type: Complete · deps: S10-T01
- Starts from (existing): `src/modules/m05-practice/pages/RemedialListPage.vue`.
- PRD: R1-MUR-12. Gap: only assigned tests, V2 auto cards from weak subjects. Files: `m05-practice/pages/Remedial*.vue`, `BE/practice/**`. Tests: weak subject 0% → card. Verify: V-STD. DoD: DoD-T.
- Data/API: API-PRAC-06, API-PRAC-07, API-PRAC-08

**S5-T08 Video and Kelas Saya (pupil) and Video admin list** · P1 · M · Type: Build · deps: none
- Starts from (existing): `src/modules/m09-content/pages/VideoListPage.vue`, `src/modules/m10-teacher-class/pages/KelasSayaPelajarPage.vue`.
- New files: `src/modules/m09-content/pages/AdminVideoListPage.vue`, `apps/api/prisma/migrations/0183_s5_video_school_visibility/migration.sql`.
- PRD: R1-MUR-7, R1-MUR-8, R1-GUR-7, R1-AS-7, R1-ADM-N-01. Gap: no admin list for Video (BE ready); "Tambah Video" pupil rule OQ-MUR-11 (hide). Files: `m09-content/pages/Video*.vue`, new `AdminVideoListPage.vue`, `m10-teacher-class/pages/KelasSayaPelajarPage.vue`, `BE/content/videos/**`. Tests: spec. Verify: V-STD. DoD: DoD-T.
- Data/API: DM-76; API-MUR-04, API-MUR-05
- Follow V2 (OQ-X-3): remove the pupil "Sertai" box and `POST /kelas-saya/join` (API-MUR-04); classmates are shown by display name only (60 section 4.6).

**S5-T09 Perutusan, Artikel, Banner, Nota** · P2 · M · Type: Complete · deps: none
- Starts from (existing): `src/modules/m09-content/pages/BannerListPage.vue`, `src/modules/m09-content/pages/AdminArticleListPage.vue`.
- PRD: R1-ADM-N-02, R1-ADM-N-03, R1-ADM-N-04, R1-ADM-P2-18 (complete Artikel/Banner/Nota/Video forms, D9 fixes); register 6.2b row 14 (`/perutusan` dead link for AS Dashboard). Files: `m09-content/pages/**`, `BE/content/{articles,banners,notes,perutusan}/**`. Tests/verify/DoD standard.
- Data/API: API-ADM-07, API-MUR-06, API-MUR-07, API-MUR-08

**S5-T10 Shell and Log Keluar (all roles)** · P0 · S · Type: Fix · deps: S0-T06
- Starts from (existing): `src/shells/nav/user-nav.ts`.
- PRD: R1-MUR-A5 (P0), R1-GUR-A5, R1-AS-A5; FR-MUR-SH-1..4, AC-MUR-SH-1..4; FR-SH / AC-SH-1..5 (20). Header pills show the pupil's own wallet values from the server (SH-4); one list for sidebar, drawer and "Cari menu" (SH-3).
- Data/API: API-AUTH-01, API-AUTH-02
- Files: `src/shells/**` pill/search code (S0 owns; one PR to S0, reviewed by S5), logout in `src/modules/m01-authentication/**` (S0). Tests: logout spec per role, header pill spec. Verify: V-STD for 3 roles. DoD: DoD-T + AC-MUR-A5-*, AC-MUR-SH-*.

**S5-T11 Soalan Berstruktur and Set Soalan Guru (pupil)** · P1 · M · Type: Complete · deps: S3-T06, S6-T14, S6-T10, S5-T08, S5-T15, S10-T01, S10-T07, S9-T06 · Delivery A (linked from R1-MUR-13, R1-MUR-2, R1-MUR-8)
- Starts from (existing): `src/modules/m05-practice/pages/StructuredListPage.vue`, `src/modules/m05-practice/pages/StructuredAnswerPage.vue`, `src/modules/m05-practice/pages/QuestionSetQuizPage.vue`, `apps/api/src/modules/classes/question-sets/` (S1 path: the 404 for an unassigned class and the DM-46 query of API-GUR-15 are a small cross-sector PR to S1, `Cross-sector: S1 (question-sets feed)`, `needs:S1`).
- New files: `e2e/r1/chains/chain-4.http.spec.ts` (the chain spec; helper `helpers.ts` landed by S9-T06 in Sprint 1). The dependencies S5-T15, S10-T01 and S10-T07 are the pupil, teacher and school-admin Prestasi screens that chain 4 asserts (the row of the chain table in 40 X9); the screen that shows Penyertaan and Skor Purata is the results page of S6-T14.
- Screen ownership (with S3-T06): this card owns the pupil screens of B5 Soalan Berstruktur (`/latihan-berstruktur*`, 46 section 4.6; the entry page `/spm/subjektif` is S3-T07) and of Set Soalan Guru; it reuses `SelfMarkControl.vue` and the Semakan view of S3-T06 (B6 Kertas Subjektif, `/kertas-subjektif*`) and builds no second self-mark control.
- Chain spec (D-T10-5): this card is the last card of AC-CHAIN-4, so it also writes `e2e/r1/chains/chain-4.http.spec.ts` (an S0-owned folder: a small cross-sector PR with the line `Cross-sector: S0 (chain spec)` and the label `needs:S0`, S0 reviews within 1 working day); S9-T06 runs and maintains it.
- PRD: R1-MUR-17 (every ID, table 4.0 E; S3-T06 proves the Kertas Subjektif side), R1-MUR-26 (D106), the Soalan Berstruktur half (kind `structured`) of FR-MUR-13-19 and AC-MUR-13-24, AC-PA-36 clause (c) Set Soalan. Gap: built with seed sets only; answer screen must follow 4.6 (parts tree, modes, autosave), scheme and self-mark. Files: `m05-practice/pages/{StructuredListPage,StructuredAnswerPage,QuestionSetQuizPage}.vue`, `BE/practice/**`. Tests: structured set end to end; teacher publishes a set (S6-T14), pupil of that class sees it, another class gets 404. Verify: V-STD per module against the SRS description of the PRD modules on this card's "PRD:" line (screen layout, exact BM copy and states are written in words there; §0A). DoD: DoD-T + every AC of the listed modules.
- Data/API: API-GUR-15, API-PRAC-10
- New requirements (45, 46, 48; D113): FR-PA-25; AC-PA-14.
- New requirements from the audit (this card owns them): AC-MUR-26-5.
- Answer store (D-A1, DM-44, owned by S5-T15; the master table "Pupil activity → stored `mode` → API → card" in 40 (after X11.3)): Set Soalan sessions write `mode = question_set`; the Soalan Berstruktur answer screen (R1-MUR-17, API-PRAC-10) writes `mode = structured` and API-PRAC-10 creates an `exam_attempts` row of kind `structured` (the Kertas Subjektif of S3-T06 is kind `subjektif`; the self-mark route API-BIJAK-05 serves both kinds); there is no `structured_attempts` table and no result table of its own. The type is Complete (R1-MUR-26 is a Fix module; the card Type is the higher of its modules). The OPT-ARAS-KBAT option set is used for the aras filter. A pupil sees only sets assigned to a class they are enrolled in (DM-46); another class gets 404. Writes go through the one `AnswerLogPort` of `practice/`; no second answer table, no report reads anything else.

**S5-T12 Artikel, Topik, Peta Belajar, Audio KBAT (pupil)** · P1 · L · Type: Complete · deps: S4-T03, S5-T01 · Delivery A (R1-MUR-20) / B (rest)
- Starts from (existing): `src/modules/m03-curriculum/pages/TopicsPage.vue`, `src/modules/m09-content/pages/ArtikelListPage.vue`.
- PRD: R1-MUR-20, R1-MUR-24, R1-MUR-25, R1-MUR-27, R1-ADM-P2-17 (Audio KBAT admin, verify built), FR-MUR-24-4. Gap: Topik/Peta Belajar "akan datang" gate (`TopicsPage.vue:32,50-53`, `LearningMapPage.vue:30,50-53`; removed by S5-T01, not repeated here), UAT topic tree empty; Artikel is linked from the Dashboard so it ships in Delivery A. Files: `m09-content/pages/Artikel*.vue`, `m03-curriculum/pages/{TopicsPage,LearningMapPage,TopicDetailPage}.vue`, `m09-content/pages/AudioKbat*.vue`. Tests: per module. Verify: V-STD per module against the SRS description of the PRD modules on this card's "PRD:" line (screen layout, exact BM copy and states are written in words there; §0A). DoD: DoD-T + every AC of the listed modules.
- Data/API: API-PRAC-11
- Also uses: DM-16 (owned by another card; read or verified here, not an ownership claim)

**S5-T13 PKSK (pupil) answering flow** · P1 · L · Type: Complete · deps: S0-T05 · Delivery B
- Starts from (existing): `src/modules/m07-pksk/routes.ts`.
- PRD: R1-MUR-19 (+ FR-MUR-19-2: the V2 listing-only page is completed, FD-MUR-31), R1-ADM-Q-25 (the admin `Soalan PKSK` screen `/admin/pksk/questions`: list, add, edit, approve and reject PKSK questions, outside the stimulus-group, DSKP, Bab, TP and Kesukaran rules; the screen is the pupil flow's content feed). Gap: listing only; locked without grant. Ownership of `m07-pksk` and `BE/pksk` moves from S0 to S5 for this card (CODEOWNERS App. C updated). Files: `src/modules/m07-pksk/**`, `apps/api/src/modules/pksk/**`, `CT/pksk`. Tests: grant/no-grant/expiry. Verify: V-STD per module against the SRS description of the PRD modules on this card's "PRD:" line (screen layout, exact BM copy and states are written in words there; §0A). DoD: DoD-T + every AC of the listed modules.
- Data/API: API-ADM-18, API-PRAC-12

**S5-T14 Admin Sekolah Profil, Tetapan, Panduan** · P2 · S · Type: Complete · deps: S5-T05 · Delivery B
- Starts from (existing): `src/modules/m09-content/pages/PanduanPage.vue`.
- PRD: R1-AS-A1, R1-AS-A2, R1-AS-A3 (same screens as S5-T05 for the school-admin shell; AS-A4 is S7-T10). Files: `m01-authentication/pages/Profile*`, `m09-content/pages/PanduanPage.vue`. Tests: per role. Verify: V-STD per module against the SRS description of the PRD modules on this card's "PRD:" line (screen layout, exact BM copy and states are written in words there; §0A). DoD: DoD-T + every AC of the listed modules.
- Data/API: none

**S5-T15 Single answer store: mode column and write path** · P0 · M · Type: Complete · deps: S0-T02
- Starts from (existing): `apps/api/src/modules/practice/practice.repository.ts`, `apps/api/src/modules/practice/practice.service.ts`, `apps/api/prisma/schema/practice.prisma`
- New files: `apps/api/src/modules/practice/answer-log.port.ts`, `apps/api/src/modules/practice/session-sweeper.job.ts` (the abandoned-session sweeper, run by the existing jobs worker), `apps/api/prisma/migrations/0181_s5_answer_store_mode/migration.sql`, `apps/api/prisma/migrations/0182_s5_session_abandoned/migration.sql`, `apps/api/scripts/uat-ops/backfill-bijak-answers.ts` (the dry-run-by-default backfill of past Bijak attempts into `practice_answers`, DM-44; run on UAT by the designated UAT developer before the first Prestasi acceptance walk).
- PRD: FR-X4-1, XS-8. Gap: reports (`reports/analytics`, `reports/kirkpatrick`, `heatmap`, `command-center/board`) read only `practice_answers`, whose session modes are 10 values (`0014_practice_write`), while Bijak writes `exam_attempts`/`practice_attempt_aggregates` (`bijak/integration/performance-bijak-aggregate.ts`); Databank, Tracking A, Subjektif and Kuiz therefore never reach Prestasi, Headcount AR or Analisa Item (audit F-02, D-A1).
- Data/API: DM-44, DM-66
- Also uses: API-PRAC-01, API-PRAC-02, API-PRAC-10, API-BIJAK-04, API-BIJAK-05, API-GAME-01 (owned by another card; read or verified here, not an ownership claim); the readers of this store (R1-MUR-4 Prestasi, R1-MUR-6 Analisa Item, R1-GUR-3 Auto AR) are implemented by the S10 cards, not here.
- New requirements (45, 46, 48; D113): FR-PA-13, 23, 28; AC-PA-01, 23.
- Approach: add `mode`, `attempt_id`, `part_ref`, `marks_awarded`, `marks_max`, `is_test` (boolean, default false; set from `entry.isTest`, which is true for a Mod Pelajar session, INV-30) to `practice_answers` (migration `0181_s5_answer_store_mode`, nullable first, backfill `mode` from the session, then NOT NULL and the check), and one internal `AnswerLogPort` (file `answer-log.port.ts`), whose single signature is defined in 60 section 2.17.5 and copied here verbatim: `record(entry: { userId, attemptId, questionId, partRef, mode, isCorrect, marksAwarded, marksMax, answeredAt, isTest })`, returning `Promise<{ id: string; created: boolean }>`; idempotency key (`attempt_id`, `user_id`, `question_id`, `part_ref`) (the DM-44 unique index; a null `part_ref` reads as `''`); `mode` is one of the 16 writable values of the master table "Pupil activity → stored `mode` → API → card" in 40 (after X11.3) (OPT-MODE-SESI); a second `record` with the same key updates the row and returns `created: false`, never adds one (INV-33); a write with a `mode` outside the 16 writable values (`past_year`, `ramalan`, `random` are legacy) is refused by the port before the database check; the port reads the served question version itself and copies subject, level, Bab and difficulty at write time; the existing practice check-answer path now calls it; for a drill session `attemptId` is the session id, so the same unique index covers drill rows, and `marksMax` is null for an MCQ; expose the port to Bijak, Subjektif, Set Soalan and the games (their cards call it, 50 section 4.7a registry). The past-Bijak backfill script `apps/api/scripts/uat-ops/backfill-bijak-answers.ts` (this card owns it, a file in the S4-owned `uat-ops/` folder named on the `New files:` line) is dry-run by default. No new endpoint; no report is rewritten here (S10 and S6 read the same table).
- Files: `SCH/practice.prisma`, `BE/practice/{practice.repository.ts,practice.service.ts}` plus new `BE/practice/answer-log.port.ts` (named here), `CT/practice`; this card does not touch `BE/bijak/` (S3-T04 calls the port from the submit route); migrations `0181_s5_answer_store_mode` and `0182_s5_session_abandoned` (DM-66: `practice_sessions.status` adds `abandoned`, shown "ditinggalkan"; a sweeper moves a session idle 2 h to it, no reward). **Sole owner of the sweeper (L-7):** this card builds and tests `session-sweeper.job.ts` (written in `practice/`, registered in the S0-owned `jobs/` worker by a one-line cross-sector PR to S0, `Cross-sector: S0 (jobs registration)`) (a swept Kuiz session writes rows for its checked questions with no reward, D-PA-15); S5-T03 and S3-T04 only read the status.
- Tests (port level only; this card cannot wait for its readers): port unit tests with synthetic entries of every writable mode (Bijak, Subjektif, game, drill) and a repeat `record` that updates and returns `created: false`; `isTest` stored; a mode outside the 16 writable values refused; a lint-style test fails when a module inserts into `practice_answers` without the port. The cross-card proofs are not this card's: the Bijak resubmit is S3-T04's, AC-XS-4 (10 Latih Tubi + 40 Bijak = 50 on every screen) is S10-T01's and S6-T03's, and AC-CHAIN-1, 3, 4 are proven by the chain specs of their last cards.
- Verify: V-STD on the port tests. DoD: DoD-T.

### 4.S10 Performance and analytics (m08), all roles

**S10-T01 Prestasi 360 (pupil own data)** · P0 · M · Type: Fix · deps: S0-T06, S5-T15
- Starts from (existing): `src/modules/m08-student-performance/pages/Prestasi360Page.vue`, `src/modules/m08-student-performance/routes/prestasi.ts` (the route `/prestasi/:userId` is declared in `routes/analitik.ts`; find it by the path), `apps/api/src/modules/reports/performance/domain/access-policy.ts`, `apps/api/src/modules/reports/performance/domain/privacy.ts` (S10 files on the path of FR-MUR-4-2 and FR-X4-4; card ownership rule b of section 0B).
- PRD: R1-MUR-4 (all ACs, including FR-MUR-4-13, FR-MUR-4-14 and AC-MUR-4-9), FR-X4-4. Gap: pupil `Prestasi` → "Dashboard Sekolah" (school-wide data leak): `src/modules/m08-student-performance/routes/prestasi.ts:18` (`student` in `PRESTASI_SCHOOL_ROLES`), redirect `/prestasi → /prestasi/sekolah`; `/prestasi/:userId` exists unused. Approach: pupil route renders own Prestasi 360; BE rejects school-wide for student (`BE/reports/performance/domain/access-policy.ts`, `privacy.ts`). Files: those + `pages/**`. Tests: pupil gets 403 on school endpoint; own data ok. Verify: V-STD vs V2 "Prestasi Saya". DoD: DoD-T + AC-MUR-4-*.
- Data/API: API-RPT-01, API-RPT-02
- New requirements (45, 46, 48; D113): FR-PA-27; AC-PA-25.
- New requirements from the audit (this card owns them): FR-MUR-4-12, AC-MUR-4-8, AC-X4-1 (pupil side). AC timing (AC-MUR-4-8, which needs Bijak and Battle rows): in CI it is proven on fixture rows of mode `simulasi` and `battle` inserted through the S5-T15 port test double `[CI]`; on UAT it is `[UAT]`, run after the writer cards S3-T04 (`simulasi`) and S7-T01 (`battle`) have merged and been deployed; the card closes its CI part in Sprint 1 and the UAT row is written then.
- Metrics (D-A10, D-T10-1): Ketepatan is pooled (correct ÷ answered × 100) over `practice_answers` of all modes, XS-4/5/7 (60 section 4.6); API-RPT-01 and API-RPT-02 return it as a JSON number rounded to ONE decimal (decision 11: a whole value such as 50 or 100 is returned without a fraction, never with a second decimal digit) and the screen shows the whole number rounded half up (40 XS-5); Bijak sittings appear as one unit in the session list and in the counts via the single answer store.

**S10-T02 Headcount (backend rules for all roles, teacher screens)** · P0 · L · Type: Complete · deps: S0-T05, S5-T15
- Starts from (existing): `src/modules/m08-student-performance/pages/HeadcountShellPage.vue`, `src/modules/m08-student-performance/routes/headcount.ts`.
- PRD: R1-GUR-3; register rows 4, 11 (teacher part). The pupil read view and the school-admin list are S10-T09, which depends on this card. Gap: pupil `/headcount` 403 (role map in `routes/headcount.ts`), guru sub-pages are shells (`headcount.ts:69-92` → `pages/HeadcountShellPage.vue`), AS list empty because scope = own config only (`headcount.service.ts:114,121`, per gap `headcount.ts:47-60`). Approach: the backend rules and routes for the three roles (the Data/API line) and the teacher screens: Key-in AR, Edit TOV/ETR, Unjuran, Tetapan working. Files: `m08-student-performance/{routes/headcount.ts,pages/Headcount*,components/**}`, `BE/reports/performance/**`, `CT/reports/performance*`. Tests: teacher spec and BE tests for the three roles. Verify: V-STD; headcount data for evidence E-1. DoD: DoD-T + AC-GUR-3-*.
- Data/API: DM-29, DM-49; API-AS-15, API-RPT-08, API-RPT-09, API-RPT-10, API-RPT-16
- Also uses: DM-28 (owned by another card; read or verified here, not an ownership claim)
- New requirements from the audit (this card owns them): FR-GUR-3-8 (HC-SPEC is the only definition), FR-GUR-3-9 and AC-GUR-3-13 ("Simpan Sasaran" saves the teacher's default TOV/ETR), AC-GUR-3-1..13.
- One computation (D-A3): implement HC-SPEC of 20 R1-GUR-3 once (Auto AR = round(correct / answered * 100) over `practice_answers`, all modes; one "On Track" rule AR >= OTR_k of the latest checkpoint with an AR); pupil, teacher, school-admin, Prestasi and Dashboard call the same rules (the pupil and school-admin screens are S10-T09). "Simpan Sasaran" = `PUT /api/headcounts/:id/defaults` (API-RPT-16, DM-49, migration `0191_s10_headcount_defaults`).

**S10-T03 Analisa Item (pupil, guru, school admin)** · P0 · M · Type: Build · deps: S0-T05, S5-T15
- Starts from (existing): `src/modules/m08-student-performance/routes/analisa-item.ts`, `apps/api/src/modules/reports/performance/performance.controllers.ts` (the role removal of API-RPT-06 and the new route of API-RPT-05 are edits to this existing file), and, by a small cross-sector PR to S6 (`needs:S6`), the teacher file `src/modules/m11-teacher-analytics/routes/analisa-item.ts` and its pages.
- New files: `src/modules/m08-student-performance/pages/AnalisaItemMuridPage.vue` (pupil own-scope screen, API-RPT-05), `apps/api/src/modules/reports/performance/services/item-analysis-me.service.ts`.
- PRD: R1-MUR-6, R1-GUR-6, R1-AS-6 (this card owns every FR/AC of the three modules, including FR-GUR-6-9/10, FR-AS-6-6, AC-GUR-6-10/11, AC-AS-6-6, AC-MUR-6-7 and AC-MUR-6-8, and the only owner of API-RPT-07). Gap: pupil target missing in `analisa-item.ts:43` `analisaItemTarget`; guru band contradiction, unbound sort. Why Build: the pupil own-scope screen and its endpoint API-RPT-05 do not exist (Missing-Build); the teacher and school-admin parts are fixes inside the existing files named below. Files: `m08-student-performance/routes/analisa-item.ts`, `pages/**`, `BE/reports/performance/**`. Tests: per role. Verify: V-STD, E-2 evidence. DoD: DoD-T.
- Data/API: API-AS-17, API-RPT-05, API-RPT-06, API-RPT-07
- New requirements from the audit (this card owns them): AC-MUR-6-7, AC-MUR-6-8 (both need rows of several modes: proven in CI on fixture rows through the S5-T15 port test double, and on UAT after S3-T04 and S7-T01 have merged and deployed).
- New requirements from the audit (this card owns them): FR-GUR-6-8 and FR-AS-6-5 ("Soalan Diuji" = XS-7, counters of all modes), AC-GUR-6-8, AC-GUR-6-9, AC-AS-6-5.
- Metrics (D-A10, D-T10-1): "Soalan Diuji" = distinct questions (XS-7), "Cubaan/Betul/Salah" count all modes (XS-8); every accuracy or percentage returned by API-RPT-05..07 and API-AS-17 is a number with ONE decimal and shown as a whole number rounded half up (40 XS-5, 60 section 4.6); discrimination index uses the 27 percent upper and lower groups and needs at least 10 pupils with answers (FR-GUR-6-9, R1 decision D113; the teacher route file is `m11-teacher-analytics/routes/analisa-item.ts`, the gap text's `analisis-item.ts` is the same route, find it by the path).

**S10-T04 Analitik Adaptif (guru, school admin) and SP data** · P0 · M · Type: Complete · deps: S4-T03, S0-T06, S5-T15
- Starts from (existing): `src/modules/m08-student-performance/routes/class.ts`, `src/modules/m08-student-performance/pages/AnalitikKelasPage.vue`.
- PRD: R1-GUR-5, R1-AS-5 (P0), R1-MUR-5; DK rules (10-murid 4.10); register row 8. Gap: roles on class route (`routes/class.ts:33`) exclude `school_admin`; menu target wrong. Approach: `/analitik/kelas` for guru + AS; SP mastery from DSKP; hide "Rekod Intervensi" for AS (OQ-AS-5). Files: `m08-student-performance/routes/{class,analitik}.ts`, `pages/**`, `BE/reports/performance/**`. Tests: spec per role. Verify: V-STD vs V2 `/analitik/kelas`. DoD: DoD-T + AC-GUR-5-*, AC-AS-5-*.
- Data/API: API-AS-16, API-RPT-03, API-RPT-04
- Also uses: DM-19 (owned by another card; read or verified here, not an ownership claim)
- New requirements from the audit (this card owns them): FR-GUR-5-7 and FR-AS-5-6 (all modes, pooled accuracy), AC-GUR-5-7, AC-AS-5-5.

**S10-T05 Heatmap Topik Lemah** · P1 · S · Type: Fix · deps: S4-T03, S1-T01, S1-T02, S1-T07, S2-T01, S5-T02, S5-T03, S5-T15, S10-T01, S10-T03, S6-T03, S9-T06
- Starts from (existing): `apps/api/src/modules/heatmap/heatmap.service.ts`.
- New files: `e2e/r1/chains/chain-1.http.spec.ts` (the chain spec; helper `helpers.ts` landed by S9-T06 in Sprint 1). The extra dependencies are the other eleven cards of the chain-1 row of 40 X9 (question group to every report).
- Chain spec (D-T10-5): this card is the last card of AC-CHAIN-1, so it also writes `e2e/r1/chains/chain-1.http.spec.ts` (an S0-owned folder: a small cross-sector PR with the line `Cross-sector: S0 (chain spec)` and the label `needs:S0`, S0 reviews within 1 working day); S9-T06 runs and maintains it.
- PRD: R1-MUR-14, OQ-MUR-6. Gap: UAT empty. Approach: Bab first, SP tags second. Files: `BE/heatmap/**`, `CT/heatmap`. Tests: service. Verify: V-STD. DoD: DoD-T.
- Data/API: API-DSKP-08

**S10-T06 Remaining m08 modules real-API only** · P1 · M · Type: Fix · deps: S0-T09
- Starts from (existing): `src/modules/m08-student-performance/routes.ts`.
- PRD: FR-X2-0. Approach: for Prestasi (guru/AS), Kelas, Ranking, Timeline remove mock handlers in matrix paths. Files: `m08-student-performance/{api,mock}/**`. Tests: S0-T09 check green for m08. DoD: DoD-T.
- Data/API: none

**S10-T07 Prestasi (guru, school admin)** · P1 · M · Type: Complete · deps: S6-T03, S5-T15
- Starts from (existing): `src/modules/m08-student-performance/pages/PrestasiSekolahPage.vue`.
- PRD: R1-GUR-4, R1-AS-4. Gap: AS teacher count and numbers differ from other screens (XS rules); buttons Tingkatan/Kelas on Prestasi not click-tested. Files: `m08-student-performance/{routes/prestasi.ts,pages/**}`, `BE/reports/performance/**`. Tests: numbers equal Command Center (XS). Verify: V-STD per module against the SRS description of the PRD modules on this card's "PRD:" line (screen layout, exact BM copy and states are written in words there; §0A). DoD: DoD-T + every AC of the listed modules.
- Data/API: none
- Also uses: API-RPT-02, DM-28 (owned by another card; read or verified here, not an ownership claim)
- New requirements from the audit (this card owns them): FR-GUR-4-6 and FR-AS-4-6 (all modes from `practice_answers`, XS-8), AC-GUR-4-6, AC-AS-4-6, AC-AS-4-7.

**S10-T08 Timeline Saya (pupil)** · P2 · M · Type: Complete · deps: S7-T04 · Delivery B
- Starts from (existing): `src/modules/m08-student-performance/pages/TimelinePage.vue`.
- PRD: R1-MUR-39. Gap: V3 manual posts only; V2 automatic feed from sessions, badges, level-ups. Files: `m08-student-performance/routes/timeline.ts`, `pages/**`, `BE/reports/performance/**`. Tests: feed merge, privacy of public posts. Verify: V-STD per module against the SRS description of the PRD modules on this card's "PRD:" line (screen layout, exact BM copy and states are written in words there; §0A). DoD: DoD-T + every AC of the listed modules.
- Data/API: API-RPT-14, API-RPT-15

**S10-T09 Headcount: pupil and school-admin read views** · P0 · M · Type: Complete · deps: S10-T02, S0-T05
- Starts from (existing): `src/modules/m08-student-performance/routes/headcount.ts`, `src/modules/m08-student-performance/pages/HeadcountShellPage.vue`.
- PRD: R1-MUR-3, R1-AS-3 (this card owns every FR and AC of R1-AS-3: dashboard, `:id`, summary and export; S10-T02 owns none of it); register rows 4, 11 (pupil and school-admin parts). Gap: pupil `/headcount` answers 403 (role map in `routes/headcount.ts`); the school-admin list is empty because its scope is the own config only (`headcount.service.ts:114,121`). Approach: the pupil read view (TOV/OTR/AR/RS with the V2 empty text "Guru anda belum menyediakan headcount"; `/headcount` lists the pupil's configs and the detail takes the config id as `?configId=` on `/headcount/student/:ownId` and on `me/detail`; a pupil without an ETR sees the pill "Draft" and the line "Belum Ada Data", FR-MUR-3-10, AC-MUR-3-9 and AC-MUR-3-7 describe the same state) and the school-admin school-scope read-only list, both calling the rules and routes built by S10-T02. Files: `m08-student-performance/{routes/headcount.ts,pages/Headcount*,components/**}`. Tests: pupil and school-admin specs (a pupil sees only own rows). Verify: V-STD; headcount data for evidence E-1. DoD: DoD-T + AC-MUR-3-*, AC-AS-3-*.
- Data/API: none (this card owns no DM or API: API-RPT-08, API-RPT-09 and API-AS-15 are S10-T02's, built before this card)
- Also uses: API-AS-15, API-RPT-08, API-RPT-09, DM-29, DM-49 (owned by another card; read or verified here, not an ownership claim)
- New requirements from the audit (this card owns them): FR-MUR-3-9, FR-MUR-3-10, FR-MUR-3-11, AC-MUR-3-7, AC-MUR-3-8, AC-MUR-3-9, FR-AS-3-7, AC-AS-3-7.

### 4.S6 Guru, Admin Sekolah, Admin Pusat users/monitoring

**S6-T01 Laporan Mingguan Guru** · P0 · L · Type: Build · deps: S0-T06, S5-T15
- Starts from (existing): `src/modules/m11-teacher-analytics/routes/laporan-mingguan.ts`, `src/modules/m08-student-performance/pages/LaporanMingguanPage.vue` (nothing exists for the new part; it is added beside these files).
- New files: `src/modules/m11-teacher-analytics/pages/LaporanMingguanGuruPage.vue`, `src/modules/m11-teacher-analytics/api/weekly-report.ts`, `apps/api/src/modules/reports/performance/http/guru-weekly-report.controller.ts` (S10-owned folder: the cross-sector PR described in the approach), `packages/contract/src/reports/guru-weekly-report.ts` (`CT/reports/` is also S10-owned, so it travels in the same S10 PR).
- PRD: R1-GUR-43 (all ACs); register rows 1, 2. Gap: `m11-teacher-analytics/routes/laporan-mingguan.ts:12-27` renders `PrototypeUnavailablePage`; menu target wrong (`user-nav.ts:287`); `prestasi.ts:95-106` `roles: []`; `BE/reports/performance/services/weekly-report.service.ts:5-11` has no teacher API. Approach: new teacher API + screen per V2 `guru/laporan-mingguan.blade.php` (class picker, Cetak, Soalan Dijawab, Pelajar Aktif, Pelajar Meningkat, Subjek Perlu Perhatian, Pelajar Terbaik) at `/guru/laporan-mingguan-kelas`; the old path `/guru/laporan-mingguan` is a redirect to it (no second page), and the page calls API-GUR-21 `GET /api/guru/weekly-report` only (API-RPT-13 `GET /api/weekly-report` is the pupil and school-admin report and is not called by this page). Where it lives (decided): the page, route and API client are S6 paths (`src/modules/m11-teacher-analytics/pages/LaporanMingguanGuruPage.vue`, `src/modules/m11-teacher-analytics/api/weekly-report.ts`, the route in the existing `m11-teacher-analytics/routes/laporan-mingguan.ts`); the backend extends the ONE weekly-report service of S10 (`apps/api/src/modules/reports/performance/services/weekly-report.service.ts`, new method for API-GUR-21) and adds the route `GET /api/guru/weekly-report` in a new `apps/api/src/modules/reports/performance/http/guru-weekly-report.controller.ts`; no second weekly service is created. Those two backend files and the `roles: []` fix in `src/modules/m08-student-performance/routes/prestasi.ts:95-106` are S10-owned, so that part is a **cross-sector PR** per R1-START-HERE decision 7 (`Cross-sector: S10 (weekly-report service and prestasi route roles)`, label `needs:S10`, S10 reviews within 1 working day). Order (plan section 3, contract rule): (1) a small S10 contract PR with the file `packages/contract/src/reports/guru-weekly-report.ts`, merged first; (2) the S10 PR with the service method, the controller and the roles fix; (3) the S6 PR with the page, the API client and the route. The menu target (`user-nav.ts:287`) is S0-T06. A teacher with no class sees the empty select "Tiada kelas lagi" and zero tiles, and the page makes no API call. Thresholds ("< 50" and the like) compare the whole number obtained by rounding the one-decimal wire value half up (49.4 gives 49, 49.6 gives 50). AC-GUR-43-9 needs answers dated this week: the team creates them on UAT with a `UJI` pupil in the class "5 UAT" before the walk. Files: `m11-teacher-analytics/**`, `CT/reports/*` (contract PR first), plus the S10 files above. Tests: BE tests in `apps/api/src/modules/reports/performance/` (S10 PR) + spec `e2e/r1/` for the page (tests may be created beside the code they test). Verify: V-STD vs V2. DoD: DoD-T + AC-GUR-43-*.
- Data/API: API-GUR-21
- Also uses: API-RPT-13 (owned by another card; read or verified here, not an ownership claim)
- New requirements from the audit (this card owns them): FR-GUR-43-8 (all modes in the weekly report), FR-GUR-43-9, AC-GUR-43-10, AC-GUR-43-11.
- Metrics (D-T10-1): every accuracy field of API-GUR-21 is a number with ONE decimal on the wire (pooled correct ÷ answered × 100, XS-5, 60 section 4.6); the screen and the printout show the whole number rounded half up (40 XS-5).

**S6-T02 Kirkpatrick: school admin 7 screens, guru shell** · P0 · L · Type: Complete · deps: S0-T06
- Starts from (existing): `src/modules/m12-kirkpatrick/routes/mount.ts`, `src/modules/m12-kirkpatrick/pages/KirkpatrickOverviewPage.vue`.
- PRD: R1-AS-11 (P0), R1-GUR-11, R1-ADM-M-04 (admin Kirkpatrick, same 7 screens); register rows 9, 10. Gap: `m12-kirkpatrick/routes/mount.ts:32-38` "S1 only"; `routes/overview.ts:39` `detailLinks:false`; `pages/KirkpatrickOverviewPage.vue:5,37-38`; guru mounts in admin chrome (`mount.ts:25-30`); false "Penurunan 73.3%" on no activity (FR-X4-3). Verified in a visible browser on the GitHub build (2026-11-04): the "Tahap 1" click is dead, `/admin-sekolah/kirkpatrick/reaction` returns **404** (not 403), and the filter offers "Semua Sekolah/Semua Negeri" to a school admin (must be own school only). Approach: enable all 7 screens + PDF for AS (BE roles), teacher layout for guru, no-data ≠ decline. Files: `m12-kirkpatrick/**`, `BE/reports/kirkpatrick/**`. Tests: role matrix BE tests; spec. Verify: V-STD vs V2 `/admin/kirkpatrick` scoped. DoD: DoD-T + AC-AS-11-*, AC-GUR-11-*.
- Data/API: DM-30; API-RPT-11, API-RPT-17

**S6-T03 Cross-screen numbers (XS-1..8)** · P0 · L · Type: Fix · deps: S10-T02, S5-T15, S10-T09, S9-T06
- Starts from (existing): `src/modules/m27-school-admin/routes.ts`, `apps/api/src/modules/school-admin/dashboard.service.ts`, `src/modules/m27-school-admin/mock/read-models/` (deleted here), the Admin Pusat read models in `apps/api/src/modules/command-center/` and the m11/m12 read-model mocks (all S6 paths). The m08 read-model mocks are S10 files: a small cross-sector PR to S10 (`needs:S10`).
- New files: `e2e/r1/chains/chain-5.http.spec.ts` (the chain spec; helper `helpers.ts` landed by S9-T06 in Sprint 1), `apps/api/src/modules/school-admin/xs-queries.ts` (the exported named queries XS-1..XS-8, see the scope line below).
- Scope of the shared queries (round 4): this card owns the queries and the screens of its Starts-from list (school-admin dashboard, Admin Pusat Command Center). The other screens are changed by their own cards, which call the same XS definitions (60 section 4.6) and the exported queries: Prestasi pupil S10-T01 and Prestasi guru and school admin S10-T07, Analisa Item S10-T03, Headcount S10-T02 and S10-T09, Kirkpatrick S6-T02, Monitoring S6-T08, school reports S6-T09, guru lists S6-T10, central reports S6-T13. XS-1 counts approved pupils only (pending accounts are excluded, 50 section 5.3). AC-XS-1 to AC-XS-4 are proven by this card's fixture-school spec plus chain 5 across those screens. Chain 5 (Headcount) reads the pupil and school-admin Headcount views of S10-T09, hence that dependency (L-9). 40 X9 calls this card "teacher Headcount" because its spec starts at the teacher key-in: this card builds NO Headcount screen (teacher Headcount is S10-T02, pupil and school-admin views are S10-T09); it builds the school read model below and writes the chain-5 spec that follows one record from the teacher key-in to every view.
- Chain spec (D-T10-5): this card is the last card of AC-CHAIN-5, so it also writes `e2e/r1/chains/chain-5.http.spec.ts` (an S0-owned folder: a small cross-sector PR with the line `Cross-sector: S0 (chain spec)` and the label `needs:S0`, S0 reviews within 1 working day); S9-T06 runs and maintains it.
- PRD: 20 §5 XS-1..5, AC-XS-* (the ACs are AC-XS-1..4 and cover XS-1..5; XS-6..8 are definitions that the same read model implements); FR-X4-1. Gap: pupils 17/16/13, teachers 3/4, answers 122/30/36, accuracy 57.9/73.3/33.3 % (`m27/mock/read-models/*`, and the m08, m11, m12 read models). Approach: one school read model (BE) implementing XS definitions; every screen calls it; delete the mock read models. Files: `BE/school-admin/**`, `BE/command-center/**`, `m27-school-admin/{api,mock}/**`, `m11-teacher-analytics/**`. Tests: a single fixture school, assert the same number on all screens (spec lists them). Verify: V-STD, UAT school-admin account. DoD: DoD-T + AC-XS-1..4.
- Data/API: DM-28; API-AS-01, API-AS-07
- Also uses: API-AS-02, API-AS-17 (owned by another card; read or verified here, not an ownership claim)
- New requirements (45, 46, 48; D113): FR-PA-27.
- New requirements from the audit (this card owns them): AC-X4-1, AC-X4-2 (one number on every screen, pooled accuracy).
- Metrics (D-A10): one named query per XS-1..XS-8 for every screen, including the Admin Pusat Command Center, Laporan, Monitoring and Kirkpatrick views. Accuracy (D-T10-1): the read model returns accuracy as a number with ONE decimal (pooled correct ÷ answered × 100, XS-5, 60 section 4.6); every screen shows the whole number rounded half up (40 XS-5), so 57.9 shows as 58 everywhere; only the manual Headcount AR screen may show one decimal.

**S6-T04 Amaran Awal no-data** · P0/P1 · S · Type: Fix · deps: none
- Starts from (existing): `apps/api/src/modules/school-admin/amaran/risk.rules.ts`.
- PRD: R1-AS-49, FR-X4-3; register row 15. `BE/school-admin/amaran/risk.rules.ts:63-76` scores no data as Merah → "Belum Bermula". Tests: rules unit. Verify: V-STD. DoD: DoD-T + AC-AS-49-*.
- Data/API: API-AS-13

**S6-T05 UAT school-admin account and preconditions** · P0 · S · Type: Ops · deps: user approval (U-OP-12)
- Starts from (existing): `docs/ops/r1-operator-checklist.md`.
- PRD: R1-AS-0. Approach: create the account through the existing admin form ("Janakan Akaun Admin Sekolah") on UAT with the user's approval; credentials stay outside the repo. DoD: account can log in; AS ACs can be run on UAT. (Executed by Delivery Lead.)
- Data/API: none

**S6-T06 Sumbang Soalan: paper submit (guru)** · P1 · M · Type: Complete · deps: S1-T08, S2-T02, S1-T02, S4-T03, S9-T06
- Starts from (existing): `src/modules/m10-teacher-class/components/soalan/lib.ts`, `apps/api/src/modules/classes/question-sets/question-sets.ports.ts`.
- Cross-sector: S1. API-GUR-18/19 create `source = guru` intake items through the port bound by S1-T08 and the controller `apps/api/src/modules/questions/http/guru.controller.ts` (and `intake/intake-teacher.gate.ts`), which are S1 paths: one small PR to S1 (`Cross-sector: S1 (guru submit routes)`, `needs:S1`, merged first). The chain-6 front (admin pre-fill S2-T02, publish gate S1-T02, Bab mapping S4-T03) must be merged because the spec publishes the question.
- New files: `e2e/r1/chains/chain-6.http.spec.ts` (the chain spec; helper `helpers.ts` landed by S9-T06 in Sprint 1).
- Chain spec (D-T10-5): this card is the last card of AC-CHAIN-6, so it also writes `e2e/r1/chains/chain-6.http.spec.ts` (an S0-owned folder: a small cross-sector PR with the line `Cross-sector: S0 (chain spec)` and the label `needs:S0`, S0 reviews within 1 working day); S9-T06 runs and maintains it.
- PRD: R1-GUR-44, FR-GUR-44-8, AC-GUR-44-9 (the "Alat Soalan" block of six tiles; AC-GUR-44-9 closes only when S6-T14 and S6-T16..T20 have landed); register row 5 (`m10-teacher-class/components/soalan/lib.ts:28`, `HantarKertasCard.vue:70-73`). Scope (round 4): this card owns every FR/AC of R1-GUR-44 (FR-GUR-44-1..13: the CSV import, the DSKP conditional form, the stats and badges, the scanned-PDF check on the server, the Soalan Saya list), except the five Alat Soalan tiles that S6-T14 and S6-T16..T20 build; the existing `m10-teacher-class/components/soalan/**` and `pages/SumbangSoalan*` files are edited as the gap check shows (round 4 rule of section 0B), hence Complete. Approach: remove "belum tersedia" copy and make the upload real; a paper upload (44-F4) shows only the success notice, the teacher has no list of submitted papers in R1. One intake path (L-6): `POST /api/guru/questions` (a single MCQ, API-GUR-18) creates a one-item intake batch with `source = guru` through the port bound by S1-T08, like the paper upload (API-GUR-17); the teacher's single-question list (Soalan Saya, API-GUR-18/19) shows the status words Menunggu Semakan / Diluluskan / Ditolak with the reason; the admin side and the wizard pre-fill are S2-T02. Request fields per 44-F (`difficultyLevel`, `tp`, `cognitiveLevel`, `chapterId`, `spIds` (1 to 3 ids) as in API-GUR-18; the 60 row wins on any field not named in 20). Files: `m10-teacher-class/components/soalan/**`, `pages/SumbangSoalan*`. Tests: spec. Verify: V-STD. DoD: DoD-T + AC-GUR-44-*.
- Data/API: API-DSKP-07, API-GUR-09, API-GUR-18, API-GUR-19, API-GUR-20
- Also uses: API-GUR-17 (owned by another card; read or verified here, not an ownership claim)
- New requirements (45, 46, 48; D113): FR-QA-39; AC-QA-39.
- New requirements from the audit (this card owns them): FR-GUR-44-9 and FR-GUR-44-10, AC-GUR-44-10, AC-GUR-44-11; FR-GUR-44-11..13, AC-GUR-44-12..14 (listed so none is unclaimed).

**S6-T07 Command Center, Dashboards and Misi Harian (guru, AS)** · P1 · L · Type: Build · deps: S7-T05
- Starts from (existing): `src/modules/m10-teacher-class/pages/CommandCenterPage.vue`, `src/modules/m10-teacher-class/pages/GuruDashboardPage.vue`.
- New files: `src/modules/m10-teacher-class/pages/MisiHarianPage.vue`, `src/modules/m10-teacher-class/pages/MisiHarianFormPage.vue` (route `/guru/misi-harian` added in the existing `routes.ts`), `apps/api/prisma/migrations/0205_s6_mission_fields/migration.sql`.
- PRD: R1-GUR-1, R1-GUR-2, R1-GUR-2b (Misi Harian, route `/guru/misi-harian` not built; D106; reward per N-2: per-answer Syiling = the admin coin rate, `rewardCoins` paid once at the target; the per-answer constant `MISSION_COINS_PER_CORRECT` is removed by S5-T03 alone, this card does not edit `practice/rules.ts`; AC-GUR-2b-5), R1-AS-1, R1-AS-2; register rows 6, 14, 20. Gap: platform card "0 Sekolah Berdaftar" for AS; Remedial/Evaluate/Badges unverified (`CommandCenterPage.vue:86-170`); checklist dead targets (`components/dashboard/copy.ts:84-96`, `GuruDashboardPage.vue:147`). Files: `m10-teacher-class/pages/{CommandCenterPage,GuruDashboardPage}.vue`, `components/dashboard/**`, `BE/command-center/**`. Tests: click specs. Verify: V-STD. DoD: DoD-T.
- Data/API: DM-75; API-ADM-21, API-AS-02, API-AS-03, API-GUR-07, API-GUR-10, API-GUR-11, API-GUR-12, API-GUR-13, API-GUR-14, API-MUR-08
- Also uses: API-GUR-25 (owned by another card; read or verified here, not an ownership claim)
- New requirements (45, 46, 48; D113): FR-GM-20.1, 20.2; AC-GM-20.1, 20.3, 20.4 (teacher validation, the cap of 5 missions and the once-only target reward; FR-GM-20.3 and the per-answer rate are S5-T03).

**S6-T08 Monitoring (guru, AS, admin)** · P1 · M · Type: Fix · deps: S6-T03
- Starts from (existing): `src/modules/m11-teacher-analytics/routes/monitoring.ts`.
- PRD: R1-GUR-10, R1-AS-10, R1-ADM-M-03. Gap: scope, Gap tab, wide tables, admin item points to `/guru/monitoring`. Files: `m11-teacher-analytics/**`, route under `/admin/monitoring`. Tests/verify per standard (tables → cards at 375). DoD: DoD-T.
- Data/API: API-RPT-12

**S6-T09 School-admin reports and lists (46–53)** · P1 · L · Type: Complete · deps: S6-T03
- Starts from (existing): `src/modules/m27-school-admin/routes.ts`.
- PRD: R1-AS-46, R1-AS-47, R1-AS-48, R1-AS-50, R1-AS-51, R1-AS-52, R1-AS-53; register rows 13, 16. Gap: zero usage in 30 days, DSKP heatmap all "–", Laporan Bulanan thin (`SubjectPerformance.vue` hidden when empty), Senarai Pelajar lacks bulk import + class filter, Kelas Sekolah no drill. Approach: relative-date real data, sections always rendered, Import Pelajar, class filter, drill links (OQ-AS-13). Files: `m27-school-admin/**`, `BE/school-admin/**`. Tests: specs per screen. Verify: V-STD vs V1 (fallback). DoD: DoD-T + AC-AS-46..53-*.
- Data/API: API-AS-04, API-AS-05, API-AS-06, API-AS-08, API-AS-09, API-AS-10, API-AS-11, API-AS-12
- Also uses: API-AS-07 (owned by another card; read or verified here, not an ownership claim)
- New requirements from the audit (this card owns them): FR-AS-51-9 (grade, school and role change only through admin edit), FR-AS-51-10 (import over the seat limit refused whole with "Kuota penuh! Sila tingkatkan kuota dahulu.", quota = `school_subscriptions.student_quota`), FR-AS-52-7 (no teacher bulk import for the school admin in R1; the bulk path is the admin "Import Pengguna" U-06), AC-AS-51-9.

**S6-T10 Guru lists and reports** · P1 · M · Type: Complete · deps: S6-T03, S5-T15
- Starts from (existing): `src/modules/m10-teacher-class/pages/PelajarSayaPage.vue`, `src/modules/m11-teacher-analytics/routes/laporan.ts`.
- PRD: R1-GUR-41, R1-GUR-42; Cipta Pelajar silent failure; Laporan pills drop class filter and count mismatch. Files: `m10-teacher-class/pages/**`, `m11-teacher-analytics/pages/Laporan*`. Tests/verify standard. DoD: DoD-T + AC-GUR-41/42-*.
- Data/API: DM-74; API-GUR-05, API-GUR-06
- Also uses: API-RPT-07 (owned by another card; read or verified here, not an ownership claim)
- New requirements from the audit (this card owns them): FR-GUR-42-6 (every mode counts in Laporan), AC-GUR-42-6.

**S6-T11 Admin Pusat users, schools, classes, central dashboards** · P1 · M · Type: Build · deps: none
- Starts from (existing): `src/modules/m17-admin-dashboard/routes.ts`, `src/modules/m02-users-schools/routes.ts`.
- New files: `src/modules/m02-users-schools/pages/KelasSekolahPage.vue`, `src/modules/m17-admin-dashboard/pages/AdminDashboardPage.vue`, `src/modules/m17-admin-dashboard/pages/AdminAnalitikPage.vue`, `src/modules/m17-admin-dashboard/pages/AdminLaporanPage.vue`.
- PRD: R1-ADM-U-05, R1-ADM-U-06, R1-ADM-U-07, R1-ADM-U-08, R1-ADM-U-09, R1-ADM-M-01, R1-ADM-M-02, R1-ADM-M-05, R1-ADM-M-06. Gap: Dashboard redirects to Command Center, Analitik/Laporan empty (gap §5.5), no Kelas Sekolah in Pentadbiran. Files: `m02-users-schools/**`, `m17-admin-dashboard/**`, `BE/users`, `schools`, `school-admin`. Tests/verify standard (V2 admin). DoD: DoD-T.
- Data/API: API-ADM-02, API-ADM-05, API-ADM-06, API-ADM-11, API-ADM-12
- Also uses: API-ADM-01, DM-35 (owned by another card; read or verified here, not an ownership claim)

**S6-T12 Admin Pusat Pengguna and Sekolah (U-01..U-04)** · P0 · M · Type: Complete · deps: S4-T05, S6-T09, S9-T06
- Starts from (existing): `src/modules/m02-users-schools/routes.ts`.
- New files: `e2e/r1/chains/chain-8.http.spec.ts` (the chain spec; helper `helpers.ts` landed by S9-T06 in Sprint 1). S6-T09 (the school-admin lists that chain 8 reads) is a dependency, so S6-T09 is planned in Sprint 2 with this card.
- Chain spec (D-T10-5): this card is the last card of AC-CHAIN-8, so it also writes `e2e/r1/chains/chain-8.http.spec.ts` (an S0-owned folder: a small cross-sector PR with the line `Cross-sector: S0 (chain spec)` and the label `needs:S0`, S0 reviews within 1 working day); S9-T06 runs and maintains it.
- PRD: R1-ADM-U-01 Pengguna, U-02 Tambah Pengguna, U-03 Edit (+ reset kata laluan), U-04 Sekolah (all P0); AC-ADM-U01.*..U04.*; OQ-U1 (hide SK/SJK rows by default, D72). The U-OP-12 accounts depend on these screens working.
- Data/API: DM-35; API-ADM-01, API-ADM-03
- New requirements from the audit (this card owns them): FR-ADM-U03.4 (grade, school and role changed only by admin edit), FR-ADM-U05.5, FR-ADM-U06.2 (password minimum 8, teacher bulk path is U-06).
- Gap: built on GH and UAT but no AC executed on UAT data; no Darjah or primary school may be offered (FD-U02). Approach: run every AC on UAT data, fix what fails (filters, role scoping, pupil level picker T1-T5 only, school type); tables to cards at 375.
- Files: `src/modules/m02-users-schools/**`, `BE/users/**`, `BE/schools/**`. Tests: specs per AC. Verify: V-STD vs V2 `/admin/users`, `/admin/schools`. DoD: DoD-T + AC-ADM-U01.*..U04.*.

**S6-T14 Teacher Set Soalan and Kelas Saya (guru)** · P1 · L · Type: Build · deps: S1-T06, S6-T10 · Delivery A (D106, D108(3))
- Starts from (existing): `src/modules/m10-teacher-class/pages/SetSoalanSayaPage.vue` (nothing exists for the new part; it is added beside these files), `src/modules/m10-teacher-class/pages/KelasListPage.vue`, `src/modules/m10-teacher-class/pages/KelasCreatePage.vue` (R1-GUR-8, the teacher class pages `/guru/kelas*`).
- Cross-sector: S5 (`KelasListPage.vue` is listed under S5 in section 2). The change to that one file is a small PR to S5 that names this card, carries `Cross-sector: S5 (KelasListPage.vue)` and the label `needs:S5`; S5 reviews within 1 working day. R1-GUR-8 is entirely this card's: the teacher pages `/guru/kelas`, `/guru/kelas/cipta` (and the edit form of API-GUR-03, which is the existing `KelasCreatePage.vue` opened in edit mode, no second page; the pupil add/remove/create of API-GUR-05/06 is S6-T10, hence that dependency, and this card only links to it), the join code and QR dropped (API-GUR-04, F-08), the class pupil count = XS-1 (API-GUR-01). The PUPIL page `KelasSayaPelajarPage.vue` at `/kelas-saya` (R1-MUR-8) is S5-T08 and is not touched here; the two pages share only the endpoints API-GUR-01..04 and API-MUR-04, which this card and S5-T08 own as listed in their Data/API lines.
- New files: `src/modules/m10-teacher-class/pages/SetSoalanGuruListPage.vue`, `src/modules/m10-teacher-class/pages/SetSoalanGuruFormPage.vue`, `src/modules/m10-teacher-class/pages/SetSoalanGuruKeputusanPage.vue` (routes `/guru/set-soalan`, `/cipta`, `/:id`, `/:id/keputusan` in the existing `routes.ts`), `apps/api/src/modules/classes/teacher-sets/guru-question-sets.controller.ts`, `apps/api/src/modules/classes/teacher-sets/guru-question-sets.service.ts`, `apps/api/src/modules/classes/teacher-sets/guru-question-sets.repository.ts` (S6-owned; it calls the S1 `classes/question-sets` ports and does not edit them), `apps/api/prisma/migrations/0201_s6_question_set_assignments/migration.sql`, `apps/api/prisma/migrations/0203_s6_classroom_unique_name/migration.sql`.
- PRD: R1-GUR-8, R1-GUR-8b (teacher Set Soalan: `/guru/set-soalan`, `/cipta`, `/:id`, `/:id/keputusan`; V2 `guru/set.blade.php`), feeds R1-MUR-26. Gap: not built for teachers (`m10-teacher-class/pages/SetSoalanSayaPage.vue` is the pupil-facing list). Approach: Kelas Saya (R1-GUR-8): list with the counter "{n} kelas · {n} pelajar", create and edit class (Nama Kelas, Tingkatan, Subjek (pilihan), Tahun Sesi), add or remove a pupil, no join code, no QR. Set Soalan (R1-GUR-8b): list with counters, create/edit from approved questions only, Terbitkan/Draf/Jadikan Draf, Salin to a class, results page. Files: `m10-teacher-class/pages/**`, `BE/classes/**` (set endpoints, S1 reviews `question-sets/`). Tests: publish → pupil sees, archived question drops out. Verify: V-STD per module against the SRS description of the PRD modules on this card's "PRD:" line (screen layout, exact BM copy and states are written in words there; §0A). DoD: DoD-T + every AC of the listed modules.
- Data/API: DM-46, DM-73; API-GUR-01, API-GUR-02, API-GUR-03, API-GUR-04, API-GUR-16
- API status (60 API-GUR-16 is authoritative): the teacher set routes (`GET/POST /api/guru/question-sets`, `GET/PUT/DELETE /:id`, `POST /:id/status`, `POST /:id/copy`, `GET /:id/results?classroomId=`) are **Missing-Build**: this card builds all of them. Only the pupil feed `GET /api/set-soalan-saya` (API-GUR-15, owned by S5-T11, read-only for this card) exists in `classes/question-sets`; the words "exists in classes/question-sets" in 20 R1-GUR-8b mean that feed only. The backend of the teacher sets lives ONLY in `classes/teacher-sets/` (the files above); `classes/question-sets/` stays S1's. The V2 path `/guru/set/cipta` is a redirect to `/guru/set-soalan/cipta` (no second page); only the teacher Dashboard links to the Set Soalan list (FR-GUR-8-1: Kelas Saya has no Set Soalan link). A teacher set list shows `kind = 'set'` only (the papers of S6-T20 have `kind = 'kertas'`). The member list and add-pupil parts are components inside the three existing and new pages above (no further new file); the class name is trimmed in the service and DM-73's unique index is on `lower(name)` per teacher. Migration `0203` suffixes existing duplicate class names with " (2)" (DM-73). ADD-04 (`question_sets.education_level_id`, the optional field "Tingkatan (pilihan)", DM-46) and ADD-19 (the results route and the copy body `{classroomIds}`) are defined in 20 Appendix A2 and registered as API-GUR-16 (extended); ADD-21 is the delete guard of API-GUR-24 (S6-T16).
- Bank picker (R1-GUR-8b, 60 API-GUR-16 bank picker, owned by this card): `GET /api/guru/question-sets/bank?subjectId=&levelId=&q=&cursor=` returns units (a question or a whole stimulus group as ONE row), 50 per call, loaded on scroll, with the same served predicate as the pupil draw.
- Also uses: API-MUR-04, DM-15, DM-43 (owned by another card; read or verified here, not an ownership claim)
- New requirements from the audit (this card owns them): FR-GUR-8b-8 (a partial stimulus group is refused with 422 "Soalan dalam kumpulan rangsangan mesti dipilih bersama."), FR-GUR-8b-3 (several explicitly selected own classes), 8b-5 (results per class), AC-GUR-8b-8..10.
- Assignment (D-A7): `classroomIds[]` on create/update/copy (API-GUR-16), table `question_set_classrooms` (migration `0201_s6_question_set_assignments`, backfill one row per existing set); results per class; partial stimulus group = 422 "Soalan dalam kumpulan rangsangan mesti dipilih bersama."; only `draft` and `published`; pupil session mode `question_set`.

**S6-T15 Jemput Ibu Bapa and Pautan Ibu Bapa admin** · P2 · M · Type: Build · deps: S6-T12 · Delivery B
- Starts from (existing): `apps/api/src/modules/parents/parents.controller.ts`.
- New files: `src/modules/m02-users-schools/pages/AdminParentsTab.vue`, `src/modules/m01-authentication/pages/ProfileParentLinkPanel.vue` (S5 reviews), `apps/api/src/modules/parents/parent-invite.service.ts`.
- PRD: R1-MUR-40, R1-ADM-P2-16. Files: `m02-users-schools/**` (admin tab Ibu Bapa), `m05-practice`/profile pupil page (S5 reviews), `BE/parents/**`. Tests: link, regenerate invalidates, remove parent. Verify: V-STD per module against the SRS description of the PRD modules on this card's "PRD:" line (screen layout, exact BM copy and states are written in words there; §0A). DoD: DoD-T + every AC of the listed modules.
- Data/API: API-MUR-09

**S6-T13 Central reports and Admin Sekolah Dashboard** · P2 · L · Type: Build · deps: S6-T03 · Delivery B
- Starts from (existing): `src/modules/m17-admin-dashboard/routes.ts`.
- New files: `src/modules/m17-admin-dashboard/pages/AdminCentralReportPage.vue`, `src/modules/m27-school-admin/pages/SchoolAdminDashboardPage.vue`.
- PRD: R1-ADM-M-07, R1-ADM-M-08, R1-AS-2 (Dashboard numbers per XS), R1-GUR-A4 is S7-T10. Files: `m17-admin-dashboard/**`, `m27-school-admin/**`, `BE/school-admin/**`. Verify: V-STD per module against the SRS description of the PRD modules on this card's "PRD:" line (screen layout, exact BM copy and states are written in words there; §0A). DoD: DoD-T + every AC of the listed modules.
- Data/API: API-ADM-13, API-ADM-22
- Also uses: API-AS-01 (owned by another card; read or verified here, not an ownership claim)

**S6-T16 Soalan & Rujukan (guru: personal MCQ with a reference link)** · P1 · M · Type: Build · deps: S6-T07 (Misi Harian), S1-T07 · Delivery A (D106, OQ-G-15)
- Starts from (existing): `apps/api/src/modules/questions/http/guru.controller.ts`, `src/modules/m10-teacher-class/pages/SumbangSoalanCiptaPage.vue`, `src/shells/nav/out-of-scope.ts`.
- New files: `apps/api/src/modules/classes/teacher-tools/personal-questions.controller.ts`, `apps/api/src/modules/classes/teacher-tools/personal-questions.service.ts`, `apps/api/src/modules/classes/teacher-tools/personal-questions.repository.ts`, `src/modules/m10-teacher-class/pages/SoalanRujukanListPage.vue`, `src/modules/m10-teacher-class/pages/SoalanRujukanCreatePage.vue`, `apps/api/prisma/migrations/0127_s1_personal_question/migration.sql` (S1 range, requested with `needs:schema`).
- PRD: R1-GUR-44a, FR-GUR-44a-1..6, AC-GUR-44a-1..6; DV-GUR-44a-1, DV-GUR-44a-2.
- Data/API: DM-42; API-GUR-24, API-GUR-25 (API-GUR-25 is shared with S6-T07 in the Misi Harian screens only; this card owns the route and the sumbang statistics exclude private questions)
- New requirements from the audit (this card owns them): FR-GUR-44a-7, AC-GUR-44a-7, FR-GUR-44a-9 (the pupil link "Rujukan" and the rule that every count of `visibility = bank` questions goes through the one predicate; the gap check greps for any count that reads `questions` directly and each hit is fixed in this PR when it is an S6 file, or sent to its sector as a cross-sector PR).
- Gap: `/api/guru/questions` CRUD exists but creates bank submissions in review. Missing: the own-visibility flag, the reference-link field, serving through Misi Harian (R1-GUR-2b) and the routes `/guru/soalan-guru` and `/guru/soalan-guru/cipta`.
- Approach: (1) small PR to S1 (`needs:schema`): migration `0127_s1_personal_question` and the `visibility = 'bank'` predicate in every served set; (2) `BE/classes/teacher-tools/personal-questions.*` CRUD, own only (another id = 404), http/https links only, Tingkatan 1-5 only; the request body of API-GUR-24 carries `subjectId`, `educationLevelId` (Tahap, required), `difficulty`, `text`, `options`, `correctIndex`, `referenceUrl?` AND the four DSKP fields `chapterId`, `spIds`, `tp`, `cognitiveLevel`, which are required only where chapters or DSKP nodes exist for the Subjek + Tingkatan (FR-GUR-44a-7, D112; same conditional rule and 422 messages as the bank form, identical in 20 GUR-44a and 60 API-GUR-24); (3) mission draw adds the owner's personal questions for the pupils of the owner's classes only, item carries `referenceUrl`; the draw point is decided: `apps/api/src/modules/classes/missions/practice-assignments.adapter.ts` and `question-pool.ts` (S6 files, edited here; no S5 file is edited for the draw); (4) pages `/guru/soalan-guru` (list) and `/cipta` (form with the V2 labels), link opens in a new tab on the pupil screen; (5) delete-only PR to S0 removes the two routes from `GURU_TOOLS`.
- Cross-sector file list (one small PR each, decision 7): S1: `SCH/questions.prisma`, migration `0127`, and the ONE served-set predicate (`BE/questions/served-rule.ts`, `pin-servable.ts`, `learner-visibility.ts`) that Latih Tubi, Databank, Set Soalan pickers, the Studio list (API-Q-01) and every count already call, so the `visibility = 'bank'` condition is added once there; S5: `src/modules/m05-practice/components/quiz/QuizRunner.vue` (the pupil question card: the link "Rujukan" under the question, FR-GUR-44a-9; small PR `Cross-sector: S5 (reference link)`, `needs:S5`); S0: `user-nav.ts`/`out-of-scope.ts` (delete the two routes from `GURU_TOOLS`). "Active Misi" for the 409 guard of API-GUR-24 = a mission dated today (MYT) or later that is not deleted.
- Files: `m10-teacher-class/pages/**`, `BE/classes/teacher-tools/**`, `BE/classes/missions/**`, `CT/classes`; other sectors by the small PRs above.
- Tests: contract test that a private question is absent from Latih Tubi, Databank, Set Soalan pickers, Studio and every count; `javascript:` link rejected; pupil of another teacher is not served it. Verify: V-STD. DoD: DoD-T + AC-GUR-44a-*.

**S6-T17 Soalan Berstruktur (guru: list, detail, submit)** · P1 · L · Type: Complete · deps: S1-T08, S6-T06 · Delivery A (D106, OQ-G-15)
- Starts from (existing): `src/modules/m04-question-bank/pages/StructuredListPage.vue`, `src/modules/m04-question-bank/pages/StructuredDetailPage.vue`, `src/modules/m04-question-bank/routes/structured.ts`, `apps/api/src/modules/questions/http/structured.controller.ts`.
- PRD: R1-GUR-44b, FR-GUR-44b-1..7, AC-GUR-44b-1..7, FR-X1-4; DV-GUR-44b-1..3.
- Data/API: API-GUR-26
- Gap: `GET /api/structured-questions(/:id)` exist and the pages are mounted only under `/admin/structured-questions`. Missing: a `/guru/soalan-berstruktur` mount with the teacher role, BM pager copy, and teacher submission as an intake batch with `source = 'guru'` (through API-GUR-17, S1-T08).
- Approach: teacher-facing read mount (API-GUR-26, approved only, scheme shown); mount the existing list and detail pages under `/guru/soalan-berstruktur` and `/:id` with the BM pager text; the submit form posts to API-GUR-17 so the batch appears in Admin Pusat Import & Semakan (stimulus attached once to a group of 1..n questions); delete-only PR to S0 for `GURU_TOOLS`.
- Files: `m10-teacher-class/pages/**` and route entries, `BE/classes/teacher-tools/**`; small PR to S2 (`m04-question-bank` export and a portal prop). Tests: list count equals dataset, stimulus once, another teacher's submission = 404, 375 px cards. Verify: V-STD. DoD: DoD-T + AC-GUR-44b-*.

**S6-T18 Soalan Gambar Rajah (guru access to the diagram audit)** · P1 · M · Type: Complete · deps: S1-T08 · Delivery A (D106, OQ-G-15)
- Starts from (existing): `src/modules/m04-question-bank/routes/diagrams.ts`, `src/modules/m04-question-bank/pages/DiagramAuditPage.vue`, `apps/api/src/modules/questions/workflow/diagram-audit/`.
- PRD: R1-GUR-44c, FR-GUR-44c-1..5, AC-GUR-44c-1..5, FR-X1-4f.
- Data/API: API-Q-21
- Gap: `GET /api/diagram-audit`, `POST /api/diagram-audit/:kind/:id/image` and `POST .../dismiss` exist for the admin only. Missing: the teacher role, a teacher upload that creates an intake batch with `source = 'guru'` and attaches the image once to the stimulus group, and no Dismiss control for a teacher.
- Approach: allow `teacher` on the list and the upload (dismiss stays admin, teacher = 403 and no button); teacher upload validates image type and size before sending; page `/guru/gambar-rajah` reuses `DiagramAuditPage.vue`; nav badge equals the "MCQ Perlu Gambar" stat; delete-only PR to S0 for `GURU_TOOLS`.
- Files: `BE/questions/workflow/diagram-audit/**` (small PR to S1), `m10-teacher-class/pages/**`, small PR to S2 (`DiagramAuditPage.vue` portal prop). Tests: group of 3 shares one image, no Dismiss for a teacher, non-image rejected. Verify: V-STD. DoD: DoD-T + AC-GUR-44c-*.

**S6-T19 Databank Soalan (guru)** · P1 · M · Type: Build · deps: S1-T07 · Delivery A (D106, OQ-G-15)
- Starts from (existing): `apps/api/src/modules/questions/serving/`, `src/shells/nav/user-nav.ts` (nothing exists for the new part; it is added beside these files).
- New files: `apps/api/src/modules/classes/teacher-tools/databank.controller.ts`, `apps/api/src/modules/classes/teacher-tools/databank.service.ts`, `src/modules/m10-teacher-class/pages/DatabankGuruPage.vue`.
- PRD: R1-GUR-44d, FR-GUR-44d-1..6, AC-GUR-44d-1..6, FR-X1-4d, FR-X1-4e, FR-X1-4f.
- Data/API: API-GUR-27
- Gap: no teacher endpoint and no page. Missing: a read-only list with computed subject counts (Teras and Elektif), search, approved Tingkatan 1-5 questions only, whole stimulus groups. Do not reuse `GET /api/spm/databank`.
- Approach: `BE/classes/teacher-tools/databank.*` reads the same servable predicate as the pupil draws (counts equal what pupils get, D11, D91); page `/guru/databank` with hero, two stat cards, subject tiles, search; delete-only PR to S0 for `GURU_TOOLS`.
- Files: `m10-teacher-class/pages/**`, `BE/classes/teacher-tools/**`, `CT/classes`. Tests: tile counts equal dataset, zero-question subject not counted active, group shown once, personal and unapproved questions absent. Verify: V-STD. DoD: DoD-T + AC-GUR-44d-*.

**S6-T20 Kertas Peperiksaan (guru)** · P1 · L · Type: Build · deps: S6-T14, S1-T06 · Delivery A (D106, OQ-G-15)
- Starts from (existing): `apps/api/src/modules/exam/builder/`, `src/modules/m10-teacher-class/pages/SetSoalanSayaPage.vue`.
- New files: `apps/api/src/modules/classes/teacher-tools/kertas.controller.ts`, `apps/api/src/modules/classes/teacher-tools/kertas.service.ts`, `src/modules/m10-teacher-class/pages/KertasPeperiksaanPage.vue`, `src/modules/m10-teacher-class/pages/KertasPeperiksaanFormPage.vue`, `apps/api/prisma/migrations/0200_s6_question_set_kind/migration.sql`.
- PRD: R1-GUR-44e, FR-GUR-44e-1..5, AC-GUR-44e-1..5.
- Data/API: DM-43; API-GUR-28
- Gap: the exam builder is admin-only. Missing: a teacher-owned paper resource (list, create draft, add approved questions, share to own classes) and the page `/guru/kertas-peperiksaan`. File upload of a paper stays in S6-T06.
- Approach: reuse the S6-T14 set tables and picker rules (`question_sets.kind = 'kertas'`, migration `0200_s6_question_set_kind`), not the admin `papers` table (OD-15); `BE/classes/teacher-tools/kertas.*`; share and withdraw; delete-only PR to S0 for `GURU_TOOLS`.
- Files: `m10-teacher-class/pages/**`, `BE/classes/teacher-tools/**`, `SCH/classes.prisma`, `CT/classes`. Tests: draft invisible to other teachers, shared paper reaches only own classes with the group intact, empty name rejected. Verify: V-STD. DoD: DoD-T + AC-GUR-44e-*.

### 4.S7 Gamification, games, marketplace

**S7-T01 Permainan (pupil) on real API** · P1 · L · Type: Complete · deps: S0-T09, S5-T15, S7-T05, S3-T04, S10-T01, S10-T03, S9-T06
- Starts from (existing): `src/modules/m16-battle-games/routes.ts`, `apps/api/src/modules/battle/engine/battle-engine.service.ts`, `apps/api/src/modules/games/rooms/engine/constants.ts`, `apps/api/src/modules/games/solo/play/solo.rules.ts`, `apps/api/src/modules/games/core/bot-pool.ts` (the constants and the bot pool 48 section 3.7 deletes; if a second `bot-pool.ts` exists under `games/rooms/`, it is deleted too, found by file name). This card removes only the constants it uses; the global CI grep for the removed constants is run by S9-T03 once S5-T03, S7-T04 and S7-T05 have merged.
- Chain spec (D-T10-5): this card is the last card of AC-CHAIN-10, so it also writes `e2e/r1/chains/chain-10.http.spec.ts` (an S0-owned folder: a small cross-sector PR with the line `Cross-sector: S0 (chain spec)` and the label `needs:S0`, S0 reviews within 1 working day); S9-T06 runs and maintains it.
- Parts (round 4): this card is large and is delivered in several PRs that all name `S7-T01`; each PR title adds `part GAME-nn`, states the FR/AC it proves, and the order is by GAME number; the card is Done when all its ACs pass. S10-T01 and S10-T03 are dependencies because chain 10 reads their Prestasi and Analisa Item numbers.
- New files: `e2e/r1/chains/chain-10.http.spec.ts` (the chain spec; chain 10 needs the Kuiz write of S3-T04, hence that dependency; helper `helpers.ts` landed by S9-T06 in Sprint 1), `apps/api/prisma/migrations/0224_s7_game_engine/migration.sql` (DM-60 and DM-64), `apps/api/prisma/migrations/0228_s7_game_room_session/migration.sql` (DM-67), `apps/api/src/modules/battle/queue/queue-cancel.controller.ts` (API-GAME-14), `apps/api/src/modules/games/solo/spin-segments.service.ts` (DM-64 reads).
- PRD: R1-MUR-21; gap: the pupil game screens exist and follow the V2 layout, while the multiplayer engine is real-pupil matching with the labelled "Robot PrestasiPlus" fallback after 30 s (D113, 48), not a simulation. Games serve only standalone text questions: no stimulus groups and no figures (L-12; 46 section 5.1, 48 GAME-00 3.2, servability `permainan`). The SRS module R1-MUR-21 Action is Complete (D113-continued), matching this card. Size: L (plan sizes are S, M or L; 48 section 0.6 uses the same size; it is split at planning only if the gap check shows more, the two migrations and the route being the only new work). Scope (one job, two parts, nothing else): (a) remove every mock path of the pupil game screens (`m16-battle-games/mock`, S0-T09 lists them; the pupil screens call the real API), E-7 evidence; (b) bring the existing pupil games (Battle Arena, the room games, the solo mini-games, Jutawan Ilmu, Roda Nasib) to the requirements listed below. The FR-GM rows built by this card are exactly the parts of 48 section 5.1 whose owning card is S7-T01: GAME-00, GAME-01, GAME-R, GAME-02..GAME-07, GAME-S, GAME-08..GAME-12, GAME-13, GAME-14 (FR-GM-00, R, S, 01..14, listed below); the Liga and Tournament (GAME-15), boards (GAME-16), economy (GAME-17..19, 25), Misi Harian (GAME-20) and shop (GAME-21..24) are other cards. Most behaviour already exists in `BE/games`/`BE/battle` (60 API-GAME-01..03 are Exists-Fix); the changes that need new schema or routes are the only new work: DM-60 and DM-64 (migration `0224_s7_game_engine`) and DM-67 (migration `0228_s7_game_room_session`), both migrations owned by this card alone (one PR each, in that order), and the route API-GAME-14. Files: `m16-battle-games/**`, `BE/games/**`, `BE/battle/**` (arena, queue, engine), `SCH/games.prisma`, `SCH/battle.prisma`, `CT/games`, `CT/battle`. Verify: V-STD. DoD: DoD-T.
- Data/API: DM-60, DM-64, DM-67; API-GAME-01, API-GAME-02, API-GAME-03, API-GAME-14
- New requirements (45, 46, 48; D113): FR-PA-01, 28..33; AC-PA-26, 27, 29..31; FR-GM-S.1..3, FR-GM-00.1..11, FR-GM-R.1..7, FR-GM-01.1..9, FR-GM-02.1..5, FR-GM-03.1..3, FR-GM-04.1..2, FR-GM-05.1..2, FR-GM-06.1..2, FR-GM-07.1..2, FR-GM-08.1, FR-GM-09.1, FR-GM-10.1, FR-GM-11.1, FR-GM-12.1, FR-GM-13.1..3, FR-GM-14.1..4; AC-GM-R.1..6, AC-GM-S.1..3, AC-GM-00.1..12, AC-GM-01.1..11, AC-GM-02.1..5, AC-GM-03.1..2, AC-GM-04.1..3, AC-GM-05.1..3, AC-GM-06.1..3, AC-GM-07.1..3, AC-GM-08.1..4, AC-GM-09.1..2, AC-GM-10.1..3, AC-GM-11.1..3, AC-GM-12.1..3, AC-GM-13.1..4, AC-GM-14.1..5.
- New requirements from the audit (this card owns them): AC-MUR-21-6 (a game answer counts in the reports).
- Answer store (D-A1, DM-44, owned by S5-T15; the master table "Pupil activity → stored `mode` → API → card" in 40): a question answered in a game writes `mode = game` (Battle Arena writes `battle`); Syiling follow `reward_settings.mini_games_give_coins` (default No). The Battle "PKSK" tab needs an active PKSK grant and serves only PKSK questions that are standalone text-only MCQs (46 section 5.5); its rows are `mode = battle`. Writes go through the one `AnswerLogPort` of `practice/`; no second answer table, no report reads anything else.

**S7-T02 Sekolah Bersaing (school admin)** · P0 · M · Type: Fix · deps: none
- Starts from (existing): `src/modules/m16-battle-games/mock/data/sekolah-bersaing-seed.ts`, `apps/api/src/modules/games/leagues/sekolah-bersaing.controller.ts`.
- PRD: R1-AS-45 (P0); register row 12. Gap: "Data minggu ini belum dijana." because `SB_WEEKS` has no current week and no fallback (`m16-battle-games/mock/data/sekolah-bersaing-seed.ts:219`); real BE `games/leagues/sekolah-bersaing.controller.ts`. Approach: compute the board on request from live sessions (average session accuracy per school over T1-T5 sessions, FR-AS-45-4; no weekly job, no `week` line, no stored board, OQ-API-07, DM-31); delete the `SB_WEEKS` seed read; own-school highlight; restrict the route to Admin Sekolah and Admin Pusat (OQ-API-09). Files: `BE/games/leagues/**`, `m16-battle-games/**`. Tests: board for the fixture schools equals the session data; spec. Verify: V-STD vs V2. DoD: DoD-T + AC-AS-45-*.
- Data/API: DM-31; API-AS-14
- New requirements (45, 46, 48; D113): FR-GM-16.1..4; AC-GM-16.1..6.

**S7-T03 Tetapan Permainan (admin)** · P1 · M · Type: Build · deps: S0-T07
- Starts from (existing): `apps/api/src/modules/games/games.module.ts`, `src/modules/m16-battle-games/routes.ts`.
- New files: `src/modules/m16-battle-games/pages/TetapanPermainanPage.vue` (the admin page of N-05; route added in the existing `routes.ts`).
- PRD: 30 N-05. Gap: BE + client exist, no page. Files: `m16-battle-games/**` admin page, `BE/games/**`. Verify: V-STD vs V2. DoD: DoD-T.
- Data/API: API-ADM-08, API-ADM-23
- New requirements (45, 46, 48; D113): FR-PA-30; AC-PA-28.
- Settings screens only: this card builds the admin settings page for the parts of GAME-00, GAME-02 (Papan Bijak) and GAME-14 (Roda Nasib segments) that 48 section 5.1 names "settings screens S7-T03"; the FR and AC of those sections (FR-GM-00, FR-GM-02, FR-GM-14) are owned by S7-T01, which proves them with this page.

**S7-T04 Syiling, Tukar Token, Cabaran Harian, Pencapaian + admin Gamifikasi** · P1 · L · Type: Build · deps: S0-T07 · Delivery A (R1-MUR-28, 29, 30 linked)
- Starts from (existing): `apps/api/src/modules/gamification/admin.controller.ts`, `src/modules/m14-gamification/routes.ts`.
- New files: `src/modules/m14-gamification/pages/AdminGamifikasiPage.vue`, `src/modules/m14-gamification/pages/AdminChallengesPage.vue`, `src/modules/m14-gamification/pages/AdminAchievementsPage.vue`, `apps/api/src/modules/gamification/challenge-claims.service.ts`, `apps/api/prisma/migrations/0226_s7_challenge_claims/migration.sql`, `apps/api/prisma/migrations/0231_s7_ledger_idempotency/migration.sql`, `apps/api/prisma/migrations/0232_s7_challenge_type_combo/migration.sql`.
- PRD: R1-MUR-28, R1-MUR-29, R1-MUR-30, R1-MUR-34, R1-ADM-P2-01, R1-ADM-P2-02, R1-ADM-P2-03, R1-ADM-P2-04, R1-ADM-P2-05, R1-ADM-P2-06. Gap: pupil screens exist, admin has no Gamifikasi screens (BE `admin/gamification` exists, gap §5.5); reward model differs from V2 (gap §2.3). Files: `m14-*/**`, `m15-*/**`, admin pages under `m14-*`, `BE/gamification/**`. Tests: admin sets a Cabaran, pupil completes it, wallet changes. Verify: V-STD per module against the SRS description of the PRD modules on this card's "PRD:" line (screen layout, exact BM copy and states are written in words there; §0A). DoD: DoD-T + every AC of the listed modules.
- Data/API: DM-38, DM-63, DM-79, DM-81; API-ADM-14, API-GAME-07, API-GAME-11
- Also uses: API-MUR-10 (owned by another card; read or verified here, not an ownership claim)
- New requirements (45, 46, 48; D113): FR-GM-17.1..3, FR-GM-18.1..2, FR-GM-19.1..4, FR-GM-25.1..5; AC-GM-17.1..6, AC-GM-18.1..4, AC-GM-19.1..6, AC-GM-25.1..7. The economy settings of GAME-00 that this card's admin screens show are owned by S7-T01 (FR-GM-00, 48 section 5.1).

**S7-T05 Coin rate and reward backend (Kawalan Reward settings, Kedai Hadiah API)** · P1 · M · Type: Build · deps: none · Delivery A (R1-MUR-31 linked) / B (38)
- Starts from (existing): `apps/api/src/modules/shop`, `apps/api/src/modules/wallet`.
- New files: `apps/api/src/modules/shop/reward-settings.service.ts`, `packages/contract/src/gamification/reward-settings.ts`, `apps/api/prisma/migrations/0223_s7_reward_settings/migration.sql`, `apps/api/prisma/migrations/0229_s7_reward_catalogue_merge/migration.sql`, `apps/api/prisma/migrations/0230_s7_redemption_idempotency/migration.sql` (three PRs, one per migration, in number order, §3), `scripts/ops/reward-catalogue-dry-run.mjs` (the read-only dry run of migration 0229, DM-77).
- PRD: R1-ADM-P2-07, R1-ADM-P2-08, R1-ADM-P2-09 (backend part), U-OP-13. Gap: catalogue empty, redemptions cannot be fulfilled (gap §5.5); the coin rate has two sources of truth (F-12). This card is the early backend half of the former single reward card (D113-continued): it lands in Sprint 2 because S5-T03, S3-T04 and S7-T01 read the coin rate; the screens are S7-T11 (Sprint 5).
- Data/API: DM-48, DM-77, DM-78; API-ADM-15, API-ADM-16, API-GAME-08
- Also uses: DM-38 (owned by another card; read or verified here, not an ownership claim)
- New requirements (45, 46, 48; D113): FR-GM-21.1..4; AC-GM-21.1..9 (AC-GM-21.9: two redeem requests with the same `clientUuid` from one pupil give one redemption and one token debit; another pupil's same `clientUuid` gives its own). Rules (round 4): idempotency is `clientUuid` per (userId, clientUuid) only, no `Idempotency-Key` header and no time window; ONE redemption budget, `reward_budget_sen_session` (DM-48), a global budget for the academic session, and ERR-GAME-22 "Had tebusan sesi ini telah dicapai." fires when it is exhausted; there is no per-pupil money budget (per-pupil limits are the item stock and daily caps); category keys are the stored values of OPT-HADIAH-KATEGORI and migration 0229 maps the V2 keys with the table in DM-77 (a key not in the table stops the migration and names it). The coin-rate and `flatCoins` settings of GAME-00 are implemented here but FR-GM-00 itself is owned by S7-T01 (48 section 5.1).
- New requirements from the audit (this card owns them): FR-ADM-P2-08.4, FR-ADM-P2-09.3.
- Coin rate (D-A11): table `reward_settings` (migration `0223_s7_reward_settings`, singleton, `coins_per_correct` default 1 = the V2 value, range 0..20 (L-11; it is the setting `flat_quiz_reward` of 48 section 2, DM-48); API-ADM-16 `flatCoins` reads and writes it (0..20); the wallet credit of every question mode reads it; the constant `MISSION_COINS_PER_CORRECT` is removed by S5-T03 (its reader falls back to 1 until this table exists; this card does not touch `practice/rules.ts`). One reward catalogue (DM-77, migration `0229_s7_reward_catalogue_merge`): `syiling_rewards` and `reward_claims` rows move into `rewards`, `reward_redemptions` and `reward_settings`; Kawalan Reward switches to `rewards`. Idempotent redeem and ticket purchase (DM-78, migration `0230_s7_redemption_idempotency`: `client_uuid`, a repeat returns the first result).
- Backend only: the admin screens (Kawalan Reward, Kedai Hadiah admin, Tebusan) are S7-T11, so this card creates no page. API-ADM-15 and API-ADM-16 are the existing routes of `apps/api/src/modules/shop/admin.controller.ts` and `admin.service.ts` (edited here); the coin-rate lookup is `reward-settings.service.ts`, exported from the shop module to the wallet credit and to the S5-T03 reader (S5 imports it through its module port; no S5 file is edited here). Migration `0229` follows the data-migration exception of plan section 3: it ships with the schema change it completes and is idempotent; its dry run is the script `scripts/ops/reward-catalogue-dry-run.mjs` (new file of this card; `node scripts/ops/reward-catalogue-dry-run.mjs` runs the same selects as the migration and prints the row counts, the differing cost values and the unmappable category keys, writing nothing), step 0 of U-OP-13, run on UAT by the designated UAT developer (DM-77).
- Files: `BE/shop/**`, `BE/wallet/**`, `SCH/gamification.prisma`, `CT/gamification`.
- Tests: coin rate read by the wallet credit; the catalogue merge keeps every old row (dry-run count first); a repeated redeem with the same `clientUuid` returns the first result; an exhausted `reward_budget_sen_session` answers ERR-GAME-22. Verify: V-STD on the API with the S7-T11 screens when they land. DoD: DoD-T.

**S7-T06 Papan Pendahulu, Kedudukan, Tournament + admin views** · P1 · L · Type: Build · deps: S7-T04, S7-T01, S7-T11, S5-T03, S7-T05, S9-T06 · Delivery A (R1-MUR-33 linked)
- Starts from (existing): `src/modules/m08-student-performance/pages/LeaderboardPage.vue` and `src/modules/m08-student-performance/pages/RankingPage.vue` (both S10 files: one small cross-sector PR to S10, `needs:S10`), `src/modules/m16-battle-games/pages/TournamentListPage.vue`, `src/modules/m16-battle-games/pages/TournamentDetailPage.vue`, `src/modules/m16-battle-games/pages/BattleSchoolRankingPage.vue`, `apps/api/src/modules/battle/standings/standings.service.ts`, `apps/api/src/modules/battle/tournaments/tournaments.controller.ts`. Chain 9 also crosses the redemption queue (S7-T11) and the round engine (S7-T01), hence those dependencies.
- Chain spec (D-T10-5): this card is the last card of AC-CHAIN-9, so it also writes `e2e/r1/chains/chain-9.http.spec.ts` (an S0-owned folder: a small cross-sector PR with the line `Cross-sector: S0 (chain spec)` and the label `needs:S0`, S0 reviews within 1 working day); S9-T06 runs and maintains it.
- New files: `e2e/r1/chains/chain-9.http.spec.ts` (the chain spec; helper `helpers.ts` landed by S9-T06 in Sprint 1), `apps/api/src/modules/battle/tournaments/tournament-rounds.service.ts`, `apps/api/src/modules/battle/standings/league-standings.job.ts`, `src/modules/m16-battle-games/pages/AdminLeagueStandingsPage.vue`, `src/modules/m16-battle-games/pages/AdminTournamentListPage.vue`, `src/modules/m16-battle-games/pages/AdminTournamentFormPage.vue`, `src/modules/m16-battle-games/pages/AdminTournamentDetailPage.vue` (routes `/admin/tournament`, `/create`, `/:uuid`: create, edit, open, cancel and league enrolment, API-ADM-17 and API-ADM-25, R1-ADM-P2-14), `apps/api/prisma/migrations/0225_s7_league_tournament/migration.sql`. `league-standings.job.ts` is registered in the S0-owned `jobs/` worker by a one-line cross-sector PR to S0; `GET /api/gamification/leaderboard` is removed once no client calls it; a tournament answer row uses game key `tournament` and position n, so `part_ref = tournament#n` (API-GAME-12), the general form of `<game_key>#<position>`.
- PRD: R1-MUR-33, R1-MUR-18, R1-MUR-23, R1-ADM-P2-14, R1-ADM-P2-15. Gap: no period/scope filters or own rank (gap §2.3); duplicate route `/leaderboard` vs `/gamification/leaderboard` (FR-MUR-33-5). Files: `m16-battle-games/**`, `m14-*/**`, `BE/battle/**`. Tests: own rank outside top 3. Verify: V-STD per module against the SRS description of the PRD modules on this card's "PRD:" line (screen layout, exact BM copy and states are written in words there; §0A). DoD: DoD-T + every AC of the listed modules.
- Data/API: DM-61, DM-62; API-ADM-17, API-GAME-04, API-GAME-05, API-GAME-06, API-RPT-13, API-GAME-12, API-GAME-13, API-ADM-25
- Also uses: DM-38 (owned by another card; read or verified here, not an ownership claim)
- New requirements (45, 46, 48; D113): FR-GM-15.1..7, FR-GM-16.1..4; AC-GM-15.1..10, AC-GM-16.1..6. The Battle ranking views of GAME-01 are rendered here and proven as part of AC-GM-16.*; FR-GM-01.* and AC-GM-01.* are owned by S7-T01. Liga has no pupil "Sertai" (D-GAME-3): enrolment is by Admin Pusat only (AC-MUR-23-4); FR-MUR-23-2 and AC-MUR-23-1 follow AC-GM-15.1. The leaderboard route API-RPT-13 serves the scopes kelas, sekolah, negeri and kebangsaan (this card owns the route; S6-T01 reads it).

**S7-T07 Cabutan Bertuah, Kotak Misteri, Rujuk Kawan** · P2 · L · Type: Build · deps: S7-T05 · Delivery B
- Starts from (existing): `apps/api/src/modules/shop`, `src/modules/m15-rewards-shop/routes.ts`.
- New files: `src/modules/m15-rewards-shop/pages/AdminDrawsPage.vue`, `src/modules/m15-rewards-shop/pages/AdminMysteryBoxesPage.vue`, `src/modules/m15-rewards-shop/pages/RujukKawanPage.vue`, `apps/api/src/modules/shop/draw-winners.service.ts`, `apps/api/src/modules/shop/mystery-boxes.service.ts`, `apps/api/prisma/migrations/0221_s7_draw_winners/migration.sql`, `apps/api/prisma/migrations/0222_s7_mystery_boxes/migration.sql`, `apps/api/prisma/migrations/0227_s7_draw_status/migration.sql`.
- PRD: R1-MUR-22, R1-MUR-35, R1-MUR-36, R1-ADM-P2-10, R1-ADM-P2-11. Gap: admin BE has `POST draws` only; Kotak Misteri admin missing (backend work). Files: `m15-*/**`, `BE/shop/**`. Verify: V-STD per module against the SRS description of the PRD modules on this card's "PRD:" line (screen layout, exact BM copy and states are written in words there; §0A). DoD: DoD-T + every AC of the listed modules.
- Data/API: DM-36, DM-37, DM-65; API-GAME-09, API-MUR-10, API-ADM-24
- Also uses: API-ADM-16, API-GAME-08 (owned by another card; read or verified here, not an ownership claim)
- New requirements (45, 46, 48; D113): FR-GM-22.1..4, FR-GM-23.1..4, FR-GM-24.1..3; AC-GM-22.1..8, AC-GM-23.1..7, AC-GM-24.1..6.

**S7-T08 Marketplace (pupil + admin)** · P2 · L · Type: Build · deps: S7-T05 · Delivery B
- Starts from (existing): `apps/api/src/modules/marketplace/marketplace.controller.ts`, `src/modules/m20-marketplace/routes.ts`.
- New files: `src/modules/m20-marketplace/pages/AdminProdukPage.vue`, `src/modules/m20-marketplace/pages/AdminPenjualPage.vue`, `apps/api/src/modules/marketplace/marketplace-admin.controller.ts` (no migration, DM-38).
- PRD: R1-MUR-32, R1-ADM-P2-12, R1-ADM-P2-13. Gap: BE reads only; no admin Produk/Penjual (backend work). Files: `m20-marketplace/**`, `BE/marketplace/**`; no migration (DM-38: the existing marketplace tables are enough; `0220_s7_marketplace_admin` is not needed). Verify: V-STD per module against the SRS description of the PRD modules on this card's "PRD:" line (screen layout, exact BM copy and states are written in words there; §0A). DoD: DoD-T + every AC of the listed modules.
- Data/API: API-ADM-19
- Also uses: DM-38 (owned by another card; read or verified here, not an ownership claim)

**S7-T09 Tetapan (support contact) and admin Tiket Bantuan** · P1 · M · Type: Build · deps: none · Delivery A (N-07 feeds Panduan) / B (P2-20)
- Starts from (existing): `apps/api/src/modules/support/support.controller.ts` (nothing exists for the new part; it is added beside these files).
- New files: `src/modules/m22-support-tickets/pages/AdminSettingsPage.vue`, `apps/api/src/modules/support/config.controller.ts` (`GET /api/config/support`), `apps/api/prisma/migrations/0180_s5_support_ticket_context/migration.sql` (S5 range, requested with `needs:schema`).
- PRD: R1-ADM-N-07, R1-ADM-P2-20 (D108(4)). Migration `0180_s5_support_ticket_context` (DM-32; the table is in S5's schema file, so a `needs:schema` request to S5). Gap: UAT `GET /api/config/support` 404; no `/admin/settings`, `/admin/tiket` write screens. Files: `m22-support-tickets/**`, `BE/support/**`. Tests: setting read by Panduan, ticket status flow. Verify: V-STD per module against the SRS description of the PRD modules on this card's "PRD:" line (screen layout, exact BM copy and states are written in words there; §0A). DoD: DoD-T + every AC of the listed modules.
- Data/API: DM-32; API-ADM-10, API-SUP-03, API-SUP-05
- Also uses: API-SUP-04, DM-33 (owned by another card; read or verified here, not an ownership claim)

**S7-T10 Tiket Bantuan (pupil, guru, school admin)** · P2 · M · Type: Complete · deps: S7-T09, S9-T06 · Delivery B
- Starts from (existing): `apps/api/src/modules/support/support.controller.ts`, `src/modules/m22-support-tickets/routes.ts`.
- New files: `e2e/r1/chains/chain-7.http.spec.ts` (the chain spec).
- Chain spec (D-T10-5): this card is the last card of AC-CHAIN-7, so it also writes `e2e/r1/chains/chain-7.http.spec.ts` (an S0-owned folder: a small cross-sector PR with the line `Cross-sector: S0 (chain spec)` and the label `needs:S0`, S0 reviews within 1 working day); S9-T06 runs and maintains it.
- PRD: R1-MUR-A4, R1-GUR-A4, R1-AS-A4. Files: `m22-support-tickets/**`, `BE/support/**`. Verify: V-STD per module against the SRS description of the PRD modules on this card's "PRD:" line (screen layout, exact BM copy and states are written in words there; §0A). DoD: DoD-T + every AC of the listed modules.
- Data/API: API-SUP-01, API-SUP-02
- Also uses: DM-32 (owned by another card; read or verified here, not an ownership claim)
- New requirements from the audit (this card owns them): AC-MUR-A4-5 (single admin reply shown, the pupil cannot reply).

**S7-T11 Kedai Hadiah, Kedai Hadiah Digital, Tebusan and Kawalan Reward screens** · P1 · L · Type: Build · deps: S7-T04, S7-T05 · Delivery A (R1-MUR-31 linked) / B (38)
- Starts from (existing): `src/modules/m15-rewards-shop/routes.ts`.
- New files: `src/modules/m15-rewards-shop/pages/AdminHadiahPage.vue`, `src/modules/m15-rewards-shop/pages/AdminKawalanRewardPage.vue`, `src/modules/m15-rewards-shop/pages/AdminRedemptionsPage.vue`.
- PRD: R1-MUR-31, R1-MUR-38, R1-ADM-P2-07, R1-ADM-P2-08, R1-ADM-P2-09. Gap: no admin Hadiah or Kawalan Reward screens and the pupil shop shows an empty catalogue (gap §5.5). Files: `m15-*/**`. Tests: redeem → queue → deliver/cancel in the browser. Verify: V-STD per module against the SRS description of the PRD modules on this card's "PRD:" line (screen layout, exact BM copy and states are written in words there; §0A). DoD: DoD-T + every AC of the listed modules.
- Data/API: none
- Also uses: API-ADM-15, API-ADM-16, API-GAME-08, DM-48, DM-77, DM-78 (owned by another card; read or verified here, not an ownership claim)
- New requirements (45, 46, 48; D113): none owned here. FR-GM-21.1..4 and AC-GM-21.1..9 (GAME-21) are S7-T05's alone; the screens of this card prove them on screen (layered, table 4.0 E) and write the UAT rows.

### 4.S8 Question rendering and responsive

**S8-T01 Move shared display components behind one barrel** · P0 · S · Type: Fix · deps: none
- Starts from (existing): `src/components/question-display/index.ts`, `src/modules/m28-bijak-spm/components/PartInput.vue`.
- Data/API: none
- Move the files listed in §2/S8 into `src/components/question-display/`, leave re-export stubs at the old paths, update imports mechanically (no behaviour change). Land on day 1–2 of Sprint 0. Tests: existing suites green. DoD: DoD-T. Everyone rebases after it.

**S8-T02 Stimulus panel: once, sticky, zoomable** · P0 · M · Type: Fix · deps: S8-T01
- Starts from (existing): `src/components/question-display/StimulusGroup.vue`, `src/components/question-display/StimulusFigure.vue`, `src/modules/m28-bijak-spm/components/StimulusView.vue` (after S8-T01 it lives in `question-display/`; the old path is a re-export stub).
- PRD: FR-X1-4d, FR-X6-6/7, AC-X6-2, 10-murid §4.8. Gap: the display supports only some of the 7 stimulus kinds of 46 section 2.4 and 45 (`StimulusView.vue`; the gap check lists which kinds are missing), `StimulusGroup.vue` shows per-question. The collapsed panel header below 1024 px IS the chip "Lihat {label}" of the Bijak sitting (one element, not two). Approach: all 7 stimulus kinds (a kind it cannot render excludes the whole group with a reason, never a partial group); group panel above its questions; below 1024 px the panel is a collapsible sticky "Lihat {label}" (46 section 2.4: at 375 it is OPEN on the first member screen of each group in a session and collapsed on that group's later member screens, and the state the pupil leaves is kept; full width at 768; pinned left only from 1024 px, AC-PA-03); pinch/tap full-screen zoom; table/passage/graph types; long maths scrolls inside. Files: `src/components/question-display/{StimulusGroup,StimulusFigure,StimulusView,StimulusStack}.vue`. Tests: component tests incl. 375 snapshot; spec in `e2e/bijak`. Verify: V-STD on a paper with one figure + 3 questions at 375. DoD: DoD-T + AC-X6-2.
- Data/API: none
- Also uses: DM-03 (owned by another card; read or verified here, not an ownership claim)
- New requirements (45, 46, 48; D113): FR-QA-09; AC-QA-09; FR-PA-03, 36, 37; AC-PA-03, 39.

**S8-T03 Answer widgets and maths input** · P0 · L · Type: Complete · deps: S8-T01, S1-T09a, S1-T09b
- Starts from (existing): `src/components/question-display/RichText.vue` (after S8-T01 moves it from `src/modules/m28-bijak-spm/components/RichText.vue`; it holds the sanitiser allow-list), `src/components/question-display/AnswerWidget.vue`, `src/components/question-display/PartInput.vue` (after S8-T01; old path is a stub), `src/components/question-display/TextAnswer.vue`, `src/components/question-display/EssayAnswer.vue`.
- New files: `src/components/question-display/DrawingPad.vue` (Papan Lukisan), `src/components/question-display/TableFillGrid.vue`, `src/components/question-display/EssayChoice.vue` (alternative-prompt cards), `src/components/question-display/ClozeGaps.vue` (`{{gap:N}}` in place, read-only example gap), `src/components/question-display/MatchLetterBank.vue`, `src/components/question-display/LanguageToggle.vue` (FR-PA-04), exported from the barrel `index.ts`.
- PRD: FR-X6-8, D41, OQ-MUR-13. Gap: 8 of the 14 V2 answer modes have a widget today (the gap check names them); the six new widgets above cover the rest (drawing, table_fill, essay_choice, cloze gaps, match_letter, language toggle). Approach: full-width MCQ, short text, working + final answer (maths), "Pilih N", photo upload; `MathField`/`MathKeyboard` usable with the phone keyboard; touch ≥44 px. Files: `question-display/{AnswerWidget,McqOptions,TextAnswer,EssayAnswer,PartInput,MathField,MathKeyboard,RichText}.vue` and the new files above. Tests: widget tests per mode. Verify: V-STD at 375 with the on-screen keyboard. DoD: DoD-T.
- Data/API: none
- Sanitiser (single owner, FR-QA-18, round 4): this card widens the allow-list in `RichText.vue` (`u`, `s`, `br`-separated poem lines, two-column and bordered-box classes, gap markers) and writes its test; S2-T10 and S1-T09b only use it.
- New requirements (45, 46, 48; D113): FR-QA-17, 18, 20, 22..24; AC-QA-17, 18, 20, 22..24; FR-PA-02, 04..10, 35, 36, 38; AC-PA-04..06, 16, 17, 37, 38, 40, 42.

**S8-T04 Navigator, timer, Hantar on phone** · P0 · M · Type: Fix · deps: S8-T01
- Starts from (existing): `src/modules/m28-bijak-spm/components/NavigatorPanel.vue`, `src/modules/m28-bijak-spm/components/AttemptShell.vue`.
- PRD: FR-X6-8/9. Approach: bottom-sheet navigator showing answered/flagged; sticky timer/Hantar not covering the question; landscape rotation keeps place. Files: `question-display/{NavigatorPanel,AttemptShell}.vue`. Tests: component + spec. Verify: V-STD. DoD: DoD-T.
- Data/API: none
- New requirements (45, 46, 48; D113): FR-PA-14, 15; AC-PA-21, 22.

**S8-T05 Paper view (cover, review, result, preview)** · P1 · M · Type: Complete · deps: S8-T02
- Starts from (existing): `src/modules/m28-bijak-spm/pages/ResultPage.vue`, `src/modules/m28-bijak-spm/pages/PaperCoverPage.vue`.
- New files: `src/components/question-display/PaperView.vue`.
- PRD: FR-X6-10. Sections/parts/marks readable at 375; admin paper preview. Files: `question-display/**` (new `PaperView.vue`). Tests/verify standard. DoD: DoD-T.
- Data/API: none
- New requirements (45, 46, 48; D113): FR-PA-18, 20, 40; FR-QA-48, 49; AC-QA-48, 49.

**S8-T06 DS primitives: table→cards, forms, two-pane→tabs** · P0 · M · Type: Complete · deps: none
- Starts from (existing): `src/ds/DsDataTable.vue`, `src/ds/DsDrawer.vue`.
- New files: `src/ds/DsSplitPane.vue`.
- PRD: NFR-1, FR-X6-4, FR-X6-5, FR-X6-11. Files: `src/ds/{DsDataTable,DsDrillTable,DsFormBar,DsFormField,DsDrawer,DsPanel}.vue` + new `DsSplitPane.vue`. Tests: DS component tests; `npm run lint:ds`. Verify: V-STD. DoD: DoD-T.
- Data/API: none

**S8-T07 Accessibility and copy audit of the question-paper and shell components** · P1 · M · Type: Verify · deps: S8-T03
- Starts from (existing): `src/components/question-display/McqOptions.vue`.
- PRD: NFR-2 (BM copy exact), NFR-3 (accessibility replicates V2/V1, no regressions), FR-MUR-QP-16 (status never by colour alone). Approach: a checklist run over `src/components/question-display/**` and DS primitives: every form control labelled, visible focus, touch targets 44 px, legend with colour keys, copy strings compared with the PRD quotes (new copy needs approval, D94). Files: `src/components/**`, `src/ds/**`. Tests: axe-style unit checks on the components. Verify: V-STD per module against the SRS description of the PRD modules on this card's "PRD:" line (screen layout, exact BM copy and states are written in words there; §0A). DoD: DoD-T + every AC of the listed modules.
- Data/API: none

### 4.S9 Verification (Delivery Lead; recurring cards, no claim)

**S9-T01 Per-sprint UAT acceptance walk** · P0 · M · Type: Ops · deps: sprint merged
- Starts from (existing): `docs/prd/r1/40-cross-cutting.md`.
- Data/API: none
- Run every AC in the sprint's exit list in a visible browser on UAT (T5 pupil first) and update the AC ledger.

**S9-T02 V2 side-by-side check, evidence kept private** · P0 · M · Type: Ops · deps: none
- Starts from (existing): `docs/prd/r1/10-murid.md`, `docs/prd/r1/20-guru-admin-sekolah.md`, `docs/prd/r1/30-admin-pusat.md` (the SRS parts that describe every V2 screen in words).
- Data/API: none
- The Delivery Lead captures V2 at 375/768/1280 into the local, gitignored `.evidence/sprint-N/` only to compare with V3 and to find anything the SRS text misses. V2 captures are never committed (the repo is public) and never given to cloud agents. Every difference found is written into the SRS text of the module (a small PR to the PRD), so that agents keep building from the text alone.

**S9-T03 Cross-module (XL) integration pass** · P0 · M · Type: Ops · deps: sprint merged
- Starts from (existing): `docs/prd/r1/40-cross-cutting.md`.
- Data/API: none
- Links resolve, ids/enums agree, seeds coherent, permissions consistent, `node scripts/r1-trace-check.mjs` exits 0 (uncovered 0, dangling 0, unknown ids 0, ownership defects 0).

**S9-T04 Release checklist** · P0 · S · Type: Ops · deps: S9-T03
- Starts from (existing): `docs/prd/r1/40-cross-cutting.md`.
- Data/API: none
- Run §8 end to end before every deploy request.

**S9-T05 Sprint review demo with the user** · P0 · S · Type: Ops · deps: S9-T01
- Starts from (existing): `docs/prd/r1/40-cross-cutting.md`.
- Data/API: none
- Show the sprint's demo script live in a visible browser.

**S9-T06 End-to-end data chains AC-CHAIN-1..10** · P0 · L · Type: Verify · deps: none (recurring; the helper lands first, the ten chain-last cards depend on this card, never the reverse; only the full suite RUN waits for those ten cards)
- Starts from (existing): `docs/prd/r1/40-cross-cutting.md`, `e2e/`
- PRD: 40 section X9, AC-CHAIN-1..10 (one chain per audited flow: 1 admin question to every report, 2 paper PDF to pupil paper, 3 Bijak lanes, 4 class and Set Soalan, 5 Headcount, 6 Sumbang Soalan to admin, 7 Tiket Bantuan, 8 school-user lifecycle, 9 gamification and redemption, 10 Kuiz and game answers). This card owns all ten chains; AC-CHAIN-10 (Kuiz and game answers reach every report: the Kuiz writes at the final submit only, a Battle against a human and a Quick Match against the robot write rows of mode `battle`, one total on Prestasi, Analisa Item, the teacher, school-admin and Admin Pusat screens; 46 section 9.7), (owned here as well).
- Data/API: none
- Who does what (D-T10-5): S9 is not claimable as a sector, but this card is worked by the Delivery Lead session. Its first small PR (Sprint 1, no dependency) lands `e2e/r1/chains/helpers.ts`; every chain-last card imports it and lists S9-T06 in its `deps:`. The spec of AC-CHAIN-n is written by the LAST card of chain n (the table below) in the same PR as that card's own change, in the S0-owned folder `e2e/r1/chains/` (small cross-sector PR, `Cross-sector: S0 (chain spec)`, label `needs:S0`); this card runs the full suite on the CI seed, runs the UAT acceptance and maintains the suite afterwards; it never writes a product fix.
- Last card of each chain (it writes `e2e/r1/chains/chain-<n>.http.spec.ts`, the file is on that card's `New files:` line, and the card lists the other cards of its chain in `deps:`). Each of those cards carries the line "Chain spec" naming its file.

| Chain | Last card (writes the spec) | Other cards of the chain (all listed in the last card's `deps:`, copied from the table in 40 X9) |
|---|---|---|
| 1 | S10-T05 | S1-T01, S1-T02, S1-T07, S2-T01, S4-T03, S5-T02, S5-T03, S5-T15, S10-T01, S10-T03, S6-T03 |
| 2 | S3-T04 | S1-T01, S1-T02, S1-T03, S1-T10, S2-T01, S2-T02, S3-T02, S5-T15 |
| 3 | S3-T07 | S3-T04, S3-T05, S3-T06, S5-T15, S10-T02 |
| 4 | S5-T11 | S5-T08, S5-T15, S6-T10, S6-T14, S10-T01, S10-T07 |
| 5 | S6-T03 | S5-T15, S10-T02, S10-T09 |
| 6 | S6-T06 | S1-T02, S1-T08, S2-T02, S4-T03 |
| 7 | S7-T10 | S7-T09 |
| 8 | S6-T12 | S6-T09 |
| 9 | S7-T06 | S5-T03, S7-T01, S7-T04, S7-T05, S7-T11 |
| 10 | S7-T01 | S3-T04, S5-T15, S7-T05, S10-T01, S10-T03 |
- New files: `e2e/r1/chains/chain-1.http.spec.ts` .. `chain-10.http.spec.ts` (each written by the last card of its chain, line above) and `e2e/r1/chains/helpers.ts` (shared login and `UJI` record helpers; THIS card lands it as its first small cross-sector PR to S0 in Sprint 1, before any chain-last card starts; a last card imports it and asks this card by issue for a missing helper; the team and session names come from `R1_TEAM` and `R1_SESSION`, START-HERE decision 12).
- AC-CHAIN-2 reviewer step (D-T10-4): imported questions arrive as Draf. An Admin Pusat user (the only reviewer role; there is no Penyemak role) sets Bab, SP, TP and Kesukaran in the wizard (Bab required where chapters exist; SP, TP and aras where DSKP nodes exist, D112(3)), sends the group to review (Menunggu Semakan, Studio filter `status=review`), approves it (Diluluskan), and then Terbit publishes the group as one unit. The chain-2 spec seeds these steps through the UI, never through the database.
- Approach: implement each chain as one Playwright spec per chain (`e2e/r1/chains/chain-<n>.http.spec.ts`) that enters ONE record on the first side and asserts the same figure on every other side; CI runs it on the CI seed (automated check only), and the **acceptance run is on UAT** (D110) in a **headed** browser at 375, 768 and 1280, with test records created on UAT and removed afterwards (U-OP-14). The chain fails on the first screen that shows a different number or name. Chains land with their cards (the cards of each chain are the rows of the table above): 1, 2 and 5 in Sprint 3 (chain 5 may land in Sprint 2 with S6-T03); 3, 4, 6 and 10 in Sprint 4; 8 in Sprint 2 (S6-T12 with S6-T09); 9 in Sprint 5; 7 in Sprint 8. The full suite run on UAT starts when the ten chain-last cards are merged.
- **Exit gate:** every chain passes **on UAT** (clone of V2 production data) in a headed browser at 375/768/1280, evidence in `.evidence/S9-T06/` (gitignored, never committed; only pass/fail and IDs are reported); a chain that fails returns the failing step to the owning card (the chain's card list above), it is never patched here. No product code in this card.
- Tests: the ten specs. DoD: DoD-T (a), (d), (h) only.

**Card count:** S0 12, S1 11, S2 10, S3 8, S4 9, S5 15, S10 9, S6 20, S7 11, S8 7, S9 6 = **118 cards** (P0 68, P1 41, P2 9; S 15, M 70, L 33; Fix 25, Complete 43, Build 36, Verify 2, Ops 12) (Delivery A and Delivery B, marked per card; the generated `docs/plan/r1-traceability.md` lists every card with its PRD modules).

---

## 5. Parallelisation, critical path, sprint plan

### 5.1 What can run at the same time
- **Day 1, no dependencies:** S0 (T01–T04, T08), S1 (T01, T08), S2 (T03, T07 UI work), S3 (T01, T03), S4 (T02, T05), S5 (T05, T08), S6 (T04, T05, T07), S7 (T02), S8 (T01, T06).
- **After S0-T02 (stack):** S4-T01 CI seed; S1/S3/S5/S10 integration tests (CI).
- **After S8-T01:** S8-T02/T03/T04 in parallel with S3 admin cards (S3-T01..T03) and S2 cards.
- Sectors never write the same file (§2); shared files go through S0 (§3).

### 5.2 Critical path (Delivery A)
The path is derived from the `deps:` of the cards (the `deps:` win over any list in this plan; the sprint lists in §5A are checked against them).
- **Longest chain (about 30 ideal days):** `S1-T01 groups` → `S1-T09a/S1-T09b answer modes, scheme editor, bilingual, drawing/table_fill` → `S8-T03 answer widgets` → `S3-T04 pupil sitting` → `S3-T06 Kertas Subjektif and self-mark` → `S5-T11`.
- **Platform and Bijak chain:** `S0-T02 stack` → `S1-T01` → `S1-T03 extraction` → `S2-T02 import UI`; `S1-T06 group-safe assembly` → `S3-T02 Set Builder` → `S3-T04`; `S8-T01 → S8-T02 → S8-T03/T04` → `S3-T04` → `S3-T08 Terbit pipeline` and `S4-T08 / S3-T08 UAT ops (Kontrak Disahkan → Terbit)` → `S9 UAT acceptance`.
- **Answer store (reads by every report):** `S0-T02` → `S5-T15 single answer store` (Sprint 1) → the writers (`S5-T03`, `S3-T04`, `S3-T05`, `S3-T06`, `S7-T01`) and the readers (`S10-T01..T03`, `S6-T01`, `S6-T10`).
- **Chapter learning:** `S4-T02 DSKP` → `S4-T03 Bab mapping tool` (its first step is the investigation of the existing chapter data) → `S5-T02`, `S10-T04`, `S10-T05`.
- **Coin rate:** `S7-T05` (coin rate and reward backend: DM-48, DM-77, DM-78, API-ADM-16) lands in Sprint 2 and is read by `S5-T03`, `S3-T04` and `S7-T01`. Only `S7-T01` depends on it. `S5-T03` and `S3-T04` do NOT depend on it (L-8): until S7-T05 merges, or when no `reward_settings` row exists, they read the coin rate with the default 1, so Slice 0 needs no S7-T05. The reward screens are `S7-T11` in Sprint 5 (D113-continued: the former S7-T05 is split into a backend card and a screens card).
- **P0 portal-breakage branch** (`S0-T05 → S0-T06 → S10-T01..T03, S5-T06, S5-T10, S6-T01, S6-T02`) is independent and is the quickest visible win.

### 5.3 Split by number of developers
Assumptions: **1 ideal day = 1 day of focused work; a developer delivers 8 ideal days per 2-week sprint** (10 working days x 0.8 focus, after reviews, calls, rebasing). S = 1, M = 3, L = 6. Totals computed from the 118 cards: **Delivery A 369 ideal days for developers (plus 17 days of S9 verification, which is the Delivery Lead's), Delivery B 37 days (423 in all).** The figures are recomputed from the cards by the Delivery Lead whenever cards are added or split, and re-baselined after Sprint 1.

| Devs | Sector assignment (non-overlapping; days of Delivery A per developer) | Delivery A duration (days / 8 per sprint) | Verdict |
|---|---|---|---|
| **1** | one at a time in this order: S0 → S8-T01 → S10 P0 → S6 P0 → S4 → S1 → S2 → S3 → S8 → S5 → S6 P1 → S7 (369 d) | about 47 sprints (94 weeks) | Not viable for 1.0. Use only if the user lowers the scope; then do P0 cards only (218 days, 28 sprints) |
| **2** | Dev A: S6, S5, S4, S10 (170 d). Dev B: S0, S1, S2, S3, S7, S8 (199 d) | about 25 sprints (50 weeks) | Possible but long |
| **3** | A: S6, S5 (117 d). B: S1, S2, S3, S10 (138 d). C: S0, S4, S7, S8 (114 d) | about 18 sprints (36 weeks) | Minimum recommended |
| **5** | A: S0 + S1 (71 d). B: S2 + S8 + S10 (84 d). C: S3 + S4 (61 d). D: S5 + S7 (79 d). E: S6 (74 d) | about 11 sprints (Sprint 0 + 10 = 21 weeks), then Delivery B | Recommended |

The sprint lists in §5A give the order of goals and cards. When a team's cards do not fit one sprint, the surplus follows in the next sprint (carry-over rules in §5A); Sprint 6 (hardening) starts when every Delivery A card is merged, not before. Scope is never cut to fit a date (D100).

Inside every sprint each developer works only in their own sectors' paths; a task needing another sector's path is a small cross-sector PR (§3; R1-START-HERE decision 7), reviewed within 1 working day by the team that holds that sector. The Delivery Lead (S9) is a separate role and does not count as a developer.

### 5A. Sprint plan

**Sprint length: 2 weeks (Sprint 0: 1 week).** Reasons: L cards are 6 ideal days, so they must fit inside one sprint; every sprint needs time for the UAT deploy and the teams' UAT acceptance runs (headed browser, three widths); the user sees a demo every 2 weeks, a rhythm they can follow. One week would put ceremonies and verification on the critical path; four weeks would hide a failing direction for too long. After Sprint 3, if velocity is stable and the user wants quicker feedback, switch to 1 week (this is an explicit retro decision).

**Ceremonies (all kept minimal).** Sprint planning 30 min (Delivery Lead + team leads: pick cards, confirm ACs, set the issue milestones). Daily: each team posts one report comment in #503 (§6.7), no meeting. Sprint review: the user watches the demo script live in a visible browser (≤30 min). Retro: 15 min, three bullets (stop/start/keep) posted as a comment in #503. Nothing else.

**"Sprint done" definition.** A sprint is done only when (1) every card in it is Done under DoD-T *or* explicitly carried over with a reason; (2) **every AC on the sprint's exit list has a Pass row** in the AC ledger (`[CI]` ACs in CI, `[UAT]` ACs on UAT, §6.9); (3) the demo was shown to the user; (4) `main` branch of work (`feature/v3-bijak-r1`) is green (CI, sidebar-walk). Progress is reported as "ACs passing / ACs planned", then "cards done / planned", in that order. Sprint-order rule: a card's dependencies (`deps:`) are in the same sprint or an earlier one, and a card starts only after its dependencies are merged; `S9-T01`, `S9-T02`, `S9-T05` and `S9-T06` are recurring Delivery Lead cards that run in every sprint (S9-T06 from Sprint 3, as each chain lands, and its `deps:` are the last cards of the ten chains, which may be in later sprints); they have no sprint-order check of their own (their issues carry the milestone R1 Sprint 1, S9-T06 R1 Sprint 3).

**Carry-over rules.** A card that misses the sprint returns to Backlog with its progress note and is re-estimated; carry-over is allowed once; the second time it must be split or re-assigned at planning. A card whose AC fails on UAT returns to `status:in-progress` (it is not Done); it counts as carry-over. Anything a card needs from another sector and did not get is reported as blocked on day 2, not on the last day (comment in #503, label `needs:S<n>`).

**Tracking per sprint.** The board is the `r1` issues with their labels and milestones (`R1 Sprint 0..N`); sector, type, priority, delivery and status are labels (§6.1). Per sprint the Delivery Lead posts in #503: planned days, merged days, ACs planned, ACs passing. The AC ledger (`docs/plan/r1-ac-ledger.md`, §6.9) is the real measure.

#### Slice 0: one end-to-end chain first

For a team with limited time (about 24 hours of working time), build ONE chain end to end before anything else (D112(7)). It proves AC-CHAIN-1 and AC-CHAIN-2 (PRD 40 section X9). Everything else follows the normal sprints below; no card is dropped or changed by Slice 0, only ordered first. Cards are done under the usual rules (gap check first, §0B; DoD-T).

The cards, in order (each step needs the one before it). The coin rate is read with the default 1 when no `reward_settings` row exists, so Slice 0 does not include S7-T05 (L-8):

1. **Stimulus group 1..n, published and served as ONE unit.** S1-T01 (group invariants, 1..n members, FR-ADM-QE2.4) plus the group publish: S1-T02 (publish gate) and S2-T01 (group-first entry in the Studio wizard, the minimum needed to create "Rajah 3" and its members). Done when: AC-ADM-QE1.2, AC-ADM-QE2.1, AC-ADM-QE2.2.
2. **The conditional Bab/SP gate.** S1-T02 (FR-ADM-QE4.5: Bab before Terbit where the Subjek + Tingkatan has chapters; FR-ADM-QE4.6: SP/TP only where DSKP nodes exist) with S4-T02 (the DSKP loaded and verified for the subject used, U-OP-01). Done when: AC-ADM-QE4.3, AC-ADM-QE4.4, AC-ADM-QE4.5.
3. **Latih Tubi serves whole groups and writes `practice_answers`.** S1-T06 (group-safe assembly), S1-T07 (servability), S8-T02 (stimulus shown once, sticky), S5-T03 (Latih Tubi) and S5-T15 (the single answer store with `mode`, DM-44); the reports read that store: S10-T01 (Prestasi), S10-T03 (Analisa Item). Done when: AC-ADM-QE7.3, AC-ADM-M06.2, and the AC-CHAIN-1 steps (a) to (d) with their Prestasi and Analisa Item numbers. This proves AC-CHAIN-1.
4. **ONE Sejarah Kertas 1 paper end to end** (Sejarah has sample papers and its DSKP loaded; Kertas 1 first, D112(4)): Kontrak S3-T01 (Disahkan, FR-ADM-Q16.*) -> Set Builder S3-T02 -> Semak & Terbit (S3-T08 for the Terbit pipeline; S1-T10 for the batch-to-paper step) -> pupil sitting and result S3-T04 (with S8-T03 answer widgets, S8-T04 navigator/timer/Hantar on phone) -> Prestasi and Analisa Item (S10-T01, S10-T03), with the answers written by S5-T15 (mode `simulasi`). Done when: AC-ADM-Q16.1, AC-ADM-Q16.3, AC-ADM-Q07.3 to AC-ADM-Q07.6, AC-MUR-13-1, AC-MUR-13-4, AC-MUR-13-6, AC-MUR-13-25.
4a. **Paper PDF start of AC-CHAIN-2** (needed to prove AC-CHAIN-2 from its first step; if time runs out, the Sejarah paper may be entered by group-first manual entry (S2-T01) and these cards follow immediately after): S0-T03 (real Tesseract OCR, D112(2)), S1-T03 (extraction keeps groups and Bahagian), S1-T04 (timeout, error state), S2-T02 (Import & Semakan, Semak Ekstrak). Done when: AC-ADM-QE5.1, AC-ADM-QE5.2, AC-ADM-QE5.3, AC-ADM-Q07.1. This completes AC-CHAIN-2.

The final check runs AC-CHAIN-1 and AC-CHAIN-2 on UAT in a visible browser at 1280 px with a 375 px pass of the pupil steps, after the designated UAT developer deployed on request (card S9-T06 runs and accepts the chains; the spec of each chain is written by the last card of that chain, §4.S9; for Slice 0 they are run by hand with the AC-CHAIN-2 numbers applied to the Sejarah paper, by the teams that own the Slice 0 cards). The content for steps 1 to 4 is entered by Admin users (D112(4)).

#### Sprint table (5-developer variant; other variants in 5B)

Exit-criteria notation: `AC-MUR-3-*` means all acceptance criteria of that module in the PRD; the PRD files are authoritative for the IDs.

**Sprint 0 (1 week) — Foundation.**
- *Goal (user-visible):* "Any developer can clone the project, run one command, log in as pupil T1/T4, teacher, school admin and admin on a stack with data (CI/test use) and on UAT; the board exists; UAT has the DSKP loaded and a school-admin account."
- *Cards:* S0-T01, T02, T03, T04, T08 · S8-T01, T06 · S4-T01, T02 (dry-run + local; UAT run is a ops step), T05 · S1-T01 (start) · S6-T05 (ops) · S2-T03 · S5-T08 (start). ≈ 36 days of 40.
- *Entry:* plan approved by the user; labels (including `needs:S0..S10`), milestones and issues created by `scripts/r1-create-issues.mjs`; the designated UAT developer named in the first line of #503; each team has registered (`r1-lock.mjs register-team`) and holds its sector locks.
- *Exit (ACs):* FR-X5-2 (stack boots untouched, CI `stack-smoke` green); AC-X2-3 check runs (report mode); U-OP-01 (DSKP loader), U-OP-02 (intake env), U-OP-03 (Darjah) and U-OP-12 (accounts) done on UAT with the user's approval: UAT "Tahap" = 5 (FR-X3-2) and a school-admin account can log in; S8-T01 merged.
- *Demo:* (1) fresh clone → `npm run stack:up` → login as each role; (2) show the issue board (labels and milestones) with every card, sector and estimate; (3) open a PR touching two sectors and show both owners requested; (4) UAT landing shows Tahap 5; (5) Kurikulum shows DSKP nodes.

**Sprint 1 — "No broken sidebar, correct pupil analytics and teacher/school-admin P0 screens".**
- *Goal:* "A T5 pupil on UAT opens every sidebar item: Prestasi shows only their own data, Headcount, Analisa Item and Laporan Soalan work; the teacher's Laporan Mingguan opens a real screen; the school admin sees Kirkpatrick (7 screens) and Sekolah Bersaing with data; every answering activity writes the single answer store."
- *Cards:* S0-T05, T06 · S5-T15 (the single answer store lands first because the reports read it), T10, T06, T05 (start) · S10-T01, T02, T03, T09 · S6-T01, T02, T03 (start), T04 · S7-T02 · S3-T01, T03 · S9-T06 (its first small PR: `e2e/r1/chains/helpers.ts`; the card is recurring) · S1-T01 (finish), T02 · S0-T12 · S4-T03 (investigate + bulk API start) · S8-T02 (start).
- *Entry:* Sprint 0 exit.
- *Exit (ACs):* AC-X2-1 for pupil, teacher, school admin (sidebar-walk green for these rows); AC-X2-2 for the modules fixed; `AC-MUR-4-*`, `AC-MUR-3-*`, `AC-MUR-6-*`, `AC-MUR-54-*`; `AC-GUR-43-*`, `AC-AS-11-*`, `AC-AS-3-*`, `AC-AS-45-*`, `AC-AS-49-*`; XS-1..3 on the fixture school; FR-X4-4 (pupil cannot see school data); the `practice_answers` `mode` column and write path (S5-T15, DM-44) in CI.
- *Demo:* (1) pupil T5 on UAT: open every sidebar item at 375 and 1280 (sidebar-walk spec shown green); (2) Prestasi → own 360, then show school endpoint returns 403 for the pupil; (3) guru → Laporan Mingguan prints a class report; (4) school admin → Kirkpatrick all 7 screens, Sekolah Bersaing board, same pupil count on three screens; (5) the Delivery Lead's side-by-side with V2 Laporan Mingguan (verification step, §8).

**Sprint 2 — "DSKP-correct question entry and import".**
- *Goal:* "An admin enters a question group (one figure, three questions) and imports a PDF paper whose Rajah 3 stays with questions 5–8; completeness is explained at entry; the admin menu has one bank and one review queue."
- *Cards:* S1-T03, T04, T05, T07, T10 · S2-T01, T02, T05, T07 (start) · S0-T07 (menu FINAL, D107) · S4-T03 (finish; CI proves the API, the Bab mapping itself is applied by admin users through the UI on UAT after the deploy, D110), S4-T06, T07 · S5-T01, T04 · S6-T03 (finish), S6-T12 (Pengguna/Sekolah, P0), S6-T09 (school-admin lists, a dependency of S6-T12 and chain 8) · S10-T04 (after the bulk-mapping tool is finished) · S7-T05 (the coin-rate and reward backend, now its own card) · S8-T02 (finish) · S0-T09.
- *Entry:* S1-T01 done; S0-T03 worker on; S8-T01 done; S2-T03 aliases merged (the menu itself is FINAL, D107).
- *Exit (ACs):* `AC-ADM-QE1.*..QE6.*`, `AC-ADM-Q03..Q09.*`, `AC-ADM-G7.1`, `AC-ADM-G7.3`; AC-X3-1 (T1 and T5 both practise); `AC-ADM-C05.*` on the dataset; `AC-GUR-5-*`, `AC-AS-5-*` (S10-T04); AC-X6-1 for S2 screens at 375/768/1280.
- *Demo:* (1) Studio: create a stimulus then three questions without re-uploading the figure; (2) upload a PDF fixture: batch finishes, Rajah 3 → Q5–8 grouped, reviewer adjusts range, accept; (3) completeness panel names missing fields; (4) CSV with DSKP columns publishes; (5) sidebar "Soalan" group = 9 items, V2 paths redirect; (6) T1 pupil practises.

**Sprint 3 — "T5 pupil on UAT sits a published Bijak SPM paper with stimulus groups on a phone".**
- *Cards:* S1-T06, T09a, T09b (these first in the sprint) · S3-T02, T04, T08 · S8-T03, T04, T05 · S9-T06 (chains 1, 2, 5) · S2-T04, T08, T10, T09(P2 optional) · S5-T02, T03, T07 · S4-T08, T04 (script and apply, after the Sprint 2 servability work) · S3-T05 · S10-T05 · S6-T07, T08.
- *Entry:* Sprint 2 exit; S4 Bab mapping tool ready.
- *Exit (ACs):* `AC-MUR-13-*` (Bijak part), `AC-MUR-QP-1..17`, `AC-ADM-Q17.*`, `AC-ADM-C01.*`, `AC-ADM-U01..U04.*`, AC-X6-2, AC-X6-1 for every question-paper screen; `AC-MUR-9-*`, `AC-MUR-16-*`, `AC-ADM-Q13.*, AC-ADM-Q14.*, AC-ADM-Q15.*, AC-ADM-Q16.*`, `AC-ADM-QE7.*`, `AC-ADM-G7.2`, AC-X3-1, **AC-CHAIN-1, AC-CHAIN-2, AC-CHAIN-5** (S9-T06, headed browser). UAT ops: U-OP-07 (Bab mapping, T4-T5 core subjects), U-OP-05/06 (quarantine and stem clean-up), U-OP-04 (Kontrak Disahkan), U-OP-08 (pool seed), U-OP-09 (Terbit): script-run steps executed by the designated UAT developer (dry-run, report, user approval, real run); content steps (Bab mapping, figures, regroup) done by ADMIN users in the Portal Pentadbiran (D110).
- *Demo:* (1) admin builds a paper in the single Set Builder from groups, publishes with a Disahkan contract; (2) on **UAT** the T5 pupil on a 375 px headed browser sits it: figure shown once, zoomable, navigator, Hantar, result; (3) Soalan by Chapter lists the chapters, all open (no 70% rule); (4) regroup work-list shows counts; id 812791-like items are no longer served.

**Sprint 4 — Delivery A: remaining P0 and P1 part A.**
- *Goal:* "Kertas Subjektif with pupil self-mark works (no flag), Tracking A, Kiriman Guru, the pupil Dashboard/Profile, the school-admin reports, teacher Set Soalan and Misi Harian work."
- *Cards:* S3-T06, T07 · S1-T08 · S2-T05, T06 · S4-T09 · S5-T05, T08, T09, T11 · S6-T06 (after the Kiriman Guru backend), T10, T11, T14 · S8-T05, T07 · S10-T06, T07 · S7-T01, T03, T09 · S0-T10.
- *Exit (ACs):* `AC-MUR-13-*` (all), `AC-MUR-17-*`, `AC-MUR-26-*`, `AC-MUR-2-*`, `AC-MUR-A1-*`, `AC-MUR-A2-*`, `AC-MUR-A3-*`, `AC-GUR-44-*` (except AC-GUR-44-9), `AC-GUR-8-*`, `AC-GUR-8b-*`, `AC-GUR-41-*`, `AC-GUR-42-*`, `AC-AS-46-*..AC-AS-53-*`, `AC-ADM-Q12.*, Q18.*, Q20..Q23.*`, `AC-ADM-N01.*, N05.*, N06.*, N07.*`; AC-X2-3 check switches to **fail** mode and is green; **AC-CHAIN-3, AC-CHAIN-4, AC-CHAIN-6, AC-CHAIN-8, AC-CHAIN-10** (S9-T06).
- *Demo:* teacher sends a PDF paper → admin sees it in Kiriman Guru; teacher publishes a Set Soalan → pupil of the class plays it; a subjective paper is sat and self-marked on a phone; school-admin reports show the same numbers.

**Sprint 5 — Delivery A: linked modules (D106).**
- *Goal:* "Every module linked from a 1.0 screen works: Artikel, Syiling/Tukar Token/Cabaran Harian, Kedai Hadiah, Papan Pendahulu/Kedudukan/Tournament, with their admin feeds."
- *Cards:* S7-T04, T06, T11 · S5-T12 (Artikel part) · S6-T07 (Misi Harian), T12 leftovers · S6-T16, T17, T18, T19, T20 (Alat Soalan tools) · S4-T07 leftovers · S10-T05 · S9 verification of Sprint 4.
- *Exit (ACs):* `AC-MUR-20-*`, `AC-MUR-28-*`, `AC-MUR-29-*`, `AC-MUR-30-*`, `AC-MUR-31-*`, `AC-MUR-33-*`, `AC-MUR-18-*`, `AC-MUR-23-*`, `AC-ADM-P2-01.*..P2-09.*`, `AC-ADM-P2-14.*`, `AC-ADM-P2-15.*`, `AC-ADM-P2-18.*`, `AC-GUR-2-*`, `AC-GUR-44-9`, `AC-GUR-44a-*..AC-GUR-44e-*`; no dead link from any 1.0 screen (AC-X2-2); **AC-CHAIN-9** (S9-T06).
- *Demo:* click every link on the pupil Dashboard, Kelas Saya and Profil; admin sets a challenge and a reward, the pupil earns and redeems it.

**Sprint 6 — Delivery A hardening and release candidate.**
- *Goal:* "Every Delivery A module passes on UAT, side by side with V2, at 375/768/1280; the user signs off Delivery A."
- *Cards:* carry-over and fixes from S9 findings; S9-T03 (XL pass), S9-T04 (release checklist). No new scope.
- *Exit (ACs):* all Delivery A ACs; AC-X2-1, 2, 3; **AC-CHAIN-1..6, 8, 9, 10 re-run green (S9-T06 exit gate)**; AC-X6-1 for every Delivery A screen; AC-X6-2; AC-X3-1; release checklist §8; `node scripts/r1-trace-check.mjs` prints `uncovered: 0 | dangling: 0`.
- *Demo:* full run as pupil, teacher, school admin, admin; open every sidebar item and every link; the checklist.

**Sprint 7+ (Delivery B)** — one sprint goal per module cluster, exit by ACs: Sprint 7 S7-T07 (Cabutan, Kotak Misteri, Rujuk Kawan), S7-T08 (Marketplace), S5-T12 (Topik, Peta Belajar, Audio KBAT), S5-T13 (PKSK); Sprint 8 S7-T10 (Tiket Bantuan; exit AC-CHAIN-7), S6-T13, S6-T15, S10-T08, S5-T14, S0-T11 (flags); Sprint 9 hardening and Delivery B sign-off. Each Delivery B module goes live by removing its scope flag (S0-T11), only after its ACs pass.

### 5B. Capacity variants: the same backlog on 1, 2, 3 and 5 developers

The sector assignment per variant is the table in §5.3. Rules for every variant:
1. P0 cards of the sprint list in §5A come before any P1 card, whatever the variant.
2. The order of sprint *goals* is fixed (portal P0 and answer store → question entry → Bijak on phone → P1 → hardening → Delivery B), so fewer developers means more sprints per goal, not a different order.
3. Sector ownership stays disjoint: a team (or developer) holds whole sectors by lock, and a sector is never split between two teams at the same time. Exception: S5 and S6 may be split by sub-folder if the team that holds the sector agrees in a comment on the sector's mirror line in #502.
4. At 1 developer, the Delivery Lead decides the order after each sprint and the user is told the new expected date.
5. Sprint 0 for fewer than 5 developers: S0-T01..T04, S8-T01 first; S4-T01/T02 and the rest of Sprint 0 follow in Sprint 1.

---

## 6. Claim-and-track mechanism

The working rules are stated once in [`R1-START-HERE.md`](R1-START-HERE.md) (decisions 1 to 9). This section is the plan-side summary; if the two differ, START-HERE wins. Questions: [`R1-FAQ.md`](R1-FAQ.md).

### 6.1 Artefacts
- **The lock** (`scripts/r1-lock.mjs`, remote branch `r1-lock/<KEY>`) is the only truth about who holds a sector or a card. It does not depend on the GitHub user, because several Claude accounts may share one GitHub identity. `node scripts/r1-lock.mjs --help` prints the cheat-sheet.
- **The board = GitHub issues + labels + milestones.** One issue per task card (title `S3-T04 Pupil sitting and result (Bijak SPM)`), created from the card by `scripts/r1-create-issues.mjs` (App. A is the form for a card added by hand). The issue shows the card, the gap-check checklist, the definition of done and the "How to claim" rules; `node scripts/r1-create-issues.mjs --update-bodies` refreshes the rules and, with `--with-card`, the card text, milestone and labels. There is no `r1-board.md` and no board file of any kind.
- **Labels (the complete list):** `r1` · `sector:S0..S10` · `type:fix|complete|build|keep|verify|ops` · `prio:P0|P1|P2` · `status:ready|in-progress|in-review|blocked|done` · `r1-delivery:A|B` · `team:<team>` (created by the team lead on first use) · `needs:S0..S10` (a cross-sector PR, or a request waiting on that sector). Stuck: `status:blocked` plus a `QUESTION:` comment. Size (S/M/L) is on the card, not a label. The sprint is the milestone `R1 Sprint 0..N`.
- **Pinned issue #502 "R1 sector claims":** one mirror comment per sector hold. **Pinned issue #503 "R1 daily":** the designated UAT developer's name (first line), the deployed UAT commit after each deploy, requests for UAT test accounts or a deploy, and one daily report comment per team.
- **`docs/plan/r1-ac-ledger.md`:** one row per AC and env (§6.9). The result of every AC lives only there.

### 6.2 Holding a sector
A team registers once (`register-team`) and then locks whole sectors (`acquire S<n>`). **"Sector lead" means the team that holds the sector lock;** there is no other sector lead and no list of leads in a file. After a successful lock the team posts one mirror comment in #502: `[<team>] holds S<n> (sessions S-1, S-3)`. A team holds at most 3 sectors (a convention) and never holds one idle for more than 1 day. S9 is the Delivery Lead's and cannot be claimed. Handing a sector over = `release` by the old team, `acquire` by the new team, and an edit of the #502 comment.

### 6.3 Claiming a task
1. Pick a card in a sector your team holds, in the current sprint milestone, P0 first (`status:ready`).
2. Check the card's `deps:`. **A dependency is satisfied when its PR is merged into `feature/v3-bijak-r1` and CI is green.** Wait for `status:done` of a dependency only when the card says "needs data on UAT".
3. **Lock the card:** `node scripts/r1-lock.mjs acquire S<n>-T<nn> --team <team> --session S-<k>` (exit 3 = another team holds it, exit 4 = your team does not hold the sector). Then mirror it: label `team:<team>` and the comment `[<team>/S-<k>] claimed`. **Self-assigning the issue or commenting `/claim` means nothing.**
4. **Post the gap check** (table FR/AC | works / broken / missing | file::symbol | planned change) as a comment, then set `status:in-progress`. **A card cannot be `status:in-progress` before the gap check is posted** (§0B).
5. Create the branch (6.4), open a **draft PR** within one working day, work on it.
6. WIP limit: per session one card `in-progress` and at most one `in-review`; at most 2 independent cards per session.
7. A card in a sector held by another team is never claimed: ask that team through a cross-sector PR (6.4) or a comment with the label `needs:S<n>`.

**Stale locks.** Every lock needs a heartbeat at least once a day (`heartbeat-all`). A lock with no heartbeat for 24 h is STALE (calendar hours). Before a weekend or leave the team runs `heartbeat-all` and writes `[<team>/S-<k>] away until <date>` in #503. The product owner may break a STALE lock (`break ... --owner`) after 1 working day without an answer in #503. A draft PR with no push for 3 working days is closed with a note; the branch is kept.

### 6.4 Branches, PRs
- **Naming (one convention):** branch `r1/<team>/<card-id>-<slug>` from `feature/v3-bijak-r1` (example `r1/team-amin/S3-T04-pupil-sitting`); commit in the repo's conventional style with the card at the end (`fix(s3): ... (S3-T04)`); PR title `[<team>/S-<k>] S3-T04 <title>`; the PR body names **exactly one** card ID; every issue and PR comment starts with `[<team>/S-<k>]`. The repo `CLAUDE.md` rule `feature/<slug>` is for non-R1 work.
- **PR template** (App. B): card ID, `Cross-sector:` line, gap-check link, existing files changed, the reason for each new file, DM/API IDs, scope-guard and canonical-map results, every AC with its `[CI]`/`[UAT]`/`[CI+UAT]` tag, the list "ACs awaiting UAT", migration number from your range, contract change, real test output, deviations from the PRD text, placeholder-string check.
- **Cross-sector small PR (R1-START-HERE decision 7).** A change in another sector's files (a migration number, a contract index entry, a menu line, a delete-only PR) is a small PR that names the card it serves in the body, adds the line `Cross-sector: S<n> (<reason>)` and the label `needs:S<n>`. It is not a card of its own and does not need the lock of S<n>. The team that holds S<n> reviews it **within 1 working day**; if no team holds S<n>, the product owner reviews it. Use only your own sector's migration range (§3); a migration in another range is requested from the team that holds that sector. Order for work that needs several sectors: the schema PR first, then the contract PR, then the code.
- **Review and merge.** The author's **team lead** reviews against the card, the gap check and the guardrails and comments `[<team>/S-<k>] review: approved` (or the exact changes needed). **The product owner (`@aminfaudzi`) merges** (squash, title `S3-T04 ...`) after green CI. Nobody else merges. `.github/CODEOWNERS` names `@aminfaudzi` for every path; sector ownership is by lock, not by CODEOWNERS (App. C).

### 6.4a Board rules from the improve-not-rebuild guardrails (§0B)
- `status:in-progress` needs the gap check comment; `status:in-review` needs the PR with exactly one card ID and the scope-guard job green.
- The reviewer rejects a Fix or Complete PR that does not touch its "Starts from" files or that adds a parallel page, service, store, route or table; a schema change must name a DM ID and an endpoint an API ID (guardrail 3).
- Change budget by Type (Keep and Verify: no product code; Fix and Complete: the "Starts from" files, new files only if the card names them; Build: new files only at the named location; Ops: no product code). A Verify card that needs product code is re-typed Fix or Complete in the issue before any code.
- A card moves to `status:done` only after UAT Pass of every one of its ACs and of every AC-CHAIN-n through it (6.5).

### 6.5 Proving and moving to Done (D113)
1. **CI first (before the merge).** The team proves every `[CI]` AC by a named automated test, writes CI rows in the ledger (the PR may carry them) and lists the `[UAT]` ACs as "ACs awaiting UAT" in the PR.
2. **Merge.** Team lead review, then the product owner's merge.
3. **Deploy.** The **designated UAT developer** deploys `feature/v3-bijak-r1` to UAT once a day after CI is green (on request during Slice 0) and posts the deployed commit in #503. Nobody else deploys.
4. **UAT acceptance by the card's team.** Once the deployed commit contains the card's merge, the team runs the `[UAT]` ACs and every AC-CHAIN-n through the card on UAT in a **visible browser at 375, 768 and 1280** with the team's shared test accounts (created privately by the designated UAT developer: one account per role per team; never written in the repo, an issue, a PR or a log) and writes one Pass/Fail row per AC in `docs/plan/r1-ac-ledger.md`. Test records carry the prefix `UJI <team> <date>` and are removed by the creating team the same day.
5. **Done.** The team lead sets `status:done` and closes the issue when every AC has a Pass row for its tag. A Fail row re-opens the card (`status:in-progress`); the fix is deployed and a new row is added below the Fail row.
6. **Delivery Lead verification.** Each sprint the Delivery Lead (S9-T01, S9-T03) re-runs a sample of the Pass rows, does the V2 side-by-side comparison (§8, X7) and may re-open a card; a card team never opens V2.

### 6.6 Mirror formats
```
#502 sector line:   [team-amin] holds S1 (sessions S-1, S-3)
issue claim:        [team-amin/S-2] claimed            (label team:team-amin)
issue gap check:    [team-amin/S-2] gap check          (table FR/AC | works / broken / missing | file::symbol | planned change)
PR review:          [team-amin/S-1] review: approved
question:           [team-amin/S-2] QUESTION: <question>; the two places that disagree; my suggested answer   (status:blocked)
#503 UAT notice:    UAT deployed: <short commit sha> on <date>          (posted by the designated UAT developer)
```

### 6.7 Daily report (one comment per team per day in #503)
```
[<team>] Sectors held: S1, S3. P0 open/closed in my sectors: 5/7. ACs Pass CI/UAT: 41/12.
| Session | Card | Done since last | Now | Blocked by | Next |
|---|---|---|---|---|---|
| S-1 | S1-T01 | gap check + PR open | review | none | S1-T02 |
```

### 6.8 Anti-bureaucracy limits
No separate boards per team; no board file; no merge log file; no per-agent handoff documents; no extra status words; no new documents unless a PRD/ADR must change. Evidence stays in the gitignored `.evidence/` (UAT holds real pupil data: never committed, no names in issues or PRs).

### 6.9 AC ledger
`docs/plan/r1-ac-ledger.md`: one table per sprint with the columns `card | AC / AC-CHAIN ID | env | result | date | team/session | evidence ref`. `env` is `CI` or `UAT`, `result` is `Pass` or `Fail`, the evidence ref is only the name of a local `.evidence/` path or of the automated test. A row is added by the card's own team in a docs-only PR; rows are never deleted. Sprint review reports "ACs passing / ACs planned" from this file. The rules (who writes, privacy, test-record cleanup) are in the file itself.

---

## 7. Environments and data

**Run the stack.** `npm ci` → `npm run stack:up` (compose.yaml + compose.http.yaml; builds the SPA in `VITE_API_MODE=http`, migrates and seeds the demo data). Ports 5192/5193 (UI) as in the stack docs; `npm run stack:down`. Dev loop without Docker: `npm run be:dev` (API :3000) and `VITE_API_MODE=http npm run dev` with `COOKIE_SECURE=false` in `.env.api` (`docs/plan/http-switch-checklist.md`). Checks: `npm run typecheck`, `npm run lint`, `npm test`, `npm run be:verify`, `npm run contract:check`, `npm run test:e2e:http -- --grep @api`, `node scripts/r1-scope-guard.mjs`, `node scripts/r1-canonical-map.mjs --check`. Env files: copy `.env.example`, `.env.api.example`, `.env.db.example`; local demo logins are in `docs/AKAUN-DEMO-LOCAL.md`. **Until S0-T02 is merged the stack may not start** (the e2e seed fails): use unit tests, typecheck, lint and `npm run be:dev` as above. A session without Docker (a cloud session) runs unit, typecheck, lint and contract checks only and marks stack/e2e ACs "awaiting CI/UAT".
**Seeds (CI tests only, D110).** Demo seed (small). E2E profile: `E2E_SEED=1 npm run be:db:seed -- --profile=e2e` (`docs/ops/e2e-seed.md`; needs S0-T02 first). `uat-like` fixture profile: S4-T01. These feed automated tests in CI; they are not acceptance data.
**Acceptance environment (D110, D113).** Acceptance, AC proofs and AC-CHAIN-1..10 run on **UAT (`uat.prestasiplus.cloud`), a clone of V2 production data**, after the designated UAT developer deploys `feature/v3-bijak-r1` (daily, after CI is green; on request during Slice 0) and posts the commit in #503. There is no local acceptance environment, no UAT dump, no anonymised local restore and no synthetic acceptance profile. UAT holds real pupil data: screenshots and evidence stay in the gitignored `.evidence/`, are never committed, and issues/PRs carry only pass/fail and IDs, never names.
**Accounts.** Demo accounts are for local and CI tests only. On UAT the **designated UAT developer** creates, through the admin UI on a dedicated test school, **one account per role per team** (Admin Pusat, Admin Sekolah, Guru, Murid T1, T2, T3, T4, T5) and shares the credentials **privately** with the team leads. Credentials are never written in the repo, an issue, a PR, a comment, a log or the ledger. A new developer asks their team lead, who asks in #503: `[<team>/S-<k>] needs UAT test accounts for <team>`. The designated UAT developer is the person named by the product owner in the first line of #503 (`UAT developer: @handle`). Test records created during an AC run carry the prefix `UJI <team> <date>` and are removed by the creating team the same day (rules in `docs/plan/r1-ac-ledger.md`).

### Who does what (RACI, D110)

R = does it, A = accountable, C = consulted, I = informed.

| Activity | Designated UAT developer | Other developers | Admin users (ADM) | Delivery Lead | User |
|---|---|---|---|---|---|
| Build and fix the Portal Pentadbiran screens (question entry, "Soalan tanpa Bab", diagram audit, regroup work-list) | C | R | I | A | I |
| Content work: Bab mapping, figure images, regroup | I | not allowed (build tools only) | R | A (checks results on UAT) | I |
| Script data operation on UAT (dry-run, report, real run) | R | C (tool author) | I | A | approves every write |
| Unit/integration tests, CI (lint, typecheck, test) | C | R | n/a | I | n/a |
| Deploy `feature/v3-bijak-r1` to UAT (daily; post the commit in #503) | R | I | I | A | I |
| Create the shared UAT test accounts (one per role per team, shared privately) | R | I | I | A | I |
| AC proofs and AC-CHAIN-1..10 on UAT after the deploy (the card's team, ledger rows) | C (restores state) | R (the card's team) | C | A (samples and re-opens; V2 side-by-side) | I (demo) |
| Server or environment change on UAT | R | not allowed | n/a | A | approves |
| Any action on V1, V2 or a server by an AI session (using UAT in a browser with the shared test accounts is allowed) | not allowed | not allowed | not allowed | not allowed | not allowed (D95) |

### UAT data operations runbook

The IDs are the 17 UAT data tasks of PRD 30 §5 (U-OP-01..17). Owner key (D110): **OPS** = **the designated UAT developer** who has server access (an operational assignment named by the product owner in the first line of #503; D95 still holds: **no AI session acts on a server**); **ADM** = Admin Pusat users working in the Portal Pentadbiran; **DEV** = a developer builds the tool or screen, then OPS or ADM uses it. **The user approves every write operation.** Every script operation is run by the designated UAT developer in this order: dry-run (default), report written to `.evidence/uat-ops/`, the user's explicit approval in the conversation ("approve U-OP-nn"), then the real run; a backup (`docs/ops/db-backup.md`) comes first. **Content work (Bab mapping, figure images, regrouping) is ADM work in the UI; developers never do it**, and scripts only produce dry-run reports or assist a bulk action an admin confirms in the UI. V1, V2 and UAT are never modified outside this list.

| Order | ID | Operation (PRD 30 §5) | Owner | Approval | Needs first | Tool card |
|---|---|---|---|---|---|---|
| 1 | (backup) | Backup of the UAT DB | OPS | user | none | n/a |
| 2 | U-OP-02 | Intake environment: `JOBS_WORKER_ENABLED=true`, `OCR_ENGINE=tesseract` + `OCR_LANG_DIR` (real in-house OCR, D112(2); no external AI provider; the mock OCR is for CI tests only, never on UAT; an admin reviews every extracted item before publish) | OPS | user | S0-T03 merged | S0-T03 |
| 3 | U-OP-03 | Deactivate Darjah D1-D6 in `Tahap Pendidikan`; check public stats and pickers | ADM | user | S4-T05 merged | S4-T05 |
| 4 | U-OP-01 | **DSKP loader** (`npm run dskp:load -w @pp/api -- --dry-run`, then real; T4-T5, T1-T3 when extracts exist, and every other SPM subject offered once its DSKP is loaded by S4-T09, D112(3)) | OPS | user | backup; dry-run report reviewed | S4-T02 |
| 5 | U-OP-12 | Acceptance accounts on a dedicated test school ("Janakan Akaun"): per team Admin Pusat, Admin Sekolah, Guru and Murid T1, T2, T3, T4, T5; credentials shared privately with the team leads (never in the repo) | OPS (through the admin UI) | user | S6-T12 | S6-T05 |
| 6 | U-OP-07 | **Bab mapping** in bulk by filter, T4-T5 core subjects first (no auto-mapping, D89) | ADM | user, after dry-run counts | 01, S4-T03, S2-T08 | S4-T03 |
| 7 | U-OP-05 | **Regroup**: detect and quarantine stimulus-less and duplicated-stem questions (server rule, servability reason) | DEV tool, OPS runs the detector, ADM regroups and supplies figure images in the work-list | user | 01, S1-T07, S2-T04 | S1-T07, S4-T04 |
| 8 | U-OP-06 | Clean-up of duplicated stem/prompt on migrated questions (FR-ADM-G7.6) | DEV tool, OPS runs (dry-run, report, approval, real) | user | 05 | S4-T04 |
| 9 | U-OP-04 | **Kontrak Disahkan** in Kontrak (D95: created by an admin, not seeded), Mat Tambahan K2 3472/2 first | ADM | user | 01, 07, S3-T01 | S3-T01 |
| 10 | U-OP-08 | Seed the pool for blueprint papers: one real trial paper per launch paper via Import & Semakan | ADM | user | 02, S1-T03, S2-T02 | S3-T08 |
| 11 | U-OP-09 | **Terbit papers** in Set Builder under Disahkan contracts, verified as a T5 pupil | ADM | user | 04, 08 | S3-T08 |
| 12 | U-OP-10 | Tracking A: fill each set to target (`Isi set`, `Simpan`) | ADM | user | S3-T05 | S3-T05 |
| 12b | U-OP-15 | Tingkatan 1-3 chapters/topics created by the admin in Kurikulum when the migrated data has none (FR-ADM-C01.6), then bulk-map (U-OP-07) | ADM | user | E-03, S4-T07 | S4-T07 |
| 13 | U-OP-11 | Flags: `latih-tubi` ON, `permainan` ON, `kertas-subjektif` ON (D104); Delivery B modules ON as built | ADM | user | S0-T10 / S0-T11 | S0-T10 |
| 14 | U-OP-14 | Remove QA test data (questions 1272-1276, batches 1-2, papers 6-8) if present; at the end of each sprint list the leftovers with the prefix `UJI ` and remove them | ADM (OPS lists) | user | none | n/a |
| 15 | U-OP-16 | Set the support contact in `Tetapan` (N-07) | ADM | user | N-07 built | S7-T09 |
| 16 | U-OP-17 | **Regroup work-list** (QE-08): regroup per subject and Tingkatan (Sains T4 first), attach the real figures, re-run the detector report | ADM | user | 05, QE-08 built | S2-T04 |
| Delivery B | U-OP-13 | Activate digital rewards, tier values, challenges, reward budgets | ADM | user | P2-02, 03, 07, 09 | S7-T05 |

**Bijak content owner and first batch (D112(4)).** Bijak content (Kontrak, trial-paper intake, Set Builder papers, Terbit) is owned by Admin users (D110), not by developers. The first content batch is the 6 subjects that have sample papers: Bahasa Melayu, Bahasa Inggeris, Matematik, Matematik Tambahan, Fizik and Sejarah. Kertas 1 first; Kertas 2 after the scheme editor is built. A subject outside this batch follows only after its DSKP is loaded (S4-T09). Content admins: named by team leads in issue #502 / #503 (an operational assignment, not a doc decision).

There is no local rehearsal dataset (D110): each script step runs as a dry-run on UAT and the dry-run report is attached to the approval request. Rollback = restore from the backup; scripts are insert-only and idempotent where possible (as `dskp:load`). After each step the affected ACs are re-run on UAT in a visible browser (T5 pupil first) by the team that owns the card, and the Delivery Lead samples the result.

---

## 8. Definition of Done and release checklist (PRD §X7)

**Per task:** DoD-T (§4) with the D113 proof order: CI first, then UAT after the designated UAT developer's deploy, rows in `docs/plan/r1-ac-ledger.md`, `status:done` only after UAT Pass (§6.5). **Per sector:** every card Done; no file in the sector's paths contains a placeholder string; the sector's mock paths are gone from the http build (S0-T09 green); the sector's rows in the sidebar-walk spec are green; the team holding the sector has no open Blocker/Major review comment; docs of the sector updated.
**Per sprint:** "Sprint done" (§5A).
**Per phase / release checklist (Delivery Lead):**
1. **Placeholders:** `scripts/check-placeholders.mjs` green (AC-X2-3); a manual grep of the built bundle for `akan datang`, `belum tersedia`, `Pratonton`, `prototaip`; no `PrototypeUnavailablePage` on a matrix route; the only allow-list entry is the officers' PPD/JPN page (register row 18).
2. **Sidebar:** for each role (Murid, Guru, Admin Sekolah, Admin) every item opens a screen with the PRD title and no 403/404/"Akses Ditolak" or another role's screen (AC-X2-1), and every button/link in every matrix module completes against the real API with no mock data (AC-X2-2) — done in a visible browser, recorded in the ledger.
3. **Responsive:** every 1.0 screen at 375/768/1280 has no horizontal scroll and nothing clipped (AC-X6-1); a screenshot per width per screen in `.evidence/`; the question-paper screens including AC-X6-2 re-checked on a 375 px headed browser.
4. **Side by side (Delivery Lead only; card teams never open V2):** each module compared with V2 (V1 for the school-admin rows without V2) at the same width, 3 seconds between V2 pages, one browser; every difference fixed or a numbered fidelity deviation. A module that V2 does not have ("Not observed in V2") is checked against the FR text instead.
5. **UAT data (acceptance environment, D110, D113):** all P0/P1 ACs and AC-CHAIN-1..10 have a Pass row on UAT (clone of V2 production data) in the ledger, run by the card teams and sampled by the Delivery Lead; evidence only in `.evidence/`; no `UJI ` test record is left behind; §7 U-OP-01..U-OP-12 done; UAT "Tahap" = 5; Bab mapping coverage reported; counts agree across screens (XS-1..5, FR-X4-1/2).
6. **Pupil flows:** T1 and T5 can practise (AC-X3-1); no Darjah anywhere (FR-X3-1); a pupil sees only own data (FR-X4-4).
7. **Quality gates:** `typecheck`, `lint`, `lint:ds`, `npm test`, `be:verify`, `contract:check`, `test:e2e:http`, sidebar-walk, gitleaks, no-dumps all green on the release commit; ADR-0027..0036 not contradicted.
8. **Hidden by decision:** Cikgu Alesa and Keluarga Angkat unreachable by menu and URL (D102/FR-X2-2).
9. **User review:** the user watched the Phase demo and approved. A production deploy only on explicit user confirmation (G6); the daily UAT deploy of `feature/v3-bijak-r1` by the designated UAT developer is not a production deploy.

---

## 9. Risk register

| # | Risk (previous failure mode) | Prevention in this plan |
|---|---|---|
| R1 | **Heavy process again** (teams, boards, 237 merges, thousands of docs) | 11 sectors, one board, one table file, no merge log, no handoff docs; squash merge, PR ≤400 lines; §6.8 limits |
| R2 | **Never verified against V2 / real UAT data** | V-STD mandatory on every card (CI first, then UAT, D113); the Delivery Lead compares with V2 at verification and samples the ledger; exit criteria are passing ACs on UAT data |
| R3 | **"Done" without proof** (tests green, product wrong) | The team lead sets `status:done` only after UAT Pass rows from a visible-browser run at 3 widths; the Delivery Lead samples the ledger and compares with V2; evidence in `.evidence/` |
| R4 | **Headless-only checks miss layout bugs** | Visible browser required; scrollWidth check at 375/768/1280 on every card |
| R5 | **Mock data and prototype pages shipped as features** | AC-X2-3 CI check, S0-T09 mock audit, S0-T05 scope retirement, register 6.2b mapped to cards (rows 1–20 → S0-T05, S0-T06, S5-T05, S6-T01..T09, S7-T02, S10-T02, S1-T08) |
| R6 | **Merge conflicts on shared files** (menu, nav, schema, contract, seeds) | Single owner per shared file, delete-only regions, migration ranges, contract-first PRs, CODEOWNERS (§3) |
| R7 | **Questions still structurally wrong** (figure = question, groups split) | S1-T01 as first S1 card; FR-X1-4 tests in S1-T06; exit criteria Sprint 2/3; AC-X6-2 in a phone demo |
| R8 | **UAT data wrong, so correct code looks broken** (no Bab, 0 contracts/papers, 11 levels) | §7 runbook with fixed order; dry-run reports on UAT; operations run only by the designated UAT developer with the user's approval |
| R9 | **Estimates too optimistic; 1 developer cannot finish** | Stated openly (§5.3); re-base after Sprint 1; scope cut proposals go to the user, not silently |
| R10 | **Sector bottleneck: S0 owns shared files** | 1 working day review SLA; delete-only markers; S0 cards front-loaded in Sprint 0–1; Delivery Lead can reassign reviews |
| R11 | **Cross-sector edits by agreement drift** (e.g. S4-T06 edits `BE/practice/rules.ts`) | Every such case is named on the card, with the owner as required reviewer |
| R12 | **PRD IDs drift after the PRD parts are final** (parts 10, 20, 30, 40, 45, 46, 48 are FINAL) | Cards cite the real PRD IDs; `scripts/r1-trace-check.mjs` fails the build on an unknown or uncovered ID, so a change in the PRD forces a matching change here |
| R13 | **UI changes beyond the request** (user standing rule) | PRD copy is exact BM; any new copy needs approval (D94); menu changes only per PRD 30 §3 after approval |
| R14 | **Privacy**: real names in screenshots/seeds | `.evidence/` is gitignored; fictitious names in seeds; V2 captures are never committed (screens are described in words in the SRS) |
| R15 | **V2 IP block** from rapid access | 3 s between pages, one browser, only the Delivery Lead captures V2 |
| R16 | **339k questions have no Bab and the mapping is human work** (D89: no derived data) | Bulk-by-filter tool (S4-T03, S2-T08), start with T4-T5 core subjects, coverage reported per sprint; the mapping is ADMIN work in the Portal Pentadbiran (D110) |
| R17 | **Delivery B starves Delivery A** | Delivery B cards stay stubs until Sprint 5; flags keep Delivery B modules hidden |

---

## 10. Decisions on the former open questions (all closed)

**Decisions recorded (D110, user, 2026-11-04):** (a) UAT operator = a designated developer with server access, the user approves every write, D95 holds; (b) no local acceptance environment, acceptance on UAT (clone of V2 production data), evidence only in gitignored `.evidence/`, only pass/fail and IDs in issues/PRs; (c) content work is owned by ADMIN users via the Portal Pentadbiran. **D111:** the user approved this plan on 2026-11-04. **D113:** the proof order is CI first, then UAT (two-stage). Nothing is awaiting the user.

1. **Plan, sector split and sprint: decided (D111).** The plan and the 2-week sprint are approved. Which people take which sectors is decided by the teams themselves: a team holds whole sectors by lock (`scripts/r1-lock.mjs`, R1-START-HERE decision 1); the Delivery Lead assigns no person by name.
2. ~~Admin menu approval~~ closed: D107 made the menu FINAL (follows the V2 sidebar).
3. ~~Who does the Bab mapping of ~339k questions and who supplies figure images~~ closed (D110): **ADMIN users** do the content work (Bab mapping, figure images, regrouping) in the Portal Pentadbiran (improved question entry, "Soalan tanpa Bab" work-list, diagram audit, regroup work-list); developers build and fix those screens only. Bulk by filter, no auto-mapping (PRD 30 OQ-03).
4. **T1-T3 DSKP (decided, D109):** T1-T3 use the same DSKP structure as T4-T5, built from the existing chapter and topic data (and any T1-T3 PDF supplied outside the repo); the official PDFs are not required. S4-T09 is not blocked. **D112(3):** S4-T09 also loads the DSKP of every SPM subject offered that has none yet (Kimia, Biologi, Geografi, Perniagaan, Prinsip Perakaunan, Ekonomi) from the official KPM DSKP documents; until a subject is loaded, SP/TP are required only where nodes exist and no Kontrak can be created for it.
5. ~~UAT dump for local use~~ closed (D110): no dump, no anonymised restore, no synthetic acceptance profile; acceptance runs on UAT (a clone of V2 production data). S4-T01 is a CI-only seed.
6. **UAT operations (§7): decided.** The operator is **a designated developer with server access** (D110); the user approves every write ("approve U-OP-nn"). The designated developer is named by the product owner in the first line of the pinned issue #503 (D113-continued, an operational assignment, not a plan decision).
7. **Work location: decided.** The code, the PRD and this plan live in this repository on branch `feature/v3-bijak-r1`; each session has its own clone or worktree (see "Where work happens" in §0). Nothing is copied from elsewhere.
8. **PRD questions that touched cards: all decided.** PRD 30 OQ-01, OQ-QE1 and OQ-QE2 are closed by D107/D108. OQ-06 (server flags, S0-T10): decided by D111, the minimum `feature_flags` table and admin toggle list (DM-34). OQ-Q12 (Kiriman Guru): decided, it reuses intake batches with `source = 'guru'` (FR-ADM-Q12.2, S1-T08). OQ-07 (Subjektif meaning): decided by D104, Kertas Subjektif is a paper lane with pupil self-mark (S3-T06). OQ-G-6 (Headcount key-in design): decided by D-A3, HC-SPEC of 20 R1-GUR-3 is the only definition (S10-T02). Others: OQ-AS-1 (AS dashboard scope) is decided by 20 R1-AS-2, OQ-MUR-1 is **superseded by D101** (S5-T01 opens T1-T3), OQ-MUR-7 (pupil Jana Kertas) is **closed by D112(6)** (out of R1, tab hidden, route 404).

---

## Appendix A — GitHub issue template (`.github/ISSUE_TEMPLATE/r1-card.yml`)

The live file is the source; this copy is kept identical. The issues of the 118 cards are created by `scripts/r1-create-issues.mjs` (not by this form); the form is for a card added by hand. The claim is the lock, not a field (R1-START-HERE decision 1).

```yaml
name: R1 task card
description: One task card of the Release 1 plan (docs/plan/r1-development-plan.md). Rule - gap check first, close gaps, never rebuild.
title: "S?-T?? <title>"
labels: ["r1"]
body:
  - type: markdown
    attributes:
      value: |
        Read `docs/plan/R1-START-HERE.md`, `docs/plan/R1-FAQ.md` and `docs/prd/r1/00-index.md` first. Do the code gap check, post it here, close only the gaps in the existing files.
        The only claim is the lock (`node scripts/r1-lock.mjs --help`); mirror it here with the label `team:<team>` and the comment `[<team>/S-<k>] claimed`. Assigning yourself or commenting `/claim` means nothing.
        Evidence (screenshots, logs) stays in your local `.evidence/` folder. Never put real names, e-mails or credentials in this issue.
  - type: input
    id: card
    attributes:
      label: Card ID
      placeholder: "S3-T04"
    validations:
      required: true
  - type: dropdown
    id: sector
    attributes:
      label: Sector
      options:
        - S0 Platform
        - S1 Question BE
        - S2 Admin question UI
        - S3 Bijak SPM
        - S4 Curriculum and UAT data
        - S5 Murid learning
        - S6 Guru and Admin Sekolah
        - S7 Gamification and games
        - S8 Rendering and responsive
        - S9 Verification
        - S10 Performance and analytics
    validations:
      required: true
  - type: input
    id: lock_team
    attributes:
      label: Team holding the lock (from `node scripts/r1-lock.mjs list`)
      placeholder: "team-amin / S-2"
  - type: dropdown
    id: ctype
    attributes:
      label: Type
      options:
        - Fix
        - Complete
        - Build
        - Keep
        - Verify
        - Ops
    validations:
      required: true
  - type: textarea
    id: prd
    attributes:
      label: PRD refs (module / FR / AC) and Data/API IDs (DM-xx, API-AREA-nn)
      placeholder: "R1-MUR-3; FR-MUR-3-1; AC-MUR-3-*; DM-21; API-AUTH-17"
    validations:
      required: true
  - type: textarea
    id: gapcheck
    attributes:
      label: Gap check (REQUIRED before In progress)
      description: "For every FR/AC of the card: works / broken / missing in the existing V3 code, with file:line evidence. Post this before the first commit."
      placeholder: "| FR/AC | works / broken / missing | file:line | planned change |"
    validations:
      required: true
  - type: checkboxes
    id: startsfrom
    attributes:
      label: Starts-from confirmation
      options:
        - label: I opened every file under "Starts from (existing)" on the card and the gap check is based on that code, not on the PRD alone
          required: true
        - label: The fix is made in those existing files; I add a new file only if the card names it (no parallel page, service, store, route or table)
          required: true
  - type: textarea
    id: approach
    attributes:
      label: Approach (2-6 lines) and the existing files I will touch
    validations:
      required: true
  - type: textarea
    id: contract
    attributes:
      label: API / contract / migration (migration number from the sector range, contract PR if any)
  - type: input
    id: deps
    attributes:
      label: Depends on
      placeholder: "S1-T01, S8-T02"
  - type: checkboxes
    id: dod
    attributes:
      label: Definition of Done
      options:
        - label: Gap check posted before the first commit (works / broken / missing with file:line)
          required: true
        - label: Only the gaps were closed in the existing files; every schema change has a DM ID and every endpoint an API ID
          required: true
        - label: typecheck, lint and tests green (and be:verify for backend), real output in the PR
          required: true
        - label: Tests added as listed on the card
          required: true
        - label: Every AC tagged [CI], [UAT] or [CI+UAT]; the [CI] ACs proven by named automated tests (UI also at 375, 768 and 1280 with no horizontal scroll)
          required: true
        - label: After the designated UAT developer deployed the merge (commit posted in #503), the [UAT] ACs and every AC-CHAIN-n through this card passed on UAT in a visible (headed) browser; rows written in docs/plan/r1-ac-ledger.md
          required: true
        - label: No placeholder string (akan datang / belum tersedia / Pratonton / prototaip) and no mock path in the http build
          required: true
        - label: Evidence (screenshots, logs) kept in local .evidence/<card>/ only; this issue and the PR contain no real names, e-mails or credentials
          required: true
        - label: Team lead review approved and the product owner merged; a cross-sector PR also approved by the team holding that sector (label needs:S<n>)
          required: true
        - label: Card moved to status:done only after UAT Pass
          required: true
```

## Appendix B — PR template (`.github/pull_request_template.md`)

The live file is the source; this copy is kept identical.

```markdown
## Card
Closes #<issue>  ·  Card: S?-T??  (exactly one card ID; `scripts/r1-scope-guard.mjs` reads it)  ·  Sector: S?  ·  Team/session: <team>/S-<k>
Cross-sector: none | `Cross-sector: S<n> (reason)` (only for a small PR that changes another sector's files; also add the label `needs:S<n>`; the team holding S<n> reviews within 1 working day)
Gap check (link to the issue comment/section):
PRD refs (module / FR / AC):
DM / API IDs (required when this PR adds a page, route, controller, model or migration):
Docs-only PR (touches only `docs/**`; no card needed): yes | no

## What changed (3 lines max)
- ...

Existing files changed (from the card's "Starts from"):
New files and the reason for each (only those the card names):

## Endpoints / tables
- ...

## Other-sector paths touched
- none | path -> sector (requires the `Cross-sector:` line above)

## Migration / contract
- Migration number (from my sector range): none | 0???_s?_<slug>
- Contract change: none | contract PR #<n> merged first; `npm run contract:check` output below
- Contract commit: <sha>

## Test evidence (real output)
```
paste the real tail of the output here (typecheck / lint / test / be:verify / contract:check)
```

## Scope guard and canonical map
- `node scripts/r1-scope-guard.mjs --base origin/feature/v3-bijak-r1 --head HEAD` result: PASS | WARN (explain) | FAIL (do not open for review)
- `node scripts/r1-canonical-map.mjs --check` result: PASS | FAIL (do not open for review)
- New route / menu entry / model / API: none | listed, with its DM/API ID and the entry in `docs/plan/r1-canonical-map.json` (no parallel implementation of something that already exists)

## ACs and proof
List every AC of the card with a tag: `[CI]` (proven by a named automated test), `[UAT]` (needs UAT data or a human look) or `[CI+UAT]`.
- AC-...: [CI] test name / result
- UI at 375 / 768 / 1280 with no horizontal scroll (`scrollWidth <= innerWidth`): yes / no / not UI
- **ACs awaiting UAT** (run by the card's team after the merge is deployed to UAT; results go in `docs/plan/r1-ac-ledger.md`): <AC and AC-CHAIN IDs>
- Evidence stays in local `.evidence/<card>/`; never attach images or list names, data or credentials from UAT

## Deviations from the PRD text
- none | numbered list

## Open questions for the team lead
- none | list

## Checklist
- [ ] Exactly one card ID above; gap check posted before the first commit
- [ ] No rewrite of working code; only the gaps of the gap check changed (FR-X1-5)
- [ ] No parallel page, service, store, route or table for something that exists (scope guard and canonical map green); no working page or module deleted or rewritten
- [ ] Every schema change has a DM ID and every endpoint an API ID (listed above)
- [ ] Change budget of the card Type respected (Keep/Verify/Ops: no product code under `src/`, `apps/`, `packages/`)
- [ ] Reviewer: a Fix or Complete PR that touches none of its "Starts from" files or adds a parallel implementation is rejected
- [ ] A duplicated stem is shown once and is not excluded from serving; only `stimulus_missing` and `figure_only` questions are excluded (FR-X1-4)
- [ ] No placeholder strings (akan datang / belum tersedia / Pratonton / prototaip) and no new mock path
- [ ] No secrets, no real names, no personal data in code, seeds, logs, fixtures, docs, this PR
- [ ] Scope/role tests included
- [ ] Branch is `r1/<team>/<card>-<slug>`; PR title is `[<team>/S-<k>] <card> <title>`
- [ ] Team lead review comment `[<team>/S-<k>] review: approved` is on this PR (the product owner merges; the card becomes Done only after UAT Pass)
```

## Appendix C — CODEOWNERS (`.github/CODEOWNERS`)

This appendix is the **sector map**: which path belongs to which sector. The live `.github/CODEOWNERS` maps **every** path to `@aminfaudzi` (the product owner, who reviews as owner of record and merges). **Sector ownership is by locks** (`scripts/r1-lock.mjs`), because several Claude accounts may share one GitHub user; "sector lead" means the team that holds the sector lock. The live file keeps the sector blocks below commented out as this map; a team never gets ownership by uncommenting one. The last matching pattern wins; specific lines come after general ones.

```
# default: product owner (live file: @aminfaudzi for every line below)
*                                         @OWNER-S0

# S0 Platform and shared registries
/.github/                                 @OWNER-S0
/scripts/                                 @OWNER-S0
/compose*.yaml                            @OWNER-S0
/docs/ops/                                @OWNER-S0
/docs/plan/                               @OWNER-S0
/package.json                             @OWNER-S0
/package-lock.json                        @OWNER-S0
/e2e/global/                              @OWNER-S0
/e2e/fixtures/                            @OWNER-S0
/e2e/r1/                                  @OWNER-S0
/src/app/                                 @OWNER-S0
/src/shells/                              @OWNER-S0
/src/api/                                 @OWNER-S0
/src/lib/                                 @OWNER-S0
/src/modules/m01-authentication/          @OWNER-S0
/apps/api/src/common/                     @OWNER-S0
/apps/api/src/modules/auth/               @OWNER-S0
/apps/api/src/modules/jobs/               @OWNER-S0
/apps/api/src/modules/ocr/                @OWNER-S0
/apps/api/src/modules/index.ts            @OWNER-S0
/apps/api/prisma/schema/base.prisma       @OWNER-S0
/apps/api/prisma/schema/identity.prisma   @OWNER-S0
/apps/api/prisma/schema/etl.prisma        @OWNER-S0
/apps/api/prisma/schema/feature-flags.prisma @OWNER-S0
/apps/api/prisma/seed/index.ts            @OWNER-S0
/apps/api/prisma/seed/guard.ts            @OWNER-S0
/apps/api/prisma/seed/e2e*.ts             @OWNER-S0
/apps/api/prisma/seed/core/               @OWNER-S0
/apps/api/prisma/migrations/              @OWNER-S0
/packages/contract/openapi.json           @OWNER-S0
/packages/contract/src/index.ts           @OWNER-S0
/packages/contract/src/openapi.ts         @OWNER-S0
/packages/contract/src/common/            @OWNER-S0
/packages/contract/src/auth/              @OWNER-S0
/packages/contract/src/access/            @OWNER-S0
/packages/contract/src/session/           @OWNER-S0
/src/modules/m13-cikgu-alesa/             @OWNER-S0
/src/modules/m07-pksk/                    @OWNER-S5
/src/modules/m25-ai-centre/               @OWNER-S0
/apps/api/src/modules/cikgu/              @OWNER-S0
/apps/api/src/modules/pksk/               @OWNER-S5

# S1 Question model and pipeline (backend)
/apps/api/src/modules/questions/          @OWNER-S1
/apps/api/src/modules/intake/             @OWNER-S1
/apps/api/src/modules/ai-extraction/      @OWNER-S1
/apps/api/src/modules/files/              @OWNER-S1
/apps/api/src/modules/classes/question-sets/  @OWNER-S1
/apps/api/prisma/schema/questions.prisma  @OWNER-S1
/apps/api/prisma/schema/questions-workflow.prisma @OWNER-S1
/apps/api/prisma/schema/intake.prisma     @OWNER-S1
/apps/api/prisma/schema/ai.prisma         @OWNER-S1
/apps/api/prisma/schema/files.prisma      @OWNER-S1
/apps/api/prisma/seed/questions/          @OWNER-S1
/apps/api/test/intake-workflow/           @OWNER-S1
/packages/contract/src/questions/         @OWNER-S1
/packages/contract/src/question-workflow/ @OWNER-S1
/packages/contract/src/servability/       @OWNER-S1
/packages/contract/src/intake/            @OWNER-S1
/packages/contract/src/ai/                @OWNER-S1
/packages/contract/src/files/             @OWNER-S1

# S2 Admin question UI
/src/modules/m04-question-bank/           @OWNER-S2
/src/modules/m28-bijak-spm/admin/intake/  @OWNER-S2
/e2e/m04*                                 @OWNER-S2
/e2e/bijak/intake-*                       @OWNER-S2
/e2e/bijak/admin-publish-*                @OWNER-S2

# S3 Bijak SPM papers
/src/modules/m28-bijak-spm/               @OWNER-S3
/src/modules/m28-bijak-spm/admin/intake/  @OWNER-S2
/src/modules/m06-spm/                     @OWNER-S3
/packages/exam-core/                      @OWNER-S3
/apps/api/src/modules/spm/                @OWNER-S3
/apps/api/src/modules/bijak/              @OWNER-S3
/apps/api/src/modules/exam/               @OWNER-S3
/apps/api/prisma/schema/exam.prisma       @OWNER-S3
/apps/api/prisma/schema/spm.prisma        @OWNER-S3
/apps/api/prisma/schema/bijak-attempts.prisma @OWNER-S3
/apps/api/prisma/seed/exam*.ts            @OWNER-S3
/apps/api/prisma/seed/spm*.ts             @OWNER-S3
/apps/api/prisma/seed/bijak-standards/    @OWNER-S3
/packages/contract/src/bijak/             @OWNER-S3
/e2e/bijak/                               @OWNER-S3
/e2e/bijak/intake-*                       @OWNER-S2
/e2e/bijak/admin-publish-*                @OWNER-S2

# S4 Curriculum / DSKP and UAT data
/apps/api/src/modules/curriculum/         @OWNER-S4
/apps/api/prisma/schema/curriculum.prisma @OWNER-S4
/apps/api/prisma/seed/curriculum.ts       @OWNER-S4
/apps/api/prisma/seed/curriculum-data/    @OWNER-S4
/apps/api/prisma/seed/spm-subject-configs.ts @OWNER-S4
/apps/api/prisma/seed/uat-like/           @OWNER-S4
/apps/api/scripts/uat-ops/                @OWNER-S4
/docs/reference/dskp/                     @OWNER-S4
/docs/ops/dskp-loader.md                  @OWNER-S4
/packages/contract/src/curriculum/        @OWNER-S4
/src/modules/m03-curriculum/              @OWNER-S4
/src/modules/m03-curriculum/pages/TopicsPage.vue      @OWNER-S5
/src/modules/m03-curriculum/pages/LearningMapPage.vue @OWNER-S5
/src/modules/m03-curriculum/pages/TopicDetailPage.vue @OWNER-S5

# S5 Murid learning, account, content
/src/modules/m05-practice/                @OWNER-S5
/src/modules/m09-content/                 @OWNER-S5
/src/modules/m10-teacher-class/pages/KelasSayaPelajarPage.vue @OWNER-S5
/src/modules/m10-teacher-class/pages/KelasListPage.vue        @OWNER-S5
/src/modules/m01-authentication/pages/Profile*                @OWNER-S5
/src/modules/m01-authentication/routes/profile.ts             @OWNER-S5
/src/modules/m01-authentication/routes/tetapan.ts             @OWNER-S5
/src/lib/lower-form.ts                    @OWNER-S5
/apps/api/src/modules/practice/           @OWNER-S5
/apps/api/src/modules/content/            @OWNER-S5
/apps/api/src/modules/account/            @OWNER-S5
/apps/api/src/modules/classes/kelas-saya.controller.ts @OWNER-S5
/apps/api/prisma/schema/practice.prisma   @OWNER-S5
/apps/api/prisma/schema/content.prisma    @OWNER-S5
/apps/api/prisma/seed/practice.ts         @OWNER-S5
/apps/api/prisma/seed/content.ts          @OWNER-S5
/packages/contract/src/practice/          @OWNER-S5
/packages/contract/src/content/           @OWNER-S5
/packages/contract/src/account/           @OWNER-S5

# S10 Performance and analytics (m08)
/src/modules/m08-student-performance/     @OWNER-S10
/apps/api/src/modules/reports/performance/ @OWNER-S10
/apps/api/src/modules/heatmap/            @OWNER-S10
/apps/api/prisma/schema/reports.prisma    @OWNER-S10
/packages/contract/src/reports/           @OWNER-S10
/packages/contract/src/heatmap/           @OWNER-S10

# S6 Guru and Admin Sekolah, Admin Pusat users/monitoring
/src/modules/m10-teacher-class/           @OWNER-S6
/src/modules/m10-teacher-class/pages/KelasSayaPelajarPage.vue @OWNER-S5
/src/modules/m10-teacher-class/pages/KelasListPage.vue        @OWNER-S5
/src/modules/m11-teacher-analytics/       @OWNER-S6
/src/modules/m12-kirkpatrick/             @OWNER-S6
/src/modules/m17-admin-dashboard/         @OWNER-S6
/src/modules/m18-ppd-jpn/                 @OWNER-S6
/src/modules/m27-school-admin/            @OWNER-S6
/src/modules/m02-users-schools/           @OWNER-S6
/apps/api/src/modules/school-admin/       @OWNER-S6
/apps/api/src/modules/command-center/     @OWNER-S6
/apps/api/src/modules/classes/            @OWNER-S6
/apps/api/src/modules/classes/question-sets/  @OWNER-S1
/apps/api/src/modules/classes/kelas-saya.controller.ts @OWNER-S5
/apps/api/src/modules/reports/analytics/  @OWNER-S6
/apps/api/src/modules/reports/kirkpatrick/ @OWNER-S6
/apps/api/src/modules/users/              @OWNER-S6
/apps/api/src/modules/schools/            @OWNER-S6
/apps/api/src/modules/parents/            @OWNER-S6
/apps/api/prisma/schema/classes.prisma    @OWNER-S6
/apps/api/prisma/schema/schools.prisma    @OWNER-S6
/packages/contract/src/classes/           @OWNER-S6
/packages/contract/src/school-admin/      @OWNER-S6
/packages/contract/src/schools/           @OWNER-S6
/packages/contract/src/admin/             @OWNER-S6

# S7 Gamification, games, marketplace
/src/modules/m14-gamification/            @OWNER-S7
/src/modules/m15-rewards-shop/            @OWNER-S7
/src/modules/m16-battle-games/            @OWNER-S7
/src/modules/m20-marketplace/             @OWNER-S7
/src/modules/m21-sponsorship/             @OWNER-S7
/src/modules/m22-support-tickets/         @OWNER-S7
/apps/api/src/modules/gamification/       @OWNER-S7
/apps/api/src/modules/games/              @OWNER-S7
/apps/api/src/modules/battle/             @OWNER-S7
/apps/api/src/modules/shop/               @OWNER-S7
/apps/api/src/modules/marketplace/        @OWNER-S7
/apps/api/src/modules/wallet/             @OWNER-S7
/apps/api/src/modules/sponsorship/        @OWNER-S7
/apps/api/src/modules/subscriptions/      @OWNER-S7
/apps/api/src/modules/support/            @OWNER-S7
/apps/api/src/modules/notifications/      @OWNER-S7
/apps/api/prisma/schema/gamification.prisma @OWNER-S7
/apps/api/prisma/schema/games.prisma      @OWNER-S7
/apps/api/prisma/schema/battle.prisma     @OWNER-S7
/apps/api/prisma/schema/marketplace.prisma @OWNER-S7
/apps/api/prisma/schema/wallet.prisma     @OWNER-S7
/apps/api/prisma/schema/sponsorship.prisma @OWNER-S7
/apps/api/prisma/seed/games.ts            @OWNER-S7
/apps/api/prisma/seed/battle.ts           @OWNER-S7
/apps/api/prisma/seed/gamification*.ts    @OWNER-S7
/apps/api/prisma/seed/marketplace.ts      @OWNER-S7
/apps/api/prisma/seed/wallet.ts           @OWNER-S7
/packages/contract/src/gamification/      @OWNER-S7
/packages/contract/src/games/             @OWNER-S7
/packages/contract/src/battle/            @OWNER-S7
/packages/contract/src/marketplace/       @OWNER-S7
/packages/contract/src/notifications/     @OWNER-S7

# S8 Question rendering and responsive (shared display layer)
/src/components/                          @OWNER-S8
/src/ds/                                  @OWNER-S8
/src/theme/                               @OWNER-S8
/src/styles/                              @OWNER-S8
/src/modules/m28-bijak-spm/components/PartInput.vue       @OWNER-S8
/src/modules/m28-bijak-spm/components/PartNode.vue        @OWNER-S8
/src/modules/m28-bijak-spm/components/QuestionBlock.vue   @OWNER-S8
/src/modules/m28-bijak-spm/components/RichText.vue        @OWNER-S8
/src/modules/m28-bijak-spm/components/MathField.vue       @OWNER-S8
/src/modules/m28-bijak-spm/components/MathKeyboard.vue    @OWNER-S8
/src/modules/m28-bijak-spm/components/StimulusStack.vue   @OWNER-S8
/src/modules/m28-bijak-spm/components/StimulusView.vue    @OWNER-S8
/src/modules/m28-bijak-spm/components/StimulusChip.vue    @OWNER-S8
/src/modules/m28-bijak-spm/components/NavigatorPanel.vue  @OWNER-S8
/src/modules/m28-bijak-spm/components/AttemptShell.vue    @OWNER-S8

# S9 Delivery Lead: PRD and plan
/docs/prd/                                @OWNER-S9
/docs/TRACKER.md                          @OWNER-S9
/docs/qa/                                 @OWNER-S9
```
