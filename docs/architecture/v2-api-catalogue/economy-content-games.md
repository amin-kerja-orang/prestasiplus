# API catalogue part B4: economy, content, games

Status: draft for lead review, 2026-10-19. Part of `docs/architecture/v2-api-catalogue.md` (index assembled by the lead). Branch `docs/v2-reference`.

The frontend mock server is the behavioural spec for the real NestJS API (plan `docs/architecture/v2-backend-plan.md` sections 5 to 7). This part documents **every `route(...)` registered by seven mock modules**, exactly as the handlers behave today. It invents no business rule; where the mock and a card or the plan disagree, the disagreement is recorded as an open question (OQ-API-B4-n) instead of being resolved here.

## 1. Scope and counts

| Module | Feature | Mock handlers | Registered routes (this doc) | Plan figure (section 6.3) | BE card | v2 scope |
|---|---|---|---|---|---|---|
| M14 | Gamification (wallet, ledger, tiers, challenges, teacher economy, reward control) | `src/modules/m14-gamification/mock/handlers/{student,teacher,admin-economy,admin-ops}.ts` | **42** | 32 | BE-11 (3 routes), BE-23 (rest) | in B1 |
| M15 | Rewards shop (Hadiah, Kotak Misteri, Cabutan, parent consent) | `src/modules/m15-rewards-shop/mock/handlers/{user,admin}.ts` | **18** | 18 | BE-23 | in B1 |
| M16 | Battle, games, tournaments, leagues, Sekolah Bersaing | `src/modules/m16-battle-games/mock/handlers/{battle,standings,games,tournaments,leagues,admin-games}.ts` | **52** | 28 | BE-44/BE-45 | in B1 (D53(a)) |
| M09 | Content (articles, notes, banners, videos, perutusan, audio KBAT, screenshots, support config) | `src/modules/m09-content/mock/handlers/*.ts` | **43** | 25 | BE-24 | in B1 (Audio KBAT student play in BE-24, D53(a)) |
| M20 | Marketplace (buyer slice) | `src/modules/m20-marketplace/mock/handlers/buyer.ts` | **5** | 5 | BE-46 | in B1 (D53(a)) |
| M21 | Foster-family application | `src/modules/m21-sponsorship/mock/handlers/foster-application.ts` | **1** | 1 | BE-47 | student side in B1 (D53(a)); sponsor portal out |
| M22 | Support tickets | `src/modules/m22-support-tickets/mock/handlers/tickets.ts` | **4** | 4 | BE-24 | in B1 |
| | | | **165** | 113 | | |

How the counts were obtained (re-run to verify):

```
cd src/modules
grep -rn "route(" <module>/mock --include=*.ts | grep -v __tests__ | wc -l
#  m14=42  m15=18  m16=51  m09=43  m20=5  m21=1  m22=4
```

