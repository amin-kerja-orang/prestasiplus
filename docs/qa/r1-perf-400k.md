# R1 performance at UAT scale (~406k questions) (T54)

Local measurement only. Nothing here touched a server. No schema change, migration or code fix was applied to the repo: every fix below is a proposal (the next free migration number is 0106).

- **Question:** do the 11 student and admin paths of R1 stay usable on a bank the size of the legacy bank (406,396 questions)?
- **Method:** the real application (every `featureModules` module) booted in-process on a throwaway Postgres that holds the generated bank; each endpoint called over HTTP (supertest). Per path: 1 first call (reported as "first call"), 2 warm-up calls, then **20 timed warm calls**; p50 and p95 are over those 20 (nearest rank: p95 = the 19th of 20). Exceptions are marked (`n=3`).
- **Date of run:** 2026-11-01. The generator and the harness are in `docs/qa/perf-r1-400k/` (see "Reproduce").

## 1. Verdict

| Path | p95 | Verdict |
|---|---|---|
| P11 Servability overview, **cold compute** | 34 s | Slower than every gateway timeout. The H-A21 cache hides it after the first call, but the first admin visit (and the first one after each deploy) waits ~33 s. **Fix before UAT** (section 5, F1). |
| P10b Builder candidates, search "Cari soalan" | 14.3 s | **Fix before UAT** (F2). |
| P8d Admin question list, text search | 1.77 s | Slow; trigram index proposed and tested: the search query's EXPLAIN ANALYZE execution went from 1.8 s to 21 ms (one query, not an endpoint p95; F3). |
| P8b-kertas Admin list, `kertas` filter | 1.61 s (n=3; 0.63 s in an earlier run) | Slow; the cost is the count queries (F4). |
| P8a, P7, P10a, P10c, P1 | 0.55 to 0.94 s | Under 1 s but close; watch (section 4). |
| Everything else | at or under 0.35 s | Fine. |

Cold-start effect worth knowing: right after the database restarted (empty buffer cache) the first call of several paths took seconds (Practice cards 7.2 s, Latih Tubi 3.1 s, Databank cards 2.5 s, login count 2.3 s). The same paths first-called on a warm cache took 0.05 to 0.9 s (an earlier run, not committed, described in the note under section 3). So expect a slow first request per node after a Postgres restart or a deploy that restarts the DB.

## 2. Setup

### Machine

| Item | Value |
|---|---|
| CPU | 4 vCPU Intel Xeon @ 2.10 GHz (Firecracker VM) |
| RAM | 15 GiB |
| OS / Node | Linux 6.18, Node v22.23.4 |
| Postgres | 16.15 (Docker `postgres:16-alpine`), same host as the app, so no network latency |
| Postgres settings | `shared_buffers=1GB`, `work_mem=16MB`, `effective_cache_size=6GB`, `random_page_cost=4` (default), `jit=on`, `max_parallel_workers_per_gather=2` (default), `fsync=off`, `synchronous_commit=off`. Production settings are unknown: the fsync/commit settings do not affect these read paths, but a smaller `work_mem` would make the sorting/aggregating cold queries slower. |
| Planner statistics | `VACUUM ANALYZE` on the whole database after the load (and `ANALYZE` of the whole database before the first run), as the lead asked. |
| Database size | 947 MB |

### Branches merged in the throwaway local branch (never pushed)

`origin/feature/v3-bijak-r1` at **BASE-101** (`b24d89170`) plus `origin/r1/ha21-overview-cache` at `95ad2607` (this contains t45-lanes: lane filters and the overview cache). The merge conflicted only in `questions.module.ts` (resolved: keep `OverviewCache` and `StimuliService` export).

- **T47 (list filters) and T49 (stimulus lists) are already in BASE**, so they were measured as merged.
- **`origin/r1/t48-builder-parity` was NOT merged**: it conflicts badly with BASE-101 in the builder (`builder.service.ts`, contract `paths.ts`/`schema.ts`, openapi, specs). Builder paths P10 are therefore measured on the **BASE builder** (the section pool of `builder.service.ts`). t48 rewrites the section pool into `section-pool.service.ts`; P10 must be re-measured after t48 merges.
- Note: the database was built with migrations up to 0104 (an earlier throwaway branch had t48 merged). 0104 only adds `paper_sections.admin_created`; the BASE code ignores it.

