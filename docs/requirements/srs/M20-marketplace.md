# M20 — Marketplace — Software Requirements Specification

## 0. Document control

| Field | Value |
|---|---|
| Document | SRS — M20 Marketplace |
| Version | 1.2 |
| Date | 2026-09-27 |
| Status | **Approved (G1) — v1.2** (audit round 2 passed; G1 approved by the user 2026-09-27) |
| Author | product-analyst (agent), all sections; §6 data, §7 mock API and §11 are written for review by solution-architect at G2 |
| Source URS | [urs/M20-marketplace.md](../urs/M20-marketplace.md) v1.2 (96 Functions, 25 stories, 93 ACs, coverage 691/691) |
| Source discovery | [M20-marketplace.md](../../discovery/M20-marketplace.md); inventory and seed snapshot `docs/discovery/inventory/M20/` (`_snapshot-2026-09-27.json`, captured 2026-09-27 05:01 MYT); screenshots `docs/discovery/img/M20/` |
| Related | [M01](M01-authentication.md) v1.12 (User base, guards, landing pages, global 404, canonical account 1 "Admin Demo"), [M02](M02-users-schools.md) **v1.23** (users dataset and contract), [M14](M14-gamification.md) v1.7, [M15](M15-rewards-shop.md) v1.4, [M19](M19-finance.md) v1.3 (DV-M19-07 404 precedent, DV-M19-09 platform number), architecture overview §6.6–§6.7 (datasets, repositories), §6.12 (clock), [design/shells.md](../../design/shells.md), [design/design-system.md](../../design/design-system.md) **v1.8** §6 |

**Change log**

