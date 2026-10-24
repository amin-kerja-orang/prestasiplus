# ADR-0022: The DSKP catalogue is an M03-owned, build-time-generated, in-process contract

- **Status:** Proposed (G2, awaiting user approval of the key decisions)
- **Date:** 2026-10-24
- **Related:** `docs/requirements/v2-dskp-integration.md` (US-01, US-11, Q-D3, Q-D4, Q-D5, Q-D8); `docs/architecture/v2-dskp-integration.md`; ADR-0009 (module boundaries), ADR-0014 (one owner per shared store, D12), ADR-0018 (contract-first schemas), ADR-0021 (`@pp/exam-core` shared package, on `feature/v2-backend`); `docs/requirements/v2-exam-schema.md` D9

## Context
- Questions must be tagged from the 13 official DSKP extracts (`docs/reference/dskp/*.json`, 2,062 SP rows, 171 units), not from the 12 prototype units in m28. Per user decision (2026-10-24) M03 owns the catalogue and m28 only reads it (D12).
- The tag rule (unit, SP, TP) must run **synchronously and identically** in the review screen, the Sunting editor and the in-browser server (`validateBatch`, `validateRevision`, `gateErrors`), and later in NestJS (FB-026: "one rule, no front/back drift").
- The catalogue is read-only reference data, identical for every user, about 440 KB minified (about 90 KB gzip) in total. The demo bundle has a size budget (`scripts/check-demo-bundle.mjs`).
- m28's server and intake code are not mock-plugin code: ESLint lets them import another module only through its public entry `@/modules/<slug>` and never a `mock/` folder (ADR-0009). Mock plugins of other modules may read M03 only through `@/modules/m03-curriculum/mock`.
- Dynamic imports must be string literals and `import.meta.glob` is not allowed outside `src/mock/index.ts` (ADR-0009 amendment 1).
- The real backend (BE-08 `curriculum_nodes`, BE-10 gates) is a separate programme and not decided in time order (Q-D5).

## Decision
1. **Ownership and location.** The catalogue lives in `src/modules/m03-curriculum/dskp/`. M03 is its only writer. It is not a mock table or repository: it has no mutable state in this phase (AC-01.5).
2. **Source and build.** A deterministic script `scripts/fixtures/build-m03-dskp.ts` (same pattern as `build-m03-curriculum.ts`) normalises the 13 source files into one committed JSON file per subject plus a small subject index and a `version.json` (version + content hash). A unit test regenerates in memory and fails on drift. The generated files are never hand-edited. Source files stay in `docs/reference/dskp/` and are not imported by app code.
3. **Wire shape.** One JSON document per subject (`DskpSubjectData`, tree-shaped, ids not stored). The same document is what a backend endpoint returns later, so the front-end index builder is reused unchanged.
4. **Contract.** M03's public entry exports `dskpCatalog` (`DskpCatalog`): synchronous subject index, `load(subjectCode)` that lazily loads and indexes one subject (one literal dynamic `import()` per subject, loaded as `?raw` text and parsed), and a synchronous `DskpSubjectView` for lookups, SP pick lists, TP descriptor resolution and search. The same object is re-exported from `@/modules/m03-curriculum/mock` for mock code.
5. **Stable ids.** Opaque composite keys `<SUBJECT>:<T4|T5>:<g|u|sk|sp>:<printed code>` (for example `MAT:T4:sp:1.1.6`, `SEJ:T4:sp:K11.1.6`). A question tag stores unit and SP keys plus the catalogue version; SK is derived from the SP's parent, never from the code text.
6. **One tag rule.** The rule is a pure function `tagIssues(tag, lookup)` in m28 (`domain/tag-rule.ts`, no Vue, no m28 imports beyond types) called by submit, revision and publish. It takes a narrow `TagLookup`. Where BE-14 (ADR-0021) is merged, the rule and `CurriculumTag` live in `@pp/exam-core` (m28 `domain/*` are `export *` shims), so NestJS reuses the same file; on this branch they start in m28 `domain/` and move with the shim pattern.
7. **No change to D-B and D-C.** M03's Bab/Topik taxonomy and M10's DSKP fixture store stay as they are (Q-D3, Q-D4). The catalogue is an additional tree.

## Alternatives considered
- **m28 keeps its own list (status quo, extended):** simplest, but breaks D12 and drifts from M03. Rejected.
- **Serve the catalogue through M03 mock handlers over the mock transport (`api/` functions):** matches M03's lookup pattern, but the shared rule would become asynchronous and chatty (many SPs per unit), the mock needs tables for data that is never written, and m28's in-browser server has no transport. Rejected. The async seam is kept at `load(subject)`, which is where an HTTP implementation plugs in.
- **One bundled catalogue module:** simplest loader, but about 440 KB raw lands in every admin session. Rejected in favour of per-subject lazy chunks.
- **Import `docs/reference/dskp/*.json` directly from app code:** crosses the source/docs boundary and ships fields the app never uses. Rejected; a generator with a whitelist of fields is used.
- **Store free-text unit label and SP codes on the question (status quo):** cannot be validated and breaks when text is corrected. Rejected.

## Consequences
- M03 gains a `dskp/` folder, a generator, 15 generated JSON files (13 subjects, an index and a version file) and tests; `index.ts` and `mock/index.ts` gain exports. No M03 mock table, seed or `version` bump is needed.
- m28 depends on M03's public entry for the first time. Any test that needs a catalogue loads the real one (about 0.1 s) or injects a small fixture through `createDskpCatalog`.
- Bundle: 13 lazy chunks (about 4 to 10 KB gzip each); the entry chunk grows only by the index (13 subjects) and the indexing code. The "all js" budget needs a re-measure in DSKP-T02.
- A catalogue correction is a regeneration plus a version bump; existing tags keep their stored version and fail the gate only if a referenced node disappears (AC-07.7).
- Hand-over: BE-08 maps the same tree to `curriculum_nodes`; BE-10 reuses `tagIssues` with a DB-backed `TagLookup`. See the feature document, section 4.5.
- ADR-0014's store table should read "DSKP catalogue: M03, read through `dskpCatalog`" (one-line amendment, DSKP-T02).