### Bank composition (generated, deterministic seeds, fictitious text)

| Item | Count |
|---|---|
| Questions (and versions: one each) | **408,273** = 406,000 generated + 2,250 Jana-fitting ADDMATH + 23 from the demo seed |
| Version status | approved 367,209; draft 16,298; review 12,376; archived 12,390 |
| Live, active and approved | 356,281 (3% of approved are switched off, as a held question) |
| Learner-visible secondary approved MCQ in SPM subjects | the login count says **132,273** |
| Levels (generated rows) | Darjah D1-D6 121,757 (30%, hidden from pupils), T1-T3 101,701 (25%), T4-T5 182,542 (45%) |
| Types | mcq 345,326; short 28,479; structured 20,025; essay 14,420 |
| Biggest subjects (approved) | MATH 59,634; BM 50,054; SCI 44,947; BI 40,621; SEJ 39,956; PI 29,772; PM 14,842; GEO 14,664 (31 subjects, 144 subject x level combinations) |
| Parts / options / answer keys | 448,329 / 1,391,878 / 428,302 |
| Stimulus groups, stimuli | 2,777 groups with 1 stimulus each; 8,332 grouped MCQs (groups of 2 to 3) |
| Source papers | 8,512 (year 2010-2025 x 7 boards x sebenar/percubaan); 79,400 versions point at one (this feeds the Tahun, Negeri, Jenis, Kertas filters) |
| Curated papers | 375 published (240 generated: SPM subjects x kertas 1/2 x years, 3 sections x 12 placements) plus 50 Jana papers made during the runs; 14,101 placements; **12,438 distinct questions sit on published papers** |
| Blueprint | `3472/2` (Matematik Tambahan K2): Disahkan, `serves_students`, via the e2e seed's real Sahkan checks; the 2,250 extra ADDMATH essay questions are fitted to its units, marks, TP and KBAT so that Jana Kertas succeeds |
| Users | the demo seed (53) with the e2e T4 pupil (subscribed) and the e2e Admin Pusat |

Caveats, so the numbers are not over-read: the real bank's distribution is not known (levels, types and subject shares above are assumptions: MCQ-heavy because the legacy bank is); there is no practice history for the pupil (draws that exclude recently-seen questions would have more to exclude in production); the number of published papers (375) is likely higher than UAT will have, which matters only for the overview cold time (it scales with the questions on published papers, not with the bank).

## 3. Results (warm, 20 runs each, HTTP)

p50 and p95 in ms. "First call" is the first request of the path in the run, right after the Postgres restart (cold buffer cache and cold app caches). Raw numbers: `docs/qa/perf-r1-400k/results-final.json`.

