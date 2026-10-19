# BE-11 Wallet, ledger and streak core (M14 core)

| Field | Value |
|---|---|
| Size | M |
| Lane | PC-2 (folders: sessions.md section 5) |
| Priority | P0 |
| Wave | 1 |
| Depends on | BE-03 |
| Parallel with | BE-04, BE-05, BE-08, BE-14 |
| Owner module | M14 (wallet and streak are provisional in M05 per ADR-0014; this card makes M14 the real owner) |

## Goal

The owner service for coins (Syiling), tokens and the daily streak that practice, Bijak SPM, missions and the shop credit through: wallet, append-only ledger with `balance_after`, streak by Malaysia day, idempotent credits, and the student wallet read endpoints. Challenges, tiers, achievements, shop and teacher economy are BE-23.

## Inputs (read these)

- `docs/requirements/srs/M14-gamification.md` (wallet, ledger, streak, BR numbers), `docs/requirements/urs/M14-gamification.md`
- Mock: `src/modules/m14-gamification/mock/handlers/{student,common,input}.ts`, repository `.../mock/repository/*`, tables `.../mock/tables/tables.ts` (`gamification.streaks`, `tokenMovements`, `sessionCredits`, `dailyLoginMarks`); client `src/modules/m14-gamification/api/*`
- `docs/adr/0014-store-ownership-and-repositories.md` (`wallet.credit`, `wallet.summary`, `streak.get`, session write path steps 6 to 8)
- `docs/architecture/v2-data-migration.md` section 4.9 and section 5 ("Ledger integrity"), Q8 and Q10 (OD-8)

## Outputs

- Contract: `packages/contract/src/wallet/**`
- `apps/api/prisma/schema/wallet.prisma` + migration: `wallets`, `coin_ledger`, `streaks`, `session_credits`, `daily_login_marks`
- `apps/api/src/modules/wallet/**`: `WalletService.credit/debit/summary`, `StreakService.touch/get` (Malaysia day via `Clock`), idempotency by `(source, source_id)`
- Seed: `apps/api/prisma/seed/wallet.ts` (wallet rows for seeded students)
- Tests under `apps/api/test/wallet/**`

## Endpoints (subset of the M14 student routes)

| Method and path | Notes |
|---|---|
| `GET /api/gamification/wallet` | balances + streak summary |
| `GET /api/gamification/transactions` | paginated ledger of the signed-in user |
| `GET /api/me/gamification-summary` | small summary used by the app shell |

Remaining M14 routes (dashboard, challenges, convert, achievements, referral, leaderboard, share cards, admin, teacher) are BE-23.

## DB tables touched

`wallets`, `coin_ledger`, `streaks`, `session_credits`, `daily_login_marks`.

## Acceptance criteria

1. `credit` is atomic with the caller's transaction (service accepts a transaction handle) and idempotent for the same source key; a replay does not double-credit.
2. The ledger is append-only (no UPDATE/DELETE path); `balance_after` equals the running balance; a reconciliation query/test proves wallet balance = ledger sum for seeded data.
3. Streak: same Malaysia day twice does not increment; a missed day resets per the mock rule; day boundary tests at 23:59 and 00:00 `Asia/Kuala_Lumpur` using the fixed `Clock`.
4. Writes made under Mod Pelajar (`is_test`) are stamped and excluded from totals shown to others (flag stored; aggregation rule documented for BE-19).
5. Reads return the mock shape and scope: a user sees only their own wallet; an admin reading another user's wallet uses the admin routes in BE-23.
6. Negative balance is rejected with the mock's error code.

## Test commands

```
npm run be:test -- apps/api/test/wallet
npm run be:verify
```

## Migration-first (plan section 14)

- Every new table that could receive .cloud rows carries `legacy_source`, `legacy_id` and `unique (legacy_source, legacy_id)`, and is added to `apps/api/prisma/migratable-models.json`. Not in the contract.
- Enums are `text` + `check` (English codes); anything the source may lack is nullable or has a documented default.
- Add or update this entity's row in the mapping matrix (plan section 14.7) in the same PR; seeds must not set `legacy_*` and must be idempotent.

## Prompt for Claude Code

```text
You are the backend developer for PrestasiPlus v2 working on task BE-11 (wallet-streak-core). Work in this repo clone on branch be/BE-11-wallet-streak-core, created from the latest origin/feature/v2-backend.
Read first, in order: docs/plan/AGENT-SYNC.md (how to claim, commit and push); AGENTS.md; docs/architecture/v2-backend-plan.md (sections 3, 6, 9, 10, 14; section 15 for intake and builder cards); docs/plan/sessions.md section 5 (folder ownership); docs/plan/backend-tasks/BE-11-wallet-streak-core.md (this card, all of it).
Rules: contract first (zod schemas in packages/contract/src/<domain>/, import z from ../zod, register in src/openapi.ts, run npm run contract:emit and commit openapi.json before the implementation). The frontend mock handlers, the typed client and the SRS listed in the card are the behavioural spec: do not invent business rules; write every unknown under "Open questions" in the PR description. Never commit secrets or real personal names. Do not edit src/**, e2e/**, docs/TRACKER.md or the contract common/session/auth/access folders (BE-14 and BE-32 have the explicit exceptions stated in their cards). Keep the diff inside the card Outputs and its "Files touched" list; commit after every green step and push at least hourly and before the session ends (AGENT-SYNC.md).
When finished run npm run be:verify (and the card test commands) and report: files changed, endpoints done, tables, real test output, deviations from the mock/contract, open questions.
Task: implement BE-11. Build the wallet/ledger/streak owner service with transactional, idempotent credits and Malaysia-day streaks, plus the three read endpoints. Follow the M14 SRS business rules referenced in the mock; do not implement challenges, tiers, achievements, shop or teacher wallets (BE-23). Provide a clear service API other cards (BE-12, BE-16, BE-18) can call inside their own transactions.
```
