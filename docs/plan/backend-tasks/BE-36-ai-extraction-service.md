# BE-36 AI extraction service: provider adapters, redaction, rate limit, cost log, budget cap

| Field | Value |
|---|---|
| Size | M |
| Lane | PC-5 (folders: sessions.md section 5) |
| Priority | P1 |
| Wave | 1/2 (starts after BE-03) |
| Depends on | BE-03, BE-06 (budget notification through `NotificationsService`) |
| Parallel with | BE-04, BE-05, BE-08, BE-37 (after BE-06 merges) |
| Owner module | ai-extraction (new platform module; `ai_usage_logs` is its store) |
| Security review | required (external egress of document content, API keys) |

## Goal

(D52) A provider-agnostic server-side service that turns paper content (page text and/or page images, blueprint/structure hints, taxonomy) into structured question drafts with per-field confidence and source region, and suggests tags. Any provider can be configured server-side; CI runs on a deterministic **mock**. It records cost and enforces rate limits and a monthly budget. It has no right to approve anything.

## Inputs (read these)

- `docs/plan/AGENT-SYNC.md`, `docs/plan/sessions.md` section 5
- `docs/architecture/v2-backend-plan.md` section 15 (all), section 3, section 11
- `docs/requirements/v2-question-bank.md`: flows 4.2, 4.8; US-04 to US-06 and US-29; AC-04.8, AC-05.6, AC-06.4, AC-15.2, AC-29.2; NFR-01 to NFR-04; Q5
- `docs/requirements/v2-exam-schema.md`: question types and fields (D1, D2), answer keys and mark-scheme points (D3, D4), stimuli and groups (D5, D6), controlled vocabularies and curriculum tags (D8, D9), metadata (D10)
- The frontend extractor contract the output must equal (the review UI already consumes it): `src/modules/m28-bijak-spm/admin/intake/types.ts` (`QuestionExtractor`, `ExtractInput`, `ExtractedPaper`, `IntakeQuestion`, `IntakeStimulus`, `lowFields`), `src/modules/m28-bijak-spm/admin/intake/ai/{index,mock-extractor,providers,registry}.ts`, `src/modules/m28-bijak-spm/admin/intake/domain/{grouping,marks,validation}.ts`, and the mock test `src/modules/m28-bijak-spm/__tests__/intake.test.ts`
- ADR-0019 (SPM intake, provider-agnostic AI) is being written by the lead and may not be in `docs/adr/` yet; follow the TRACKER D52 text and plan section 15 where it is silent
- BE-06 `NotificationsService`, BE-03 guards

## Outputs

- Contract: `packages/contract/src/ai/**` (extraction input/output items with confidence and region, usage summary, provider status)
- `apps/api/prisma/schema/ai.prisma` + migration: `ai_extraction_runs` (batch/file ref, provider, model, status, timing, cost), `ai_usage_logs` (provider, model, run id, actor id, pages, tokens in/out, cost_sen, created_at; **no content**), `ai_settings` (monthly budget, notification flags)
- `apps/api/src/modules/ai-extraction/**`: `ExtractionProvider` interface (`id`, `capabilities`, `extractPaper`, `suggestTags`, `healthCheck`), adapters `mock`, `anthropic`, `openai`, `gemini`, `openai-compatible` (HTTP via `fetch`, no vendor SDK required), registry selected by `AI_PROVIDER`, redaction step, concurrency/rate limiter, retry with backoff, price table, budget guard, usage logger
- Recorded-response fixtures for each adapter under `apps/api/test/ai/fixtures/` (fictitious paper content only); no network in CI
- `.env.api.example` additions (names only, plan 15.3) in the PC-5 block
- Tests under `apps/api/test/ai/**`

## Files touched

Everything a PC may write for this card. A path outside this list needs a `cross-lane` issue first (sessions.md section 5).

