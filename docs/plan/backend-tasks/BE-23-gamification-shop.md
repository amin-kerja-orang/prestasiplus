# BE-23 Gamification economy and rewards shop (M14 rest, M15)

| Field | Value |
|---|---|
| Size | L |
| Lane | PC-2 (folders: sessions.md section 5) |
| Priority | P2 |
| Wave | 3 |
| Depends on | BE-11, BE-12 |
| Parallel with | BE-16, BE-18, BE-19 |
| Owner module | M14, M15 |

## Goal

Everything in M14/M15 beyond the wallet core: dashboard, daily challenges, achievements, token conversion, referral, share cards, leaderboard, tiers, lucky-draw control, teacher economy (wallet, shop, cash withdrawal requests, redemptions), admin gamification screens and the rewards shop (rewards, claims, digital shop).

## Inputs (read these)

- `docs/plan/AGENT-SYNC.md`, `docs/plan/sessions.md` section 5
- `docs/requirements/srs/M14-gamification.md`, `docs/requirements/srs/M15-rewards-shop.md` (and `urs/`), `docs/discovery/L43-kedai-hadiah-digital.md`
- Mock M14: `src/modules/m14-gamification/mock/handlers/{student,teacher,admin-economy,admin-ops,common,input,index}.ts`, repository `src/modules/m14-gamification/mock/repository/*`, tables `src/modules/m14-gamification/mock/tables/tables.ts` (tiers, challenges, challengeCompletions, achievements, userAchievements, learnerBadges, learnerBadgeHoldings, teacherBadges, teacherBadgeAwards, referralCodes, referrals, draws, drawTickets, rewardClaims, syilingRewards, teacherWallets, teacherLedger, teacherRewards, teacherRedemptions, cashWithdrawals, settings); client `src/modules/m14-gamification/api/*`; mock tests `src/modules/m14-gamification/__tests__/{mock,student-a,student-b}/**`
- Mock M15: `src/modules/m15-rewards-shop/mock/handlers/{user,admin,input}.ts`, repository `src/modules/m15-rewards-shop/mock/repository/*`; client `src/modules/m15-rewards-shop/api/*`; mock tests `src/modules/m15-rewards-shop/__tests__/mock/**`
- `docs/architecture/v2-data-migration.md` section 4.9 and Q10 (teacher wallets and contributor rewards are **out of v2 per D28c**: confirm before building teacher cash-out)
- BE-11 `WalletService`, `tiers`, `StreakService`; BE-25 parent links (parent approvals)

## Outputs

- Contract: `packages/contract/src/gamification/**` (M14 and M15 schemas; rewards schemas go in `gamification/rewards.ts`)
- `apps/api/prisma/schema/gamification.prisma` + migration with the tables of the list above except `tiers` (BE-11) and the M15 tables (`rewards`, `reward_claims`, `mystery_boxes`, digital shop items and redemptions, parent approvals; names fixed in the contract PR from the M15 repository)
- `apps/api/src/modules/gamification/**` (M14) and `apps/api/src/modules/shop/**` (M15), both PC-2 lane modules
- Seed `apps/api/prisma/seed/gamification.ts` (challenges, achievements, rewards from the mock seeds; one line in the registry; add `gamification` to the PC-2 seed list)
- Tests under `apps/api/test/gamification/**`, `apps/api/test/shop/**`

## Files touched

Everything a PC may write for this card. A path outside this list needs a `cross-lane` issue first (sessions.md section 5).

- Folders written: `apps/api/src/modules/gamification/**`, `apps/api/src/modules/shop/**`.
- Prisma file(s): `apps/api/prisma/schema/gamification.prisma` and one migration folder under `apps/api/prisma/migrations/`.
- Contract: `packages/contract/src/gamification/**` (new files only), registered in `src/openapi.ts`; `openapi.json` is regenerated with `npm run contract:emit`, never hand-edited.
- Seeds: `apps/api/prisma/seed/gamification.ts`, plus one line in `apps/api/prisma/seed/index.ts`.
- Tests: `apps/api/test/gamification/**`, `apps/api/test/shop/**`, and (after BE-31) new scenario files in `apps/api/test/conformance/gamification/`.
- Append-only shared files (one line each, never reorder): `apps/api/src/modules/index.ts` (one import and one array entry); `apps/api/prisma/migratable-models.json` (model names, alphabetical); your own rows of the mapping matrix, plan section 14.7; `docs/architecture/v2-backend-deviations.md` (a dated row only if you deviate); your own row in `docs/plan/backend-tracker.md`.
- No-clash note: gamification.prisma belongs to this card alone; it uses wallet.prisma tables only through WalletService (BE-11).
- **Exception needing the lead's approval in the PR (outside the lane list):** the PC-2 seed list in sessions.md section 5 does not name a `gamification` seed; the lead adds it when merging this card.

