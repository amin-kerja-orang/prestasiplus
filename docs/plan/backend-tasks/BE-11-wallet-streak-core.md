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

- `docs/plan/AGENT-SYNC.md`, `docs/plan/sessions.md` section 5
- `docs/requirements/srs/M14-gamification.md` (wallet, ledger, streak; BR-M14-08 to BR-M14-15, BR-M14-20), `docs/requirements/urs/M14-gamification.md`
- Mock: `src/modules/m14-gamification/mock/handlers/{student,common,input}.ts`, repository `src/modules/m14-gamification/mock/repository/{wallet,rules,errors,gamification,engine}.ts`, tables `src/modules/m14-gamification/mock/tables/tables.ts` (`gamification.streaks`, `tokenMovements`, `sessionCredits`, `dailyLoginMarks`); `src/mock/core-data/routes.ts` (`GET /api/me/gamification-summary`); client `src/modules/m14-gamification/api/*`; mock tests `src/modules/m14-gamification/__tests__/mock/**`
- `docs/adr/0014-store-ownership-and-repositories.md` (`wallet.credit`, `wallet.summary`, `streak.get`, session write path steps 6 to 8)
- `docs/architecture/v2-data-migration.md` section 4.9 and section 5 ("Ledger integrity"), Q8 and Q10 (OD-8)
- BE-03 outputs (guards, `Clock` from BE-02)
- Requirements: BE-FR-13; BE-NFR-17, BE-NFR-18, BE-NFR-19 ([URS 9.2](../../requirements/v2-backend-urs.md))
- API catalogue part B1 (core, identity, curriculum): [core-identity-curriculum.md](../../architecture/v2-api-catalogue/core-identity-curriculum.md) (endpoint list, wire conventions and open questions for this card's scope)
- API catalogue part B4 (economy, content, games): [economy-content-games.md](../../architecture/v2-api-catalogue/economy-content-games.md) (endpoint list, wire conventions and open questions for this card's scope)
- Data model: [v2-data-model.md](../../architecture/v2-data-model.md) (tables, keys and indexes of this card; being written 2026-10-19)

## Outputs

- Contract: `packages/contract/src/wallet/**`
- `apps/api/prisma/schema/wallet.prisma` + migration: `wallets`, `coin_ledger`, `streaks`, `session_credits`, `daily_login_marks`, `token_movements`, `tiers` (read model plus seed of the mock tiers: a wallet carries its tier, which the BE-19 leaderboard reads; admin tier CRUD stays in BE-23)
- `apps/api/src/modules/wallet/**`: `WalletService.credit/debit/summary`, `StreakService.touch/get` (Malaysia day via `Clock`), idempotency by `(source, source_id)`
- Seed: `apps/api/prisma/seed/wallet.ts` (wallet rows for seeded students)
- Tests under `apps/api/test/wallet/**`

## Files touched

Everything a PC may write for this card. A path outside this list needs a `cross-lane` issue first (sessions.md section 5).

- Folders written: `apps/api/src/modules/wallet/**`.
- Prisma file(s): `apps/api/prisma/schema/wallet.prisma` and one migration folder under `apps/api/prisma/migrations/`.
- Contract: `packages/contract/src/wallet/**` (new files only), registered in `src/openapi.ts`; `openapi.json` is regenerated with `npm run contract:emit`, never hand-edited.
- Seeds: `apps/api/prisma/seed/wallet.ts`, plus one line in `apps/api/prisma/seed/index.ts`.
- Tests: `apps/api/test/wallet/**`, and (after BE-31) new scenario files in `apps/api/test/conformance/wallet/`.
- Append-only shared files (one line each, never reorder): `apps/api/src/modules/index.ts` (one import and one array entry); `apps/api/prisma/migratable-models.json` (model names, alphabetical); your own rows of the mapping matrix, plan section 14.7; `docs/architecture/v2-backend-deviations.md` (a dated row only if you deviate); your own row in `docs/plan/backend-tracker.md`.
- No-clash note: wallet.prisma is shared with BE-23 (BE-23 depends on BE-11). It runs in parallel with BE-08 (curriculum.prisma).

## Endpoints (subset of the M14 student routes, paths from the mock)

Every route below exists in the mock (verified).

| Method and path | Notes |
|---|---|
| `GET /api/gamification/wallet` | balances + streak summary |
| `GET /api/gamification/transactions` | paginated ledger of the signed-in user |
| `GET /api/me/gamification-summary` | small summary used by the app shell |

The remaining 39 M14 mock routes (dashboard, challenges, achievements, convert, referral, leaderboard, share cards, admin, teacher) and the 18 M15 routes are BE-23.

## DB tables touched

`wallets`, `coin_ledger`, `streaks`, `session_credits`, `daily_login_marks`, `token_movements`, `tiers`.

## Acceptance criteria

1. `WalletService.credit` takes the caller's transaction handle, is atomic with the caller's work and idempotent per `(source, source_id)`: a replay returns the first result and writes no second ledger row (test with two calls in one transaction and two in separate ones).
2. The ledger is append-only: no repository method updates or deletes a `coin_ledger` row (test greps the repository surface; a DB trigger or `REVOKE` is an acceptable second guard); `balance_after` equals the running balance; a reconciliation test proves `wallets.balance` = sum of the user's ledger rows for seeded data and after 100 random credits/debits from a seeded PRNG.
3. Streak (SRS BR-M14-14, mock `stepStreak`): an activity on the same Malaysia day leaves the streak unchanged; on the next day `current + 1`; after a gap `current` resets to 1; `best` is the maximum; `totalDays` increases on each new streak day. Boundary tests with the fixed `Clock` at 23:59:59 and 00:00:00 `Asia/Kuala_Lumpur`.
4. Tier (SRS BR-M14-08, mock `upgradedTier`): after each syiling credit the wallet's tier becomes the highest active tier whose `minSyiling` is at most the current syiling, only if that tier is higher than the current one; it never goes down. Token movements are logged in `token_movements` without a `coin_ledger` row (BR-M14-22).
5. Writes made under Mod Pelajar (`is_test`) are stamped and excluded from totals shown to others (the flag is stored; the exclusion rule is written in the service comment and in the PR for BE-19).
6. Reads return the mock shape and scope: a user sees only own wallet and ledger; `GET /api/gamification/transactions` pagination `meta` is exact; every body parses with its contract schema; wallet and summary responses for the seeded students equal the mock's field names.
7. Debiting more than the balance is rejected with 409 `INSUFFICIENT_BALANCE`: message "Baki syiling tidak mencukupi." for syiling and "Baki token tidak mencukupi." for tokens (mock `M14Error`); nothing is written.
8. Roles: no session 401; a student cannot read another user's wallet (there is no id parameter; admin reads are BE-23).

## Test commands

```
npm run be:test -- apps/api/test/wallet
npm run be:verify
npm run contract:check
npm run be:test -- apps/api/test/conformance   # only after BE-31 is merged
```

## Definition of Done

1. Plan section 10 (all ten items) is met.
2. `npm run contract:check && npm run be:verify` is green; if anything under `packages/**` changed, root `npm run typecheck && npm test` is green too. Paste the real tail of the output in the PR.
3. Conformance (BE-31): once BE-31 is merged, add this card's scenarios as new files in `apps/api/test/conformance/wallet/` and run `npm run be:test -- apps/api/test/conformance`; a failure is a blocker. Before BE-31 merges, `be:verify` is the gate; write "conformance scenarios pending BE-31" in the PR.
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

1. The streak multiplier is fixed at 1 in the mock (BR-M14-15, only observed step); confirm there is no other step.
2. Stored balance versus derived: the working assumption is a `wallets` row kept in step with the ledger inside the same transaction, as the mock does.

## Prompt for Claude Code

```text
You are the backend developer for PrestasiPlus v2 working on task BE-11 (wallet-streak-core). Work in this repo clone on branch be/BE-11-wallet-streak-core, created from the latest origin/feature/v2-backend.
Read first, in order: docs/plan/AGENT-SYNC.md (how to claim, commit and push); AGENTS.md; docs/architecture/v2-backend-plan.md (sections 3, 6, 9, 10, 14; section 15 for intake and builder cards); docs/plan/sessions.md section 5 (folder ownership); docs/plan/backend-tasks/BE-11-wallet-streak-core.md (this card, all of it).
Rules: contract first (zod schemas in packages/contract/src/<domain>/, import z from ../zod, register in src/openapi.ts, run npm run contract:emit and commit openapi.json before the implementation). The frontend mock handlers, the typed client and the SRS listed in the card are the behavioural spec: do not invent business rules; write every unknown under "Open questions" in the PR description. Never commit secrets or real personal names. Do not edit src/**, e2e/**, docs/TRACKER.md or the contract common/session/auth/access folders (BE-14 and BE-32 have the explicit exceptions stated in their cards). Keep the diff inside the card Outputs and its "Files touched" list; commit after every green step and push at least hourly and before the session ends (AGENT-SYNC.md).
When finished run npm run be:verify (and the card test commands) and report: files changed, endpoints done, tables, real test output, deviations from the mock/contract, open questions.
Task: implement BE-11. Build the wallet/ledger/streak owner service with transactional, idempotent credits and Malaysia-day streaks, plus the three read endpoints. Follow the M14 SRS business rules referenced in the mock; do not implement challenges, tiers, achievements, shop or teacher wallets (BE-23). Provide a clear service API other cards (BE-12, BE-16, BE-18) can call inside their own transactions.
```
