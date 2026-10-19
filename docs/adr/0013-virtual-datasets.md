# ADR-0013: Large collections as deterministic virtual datasets (implements D11)

- **Status:** Proposed. Implements project decision **D11** (Delivery Lead, 2026-09-25).
- **Date:** 2026-09-25
- **Related:** `docs/qa/audit/cross-module-logic-M01-M07.md` (XL-01, XL-02, XL-07, XL-11), ADR-0006, ADR-0014, overview §6.5–§6.6

## Context
Live shows large totals: questions 466,041 rows incl. PKSK (M04 §6.13), schools 10,220, videos 2,260, and many users and sessions. Module fixtures seeded small hand-made sets and asserted live constants on some screens and fixture totals on others. The result was contradictory counts across modules (XL-02). Other modules also added their own fixture rows on top of the owner's store (M05 +541/577, M07 763, M08 +51, M06 SPM pool), with virtual ids outside it (XL-01). D11 decides: the mock reports live totals, generates rows on demand deterministically in the live id range, with attribute distributions matching the observed per-facet counts. Observed anchors override generated rows at their ids. Every count is computed from the dataset. Materialising 130k objects in the browser for every boot, query and E2E test is too slow.

## Decision
A generic primitive, **`defineVirtualDataset`** (`src/mock/dataset`), which implements the same `Store` interface as materialised tables (`get`, `getMany`, `query`, `count`, `groupCount`, `sample`, `insert`, `update`, `remove`).

1. **Spec:** `idRange` (live), `facets` (count-relevant fields), `distribution`, `derive(id, cell, rng)` for non-facet fields, and `anchors`.
2. **Distribution → cells.** The spec compiles to explicit cells `{facetValues, count}` whose sum is the live total. Helpers:
   - `exact` (observed per-combination counts);
   - `split` (largest remainder, exact sums);
   - `nest`;
   - `fit2d` (an integer table matching two observed marginals exactly over allowed combinations; infeasible totals **fail the build** and go back to the owner SRS under D9).
   - Screen figures are **named queries** on the dataset (M04 §4.1: e.g. 128,989 = Q-ELIGIBLE, 130,152 = Q-ACTIVE + Q-PKSK), so different values on different screens are not contradictions. Where live values truly cannot all hold, the owner SRS's approved D9 value is used.
   - **Exception, documented display constants (XL-34):** an observed display figure that no dataset definition reproduces (e.g. M06 hub 20,529 / 14,673, DV-M06-01) may be declared per module as a `DISPLAY_CONSTANT` with its DV id. It is excluded from the fit check and must never appear on the same screen as a contradicting computed figure.
3. **Slots:** N slots with strictly increasing ids spread over `idRange`. Cell labels are assigned by a deterministic shuffle (stream `dataset:<name>:layout`), so cells interleave across ids.
4. **Anchors:** each observed record claims the nearest slot of its own cell. That slot is removed and the anchor keeps its id: a live id, or an id in a reserved fictitious range outside the live range (e.g. schools 900001–900099, M02 v1.3). A colliding slot moves to the nearest free id. Totals and cell counts do not change, and other rows keep their ids. More anchors than a cell's count **fails the build**. This enforces "fixtures are anchors, not additions".
5. **Storage:** typed arrays only (`ids`, `cellOf`), about 3.7 MB for the 466,041-row question dataset. Rows are derived on demand from `(id, cell, rng(name, id))`.
6. **Queries:**
   - facet counts and group counts are O(cells);
   - lists scan `cellOf` against a cell mask in id order with early exit, and derive only the returned rows;
   - text or derived-field filters scan derivations with an LRU result cache;
   - `sample` draws from matching cells.
   - "Newest first" is a reverse id scan, because generated `createdAt` is monotone in id. Anchors are merged by their own `createdAt`.
   - Budget: ≤ 50 ms per query on the largest dataset (466,041 rows), checked by a performance test.
7. **Mutations:** an overlay (overrides, deletes, inserts). Runtime inserts use the `floor` id strategy: ids start at an owner-set floor **above every reserved anchor range** (questions per M04 v1.5; users 9,000,001; schools 10,301), so a later anchor can never collide with a persisted runtime row (XL-37). Facet changes move the row to the matching cell and adjust per-cell deltas, so counts stay exact. The overlay is what persistence stores (ADR-0005). Every mutation bumps the dataset version.
8. **Seed-time contributions:** non-owner modules pass anchors, or for pools the cells plus anchors, through the owner's repository (`contributeAnchors`) during seeding only (ADR-0014). Datasets compile after all seeds have run.
9. **Overrides for tests** (e.g. M06 `spmPool: {MATH: {addT5: 10}}`) modify the spec before compilation, so every dependent count moves together.

**Candidate datasets:** `questions` and `structuredQuestions` (owner M04), `schools` (owner M02), and `users` (owner M01/M02, if its live totals are shown, overview X-9). Later: `videos` (M09) and others as their SRS shows large totals. Small per-user or runtime collections stay materialised tables.

## Alternatives considered
- **Materialise every row at boot:** 466k objects cost seconds and hundreds of MB across modules, slow every E2E test, and make persistence impractical.
- **Keep small fixtures and hard-code live totals on screens:** this is exactly the XL-02 contradiction. Counts would disagree with lists and filters.
- **Pure hash-per-id attributes, no cells:** per-facet counts would only be approximately right, so observed numbers could not be matched exactly.
- **Server-side (Node) mock with SQLite:** not a static demo, and heavier than needed.

## Consequences
- One source for every count and list. Contradictions surface as build failures, not as review findings.
- Stable, deterministic rows at live ids. Adding anchors perturbs only locally.
- Owner SRSs must provide dataset specs (overview X-7): total, facets, observed counts with sources, id range, anchors.
- Generated rows are dummy content by design (UR-G-10 realism via per-subject stem lists). E2E asserts anchors and computed counts, not generated texts.

