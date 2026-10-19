# BE-33 Security hardening, observability and release readiness

| Field | Value |
|---|---|
| Size | M |
| Lane | PC-1 (folders: sessions.md section 5) |
| Priority | P2 |
| Wave | 4 |
| Depends on | BE-32, BE-16, BE-38, BE-39 |
| Parallel with | BE-30 |
| Owner module | platform |
| Security review | required |

## Goal

Close the gap between "works" and "can be deployed": global security headers and rate limits, input/size limits, dependency and image scanning, audit coverage, backup/restore, metrics, graceful shutdown, and the operations runbook for the `api` and `db` services.

## Inputs (read these)

- `docs/plan/AGENT-SYNC.md`, `docs/plan/sessions.md` section 5
- `docs/architecture/v2-backend-plan.md` sections 3, 9, 11, 14.8 and 15
- `docs/ops/containers.md`; files created by BE-01/BE-32 that this card edits: `docker/api/Dockerfile`, `.github/workflows/api.yml`, `compose.yaml` (all exist after BE-01/BE-02)
- `docs/requirements/v2-portals.md` (NFR security items, audit requirements, US-16)
- `docs/architecture/v2-data-migration.md` section 5 (PII)
- OWASP ASVS L1 checklist (summarise what you covered; do not copy it)
- The merged domain modules (BE-03 to BE-25 as available) for the sampled-route tests

## Outputs

