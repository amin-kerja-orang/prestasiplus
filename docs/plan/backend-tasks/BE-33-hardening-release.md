# BE-33 Security hardening, observability and release readiness

| Field | Value |
|---|---|
| Size | M |
| Wave | 4 |
| Depends on | BE-32 (and the domain cards in scope) |
| Parallel with | BE-30 |
| Owner module | platform |
| Security review | required |

## Goal

Close the gap between "works" and "can be deployed": global security headers and rate limits, input/size limits, dependency and image scanning, audit coverage, backup/restore, metrics, graceful shutdown, and the operations runbook for the `api` and `db` services.

## Inputs (read these)

- `docs/architecture/v2-backend-plan.md` sections 3, 9, 11
- `docs/ops/containers.md`, `docker/api/Dockerfile`, `compose.yaml`, `.github/workflows/api.yml`
- `docs/requirements/v2-portals.md` (NFR security items, audit requirements, US-16)
- `docs/architecture/v2-data-migration.md` section 5 (PII)
- OWASP ASVS L1 checklist (summarise what you covered; do not copy it)

## Outputs

- `apps/api/src/common/security/**`: `helmet`, global throttler defaults, body-size limits, request timeout, trusted proxy config for the nginx hop, cookie flags by env
- `apps/api/src/common/audit/**`: audit coverage for role switch, mode enter/exit, user create/delete/toggle, subscription changes, question publish, password reset, impersonation
- `apps/api/src/common/health/**`: `/api/health` (liveness), `/api/ready` (DB + migrations applied), graceful shutdown hooks
- `apps/api/src/common/metrics/**` (Prometheus-style `/api/metrics` guarded to the internal network or admin) or structured request-duration logs
- CI additions: `npm audit --omit=dev` threshold, container image scan (e.g. Trivy), dependency review
- `docs/ops/api-runbook.md`: env keys, start/stop, migrations, seed rules, backup and restore of `pgdata` (`pg_dump`), log locations, incident basics, secret rotation
- Tests under `apps/api/test/security/**`

## Endpoints

| Method and path | Notes |
|---|---|
| `GET /api/ready` | 200 when DB reachable and migrations applied, 503 otherwise; no auth |
| `GET /api/metrics` | internal or admin only |

## DB tables touched

`audit_events` (writes), none new.

## Acceptance criteria

1. Security tests: missing/invalid CSRF on every mutating route group returns 403; cross-user id access returns 404 on a sampled route per domain; mass assignment (extra fields) is rejected by strict schemas; oversized bodies are rejected; SQL injection strings in filters do not alter queries (parameterised, tested on search endpoints).
2. Rate limits exist for login, password reset, registration, file upload and ticket creation; `RATE_LIMITED` includes `retryAfter`.
3. Cookies: `HttpOnly`, `Secure` (prod), `SameSite=Lax`, domain from env; no token in any response body.
4. Every item in the audit list above writes an `audit_events` row with actor, role, scope, action, target, request id, never personal content; a test per item.
5. `docker run` of the api image as non-root with `--read-only` and a tmpfs works; `SIGTERM` finishes in-flight requests and closes the pool.
6. CI fails on high/critical vulnerabilities in production dependencies or the image (with a documented allow-list file).
7. The runbook was executed once: `pg_dump` backup and restore into a fresh db verified.
8. No secrets in repo (secret scan green); logs verified free of passwords, cookies and IC.

## Test commands

```
npm run be:test -- apps/api/test/security
npm run be:verify
npm audit --omit=dev
docker build -f docker/api/Dockerfile -t pretasiplus-api:local . && docker run --rm --read-only --tmpfs /tmp pretasiplus-api:local node -v
```

## Prompt for Claude Code

```text
You are the backend developer for PrestasiPlus v2 working on task BE-33 (hardening-release). Work in this repo clone on branch be/BE-33-hardening-release, created from the latest origin/feature/v2-backend.
Read first, in order: AGENTS.md; docs/architecture/v2-backend-plan.md (sections 3, 6, 9, 10); docs/plan/backend-tasks/BE-33-hardening-release.md (this card, all of it).
Rules: contract first (zod schemas in packages/contract/src/<domain>/, import z from ../zod, register in src/openapi.ts, run npm run contract:emit and commit openapi.json before the implementation). The frontend mock handlers, the typed client and the SRS listed in the card are the behavioural spec: do not invent business rules; write every unknown under "Open questions" in the PR description. Never commit secrets or real personal names. Do not edit src/**, e2e/**, docs/TRACKER.md or the contract common/session/auth/access folders (BE-14 and BE-32 have the explicit exceptions stated in their cards). Keep the diff inside the card Outputs.
When finished run npm run be:verify (and the card test commands) and report: files changed, endpoints done, tables, real test output, deviations from the mock/contract, open questions.
Task: implement BE-33. Add the security and operations layer listed in the card without changing business behaviour. Write one security test per acceptance item. Produce docs/ops/api-runbook.md and run its backup/restore steps once. Needs a security review: include a short threat-model table (asset, threat, control, test) in the PR.
```
