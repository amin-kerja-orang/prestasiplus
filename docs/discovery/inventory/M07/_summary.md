# M07 — Element inventory & link crawl: summary

- **Captured:** 2026-09-25 from live https://prestasiplus.my, read-only, admin session on browser lane 3 (`playwright3`; credentials not stored).
- **Method:** the same pipeline as M01–M06: `tools/inventory.js` → `tools/run-state.js` → `tools/split-batch.js` → `tools/merge-inventory.js` → `tools/diff-narrative.js`.
  - Capture plan: `tools/jobs/M07.js`, 53 UI states over 8 screens in groups A–F.
  - Screen map: `tools/jobs/M07.screens.json`.
  - Masked screenshots: `tools/jobs/M07.shots.js` + `tools/shoot.js`, 25 PNGs in `docs/discovery/img/M07/`.
  - Appendix generator: `tools/jobs/M07-appendix.js` (copy of the M06 helper).
  - **No shared tool was modified.**
- **Privacy:**
  - Every job first runs `M07MASK` (in `tools/jobs/M07.js`), both before and after its actions, then `tools/sanitize.js` with `{titleName:false}`. On `/admin/pksk/access` `M07MASK` replaces the "Pengguna" cell (name → `<person>`, e-mail/username → `<email>`) and any non-"-" "Diberi Oleh" cell. On the create form it moves the rendered domain `<option x-text="d.name">` binding to `data-x-text`, so that sanitize rule 1e does not mask the 15 domain names; the `<template x-for>` source still carries `x-text="d.name"`.
  - `titleName:false` is used because the tab titles "… - Admin" and "PRESTASIPLUS - Platform Latih Tubi Nasional" contain no person. The first capture masked "Admin" as a name; that capture was discarded and re-run.
  - The access empty state `?search=zzzzqqq` runs with `keepCols:'.*'`, because the colspan empty-state cell sits under the "Pengguna" header. The table has no rows, so nothing personal is exposed.
  - `meta.piiLeakCheck` is 0 leaks in all 53 states. A grep of all raw and merged M07 files, the narrative and the job files found **no e-mail addresses** and no `bin`/`binti` patterns. No real name was read into any file.
  - The one lane-3 MCP snapshot of the unmasked access page (`.playwright-mcp/lane3/page-…08-36-05-742Z.yml`, git-ignored) was deleted.
- **Files:**
  - Screen inventories: `S1-pksk-hub.json` … `S8-access.json`.
  - Layout chrome: `SHU-user-shell.json` (user portal, S1–S3) and `SHA-admin-shell.json` (admin panel, S5–S8). Both are owned by the global doc.
  - `_crawl.json`.
  - Raw captures: `../_raw/M07/*.json` (53).
- **Status legend:** same as M01–M06. `normalizeIds` is on. Table rows (`main tbody tr`) are limited to the first 3 per state via `opts.repeat`; the totals are in each state's `meta.repeats`. All domain cards (S2, S3) and all 3 access rows are kept.

## 1. Per-screen counts

M07 content totals **486 elements** over 8 screens and **53** captured states (1280 / 768 / 375). The shells add 378 (user portal) and 207 (admin) chrome elements, which are not M07 content. **No captured state has horizontal page overflow.** Overflow inside table cards is described in narrative §7 (D-7).

