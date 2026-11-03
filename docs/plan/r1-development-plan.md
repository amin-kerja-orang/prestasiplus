# PrestasiPlus V3 — Release 1 development plan

**Status:** DRAFT for user approval. **Date:** 2026-11-04. **Owner:** Delivery Lead. **Language:** English (UI copy quoted in BM).
**Document set:** `docs/prd/r1/00-index.md` (entry) → `01-product-overview.md` (PRD/BRD) → `02-urs.md` (user requirements) → SRS per portal `10-murid.md`, `20-guru-admin-sekolah.md`, `30-admin-pusat.md` → `40-cross-cutting.md` (cross-cutting and NFR) → `50-data-model-erd.md` (DM) → `60-api-contract.md` (API) → this plan → `docs/plan/r1-traceability.md`. ID chain: URS → FR/AC → DM/API → plan card → AC ledger (`docs/plan/r1-ac-ledger.md`).
**Governing rule (user):** "berdasarkan V2+V1 untuk betulkan V3". V2 is the reference, V1 the fallback. Exception: question STRUCTURE follows D90/D41 and the DSKP (PRD 40 §X1, FR-X1-4).
**Inputs:** PRD `docs/prd/r1/` (00-index, 10-murid, 20-guru-admin-sekolah, 30-admin-pusat, 40-cross-cutting, **all FINAL**). Task cards use the real PRD IDs: `R1-MUR-<row>`, `FR-MUR-QP-n`, `R1-GUR-n`, `R1-AS-n`, `XS-n`, `R1-ADM-Q/C/N/U/M/P2-nn`, `QE-nn`, `U-OP-nn`; §4.0 reconciles them. Gap evidence: `D:\pp-v2-v3-compare\gap\*.md` (outside the repo; copy what is needed into the gitignored `.evidence/`).

## 0. How to read this plan (one page)

1. The work is cut into **11 non-overlapping sectors** (S0–S10, §2). Every path in the repo has exactly one sector owner (CODEOWNERS, App. C).
2. Each sector has **task cards** (§4), 113 (Delivery A and B), each with PRD refs, root cause, files, tests, verification and Definition of Done.
3. A developer **declares a sector** (a line in `docs/plan/r1-board.md`) and **claims a task** (GitHub Issue, §6). One claimant per task, one lead per sector.
4. Work is delivered in **2-week sprints** (§5A) whose exit is measured by **PRD acceptance criteria passing in a visible browser, side by side with V2, on UAT data**, not by tasks closed.
5. Nothing on V1, V2 or UAT is changed without the user's explicit approval (§7).

**Where work happens (user rule 2026-11-04).** Everything stays inside the project folder `D:\Dev Projects\prestasiplus` (one normal clone per developer). No git worktrees, no sibling folders. V3 test screenshots, logs and dumps go in `.evidence/<task-id>/` (already gitignored; they may contain real names, so they never leave the PC and are never committed). V2/V1 captures are never committed anywhere; they exist only on the Delivery Lead's PC. If several agent sessions share the one folder on one PC, they share one checked-out branch; so on that PC tasks are claimed one at a time.

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
| Fix | 32 | 0 | 32 | 93 |
| Complete | 39 | 9 | 48 | 199 |
| Build | 15 | 0 | 15 | 54 |
| Verify | 6 | 0 | 6 | 15 |
| Ops | 12 | 0 | 12 | 28 |
| **Total** | **104** | **9** | **113** | **389** |

Only **Build** is new code; Fix, Complete and Verify reuse what exists. (Estimates are rough and are re-baselined after Sprint 1.)

**Five concrete examples of reuse**
1. **Prestasi 360 exists but a redirect hides it.** `Prestasi360Page.vue` and the `/prestasi/:userId` route are built; `routes/prestasi.ts` sends the pupil to the school dashboard and lists `student` in `PRESTASI_SCHOOL_ROLES`. S10-T01 is a Fix, not a new screen.
2. **Set Builder exists; Pembina Kertas is merged into it.** `SetBuilderPage.vue` stays as the single builder; the duplicate list route redirects and `/admin/spm/kertas/:id` stays as "Semak Kertas Simulasi" (S3-T02, S2-T03).
3. **The gamification and shop backends exist, so only admin screens are needed.** `apps/api/src/modules/gamification/admin.controller.ts` and `shop/` already serve the data; S7-T04/T05 add the Pentadbiran pages and fix the pupil side against them.
4. **Headcount, Analisa Item and Laporan Soalan are built but hidden.** They are blocked by `STUDENT_HIDDEN_IDS` in `user-nav.ts` and by `prototype-scope.ts`; S0-T05/T06 un-hide them and S10-T02/T03 and S5-T06 fix what is wrong inside.
5. **Tracking A has a backend with no screen.** `apps/api/src/modules/spm/tracking.service.ts` exists while `/admin/spm/tracking-a` is a 404; S3-T05 is a Complete (add the lane list and set editor on the existing service). Likewise the DSKP loader (`docs/ops/dskp-loader.md`) already exists: S4-T02 is a Verify plus an Ops run, not new code.


### Guardrails: analyse, find the gap, close it, never rebuild (mandatory, user instruction 2026-11-04)

**1. Mandatory per-card workflow (in this order; a developer or a cloud agent skips none).**
1. **Code gap check before any code.** For every FR and AC on the card, record in the existing V3 code whether it **works / is broken / is missing**, with `file:line` evidence, and post it as the issue's **"Gap check"** section (table: FR/AC, status, evidence, planned change). **A card cannot move to In progress without it.** The "Gap:" line on the card is a starting hypothesis, not the evidence.
2. **Confirm scope.** If the code has changed since the PRD's "Current gap" was written, update the Gap check, not the PRD intent. The intent (FR/AC) never changes in a card.
3. **Close the gaps only**, in the existing files named under "Starts from (existing)".
4. **Prove.** Run the card's ACs, and every AC-CHAIN-n that passes through the card (40 section X9, card S9-T06), in a **visible browser at 375, 768 and 1280 px**, on seeded data. Evidence in `.evidence/<card>/`.

**2. Change budget by card Type.**

| Type | Allowed in the diff |
|---|---|
| **Keep** | No product-code change; ACs are proven only. |
| **Verify** | No product code; the card proves ACs (a failing AC becomes a Fix card or a one-line fix named in the issue). |
| **Ops** | No product code (data, environment, governance, scripts under `apps/api/scripts/uat-ops/` only when the card names them). |
| **Fix**, **Complete** | Edit the files under "Starts from (existing)" (and the files the Gap check names there); a **new file only when the card names it**. |
| **Build** | New files **only at the location the card names**; reuse the existing services, components and tables around it. |

**3. Prohibited (a PR containing any of these is rejected).**
- creating a **parallel** page, service, store, route or table for something that already exists;
- deleting or rewriting a working page or module;
- a schema change without a **DM ID** (listed on the card and in 50);
- an endpoint without an **API ID** (listed on the card and in 60).

**4. PR template and reviewer rule.** The PR template (App. B) has these fields: card ID (exactly one), Gap-check link, existing files changed, the reason for each new file, DM/API IDs, ACs proven (and AC-CHAIN-n). **Reviewer rule: reject a Fix or Complete PR that does not touch its "Starts from" files or that adds a parallel implementation.**

**5. CI helper `scripts/r1-scope-guard.mjs` (wired by S0-T04).** Inputs: base ref, head ref and the PR body (`PR_BODY`). It reads the card ID from the PR body, looks the card up in this plan (Type, "Starts from (existing)" paths) and checks the diff:
- **FAIL** if a Fix, Complete, Keep or Verify card adds a new Vue page or route file, a NestJS controller or a Prisma model without a DM or API ID listed in the PR body;
- **FAIL** if a Keep, Verify or Ops card changes product code (`src/`, `apps/`, `packages/`);
- **WARN** if a Fix or Complete card touches none of its "Starts from" paths;
- **WARN** if an existing file loses more than 60% of its lines.
It prints a BM and English summary; exit code 1 = FAIL, 2 = setup error, 0 = pass (warnings allowed). `node scripts/r1-scope-guard.mjs --self-test` runs its fixtures. Plan format the script relies on (do not change it): the card line `**S<n>-T<nn> <title>** ... Type: <type>`, no heading inside a card, and "Starts from (existing)" paths in backticks, repo-relative, plain paths or directories (no `**` globs, no prose in backticks).

---

## 0A. Building with cloud agents (mandatory)

The system is built by **cloud agents** (one session per card). They have **no access to V1, V2 or UAT** and never open them. Everything an agent needs is in the repository.

**Gap check first.** Before writing code, post the card's **Gap check** on the issue (works / broken / missing per FR and AC, with file:line, §0B workflow). The card is built from that check inside the change budget of its Type (§0B); the agent never creates a parallel implementation.

**Read order for every card, in this order:**
1. `docs/prd/r1/00-index.md` (IDs, conventions) then `docs/prd/r1/40-cross-cutting.md` (reference rule, X1-X8, NFR).
2. The PRD section of each module named on the card's "PRD:" line (`10-murid.md`, `20-guru-admin-sekolah.md` or `30-admin-pusat.md`): the FRs, ACs, exact BM copy and deviations.
3. For the data and API shape: `docs/prd/r1/50-data-model-erd.md` and `docs/prd/r1/60-api-contract.md`. There are **no screenshots** in the repo: every V2/V1 screen is described in words (layout, blocks in order, exact BM copy, states) inside the SRS section of its module, so the SRS text is the only screen reference.
4. The card itself (this plan, §4, mirrored on the GitHub issue).

**Rules**
- **Never open V1, V2 or UAT.** If a behaviour, copy, field, state or screen is not in the PRD text, **stop and ask the Delivery Lead** (comment on the issue, label `needs:answer`). Do not guess, do not invent, do not "improve".
- **One card per session.** Stay inside the sector's owned paths (§2); a change elsewhere is a small PR to its owner (§3). Do not start a second card in the same session.
- **FR-X1-5, close the gaps only (user directive: "close, fix and improve the gaps only; never rebuild from scratch").** Change only what the card's gap lists. Reuse the existing routes, components, APIs and data. Never rewrite, restyle or restructure a working screen or module. A **Verify** card changes no code unless one of its ACs fails, and then fixes only that failure. Replacing a working screen, component or API needs the Delivery Lead's **written approval in the issue** before the work starts; without it the PR is rejected.
- **Banned patterns** (a PR containing any of them is rejected): placeholder strings ("akan datang", "belum tersedia", "Pratonton", prototype notices), mock or demo data in a matrix module, a new menu item or page that the PRD does not list, a renamed label, an extra feature, a feature flag that hides a matrix module (except those named in the PRD), copy in English where the PRD gives BM, a real person's name anywhere.
- **Evidence the PR must carry:** real test output (`typecheck`, `lint`, `npm test`, `be:verify`); the card's **AC list with each AC ticked and its result**; screenshots at **375 / 768 / 1280** from a local **visible** browser where the agent environment can run one (otherwise say so, and the Delivery Lead produces them); the deviations from the PRD, if any, as a numbered list.
- **Verification is the lead's.** The Delivery Lead verifies against V2 and UAT data (§6.5) before an issue becomes Done. An agent never moves its own issue to Done and never claims a gate.

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

### S6 Guru and Admin Sekolah portals, Admin Pusat users/monitoring
- **Scope:** 20-guru-admin-sekolah (R1-GUR-1,2,2b,8b,10,11,41–44 and the Alat Soalan tools 44a–44e; R1-AS-0,1,10,11,46–53; shell FR-SH, XS-1..6); PRD 30 U-01..U-09, M-01..M-08.
- **Owned:** `src/modules/m10-teacher-class/**` (except the two pupil pages in S5), `m11-teacher-analytics/**`, `m12-kirkpatrick/**`, `m27-school-admin/**`, `m17-admin-dashboard/**`, `m02-users-schools/**`, `m18-ppd-jpn/**` (frozen, out of 1.0); BE `school-admin/`, `command-center/`, `classes/**` (except `question-sets/`, `kelas-saya.controller.ts`), `reports/analytics/`, `reports/kirkpatrick/`, `users/`, `schools/`, `parents/`; `SCH/classes.prisma`, `schools.prisma`; `SEED/core/schools.ts` by request to S0; `CT/classes`, `CT/school-admin`, `CT/schools`, `CT/admin`, `CT/reports/kirkpatrick*`.
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
Owns no product code. Owns: `.evidence/**` (local), `docs/plan/r1-board.md` status columns, `docs/plan/r1-ac-ledger.md` (§6.9), `docs/qa/r1/**`, the Project board. Runs §5A ceremonies, local side-by-side V2 checks (never committed), UAT walks, XL integration pass, release checklist. **Only S9 moves an issue to Done.**

---

## 3. Shared-file protocol

| Shared file | Single owner | How others change it | Merge order |
|---|---|---|---|
| `src/shells/pentadbiran/menu.ts` | S0 | Menu is changed only by S0-T07 (target menu, after user approval) and later one-line PRs to S0 (label/route/`built`). Sectors never edit it; they make their route exist and tell S0 the route name in the issue. | S0 first, then pages |
| `src/shells/nav/user-nav.ts` | S0 | Same. All wrong targets of the 1.0 rows are fixed in S0-T06 in one PR (so the nav is touched once). Later: PR ≤20 lines to S0, 24 h review SLA | S0 first |
| `src/app/prototype-scope.ts`, `features.ts`, `modules.ts`, `router/**` | S0 | **Delete-only for sectors**: when a module passes its ACs, its sector opens a PR that removes its own entry from the scope list (lines between `// [S<n> begin]` / `// [S<n> end]` markers that S0-T05 inserts). Adding an entry (hiding something) is S0 only | after the module PR |
| Route registries `src/modules/*/routes.ts`, `src/app/modules.ts` | the module's sector (routes.ts); S0 (modules.ts list) | A new module is registered by S0; routes inside a module by its sector | |
| `apps/api/prisma/schema/*.prisma` | the sector that owns that file (§2). `base.prisma` S0 | A sector needing a table/column in another sector's file asks that sector (issue label `needs:schema`); the owner adds it in **their** migration range | schema PR before consumers |
| Migrations `apps/api/prisma/migrations/` | S0 as gatekeeper of the numbering only | **Reserved ranges** below; name `0NNN_<sector>_<slug>`; one migration per PR; expand-then-contract only (no destructive change in the same release); `npm run be:lint:migration` must pass | by number |
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

**Migrations by card (numbering from `50-data-model-erd.md` §4.8; 23 migrations; these are the only ones R1 needs).**

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

Not needed (50 §4.8): `0140_s4_question_chapter_link`, `0160_s3_self_mark`, `0220_s7_marketplace_admin`.

Prisma applies pending migrations by name, so a lower number landing after a higher one is safe if the tables are independent. A migration that depends on another sector's migration states it in the PR and waits for it to merge. Data repairs for UAT are **scripts** (`apps/api/scripts/uat-ops/`), never migrations (as `dskp-loader.md` does).

**Contract-change rules.**
1. Additive only inside Release 1 (new optional field, new endpoint, new enum value with a safe default). A breaking change needs an ADR and S0's approval.
2. The contract change is its **own small PR** (`CT/<folder>` + `npm run contract:emit` + regenerated `openapi.json`), merged **before** the BE and FE PRs that use it. Run `npm run contract:check` and `npm run be:verify`.
3. `openapi.json` is generated: on a merge conflict, take either side and re-run `npm run contract:emit`; never hand-merge.
4. FE uses only the contract type; no ad-hoc response shapes.
5. A change in a folder owned by another sector needs that sector's review (CODEOWNERS enforces it).

**Rebase and merge rules.** Short-lived branches from `feature/v3-bijak-r1`; rebase onto it daily; **squash merge**; CI green is required; prefer PRs of ≤400 changed lines. Order in a day: S0 → contract PRs → schema/migration PRs → BE → FE. A PR waiting >24 h for a cross-sector review is escalated to the Delivery Lead (S9), who may reassign the review. No long-lived integration branches (the old `team/*`, `be/integration-*` pattern is not used).

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
| 4.11 #9-#11 (lock/defensive states) | accepted by the PRD, listed in the S0-T04 allow-list with the PRD row |

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
| F-18 chain tests | D-A16 | S9-T06 | AC-CHAIN-1..9 |
| F-20 password and quota | D-A17 | S6-T12 (password 8), S6-T09 (quota, whole-file refusal) | API-ADM-01, API-AS-06 |

**Common blocks (referenced by every card).**

**V-STD (verification, all cards unless the card says otherwise).**
1. Local: `npm run stack:up` (ports 5192/5193), seed per §7, log in as the role(s) named on the card.
2. Run the card's ACs in a **visible (headed) browser** (Playwright MCP or manual; never headless) at **375, 768 and 1280 px**; check `document.documentElement.scrollWidth <= window.innerWidth` (AC-X6-1); save screenshots to `.evidence/<task-id>/<width>-<screen>.png`.
3. **Side by side with V2** (or V1 where the PRD says): open the same screen in V2 at the same width, 3 s between pages, read-only; list every difference as fixed or as a numbered fidelity deviation in the PR. (Delivery Lead repeats this at verification.)
4. **UAT data:** repeat the key ACs against the UAT-like dataset (S4-T01) or UAT itself once deployed; state which.
5. No text from the placeholder list (§8, AC-X2-3) on any screen touched.

**DoD-T (task Definition of Done).** (a) every AC on the card passes with evidence; (b) `npm run typecheck`, `npm run lint`, `npm test`, and for BE `npm run be:verify` green (real output pasted); (c) tests added as listed; (d) V-STD evidence attached to the PR; (e) no new placeholder string, no new mock path in the http build; (f) PRD/doc updated if behaviour diverges; (f2) **FR-X1-5:** no rewrite of working code; only the gaps listed on the card changed, existing files reused (listed in the PR), and any replacement of a working screen, component or API has the Delivery Lead's written approval in the issue; (f3) the issue carries the Gap check section, the PR names exactly one card and lists its DM/API IDs, and `scripts/r1-scope-guard.mjs` has no FAIL (§0B); (g) PR reviewed by sector lead and by owners of any other-sector paths touched; (h) S9 verified and moved the issue to Done.

**Sizes** (ideal focused days for one developer): S = 1, M = 3, L = 6. Anything >6 must be split before it is claimed.

Priority: P0 blocks 1.0; P1 important; P2 polish. Delivery: A unless stated.

### 4.S0 Platform and shared registries

**S0-T01 Governance setup** · P0 · S · Type: Ops · deps: none · owner: Delivery Lead (not a dev task)
- Starts from (existing): `.github/pull_request_template.md`.
- PRD: NFR-5 (privacy: no real name in repo, `.evidence/` stays gitignored); plan §6. Do: add CODEOWNERS (App. C), PR template (App. B), issue template (App. A), labels, Project fields, `docs/plan/r1-board.md`; create issues for all cards after the user approves this plan.
- Data/API: none
- Files: `.github/CODEOWNERS`, `.github/pull_request_template.md` (replaces the old BE-card template), `.github/ISSUE_TEMPLATE/task.yml`, `docs/plan/r1-board.md`, `scripts/gh-labels.sh` (exists; extend).
- Tests: none. Verify: open a test PR touching two sectors and see both owners requested.
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
- DoD: DoD-T + a second developer reproduces it on a clean clone.

**S0-T03 Jobs worker and OCR configured** · P0 · M · Type: Fix · deps: none
- Starts from (existing): `apps/api/src/modules/jobs/jobs.worker.ts`.
- PRD: Q-07 FR-ADM-Q07.5; gap F2. Gap: extraction stuck at "Sedang diproses" because `JOBS_WORKER_ENABLED=false`, `OCR_ENGINE=none` (`apps/api/src/common/config/env.schema.ts:169,175`; `jobs/jobs.worker.ts`, `intake/files/intake-processing.service.ts`).
- Data/API: none
- Approach: enable worker and `OCR_ENGINE=tesseract` (+ traineddata folder in the API image) in compose and in the UAT env template; health endpoint reports worker alive; document UAT enablement as U-OP-02 (OPS, user approval, §7). The in-service timeout/error state is S1-T04.
- Files: `compose*.yaml`, API `Dockerfile`, `docs/ops/api-runbook.md`, `apps/api/src/common/config/env.schema.ts`, `apps/api/src/modules/jobs/**`, `apps/api/src/modules/ocr/**`.
- Tests: jobs worker unit test; e2e: upload a small PDF, batch leaves "Sedang diproses".
- Verify: V-STD steps 1, 2 on `/admin/spm/soalan/muat-naik`.
- DoD: DoD-T.

**S0-T04 Repo checks in CI: placeholder strings and R1 traceability** · P0 · S · Type: Build · deps: none
- Starts from (existing): `scripts/lint.mjs`, `scripts/r1-trace-check.mjs`, `scripts/r1-scope-guard.mjs`, `.github/workflows/` (the placeholder check is new and is added beside these files).
- PRD: AC-X2-3, FR-X2-0. **Also owns the traceability gate:** add `node scripts/r1-trace-check.mjs` (exists; the lead owns its logic, S0 only wires it) as a required CI step in `.github/workflows/frontend.yml`. It regenerates `docs/plan/r1-traceability.md` and fails unless it exits 0 (`uncovered: 0 | dangling: 0`, no unknown id, no DM/API ownership defect) (a PRD module without a card, or a card citing an unknown PRD ID). Approach for the placeholder check: `scripts/check-placeholders.mjs` fails the build if module code (`src/modules/**` and `src/shells/**`, excluding tests and an allow-list) contains `PrototypeUnavailablePage`, `akan datang`, `belum tersedia`, `Pratonton`, `prototaip`, `belum termasuk dalam skop`, `Fungsi ini belum tersedia`, `coming soon`. Allow-list `scripts/placeholder-allowlist.json`: entries must name the PRD exception (register 6.2b row 18 officers PPD/JPN is the only one at the start). Wire into `npm run lint`. **Also wires the scope guard (§0B, guardrail 5):** add a required CI job `scope-guard` in `.github/workflows/` that checks out with `fetch-depth: 0` and runs `node scripts/r1-scope-guard.mjs --base origin/<target branch> --head HEAD` with `env: PR_BODY: ${{ github.event.pull_request.body }}`; exit code 1 (FAIL) blocks the merge, 2 (setup error, e.g. no card ID in the PR body) also blocks, warnings are printed in the job summary. The script exists (`--self-test` runs its fixtures); S0 wires it and does not change its rules without the Delivery Lead.
- Data/API: none
- Files: `scripts/check-placeholders.mjs`, `scripts/placeholder-allowlist.json`, `scripts/lint.mjs`, `.github/workflows/frontend.yml`, `.github/workflows/scope-guard.yml`.
- Tests: script self-test with a fixture. First run is **red on purpose** (it lists the ~20 known strings); CI treats it as "report" until the end of Sprint 1 and as "fail" from Sprint 2 (decision recorded in the PR).
- Verify: introduce the string in a throwaway branch; CI fails. Open a throwaway PR whose body names a Verify card and adds a Vue page: the `scope-guard` job fails.
- DoD: DoD-T.

