# ADR-0025: Jana Kertas generator is a bounded exact search in `@pp/exam-core`

- **Status:** Accepted (G2 of `bijak-spm`, approved by the user 2026-10-29)
- **Date:** 2026-10-29
- **Related:** ADR-0021 (exam-core package), `docs/architecture/v2-bijak-spm-standards.md` section 5, requirements US-34 to US-37, AC-29.4/29.5, NFR-13/14, D75/D76.

## Context
A generated paper must match its blueprint **exactly**: section and total marks, an exact count (or marks) per DSKP unit, a TP band per slot group with optional exact counts per TP, an exact KBAT mark total, stimulus groups whole, no repeats. Refusals must name the failing unit, TP or KBAT line, and the admin preview must give the same verdict as the generator. The current `composeFromBlueprint` only fills a question count from a pool tag. The instance is small (<= 40 slots per section, <= 25 quota lines, <= 6 TP values, a few mark values, pools up to 5,000 eligible questions) but the exact-sum constraints make it a multi-constraint subset-sum, NP-hard in general.

Options considered:
1. **Random draw with rejection sampling.** Simple, but cannot guarantee exactness, wastes time near infeasible instances, gives no explanation.
2. **External solver** (CP-SAT, an ILP library, HiGHS-WASM). Strong, but adds a native or WASM dependency to a package defined as dependency-free and shared with the browser (ADR-0021), complicates builds, and still needs custom code to explain a refusal per line.
3. **Custom exact search over question types with polynomial pre-checks** (chosen).

## Decision
- Implement the generator in `@pp/exam-core` as: necessary-condition pre-checks (also the "Pratonton kolam" table) -> per-section branch and bound over **types** `(unit bucket, TP, marks, KBAT marks)` with forward checking and failed-state memo -> seeded concretisation (unseen first) -> ordering rules per profile kind -> an independent `verifyComposition` oracle.
- Determinism comes from node budgets and a seeded `mulberry32`; the wall-clock cap can only produce a `limit` refusal, never a different paper.
- Sections are solved in tightness order with a shared used-set; cross-section depletion triggers at most 3 restarts; the final attempt is a **reference attempt** (seed 0, no unseen preference) that the preview runs, so "Boleh dijana" guarantees a successful generation on the same pool.
- Failures are explained by the first failing pre-check (typed line with numbers) or, when all pass, by a relaxation probe that names the blocking constraint family.
- No external solver. Revisit (HiGHS compiled to WASM, behind the same `solve` interface) if the pilot shows more than 1% `limit` refusals.

## Consequences
- Pure TypeScript, testable with seeded property tests against the oracle ("0 generated papers differ from the blueprint").
- Worst case exponential, bounded by a configurable node budget (default 150k per section, 600k per paper, 2 s wall clock); typical cost is polynomial pre-checks plus a few hundred nodes.
- A refusal can in theory be a false negative in rare cross-section overlap cases; it is reported as `overlap` or `limit`, never as an invented shortage.
- The M28 prototype keeps the old `composeFromBlueprint` until the frontend cuts over; both live in the package.
- As built (2026-10-30, BJS-04 review): attempts run in order (strict unseen, restarts, soft unseen) sharing half the paper budget (300k nodes, 1.2 s deadline), then a reference attempt with its own 600k nodes and a fresh 2 s clock. Worst case per request is therefore 900k nodes and about 3.2 s, above the nominal 600k / 2 s. A clock timeout in an early attempt stops composing with `limit` and does **not** fall back to the reference attempt, so the same seed never yields a different paper on a slower machine. Trade-off: under heavy load a request can answer 503 `GENERATE_LIMIT` while the pool preview (reference attempt only) says "Boleh dijana". Track `bijak_generate_limit_total` (BJS-D3) and revisit if the limit rate exceeds 1% in the pilot.
