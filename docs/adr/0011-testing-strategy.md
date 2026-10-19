# ADR-0011: Testing strategy (Vitest + Playwright on 3 projects, pre-boot mock init, provisional tags)

- **Status:** Proposed
- **Date:** 2026-09-25

## Context
- Every SRS E2E scenario runs on mobile 375×812, tablet 768×1024 and desktop 1280×800 (NFR-RESP, SRS §10/§11).
- Several scenarios cover behaviour that was never observed on live (UNVERIFIED or INFERRED, e.g. M06 L-8, M07 L-2/L-3, M05 LS-7) and must be clearly separated.
- SRSs request test hooks: reset, latency, faults, clock, session, and module-specific hooks.
- The hooks must be excluded from the production (demo) build.
- G3 needs real lint, type and test evidence. G5 needs every AC executed.
- D11/D12 add datasets and repositories whose counts and invariants must be exact.

## Decision
- **Vitest** (`*.test.ts` under `src/**/__tests__`). This covers:
  - mock handler contract and business-rule tests (Node environment);
  - **dataset tests** (spec totals, cells, anchors, id range, golden rows, a 50 ms query budget);
  - **repository tests** (owner invariants such as the session completion side effects);
  - library tests (formatters, relative time, pager window, PRNG golden values, icon resolver);
  - shared component tests (jsdom).
- **Playwright** (`e2e/**/*.spec.ts`):
  - the `e2e` build is served by `vite preview`;
  - 3 Chromium projects (mobile and tablet with `isMobile` + `hasTouch`);
  - `locale: 'ms-MY'`, `timezoneId: 'Asia/Kuala_Lumpur'`;
  - folders `e2e/global/` and `e2e/mXX-<slug>/`.
- **Traceability:** test titles start with the SRS id (`E2E-M01-03 …`) and carry the tag `@mXX`. `scripts/check-e2e-trace.mjs` checks that each approved SRS id maps to exactly one test.
- **Provisional:** tests over unobserved behaviour carry `@provisional`. `test:e2e:observed` excludes them, and QA reports both counts.
- **Mock bootstrapping:** fixtures inject `window.__MOCK_INIT__` (now, latency, overrides, seed, session) with `addInitScript`, and install the Playwright clock. `window.__mock` gives runtime hooks. Each test gets a fresh browser context, which means fresh seeds.
- **Hooks excluded from the demo build:** they load behind a static `VITE_TEST_HOOKS` check, and `scripts/check-demo-bundle.mjs` fails the build if the hook marker is present in `dist/`.
- **Locators:** role and exact-text first, since BM copy is the contract. `data-testid` (`<scope>-<screen>-<element>[-<id>]`) only where text is absent or ambiguous. Computed-style assertions are used for style ACs. Tailwind class names are never asserted.
- **Standard helpers:** `expectNoHorizontalScroll`, `expectTabTitle`, `expectTouchTarget`, dialog handling, `isDesktopShell` (≥1024).

## Alternatives considered
- **E2E against the dev server:** slower cold starts per route and differs from the shipped build.
- **Visual snapshot testing:** useful later, but font and antialiasing noise across machines makes it a poor G5 gate now.
- **Logging in through the UI in every test:** slow. It is kept only for the M01 login scenarios.

## Consequences
- Fast, deterministic E2E that is traceable to SRS ids, with a clean observed/provisional split.
- Dataset and repository correctness is caught in seconds by Vitest, before any browser runs.
- The demo build ships no test surface.

## Amendment 1 (2026-09-26, overview v1.2 §6.13, §12.2, §13)
- **Separate e2e output:** `build:e2e` runs `vite build --mode e2e --outDir dist-e2e`, and Playwright previews from `dist-e2e/`. The demo `dist/` therefore never contains test hooks.
- **Guard marker:** `scripts/check-demo-bundle.mjs` looks for a dedicated sentinel string defined in `src/mock/testing/hooks.ts`, not `__mock` or `__MOCK_INIT__`. It takes an optional dist-path argument. F-08 must show that the guard **fails** on an e2e-mode build.
- **`test:e2e:module`** is a cross-platform node wrapper script in `scripts/`, because `$MODULE` does not expand in npm scripts on Windows. Usage: `npm run test:e2e:module -- <slug>`, or set `MODULE=<slug>`.

