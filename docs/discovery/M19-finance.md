# M19 — Finance & Subscriptions: payments, payment detail and status edit, billing dashboard, dunning log, pricing, invoice history (Discovery)

- **Source:** live read-only walk-through of https://prestasiplus.my on **2026-09-27** (04:14–05:10 MYT) with the admin account (browser lane 1, `playwright`).
- **Screenshots:** `docs/discovery/img/M19/` (28 files, §10). Every page was masked in the DOM before capture. The admin shell (`SHA`), the user shell (`SHU`) and design tokens are in [00-global-ui.md](00-global-ui.md) and are not repeated here.
- **Language:** UI copy is quoted in its exact Bahasa Melayu. Some copy on live is English or mixed: "Billing Dashboard", "Dunning Log", "Grace Period", "Pending", "Bill Code", "Gateway Bill Code", "Gateway Ref", "Gateway", "Event", "Grace Start", "Grace End", "School", "Individual", "Monthly", "Onetime", "Popular", "Unlimited", "Via PPD", "bulk", Laravel's pager "« Previous", "Next »", "Showing … to … of … results", and raw enum values ("personal", "monthly", "onetime", "regular", "toyyibpay") shown on S2 / S3 / S4 (capitalised by CSS on S2).
- **Personal data:** payer names and e-mails (students / parents) appear on S1, S2, S3 and S4; bill codes and gateway references on S2. `tools/jobs/M19.js` → `M19MASK` tags (class `.m19n`, masked and scrubbed globally) every e-mail-shaped leaf, leaves containing BIN / BINTI / A/L / A/P, the cells of the "Pelajar" / "Pengguna" columns and, on admin pages only, the value after a person label ("Pelajar", "Nama", "E-mel" …); it tags bill-code / transaction-id-shaped tokens and the value after "Bill Code" / "Gateway Bill Code" / "Rujukan" labels as `.m19r` (masked in place); it rewrites the pricing WhatsApp number to `60XXXXXXXXX`, person ids in links to `{id}` and avatars. `tools/sanitize.js` then runs with `{selectors:['.m19n'], localSelectors:['.m19r'], titleName:false, cols:'^(pelajar|pengguna|pembayar)$', labels:'pelajar|pengguna|pembayar|nama pelajar'}` on admin pages and `{selectors:['.m19n'], titleName:false}` on the user pages (on `/pricing` "Pelajar" is a package name, not a person label). `piiLeakCheck` = **0 leaks in all 54 states**. The snapshot never returns a payer: payers are `<payer:n>` tokens numbered inside the capture, e-mails a domain class, bill codes and gateway references presence flags. No real person's name, e-mail, phone, bill code or payment reference is written anywhere in this document. **School names** are kept only as observed public anchors (the M02 cross-check, §5.3).
- **Seed snapshot:** `docs/discovery/inventory/M19/_snapshot-2026-09-27.json`, captured **2026-09-27 04:23 MYT (2026-09-26T20:23Z)** in one pass by `tools/jobs/M19-snapshot.js` (GET only, ≥ 450 ms apart). It holds all 59 payment rows (3 pages, payer tokenised), 10 filter results, the non-personal fields of all 59 payment detail pages, the billing figures and its 20 latest rows, the dunning log (21 rows) and 8 filter counts, the pricing figures, forms and comparison table, the invoice empty state, the **M02 school-subscription list read for the cross-check** (14 rows + school id by code) and the layout measurements (`tools/jobs/M19-measure.js`). **The snapshot is the seed source.**
- **Element inventory:** **395 content elements** over 7 screens and **54 captured UI states**, IDs `EL-M19-S#-nnn`, in `docs/discovery/inventory/M19/<S#-key>.json`, plus the shell files `SHA-admin-shell.json` (214) and `SHU-user-shell.json` (374). Reconciliation, the crawl and the read-only limits are in `docs/discovery/inventory/M19/_summary.md`.
- **Safety:**
  - A context-level guard (`tools/jobs/M19-guard.js`) was installed **before any capture**: it aborts every request whose method is not GET / HEAD / OPTIONS except `POST /login`, every request to a payment-gateway host (ToyyibPay, Billplz, Stripe, senangPay, iPay88, CHIP, FPX …) and every download / export navigation. Verified by probe: a `POST` and a `DELETE` to `/__m19_probe` were both blocked.
  - Nothing was submitted, saved, deleted, exported, downloaded or paid. Never triggered: the row delete forms (`POST _method=DELETE /admin/payments/{id}`, `confirm('Padam pembayaran ini?')`), "Padam Dipilih" (`POST /admin/payments/bulk-delete`), the S3 "Simpan" (`PUT /admin/payments/{id}`), the three pricing "Langgan …" buttons (`POST /subscribe/regular`, `POST /subscribe/personal` → ToyyibPay), the WhatsApp links, the dashboard CSV export `/admin/export/payments`.
  - Client-side reveals only: S1 row / header checkboxes (Alpine `selectedIds`, reveals the "n dipilih" bar), the S6 FAQ accordion. Filters and pagination were driven by URL query strings (GET).
  - One browser, one request at a time, ≥ 350 ms between navigations (450 ms in the crawl and the snapshot).

Cross-references (owned elsewhere, not re-inventoried):
- **`/admin/school-subscriptions`** (S12–S15, "Langganan Sekolah", sidebar group "Pengguna") is **M02**. M19 read its list once for the count cross-check (§5.3), which found that the M02 seed rows differ from live.
- **Teacher cash-out** (`/guru/gamifikasi/tebus-tunai` "Tebus Tunai", `/admin/gamifikasi/guru/tunai` "Tebus Tunai Guru — Admin") is **M14** (coins → cash, admin-processed, no payment gateway). Both return 200 today; recorded in the crawl as M14.
- `/admin/gamification/transactions` (coin ledger) is **M14**; `/admin/hadiah?cat=ewallet` (e-wallet rewards) is **M15**.
- The S1 admin dashboard "Muat Turun Data (CSV)" → "Pembayaran" (`/admin/export/payments`) is an M17 S1 link to an M19 export; never opened.
- `/users/{id}/edit` "Pakej Langganan" (student `subscription_package`) and `/admin/users/{id}/packages` "Assign Pakej SPM" are **M02** (§5.3 C7).
- The M05 free-trial copy ("Baki percubaan percuma", link "Langgan untuk akses tanpa had" → `/pricing`) is **M05**; M19 S6 repeats the 50-question trial.

---

## 1. Overview

The TRACKER checklist had 5 M19 routes. The crawl found **7 screens** (2 new routes), 4 write endpoints (never submitted) and 1 download.

