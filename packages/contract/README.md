# @pp/contract

Zod schemas (source of truth) and the generated OpenAPI 3.1 file `openapi.json` (ADR-0018).

- `npm run contract:emit` regenerates `openapi.json`; `npm run contract:check` fails if it is stale.
- Import `z` from `src/zod.ts`, never from `'zod'` (it patches zod for OpenAPI first).
- Register new shared schemas in `COMPONENT_SCHEMAS` (`src/openapi.ts`).
- Envelopes: `envelopeOf(item)` gives `{ data }`, `listEnvelopeOf(item)` gives `{ data, meta }`; each
  endpoint registers its own concrete envelope (`IdEnvelope` and `IdListEnvelope` are examples).
