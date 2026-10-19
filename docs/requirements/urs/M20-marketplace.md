# M20 — Marketplace: admin products and sellers, buyer marketplace, product page, public shop, seller portal — User Requirements Specification

## 0. Document control

| Field | Value |
|---|---|
| Document | URS — M20 Marketplace (admin product list, create and edit; admin seller list and seller review; buyer marketplace, product page and public shop; seller dashboard, seller product list, create and edit; WhatsApp contact redirect; seller registration) |
| Version | 1.2 |
| Date | 2026-09-27 |
| Status | **Approved (G1) — v1.2.** Audit round 2 passed; G1 approved by the user on 2026-09-27 with three decisions: seller registration minimum (PROPOSED, approved), seller menu link "Kedai Saya" (user-approved new scope, DV-M20-06), product photos copied read-only (OQ-M20-11 resolved). The remaining unobservable items stay INFERRED or PROPOSED as listed in §9 OQ-M20-12. |
| Author | product-analyst (agent). §3 Function catalogue, §6 coverage matrix and §7.1 count reconciliation were compiled from the inventory JSON and the seed snapshot by hand (no script runtime in the writer's session); the check scripts `coverage.cjs` and `trace.cjs` are in the writer's scratchpad `m20-writer/` for the Delivery Lead / auditor to run |
| Source discovery | [M20-marketplace.md](../../discovery/M20-marketplace.md) (§1–§9, figures §5.1, seed §5.2, conflicts C1–C5 §5.3, view ledger §5.4, defects D-M20-01…08 §8.2, OQ-M20-01…08 §9, Appendices A–B); inventory [`inventory/M20/`](../../discovery/inventory/M20/) (`S1…S12-*.json`, **691** content elements, 70 captured states; `SHA-admin-shell.json` 212, `SHU-user-shell.json` 383; `_crawl.json`; `_summary.md`; seed snapshot `_snapshot-2026-09-27.json` captured **2026-09-27 05:01 MYT**); 43 masked screenshots `docs/discovery/img/M20/` |
| Companion SRS | [srs/M20-marketplace.md](../srs/M20-marketplace.md) |
| Related | M01 v1.12 (User base, guest redirect, landing pages, global 404, canonical accounts 1–11: account 1 = `admin@demo.test` "Admin Demo"), **M02 v1.23** (users dataset and contract; M20 reads `name`, `email`, `role`), M14 v1.7 (coin / mata / streak chips — not marketplace money), M15 v1.4 (Kedai Hadiah, coin rewards shop — a different shop), M16 (tournament banner in the user shell), M19 v1.3 (payments and `/pricing` — the marketplace has no payment; DV-M19-07, DV-M19-09), global shells ([design/shells.md](../../design/shells.md)), [design/design-system.md](../../design/design-system.md) v1.8 §6 (icon rows, including the eight M20 rows) |

**Change log**

| Version | Date | Change |
|---|---|---|
| 1.0 | 2026-09-27 | First issue under D7 (fidelity), D8 (proven completeness), D9 / D10 (deviation rule, accessibility), D11 (every count from a named query over M20's own stores), D12 (M20 owns products, images, categories, sellers, seller documents, reviews and the view / WhatsApp-click counters; users are read through M01 / M02) and the privacy rule (fictitious seller phone and WhatsApp number; the owner is canonical account 1). **691/691** content elements covered (670 mapped, 21 excluded with reason), 0 unmapped; the 595 shell elements are excluded as global-shell chrome, with the 35 of them that render an M20 menu entry or header title specified by FN-M20-1.1.1–1.1.3. Views seeded with the **pre-discovery** values (Σ 111, discovery §5.4). 13 deviation decisions (§7). User decision **D14** applied: the WhatsApp contact renders no external screen; the click is recorded and the outcome simulated with a plain `wa.me` link (DV-M20-13). |
| 1.1 | 2026-09-27 | Audit round 1 (FAIL, 2 Major) fixed with the Delivery Lead decisions (replicate live): **AUD-M20-01 / 07** — the create forms preselect "🆕 Baru", "✅ Ada" and (S2) "Ambil Sendiri" and the tile radios carry no `required` (only name, category and price are required): FN-M20-2.2.4, 2.2.5, 5.4.2, 5.4.4 relabelled OBSERVED; AC-M20-08.1 / 08.2 / 22.1 / 22.3 rewritten. **AUD-M20-02** — "Hubungi Penjual di WhatsApp" opens in a new tab (`target="_blank"`, OBSERVED): the D14 hand-off runs in the new tab and S7 stays open (FN-M20-4.2.4, 4.2.5, AC-M20-16.1, 17.1, 17.2, DV-M20-13, matrix S7-026 / 045 / 069). **AUD-M20-03 / 04** — no `rel` attribute (as live, D10); S9 "Lihat Kedai Saya" and the S5 `wa.me` link open in a new tab (FN-M20-3.2.2, 5.2.2, AC-M20-13.1, 20.2, matrix S5-011, S9-018). **AUD-M20-05** — citations M01 v1.12, M02 v1.23, M14 v1.7, M15 v1.4, M19 v1.3, design-system v1.8. **AUD-M20-08** — DV order. **AUD-M20-11** — FN-M20-1.1.2 icon colour stated per menu. Counts unchanged: 95 FN, 25 US, 92 AC; coverage 691/691. |
| 1.2 | 2026-09-27 | **G1 approved by user 2026-09-27 with decisions: seller registration minimum, seller menu link (new scope), product photos copied read-only.** (1) FN-M20-5.1.2, 5.1.3 and 3.1.6 stay PROPOSED and are marked approved (OQ-M20-01, 04). (2) New **FN-M20-1.1.6** "Kedai Saya" (`fa-store`, PROPOSED label) → `/seller/dashboard` for users who own a Seller, in the user-shell account menu and mobile drawer; FN-M20-1.1.2 and AC-M20-01.4 now apply to non-sellers; new AC-M20-01.6; **DV-M20-06** rewritten from "replicate live" to the user decision (live has no link); OQ-M20-09 resolved. (3) OQ-M20-11 resolved: the 45 product photos are copied once, read-only, into `public/images/marketplace/products/…`. (4) Audit round 2 R2-01: "no `rel`" on the S7 WhatsApp button and S9 "Lihat Kedai Saya" relabelled INFERRED, to be confirmed at G5 (FN-M20-4.2.4, 5.2.2, AC-M20-16.1, 20.2). Counts: 96 FN, 25 US, 93 AC; coverage 691/691 (the new link is not a live element). |
| 1.2 (note) | 2026-09-27 | Script fix, no content change: the v1.2 row above no longer writes AC-M20-01.6 in bold, which `trace.cjs` counted as a second definition. AC-M20-01.6 is defined once, in §4 (93 ACs). |

**Conventions** (as M01–M19)
- Quoted UI copy is the exact live text. English or mixed words that live shows ("Active", "Verified", "(0 reviews)", "Pending", "Stationery", "Cash on Delivery (COD)", "Ambil Sendiri (Pickup)", "COD", "E-Book", "Popular", "Dashboard") are live copy and are kept (D-M20-08, DV-M20-08).
- **OBSERVED** = seen on live with the admin account (walk-through, inventory state, snapshot, screenshot). **SOURCE-DERIVED** = read from page markup captured read-only while the state never rendered (form actions, `confirm()` texts). **INFERRED** = the most likely live behaviour, not observed; no new UX is invented. **PROPOSED** / **PROPOSED COPY** = a value, layout or text written for the rebuild where live gives nothing; listed in §9 OQ-M20-12 for the Delivery Lead to report at G1.
- **D-M20-n** = live defect of discovery §8.2; **DV-M20-nn** = fidelity deviation (§7), anything not listed there must match live; **SEC-M20-nn** = security / privacy item (SRS §11.1); **XR-M20-nn** = request to another owner (SRS §6.12); **C1–C5** = discovery cross-module conflicts (§5.3).
- **Personal data (privacy overrides fidelity):** the only seller on live is the platform's shop **"JomBelajar Official"** (a brand shop name, not a person; kept). Its owner is the admin account; in the rebuild the owner is canonical account 1 `admin@demo.test`, whose seed name is **"Admin Demo"** (M01; M09 precedent), so every place live shows the owner name "Admin PRESTASI+" shows "Admin Demo" (DV-M20-10). The seller's telephone and WhatsApp number are replaced by the fictitious **`0100000000`** and **`60100000000`** (DV-M20-09). No real name, e-mail or phone number is written anywhere.
- "Admin" = `admin@demo.test` (canonical 1, owner of seller #1). "Pelajar" = `pelajar@demo.test` (canonical 2, not a seller). **Clock:** the single project clock **2026-09-25T15:40:00+08:00**. Every time-dependent figure is computed at that clock; the 2026-09-27 readings of discovery are the observed record. The only figures that differ between the two instants are the six product views added by the discovery itself (#1 +3, #5 +1, #7 +2); the seed uses the values **before** discovery (§7.1).

---

## 1. Overview

M20 is the school-supplies marketplace of PRESTASIPLUS. Buyers browse a catalogue of products (search, category chips, condition, four sort orders), open a product page (gallery, price and discount, description, view count, stock, shipping, seller card, reviews, related products) and **contact the seller on WhatsApp** — there is no cart, order, checkout or online payment (C5). Sellers own a shop with a public page and manage their products in a seller portal. Administrators feed and moderate products (as the platform or on behalf of a seller) and review, verify and ban sellers.

The TRACKER listed 3 M20 routes; the crawl found **12 screens** (9 new routes), 8 write endpoints (never submitted on live), 1 click-counting redirect (never opened) and 1 redirect for an existing seller.

**Routes covered**

| # | Route | Tab title (exact live) | Shell header (title / subtitle) | Admin outcome (observed) |
|---|---|---|---|---|
| S1 | `/admin/marketplace/products` (`?q=&category=&status=&page=`) | "Urus Produk - Admin PRESTASIPLUS" | SHA "Marketplace - Produk" / "Urus semua produk marketplace" | 200 |
| S2 | `/admin/marketplace/products/create` (new) | "Tambah Produk - Admin PRESTASIPLUS" | SHA "Tambah Produk Marketplace" / "Admin feed produk ke marketplace" | 200 |
| S3 | `/admin/marketplace/products/{id}/edit` (new) | "Edit Produk - Admin PRESTASIPLUS" | SHA "Edit Produk" / {product name} | 200; unknown id 404; `GET /admin/marketplace/products/{id}` 405 (→ 404, DV-M20-02) |
| S4 | `/admin/marketplace/sellers` (`?status=`) | "Urus Penjual - Admin PRESTASIPLUS" | SHA "Marketplace - Penjual" / "Urus dan sahkan penjual" | 200 |
| S5 | `/admin/marketplace/sellers/{id}` (new) | "Semak Penjual - {shop name}" | SHA "Semak Penjual" / {shop name} | 200; unknown id 404 |
| S6 | `/marketplace` (`?q=&category=&condition=&sort=&page=`) | "Marketplace - PRESTASIPLUS" | SHU "Marketplace" / "Peralatan sekolah untuk pelajar 🛒" | 200 |
| S7 | `/marketplace/{slug}` (new) | "{product name} - Marketplace PRESTASIPLUS" | SHU "Marketplace" / {category name} | 200; unknown slug 404 |
| S8 | `/marketplace/penjual/{id}` (new) | "{shop name} - Marketplace PRESTASIPLUS" | SHU "Kedai Penjual" / {shop name} | 200; unknown id 404 |
| S9 | `/seller/dashboard` (new) | "Kedai Saya - PRESTASIPLUS Marketplace" | SHU "Dashboard Penjual" / {shop name} | 200 (admin owns seller #1); `/seller/daftar` → 302 here |
| S10 | `/seller/produk` (`?page=`) (new) | "Produk Saya - PRESTASIPLUS Marketplace" | SHU "Produk Saya" / "Urus senarai produk anda" | 200 |
| S11 | `/seller/produk/tambah` (new) | "Tambah Produk - PRESTASIPLUS Marketplace" | SHU "Tambah Produk" / "Senaraikan produk baru di marketplace" | 200 |
| S12 | `/seller/produk/{id}/edit` (new) | "Edit Produk - PRESTASIPLUS Marketplace" | SHU "Edit Produk" / {product name} | 200; unknown id 404; `GET /seller/produk/{id}` 405 (→ 404, DV-M20-02) |

**Write endpoints (never submitted on live; specified from the markup):** `POST /admin/marketplace/products` (S2), `PUT` / `DELETE /admin/marketplace/products/{id}` (S3, S1), `POST /admin/marketplace/products/{id}/toggle` (S1 "Nyahaktif"), `DELETE /admin/marketplace/products/image/{imageId}` (S3 ×), `POST /admin/marketplace/sellers/{id}/ban` (S4, S5), `POST /seller/produk`, `PUT` / `DELETE /seller/produk/{id}` (S11, S12, S10).

**Unopened routes (INFERRED / PROPOSED):** `GET /marketplace/{slug}/whatsapp` — counts a WhatsApp click on the seller and redirects to `wa.me` (INFERRED from the guard evidence; target and message PROPOSED, FN-M20-4.2.5); `/seller/daftar` for a user who is not yet a seller — registration form (PROPOSED, FN-M20-5.1.2).

Probed and not found (global 404, replicated): `/admin/marketplace`, `/admin/marketplace/orders`, `/admin/marketplace/categories`, `/admin/marketplace/reviews`, `/admin/marketplace/sellers/create`, `/admin/marketplace/sellers/1/edit`, `/marketplace/jual`, `/marketplace/daftar-penjual`, `/marketplace/penjual/daftar`, `/marketplace/saya`, `/marketplace/produk-saya`, `/marketplace/pesanan`, `/marketplace/orders`, `/marketplace/cart`, `/marketplace/create`, `/marketplace/sell`, `/marketplace/seller/register`, `/seller`, `/seller/register`, `/seller/profil`, `/seller/profile`, `/seller/kedai`, `/seller/tetapan`, `/seller/pesanan`, `/seller/orders`, `/seller/ulasan`, `/seller/dokumen`, `/penjual`, `/penjual/dashboard`, `/penjual/produk`.

**Cross-module ownership.** M20 owns (D12) the stores **MarketplaceCategory**, **MarketplaceProduct**, **ProductImage**, **Seller**, **SellerDocument** and **ProductReview**, and the **view** (per product) and **WhatsApp-click** (per seller) counters. Users (the seller's owner name and e-mail, roles) are M01 / M02's and are read through their contract. **Kedai Hadiah** (`/admin/hadiah`, `/gamification/rewards`) is the M15 coin rewards shop, not the marketplace. The header coin / mata / streak chips are M14. Payments and `/pricing` are M19; the marketplace creates no payment.

---

## 2. Actors

| Role | Involvement in M20 | Verified |
|---|---|---|
| Admin | S1–S5 (products and sellers administration, including feeding products as the platform or for a seller, moderation, toggle, delete, image delete, ban); S6–S8 as a buyer; S9–S12 as the owner of seller #1; admin-panel sidebar group and user-menu admin entries | OBSERVED |
| Pelajar (student) | S6–S8 as a buyer; the user-shell menu entry "Marketplace" (live student sidebar, as built in the F-19 user shell); may register as a seller (S9–S12 once a seller) | Menu OBSERVED (live student sidebar); pages INFERRED (no student account on lane 1; OQ-M20-06) |
| Seller | Any signed-in user who owns a Seller record: S9–S12 for their own shop and products; public shop S8 | Admin as seller OBSERVED; other sellers INFERRED |
| Guru, Ibu Bapa, Admin Sekolah, Pegawai PPD / JPN, Penaja | No "Marketplace" menu entry on live (teacher and school-admin sidebars); S6–S8 reachable by URL like any signed-in user | INFERRED (OQ-M20-06) |
| System (mock) | View counter on every product-page load; WhatsApp-click counter on the contact redirect | OBSERVED (views) / INFERRED (clicks) |
| Guest | Redirected to `/login` | INFERRED |

---

## 3. Functional breakdown (Epic → Feature → Function)

Compiled from the element inventory. "EL" lists inventory element IDs (prefix `EL-M20-`). Functions with EL "—" are behaviours (access rules, shell entries rendered by the global shell, data rules, unobservable or PROPOSED states) with no content element of their own.

### EP-M20-1 — Navigation, shell, access, error outcomes and shared formats

**FT-M20-1.1 — Menu entries, header titles and tab titles**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M20-1.1.1 | Admin-panel sidebar group toggle **"Marketplace"** (`fa-shopping-bag`, emerald, group key `marketplace`) holding **"Produk"** (`fa-shopping-bag`) → `/admin/marketplace/products` and **"Penjual"** (`fa-store`) → `/admin/marketplace/sellers`; the group opens itself with "Produk" active on S1–S3 and "Penjual" active on S4–S5; the mobile "Lagi" drawer lists the section "Marketplace" with the same two links. Rendered by the global admin shell (SHA-068–070, SHA-180–182, excluded in §6.2 as shell chrome); M20 registers the routes | — | Admin (OBSERVED) | OBSERVED |
| FN-M20-1.1.2 | User-portal shell menu entries (avatar menu and mobile drawer): **"Marketplace"** (`fa-shopping-bag`; emerald in the mobile drawer, no colour class in the account dropdown, as live — the shell owns the styling) → `/marketplace` for the student and the admin (live student and admin sidebars; not in the teacher or school-admin sidebars); in the admin block **"Urus Produk"** (`fa-store`, orange) → S1 and **"Urus Penjual"** (`fa-user-tie`, teal) → S4 (SHU-086, SHU-114, SHU-115, SHU-300, SHU-310, SHU-311, excluded in §6.2). On live no menu of any role links to the seller portal S9–S12. In the rebuild a user **without** a Seller still gets no seller-portal link (it is reached by URL, by `/seller/daftar` and by the in-module links); a user **with** a Seller gets the "Kedai Saya" link of FN-M20-1.1.6 (user decision, DV-M20-06) | — | Student, Admin (OBSERVED); other roles (INFERRED) | OBSERVED + DV-M20-06 |
| FN-M20-1.1.3 | Shell header title / subtitle per screen, correct on live and replicated: S1 **"Marketplace - Produk"** / **"Urus semua produk marketplace"**; S2 **"Tambah Produk Marketplace"** / **"Admin feed produk ke marketplace"**; S3 **"Edit Produk"** / {product name}; S4 **"Marketplace - Penjual"** / **"Urus dan sahkan penjual"**; S5 **"Semak Penjual"** / {shop name}; S6 **"Marketplace"** / **"Peralatan sekolah untuk pelajar 🛒"**; S7 **"Marketplace"** / {category name}; S8 **"Kedai Penjual"** / {shop name}; S9 **"Dashboard Penjual"** / {shop name}; S10 **"Produk Saya"** / **"Urus senarai produk anda"**; S11 **"Tambah Produk"** / **"Senaraikan produk baru di marketplace"**; S12 **"Edit Produk"** / {product name} (SHA-118–119, 199–200, 202–203, 205–206, 209–210; SHU-136–137, 373–383) | — | Every signed-in role (Admin OBSERVED) | OBSERVED |
| FN-M20-1.1.4 | Tab titles (exact live): S1 "Urus Produk - Admin PRESTASIPLUS"; S2 "Tambah Produk - Admin PRESTASIPLUS"; S3 "Edit Produk - Admin PRESTASIPLUS"; S4 "Urus Penjual - Admin PRESTASIPLUS"; S5 "Semak Penjual - {shop name}"; S6 "Marketplace - PRESTASIPLUS"; S7 "{product name} - Marketplace PRESTASIPLUS"; S8 "{shop name} - Marketplace PRESTASIPLUS"; S9 "Kedai Saya - PRESTASIPLUS Marketplace"; S10 "Produk Saya - PRESTASIPLUS Marketplace"; S11 "Tambah Produk - PRESTASIPLUS Marketplace"; S12 "Edit Produk - PRESTASIPLUS Marketplace"; global 404 "404 - Halaman Tidak Dijumpai \| PRESTASIPLUS" (M01) | — | Every signed-in role (Admin OBSERVED) | OBSERVED |
| FN-M20-1.1.5 | Shell by screen: S1–S5 render in the **admin-panel shell** (SHA); S6–S12 in the **user-portal shell** (SHU: coin / mata / streak chips, bell, avatar menu). The hidden M16 tournament banner ("LIVE:", "MAIN", "DAFTAR") that the SHU pages carry inside `<main>` is not M20 content (EL S6–S12 -001–003, excluded in §6.1). The global 404 page is standalone (M01) | — | Every signed-in role (Admin OBSERVED) | OBSERVED |
| FN-M20-1.1.6 | **Seller-portal menu link (user-approved new scope, G1 2026-09-27; not on live):** for a signed-in user who owns a Seller record (any seller status, any role; the admin owns seller #1), the user shell shows **"Kedai Saya"** (`fa-store`, PROPOSED label and icon; design-system v1.8 §6.8 row `fa-store` → `Store`) → `/seller/dashboard`. Placement follows the existing "Marketplace" entry: in the **account (avatar) dropdown** directly below "Marketplace", and in the **mobile drawer** "Gamifikasi" section directly below "Marketplace" (same row style; no colour class in the dropdown, the drawer's row colour as "Marketplace" — PROPOSED). The link is active on S9–S12. A user without a Seller never sees it (they reach `/seller/daftar` by URL, as live); after a successful registration (FN-M20-5.1.3) the link appears on the next menu render. The shell reads seller ownership through M20's contract (XR-M20-02). The admin-panel sidebar is unchanged | — | Seller (any role that owns a Seller) | PROPOSED (user-approved new scope, DV-M20-06) |

**FT-M20-1.2 — Access and error outcomes**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M20-1.2.1 | Every M20 route and API requires a session; a guest is redirected to `/login` by the M01 guard | — | Guest | INFERRED |
| FN-M20-1.2.2 | S1–S5 and their write actions are **admin only**: another signed-in role opening `/admin/marketplace/*` is sent to its M01 landing page; the admin APIs answer `403 FORBIDDEN` | — | Admin (OBSERVED); other roles (INFERRED) | OBSERVED (admin) / INFERRED |
| FN-M20-1.2.3 | S6–S8 open for every signed-in role (INFERRED). S9–S12 open for a user who owns a Seller record (any status); a signed-in user without one who opens `/seller/dashboard`, `/seller/produk`, `/seller/produk/tambah` or `/seller/produk/{id}/edit` is sent to `/seller/daftar` (INFERRED); a seller who opens `/seller/daftar` is sent to `/seller/dashboard` (OBSERVED 302 for the admin) | — | Every signed-in role | OBSERVED (admin) / INFERRED |
| FN-M20-1.2.4 | Global **404** page (M01, standalone): "404", "🔍", h1 **"Halaman Tidak Dijumpai"**, "Maaf, halaman yang anda cari tidak wujud atau telah dipindahkan. Mungkin URL salah taip?", "Halaman Utama" → `/`, "Mula Latihan" (target per M01), "PRESTASIPLUS" — for an unknown id or slug on S3, S5, S7, S8, S12 (OBSERVED `/admin/marketplace/products/999999/edit`, `/admin/marketplace/sellers/999999`, `/marketplace/tiada-produk-zzqxv`, `/marketplace/penjual/999999`, `/seller/produk/999999/edit`) and for every probed route of §1 (OBSERVED 404, replicated) | S3-084–090, S5-064–070, S7-051–057, S8-021–027, S12-044–050 | All | OBSERVED |
| FN-M20-1.2.5 | `GET /admin/marketplace/products/{id}` and `GET /seller/produk/{id}` (reachable only by typing the URL) render the global **404** page instead of the unbranded Symfony page "Oops! An Error Occurred" / "The server returned a "405 Method Not Allowed"." / "Something is broken. …" (DV-M20-02) | S3-098–100, S12-051–053 | All | OBSERVED (live outcome) + DV-M20-02 |

**FT-M20-1.3 — Shared formats, pagination, labels and responsive rules**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M20-1.3.1 | Money: product prices **"RM {n.nn}"** with a space and 2 decimals ("RM 89.90", "RM 45.00", struck "RM 129.90"); the S6 / S7 shipping line uses **"RM{n.nn}"** without a space ("Pos / Kurier (RM8.00)"); discount badge **"-{p}%"** with p = round((original − price) / original × 100) ("-31%", "-63%"), shown only when an original price exists | — | Every signed-in role (Admin OBSERVED) | OBSERVED |
| FN-M20-1.3.2 | Dates: "dd MMM yyyy" with English month abbreviations ("09 Feb 2026", S5); relative time in BM on S8 "Bergabung {n} {unit} yang lepas" from the seller's registration ("Bergabung 7 bulan yang lepas" at the clock; other units — "hari", "minggu", "tahun" — INFERRED, Carbon BM locale) | — | Every signed-in role (Admin OBSERVED) | OBSERVED / INFERRED |
| FN-M20-1.3.3 | Pagination: S1, S6 and S10 are paged lists; with the 10 seed products no pager renders; a page beyond the last renders the empty state (S1 keeps its count line, FN-M20-2.1.8). Page size **20** (PROPOSED; any size ≥ 10 reproduces live, OQ-M20-08); the pager, when more rows exist, is the Laravel-style pager of M19 FN-M19-1.3.3 (INFERRED) and keeps the query values | — | Every signed-in role (Admin OBSERVED) | OBSERVED (no pager) / PROPOSED (size) |
| FN-M20-1.3.4 | Loading and errors: data views show the shared shell loading behaviour while the mock responds and the M01 global error convention on a mock failure; no M20-specific loading or error copy exists on live | — | Every signed-in role | INFERRED (M01 convention) |
| FN-M20-1.3.5 | Responsive: every M20 screen works at 375 / 768 / 1280 px without horizontal page scroll (none on live); per-screen grids as measured on live (SRS §10); no text below 12 px (none on live) | — | Every signed-in role (Admin OBSERVED) | OBSERVED |
| FN-M20-1.3.6 | Mixed-language labels as live (D-M20-08, DV-M20-08): product status badge = the raw status capitalised ("Active"; "Draft", "Rejected" INFERRED) while filters and tiles say "Aktif" / "Draf" / "Ditolak"; seller badge "Active" ("Pending", "Suspended", "Banned" INFERRED); S4 card and S9 status "Verified"; S9 "(0 reviews)"; seller filter option "Pending" | — | Every signed-in role (Admin OBSERVED) | OBSERVED / INFERRED |

### EP-M20-2 — Product administration (S1–S3)

**FT-M20-2.1 — Product list `/admin/marketplace/products` (S1)**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M20-2.1.1 | Count line **"{n} produk dijumpai"** (n = products matching the filters, all pages) and button link **"Tambah Produk"** (`fa-plus-circle`) → S2 | S1-001–002, S1-062, S1-071, S1-081 | Admin (OBSERVED) | OBSERVED |
| FN-M20-2.1.2 | GET filter card: input `q` placeholder **"Cari produk..."**; select `category` ("" **"Semua Kategori"**, `1` "Peralatan Sekolah", `2` "Buku & Rujukan", `3` "Uniform & Pakaian", `4` "Stationery", `5` "Digital & E-Book", `6` "Lain-lain"); select `status` ("" **"Semua Status"**, `active` "Aktif", `draft` "Draf", `rejected` "Ditolak"); button **"Tapis"** (`fa-filter`); the values stay selected after submit; no "Reset" link (as live) | S1-003–007 | Admin (OBSERVED) | OBSERVED |
| FN-M20-2.1.3 | Filter semantics: `q` = case-insensitive "contains" on the product name (INFERRED field; "Beg" → 1, "zzqxv" → 0 OBSERVED); `category` = the category id; `status` = the product status; conditions combine with AND; every product of every seller and of the platform, all statuses, is listed. Observed counts: category 1: 2, 2: 3, 3: 2, 4: 2, 5: 0, 6: 1; active 10, draft 0, rejected 0 | — | Admin (OBSERVED) | OBSERVED (results) / INFERRED (field) |
| FN-M20-2.1.4 | Row card per product (no table): thumbnail (first image), name (h4, truncated), price **"RM 89.90"**, seller `fa-store` shop name ("JomBelajar Official"; "PRESTASIPLUS Official" for a platform product, PROPOSED), views `fa-eye` "{views}", `fa-star` "{reviews}" ("0"), condition badge **"Baru"** / **"Terpakai"**, status badge (raw, "Active") | S1-008–016, S1-026–034, S1-044–052, S1-063–065, S1-067–069, S1-072–074 | Admin (OBSERVED) | OBSERVED |
| FN-M20-2.1.5 | Row links: `fa-external-link-alt` (title "Lihat") → S7 of the product in a new tab; `fa-edit` (title "Edit") → S3 | S1-017, S1-021, S1-035, S1-039, S1-053, S1-057, S1-066, S1-070, S1-075 | Admin (OBSERVED) | OBSERVED |
| FN-M20-2.1.6 | Row toggle (form `POST …/products/{id}/toggle`, CSRF): on an active product the button `fa-pause` titled **"Nyahaktif"** sets the product to `draft` (INFERRED); on a non-active product the button is `fa-play` titled **"Aktifkan"** and sets it to `active` (PROPOSED COPY; the variant never rendered, OQ-M20-03); no confirm (as live); the admin returns to S1 with the same filters and no flash text (PROPOSED) | S1-018–020, S1-036–038, S1-054–056 | Admin (OBSERVED) | SOURCE-DERIVED (never submitted) / INFERRED / PROPOSED |
| FN-M20-2.1.7 | Row delete (form `_method=DELETE`, CSRF, `fa-trash` titled "Padam") after the browser confirm **"Padam produk ini?"**; Cancel keeps the row; OK deletes the product with its images and reviews, returns to S1 and every count recomputes (INFERRED effects; no flash text, PROPOSED) | S1-022–025, S1-040–043, S1-058–061 | Admin (OBSERVED) | SOURCE-DERIVED (never submitted) / INFERRED |
| FN-M20-2.1.8 | Order: id ascending (1 → 10, OBSERVED; INFERRED for rows added later); paging per FN-M20-1.3.3; a page beyond the last shows the empty state **with the count of all matches** ("10 produk dijumpai" on `?page=2`, D-M20-05, replicated, DV-M20-05) | — | Admin (OBSERVED) | OBSERVED |
| FN-M20-2.1.9 | Empty state (filter with no match or page beyond the last): card **"📦"** **"Tiada Produk"** / **"Tambah produk pertama sekarang!"** + **"Tambah Produk"** (`fa-plus-circle`) → S2; the count line reads "0 produk dijumpai" for a filter with no match | S1-076–080 | Admin (OBSERVED) | OBSERVED |

**FT-M20-2.2 — Add product (admin) `/admin/marketplace/products/create` (S2)**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M20-2.2.1 | Link **"Kembali ke Senarai Produk"** (`fa-arrow-left`) → S1; multipart form `POST` to the products endpoint with the CSRF token | S2-001–003 | Admin (OBSERVED) | OBSERVED |
| FN-M20-2.2.2 | Card **"Penjual"**: select `seller_id` with "" **"🏪 PRESTASIPLUS Official (Admin)"** (default) and one option per seller "{shop name} — {owner name}{ ✅ when verified}" ("JomBelajar Official — Admin Demo ✅", DV-M20-10); hint **"Kosongkan untuk jual sebagai "PRESTASIPLUS Official""**. Which seller statuses are offered is INFERRED (active sellers) | S2-004–007 | Admin (OBSERVED) | OBSERVED / INFERRED |
| FN-M20-2.2.3 | Card **"Maklumat Produk"** (2-column grid at every width): **"Nama Produk *"** `name` (text, required); **"Kategori *"** `category_id` (required; "" "Pilih Kategori" + the 6 categories); **"Harga (RM) *"** `price` (number, required, min 0.01, step 0.01); **"Harga Asal (RM)"** `original_price` (number, min 0, step 0.01) with hint **"Untuk tunjukkan diskaun"**; **"Penerangan"** `description` (textarea) | S2-008–020 | Admin (OBSERVED) | OBSERVED |
| FN-M20-2.2.4 | Tile radios (visually hidden radio inside a labelled tile, as live): **"Keadaan *"** `condition` **"🆕 Baru"** (`new`) / **"♻️ Terpakai"** (`used`); **"Status Stok *"** `stock_status` **"✅ Ada"** (`available`) / **"❌ Habis"** (`out_of_stock`); on load **"🆕 Baru"** and **"✅ Ada"** are checked; the radios carry no `required` attribute (the only `required` fields of the form are `name`, `category_id` and `price`), so a condition and a stock status are always sent | S2-021–034 | Admin (OBSERVED) | OBSERVED |
| FN-M20-2.2.5 | Card **"Penghantaran"**: **"Kaedah Penghantaran *"** tile radios `shipping_method` **"Ambil Sendiri"** (`pickup`, `fa-map-marker-alt`), **"Pos / Kurier"** (`postage`), **"COD"** (`cod`, `fa-hand-holding-usd`), **"Percuma"** (`free`, `fa-gift`), with **"Ambil Sendiri"** checked on load and no `required` on the radios; **"Kos Penghantaran (RM)"** `shipping_fee` (number, min 0, step 0.01, placeholder **"Kosongkan jika percuma"**, always visible); **"Lokasi"** `location` (placeholder **"cth: Kuala Lumpur"**) | S2-035–052 | Admin (OBSERVED) | OBSERVED |
| FN-M20-2.2.6 | Card **"Gambar Produk"**: **"Muat naik sehingga 5 gambar. Gambar pertama jadi gambar utama."**; file input `images[]` (multiple, accept `image/jpeg,image/png,image/webp`); **"JPG, PNG, WEBP. Maks 2MB setiap gambar."**; submit **"Tambah Produk"** (`fa-plus-circle`) | S2-053–058 | Admin (OBSERVED) | OBSERVED |
| FN-M20-2.2.7 | Create effects (INFERRED / PROPOSED; never submitted on live): the browser `required` / `min` checks run first; the server validates the same rules and the image rules (≤ 5 files, JPG / PNG / WEBP, ≤ 2 MB each) and returns the form with per-field messages (PROPOSED COPY, SRS §8.2); on success a product is created with the next id, `status` `active` (INFERRED), `views` 0, the chosen seller (empty = the platform, "PRESTASIPLUS Official"), `slug` = slugified name + "-" + 5 random letters / digits (OBSERVED pattern), images in upload order (the first is "Utama"); the admin lands on S1 with no flash text (PROPOSED) | — | Admin (OBSERVED) | INFERRED / PROPOSED |

**FT-M20-2.3 — Edit product (admin) `/admin/marketplace/products/{id}/edit` (S3)**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M20-2.3.1 | Link **"Kembali ke Senarai Produk"** (`fa-arrow-left`) → S1; multipart form `PUT` (`_method=PUT`, CSRF) to the product | S3-001–004 | Admin (OBSERVED) | OBSERVED |
| FN-M20-2.3.2 | Card **"Kemaskini Produk"** with the S2 "Maklumat Produk" fields prefilled from the product, with these live differences kept: no seller select; `price` and `original_price` without `min`; no "Untuk tunjukkan diskaun" hint; the category select without "Pilih Kategori"; condition and stock tiles checked per the product | S3-005–030 | Admin (OBSERVED) | OBSERVED |
| FN-M20-2.3.3 | **"Status Produk *"** tile radios `status`: **"🟢 Aktif"** (`active`), **"⏸️ Draf"** (`draft`), **"🔴 Ditolak"** (`rejected`), the saved status checked | S3-031–039 | Admin (OBSERVED) | OBSERVED |
| FN-M20-2.3.4 | Card **"Penghantaran"** as S2 (FN-M20-2.2.5), prefilled (e.g. #1 "Pos / Kurier", fee 8, "Kuala Lumpur"; #3 "COD"; #5 "Percuma", "Digital"; #9 "Ambil Sendiri") | S3-040–057 | Admin (OBSERVED) | OBSERVED |
| FN-M20-2.3.5 | Card **"Gambar Sedia Ada ({n})"**: 4-column grid of the product's images in order, the first with the badge **"Utama"**; each image has a red `fa-times` button (shown on hover, as live) that deletes **only that image** after the confirm **"Padam gambar ini?"** — including the first image, whose live button joins the product form without a confirm (D-M20-01 fixed, DV-M20-01); after a delete the admin stays on S3 and the next image becomes "Utama" (INFERRED) | S3-058–079, S3-091–097 | Admin (OBSERVED) | OBSERVED + DV-M20-01 |
| FN-M20-2.3.6 | Card **"Tambah Gambar Baru"**: file input `images[]` (multiple) and **"Simpan Perubahan"** (`fa-save`), both part of the product form, so saving submits every field and the new images (live: both fall outside every form and saving does nothing, D-M20-01 fixed, DV-M20-01); the total per product stays ≤ 5 images | S3-080–083 | Admin (OBSERVED) | OBSERVED + DV-M20-01 |
| FN-M20-2.3.7 | Save effects (PROPOSED): the same validation as S2; the product's fields, status and shipping are updated (views, seller and slug unchanged); new images are appended; the admin lands on S1 with no flash text; a status other than `active` hides the product from buyers (FN-M20-4.1.6) | — | Admin (OBSERVED) | PROPOSED |

### EP-M20-3 — Seller administration (S4–S5)

**FT-M20-3.1 — Seller list `/admin/marketplace/sellers` (S4)**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M20-3.1.1 | Four stat cards (2 columns at 375, 4 from 768): **"Menunggu Pengesahan"** (status `pending`), **"Aktif"** (status `active`), **"Jumlah Penjual"** (all), **"Verified"** (verified) — **computed over the sellers that match the `status` filter** (with `pending`, `suspended` or `banned` all four read 0 while seller #1 exists; D-M20-04 replicated, DV-M20-04). Seed: 0 / 1 / 1 / 1 | S4-001–012, S4-026–028 | Admin (OBSERVED) | OBSERVED |
| FN-M20-3.1.2 | GET filter: select `status` ("" **"Semua Status"**, `pending` **"Pending"**, `active` "Aktif", `suspended` "Digantung", `banned` "Diharamkan"), button **"Tapis"** (`fa-filter`); value kept; no "Reset" link | S4-013–015 | Admin (OBSERVED) | OBSERVED |
| FN-M20-3.1.3 | Row card per seller: avatar initial of the shop name ("J"), shop name (h4), owner line **"{owner name} · {phone}"** ("Admin Demo · 0100000000", DV-M20-09/10), status badge (raw, "Active"), **"{n} produk"** (all the seller's products) | S4-016–021 | Admin (OBSERVED) | OBSERVED |
| FN-M20-3.1.4 | Row actions: `fa-eye` (title **"Lihat Detail"**) → S5; ban form (`fa-ban`, title **"Haramkan"**) after the confirm **"Haramkan penjual ini?"** → FN-M20-3.2.7 | S4-022–025 | Admin (OBSERVED) | SOURCE-DERIVED (ban never submitted) |
| FN-M20-3.1.5 | Empty state **"Tiada penjual dijumpai"** when no seller matches | S4-029 | Admin (OBSERVED) | OBSERVED |
| FN-M20-3.1.6 | Verification of a pending seller (not observable, OQ-M20-04; PROPOSED minimum so that a registered seller can go live — **approved by the user at G1, 2026-09-27**): on S5 of a `pending` seller the "Tindakan" card shows **"Sahkan Penjual"** (`fa-check`, PROPOSED COPY) above "Haramkan Penjual"; it sets `status` `active` and `verifiedAt` = now after the confirm **"Sahkan penjual ini?"** (PROPOSED COPY); no reject / suspend / unban action is added (OQ-M20-04) | — | Admin | PROPOSED |

**FT-M20-3.2 — Seller review `/admin/marketplace/sellers/{id}` (S5)**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M20-3.2.1 | Link **"Kembali ke Senarai Penjual"** (`fa-arrow-left`) → S4; grid 1 column at 375, 2 at 768, 3 (2 + 1) at 1280 | S5-001 | Admin (OBSERVED) | OBSERVED |
| FN-M20-3.2.2 | Card **"Maklumat Perniagaan"**: avatar "J", shop name (h4) + blue verified tick (when verified), status badge "Active", description ("Kedai rasmi JomBelajar — peralatan sekolah berkualiti untuk semua pelajar Malaysia 🇲🇾"), owner name (`fa-user`, "Admin Demo"), owner e-mail (`fa-envelope`, "admin@demo.test"), telephone (`fa-phone`, "0100000000"), WhatsApp link (`fa-whatsapp`, green) → `https://wa.me/60100000000` showing "60100000000" (DV-M20-09), opening in a **new tab** (`target="_blank"`, no `rel`, as live) | S5-002–011 | Admin (OBSERVED) | OBSERVED |
| FN-M20-3.2.3 | Card **"Dokumen"**: the seller's uploaded documents; with none, **"Tiada dokumen dimuat naik"** (seed 0 documents; the populated list and the upload UI are not observable, OQ-M20-01) | S5-012–014 | Admin (OBSERVED) | OBSERVED |
| FN-M20-3.2.4 | Card **"Produk ({n})"**: 3-column grid (2 at 375) of all the seller's products with thumbnail, name and price; every thumbnail uses the same image URL as the other screens (live: all 10 broken `/storage/…` URLs, D-M20-03 fixed, DV-M20-03) | S5-015–046 | Admin (OBSERVED) | OBSERVED + DV-M20-03 |
| FN-M20-3.2.5 | Card **"Ringkasan"**: **"Jumlah Produk"** {n} (all the seller's products), **"Rating"** stars of the average rating ("☆☆☆☆☆" with no review), **"Ulasan"** {n reviews of the seller's products} (0), **"Didaftarkan"** "09 Feb 2026", **"Disahkan"** "09 Feb 2026" (verification date; "-" when not verified, INFERRED) | S5-047–058 | Admin (OBSERVED) | OBSERVED |
| FN-M20-3.2.6 | Card **"Tindakan"**: ban form, button **"Haramkan Penjual"** (`fa-ban`) after the confirm **"Haramkan penjual ini? Semua produk akan dinyahaktifkan."** (the S4 confirm text is shorter, as live) | S5-059–063 | Admin (OBSERVED) | SOURCE-DERIVED (never submitted) |
| FN-M20-3.2.7 | Ban effects (INFERRED from the S5 confirm; never submitted): the seller's status becomes `banned` and every product of the seller becomes `draft` ("dinyahaktifkan"); the admin returns to the page the action came from with no flash text (PROPOSED); the ban button stays available (INFERRED); a banned seller's shop page S8 answers 404 and its products leave S6 (FN-M20-4.1.6); no unban action (OQ-M20-04) | — | Admin | INFERRED / PROPOSED |

### EP-M20-4 — Buyer marketplace (S6–S8)

**FT-M20-4.1 — Marketplace `/marketplace` (S6)**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M20-4.1.1 | Search card (GET form → `/marketplace`): input `q` placeholder **"Cari peralatan sekolah..."** (`fa-search` icon); select `category` ("" **"Semua Kategori"** + the 6 categories by **slug**: `peralatan-sekolah`, `buku-rujukan`, `uniform-pakaian`, `stationery`, `digital`, `lain-lain`); select `condition` ("" **"Semua Keadaan"**, `new` "Baru", `used` "Terpakai"); select `sort` (`latest` **"Terbaru"** default, `price_low` **"Harga ↑"**, `price_high` **"Harga ↓"**, `popular` **"Popular"**); button **"Cari"** (`fa-search`); all four values stay selected after a search | S6-004–009 | Every signed-in role (Admin OBSERVED) | OBSERVED |
| FN-M20-4.1.2 | Category chips (links, rounded): **"Semua"** → `/marketplace`; **"Peralatan Sekolah"** (`fa-pencil-ruler`), **"Buku & Rujukan"** (`fa-book`), **"Uniform & Pakaian"** (`fa-tshirt`), **"Stationery"** (`fa-pen`), **"Digital & E-Book"** (`fa-tablet-alt`), **"Lain-lain"** (`fa-th-large`), each → `?category={slug}` (dropping the other query values, as live); the chip of the current category is indigo with white text, the others white with a border ("Semua" with no category) | S6-010–016 | Every signed-in role (Admin OBSERVED) | OBSERVED |
| FN-M20-4.1.3 | Product grid (2 / 3 / 4 columns at 375 / 768 / 1280); each card is one link → S7 and shows the first image inset in the padded card, the red discount badge "-{p}%" (when an original price exists), the amber badge **"Terpakai"** (used items, stacked under the discount badge), the name (h4, 2 lines), the seller `fa-store` shop name + verified tick, the price, the struck original price and the shipping line (icon before it: `fa-truck` for postage, `fa-gift` for free, `fa-hand-holding-usd` for COD, `fa-box` for pickup — G5 2026-10-10; the postage truck is OBSERVED on the live screenshots, the other three icons are INFERRED): `postage` **"Pos / Kurier (RM{fee})"**, `free` **"Penghantaran Percuma 🎉"**, `cod` **"Cash on Delivery (COD)"**, `pickup` **"Ambil Sendiri (Pickup)"** | S6-017–042, S6-047–049 | Every signed-in role (Admin OBSERVED) | OBSERVED |
| FN-M20-4.1.4 | Filter and sort semantics: `q` contains on the name (case-insensitive, INFERRED field); `category` by slug; `condition` exact; AND. Sort `latest` = creation time descending — with equal creation times (the seed) the unfiltered list is **id ascending** and a **category** list is **id descending** (D-M20-07 replicated as observed, DV-M20-07); `price_low` / `price_high` = price ascending / descending; `popular` = views descending, ties by id ascending (INFERRED). Unknown values match nothing (INFERRED) | — | Every signed-in role (Admin OBSERVED) | OBSERVED / INFERRED |
| FN-M20-4.1.5 | Empty state (no match or page beyond the last): **"🛒"** **"Tiada Produk Dijumpai"** / **"Cuba tukar kata kunci atau kategori"**; no pager | S6-043–046 | Every signed-in role (Admin OBSERVED) | OBSERVED |
| FN-M20-4.1.6 | Visibility: S6, S7, S8 and "Produk Berkaitan" show only products with status `active` whose seller is `active` (or the platform); any other product's page answers 404 (INFERRED; every seed product is active). Out-of-stock products stay listed (INFERRED) | — | Every signed-in role | INFERRED |

**FT-M20-4.2 — Product page `/marketplace/{slug}` (S7)**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M20-4.2.1 | Link **"Kembali ke Marketplace"** (`fa-arrow-left`) → S6 | S7-004 | Every signed-in role (Admin OBSERVED) | OBSERVED |
| FN-M20-4.2.2 | Gallery card: the main image and one thumbnail button per image (up to 5); clicking a thumbnail swaps the main image client-side (no request) and moves the indigo border to it; the first thumbnail is active on load | S7-005–013, S7-058 | Every signed-in role (Admin OBSERVED) | OBSERVED |
| FN-M20-4.2.3 | Details card: condition badge ("Baru" / "Terpakai") and category badge with the category icon; H1 name (24 px); price, struck original and "-{p}%" (both hidden without an original price); description; `fa-eye` **"{n} tontonan"** and stock `fa-box` **"Ada Stok"** (green; out of stock **"Habis Stok"**, red, PROPOSED COPY, OQ-M20-03); shipping box with the `fa-truck` shipping line and the location (`fa-map-marker-alt`) | S7-014–025, S7-037–044, S7-059–068 | Every signed-in role (Admin OBSERVED) | OBSERVED / PROPOSED |
| FN-M20-4.2.4 | Green button **"Hubungi Penjual di WhatsApp"** (`fa-whatsapp`) → `/marketplace/{slug}/whatsapp`, opening in a **new tab** (`target="_blank"`, OBSERVED on all three captured states; no `rel` attribute INFERRED — the inventory records no `rel`, but S7 was not re-opened live; to be confirmed at G5) | S7-026, S7-045, S7-069 | Every signed-in role (Admin OBSERVED) | OBSERVED (target) / INFERRED (no `rel`) |
| FN-M20-4.2.5 | WhatsApp redirect (never opened on live): `GET /marketplace/{slug}/whatsapp` adds 1 to the seller's **"Klik WhatsApp"** counter (no de-duplication, INFERRED) and hands over to a plain `https://wa.me/{seller WhatsApp}?text={message}` link with the fictitious number (DV-M20-09) and the PROPOSED message **"Salam, saya berminat dengan produk "{name}" di PRESTASIPLUS Marketplace."** (URL-encoded). Per user decision **D14** (external platforms: no screen is built, the outcome is simulated) the rebuild renders **no WhatsApp or intermediate screen**: the W route runs in the **new tab** opened by FN-M20-4.2.4, records the click and replaces itself (`location.replace`) with the `wa.me` URL, which is the simulated success outcome; **S7 stays open in the original tab**. If recording fails, the new tab shows the M01 error convention (simulated failure); an unknown or hidden slug shows the global 404 page in the new tab. The product's views do not change; a platform product uses the platform number `60000000000` (M19 DV-M19-09) and counts nothing; an unknown or hidden slug → 404 | — | Every signed-in role | INFERRED / PROPOSED + D14 |
| FN-M20-4.2.6 | Card **"PENJUAL"** (uppercase label; right column under the details card, G5 2026-10-10; whole card is a link → S8): avatar initial, shop name + `fa-check-circle` (verified), rating stars ("☆☆☆☆☆"), **"{n} produk"** (the seller's active products); a platform product shows "PRESTASIPLUS Official" without a link (PROPOSED) | S7-027–029 | Every signed-in role (Admin OBSERVED) | OBSERVED / PROPOSED |
| FN-M20-4.2.7 | Card **"Ulasan ({n})"** (`fa-star`): with no review **"Belum ada ulasan untuk produk ini"**; no review form is shown (as observed for the admin; review submission not observable, OQ-M20-05) | S7-030–032 | Every signed-in role (Admin OBSERVED) | OBSERVED |
| FN-M20-4.2.8 | **"Produk Berkaitan"** (`fa-th-large`): the other visible products of the **same category**, id ascending, at most 4 (PROPOSED limit; ≤ 2 observed), each a link → S7 with image, name and price; hidden when there is none (INFERRED) | S7-033–036, S7-046–050, S7-070–072 | Every signed-in role (Admin OBSERVED) | OBSERVED / PROPOSED |
| FN-M20-4.2.9 | View counter: every load of S7 adds 1 to the product's views **before** the page renders, so the page shows the new total (OBSERVED: 31 → 32 per fetch, not de-duplicated per session); lists, admin and seller pages never count a view | — | Every signed-in role (Admin OBSERVED) | OBSERVED |

**FT-M20-4.3 — Public shop `/marketplace/penjual/{id}` (S8)**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M20-4.3.1 | Link **"Kembali ke Marketplace"** (`fa-arrow-left`) → S6 | S8-004 | Every signed-in role (Admin OBSERVED) | OBSERVED |
| FN-M20-4.3.2 | Shop card: avatar "J", H1 shop name + tick, description, **"☆☆☆☆☆ ({reviews})"**, `fa-box` **"{n} produk"**, `fa-calendar` **"Bergabung {relative time}"**; the decorative circle clipped at the card edge (no page overflow, as live) | S8-005–011 | Every signed-in role (Admin OBSERVED) | OBSERVED |
| FN-M20-4.3.3 | Grid (2 / 3 / 4 columns) of the seller's visible products, id ascending; each card a link → S7 with image, name, price and struck original (no badge, no shipping line, as live) | S8-012–020 | Every signed-in role (Admin OBSERVED) | OBSERVED |

### EP-M20-5 — Seller portal (S9–S12) and seller registration

**FT-M20-5.1 — Seller registration**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M20-5.1.1 | `/seller/daftar` for a user who already owns a Seller → redirect to `/seller/dashboard` (OBSERVED for the admin) | — | Seller (Admin OBSERVED) | OBSERVED |
| FN-M20-5.1.2 | Registration form at `/seller/daftar` for a signed-in user without a Seller (not observable, OQ-M20-01; PROPOSED minimum built from the fields the other screens display — **approved by the user at G1, 2026-09-27**): user shell, header **"Daftar Penjual"** / **"Buka kedai anda di marketplace"**, tab "Daftar Penjual - PRESTASIPLUS Marketplace"; fields **"Nama Kedai *"** (`shop_name`, ≤ 100), **"Penerangan Kedai"** (`description`, ≤ 1,000), **"No. Telefon *"** (`phone`, digits, 10–12), **"No. WhatsApp *"** (`whatsapp`, digits starting "60", 11–12); button **"Daftar Sebagai Penjual"**; no document upload and no terms text (OQ-M20-01) (all PROPOSED COPY) | — | Every signed-in role | PROPOSED |
| FN-M20-5.1.3 | Registration effects (PROPOSED, approved at G1 2026-09-27): one Seller per user, `status` `pending`, not verified, `whatsappClicks` 0, `createdAt` now; the user lands on S9, which shows the pending state through the existing "Status:" line (raw "Pending", FN-M20-1.3.6) — no new notice; a pending seller may add products, which stay hidden from buyers until an admin verifies the seller (FN-M20-3.1.6, FN-M20-4.1.6) | — | Every signed-in role | PROPOSED |

**FT-M20-5.2 — Seller dashboard `/seller/dashboard` (S9)**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M20-5.2.1 | Four stat cards (2 columns at 375, 4 from 768): **"Jumlah Produk"** (all the seller's products), **"Produk Aktif"** (status `active`), **"Jumlah Tontonan"** (Σ views of the seller's products), **"Klik WhatsApp"** (the seller's stored click counter). Seed: 10 / 10 / **111** / 16 | S9-004–015 | Seller (Admin OBSERVED) | OBSERVED |
| FN-M20-5.2.2 | Buttons **"Tambah Produk"** (`fa-plus-circle`, gradient) → S11, **"Senarai Produk"** (`fa-box`) → S10, **"Lihat Kedai Saya"** (`fa-external-link-alt`) → S8 of the seller in a **new tab** (`target="_blank"` OBSERVED; no `rel` INFERRED, to be confirmed at G5) | S9-016–018 | Seller (Admin OBSERVED) | OBSERVED (target) / INFERRED (no `rel`) |
| FN-M20-5.2.3 | Card **"Profil Kedai"**: **"Nama:"** shop name; **"Status:"** `fa-check-circle` **"Verified"** when verified, otherwise the raw status (INFERRED); **"Rating:"** stars **"(0 reviews)"** ("({n} reviews)", INFERRED plural pattern); **"WhatsApp:"** the seller's number ("60100000000", DV-M20-09) | S9-019–029 | Seller (Admin OBSERVED) | OBSERVED |
| FN-M20-5.2.4 | **"Produk Terbaru"**: the seller's 6 newest products (creation time descending, ties id ascending — the seed shows #1–#6) as cards (2 / 3 / 3 columns) with image, name, price, `fa-eye` views and the raw status badge | S9-030–066 | Seller (Admin OBSERVED) | OBSERVED |

**FT-M20-5.3 — Seller product list `/seller/produk` (S10)**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M20-5.3.1 | Links **"Dashboard"** (`fa-arrow-left`) → S9 and **"Tambah Produk"** (`fa-plus`) → S11 | S10-004–005 | Seller (Admin OBSERVED) | OBSERVED |
| FN-M20-5.3.2 | Row card per product of the seller (id ascending; paging per FN-M20-1.3.3): thumbnail, name, price, `fa-eye` views, `fa-star` "0", raw status badge (as S1 without seller, condition and toggle) | S10-006–012, S10-018–024, S10-030–036 | Seller (Admin OBSERVED) | OBSERVED |
| FN-M20-5.3.3 | Row actions: `fa-edit` → S12; delete form (`_method=DELETE`, `fa-trash`) after the confirm **"Padam produk ini?"**; effects as FN-M20-2.1.7, returning to S10 (INFERRED) | S10-013–017, S10-025–029, S10-037–041 | Seller (Admin OBSERVED) | SOURCE-DERIVED (never submitted) / INFERRED |
| FN-M20-5.3.4 | Empty state: **"📦"** **"Belum Ada Produk"** / **"Tambah produk pertama anda sekarang!"** + **"Tambah Produk"** (`fa-plus-circle`) → S11 | S10-042–046 | Seller (Admin OBSERVED) | OBSERVED |

**FT-M20-5.4 — Seller add product `/seller/produk/tambah` (S11)**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M20-5.4.1 | Link **"Kembali"** (`fa-arrow-left`) → S10; multipart form `POST` with the CSRF token | S11-004–006 | Seller (Admin OBSERVED) | OBSERVED |
| FN-M20-5.4.2 | Card **"Maklumat Produk"** exactly as S2 FN-M20-2.2.3–2.2.4 (same fields, hints, limits and tiles; "🆕 Baru" and "✅ Ada" checked on load; only `name`, `category_id` and `price` are `required`) | S11-007–033 | Seller (Admin OBSERVED) | OBSERVED |
| FN-M20-5.4.3 | Card **"Gambar Produk"** exactly as S2 FN-M20-2.2.6 with button **"Tambah Produk"**; there is **no "Penjual" select and no "Penghantaran" card** (as live) | S11-034–039 | Seller (Admin OBSERVED) | OBSERVED |
| FN-M20-5.4.4 | Create effects (PROPOSED; never submitted): validation as S2; the product belongs to the seller, `status` `active`, `views` 0, **shipping `pickup` with no fee and an empty location** (a seller cannot set shipping on live; C4, OQ-M20-07; `pickup` is also the method S2 checks by default, OBSERVED), so S6 / S7 show "Ambil Sendiri (Pickup)" and no location line; the seller lands on S10 with no flash text | — | Seller | PROPOSED |

**FT-M20-5.5 — Seller edit product `/seller/produk/{id}/edit` (S12)**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M20-5.5.1 | Link **"Kembali"** (`fa-arrow-left`) → S10; multipart form `PUT` (`_method=PUT`, CSRF) to the product | S12-004–007 | Seller (Admin OBSERVED) | OBSERVED |
| FN-M20-5.5.2 | Card **"Kemaskini Produk"** as S3 FN-M20-2.3.2, prefilled, **without "Status Produk" and without "Penghantaran"** (as live) | S12-008–033 | Seller (Admin OBSERVED) | OBSERVED |
| FN-M20-5.5.3 | Card **"Gambar Sedia Ada"** (no count, as live): the product's images in order, **no "Utama" badge and no delete button** (a seller cannot delete an image, as live) | S12-034–039, S12-054 | Seller (Admin OBSERVED) | OBSERVED |
| FN-M20-5.5.4 | Card **"Tambah Gambar Baru"** (file `images[]`) and **"Simpan Perubahan"** (`fa-save`), both inside the product form (no nesting defect here, as live); total ≤ 5 images | S12-040–043 | Seller (Admin OBSERVED) | OBSERVED |
| FN-M20-5.5.5 | Ownership and save effects: S12, its update and the S10 delete act only on the viewer's own products — another seller's or an unknown id → 404 (INFERRED); saving updates the name, category, prices, description, condition and stock, appends new images, keeps status, shipping, views and slug, and lands on S10 with no flash text (PROPOSED) | — | Seller | INFERRED / PROPOSED |

### EP-M20-6 — Marketplace data rules and module boundaries

**FT-M20-6.1 — Records, counts and boundaries**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M20-6.1.1 | Product record: `id`, `sellerId` (null = the platform "PRESTASIPLUS Official"), `name`, `slug`, `categoryId` (1–6), `price`, `originalPrice` (nullable), `description`, `condition` `new` \| `used`, `stockStatus` `available` \| `out_of_stock`, `status` `active` \| `draft` \| `rejected`, `shippingMethod` `pickup` \| `postage` \| `cod` \| `free`, `shippingFee` (nullable), `location`, `views`, `createdAt`; images (≤ 5, ordered, first = main). Categories: 6 fixed rows with id, slug, name and icon; S1 / S2 use the id, S6 the slug (C3); "Digital & E-Book" holds no product (observed data) | — | System | OBSERVED |
| FN-M20-6.1.2 | Seller record: `id`, owner `userId` (one seller per user), `shopName`, `description`, `phone`, `whatsapp`, `status` `pending` \| `active` \| `suspended` \| `banned`, `verifiedAt`, `createdAt` ("Didaftarkan"), `whatsappClicks` (stored counter, 16 in the seed, C2), documents; the owner's name and e-mail are read from the user (M01 / M02) | — | System | OBSERVED / INFERRED |
| FN-M20-6.1.3 | Every displayed count is a named query over M20's stores (SRS §6.8): product counts, filter counts, "{n} produk", "Jumlah Produk", "Produk Aktif", "Jumlah Tontonan" = Σ views, the seller cards, "Ulasan", "Produk ({n})", "Gambar Sedia Ada ({n})"; "Klik WhatsApp" is the stored counter; nothing is a display constant | — | System | OBSERVED |
| FN-M20-6.1.4 | Boundaries: the marketplace has **no cart, order, checkout or online payment** and no coin price; buying happens outside the platform after the WhatsApp contact; nothing in M20 writes M19 payments, M14 wallets or M15 redemptions (C5) | — | System | OBSERVED |
| FN-M20-6.1.5 | Reviews and rating: a review belongs to a product (rating 1–5 + text, INFERRED); the seed has none; product review count ("0" on S1 / S10, "Ulasan ({n})" on S7), seller rating = average of its products' ratings shown as 5 stars (filled per rounded average, INFERRED; "☆☆☆☆☆" with none), seller review count (S5 "Ulasan", S8 "({n})", S9 "({n} reviews)"); submitting a review is out of scope until observed (OQ-M20-05) | — | System | OBSERVED (zero state) / INFERRED |

---

## 4. User stories

Values in the ACs come from the seed (SRS §6.11: every product, image and seller value is the observed record of 2026-09-27 with the **pre-discovery views** #1 30, #5 7, #7 5; contact data fictitious) computed at the **project clock 2026-09-25T15:40:00+08:00**. "The admin" = `admin@demo.test` (id 1, owner of seller #1 "JomBelajar Official"). "Pelajar" = `pelajar@demo.test` (id 2, not a seller). Products are named by id (#1 "Beg Sekolah Anti-Air Premium" … #10). Student-side and other non-admin ACs are **provisional** (no student account on live, OQ-M20-06); PROPOSED behaviour is marked in the AC. Every AC runs at 375×812, 768×1024 and 1280×800.

| ID | Feature | MoSCoW | Story | Functions |
|---|---|---|---|---|
| US-M20-01 | FT-M20-1.1 | Must | As an admin, I want the "Marketplace" sidebar group and, as a user, the "Marketplace" menu entry and, as a seller, a "Kedai Saya" menu link, so that I can reach the marketplace pages and my shop. | FN-M20-1.1.1, 1.1.2, 1.1.5, 1.1.6 |
| US-M20-02 | FT-M20-1.1 | Must | As a user, I want each marketplace page's header and tab title to name the page, product or shop, so that I know where I am. | FN-M20-1.1.3, 1.1.4 |
| US-M20-03 | FT-M20-1.2 | Must | As the owner, I want administration limited to admins and the seller portal limited to sellers, so that only the right people change products. | FN-M20-1.2.1–1.2.3 |
| US-M20-04 | FT-M20-1.2 | Must | As any user, I want wrong URLs to show the standard 404 page, so that errors are predictable. | FN-M20-1.2.4, 1.2.5 |
| US-M20-05 | FT-M20-1.3 | Must | As a user, I want consistent prices, discounts, dates, paging and labels, so that the marketplace reads the same everywhere. | FN-M20-1.3.1–1.3.4, 1.3.6 |
| US-M20-06 | FT-M20-2.1 | Must | As an admin, I want a filterable list of every product with its seller, views, condition and status, so that I can moderate the catalogue. | FN-M20-2.1.1–2.1.5, 2.1.8, 2.1.9 |
| US-M20-07 | FT-M20-2.1 | Must | As an admin, I want to deactivate, reactivate and delete a product, so that I can remove unsuitable listings. | FN-M20-2.1.6, 2.1.7 |
| US-M20-08 | FT-M20-2.2 | Must | As an admin, I want to add a product as the platform or for a seller, so that I can feed the marketplace. | FN-M20-2.2.1–2.2.7 |
| US-M20-09 | FT-M20-2.3 | Must | As an admin, I want to edit a product's details, status and shipping, so that I can correct or moderate it. | FN-M20-2.3.1–2.3.4, 2.3.7 |
| US-M20-10 | FT-M20-2.3 | Must | As an admin, I want to delete single images and add new ones, so that product photos stay correct. | FN-M20-2.3.5, 2.3.6 |
| US-M20-11 | FT-M20-3.1 | Must | As an admin, I want a filterable list of sellers with their counts, so that I can see who sells on the platform. | FN-M20-3.1.1–3.1.5 |
| US-M20-12 | FT-M20-3.1 | Should | As an admin, I want to verify a pending seller, so that a new shop can start selling. | FN-M20-3.1.6 |
| US-M20-13 | FT-M20-3.2 | Must | As an admin, I want a seller's business details, documents, products and summary on one page, so that I can review the seller. | FN-M20-3.2.1–3.2.5 |
| US-M20-14 | FT-M20-3.2 | Must | As an admin, I want to ban a seller and deactivate all their products, so that I can stop abuse. | FN-M20-3.2.6, 3.2.7 |
| US-M20-15 | FT-M20-4.1 | Must | As a student, I want to search, filter and sort school supplies, so that I can find what I need. | FN-M20-4.1.1–4.1.6 |
| US-M20-16 | FT-M20-4.2 | Must | As a student, I want a product page with photos, price, condition, shipping, seller, reviews and related products, so that I can decide to buy. | FN-M20-4.2.1–4.2.3, 4.2.6–4.2.9 |
| US-M20-17 | FT-M20-4.2 | Must | As a student, I want to contact the seller on WhatsApp from the product page, so that I can arrange the purchase. | FN-M20-4.2.4, 4.2.5 |
| US-M20-18 | FT-M20-4.3 | Should | As a student, I want a seller's shop page with all their products, so that I can see what else they sell. | FN-M20-4.3.1–4.3.3 |
| US-M20-19 | FT-M20-5.1 | Should | As a user, I want to register as a seller, so that I can sell my items. | FN-M20-5.1.1–5.1.3 |
| US-M20-20 | FT-M20-5.2 | Must | As a seller, I want a dashboard with my product, view and WhatsApp-click counts and my newest products, so that I see how my shop performs. | FN-M20-5.2.1–5.2.4 |
| US-M20-21 | FT-M20-5.3 | Must | As a seller, I want a list of my products with edit and delete, so that I can manage my listings. | FN-M20-5.3.1–5.3.4 |
| US-M20-22 | FT-M20-5.4 | Must | As a seller, I want to add a product with photos, so that buyers can find it. | FN-M20-5.4.1–5.4.4 |
| US-M20-23 | FT-M20-5.5 | Must | As a seller, I want to edit my product and add photos, so that my listing stays accurate. | FN-M20-5.5.1–5.5.5 |
| US-M20-24 | FT-M20-6.1 | Must | As the owner, I want every marketplace figure computed from the stored products and sellers and no payment flow, so that the figures are correct and the scope matches live. | FN-M20-6.1.1–6.1.5 |
| US-M20-25 | FT-M20-1.3 | Must | As any user, I want every marketplace page usable at phone, tablet and desktop widths, so that I can use it anywhere. | FN-M20-1.3.5 |

### Acceptance criteria

**US-M20-01 — Menus and shells**
- **AC-M20-01.1** Given the admin at 1280px on S1, when the sidebar renders, then it has the group "Marketplace" open with "Produk" → `/admin/marketplace/products` (active) and "Penjual" → `/admin/marketplace/sellers`; on S2 and S3 "Produk" is active; on S4 and S5 "Penjual" is active.
- **AC-M20-01.2** Given the admin at 375px, when I open "Lagi", then the section "Marketplace" lists "Produk" and "Penjual" with the same targets.
- **AC-M20-01.3** Given the admin on a user-portal page, when I open the account menu, then it shows "Marketplace" → `/marketplace` and, in the admin block, "Urus Produk" → `/admin/marketplace/products` and "Urus Penjual" → `/admin/marketplace/sellers`; given pelajar (provisional), "Marketplace" is shown and "Urus Produk" / "Urus Penjual" are not; given guru (provisional), "Marketplace" is not shown.
- **AC-M20-01.4** Given pelajar, who owns no seller (provisional), when I open the user menu and the mobile drawer, then no entry links to `/seller/dashboard`, `/seller/produk` or `/seller/daftar`; given the admin, the admin-panel sidebar and its "Lagi" drawer contain no `/seller/*` link (DV-M20-06).
- **AC-M20-01.5** Given the admin, when S1–S5 load, then they render in the admin-panel shell; when S6–S12 load, then they render in the user-portal shell and the tournament banner texts "LIVE:", "MAIN", "DAFTAR" are not visible.
- **AC-M20-01.6** Given the admin (owner of seller #1), when I open the account dropdown on a user-portal page, then "Kedai Saya" (`fa-store`) shows directly below "Marketplace" and leads to `/seller/dashboard`; at 375px the mobile drawer shows "Kedai Saya" directly below "Marketplace" with the same target; on S9–S12 the link is active. Given pelajar (provisional), the link is absent before registration and present after AC-M20-19.3 (PROPOSED label, user-approved new scope, DV-M20-06).

**US-M20-02 — Titles**
- **AC-M20-02.1** Given the admin, when S1, S2, S4, S6, S10 and S11 load, then the headers read "Marketplace - Produk" / "Urus semua produk marketplace", "Tambah Produk Marketplace" / "Admin feed produk ke marketplace", "Marketplace - Penjual" / "Urus dan sahkan penjual", "Marketplace" / "Peralatan sekolah untuk pelajar 🛒", "Produk Saya" / "Urus senarai produk anda", "Tambah Produk" / "Senaraikan produk baru di marketplace", and the tab titles "Urus Produk - Admin PRESTASIPLUS", "Tambah Produk - Admin PRESTASIPLUS", "Urus Penjual - Admin PRESTASIPLUS", "Marketplace - PRESTASIPLUS", "Produk Saya - PRESTASIPLUS Marketplace", "Tambah Produk - PRESTASIPLUS Marketplace".
- **AC-M20-02.2** Given the admin, when S3 #1, S5 #1, S7 #1, S7 #5, S8 #1, S9 and S12 #7 load, then the headers read "Edit Produk" / "Beg Sekolah Anti-Air Premium", "Semak Penjual" / "JomBelajar Official", "Marketplace" / "Peralatan Sekolah", "Marketplace" / "Buku & Rujukan", "Kedai Penjual" / "JomBelajar Official", "Dashboard Penjual" / "JomBelajar Official", "Edit Produk" / "Kamus Dewan Edisi Keempat (Terpakai)", and the tab titles "Edit Produk - Admin PRESTASIPLUS", "Semak Penjual - JomBelajar Official", "Beg Sekolah Anti-Air Premium - Marketplace PRESTASIPLUS", "E-Book: 1001 Soalan Sains Tingkatan 3 (PDF) - Marketplace PRESTASIPLUS", "JomBelajar Official - Marketplace PRESTASIPLUS", "Kedai Saya - PRESTASIPLUS Marketplace", "Edit Produk - PRESTASIPLUS Marketplace".

**US-M20-03 — Access**
- **AC-M20-03.1** Given no session, when I open `/admin/marketplace/products`, `/marketplace`, `/marketplace/beg-sekolah-anti-air-premium-vH1Fj` or `/seller/dashboard`, then I am sent to `/login`.
- **AC-M20-03.2** Given pelajar (provisional), when I open `/admin/marketplace/products`, `/admin/marketplace/products/1/edit`, `/admin/marketplace/sellers` or `/admin/marketplace/sellers/1`, then I land on `/dashboard`; `GET /api/admin/marketplace/products` answers 403.
- **AC-M20-03.3** Given pelajar (provisional), when I open `/marketplace`, S7 #1 and `/marketplace/penjual/1`, then each page renders.
- **AC-M20-03.4** Given pelajar, who owns no seller (provisional), when I open `/seller/dashboard`, `/seller/produk`, `/seller/produk/tambah` or `/seller/produk/1/edit`, then I land on `/seller/daftar` (INFERRED).
- **AC-M20-03.5** Given the admin (owner of seller #1), when I open `/seller/daftar`, then I land on `/seller/dashboard`.

**US-M20-04 — Error pages**
- **AC-M20-04.1** Given the admin, when I open `/admin/marketplace/products/999999/edit`, `/admin/marketplace/sellers/999999`, `/marketplace/tiada-produk-zzqxv`, `/marketplace/penjual/999999` or `/seller/produk/999999/edit`, then the global 404 page shows "404", "🔍", "Halaman Tidak Dijumpai", "Maaf, halaman yang anda cari tidak wujud atau telah dipindahkan. Mungkin URL salah taip?", "Halaman Utama", "Mula Latihan".
- **AC-M20-04.2** Given the admin, when I open `/admin/marketplace/products/1` or `/seller/produk/1`, then the global 404 page shows and "Oops! An Error Occurred" is absent (DV-M20-02).
- **AC-M20-04.3** Given the admin, when I open each probed route of §1 (from `/admin/marketplace` to `/penjual/produk`), then the global 404 page shows.

**US-M20-05 — Formats, paging, labels, loading**
- **AC-M20-05.1** Given the admin, when S1 and S6 load, then S1 row 1 reads "RM 89.90"; S6 card #1 reads "-31%", "RM 89.90", "RM 129.90", "Pos / Kurier (RM8.00)"; card #7 "-63%"; card #4 "-28%"; card #6 "-23%"; card #5 shows no badge and no struck price.
- **AC-M20-05.2** Given the admin, when S5 and S8 load at the clock, then S5 reads "Didaftarkan" "09 Feb 2026" and "Disahkan" "09 Feb 2026", and S8 reads "Bergabung 7 bulan yang lepas"; given the clock 2026-10-10T09:00:00+08:00, S8 reads "Bergabung 8 bulan yang lepas" (INFERRED unit wording).
- **AC-M20-05.3** Given the seed (10 products), when S1, S6 and S10 load, then no pager shows; given the test fixture `m20-many` (25 active products of seller #1, provisional), then S1, S6 and S10 show 20 rows on page 1 and a pager whose page-2 link keeps the query (`?category=buku-rujukan&page=2` on S6) (PROPOSED size).
- **AC-M20-05.4** Given the admin, then S1 status badges read "Active", S4 has the card "Verified" and the filter option "Pending", S9 reads "Verified" and "(0 reviews)" (as live).
- **AC-M20-05.5** Given a mock latency of 2 s, when S6 loads, then the shell loading behaviour shows until the grid renders; given a mock fault on the product list API, then the M01 global error convention shows.

**US-M20-06 — Product list (admin)**
- **AC-M20-06.1** Given the admin, when S1 loads, then it shows "10 produk dijumpai", "Tambah Produk" → S2, the search box with placeholder "Cari produk...", the selects "Semua Kategori" (with the 6 categories) and "Semua Status" (Aktif, Draf, Ditolak), the button "Tapis" and no "Reset".
- **AC-M20-06.2** Given the admin, when S1 loads, then 10 row cards show in id order 1 → 10; row 1 reads "Beg Sekolah Anti-Air Premium", "RM 89.90", "JomBelajar Official", views "30", star "0", "Baru", "Active"; row 3 reads "Terpakai"; row 5 views "7"; row 7 views "5"; row 8 views "19".
- **AC-M20-06.3** Given the admin, when I filter category "Buku & Rujukan", then "3 produk dijumpai" and #2, #5, #7; "Peralatan Sekolah" → 2 (#1, #6); "Lain-lain" → 1 (#8); status "Aktif" → 10; search "Beg" → 1 (#1); the chosen values stay selected.
- **AC-M20-06.4** Given the admin, when I filter status "Draf", status "Ditolak", category "Digital & E-Book" or search "zzqxv", then "0 produk dijumpai" and the card "📦" "Tiada Produk" "Tambah produk pertama sekarang!" with "Tambah Produk" → S2 show; when I open `?page=2`, then "10 produk dijumpai" and the same empty card show (DV-M20-05).
- **AC-M20-06.5** Given the admin on S1, then row 1's "Lihat" link targets `/marketplace/beg-sekolah-anti-air-premium-vH1Fj` in a new tab and its "Edit" link opens S3 for #1.

**US-M20-07 — Toggle and delete (admin)**
- **AC-M20-07.1** Given the admin on S1, when I click row 1's "Nyahaktif", then without a confirm #1 becomes draft: row 1 shows the badge "Draft" and the button "Aktifkan" (PROPOSED COPY); status "Aktif" → 9 rows, "Draf" → 1; S6 shows 9 cards; S7 #1 shows the 404 page; S9 "Produk Aktif" reads 9 (INFERRED).
- **AC-M20-07.2** Given AC-M20-07.1 done, when I click row 1's "Aktifkan", then #1 is active again and S6 shows 10 cards.
- **AC-M20-07.3** Given the admin on S1, when I click row 1's trash, then the confirm "Padam produk ini?" shows; Cancel keeps 10 products; OK removes #1: S1 reads "9 produk dijumpai", S9 reads 9 / 9 / 81 / 16, S5 reads "Produk (9)", S6 shows 9 cards and S7 #1 shows the 404 page.

**US-M20-08 — Add product (admin)**
- **AC-M20-08.1** Given the admin, when S2 loads, then it shows "Kembali ke Senarai Produk" → S1; "Penjual" with the options "🏪 PRESTASIPLUS Official (Admin)" (selected) and "JomBelajar Official — Admin Demo ✅" and the hint; "Maklumat Produk" with "Nama Produk *", "Kategori *" ("Pilih Kategori" + 6), "Harga (RM) *", "Harga Asal (RM)" with "Untuk tunjukkan diskaun", "Penerangan", "Keadaan *" ("🆕 Baru", "♻️ Terpakai"), "Status Stok *" ("✅ Ada", "❌ Habis"); "Penghantaran" with the four tiles, "Kos Penghantaran (RM)" (placeholder "Kosongkan jika percuma") and "Lokasi" (placeholder "cth: Kuala Lumpur"); "Gambar Produk" with its two texts, the file input and "Tambah Produk"; on load "🆕 Baru", "✅ Ada" and "Ambil Sendiri" are checked, and only the name, category and price inputs carry `required`.
- **AC-M20-08.2** Given the admin on S2, when I submit with an empty name, with no category chosen or with price "0", then nothing is created and the browser's required / minimum check stops the submit (provisional for the server messages, SRS §8.2).
- **AC-M20-08.3** Given the admin on S2 (provisional), when I choose 6 images, or one GIF, or one JPG of 3 MB, then nothing is created and the form shows the image error of SRS §8.2 (PROPOSED COPY).
- **AC-M20-08.4** Given the admin on S2 (provisional), when I choose seller "JomBelajar Official — Admin Demo ✅", name "Pembaris Plastik 30cm", category "Stationery", price 3.50, original price 5.00, "🆕 Baru", "✅ Ada", "Pos / Kurier", fee 5, location "Shah Alam" and 2 JPG images and click "Tambah Produk", then I land on S1 reading "11 produk dijumpai" with #11 last; S6 shows #11 first with "-30%", "RM 3.50", "RM 5.00", "Pos / Kurier (RM5.00)"; its slug matches `pembaris-plastik-30cm-[A-Za-z0-9]{5}`; S5 reads "Produk (11)"; S9 "Jumlah Produk" reads 11.
- **AC-M20-08.5** Given the admin on S2 (provisional), when I keep "🏪 PRESTASIPLUS Official (Admin)" and create a valid product, then S1 and S6 show the seller "PRESTASIPLUS Official" without a tick, S7's seller card is not a link, and seller #1's counts stay 10 (PROPOSED display).

**US-M20-09 — Edit product (admin)**
- **AC-M20-09.1** Given the admin, when S3 #1 loads, then it shows "Kembali ke Senarai Produk" → S1, "Kemaskini Produk" with the name "Beg Sekolah Anti-Air Premium", category "Peralatan Sekolah" selected (no "Pilih Kategori" option), price 89.9, original 129.9, the description, "🆕 Baru" and "✅ Ada" checked, "Status Produk *" with "🟢 Aktif" checked, "Penghantaran" with "Pos / Kurier" checked, fee 8 and "Kuala Lumpur"; no seller select and no "Untuk tunjukkan diskaun" hint.
- **AC-M20-09.2** Given the admin, when S3 #3, #5 and #9 load, then #3 shows "♻️ Terpakai", "COD" and "Gambar Sedia Ada (5)"; #5 shows an empty original price, "Percuma", "Digital" and "Gambar Sedia Ada (4)"; #9 shows "Ambil Sendiri" and "Gambar Sedia Ada (5)".
- **AC-M20-09.3** Given the admin on S3 #1 (provisional), when I change the price to 79.90 and click "Simpan Perubahan", then I land on S1 and S6 card #1 reads "RM 79.90" and "-38%"; the views stay 30.
- **AC-M20-09.4** Given the admin on S3 #1 (provisional), when I choose "⏸️ Draf" and save, then S1 row 1 shows "Draft", S6 shows 9 cards and S7 #1 shows the 404 page; when I choose "🔴 Ditolak" and save, then row 1 shows "Rejected" and status "Ditolak" → 1 row.

**US-M20-10 — Product images (admin)**
- **AC-M20-10.1** Given the admin on S3 #1, then "Gambar Sedia Ada (4)" shows 4 images, the first with "Utama", each with a × button; when I click the first image's ×, then the confirm "Padam gambar ini?" shows; Cancel changes nothing; OK deletes only that image: S3 reloads with "Gambar Sedia Ada (3)", the former second image carries "Utama", and #1 still exists on S1 and S6 (DV-M20-01).
- **AC-M20-10.2** Given the admin on S3 #1, when I add 1 JPG under "Tambah Gambar Baru" and click "Simpan Perubahan", then the save is submitted (DV-M20-01): S3 #1 shows "Gambar Sedia Ada (5)" and S7 #1 shows 5 thumbnails.
- **AC-M20-10.3** Given the admin on S3 #3 (5 images, provisional), when I add 1 image and save, then nothing is saved and the image error of SRS §8.2 shows (PROPOSED COPY).
- **AC-M20-10.4** Given the admin on S3 #1, when I change only the location to "Ampang" and click "Simpan Perubahan", then S7 #1 shows "Ampang" (DV-M20-01: the button submits the product form).

**US-M20-11 — Seller list (admin)**
- **AC-M20-11.1** Given the admin, when S4 loads, then the cards read "0" "Menunggu Pengesahan", "1" "Aktif", "1" "Jumlah Penjual", "1" "Verified"; the filter shows "Semua Status" (Pending, Aktif, Digantung, Diharamkan) and "Tapis"; the row shows "J", "JomBelajar Official", "Admin Demo · 0100000000", "Active", "10 produk", the eye (→ S5) and the ban button.
- **AC-M20-11.2** Given the admin, when I filter "Pending", "Digantung" or "Diharamkan", then all four cards read "0" and "Tiada penjual dijumpai" shows (DV-M20-04); when I filter "Aktif", then the cards read 0 / 1 / 1 / 1 and the row shows.
- **AC-M20-11.3** Given the admin on S4, when I click the ban button, then the confirm "Haramkan penjual ini?" shows; Cancel changes nothing.

**US-M20-12 — Verify a pending seller (PROPOSED)**
- **AC-M20-12.1** Given pelajar registered shop "Kedai Ujian Demo" (AC-M20-19.3, provisional), when the admin opens S4, then the cards read "1" "Menunggu Pengesahan", "1" "Aktif", "2" "Jumlah Penjual", "1" "Verified" and the new row shows the badge "Pending"; when the admin opens its S5, clicks "Sahkan Penjual" and confirms "Sahkan penjual ini?", then S5 reads "Active" and "Disahkan" "25 Sep 2026", S4 reads 0 / 2 / 2 / 2, and pelajar's products become visible on S6.

**US-M20-13 — Seller review (admin)**
- **AC-M20-13.1** Given the admin, when S5 #1 loads, then it shows "Kembali ke Senarai Penjual" → S4; "Maklumat Perniagaan" with "J", "JomBelajar Official" and the tick, "Active", the description, "Admin Demo", "admin@demo.test", "0100000000" and the WhatsApp link "60100000000" → `https://wa.me/60100000000` (`target="_blank"`, no `rel`); "Dokumen" with "Tiada dokumen dimuat naik".
- **AC-M20-13.2** Given the admin, when S5 #1 loads, then "Produk (10)" lists the 10 products in id order with name and price, and every thumbnail image loads (natural width > 0) (DV-M20-03).
- **AC-M20-13.3** Given the admin, when S5 #1 loads, then "Ringkasan" reads "Jumlah Produk" "10", "Rating" "☆☆☆☆☆", "Ulasan" "0", "Didaftarkan" "09 Feb 2026", "Disahkan" "09 Feb 2026".

**US-M20-14 — Ban a seller (admin)**
- **AC-M20-14.1** Given the admin on S5 #1, when I click "Haramkan Penjual", then the confirm "Haramkan penjual ini? Semua produk akan dinyahaktifkan." shows; Cancel changes nothing.
- **AC-M20-14.2** Given the admin on S5 #1 (provisional), when I confirm the ban, then S5 shows the badge "Banned"; S4 filter "Diharamkan" lists the row and reads 0 / 0 / 1 / 1; S1 shows all 10 rows with "Draft"; S6 shows "Tiada Produk Dijumpai"; `/marketplace/penjual/1` shows the 404 page; S9 reads "Produk Aktif" 0 (INFERRED).
- **AC-M20-14.3** Given the admin on S4 (provisional), when I click the ban button and confirm "Haramkan penjual ini?", then the same effects as AC-M20-14.2 apply.

**US-M20-15 — Browse the marketplace**
- **AC-M20-15.1** Given the admin, when S6 loads, then the search card shows the placeholder "Cari peralatan sekolah...", "Semua Kategori" (6 categories), "Semua Keadaan" (Baru, Terpakai), "Terbaru" selected (Harga ↑, Harga ↓, Popular) and "Cari"; the chips read "Semua" (active, indigo) and the 6 categories, each linking to `/marketplace?category={slug}`.
- **AC-M20-15.2** Given the admin, when S6 loads, then 10 cards show in id order 1 → 10; card #1 reads "-31%", "Beg Sekolah Anti-Air Premium", "JomBelajar Official" with the tick, "RM 89.90", "RM 129.90", "Pos / Kurier (RM8.00)"; card #3 reads "-57%", "Terpakai", "Cash on Delivery (COD)"; card #5 reads "Penghantaran Percuma 🎉"; card #9 reads "Ambil Sendiri (Pickup)"; clicking card #1 opens S7 #1.
- **AC-M20-15.3** Given the admin, when I sort "Harga ↑", then the order is #9, #3, #8, #5, #6, #7, #4, #10, #2, #1; "Harga ↓" gives the reverse; "Popular" gives #1, #8, #2, #3, #10, #5, #9, #4, #7, #6 (the #4 / #7 tie by id, INFERRED).
- **AC-M20-15.4** Given the admin, when I click the chip "Buku & Rujukan", then the URL is `/marketplace?category=buku-rujukan`, the chip is active, and the cards are #7, #5, #2; "Peralatan Sekolah" → #6, #1; "Uniform & Pakaian" → #10, #3; "Stationery" → #9, #4; "Lain-lain" → #8; condition "Terpakai" → #3, #7, #10; "Baru" → 7 cards.
- **AC-M20-15.5** Given the admin, when I search "beg" with "Peralatan Sekolah", "Baru" and "Popular", then 1 card (#1) shows and the four values stay selected.
- **AC-M20-15.6** Given the admin, when I search "zzqxv", choose "Digital & E-Book", open `?page=2`, or combine "Peralatan Sekolah" + "Terpakai" + "Harga ↓", then "🛒" "Tiada Produk Dijumpai" "Cuba tukar kata kunci atau kategori" shows.

**US-M20-16 — Product page**
- **AC-M20-16.1** Given the admin at the clock, when I open S7 #1 for the first time, then it shows "Kembali ke Marketplace" → S6; the main image and 4 thumbnails with the first active; the badges "Baru" and "Peralatan Sekolah"; H1 "Beg Sekolah Anti-Air Premium"; "RM 89.90", "RM 129.90", "-31%"; the description "Beg sekolah kalis air dengan 4 kompartmen, …"; "31 tontonan"; "Ada Stok"; "Pos / Kurier (RM8.00)" and "Kuala Lumpur"; "Hubungi Penjual di WhatsApp" → `/marketplace/beg-sekolah-anti-air-premium-vH1Fj/whatsapp` with `target="_blank"` and no `rel` (no `rel` INFERRED, to be confirmed at G5).
- **AC-M20-16.2** Given S7 #1, when I click the second thumbnail, then the main image becomes the second image, the indigo border moves to it and no network request is made.
- **AC-M20-16.3** Given S7 #1, then the "Penjual" card shows "J", "JomBelajar Official" with the tick, "☆☆☆☆☆", "10 produk" and links to `/marketplace/penjual/1`; "Ulasan (0)" shows "Belum ada ulasan untuk produk ini" and no review form.
- **AC-M20-16.4** Given the admin, then "Produk Berkaitan" on S7 #1 lists only "Kotak Pensel 3 Tingkat Disney Frozen" "RM 22.90"; on S7 #7 "Set Buku Latihan Matematik Tahun 6 (5 Buku)" "RM 45.00" and "E-Book: 1001 Soalan Sains Tingkatan 3 (PDF)" "RM 19.90"; on S7 #5 #2 and "Kamus Dewan Edisi Keempat (Terpakai)" "RM 25.00".
- **AC-M20-16.5** Given the admin at the clock, when I open S7 #5, then it shows no struck price and no badge, "RM 19.90", "Penghantaran Percuma 🎉", "Digital", "8 tontonan"; when I open S7 #7, then it shows "Terpakai", "RM 25.00", "RM 68.00", "-63%", "6 tontonan", "Pos / Kurier (RM10.00)", "Penang" and 5 thumbnails.
- **AC-M20-16.6** Given the admin at the clock, when I open S7 #1 twice, then it reads "31 tontonan" and then "32 tontonan"; S1 row 1 reads "32" and S9 "Jumlah Tontonan" reads 113; opening S1, S6, S8, S9 and S10 changes no view count.

**US-M20-17 — WhatsApp contact**
- **AC-M20-17.1** Given the admin on S7 #1 (provisional), when I click "Hubungi Penjual di WhatsApp", then a new tab opens on the W route, no intermediate screen renders in it (D14) and it is replaced by `https://wa.me/60100000000?text=` + the URL-encoded PROPOSED message naming "Beg Sekolah Anti-Air Premium"; S7 #1 stays open in the original tab; S9 then reads "Klik WhatsApp" 17 and #1's views are unchanged by the hand-off.
- **AC-M20-17.2** Given the admin (provisional), when I click "Hubungi Penjual di WhatsApp" on S7 #1 twice (two new tabs), then S9 reads "Klik WhatsApp" 18.
- **AC-M20-17.3** Given the admin, when I open `/marketplace/tiada-produk-zzqxv/whatsapp`, then the 404 page shows and "Klik WhatsApp" stays 16.

**US-M20-18 — Public shop**
- **AC-M20-18.1** Given the admin at the clock, when S8 #1 loads, then it shows "Kembali ke Marketplace" → S6, "J", H1 "JomBelajar Official" with the tick, the description, "☆☆☆☆☆ (0)", "10 produk" and "Bergabung 7 bulan yang lepas".
- **AC-M20-18.2** Given the admin, when S8 #1 loads, then the grid shows 10 cards in id order, each with image, name, price and struck original (none on #5), no badge and no shipping line; clicking a card opens its S7.

**US-M20-19 — Seller registration (PROPOSED)**
- **AC-M20-19.1** Given the admin, when I open `/seller/daftar`, then I land on S9 (OBSERVED).
- **AC-M20-19.2** Given pelajar (provisional), when I open `/seller/daftar`, then the PROPOSED form shows the header "Daftar Penjual" / "Buka kedai anda di marketplace", "Nama Kedai *", "Penerangan Kedai", "No. Telefon *", "No. WhatsApp *" and "Daftar Sebagai Penjual"; submitting with an empty shop name or a WhatsApp number not starting with "60" shows the field messages of SRS §8.2 and creates nothing.
- **AC-M20-19.3** Given pelajar (provisional), when I submit "Kedai Ujian Demo", "0120000000", "60120000000", then seller #2 is created as pending and I land on S9 reading "Nama:" "Kedai Ujian Demo", "Status:" "Pending", cards 0 / 0 / 0 / 0; a product I add on S11 is listed on S10 but not on S6.
- **AC-M20-19.4** Given AC-M20-19.3 done, when pelajar opens `/seller/daftar` again, then pelajar lands on S9 and no second seller exists (S4 "Jumlah Penjual" 2).

**US-M20-20 — Seller dashboard**
- **AC-M20-20.1** Given the admin at the clock, when S9 loads, then the cards read "10" "Jumlah Produk", "10" "Produk Aktif", "111" "Jumlah Tontonan", "16" "Klik WhatsApp".
- **AC-M20-20.2** Given the admin on S9, then "Tambah Produk" → S11, "Senarai Produk" → S10 and "Lihat Kedai Saya" → `/marketplace/penjual/1` in a new tab (`target="_blank"`, no `rel` — no `rel` INFERRED, to be confirmed at G5).
- **AC-M20-20.3** Given the admin on S9, then "Profil Kedai" reads "Nama:" "JomBelajar Official", "Status:" "Verified", "Rating:" "☆☆☆☆☆" "(0 reviews)", "WhatsApp:" "60100000000".
- **AC-M20-20.4** Given the admin on S9, then "Produk Terbaru" shows 6 cards #1–#6 with views 30, 14, 13, 5, 7, 3 and the badge "Active".

**US-M20-21 — Seller product list**
- **AC-M20-21.1** Given the admin, when S10 loads, then it shows "Dashboard" → S9, "Tambah Produk" → S11 and 10 rows in id order, row 1 reading "Beg Sekolah Anti-Air Premium", "RM 89.90", "30", "0", "Active", with the edit link → `/seller/produk/1/edit` and the trash.
- **AC-M20-21.2** Given the admin on S10, when I click row 1's trash, then the confirm "Padam produk ini?" shows; Cancel keeps 10 rows; OK removes #1 and S10 shows 9 rows; S9 reads 9 / 9 / 81 / 16.
- **AC-M20-21.3** Given the admin, when I open `/seller/produk?page=2`, then "📦" "Belum Ada Produk" "Tambah produk pertama anda sekarang!" and "Tambah Produk" → S11 show.

**US-M20-22 — Seller add product**
- **AC-M20-22.1** Given the admin, when S11 loads, then it shows "Kembali" → S10, "Maklumat Produk" and "Gambar Produk" with the fields, tiles, hints and texts of S2, the button "Tambah Produk", and neither "Penjual" nor "Penghantaran"; on load "🆕 Baru" and "✅ Ada" are checked.
- **AC-M20-22.2** Given the admin on S11 (provisional), when I submit "Pemadam Comel", "Stationery", 2.00, "🆕 Baru", "✅ Ada" and 1 image, then I land on S10 with 11 rows; S6 shows it first with "Ambil Sendiri (Pickup)"; its S7 shows no location line; S9 reads "Jumlah Produk" 11 and "Produk Aktif" 11 (PROPOSED defaults).
- **AC-M20-22.3** Given the admin on S11, when I submit with an empty name, with no category chosen or with price "0", or (provisional) with 6 images, then nothing is created (same rules as AC-M20-08.2 / 08.3).

**US-M20-23 — Seller edit product**
- **AC-M20-23.1** Given the admin, when S12 #1 loads, then it shows "Kembali" → S10, "Kemaskini Produk" prefilled as S3 #1 without "Status Produk" and "Penghantaran", "Gambar Sedia Ada" with 4 images and no "Utama" badge, no × button and no count, "Tambah Gambar Baru" and "Simpan Perubahan".
- **AC-M20-23.2** Given the admin, when S12 #7 loads, then "Gambar Sedia Ada" shows 5 images and "♻️ Terpakai" is checked.
- **AC-M20-23.3** Given the admin on S12 #1 (provisional), when I change the description to "Beg kalis air edisi baharu." and save, then I land on S10 and S7 #1 shows the new description with "Pos / Kurier (RM8.00)" and "Kuala Lumpur" unchanged.
- **AC-M20-23.4** Given pelajar owns seller #2 (fixture `m20-second-seller`, provisional), when pelajar opens `/seller/produk/1/edit` or sends `DELETE /api/seller/products/1`, then the 404 page / `404 NOT_FOUND` results and #1 is unchanged.

**US-M20-24 — Data rules and boundaries**
- **AC-M20-24.1** Given the project clock, then the store holds exactly 10 products (ids 1–10, all active, available, seller 1), 45 images, 6 categories, 1 seller, 0 reviews and 0 documents, and S9 "Jumlah Tontonan" equals the sum of the ten products' views (111).
- **AC-M20-24.2** Given the admin, then S1 filters categories by id (`?category=2`) and S6 by slug (`?category=buku-rujukan`) with the same 3 products; "Digital & E-Book" is empty on both.
- **AC-M20-24.3** Given the admin, when I open `/marketplace/cart`, `/marketplace/pesanan` or `/seller/pesanan`, then the 404 page shows; no screen shows a coin price or a buy button; after a WhatsApp click (AC-M20-17.1), M19 S1 still reads 59 payments and the M14 chips still read "256 koin".
- **AC-M20-24.4** Given the admin, then every row of S1 and S10 shows star "0", S5 / S7 / S9 show "☆☆☆☆☆", S8 "☆☆☆☆☆ (0)" and S9 "(0 reviews)".

**US-M20-25 — Responsive**
- **AC-M20-25.1** Given each of S1–S12 and the registration form at 375, 768 and 1280px, when it loads, then the page has no horizontal scroll (`scrollWidth ≤ clientWidth`) and no content text is below 12px.
- **AC-M20-25.2** Given the admin, then S4 stats have 2 / 4 / 4 columns; S5 has 1 / 2 / 3 layout columns and a product grid of 2 / 3 / 3; S6 and S8 grids 2 / 3 / 4; S7 gallery and details stacked at 375 and side by side at 768 / 1280; S9 stats 2 / 4 / 4 and product grid 2 / 3 / 3; the S2 / S3 / S11 / S12 form grids 2 columns at every width; S3 image grid 4 columns at every width (375 / 768 / 1280).

---

## 5. UI expectations

| Screen | Key states (screenshots in `docs/discovery/img/M20/`) | Behaviour notes (per-width detail in SRS §10) |
|---|---|---|
| S1 | default, filters, empty, page 2 (`admin-products-desktop/-tablet/-mobile.png`, `admin-products-empty.png`) | row cards stack text + 4 icon actions at every width; no table. |
| S2 | default (`admin-product-create-desktop/-tablet/-mobile.png`) | 2-column form grids at every width (price / original side by side). |
| S3 | #1, #3, #5, #9, 404, 405 → 404 (`admin-product-edit-*.png`, `admin-product-show-405.png`) | image grid 4 columns at every width; × on hover; forms separated (DV-M20-01). |
| S4 | default, filters, empty (`admin-sellers-*.png`, `admin-sellers-empty.png`) | stats 2 columns at 375, 4 from 768. |
| S5 | #1, 404 (`admin-seller-show-*.png`) | 1 / 2 / 3 (2 + 1) columns; product grid 2 / 3 / 3; thumbnails fixed (DV-M20-03). |
| S6 | default, category, empty (`marketplace-*.png`) | grid 2 / 3 / 4; prices wrap "RM" / amount at 375 as live; header subtitle truncated by the shell at 375 as live. |
| S7 | #1, thumbnail 2, #7 used, #5 no discount, 404 (`product-*.png`) | stacked at 375, 2 columns from 768; H1 24 px. |
| S8 | #1, 404 (`shop-*.png`) | grid 2 / 3 / 4; decorative circle clipped. |
| S9 | default (`seller-dashboard-*.png`) | stats 2 / 4 / 4, product grid 2 / 3 / 3. |
| S10 | default, empty (`seller-products-*.png`) | as S1. |
| S11 / S12 | default, #7 (`seller-product-create-*.png`, `seller-product-edit-*.png`) | as S2 / S3 without the missing cards. |
| Registration (PROPOSED) | form, errors | single card, fields stacked, centred max width; no horizontal scroll. |

Loading: every data view shows the shared shell loading behaviour while the mock responds (M01 convention; live pages are server-rendered). A mock failure uses the global error convention of M01; confirms are the browser `confirm()` dialogs as live.

---

## 6. Coverage matrix (completeness proof)

Source: `docs/discovery/inventory/M20/` (generated 2026-09-27; 12 screens, 70 captured states). Compiled from the inventory JSON element by element; `coverage.cjs` in the writer's scratchpad `m20-writer/` re-checks it (every inventory id has exactly one row; every "Covered by" is an existing Function or an exclusion). Every M20 content element (S1–S12) is listed with the Function that covers it or with a concrete exclusion reason. The two shells (SHA, SHU) are chrome owned by the global shell (design/shells.md, M23 and the owning modules): **all their elements are excluded**, and the 35 of them that render an M20 menu entry or an M20 header title name the Function that specifies it (FN-M20-1.1.1–1.1.3). "Content" quotes the DOM text as captured (`<name>`, `<masked>`, `<digits:n>` = discovery masks; row lists are sampled, discovery `meta.repeats`). Figures in "Content" are the live post-discovery readings (e.g. views "33"); the rebuild shows the seed values (§7.1).

**Summary**

| Set | Elements | Mapped to an M20 Function | Excluded (with reason) | Unmapped |
|---|---|---|---|---|
| S1 — `/admin/marketplace/products` | 81 | 81 | 0 | 0 |
| S2 — `/admin/marketplace/products/create` | 58 | 58 | 0 | 0 |
| S3 — `/admin/marketplace/products/{id}/edit` | 100 | 100 | 0 | 0 |
| S4 — `/admin/marketplace/sellers` | 29 | 29 | 0 | 0 |
| S5 — `/admin/marketplace/sellers/{id}` | 70 | 70 | 0 | 0 |
| S6 — `/marketplace` | 49 | 46 | 3 | 0 |
| S7 — `/marketplace/{slug}` | 72 | 69 | 3 | 0 |
| S8 — `/marketplace/penjual/{id}` | 27 | 24 | 3 | 0 |
| S9 — `/seller/dashboard` | 66 | 63 | 3 | 0 |
| S10 — `/seller/produk` | 46 | 43 | 3 | 0 |
| S11 — `/seller/produk/tambah` | 39 | 36 | 3 | 0 |
| S12 — `/seller/produk/{id}/edit` | 54 | 51 | 3 | 0 |
| **M20 content (S1–S12)** | **691** | **670** | **21** (M16 tournament banner "LIVE:", "MAIN", "DAFTAR" on the seven user-shell screens, EL S6–S12 -001–003) | **0** |
| SHA — admin-panel shell (chrome of S1–S5) | 212 | 0 | 212 (global shell chrome; 16 of them render an M20 menu entry or header title that FN-M20-1.1.1 / 1.1.3 specify) | 0 |
| SHU — user-portal shell (chrome of S6–S12) | 383 | 0 | 383 (global shell chrome; 19 of them render an M20 menu entry or header title that FN-M20-1.1.2 / 1.1.3 specify) | 0 |

**691/691 M20 content elements covered (670 mapped, 21 excluded with reason), 0 unmapped.** Including the shells: 1,286/1,286 elements accounted for (670 mapped, 616 excluded with reason), 0 unmapped. 61 of the 96 Functions appear in this matrix; the other 35 (including FN-M20-1.1.6, the user-approved "Kedai Saya" link, which has no live element) are behaviour-only Functions (shell entries rendered by the global shell, access rules, formats, data rules, unobservable or PROPOSED states).

### 6.1 M20 content elements

#### S1 — `/admin/marketplace/products` (81 elements)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M20-S1-001 | text | visible-default | "10 produk dijumpai" | FN-M20-2.1.1 |
| EL-M20-S1-002 | link | visible-default | "Tambah Produk", → /admin/marketplace/products/create, fa-plus-circle | FN-M20-2.1.1 |
| EL-M20-S1-003 | form | visible-default | GET, fields q, category, status | FN-M20-2.1.2 |
| EL-M20-S1-004 | input | visible-default | name=q, placeholder "Cari produk..." | FN-M20-2.1.2 |
| EL-M20-S1-005 | select | visible-default | name=category, "" "Semua Kategori", 1–6 categories | FN-M20-2.1.2 |
| EL-M20-S1-006 | select | visible-default | name=status, "" "Semua Status", active "Aktif", draft "Draf", rejected "Ditolak" | FN-M20-2.1.2 |
| EL-M20-S1-007 | button | visible-default | "Tapis", fa-filter | FN-M20-2.1.2 |
| EL-M20-S1-008 | card | visible-default | "Beg Sekolah Anti-Air Premium" | FN-M20-2.1.4 |
| EL-M20-S1-009 | image | visible-default | /uploads/products/1/img_2_…jpg | FN-M20-2.1.4 |
| EL-M20-S1-010 | heading | visible-default | "Beg Sekolah Anti-Air Premium" | FN-M20-2.1.4 |
| EL-M20-S1-011 | text | visible-default | "RM 89.90" | FN-M20-2.1.4 |
| EL-M20-S1-012 | text | visible-default | "JomBelajar Official", fa-store | FN-M20-2.1.4 |
| EL-M20-S1-013 | text | visible-default | "33", fa-eye | FN-M20-2.1.4 |
| EL-M20-S1-014 | text | visible-default | "0", fa-star | FN-M20-2.1.4 |
| EL-M20-S1-015 | badge | visible-default | "Baru" | FN-M20-2.1.4 |
| EL-M20-S1-016 | badge | visible-default | "Active" | FN-M20-2.1.4 |
| EL-M20-S1-017 | link | visible-default | → /marketplace/beg-sekolah-anti-air-premium-vH1Fj, target _blank, fa-external-link-alt, title "Lihat" | FN-M20-2.1.5 |
| EL-M20-S1-018 | form | visible-default | POST …/products/1/toggle | FN-M20-2.1.6 |
| EL-M20-S1-019 | hidden-field | hidden-only | name=_token | FN-M20-2.1.6 |
| EL-M20-S1-020 | button | visible-default | fa-pause, title "Nyahaktif" | FN-M20-2.1.6 |
| EL-M20-S1-021 | link | visible-default | → /admin/marketplace/products/1/edit, fa-edit, title "Edit" | FN-M20-2.1.5 |
| EL-M20-S1-022 | form | visible-default | POST …/products/1 (_method DELETE) | FN-M20-2.1.7 |
| EL-M20-S1-023 | hidden-field | hidden-only | name=_token | FN-M20-2.1.7 |
| EL-M20-S1-024 | hidden-field | hidden-only | name=_method | FN-M20-2.1.7 |
| EL-M20-S1-025 | button | visible-default | fa-trash, title "Padam" | FN-M20-2.1.7 |
| EL-M20-S1-026 | card | visible-default | "Set Buku Latihan Matematik Tahun 6 (5 Buku)" | FN-M20-2.1.4 |
| EL-M20-S1-027 | image | visible-default | image | FN-M20-2.1.4 |
| EL-M20-S1-028 | heading | visible-default | "Set Buku Latihan Matematik Tahun 6 (5 Buku)" | FN-M20-2.1.4 |
| EL-M20-S1-029 | text | visible-default | "RM 45.00" | FN-M20-2.1.4 |
| EL-M20-S1-030 | text | visible-default | "JomBelajar Official", fa-store | FN-M20-2.1.4 |
| EL-M20-S1-031 | text | visible-default | "14", fa-eye | FN-M20-2.1.4 |
| EL-M20-S1-032 | text | visible-default | "0", fa-star | FN-M20-2.1.4 |
| EL-M20-S1-033 | badge | visible-default | "Baru" | FN-M20-2.1.4 |
| EL-M20-S1-034 | badge | visible-default | "Active" | FN-M20-2.1.4 |
| EL-M20-S1-035 | link | visible-default | → /marketplace/set-buku-latihan-matematik-tahun-6-5-buku-PAjPe, fa-external-link-alt, title "Lihat" | FN-M20-2.1.5 |
| EL-M20-S1-036 | form | visible-default | POST …/products/2/toggle | FN-M20-2.1.6 |
| EL-M20-S1-037 | hidden-field | hidden-only | name=_token | FN-M20-2.1.6 |
| EL-M20-S1-038 | button | visible-default | fa-pause, title "Nyahaktif" | FN-M20-2.1.6 |
| EL-M20-S1-039 | link | visible-default | → /admin/marketplace/products/2/edit, fa-edit, title "Edit" | FN-M20-2.1.5 |
| EL-M20-S1-040 | form | visible-default | POST …/products/2 (_method DELETE) | FN-M20-2.1.7 |
| EL-M20-S1-041 | hidden-field | hidden-only | name=_token | FN-M20-2.1.7 |
| EL-M20-S1-042 | hidden-field | hidden-only | name=_method | FN-M20-2.1.7 |
| EL-M20-S1-043 | button | visible-default | fa-trash, title "Padam" | FN-M20-2.1.7 |
| EL-M20-S1-044 | card | visible-default | "Uniform Sekolah Baju Putih Lengan Panjang (Saiz M)" | FN-M20-2.1.4 |
| EL-M20-S1-045 | image | visible-default | image | FN-M20-2.1.4 |
| EL-M20-S1-046 | heading | visible-default | "Uniform Sekolah Baju Putih Lengan Panjang (Saiz M)" | FN-M20-2.1.4 |
| EL-M20-S1-047 | text | visible-default | "RM 15.00" | FN-M20-2.1.4 |
| EL-M20-S1-048 | text | visible-default | "JomBelajar Official", fa-store | FN-M20-2.1.4 |
| EL-M20-S1-049 | text | visible-default | "13", fa-eye | FN-M20-2.1.4 |
| EL-M20-S1-050 | text | visible-default | "0", fa-star | FN-M20-2.1.4 |
| EL-M20-S1-051 | badge | visible-default | "Terpakai" | FN-M20-2.1.4 |
| EL-M20-S1-052 | badge | visible-default | "Active" | FN-M20-2.1.4 |
| EL-M20-S1-053 | link | visible-default | → /marketplace/uniform-sekolah-baju-putih-lengan-panjang-saiz-m-hE8Jf, fa-external-link-alt, title "Lihat" | FN-M20-2.1.5 |
| EL-M20-S1-054 | form | visible-default | POST …/products/3/toggle | FN-M20-2.1.6 |
| EL-M20-S1-055 | hidden-field | hidden-only | name=_token | FN-M20-2.1.6 |
| EL-M20-S1-056 | button | visible-default | fa-pause, title "Nyahaktif" | FN-M20-2.1.6 |
| EL-M20-S1-057 | link | visible-default | → /admin/marketplace/products/3/edit, fa-edit, title "Edit" | FN-M20-2.1.5 |
| EL-M20-S1-058 | form | visible-default | POST …/products/3 (_method DELETE) | FN-M20-2.1.7 |
| EL-M20-S1-059 | hidden-field | hidden-only | name=_token | FN-M20-2.1.7 |
| EL-M20-S1-060 | hidden-field | hidden-only | name=_method | FN-M20-2.1.7 |
| EL-M20-S1-061 | button | visible-default | fa-trash, title "Padam" | FN-M20-2.1.7 |
| EL-M20-S1-062 | text | conditional | "3 produk dijumpai" | FN-M20-2.1.1 |
| EL-M20-S1-063 | card | conditional | "E-Book: 1001 Soalan Sains Tingkatan 3 (PDF)" | FN-M20-2.1.4 |
| EL-M20-S1-064 | heading | conditional | "E-Book: 1001 Soalan Sains Tingkatan 3 (PDF)" | FN-M20-2.1.4 |
| EL-M20-S1-065 | text | conditional | "RM 19.90" | FN-M20-2.1.4 |
| EL-M20-S1-066 | link | conditional | → /marketplace/e-book-1001-soalan-sains-tingkatan-3-pdf-tqd84, fa-external-link-alt, title "Lihat" | FN-M20-2.1.5 |
| EL-M20-S1-067 | card | conditional | "Kamus Dewan Edisi Keempat (Terpakai)" | FN-M20-2.1.4 |
| EL-M20-S1-068 | heading | conditional | "Kamus Dewan Edisi Keempat (Terpakai)" | FN-M20-2.1.4 |
| EL-M20-S1-069 | text | conditional | "RM 25.00" | FN-M20-2.1.4 |
| EL-M20-S1-070 | link | conditional | → /marketplace/kamus-dewan-edisi-keempat-terpakai-8axTV, fa-external-link-alt, title "Lihat" | FN-M20-2.1.5 |
| EL-M20-S1-071 | text | conditional | "1 produk dijumpai" | FN-M20-2.1.1 |
| EL-M20-S1-072 | card | conditional | "Botol Air 750ml BPA Free (Biru)" | FN-M20-2.1.4 |
| EL-M20-S1-073 | heading | conditional | "Botol Air 750ml BPA Free (Biru)" | FN-M20-2.1.4 |
| EL-M20-S1-074 | text | conditional | "RM 18.90" | FN-M20-2.1.4 |
| EL-M20-S1-075 | link | conditional | → /marketplace/botol-air-750ml-bpa-free-biru-KEz9H, fa-external-link-alt, title "Lihat" | FN-M20-2.1.5 |
| EL-M20-S1-076 | card | conditional | "Tiada Produk" | FN-M20-2.1.9 |
| EL-M20-S1-077 | text | conditional | "📦" | FN-M20-2.1.9 |
| EL-M20-S1-078 | heading | conditional | "Tiada Produk" | FN-M20-2.1.9 |
| EL-M20-S1-079 | text | conditional | "Tambah produk pertama sekarang!" | FN-M20-2.1.9 |
| EL-M20-S1-080 | link | conditional | "Tambah Produk", → /admin/marketplace/products/create, fa-plus-circle | FN-M20-2.1.9 |
| EL-M20-S1-081 | text | conditional | "0 produk dijumpai" | FN-M20-2.1.1 |

#### S2 — `/admin/marketplace/products/create` (58 elements)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M20-S2-001 | link | visible-default | "Kembali ke Senarai Produk", → /admin/marketplace/products, fa-arrow-left | FN-M20-2.2.1 |
| EL-M20-S2-002 | form | visible-default | POST /admin/marketplace/products (multipart) | FN-M20-2.2.1 |
| EL-M20-S2-003 | hidden-field | hidden-only | name=_token | FN-M20-2.2.1 |
| EL-M20-S2-004 | card | visible-default | "Penjual" | FN-M20-2.2.2 |
| EL-M20-S2-005 | heading | visible-default | "Penjual" | FN-M20-2.2.2 |
| EL-M20-S2-006 | select | visible-default | name=seller_id, "" "🏪 PRESTASIPLUS Official (Admin)", 1 "JomBelajar Official — Admin PRESTASI+ ✅" | FN-M20-2.2.2 |
| EL-M20-S2-007 | empty-state | visible-default | "Kosongkan untuk jual sebagai "PRESTASIPLUS Official"" | FN-M20-2.2.2 |
| EL-M20-S2-008 | card | visible-default | "Maklumat Produk" | FN-M20-2.2.3 |
| EL-M20-S2-009 | heading | visible-default | "Maklumat Produk" | FN-M20-2.2.3 |
| EL-M20-S2-010 | label | visible-default | "Nama Produk *" | FN-M20-2.2.3 |
| EL-M20-S2-011 | input | visible-default | name=name, type text | FN-M20-2.2.3 |
| EL-M20-S2-012 | label | visible-default | "Kategori *" | FN-M20-2.2.3 |
| EL-M20-S2-013 | select | visible-default | name=category_id | FN-M20-2.2.3 |
| EL-M20-S2-014 | label | visible-default | "Harga (RM) *" | FN-M20-2.2.3 |
| EL-M20-S2-015 | input | visible-default | name=price, type number | FN-M20-2.2.3 |
| EL-M20-S2-016 | label | visible-default | "Harga Asal (RM)" | FN-M20-2.2.3 |
| EL-M20-S2-017 | input | visible-default | name=original_price, type number | FN-M20-2.2.3 |
| EL-M20-S2-018 | text | visible-default | "Untuk tunjukkan diskaun" | FN-M20-2.2.3 |
| EL-M20-S2-019 | label | visible-default | "Penerangan" | FN-M20-2.2.3 |
| EL-M20-S2-020 | textarea | visible-default | name=description | FN-M20-2.2.3 |
| EL-M20-S2-021 | label | visible-default | "Keadaan *" | FN-M20-2.2.4 |
| EL-M20-S2-022 | label | visible-default | "🆕 Baru" | FN-M20-2.2.4 |
| EL-M20-S2-023 | radio | hidden-only | name=condition, value new, checked on load | FN-M20-2.2.4 |
| EL-M20-S2-024 | alert | visible-default | "🆕 Baru" | FN-M20-2.2.4 |
| EL-M20-S2-025 | label | visible-default | "♻️ Terpakai" | FN-M20-2.2.4 |
| EL-M20-S2-026 | radio | hidden-only | name=condition | FN-M20-2.2.4 |
| EL-M20-S2-027 | alert | visible-default | "♻️ Terpakai" | FN-M20-2.2.4 |
| EL-M20-S2-028 | label | visible-default | "Status Stok *" | FN-M20-2.2.4 |
| EL-M20-S2-029 | label | visible-default | "✅ Ada" | FN-M20-2.2.4 |
| EL-M20-S2-030 | radio | hidden-only | name=stock_status, value available, checked on load | FN-M20-2.2.4 |
| EL-M20-S2-031 | alert | visible-default | "✅ Ada" | FN-M20-2.2.4 |
| EL-M20-S2-032 | label | visible-default | "❌ Habis" | FN-M20-2.2.4 |
| EL-M20-S2-033 | radio | hidden-only | name=stock_status | FN-M20-2.2.4 |
| EL-M20-S2-034 | alert | visible-default | "❌ Habis" | FN-M20-2.2.4 |
| EL-M20-S2-035 | card | visible-default | "Penghantaran" | FN-M20-2.2.5 |
| EL-M20-S2-036 | heading | visible-default | "Penghantaran" | FN-M20-2.2.5 |
| EL-M20-S2-037 | label | visible-default | "Kaedah Penghantaran *" | FN-M20-2.2.5 |
| EL-M20-S2-038 | label | visible-default | "Ambil Sendiri" | FN-M20-2.2.5 |
| EL-M20-S2-039 | radio | hidden-only | name=shipping_method, value pickup, checked on load | FN-M20-2.2.5 |
| EL-M20-S2-040 | alert | visible-default | "Ambil Sendiri", fa-map-marker-alt | FN-M20-2.2.5 |
| EL-M20-S2-041 | label | visible-default | "Pos / Kurier" | FN-M20-2.2.5 |
| EL-M20-S2-042 | radio | hidden-only | name=shipping_method | FN-M20-2.2.5 |
| EL-M20-S2-043 | label | visible-default | "COD" | FN-M20-2.2.5 |
| EL-M20-S2-044 | radio | hidden-only | name=shipping_method | FN-M20-2.2.5 |
| EL-M20-S2-045 | alert | visible-default | "COD", fa-hand-holding-usd | FN-M20-2.2.5 |
| EL-M20-S2-046 | label | visible-default | "Percuma" | FN-M20-2.2.5 |
| EL-M20-S2-047 | radio | hidden-only | name=shipping_method | FN-M20-2.2.5 |
| EL-M20-S2-048 | alert | visible-default | "Percuma", fa-gift | FN-M20-2.2.5 |
| EL-M20-S2-049 | label | visible-default | "Kos Penghantaran (RM)" | FN-M20-2.2.5 |
| EL-M20-S2-050 | input | visible-default | name=shipping_fee, type number, placeholder "Kosongkan jika percuma" | FN-M20-2.2.5 |
| EL-M20-S2-051 | label | visible-default | "Lokasi" | FN-M20-2.2.5 |
| EL-M20-S2-052 | input | visible-default | name=location, placeholder "cth: Kuala Lumpur" | FN-M20-2.2.5 |
| EL-M20-S2-053 | card | visible-default | "Gambar Produk" | FN-M20-2.2.6 |
| EL-M20-S2-054 | heading | visible-default | "Gambar Produk" | FN-M20-2.2.6 |
| EL-M20-S2-055 | text | visible-default | "Muat naik sehingga 5 gambar. Gambar pertama jadi gambar utama." | FN-M20-2.2.6 |
| EL-M20-S2-056 | input | visible-default | name=images[], type file | FN-M20-2.2.6 |
| EL-M20-S2-057 | text | visible-default | "JPG, PNG, WEBP. Maks 2MB setiap gambar." | FN-M20-2.2.6 |
| EL-M20-S2-058 | button | visible-default | "Tambah Produk", fa-plus-circle | FN-M20-2.2.6 |

#### S3 — `/admin/marketplace/products/{id}/edit` (100 elements)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M20-S3-001 | link | visible-default | "Kembali ke Senarai Produk", → /admin/marketplace/products, fa-arrow-left | FN-M20-2.3.1 |
| EL-M20-S3-002 | form | visible-default | POST /admin/marketplace/products/1 | FN-M20-2.3.1 |
| EL-M20-S3-003 | hidden-field | hidden-only | name=_token | FN-M20-2.3.1 |
| EL-M20-S3-004 | hidden-field | hidden-only | name=_method | FN-M20-2.3.1 |
| EL-M20-S3-005 | card | visible-default | "Kemaskini Produk" | FN-M20-2.3.2 |
| EL-M20-S3-006 | heading | visible-default | "Kemaskini Produk" | FN-M20-2.3.2 |
| EL-M20-S3-007 | label | visible-default | "Nama Produk *" | FN-M20-2.3.2 |
| EL-M20-S3-008 | input | visible-default | name=name, type text | FN-M20-2.3.2 |
| EL-M20-S3-009 | label | visible-default | "Kategori *" | FN-M20-2.3.2 |
| EL-M20-S3-010 | select | visible-default | name=category_id | FN-M20-2.3.2 |
| EL-M20-S3-011 | label | visible-default | "Harga (RM) *" | FN-M20-2.3.2 |
| EL-M20-S3-012 | input | visible-default | name=price, type number | FN-M20-2.3.2 |
| EL-M20-S3-013 | label | visible-default | "Harga Asal (RM)" | FN-M20-2.3.2 |
| EL-M20-S3-014 | input | visible-default | name=original_price, type number | FN-M20-2.3.2 |
| EL-M20-S3-015 | label | visible-default | "Penerangan" | FN-M20-2.3.2 |
| EL-M20-S3-016 | textarea | visible-default | name=description | FN-M20-2.3.2 |
| EL-M20-S3-017 | label | visible-default | "Keadaan *" | FN-M20-2.3.2 |
| EL-M20-S3-018 | label | visible-default | "🆕 Baru" | FN-M20-2.3.2 |
| EL-M20-S3-019 | radio | hidden-only | name=condition | FN-M20-2.3.2 |
| EL-M20-S3-020 | alert | visible-default | "🆕 Baru" | FN-M20-2.3.2 |
| EL-M20-S3-021 | label | visible-default | "♻️ Terpakai" | FN-M20-2.3.2 |
| EL-M20-S3-022 | radio | hidden-only | name=condition | FN-M20-2.3.2 |
| EL-M20-S3-023 | alert | visible-default | "♻️ Terpakai" | FN-M20-2.3.2 |
| EL-M20-S3-024 | label | visible-default | "Status Stok *" | FN-M20-2.3.2 |
| EL-M20-S3-025 | label | visible-default | "✅ Ada" | FN-M20-2.3.2 |
| EL-M20-S3-026 | radio | hidden-only | name=stock_status | FN-M20-2.3.2 |
| EL-M20-S3-027 | alert | visible-default | "✅ Ada" | FN-M20-2.3.2 |
| EL-M20-S3-028 | label | visible-default | "❌ Habis" | FN-M20-2.3.2 |
| EL-M20-S3-029 | radio | hidden-only | name=stock_status | FN-M20-2.3.2 |
| EL-M20-S3-030 | alert | visible-default | "❌ Habis" | FN-M20-2.3.2 |
| EL-M20-S3-031 | label | visible-default | "Status Produk *" | FN-M20-2.3.3 |
| EL-M20-S3-032 | label | visible-default | "🟢 Aktif" | FN-M20-2.3.3 |
| EL-M20-S3-033 | radio | hidden-only | name=status | FN-M20-2.3.3 |
| EL-M20-S3-034 | alert | visible-default | "🟢 Aktif" | FN-M20-2.3.3 |
| EL-M20-S3-035 | label | visible-default | "⏸️ Draf" | FN-M20-2.3.3 |
| EL-M20-S3-036 | radio | hidden-only | name=status | FN-M20-2.3.3 |
| EL-M20-S3-037 | label | visible-default | "🔴 Ditolak" | FN-M20-2.3.3 |
| EL-M20-S3-038 | radio | hidden-only | name=status | FN-M20-2.3.3 |
| EL-M20-S3-039 | alert | visible-default | "🔴 Ditolak" | FN-M20-2.3.3 |
| EL-M20-S3-040 | card | visible-default | "Penghantaran" | FN-M20-2.3.4 |
| EL-M20-S3-041 | heading | visible-default | "Penghantaran" | FN-M20-2.3.4 |
| EL-M20-S3-042 | label | visible-default | "Kaedah Penghantaran *" | FN-M20-2.3.4 |
| EL-M20-S3-043 | label | visible-default | "Ambil Sendiri" | FN-M20-2.3.4 |
| EL-M20-S3-044 | radio | hidden-only | name=shipping_method | FN-M20-2.3.4 |
| EL-M20-S3-045 | alert | visible-default | "Ambil Sendiri", fa-map-marker-alt | FN-M20-2.3.4 |
| EL-M20-S3-046 | label | visible-default | "Pos / Kurier" | FN-M20-2.3.4 |
| EL-M20-S3-047 | radio | hidden-only | name=shipping_method | FN-M20-2.3.4 |
| EL-M20-S3-048 | label | visible-default | "COD" | FN-M20-2.3.4 |
| EL-M20-S3-049 | radio | hidden-only | name=shipping_method | FN-M20-2.3.4 |
| EL-M20-S3-050 | alert | visible-default | "COD", fa-hand-holding-usd | FN-M20-2.3.4 |
| EL-M20-S3-051 | label | visible-default | "Percuma" | FN-M20-2.3.4 |
| EL-M20-S3-052 | radio | hidden-only | name=shipping_method | FN-M20-2.3.4 |
| EL-M20-S3-053 | alert | visible-default | "Percuma", fa-gift | FN-M20-2.3.4 |
| EL-M20-S3-054 | label | visible-default | "Kos Penghantaran (RM)" | FN-M20-2.3.4 |
| EL-M20-S3-055 | input | visible-default | name=shipping_fee, type number, placeholder "Kosongkan jika percuma" | FN-M20-2.3.4 |
| EL-M20-S3-056 | label | visible-default | "Lokasi" | FN-M20-2.3.4 |
| EL-M20-S3-057 | input | visible-default | name=location, placeholder "cth: Kuala Lumpur" | FN-M20-2.3.4 |
| EL-M20-S3-058 | card | visible-default | "Gambar Sedia Ada (4)" | FN-M20-2.3.5 |
| EL-M20-S3-059 | heading | visible-default | "Gambar Sedia Ada (4)" | FN-M20-2.3.5 |
| EL-M20-S3-060 | image | visible-default | image 1 of #1 | FN-M20-2.3.5 |
| EL-M20-S3-061 | text | visible-default | "Utama" | FN-M20-2.3.5 |
| EL-M20-S3-062 | hidden-field | hidden-only | name=_token (image 1, merged into the product form by D-M20-01) | FN-M20-2.3.5 |
| EL-M20-S3-063 | hidden-field | hidden-only | name=_method (DELETE, merged into the product form by D-M20-01) | FN-M20-2.3.5 |
| EL-M20-S3-064 | button | visible-default | fa-times (image 1) | FN-M20-2.3.5 |
| EL-M20-S3-065 | image | visible-default | image 2 | FN-M20-2.3.5 |
| EL-M20-S3-066 | form | hidden-only | POST …/products/image/2 | FN-M20-2.3.5 |
| EL-M20-S3-067 | hidden-field | hidden-only | name=_token | FN-M20-2.3.5 |
| EL-M20-S3-068 | hidden-field | hidden-only | name=_method | FN-M20-2.3.5 |
| EL-M20-S3-069 | button | visible-default | fa-times | FN-M20-2.3.5 |
| EL-M20-S3-070 | image | visible-default | image 3 | FN-M20-2.3.5 |
| EL-M20-S3-071 | form | hidden-only | POST …/products/image/3 | FN-M20-2.3.5 |
| EL-M20-S3-072 | hidden-field | hidden-only | name=_token | FN-M20-2.3.5 |
| EL-M20-S3-073 | hidden-field | hidden-only | name=_method | FN-M20-2.3.5 |
| EL-M20-S3-074 | button | visible-default | fa-times | FN-M20-2.3.5 |
| EL-M20-S3-075 | image | visible-default | image 4 | FN-M20-2.3.5 |
| EL-M20-S3-076 | form | hidden-only | POST …/products/image/4 | FN-M20-2.3.5 |
| EL-M20-S3-077 | hidden-field | hidden-only | name=_token | FN-M20-2.3.5 |
| EL-M20-S3-078 | hidden-field | hidden-only | name=_method | FN-M20-2.3.5 |
| EL-M20-S3-079 | button | visible-default | fa-times | FN-M20-2.3.5 |
| EL-M20-S3-080 | card | visible-default | "Tambah Gambar Baru" | FN-M20-2.3.6 |
| EL-M20-S3-081 | heading | visible-default | "Tambah Gambar Baru" | FN-M20-2.3.6 |
| EL-M20-S3-082 | input | visible-default | name=images[], type file (outside every form on live, D-M20-01) | FN-M20-2.3.6 |
| EL-M20-S3-083 | button | visible-default | "Simpan Perubahan", fa-save (outside every form on live, D-M20-01) | FN-M20-2.3.6 |
| EL-M20-S3-084 | text | conditional | "404" | FN-M20-1.2.4 |
| EL-M20-S3-085 | text | conditional | "🔍" | FN-M20-1.2.4 |
| EL-M20-S3-086 | heading | conditional | "Halaman Tidak Dijumpai" | FN-M20-1.2.4 |
| EL-M20-S3-087 | text | conditional | "Maaf, halaman yang anda cari tidak wujud atau telah dipindahkan. Mungkin URL salah taip?" | FN-M20-1.2.4 |
| EL-M20-S3-088 | link | conditional | "Halaman Utama", → / | FN-M20-1.2.4 |
| EL-M20-S3-089 | link | conditional | "Mula Latihan", → /latih-tubi | FN-M20-1.2.4 |
| EL-M20-S3-090 | text | conditional | "PRESTASIPLUS" | FN-M20-1.2.4 |
| EL-M20-S3-091 | card | conditional | "Gambar Sedia Ada (5)" | FN-M20-2.3.5 |
| EL-M20-S3-092 | heading | conditional | "Gambar Sedia Ada (5)" | FN-M20-2.3.5 |
| EL-M20-S3-093 | image | conditional | image 5 | FN-M20-2.3.5 |
| EL-M20-S3-094 | form | hidden-only | POST …/products/image/40 | FN-M20-2.3.5 |
| EL-M20-S3-095 | hidden-field | hidden-only | name=_token | FN-M20-2.3.5 |
| EL-M20-S3-096 | hidden-field | hidden-only | name=_method | FN-M20-2.3.5 |
| EL-M20-S3-097 | button | conditional | fa-times | FN-M20-2.3.5 |
| EL-M20-S3-098 | heading | conditional | "Oops! An Error Occurred" | FN-M20-1.2.5 |
| EL-M20-S3-099 | heading | conditional | "The server returned a "405 Method Not Allowed"." | FN-M20-1.2.5 |
| EL-M20-S3-100 | text | conditional | "Something is broken. Please let us know what you were doing when this error occurred. We will fix it as soon as possible. Sorry for any inconvenience caused." | FN-M20-1.2.5 |

#### S4 — `/admin/marketplace/sellers` (29 elements)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M20-S4-001 | card | visible-default | "0" | FN-M20-3.1.1 |
| EL-M20-S4-002 | text | visible-default | "0" | FN-M20-3.1.1 |
| EL-M20-S4-003 | text | visible-default | "Menunggu Pengesahan" | FN-M20-3.1.1 |
| EL-M20-S4-004 | card | visible-default | "1" | FN-M20-3.1.1 |
| EL-M20-S4-005 | text | visible-default | "1" | FN-M20-3.1.1 |
| EL-M20-S4-006 | text | visible-default | "Aktif" | FN-M20-3.1.1 |
| EL-M20-S4-007 | card | visible-default | "1" | FN-M20-3.1.1 |
| EL-M20-S4-008 | text | visible-default | "1" | FN-M20-3.1.1 |
| EL-M20-S4-009 | text | visible-default | "Jumlah Penjual" | FN-M20-3.1.1 |
| EL-M20-S4-010 | card | visible-default | "1" | FN-M20-3.1.1 |
| EL-M20-S4-011 | text | visible-default | "1" | FN-M20-3.1.1 |
| EL-M20-S4-012 | text | visible-default | "Verified" | FN-M20-3.1.1 |
| EL-M20-S4-013 | form | visible-default | GET | FN-M20-3.1.2 |
| EL-M20-S4-014 | select | visible-default | name=status, "" "Semua Status", pending "Pending", active "Aktif", suspended "Digantung", banned "Diharamkan" | FN-M20-3.1.2 |
| EL-M20-S4-015 | button | visible-default | "Tapis", fa-filter | FN-M20-3.1.2 |
| EL-M20-S4-016 | card | visible-default | "J" | FN-M20-3.1.3 |
| EL-M20-S4-017 | text | visible-default | "J" | FN-M20-3.1.3 |
| EL-M20-S4-018 | heading | visible-default | "JomBelajar Official" | FN-M20-3.1.3 |
| EL-M20-S4-019 | text | visible-default | "Admin PRESTASI+ · <digits:10>" | FN-M20-3.1.3 |
| EL-M20-S4-020 | badge | visible-default | "Active" | FN-M20-3.1.3 |
| EL-M20-S4-021 | text | visible-default | "10 produk" | FN-M20-3.1.3 |
| EL-M20-S4-022 | link | visible-default | → /admin/marketplace/sellers/1, fa-eye, title "Lihat Detail" | FN-M20-3.1.4 |
| EL-M20-S4-023 | form | visible-default | POST …/sellers/1/ban | FN-M20-3.1.4 |
| EL-M20-S4-024 | hidden-field | hidden-only | name=_token | FN-M20-3.1.4 |
| EL-M20-S4-025 | button | visible-default | fa-ban, title "Haramkan" | FN-M20-3.1.4 |
| EL-M20-S4-026 | card | conditional | "0" (filtered "Aktif" card) | FN-M20-3.1.1 |
| EL-M20-S4-027 | card | conditional | "0" (filtered "Jumlah Penjual" card) | FN-M20-3.1.1 |
| EL-M20-S4-028 | card | conditional | "0" (filtered "Verified" card) | FN-M20-3.1.1 |
| EL-M20-S4-029 | empty-state | conditional | "Tiada penjual dijumpai" | FN-M20-3.1.5 |

#### S5 — `/admin/marketplace/sellers/{id}` (70 elements)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M20-S5-001 | link | visible-default | "Kembali ke Senarai Penjual", → /admin/marketplace/sellers, fa-arrow-left | FN-M20-3.2.1 |
| EL-M20-S5-002 | card | visible-default | "Maklumat Perniagaan" | FN-M20-3.2.2 |
| EL-M20-S5-003 | heading | visible-default | "Maklumat Perniagaan" | FN-M20-3.2.2 |
| EL-M20-S5-004 | text | visible-default | "J" | FN-M20-3.2.2 |
| EL-M20-S5-005 | heading | visible-default | "JomBelajar Official" | FN-M20-3.2.2 |
| EL-M20-S5-006 | badge | visible-default | "Active" | FN-M20-3.2.2 |
| EL-M20-S5-007 | text | visible-default | "Kedai rasmi JomBelajar — peralatan sekolah berkualiti untuk semua pelajar Malaysia 🇲🇾" | FN-M20-3.2.2 |
| EL-M20-S5-008 | text | visible-default | "Admin PRESTASI+" | FN-M20-3.2.2 |
| EL-M20-S5-009 | text | visible-default | "<masked>" (e-mail) | FN-M20-3.2.2 |
| EL-M20-S5-010 | text | visible-default | "<digits:10>" (telephone) | FN-M20-3.2.2 |
| EL-M20-S5-011 | link | visible-default | "<digits:11>", → https://wa.me/60XXXXXXXXX, target _blank | FN-M20-3.2.2 |
| EL-M20-S5-012 | card | visible-default | "Dokumen" | FN-M20-3.2.3 |
| EL-M20-S5-013 | heading | visible-default | "Dokumen" | FN-M20-3.2.3 |
| EL-M20-S5-014 | empty-state | visible-default | "Tiada dokumen dimuat naik" | FN-M20-3.2.3 |
| EL-M20-S5-015 | card | visible-default | "Produk (10)" | FN-M20-3.2.4 |
| EL-M20-S5-016 | heading | visible-default | "Produk (10)" | FN-M20-3.2.4 |
| EL-M20-S5-017 | image | visible-default | /storage/uploads/products/… (broken on live, DV-M20-03) | FN-M20-3.2.4 |
| EL-M20-S5-018 | text | visible-default | "Beg Sekolah Anti-Air Premium" | FN-M20-3.2.4 |
| EL-M20-S5-019 | text | visible-default | "RM 89.90" | FN-M20-3.2.4 |
| EL-M20-S5-020 | image | visible-default | image (broken on live) | FN-M20-3.2.4 |
| EL-M20-S5-021 | text | visible-default | "Set Buku Latihan Matematik Tahun 6 (5 Buku)" | FN-M20-3.2.4 |
| EL-M20-S5-022 | text | visible-default | "RM 45.00" | FN-M20-3.2.4 |
| EL-M20-S5-023 | image | visible-default | image (broken on live) | FN-M20-3.2.4 |
| EL-M20-S5-024 | text | visible-default | "Uniform Sekolah Baju Putih Lengan Panjang (Saiz M)" | FN-M20-3.2.4 |
| EL-M20-S5-025 | text | visible-default | "RM 15.00" | FN-M20-3.2.4 |
| EL-M20-S5-026 | image | visible-default | image (broken on live) | FN-M20-3.2.4 |
| EL-M20-S5-027 | text | visible-default | "Set Pensel Warna Faber-Castell 48 Warna" | FN-M20-3.2.4 |
| EL-M20-S5-028 | text | visible-default | "RM 32.90" | FN-M20-3.2.4 |
| EL-M20-S5-029 | image | visible-default | image (broken on live) | FN-M20-3.2.4 |
| EL-M20-S5-030 | text | visible-default | "E-Book: 1001 Soalan Sains Tingkatan 3 (PDF)" | FN-M20-3.2.4 |
| EL-M20-S5-031 | text | visible-default | "RM 19.90" | FN-M20-3.2.4 |
| EL-M20-S5-032 | image | visible-default | image (broken on live) | FN-M20-3.2.4 |
| EL-M20-S5-033 | text | visible-default | "Kotak Pensel 3 Tingkat Disney Frozen" | FN-M20-3.2.4 |
| EL-M20-S5-034 | text | visible-default | "RM 22.90" | FN-M20-3.2.4 |
| EL-M20-S5-035 | image | visible-default | image (broken on live) | FN-M20-3.2.4 |
| EL-M20-S5-036 | text | visible-default | "Kamus Dewan Edisi Keempat (Terpakai)" | FN-M20-3.2.4 |
| EL-M20-S5-037 | text | visible-default | "RM 25.00" | FN-M20-3.2.4 |
| EL-M20-S5-038 | image | visible-default | image (broken on live) | FN-M20-3.2.4 |
| EL-M20-S5-039 | text | visible-default | "Botol Air 750ml BPA Free (Biru)" | FN-M20-3.2.4 |
| EL-M20-S5-040 | text | visible-default | "RM 18.90" | FN-M20-3.2.4 |
| EL-M20-S5-041 | image | visible-default | image (broken on live) | FN-M20-3.2.4 |
| EL-M20-S5-042 | text | visible-default | "Set Pembaris T-Square + Jangka Lukis Matematik" | FN-M20-3.2.4 |
| EL-M20-S5-043 | text | visible-default | "RM 14.50" | FN-M20-3.2.4 |
| EL-M20-S5-044 | image | visible-default | image (broken on live) | FN-M20-3.2.4 |
| EL-M20-S5-045 | text | visible-default | "Kasut Sekolah Hitam BATA (Saiz 5)" | FN-M20-3.2.4 |
| EL-M20-S5-046 | text | visible-default | "RM 35.00" | FN-M20-3.2.4 |
| EL-M20-S5-047 | card | visible-default | "Ringkasan" | FN-M20-3.2.5 |
| EL-M20-S5-048 | heading | visible-default | "Ringkasan" | FN-M20-3.2.5 |
| EL-M20-S5-049 | text | visible-default | "Jumlah Produk" | FN-M20-3.2.5 |
| EL-M20-S5-050 | text | visible-default | "10" | FN-M20-3.2.5 |
| EL-M20-S5-051 | text | visible-default | "Rating" | FN-M20-3.2.5 |
| EL-M20-S5-052 | text | visible-default | "☆☆☆☆☆" | FN-M20-3.2.5 |
| EL-M20-S5-053 | text | visible-default | "Ulasan" | FN-M20-3.2.5 |
| EL-M20-S5-054 | text | visible-default | "0" | FN-M20-3.2.5 |
| EL-M20-S5-055 | text | visible-default | "Didaftarkan" | FN-M20-3.2.5 |
| EL-M20-S5-056 | text | visible-default | "09 Feb 2026" | FN-M20-3.2.5 |
| EL-M20-S5-057 | text | visible-default | "Disahkan" | FN-M20-3.2.5 |
| EL-M20-S5-058 | text | visible-default | "09 Feb 2026" | FN-M20-3.2.5 |
| EL-M20-S5-059 | card | visible-default | "Tindakan" | FN-M20-3.2.6 |
| EL-M20-S5-060 | heading | visible-default | "Tindakan" | FN-M20-3.2.6 |
| EL-M20-S5-061 | form | visible-default | POST …/sellers/1/ban | FN-M20-3.2.6 |
| EL-M20-S5-062 | hidden-field | hidden-only | name=_token | FN-M20-3.2.6 |
| EL-M20-S5-063 | button | visible-default | "Haramkan Penjual", fa-ban | FN-M20-3.2.6 |
| EL-M20-S5-064 | text | conditional | "404" | FN-M20-1.2.4 |
| EL-M20-S5-065 | text | conditional | "🔍" | FN-M20-1.2.4 |
| EL-M20-S5-066 | heading | conditional | "Halaman Tidak Dijumpai" | FN-M20-1.2.4 |
| EL-M20-S5-067 | text | conditional | "Maaf, halaman yang anda cari tidak wujud atau telah dipindahkan. Mungkin URL salah taip?" | FN-M20-1.2.4 |
| EL-M20-S5-068 | link | conditional | "Halaman Utama", → / | FN-M20-1.2.4 |
| EL-M20-S5-069 | link | conditional | "Mula Latihan", → /latih-tubi | FN-M20-1.2.4 |
| EL-M20-S5-070 | text | conditional | "PRESTASIPLUS" | FN-M20-1.2.4 |

#### S6 — `/marketplace` (49 elements)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M20-S6-001 | text | hidden-only | "LIVE:", fa-circle | Excluded — M16 tournament banner inside the user shell (hidden; not M20 content) |
| EL-M20-S6-002 | text | hidden-only | "MAIN" | Excluded — M16 tournament banner inside the user shell (hidden; not M20 content) |
| EL-M20-S6-003 | text | hidden-only | "DAFTAR" | Excluded — M16 tournament banner inside the user shell (hidden; not M20 content) |
| EL-M20-S6-004 | form | visible-default | GET /marketplace | FN-M20-4.1.1 |
| EL-M20-S6-005 | input | visible-default | name=q, placeholder "Cari peralatan sekolah..." | FN-M20-4.1.1 |
| EL-M20-S6-006 | select | visible-default | name=category, "" "Semua Kategori" + 6 slugs | FN-M20-4.1.1 |
| EL-M20-S6-007 | select | visible-default | name=condition, "" "Semua Keadaan", new "Baru", used "Terpakai" | FN-M20-4.1.1 |
| EL-M20-S6-008 | select | visible-default | name=sort, latest "Terbaru", price_low "Harga ↑", price_high "Harga ↓", popular "Popular" | FN-M20-4.1.1 |
| EL-M20-S6-009 | button | visible-default | "Cari", fa-search | FN-M20-4.1.1 |
| EL-M20-S6-010 | link | visible-default | "Semua", → /marketplace | FN-M20-4.1.2 |
| EL-M20-S6-011 | filter | visible-default | "Peralatan Sekolah", → ?category=peralatan-sekolah, fa-pencil-ruler | FN-M20-4.1.2 |
| EL-M20-S6-012 | filter | visible-default | "Buku & Rujukan", → ?category=buku-rujukan, fa-book | FN-M20-4.1.2 |
| EL-M20-S6-013 | filter | visible-default | "Uniform & Pakaian", → ?category=uniform-pakaian, fa-tshirt | FN-M20-4.1.2 |
| EL-M20-S6-014 | filter | visible-default | "Stationery", → ?category=stationery, fa-pen | FN-M20-4.1.2 |
| EL-M20-S6-015 | filter | visible-default | "Digital & E-Book", → ?category=digital, fa-tablet-alt | FN-M20-4.1.2 |
| EL-M20-S6-016 | filter | visible-default | "Lain-lain", → ?category=lain-lain, fa-th-large | FN-M20-4.1.2 |
| EL-M20-S6-017 | link | visible-default | "-31% Beg Sekolah Anti-Air Premium JomBelajar Official RM 89.90 RM 129.90 Pos / Kurier (RM8.00)", → /marketplace/…-vH1Fj, fa-store | FN-M20-4.1.3 |
| EL-M20-S6-018 | image | visible-default | image | FN-M20-4.1.3 |
| EL-M20-S6-019 | badge | visible-default | "-31%" | FN-M20-4.1.3 |
| EL-M20-S6-020 | heading | visible-default | "Beg Sekolah Anti-Air Premium" | FN-M20-4.1.3 |
| EL-M20-S6-021 | link | visible-default | "-31% Set Buku Latihan Matematik Tahun 6 (5 Buku) JomBelajar Official RM 45.00 RM 65.00 Penghantaran Percuma 🎉", → /marketplace/…-PAjPe | FN-M20-4.1.3 |
| EL-M20-S6-022 | image | visible-default | image | FN-M20-4.1.3 |
| EL-M20-S6-023 | badge | visible-default | "-31%" | FN-M20-4.1.3 |
| EL-M20-S6-024 | heading | visible-default | "Set Buku Latihan Matematik Tahun 6 (5 Buku)" | FN-M20-4.1.3 |
| EL-M20-S6-025 | link | visible-default | "-57% Terpakai Uniform Sekolah Baju Putih Lengan Panjang (Saiz M) JomBelajar Official RM 15.00 RM 35.00 Cash on Delivery (COD)", → /marketplace/…-hE8Jf | FN-M20-4.1.3 |
| EL-M20-S6-026 | image | visible-default | image | FN-M20-4.1.3 |
| EL-M20-S6-027 | badge | visible-default | "-57%" | FN-M20-4.1.3 |
| EL-M20-S6-028 | badge | visible-default | "Terpakai" | FN-M20-4.1.3 |
| EL-M20-S6-029 | heading | visible-default | "Uniform Sekolah Baju Putih Lengan Panjang (Saiz M)" | FN-M20-4.1.3 |
| EL-M20-S6-030 | link | conditional | "-63% Terpakai Kamus Dewan Edisi Keempat (Terpakai) JomBelajar Official RM 25.00 RM 68.00 Pos / Kurier (RM10.00)", → /marketplace/…-8axTV | FN-M20-4.1.3 |
| EL-M20-S6-031 | badge | conditional | "-63%" | FN-M20-4.1.3 |
| EL-M20-S6-032 | heading | conditional | "Kamus Dewan Edisi Keempat (Terpakai)" | FN-M20-4.1.3 |
| EL-M20-S6-033 | link | conditional | "E-Book: 1001 Soalan Sains Tingkatan 3 (PDF) JomBelajar Official RM 19.90 Penghantaran Percuma 🎉", → /marketplace/…-tqd84 | FN-M20-4.1.3 |
| EL-M20-S6-034 | heading | conditional | "E-Book: 1001 Soalan Sains Tingkatan 3 (PDF)" | FN-M20-4.1.3 |
| EL-M20-S6-035 | link | conditional | "-24% Botol Air 750ml BPA Free (Biru) JomBelajar Official RM 18.90 RM 24.90 Cash on Delivery (COD)", → /marketplace/…-KEz9H | FN-M20-4.1.3 |
| EL-M20-S6-036 | badge | conditional | "-24%" | FN-M20-4.1.3 |
| EL-M20-S6-037 | heading | conditional | "Botol Air 750ml BPA Free (Biru)" | FN-M20-4.1.3 |
| EL-M20-S6-038 | badge | conditional | "Terpakai" | FN-M20-4.1.3 |
| EL-M20-S6-039 | link | conditional | "-56% Terpakai Kasut Sekolah Hitam BATA (Saiz 5) JomBelajar Official RM 35.00 RM 79.90 Cash on Delivery (COD)", → /marketplace/…-jvPNC | FN-M20-4.1.3 |
| EL-M20-S6-040 | badge | conditional | "-56%" | FN-M20-4.1.3 |
| EL-M20-S6-041 | badge | conditional | "Terpakai" | FN-M20-4.1.3 |
| EL-M20-S6-042 | heading | conditional | "Kasut Sekolah Hitam BATA (Saiz 5)" | FN-M20-4.1.3 |
| EL-M20-S6-043 | card | conditional | "Tiada Produk Dijumpai" | FN-M20-4.1.5 |
| EL-M20-S6-044 | text | conditional | "🛒" | FN-M20-4.1.5 |
| EL-M20-S6-045 | heading | conditional | "Tiada Produk Dijumpai" | FN-M20-4.1.5 |
| EL-M20-S6-046 | text | conditional | "Cuba tukar kata kunci atau kategori" | FN-M20-4.1.5 |
| EL-M20-S6-047 | link | conditional | "-34% Set Pembaris T-Square + Jangka Lukis Matematik JomBelajar Official RM 14.50 RM 22.00 Ambil Sendiri (Pickup)", → /marketplace/…-36YYY | FN-M20-4.1.3 |
| EL-M20-S6-048 | badge | conditional | "-34%" | FN-M20-4.1.3 |
| EL-M20-S6-049 | heading | conditional | "Set Pembaris T-Square + Jangka Lukis Matematik" | FN-M20-4.1.3 |

#### S7 — `/marketplace/{slug}` (72 elements)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M20-S7-001 | text | hidden-only | "LIVE:", fa-circle | Excluded — M16 tournament banner inside the user shell (hidden; not M20 content) |
| EL-M20-S7-002 | text | hidden-only | "MAIN" | Excluded — M16 tournament banner inside the user shell (hidden; not M20 content) |
| EL-M20-S7-003 | text | hidden-only | "DAFTAR" | Excluded — M16 tournament banner inside the user shell (hidden; not M20 content) |
| EL-M20-S7-004 | link | visible-default | "Kembali ke Marketplace", → /marketplace, fa-arrow-left | FN-M20-4.2.1 |
| EL-M20-S7-005 | image | visible-default | main image | FN-M20-4.2.2 |
| EL-M20-S7-006 | button | visible-default | thumbnail 1 (setMainImage) | FN-M20-4.2.2 |
| EL-M20-S7-007 | image | visible-default | thumbnail image 1 | FN-M20-4.2.2 |
| EL-M20-S7-008 | button | visible-default | thumbnail 2 | FN-M20-4.2.2 |
| EL-M20-S7-009 | image | visible-default | thumbnail image 2 | FN-M20-4.2.2 |
| EL-M20-S7-010 | button | visible-default | thumbnail 3 | FN-M20-4.2.2 |
| EL-M20-S7-011 | image | visible-default | thumbnail image 3 | FN-M20-4.2.2 |
| EL-M20-S7-012 | button | visible-default | thumbnail 4 | FN-M20-4.2.2 |
| EL-M20-S7-013 | image | visible-default | thumbnail image 4 | FN-M20-4.2.2 |
| EL-M20-S7-014 | card | visible-default | "Beg Sekolah Anti-Air Premium" | FN-M20-4.2.3 |
| EL-M20-S7-015 | badge | visible-default | "Baru" | FN-M20-4.2.3 |
| EL-M20-S7-016 | badge | visible-default | "Peralatan Sekolah", fa-pencil-ruler | FN-M20-4.2.3 |
| EL-M20-S7-017 | heading | visible-default | "Beg Sekolah Anti-Air Premium" | FN-M20-4.2.3 |
| EL-M20-S7-018 | text | visible-default | "RM 89.90" | FN-M20-4.2.3 |
| EL-M20-S7-019 | text | visible-default | "RM 129.90" | FN-M20-4.2.3 |
| EL-M20-S7-020 | badge | visible-default | "-31%" | FN-M20-4.2.3 |
| EL-M20-S7-021 | text | visible-default | "Beg sekolah kalis air dengan 4 kompartmen, bahan nylon berkualiti tinggi. Sesuai untuk pelajar sekolah rendah dan menengah. Ringan dan tahan lama!" | FN-M20-4.2.3 |
| EL-M20-S7-022 | text | visible-default | "33 tontonan", fa-eye | FN-M20-4.2.3 |
| EL-M20-S7-023 | text | visible-default | "Ada Stok" | FN-M20-4.2.3 |
| EL-M20-S7-024 | text | visible-default | "Pos / Kurier (RM8.00)" | FN-M20-4.2.3 |
| EL-M20-S7-025 | text | visible-default | "Kuala Lumpur" | FN-M20-4.2.3 |
| EL-M20-S7-026 | link | visible-default | "Hubungi Penjual di WhatsApp", → /marketplace/beg-sekolah-anti-air-premium-vH1Fj/whatsapp, target _blank, fa-whatsapp | FN-M20-4.2.4 |
| EL-M20-S7-027 | card | visible-default | "Penjual" | FN-M20-4.2.6 |
| EL-M20-S7-028 | heading | visible-default | "Penjual" | FN-M20-4.2.6 |
| EL-M20-S7-029 | link | visible-default | "J JomBelajar Official ☆☆☆☆☆ 10 produk", → /marketplace/penjual/1, fa-check-circle | FN-M20-4.2.6 |
| EL-M20-S7-030 | card | visible-default | "Ulasan (0)" | FN-M20-4.2.7 |
| EL-M20-S7-031 | heading | visible-default | "Ulasan (0)" | FN-M20-4.2.7 |
| EL-M20-S7-032 | text | visible-default | "Belum ada ulasan untuk produk ini" | FN-M20-4.2.7 |
| EL-M20-S7-033 | heading | visible-default | "Produk Berkaitan" | FN-M20-4.2.8 |
| EL-M20-S7-034 | link | visible-default | "Kotak Pensel 3 Tingkat Disney Frozen RM 22.90", → /marketplace/…-strUX | FN-M20-4.2.8 |
| EL-M20-S7-035 | image | visible-default | image | FN-M20-4.2.8 |
| EL-M20-S7-036 | heading | visible-default | "Kotak Pensel 3 Tingkat Disney Frozen" | FN-M20-4.2.8 |
| EL-M20-S7-037 | card | conditional | "E-Book: 1001 Soalan Sains Tingkatan 3 (PDF)" | FN-M20-4.2.3 |
| EL-M20-S7-038 | badge | conditional | "Buku & Rujukan", fa-book | FN-M20-4.2.3 |
| EL-M20-S7-039 | heading | conditional | "E-Book: 1001 Soalan Sains Tingkatan 3 (PDF)" | FN-M20-4.2.3 |
| EL-M20-S7-040 | text | conditional | "RM 19.90" | FN-M20-4.2.3 |
| EL-M20-S7-041 | text | conditional | "Koleksi 1001 soalan Sains Tingkatan 3 dalam format PDF. Termasuk jawapan dan penerangan lengkap. Boleh cetak atau baca di tablet!" | FN-M20-4.2.3 |
| EL-M20-S7-042 | text | conditional | "8 tontonan", fa-eye | FN-M20-4.2.3 |
| EL-M20-S7-043 | text | conditional | "Penghantaran Percuma 🎉" | FN-M20-4.2.3 |
| EL-M20-S7-044 | text | conditional | "Digital" | FN-M20-4.2.3 |
| EL-M20-S7-045 | link | conditional | "Hubungi Penjual di WhatsApp", → /marketplace/…-tqd84/whatsapp, target _blank, fa-whatsapp | FN-M20-4.2.4 |
| EL-M20-S7-046 | link | conditional | "Set Buku Latihan Matematik Tahun 6 (5 Buku) RM 45.00", → /marketplace/…-PAjPe | FN-M20-4.2.8 |
| EL-M20-S7-047 | heading | conditional | "Set Buku Latihan Matematik Tahun 6 (5 Buku)" | FN-M20-4.2.8 |
| EL-M20-S7-048 | link | conditional | "Kamus Dewan Edisi Keempat (Terpakai) RM 25.00", → /marketplace/…-8axTV | FN-M20-4.2.8 |
| EL-M20-S7-049 | image | conditional | image | FN-M20-4.2.8 |
| EL-M20-S7-050 | heading | conditional | "Kamus Dewan Edisi Keempat (Terpakai)" | FN-M20-4.2.8 |
| EL-M20-S7-051 | text | conditional | "404" | FN-M20-1.2.4 |
| EL-M20-S7-052 | text | conditional | "🔍" | FN-M20-1.2.4 |
| EL-M20-S7-053 | heading | conditional | "Halaman Tidak Dijumpai" | FN-M20-1.2.4 |
| EL-M20-S7-054 | text | conditional | "Maaf, halaman yang anda cari tidak wujud atau telah dipindahkan. Mungkin URL salah taip?" | FN-M20-1.2.4 |
| EL-M20-S7-055 | link | conditional | "Halaman Utama", → / | FN-M20-1.2.4 |
| EL-M20-S7-056 | link | conditional | "Mula Latihan", → /latih-tubi | FN-M20-1.2.4 |
| EL-M20-S7-057 | text | conditional | "PRESTASIPLUS" | FN-M20-1.2.4 |
| EL-M20-S7-058 | button | conditional | thumbnail 5 (#7) | FN-M20-4.2.2 |
| EL-M20-S7-059 | card | conditional | "Kamus Dewan Edisi Keempat (Terpakai)" | FN-M20-4.2.3 |
| EL-M20-S7-060 | badge | conditional | "Terpakai" | FN-M20-4.2.3 |
| EL-M20-S7-061 | heading | conditional | "Kamus Dewan Edisi Keempat (Terpakai)" | FN-M20-4.2.3 |
| EL-M20-S7-062 | text | conditional | "RM 25.00" | FN-M20-4.2.3 |
| EL-M20-S7-063 | text | conditional | "RM 68.00" | FN-M20-4.2.3 |
| EL-M20-S7-064 | badge | conditional | "-63%" | FN-M20-4.2.3 |
| EL-M20-S7-065 | text | conditional | "Kamus Dewan Bahasa dan Pustaka edisi keempat. Keadaan baik, tiada koyak atau conteng. Kulit keras, tahan lama. Wajib ada untuk pelajar!" | FN-M20-4.2.3 |
| EL-M20-S7-066 | text | conditional | "7 tontonan", fa-eye | FN-M20-4.2.3 |
| EL-M20-S7-067 | text | conditional | "Pos / Kurier (RM10.00)" | FN-M20-4.2.3 |
| EL-M20-S7-068 | text | conditional | "Penang" | FN-M20-4.2.3 |
| EL-M20-S7-069 | link | conditional | "Hubungi Penjual di WhatsApp", → /marketplace/…-8axTV/whatsapp, target _blank, fa-whatsapp | FN-M20-4.2.4 |
| EL-M20-S7-070 | link | conditional | "E-Book: 1001 Soalan Sains Tingkatan 3 (PDF) RM 19.90", → /marketplace/…-tqd84 | FN-M20-4.2.8 |
| EL-M20-S7-071 | image | conditional | image | FN-M20-4.2.8 |
| EL-M20-S7-072 | heading | conditional | "E-Book: 1001 Soalan Sains Tingkatan 3 (PDF)" | FN-M20-4.2.8 |

#### S8 — `/marketplace/penjual/{id}` (27 elements)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M20-S8-001 | text | hidden-only | "LIVE:", fa-circle | Excluded — M16 tournament banner inside the user shell (hidden; not M20 content) |
| EL-M20-S8-002 | text | hidden-only | "MAIN" | Excluded — M16 tournament banner inside the user shell (hidden; not M20 content) |
| EL-M20-S8-003 | text | hidden-only | "DAFTAR" | Excluded — M16 tournament banner inside the user shell (hidden; not M20 content) |
| EL-M20-S8-004 | link | visible-default | "Kembali ke Marketplace", → /marketplace, fa-arrow-left | FN-M20-4.3.1 |
| EL-M20-S8-005 | card | visible-default | "J" | FN-M20-4.3.2 |
| EL-M20-S8-006 | text | visible-default | "J" | FN-M20-4.3.2 |
| EL-M20-S8-007 | heading | visible-default | "JomBelajar Official" | FN-M20-4.3.2 |
| EL-M20-S8-008 | text | visible-default | "Kedai rasmi JomBelajar — peralatan sekolah berkualiti untuk semua pelajar Malaysia 🇲🇾" | FN-M20-4.3.2 |
| EL-M20-S8-009 | text | visible-default | "☆☆☆☆☆ (0)" | FN-M20-4.3.2 |
| EL-M20-S8-010 | text | visible-default | "10 produk", fa-box | FN-M20-4.3.2 |
| EL-M20-S8-011 | text | visible-default | "Bergabung 7 bulan yang lepas", fa-calendar | FN-M20-4.3.2 |
| EL-M20-S8-012 | link | visible-default | "Beg Sekolah Anti-Air Premium RM 89.90 RM 129.90", → /marketplace/…-vH1Fj | FN-M20-4.3.3 |
| EL-M20-S8-013 | image | visible-default | image | FN-M20-4.3.3 |
| EL-M20-S8-014 | heading | visible-default | "Beg Sekolah Anti-Air Premium" | FN-M20-4.3.3 |
| EL-M20-S8-015 | link | visible-default | "Set Buku Latihan Matematik Tahun 6 (5 Buku) RM 45.00 RM 65.00", → /marketplace/…-PAjPe | FN-M20-4.3.3 |
| EL-M20-S8-016 | image | visible-default | image | FN-M20-4.3.3 |
| EL-M20-S8-017 | heading | visible-default | "Set Buku Latihan Matematik Tahun 6 (5 Buku)" | FN-M20-4.3.3 |
| EL-M20-S8-018 | link | visible-default | "Uniform Sekolah Baju Putih Lengan Panjang (Saiz M) RM 15.00 RM 35.00", → /marketplace/…-hE8Jf | FN-M20-4.3.3 |
| EL-M20-S8-019 | image | visible-default | image | FN-M20-4.3.3 |
| EL-M20-S8-020 | heading | visible-default | "Uniform Sekolah Baju Putih Lengan Panjang (Saiz M)" | FN-M20-4.3.3 |
| EL-M20-S8-021 | text | conditional | "404" | FN-M20-1.2.4 |
| EL-M20-S8-022 | text | conditional | "🔍" | FN-M20-1.2.4 |
| EL-M20-S8-023 | heading | conditional | "Halaman Tidak Dijumpai" | FN-M20-1.2.4 |
| EL-M20-S8-024 | text | conditional | "Maaf, halaman yang anda cari tidak wujud atau telah dipindahkan. Mungkin URL salah taip?" | FN-M20-1.2.4 |
| EL-M20-S8-025 | link | conditional | "Halaman Utama", → / | FN-M20-1.2.4 |
| EL-M20-S8-026 | link | conditional | "Mula Latihan", → /latih-tubi | FN-M20-1.2.4 |
| EL-M20-S8-027 | text | conditional | "PRESTASIPLUS" | FN-M20-1.2.4 |

#### S9 — `/seller/dashboard` (66 elements)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M20-S9-001 | text | hidden-only | "LIVE:", fa-circle | Excluded — M16 tournament banner inside the user shell (hidden; not M20 content) |
| EL-M20-S9-002 | text | hidden-only | "MAIN" | Excluded — M16 tournament banner inside the user shell (hidden; not M20 content) |
| EL-M20-S9-003 | text | hidden-only | "DAFTAR" | Excluded — M16 tournament banner inside the user shell (hidden; not M20 content) |
| EL-M20-S9-004 | card | visible-default | "10" | FN-M20-5.2.1 |
| EL-M20-S9-005 | text | visible-default | "10" | FN-M20-5.2.1 |
| EL-M20-S9-006 | text | visible-default | "Jumlah Produk" | FN-M20-5.2.1 |
| EL-M20-S9-007 | card | visible-default | "10" | FN-M20-5.2.1 |
| EL-M20-S9-008 | text | visible-default | "10" | FN-M20-5.2.1 |
| EL-M20-S9-009 | text | visible-default | "Produk Aktif" | FN-M20-5.2.1 |
| EL-M20-S9-010 | card | visible-default | "117" | FN-M20-5.2.1 |
| EL-M20-S9-011 | text | visible-default | "117" (111 before discovery, §7.1) | FN-M20-5.2.1 |
| EL-M20-S9-012 | text | visible-default | "Jumlah Tontonan" | FN-M20-5.2.1 |
| EL-M20-S9-013 | card | visible-default | "16" | FN-M20-5.2.1 |
| EL-M20-S9-014 | text | visible-default | "16" | FN-M20-5.2.1 |
| EL-M20-S9-015 | text | visible-default | "Klik WhatsApp" | FN-M20-5.2.1 |
| EL-M20-S9-016 | link | visible-default | "Tambah Produk", → /seller/produk/tambah, fa-plus-circle | FN-M20-5.2.2 |
| EL-M20-S9-017 | link | visible-default | "Senarai Produk", → /seller/produk, fa-box | FN-M20-5.2.2 |
| EL-M20-S9-018 | link | visible-default | "Lihat Kedai Saya", → /marketplace/penjual/1, target _blank, fa-external-link-alt | FN-M20-5.2.2 |
| EL-M20-S9-019 | card | visible-default | "Profil Kedai" | FN-M20-5.2.3 |
| EL-M20-S9-020 | heading | visible-default | "Profil Kedai" | FN-M20-5.2.3 |
| EL-M20-S9-021 | text | visible-default | "Nama:" | FN-M20-5.2.3 |
| EL-M20-S9-022 | text | visible-default | "<name>" (shop name, over-masked by discovery) | FN-M20-5.2.3 |
| EL-M20-S9-023 | text | visible-default | "Status:" | FN-M20-5.2.3 |
| EL-M20-S9-024 | text | visible-default | "Verified", fa-check-circle | FN-M20-5.2.3 |
| EL-M20-S9-025 | text | visible-default | "(0 reviews)" | FN-M20-5.2.3 |
| EL-M20-S9-026 | text | visible-default | "Rating:" | FN-M20-5.2.3 |
| EL-M20-S9-027 | text | visible-default | "☆☆☆☆☆" | FN-M20-5.2.3 |
| EL-M20-S9-028 | text | visible-default | "<digits:11>" (WhatsApp) | FN-M20-5.2.3 |
| EL-M20-S9-029 | text | visible-default | "WhatsApp:" | FN-M20-5.2.3 |
| EL-M20-S9-030 | heading | visible-default | "Produk Terbaru" | FN-M20-5.2.4 |
| EL-M20-S9-031 | card | visible-default | "Beg Sekolah Anti-Air Premium" | FN-M20-5.2.4 |
| EL-M20-S9-032 | image | visible-default | image | FN-M20-5.2.4 |
| EL-M20-S9-033 | heading | visible-default | "Beg Sekolah Anti-Air Premium" | FN-M20-5.2.4 |
| EL-M20-S9-034 | text | visible-default | "RM 89.90" | FN-M20-5.2.4 |
| EL-M20-S9-035 | text | visible-default | "33", fa-eye | FN-M20-5.2.4 |
| EL-M20-S9-036 | badge | visible-default | "Active" | FN-M20-5.2.4 |
| EL-M20-S9-037 | card | visible-default | "Set Buku Latihan Matematik Tahun 6 (5 Buku)" | FN-M20-5.2.4 |
| EL-M20-S9-038 | image | visible-default | image | FN-M20-5.2.4 |
| EL-M20-S9-039 | heading | visible-default | "Set Buku Latihan Matematik Tahun 6 (5 Buku)" | FN-M20-5.2.4 |
| EL-M20-S9-040 | text | visible-default | "RM 45.00" | FN-M20-5.2.4 |
| EL-M20-S9-041 | text | visible-default | "14", fa-eye | FN-M20-5.2.4 |
| EL-M20-S9-042 | badge | visible-default | "Active" | FN-M20-5.2.4 |
| EL-M20-S9-043 | card | visible-default | "Uniform Sekolah Baju Putih Lengan Panjang (Saiz M)" | FN-M20-5.2.4 |
| EL-M20-S9-044 | image | visible-default | image | FN-M20-5.2.4 |
| EL-M20-S9-045 | heading | visible-default | "Uniform Sekolah Baju Putih Lengan Panjang (Saiz M)" | FN-M20-5.2.4 |
| EL-M20-S9-046 | text | visible-default | "RM 15.00" | FN-M20-5.2.4 |
| EL-M20-S9-047 | text | visible-default | "13", fa-eye | FN-M20-5.2.4 |
| EL-M20-S9-048 | badge | visible-default | "Active" | FN-M20-5.2.4 |
| EL-M20-S9-049 | card | visible-default | "Set Pensel Warna Faber-Castell 48 Warna" | FN-M20-5.2.4 |
| EL-M20-S9-050 | image | visible-default | image | FN-M20-5.2.4 |
| EL-M20-S9-051 | heading | visible-default | "Set Pensel Warna Faber-Castell 48 Warna" | FN-M20-5.2.4 |
| EL-M20-S9-052 | text | visible-default | "RM 32.90" | FN-M20-5.2.4 |
| EL-M20-S9-053 | text | visible-default | "5", fa-eye | FN-M20-5.2.4 |
| EL-M20-S9-054 | badge | visible-default | "Active" | FN-M20-5.2.4 |
| EL-M20-S9-055 | card | visible-default | "E-Book: 1001 Soalan Sains Tingkatan 3 (PDF)" | FN-M20-5.2.4 |
| EL-M20-S9-056 | image | visible-default | image | FN-M20-5.2.4 |
| EL-M20-S9-057 | heading | visible-default | "E-Book: 1001 Soalan Sains Tingkatan 3 (PDF)" | FN-M20-5.2.4 |
| EL-M20-S9-058 | text | visible-default | "RM 19.90" | FN-M20-5.2.4 |
| EL-M20-S9-059 | text | visible-default | "8", fa-eye | FN-M20-5.2.4 |
| EL-M20-S9-060 | badge | visible-default | "Active" | FN-M20-5.2.4 |
| EL-M20-S9-061 | card | visible-default | "Kotak Pensel 3 Tingkat Disney Frozen" | FN-M20-5.2.4 |
| EL-M20-S9-062 | image | visible-default | image | FN-M20-5.2.4 |
| EL-M20-S9-063 | heading | visible-default | "Kotak Pensel 3 Tingkat Disney Frozen" | FN-M20-5.2.4 |
| EL-M20-S9-064 | text | visible-default | "RM 22.90" | FN-M20-5.2.4 |
| EL-M20-S9-065 | text | visible-default | "3", fa-eye | FN-M20-5.2.4 |
| EL-M20-S9-066 | badge | visible-default | "Active" | FN-M20-5.2.4 |

#### S10 — `/seller/produk` (46 elements)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M20-S10-001 | text | hidden-only | "LIVE:", fa-circle | Excluded — M16 tournament banner inside the user shell (hidden; not M20 content) |
| EL-M20-S10-002 | text | hidden-only | "MAIN" | Excluded — M16 tournament banner inside the user shell (hidden; not M20 content) |
| EL-M20-S10-003 | text | hidden-only | "DAFTAR" | Excluded — M16 tournament banner inside the user shell (hidden; not M20 content) |
| EL-M20-S10-004 | link | visible-default | "Dashboard", → /seller/dashboard, fa-arrow-left | FN-M20-5.3.1 |
| EL-M20-S10-005 | link | visible-default | "Tambah Produk", → /seller/produk/tambah, fa-plus | FN-M20-5.3.1 |
| EL-M20-S10-006 | card | visible-default | "Beg Sekolah Anti-Air Premium" | FN-M20-5.3.2 |
| EL-M20-S10-007 | image | visible-default | image | FN-M20-5.3.2 |
| EL-M20-S10-008 | heading | visible-default | "Beg Sekolah Anti-Air Premium" | FN-M20-5.3.2 |
| EL-M20-S10-009 | text | visible-default | "RM 89.90" | FN-M20-5.3.2 |
| EL-M20-S10-010 | text | visible-default | "33", fa-eye | FN-M20-5.3.2 |
| EL-M20-S10-011 | text | visible-default | "0", fa-star | FN-M20-5.3.2 |
| EL-M20-S10-012 | badge | visible-default | "Active" | FN-M20-5.3.2 |
| EL-M20-S10-013 | link | visible-default | → /seller/produk/1/edit, fa-edit | FN-M20-5.3.3 |
| EL-M20-S10-014 | form | visible-default | POST /seller/produk/1 (_method DELETE) | FN-M20-5.3.3 |
| EL-M20-S10-015 | hidden-field | hidden-only | name=_token | FN-M20-5.3.3 |
| EL-M20-S10-016 | hidden-field | hidden-only | name=_method | FN-M20-5.3.3 |
| EL-M20-S10-017 | button | visible-default | fa-trash | FN-M20-5.3.3 |
| EL-M20-S10-018 | card | visible-default | "Set Buku Latihan Matematik Tahun 6 (5 Buku)" | FN-M20-5.3.2 |
| EL-M20-S10-019 | image | visible-default | image | FN-M20-5.3.2 |
| EL-M20-S10-020 | heading | visible-default | "Set Buku Latihan Matematik Tahun 6 (5 Buku)" | FN-M20-5.3.2 |
| EL-M20-S10-021 | text | visible-default | "RM 45.00" | FN-M20-5.3.2 |
| EL-M20-S10-022 | text | visible-default | "14", fa-eye | FN-M20-5.3.2 |
| EL-M20-S10-023 | text | visible-default | "0", fa-star | FN-M20-5.3.2 |
| EL-M20-S10-024 | badge | visible-default | "Active" | FN-M20-5.3.2 |
| EL-M20-S10-025 | link | visible-default | → /seller/produk/2/edit, fa-edit | FN-M20-5.3.3 |
| EL-M20-S10-026 | form | visible-default | POST /seller/produk/2 (_method DELETE) | FN-M20-5.3.3 |
| EL-M20-S10-027 | hidden-field | hidden-only | name=_token | FN-M20-5.3.3 |
| EL-M20-S10-028 | hidden-field | hidden-only | name=_method | FN-M20-5.3.3 |
| EL-M20-S10-029 | button | visible-default | fa-trash | FN-M20-5.3.3 |
| EL-M20-S10-030 | card | visible-default | "Uniform Sekolah Baju Putih Lengan Panjang (Saiz M)" | FN-M20-5.3.2 |
| EL-M20-S10-031 | image | visible-default | image | FN-M20-5.3.2 |
| EL-M20-S10-032 | heading | visible-default | "Uniform Sekolah Baju Putih Lengan Panjang (Saiz M)" | FN-M20-5.3.2 |
| EL-M20-S10-033 | text | visible-default | "RM 15.00" | FN-M20-5.3.2 |
| EL-M20-S10-034 | text | visible-default | "13", fa-eye | FN-M20-5.3.2 |
| EL-M20-S10-035 | text | visible-default | "0", fa-star | FN-M20-5.3.2 |
| EL-M20-S10-036 | badge | visible-default | "Active" | FN-M20-5.3.2 |
| EL-M20-S10-037 | link | visible-default | → /seller/produk/3/edit, fa-edit | FN-M20-5.3.3 |
| EL-M20-S10-038 | form | visible-default | POST /seller/produk/3 (_method DELETE) | FN-M20-5.3.3 |
| EL-M20-S10-039 | hidden-field | hidden-only | name=_token | FN-M20-5.3.3 |
| EL-M20-S10-040 | hidden-field | hidden-only | name=_method | FN-M20-5.3.3 |
| EL-M20-S10-041 | button | visible-default | fa-trash | FN-M20-5.3.3 |
| EL-M20-S10-042 | card | conditional | "Belum Ada Produk" | FN-M20-5.3.4 |
| EL-M20-S10-043 | text | conditional | "📦" | FN-M20-5.3.4 |
| EL-M20-S10-044 | heading | conditional | "Belum Ada Produk" | FN-M20-5.3.4 |
| EL-M20-S10-045 | text | conditional | "Tambah produk pertama anda sekarang!" | FN-M20-5.3.4 |
| EL-M20-S10-046 | link | conditional | "Tambah Produk", → /seller/produk/tambah, fa-plus-circle | FN-M20-5.3.4 |

#### S11 — `/seller/produk/tambah` (39 elements)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M20-S11-001 | text | hidden-only | "LIVE:", fa-circle | Excluded — M16 tournament banner inside the user shell (hidden; not M20 content) |
| EL-M20-S11-002 | text | hidden-only | "MAIN" | Excluded — M16 tournament banner inside the user shell (hidden; not M20 content) |
| EL-M20-S11-003 | text | hidden-only | "DAFTAR" | Excluded — M16 tournament banner inside the user shell (hidden; not M20 content) |
| EL-M20-S11-004 | link | visible-default | "Kembali", → /seller/produk, fa-arrow-left | FN-M20-5.4.1 |
| EL-M20-S11-005 | form | visible-default | POST /seller/produk (multipart) | FN-M20-5.4.1 |
| EL-M20-S11-006 | hidden-field | hidden-only | name=_token | FN-M20-5.4.1 |
| EL-M20-S11-007 | card | visible-default | "Maklumat Produk" | FN-M20-5.4.2 |
| EL-M20-S11-008 | heading | visible-default | "Maklumat Produk" | FN-M20-5.4.2 |
| EL-M20-S11-009 | label | visible-default | "Nama Produk *" | FN-M20-5.4.2 |
| EL-M20-S11-010 | input | visible-default | name=name, type text | FN-M20-5.4.2 |
| EL-M20-S11-011 | label | visible-default | "Kategori *" | FN-M20-5.4.2 |
| EL-M20-S11-012 | select | visible-default | name=category_id | FN-M20-5.4.2 |
| EL-M20-S11-013 | label | visible-default | "Harga (RM) *" | FN-M20-5.4.2 |
| EL-M20-S11-014 | input | visible-default | name=price, type number | FN-M20-5.4.2 |
| EL-M20-S11-015 | label | visible-default | "Harga Asal (RM)" | FN-M20-5.4.2 |
| EL-M20-S11-016 | input | visible-default | name=original_price, type number | FN-M20-5.4.2 |
| EL-M20-S11-017 | text | visible-default | "Untuk tunjukkan diskaun" | FN-M20-5.4.2 |
| EL-M20-S11-018 | label | visible-default | "Penerangan" | FN-M20-5.4.2 |
| EL-M20-S11-019 | textarea | visible-default | name=description | FN-M20-5.4.2 |
| EL-M20-S11-020 | label | visible-default | "Keadaan *" | FN-M20-5.4.2 |
| EL-M20-S11-021 | label | visible-default | "🆕 Baru" | FN-M20-5.4.2 |
| EL-M20-S11-022 | radio | hidden-only | name=condition, value new, checked on load | FN-M20-5.4.2 |
| EL-M20-S11-023 | alert | visible-default | "🆕 Baru" | FN-M20-5.4.2 |
| EL-M20-S11-024 | label | visible-default | "♻️ Terpakai" | FN-M20-5.4.2 |
| EL-M20-S11-025 | radio | hidden-only | name=condition | FN-M20-5.4.2 |
| EL-M20-S11-026 | alert | visible-default | "♻️ Terpakai" | FN-M20-5.4.2 |
| EL-M20-S11-027 | label | visible-default | "Status Stok *" | FN-M20-5.4.2 |
| EL-M20-S11-028 | label | visible-default | "✅ Ada" | FN-M20-5.4.2 |
| EL-M20-S11-029 | radio | hidden-only | name=stock_status, value available, checked on load | FN-M20-5.4.2 |
| EL-M20-S11-030 | alert | visible-default | "✅ Ada" | FN-M20-5.4.2 |
| EL-M20-S11-031 | label | visible-default | "❌ Habis" | FN-M20-5.4.2 |
| EL-M20-S11-032 | radio | hidden-only | name=stock_status | FN-M20-5.4.2 |
| EL-M20-S11-033 | alert | visible-default | "❌ Habis" | FN-M20-5.4.2 |
| EL-M20-S11-034 | card | visible-default | "Gambar Produk" | FN-M20-5.4.3 |
| EL-M20-S11-035 | heading | visible-default | "Gambar Produk" | FN-M20-5.4.3 |
| EL-M20-S11-036 | text | visible-default | "Muat naik sehingga 5 gambar. Gambar pertama jadi gambar utama." | FN-M20-5.4.3 |
| EL-M20-S11-037 | input | visible-default | name=images[], type file | FN-M20-5.4.3 |
| EL-M20-S11-038 | text | visible-default | "JPG, PNG, WEBP. Maks 2MB setiap gambar." | FN-M20-5.4.3 |
| EL-M20-S11-039 | button | visible-default | "Tambah Produk", fa-plus-circle | FN-M20-5.4.3 |

#### S12 — `/seller/produk/{id}/edit` (54 elements)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M20-S12-001 | text | hidden-only | "LIVE:", fa-circle | Excluded — M16 tournament banner inside the user shell (hidden; not M20 content) |
| EL-M20-S12-002 | text | hidden-only | "MAIN" | Excluded — M16 tournament banner inside the user shell (hidden; not M20 content) |
| EL-M20-S12-003 | text | hidden-only | "DAFTAR" | Excluded — M16 tournament banner inside the user shell (hidden; not M20 content) |
| EL-M20-S12-004 | link | visible-default | "Kembali", → /seller/produk, fa-arrow-left | FN-M20-5.5.1 |
| EL-M20-S12-005 | form | visible-default | POST /seller/produk/1 | FN-M20-5.5.1 |
| EL-M20-S12-006 | hidden-field | hidden-only | name=_token | FN-M20-5.5.1 |
| EL-M20-S12-007 | hidden-field | hidden-only | name=_method | FN-M20-5.5.1 |
| EL-M20-S12-008 | card | visible-default | "Kemaskini Produk" | FN-M20-5.5.2 |
| EL-M20-S12-009 | heading | visible-default | "Kemaskini Produk" | FN-M20-5.5.2 |
| EL-M20-S12-010 | label | visible-default | "Nama Produk *" | FN-M20-5.5.2 |
| EL-M20-S12-011 | input | visible-default | name=name, type text | FN-M20-5.5.2 |
| EL-M20-S12-012 | label | visible-default | "Kategori *" | FN-M20-5.5.2 |
| EL-M20-S12-013 | select | visible-default | name=category_id | FN-M20-5.5.2 |
| EL-M20-S12-014 | label | visible-default | "Harga (RM) *" | FN-M20-5.5.2 |
| EL-M20-S12-015 | input | visible-default | name=price, type number | FN-M20-5.5.2 |
| EL-M20-S12-016 | label | visible-default | "Harga Asal (RM)" | FN-M20-5.5.2 |
| EL-M20-S12-017 | input | visible-default | name=original_price, type number | FN-M20-5.5.2 |
| EL-M20-S12-018 | label | visible-default | "Penerangan" | FN-M20-5.5.2 |
| EL-M20-S12-019 | textarea | visible-default | name=description | FN-M20-5.5.2 |
| EL-M20-S12-020 | label | visible-default | "Keadaan *" | FN-M20-5.5.2 |
| EL-M20-S12-021 | label | visible-default | "🆕 Baru" | FN-M20-5.5.2 |
| EL-M20-S12-022 | radio | hidden-only | name=condition | FN-M20-5.5.2 |
| EL-M20-S12-023 | alert | visible-default | "🆕 Baru" | FN-M20-5.5.2 |
| EL-M20-S12-024 | label | visible-default | "♻️ Terpakai" | FN-M20-5.5.2 |
| EL-M20-S12-025 | radio | hidden-only | name=condition | FN-M20-5.5.2 |
| EL-M20-S12-026 | alert | visible-default | "♻️ Terpakai" | FN-M20-5.5.2 |
| EL-M20-S12-027 | label | visible-default | "Status Stok *" | FN-M20-5.5.2 |
| EL-M20-S12-028 | label | visible-default | "✅ Ada" | FN-M20-5.5.2 |
| EL-M20-S12-029 | radio | hidden-only | name=stock_status | FN-M20-5.5.2 |
| EL-M20-S12-030 | alert | visible-default | "✅ Ada" | FN-M20-5.5.2 |
| EL-M20-S12-031 | label | visible-default | "❌ Habis" | FN-M20-5.5.2 |
| EL-M20-S12-032 | radio | hidden-only | name=stock_status | FN-M20-5.5.2 |
| EL-M20-S12-033 | alert | visible-default | "❌ Habis" | FN-M20-5.5.2 |
| EL-M20-S12-034 | card | visible-default | "Gambar Sedia Ada" | FN-M20-5.5.3 |
| EL-M20-S12-035 | heading | visible-default | "Gambar Sedia Ada" | FN-M20-5.5.3 |
| EL-M20-S12-036 | image | visible-default | image 1 | FN-M20-5.5.3 |
| EL-M20-S12-037 | image | visible-default | image 2 | FN-M20-5.5.3 |
| EL-M20-S12-038 | image | visible-default | image 3 | FN-M20-5.5.3 |
| EL-M20-S12-039 | image | visible-default | image 4 | FN-M20-5.5.3 |
| EL-M20-S12-040 | card | visible-default | "Tambah Gambar Baru" | FN-M20-5.5.4 |
| EL-M20-S12-041 | heading | visible-default | "Tambah Gambar Baru" | FN-M20-5.5.4 |
| EL-M20-S12-042 | input | visible-default | name=images[], type file | FN-M20-5.5.4 |
| EL-M20-S12-043 | button | visible-default | "Simpan Perubahan", fa-save | FN-M20-5.5.4 |
| EL-M20-S12-044 | text | conditional | "404" | FN-M20-1.2.4 |
| EL-M20-S12-045 | text | conditional | "🔍" | FN-M20-1.2.4 |
| EL-M20-S12-046 | heading | conditional | "Halaman Tidak Dijumpai" | FN-M20-1.2.4 |
| EL-M20-S12-047 | text | conditional | "Maaf, halaman yang anda cari tidak wujud atau telah dipindahkan. Mungkin URL salah taip?" | FN-M20-1.2.4 |
| EL-M20-S12-048 | link | conditional | "Halaman Utama", → / | FN-M20-1.2.4 |
| EL-M20-S12-049 | link | conditional | "Mula Latihan", → /latih-tubi | FN-M20-1.2.4 |
| EL-M20-S12-050 | text | conditional | "PRESTASIPLUS" | FN-M20-1.2.4 |
| EL-M20-S12-051 | heading | conditional | "Oops! An Error Occurred" | FN-M20-1.2.5 |
| EL-M20-S12-052 | heading | conditional | "The server returned a "405 Method Not Allowed"." | FN-M20-1.2.5 |
| EL-M20-S12-053 | text | conditional | "Something is broken. Please let us know what you were doing when this error occurred. We will fix it as soon as possible. Sorry for any inconvenience caused." | FN-M20-1.2.5 |
| EL-M20-S12-054 | image | conditional | image 5 (#7) | FN-M20-5.5.3 |

### 6.2 Shell elements

The shells are chrome owned by the global shell (00-global-ui, design/shells.md, M23) and by the modules whose entries they carry. Every element is excluded with its reason; the rows that render an M20 menu entry or header title name the M20 Function that specifies it.

#### SHA — admin-panel shell (chrome of S1–S5) — 212 elements, all excluded (16 carry an M20 entry or title specified by FN-M20-1.1.1 / 1.1.3)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M20-SHA-001 | link | visible-default | → /admin | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M20-SHA-002 | image | visible-default | image | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M20-SHA-003 | text | visible-default | "Panel Pentadbir" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M20-SHA-004 | link | visible-default | "Command Center LIVE", → /admin/command-center | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M20-SHA-005 | badge | visible-default | "LIVE" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M20-SHA-006 | link | visible-default | "Aktiviti Harian" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M20-SHA-007 | link | visible-default | "Audio KBAT" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M20-SHA-008 | text | visible-default | "HARIAN" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M20-SHA-009 | link | visible-default | "Dashboard", → /admin | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M20-SHA-010 | link | visible-default | "Laporan Eksekutif" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M20-SHA-011 | text | visible-default | "ANALITIK" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M20-SHA-012 | link | visible-default | "Analitik" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M20-SHA-013 | link | visible-default | "Monitoring" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M20-SHA-014 | toggle | visible-default | "Kirkpatrick" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M20-SHA-015 | link | hidden-only | "Overview", → /admin/kirkpatrick | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M20-SHA-016 | link | hidden-only | "T1: Reaksi" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M20-SHA-017 | link | hidden-only | "T2: Pembelajaran" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M20-SHA-018 | link | hidden-only | "T3: Tingkah Laku" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M20-SHA-019 | link | hidden-only | "T4: Hasil" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M20-SHA-020 | link | hidden-only | "Rantaian Impak" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M20-SHA-021 | link | hidden-only | "Intervensi" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M20-SHA-022 | link | visible-default | "Laporan" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M20-SHA-023 | text | visible-default | "PENGURUSAN" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M20-SHA-024 | toggle | visible-default | "Kurikulum" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M20-SHA-025 | link | hidden-only | "Kurikulum" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M20-SHA-026 | link | hidden-only | "Subjek" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M20-SHA-027 | link | hidden-only | "Tahap Pendidikan" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M20-SHA-028 | toggle | visible-default | "Soalan" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M20-SHA-029 | link | hidden-only | "Senarai Soalan" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M20-SHA-030 | link | hidden-only | "Import CSV" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M20-SHA-031 | link | hidden-only | "Kualiti Soalan" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M20-SHA-032 | link | hidden-only | "Laporan Soalan" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M20-SHA-033 | link | hidden-only | "Soalan Berstruktur" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M20-SHA-034 | link | hidden-only | "Kertas Soalan Guru" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M20-SHA-035 | toggle | visible-default | "Pengguna" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M20-SHA-036 | link | hidden-only | "Senarai Pengguna" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M20-SHA-037 | link | hidden-only | "Sekolah" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M20-SHA-038 | link | hidden-only | "Langganan Sekolah" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M20-SHA-039 | link | hidden-only | "Import Pelajar" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M20-SHA-040 | link | hidden-only | "Pelajar Komplimen" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M20-SHA-041 | link | hidden-only | "Import Pengguna" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M20-SHA-042 | link | hidden-only | "Penajaan" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M20-SHA-043 | link | hidden-only | "Anak Angkat" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M20-SHA-044 | link | hidden-only | "Permohonan" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M20-SHA-045 | toggle | visible-default | "SPM" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M20-SHA-046 | link | hidden-only | "Databank Soalan" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M20-SHA-047 | link | hidden-only | "Latih Tubi" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M20-SHA-048 | link | hidden-only | "Tracking A" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M20-SHA-049 | link | hidden-only | "Subjektif" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M20-SHA-050 | toggle | visible-default | "Premium" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M20-SHA-051 | link | hidden-only | "PKSK Soalan" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M20-SHA-052 | link | hidden-only | "PKSK Akses" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M20-SHA-053 | text | visible-default | "SISTEM" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M20-SHA-054 | toggle | visible-default | "Gamifikasi" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M20-SHA-055 | link | hidden-only | "Overview", → /admin/gamification | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M20-SHA-056 | link | hidden-only | "Tier Config" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M20-SHA-057 | link | hidden-only | "Cabaran" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M20-SHA-058 | link | hidden-only | "Pelajar" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M20-SHA-059 | link | hidden-only | "Transaksi" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M20-SHA-060 | link | hidden-only | "Kedai Hadiah", → /admin/hadiah (M15, not the marketplace) | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M20-SHA-061 | link | hidden-only | "Gamifikasi Guru" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M20-SHA-062 | link | hidden-only | "Kawalan Reward" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M20-SHA-063 | toggle | visible-default | "Battle & Permainan" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M20-SHA-064 | link | hidden-only | "Battle Live" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M20-SHA-065 | link | hidden-only | "Ranking Sekolah" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M20-SHA-066 | link | hidden-only | "Leaderboard" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M20-SHA-067 | link | hidden-only | "Tetapan Permainan" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M20-SHA-068 | toggle | visible-default | "Marketplace", fa-shopping-bag | Excluded — admin shell renders it; M20 entry specified by FN-M20-1.1.1 |
| EL-M20-SHA-069 | link | visible-default | "Produk", → /admin/marketplace/products, fa-shopping-bag | Excluded — admin shell renders it; M20 entry specified by FN-M20-1.1.1 |
| EL-M20-SHA-070 | link | visible-default | "Penjual", → /admin/marketplace/sellers, fa-store | Excluded — admin shell renders it; M20 entry specified by FN-M20-1.1.1 |
| EL-M20-SHA-071 | toggle | visible-default | "Kandungan" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M20-SHA-072 | link | hidden-only | "Banner" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M20-SHA-073 | link | hidden-only | "Artikel" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M20-SHA-074 | link | hidden-only | "Nota" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M20-SHA-075 | link | hidden-only | "Push Notifikasi" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M20-SHA-076 | link | hidden-only | "Upload Screenshot" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M20-SHA-077 | toggle | visible-default | "Kewangan" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M20-SHA-078 | link | hidden-only | "Pembayaran" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M20-SHA-079 | link | hidden-only | "Billing Dashboard" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M20-SHA-080 | link | hidden-only | "Dunning Log" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M20-SHA-081 | toggle | visible-default | "Sistem" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M20-SHA-082 | link | hidden-only | "Performance" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M20-SHA-083 | link | hidden-only | "Tetapan" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M20-SHA-084 | link | hidden-only | "Log Audit" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M20-SHA-085 | link | hidden-only | "Chatbot" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M20-SHA-086 | text | visible-default | "🏆 Bilik Duta" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M20-SHA-087 | badge | visible-default | "DEV" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M20-SHA-088 | link | visible-default | "Bilik Duta" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M20-SHA-089 | link | visible-default | "Akademi Duta" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M20-SHA-090 | link | visible-default | "Permohonan Duta" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M20-SHA-091 | link | visible-default | "Duta Dashboard" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M20-SHA-092 | link | visible-default | "Jemput Duta" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M20-SHA-093 | link | visible-default | "Kem & Bootcamp" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M20-SHA-094 | text | visible-default | "🤖 Pusat AI" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M20-SHA-095 | link | visible-default | "Kamus AI" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M20-SHA-096 | link | visible-default | "Aktiviti Advisor" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M20-SHA-097 | link | visible-default | "Pendamping Motivasi" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M20-SHA-098 | link | visible-default | "SPM Walkthrough" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M20-SHA-099 | link | visible-default | "Whiteboard → Quiz" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M20-SHA-100 | link | visible-default | "Parent Whisperer" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M20-SHA-101 | link | visible-default | "Doa & Motivasi" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M20-SHA-102 | text | visible-default | "✨ Visi & Pertandingan" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M20-SHA-103 | link | visible-default | "Profil Cerah" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M20-SHA-104 | link | visible-default | "Sekolah Bersaing" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M20-SHA-105 | link | visible-default | "Cita-Cita Hijrah" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M20-SHA-106 | link | visible-default | "Streak / Kombo" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M20-SHA-107 | text | visible-default | "💎 Killer Features" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M20-SHA-108 | link | visible-default | "Cikgu Suara" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M20-SHA-109 | link | visible-default | "SPM Mock Exam" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M20-SHA-110 | link | visible-default | "Wellbeing Alerts" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M20-SHA-111 | link | visible-default | "Tetapan Peribadi" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M20-SHA-112 | link | visible-default | "Ke Dashboard" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M20-SHA-113 | card | visible-default | "Admin PRESTASI+" (user card; seed "Admin Demo", M01) | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M20-SHA-114 | image | visible-default | avatar | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M20-SHA-115 | text | visible-default | "Admin PRESTASI+" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M20-SHA-116 | text | visible-default | "Admin" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M20-SHA-117 | link | visible-default | → /logout, title "Log Keluar" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M20-SHA-118 | heading | visible-default | "Marketplace - Produk" | Excluded — admin shell header; M20 title specified by FN-M20-1.1.3 |
| EL-M20-SHA-119 | text | visible-default | "Urus semua produk marketplace" | Excluded — admin shell header; M20 title specified by FN-M20-1.1.3 |
| EL-M20-SHA-120 | tooltip | hidden-only | "Uptime" | Excluded — admin-shell server-status chips (M23) |
| EL-M20-SHA-121 | tooltip | visible-default | "Load: 0.21 / 8 cores" | Excluded — admin-shell server-status chips (M23) |
| EL-M20-SHA-122 | text | visible-default | "3%" | Excluded — admin-shell server-status chips (M23) |
| EL-M20-SHA-123 | tooltip | visible-default | "19.2GB / 31.1GB" | Excluded — admin-shell server-status chips (M23) |
| EL-M20-SHA-124 | text | visible-default | "62%" | Excluded — admin-shell server-status chips (M23) |
| EL-M20-SHA-125 | tooltip | visible-default | "201.1GB / 398.7GB" | Excluded — admin-shell server-status chips (M23) |
| EL-M20-SHA-126 | text | visible-default | "50%" | Excluded — admin-shell server-status chips (M23) |
| EL-M20-SHA-127 | tooltip | visible-default | "Uptime" | Excluded — admin-shell server-status chips (M23) |
| EL-M20-SHA-128 | text | visible-default | "205d 18h" | Excluded — admin-shell server-status chips (M23) |
| EL-M20-SHA-129 | image | visible-default | avatar | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M20-SHA-130 | link | visible-default | → /logout, title "Log Keluar" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M20-SHA-131 | link | conditional | → /admin | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M20-SHA-132 | image | conditional | image | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M20-SHA-133 | text | visible-default | "© 2026 PRESTASIPLUS. Hakcipta Terpelihara." | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M20-SHA-134 | text | visible-default | "Didikan penuh dari Malaysia 🇲🇾" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M20-SHA-135 | text | visible-default | "❤️" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M20-SHA-136 | link | conditional | "Dashboard" (bottom nav) | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M20-SHA-137 | link | conditional | "Soalan" (bottom nav) | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M20-SHA-138 | link | conditional | "Penaja" (bottom nav) | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M20-SHA-139 | link | conditional | "Pengguna" (bottom nav) | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M20-SHA-140 | dropdown-trigger | conditional | "Lagi", fa-ellipsis-h | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M20-SHA-141 | card | hidden-only | "SPM" (drawer) | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M20-SHA-142 | link | hidden-only | "Analitik" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M20-SHA-143 | link | hidden-only | "Laporan Aktiviti" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M20-SHA-144 | link | hidden-only | "Monitoring" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M20-SHA-145 | link | hidden-only | "Kirkpatrick" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M20-SHA-146 | text | hidden-only | "SPM" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M20-SHA-147 | link | hidden-only | "Databank Soalan" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M20-SHA-148 | link | hidden-only | "Latih Tubi" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M20-SHA-149 | link | hidden-only | "Tracking A" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M20-SHA-150 | link | hidden-only | "Subjektif" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M20-SHA-151 | text | hidden-only | "Soalan" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M20-SHA-152 | link | hidden-only | "Import CSV" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M20-SHA-153 | link | hidden-only | "Kualiti Soalan" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M20-SHA-154 | link | hidden-only | "Laporan Soalan" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M20-SHA-155 | link | hidden-only | "Soalan Berstruktur" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M20-SHA-156 | link | hidden-only | "Kertas Soalan Guru" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M20-SHA-157 | text | hidden-only | "Kurikulum" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M20-SHA-158 | link | hidden-only | "Kurikulum" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M20-SHA-159 | link | hidden-only | "Subjek" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M20-SHA-160 | link | hidden-only | "Tahap Pendidikan" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M20-SHA-161 | text | hidden-only | "Premium" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M20-SHA-162 | link | hidden-only | "PKSK Soalan" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M20-SHA-163 | link | hidden-only | "PKSK Akses" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M20-SHA-164 | text | hidden-only | "Gamifikasi" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M20-SHA-165 | link | hidden-only | "Overview" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M20-SHA-166 | link | hidden-only | "Tier Config" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M20-SHA-167 | link | hidden-only | "Cabaran" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M20-SHA-168 | link | hidden-only | "Kedai Hadiah" (M15) | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M20-SHA-169 | link | hidden-only | "Gamifikasi Guru" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M20-SHA-170 | text | hidden-only | "Battle & Permainan" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M20-SHA-171 | link | hidden-only | "Battle Live" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M20-SHA-172 | link | hidden-only | "Tetapan Permainan" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M20-SHA-173 | text | hidden-only | "Kandungan" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M20-SHA-174 | link | hidden-only | "Banner" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M20-SHA-175 | link | hidden-only | "Artikel" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M20-SHA-176 | link | hidden-only | "Nota" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M20-SHA-177 | link | hidden-only | "Push Notifikasi" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M20-SHA-178 | link | hidden-only | "Chatbot" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M20-SHA-179 | link | hidden-only | "Upload Screenshot" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M20-SHA-180 | text | hidden-only | "Marketplace" (drawer section) | Excluded — admin shell renders it; M20 entry specified by FN-M20-1.1.1 |
| EL-M20-SHA-181 | link | hidden-only | "Produk", → /admin/marketplace/products, fa-shopping-bag | Excluded — admin shell renders it; M20 entry specified by FN-M20-1.1.1 |
| EL-M20-SHA-182 | link | hidden-only | "Penjual", → /admin/marketplace/sellers, fa-store | Excluded — admin shell renders it; M20 entry specified by FN-M20-1.1.1 |
| EL-M20-SHA-183 | text | hidden-only | "Sistem" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M20-SHA-184 | link | hidden-only | "Sekolah" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M20-SHA-185 | link | hidden-only | "Langganan Sekolah" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M20-SHA-186 | link | hidden-only | "Tetapan" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M20-SHA-187 | link | hidden-only | "Pembayaran" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M20-SHA-188 | link | hidden-only | "Billing Dashboard" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M20-SHA-189 | link | hidden-only | "Dunning Log" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M20-SHA-190 | link | hidden-only | "Log Audit" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M20-SHA-191 | link | hidden-only | "Performance" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M20-SHA-192 | link | hidden-only | "Import Pelajar" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M20-SHA-193 | link | hidden-only | "Import Pengguna" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M20-SHA-194 | link | hidden-only | "Student View" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M20-SHA-195 | link | hidden-only | "Log Keluar" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M20-SHA-196 | tooltip | conditional | "Load: 0.26 / 8 cores" | Excluded — admin-shell server-status chips (M23) |
| EL-M20-SHA-197 | tooltip | conditional | "19.3GB / 31.1GB" | Excluded — admin-shell server-status chips (M23) |
| EL-M20-SHA-198 | tooltip | conditional | "Load: 0.28 / 8 cores" | Excluded — admin-shell server-status chips (M23) |
| EL-M20-SHA-199 | heading | conditional | "Tambah Produk Marketplace" | Excluded — admin shell header; M20 title specified by FN-M20-1.1.3 |
| EL-M20-SHA-200 | text | conditional | "Admin feed produk ke marketplace" | Excluded — admin shell header; M20 title specified by FN-M20-1.1.3 |
| EL-M20-SHA-201 | tooltip | conditional | "Load: 0.24 / 8 cores" | Excluded — admin-shell server-status chips (M23) |
| EL-M20-SHA-202 | heading | conditional | "Edit Produk" | Excluded — admin shell header; M20 title specified by FN-M20-1.1.3 |
| EL-M20-SHA-203 | text | conditional | "<name>" (product name, over-masked by discovery) | Excluded — admin shell header; M20 title specified by FN-M20-1.1.3 |
| EL-M20-SHA-204 | tooltip | conditional | "Load: 0.2 / 8 cores" | Excluded — admin-shell server-status chips (M23) |
| EL-M20-SHA-205 | heading | conditional | "Marketplace - Penjual" | Excluded — admin shell header; M20 title specified by FN-M20-1.1.3 |
| EL-M20-SHA-206 | text | conditional | "Urus dan sahkan penjual" | Excluded — admin shell header; M20 title specified by FN-M20-1.1.3 |
| EL-M20-SHA-207 | tooltip | conditional | "19.5GB / 31.1GB" | Excluded — admin-shell server-status chips (M23) |
| EL-M20-SHA-208 | tooltip | hidden-only | "19.4GB / 31.1GB" | Excluded — admin-shell server-status chips (M23) |
| EL-M20-SHA-209 | heading | conditional | "Semak Penjual" | Excluded — admin shell header; M20 title specified by FN-M20-1.1.3 |
| EL-M20-SHA-210 | text | conditional | "JomBelajar Official" | Excluded — admin shell header; M20 title specified by FN-M20-1.1.3 |
| EL-M20-SHA-211 | tooltip | conditional | "Load: 0.31 / 8 cores" | Excluded — admin-shell server-status chips (M23) |
| EL-M20-SHA-212 | tooltip | conditional | "201.4GB / 398.7GB" | Excluded — admin-shell server-status chips (M23) |

#### SHU — user-portal shell (chrome of S6–S12) — 383 elements, all excluded (19 carry an M20 entry or title specified by FN-M20-1.1.2 / 1.1.3)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M20-SHU-001 | link | visible-default | → /dashboard | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-002 | image | visible-default | image | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-003 | text | visible-default | "Platform Latih Tubi Nasional" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-004 | link | visible-default | "Dashboard" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-005 | link | visible-default | "Target SPM" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-006 | link | visible-default | "Misi Harian" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-007 | link | visible-default | "Remedial" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-008 | text | visible-default | "SPM" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-009 | link | visible-default | "SPM SPM" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-010 | badge | visible-default | "SPM" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-011 | link | visible-default | "Headcount" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-012 | link | visible-default | "Prestasi" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-013 | link | visible-default | "Analitik Adaptif" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-014 | link | visible-default | "Analisa Item" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-015 | link | visible-default | "Kombo" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-016 | link | visible-default | "Laporan Mingguan" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-017 | text | visible-default | "Pusat AI" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-018 | badge | visible-default | "NEW" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-019 | text | visible-default | "🤖 Cikgu Alesa AI" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-020 | link | visible-default | "Cikgu Alesa Chat AI" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-021 | badge | visible-default | "AI" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-022 | text | visible-default | "✨ Visi & Pertandingan" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-023 | link | visible-default | "Sekolah Bersaing NEW" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-024 | badge | visible-default | "NEW" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-025 | link | visible-default | "Tetapan Peribadi" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-026 | text | visible-default | "🏆 Bilik Duta · 🔒 PREVIEW" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-027 | link | visible-default | "Bilik Duta DEV" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-028 | badge | visible-default | "DEV" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-029 | text | visible-default | "🤖 AI Pintar (Pelajar)" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-030 | link | visible-default | "Wellbeing Alerts" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-031 | link | visible-default | "Kamus AI" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-032 | link | visible-default | "Pendamping Motivasi" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-033 | link | visible-default | "Doa & Motivasi" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-034 | text | visible-default | "🎯 AI Pintar (Guru)" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-035 | link | visible-default | "Aktiviti Advisor" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-036 | link | visible-default | "Whiteboard → Quiz" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-037 | link | visible-default | "RPH (Cikgu Alesa)" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-038 | link | visible-default | "Semak Karangan (Cikgu Alesa)" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-039 | link | visible-default | "PBD (Cikgu Alesa)" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-040 | text | visible-default | "🛡️ Kawalan Kualiti" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-041 | link | visible-default | "Semakan Nota Master" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-042 | link | visible-default | "Audit Log" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-043 | text | visible-default | "🏆 Bilik Duta" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-044 | link | visible-default | "Bilik Duta" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-045 | link | visible-default | "Akademi Duta" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-046 | link | visible-default | "Kem & Bootcamp" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-047 | text | visible-default | "✨ Visi & Pertandingan" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-048 | link | visible-default | "Profil Cerah" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-049 | link | visible-default | "Sekolah Bersaing" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-050 | link | visible-default | "Cita-Cita Hijrah" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-051 | text | visible-default | "💎 Killer Features" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-052 | link | visible-default | "Cikgu Suara" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-053 | link | visible-default | "SPM Mock Exam" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-054 | link | visible-default | "Wellbeing Alerts" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-055 | link | visible-default | "Pembetulan" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-056 | link | visible-default | "Mohon Keluarga Angkat" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-057 | link | visible-default | "Penguasaan" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-058 | link | visible-default | "Laporan Soalan" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-059 | link | visible-default | "Liga Pertandingan" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-060 | link | visible-default | "Perutusan" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-061 | text | visible-default | "Pembelajaran" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-062 | link | visible-default | "Latih Tubi" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-063 | link | visible-default | "Soalan by Chapter" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-064 | link | visible-default | "Soalan Berstruktur" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-065 | link | visible-default | "Kedudukan" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-066 | link | visible-default | "PKSK PRO" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-067 | badge | visible-default | "PRO" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-068 | link | visible-default | "Artikel" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-069 | link | visible-default | "Video" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-070 | link | visible-default | "Permainan 🎮" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-071 | badge | visible-default | "🎮" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-072 | link | visible-default | "Cabutan Bertuah 🎟️" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-073 | badge | visible-default | "🎟️" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-074 | link | visible-default | "Tournament" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-075 | link | visible-default | "Topik" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-076 | link | visible-default | "Peta Belajar" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-077 | link | visible-default | "Kelas Saya" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-078 | link | visible-default | "Set Soalan Guru" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-079 | link | visible-default | "Audio KBAT" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-080 | link | visible-default | "Syiling & Token 🏆" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-081 | badge | visible-default | "🏆" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-082 | link | visible-default | "Tukar Token" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-083 | link | visible-default | "Cabaran Harian" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-084 | link | visible-default | "Kedai Hadiah", → /gamification/rewards (M15, not the marketplace) | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-085 | link | visible-default | "Kelulusan Hadiah" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-086 | link | visible-default | "Marketplace", → /marketplace | Excluded — user shell renders it; M20 entry specified by FN-M20-1.1.2 |
| EL-M20-SHU-087 | link | visible-default | "Papan Pendahulu" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-088 | link | visible-default | "Pencapaian" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-089 | link | visible-default | "Kotak Misteri" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-090 | link | visible-default | "Rujuk Kawan" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-091 | link | visible-default | "Cikgu Alesa AI" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-092 | badge | visible-default | "AI" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-093 | text | visible-default | "Cikgu Alesa Tools" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-094 | link | visible-default | "RPH (Rancangan Harian)" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-095 | link | visible-default | "PBD Auto-Tag" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-096 | link | visible-default | "Mark Karangan" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-097 | link | visible-default | "Admin Tebusan" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-098 | link | visible-default | "Timeline Saya" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-099 | text | visible-default | "Portal Guru" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-100 | link | visible-default | "Dashboard Guru" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-101 | link | visible-default | "Kelas Guru" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-102 | link | visible-default | "Sumbang Soalan" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-103 | link | visible-default | "Databank Soalan" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-104 | text | visible-default | "PPD / JPN" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-105 | link | visible-default | "Dashboard PPD" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-106 | link | visible-default | "Statistik PPD" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-107 | link | visible-default | "Ranking Kebangsaan" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-108 | link | visible-default | "Dashboard JPN" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-109 | link | visible-default | "Ranking Kebangsaan JPN" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-110 | text | visible-default | "Admin" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-111 | link | visible-default | "Ke Admin Panel" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-112 | link | visible-default | "Soalan by Chapter" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-113 | link | visible-default | "Billing Dashboard" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-114 | link | visible-default | "Urus Produk", → /admin/marketplace/products | Excluded — user shell renders it; M20 entry specified by FN-M20-1.1.2 |
| EL-M20-SHU-115 | link | visible-default | "Urus Penjual", → /admin/marketplace/sellers | Excluded — user shell renders it; M20 entry specified by FN-M20-1.1.2 |
| EL-M20-SHU-116 | link | visible-default | "Urus Hadiah" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-117 | link | visible-default | "Gamifikasi Guru" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-118 | link | visible-default | "Kertas Soalan Guru" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-119 | link | visible-default | "Profil Saya" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-120 | link | visible-default | "Pakej 💎" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-121 | badge | visible-default | "💎" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-122 | link | visible-default | "Invois Saya" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-123 | link | visible-default | "Panduan" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-124 | text | visible-default | "Bantuan" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-125 | link | visible-default | "Tiket Bantuan" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-126 | link | visible-default | "Gambar Rajah 6,144" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-127 | badge | visible-default | "6,144" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-128 | link | visible-default | "Urus Tiket 2" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-129 | badge | visible-default | "2" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-130 | card | visible-default | "<name>" (user card) | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-131 | image | visible-default | avatar | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-132 | text | visible-default | "<name>" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-133 | text | visible-default | "<masked>" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-134 | link | visible-default | → /logout | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-135 | toggle | visible-default | menu toggle | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-136 | heading | visible-default | "Marketplace" | Excluded — user shell header; M20 title specified by FN-M20-1.1.3 |
| EL-M20-SHU-137 | text | visible-default | "Peralatan sekolah untuk pelajar 🛒" | Excluded — user shell header; M20 title specified by FN-M20-1.1.3 |
| EL-M20-SHU-138 | text | visible-default | "256" (M14 coins) | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-139 | text | visible-default | "koin" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-140 | text | visible-default | "8" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-141 | text | visible-default | "mata" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-142 | text | visible-default | "1" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-143 | text | visible-default | "hari 🔥" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-144 | link | visible-default | "99+", → /notifikasi | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-145 | badge | visible-default | "99+" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-146 | image | visible-default | avatar | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-147 | link | visible-default | → /logout | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-148 | toggle | conditional | menu toggle | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-149 | link | conditional | → /dashboard | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-150 | image | conditional | image | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-151 | text | conditional | "256" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-152 | text | conditional | "koin" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-153 | text | conditional | "8" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-154 | text | conditional | "mata" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-155 | text | conditional | "1" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-156 | text | conditional | "🔥" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-157 | text | visible-default | "© 2026 PRESTASIPLUS. Hakcipta Terpelihara" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-158 | text | visible-default | "✨" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-159 | text | visible-default | "Didikan penuh dari Malaysia" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-160 | text | visible-default | "❤️" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-161 | text | visible-default | "🇲🇾" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-162 | clickable | hidden-only | drawer backdrop | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-163 | modal | hidden-only | "<name>" (mobile drawer) | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-164 | image | hidden-only | image | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-165 | text | hidden-only | "Platform Latih Tubi Nasional" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-166 | button | hidden-only | close | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-167 | image | hidden-only | avatar | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-168 | text | hidden-only | "<name>" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-169 | text | hidden-only | "admin" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-170 | link | hidden-only | "Dashboard" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-171 | modal | hidden-only | "SPM" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-172 | text | hidden-only | "SPM" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-173 | link | hidden-only | "SPM SPM" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-174 | badge | hidden-only | "SPM" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-175 | link | hidden-only | "Headcount" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-176 | link | hidden-only | "Prestasi" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-177 | link | hidden-only | "Analisa Item" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-178 | link | hidden-only | "Amaran Awal" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-179 | link | hidden-only | "Kombo" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-180 | link | hidden-only | "Cikgu Alesa AI" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-181 | badge | hidden-only | "AI" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-182 | link | hidden-only | "RPH" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-183 | link | hidden-only | "PBD Auto-Tag" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-184 | link | hidden-only | "Mark Karangan" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-185 | link | hidden-only | "Laporan Mingguan" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-186 | link | hidden-only | "Pembetulan" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-187 | link | hidden-only | "Penguasaan" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-188 | link | hidden-only | "Laporan Soalan" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-189 | link | hidden-only | "Command Center LIVE" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-190 | badge | hidden-only | "LIVE" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-191 | link | hidden-only | "Dashboard PPD" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-192 | link | hidden-only | "Statistik Penggunaan" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-193 | link | hidden-only | "Ranking Kebangsaan" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-194 | link | hidden-only | "Benchmark Sekolah" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-195 | link | hidden-only | "Peta Haba" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-196 | link | hidden-only | "Export Laporan" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-197 | link | hidden-only | "Leaderboard Sekolah" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-198 | link | hidden-only | "Dashboard JPN" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-199 | link | hidden-only | "Statistik Penggunaan" (JPN) | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-200 | link | hidden-only | "Ranking Kebangsaan" (JPN) | Excluded — user shell chrome (shells.md; owning modules) |

| EL-M20-SHU-201 | modal | hidden-only | "Pembelajaran" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-202 | text | hidden-only | "Pembelajaran" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-203 | link | hidden-only | "Latih Tubi" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-204 | link | hidden-only | "Soalan by Chapter" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-205 | link | hidden-only | "Soalan Berstruktur" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-206 | link | hidden-only | "Kedudukan" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-207 | link | hidden-only | "PKSK PRO" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-208 | badge | hidden-only | "PRO" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-209 | link | hidden-only | "Artikel" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-210 | link | hidden-only | "Video" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-211 | link | hidden-only | "Permainan 🎮" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-212 | badge | hidden-only | "🎮" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-213 | link | hidden-only | "Cabutan Bertuah 🎟️" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-214 | badge | hidden-only | "🎟️" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-215 | link | hidden-only | "Tournament" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-216 | link | hidden-only | "Topik" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-217 | link | hidden-only | "Peta Belajar" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-218 | link | hidden-only | "Command Center LIVE" (guru) | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-219 | badge | hidden-only | "LIVE" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-220 | text | hidden-only | "Pusat AI" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-221 | badge | hidden-only | "NEW" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-222 | text | hidden-only | "🤖 Cikgu Alesa AI" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-223 | link | hidden-only | "Cikgu Alesa Chat AI" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-224 | badge | hidden-only | "AI" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-225 | text | hidden-only | "✨ Visi & Pertandingan" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-226 | link | hidden-only | "Sekolah Bersaing NEW" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-227 | badge | hidden-only | "NEW" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-228 | link | hidden-only | "Tetapan Peribadi" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-229 | text | hidden-only | "🏆 Bilik Duta · 🔒 PREVIEW" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-230 | link | hidden-only | "Bilik Duta DEV" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-231 | badge | hidden-only | "DEV" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-232 | text | hidden-only | "🤖 AI Pintar (Pelajar)" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-233 | link | hidden-only | "Wellbeing Alerts" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-234 | link | hidden-only | "Kamus AI" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-235 | link | hidden-only | "Pendamping Motivasi" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-236 | link | hidden-only | "Doa & Motivasi" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-237 | text | hidden-only | "🎯 AI Pintar (Guru)" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-238 | link | hidden-only | "Aktiviti Advisor" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-239 | link | hidden-only | "Whiteboard → Quiz" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-240 | link | hidden-only | "RPH (Cikgu Alesa)" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-241 | link | hidden-only | "Semak Karangan (Cikgu Alesa)" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-242 | link | hidden-only | "PBD (Cikgu Alesa)" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-243 | text | hidden-only | "🛡️ Kawalan Kualiti" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-244 | link | hidden-only | "Semakan Nota Master" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-245 | link | hidden-only | "Audit Log" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-246 | modal | hidden-only | "HARIAN" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-247 | text | hidden-only | "HARIAN" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-248 | link | hidden-only | "Dashboard Guru" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-249 | link | hidden-only | "Misi Harian" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-250 | link | hidden-only | "Soalan by Chapter" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-251 | link | hidden-only | "Kelas Saya" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-252 | link | hidden-only | "Pelajar Saya" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-253 | link | hidden-only | "Kehadiran Digital" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-254 | modal | hidden-only | "PENGAJARAN" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-255 | text | hidden-only | "PENGAJARAN" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-256 | link | hidden-only | "Jadual Belajar" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-257 | link | hidden-only | "Broadcast" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-258 | link | hidden-only | "Kelas Live" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-259 | modal | hidden-only | "PENILAIAN" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-260 | text | hidden-only | "PENILAIAN" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-261 | link | hidden-only | "Headcount" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-262 | link | hidden-only | "Prestasi" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-263 | link | hidden-only | "Laporan" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-264 | link | hidden-only | "Amaran Awal" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-265 | modal | hidden-only | "ANALITIK" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-266 | text | hidden-only | "ANALITIK" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-267 | link | hidden-only | "Monitoring" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-268 | toggle | hidden-only | "Kirkpatrick" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-269 | link | hidden-only | "Ringkasan" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-270 | link | hidden-only | "T1: Reaksi" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-271 | link | hidden-only | "T2: Pembelajaran" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-272 | link | hidden-only | "T3: Tingkah Laku" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-273 | link | hidden-only | "T4: Hasil" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-274 | link | hidden-only | "Rantaian Impak" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-275 | link | hidden-only | "Intervensi" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-276 | link | hidden-only | "Analisis Item" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-277 | link | hidden-only | "Perbandingan Kelas" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-278 | link | hidden-only | "Laporan Mingguan" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-279 | modal | hidden-only | "BANK SOALAN" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-280 | text | hidden-only | "BANK SOALAN" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-281 | link | hidden-only | "Sumbang Soalan" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-282 | link | hidden-only | "Soalan & Rujukan" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-283 | link | hidden-only | "Soalan Berstruktur" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-284 | link | hidden-only | "Databank Soalan" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-285 | link | hidden-only | "Set Soalan" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-286 | modal | hidden-only | "LAIN-LAIN" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-287 | text | hidden-only | "LAIN-LAIN" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-288 | link | hidden-only | "Syiling & Ganjaran" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-289 | link | hidden-only | "Sumbang Artikel" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-290 | link | hidden-only | "Video" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-291 | link | hidden-only | "Kelas Saya BARU" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-292 | badge | hidden-only | "BARU" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-293 | link | hidden-only | "Set Soalan Guru" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-294 | modal | hidden-only | "Gamifikasi" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-295 | text | hidden-only | "Gamifikasi" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-296 | link | hidden-only | "Syiling & Token" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-297 | link | hidden-only | "Tukar Token" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-298 | link | hidden-only | "Cabaran Harian" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-299 | link | hidden-only | "Kedai Hadiah" (M15) | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-300 | link | hidden-only | "Marketplace", → /marketplace (drawer) | Excluded — user shell renders it; M20 entry specified by FN-M20-1.1.2 |
| EL-M20-SHU-301 | link | hidden-only | "Papan Pendahulu" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-302 | link | hidden-only | "Pencapaian" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-303 | link | hidden-only | "Kotak Misteri" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-304 | link | hidden-only | "Rujuk Kawan" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-305 | link | hidden-only | "Timeline Saya" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-306 | link | hidden-only | "Invois Saya" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-307 | link | hidden-only | "Ke Admin Panel" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-308 | link | hidden-only | "Soalan by Chapter" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-309 | link | hidden-only | "Billing Dashboard" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-310 | link | hidden-only | "Urus Produk", → /admin/marketplace/products (drawer) | Excluded — user shell renders it; M20 entry specified by FN-M20-1.1.2 |
| EL-M20-SHU-311 | link | hidden-only | "Urus Penjual", → /admin/marketplace/sellers (drawer) | Excluded — user shell renders it; M20 entry specified by FN-M20-1.1.2 |
| EL-M20-SHU-312 | link | hidden-only | "Urus Hadiah" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-313 | link | hidden-only | "Gamifikasi Guru" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-314 | link | hidden-only | "Profil Saya" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-315 | link | hidden-only | "Tetapan" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-316 | link | hidden-only | "Panduan" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-317 | link | hidden-only | "Log Keluar" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-318 | text | hidden-only | "© 2026 PRESTASIPLUS 🇲🇾" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-319 | text | hidden-only | "Pasang PRESTASIPLUS" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-320 | text | hidden-only | "Akses pantas dari skrin utama" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-321 | button | hidden-only | "Pasang" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-322 | button | hidden-only | "10" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-323 | card | hidden-only | "Pasang PRESTASIPLUS" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-324 | image | hidden-only | image | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-325 | heading | hidden-only | "Pasang PRESTASIPLUS" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-326 | text | hidden-only | "Ikuti langkah berikut:" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-327 | badge | hidden-only | "1" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-328 | text | hidden-only | "Tekan ikon Share" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-329 | text | hidden-only | "Ikon di bawah skrin Safari" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-330 | badge | hidden-only | "2" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-331 | text | hidden-only | "Pilih "Add to Home Screen"" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-332 | text | hidden-only | "Scroll ke bawah, tekan Add to Home Screen" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-333 | badge | hidden-only | "3" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-334 | text | hidden-only | "Tekan "Add"" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-335 | text | hidden-only | "PRESTASIPLUS akan muncul di skrin utama anda" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-336 | button | hidden-only | "Faham!" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-337 | link | conditional | "Home" (bottom nav) | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-338 | link | conditional | "SPM" (bottom nav) | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-339 | link | conditional | "Game" (bottom nav) | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-340 | link | conditional | "Topik" (bottom nav) | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-341 | toggle | conditional | "Chat" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-342 | toggle | conditional | "Lagi" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-343 | card | hidden-only | "Pembantu PrestasiPlus" (chatbot) | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-344 | text | hidden-only | "Pembantu PrestasiPlus" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-345 | text | hidden-only | "Sedia membantu anda" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-346 | button | hidden-only | close | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-347 | heading | hidden-only | "Selamat Datang!" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-348 | text | hidden-only | "Sila masukkan maklumat anda sebelum memulakan perbualan." | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-349 | form | hidden-only | chatbot form | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-350 | label | hidden-only | "Nama" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-351 | input | hidden-only | input | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-352 | label | hidden-only | "No. Telefon" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-353 | input | hidden-only | input | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-354 | button | hidden-only | "Mula Berbual" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-355 | card | hidden-only | chat card | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-356 | text | hidden-only | "Selamat datang, ! Saya Pembantu Maya PrestasiPlus. Bagaimana saya boleh membantu anda hari ini?" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-357 | button | hidden-only | "Apakah PrestasiPlus?" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-358 | button | hidden-only | "Cara mendaftar" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-359 | button | hidden-only | "Harga langganan" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-360 | card | hidden-only | "<name>" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-361 | text | hidden-only | "Selamat datang, ! Saya Pembantu Maya PrestasiPlus. Bagaimana saya boleh membantu anda hari ini?" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-362 | text | hidden-only | "<name>" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-363 | button | hidden-only | "Apakah PrestasiPlus?" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-364 | button | hidden-only | "Cara mendaftar" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-365 | button | hidden-only | "Harga langganan" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-366 | button | hidden-only | button | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-367 | button | hidden-only | button | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-368 | form | hidden-only | chat input form | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-369 | textarea | hidden-only | textarea | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-370 | button | hidden-only | send | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-371 | text | hidden-only | "Dikuasakan oleh AI · Jawapan mungkin tidak sentiasa tepat" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-372 | toggle | hidden-only | chatbot toggle | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M20-SHU-373 | text | conditional | "Peralatan Sekolah" (S7 subtitle) | Excluded — user shell header; M20 title specified by FN-M20-1.1.3 |
| EL-M20-SHU-374 | text | conditional | "Buku & Rujukan" (S7 subtitle) | Excluded — user shell header; M20 title specified by FN-M20-1.1.3 |
| EL-M20-SHU-375 | heading | conditional | "Kedai Penjual" | Excluded — user shell header; M20 title specified by FN-M20-1.1.3 |
| EL-M20-SHU-376 | text | conditional | "JomBelajar Official" | Excluded — user shell header; M20 title specified by FN-M20-1.1.3 |
| EL-M20-SHU-377 | heading | conditional | "Dashboard Penjual" | Excluded — user shell header; M20 title specified by FN-M20-1.1.3 |
| EL-M20-SHU-378 | text | conditional | "<name>" (shop name, over-masked by discovery) | Excluded — user shell header; M20 title specified by FN-M20-1.1.3 |
| EL-M20-SHU-379 | heading | conditional | "Produk Saya" | Excluded — user shell header; M20 title specified by FN-M20-1.1.3 |
| EL-M20-SHU-380 | text | conditional | "Urus senarai produk anda" | Excluded — user shell header; M20 title specified by FN-M20-1.1.3 |
| EL-M20-SHU-381 | heading | conditional | "Tambah Produk" | Excluded — user shell header; M20 title specified by FN-M20-1.1.3 |
| EL-M20-SHU-382 | text | conditional | "Senaraikan produk baru di marketplace" | Excluded — user shell header; M20 title specified by FN-M20-1.1.3 |
| EL-M20-SHU-383 | heading | conditional | "Edit Produk" | Excluded — user shell header; M20 title specified by FN-M20-1.1.3 |

---

## 7. Fidelity deviations

These are the **only** intended differences from the live site. Anything not listed must match live (D7). Rule D9 (user, standing, pre-approved): where live is broken or contradictory, fix it minimally; where it works, replicate it exactly; when unsure, follow live. D10: accessibility replicates live. Privacy overrides fidelity for personal data. Delivery Lead precedents applied: 405 on a route → global 404 (M19 DV-M19-07); fictitious contact number (M19 DV-M19-09); canonical account 1 shown as "Admin Demo" (M09). Rows "Rejected — replicate live" were considered and deliberately not changed.

| ID | Discovery | Category | Live behaviour (evidence) | Rebuild behaviour (specified) and alternatives | Status |
|---|---|---|---|---|---|
| DV-M20-01 | D-M20-01 | Broken control | S3: the image-delete forms are nested inside the product form. The browser drops the first nested `<form>` tag; its `</form>` closes the product form early. "Simpan Perubahan" and the new-image input end up outside every form (saving does nothing); the first image's × joins the product form with `_method` PUT **and** DELETE and no confirm (INFERRED: would delete the product) (EL S3-062–064, S3-082–083). | Separate forms: "Simpan Perubahan" submits the product form with every field and the new images; every × — the first included — deletes only its image after "Padam gambar ini?" (FN-M20-2.3.5–2.3.6). Alternatives: (a) keep the live DOM — rejected (a save button that does nothing and a destructive button without confirm); (b) move the image deletes to a separate "Urus Gambar" page — rejected (new UX, not minimal). | Approved (D9) |
| DV-M20-02 | D-M20-02 | Unbranded error page | `GET /admin/marketplace/products/{id}` and `GET /seller/produk/{id}` → Symfony "Oops! An Error Occurred" / "The server returned a "405 Method Not Allowed"." (reachable only by typing the URL) (EL S3-098–100, S12-051–053). | Global 404 page (M19 DV-M19-07 precedent). Alternatives: (a) a branded 405 page — rejected (new page); (b) redirect to S3 / S12 — rejected (invents a show route). | Approved (D9, DL precedent) |
| DV-M20-03 | D-M20-03 | Broken images | S5 "Produk (10)": all 10 thumbnails point to `/storage/uploads/products/…` and fail to load; every other screen uses `/uploads/products/…` (EL S5-017–044 images). | The same image URL as the other screens (FN-M20-3.2.4). Alternative: hide the thumbnails — rejected (changes the layout). | Approved (D9) |
| DV-M20-04 | D-M20-04 | Candidate — figures follow the filter | S4's four cards are computed over the filtered sellers: with `pending`, `suspended` or `banned` all read 0 while one active seller exists. | **Rejected — replicate live.** On every filter the cards agree with the list under them (0 cards + "Tiada penjual dijumpai"; the same seller counted under "Aktif"); it is a consistent "figures of this filter" design, not a contradiction on the page; D9 "when unsure, follow live". Alternative recorded: global cards (M19 S1 style) — rejected (changes observed values). | Rejected — replicate live |
| DV-M20-05 | D-M20-05 | Candidate — count above an empty page | S1 `?page=2` shows "10 produk dijumpai" above "Tiada Produk" (count of all matches, page empty); reachable only by URL. | **Rejected — replicate live.** The count is the total of the query and is true; the empty page is out of range. | Rejected — replicate live |
| DV-M20-06 | D-M20-06 | Candidate — no menu link | The seller portal S9–S12 and `/seller/daftar` have no entry in any menu; they are reachable by URL and by the in-module links. | **User decision at G1 (2026-09-27): "Tambah pautan menu" — user-approved new scope, not a D9 fix.** Live has no link (not broken; v1.0–v1.1 replicated that). The rebuild adds "Kedai Saya" (`fa-store`, PROPOSED label) → `/seller/dashboard` in the user-shell account dropdown and mobile drawer, directly below "Marketplace", **only for users who own a Seller** (FN-M20-1.1.6). Users without a Seller keep live's behaviour: no link, `/seller/daftar` by URL. Alternatives considered: (a) keep no link — the v1.1 choice, overruled by the user; (b) a link for every user leading to `/seller/daftar` — rejected (would advertise selling to every role, wider than the user's "sellers only"). | Approved (user decision, new scope) |
| DV-M20-07 | D-M20-07 | Candidate — inconsistent order | S6 "Terbaru" lists ids ascending unfiltered but descending inside a category (the seed rows share one creation time). | **Rejected — replicate live** as a tie rule: sort by creation time descending; equal times → id ascending, except id descending when a category is selected (FN-M20-4.1.4). Rows created later sort first everywhere. Alternative: one tie order — rejected (changes observed orders). | Rejected — replicate live |
| DV-M20-08 | D-M20-08 | Candidate — mixed-language labels | "Active" badge vs "Aktif" filter; "Verified"; "(0 reviews)"; option "Pending". | **Rejected — replicate live** (each label is readable and names the same state; D9 "when unsure, follow live"; M19 DV-M19-05 precedent). | Rejected — replicate live |
| DV-M20-09 | — (privacy) | Real phone numbers | S4, S5 and S9 show the seller's telephone and WhatsApp number; S5 links to `wa.me/{number}` (masked by discovery). | The fictitious telephone `0100000000` and WhatsApp `60100000000` in the same places and in the `wa.me` link; the e-mail is the owner's seed e-mail `admin@demo.test`; labels and icons unchanged. | Approved (privacy override) |
| DV-M20-10 | C1 (privacy / seed) | Owner name | The owner's name "Admin PRESTASI+" appears on S2 (seller option), S4 (owner line) and S5. | The owner is canonical account 1, whose M01 seed name is "Admin Demo" (M09 precedent), read through the users contract: "JomBelajar Official — Admin Demo ✅", "Admin Demo · 0100000000", "Admin Demo". Alternative: rename account 1 "Admin PRESTASI+" — rejected (changes M01's seed across every module). | Approved (seed consistency) |
| DV-M20-11 | — (D9 check) | Candidate — hover-only control | S3 image × buttons appear on hover. | **Rejected — replicate live.** Mobile browsers apply `:hover` on the first tap, so the button is reachable on touch; not verified broken (D9 "when unsure, follow live"). | Rejected — replicate live |
| DV-M20-12 | discovery §8.2 "not defects" | Candidate — missing features | No cart / checkout (contact by WhatsApp); "Digital & E-Book" is empty; S11 / S12 have no shipping fields; S12 cannot delete images; the view counter counts every visit. | **Rejected — replicate live.** Each is a consistent live design; adding any would be new scope. | Rejected — replicate live |
| DV-M20-13 | — (D14) | External platform | "Hubungi Penjual di WhatsApp" opens `/marketplace/{slug}/whatsapp` in a new tab (`target="_blank"`, OBSERVED); that route counts a click and redirects to WhatsApp (INFERRED; never opened). | User decision D14 (2026-09-27): no screen of an external platform is built. The link keeps its new tab; in that tab the W route records the click (seller "Klik WhatsApp" +1, as live) and replaces itself with a plain `wa.me` link to the fictitious number, which simulates the outcome (FN-M20-4.2.4–4.2.5); S7 stays open in the original tab. No simulated WhatsApp page. | Approved (D14) |
| DV-M20-14 | G5 QA (L37), 2026-10-09 | Unreadable text | S8 shop banner on live renders its white shop name and details on a white card, so the text is not readable. | The banner uses a purple gradient behind the white text; layout and copy as live. | Approved (D9; colour only) |

**Deviation count:** 6 approved (01, 02, 03, 09, 10, 13), 1 user-approved new scope (06, G1), 6 rejected / replicate live (04, 05, 07, 08, 11, 12).

### 7.1 Count reconciliation (summary)

Every figure of discovery §5.1 was recomputed by hand from the seed (SRS §6.9, checks R01–R18, all pass): **(a) computed from M20's own stores** — 10 products and the 12 S1 filter counts; categories 2 / 3 / 2 / 2 / 0 / 1; status 10 / 0 / 0; condition 7 new / 3 used; the nine discount badges; the price orders; the category orders (id descending); "10 produk", "Produk (10)", "Jumlah Produk" 10, "Produk Aktif" 10; seller cards 0 / 1 / 1 / 1 and the filter variants; 0 reviews and "☆☆☆☆☆"; "Gambar Sedia Ada (n)" = image counts (45 images); "Bergabung 7 bulan yang lepas" at the clock (09 Feb → 25 Sep 2026 = 7 months 16 days); **(b) the discovery ledger** — live showed views #1 33, #5 8, #7 7 and "Jumlah Tontonan" 117 after the discovery's own 6 views; the seed uses the values before discovery (#1 30, #5 7, #7 5; Σ **111**), so S1 / S9 / S10 show 30 / 7 / 5 and 111, the first S7 visit shows 31 / 8 / 6, and "Popular" orders #9 (6) before #4 and #7 (5 each; tie by id, INFERRED) where live post-discovery showed #7 (7) before #9; **(c) stored counter** — "Klik WhatsApp" 16 (seller-level, no per-product breakdown exists, C2); **(d) D9 fixes** — none changes a figure. No display constant is used.

---

## 8. Out of scope

| Item | Owner / reason |
|---|---|
| Users (owner name, e-mail, role), login, landing pages, global 404 page | M01 / M02 (read through their contract; XR-M20-01) |
| Kedai Hadiah (`/admin/hadiah`, `/gamification/rewards`) and coin redemptions | M15 (a different shop; XR-M20-04) |
| Coin / mata / streak chips, wallets | M14 (XR-M20-03) |
| Payments, pricing, invoices | M19 (the marketplace has no payment; XR-M20-05) |
| Cart, orders, checkout, delivery tracking, in-app chat | Not on live (DV-M20-12); the sale happens on WhatsApp |
| Review submission and moderation, seller document upload, seller profile editing, unban / suspend actions | Not observable (OQ-M20-01, 04, 05); not built until observed or decided |
| Notifications to sellers or buyers | M22 (none observed; XR-M20-06) |
| Global shells, header chips, bell, chatbot, tournament banner | global shell / M23, M14, M22, M16 |
| Real image storage, virus scanning, real WhatsApp delivery | backend phase (SRS §11.1) |
| Real server-side authorisation, CSRF, rate limiting, audit trail | backend phase (SRS §11.1) |

---

## 9. Open questions

1. **OQ-M20-01 Seller registration (discovery OQ-M20-01) — resolved at G1 (user, 2026-09-27): PROPOSED minimum approved.** The live form at `/seller/daftar`, its documents, terms and success copy are unknown (the admin is already a seller). The rebuild builds the PROPOSED form of FN-M20-5.1.2 (shop name, description, telephone, WhatsApp; new sellers start pending), still labelled PROPOSED. If the live form is later observed with a non-seller account, it replaces the proposal through a Standard-track change.
2. **OQ-M20-02 WhatsApp redirect (discovery OQ-M20-02).** Target and message of `/marketplace/{slug}/whatsapp` are unknown (never opened). PROPOSED: `wa.me/{seller WhatsApp}` with the message of FN-M20-4.2.5; one click = +1, no de-duplication. Per D14 no WhatsApp screen is built (DV-M20-13); only the message text remains open.
3. **OQ-M20-03 Flash messages and unseen product states (discovery OQ-M20-03).** No flash text after create / update / delete / toggle / ban is specified (none observed; the rebuild shows none). The inactive toggle "Aktifkan" (`fa-play`), the badges "Draft" / "Rejected" (raw capitalisation) and the S7 stock text "Habis Stok" are PROPOSED / INFERRED.
4. **OQ-M20-04 Admin actions on pending / banned sellers (discovery OQ-M20-04) — resolved at G1 (user, 2026-09-27).** "Sahkan Penjual" (FN-M20-3.1.6) is approved as the PROPOSED minimum so that a registered seller can go live; reject, suspend and unban are not built (not part of the approved minimum).
5. **OQ-M20-05 Reviews (discovery OQ-M20-05).** Who may review and how; the populated review list. Not built; the zero state is replicated.
6. **OQ-M20-06 Role access (discovery OQ-M20-06).** The student menu shows "Marketplace" (live sidebar); teacher and school-admin menus do not. Whether those roles and parents / PPD / sponsors may open `/marketplace` or register as sellers is unknown; the rebuild lets every signed-in user open S6–S8 and register (INFERRED, provisional ACs).
7. **OQ-M20-07 Shipping of seller-created products (C4, discovery OQ-M20-07).** S11 / S12 have no shipping fields; PROPOSED default `pickup` with no fee and no location (FN-M20-5.4.4).
8. **OQ-M20-08 Page size (discovery OQ-M20-08).** PROPOSED 20 for S1, S6 and S10 (any size ≥ 10 reproduces live).
9. **OQ-M20-09 Seller-portal menu entry (D-M20-06) — resolved at G1 (user, 2026-09-27): "Tambah pautan menu".** User-approved new scope: "Kedai Saya" → `/seller/dashboard` for users who own a Seller (FN-M20-1.1.6, DV-M20-06, XR-M20-02); the label and placement are PROPOSED.
10. **OQ-M20-10 Platform products.** Products fed as "PRESTASIPLUS Official" (no seller) never existed on live; their display (seller name without tick, no shop link, WhatsApp to the platform number `60000000000`) is PROPOSED.
11. **OQ-M20-11 Product images — resolved at G1 (user, 2026-09-27): copy approved.** The 45 live product photos are copied **once, read-only**, the same way the logo was for F-19: a build task fetches only the image files from the live `/uploads/products/{productId}/…` URLs with plain GETs (never the product pages, which count views) into `public/images/marketplace/products/{productId}/img_{position}.jpg`, and the seed references those local paths (SRS §6.4, §6.11 C, §8.2).
12. **OQ-M20-12 G1 report (done).** The PROPOSED items below were reported at G1 and stand as specified unless a decision above changed them:
    PROPOSED items (same list as SRS §8.2): the "Kedai Saya" menu link (label, icon, placement); registration form and its copy; "Sahkan Penjual" and its confirm; the toggle's "Aktifkan" state; "Habis Stok"; the WhatsApp message and the platform number; the validation messages; the defaults of seller-created products (status `active`, shipping `pickup`); the platform-product display; the ban effect (products → `draft`); the related-products limit (4); the page size (20); landing pages after each action (S1 / S3 / S10, no flash text).
