# HTTP switch checklist (BE-32)

How a domain moves from the in-browser mock to the real API. The LEAD applies this per domain (task L5);
the backend PC fills the "backend side" rows when its card merges. Owner of the transport: LEAD, task
L1 = V2-T31 (`HttpTransport` hardening + `HybridTransport`, see [v2-frontend.md](../architecture/v2-frontend.md)).

Run the stack: `npm run stack:up` (compose.yaml + compose.http.yaml), then `npm run test:e2e:http -- --grep @api`.
Dev loop without Docker for the SPA: `npm run be:dev` (API on 3000) and `VITE_API_MODE=http npm run dev`
(Vite proxies `/api` to `http://localhost:3000`; put `COOKIE_SECURE=false` in `.env.api`).

## Prerequisites that block every domain (LEAD L1 / V2-T31)

Status when this file was written: L1 is **todo**; `createHttpTransport()` in `src/api/http-transport.ts` is called with
no options in `src/app/bootstrap.ts`.

| # | Needed in `src/api` / `src/app` | Why | State |
|---|---|---|---|
| T1 | `credentials: 'include'` (same-origin default sends the cookie, but make it explicit for the Vite proxy and any `VITE_API_BASE_URL`) | session cookie `pp_session` is `HttpOnly; SameSite=Lax` | todo |
| T2 | CSRF: read the token from the login / `GET /api/session` response and send `X-CSRF-Token` on every non-GET | the API answers 403 `CSRF_INVALID` otherwise (`apps/api/src/modules/auth/auth.constants.ts`) | todo |
| T3 | 401 handling: clear the stored session and go to `/login` | session expires after 120 min idle | todo |
| T4 | `requestId` logging: read `X-Request-Id` from responses | nginx sets one per request, the API echoes it | todo |
| T5 | `HybridTransport` (`VITE_API_MODE=hybrid`, list of path prefixes served by the real API; the rest stays on the mock) | switch one domain at a time | todo |
| T6 | `bootstrap.ts` builds `hybrid` mode and keeps the mock tree-shaken out of a pure `http` build | bundle size, no mock data in production | todo |
| T7 | Session bootstrap in http mode: no `__MOCK_INIT__`; a reload restores the session from `GET /api/session` | `loginAs` fast login is mock-only | todo |
| T8 | An e2e fixture for real-API specs (`e2e/fixtures/api.ts`: plain `@playwright/test` `test`, `page.goto`, wait for `#app`) | `e2e/fixtures/test.ts` installs the mock clock and `gotoApp` waits for `window.__mock.ready` | todo (LEAD owns `e2e/**`) |

## Per-domain checklist (copy for every new domain)

1. Contract merged and registered; `npm run contract:check` is green.
2. Conformance scenarios for the domain run in `apps/api/test/conformance` (no "not yet implemented" for it).
3. Seed present in the poc profile (idempotent; demo accounts use `Demo1234`).
4. Ids are strings or numbers exactly as the contract says; the UI does not do arithmetic or `Number()` on opaque ids (file ids are opaque 128-bit strings).
5. Hybrid prefix added to the env list (for example `/api/admin/users`), and the mock handler for that prefix is no longer reached.
6. Module e2e passes in both modes: the mock suite (`npm run test:e2e:module -- <mXX>`) and the real-API suite (`@api` specs, 3 viewports).
7. Error copy (Bahasa Melayu) comes from the API error `message`, not from a client-side map, and matches the mock.
8. nginx: if the domain adds a multipart or large-body route, add a `location` with its own `client_max_body_size` in `docker/frontend/nginx.conf` (only `POST /api/files` has the 22m limit today).
9. Env keys added to `.env.api.example` and read from the platform secret store in deploy.

## Domains merged at the time of writing

Hybrid prefixes below are proposals (the final env name comes from V2-T31). "E2E @api" means a Playwright spec that can run
against the real stack once T1 to T8 exist.