| # | Path | Endpoint | p50 | p95 | First call | Rows | Notes |
|---|---|---|---|---|---|---|---|
| 1 | Login "N+ Soalan" | `GET /api/public/stats` | 479 | 548 | 2,325 | 132,273 | One count over the whole bank on every call (no cache). Rate limit is per address (60/min by default). |
| 2a | Databank cards per subject | `GET /api/spm/databank` | 20 | 28 | 2,539 | 18 subjects | Cached after the first call. |
| 2b | Practice cards per subject | `GET /api/practice/subjects` | 13 | 18 | 7,236 | 31 subjects | Cached after the first call; the first call runs the 7 s `bankMatrix` query (cold cache; 0.49 s when the DB cache was warm). |
| 2c | Latih Tubi SPM cards | `GET /api/spm/latih-tubi` | 13 | 16 | 50 | | |
| 3 | Latih Tubi SPM draw | `POST /api/practice/sessions` mode `latih_tubi`, MATH, count 40 (the MATH target; 20 is refused) | 275 | 343 | 3,102 | 40 questions | |
| 4 | Databank draw | same, mode `past_year`, MATH, count 20 | 192 | 228 | 179 | 20 questions | |
| 5a | Bab (chapter) page | `GET /api/practice/chapter-subjects/MATH` | 16 | 21 | 1,018 | chapter list | Cached after the first call. |
| 5b | Bab session start | `POST /api/practice/sessions` mode `chapter`, 20 | 182 | 228 | 202 | 20 questions | |
| 6 | Simulasi Kuiz random (20) | `POST /api/bijak/kuiz/sessions` MATH | 167 | 199 | 336 | 20 items | |
| 6b | same, all subjects | same, no `subject` | 181 | 206 | 164 | 20 items | |
| 7 | Jana Kertas generate | `POST /api/bijak/papers/generate` ADDMATH kertas 2 (Disahkan `3472/2`) | 827 | 938 | 1,084 | 1 paper | Loads every approved ADDMATH candidate (9,407 with the Jana set) and solves; scales with the subject size. A subject the size of MATH (60k) was not measured: no Disahkan blueprint for it exists. |
| 8a | Admin question list, page 1, no filter | `GET /api/questions?page=1&pageSize=20` | 692 | 782 | 1,729 | total 286,516 | The time is the status counts and the total (full scan, see F4). |
| 8b | Admin list with the T47 filters | `...&tahun=2023&negeri=sbp&kertas=2&jenis=percubaan` | 46 | 55 | 63 | 163 | Combined filters are fast: `tahun`+`negeri`+`jenis` shrink the set through the source paper. |
| 8b-1 | `tahun` only | `...&tahun=2023` | 51 | 51 | 54 | 5,031 | n=3 |
| 8b-2 | `negeri` only | `...&negeri=sbp` | 83 | 84 | 74 | 11,336 | n=3 |
| 8b-3 | **`kertas` only** | `...&kertas=2` | **1,583** | **1,614** | 673 | 39,000 | n=3; 627 ms p50 in the earlier run on the same data |
| 8b-4 | `jenis` only | `...&jenis=percubaan` | 190 | 238 | 210 | 38,884 | n=3 |
| 8c | Subject + level + status | `...&subjectId=3&educationLevelId=10&status=approved` | 105 | 147 | 96 | 10,607 | |
| 8d | **Text search** | `...&search=nombor 1234` | **1,553** | **1,765** | 1,487 | 79 | Sequential scan of 408k rows, see F3. |
| 9a | Studio stimulus list | `GET /api/stimuli?page=1&pageSize=20` | 18 | 24 | 144 | 2,777 | |
| 9b | Studio group list | `GET /api/stimulus-groups?page=1` | 17 | 23 | 28 | 2,777 | |
| 9c | Stimulus list `status=served` + `q=bahan` | | 36 | 48 | 50 | 2,775 | |
| 9d | Group list subject + `status=served` | | 173 | 221 | 191 | 423 | |
| 10a | Builder candidates | `GET /api/admin/papers/:id/sections/:sid/pool?pageSize=100` | 794 | 830 | 864 | total 9,034 | Builds the whole candidate list of the subject on every page. |
| 10b | **Builder search "Cari soalan"** | `...pool?pageSize=100&q=nombor` | **12,209** | **14,311** | 12,111 | total 9,034 | See F2. |
| 10c | Builder Pratonton kolam | `GET /api/admin/papers/pool-preview?subject=ADDMATH&kertas=2` | 827 | 942 | 883 | 9,190 published | |
| 11a | **Servability overview, warm** | `GET /api/admin/servability/overview` | 9.5 | 13 | 32,752 | bank 250,073 | `bank` is the overview's own scope (contract: approved, active, secondary-level, non-PKSK questions), so it is below the 408,273 generated rows (Darjah and non-approved excluded) and below the 286,516 admin-list total in 8a (secondary, any status). Cache hit. The first call computed it: **32.8 s over HTTP**. |
| 11b | **Servability overview, cold compute** | `ServabilityReadsService.overview()` | 33,598 | 34,071 | | | n=3, direct on the service (no cache); `results-final.json` said `runs: 5` from a hard-coded value in the harness, now corrected to 3. Break-down in section 3.1. |

Note on the earlier run (not committed): an earlier run on a warm cache (before the Postgres restart) gave first-call times of 0.05 to 0.9 s for paths 1 to 6 and the same warm p50/p95 within about 10% (for example P3 246/306, P4 179/217, P8a 657/798, P10b 10.9 s/12.1 s, P11 compute 28.8 s); P11 cold compute ranged 28.8 to 33.6 s between runs.

### 3.1 Servability overview cold compute, by step (REQ-B-022(a))

`overview()` in `servability-reads.service.ts` runs a head step (the bank count, then four reads under one `Promise.all`) and then **a tail of four reads one after the other**. Measured per step on the 408k bank (3 runs, p50, ms):