| # | Route | Tab title (`<title>`) · header | Status on admin account |
|---|---|---|---|
| S1 | `/admin/payments` (`?search=&status=&type=&gateway=&page=`) | "Pembayaran - Admin Panel" · SHA "Senarai Pembayaran" / "Semua transaksi pembayaran pelajar" | 200 |
| S2 | `/admin/payments/{id}` (**new**) | "Pembayaran #{id}" · SHA "Butiran Pembayaran" / "Pembayaran #{id}" | 200; unknown id → 404; `/admin/payments/create` → **500** |
| S3 | `/admin/payments/{id}/edit` (**new**) | "Edit Pembayaran #{id}" · SHA "Edit Pembayaran" / "Pembayaran #{id}" | 200; unknown id → 404 |
| S4 | `/admin/billing` | "Billing Dashboard - Admin Panel" · SHA "Billing Dashboard" / "Ringkasan langganan dan hasil platform" | 200; query strings ignored |
| S5 | `/admin/dunning` (`?type=&event=&page=`) | "Dunning Log — Admin" · SHA "Dashboard" / "Selamat datang, Admin" (**wrong header**, D-M19-02) | 200 |
| S6 | `/pricing` | "Pilih Pakej Anda - PRESTASIPLUS" · SHU "Dashboard" / "Selamat datang kembali" (**wrong header**, D-M19-03) | 200 |
| S7 | `/billing/invoices` | "Sejarah Invois - PRESTASIPLUS" · SHU "Sejarah Invois" / "Rekod pembayaran dan invois anda" | 200 (admin has 0 invoices) |

Access outcomes found by probing: **404** "Halaman Tidak Dijumpai" for `/admin/payments/99999999`, `/admin/payments/99999999/edit`, `/admin/subscriptions`, `/admin/individual-subscriptions`, `/admin/invoices`, `/admin/packages`, `/admin/pricing`, `/billing`, `/billing/invoices/1`, `/subscribe`, `/subscription`, `/langganan`, `/pakej`, `/guru/invois`. **500** "Ralat Pelayan" for `/admin/payments/create`. **405** Symfony page "Oops! An Error Occurred" / "The server returned a "405 Method Not Allowed"." for `GET /subscribe/regular` and `GET /subscribe/personal` (POST-only routes).

**Entry points:**
- SHA sidebar group toggle **"Kewangan"** (`fa-credit-card`; `isOpen('kewangan')`) with "Pembayaran" (`fa-credit-card`) → S1, "Billing Dashboard" (`fa-chart-line`) → S4, "Dunning Log" (`fa-bell-slash`) → S5. The active item is highlighted on S1–S3 ("Pembayaran"), S4 and S5. In the mobile "Lagi" drawer the same three links are listed (hidden until opened).
- SHU user menu (avatar dropdown and the mobile drawer): "Pakej 💎" (`fa-crown`) → S6, "Invois Saya" (`fa-file-invoice`) → S7, and for the admin account "Billing Dashboard" (`fa-chart-line`) → S4.
- In-module: S1 row actions `fa-eye` → S2, `fa-pen` → S3; S2 "Senarai Pembayaran" → S1, "Edit" → S3; S3 "Senarai Pembayaran" → S1, "#{id}" → S2, "Batal" → S2; S4 "Lihat Semua" → S1; S7 "Lihat Pakej" / "Terokai Pakej" → S6.
- From other modules: M05 trial notice "Langgan untuk akses tanpa had" → S6; M17 S1 export "Pembayaran" → `/admin/export/payments`.

### 1.1 Shell by screen

| Screen | Shell | Evidence |
|---|---|---|
| S1–S5 | `SHA` admin panel (server-status chips, sidebar, header title per page) | `adminSidebar()`; header per page as §1 |
| S6, S7 | `SHU` user portal (coin / mata / streak chips, notification bell, avatar menu, tournament banner "LIVE:" / "MAIN" / "DAFTAR" hidden) | same shell as M05–M16 user pages |
| error states | global 404 / 500 pages (no shell); 405 unbranded Symfony page | S2 `not-found`, `create-500`, S3 `not-found` |

## 2. Screens

### 2.1 S1 — `/admin/payments` "Senarai Pembayaran"

1. **Stat cards** (5, `grid grid-cols-2 md:grid-cols-5`): "59" "Jumlah", "8" "Berjaya" (green), "51" "Pending" (amber), "0" "Gagal" (red), "RM240.00" "Hasil" (blue). The cards are **global**: they do not change with any filter or page. Labels are `text-[9px] sm:text-xs` (9 px below 640 px, D-M19-06).
2. **GET filter card:** search input `search` placeholder "Cari nama, emel, bill code..."; select `status` ("" "Semua Status", `paid` "Berjaya", `pending` "Pending", `failed` "Gagal"); select `type` ("" "Semua Jenis", `regular` "Biasa", `personal` "Personal", `pksk` "PKSK"); select `gateway` ("" "Semua Gateway", `toyyibpay` "ToyyibPay", `bizappay` "BizAppay"); button "Cari" (`fa-search`). When any filter is set a link **"Reset"** (`fa-times`) → `/admin/payments` appears after "Cari".
3. **Selection bar** (Alpine `paymentBulk()`, `x-show="selectedIds.length"`): red card `fa-check-circle` "{n} dipilih" (`x-text="selectedIds.length"`) and button "Padam Dipilih" (`fa-trash`, `@click="bulkDelete()"` → `confirm(\`Padam ${n} pembayaran yang dipilih?\`)` → submits the hidden form `POST /admin/payments/bulk-delete` with `_token`, `_method`, `ids[]`). The bar is hidden with 0 selected. The header checkbox `toggleAll` selects the ids of the current page only (20: `[65,64,…,46]` on page 1). Neither the confirm nor the submit was triggered.
4. **Table** (card, `overflow-x: auto`): header checkbox, "Pelajar", "Pakej", "Gateway", "Jumlah", "Status", "Tarikh", "Tindakan". Row: checkbox (`x-model="selectedIds"`, value = payment id); payer name (bold) + e-mail line (10 px, masked); "Pakej" badge — `regular` = "Biasa" (`fa-brain`, blue) / `personal` = "Personal" (`fa-user`, purple) — with the billing period under it ("Monthly" / "Onetime", 10 px); gateway "Toyyibpay"; amount "RM10.00" / "RM90.00" (bold); status badge "Berjaya" (`fa-check-circle`, green) / "Pending" (`fa-clock`, amber) / "Gagal" (INFERRED red; none on live); "Tarikh" = created date "13 Sep 2026" + time "12:34" (10 px); actions `fa-eye` → S2, `fa-pen` → S3, `fa-trash` (form `POST /admin/payments/{id}` `_method=DELETE`, `onsubmit="return confirm('Padam pembayaran ini?')"`).
5. **Order:** created date descending (id 12, created 22 Apr 17:28, lists before id 14, 22 Apr 12:55). 20 per page.
6. **Pager** (Laravel tailwind): "« Previous" (disabled on page 1), page links "1" "2" "3", "Next »", text "Showing 1 to 20 of 59 results" (page 2 "21 to 40", page 3 "41 to 59"). Filter values are kept in page links (e.g. `?status=pending&page=2`).
7. **Empty state** (`status=failed`, `type=pksk`, `gateway=bizappay`, `search` with no match, `?page=99`): card "Tiada Pembayaran" / "Transaksi pembayaran akan dipaparkan di sini apabila pelajar mula melanggan." The table and the pager are not rendered; the same message is used for a filtered no-match (no filter-specific copy).
8. `status=bogus` behaves like a filter matching nothing (empty state + "Reset").

