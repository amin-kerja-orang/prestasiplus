# R1 admin question list: performance after the T54 findings F3 and F4

Branch `r1/admin-list-perf`. Source of the findings: `docs/qa/r1-perf-400k.md` (branch `r1/t54-perf-400k`), sections F3 (text search) and F4 (status counts and total).

## What changed

| Change | Where | Effect |
|---|---|---|
| Migration 0106: `pg_trgm` and two partial trigram GIN indexes on `question_versions.stem_ms` / `stem_en` | `apps/api/prisma/migrations/0106_question_stem_trgm` | The `ILIKE '%x%'` search stops scanning every row. |
| Migration 0107: partial expression index for the Kertas filter | `apps/api/prisma/migrations/0107_question_paper_kertas_index` | `kertas` alone stops running the regular expression on every row. The expression text must equal `adminConds` in `questions.repository.ts`. |
| `listIds`: the total comes from the one per-status aggregate | `questions.repository.ts` | One count scan instead of two (the total was a second full scan with the same joins). Exact, no cache. |
| REQ-B-050: Kertas regex `[[:space:]]*` (the `\s` was cooked to `s` in the template literal) | `questions.repository.ts` | A code with trailing spaces or a tab matches, as the row view does. **Behaviour change:** the filter now needs `/` plus a digit 1–3 (as `kertasOfPaperCode`); the old cooked `([0-9])s*$` matched any trailing digit, so a code like `MATH 2` (no slash) no longer matches a Kertas filter. Recorded in `docs/architecture/v2-backend-deviations.md`. |

Exactness: `total` is the sum of the groups of the aggregate (all of them without a status filter, that status with one). `status` is limited to four values by `ck_question_versions_status`. `list-totals-parity.spec.ts` keeps the previous implementation (separate `count(*)` plus the grouped counts) and requires identical `total`, `counts` and page ids for 16 filter combinations, each over 5 status values and 3 subject/level scopes, on a mixed fixture.

## Measurement at 408,273 questions

Same throwaway database and harness as T54 (`docs/qa/perf-r1-400k/perf-400k.spec.ts.txt`, HTTP through supertest, 2 warm-ups, 20 timed runs, ms). Postgres 16.15 in Docker on the same 4 vCPU host, `shared_buffers=1GB`, `work_mem=16MB`, `jit=on` (the Postgres default), `VACUUM ANALYZE` done earlier and `ANALYZE question_versions` after each index. "Before" is the code of `feature/v3-bijak-r1` BASE-105 (`7ea2208c1`) without the indexes. Each row is one more change on top of the previous one.

| Step | P8d text search `search=nombor 1234` p50 / p95 | P8b-3 `kertas=2` alone p50 / p95 | P8a unfiltered p50 / p95 | P8c subject+level+status p50 / p95 |
|---|---|---|---|---|
| 0. Before (BASE-105 code, no new index) | 1,575 / 1,912 | 1,716 / 2,023 | 739 / 898 | 125 / 149 |
| 1. Code only (one aggregate, regex fix) | 1,530 / 1,726 | 2,671 / 3,586 | 716 / 861 | 124 / 154 |
| 2. + migration 0106 (trigram) | **54 / 73** | 2,860 / 3,560 | 677 / 847 | 118 / 145 |
| 3. + migration 0107 (kertas index) | 57 / 79 | **172 / 202** | 661 / 878 | 118 / 142 |
| 4. Step 3 with `jit = off` on the database (ops recommendation, not part of this branch) | 59 / 67 | 147 / 198 | **445 / 618** | 108 / 137 |

Reading the table:

- Text search: 1.58 s to 54 ms (about 29 times faster), from the trigram indexes. Total 79 rows, same as before.
- `kertas` alone: 1.72 s to 172 ms. Step 1 is slower than step 0 because `[[:space:]]*` costs more per row than the cooked `s*`; the cost shows only while there is no index (2.4 s of regex work over 408k rows), and step 3 removes it (EXPLAIN of the count query: 2,694 ms to 157 ms, Index Scan on `ix_question_versions_paper_kertas`, 39,000 rows). The fix of the bug (trailing whitespace) is therefore only affordable together with 0107: ship them together.
- Unfiltered list: the one aggregate saves about 3 to 10 percent only. The remaining cost is the exact count over 286,516 rows: a hash join of `question_versions` (seq scan) and `questions`, an anti join for PKSK, and a status group. About 300 ms of the 660 ms is JIT compilation: the planner cost of the query (above 500,000) is over `jit_above_cost`, so Postgres compiles it for each call. With `jit = off` the same query takes 445 ms p50 (EXPLAIN: 900 ms to 530 ms). This is a database setting and stays an **ops recommendation** only (B1/DevOps): `ALTER DATABASE <db> SET jit = off` (usual advice for an OLTP application). No setting is in code or in a migration (lead decision).
- P8a p95 is 0.88 s with this branch alone (below the 1 s target), and 0.62 s with `jit = off`. Going lower without approximating would need either a maintained counter table (a write-path change in every status transition) or a cache invalidated on every status change. Neither is done, by lead decision (exactness first); both are recorded here as a **possible future step** only.

Build cost of the indexes on 408k questions (local): 0106 about 20 s (`stem_ms` 55 MB; `stem_en` is nearly empty in this bank), 0107 0.9 s (552 kB). Both take a lock that blocks writes to `question_versions` while they build.

## Flags for deploy (B1 / DevOps, B3)

- Migrations 0106 and 0107 use a plain `CREATE INDEX` (Prisma runs each migration file in one transaction, `CONCURRENTLY` cannot run there). **Maintenance window needed**: writes to `question_versions` wait about 20 s at 400k rows (0106) and about 1 s (0107).
- `pg_trgm` must be allowed on the production Postgres (trusted extension: the database owner can create it; managed hosts must have it enabled). If `CREATE EXTENSION` is refused the deploy stops at 0106 and nothing else has changed.
- Ops recommendation: `jit = off` on the database (not in code or migrations).
- Per-user list limit on `GET /api/questions`: default **240 per minute** (REQ-B-061, lead decision; was 60, which normal admin use reached). Override with `THROTTLE_QUESTIONS_LIST_PER_MINUTE`. Above it: 429 `RATE_LIMITED` with `Retry-After`. Worst case per account: about 240 x 1.8 s of database time a minute (short or punctuation-only search). The client side (debounce, 429 handling, fewer Bank calls) is team C, REQ-A-027.
- Revert SQL is in each migration header.
- Run `ANALYZE question_versions` after the migrations (the planner then knows the new expression index).
- Order: `prisma migrate deploy` applies all pending migrations in number order. 0106/0107 only add an extension and indexes and depend on no other team A migration, so it is harmless if they land in the same deploy as 0104/0105 or merge before them.
- Drift: the GIN trigram indexes (0106) and the expression index (0107) cannot be expressed in `schema.prisma`, so `prisma migrate diff` / `migrate dev` may report them as drift. Same precedent as 0011 and 0044: keep them, do not let a generated migration drop them.

## Reproduce

Step 0 to 4 use `docs/qa/perf-r1-400k/perf-400k.spec.ts.txt` copied to `apps/api/test/perf-t54/perf-400k.spec.ts` (not committed), `PERF_RUNS=20 PERF_ONLY=P8a,P8b-kertas,P8c,P8d` (the harness took `runs: 3` for the single-filter paths; here a local copy uses 20), with the migration SQL applied by `psql` to `perf400k`. Raw output of this run is not committed.
