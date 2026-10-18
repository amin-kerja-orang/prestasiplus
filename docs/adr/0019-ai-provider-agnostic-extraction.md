# ADR-0019: Provider-agnostic AI extraction for the SPM question intake

- **Status:** Accepted (user decision, 2026-10-19)
- **Date:** 2026-10-19
- **Related:** `docs/requirements/v2-question-bank.md` (US-04, NFR-03, NFR-04, Q5); `docs/requirements/v2-exam-schema.md`; ADR-0018 (contract-first)

## Context
- Staff upload SPM papers (PDF, often scans). The system must turn them into question drafts, stimulus groups and mark schemes that a person edits and approves.
- The user wants the AI provider to stay **open and configurable**: no lock-in to one vendor, and no vendor key in the frontend repository.
- The prototype has no backend, but the intake flow must be demoable and verifiable now.

## Decision
1. **One interface.** `QuestionExtractor.extract({ pages, images?, subject, kertas }) => Promise<ExtractedPaper>` (`src/modules/m28-bijak-spm/admin/intake/types.ts`). The output reuses the m28 domain types (questions, parts, leaf modes, `SchemeDef`, `StimulusDef`, `CurriculumTag`), so approved intake becomes plain m28 content.
2. **Registry by provider id**: `mock`, `anthropic`, `openai`, `gemini`, `openai-compatible`. The id comes from configuration (`VITE_AI_PROVIDER`, `VITE_AI_MODEL`, `VITE_AI_BASE_URL`), default `mock`. An unknown id is a configuration error, never a silent fallback.
3. **No key in the frontend.** Env values hold only the provider id, the model and a base URL. Real providers run **server-side**: the browser sends page text and images to the Kuasa Pusat API, which holds the key, applies masking of personal names (NFR-04), records usage (NFR-03) and calls the vendor. In the prototype the four real providers are typed stubs that throw `Dikonfigurasi di pelayan`.
4. **The prototype runs only `mock`.** It parses the OCR text with heuristics (question numbers, options, parts, `[n markah]`, Rajah / Jadual / Petikan with "soalan X dan Y", K/N/P/B/M/F/C scheme lines, "mana-mana N") so the whole flow is demoable offline. It flags uncertain fields (low confidence) that a person must confirm before submit.
5. **OCR is a separate step, not part of the extractor.** `pdfjs-dist` reads the text layer of digital PDFs; `tesseract.js` (Malay + English) reads scanned pages and images. Both run in Web Workers, in the browser for the prototype, and are lazy-loaded. Later the same step can move server-side without changing the extractor contract.
6. **The human gate is unchanged.** Extraction only creates a Draf batch. The quality gates (v2-question-bank 4.8) run in the UI and again in the mock server on submit, so they cannot be bypassed.

## Alternatives considered
- **Hard-code one vendor SDK:** fastest, but locks the product in and tempts a key into the bundle. Rejected.
- **Call vendors from the browser with a user-supplied key:** leaks keys and breaks NFR-04. Rejected.
- **Make OCR part of each provider:** duplicates work and hides OCR cost. Rejected; providers get text (and page images for vision models).

## Consequences
- Adding a provider is one factory in the registry plus a server adapter; the UI does not change.
- The mock heuristics only understand the documented layout; real accuracy targets (NFR-01) are measured once a real provider is wired.
- Page images are kept in browser memory in the prototype; the server stores them privately later (NFR-06).