## Endpoints (all 58 M14 and M15 mock routes beyond BE-11, paths from the mock)

Every route below exists in the mock (verified). Counts: M14 student 8 (+2 in BE-11), teacher 6, admin 26, M15 18.

| Group | Endpoints |
|---|---|
| Student M14 | `GET /api/gamification/dashboard`, `GET /api/gamification/challenges`, `GET /api/gamification/achievements`, `GET /api/gamification/leaderboard`, `GET /api/gamification/referral`, `GET /api/gamification/share-cards`, `GET /api/gamification/convert`, `POST /api/gamification/convert` |
| Teacher M14 | `GET /api/guru/gamification`, `GET /api/guru/gamification/cash`, `GET /api/guru/gamification/leaderboard`, `GET /api/guru/gamification/shop`, `POST /api/guru/gamification/cash`, `POST /api/guru/gamification/shop/:rewardId/redeem` (cash-out only after Q10) |
| Admin M14 economy | `GET /api/admin/gamification/overview`, `GET /api/admin/gamification/students`, `GET /api/admin/gamification/transactions`, `GET /api/admin/gamification/tiers`, `GET /api/admin/gamification/challenges`; `POST /api/admin/gamification/award`, `POST /api/admin/gamification/challenges`, `PUT /api/admin/gamification/challenges/:id`, `DELETE /api/admin/gamification/challenges/:id`, `POST /api/admin/gamification/challenges/:id/toggle`, `POST /api/admin/gamification/tiers`, `PUT /api/admin/gamification/tiers/:id`, `POST /api/admin/gamification/tiers/:id/toggle` |
| Admin M14 operations | `GET /api/admin/gamification/guru`, `GET /api/admin/gamification/guru/cash`, `GET /api/admin/gamification/guru/redemptions`, `GET /api/admin/gamification/settings`; `PATCH /api/admin/gamification/guru/cash/:id`, `PATCH /api/admin/gamification/guru/redemptions/:id`, `POST /api/admin/gamification/guru/rewards`, `PUT /api/admin/gamification/guru/badges/:id`, `PUT /api/admin/gamification/settings`; `GET /api/admin/reward-control`, `POST /api/admin/reward-control/draws`, `PUT /api/admin/reward-control/rewards/:id/cost`, `PUT /api/admin/reward-control/settings` |
| M15 admin | `GET /api/admin/hadiah`, `GET /api/admin/hadiah/:id`, `GET /api/admin/hadiah/redemptions`, `POST /api/admin/hadiah`, `POST /api/admin/hadiah/bulk`, `PUT /api/admin/hadiah/:id`, `POST /api/admin/hadiah/redemptions/:id/cancel`, `POST /api/admin/hadiah/redemptions/:id/deliver` |
| M15 user | `GET /api/cabutan`, `POST /api/cabutan/:drawId/tickets`, `GET /api/gamification/mystery-boxes`, `POST /api/gamification/mystery-boxes/:id/open`, `GET /api/hadiah-digital/items`, `GET /api/hadiah-digital/redemptions`, `POST /api/hadiah/redemptions`, `GET /api/parent/hadiah-approvals`, `POST /api/parent/hadiah-approvals/:id/approve`, `POST /api/parent/hadiah-approvals/:id/reject` |

## DB tables touched

All gamification and rewards tables listed above, `wallets`/`coin_ledger` (via `WalletService` only).

## Acceptance criteria

1. Every credit or debit goes through `WalletService` inside the caller's transaction. Redeeming or buying with too little balance fails with the mock error: 409 `INSUFFICIENT_BALANCE` "Baki syiling tidak mencukupi." / "Baki token tidak mencukupi." (M14) or `INSUFFICIENT_TOKENS` "Token tidak mencukupi." (M15). Stock: "Stok habis." (`OUT_OF_STOCK`), per-user limit "Had tebusan dicapai." (`LIMIT_REACHED`), monthly cap "Had tebusan bulanan dicapai." (`MONTHLY_CAP`), draw "Cabutan ditutup." (`DRAW_CLOSED`) and "Had tiket dicapai." (`TICKET_LIMIT`). Stock decrement is race-safe: a concurrent-redeem test with N buyers for N-1 items yields exactly N-1 successes.
2. Daily challenge completion is idempotent per user per Malaysia day (a second completion adds nothing).
3. Conversion (`POST /api/gamification/convert`, mock `walletRepo.convert`): tokens = floor(syiling / tier conversionRate); the amount must be an integer, at least the rate and at most the current balance, otherwise 422 `VALIDATION_ERROR` with `fields.syilingAmount` "Jumlah syiling tidak sah."; the ledger row is type `convert`, source `token_conversion`, description "Tukar {s} syiling → {t} token". There is no daily cap in the mock, so none is built.
4. Roles: admin routes need `admin`; teacher routes need `teacher`; parent approvals need the parent link of BE-25; students cannot read other users' ledgers (admin routes only, 404 otherwise); missing CSRF 403 `CSRF_INVALID`.
5. Lucky-draw creation and ticket allocation are deterministic under the seeded PRNG in tests; each draw result writes an audit event.
6. Responses match the mock shapes for the seeded data: replay the cases of the mock tests in Inputs that do not depend on live totals.
7. Teacher cash-out (`POST /api/guru/gamification/cash`) returns 403 `CASH_DISABLED` "Tebus tunai tidak aktif buat masa ini." until Q10 is answered (flagged in the PR); the admin cash routes behave accordingly.
8. Tier maintenance by admin (create, update, toggle) keeps the BE-11 rule that a wallet's tier never goes down.

