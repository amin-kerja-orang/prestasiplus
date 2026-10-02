# ADR-0005: Mock data persistence (memory + IndexedDB diff + cross-tab broadcast)

- **Status:** Proposed
- **Date:** 2026-09-25

## Context
The prototype emulates a server-backed site. Many approved ACs reload the page after a change and expect the change to persist, for example:
- E2E-M01-34 "reload shows the saved values";
- E2E-M01-41 "after reload the counts decrease";
- pagination and filter pages that are full page loads on live.

E2E-M01-49 marks notifications read "in another tab" and expects the first tab's badge to update. Uploads (avatars, question and diagram images) must survive at least a reload. M01 DATA-M01-02 fixes the auth token in `localStorage['pp.auth']`. Each Playwright test must start from fresh seeds. Large collections are virtual (D11), so persisting full snapshots is neither possible nor needed.

## Decision
- **Runtime source of truth:** in-memory tables and compiled virtual datasets.
- **Persistence:** a **row-level diff against the deterministic seed** is stored in IndexedDB (`pp-mock`, via `idb-keyval`). It holds:
  - materialised-table upserts and deletes, and id counters;
  - virtual-dataset overlays (overrides, deletes, inserts);
  - uploaded files as Blobs;
  - the auth session table;
  - the clock offset.
- **Write-through:** a mutating request resolves only after its diff is committed, in one IndexedDB transaction per request (`db.transaction`).
- **Cross-tab:** every commit is broadcast on `BroadcastChannel('pp-mock')`. Other tabs apply it in memory.
- **Versioning:** the diff carries the seed version (a hash of registry order, seed versions, dataset specs and fixture hashes). On a mismatch it is discarded.
- **Reset:** `mock.reset()` (dev/e2e) clears the diff, re-seeds and broadcasts. The demo build has **no reset UI** (fidelity). Clearing site data or deploying a new seed version resets it.
- The auth token stays in `localStorage['pp.auth']` (M01).

## Alternatives considered
- **Memory only:** fails every "after reload" AC and the cross-tab badge AC.
- **localStorage snapshot or diff:** 5 MB quota, synchronous and blocking, and Blobs would need base64 (a 2 MB avatar is about 2.7 M characters), so uploads would overflow the quota.
- **sessionStorage:** not shared with new tabs, and the same quota issues.
- **Mutation-log replay** (re-run recorded requests at boot): elegant, but fragile across handler changes and slower as history grows.

## Consequences
- Reload-persistence and cross-tab behaviour match a server-backed site.
- Test isolation is free, because every Playwright context starts with empty storage.
- Demo data persists per browser until site data is cleared or a new seed version is deployed. **The user should approve this demo behaviour.**
- The app boot waits for the mock to hydrate. This takes a few milliseconds and happens before the first route resolves.