### 2.2 S2 — `/admin/payments/{id}` "Butiran Pembayaran" (new)

- Top row: breadcrumb "Senarai Pembayaran" (`fa-arrow-left`) → S1, "/", "#{id}"; buttons "Edit" (`fa-pen`) → S3 and "Padam" (`fa-trash`, form `POST /admin/payments/{id}` `_method=DELETE`, `confirm('Padam pembayaran ini?')`; never clicked).
- **Status banner:** paid (green, `fa-check-circle`) "Pembayaran Berjaya" / "Dibayar pada {d M Y, H:i}" and the amount "RM90.00" on the right; pending (amber, `fa-clock`) "Menunggu Pembayaran" / "Pembayaran belum selesai" and "RM10.00". Failed INFERRED (none on live).
- **Card "Maklumat Pembayaran"** (`fa-info-circle`, 2 columns from `sm`): "Pelajar" (name + e-mail, masked); "Pakej" `personal` / `regular` with the period `monthly` / `onetime` under it (raw values, capitalised by CSS: "Personal" / "Monthly"); "Gateway" `toyyibpay` ("Toyyibpay"); "Bill Code" (monospace, masked); "Gateway Bill Code" (monospace, masked); "Gateway Ref" "—" on every payment observed; "Tarikh Dicipta" "13 Sep 2026, 12:34:29".
- Observed variants: #65 personal monthly paid, #64 regular monthly pending, #25 personal onetime paid ("Dibayar pada 16 May 2026, 11:37", created "16 May 2026, 11:35:57"). All 59 detail pages have a bill code and a gateway bill code, and "—" as gateway ref (snapshot `S2_paymentDetail`).
- `/admin/payments/99999999` → global 404 "Halaman Tidak Dijumpai" ("🔍", "Maaf, halaman yang anda cari tidak wujud atau telah dipindahkan. Mungkin URL salah taip?", "Halaman Utama", "Mula Latihan", "PRESTASIPLUS"). `/admin/payments/create` → global 500 "Ralat Pelayan" ("⚙️", "500", "Sesuatu tidak kena di pihak kami. Pasukan teknikal telah dimaklumkan. Sila cuba sebentar lagi.", "Halaman Utama", "Cuba Semula") — D-M19-01.

### 2.3 S3 — `/admin/payments/{id}/edit` "Edit Pembayaran" (new)

- Breadcrumb "Senarai Pembayaran" (`fa-arrow-left`) → S1, "/", "#{id}" (link → S2), "/", "Edit".
- Summary card: payer (name + e-mail, masked), amount "RM90.00", "{type} · {gateway}" ("personal · toyyibpay", "regular · toyyibpay").
- Card **"Status Pembayaran"**: form `POST /admin/payments/{id}` (`_token`, `_method=PUT`) with 3 radio tiles `status` in a 3-column grid — "Berjaya", "Pending", "Gagal" (the saved status is checked); note `fa-info-circle` "Tukar status ke "Berjaya" akan menetapkan tarikh bayaran ke sekarang."; button "Simpan" (`fa-save`, never clicked) and link "Batal" → S2.
- Unknown id → 404.

### 2.4 S4 — `/admin/billing` "Billing Dashboard"

- Hero (orange → red gradient): "Admin Panel", "Billing Dashboard", "Semua data langganan dan pembayaran platform PRESTASIPLUS", `fa-chart-line` tile.
- **4 stat cards** (1 / 2 / 4 columns at 375 / 768 / 1280): "Langganan Sekolah Aktif" **9** `fa-school` + "Sekolah berlangganan" (`fa-check-circle`); "Langganan Individu Aktif" **94** `fa-users` + "Pelajar berlangganan" (`fa-user`); "Dalam Grace Period" **0** `fa-hourglass-half` + "Perlu pembaharuan" (`fa-clock`); "Hasil Bulan Ini" **RM90.00** `fa-dollar-sign` + "September 2026" (`fa-calendar-alt`).
- **"Pecahan Pakej Aktif (Sekolah)"** (`fa-layer-group`): one tile per package with active school subscriptions (`fa-box`) — "9" "Pakej SPM Tingkatan 5".
- **"Pembayaran Terkini"** / "20 transaksi terbaru platform", link "Lihat Semua" (`fa-arrow-right`) → S1. Table "Tarikh", "Pengguna", "Jenis", "Jumlah", "Status": date "13/09/2026 12:34"; payer name + e-mail (masked); "Jenis" badge (grey) = raw `regular` for **every row, including the RM90.00 personal payment #65** (D-M19-04); amount; status "Berjaya" (`fa-check-circle`, green) / "Menunggu" (`fa-clock`, amber). The 20 rows are the 20 newest payments (= S1 page 1). No row links.
- `?month=2026-08` is ignored (same figures).

### 2.5 S5 — `/admin/dunning` "Dunning Log"

- H1 "Dunning Log" (24 px), "Senarai peringatan langganan yang dihantar". The SHA header shows the default "Dashboard" / "Selamat datang, Admin" (D-M19-02).
- **4 stat cards** (2 / 4 columns): "Jumlah Log" **21**, "7 Hari Lepas" **0**, "3-Hari Amaran" **7**, "Tamat Tempoh" **0**.
- **GET filter:** label "Jenis", select `type` ("" "Semua", `school` "Sekolah", `individual` "Individu"); label "Event", select `event` ("" "Semua", `reminder_7d` "7 Hari", `reminder_3d` "3 Hari", `reminder_1d` "1 Hari", `expired` "Tamat", `grace_start` "Grace Start", `grace_end` "Grace End"); button "Tapis"; link "Reset" when a filter is set.
- **Table** "ID", "Jenis", "Sub ID", "Event", "Dihantar": "#23" · badge "Individual" (or "School") · "5600" · badge "1 Hari" / "3 Hari" / "7 Hari" · "21 Jul 2026 08:00". Newest first. 21 rows on one page (no pager at 21).
- **Empty state** ("event=expired", "grace_start", "grace_end"): "📭" "Tiada log dunning dijumpai.". `?page=2` shows the empty state plus the pager "« Previous" / "1" / "Next »" and "Showing 0 of 21 results" (Laravel default).

### 2.6 S6 — `/pricing` "Pilih Pakej Anda"