- Folders written: `apps/api/src/modules/ai-extraction/**`.
- Prisma file(s): `apps/api/prisma/schema/ai.prisma` and one migration folder under `apps/api/prisma/migrations/`.
- Contract: `packages/contract/src/ai/**` (new files only), registered in `src/openapi.ts`; `openapi.json` is regenerated with `npm run contract:emit`, never hand-edited.
- Seeds: none.
- Tests: `apps/api/test/ai/**`, and (after BE-31) new scenario files in `apps/api/test/conformance/ai/`.
- Other files: `.env.api.example` (PC-5 block only).
- Append-only shared files (one line each, never reorder): `apps/api/src/modules/index.ts` (one import and one array entry); `apps/api/prisma/migratable-models.json` (model names, alphabetical); your own rows of the mapping matrix, plan section 14.7; `docs/architecture/v2-backend-deviations.md` (a dated row only if you deviate); your own row in `docs/plan/backend-tracker.md`.
- No-clash note: ai.prisma belongs to this card alone; it can run in parallel with BE-37 (intake.prisma) and BE-10 (questions-workflow.prisma).

## Endpoints (new, admin only; no mock route exists; paths fixed in this card's contract PR)

| Method and path | Notes |
|---|---|
| `GET /api/ai/status` | provider id, model, `configured` yes/no (never the key), month-to-date cost, budget, remaining |
| `GET /api/ai/usage` | paged usage rows (filters: month, batch, provider) without content |
| `PUT /api/ai/settings` | monthly budget, notification toggles; audit-logged |
| `POST /api/ai/test` | admin health check using a built-in sample (never user content) |

Extraction itself is invoked in-process by the intake worker (BE-38), not by a public endpoint.

## DB tables touched

New: `ai_extraction_runs`, `ai_usage_logs`, `ai_settings`.

## Acceptance criteria

