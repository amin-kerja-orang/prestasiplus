# Builder "Cari soalan" search at ~400k questions (T54 finding F2)

- **Finding:** `docs/qa/r1-perf-400k.md` F2 (P10b): `GET /api/admin/papers/:id/sections/:sid/pool?q=...` took p50 12.2 s / p95 14.3 s, because `sectionPool()` described every candidate (about ten `findMany` over `question_versions` with parts) and filtered the preview in memory.
- **Fix (code only, no schema change, no migration):** `BuilderQuestionSource` has an optional `matchText(ids, needle)`. `QuestionBankBuilderSource.matchText` matches in one SQL query over the candidate ids and returns the matching ids; `sectionPool()` then describes only the page that is shown. A source without `matchText` keeps the old describe-and-filter path (the in-memory test double and any future source).
- **Same results.** The SQL builds the picker `preview` exactly as `previewOfRows` does (trimmed stem; then ` {label} {prompt}` of the first top-level part when that part is a leaf; the prompt alone for a blank stem; the stem alone when it equals the prompt) from the version `describe` shows (live, else latest), and also matches the topic (unit title). The needle is matched literally and case-insensitively (`ILIKE`, `\ % _` escaped). Known differences from the JavaScript filter: only ASCII whitespace is trimmed, and case folding follows the database collation. Specs: `test/exam-builder/pool-text-search.spec.ts` (real bank: the SQL match equals the describe-based filter for 20 needles incl. wildcards, joins between stem and part, spaces, topic) and the two 1700-candidate specs in `builder-placements.spec.ts` (one with `matchText`, one without).

## Measurement

Throwaway Postgres 16 in Docker (`shared_buffers=1GB`, `work_mem=16MB`, `fsync=off`), 407,536 questions generated with the SQL scripts of `docs/qa/perf-r1-400k/` (T54), `VACUUM ANALYZE`, the real application booted in-process, 20 timed calls after 2 warm-ups, the harness of T54 (paths P10a to P10c only; the overview-cache paths are not on this branch). Builder branch: T48 (`r1/t48-builder-parity` @ 1dd07bc1) plus this change. Host: the same machine, other test runs may have used it.

| Path | Before (p50 / p95 / cold, ms) | After (p50 / p95 / cold, ms) | Rows |
|---|---|---|---|
| P10a candidates, page of 100 | 711 / 819 / 958 | 743 / 842 / 925 | total 9,066 |
| **P10b search `q=nombor`** | **11,160 / 12,048 / 10,734** | **886 / 987 / 1,138** | **total 9,003 (identical)** |
| P10c Pratonton kolam | 826 / 934 / 986 | 806 / 898 / 849 | published 9,222 |

Search is now about 12 times faster and no slower than listing the candidates (P10a); what is left is building the candidate list of the subject (about 9,000 facts) on every call, which also dominates P10a and P10c. Further gain would need that list cached or paged in SQL (a separate change). An earlier run on a busier host gave P10b 1,026 / 1,122 ms.

To reproduce, follow section 7 of `docs/qa/r1-perf-400k.md` and run `PERF_ONLY=P10a,P10b,P10c`.
