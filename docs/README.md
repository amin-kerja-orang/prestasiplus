# docs/ index

Start with [TRACKER.md](TRACKER.md) (progress and decisions) and the repo-level [AGENTS.md](../AGENTS.md).

| Path | Purpose |
|---|---|
| `TRACKER.md` | Single source of truth: decisions (D1–D32), module board, next actions, change log |
| `SCOPE-STATUS.md` | Prototype scope: what is built, what is hidden/out of scope (BM) |
| `ROLES-MATRIX-LINES.md` | The 59 role-matrix rows (L01–L59) with progress |
| `AKAUN-DEMO.md` | Demo account notes (demo password only) |
| `requirements/` | URS/SRS masters, per-module `urs/` and `srs/`, role access matrix, v2 requirement docs |
| `architecture/` | System overview, build plan, v2 data migration |
| `adr/` | Architecture decision records 0001–0014 (stack, mock layer, determinism, datasets, store ownership, ...) |
| `design/` | Design system and shell specs (prototype-era today; v2 specs planned) |
| `discovery/` | Live-site discovery notes per module, element inventories (`inventory/`), crawl tools (`tools/`), screenshots |
| `qa/` | QA reports and acceptance results per module/row |

## v2 docs (new system, decisions D28–D32)

| Doc | Status |
|---|---|
| [requirements/v2-portals.md](requirements/v2-portals.md) | Written: two portals, one Portal Pentadbiran, role/menu model |
| [requirements/v2-cloud-gap.md](requirements/v2-cloud-gap.md) | Written: gap analysis of prestasiplus.cloud vs the prototype |
| [architecture/v2-data-migration.md](architecture/v2-data-migration.md) | Written (draft): .cloud database to v2 backend migration |
| [design/v2-design-system.md](design/v2-design-system.md) | Approved v2.0 (D33–D38): two personalities (staff calm B+, learner Elektrik), tokens, Phosphor icons, Fluent 3D, virtual friend, guard rules |
| [design/v2-learner-prototype.html](design/v2-learner-prototype.html) | Approved interactive learner prototype (Home, quiz, win, friend picker) |
| [design/v2-theme-preview.html](design/v2-theme-preview.html) | Staff look reference (variant B+) |
| [design/v2-visual-choices.html](design/v2-visual-choices.html) | Record of the visual choices (icon set, 3D, friend style) |
| [design/v2-shells.md](design/v2-shells.md) | Approved v2.0: shells for both portals at 375/768/1280 |
| [architecture/v2-frontend.md](architecture/v2-frontend.md) | Written: frontend architecture, ADR 0015–0018, task list V2-T01–T60 |
| [discovery/BIJAK-SPM-cloud.md](discovery/BIJAK-SPM-cloud.md) | Written: .cloud Bijak SPM / Simulasi discovery (student, admin, panel; flows, grading, data model, defects N-01..N-21, diff vs .my SPM Mock) |
| [requirements/v2-bijak-spm.md](requirements/v2-bijak-spm.md) | Draft G1: Bijak SPM v2 (Kertas Pilihan + Jana Kertas under Kontrak Blueprint), 33 stories, replicate-vs-redesign table, 4 blocking questions |

## v2 fullstack reference (build kit for every PC and session)

Read [plan/onboarding.md](plan/onboarding.md) first on a new PC, then the guide for your side.

| Doc | Use it for |
|---|---|
| [plan/onboarding.md](plan/onboarding.md) | Setup from zero: prerequisites, worktrees, env files (names only), Docker preview and compose, common errors |
| [requirements/v2-backend-urs.md](requirements/v2-backend-urs.md) | Backend requirements (BE-FR/NFR/MIG/OPS), testable, traced to cards BE-01..BE-40; open questions |
| [plan/backend-dev-guide.md](plan/backend-dev-guide.md) | Backend handbook: layout, module anatomy, contract-first steps, errors and BM copy, Prisma, tests, checklist per card |
| [plan/frontend-dev-guide.md](plan/frontend-dev-guide.md) | Frontend handbook: module anatomy, `src/ds` rules and ratchets, data access and mock handlers, responsive 375/768/1280, testids, commands |
| [architecture/v2-api-catalogue.md](architecture/v2-api-catalogue.md) | Every mock endpoint (491 routes + 4 contract-only + Bijak/intake operations): roles, request/response, errors with exact BM messages, card, contract status; uncovered list |
| [architecture/v2-data-model.md](architecture/v2-data-model.md) | Consolidated data model: ERD per domain, table list with store owner (D12), legacy columns, mapping-matrix gaps |
| [plan/fullstack-integration-guide.md](plan/fullstack-integration-guide.md) | Contract → mock → http/hybrid switch (V2-T31), cookies, CSRF, 401, requestId, compose e2e, per-domain switch checklist |
| [plan/half-am/amin2-after-go-live-backlog.md](plan/half-am/amin2-after-go-live-backlog.md) | Draft: every Amin2 item deferred to after the 30 Oct go-live, with source, owner, LEAD decision it waits on, and branch/PR |
| [qa/v2-test-strategy.md](qa/v2-test-strategy.md) | Test levels (unit, Testcontainers integration, conformance, e2e, migration), gate matrix G3–G6, test data, severity |
| [ops/platform-settings.md](ops/platform-settings.md) | Platform settings checklist per environment (Render, Supabase, Cloudflare Pages worker, production VPS): edge secret, client IP, throttles, cookies, seeds, metrics, AI |
| [ops/db-password-rotation.md](ops/db-password-rotation.md) | Database password rotation (demo and production), SESSION_SECRET rotation, IC_HASH_KEY warning, rotation log template |
| [ops/notice-28oct.md](ops/notice-28oct.md) | NOTICE-P10: the 28 Oct notice to schools and `.cloud` users (BM, short and full; same e-mail/username and password, and users may be asked to change their password (D34); Google-only accounts use "Lupa kata laluan?" then "Reset melalui No IC" (D20)) |

Reading order for newcomers: TRACKER decisions D28–D38, then `requirements/v2-portals.md`,
`requirements/v2-cloud-gap.md`, `architecture/overview.md`, `architecture/v2-data-migration.md`.
