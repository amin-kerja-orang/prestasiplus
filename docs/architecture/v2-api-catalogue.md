# v2 API catalogue (index)

The catalogue documents every endpoint the frontend mock registers today (plus the contract-only session endpoints and the Bijak SPM class methods), one block per endpoint: path, guard, request, response, errors, side effects, owning module, BE card and contract status. It is the reference for building the real NestJS 11 + Prisma + PostgreSQL backend (cards BE-01..BE-40) so that the frontend switches from the in-browser mock to HTTP with **no frontend change**. The mock is the behavioural spec; the catalogue records what it does and never invents a business rule. Where the mock, a card, the SRS and the contract disagree, the disagreement is an open question (section 6), not a decision.

Snapshot: worktree `D:\Dev Projects\pp-docs`, branch `docs/v2-reference`, 2026-10-19. Line numbers in the parts drift; use function names.

## Owner decisions of 2026-10-19 applied to this catalogue (UD-1..UD-4 and TRACKER D53)

- **UD-1 Ids and session follow the contract.** Ids are decimal strings; the real API uses the cookie session plus `X-CSRF-Token`, the `Session` shape and `/api/session*`; bad credentials answer 401 `INVALID_CREDENTIALS`; no Bearer. The LEAD realigns the mock and `HttpTransport` (V2-T31). Resolves CC-1 and CC-2. The endpoint blocks for login, logout and `GET /api/me` carry the note "real API follows contract (UD-1)".
- **UD-2 Impersonation is dropped.** Mod Pelajar works only through `POST /api/session/mode` (D31c). M02-09, M27-21 and M27-22 are "Not ported (UD-2)". Resolves CC-3.
- **UD-3 Parent hadiah approvals are not built in B1.** M15-08..10: the backend does not register them, the frontend hides the entry point; card none.
- **UD-4 M18 Amaran is folded into BE-21.** M18-01..04 now carry card BE-21.
- **D53 (owner decisions recorded in the TRACKER, 2026-10-19).** (OWN-1) `intake_batches` (BE-37) is the one teacher Submission; `question_submissions` is dropped from BE-10, so M04-13/14/15 show "BE-37/BE-38 [pending card update]". (OWN-10) The teacher economy is backlog: 13 M14 routes "Not in B1 (D53)". (h) Questions tag `curriculum_node` only; `dskp_*` is the teacher picking list. (a) B1 = every module reachable in the prototype: M06 BE-41, M07 BE-42, M13 BE-43 (AI via the BE-36 adapter), M16 BE-44/BE-45 (split TBC; replicate the bot simulation), M20 BE-46, M21 student side BE-47 (Penaja out, D48), M25 BE-48 (= Heatmap Topik Lemah), M09 Audio KBAT play BE-24; all marked [pending card]. D52 intake (b2e1033) and paper builder (1b5193f) are merged locally and pending push; final admin routes are in part 2 section 11.

## 1. Parts

| Part | File | Modules | Endpoint blocks |
|---|---|---|---:|
| 1 | [`core-identity-curriculum.md`](v2-api-catalogue/core-identity-curriculum.md) | core, M01, M02, M03 | 104 (100 mock + 4 contract-only) |
| 2 | [`learning-exam.md`](v2-api-catalogue/learning-exam.md) | M04, M05, M06, M07, M13, M25 (+ M28 Bijak methods, SPM intake D52 operations IN-01..IN-10) | 99 routes + 16 Bijak methods + 10 intake operations |
| 3 | [`teacher-reports-admin.md`](v2-api-catalogue/teacher-reports-admin.md) | M08, M10, M11, M12, M17, M18, M27 | 127 |
| 4 | [`economy-content-games.md`](v2-api-catalogue/economy-content-games.md) | M14, M15, M16, M09, M20, M21, M22 | 165 |
| | **Total** | | **495 HTTP endpoints** (491 mock routes + 4 contract-only) + 16 Bijak methods |