| Version | Date | Change |
|---|---|---|
| 1.0 | 2026-09-27 | First issue. Counts at v1.0 (superseded; current counts in the v1.2 note row): 78 FRs, 22 business rules, 11 validation rules, 6 owned stores (MarketplaceCategory, MarketplaceProduct, ProductImage, Seller, SellerDocument, ProductReview), 16 named queries, 24 mock endpoints (#11, #19 PROPOSED), 85 E2E (every one at 375 / 768 / 1280), 10 SEC items, 7 owner requests. Views seeded with the pre-discovery values (Σ 111). Reconciliation of every observed figure by hand (§6.9, 18 checks, all pass). User decision D14 applied to the WhatsApp contact (no external screen; click recorded; `wa.me` link simulates the outcome). |
| 1.1 | 2026-09-27 | Audit round 1 fixes (Delivery Lead decisions, replicate live): **AUD-M20-01 / 07** — FR-M20-27 and V-M20-01 state the observed checked defaults ("🆕 Baru", "✅ Ada", S2 "Ambil Sendiri") and the only `required` inputs (name, category, price); E2E-M20-28 / 76 no longer test "no condition / stock / shipping". **AUD-M20-02** — FR-M20-57 / 58 and §2 row W: the WhatsApp link opens the W route in a new tab (`target="_blank"`, OBSERVED); the new tab records the click and `location.replace`s itself with the `wa.me` URL; S7 stays open; failures show in the new tab; E2E-M20-55 / 61 / 62 handle the popup. **AUD-M20-03** — `rel="noopener"` removed from FR-M20-21 (no `rel`, as live, D10; AUD-M19-06 precedent); SEC-M20-02 keeps `rel` hardening as a backend recommendation only. **AUD-M20-04** — S9 "Lihat Kedai Saya" and the S5 `wa.me` link open in a new tab (FR-M20-43, 66; E2E-M20-43, 69). **AUD-M20-05** — citations M01 v1.12, M02 v1.23, M14 v1.7, M15 v1.4, M19 v1.3, design-system v1.8; XR-M20-07 applied; §10.1 filled with the v1.8 Lucide names. **AUD-M20-09** — E2E-M20-63 and 82 provisional (31 of 85). **AUD-M20-10** — §3.1 regenerated from the FR AC column. **AUD-M20-11** — FR-M20-02 icon colour per menu. Endpoint note corrected (#19, not #20, is PROPOSED). Counts at v1.1 (superseded): 78 FR, 85 E2E. |
| 1.2 | 2026-09-27 | **G1 approved by user 2026-09-27 with decisions: seller registration minimum, seller menu link (new scope), product photos copied read-only.** (1) Registration (#19, R, FR-M20-64) and "Sahkan Penjual" (#11, FR-M20-42) stay PROPOSED, now approved (§8.2). (2) New **FR-M20-79** and **E2E-M20-86**: "Kedai Saya" (`fa-store` → `Store`, design-system v1.8 §6.8) → `/seller/dashboard` in the user-shell account dropdown and mobile drawer for users who own a Seller (URS FN-M20-1.1.6, AC-M20-01.6, DV-M20-06); FR-M20-02, E2E-M20-04, §3.1, §8.2, §9, §10.1 and XR-M20-02 updated. (3) Product photos: §6.4, §6.11 C and §8.2 record the one-time read-only copy into `public/images/marketplace/products/…` (URS OQ-M20-11 resolved). (4) R2-01: "no `rel`" on the S7 WhatsApp button and S9 "Lihat Kedai Saya" marked INFERRED, to be confirmed at G5 (FR-M20-57, 66; E2E-M20-55, 69 provisional). Counts: 79 FR, 86 E2E (35 provisional). |
| 1.2 (note) | 2026-09-27 | Script fix, no content change. URS: the v1.2 change-log row no longer writes AC-M20-01.6 in bold, which `trace.cjs` read as a second AC definition (AC count back to 93). SRS: the v1.0 and v1.1 change-log counts are marked as superseded. **Current SRS counts: 79 FRs, 22 business rules, 11 validation rules, 16 named queries, 24 mock endpoints (#11, #19 PROPOSED), 86 E2E (35 provisional), 10 SEC items, 7 owner requests.** |

### 0.1 Fidelity deviations referenced here

URS §7 is authoritative. Approved fixes: DV-M20-01 (S3 forms separated), 02 (405 → 404), 03 (S5 thumbnails), 09 (fictitious telephone / WhatsApp), 10 (owner name "Admin Demo"), 13 (D14: no WhatsApp screen). User-approved new scope at G1: DV-M20-06 ("Kedai Saya" seller menu link, FR-M20-79). Rejected — replicate live: DV-M20-04, 05, 07, 08, 11, 12.

---

## 1. Scope

The M20 prototype implements, against the mock service layer, the twelve screens of URS §1 — admin product list S1, create S2, edit S3, seller list S4, seller review S5, buyer marketplace S6, product page S7, public shop S8, seller dashboard S9, seller product list S10, seller create S11 and edit S12 — plus the WhatsApp contact hand-off (no screen, D14) and the PROPOSED seller registration form at `/seller/daftar`. M20 owns (D12) the stores MarketplaceCategory (DATA-M20-01), MarketplaceProduct (DATA-M20-02), ProductImage (DATA-M20-03), Seller (DATA-M20-04), SellerDocument (DATA-M20-05) and ProductReview (DATA-M20-06), and the per-product view counter and per-seller WhatsApp-click counter. Every figure is computed per request from these stores through the named queries of §6.8; no display constant exists.

**Release 1.0 deferral (DL decision 2026-10-09, D15 student scope):** row L37 covers the buyer screens S6, S7, S8 and the W hand-off (M20-T2/T3). The admin screens S1–S5 (M20-T4/T5), the seller screens S9–S12 and registration R (M20-T6), and the "Kedai Saya" shell link (FR-M20-79, E2E-M20-86) are deferred. Their FRs and E2E stay specified and are built in a later release; the handlers (M20-T1) are already merged.

**Out of scope:** URS §8 — users (read through M01 / M02), M15 Kedai Hadiah, M14 wallets, M19 payments, cart / order / checkout (not on live), review submission, document upload, unban / suspend, notifications, a real WhatsApp integration (D14), backend security.

---

## 2. Screens & routes

Query names are kept as on live (`q`, `category`, `status`, `condition`, `sort`, `page`) so bookmarked links work unchanged.

| # | Route | Screen | Primary actor(s) | Shell · header / tab title | API (§7) |
|---|---|---|---|---|---|
| S1 | `/admin/marketplace/products` | Marketplace - Produk | Admin | SHA · "Marketplace - Produk" / "Urus Produk - Admin PRESTASIPLUS" | #1, #5, #6 |
| S2 | `/admin/marketplace/products/create` | Tambah Produk Marketplace | Admin | SHA · "Tambah Produk Marketplace" / "Tambah Produk - Admin PRESTASIPLUS" | #12, #13, #3 |
| S3 | `/admin/marketplace/products/{id}/edit` | Edit Produk | Admin | SHA · "Edit Produk" / "Edit Produk - Admin PRESTASIPLUS" | #2, #4, #7 |
| S4 | `/admin/marketplace/sellers` | Marketplace - Penjual | Admin | SHA · "Marketplace - Penjual" / "Urus Penjual - Admin PRESTASIPLUS" | #8, #10 |
| S5 | `/admin/marketplace/sellers/{id}` | Semak Penjual | Admin | SHA · "Semak Penjual" / "Semak Penjual - {shop}" | #9, #10, #11 |
| S6 | `/marketplace` | Marketplace | All signed-in | SHU · "Marketplace" / "Marketplace - PRESTASIPLUS" | #13, #14 |
| S7 | `/marketplace/{slug}` | Product page | All signed-in | SHU · "Marketplace" + category / "{product} - Marketplace PRESTASIPLUS" | #15 |
| W | `/marketplace/{slug}/whatsapp` (opened by S7 in a new tab) | WhatsApp hand-off (no screen, D14) | All signed-in | none — in the new tab, records the click, then `location.replace(wa.me URL)`; S7 stays open in the original tab | #16 |
| S8 | `/marketplace/penjual/{id}` | Kedai Penjual | All signed-in | SHU · "Kedai Penjual" / "{shop} - Marketplace PRESTASIPLUS" | #17 |
| R (PROPOSED) | `/seller/daftar` | Daftar Penjual (non-seller) / redirect to S9 (seller) | All signed-in | SHU · "Daftar Penjual" / "Daftar Penjual - PRESTASIPLUS Marketplace" | #18, #19 |
| S9 | `/seller/dashboard` | Dashboard Penjual | Seller | SHU · "Dashboard Penjual" / "Kedai Saya - PRESTASIPLUS Marketplace" | #18 |
| S10 | `/seller/produk` | Produk Saya | Seller | SHU · "Produk Saya" / "Produk Saya - PRESTASIPLUS Marketplace" | #20, #24 |
| S11 | `/seller/produk/tambah` | Tambah Produk | Seller | SHU · "Tambah Produk" / "Tambah Produk - PRESTASIPLUS Marketplace" | #13, #21 |
| S12 | `/seller/produk/{id}/edit` | Edit Produk | Seller | SHU · "Edit Produk" / "Edit Produk - PRESTASIPLUS Marketplace" | #22, #23 |
| — | `/admin/marketplace/products/{id}`, `/seller/produk/{id}` (GET), the probed routes of URS §1 | Global 404 (M01) | All | standalone | — |

`{id}` is an integer; `{slug}` is the product slug (§6.3). The live form posts map to #3–#7, #10, #21–#24.

---

## 3. Functional requirements

| ID | Requirement | FN | AC |
|---|---|---|---|
| FR-M20-01 | The admin shell SHALL show the collapsible sidebar group "Marketplace" (`fa-shopping-bag`, key `marketplace`) with "Produk" (`fa-shopping-bag`) → `/admin/marketplace/products` and "Penjual" (`fa-store`) → `/admin/marketplace/sellers`, open with "Produk" active on S1–S3 and "Penjual" active on S4–S5, and the "Lagi" drawer section "Marketplace" with the same links. The shell renders them; M20 registers the routes and their `activeGroup` / `activeItem`. | 1.1.1 | 01.1, 01.2 |
| FR-M20-02 | The user shell SHALL show "Marketplace" (`fa-shopping-bag`; emerald in the mobile drawer, no colour class in the account dropdown, as live — shell-owned styling) → `/marketplace` for `student` and `admin` and, in the admin block, "Urus Produk" (`fa-store`) → S1 and "Urus Penjual" (`fa-user-tie`) → S4; for a user without a Seller no menu SHALL link to `/seller/*`, and the admin-panel sidebar SHALL have no `/seller/*` link (as live; the seller link is FR-M20-79). | 1.1.2 | 01.3, 01.4 |
| FR-M20-03 | S1–S5 SHALL render in the admin-panel shell and S6–S12 and R in the user-portal shell; the W route renders nothing of its own. | 1.1.5 | 01.5 |
| FR-M20-04 | Each screen SHALL set the header title / subtitle of URS FN-M20-1.1.3, with the dynamic subtitles product name (S3, S12), shop name (S5, S8, S9) and category name (S7). | 1.1.3 | 02.1, 02.2 |
| FR-M20-05 | Each screen SHALL set the tab title of URS FN-M20-1.1.4 exactly. | 1.1.4 | 02.1, 02.2 |
| FR-M20-06 | Every M20 route and endpoint SHALL require a session; a guest SHALL be redirected to `/login` and the API SHALL answer `401 UNAUTHORIZED`. | 1.2.1 | 03.1 |
| FR-M20-07 | S1–S5 and #1–#12 SHALL be admin only: another role SHALL be sent to its M01 landing page and the API SHALL answer `403 FORBIDDEN`. | 1.2.2 | 03.2 |
| FR-M20-08 | S6–S8, W and #13–#17 SHALL accept every signed-in role; S9–S12 SHALL require that the viewer owns a Seller, otherwise redirect to `/seller/daftar`; R SHALL redirect a seller to `/seller/dashboard`. | 1.2.3 | 03.3, 03.4, 03.5 |
| FR-M20-09 | An unknown id or slug on S3, S5, S7, S8, S12 or W (API 404) and every probed route of URS §1 SHALL render the M01 global 404 page. | 1.2.4 | 04.1, 04.3 |
| FR-M20-10 | A navigation to `/admin/marketplace/products/{id}` or `/seller/produk/{id}` SHALL render the global 404 page; the Symfony 405 copy SHALL NOT be rendered (DV-M20-02). | 1.2.5 | 04.2 |
| FR-M20-11 | Prices SHALL be formatted by BR-M20-19 ("RM 89.90"; shipping "RM8.00"); the discount badge SHALL be "-{round((original − price) / original × 100)}%" and SHALL show only when `originalPrice` is set. | 1.3.1 | 05.1 |
| FR-M20-12 | Dates SHALL be "dd MMM yyyy" (English month abbreviations, MYT) and S8 SHALL show "Bergabung {relative}" from `Seller.createdAt` at the mock clock (BR-M20-19). | 1.3.2 | 05.2 |
| FR-M20-13 | #1, #14 and #20 SHALL page by 20 (PROPOSED) with `meta {page, perPage, total, lastPage}`; the pager SHALL render only when `lastPage > 1`, keep the query values and follow the M19 Laravel-style pager; a page beyond the last SHALL return no row. | 1.3.3 | 05.3 |
| FR-M20-14 | Status labels SHALL follow BR-M20-18 (raw capitalised badges, "Verified", "(n reviews)", option "Pending"). | 1.3.6 | 05.4 |
| FR-M20-15 | Data views SHALL show the shell loading behaviour while a request is pending and the M01 error convention on failure. | 1.3.4 | 05.5 |
| FR-M20-16 | Every M20 screen and R SHALL have no horizontal page scroll and no content text below 12 px at 375 / 768 / 1280 px; grids SHALL follow §10. | 1.3.5 | 25.1, 25.2 |
| FR-M20-17 | S1 SHALL show "{n} produk dijumpai" = `meta.total` of #1 and the link "Tambah Produk" → S2. | 2.1.1 | 06.1, 06.4 |
| FR-M20-18 | S1 SHALL show the GET filter form of FN-M20-2.1.2 with the current values selected and no "Reset" link. | 2.1.2 | 06.1, 06.3 |
| FR-M20-19 | #1 SHALL filter by BR-M20-04 over every product of every seller and the platform, all statuses. | 2.1.3 | 06.3, 06.4 |
| FR-M20-20 | S1 row cards SHALL show the content of FN-M20-2.1.4 (seller name, views, review count, condition label, raw status badge). | 2.1.4 | 06.2 |
| FR-M20-21 | Each S1 row SHALL link "Lihat" → S7 with `target="_blank"` and no `rel` attribute (as live, D10) and "Edit" → S3. | 2.1.5 | 06.5 |
| FR-M20-22 | The S1 toggle SHALL call #6 without a confirm; `active` → `draft` ("Nyahaktif", `fa-pause`), any other status → `active` ("Aktifkan", `fa-play`, PROPOSED COPY); S1 SHALL reload with the same query. | 2.1.6 | 07.1, 07.2 |
| FR-M20-23 | The S1 trash SHALL call `confirm('Padam produk ini?')` and on OK call #5 (BR-M20-09); S1 SHALL reload with the same query. | 2.1.7 | 07.3 |
| FR-M20-24 | #1 SHALL order by `id` ascending; on a page beyond the last S1 SHALL still show the count of all matches (DV-M20-05). | 2.1.8 | 06.2, 06.4 |
| FR-M20-25 | When the page has no row, S1 SHALL show the "📦" "Tiada Produk" card with "Tambah produk pertama sekarang!" and "Tambah Produk" → S2. | 2.1.9 | 06.4 |
| FR-M20-26 | S2 SHALL show the back link and the "Penjual" card with the options of #12 (platform first, selected) and the hint. | 2.2.1, 2.2.2 | 08.1 |
| FR-M20-27 | S2 SHALL show "Maklumat Produk" and the condition / stock tiles of FN-M20-2.2.3–2.2.4 with `required` only on `name`, `category_id` and `price`, the `min` / `step` attributes of V-M20-01, no `required` on the tile radios, and "🆕 Baru", "✅ Ada" and (FR-M20-28) "Ambil Sendiri" checked on load (OBSERVED). | 2.2.3, 2.2.4 | 08.1, 08.2 |
| FR-M20-28 | S2 SHALL show "Penghantaran" with the four shipping tiles ("Ambil Sendiri" checked on load, no `required`), the fee input and the location input of FN-M20-2.2.5. | 2.2.5 | 08.1 |
| FR-M20-29 | S2 SHALL show "Gambar Produk" with the file input (`multiple`, accept JPG / PNG / WEBP) and the button "Tambah Produk"; images SHALL be validated by V-M20-02. | 2.2.6 | 08.1, 08.3 |
| FR-M20-30 | "Tambah Produk" (S2) SHALL call #3; on 201 the admin SHALL land on S1 without flash text; the product SHALL be created by BR-M20-06. | 2.2.7 | 08.4, 08.5 |
| FR-M20-31 | S3 SHALL show the back link and "Kemaskini Produk" prefilled from #2 with the live differences of FN-M20-2.3.2. | 2.3.1, 2.3.2 | 09.1, 09.2 |
| FR-M20-32 | S3 SHALL show "Status Produk *" with the three tiles, the saved status checked. | 2.3.3 | 09.1, 09.4 |
| FR-M20-33 | S3 SHALL show "Penghantaran" prefilled as FN-M20-2.3.4. | 2.3.4 | 09.1, 09.2 |
| FR-M20-34 | S3 "Gambar Sedia Ada ({n})" SHALL list the images in `position` order, the first with "Utama"; every × (the first included) SHALL call `confirm('Padam gambar ini?')` and on OK call #7 for that image only, then reload S3 (DV-M20-01). The image-delete controls SHALL NOT be nested in the product form. | 2.3.5 | 10.1 |
| FR-M20-35 | S3 "Tambah Gambar Baru" and "Simpan Perubahan" SHALL belong to the product form; "Simpan Perubahan" SHALL call #4 with every field and the new images (DV-M20-01); V-M20-02 SHALL cap the total at 5. | 2.3.6 | 10.2, 10.3, 10.4 |
| FR-M20-36 | #4 SHALL apply BR-M20-07; on 200 the admin SHALL land on S1 without flash text. | 2.3.7 | 09.3, 09.4 |
| FR-M20-37 | S4 SHALL show the four cards of Q-M20-SELLER-STATS(filter), computed over the filtered sellers (DV-M20-04). | 3.1.1 | 11.1, 11.2 |
| FR-M20-38 | S4 SHALL show the GET status filter of FN-M20-3.1.2 with the current value selected. | 3.1.2 | 11.1, 11.2 |
| FR-M20-39 | S4 row cards SHALL show the content of FN-M20-3.1.3 ("{owner name} · {phone}", raw status badge, "{n} produk" = Q-M20-SELLER-PRODUCTS). | 3.1.3 | 11.1 |
| FR-M20-40 | Each S4 row SHALL link the eye → S5 and the ban button SHALL call `confirm('Haramkan penjual ini?')` and on OK call #10. | 3.1.4 | 11.1, 11.3, 14.3 |
| FR-M20-41 | When no seller matches, S4 SHALL show "Tiada penjual dijumpai". | 3.1.5 | 11.2 |
| FR-M20-42 | On S5 of a `pending` seller, "Tindakan" SHALL show "Sahkan Penjual" (`fa-check`) which calls `confirm('Sahkan penjual ini?')` and on OK #11 (BR-M20-11) (PROPOSED). | 3.1.6 | 12.1 |
| FR-M20-43 | S5 SHALL show the back link, the layout of §10 and "Maklumat Perniagaan" from #9 (owner name and e-mail through the M02 contract; telephone and WhatsApp from the Seller; `wa.me` link with `target="_blank"` and no `rel`, as live). | 3.2.1, 3.2.2 | 13.1 |
| FR-M20-44 | S5 "Dokumen" SHALL list the seller's documents or "Tiada dokumen dimuat naik". | 3.2.3 | 13.1 |
| FR-M20-45 | S5 "Produk ({n})" SHALL list every product of the seller with the same image URL as the other screens (DV-M20-03). | 3.2.4 | 13.2 |
| FR-M20-46 | S5 "Ringkasan" SHALL show Q-M20-SELLER-PRODUCTS, the seller rating stars, Q-M20-SELLER-REVIEWS and the two dates. | 3.2.5 | 13.3 |
| FR-M20-47 | S5 "Haramkan Penjual" SHALL call `confirm('Haramkan penjual ini? Semua produk akan dinyahaktifkan.')` and on OK #10. | 3.2.6 | 14.1 |
| FR-M20-48 | #10 SHALL apply BR-M20-10 and return the admin to the page of origin without flash text. | 3.2.7 | 14.2, 14.3 |
| FR-M20-49 | S6 SHALL show the search card of FN-M20-4.1.1 with the four current values selected. | 4.1.1 | 15.1, 15.5 |
| FR-M20-50 | S6 SHALL show the category chips of FN-M20-4.1.2; a chip SHALL link to `?category={slug}` only and SHALL be active for the current category ("Semua" for none). | 4.1.2 | 15.1, 15.4 |
| FR-M20-51 | Each S6 card SHALL be one link → S7 with the content of FN-M20-4.1.3 and the shipping line of BR-M20-17. | 4.1.3 | 15.2 |
| FR-M20-52 | #14 SHALL filter and sort by BR-M20-05. | 4.1.4 | 15.3, 15.4, 15.5 |
| FR-M20-53 | When no product matches, S6 SHALL show "🛒" "Tiada Produk Dijumpai" / "Cuba tukar kata kunci atau kategori" and no pager. | 4.1.5 | 15.6 |
| FR-M20-54 | #14, #15, #17 and the related products SHALL apply the visibility rule BR-M20-08; a hidden product or shop SHALL answer 404. | 4.1.6 | 07.1, 09.4, 14.2 |
| FR-M20-55 | S7 SHALL show the back link and the gallery; a thumbnail click SHALL swap the main image client-side (no request) and move the active border. | 4.2.1, 4.2.2 | 16.1, 16.2 |
| FR-M20-56 | S7 SHALL show the details card of FN-M20-4.2.3 with `views` as returned by #15 (after its increment). | 4.2.3 | 16.1, 16.5 |
| FR-M20-57 | S7 SHALL show "Hubungi Penjual di WhatsApp" (`fa-whatsapp`) linking to `/marketplace/{slug}/whatsapp` with `target="_blank"` (a new tab, OBSERVED) and no `rel` (INFERRED, to be confirmed at G5). | 4.2.4 | 16.1 |
| FR-M20-58 | W, running in the new tab opened by FR-M20-57, SHALL call #16 and, on success, `location.replace()` the returned `wa.me` URL without rendering any screen of its own (D14, DV-M20-13); on 404 the new tab SHALL render the global 404 page; on another error the new tab SHALL show the M01 error convention. S7 SHALL stay open and unchanged in the original tab. | 4.2.5 | 17.1, 17.2, 17.3 |
| FR-M20-59 | S7 SHALL show the "Penjual" card (link → S8; none for a platform product) and "Ulasan ({n})" with "Belum ada ulasan untuk produk ini" and no form. | 4.2.6, 4.2.7 | 16.3 |
| FR-M20-60 | S7 "Produk Berkaitan" SHALL list Q-M20-RELATED(product) and hide when empty. | 4.2.8 | 16.4 |
| FR-M20-61 | #15 SHALL add 1 to the product's `views` on every call before returning it (BR-M20-12); no other endpoint SHALL change `views`. | 4.2.9 | 16.5, 16.6 |
| FR-M20-62 | S8 SHALL show the back link, the shop card and the grid of FN-M20-4.3.1–4.3.3 from #17. | 4.3.1, 4.3.2, 4.3.3 | 18.1, 18.2 |
| FR-M20-63 | R SHALL redirect a user who owns a Seller to `/seller/dashboard`. | 5.1.1 | 19.1, 03.5 |
| FR-M20-64 | For a user without a Seller, R SHALL show the PROPOSED form of FN-M20-5.1.2, validate by V-M20-06 and call #19; on 201 the user SHALL land on S9 (BR-M20-13). | 5.1.2, 5.1.3 | 19.2, 19.3, 19.4 |
| FR-M20-65 | S9 SHALL show the four cards Q-M20-SELLER-PRODUCTS, Q-M20-SELLER-ACTIVE, Q-M20-VIEWS-SUM and `Seller.whatsappClicks`. | 5.2.1 | 20.1 |
| FR-M20-66 | S9 SHALL show the three buttons of FN-M20-5.2.2 ("Lihat Kedai Saya" with `target="_blank"`, OBSERVED, and no `rel`, INFERRED — to be confirmed at G5) and "Profil Kedai" of FN-M20-5.2.3. | 5.2.2, 5.2.3 | 20.2, 20.3 |
| FR-M20-67 | S9 "Produk Terbaru" SHALL list Q-M20-SELLER-LATEST(6). | 5.2.4 | 20.4 |
| FR-M20-68 | S10 SHALL show the two links and the viewer's products from #20 with the row content of FN-M20-5.3.2. | 5.3.1, 5.3.2 | 21.1 |
| FR-M20-69 | S10 row edit SHALL link → S12; the trash SHALL call `confirm('Padam produk ini?')` and on OK #24; with no row S10 SHALL show the "Belum Ada Produk" card. | 5.3.3, 5.3.4 | 21.2, 21.3 |
| FR-M20-70 | S11 SHALL show the back link, "Maklumat Produk" and "Gambar Produk" as S2 without "Penjual" and "Penghantaran", with V-M20-01 / 02. | 5.4.1, 5.4.2, 5.4.3 | 22.1, 22.3 |
| FR-M20-71 | S11 "Tambah Produk" SHALL call #21 (BR-M20-14); on 201 the seller SHALL land on S10 without flash text. | 5.4.4 | 22.2 |
| FR-M20-72 | S12 SHALL show the back link, "Kemaskini Produk" without status and shipping, "Gambar Sedia Ada" (no count, no "Utama", no delete), "Tambah Gambar Baru" and "Simpan Perubahan" inside the form. | 5.5.1, 5.5.2, 5.5.3, 5.5.4 | 23.1, 23.2 |
| FR-M20-73 | #22–#24 SHALL act only on the viewer's own products (another id → 404); #23 SHALL apply BR-M20-15 and the seller SHALL land on S10. | 5.5.5 | 23.3, 23.4 |
| FR-M20-74 | The product and category stores SHALL accept exactly the fields and enums of DATA-M20-01–03; S1 / S2 SHALL use category ids and S6 slugs. | 6.1.1 | 24.1, 24.2 |
| FR-M20-75 | The Seller store SHALL hold the fields of DATA-M20-04, one Seller per user, with `whatsappClicks` as a stored counter changed only by #16. | 6.1.2 | 24.1, 20.1 |
| FR-M20-76 | Every displayed count SHALL come from a named query of §6.8, recomputed per request. | 6.1.3 | 24.1, 07.3 |
| FR-M20-77 | M20 SHALL expose no cart, order, checkout or payment route, and SHALL write nothing to M19, M14 or M15 stores. | 6.1.4 | 24.3 |
| FR-M20-78 | Review counts and ratings SHALL be computed by BR-M20-16 from the ProductReview store (empty in the seed). | 6.1.5 | 24.4 |
| FR-M20-79 | For a signed-in user who owns a Seller (any status, any role), the user shell SHALL show "Kedai Saya" (`fa-store`, PROPOSED label) → `/seller/dashboard` in the account dropdown directly below "Marketplace" and in the mobile drawer "Gamifikasi" section directly below "Marketplace", active on S9–S12; the shell SHALL decide visibility with the M20 contract `mpSellers.forUser(userId)` (re-read after #19 succeeds); a user without a Seller SHALL NOT see it (user-approved new scope, DV-M20-06, XR-M20-02). | 1.1.6 | 01.6 |

### 3.1 Traceability (US → FR → E2E)

| US | FR | E2E |
|---|---|---|
| US-M20-01 | 01, 02, 03, 79 | 01, 02, 03, 04, 05, 86 |
| US-M20-02 | 04, 05 | 06, 07 |
| US-M20-03 | 06, 07, 08, 63 | 08, 09, 10, 11 |
| US-M20-04 | 09, 10 | 12, 13, 14 |
| US-M20-05 | 11, 12, 13, 14, 15 | 15, 16, 17, 18, 19 |
| US-M20-06 | 17, 18, 19, 20, 21, 24, 25 | 20, 21, 22, 23, 24 |
| US-M20-07 | 22, 23, 54, 76 | 25, 26 |
| US-M20-08 | 26, 27, 28, 29, 30 | 27, 28, 29, 30, 31 |
| US-M20-09 | 31, 32, 33, 36, 54 | 32, 33, 34, 35 |
| US-M20-10 | 34, 35 | 36, 37, 38 |
| US-M20-11 | 37, 38, 39, 40, 41 | 39, 40, 41 |
| US-M20-12 | 42 | 42 |
| US-M20-13 | 43, 44, 45, 46 | 43, 44, 45 |
| US-M20-14 | 40, 47, 48, 54 | 46, 47, 48 |
| US-M20-15 | 49, 50, 51, 52, 53 | 49, 50, 51, 52, 53, 54 |
| US-M20-16 | 55, 56, 57, 59, 60, 61 | 55, 56, 57, 58, 59, 60 |
| US-M20-17 | 58 | 61, 62, 63 |
| US-M20-18 | 62 | 64, 65 |
| US-M20-19 | 63, 64 | 11, 66, 67 |
| US-M20-20 | 65, 66, 67, 75 | 68, 69, 70 |
| US-M20-21 | 68, 69 | 71, 72, 73 |
| US-M20-22 | 70, 71 | 74, 75, 76 |
| US-M20-23 | 72, 73 | 77, 78, 79 |
| US-M20-24 | 74, 75, 76, 77, 78 | 80, 81, 82, 83 |
| US-M20-25 | 16 | 84, 85 |

---

## 4. Business rules

| ID | Rule | Source |
|---|---|---|
| BR-M20-01 | **Access.** S1–S5 and #1–#12: `admin` only. S6–S8, W, #13–#17: every signed-in role. S9–S12, #18 (seller part), #20–#24: the owner of a Seller; others → `/seller/daftar`. R / #19: a signed-in user without a Seller (a seller → S9). Guest → `/login`. | OBSERVED (admin) / INFERRED |
| BR-M20-02 | **Menu.** "Marketplace" for `student` and `admin`; "Urus Produk" / "Urus Penjual" for `admin` (OBSERVED). "Kedai Saya" → `/seller/dashboard` only for users who own a Seller (user-approved new scope at G1, DV-M20-06; PROPOSED label); no seller-portal entry for anyone else (as live). | OBSERVED / PROPOSED (user-approved) |
| BR-M20-03 | **Header / tab titles** are route meta with dynamic parts (product name, shop name, category name). | OBSERVED |
| BR-M20-04 | **Admin product filter (#1).** `q` trimmed, case-insensitive substring of `name` (INFERRED field); `category` = `categoryId` (integer string); `status` exact; empty = any; any other value matches nothing; AND; order `id` asc; 20 per page. | OBSERVED / INFERRED |
| BR-M20-05 | **Buyer list (#14).** Visible products only (BR-M20-08). `q` as BR-M20-04; `category` = category slug; `condition` exact; AND. Sort: `latest` (default; also for an unknown value) = `createdAt` desc, ties by `id` asc — but by `id` desc when `category` is set (DV-M20-07); `price_low` / `price_high` = `price` asc / desc, ties by `id` asc; `popular` = `views` desc, ties by `id` asc (INFERRED). 20 per page. | OBSERVED / INFERRED |
| BR-M20-06 | **Admin create (#3).** New id = max + 1; `sellerId` = the chosen seller or null (platform); `status` `active` (INFERRED); `views` 0; `slug` = slugify(name) + "-" + 5 characters [A-Za-z0-9] from the seeded PRNG stream `m20.slugs` (unique); `shippingFee` null unless `postage` (the input is kept as sent when given); images stored in upload order as positions 1…n; `createdAt` = now. | INFERRED / PROPOSED |
| BR-M20-07 | **Admin update (#4).** Updates name, category, price, original price, description, condition, stock, status and shipping fields; appends the new images after the existing ones; keeps `sellerId`, `slug`, `views`, `createdAt`. | PROPOSED |
| BR-M20-08 | **Visibility.** A product is visible to buyers when `status = active` and (`sellerId` is null or the seller's `status = active`). A seller's shop page is visible when the seller's `status = active`. Stock does not affect visibility. | INFERRED |
| BR-M20-09 | **Delete product (#5, #24).** Removes the product, its images and its reviews; counts recompute; the seller's `whatsappClicks` is unchanged. | INFERRED |
| BR-M20-10 | **Ban (#10).** Seller `status` → `banned`; every product of the seller with `status = active` → `draft`; `verifiedAt` kept; available for any status (INFERRED); no unban. | INFERRED (S5 confirm) |
| BR-M20-11 | **Verify (#11, PROPOSED).** Allowed only for `pending`; sets `status = active`, `verifiedAt = now`. | PROPOSED |
| BR-M20-12 | **Views.** Each #15 call on a visible product adds 1 to `views` and returns the new value (no de-duplication); nothing else changes `views`. | OBSERVED |
| BR-M20-13 | **Registration (#19, PROPOSED).** One Seller per user; `status = pending`, `verifiedAt = null`, `whatsappClicks = 0`, `createdAt = now`; a second call → 409 and no record. | PROPOSED |
| BR-M20-14 | **Seller create (#21, PROPOSED).** As BR-M20-06 with `sellerId` = the viewer's seller and shipping `pickup`, fee null, location empty (OQ-M20-07). | PROPOSED |
| BR-M20-15 | **Seller update (#23, PROPOSED).** As BR-M20-07 but never changes `status` or the shipping fields. | PROPOSED |
| BR-M20-16 | **Reviews and rating.** Product review count = its reviews; seller review count = reviews of all its products; seller rating = average rating (1–5) of those reviews, rendered as 5 characters with round(avg) "★" then "☆" ("☆☆☆☆☆" with none, INFERRED fill rule). | OBSERVED (zero) / INFERRED |
| BR-M20-17 | **Shipping line.** `postage` "Pos / Kurier (RM{fee, 2 dp})"; `free` "Penghantaran Percuma 🎉"; `cod` "Cash on Delivery (COD)"; `pickup` "Ambil Sendiri (Pickup)". S7 shows the location with `fa-map-marker-alt` only when not empty. | OBSERVED |
| BR-M20-18 | **Labels.** Product condition `new` "Baru" / `used` "Terpakai"; product status badge = ucfirst(status) ("Active", "Draft", "Rejected"); seller badge = ucfirst(status) ("Active", "Pending", "Suspended", "Banned"); S9 "Status:" "Verified" when `verifiedAt` is set, else ucfirst(status); "({n} reviews)". | OBSERVED / INFERRED |
| BR-M20-19 | **Formats** (MYT): product price "RM {n.nn}"; shipping "RM{n.nn}"; dates "dd MMM yyyy"; relative "Bergabung {n} {hari \| minggu \| bulan \| tahun} yang lepas" (whole units floored, Carbon BM; "bulan" OBSERVED). | OBSERVED / INFERRED |
| BR-M20-20 | **Related products.** Visible products of the same category, excluding the product, `id` asc, at most 4 (PROPOSED). | OBSERVED / PROPOSED |
| BR-M20-21 | **WhatsApp hand-off (#16, D14).** For a visible product: seller product → `whatsappClicks` + 1 and URL `https://wa.me/{seller.whatsapp}?text={encodeURIComponent(message)}`; platform product → no count, number `60000000000`. Message (PROPOSED COPY): `Salam, saya berminat dengan produk "{name}" di PRESTASIPLUS Marketplace.` No screen is rendered. | INFERRED / PROPOSED + D14 |
| BR-M20-22 | **Images.** ≤ 5 per product; position 1 is "Utama" and the list / card thumbnail; deleting an image renumbers the rest from 1. | OBSERVED / INFERRED |

---

## 5. Validation rules

| ID | Input | Rule | Error (PROPOSED COPY; 422 `VALIDATION_FAILED` with `fields`) |
|---|---|---|---|
| V-M20-01 | #3, #4, #21, #23 product fields | HTML `required` only on `name`, `category_id`, `price` (as live; the tile radios have none and arrive checked: `new`, `available`, S2 `pickup`). Server: `name` required, ≤ 150; `categoryId` required, ∈ 1–6; `price` required, number ≥ 0.01, 2 dp; `originalPrice` optional, number ≥ 0; `description` ≤ 5,000; `condition` ∈ {new, used}; `stockStatus` ∈ {available, out_of_stock}; admin only: `status` ∈ {active, draft, rejected} (#4), `shippingMethod` ∈ {pickup, postage, cod, free}, `shippingFee` optional ≥ 0, `location` ≤ 100, `sellerId` null or an active seller | "Sila isi ruangan ini." (required), "Harga mesti sekurang-kurangnya RM0.01.", "Pilihan tidak sah." |
| V-M20-02 | images | each JPG / PNG / WEBP (MIME and signature), ≤ 2 MB; total per product ≤ 5 | "Gambar mesti JPG, PNG atau WEBP, maksimum 2MB setiap satu.", "Maksimum 5 gambar bagi setiap produk." |
| V-M20-03 | #1, #14, #20 query | `q` trimmed, ≤ 100; `page` integer ≥ 1 (else 1); other values accepted as they are (unknown → no row) | — |
| V-M20-04 | path `{id}`, `{slug}`, `{imageId}` | existing record (own product for #22–#24; visible product for #15, #16; active seller for #17) | 404 `NOT_FOUND` → global 404 page |
| V-M20-05 | #6, #10, #11 | existing product / seller; #11 only for `pending` | 404; 409 `INVALID_STATE` |
| V-M20-06 | #19 registration | `shopName` required, ≤ 100; `description` ≤ 1,000; `phone` required, 10–12 digits; `whatsapp` required, 11–12 digits starting "60" | "Sila isi ruangan ini.", "Nombor telefon tidak sah.", "Nombor WhatsApp mesti bermula dengan 60." |
| V-M20-07 | #19 duplicate | the viewer owns no Seller | 409 `ALREADY_SELLER` → redirect S9 |
| V-M20-08 | #7 image delete | the image exists; product keeps ≥ 0 images | 404 |
| V-M20-09 | every mutation | CSRF header present (SEC-M20-06) | 419 |
| V-M20-10 | text inputs | stored as plain text; rendered escaped (SEC-M20-05) | — |
| V-M20-11 | #16 | product visible (BR-M20-08) | 404 |

---

## 6. Data entities & fields

JSON fields are camelCase; ids are integers. "Now" is the shared mock clock (ADR-0006, architecture §6.12), project clock **2026-09-25T15:40:00+08:00**. M20 reads users through the M01 / M02 contract (D12). Everything resets per E2E test (`mock.reset()`).

### 6.1 Referenced entities (owners; not redefined — D12)

| Entity | Owner | Fields M20 reads |
|---|---|---|
| User | M01 DATA-M01-01 / M02 v1.23 users dataset | `id`, `name` (owner name on S2 / S4 / S5), `email` (S5), `role` (menu and access) |
| Wallet chips, rewards, payments | M14, M15, M19 | none (boundary, FN-M20-6.1.4) |

### 6.2 DATA-M20-01 — MarketplaceCategory (owned by M20; constant fixture)

| id | slug | name | icon |
|---|---|---|---|
| 1 | `peralatan-sekolah` | Peralatan Sekolah | `fa-pencil-ruler` |
| 2 | `buku-rujukan` | Buku & Rujukan | `fa-book` |
| 3 | `uniform-pakaian` | Uniform & Pakaian | `fa-tshirt` |
| 4 | `stationery` | Stationery | `fa-pen` |
| 5 | `digital` | Digital & E-Book | `fa-tablet-alt` |
| 6 | `lain-lain` | Lain-lain | `fa-th-large` |

### 6.3 DATA-M20-02 — MarketplaceProduct (owned by M20; repository `mpProducts`; materialised table)

| Field | Type | Req | Notes |
|---|---|---|---|
| id | int | yes | Seed 1–10; runtime from 11 |
| sellerId | int → Seller \| null | no | null = platform "PRESTASIPLUS Official" (PROPOSED display) |
| name | string ≤ 150 | yes | |
| slug | string | yes | slugify(name) + "-" + 5 chars; unique |
| categoryId | int → MarketplaceCategory | yes | |
| price | decimal string (2 dp) | yes | |
| originalPrice | decimal string \| null | no | |
| description | text | no | |
| condition | enum `new \| used` | yes | |
| stockStatus | enum `available \| out_of_stock` | yes | |
| status | enum `active \| draft \| rejected` | yes | |
| shippingMethod | enum `pickup \| postage \| cod \| free` | yes | |
| shippingFee | decimal string \| null | no | |
| location | string ≤ 100 | no | |
| views | int | yes | BR-M20-12 |
| createdAt, updatedAt | datetime | yes | |

Read models: `AdminProductRow` = `{id, name, slug, price, thumbnailUrl, seller: {id, shopName} \| null, views, reviewCount, condition, status}`; `ProductDetail` = product + `{category, images[], seller card, reviews[], reviewCount, related[]}`; `ProductCard` = `{id, slug, name, price, originalPrice, discountPct, condition, thumbnailUrl, seller: {shopName, verified} \| null, shippingLine}`.

### 6.4 DATA-M20-03 — ProductImage (owned by M20; repository `mpImages`)

| Field | Type | Notes |
|---|---|---|
| id | int | Seed 1–45; runtime from 46 |
| productId | int → MarketplaceProduct | |
| position | int 1–5 | 1 = "Utama" |
| url | string | `/images/marketplace/products/{productId}/img_{position}.jpg` — local static asset under `public/images/marketplace/products/`, copied once, read-only, from live (user-approved at G1, OQ-M20-11; §6.11 C); uploads in the mock become object URLs stored in IndexedDB |

### 6.5 DATA-M20-04 — Seller (owned by M20; repository `mpSellers`)

| Field | Type | Req | Notes |
|---|---|---|---|
| id | int | yes | Seed 1; runtime from 2 |
| userId | int → User | yes | unique (one seller per user) |
| shopName | string ≤ 100 | yes | |
| description | text | no | |
| phone | string | yes | fictitious in the seed (DV-M20-09) |
| whatsapp | string | yes | fictitious in the seed (DV-M20-09) |
| status | enum `pending \| active \| suspended \| banned` | yes | |
| verifiedAt | datetime \| null | no | "Verified" / "Disahkan" |
| whatsappClicks | int | yes | stored counter (C2) |
| createdAt | datetime | yes | "Didaftarkan", "Bergabung …" |

### 6.6 DATA-M20-05 — SellerDocument and DATA-M20-06 — ProductReview (owned by M20; empty in the seed)

`SellerDocument` = `{id, sellerId, fileName, url, uploadedAt}` (0 rows; list only). `ProductReview` = `{id, productId, userId, rating 1–5, text, createdAt}` (0 rows; read only; no submission endpoint, OQ-M20-05).

### 6.7 Seller card and dashboard read models

`SellerCard` = `{id, shopName, initial, verified, ratingStars, activeProductCount}`; `SellerDashboard` = `{seller, stats: {total, active, views, whatsappClicks}, latest: ProductRow[6]}`; `SellerStats` = `{pending, active, total, verified}`.

### 6.8 Named queries (every displayed count cites one)

Values at the project clock with the seed of §6.11.

| Query | Base | Definition | Value at the clock | Shown on |
|---|---|---|---|---|
| Q-M20-PROD-LIST(filter, page) | mpProducts | BR-M20-04 | all 10; cat 1: 2, 2: 3, 3: 2, 4: 2, 5: 0, 6: 1; active 10, draft 0, rejected 0; "Beg" 1; "zzqxv" 0 | S1 count line, rows |
| Q-M20-BUYER-LIST(filter, sort, page) | mpProducts (visible) | BR-M20-05 | §6.9 R05–R08 | S6 grid |
| Q-M20-SELLER-PRODUCTS(s) | mpProducts | count(sellerId = s), all statuses | 10 | S4 "10 produk", S5 "Produk (10)", "Jumlah Produk", S9 "Jumlah Produk" |
| Q-M20-SELLER-ACTIVE(s) | mpProducts | count(sellerId = s, status = active) | 10 | S9 "Produk Aktif" |
| Q-M20-SELLER-VISIBLE(s) | mpProducts | count visible of seller s | 10 | S7 seller card, S8 "10 produk" |
| Q-M20-VIEWS-SUM(s) | mpProducts | Σ views where sellerId = s | 111 | S9 "Jumlah Tontonan" |
| Q-M20-SELLER-STATS(filter) | mpSellers | over sellers matching `status`: count(pending), count(active), count(*), count(verifiedAt ≠ null) | 0 / 1 / 1 / 1 (pending, suspended, banned filters: 0 / 0 / 0 / 0) | S4 cards |
| Q-M20-SELLER-LIST(filter) | mpSellers ⋈ users | status filter, id asc | 1 row | S4 |
| Q-M20-PRODUCT-REVIEWS(p) | mpReviews | count(productId = p) | 0 | S1 / S10 star, S7 "Ulasan (0)" |
| Q-M20-SELLER-REVIEWS(s) | mpReviews ⋈ products | count over the seller's products | 0 | S5 "Ulasan", S8 "(0)", S9 "(0 reviews)" |
| Q-M20-SELLER-RATING(s) | mpReviews | BR-M20-16 | none → "☆☆☆☆☆" | S5, S7, S8, S9 |
| Q-M20-IMAGES(p) | mpImages | ordered by position | #1 4, #2 5, #3 5, #4 3, #5 4, #6 4, #7 5, #8 5, #9 5, #10 5 (Σ 45) | S3 "Gambar Sedia Ada ({n})", S7 gallery, S12 |
| Q-M20-RELATED(p) | mpProducts | BR-M20-20 | #1 → [6]; #5 → [2, 7]; #7 → [2, 5] | S7 |
| Q-M20-SELLER-LATEST(s, 6) | mpProducts | createdAt desc, id asc | [1, 2, 3, 4, 5, 6] | S9 |
| Q-M20-SELLER-OWN(s, page) | mpProducts | sellerId = s, id asc | 10 rows | S10 |
| Q-M20-WA-CLICKS(s) | mpSellers | stored `whatsappClicks` | 16 | S9 "Klik WhatsApp" |

### 6.9 Count reconciliation (every observed figure; by hand)

Clock = 2026-09-25T15:40:00+08:00; discovery = 2026-09-27 05:01 MYT.

| ID | Check | Result | Status |
|---|---|---|---|
| R01 | ids 1–10 contiguous; all active, available, seller 1 | 10 / 10 / 10 | PASS |
| R02 | S1 category counts from `categoryId` | 1: #1, #6; 2: #2, #5, #7; 3: #3, #10; 4: #4, #9; 5: none; 6: #8 → 2 / 3 / 2 / 2 / 0 / 1 (Σ 10) | PASS |
| R03 | status counts | active 10, draft 0, rejected 0 | PASS |
| R04 | Σ views (pre-discovery) | 30 + 14 + 13 + 5 + 7 + 3 + 5 + 19 + 6 + 9 = 111; + discovery 6 (#1 3, #5 1, #7 2) = 117 = live post-run | PASS |
| R05 | discount badges | #1 30.8→31, #2 30.8→31, #3 57.1→57, #4 28.3→28, #6 23.4→23, #7 63.2→63, #8 24.1→24, #9 34.1→34, #10 56.2→56; #5 none | PASS |
| R06 | "Harga ↑" | #9 14.50, #3 15.00, #8 18.90, #5 19.90, #6 22.90, #7 25.00, #4 32.90, #10 35.00, #2 45.00, #1 89.90 = live | PASS |
| R07 | "Popular" at the seed | 30, 19, 14, 13, 9, 7, 6, 5, 5, 3 → #1, #8, #2, #3, #10, #5, #9, #4, #7, #6 (live post-run #7 at 7 sat before #9; the difference is the discovery's own views) | PASS (tie INFERRED) |
| R08 | category orders (id desc) and condition counts | peralatan #6, #1; buku #7, #5, #2; uniform #10, #3; stationery #9, #4; lain #8; new 7, used 3 = live | PASS |
| R09 | shipping lines | postage #1 RM8.00, #4 RM5.00, #6 RM5.00, #7 RM10.00; free #2, #5; cod #3, #8, #10; pickup #9 = live cards | PASS |
| R10 | related products | #1 → [6]; #5 → [2, 7]; #7 → [2, 5] = live | PASS |
| R11 | seller stats (all / pending / active / suspended / banned filters) | 0/1/1/1, 0/0/0/0, 0/1/1/1, 0/0/0/0, 0/0/0/0 = live | PASS |
| R12 | seller product counts | 10 all, 10 active, 10 visible = S4 / S5 / S7 / S8 / S9 | PASS |
| R13 | "Bergabung 7 bulan yang lepas" | 2026-02-09 → 2026-09-25 = 7 months 16 days (clock); → 2026-09-27 = 7 months 18 days (live) | PASS |
| R14 | S9 "Produk Terbaru" | equal `createdAt` → id asc → #1–#6 = live | PASS |
| R15 | image counts vs "Gambar Sedia Ada (n)" | 4, 5, 5, 3, 4, 4, 5, 5, 5, 5 (Σ 45); delete-form ids 2–4, 6–9, 11–14, 16–17, 19–21, 23–25, 27–30, 32–35, 37–40, 42–45 observed; the first id of each product (1, 5, 10, 15, 18, 22, 26, 31, 36, 41) INFERRED contiguous | PASS |
| R16 | reviews 0 everywhere | S1 / S10 "0", S5 "0", S7 "Ulasan (0)", S8 "(0)", S9 "(0 reviews)" | PASS |
| R17 | "Klik WhatsApp" | stored 16 (no per-product source; C2) | PASS |
| R18 | no record after the clock | seller and products created 2026-02-09 | PASS |

**Classification.** (a) Computed from M20's stores: R01–R16, R18. (b) Stored counter: R17. (c) Discovery ledger applied: R04, R07. (d) D9 fixes change no figure. No display constant.

### 6.10 Dataset spec (D11; every count is a named query of §6.8)

| Store | Owner | Primitive | Total at the clock | Facets (count-relevant) | Evidence | Runtime ids |
|---|---|---|---|---|---|---|
| `mpCategories` | M20 | constant fixture | 6 | — | S1 / S6 options, chips | — |
| `mpProducts` | M20 | materialised table (every row observed) | 10 | category, status, condition, stock, shipping, seller | snapshot `S3_productFields`, `S1_adminProducts`, ledger | 11 → |
| `mpImages` | M20 | materialised table | 45 | product, position | snapshot `imageCount` / `imageIds` | 46 → |
| `mpSellers` | M20 | materialised table | 1 | status, verified | snapshot `S4_sellers`, `S5_sellerDetail`, `S9_sellerDashboard` | 2 → |
| `mpDocuments`, `mpReviews` | M20 | materialised tables | 0, 0 | — | S5 "Tiada dokumen dimuat naik"; "Ulasan (0)" | 1 → |
| owner user | **M01 / M02** | canonical account 1 | — | — | M01 §6.8 | — |

### 6.11 Seed (every value observed unless marked; contact data fictitious)

**A. Seller (1).**

| id | userId | shopName | description | phone | whatsapp | status | verifiedAt | createdAt | whatsappClicks |
|---|---|---|---|---|---|---|---|---|---|
| 1 | 1 (`admin@demo.test`, "Admin Demo") | JomBelajar Official | Kedai rasmi JomBelajar — peralatan sekolah berkualiti untuk semua pelajar Malaysia 🇲🇾 | 0100000000 (fictitious) | 60100000000 (fictitious) | active | 2026-02-09 12:00 MYT (date observed; time designed) | 2026-02-09 12:00 MYT (date observed; time designed) | 16 |

**B. Products (10).** Views = the values **before** discovery (ledger). All `status` active, `stockStatus` available, `sellerId` 1, `createdAt` 2026-02-09 12:00 MYT (one instant, designed; reproduces the observed tie orders).

| id | slug | name | cat | price | original | cond. | shipping | fee | location | views |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | beg-sekolah-anti-air-premium-vH1Fj | Beg Sekolah Anti-Air Premium | 1 | 89.90 | 129.90 | new | postage | 8.00 | Kuala Lumpur | 30 |
| 2 | set-buku-latihan-matematik-tahun-6-5-buku-PAjPe | Set Buku Latihan Matematik Tahun 6 (5 Buku) | 2 | 45.00 | 65.00 | new | free | — | Selangor | 14 |
| 3 | uniform-sekolah-baju-putih-lengan-panjang-saiz-m-hE8Jf | Uniform Sekolah Baju Putih Lengan Panjang (Saiz M) | 3 | 15.00 | 35.00 | used | cod | — | Petaling Jaya, Selangor | 13 |
| 4 | set-pensel-warna-faber-castell-48-warna-jj9F5 | Set Pensel Warna Faber-Castell 48 Warna | 4 | 32.90 | 45.90 | new | postage | 5.00 | Shah Alam | 5 |
| 5 | e-book-1001-soalan-sains-tingkatan-3-pdf-tqd84 | E-Book: 1001 Soalan Sains Tingkatan 3 (PDF) | 2 | 19.90 | — | new | free | — | Digital | 7 |
| 6 | kotak-pensel-3-tingkat-disney-frozen-strUX | Kotak Pensel 3 Tingkat Disney Frozen | 1 | 22.90 | 29.90 | new | postage | 5.00 | Johor Bahru | 3 |
| 7 | kamus-dewan-edisi-keempat-terpakai-8axTV | Kamus Dewan Edisi Keempat (Terpakai) | 2 | 25.00 | 68.00 | used | postage | 10.00 | Penang | 5 |
| 8 | botol-air-750ml-bpa-free-biru-KEz9H | Botol Air 750ml BPA Free (Biru) | 6 | 18.90 | 24.90 | new | cod | — | Klang Valley | 19 |
| 9 | set-pembaris-t-square-jangka-lukis-matematik-36YYY | Set Pembaris T-Square + Jangka Lukis Matematik | 4 | 14.50 | 22.00 | new | pickup | — | Cyberjaya, Selangor | 6 |
| 10 | kasut-sekolah-hitam-bata-saiz-5-jvPNC | Kasut Sekolah Hitam BATA (Saiz 5) | 3 | 35.00 | 79.90 | used | cod | — | Subang Jaya | 9 |

Descriptions (exact live text): discovery §5.2 and §2.7 (#1 "Beg sekolah kalis air dengan 4 kompartmen, bahan nylon berkualiti tinggi. Sesuai untuk pelajar sekolah rendah dan menengah. Ringan dan tahan lama!", #2 "Set lengkap 5 buku latihan Matematik Tahun 6 mengikut silibus KSSR Semakan. Termasuk latihan UPSR, tips peperiksaan, dan jawapan penuh.", #3 "Baju sekolah putih lengan panjang, kain berkualiti, kolar bersih. Saiz M sesuai untuk pelajar 10-12 tahun. Terpakai tapi masih elok!", #4 "Set pensel warna 48 batang Faber-Castell Classic. Warna terang dan mudah gaul. Sesuai untuk lukisan, seni, dan projek sekolah.", #5 "Koleksi 1001 soalan Sains Tingkatan 3 dalam format PDF. Termasuk jawapan dan penerangan lengkap. Boleh cetak atau baca di tablet!", #6 "Kotak pensel 3 tingkat bertema Disney Frozen! Ada cermin, pengasah, dan pemadam. Kalis air dan sangat comel. Anak perempuan mesti suka!", #7 "Kamus Dewan Bahasa dan Pustaka edisi keempat. Keadaan baik, tiada koyak atau conteng. Kulit keras, tahan lama. Wajib ada untuk pelajar!", #8 "Botol air 750ml BPA-free, bahan Tritan tahan lama. Ada straw dan penutup kunci. Sesuai untuk ke sekolah, tuisyen, dan aktiviti sukan.", #9 "Set lengkap alat lukisan geometri: pembaris T-square, jangka lukis, set square 30/60, protraktor, dan pensel 2B. Untuk kelas Matematik dan Lukisan.", #10 "Kasut sekolah hitam jenama BATA, saiz 5 (UK). Baru pakai 2 bulan, masih dalam keadaan sangat baik. Tapak masih tebal, sesuai pelajar tingkatan 1-3.").

**C. Images (45).** Product → image ids (position 1…n): #1 1–4; #2 5–9; #3 10–14; #4 15–17; #5 18–21; #6 22–25; #7 26–30; #8 31–35; #9 36–40; #10 41–45 (R15). **Files (user-approved at G1, 2026-09-27; OQ-M20-11 resolved):** the 45 live photos are copied **once, read-only**, like the F-19 logo. A build task issues plain `GET`s for the image files only (the `/uploads/products/{productId}/img_{n}_{hash}.jpg` URLs listed in the inventory / admin edit pages — never a product page, which would count a view, and no other request), ≥ 350 ms apart, and saves them as `public/images/marketplace/products/{productId}/img_{position}.jpg`. Every seed `url` references these local paths; the rebuild never loads an image from live at run time.

**D. Categories:** §6.2. **Documents, reviews:** none.

**E. Test-only fixtures** (never loaded with the observed-figure checks): `m20-many` (15 extra active products of seller 1, ids 11–25, for paging); `m20-second-seller` (seller 2 "Kedai Ujian Demo" owned by pelajar id 2, active, verified, with product 11); `m20-out-of-stock` (#4 `out_of_stock`).

### 6.12 Cross-module requests (XR-M20-nn; applied through the XL gate — M20 does not edit the owners' stores)

| ID | To | Request | Why | Status |
|---|---|---|---|---|
| XR-M20-01 | M01 (v1.12) / M02 (v1.23) | Expose `users.get(id)` → `{id, name, email, role}` for the seller owner (account 1 "Admin Demo", `admin@demo.test`); route meta for `/admin/marketplace/*` (admin), `/marketplace*` (signed-in) and `/seller/*` (signed-in; the seller check is M20's). No user field is added. | Owner name / e-mail on S2, S4, S5 (DV-M20-10); guards. | Requested |
| XR-M20-02 | Global shell (design/shells.md) | SHA group "Marketplace" (Produk, Penjual) with active states and the "Lagi" section; SHU "Marketplace" (student, admin — already in `src/shells/nav/user-nav.ts`), admin "Urus Produk" / "Urus Penjual"; **"Kedai Saya"** (`fa-store`) → `/seller/dashboard` in the account dropdown and the mobile drawer "Gamifikasi" section, directly below "Marketplace", shown only when `mpSellers.forUser(currentUser)` returns a Seller, active on S9–S12 (FR-M20-79, user-approved new scope at G1, DV-M20-06); no other seller-portal entry; header titles with dynamic subtitles (§2). | Shell renders the entries. | Requested (updated v1.2) |
| XR-M20-03 | M14 | Confirm that no M14 flow reads or writes marketplace data and that the header chips are unaffected by M20. | Boundary (FN-M20-6.1.4). | Requested (confirmation only) |
| XR-M20-04 | M15 | Confirm that Kedai Hadiah (`/admin/hadiah`, `/gamification/rewards`) shares no store, route or label with M20. | Two different shops (C5). | Requested (confirmation only) |
| XR-M20-05 | M19 | Confirm that `payments.type` has no marketplace value and revenue never includes marketplace data. | No payment (C5). | Requested (confirmation only) |
| XR-M20-06 | M22 | No notification is sent for seller registration, verification, ban or WhatsApp click (none observed). | Scope. | Requested (confirmation only) |
| XR-M20-07 | ui-ux-designer (design-system §6) | Add icon rows for `fa-shopping-bag`, `fa-user-tie`, `fa-hand-holding-usd`, `fa-pencil-ruler`, `fa-tshirt`, `fa-tablet-alt`, `fa-box`, `fa-phone` (see §10.1); the brand icon `fa-whatsapp` stays under the §6.9 decision. | The icon guard fails on names without a row. | Applied (design-system v1.8) |

### 6.13 Test hooks (dev / test builds only)

`mock.reset()`; `mock.setUser(id)`; `__mock.setNow(iso)`; `mock.loadFixture('m20-many' \| 'm20-second-seller' \| 'm20-out-of-stock')`; `mock.marketplace.whatsappLog()` returns the URLs handed over by #16 (E2E catches the popup tab opened by the S7 link, aborts its external `wa.me` navigation and asserts the recorded URL, D14).

---

## 7. Mock API endpoints

Base `/api`; envelope and error format of SRS.md §7. Auth: **AD** admin; **U** any signed-in user; **SL** owner of a Seller. Guest → `401`; wrong role → `403`; unknown or foreign ids → `404`. Every mutation requires the CSRF header (SEC-M20-06). Multipart bodies carry `images[]`.

| # | Method | Path | Auth | Mut. | Request | Response (data) | Errors | Live equivalent |
|---|---|---|---|---|---|---|---|---|
| 1 | GET | `/api/admin/marketplace/products` | AD | no | `q?, category?, status?, page?` | `{data: AdminProductRow[] (≤ 20), meta}` | 401, 403 | GET `/admin/marketplace/products` |
| 2 | GET | `/api/admin/marketplace/products/:id` | AD | no | — | product + images | 401, 403, 404 | GET `…/{id}/edit` |
| 3 | POST | `/api/admin/marketplace/products` | AD | yes | multipart product fields + `sellerId?` + `images[]` | 201 `{id, slug}` | 401, 403, 422 | POST `/admin/marketplace/products` |
| 4 | PUT | `/api/admin/marketplace/products/:id` | AD | yes | multipart fields + `status` + `images[]` | product | 401, 403, 404, 422 | PUT `/admin/marketplace/products/{id}` |
| 5 | DELETE | `/api/admin/marketplace/products/:id` | AD | yes | — | 204 | 401, 403, 404 | DELETE `/admin/marketplace/products/{id}` |
| 6 | POST | `/api/admin/marketplace/products/:id/toggle` | AD | yes | — | `{status}` | 401, 403, 404 | POST `…/{id}/toggle` |
| 7 | DELETE | `/api/admin/marketplace/products/images/:imageId` | AD | yes | — | 204 | 401, 403, 404 | DELETE `/admin/marketplace/products/image/{id}` |
| 8 | GET | `/api/admin/marketplace/sellers` | AD | no | `status?` | `{data: SellerRow[], stats: SellerStats}` | 401, 403 | GET `/admin/marketplace/sellers` |
| 9 | GET | `/api/admin/marketplace/sellers/:id` | AD | no | — | seller detail (owner, contacts, documents, products, summary) | 401, 403, 404 | GET `/admin/marketplace/sellers/{id}` |
| 10 | POST | `/api/admin/marketplace/sellers/:id/ban` | AD | yes | — | `{status: 'banned', deactivated: n}` | 401, 403, 404 | POST `…/{id}/ban` |
| 11 | POST | `/api/admin/marketplace/sellers/:id/approve` | AD | yes | — | `{status: 'active', verifiedAt}` | 401, 403, 404, 409 | not observable (PROPOSED) |
| 12 | GET | `/api/admin/marketplace/seller-options` | AD | no | — | `[{id, label}]` ("{shop} — {owner}{ ✅}") | 401, 403 | S2 select |
| 13 | GET | `/api/marketplace/categories` | U | no | — | `MarketplaceCategory[6]` | 401 | selects, chips |
| 14 | GET | `/api/marketplace/products` | U | no | `q?, category?, condition?, sort?, page?` | `{data: ProductCard[] (≤ 20), meta}` | 401 | GET `/marketplace` |
| 15 | GET | `/api/marketplace/products/:slug` | U | yes (views) | — | `ProductDetail` (views after +1) | 401, 404 | GET `/marketplace/{slug}` |
| 16 | POST | `/api/marketplace/products/:slug/whatsapp` | U | yes (clicks) | — | `{url}` (BR-M20-21; D14: no screen) | 401, 404 | GET `/marketplace/{slug}/whatsapp` → wa.me |
| 17 | GET | `/api/marketplace/sellers/:id` | U | no | — | shop card + `ProductCard[]` | 401, 404 | GET `/marketplace/penjual/{id}` |
| 18 | GET | `/api/seller/me` | U | no | — | `SellerDashboard` or `{seller: null}` | 401 | GET `/seller/dashboard`, `/seller/daftar` |
| 19 | POST | `/api/seller/register` | U | yes | `{shopName, description?, phone, whatsapp}` | 201 `{sellerId}` | 401, 409, 422 | `/seller/daftar` form (PROPOSED) |
| 20 | GET | `/api/seller/products` | SL | no | `page?` | `{data, meta}` | 401, 403 | GET `/seller/produk` |
| 21 | POST | `/api/seller/products` | SL | yes | multipart product fields + `images[]` | 201 `{id, slug}` | 401, 403, 422 | POST `/seller/produk` |
| 22 | GET | `/api/seller/products/:id` | SL | no | — | own product + images | 401, 403, 404 | GET `/seller/produk/{id}/edit` |
| 23 | PUT | `/api/seller/products/:id` | SL | yes | multipart fields + `images[]` | product | 401, 403, 404, 422 | PUT `/seller/produk/{id}` |
| 24 | DELETE | `/api/seller/products/:id` | SL | yes | — | 204 | 401, 403, 404 | DELETE `/seller/produk/{id}` |

Repository contract (`@/modules/m20-marketplace/mock`): `mpProducts.list(filter, page)`, `mpProducts.buyerList(filter, sort, page)`, `mpProducts.get(id | slug)`, `mpProducts.view(slug)`, `mpProducts.count(name, …)` (Q-M20-*), `mpImages.forProduct(id)`, `mpSellers.list(filter)`, `mpSellers.stats(filter)`, `mpSellers.forUser(userId)`, `mpSellers.click(slug)`, `mpReviews.count(…)`, `mpCategories.all()`.

---

## 8. States & messages

### 8.1 Observed copy (exact)

- **S1:** "{n} produk dijumpai", "Tambah Produk", "Cari produk...", "Semua Kategori", "Semua Status", "Aktif", "Draf", "Ditolak", "Tapis", "Baru", "Terpakai", "Active", titles "Lihat", "Nyahaktif", "Edit", "Padam", confirm "Padam produk ini?", empty "📦" "Tiada Produk" "Tambah produk pertama sekarang!".
- **S2 / S3 / S11 / S12:** "Kembali ke Senarai Produk", "Kembali", "Penjual", "🏪 PRESTASIPLUS Official (Admin)", "Kosongkan untuk jual sebagai "PRESTASIPLUS Official"", "Maklumat Produk", "Kemaskini Produk", "Nama Produk *", "Kategori *", "Pilih Kategori", "Harga (RM) *", "Harga Asal (RM)", "Untuk tunjukkan diskaun", "Penerangan", "Keadaan *", "🆕 Baru", "♻️ Terpakai", "Status Stok *", "✅ Ada", "❌ Habis", "Status Produk *", "🟢 Aktif", "⏸️ Draf", "🔴 Ditolak", "Penghantaran", "Kaedah Penghantaran *", "Ambil Sendiri", "Pos / Kurier", "COD", "Percuma", "Kos Penghantaran (RM)", "Kosongkan jika percuma", "Lokasi", "cth: Kuala Lumpur", "Gambar Produk", "Muat naik sehingga 5 gambar. Gambar pertama jadi gambar utama.", "JPG, PNG, WEBP. Maks 2MB setiap gambar.", "Gambar Sedia Ada ({n})", "Gambar Sedia Ada", "Utama", confirm "Padam gambar ini?", "Tambah Gambar Baru", "Simpan Perubahan", "Tambah Produk".
- **S4 / S5:** "Menunggu Pengesahan", "Aktif", "Jumlah Penjual", "Verified", "Semua Status", "Pending", "Digantung", "Diharamkan", "Tapis", "{n} produk", "Lihat Detail", "Haramkan", confirm "Haramkan penjual ini?", "Tiada penjual dijumpai", "Kembali ke Senarai Penjual", "Maklumat Perniagaan", "Dokumen", "Tiada dokumen dimuat naik", "Produk ({n})", "Ringkasan", "Jumlah Produk", "Rating", "Ulasan", "Didaftarkan", "Disahkan", "Tindakan", "Haramkan Penjual", confirm "Haramkan penjual ini? Semua produk akan dinyahaktifkan.".
- **S6 / S7 / S8:** "Cari peralatan sekolah...", "Semua Kategori", "Semua Keadaan", "Terbaru", "Harga ↑", "Harga ↓", "Popular", "Cari", "Semua", category names, "Terpakai", "-{p}%", shipping lines (BR-M20-17), "🛒" "Tiada Produk Dijumpai" "Cuba tukar kata kunci atau kategori", "Kembali ke Marketplace", "{n} tontonan", "Ada Stok", "Hubungi Penjual di WhatsApp", "Penjual", "{n} produk", "Ulasan ({n})", "Belum ada ulasan untuk produk ini", "Produk Berkaitan", "Bergabung {…} yang lepas".
- **S9 / S10:** "Jumlah Produk", "Produk Aktif", "Jumlah Tontonan", "Klik WhatsApp", "Tambah Produk", "Senarai Produk", "Lihat Kedai Saya", "Profil Kedai", "Nama:", "Status:", "Verified", "Rating:", "(0 reviews)", "WhatsApp:", "Produk Terbaru", "Dashboard", "📦" "Belum Ada Produk" "Tambah produk pertama anda sekarang!".
- **Global 404 (M01):** "404", "🔍", "Halaman Tidak Dijumpai", "Maaf, halaman yang anda cari tidak wujud atau telah dipindahkan. Mungkin URL salah taip?", "Halaman Utama", "Mula Latihan".

### 8.2 PROPOSED COPY and PROPOSED behaviour (reported at G1; G1 approved by the user 2026-09-27; identical to URS OQ-M20-12)

| Item | PROPOSED value | Reason |
|---|---|---|
| Seller menu link | "Kedai Saya" (`fa-store`) → `/seller/dashboard`, account dropdown and mobile drawer, directly below "Marketplace", sellers only | User decision at G1 (new scope, DV-M20-06, FR-M20-79) |
| Registration form R | header "Daftar Penjual" / "Buka kedai anda di marketplace"; tab "Daftar Penjual - PRESTASIPLUS Marketplace"; "Nama Kedai *", "Penerangan Kedai", "No. Telefon *", "No. WhatsApp *", "Daftar Sebagai Penjual"; pending seller shown through S9 "Status:" "Pending" | OQ-M20-01 — approved at G1 as the PROPOSED minimum |
| Verify action | "Sahkan Penjual" (`fa-check`), confirm "Sahkan penjual ini?" | OQ-M20-04 — approved at G1 as the PROPOSED minimum |
| Product photos | the 45 live photos copied once, read-only (image-file GETs only) into `public/images/marketplace/products/{productId}/img_{position}.jpg`; the seed references the local paths (§6.11 C) | OQ-M20-11 — approved at G1 |
| Toggle inactive state | "Aktifkan" (`fa-play`); badges "Draft", "Rejected" | OQ-M20-03 |
| Out of stock on S7 | "Habis Stok" (red) | OQ-M20-03 |
| WhatsApp hand-off | message `Salam, saya berminat dengan produk "{name}" di PRESTASIPLUS Marketplace.`; no screen (D14); platform number `60000000000` | OQ-M20-02, D14 |
| Validation messages | V-M20-01, 02, 06 | not observable |
| Seller-created product defaults | `status` active; shipping `pickup`, no fee, empty location | OQ-M20-07 |
| Platform product display | seller "PRESTASIPLUS Official", no tick, no shop link | OQ-M20-10 |
| Ban effect | active products → `draft`; shop 404 | INFERRED from the S5 confirm |
| Related products limit | 4 | ≤ 2 observed |
| Page size | 20 (S1, S6, S10) | OQ-M20-08 |
| Landing after actions | S1 (admin create / update / toggle / delete), S3 (image delete), S10 (seller actions), page of origin (ban); no flash text | OQ-M20-03 |

### 8.3 Loading and errors

Data views use the shell loading behaviour; a failed request shows the M01 global error convention; unknown ids render the global 404 page; confirms are browser `confirm()` dialogs as live. No M20-specific loading or error copy exists on live.

---

## 9. Permissions matrix

| Route / endpoint | Admin | Pelajar | Ibu Bapa | Guru | Admin Sekolah | PPD / JPN | Penaja | Guest |
|---|---|---|---|---|---|---|---|---|
| S1–S5, #1–#12 | ✓ (OBSERVED) | → `/dashboard`, 403 | → landing, 403 | → landing, 403 | → landing, 403 | → landing, 403 | → landing, 403 | `/login` |
| S6–S8, W, #13–#17 | ✓ (OBSERVED) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | `/login` |
| Menu "Marketplace" | ✓ | ✓ (live sidebar) | — (INFERRED) | — (live sidebar) | — (live sidebar) | — (INFERRED) | — (INFERRED) | — |
| Menu "Kedai Saya" (FR-M20-79, user-approved new scope) | ✓ (owns seller #1) | ✓ if seller | ✓ if seller | ✓ if seller | ✓ if seller | ✓ if seller | ✓ if seller | — |
| R, #19 (no seller yet) | → S9 (OBSERVED) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | `/login` |
| S9–S12, #20–#24 (own seller) | ✓ seller #1 | ✓ if seller | ✓ if seller | ✓ if seller | ✓ if seller | ✓ if seller | ✓ if seller | `/login` |

Admin behaviour OBSERVED; every non-admin cell INFERRED (provisional, OQ-M20-06).

---

## 10. Responsive behaviour

Measured on live by `tools/jobs/M20-measure.js` (snapshot `measure`); the rebuild keeps these layouts. Every row: no horizontal page scroll (`scrollWidth ≤ clientWidth`), no content text below 12 px.

| Screen | 375 | 768 | 1280 |
|---|---|---|---|
| S1 / S10 | row cards: thumbnail, text, 4 (S10: 2) icon actions on one card | same | same |
| S2 / S3 / S11 / S12 | form grids 2 columns (price / original side by side); tiles 2 columns; S3 image grid 4 columns | same | same |
| S4 | stats 2 columns | stats 4 | stats 4 |
| S5 | 1 column; product grid 2 | 2 columns; product grid 3 | 3 columns (2 + 1); product grid 3 |
| S6 | grid 2 (prices wrap "RM" / amount); chips wrap; subtitle truncated by the shell | grid 3 | grid 4 |
| S7 | gallery and details stacked; thumbnails 4 per row | 2 columns | 2 columns; H1 24 px |
| S8 | grid 2; decorative circle clipped | grid 3 | grid 4 |
| S9 | stats 2; product grid 2 | stats 4; grid 3 | stats 4; grid 3 |
| R (PROPOSED) | single card, fields stacked | card max 640 px centred | same |
| 404 | standalone M01 page | same | same |

Admin shell: sidebar drawer below `lg`, bottom nav with "Lagi"; user shell as M01.

### 10.1 Visual fidelity — icons (design-system v1.8 §6)

| FA name (live) | Where | Lucide (design-system §6) |
|---|---|---|
| `fa-store` | S1 seller, S4 menu "Penjual", SHU "Urus Produk", SHU "Kedai Saya" (FR-M20-79, PROPOSED) | `Store` (§6.8 row exists) |
| `fa-plus-circle`, `fa-plus` | "Tambah Produk" | `CirclePlus`, `Plus` |
| `fa-filter` | "Tapis" | `Funnel` |
| `fa-eye`, `fa-star` | views, reviews, "Lihat Detail" | `Eye`, `Star` |
| `fa-external-link-alt` | S1 "Lihat", S9 "Lihat Kedai Saya" | `ExternalLink` |
| `fa-pause`, `fa-play` | toggle | `Pause`, `Play` |
| `fa-edit`, `fa-trash`, `fa-save`, `fa-times` | row / form actions | `SquarePen`, `Trash`, `Save`, `X` |
| `fa-arrow-left` | back links | `ArrowLeft` |
| `fa-map-marker-alt`, `fa-gift` | shipping tiles, location | `MapPin`, `Gift` |
| `fa-ban`, `fa-check`, `fa-check-circle` | ban, verify (PROPOSED), verified tick | `Ban`, `Check`, `CircleCheck` |
| `fa-search`, `fa-book`, `fa-pen`, `fa-th-large` | S6 search, chips, "Produk Berkaitan" | `Search`, `Book`, `Pen`, `LayoutGrid` |
| `fa-user`, `fa-envelope`, `fa-calendar` | S5 owner, e-mail; S8 "Bergabung" | `User`, `Mail`, `Calendar` |
| `fa-whatsapp` | S7 button, S5 link | §6.9 brand icon (dedicated brand SVG; decision held there) |
| `fa-shopping-bag` | SHA group "Marketplace", "Produk"; SHU "Marketplace" | `ShoppingBag` (v1.8, XR-M20-07 applied) |
| `fa-user-tie` | SHU "Urus Penjual" | `UserRound` (v1.8, approximate) |
| `fa-hand-holding-usd` | S2 / S3 tile "COD" | `HandCoins` (v1.8, approximate) |
| `fa-pencil-ruler` | chip / badge "Peralatan Sekolah" | `PencilRuler` (v1.8) |
| `fa-tshirt` | chip "Uniform & Pakaian" | `Shirt` (v1.8) |
| `fa-tablet-alt` | chip "Digital & E-Book" | `Tablet` (v1.8) |
| `fa-box` | S8 "{n} produk", S9 "Senarai Produk" | `Package` (v1.8) |
| `fa-phone` | S5 telephone | `Phone` (v1.8) |

---

## 11. Non-functional requirements

| ID | Requirement |
|---|---|
| NFR-M20-01 | Performance: every M20 endpoint answers from the mock within the configured latency; lists hold ≤ 20 rows per request. |
| NFR-M20-02 | Determinism: seeds, slugs (PRNG stream `m20.slugs`), counters and figures are identical for the same clock and actions (ADR-0006). |
| NFR-M20-03 | Localisation: copy as live (BM with the English terms of URS §0); money and dates per BR-M20-19 in MYT. |
| NFR-M20-04 | Accessibility: replicates live (D10) — native confirm dialogs, tile radios with visually hidden radios, icon-only buttons with their live `title`; no enhancement. |
| NFR-M20-05 | Responsive: §10 at 375 / 768 / 1280, no horizontal page scroll (CLAUDE.md §7). |
| NFR-M20-06 | Privacy: fictitious telephone and WhatsApp numbers; seller contact data only on admin screens (S4, S5) and the seller's own S9; buyers receive the WhatsApp number only through the hand-off URL (as live). |

### 11.1 Security notes (backend phase; **security-engineer review required** — file uploads, personal data, new external input, external redirect)

| ID | Risk | Requirement for the rebuild / backend |
|---|---|---|
| SEC-M20-01 | **File uploads** (S2, S3, S11, S12): type and size checks only in the browser on live. | Server-side MIME and magic-byte check, ≤ 2 MB, ≤ 5 per product, re-encode images, strip EXIF (location data of minors' photos), random file names, serve from a non-executable path. |
| SEC-M20-02 | **External redirect** (W): the target is built from stored data. | Build only `https://wa.me/{digits}` from the seller's stored number; encode the message; never accept a target from the request. Backend / security recommendation only: add `rel="noopener noreferrer"` to the new-tab links (S1 "Lihat", S5 `wa.me`, S7 WhatsApp, S9 "Lihat Kedai Saya") when the production hardening is done; the prototype replicates live, which has no `rel` (D10, AUD-M19-06 precedent). |
| SEC-M20-03 | **IDOR** in the seller portal: sequential product ids. | #22–#24 filter by the viewer's seller and answer 404 for others; admin endpoints check `role = admin` server-side. |
| SEC-M20-04 | **Counter inflation**: views and clicks are not de-duplicated (live behaviour, replicated). | Backend recommendation: rate-limit per session / IP; counters are informational only. |
| SEC-M20-05 | **Stored XSS** in product names, descriptions and shop data written by any seller. | Store plain text; render escaped; no HTML in descriptions. |
| SEC-M20-06 | **CSRF** on every form (live forms carry `_token`). | Every mutation requires the CSRF token; `SameSite` cookies. |
| SEC-M20-07 | **Personal data of sellers**, who may be students (minors): telephone, WhatsApp, e-mail. | Admin-only S4 / S5; the number reaches buyers only through W; consider the legal basis for minors as sellers (OQ-M20-06); seeds fictitious. |
| SEC-M20-08 | **Destructive control without confirm** (D-M20-01). | Fixed (DV-M20-01): every image delete confirms and deletes only its image. |
| SEC-M20-09 | **Ban deactivates every product** of a seller. | Admin only, CSRF, audit log (who, when, seller, products changed). |
| SEC-M20-10 | **Content moderation**: any seller can list any item. | Admin statuses "Draf" / "Ditolak" and the toggle as live; backend recommendation: prohibited-item policy and report flow (not on live, not built). |

---

## 12. E2E test scenarios

Every scenario runs on the three Playwright projects mobile 375×812, tablet 768×1024 and desktop 1280×800 (master SRS §10); a width-specific step names its width and the scenario still runs on all three. Default user: the admin (`mock.setUser(1)`); clock: the **project clock 2026-09-25T15:40:00+08:00**. Values are the seed of §6.11. **Provisional** scenarios assert INFERRED or PROPOSED behaviour. WhatsApp scenarios catch the popup tab opened by the S7 link (`target="_blank"`), abort its external `wa.me` navigation, assert the URL from `mock.marketplace.whatsappLog()` and check that S7 is still open in the original tab (D14).

Provisional: 03, 04, 09, 10, 16, 17, 25, 26, 28, 29, 30, 31, 34, 35, 36, 37, 38, 42, 47, 48, 51, 55, 61, 62, 63, 66, 67, 69, 72, 75, 76, 78, 79, 82, 86 (35 of 86)

| ID | Scenario | FR | AC | Provisional |
|---|---|---|---|---|
| E2E-M20-01 | Admin at 1280 on S1: sidebar group "Marketplace" open, "Produk" active, "Penjual" link; on S3 "Produk" active; on S5 "Penjual" active. | 01 | 01.1 | no |
| E2E-M20-02 | Admin at 375: "Lagi" lists the "Marketplace" section with "Produk" and "Penjual" targets. | 01 | 01.2 | no |
| E2E-M20-03 | Admin account menu: "Marketplace", "Urus Produk", "Urus Penjual" with targets; pelajar sees "Marketplace" only; guru sees none of the three. | 02 | 01.3 | yes |
| E2E-M20-04 | Pelajar (no seller): user menu and mobile drawer contain no `/seller/*` link; admin: the admin-panel sidebar and "Lagi" drawer contain no `/seller/*` link. | 02 | 01.4 | yes |
| E2E-M20-05 | S1–S5 render the admin shell; S6–S12 the user shell; "LIVE:", "MAIN", "DAFTAR" not visible. | 03 | 01.5 | no |
| E2E-M20-06 | Headers and tab titles of S1, S2, S4, S6, S10, S11 as AC-02.1. | 04, 05 | 02.1 | no |
| E2E-M20-07 | Headers and tab titles of S3 #1, S5 #1, S7 #1, S7 #5, S8 #1, S9, S12 #7 as AC-02.2. | 04, 05 | 02.2 | no |
| E2E-M20-08 | Guest opens `/admin/marketplace/products`, `/marketplace`, S7 #1, `/seller/dashboard` → `/login`. | 06 | 03.1 | no |
| E2E-M20-09 | Pelajar opens the four admin routes → `/dashboard`; `GET /api/admin/marketplace/products` → 403. | 07 | 03.2 | yes |
| E2E-M20-10 | Pelajar opens S6, S7 #1, S8 #1 (render) and the four seller routes (→ `/seller/daftar`). | 08 | 03.3, 03.4 | yes |
| E2E-M20-11 | Admin opens `/seller/daftar` → `/seller/dashboard`. | 08, 63 | 03.5, 19.1 | no |
| E2E-M20-12 | The five unknown-id / slug routes of AC-04.1 → 404 copy. | 09 | 04.1 | no |
| E2E-M20-13 | `/admin/marketplace/products/1`, `/seller/produk/1` → 404 page; "Oops! An Error Occurred" absent. | 10 | 04.2 | no |
| E2E-M20-14 | Every probed route of URS §1 → 404 page. | 09 | 04.3 | no |
| E2E-M20-15 | Price formats and discount badges on S1 and S6 (AC-05.1). | 11 | 05.1 | no |
| E2E-M20-16 | S5 dates, S8 "Bergabung 7 bulan yang lepas"; clock 2026-10-10 → "Bergabung 8 bulan yang lepas". | 12 | 05.2 | yes |
| E2E-M20-17 | Seed: no pager on S1, S6, S10; fixture `m20-many`: 20 rows and a pager keeping `category=buku-rujukan` on S6. | 13 | 05.3 | yes |
| E2E-M20-18 | Labels "Active", "Verified", "Pending", "(0 reviews)". | 14 | 05.4 | no |
| E2E-M20-19 | Latency 2 s → loading then grid on S6; fault on #14 → M01 error convention. | 15 | 05.5 | no |
| E2E-M20-20 | S1 count line, "Tambah Produk", filter controls and options, no "Reset". | 17, 18 | 06.1 | no |
| E2E-M20-21 | S1 rows in id order; row 1 / 3 / 5 / 7 / 8 content and views 30 / 7 / 5 / 19. | 20, 24 | 06.2 | no |
| E2E-M20-22 | Filters Buku & Rujukan (3), Peralatan Sekolah (2), Lain-lain (1), Aktif (10), "Beg" (1); values kept. | 18, 19 | 06.3 | no |
| E2E-M20-23 | Draf / Ditolak / Digital / "zzqxv" → "0 produk dijumpai" + empty card; `?page=2` → "10 produk dijumpai" + empty card. | 17, 19, 24, 25 | 06.4 | no |
| E2E-M20-24 | Row 1 "Lihat" href, `target=_blank` and no `rel` attribute; "Edit" → S3 #1. | 21 | 06.5 | no |
| E2E-M20-25 | Toggle #1 → "Draft" / "Aktifkan", filters 9 / 1, S6 9 cards, S7 #1 404, S9 "Produk Aktif" 9; toggle back → 10 cards. | 22, 54 | 07.1, 07.2 | yes |
| E2E-M20-26 | Trash #1: Cancel keeps 10; OK → "9 produk dijumpai", S9 9 / 9 / 81 / 16, S5 "Produk (9)", S6 9, S7 #1 404. | 23, 76 | 07.3 | yes |
| E2E-M20-27 | S2 layout: back link, seller options, every field, tile, placeholder, text and button of AC-08.1; "🆕 Baru", "✅ Ada", "Ambil Sendiri" checked on load; `required` only on name, category and price. | 26, 27, 28, 29 | 08.1 | no |
| E2E-M20-28 | S2 with an empty name, with no category, or with price "0" (defaults left checked): the required / min check stops the submit and nothing is created; server messages of V-M20-01. | 27 | 08.2 | yes |
| E2E-M20-29 | S2 image rules: 6 files, a GIF, a 3 MB JPG → error, nothing created. | 29 | 08.3 | yes |
| E2E-M20-30 | S2 create for seller 1 (AC-08.4): S1 11 rows, S6 first card "-30%" "Pos / Kurier (RM5.00)", slug pattern, S5 "Produk (11)", S9 11. | 30 | 08.4 | yes |
| E2E-M20-31 | S2 create as platform: "PRESTASIPLUS Official" without tick, S7 seller card not a link, seller 1 counts 10. | 30 | 08.5 | yes |
| E2E-M20-32 | S3 #1 prefilled content and live differences (AC-09.1). | 31, 32, 33 | 09.1 | no |
| E2E-M20-33 | S3 #3, #5, #9 variants (AC-09.2). | 31, 33 | 09.2 | no |
| E2E-M20-34 | S3 #1 price 79.90 → S1; S6 "RM 79.90" "-38%"; views 30. | 36 | 09.3 | yes |
| E2E-M20-35 | S3 #1 status Draf → "Draft", S6 9, S7 404; Ditolak → "Rejected", filter 1. | 32, 36, 54 | 09.4 | yes |
| E2E-M20-36 | S3 #1 first × → confirm "Padam gambar ini?"; Cancel; OK → "(3)", new "Utama", #1 still on S1 / S6. | 34 | 10.1 | yes |
| E2E-M20-37 | S3 #1 add 1 image + "Simpan Perubahan" → "(5)", S7 5 thumbnails; location "Ampang" saved. | 35 | 10.2, 10.4 | yes |
| E2E-M20-38 | S3 #3 (5 images) add 1 → error, nothing saved. | 35 | 10.3 | yes |
| E2E-M20-39 | S4 cards 0 / 1 / 1 / 1, filter options, row content "Admin Demo · 0100000000", eye → S5, ban button. | 37, 38, 39, 40 | 11.1 | no |
| E2E-M20-40 | S4 filters Pending / Digantung / Diharamkan → 0 / 0 / 0 / 0 + "Tiada penjual dijumpai"; Aktif → 0 / 1 / 1 / 1. | 37, 38, 41 | 11.2 | no |
| E2E-M20-41 | S4 ban → confirm "Haramkan penjual ini?"; Cancel changes nothing. | 40 | 11.3 | no |
| E2E-M20-42 | Pending seller (after E2E-66 steps): S4 1 / 1 / 2 / 1, badge "Pending"; S5 "Sahkan Penjual" + confirm → "Active", "Disahkan" "25 Sep 2026", S4 0 / 2 / 2 / 2. | 42 | 12.1 | yes |
| E2E-M20-43 | S5 #1 "Maklumat Perniagaan" and "Dokumen" content, WhatsApp href `https://wa.me/60100000000`, `target=_blank`, no `rel`. | 43, 44 | 13.1 | no |
| E2E-M20-44 | S5 "Produk (10)" 10 cards in id order; every thumbnail `naturalWidth > 0`. | 45 | 13.2 | no |
| E2E-M20-45 | S5 "Ringkasan" 10, "☆☆☆☆☆", 0, "09 Feb 2026", "09 Feb 2026". | 46 | 13.3 | no |
| E2E-M20-46 | S5 "Haramkan Penjual" → confirm with the long text; Cancel changes nothing. | 47 | 14.1 | no |
| E2E-M20-47 | S5 ban OK → "Banned"; S4 Diharamkan 0 / 0 / 1 / 1; S1 all "Draft"; S6 empty; S8 #1 404; S9 "Produk Aktif" 0. | 48, 54 | 14.2 | yes |
| E2E-M20-48 | S4 ban OK → same effects as E2E-47. | 40, 48 | 14.3 | yes |
| E2E-M20-49 | S6 search card controls, default "Terbaru", chips and their hrefs, "Semua" active. | 49, 50 | 15.1 | no |
| E2E-M20-50 | S6 10 cards in id order; cards #1, #3, #5, #9 content; card #1 → S7 #1. | 51 | 15.2 | no |
| E2E-M20-51 | Sorts Harga ↑, Harga ↓, Popular orders of AC-15.3. | 52 | 15.3 | yes (tie #4 / #7) |
| E2E-M20-52 | Chips and condition filters: orders of AC-15.4; the clicked chip is active and drops other query values. | 50, 52 | 15.4 | no |
| E2E-M20-53 | "beg" + Peralatan Sekolah + Baru + Popular → #1 only; values kept. | 49, 52 | 15.5 | no |
| E2E-M20-54 | "zzqxv", Digital, `?page=2`, combined no-match → "🛒" empty state. | 53 | 15.6 | no |
| E2E-M20-55 | S7 #1 first visit content of AC-16.1 incl. "31 tontonan" and the WhatsApp href with `target=_blank` and no `rel`. | 55, 56, 57 | 16.1 | yes (no `rel` INFERRED, G5) |
| E2E-M20-56 | S7 #1 thumbnail 2 swaps the main image with no request; border moves. | 55 | 16.2 | no |
| E2E-M20-57 | S7 #1 seller card content and link; "Ulasan (0)" text; no review form. | 59 | 16.3 | no |
| E2E-M20-58 | Related products on S7 #1, #7, #5 (AC-16.4). | 60 | 16.4 | no |
| E2E-M20-59 | S7 #5 and #7 content incl. "8 tontonan", "6 tontonan", 5 thumbnails on #7. | 56, 61 | 16.5 | no |
| E2E-M20-60 | S7 #1 twice → 31 then 32; S1 "32"; S9 113; list pages leave views unchanged. | 61 | 16.6 | no |
| E2E-M20-61 | Click "Hubungi Penjual di WhatsApp" on #1 with `page.waitForEvent('popup')` (the `wa.me` navigation is aborted): the popup renders no app screen; the URL recorded by `whatsappLog()` is `https://wa.me/60100000000?text=…Beg%20Sekolah%20Anti-Air%20Premium…`; the original tab still shows S7 #1; S9 "Klik WhatsApp" 17; #1 views unchanged. | 58 | 17.1 | yes |
| E2E-M20-62 | Click the WhatsApp button on S7 #1 twice (two popups, both recorded) → S9 18; S7 stays open. | 58 | 17.2 | yes |
| E2E-M20-63 | `/marketplace/tiada-produk-zzqxv/whatsapp` → 404 page; counter 16 (rebuild-only route behaviour). | 58 | 17.3 | yes |
| E2E-M20-64 | S8 #1 shop card content and "Bergabung 7 bulan yang lepas". | 62 | 18.1 | no |
| E2E-M20-65 | S8 #1 grid 10 cards in id order, struck prices, no badges, no shipping lines; card → S7. | 62 | 18.2 | no |
| E2E-M20-66 | Pelajar `/seller/daftar`: PROPOSED form fields and button; empty name / bad WhatsApp → messages, nothing created. | 64 | 19.2 | yes |
| E2E-M20-67 | Pelajar registers "Kedai Ujian Demo" → S9 "Status:" "Pending", cards 0 / 0 / 0 / 0; a new product on S10 not on S6; `/seller/daftar` again → S9, S4 "Jumlah Penjual" 2. | 64 | 19.3, 19.4 | yes |
| E2E-M20-68 | S9 cards 10 / 10 / 111 / 16. | 65, 75 | 20.1 | no |
| E2E-M20-69 | S9 buttons and targets ("Lihat Kedai Saya" `target=_blank`, no `rel`); "Profil Kedai" lines incl. "60100000000". | 66 | 20.2, 20.3 | yes (no `rel` INFERRED, G5) |
| E2E-M20-70 | S9 "Produk Terbaru" #1–#6 with views 30, 14, 13, 5, 7, 3 and "Active". | 67 | 20.4 | no |
| E2E-M20-71 | S10 links and 10 rows; row 1 content and edit href. | 68 | 21.1 | no |
| E2E-M20-72 | S10 trash #1: Cancel keeps 10; OK → 9 rows, S9 9 / 9 / 81 / 16. | 69 | 21.2 | yes |
| E2E-M20-73 | `/seller/produk?page=2` → "Belum Ada Produk" empty state and link. | 69 | 21.3 | no |
| E2E-M20-74 | S11 layout: cards and fields of S2 without "Penjual" and "Penghantaran"; "🆕 Baru" and "✅ Ada" checked on load. | 70 | 22.1 | no |
| E2E-M20-75 | S11 create "Pemadam Comel" → S10 11 rows; S6 first card "Ambil Sendiri (Pickup)"; S7 no location line; S9 11 / 11. | 71 | 22.2 | yes |
| E2E-M20-76 | S11 empty name / no category / price 0 (defaults left checked) / 6 images → nothing created. | 70 | 22.3 | yes |
| E2E-M20-77 | S12 #1 and #7 layout: no status, no shipping, images without "Utama" or ×, counts 4 and 5. | 72 | 23.1, 23.2 | no |
| E2E-M20-78 | S12 #1 description change → S10; S7 new description, shipping and location unchanged. | 73 | 23.3 | yes |
| E2E-M20-79 | Fixture `m20-second-seller`: pelajar opens `/seller/produk/1/edit` → 404; `DELETE /api/seller/products/1` → 404; #1 unchanged. | 73 | 23.4 | yes |
| E2E-M20-80 | Store counts at the clock (10 / 45 / 6 / 1 / 0 / 0) and S9 "Jumlah Tontonan" = Σ views = 111. | 74, 75, 76 | 24.1 | no |
| E2E-M20-81 | `?category=2` on S1 and `?category=buku-rujukan` on S6 give #2, #5, #7; Digital empty on both. | 74 | 24.2 | no |
| E2E-M20-82 | `/marketplace/cart`, `/marketplace/pesanan`, `/seller/pesanan` → 404; no coin price or buy button; after a WhatsApp click M19 S1 59 payments and the chip "256 koin" unchanged. | 77 | 24.3 | yes |
| E2E-M20-83 | Stars and review counts of AC-24.4 on S1, S5, S7, S8, S9, S10. | 78 | 24.4 | no |
| E2E-M20-84 | S1–S12 and R at 375 / 768 / 1280: `scrollWidth ≤ clientWidth`; no content text below 12 px. | 16 | 25.1 | no |
| E2E-M20-85 | Grid columns per AC-25.2 at each width (S3, S4, S5, S6, S7, S8, S9, forms). | 16 | 25.2 | no |
| E2E-M20-86 | Admin (seller #1): account dropdown shows "Kedai Saya" directly below "Marketplace" → `/seller/dashboard`; at 375 the mobile drawer shows it below "Marketplace"; active on S9 and S12. Pelajar: absent; after registering "Kedai Ujian Demo" (E2E-67 steps) present. At 375 / 768 / 1280 the menus have no horizontal scroll. | 79 | 01.6 | yes (PROPOSED label, new scope) |

---

## 13. Open questions

Identical to URS §9 (OQ-M20-01 … OQ-M20-12). **G1 approved by the user 2026-09-27.** Resolved at G1: OQ-M20-01 and 04 (registration and "Sahkan Penjual" approved as the PROPOSED minimum), OQ-M20-09 ("Kedai Saya" menu link, new scope, FR-M20-79), OQ-M20-11 (photos copied once, read-only, §6.11 C). Still open and non-blocking: OQ-M20-02 (message text only; the screen is settled by D14), OQ-M20-03 / 05 / 08 (PROPOSED or not built), OQ-M20-06 (provisional non-admin behaviour), OQ-M20-07 / 10 (PROPOSED defaults). To confirm at G5: no `rel` on the S7 WhatsApp button and S9 "Lihat Kedai Saya" (audit R2-01). Owner requests XR-M20-01…06 (§6.12) go through the XL gate; XR-M20-07 (8 icon rows) is already applied in design-system v1.8.
