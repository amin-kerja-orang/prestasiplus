# M19 — Element inventory & link crawl: summary

- **Captured:** 2026-09-27 (04:14–05:10 MYT) from live https://prestasiplus.my, read-only, admin session on browser lane 1 (`playwright`). Credentials are not stored.
- **Method:** the standard pipeline: `tools/inventory.js` → `tools/run-state.js` → `tools/split-batch.js` → `tools/merge-inventory.js` → `tools/diff-narrative.js`. **No shared tool was modified.**
  - Write guard: `tools/jobs/M19-guard.js`, installed before any capture. It aborts every non-GET / HEAD / OPTIONS request except `POST /login`, every payment-gateway host and every download / export navigation. Probe: `POST` and `DELETE /__m19_probe` were blocked. Blocked during the whole run: the 2 probes and 209 Cloudflare RUM beacons (`POST /cdn-cgi/rum`). No application write was attempted.
  - Capture plan: `tools/jobs/M19.js`, 54 UI states over 7 screens in groups A–G.
  - Screen map: `tools/jobs/M19.screens.json` (classification rules: `/admin/payments*`, `/admin/billing`, `/admin/dunning`, `/subscribe/*`, `/billing/*`, guessed 404 finance routes → M19; `/admin/school-subscriptions*`, `/admin/api/schools/*`, `/admin/users/{id}/packages` → M02; `/admin/gamifikasi/guru/tunai`, `/guru/gamifikasi/tebus-tunai`, `/admin/gamification/transactions` → M14; `/admin/hadiah` → M15).
  - Crawl: `tools/jobs/M19-crawl.js` (structure only; table bodies never returned) — 32 URLs incl. 18 probes; supplement `tools/jobs/M19-crawl-post.js`.
  - Page probe for detail pages: `tools/jobs/M19-probe.js` (masked leaves only).
  - Seed snapshot: `tools/jobs/M19-snapshot.js` → `_snapshot-2026-09-27.json` (includes the layout measurements).
  - Responsive measurements: `tools/jobs/M19-measure.js` (7 routes × 375 / 768 / 1280).
  - Masked screenshots: `tools/shoot.js` with `tools/jobs/M19.shots.js` (28 PNGs in `docs/discovery/img/M19/`).
- **Privacy:**
  - Payers (students / parents: name + e-mail) appear on S1, S2, S3 and S4; bill codes and gateway bill codes on S2; a WhatsApp business number on S6.
  - Each job ends with `M19MASK` (tags e-mail leaves, BIN / BINTI names, "Pelajar" / "Pengguna" cells, person-label values and reference-shaped tokens on admin pages; rewrites the WhatsApp number to `60XXXXXXXXX`), then `tools/sanitize.js` (admin: `{selectors:['.m19n'], localSelectors:['.m19r'], titleName:false, cols:'^(pelajar|pengguna|pembayar)$', labels:'pelajar|pengguna|pembayar|nama pelajar'}`; user pages: `{selectors:['.m19n'], titleName:false}` — the first run of S6 masked the package copy "Langganan Bulanan" because "Pelajar" is a package name there; S6 / S7 were re-captured with the user-page options and the admin-only rule).
  - `piiLeakCheck` = **0 leaks in all 54 states**.
  - The snapshot never returns a payer (`<payer:n>` tokens, e-mail domain class) or a bill code / gateway reference (presence flags).
  - A scripted check compared every M19 file (76 text files: inventory, raw captures, jobs, snapshot, narrative, TRACKER) against the 67 payer strings and bill codes and the 99 name words read live: **0 hits**. The unmasked scratch dumps (`.playwright-mcp/m19-disc/`) were deleted at the end of the run.
  - School names appear only in the M02 cross-check (observed public anchors).
- **Files:** `S1-payments.json` … `S7-invoices.json`, layout chrome `SHA-admin-shell.json` (S1–S5) and `SHU-user-shell.json` (S6, S7), `_crawl.json`, `_snapshot-2026-09-27.json`; raw captures `../_raw/M19/*.json` (54).
- **Status legend:** as M01–M18; `normalizeIds` on. Long lists sampled with `opts.repeat` (S1, S4, S5 table rows: 3 samples each; totals in `meta.repeats`). Full row data is in the snapshot.

## 1. Per-screen counts

M19 content totals **395 elements** over 7 screens and **54** captured states (1280 / 768 / 375). The shells add 214 (SHA) and 374 (SHU) chrome elements, which are not M19 content.

