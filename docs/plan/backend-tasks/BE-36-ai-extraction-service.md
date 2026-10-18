# BE-36 AI extraction service: provider adapters, redaction, rate limit, cost log, budget cap

| Field | Value |
|---|---|
| Size | M |
| Wave | 1/2 (starts after BE-03) |
| Depends on | BE-03 |
| Parallel with | BE-04, BE-05, BE-08, BE-37 |
| Owner module | ai-extraction (new platform module; `ai_usage_logs` is its store) |
| Security review | required (external egress of document content, API keys) |

## Goal

(D52) A provider-agnostic server-side service that turns paper content (page text and/or page images, blueprint/structure hints, taxonomy) into structured question drafts with per-field confidence and source region, and suggests tags. Any provider can be configured server-side; CI runs on a deterministic **mock**. It records cost and enforces rate limits and a monthly budget. It has no right to approve anything.

## Inputs (read these)

- `docs/architecture/v2-backend-plan.md` section 15 (all), section 3, section 11
- `docs/requirements/v2-question-bank.md`: flows 4.2, 4.8; US-04 to US-06 and US-29; AC-04.8, AC-05.6, AC-06.4, AC-15.2, AC-29.2; NFR-01 to NFR-04; Q5
- `docs/requirements/v2-exam-schema.md`: question types and fields (D1, D2), answer keys and mark-scheme points (D3, D4), stimuli and groups (D5, D6), controlled vocabularies and curriculum tags (D8, D9), metadata (D10)
- The frontend mock extractor and its types (paths supplied by the lead, OD-20); the output shape must equal what the review UI already consumes
- ADR-0019 (SPM intake, provider-agnostic AI; may still be in progress; follow the TRACKER D52 text where it is silent)

## Outputs

- Contract: `packages/contract/src/ai/**` (extraction input/output items with confidence and region, usage summary, provider status); admin endpoints below
- `apps/api/prisma/schema/ai.prisma` + migration: `ai_extraction_runs` (batch/file ref, provider, model, status, timing, cost), `ai_usage_logs` (provider, model, run id, actor id, pages, tokens in/out, cost_sen, created_at; **no content**), `ai_settings` (monthly budget, notification flags) with the `legacy_*` convention on `ai_usage_logs`
- `apps/api/src/modules/ai-extraction/**`: `ExtractionProvider` interface (`id`, `capabilities`, `extractPaper`, `suggestTags`, `healthCheck`), adapters `mock`, `anthropic`, `openai`, `gemini`, `openai-compatible` (HTTP via `fetch`, no vendor SDK required), registry selected by `AI_PROVIDER`, redaction step, concurrency/rate limiter, retry with backoff, price table, budget guard, usage logger
- Recorded-response fixtures for each adapter under `apps/api/test/ai/fixtures/` (fictitious paper content only); no network in CI
- `.env.api.example` additions (names only, plan 15.3)
- Tests under `apps/api/test/ai/**`

## Endpoints (admin role only; relative to `/api`; final paths from the contract commit)

| Method and path (indicative) | Notes |
|---|---|
| `GET /ai/status` | provider id, model, configured yes/no (never the key), month-to-date cost, budget, remaining |
| `GET /ai/usage` | paged usage rows (filters: month, batch, provider) without content |
| `PUT /ai/settings` | monthly budget, notification toggles; audit-logged |
| `POST /ai/test` | admin health check using the mock-safe sample (never user content) |

Extraction itself is invoked in-process by the intake worker (BE-38), not by a public endpoint.

## DB tables touched

New: `ai_extraction_runs`, `ai_usage_logs`, `ai_settings`.

## Acceptance criteria

1. The same contract-test suite passes for `mock` and, using recorded fixtures, for every real adapter; swapping `AI_PROVIDER` changes no caller code.
2. A canary test proves that only allowed fields (page content after redaction, taxonomy, structure hints) appear in the outbound request body; names and contact details planted on a cover page are masked; no user, student or school identifier is ever in a request (AC-04.8).
3. The API key never appears in logs, responses, error messages or DB rows (grep test over captured output); `/ai/status` returns only `configured`.
4. Rate limit and concurrency caps hold under a burst test; 429/5xx responses are retried with backoff and then fail the run with a clear error code.
5. Each call writes exactly one `ai_usage_logs` row with tokens and `cost_sen` from the price table; no document text is stored there.
6. Budget: at 80% a notification row for Admin Pusat is created once; at 100% `extractPaper` refuses with `AI_BUDGET_EXHAUSTED` and the caller can queue (AC-29.2).
7. The service can only return drafts: its output type has no status field beyond `draft` and no approval operation (AC-05.6).
8. `AI_BASE_URL` for the openai-compatible adapter must be https, on the allow-list, and not a private/loopback address (SSRF test).
9. Role checks: Guru and Murid get 403 on all `/ai/*` endpoints; no session 401; no CSRF 403.

## Test commands

```
npm run be:test -- apps/api/test/ai
npm run contract:check
npm run be:verify
```

## Migration-first (plan section 14)

- `ai_usage_logs` is a matrix row (BE-29 optional load from .cloud `ai_usage_logs`); give it `legacy_source`, `legacy_id`, unique pair, and add it to `migratable-models.json`.

## Prompt for Claude Code

```text
You are the backend developer for PrestasiPlus v2 working on task BE-36 (ai-extraction-service). Work in this repo clone on branch be/BE-36-ai-extraction-service, created from the latest origin/feature/v2-backend.
Read first, in order: AGENTS.md; docs/architecture/v2-backend-plan.md (sections 3, 6, 9, 10, 14, 15); docs/plan/backend-tasks/BE-36-ai-extraction-service.md (this card, all of it).
Rules: contract first (zod schemas in packages/contract/src/ai/, import z from ../zod, register in src/openapi.ts, run npm run contract:emit and commit openapi.json before the implementation). The frontend mock extractor (paths from the lead) and docs/requirements/v2-question-bank.md are the behavioural spec: do not invent business rules; write every unknown under "Open questions" in the PR. Never commit secrets or real personal names; API keys exist only in server environment variables; tests use recorded fixtures and the mock provider, never the network. Do not edit src/**, e2e/**, docs/TRACKER.md or the contract common/session/auth/access folders. Keep the diff inside the card Outputs.
Task: implement BE-36 exactly as the card says: provider adapter interface, mock + anthropic + openai + gemini + openai-compatible adapters, redaction, rate limit, cost log, budget cap, admin status/usage/settings endpoints. Needs a security review.
When finished run npm run be:verify and report: files changed, endpoints, tables, real test output, deviations, open questions. Update docs/plan/backend-tracker.md (your card row) in the same PR.
```