**S0-T05 Retire prototype scope** · P0 · M · Type: Fix · deps: S0-T04
- Starts from (existing): `src/app/prototype-scope.ts`.
- PRD: FR-X2-0/1/2; register 6.2b row 3 (`src/app/prototype-scope.ts:28-30,56-59`, `src/app/LayoutHost.vue:51,54`); OQ-MUR-5 copy.
- Data/API: none
- Approach: replace the "Belum tersedia dalam prototaip" page and the "Known gaps" note with the standard not-available page (copy per OQ-MUR-5 once approved); add `// [S<n> begin/end]` markers per sector in the scope lists; one scope flag per Delivery B module; a hidden module is unreachable by URL (FR-X2-2) and answers **404** with the standard not-available page (D108(7)), never 403; unhide, in this task, everything already built for a 1.0 row (Headcount, Analisa Item, Laporan Soalan, Import Pelajar items hidden by `STUDENT_HIDDEN_IDS` at `src/shells/nav/user-nav.ts:749`) so sectors only fix their own screens.
- Files: `src/app/prototype-scope.ts`, `src/app/LayoutHost.vue`, `src/app/router/guards.ts`, `src/shells/nav/user-nav.ts`, `src/app/features.ts`.
- Note (OQ-G-15, closed): the `GURU_TOOLS` entry in `src/shells/nav/out-of-scope.ts` (routes `/guru/soalan-guru`, `/guru/databank`, `/guru/kertas-peperiksaan`, and the Gambar Rajah and Soalan Berstruktur tool routes) stays until S6-T16..T20 land; each of those cards then removes its own routes from `GURU_TOOLS` (delete-only, §3). S0 keeps the nav items.
- Tests: router guard unit tests for hidden/visible module; update `src/app/__tests__`.
- Verify: V-STD; type a hidden URL as pupil: standard page; each 1.0 sidebar item opens (even if the screen is still fixed later, no scope page).
- DoD: DoD-T + AC-X2-3 check passes for `src/app/**`.

**S0-T06 Nav integrity and sidebar walk** · P0 · M · Type: Fix · deps: S0-T05
- Starts from (existing): `src/shells/nav/user-nav.ts`.
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
- PRD: 30 §3.1–3.4. Approach: implement the target groups and the exact "Soalan" group (SPM, Bank Soalan (Studio), Import & Semakan, Set Builder, Sumber Kertas, Kertas Subjektif, Bank Lama → Senarai Soalan, Soalan Berstruktur); HIDE/MERGE/REMOVE the mapped IDs; V2 paths stay as alias redirects (the redirects themselves are S2-T03).
- Data/API: none
- Files: `src/shells/pentadbiran/menu.ts`, `src/shells/__tests__/**`.
- Tests: menu snapshot test (no duplicate "Bank Soalan"; 8 items in Soalan). Verify: V-STD against V2 admin sidebar at 1280 and drawer at 375.
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
- PRD: FR-X2-0 (no mock data), register 6.2b row 17. Approach: `scripts/check-http-build.mjs` builds with `VITE_API_MODE=http` and fails if a matrix route's chunk imports a `*/mock/**` module (data), reporting module by module. Output goes to each sector's checklist; sectors delete their mock paths as part of their cards.
- Data/API: none
- Files: `scripts/check-http-build.mjs`, `scripts/check-demo-bundle.mjs`. Tests: script self-test. DoD: DoD-T.

**S0-T10 Kawalan Ciri (minimum)** · P1 · M · Type: Build · deps: S0-T07
- Starts from (existing): `src/app/features.ts` (nothing exists for the new part; it is added beside these files).
- PRD: R1-ADM-N-06 (`/admin/feature-toggles`), NFR-6; gap §5.5 (none in V3). Approach: a `feature_flags` table + admin list/toggle of the ~25 V2 toggles that exist in V3 (rest not shown), read by the FE `features.ts`; Cikgu Alesa and Keluarga Angkat locked OFF (D102).
- Data/API: DM-34; API-ADM-09, API-AUTH-16, API-GAME-10, API-GUR-23
- Files: new `SCH/feature-flags.prisma` (S0-owned, not `base.prisma`; DM-34), migration `0250_s0_feature_flags` (table + seed rows), `CT/admin`→ (S6 owns `CT/admin`; use new `CT/common/feature-flags.ts`), `BE/common` or new `BE/feature-flags/`, `src/app/features.ts`, a page under `src/modules/m17-admin-dashboard/pages/` (S6 reviews).
- Tests: BE service+controller; FE toggle page. Verify: V-STD vs V2 admin "Kawalan Ciri" at 375/768/1280; toggle a Delivery B module; the pupil sees it appear/disappear.
- DoD: DoD-T.

**S0-T11 Kawalan Ciri full and go-live switch-over** · P1 · M · Type: Complete · deps: S0-T10 · Delivery B
- Starts from (existing): `src/app/features.ts`.
- PRD: R1-ADM-P2-19 (all ticked modules toggleable), U-OP-11. Extends S0-T10 to every ticked module; Delivery B modules stay hidden (404, FR-X2-2) until their card passes, then the flag turns ON on UAT (U-OP-11). Files: `src/app/features.ts`, `BE/common`/feature-flags, admin page of S0-T10. Tests: toggle spec per module. Verify: V-STD per module against the SRS description of the PRD modules on this card's "PRD:" line (screen layout, exact BM copy and states are written in words there; §0A). DoD: DoD-T + every AC of the listed modules.
- Data/API: none
- Also uses: API-ADM-09, DM-34 (owned by another card; read or verified here, not an ownership claim)

### 4.S1 Question model and pipeline (backend)

*Principle for every S1 card:* the first step is a **characterisation test** that fails on the current behaviour named in the card (so the fix is proven, not assumed). The gap file says "root cause (file:line)"; confirm it in the first hour and note differences in the issue.

**S1-T01 Stimulus group invariants end to end** · P0 · L · Type: Complete · deps: none
- Starts from (existing): `apps/api/src/modules/questions/stimuli.service.ts`, `apps/api/src/modules/questions/group-members.ts`.
- PRD: FR-X1-4a/b/d, R1-ADM-QE-01, R1-ADM-QE-02, R1-ADM-Q-05. A group holds **1..n** questions, also inside a paper; a one-member group is valid, a zero-member group is blocked (D108(1), FR-ADM-QE2.4). Gap: V1/V2 treat a figure as a question; V3 has `stimuli.service.ts`/`group-members.ts` but UAT shows figure-only and figure-less questions (30 §4.G.7).
- Data/API: DM-01, DM-02, DM-03, DM-06; API-FILE-01, API-Q-03, API-Q-07, API-Q-08
- Also uses: DM-04 (owned by another card; read or verified here, not an ownership claim)
- Approach: group entity = stimulus + ordered members 1..n; stimulus carries no marks and is never counted as a question (QE1.5); API to create a group, add/remove/reorder members, attach the stimulus once; projection returns group + members as one unit; counts exclude stimuli.
- Files: `BE/questions/{stimuli.service.ts,stimuli.repository.ts,group-members.ts,projection.ts,questions.service.ts,http/**,studio/**}`, `SCH/questions.prisma`.
- Contract: `CT/questions` (group read/write shapes, additive). Migration: `0120_s1_group_fk_restrict` (DM-02: `fk_questions_group_id` set null to restrict; a constraint change, no new column).
- Tests: unit + integration (`apps/api/test/`) for create/add 2nd and 3rd question without re-upload; a group of 3 returns 3 members, count = 3.
- Verify: V-STD via API then Studio (S2-T01) at 1280; V2 has no group, so compare the pupil result of the same real paper (the deviation is FR-X1-4).
- DoD: DoD-T + AC-ADM-QE1.*, QE2.*, Q05.*.

**S1-T02 Itemised completeness and DSKP-aware validation** · P0 · M · Type: Fix · deps: S1-T01
- Starts from (existing): `apps/api/src/modules/questions/publish-gate.ts`, `apps/api/src/modules/questions/dskp-gate.ts`.
- PRD: R1-ADM-QE-03, R1-ADM-QE-04, R1-ADM-Q-06; 30 §4.G. Aras pemikiran per leaf stays an approval gate for SPM T4/T5 with a question-level default (D108(2), FR-ADM-QE3.4; OQ-QE2 closed). Gap: publish returns 422 only at the end (needs SP, thinking level, paper; `publish-gate.ts`, `dskp-gate.ts`); the Studio bar says "5 belum lengkap" without saying what; free-text SP validated late (gap F1/F2).
- Data/API: DM-19, DM-47; API-Q-02, API-Q-05
- Also uses: API-Q-03, DM-09 (owned by another card; read or verified here, not an ownership claim)
- New requirements from the audit (this card owns them): FR-ADM-QE4.5.
- Data chain (D-A5, D-A6): `NO_CHAPTER` blocker and `difficulty_level` (DM-47); the write of `difficulty_level` happens in the same save as TP.
- Approach: reuse `GET /api/questions/:id/gate-check` (API-Q-05), which already returns `issues[{path, code, message, step}]` in BM, and the same list in the `422 fields` of the save routes; **no new `/completeness` route** (D-API-2); the Studio completeness panel renders `issues` instead of ignoring them; validate SP/TP/level/part marks against DSKP when typed; paper optional for non-SPM bank questions as in V2; keep D80/D85 rules. **Publish gate (D-A5):** a new approval needs Bab + SP (+ TP/aras for SPM-bound T4/T5): add the blocker `NO_CHAPTER` "Sila pilih Bab buku teks." to `gate-check` `issues[]`; the wizard calls the DSKP unit "Unit DSKP" and the textbook chapter "Bab". **Difficulty (D-A6):** `difficultyLevel` becomes optional when `tag.tp` is present and the server writes `difficulty_level = min(5, TP)` (DM-47, migration `0128_s1_difficulty_level`, mapping cited in 50 section 4.2.1); the Tag step shows the derived label, it has no separate input.
- Files: `BE/questions/{publish-gate.ts,dskp-gate.ts,gate-data.ts,status.ts}`, `CT/questions`, `CT/servability`.
- Tests: table-driven gate tests (every missing field named). Verify: V-STD; API response compared with V2 messages where V2 has them.
- DoD: DoD-T + AC-ADM-QE3.*, QE4.*, Q06.*.

**S1-T03 Extraction keeps groups and paper structure** · P0 · L · Type: Complete · deps: S1-T01, S0-T03
- Starts from (existing): `apps/api/src/modules/intake/workflow/figure-links.ts`.
- PRD: R1-ADM-QE-05, FR-X1-4c, R1-ADM-Q-09; FR-ADM-G6.* (30 §4.G.6 upload flow). Gap: V2 links a figure to the first following question and duplicates shared figures; V3 `intake/workflow/figure-links.ts` exists (BE and a FE twin in `m28-bijak-spm/admin/intake/domain/figure-links.ts`); chosen paper at upload is not carried to questions.
- Data/API: DM-07, DM-08, DM-09; API-Q-14, API-Q-15
- Approach: extraction output = groups ("Rajah 3 → soalan 5–8") with members; reviewer edits the range; accept creates one group + members; the upload's subject/level/paper/year carried to every accepted question; free-text SP checked at entry (not at Terima).
- Files: `BE/intake/workflow/**`, `BE/ai-extraction/**`, `BE/intake/files/**`, `CT/intake`, `apps/api/test/intake-workflow/**`.
- Tests: golden test with a fixture paper (Rajah 3 → Q5–8, Rajah 4 → Q9): 2 groups, 5 members, no duplicate figure, paper carried.
- Verify: V-STD at 1280/768/375 on upload → review (S2-T02), plus one real UAT-like PDF.
- DoD: DoD-T + AC-ADM-QE5.*, AC-ADM-Q07.*, Q09.*.

**S1-T04 Intake timeout, error state, manual Terima** · P0 · S · Type: Fix · deps: S0-T03
- Starts from (existing): `apps/api/src/modules/intake/files/intake-processing.service.ts`.
- PRD: NFR-7, Q-07 FR-ADM-Q07.5. Gap: "Sedang diproses" forever; manual "Terima" rejected late then batch shows 0 questions ("Hantar untuk semakan" disabled).
- Data/API: none
- Also uses: API-Q-14, API-Q-15 (owned by another card; read or verified here, not an ownership claim)
- Approach: job timeout → batch state `gagal` with BM reason and a retry; manual Terima creates the drafts or tells why. Files: `BE/intake/files/intake-processing.service.ts`, `BE/intake/workflow/**`, `CT/intake`. Tests: timeout unit test. Verify: V-STD; kill the worker and watch the error appear. DoD: DoD-T.

**S1-T05 CSV with DSKP and group fields** · P0 · M · Type: Complete · deps: S1-T02
- Starts from (existing): `apps/api/src/modules/questions/questions.service.ts`.
- PRD: QE-06, Q-11. Gap: template has raw ids; no unit/SP/level/paper columns, so CSV questions can never publish (gap F2).
- Data/API: DM-10; API-Q-17
- Also uses: API-GUR-19, DM-07, DM-08 (owned by another card; read or verified here, not an ownership claim)
- Approach: template adds the human-readable QE6.1 / DM-10 / API-Q-17 columns (subject code, Tingkatan, unit code, `sp_kod` codes separated by `;`, TP, KBAT, kertas, bahagian, number label, `group_key`, `stimulus_text`, `stimulus_image`) **plus `bab_kod`** (Bab code or number; blank allowed for a draft, required to approve, D-A5); unknown codes are reported per row; the old success banner clears on the next upload. Files: `BE/questions/**` import service, `CT/questions`, sample template under `apps/api/src/modules/questions/import/`. Tests: row-level error report; a CSV of one group of 3 yields one group. Verify: V-STD; download the template, fill, upload, publish. DoD: DoD-T + AC-ADM-QE6.*.

**S1-T06 Group-safe assembly** · P0 · M · Type: Complete · deps: S1-T01
- Starts from (existing): `apps/api/src/modules/questions/served-rule.ts`, `apps/api/src/modules/questions/bijak-pool.ts`.
- PRD: R1-ADM-QE-07, FR-X1-4e, FR-MUR-QP-6, FR-MUR-QP-7, D91, D105. Approach: one "unit" abstraction (single question or whole group) used by `exam/builder` draws, Jana set, Latih Tubi, Databank and games; per D105 every drill (Latih Tubi, Databank, Soalan by Chapter) serves figure questions and whole groups; a surface that cannot render one stimulus kind or answer mode excludes that whole group with an admin-visible reason, and its card, details and draw counts agree (D91); never split or reorder members. Files: `BE/questions/serving/**`, `BE/questions/served-rule.ts`, `BE/questions/bijak-pool.ts`, call sites in `BE/practice/` and `BE/exam/builder/` (one-line change each, S3/S5 review). Tests: a 1000-draw property test never returns a member without its stimulus. Verify: V-STD on Latih Tubi and Jana set. DoD: DoD-T + AC-ADM-QE7.*.
- Data/API: DM-27
- Also uses: API-BIJAK-10, API-PRAC-01, DM-03, DM-26 (owned by another card; read or verified here, not an ownership claim)

**S1-T07 Servability indicator and stimulus flags** · P0 · M · Type: Complete · deps: S1-T01
- Starts from (existing): `apps/api/src/modules/questions/learner-visibility.ts`, `apps/api/src/modules/questions/served-rule.ts`.
- PRD: R1-ADM-Q-06, FR-X4-2, FR-MUR-QP-4, FR-MUR-QP-5, 30 §4.G.7 (FR-ADM-G7.1–G7.3, AC-ADM-G7.1/G7.3). Gap: UAT "Dilihat murid di 0/6" while Latih Tubi serves; published "Rajah 14 …" questions with no figure and a duplicated stem (id 812791) are served.
- Data/API: DM-04, DM-05; API-Q-01, API-Q-11, API-Q-12, API-Q-13, API-Q-24
- Also uses: API-PRAC-04, API-Q-02, DM-42 (owned by another card; read or verified here, not an ownership claim)
- New requirements from the audit (this card owns them): FR-ADM-Q06.4.
- Approach: the indicator is computed by the **same** function that pupil draws use (`served-rule.ts`, `learner-visibility.ts`); detectors `stimulus_missing` (keywords Rajah/Jadual/Graf/Petikan/Peta/Carta, no group/stimulus/image) and `stem_duplicated`; questions flagged `stimulus_missing` or `figure_only` get a servability reason and are excluded from every pupil surface, while `stem_duplicated` is shown once and cleaned by DM-40 (not excluded; OD-3); the flag clears when a group is attached or "Bukan masalah" is set. Reuse `intake/workflow/figure-links.ts` keyword code.
- Files: `BE/questions/{served-rule.ts,learner-visibility.ts,effective-leaf.ts,studio/**}`, `CT/servability`; migration `0121_s1_servability_flags` (the flag is stored, DM-05, OD-1).
- Tests: detector unit tests with real stems; indicator equals draw outcome on 50 sampled questions.
- Verify: V-STD; T4 pupil Latih Tubi Sains never draws id 812791-like questions (UAT-like data, S4-T01).
- DoD: DoD-T.