M16 shows 51 matches but **52 routes**: `handlers/battle.ts:15` is a factory `start(mode)` containing one `route()` call that is invoked twice (`quick-match` and `school-battle`). The SRS numbers (M16 #1 to #52, M09 #1 to #43, M14 #2 to #43 plus core #1, M15 #1 to #16 and #19 to #20 (its #17 wallet read is M14-01), M20 #13 to #17, M21 #15, M22 #1 to #4) agree with these counts. The plan figures 32 / 28 / 25 are stale and should be corrected in plan section 6.3 (OQ-API-B4-22). Routes not in this part: `GET /api/me/gamification-summary` (M14 SRS #1, registered in `src/mock/core-data/routes.ts`, card BE-11), M10 teacher article routes that call the M09 articles repository, M01 notification routes.

## 2. How to read an endpoint block

Each endpoint has one `###` block with the same bullets:

- **Roles:** short role list (also used by the summary table). `public` = no guard, a session is read if sent. `any session` = `requireAuth()`.
- **Auth detail:** guard as coded plus scope rules and the role-access-matrix link.
- **Purpose / Request / Response / Errors / Side effects:** as coded. "Response" names the envelope. `ListMeta` = `{page, pageSize, totalItems, totalPages, from, to}` (`@pp/contract` `ListMetaSchema`) plus module extras.
- **Owner / handler / client:** owning module, `file:line` of the `route()` call in the mock, and the frontend client function that calls it.
- **Card:** the BE card(s) that list the endpoint, or **UNCOVERED**. After the LEAD card audit (commit 63d363c) BE-11, BE-23 and BE-24 list every in-scope route explicitly; the earlier "(not itemised)" notes are gone.
- **Contract:** `exists` / `partial` / `missing`, checked against `packages/contract/src/openapi.ts`. Today the contract holds only the common schemas (`Id`, `Timestamp`, `DateOnly`, envelope, `ListMeta`, `ErrorBody`, enums), session/auth paths and the access matrix; **no path of this part is registered, so all 165 are `missing`**.

## 3. Cross-cutting conventions (from `src/mock/server` and `packages/contract/src/common`)

- **Base path** `/api`; the mock registers the exact strings below and the frontend clients use the same strings. Keep them (plan 6.1), including BM paths (`/api/tiket`, `/api/cabutan`, `/api/hadiah/...`, `/api/mohon-keluarga-angkat`, `/api/guru/...`, `/api/perutusan`, `/api/sekolah-bersaing`).
- **Success envelopes** (`src/mock/server/respond.ts`): `ok(data, extra?)` 200 `{data, ...extra}`; `created` 201; `noContent` 204 (not used by this part); `list(items, meta)` and `paginate/paged/unpaged` 200 `{data: [], meta}`; `raw(status, body)` sends the body untouched (live-shaped, used by M16 battle/games and `GET /api/tournament/active`). **Extra top-level keys exist**: M09 mutating routes return `{data, status: "<flash BM>"}`; M14 `GET /api/gamification/transactions`, `GET /api/gamification/challenges` and M22 lists return `{data, meta}` with a **module-specific `meta`** (not `ListMeta`). The real backend must reproduce each exactly (plan 6.1).
- **Pagination** (`paginate.ts`): `page` (invalid or missing = 1), page size fixed per endpoint unless stated (a client `pageSize` is honoured only where the route says so); `totalPages = max(1, ceil(total/pageSize))`; an out-of-range page is **not an error** (empty list, requested `page` echoed); `from`/`to` are 1-based or `null` when empty. `unpaged` lists answer `page 1`, `pageSize max(1,n)`, `totalPages 1`.
- **Errors** (`respond.ts`, `packages/contract/src/common/error.ts`): body `{error: {code, message, fields?, retryAfter?}}`. `401 UNAUTHORIZED` "Unauthenticated."; `403 FORBIDDEN` "This action is unauthorized."; `404 NOT_FOUND` "Not Found." (default, also an unmatched route or a non-numeric `int()` path segment); `409 CONFLICT` "Conflict."; `422 VALIDATION_ERROR` "The given data was invalid." (default). Module codes used here: `CASH_DISABLED` (403), `INSUFFICIENT_BALANCE`, `OUT_OF_STOCK`, `LIMIT_REACHED`, `DRAW_CLOSED`, `TICKET_LIMIT`, `MONTHLY_CAP`, `INSUFFICIENT_TOKENS` (all 409). `validationError(fields)` default top-level message = first field message plus " (and N more error(s))" when several (`summarizeFields`). **Exception:** the M16 live-shaped endpoints return `{error: "<string>"}`, `{message}` or `{}` bodies (see the M16 conventions); the real API must reproduce them for the unchanged client.
- **Auth** (`src/mock/auth/middleware.ts`): `requireAuth()` = 401 without a session; `requireRole(...roles)` = 401 then 403; `requireOwner` = 404 for non-owners (not used here). The mock reads a Bearer token; the real API uses the cookie session (plan 7, not part of this catalogue). Role codes: `student, teacher, parent, sponsor, school_admin, ppd_officer, jpn_officer, admin`. B1 serves `student, teacher, school_admin, admin` only (plan section 2).
- **Ids / time / money:** the mock uses integer ids for users, schools and most rows; the contract target is an opaque string `Id` (OQ-API-B4-1). Timestamps ISO 8601 with `+08:00`; day logic (daily limits, spin once a day, streaks, challenge day) in Asia/Kuala_Lumpur. Money in M15/M20 prices is a decimal string with 2 dp, RM; M14 cash values RM numbers, `...Sen` fields integer sen.
- **Wallet writes:** all syiling/token/xp movements go through the M14 wallet service in the caller's transaction (BE-11 `WalletService`; ADR-0014 one owner per store). M15 and M16 never write M14 tables directly.
- **Side effects on GET:** `GET /api/gamification/referral` creates the caller's referral code on first read; `GET /api/articles/:slug`, `/api/videos/:id`, `/api/perutusan/:id`, `/api/marketplace/products/:slug` increment view/read counters (OQ-API-B4-28).
- **Files:** multipart bodies appear on M14-32, M09-23, M09-37, M09-42 (images/audio/documents). The mock stores only names/sizes; the real API stores via BE-04.

## Summary table (all 165 endpoints)

Contract status counts: `exists` 0, `partial` 0, `missing` 165. Card column: BE card, or UNCOVERED.

| ID | Method | Path | Roles | Card | Contract |
|---|---|---|---|---|---|
| M14-01 | GET | `/api/gamification/wallet` | any session | BE-11 | missing |
| M14-02 | GET | `/api/gamification/dashboard` | any session | BE-23 | missing |
| M14-03 | GET | `/api/gamification/transactions` | any session | BE-11 | missing |
| M14-04 | GET | `/api/gamification/convert` | any session | BE-23 | missing |
| M14-05 | POST | `/api/gamification/convert` | any session | BE-23 | missing |
| M14-06 | GET | `/api/gamification/challenges` | any session | BE-23 | missing |
| M14-07 | GET | `/api/gamification/leaderboard` | any session | BE-23 | missing |
| M14-08 | GET | `/api/gamification/achievements` | any session | BE-23 | missing |
| M14-09 | GET | `/api/gamification/share-cards` | any session | BE-23 | missing |
| M14-10 | GET | `/api/gamification/referral` | any session | BE-23 | missing |
| M14-11 | GET | `/api/guru/gamification` | teacher, admin | UNCOVERED (Not in B1, D53) | missing |
| M14-12 | GET | `/api/guru/gamification/cash` | teacher, admin | UNCOVERED (Not in B1, D53) | missing |
| M14-13 | POST | `/api/guru/gamification/cash` | teacher, admin | UNCOVERED (Not in B1, D53) | missing |
| M14-14 | GET | `/api/guru/gamification/shop` | teacher, admin | UNCOVERED (Not in B1, D53) | missing |
| M14-15 | POST | `/api/guru/gamification/shop/:rewardId/redeem` | teacher, admin | UNCOVERED (Not in B1, D53) | missing |
| M14-16 | GET | `/api/guru/gamification/leaderboard` | teacher, admin | UNCOVERED (Not in B1, D53) | missing |
| M14-17 | GET | `/api/admin/gamification/overview` | admin | BE-23 | missing |
| M14-18 | GET | `/api/admin/gamification/tiers` | admin | BE-23 | missing |
| M14-19 | PUT | `/api/admin/gamification/tiers/:id` | admin | BE-23 | missing |
| M14-20 | POST | `/api/admin/gamification/tiers/:id/toggle` | admin | BE-23 | missing |
| M14-21 | POST | `/api/admin/gamification/tiers` | admin | BE-23 | missing |
| M14-22 | GET | `/api/admin/gamification/challenges` | admin | BE-23 | missing |
| M14-23 | PUT | `/api/admin/gamification/challenges/:id` | admin | BE-23 | missing |
| M14-24 | POST | `/api/admin/gamification/challenges/:id/toggle` | admin | BE-23 | missing |
| M14-25 | DELETE | `/api/admin/gamification/challenges/:id` | admin | BE-23 | missing |
| M14-26 | POST | `/api/admin/gamification/challenges` | admin | BE-23 | missing |
| M14-27 | GET | `/api/admin/gamification/students` | admin | BE-23 | missing |
| M14-28 | POST | `/api/admin/gamification/award` | admin | BE-23 | missing |
| M14-29 | GET | `/api/admin/gamification/transactions` | admin | BE-23 | missing |
| M14-30 | GET | `/api/admin/gamification/guru` | admin | UNCOVERED (Not in B1, D53) | missing |
| M14-31 | PUT | `/api/admin/gamification/guru/badges/:id` | admin | UNCOVERED (Not in B1, D53) | missing |
| M14-32 | POST | `/api/admin/gamification/guru/rewards` | admin | UNCOVERED (Not in B1, D53) | missing |
| M14-33 | GET | `/api/admin/gamification/guru/redemptions` | admin | UNCOVERED (Not in B1, D53) | missing |
| M14-34 | PATCH | `/api/admin/gamification/guru/redemptions/:id` | admin | UNCOVERED (Not in B1, D53) | missing |
| M14-35 | GET | `/api/admin/gamification/guru/cash` | admin | UNCOVERED (Not in B1, D53) | missing |
| M14-36 | PATCH | `/api/admin/gamification/guru/cash/:id` | admin | UNCOVERED (Not in B1, D53) | missing |
| M14-37 | GET | `/api/admin/gamification/settings` | admin | BE-23 | missing |
| M14-38 | PUT | `/api/admin/gamification/settings` | admin | BE-23 | missing |
| M14-39 | GET | `/api/admin/reward-control` | admin | BE-23 | missing |
| M14-40 | PUT | `/api/admin/reward-control/settings` | admin | BE-23 | missing |
| M14-41 | PUT | `/api/admin/reward-control/rewards/:id/cost` | admin | BE-23 | missing |
| M14-42 | POST | `/api/admin/reward-control/draws` | admin | BE-23 | missing |
| M15-01 | GET | `/api/hadiah-digital/items` | any session | BE-23 | missing |
| M15-02 | GET | `/api/hadiah-digital/redemptions` | any session | BE-23 | missing |
| M15-03 | POST | `/api/hadiah/redemptions` | any session | BE-23 | missing |
| M15-04 | GET | `/api/gamification/mystery-boxes` | any session | BE-23 | missing |
| M15-05 | POST | `/api/gamification/mystery-boxes/:id/open` | any session | BE-23 | missing |
| M15-06 | GET | `/api/cabutan` | any session | BE-23 | missing |
| M15-07 | POST | `/api/cabutan/:drawId/tickets` | any session | BE-23 | missing |
| M15-08 | GET | `/api/parent/hadiah-approvals` | any session (scoped to linked children; effectively parent) | UNCOVERED (not in B1, UD-3) | missing |
| M15-09 | POST | `/api/parent/hadiah-approvals/:id/approve` | parent | UNCOVERED (not in B1, UD-3) | missing |
| M15-10 | POST | `/api/parent/hadiah-approvals/:id/reject` | parent | UNCOVERED (not in B1, UD-3) | missing |
| M15-11 | GET | `/api/admin/hadiah` | admin | BE-23 | missing |
| M15-12 | POST | `/api/admin/hadiah/bulk` | admin | BE-23 | missing |
| M15-13 | GET | `/api/admin/hadiah/redemptions` | admin | BE-23 | missing |
| M15-14 | POST | `/api/admin/hadiah/redemptions/:id/deliver` | admin | BE-23 | missing |
| M15-15 | POST | `/api/admin/hadiah/redemptions/:id/cancel` | admin | BE-23 | missing |
| M15-16 | GET | `/api/admin/hadiah/:id` | admin | BE-23 | missing |
| M15-17 | POST | `/api/admin/hadiah` | admin | BE-23 | missing |
| M15-18 | PUT | `/api/admin/hadiah/:id` | admin | BE-23 | missing |
| M16-01 | GET | `/api/tournament/active` | any session | BE-44 | missing |
| M16-02 | POST | `/api/battle/quick-match` | any session | BE-44 | missing |
| M16-03 | POST | `/api/battle/school-battle` | any session | BE-44 | missing |
| M16-04 | GET | `/api/battle/poll-match/:queueId` | any session | BE-44 | missing |
| M16-05 | POST | `/api/battle/accept-challenger/:queueId` | any session | BE-44 | missing |
| M16-06 | POST | `/api/battle/reject-challenger/:queueId` | any session | BE-44 | missing |
| M16-07 | GET | `/api/battle/search-opponent` | any session | BE-44 | missing |
| M16-08 | POST | `/api/battle/invite` | any session | BE-44 | missing |
| M16-09 | GET | `/api/battle/invitations` | any session | BE-44 | missing |
| M16-10 | POST | `/api/battle/invite/:uuid/accept` | any session | BE-44 | missing |
| M16-11 | POST | `/api/battle/invite/:uuid/decline` | any session | BE-44 | missing |
| M16-12 | POST | `/api/battle/join-queue/:queueId` | any session | BE-44 | missing |
| M16-13 | GET | `/api/battle/poll-challenger/:queueId` | any session | BE-44 | missing |
| M16-14 | POST | `/api/battle/forfeit/:uuid` | any session | BE-44 | missing |
| M16-15 | GET | `/api/battle/lobby` | any session | BE-44 | missing |
| M16-16 | GET | `/api/battle/arena/:uuid` | any session | BE-44 | missing |
| M16-17 | POST | `/api/battle/arena/:uuid/answer` | any session | BE-44 | missing |
| M16-18 | GET | `/api/battle/standings/students` | any session | BE-44 | missing |
| M16-19 | GET | `/api/battle/standings/schools` | any session | BE-44 | missing |
| M16-20 | GET | `/api/battle/schools/:id` | any session | BE-44 | missing |
| M16-21 | GET | `/api/battle/history` | any session | BE-44 | missing |
| M16-22 | GET | `/api/games/hub` | any session | BE-45 | missing |
| M16-23 | GET | `/api/games/:game/lobby` | any session | BE-45 | missing |
| M16-24 | POST | `/api/games/:game/rooms` | any session | BE-45 | missing |
| M16-25 | POST | `/api/games/:game/rooms/join` | any session | BE-45 | missing |
| M16-26 | GET | `/api/games/:game/rooms/:code` | any session | BE-45 | missing |
| M16-27 | POST | `/api/games/:game/rooms/:code/start` | any session | BE-45 | missing |
| M16-28 | POST | `/api/games/:game/rooms/:code/action` | any session | BE-45 | missing |
| M16-29 | POST | `/api/papan-bijak/quick-match` | any session | BE-45 | missing |
| M16-30 | GET | `/api/papan-bijak/quick-match/poll` | any session | BE-45 | missing |
| M16-31 | POST | `/api/papan-bijak/quick-match/cancel` | any session | BE-45 | missing |
| M16-32 | GET | `/api/games/solo/:game` | any session | BE-45 | missing |
| M16-33 | POST | `/api/games/solo/:game/submit` | any session | BE-45 | missing |
| M16-34 | GET | `/api/games/roda-nasib` | any session | BE-45 | missing |
| M16-35 | POST | `/api/games/roda-nasib/spin` | any session | BE-45 | missing |
| M16-36 | GET | `/api/games/jutawan` | any session | BE-45 | missing |
| M16-37 | POST | `/api/games/jutawan/start` | any session | BE-45 | missing |
| M16-38 | POST | `/api/games/jutawan/:sessionId/answer` | any session | BE-45 | missing |
| M16-39 | POST | `/api/games/jutawan/:sessionId/lifeline` | any session | BE-45 | missing |
| M16-40 | GET | `/api/games/pertandingan` | any session | BE-45 | missing |
| M16-41 | GET | `/api/games/uji-minda` | any session | BE-45 | missing |
| M16-42 | GET | `/api/tournaments` | any session | BE-44 | missing |
| M16-43 | GET | `/api/tournaments/form-options` | admin | BE-44 | missing |
| M16-44 | POST | `/api/tournaments` | admin | BE-44 | missing |
| M16-45 | GET | `/api/tournaments/:uuid` | any session | BE-44 | missing |
| M16-46 | GET | `/api/leagues` | any session | BE-45 | missing |
| M16-47 | POST | `/api/leagues` | any session | BE-45 | missing |
| M16-48 | POST | `/api/leagues/join` | any session | BE-45 | missing |
| M16-49 | GET | `/api/leagues/:id` | any session | BE-45 | missing |
| M16-50 | GET | `/api/sekolah-bersaing` | any session | BE-45 | missing |
| M16-51 | GET | `/api/admin/games` | admin | BE-45 | missing |
| M16-52 | PUT | `/api/admin/games/settings` | admin | BE-45 | missing |
| M09-01 | GET | `/api/admin/articles` | admin | BE-24 | missing |
| M09-02 | GET | `/api/admin/articles/:id` | admin | BE-24 | missing |
| M09-03 | POST | `/api/admin/articles` | admin | BE-24 | missing |
| M09-04 | PUT | `/api/admin/articles/:id` | admin | BE-24 | missing |
| M09-05 | DELETE | `/api/admin/articles/:id` | admin | BE-24 | missing |
| M09-06 | GET | `/api/articles` | public | BE-24 | missing |
| M09-07 | GET | `/api/articles/hot` | public | BE-24 | missing |
| M09-08 | GET | `/api/articles/:slug` | public | BE-24 | missing |
| M09-09 | GET | `/api/articles/latest` | public | BE-24 | missing |
| M09-10 | GET | `/api/admin/notes` | admin | BE-24 | missing |
| M09-11 | GET | `/api/admin/notes/:id` | admin | BE-24 | missing |
| M09-12 | POST | `/api/admin/notes` | admin | BE-24 | missing |
| M09-13 | PUT | `/api/admin/notes/:id` | admin | BE-24 | missing |
| M09-14 | DELETE | `/api/admin/notes/:id` | admin | BE-24 | missing |
| M09-15 | GET | `/api/admin/banners` | admin | BE-24 | missing |
| M09-16 | GET | `/api/admin/banners/:id` | admin | BE-24 | missing |
| M09-17 | POST | `/api/admin/banners` | admin | BE-24 | missing |
| M09-18 | PUT | `/api/admin/banners/:id` | admin | BE-24 | missing |
| M09-19 | DELETE | `/api/admin/banners/:id` | admin | BE-24 | missing |
| M09-20 | GET | `/api/banners/active` | any session | BE-24 | missing |
| M09-21 | GET | `/api/admin/audio-kbat-sets` | admin | BE-24 | missing |
| M09-22 | GET | `/api/admin/audio-kbat-sets/template` | admin | BE-24 | missing |
| M09-23 | POST | `/api/admin/audio-kbat-sets` | admin | BE-24 | missing |
| M09-24 | GET | `/api/audio-kbat-sets` | any session | BE-24 | missing |
| M09-25 | GET | `/api/audio-kbat-sets/:id` | any session | BE-24 | missing |
| M09-26 | POST | `/api/audio-kbat-sets/:id/attempts` | any session | BE-24 | missing |
| M09-27 | GET | `/api/videos` | public | BE-24 | missing |
| M09-28 | GET | `/api/videos/:id` | public | BE-24 | missing |
| M09-29 | POST | `/api/videos` | any session | BE-24 | missing |
| M09-30 | PUT | `/api/videos/:id` | any session (uploader or admin) | BE-24 | missing |
| M09-31 | DELETE | `/api/videos/:id` | any session (uploader or admin) | BE-24 | missing |
| M09-32 | GET | `/api/videos/form-context` | any session | BE-24 | missing |
| M09-33 | GET | `/api/perutusan` | any session | BE-24 | missing |
| M09-34 | GET | `/api/perutusan/mine` | any session | BE-24 | missing |
| M09-35 | GET | `/api/perutusan/:id` | any session | BE-24 | missing |
| M09-36 | GET | `/api/perutusan/compose-context` | any session | BE-24 | missing |
| M09-37 | POST | `/api/perutusan` | admin, school_admin | BE-24 | missing |
| M09-38 | POST | `/api/perutusan/:id/reactions` | any session | BE-24 | missing |
| M09-39 | POST | `/api/perutusan/:id/comments` | any session | BE-24 | missing |
| M09-40 | GET | `/api/public/perutusan/:id` | public | BE-24 | missing |
| M09-41 | GET | `/api/admin/screenshots` | admin | BE-24 | missing |
| M09-42 | POST | `/api/admin/screenshots` | admin | BE-24 | missing |
| M09-43 | GET | `/api/config/support` | public | BE-24 | missing |
| M20-13 | GET | `/api/marketplace/categories` | any session | BE-46 | missing |
| M20-14 | GET | `/api/marketplace/products` | any session | BE-46 | missing |
| M20-15 | GET | `/api/marketplace/products/:slug` | any session | BE-46 | missing |
| M20-16 | POST | `/api/marketplace/products/:slug/whatsapp` | any session | BE-46 | missing |
| M20-17 | GET | `/api/marketplace/sellers/:id` | any session | BE-46 | missing |
| M21-15 | POST | `/api/mohon-keluarga-angkat` | any session | BE-47 | missing |
| M22-01 | GET | `/api/tiket` | any session | BE-24 | missing |
| M22-02 | POST | `/api/tiket` | any session | BE-24 | missing |
| M22-03 | GET | `/api/admin/tiket` | admin | BE-24 | missing |
| M22-04 | GET | `/api/admin/tiket/open-count` | admin | BE-24 | missing |

## M14 Gamification (`m14-gamification`) - 42 routes

Mock: `src/modules/m14-gamification/mock/handlers/{student,teacher,admin-economy,admin-ops}.ts`; wire types `src/modules/m14-gamification/api/types.ts` (`T:` line numbers below refer to that file); clients `api/{student,teacher,admin}.ts`. SRS `docs/requirements/srs/M14-gamification.md` (route numbers `#2` to `#43`; `#1 GET /api/me/gamification-summary` is a core route, out of this part). Shared stores: `gamification.*` tables (wallets, coin ledger, tiers, challenges, ...). Owner of wallet/ledger: M14 (BE-11 core, BE-23 rest). Count: the plan (section 6.3) says 32, the mock registers **42** (student 10, teacher 6, admin-economy 13, admin-ops 13); the plan figure is stale.

Module conventions (apply to every M14 block):

- Guards: `anySession` = `requireAuth()` (401 `UNAUTHORIZED` "Unauthenticated."), `teacherOnly` = `requireRole('teacher','admin')`, `adminOnly` = `requireRole('admin')`; wrong role = 403 `FORBIDDEN` "This action is unauthorized." (`handlers/common.ts:26-30`). Every figure on a student/teacher route is the **caller's own** (no id in the path; the user comes from the session). Parent, sponsor, school_admin, ppd, jpn get 403 on teacher/admin routes.
- Ids and amounts are JSON integers in the mock (`number`). The target contract uses string `Id` (plan 6.1); see OQ-API-B4-1. Datetimes are ISO `+08:00`; local dates `YYYY-MM-DD` (Asia/Kuala_Lumpur).
- Body validation (`handlers/input.ts:readFields`): all failing fields are reported (first problem per field) as `422 VALIDATION_ERROR`, top-level message `Sila lengkapkan semua medan wajib.`; `fields[name]` = `Medan ini diperlukan.` (missing/blank) or `Medan ini tidak sah.` (wrong type, out of range, bad enum/pattern). Integers accept JSON numbers or numeric strings; text is trimmed and measured in characters; booleans accept `true/false/1/0/"1"/"0"/"true"/"false"/"on"`.
- Refusal mapping (`handlers/common.ts:55`, `M14Error` thrown in the repository, whole request is rolled back): `VALIDATION_ERROR` -> 422 (`fields[<field>]` = the message when the route names a field, else no `fields`; `message` = the repository message); `NOT_FOUND` -> 404; `CASH_DISABLED` -> **403** with code `CASH_DISABLED`; any other code -> **409** with that code (`INSUFFICIENT_BALANCE`, `OUT_OF_STOCK`, `LIMIT_REACHED`, `DRAW_CLOSED`, `TICKET_LIMIT`).
- Path params `:id`/`:rewardId` use `int()` (digits only; a non-numeric segment does not match the route, so it answers 404 `NOT_FOUND` "Not Found.").
- Wallet side effects use the M14 ledger helpers (`repository/ops.ts`): `creditSyilingOp` (balance and lifetime up, tier re-assigned to the highest tier reached, ledger row `earn` unless stated) and `debitSyilingOp` (refuses below balance with 409 `INSUFFICIENT_BALANCE` "Baki syiling tidak mencukupi."; row amount negative). Ledger `balanceAfter` = syiling balance after the movement. Token movements write no ledger row (token-movement log only).
- Contract status for all M14 routes: **missing** (only the common envelope/error/Id/Timestamp schemas exist in `packages/contract/src/common`).
- Role-access matrix: Murid items 28 to 31, 33 to 36, 38 (Syiling & Token, Tukar Token, Cabaran Harian, Kedai Hadiah, Papan Pendahulu, Pencapaian, Kotak Misteri, Rujuk Kawan, Kedai Hadiah Digital) use the student routes. Guru gamification (S19 to S22) is **not** in the matrix (`v2-cloud-gap` F-94: Hidden-OOS). The admin routes belong to Portal Pentadbiran (D48, admin in prototype scope).

### M14-01 `GET /api/gamification/wallet`
- **Roles:** any session
- **Auth detail:** `anySession`; caller's own wallet. A user with no wallet row reads defaults (BR-M14-02).
- **Purpose:** wallet summary (syiling, token, xp, level, tier, title, earned today/week, streak). XR-M15-01.
- **Request:** no params.
- **Response:** 200 `{data: GamificationWallet}` (T:40): `userId`, `currentSyiling`, `totalSyilingEarned`, `tokenBalance`, `xp`, `level`, `xpNeeded`, `levelProgressPct` (numbers); `tier` {key,labelMs,icon,color,minSyiling,conversionRate}; `nextTier` ({...TierView, pct (1 dp), need} or null at top active tier); `title` {name,emoji}; `nextTitle` ({name,emoji,threshold,need} or null); `earnedToday`, `earnedThisWeek`; `streak` {current,best,multiplier}.
- **Errors:** 401 only.
- **Side effects:** none (read). The same body is embedded in M14-02.
- **Owner / handler / client:** M14, `handlers/student.ts:125`, `fetchGamificationWallet`.
- **Card:** BE-11 (listed as `GET /api/gamification/wallet`)
- **Contract:** missing

### M14-02 `GET /api/gamification/dashboard`
- **Roles:** any session
- **Auth detail:** `anySession`; caller's own data.
- **Purpose:** S11 hub: wallet, first 4 challenges, latest 6 ledger rows, subject mastery, tier grid.
- **Request:** no params.
- **Response:** 200 `{data: GamificationDashboard}` (T:109): `wallet` (as M14-01); `challenges` (first 4 of M14-06 items, T:72); `recent` (latest 6 `LedgerEntry`, T:61: id,type,amount,balanceAfter,source,description,createdAt); `mastery[]` (T:87: subjectId,subjectName,level,stage,correct,nextTarget|null,accuracy (2 dp),multiplier; only subjects with answered > 0, M03 subject order; read from M05 mastery, read-only); `tiers[]` (T:98: key,labelMs,icon,color,minSyiling,conversionRate,isMine; active tiers by sortOrder).
- **Errors:** 401 only.
- **Side effects:** none.
- **Owner / handler / client:** M14 (reads M05), `handlers/student.ts:128`, `fetchGamificationDashboard`.
- **Card:** BE-23 (group "Student M14": `dashboard`)
- **Contract:** missing

### M14-03 `GET /api/gamification/transactions`
- **Roles:** any session
- **Auth detail:** `anySession`; own ledger only.
- **Purpose:** S17 syiling ledger of the caller.
- **Request:** query `type` (optional; one of `earn|spend|convert|bonus|refund`; empty = all; any other value returns zero rows, FR-M14-08). Not paginated.
- **Response:** 200 **`{data: LedgerEntry[], meta: {currentSyiling, type}}`** (`meta` here is NOT the `ListMeta`; it has no `page/pageSize`). Rows newest first, all of them, no pager. `type` in meta echoes the query ('' when absent).
- **Errors:** 401 only.
- **Side effects:** none.
- **Owner / handler / client:** M14, `handlers/student.ts:158`, `fetchGamificationTransactions`.
- **Card:** BE-11 (`GET /api/gamification/transactions`, "paginated ledger"; NOTE the mock is unpaged with a non-standard meta, see OQ-API-B4-2)
- **Contract:** missing

### M14-04 `GET /api/gamification/convert`
- **Roles:** any session
- **Auth detail:** `anySession`.
- **Purpose:** S12 Tukar Token view (rate of the caller's tier).
- **Request:** none.
- **Response:** 200 `{data: ConvertView}` (T:128): `currentSyiling`, `tokenBalance`, `rate` (syiling per token of the caller's tier), `tierLabel`, `quick` = `[rate, 5*rate, currentSyiling]`, `tiers[]` (as dashboard tier grid with `isMine`).
- **Errors:** 401 only.
- **Side effects:** none.
- **Owner / handler / client:** M14, `handlers/student.ts:171`, `fetchConvertView`.
- **Card:** BE-23 (card lists `convert` under GET and POST)
- **Contract:** missing

### M14-05 `POST /api/gamification/convert`
- **Roles:** any session
- **Auth detail:** `anySession`; own wallet.
- **Purpose:** convert syiling to tokens at the tier rate (BR-M14-10/11).
- **Request:** body `{syilingAmount: integer}` (number or numeric string). Must satisfy `rate <= syilingAmount <= currentSyiling`.
- **Response:** 200 (not 201) `{data: ConvertResult}` (T:139): `syilingDebited`, `tokensCredited` (= floor(amount / rate)), `currentSyiling`, `tokenBalance`, `transactionId`.
- **Errors:** 422 `VALIDATION_ERROR` "Jumlah syiling tidak sah." with `fields.syilingAmount` = same text (non-integer body value, below rate, or above balance; `handlers/student.ts:176`, `repository/wallet.ts:267`). 401.
- **Side effects:** one atomic step: debit syiling with a ledger row `type=convert`, `source=token_conversion`, `amount=-syilingAmount`, `tokens=<tokens>`, description `Tukar {s} syiling → {t} token`; token balance += tokens (no token ledger row). No tier change on debit.
- **Owner / handler / client:** M14, `handlers/student.ts:176`, `convertSyiling`.
- **Card:** BE-23 (AC 3: mock rate, minimum, daily cap -- the mock has **no daily cap**, see OQ-API-B4-3)
- **Contract:** missing

### M14-06 `GET /api/gamification/challenges`
- **Roles:** any session
- **Auth detail:** `anySession`; progress is the caller's, computed from M05 practice data for the current Malaysia day.
- **Purpose:** S13 daily challenges with progress.
- **Request:** none.
- **Response:** 200 **`{data: ChallengeProgress[], meta: {completed, active}}`** (T:72,148). Item: id,icon,title,description,difficulty,rewardSyiling,rewardXp,target,progress,pct (rounded int),completed. Only active challenges, by (`sortOrder`,`id`). `progress` = `target` when already completed today.
- **Errors:** 401 only.
- **Side effects:** none from the call (challenge completion and its reward are written by the session-completed hook in BE-12/BE-23, idempotent per user, challenge and Malaysia day, unique (userId, challengeId, date); not an HTTP route).
- **Owner / handler / client:** M14 (reads M05), `handlers/student.ts:185`, `fetchGamificationChallenges`.
- **Card:** BE-23
- **Contract:** missing

### M14-07 `GET /api/gamification/leaderboard`
- **Roles:** any session
- **Auth detail:** `anySession`; global (all students), not scoped.
- **Purpose:** S14 Papan Pendahulu: top 50 wallets by lifetime syiling.
- **Request:** none (`period` and any other query are ignored, FR-M14-08/42).
- **Response:** 200 `{data: Leaderboard}` (T:175): `podium[]` ranks 1 to 3 (T:154: rank,userId,name,initials,totalSyilingEarned,tier {key,labelMs,icon}); `rows[]` ranks 4 to 50 (T:164: rank,userId,name,initials,title,level,totalSyilingEarned,tierIcon). `name` is the user's display name (real data in prod; privacy decision for other students' names is OQ-API-B4-4).
- **Errors:** 401 only.
- **Side effects:** none.
- **Owner / handler / client:** M14, `handlers/student.ts:191`, `fetchGamificationLeaderboard`.
- **Card:** BE-23
- **Contract:** missing

### M14-08 `GET /api/gamification/achievements`
- **Roles:** any session
- **Auth detail:** `anySession`; own unlock state.
- **Purpose:** S15 Pencapaian catalogue with unlock state.
- **Request:** query `rarity` (optional `common|rare|epic|legendary`; an unknown value answers `items: []`).
- **Response:** 200 `{data: Achievements}` (T:196): `unlocked`, `total`, `streak` {current,best,multiplier}, `items[]` (T:181: id,icon,name,description,rarity,rarityLabel,rarityColor,rewardSyiling,rewardXp,progress {value,target}|null (only the 5 "kuiz" badges),unlocked,unlockedAt|null).
- **Errors:** 401 only.
- **Side effects:** none from the call (unlock evaluation is part of the session-completed engine, `repository/engine.ts`; criteria list `AchievementCriterion`, `repository/types.ts:110`).
- **Owner / handler / client:** M14, `handlers/student.ts:221`, `fetchGamificationAchievements`.
- **Card:** BE-23
- **Contract:** missing

### M14-09 `GET /api/gamification/share-cards`
- **Roles:** any session
- **Auth detail:** `anySession`; own profile.
- **Purpose:** S18 share cards.
- **Request:** none.
- **Response:** 200 `{data: ShareCards}` (T:204): `name`, `initial`, `profileUrl` (`https://prestasiplus.my/pelajar/{userId}`, DV-M14-02; host is a mock constant, OQ-API-B4-5), `profile` {answered,accuracy (1 dp),sessions,tierKey,tierIcon,level,currentSyiling}, `kombo` {current,best,multiplier}, `mastery[]` {subjectName,level,stage,accuracy (1 dp),correct}, `ranking` {accuracy,correct,answered}. Source: M05 all-time answers/sessions.
- **Errors:** 401 only.
- **Side effects:** none.
- **Owner / handler / client:** M14 (reads M05), `handlers/student.ts:226`, `fetchShareCards`.
- **Card:** BE-23 (card lists `share-cards`)
- **Contract:** missing

### M14-10 `GET /api/gamification/referral`
- **Roles:** any session
- **Auth detail:** `anySession`; own code.
- **Purpose:** S16 Rujuk Kawan: referral code, share links, stats.
- **Request:** none.
- **Response:** 200 `{data: Referral}` (T:230): `code`, `rewardReferrer`, `rewardReferee` (syiling constants), `registerUrl` (`https://prestasiplus.my/register?ref={code}`), `whatsappUrl` (`https://wa.me/?text=` + text where only spaces are `%20`-encoded), `telegramUrl` (`https://t.me/share/url?url={registerUrl}&text=...`), `stats` {referrals,rewarded,syilingEarned}. WhatsApp text: `Jom belajar matematik di PRESTASIPLUS! Guna kod {code} untuk dapat {rewardReferee} syiling PERCUMA! {registerUrl}`.
- **Errors:** 401 only.
- **Side effects:** **creates the caller's referral code on first read** (BR-M14-18; a write on a GET). Referral reward credit happens at registration (M01 flow), not here.
- **Owner / handler / client:** M14, `handlers/student.ts:259`, `fetchReferral`.
- **Card:** BE-23
- **Contract:** missing

### M14-11 `GET /api/guru/gamification`
> **Not in B1 (D53 OWN-10, owner decision 2026-10-19): the teacher economy is backlog; the backend does not register this route. Kept as the record of the mock behaviour.**
- **Roles:** teacher, admin
- **Auth detail:** `teacherOnly`; own teacher wallet (BR-M14-01). Out of v2 per D28c until Q10 is confirmed (BE-23 AC 7).
- **Purpose:** S19 Gamifikasi Guru dashboard.
- **Request:** none.
- **Response:** 200 `{data: TeacherDashboard}` (T:268): `balance`, `totalEarned`, `questionsCount`, `coinsPerQuestion`, `badges[]` (T:242 + `earned`), `badgesEarned`, `badgesActive`, `nextBadge` ({...badge, need}|null), `catalogue[]` (active `TeacherReward`, T:252), `transactions[]` {id,description,amount,createdAt} newest first.
- **Errors:** 401, 403.
- **Side effects:** none.
- **Owner / handler / client:** M14, `handlers/teacher.ts:38`, `fetchTeacherDashboard`.
- **Card:** UNCOVERED (Not in B1, D53)
- **Contract:** missing

### M14-12 `GET /api/guru/gamification/cash`
> **Not in B1 (D53 OWN-10, owner decision 2026-10-19): the teacher economy is backlog; the backend does not register this route. Kept as the record of the mock behaviour.**
- **Roles:** teacher, admin
- **Auth detail:** `teacherOnly`; own data.
- **Purpose:** S20 Tebus Tunai view.
- **Request:** none.
- **Response:** 200 `{data: TeacherCashView}` (T:284): `balance`, `available` (balance minus coins held by non-final requests/redemptions), `held`, `cashValue` (RM), `minWithdrawal`, `maxWithdrawal` (= available), `rateCoins`, `rateSen`, `enabled` (setting `cash_withdrawal_enabled` = 1), `banks[]` (25 options, first is the placeholder `-- Pilih Bank --`), `history[]` {id,coins,cash (RM),bankName,status,createdAt}, newest first. Bank account numbers are never returned here.
- **Errors:** 401, 403.
- **Side effects:** none.
- **Owner / handler / client:** M14, `handlers/teacher.ts:68`, `fetchTeacherCash`.
- **Card:** UNCOVERED (Not in B1, D53)
- **Contract:** missing

### M14-13 `POST /api/guru/gamification/cash`
> **Not in B1 (D53 OWN-10, owner decision 2026-10-19): the teacher economy is backlog; the backend does not register this route. Kept as the record of the mock behaviour.**
- **Roles:** teacher, admin
- **Auth detail:** `teacherOnly`; own wallet.
- **Purpose:** request a cash withdrawal (BR-M14-26).
- **Request:** body `{coinsAmount: int >= 1, bankName: enum (the 24 real bank names of CASH_BANKS minus placeholder), bankAccount: text <= 40, accountHolder: text <= 120}` all required (`handlers/teacher.ts:85`). Repository additionally requires `min_cash_withdrawal <= coinsAmount <= available` and non-blank bank fields.
- **Response:** **201** `{data: TeacherCashCreated}` (T:315): `id`, `coins`, `cash` (RM), `bankName`, `bankAccountMasked`, `status: 'PENDING'`, `createdAt`.
- **Errors:** 403 `CASH_DISABLED` "Tebus tunai tidak aktif buat masa ini." (setting off); 422 `VALIDATION_ERROR` "Sila lengkapkan semua medan wajib." with `fields.coinsAmount` (range/blank, `repository/teacher.ts:392`) or per-field `Medan ini diperlukan.`/`Medan ini tidak sah.`; 401, 403.
- **Side effects:** inserts a `PENDING` cash request storing the full bank account and holder (returned masked everywhere); **no ledger debit yet** (the debit happens when an admin sets `PAID`, M14-36). Coins are held against `available`.
- **Owner / handler / client:** M14, `handlers/teacher.ts:84`, `requestTeacherCash`.
- **Card:** UNCOVERED (Not in B1, D53)
- **Contract:** missing

### M14-14 `GET /api/guru/gamification/shop`
> **Not in B1 (D53 OWN-10, owner decision 2026-10-19): the teacher economy is backlog; the backend does not register this route. Kept as the record of the mock behaviour.**
- **Roles:** teacher, admin
- **Auth detail:** `teacherOnly`; own balance.
- **Purpose:** S21 teacher reward shop.
- **Request:** none.
- **Response:** 200 `{data: TeacherShop}` (T:326): `balance`, `available`, `rewards[]` (active `TeacherReward`, T:252: id,name,category,costCoins,stock|null,maxPerUser|null,maxPerMonth|null,description,imageUrl|null,isActive,createdAt).
- **Errors:** 401, 403.
- **Side effects:** none.
- **Owner / handler / client:** M14, `handlers/teacher.ts:105`, `fetchTeacherShop`.
- **Card:** UNCOVERED (Not in B1, D53)
- **Contract:** missing

### M14-15 `POST /api/guru/gamification/shop/:rewardId/redeem`
> **Not in B1 (D53 OWN-10, owner decision 2026-10-19): the teacher economy is backlog; the backend does not register this route. Kept as the record of the mock behaviour.**
- **Roles:** teacher, admin
- **Auth detail:** `teacherOnly`; PROPOSED behaviour (BR-M14-27).
- **Purpose:** request a teacher reward; holds the cost, no debit until delivered.
- **Request:** path `rewardId` int. No body.
- **Response:** **201** `{data: TeacherRedemption}` (T:333): `id`,`userId`,`rewardId`,`costCoins`,`status` (`PENDING`),`createdAt`,`updatedAt`,`userName`,`rewardName`. (Mock row also carries `debited:false`; the typed view omits it, so do not rely on it.)
- **Errors:** 404 `NOT_FOUND` "Ganjaran tidak dijumpai." (missing or inactive); 409 `OUT_OF_STOCK` "Stok habis."; 409 `LIMIT_REACHED` "Had tebusan dicapai." (per-user total or per-month cap, cancelled rows excluded); 409 `INSUFFICIENT_BALANCE` "Baki syiling tidak mencukupi." (available < cost). 401, 403.
- **Side effects:** inserts a `PENDING` redemption with `debited=false`. No balance or stock change until M14-34 sets `DELIVERED`.
- **Owner / handler / client:** M14, `handlers/teacher.ts:115`, `redeemTeacherReward`.
- **Card:** UNCOVERED (Not in B1, D53)
- **Contract:** missing

### M14-16 `GET /api/guru/gamification/leaderboard`
> **Not in B1 (D53 OWN-10, owner decision 2026-10-19): the teacher economy is backlog; the backend does not register this route. Kept as the record of the mock behaviour.**
- **Roles:** teacher, admin
- **Auth detail:** `teacherOnly`; the `sekolah` tab lists teachers of the caller's school when the caller is a teacher (an admin caller sees all teachers); `global` lists all teachers. Ranked by questions then userId.
- **Purpose:** S22 teacher leaderboard.
- **Request:** query `tab` (`sekolah` default, `global`; unknown = `sekolah`).
- **Response:** 200 `{data: TeacherLeaderboard}` (T:348): `tab`, `rows[]` {rank,userId,name,questions,syiling} plus `schoolName` on the `global` tab only.
- **Errors:** 401, 403.
- **Side effects:** none.
- **Owner / handler / client:** M14, `handlers/teacher.ts:128`, `fetchTeacherLeaderboard`.
- **Card:** UNCOVERED (Not in B1, D53)
- **Contract:** missing

### M14-17 `GET /api/admin/gamification/overview`
- **Roles:** admin
- **Auth detail:** `adminOnly`; national (no school scope in the mock).
- **Purpose:** S1 admin overview.
- **Request:** none.
- **Response:** 200 `{data: AdminOverview}` (T:363): `cards` {activeStudents,syilingGenerated,tokensConverted,conversions,activeChallenges,completedToday}; `tierDistribution[]` {key,count,pct (rounded int),widthPct (2 dp),color} by tier key ascending; `top10[]` {rank,name,tierKey,level,totalSyilingEarned}; `recent[]` (10) {name,type,amount,source,createdAt}. All computed from the wallet and ledger datasets.
- **Errors:** 401, 403.
- **Side effects:** none.
- **Owner / handler / client:** M14, `handlers/admin-economy.ts:134`, `fetchAdminOverview`.
- **Card:** BE-23
- **Contract:** missing

### M14-18 `GET /api/admin/gamification/tiers`
- **Roles:** admin
- **Auth detail:** `adminOnly`.
- **Purpose:** S2 tiers list (including inactive).
- **Request:** none.
- **Response:** 200 `{data: Tier[]}` (T:385): id,tierName,labelMs,icon,color,minSyiling,conversionRate,sortOrder,perks (string[]),quizRewardL1..L5,pkskRewardCorrect,boardGameRewardCorrect,boardGameRewardWin,isActive.
- **Errors:** 401, 403.
- **Side effects:** none.
- **Owner / handler / client:** M14, `handlers/admin-economy.ts:174`, `fetchAdminTiers`.
- **Card:** BE-23
- **Contract:** missing

### M14-19 `PUT /api/admin/gamification/tiers/:id`
- **Roles:** admin
- **Auth detail:** `adminOnly`.
- **Purpose:** update a tier (V-M14-02).
- **Request:** path `id` int. Body `TierUpdate` (T:407): `labelMs` text <= 60, `icon` text <= 16, `color` optional text matching `^#[0-9a-fA-F]{6}$`, `minSyiling` int >= 0, `conversionRate` int >= 1, `sortOrder` int >= 0, `quizRewardL1..L5`, `pkskRewardCorrect`, `boardGameRewardCorrect`, `boardGameRewardWin` each int >= 0; `perks` optional: string[], JSON-array text, or one text; absent keeps the stored list. `tierName` cannot change.
- **Response:** 200 `{data: Tier}`.
- **Errors:** 422 `VALIDATION_ERROR` "Sila lengkapkan semua medan wajib." + per-field copy (see module conventions); 404 `NOT_FOUND` "Tier tidak dijumpai." 401, 403.
- **Side effects:** none on wallets (tier assignment re-evaluates at the next credit, BR-M14-08).
- **Owner / handler / client:** M14, `handlers/admin-economy.ts:177`, `updateAdminTier`.
- **Card:** BE-23
- **Contract:** missing

### M14-20 `POST /api/admin/gamification/tiers/:id/toggle`
- **Roles:** admin
- **Auth detail:** `adminOnly`.
- **Purpose:** activate/deactivate a tier; holders keep it (BR-M14-08).
- **Request:** path `id` int; no body.
- **Response:** 200 `{data: {isActive: boolean}}`.
- **Errors:** 404 `NOT_FOUND` "Tier tidak dijumpai."; 401, 403.
- **Side effects:** flips `isActive`.
- **Owner / handler / client:** M14, `handlers/admin-economy.ts:198`, `toggleAdminTier`.
- **Card:** BE-23
- **Contract:** missing

### M14-21 `POST /api/admin/gamification/tiers`
- **Roles:** admin
- **Auth detail:** `adminOnly`.
- **Purpose:** create a tier (V-M14-03).
- **Request:** body = `TierCreate` (T:427): all `TierUpdate` fields plus `tierName` text <= 40 matching `^[A-Za-z0-9_-]+$` (stored lower-case, unique). `color` default `#3b82f6`; `perks` default `[]`.
- **Response:** **201** `{data: Tier}` (new tier `isActive: true`).
- **Errors:** 422 `VALIDATION_ERROR` "Nama tier sudah wujud." with `fields.tierName` (duplicate); other 422 as conventions; 401, 403.
- **Side effects:** none on wallets.
- **Owner / handler / client:** M14, `handlers/admin-economy.ts:207`, `createAdminTier`.
- **Card:** BE-23
- **Contract:** missing

### M14-22 `GET /api/admin/gamification/challenges`
- **Roles:** admin
- **Auth detail:** `adminOnly`.
- **Purpose:** S3 all challenges (active or not).
- **Request:** none.
- **Response:** 200 `{data: DailyChallenge[]}` (T:432): id,title,description,icon,challengeType,targetValue,rewardSyiling,rewardXp,difficulty,sortOrder,isActive (internal `metric` hidden, BR-M14-12), ordered by (`sortOrder`,`id`).
- **Errors:** 401, 403.
- **Side effects:** none.
- **Owner / handler / client:** M14, `handlers/admin-economy.ts:226`, `fetchAdminChallenges`.
- **Card:** BE-23
- **Contract:** missing

### M14-23 `PUT /api/admin/gamification/challenges/:id`
- **Roles:** admin
- **Auth detail:** `adminOnly`.
- **Purpose:** update a challenge (V-M14-04).
- **Request:** path `id`; body `DailyChallengeInput` (T:447), every field required: `title` text <= 120, `description` text <= 255, `icon` text <= 16, `challengeType` enum `quiz_count|accuracy|topic_variety|streak|time_spent`, `targetValue` int >= 1, `rewardSyiling` int >= 0, `rewardXp` int >= 0, `difficulty` enum `easy|medium|hard`, `sortOrder` int >= 0.
- **Response:** 200 `{data: DailyChallenge}`.
- **Errors:** 422 (conventions); 404 `NOT_FOUND` "Cabaran tidak dijumpai."; 401, 403.
- **Side effects:** internal metric is kept unless `challengeType` changes (then reset to the type default metric, `DEFAULT_METRIC_BY_TYPE` in `repository/gamification.ts`).
- **Owner / handler / client:** M14, `handlers/admin-economy.ts:231`, `updateAdminChallenge`.
- **Card:** BE-23
- **Contract:** missing

### M14-24 `POST /api/admin/gamification/challenges/:id/toggle`
- **Roles:** admin
- **Auth detail:** `adminOnly`.
- **Purpose:** activate/deactivate a challenge.
- **Request:** path `id`; no body.
- **Response:** 200 `{data: {isActive: boolean}}`.
- **Errors:** 404 "Cabaran tidak dijumpai."; 401, 403.
- **Side effects:** flips `isActive`.
- **Owner / handler / client:** M14, `handlers/admin-economy.ts:245`, `toggleAdminChallenge`.
- **Card:** BE-23
- **Contract:** missing

### M14-25 `DELETE /api/admin/gamification/challenges/:id`
- **Roles:** admin
- **Auth detail:** `adminOnly`.
- **Purpose:** delete a challenge.
- **Request:** path `id`.
- **Response:** 200 (not 204) `{data: {deleted: 1}}`.
- **Errors:** 404 "Cabaran tidak dijumpai."; 401, 403.
- **Side effects:** removes the challenge row (completions are not touched by the mock; FK/cascade rule is OQ-API-B4-6).
- **Owner / handler / client:** M14, `handlers/admin-economy.ts:254`, `deleteAdminChallenge`.
- **Card:** BE-23
- **Contract:** missing

### M14-26 `POST /api/admin/gamification/challenges`
- **Roles:** admin
- **Auth detail:** `adminOnly`.
- **Purpose:** create a challenge.
- **Request:** body `DailyChallengeInput` (as M14-23).
- **Response:** **201** `{data: DailyChallenge}` (`isActive: true`, metric = type default).
- **Errors:** 422 (conventions); 401, 403.
- **Side effects:** none.
- **Owner / handler / client:** M14, `handlers/admin-economy.ts:263`, `createAdminChallenge`.
- **Card:** BE-23
- **Contract:** missing

### M14-27 `GET /api/admin/gamification/students`
- **Roles:** admin
- **Auth detail:** `adminOnly`; all students (national).
- **Purpose:** S4 student wallets list.
- **Request:** query `search` (name or e-mail contains, M01 users), `tier` (tier key), `sort` (`total_syiling_earned|current_syiling|token_balance|level`; others ignored), `page` (invalid = 1). Page size fixed **20** (`pageParams` without `maxPageSize`, so `pageSize` in the query is ignored).
- **Response:** 200 `{data: AdminStudentRow[], meta: ListMeta}` (T:470): userId,name,email,tierKey,tierColor,level,currentSyiling,tokenBalance,totalSyilingEarned,xp. Out-of-range page answers an empty list with the requested `page`.
- **Errors:** 401, 403.
- **Side effects:** none.
- **Owner / handler / client:** M14, `handlers/admin-economy.ts:271`, `fetchAdminStudents`.
- **Card:** BE-23
- **Contract:** missing

### M14-28 `POST /api/admin/gamification/award`
- **Roles:** admin
- **Auth detail:** `adminOnly`.
- **Purpose:** admin awards syiling to a student (BR-M14-20).
- **Request:** body `{userId: int >= 1, amount: int 1..AWARD_MAX (10,000), reason: text <= 255}` all required.
- **Response:** 200 (not 201) `{data: {userId, currentSyiling, transactionId}}` (T:492).
- **Errors:** 404 `NOT_FOUND` "Pengguna tidak dijumpai." (unknown user); 422 (conventions, e.g. amount out of range = `fields.amount` "Medan ini tidak sah."); 401, 403.
- **Side effects:** creates the wallet if missing; syiling and lifetime up; tier re-assigned; ledger row `type=bonus`, `source=admin_award`, `description=<reason>`. Atomic. No audit-event row in the mock (BE-23 should consider one, OQ-API-B4-7).
- **Owner / handler / client:** M14, `handlers/admin-economy.ts:305`, `awardSyiling`.
- **Card:** BE-23
- **Contract:** missing

### M14-29 `GET /api/admin/gamification/transactions`
- **Roles:** admin
- **Auth detail:** `adminOnly`.
- **Purpose:** S5 all ledger rows.
- **Request:** query `type` (ledger type; unknown = empty result), `dateFrom`, `dateTo` (`YYYY-MM-DD`, inclusive; malformed ignored), `page`. Page size fixed **25**, newest first.
- **Response:** 200 `{data: AdminTransactionRow[], meta: ListMeta}` (T:508): LedgerEntry fields + `userId`, `name`.
- **Errors:** 401, 403.
- **Side effects:** none.
- **Owner / handler / client:** M14, `handlers/admin-economy.ts:317`, `fetchAdminTransactions`.
- **Card:** BE-23
- **Contract:** missing

### M14-30 `GET /api/admin/gamification/guru`
> **Not in B1 (D53 OWN-10, owner decision 2026-10-19): the teacher economy is backlog; the backend does not register this route. Kept as the record of the mock behaviour.**
- **Roles:** admin
- **Auth detail:** `adminOnly`.
- **Purpose:** S6 teacher gamification admin overview.
- **Request:** none.
- **Response:** 200 `{data: AdminTeacherGamification}` (T:514): `cards` {rewards,activeRewards,badges,pendingRedemptions}, `pendingCash`, `badges[]` (TeacherBadge), `rewards[]` (TeacherReward, all, including inactive).
- **Errors:** 401, 403.
- **Side effects:** none.
- **Owner / handler / client:** M14, `handlers/admin-ops.ts:118`, `fetchAdminTeacherGamification`.
- **Card:** UNCOVERED (Not in B1, D53)
- **Contract:** missing

### M14-31 `PUT /api/admin/gamification/guru/badges/:id`
> **Not in B1 (D53 OWN-10, owner decision 2026-10-19): the teacher economy is backlog; the backend does not register this route. Kept as the record of the mock behaviour.**
- **Roles:** admin
- **Auth detail:** `adminOnly`.
- **Purpose:** edit a teacher badge (V-M14-07).
- **Request:** path `id`; body `{name: text <= 80, icon?: text <= 60, threshold: int >= 1, bonusCoins: int >= 0, isActive?: bool}`.
- **Response:** 200 `{data: TeacherBadge}` (T:242).
- **Errors:** 404 "Lencana tidak dijumpai."; 422 (conventions; repository also "Sila lengkapkan semua medan wajib." on blank name/threshold < 1/bonus < 0); 401, 403.
- **Side effects:** none.
- **Owner / handler / client:** M14, `handlers/admin-ops.ts:133`, `updateTeacherBadge`.
- **Card:** UNCOVERED (Not in B1, D53)
- **Contract:** missing

### M14-32 `POST /api/admin/gamification/guru/rewards`
> **Not in B1 (D53 OWN-10, owner decision 2026-10-19): the teacher economy is backlog; the backend does not register this route. Kept as the record of the mock behaviour.**
- **Roles:** admin
- **Auth detail:** `adminOnly`.
- **Purpose:** create a teacher reward. **Multipart** (image upload); in the mock the image is kept as a reference only (D22).
- **Request:** multipart/JSON fields: `name` text <= 120, `category` enum `general|digital|physical|voucher`, `costCoins` int >= 1, optional `stock` (>= 0), `maxPerUser` (>= 1), `maxPerMonth` (>= 1), `description` <= 1000, `isActive` (default true), `image` file (png/jpeg/webp, <= 5 MiB).
- **Response:** **201** `{data: TeacherReward}` (`imageUrl` is `blob:mock/...` in the mock; the backend returns a file-storage URL via BE-04).
- **Errors:** 422 `VALIDATION_ERROR` summary "Sila lengkapkan semua medan wajib." with `fields.image` = "Gambar mesti berjenis imej." (wrong type or > 5 MiB); other 422 as conventions; 401, 403.
- **Side effects:** inserts reward; image stored through BE-04 in the real backend.
- **Owner / handler / client:** M14, `handlers/admin-ops.ts:158`, `createTeacherReward`.
- **Card:** UNCOVERED (Not in B1, D53)
- **Contract:** missing

### M14-33 `GET /api/admin/gamification/guru/redemptions`
> **Not in B1 (D53 OWN-10, owner decision 2026-10-19): the teacher economy is backlog; the backend does not register this route. Kept as the record of the mock behaviour.**
- **Roles:** admin
- **Auth detail:** `adminOnly`.
- **Purpose:** S7 teacher reward redemptions.
- **Request:** query `status` (`PENDING` default, `PROCESSING|DELIVERED|CANCELLED|all`; unknown = empty list). Not paginated.
- **Response:** 200 `{data: TeacherRedemption[]}` (T:333) newest first: id,userId,rewardId,costCoins,status,createdAt,updatedAt,userName,rewardName.
- **Errors:** 401, 403.
- **Side effects:** none.
- **Owner / handler / client:** M14, `handlers/admin-ops.ts:196`, `fetchTeacherRedemptions`.
- **Card:** UNCOVERED (Not in B1, D53)
- **Contract:** missing

### M14-34 `PATCH /api/admin/gamification/guru/redemptions/:id`
> **Not in B1 (D53 OWN-10, owner decision 2026-10-19): the teacher economy is backlog; the backend does not register this route. Kept as the record of the mock behaviour.**
- **Roles:** admin
- **Auth detail:** `adminOnly`; PROPOSED (BR-M14-27).
- **Purpose:** move a teacher redemption forward.
- **Request:** path `id`; body `{status: PENDING|PROCESSING|DELIVERED|CANCELLED}`. Allowed transitions only `PENDING -> PROCESSING -> DELIVERED` and `PENDING|PROCESSING -> CANCELLED`.
- **Response:** 200 `{data: TeacherRedemption}`.
- **Errors:** 404 "Tebusan tidak dijumpai."; 422 `VALIDATION_ERROR` "Status tebusan tidak boleh ditukar." (illegal transition); 409 `OUT_OF_STOCK` "Stok habis." and 409 `INSUFFICIENT_BALANCE` "Baki syiling tidak mencukupi." on DELIVERED; 401, 403.
- **Side effects:** entering `DELIVERED` (once, `debited` flag): teacher ledger debit `-costCoins` with description `Tebusan: {reward name}` and reward `stock - 1` (if stock is limited). `CANCELLED` writes nothing.
- **Owner / handler / client:** M14, `handlers/admin-ops.ts:206`, `updateTeacherRedemption`.
- **Card:** UNCOVERED (Not in B1, D53)
- **Contract:** missing

### M14-35 `GET /api/admin/gamification/guru/cash`
> **Not in B1 (D53 OWN-10, owner decision 2026-10-19): the teacher economy is backlog; the backend does not register this route. Kept as the record of the mock behaviour.**
- **Roles:** admin
- **Auth detail:** `adminOnly`.
- **Purpose:** S8 cash requests.
- **Request:** query `status` (`PENDING` default, `APPROVED|PROCESSING|PAID|REJECTED|all`). The handler does not validate the value (an unknown value yields no rows). Not paginated.
- **Response:** 200 `{data: AdminCashList}` (T:564): `cards` {pending,approved,paid,paidTotal (RM)}, `rows[]` (T:549): id,userId,name,coins,cash (RM),bankName,bankAccountMasked,accountHolderMasked,status,adminNote|null,createdAt. Account and holder are masked (SEC-M14-04).
- **Errors:** 401, 403.
- **Side effects:** none.
- **Owner / handler / client:** M14, `handlers/admin-ops.ts:227`, `fetchTeacherCashRequests`.
- **Card:** UNCOVERED (Not in B1, D53)
- **Contract:** missing

### M14-36 `PATCH /api/admin/gamification/guru/cash/:id`
> **Not in B1 (D53 OWN-10, owner decision 2026-10-19): the teacher economy is backlog; the backend does not register this route. Kept as the record of the mock behaviour.**
- **Roles:** admin
- **Auth detail:** `adminOnly`.
- **Purpose:** set the status of a cash request (BR-M14-26).
- **Request:** path `id`; body `{status: PENDING|APPROVED|PROCESSING|PAID|REJECTED, adminNote?: text <= 500}`. Absent `adminNote` keeps the note; a blank string clears it (stored null). Any status can move to any status.
- **Response:** 200 `{data: AdminCashRow}`.
- **Errors:** 404 `NOT_FOUND` "Permohonan tidak dijumpai."; 422 (conventions); 401, 403.
- **Side effects:** entering `PAID` debits the teacher wallet once (`paidDebited`), ledger description `Tebus Tunai #{id}`; leaving `PAID` credits it back with `Tebus Tunai #{id} dibatalkan`.
- **Owner / handler / client:** M14, `handlers/admin-ops.ts:234`, `updateTeacherCashRequest`.
- **Card:** UNCOVERED (Not in B1, D53)
- **Contract:** missing

### M14-37 `GET /api/admin/gamification/settings`
- **Roles:** admin
- **Auth detail:** `adminOnly`.
- **Purpose:** S9 the 10 gamification settings.
- **Request:** none.
- **Response:** 200 `{data: GamificationSetting[]}` (T:576) in S9 order: `key` (`coins_per_question|cash_rate_coins|cash_rate_sen|min_cash_withdrawal|cash_withdrawal_enabled|reward_budget_sen_session|reward_budget_sen_month|current_session_year|flat_quiz_reward|games_award_syiling`), `label`, `value` (int), `kind` (`number|toggle`; `toggle` = `cash_withdrawal_enabled`, value 0/1).
- **Errors:** 401, 403.
- **Side effects:** none.
- **Owner / handler / client:** M14, `handlers/admin-ops.ts:256`, `fetchGamificationSettings`.
- **Card:** BE-23
- **Contract:** missing

### M14-38 `PUT /api/admin/gamification/settings`
- **Roles:** admin
- **Auth detail:** `adminOnly`.
- **Purpose:** save settings (only posted keys change).
- **Request:** body `{settings: [{key: string, value: int}]}`, non-empty array. Value must be an integer >= 0 (toggle 0 or 1); key must exist.
- **Response:** 200 `{data: GamificationSetting[]}` (all 10 rows).
- **Errors:** 422 `VALIDATION_ERROR` "Sila lengkapkan semua medan wajib." with `fields.settings` = "Medan ini diperlukan." (missing/empty array), `fields["settings.{i}.key"]` "Medan ini diperlukan.", `fields["settings.{i}.value"]` "Medan ini tidak sah."; repository 422 `fields.settings` "Sila lengkapkan semua medan wajib." (unknown key, negative, toggle > 1); 401, 403.
- **Side effects:** updates settings; `cash_withdrawal_enabled` governs M14-13 `CASH_DISABLED`. No audit row in the mock.
- **Owner / handler / client:** M14, `handlers/admin-ops.ts:259`, `saveGamificationSettings`.
- **Card:** BE-23
- **Contract:** missing

### M14-39 `GET /api/admin/reward-control`
- **Roles:** admin
- **Auth detail:** `adminOnly`; national.
- **Purpose:** S10 Kawalan Reward.
- **Request:** none.
- **Response:** 200 `{data: RewardControl}` (T:629): `tiles` {sessionYear,liabilityRm,students,claims} (claims in `current_session_year`, sum of `costValueSen`/100); `settings` {rewardBudgetSenSession,rewardBudgetSenMonth,flatQuizReward,currentSessionYear,gamesAwardSyiling}; `rewards[]` (SyilingReward T:598: id,name,type,priceSyiling,costValueSen,costRm); `draws[]` (Draw T:615: id,title,description,ticketCostSyiling,maxTicketsPerStudent,prizePool [{label,valueSen,qty}],closesAt|null,status,createdAt,ticketsSold), newest first.
- **Errors:** 401, 403.
- **Side effects:** none.
- **Owner / handler / client:** M14, `handlers/admin-ops.ts:280`, `fetchRewardControl`.
- **Card:** BE-23
- **Contract:** missing

### M14-40 `PUT /api/admin/reward-control/settings`
- **Roles:** admin
- **Auth detail:** `adminOnly`.
- **Purpose:** save the five shared economy settings.
- **Request:** body any subset of `{rewardBudgetSenSession, rewardBudgetSenMonth, flatQuizReward, currentSessionYear, gamesAwardSyiling}` (ints; snake_case keys also accepted). Blank/absent keys are skipped.
- **Response:** 200 `{data: EconomySettings}` (T:590).
- **Errors:** 422 "Sila lengkapkan semua medan wajib." with `fields[<camel>]` = "Medan ini tidak sah." (non-integer) or `fields.settings` = "Medan ini diperlukan." (nothing posted); repository 422 for negative values; 401, 403.
- **Side effects:** updates the shared settings rows (same store as M14-37/38).
- **Owner / handler / client:** M14, `handlers/admin-ops.ts:290`, `saveRewardControlSettings`.
- **Card:** BE-23 (`PUT /api/admin/reward-control/settings`)
- **Contract:** missing

### M14-41 `PUT /api/admin/reward-control/rewards/:id/cost`
- **Roles:** admin
- **Auth detail:** `adminOnly`.
- **Purpose:** set the RM cost value of a syiling-priced reward (V-M14-13).
- **Request:** path `id`; body `{costValueSen: int >= 0}`.
- **Response:** 200 `{data: SyilingReward}` (with `costRm = costValueSen / 100`).
- **Errors:** 404 `NOT_FOUND` "Hadiah tidak dijumpai."; 422 (conventions); 401, 403.
- **Side effects:** updates the reward cost value (liability tile input).
- **Owner / handler / client:** M14, `handlers/admin-ops.ts:308`, `saveRewardCost`.
- **Card:** BE-23
- **Contract:** missing

### M14-42 `POST /api/admin/reward-control/draws`
- **Roles:** admin
- **Auth detail:** `adminOnly`.
- **Purpose:** create a lucky draw (Cabutan Bertuah, V-M14-12, BR-M14-29).
- **Request:** body `{title: text <= 150, description?: <= 1000, ticketCostSyiling: int >= 1, maxTicketsPerStudent: int >= 1, closesAt?: YYYY-MM-DD (real date), openNow?: bool, prizePool?: JSON text of [{label, value_sen, qty}] or an array of {label, valueSen|value_sen, qty}}`.
- **Response:** **201** `{data: Draw}` (T:615 with `ticketsSold: 0`); `status` = `open` if `openNow` else `draft`.
- **Errors:** 422 `VALIDATION_ERROR` "Format JSON kolam hadiah tidak sah." with `fields.prizePool` (bad pool; message is also the top-level message); 422 "Sila lengkapkan semua medan wajib." with `fields.closesAt` "Medan ini tidak sah." (not a real date); repository 422 "Tarikh tutup tidak sah."; other 422 as conventions; 401, 403.
- **Side effects:** inserts the draw. Ticket purchase and the draw itself (winner selection) are not routes in this mock (OQ-API-B4-8: no "draw winners" endpoint exists).
- **Owner / handler / client:** M14, `handlers/admin-ops.ts:327`, `createAdminDraw`.
- **Card:** BE-23 (`POST /api/admin/reward-control/draws`)
- **Contract:** missing


## M15 Rewards shop (`m15-rewards-shop`) - 18 routes

Mock: `src/modules/m15-rewards-shop/mock/handlers/{user,admin,input}.ts`; wire types `src/modules/m15-rewards-shop/api/types.ts` (`T:` below); clients `api/{user,admin}.ts`. SRS `docs/requirements/srs/M15-rewards-shop.md` (route numbers `#1` to `#20`). Count matches the plan (18): user 10, admin 8. Wallet/draw movements go through the M14 contract (`mock/repository/m14-seam.ts`); M15 never writes M14 tables directly (ADR-0014). Card **BE-23** (which lists "the 18 M15 routes" and an example `GET /api/rewards...`; the real paths are the ones below, see OQ-API-B4-9).

Module conventions:

- Guards: `signedIn` = `requireAuth()` (401 "Unauthenticated."); `adminOnly` = `requireRole('admin')` (403 `FORBIDDEN` "This action is unauthorized."); `parentOnly` = `requireRole('parent')`.
- Ids are integers in the mock (see OQ-API-B4-1). Datetimes ISO `+08:00`.
- Refusals (`handlers/admin.ts:325 refusal`): `M15Error` `NOT_FOUND` -> 404 `NOT_FOUND` with the repository message; every other code -> **409** with that code (`OUT_OF_STOCK`, `MONTHLY_CAP`, `INSUFFICIENT_TOKENS`, `DRAW_CLOSED`, `TICKET_LIMIT`, `INSUFFICIENT_BALANCE`, `CONFLICT`). The whole request is one transaction (BR-M15-21): a refusal rolls back M14 wallet writes too.
- Validation (`handlers/input.ts`): Laravel-style English messages (no live BM copy exists, SRS 5), `422 VALIDATION_ERROR`, `fields[name]` = message, top-level `message` = first field message plus " (and N more error(s))" (`validationError(fields)` default). Messages: `The {field words} field is required.`, `... must be a string.`, `... must not be greater than {n} characters.`, `... must be an integer.`, `... must be between {min} and {max}.`, `The selected category is invalid.`, `The selected delivery method is invalid.`, `The image url field must be a valid URL.`, `The is active field must be true or false.`, `The requires parent consent field must be true or false.` ({field words} = camelCase split to lower-case words, e.g. `denomination rm`, `token cost`).
- Catalogue enums: category `flagship|ewallet|telco|gaming|streaming|food_beverage|ecommerce|education|entertainment` (labels in `T:34`); delivery `manual|api|instant`; redemption status `pending_parent_consent|pending_admin|delivered|cancelled`.
- Contract status for all M15 routes: **missing**.
- Role-access matrix: Murid items 31 (Kedai Hadiah), 35 (Kotak Misteri), 22 (Cabutan Bertuah), 38 (Kedai Hadiah Digital). Admin screens belong to Portal Pentadbiran (D48). Parent routes: parent is **out of prototype scope** (D43/D48; `v2-portals`), the routes remain in the mock.

### M15-01 `GET /api/hadiah-digital/items`
- **Roles:** any session
- **Auth detail:** `signedIn`.
- **Purpose:** L43 digital reward shop list. **Always empty** (BR-M15-26; the reward store is never read).
- **Request:** query `cat` (optional): absent or `all` -> `activeCat:'all'`; a known category -> that key; unknown or repeated value -> `null`.
- **Response:** 200 `{data: [], meta}` where `meta` is the **unpaged** list meta (`page 1`, `pageSize 1`, `totalItems 0`, `totalPages 1`, `from null`, `to null`) plus `activeCat` (T:313).
- **Errors:** 401.
- **Side effects:** none.
- **Owner / handler / client:** M15, `handlers/user.ts:253` (`digitalItems`), `fetchDigitalItems`.
- **Card:** BE-23
- **Contract:** missing

### M15-02 `GET /api/hadiah-digital/redemptions`
- **Roles:** any session
- **Auth detail:** `signedIn`.
- **Purpose:** L43 the caller's digital redemptions. **Always empty** (BR-M15-28).
- **Request:** none.
- **Response:** 200 `{data: [], meta: unpaged}`.
- **Errors:** 401.
- **Side effects:** none.
- **Owner / handler / client:** M15, `handlers/user.ts:254` (`digitalRedemptions`), `fetchDigitalRedemptions`.
- **Card:** BE-23
- **Contract:** missing

### M15-03 `POST /api/hadiah/redemptions`
- **Roles:** any session
- **Auth detail:** `signedIn`; the redeemer is the session user. No shop UI is built (S5 builds none, OQ-M15-01) but the route backs hook `m15Redeem`.
- **Purpose:** redeem a catalogue reward with tokens (BR-M15-05..07, 21).
- **Request:** body `{rewardId: positive integer}` (number or digit string).
- **Response:** **201** `{data: RedeemResult}` (T:190): `id`, `status` (`pending_parent_consent` if the reward has `requiresParentConsent`, else `pending_admin`), `tokenBalance` (after).
- **Errors:** 422 `VALIDATION_ERROR` `fields.rewardId` = "The reward id field is required." (message same); 404 `NOT_FOUND` "Hadiah tidak dijumpai." (missing or inactive reward); 409 `OUT_OF_STOCK` "Stok hadiah telah habis."; 409 `MONTHLY_CAP` "Had tebusan bulanan dicapai."; 409 `INSUFFICIENT_TOKENS` "Token tidak mencukupi."; 401. Checks run in that order.
- **Side effects (one transaction):** inserts a redemption snapshot row (reward title/vendor/icon/denomination/tokenCost copied, `stockReserved` true if stock is limited); M14 token debit of `tokenCost` (source `hadiah_redeem`, ref `redemption:{id}`; no coin-ledger row); reward `stockQuantity - 1` when stock is limited. Monthly cap counts the user's non-cancelled redemptions of that reward in the current Malaysia calendar month.
- **Owner / handler / client:** M15 (calls M14 `wallet.debitTokens`), `handlers/user.ts:255`, `redeemHadiah`.
- **Card:** BE-23
- **Contract:** missing

### M15-04 `GET /api/gamification/mystery-boxes`
- **Roles:** any session
- **Auth detail:** `signedIn`; own openings.
- **Purpose:** Kotak Misteri: box catalogue, token balance, last 10 openings.
- **Request:** none.
- **Response:** 200 `{data: MysteryBoxesView}` (T:222): `tokenBalance`; `boxes[]` (T:197: id,name,description,icon,rarity (`rare|epic|legendary|null`),costTokens,coinMin,coinMax,xpMin,xpMax,color1,color2; static catalogue `data/mystery-boxes.ts`); `history[]` (T:212: id,boxId,boxName,coins,xp,createdAt) newest first, max 10.
- **Errors:** 401.
- **Side effects:** none.
- **Owner / handler / client:** M15, `handlers/user.ts:256` (`listBoxes`), `fetchMysteryBoxes`.
- **Card:** BE-23
- **Contract:** missing

### M15-05 `POST /api/gamification/mystery-boxes/:id/open`
- **Roles:** any session
- **Auth detail:** `signedIn`.
- **Purpose:** open a box (BR-M15-17/18).
- **Request:** path `id` int; no body.
- **Response:** 200 (not 201) `{data: MysteryBoxOpened}` (T:229): `openingId`, `boxId`, `boxName`, `icon`, `coins`, `xp`, `tokenBalance`, `syilingBalance` (both after).
- **Errors:** 404 `NOT_FOUND` "Kotak tidak dijumpai."; 409 `INSUFFICIENT_TOKENS` "Token tidak mencukupi."; 401.
- **Side effects (one transaction):** opening row stored; tokens debited (`costTokens`, source `mystery_box`); `coins` syiling credited (ledger `earn`, source `mystery_box`, description `Kotak Misteri: {box name}`, ref `opening:{id}`); `xp` added if > 0. Result is a uniform integer in `[coinMin,coinMax]` and `[xpMin,xpMax]` from a PRNG seeded by (userId, previous opening count) in the mock; the real backend may use any RNG but must keep ranges (rule is PROPOSED, OQ-API-B4-10).
- **Owner / handler / client:** M15 (calls M14 wallet), `handlers/user.ts:257`, `openMysteryBox`.
- **Card:** BE-23
- **Contract:** missing

### M15-06 `GET /api/cabutan`
- **Roles:** any session
- **Auth detail:** `signedIn`; own ticket counts.
- **Purpose:** Cabutan Bertuah: open draws (BR-M15-19).
- **Request:** none.
- **Response:** 200 `{data: CabutanView}` (T:259): `syilingBalance`; `draws[]` (T:246: id,title,description,ticketCostSyiling,maxTicketsPerStudent,ticketsOwned,closesAt|null,prizePool [{label,valueSen,qty}]). Only draws with `status=open` and `closesAt >= today` (Malaysia) or null; ordered by `closesAt` ascending (null last) then id.
- **Errors:** 401.
- **Side effects:** none.
- **Owner / handler / client:** M15 (reads M14 draws), `handlers/user.ts:260` (`listCabutan`), `fetchCabutan`.
- **Card:** BE-23
- **Contract:** missing

### M15-07 `POST /api/cabutan/:drawId/tickets`
- **Roles:** any session
- **Auth detail:** `signedIn`.
- **Purpose:** buy one draw ticket with syiling.
- **Request:** path `drawId` int; no body.
- **Response:** **201** `{data: TicketBought}` (T:265): `drawId`, `ticketsOwned`, `syilingBalance`.
- **Errors:** 409 `DRAW_CLOSED` "Cabutan ditutup." (missing, not open, or closed by date); 409 `TICKET_LIMIT` "Had tiket dicapai."; 409 `INSUFFICIENT_BALANCE` "Baki syiling tidak mencukupi."; 401.
- **Side effects:** syiling debit `ticketCostSyiling` (ledger `type=spend`, source `cabutan_ticket`, description `Tiket Cabutan: {title}`, ref `draw:{id}`); one draw-ticket row.
- **Owner / handler / client:** M15 handler, M14 `draws.buyTicket`, `handlers/user.ts:261`, `buyCabutanTicket`.
- **Card:** BE-23
- **Contract:** missing

### M15-08 `GET /api/parent/hadiah-approvals`
> **Not in B1 (UD-3): user decision 2026-10-19. The backend does not register the parent hadiah-approval routes (M15-08..10) and the frontend hides the entry point (no "coming soon" page). Card: none. Kept here as the record of the mock behaviour.**
- **Roles:** any session (scoped to linked children; effectively parent)
- **Auth detail:** `signedIn` only (no role guard). Scope = students linked to the caller via M02 parent links (`parentLinks.studentIdsOf`); a non-parent has no children, so gets empty lists. Parent is out of prototype scope (D43).
- **Purpose:** parent consent queue.
- **Request:** none.
- **Response:** 200 `{data: ParentApprovalsView}` (T:283): `pending[]` (the children's `pending_parent_consent`) and `history[]` (all other statuses), each newest first, item T:272: id,child {id,name},rewardTitle,rewardIcon|null,tokenCost,status,createdAt.
- **Errors:** 401.
- **Side effects:** none.
- **Owner / handler / client:** M15 (reads M02 links), `handlers/user.ts:264`, `fetchParentApprovals`.
- **Card:** UNCOVERED (not in B1, UD-3)
- **Contract:** missing

### M15-09 `POST /api/parent/hadiah-approvals/:id/approve`
> **Not in B1 (UD-3): user decision 2026-10-19. The backend does not register the parent hadiah-approval routes (M15-08..10) and the frontend hides the entry point (no "coming soon" page). Card: none. Kept here as the record of the mock behaviour.**
- **Roles:** parent
- **Auth detail:** `parentOnly` (403 for other roles); the redemption must belong to a linked child, else 404 (no probing).
- **Purpose:** parent approves; moves to admin queue.
- **Request:** path `id` int; no body.
- **Response:** 200 `{data: {id, status: 'pending_admin'}}` (T:289).
- **Errors:** 404 `NOT_FOUND` "Tebusan tidak dijumpai." (unknown or not a child's); 409 `CONFLICT` "Tebusan ini tidak lagi menunggu kelulusan." (not `pending_parent_consent`); 401, 403.
- **Side effects:** status -> `pending_admin`, `parentDecisionBy` = parent id, `parentDecidedAt` = now.
- **Owner / handler / client:** M15, `handlers/user.ts:265`, `approveParentRequest`.
- **Card:** UNCOVERED (not in B1, UD-3)
- **Contract:** missing

### M15-10 `POST /api/parent/hadiah-approvals/:id/reject`
> **Not in B1 (UD-3): user decision 2026-10-19. The backend does not register the parent hadiah-approval routes (M15-08..10) and the frontend hides the entry point (no "coming soon" page). Card: none. Kept here as the record of the mock behaviour.**
- **Roles:** parent
- **Auth detail:** `parentOnly`; child ownership as M15-09.
- **Purpose:** parent rejects: cancel and refund (BR-M15-09).
- **Request:** path `id`; no body.
- **Response:** 200 `{data: CancelResult}` (T:183): `{id, status:'cancelled', refundedTokens}`.
- **Errors:** as M15-09 (404 "Tebusan tidak dijumpai.", 409 `CONFLICT` "Tebusan ini tidak lagi menunggu kelulusan.").
- **Side effects:** M14 token credit of `tokenCost` (source `hadiah_refund`, ref `redemption:{id}`), reward stock + 1 if it was reserved, status `cancelled`, `cancelledBy=parent`, `cancelledAt`, parent decision fields set.
- **Owner / handler / client:** M15, `handlers/user.ts:268`, `rejectParentRequest`.
- **Card:** UNCOVERED (not in B1, UD-3)
- **Contract:** missing

### M15-11 `GET /api/admin/hadiah`
- **Roles:** admin
- **Auth detail:** `adminOnly`.
- **Purpose:** S1 rewards catalogue admin list (BR-M15-01).
- **Request:** query `cat` (category key or `all`; unknown -> no rows, `activeCat:null`), `page` (invalid = 1). Page size fixed **50**.
- **Response:** 200 `{data: HadiahListItem[], meta}` (T:101,119): row id,category,categoryLabel,vendor,title,iconEmoji|null,denominationRm,tokenCost,stockQuantity|null,redemptionCount (non-cancelled),isActive; `meta` = standard paging (`page,pageSize,totalItems,totalPages,from,to`) plus `activeCat` and `cards` {total,active,redemptionsThisMonth,pendingAdmin}. Ordered by catalogue order (`REWARD_ORDER`, `repository/hadiah.ts`).
- **Errors:** 401, 403.
- **Side effects:** none.
- **Owner / handler / client:** M15, `handlers/admin.ts:193`, `fetchHadiahList`.
- **Card:** BE-23
- **Contract:** missing

### M15-12 `POST /api/admin/hadiah/bulk`
- **Roles:** admin
- **Auth detail:** `adminOnly`. Registered before `/:id` so `bulk` is not read as an id.
- **Purpose:** bulk action on rewards (BR-M15-11/12/24).
- **Request:** body `{action: activate|deactivate|delete|set_stock|set_max_per_month|set_token_cost, ids: positive int[] (non-empty), stockValue?: string, maxPerMonthValue?: string, tokenCostDeltaPct?: string}`. `set_stock`: `stockValue` empty (= unlimited, null) or digits <= 999999. `set_max_per_month`: empty or 0 = no cap (null), else digits <= 99. `set_token_cost`: `parseInt(text,10)` semantics, must be non-zero in `-90..500`; new cost = `floor(cost * (1 + pct/100) + 0.5)` clamped to 1..10000 (PROPOSED rounding); `denominationRm` unchanged.
- **Response:** 200 `{data: HadiahBulkResult}` (T:145): `{affected}`; for `delete` also `keptIds` (rewards that have any redemption row are **kept**, not deleted). Unknown ids are ignored; duplicates collapsed.
- **Errors:** 422 `VALIDATION_ERROR`: `fields.action` "The action field is required." / "The selected action is invalid."; `fields.ids` "The ids field is required." / "The ids field must contain positive integers."; `fields.stockValue` "The stock value must be 0-999999 or empty."; `fields.maxPerMonthValue` "The max per month value must be 0-99 or empty."; `fields.tokenCostDeltaPct` "The token cost adjustment must be between -90 and 500 (not 0)."; 401, 403.
- **Side effects:** updates `isActive`/`stockQuantity`/`maxPerMonthPerStudent`/`tokenCost` + `updatedAt`, or deletes rewards with no redemptions.
- **Owner / handler / client:** M15, `handlers/admin.ts:195`, `bulkHadiah`.
- **Card:** BE-23
- **Contract:** missing

### M15-13 `GET /api/admin/hadiah/redemptions`
- **Roles:** admin
- **Auth detail:** `adminOnly`. Registered before `/:id`.
- **Purpose:** S2 redemption queue (BR-M15-15).
- **Request:** query `status` (absent = `pending_admin`; a status key; `all`; anything else = empty list, `activeStatus:null`), `page`. Page size **50**, newest first.
- **Response:** 200 `{data: RedemptionListItem[], meta}` (T:151): id,user {id,name,email},rewardId,rewardTitle,rewardVendor,denominationRm,tokenCost,status,createdAt; `meta` standard paging plus `activeStatus` (T:163).
- **Errors:** 401, 403.
- **Side effects:** none.
- **Owner / handler / client:** M15, `handlers/admin.ts:196`, `fetchRedemptions`.
- **Card:** BE-23
- **Contract:** missing

### M15-14 `POST /api/admin/hadiah/redemptions/:id/deliver`
- **Roles:** admin
- **Auth detail:** `adminOnly`.
- **Purpose:** mark delivered with a voucher code (BR-M15-10).
- **Request:** path `id` int; body `{code: string, trimmed, 1..100 chars}`.
- **Response:** 200 `{data: DeliverResult}` (T:175): `id`, `status:'delivered'`, `deliveredAt`, `expiresAt` (= now + reward `voucherValidityDays`, default 365).
- **Errors:** 404 `NOT_FOUND` "Not Found." (id unknown, checked before the body is validated); 422 `fields.code` "The code field is required." / "The code field must not be greater than 100 characters."; 409 `CONFLICT` "Tebusan ini tidak lagi menunggu pemprosesan." (status not `pending_admin`); 401, 403.
- **Side effects:** stores `voucherCode`, `deliveredAt`, `expiresAt`, status `delivered`. No notification to the student in the mock.
- **Owner / handler / client:** M15, `handlers/admin.ts:197`, `deliverRedemption`.
- **Card:** BE-23
- **Contract:** missing

### M15-15 `POST /api/admin/hadiah/redemptions/:id/cancel`
- **Roles:** admin
- **Auth detail:** `adminOnly`.
- **Purpose:** admin cancels a `pending_admin` redemption; refund (BR-M15-09).
- **Request:** path `id`; no body.
- **Response:** 200 `{data: CancelResult}` `{id, status:'cancelled', refundedTokens}`.
- **Errors:** 404 `NOT_FOUND` "Tebusan tidak dijumpai."; 409 `CONFLICT` "Tebusan ini tidak lagi menunggu pemprosesan."; 401, 403.
- **Side effects:** token credit of `tokenCost` (source `hadiah_refund`, ref `redemption:{id}`), stock + 1 if reserved, status `cancelled`, `cancelledBy=admin`, `cancelledAt`.
- **Owner / handler / client:** M15, `handlers/admin.ts:200`, `cancelRedemption`.
- **Card:** BE-23
- **Contract:** missing

### M15-16 `GET /api/admin/hadiah/:id`
- **Roles:** admin
- **Auth detail:** `adminOnly`.
- **Purpose:** one reward (edit form).
- **Request:** path `id` int.
- **Response:** 200 `{data: HadiahReward}` (T:49): id,category,vendor,title,description|null,denominationRm,tokenCost,iconEmoji|null,stockQuantity|null,maxPerMonthPerStudent|null,voucherValidityDays,deliveryMethod,vendorSku|null,displayOrder,imageUrl|null,termsText|null,isActive,requiresParentConsent,createdAt,updatedAt.
- **Errors:** 404 `NOT_FOUND` "Not Found."; 401, 403.
- **Side effects:** none.
- **Owner / handler / client:** M15, `handlers/admin.ts:203`, `fetchHadiah`.
- **Card:** BE-23
- **Contract:** missing

### M15-17 `POST /api/admin/hadiah`
- **Roles:** admin
- **Auth detail:** `adminOnly`.
- **Purpose:** create a reward (BR-M15-11/13).
- **Request:** body `HadiahInput` (T:80). Required: `category` (enum), `vendor` (<= 100), `title` (<= 200), `denominationRm` (int 1..10000), `tokenCost` (int 1..10000). Optional (defaults): `description` <= 1000 (null), `iconEmoji` <= 8 (null), `stockQuantity` 0..999999999 (null = unlimited), `maxPerMonthPerStudent` 1..99 (null), `voucherValidityDays` 1..1825 (365), `deliveryMethod` (`manual`), `vendorSku` <= 100 (null), `displayOrder` 0..9999 (100), `imageUrl` <= 500 and `^https?://\S+$` (null), `termsText` <= 2000 (null), `isActive` (true), `requiresParentConsent` (false). Integers may arrive as numbers or digit strings; booleans as true/false/1/0/"1"/"0"/"true"/"false"/"on"/"off".
- **Response:** **201** `{data: HadiahReward}`.
- **Errors:** 422 with the validation messages listed in the module conventions; 401, 403.
- **Side effects:** inserts reward with `createdAt = updatedAt = now`.
- **Owner / handler / client:** M15, `handlers/admin.ts:204`, `createHadiah`.
- **Card:** BE-23
- **Contract:** missing

### M15-18 `PUT /api/admin/hadiah/:id`
- **Roles:** admin
- **Auth detail:** `adminOnly`.
- **Purpose:** replace a reward (full body, same rules as create; omitted optionals fall back to defaults, i.e. not a patch).
- **Request:** path `id`; body `HadiahInput` as M15-17.
- **Response:** 200 `{data: HadiahReward}`.
- **Errors:** 404 `NOT_FOUND` "Not Found." (checked before validation); 422 as M15-17; 401, 403.
- **Side effects:** updates fields and `updatedAt`.
- **Owner / handler / client:** M15, `handlers/admin.ts:205`, `updateHadiah`.
- **Card:** BE-23
- **Contract:** missing


## M16 Battle, games and competitions (`m16-battle-games`) - 52 routes

> **D53(a): M16 is in B1; the backend replicates the bot simulation. BE-44 battle, standings and tournaments (M16-01..21, M16-42..45; 25 routes), BE-45 papan-bijak, games hub, leagues, Sekolah Bersaing and admin games (M16-22..41, M16-46..52; 27 routes).**

Mock: `src/modules/m16-battle-games/mock/handlers/{battle,standings,games,tournaments,leagues,admin-games,common}.ts`; wire types `api/types.ts` (`T:`) and `api/game-types.ts` (`G:`); clients `api/battle.ts` (`B:`) and `api/games.ts`. SRS `docs/requirements/srs/M16-battle-games.md` (route numbers `#1` to `#52`; the block ids below use the SRS number). Count: the plan (section 6.3 and the README backlog) says 28; `grep -c "route("` finds 51 lines and the real number is **52** (battle.ts has one `route()` inside a factory `start(mode)` that is called twice for #2 and #3). Per file: battle 16, standings 4, games 20, tournaments 5, leagues 5, admin-games 2.

**Scope status (D53(a), 2026-10-19): M16 is in B1.** The backend replicates the bot simulation; cards BE-44 (battle) and BE-45 (papan-bijak + hub), . The earlier text "wave-4 backlog" is superseded.

Module conventions:

- Guards: every route is `requireAuth()` (401 "Unauthenticated."; **any role** reaches it, no role check) except #43, #44, #51, #52 which are `requireRole('admin')` (403 "This action is unauthorized."). The caller is always the session user; there is no scope by school except where stated. Several games are SIMULATIONS in the mock (bots as opponents, D4); see OQ-API-B4-11.
- Three response styles (see `handlers/common.ts`):
  1. **Live-shaped, un-enveloped** (`raw(200, body)`): #1, #2 to #14, #29 to #31, #33, #35. The client uses `api.raw`. Errors on #2 to #14 are `{error: "<BM text>"}` (not the standard `{error:{code,message}}`): 422 for a validation refusal, 403 for forbidden, 409 for conflict, 404 for anything else; #2/#3 answer 422 and 403 with an **empty body `{}`** (BR-M16-03). #33/#35 errors are `{message}` (+ `success:false` for #35): 409 conflict, 404 not found, 422 otherwise. #29 error: 422 `{error}`.
  2. **Envelope** `{data}`: all the others. Their errors are the standard body: `NOT_FOUND` 404, `FORBIDDEN` 403, `CONFLICT` 409, validation 422 `VALIDATION_ERROR` with `fields[<field or 'form'>]` = message and top-level message = the same text (`refusal()`, `common.ts:52`).
  3. #1 is a bare JSON array.
- Ids are integers (queues, users, schools, leagues) or strings (battle uuids, room codes, tournament uuids, session ids such as `tf_<13 hex>`). Target contract ids: strings (OQ-API-B4-1).
- Contract status for all M16 routes: **missing**.
- Real-time: clients poll (`poll-match` 3 s, rooms 3 s); no websocket in the mock. Time-based rules use the mock clock in Asia/Kuala_Lumpur.
- Coin rewards go through M14 `onGameResult` (`repository/games-common.ts:97 reportGame`): syiling is credited only when setting `games_award_syiling` = 1 and the user's coins are enabled (`canEarnSyiling`); a positive `coins` writes an `earn` ledger row via `creditSyilingOp`; `xp` is always 0 from M16. The returned `coinsCredited` is 0 when disabled.

### M16-01 `GET /api/tournament/active`
- **Roles:** any session
- **Auth detail:** `requireAuth()`; banner shown on every user page.
- **Purpose:** active tournaments banner (BR-M16-38). #1.
- **Request:** none.
- **Response:** 200 **bare array** (no `{data}`) of `TournamentActive` (T:191): `uuid`, `title`, `status` (`registration|ongoing`), `live_match` ({school_a, school_b} names | null). Includes tournaments whose stored status is `registration` or `ongoing` (a `registration` whose `registration_closes_at` has passed is shown as `ongoing`); ordered by `registration_opens_at` (null last), then creation time. Drafts and completed are excluded. The client treats any failure as an empty list.
- **Errors:** 401.
- **Side effects:** none.
- **Owner / handler / client:** M16, `handlers/tournaments.ts:26`, `fetchActiveTournaments`.
- **Card:** BE-44
- **Contract:** missing

### M16-02 `POST /api/battle/quick-match`
- **Roles:** any session
- **Auth detail:** `requireAuth()`.
- **Purpose:** join the quick-match queue (BR-M16-03). #2.
- **Request:** body `BattleStartBody` (T:14): `question_type` (`biasa|pksk|spm`, required), `open_to_all` (boolean, `true` only if literally true), and by type: `biasa` needs `subject_id` int 1..31; `pksk` needs `pksk_domain_id` (active domain) and `pksk_target_level` (`T1|T4`); `spm` needs `subject_id` 1..31 with a non-empty SPM pool and the caller's grade >= 10 (Tingkatan 4 or 5).
- **Response:** 200 raw `{queue_id: number}`.
- **Errors:** 422 with body `{}` (invalid type "Jenis soalan tidak sah.", "Subjek tidak sah.", "Domain PKSK tidak sah.", "Tahap PKSK tidak sah.", or fewer than 10 eligible questions "Soalan tidak mencukupi."; the text is NOT sent); 403 with body `{}` (SPM requested by a user below Tingkatan 4; message "Khas untuk pelajar Tingkatan 4 & 5 sahaja." is NOT sent); 401.
- **Side effects:** inserts a `waiting` queue row owned by the caller (expires 120 s after creation, treated as abandoned if not polled for 10 s). Pre-checks that 10 questions can be drawn.
- **Owner / handler / client:** M16 (reads M04 pool, M03 subjects), `handlers/battle.ts:13-29`, `startBattle('quick-match')`.
- **Card:** BE-44
- **Contract:** missing

### M16-03 `POST /api/battle/school-battle`
- **Roles:** any session
- **Auth detail:** `requireAuth()`.
- **Purpose:** same as M16-02 but the opponent must be from another school (bot pick rule). #3.
- **Request / Response / Errors:** identical to M16-02.
- **Side effects:** queue row with `mode=school_battle`.
- **Owner / handler / client:** M16, `handlers/battle.ts:13-29`, `startBattle('school-battle')`.
- **Card:** BE-44
- **Contract:** missing

### M16-04 `GET /api/battle/poll-match/:queueId`
- **Roles:** any session
- **Auth detail:** `requireAuth()`; only the queue owner (others get `not_found`).
- **Purpose:** poll a queue (BR-M16-04/05). #4.
- **Request:** path `queueId` int.
- **Response:** 200 raw `PollMatchResponse` (T:35): `{status:'waiting'|'expired'|'not_found'}`, or `{status:'incoming_challenge', challenger:{name, grade_label, school}}`, or `{status:'matched', battle_uuid}`. Mock timing (SIMULATION): the 2nd waiting poll yields an `incoming_challenge` from a fictitious student in `incoming` mode, the 3rd waiting poll matches a bot in `match` mode (default `match`); queue older than 120 s or unpolled > 10 s becomes `expired`.
- **Errors:** 401. (A test-only simulation mode can answer `{error:'Ralat pelayan.'}` with a chosen 5xx.)
- **Side effects:** increments poll counters, may expire the queue, may create the battle (10 questions drawn, status `active`).
- **Owner / handler / client:** M16, `handlers/battle.ts:31`, `pollMatch`.
- **Card:** BE-44
- **Contract:** missing

### M16-05 `POST /api/battle/accept-challenger/:queueId`
- **Roles:** any session
- **Auth detail:** `requireAuth()`; queue owner only.
- **Purpose:** accept the incoming challenger (#5).
- **Request:** path `queueId`; no body.
- **Response:** 200 raw `{matched: true, battle_uuid}`.
- **Errors:** 404 `{error:"Giliran tidak dijumpai."}` (unknown, not own, or not in `incoming_challenge`); 401.
- **Side effects:** creates the battle (owner = player A), queue -> `matched`.
- **Owner / handler / client:** M16, `handlers/battle.ts:48`, `acceptChallenger`.
- **Card:** BE-44
- **Contract:** missing

### M16-06 `POST /api/battle/reject-challenger/:queueId`
- **Roles:** any session
- **Auth detail:** `requireAuth()`; owner only.
- **Purpose:** reject the challenger; queue returns to waiting (#6).
- **Request:** path `queueId`.
- **Response:** 200 raw `{success: true}` (also when the queue is not in `incoming_challenge`: no-op).
- **Errors:** 404 `{error:"Giliran tidak dijumpai."}`; 401.
- **Side effects:** queue -> `waiting`, challenger cleared, wait counter reset.
- **Owner / handler / client:** M16, `handlers/battle.ts:68`, `rejectChallenger`.
- **Card:** BE-44
- **Contract:** missing

### M16-07 `GET /api/battle/search-opponent`
- **Roles:** any session
- **Auth detail:** `requireAuth()`; searches all students (national).
- **Purpose:** find an opponent by name for an invite (BR-M16-11). #7.
- **Request:** query `q` (string; fewer than 2 trimmed chars returns an empty list).
- **Response:** 200 raw `{users: [{id, name, school, avatar|null}]}`: students whose name contains `q` (case-insensitive), excluding the caller, sorted by name then id, max 10. Exposes other students' names and schools (OQ-API-B4-4).
- **Errors:** 401.
- **Side effects:** none.
- **Owner / handler / client:** M16 (reads M01/M02), `handlers/battle.ts:84`, `searchOpponent`.
- **Card:** BE-44
- **Contract:** missing

### M16-08 `POST /api/battle/invite`
- **Roles:** any session
- **Auth detail:** `requireAuth()`.
- **Purpose:** invite a named student to a battle (BR-M16-06). #8.
- **Request:** body `BattleInviteBody` (T:22) = M16-02 body + `receiver_id` (existing student, not the caller). No `open_to_all` effect.
- **Response:** 200 raw `{success: true}`.
- **Errors (raw, `{error}`):** 422 "Penerima tidak sah." (bad receiver); 422 "Soalan tidak mencukupi."; 422 "Jenis soalan tidak sah." / "Subjek tidak sah." / "Domain PKSK tidak sah." / "Tahap PKSK tidak sah."; 403 "Khas untuk pelajar Tingkatan 4 & 5 sahaja." (here the message IS sent); 401.
- **Side effects:** inserts a `pending` invitation (uuid) valid 24 h.
- **Owner / handler / client:** M16, `handlers/battle.ts:91`, `sendInvite`.
- **Card:** BE-44
- **Contract:** missing

### M16-09 `GET /api/battle/invitations`
- **Roles:** any session
- **Auth detail:** `requireAuth()`; own incoming invitations.
- **Purpose:** list pending invitations (#9).
- **Request:** none.
- **Response:** 200 raw `{invitations: [{uuid, sender_name, sender_school}]}` newest first, only `pending` and < 24 h old.
- **Errors:** 401.
- **Side effects:** none.
- **Owner / handler / client:** M16, `handlers/battle.ts:107`, `fetchInvitations`.
- **Card:** BE-44
- **Contract:** missing

### M16-10 `POST /api/battle/invite/:uuid/accept`
- **Roles:** any session
- **Auth detail:** `requireAuth()`; receiver only.
- **Purpose:** accept an invitation (#10).
- **Request:** path `uuid` (string); no body.
- **Response:** 200 raw `{success: true, battle_uuid}`.
- **Errors:** 404 `{error:"Cabaran tidak dijumpai."}` (unknown, not receiver, not pending, or older than 24 h); 401.
- **Side effects:** creates an `active` battle (sender = A, receiver = B, mode `challenge`), invitation -> `accepted`.
- **Owner / handler / client:** M16, `handlers/battle.ts:112`, `acceptInvitation`.
- **Card:** BE-44
- **Contract:** missing

### M16-11 `POST /api/battle/invite/:uuid/decline`
- **Roles:** any session
- **Auth detail:** `requireAuth()`; receiver only.
- **Purpose:** decline an invitation (#11).
- **Request:** path `uuid`.
- **Response:** 200 raw `{success: true}`.
- **Errors:** 404 `{error:"Cabaran tidak dijumpai."}`; 401.
- **Side effects:** invitation -> `declined`.
- **Owner / handler / client:** M16, `handlers/battle.ts:132`, `declineInvitation`.
- **Card:** BE-44
- **Contract:** missing

### M16-12 `POST /api/battle/join-queue/:queueId`
- **Roles:** any session
- **Auth detail:** `requireAuth()`; not the queue owner. No UI caller on live (DV-M16-06).
- **Purpose:** ask to join someone's waiting queue (#12).
- **Request:** path `queueId`.
- **Response:** 200 raw `{success: true}`.
- **Errors:** 404 `{error:"Ralat menghantar permohonan."}` (unknown queue, own queue, queue not waiting/incoming, or a join already pending); 401.
- **Side effects:** sets `joiner` {userId, outcome:'pending'}; the owner's next poll shows that user as the incoming challenger.
- **Owner / handler / client:** M16, `handlers/battle.ts:148`, `joinQueue`.
- **Card:** BE-44
- **Contract:** missing

### M16-13 `GET /api/battle/poll-challenger/:queueId`
- **Roles:** any session
- **Auth detail:** `requireAuth()`; only the joiner of that queue.
- **Purpose:** the joiner polls the owner's decision (#13).
- **Request:** path `queueId`.
- **Response:** 200 raw `PollChallengerResponse` (T:43): `{status:'waiting'|'matched'|'rejected'|'expired'|'not_found', battle_uuid?}`. Never an error status.
- **Errors:** 401.
- **Side effects:** when the owner accepted and no battle exists yet, creates it (owner = A, joiner = B).
- **Owner / handler / client:** M16, `handlers/battle.ts:164`, `pollChallenger`.
- **Card:** BE-44
- **Contract:** missing

### M16-14 `POST /api/battle/forfeit/:uuid`
- **Roles:** any session
- **Auth detail:** `requireAuth()`; a player of that battle.
- **Purpose:** forfeit an active battle (BR-M16-09). #14.
- **Request:** path `uuid`.
- **Response:** 200 raw `{success: true}`.
- **Errors:** 404 `{error:"Battle tidak dijumpai."}` (unknown or not a player); 409 `{error:"Battle sudah tamat."}`; 401.
- **Side effects:** battle -> `forfeited`, opponent wins, `finishedAt`; M14 `onGameResult` (game `battle`, event `forfeit`/`forfeit_win`, coins 0, xp 0) for the caller only.
- **Owner / handler / client:** M16 (calls M14), `handlers/battle.ts:177`, `forfeitBattle`.
- **Card:** BE-44
- **Contract:** missing

### M16-15 `GET /api/battle/lobby`
- **Roles:** any session
- **Auth detail:** `requireAuth()`.
- **Purpose:** battle lobby data (BR-M16-02/03). #15.
- **Request:** none.
- **Response:** 200 `{data: BattleLobby}` (T:77): `grade` (int|null), `gradeLabel` ("Darjah n" 1-6, "Tingkatan n" 7-11, '' if none), `spmUnlocked` (grade >= 10), `subjects[]` (active subjects id 1..31: id,name,icon,colour,core (id <= 7)), `pkskDomains[]` (active: id,name,icon,colour), `spmSubjects[]` {id,name} only when unlocked (subjects with a non-empty SPM pool).
- **Errors:** 401.
- **Side effects:** none.
- **Owner / handler / client:** M16 (reads M03, M04), `handlers/battle.ts:193`, `fetchBattleLobby`.
- **Card:** BE-44
- **Contract:** missing

### M16-16 `GET /api/battle/arena/:uuid`
- **Roles:** any session
- **Auth detail:** `requireAuth()`; only the two players, others 404. PROVISIONAL rules (SRS).
- **Purpose:** current arena state (#16).
- **Request:** path `uuid`.
- **Response:** 200 `{data: ArenaView}` (T:93): `uuid`, `status` (`active|finished|forfeited|abandoned`), `you` (`A|B`), `players` {A,B: {name, school}}, `scores` {A,B}, `index` (1..10), `total` (10), `question` ({id,text,options[{id 0-3,label A-D,text}]}, **no answer key**; null if not active), `secondsLeft` (15 when active else 0), and `result` {winner `A|B|null`, scoreA, scoreB} when not active.
- **Errors:** 404 `NOT_FOUND` "Battle tidak dijumpai."; 401.
- **Side effects:** none.
- **Owner / handler / client:** M16, `handlers/battle.ts:198`, `fetchArena`.
- **Card:** BE-44
- **Contract:** missing

### M16-17 `POST /api/battle/arena/:uuid/answer`
- **Roles:** any session
- **Auth detail:** `requireAuth()`; a player. PROVISIONAL.
- **Purpose:** answer the next arena question (BR-M16-07/08). #17.
- **Request:** path `uuid`; body `{questionId: int (must equal the caller's next question), optionId: int 0..3 | null (null = timeout), seconds: number 0..15}`.
- **Response:** 200 `{data: ArenaAnswerResult}` (T:113): `correct`, `correctOptionId`, `points`, `you` {score}, `opponent` {answered:true, correct, score}, then `next` (next question, keyless) or, after question 10, `result` {winner, scoreA, scoreB}. Points for a correct answer: `1000 - round(500 * s / 15)` with `s = floor(seconds)` clamped 0..15 (wrong or timeout 0). The opponent's answer is simulated (bot: 2 + 10u seconds, correct with probability = platform accuracy).
- **Errors:** 404 `NOT_FOUND` "Battle tidak dijumpai." / "Soalan tidak dijumpai."; 409 `CONFLICT` "Battle sudah tamat."; 422 `VALIDATION_ERROR` "Soalan tidak sah." (`fields.questionId`), "Jawapan tidak sah." (`fields.optionId`), "Masa tidak sah." (`fields.seconds`); 401.
- **Side effects:** stores both answers; after answer 10: status `finished`, winner = higher total (equal non-zero = seri/null; 0-0 = player B, DV-M16-35); M14 `onGameResult` (game `battle`, event `win` or `finish`, coins 0, xp 0, correct, total) for the caller.
- **Owner / handler / client:** M16 (calls M14), `handlers/battle.ts:213`, `answerArena`.
- **Card:** BE-44
- **Contract:** missing

### M16-18 `GET /api/battle/standings/students`
- **Roles:** any session
- **Auth detail:** `requireAuth()`; national.
- **Purpose:** student ranking (BR-M16-12/13). #18.
- **Request:** query `period` (`weekly` default, `monthly`; any other value = weekly).
- **Response:** 200 `{data: StudentStanding[]}` (T:123): rank,userId,name,school,menang,seri,kalah,ketepatan,streak,skor (internal `schoolId` stripped). Computed from finished/forfeited battles in the period window (week Monday-based, month calendar, Asia/Kuala_Lumpur); `skor` side = `round(score/100)` summed. Not paginated.
- **Errors:** 401.
- **Side effects:** none.
- **Owner / handler / client:** M16, `handlers/standings.ts:33`, `fetchStudentStandings`.
- **Card:** BE-44
- **Contract:** missing

### M16-19 `GET /api/battle/standings/schools`
- **Roles:** any session
- **Auth detail:** `requireAuth()`; national. Also feeds Portal Pentadbiran PG-12.
- **Purpose:** school ranking (#19).
- **Request:** query `period` (absent = `weekly`; `weekly|monthly|all_time`; any other value = all time with `activePeriod:null`), `state` (exact state name filter on rows).
- **Response:** 200 `{data: SchoolStandingsResult}` (T:152): `activePeriod`, `rows[]` (T:136: rank,schoolId,name,state,type,battles,menang,seri,kalah,ketepatan,pelajar,skor), `podium[]` (top 3 of the **national** list, not filtered by state: column,schoolId,name,state,skor). For the 8 observed schools Ketepatan and Skor are stored job figures plus runtime increments (DC-M16-03).
- **Errors:** 401.
- **Side effects:** none.
- **Owner / handler / client:** M16 (reads M02 schools), `handlers/standings.ts:45`, `fetchSchoolStandings`.
- **Card:** BE-44
- **Contract:** missing

### M16-20 `GET /api/battle/schools/:id`
- **Roles:** any session
- **Auth detail:** `requireAuth()`.
- **Purpose:** one school's battle page (#20).
- **Request:** path `id` int (school id).
- **Response:** 200 `{data: SchoolDetail}` (T:179): `school` {id,name,ppd,state,type}, `allTime` {battles,menang,ketepatan,pelajar}, `week`/`month` (StandingBox {rank,battles,menang,seri,kalah,skor} | null), `fighters[]` (top 5 weekly students of the school: userId,name,skor), `recent[]` (10 latest finished battles: BattleListRow T:159).
- **Errors:** 404 `NOT_FOUND` "Sekolah tidak dijumpai."; 401.
- **Side effects:** none.
- **Owner / handler / client:** M16, `handlers/standings.ts:65`, `fetchSchoolDetail`.
- **Card:** BE-44
- **Contract:** missing

### M16-21 `GET /api/battle/history`
- **Roles:** any session
- **Auth detail:** `requireAuth()`; own battles.
- **Purpose:** the caller's finished/forfeited battles (#21).
- **Request:** none.
- **Response:** 200 `{data: BattleListRow[]}` (T:159) newest first, unpaged: uuid,playerA {id,name,homeHere},scoreA,scoreB,playerB {id,name},winner,createdAt.
- **Errors:** 401.
- **Side effects:** none.
- **Owner / handler / client:** M16, `handlers/standings.ts:103`, `fetchBattleHistory`.
- **Card:** BE-44
- **Contract:** missing

### M16-22 `GET /api/games/hub`
- **Roles:** any session
- **Auth detail:** `requireAuth()`.
- **Purpose:** games hub: open rooms and chips (BR-M16-16/17). #22.
- **Request:** none.
- **Response:** 200 `{data: GamesHub}` (G:20): `openRooms[]` (up to 6 newest `waiting` rooms with free seats: game,code,host (name),players,max); `chips` {papanBijakPlayed, battled}.
- **Errors:** 401.
- **Side effects:** none.
- **Owner / handler / client:** M16, `handlers/games.ts:53`, `fetchGamesHub`.
- **Card:** BE-45
- **Contract:** missing

### M16-23 `GET /api/games/:game/lobby`
- **Roles:** any session
- **Auth detail:** `requireAuth()`.
- **Purpose:** lobby of a room game (BR-M16-22/23). #23.
- **Request:** path `game` in `papan-bijak|perang-fakta|benteng-ilmu|perlumbaan-matematik|kuiz-relay|teka-silang-kata`.
- **Response:** 200 `{data: GameLobby}` (G:26): `autoGrade` (e.g. `DARJAH_4`|null), `autoGradeName`, and `top10[]` for `papan-bijak` (rank,userId,name (truncated 15 chars + "..."),initials,menang,jumlah,kadar,skor,betul) or `leaders[]` (top 10 by wins: rank,userId,name,value) for the others.
- **Errors:** 404 `NOT_FOUND` "Permainan tidak dijumpai." (unknown game); 401.
- **Side effects:** none.
- **Owner / handler / client:** M16, `handlers/games.ts:166`, `fetchGameLobby`.
- **Card:** BE-45
- **Contract:** missing

### M16-24 `POST /api/games/:game/rooms`
- **Roles:** any session
- **Auth detail:** `requireAuth()`; caller becomes host and first player.
- **Purpose:** create a room (V-M16-01..05). #24.
- **Request:** path `game` (as M16-23); body `RoomCreateBody` (G:46): `subject` (`MATEMATIK|BAHASA_MELAYU|BAHASA_INGGERIS|SAINS|SEJARAH`; Papan Bijak excludes SEJARAH), `grade_level` (enum such as `DARJAH_4`), `match_mode` (`same_grade|same_level`, plus `custom` for Papan Bijak only), `grade_min`/`grade_max` (ints 1..11, min <= max, required when custom), `max_players` (Papan Bijak only, int 2..6; other games use their fixed max).
- **Response:** **201** `{data: {code}}` (6-character room code).
- **Errors:** 404 "Permainan tidak dijumpai."; 422 `VALIDATION_ERROR` with `fields[x]` = message: "Subjek tidak sah." (`subject`), "Tahap soalan tidak sah." (`grade_level`), "Julat tahap tidak sah." (`match_mode` or `grade_min`), "Bilangan pemain tidak sah." (`max_players`); 401.
- **Side effects:** inserts a `waiting` room and the host player.
- **Owner / handler / client:** M16, `handlers/games.ts:179`, `createRoom`.
- **Card:** BE-45
- **Contract:** missing

### M16-25 `POST /api/games/:game/rooms/join`
- **Roles:** any session
- **Auth detail:** `requireAuth()`.
- **Purpose:** join a waiting room by code (BR-M16-18). #25.
- **Request:** path `game`; body `{room_code: string}` (trimmed, upper-cased).
- **Response:** 200 `{data: {code}}` (also when already a player).
- **Errors:** 404 `NOT_FOUND` "Bilik tidak dijumpai." for every refusal (blank code, unknown room, wrong game, not waiting, full, grade not allowed by the room's match mode); 404 "Permainan tidak dijumpai."; 401.
- **Side effects:** adds the caller as a player.
- **Owner / handler / client:** M16, `handlers/games.ts:190`, `joinRoom`.
- **Card:** BE-45
- **Contract:** missing

### M16-26 `GET /api/games/:game/rooms/:code`
- **Roles:** any session
- **Auth detail:** `requireAuth()`; only players of the room (others 404). PROVISIONAL rules, polled every 3 s.
- **Purpose:** the room state (#26).
- **Request:** path `game`, `code`.
- **Response:** 200 `{data: RoomView}` (G:62): `code`, `game`, `status` (`waiting|playing|finished|closed`), `host` {id,name}, `players[]` {id,name,grade,team?,points,isBot}, `settings` {subject,gradeLevel,matchMode,gradeMin,gradeMax,maxPlayers,minPlayers}, `state` (null while waiting; else awaiting `roll|answer|null`, round, total, humanId, board?, positions?, meter?, teamScores?, log[], roundSecondsLeft? (Perang Fakta 10 s rounds), secondsLeft? (Teka Silang Kata 5 min)), `round?`, `question?` (keyless), `result?` {winnerId,winnerName,mvpId,scores[]}. Game rules per game are in SRS BR-M16-20 and `repository/room-engine.ts` (board 50 tiles, 15 fact rounds, Benteng 100 HP / 20 damage, Mathrace 20 steps, Kuiz Relay 10 rounds, crossword 8 words).
- **Errors:** 404 `NOT_FOUND` "Bilik tidak dijumpai." (unknown, other game, or caller not a player); 404 "Permainan tidak dijumpai."; 401.
- **Side effects:** (SIMULATION) polling by the host of a waiting room below the minimum players adds one bot player per poll; server clocks advance/finish timed games on read (`resolveClocks`), which can finish a game and settle rewards.
- **Owner / handler / client:** M16, `handlers/games.ts:207`, `fetchRoom`.
- **Card:** BE-45
- **Contract:** missing

### M16-27 `POST /api/games/:game/rooms/:code/start`
- **Roles:** any session
- **Auth detail:** `requireAuth()`; room host only.
- **Purpose:** start the game (BR-M16-19). #27.
- **Request:** path `game`, `code`; no body.
- **Response:** 200 `{data: RoomView}` (status `playing`).
- **Errors:** 404 "Bilik tidak dijumpai."; 403 `FORBIDDEN` "Hanya hos boleh memulakan permainan."; 409 `CONFLICT` "Permainan sudah dimulakan."; 409 "Pemain belum mencukupi." (below min players: 2 for most, 4 for Kuiz Relay); 409 "Soalan tidak mencukupi." (question pool); 401.
- **Side effects:** room -> `playing`, `startedAt`, initial state and questions drawn.
- **Owner / handler / client:** M16, `handlers/games.ts:220`, `startRoom`.
- **Card:** BE-45
- **Contract:** missing

### M16-28 `POST /api/games/:game/rooms/:code/action`
- **Roles:** any session
- **Auth detail:** `requireAuth()`; players; only the "human" of the room may act.
- **Purpose:** a roll (Papan Bijak) or an answer (#28).
- **Request:** path `game`, `code`; body `RoomActionBody` (G:109): `{type:'roll'}` or `{type:'answer', questionId:int, optionId?:int 0..3|null, value?:boolean|string (Perang Fakta true/false; crossword typed word), seconds?:number >= 0 (default 15)}`.
- **Response:** 200 `{data: RoomView}`. If a server clock ended the game just before the action, the finished room is returned instead of an error.
- **Errors:** 422 `VALIDATION_ERROR` "Soalan tidak sah." (`questionId`), "Pilihan tidak sah." (`optionId`), "Masa tidak sah." (`seconds`), "Tindakan tidak sah." (`type`), "Soalan tidak sepadan." (`questionId`), "Jawapan tidak sah." (`value`); 409 "Permainan belum bermula.", "Bukan giliran anda untuk gulung dadu.", "Tiada soalan untuk dijawab.", "Tiada jam untuk permainan ini."; 403 "Bukan giliran anda."; 404 "Bilik tidak dijumpai."; 401.
- **Side effects:** advances the engine (other players are bots in the mock); on finish: game standings (`wins`, plus `jumlah/betul/skor` for Papan Bijak) and one M14 `onGameResult` for the caller. Coins: Papan Bijak = correct answers x tier `boardGameRewardCorrect` + win x tier `boardGameRewardWin`; Benteng Ilmu 8 played / 35 won; Perang Fakta 10 on a win; Perlumbaan Matematik 5 played; Kuiz Relay and Teka Silang Kata 0 (`ROOM_COINS`, `data/games.ts`).
- **Owner / handler / client:** M16 (calls M14), `handlers/games.ts:233`, `roomAction`.
- **Card:** BE-45
- **Contract:** missing

### M16-29 `POST /api/papan-bijak/quick-match`
- **Roles:** any session
- **Auth detail:** `requireAuth()`.
- **Purpose:** start a Papan Bijak quick-match search (BR-M16-24). #29.
- **Request:** body `{subject: MATEMATIK|BAHASA_MELAYU|SAINS|BAHASA_INGGERIS, match_mode: same_grade|same_level}`.
- **Response:** 200 raw `{status:'searching'}`.
- **Errors:** 422 raw `{error:"Subjek tidak sah."}` or `{error:"Padanan tidak sah."}`; 401.
- **Side effects:** inserts a search row.
- **Owner / handler / client:** M16, `handlers/games.ts:150`, `startPbQuickMatch`.
- **Card:** BE-45
- **Contract:** missing

### M16-30 `GET /api/papan-bijak/quick-match/poll`
- **Roles:** any session
- **Auth detail:** `requireAuth()`; own latest search.
- **Purpose:** poll the quick match (#30).
- **Request:** none.
- **Response:** 200 raw `{status:'searching'|'expired'|'cancelled'}` or `{status:'matched', room_code}`. No search or a cancelled one = `cancelled`. Mock timing (SIMULATION): 3rd poll matches; search older than 120 s = `expired`.
- **Errors:** 401.
- **Side effects:** on match, creates a Papan Bijak room (host = caller, 4 seats, caller's grade level, a bot player added).
- **Owner / handler / client:** M16, `handlers/games.ts:158`, `pollPbQuickMatch`.
- **Card:** BE-45
- **Contract:** missing

### M16-31 `POST /api/papan-bijak/quick-match/cancel`
- **Roles:** any session
- **Auth detail:** `requireAuth()`.
- **Purpose:** cancel the search (#31).
- **Request:** none.
- **Response:** 200 raw `{status:'cancelled'}` (always).
- **Errors:** 401.
- **Side effects:** a `searching` row -> `cancelled`.
- **Owner / handler / client:** M16, `handlers/games.ts:161`, `cancelPbQuickMatch`.
- **Card:** BE-45
- **Contract:** missing

### M16-32 `GET /api/games/solo/:game`
- **Roles:** any session
- **Auth detail:** `requireAuth()`.
- **Purpose:** start a single-player game session and get its items (BR-M16-25/26). #32.
- **Request:** path `game` in `betul-salah|cabaran-kilat|tembak-jawapan|susun-jawapan|kad-memori`; query `darjah` (1..11; default = caller's grade or 4; ignored by `kad-memori`, which uses levels 1 to 4).
- **Response:** 200 `{data: Payload}` (G:126): `sessionId` (`tf_|speed_|shoot_|ws_|mem_` + 13 hex), `personalBest`, `canEarnSyiling`, and the items key by game: `statements[]` (40; id,statement,is_true,difficulty), `questions[]` (30; cabaran-kilat has option ids and `correct`; tembak-jawapan has options with `correct`), `puzzles[]` (20; id,question,answer,scrambled[],type,difficulty,points), `cards[]` (12 = 6 pairs; id,pair_id,type,content,difficulty). **The payload includes the answer key** (as live, SEC-M16-01).
- **Errors:** 404 `NOT_FOUND` "Permainan tidak dijumpai."; 422 `VALIDATION_ERROR` "Tahap tidak sah." (`fields.darjah`); 401.
- **Side effects:** inserts a game session row (valid for one submit).
- **Owner / handler / client:** M16 (reads M04 questions), `handlers/games.ts:115`, `fetchSoloGame`.
- **Card:** BE-45
- **Contract:** missing

### M16-33 `POST /api/games/solo/:game/submit`
- **Roles:** any session
- **Auth detail:** `requireAuth()`; own session only.
- **Purpose:** submit a result and earn syiling (BR-M16-27/28). #33.
- **Request:** path `game`; body per game (G:179): common `session_id`; betul-salah `correct_count,total_answered,streak,score,syiling_earned`; cabaran-kilat `...,max_combo,...`; tembak-jawapan `...,max_level,...`; susun-jawapan `solved_count,total_puzzles,score,syiling_earned`; kad-memori `matches (=6),total_pairs (=6),moves (>=6),time_seconds`. Server bounds: counts <= items served, `streak/max_combo <= correct`, `max_level` in `1..1+floor(correct/5)`, `score` <= game maximum for `correct`, `syiling_earned <= 5*correct` (betul-salah) / `10*correct` (cabaran-kilat) / `floor(maxScore/10)` (tembak).
- **Response:** 200 raw: kad-memori `{results:{syiling_earned, accuracy}}` (accuracy = round(6/moves*100), coins = 6); others `{is_new_record, syiling_awarded}`.
- **Errors (raw `{message}`):** 422 "Keputusan tidak sah." (any bound/session failure; field not sent); 409 "Keputusan sudah dihantar." (second submit); 404 "Permainan tidak dijumpai."; 401.
- **Side effects:** marks the session submitted; stores personal best (first result is a record, later must exceed); M14 `onGameResult` with the claimed coins (credited only when allowed, see conventions).
- **Owner / handler / client:** M16 (calls M14), `handlers/games.ts:132`, `submitSoloGame`.
- **Card:** BE-45
- **Contract:** missing

### M16-34 `GET /api/games/roda-nasib`
- **Roles:** any session
- **Auth detail:** `requireAuth()`; own stats.
- **Purpose:** Roda Nasib page (BR-M16-29). #34.
- **Request:** none.
- **Response:** 200 `{data: SpinPage}` (G:228): `segments[]` (8 fixed: label,type `syiling|nothing`,value,weight,color,icon; labels "1 Syiling", "3 Syiling", "5 Syiling", "10 Syiling", "20 Syiling", "Cuba Lagi", "2 Syiling", "7 Syiling"), `spins`, `won`, `alreadySpun` (spun today, Malaysia day), `canEarnSyiling`.
- **Errors:** 401.
- **Side effects:** none.
- **Owner / handler / client:** M16, `handlers/games.ts:56`, `fetchSpinPage`.
- **Card:** BE-45
- **Contract:** missing

### M16-35 `POST /api/games/roda-nasib/spin`
- **Roles:** any session
- **Auth detail:** `requireAuth()`; one spin per Malaysia day.
- **Purpose:** spin the wheel (#35).
- **Request:** none.
- **Response:** 200 raw `{success:true, message:'', result:{segment_index (0-based), label, icon, type, value}, coinsCredited}`. Segment drawn by weights 25/20/15/8/3/15/10/4 (percent).
- **Errors:** 409 raw `{success:false, message:"Anda sudah spin hari ini."}`; 401.
- **Side effects:** spin row; stats updated; M14 `onGameResult` (game `roda_nasib`, event `spin`, coins = segment value for `syiling`).
- **Owner / handler / client:** M16 (calls M14), `handlers/games.ts:59`, `spinWheel`.
- **Card:** BE-45
- **Contract:** missing

### M16-36 `GET /api/games/jutawan`
- **Roles:** any session
- **Auth detail:** `requireAuth()`.
- **Purpose:** Jutawan Ilmu page (BR-M16-30). #36.
- **Request:** query `darjah` (optional int 1..11).
- **Response:** 200 `{data: JutawanPage}` (G:252): `bestLevel`, `games`; with `darjah` also `heading` ("DARJAH n" 1-6, "TINGKATAN n" 7-11) and `subjects[]` (id,name,emoji,colour,count of questions at that level).
- **Errors:** 422 `VALIDATION_ERROR` "Tahap tidak sah." (`fields.darjah`); 401.
- **Side effects:** none.
- **Owner / handler / client:** M16, `handlers/games.ts:70`, `fetchJutawanPage`.
- **Card:** BE-45
- **Contract:** missing

### M16-37 `POST /api/games/jutawan/start`
- **Roles:** any session
- **Auth detail:** `requireAuth()`. PROVISIONAL game rules.
- **Purpose:** start a Jutawan session of 15 questions.
- **Request:** body `{subject: int, darjah: int 1..11}`.
- **Response:** 200 (not 201) `{data: JutawanStart}` (G:261): `sessionId` (`jut_` + 13 hex), `index` (1), `question` (keyless), `lifelines` (3). Difficulty ladder 1 for Q1-4, 2 for Q5-8, 3 for Q9-12, 4 for Q13-15.
- **Errors:** 422 "Tahap tidak sah." (`darjah`), "Subjek tidak sah." (`subject`), "Soalan tidak mencukupi." (`subject`); 401.
- **Side effects:** inserts a session.
- **Owner / handler / client:** M16, `handlers/games.ts:75`, `startJutawan`.
- **Card:** BE-45
- **Contract:** missing

### M16-38 `POST /api/games/jutawan/:sessionId/answer`
- **Roles:** any session
- **Auth detail:** `requireAuth()`; own session.
- **Purpose:** answer the current question.
- **Request:** path `sessionId`; body `{questionId: int (must be the current one), optionId: int 0..3}`.
- **Response:** 200 `{data: JutawanAnswerResult}` (G:267): `correct`, `level` (questions answered correctly), and either `next` (keyless question) or `result` {level, credited} when the game ends (wrong answer, or level 15).
- **Errors:** 404 `NOT_FOUND` "Sesi tidak dijumpai.", "Soalan tidak dijumpai."; 409 `CONFLICT` "Permainan sudah tamat."; 422 "Soalan tidak sepadan." (`questionId`), "Pilihan tidak sah." (`optionId`); 401.
- **Side effects:** on game end: M14 `onGameResult` (game `jutawan`, event `finish`, coins = 1000 for level 15, 50 for level 10 to 14, else 0 -- PROPOSED ladder), best level and games count updated.
- **Owner / handler / client:** M16 (calls M14), `handlers/games.ts:78`, `answerJutawan`.
- **Card:** BE-45
- **Contract:** missing

### M16-39 `POST /api/games/jutawan/:sessionId/lifeline`
- **Roles:** any session
- **Auth detail:** `requireAuth()`; own session.
- **Purpose:** use the 50:50 lifeline.
- **Request:** path `sessionId`; body `{type: '50:50'}`.
- **Response:** 200 `{data: {removedOptionIds: number[] (2 wrong options), lifelines}}`.
- **Errors:** 422 "Bantuan tidak sah." (`type`); 404 "Sesi tidak dijumpai."; 409 "Permainan sudah tamat.", "Tiada bantuan tersedia." (none left or already used on this question); 401.
- **Side effects:** lifelines - 1; removed options remembered for the current question.
- **Owner / handler / client:** M16, `handlers/games.ts:90`, `lifelineJutawan`.
- **Card:** BE-45
- **Contract:** missing

### M16-40 `GET /api/games/pertandingan`
- **Roles:** any session
- **Auth detail:** `requireAuth()`.
- **Purpose:** weekly competition board (BR-M16-31). #40.
- **Request:** none.
- **Response:** 200 `{data: WeeklyCompetition}` (G:279): `weekStart`, `weekEnd` (dates), `endsAt` (Sunday 23:59:59 +08:00), `prizes` ([100, 50, 25]), `me` ({rank, betul}|null), `rows[]` (top 20: rank,userId,name,sesi,betul,tepat) from M05 weekly practice ranking.
- **Errors:** 401.
- **Side effects:** none.
- **Owner / handler / client:** M16 (reads M05 `weekRank`), `handlers/games.ts:109`, `fetchWeeklyCompetition`.
- **Card:** BE-45
- **Contract:** missing

### M16-41 `GET /api/games/uji-minda`
- **Roles:** any session
- **Auth detail:** `requireAuth()`.
- **Purpose:** Uji Minda placeholder (no challenge exists).
- **Request:** none.
- **Response:** 200 `{data: {challenge: null}}` (constant).
- **Errors:** 401.
- **Side effects:** none.
- **Owner / handler / client:** M16, `handlers/games.ts:112`, `fetchUjiMinda`.
- **Card:** BE-45
- **Contract:** missing

### M16-42 `GET /api/tournaments`
- **Roles:** any session
- **Auth detail:** `requireAuth()`.
- **Purpose:** tournaments list (same active set as M16-01). #42.
- **Request:** none.
- **Response:** 200 `{data: TournamentListItem[]}` (T:198): uuid,title,status (`registration|ongoing`); draft and completed excluded.
- **Errors:** 401.
- **Side effects:** none.
- **Owner / handler / client:** M16, `handlers/tournaments.ts:29`, `fetchTournaments`.
- **Card:** BE-44
- **Contract:** missing

### M16-43 `GET /api/tournaments/form-options`
- **Roles:** admin
- **Auth detail:** `requireRole('admin')`.
- **Purpose:** create-form options (S24). #43.
- **Request:** none.
- **Response:** 200 `{data: TournamentFormOptions}` (T:204): `educationLevels` (`tingkatan4` "Tingkatan 4", `tingkatan5` "Tingkatan 5", `spm` "SPM (Tingkatan 4 & 5)"), `subjects[]` (active subjects id 1..31: id,name,code, sorted by name `ms`), `examPapers` (always `[]`), `spmCounts` (constant map).
- **Errors:** 401, 403.
- **Side effects:** none.
- **Owner / handler / client:** M16 (reads M03), `handlers/tournaments.ts:32`, `fetchTournamentFormOptions`.
- **Card:** BE-44
- **Contract:** missing

### M16-44 `POST /api/tournaments`
- **Roles:** admin
- **Auth detail:** `requireRole('admin')`.
- **Purpose:** create a tournament as draft or open registration (BR-M16-32). #44.
- **Request:** body `TournamentBody` (T:212): `title` (1..255), `description?`, `education_level_id` (`tingkatan4|tingkatan5|spm`), `format` (`single_match|knockout|league|hybrid`), `groups_count` (2..8, required for league/hybrid), `question_mode` (`subject|exam_paper|random_mix`), `subject_id` (1..31, for subject), `mixed_subject_ids` (non-empty valid subject ids, for random_mix), `exam_paper_id` (always refused: no exam paper exists), `total_questions` 5..100, `time_window_minutes` 10..180, `top_n_scoring` 1..50, `min_participants` 1..100, `registration_opens_at`/`registration_closes_at` (local date-time text, closes after opens), `action` (`draft|open_registration`).
- **Response:** **201** `{data: {uuid, status}}` (`draft` or `registration`).
- **Errors:** 422 `VALIDATION_ERROR`, top-level message = first field message, `fields`: `title` "Tajuk tournament diperlukan.", `education_level_id` "Sila pilih tahap pendidikan.", `format` "Format tidak sah.", `groups_count` "Bilangan kumpulan mesti antara 2 dan 8.", `question_mode`/`subject_id`/`exam_paper_id`/`mixed_subject_ids` "Sila pilih sumber soalan.", `total_questions`/`time_window_minutes`/`top_n_scoring`/`min_participants` "Nilai di luar julat.", dates "Tarikh tidak sah." and `registration_closes_at` "Tarikh tutup mesti selepas tarikh buka.", `action` "Tindakan tidak sah."; 401, 403.
- **Side effects:** inserts the tournament (`createdBy` = admin). No scheduling, matches or notifications exist in the mock.
- **Owner / handler / client:** M16, `handlers/tournaments.ts:50`, `createTournament`.
- **Card:** BE-44
- **Contract:** missing

### M16-45 `GET /api/tournaments/:uuid`
- **Roles:** any session
- **Auth detail:** `requireAuth()`; drafts visible to `admin` only (others 404). PROVISIONAL.
- **Purpose:** tournament detail (#45).
- **Request:** path `uuid`.
- **Response:** 200 `{data: TournamentDetail}` (T:232): uuid,title,description,status (`draft|registration|ongoing|completed`, effective status),educationLevelId,format,groupsCount,questionMode,subjectId,examPaperId,mixedSubjectIds,totalQuestions,timeWindowMinutes,topNScoring,minParticipants,registrationOpensAt,registrationClosesAt,liveMatch ({schoolA,schoolB}|null; camelCase here, snake_case in #1),createdAt.
- **Errors:** 404 `NOT_FOUND` "Tournament tidak dijumpai."; 401.
- **Side effects:** none.
- **Owner / handler / client:** M16, `handlers/tournaments.ts:61`, `fetchTournament`.
- **Card:** BE-44
- **Contract:** missing

### M16-46 `GET /api/leagues`
- **Roles:** any session
- **Auth detail:** `requireAuth()`; "mine" uses the caller's school.
- **Purpose:** leagues list (BR-M16-33). #46.
- **Request:** none.
- **Response:** 200 `{data: {mine: LeagueCard[], open: LeagueCard[]}}` (T:256): card id,name,status (`upcoming|ongoing|ended`),statusLabel,scopeLabel,typeLabel,subjectName|null,startDate,endDate,schools (count). `mine` = leagues that include the caller's school; `open` = every league whose status is not `ended`.
- **Errors:** 401.
- **Side effects:** none.
- **Owner / handler / client:** M16, `handlers/leagues.ts:22`, `fetchLeagues`.
- **Card:** BE-45
- **Contract:** missing

### M16-47 `POST /api/leagues`
- **Roles:** any session
- **Auth detail:** `requireAuth()`; any role may create (no role check in the mock).
- **Purpose:** create a league (V-M16-14/15). #47.
- **Request:** body `LeagueBody` (T:292): `name` (1..255), `type` (`friendly|tournament|league`), `scope` (`school|district|state|national`), `subject_id?` (existing subject), `game_mode` (`mixed|quiz|multiplayer`), `class_levels?` (subset of the allowed class levels), `scoring_method` (`total_score|avg_accuracy|wins`), `start_date`, `end_date` (`YYYY-MM-DD`, end not before start), `max_schools?` (2..500).
- **Response:** **201** `{data: {id}}`.
- **Errors:** 422 `VALIDATION_ERROR` (top-level = first message): required-field fields (`name`, `type`, `scope`, `game_mode`, `scoring_method`, `start_date`, `end_date`) = "Sila lengkapkan semua medan wajib."; `end_date` "Tarikh tamat mesti selepas tarikh mula."; `max_schools` "Had sekolah mesti antara 2 dan 500."; `subject_id` "Mata pelajaran tidak sah."; `class_levels` "Tingkatan tidak sah."; 401.
- **Side effects:** league `upcoming` with an 8-character invite code (A-Z0-9); the creator's school (if any) is added as a participant. The mock never moves `status` by date (OQ-API-B4-13).
- **Owner / handler / client:** M16, `handlers/leagues.ts:27`, `createLeague`.
- **Card:** BE-45
- **Contract:** missing

### M16-48 `POST /api/leagues/join`
- **Roles:** any session
- **Auth detail:** `requireAuth()`; the caller's school joins.
- **Purpose:** join by invite code (BR-M16-33). #48.
- **Request:** body `{invite_code: string}` (trimmed, upper-cased).
- **Response:** 200 `{data: {id}}`.
- **Errors:** 422 `VALIDATION_ERROR`, `fields.invite_code` = message: "Kod jemputan tidak sah.", "Liga ini sudah tamat.", "Anda perlu mempunyai sekolah untuk menyertai liga ini.", "Sekolah anda sudah menyertai liga ini.", "Liga ini sudah penuh."; 401.
- **Side effects:** adds the caller's school to the league.
- **Owner / handler / client:** M16, `handlers/leagues.ts:37`, `joinLeague`.
- **Card:** BE-45
- **Contract:** missing

### M16-49 `GET /api/leagues/:id`
- **Roles:** any session
- **Auth detail:** `requireAuth()`; the invite code is visible to non-members (as live).
- **Purpose:** league detail (#49).
- **Request:** path `id` int.
- **Response:** 200 `{data: LeagueDetail}` (T:279): card fields (without `schools` count) + `scoringLabel`, `creatorName`, `classLevels`, `inviteCode`, `shareUrl`, `canJoin` (not ended, caller's school not in, not full), `schools[]` {id,name}, `standings` (map class level -> rows {rank,schoolId,name,ppdState,peserta,skor,purata}; only levels that have rows).
- **Errors:** 404 `NOT_FOUND` "Liga tidak dijumpai."; 401.
- **Side effects:** none.
- **Owner / handler / client:** M16, `handlers/leagues.ts:50`, `fetchLeague`.
- **Card:** BE-45
- **Contract:** missing

### M16-50 `GET /api/sekolah-bersaing`
- **Roles:** any session
- **Auth detail:** `requireAuth()`; matrix row 45 (Admin Sekolah, "Visi & Pertandingan > Sekolah Bersaing") and student/teacher pages (F-62 M,G,AS).
- **Purpose:** weekly school board (BR-M16-35). #50.
- **Request:** query `week` (any text; a valid `YYYY-MM-DD` selects the Monday of that week, anything else the current week).
- **Response:** 200 `{data: SekolahBersaingResult}` (T:306): `weekStart` (Monday), `count`, `rows[]` (rank,schoolName,state,aktifPct,streakAvg,notaPer10,anonymous) in stored rank order; `rows:[]` = empty week. Rows are stored weekly job snapshots (no computation in the mock; the real backend must define the job, OQ-API-B4-14).
- **Errors:** 401.
- **Side effects:** none.
- **Owner / handler / client:** M16, `handlers/leagues.ts:62`, `fetchSekolahBersaing`.
- **Card:** BE-45
- **Contract:** missing

### M16-51 `GET /api/admin/games`
- **Roles:** admin
- **Auth detail:** `requireRole('admin')`.
- **Purpose:** game settings page data (S29, BR-M16-36). #51.
- **Request:** none.
- **Response:** 200 `{data: AdminGames}` (G:290): `stats` {rooms,playing,finished,players (distinct)}, `settings` {boardgameQuizTiles}.
- **Errors:** 401, 403.
- **Side effects:** none.
- **Owner / handler / client:** M16, `handlers/admin-games.ts:13`, `fetchAdminGames`.
- **Card:** BE-45
- **Contract:** missing

### M16-52 `PUT /api/admin/games/settings`
- **Roles:** admin
- **Auth detail:** `requireRole('admin')`.
- **Purpose:** save the Papan Bijak quiz-tile count.
- **Request:** body `{boardgame_quiz_tiles: integer 0..38}` (snake_case in the request, camelCase in the response).
- **Response:** 200 `{data: {boardgameQuizTiles}}`.
- **Errors:** 422 `VALIDATION_ERROR` "Nilai mesti antara 0 dan 38." with `fields.boardgame_quiz_tiles`; 401, 403.
- **Side effects:** updates the setting (plain tiles = 48 - 10 - quiz tiles).
- **Owner / handler / client:** M16, `handlers/admin-games.ts:16`, `saveGameSettings`.
- **Card:** BE-45
- **Contract:** missing


## M09 Content (`m09-content`) - 43 routes

Mock: `src/modules/m09-content/mock/handlers/{articles,support,audio,videos,perutusan,admin-articles,admin-notes,admin-banners,admin-audio,admin-tools,admin-common,common}.ts`; wire types `api/types.ts` (`T:`, reader side) and `api/admin-articles-notes.ts` (`AN:`), `api/admin-media.ts` (`AM:`); clients `api/content.ts`, `api/admin-articles-notes.ts`, `api/admin-media.ts`. SRS `docs/requirements/srs/M09-content.md` (route numbers `#1` to `#43`, used as block ids). Count: the plan (section 6.3) says 25; the mock registers **43** (articles 4, support 2, audio 3, videos 6, perutusan 8, admin-articles 5, admin-notes 5, admin-banners 5, admin-audio 3, admin-tools 2). Card **BE-24** (M09 + M22). The M09 articles repository is also called by the M10 teacher-article form (M10 routes, other parts of this catalogue).

Module conventions:

- Guards: **public** (no guard, a session is read if sent): #6 to #9, #27, #28, #40, #43. `requireAuth()`: #20, #24 to #26, #29 to #39 except #40 (so #29 to #32 are any session; #30/#31 additionally uploader-or-admin), #33 to #39. `adminOnly` = `requireRole('admin')` (401 / 403 "This action is unauthorized."): #1 to #5, #10 to #19, #21 to #23, #41, #42.
- Mutating responses carry an extra top-level key **`status`** next to `data` (flash text, PROPOSED COPY, SRS 8.2): `{data, status: "<BM>"}`. The client reads them with `raw: true`. Deletes answer 200 `{data: {deleted: 1}, status}` (no 204). Create answers 201.
- Ids are integers (mock) / opaque strings (contract, OQ-API-B4-1). Slugs are strings. Datetimes ISO `+08:00`.
- Admin body validation (`handlers/admin-*.ts` `parse()`): collects all failing fields, `422 VALIDATION_ERROR`, `fields[name]`, top-level message = first field message + " (and N more error(s))" when more than one (the default `validationError(fields)`). Field copy: missing `Medan ini diperlukan.`, invalid `Medan ini tidak sah.`. Blank strings are trimmed to null. On PUT a field absent from the body keeps its stored value; a sent blank text field clears it. Camel-case field names; some routes also accept the snake_case spelling (audio).
- Refusal mapping for reader writes (`handlers/common.ts:69 refusal`): `NOT_FOUND` 404 (message), `FORBIDDEN` 403 (message), `VALIDATION_ERROR` 422 with `fields[<field or 'form'>]` = message and the same top-level message, anything else 409.
- 404 for missing ids: `notFound()` default "Not Found." on reader routes; admin routes use the exact flash text: "Artikel tidak dijumpai.", "Nota tidak dijumpai.", "Banner tidak dijumpai." (`admin-common.ts:108`).
- Long text limits (INFERRED hardening, `admin-common.ts:253`): article/note content 200,000 chars; audio question text 2,000, option 500, explanation 2,000, instructions 5,000; banner description 5,000.
- HTML bodies (`article.content`, `perutusan.body`, notes content) are stored and returned as HTML. BE-24 AC 2 requires server-side sanitisation on write; the mock does not sanitise (OQ-API-B4-15).
- Contract status for all M09 routes: **missing**.
- Role-access matrix: Murid rows 7 (Video), 20 (Artikel), 27 (Audio KBAT); Guru row 7 (Video); Admin Sekolah row 7 (Video). Perutusan write is `school_admin` and `admin` only (compose context). Admin routes belong to Portal Pentadbiran (D48).

### M09-01 `GET /api/admin/articles`
- **Roles:** admin
- **Auth detail:** `adminOnly`.
- **Purpose:** S1 article admin list (all statuses).
- **Request:** query `search` (title contains, case-insensitive), `category` (`ARTICLE_CATEGORIES` code or `all`; unknown = empty), `published` (`1` / `0`, else all), `page`. Page size fixed **20**; order `createdAt` desc then id asc.
- **Response:** 200 `{data: AdminArticleItem[], meta: ListMeta}` (AN:): id,title,category,categoryLabel,gradeLevel,isPublished,isFeatured,views,createdAt,author {id,name}.
- **Errors:** 401, 403.
- **Side effects:** none.
- **Owner / handler / client:** M09, `handlers/admin-articles.ts:148`, `fetchAdminArticles`.
- **Card:** BE-24
- **Contract:** missing

### M09-02 `GET /api/admin/articles/:id`
- **Roles:** admin
- **Auth detail:** `adminOnly`.
- **Purpose:** S3/S4 article edit/view.
- **Request:** path `id` int.
- **Response:** 200 `{data: AdminArticleDetail}` (AN:): id,title,slug,excerpt|null,content (HTML),featuredImage|null,youtubeUrl|null,category,gradeLevel,isPublished,isFeatured,views,likes,authorId,publishedAt|null,createdAt,updatedAt + `categoryLabel`, `gradeLabel`, `author` {id,name}, `attachments[]` {id,fileName,label|null,size}.
- **Errors:** 404 `NOT_FOUND` "Artikel tidak dijumpai."; 401, 403.
- **Side effects:** none.
- **Owner / handler / client:** M09, `handlers/admin-articles.ts:166`, `fetchAdminArticle`.
- **Card:** BE-24
- **Contract:** missing

### M09-03 `POST /api/admin/articles`
- **Roles:** admin
- **Auth detail:** `adminOnly`; the author is the session user.
- **Purpose:** create an article (S2).
- **Request:** body `{title (required, <= 255), excerpt? (<= 500), content (required, <= 200000), featuredImage? (http/https URL <= 2048), category (required, one of TIPS_BELAJAR|BERITA|MOTIVASI|PANDUAN_IBU_BAPA|PANDUAN_GURU|KEJAYAAN|UMUM), gradeLevel? (SEMUA|DARJAH_1..6, default SEMUA), isPublished? (default false), isFeatured? (default false)}`. Attachments and `youtubeUrl` are not accepted here (BR-M09-34).
- **Response:** **201** `{data: AdminArticleDetail, status: "Artikel berjaya ditambah."}`.
- **Errors:** 422 `VALIDATION_ERROR` (fields as conventions); 401, 403.
- **Side effects:** slug = `Str::slug(title)` made unique with a numeric suffix (BR-M09-08), never changes on edit; `publishedAt` = now if created published; `views`/`likes` 0.
- **Owner / handler / client:** M09, `handlers/admin-articles.ts:177`, `createAdminArticle`.
- **Card:** BE-24
- **Contract:** missing

### M09-04 `PUT /api/admin/articles/:id`
- **Roles:** admin
- **Auth detail:** `adminOnly`.
- **Purpose:** update an article (S3).
- **Request:** path `id`; body as M09-03, absent fields keep their value.
- **Response:** 200 `{data: AdminArticleDetail, status: "Artikel berjaya dikemaskini."}`.
- **Errors:** 404 "Artikel tidak dijumpai."; 422 as M09-03; 401, 403.
- **Side effects:** `publishedAt` set at first publish only (kept after unpublish); `updatedAt` = now; slug unchanged.
- **Owner / handler / client:** M09, `handlers/admin-articles.ts:184`, `updateAdminArticle`.
- **Card:** BE-24
- **Contract:** missing

### M09-05 `DELETE /api/admin/articles/:id`
- **Roles:** admin
- **Auth detail:** `adminOnly`.
- **Purpose:** delete an article and its attachment rows.
- **Request:** path `id`.
- **Response:** 200 `{data: {deleted: 1}, status: "Artikel berjaya dipadam."}`.
- **Errors:** 404 "Artikel tidak dijumpai."; 401, 403.
- **Side effects:** hard delete (attachments removed; stored files per BE-04).
- **Owner / handler / client:** M09, `handlers/admin-articles.ts:205`, `deleteAdminArticle`.
- **Card:** BE-24
- **Contract:** missing

### M09-06 `GET /api/articles`
- **Roles:** public
- **Auth detail:** no guard (guests allowed); only published articles are ever returned (BR-M09-02).
- **Purpose:** S15 reader list.
- **Request:** query `search` (title contains), `category` (code or `all`; unknown code = empty), `page`. Page size fixed **18**; order `publishedAt` desc then id asc.
- **Response:** 200 `{data: ArticleCard[], meta: ListMeta}` (T:19): id,slug,title,excerpt|null,category,categoryLabel,isFeatured,views,publishedAt|null,author {name,initial}.
- **Errors:** none besides generic.
- **Side effects:** none.
- **Owner / handler / client:** M09, `handlers/articles.ts:26`, `fetchArticles`.
- **Card:** BE-24
- **Contract:** missing

### M09-07 `GET /api/articles/hot`
- **Roles:** public
- **Auth detail:** no guard.
- **Purpose:** "Hot" strip (BR-M09-05).
- **Request:** none.
- **Response:** 200 `{data: HotCard[], meta: unpaged}` (T:33): ArticleCard + `badge` (`PILIHAN` if featured else `POPULAR`). 6 cards drawn at random without replacement from featured published articles plus the 10 most-viewed non-featured published ones (the mock draws with a seeded stream; the real backend may use any random draw, order is the draw order). `meta` = `{page:1, pageSize:max(1,n), totalItems:n, totalPages:1, from, to}`.
- **Errors:** none.
- **Side effects:** none.
- **Owner / handler / client:** M09, `handlers/articles.ts:42`, `fetchHotArticles`.
- **Card:** BE-24
- **Contract:** missing

### M09-08 `GET /api/articles/:slug`
- **Roles:** public
- **Auth detail:** no guard; unpublished is 404. Static path `latest` wins over `:slug`.
- **Purpose:** S16 article page.
- **Request:** path `slug`.
- **Response:** 200 `{data: ArticleDetail}` (T:38): ArticleCard + `content` (HTML), `gradeLevel`, `gradeLabel`, `likes`, `related[]` (up to 3 other published articles of the same category, reader order). `views` already includes this open.
- **Errors:** 404 `NOT_FOUND` "Not Found." (unknown or unpublished).
- **Side effects:** **increments `views` by 1 on every read** (BR-M09-07, no de-duplication, guests included).
- **Owner / handler / client:** M09, `handlers/articles.ts:51`, `fetchArticle`.
- **Card:** BE-24
- **Contract:** missing

### M09-09 `GET /api/articles/latest`
- **Roles:** public
- **Auth detail:** no guard.
- **Purpose:** latest published articles (M05 dashboard strip, S16 aside; BR-M09-06).
- **Request:** query `limit` (int, default 5, clamped 1..50).
- **Response:** 200 `{data: ArticleCard[], meta: unpaged}` newest first.
- **Errors:** none.
- **Side effects:** none.
- **Owner / handler / client:** M09, `handlers/articles.ts:46`, `fetchLatestArticles`.
- **Card:** BE-24
- **Contract:** missing

### M09-10 `GET /api/admin/notes`
- **Roles:** admin
- **Auth detail:** `adminOnly`. There is no notes reader in the mock (FR-M09-50).
- **Purpose:** S5 notes list.
- **Request:** query `search`, `subject` (code or `all`), `noteType` (S5 filter values `summary|mind_map|flashcard|cheat_sheet|full_notes`, DV-M09-06; `all`), `page`. Page size **20**.
- **Response:** 200 `{data: AdminNoteItem[], meta: ListMeta}`: id,title,summary|null,subject,subjectLabel,noteType,grade,gradeLabel ("Darjah n"),isPublished,views,downloads,author {id,name},createdAt,updatedAt.
- **Errors:** 401, 403.
- **Side effects:** none.
- **Owner / handler / client:** M09, `handlers/admin-notes.ts:158`, `fetchAdminNotes`.
- **Card:** BE-24
- **Contract:** missing

### M09-11 `GET /api/admin/notes/:id`
- **Roles:** admin
- **Auth detail:** `adminOnly`.
- **Purpose:** S7/S8 note detail.
- **Request:** path `id`.
- **Response:** 200 `{data: AdminNoteDetail}` = list item + `content`.
- **Errors:** 404 `NOT_FOUND` "Nota tidak dijumpai."; 401, 403.
- **Side effects:** none.
- **Owner / handler / client:** M09, `handlers/admin-notes.ts:170`, `fetchAdminNote`.
- **Card:** BE-24
- **Contract:** missing

### M09-12 `POST /api/admin/notes`
- **Roles:** admin
- **Auth detail:** `adminOnly`; author = session user.
- **Purpose:** create a note (S6).
- **Request:** body `{title (required <= 255), summary? (<= 1000), content (required), subject (matematik|sains|bahasa_melayu|bahasa_inggeris|sejarah, lower-cased), noteType (FORMULA|RINGKASAN|LENGKAP|TIPS_TRICKS, upper-cased), grade (DARJAH_1..DARJAH_6, upper-cased), isPublished? (default false)}`.
- **Response:** **201** `{data: AdminNoteDetail, status: "Nota berjaya ditambah."}`.
- **Errors:** 422 (`Medan ini diperlukan.` for a missing subject/noteType/grade; `Medan ini tidak sah.` for an unknown value); 401, 403.
- **Side effects:** insert; `views`/`downloads` start 0.
- **Owner / handler / client:** M09, `handlers/admin-notes.ts:181`, `createAdminNote`.
- **Card:** BE-24
- **Contract:** missing

### M09-13 `PUT /api/admin/notes/:id`
- **Roles:** admin
- **Auth detail:** `adminOnly`.
- **Purpose:** update a note (S7).
- **Request:** path `id`; body as M09-12, absent fields keep their value.
- **Response:** 200 `{data: AdminNoteDetail, status: "Nota berjaya dikemaskini."}`.
- **Errors:** 404 "Nota tidak dijumpai."; 422; 401, 403.
- **Side effects:** `updatedAt`.
- **Owner / handler / client:** M09, `handlers/admin-notes.ts:188`, `updateAdminNote`.
- **Card:** BE-24
- **Contract:** missing

### M09-14 `DELETE /api/admin/notes/:id`
- **Roles:** admin
- **Auth detail:** `adminOnly`.
- **Purpose:** delete a note.
- **Request:** path `id`.
- **Response:** 200 `{data: {deleted: 1}, status: "Nota berjaya dipadam."}`.
- **Errors:** 404 "Nota tidak dijumpai."; 401, 403.
- **Side effects:** hard delete.
- **Owner / handler / client:** M09, `handlers/admin-notes.ts:203`, `deleteAdminNote`.
- **Card:** BE-24
- **Contract:** missing

### M09-15 `GET /api/admin/banners`
- **Roles:** admin
- **Auth detail:** `adminOnly`.
- **Purpose:** S9 banner list (all, unpaged).
- **Request:** none.
- **Response:** 200 `{data: AdminBanner[], meta: unpaged}` (AM:) ordered `displayOrder` asc then id: id,title,description|null,imageUrl|null,bannerType,linkType,externalUrl|null,targetAudience,displayOrder,startDate|null,endDate|null (YYYY-MM-DD),isActive,createdAt,updatedAt. Codes stored upper case (seed may hold legacy `FEATURE`/`PROMOTIONAL`).
- **Errors:** 401, 403.
- **Side effects:** none.
- **Owner / handler / client:** M09, `handlers/admin-banners.ts:158`, `fetchAdminBanners`.
- **Card:** BE-24
- **Contract:** missing

### M09-16 `GET /api/admin/banners/:id`
- **Roles:** admin
- **Auth detail:** `adminOnly`.
- **Purpose:** S11 banner edit.
- **Request:** path `id`.
- **Response:** 200 `{data: AdminBanner}`.
- **Errors:** 404 `NOT_FOUND` "Banner tidak dijumpai."; 401, 403.
- **Side effects:** none.
- **Owner / handler / client:** M09, `handlers/admin-banners.ts:160`, `fetchAdminBanner`.
- **Card:** BE-24
- **Contract:** missing

### M09-17 `POST /api/admin/banners`
- **Roles:** admin
- **Auth detail:** `adminOnly`.
- **Purpose:** create a banner (S10).
- **Request:** body `{title (required <= 255), description? (<= 5000), imageUrl? (http/https URL <= 2048), bannerType (required; HERO|PROMO|ANNOUNCEMENT|EVENT), linkType? (NONE|SUBJECT|QUIZ|ARTICLE|EXTERNAL, default NONE), externalUrl (required URL when linkType = EXTERNAL, ignored otherwise), targetAudience? (ALL|STUDENT|TEACHER|ADMIN, default ALL), displayOrder? (int >= 0, default 0), startDate?, endDate? (YYYY-MM-DD real dates, end not before start), isActive? (default true)}` (codes upper-cased).
- **Response:** **201** `{data: AdminBanner, status: "Banner berjaya ditambah."}`.
- **Errors:** 422 (conventions; `externalUrl` required for EXTERNAL); 401, 403.
- **Side effects:** insert.
- **Owner / handler / client:** M09, `handlers/admin-banners.ts:171`, `createBanner`.
- **Card:** BE-24
- **Contract:** missing

### M09-18 `PUT /api/admin/banners/:id`
- **Roles:** admin
- **Auth detail:** `adminOnly`.
- **Purpose:** update a banner (S11). Accepts the banner's own stored code even if it is not a form option (BR-M09-13, DV-M09-07), so seeded `FEATURE`/`PROMOTIONAL` banners can be saved unchanged.
- **Request:** path `id`; body as M09-17, absent fields keep their value.
- **Response:** 200 `{data: AdminBanner, status: "Banner berjaya dikemaskini."}`.
- **Errors:** 404 "Banner tidak dijumpai."; 422; 401, 403.
- **Side effects:** `updatedAt`.
- **Owner / handler / client:** M09, `handlers/admin-banners.ts:177`, `updateBanner`.
- **Card:** BE-24
- **Contract:** missing

### M09-19 `DELETE /api/admin/banners/:id`
- **Roles:** admin
- **Auth detail:** `adminOnly`.
- **Purpose:** delete a banner.
- **Request:** path `id`.
- **Response:** 200 `{data: {deleted: 1}, status: "Banner berjaya dipadam."}`.
- **Errors:** 404 "Banner tidak dijumpai."; 401, 403.
- **Side effects:** hard delete.
- **Owner / handler / client:** M09, `handlers/admin-banners.ts:192`, `deleteBanner`.
- **Card:** BE-24
- **Contract:** missing

### M09-20 `GET /api/banners/active`
- **Roles:** any session
- **Auth detail:** `requireAuth()`; filtered by the caller's role.
- **Purpose:** dashboard carousel banners (BR-M09-14, M05 input).
- **Request:** none.
- **Response:** 200 `{data: ActiveBanner[], meta: unpaged}` (T:55): `{type (= bannerType), title, description|null}`. Included banners: `isActive`, today (Malaysia) within `startDate`..`endDate` (null = open), and audience `ALL`, or equal to the caller's role mapped student->STUDENT, teacher->TEACHER, admin->ADMIN; **admin receives every audience**; other roles (school_admin, parent, ...) receive only `ALL`. Order `displayOrder`, id.
- **Errors:** 401.
- **Side effects:** none.
- **Owner / handler / client:** M09, `handlers/support.ts:12`, `fetchActiveBanners`.
- **Card:** BE-24
- **Contract:** missing

### M09-21 `GET /api/admin/audio-kbat-sets`
- **Roles:** admin
- **Auth detail:** `adminOnly`.
- **Purpose:** S12 Audio KBAT sets admin list.
- **Request:** query `educationLevelId`, `subjectId` (ints), `status` (`draft|pending_review|approved|archived`; unknown ignored), `search`, `page`, `pageSize` (default 20, max 100).
- **Response:** 200 `{data: AdminAudioSetItem[], meta}` (AM:): id,title,educationLevel {id,name},subject {id,name},status,statusLabel ("Draft","Pending Review","Approved","Archived"),questionCount; `meta` = list meta + `stats` {sets,approved,draftPending,questions} counted over **all** sets (never the filtered ones).
- **Errors:** 401, 403.
- **Side effects:** none.
- **Owner / handler / client:** M09, `handlers/admin-audio.ts:252`, `fetchAdminAudioSets`.
- **Card:** BE-24 (`/admin/audio-kbat-sets`)
- **Contract:** missing

### M09-22 `GET /api/admin/audio-kbat-sets/template`
- **Roles:** admin
- **Auth detail:** `adminOnly`. Registered before `/:id`-style paths.
- **Purpose:** download the set template (XLSX/Word). Placeholder text files in the mock (OQ-M09-03).
- **Request:** query `format` (`xlsx` default, `docx`).
- **Response:** 200 **binary file** (not JSON): `template-audio-kbat.xlsx` (`application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`) or `template-audio-kbat.docx`, with `Content-Disposition: attachment`.
- **Errors:** 422 `VALIDATION_ERROR` `fields.format` "Medan ini tidak sah."; 401, 403.
- **Side effects:** none.
- **Owner / handler / client:** M09, `handlers/admin-audio.ts:276`, `fetchAudioTemplate`.
- **Card:** BE-24 (`+ /admin/audio-kbat-sets/template`)
- **Contract:** missing

### M09-23 `POST /api/admin/audio-kbat-sets`
- **Roles:** admin
- **Auth detail:** `adminOnly`; creator = session user.
- **Purpose:** create an Audio KBAT set of exactly 4 sections and 30 questions (S13). **Multipart** (section audio files) or JSON.
- **Request:** `title` (required <= 255), `educationLevelId` (required, existing M03 level), `subjectId` (required, existing M03 subject), `status?` (`approved` default | `pending_review` | `draft`; no `archived`), `sourceLabel?` (<= 255), `instructions?` (<= 5000); 4 sections as `sections[n][title|audio|transcript]` (n 1..4; title default `Audio n`; audio file `.mp3|.m4a|.wav|.ogg|.aac|.mp4`, declared type `audio/*` or `video/mp4`, <= 20 MB); 30 questions as `questions[n][questionText|optionA..optionD (required <= 500)|correctAnswer (A-D, required)|marks (1..20, default 1)|kbatLevel (1..5, default 3)|dskpSpId? (int >= 1)|explanation? (<= 2000)]`. The question ranges per section come from `SECTION_RANGES` (`repository/audio-support.ts`). JSON bodies may send `sections`/`questions` as arrays or objects keyed by n; snake_case spellings (`education_level_id`, `question_text`, `option_a`, `correct_answer`, `kbat_level`, `dskp_sp_id`) are accepted.
- **Response:** **201** `{data: {id,title,educationLevel,subject,status,statusLabel,questionCount,sourceLabel,instructions,sections[],createdAt}, status: "Set Audio KBAT berjaya disimpan."}`; `sections[]` {no,title,audioFileName|null,transcript|null,questionFrom,questionTo}.
- **Errors:** 422 `VALIDATION_ERROR` with dotted field keys (`sections.2.audio` = "{file}: format atau saiz tidak dibenarkan.", `questions.5.optionA` = "Medan ini diperlukan.", ...); repository 422 "Set mesti mempunyai 4 bahagian dan 30 soalan."; 401, 403.
- **Side effects:** insert set, sections, questions; audio files stored through BE-04 (the mock keeps only a sanitised file name).
- **Owner / handler / client:** M09, `handlers/admin-audio.ts:297`, `createAudioSet`.
- **Card:** BE-24 (+ BE-04 for files)
- **Contract:** missing

### M09-24 `GET /api/audio-kbat-sets`
- **Roles:** any session
- **Auth detail:** `requireAuth()`; only `approved` sets.
- **Purpose:** S21 student list of sets.
- **Request:** query `educationLevelId`, `subjectId` (ints).
- **Response:** 200 `{data: AudioSetListItem[], meta: unpaged}` (T:63): id,title,educationLevel {id,name},subject {id,name}.
- **Errors:** 401.
- **Side effects:** none.
- **Owner / handler / client:** M09, `handlers/audio.ts:87`, `fetchAudioSets`.
- **Card:** BE-24 ("set listing")
- **Contract:** missing

### M09-25 `GET /api/audio-kbat-sets/:id`
> **D53(a): Audio KBAT student play moves into BE-24.**
- **Roles:** any session
- **Auth detail:** `requireAuth()`; non-approved sets answer 404. Provisional player (L-3).
- **Purpose:** the player data of one set.
- **Request:** path `id`.
- **Response:** 200 `{data: AudioSetDetail}` (T:86): id,title,instructions|null,`sections[]` {no,title,audioUrl|null (`/storage/audio-kbat/{setId}/{file}` in the mock),`questions[]` {no,questionText,options {A,B,C,D},marks}}. Never returns correct answers or explanations.
- **Errors:** 404 `NOT_FOUND` "Not Found."; 401.
- **Side effects:** none.
- **Owner / handler / client:** M09, `handlers/audio.ts:97`, `fetchAudioSet`.
- **Card:** BE-24
- **Contract:** missing

### M09-26 `POST /api/audio-kbat-sets/:id/attempts`
> **D53(a): Audio KBAT student play moves into BE-24.**
- **Roles:** any session
- **Auth detail:** `requireAuth()`; approved sets only.
- **Purpose:** submit an attempt and get the score (provisional).
- **Request:** path `id`; body `{answers: [{no: int 1..30, choice: 'A'|'B'|'C'|'D'}]}` (required, no duplicate `no`).
- **Response:** **201** `{data: {score, totalMarks}}` (T:97): sum of `marks` of correctly answered questions / sum of all marks.
- **Errors:** 404 "Not Found." (unknown or not approved); 422 `VALIDATION_ERROR` `fields.answers` "Medan ini diperlukan." (missing) or "Medan ini tidak sah." (malformed); 401.
- **Side effects:** stores an attempt row (answers, score, totalMarks, submittedAt). No ledger or streak effect.
- **Owner / handler / client:** M09, `handlers/audio.ts:108`, `submitAudioAttempt`.
- **Card:** BE-24
- **Contract:** missing

### M09-27 `GET /api/videos`
- **Roles:** public
- **Auth detail:** no guard; a guest sees `global` videos only; a signed-in non-admin also sees `school` videos of the same school (the "video-form school", see M09-32); admin sees all (BR-M09-19).
- **Purpose:** S17 video library.
- **Request:** query `search` (title contains), `category` (`motivasi|tutorial|tips-spm|ceramah|lain-lain` or `all`), `subject` (int subject id), `page`. Page size fixed **24**; order newest first (`listKey` then id desc).
- **Response:** 200 `{data: VideoCard[], meta}` (T:118): id,title,platformLabel,thumbnailUrl|null,views,createdAt,uploader {name,initial,roleLabel}; `meta` = list meta + `facets` {total, categories[{code,label,count}] (all 5, 0 included, counted under the search and subject filters), subjects[{id,name,count}] (only subjects with count > 0, in id order, counted under search and category)}.
- **Errors:** none.
- **Side effects:** none.
- **Owner / handler / client:** M09, `handlers/videos.ts:143`, `fetchVideos`.
- **Card:** BE-24
- **Contract:** missing

### M09-28 `GET /api/videos/:id`
- **Roles:** public
- **Auth detail:** no guard; same visibility as M09-27 (an invisible video is 404).
- **Purpose:** S18 video page and S19 edit-form load.
- **Request:** path `id`; query `for=edit` (the same body without counting a view).
- **Response:** 200 `{data: VideoDetail}` (T:151): VideoCard + `videoUrl`, `embedUrl|null`, `platform` ("Youtube","Vimeo","Dailymotion","TikTok","Facebook","Other"), `description|null`, `category`, `categoryLabel`, `subject` ({id,name}|null), `visibility` (`global|school`), `canManage` (uploader or admin), `related[]` (VideoCard, max 6). `views` shows the count before this open.
- **Errors:** 404 `NOT_FOUND` "Not Found."
- **Side effects:** `views + 1` after the response is built, unless `for=edit` (BR-M09-07).
- **Owner / handler / client:** M09, `handlers/videos.ts:184`, `fetchVideo`.
- **Card:** BE-24
- **Contract:** missing

### M09-29 `POST /api/videos`
- **Roles:** any session
- **Auth detail:** `requireAuth()`; any role may upload (card AC 5 mentions a teacher approval state; the mock has none, OQ-API-B4-16).
- **Purpose:** publish a video link (S20).
- **Request:** body `{videoUrl (required string, http/https URL <= 2048), title (required <= 255), description? (<= 1000), category (required; motivasi|tutorial|tips-spm|ceramah|lain-lain), subjectId? (existing M03 subject), visibility (required; global|school)}`.
- **Response:** **201** `{data: VideoDetail, status: "Video berjaya diterbitkan."}`.
- **Errors:** 422 `VALIDATION_ERROR` (`Medan ini diperlukan.` / `Medan ini tidak sah.`); 422 "Anda tiada sekolah untuk dikongsi." with `fields.visibility` when `school` is chosen and the uploader has no video-form school; 401.
- **Side effects:** platform, external id and thumbnail are parsed from the URL (YouTube watch/embed/shorts/youtu.be, Vimeo, Dailymotion; TikTok/Facebook recognised without embed; else Other); `schoolId` = the uploader's video-form school when `school`.
- **Owner / handler / client:** M09, `handlers/videos.ts:200`, `createVideo`.
- **Card:** BE-24
- **Contract:** missing

### M09-30 `PUT /api/videos/:id`
- **Roles:** any session (uploader or admin)
- **Auth detail:** `requireAuth()`; invisible video 404; not uploader and not admin 403.
- **Purpose:** edit a video (S19).
- **Request:** path `id`; body as M09-29 (all required fields again).
- **Response:** 200 `{data: VideoDetail, status: "Video berjaya dikemaskini."}`.
- **Errors:** 404 "Not Found."; 403 `FORBIDDEN` "This action is unauthorized."; 422 as M09-29; 403 "Anda tidak dibenarkan mengubah video ini." (repository, race); 401.
- **Side effects:** update, re-parse URL, `updatedAt`.
- **Owner / handler / client:** M09, `handlers/videos.ts:214`, `updateVideo`.
- **Card:** BE-24
- **Contract:** missing

### M09-31 `DELETE /api/videos/:id`
- **Roles:** any session (uploader or admin)
- **Auth detail:** `requireAuth()`; as M09-30.
- **Purpose:** delete a video.
- **Request:** path `id`.
- **Response:** 200 `{data: {deleted: 1}, status: "Video berjaya dipadam."}`.
- **Errors:** 404, 403 as M09-30 ("Anda tidak dibenarkan memadam video ini."); 401.
- **Side effects:** hard delete.
- **Owner / handler / client:** M09, `handlers/videos.ts:237`, `deleteVideo`.
- **Card:** BE-24
- **Contract:** missing

### M09-32 `GET /api/videos/form-context`
- **Roles:** any session
- **Auth detail:** `requireAuth()`. Registered before `/:id` (a static path beats the param).
- **Purpose:** uploader and school shown on the video form (BR-M09-21).
- **Request:** none.
- **Response:** 200 `{data: VideoFormContext}` (T:174): `uploader` {name,initial,roleLabel}, `school` ({id,name}|null). The school is the "video-form school" (table `videoSchools`, one row per user), **not** the profile school (OQ-API-B4-17: the real backend needs a rule to fill it).
- **Errors:** 401.
- **Side effects:** none.
- **Owner / handler / client:** M09, `handlers/videos.ts:174`, `fetchVideoFormContext`.
- **Card:** BE-24
- **Contract:** missing

### M09-33 `GET /api/perutusan`
- **Roles:** any session
- **Auth detail:** `requireAuth()`; visibility BR-M09-23: posts that are `published`, or `scheduled` and due, and that are national, or belong to the viewer's school, or are the viewer's own, or the viewer is admin.
- **Purpose:** S22 perutusan feed (pinned first, then newest effective time, then id).
- **Request:** none (unpaged).
- **Response:** 200 `{data: PerutusanCard[], meta: unpaged}` (T:190): id,title,excerpt (HTML stripped, 250 chars + "..."),isPinned,hasVideo,scopeLabel ("Seluruh Malaysia (Kebangsaan)" or the school name),createdAt,author {name,initials,roleLabel ("Pengetua" for school_admin, "Admin" for admin, else '')},topReaction ({type,emoji,count}|null),commentCount (approved only),reads.
- **Errors:** 401.
- **Side effects:** none.
- **Owner / handler / client:** M09, `handlers/perutusan.ts:224`, `fetchPerutusan`.
- **Card:** BE-24
- **Contract:** missing

### M09-34 `GET /api/perutusan/mine`
- **Roles:** any session
- **Auth detail:** `requireAuth()`; own posts, all statuses.
- **Purpose:** S25 the author's posts.
- **Request:** none.
- **Response:** 200 `{data: OwnPerutusanItem[], meta: unpaged}` (T:222): id,title,status (`published|scheduled|draft`),statusLabel ("Diterbitkan","Dijadualkan","Draf"),createdAt.
- **Errors:** 401.
- **Side effects:** none.
- **Owner / handler / client:** M09, `handlers/perutusan.ts:228`, `fetchMyPerutusan`.
- **Card:** BE-24
- **Contract:** missing

### M09-35 `GET /api/perutusan/:id`
- **Roles:** any session
- **Auth detail:** `requireAuth()`; visible posts, or a non-published post for its author and admin; anything else 404 (never 403).
- **Purpose:** S23 post page.
- **Request:** path `id`.
- **Response:** 200 `{data: PerutusanDetail + reads}` (T:210): card fields + `body` (HTML), `youtubeEmbedUrl|null`, `images[]`/`documents[]` {fileName,size}, `isPublic`, `publicUrl` (`/perutusan/awam/{id}` only for a public published post, else null), `reactions` {like,love,thanks}, `myReactions[]`, `canWrite` (author or admin), `reads` (includes this open).
- **Errors:** 404 `NOT_FOUND` "Not Found."; 401.
- **Side effects:** **read counting**: a signed-in viewer who is neither admin nor the author counts once per post (`reads + 1`, one read row per user and post).
- **Owner / handler / client:** M09, `handlers/perutusan.ts:245`, `fetchPerutusanDetail`.
- **Card:** BE-24
- **Contract:** missing

### M09-36 `GET /api/perutusan/compose-context`
- **Roles:** any session
- **Auth detail:** `requireAuth()`. Registered before `/:id`.
- **Purpose:** what the viewer may write (S24).
- **Request:** none.
- **Response:** 200 `{data: ComposeContext}` (T:231): admin -> `{scope:'national', scopeLabel:'Seluruh Malaysia (Kebangsaan)', canWrite:true}`; school_admin -> `{scope:'school', scopeLabel:<school name or 'Sekolah'>, canWrite:true}`; other roles -> `{scope:null, scopeLabel:'', canWrite:false}`.
- **Errors:** 401.
- **Side effects:** none.
- **Owner / handler / client:** M09, `handlers/perutusan.ts:243`, `fetchComposeContext`.
- **Card:** BE-24
- **Contract:** missing

### M09-37 `POST /api/perutusan`
- **Roles:** admin, school_admin
- **Auth detail:** `requireAuth()` then role check inside the handler: other roles get 403 `FORBIDDEN` "This action is unauthorized." (BR-M09-22, INFERRED OQ-M09-05). **Multipart** (files).
- **Purpose:** create a post (S24).
- **Request:** `title` (required <= 255), `body?` (string), `status` (required; `published|scheduled|draft`), `scheduledAt?` (local date-time; only used when `scheduled`; must be in the future; offset-less values are Malaysia time), `youtubeUrl?` (must parse as a YouTube URL), `isPinned?`, `isPublic?` (booleans: true/1/"1"/"true"/"on"/"yes"), `images[]` (JPG/PNG/GIF <= 2 MB each), `documents[]` (PDF <= 5 MB each).
- **Response:** **201** `{data: PerutusanDetail, status: "Perutusan berjaya dihantar."}` (published) / `"Perutusan dijadualkan."` (scheduled) / `"Draf perutusan disimpan."` (draft).
- **Errors:** 422 `VALIDATION_ERROR` fields `title`/`status` "Medan ini diperlukan.", invalid "Medan ini tidak sah.", `scheduledAt` "Medan ini tidak sah.", `images`/`documents` "{file}: format atau saiz tidak dibenarkan."; 422 "Maksimum 2 perutusan boleh disematkan." (`fields.isPinned`; at most 2 pinned published-or-scheduled posts per scope: national, or per school; drafts do not count); 422 "Pentadbir sekolah mesti mempunyai sekolah." (`fields.form`); 403; 401.
- **Side effects:** scope national (admin) or school (school_admin's school); file names/sizes stored (files via BE-04 in the real backend).
- **Owner / handler / client:** M09, `handlers/perutusan.ts:262`, `createPerutusan`.
- **Card:** BE-24
- **Contract:** missing

### M09-38 `POST /api/perutusan/:id/reactions`
- **Roles:** any session
- **Auth detail:** `requireAuth()`; post must be visible to the caller (else 404).
- **Purpose:** toggle a reaction (BR-M09-25).
- **Request:** path `id`; body `{type: 'like'|'love'|'thanks'}`.
- **Response:** 200 `{data: ReactionResult}` (T:250): `reactions` {like,love,thanks}, `myReactions[]`. Posting the same type again removes it.
- **Errors:** 404 "Not Found."; 422 `fields.type` "Medan ini diperlukan." / "Medan ini tidak sah."; 401.
- **Side effects:** insert/delete the (post, user, type) reaction row.
- **Owner / handler / client:** M09, `handlers/perutusan.ts:264`, `reactToPerutusan`.
- **Card:** BE-24
- **Contract:** missing

### M09-39 `POST /api/perutusan/:id/comments`
- **Roles:** any session
- **Auth detail:** `requireAuth()`; visible post only.
- **Purpose:** comment on a post (BR-M09-26).
- **Request:** path `id`; body `{body: string, 1..1000 chars}`.
- **Response:** **201** `{data: {id, status: 'pending'}, status: "Komen anda telah dihantar dan akan disemak."}`.
- **Errors:** 404; 422 `fields.body` "Medan ini diperlukan." / "Medan ini tidak sah." / "Komen mesti antara 1 hingga 1000 aksara."; 401.
- **Side effects:** stores the comment as `pending`; it is not shown (comment counts and lists use approved only). **No moderation endpoint exists in the mock** (OQ-API-B4-18).
- **Owner / handler / client:** M09, `handlers/perutusan.ts:285`, `commentOnPerutusan`.
- **Card:** BE-24
- **Contract:** missing

### M09-40 `GET /api/public/perutusan/:id`
- **Roles:** public
- **Auth detail:** no guard; only `isPublic` and `published` posts, else 404.
- **Purpose:** S28 public share page.
- **Request:** path `id`.
- **Response:** 200 `{data: PublicPerutusan}` (T:261): id,title,author {name,initials,roleLabel},body,createdAt,youtubeEmbedUrl|null,scopeLabel,reactionTotal,reads,commentCount.
- **Errors:** 404 "Not Found."
- **Side effects:** none (counts no read).
- **Owner / handler / client:** M09, `handlers/perutusan.ts:310`, `fetchPublicPerutusan`.
- **Card:** BE-24
- **Contract:** missing

### M09-41 `GET /api/admin/screenshots`
- **Roles:** admin
- **Auth detail:** `adminOnly`.
- **Purpose:** S14 private screenshot list.
- **Request:** none.
- **Response:** 200 `{data: ScreenshotFile[], meta}` (AM:): id,fileName,originalName,size,mimeType,uploadedById,createdAt,url (`blob:mock/screenshots/{fileName}` placeholder; the real backend returns a storage URL). `meta` = unpaged meta + `total` (screenshot count). Newest first.
- **Errors:** 401, 403.
- **Side effects:** none.
- **Owner / handler / client:** M09, `handlers/admin-tools.ts:58`, `fetchScreenshots`.
- **Card:** BE-24 (`/admin/screenshots`)
- **Contract:** missing

### M09-42 `POST /api/admin/screenshots`
- **Roles:** admin
- **Auth detail:** `adminOnly`.
- **Purpose:** upload screenshots. **Multipart** `files[]`.
- **Request:** 1 to 20 files; each JPG/PNG/GIF/WebP/BMP, <= 10 MB, declared type and extension must agree.
- **Response:** **201** `{data: {saved: ScreenshotFile[], rejected: [{name, reason}]}, status: "{n} fail berjaya dimuat naik."}`. A refused file does not block the others; `reason` = "{file}: format atau saiz tidak dibenarkan.".
- **Errors:** 422 `fields.files` "Medan ini diperlukan." (no file), "Maksimum 20 fail setiap muat naik." (> 20), or "Fail mesti JPG, PNG, GIF, WebP atau BMP, maksimum 10 MB." (none saved; also the top-level message); 401, 403.
- **Side effects:** stored file name = lower-cased, spaces to `-`, characters outside `a-z0-9._-` removed, leading dots stripped, max 120 chars; a taken name gets `-1`, `-2`; nothing usable = `screenshot-{n}.{ext}`.
- **Owner / handler / client:** M09, `handlers/admin-tools.ts:63`, `uploadScreenshots`.
- **Card:** BE-24 (+ BE-04)
- **Contract:** missing

### M09-43 `GET /api/config/support`
- **Roles:** public
- **Auth detail:** no guard.
- **Purpose:** support e-mail and WhatsApp number for the help box (DV-M09-14).
- **Request:** none.
- **Response:** 200 `{data: SupportConfig}` (T:277): `{email, whatsappNumber}`.
- **Errors:** none in practice. If the config row were missing the repository throws `M09Error` NOT_FOUND "Konfigurasi sokongan tidak dijumpai." which this handler does not map (it would surface as a generic server error); the real backend should answer 404 with that text.
- **Side effects:** none.
- **Owner / handler / client:** M09, `handlers/support.ts:16`, `fetchSupportConfig`.
- **Card:** BE-24 (`support_config` table)
- **Contract:** missing


## M20 Marketplace (`m20-marketplace`) - 5 routes

> **D53(a): M20 Marketplace is in B1. Owner card BE-46.**

Mock: `src/modules/m20-marketplace/mock/handlers/buyer.ts`; wire types `api/types.ts` (`T:`); client `api/marketplace.ts`. SRS `docs/requirements/srs/M20-marketplace.md` (route numbers `#13` to `#17`: the student/buyer slice only; seller and admin routes #1 to #12 are not built in the mock). Count: plan says 5, grep finds 5.

**Scope status (D53(a), 2026-10-19): M20 Marketplace is in B1.** Owner card BE-46. The earlier "B1 non-goal" text is superseded.

Module conventions: every route is `requireAuth()` (any signed-in role; 401 "Unauthenticated."). Ids are integers (OQ-API-B4-1). Prices are decimal **strings** with 2 dp ("89.90"). Datetimes ISO `+08:00`. No data is written except the counters noted (D14: no cart, order or payment; the buyer is handed to WhatsApp). Contract status: **missing**.

### M20-13 `GET /api/marketplace/categories`
- **Roles:** any session
- **Auth detail:** `requireAuth()`.
- **Purpose:** the 6 constant categories (selects and chips).
- **Request:** none.
- **Response:** 200 `{data: MarketplaceCategory[]}` (T:27): id,slug,name,icon, id ascending. No meta (plain `ok`).
- **Errors:** 401.
- **Side effects:** none.
- **Owner / handler / client:** M20, `handlers/buyer.ts:85`, `fetchMarketplaceCategories`.
- **Card:** BE-46
- **Contract:** missing

### M20-14 `GET /api/marketplace/products`
- **Roles:** any session
- **Auth detail:** `requireAuth()`.
- **Purpose:** S6 product search (BR-M20-05, V-M20-03).
- **Request:** query `q` (trimmed, max 100 chars, case-insensitive substring of name), `category` (category slug; unknown slug = empty result), `condition` (`new|used`; exact, other values match nothing), `sort` (`latest` default | `price_low` | `price_high` | `popular`; unknown = latest), `page`. Page size fixed **20**. Visible products only: `status=active` and the seller (if any) `active`; stock does not matter.
- **Response:** 200 `{data: ProductCard[], meta: ListMeta}` (T:35): id,slug,name,price (string),originalPrice|null,discountPct (round((orig-price)/orig*100) | null),condition,thumbnailUrl|null,seller ({shopName,verified}|null for platform products),shippingLine (e.g. "Pos / Kurier (RM8.00)"). Sorting: `latest` = createdAt desc, ties id asc but id desc when a category is set (DV-M20-07); `price_low`/`price_high` by price, ties id asc; `popular` = views desc, ties id asc.
- **Errors:** 401.
- **Side effects:** none.
- **Owner / handler / client:** M20, `handlers/buyer.ts:86`, `searchMarketplaceProducts`.
- **Card:** BE-46
- **Contract:** missing

### M20-15 `GET /api/marketplace/products/:slug`
- **Roles:** any session
- **Auth detail:** `requireAuth()`.
- **Purpose:** S7 product page.
- **Request:** path `slug`.
- **Response:** 200 `{data: ProductDetail}` (T:80): id,slug,name,categoryId,category,price,originalPrice,discountPct,description,condition,stockStatus (`available|out_of_stock`),shippingMethod (`pickup|postage|cod|free`),shippingFee|null,shippingLine,location ('' if none),views (after this +1),createdAt,images[] {id,position (1 = Utama),url},seller (SellerCard {id,shopName,initial,verified,ratingStars ("★"/"☆" x5),activeProductCount}|null),reviews[] {id,userId,rating,text,createdAt} newest first,reviewCount,related[] (max 4 ProductCards).
- **Errors:** 404 `NOT_FOUND` "Not Found." (unknown slug or hidden product; nothing changes); 401.
- **Side effects:** **`views` + 1 on every call** (BR-M20-12).
- **Owner / handler / client:** M20, `handlers/buyer.ts:87`, `fetchMarketplaceProduct`.
- **Card:** BE-46
- **Contract:** missing

### M20-16 `POST /api/marketplace/products/:slug/whatsapp`
- **Roles:** any session
- **Auth detail:** `requireAuth()`.
- **Purpose:** record a contact click and return the WhatsApp hand-off URL (BR-M20-21, D14: simulation of an external hand-off).
- **Request:** path `slug`; no body.
- **Response:** 200 `{data: {url}}` (T:109). `url` = `https://wa.me/{number}?text={encodeURIComponent('Salam, saya berminat dengan produk "{name}" di PRESTASIPLUS Marketplace.')}` where `number` is the seller's WhatsApp number, or the platform number for a platform product.
- **Errors:** 404 "Not Found." (unknown or hidden); 401.
- **Side effects:** a seller product adds 1 to the seller's `whatsappClicks`; a platform product counts nothing. The mock also logs the URL (test hook `whatsapp-log`); a real backend must not send messages.
- **Owner / handler / client:** M20, `handlers/buyer.ts:88`, `recordWhatsappClick`.
- **Card:** BE-46
- **Contract:** missing

### M20-17 `GET /api/marketplace/sellers/:id`
- **Roles:** any session
- **Auth detail:** `requireAuth()`; active sellers only (BR-M20-08).
- **Purpose:** S8 public seller shop.
- **Request:** path `id` int.
- **Response:** 200 `{data: ShopView}` (T:129): `shop` {id,shopName,initial,description|null,verified,ratingStars,reviewCount,productCount,createdAt}, `products[]` (visible ProductCards, newest first, ties id asc; not paginated).
- **Errors:** 404 "Not Found." (unknown or non-active seller); 401.
- **Side effects:** none.
- **Owner / handler / client:** M20, `handlers/buyer.ts:91`, `fetchMarketplaceShop`.
- **Card:** BE-46
- **Contract:** missing

## M21 Sponsorship and Anak Angkat (`m21-sponsorship`) - 1 route

> **D53(a): M21 student side only is in B1 (Penaja out, D48). Owner card BE-47.**

Mock: `src/modules/m21-sponsorship/mock/handlers/foster-application.ts`; wire types `api/types.ts` (`T:`); client `api/foster-application.ts`. SRS `docs/requirements/srs/M21-sponsorship.md` (route `#15`; the sponsor/admin routes #1 to #14 are not built in the mock). Count: plan says 1, grep finds 1.

**Scope status (D53(a), 2026-10-19): M21 student side only is in B1** (Penaja out, D48). Owner card BE-47. The sponsor portal stays out.

### M21-15 `POST /api/mohon-keluarga-angkat`
- **Roles:** any session
- **Auth detail:** `requireAuth()`; the applicant is the session user (`applicantUserId`, `applicantRole` taken from the session, never from the body).
- **Purpose:** foster-family ("keluarga angkat") application for a named student (BR-M21-13, V-M21-03).
- **Request:** body `{studentEmail: string (required, e-mail shape, must be the e-mail of an existing user with role student), studentCategory: 'B40'|'Asnaf'|'Yatim'|'OKU'|'Lain-lain' (required), familyIncomeRange?: '< RM1,000'|'RM1,000 - RM2,500'|'RM2,500 - RM4,000'|'> RM4,000' (blank/null = not given), reason: string (required, non-blank; stored up to 5000 chars)}` (T:84).
- **Response:** **201** `{data: {id}}` (T:93).
- **Errors:** 422 `VALIDATION_ERROR` with `fields` (top-level message = first field message plus " (and N more error(s))" when several): `studentEmail` "Sila isi ruangan ini." (blank), "Format e-mel tidak sah.", "Email pelajar tidak dijumpai dalam PrestasiPlus." (no such student; this reveals whether an e-mail is a student, OQ-API-B4-20); `studentCategory` "Sila isi ruangan ini." / "Pilihan tidak sah."; `familyIncomeRange` "Pilihan tidak sah."; `reason` "Sila isi ruangan ini."; 401.
- **Side effects:** inserts a `pending` application (student id, applicant id/role, category, income, reason, createdAt = now). No duplicate check, no notification, no e-mail (the SRS success text "Permohonan anda telah dihantar. Admin akan menyemak permohonan dalam 1-3 hari bekerja." is shown by the client).
- **Owner / handler / client:** M21, `handlers/foster-application.ts:87`, `submitFosterApplication`.
- **Card:** BE-47
- **Contract:** missing

## M22 Support tickets (`m22-support-tickets`) - 4 routes

Mock: `src/modules/m22-support-tickets/mock/handlers/tickets.ts`; wire types `api/types.ts` (`T:`); client `api/tickets.ts`. SRS `docs/requirements/srs/M22-support-tickets.md` (routes `#1` to `#4`, used as block ids). Count: plan says 4, grep finds 4. Card **BE-24** (names `GET /api/tiket`, `POST /api/tiket`, `GET /api/admin/tiket` "+ the 4th route"). Role-access matrix section A: "Tiket Bantuan" for Murid, Guru and Admin Sekolah; the admin queue is Portal Pentadbiran (read-only, D27, DV-M22-07).

Module conventions: ids are integers (OQ-API-B4-1); statuses `dibuka|dalam_proses|menunggu_balas|selesai|ditutup` with labels Dibuka, Dalam Proses, Menunggu Balas, Selesai, Ditutup (BR-M22-02). There is **no endpoint to reply to or change the status of a ticket** in the mock (read-only queue, BR-M22-16); `adminReply` is always null for runtime tickets (OQ-API-B4-21). Contract status: **missing**.

### M22-01 `GET /api/tiket`
- **Roles:** any session
- **Auth detail:** `requireAuth()`; the user comes from the session (a `userId` query value is ignored, FR-M22-25): own tickets only.
- **Purpose:** the caller's tickets.
- **Request:** query `status` (optional vocabulary status; an unknown value is ignored = all). Not paginated.
- **Response:** 200 **`{data: Ticket[], meta: {total}}`** (T:41,51): id,subject,body,status,statusLabel,adminReply|null,createdAt; id descending. `meta.total` = the caller's total tickets regardless of the status filter (not the standard ListMeta).
- **Errors:** 401.
- **Side effects:** none.
- **Owner / handler / client:** M22, `handlers/tickets.ts:134`, `fetchTickets`.
- **Card:** BE-24
- **Contract:** missing

### M22-02 `POST /api/tiket`
- **Roles:** any session
- **Auth detail:** `requireAuth()`; the owner is the session user.
- **Purpose:** create a ticket (BR-M22-03, BR-M22-12).
- **Request:** body `{subject: string (trimmed, required, <= 255), body: string (trimmed, required, <= 5000)}`.
- **Response:** **201** `{data: Ticket}` with `status: 'dibuka'`, `statusLabel: 'Dibuka'`, `adminReply: null`. (The page flash text is client-side: "Tiket dihantar. Pasukan sokongan akan membalas secepat mungkin.")
- **Errors:** 422 `VALIDATION_ERROR` with `fields`: `subject` "Subjek diperlukan." (blank) or "Subjek tidak boleh melebihi 255 aksara."; `body` "Butiran diperlukan." (blank) or "Butiran tidak boleh melebihi 5000 aksara."; top-level message = first field message (+ " (and 1 more error)" when both fail); 401.
- **Side effects:** inserts the ticket (`dibuka`, `createdAt = updatedAt = now`); then **notifies every active `admin`** through the M01 notifications service: `{type: 'new_ticket', category: null, title: 'Tiket baru', body: 'Tiket sokongan baharu telah diterima.'}` with the push flag set; a notification failure never undoes the ticket (BR-M22-12, XR-M22-01).
- **Owner / handler / client:** M22 (calls M01 `pushNotification`), `handlers/tickets.ts:135`, `createTicket`.
- **Card:** BE-24 (AC 3)
- **Contract:** missing

### M22-03 `GET /api/admin/tiket`
- **Roles:** admin
- **Auth detail:** `adminOnly` (401 / 403 "This action is unauthorized.").
- **Purpose:** the admin support queue (read-only).
- **Request:** query `status` (exact vocabulary value; blank = all; an unknown value returns no rows).
- **Response:** 200 **`{data: QueueRow[], meta: {total, counts}}`** (T:57,66): row id,createdAt,userName|null,subject,status,replied (adminReply non-empty); no body, no e-mail, no user id. Order `createdAt` desc then id desc, **first 200 rows only** (BR-M22-10). `meta.total` = all tickets; `meta.counts` = `[{status,count}]` for statuses with count > 0, in vocabulary order, over all tickets (not the filtered ones).
- **Errors:** 401, 403.
- **Side effects:** none.
- **Owner / handler / client:** M22, `handlers/tickets.ts:136`, `fetchQueue`.
- **Card:** BE-24 (AC 4)
- **Contract:** missing

### M22-04 `GET /api/admin/tiket/open-count`
- **Roles:** admin
- **Auth detail:** `adminOnly`. Static path registered next to `/api/admin/tiket`.
- **Purpose:** badge count of open tickets.
- **Request:** none.
- **Response:** 200 `{data: {count}}` where `count` = tickets with status `dibuka`.
- **Errors:** 401, 403.
- **Side effects:** none.
- **Owner / handler / client:** M22, `handlers/tickets.ts:137`, `fetchOpenCount`.
- **Card:** BE-24 ("the 4th route")
- **Contract:** missing

## Uncovered endpoints

16 of 165 endpoints have no BE card after D53 (63 after UD-3, 60 before). M16 (52), M20 (5), M21 (1) and M09 Audio KBAT play (2) are now in B1 (D53(a)): cards BE-44/BE-45, BE-46, BE-47 and BE-24.

| Module | Count | Endpoint ids | Reason |
|---|---|---|---|
| M14 teacher economy | 13 | M14-11..M14-16, M14-30..M14-36 | Not in B1 (D53 OWN-10, owner decision 2026-10-19): teacher wallets, cash-out, teacher shop and teacher badges are backlog; the backend does not register them. |
| M15 parent approvals | 3 | M15-08, M15-09, M15-10 | Not in B1, user decision UD-3 (2026-10-19): the backend does not register them and the frontend hides the entry point. |

M22 and the rest of M14, M15 and M09 are covered by BE-11, BE-23 and BE-24.

### Covered by card scope but not itemised

None after the card audit (commit 63d363c). The 31 endpoints this part used to list here (M14 9, M15 6, M09 16) are now itemised in BE-23 and BE-24. Of the 60 uncovered, M09-25 and M09-26 are named in BE-24 as explicit backlog ("not built here"), so they stay uncovered.

## Open questions

Each question needs a lead or user answer before (or while) the owning card is built. Defaults are the author's suggestion, not a decision.

| ID | Question | Affects | Suggested default |
|---|---|---|---|
| OQ-API-B4-1 | **Resolved by UD-1 (user decision 2026-10-19): the real API follows the contract (string ids, cookie + CSRF, `Session`, 401 `INVALID_CREDENTIALS`, no Bearer); the LEAD realigns mock and HttpTransport (V2-T31).** Id wire format: the mock uses integer ids everywhere in this part (users, schools, rewards, tiers, challenges, tickets, videos, articles, ...) and numeric path params (`int()`); the contract says opaque string `Id` (OD-9). Nested user/school ids (`userId`, `child.id`, `uploaderId`) and numeric route params must follow. M16 battle uuids, room codes, session ids and tournament uuids are already strings. | all 165 | Strings per contract; the lead realigns the frontend per domain switch (V2-T24/T25). |
| OQ-API-B4-2 | `GET /api/gamification/transactions` (M14-03): BE-11 describes a "paginated ledger"; the mock returns every row, newest first, with a non-standard `meta {currentSyiling, type}`. Same for `GET /api/gamification/challenges` (`meta {completed, active}`). Keep as coded (client switch must be a no-op) or paginate and extend `ListMeta`? | M14-03, M14-06 | Keep as coded; add pagination only with a UI change. |
| OQ-API-B4-3 | Conversion (M14-05): BE-23 AC 3 says "enforces the mock's rate, minimum and daily cap". The mock has a rate (tier `conversionRate`) and a minimum (= rate) but **no daily cap**. | M14-05 | No daily cap (replicate the mock); correct the card. |
| OQ-API-B4-4 | Real students' names are returned to other students by `GET /api/gamification/leaderboard` (top 50), `GET /api/battle/search-opponent`, `GET /api/battle/standings/students`, battle history, room players and the weekly competition. Are full names acceptable for a minors' platform, or should the API return initials/display names? | M14-07, M16-07/18/21/26/40 | Replicate the mock (full name as stored); confirm with the user before production (privacy). |
| OQ-API-B4-5 | Share/referral links hard-code the host `https://prestasiplus.my` (`/pelajar/{id}`, `/register?ref=`, `wa.me`, `t.me`). The v2 hosts differ (`.cloud` migration). | M14-09, M14-10 | Build links from a configured public base URL (env), not a constant. |
| OQ-API-B4-6 | `DELETE /api/admin/gamification/challenges/:id` (M14-25) removes the row and leaves completions untouched. FK behaviour in Postgres (cascade, restrict, or soft-deactivate)? | M14-25 | Refuse deletion when completions exist and tell the admin to deactivate (toggle), or cascade; needs a decision. |
| OQ-API-B4-7 | Admin mutations in M14 (award syiling, settings, tiers, cash status) write no audit event in the mock. Plan mentions an `audit_events` table and "draw results are audited" (BE-23 AC 5). Which actions must be audited? | M14-19..21, 28, 36, 38, 40..42 | Audit award, cash status change, settings, draw creation. |
| OQ-API-B4-8 | BE-23 AC 5 mentions "lucky-draw creation and ticket allocation ... draw results are audited", but the mock has **no route to run a draw / pick winners / list tickets** (only create, list, buy-ticket). Is winner selection in B1? | M14-42, M15-06/07 | Out of B1 (no route in the mock); keep creation and ticket purchase only. |
| OQ-API-B4-9 | BE-23 lists example M15 paths `GET /api/rewards...` that do not exist in the mock; the real M15 paths are `/api/admin/hadiah*`, `/api/hadiah/redemptions`, `/api/hadiah-digital/*`, `/api/gamification/mystery-boxes*`, `/api/cabutan*`, `/api/parent/hadiah-approvals*`. The card also omits tier `PUT/toggle`, challenge `PUT/toggle/DELETE`, badge `PUT`, `reward-control/rewards/:id/cost` and `guru/redemptions` PATCH. | BE-23 card text | Update the card to the path lists in this document. |
| OQ-API-B4-10 | Mystery box result (M15-05) is a uniform integer in the box ranges drawn from a seeded PRNG (rule PROPOSED in the SRS). Production RNG, anti-replay, and whether ranges are inclusive (they are, in the mock) must be confirmed. | M15-05 | Server-side CSPRNG, inclusive ranges, one transaction. |
| OQ-API-B4-11 | **D53(a): M16 is in B1; replicate the bot simulation (cards BE-44/BE-45).** M16 is a simulation: opponents of battles, quick match, room games and the Papan Bijak quick match are bots chosen from fictitious students; waiting rooms get a bot per host poll; timing (3 polls to match, 120 s expiry) is mock-specific. What is the production behaviour (real matchmaking, push/websocket vs 3 s polling, bot fallback)? M16 has no BE card. | M16-02..17, 26..31 | Defer M16 (wave 4); when carded, keep polling contract and keep bot fallback behind a flag. |
| OQ-API-B4-12 | Role-access matrix row 18 "Kedudukan" (Murid): `docs/requirements/srs/M08` maps `/ranking` to M08 S19 "Kedudukan" (academic ranking), while `v2-backend-plan` OD-11 says "M16 Kedudukan". Which routes back that menu item: M08 ranking, M16 battle standings (M16-18/19) or both? | M16-18/19, M08 | Confirm with the lead. |
| OQ-API-B4-13 | League and tournament status: the mock never changes a league from `upcoming` to `ongoing`/`ended` by date, nor a tournament beyond `registration` to `ongoing` (derived from `registration_closes_at`). Which scheduler or derived rule applies? | M16-42..49 | Derive status from dates at read time (as the tournament rule does). |
| OQ-API-B4-14 | `GET /api/sekolah-bersaing` (M16-50) serves stored weekly snapshot rows (`aktifPct`, `streakAvg`, `notaPer10`); the mock has no computation. The weekly job (formula, inputs from M05/M14, anonymisation flag) is undefined. | M16-50 | Define the job with the lead before carding; until then seed snapshots only. |
| OQ-API-B4-15 | HTML bodies (`articles.content`, `perutusan.body`, note `content`) are stored raw in the mock; BE-24 AC 2 requires sanitising on write and a test with `<script>`/`onerror`. Allowed tag/attribute list? | M09-03/04/12/13/37 | Server-side allow-list sanitiser (same list as the frontend renderer). |
| OQ-API-B4-16 | BE-24 AC 5: "teachers' uploaded videos need the approval state the mock uses". The mock videos have **no approval state**: any signed-in user publishes immediately (`visibility global|school`). | M09-29..31 | Replicate the mock (no approval); drop that AC or add the state with the lead. |
| OQ-API-B4-17 | Video "form school" (M09-32/BR-M09-21) comes from a separate `videoSchools` table (one row per user), not the profile school; school-visibility uses it. How is it populated in the real system (migration, profile school)? | M09-27..32 | Use the user's profile school (`users.school_id`) unless the lead says otherwise. |
| OQ-API-B4-18 | Perutusan comments are stored `pending` and never shown; no endpoint approves or lists pending comments (M09-39). Moderation flow? | M09-39 | Out of B1 until a moderation screen exists; keep storing `pending`. |
| OQ-API-B4-19 | **D53(a): M21 student side is B1 (BE-47).** M21: only `POST /api/mohon-keluarga-angkat` exists; the admin side of applications (approve/reject, F-167) and the sponsor portal have no mock route, so nothing can ever move an application out of `pending`. | M21-15 | Document as store-only; admin review is a later card. |
| OQ-API-B4-20 | M21-15 answers 422 "Email pelajar tidak dijumpai dalam PrestasiPlus." for non-student e-mails, which lets any signed-in user test whether an e-mail belongs to a student account (enumeration). | M21-15 | Keep the copy (fidelity), add rate limiting (BE-33). |
| OQ-API-B4-21 | M22 has no reply / status-change route: `adminReply` is always null and status stays `dibuka` for new tickets (read-only queue, D27). Who answers tickets and how does the student see it? | M22-01..04 | Out of B1 (replicate read-only); add admin reply endpoint with the Portal Pentadbiran tickets screen. |
| OQ-API-B4-22 | Plan section 6.3 route counts are stale (M14 32 vs 42, M16 28 vs 52, M09 25 vs 43); the BE-24 and BE-23 endpoint tables omit many routes (now itemised, see section "Covered by card scope but not itemised"). | plan, cards | Update plan 6.3 and the two cards from this catalogue. |
| OQ-API-B4-23 | **RESOLVED by D53 OWN-10 (2026-10-19): teacher economy is backlog, not B1; the 13 routes are "Not in B1 (D53)".** Teacher economy (M14-11 to M14-16, M14-30 to M14-36): teacher wallets, cash-out and teacher reward shop are "out of v2 per D28c" in BE-23 and gated on Q10/OD-8; `v2-cloud-gap` F-94 marks teacher gamification Hidden-OOS. Build now (disabled cash-out) or defer? | M14-11..16, 30..36 | Build read routes; keep cash-out disabled until Q10 (card AC 7). |
| OQ-API-B4-24 | M16 solo games (M16-32) send the **answer keys to the client** (`correct`, `is_true`, `answer`, SEC-M16-01 as live) and M16-33 trusts client-reported `score`/`syiling_earned` within server-computed maxima. Replicate or grade server-side? | M16-32/33 | Replicate for the unchanged client; cap coin credit server-side as the mock does. |
| OQ-API-B4-25 | **Resolved by UD-3 (user decision 2026-10-19): parent hadiah approvals (M15-08..10) are not built in B1; the frontend hides the entry point.** M15 parent routes (M15-08..10) need role `parent` and M02 parent links; parent is out of B1 (plan section 2). `GET /api/parent/hadiah-approvals` is `requireAuth` only (empty for non-parents). Build behind BE-25 or defer? | M15-08..10 | Defer with the parent role; admin queue `pending_parent_consent` rows simply stay pending. |
| OQ-API-B4-26 | Role scope not enforced by the mock: M16 routes accept any role (a teacher or admin can create rooms, play battles, create leagues); `POST /api/leagues` has no role check; `GET /api/guru/gamification/leaderboard` for an admin lists all teachers. Confirm the intended role limits. | M16, M14-16 | Restrict M16 student play to `student` (+ `admin` preview) when carded. |
| OQ-API-B4-27 | M14 core route `GET /api/me/gamification-summary` (SRS #1) lives in `src/mock/core-data/routes.ts` and is not part of this catalogue part; ensure the identity/session part lists it, with BE-11. | cross-part | Lead to confirm ownership. |
| OQ-API-B4-28 | Several GETs write: article/video/perutusan/product view counters (+1 per call, no de-duplication) and the referral-code creation. Under HTTP caching, bots and prefetch, counters inflate. Keep as coded? | M09-08/28/35, M20-15, M14-10 | Replicate; exclude `for=edit` and author/admin as the mock does; consider a de-dup window later. |
