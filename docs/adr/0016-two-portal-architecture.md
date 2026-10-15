# ADR-0016: Two portals in one codebase: one SPA, two route trees, one layout each, selectable at build time

- **Status:** Proposed
- **Date:** 2026-10-16
- **Related:** TRACKER D28(d), D30, D31; `docs/requirements/v2-portals.md` (US-02, US-14, US-15); `docs/architecture/v2-frontend.md` §3 and §4
- **Supersedes in part:** ADR-0008 (routing, layouts, guards). Superseded: the `layout` meta values `role` and `public-or-user`, "layout chosen by role", and the guard order. Kept from ADR-0008: explicit per-module route tables, typed route meta, lazy components, no file-based routing, no guest-only guard, tab titles, `onForbidden` outcomes. The path-fidelity rule (live paths kept exactly) is superseded for Portal Pentadbiran routes (D29b).

## Context
- Today `meta.layout` can be `role` (admin shell for admins, user shell otherwise) or `public-or-user`, so one route can render in two shells. The admin menu links into student routes (12 observed items), which is the shell-switch problem D28 and D30 want removed.
- Requirement: one route = one portal = one layout; Portal Pentadbiran on host `admin.*`, Portal Pembelajaran on the main host; only role switch, "Mod Pelajar" and login/logout cross portals (D31c, US-15).
- The prototype is a static demo (single host, `vite build --mode demo`) and has 135 E2E specs against one base URL. The future backend is one NestJS API for both portals.

## Decision
1. **One repository, one Vite project, one codebase, two route trees.** The tree is declared by a mandatory route meta `portal: 'pentadbiran' | 'pembelajaran' | 'awam'` (`awam` = public and auth pages: landing, login, register, password reset, public articles/videos). Each portal has exactly one layout component (`PentadbiranLayout`, `PembelajaranLayout`, `AwamLayout`). `bare` stays for full-screen exceptions that belong to a portal (for example games, exam mode) and is declared as `layoutVariant: 'bare'` on a route that still names its portal.
2. **Build modes:** `VITE_PORTAL=all` (dev, demo, E2E: both trees in one site), `admin` (only Pentadbiran and Awam trees, for host `admin.*`), `learn` (only Pembelajaran and Awam trees, for the main host). Module manifests expose lazy route factories per portal, so the unused tree and its code are dropped from a split build. A CI check asserts that the `learn` bundle contains no Pentadbiran page chunk and vice versa.
3. **Paths:** Portal Pentadbiran lives under the prefix `/admin/**`; Portal Pembelajaran keeps its current learner paths; Awam keeps `/login`, `/register`, `/artikel`, `/video` and the other public paths. A unit test fails when a route's `portal` and path prefix disagree. In split mode the admin host redirects `/` to `/admin`.
4. **Cross-portal rule in the guard:** a signed-in user whose active role belongs to portal A opening a route of portal B is redirected to A's landing path (same site in `all` mode, `location.assign` to the other origin in split mode). No portal data or chunk is rendered first. Only the role switcher, Mod Pelajar and login/logout move a user between portals.
5. **Public pages that today use `public-or-user`** (articles, videos) become `awam` only. A signed-in learner reaches the same content through a Pembelajaran route that reuses the page component. Result: no route renders in two layouts.
6. **Single menu definition per portal** (data, not template), used by sidebar, mobile navigation, Ctrl+K and the route audit (AC-02.5, AC-03.6, AC-14.5).
7. **Legacy pages stay alive during migration** inside the new layouts through a `LegacyScope` wrapper (see `v2-frontend.md` §7). The old `AdminShell` and `UserShell` are deleted in the closing task.
8. **Session between hosts:** one server session cookie on the parent domain (backend task), the active role is part of the session; the client never trusts its own portal check (UX only, the API enforces).

## Alternatives considered
- **Two Vite entries or two repos from day one (separate apps for admin and learn):** strongest bundle and deployment isolation, but it duplicates the session store, router, API client and theme, doubles CI and E2E setup, and breaks the single-host static demo. The build-mode design gives the same deployable isolation from one codebase. If a hard organisational split is wanted later, the two portal folders are already independent entry points.
- **Path-only separation in one deployed site on one host:** simplest, but the requirement names a separate admin host and the admin bundle would be downloadable by learners. Kept only as the demo/dev behaviour (`all`).
- **Layout chosen by role at render time (status quo):** the cause of the problem.
- **Micro-frontends / module federation:** unjustified complexity for one team and one design system.

## Consequences
- Every route needs a `portal`. A mechanical conversion of the 23 module manifests is a task (V2-T12). The 12 shell-switch items are fixed by moving their pages into the admin tree.
- E2E keeps one base URL in `all` mode. Split-mode smoke tests (two preview servers) are added by devops in V2-T23.
- Old admin-ish paths (`/ppd/*`, `/jpn/*`, `/admin-sekolah/*`, `/spm/*` admin lanes) move under `/admin/**`; a temporary redirect table keeps existing specs green until they are updated.
- A feature that both portals need (for example live drill-down) is a shared component imported by both portals' pages, never a route reachable from both.
- Open: final public hostnames and the parent-domain cookie are a devops/backend decision (not blocking the frontend).