1. The same contract-test suite passes for `mock` and, using recorded fixtures, for every real adapter; swapping `AI_PROVIDER` changes no caller code. The `mock` adapter returns the same `ExtractedPaper` shape as the frontend `mock-extractor.ts` for the same input (golden test on the frontend's sample paper content copied as fictitious fixture).
2. A canary test proves that only allowed fields (page content after redaction, taxonomy, structure hints) appear in the outbound request body; names and contact details planted on a cover page are masked; no user, student or school identifier is ever in a request (AC-04.8).
3. The API key never appears in logs, responses, error messages or DB rows (grep test over captured output); `GET /api/ai/status` returns only `configured`.
4. Rate limit and concurrency caps (`AI_RATE_LIMIT_PER_MIN`, `AI_MAX_CONCURRENCY`) hold under a burst test; 429/5xx responses are retried with backoff and then fail the run with a clear error code.
5. Each call writes exactly one `ai_usage_logs` row with tokens and `cost_sen` from the price table (`AI_PRICE_TABLE_JSON`); no document text is stored there.
6. Budget: the month is the Malaysia calendar month; at 80% of `AI_MONTHLY_BUDGET_SEN` one notification per month is created for each active Admin Pusat through `NotificationsService`; at 100% `extractPaper` refuses with `AI_BUDGET_EXHAUSTED` and the caller can queue (AC-29.2).
7. The service can only return drafts: its output type has no status beyond `draft` and there is no approval operation (AC-05.6; a type-level test and a runtime check).
8. `AI_BASE_URL` for the openai-compatible adapter must be https, on the allow-list, and not a private or loopback address, including after DNS resolution (SSRF tests).
9. Role checks: Guru and Murid get 403 on all `/api/ai/*` endpoints; no session 401; missing CSRF 403 `CSRF_INVALID` on `PUT` and `POST`.

## Test commands

```
npm run be:test -- apps/api/test/ai
npm run contract:check
npm run be:verify
npm run be:test -- apps/api/test/conformance   # only after BE-31 is merged
```

## Definition of Done

1. Plan section 10 (all ten items) is met.
2. `npm run contract:check && npm run be:verify` is green; if anything under `packages/**` changed, root `npm run typecheck && npm test` is green too. Paste the real tail of the output in the PR.
3. Conformance (BE-31): once BE-31 is merged, add this card's scenarios as new files in `apps/api/test/conformance/ai/` and run `npm run be:test -- apps/api/test/conformance`; a failure is a blocker. Before BE-31 merges, `be:verify` is the gate; write "conformance scenarios pending BE-31" in the PR.
4. Migration-first checklist of plan section 14.9 (items 1 to 6) is complete for every table this card creates. Item 6 (insert a `legacy_source = 'cloud'` row twice through the BE-34 upsert helper and assert one row) applies once BE-34 is merged; state in the PR whether it was available.
5. Label `security-review` on the PR; list the security decisions and the tests that prove them.
6. The card's tracker row is updated (status, PR number, one-line note) and the PR description follows the template in `docs/plan/backend-tasks/README.md`. Nothing stays only on your PC (AGENT-SYNC.md section 4).

## Migration-first (plan sections 14 and 14.9)

- Follow the checklist of plan section 14.9 (items 1 to 6) for every table listed under "DB tables touched".
- Each table that could receive .cloud rows has `legacy_source text null`, `legacy_id text null` and `unique (legacy_source, legacy_id)`, and is listed in `apps/api/prisma/migratable-models.json`. These columns never appear in the contract or in an API response.
- Enums are `text` + `check` with English codes (no Postgres enum types); anything the source may lack is nullable or has a documented default; seeds never set `legacy_*` and are idempotent.
- Add or update this entity's row in the mapping matrix (plan section 14.7) in the same PR.
- Only `ai_usage_logs` is migratable (BE-29 loads it optionally from .cloud `ai_usage_logs`): give it `legacy_source`, `legacy_id`, the unique pair and list it in `migratable-models.json`. `ai_extraction_runs` and `ai_settings` are not migrated; say so in the PR.

## Open questions

Do not guess these; write your working assumption in the PR and ask the lead (issue labelled `question`) if it blocks you.

1. Final provider and region are the user's decision (v2-question-bank Q5); the default stays `mock` until then.
2. The price table values (`AI_PRICE_TABLE_JSON`) are configuration supplied by the lead, not invented in the repo.

## Prompt for Claude Code

```text
You are the backend developer for PrestasiPlus v2 working on task BE-36 (ai-extraction-service). Work in this repo clone on branch be/BE-36-ai-extraction-service, created from the latest origin/feature/v2-backend.
Read first, in order: docs/plan/AGENT-SYNC.md (how to claim, commit and push); AGENTS.md; docs/plan/sessions.md section 5 (folder ownership); docs/architecture/v2-backend-plan.md (sections 3, 6, 9, 10, 14, 15); docs/plan/backend-tasks/BE-36-ai-extraction-service.md (this card, all of it).
Rules: contract first (zod schemas in packages/contract/src/ai/, import z from ../zod, register in src/openapi.ts, run npm run contract:emit and commit openapi.json before the implementation). The frontend mock extractor (paths from the lead) and docs/requirements/v2-question-bank.md are the behavioural spec: do not invent business rules; write every unknown under "Open questions" in the PR. Never commit secrets or real personal names; API keys exist only in server environment variables; tests use recorded fixtures and the mock provider, never the network. Do not edit src/**, e2e/**, docs/TRACKER.md or the contract common/session/auth/access folders. Keep the diff inside the card Outputs and its "Files touched" list; commit after every green step and push at least hourly and before the session ends (AGENT-SYNC.md).
Task: implement BE-36 exactly as the card says: provider adapter interface, mock + anthropic + openai + gemini + openai-compatible adapters, redaction, rate limit, cost log, budget cap, admin status/usage/settings endpoints. Needs a security review.
When finished run npm run be:verify and report: files changed, endpoints, tables, real test output, deviations, open questions. Update docs/plan/backend-tracker.md (your card row) in the same PR.
```
