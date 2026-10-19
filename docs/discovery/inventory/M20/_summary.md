# M20 — Element inventory & link crawl: summary

- **Captured:** 2026-09-27 (04:14–05:20 MYT) from live https://prestasiplus.my, read-only, admin session on browser lane 1 (`playwright`). Credentials are not stored.
- **Method:** the standard pipeline: `tools/inventory.js` → `tools/run-state.js` → `tools/split-batch.js` → `tools/merge-inventory.js` → `tools/diff-narrative.js`. **No shared tool was modified.**
  - **Write guard:** `tools/jobs/M20-guard.js`, installed before any capture. It aborts:
    - every non-GET / HEAD / OPTIONS request except `POST /login`;
    - every payment-gateway host and every download / export navigation;
    - every write-shaped GET (cart / buy / checkout / pay / toggle / delete / ban / approve …, and the product contact redirect `/marketplace/{slug}/whatsapp`).

    Probes: `POST` and `DELETE /__m20_probe`, `GET /marketplace/__m20_probe/checkout` and `GET /marketplace/__m20_probe/whatsapp` were all blocked. Blocked during the whole run: 11 probe requests and 261 Cloudflare RUM beacons (`POST /cdn-cgi/rum`). No application write was attempted.
  - **View-counter cache (same file):** every server GET of `/marketplace/{slug}` adds a live view (found during the crawl). Afterwards, product and shop pages were served from an in-memory cache after their first GET. Discovery added **6 views** in total (#1 +3, #7 +2, #5 +1). The ledger is in the snapshot `viewCounterLedger` and narrative §5.4; seeds use the pre-run values.
  - **Capture plan:** `tools/jobs/M20.js`, 70 UI states over 12 screens in groups A–L.
  - **Screen map:** `tools/jobs/M20.screens.json`. Classification rules:
    - M20: `/admin/marketplace*`, `/marketplace*` (incl. `/{slug}/whatsapp`), `/seller/*`, `/seller`, `/penjual*`;
    - M15: `/admin/hadiah`, `/gamification/rewards`;
    - M19: `/admin/payments`, `/pricing`.
  - **Crawl:** `tools/jobs/M20-crawl.js` (structure only; 57 URLs incl. 34 probes); supplement `tools/jobs/M20-crawl-post.js`.
  - **Seed snapshot:** `tools/jobs/M20-snapshot.js` → `_snapshot-2026-09-27.json` (includes the layout measurements and the view ledger).
  - **Responsive measurements:** `tools/jobs/M20-measure.js` (12 routes × 375 / 768 / 1280).
  - **Masked screenshots:** `tools/shoot.js` with `tools/jobs/M20.shots.js` (43 PNGs in `docs/discovery/img/M20/`).
- **Privacy:**
  - The only seller is the platform's own shop "JomBelajar Official", owned by the admin account. Its contact e-mail, phone and WhatsApp number (S4, S5, S9) are the only personal-type data.
  - Each job ends with `M20MASK`: it tags e-mail leaves, phone-shaped leaves / tokens (10–12 digits, 01X / 601X) and contact / bank / identity label values, and rewrites wa.me / tel / mailto links to `60XXXXXXXXX`. Then `tools/sanitize.js` runs with `{selectors:['.m20n'], titleName:false}`.
  - `piiLeakCheck` = **0 leaks in all 70 states**. A scripted scan of every M20 inventory file, the crawl and the snapshot finds no phone digits and no e-mail. The screenshots were checked by eye (S4, S5, S9 show `<masked>` / `<phone>`).
  - The first phone pattern (7–10 digits after `01X`) missed 10-digit numbers. It was widened before the snapshot and the screenshots were produced. The inventory was not affected, because `inventory.js` replaces digit runs itself (`<digits:n>`).
  - **Over-masking (not personal data):** `sanitize.js` blanks the product-name input `name` and the "Nama:" value. So S3 / S12 record the name input as `valueType: empty` and the header subtitle as `<name>` (really the product name), and S9 shows the shop name as `<name>`. The real values are in the snapshot.
  - The unmasked scratch dumps (`.playwright-mcp/m20-disc/`) were deleted at the end of the run.
- **Files:** `S1-admin-products.json` … `S12-seller-product-edit.json`, layout chrome `SHA-admin-shell.json` (S1–S5) and `SHU-user-shell.json` (S6–S12), `_crawl.json`, `_snapshot-2026-09-27.json`; raw captures `../_raw/M20/*.json` (70).
- **Status legend:** as M01–M19; `normalizeIds` on. Long lists are sampled with `opts.repeat`: S1 / S4 / S10 row cards and the S6 / S8 grids keep 3 samples each (totals in `meta.repeats`). Full row data is in the snapshot.

## 1. Per-screen counts

M20 content totals **691 elements** over 12 screens and **70** captured states (1280 / 768 / 375). The shells add 212 (SHA) and 383 (SHU) chrome elements, which are not M20 content.

| Screen (route) | Total | Visible default | Conditional | Hidden only | States | States captured |
|---|---|---|---|---|---|---|
| S1-admin-products `/admin/marketplace/products` | 81 | 52 | 20 | 9 | 11 | default, q-match, q-none, cat-2, cat-6, status-{active, draft, rejected}, page-2 (@1280); default @375/@768 |
| S2-admin-product-create `/admin/marketplace/products/create` | 58 | 49 | 0 | 9 | 3 | default @1280/@375/@768 |
| S3-admin-product-edit `/admin/marketplace/products/{id}/edit` | 100 | 59 | 14 | 27 | 8 | #1 (default), #3 used-cod, #5 digital-free, #9 pickup, not-found 404, show-405 (@1280); default @375/@768 |
| S4-admin-sellers `/admin/marketplace/sellers` | 29 | 24 | 4 | 1 | 7 | default, status-{pending, active, suspended, banned} (@1280); default @375/@768 |
| S5-admin-seller-show `/admin/marketplace/sellers/{id}` | 70 | 62 | 7 | 1 | 4 | #1 (default), not-found (@1280); default @375/@768 |
| S6-marketplace `/marketplace` | 49 | 26 | 20 | 3 | 9 | default, cat-buku, cat-lain, cond-used, sort-price-low, sort-popular, q-none (@1280); default @375/@768 |
| S7-product `/marketplace/{slug}` | 72 | 33 | 36 | 3 | 7 | #1 (default), thumb-2, #7 used, #5 no-discount, not-found (@1280); default @375/@768 |
| S8-shop `/marketplace/penjual/{id}` | 27 | 17 | 7 | 3 | 4 | #1 (default), not-found (@1280); default @375/@768 |
| S9-seller-dashboard `/seller/dashboard` | 66 | 63 | 0 | 3 | 4 | default, daftar-redirect (@1280); default @375/@768 |
| S10-seller-products `/seller/produk` | 46 | 32 | 5 | 9 | 4 | default, page-2 empty (@1280); default @375/@768 |
| S11-seller-product-create `/seller/produk/tambah` | 39 | 31 | 0 | 8 | 3 | default @1280/@375/@768 |
| S12-seller-product-edit `/seller/produk/{id}/edit` | 54 | 34 | 11 | 9 | 6 | #1 (default), #7 used, not-found, show-405 (@1280); default @375/@768 |
| SHA-admin-shell (chrome of S1–S5) | 212 | 77 | 23 | 112 | 30 | all SHA states |
| SHU-user-shell (chrome of S6–S12) | 383 | 152 | 26 | 205 | 33 | all SHU states |

- The "hidden only" elements are the visually hidden radio inputs of the tile pickers (condition, stock, status, shipping), the `_token` / `_method` fields and the hidden tournament banner.

**Horizontal page overflow:** none on any screen at 375 / 768 / 1280 (inventory flag + direct measurement). No text is below 12 px.

**Empty / error states captured:**
- S1 "Tiada Produk" (5 variants), S4 "Tiada penjual dijumpai" (3), S6 "Tiada Produk Dijumpai", S10 "Belum Ada Produk";
- 404 "Halaman Tidak Dijumpai" (S3, S5, S7, S8, S12);
- Symfony 405 (S3, S12).

## 2. Link crawl (`_crawl.json`)

403 URLs classified; **153 are M20**:
- S1 row links (edit, view, toggle, delete forms for ids 1–10) and image-delete forms;
- seller links, the ban forms and S6 category chips;
- the 10 product slugs, their `/whatsapp` redirects (never opened) and the seller-portal links and forms;
- 34 guessed routes (404 / 405 / 302).

The rest are shell links classified to their owning modules (M01–M26). Unknown (1): `/` (link of the global 404 page).

**New routes (not in TRACKER before this run):**
- pages: `/admin/marketplace/products/create`, `/admin/marketplace/products/{id}/edit`, `/admin/marketplace/sellers/{id}`, `/marketplace/{slug}`, `/marketplace/penjual/{id}`, `/seller/dashboard`, `/seller/produk`, `/seller/produk/tambah`, `/seller/produk/{id}/edit`;
- redirect: `/seller/daftar` (302 → dashboard for an existing seller);
- write endpoints (never submitted):
  - `POST /admin/marketplace/products`, `PUT` / `DELETE /admin/marketplace/products/{id}`;
  - `POST /admin/marketplace/products/{id}/toggle`, `DELETE /admin/marketplace/products/image/{id}`;
  - `POST /admin/marketplace/sellers/{id}/ban`;
  - `POST /seller/produk`, `PUT` / `DELETE /seller/produk/{id}`;
- click-counting redirect (never opened): `GET /marketplace/{slug}/whatsapp`.

**Probed:**
- 404:
  - `/admin/marketplace`, `/admin/marketplace/{orders, categories, reviews}`, `/admin/marketplace/sellers/create`, `/admin/marketplace/sellers/1/edit`, `/admin/marketplace/products/999999/edit`, `/admin/marketplace/sellers/999999`;
  - `/marketplace/{jual, daftar-penjual, saya, produk-saya, pesanan, orders, cart, create, sell}`, `/marketplace/penjual/daftar`, `/marketplace/seller/register`, `/marketplace/penjual/999999`, `/marketplace/tiada-produk-zzqxv`;
  - `/seller`, `/seller/{register, profil, profile, kedai, tetapan, pesanan, orders, ulasan, dokumen}`, `/seller/produk/999999/edit`, `/penjual`, `/penjual/{dashboard, produk}`.
- 405: `GET /admin/marketplace/products/1`, `GET /seller/produk/1`.
- 200 fall-backs: `?page=2` on S1 (empty, "10 produk dijumpai"), S6 and S10 (empty).

**Owned elsewhere:**
- `/admin/hadiah`, `/gamification/rewards` "Kedai Hadiah" → M15;
- wallet chips and `/gamification*` → M14;
- `/admin/payments`, `/pricing` → M19.

The marketplace has no cart, order or payment route.

## 3. Reconciliation

`node tools/diff-narrative.js inventory/M20 M20-marketplace.md` → **0 candidates on every screen** (S1–S12).

## 4. Read-only limits (not revealed)

- Seller registration form (`/seller/daftar` redirects for the admin) and pending-seller admin actions.
- The WhatsApp redirect target and message.
- Flash messages after save / delete / toggle / ban; draft / rejected / out-of-stock / inactive product states.
- Review submission and a product with reviews; role gating for non-admin users.
- Pagination size (only 10 products).

See narrative §9.