1. H1 "Pilih Pakej Anda" (30 px; 20 px at 375), "Tingkatkan pengalaman belajar anak anda dengan pakej yang bersesuaian".
2. Green banner `fa-gift` "Percubaan Percuma" — "Setiap pelajar baru mendapat **50 soalan percuma** untuk dicuba — campur semua subjek, sekali sahaja."
3. **4 package cards** (1 / 2 / 4 columns):
   - Cards use `fa-check-circle` ticks and a grey `fa-times-circle` for a missing feature; card icons `fa-user-graduate` (Pelajar), `fa-school` (Sekolah), `fa-star` (Personal Bulanan), `fa-crown` (Personal Setahun).
   - **"Pelajar"** — "Langganan Bulanan", "RM10" "/bulan", "Untuk pelajar & ibu bapa"; ticks "**500** soalan sebulan", "Semua subjek tersedia", "Latih tubi interaktif", "Semua tahap kesukaran", greyed "Tiada analisa prestasi"; form `POST /subscribe/regular` (`billing=monthly`) button "Langgan RM10/bulan" (`fa-bolt`); hint "Sesuai untuk latihan kendiri".
   - **"Sekolah"** — ribbon "Via PPD", "Per Sesi Pembelajaran", "RM30" "/sesi", "Per pelajar, pendaftaran pukal"; "**Unlimited** soalan", "Semua subjek tersedia", "Analisa prestasi **bulk**", "Pendaftaran pukal oleh sekolah", "Laporan untuk guru & pentadbir"; link "Hubungi Kami" (`fa-whatsapp`) → `https://wa.me/60XXXXXXXXX?text=Saya%20berminat%20dengan%20Pakej%20Sekolah%20PRESTASIPLUS` (number masked here); hint "Minima 100 pelajar (Jumlah boleh dirunding)".
   - **"Personal Bulanan"** — ribbon "Popular", "Langganan Bulanan", "RM90" "/bulan", "Unlimited, bayar bila perlu"; "**Unlimited** soalan", "**Semua subjek** (ikut SK/SMK)", "Analisa prestasi **individu penuh**", "Laporan kemajuan peribadi"; form `POST /subscribe/personal` (`billing=monthly`) button "Langgan RM90/bulan" (`fa-star`); hint "Sesuai cuba dulu sebelum komit setahun".
   - **"Personal Setahun"** — ribbon "Terbaik Nilai", "Sesi Persekolahan", "RM200" "/sesi", "Setahun penuh, ikut tahun pelajar"; "**Unlimited** soalan", "**Semua subjek** (ikut SK/SMK)", "Sah sehingga **10 Januari** (1 sesi)", "Auto naik darjah bila renew"; form `POST /subscribe/personal` (`billing=onetime`) button "Langgan RM200/sesi" (`fa-crown`); hint "Pilihan terbaik untuk satu tahun penuh".
4. **"Tersedia Untuk Semua Tahap Pendidikan"** (amber card, `fa-graduation-cap`): "Sekolah Rendah" (`fa-child`) "Darjah 1–6 (KSSR)" "BM, BI, Matematik, Sains, dll"; "Menengah Rendah" (`fa-book-reader`) "Tingkatan 1–3 (KSSM)" "Subjek teras + elektif"; "SPM" (`fa-user-graduate`) "Tingkatan 4–5 (KSSM)" "Persediaan peperiksaan SPM".
5. **"Pakej Sekolah Mengikut Tahap"** — "Pendaftaran pukal melalui sekolah/PPD — semua RM30 per pelajar per sesi"; tiles "Pakej Rendah" "Darjah 1–6" "RM30" "per pelajar · sehingga 6 tahun"; "Pakej Menengah" "Tingkatan 1–3" "RM30" "per pelajar · sehingga 3 tahun"; "SPM Ting. 4" "Tingkatan 4" "RM30" "per pelajar · sehingga 2 tahun"; "SPM Ting. 5" "Tingkatan 5" "RM30" "per pelajar · sehingga 1 tahun"; link "Hubungi Untuk Pendaftaran Sekolah" (`fa-whatsapp`, same wa.me link).
6. **"Perbandingan Pakej"** table (scrolls inside its card at 375): header "Ciri", "Percuma", "Pelajar" "RM10/bln", "Sekolah" "RM30/sesi", "Personal" "RM90/bln · RM200/sesi". Ticks are `fa-check`, crosses `fa-times`. Rows: "Had Soalan" "50 (sekali)" · "500/bulan" · "Unlimited" · "Unlimited"; "Subjek" "Campur" · "Semua" · "Semua" · "Semua"; "Latih Tubi" ✓ ✓ ✓ ✓; "Analisa Prestasi" ✗ · ✗ · "Bulk" · "Individu"; "Laporan Peribadi" ✗ · ✗ · ✗ · ✓; "Mini-Games" "Terhad" · ✓ · ✓ · ✓; "Tempoh" "Sekali" · "Sebulan" · "Per sesi" · "Per sesi".
7. Pill `fa-lock` "Pembayaran selamat melalui" **"Toyyibpay"**.
8. **"Soalan Lazim"** (Alpine `{ open: null }`, one open at a time, `fa-chevron-down`): "Apa itu Percubaan Percuma?" → "Setiap pelajar baru mendapat 50 soalan percuma untuk dicuba — campur semua subjek, sekali sahaja per akaun. Tiada bayaran diperlukan."; "Bagaimana Pakej Sekolah berfungsi?" → "Sekolah mendaftar secara pukal melalui PPD atau admin sekolah dengan harga RM30 per pelajar per sesi pembelajaran. Pelajar mendapat akses unlimited ke semua subjek dengan analisa prestasi bulk. Guru dan pentadbir mendapat akses percuma secara automatik."; "Apa maksud "per sesi pembelajaran"?" → "Satu sesi pembelajaran bermaksud satu tempoh pengajian yang ditetapkan oleh sekolah atau PPD. Hubungi kami untuk maklumat lanjut tentang tempoh sesi."; "Adakah guru perlu bayar?" → "Tidak! Guru, pentadbir sekolah, dan pegawai PPD mendapat akses percuma secara automatik apabila sekolah mereka melanggan Pakej Sekolah."; "Apakah kaedah pembayaran yang diterima?" → "Kami menerima pembayaran melalui FPX (perbankan internet) dan kad kredit/debit melalui Toyyibpay."
9. The admin viewer sees no "current package" marker; whether a subscribed student sees one is not observable (§9).

### 2.7 S7 — `/billing/invoices` "Sejarah Invois"