**S1-T08 Kiriman Guru backend** · P1 · M · Type: Complete · deps: none (stack)
- Starts from (existing): `apps/api/src/modules/classes/question-sets/question-sets.ports.ts`.
- PRD: Q-12, GUR-44; register 6.2b row 5. Gap: `POST /api/guru/question-papers` = 503 because `question-sets.ports.ts:46,56` binds `UnavailablePaperIntake` and nothing calls `provideIntake`; admin "Kiriman Guru" says "Fungsi ini belum tersedia dalam demo".
- Data/API: DM-15; API-GUR-17
- New requirements from the audit (this card owns them): FR-ADM-Q12.6.
- Approach: bind the real intake port (a submission becomes an intake batch tagged `source=guru`, API-GUR-17); the admin sees it in the "Kiriman Guru" tab of Import & Semakan through the existing `GET /api/intake/batches` (filter `source=guru`, API-Q-14) and approves or rejects it with the existing intake review routes (API-Q-15); **no `/api/question-submissions` route is built** (FR-ADM-Q12.2, D-API-5, OQ-API-13); remove demo copy (`m04-question-bank/lib/submissions-unavailable.ts` is S2-T01's change).
- Files: `BE/classes/question-sets/**`, `BE/intake/**`, `CT/intake`, `CT/questions`.
- Tests: teacher uploads a PDF → admin sees a batch. Verify: V-STD as Guru (375/768/1280) then as admin. DoD: DoD-T + AC-GUR-44-*.

**S1-T09 Answer-mode alignment to the exam schema** · P1 · M · Type: Complete · deps: S1-T01
- Starts from (existing): `apps/api/src/modules/questions/grading.ts`.
- PRD: OQ-MUR-13, `docs/requirements/v2-exam-schema.md`, D41. Gap: 8/14 widgets, 3/15 stimulus types supported (gap §2.2 row 13). Approach: add the P1 modes (`match_letter`, `working`) and "Pilih N"; `drawing`/`table_fill` stay P2; BE validation and marking for each. Files: `BE/questions/grading.ts`, `BE/questions/types.ts`, `CT/questions`, `packages/exam-core/**` (S3 review). Tests: grading per mode. Verify: V-STD with S8-T03 widgets. DoD: DoD-T.
- Data/API: none
- Also uses: API-BIJAK-04 (owned by another card; read or verified here, not an ownership claim)

**S1-T10 Accepted batch becomes a draft paper (Semak & Terbit)** · P0 · M · Type: Build · deps: S1-T03, S1-T04
- Starts from (existing): `apps/api/src/modules/intake/workflow/`, `apps/api/src/modules/exam/builder/`
- PRD: R1-ADM-Q-07 (FR-ADM-Q07.3 and the Semak & Terbit FR/AC of 30 section Q-07), R1-ADM-Q-15, R1-ADM-QE-05, FR-X1-4e. Gap: no FR, endpoint, table link or card turned an accepted intake batch into a paper: the intake controller has extract / review / items / stimuli / accept / reject / duplicate only, `Kertas Diimport` lists nothing and `Semak & Terbit` has nothing to open (audit F-01, D-A2).
- Data/API: DM-45; API-Q-25
- Also uses: API-Q-14, API-Q-15, API-BIJAK-10, DM-07, DM-11, DM-23 (owned by another card; read or verified here, not an ownership claim)
- New requirements from the audit (this card owns them): FR-ADM-Q07.6, FR-ADM-Q07.7, FR-ADM-Q07.8, FR-ADM-Q07.9 and their ACs (AC-ADM-Q07.3, AC-ADM-Q07.4).
- Approach: `POST /api/intake/batches/:id/paper` in the intake module creates one draft `papers` row per paper code (`surface = simulasi`, header from the batch, `source_batch_id`), one `paper_sections` row per printed Bahagian (`label`; rule copied from the Disahkan contract when one exists) and `paper_placements` in printed order with `number_label`, each stimulus group placed whole and contiguous in one section, by calling the existing builder services in `exam/builder/` (no second paper writer). Idempotent per batch and paper code. The UI is S2-T02 (tab `Kertas Diimport`, link `Semak & Terbit`); publishing stays S3-T02 (Set Builder, Disahkan contract).
- Files: new `BE/intake/workflow/batch-to-paper.service.ts` (named here), `BE/intake/workflow/**` controller route, call site in `BE/exam/builder/` (S3 review), `CT/intake`; migration `0163_s3_paper_source_batch` (S3 range, `needs:schema` request to S3, DM-45).
- Tests: batch with sections A (10 items) and B (5 items) of which items 5-8 form a group gives 1 draft paper, 2 sections, 15 placements, items 5-8 adjacent; a second call updates the same paper; a pending item gives 409; a split group gives 422.
- Verify: V-STD at 1280/768/375 from upload (S2-T02) to `Semak & Terbit`; AC-CHAIN-2. DoD: DoD-T + the Semak & Terbit AC of 30 Q-07.

### 4.S2 Admin question UI

**S2-T01 Studio list, wizard, group-first entry** · P0 · L · Type: Complete · deps: S1-T01 (S1-T02 for completeness)
- Starts from (existing): `src/modules/m04-question-bank/pages/StudioListPage.vue`, `src/modules/m04-question-bank/pages/StudioEditorPage.vue`.
- PRD: R1-ADM-Q-03, R1-ADM-Q-04, R1-ADM-Q-05, R1-ADM-Q-06, R1-ADM-QE-02, R1-ADM-QE-03, R1-ADM-QE-04; FR-ADM-G5.* (30 §4.G.5 manual flow). Gap: gap §5.4, F1 (bar "5 belum lengkap" without detail), third "Bank Soalan", no way to add a 2nd question to a figure.
- Data/API: API-Q-09
- Also uses: API-Q-05, DM-01 (owned by another card; read or verified here, not an ownership claim)
- New requirements from the audit (this card owns them): FR-ADM-Q03.7, FR-ADM-QE3.7.
- Approach: "Cipta baharu" starts with the stimulus (optional) then adds its questions; completeness panel lists each missing field with a jump link; "Dilihat murid di" uses S1-T07; remove `submissions-unavailable` demo copy; Bab field uses `ChapterSelect.vue` and is labelled "Bab" (the DSKP unit is "Unit DSKP"); the completeness panel shows `NO_CHAPTER` with a link to the Bab field.
- Files: `src/modules/m04-question-bank/pages/{StudioListPage,StudioEditorPage,StudioGroupPage,QuestionCreatePage,QuestionEditPage}.vue`, `components/**`, `api/**`, `lib/submissions-unavailable.ts`.
- Tests: component tests + `e2e/m04*` http spec "create group of 3, publish". Verify: V-STD, V2 `/admin/studio` side by side (deviation = groups).
- DoD: DoD-T + AC-ADM-Q03.*, AC-ADM-Q04.*, AC-ADM-Q05.*, AC-ADM-Q06.*, QE-02..04.

**S2-T02 Import & Semakan (3 tabs) and Semak Ekstrak** · P0 · L · Type: Complete · deps: S1-T03, S1-T04
- Starts from (existing): `src/modules/m28-bijak-spm/admin/intake`.
- PRD: Q-07, Q-08, Q-09, Q-12 UI. Approach: tabs `Kelompok Item`, `Kertas Diimport` (lists the draft papers made by the batch-to-paper route from `Hantar untuk semakan`, with Bilangan Soalan and the link `Semak & Terbit` to `/admin/spm/kertas/:id`), `Kiriman Guru`; review screen lets the reviewer change the group range (add/remove member) before Terima; PDF pane + editor become tabs under 1024 px (FR-X6-11); busy/failed/timeout states. Files: `src/modules/m28-bijak-spm/admin/intake/**`, `m04-question-bank/pages/SubmissionListPage.vue`. Tests: spec for a 2-group fixture paper; intake-375 regression. Verify: V-STD; V2 `/admin/studio/imports`. DoD: DoD-T + AC-ADM-Q07.*, AC-ADM-Q08.*, AC-ADM-Q09.*, AC-ADM-Q12.*.
- Data/API: none
- Also uses: API-Q-14, API-Q-15, DM-09, API-Q-25 (owned by another card; read or verified here, not an ownership claim)

**S2-T03 One bank, one queue, aliases** · P0 · M · Type: Fix · deps: none (S0-T07 consumes it)
- Starts from (existing): `src/modules/m04-question-bank/routes.ts`.
- PRD: 30 §3.3; gap §5.4. Approach: `/admin/spm/soalan` list redirects to `/admin/spm/databank`; `/admin/spm/semakan` redirects to `/admin/studio?status=reviewed`; "Menunggu Semakan" and the old queue show the **same** count (gap F3: 3 vs 0); V2 paths (`/admin/studio/imports`, `/admin/spm/kertas-subjektif`, …) redirect; Muat Naik/Tulis Manual/Import CSV become header buttons. Files: route files in `m04-question-bank/routes*`, `m28-bijak-spm/admin/intake/routes*`. Tests: route table test (every alias resolves, no 404). Verify: V-STD. DoD: DoD-T.
- Data/API: none
- Also uses: API-Q-01 (owned by another card; read or verified here, not an ownership claim)

**S2-T04 Regroup work-list** · P0 · M · Type: Build · deps: S1-T07, S4-T04
- Starts from (existing): `src/modules/m04-question-bank/pages/StudioListPage.vue` (nothing exists for the new part; it is added beside these files).
- PRD: QE-08, FR-ADM-G7.4/G7.5, AC-ADM-G7.2. Approach: filtered Studio view of flagged questions with counts per subject × Tingkatan; attach existing figure (upload/pick) or form a group; "Bukan masalah"; same count on the SPM hub lane Latih Tubi ("Perhatian"). Files: `m04-question-bank/pages/**` (new `RegroupPage.vue`), `components/**`. Tests: spec attaches a figure → flag clears. Verify: V-STD on UAT-like data with id 812791-like items. DoD: DoD-T.
- Data/API: none
- Also uses: API-Q-13, API-Q-24, DM-04, DM-05, DM-06 (owned by another card; read or verified here, not an ownership claim)

**S2-T05 Manual entry, CSV import UI, Quick Edit** · P1 · M · Type: Complete · deps: S1-T02, S1-T05
- Starts from (existing): `src/modules/m04-question-bank/pages/QuestionImportPage.vue`.
- PRD: Q-10, Q-11, Q-24. Approach: DSKP-correct forms (G.5), CSV page with the new template, import history; Quick Edit shows completeness. Files: `m04-question-bank/pages/{QuestionImportPage,ImportHistoryPage}.vue`, `m28-bijak-spm/admin/intake/**`. Tests: component + spec. Verify: V-STD. DoD: DoD-T.
- Data/API: none
- Also uses: API-Q-17, DM-10 (owned by another card; read or verified here, not an ownership claim)

**S2-T06 Senarai Soalan tabs and Soalan Berstruktur** · P1 · M · Type: Complete · deps: S2-T03
- Starts from (existing): `src/modules/m04-question-bank/pages/StructuredListPage.vue`, `src/modules/m04-question-bank/pages/QuestionQualityPage.vue`.
- PRD: Q-20..Q-23. Approach: tabs Kualiti and Laporan under Senarai Soalan; `/admin/structured-questions` gets a real list (route exists, no menu); row actions of Laporan Soalan verified (gap §5.1). Files: `m04-question-bank/pages/{QuestionListPage,QuestionQualityPage,QuestionReportsPage,LaporanSoalanPage,StructuredListPage,StructuredDetailPage}.vue`. Tests: row-action specs. Verify: V-STD vs V2 `/admin/questions`. DoD: DoD-T.
- Data/API: API-Q-10
- Also uses: API-Q-20 (owned by another card; read or verified here, not an ownership claim)

**S2-T07 Responsive pass: admin question screens** · P0 · M · Type: Fix · deps: S8-T06
- Starts from (existing): `src/modules/m04-question-bank/pages/StudioEditorPage.vue`.
- PRD: NFR-1, FR-X6-11, 30 §4.R.1, AC-ADM-R1..R11. Approach: two-pane to tabs/stack on ≤1024; tables to cards ≤640; sticky bars never cover content; run the checklist on every S2 screen. Files: all S2 pages. Tests: Playwright width loop (375/768/1280) asserting no horizontal scroll. Verify: V-STD only (the point of the card). DoD: DoD-T + AC-X6-1 for each S2 screen.
- Data/API: none

**S2-T08 Bulk "Tetapkan Bab" UI** · P1 · S · Type: Build · deps: S4-T03
- Starts from (existing): `src/modules/m04-question-bank/pages/StudioListPage.vue` (nothing exists for the new part; it is added beside these files).
- PRD: C-05. Approach: filter by subject+level, select rows, choose Bab; shows result counts. Also the admin work-list **"Soalan tanpa Bab"**: the Studio list filter `chapter=none` (API-Q-01) with per-subject counts from API-DSKP-10 and the bulk apply of API-DSKP-09 (D-A5). Files: `m04-question-bank/pages/StudioListPage.vue`, `components/**`. Tests: component. Verify: V-STD on UAT-like data. DoD: DoD-T + AC-ADM-C05.*.
- Data/API: none
- Also uses: API-DSKP-09, API-Q-01, DM-17 (owned by another card; read or verified here, not an ownership claim)

**S2-T09 Sumber Kertas** · P2 · M · Type: Build · deps: S1-T03 · PRD Q-19. List/detail of source papers. Files: `m04-question-bank/pages/**`. Tests/verify/DoD standard.
- Starts from (existing): `src/modules/m04-question-bank/routes.ts` (nothing exists for the new part; it is added beside these files).
- Data/API: API-Q-18, API-Q-23

### 4.S3 Bijak SPM papers

**S3-T01 Kontrak: "Disahkan" selectable and honest** · P0 · M · Type: Fix · deps: S4-T02
- Starts from (existing): `src/modules/m28-bijak-spm/admin/kontrak`, `apps/api/src/modules/exam/blueprints/blueprints.controller.ts`.
- PRD: Q-16; gap F7, §5.3 (0 contracts on UAT; all 8 "Spec"; Disahkan not choosable). Approach: Disahkan in the status control with the evidence/quota conditions shown inline (not only on the Pengesahan tab); Terbit with a Disahkan contract needs no exception box; keep the exception path but record it. Files: `src/modules/m28-bijak-spm/admin/kontrak/**`, `BE/exam/blueprints/**`. Tests: gate tests, spec. Verify: V-STD vs V2 Kontrak; UAT: U-OP-08 later. DoD: DoD-T + AC-ADM-Q16.*.
- Data/API: API-BIJAK-02, API-BIJAK-09, API-DSKP-06
- Also uses: DM-21 (owned by another card; read or verified here, not an ownership claim)

**S3-T02 One Set Builder** · P0 · L · Type: Fix · deps: S1-T06, S3-T01
- Starts from (existing): `src/modules/m28-bijak-spm/admin/builder/pages/SetBuilderPage.vue`, `src/modules/m28-bijak-spm/admin/papers/PaperListPage.vue`.
- PRD: Q-13, Q-14, Q-15, QE-07. Gap: Pembina Kertas and Set Builder show the same papers; Jana set has no Tahun/Negeri/Bilangan, no "Jawab Semua/Pilih N", Sejarah only Kertas 2 (gap F4).
- Data/API: DM-11, DM-26; API-BIJAK-10, API-BIJAK-11
- Also uses: DM-01, DM-23 (owned by another card; read or verified here, not an ownership claim)
- Approach: Set Builder `/admin/studio/sets` is the single builder; `/admin/spm/kertas` redirects; `/admin/spm/kertas/:id` stays as "Semak Kertas Simulasi"; Jana set fields per V2; section rule control; bank panel adds a group as a unit; builder two-pane → tabs ≤1024.
- Files: `m28-bijak-spm/admin/{builder,papers}/**`, `BE/exam/builder/**`, `CT/bijak`. Tests: builder spec incl. group unit. Verify: V-STD vs V2 Set Builder. DoD: DoD-T + AC-ADM-Q13.*, AC-ADM-Q14.*, AC-ADM-Q15.*.

**S3-T03 SPM hub with 6 lanes** · P0 · M · Type: Complete · deps: none
- Starts from (existing): `src/modules/m28-bijak-spm/admin/kandungan/lanes.ts`, `apps/api/src/modules/spm/hub.service.ts`.
- PRD: Q-01, Q-02. Gap: 2 of 6 cards (Databank, Bijak SPM); lanes Latih Tubi, Tracking A, Subjektif, Bijak missing. Files: `m28-bijak-spm/admin/kandungan/**`, `BE/spm/hub.service.ts`. Tests: hub counts equal list counts. Verify: V-STD vs V2 `/admin/spm`. DoD: DoD-T.
- Data/API: API-BIJAK-12, API-BIJAK-15
- Also uses: API-Q-11 (owned by another card; read or verified here, not an ownership claim)

**S3-T04 Pupil sitting and result (Bijak SPM)** · P0 · L · Type: Complete · deps: S8-T02, S8-T03, S8-T04, S3-T02
- Starts from (existing): `src/modules/m28-bijak-spm/pages/AttemptPage.vue`, `src/modules/m28-bijak-spm/pages/ResultPage.vue`.
- PRD: R1-MUR-13 (all Bijak ACs), AC-X6-2, QP contract 10-murid §4.8. Gap: F8 passes functionally; UAT 0 papers; 375 px gaps (gap §2.2 row 13); structured item "Tidak disajikan: jenis jawapan tidak dibenarkan dalam bahagian ini".
- Data/API: API-BIJAK-04, API-BIJAK-06
- Answer store (D-A1, DM-44, owned by S5-T15): `POST /bijak/attempts/:id/submit` writes one answer row per answered leaf with `mode` `simulasi` or `kuiz` (by paper kind) and the `attempt_id`, then upserts the `practice_attempt_aggregates` summary; a regrade updates the rows (idempotent per `(attempt_id, question_id, part_ref)`). Tracking A and Databank sittings use the same submit (S3-T05, S3-T07). Writes go through the one `AnswerLogPort` of `practice/`; no second answer table, no report reads anything else.
- Approach: compose S8 components in `AttemptPage`, `PaperQuizPage`, `ResultPage`; remove "not served" for allowed modes; remove the demo message "Fungsi ini belum tersedia dalam demo" from the real path (`m28-bijak-spm/server/errors.ts:14`, `server/http-admin.ts:153`, register 10-murid 4.11 #12); stimulus group once, sticky; self-mark flow for structured answers (S3-T06 for subjective). Files: `m28-bijak-spm/pages/**`, `lib/**`, `domain/**`. Tests: spec with a group-of-3 paper at 375. Verify: V-STD on a phone-size headed browser; UAT-like data. DoD: DoD-T + AC-MUR-13-*, AC-X6-2.

**S3-T05 Tracking A** · P0 (Q-17; pupil Tracking A part P1) · M · Type: Complete · deps: S3-T03
- Starts from (existing): `apps/api/src/modules/spm/tracking.service.ts`.
- PRD: Q-17, MUR-13 Tracking A. Gap: `/admin/spm/tracking-a` 404 (F5); `BE/spm/tracking.service.ts` exists. Approach: lane list + set editor + pupil subject page. Files: `m28-bijak-spm/admin/kandungan/**`, `m06-spm/pages/**`, `BE/spm/tracking.service.ts`. Tests: spec. Verify: V-STD vs V2 Tracking A. DoD: DoD-T + AC-ADM-Q17.*.
- Data/API: DM-24; API-BIJAK-13
- Answer store (D-A1, DM-44, owned by S5-T15): a Tracking A attempt is a Bijak-style attempt; its submit writes rows with `mode = tracking_a`. Writes go through the one `AnswerLogPort` of `practice/`; no second answer table, no report reads anything else.

**S3-T06 Kertas Subjektif and self-mark** · P0 (D104, no flag) · L · Type: Build · deps: S3-T04, S1-T09
- Starts from (existing): `src/modules/m28-bijak-spm/components/SelfMarkControl.vue`, `apps/api/src/modules/spm/spm.controller.ts` (nothing exists for the new part; it is added beside these files).
- PRD: R1-ADM-Q-18, R1-MUR-13 (Subjektif lane), R1-MUR-17 (answer screen), E-10; D104 (fully working at release). Gap: 404 (F6); the self-mark route `POST /api/bijak/attempts/:id/self-mark` already exists (API-BIJAK-05), the Subjektif lane and its screens do not. Approach: admin list/detail/build on `papers` with `surface = 'subjektif'` (API-BIJAK-14, DM-23); pupil Subjektif answer and Semakan with scheme on the existing self-mark route (no new self-mark endpoint, no `0160_s3_self_mark`, DM-25); fully working at release with **no feature flag** (D104 supersedes D80(2)). Files: `m28-bijak-spm/admin/**`, `components/SelfMarkControl.vue`, `BE/spm/**`, `BE/bijak/attempts/**`, `CT/bijak`; migration `0161_s3_paper_surface` (DM-23). Tests: BE + spec. Verify: V-STD vs V2 Subjektif. DoD: DoD-T.
- Data/API: DM-23, DM-25; API-BIJAK-05, API-BIJAK-14
- Also uses: DM-08 (owned by another card; read or verified here, not an ownership claim)
- New requirements from the audit (this card owns them): AC-MUR-13-24, AC-MUR-13-25 (Subjektif self-mark stored and listed).
- Answer store (D-A1, DM-44, owned by S5-T15): the Subjektif lane starts an `exam_attempts` row of kind `subjektif` (API-PRAC-10 delegates to it); `POST /bijak/attempts/:id/self-mark` (API-BIJAK-05, existing route, D-A9) updates `marks_awarded` of the part rows (`mode = subjektif`). Writes go through the one `AnswerLogPort` of `practice/`; no second answer table, no report reads anything else.

**S3-T07 Pupil SPM hub, Databank, Jana Kertas** · P1 · M · Type: Complete · deps: S1-T06
- Starts from (existing): `apps/api/src/modules/spm/hub.service.ts`, `src/modules/m06-spm/routes.ts`.
- PRD: MUR-13 hub/Databank, OQ-MUR-7. Approach: hub counts = what is servable (D91); Databank draws units; Jana Kertas Disahkan only. Files: `m06-spm/**`, `BE/spm/{hub,pool,mock}.service.ts`. Tests: counts spec. Verify: V-STD vs V2 `/spm`. DoD: DoD-T.
- Data/API: API-BIJAK-03, API-BIJAK-07, API-BIJAK-08
- Answer store (D-A1, DM-44, owned by S5-T15): a Databank drill answer writes `mode = databank` (the session mode `past_year` stays for old rows). Writes go through the one `AnswerLogPort` of `practice/`; no second answer table, no report reads anything else.

**S3-T08 Terbit pipeline on local and UAT-like** · P0 · M · Type: Ops · deps: S3-T01, S3-T02, S4-T03
- Starts from (existing): `apps/api/src/modules/exam/builder`.
- PRD: gap §7 P0-1. Approach: script `apps/api/scripts/uat-ops/terbit-papers.ts` (dry-run default) that builds papers through the admin API from approved contracts; documents U-OP-04/08/09; verified locally on the UAT-like dataset. Files: `apps/api/scripts/uat-ops/**` (S4 dir; S4 reviews), `docs/ops/`. Tests: dry-run report test. Verify: run on local; pupil sees papers in Bijak SPM. DoD: DoD-T + AC-MUR-13 "paper list non-empty".
- Data/API: DM-22; API-BIJAK-01, API-BIJAK-02

### 4.S4 Curriculum / DSKP and UAT data

**S4-T01 UAT-like local dataset** · P0 · M · Type: Ops · deps: S0-T02
- Starts from (existing): `docs/ops/cloud-dump-procedure.md`, `apps/api/prisma/seed/index.ts`.
- PRD: 40 §X5 FR-X5-1. Approach: preferred: an anonymised sample restore of UAT per `docs/ops/cloud-dump-procedure.md` (needs user approval to take the dump; kept under `.evidence/`, never committed); fallback: seed profile `uat-like` (synthetic) reproducing the **defects**: ≥11 education levels active, questions without Bab/SP, stimulus-less "Rajah n" stems, duplicated stems, 0 contracts, 0 papers, T1–T5 pupils, school admin account, ≥3 schools. Files: `SEED/uat-like/**` (new), `SEED/index.ts` (S0 one-line), `docs/ops/uat-like-data.md`. Tests: seed idempotence. Verify: stack up with the profile; counts shown on Studio match the table in the doc. DoD: DoD-T.
- Data/API: DM-39

**S4-T02 DSKP loader verified; T1–T5 content** · P0 · S · Type: Verify · deps: S0-T02
- Starts from (existing): `docs/ops/dskp-loader.md`, `apps/api/src/modules/curriculum/dskp`.
- PRD: R1-ADM-C-04, FR-X3-3. Approach: dry-run then real run locally; confirm 13 subjects × T4/T5 load (`dskp-loader.md`); add T1–T3 drop-in if the user provides data (open question); report visible in Kurikulum "DSKP" tab. Files: `BE/curriculum/dskp/**`, `docs/ops/dskp-loader.md`. Tests: loader idempotence (exists). Verify: counts of nodes per subject. UAT run = U-OP-02. DoD: DoD-T.
- Data/API: DM-14; API-DSKP-05

**S4-T03 Bab/Topik/SP mapping tool and bulk API** · P0 · L · Type: Build · deps: S4-T02
- Starts from (existing): `apps/api/src/modules/curriculum/admin.service.ts` (nothing exists for the new part; it is added beside these files).
- PRD: R1-ADM-C-05, FR-ADM-C05.*, OQ-MUR-6. Gap: UAT 686 chapters, 0 of 339,112 questions linked (gap §5.3). Approach: **bulk by filter only, no auto-mapping** (D89 forbids derived data; PRD 30 OQ-03): `POST /api/admin/curriculum/questions/bulk-chapter` (filter subject+level+optional unit, dry-run count, apply, audit trail), used by the admin through the Studio UI (S2-T08) for U-OP-07, starting with the T4-T5 subjects pupils use (Matematik, Sains, Sejarah, BI, BM). A Bab-to-Unit lookup to pre-filter the Tag step is a suggestion only (OQ-C1). No script that guesses chapters. Files: `BE/curriculum/**`, `apps/api/scripts/uat-ops/**`, `CT/curriculum`; no migration for the bulk update (DM-17: in-place update of `curriculumChapterId`; `0140_s4_question_chapter_link` is not needed). The chapter-delete guard is migration `0126_s1_chapter_fk_restrict` (DM-18, S1 range, `needs:schema`). Tests: bulk API + script dry-run. Verify: UAT-like data: Soalan by Chapter fills for T4/T5. DoD: DoD-T + AC-ADM-C05.*.
- Data/API: DM-17; API-DSKP-09, API-DSKP-10
- Also uses: API-AS-11, DM-18, DM-41 (owned by another card; read or verified here, not an ownership claim)
- Work-list (D-A5): `GET /api/admin/curriculum/chapter-coverage` (API-DSKP-10) gives the counts behind "Soalan tanpa Bab"; the list is API-Q-01 `chapter=none` (S2-T08 UI).

**S4-T04 Regroup data operations and duplicate-stem cleanup** · P0 · M · Type: Ops · deps: S1-T07
- Starts from (existing): `apps/api/src/modules/intake/workflow/figure-links.ts`.
- PRD: QE-08, G7.6, FR-X1-4f. Approach: report script listing flagged questions per subject/level; one-off trim of duplicated leaf prompt equal to stem (dry-run, reversible via a backup table); no content invented. Figures themselves cannot be recovered by code: see open question Q3. Files: `apps/api/scripts/uat-ops/regroup-report.ts`, `trim-duplicate-stem.ts`. Tests: script unit tests. Verify: UAT-like data counts match S2-T04. DoD: DoD-T.
- Data/API: DM-40
- Also uses: API-Q-13, API-Q-21, API-Q-24, DM-05, DM-06 (owned by another card; read or verified here, not an ownership claim)

**S4-T05 Darjah deactivation (Tingkatan 1–5 only)** · P0 · S · Type: Fix · deps: none
- Starts from (existing): `src/modules/m03-curriculum/pages/LevelListPage.vue`, `apps/api/src/modules/curriculum/curriculum.repository.ts`.
- PRD: FR-X3-1, FR-X3-2, R1-ADM-C-03, D96. Gap: UAT 11 levels, public "Tahap" = 11. Approach: code ensures inactive levels are excluded from every picker/list/count/public stat (grep for hard-coded level lists); the deactivation itself is done by the admin in `Tahap Pendidikan` (U-OP-03, UI); this card adds a verification script `check-levels.ts`. Files: `BE/curriculum/**`, `m03-curriculum/pages/Level*.vue`, public stats endpoint under `BE/content` (S5 review). Tests: public stats = 5. Verify: V-STD on the public landing and pickers. DoD: DoD-T + AC-X3-*.
- Data/API: DM-12, DM-13; API-AUTH-13, API-DSKP-02
- Also uses: API-DSKP-01 (owned by another card; read or verified here, not an ownership claim)

**S4-T06 T1–T5 learning served (BE)** · P0 · M · Type: Fix · deps: S4-T05
- Starts from (existing): `apps/api/src/modules/practice/rules.ts`, `apps/api/src/modules/curriculum/learner.service.ts`.
- PRD: FR-X3-3, AC-X3-1, D101. Gap: `apps/api/src/modules/practice/rules.ts:41` `SPM_LEVEL_CODES = ['T4','T5']` and curriculum learner rules limit to T4/T5 (S5 owns `practice/rules.ts`; **this card edits it by agreement**, S5 reviews). Approach: serve every active Tingkatan; subject list per level only for subjects with questions; no level-wide "akan datang". Files: `BE/curriculum/{learner.service.ts,rules.ts}`, `BE/practice/rules.ts`. Tests: T1 and T5 pupils both get subjects with counts. Verify: V-STD as T1 and T5. DoD: DoD-T + AC-X3-1.
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
- Verification and report scripts (DEV tools; OPS/ADM run the operations) for U-OP-01..U-OP-14 under `apps/api/scripts/uat-ops/` each with `--dry-run` default, a report file, idempotence; the runbook in §7 is the human side. Tests: dry-run on local. Verify: run all on the UAT-like dataset in order. DoD: DoD-T.

**S4-T09 T1-T3 DSKP structure from existing chapter data** · P1 · M · Type: Ops · deps: S4-T07 (user decision D109; not blocked)
- Starts from (existing): `docs/reference/dskp`, `docs/ops/dskp-loader.md`.
- PRD: FR-ADM-C04.3, R1-ADM-C-04, FR-ADM-C01.6, D101. The repo has T4-T5 extracts only. Decision D109: T1-T3 use the same DSKP structure as T4-T5 (Tingkatan, Subjek, Bab, SK, SP, TP). Build the T1-T3 content from the T1-T3 chapter and topic data that already exists in V3/UAT (and V2), mapped into that structure, plus any PDF in `d:\prestasiplus-dskp` that covers T1-T3. The official T1-T3 PDFs are not a prerequisite. Write it in the JSON format of `docs/reference/dskp/*.json` (`level` T1/T2/T3), run the loader dry-run, then U-OP-01 for T1-T3 (the user approves the UAT write). Bab stays required only where the subject and Tingkatan have chapters (N-3).
- Data/API: API-DSKP-05
- Also uses: DM-14 (owned by another card; read or verified here, not an ownership claim)
- Files: `docs/reference/dskp/**`, `apps/api/src/modules/curriculum/dskp/data/**`. Tests: loader tests with a T1-T3 fixture. Verify: V-STD; T2 pupil sees subjects and Bab. DoD: DoD-T + AC-ADM-C04.*.

### 4.S5 Murid learning, account, content

**S5-T01 T1–T3 pupils get practice (FE)** · P0 · M · Type: Fix · deps: S4-T06
- Starts from (existing): `src/lib/lower-form.ts`, `src/modules/m05-practice/pages/ChapterIndexPage.vue`.
- PRD: FR-X3-3, AC-X3-1, D101, OQ-MUR-1 (**superseded by D101**). Gap: `src/lib/lower-form.ts:9` ("Kandungan untuk Tingkatan anda akan datang…") used by `ChapterIndexPage.vue`, `PracticeListPage.vue`, `TopicsPage.vue`, `LearningMapPage.vue`. Approach: delete `lower-form.ts` and its uses; per-subject empty state only. Files: those pages, `m05-practice/mock/datasets/prime.ts`, tests. Tests: T1 pupil spec. Verify: V-STD as T1 and T5 (375/768/1280). DoD: DoD-T + AC-X3-1.
- Data/API: none
- Also uses: API-PRAC-01, DM-20 (owned by another card; read or verified here, not an ownership claim)

**S5-T02 Soalan by Chapter** · P0 · M · Type: Complete · deps: S4-T03, S8-T02
- Starts from (existing): `src/modules/m05-practice/pages/ChapterIndexPage.vue`, `src/modules/m05-practice/pages/ChapterSubjectPage.vue`.
- PRD: R1-MUR-9 (all ACs), R1-GUR-9 (teacher view of the same screens), FR-MUR-QP-13. Gap: UAT "Tiada subjek bab tersedia untuk tahap ini"; V2 prints a 70% unlock sentence under 14 subject cards with chapter counts; D98 and the SRS remove the rule and the sentence (every chapter is open, no lock, no 70% copy; FD-MUR-15, OQ-API-11). Approach: subjects/chapters from Bab mapping, every chapter open, no 70% rule or copy; groups shown once. Files: `m05-practice/pages/Chapter*.vue`, `BE/practice/**`. Tests: spec that Bab 2 opens with Bab 1 unanswered and no text mentions 70%. Verify: V-STD vs V2 `/soalan-by-chapter`, UAT-like data. DoD: DoD-T.
- Data/API: API-GUR-08, API-PRAC-05
- New requirements from the audit (this card owns them): AC-MUR-9-9 (a question approved through the Studio wizard with a Bab appears in Soalan by Chapter on the next load).

**S5-T03 Latih Tubi** · P0 · M · Type: Fix · deps: S1-T06, S1-T07, S8-T02
- Starts from (existing): `src/modules/m05-practice/pages/PracticeConfigPage.vue`, `apps/api/src/modules/practice/start.planner.ts`.
- PRD: R1-MUR-16, FR-MUR-QP-6, FR-MUR-QP-7, FR-MUR-QP-13. Gap: figure-less items served on UAT; figures and whole groups served (D105). Approach: use S1 servability; counts per D91; config page copy exact. Files: `m05-practice/pages/{PracticeConfigPage,PracticeListPage,PracticeQuizPage}.vue`, `BE/practice/{start.planner.ts,rules.ts}`. Tests: no stimulus-less item in 200 draws. Verify: V-STD, T5 on UAT-like data. DoD: DoD-T + AC-MUR-16-*.
- Data/API: API-PRAC-01, API-PRAC-02, API-PRAC-04
- Also uses: DM-27 (owned by another card; read or verified here, not an ownership claim)
- Answer store (D-A1, DM-44, owned by S5-T15): check-answer writes `mode` of the session (existing path, moved behind the port). The Syiling credit reads `reward_settings.coins_per_correct` (DM-48, default 1; S7-T05 owns it); the PRD constant 2 is dropped. Writes go through the one `AnswerLogPort` of `practice/`; no second answer table, no report reads anything else.

**S5-T04 Dashboard murid** · P1 · M · Type: Complete · deps: none
- Starts from (existing): `src/modules/m05-practice/pages/DashboardPage.vue`.
- PRD: R1-MUR-2. Gap: missing Pakej SPM Aktif, Kombo, Cabaran Kilat, Soalan Terkini (mood hidden OQ-MUR-10; mascot/carousel hidden OQ-MUR-3). Files: `m05-practice/pages/DashboardPage.vue`, `BE/practice/reads/overview/**`. Tests: component. Verify: V-STD vs V2 `/dashboard`. DoD: DoD-T.
- Data/API: API-MUR-01
- Also uses: DM-35 (owned by another card; read or verified here, not an ownership claim)

**S5-T05 Profil, Tetapan, Panduan for all roles** · P1 · L · Type: Complete · deps: none
- Starts from (existing): `src/modules/m01-authentication/routes/profile.ts`, `src/modules/m09-content/pages/PanduanPage.vue`.
- PRD: R1-MUR-A1, R1-MUR-A2, R1-MUR-A3, R1-GUR-A1, R1-GUR-A2, R1-GUR-A3 (all roles), R1-AS-A5, R1-ADM-N-07 (support contact read by Panduan); register 6.2b rows 7, 19. Gap: `PUT /api/me` lets a pupil change `grade` and `schoolId` (`apps/api/src/modules/account/profile.service.ts:157-158`; fix per API-AUTH-09, AC-MUR-A2-6, FR-AS-51-9: delete both writes, ignore `grade`, `schoolId` and `role` for every role); pupil profile minimal; no public profile; `/guru/profil/edit` has no route (`m10-teacher-class/components/dashboard/copy.ts:91`); account block missing; `GET /api/config/support` 404 on UAT. Files: `m01-authentication/pages/Profile*`, `routes/{profile,tetapan}.ts`, `m09-content/pages/PanduanPage.vue`, `BE/account/**`, `BE/support/` config route (S7 review), `CT/account`. Tests: per-role specs. Verify: V-STD for pupil, guru. DoD: DoD-T.
- Data/API: DM-33; API-AUTH-08, API-AUTH-09, API-AUTH-10, API-AUTH-11, API-AUTH-12, API-GUR-22, API-MUR-02, API-MUR-03, API-SUP-04
- New requirements from the audit (this card owns them): FR-MUR-A2-6, AC-MUR-A1-7, AC-MUR-A2-5, AC-MUR-A2-6 (`PUT /me` ignores grade, school and role), AC-MUR-A3-4.
- Scope hole (D-A15): `PUT /api/me` ignores `grade`, `schoolId` and `role` for every role (API-AUTH-09, exact defect `profile.service.ts:157-158`).

**S5-T06 Laporan Soalan (pupil)** · P0 · M · Type: Fix · deps: S0-T05
- Starts from (existing): `src/app/prototype-scope.ts`, `src/modules/m04-question-bank/pages/LaporanSoalanPage.vue`.
- PRD: R1-MUR-54, D98, OQ-MUR-15. Gap: hidden by `prototype-scope.ts`; `my-reports.ts` exists; `/laporan-soalan` redirects to Dashboard. Approach: menu item under the V2 "Killer Features" heading, list with counts Jumlah/Menunggu/Disemak/Diperbaiki/Ditolak, report dialog in every quiz; daily cap 20 (API-Q-19, OQ-API-06). Files: `m04-question-bank/pages/LaporanSoalanPage.vue`: **S2 owns it**, so the pupil route/page lives in `m05-practice/pages/LaporanSoalanSayaPage.vue` (new); BE reuse `question reports` via S1 contract. Tests: submit → appears. Verify: V-STD vs V2 `/laporan-soalan`. DoD: DoD-T + AC-MUR-54-*.
- Data/API: API-Q-19, API-Q-20

**S5-T07 Remedial auto-generated** · P1 · M · Type: Complete · deps: S10-T01
- Starts from (existing): `src/modules/m05-practice/pages/RemedialListPage.vue`.
- PRD: R1-MUR-12. Gap: only assigned tests, V2 auto cards from weak subjects. Files: `m05-practice/pages/Remedial*.vue`, `BE/practice/**`. Tests: weak subject 0% → card. Verify: V-STD. DoD: DoD-T.
- Data/API: API-PRAC-06, API-PRAC-07, API-PRAC-08

**S5-T08 Video and Kelas Saya (pupil) and Video admin list** · P1 · M · Type: Complete · deps: none
- Starts from (existing): `src/modules/m09-content/pages/VideoListPage.vue`, `src/modules/m10-teacher-class/pages/KelasSayaPelajarPage.vue`.
- PRD: R1-MUR-7, R1-MUR-8, R1-GUR-7, R1-AS-7, R1-ADM-N-01. Gap: no admin list for Video (BE ready); "Tambah Video" pupil rule OQ-MUR-11 (hide). Files: `m09-content/pages/Video*.vue`, new `AdminVideoListPage.vue`, `m10-teacher-class/pages/KelasSayaPelajarPage.vue`, `BE/content/videos/**`. Tests: spec. Verify: V-STD. DoD: DoD-T.
- Data/API: API-MUR-04, API-MUR-05
- Follow V2 (OQ-X-3): remove the pupil "Sertai" box and `POST /kelas-saya/join` (API-MUR-04); classmates are shown by display name only (60 section 4.6).

**S5-T09 Perutusan, Artikel, Banner, Nota** · P2 · M · Type: Complete · deps: none
- Starts from (existing): `src/modules/m09-content/pages/BannerListPage.vue`, `src/modules/m09-content/pages/AdminArticleListPage.vue`.
- PRD: R1-ADM-N-02, R1-ADM-N-03, R1-ADM-N-04, R1-ADM-P2-18 (complete Artikel/Banner/Nota/Video forms, D9 fixes); register 6.2b row 14 (`/perutusan` dead link for AS Dashboard). Files: `m09-content/pages/**`, `BE/content/{articles,banners,notes,perutusan}/**`. Tests/verify/DoD standard.
- Data/API: API-ADM-07, API-MUR-06, API-MUR-07, API-MUR-08

**S5-T10 Shell and Log Keluar (all roles)** · P0 · S · Type: Verify · deps: S0-T06
- Starts from (existing): `src/shells/nav/user-nav.ts`.
- PRD: R1-MUR-A5 (P0), R1-GUR-A5, R1-AS-A5; FR-MUR-SH-1..4, AC-MUR-SH-1..4; FR-SH / AC-SH-1..5 (20). Header pills show the pupil's own wallet values from the server (SH-4); one list for sidebar, drawer and "Cari menu" (SH-3).
- Data/API: API-AUTH-01, API-AUTH-02
- Files: `src/shells/**` pill/search code (S0 owns; one PR to S0, reviewed by S5), logout in `src/modules/m01-authentication/**` (S0). Tests: logout spec per role, header pill spec. Verify: V-STD for 3 roles. DoD: DoD-T + AC-MUR-A5-*, AC-MUR-SH-*.

**S5-T11 Soalan Berstruktur and Set Soalan Guru (pupil)** · P1 · M · Type: Complete · deps: S3-T06, S6-T14 · Delivery A (linked from R1-MUR-13, R1-MUR-2, R1-MUR-8)
- Starts from (existing): `src/modules/m05-practice/pages/StructuredListPage.vue`, `src/modules/m05-practice/pages/QuestionSetQuizPage.vue`.
- PRD: R1-MUR-17, R1-MUR-26 (D106). Gap: built with seed sets only; answer screen must follow 4.6 (parts tree, modes, autosave), scheme and self-mark. Files: `m05-practice/pages/{StructuredListPage,StructuredAnswerPage,QuestionSetQuizPage}.vue`, `BE/practice/**`. Tests: structured set end to end; teacher publishes a set (S6-T14), pupil of that class sees it, another class gets 404. Verify: V-STD per module against the SRS description of the PRD modules on this card's "PRD:" line (screen layout, exact BM copy and states are written in words there; §0A). DoD: DoD-T + every AC of the listed modules.
- Data/API: API-GUR-15, API-PRAC-10
- New requirements from the audit (this card owns them): AC-MUR-26-5.
- Answer store (D-A1, DM-44, owned by S5-T15): Set Soalan sessions write `mode = question_set`; the structured/Subjektif answer screen starts a Bijak-style attempt (S3-T06), it keeps no result table of its own. A pupil sees only sets assigned to a class they are enrolled in (DM-46); another class gets 404. Writes go through the one `AnswerLogPort` of `practice/`; no second answer table, no report reads anything else.

**S5-T12 Artikel, Topik, Peta Belajar, Audio KBAT (pupil)** · P1 · L · Type: Complete · deps: S4-T03, S5-T01 · Delivery A (R1-MUR-20) / B (rest)
- Starts from (existing): `src/modules/m03-curriculum/pages/TopicsPage.vue`, `src/modules/m09-content/pages/ArtikelListPage.vue`.
- PRD: R1-MUR-20, R1-MUR-24, R1-MUR-25, R1-MUR-27, R1-ADM-P2-17 (Audio KBAT admin, verify built), FR-MUR-24-4. Gap: Topik/Peta Belajar "akan datang" gate (`TopicsPage.vue:32,50-53`, `LearningMapPage.vue:30,50-53`), UAT topic tree empty; Artikel is linked from the Dashboard so it ships in Delivery A. Files: `m09-content/pages/Artikel*.vue`, `m03-curriculum/pages/{TopicsPage,LearningMapPage,TopicDetailPage}.vue`, `m09-content/pages/AudioKbat*.vue`. Tests: per module. Verify: V-STD per module against the SRS description of the PRD modules on this card's "PRD:" line (screen layout, exact BM copy and states are written in words there; §0A). DoD: DoD-T + every AC of the listed modules.
- Data/API: API-PRAC-11
- Also uses: DM-16 (owned by another card; read or verified here, not an ownership claim)

**S5-T13 PKSK (pupil) answering flow** · P1 · L · Type: Complete · deps: S0-T05 · Delivery B
- Starts from (existing): `src/modules/m07-pksk/routes.ts`.
- PRD: R1-MUR-19 (+ FR-MUR-19-2: the V2 listing-only page is completed, FD-MUR-31). Gap: listing only; locked without grant. Ownership of `m07-pksk` and `BE/pksk` moves from S0 to S5 for this card (CODEOWNERS App. C updated). Files: `src/modules/m07-pksk/**`, `apps/api/src/modules/pksk/**`, `CT/pksk`. Tests: grant/no-grant/expiry. Verify: V-STD per module against the SRS description of the PRD modules on this card's "PRD:" line (screen layout, exact BM copy and states are written in words there; §0A). DoD: DoD-T + every AC of the listed modules.
- Data/API: API-ADM-18, API-PRAC-12

**S5-T14 Admin Sekolah Profil, Tetapan, Panduan** · P2 · S · Type: Complete · deps: S5-T05 · Delivery B
- Starts from (existing): `src/modules/m09-content/pages/PanduanPage.vue`.
- PRD: R1-AS-A1, R1-AS-A2, R1-AS-A3 (same screens as S5-T05 for the school-admin shell; AS-A4 is S7-T10). Files: `m01-authentication/pages/Profile*`, `m09-content/pages/PanduanPage.vue`. Tests: per role. Verify: V-STD per module against the SRS description of the PRD modules on this card's "PRD:" line (screen layout, exact BM copy and states are written in words there; §0A). DoD: DoD-T + every AC of the listed modules.
- Data/API: none

**S5-T15 Single answer store: mode column and write path** · P0 · M · Type: Complete · deps: S0-T02
- Starts from (existing): `apps/api/src/modules/practice/practice.repository.ts`, `apps/api/src/modules/practice/practice.service.ts`, `apps/api/prisma/schema/practice.prisma`, `apps/api/src/modules/bijak/integration/`
- PRD: FR-X4-1, R1-MUR-4, R1-MUR-6, R1-GUR-3 (Auto AR source), XS-8. Gap: reports (`reports/analytics`, `reports/kirkpatrick`, `heatmap`, `command-center/board`) read only `practice_answers`, whose session modes are 10 values (`0014_practice_write`), while Bijak writes `exam_attempts`/`practice_attempt_aggregates` (`bijak/integration/performance-bijak-aggregate.ts`); Databank, Tracking A, Subjektif and Kuiz therefore never reach Prestasi, Headcount AR or Analisa Item (audit F-02, D-A1).
- Data/API: DM-44
- Also uses: API-PRAC-01, API-PRAC-02, API-PRAC-10, API-BIJAK-04, API-BIJAK-05, API-GAME-01 (owned by another card; read or verified here, not an ownership claim)
- Approach: add `mode`, `attempt_id`, `part_ref`, `marks_awarded`, `marks_max` to `practice_answers` (migration `0181_s5_answer_store_mode`, nullable first, backfill `mode` from the session, then NOT NULL and the check), and one internal `AnswerLogPort.record(...)` that the existing practice check-answer path now calls; expose the port to Bijak, Subjektif, Set Soalan and the games (their cards call it, 50 section 4.7a registry). A past-Bijak backfill script is dry-run by default. No new endpoint; no report is rewritten here (S10 and S6 read the same table).
- Files: `SCH/practice.prisma`, `BE/practice/{practice.repository.ts,practice.service.ts}` plus new `BE/practice/answer-log.port.ts` (named here), `BE/bijak/integration/` (S3 review), `CT/practice`; migration `0181_s5_answer_store_mode`.
- Tests: every mode in the registry writes a row; re-submit of a Bijak attempt does not duplicate; a lint-style test fails when a module inserts into `practice_answers` without the port; AC-XS-4 numbers (10 Latih Tubi + 40 Bijak answers = 50 on every screen).
- Verify: V-STD; AC-CHAIN-1, 3, 4. DoD: DoD-T.

### 4.S10 Performance and analytics (m08), all roles

**S10-T01 Prestasi 360 (pupil own data)** · P0 · M · Type: Fix · deps: S0-T06
- Starts from (existing): `src/modules/m08-student-performance/pages/Prestasi360Page.vue`, `src/modules/m08-student-performance/routes/prestasi.ts`.
- PRD: R1-MUR-4 (all ACs), FR-X4-4. Gap: pupil `Prestasi` → "Dashboard Sekolah" (school-wide data leak): `src/modules/m08-student-performance/routes/prestasi.ts:18` (`student` in `PRESTASI_SCHOOL_ROLES`), redirect `/prestasi → /prestasi/sekolah`; `/prestasi/:userId` exists unused. Approach: pupil route renders own Prestasi 360; BE rejects school-wide for student (`BE/reports/performance/domain/access-policy.ts`, `privacy.ts`). Files: those + `pages/**`. Tests: pupil gets 403 on school endpoint; own data ok. Verify: V-STD vs V2 "Prestasi Saya". DoD: DoD-T + AC-MUR-4-*.
- Data/API: API-RPT-01, API-RPT-02
- New requirements from the audit (this card owns them): FR-MUR-4-12, AC-MUR-4-8, AC-X4-1 (pupil side).
- Metrics (D-A10): Ketepatan pooled with 1 decimal on the wire, XS-4/5/7 over `practice_answers` of all modes (60 section 4.6); Bijak sittings appear as one unit in the session list and in the counts via the single answer store.

**S10-T02 Headcount (pupil, guru, school admin)** · P0 · L · Type: Complete · deps: S0-T05
- Starts from (existing): `src/modules/m08-student-performance/pages/HeadcountShellPage.vue`, `src/modules/m08-student-performance/routes/headcount.ts`.
- PRD: R1-MUR-3, R1-GUR-3, R1-AS-3; register rows 4, 11. Gap: pupil `/headcount` 403 (role map in `routes/headcount.ts`), guru sub-pages are shells (`headcount.ts:69-92` → `pages/HeadcountShellPage.vue`), AS list empty because scope = own config only (`headcount.service.ts:114,121`, per gap `headcount.ts:47-60`). Approach: pupil read view (TOV/OTR/AR/RS with V2 empty text "Guru anda belum menyediakan headcount"); guru Key-in AR, Edit TOV/ETR, Unjuran, Tetapan working; AS school-scope read-only list. Files: `m08-student-performance/{routes/headcount.ts,pages/Headcount*,components/**}`, `BE/reports/performance/**`, `CT/reports/performance*`. Tests: three role specs. Verify: V-STD; headcount data for evidence E-1. DoD: DoD-T + AC-MUR-3-*, AC-GUR-3-*, AC-AS-3-*.
- Data/API: DM-29, DM-49; API-AS-15, API-RPT-08, API-RPT-09, API-RPT-10, API-RPT-16
- Also uses: DM-28 (owned by another card; read or verified here, not an ownership claim)
- New requirements from the audit (this card owns them): FR-MUR-3-9, AC-MUR-3-7, AC-MUR-3-8.
- New requirements from the audit (this card owns them): FR-GUR-3-8 (HC-SPEC is the only definition), FR-GUR-3-9 and AC-GUR-3-13 ("Simpan Sasaran" saves the teacher's default TOV/ETR), AC-GUR-3-1..13.
- One computation (D-A3): implement HC-SPEC of 20 R1-GUR-3 once (Auto AR = round(correct / answered * 100) over `practice_answers`, all modes; one "On Track" rule AR >= OTR_k of the latest checkpoint with an AR); pupil, teacher, school-admin, Prestasi and Dashboard call the same rules. "Simpan Sasaran" = `PUT /api/headcounts/:id/defaults` (API-RPT-16, DM-49, migration `0191_s10_headcount_defaults`).

**S10-T03 Analisa Item (pupil, guru, school admin)** · P0 · M · Type: Fix · deps: S0-T05
- Starts from (existing): `src/modules/m08-student-performance/routes/analisa-item.ts`.
- PRD: R1-MUR-6, R1-GUR-6, R1-AS-6. Gap: pupil target missing in `analisa-item.ts:43` `analisaItemTarget`; guru band contradiction, unbound sort. Files: `m08-student-performance/routes/analisa-item.ts`, `pages/**`, `BE/reports/performance/**`. Tests: per role. Verify: V-STD, E-2 evidence. DoD: DoD-T.
- Data/API: API-AS-17, API-RPT-05, API-RPT-06, API-RPT-07
- New requirements from the audit (this card owns them): AC-MUR-6-7.
- New requirements from the audit (this card owns them): FR-GUR-6-8 and FR-AS-6-5 ("Soalan Diuji" = XS-7, counters of all modes), AC-GUR-6-8, AC-GUR-6-9, AC-AS-6-5.
- Metrics (D-A10): "Soalan Diuji" = distinct questions (XS-7), "Cubaan/Betul/Salah" count all modes (XS-8); discrimination index needs at least 10 pupils with answers [PROPOSED].

**S10-T04 Analitik Adaptif (guru, school admin) and SP data** · P0 · M · Type: Fix · deps: S4-T03 (data), S0-T06
- Starts from (existing): `src/modules/m08-student-performance/routes/class.ts`, `src/modules/m08-student-performance/pages/AnalitikKelasPage.vue`.
- PRD: R1-GUR-5, R1-AS-5 (P0), R1-MUR-5; DK rules (10-murid 4.10); register row 8. Gap: roles on class route (`routes/class.ts:33`) exclude `school_admin`; menu target wrong. Approach: `/analitik/kelas` for guru + AS; SP mastery from DSKP; hide "Rekod Intervensi" for AS (OQ-AS-5). Files: `m08-student-performance/routes/{class,analitik}.ts`, `pages/**`, `BE/reports/performance/**`. Tests: spec per role. Verify: V-STD vs V2 `/analitik/kelas`. DoD: DoD-T + AC-GUR-5-*, AC-AS-5-*.
- Data/API: API-AS-16, API-RPT-03, API-RPT-04
- Also uses: DM-19 (owned by another card; read or verified here, not an ownership claim)
- New requirements from the audit (this card owns them): FR-GUR-5-7 and FR-AS-5-6 (all modes, pooled accuracy), AC-GUR-5-7, AC-AS-5-5.

**S10-T05 Heatmap Topik Lemah** · P1 · S · Type: Fix · deps: S4-T03
- Starts from (existing): `apps/api/src/modules/heatmap/heatmap.service.ts`.
- PRD: R1-MUR-14, OQ-MUR-6. Gap: UAT empty. Approach: Bab first, SP tags second. Files: `BE/heatmap/**`, `CT/heatmap`. Tests: service. Verify: V-STD. DoD: DoD-T.
- Data/API: API-DSKP-08

**S10-T06 Remaining m08 modules real-API only** · P1 · M · Type: Fix · deps: S0-T09
- Starts from (existing): `src/modules/m08-student-performance/routes.ts`.
- PRD: FR-X2-0. Approach: for Prestasi (guru/AS), Kelas, Ranking, Timeline remove mock handlers in matrix paths. Files: `m08-student-performance/{api,mock}/**`. Tests: S0-T09 check green for m08. DoD: DoD-T.
- Data/API: none

**S10-T07 Prestasi (guru, school admin)** · P1 · M · Type: Verify · deps: S6-T03
- Starts from (existing): `src/modules/m08-student-performance/pages/PrestasiSekolahPage.vue`.
- PRD: R1-GUR-4, R1-AS-4. Gap: AS teacher count and numbers differ from other screens (XS rules); buttons Tingkatan/Kelas on Prestasi not click-tested. Files: `m08-student-performance/{routes/prestasi.ts,pages/**}`, `BE/reports/performance/**`. Tests: numbers equal Command Center (XS). Verify: V-STD per module against the SRS description of the PRD modules on this card's "PRD:" line (screen layout, exact BM copy and states are written in words there; §0A). DoD: DoD-T + every AC of the listed modules.
- Data/API: none
- Also uses: API-RPT-02, DM-28 (owned by another card; read or verified here, not an ownership claim)
- New requirements from the audit (this card owns them): FR-GUR-4-6 and FR-AS-4-6 (all modes from `practice_answers`, XS-8), AC-GUR-4-6, AC-AS-4-6, AC-AS-4-7.

**S10-T08 Timeline Saya (pupil)** · P2 · M · Type: Complete · deps: S7-T04 · Delivery B
- Starts from (existing): `src/modules/m08-student-performance/pages/TimelinePage.vue`.
- PRD: R1-MUR-39. Gap: V3 manual posts only; V2 automatic feed from sessions, badges, level-ups. Files: `m08-student-performance/routes/timeline.ts`, `pages/**`, `BE/reports/performance/**`. Tests: feed merge, privacy of public posts. Verify: V-STD per module against the SRS description of the PRD modules on this card's "PRD:" line (screen layout, exact BM copy and states are written in words there; §0A). DoD: DoD-T + every AC of the listed modules.
- Data/API: API-RPT-14, API-RPT-15

### 4.S6 Guru, Admin Sekolah, Admin Pusat users/monitoring

**S6-T01 Laporan Mingguan Guru** · P0 · L · Type: Build · deps: S0-T06
- Starts from (existing): `src/modules/m11-teacher-analytics/routes/laporan-mingguan.ts`, `src/modules/m08-student-performance/pages/LaporanMingguanPage.vue` (nothing exists for the new part; it is added beside these files).
- PRD: R1-GUR-43 (all ACs); register rows 1, 2. Gap: `m11-teacher-analytics/routes/laporan-mingguan.ts:12-27` renders `PrototypeUnavailablePage`; menu target wrong (`user-nav.ts:287`); `prestasi.ts:95-106` `roles: []`; `BE/reports/performance/services/weekly-report.service.ts:5-11` has no teacher API. Approach: new teacher API + screen per V2 `guru/laporan-mingguan.blade.php` (class picker, Cetak, Soalan Dijawab, Pelajar Aktif, Pelajar Meningkat, Subjek Perlu Perhatian, Pelajar Terbaik) at `/guru/laporan-mingguan-kelas`. Files: `m11-teacher-analytics/**`, `BE/reports/**` (weekly service is S10's folder: **S10 reviews**; endpoint under `BE/command-center/guru/` is the alternative if S10 objects), `CT/reports/*`. Tests: BE + spec. Verify: V-STD vs V2. DoD: DoD-T + AC-GUR-43-*.
- Data/API: API-GUR-21
- Also uses: API-RPT-13 (owned by another card; read or verified here, not an ownership claim)
- New requirements from the audit (this card owns them): FR-GUR-43-8 (all modes in the weekly report), AC-GUR-43-8..10.

**S6-T02 Kirkpatrick: school admin 7 screens, guru shell** · P0 · L · Type: Fix · deps: S0-T06
- Starts from (existing): `src/modules/m12-kirkpatrick/routes/mount.ts`, `src/modules/m12-kirkpatrick/pages/KirkpatrickOverviewPage.vue`.
- PRD: R1-AS-11 (P0), R1-GUR-11, R1-ADM-M-04 (admin Kirkpatrick, same 7 screens); register rows 9, 10. Gap: `m12-kirkpatrick/routes/mount.ts:32-38` "S1 only"; `routes/overview.ts:39` `detailLinks:false`; `pages/KirkpatrickOverviewPage.vue:5,37-38`; guru mounts in admin chrome (`mount.ts:25-30`); false "Penurunan 73.3%" on no activity (FR-X4-3). Verified in a visible browser on the GitHub build (2026-11-04): the "Tahap 1" click is dead, `/admin-sekolah/kirkpatrick/reaction` returns **404** (not 403), and the filter offers "Semua Sekolah/Semua Negeri" to a school admin (must be own school only). Approach: enable all 7 screens + PDF for AS (BE roles), teacher layout for guru, no-data ≠ decline. Files: `m12-kirkpatrick/**`, `BE/reports/kirkpatrick/**`. Tests: role matrix BE tests; spec. Verify: V-STD vs V2 `/admin/kirkpatrick` scoped. DoD: DoD-T + AC-AS-11-*, AC-GUR-11-*.
- Data/API: DM-30; API-RPT-11

**S6-T03 Cross-screen numbers (XS-1..5)** · P0 · L · Type: Fix · deps: S10-T02
- Starts from (existing): `src/modules/m27-school-admin/routes.ts`, `apps/api/src/modules/school-admin/dashboard.service.ts`.
- PRD: 20 §5 XS-1..5, AC-XS-*; FR-X4-1. Gap: pupils 17/16/13, teachers 3/4, answers 122/30/36, accuracy 57.9/73.3/33.3 % (`m27/mock/read-models/*`, and the m08, m11, m12 read models). Approach: one school read model (BE) implementing XS definitions; every screen calls it; delete the mock read models. Files: `BE/school-admin/**`, `BE/command-center/**`, `m27-school-admin/{api,mock}/**`, `m11-teacher-analytics/**`. Tests: a single fixture school, assert the same number on all screens (spec lists them). Verify: V-STD, UAT school-admin account. DoD: DoD-T + AC-XS-1..5.
- Data/API: DM-28; API-AS-01, API-AS-07
- Also uses: API-AS-02, API-AS-17 (owned by another card; read or verified here, not an ownership claim)
- New requirements from the audit (this card owns them): AC-X4-1, AC-X4-2 (one number on every screen, pooled accuracy).
- Metrics (D-A10): one named query per XS-1..XS-8 for every screen, including the Admin Pusat Command Center, Laporan, Monitoring and Kirkpatrick views.

**S6-T04 Amaran Awal no-data** · P0/P1 · S · Type: Fix · deps: none
- Starts from (existing): `apps/api/src/modules/school-admin/amaran/risk.rules.ts`.
- PRD: R1-AS-49, FR-X4-3; register row 15. `BE/school-admin/amaran/risk.rules.ts:63-76` scores no data as Merah → "Belum Bermula". Tests: rules unit. Verify: V-STD. DoD: DoD-T + AC-AS-49-*.
- Data/API: API-AS-13

**S6-T05 UAT school-admin account and preconditions** · P0 · S · Type: Ops · deps: user approval (U-OP-12)
- Starts from (existing): `docs/ops/r1-operator-checklist.md`.
- PRD: R1-AS-0. Approach: create the account through the existing admin form ("Janakan Akaun Admin Sekolah") on UAT with the user's approval; credentials stay outside the repo. DoD: account can log in; AS ACs can be run on UAT. (Executed by Delivery Lead.)
- Data/API: none

**S6-T06 Sumbang Soalan: paper submit (guru)** · P1 · M · Type: Fix · deps: S1-T08
- Starts from (existing): `src/modules/m10-teacher-class/components/soalan/lib.ts`, `apps/api/src/modules/classes/question-sets/question-sets.ports.ts`.
- PRD: R1-GUR-44, FR-GUR-44-8, AC-GUR-44-9 (the "Alat Soalan" block of six tiles; AC-GUR-44-9 closes only when S6-T14 and S6-T16..T20 have landed); register row 5 (`m10-teacher-class/components/soalan/lib.ts:28`, `HantarKertasCard.vue:70-73`). Approach: remove "belum tersedia" copy, real upload, status list. Files: `m10-teacher-class/components/soalan/**`, `pages/SumbangSoalan*`. Tests: spec. Verify: V-STD. DoD: DoD-T + AC-GUR-44-*.
- Data/API: API-DSKP-07, API-GUR-09, API-GUR-18, API-GUR-19, API-GUR-20
- Also uses: API-GUR-17 (owned by another card; read or verified here, not an ownership claim)
- New requirements from the audit (this card owns them): FR-GUR-44-9 and FR-GUR-44-10, AC-GUR-44-10, AC-GUR-44-11.

**S6-T07 Command Center, Dashboards and Misi Harian (guru, AS)** · P1 · L · Type: Complete · deps: none
- Starts from (existing): `src/modules/m10-teacher-class/pages/CommandCenterPage.vue`, `src/modules/m10-teacher-class/pages/GuruDashboardPage.vue`.
- PRD: R1-GUR-1, R1-GUR-2, R1-GUR-2b (Misi Harian, route `/guru/misi-harian` not built; D106; reward per N-2: per-answer Syiling = the admin coin rate, `rewardCoins` paid once at the target, remove `MISSION_COINS_PER_CORRECT` in `apps/api/src/modules/practice/rules.ts`, AC-GUR-2b-5), R1-AS-1, R1-AS-2; register rows 6, 14, 20. Gap: platform card "0 Sekolah Berdaftar" for AS; Remedial/Evaluate/Badges unverified (`CommandCenterPage.vue:86-170`); checklist dead targets (`components/dashboard/copy.ts:84-96`, `GuruDashboardPage.vue:147`). Files: `m10-teacher-class/pages/{CommandCenterPage,GuruDashboardPage}.vue`, `components/dashboard/**`, `BE/command-center/**`. Tests: click specs. Verify: V-STD. DoD: DoD-T.
- Data/API: API-ADM-21, API-AS-02, API-AS-03, API-GUR-07, API-GUR-10, API-GUR-11, API-GUR-12, API-GUR-13, API-GUR-14, API-MUR-08
- Also uses: API-GUR-25 (owned by another card; read or verified here, not an ownership claim)

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

**S6-T10 Guru lists and reports** · P1 · M · Type: Complete · deps: S6-T03
- Starts from (existing): `src/modules/m10-teacher-class/pages/PelajarSayaPage.vue`, `src/modules/m11-teacher-analytics/routes/laporan.ts`.
- PRD: R1-GUR-41, R1-GUR-42; Cipta Pelajar silent failure; Laporan pills drop class filter and count mismatch. Files: `m10-teacher-class/pages/**`, `m11-teacher-analytics/pages/Laporan*`. Tests/verify standard. DoD: DoD-T + AC-GUR-41/42-*.
- Data/API: API-GUR-05, API-GUR-06
- Also uses: API-RPT-07 (owned by another card; read or verified here, not an ownership claim)
- New requirements from the audit (this card owns them): FR-GUR-42-6 (every mode counts in Laporan), AC-GUR-42-6.

**S6-T11 Admin Pusat users, schools, classes, central dashboards** · P1 · M · Type: Complete · deps: none
- Starts from (existing): `src/modules/m17-admin-dashboard/routes.ts`, `src/modules/m02-users-schools/routes.ts`.
- PRD: R1-ADM-U-05, R1-ADM-U-06, R1-ADM-U-07, R1-ADM-U-08, R1-ADM-U-09, R1-ADM-M-01, R1-ADM-M-02, R1-ADM-M-05, R1-ADM-M-06. Gap: Dashboard redirects to Command Center, Analitik/Laporan empty (gap §5.5), no Kelas Sekolah in Pentadbiran. Files: `m02-users-schools/**`, `m17-admin-dashboard/**`, `BE/users`, `schools`, `school-admin`. Tests/verify standard (V2 admin). DoD: DoD-T.
- Data/API: API-ADM-02, API-ADM-05, API-ADM-06, API-ADM-11, API-ADM-12
- Also uses: API-ADM-01, DM-35 (owned by another card; read or verified here, not an ownership claim)

**S6-T12 Admin Pusat Pengguna and Sekolah (U-01..U-04)** · P0 · M · Type: Fix · deps: S4-T05
- Starts from (existing): `src/modules/m02-users-schools/routes.ts`.
- PRD: R1-ADM-U-01 Pengguna, U-02 Tambah Pengguna, U-03 Edit (+ reset kata laluan), U-04 Sekolah (all P0); AC-ADM-U01.*..U04.*; OQ-U1 (hide SK/SJK rows by default, D72). The U-OP-12 accounts depend on these screens working.
- Data/API: DM-35; API-ADM-01, API-ADM-03
- New requirements from the audit (this card owns them): FR-ADM-U03.4 (grade, school and role changed only by admin edit), FR-ADM-U05.5, FR-ADM-U06.2 (password minimum 8, teacher bulk path is U-06).
- Gap: built on GH and UAT but no AC executed on UAT data; no Darjah or primary school may be offered (FD-U02). Approach: run every AC on UAT-like data, fix what fails (filters, role scoping, pupil level picker T1-T5 only, school type); tables to cards at 375.
- Files: `src/modules/m02-users-schools/**`, `BE/users/**`, `BE/schools/**`. Tests: specs per AC. Verify: V-STD vs V2 `/admin/users`, `/admin/schools`. DoD: DoD-T + AC-ADM-U01.*..U04.*.

**S6-T14 Teacher Set Soalan and Kelas Saya (guru)** · P1 · L · Type: Build · deps: S1-T06 · Delivery A (D106, D108(3))
- Starts from (existing): `src/modules/m10-teacher-class/pages/SetSoalanSayaPage.vue` (nothing exists for the new part; it is added beside these files).
- PRD: R1-GUR-8, R1-GUR-8b (teacher Set Soalan: `/guru/set-soalan`, `/cipta`, `/:id`, `/:id/keputusan`; V2 `guru/set.blade.php`), feeds R1-MUR-26. Gap: not built for teachers (`m10-teacher-class/pages/SetSoalanSayaPage.vue` is the pupil-facing list). Approach: list with counters, create/edit from approved questions only, Terbitkan/Draf/Jadikan Draf, Salin to a class, results page. Files: `m10-teacher-class/pages/**`, `BE/classes/**` (set endpoints, S1 reviews `question-sets/`). Tests: publish → pupil sees, archived question drops out. Verify: V-STD per module against the SRS description of the PRD modules on this card's "PRD:" line (screen layout, exact BM copy and states are written in words there; §0A). DoD: DoD-T + every AC of the listed modules.
- Data/API: DM-46; API-GUR-01, API-GUR-02, API-GUR-03, API-GUR-04, API-GUR-16
- Also uses: API-MUR-04, DM-15, DM-43 (owned by another card; read or verified here, not an ownership claim)
- New requirements from the audit (this card owns them): FR-GUR-8b-8 (a partial stimulus group is refused with 422 "Soalan dalam kumpulan rangsangan mesti dipilih bersama."), FR-GUR-8b-3 (several explicitly selected own classes), 8b-5 (results per class), AC-GUR-8b-8..10.
- Assignment (D-A7): `classroomIds[]` on create/update/copy (API-GUR-16), table `question_set_classrooms` (migration `0201_s6_question_set_assignments`, backfill one row per existing set); results per class; partial stimulus group = 422 "Soalan dalam kumpulan rangsangan mesti dipilih bersama."; only `draft` and `published`; pupil session mode `question_set`.

**S6-T15 Jemput Ibu Bapa and Pautan Ibu Bapa admin** · P2 · M · Type: Complete · deps: S6-T12 · Delivery B
- Starts from (existing): `apps/api/src/modules/parents/parents.controller.ts`.
- PRD: R1-MUR-40, R1-ADM-P2-16. Files: `m02-users-schools/**` (admin tab Ibu Bapa), `m05-practice`/profile pupil page (S5 reviews), `BE/parents/**`. Tests: link, regenerate invalidates, remove parent. Verify: V-STD per module against the SRS description of the PRD modules on this card's "PRD:" line (screen layout, exact BM copy and states are written in words there; §0A). DoD: DoD-T + every AC of the listed modules.
- Data/API: API-MUR-09

**S6-T13 Central reports and Admin Sekolah Dashboard** · P2 · L · Type: Complete · deps: S6-T03 · Delivery B
- Starts from (existing): `src/modules/m17-admin-dashboard/routes.ts`.
- PRD: R1-ADM-M-07, R1-ADM-M-08, R1-AS-2 (Dashboard numbers per XS), R1-GUR-A4 is S7-T10. Files: `m17-admin-dashboard/**`, `m27-school-admin/**`, `BE/school-admin/**`. Verify: V-STD per module against the SRS description of the PRD modules on this card's "PRD:" line (screen layout, exact BM copy and states are written in words there; §0A). DoD: DoD-T + every AC of the listed modules.
- Data/API: API-ADM-13, API-ADM-22
- Also uses: API-AS-01 (owned by another card; read or verified here, not an ownership claim)

**S6-T16 Soalan & Rujukan (guru: personal MCQ with a reference link)** · P1 · M · Type: Build · deps: S6-T07 (Misi Harian), S1-T07 · Delivery A (D106, OQ-G-15)
- Starts from (existing): `apps/api/src/modules/questions/http/guru.controller.ts`, `src/modules/m10-teacher-class/pages/SumbangSoalanCiptaPage.vue`, `src/shells/nav/out-of-scope.ts`.
- PRD: R1-GUR-44a, FR-GUR-44a-1..6, AC-GUR-44a-1..6; DV-GUR-44a-1, DV-GUR-44a-2.
- Data/API: DM-42; API-GUR-24, API-GUR-25
- New requirements from the audit (this card owns them): FR-GUR-44a-7, AC-GUR-44a-7.
- Gap: `/api/guru/questions` CRUD exists but creates bank submissions in review. Missing: the own-visibility flag, the reference-link field, serving through Misi Harian (R1-GUR-2b) and the routes `/guru/soalan-guru` and `/guru/soalan-guru/cipta`.
- Approach: (1) small PR to S1 (`needs:schema`): migration `0127_s1_personal_question` and the `visibility = 'bank'` predicate in every served set; (2) `BE/classes/teacher-tools/personal-questions.*` CRUD, own only (another id = 404), http/https links only, Tingkatan 1-5 only; (3) mission draw adds the owner's personal questions for the pupils of the owner's classes only, item carries `referenceUrl`; (4) pages `/guru/soalan-guru` (list) and `/cipta` (form with the V2 labels), link opens in a new tab on the pupil screen; (5) delete-only PR to S0 removes the two routes from `GURU_TOOLS`.
- Files: `m10-teacher-class/pages/**`, `BE/classes/teacher-tools/**`, `CT/classes`; other sectors by small PR: S1 (`SCH/questions.prisma`, `BE/questions/served-rule.ts`), S0 (`out-of-scope.ts`).
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
- PRD: R1-GUR-44d, FR-GUR-44d-1..6, AC-GUR-44d-1..6, FR-X1-4d, FR-X1-4e, FR-X1-4f.
- Data/API: API-GUR-27
- Gap: no teacher endpoint and no page. Missing: a read-only list with computed subject counts (Teras and Elektif), search, approved Tingkatan 1-5 questions only, whole stimulus groups. Do not reuse `GET /api/spm/databank`.
- Approach: `BE/classes/teacher-tools/databank.*` reads the same servable predicate as the pupil draws (counts equal what pupils get, D11, D91); page `/guru/databank` with hero, two stat cards, subject tiles, search; delete-only PR to S0 for `GURU_TOOLS`.
- Files: `m10-teacher-class/pages/**`, `BE/classes/teacher-tools/**`, `CT/classes`. Tests: tile counts equal dataset, zero-question subject not counted active, group shown once, personal and unapproved questions absent. Verify: V-STD. DoD: DoD-T + AC-GUR-44d-*.

**S6-T20 Kertas Peperiksaan (guru)** · P1 · L · Type: Build · deps: S6-T14, S1-T06 · Delivery A (D106, OQ-G-15)
- Starts from (existing): `apps/api/src/modules/exam/builder/`, `src/modules/m10-teacher-class/pages/SetSoalanSayaPage.vue`.
- PRD: R1-GUR-44e, FR-GUR-44e-1..5, AC-GUR-44e-1..5.
- Data/API: DM-43; API-GUR-28
- Gap: the exam builder is admin-only. Missing: a teacher-owned paper resource (list, create draft, add approved questions, share to own classes) and the page `/guru/kertas-peperiksaan`. File upload of a paper stays in S6-T06.
- Approach: reuse the S6-T14 set tables and picker rules (`question_sets.kind = 'kertas'`, migration `0200_s6_question_set_kind`), not the admin `papers` table (OD-15); `BE/classes/teacher-tools/kertas.*`; share and withdraw; delete-only PR to S0 for `GURU_TOOLS`.
- Files: `m10-teacher-class/pages/**`, `BE/classes/teacher-tools/**`, `SCH/classes.prisma`, `CT/classes`. Tests: draft invisible to other teachers, shared paper reaches only own classes with the group intact, empty name rejected. Verify: V-STD. DoD: DoD-T + AC-GUR-44e-*.

### 4.S7 Gamification, games, marketplace

**S7-T01 Permainan (pupil) on real API** · P1 · S · Type: Verify · deps: S0-T09
- Starts from (existing): `src/modules/m16-battle-games/routes.ts`.
- PRD: R1-MUR-21; gap: matches V2. Task = remove mock paths (`m16-battle-games/mock`), E-7 evidence. Files: `m16-battle-games/**`. Verify: V-STD. DoD: DoD-T.
- Data/API: API-GAME-01, API-GAME-02, API-GAME-03
- New requirements from the audit (this card owns them): AC-MUR-21-6 (a game answer counts in the reports).
- Answer store (D-A1, DM-44, owned by S5-T15): a question answered in a game writes `mode = game`; Syiling follow `reward_settings.mini_games_give_coins` (default No). Writes go through the one `AnswerLogPort` of `practice/`; no second answer table, no report reads anything else.

**S7-T02 Sekolah Bersaing (school admin)** · P0 · M · Type: Fix · deps: none
- Starts from (existing): `src/modules/m16-battle-games/mock/data/sekolah-bersaing-seed.ts`, `apps/api/src/modules/games/leagues/sekolah-bersaing.controller.ts`.
- PRD: R1-AS-45 (P0); register row 12. Gap: "Data minggu ini belum dijana." because `SB_WEEKS` has no current week and no fallback (`m16-battle-games/mock/data/sekolah-bersaing-seed.ts:219`); real BE `games/leagues/sekolah-bersaing.controller.ts`. Approach: compute the board on request from live sessions (average session accuracy per school over T1-T5 sessions, FR-AS-45-4; no weekly job, no `week` line, no stored board, OQ-API-07, DM-31); delete the `SB_WEEKS` seed read; own-school highlight; restrict the route to Admin Sekolah and Admin Pusat (OQ-API-09). Files: `BE/games/leagues/**`, `m16-battle-games/**`. Tests: board for the fixture schools equals the session data; spec. Verify: V-STD vs V2. DoD: DoD-T + AC-AS-45-*.
- Data/API: DM-31; API-AS-14

**S7-T03 Tetapan Permainan (admin)** · P1 · M · Type: Complete · deps: S0-T07
- Starts from (existing): `apps/api/src/modules/games/games.module.ts`, `src/modules/m16-battle-games/routes.ts`.
- PRD: 30 N-05. Gap: BE + client exist, no page. Files: `m16-battle-games/**` admin page, `BE/games/**`. Verify: V-STD vs V2. DoD: DoD-T.
- Data/API: API-ADM-08

**S7-T04 Syiling, Tukar Token, Cabaran Harian, Pencapaian + admin Gamifikasi** · P1 · L · Type: Complete · deps: S0-T07 · Delivery A (R1-MUR-28, 29, 30 linked)
- Starts from (existing): `apps/api/src/modules/gamification/admin.controller.ts`, `src/modules/m14-gamification/routes.ts`.
- PRD: R1-MUR-28, R1-MUR-29, R1-MUR-30, R1-MUR-34, R1-ADM-P2-01, R1-ADM-P2-02, R1-ADM-P2-03, R1-ADM-P2-04, R1-ADM-P2-05, R1-ADM-P2-06. Gap: pupil screens exist, admin has no Gamifikasi screens (BE `admin/gamification` exists, gap §5.5); reward model differs from V2 (gap §2.3). Files: `m14-*/**`, `m15-*/**`, admin pages under `m14-*`, `BE/gamification/**`. Tests: admin sets a Cabaran, pupil completes it, wallet changes. Verify: V-STD per module against the SRS description of the PRD modules on this card's "PRD:" line (screen layout, exact BM copy and states are written in words there; §0A). DoD: DoD-T + every AC of the listed modules.
- Data/API: DM-38; API-ADM-14, API-GAME-07
- Also uses: API-MUR-10 (owned by another card; read or verified here, not an ownership claim)

**S7-T05 Kedai Hadiah, Kedai Hadiah Digital, Tebusan, Kawalan Reward** · P1 · L · Type: Complete · deps: S7-T04 · Delivery A (R1-MUR-31 linked) / B (38)
- Starts from (existing): `apps/api/src/modules/shop`, `src/modules/m15-rewards-shop/routes.ts`.
- PRD: R1-MUR-31, R1-MUR-38, R1-ADM-P2-07, R1-ADM-P2-08, R1-ADM-P2-09, U-OP-13. Gap: catalogue empty, redemptions cannot be fulfilled (gap §5.5). Files: `m15-*/**`, `BE/shop/**`, `BE/wallet/**`. Tests: redeem → queue → deliver/cancel. Verify: V-STD per module against the SRS description of the PRD modules on this card's "PRD:" line (screen layout, exact BM copy and states are written in words there; §0A). DoD: DoD-T + every AC of the listed modules.
- Data/API: DM-48; API-ADM-15, API-ADM-16, API-GAME-08
- Also uses: DM-38 (owned by another card; read or verified here, not an ownership claim)
- New requirements from the audit (this card owns them): FR-ADM-P2-08.4, FR-ADM-P2-09.3.
- Coin rate (D-A11): table `reward_settings` (migration `0223_s7_reward_settings`, singleton, `coins_per_correct` default 1 = the V2 value); API-ADM-16 `flatCoins` reads and writes it; the wallet credit of every question mode reads it.

**S7-T06 Papan Pendahulu, Kedudukan, Tournament + admin views** · P1 · L · Type: Complete · deps: S7-T04 · Delivery A (R1-MUR-33 linked)
- Starts from (existing): `src/modules/m08-student-performance/pages/LeaderboardPage.vue`, `apps/api/src/modules/battle/standings/standings.service.ts`.
- PRD: R1-MUR-33, R1-MUR-18, R1-MUR-23, R1-ADM-P2-14, R1-ADM-P2-15. Gap: no period/scope filters or own rank (gap §2.3); duplicate route `/leaderboard` vs `/gamification/leaderboard` (FR-MUR-33-5). Files: `m16-battle-games/**`, `m14-*/**`, `BE/battle/**`. Tests: own rank outside top 3. Verify: V-STD per module against the SRS description of the PRD modules on this card's "PRD:" line (screen layout, exact BM copy and states are written in words there; §0A). DoD: DoD-T + every AC of the listed modules.
- Data/API: API-ADM-17, API-GAME-04, API-GAME-05, API-GAME-06, API-RPT-13
- Also uses: DM-38 (owned by another card; read or verified here, not an ownership claim)

**S7-T07 Cabutan Bertuah, Kotak Misteri, Rujuk Kawan** · P2 · L · Type: Complete · deps: S7-T05 · Delivery B
- Starts from (existing): `apps/api/src/modules/shop`, `src/modules/m15-rewards-shop/routes.ts`.
- PRD: R1-MUR-22, R1-MUR-35, R1-MUR-36, R1-ADM-P2-10, R1-ADM-P2-11. Gap: admin BE has `POST draws` only; Kotak Misteri admin missing (backend work). Files: `m15-*/**`, `BE/shop/**`. Verify: V-STD per module against the SRS description of the PRD modules on this card's "PRD:" line (screen layout, exact BM copy and states are written in words there; §0A). DoD: DoD-T + every AC of the listed modules.
- Data/API: DM-36, DM-37; API-GAME-09, API-MUR-10
- Also uses: API-ADM-16, API-GAME-08 (owned by another card; read or verified here, not an ownership claim)

**S7-T08 Marketplace (pupil + admin)** · P2 · L · Type: Complete · deps: S7-T05 · Delivery B
- Starts from (existing): `apps/api/src/modules/marketplace/marketplace.controller.ts`, `src/modules/m20-marketplace/routes.ts`.
- PRD: R1-MUR-32, R1-ADM-P2-12, R1-ADM-P2-13. Gap: BE reads only; no admin Produk/Penjual (backend work). Files: `m20-marketplace/**`, `BE/marketplace/**`; no migration (DM-38: the existing marketplace tables are enough; `0220_s7_marketplace_admin` is not needed). Verify: V-STD per module against the SRS description of the PRD modules on this card's "PRD:" line (screen layout, exact BM copy and states are written in words there; §0A). DoD: DoD-T + every AC of the listed modules.
- Data/API: API-ADM-19
- Also uses: DM-38 (owned by another card; read or verified here, not an ownership claim)

**S7-T09 Tetapan (support contact) and admin Tiket Bantuan** · P1 · M · Type: Build · deps: none · Delivery A (N-07 feeds Panduan) / B (P2-20)
- Starts from (existing): `apps/api/src/modules/support/support.controller.ts` (nothing exists for the new part; it is added beside these files).
- PRD: R1-ADM-N-07, R1-ADM-P2-20 (D108(4)). Migration `0180_s5_support_ticket_context` (DM-32; the table is in S5's schema file, so a `needs:schema` request to S5). Gap: UAT `GET /api/config/support` 404; no `/admin/settings`, `/admin/tiket` write screens. Files: `m22-support-tickets/**`, `BE/support/**`. Tests: setting read by Panduan, ticket status flow. Verify: V-STD per module against the SRS description of the PRD modules on this card's "PRD:" line (screen layout, exact BM copy and states are written in words there; §0A). DoD: DoD-T + every AC of the listed modules.
- Data/API: DM-32; API-ADM-10, API-SUP-03, API-SUP-05
- Also uses: API-SUP-04, DM-33 (owned by another card; read or verified here, not an ownership claim)

**S7-T10 Tiket Bantuan (pupil, guru, school admin)** · P2 · M · Type: Complete · deps: S7-T09 · Delivery B
- Starts from (existing): `apps/api/src/modules/support/support.controller.ts`, `src/modules/m22-support-tickets/routes.ts`.
- PRD: R1-MUR-A4, R1-GUR-A4, R1-AS-A4. Files: `m22-support-tickets/**`, `BE/support/**`. Verify: V-STD per module against the SRS description of the PRD modules on this card's "PRD:" line (screen layout, exact BM copy and states are written in words there; §0A). DoD: DoD-T + every AC of the listed modules.
- Data/API: API-SUP-01, API-SUP-02
- Also uses: DM-32 (owned by another card; read or verified here, not an ownership claim)
- New requirements from the audit (this card owns them): AC-MUR-A4-5 (single admin reply shown, the pupil cannot reply).

### 4.S8 Question rendering and responsive

**S8-T01 Move shared display components behind one barrel** · P0 · S · Type: Fix · deps: none
- Starts from (existing): `src/components/question-display/index.ts`, `src/modules/m28-bijak-spm/components/PartInput.vue`.
- Data/API: none
- Move the files listed in §2/S8 into `src/components/question-display/`, leave re-export stubs at the old paths, update imports mechanically (no behaviour change). Land on day 1–2 of Sprint 0. Tests: existing suites green. DoD: DoD-T. Everyone rebases after it.

**S8-T02 Stimulus panel: once, sticky, zoomable** · P0 · M · Type: Fix · deps: S8-T01
- Starts from (existing): `src/components/question-display/StimulusGroup.vue`, `src/modules/m28-bijak-spm/components/StimulusView.vue`.
- PRD: FR-X1-4d, FR-X6-6/7, AC-X6-2, 10-murid §4.8. Gap: 3/15 stimulus types (gap §2.2 row 13; `StimulusView.vue`), `StimulusGroup.vue` shows per-question. Approach: group panel above its questions; on <768 px a collapsible sticky "Lihat Rajah"; pinch/tap full-screen zoom; table/passage/graph types; long maths scrolls inside. Files: `src/components/question-display/{StimulusGroup,StimulusFigure,StimulusView,StimulusStack}.vue`. Tests: component tests incl. 375 snapshot; spec in `e2e/bijak`. Verify: V-STD on a paper with one figure + 3 questions at 375. DoD: DoD-T + AC-X6-2.
- Data/API: none
- Also uses: DM-03 (owned by another card; read or verified here, not an ownership claim)

**S8-T03 Answer widgets and maths input** · P0 · L · Type: Complete · deps: S8-T01, S1-T09
- Starts from (existing): `src/components/question-display/AnswerWidget.vue`, `src/modules/m28-bijak-spm/components/PartInput.vue`.
- PRD: FR-X6-8, D41, OQ-MUR-13. Gap: 8/14 widgets. Approach: full-width MCQ, short text, working + final answer (maths), "Pilih N", photo upload; `MathField`/`MathKeyboard` usable with the phone keyboard; touch ≥44 px. Files: `question-display/{AnswerWidget,McqOptions,TextAnswer,EssayAnswer,PartInput,MathField,MathKeyboard}.vue`. Tests: widget tests per mode. Verify: V-STD at 375 with the on-screen keyboard. DoD: DoD-T.
- Data/API: none

**S8-T04 Navigator, timer, Hantar on phone** · P0 · M · Type: Fix · deps: S8-T01
- Starts from (existing): `src/modules/m28-bijak-spm/components/NavigatorPanel.vue`, `src/modules/m28-bijak-spm/components/AttemptShell.vue`.
- PRD: FR-X6-8/9. Approach: bottom-sheet navigator showing answered/flagged; sticky timer/Hantar not covering the question; landscape rotation keeps place. Files: `question-display/{NavigatorPanel,AttemptShell}.vue`. Tests: component + spec. Verify: V-STD. DoD: DoD-T.
- Data/API: none

**S8-T05 Paper view (cover, review, result, preview)** · P1 · M · Type: Complete · deps: S8-T02
- Starts from (existing): `src/modules/m28-bijak-spm/pages/ResultPage.vue`, `src/modules/m28-bijak-spm/pages/PaperCoverPage.vue`.
- PRD: FR-X6-10. Sections/parts/marks readable at 375; admin paper preview. Files: `question-display/**` (new `PaperView.vue`). Tests/verify standard. DoD: DoD-T.
- Data/API: none

**S8-T06 DS primitives: table→cards, forms, two-pane→tabs** · P0 · M · Type: Complete · deps: none
- Starts from (existing): `src/ds/DsDataTable.vue`, `src/ds/DsDrawer.vue`.
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

**S9-T02 V2 side-by-side check, local evidence only** · P0 · M · Type: Ops · deps: none
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

**S9-T06 End-to-end data chains AC-CHAIN-1..9** · P0 · L · Type: Verify · deps: sprint merged
- Starts from (existing): `docs/prd/r1/40-cross-cutting.md`, `e2e/`
- PRD: 40 section X9, AC-CHAIN-1..9 (one chain per audited flow: 1 admin question to every report, 2 paper PDF to pupil paper, 3 Bijak lanes, 4 class and Set Soalan, 5 Headcount, 6 Sumbang Soalan to admin, 7 Tiket Bantuan, 8 school-user lifecycle, 9 gamification and redemption). This card **owns all nine**.
- Data/API: none
- Approach: implement each chain as one Playwright spec per chain (`e2e/r1/chain-n.http.spec.ts`) that enters ONE record on the first side and asserts the same figure on every other side, on the seeded UAT-like dataset; run it in a **headed** browser at 375, 768 and 1280. The chain fails on the first screen that shows a different number or name. Chains land with their cards: 1 (S1-T01, T02, T07, S2-T01, S4-T03, S5-T02, T03, T15, S10-T01, T03, T05, S6-T03) and 2 (S1-T03, T10, S2-T02, S3-T02, T04, S5-T15) and 5 (S10-T02, S6-T03, S5-T15) in Sprint 3; 3 (S3-T05, T06, T07), 4 (S6-T10, T14, S5-T08, T11), 6 (S6-T06, S1-T08), 8 (S6-T09, T12) in Sprint 4; 9 (S5-T03, S7-T04, T05, T06) in Sprint 5; 7 (S7-T09, T10) in Sprint 8.
- **Exit gate:** every chain passes on seeded data in a headed browser at 375/768/1280, evidence in `.evidence/S9-T06/`; a chain that fails returns the failing step to the owning card (the chain's card list above), it is never patched here. No product code in this card.
- Tests: the nine specs. DoD: DoD-T (a), (d), (h) only.

**Card count:** S0 11, S1 10, S2 9, S3 8, S4 9, S5 15, S10 8, S6 20, S7 10, S8 7, S9 6 = **113 cards** (Delivery A and Delivery B, marked per card; the generated `docs/plan/r1-traceability.md` lists every card with its PRD modules).

---

## 5. Parallelisation, critical path, sprint plan

### 5.1 What can run at the same time
- **Day 1, no dependencies:** S0 (T01–T04, T08), S1 (T01, T08), S2 (T03, T07 UI work), S3 (T01, T03), S4 (T02, T05), S5 (T05, T08), S6 (T04, T05, T07), S7 (T02), S8 (T01, T06).
- **After S0-T02 (stack):** S4-T01 dataset; S1/S3/S5/S10 integration tests.
- **After S8-T01:** S8-T02/T03/T04 in parallel with S3 admin cards (S3-T01..T03) and S2 cards.
- Sectors never write the same file (§2); shared files go through S0 (§3).

### 5.2 Critical path (Delivery A)
`S0-T02 stack` → `S1-T01 groups` → `S1-T03 extraction` → `S2-T02 import UI` → `S3-T02 Set Builder` → (`S8-T01 → S8-T02 → S8-T03/T04`) → `S3-T04 pupil sitting` → `S4-T08 / S3-T08 UAT ops (Kontrak Disahkan → Terbit)` → `S9 UAT acceptance`. Parallel critical branch for chapter learning: `S4-T02 DSKP → S4-T03 Bab mapping (needs the investigation, open question Q3) → S5-T02 → S10-T04/T05`. The P0 portal-breakage branch (`S0-T05 → S0-T06 → S10-T01..T04, S5-T06, S6-T01, S6-T02`) is independent and is the quickest visible win.

### 5.3 Split by number of developers
Assumptions: **1 ideal day = 1 day of focused work; a developer delivers 8 ideal days per 2-week sprint** (10 working days x 0.8 focus, after reviews, calls, rebasing). S = 1, M = 3, L = 6. Estimated totals: **Delivery A about 340 days, Delivery B about 37 days** (the 110 cards in the traceability report; the per-developer figures in the table below were set before cards S6-T16..T20 were added and are re-baselined after Sprint 1). Estimates are re-baselined after Sprint 1.

| Devs | Sector assignment (non-overlapping, permanent) | Delivery A duration | Verdict |
|---|---|---|---|
| **1** | one at a time in this order: S0 → S8-T01 → S10 P0 → S6 P0 → S4 → S1 → S2 → S3 → S8 → S5 → S6 P1 → S7 | ≈ 36 sprints for Delivery A (72 weeks) | Not viable for 1.0. Use only if the user lowers the scope; then do P0 cards only (≈ 120 days, 15 sprints) |
| **2** | Dev A: S0, S1, S4, S3, S10 (≈ 123 d). Dev B: S2, S5, S6, S7, S8 (≈ 122 d) | ≈ 18 sprints (36 weeks) | Possible but long |
| **3** | A: S0, S1, S4 (74 d). B: S2, S3, S8 (83 d). C: S5, S6, S7, S10 (≈ 94 d) | ≈ 12 sprints (24 weeks) | Minimum recommended |
| **5** | A: S0 + S1 (51 d). B: S2 + S8 (50 d). C: S3 + S10 (52 d). D: S4 + S5 (50 d). E: S6 + S7 (48 d) | ≈ 7 sprints (Sprint 0 + 6 = 13 weeks), then Delivery B | Recommended; matches the sprint table below |

Inside every sprint each developer works only in their own sectors' paths; a task needing another sector's path is a small PR to that sector's developer. The Delivery Lead (S9) is a separate role and does not count as a developer.

### 5A. Sprint plan

**Sprint length: 2 weeks (Sprint 0: 1 week).** Reasons: L cards are 6 ideal days, so they must fit inside one sprint; every sprint needs time for verification on UAT with the Delivery Lead, which is slow (3 s between V2 pages, headed browser); the user sees a demo every 2 weeks, a rhythm they can follow. One week would put ceremonies and verification on the critical path; four weeks would hide a failing direction for too long. After Sprint 3, if velocity is stable and the user wants quicker feedback, switch to 1 week (this is an explicit retro decision).

**Ceremonies (all kept minimal).** Sprint planning 30 min (Delivery Lead + sector leads: pick cards, confirm ACs, move issues into the iteration). Daily: each developer posts 3 lines (§6.7), no meeting. Sprint review: the user watches the demo script live in a visible browser (≤30 min). Retro: 15 min, three bullets (stop/start/keep) written in `docs/plan/r1-board.md` notes. Nothing else.

**"Sprint done" definition.** A sprint is done only when (1) every card in it is Done under DoD-T *or* explicitly carried over with a reason; (2) **every AC on the sprint's exit list passes** in the AC ledger with evidence; (3) the demo was shown to the user; (4) `main` branch of work (`feature/v3-bijak-r1`) is green (CI, sidebar-walk). Progress is reported as "ACs passing / ACs planned", then "cards done / planned", in that order.

**Carry-over rules.** A card that misses the sprint returns to Backlog with its progress note and is re-estimated; carry-over is allowed once; the second time it must be split or re-assigned at planning. A card whose AC fails at verification returns to In progress (it is not Done); it counts as carry-over. Anything a card needs from another sector and did not get is reported as blocked on day 2, not on the last day.

**Tracking per sprint.** GitHub Project fields: **Sprint** (iteration field: Sprint 0, 1, 2, …), **Estimate** (number, ideal days from the S/M/L size), **Sector**, **Phase**, **Priority**, **Status** (Backlog / Claimed / In progress / In review / Verifying / Done). Burn-down: a Project "Burn up" chart on Estimate by Sprint, plus the two-line sprint table in `docs/plan/r1-board.md` (planned days, done days, planned ACs, passing ACs). The AC ledger (`docs/plan/r1-ac-ledger.md`, §6.9) is the real measure.

#### Sprint table (5-developer variant; other variants in 5B)

Exit-criteria notation: `AC-MUR-3-*` means all acceptance criteria of that module in the PRD; the PRD files are authoritative for the IDs.

**Sprint 0 (1 week) — Foundation.**
- *Goal (user-visible):* "Any developer can clone the project, run one command, log in as pupil T1/T4, teacher, school admin and admin on a stack with data; the board exists; UAT has the DSKP loaded and a school-admin account."
- *Cards:* S0-T01, T02, T03, T04, T08 · S8-T01, T06 · S4-T01, T02 (dry-run + local; UAT run is a ops step), T05 · S1-T01 (start) · S6-T05 (ops) · S2-T03 · S5-T08 (start). ≈ 36 days of 40.
- *Entry:* plan approved by the user; GitHub Project/labels/CODEOWNERS created by the Delivery Lead (S0-T01); each developer declared a sector in `r1-board.md`.
- *Exit (ACs):* FR-X5-2 (stack boots untouched, CI `stack-smoke` green); AC-X2-3 check runs (report mode); U-OP-01 (DSKP loader), U-OP-02 (intake env), U-OP-03 (Darjah) and U-OP-12 (accounts) done on UAT with the user's approval: UAT "Tahap" = 5 (FR-X3-2) and a school-admin account can log in; S8-T01 merged.
- *Demo:* (1) fresh clone → `npm run stack:up` → login as each role; (2) show the Project board with every card, sector and estimate; (3) open a PR touching two sectors and show both owners requested; (4) UAT landing shows Tahap 5; (5) Kurikulum shows DSKP nodes.

**Sprint 1 — "No broken sidebar, correct pupil analytics and teacher/school-admin P0 screens".**
- *Goal:* "A T5 pupil on UAT opens every sidebar item: Prestasi shows only their own data, Headcount, Analisa Item and Laporan Soalan work; the teacher's Laporan Mingguan and Analitik Adaptif open real screens; the school admin sees Kirkpatrick (7 screens) and Sekolah Bersaing with data."
- *Cards:* S0-T05, T06 · S10-T01, T02, T03, T04 · S5-T06, T05 (start) · S6-T01, T02, T03 (start), T04 · S7-T02 · S3-T01, T03 · S1-T01 (finish), T02 · S4-T03 (investigate + bulk API start), T04 (script) · S8-T02 (start).
- *Entry:* Sprint 0 exit.
- *Exit (ACs):* AC-X2-1 for pupil, teacher, school admin (sidebar-walk green for these rows); AC-X2-2 for the modules fixed; `AC-MUR-4-*`, `AC-MUR-3-*`, `AC-MUR-6-*`, `AC-MUR-54-*`; `AC-GUR-43-*`, `AC-GUR-5-*`, `AC-AS-5-*`, `AC-AS-11-*`, `AC-AS-3-*`, `AC-AS-45-*`, `AC-AS-49-*`; XS-1..3 on the fixture school; FR-X4-4 (pupil cannot see school data).
- *Demo:* (1) pupil T5 on UAT-like data: open every sidebar item at 375 and 1280 (sidebar-walk spec shown green); (2) Prestasi → own 360, then show school endpoint returns 403 for the pupil; (3) guru → Laporan Mingguan prints a class report; (4) school admin → Kirkpatrick all 7 screens, Sekolah Bersaing board, same pupil count on three screens; (5) side by side with V2 Laporan Mingguan.

**Sprint 2 — "DSKP-correct question entry and import".**
- *Goal:* "An admin enters a question group (one figure, three questions) and imports a PDF paper whose Rajah 3 stays with questions 5–8; completeness is explained at entry; the admin menu has one bank and one review queue."
- *Cards:* S1-T03, T04, T05, T07 · S2-T01, T02, T05, T07 (start) · S0-T07 (menu FINAL, D107) · S4-T03 (finish, apply on local), S4-T06, T07 · S3-T02 (start) · S5-T01, T04, T15 · S6-T03 (finish), S6-T12 (Pengguna/Sekolah, P0), T06 (waits S1-T08) · S8-T02 (finish), T03 (start) · S0-T09.
- *Entry:* S1-T01 done; S0-T03 worker on; S8-T01 done; S2-T03 aliases merged (the menu itself is FINAL, D107).
- *Exit (ACs):* `AC-ADM-QE1.*..QE6.*`, `AC-ADM-Q03..Q09.*`, `AC-ADM-G7.1`, `AC-ADM-G7.3`; AC-X3-1 (T1 and T5 both practise); `AC-ADM-C05.*` on the dataset; AC-X6-1 for S2 screens at 375/768/1280.
- *Demo:* (1) Studio: create a stimulus then three questions without re-uploading the figure; (2) upload a PDF fixture: batch finishes, Rajah 3 → Q5–8 grouped, reviewer adjusts range, accept; (3) completeness panel names missing fields; (4) CSV with DSKP columns publishes; (5) sidebar "Soalan" group = 8 items, V2 paths redirect; (6) T1 pupil practises.

**Sprint 3 — "T5 pupil on UAT sits a published Bijak SPM paper with stimulus groups on a phone".**
- *Cards:* S3-T02, T04, T08 · S8-T03, T04, T05 · S1-T06, T10 · S9-T06 (chains 1, 2, 5) · S2-T04, T08, T09(P2 optional) · S5-T02, T03, T07 · S4-T08, T04 (apply) · S3-T05 · S10-T05 · S6-T07, T08.
- *Entry:* Sprint 2 exit; S4 Bab mapping tool ready.
- *Exit (ACs):* `AC-MUR-13-*` (Bijak part), `AC-MUR-QP-1..17`, `AC-ADM-Q17.*`, `AC-ADM-C01.*`, `AC-ADM-U01..U04.*`, AC-X6-2, AC-X6-1 for every question-paper screen; `AC-MUR-9-*`, `AC-MUR-16-*`, `AC-ADM-Q13.*, AC-ADM-Q14.*, AC-ADM-Q15.*, AC-ADM-Q16.*`, `AC-ADM-QE7.*`, `AC-ADM-G7.2`, AC-X3-1, **AC-CHAIN-1, AC-CHAIN-2, AC-CHAIN-5** (S9-T06, headed browser). UAT ops: U-OP-07 (Bab mapping, T4-T5 core subjects), U-OP-05/06 (quarantine and stem clean-up), U-OP-04 (Kontrak Disahkan), U-OP-08 (pool seed), U-OP-09 (Terbit) executed with the user's approval after local rehearsal.
- *Demo:* (1) admin builds a paper in the single Set Builder from groups, publishes with a Disahkan contract; (2) on **UAT** the T5 pupil on a 375 px headed browser sits it: figure shown once, zoomable, navigator, Hantar, result; (3) Soalan by Chapter lists the chapters, all open (no 70% rule); (4) regroup work-list shows counts; id 812791-like items are no longer served.

**Sprint 4 — Delivery A: remaining P0 and P1 part A.**
- *Goal:* "Kertas Subjektif with pupil self-mark works (no flag), Tracking A, Kiriman Guru, the pupil Dashboard/Profile, the school-admin reports, teacher Set Soalan and Misi Harian work."
- *Cards:* S3-T06, T07 · S1-T08, T09 · S2-T05, T06 · S5-T05, T08, T09, T11 · S6-T09, T10, T11, T14 · S8-T05, T07 · S10-T06, T07 · S7-T01, T03, T09 · S0-T10.
- *Exit (ACs):* `AC-MUR-13-*` (all), `AC-MUR-17-*`, `AC-MUR-26-*`, `AC-MUR-2-*`, `AC-MUR-A1-*`, `AC-MUR-A2-*`, `AC-MUR-A3-*`, `AC-GUR-44-*` (except AC-GUR-44-9), `AC-GUR-8-*`, `AC-GUR-8b-*`, `AC-GUR-41-*`, `AC-GUR-42-*`, `AC-AS-46-*..AC-AS-53-*`, `AC-ADM-Q12.*, Q18.*, Q20..Q23.*`, `AC-ADM-N01.*, N05.*, N06.*, N07.*`; AC-X2-3 check switches to **fail** mode and is green; **AC-CHAIN-3, AC-CHAIN-4, AC-CHAIN-6, AC-CHAIN-8** (S9-T06).
- *Demo:* teacher sends a PDF paper → admin sees it in Kiriman Guru; teacher publishes a Set Soalan → pupil of the class plays it; a subjective paper is sat and self-marked on a phone; school-admin reports show the same numbers.

**Sprint 5 — Delivery A: linked modules (D106).**
- *Goal:* "Every module linked from a 1.0 screen works: Artikel, Syiling/Tukar Token/Cabaran Harian, Kedai Hadiah, Papan Pendahulu/Kedudukan/Tournament, with their admin feeds."
- *Cards:* S7-T04, T05, T06 · S5-T12 (Artikel part) · S6-T07 (Misi Harian), T12 leftovers · S6-T16, T17, T18, T19, T20 (Alat Soalan tools) · S4-T07 leftovers · S10-T05 · S9 verification of Sprint 4.
- *Exit (ACs):* `AC-MUR-20-*`, `AC-MUR-28-*`, `AC-MUR-29-*`, `AC-MUR-30-*`, `AC-MUR-31-*`, `AC-MUR-33-*`, `AC-MUR-18-*`, `AC-MUR-23-*`, `AC-ADM-P2-01.*..P2-09.*`, `AC-ADM-P2-14.*`, `AC-ADM-P2-15.*`, `AC-ADM-P2-18.*`, `AC-GUR-2-*`, `AC-GUR-44-9`, `AC-GUR-44a-*..AC-GUR-44e-*`; no dead link from any 1.0 screen (AC-X2-2); **AC-CHAIN-9** (S9-T06).
- *Demo:* click every link on the pupil Dashboard, Kelas Saya and Profil; admin sets a challenge and a reward, the pupil earns and redeems it.

**Sprint 6 — Delivery A hardening and release candidate.**
- *Goal:* "Every Delivery A module passes on UAT, side by side with V2, at 375/768/1280; the user signs off Delivery A."
- *Cards:* carry-over and fixes from S9 findings; S9-T03 (XL pass), S9-T04 (release checklist). No new scope.
- *Exit (ACs):* all Delivery A ACs; AC-X2-1, 2, 3; **AC-CHAIN-1..6, 8, 9 re-run green (S9-T06 exit gate)**; AC-X6-1 for every Delivery A screen; AC-X6-2; AC-X3-1; release checklist §8; `node scripts/r1-trace-check.mjs` prints `uncovered: 0 | dangling: 0`.
- *Demo:* full run as pupil, teacher, school admin, admin; open every sidebar item and every link; the checklist.

**Sprint 7+ (Delivery B)** — one sprint goal per module cluster, exit by ACs: Sprint 7 S7-T07 (Cabutan, Kotak Misteri, Rujuk Kawan), S7-T08 (Marketplace), S5-T12 (Topik, Peta Belajar, Audio KBAT), S5-T13 (PKSK); Sprint 8 S7-T10 (Tiket Bantuan; exit AC-CHAIN-7), S6-T13, S6-T15, S10-T08, S5-T14, S0-T11 (flags); Sprint 9 hardening and Delivery B sign-off. Each Delivery B module goes live by removing its scope flag (S0-T11), only after its ACs pass.

### 5B. Capacity variants: the same backlog on 1, 2, 3 and 5 developers

| Sprint | 5 devs (A S0+S1, B S2+S8, C S3+S10, D S4+S5, E S6+S7) | 3 devs (A S0+S1+S4, B S2+S3+S8, C S5+S6+S7+S10) | 2 devs (A S0,S1,S4,S3,S10 / B S2,S5,S6,S7,S8) | 1 dev |
|---|---|---|---|---|
| 0 | Foundation (above) | S0-T01..T04, S8-T01, S4-T01/T02 (rest slips) | S0-T01..T04, S8-T01 | S0-T01..T04, S8-T01 (≈ 6 d) |
| 1 | P0 portals | S0-T05/T06, S10-T01..T04, S6-T01 | S0-T05/T06, S10-T01/T02 (A); S6-T01, S5-T06 (B) | S0-T05/T06, S10-T01 |
| 2 | P0 portals (rest) | S10-T04, S6-T02/T04, S7-T02, S5-T06, S4-T05 | S6-T02, S7-T02 (B); S10-T03/T04, S4-T05 (A) | S10-T02/T03 |
| 3 | Question pipeline | S1-T01, S1-T02, S2-T03 | … | S10-T04, S5-T06 |
| 4 | … | S1-T03..T05, S2-T01/T02 | … | S6-T01 |
| … | Sprint 3 Bijak SPM | continues with S3-T02, S8-T02..T04 (≈ Sprint 6–7) | S3 and S1 pipeline (A), S2/S8 (B) from Sprint 5 | P0 order as §5.3 |

Rules for every variant: (1) P0 cards of the sprint list above come before any P1 card, whatever the variant; (2) the order of sprint *goals* is fixed (portal P0 → question entry → Bijak on phone → P1 → hardening → Delivery B), so fewer developers means more sprints per goal, not a different order; (3) sector ownership stays disjoint: with 2 or 3 developers one developer holds several sectors, but a sector is never split between two developers at the same time (exception: S5 and S6 may be split by sub-folder if the sector lead agrees in `r1-board.md`); (4) at 1 developer, the Delivery Lead decides the order after each sprint and the user is told the new expected date.

---

## 6. Claim-and-track mechanism

### 6.1 Artefacts
- **GitHub Issues**: one per task card (title `S3-T04 Pupil sitting and result (Bijak SPM)`), created from the issue template (App. A). Body = the card (PRD refs, files, tests, verification, DoD), written to the issue so developers never hunt in the plan.
- **Labels:** `sector:S0..S10`, `delivery:A|B`, `priority:P0|P1|P2`, `size:S|M|L`, `type:fix|complete|build|verify|ops`, `status:backlog|claimed|in-progress|in-review|verifying|done`, `blocked`, `needs:schema`, `needs:contract`, `needs:answer` (agent stopped: not in the PRD text), `needs:approval` (UAT/V1/V2 or user decision), `sprint:N` mirrored by the Project iteration.
- **GitHub Project "R1"**: board with columns **Backlog / Claimed / In progress / In review / Verifying / Done**; fields Sprint (iteration), Estimate, Sector, Phase, Priority. Views: Board, Table by Sector, Table by Sprint.
- **`docs/plan/r1-board.md`**: one table mirroring claims for offline readers (§6.6). Updated by the claimant in the same PR as the first commit of the task and by the Delivery Lead on Done.
- **`docs/plan/r1-ac-ledger.md`**: one line per PRD AC (§6.9).

### 6.2 Declaring a sector
A developer (or an AI agent session acting for one) adds a row to the "Sector leads" part of `r1-board.md`: sector ID, name, GitHub handle, date. One **sector lead per sector at a time**; the lead reviews PRs in the sector's paths and keeps the sector's cards in order. Multi-sector developers list each. Handing a sector over = edit the row and comment on the pinned issue "Sector leads".

### 6.3 Claiming a task
1. Pick a card from your sector in the current Sprint (or any Backlog card if your sector's sprint cards are done).
2. Check the card's `depends-on` are Done (or the dependency is merged to the integration branch).
3. **Self-assign the issue and comment `claim`**; move it to **Claimed**. **A card cannot move to In progress until the issue carries the "Gap check" section** (§0B workflow step 1; label `needs:gapcheck` is removed by the sector lead when it is there). A second person who wants it comments instead; one claimant per task.
4. Create the branch `r1/S<n>-T<nn>-<slug>` (e.g. `r1/S3-T04-pupil-sitting`) from `feature/v3-bijak-r1`; open a **draft PR** within one working day; status → **In progress**.
5. WIP limit: one In progress + one In review per developer.
6. A card in another sector may be claimed only after the sector lead comments `ok`.

**Stale-claim rules.** Each claimed or in-progress issue needs a daily line (§6.7) or a comment. **No update for 2 working days (P0) / 3 working days (P1/P2): the Delivery Lead comments "releasing"; after 1 more working day the assignee is removed and the card returns to Backlog.** The claimant may reclaim it if no one else did. A draft PR with no push for 3 days is closed with a note, the branch kept.

### 6.4 Branches, PRs
- Branch `r1/S<n>-T<nn>-<slug>`; commits `S3-T04: …`; squash merge title `S3-T04 …`.
- PR template (App. B) fields: **card ID (exactly one)**, Gap-check link, existing files changed, the reason for each new file, DM/API IDs, ACs and AC-CHAIN-n proven, issue link, PRD refs (module / FR / AC), sector, paths from other sectors touched (and their owners requested), migration number from your range, contract change (yes/no, contract PR link), real test output, **screenshots at 375/768/1280 from a visible browser**, V2 comparison (what differs, deviation numbers), UAT-data check (dataset used), placeholder-string check, DoD ticks.
- **CODEOWNERS** (App. C) requests the sector lead for every owned path; a PR touching another sector's paths needs that owner's approval; branch protection requires CODEOWNERS review + green CI.

### 6.4a Board rules from the improve-not-rebuild guardrails (§0B)
- Status **In progress** needs the Gap check section; **In review** needs the PR with exactly one card ID and the scope-guard job green.
- The sector lead rejects a Fix or Complete PR that does not touch its "Starts from" files or that adds a parallel page, service, store, route or table; a schema change must name a DM ID and an endpoint an API ID (guardrail 3).
- Change budget by Type (Keep and Verify: no product code; Fix and Complete: the "Starts from" files, new files only if the card names them; Build: new files only at the named location; Ops: no product code).
- The Delivery Lead moves an issue to Done only after the card's ACs and every AC-CHAIN-n through it were run in a visible browser at 375/768/1280.

### 6.5 Moving to Done (Delivery Lead)
Merged PR → issue moves to **Verifying**. The Delivery Lead (S9) then: reads the PR evidence; reruns the card's ACs in a visible browser at 375/768/1280, side by side with V2 (§X7); checks UAT data or UAT-like data; updates the AC ledger; if everything holds, moves to **Done** and closes the issue; otherwise comments the failed AC, moves it back to **In progress** (the claimant keeps the claim for 2 days to fix). Only S9 moves an issue to Done.

### 6.6 `docs/plan/r1-board.md` format (single table)
```
| ID | Title | Sector | Del | Pri | Type | Size | Sprint | Status | Claimant | PR | Updated |
|----|-------|--------|-----|-----|------|------|--------|--------|----------|----|---------|
| S3-T04 | Pupil sitting and result | S3 | A | P0 | Complete | L | 3 | In progress | @handle | #123 | 2026-11-20 |
```
Above the table: "Sector leads" (S0..S10: handle, since) and the current sprint goal and ACs planned/passing. Nothing else.

### 6.7 Daily status (3 lines per developer, posted in the pinned issue "Daily" or in the team channel)
```
Done: <card id> <what is proven>.
Next: <card id> <what I will do today>.
Blocked: <none | card id waiting for what from whom>.
```

### 6.8 Anti-bureaucracy limits
No separate boards per team; no merge log file; no per-agent handoff documents; no extra status words; no new documents unless a PRD/ADR must change. Evidence stays local in `.evidence/`.

### 6.9 AC ledger
`docs/plan/r1-ac-ledger.md`: table `AC ID | Module | Priority | Sprint | Local | UAT-like | UAT | V2 compared | 375 | 768 | 1280 | Evidence path | Date`. Cell values `-`, `FAIL`, `PASS`. Seeded from the PRD AC lists by a script `scripts/ac-ledger.mjs` (S0, S size, optional). Sprint review reports passing/planned from this file.

---

## 7. Environments and data

**Run the stack.** `npm ci` → `npm run stack:up` (compose.yaml + compose.http.yaml; builds the SPA in `VITE_API_MODE=http`, migrates and seeds the demo data). Ports 5192/5193 (UI) as in the stack docs; `npm run stack:down`. Dev loop without Docker: `npm run be:dev` (API :3000) and `VITE_API_MODE=http npm run dev` with `COOKIE_SECURE=false` in `.env.api` (`docs/plan/http-switch-checklist.md`). Checks: `npm run typecheck`, `npm run lint`, `npm test`, `npm run be:verify`, `npm run contract:check`, `npm run test:e2e:http -- --grep @api`.
**Seeds.** Demo seed (small). E2E profile: `E2E_SEED=1 npm run be:db:seed -- --profile=e2e` (`docs/ops/e2e-seed.md`; needs S0-T02 first). UAT-like profile or sample dump: S4-T01.
**UAT-like data locally.** Preferred: anonymised dump of UAT per `docs/ops/cloud-dump-procedure.md` (needs the user's approval; kept in `.evidence/`, never committed; no real names in anything committed). Fallback: synthetic profile that reproduces the defects (11 levels, unmapped questions, stimulus-less "Rajah n", 0 contracts/papers).
**Accounts.** Demo accounts for local. UAT accounts (pupil T1, T5, teacher, admin, school admin) are in the credentials file outside the repo (CLAUDE.md "Credentials"); never copied into docs or issues.

### UAT data operations runbook

The IDs are the 14 UAT data tasks of PRD 30 §5 (U-OP-01..14). Owner key from the PRD: **OPS** = a human operator with server access (D95: **no AI session acts on a server**); **ADM** = Admin Pusat using the UI; **DEV** = a developer builds the tool, then ADM runs it. Nothing runs without the user's explicit approval in the conversation ("approve U-OP-nn"). Every script has `--dry-run` as default and writes a report to `.evidence/uat-ops/`; a backup (`docs/ops/db-backup.md`) comes first. V1, V2 and UAT are never modified outside this list.

| Order | ID | Operation (PRD 30 §5) | Owner | Approval | Needs first | Tool card |
|---|---|---|---|---|---|---|
| 1 | (backup) | Backup of the UAT DB | OPS | user | none | n/a |
| 2 | U-OP-02 | Intake environment: `JOBS_WORKER_ENABLED=true`, `OCR_ENGINE=tesseract` + `OCR_LANG_DIR`, real extraction provider (not `AI_PROVIDER=mock`) | OPS | user | S0-T03 merged | S0-T03 |
| 3 | U-OP-03 | Deactivate Darjah D1-D6 in `Tahap Pendidikan`; check public stats and pickers | ADM | user | S4-T05 merged | S4-T05 |
| 4 | U-OP-01 | **DSKP loader** (`npm run dskp:load -w @pp/api -- --dry-run`, then real; T4-T5, T1-T3 when extracts exist) | OPS | user | backup; dry-run report reviewed | S4-T02 |
| 5 | U-OP-12 | Acceptance accounts: T5, T4, T2 pupils, teacher, a school and its Admin Sekolah ("Janakan Akaun") | ADM | user | S6-T12 | S6-T05 |
| 6 | U-OP-07 | **Bab mapping** in bulk by filter, T4-T5 core subjects first (no auto-mapping, D89) | ADM | user, after dry-run counts | 01, S4-T03, S2-T08 | S4-T03 |
| 7 | U-OP-05 | **Regroup**: detect and quarantine stimulus-less and duplicated-stem questions (server rule, servability reason) | DEV tool, ADM works the list | user | 01, S1-T07, S2-T04 | S1-T07, S4-T04 |
| 8 | U-OP-06 | Clean-up of duplicated stem/prompt on migrated questions (FR-ADM-G7.6) | DEV tool, OPS runs | user | 05 | S4-T04 |
| 9 | U-OP-04 | **Kontrak Disahkan** in Kontrak (D95: created by an admin, not seeded), Mat Tambahan K2 3472/2 first | ADM | user | 01, 07, S3-T01 | S3-T01 |
| 10 | U-OP-08 | Seed the pool for blueprint papers: one real trial paper per launch paper via Import & Semakan | ADM | user | 02, S1-T03, S2-T02 | S3-T08 |
| 11 | U-OP-09 | **Terbit papers** in Set Builder under Disahkan contracts, verified as a T5 pupil | ADM | user | 04, 08 | S3-T08 |
| 12 | U-OP-10 | Tracking A: fill each set to target (`Isi set`, `Simpan`) | ADM | user | S3-T05 | S3-T05 |
| 12b | U-OP-15 | Tingkatan 1-3 chapters/topics created by the admin in Kurikulum when the migrated data has none (FR-ADM-C01.6), then bulk-map (U-OP-07) | ADM | user | E-03, S4-T07 | S4-T07 |
| 13 | U-OP-11 | Flags: `latih-tubi` ON, `permainan` ON, `kertas-subjektif` ON (D104); Delivery B modules ON as built | ADM | user | S0-T10 / S0-T11 | S0-T10 |
| 14 | U-OP-14 | Remove QA test data (questions 1272-1276, batches 1-2, papers 6-8) if present | ADM | user | none | n/a |
| Delivery B | U-OP-13 | Activate digital rewards, tier values, challenges, reward budgets | ADM | user | P2-02, 03, 07, 09 | S7-T05 |

Each step is rehearsed first on the UAT-like local dataset (S4-T08) and the rehearsal report is attached to the approval request. Rollback = restore from the backup; scripts are insert-only and idempotent where possible (as `dskp:load`). After each step the Delivery Lead re-runs the affected ACs on UAT in a visible browser (T5 pupil first).

---

## 8. Definition of Done and release checklist (PRD §X7)

**Per task:** DoD-T (§4). **Per sector:** every card Done; no file in the sector's paths contains a placeholder string; the sector's mock paths are gone from the http build (S0-T09 green); the sector's rows in the sidebar-walk spec are green; the sector lead has no open Blocker/Major review comment; docs of the sector updated.
**Per sprint:** "Sprint done" (§5A).
**Per phase / release checklist (Delivery Lead):**
1. **Placeholders:** `scripts/check-placeholders.mjs` green (AC-X2-3); a manual grep of the built bundle for `akan datang`, `belum tersedia`, `Pratonton`, `prototaip`; no `PrototypeUnavailablePage` on a matrix route; the only allow-list entry is the officers' PPD/JPN page (register row 18).
2. **Sidebar:** for each role (Murid, Guru, Admin Sekolah, Admin) every item opens a screen with the PRD title and no 403/404/"Akses Ditolak" or another role's screen (AC-X2-1), and every button/link in every matrix module completes against the real API with no mock data (AC-X2-2) — done in a visible browser, recorded in the ledger.
3. **Responsive:** every 1.0 screen at 375/768/1280 has no horizontal scroll and nothing clipped (AC-X6-1); a screenshot per width per screen in `.evidence/`; the question-paper screens including AC-X6-2 re-checked on a 375 px headed browser.
4. **Side by side:** each module compared with V2 (V1 for the school-admin rows without V2) at the same width; every difference fixed or a numbered fidelity deviation.
5. **UAT data:** all P0/P1 ACs run on UAT; §7 U-OP-01..U-OP-12 done; UAT "Tahap" = 5; Bab mapping coverage reported; counts agree across screens (XS-1..5, FR-X4-1/2).
6. **Pupil flows:** T1 and T5 can practise (AC-X3-1); no Darjah anywhere (FR-X3-1); a pupil sees only own data (FR-X4-4).
7. **Quality gates:** `typecheck`, `lint`, `lint:ds`, `npm test`, `be:verify`, `contract:check`, `test:e2e:http`, sidebar-walk, gitleaks, no-dumps all green on the release commit; ADR-0027..0036 not contradicted.
8. **Hidden by decision:** Cikgu Alesa and Keluarga Angkat unreachable by menu and URL (D102/FR-X2-2).
9. **User review:** the user watched the Phase demo and approved. Deploy only on explicit user confirmation (G6).

---

## 9. Risk register

| # | Risk (previous failure mode) | Prevention in this plan |
|---|---|---|
| R1 | **Heavy process again** (teams, boards, 237 merges, thousands of docs) | 11 sectors, one board, one table file, no merge log, no handoff docs; squash merge, PR ≤400 lines; §6.8 limits |
| R2 | **Never verified against V2 / real UAT data** | V-STD mandatory on every card; Delivery Lead re-verifies before Done; ACs ledger; exit criteria are passing ACs on UAT data |
| R3 | **"Done" without proof** (tests green, product wrong) | Only S9 moves to Done after a visible-browser run at 3 widths side by side with V2; evidence in `.evidence/` |
| R4 | **Headless-only checks miss layout bugs** | Visible browser required; scrollWidth check at 375/768/1280 on every card |
| R5 | **Mock data and prototype pages shipped as features** | AC-X2-3 CI check, S0-T09 mock audit, S0-T05 scope retirement, register 6.2b mapped to cards (rows 1–20 → S0-T05, S0-T06, S5-T05, S6-T01..T09, S7-T02, S10-T02, S1-T08) |
| R6 | **Merge conflicts on shared files** (menu, nav, schema, contract, seeds) | Single owner per shared file, delete-only regions, migration ranges, contract-first PRs, CODEOWNERS (§3) |
| R7 | **Questions still structurally wrong** (figure = question, groups split) | S1-T01 as first S1 card; FR-X1-4 tests in S1-T06; exit criteria Sprint 2/3; AC-X6-2 in a phone demo |
| R8 | **UAT data wrong, so correct code looks broken** (no Bab, 0 contracts/papers, 11 levels) | §7 runbook with fixed order; S4-T01 local rehearsal; operations only with user approval |
| R9 | **Estimates too optimistic; 1 developer cannot finish** | Stated openly (§5.3); re-base after Sprint 1; scope cut proposals go to the user, not silently |
| R10 | **Sector bottleneck: S0 owns shared files** | 24 h review SLA; delete-only markers; S0 cards front-loaded in Sprint 0–1; Delivery Lead can reassign reviews |
| R11 | **Cross-sector edits by agreement drift** (e.g. S4-T06 edits `BE/practice/rules.ts`) | Every such case is named on the card, with the owner as required reviewer |
| R12 | **PRD parts 10 and 30 not yet final** | Cards cite existing PRD IDs; the lead reconciles IDs when the parts are final (small PR to `r1-development-plan.md`, no re-planning) |
| R13 | **UI changes beyond the request** (user standing rule) | PRD copy is exact BM; any new copy needs approval (D94); menu changes only per PRD 30 §3 after approval |
| R14 | **Privacy**: real names in screenshots/seeds | `.evidence/` is gitignored; fictitious names in seeds; V2 captures are never committed (screens are described in words in the SRS) |
| R15 | **V2 IP block** from rapid access | 3 s between pages, one browser, only the Delivery Lead captures V2 |
| R16 | **339k questions have no Bab and the mapping is human work** (D89: no derived data) | Bulk-by-filter tool (S4-T03, S2-T08), start with T4-T5 core subjects, coverage reported per sprint; the user decides who does the data entry (open question 3) |
| R17 | **Delivery B starves Delivery A** | Delivery B cards stay stubs until Sprint 5; flags keep Delivery B modules hidden |

---

## 10. Open questions for the user

1. **Approve this plan, the sector split and the 2-week sprint.** Which people take which sectors (or should the Delivery Lead assign)?
2. ~~Admin menu approval~~ closed: D107 made the menu FINAL (follows the V2 sidebar).
3. **Who does the Bab mapping of ~339k questions** (PRD 30 OQ-03 recommends bulk by filter, no auto-mapping), and **who supplies figure images** for stimulus-less questions (images were not migrated, D80 Q-03)? Without images the regroup list (U-OP-05/06) can only hide the questions, not repair them.
4. **T1-T3 DSKP (decided, D109):** T1-T3 use the same DSKP structure as T4-T5, built from the existing chapter and topic data (and any T1-T3 PDF in `d:\prestasiplus-dskp`); the official PDFs are not required. S4-T09 is not blocked.
5. **UAT dump for local use** (S4-T01): approve an anonymised dump, or accept the synthetic profile.
6. **UAT operations** (§7): confirm the operator who can run scripts/restart on UAT and the approval phrase.
7. **Work location:** the code and PRD currently live in `D:\pp-cloud-review` (branch `feature/v3-bijak-r1`); the rule says everything stays in `D:\Dev Projects\prestasiplus`. The PRD and this plan must be copied there (or the branch merged into that checkout) before issues are created.
8. PRD open questions that change tasks (decisions needed before the named card starts): PRD 30 OQ-01, OQ-QE1 and OQ-QE2 are closed by D107/D108; still open: OQ-06 server flags (S0-T10), OQ-Q12 Kiriman Guru reuse of intake batches (S1-T08), OQ-07 Subjektif meaning (S3-T06). Others: OQ-AS-1 (AS dashboard scope), OQ-MUR-1 (**superseded by D101**, so S5-T01 opens T1–T3), OQ-MUR-7 (Jana Kertas), OQ-G-6 (Headcount key-in design, needed by S10-T02).

---

## Appendix A — GitHub issue template (`.github/ISSUE_TEMPLATE/task.yml`)

```yaml
name: R1 task card
description: One task of the Release 1 plan (docs/plan/r1-development-plan.md)
title: "S?-T??  <title>"
labels: ["status:backlog"]
body:
  - type: input
    id: card
    attributes: {label: Card ID, placeholder: "S3-T04"}
    validations: {required: true}
  - type: dropdown
    id: sector
    attributes:
      label: Sector
      options: [S0 Platform, S1 Question BE, S2 Admin question UI, S3 Bijak SPM, S4 Curriculum and UAT data, S5 Murid learning, S6 Guru and Admin Sekolah, S7 Gamification and games, S8 Rendering and responsive, S9 Verification, S10 Performance and analytics]
    validations: {required: true}
  - type: dropdown
    id: phase
    attributes: {label: Delivery (A = 1.0 + linked, B = rest), options: ["A", "B"]}
  - type: dropdown
    id: priority
    attributes: {label: Priority, options: [P0, P1, P2]}
  - type: dropdown
    id: ctype
    attributes: {label: "Type (Fix / Complete / Build / Verify / Ops)", options: [Fix, Complete, Build, Verify, Ops]}
  - type: dropdown
    id: size
    attributes: {label: Size (S=1 day, M=3, L=6), options: [S, M, L]}
  - type: textarea
    id: prd
    attributes: {label: "PRD refs (module / FR / AC)", placeholder: "R1-MUR-3; FR-MUR-3-1..; AC-MUR-3-*"}
    validations: {required: true}
  - type: textarea
    id: startsfrom
    attributes: {label: "Starts from (existing) files, repo-relative, in backticks; and the change budget of the Type (Keep/Verify/Ops: no product code; Fix/Complete: these files, new file only if named; Build: new files only at the named location)"}
    validations: {required: true}
  - type: textarea
    id: gapcheck
    attributes:
      label: "Gap check (REQUIRED before In progress): for every FR/AC of the card, works / broken / missing in the existing V3 code, with file:line evidence. If the code changed since the PRD gap, update this, not the PRD intent."
      placeholder: "| FR/AC | works / broken / missing | file:line | planned change |"
    validations: {required: true}
  - type: textarea
    id: gap
    attributes: {label: "Current gap and root cause (file:line)"}
  - type: textarea
    id: approach
    attributes: {label: "Approach (2-6 lines) and files to touch"}
  - type: textarea
    id: contract
    attributes: {label: "API / contract / migration (migration number from the sector range)"}
  - type: textarea
    id: tests
    attributes: {label: "Tests to add"}
  - type: textarea
    id: verify
    attributes:
      label: "Verification (V-STD: local stack -> visible browser 375/768/1280 side by side with V2 -> UAT data) plus card specifics"
  - type: input
    id: deps
    attributes: {label: Depends on, placeholder: "S1-T01, S8-T02"}
  - type: checkboxes
    id: dod
    attributes:
      label: Definition of Done
      options:
        - label: All ACs on this card pass with evidence (.evidence/<card>/)
        - label: typecheck, lint, tests (and be:verify for BE) green, real output in the PR
        - label: Tests added as listed
        - label: Screenshots 375/768/1280 from a visible browser, V2 comparison, UAT-data check in the PR
        - label: No placeholder string, no mock path in the http build
        - label: Sector lead and other-sector owners approved the PR
        - label: Gap check section posted before the first commit (works / broken / missing with file:line)
        - label: Only the gaps were closed in the existing files; no parallel page, service, store, route or table; every schema change has a DM ID and every endpoint an API ID
        - label: Card ACs and every AC-CHAIN-n through the card proven in a visible browser at 375/768/1280
        - label: Delivery Lead verified and moved to Done
```

## Appendix B — PR template (`.github/pull_request_template.md`)

```markdown
## Task
Closes #<issue>  ·  Card: S?-T??  (exactly one card ID; `scripts/r1-scope-guard.mjs` reads it)  ·  Sector: S?
Gap check (link to the issue section): 
PRD refs (module / FR / AC): 
DM / API IDs (required when this PR adds a page, route, controller, model or migration): 

## What changed (3 lines max)
Existing files changed (from "Starts from"): 
New files and the reason for each (only those the card names): 


## Other-sector paths touched (owner requested via CODEOWNERS)
- none | path -> sector

## Migration / contract
- Migration number (from my sector range): none | 0???_s?_<slug>
- Contract change: none | contract PR #<n> merged first; `npm run contract:check` output below

## Test evidence (real output)
```
typecheck / lint / test / be:verify tails
```

## Verification evidence (visible browser, not headless)
- Screenshots at 375 / 768 / 1280 (attach or list `.evidence/<card>/...`):
- `scrollWidth <= innerWidth` at each width: yes / no
- V2 comparison (same width): differences fixed / deviations numbered:
- UAT data checked on: UAT | UAT-like dataset | demo only (explain)
- AC IDs run and result (and every AC-CHAIN-n through this card):

## Checks
- [ ] No rewrite of working code; only the gaps of the Gap check changed (FR-X1-5)
- [ ] No parallel page, service, store, route or table for something that exists; no working page or module deleted or rewritten
- [ ] Every schema change has a DM ID and every endpoint an API ID (listed above)
- [ ] Change budget of the card Type respected (Keep/Verify/Ops: no product code under `src/`, `apps/`, `packages/`)
- [ ] Reviewer: a Fix or Complete PR that touches none of its "Starts from" files or adds a parallel implementation is rejected
- [ ] No placeholder strings (akan datang / belum tersedia / Pratonton / prototaip) and no new mock path
- [ ] No secrets, no real names, no personal data in code, seeds, fixtures, docs
- [ ] Claim is current (issue assigned to me, board row updated)
- [ ] Definition of Done on the issue is complete
```

## Appendix C — CODEOWNERS (`.github/CODEOWNERS`)

Replace `@OWNER-Sn` with the sector lead's GitHub handle (or a team). The last matching pattern wins; specific lines come after general ones.

```
# default: platform owner
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