| Screen (route) | Total | Visible default | Conditional | Hidden only | Mobile only | Desktop only | States | States captured |
|---|---|---|---|---|---|---|---|---|
| S1-payments `/admin/payments` | 102 | 54 | 16 | 32 | 2 | 8 | 18 | default, page-2, page-3, page-empty, status-{paid, pending, failed}, type-{regular, personal, pksk}, gateway-bizappay, search-none, paid-personal, tick-one, tick-all (@1280); default, tick-one @375; default @768 |
| S2-payment-show `/admin/payments/{id}` | 50 | 27 | 21 | 2 | 0 | 0 | 7 | #65 paid (default), #64 pending, #25 onetime paid, not-found 404, create → 500 (@1280); default @375/@768 |
| S3-payment-edit `/admin/payments/{id}/edit` | 35 | 20 | 10 | 5 | 0 | 0 | 5 | #65 (default), #64 pending, not-found 404 (@1280); default @375/@768 |
| S4-billing `/admin/billing` | 35 | 35 | 0 | 0 | 0 | 0 | 4 | default, query-ignored (@1280); default @375/@768 |
| S5-dunning `/admin/dunning` | 32 | 22 | 8 | 2 | 0 | 0 | 8 | default, type-school, type-individual, event-7d, event-expired (empty), page-2 (empty) (@1280); default @375/@768 |
| S6-pricing `/pricing` | 128 | 114 | 5 | 9 | 0 | 0 | 9 | default, faq-0 … faq-4 (@1280); default, faq-0 @375; default @768 |
| S7-invoices `/billing/invoices` | 13 | 10 | 0 | 3 | 0 | 0 | 3 | empty (default) @1280/@375/@768 |
| SHA-admin-shell (chrome of S1–S5) | 214 | 78 | 23 | 113 | 7 | 73 | 39 | all SHA states |
| SHU-user-shell (chrome of S6, S7) | 374 | 152 | 17 | 205 | 15 | 148 | 12 | all SHU states |

- S1 "hidden-only" 32: the hidden `_token` / `_method` / `ids[]` fields of the per-row delete forms and the bulk-delete form, and the selection bar texts.
- S3 hidden-only 5: the 3 status radios are visually hidden inside their labelled tiles, plus `_token`, `_method`.
- S6 hidden-only 9: the shell tournament banner ("LIVE:", "MAIN", "DAFTAR"), hidden form fields.

**Horizontal page overflow:** none on any screen at 375 / 768 / 1280 (inventory flag + direct measurement). Wide tables (S1 896 px, S4 705 px, S5 388 px, S6 394 px) scroll inside their card (`overflow-x: auto`).

**Empty / error states captured:** S1 "Tiada Pembayaran" (5 variants), S5 "📭 Tiada log dunning dijumpai." (+ pager "Showing 0 of 21 results"), S7 "Tiada Invois Dijumpai"; 404 "Halaman Tidak Dijumpai" (S2, S3); 500 "Ralat Pelayan" (`/admin/payments/create`). The 405 Symfony page of `GET /subscribe/*` is recorded in the crawl only.

## 2. Link crawl (`_crawl.json`)

379 URLs classified; **168 are M19**: S1 pagination and filter links, row show / edit links (ids 7–65), delete forms, `bulk-delete`, S4 "Lihat Semua", S5 filter / pager links, S6 forms `/subscribe/regular` and `/subscribe/personal`, S7 links, the export `/admin/export/payments` (never opened), and 11 guessed finance routes that return 404. The rest are shell links classified to their owning modules (M01–M26). Unknown (1): `/` (link of the global 404 page).

**New routes (not in TRACKER before this run):** `/admin/payments/{id}`, `/admin/payments/{id}/edit`; write endpoints (never submitted) `DELETE /admin/payments/{id}`, `PUT /admin/payments/{id}`, `POST /admin/payments/bulk-delete`, `POST /subscribe/regular`, `POST /subscribe/personal`.

**Probed:** 404 — `/admin/payments/99999999`, `/admin/payments/99999999/edit`, `/admin/subscriptions`, `/admin/individual-subscriptions`, `/admin/invoices`, `/admin/packages`, `/admin/pricing`, `/billing`, `/billing/invoices/1`, `/subscribe`, `/subscription`, `/langganan`, `/pakej`, `/guru/invois`; 500 — `/admin/payments/create`; 405 — `GET /subscribe/regular`, `GET /subscribe/personal`; 200 fall-backs — `/admin/payments?page=99` (empty state), `/admin/payments?status=bogus` (empty state), `/admin/billing?month=2026-08` (ignored), `/admin/dunning?page=2` (empty).

**Owned elsewhere:** `/admin/school-subscriptions*` → M02 (read once for the cross-check; seed conflicts in narrative §5.3); `/admin/gamifikasi/guru/tunai`, `/guru/gamifikasi/tebus-tunai`, `/admin/gamification/transactions` → M14; `/admin/hadiah?cat=ewallet` → M15; `/admin/export/payments` link sits on M17 S1.

## 3. Reconciliation

`node tools/diff-narrative.js inventory/M19 M19-finance.md` → **0 candidates on every screen** (S1–S7).

## 4. Read-only limits (not revealed)

Checkout / gateway pages and callbacks; flash messages after save / delete / bulk delete; S7 with invoices and the invoice PDF; S6 as a subscribed student, parent or teacher; the "Gagal" badge and failed banner (0 failed payments); grace-period events; the rule behind "Langganan Individu Aktif 94". See narrative §9.