- Header card (orange top border, `fa-file-invoice-dollar` tile): "Sejarah Invois", "Jumlah 0 invois dijumpai", button "Lihat Pakej" (`fa-crown`) → S6.
- **Empty state** (`fa-file-invoice` tile): "Tiada Invois Dijumpai", "Anda belum mempunyai sebarang invois. Langgan pakej premium untuk mula belajar tanpa had.", button "Terokai Pakej" (`fa-crown`) → S6.
- Amber note `fa-info-circle` "Invois PDF hanya tersedia untuk pembayaran yang berstatus **Dibayar**. Sekiranya ada pertanyaan mengenai bil anda, sila hubungi sokongan kami."
- The list layout with invoices, its columns and the PDF link are **not observable** with the admin account (0 payments, §9). `/billing/invoices/1` → 404.

## 3. Flows

### 3.1 Navigation
Kewangan → Pembayaran (S1) → eye → S2 → Edit → S3 → Batal → S2 → "Senarai Pembayaran" → S1. Kewangan → Billing Dashboard (S4) → "Lihat Semua" → S1. Kewangan → Dunning Log (S5). User menu → "Pakej 💎" (S6) / "Invois Saya" (S7) → "Lihat Pakej" / "Terokai Pakej" → S6.

### 3.2 Subscribe (observed up to the options page only)
S6 "Langgan RM10/bulan" → `POST /subscribe/regular billing=monthly`; "Langgan RM90/bulan" → `POST /subscribe/personal billing=monthly`; "Langgan RM200/sesi" → `POST /subscribe/personal billing=onetime`. The server creates a **pending** payment (S1 shows 51 pending, many in bursts of 2–4 per payer within seconds — each click creates one) with a ToyyibPay bill code and redirects to ToyyibPay (INFERRED from the gateway names and the FAQ). On return / callback the payment becomes "Berjaya" with `paid_at` (S2 "Dibayar pada" is 1–3 minutes after "Tarikh Dicipta"). Per D4 the rebuild simulates the gateway. School package: WhatsApp only (no online payment).

### 3.3 Admin status change
S3 radio + "Simpan" → `PUT /admin/payments/{id}`; setting "Berjaya" sets the paid date to now (page note). Effect on the user's package: not observable (§9).

### 3.4 Dunning
A scheduled job (runs at **08:00**) writes a log row 7, 3 and 1 days before a subscription ends (events `reminder_7d`, `reminder_3d`, `reminder_1d`), plus `expired`, `grace_start`, `grace_end` (never logged). Verified by arithmetic (§5.2).

## 4. Data entities implied

| Entity | Fields (observed / INFERRED) | Owner |
|---|---|---|
| Payment | `id` int (7–65 live), `userId` (payer), `type` `regular`\|`personal`\|`pksk`, `billing` `monthly`\|`onetime`, `gateway` `toyyibpay`\|`bizappay`, `amount` (RM, 2 dp), `status` `paid`\|`pending`\|`failed`, `billCode`, `gatewayBillCode`, `gatewayRef` (null on all), `paidAt`, `createdAt` | M19 |
| DunningLog | `id` int (3–23 live), `type` `school`\|`individual`, `subscriptionId` ("Sub ID"), `event` enum (7), `sentAt` | M19 |
| Individual subscription | the user's `subscriptionPackage` + `subscriptionExpiresAt` (M02 DATA-M02-01 fields; M02 BR-12 says M19 owns the rules) — "Sub ID" values 3614–5600 lie in the user id range (INFERRED: user id) | M19 rules, M02 fields |
| SchoolSubscription | M02 DATA-M02-07 (read only) | M02 |
| PackageCatalogue | constants of S6 (4 cards, 4 school tiles, comparison rows, FAQ) | M19 |
| Invoice | one per paid payment (INFERRED from the S7 note "hanya … berstatus Dibayar") | M19 |

## 5. Figures: how each seems to be computed, sources and cross-module conflicts

### 5.1 Figures and their probable source

| Screen · figure | Live value | Probable source | Check |
|---|---|---|---|
| S1 "Jumlah" | 59 | count(payments) | ids 7–65 contiguous = 59 ✓ |
| S1 "Berjaya" | 8 | count(status = paid) | #20, 25, 31, 32, 35, 40, 57, 65 ✓ |
| S1 "Pending" | 51 | count(status = pending) | 59 − 8 ✓ |
| S1 "Gagal" | 0 | count(status = failed) | ✓ |
| S1 "Hasil" | RM240.00 | Σ amount of paid payments, all time | 6 × 10 + 2 × 90 = 240 ✓ |
| S1 filters | paid 8, pending 51, failed 0, regular 51, personal 8, pksk 0, toyyibpay 59, bizappay 0, paid+personal 2 | row filters; stat cards unchanged | ✓ |
| S4 "Langganan Sekolah Aktif" | 9 | count(school subscriptions status = active) | = M02 S12 "9 Aktif" ✓ |
| S4 "Pecahan Pakej Aktif (Sekolah)" | 9 "Pakej SPM Tingkatan 5" | active school subscriptions grouped by package | all 9 live active rows are T5 ✓ (conflicts with the M02 seed, §5.3 C4) |
| S4 "Langganan Individu Aktif" | 94 | INFERRED: students with `subscriptionPackage` ≠ `none` and not expired | **not reproducible from payments**: only 2 payers hold a currently valid paid package (§5.3 C6) |
| S4 "Dalam Grace Period" | 0 | count(school subscriptions status = grace) | = M02 S12 "0 Tempoh Ihsan" ✓ |
| S4 "Hasil Bulan Ini" | RM90.00 · "September 2026" | Σ amount of payments paid in the current calendar month (by `paidAt`) | #65 paid 13 Sep ✓ |
| S4 "Pembayaran Terkini" | 20 rows | 20 newest payments by created date | = S1 page 1 ✓ |
| S5 "Jumlah Log" | 21 | count(dunning logs) | ids #3–#23 ✓ |
| S5 "7 Hari Lepas" | 0 | logs with `sentAt` in the last 7 days | newest 21 Jul ✓ |
| S5 "3-Hari Amaran" | 7 | count(event = reminder_3d) | ✓ (7 / 7 / 7 per reminder event) |
| S5 "Tamat Tempoh" | 0 | count(event = expired) | ✓ |
| S5 type filter | school 3, individual 18 | | ✓ 21 |
| S6 prices | RM10 /bulan, RM30 /sesi, RM90 /bulan, RM200 /sesi, school tiles RM30 × 4, trial 50 | static page copy | §5.3 C7 |
| S7 | "Jumlah 0 invois dijumpai" | the viewer's invoices (admin: 0 payments) | ✓ |

Payment distribution (snapshot, by created month · type · status): Apr 2026 regular pending 8, personal onetime pending 2; May regular paid 4, regular pending 11, personal onetime paid 1, personal onetime pending 4; Jun regular paid 2, regular pending 22; Jul regular pending 1; Sep regular pending 3, personal monthly paid 1. Amounts: regular RM10.00, personal RM90.00 (both `onetime` and `monthly`). 30 distinct payers (tokens `<payer:1>`–`<payer:30>`).

### 5.2 Formulas verified by arithmetic