## Amendment 1 (2026-09-26, overview v1.4, build-plan v1.6)

Recorded after F-09 and the W0.4 review. Delivery Lead decisions.

1. **Runtime floor vs reserved ranges (replaces "above every reserved anchor range" in Decision 7).** The `floor` start must lie **above `idRange`** and must **not fall inside any reserved anchor range**. Reserved ranges **may lie above the floor**; the runtime allocator skips them. The XL-37 guarantee is unchanged: a persisted runtime row can never take an id an anchor may use later. Example: M02 schools, runtime 10,301+ with the reserved range 900001–900099 above the floor.
2. **`specHash()` is required.** Every dataset provides a stable hash of its definition (spec, id ranges, reserved ranges, runtime floor, facets, literal anchors). It is computable **before** compilation and **excludes** `overrideSpec` transforms. The seed composer rejects a dataset without it (overview §6.9).
3. **Spec overrides are owner-only.** No module calls `overrideSpec` directly. A non-owner that contributes distribution cells (Decision 8, the M06 SPM pool) calls an owner repository method that wraps it, e.g. `questions.contributeCells(contributor, cells)`. It is seed-phase only and validated by the owner (ADR-0014 Amendment 1).
4. **Budget on the slow path (extends Decision 6).** The 50 ms budget applies to every query form, including filters on text and derived fields and `match` predicates, measured without a warm cache. The largest dataset is now the M05 answer log (478,499 rows). A case that cannot meet the budget goes to the Delivery Lead; it is not waived silently.
5. **Generated ids are opaque.** Only totals, cell counts and anchor ids are contractual. The highest generated id depends on how many anchors sit in reserved ranges. Accepted: M05 generated session ids may run to about `g32122` instead of `g32096` (26 anchors in a reserved range); no figure depends on it.

## Amendment 2 (2026-09-26, overview v1.5 §6.6, §6.9, build-plan v1.7)

Delivery Lead decision on F-09's proposal. It replaces item 4 of Amendment 1 and refines Decision 6.

1. **Budget by query shape.**
   - **≤ 50 ms** for every query shape that uses facets, `id`, cheap fields or `search`.
   - A cold query that must **derive every row** (a filter or sort on a field that is not declared cheap, or a `match` without `matchFields`) may take **up to 1,500 ms**. Once it is cached (same query, same dataset version) it must take ≤ 50 ms.
   - Both shapes are measured on the largest dataset (the M05 answer log, 478,499 rows).
2. **Owner rule.** Any derived field that a screen filters, searches or sorts on must be declared as a **cheap field** (the `fields` option) or a **facet**. Text search uses `search: { term, fields }`. Fields searched on list screens must be listed in `searchFields`, so their index is built at boot.
3. **API additions (F-09, as built).**
   - `fields`: cheap derived fields, pure functions `(key, facets) => value` with no PRNG stream.
   - `searchFields`: cheap fields whose lowercase search index is built at boot.
   - Query and count options: `search: { term, fields }` (case-insensitive substring over any field), `matchFields` (the fields a `match` reads, which gives a partial row with no derivation) and `cacheKey` (a stable LRU key for a `match`).
   - `hashKey(key, salt = 0)`: a stable 32-bit per-row hash for variation inside cheap fields.
4. **`specHash()` excludes function bodies.** It hashes data only (spec, ranges, facets, literal anchors), not `derive` or cheap-field code. F-06 covers code changes through the module seed version: each module plugin's `version` must be bumped whenever its seed, `derive` or cheap-field code changes.

**Consequences.** Screen queries stay interactive without materialising rows. The price is a declaration duty on dataset owners (cheap fields, `searchFields`) and a version-bump discipline for code changes.

## Amendment 3 (2026-09-27, overview v1.7 §6.6, §6.14, build-plan v1.9 F-09 decision 6, F-34)

Records the perf test policy as F-09 built it. Delivery Lead decision.

1. **Separate runs.** `npm run test` runs the Vitest `unit` project only; it has no timing gates. Every budget test is a `*.perf.test.ts` file in the `perf` project, run by `npm run test:perf`, serially, on a **quiet machine**. The run is **required at G4 for every perf-sensitive task and at QA**.
2. **One harness.** Every perf test uses `src/mock/dataset/testing/perf-calibration.ts` (test-only):
   - each case is paired with a `js` or `native` **floor** of the same kind of work, measured next to it;
   - a **ratio gate** (`best ≤ cap × pairedFloor`) is always enforced; caps come from measured runs (`perf-caps.ts`), honest caps have no slack, and only a `noisy` case gets an absolute slack;
   - the ms **budget gate** is scaled by the floor up to `scaleCap` and is **skipped**, never widened, when the machine is too loaded;
   - **`assertSkipShare()`** fails the run when more than **25 %** of budget gates were skipped, or when **any** regression proof was skipped;
   - **`proveRegression`**: at least one case per group is run really 2× slower, and the ratio gate must fail every time.
3. **Evidence rule.** A skipped or failed perf run is not gate evidence. The answer to a loaded machine is a quiet rerun, not a wider cap; cap and budget changes go to the Delivery Lead.
4. **Boot cost.** Dataset compiles and boot-time primes count against the mock boot budget (warm boot ≤ 2,000 ms, overview §6.14). Owners of large datasets build at boot only what the first screen needs (`searchFields` for list-screen search), and build other indexes and caches lazily within the query budget.

**Consequences.** Timing results stay trustworthy while other agents load the machine, and the gates are shown to catch a real 2× regression. The cost is a separate, deliberate quiet-machine run at G4 and QA.