## Test commands

```
npm run be:db:seed
npm run be:test -- apps/api/test/gamification apps/api/test/rewards
npm run be:verify
npm run contract:check
npm run be:test -- apps/api/test/conformance   # only after BE-31 is merged
```

## Definition of Done

1. Plan section 10 (all ten items) is met.
2. `npm run contract:check && npm run be:verify` is green; if anything under `packages/**` changed, root `npm run typecheck && npm test` is green too. Paste the real tail of the output in the PR.
3. Conformance (BE-31): once BE-31 is merged, add this card's scenarios as new files in `apps/api/test/conformance/gamification/` and run `npm run be:test -- apps/api/test/conformance`; a failure is a blocker. Before BE-31 merges, `be:verify` is the gate; write "conformance scenarios pending BE-31" in the PR.
4. Migration-first checklist of plan section 14.9 (items 1 to 6) is complete for every table this card creates. Item 6 (insert a `legacy_source = 'cloud'` row twice through the BE-34 upsert helper and assert one row) applies once BE-34 is merged; state in the PR whether it was available.
5. No security review is required; list any security-relevant decision in the PR anyway.
6. The card's tracker row is updated (status, PR number, one-line note) and the PR description follows the template in `docs/plan/backend-tasks/README.md`. Nothing stays only on your PC (AGENT-SYNC.md section 4).

## Migration-first (plan sections 14 and 14.9)

- Follow the checklist of plan section 14.9 (items 1 to 6) for every table listed under "DB tables touched".
- Each table that could receive .cloud rows has `legacy_source text null`, `legacy_id text null` and `unique (legacy_source, legacy_id)`, and is listed in `apps/api/prisma/migratable-models.json`. These columns never appear in the contract or in an API response.
- Enums are `text` + `check` with English codes (no Postgres enum types); anything the source may lack is nullable or has a documented default; seeds never set `legacy_*` and are idempotent.
- Add or update this entity's row in the mapping matrix (plan section 14.7) in the same PR.

## Open questions

Do not guess these; write your working assumption in the PR and ask the lead (issue labelled `question`) if it blocks you.

1. Teacher cash-out and contributor rewards are out of v2 per D28c (Q10). Working assumption: keep the routes returning the mock's disabled state and build no teacher wallet logic beyond what the mock shows.
2. M15 table names are not fixed in the card; derive them from `src/modules/m15-rewards-shop/mock/repository/*` and record them in the mapping matrix.

## Prompt for Claude Code

```text
You are the backend developer for PrestasiPlus v2 working on task BE-23 (gamification-shop). Work in this repo clone on branch be/BE-23-gamification-shop, created from the latest origin/feature/v2-backend.
Read first, in order: docs/plan/AGENT-SYNC.md (how to claim, commit and push); AGENTS.md; docs/architecture/v2-backend-plan.md (sections 3, 6, 9, 10, 14; section 15 for intake and builder cards); docs/plan/sessions.md section 5 (folder ownership); docs/plan/backend-tasks/BE-23-gamification-shop.md (this card, all of it).
Rules: contract first (zod schemas in packages/contract/src/<domain>/, import z from ../zod, register in src/openapi.ts, run npm run contract:emit and commit openapi.json before the implementation). The frontend mock handlers, the typed client and the SRS listed in the card are the behavioural spec: do not invent business rules; write every unknown under "Open questions" in the PR description. Never commit secrets or real personal names. Do not edit src/**, e2e/**, docs/TRACKER.md or the contract common/session/auth/access folders (BE-14 and BE-32 have the explicit exceptions stated in their cards). Keep the diff inside the card Outputs and its "Files touched" list; commit after every green step and push at least hourly and before the session ends (AGENT-SYNC.md).
When finished run npm run be:verify (and the card test commands) and report: files changed, endpoints done, tables, real test output, deviations from the mock/contract, open questions.
Task: implement BE-23 in two PRs if it exceeds ~600 lines: (1) student + admin M14, (2) teacher economy + M15 shop. All money-like changes go through WalletService in a transaction. The route list is in the card (58 routes); put it into the contract before coding. Teacher cash-out remains disabled pending the user's answer to Q10.
```