| Step | p50 |
|---|---|
| Head: bank count | 565 |
| Head: `subjectsListed` | 2 |
| Head: `spmDraw` (SPM draw shape check, grouped by subject) | 4,994 |
| Head: `databankLaneTotal` | 642 |
| Head: `paperLaneCard` (evaluates the 12,438 questions on published papers) | 9,115 |
| Head: the four above as one `Promise.all` (as shipped) | 10,013 |
| Tail: `bab` (`groupCount('chapter')`, includes the MCQ shape check) | 4,192 |
| Tail: `kuiz` count | 2,035 |
| Tail: questions on published papers + per-question `reports()` in chunks of 100 | 17,301 |
| Tail: `janaEligible` | 2,487 |
| **Tail as shipped (sum of the four, one after the other)** | **about 26,000** |
| **Tail as ONE `Promise.all`** | **18,327** |
| Whole `overview()` as shipped | 33,598 |

**Why the steps add up to more than the whole (about 36.6 s = 0.6 + 10.0 + 26.0 against 33.6 s measured):** each step was timed on its own, in separate runs, and the table gives each step's p50. p50s of separate runs do not add, and a step timed alone starts with colder buffers than the same step inside one `overview()` call, where the earlier steps have already read the shared tables (questions, versions, parts) into the buffer cache. The tail sum (about 26 s) is the sum of four separately timed reads, not a single measurement. The whole-call figure (33.6 s) is the one to compare against.

**Gain of one `Promise.all` over the tail: about 7.7 s of 26 s (30%) measured here; it takes the whole overview from about 33.6 s to about 26 s.** (The earlier run measured 21.7 s sequential against 15.0 s concurrent, a gain of 6.7 s, 31%.) The gain is limited because the slowest tail item (17.3 s, the per-question evaluation of the questions on published papers) is 2/3 of the tail, and the four statements compete for the same 4 vCPU. It is a measured gain; the two further savings in F1 are estimates and are not measured.

## 4. Paths between 0.5 s and 1 s (watch list)

P1 login count 548 ms (one count over the bank per call; used on a public page behind a per-address limit of 60/min: cache it for 60 s), P7 Jana 938 ms, P10c pool preview 942 ms, P10a builder candidates 830 ms, P8a admin list 782 ms. All of them grow roughly linearly with the bank (or with the subject).

## 5. Paths with p95 above 1 s: findings and proposed fixes

None of this was applied.

### F1. P11 servability overview, cold compute 34 s (also the 32.8 s first HTTP call)

The cost is statements that scan the whole bank, and the evaluation of every question on a published paper twice.

1. **Run the four-way tail under one `Promise.all`** (measured: -7.7 s, -23% of the total). Code change only (`servability-reads.service.ts`, `overview()`: `bab`, `kuiz`, `onPapers`+reports, `jana` do not depend on each other).
2. **Evaluate the questions on published papers once.** `paperLaneCard()` (9.1 s) calls `servability.factsOf` + `evaluate` on the same 12,438 questions that the tail then evaluates again with `servability.reports` (17.3 s, simulasi_paper). One pass whose result feeds both the hub card and the `simulasi_paper` count removes about 9 s (estimate, not measured). Cost is about 0.7 ms (card) and 1.4 ms (tail) per placed question, so it depends on the number of questions on published papers, not on the bank size; with UAT's real paper count it may be much smaller than here.
3. **The MCQ shape check dominates the SQL.** `spmDraw` (5 s), `bab` (4.2 s) and `kuiz` (2.0 s) all repeat the same `GROUP BY question_parts x part_options x answer_keys` over the 202k approved MCQs. EXPLAIN ANALYZE of the `bab` statement:

   ```
   GroupAggregate  (actual time=4706..4727 rows=1031)         Buffers: shared hit=1574554, temp read=8275 written=8281
     InitPlan 8
       -> GroupAggregate (actual time=2325..2973 rows=202188) Group Key: sp.question_version_id  (shape check)
            CTE c -> Hash Anti Join ... rows=202188           (actual 186..462 ms, the live approved MCQs)
            -> Sort (actual time=2310..2452 rows=814907)      <- the sort of parts x options x keys spills (temp written=8281 blocks)
   ```

   Options (any one): compute the shape verdict once per request and share it between the three reads; or add `work_mem` for the overview session (`SET LOCAL work_mem='64MB'` removes the spill); or, structurally, store the verdict as a column on the version, maintained when a question is saved (a migration, 0106) so the check is an index read. `janaEligible` (2.5 s) has the same shape: a hash anti join of 208k versions against `question_parts` (EXPLAIN: join filter removed 218,932 rows, `temp written=1794`).
