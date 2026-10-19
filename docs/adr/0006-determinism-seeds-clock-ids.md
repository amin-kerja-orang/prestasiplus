# ADR-0006: Deterministic seeds, named PRNG streams, one mock clock, live id strategies

- **Status:** Proposed
- **Date:** 2026-09-25

## Context
- E2E asserts exact figures derived from seeds (e.g. M05 "admin S8 `all` 119 / 38.7 %", M04 "26 pages").
- Seeds must mirror observation (CLAUDE.md §6) and keep live numeric ids (SRS §7.4).
- Canonical accounts use ids 1–11 (TRACKER).
- Seed dates are absolute and written against **2026-09-25T15:40:00+08:00** (M05 §6.12). M06 and M07 tests use 10:00 on the same day.
- Relative times ("{n} jam yang lepas"), greetings, "today", weeks and 60 s polling depend on time.
- Modules are added one at a time. Adding a module must not change another module's generated data.

## Decision
1. **Seed composition:** core (canonical accounts 1–11; their schools are the M02 canonical school anchors 900001/900002) → module seeds in registry order (phase order, `dependsOn` checked) → finalise (compile virtual datasets, apply the persisted overlay). Seeds are pure functions of `(ctx.prng, ctx.clock, fixtures, overrides)`.
2. **Named PRNG streams:** `prng(name)` = mulberry32 seeded from a hash of `seedBase + name`. Each generator uses its own stream (e.g. `m04:generated-questions`, `dataset:questions:layout`, `practice:<sessionId>`). Streams are independent of module order. `setRandomSeed(n)` changes `seedBase`.
3. **Observed values are literal:** anchor rows and observed counts. Generation fills only what the SRS or dataset spec says. Unit tests assert the SRS anchor figures.
4. **One clock** for UI and mock: `now = Date.now() + offset`.
   - Development and demo: the offset is set on first boot so that now = 2026-09-25T15:40:00+08:00, and it is persisted so time runs continuously.
   - E2E: offset 0, with the Playwright clock installed at the test time (default 15:40; M06/M07 at 10:00).
   - All formatting uses fixed UTC+8 with own BM month tables, independent of the browser zone or ICU data.
5. **Id strategies per store:**
   - `sequence({runtimeStart})` (documented runtime ranges, e.g. from 1000);
   - `maxPlusOne` (live-like auto-increment for materialised tables);
   - `floor({start})` for virtual-dataset inserts: ids start above every reserved anchor range, as set by the owner SRS (XL-37);
   - deterministic `uuid(stream)` and `opaque(prefix, stream)` for ids live never exposes.
   - Numeric route params use `(\\d+)`, so non-numeric ids resolve to 404 as on live.
6. Large discovery data (e.g. M03 curriculum) is transformed once by committed scripts into `src/modules/*/mock/data`. The app never reads `docs/`.

## Alternatives considered
- **A single global PRNG:** any new module or reordering would reshuffle every generated value and break other modules' tests.
- **Real time in the demo:** seeded "this week" and "today" figures would go empty or wrong as the calendar moves on, and relative times would drift away from observed copy.
- **Faker-style libraries:** extra weight, locale data that does not match BM live copy, and non-literal anchors.

## Consequences
- Reproducible data and tests on every machine and every viewport project.
- The demo always starts on 25 Sep 2026, 15:40 MYT. **The user should approve this.**
- A module can be added without changing others' data. A change to its own spec changes the seed version, which discards persisted demo overlays.

## Amendment 1 (2026-09-26, overview v1.4 §6.5, §6.9)

Delivery Lead decisions, detailed in ADR-0013 Amendment 1.

1. **`floor({start})` (changes Decision 5).** The start lies above the dataset's `idRange` and outside every reserved anchor range. Reserved ranges may lie above the floor; the allocator skips them (e.g. schools: runtime 10,301+, reserved 900001–900099).
2. **Seed version.** Each dataset contributes a required `specHash()`, computable before compilation and excluding `overrideSpec` transforms.
3. **Seed phases.** Contributions happen in `seed(ctx)`; reads of virtual datasets start in `finalise(ctx)`.

## Amendment 2 (2026-09-27, overview v1.6 §6.9, X-2)

Canonical seed data (M02 v1.16, XL3 R2-01). The fixture schools are **900001–900004**: 900001 "SMK DEMO", 900002 "SK Demo", 900003 "SMK Demo Seri Putra" and 900004 "SK Demo Bestari". **Canonical account 4 (pelajarmaju) is at 900004**, and 900002 now holds only account 1. Decision 1 is updated to match: the core's school references are 900001, 900002 and 900004.