- **Dunning ↔ payments:** every individual log chain fits "paid date + 1 month = end; reminders at 08:00 on end − 7 / − 3 / − 1 days": Sub 4373 (31 May, 4 Jun, 6 Jun → end 7 Jun = #20 paid 7 May); 5450 / 5451 (12, 16, 18 Jun → end 19 Jun = #31 / #32 paid 19 May); 3614 (15, 19, 21 Jun → end 22 Jun = #35 paid 22 May); 5475 (8, 12, 14 Jul → end 15 Jul = #40 paid 15 Jun); 5600 (15, 19, 21 Jul → end 22 Jul = #57 paid 22 Jun). The one-time personal payment #25 (valid to 10 Jan, pricing) and #65 (paid 13 Sep, end 13 Oct) have no reminders yet — consistent.
- **School dunning:** Sub 4 (15, 19, 21 May) → end 22 May 2026 = live school subscription **4** (SMK Bandar Seri Putra, "Tamat", ends 22/05/2026). No `expired` row was written although it expired.
- **Subscribe bursts:** 51 pending rows include 2–4 identical rows per payer at the same minute (e.g. #46–#49 17 Jun 03:18) — repeated clicks or reloads each create a payment.

### 5.3 Cross-module conflicts (owner must resolve)

**C1 — M02 subscription seed does not match live (owner M02; M02 SRS v1.17 §6.14 "Subscriptions", XL2-04).** The live list today (`M02_subscriptions` in the snapshot; school ids from the M02 school search by code):

| Live id | School (id) | Level | Tier | Used / quota | Status | Start – end | M02 v1.17 seed |
|---|---|---|---|---|---|---|---|
| 14 | 8277 SAM HULU LANGAT | T5 | Pemantauan | 150/1000 | Aktif | 12/05/2026 – 12/05/2027 | 14 ✓ |
| 15 | 8880 SMK TINGGI KLUANG | T5 | Pemantauan | 59/1000 | Aktif | 12/05/2026 – 12/05/2027 | **15 = 10220** (and 8880 = id 4, T4, quota 164) |
| 13 | 8102 SMK BANDAR TASIK KESUMA | T5 | Penuh | 776/1000 | Batal | 12/05/2026 – 12/05/2027 | 13 ✓ |
| 12 | 8082 SMK ENGKU HUSAIN | T5 | Penuh | 549/1000 | Aktif | 12/05/2026 – 12/05/2027 | **id 3** |
| 11 | 10220 SMK Leqoe | T5 | Pemantauan | 2/1000 | Aktif | 11/05/2026 – 11/05/2027 | **id 15, quota 305**; 11 = inferred cancelled at 8088 |
| 10 | 8106 SMK BANDAR RINCHING | T5 | Penuh | 562/500 | Aktif | 21/04/2026 – 08/05/2027 | 10 ✓ |
| 9 | 8078 SMK BANDAR BARU BANGI | T5 | Penuh | 423/415 | Aktif | 13/04/2026 – 12/05/2027 | **id 2**; 9 = inferred cancelled at 9726 |
| 8 | 8080 SMK KHIR JOHARI | T5 | Penuh | 185/164 | Aktif | 11/03/2026 – 12/05/2027 | **id 1, quota 1000**; 8 = 8107 expired |
| 7 | 8090 SMK PANDAN INDAH | T5 | Penuh | 386/354 | Aktif | 08/03/2026 – 08/05/2027 | **id 5, quota 1000**; 7 = 8228 cancelled |
| 6 | 8087 SMK JALAN REKO | T5 | Penuh | 312/305 | Aktif | 07/03/2026 – 19/04/2027 | 6 ✓ school, **quota 354** |
| 5 | 8277 SAM HULU LANGAT | T5 | Pemantauan | 150/150 | Batal | 03/03/2026 – 03/04/2026 | **id 5 = 8090 active** (no 2nd 8277 row) |
| 4 | 8107 SMK BANDAR SERI PUTRA | T5 | Pemantauan | 675/675 | Tamat | 03/03/2026 – 22/05/2026 | **id 8** |
| 2 | 8880 SMK TINGGI KLUANG | T4 | Pemantauan | 59/120 | Batal | 20/02/2026 – 20/02/2027 | **id 2 = 8078**; T4 cancelled was put at 8228 (id 7) |
| 1 | 8228 SMK TINGGI KLANG | T4 | Pemantauan | 13/150 | Batal | 20/02/2026 – 20/02/2027 | **id 1 = 8080 active** |

(id 3 does not exist on live.) Totals still agree: 14 rows, 9 active, 0 grace, 1 expired, 4 cancelled, Σ active quota 5,738, 12 distinct schools. What differs: row ids, the two extra cancelled rows (live: 8277 id 5 and 8880 id 2, not 9726 / 8088), the tiers (live has **7 Pemantauan** rows: 14, 15, 11, 5, 4, 2, 1 — M02 seeds only 14 and 15 as basic), the T4 rows (live: both T4 rows cancelled; M02 seeds an active T4 at 8880 — contradicted by S4 "9 Pakej SPM Tingkatan 5"), quotas of ids 1/3/4/5/6/15 in the seed, and start dates. M19's dunning row "Sub ID 4" (school) references live id 4 (8107) — with the M02 seed it would point at 8880. **Recommendation:** M02 replaces its 14 rows with the table above (now fully observed), so M19 S4 and S5 compute from the same store.

**C2 — "used" per school** (live, above) is new evidence for M02 BR-24: 8277 150, 8880 59, 8102 776, 8082 549, 10220 2, 8106 562, 8078 423, 8080 185, 8090 386, 8087 312, 8107 675, 8228 13. M02 §6.15 C and M11 §6.7 must be checked against these (8082 549 already matches M17).

**C3 — S4 "Pecahan Pakej Aktif (Sekolah)"** requires every active seed row to be T5 package 2 (see C1).

**C4 — S4 "Langganan Sekolah Aktif" 9 / "Dalam Grace Period" 0** read the M02 store; the M02 test-only profile `subscriptions-extra` (one grace row) would change S4 to "1" — keep it out of observed-figure checks.

**C5 — M02 S3 package labels vs pricing (M02 FR-M02-40):** M02 shows `personal` as "Personal Per Sesi — RM90 (hingga 10 Jan)"; live S6 sells "Personal Setahun" at **RM200** /sesi (valid to 10 Januari) and "Personal Bulanan" at **RM90** /bulan. Payments show `personal · onetime` at **RM90.00** (Apr–May 2026, 7 rows) and `personal · monthly` at RM90.00 (Sep 2026, 1 row): the one-time price was RM90 when those payments were made and is RM200 now. The M02 label is stale against the current catalogue — **contradictory copy (D9 candidate for M02)**; M19 seeds keep the observed historical RM90 amounts.

**C6 — S4 "Langganan Individu Aktif" 94:** no module defines it. From the payments only 2 payers hold a currently valid paid package (<payer:1> personal monthly paid 13 Sep → 13 Oct; <payer:23> personal onetime → 10 Jan). 94 must therefore count users whose package was set by admin (M02 S3 "Pakej Langganan") and/or complimentary pupils (M02: 90 complimentary, "pakej penuh percuma") — **Perlu pengesahan**. Until the rule is known it is a documented display constant (D11 exception) owned by M19, and no other screen may show a contradicting computed figure. M17 BR-M17-24 (login chip "AKTIF" when `subscriptionPackage` ≠ `none`) uses the same notion.

**C7 — Trial and quotas:** S6 "50 soalan percuma" = M05 trial 50 ✓. S6 "Pelajar" 500 questions/month is the individual `regular` package; the M02 school "Pemantauan" limit (live copy "80 soalan/bulan", DV-M02-08 → 500) is a different product — not a conflict, but the two "500"s must not be merged.

**C8 — School price:** S6 "RM30 per pelajar per sesi" and school tiles "sehingga 6 / 3 / 2 / 1 tahun" = M02 `priceAnnual` 30.00 and `maxRenewals` 5 / 2 / 1 / 0 (+1 year) ✓. M02 S14 upgrade copy "RM30.00/pelajar" ✓.

**C9 — PKSK:** S1 filter offers `pksk` "PKSK" (0 payments) and M02 S3 shows "Pakej PKSK" "RM20 — Akses penuh PKSK (tiada tarikh tamat)", but S6 sells no PKSK package and M07 has no price link (M07 discovery). Consistent: PKSK is admin-assigned only today.

**C10 — Ownership:** M14 teacher cash-out (coins → RM, admin-processed, bank details) is not a payment of M19 and stays M14; M19 "Hasil" never includes it.

## 6. Scripts

### 6.1 S1 `paymentBulk()` (verbatim logic)
```
selectedIds: [],
toggleAll(event) { selectedIds = event.target.checked ? [ids of the current page] : []; }
bulkDelete() { if (!selectedIds.length) return; if (confirm(`Padam ${selectedIds.length} pembayaran yang dipilih?`)) $refs.bulkForm.submit(); }
```
The bulk form holds `_token`, `_method` and one hidden `ids[]` per selected id.

### 6.2 S6 FAQ
`x-data="{ open: null }"`; each question `@click="open = open === i ? null : i"`; answers `x-show="open === i" x-transition`.

### 6.3 Other screens
S2–S5 and S7 have no page script beyond the shells.

## 7. Endpoints observed

| Method | URL | Use | Opened? |
|---|---|---|---|
| GET | `/admin/payments?search=&status=&type=&gateway=&page=` | S1 | yes |
| GET | `/admin/payments/{id}` | S2 | yes |
| GET | `/admin/payments/{id}/edit` | S3 | yes |
| PUT (POST `_method=PUT`) | `/admin/payments/{id}` | S3 "Simpan" | **no** |
| DELETE (POST `_method=DELETE`) | `/admin/payments/{id}` | S1 row / S2 "Padam" | **no** |
| POST | `/admin/payments/bulk-delete` (`ids[]`) | S1 "Padam Dipilih" | **no** |
| GET | `/admin/payments/create` | none (500) | probe only |
| GET | `/admin/billing` | S4 | yes |
| GET | `/admin/dunning?type=&event=&page=` | S5 | yes |
| GET | `/pricing` | S6 | yes |
| POST | `/subscribe/regular` (`billing=monthly`) | S6 "Langgan RM10/bulan" | **no** (GET = 405) |
| POST | `/subscribe/personal` (`billing=monthly` \| `onetime`) | S6 "Langgan RM90/bulan", "Langgan RM200/sesi" | **no** (GET = 405) |
| GET | `/billing/invoices` | S7 | yes |
| GET | `/admin/export/payments` | M17 S1 CSV | **no** (download) |
| external | `https://wa.me/60XXXXXXXXX?text=…` | S6 school contact | **no** |

## 8. Responsive behaviour (375 / 768 / 1280) and live defects

### 8.1 Layout per screen (measured by `tools/jobs/M19-measure.js`; SHA / SHU pages include a 15 px scrollbar)

| Screen | 375 | 768 | 1280 |
|---|---|---|---|
| S1 | no page overflow (sw 360); stat grid 2 columns (5th card wraps); table 896 px scrolls inside its card (`overflow-x: auto`); 5 labels at **9 px**, 40 row sub-lines at 10 px | 5-column stats; table 896 px scrolls in a 667 px card | table fits (910 px) |
| S2 | 1 column, no overflow | 2 columns | 2 columns |
| S3 | radio grid stays 3 columns; no overflow | same | same |
| S4 | cards 1 column; table 705 px scrolls in its card | cards 2 columns; table scrolls (705 in 667) | cards 4 columns; table fits |
| S5 | stats 2 columns; table 388 px scrolls in 340 px | stats 4 columns | fits |
| S6 | cards 1 column; comparison table 394 px scrolls in 340 px; 11 texts at 10 px; H1 20 px | cards 2 columns, levels 3, school tiles 2 | cards 4, levels 3, school tiles 4; H1 30 px |
| S7 | no overflow | no overflow | no overflow |

No screen has horizontal page scroll at any width. The admin sidebar is a drawer below `lg` (768 renders like 375 in the shell).

### 8.2 Live defects (D9 class; the rebuild decision is the URS writer's)

| ID | Defect | Class | Suggested rebuild |
|---|---|---|---|
| D-M19-01 | `/admin/payments/create` → HTTP 500 "Ralat Pelayan" (resource route without a view; nothing links to it) | broken route | return the global 404 page |
| D-M19-02 | S5 SHA header shows the default "Dashboard" / "Selamat datang, Admin" instead of the page title | wrong title | header "Dunning Log" / "Senarai peringatan langganan yang dihantar" |
| D-M19-03 | S6 SHU header shows "Dashboard" / "Selamat datang kembali" | wrong title | header "Pilih Pakej Anda" (subtitle = the page subtitle) |
| D-M19-04 | S4 "Jenis" shows `regular` for every row, including personal payment #65 (S1 / S2 say "Personal") | contradictory data | show the payment type as S1 does (`personal` → "Personal", `regular` → "Biasa") |
| D-M19-05 | The same pending status is "Pending" (S1, S3), "Menunggu" (S4) and "Menunggu Pembayaran" (S2 banner); the type is "Biasa" (S1) vs raw `regular` (S2, S3, S4) | inconsistent labels | **Perlu pengesahan** — follow live unless the URS writer rules it contradictory (D9 "when unsure, follow live") |
| D-M19-06 | S1 stat labels 9 px below 640 px; S1 row sub-lines, S6 hints and school-tile captions 10 px | unreadable text (precedent DV-M14-11: text ≥ 12 px) | raise to 12 px |
| D-M19-07 | `GET /subscribe/regular`, `/subscribe/personal` → unbranded Symfony 405 page | error page not branded | Perlu pengesahan (reachable only by typing the URL); follow live |
| D-M19-08 | S5 dunning never wrote an `expired` row for the school subscription that ended 22/05/2026 | data behaviour, not UI | replicate (seed has 0 `expired` rows) |

Not defects (replicate): global S1 stat cards that ignore filters; one empty-state text for every filter; Laravel English pager; stat "7 Hari Lepas" 0; BizAppay / PKSK options with no rows; the pricing admin view without a current-plan marker.

### 8.3 Audit-lesson checklist
- Every route of the TRACKER checklist opened (5/5) plus 2 new detail routes and 18 probes.
- Every filter option of S1 (status 4, type 4, gateway 3) and S5 (type 3, event 7) exercised by URL (counts in the snapshot).
- Every Alpine reveal captured (S1 selection bar single / all, 5 FAQ answers).
- Every state at 375 / 768 / 1280 for all 7 screens.
- Error states: 404 (S2, S3), 500 (create), 405 (subscribe GET), empty states S1, S5, S7.

## 9. Open questions and states requiring a live action

| # | Question | Why not observable |
|---|---|---|
| OQ-M19-01 | Definition of S4 "Langganan Individu Aktif" 94 (§5.3 C6). | Needs the backend rule; the users' packages are not listed anywhere in admin. |
| OQ-M19-02 | Checkout flow after "Langgan …": ToyyibPay bill page, return / callback URLs, success / failure pages and their copy. | Would create a payment and open the gateway (forbidden). D4: simulated. |
| OQ-M19-03 | Flash messages after S3 "Simpan", row delete and bulk delete; whether "Berjaya" also activates the user's package and sets its expiry. | Writes forbidden. |
| OQ-M19-04 | S7 with invoices: columns, status badges, the PDF link and its URL; the invoice PDF layout. | Admin account has no payments. |
| OQ-M19-05 | S6 for a subscribed student / parent / teacher (current-plan marker, disabled buttons, role gating); whether teachers see "Pakej 💎" / "Invois Saya". | Only the admin account is available on lane 1. |
| OQ-M19-06 | Meaning of dunning "Sub ID" for individual rows (user id vs a hidden individual-subscription id; values 3614–5600 fall in the user id range). | No page links to it. |
| OQ-M19-07 | Grace rules (`grace_start`, `grace_end`) and whether dunning also sends e-mail / push (M22). | No such event on live. |
| OQ-M19-08 | S1 "Gagal" badge and S2 failed banner copy. | 0 failed payments. |
| OQ-M19-09 | Does BizAppay exist as a checkout option anywhere? | 0 payments; no page offers it. |

## 10. Screenshot index (`docs/discovery/img/M19/`, all masked)

payments-desktop, payments-tablet, payments-mobile, payments-tick-one, payments-empty, payment-show-paid-desktop, payment-show-pending, payment-show-mobile, payment-show-tablet, payment-edit-desktop, payment-edit-mobile, payment-edit-tablet, payments-create-500, payment-not-found-404, billing-desktop, billing-tablet, billing-mobile, dunning-desktop, dunning-tablet, dunning-mobile, dunning-empty, pricing-desktop, pricing-tablet, pricing-mobile, pricing-faq-open, invoices-desktop, invoices-tablet, invoices-mobile (`.png`, 28).

## Appendix A — Enumerations

| Enum | Values → label |
|---|---|
| Payment status | `paid` "Berjaya" (S1 / S3 / S4), S2 "Pembayaran Berjaya"; `pending` "Pending" (S1 / S3), "Menunggu" (S4), S2 "Menunggu Pembayaran"; `failed` "Gagal" |
| Payment type | `regular` "Biasa" (S1; S4 raw "regular"); `personal` "Personal"; `pksk` "PKSK" |
| Billing period | `monthly` "Monthly"; `onetime` "Onetime" |
| Gateway | `toyyibpay` "ToyyibPay" (filter) / "Toyyibpay" (rows); `bizappay` "BizAppay" |
| Dunning type | `school` "Sekolah" (filter) / "School" (badge); `individual` "Individu" / "Individual" |
| Dunning event | `reminder_7d` "7 Hari"; `reminder_3d` "3 Hari"; `reminder_1d` "1 Hari"; `expired` "Tamat"; `grace_start` "Grace Start"; `grace_end` "Grace End" |

## Appendix B — Exact DOM strings (inventory reconciliation)

Strings of the inventory not already quoted above.

### S1-payments (`/admin/payments`)
"Showing to of results" (the numbers are separate spans), "« Previous", "Next »", "dipilih", "Tiada Pembayaran".

### S2-payment-show (`/admin/payments/{id}`)
"Pembayaran belum selesai", "onetime", "regular", "#25", "#64", "#65", "Dibayar pada 16 May 2026, 11:37", "16 May 2026, 11:35:57", "13 Sep 2026, 12:23:59", "Dibayar pada 13 Sep 2026, 12:35", "13 Sep 2026, 12:34:29".

### S3-payment-edit (`/admin/payments/{id}/edit`)
"personal · toyyibpay", "regular · toyyibpay", "404".

### S5-dunning (`/admin/dunning`)
"Showing 0 of results", "Individual", "School".

### S6-pricing (`/pricing`)
"Setiap pelajar baru mendapat untuk dicuba — campur semua subjek, sekali sahaja.", "soalan sebulan", "tersedia", "soalan", "individu penuh", "Sah sehingga (1 sesi)", "LIVE:", "MAIN", "DAFTAR".

### S7-invoices (`/billing/invoices`)
"Invois PDF hanya tersedia untuk pembayaran yang berstatus . Sekiranya ada pertanyaan mengenai bil anda, sila hubungi sokongan kami.", "Dibayar".

### Shell and page-script strings harvested with the M19 screens (owned by 00-global-ui / M22 / M16; listed for reconciliation only)
- Pager arrow icons rendered as inline `svg` (S1, S5); tournament banner "LIVE:" icon `fa-circle` (S6, S7).
- SHA server-status chip title fragment "GB /" (S1–S5).
- SHU scripts on S6 / S7: "Accept", "translate(0, 0) scale(1)", "cubic-bezier(0.22, 0.85, 0.32, 1)", "(display-mode: standalone)", "Tekan Pasang untuk arahan pemasangan", "[App] SW registered, scope:", "[App] SW registration failed:", "[FCM] Token saved:", "[FCM] Save token failed:", "[FCM] Token error:", "[FCM] Foreground message:", "[FCM] SDK load failed:", "Maaf, berlaku ralat. Sila cuba semula." (chatbot), tournament banner "Pendaftaran dibuka" / "Sedang berlangsung", chatbot quick questions "Apakah PrestasiPlus?", "Bagaimana cara mendaftar?", "Berapakah harga langganan?".