Endpoint ids are `Mnn-kk` (module, sequence in the part's summary table), `C-nn` (core), `S-nn` (session contract), `BJ-nn` (Bijak method). A block is found by its id or its `### \`METHOD /path\`` heading.

## 2. How to use it

- **Building a backend card (BE-05, BE-06, BE-08..13, BE-17..25).** Open the part and module of the card, filter the summary table by the card id (Card column), implement each block as written (path string, guard, body shape, status code, BM message verbatim), then read that module's open questions and the "Uncovered endpoints" table below: endpoints marked `UNCOVERED` (M18 and the backlog modules) have no card; ask the LEAD before building them.
- **Building a contract-only card (BE-03, BE-31).** The contract (`packages/contract/src/**`) currently holds only common schemas, session/auth paths and the access matrix. Every other endpoint is `missing`: write the zod schema and `openapi.ts` path from the block's Request/Response/Errors lines, then run the conformance suite (BE-31) against the mock and the new handler. Shapes the blocks mark RAW (bare arrays, `200 {error}`, files) need an explicit contract exception (section 4, "Non-standard bodies").
- **Switching the frontend (BE-32, V2-T31).** The switch is a no-op only if the real API reproduces the mock's wire exactly: path strings (including BM paths), envelope variant, `status`/`message` siblings, fixed page sizes and BM copy. Section 4 lists the places where the mock and the contract differ today; each is an open decision, and until it is decided the real API must follow the mock.
- **Reading a block.** "Roles/auth" is the guard as coded (the mock uses a Bearer token; see section 4). "Card" is the BE card that lists the endpoint; `UNCOVERED` = no card lists it (the earlier `BE-nn*` implied markers are gone after the card audit). "Contract" is `exists` (zod schema and `openapi.ts` path), `partial` (path registered, shape differs from the mock) or `missing` (neither).

## 3. Per-module table

Counts verified for this index with a multi-line-aware script (`scratchpad/docs-owner/api-index/count.mjs`: matches `route(` followed by a method literal across line breaks, skips `__tests__`; two factory patterns add routes: M16 `start(mode)` is called twice (51 calls = 52 routes), M27 has 4 factories each registered twice (18 calls = 22 routes)). All four parts' figures matched; no mismatch.

| Module | Part | Routes | Card(s) | Uncovered | Contract exists / partial / missing |
|---|---|---:|---|---:|---|
| core (`GET /api/me`, gamification summary, server status) | 1 | 3 | BE-06, BE-11, BE-22 | 0 | 0 / 0 / 3 |
| session contract (S-01..S-04, no mock handler) | 1 | 4 | BE-03 | 0 | 4 / 0 / 0 |
| M01 authentication, account, notifications | 1 | 19 | BE-03, BE-06 | 0 | 0 / 2 / 17 |
| M02 users, schools, subscriptions, parent invites | 1 | 49 | BE-05, BE-25 | 1 (M02-09 impersonate, UD-2) | 0 / 0 / 49 |
| M03 curriculum | 1 | 29 | BE-08 | 0 | 0 / 0 / 29 |
| M04 question bank | 2 | 30 | BE-09, BE-10; M04-13/14/15 BE-37/BE-38 [pending card update] (D53 OWN-1) | 0 | 0 / 0 / 30 |
| M05 practice | 2 | 23 | BE-12, BE-13, BE-18 | 0 | 0 / 0 / 23 |
| M06 SPM classic | 2 | 14 | BE-41 [pending card] (D53(a)) | 0 | 0 / 0 / 14 |
| M07 PKSK | 2 | 21 | BE-42 [pending card] (D53(a)) | 0 | 0 / 0 / 21 |
| M13 Cikgu Alesa | 2 | 10 | BE-43 [pending card] (D53(a)) | 0 | 0 / 0 / 10 |
| M25 AI Centre (Heatmap Topik Lemah) | 2 | 1 | BE-48 [pending card] (D53(a)) | 0 | 0 / 0 / 1 |
| M28 Bijak SPM (16 class methods, 0 routes) | 2 | 0 | BE-14, BE-15, BE-16 | 1 (BJ-04) | 0 / 0 / 15, 1 n/a (BJ-12 sweeper) |
| SPM intake D52 (operations IN-01..IN-10, source commit b2e1033; no HTTP routes) | 2 | 0 | BE-36..BE-40 (+BE-26 seed) | 2 with no card endpoint (IN-05, IN-09), IN-04 partial | all missing |
| M08 student performance | 3 | 30 | BE-19 | 0 | 0 / 0 / 30 |
| M10 teacher and class | 3 | 39 | BE-09, BE-10, BE-17, BE-18, BE-22 | 0 | 0 / 0 / 39 |
| M11 teacher analytics | 3 | 7 | BE-20 | 0 | 0 / 0 / 7 |
| M12 Kirkpatrick | 3 | 14 | BE-20 | 0 | 0 / 0 / 14 |
| M17 admin dashboard (Command Center) | 3 | 11 | BE-22 | 0 | 0 / 0 / 11 |
| M18 PPD / JPN (Amaran Awal) | 3 | 4 | BE-21 (UD-4) | 0 | 0 / 0 / 4 |
| M27 school admin | 3 | 22 | BE-21 | 2 (impersonate, UD-2) | 0 / 0 / 22 |
| M14 gamification | 4 | 42 | BE-11, BE-23 | 13 (teacher economy, Not in B1, D53 OWN-10) | 0 / 0 / 42 |
| M15 rewards shop | 4 | 18 | BE-23 | 3 (parent approvals, UD-3) | 0 / 0 / 18 |
| M16 battle, games, competitions | 4 | 52 | BE-44/BE-45 [pending card; split TBC] (D53(a)) | 0 | 0 / 0 / 52 |
| M09 content | 4 | 43 | BE-24 (incl. Audio KBAT play, D53(a)) | 0 | 0 / 0 / 43 |
| M20 marketplace (buyer) | 4 | 5 | BE-46 [pending card] (D53(a)) | 0 | 0 / 0 / 5 |
| M21 foster application (student side) | 4 | 1 | BE-47 [pending card] (D53(a)) | 0 | 0 / 0 / 1 |
| M22 support tickets | 4 | 4 | BE-24 | 0 | 0 / 0 / 4 |
| **HTTP total** | | **491 mock + 4 contract-only = 495** | | **19** | **4 / 2 / 489** |

Note: `GET /api/me/gamification-summary` (M14 SRS #1) is listed once, in part 1 (C-02); part 4's M14 count (42) excludes it, so M14 SRS-wise has 43.

### Stale route counts in `v2-backend-plan.md` section 6.3 (not edited; corrected here)

| Plan 6.3 group | Plan count | Verified mock routes | Where |
|---|---:|---:|---|
| Auth, session, role, mode | "6 (contract) + register/reset" | 6 M01 auth routes (login, register, 3 reset, logout) + 4 contract-only session routes | part 1 |
| Account, notifications, settings (M01) | 17 | 19 for all of M01 (6 auth + 13 account/notifications/public stats) + 3 core routes | part 1 |
| Users, schools, subscriptions (M02) | 43 | 49 (43 SRS + 4 parent invites + `schools/options` alias + `config/defaults`) | part 1 |
| Curriculum (M03) | 12 | 29 | part 1 |
| Question bank (M04) | 25 | 30 | part 2 |
| Practice (M05) | 20 | 23 | part 2 |
| Wallet / gamification (M14) + M15 | 32 + 18 | 42 + 18 | part 4 |
| Bijak SPM | 0 (about 12 methods) | 0 routes, 16 public methods | part 2 |
| Classes, teacher (M10) | 33 | 39 (30 + 9 Command Center) | part 3 |
| Student performance (M08) | 17 | 30 | part 3 |
| Teacher analytics, Kirkpatrick (M11, M12) | 4 + 13 | 7 + 14 | part 3 |
| School admin (M27) | 17 | 22 | part 3 |
| Command Center, admin aggregates (M17) | 2 + CC routes | 11 (+ 9 teacher CC routes counted in M10) | part 3 |
| Content, support (M09, M22) | 25 + 4 | 43 + 4 | part 4 |
| not in the plan table | | M06 14, M07 21, M13 10, M25 1, M16 52, M18 4, M20 5, M21 1 | parts 2, 3, 4 |
| **Total** | not summed in the plan | **495** | |

## 4. Shared wire conventions (once)

Source of truth: `packages/contract/src/common/{envelope,error,ids,time,enums}.ts`, `session/`, `auth/`. The mock behaviour is in `src/mock/server/{respond,paginate,validate,router}.ts`, `src/mock/auth/middleware.ts`, `src/api/client.ts`. Each part repeats the details it needs in its own conventions section (part 1 section 2, part 2 section 2, part 3 section 2, part 4 section 3); the parts name the same things differently:

| Concept | Part 1 | Part 2 | Parts 3 and 4 | Wire |
|---|---|---|---|---|
| `{ data }` | `Env-D` | `E1` | `ok/created` | 200/201 |
| `{ data, status }` flash | `Env-DS` | `E3` | `ok(data, {status})` | status text is BM and a **sibling** of `data` |
| `{ data[], meta }` | `Env-L` | `E2` | `list/paged/unpaged` | `meta` = `ListMeta` + module extras |
| 204 | `Env-204` | n/a | `noContent` | no body |
| bare body | n/a | `RAW` | `raw(status, body)` | no `{data}` |
| error | `Env-Err` | `E-AUTH`, `E-422` | | `{ error: { code, message, fields?, retryAfter? } }` |

- **Base path** `/api`, kept verbatim including BM paths (`/api/tiket`, `/api/hadiah/...`, `/api/cabutan`, `/api/guru/...`). Static segments win over `:param` segments.
- **Success.** `{ data }` (200, 201 on create); lists `{ data, meta }`; `meta` = `{ page, pageSize, totalItems, totalPages, from, to }` (`ListMetaSchema`, loose object, so module extras such as `counts`, `roleCounts`, `types` are allowed). A page that is missing or not a positive integer means 1; the page size is fixed per endpoint (the mock ignores `pageSize`, the contract `PageQuery` allows 1..100); an out-of-range page is not an error (empty `data`, requested `page` echoed); `totalPages = max(1, ceil(total/pageSize))`; `from`/`to` are 1-based or `null`. Unpaged lists answer `page 1`, `pageSize = max(1, n)`, `totalPages 1`.
- **Raw bodies.** Some endpoints return bare arrays/objects, `{ ok, message }`, `{ success, message }`, live-shaped bodies, CSV or files, and a few refusals as `200 {"error":"<text>"}` (M10 inline create). The frontend client reads them with `raw: true`. The contract has no model for these yet (section 6, CC-6).
- **Errors.** Body `{ error: { code, message, fields?, retryAfter? } }`. Generic codes (`ERROR_CODES`): `VALIDATION_ERROR` 422, `NOT_FOUND` 404, `UNAUTHORIZED` 401, `FORBIDDEN` 403, `CONFLICT` 409, `SERVER_ERROR` 500, `RATE_LIMITED` 429. Modules add string codes (`ACCOUNT_INACTIVE`, `ROLE_OUT_OF_SCOPE`, `CASH_DISABLED`, `INSUFFICIENT_BALANCE`, `OUT_OF_STOCK`, `LIMIT_REACHED`, `DRAW_CLOSED`, `TICKET_LIMIT`, `MONTHLY_CAP`, `INSUFFICIENT_TOKENS`, `ALREADY_SUBMITTED`, ...). `retryAfter` (seconds) is also sent as `Retry-After` on 429. A 422 built from `fields` has `message` = first field message plus ` (and N more error(s))`; `fields` = one message per field.
- **Auth.** Mock: `Authorization: Bearer pp_...` resolved by `requireAuth()` (401 `Unauthenticated.`) and `requireRole(...)` (401, then 403 `This action is unauthorized.`); roles `student, teacher, parent, sponsor, school_admin, ppd_officer, jpn_officer, admin`. Real API: HTTP-only cookie session plus `X-CSRF-Token` on unsafe methods (BE-03, plan section 7; no Bearer). Role scope and `is_test` are covered in section 6.
- **Ids.** Mock: integers (`int()` path params match digits only, else 404 `Not Found.`). Contract: opaque string `Id` (decimal string of a bigint). The catalogue writes ids as `int` where the mock does; they become strings together with the frontend realign (V2-T09, V2-T24). Undecided per endpoint: CC-1.
- **Time.** Contract: every instant ISO 8601 with `+08:00` (`TimestampSchema`), `DateOnly` for dates; day logic in Asia/Kuala_Lumpur. The mock mostly follows this; known deviations: Bijak attempt times are epoch ms, `GET /api/amaran/summary` `generatedAt` is epoch ms (CC-4).
- **BM messages.** Domain messages in the blocks are verbatim BM and must be reproduced exactly. The mock's generic messages (`Unauthenticated.`, `This action is unauthorized.`, `Not Found.`, `Server Error`, Laravel validation templates `The :attribute field is required.`) are English, while the contract says `message` is BM for direct display and the contract auth copy is BM (CC-5).
- **Where the mock deviates from the contract today:** login/logout shape, Bearer vs cookie, numeric vs string ids, the `status` envelope sibling, bare/non-enveloped bodies, fixed page size vs `pageSize`, epoch-ms times, English generic messages, 8 roles vs 7 (`jpn_officer`). All are listed in section 6.

## 5. Uncovered endpoints (19 of 495 HTTP endpoints; 143 before the card audit, 112 before D53)

"Uncovered" = no BE card endpoint table lists it, re-checked against the audited cards (LEAD audit, commit 63d363c, plus the catalogue additions marked "added from catalogue 2026-10-19"). Totals by reason after the owner decisions of 2026-10-19 (UD-1..UD-4, D53): dropped by user decision UD-2 3 (impersonation); not in B1 by user decision UD-3 3 (parent hadiah approvals); not in B1 by D53 OWN-10 13 (teacher economy); out of B1 / backlog 0 (was 106: D53(a) moved M06, M07, M13, M16, M20, M21 student side, M25 and Audio KBAT play into B1 with cards BE-41..BE-48 [pending card] and BE-24); in a card's scope but not listed 0; no card but needed 0. Total 143 -> 110 (card audit) -> 112 (UD) -> 19 (D53).

### 5.1 In a card's scope but not listed (0)

None. The 33 endpoints that were here (M01 2, M02 6, M03 16, M04 5, M05 1, M10 3) are now in the card tables: BE-06, BE-05, BE-08, BE-09/BE-10 and BE-09. The audit moved some ownership, which the parts now show in their Card column: `GET /api/admin/schools/:id/quota` (M02-15), `POST /api/admin/students/import` (M02-14) and the user-package routes (M02-11/12) are BE-25, not BE-05; `GET /api/remedial-tests/mine`, `GET /api/missions/today` and `GET /api/remedial-tests/:id` (M05-21..23) are BE-18, no longer BE-13.

### 5.2 Out of B1 / backlog (0)

None. D53(a) (owner decision 2026-10-19) puts every module reachable in the prototype into B1: M06 -> BE-41, M07 -> BE-42, M13 -> BE-43 (AI through the BE-36 adapter), M16 -> BE-44/BE-45 (split TBC; replicate the bot simulation), M20 -> BE-46, M21 student side -> BE-47 (Penaja out, D48), M25 -> BE-48, M09 Audio KBAT student play -> BE-24. The new cards are being written; Card fields show [pending card]. The 106 endpoints formerly listed here (M06 14, M07 21, M13 10, M25 1, M16 52, M20 5, M21 1, M09 2) are no longer uncovered.

### 5.3 Dropped or not built by owner decision 2026-10-19 (19)

| Endpoint | Module | Reason |
|---|---|---|
| `POST /api/admin/users/:id/impersonate` (M02-09) | M02 | Not ported, dropped by user decision (UD-2); Mod Pelajar is `POST /api/session/mode` only |
| `POST /api/admin-sekolah/users/:id/impersonate` (M27-21), `POST /api/admin-sekolah/impersonate/leave` (M27-22) | M27 | Not ported, dropped by user decision (UD-2) |
| `GET /api/parent/hadiah-approvals` (M15-08), `POST .../:id/approve` (M15-09), `POST .../:id/reject` (M15-10) | M15 | Not in B1, user decision (UD-3): the backend does not register them and the frontend hides the entry point; card none |
| Teacher economy: `/api/guru/gamification*` (M14-11..16) and `/api/admin/gamification/guru*` (M14-30..36) | M14 | Not in B1 (D53 OWN-10): teacher wallets, cash-out, teacher shop and badges are backlog |

M18 Amaran (`GET /api/amaran/schools/:id`, `/summary`, `/effectiveness`, `/export/school/:id`; M18-01..04) is no longer uncovered: UD-4 folds it into BE-21.

Not HTTP, no card endpoint: `BJ-04 subjects()` (Bijak subject dictionary), intake `IN-05 submitForReview` (batch Draf to Semakan; BE-10 owns submit, OQ B2-26) and `IN-09` DSKP units for the intake tag selector (OQ B2-30); `IN-04 saveExtracted` is only partly covered (BE-38 has item-level PATCH, no batch replace, OQ B2-25). IN-06 and IN-08 have no public endpoint of their own. Card-only endpoints without a mock (photo upload, admin papers and blueprints BE-39, AI status/usage BE-36, intake dashboard BE-40) are in part 2 sections 11 and 12. These do not change the 110 HTTP total.

## 6. Cross-cutting open questions

Deduplicated from the 4 parts. Part-local ids: `B1-n` = `OQ-API-B1-n` (part 1), `B2-n` = `OQ-API-B2-n` (part 2), `B3-n` = `OQ-API-B3-n` (part 3), `B4-n` = `OQ-API-B4-n` (part 4). Each is a decision for the LEAD (or user) before the affected cards are built or the frontend switch is done.

| # | Question | Part ids |
|---|---|---|
| CC-1 | **RESOLVED by UD-1 (strings, per the contract).** **Numeric vs string ids.** Mock and clients use integers (also in query params, `ids: number[]`, `link`/`href` strings); the contract and plan say opaque decimal strings. Realign frontend types per domain, or keep numbers? | B1-4, B2-1, B3-15, B4-1 |
| CC-2 | **RESOLVED by UD-1 (contract: cookie + CSRF, `Session`, 401 `INVALID_CREDENTIALS`, no Bearer).** **Login/session shape and transport.** Mock login takes `{email,password,remember}` and returns `{data:{token,expiresAt,user}}` (Bearer, 422 `Email atau kata laluan tidak sah.`); the contract takes `{identifier,password,schoolId?,remember}`, returns `{data:Session}` with a cookie and CSRF (401 `INVALID_CREDENTIALS`). Register and reset also return the mock `SessionPayload`. Which side moves? Also `ROLE_OUT_OF_SCOPE` prototype guard, registration fields (join code vs `schoolId`). | B1-1, B1-2, B1-7, B1-8 |
| CC-3 | **RESOLVED by UD-2 (impersonation dropped; Mod Pelajar only).** **Impersonation vs Mod Pelajar.** M02-09 ("Login As") opens a second full session with no return path and student id 2 hard-coded; M27 has its own impersonate/leave with a parent token; the contract has `POST/DELETE /session/mode` (same session, `is_test` stamping). Keep, replace or define semantics (audit, `is_test`)? Bijak role question belongs here too. | B1-6, B3-13, B2-12 |
| CC-4 | **Epoch ms vs `+08:00`.** Bijak times (`startedAt`, `deadline`, `savedAt`, `submittedAt`), `serverNow` and the M18 `generatedAt` are epoch ms in the mock; the contract serialises `+08:00` strings. | B2-13, B3 (section 2 Time) |
| CC-5 | **Generic message language.** Mock generic 401/403/404/422/500 and validation messages are English Laravel text; the contract says BM. Does the real API return BM, and does the UI show its own copy? | B1-3, B2-18 |
| CC-6 | **Non-standard bodies.** `{data,status}` flash siblings (envelope has no `status`), bare arrays/objects, `{ok,message}`, `{success,message}`, `200 {"error":"..."}`, un-enveloped chat body, module-specific `meta` (`currentSyiling`, `completed/active`, `count/schoolSet`, `tiles/levels`), file/CSV bodies. Reproduce exactly (switch is a no-op) or realign client and contract together? | B1 (Env-DS), B2-11, B2-19, B2-20, B3-14, B4-2 |
| CC-7 | **Roles.** Mock has 8 roles (`jpn_officer`); the contract has 7 (one PPD/JPN role, D31a). Landing paths and `roleCounts`. | B1-5, B3-11 |
| CC-8 | **Role scope not enforced / admin vs school admin.** Many reads accept any session (topics, practice, M16, `GET /api/schools`); admin routes refuse `school_admin` while cards describe school-scoped access; teachers see all-schools monitoring/Kirkpatrick data; Kirkpatrick for school admin (matrix vs mock). | B1-12, B1-13, B1-14, B2-6, B3-5, B3-7, B4-26 |
| CC-9 | **`is_test` and aggregates.** Plan stamps Mod Pelajar writes with `is_test` and excludes them from aggregates; no mock handler filters it. Which endpoints exclude it, and are test rows hidden from teacher lists? | B3-1, B2-12 |
| CC-10 | **Privacy of minors.** Public student profile (no session), student names on leaderboards, opponent search, battle history; parent-invite preview on a public endpoint; interventions/wellbeing data without scope; e-mail enumeration (M21). | B3-2, B3-9, B4-4, B4-20, B1-15 |
| CC-11 | **Security copy vs fidelity.** Password reset discloses account existence, returns the reset token for IC reset and does not invalidate sessions; default passwords returned to the admin UI; solo-game answer keys sent to the client; invite tokens in clear, reusable. Card requirements differ from the mock. | B1-10, B1-15, B1-16, B4-24 |
| CC-12 | **Card text vs mock.** Request/response/path differences between cards and mock (check-answer body, `/attempts` path, `clientUuid`, conversion daily cap, video approval state, BE-23 example paths, BE-24 AC, `GET /api/schools` public) and cards that omit routes. Cards need updating from the catalogue. | B1-8, B1-14, B2-3, B2-4, B2-7, B4-3, B4-9, B4-16 |
| CC-13 | **Stale counts and uncovered lists.** Plan 6.3 and the READMEs (section 3 above). The card tables were audited (63d363c); the remaining uncovered endpoints are backlog or M18 (section 5). | B1-19, B2-5, B2-9, B4-22 |
| CC-14 | **Pagination.** Fixed page sizes vs `pageSize` (max 100); M27 clamps an out-of-range page instead of returning an empty page; some lists return all rows although the card says paginated. | B1-20, B3-15, B4-2 |
| CC-15 | **Files, uploads, exports.** Mock stores only metadata or data URLs; real endpoints need BE-04 storage, limits, magic-byte checks, CSV formula-injection guard, PDF export (`PdfPort`), multipart vs two-step upload. | B1-9, B2-22, B3-18, B3-6, B4 (section 3 Files) |
| CC-16 | **Mock constants vs computed values.** Display constants and stored aggregates (M12 correlation, M17 engagement buckets, M08 GPS rows, SPM targets progress, Sekolah Bersaing snapshots, hub constants) have no computation rule; also performance of full-log scans. | B3-8, B3-17, B2-8, B2-9, B4-14 |
| CC-17 | **Deletes, audit and side effects.** Cascade vs restrict on deletes, no `audit_events` for admin writes, GET endpoints that write (view counters, referral code). | B1-22, B4-6, B4-7, B4-28 |
| CC-18 | **RESOLVED by D53 (2026-10-19): B1 = every module reachable in the prototype; teacher economy backlog.** **Scope boundaries.** External AI stubs (M13/M25), PKSK as tags, M06 retirement, teacher economy, parent routes, M16 simulation (parent routes: UD-3 not in B1; M18: UD-4 folded into BE-21), SPM intake (D52) documented as operations only, with no HTTP mock. | B2-10, B2-11, B2-17, B2-23..B2-30, B3-12, B4-11, B4-23, B4-25 |
| CC-19 | **Hard-coded hosts and fixtures.** Share/referral links use `https://prestasiplus.my`; fixture ids/tokens must not be reproduced. | B4-5, B1-21 |

Part-local questions that do not repeat elsewhere stay in the part (for example B3-3 weekly report 403, B3-4 headcount entry, B3-10 two Command Center families, B3-16 ranking order, B4-8 lucky draw, B4-13 league status).

## 7. Cross-part notes

Substantive conflicts and overlaps found while comparing the parts (formatting inconsistencies were fixed in the parts, see "Edits made").

1. **No duplicate method+path** across the 495 summary rows (checked by script).
2. **Endpoints called by another module's client / data owned elsewhere.**
   - `GET /api/remedial-tests/mine` (M05-21) and `GET /api/missions/today` (M05-22) (and `GET /api/remedial-tests/:id`, M05-23) are in part 2 (M05), and after the card audit are listed in BE-18 (BE-13 now says they are not in its card; the mock reads M10 records through seams). Build them with BE-18's data model.
   - `GET /api/guru/dskp/{bidang,sk,sp}` are registered by M04 (M04-28..30, BE-10, part 2) but the data and the POST creates are M10 (part 3, BE-18). One implementation please (B2-21).
   - `GET/POST /api/guru/questions*` (M10, part 3) write the M04 question store; BE-09 now lists all five `/api/guru/questions*` routes (part 3 no longer marks `:id` uncovered); part 2's OQ B2-21 says the same routes belong to the M10 part.
   - `GET /api/amaran/*` (M18, part 3) is called by the M27 school-admin client (part 3) and read by the M27 dashboard (BE-21); now BE-21 scope (UD-4). UD-4 folds the family into BE-21, so there is no longer a cross-card gap.
   - `GET /api/duta/recommendations` is registered by M06 (M06-14) but declared in the M25 client; counted once, under M06.
   - `GET /api/me/gamification-summary` (C-02, part 1, BE-11) is the M14 SRS route #1; part 4 excludes it (resolves B4-27).
   - M02 `GET /api/schools` (M02-31) is consumed by M04 (SRS #31); `GET /api/admin/schools/options` is an XL-13 alias of `GET /api/schools?all=1`.
   - M14 wallet writes: M15 and M16 call the M14 wallet service in the caller's transaction (ADR-0014); M05/M06/Bijak submit calls also feed it (gamification result in M05-03).
3. **Notation differences** (documented in the parts, not rewritten): envelope names (section 4 table); card column is now uniform (`BE-nn` or `UNCOVERED`) in all four parts after the card audit; the earlier per-part differences in how "uncovered" was counted are gone.
4. **Contract vocabulary** is `exists / partial / missing` in all parts; part 1's `exists (no mock)` was normalised to `exists`; Bijak row BJ-12 uses `n/a` (scheduled job, no endpoint).
5. **Part 2 section 11 (D52 intake)** is final: documented as 10 operations IN-01..IN-10 from commit b2e1033 (a browser-side domain/store, no HTTP routes), with OQ-API-B2-23..30. Route total stays 99; the 52 uncovered routes are unchanged. Operations without a card endpoint: IN-05, IN-09; partial: IN-04.
6. **Part 2 state:** consistent with the index; no fixes outstanding. Cosmetic only: part 2 lists open questions in a table while parts 1 and 3 use bullets.
7. **Edits made to parts 1, 3, 4 for consistency:** part 3 summary/headings now carry `Mnn-kk` ids (were bare numbers and bare headings); part 4 endpoint headings now put the method and path in backticks like parts 1 to 3; part 1 contract value `exists (no mock)` normalised to `exists`.

## 8. Verification

- Route totals recounted (section 3); all four parts match.
- Sample of 10 endpoints checked against the mock code (path, guard, one message verbatim): M01-01 `POST /api/auth/login` (`Email atau kata laluan tidak sah.`), M02-09 impersonate (admin only; `Anda tidak boleh Login As akaun sendiri.`), M03-06 `DELETE /api/admin/subjects/:id` (admin only; `Subjek tidak dijumpai.`), M04-10 report (`Sumber laporan tidak sah.`), M08 `GET /api/weekly-report` (`requireAuth`, always 403), M10 `POST /api/guru/chapters` (`teacherOnly`, `200 {error}` with `Nama bab diperlukan.`), M14-05 convert (`Jumlah syiling tidak sah.`), M15-03 `POST /api/hadiah/redemptions` (path and guard), M22-02 `POST /api/tiket` (`Subjek diperlukan.`), M27 `POST /api/admin-sekolah/users/:id/impersonate` (guard and error order). All matched; no corrections needed.