4. **Never compute it inside a request.** Warm the cache at application start and refresh it in the background (the H-A21 slot already supports stale-while-revalidate; only the first read is cold). With a 5-minute TTL and a request-path first read, the first admin after a deploy waits 33 s. Cheapest: call the compute from `onApplicationBootstrap` (not awaited) and return the previous value (or a "calculating" state) to a reader that arrives before it is ready.

### F2. P10b Builder search "Cari soalan": 12 to 14 s

`sectionPool()` in `exam/builder/builder.service.ts` (BASE version) applies the text search by hydrating every candidate: `this.questions.describe(filtered ... .slice(0, MAX_EDITOR_CANDIDATES + 500))` and then filtering the preview text in memory. With 9,034 candidates this is about ten Prisma `findMany` calls over `question_versions` with their parts and options, each 1.0 to 1.6 s in the Postgres log (`log_min_duration_statement=400`), 12 s per search. The same method without `q` takes 0.8 s because it only describes the page.

Fix (code, no schema change needed): do the text match in SQL on the candidate ids, `SELECT v.question_id FROM question_versions v WHERE v.question_id = ANY($ids) AND (v.stem_ms ILIKE $q ...)` limited and paged, and describe only the page; with the trigram index of F3 the match itself is fast. Re-measure after t48 (it moves the pool into `section-pool.service.ts` and may already change this).

### F3. P8d admin list text search: p95 1.77 s

`v.stem_ms ILIKE '%...%' OR v.stem_en ILIKE '%...%'` cannot use a btree index, so Postgres reads all 408,273 version rows. EXPLAIN ANALYZE as is:

```
Seq Scan on question_versions v (actual time=17.349..1513.214 rows=79 loops=1)
  Filter: (((stem_ms ~~* '%nombor 1234%') OR (stem_en ~~* '%nombor 1234%')) AND ...)
  Rows Removed by Filter: 408194         Buffers: shared hit=25962
Execution Time: 1803.841 ms
```

Proposed DDL (migration 0106; I built and dropped it only in the throwaway database to test):

```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX CONCURRENTLY ix_question_versions_stem_ms_trgm ON question_versions USING gin (stem_ms gin_trgm_ops);
CREATE INDEX CONCURRENTLY ix_question_versions_stem_en_trgm ON question_versions USING gin (stem_en gin_trgm_ops) WHERE stem_en IS NOT NULL;
```

Result with the index: `BitmapOr` of the two trigram scans, **Execution 20.7 ms** (from 1,803 ms). These are the EXPLAIN ANALYZE execution times of the one search query, not an endpoint p95: the endpoint also runs the status counts and the total (see below and F4), so its p95 was not re-measured with the index. Build time on 408k rows: 18 s for `stem_ms` (the index size was not captured). The index needs `pg_trgm` on the production Postgres (a contrib module). The list also runs the status counts with the same filter (1.8 s as is); the same index serves them. Search terms shorter than 3 characters fall back to a scan.

### F4. P8a / P8b-kertas: the count queries (0.7 s unfiltered, up to 1.6 s with `kertas`)

The page itself is fast (EXPLAIN of the page query with `kertas=2`: 1.9 ms, backward walk of the primary key). The time is the status counts and total that the list returns in `meta` on every call:

```
HashAggregate (actual time=820..820 rows=4)   (counts, no filter)
  -> Hash Anti Join  (actual 391..761 rows=286516)
       -> Seq Scan on question_versions v (actual 249..435 rows=286516)
Execution Time: 825.9 ms
GroupAggregate (actual 890..890 rows=4) (counts with kertas=2)  -> Seq Scan on question_versions (rows=39000) ... Execution Time: 925.1 ms
```

Options: cache the unfiltered `counts`/total for a few seconds to a minute (they change only when a question changes status); for the `kertas` filter add an expression index so the filter stops scanning: `CREATE INDEX CONCURRENTLY ix_question_versions_paper_kertas ON question_versions ((substring(paper_code from '([0-9])[[:space:]]*$')));` (only helpful together with the cache or a smaller candidate set).

