# BE-32 Compose stack, nginx proxy, Vite dev proxy and Playwright e2e against the real API

| Field | Value |
|---|---|
| Size | M |
| Lane | PC-1 + LEAD (folders: sessions.md section 5) |
| Priority | P1 |
| Wave | 4 (can start a first version after BE-03 + BE-07; repeat per domain) |
| Depends on | BE-03, BE-07, BE-31 (domains as they land); **lead task V2-T31 (HttpTransport hardening + hybrid mode)** |
| Parallel with | domain cards |
| Owner module | integration (joint card: collaborator + lead) |

## Goal

Make the real stack runnable and testable: `docker compose up` brings up `db`, `api` and `frontend` on one origin; Vite dev proxies `/api`; a Playwright configuration runs the e2e specs that are valid against a real backend; and each merged domain gets a documented "switch to http" checklist the lead applies.

## Inputs (read these)

- `docs/plan/AGENT-SYNC.md`, `docs/plan/sessions.md` section 5 (BE-32 is the joint card with the lead)
- `docs/architecture/v2-backend-plan.md` section 7
- `compose.yaml`, `docker/frontend/nginx.conf`, `docker/frontend/Dockerfile`, `docs/ops/containers.md`, `.env.example`, `vite.config.ts`, `src/app/bootstrap.ts`, `src/api/http-transport.ts`
- `playwright.config.ts`, `e2e/fixtures/*`, `e2e/support/*`, `scripts/e2e-module.mjs`, `docs/adr/0011-testing-strategy.md`
- `docs/architecture/v2-frontend.md` task V2-T31 (HybridTransport)
- Prerequisite: lead task L1 (V2-T31, tracker "Lead tasks") is done and the lead tells you to start

## Outputs

- `docker/frontend/nginx.conf`: `location /api/ { proxy_pass http://api:3000; ... }` with forwarded headers, `client_max_body_size` matching `MAX_UPLOAD_MB` and `INTAKE_MAX_FILE_MB` (D52 uploads), proxy read timeouts that fit uploads and polling, no caching of `/api`; keep `/healthz`
- `compose.yaml`: final `frontend`/`api`/`db` wiring, a `migrate` one-off job (`prisma migrate deploy`, then optional seed) before `api` starts; a `compose.http.yaml` overlay or env that builds the frontend with `VITE_API_MODE=http`
- `vite.config.ts`: dev server proxy `/api` to `http://localhost:3000` (the only edit to this file allowed in the backend track; the lead reviews)
- `playwright.http.config.ts` (new): a project set that starts the compose stack (or expects `BASE_URL`), seeds the PoC profile, and runs only specs tagged `@api` (specs that do not need `mock-handle`, fault injection, clock control or mock-only fixtures); the first specs to tag (login, role switch, a practice session, a Bijak attempt) are agreed with the lead; intake and builder specs are added to the `@api` set when the lead has them
- `docs/plan/http-switch-checklist.md`: per-domain checklist (contract merged, conformance scenarios, seed present, ids as strings handled in the UI, hybrid prefix added, module e2e run in both modes)
- Root `package.json` scripts: `stack:up`, `stack:down`, `test:e2e:http`; `.env.example` and `.env.api.example` keys

## Files touched

Everything a PC may write for this card. A path outside this list needs a `cross-lane` issue first (sessions.md section 5).

- Folders written: `docker/frontend/nginx.conf`, `compose.yaml`, `playwright.http.config.ts`, `docs/plan/http-switch-checklist.md`.
- Prisma file(s): none (no schema change).
- Contract: none.
- Seeds: none.
- Tests: none.
- Other files: `vite.config.ts` (the `/api` dev proxy only; explicit exception in sessions.md section 5); `compose.http.yaml` (new overlay), `.env.example`, `.env.api.example`, root `package.json` scripts (`stack:up`, `stack:down`, `test:e2e:http`); never `src/**`, `e2e/**` or existing specs (tag selection only).
- Append-only shared files (one line each, never reorder): `docs/architecture/v2-backend-deviations.md` (a dated row only if you deviate); your own row in `docs/plan/backend-tracker.md`.
- No-clash note: No Prisma file. compose.yaml, nginx.conf and vite.config.ts are shared files: keep edits minimal and rebase before the PR; BE-01 and BE-02 edited compose.yaml earlier.

## Endpoints

None new.

## DB tables touched

None.

