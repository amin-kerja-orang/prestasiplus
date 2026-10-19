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

- `docs/requirements/srs/M14-gamification.md`, `docs/requirements/srs/M15-rewards-shop.md` (and `urs/`), `docs/discovery/L43-kedai-hadiah-digital.md`
- Mock M14: `src/modules/m14-gamification/mock/handlers/{student,teacher,admin-economy,admin-ops,common,input,index}.ts`, tables `gamification.*` (tiers, challenges, challengeCompletions, achievements, userAchievements, learnerBadges, learnerBadgeHoldings, teacherBadges, teacherBadgeAwards, referralCodes, referrals, draws, drawTickets, rewardClaims, syilingRewards, teacherWallets, teacherLedger, teacherRewards, teacherRedemptions, cashWithdrawals, settings); client `src/modules/m14-gamification/api/*`
- Mock M15: `src/modules/m15-rewards-shop/mock/handlers/{user,admin,input}.ts`; client `src/modules/m15-rewards-shop/api/*`
- `docs/architecture/v2-data-migration.md` section 4.9 and Q10 (teacher wallets, contributor rewards are **out of v2 per D28c**: confirm before building teacher cash-out)
- BE-11 `WalletService`

## Outputs

- Contract: `packages/contract/src/gamification/**`, `packages/contract/src/rewards/**`
- `apps/api/prisma/schema/{gamification,rewards}.prisma` + migration with the tables of the list above
- `apps/api/src/modules/{gamification,rewards}/**`
- Seed: `apps/api/prisma/seed/gamification.ts` (tiers, challenges, achievements, rewards from the mock seeds)
- Tests under `apps/api/test/gamification/**`, `apps/api/test/rewards/**`

## Endpoints (paths from the mock)

| Group | Endpoints |
|---|---|
| Student M14 | `GET /api/gamification/{dashboard,challenges,achievements,leaderboard,referral,share-cards,convert}`, `POST /api/gamification/convert` |
| Teacher M14 | `GET /api/guru/gamification`, `GET /api/guru/gamification/{cash,leaderboard,shop}`, `POST /api/guru/gamification/cash` (build only after OD-8/Q10 is confirmed; otherwise return the mock's disabled state) |
| Admin M14 | `GET /api/admin/gamification/{overview,settings,tiers,challenges,students,transactions,guru,guru/cash,guru/redemptions}`, `POST /api/admin/gamification/{award,challenges,tiers,guru/rewards}`, `PUT /api/admin/gamification/settings`, `GET /api/admin/reward-control`, `PUT /api/admin/reward-control/settings`, `POST /api/admin/reward-control/draws` |
| M15 shop | the 18 routes in `m15-rewards-shop/mock/handlers/{user,admin}.ts` (list them from the file; `GET /api/rewards...`, claim/redeem, admin CRUD) |

## DB tables touched

All gamification and rewards tables listed above, `wallets`/`coin_ledger` (via `WalletService` only).

## Acceptance criteria

1. Every credit/debit goes through `WalletService` inside the caller's transaction; redeeming a reward debits atomically and fails with the mock's error when the balance is short; stock decrements are race-safe (concurrent redeem test).
2. Daily challenge completion is idempotent per user per Malaysia day; tier calculation is derived from the ledger, not stored by hand.
3. Conversion (Syiling to Token) enforces the mock's rate, minimum and daily cap; amounts are integers or `numeric` as in X4.
4. Admin routes require `admin`; teacher routes require `teacher`; students cannot read other users' ledgers (404).
5. Lucky-draw creation and ticket allocation are deterministic under the seeded PRNG in tests; draw results are audited.
6. Responses match the mock shapes for seeded data.
7. Teacher cash-out stays disabled with the mock's state until Q10 is answered (flagged in PR).

## Test commands

```
npm run be:db:seed
npm run be:test -- apps/api/test/gamification apps/api/test/rewards
npm run be:verify
```

## Migration-first (plan section 14)

- Every new table that could receive .cloud rows carries `legacy_source`, `legacy_id` and `unique (legacy_source, legacy_id)`, and is added to `apps/api/prisma/migratable-models.json`. Not in the contract.
- Enums are `text` + `check` (English codes); anything the source may lack is nullable or has a documented default.
- Add or update this entity's row in the mapping matrix (plan section 14.7) in the same PR; seeds must not set `legacy_*` and must be idempotent.

## Prompt for Claude Code

```text
You are the backend developer for PrestasiPlus v2 working on task BE-23 (gamification-shop). Work in this repo clone on branch be/BE-23-gamification-shop, created from the latest origin/feature/v2-backend.
Read first, in order: docs/plan/AGENT-SYNC.md (how to claim, commit and push); AGENTS.md; docs/architecture/v2-backend-plan.md (sections 3, 6, 9, 10, 14; section 15 for intake and builder cards); docs/plan/sessions.md section 5 (folder ownership); docs/plan/backend-tasks/BE-23-gamification-shop.md (this card, all of it).
Rules: contract first (zod schemas in packages/contract/src/<domain>/, import z from ../zod, register in src/openapi.ts, run npm run contract:emit and commit openapi.json before the implementation). The frontend mock handlers, the typed client and the SRS listed in the card are the behavioural spec: do not invent business rules; write every unknown under "Open questions" in the PR description. Never commit secrets or real personal names. Do not edit src/**, e2e/**, docs/TRACKER.md or the contract common/session/auth/access folders (BE-14 and BE-32 have the explicit exceptions stated in their cards). Keep the diff inside the card Outputs and its "Files touched" list; commit after every green step and push at least hourly and before the session ends (AGENT-SYNC.md).
When finished run npm run be:verify (and the card test commands) and report: files changed, endpoints done, tables, real test output, deviations from the mock/contract, open questions.
Task: implement BE-23 in two PRs if it exceeds ~600 lines: (1) student + admin M14, (2) teacher economy + M15 shop. All money-like changes go through WalletService in a transaction. List the 18 M15 routes from the mock files into the contract before coding. Teacher cash-out remains disabled pending the user's answer to Q10.
```