| Screen (route) | Total | Visible default | Conditional | Hidden only | Mobile only | Desktop only | States | States captured |
|---|---|---|---|---|---|---|---|---|
| S1-pksk-hub `/pksk` | 39 | 36 | 0 | 3 | 0 | 0 | 3 | default @1280/375/768 |
| S2-level-dashboard `/pksk/level/{L}` | 108 | 82 | 23 | 3 | 0 | 0 | 5 | default (T1), t4, not-found (T9) (@1280); default@375, default@768 |
| S3-domains `/pksk/level/{L}/domains` | 66 | 40 | 23 | 3 | 0 | 0 | 5 | default (T1), t4, not-found (@1280); default@375, default@768 |
| S4-history `/pksk/level/{L}/history` | 7 | 7 | 0 | 0 | 0 | 0 | 3 | server-error (T1), server-error-t4 (@1280); server-error@375 |
| S5-questions `/admin/pksk/questions` | 109 | 63 | 16 | 30 | 2 | 18 | 13 | default, row-selected, select-all, bahagian-a, bahagian-c, level-t1-b, search, empty, filtered-page-2, last-page (@1280); default@375, row-selected@375, default@768 |
| S6-create `/admin/pksk/questions/create` | 57 | 34 | 18 | 5 | 0 | 0 | 10 | default, bahagian-a, bahagian-b, bahagian-c, domain-reset, max-options, min-options (@1280); default@375, bahagian-b@375, default@768 |
| S7-edit `/admin/pksk/questions/{id}/edit` | 59 | 41 | 12 | 6 | 0 | 0 | 7 | default (B #178460), bahagian-a (#178359), bahagian-c (#178349), option-added, not-found (@1280); default@375, default@768 |
| S8-access `/admin/pksk/access` | 41 | 26 | 8 | 7 | 0 | 0 | 7 | default, form-open, form-toggled, search-empty (@1280); default@375, form-open@375, default@768 |
| SHU-user-shell (chrome of S1–S3) | 378 | 153 | 21 | 204 | 15 | 148 | 11 | all user-portal states |
| SHA-admin-shell (chrome of S5–S8) | 207 | 77 | 18 | 112 | 7 | 72 | 36 | all admin-layout states |

The mobile-only / desktop-only items on S5 are the Laravel paginator ("« Previous" / "Next »" below sm; numbered links and "Showing … results" from sm).

**Empty / error / special states captured:**
- S5 "Tiada soalan PKSK lagi" + "Tambah soalan pertama" (`?status=pending`). Table cell text is summarised by the inventory as a `table` element; the copy is quoted in the narrative.
- S8 "Tiada rekod akses" (`?search=zzzzqqq`).
- S4 HTTP 500 "Ralat Pelayan" (both levels).
- 404 "Halaman Tidak Dijumpai" for an unknown level (S2, S3) and an unknown question id (S7).
- S5 bulk bar ("1 dipilih", "20 dipilih"); S6 Bahagian A / B / C variants, domain reset, 6-option maximum, 2-option minimum; S7 A / B / C records, option added; S8 grant form open, and closed then reopened with its value kept.

## 2. Not in the narrative discovery

`node tools/diff-narrative.js inventory/M07 docs/discovery/M07-pksk.md` reports **0 candidates on all 8 screens**. The not-in-narrative list is **empty**.

Appendix B of the narrative holds the remaining exact DOM strings (generated by `tools/jobs/M07-appendix.js`). Appendix A holds the enumerations: the 15 domains with codes, icons and colours, question counts per domain and level, and all select options.

Items that only the scripted captures and probes surfaced, all now in the narrative:
1. Create form, Bahagian C: the options card is hidden, but its `required` inputs keep the form invalid, so the form cannot be saved (D-5).
2. Create form: a Bahagian change resets the domain select display, but Alpine `domainId` keeps the stale id (D-8). No other field resets.
3. Edit page: the header subtitle prints raw Blade `<?php echo e($question->id); ?>` (D-2). Edit has no Bahagian select, has a Status select, and bakes "Betul" visibility into the page from the saved Bahagian.
4. Student domain icons lack `fas` and render blank (D-3). The hub h1 renders slate-800 on the purple gradient (D-4).
5. Stat cards are global, not filtered. Pagers keep the filters. Select-all takes the 20 visible ids only.
6. The grant form keeps its input after it is toggled closed. The package select has no empty option. There is no user picker (raw numeric User ID).
7. PKSK questions are in the M04 `questions` store (`/admin/questions/{id}` shows them) but are excluded from the M04 list.

## 3. New routes found by the crawl

327 unique URLs in `_crawl.json`: 134 M07, 186 in other modules via the shells, and 7 unknown (all shell or global: `/`, `/latih-tubi` from the 404 page, `/api/tournament/active`, `/chatbot/*`, `/fcm/token`).

Not yet in the TRACKER M07 checklist:

| URL | Kind | Found on | Note |
|---|---|---|---|
| `/pksk/level/{T1\|T4}` | screen | S1 | S2 "Dashboard PKSK - {L}"; other levels → 404 |
| `/pksk/level/{L}/domains` | screen | S2 | S3 "Domain PKSK - {L}" |
| `/pksk/level/{L}/history` | screen | S2 | S4; **HTTP 500 on live** |
| `/pksk/level/{L}/exam` | session start | S2 | "Peperiksaan Penuh"; **not opened** |
| `/pksk/level/{L}/domain/{CODE}` (15 codes, PKSK_*) | session start | S2, S3 | "Latih Sekarang"; **not opened** |
| `/admin/pksk/questions/create` | screen | S5 | S6 |
| `/admin/pksk/questions/{id}/edit` | screen | S5 | S7; unknown id → 404 |
| `POST /admin/pksk/questions` | form | S6 | store (not submitted) |
| `PUT` / `DELETE /admin/pksk/questions/{id}` | form | S5, S7 | GET → 405 (no show page) |
| `POST /admin/pksk/questions/bulk` | form | S5 | `action` approve / reject / delete, `ids[]` |
| `POST /admin/pksk/access/grant` | form | S8 | `user_id`, `pksk_package_id`, `expires_at` |
| `POST /admin/pksk/access/revoke` | form | S8 | `access_id` |

Probed and absent: `/admin/pksk`, `/admin/pksk/packages` and `/admin/pksk/domains` return 404. `/pricing` (M19) has no PKSK package. No JSON endpoint is used by M07 pages.

## 4. Read-only limits

Not observable without a student account or a submit (narrative §9 L-1…L-8):
- the locked or no-access student view and gate;
- domain practice and the full exam;
- history (500);
- save, bulk and grant/revoke results and messages;
- pending/rejected pills, and expired/revoked access rows.