## Amendment 2 (2026-09-26, overview v1.4 §6.13, build-plan v1.6)

Recorded after F-08 was built. Delivery Lead decisions.

1. **Boot wiring.** `startMock(options)` in `src/mock/index.ts` lazy-loads `@/mock/testing` when `VITE_TEST_HOOKS === 'true'`. `src/app/bootstrap.ts` (F-13) awaits `(await import('@/mock')).startMock({ persistence: createMockPersistence(), init: window.__MOCK_INIT__ })` before it creates Pinia, the router and mounts, then installs `runtime.transport`.
2. **Delegated hooks.** `setUser` is registered by the mock core (F-11) and writes `pp.auth`, so the session store reads it after boot. `expireSession` is registered by M01 (M01-T1). M01 sends reset mails as outbox messages of type `'password-reset'` with `data.token`, which `outbox.lastResetFor` reads.
3. **Playwright fixtures (F-22).** `__MOCK_INIT__` is set with `addInitScript`; `loginAs` uses `__MOCK_INIT__.session`; the fixture exposes `PLAYWRIGHT_CLOCK_BINDING` with `context.exposeFunction` (corrected 2026-09-27; originally written as `page.exposeFunction`), wired to the **context** clock (`context.clock`, originally `page.clock`), so pages opened with `newTab()` share it. With `clockMode: 'install'` (default) the fixture does **not** send `now` in `__MOCK_INIT__`; see Amendment 3. Types come from `src/mock/testing/contract.ts`, which has no imports.
4. **Guard proof moved (changes Amendment 1).** The check that `scripts/check-demo-bundle.mjs` fails on `dist-e2e/` can only be proven once `bootstrap.ts` calls `startMock`. It is an F-13 acceptance check: `npm run build:e2e && node scripts/check-demo-bundle.mjs dist-e2e` must fail.
5. **Budget.** The dataset performance test covers every query shape of ADR-0013 Amendment 2 (≤ 50 ms for facet, id, cheap-field and `search` queries; ≤ 1,500 ms cold and ≤ 50 ms cached for full-derivation queries).

## Amendment 3 (2026-09-27, overview v1.7 §6.12–§6.14, §12, build-plan v1.9)

Recorded after the F-22 review (finding 8) and the student-slice boot measurements. Delivery Lead decisions.

1. **E2E clock contract.** The e2e build uses the clock policy `passthrough`: boot offset 0, the app reads the browser clock (`Date.now`), which the Playwright clock drives (`src/mock/determinism/clock.ts`). The fixture option `clockMode: 'install' | 'none'` selects the mode:
   - `'install'` (default): the Playwright clock is installed on the **browser context** at `mockInit.now` (default 2026-09-25T15:40:00+08:00), and the bridge is exposed with `context.exposeFunction`, once per context, so `newTab()` pages share both. The fixture **never sends `now` in `__MOCK_INIT__`**: an explicit pre-boot `now` wins over every policy, so it would reset the time on every reload and undo `advanceTime`.
   - `'none'`: no Playwright clock, real time; `mockInit.now`, if given, goes to `__MOCK_INIT__.now` as a mock offset, and `__mock.setNow` / `advanceTime` throw.
2. **Boot helpers and timeouts.** Specs navigate with `gotoApp(path)` / `reloadApp()`, which wait for the app boot (`waitForApp`: `__mock.ready`, Vue mounted, `router.isReady()`) with their own 15 s timeout. `expect.timeout` stays at 5 s. A bare `page.goto` is not used for app URLs.
3. **Boot budget.** Because the app draws nothing until the mock has booted, warm boot is budgeted at **≤ 2,000 ms** on the reference machine (measured 1.43 s with M05). A boot perf test in the Vitest `perf` project is the gate; `waitForApp` records boot telemetry as a non-failing test annotation (build-plan F-34).
4. **Perf tests are separate.** `npm run test` runs the unit project only; `npm run test:perf` runs every `*.perf.test.ts` serially on a quiet machine and is required at G4 for perf-sensitive tasks and at QA (ADR-0013 Amendment 3).

**Consequences.** Reloads in E2E keep advanced time, and cross-tab tests share one clock. Boot time has a number and an owner, so blank-screen time cannot grow unnoticed. Timing gates no longer make `npm run verify` flaky under agent load, at the price of a separate quiet-machine run at G4 and QA.
