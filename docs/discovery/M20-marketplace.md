# M20 — Marketplace: admin products and sellers, buyer marketplace, product page, public shop, seller portal (Discovery)

- **Source:** live read-only walk-through of https://prestasiplus.my on **2026-09-27** (04:14–05:20 MYT) with the admin account (browser lane 1, `playwright`).
- **Screenshots:** `docs/discovery/img/M20/` (43 files, §10). Every page was masked in the DOM before capture. The admin shell (`SHA`), the user shell (`SHU`) and design tokens are in [00-global-ui.md](00-global-ui.md) and are not repeated here.
- **Language:** UI copy is quoted in its exact Bahasa Melayu. Some copy on live is English or mixed: raw status "Active" (all lists and the seller badge), "Verified", "(0 reviews)", "Stationery", "Pending" (seller filter), "Cash on Delivery (COD)", "Ambil Sendiri (Pickup)", "COD", "E-Book", "Popular", and the unbranded Symfony 405 page ("Oops! An Error Occurred" …).
- **Personal data:** the only seller on live is the platform's own shop **"JomBelajar Official"**. It belongs to the admin account, whose display name is "Admin PRESTASI+" (a system account, not a person). Its contact e-mail, telephone and WhatsApp number appear on S4, S5 and S9. `tools/jobs/M20.js` → `M20MASK` tags every e-mail-shaped leaf, every phone-shaped leaf or token and the value after a contact / bank / identity label (class `.m20n`, masked and scrubbed globally). It also rewrites wa.me / tel: / mailto: links (`60XXXXXXXXX`) and avatars. `tools/sanitize.js` then runs with `{selectors:['.m20n'], titleName:false}`. `piiLeakCheck` = **0 leaks in all 70 states**; a scripted scan of every M20 file finds no phone digits and no e-mail. **Over-masking (not personal data):** `sanitize.js` treats a form field named `name` and the label "Nama:" as personal. On S3 / S12 the product-name input therefore shows as empty and the header subtitle (the product name) as `<name>`, and on S9 the shop name after "Nama:" and the header subtitle show as `<name>`. The real values are in the snapshot (`header`, `S3_productFields`) and in this document. No real person's name appears in this document.
- **Seed snapshot:** `docs/discovery/inventory/M20/_snapshot-2026-09-27.json`, captured **2026-09-27 05:01 MYT (2026-09-26T21:01Z)** in one pass by `tools/jobs/M20-snapshot.js` (GET only, ≥ 450 ms apart). It holds:
  - the 10 admin product rows and 12 filter results;
  - the seed fields of all 10 products, read from their admin edit pages;
  - the 4 seller stat cards, 4 seller filter results and the seller review page;
  - 17 buyer list variants (every sort / category / condition / search);
  - the 3 product pages already opened and the public shop;
  - the seller dashboard, seller product list and form headers;
  - the header title and subtitle of every screen, the layout measurements (`tools/jobs/M20-measure.js`) and a **view-counter ledger** (§5.4).

  **The snapshot is the seed source.**