- `apps/api/src/common/security/**`: `helmet`, global throttler defaults, body-size limits, request timeout, trusted proxy config for the nginx hop, cookie flags by env
- `apps/api/src/common/audit/**` (extends BE-03's `AuditService`): coverage tests and any missing audit calls in `common/`; a gap inside another lane's module is a `cross-lane` issue to that lane
- `apps/api/src/common/health/**` (extends BE-01/BE-02): `/api/ready`, graceful shutdown hooks
- `apps/api/src/common/metrics/**`: Prometheus-style `/api/metrics` guarded to the internal network or admin, or structured request-duration logs
- CI additions in `.github/workflows/api.yml`: `npm audit --omit=dev` threshold, container image scan (for example Trivy), dependency review, with an allow-list file
- `docs/ops/api-runbook.md`: env keys, start/stop, migrations, seed rules, backup and restore of `pgdata` (`pg_dump`), log locations, incident basics, secret rotation
- Tests under `apps/api/test/security/**`

## Files touched

Everything a PC may write for this card. A path outside this list needs a `cross-lane` issue first (sessions.md section 5).

- Folders written: `apps/api/src/common/security/**`, `apps/api/src/common/audit/**`, `apps/api/src/common/health/**`, `apps/api/src/common/metrics/**`, `apps/api/test/security/**`, `docker/api/Dockerfile`, `.github/workflows/api.yml`, `docs/ops/api-runbook.md`.
- Prisma file(s): none (no schema change).
- Contract: none.
- Seeds: none.
- Tests: `apps/api/test/security/**`, and (after BE-31) new scenario files in `apps/api/test/conformance/security/`.
- Append-only shared files (one line each, never reorder): `docs/architecture/v2-backend-deviations.md` (a dated row only if you deviate); your own row in `docs/plan/backend-tracker.md`.
- No-clash note: No Prisma file. It edits PC-1 files only; fixes needed inside other lanes' modules are `cross-lane` issues.

## Endpoints (new infrastructure routes; no mock route exists)

| Method and path | Notes |
|---|---|
| `GET /api/ready` | 200 when the DB is reachable and migrations are applied, 503 `SERVER_ERROR` otherwise; no auth |
| `GET /api/metrics` | internal network or `admin` only (403 otherwise); no personal data in labels |

## DB tables touched

`audit_events` (writes), none new.

## Acceptance criteria

1. Security tests: a mutating request without a valid CSRF token gives 403 `CSRF_INVALID` on one route of every mutating route group (the list of groups is the set of modules registered in `modules/index.ts`); a cross-user id gives 404 on one sampled route per domain; mass assignment (an extra field in a body) is rejected 422 by the strict schemas on the same sampled routes; an oversized body is rejected 413; SQL-injection strings in filters of the search endpoints (users, schools, questions, articles) return normal results and change nothing (parameterised, tested on each).
2. Rate limits exist for login, password reset, registration, file upload and ticket creation; `RATE_LIMITED` (429) includes `retryAfter`; defaults are the mock's where it has one (login 5 failed attempts per 60 s; reset one request per e-mail per 60 s) and configurable otherwise; the chosen numbers are in the runbook.
3. Cookies: `HttpOnly`, `Secure` (production), `SameSite=Lax`, domain from env; no token in any response body (a recursive scan over the login, session and role-switch responses).
4. Every item of the audit list writes a row with actor, role, scope, action, target and request id and never personal content, one test per item: role switch, mode enter/exit (`audit_events`), user create/delete/toggle (BE-05), subscription changes (BE-25), question publish (`question_status_events`, BE-10), password reset (BE-06), impersonation or Mod Pelajar (BE-03/BE-21). A missing audit call is fixed by the owning lane before the release gate.
5. `docker run --read-only --tmpfs /tmp` of the api image as non-root works; `SIGTERM` finishes in-flight requests and closes the pool (test: start a slow request, send SIGTERM, the request completes and the process exits 0).
6. CI fails on high or critical vulnerabilities in production dependencies or the image, with a documented allow-list file; a deliberately vulnerable dev branch shows the failure (documented in the PR, not left in the repo).
7. The runbook was executed once: a `pg_dump` backup restored into a fresh database passes a row-count comparison (output pasted in the PR).
8. Secret scan green; a log-capture test over a login, a reset and an upload proves logs contain no password, cookie or IC.
9. Review items of D52: upload handling (magic bytes, page caps, PDF parsing without script execution), AI key handling and logging, SSRF protection on `AI_BASE_URL`, the redaction canary test, and the migration data-handling rules (dumps, `.migration-out/`) each have a line in the PR threat-model table (asset, threat, control, test) and an existing test is named for each.

## Test commands

```
npm run be:test -- apps/api/test/security
npm run be:verify
npm audit --omit=dev
docker build -f docker/api/Dockerfile -t pretasiplus-api:local . && docker run --rm --read-only --tmpfs /tmp pretasiplus-api:local node -v
npm run be:test -- apps/api/test/conformance   # only after BE-31 is merged
```

## Definition of Done

1. Plan section 10 (all ten items) is met.
2. `npm run contract:check && npm run be:verify` is green. Paste the real tail of the output in the PR.
3. Conformance (BE-31): once BE-31 is merged, add this card's scenarios as new files in `apps/api/test/conformance/security/` and run `npm run be:test -- apps/api/test/conformance`; a failure is a blocker. Before BE-31 merges, `be:verify` is the gate; write "conformance scenarios pending BE-31" in the PR.
4. This card creates no tables; the migration-first checklist (plan section 14.9) does not apply, but no change may break `npm run be:lint:migration` (once BE-34 is merged).
5. Label `security-review` on the PR; list the security decisions and the tests that prove them.
6. The card's tracker row is updated (status, PR number, one-line note) and the PR description follows the template in `docs/plan/backend-tasks/README.md`. Nothing stays only on your PC (AGENT-SYNC.md section 4).

## Open questions

Do not guess these; write your working assumption in the PR and ask the lead (issue labelled `question`) if it blocks you.

1. Rate-limit numbers for registration, upload and ticket creation are not in the mock. Working assumption: 10 per hour per IP for registration, 30 per hour per user for uploads, 5 per hour per user for tickets; confirm.
2. `GET /api/metrics`: internal network only or admin only? Working assumption: internal network (nginx does not proxy it) plus admin.

## Prompt for Claude Code

```text
You are the backend developer for PrestasiPlus v2 working on task BE-33 (hardening-release). Work in this repo clone on branch be/BE-33-hardening-release, created from the latest origin/feature/v2-backend.
Read first, in order: docs/plan/AGENT-SYNC.md (how to claim, commit and push); AGENTS.md; docs/architecture/v2-backend-plan.md (sections 3, 6, 9, 10, 14; section 15 for intake and builder cards); docs/plan/sessions.md section 5 (folder ownership); docs/plan/backend-tasks/BE-33-hardening-release.md (this card, all of it).
Rules: contract first (zod schemas in packages/contract/src/<domain>/, import z from ../zod, register in src/openapi.ts, run npm run contract:emit and commit openapi.json before the implementation). The frontend mock handlers, the typed client and the SRS listed in the card are the behavioural spec: do not invent business rules; write every unknown under "Open questions" in the PR description. Never commit secrets or real personal names. Do not edit src/**, e2e/**, docs/TRACKER.md or the contract common/session/auth/access folders (BE-14 and BE-32 have the explicit exceptions stated in their cards). Keep the diff inside the card Outputs and its "Files touched" list; commit after every green step and push at least hourly and before the session ends (AGENT-SYNC.md).
When finished run npm run be:verify (and the card test commands) and report: files changed, endpoints done, tables, real test output, deviations from the mock/contract, open questions.
Task: implement BE-33. Add the security and operations layer listed in the card without changing business behaviour. Write one security test per acceptance item. Produce docs/ops/api-runbook.md and run its backup/restore steps once. Needs a security review: include a short threat-model table (asset, threat, control, test) in the PR.
```