| Domain | Card | Frontend module | API prefixes (hybrid) | Seed | Conformance | Notes for the switch | E2E @api (proposal) |
|---|---|---|---|---|---|---|---|
| Auth and session | BE-03 | M01 | `/api/auth`, `/api/session` | BE-07 core population (46 users, 4 schools) | `auth/` folder | Cookie + CSRF (T1, T2); roles/mode switch via `POST /api/session/role`, `/api/session/mode`; login throttle 5 per minute (the e2e overlay raises it to 200) | login; cookie flags (`HttpOnly`, `SameSite=Lax`, absent from `document.cookie`); role switch |
| Files | BE-04 | shared | `/api/files` | none | `files/` folder | Multipart `POST /api/files` (max 10 MB global ceiling, per purpose lower); download `GET /api/files/:id`; ids opaque; non-public files are `no-store` | upload below and above the limit |
| Users and schools | BE-05 | M02 | `/api/admin/users`, `/api/admin/schools`, `/api/schools`, `/api/jpn`, `/api/students/search`, `/api/admin/teachers`, `/api/admin/schools/:id/students` | BE-07 | `users/`, `schools/` folders | Bulk import JSON up to 2200 kb (nginx allows 3 MB on `/api/`); admin-only writes; IC numbers never in responses | admin user list, school toggle |
| Subscriptions, packages, parent invites | BE-25 | M02, M01 (invites) | `/api/admin/school-packages`, `/api/admin/school-subscriptions`, `/api/admin/users/:id/packages`, `/api/admin/students/import`, `/api/admin/schools/:id/quota`, `/api/me/parent-invite`, `/api/me/parent-links`, `/api/parent-invites/:token`, `/api/admin/parent-links` | BE-07 + reference packages | covered by the shared scenarios | The invite token is a path secret: nginx and the API both log it as `[redacted]`; do not put it in a `Referer`-bearing external link | parent invite preview |
| Seed core population | BE-07 | all | n/a | `be:db:seed` (poc) | accounts table in `conformance/accounts.ts` | Demo accounts are dev/e2e only (`ALLOW_DEMO_SEED=true`), production loads the reference catalogue only | n/a |

Practice (BE-12), Bijak attempts (BE-16), intake and builder are not merged yet: add their rows when they land.

## First `@api` specs (agreed with the LEAD, Open question 1)

| Spec | Possible today | Reason |
|---|---|---|
| Login + cookie flags + role switch | Yes, once T1, T2, T7, T8 exist | API merged (BE-03) and seeded (BE-07) |
| Practice session | No | needs BE-12 |
| Bijak attempt | No | needs BE-16 |
| Upload over/under the limit | Yes, once T2, T8 exist | API merged (BE-04); also checked with curl in the BE-32 PR |

No existing spec can be tagged `@api` unchanged: every spec imports `e2e/fixtures/test.ts`, which installs the
mock clock and whose `gotoApp` waits for `window.__mock.ready`. Selection is by the `@api` tag in
`playwright.http.config.ts` (`grep: /@api/`); new `@api` specs are written by the LEAD (T8).

## Environment promotion notes

- `compose.http.yaml` is for dev and e2e. It sets `ALLOW_DEMO_SEED=true` on the `migrate` job, `COOKIE_SECURE=false`, and `BIJAK_POC_QUESTIONS=true` on the `api` service. Any staging that loads the demo seed must also set `BIJAK_POC_QUESTIONS=true` on the API (Bijak PoC papers and Jana pool; LEAD decision 2026-10-20: staging only). Production leaves it `false`; never turn it off on a database with in-progress PoC attempts (they would fail with 500 until abandoned).
  Staging and production use `compose.yaml` (or the platform equivalent) only: `migrate` runs `prisma migrate deploy`
  and never seeds demo data.
- `TRUST_PROXY_HOPS=1` is fixed in `compose.yaml` for the api service (one nginx hop). Change it only together with the proxy chain.
