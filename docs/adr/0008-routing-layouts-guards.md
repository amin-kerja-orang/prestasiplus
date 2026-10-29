# ADR-0008: Explicit route tables, live paths, layout chosen by route meta, role guards

- **Status:** Proposed
- **Date:** 2026-09-25

## Context
- All live routes must be kept exactly: paths, query names and numeric ids (D7).
- The shell is **not** a pure function of the path prefix:
  - `/admin/master-notes` renders in the user shell (M04 S12);
  - `/tetapan` (M01 S9) and `/spm-mock*` and `/pusat-ai/spm` (M06 S11–S13) use the admin shell for admins and the user shell for others;
  - `/artikel` and `/video` use a public layout for guests and the user shell when logged in (M09 discovery);
  - auth pages, 404, 403 and the renewal invoice have no shell.
- Guests on protected routes go to `/login?redirect=<original path>` with no message (FR-M01-14, BR-08; v2: D51, M01-DEV-02).
- Non-admins on admin routes are redirected to their landing path (M02 FR-99, M03 FR-94, M07 FR-59), while some pages render a standalone 403 (M08).
- Tab titles vary in suffix per screen.

## Decision
- Vue Router 5 with `createWebHistory` and **explicit per-module `routes.ts`**, collected by `src/app/modules.ts`. No file-based routing. Route components are lazy.
- **Typed route meta:**
  - `layout`: `admin | user | role | public-or-user | bare`;
  - `access`: `public | auth`;
  - `roles?`;
  - `onForbidden`: `landing | 403 | 404`;
  - `title` (exact string or function);
  - `header`;
  - `module`.
- **`LayoutHost`** resolves the layout from meta and the role, and keeps the shell mounted across routes with the same layout.
- **Guards, in order:** session expiry → auth (guest → `/login`) → roles (`onForbidden`, default landing redirect) → after-each (title, header reset, flash, scroll top). Login and register have no guest-only guard (FR-M01-13).
- **Landing path** (M01 BR-07) is delivered by the mock in `UserMe.landingPath`. The client does not hard-code it.
- **Core routes:**
  - `/logout` is an action route;
  - the catch-all renders the 404 page;
  - 403 is rendered in place (no URL change);
  - `/` redirects the guest to `/login` and a logged-in user to their landing path (proposed; the landing page is out of scope).
- Routes of modules not yet built are not registered, so they resolve to 404 until built. The shell menus still show them.

## Alternatives considered
- **Layout by path prefix only:** contradicts observed screens (M04 S12, M01 S9, M06 S11–S13, M09).
- **Nested routes per shell:** forces one shell per path subtree, and cannot express role-based or guest-based shells.
- **File-based routing (Vue Router 5 / unplugin):** path-from-filename is awkward for live paths such as `/password/reset-ic` and `/practice/chapter/:code/:chapterId/quiz`, and it hides meta.

## Consequences
- Every screen declares its shell, access and exact title next to its path, which reviewers can check against SRS §2.
- Adding a module touches one line in `src/app/modules.ts`.
- **User approval needed:** the `/` behaviour, and unbuilt menu items leading to 404 during the incremental build.
