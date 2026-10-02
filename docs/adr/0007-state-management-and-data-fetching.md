# ADR-0007: Pinia for global state only; every navigation behaves like a page load

- **Status:** Proposed
- **Date:** 2026-09-25

## Context
Live is a server-rendered Laravel + Alpine site. Every navigation, including query-only filter changes, is a full page load: fresh data, scroll to top, a flash message shown once, and the badge count and identity rendered with the page. Some state is genuinely global:
- the session and user identity (shell blocks);
- the shell UI state that live keeps in localStorage (`admin_sidebar`, `sidebarOpen`);
- the notification badge (refreshed on load, every 60 s and on push, FR-M01-53);
- flash messages.

## Decision
- **Pinia 3** holds only the global stores: `session`, `shell`, `notificationBadge`, `flash`.
- **Page data** is fetched on route entry through `useApi(fn, deps)`, which refetches when route params or query change. There is **no client cache** and no cross-page store of page data.
- On each navigation: scroll to top (hash anchors excepted), consume the flash, refresh the identity (`GET /api/me`) and badge in the background, and update the tab title and shell header.
- Emulate live Laravel idioms explicitly:
  - flash messages via `useFlash` (from response `status` fields);
  - native `confirm()` and `alert()` via thin wrappers;
  - native HTML5 form validation with a server-error `AlertBox`.

## Alternatives considered
- **Composables with module-level reactive singletons (no Pinia):** workable, but Pinia gives devtools, testing helpers and a clear place for the few stores, at little cost.
- **TanStack Query or a similar cache:** caching and background refetch contradict live's page-load semantics and would create stale-data differences from live. It is also an extra dependency.
- **Stores per module for page data:** leads to stale cross-page state and tangled ownership.

## Consequences
- Behaviour matches live reload semantics, so tests and fidelity are simpler.
- There are slightly more requests than a caching SPA. This is irrelevant with an in-process mock, and it matches a real server-rendered backend.