- **Element inventory:** **691 content elements** over 12 screens and **70 captured UI states**, IDs `EL-M20-S#-nnn`, in `docs/discovery/inventory/M20/<S#-key>.json`, plus the shell files `SHA-admin-shell.json` (212) and `SHU-user-shell.json` (383). Reconciliation, the crawl and the read-only limits are in `docs/discovery/inventory/M20/_summary.md`.
- **Safety:**
  - A context-level guard (`tools/jobs/M20-guard.js`) was installed **before any capture**. It aborts:
    - every request whose method is not GET / HEAD / OPTIONS, except `POST /login`;
    - every payment-gateway host;
    - every download / export navigation;
    - every write-shaped GET (cart / buy / checkout / pay / toggle / delete / ban / approve …, and the product contact link **`/marketplace/{slug}/whatsapp`**, which counts a click and redirects to wa.me).

    Verified by probe: `POST` and `DELETE /__m20_probe`, `GET /marketplace/__m20_probe/checkout` and `GET /marketplace/__m20_probe/whatsapp` were all blocked.
  - **View counter:** every server GET of a product page adds 1 to its live "tontonan" count (verified: 31 → 32 after one fetch; not deduplicated per session). After this was found, the guard served each product / shop page from an in-memory cache after its first GET (verified: two further GETs added one view). Discovery added **6 views** in total (#1 +3, #7 +2, #5 +1; §5.4). Seeds use the pre-run values.
  - Nothing was submitted, saved, deleted, toggled, banned, uploaded or contacted. Never triggered:
    - admin product "Nyahaktif" toggle (`POST /admin/marketplace/products/{id}/toggle`);
    - admin product delete (`POST _method=DELETE`, `confirm('Padam produk ini?')`);
    - admin product create / update (`POST /admin/marketplace/products`, `PUT /admin/marketplace/products/{id}`);
    - admin image delete (`DELETE /admin/marketplace/products/image/{id}`, `confirm('Padam gambar ini?')`);
    - seller ban (`POST /admin/marketplace/sellers/{id}/ban`);
    - seller-portal create / update / delete (`POST /seller/produk`, `PUT` / `DELETE /seller/produk/{id}`);
    - "Hubungi Penjual di WhatsApp" and the admin wa.me link.
  - Client-side reveals only: the product gallery thumbnail switch (`setMainImage`, no request). Filters, sort, search and pagination were driven by URL query strings (GET).
  - One browser, one request at a time, ≥ 350 ms between navigations (450 ms in the crawl and the snapshot).

Cross-references (owned elsewhere, not re-inventoried):
- **Kedai Hadiah** — `/admin/hadiah` (admin sidebar, next to "Marketplace") and `/gamification/rewards` (user menu) — is the coin rewards shop of **M15**. It is not the marketplace: it uses no money, sellers or WhatsApp.
- The coin / mata / streak chips of the `SHU` header ("256 koin", "8 mata", "1 hari") are **M14** wallet figures. The marketplace has no coin payment and no wallet link.
- **M19** owns payments and `/pricing`. The marketplace has **no online payment, cart, checkout or order**: a buyer contacts the seller on WhatsApp (probes in §1 confirm there are no cart / order routes).
- The global 404 page "Halaman Tidak Dijumpai" and the Symfony 405 page are global (00-global-ui / M19 §2.2).

---

## 1. Overview

The TRACKER checklist had 3 M20 routes. The crawl found **12 screens** (9 new routes), 8 write endpoints (never submitted) and 1 click-counting redirect.

| # | Route | Tab title (`<title>`) · header h1 / subtitle | Shell | Status on admin account |
|---|---|---|---|---|
| S1 | `/admin/marketplace/products` (`?q=&category=&status=&page=`) | "Urus Produk - Admin PRESTASIPLUS" · "Marketplace - Produk" / "Urus semua produk marketplace" | SHA | 200 |
| S2 | `/admin/marketplace/products/create` (**new**) | "Tambah Produk - Admin PRESTASIPLUS" · "Tambah Produk Marketplace" / "Admin feed produk ke marketplace" | SHA | 200 |
| S3 | `/admin/marketplace/products/{id}/edit` (**new**) | "Edit Produk - Admin PRESTASIPLUS" · "Edit Produk" / {product name} | SHA | 200; unknown id → 404; `GET /admin/marketplace/products/{id}` → **405** |
| S4 | `/admin/marketplace/sellers` (`?status=`) | "Urus Penjual - Admin PRESTASIPLUS" · "Marketplace - Penjual" / "Urus dan sahkan penjual" | SHA | 200 |
| S5 | `/admin/marketplace/sellers/{id}` (**new**) | "Semak Penjual - JomBelajar Official" · "Semak Penjual" / {shop name} | SHA | 200; unknown id → 404 |
| S6 | `/marketplace` (`?q=&category=&condition=&sort=&page=`) | "Marketplace - PRESTASIPLUS" · "Marketplace" / "Peralatan sekolah untuk pelajar 🛒" | SHU | 200 |
| S7 | `/marketplace/{slug}` (**new**) | "{product} - Marketplace PRESTASIPLUS" · "Marketplace" / {category name} | SHU | 200; unknown slug → 404 |
| S8 | `/marketplace/penjual/{id}` (**new**) | "JomBelajar Official - Marketplace PRESTASIPLUS" · "Kedai Penjual" / {shop name} | SHU | 200; unknown id → 404 |
| S9 | `/seller/dashboard` (**new**) | "Kedai Saya - PRESTASIPLUS Marketplace" · "Dashboard Penjual" / {shop name} | SHU | 200 (admin owns seller #1); `/seller/daftar` → 302 to here |
| S10 | `/seller/produk` (`?page=`) (**new**) | "Produk Saya - PRESTASIPLUS Marketplace" · "Produk Saya" / "Urus senarai produk anda" | SHU | 200 |
| S11 | `/seller/produk/tambah` (**new**) | "Tambah Produk - PRESTASIPLUS Marketplace" · "Tambah Produk" / "Senaraikan produk baru di marketplace" | SHU | 200 |
| S12 | `/seller/produk/{id}/edit` (**new**) | "Edit Produk - PRESTASIPLUS Marketplace" · "Edit Produk" / {product name} | SHU | 200; unknown id → 404; `GET /seller/produk/{id}` → **405** |

**Access outcomes found by probing (GET):**
- **404** "Halaman Tidak Dijumpai":
  - admin: `/admin/marketplace`, `/admin/marketplace/orders`, `/admin/marketplace/categories`, `/admin/marketplace/reviews`, `/admin/marketplace/sellers/create`, `/admin/marketplace/sellers/1/edit`;
  - buyer: `/marketplace/jual`, `/marketplace/daftar-penjual`, `/marketplace/penjual/daftar`, `/marketplace/saya`, `/marketplace/produk-saya`, `/marketplace/pesanan`, `/marketplace/orders`, `/marketplace/cart`, `/marketplace/create`, `/marketplace/sell`, `/marketplace/seller/register`;
  - seller: `/seller`, `/seller/register`, `/seller/profil`, `/seller/profile`, `/seller/kedai`, `/seller/tetapan`, `/seller/pesanan`, `/seller/orders`, `/seller/ulasan`, `/seller/dokumen`, `/penjual`, `/penjual/dashboard`, `/penjual/produk`.
- **405** Symfony page "Oops! An Error Occurred" / "The server returned a "405 Method Not Allowed"." / "Something is broken. Please let us know what you were doing when this error occurred. We will fix it as soon as possible. Sorry for any inconvenience caused." for `GET /admin/marketplace/products/1` and `GET /seller/produk/1`.
- **302** `/seller/daftar` → `/seller/dashboard` (the admin is already a seller; the registration form is not observable, §9).

**Entry points:**
- SHA sidebar group toggle **"Marketplace"** (`fa-shopping-bag` emerald; `toggle('marketplace')`) with "Produk" (`fa-shopping-bag`) → S1 and "Penjual" (`fa-store`) → S4; the same links are in the mobile "Lagi" drawer.
- SHU user menu (avatar dropdown and mobile drawer): "Marketplace" (`fa-shopping-bag`, emerald) → S6; admin only: "Urus Produk" (`fa-store`, orange) → S1 and "Urus Penjual" (`fa-user-tie`, teal) → S4. There is **no link to the seller portal** (S9–S12) anywhere in the menus. It is reachable only by URL (§8.2 D-M20-06).
- In-module:
  - S1: "Tambah Produk" → S2; row `fa-external-link-alt` → S7; row `fa-edit` → S3.
  - S2 / S3: "Kembali ke Senarai Produk" → S1.
  - S4: row `fa-eye` (title "Lihat Detail") → S5; S5 "Kembali ke Senarai Penjual" → S4.
  - S6: card → S7; S7 "Kembali ke Marketplace" → S6, seller card → S8, "Produk Berkaitan" cards → S7; S8 "Kembali ke Marketplace" → S6, cards → S7.
  - S9: "Tambah Produk" → S11, "Senarai Produk" → S10, "Lihat Kedai Saya" → S8.
  - S10: "Dashboard" → S9, "Tambah Produk" → S11, `fa-edit` → S12; S11 / S12 "Kembali" → S10.

### 1.1 Shell by screen

| Screen | Shell | Evidence |
|---|---|---|
| S1–S5 | `SHA` admin panel (server-status chips, sidebar, header title per page) | header h1 / subtitle as §1 |
| S6–S12 | `SHU` user portal (coin / mata / streak chips, notification bell, avatar menu, tournament banner "LIVE:" / "MAIN" / "DAFTAR" hidden) | same shell as M05–M19 user pages |
| error states | global 404 page (no shell); unbranded Symfony 405 page | S3, S5, S7, S8, S12 `not-found`; S3, S12 `show-405` |

## 2. Screens

### 2.1 S1 — `/admin/marketplace/products` "Marketplace - Produk"

1. Count line "10 produk dijumpai" (`{n} produk dijumpai`) and button link "Tambah Produk" (`fa-plus-circle`) → S2.
2. **GET filter card:**
   - search `q`, placeholder "Cari produk...";
   - select `category`: "" "Semua Kategori", `1` "Peralatan Sekolah", `2` "Buku & Rujukan", `3` "Uniform & Pakaian", `4` "Stationery", `5` "Digital & E-Book", `6` "Lain-lain";
   - select `status`: "" "Semua Status", `active` "Aktif", `draft` "Draf", `rejected` "Ditolak";
   - button "Tapis" (`fa-filter`).

   The filter values are kept after submit. There is no "Reset" link.
3. **Row cards** (`.card`, one per product, no table), in this order:
   - thumbnail (first image);
   - name (h4, truncated) and price "RM 89.90";
   - seller `fa-store` "JomBelajar Official";
   - views `fa-eye` "33";
   - `fa-star` "0" (the product's rating / review figure; 0 on every product);
   - condition badge "Baru" / "Terpakai";
   - status badge "Active" (raw);
   - actions:
     - `fa-external-link-alt` → S7;
     - toggle form `POST /admin/marketplace/products/{id}/toggle`, button `fa-pause` titled "Nyahaktif" on an active product (the draft / inactive variant is not observable);
     - `fa-edit` → S3;
     - delete form `POST /admin/marketplace/products/{id}` `_method=DELETE`, `onsubmit="return confirm('Padam produk ini?')"`, button `fa-trash`.
4. **Order:** id ascending (1 → 10). All 10 fit on one page. No pager is rendered at 10.
5. **Empty state** (`status=draft`, `status=rejected`, `category=5`, `q` with no match, `?page=2`): card "📦" "Tiada Produk" / "Tambah produk pertama sekarang!" + "Tambah Produk" (`fa-plus-circle`) → S2. The count line shows "0 produk dijumpai" for a filter, but **"10 produk dijumpai" on `?page=2`** (count of all, page empty).

### 2.2 S2 — `/admin/marketplace/products/create` "Tambah Produk Marketplace" (new)

Link "Kembali ke Senarai Produk" (`fa-arrow-left`) → S1. The form `POST /admin/marketplace/products` (multipart, `_token`) has four cards.

1. **"Penjual"**:
   - select `seller_id`: "" "🏪 PRESTASIPLUS Official (Admin)", `1` "JomBelajar Official — Admin PRESTASI+ ✅";
   - hint "Kosongkan untuk jual sebagai "PRESTASIPLUS Official"".
2. **"Maklumat Produk"** (2-column grid):
   - "Nama Produk *" `name` (text, required);
   - "Kategori *" `category_id` (required; "" "Pilih Kategori" + the 6 categories);
   - "Harga (RM) *" `price` (number, required, min 0.01, step 0.01);
   - "Harga Asal (RM)" `original_price` (number, min 0, step 0.01) with hint "Untuk tunjukkan diskaun";
   - "Penerangan" `description` (textarea);
   - "Keadaan *": tile radios `condition` "🆕 Baru" (`new`) / "♻️ Terpakai" (`used`);
   - "Status Stok *": tile radios `stock_status` "✅ Ada" (`available`) / "❌ Habis" (`out_of_stock`).
3. **"Penghantaran"**:
   - "Kaedah Penghantaran *": tile radios `shipping_method`:
     - "Ambil Sendiri" (`pickup`, `fa-map-marker-alt`);
     - "Pos / Kurier" (`postage`);
     - "COD" (`cod`, `fa-hand-holding-usd`);
     - "Percuma" (`free`, `fa-gift`);
   - "Kos Penghantaran (RM)" `shipping_fee` (number, min 0, step 0.01, placeholder "Kosongkan jika percuma");
   - "Lokasi" `location` (placeholder "cth: Kuala Lumpur").

   The shipping fee is always visible (no Alpine toggle).
4. **"Gambar Produk"**:
   - "Muat naik sehingga 5 gambar. Gambar pertama jadi gambar utama.";
   - file input `images[]` (multiple, `image/jpeg,image/png,image/webp`);
   - "JPG, PNG, WEBP. Maks 2MB setiap gambar.";
   - button "Tambah Produk" (`fa-plus-circle`, never clicked).

### 2.3 S3 — `/admin/marketplace/products/{id}/edit` "Edit Produk" (new)

- Link "Kembali ke Senarai Produk" → S1. Form `POST /admin/marketplace/products/{id}` `_method=PUT`.
- **"Kemaskini Produk"** holds the same fields as S2 "Maklumat Produk" with these differences:
  - no seller select;
  - `price` has no `min`, `original_price` has no `min`, and there is no "Untuk tunjukkan diskaun" hint;
  - the category select has no "Pilih Kategori" option;
  - an extra field **"Status Produk *"** with tile radios `status`: "🟢 Aktif" (`active`), "⏸️ Draf" (`draft`), "🔴 Ditolak" (`rejected`).
- **"Penghantaran"** is as in S2.
- **"Gambar Sedia Ada ({n})"** is a 4-column grid of the current images (the first has the badge "Utama"). Each image has a red `fa-times` button in a form `POST /admin/marketplace/products/image/{imageId}` `_method=DELETE`, `onsubmit="return confirm('Padam gambar ini?')"`, shown on hover.
- **"Tambah Gambar Baru"**: file input `images[]` (multiple) and button "Simpan Perubahan" (`fa-save`).
- **Broken form nesting (live defect D-M20-01).** The image-delete forms are written *inside* the product form. The browser discards the first nested `<form>` tag, and its `</form>` closes the product form early. Read from the DOM:
  - the first image's `fa-times` button and its hidden `_method=DELETE` become part of the product form, which then carries `_method` PUT **and** DELETE;
  - that button has **no confirm**;
  - "Simpan Perubahan" and the new-image file input end up **outside every form** (`button.form = null`), so saving does nothing;
  - images 2…n keep working delete forms.

  Nothing was clicked. The effect of clicking the first × is INFERRED: Laravel reads the last `_method` value, so it would delete the product.
- Observed variants:
  - #1 new, Pos / Kurier RM8, 4 images;
  - #3 used, COD, 5 images;
  - #5 digital, "Percuma", no original price, 4 images;
  - #9 pickup, 5 images.
- Unknown id → global 404. `GET /admin/marketplace/products/{id}` → Symfony 405 (there is no show route).

### 2.4 S4 — `/admin/marketplace/sellers` "Marketplace - Penjual"

- **4 stat cards** (2 / 4 columns at 375 / ≥ 768): "0" "Menunggu Pengesahan", "1" "Aktif", "1" "Jumlah Penjual", "1" "Verified". **The cards are computed from the filtered query:** with `status=pending`, `suspended` or `banned` all four show 0 (D-M20-04).
- **GET filter:** select `status` ("" "Semua Status", `pending` "Pending", `active` "Aktif", `suspended` "Digantung", `banned` "Diharamkan"), button "Tapis" (`fa-filter`). No "Reset" link.
- **Row card:**
  - avatar initial "J" and shop name (h4) "JomBelajar Official";
  - owner line "Admin PRESTASI+ · {phone}" (masked);
  - status badge "Active" (raw) and "10 produk";
  - actions: `fa-eye` (title "Lihat Detail") → S5; ban form `POST /admin/marketplace/sellers/{id}/ban`, `onsubmit="return confirm('Haramkan penjual ini?')"`, button `fa-ban` (title "Haramkan"; never clicked).
- **Empty state:** "Tiada penjual dijumpai".
- No other seller actions are observable (approve / verify / suspend for a pending seller; §9).

### 2.5 S5 — `/admin/marketplace/sellers/{id}` "Semak Penjual" (new)

- Link "Kembali ke Senarai Penjual" (`fa-arrow-left`) → S4. The grid has 3 columns at 1280 (2 + 1), 2 at 768 and 1 at 375.
- **"Maklumat Perniagaan"**:
  - avatar "J", shop name "JomBelajar Official" + blue verified tick, badge "Active";
  - description "Kedai rasmi JomBelajar — peralatan sekolah berkualiti untuk semua pelajar Malaysia 🇲🇾";
  - owner name "Admin PRESTASI+" (`fa-user`), e-mail (`fa-envelope`, masked), telephone (`fa-phone`, masked);
  - WhatsApp link (`fa-whatsapp`, green) → `https://wa.me/60XXXXXXXXX` (masked).
- **"Dokumen"**: empty state "Tiada dokumen dimuat naik" (a seller can upload documents, but the upload UI is not observable, §9).
- **"Produk (10)"**: 3-column cards (thumbnail, name, "RM 89.90"). **All 10 thumbnails are broken:** they point to `/storage/uploads/products/…` while every other screen uses `/uploads/products/…` (D-M20-03).
- **"Ringkasan"**: "Jumlah Produk" 10, "Rating" "☆☆☆☆☆", "Ulasan" 0, "Didaftarkan" "09 Feb 2026", "Disahkan" "09 Feb 2026".
- **"Tindakan"**: form `POST /admin/marketplace/sellers/{id}/ban`, `onsubmit="return confirm('Haramkan penjual ini? Semua produk akan dinyahaktifkan.')"`, button "Haramkan Penjual" (`fa-ban`, never clicked). The S4 confirm text is shorter ("Haramkan penjual ini?").
- Unknown id → 404.

### 2.6 S6 — `/marketplace` "Marketplace"

1. **Search card** (GET form → `/marketplace`):
   - text `q`, placeholder "Cari peralatan sekolah..." (`fa-search` icon);
   - select `category`: "" "Semua Kategori", `peralatan-sekolah` "Peralatan Sekolah", `buku-rujukan` "Buku & Rujukan", `uniform-pakaian` "Uniform & Pakaian", `stationery` "Stationery", `digital` "Digital & E-Book", `lain-lain` "Lain-lain" (slugs here; S1 uses numeric ids);
   - select `condition`: "" "Semua Keadaan", `new` "Baru", `used` "Terpakai";
   - select `sort`: `latest` "Terbaru" (default), `price_low` "Harga ↑", `price_high` "Harga ↓", `popular` "Popular";
   - button "Cari" (`fa-search`).

   All four values are kept in the form after a search (verified with `q=beg&condition=new&sort=popular&category=peralatan-sekolah` → 1 product).
2. **Category chips** (links, `rounded-full`):
   - "Semua" → `/marketplace`;
   - "Peralatan Sekolah" (`fa-pencil-ruler`), "Buku & Rujukan" (`fa-book`), "Uniform & Pakaian" (`fa-tshirt`), "Stationery" (`fa-pen`), "Digital & E-Book" (`fa-tablet-alt`), "Lain-lain" (`fa-th-large`), each → `?category={slug}`.

   The active chip is `bg-indigo-500 text-white` ("Semua" on the default page); the others are white with a border. A chip link drops the other query values.
3. **Product grid** (2 / 3 / 4 columns at 375 / 768 / 1280). Each card is a link to S7 and shows:
   - the image;
   - a red discount badge "-31%" when an original price exists (`round((original − price) / original × 100)`);
   - an amber badge "Terpakai" for used items;
   - the name (h4, 2 lines);
   - the seller `fa-store` "JomBelajar Official" + verified tick;
   - the price "RM 89.90", the struck original "RM 129.90";
   - the shipping line: "Pos / Kurier (RM8.00)", "Penghantaran Percuma 🎉", "Cash on Delivery (COD)" or "Ambil Sendiri (Pickup)".
4. **Empty state** (`q` no match, `category=digital`, `?page=2`, combined filters with no match): "🛒" "Tiada Produk Dijumpai" / "Cuba tukar kata kunci atau kategori".
5. No pager at 10 products. `?page=2` shows the empty state (no pager).

### 2.7 S7 — `/marketplace/{slug}` product page (new)

- Header subtitle = the category name ("Peralatan Sekolah"). Link "Kembali ke Marketplace" (`fa-arrow-left`) → S6.
- **Gallery card:** the main image and up to 5 thumbnail buttons (`onclick="setMainImage(this, '{url}')"`; the active one has an indigo border). Clicking swaps the main image client-side.
- **Details card:**
  - badges: condition ("Baru" / "Terpakai") and category (with the category icon, e.g. `fa-pencil-ruler` "Peralatan Sekolah");
  - H1 name (24 px);
  - price "RM 89.90", struck "RM 129.90" and badge "-31%" (the original and the badge are hidden when there is no original price, e.g. #5 "RM 19.90");
  - the description;
  - `fa-eye` "{n} tontonan" and stock "Ada Stok" (green; the out-of-stock text is not observable);
  - shipping box with the shipping line ("Pos / Kurier (RM8.00)") and the location (`fa-map-marker-alt` "Kuala Lumpur");
  - green button **"Hubungi Penjual di WhatsApp"** (`fa-whatsapp`) → `/marketplace/{slug}/whatsapp` (never opened).
- **"Penjual"** card (link → S8): avatar "J", "JomBelajar Official" + `fa-check-circle`, "☆☆☆☆☆" and "10 produk".
- **"Ulasan (0)"** (`fa-star`): "Belum ada ulasan untuk produk ini". No review form is shown to the admin viewer (§9).
- **"Produk Berkaitan"** (`fa-th-large`): other active products of the **same category** (image, name, price):
  - #1 → #6 "Kotak Pensel 3 Tingkat Disney Frozen" "RM 22.90";
  - #7 → #2 "Set Buku Latihan Matematik Tahun 6 (5 Buku)" "RM 45.00" and #5 "E-Book: 1001 Soalan Sains Tingkatan 3 (PDF)" "RM 19.90";
  - #5 → #2 and #7 "Kamus Dewan Edisi Keempat (Terpakai)" "RM 25.00".
- Observed texts:
  - #1: "Beg sekolah kalis air dengan 4 kompartmen, bahan nylon berkualiti tinggi. Sesuai untuk pelajar sekolah rendah dan menengah. Ringan dan tahan lama!" · "33 tontonan" · "Kuala Lumpur";
  - #5: "Koleksi 1001 soalan Sains Tingkatan 3 dalam format PDF. Termasuk jawapan dan penerangan lengkap. Boleh cetak atau baca di tablet!" · "8 tontonan" · "Penghantaran Percuma 🎉" · "Digital";
  - #7: "Kamus Dewan Bahasa dan Pustaka edisi keempat. Keadaan baik, tiada koyak atau conteng. Kulit keras, tahan lama. Wajib ada untuk pelajar!" · "7 tontonan" · "Pos / Kurier (RM10.00)" · "Penang".
- Unknown slug → 404.

### 2.8 S8 — `/marketplace/penjual/{id}` "Kedai Penjual" (new)

- "Kembali ke Marketplace" → S6.
- Shop card:
  - avatar "J" and H1 "JomBelajar Official" + tick;
  - description (as S5);
  - "☆☆☆☆☆ (0)", `fa-box` "10 produk", `fa-calendar` "Bergabung 7 bulan yang lepas" (relative time from 09 Feb 2026).

  A decorative absolute circle overflows the card's right edge and is clipped; there is no page overflow.
- Grid (2 / 3 / 4 columns) of the seller's active products (image, name, price, struck original; no badges, no shipping line), ordered by id. Unknown id → 404.

### 2.9 S9 — `/seller/dashboard` "Dashboard Penjual" (new)

- **4 stat cards** (2 / 4 columns): "10" "Jumlah Produk", "10" "Produk Aktif", "117" "Jumlah Tontonan" (111 before this discovery, §5.4), "16" "Klik WhatsApp".
- Buttons: "Tambah Produk" (`fa-plus-circle`, gradient) → S11, "Senarai Produk" (`fa-box`) → S10, "Lihat Kedai Saya" (`fa-external-link-alt`) → S8.
- **"Profil Kedai"**: "Nama:" "JomBelajar Official"; "Status:" `fa-check-circle` "Verified"; "Rating:" "☆☆☆☆☆" "(0 reviews)"; "WhatsApp:" {phone, masked}.
- **"Produk Terbaru"**: the first 6 products by id (1–6) as cards (image, name, "RM 89.90", `fa-eye` views, badge "Active").

### 2.10 S10 — `/seller/produk` "Produk Saya" (new)

- Links "Dashboard" (`fa-arrow-left`) → S9 and "Tambah Produk" (`fa-plus`) → S11.
- Row cards as S1 without seller, condition and toggle: thumbnail, name, price, `fa-eye` views, `fa-star` "0", badge "Active", `fa-edit` → S12, delete form `POST /seller/produk/{id}` `_method=DELETE` `confirm('Padam produk ini?')` (`fa-trash`).
- Empty state (`?page=2`): "📦" "Belum Ada Produk" / "Tambah produk pertama anda sekarang!" + "Tambah Produk" (`fa-plus-circle`).

### 2.11 S11 — `/seller/produk/tambah` "Tambah Produk" (new)

"Kembali" (`fa-arrow-left`) → S10. Form `POST /seller/produk` (multipart) with the S2 cards **"Maklumat Produk"** and **"Gambar Produk"** only (same fields, hints and limits). There is **no seller select and no "Penghantaran" card** (a seller cannot set the shipping method, fee or location). Button "Tambah Produk".

### 2.12 S12 — `/seller/produk/{id}/edit` "Edit Produk" (new)

"Kembali" → S10. Form `POST /seller/produk/{id}` `_method=PUT` with "Kemaskini Produk" as S3, but **without "Status Produk" and without "Penghantaran"**. The form continues with "Gambar Sedia Ada" (the images, no "Utama" badge, no delete buttons, no count), "Tambah Gambar Baru" (file `images[]`) and "Simpan Perubahan" (`fa-save`). Here the button and the file input are inside the form (no nesting defect). Unknown id → 404. `GET /seller/produk/{id}` → 405.

## 3. Flows

### 3.1 Navigation
- Marketplace → Produk (S1) → edit (S3) / new (S2) / view (S7).
- Marketplace → Penjual (S4) → eye → S5.
- User menu → Marketplace (S6) → card (S7) → seller card (S8) → card (S7).
- By URL: /seller/dashboard (S9) → S10 → S11 / S12.

### 3.2 Buying (observed up to the contact button)
There is no cart, order, checkout or payment. S7 "Hubungi Penjual di WhatsApp" → `GET /marketplace/{slug}/whatsapp` → (INFERRED) the seller's "Klik WhatsApp" counter + 1 and a redirect to `wa.me/{seller WhatsApp}`, probably with a prefilled message (the target and the message text are not observable: the link was never opened). The rest of the sale happens outside the platform.

### 3.3 Selling
- A user registers as a seller at `/seller/daftar` (form not observable; the admin is already a seller). The seller becomes "Pending" ("Menunggu Pengesahan") until the admin verifies them ("Disahkan" date).
- The seller adds products (S11) without shipping fields.
- Admin feeds products (S2) either as the platform ("PRESTASIPLUS Official") or for a seller, and moderates status "Aktif" / "Draf" / "Ditolak" (S3) or with the "Nyahaktif" toggle (S1).
- The admin can ban a seller ("Haramkan"). Per the S5 confirm, this deactivates all of that seller's products.

### 3.4 View and click counting
Each server GET of S7 adds 1 to the product's views (no deduplication). "Popular" sort = views descending. The seller dashboard "Jumlah Tontonan" = Σ product views; "Klik WhatsApp" = seller-level count of contact clicks.

## 4. Data entities implied

| Entity | Fields (observed / INFERRED) | Owner |
|---|---|---|
| MarketplaceProduct | `id` int (1–10 live), `sellerId` (1; null = "PRESTASIPLUS Official" INFERRED), `name`, `slug` = slugified name + "-" + 5-char random suffix, `categoryId` (1–6), `price`, `originalPrice` (nullable), `description`, `condition` `new`\|`used`, `stockStatus` `available`\|`out_of_stock`, `status` `active`\|`draft`\|`rejected`, `shippingMethod` `pickup`\|`postage`\|`cod`\|`free`, `shippingFee` (nullable), `location`, `views` int, rating / review count (0), `createdAt` | M20 |
| ProductImage | `id` int (1–40+ live), `productId`, `url` `/uploads/products/{productId}/img_{n}_{hash}.jpg`, order (first = "Utama"), max 5, JPG / PNG / WEBP ≤ 2 MB | M20 |
| MarketplaceCategory | `id` 1–6, `slug` (`peralatan-sekolah`, `buku-rujukan`, `uniform-pakaian`, `stationery`, `digital`, `lain-lain`), name, icon | M20 |
| Seller | `id` int (1 live), `userId` (owner = a user, M01/M02), `shopName`, `description`, `whatsapp`, contact phone / e-mail (from the user INFERRED), `status` `pending`\|`active`\|`suspended`\|`banned`, `verified` (bool / `verifiedAt`), `createdAt` ("Didaftarkan"), `whatsappClicks` int, rating, documents | M20 |
| SellerDocument | uploaded verification documents (none on live) | M20 |
| ProductReview | rating + text per product (none on live; "Ulasan (0)") | M20 |

## 5. Figures: sources, computation and cross-module conflicts

### 5.1 Figures and their probable source

| Screen · figure | Live value | Probable source | Check |
|---|---|---|---|
| S1 "{n} produk dijumpai" | 10 | count(products matching the filters; all statuses) | ✓ ids 1–10 |
| S1 filters | category 1: 2 (#1, #6); 2: 3 (#2, #5, #7); 3: 2 (#3, #10); 4: 2 (#4, #9); 5: 0; 6: 1 (#8); status active 10, draft 0, rejected 0; `q=Beg` 1 | row filters | ✓ Σ categories = 10 |
| S1 / S9 / S10 views | #1 33, #2 14, #3 13, #4 5, #5 8, #6 3, #7 7, #8 19, #9 6, #10 9 | `views` column (after this discovery; pre-run #1 30, #5 7, #7 5) | §5.4 |
| S4 "Menunggu Pengesahan" / "Aktif" / "Jumlah Penjual" / "Verified" | 0 / 1 / 1 / 1 | count by status / all / verified — **of the filtered query** | changes with `status` filter (D-M20-04) |
| S4 / S5 / S7 / S8 "10 produk" | 10 | count(seller's products) | ✓ |
| S5 "Jumlah Produk" / "Ulasan" / "Rating" | 10 / 0 / ☆☆☆☆☆ | products / reviews / average rating (5 empty stars) | ✓ |
| S8 "Bergabung 7 bulan yang lepas" | registered 09 Feb 2026 | relative time (Carbon `diffForHumans`, BM locale) | 09 Feb → 27 Sep = 7 months ✓ |
| S9 "Jumlah Produk" / "Produk Aktif" | 10 / 10 | count all / status active | ✓ |
| S9 "Jumlah Tontonan" | 117 (111 pre-run) | Σ product views | 33+14+13+5+8+3+7+19+6+9 = 117 ✓ |
| S9 "Klik WhatsApp" | 16 | seller-level counter of `/whatsapp` clicks | not derivable from any per-product figure (§5.3 C2) |
| S6 / S7 discount badge | -31%, -31%, -57%, -28%, -23%, -63%, -24%, -34%, -56% | round((original − price) / original × 100) | 89.90 / 129.90 → 30.8 → 31 ✓; 25 / 68 → 63.2 → 63 ✓ |
| S6 "Popular" order | #1, #8, #2, #3, #10, #5, #7, #9, #4, #6 | views descending | 33, 19, 14, 13, 9, 8, 7, 6, 5, 3 ✓ |
| S6 "Harga ↑" / "Harga ↓" | #9, #3, #8, #5, #6, #7, #4, #10, #2, #1 / reverse | price | ✓ |
| S6 "Terbaru" (default) | #1 → #10 (id ascending) | `created_at` desc (INFERRED; the seed rows were probably created together, so the tie falls back to id order) | Perlu pengesahan |
| S6 condition | new 7 (#1, 2, 4, 5, 6, 8, 9), used 3 (#3, 7, 10) | | ✓ |
| S6 categories (slug) | peralatan-sekolah #6, #1; buku-rujukan #7, #5, #2; uniform-pakaian #10, #3; stationery #9, #4; digital 0; lain-lain #8 | within a category the order is **id descending**, while the unfiltered default is ascending | Perlu pengesahan (see D-M20-07) |

### 5.2 Product seed (snapshot `S3_productFields`; views = pre-run values)

| id | Name | Category | Price | Original | Cond. | Stock | Status | Shipping | Fee | Location | Images | Views (pre-run) |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Beg Sekolah Anti-Air Premium | 1 Peralatan Sekolah | 89.90 | 129.90 | new | available | active | postage | 8 | Kuala Lumpur | 4 | 30 |
| 2 | Set Buku Latihan Matematik Tahun 6 (5 Buku) | 2 Buku & Rujukan | 45.00 | 65.00 | new | available | active | free | — | Selangor | 5 | 14 |
| 3 | Uniform Sekolah Baju Putih Lengan Panjang (Saiz M) | 3 Uniform & Pakaian | 15.00 | 35.00 | used | available | active | cod | — | Petaling Jaya, Selangor | 5 | 13 |
| 4 | Set Pensel Warna Faber-Castell 48 Warna | 4 Stationery | 32.90 | 45.90 | new | available | active | postage | 5 | Shah Alam | 3 | 5 |
| 5 | E-Book: 1001 Soalan Sains Tingkatan 3 (PDF) | 2 Buku & Rujukan | 19.90 | — | new | available | active | free | — | Digital | 4 | 7 |
| 6 | Kotak Pensel 3 Tingkat Disney Frozen | 1 Peralatan Sekolah | 22.90 | 29.90 | new | available | active | postage | 5 | Johor Bahru | 4 | 3 |
| 7 | Kamus Dewan Edisi Keempat (Terpakai) | 2 Buku & Rujukan | 25.00 | 68.00 | used | available | active | postage | 10 | Penang | 5 | 5 |
| 8 | Botol Air 750ml BPA Free (Biru) | 6 Lain-lain | 18.90 | 24.90 | new | available | active | cod | — | Klang Valley | 5 | 19 |
| 9 | Set Pembaris T-Square + Jangka Lukis Matematik | 4 Stationery | 14.50 | 22.00 | new | available | active | pickup | — | Cyberjaya, Selangor | 5 | 6 |
| 10 | Kasut Sekolah Hitam BATA (Saiz 5) | 3 Uniform & Pakaian | 35.00 | 79.90 | used | available | active | cod | — | Subang Jaya | 5 | 9 |

Slugs:
- #1 `beg-sekolah-anti-air-premium-vH1Fj`;
- #2 `set-buku-latihan-matematik-tahun-6-5-buku-PAjPe`;
- #3 `uniform-sekolah-baju-putih-lengan-panjang-saiz-m-hE8Jf`;
- #4 `set-pensel-warna-faber-castell-48-warna-jj9F5`;
- #5 `e-book-1001-soalan-sains-tingkatan-3-pdf-tqd84`;
- #6 `kotak-pensel-3-tingkat-disney-frozen-strUX`;
- #7 `kamus-dewan-edisi-keempat-terpakai-8axTV`;
- #8 `botol-air-750ml-bpa-free-biru-KEz9H`;
- #9 `set-pembaris-t-square-jangka-lukis-matematik-36YYY`;
- #10 `kasut-sekolah-hitam-bata-saiz-5-jvPNC`.

Descriptions:
- #1 and #5, #7: see §2.7.
- #2 "Set lengkap 5 buku latihan Matematik Tahun 6 mengikut silibus KSSR Semakan. Termasuk latihan UPSR, tips peperiksaan, dan jawapan penuh."
- #3 "Baju sekolah putih lengan panjang, kain berkualiti, kolar bersih. Saiz M sesuai untuk pelajar 10-12 tahun. Terpakai tapi masih elok!"
- #4 "Set pensel warna 48 batang Faber-Castell Classic. Warna terang dan mudah gaul. Sesuai untuk lukisan, seni, dan projek sekolah."
- #6 "Kotak pensel 3 tingkat bertema Disney Frozen! Ada cermin, pengasah, dan pemadam. Kalis air dan sangat comel. Anak perempuan mesti suka!"
- #8 "Botol air 750ml BPA-free, bahan Tritan tahan lama. Ada straw dan penutup kunci. Sesuai untuk ke sekolah, tuisyen, dan aktiviti sukan."
- #9 "Set lengkap alat lukisan geometri: pembaris T-square, jangka lukis, set square 30/60, protraktor, dan pensel 2B. Untuk kelas Matematik dan Lukisan."
- #10 "Kasut sekolah hitam jenama BATA, saiz 5 (UK). Baru pakai 2 bulan, masih dalam keadaan sangat baik. Tapak masih tebal, sesuai pelajar tingkatan 1-3."

Seller seed: id 1, "JomBelajar Official", description as §2.5, owner = admin account (canonical id 1 in the rebuild), status active, verified, registered and verified 09 Feb 2026, WhatsApp clicks 16, 0 reviews, 0 documents.

### 5.3 Conflicts and questions for other modules

- **C1 — Seller owner = admin account.** The live seller #1 belongs to the admin user (name "Admin PRESTASI+"). The rebuild seeds seller #1 on canonical account **1 (admin@demo.test)** with fictitious contact data (M01 / M02 own the user). The admin-panel display name "Admin PRESTASI+" is a system label (not a person) and may be kept.
- **C2 — "Klik WhatsApp" 16** has no per-product breakdown. It is a stored seller counter (the D11 display-constant exception is not needed; it is a stored value, seeded as 16).
- **C3 — Category naming:** S1 / S2 use numeric `category_id` 1–6; S6 uses slugs. One category store must serve both. "Digital & E-Book" (5) holds no product: the only e-book (#5) is filed under "Buku & Rujukan". This is observed data, not a conflict.
- **C4 — Shipping for seller-created products:** S11 / S12 have no shipping fields, but S6 / S7 always show a shipping line. What a seller-created product shows (default method?) is not observable (§9).
- **C5 — M15 / M19 separation:** the marketplace has no coin price (M15 Kedai Hadiah is coins only) and no gateway payment (M19 filter `type` has no marketplace value). Consistent: nothing to reconcile.

### 5.4 View-counter ledger (this discovery's side effect)

| Product | Views before this run | Added by discovery | After |
|---|---|---|---|
| #1 | 30 | +3 (first crawl, dedup test, cache test) | 33 |
| #5 | 7 | +1 (first inventory capture) | 8 |
| #7 | 5 | +2 (first crawl, first inventory capture before the cache held it) | 7 |
| others | unchanged | 0 | unchanged |
| S9 "Jumlah Tontonan" | 111 | +6 | 117 |

**Seeds use the "before" column** (observed live state not caused by us). No other live value was changed.

## 6. Scripts

### 6.1 S7 gallery
`setMainImage(btn, url)` sets the main image `src` to `url` and moves the indigo border to the clicked thumbnail (no request).

### 6.2 Other screens
S1–S6 and S8–S12 have no page script beyond the shells. Confirms are inline `onsubmit` attributes: "Padam produk ini?" (S1, S10), "Padam gambar ini?" (S3), "Haramkan penjual ini?" (S4), "Haramkan penjual ini? Semua produk akan dinyahaktifkan." (S5).

## 7. Endpoints observed

| Method | URL | Use | Opened? |
|---|---|---|---|
| GET | `/admin/marketplace/products?q=&category=&status=&page=` | S1 | yes |
| GET | `/admin/marketplace/products/create` | S2 | yes |
| POST (multipart) | `/admin/marketplace/products` | S2 "Tambah Produk" | **no** |
| GET | `/admin/marketplace/products/{id}/edit` | S3 | yes |
| PUT (POST `_method=PUT`) | `/admin/marketplace/products/{id}` | S3 "Simpan Perubahan" (button outside the form, D-M20-01) | **no** |
| DELETE (POST `_method=DELETE`) | `/admin/marketplace/products/{id}` | S1 `fa-trash` | **no** |
| POST | `/admin/marketplace/products/{id}/toggle` | S1 "Nyahaktif" | **no** |
| DELETE | `/admin/marketplace/products/image/{imageId}` | S3 image × | **no** |
| GET | `/admin/marketplace/products/{id}` | none (405) | probe only |
| GET | `/admin/marketplace/sellers?status=` | S4 | yes |
| GET | `/admin/marketplace/sellers/{id}` | S5 | yes |
| POST | `/admin/marketplace/sellers/{id}/ban` | S4 `fa-ban`, S5 "Haramkan Penjual" | **no** |
| GET | `/marketplace?q=&category=&condition=&sort=&page=` | S6 | yes |
| GET | `/marketplace/{slug}` | S7 (adds a view) | yes, once per page (cached) |
| GET | `/marketplace/{slug}/whatsapp` | S7 contact → wa.me | **no** (guard) |
| GET | `/marketplace/penjual/{id}` | S8 | yes, once (cached) |
| GET | `/seller/dashboard`, `/seller/daftar` (→ 302) | S9 | yes |
| GET | `/seller/produk?page=` | S10 | yes |
| DELETE | `/seller/produk/{id}` | S10 `fa-trash` | **no** |
| GET / POST | `/seller/produk/tambah` / `/seller/produk` | S11 | GET only |
| GET / PUT | `/seller/produk/{id}/edit` / `/seller/produk/{id}` | S12 | GET only |

## 8. Responsive behaviour (375 / 768 / 1280) and live defects

### 8.1 Layout per screen (measured by `tools/jobs/M20-measure.js`; SHA / SHU pages include a 15 px scrollbar)

| Screen | 375 | 768 | 1280 |
|---|---|---|---|
| S1 | row cards stack text + 4 icon actions; no overflow | same | same |
| S2 / S3 | form grids stay 2 columns (price / original side by side); S3 image grid 4 columns | same | same |
| S4 | stats 2 columns | stats 4 | stats 4 |
| S5 | 1 column; product grid 2 | 2 columns, product grid 3 | 3 columns (2 + 1), product grid 3 |
| S6 | grid 2 columns (prices wrap "RM" / amount on two lines); header subtitle truncated "Peralatan sekolah untuk pel…" | grid 3 | grid 4 |
| S7 | gallery and details stacked; thumbnails 4 | 2 columns | 2 columns; H1 24 px |
| S8 | grid 2; decorative circle clipped | grid 3 | grid 4 |
| S9 | stats 2, product grid 2 | stats 4, grid 3 | stats 4, grid 3 |
| S10–S12 | as S1 / S2 | | |

No screen has horizontal page scroll at any width, and no text is below 12 px. The admin sidebar is a drawer below `lg`.

### 8.2 Live defects (D9 class; the rebuild decision is the URS writer's)

| ID | Defect | Class | Suggested rebuild |
|---|---|---|---|
| D-M20-01 | S3 image-delete forms are nested inside the product form. "Simpan Perubahan" and the new-image input fall outside every form (save does nothing); the first image's × joins the product form with `_method` PUT + DELETE and no confirm (INFERRED: deletes the product) | broken control | separate forms: "Simpan Perubahan" submits PUT; each × deletes only its image, with "Padam gambar ini?" |
| D-M20-02 | `GET /admin/marketplace/products/{id}` and `GET /seller/produk/{id}` → unbranded Symfony 405 page | error page not branded | Perlu pengesahan (reachable only by typing the URL); follow live, or the global 404 (M19 D-M19-07 precedent) |
| D-M20-03 | S5 product thumbnails use `/storage/uploads/products/…` → all 10 broken | broken images | use the same image URL as the other screens |
| D-M20-04 | S4 stat cards follow the `status` filter (pending / suspended / banned → "Aktif 0", "Jumlah Penjual 0" while 1 active seller exists) | contradictory figures | stat cards global (as M19 S1) |
| D-M20-05 | S1 `?page=2` shows "10 produk dijumpai" above "Tiada Produk" | contradictory text | Perlu pengesahan; only reachable by typing the URL; follow live |
| D-M20-06 | The seller portal (S9–S12) has no menu entry; reachable only by URL | missing link / dead end | Perlu pengesahan: probably intentional (sellers get a link after registering, not observable); follow live |
| D-M20-07 | S6 "Terbaru" lists ids ascending unfiltered but descending within a category | inconsistent order | Perlu pengesahan (created_at ties); follow live order per variant |
| D-M20-08 | Mixed-language labels: raw "Active" badge vs "Aktif" filter; "Verified"; "(0 reviews)"; "Pending" | inconsistent labels | follow live (D9 "when unsure, follow live") |

Not defects (replicate): no cart / checkout (contact by WhatsApp by design); the "Digital & E-Book" category is empty; S11 / S12 lack shipping fields; the 405 on show routes; the view counter counting every visit.

### 8.3 Audit-lesson checklist
- Every route of the TRACKER checklist opened (3/3), plus 9 new routes and 34 probes.
- Every filter option exercised by URL: S1 category 6, status 3, q, page; S4 status 4; S6 category 6, condition 2, sort 4, q, page, combined. Counts are in the snapshot.
- The client-side reveal (gallery thumbnail) was captured.
- Every screen captured at 375 / 768 / 1280.
- Error states: 404 (S3, S5, S7, S8, S12), 405 (S3, S12), empty states S1, S4, S6, S10.

## 9. Open questions and states that need a live action

| # | Question | Why not observable |
|---|---|---|
| OQ-M20-01 | Seller registration `/seller/daftar`: form fields, documents, terms, success copy, the "Pending" wait page. | The admin is already a seller (302 to the dashboard); a student / parent account is needed. |
| OQ-M20-02 | Target and message of `/marketplace/{slug}/whatsapp` (wa.me prefilled text). | Opening it counts a click and leaves the site. |
| OQ-M20-03 | Flash messages after create / update / delete / toggle / ban; the draft / rejected / inactive product badges and the toggle's "Aktifkan" state; the "❌ Habis" stock label on S7. | Writes forbidden; all 10 products are active and in stock. |
| OQ-M20-04 | Admin actions on a pending seller (approve / verify / reject / suspend) and on a banned seller (unban). | Only 1 seller, active and verified. |
| OQ-M20-05 | Review submission (who may review, rating input) and a product page with reviews. | 0 reviews; no form shown to the admin viewer. |
| OQ-M20-06 | Which roles see "Marketplace" in the menu and may open `/marketplace` and `/seller/*` (student, teacher, parent). | Only the admin account is available on lane 1. |
| OQ-M20-07 | Shipping line of a product created by a seller (S11 has no shipping fields). | No seller-created product exists. |
| OQ-M20-08 | Pagination size of S1 / S6 / S10 (no pager at 10 products). | Only 10 products. |

## 10. Screenshot index (`docs/discovery/img/M20/`, all masked)

- Admin products: admin-products-desktop, admin-products-tablet, admin-products-mobile, admin-products-empty.
- Admin product create: admin-product-create-desktop, admin-product-create-mobile, admin-product-create-tablet.
- Admin product edit: admin-product-edit-desktop, admin-product-edit-mobile, admin-product-edit-tablet, admin-product-show-405.
- Admin sellers: admin-sellers-desktop, admin-sellers-tablet, admin-sellers-mobile, admin-sellers-empty.
- Admin seller review: admin-seller-show-desktop, admin-seller-show-tablet, admin-seller-show-mobile.
- Buyer marketplace: marketplace-desktop, marketplace-tablet, marketplace-mobile, marketplace-category, marketplace-empty.
- Product page: product-desktop, product-thumb-2, product-used, product-tablet, product-mobile, product-not-found-404.
- Public shop: shop-desktop, shop-tablet, shop-mobile.
- Seller dashboard: seller-dashboard-desktop, seller-dashboard-tablet, seller-dashboard-mobile.
- Seller products: seller-products-desktop, seller-products-mobile, seller-products-tablet, seller-products-empty.
- Seller forms: seller-product-create-desktop, seller-product-create-mobile, seller-product-edit-desktop, seller-product-edit-mobile.

All are `.png`, 43 in total. In the edit / seller-dashboard shots the product-name field and the shop / product-name subtitle are blank or `<name>` because of the sanitizer's over-masking (not personal data).

## Appendix A — Enumerations

| Enum | Values → label |
|---|---|
| Product status | `active` "Aktif" (filter, S3 "🟢 Aktif"), badge "Active"; `draft` "Draf" / "⏸️ Draf"; `rejected` "Ditolak" / "🔴 Ditolak" |
| Condition | `new` "Baru" / "🆕 Baru"; `used` "Terpakai" / "♻️ Terpakai" |
| Stock | `available` "✅ Ada" / S7 "Ada Stok"; `out_of_stock` "❌ Habis" |
| Shipping | `pickup` "Ambil Sendiri" / S6 "Ambil Sendiri (Pickup)"; `postage` "Pos / Kurier" / "Pos / Kurier (RM{fee})"; `cod` "COD" / "Cash on Delivery (COD)"; `free` "Percuma" / "Penghantaran Percuma 🎉" |
| Category | 1 `peralatan-sekolah` "Peralatan Sekolah" (`fa-pencil-ruler`); 2 `buku-rujukan` "Buku & Rujukan" (`fa-book`); 3 `uniform-pakaian` "Uniform & Pakaian" (`fa-tshirt`); 4 `stationery` "Stationery" (`fa-pen`); 5 `digital` "Digital & E-Book" (`fa-tablet-alt`); 6 `lain-lain` "Lain-lain" (`fa-th-large`) |
| Seller status | `pending` "Pending" (card "Menunggu Pengesahan"); `active` "Aktif" / badge "Active"; `suspended` "Digantung"; `banned` "Diharamkan" |
| Buyer sort | `latest` "Terbaru"; `price_low` "Harga ↑"; `price_high` "Harga ↓"; `popular` "Popular" |

## Appendix B — Exact DOM strings (inventory reconciliation)

Strings of the inventory not already quoted above.

- Global 404 (S3, S5, S7, S8, S12 `not-found`): "404", "🔍", "Halaman Tidak Dijumpai", "Maaf, halaman yang anda cari tidak wujud atau telah dipindahkan. Mungkin URL salah taip?", "Halaman Utama" (→ `/`), "Mula Latihan" (→ `/latih-tubi`), "PRESTASIPLUS".
- S1 / S5 / S8 / S9 product names and prices (all quoted in §5.2): "RM 89.90", "RM 45.00", "RM 15.00", "RM 32.90", "RM 19.90", "RM 22.90", "RM 25.00", "RM 18.90", "RM 14.50", "RM 35.00", struck "RM 129.90", "RM 65.00", "RM 35.00", "RM 45.90", "RM 29.90", "RM 68.00", "RM 24.90", "RM 22.00", "RM 79.90".
- S1 count lines: "3 produk dijumpai", "2 produk dijumpai", "1 produk dijumpai", "0 produk dijumpai". S5 "Produk (10)"; S3 "Gambar Sedia Ada (4)", "Gambar Sedia Ada (5)"; S12 "Gambar Sedia Ada".
- S6 card links (full text): "-31% Beg Sekolah Anti-Air Premium JomBelajar Official RM 89.90 RM 129.90 Pos / Kurier (RM8.00)"; "-31% Set Buku Latihan Matematik Tahun 6 (5 Buku) JomBelajar Official RM 45.00 RM 65.00 Penghantaran Percuma 🎉"; "-57% Terpakai Uniform Sekolah Baju Putih Lengan Panjang (Saiz M) JomBelajar Official RM 15.00 RM 35.00 Cash on Delivery (COD)"; "-63% Terpakai Kamus Dewan Edisi Keempat (Terpakai) JomBelajar Official RM 25.00 RM 68.00 Pos / Kurier (RM10.00)"; "E-Book: 1001 Soalan Sains Tingkatan 3 (PDF) JomBelajar Official RM 19.90 Penghantaran Percuma 🎉"; "-24% Botol Air 750ml BPA Free (Biru) JomBelajar Official RM 18.90 RM 24.90 Cash on Delivery (COD)"; "-56% Terpakai Kasut Sekolah Hitam BATA (Saiz 5) JomBelajar Official RM 35.00 RM 79.90 Cash on Delivery (COD)"; "-34% Set Pembaris T-Square + Jangka Lukis Matematik JomBelajar Official RM 14.50 RM 22.00 Ambil Sendiri (Pickup)"; badges "-28%", "-23%".
- S7 / S8 links: "J JomBelajar Official ☆☆☆☆☆ 10 produk"; "Kotak Pensel 3 Tingkat Disney Frozen RM 22.90"; "Set Buku Latihan Matematik Tahun 6 (5 Buku) RM 45.00"; "Kamus Dewan Edisi Keempat (Terpakai) RM 25.00"; "E-Book: 1001 Soalan Sains Tingkatan 3 (PDF) RM 19.90"; "Beg Sekolah Anti-Air Premium RM 89.90 RM 129.90"; "Set Buku Latihan Matematik Tahun 6 (5 Buku) RM 45.00 RM 65.00"; "Uniform Sekolah Baju Putih Lengan Panjang (Saiz M) RM 15.00 RM 35.00"; "Digital".
- S4 "J"; S5 "Admin PRESTASI+"; S9 "Nama:", "Status:", "Rating:", "WhatsApp:".
- Shell strings on SHU pages: "LIVE:", "MAIN", "DAFTAR" (tournament banner, hidden).
- Tile labels without the emoji variation selector (as the reconciliation tool normalises them): "♻ Terpakai", "⏸ Draf".
- Exact code points of the tile labels as rendered: "♻️ Terpakai", "⏸️ Draf"; S4 owner line as inventoried (phone replaced by the inventory's digit mask): "Admin PRESTASI+ · <digits:10>".

### Shell and page-script strings harvested with the M20 screens (owned by 00-global-ui / M22 / M16; listed for reconciliation only)
- SHA server-status chip title fragment "GB /" (S1–S5).
- Tournament banner "LIVE:" icon `fa-circle` (S6–S12).
- SHU scripts on S6–S12:
  - "Accept", "translate(0, 0) scale(1)", "cubic-bezier(0.22, 0.85, 0.32, 1)";
  - PWA: "(display-mode: standalone)", "Tekan Pasang untuk arahan pemasangan", "[App] SW registered, scope:", "[App] SW registration failed:";
  - FCM: "[FCM] Token saved:", "[FCM] Save token failed:", "[FCM] Token error:", "[FCM] Foreground message:", "[FCM] SDK load failed:";
  - chatbot: "Maaf, berlaku ralat. Sila cuba semula.";
  - tournament banner: "Pendaftaran dibuka" / "Sedang berlangsung";
  - chatbot quick questions: "Apakah PrestasiPlus?", "Bagaimana cara mendaftar?", "Berapakah harga langganan?".