**Bug found on the way (A2 area, `questions.repository.ts`):** the Kertas filter is written inside a `Prisma.sql` tagged template as `'([0-9])\s*$'`. In a template literal `\s` is cooked to `s`, so Postgres receives `([0-9])s*$` (seen in the Postgres log: `substring(v.paper_code from '([0-9])s*$')`). It still matches a paper code ending in a digit, which is why it works, but a code with trailing spaces (`MATH/2 `) would not match as intended. Proposed fix: write `[[:space:]]*` instead of `\s*` (or `String.raw`). The expression index above must use the same text.

### Cold first calls after a database restart

Not above the 1 s target in steady state, but listed for completeness: P2b 7.2 s, P3 3.1 s, P2a 2.5 s, P1 2.3 s, P5a 1.0 s. The first call after a restart of the database pays for an empty buffer cache. The 7 s `bankMatrix` query behind P2b is a full-bank group-by; the same advice as F1 applies (warm on start).

## 6. Planner note

Without a whole-database `ANALYZE` after a bulk load the planner works from empty statistics (another developer found an 80 s plan at 50k questions). Every measurement here is after `VACUUM ANALYZE` of the whole database. After the real data load (R1 runbook) run the same on UAT before judging speed.

## 7. Reproduce

All files are in `docs/qa/perf-r1-400k/`. Use a throwaway Postgres only.

1. Start Postgres 16 with the settings of section 2 (for example `docker run -d --name pp-perf -p 55433:5432 -e POSTGRES_USER=<user> -e POSTGRES_PASSWORD=<password> postgres:16-alpine postgres -c shared_buffers=1GB -c work_mem=16MB -c effective_cache_size=6GB -c fsync=off ...`), create the database `perf400k`.
2. Build the branch: BASE + `r1/ha21-overview-cache`, `npx prisma generate` in `apps/api`; `DATABASE_URL=... npx prisma migrate deploy`; `E2E_SEED=1 NODE_ENV=development npx tsx prisma/seed/index.ts --profile=e2e` (demo data, the e2e pupil and Admin Pusat, blueprint `3472/2` Disahkan).
3. Load the bank, in this order, with `psql` (the scripts use `perf_combos` as a scratch table): `00-combos.sql`, then `run-all.sh` (calls `10-batch.sql` and `20-parts.sql` per 50k block with fixed seeds; about 4 minutes), `30-jana.sql`, `40-groups.sql`, `45-source-papers.sql`, `50-papers.sql`, then `VACUUM ANALYZE`. The scripts address the container by name (`pp-perf-t54`): edit `run-batch.sh` for yours.
4. Copy `perf-400k.spec.ts.txt` to `apps/api/test/perf-t54/perf-400k.spec.ts` and run:
   `TEST_DATABASE_URL=postgresql://<user>:<password>@127.0.0.1:55433/postgres PERF_DB_URL=postgresql://<user>:<password>@127.0.0.1:55433/perf400k PERF_DEMO_PASSWORD='<demo password>' PERF_OUT=/tmp/results.json PERF_RUNS=20 PERF_COLD_RUNS=3 npx vitest run test/perf-t54/perf-400k.spec.ts`
   (`PERF_ONLY=P8d,P10b` narrows to some paths; `PERF_LOG=error` shows server errors; `TEST_DATABASE_URL` is only needed because the vitest global setup wants a Postgres to build its template). The spec lifts every `THROTTLE_*` limit so one address can call freely; it is not meant for CI (it is not in `test/` on this branch, on purpose).

Data pitfalls found while building the bank (so the next person does not repeat them): `short_text` answer keys must be plain strings (`values: ["x"]`; objects are only for `numeric`) or the admin list answers 500 for every filtered request; the Jana set must carry KBAT on all marks of Bahagian A of `3472/2` (the blueprint's `kbat_marks` is the section's whole budget) or Jana answers 422 SHORTAGE `kbat`.

## 8. Not measured / limits

- Builder paths on the t48 version (not merged; conflicts).
- Jana Kertas on a subject of MATH size (no Disahkan blueprint exists for it), and its behaviour under concurrent users.
- Concurrency: every path was called by one client at a time, except the cold-overview internals. The H-A21 single flight protects the overview; the others were not load-tested.
- Draws with a long practice history; the real distribution of the legacy bank; a production-sized `papers` count.
- The size of the trigram index (not captured) and the effect of F1 items 2 to 4 (estimates).