## Acceptance criteria

1. `docker compose up -d --build`, then `http://localhost:5192` (compose `FRONTEND_PORT` default) shows the SPA; `curl http://localhost:5192/api/health` returns the envelope through nginx; the cookie set by `POST /api/auth/login` is `HttpOnly; SameSite=Lax` and `document.cookie` does not show it (checked in the first `@api` spec).
2. `npm run dev` + `npm run be:dev`: the SPA calls `/api/...` through the Vite proxy with no CORS configuration (a spec or curl against port 5173 proves it).
3. `npm run test:e2e:http -- --grep @api` passes for the first agreed specs on the desktop project and on the mobile and tablet projects against the seeded stack; specs that need mock-only hooks are excluded by tag, never deleted or edited.
4. The `migrate` job runs once, is idempotent (second `up` changes nothing) and `api` waits for it (`depends_on: condition: service_completed_successfully`).
5. `.env.example` / `.env.api.example` list the new keys; `docker compose config` shows no secret values; an upload larger than `MAX_UPLOAD_MB` through nginx gets a 4xx and a file just under it passes.
6. `docs/plan/http-switch-checklist.md` is filled in for every domain already merged at the time of the PR.
7. Root `npm run verify` (frontend) is still green.

## Test commands

```
docker compose up -d --build
npm run test:e2e:http -- --grep @api
npm run verify
docker compose down
```

## Definition of Done

1. Plan section 10 (all ten items) is met.
2. `npm run contract:check && npm run be:verify` is green. Paste the real tail of the output in the PR.
3. This card has no HTTP endpoints, so it adds no conformance scenarios; after BE-31 merges, `npm run be:test -- apps/api/test/conformance` must still pass.
4. This card creates no tables; the migration-first checklist (plan section 14.9) does not apply, but no change may break `npm run be:lint:migration` (once BE-34 is merged).
5. No security review is required; list any security-relevant decision in the PR anyway.
6. The card's tracker row is updated (status, PR number, one-line note) and the PR description follows the template in `docs/plan/backend-tasks/README.md`. Nothing stays only on your PC (AGENT-SYNC.md section 4).

## Open questions

Do not guess these; write your working assumption in the PR and ask the lead (issue labelled `question`) if it blocks you.

1. Which specs are tagged `@api` first is agreed with the lead (login, role switch, a practice session, a Bijak attempt are the proposal).
2. The `migrate` job seeds only in dev profiles; confirm that production never seeds (BE-26 AC7 refuses without `--force-demo`).

## Prompt for Claude Code

```text
You are the backend developer for PrestasiPlus v2 working on task BE-32 (http-switch-e2e). Work in this repo clone on branch be/BE-32-http-switch-e2e, created from the latest origin/feature/v2-backend.
Read first, in order: docs/plan/AGENT-SYNC.md (how to claim, commit and push); AGENTS.md; docs/architecture/v2-backend-plan.md (sections 3, 6, 9, 10, 14; section 15 for intake and builder cards); docs/plan/sessions.md section 5 (folder ownership); docs/plan/backend-tasks/BE-32-http-switch-e2e.md (this card, all of it).
Rules: contract first (zod schemas in packages/contract/src/<domain>/, import z from ../zod, register in src/openapi.ts, run npm run contract:emit and commit openapi.json before the implementation). The frontend mock handlers, the typed client and the SRS listed in the card are the behavioural spec: do not invent business rules; write every unknown under "Open questions" in the PR description. Never commit secrets or real personal names. Do not edit src/**, e2e/**, docs/TRACKER.md or the contract common/session/auth/access folders (BE-14 and BE-32 have the explicit exceptions stated in their cards). Keep the diff inside the card Outputs and its "Files touched" list; commit after every green step and push at least hourly and before the session ends (AGENT-SYNC.md).
When finished run npm run be:verify (and the card test commands) and report: files changed, endpoints done, tables, real test output, deviations from the mock/contract, open questions.
Task: implement BE-32. This is a joint card: you may edit compose.yaml, docker/frontend/nginx.conf, vite.config.ts (proxy only) and add playwright.http.config.ts and root scripts, but do NOT edit src/**; list the frontend changes you need (HttpTransport credentials/CSRF, hybrid prefixes, string-id handling) as a checklist for the lead in docs/plan/http-switch-checklist.md. Tag-based selection only: never delete or edit existing e2e specs.
```
