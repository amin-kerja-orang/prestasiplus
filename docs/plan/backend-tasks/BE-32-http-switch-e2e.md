# BE-32 Compose stack, nginx proxy, Vite dev proxy and Playwright e2e against the real API

| Field | Value |
|---|---|
| Size | M |
| Wave | 4 (can start a first version after BE-03 + BE-07; repeat per domain) |
| Depends on | BE-03, BE-07, BE-31 (domains as they land); **lead task V2-T31 (HttpTransport hardening + hybrid mode)** |
| Parallel with | domain cards |
| Owner module | integration (joint card: collaborator + lead) |

## Goal

Make the real stack runnable and testable: `docker compose up` brings up `db`, `api` and `frontend` on one origin; Vite dev proxies `/api`; a Playwright configuration runs the e2e specs that are valid against a real backend; and each merged domain gets a documented "switch to http" checklist the lead applies.

## Inputs (read these)

- `docs/architecture/v2-backend-plan.md` section 7
- `compose.yaml`, `docker/frontend/nginx.conf`, `docker/frontend/Dockerfile`, `docs/ops/containers.md`, `.env.example`, `vite.config.ts`, `src/app/bootstrap.ts`, `src/api/http-transport.ts`
- `playwright.config.ts`, `e2e/fixtures/*`, `e2e/support/*`, `scripts/e2e-module.mjs`, `docs/adr/0011-testing-strategy.md`
- `docs/architecture/v2-frontend.md` task V2-T31 (HybridTransport)

## Outputs

- `docker/frontend/nginx.conf`: `location /api/ { proxy_pass http://api:3000; ... }` with forwarded headers, a body-size limit matching `MAX_UPLOAD_MB`, no caching of `/api`, and a timeout; keep `/healthz`
- `compose.yaml`: final `frontend`/`api`/`db` wiring, `migrate` one-off job (`prisma migrate deploy` then optional seed) before `api` starts; a `compose.http.yaml` overlay or env that builds the frontend with `VITE_API_MODE=http`
- `vite.config.ts`: dev server proxy `/api` to `http://localhost:3000` (the only edit to this file allowed in the backend track; lead reviews)
- `playwright.http.config.ts` (new): a project set that starts the compose stack (or expects `BASE_URL`), seeds the PoC profile, and runs only specs tagged `@api` (specs that do not need `mock-handle`, fault injection, clock control or mock-only fixtures); a short list of the first specs to tag (login, role switch, a practice session, a Bijak attempt) agreed with the lead
- `docs/plan/http-switch-checklist.md`: per-domain checklist (contract merged, conformance scenarios, seed present, ids as strings handled in the UI, hybrid prefix added, module e2e run in both modes)
- npm scripts at root: `stack:up`, `stack:down`, `test:e2e:http`

## Endpoints

None new.

## DB tables touched

None.

## Acceptance criteria

1. `docker compose up -d --build` then opening `http://localhost:5192` shows the SPA; `curl /api/health` through nginx returns the envelope; the cookie set by login is `HttpOnly; SameSite=Lax` and not visible to JavaScript.
2. `npm run dev` + `npm run be:dev`: the SPA calls `/api/...` through the Vite proxy with no CORS configuration.
3. `npm run test:e2e:http -- --grep @api` passes for the first agreed specs on desktop viewport (and mobile/tablet projects) against the seeded stack; failures from mock-only hooks are excluded by tag, not by deletion.
4. The `migrate` job runs once, is idempotent, and `api` waits for it.
5. `.env.example` / `.env.api.example` list the new keys; no secrets in compose.
6. The checklist is filled in for every domain already merged at the time of the PR.
7. The root `npm run verify` (frontend) is still green.

## Test commands

```
docker compose up -d --build
npm run test:e2e:http -- --grep @api
npm run verify
docker compose down
```

## Programme update (2026-10-19)

- Programme update: nginx `client_max_body_size` and proxy read timeouts must fit `INTAKE_MAX_FILE_MB` uploads and polling; add the intake/builder specs to the `@api` set when the lead has them.

## Prompt for Claude Code

```text
You are the backend developer for PrestasiPlus v2 working on task BE-32 (http-switch-e2e). Work in this repo clone on branch be/BE-32-http-switch-e2e, created from the latest origin/feature/v2-backend.
Read first, in order: AGENTS.md; docs/architecture/v2-backend-plan.md (sections 3, 6, 9, 10); docs/plan/backend-tasks/BE-32-http-switch-e2e.md (this card, all of it).
Rules: contract first (zod schemas in packages/contract/src/<domain>/, import z from ../zod, register in src/openapi.ts, run npm run contract:emit and commit openapi.json before the implementation). The frontend mock handlers, the typed client and the SRS listed in the card are the behavioural spec: do not invent business rules; write every unknown under "Open questions" in the PR description. Never commit secrets or real personal names. Do not edit src/**, e2e/**, docs/TRACKER.md or the contract common/session/auth/access folders (BE-14 and BE-32 have the explicit exceptions stated in their cards). Keep the diff inside the card Outputs.
When finished run npm run be:verify (and the card test commands) and report: files changed, endpoints done, tables, real test output, deviations from the mock/contract, open questions.
Task: implement BE-32. This is a joint card: you may edit compose.yaml, docker/frontend/nginx.conf, vite.config.ts (proxy only) and add playwright.http.config.ts and root scripts, but do NOT edit src/**; list the frontend changes you need (HttpTransport credentials/CSRF, hybrid prefixes, string-id handling) as a checklist for the lead in docs/plan/http-switch-checklist.md. Tag-based selection only: never delete or edit existing e2e specs.
```
